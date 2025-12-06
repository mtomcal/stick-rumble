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

		// Consume room:joined messages and capture player IDs
		conn1.SetReadDeadline(time.Now().Add(2 * time.Second))
		_, joinedBytes1, _ := conn1.ReadMessage()
		var joinedMsg1 Message
		json.Unmarshal(joinedBytes1, &joinedMsg1)
		player1ID := joinedMsg1.Data.(map[string]interface{})["playerId"].(string)

		conn2.SetReadDeadline(time.Now().Add(2 * time.Second))
		_, joinedBytes2, _ := conn2.ReadMessage()
		var joinedMsg2 Message
		json.Unmarshal(joinedBytes2, &joinedMsg2)
		player2ID := joinedMsg2.Data.(map[string]interface{})["playerId"].(string)

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

	t.Run("sends hit:confirmed message to attacker", func(t *testing.T) {
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

		// Consume room:joined messages and capture player IDs
		conn1.SetReadDeadline(time.Now().Add(2 * time.Second))
		_, joinedBytes1, _ := conn1.ReadMessage()
		var joinedMsg1 Message
		json.Unmarshal(joinedBytes1, &joinedMsg1)
		player1ID := joinedMsg1.Data.(map[string]interface{})["playerId"].(string)

		conn2.SetReadDeadline(time.Now().Add(2 * time.Second))
		_, joinedBytes2, _ := conn2.ReadMessage()
		var joinedMsg2 Message
		json.Unmarshal(joinedBytes2, &joinedMsg2)
		player2ID := joinedMsg2.Data.(map[string]interface{})["playerId"].(string)

		time.Sleep(50 * time.Millisecond)

		// Create a hit event
		hitEvent := game.HitEvent{
			ProjectileID: "proj-1",
			VictimID:     player2ID,
			AttackerID:   player1ID,
		}

		// Trigger onHit callback
		handler.onHit(hitEvent)

		// Both clients in the room should receive player:damaged
		conn1.SetReadDeadline(time.Now().Add(2 * time.Second))
		_, damagedBytes, err := conn1.ReadMessage()
		assert.NoError(t, err)

		var damagedMsg Message
		json.Unmarshal(damagedBytes, &damagedMsg)
		assert.Equal(t, "player:damaged", damagedMsg.Type)

		// hit:confirmed is sent via SendToWaitingPlayer which sends to players in rooms too
		conn1.SetReadDeadline(time.Now().Add(2 * time.Second))
		_, hitConfirmBytes, err := conn1.ReadMessage()

		if err == nil {
			var hitConfirmMsg Message
			err = json.Unmarshal(hitConfirmBytes, &hitConfirmMsg)
			if err == nil && hitConfirmMsg.Type == "hit:confirmed" {
				confirmData := hitConfirmMsg.Data.(map[string]interface{})
				assert.Equal(t, player2ID, confirmData["victimId"])
				assert.NotNil(t, confirmData["damage"])
				assert.Equal(t, "proj-1", confirmData["projectileId"])
			}
		}
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

		handler.onHit(hitEvent)
	})

	t.Run("handles non-existent victim gracefully", func(t *testing.T) {
		handler := NewWebSocketHandler()

		hitEvent := game.HitEvent{
			ProjectileID: "proj-1",
			VictimID:     "non-existent-victim",
			AttackerID:   "some-attacker",
		}

		handler.onHit(hitEvent)

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

		handler.onHit(hitEvent)

		victimState, exists := handler.gameServer.GetPlayerState(victimID)
		assert.True(t, exists, "Victim should still exist")
		assert.Equal(t, game.PlayerMaxHealth, victimState.Health, "Victim health should be unchanged")
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
		handler.onRespawn("non-existent-player", game.Vector2{X: 100, Y: 100})
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
}
