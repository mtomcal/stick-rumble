package game

import (
	"testing"

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
	msg1 := <-player1Chan
	msg2 := <-player2Chan

	assert.Contains(t, string(msg1), "room:joined")
	assert.Contains(t, string(msg1), player1.ID)
	assert.Contains(t, string(msg1), room.ID)

	assert.Contains(t, string(msg2), "room:joined")
	assert.Contains(t, string(msg2), player2.ID)
	assert.Contains(t, string(msg2), room.ID)
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
	msg := <-player2Chan
	assert.Contains(t, string(msg), "player:left")
	assert.Contains(t, string(msg), "player1")
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

	// Try to remove non-existent player (should not panic)
	manager.RemovePlayer("nonexistent")

	// Verify no issues occurred
	assert.Empty(t, manager.waitingPlayers)
	assert.Empty(t, manager.rooms)
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
