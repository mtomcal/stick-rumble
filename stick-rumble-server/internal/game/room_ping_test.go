package game

import (
	"testing"
	"time"
)

// TestPlayer_PingTracker verifies that Player has a PingTracker field
func TestPlayer_PingTracker(t *testing.T) {
	// Create a player with a ping tracker
	sendChan := make(chan []byte, 10)
	player := NewPlayer("test-player-1", sendChan)

	// Verify ping tracker is initialized
	if player.PingTracker == nil {
		t.Fatal("Player.PingTracker should be initialized")
	}

	// Verify initial RTT is 0
	rtt := player.PingTracker.GetRTT()
	if rtt != 0 {
		t.Errorf("Expected initial RTT 0ms, got %dms", rtt)
	}
}

// TestPlayer_RecordPing verifies RTT measurement via PingTracker
func TestPlayer_RecordPing(t *testing.T) {
	sendChan := make(chan []byte, 10)
	player := NewPlayer("test-player-1", sendChan)

	// Record a ping measurement
	player.PingTracker.RecordRTT(50 * time.Millisecond)

	// Verify RTT is recorded
	rtt := player.PingTracker.GetRTT()
	if rtt != 50 {
		t.Errorf("Expected RTT 50ms, got %dms", rtt)
	}
}

// TestPlayer_AverageRTT verifies RTT averaging over multiple measurements
func TestPlayer_AverageRTT(t *testing.T) {
	sendChan := make(chan []byte, 10)
	player := NewPlayer("test-player-1", sendChan)

	// Record multiple measurements
	player.PingTracker.RecordRTT(40 * time.Millisecond)
	player.PingTracker.RecordRTT(60 * time.Millisecond)

	// Average should be 50ms
	rtt := player.PingTracker.GetRTT()
	if rtt != 50 {
		t.Errorf("Expected average RTT 50ms, got %dms", rtt)
	}
}

// TestRoomManager_GetPlayerRTT verifies accessing player RTT from room manager
func TestRoomManager_GetPlayerRTT(t *testing.T) {
	rm := NewRoomManager()

	// Create two players (room requires 2 players)
	sendChan1 := make(chan []byte, 10)
	player1 := NewPlayer("test-player-1", sendChan1)

	sendChan2 := make(chan []byte, 10)
	player2 := NewPlayer("test-player-2", sendChan2)

	// Record RTT measurement for player1
	player1.PingTracker.RecordRTT(75 * time.Millisecond)

	// Add both players to room manager (creates a room)
	rm.AddPlayer(player1)
	rm.AddPlayer(player2)

	// Retrieve player from room
	room := rm.GetRoomByPlayerID("test-player-1")
	if room == nil {
		t.Fatal("Player should be in a room")
	}

	// Find player in room
	var foundPlayer *Player
	for _, p := range room.GetPlayers() {
		if p.ID == "test-player-1" {
			foundPlayer = p
			break
		}
	}

	if foundPlayer == nil {
		t.Fatal("Player not found in room")
	}

	// Verify RTT is accessible
	rtt := foundPlayer.PingTracker.GetRTT()
	if rtt != 75 {
		t.Errorf("Expected RTT 75ms, got %dms", rtt)
	}
}
