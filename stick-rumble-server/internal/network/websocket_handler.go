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
	roomManager   *game.RoomManager
	gameServer    *game.GameServer
	timerInterval time.Duration // Interval for match timer broadcasts (default 1s)
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

	// Register callback for weapon respawn events
	handler.gameServer.SetOnWeaponRespawn(handler.onWeaponRespawn)

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

		case "weapon:pickup_attempt":
			// Handle weapon pickup
			h.handleWeaponPickup(playerID, msg.Data)

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

// HandleWebSocket is the legacy function for backward compatibility
// It uses a shared global handler to ensure all connections share the same room state
func HandleWebSocket(w http.ResponseWriter, r *http.Request) {
	globalHandler.HandleWebSocket(w, r)
}
