package network

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
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
	gameServer        *game.GameServer
	timerInterval     time.Duration // Interval for match timer broadcasts (default 1s)
	validator         *SchemaValidator
	outgoingValidator *SchemaValidator
	outgoingMessages  *outgoingMessageBuilder
	networkSimulator  *NetworkSimulator // For artificial latency testing (Story 4.6)
	deltaTracker      *DeltaTracker     // For delta compression (Story 4.4)
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
	handler.outgoingMessages = newOutgoingMessageBuilder(handler.outgoingValidator, time.Now)

	// Create game server with broadcast function
	handler.gameServer = game.NewGameServer(handler.broadcastPlayerStates)

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
	return h.outgoingMessages.Validate(messageType, data)
}

func (h *WebSocketHandler) buildOutgoingMessage(messageType string, data interface{}) ([]byte, error) {
	return h.outgoingMessages.Build(messageType, data)
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

	player.DisplayName = game.FallbackDisplayName
	if rawDisplayName, exists := dataMap["displayName"]; exists {
		player.DisplayName = game.SanitizeDisplayName(rawDisplayName)
	}

	mode, _ := dataMap["mode"].(string)
	var room *game.Room
	switch mode {
	case "public":
		room = h.roomManager.AddPublicPlayer(player)
	case "code":
		code, reason, normalized := game.NormalizeRoomCode(dataMap["code"])
		if !normalized {
			h.sendBadRoomCodeError(player, string(reason))
			return
		}
		var joined bool
		room, joined = h.roomManager.AddCodePlayer(player, code)
		if !joined {
			h.sendRoomFullError(player, code)
			return
		}
	default:
		log.Printf("Invalid player:hello mode for %s: %v", player.ID, mode)
		return
	}

	player.HelloSeen = true

	if room == nil {
		return
	}

	for _, p := range room.GetPlayers() {
		if _, exists := h.gameServer.GetPlayerState(p.ID); !exists {
			h.gameServer.AddPlayer(p.ID)
		}
		h.gameServer.SetPlayerDisplayName(p.ID, p.DisplayName)
	}
	for _, p := range room.GetPlayers() {
		h.sendWeaponSpawns(p.ID)
	}
}

func (h *WebSocketHandler) handleSessionLeave(player *game.Player) {
	if !player.HelloSeen {
		return
	}

	if !h.roomManager.LeaveSession(player.ID) {
		return
	}

	h.gameServer.RemovePlayer(player.ID)
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
