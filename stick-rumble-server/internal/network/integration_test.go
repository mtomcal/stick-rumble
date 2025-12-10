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
	"github.com/stretchr/testify/require"
)

// TestTwoClientRoomCreation tests that 2 clients auto-create a room
func TestTwoClientRoomCreation(t *testing.T) {
	// Create test server with room management
	handler := NewWebSocketHandler()
	server := httptest.NewServer(http.HandlerFunc(handler.HandleWebSocket))
	defer server.Close()

	// Convert http:// to ws://
	wsURL := "ws" + strings.TrimPrefix(server.URL, "http")

	// Connect first client
	conn1, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	require.NoError(t, err, "Client 1 should connect")
	defer conn1.Close()

	// Connect second client
	conn2, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	require.NoError(t, err, "Client 2 should connect")
	defer conn2.Close()

	// Both clients should receive room:joined messages
	var msg1, msg2 Message

	// Read client 1's room:joined message
	err = conn1.SetReadDeadline(time.Now().Add(2 * time.Second))
	require.NoError(t, err)
	_, msgBytes1, err := conn1.ReadMessage()
	require.NoError(t, err, "Client 1 should receive room:joined")
	err = json.Unmarshal(msgBytes1, &msg1)
	require.NoError(t, err)

	// Read client 2's room:joined message
	err = conn2.SetReadDeadline(time.Now().Add(2 * time.Second))
	require.NoError(t, err)
	_, msgBytes2, err := conn2.ReadMessage()
	require.NoError(t, err, "Client 2 should receive room:joined")
	err = json.Unmarshal(msgBytes2, &msg2)
	require.NoError(t, err)

	// Verify both messages are room:joined
	assert.Equal(t, "room:joined", msg1.Type)
	assert.Equal(t, "room:joined", msg2.Type)

	// Extract room and player IDs
	data1, ok := msg1.Data.(map[string]interface{})
	require.True(t, ok, "Message 1 data should be a map")
	data2, ok := msg2.Data.(map[string]interface{})
	require.True(t, ok, "Message 2 data should be a map")

	roomID1, ok := data1["roomId"].(string)
	require.True(t, ok, "roomId should be a string")
	roomID2, ok := data2["roomId"].(string)
	require.True(t, ok, "roomId should be a string")

	// Both players should be in the same room
	assert.Equal(t, roomID1, roomID2, "Both players should be in the same room")

	// Player IDs should be present
	playerID1, ok := data1["playerId"].(string)
	require.True(t, ok, "playerId should be present")
	playerID2, ok := data2["playerId"].(string)
	require.True(t, ok, "playerId should be present")

	assert.NotEmpty(t, playerID1)
	assert.NotEmpty(t, playerID2)
	assert.NotEqual(t, playerID1, playerID2, "Players should have different IDs")
}

// TestMessageBroadcast tests that messages are broadcast between players
func TestMessageBroadcast(t *testing.T) {
	// Create test server with room management
	handler := NewWebSocketHandler()
	server := httptest.NewServer(http.HandlerFunc(handler.HandleWebSocket))
	defer server.Close()

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http")

	// Connect two clients
	conn1, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	require.NoError(t, err)
	defer conn1.Close()

	conn2, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	require.NoError(t, err)
	defer conn2.Close()

	// Consume room:joined and weapon:spawned messages
	conn1.SetReadDeadline(time.Now().Add(2 * time.Second))
	conn1.ReadMessage() // room:joined
	conn1.SetReadDeadline(time.Now().Add(2 * time.Second))
	conn1.ReadMessage() // weapon:spawned
	conn2.SetReadDeadline(time.Now().Add(2 * time.Second))
	conn2.ReadMessage() // room:joined
	conn2.SetReadDeadline(time.Now().Add(2 * time.Second))
	conn2.ReadMessage() // weapon:spawned

	// Client 1 sends a test message
	testMsg := Message{
		Type:      "test",
		Timestamp: time.Now().UnixMilli(),
		Data:      map[string]string{"content": "hello"},
	}
	msgBytes, err := json.Marshal(testMsg)
	require.NoError(t, err)

	err = conn1.WriteMessage(websocket.TextMessage, msgBytes)
	require.NoError(t, err)

	// Client 2 should receive the message
	conn2.SetReadDeadline(time.Now().Add(2 * time.Second))
	_, receivedBytes, err := conn2.ReadMessage()
	require.NoError(t, err, "Client 2 should receive broadcast message")

	var receivedMsg Message
	err = json.Unmarshal(receivedBytes, &receivedMsg)
	require.NoError(t, err)

	assert.Equal(t, "test", receivedMsg.Type)
	receivedData, ok := receivedMsg.Data.(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, "hello", receivedData["content"])
}

// TestPlayerDisconnection tests that player:left is broadcast on disconnect
func TestPlayerDisconnection(t *testing.T) {
	// Create test server
	handler := NewWebSocketHandler()
	server := httptest.NewServer(http.HandlerFunc(handler.HandleWebSocket))
	defer server.Close()

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http")

	// Connect two clients
	conn1, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	require.NoError(t, err)
	defer conn1.Close()

	conn2, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	require.NoError(t, err)

	// Consume room:joined messages
	conn1.SetReadDeadline(time.Now().Add(2 * time.Second))
	_, msgBytes1, _ := conn1.ReadMessage() //room:joined
	conn2.SetReadDeadline(time.Now().Add(2 * time.Second))
	conn2.ReadMessage() // room:joined

	// Extract player1's ID from room:joined message
	var joinMsg Message
	err = json.Unmarshal(msgBytes1, &joinMsg)
	require.NoError(t, err, "Should unmarshal player1's join message")
	joinData := joinMsg.Data.(map[string]interface{})
	player1ID := joinData["playerId"].(string)

	// Consume weapon:spawned messages
	conn1.SetReadDeadline(time.Now().Add(2 * time.Second))
	conn1.ReadMessage() // weapon:spawned
	conn2.SetReadDeadline(time.Now().Add(2 * time.Second))
	conn2.ReadMessage() // weapon:spawned

	// Client 1 disconnects
	conn1.Close()

	// Client 2 should receive player:left message
	conn2.SetReadDeadline(time.Now().Add(2 * time.Second))
	_, leftBytes, err := conn2.ReadMessage()
	require.NoError(t, err, "Client 2 should receive player:left message")

	var leftMsg Message
	err = json.Unmarshal(leftBytes, &leftMsg)
	require.NoError(t, err)

	assert.Equal(t, "player:left", leftMsg.Type)
	leftData, ok := leftMsg.Data.(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, player1ID, leftData["playerId"])
}

// TestBidirectionalBroadcast tests both players can send messages
func TestBidirectionalBroadcast(t *testing.T) {
	// Create test server
	handler := NewWebSocketHandler()
	server := httptest.NewServer(http.HandlerFunc(handler.HandleWebSocket))
	defer server.Close()

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http")

	// Connect two clients
	conn1, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	require.NoError(t, err)
	defer conn1.Close()

	conn2, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	require.NoError(t, err)
	defer conn2.Close()

	// Consume room:joined and weapon:spawned messages
	conn1.SetReadDeadline(time.Now().Add(2 * time.Second))
	conn1.ReadMessage() // room:joined
	conn1.SetReadDeadline(time.Now().Add(2 * time.Second))
	conn1.ReadMessage() // weapon:spawned
	conn2.SetReadDeadline(time.Now().Add(2 * time.Second))
	conn2.ReadMessage() // room:joined
	conn2.SetReadDeadline(time.Now().Add(2 * time.Second))
	conn2.ReadMessage() // weapon:spawned

	// Player 1 sends "hello"
	msg1 := Message{Type: "test", Timestamp: time.Now().UnixMilli(), Data: "hello"}
	bytes1, _ := json.Marshal(msg1)
	conn1.WriteMessage(websocket.TextMessage, bytes1)

	// Player 2 receives "hello"
	conn2.SetReadDeadline(time.Now().Add(2 * time.Second))
	_, received1, err := conn2.ReadMessage()
	require.NoError(t, err)
	var receivedMsg1 Message
	err = json.Unmarshal(received1, &receivedMsg1)
	require.NoError(t, err, "Should unmarshal message from player 1")
	assert.Equal(t, "hello", receivedMsg1.Data)

	// Player 2 sends "world"
	msg2 := Message{Type: "test", Timestamp: time.Now().UnixMilli(), Data: "world"}
	bytes2, _ := json.Marshal(msg2)
	conn2.WriteMessage(websocket.TextMessage, bytes2)

	// Player 1 receives "world"
	conn1.SetReadDeadline(time.Now().Add(2 * time.Second))
	_, received2, err := conn1.ReadMessage()
	require.NoError(t, err)
	var receivedMsg2 Message
	err = json.Unmarshal(received2, &receivedMsg2)
	require.NoError(t, err, "Should unmarshal message from player 2")
	assert.Equal(t, "world", receivedMsg2.Data)
}
