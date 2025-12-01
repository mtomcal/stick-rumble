package network

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	"github.com/stretchr/testify/assert"
)

func TestWebSocketUpgrade(t *testing.T) {
	// Create test server
	server := httptest.NewServer(http.HandlerFunc(HandleWebSocket))
	defer server.Close()

	// Convert http:// to ws://
	wsURL := "ws" + strings.TrimPrefix(server.URL, "http")

	// Connect as client
	conn, resp, err := websocket.DefaultDialer.Dial(wsURL, nil)
	assert.NoError(t, err, "WebSocket upgrade should succeed")
	assert.Equal(t, http.StatusSwitchingProtocols, resp.StatusCode, "Should return 101 Switching Protocols")
	defer conn.Close()

	// Verify connection is established
	assert.NotNil(t, conn, "Connection should be established")
}

func TestMessageEcho(t *testing.T) {
	// Note: This test now verifies room-based messaging (Story 1.4)
	// Single player won't receive echo since they're not in a room yet

	// Create test server with room management
	handler := NewWebSocketHandler()
	server := httptest.NewServer(http.HandlerFunc(handler.HandleWebSocket))
	defer server.Close()

	// Convert http:// to ws://
	wsURL := "ws" + strings.TrimPrefix(server.URL, "http")

	// Connect TWO clients to create a room
	conn1, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	assert.NoError(t, err, "Should connect client 1")
	defer conn1.Close()

	conn2, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	assert.NoError(t, err, "Should connect client 2")
	defer conn2.Close()

	// Consume room:joined messages
	conn1.SetReadDeadline(time.Now().Add(2 * time.Second))
	conn1.ReadMessage()
	conn2.SetReadDeadline(time.Now().Add(2 * time.Second))
	conn2.ReadMessage()

	// Create test message from client 1
	testMsg := Message{
		Type:      "test",
		Timestamp: time.Now().UnixMilli(),
		Data:      map[string]string{"message": "Hello from test!"},
	}

	// Send message from client 1
	msgBytes, err := json.Marshal(testMsg)
	assert.NoError(t, err, "Should marshal message")

	err = conn1.WriteMessage(websocket.TextMessage, msgBytes)
	assert.NoError(t, err, "Should send message")

	// Client 2 should receive the broadcast
	conn2.SetReadDeadline(time.Now().Add(2 * time.Second))
	_, responseBytes, err := conn2.ReadMessage()
	assert.NoError(t, err, "Should receive broadcast message")

	// Parse response
	var responseMsg Message
	err = json.Unmarshal(responseBytes, &responseMsg)
	assert.NoError(t, err, "Should parse broadcast message")

	// Verify message matches original
	assert.Equal(t, testMsg.Type, responseMsg.Type, "Type should match")
	assert.Equal(t, testMsg.Timestamp, responseMsg.Timestamp, "Timestamp should match")

	// Verify data field
	responseData, ok := responseMsg.Data.(map[string]any)
	assert.True(t, ok, "Data should be a map")
	assert.Equal(t, "Hello from test!", responseData["message"], "Message content should match")
}

func TestGracefulDisconnect(t *testing.T) {
	// Create test server
	server := httptest.NewServer(http.HandlerFunc(HandleWebSocket))
	defer server.Close()

	// Convert http:// to ws://
	wsURL := "ws" + strings.TrimPrefix(server.URL, "http")

	// Connect as client
	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	assert.NoError(t, err, "Should connect successfully")

	// Close connection gracefully
	err = conn.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, "Test close"))
	assert.NoError(t, err, "Should send close message")

	// Wait a moment for server to process
	time.Sleep(100 * time.Millisecond)

	conn.Close()

	// Test passes if no panic occurred and connection closed cleanly
}

func TestInvalidJSON(t *testing.T) {
	// Create test server with room management
	handler := NewWebSocketHandler()
	server := httptest.NewServer(http.HandlerFunc(handler.HandleWebSocket))
	defer server.Close()

	// Convert http:// to ws://
	wsURL := "ws" + strings.TrimPrefix(server.URL, "http")

	// Connect TWO clients to create a room
	conn1, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	assert.NoError(t, err, "Should connect client 1")
	defer conn1.Close()

	conn2, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	assert.NoError(t, err, "Should connect client 2")
	defer conn2.Close()

	// Consume room:joined messages
	conn1.SetReadDeadline(time.Now().Add(2 * time.Second))
	conn1.ReadMessage()
	conn2.SetReadDeadline(time.Now().Add(2 * time.Second))
	conn2.ReadMessage()

	// Send invalid JSON from client 1
	err = conn1.WriteMessage(websocket.TextMessage, []byte("not valid json"))
	assert.NoError(t, err, "Should send invalid JSON")

	// Server should continue running (not crash)
	// Send a valid message to verify server is still responsive
	testMsg := Message{
		Type:      "test",
		Timestamp: time.Now().UnixMilli(),
	}
	msgBytes, _ := json.Marshal(testMsg)
	err = conn1.WriteMessage(websocket.TextMessage, msgBytes)
	assert.NoError(t, err, "Should send valid message after invalid one")

	// Client 2 should receive the valid broadcast
	conn2.SetReadDeadline(time.Now().Add(2 * time.Second))
	_, _, err = conn2.ReadMessage()
	assert.NoError(t, err, "Should receive broadcast after invalid message was sent")
}
