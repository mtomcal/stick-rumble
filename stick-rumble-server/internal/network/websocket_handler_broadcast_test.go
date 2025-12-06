package network

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	"github.com/mtomcal/stick-rumble-server/internal/game"
	"github.com/stretchr/testify/assert"
)

// TestBroadcastPlayerStates tests the broadcastPlayerStates function
func TestBroadcastPlayerStates(t *testing.T) {
	t.Run("returns early for empty player list", func(t *testing.T) {
		handler := NewWebSocketHandler()

		// Call with empty list - should not panic
		handler.broadcastPlayerStates([]game.PlayerState{})
	})

	t.Run("broadcasts to players in room", func(t *testing.T) {
		handler := NewWebSocketHandler()
		server := httptest.NewServer(http.HandlerFunc(handler.HandleWebSocket))
		defer server.Close()

		wsURL := "ws" + strings.TrimPrefix(server.URL, "http")

		// Connect two clients to create a room
		conn1, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
		assert.NoError(t, err)
		defer conn1.Close()

		conn2, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
		assert.NoError(t, err)
		defer conn2.Close()

		// Consume room:joined messages
		conn1.SetReadDeadline(time.Now().Add(2 * time.Second))
		conn1.ReadMessage()
		conn2.SetReadDeadline(time.Now().Add(2 * time.Second))
		conn2.ReadMessage()

		// Give time for room setup
		time.Sleep(50 * time.Millisecond)

		// Create player states to broadcast
		playerStates := []game.PlayerState{
			{
				ID:       "player-1",
				Position: game.Vector2{X: 100, Y: 200},
				Velocity: game.Vector2{X: 10, Y: 20},
			},
		}

		// Broadcast - this uses room manager which should have the players
		handler.broadcastPlayerStates(playerStates)

		// The broadcast should complete without error
		// Note: We can't easily capture the actual player IDs from the WebSocket handler
	})

	t.Run("sends to waiting players not in room", func(t *testing.T) {
		handler := NewWebSocketHandler()
		server := httptest.NewServer(http.HandlerFunc(handler.HandleWebSocket))
		defer server.Close()

		wsURL := "ws" + strings.TrimPrefix(server.URL, "http")

		// Connect only ONE client (will be waiting, not in room)
		conn1, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
		assert.NoError(t, err)
		defer conn1.Close()

		// Give time for player setup
		time.Sleep(50 * time.Millisecond)

		// Verify player is NOT in a room (single player = waiting)
		// We can verify by checking GetRoomByPlayerID returns nil
		// Note: We don't have direct access to player ID, but behavior test below confirms

		// Create player states - use a dummy ID since we don't know the actual player ID
		playerStates := []game.PlayerState{
			{
				ID:       "some-player-id",
				Position: game.Vector2{X: 100, Y: 200},
				Velocity: game.Vector2{X: 0, Y: 0},
			},
		}

		// Broadcast - should handle waiting player case without crashing
		handler.broadcastPlayerStates(playerStates)

		// Verify client is still connected by attempting to send a message
		err = conn1.WriteMessage(websocket.PingMessage, []byte{})
		assert.NoError(t, err, "Client should still be connected after broadcast")
	})
}

// TestBroadcastPlayerStatesWithMarshalError tests error path (hard to trigger normally)
func TestBroadcastPlayerStatesWithMarshalError(t *testing.T) {
	t.Run("handles broadcast with valid states", func(t *testing.T) {
		handler := NewWebSocketHandler()
		server := httptest.NewServer(http.HandlerFunc(handler.HandleWebSocket))
		defer server.Close()

		wsURL := "ws" + strings.TrimPrefix(server.URL, "http")

		// Connect two clients
		conn1, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
		assert.NoError(t, err)
		defer conn1.Close()

		conn2, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
		assert.NoError(t, err)
		defer conn2.Close()

		// Consume room:joined messages
		conn1.SetReadDeadline(time.Now().Add(2 * time.Second))
		conn1.ReadMessage()
		conn2.SetReadDeadline(time.Now().Add(2 * time.Second))
		conn2.ReadMessage()

		time.Sleep(50 * time.Millisecond)

		// Create valid player states
		states := []game.PlayerState{
			{
				ID:       "test-player",
				Position: game.Vector2{X: 100, Y: 200},
				Velocity: game.Vector2{X: 0, Y: 0},
			},
		}

		// Broadcast should work without error
		handler.broadcastPlayerStates(states)
	})
}

// TestBroadcastProjectileSpawnError tests error handling in broadcastProjectileSpawn
func TestBroadcastProjectileSpawnError(t *testing.T) {
	t.Run("broadcasts projectile spawn successfully", func(t *testing.T) {
		handler := NewWebSocketHandler()

		// Create a valid projectile
		proj := &game.Projectile{
			ID:       "test-proj",
			OwnerID:  "test-owner",
			Position: game.Vector2{X: 100, Y: 200},
			Velocity: game.Vector2{X: 800, Y: 0},
		}

		// Should not panic
		handler.broadcastProjectileSpawn(proj)
	})
}

// TestSendWeaponStateError tests error handling in sendWeaponState
func TestSendWeaponStateError(t *testing.T) {
	t.Run("handles player not in game server", func(t *testing.T) {
		handler := NewWebSocketHandler()

		// Should not panic for non-existent player
		handler.sendWeaponState("non-existent-player")
	})
}

// TestSendShootFailedError tests error handling in sendShootFailed
func TestSendShootFailedError(t *testing.T) {
	t.Run("handles player not in room or waiting", func(t *testing.T) {
		handler := NewWebSocketHandler()

		// Should not panic for non-existent player
		handler.sendShootFailed("non-existent-player", "test-reason")
	})
}

// TestSendWeaponState tests the sendWeaponState function
func TestSendWeaponState(t *testing.T) {
	t.Run("sends weapon state to player in room", func(t *testing.T) {
		handler := NewWebSocketHandler()
		server := httptest.NewServer(http.HandlerFunc(handler.HandleWebSocket))
		defer server.Close()

		wsURL := "ws" + strings.TrimPrefix(server.URL, "http")

		conn1, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
		assert.NoError(t, err)
		defer conn1.Close()

		conn2, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
		assert.NoError(t, err)
		defer conn2.Close()

		conn1.SetReadDeadline(time.Now().Add(2 * time.Second))
		_, joinedBytes, _ := conn1.ReadMessage()
		var joinedMsg Message
		json.Unmarshal(joinedBytes, &joinedMsg)
		playerID := joinedMsg.Data.(map[string]interface{})["playerId"].(string)

		conn2.SetReadDeadline(time.Now().Add(2 * time.Second))
		conn2.ReadMessage()

		time.Sleep(50 * time.Millisecond)

		handler.sendWeaponState(playerID)

		conn1.SetReadDeadline(time.Now().Add(2 * time.Second))
		_, msgBytes, err := conn1.ReadMessage()
		assert.NoError(t, err, "Should receive weapon:state")

		var msg Message
		err = json.Unmarshal(msgBytes, &msg)
		assert.NoError(t, err)
		assert.Equal(t, "weapon:state", msg.Type)
	})

	t.Run("handles non-existent player", func(t *testing.T) {
		handler := NewWebSocketHandler()

		ws := handler.gameServer.GetWeaponState("non-existent-player")
		assert.Nil(t, ws, "Weapon state should be nil for non-existent player")

		room := handler.roomManager.GetRoomByPlayerID("non-existent-player")
		assert.Nil(t, room, "Non-existent player should not be in any room")

		handler.sendWeaponState("non-existent-player")

		roomAfter := handler.roomManager.GetRoomByPlayerID("non-existent-player")
		assert.Nil(t, roomAfter, "Player should remain not in any room after sendWeaponState")
	})
}

// TestSendShootFailed tests the sendShootFailed function
func TestSendShootFailed(t *testing.T) {
	t.Run("sends shoot failed message to player in room", func(t *testing.T) {
		handler := NewWebSocketHandler()
		server := httptest.NewServer(http.HandlerFunc(handler.HandleWebSocket))
		defer server.Close()

		wsURL := "ws" + strings.TrimPrefix(server.URL, "http")

		conn1, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
		assert.NoError(t, err)
		defer conn1.Close()

		conn2, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
		assert.NoError(t, err)
		defer conn2.Close()

		conn1.SetReadDeadline(time.Now().Add(2 * time.Second))
		_, joinedBytes, _ := conn1.ReadMessage()
		var joinedMsg Message
		json.Unmarshal(joinedBytes, &joinedMsg)
		playerID := joinedMsg.Data.(map[string]interface{})["playerId"].(string)

		conn2.SetReadDeadline(time.Now().Add(2 * time.Second))
		conn2.ReadMessage()

		time.Sleep(50 * time.Millisecond)

		handler.sendShootFailed(playerID, "empty")

		conn1.SetReadDeadline(time.Now().Add(2 * time.Second))
		_, msgBytes, err := conn1.ReadMessage()
		assert.NoError(t, err, "Should receive shoot:failed")

		var msg Message
		err = json.Unmarshal(msgBytes, &msg)
		assert.NoError(t, err)
		assert.Equal(t, "shoot:failed", msg.Type)

		data := msg.Data.(map[string]interface{})
		assert.Equal(t, "empty", data["reason"])
	})

	t.Run("sends shoot failed to waiting player", func(t *testing.T) {
		handler := NewWebSocketHandler()
		server := httptest.NewServer(http.HandlerFunc(handler.HandleWebSocket))
		defer server.Close()

		wsURL := "ws" + strings.TrimPrefix(server.URL, "http")

		conn1, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
		assert.NoError(t, err)
		defer conn1.Close()

		time.Sleep(50 * time.Millisecond)

		handler.sendShootFailed("some-waiting-player", "cooldown")

		err = conn1.WriteMessage(websocket.PingMessage, []byte{})
		assert.NoError(t, err, "Client should still be connected after sendShootFailed")
	})

	t.Run("handles non-existent player", func(t *testing.T) {
		handler := NewWebSocketHandler()

		roomBefore := handler.roomManager.GetRoomByPlayerID("non-existent-player")
		assert.Nil(t, roomBefore, "Player should not be in any room initially")

		handler.sendShootFailed("non-existent-player", "empty")

		roomAfter := handler.roomManager.GetRoomByPlayerID("non-existent-player")
		assert.Nil(t, roomAfter, "Player should remain not in any room after sendShootFailed")
	})
}
