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
	// Create test server
	server := httptest.NewServer(http.HandlerFunc(HandleWebSocket))
	defer server.Close()

	// Convert http:// to ws://
	wsURL := "ws" + strings.TrimPrefix(server.URL, "http")

	// Connect as client
	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	assert.NoError(t, err, "Should connect successfully")
	defer conn.Close()

	// Create test message
	testMsg := Message{
		Type:      "test",
		Timestamp: time.Now().UnixMilli(),
		Data:      map[string]string{"message": "Hello from test!"},
	}

	// Send message
	msgBytes, err := json.Marshal(testMsg)
	assert.NoError(t, err, "Should marshal message")

	err = conn.WriteMessage(websocket.TextMessage, msgBytes)
	assert.NoError(t, err, "Should send message")

	// Read echo response
	_, responseBytes, err := conn.ReadMessage()
	assert.NoError(t, err, "Should receive echo response")

	// Parse response
	var responseMsg Message
	err = json.Unmarshal(responseBytes, &responseMsg)
	assert.NoError(t, err, "Should parse echo response")

	// Verify echo matches original
	assert.Equal(t, testMsg.Type, responseMsg.Type, "Type should match")
	assert.Equal(t, testMsg.Timestamp, responseMsg.Timestamp, "Timestamp should match")

	// Verify data field
	responseData, ok := responseMsg.Data.(map[string]interface{})
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
	// Create test server
	server := httptest.NewServer(http.HandlerFunc(HandleWebSocket))
	defer server.Close()

	// Convert http:// to ws://
	wsURL := "ws" + strings.TrimPrefix(server.URL, "http")

	// Connect as client
	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	assert.NoError(t, err, "Should connect successfully")
	defer conn.Close()

	// Send invalid JSON
	err = conn.WriteMessage(websocket.TextMessage, []byte("not valid json"))
	assert.NoError(t, err, "Should send invalid JSON")

	// Server should continue running (not crash)
	// Send a valid message to verify server is still responsive
	testMsg := Message{
		Type:      "test",
		Timestamp: time.Now().UnixMilli(),
	}
	msgBytes, _ := json.Marshal(testMsg)
	err = conn.WriteMessage(websocket.TextMessage, msgBytes)
	assert.NoError(t, err, "Should send valid message after invalid one")

	// Read response
	_, _, err = conn.ReadMessage()
	assert.NoError(t, err, "Should still receive echo after invalid message")
}
