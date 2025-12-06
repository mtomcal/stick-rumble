package network

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	"github.com/stretchr/testify/assert"
)

// testServer wraps an httptest.Server for WebSocket testing
type testServer struct {
	*httptest.Server
	handler *WebSocketHandler
}

// newTestServer creates a test server with the default WebSocket handler
func newTestServer() *testServer {
	handler := NewWebSocketHandler()
	server := httptest.NewServer(http.HandlerFunc(handler.HandleWebSocket))
	return &testServer{
		Server:  server,
		handler: handler,
	}
}

// newTestServerWithConfig creates a test server with a custom timer interval
func newTestServerWithConfig(timerInterval time.Duration) *testServer {
	handler := NewWebSocketHandlerWithConfig(timerInterval)
	server := httptest.NewServer(http.HandlerFunc(handler.HandleWebSocket))
	return &testServer{
		Server:  server,
		handler: handler,
	}
}

// wsURL returns the WebSocket URL for the test server
func (ts *testServer) wsURL() string {
	return "ws" + strings.TrimPrefix(ts.URL, "http")
}

// connectClient establishes a WebSocket connection to the test server
func (ts *testServer) connectClient(t *testing.T) *websocket.Conn {
	conn, _, err := websocket.DefaultDialer.Dial(ts.wsURL(), nil)
	assert.NoError(t, err, "Should connect to test server")
	return conn
}

// connectTwoClients connects two clients (creates a room)
func (ts *testServer) connectTwoClients(t *testing.T) (*websocket.Conn, *websocket.Conn) {
	conn1 := ts.connectClient(t)
	conn2 := ts.connectClient(t)
	return conn1, conn2
}

// consumeRoomJoined reads and discards the room:joined message from a connection
func consumeRoomJoined(t *testing.T, conn *websocket.Conn) {
	conn.SetReadDeadline(time.Now().Add(2 * time.Second))
	conn.ReadMessage()
}

// consumeRoomJoinedAndGetPlayerID reads room:joined and returns the player ID
func consumeRoomJoinedAndGetPlayerID(t *testing.T, conn *websocket.Conn) string {
	conn.SetReadDeadline(time.Now().Add(2 * time.Second))
	_, joinedBytes, err := conn.ReadMessage()
	assert.NoError(t, err, "Should receive room:joined message")

	var joinedMsg Message
	err = json.Unmarshal(joinedBytes, &joinedMsg)
	assert.NoError(t, err, "Should parse room:joined message")

	joinedData := joinedMsg.Data.(map[string]interface{})
	return joinedData["playerId"].(string)
}

// readMessageOfType reads messages from a WebSocket connection until it finds
// one with the specified type, or times out. This helper handles the fact that
// multiple message types (player:move, match:timer, etc.) may be interleaved.
func readMessageOfType(t *testing.T, conn *websocket.Conn, msgType string, timeout time.Duration) (*Message, error) {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		conn.SetReadDeadline(time.Now().Add(500 * time.Millisecond))
		_, msgBytes, err := conn.ReadMessage()
		if err != nil {
			// Check if it's a close error or repeated read failure
			if websocket.IsCloseError(err, websocket.CloseNormalClosure, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				return nil, err
			}
			// Check for timeout (keep trying) vs other errors (return)
			if netErr, ok := err.(interface{ Timeout() bool }); ok && netErr.Timeout() {
				continue
			}
			// Other errors - return
			return nil, err
		}

		var msg Message
		if err := json.Unmarshal(msgBytes, &msg); err != nil {
			continue
		}

		if msg.Type == msgType {
			return &msg, nil
		}
	}
	return nil, fmt.Errorf("timeout waiting for message type %q", msgType)
}

// sendMessage sends a Message over a WebSocket connection
func sendMessage(t *testing.T, conn *websocket.Conn, msg Message) {
	msgBytes, err := json.Marshal(msg)
	assert.NoError(t, err, "Should marshal message")
	err = conn.WriteMessage(websocket.TextMessage, msgBytes)
	assert.NoError(t, err, "Should send message")
}

// sendInputState sends an input:state message
func sendInputState(t *testing.T, conn *websocket.Conn, up, down, left, right bool) {
	msg := Message{
		Type:      "input:state",
		Timestamp: time.Now().UnixMilli(),
		Data: map[string]interface{}{
			"up":    up,
			"down":  down,
			"left":  left,
			"right": right,
		},
	}
	sendMessage(t, conn, msg)
}

// sendShootMessage sends a player:shoot message
func sendShootMessage(t *testing.T, conn *websocket.Conn, aimAngle float64) {
	msg := Message{
		Type:      "player:shoot",
		Timestamp: time.Now().UnixMilli(),
		Data: map[string]interface{}{
			"aimAngle": aimAngle,
		},
	}
	sendMessage(t, conn, msg)
}

// sendReloadMessage sends a player:reload message
func sendReloadMessage(t *testing.T, conn *websocket.Conn) {
	msg := Message{
		Type:      "player:reload",
		Timestamp: time.Now().UnixMilli(),
	}
	sendMessage(t, conn, msg)
}
