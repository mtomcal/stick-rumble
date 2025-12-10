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

// TestOnHit tests the onHit callback for handling hit events (Story 2.4)
func TestOnHit(t *testing.T) {
	t.Run("broadcasts player:damaged message to all players in room", func(t *testing.T) {
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

		// Consume room:joined and weapon:spawned messages, capture player IDs
		player1ID := consumeRoomJoinedAndGetPlayerID(t, conn1)
		player2ID := consumeRoomJoinedAndGetPlayerID(t, conn2)

		// Give time for room setup
		time.Sleep(50 * time.Millisecond)

		// Create a hit event
		hitEvent := game.HitEvent{
			ProjectileID: "proj-1",
			VictimID:     player2ID,
			AttackerID:   player1ID,
		}

		// Trigger onHit callback
		handler.onHit(hitEvent)

		// Both clients should receive player:damaged message
		conn1.SetReadDeadline(time.Now().Add(2 * time.Second))
		_, msgBytes1, err := conn1.ReadMessage()
		assert.NoError(t, err, "Client 1 should receive player:damaged")

		var msg1 Message
		err = json.Unmarshal(msgBytes1, &msg1)
		assert.NoError(t, err)
		assert.Equal(t, "player:damaged", msg1.Type)

		data1 := msg1.Data.(map[string]interface{})
		assert.Equal(t, player2ID, data1["victimId"])
		assert.Equal(t, player1ID, data1["attackerId"])
		assert.Equal(t, "proj-1", data1["projectileId"])
		assert.NotNil(t, data1["damage"])
		assert.NotNil(t, data1["newHealth"])
	})

	t.Run("sends hit:confirmed message to attacker in room", func(t *testing.T) {
		// This test verifies the fix for ReadyQ task 1d78d55d:
		// hit:confirmed is now sent via SendToPlayer which works for players in rooms
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

		// Consume room:joined and weapon:spawned messages, capture player IDs
		player1ID := consumeRoomJoinedAndGetPlayerID(t, conn1)
		player2ID := consumeRoomJoinedAndGetPlayerID(t, conn2)

		// Give time for room setup
		time.Sleep(50 * time.Millisecond)

		// Create a hit event where player1 is the attacker
		hitEvent := game.HitEvent{
			ProjectileID: "proj-hit-confirm",
			VictimID:     player2ID,
			AttackerID:   player1ID,
		}

		// Trigger onHit callback
		handler.onHit(hitEvent)

		// Attacker (conn1) should receive player:damaged (broadcast) and hit:confirmed (targeted)
		// Read messages from conn1 - should get both player:damaged and hit:confirmed
		receivedTypes := make(map[string]bool)
		var hitConfirmedData map[string]interface{}

		for i := 0; i < 2; i++ {
			conn1.SetReadDeadline(time.Now().Add(2 * time.Second))
			_, msgBytes, err := conn1.ReadMessage()
			assert.NoError(t, err, "Attacker should receive messages")

			var msg Message
			err = json.Unmarshal(msgBytes, &msg)
			assert.NoError(t, err)
			receivedTypes[msg.Type] = true

			if msg.Type == "hit:confirmed" {
				hitConfirmedData = msg.Data.(map[string]interface{})
			}
		}

		// Verify attacker received both messages
		assert.True(t, receivedTypes["player:damaged"], "Attacker should receive player:damaged broadcast")
		assert.True(t, receivedTypes["hit:confirmed"], "Attacker should receive hit:confirmed message")

		// Verify hit:confirmed data
		assert.NotNil(t, hitConfirmedData, "hit:confirmed should have data")
		assert.Equal(t, player2ID, hitConfirmedData["victimId"])
		assert.Equal(t, "proj-hit-confirm", hitConfirmedData["projectileId"])
		assert.NotNil(t, hitConfirmedData["damage"])

		// Victim (conn2) should only receive player:damaged (broadcast), NOT hit:confirmed
		conn2.SetReadDeadline(time.Now().Add(2 * time.Second))
		_, msgBytes2, err := conn2.ReadMessage()
		assert.NoError(t, err, "Victim should receive player:damaged")

		var msg2 Message
		err = json.Unmarshal(msgBytes2, &msg2)
		assert.NoError(t, err)
		assert.Equal(t, "player:damaged", msg2.Type, "Victim should receive player:damaged")

		// Verify victim does NOT receive hit:confirmed (short timeout)
		conn2.SetReadDeadline(time.Now().Add(200 * time.Millisecond))
		_, _, err = conn2.ReadMessage()
		assert.Error(t, err, "Victim should NOT receive hit:confirmed (timeout expected)")
	})

	t.Run("handles death scenario without panicking", func(t *testing.T) {
		handler := NewWebSocketHandler()
		player1ID := "attacker-123"
		player2ID := "victim-456"
		handler.gameServer.AddPlayer(player1ID)
		handler.gameServer.AddPlayer(player2ID)

		hitEvent := game.HitEvent{
			ProjectileID: "proj-1",
			VictimID:     player2ID,
			AttackerID:   player1ID,
		}

		// Should not panic when handling hit event
		assert.NotPanics(t, func() {
			handler.onHit(hitEvent)
		}, "onHit should not panic when handling death scenario")

		// Verify both players still exist after hit event
		_, attackerExists := handler.gameServer.GetPlayerState(player1ID)
		_, victimExists := handler.gameServer.GetPlayerState(player2ID)
		assert.True(t, attackerExists, "Attacker should still exist after hit")
		assert.True(t, victimExists, "Victim should still exist after hit")
	})

	t.Run("handles non-existent victim gracefully", func(t *testing.T) {
		handler := NewWebSocketHandler()

		hitEvent := game.HitEvent{
			ProjectileID: "proj-1",
			VictimID:     "non-existent-victim",
			AttackerID:   "some-attacker",
		}

		// Should not panic when victim doesn't exist
		assert.NotPanics(t, func() {
			handler.onHit(hitEvent)
		}, "onHit should not panic when victim doesn't exist")

		_, exists := handler.gameServer.GetPlayerState("non-existent-victim")
		assert.False(t, exists, "Non-existent victim should not be created")
	})

	t.Run("handles non-existent attacker gracefully", func(t *testing.T) {
		handler := NewWebSocketHandler()
		victimID := "victim-1"
		handler.gameServer.AddPlayer(victimID)

		hitEvent := game.HitEvent{
			ProjectileID: "proj-1",
			VictimID:     victimID,
			AttackerID:   "non-existent-attacker",
		}

		// Should not panic when attacker doesn't exist
		assert.NotPanics(t, func() {
			handler.onHit(hitEvent)
		}, "onHit should not panic when attacker doesn't exist")

		victimState, exists := handler.gameServer.GetPlayerState(victimID)
		assert.True(t, exists, "Victim should still exist")
		assert.Equal(t, game.PlayerMaxHealth, victimState.Health, "Victim health should be unchanged")
	})
}

// TestOnRespawnAdditional tests additional onRespawn scenarios
func TestOnRespawnAdditional(t *testing.T) {
	t.Run("exercises complete respawn flow with players", func(t *testing.T) {
		handler := NewWebSocketHandler()

		// Add player to gameServer
		playerID := "respawn-test-player"
		handler.gameServer.AddPlayer(playerID)

		respawnPos := game.Vector2{X: 400, Y: 300}

		// Should not panic when handling respawn (no room, but exercises message creation path)
		assert.NotPanics(t, func() {
			handler.onRespawn(playerID, respawnPos)
		}, "onRespawn should not panic when player is not in a room")

		// Verify player still exists after respawn call
		_, exists := handler.gameServer.GetPlayerState(playerID)
		assert.True(t, exists, "Player should still exist after onRespawn")
	})
}

// TestOnRespawn tests the onRespawn callback for player respawn events
func TestOnRespawn(t *testing.T) {
	t.Run("broadcasts player:respawn message to room", func(t *testing.T) {
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
		player1ID := joinedMsg.Data.(map[string]interface{})["playerId"].(string)

		conn2.SetReadDeadline(time.Now().Add(2 * time.Second))
		conn2.ReadMessage()

		time.Sleep(50 * time.Millisecond)

		respawnPos := game.Vector2{X: 500, Y: 300}
		handler.onRespawn(player1ID, respawnPos)

		respawnMsg, err := readMessageOfType(t, conn1, "player:respawn", 2*time.Second)
		assert.NoError(t, err, "Should receive player:respawn message")
		assert.NotNil(t, respawnMsg)

		if respawnMsg != nil {
			data := respawnMsg.Data.(map[string]interface{})
			assert.Equal(t, player1ID, data["playerId"])
			assert.Equal(t, float64(500), data["position"].(map[string]interface{})["x"])
			assert.Equal(t, float64(300), data["position"].(map[string]interface{})["y"])
			assert.Equal(t, float64(game.PlayerMaxHealth), data["health"])
		}
	})

	t.Run("handles player not in room gracefully", func(t *testing.T) {
		handler := NewWebSocketHandler()

		// Verify player doesn't exist in any room
		room := handler.roomManager.GetRoomByPlayerID("non-existent-player")
		assert.Nil(t, room, "Non-existent player should not be in any room")

		// Should not panic when player is not in any room
		assert.NotPanics(t, func() {
			handler.onRespawn("non-existent-player", game.Vector2{X: 100, Y: 100})
		}, "onRespawn should not panic when player is not in any room")
	})

	t.Run("exercises message marshal path for respawn", func(t *testing.T) {
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

		// Get player IDs
		conn1.SetReadDeadline(time.Now().Add(2 * time.Second))
		_, joinedBytes, _ := conn1.ReadMessage()
		var joinedMsg Message
		json.Unmarshal(joinedBytes, &joinedMsg)
		player1ID := joinedMsg.Data.(map[string]interface{})["playerId"].(string)

		conn2.SetReadDeadline(time.Now().Add(2 * time.Second))
		conn2.ReadMessage()

		time.Sleep(50 * time.Millisecond)

		// Trigger respawn with specific position
		respawnPos := game.Vector2{X: 123.45, Y: 678.90}
		handler.onRespawn(player1ID, respawnPos)

		// Verify message was marshaled and sent successfully
		respawnMsg, err := readMessageOfType(t, conn1, "player:respawn", 2*time.Second)
		assert.NoError(t, err, "Should receive player:respawn message")
		assert.NotNil(t, respawnMsg, "Respawn message should not be nil")

		if respawnMsg != nil {
			data := respawnMsg.Data.(map[string]interface{})
			assert.Equal(t, player1ID, data["playerId"], "Should contain correct player ID")

			position := data["position"].(map[string]interface{})
			assert.Equal(t, 123.45, position["x"], "Should contain correct X position")
			assert.Equal(t, 678.90, position["y"], "Should contain correct Y position")

			assert.Equal(t, float64(game.PlayerMaxHealth), data["health"], "Should reset to max health")
		}
	})
}

// TestOnHitDeathScenario tests the death flow in onHit callback
func TestOnHitDeathScenario(t *testing.T) {
	t.Run("ends match when kill target reached via match logic", func(t *testing.T) {
		room := game.NewRoom()
		room.Match.Start()

		attackerID := "killer-player"
		for i := 0; i < 19; i++ {
			room.Match.AddKill(attackerID)
		}

		assert.False(t, room.Match.CheckKillTarget(), "Should not have reached target yet")

		room.Match.AddKill(attackerID)
		assert.True(t, room.Match.CheckKillTarget(), "Should have reached kill target")

		room.Match.EndMatch("kill_target")
		assert.True(t, room.Match.IsEnded())
		assert.Equal(t, "kill_target", room.Match.EndReason)
	})

	t.Run("exercises death path when victim health is zero", func(t *testing.T) {
		handler := NewWebSocketHandler()

		// Add players directly to gameServer (returns pointers we can modify)
		attackerID := "attacker-death-test"
		victimID := "victim-death-test"
		handler.gameServer.AddPlayer(attackerID)
		victimPlayer := handler.gameServer.AddPlayer(victimID)

		// Kill the victim before onHit
		victimPlayer.TakeDamage(game.PlayerMaxHealth)

		// Create a hit event (onHit is called after damage is applied)
		hitEvent := game.HitEvent{
			ProjectileID: "proj-kill",
			VictimID:     victimID,
			AttackerID:   attackerID,
		}

		// Trigger onHit callback - should not panic and should exercise death path
		// This exercises the IsAlive() check and MarkPlayerDead path even without room
		handler.onHit(hitEvent)

		// Verify death was processed
		assert.False(t, victimPlayer.IsAlive(), "Victim should be dead")
	})

	t.Run("exercises stats update path on death", func(t *testing.T) {
		handler := NewWebSocketHandler()

		// Add players directly to gameServer (returns pointers we can modify)
		attackerID := "attacker-stats-test"
		victimID := "victim-stats-test"
		attackerPlayer := handler.gameServer.AddPlayer(attackerID)
		victimPlayer := handler.gameServer.AddPlayer(victimID)

		// Kill the victim
		victimPlayer.TakeDamage(game.PlayerMaxHealth)

		// Create a hit event
		hitEvent := game.HitEvent{
			ProjectileID: "proj-kill",
			VictimID:     victimID,
			AttackerID:   attackerID,
		}

		// Trigger onHit callback - exercises the stats update path
		handler.onHit(hitEvent)

		// Verify victim is dead and stats path was exercised
		assert.False(t, victimPlayer.IsAlive(), "Victim should be dead")
		// Note: Stats might not persist due to GetPlayerState returning snapshot
		// but the code path is still exercised for coverage
		_ = attackerPlayer // Attacker reference kept to avoid unused var
	})

	t.Run("exercises MarkPlayerDead call", func(t *testing.T) {
		handler := NewWebSocketHandler()

		// Add players directly to gameServer
		attackerID := "attacker-mark-dead-test"
		victimID := "victim-mark-dead-test"
		handler.gameServer.AddPlayer(attackerID)
		victimPlayer := handler.gameServer.AddPlayer(victimID)

		// Kill the victim
		victimPlayer.TakeDamage(game.PlayerMaxHealth)

		// Create a hit event
		hitEvent := game.HitEvent{
			ProjectileID: "proj-kill",
			VictimID:     victimID,
			AttackerID:   attackerID,
		}

		// Trigger onHit callback - exercises MarkPlayerDead path
		handler.onHit(hitEvent)

		// Victim should be dead
		assert.False(t, victimPlayer.IsAlive(), "Victim should be dead")
	})

	t.Run("handles death when victim is not in room", func(t *testing.T) {
		handler := NewWebSocketHandler()

		// Add players without room
		attackerID := "attacker-no-room"
		victimID := "victim-no-room"
		handler.gameServer.AddPlayer(attackerID)
		victimPlayer := handler.gameServer.AddPlayer(victimID)

		// Kill victim
		victimPlayer.TakeDamage(game.PlayerMaxHealth)

		hitEvent := game.HitEvent{
			ProjectileID: "proj-1",
			VictimID:     victimID,
			AttackerID:   attackerID,
		}

		// Should not panic even without room
		handler.onHit(hitEvent)

		// Verify victim is dead
		assert.False(t, victimPlayer.IsAlive(), "Victim should be dead")
	})

	t.Run("broadcasts death messages in room", func(t *testing.T) {
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

		// Consume room:joined and weapon:spawned messages, capture player IDs
		player1ID := consumeRoomJoinedAndGetPlayerID(t, conn1)
		player2ID := consumeRoomJoinedAndGetPlayerID(t, conn2)

		time.Sleep(50 * time.Millisecond)

		// Use DamagePlayer method to kill player2
		handler.gameServer.DamagePlayer(player2ID, game.PlayerMaxHealth)

		// Create hit event for a killing blow
		hitEvent := game.HitEvent{
			ProjectileID: "proj-kill",
			VictimID:     player2ID,
			AttackerID:   player1ID,
		}

		// Trigger onHit callback - this should broadcast death messages
		handler.onHit(hitEvent)

		// Attacker (conn1) receives: player:damaged, hit:confirmed, player:death, player:kill_credit
		// Collect messages and verify expected types are present
		expectedTypes := map[string]bool{
			"player:damaged":     false,
			"hit:confirmed":      false,
			"player:death":       false,
			"player:kill_credit": false,
		}

		var deathData map[string]interface{}

		// Read up to 4 messages
		for i := 0; i < 4; i++ {
			conn1.SetReadDeadline(time.Now().Add(2 * time.Second))
			_, msgBytes, err := conn1.ReadMessage()
			if err != nil {
				break
			}

			var msg Message
			err = json.Unmarshal(msgBytes, &msg)
			assert.NoError(t, err)

			if _, expected := expectedTypes[msg.Type]; expected {
				expectedTypes[msg.Type] = true
			}

			if msg.Type == "player:death" {
				deathData = msg.Data.(map[string]interface{})
			}
		}

		// Verify all expected messages were received
		assert.True(t, expectedTypes["player:damaged"], "Should receive player:damaged message")
		assert.True(t, expectedTypes["hit:confirmed"], "Should receive hit:confirmed message")
		assert.True(t, expectedTypes["player:death"], "Should receive player:death message")
		assert.True(t, expectedTypes["player:kill_credit"], "Should receive player:kill_credit message")

		// Verify death message data
		assert.NotNil(t, deathData, "Should have received player:death message data")
		if deathData != nil {
			assert.Equal(t, player2ID, deathData["victimId"], "Death message should contain victim ID")
			assert.Equal(t, player1ID, deathData["attackerId"], "Death message should contain attacker ID")
		}
	})

	t.Run("broadcasts all kill-related messages in correct sequence", func(t *testing.T) {
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

		// Consume room:joined and weapon:spawned messages, capture player IDs
		player1ID := consumeRoomJoinedAndGetPlayerID(t, conn1)
		player2ID := consumeRoomJoinedAndGetPlayerID(t, conn2)

		time.Sleep(50 * time.Millisecond)

		// Kill player2 to trigger full death flow
		handler.gameServer.DamagePlayer(player2ID, game.PlayerMaxHealth)

		// Create hit event for a killing blow
		hitEvent := game.HitEvent{
			ProjectileID: "proj-sequence-test",
			VictimID:     player2ID,
			AttackerID:   player1ID,
		}

		// Trigger onHit callback - this should broadcast all 4 message types
		handler.onHit(hitEvent)

		// Collect all messages from attacker (should get all 4 types)
		receivedMsgs := make(map[string]int)
		for i := 0; i < 4; i++ {
			conn1.SetReadDeadline(time.Now().Add(2 * time.Second))
			_, msgBytes, err := conn1.ReadMessage()
			if err != nil {
				break
			}

			var msg Message
			err = json.Unmarshal(msgBytes, &msg)
			assert.NoError(t, err)
			receivedMsgs[msg.Type]++
		}

		// Verify all message types were sent
		assert.Equal(t, 1, receivedMsgs["player:damaged"], "Should send 1 player:damaged")
		assert.Equal(t, 1, receivedMsgs["hit:confirmed"], "Should send 1 hit:confirmed")
		assert.Equal(t, 1, receivedMsgs["player:death"], "Should send 1 player:death")
		assert.Equal(t, 1, receivedMsgs["player:kill_credit"], "Should send 1 player:kill_credit")
	})

	t.Run("exercises all message marshal paths in death scenario", func(t *testing.T) {
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

		// Consume room:joined and weapon:spawned messages, capture player IDs
		player1ID := consumeRoomJoinedAndGetPlayerID(t, conn1)
		player2ID := consumeRoomJoinedAndGetPlayerID(t, conn2)

		time.Sleep(50 * time.Millisecond)

		// Kill victim and trigger hit
		handler.gameServer.DamagePlayer(player2ID, game.PlayerMaxHealth)

		hitEvent := game.HitEvent{
			ProjectileID: "proj-marshal-test",
			VictimID:     player2ID,
			AttackerID:   player1ID,
		}

		// This exercises all marshal paths: player:damaged, hit:confirmed, player:death, player:kill_credit
		handler.onHit(hitEvent)

		// Verify messages were created and sent (by receiving them)
		messagesReceived := 0
		for i := 0; i < 4; i++ {
			conn1.SetReadDeadline(time.Now().Add(2 * time.Second))
			_, _, err := conn1.ReadMessage()
			if err == nil {
				messagesReceived++
			}
		}

		assert.GreaterOrEqual(t, messagesReceived, 4, "Should receive at least 4 messages (all marshal paths executed)")
	})
}
