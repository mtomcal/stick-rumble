package network

import (
	"context"
	"encoding/json"
	"log"
	"net/http"

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
	roomManager *game.RoomManager
	gameServer  *game.GameServer
}

// NewWebSocketHandler creates a new WebSocket handler with room management
func NewWebSocketHandler() *WebSocketHandler {
	handler := &WebSocketHandler{
		roomManager: game.NewRoomManager(),
	}

	// Create game server with broadcast function
	handler.gameServer = game.NewGameServer(handler.broadcastPlayerStates)

	return handler
}

// broadcastPlayerStates sends player position updates to all players in rooms
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

	// Broadcast to all players in all rooms
	// Note: This broadcasts to all players, not just room-specific
	// For now this is fine, later we can optimize to only broadcast to players in the same room
	for i := range playerStates {
		room := h.roomManager.GetRoomByPlayerID(playerStates[i].ID)
		if room != nil {
			room.Broadcast(msgBytes, "")
		}
	}
}

// Global handler instance for the legacy function to share room state
var globalHandler = NewWebSocketHandler()

// Start starts the game server tick loop
func (h *WebSocketHandler) Start(ctx context.Context) {
	h.gameServer.Start(ctx)
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
		Up:    getBool(dataMap, "up"),
		Down:  getBool(dataMap, "down"),
		Left:  getBool(dataMap, "left"),
		Right: getBool(dataMap, "right"),
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

// HandleWebSocket is the legacy function for backward compatibility
// It uses a shared global handler to ensure all connections share the same room state
func HandleWebSocket(w http.ResponseWriter, r *http.Request) {
	globalHandler.HandleWebSocket(w, r)
}
