package game

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

// TestBroadcast tests broadcasting messages to all players in a room
func TestBroadcast(t *testing.T) {
	room := NewRoom()

	// Create mock players with channels to receive messages
	player1Chan := make(chan []byte, 10)
	player2Chan := make(chan []byte, 10)

	player1 := &Player{ID: "player1", SendChan: player1Chan}
	player2 := &Player{ID: "player2", SendChan: player2Chan}

	room.AddPlayer(player1)
	room.AddPlayer(player2)

	// Broadcast a message
	testMsg := []byte(`{"type":"test","data":"hello"}`)
	room.Broadcast(testMsg, "")

	// Both players should receive the message
	assert.Equal(t, testMsg, <-player1Chan)
	assert.Equal(t, testMsg, <-player2Chan)
}

// TestBroadcastExcludeSender tests that sender can be excluded from broadcast
func TestBroadcastExcludeSender(t *testing.T) {
	room := NewRoom()

	// Create mock players with channels
	player1Chan := make(chan []byte, 10)
	player2Chan := make(chan []byte, 10)

	player1 := &Player{ID: "player1", SendChan: player1Chan}
	player2 := &Player{ID: "player2", SendChan: player2Chan}

	room.AddPlayer(player1)
	room.AddPlayer(player2)

	// Broadcast excluding player1
	testMsg := []byte(`{"type":"test","data":"hello"}`)
	room.Broadcast(testMsg, "player1")

	// Only player2 should receive the message
	select {
	case msg := <-player1Chan:
		t.Errorf("Player1 should not receive message, but got: %s", msg)
	default:
		// Expected: no message for player1
	}

	assert.Equal(t, testMsg, <-player2Chan)
}

// TestBroadcastChannelFull tests broadcast when channel is full
func TestBroadcastChannelFull(t *testing.T) {
	room := NewRoom()

	// Create player with small buffer that we'll fill
	playerChan := make(chan []byte, 1)
	player := &Player{ID: "player1", SendChan: playerChan}

	room.AddPlayer(player)

	// Fill the channel
	playerChan <- []byte("filling")

	// Broadcast should not block (uses select with default)
	room.Broadcast([]byte("test message"), "")

	// Channel should still only have the first message
	assert.Len(t, playerChan, 1)
	msg := <-playerChan
	assert.Equal(t, []byte("filling"), msg)
}

// TestBroadcastToClosedChannel tests that broadcasting to a closed channel doesn't panic
func TestBroadcastToClosedChannel(t *testing.T) {
	room := NewRoom()

	// Create two players
	player1Chan := make(chan []byte, 10)
	player2Chan := make(chan []byte, 10)

	player1 := &Player{ID: "player1", SendChan: player1Chan}
	player2 := &Player{ID: "player2", SendChan: player2Chan}

	room.AddPlayer(player1)
	room.AddPlayer(player2)

	// Close player1's channel to simulate disconnection
	close(player1Chan)

	// Broadcast should not panic even with closed channel
	testMsg := []byte(`{"type":"test","data":"hello"}`)
	room.Broadcast(testMsg, "")

	// Player 2 should still receive the message
	select {
	case msg := <-player2Chan:
		assert.Equal(t, testMsg, msg)
	case <-time.After(1 * time.Second):
		t.Fatal("Player 2 should have received the message")
	}
}

// TestSendToWaitingPlayer tests sending messages to players not yet in rooms
func TestSendToWaitingPlayer(t *testing.T) {
	manager := NewRoomManager()

	playerChan := make(chan []byte, 10)
	player := &Player{ID: "player1", SendChan: playerChan}

	// Add player to waiting list
	manager.AddPlayer(player)
	assert.Len(t, manager.waitingPlayers, 1)

	// Send message to waiting player
	testMsg := []byte(`{"type":"test","data":"hello"}`)
	manager.SendToWaitingPlayer("player1", testMsg)

	// Player should receive the message
	select {
	case msg := <-playerChan:
		assert.Equal(t, testMsg, msg)
	case <-time.After(1 * time.Second):
		t.Fatal("Waiting player should have received the message")
	}
}

// TestSendToWaitingPlayerNotFound tests sending to non-existent waiting player
func TestSendToWaitingPlayerNotFound(t *testing.T) {
	manager := NewRoomManager()

	// Send message to non-existent player should not panic
	testMsg := []byte(`{"type":"test","data":"hello"}`)
	assert.NotPanics(t, func() {
		manager.SendToWaitingPlayer("nonexistent", testMsg)
	}, "SendToWaitingPlayer should handle non-existent player gracefully")
}

// TestSendToWaitingPlayerWithClosedChannel tests sending to player with closed channel
func TestSendToWaitingPlayerWithClosedChannel(t *testing.T) {
	manager := NewRoomManager()

	playerChan := make(chan []byte, 10)
	player := &Player{ID: "player1", SendChan: playerChan}

	// Add player to waiting list
	manager.AddPlayer(player)

	// Close the player's channel to simulate disconnection
	close(playerChan)

	// Send message should not panic (uses recover)
	testMsg := []byte(`{"type":"test","data":"hello"}`)
	assert.NotPanics(t, func() {
		manager.SendToWaitingPlayer("player1", testMsg)
	}, "SendToWaitingPlayer should handle closed channel gracefully")
}

// TestSendToWaitingPlayerWithFullChannel tests sending to player with full channel
func TestSendToWaitingPlayerWithFullChannel(t *testing.T) {
	manager := NewRoomManager()

	// Create player with small buffer that we'll fill
	playerChan := make(chan []byte, 1)
	player := &Player{ID: "player1", SendChan: playerChan}

	// Add player to waiting list
	manager.AddPlayer(player)

	// Fill the channel
	playerChan <- []byte("filling")

	// Send message should not block (uses select with default)
	testMsg := []byte(`{"type":"test","data":"hello"}`)
	assert.NotPanics(t, func() {
		manager.SendToWaitingPlayer("player1", testMsg)
	}, "SendToWaitingPlayer should handle full channel gracefully")

	// Channel should still only have the first message
	assert.Len(t, playerChan, 1)
	msg := <-playerChan
	assert.Equal(t, []byte("filling"), msg)
}

// TestSendToPlayer tests sending messages to any player (in room or waiting)
func TestSendToPlayer(t *testing.T) {
	t.Run("sends to player in room", func(t *testing.T) {
		manager := NewRoomManager()

		player1Chan := make(chan []byte, 10)
		player2Chan := make(chan []byte, 10)
		player1 := &Player{ID: "player1", SendChan: player1Chan}
		player2 := &Player{ID: "player2", SendChan: player2Chan}

		// Create a room with 2 players
		manager.AddPlayer(player1)
		manager.AddPlayer(player2)

		// Clear room:joined messages
		<-player1Chan
		<-player2Chan

		// Send message to player1 who is in the room
		testMsg := []byte(`{"type":"hit:confirmed","data":"test"}`)
		sent := manager.SendToPlayer("player1", testMsg)

		assert.True(t, sent, "SendToPlayer should return true for player in room")

		// Player1 should receive the message
		select {
		case msg := <-player1Chan:
			assert.Equal(t, testMsg, msg)
		case <-time.After(1 * time.Second):
			t.Fatal("Player in room should have received the message")
		}

		// Player2 should NOT receive the message (targeted send)
		select {
		case msg := <-player2Chan:
			t.Fatalf("Player2 should not receive message, but got: %s", msg)
		default:
			// Expected: no message for player2
		}
	})

	t.Run("sends to waiting player", func(t *testing.T) {
		manager := NewRoomManager()

		playerChan := make(chan []byte, 10)
		player := &Player{ID: "waiting-player", SendChan: playerChan}

		// Add single player (will be waiting)
		manager.AddPlayer(player)
		assert.Len(t, manager.waitingPlayers, 1)

		// Send message to waiting player
		testMsg := []byte(`{"type":"test","data":"hello"}`)
		sent := manager.SendToPlayer("waiting-player", testMsg)

		assert.True(t, sent, "SendToPlayer should return true for waiting player")

		// Player should receive the message
		select {
		case msg := <-playerChan:
			assert.Equal(t, testMsg, msg)
		case <-time.After(1 * time.Second):
			t.Fatal("Waiting player should have received the message")
		}
	})

	t.Run("returns false for non-existent player", func(t *testing.T) {
		manager := NewRoomManager()

		// Send message to non-existent player
		testMsg := []byte(`{"type":"test","data":"hello"}`)
		sent := manager.SendToPlayer("nonexistent", testMsg)

		assert.False(t, sent, "SendToPlayer should return false for non-existent player")
	})

	t.Run("handles closed channel gracefully for room player", func(t *testing.T) {
		manager := NewRoomManager()

		player1Chan := make(chan []byte, 10)
		player2Chan := make(chan []byte, 10)
		player1 := &Player{ID: "player1", SendChan: player1Chan}
		player2 := &Player{ID: "player2", SendChan: player2Chan}

		// Create a room
		manager.AddPlayer(player1)
		manager.AddPlayer(player2)

		// Clear room:joined messages
		<-player1Chan
		<-player2Chan

		// Close player1's channel
		close(player1Chan)

		// Send should not panic
		testMsg := []byte(`{"type":"test","data":"test"}`)
		assert.NotPanics(t, func() {
			manager.SendToPlayer("player1", testMsg)
		}, "SendToPlayer should handle closed channel gracefully")
	})

	t.Run("handles full channel gracefully for room player", func(t *testing.T) {
		manager := NewRoomManager()

		// Create player with small buffer
		player1Chan := make(chan []byte, 1)
		player2Chan := make(chan []byte, 10)
		player1 := &Player{ID: "player1", SendChan: player1Chan}
		player2 := &Player{ID: "player2", SendChan: player2Chan}

		// Create a room
		manager.AddPlayer(player1)
		manager.AddPlayer(player2)

		// Clear room:joined message from player2
		<-player2Chan

		// Player1's channel has room:joined (1 msg), now fill it
		// Channel is already full with room:joined message

		// Send should not block
		testMsg := []byte(`{"type":"test","data":"test"}`)
		assert.NotPanics(t, func() {
			manager.SendToPlayer("player1", testMsg)
		}, "SendToPlayer should handle full channel gracefully")

		// Channel should still only have the room:joined message
		assert.Len(t, player1Chan, 1)
	})
}

// TestBroadcastToAll tests broadcasting messages to all players (rooms and waiting)
func TestBroadcastToAll(t *testing.T) {
	t.Run("broadcasts to players in rooms", func(t *testing.T) {
		manager := NewRoomManager()

		player1Chan := make(chan []byte, 10)
		player2Chan := make(chan []byte, 10)
		player1 := &Player{ID: "player1", SendChan: player1Chan}
		player2 := &Player{ID: "player2", SendChan: player2Chan}

		// Create a room
		manager.AddPlayer(player1)
		manager.AddPlayer(player2)

		// Clear room:joined messages
		<-player1Chan
		<-player2Chan

		// Broadcast to all
		testMsg := []byte(`{"type":"test","data":"broadcast to all"}`)
		manager.BroadcastToAll(testMsg)

		// Both players should receive the message
		select {
		case msg := <-player1Chan:
			assert.Equal(t, testMsg, msg)
		case <-time.After(1 * time.Second):
			t.Fatal("Player1 should have received the broadcast")
		}

		select {
		case msg := <-player2Chan:
			assert.Equal(t, testMsg, msg)
		case <-time.After(1 * time.Second):
			t.Fatal("Player2 should have received the broadcast")
		}
	})

	t.Run("broadcasts to waiting players", func(t *testing.T) {
		manager := NewRoomManager()

		playerChan := make(chan []byte, 10)
		player := &Player{ID: "waiting-player", SendChan: playerChan}

		// Add single player (will be waiting)
		manager.AddPlayer(player)
		assert.Len(t, manager.waitingPlayers, 1)

		// Broadcast to all
		testMsg := []byte(`{"type":"test","data":"broadcast to waiting"}`)
		manager.BroadcastToAll(testMsg)

		// Waiting player should receive the message
		select {
		case msg := <-playerChan:
			assert.Equal(t, testMsg, msg)
		case <-time.After(1 * time.Second):
			t.Fatal("Waiting player should have received the broadcast")
		}
	})

	t.Run("broadcasts to both room players and waiting players", func(t *testing.T) {
		manager := NewRoomManager()

		// Create room with 2 players
		player1Chan := make(chan []byte, 10)
		player2Chan := make(chan []byte, 10)
		player1 := &Player{ID: "player1", SendChan: player1Chan}
		player2 := &Player{ID: "player2", SendChan: player2Chan}
		manager.AddPlayer(player1)
		manager.AddPlayer(player2)

		// Clear room:joined messages
		<-player1Chan
		<-player2Chan

		// Add waiting player
		waitingChan := make(chan []byte, 10)
		waitingPlayer := &Player{ID: "waiting", SendChan: waitingChan}
		manager.AddPlayer(waitingPlayer)

		// Broadcast to all
		testMsg := []byte(`{"type":"test","data":"broadcast to everyone"}`)
		manager.BroadcastToAll(testMsg)

		// All players should receive the message
		select {
		case msg := <-player1Chan:
			assert.Equal(t, testMsg, msg)
		case <-time.After(1 * time.Second):
			t.Fatal("Player1 should have received the broadcast")
		}

		select {
		case msg := <-player2Chan:
			assert.Equal(t, testMsg, msg)
		case <-time.After(1 * time.Second):
			t.Fatal("Player2 should have received the broadcast")
		}

		select {
		case msg := <-waitingChan:
			assert.Equal(t, testMsg, msg)
		case <-time.After(1 * time.Second):
			t.Fatal("Waiting player should have received the broadcast")
		}
	})

	t.Run("handles closed channel gracefully", func(t *testing.T) {
		manager := NewRoomManager()

		playerChan := make(chan []byte, 10)
		player := &Player{ID: "player1", SendChan: playerChan}

		// Add player to waiting
		manager.AddPlayer(player)

		// Close the channel
		close(playerChan)

		// Broadcast should not panic
		testMsg := []byte(`{"type":"test","data":"test"}`)
		assert.NotPanics(t, func() {
			manager.BroadcastToAll(testMsg)
		}, "BroadcastToAll should handle closed channel gracefully")
	})

	t.Run("handles full channel gracefully", func(t *testing.T) {
		manager := NewRoomManager()

		// Create player with small buffer
		playerChan := make(chan []byte, 1)
		player := &Player{ID: "player1", SendChan: playerChan}

		// Add player to waiting
		manager.AddPlayer(player)

		// Fill the channel
		playerChan <- []byte("filling")

		// Broadcast should not block
		testMsg := []byte(`{"type":"test","data":"test"}`)
		assert.NotPanics(t, func() {
			manager.BroadcastToAll(testMsg)
		}, "BroadcastToAll should handle full channel gracefully")

		// Channel should still only have the first message
		assert.Len(t, playerChan, 1)
	})

	t.Run("broadcasts to empty manager without error", func(t *testing.T) {
		manager := NewRoomManager()

		// Broadcast to empty manager should not panic
		testMsg := []byte(`{"type":"test","data":"test"}`)
		assert.NotPanics(t, func() {
			manager.BroadcastToAll(testMsg)
		}, "BroadcastToAll should handle empty manager gracefully")
	})
}
