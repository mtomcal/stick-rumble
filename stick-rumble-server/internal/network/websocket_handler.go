package network

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/mtomcal/stick-rumble-server/internal/config"
	"github.com/mtomcal/stick-rumble-server/internal/game"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return config.Load().AllowsOrigin(r.Header.Get("Origin"))
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
	sessionFlow       *game.RoomSessionFlow
	gameServer        *game.GameServer
	sessionRuntime    roomSessionRuntime
	timerInterval     time.Duration // Interval for match timer broadcasts (default 1s)
	validator         *SchemaValidator
	outgoingValidator *SchemaValidator
	networkSimulator  *NetworkSimulator // For artificial latency testing (Story 4.6)
	deltaTracker      *DeltaTracker     // For delta compression (Story 4.4)
}

type roomSessionRuntime interface {
	ActivatePlayers(activations []game.RoomSessionActivation)
	RemovePlayer(playerID string)
}

type gameSessionRuntime struct {
	gameServer       *game.GameServer
	sendWeaponSpawns func(playerID string)
}

func (r *gameSessionRuntime) ActivatePlayers(activations []game.RoomSessionActivation) {
	for _, activation := range activations {
		if _, exists := r.gameServer.GetPlayerState(activation.Player.ID); !exists {
			r.gameServer.AddPlayer(activation.Player.ID)
		}
		r.gameServer.SetPlayerDisplayName(activation.Player.ID, activation.Player.DisplayName)
		r.sendWeaponSpawns(activation.Player.ID)
	}
}

func (r *gameSessionRuntime) RemovePlayer(playerID string) {
	r.gameServer.RemovePlayer(playerID)
}

const (
	pingInterval   = 2 * time.Second
	pongWait       = 6 * time.Second
	staleRoomTTL   = 15 * time.Minute
	staleSweepTick = 1 * time.Minute
)

// NewWebSocketHandler creates a new WebSocket handler with room management
func NewWebSocketHandler() *WebSocketHandler {
	return NewWebSocketHandlerWithConfig(1 * time.Second)
}

// NewWebSocketHandlerWithConfig creates a WebSocket handler with custom timer interval
func NewWebSocketHandlerWithConfig(timerInterval time.Duration) *WebSocketHandler {
	// Use singleton schema loaders to avoid loading schemas multiple times
	// This prevents race conditions and reduces memory usage in tests
	schemaLoader := GetClientToServerSchemaLoader()
	outgoingSchemaLoader := GetServerToClientSchemaLoader()

	// Initialize network simulator from environment variables (Story 4.6)
	networkSimulator := NewNetworkSimulator()

	handler := &WebSocketHandler{
		roomManager:       game.NewRoomManager(),
		timerInterval:     timerInterval,
		validator:         NewSchemaValidator(schemaLoader),
		outgoingValidator: NewSchemaValidator(outgoingSchemaLoader),
		networkSimulator:  networkSimulator,
		deltaTracker:      NewDeltaTracker(),
	}

	// Create game server with broadcast function
	handler.gameServer = game.NewGameServer(handler.broadcastPlayerStates)
	handler.sessionFlow = handler.roomManager.SessionFlow()
	handler.sessionRuntime = &gameSessionRuntime{
		gameServer:       handler.gameServer,
		sendWeaponSpawns: handler.sendWeaponSpawns,
	}

	// Register callback for reload completion to notify clients
	handler.gameServer.SetOnReloadComplete(handler.onReloadComplete)

	// Register callback for hit events
	handler.gameServer.SetOnHit(handler.onHit)

	// Register callback for respawn events
	handler.gameServer.SetOnRespawn(handler.onRespawn)

	// Register callback for weapon respawn events
	handler.gameServer.SetOnWeaponRespawn(handler.onWeaponRespawn)

	// Register callback for dodge roll end events
	handler.gameServer.SetOnRollEnd(handler.broadcastRollEnd)

	// Register callback to get player RTT for lag compensation (Story 4.5)
	handler.gameServer.SetGetRTT(handler.getPlayerRTT)

	return handler
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

// Global handler instance for the legacy function to share room state
// Uses lazy initialization to prevent schema loading at package init time
var (
	globalHandler     *WebSocketHandler
	globalHandlerOnce sync.Once
)

// getGlobalHandler returns the singleton global handler instance
func getGlobalHandler() *WebSocketHandler {
	globalHandlerOnce.Do(func() {
		globalHandler = NewWebSocketHandler()
	})
	return globalHandler
}

// resetGlobalHandler resets the global handler (for testing only)
func resetGlobalHandler() {
	globalHandler = nil
	globalHandlerOnce = sync.Once{}
}

// Start starts the game server tick loop and match timer broadcasts
func (h *WebSocketHandler) Start(ctx context.Context) {
	h.gameServer.Start(ctx)
	go h.matchTimerLoop(ctx)
	go h.staleRoomSweepLoop(ctx)
}

// Stop stops the game server
func (h *WebSocketHandler) Stop() {
	h.gameServer.Stop()
}

// StartGlobalHandler starts the global handler's game server
func StartGlobalHandler(ctx context.Context) {
	getGlobalHandler().Start(ctx)
}

// StopGlobalHandler stops the global handler's game server
func StopGlobalHandler() {
	getGlobalHandler().Stop()
}

// validateOutgoingMessage validates outgoing server→client messages against JSON schemas
// Only validates when ENABLE_SCHEMA_VALIDATION environment variable is set to "true"
// Returns nil if validation passes or is disabled, error if validation fails
func (h *WebSocketHandler) validateOutgoingMessage(messageType string, data interface{}) (err error) {
	// Check if schema validation is enabled (development mode only)
	if !config.Load().EnableSchemaValidation {
		return nil // Skip validation in production
	}

	// Recover from any panics in the validator library (e.g., NaN values)
	defer func() {
		if r := recover(); r != nil {
			log.Printf("Schema validator panicked for %s: %v", messageType, r)
			err = fmt.Errorf("validator panic: %v", r)
		}
	}()

	// Map message type to schema name (message:type_subtype → message-type-subtype-data)
	// Server-to-client schemas follow the pattern: {message-type}-data.json
	// Replace colons and underscores with hyphens to match filename convention
	schemaName := strings.ReplaceAll(messageType, ":", "-")
	schemaName = strings.ReplaceAll(schemaName, "_", "-")
	schemaName = schemaName + "-data"

	// Validate the data against the schema
	err = h.outgoingValidator.Validate(schemaName, data)
	if err != nil {
		log.Printf("Outgoing message validation failed for %s: %v", messageType, err)
		return err
	}

	return nil
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
	player := game.NewPlayer(playerID, sendChan)

	log.Printf("Client connected: %s", playerID)
	_ = conn.SetReadDeadline(time.Now().Add(pongWait))

	// Setup ping/pong for RTT measurement (Story 4.5: Lag compensation)
	var pingMu sync.Mutex
	var lastPingTime time.Time

	conn.SetPongHandler(func(appData string) error {
		pingMu.Lock()
		defer pingMu.Unlock()

		// Calculate RTT and record it
		if !lastPingTime.IsZero() {
			rtt := time.Since(lastPingTime)
			player.PingTracker.RecordRTT(rtt)
			log.Printf("Player %s RTT: %dms (avg: %dms)", playerID, rtt.Milliseconds(), player.PingTracker.GetRTT())
		}
		_ = conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	// Start goroutine to send periodic pings for RTT measurement
	pingDone := make(chan struct{})
	go func() {
		ticker := time.NewTicker(pingInterval)
		defer ticker.Stop()

		for {
			select {
			case <-pingDone:
				return
			case <-ticker.C:
				pingMu.Lock()
				lastPingTime = time.Now()
				pingMu.Unlock()

				if err := conn.WriteControl(websocket.PingMessage, []byte{}, time.Now().Add(1*time.Second)); err != nil {
					log.Printf("Ping error for %s: %v", playerID, err)
					return
				}
			}
		}
	}()

	// Start goroutine to send messages to client
	done := make(chan struct{})
	go func() {
		defer close(done)
		for msg := range sendChan {
			// Capture msg for closure (Story 4.6: Network simulator)
			msgToSend := msg
			if h.networkSimulator.IsEnabled() {
				h.networkSimulator.SimulateSend(func() {
					if err := conn.WriteMessage(websocket.TextMessage, msgToSend); err != nil {
						log.Printf("Write error for %s: %v", playerID, err)
					}
				})
			} else {
				if err := conn.WriteMessage(websocket.TextMessage, msgToSend); err != nil {
					log.Printf("Write error for %s: %v", playerID, err)
					return
				}
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

		if msg.Type == "player:hello" {
			h.handlePlayerHello(player, msg.Data)
			continue
		}

		if !player.HelloSeen {
			h.sendNoHelloError(player, msg.Type)
			continue
		}

		// Handle different message types
		switch msg.Type {
		case "session:leave":
			h.handleSessionLeave(player)

		case "input:state":
			// Handle player input
			h.handleInputState(playerID, msg.Data)

		case "player:shoot":
			// Handle player shooting
			h.handlePlayerShoot(playerID, msg.Data)

		case "player:reload":
			// Handle player reloading
			h.handlePlayerReload(playerID)

		case "weapon:pickup_attempt":
			// Handle weapon pickup
			h.handleWeaponPickup(playerID, msg.Data)

		case "player:dodge_roll":
			// Handle player dodge roll
			h.handlePlayerDodgeRoll(playerID)

		case "player:melee_attack":
			// Handle player melee attack
			h.handlePlayerMeleeAttack(playerID, msg.Data)

		default:
			// Broadcast other messages to room (for backward compatibility with tests)
			room := h.roomManager.GetRoomByPlayerID(playerID)
			if room != nil {
				room.Broadcast(messageBytes, playerID)
			}
		}
	}

	// Clean up on disconnect
	close(pingDone) // Stop ping goroutine
	h.roomManager.RemovePlayer(playerID)
	if player.HelloSeen {
		h.gameServer.RemovePlayer(playerID)
	}
	h.deltaTracker.RemoveClient(playerID) // Clean up delta compression state
	close(sendChan)
	<-done // Wait for send goroutine to finish

	log.Printf("Connection closed: %s", playerID)
}

// HandleWebSocket is the legacy function for backward compatibility
// It uses a shared global handler to ensure all connections share the same room state
func HandleWebSocket(w http.ResponseWriter, r *http.Request) {
	getGlobalHandler().HandleWebSocket(w, r)
}

func (h *WebSocketHandler) handlePlayerHello(player *game.Player, data any) {
	if player.HelloSeen {
		return
	}

	dataMap, ok := data.(map[string]any)
	if !ok {
		log.Printf("Invalid player:hello payload for %s", player.ID)
		return
	}

	result := h.sessionFlow.HandleHello(player, dataMap)
	if result.Rejection != nil {
		switch result.Rejection.Kind {
		case game.RoomSessionRejectionBadRoomCode:
			h.sendBadRoomCodeError(player, result.Rejection.Reason)
		case game.RoomSessionRejectionRoomFull:
			h.sendRoomFullError(player, result.Rejection.Code)
		default:
			log.Printf("Invalid player:hello mode for %s", player.ID)
		}
		return
	}

	player.HelloSeen = true
	h.roomManager.PublishSessionPublications(result.Publications)
	if len(result.Activations) > 0 {
		h.sessionRuntime.ActivatePlayers(result.Activations)
	}
}

func (h *WebSocketHandler) handleSessionLeave(player *game.Player) {
	if !player.HelloSeen {
		return
	}

	result := h.sessionFlow.LeaveSession(player.ID)
	if !result.LeftSession {
		return
	}
	h.roomManager.PublishSessionPublications(result.Publications)
	h.sessionRuntime.RemovePlayer(player.ID)
	h.deltaTracker.RemoveClient(player.ID)
	player.HelloSeen = false
	player.DisplayName = game.FallbackDisplayName
}

func (h *WebSocketHandler) staleRoomSweepLoop(ctx context.Context) {
	ticker := time.NewTicker(staleSweepTick)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			h.reapStaleRooms()
		}
	}
}

func (h *WebSocketHandler) reapStaleRooms() {
	now := time.Now()
	for _, room := range h.roomManager.GetAllRooms() {
		if room.Kind != game.RoomKindCode || room.Match.IsStarted() || !room.IsEmpty() || room.EmptySince == nil {
			continue
		}
		if now.Sub(*room.EmptySince) < staleRoomTTL {
			continue
		}
		h.roomManager.RemoveRoomIfIdle(room.ID)
	}
}
