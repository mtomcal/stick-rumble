package network

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/mtomcal/stick-rumble-server/internal/game"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		// MVP: Allow all origins (for localhost development)
		// Production: Restrict to your domain
		return true
	},
}

// Message represents the standard WebSocket message format
type Message struct {
	Type      string `json:"type"`
	Timestamp int64  `json:"timestamp"`
	Data      any    `json:"data,omitempty"`
}

// WebSocketHandler manages WebSocket connections and room management
type WebSocketHandler struct {
	roomManager       *game.RoomManager
	gameServer        *game.GameServer
	timerInterval     time.Duration // Interval for match timer broadcasts (default 1s)
}

// NewWebSocketHandler creates a new WebSocket handler with room management
func NewWebSocketHandler() *WebSocketHandler {
	return NewWebSocketHandlerWithConfig(1 * time.Second)
}

// NewWebSocketHandlerWithConfig creates a WebSocket handler with custom timer interval
func NewWebSocketHandlerWithConfig(timerInterval time.Duration) *WebSocketHandler {
	handler := &WebSocketHandler{
		roomManager:   game.NewRoomManager(),
		timerInterval: timerInterval,
	}

	// Create game server with broadcast function
	handler.gameServer = game.NewGameServer(handler.broadcastPlayerStates)

	// Register callback for reload completion to notify clients
	handler.gameServer.SetOnReloadComplete(handler.onReloadComplete)

	// Register callback for hit events
	handler.gameServer.SetOnHit(handler.onHit)

	// Register callback for respawn events
	handler.gameServer.SetOnRespawn(handler.onRespawn)

	return handler
}

// onReloadComplete is called when a player's reload finishes
func (h *WebSocketHandler) onReloadComplete(playerID string) {
	// Send updated weapon state to the player
	h.sendWeaponState(playerID)
}

// onHit is called when a projectile hits a player
func (h *WebSocketHandler) onHit(hit game.HitEvent) {
	// Get victim's current state (including updated health)
	victimState, victimExists := h.gameServer.GetPlayerState(hit.VictimID)
	if !victimExists {
		return
	}

	// Get attacker's weapon to determine damage dealt
	attackerWeapon := h.gameServer.GetWeaponState(hit.AttackerID)
	if attackerWeapon == nil {
		return
	}

	damage := attackerWeapon.Weapon.Damage

	// Broadcast player:damaged to all players in the room
	damagedMessage := Message{
		Type:      "player:damaged",
		Timestamp: 0,
		Data: map[string]interface{}{
			"victimId":     hit.VictimID,
			"attackerId":   hit.AttackerID,
			"damage":       damage,
			"newHealth":    victimState.Health,
			"projectileId": hit.ProjectileID,
		},
	}

	msgBytes, err := json.Marshal(damagedMessage)
	if err != nil {
		log.Printf("Error marshaling player:damaged message: %v", err)
		return
	}

	// Broadcast to all players in the room
	room := h.roomManager.GetRoomByPlayerID(hit.VictimID)
	if room != nil {
		room.Broadcast(msgBytes, "")
	}

	// Send hit confirmation to the attacker
	hitConfirmedMessage := Message{
		Type:      "hit:confirmed",
		Timestamp: 0,
		Data: map[string]interface{}{
			"victimId":     hit.VictimID,
			"damage":       damage,
			"projectileId": hit.ProjectileID,
		},
	}

	confirmBytes, err := json.Marshal(hitConfirmedMessage)
	if err != nil {
		log.Printf("Error marshaling hit:confirmed message: %v", err)
		return
	}

	h.roomManager.SendToWaitingPlayer(hit.AttackerID, confirmBytes)

	// If victim died, mark as dead and broadcast player:death
	if !victimState.IsAlive() {
		// Mark player as dead
		h.gameServer.MarkPlayerDead(hit.VictimID)

		// Update stats: increment attacker kills and victim deaths
		attackerState, attackerExists := h.gameServer.GetPlayerState(hit.AttackerID)
		if attackerExists {
			attackerState.IncrementKills()
			attackerState.AddXP(game.KillXPReward)
		}
		victimState.IncrementDeaths()

		deathMessage := Message{
			Type:      "player:death",
			Timestamp: 0,
			Data: map[string]interface{}{
				"victimId":   hit.VictimID,
				"attackerId": hit.AttackerID,
			},
		}

		deathBytes, err := json.Marshal(deathMessage)
		if err != nil {
			log.Printf("Error marshaling player:death message: %v", err)
			return
		}

		if room != nil {
			room.Broadcast(deathBytes, "")
		}

		// Broadcast kill credit with updated stats
		killCreditMessage := Message{
			Type:      "player:kill_credit",
			Timestamp: 0,
			Data: map[string]interface{}{
				"killerId":    hit.AttackerID,
				"victimId":    hit.VictimID,
				"killerKills": attackerState.Kills,
				"killerXP":    attackerState.XP,
			},
		}

		creditBytes, err := json.Marshal(killCreditMessage)
		if err != nil {
			log.Printf("Error marshaling player:kill_credit message: %v", err)
			return
		}

		if room != nil {
			room.Broadcast(creditBytes, "")

			// Track kill in match and check win conditions
			room.Match.AddKill(hit.AttackerID)

			// Check if kill target reached
			if room.Match.CheckKillTarget() {
				room.Match.EndMatch("kill_target")
				log.Printf("Match ended in room %s: kill target reached", room.ID)
				// TODO Story 2.6.2: Broadcast match:ended message
			}
		}
	}
}

// onRespawn is called when a player respawns after death
func (h *WebSocketHandler) onRespawn(playerID string, position game.Vector2) {
	// Create player:respawn message
	respawnMessage := Message{
		Type:      "player:respawn",
		Timestamp: 0,
		Data: map[string]interface{}{
			"playerId": playerID,
			"position": position,
			"health":   game.PlayerMaxHealth,
		},
	}

	msgBytes, err := json.Marshal(respawnMessage)
	if err != nil {
		log.Printf("Error marshaling player:respawn message: %v", err)
		return
	}

	// Broadcast to all players in the room
	room := h.roomManager.GetRoomByPlayerID(playerID)
	if room != nil {
		room.Broadcast(msgBytes, "")
	}
}

// matchTimerLoop broadcasts match timer updates at the configured interval
func (h *WebSocketHandler) matchTimerLoop(ctx context.Context) {
	ticker := time.NewTicker(h.timerInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			log.Println("Match timer loop stopped")
			return
		case <-ticker.C:
			h.broadcastMatchTimers()
		}
	}
}

// broadcastMatchTimers broadcasts timer updates to all active rooms
func (h *WebSocketHandler) broadcastMatchTimers() {
	rooms := h.roomManager.GetAllRooms()

	for _, room := range rooms {
		// Skip if match ended
		if room.Match.IsEnded() {
			continue
		}

		remainingSeconds := room.Match.GetRemainingSeconds()

		// Create match:timer message
		timerMessage := Message{
			Type:      "match:timer",
			Timestamp: 0,
			Data: map[string]interface{}{
				"remainingSeconds": remainingSeconds,
			},
		}

		msgBytes, err := json.Marshal(timerMessage)
		if err != nil {
			log.Printf("Error marshaling match:timer message: %v", err)
			continue
		}

		// Broadcast to all players in room
		room.Broadcast(msgBytes, "")

		// Check if time limit reached
		if room.Match.CheckTimeLimit() {
			room.Match.EndMatch("time_limit")
			log.Printf("Match ended in room %s: time limit reached", room.ID)
			// TODO Story 2.6.2: Broadcast match:ended message
		}
	}
}

// broadcastPlayerStates sends player position updates to all players
func (h *WebSocketHandler) broadcastPlayerStates(playerStates []game.PlayerState) {
	if len(playerStates) == 0 {
		return
	}

	// Create player:move message
	message := Message{
		Type:      "player:move",
		Timestamp: 0, // Will be set by each client
		Data: map[string]interface{}{
			"players": playerStates,
		},
	}

	msgBytes, err := json.Marshal(message)
	if err != nil {
		log.Printf("Error marshaling player:move message: %v", err)
		return
	}

	// Broadcast to all players (both in rooms and waiting)
	// This ensures all connected clients receive game state updates
	for i := range playerStates {
		room := h.roomManager.GetRoomByPlayerID(playerStates[i].ID)
		if room != nil {
			// Player is in a room - broadcast to room
			room.Broadcast(msgBytes, "")
		} else {
			// Player is not in a room yet (waiting) - send directly to their channel
			h.roomManager.SendToWaitingPlayer(playerStates[i].ID, msgBytes)
		}
	}
}

// Global handler instance for the legacy function to share room state
var globalHandler = NewWebSocketHandler()

// Start starts the game server tick loop and match timer broadcasts
func (h *WebSocketHandler) Start(ctx context.Context) {
	h.gameServer.Start(ctx)
	go h.matchTimerLoop(ctx)
}

// Stop stops the game server
func (h *WebSocketHandler) Stop() {
	h.gameServer.Stop()
}

// StartGlobalHandler starts the global handler's game server
func StartGlobalHandler(ctx context.Context) {
	globalHandler.Start(ctx)
}

// StopGlobalHandler stops the global handler's game server
func StopGlobalHandler() {
	globalHandler.Stop()
}

// HandleWebSocket upgrades HTTP connection to WebSocket and manages message loop
func (h *WebSocketHandler) HandleWebSocket(w http.ResponseWriter, r *http.Request) {
	// Upgrade HTTP connection to WebSocket
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("WebSocket upgrade failed:", err)
		return
	}
	defer conn.Close()

	// Create player with unique ID
	playerID := uuid.New().String()
	// Buffer size 256: Allows burst messages while preventing memory exhaustion.
	// If buffer fills (slow/unresponsive client), messages are dropped with log warning.
	sendChan := make(chan []byte, 256)
	player := &game.Player{
		ID:       playerID,
		SendChan: sendChan,
	}

	log.Printf("Client connected: %s", playerID)

	// Add player to room manager
	h.roomManager.AddPlayer(player)

	// Add player to game server
	h.gameServer.AddPlayer(playerID)

	// Start goroutine to send messages to client
	done := make(chan struct{})
	go func() {
		defer close(done)
		for msg := range sendChan {
			if err := conn.WriteMessage(websocket.TextMessage, msg); err != nil {
				log.Printf("Write error for %s: %v", playerID, err)
				return
			}
		}
	}()

	// Message handling loop
	for {
		// Read message from client
		_, messageBytes, err := conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket error: %v", err)
			} else {
				log.Printf("Client disconnected: %s", playerID)
			}
			break
		}

		// Parse JSON message
		var msg Message
		if err := json.Unmarshal(messageBytes, &msg); err != nil {
			log.Printf("Failed to parse message: %v", err)
			continue
		}

		log.Printf("Received from %s: type=%s, timestamp=%d", playerID, msg.Type, msg.Timestamp)

		// Handle different message types
		switch msg.Type {
		case "input:state":
			// Handle player input
			h.handleInputState(playerID, msg.Data)

		case "player:shoot":
			// Handle player shooting
			h.handlePlayerShoot(playerID, msg.Data)

		case "player:reload":
			// Handle player reloading
			h.handlePlayerReload(playerID)

		default:
			// Broadcast other messages to room (for backward compatibility with tests)
			room := h.roomManager.GetRoomByPlayerID(playerID)
			if room != nil {
				room.Broadcast(messageBytes, playerID)
			}
		}
	}

	// Clean up on disconnect
	h.roomManager.RemovePlayer(playerID)
	h.gameServer.RemovePlayer(playerID)
	close(sendChan)
	<-done // Wait for send goroutine to finish

	log.Printf("Connection closed: %s", playerID)
}

// handleInputState processes player input state updates
func (h *WebSocketHandler) handleInputState(playerID string, data any) {
	// Convert data to InputState
	dataMap, ok := data.(map[string]interface{})
	if !ok {
		log.Printf("Invalid input:state data format from %s", playerID)
		return
	}

	input := game.InputState{
		Up:       getBool(dataMap, "up"),
		Down:     getBool(dataMap, "down"),
		Left:     getBool(dataMap, "left"),
		Right:    getBool(dataMap, "right"),
		AimAngle: getFloat64(dataMap, "aimAngle"),
	}

	// Update game server with input
	success := h.gameServer.UpdatePlayerInput(playerID, input)
	if !success {
		log.Printf("Failed to update input for player %s", playerID)
	}
}

// getBool safely extracts a boolean value from a map
func getBool(m map[string]interface{}, key string) bool {
	val, ok := m[key]
	if !ok {
		return false
	}
	boolVal, ok := val.(bool)
	if !ok {
		return false
	}
	return boolVal
}

// getFloat64 safely extracts a float64 value from a map
func getFloat64(m map[string]interface{}, key string) float64 {
	val, ok := m[key]
	if !ok {
		return 0
	}
	floatVal, ok := val.(float64)
	if !ok {
		return 0
	}
	return floatVal
}

// HandleWebSocket is the legacy function for backward compatibility
// It uses a shared global handler to ensure all connections share the same room state
func HandleWebSocket(w http.ResponseWriter, r *http.Request) {
	globalHandler.HandleWebSocket(w, r)
}

// handlePlayerShoot processes player shoot messages
func (h *WebSocketHandler) handlePlayerShoot(playerID string, data any) {
	// Convert data to get aim angle
	dataMap, ok := data.(map[string]interface{})
	if !ok {
		log.Printf("Invalid player:shoot data format from %s", playerID)
		return
	}

	aimAngle := getFloat64(dataMap, "aimAngle")

	// Attempt to shoot
	result := h.gameServer.PlayerShoot(playerID, aimAngle)

	if result.Success {
		// Broadcast projectile spawn to all players
		h.broadcastProjectileSpawn(result.Projectile)

		// Send weapon state update to the shooter
		h.sendWeaponState(playerID)
	} else {
		// Send failure reason to player (for empty click sound, etc.)
		h.sendShootFailed(playerID, result.Reason)
	}
}

// handlePlayerReload processes player reload messages
func (h *WebSocketHandler) handlePlayerReload(playerID string) {
	success := h.gameServer.PlayerReload(playerID)

	if success {
		// Send weapon state update to the player
		h.sendWeaponState(playerID)
	}
}

// broadcastProjectileSpawn sends projectile spawn event to all clients
func (h *WebSocketHandler) broadcastProjectileSpawn(proj *game.Projectile) {
	message := Message{
		Type:      "projectile:spawn",
		Timestamp: 0,
		Data: map[string]interface{}{
			"id":       proj.ID,
			"ownerId":  proj.OwnerID,
			"position": proj.Position,
			"velocity": proj.Velocity,
		},
	}

	msgBytes, err := json.Marshal(message)
	if err != nil {
		log.Printf("Error marshaling projectile:spawn message: %v", err)
		return
	}

	// Broadcast to all rooms and waiting players
	h.roomManager.BroadcastToAll(msgBytes)
}

// sendWeaponState sends weapon state update to a specific player
func (h *WebSocketHandler) sendWeaponState(playerID string) {
	ws := h.gameServer.GetWeaponState(playerID)
	if ws == nil {
		return
	}

	current, max := ws.GetAmmoInfo()
	message := Message{
		Type:      "weapon:state",
		Timestamp: 0,
		Data: map[string]interface{}{
			"currentAmmo": current,
			"maxAmmo":     max,
			"isReloading": ws.IsReloading,
			"canShoot":    ws.CanShoot(),
		},
	}

	msgBytes, err := json.Marshal(message)
	if err != nil {
		log.Printf("Error marshaling weapon:state message: %v", err)
		return
	}

	// Send to the specific player
	room := h.roomManager.GetRoomByPlayerID(playerID)
	if room != nil {
		player := room.GetPlayer(playerID)
		if player != nil {
			select {
			case player.SendChan <- msgBytes:
			default:
				log.Printf("Failed to send weapon:state to player %s (channel full)", playerID)
			}
		}
	} else {
		h.roomManager.SendToWaitingPlayer(playerID, msgBytes)
	}
}

// sendShootFailed sends a shoot failure message to the player
func (h *WebSocketHandler) sendShootFailed(playerID string, reason string) {
	message := Message{
		Type:      "shoot:failed",
		Timestamp: 0,
		Data: map[string]interface{}{
			"reason": reason,
		},
	}

	msgBytes, err := json.Marshal(message)
	if err != nil {
		log.Printf("Error marshaling shoot:failed message: %v", err)
		return
	}

	// Send to the specific player
	room := h.roomManager.GetRoomByPlayerID(playerID)
	if room != nil {
		player := room.GetPlayer(playerID)
		if player != nil {
			select {
			case player.SendChan <- msgBytes:
			default:
				log.Printf("Failed to send shoot:failed to player %s (channel full)", playerID)
			}
		}
	} else {
		h.roomManager.SendToWaitingPlayer(playerID, msgBytes)
	}
}
