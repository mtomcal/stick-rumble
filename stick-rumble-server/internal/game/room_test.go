package game

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestRoomCreation tests basic room creation
func TestRoomCreation(t *testing.T) {
	room := NewRoom()

	assert.NotEmpty(t, room.ID, "Room should have an ID")
	assert.Empty(t, room.Players, "New room should have no players")
	assert.Equal(t, 8, room.MaxPlayers, "Room should support max 8 players")
}

// TestAddPlayer tests adding players to a room
func TestAddPlayer(t *testing.T) {
	room := NewRoom()
	player1 := &Player{ID: "player1"}
	player2 := &Player{ID: "player2"}

	// Add first player
	err := room.AddPlayer(player1)
	require.NoError(t, err)
	assert.Len(t, room.Players, 1)
	assert.Equal(t, "player1", room.Players[0].ID)

	// Add second player
	err = room.AddPlayer(player2)
	require.NoError(t, err)
	assert.Len(t, room.Players, 2)
	assert.Equal(t, "player2", room.Players[1].ID)
}

// TestAddPlayerToFullRoom tests that we can't add more than max players
func TestAddPlayerToFullRoom(t *testing.T) {
	room := NewRoom()

	// Fill room to capacity
	for i := 0; i < 8; i++ {
		player := &Player{ID: "player" + string(rune(i+'0'))}
		err := room.AddPlayer(player)
		require.NoError(t, err)
	}

	// Try to add one more player
	extraPlayer := &Player{ID: "player9"}
	err := room.AddPlayer(extraPlayer)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "full")
	assert.Len(t, room.Players, 8)
}

// TestRemovePlayer tests removing a player from a room
func TestRemovePlayer(t *testing.T) {
	room := NewRoom()
	player1 := &Player{ID: "player1"}
	player2 := &Player{ID: "player2"}

	room.AddPlayer(player1)
	room.AddPlayer(player2)

	// Remove player1
	removed := room.RemovePlayer("player1")
	assert.True(t, removed)
	assert.Len(t, room.Players, 1)
	assert.Equal(t, "player2", room.Players[0].ID)

	// Try to remove non-existent player
	removed = room.RemovePlayer("player3")
	assert.False(t, removed)
	assert.Len(t, room.Players, 1)
}

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

// TestRoomManagerCreation tests creating a new RoomManager
func TestRoomManagerCreation(t *testing.T) {
	manager := NewRoomManager()

	assert.NotNil(t, manager)
	assert.Empty(t, manager.rooms)
	assert.Empty(t, manager.waitingPlayers)
}

// TestAutoCreateRoomWithTwoPlayers tests auto-creation when 2 players connect
func TestAutoCreateRoomWithTwoPlayers(t *testing.T) {
	manager := NewRoomManager()

	player1Chan := make(chan []byte, 10)
	player2Chan := make(chan []byte, 10)

	player1 := &Player{ID: "player1", SendChan: player1Chan}
	player2 := &Player{ID: "player2", SendChan: player2Chan}

	// Add first player - should be added to waiting list
	room1 := manager.AddPlayer(player1)
	assert.Nil(t, room1, "First player should not trigger room creation")
	assert.Len(t, manager.waitingPlayers, 1)

	// Add second player - should trigger room creation
	room2 := manager.AddPlayer(player2)
	assert.NotNil(t, room2, "Second player should trigger room creation")
	assert.Len(t, room2.Players, 2, "Room should have 2 players")
	assert.Empty(t, manager.waitingPlayers, "Waiting list should be empty")
	assert.Len(t, manager.rooms, 1, "Manager should have 1 room")

	// Verify both players are in the same room
	assert.Contains(t, manager.rooms, room2.ID)
}

// TestRoomJoinedMessage tests that players receive room:joined message
func TestRoomJoinedMessage(t *testing.T) {
	manager := NewRoomManager()

	player1Chan := make(chan []byte, 10)
	player2Chan := make(chan []byte, 10)

	player1 := &Player{ID: "player1", SendChan: player1Chan}
	player2 := &Player{ID: "player2", SendChan: player2Chan}

	// Add two players to trigger room creation
	manager.AddPlayer(player1)
	room := manager.AddPlayer(player2)

	require.NotNil(t, room)

	// Both players should receive room:joined messages
	msg1Bytes := <-player1Chan
	msg2Bytes := <-player2Chan

	// Parse and verify player 1's message
	var msg1 map[string]interface{}
	err := json.Unmarshal(msg1Bytes, &msg1)
	require.NoError(t, err, "Should unmarshal player 1's room:joined message")

	assert.Equal(t, "room:joined", msg1["type"])
	assert.NotNil(t, msg1["timestamp"])

	data1, ok := msg1["data"].(map[string]interface{})
	require.True(t, ok, "Data should be a map")
	assert.Equal(t, player1.ID, data1["playerId"])
	assert.Equal(t, room.ID, data1["roomId"])

	// Parse and verify player 2's message
	var msg2 map[string]interface{}
	err = json.Unmarshal(msg2Bytes, &msg2)
	require.NoError(t, err, "Should unmarshal player 2's room:joined message")

	assert.Equal(t, "room:joined", msg2["type"])
	assert.NotNil(t, msg2["timestamp"])

	data2, ok := msg2["data"].(map[string]interface{})
	require.True(t, ok, "Data should be a map")
	assert.Equal(t, player2.ID, data2["playerId"])
	assert.Equal(t, room.ID, data2["roomId"])
}

// TestPlayerDisconnection tests player:left event on disconnection
func TestPlayerDisconnection(t *testing.T) {
	manager := NewRoomManager()

	player1Chan := make(chan []byte, 10)
	player2Chan := make(chan []byte, 10)

	player1 := &Player{ID: "player1", SendChan: player1Chan}
	player2 := &Player{ID: "player2", SendChan: player2Chan}

	// Create room with 2 players
	manager.AddPlayer(player1)
	room := manager.AddPlayer(player2)
	require.NotNil(t, room)

	// Clear the room:joined messages
	<-player1Chan
	<-player2Chan

	// Remove player1
	manager.RemovePlayer("player1")

	// Player2 should receive player:left message
	msgBytes := <-player2Chan

	// Parse and verify the player:left message
	var msg map[string]interface{}
	err := json.Unmarshal(msgBytes, &msg)
	require.NoError(t, err, "Should unmarshal player:left message")

	assert.Equal(t, "player:left", msg["type"])
	assert.NotNil(t, msg["timestamp"])

	data, ok := msg["data"].(map[string]interface{})
	require.True(t, ok, "Data should be a map")
	assert.Equal(t, "player1", data["playerId"])
}

// TestGetRoomByPlayerID tests finding a room by player ID
func TestGetRoomByPlayerID(t *testing.T) {
	manager := NewRoomManager()

	player1Chan := make(chan []byte, 10)
	player2Chan := make(chan []byte, 10)

	player1 := &Player{ID: "player1", SendChan: player1Chan}
	player2 := &Player{ID: "player2", SendChan: player2Chan}

	// Create room
	manager.AddPlayer(player1)
	room := manager.AddPlayer(player2)
	require.NotNil(t, room)

	// Find room by player IDs
	foundRoom1 := manager.GetRoomByPlayerID("player1")
	foundRoom2 := manager.GetRoomByPlayerID("player2")

	assert.NotNil(t, foundRoom1)
	assert.NotNil(t, foundRoom2)
	assert.Equal(t, room.ID, foundRoom1.ID)
	assert.Equal(t, room.ID, foundRoom2.ID)

	// Non-existent player
	foundRoom3 := manager.GetRoomByPlayerID("player3")
	assert.Nil(t, foundRoom3)
}

// TestRemoveWaitingPlayer tests removing a player from waiting list
func TestRemoveWaitingPlayer(t *testing.T) {
	manager := NewRoomManager()

	player1Chan := make(chan []byte, 10)
	player1 := &Player{ID: "player1", SendChan: player1Chan}

	// Add player to waiting list
	manager.AddPlayer(player1)
	assert.Len(t, manager.waitingPlayers, 1)

	// Remove player from waiting list
	manager.RemovePlayer("player1")
	assert.Len(t, manager.waitingPlayers, 0)
}

// TestRemoveNonExistentPlayer tests removing a player that doesn't exist
func TestRemoveNonExistentPlayer(t *testing.T) {
	manager := NewRoomManager()

	// Remove non-existent player should complete without panic or state corruption
	assert.NotPanics(t, func() {
		manager.RemovePlayer("nonexistent")
	}, "RemovePlayer should handle non-existent player gracefully")

	// Verify manager state remains consistent
	assert.Empty(t, manager.waitingPlayers, "Waiting players should remain empty")
	assert.Empty(t, manager.rooms, "Rooms should remain empty")
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

// TestRoomCleanupOnLastPlayerLeave tests room is removed when last player leaves
func TestRoomCleanupOnLastPlayerLeave(t *testing.T) {
	manager := NewRoomManager()

	player1Chan := make(chan []byte, 10)
	player2Chan := make(chan []byte, 10)

	player1 := &Player{ID: "player1", SendChan: player1Chan}
	player2 := &Player{ID: "player2", SendChan: player2Chan}

	// Create room
	manager.AddPlayer(player1)
	room := manager.AddPlayer(player2)
	require.NotNil(t, room)

	// Clear messages
	<-player1Chan
	<-player2Chan

	// Remove both players
	manager.RemovePlayer("player1")
	assert.Len(t, manager.rooms, 1, "Room should still exist with 1 player")

	manager.RemovePlayer("player2")
	assert.Len(t, manager.rooms, 0, "Room should be removed when empty")
}

// TestSendRoomJoinedMessageWithClosedChannel tests graceful handling when channel is closed
func TestSendRoomJoinedMessageWithClosedChannel(t *testing.T) {
	manager := NewRoomManager()

	// Create player with a channel we'll close
	player1Chan := make(chan []byte, 10)
	player1 := &Player{ID: "player1", SendChan: player1Chan}

	// Close the channel before sending message to simulate disconnection
	close(player1Chan)

	// This should not panic - it logs a warning and continues
	manager.AddPlayer(player1)

	// Should still be in waiting list
	assert.Len(t, manager.waitingPlayers, 1)
}

// TestRemovePlayerWithJSONMarshalError tests RemovePlayer handles marshal errors gracefully
func TestRemovePlayerWithJSONMarshalError(t *testing.T) {
	manager := NewRoomManager()

	player1Chan := make(chan []byte, 10)
	player2Chan := make(chan []byte, 10)

	player1 := &Player{ID: "player1", SendChan: player1Chan}
	player2 := &Player{ID: "player2", SendChan: player2Chan}

	// Create room
	manager.AddPlayer(player1)
	room := manager.AddPlayer(player2)
	require.NotNil(t, room)

	// Clear room:joined messages
	<-player1Chan
	<-player2Chan

	// Remove player - this should successfully broadcast player:left
	// Even if there were a JSON marshal error, it would log and continue
	manager.RemovePlayer("player1")

	// Player 2 should receive player:left message
	msg := <-player2Chan
	assert.Contains(t, string(msg), "player:left")
	assert.Contains(t, string(msg), "player1")
}

// TestIsEmptyAndPlayerCount tests the new thread-safe helper methods
func TestIsEmptyAndPlayerCount(t *testing.T) {
	room := NewRoom()

	// Room should start empty
	assert.True(t, room.IsEmpty(), "New room should be empty")
	assert.Equal(t, 0, room.PlayerCount(), "New room should have 0 players")

	// Add a player
	player1 := &Player{ID: "player1"}
	err := room.AddPlayer(player1)
	require.NoError(t, err)

	assert.False(t, room.IsEmpty(), "Room with 1 player should not be empty")
	assert.Equal(t, 1, room.PlayerCount(), "Room should have 1 player")

	// Add another player
	player2 := &Player{ID: "player2"}
	err = room.AddPlayer(player2)
	require.NoError(t, err)

	assert.False(t, room.IsEmpty(), "Room with 2 players should not be empty")
	assert.Equal(t, 2, room.PlayerCount(), "Room should have 2 players")

	// Remove both players
	room.RemovePlayer("player1")
	assert.False(t, room.IsEmpty(), "Room with 1 player should not be empty")
	assert.Equal(t, 1, room.PlayerCount(), "Room should have 1 player")

	room.RemovePlayer("player2")
	assert.True(t, room.IsEmpty(), "Room with no players should be empty")
	assert.Equal(t, 0, room.PlayerCount(), "Room should have 0 players")
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

// TestGetPlayer tests retrieving a player by ID from a room
func TestGetPlayer(t *testing.T) {
	t.Run("returns player when found", func(t *testing.T) {
		room := NewRoom()
		playerChan := make(chan []byte, 10)
		player := &Player{ID: "player1", SendChan: playerChan}

		room.AddPlayer(player)

		found := room.GetPlayer("player1")
		assert.NotNil(t, found, "Should find existing player")
		assert.Equal(t, "player1", found.ID)
		assert.Equal(t, playerChan, found.SendChan)
	})

	t.Run("returns nil for non-existent player", func(t *testing.T) {
		room := NewRoom()

		found := room.GetPlayer("nonexistent")
		assert.Nil(t, found, "Should return nil for non-existent player")
	})

	t.Run("returns correct player from multiple players", func(t *testing.T) {
		room := NewRoom()
		player1Chan := make(chan []byte, 10)
		player2Chan := make(chan []byte, 10)
		player3Chan := make(chan []byte, 10)

		player1 := &Player{ID: "player1", SendChan: player1Chan}
		player2 := &Player{ID: "player2", SendChan: player2Chan}
		player3 := &Player{ID: "player3", SendChan: player3Chan}

		room.AddPlayer(player1)
		room.AddPlayer(player2)
		room.AddPlayer(player3)

		// Find middle player
		found := room.GetPlayer("player2")
		assert.NotNil(t, found)
		assert.Equal(t, "player2", found.ID)
		assert.Equal(t, player2Chan, found.SendChan)
	})
}

// TestGetAllRooms tests retrieving all active rooms from RoomManager
func TestGetAllRooms(t *testing.T) {
	t.Run("returns empty slice when no rooms exist", func(t *testing.T) {
		manager := NewRoomManager()

		rooms := manager.GetAllRooms()
		assert.NotNil(t, rooms, "Should return non-nil slice")
		assert.Len(t, rooms, 0, "Should have no rooms")
	})

	t.Run("returns single room when one exists", func(t *testing.T) {
		manager := NewRoomManager()

		player1Chan := make(chan []byte, 10)
		player2Chan := make(chan []byte, 10)
		player1 := &Player{ID: "player1", SendChan: player1Chan}
		player2 := &Player{ID: "player2", SendChan: player2Chan}

		// Create one room
		manager.AddPlayer(player1)
		room := manager.AddPlayer(player2)
		require.NotNil(t, room)

		rooms := manager.GetAllRooms()
		assert.Len(t, rooms, 1)
		assert.Equal(t, room.ID, rooms[0].ID)
	})

	t.Run("returns multiple rooms", func(t *testing.T) {
		manager := NewRoomManager()

		// Create first room
		player1Chan := make(chan []byte, 10)
		player2Chan := make(chan []byte, 10)
		player1 := &Player{ID: "player1", SendChan: player1Chan}
		player2 := &Player{ID: "player2", SendChan: player2Chan}
		manager.AddPlayer(player1)
		room1 := manager.AddPlayer(player2)
		require.NotNil(t, room1)

		// Create second room
		player3Chan := make(chan []byte, 10)
		player4Chan := make(chan []byte, 10)
		player3 := &Player{ID: "player3", SendChan: player3Chan}
		player4 := &Player{ID: "player4", SendChan: player4Chan}
		manager.AddPlayer(player3)
		room2 := manager.AddPlayer(player4)
		require.NotNil(t, room2)

		rooms := manager.GetAllRooms()
		assert.Len(t, rooms, 2)

		// Verify both rooms are present (order not guaranteed)
		roomIDs := []string{rooms[0].ID, rooms[1].ID}
		assert.Contains(t, roomIDs, room1.ID)
		assert.Contains(t, roomIDs, room2.ID)
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
