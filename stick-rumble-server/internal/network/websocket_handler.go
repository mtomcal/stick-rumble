package network

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/gorilla/websocket"
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
	Type      string      `json:"type"`
	Timestamp int64       `json:"timestamp"`
	Data      interface{} `json:"data,omitempty"`
}

// HandleWebSocket upgrades HTTP connection to WebSocket and manages message loop
func HandleWebSocket(w http.ResponseWriter, r *http.Request) {
	// Upgrade HTTP connection to WebSocket
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("WebSocket upgrade failed:", err)
		return
	}
	defer conn.Close()

	// Generate connection identifier and log connection
	connectionID := conn.RemoteAddr().String()
	log.Printf("Client connected: %s", connectionID)

	// Message handling loop
	for {
		// Read message from client
		messageType, messageBytes, err := conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket error: %v", err)
			} else {
				log.Printf("Client disconnected: %s", connectionID)
			}
			break
		}

		// Parse JSON message
		var msg Message
		if err := json.Unmarshal(messageBytes, &msg); err != nil {
			log.Printf("Failed to parse message: %v", err)
			continue
		}

		log.Printf("Received from %s: type=%s, timestamp=%d", connectionID, msg.Type, msg.Timestamp)

		// Echo message back to client (for testing in Story 1.3)
		if err := conn.WriteMessage(messageType, messageBytes); err != nil {
			log.Printf("Write error for %s: %v", connectionID, err)
			break
		}
	}

	log.Printf("Connection closed: %s", connectionID)
}
