package network

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	"github.com/mtomcal/stick-rumble-server/internal/game"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ==========================
// Test Helpers
// ==========================

// testServer wraps an httptest.Server for WebSocket testing
type testServer struct {
	*httptest.Server
	handler *WebSocketHandler
	ctx     context.Context
	cancel  context.CancelFunc
}

// newTestServer creates a test server with the default WebSocket handler
func newTestServer() *testServer {
	handler := NewWebSocketHandler()
	server := httptest.NewServer(http.HandlerFunc(handler.HandleWebSocket))
	ctx, cancel := context.WithCancel(context.Background())
	handler.Start(ctx)
	return &testServer{
		Server:  server,
		handler: handler,
		ctx:     ctx,
		cancel:  cancel,
	}
}

// newTestServerWithConfig creates a test server with a custom timer interval
func newTestServerWithConfig(timerInterval time.Duration) *testServer {
	handler := NewWebSocketHandlerWithConfig(timerInterval)
	server := httptest.NewServer(http.HandlerFunc(handler.HandleWebSocket))
	ctx, cancel := context.WithCancel(context.Background())
	handler.Start(ctx)
	return &testServer{
		Server:  server,
		handler: handler,
		ctx:     ctx,
		cancel:  cancel,
	}
}

// Close closes the test server and stops the game server
func (ts *testServer) Close() {
	ts.cancel()
	ts.handler.Stop()
	ts.Server.Close()
}

// wsURL returns the WebSocket URL for the test server
func (ts *testServer) wsURL() string {
	return "ws" + strings.TrimPrefix(ts.URL, "http")
}

// connectClient establishes a WebSocket connection to the test server
func (ts *testServer) connectClient(t *testing.T) *websocket.Conn {
	conn, _, err := websocket.DefaultDialer.Dial(ts.wsURL(), nil)
	require.NoError(t, err, "Should connect to test server")
	return conn
}

// connectTwoClients connects two clients and returns their connections
func (ts *testServer) connectTwoClients(t *testing.T) (*websocket.Conn, *websocket.Conn) {
	conn1 := ts.connectClient(t)
	conn2 := ts.connectClient(t)
	return conn1, conn2
}

// readMessage reads a message from the WebSocket connection with timeout
func readMessage(t *testing.T, conn *websocket.Conn, timeout time.Duration) (*Message, error) {
	conn.SetReadDeadline(time.Now().Add(timeout))
	_, msgBytes, err := conn.ReadMessage()
	// Clear the deadline after reading (success or failure)
	// This prevents gorilla/websocket from marking the connection as permanently failed
	conn.SetReadDeadline(time.Time{})

	if err != nil {
		return nil, err
	}

	var msg Message
	err = json.Unmarshal(msgBytes, &msg)
	if err != nil {
		return nil, err
	}

	return &msg, nil
}

// readMessageOfType reads messages until it finds one with the specified type
func readMessageOfType(t *testing.T, conn *websocket.Conn, msgType string, timeout time.Duration) (*Message, error) {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		msg, err := readMessage(t, conn, 500*time.Millisecond)
		if err != nil {
			if netErr, ok := err.(interface{ Timeout() bool }); ok && netErr.Timeout() {
				continue
			}
			return nil, err
		}
		if msg.Type == msgType {
			return msg, nil
		}
	}
	return nil, assert.AnError
}

// sendMessage sends a Message over a WebSocket connection
func sendMessage(t *testing.T, conn *websocket.Conn, msg Message) {
	msgBytes, err := json.Marshal(msg)
	require.NoError(t, err, "Should marshal message")
	err = conn.WriteMessage(websocket.TextMessage, msgBytes)
	require.NoError(t, err, "Should send message")
}

// sendInputState sends an input:state message
func sendInputState(t *testing.T, conn *websocket.Conn, up, down, left, right bool) {
	msg := Message{
		Type:      "input:state",
		Timestamp: time.Now().UnixMilli(),
		Data: map[string]interface{}{
			"up":       up,
			"down":     down,
			"left":     left,
			"right":    right,
			"aimAngle": 0.0,
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

// consumeRoomJoinedAndGetPlayerID reads room:joined and weapon:spawned, returns player ID
func consumeRoomJoinedAndGetPlayerID(t *testing.T, conn *websocket.Conn) string {
	msg, err := readMessageOfType(t, conn, "room:joined", 2*time.Second)
	require.NoError(t, err, "Should receive room:joined message")

	data, ok := msg.Data.(map[string]interface{})
	require.True(t, ok, "Message data should be a map")
	playerID, ok := data["playerId"].(string)
	require.True(t, ok, "playerId should be a string")

	// Consume weapon:spawned message
	_, err = readMessageOfType(t, conn, "weapon:spawned", 2*time.Second)
	require.NoError(t, err, "Should receive weapon:spawned message")

	return playerID
}

// ==========================
// Connection Tests
// ==========================

func TestWebSocketConnection(t *testing.T) {
	ts := newTestServer()
	defer ts.Close()

	conn := ts.connectClient(t)
	defer conn.Close()

	// Verify connection is established
	assert.NotNil(t, conn)
}

func TestTwoClientRoomCreation(t *testing.T) {
	ts := newTestServer()
	defer ts.Close()

	conn1, conn2 := ts.connectTwoClients(t)
	defer conn1.Close()
	defer conn2.Close()

	// Read room:joined messages from both clients
	msg1, err := readMessageOfType(t, conn1, "room:joined", 2*time.Second)
	require.NoError(t, err, "Client 1 should receive room:joined")
	msg2, err := readMessageOfType(t, conn2, "room:joined", 2*time.Second)
	require.NoError(t, err, "Client 2 should receive room:joined")

	// Verify message type
	assert.Equal(t, "room:joined", msg1.Type)
	assert.Equal(t, "room:joined", msg2.Type)

	// Extract room and player IDs
	data1, ok := msg1.Data.(map[string]interface{})
	require.True(t, ok)
	data2, ok := msg2.Data.(map[string]interface{})
	require.True(t, ok)

	roomID1 := data1["roomId"].(string)
	roomID2 := data2["roomId"].(string)
	playerID1 := data1["playerId"].(string)
	playerID2 := data2["playerId"].(string)

	// Verify both players are in the same room
	assert.Equal(t, roomID1, roomID2, "Both players should be in the same room")
	assert.NotEmpty(t, playerID1)
	assert.NotEmpty(t, playerID2)
	assert.NotEqual(t, playerID1, playerID2, "Players should have different IDs")
}

func TestPlayerDisconnection(t *testing.T) {
	ts := newTestServer()
	defer ts.Close()

	conn1, conn2 := ts.connectTwoClients(t)
	defer conn2.Close()

	// Get player IDs
	player1ID := consumeRoomJoinedAndGetPlayerID(t, conn1)
	_ = consumeRoomJoinedAndGetPlayerID(t, conn2)

	// Disconnect player 1
	conn1.Close()

	// Player 2 should receive player:left message
	msg, err := readMessageOfType(t, conn2, "player:left", 2*time.Second)
	require.NoError(t, err, "Client 2 should receive player:left message")

	assert.Equal(t, "player:left", msg.Type)
	data, ok := msg.Data.(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, player1ID, data["playerId"])
}

// ==========================
// Message Routing Tests
// ==========================

func TestMessageBroadcast(t *testing.T) {
	ts := newTestServer()
	defer ts.Close()

	conn1, conn2 := ts.connectTwoClients(t)
	defer conn1.Close()
	defer conn2.Close()

	// Consume initial room:joined and weapon:spawned messages
	_ = consumeRoomJoinedAndGetPlayerID(t, conn1)
	_ = consumeRoomJoinedAndGetPlayerID(t, conn2)

	// Client 1 sends a test message
	testMsg := Message{
		Type:      "test",
		Timestamp: time.Now().UnixMilli(),
		Data:      map[string]string{"content": "hello"},
	}
	sendMessage(t, conn1, testMsg)

	// Client 2 should receive the message
	msg, err := readMessageOfType(t, conn2, "test", 2*time.Second)
	require.NoError(t, err, "Client 2 should receive broadcast message")

	assert.Equal(t, "test", msg.Type)
	data, ok := msg.Data.(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, "hello", data["content"])
}

func TestBidirectionalBroadcast(t *testing.T) {
	ts := newTestServer()
	defer ts.Close()

	conn1, conn2 := ts.connectTwoClients(t)
	defer conn1.Close()
	defer conn2.Close()

	// Consume initial messages
	_ = consumeRoomJoinedAndGetPlayerID(t, conn1)
	_ = consumeRoomJoinedAndGetPlayerID(t, conn2)

	// Player 1 sends "hello"
	msg1 := Message{Type: "test", Timestamp: time.Now().UnixMilli(), Data: "hello"}
	sendMessage(t, conn1, msg1)

	// Player 2 receives "hello"
	received1, err := readMessageOfType(t, conn2, "test", 2*time.Second)
	require.NoError(t, err)
	assert.Equal(t, "hello", received1.Data)

	// Player 2 sends "world"
	msg2 := Message{Type: "test", Timestamp: time.Now().UnixMilli(), Data: "world"}
	sendMessage(t, conn2, msg2)

	// Player 1 receives "world"
	received2, err := readMessageOfType(t, conn1, "test", 2*time.Second)
	require.NoError(t, err)
	assert.Equal(t, "world", received2.Data)
}

// ==========================
// Input Handling Tests
// ==========================

func TestInputStateProcessing(t *testing.T) {
	ts := newTestServer()
	defer ts.Close()

	conn1, conn2 := ts.connectTwoClients(t)
	defer conn1.Close()
	defer conn2.Close()

	player1ID := consumeRoomJoinedAndGetPlayerID(t, conn1)
	_ = consumeRoomJoinedAndGetPlayerID(t, conn2)

	// Send input state from player 1
	sendInputState(t, conn1, true, false, false, false) // Moving up

	// Player 2 should eventually receive player:move updates
	var foundMove bool
	for i := 0; i < 10; i++ {
		msg, err := readMessage(t, conn2, 500*time.Millisecond)
		if err != nil {
			continue
		}
		if msg.Type == "player:move" {
			foundMove = true
			data, ok := msg.Data.(map[string]interface{})
			require.True(t, ok)

			updates, ok := data["updates"].([]interface{})
			require.True(t, ok)

			// Find player1's update
			for _, update := range updates {
				updateMap := update.(map[string]interface{})
				if updateMap["playerId"] == player1ID {
					position := updateMap["position"].(map[string]interface{})
					assert.NotNil(t, position)
					assert.NotNil(t, position["x"])
					assert.NotNil(t, position["y"])
					break
				}
			}
			break
		}
	}
	assert.True(t, foundMove, "Should receive player:move update")
}

func TestInputAfterMatchEnded(t *testing.T) {
	ts := newTestServer()
	defer ts.Close()

	conn1, conn2 := ts.connectTwoClients(t)
	defer conn1.Close()
	defer conn2.Close()

	player1ID := consumeRoomJoinedAndGetPlayerID(t, conn1)
	_ = consumeRoomJoinedAndGetPlayerID(t, conn2)

	// Get the room and end the match
	room := ts.handler.roomManager.GetRoomByPlayerID(player1ID)
	require.NotNil(t, room)
	room.Match.EndMatch("test")

	// Send input state - should be ignored
	sendInputState(t, conn1, true, false, false, false)

	// Verify input was rejected (no player:move messages should be sent)
	// We wait a bit to ensure no messages are sent
	msg, err := readMessage(t, conn2, 500*time.Millisecond)
	if err == nil {
		// If we got a message, it shouldn't be player:move
		assert.NotEqual(t, "player:move", msg.Type)
	}
}

// ==========================
// Shooting Tests
// ==========================

func TestShootingBasic(t *testing.T) {
	ts := newTestServer()
	defer ts.Close()

	conn1, conn2 := ts.connectTwoClients(t)
	defer conn1.Close()
	defer conn2.Close()

	_ = consumeRoomJoinedAndGetPlayerID(t, conn1)
	_ = consumeRoomJoinedAndGetPlayerID(t, conn2)

	// Player 1 shoots
	sendShootMessage(t, conn1, 0.0)

	// Player 2 should receive projectile:spawn message
	msg, err := readMessageOfType(t, conn2, "projectile:spawn", 2*time.Second)
	require.NoError(t, err, "Should receive projectile:spawn message")

	data, ok := msg.Data.(map[string]interface{})
	require.True(t, ok)
	assert.NotNil(t, data["projectileId"])
	assert.NotNil(t, data["position"])
	assert.NotNil(t, data["velocity"])
}

func TestShootWithNoAmmo(t *testing.T) {
	ts := newTestServer()
	defer ts.Close()

	conn1, conn2 := ts.connectTwoClients(t)
	defer conn1.Close()
	defer conn2.Close()

	player1ID := consumeRoomJoinedAndGetPlayerID(t, conn1)
	_ = consumeRoomJoinedAndGetPlayerID(t, conn2)

	// Deplete ammo by shooting multiple times
	for i := 0; i < 35; i++ { // Default pistol has 30 ammo
		sendShootMessage(t, conn1, 0.0)
	}

	// Wait for weapon state to update
	_, err := readMessageOfType(t, conn1, "weapon:state", 2*time.Second)
	require.NoError(t, err)

	// Try to shoot again - should fail
	sendShootMessage(t, conn1, 0.0)

	// Should receive shoot:failed message
	msg, err := readMessageOfType(t, conn1, "shoot:failed", 2*time.Second)
	require.NoError(t, err, "Should receive shoot:failed message")

	data, ok := msg.Data.(map[string]interface{})
	require.True(t, ok)
	reason, ok := data["reason"].(string)
	require.True(t, ok)
	assert.Contains(t, []string{"no_ammo", "empty"}, reason)

	// Verify weapon state
	weapon := ts.handler.gameServer.GetWeaponState(player1ID)
	assert.NotNil(t, weapon)
	assert.Equal(t, 0, weapon.CurrentAmmo)
}

func TestReloading(t *testing.T) {
	ts := newTestServer()
	defer ts.Close()

	conn1, conn2 := ts.connectTwoClients(t)

	_ = consumeRoomJoinedAndGetPlayerID(t, conn1)
	_ = consumeRoomJoinedAndGetPlayerID(t, conn2)

	// Shoot once to reduce ammo
	sendShootMessage(t, conn1, 0.0)

	// Wait for projectile spawn
	_, _ = readMessageOfType(t, conn2, "projectile:spawn", 2*time.Second)

	// Reload
	sendReloadMessage(t, conn1)

	// Should receive weapon:state message indicating reload
	// Note: May receive multiple weapon:state messages, find one with isReloading=true
	foundReloading := false
	timeout := time.Now().Add(2 * time.Second)
	for time.Now().Before(timeout) {
		msg, err := readMessageOfType(t, conn1, "weapon:state", 500*time.Millisecond)
		if err != nil {
			continue
		}
		data, ok := msg.Data.(map[string]interface{})
		if !ok {
			continue
		}
		isReloading, ok := data["isReloading"].(bool)
		if ok && isReloading {
			foundReloading = true
			break
		}
	}
	assert.True(t, foundReloading, "Should receive weapon:state with isReloading=true")

	// Close connections after reading messages
	conn1.Close()
	conn2.Close()
}

// ==========================
// Combat Tests
// ==========================

func TestHitDetectionAndDamage(t *testing.T) {
	ts := newTestServer()
	defer ts.Close()

	conn1, conn2 := ts.connectTwoClients(t)

	player1ID := consumeRoomJoinedAndGetPlayerID(t, conn1)
	player2ID := consumeRoomJoinedAndGetPlayerID(t, conn2)

	// Trigger a hit event directly
	ts.handler.onHit(game.HitEvent{
		VictimID:     player2ID,
		AttackerID:   player1ID,
		ProjectileID: "test-projectile",
	})

	// Player 2 should receive player:damaged message
	msg, err := readMessageOfType(t, conn2, "player:damaged", 2*time.Second)
	require.NoError(t, err, "Victim should receive player:damaged message")

	data, ok := msg.Data.(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, player2ID, data["playerId"])
	assert.NotNil(t, data["newHealth"])
	assert.NotNil(t, data["damage"])

	// Player 1 should receive hit:confirmed
	msg2, err := readMessageOfType(t, conn1, "hit:confirmed", 2*time.Second)
	require.NoError(t, err, "Attacker should receive hit:confirmed message")

	data2, ok := msg2.Data.(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, player2ID, data2["victimId"])

	// Close connections after reading messages
	conn1.Close()
	conn2.Close()
}

func TestPlayerDeath(t *testing.T) {
	ts := newTestServer()
	defer ts.Close()

	conn1, conn2 := ts.connectTwoClients(t)

	player1ID := consumeRoomJoinedAndGetPlayerID(t, conn1)
	player2ID := consumeRoomJoinedAndGetPlayerID(t, conn2)

	// Reduce player 2's health to near death
	player2State, _ := ts.handler.gameServer.GetPlayerState(player2ID)
	player2State.Health = 1

	// Deal killing blow
	ts.handler.onHit(game.HitEvent{
		VictimID:     player2ID,
		AttackerID:   player1ID,
		ProjectileID: "killing-blow",
	})

	// Both players should receive player:death message
	msg, err := readMessageOfType(t, conn1, "player:death", 2*time.Second)
	require.NoError(t, err, "Should receive player:death message")

	data, ok := msg.Data.(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, player2ID, data["playerId"])

	// Player 1 should receive kill credit
	killMsg, err := readMessageOfType(t, conn1, "player:kill_credit", 2*time.Second)
	require.NoError(t, err, "Attacker should receive kill credit")

	killData, ok := killMsg.Data.(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, player1ID, killData["killerId"])
	assert.Equal(t, player2ID, killData["victimId"])

	// Close connections after reading messages
	conn1.Close()
	conn2.Close()
}

// ==========================
// Room Management Tests
// ==========================

// TestGlobalHandlerConnectedClients removed - internal global handler API not exposed

func TestChannelFullScenario(t *testing.T) {
	ts := newTestServer()
	defer ts.Close()

	conn1, conn2 := ts.connectTwoClients(t)
	defer conn1.Close()
	defer conn2.Close()

	player1ID := consumeRoomJoinedAndGetPlayerID(t, conn1)
	_ = consumeRoomJoinedAndGetPlayerID(t, conn2)

	room := ts.handler.roomManager.GetRoomByPlayerID(player1ID)
	require.NotNil(t, room)

	player := room.GetPlayer(player1ID)
	require.NotNil(t, player)

	// Fill the player's send channel
	for i := 0; i < 256; i++ {
		select {
		case player.SendChan <- []byte("filler"):
		default:
			break
		}
	}

	// Attempt to send weapon state - should handle channel full gracefully
	ts.handler.sendWeaponState(player1ID)

	// Player should still exist
	assert.NotNil(t, room.GetPlayer(player1ID))
}

// ==========================
// Weapon Pickup Tests
// ==========================

// TestWeaponPickupAttempt removed - weapon pickup is tested in integration_test.go
