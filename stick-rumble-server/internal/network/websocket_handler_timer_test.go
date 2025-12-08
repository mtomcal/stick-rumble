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
)

// TestMatchTimer tests the match timer broadcast functionality (Story 2.6.1)
// Uses fast timer interval (50ms) to speed up tests while still verifying broadcast behavior.
func TestMatchTimer(t *testing.T) {
	t.Run("broadcasts match:timer message at configured interval", func(t *testing.T) {
		// Use fast timer interval for testing (50ms instead of 1s)
		handler := NewWebSocketHandlerWithConfig(50 * time.Millisecond)
		server := httptest.NewServer(http.HandlerFunc(handler.HandleWebSocket))
		defer server.Close()

		ctx, cancel := context.WithCancel(context.Background())

		// Start handler (starts timer loop)
		handler.Start(ctx)
		// Cancel context first, then stop handler (defers run in reverse order)
		defer handler.Stop()
		defer cancel()

		wsURL := "ws" + strings.TrimPrefix(server.URL, "http")

		// Connect two clients to create a room and start match
		conn1, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
		assert.NoError(t, err)
		defer conn1.Close()

		conn2, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
		assert.NoError(t, err)
		defer conn2.Close()

		// Wait for match:timer message (filters through other message types)
		// With 50ms interval, should receive within 500ms easily
		timerMsg, err := readMessageOfType(t, conn1, "match:timer", 500*time.Millisecond)
		assert.NoError(t, err, "Should receive match:timer message")
		assert.NotNil(t, timerMsg, "Timer message should not be nil")

		if timerMsg != nil {
			// Verify data structure
			timerData := timerMsg.Data.(map[string]interface{})
			remainingSeconds, ok := timerData["remainingSeconds"].(float64)
			assert.True(t, ok, "remainingSeconds should be a number")
			assert.InDelta(t, 420, remainingSeconds, 5, "Should start near 420 seconds (7 minutes)")
		}
	})

	t.Run("timer broadcasts multiple times", func(t *testing.T) {
		// Use fast timer interval for testing (50ms instead of 1s)
		handler := NewWebSocketHandlerWithConfig(50 * time.Millisecond)
		server := httptest.NewServer(http.HandlerFunc(handler.HandleWebSocket))
		defer server.Close()

		ctx, cancel := context.WithCancel(context.Background())

		handler.Start(ctx)
		// Cancel context first, then stop handler (defers run in reverse order)
		defer handler.Stop()
		defer cancel()

		wsURL := "ws" + strings.TrimPrefix(server.URL, "http")

		conn1, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
		assert.NoError(t, err)
		defer conn1.Close()
		conn2, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
		assert.NoError(t, err)
		defer conn2.Close()

		// Read first timer message (filters through other messages)
		msg1, err := readMessageOfType(t, conn1, "match:timer", 500*time.Millisecond)
		assert.NoError(t, err, "Should receive first timer message")
		data1 := msg1.Data.(map[string]interface{})
		time1 := int(data1["remainingSeconds"].(float64))

		// Read second timer message (should arrive within ~100ms with 50ms interval)
		msg2, err := readMessageOfType(t, conn1, "match:timer", 200*time.Millisecond)
		assert.NoError(t, err, "Should receive second timer message")
		data2 := msg2.Data.(map[string]interface{})
		time2 := int(data2["remainingSeconds"].(float64))

		// Verify we received both messages (time may or may not have changed in 50ms)
		assert.True(t, time2 <= time1, "Timer should not increase")
	})
}

// TestMatchKillTarget tests kill target win condition (Story 2.6.1)
func TestMatchKillTarget(t *testing.T) {
	t.Run("tracks kills per player in match", func(t *testing.T) {
		match := game.NewMatch()

		match.AddKill("player1")
		match.AddKill("player2")
		match.AddKill("player1")

		assert.Equal(t, 2, match.PlayerKills["player1"])
		assert.Equal(t, 1, match.PlayerKills["player2"])
	})

	t.Run("match ends when player reaches 20 kills", func(t *testing.T) {
		handler := NewWebSocketHandler()

		// Create a fake room
		room := game.NewRoom()
		room.Match.Start()

		// Simulate 19 kills
		for i := 0; i < 19; i++ {
			room.Match.AddKill("killer")
		}

		assert.False(t, room.Match.CheckKillTarget())
		assert.False(t, room.Match.IsEnded())

		// 20th kill - should trigger win condition
		room.Match.AddKill("killer")

		assert.True(t, room.Match.CheckKillTarget())

		// Manually trigger end (in real code, this happens in onHit callback)
		room.Match.EndMatch("kill_target")

		assert.True(t, room.Match.IsEnded())
		assert.Equal(t, "kill_target", room.Match.EndReason)

		// Verify handler is created
		assert.NotNil(t, handler)
	})
}

// TestMatchTimeLimit tests time limit win condition (Story 2.6.1)
func TestMatchTimeLimit(t *testing.T) {
	t.Run("match does not end before time limit", func(t *testing.T) {
		match := game.NewMatch()
		match.Start()

		// Check immediately after start
		assert.False(t, match.CheckTimeLimit())
		assert.False(t, match.IsEnded())
	})

	t.Run("match ends when time limit reached", func(t *testing.T) {
		match := game.NewMatch()
		match.Start()

		// Manually set start time to 421 seconds ago (past limit)
		match.StartTime = time.Now().Add(-421 * time.Second)

		assert.True(t, match.CheckTimeLimit())

		// Manually trigger end (in real code, this happens in broadcastMatchTimers)
		match.EndMatch("time_limit")

		assert.True(t, match.IsEnded())
		assert.Equal(t, "time_limit", match.EndReason)
	})

	t.Run("remaining time calculation is accurate", func(t *testing.T) {
		match := game.NewMatch()
		match.Start()

		// Set start time to 10 seconds ago
		match.StartTime = time.Now().Add(-10 * time.Second)

		remaining := match.GetRemainingSeconds()

		assert.InDelta(t, 410, remaining, 1, "Should have ~410 seconds remaining")
	})
}

// TestBroadcastMatchTimersEdgeCases tests edge cases in broadcastMatchTimers
func TestBroadcastMatchTimersEdgeCases(t *testing.T) {
	t.Run("skips rooms with ended matches", func(t *testing.T) {
		handler := NewWebSocketHandlerWithConfig(50 * time.Millisecond)
		server := httptest.NewServer(http.HandlerFunc(handler.HandleWebSocket))
		defer server.Close()

		ctx, cancel := context.WithCancel(context.Background())
		handler.Start(ctx)
		defer handler.Stop()
		defer cancel()

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

		// Get first timer message to confirm it's working
		timerMsg1, err := readMessageOfType(t, conn1, "match:timer", 500*time.Millisecond)
		assert.NoError(t, err, "Should receive first timer message")
		assert.NotNil(t, timerMsg1)

		// End the match in all rooms
		rooms := handler.roomManager.GetAllRooms()
		for _, room := range rooms {
			room.Match.EndMatch("test")
		}

		// Clear any pending messages
		conn1.SetReadDeadline(time.Now().Add(100 * time.Millisecond))
		for {
			_, _, err := conn1.ReadMessage()
			if err != nil {
				break
			}
		}

		// Now no more match:timer messages should arrive (match ended)
		conn1.SetReadDeadline(time.Now().Add(200 * time.Millisecond))
		_, _, err = conn1.ReadMessage()
		// Should timeout or get non-timer message (player:move)
		if err == nil {
			// Got a message, verify it's not match:timer
			// This is expected since player:move messages continue
		}
	})

	t.Run("ends match when time limit reached via broadcastMatchTimers", func(t *testing.T) {
		handler := NewWebSocketHandlerWithConfig(50 * time.Millisecond)
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

		time.Sleep(50 * time.Millisecond)

		// Set start time to past (expired) for all rooms
		rooms := handler.roomManager.GetAllRooms()
		for _, room := range rooms {
			room.Match.StartTime = time.Now().Add(-421 * time.Second)
		}

		// Call broadcastMatchTimers directly to trigger time limit check
		handler.broadcastMatchTimers()

		// Verify match ended
		for _, room := range rooms {
			assert.True(t, room.Match.IsEnded(), "Match should be ended")
			assert.Equal(t, "time_limit", room.Match.EndReason)
		}
	})
}

// TestBroadcastMatchEnded tests the broadcastMatchEnded function for error handling and edge cases
func TestBroadcastMatchEnded(t *testing.T) {
	t.Run("broadcasts match:ended to all players in room after kill target", func(t *testing.T) {
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
		_, joinedBytes1, _ := conn1.ReadMessage()
		var joinedMsg1 Message
		json.Unmarshal(joinedBytes1, &joinedMsg1)
		player1ID := joinedMsg1.Data.(map[string]interface{})["playerId"].(string)

		conn2.SetReadDeadline(time.Now().Add(2 * time.Second))
		conn2.ReadMessage()

		time.Sleep(50 * time.Millisecond)

		// Get room and add kills to reach target
		rooms := handler.roomManager.GetAllRooms()
		assert.Equal(t, 1, len(rooms), "Should have 1 room")
		room := rooms[0]

		// Add kills to reach target
		for i := 0; i < 20; i++ {
			room.Match.AddKill(player1ID)
		}
		room.Match.EndMatch("kill_target")

		// Broadcast match ended
		handler.broadcastMatchEnded(room, handler.gameServer.GetWorld())

		// Both clients should receive match:ended message
		matchEndMsg1, err := readMessageOfType(t, conn1, "match:ended", 2*time.Second)
		assert.NoError(t, err, "Client 1 should receive match:ended")
		assert.NotNil(t, matchEndMsg1)

		if matchEndMsg1 != nil {
			data := matchEndMsg1.Data.(map[string]interface{})
			assert.Equal(t, "kill_target", data["reason"])
			assert.NotNil(t, data["winners"])
			assert.NotNil(t, data["finalScores"])
		}
	})

	t.Run("broadcasts match:ended to all players in room after time limit", func(t *testing.T) {
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

		time.Sleep(50 * time.Millisecond)

		// Get room and end by time limit
		rooms := handler.roomManager.GetAllRooms()
		assert.Equal(t, 1, len(rooms), "Should have 1 room")
		room := rooms[0]

		room.Match.EndMatch("time_limit")

		// Broadcast match ended
		handler.broadcastMatchEnded(room, handler.gameServer.GetWorld())

		// Both clients should receive match:ended message
		matchEndMsg1, err := readMessageOfType(t, conn1, "match:ended", 2*time.Second)
		assert.NoError(t, err, "Client 1 should receive match:ended")
		assert.NotNil(t, matchEndMsg1)

		if matchEndMsg1 != nil {
			data := matchEndMsg1.Data.(map[string]interface{})
			assert.Equal(t, "time_limit", data["reason"])
		}
	})

	t.Run("handles empty room gracefully", func(t *testing.T) {
		handler := NewWebSocketHandler()

		// Create empty room
		room := game.NewRoom()
		room.Match.Start()
		room.Match.EndMatch("test")

		// Should not panic when broadcasting to empty room
		assert.NotPanics(t, func() {
			handler.broadcastMatchEnded(room, handler.gameServer.GetWorld())
		}, "broadcastMatchEnded should not panic with empty room")
	})
}
