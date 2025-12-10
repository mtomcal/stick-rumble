package network

import (
	"encoding/json"
	"math"
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

		// Call with empty list - should not panic and return early
		assert.NotPanics(t, func() {
			handler.broadcastPlayerStates([]game.PlayerState{})
		}, "broadcastPlayerStates should not panic with empty player list")
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

		// Consume room:joined and weapon:spawned messages, capture player ID
		player1ID := consumeRoomJoinedAndGetPlayerID(t, conn1)
		consumeRoomJoined(t, conn2)

		// Give time for room setup
		time.Sleep(50 * time.Millisecond)

		// Create player states to broadcast using actual player ID
		playerStates := []game.PlayerState{
			{
				ID:       player1ID,
				Position: game.Vector2{X: 100, Y: 200},
				Velocity: game.Vector2{X: 10, Y: 20},
			},
		}

		// Broadcast - this uses room manager which should have the players
		handler.broadcastPlayerStates(playerStates)

		// Verify broadcast message was received by at least one client
		conn1.SetReadDeadline(time.Now().Add(2 * time.Second))
		_, msgBytes, err := conn1.ReadMessage()
		assert.NoError(t, err, "Should receive player:move broadcast message")

		var msg Message
		err = json.Unmarshal(msgBytes, &msg)
		assert.NoError(t, err, "Message should be valid JSON")
		assert.Equal(t, "player:move", msg.Type, "Should receive player:move message type")
	})

	t.Run("handles broadcast to waiting player without crash", func(t *testing.T) {
		// This test verifies that broadcastPlayerStates handles the case where
		// a player is waiting (not yet in a room) without crashing or errors.
		// A single connected client will be in "waiting" state, not in a room.
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

		// Create player states - use a dummy ID since we don't know the actual player ID
		playerStates := []game.PlayerState{
			{
				ID:       "some-player-id",
				Position: game.Vector2{X: 100, Y: 200},
				Velocity: game.Vector2{X: 0, Y: 0},
			},
		}

		// Broadcast - should handle waiting player case without crashing
		assert.NotPanics(t, func() {
			handler.broadcastPlayerStates(playerStates)
		}, "broadcastPlayerStates should not panic for waiting player")

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

		// Consume room:joined and weapon:spawned messages, capture player ID
		player1ID := consumeRoomJoinedAndGetPlayerID(t, conn1)
		consumeRoomJoined(t, conn2)

		time.Sleep(50 * time.Millisecond)

		// Create valid player states using actual player ID
		states := []game.PlayerState{
			{
				ID:       player1ID,
				Position: game.Vector2{X: 100, Y: 200},
				Velocity: game.Vector2{X: 0, Y: 0},
			},
		}

		// Broadcast should work without error
		handler.broadcastPlayerStates(states)

		// Verify broadcast message was received
		conn1.SetReadDeadline(time.Now().Add(2 * time.Second))
		_, msgBytes, err := conn1.ReadMessage()
		assert.NoError(t, err, "Should receive broadcast message")

		var msg Message
		err = json.Unmarshal(msgBytes, &msg)
		assert.NoError(t, err, "Message should be valid JSON")
		assert.Equal(t, "player:move", msg.Type, "Should receive player:move message")
	})
}

// TestBroadcastPlayerStatesNaNHandling tests NaN/Inf sanitization
func TestBroadcastPlayerStatesNaNHandling(t *testing.T) {
	t.Run("sanitizes NaN position values", func(t *testing.T) {
		handler := NewWebSocketHandler()

		// Create player state with NaN position
		nan := math.NaN()
		states := []game.PlayerState{
			{
				ID:       "player-nan-pos",
				Position: game.Vector2{X: nan, Y: 100},
				Velocity: game.Vector2{X: 0, Y: 0},
			},
		}

		// Should not panic - NaN is logged but broadcast continues
		assert.NotPanics(t, func() {
			handler.broadcastPlayerStates(states)
		}, "broadcastPlayerStates should handle NaN position without panic")
	})

	t.Run("sanitizes Inf position values", func(t *testing.T) {
		handler := NewWebSocketHandler()

		// Create player state with Inf position
		inf := math.Inf(1)
		states := []game.PlayerState{
			{
				ID:       "player-inf-pos",
				Position: game.Vector2{X: inf, Y: 100},
				Velocity: game.Vector2{X: 0, Y: 0},
			},
		}

		// Should not panic - Inf is logged but broadcast continues
		assert.NotPanics(t, func() {
			handler.broadcastPlayerStates(states)
		}, "broadcastPlayerStates should handle Inf position without panic")
	})

	t.Run("sanitizes NaN velocity values", func(t *testing.T) {
		handler := NewWebSocketHandler()

		// Create player state with NaN velocity
		nan := math.NaN()
		states := []game.PlayerState{
			{
				ID:       "player-nan-vel",
				Position: game.Vector2{X: 100, Y: 100},
				Velocity: game.Vector2{X: nan, Y: 0},
			},
		}

		// Should not panic - NaN is logged but broadcast continues
		assert.NotPanics(t, func() {
			handler.broadcastPlayerStates(states)
		}, "broadcastPlayerStates should handle NaN velocity without panic")
	})

	t.Run("sanitizes Inf velocity values", func(t *testing.T) {
		handler := NewWebSocketHandler()

		// Create player state with Inf velocity
		inf := math.Inf(-1)
		states := []game.PlayerState{
			{
				ID:       "player-inf-vel",
				Position: game.Vector2{X: 100, Y: 100},
				Velocity: game.Vector2{X: 0, Y: inf},
			},
		}

		// Should not panic - Inf is logged but broadcast continues
		assert.NotPanics(t, func() {
			handler.broadcastPlayerStates(states)
		}, "broadcastPlayerStates should handle Inf velocity without panic")
	})

	t.Run("sanitizes NaN aimAngle and replaces with 0", func(t *testing.T) {
		handler := NewWebSocketHandler()

		// Create player state with NaN aimAngle
		nan := math.NaN()
		states := []game.PlayerState{
			{
				ID:       "player-nan-aim",
				Position: game.Vector2{X: 100, Y: 100},
				Velocity: game.Vector2{X: 0, Y: 0},
				AimAngle: nan,
			},
		}

		// Should not panic - NaN aimAngle is sanitized to 0
		handler.broadcastPlayerStates(states)

		// Verify aimAngle was sanitized
		assert.Equal(t, float64(0), states[0].AimAngle, "NaN aimAngle should be sanitized to 0")
	})

	t.Run("sanitizes Inf aimAngle and replaces with 0", func(t *testing.T) {
		handler := NewWebSocketHandler()

		// Create player state with Inf aimAngle
		inf := math.Inf(1)
		states := []game.PlayerState{
			{
				ID:       "player-inf-aim",
				Position: game.Vector2{X: 100, Y: 100},
				Velocity: game.Vector2{X: 0, Y: 0},
				AimAngle: inf,
			},
		}

		// Should not panic - Inf aimAngle is sanitized to 0
		handler.broadcastPlayerStates(states)

		// Verify aimAngle was sanitized
		assert.Equal(t, float64(0), states[0].AimAngle, "Inf aimAngle should be sanitized to 0")
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

		// Should not panic when broadcasting projectile spawn
		assert.NotPanics(t, func() {
			handler.broadcastProjectileSpawn(proj)
		}, "broadcastProjectileSpawn should not panic with valid projectile")
	})

	t.Run("broadcasts projectile spawn to players in room", func(t *testing.T) {
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

		// Consume room:joined and weapon:spawned messages
		consumeRoomJoined(t, conn1)
		consumeRoomJoined(t, conn2)

		time.Sleep(50 * time.Millisecond)

		// Create a valid projectile
		proj := &game.Projectile{
			ID:       "test-proj-room",
			OwnerID:  "test-owner",
			Position: game.Vector2{X: 100, Y: 200},
			Velocity: game.Vector2{X: 800, Y: 0},
		}

		// Broadcast projectile spawn
		handler.broadcastProjectileSpawn(proj)

		// Verify message was received by at least one client
		conn1.SetReadDeadline(time.Now().Add(2 * time.Second))
		_, msgBytes, err := conn1.ReadMessage()
		assert.NoError(t, err, "Should receive projectile:spawn message")

		var msg Message
		err = json.Unmarshal(msgBytes, &msg)
		assert.NoError(t, err, "Message should be valid JSON")
		assert.Equal(t, "projectile:spawn", msg.Type, "Should receive projectile:spawn message type")

		data := msg.Data.(map[string]interface{})
		assert.Equal(t, "test-proj-room", data["id"], "Should have correct projectile ID")
		assert.Equal(t, "test-owner", data["ownerId"], "Should have correct owner ID")
	})

	t.Run("broadcasts projectile spawn with NaN position values", func(t *testing.T) {
		handler := NewWebSocketHandler()

		// Create a projectile with NaN position (edge case)
		proj := &game.Projectile{
			ID:       "test-proj-nan",
			OwnerID:  "test-owner",
			Position: game.Vector2{X: math.NaN(), Y: 200},
			Velocity: game.Vector2{X: 800, Y: 0},
		}

		// Should not panic - NaN causes JSON marshal to fail, which is logged
		assert.NotPanics(t, func() {
			handler.broadcastProjectileSpawn(proj)
		}, "broadcastProjectileSpawn should not panic with NaN position")
	})

	t.Run("broadcasts projectile spawn with Inf velocity values", func(t *testing.T) {
		handler := NewWebSocketHandler()

		// Create a projectile with Inf velocity (edge case)
		proj := &game.Projectile{
			ID:       "test-proj-inf",
			OwnerID:  "test-owner",
			Position: game.Vector2{X: 100, Y: 200},
			Velocity: game.Vector2{X: math.Inf(1), Y: 0},
		}

		// Should not panic - Inf causes JSON marshal to fail, which is logged
		assert.NotPanics(t, func() {
			handler.broadcastProjectileSpawn(proj)
		}, "broadcastProjectileSpawn should not panic with Inf velocity")
	})
}

// TestSendWeaponStateError tests error handling in sendWeaponState
func TestSendWeaponStateError(t *testing.T) {
	t.Run("handles player not in game server", func(t *testing.T) {
		handler := NewWebSocketHandler()

		// Verify weapon state is nil for non-existent player
		ws := handler.gameServer.GetWeaponState("non-existent-player")
		assert.Nil(t, ws, "Weapon state should be nil for non-existent player")

		// Should not panic and should return early for non-existent player
		assert.NotPanics(t, func() {
			handler.sendWeaponState("non-existent-player")
		}, "sendWeaponState should not panic for non-existent player")
	})
}

// TestSendShootFailedError tests error handling in sendShootFailed
func TestSendShootFailedError(t *testing.T) {
	t.Run("handles player not in room or waiting", func(t *testing.T) {
		handler := NewWebSocketHandler()

		// Verify player is not in any room
		room := handler.roomManager.GetRoomByPlayerID("non-existent-player")
		assert.Nil(t, room, "Non-existent player should not be in any room")

		// Should not panic for non-existent player
		assert.NotPanics(t, func() {
			handler.sendShootFailed("non-existent-player", "test-reason")
		}, "sendShootFailed should not panic for non-existent player")
	})
}

// TestSendWeaponStateToWaitingPlayer tests sending weapon state to a waiting player
func TestSendWeaponStateToWaitingPlayer(t *testing.T) {
	t.Run("handles non-existent player ID gracefully", func(t *testing.T) {
		// This test verifies sendWeaponState handles a non-existent player ID
		// without crashing. The player ID doesn't exist in gameServer, so
		// GetWeaponState returns nil and the function returns early.
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

		// Verify player ID doesn't exist in game server
		ws := handler.gameServer.GetWeaponState("some-player-id")
		assert.Nil(t, ws, "Non-existent player should have nil weapon state")

		// Should not panic and return early for non-existent player
		assert.NotPanics(t, func() {
			handler.sendWeaponState("some-player-id")
		}, "sendWeaponState should not panic for non-existent player ID")

		// Verify client connection is still active
		err = conn1.WriteMessage(websocket.PingMessage, []byte{})
		assert.NoError(t, err, "Client should still be connected after sendWeaponState")
	})

	t.Run("exercises waiting player path with player not in room", func(t *testing.T) {
		// This test exercises the sendWeaponState code path for the "else" branch
		// at broadcast_helper.go:164 (SendToWaitingPlayer path).
		// We add a player directly to gameServer but NOT to a room, simulating
		// the waiting player scenario.
		handler := NewWebSocketHandler()

		// Add player directly to gameServer (not via WebSocket connection)
		playerID := "waiting-player-test"
		handler.gameServer.AddPlayer(playerID)

		// Verify player exists in game server
		ws := handler.gameServer.GetWeaponState(playerID)
		assert.NotNil(t, ws, "Player should have weapon state in game server")

		// Verify player is NOT in a room
		room := handler.roomManager.GetRoomByPlayerID(playerID)
		assert.Nil(t, room, "Player should not be in any room")

		// Call sendWeaponState - exercises the waiting player path (else branch)
		// This calls SendToWaitingPlayer which will find no matching player
		// in waitingPlayers list, but should not panic
		assert.NotPanics(t, func() {
			handler.sendWeaponState(playerID)
		}, "sendWeaponState should not panic when taking waiting player path")
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

		// Consume room:joined and weapon:spawned messages, capture player ID
		playerID := consumeRoomJoinedAndGetPlayerID(t, conn1)
		consumeRoomJoined(t, conn2)

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

	t.Run("sends to waiting player not in room", func(t *testing.T) {
		handler := NewWebSocketHandler()

		// Add player directly to gameServer but not to a room
		playerID := "waiting-weapon-state"
		handler.gameServer.AddPlayer(playerID)

		// Verify player is NOT in a room
		room := handler.roomManager.GetRoomByPlayerID(playerID)
		assert.Nil(t, room, "Player should not be in any room")

		// Call sendWeaponState - exercises the waiting player path (else branch at line 165)
		// This calls SendToWaitingPlayer which will find no matching player
		// in waitingPlayers list, but should not panic
		assert.NotPanics(t, func() {
			handler.sendWeaponState(playerID)
		}, "sendWeaponState should not panic when taking waiting player path")
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

		// Consume room:joined and weapon:spawned messages, capture player ID
		playerID := consumeRoomJoinedAndGetPlayerID(t, conn1)
		consumeRoomJoined(t, conn2)

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

	t.Run("exercises waiting player path with player not in room", func(t *testing.T) {
		// This test exercises the sendShootFailed code path for the "else" branch
		// at broadcast_helper.go:196 (SendToWaitingPlayer path).
		// We add a player directly to gameServer but NOT to a room.
		handler := NewWebSocketHandler()

		// Add player directly to gameServer (not via WebSocket connection)
		playerID := "waiting-player-shootfailed"
		handler.gameServer.AddPlayer(playerID)

		// Verify player is NOT in a room
		room := handler.roomManager.GetRoomByPlayerID(playerID)
		assert.Nil(t, room, "Player should not be in any room")

		// Call sendShootFailed - exercises the waiting player path (else branch)
		// This calls SendToWaitingPlayer which will find no matching player
		// in waitingPlayers list, but should not panic
		assert.NotPanics(t, func() {
			handler.sendShootFailed(playerID, "cooldown")
		}, "sendShootFailed should not panic when taking waiting player path")
	})

	t.Run("handles non-existent waiting player gracefully", func(t *testing.T) {
		handler := NewWebSocketHandler()
		server := httptest.NewServer(http.HandlerFunc(handler.HandleWebSocket))
		defer server.Close()

		wsURL := "ws" + strings.TrimPrefix(server.URL, "http")

		conn1, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
		assert.NoError(t, err)
		defer conn1.Close()

		time.Sleep(50 * time.Millisecond)

		// Verify non-existent player is not in any room
		room := handler.roomManager.GetRoomByPlayerID("some-waiting-player")
		assert.Nil(t, room, "Non-existent player should not be in any room")

		// Should not panic for non-existent player
		assert.NotPanics(t, func() {
			handler.sendShootFailed("some-waiting-player", "cooldown")
		}, "sendShootFailed should not panic for non-existent player")

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
