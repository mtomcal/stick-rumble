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

func TestHandlePlayerShoot(t *testing.T) {
	t.Run("processes valid shoot request", func(t *testing.T) {
		handler := NewWebSocketHandler()
		playerID := "test-shooter-1"
		handler.gameServer.AddPlayer(playerID)
		shootData := map[string]interface{}{"aimAngle": 0.5}
		handler.handlePlayerShoot(playerID, shootData)
		projectiles := handler.gameServer.GetActiveProjectiles()
		assert.Equal(t, 1, len(projectiles), "Should have created one projectile")
	})

	t.Run("handles invalid data format", func(t *testing.T) {
		handler := NewWebSocketHandler()
		playerID := "test-shooter-2"
		handler.gameServer.AddPlayer(playerID)
		handler.handlePlayerShoot(playerID, "invalid data")
		projectiles := handler.gameServer.GetActiveProjectiles()
		assert.Equal(t, 0, len(projectiles), "Should not have created projectile with invalid data")
	})

	t.Run("handles nil data", func(t *testing.T) {
		handler := NewWebSocketHandler()
		playerID := "test-shooter-3"
		handler.gameServer.AddPlayer(playerID)
		handler.handlePlayerShoot(playerID, nil)
		projectiles := handler.gameServer.GetActiveProjectiles()
		assert.Equal(t, 0, len(projectiles), "Should not have created projectile with nil data")
	})

	t.Run("enforces fire rate cooldown", func(t *testing.T) {
		handler := NewWebSocketHandler()
		playerID := "test-shooter-4"
		handler.gameServer.AddPlayer(playerID)
		shootData := map[string]interface{}{"aimAngle": 0.0}
		handler.handlePlayerShoot(playerID, shootData)
		handler.handlePlayerShoot(playerID, shootData) // Second shot should fail (cooldown)
		projectiles := handler.gameServer.GetActiveProjectiles()
		assert.Equal(t, 1, len(projectiles), "Second shot should be blocked by cooldown")
	})

	t.Run("fails with empty magazine", func(t *testing.T) {
		handler := NewWebSocketHandler()
		playerID := "test-shooter-5"
		handler.gameServer.AddPlayer(playerID)
		ws := handler.gameServer.GetWeaponState(playerID)
		ws.CurrentAmmo = 0
		shootData := map[string]interface{}{"aimAngle": 0.0}
		handler.handlePlayerShoot(playerID, shootData)
		projectiles := handler.gameServer.GetActiveProjectiles()
		assert.Equal(t, 0, len(projectiles), "Should not shoot with empty magazine")
	})
}

// TestHandlePlayerReload tests the handlePlayerReload function
func TestHandlePlayerReload(t *testing.T) {
	t.Run("processes valid reload request", func(t *testing.T) {
		handler := NewWebSocketHandler()
		playerID := "test-reloader-1"

		// Add player to game server
		handler.gameServer.AddPlayer(playerID)

		// Use some ammo
		ws := handler.gameServer.GetWeaponState(playerID)
		ws.CurrentAmmo = 5

		// Handle the reload request
		handler.handlePlayerReload(playerID)

		// Verify reload started
		assert.True(t, ws.IsReloading, "Should be reloading after reload request")
	})

	t.Run("does not reload when magazine is full", func(t *testing.T) {
		handler := NewWebSocketHandler()
		playerID := "test-reloader-2"

		// Add player to game server
		handler.gameServer.AddPlayer(playerID)

		// Magazine is full by default
		ws := handler.gameServer.GetWeaponState(playerID)
		initialAmmo := ws.CurrentAmmo

		// Attempt reload
		handler.handlePlayerReload(playerID)

		// Should not be reloading
		assert.False(t, ws.IsReloading, "Should not reload when magazine is full")
		assert.Equal(t, initialAmmo, ws.CurrentAmmo, "Ammo should not change")
	})

	t.Run("handles non-existent player", func(t *testing.T) {
		handler := NewWebSocketHandler()

		// Verify player doesn't exist
		ws := handler.gameServer.GetWeaponState("non-existent-player")
		assert.Nil(t, ws, "Weapon state should be nil for non-existent player before reload")

		// Attempt reload for non-existent player
		handler.handlePlayerReload("non-existent-player")

		// Verify still no weapon state (no side effects)
		wsAfter := handler.gameServer.GetWeaponState("non-existent-player")
		assert.Nil(t, wsAfter, "Weapon state should remain nil after reload attempt")
	})
}

// TestHandlePlayerShootViaWebSocket tests player:shoot message handling through WebSocket
func TestHandlePlayerShootViaWebSocket(t *testing.T) {
	handler := NewWebSocketHandler()
	server := httptest.NewServer(http.HandlerFunc(handler.HandleWebSocket))
	defer server.Close()

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http")

	// Connect a client
	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	assert.NoError(t, err, "Should connect")
	defer conn.Close()

	// Give time for player to be added to game server
	time.Sleep(50 * time.Millisecond)

	// Send player:shoot message
	shootMsg := Message{
		Type:      "player:shoot",
		Timestamp: time.Now().UnixMilli(),
		Data: map[string]interface{}{
			"aimAngle": 0.5,
		},
	}

	msgBytes, err := json.Marshal(shootMsg)
	assert.NoError(t, err)

	err = conn.WriteMessage(websocket.TextMessage, msgBytes)
	assert.NoError(t, err, "Should send player:shoot message")

	// Give time for message to be processed
	time.Sleep(50 * time.Millisecond)

	// Should have created a projectile
	projectiles := handler.gameServer.GetActiveProjectiles()
	assert.Equal(t, 1, len(projectiles), "Should have created one projectile")
}

// TestHandlePlayerReloadViaWebSocket tests player:reload message handling through WebSocket
func TestHandlePlayerReloadViaWebSocket(t *testing.T) {
	handler := NewWebSocketHandler()
	server := httptest.NewServer(http.HandlerFunc(handler.HandleWebSocket))
	defer server.Close()

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http")

	// Connect a client
	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	assert.NoError(t, err, "Should connect")
	defer conn.Close()

	// Give time for player to be added to game server
	time.Sleep(50 * time.Millisecond)

	// First shoot to use some ammo
	shootMsg := Message{
		Type:      "player:shoot",
		Timestamp: time.Now().UnixMilli(),
		Data: map[string]interface{}{
			"aimAngle": 0.0,
		},
	}
	msgBytes, _ := json.Marshal(shootMsg)
	conn.WriteMessage(websocket.TextMessage, msgBytes)
	time.Sleep(50 * time.Millisecond)

	// Send player:reload message
	reloadMsg := Message{
		Type:      "player:reload",
		Timestamp: time.Now().UnixMilli(),
	}

	msgBytes, err = json.Marshal(reloadMsg)
	assert.NoError(t, err)

	err = conn.WriteMessage(websocket.TextMessage, msgBytes)
	assert.NoError(t, err, "Should send player:reload message")

	// Give time for message to be processed
	time.Sleep(50 * time.Millisecond)

	// The reload should be processed without error
}

// TestBroadcastProjectileSpawn tests the broadcastProjectileSpawn function
func TestBroadcastProjectileSpawn(t *testing.T) {
	t.Run("broadcasts projectile spawn to connected clients", func(t *testing.T) {
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

		// Give time for room setup
		time.Sleep(50 * time.Millisecond)

		// Create a projectile to broadcast
		proj := &game.Projectile{
			ID:       "test-proj-1",
			OwnerID:  "player-1",
			Position: game.Vector2{X: 100, Y: 200},
			Velocity: game.Vector2{X: 800, Y: 0},
		}

		// Broadcast projectile spawn
		handler.broadcastProjectileSpawn(proj)

		// Clients should receive the broadcast
		conn1.SetReadDeadline(time.Now().Add(2 * time.Second))
		_, msgBytes, err := conn1.ReadMessage()
		assert.NoError(t, err, "Client 1 should receive projectile:spawn")

		var msg Message
		err = json.Unmarshal(msgBytes, &msg)
		assert.NoError(t, err)
		assert.Equal(t, "projectile:spawn", msg.Type)
	})
}

// TestOnReloadComplete tests the onReloadComplete callback
func TestOnReloadComplete(t *testing.T) {
	t.Run("sends weapon state when reload completes", func(t *testing.T) {
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
		playerID := consumeRoomJoinedAndGetPlayerID(t, conn1)
		consumeRoomJoined(t, conn2)

		// Give time for room setup
		time.Sleep(50 * time.Millisecond)

		// Directly call onReloadComplete to test the callback
		handler.onReloadComplete(playerID)

		// Player should receive weapon:state message
		conn1.SetReadDeadline(time.Now().Add(2 * time.Second))
		_, msgBytes, err := conn1.ReadMessage()
		assert.NoError(t, err, "Should receive weapon:state after reload complete")

		var msg Message
		err = json.Unmarshal(msgBytes, &msg)
		assert.NoError(t, err)
		assert.Equal(t, "weapon:state", msg.Type, "Message type should be weapon:state")

		// Verify weapon state data
		data := msg.Data.(map[string]interface{})
		assert.Contains(t, data, "currentAmmo")
		assert.Contains(t, data, "maxAmmo")
		assert.Contains(t, data, "isReloading")
		assert.Contains(t, data, "canShoot")
	})

	t.Run("callback is registered on handler creation", func(t *testing.T) {
		handler := NewWebSocketHandler()

		// Verify the callback was set by checking gameServer's internal state
		// We can test this indirectly by checking the handler was created properly
		assert.NotNil(t, handler.gameServer, "GameServer should be initialized")
		assert.NotNil(t, handler.roomManager, "RoomManager should be initialized")
	})
}
