package game

import (
	"testing"
	"time"
)

// TestNewPositionHistory verifies PositionHistory initialization
func TestNewPositionHistory(t *testing.T) {
	history := NewPositionHistory()

	if history == nil {
		t.Fatal("NewPositionHistory() returned nil")
	}

	// Verify no historical positions initially
	playerID := "player1"
	pos, found := history.GetPositionAt(playerID, time.Now())
	if found {
		t.Errorf("Expected no position for new player, got position: %+v", pos)
	}
}

// TestPositionHistory_SingleSnapshot verifies recording a single position snapshot
func TestPositionHistory_SingleSnapshot(t *testing.T) {
	history := NewPositionHistory()
	playerID := "player1"
	position := Vector2{X: 100, Y: 200}
	timestamp := time.Now()

	// Record a snapshot
	history.RecordSnapshot(playerID, position, timestamp)

	// Retrieve the exact snapshot
	retrievedPos, found := history.GetPositionAt(playerID, timestamp)
	if !found {
		t.Fatal("Expected to find position snapshot")
	}

	if retrievedPos.X != position.X || retrievedPos.Y != position.Y {
		t.Errorf("Expected position %+v, got %+v", position, retrievedPos)
	}
}

// TestPositionHistory_MultipleSnapshots verifies storing multiple snapshots
func TestPositionHistory_MultipleSnapshots(t *testing.T) {
	history := NewPositionHistory()
	playerID := "player1"
	baseTime := time.Now()

	// Record 5 snapshots at 16ms intervals (60Hz)
	snapshots := []struct {
		position Vector2
		time     time.Time
	}{
		{Vector2{X: 100, Y: 100}, baseTime},
		{Vector2{X: 110, Y: 105}, baseTime.Add(16 * time.Millisecond)},
		{Vector2{X: 120, Y: 110}, baseTime.Add(32 * time.Millisecond)},
		{Vector2{X: 130, Y: 115}, baseTime.Add(48 * time.Millisecond)},
		{Vector2{X: 140, Y: 120}, baseTime.Add(64 * time.Millisecond)},
	}

	for _, snap := range snapshots {
		history.RecordSnapshot(playerID, snap.position, snap.time)
	}

	// Verify we can retrieve all snapshots
	for _, snap := range snapshots {
		retrievedPos, found := history.GetPositionAt(playerID, snap.time)
		if !found {
			t.Fatalf("Expected to find position at time %v", snap.time)
		}

		if retrievedPos.X != snap.position.X || retrievedPos.Y != snap.position.Y {
			t.Errorf("Expected position %+v at time %v, got %+v", snap.position, snap.time, retrievedPos)
		}
	}
}

// TestPositionHistory_CircularBuffer verifies buffer wraps around after 60 snapshots
func TestPositionHistory_CircularBuffer(t *testing.T) {
	history := NewPositionHistory()
	playerID := "player1"
	baseTime := time.Now()

	// Record 70 snapshots (buffer size is 60, so first 10 should be overwritten)
	for i := 0; i < 70; i++ {
		position := Vector2{X: float64(i * 10), Y: float64(i * 5)}
		timestamp := baseTime.Add(time.Duration(i*16) * time.Millisecond)
		history.RecordSnapshot(playerID, position, timestamp)
	}

	// First 10 snapshots should be overwritten (out of buffer)
	for i := 0; i < 10; i++ {
		timestamp := baseTime.Add(time.Duration(i*16) * time.Millisecond)
		_, found := history.GetPositionAt(playerID, timestamp)
		if found {
			t.Errorf("Expected snapshot %d to be overwritten, but it was found", i)
		}
	}

	// Last 60 snapshots should still be available
	for i := 10; i < 70; i++ {
		expectedPos := Vector2{X: float64(i * 10), Y: float64(i * 5)}
		timestamp := baseTime.Add(time.Duration(i*16) * time.Millisecond)
		retrievedPos, found := history.GetPositionAt(playerID, timestamp)
		if !found {
			t.Fatalf("Expected to find snapshot %d", i)
		}

		if retrievedPos.X != expectedPos.X || retrievedPos.Y != expectedPos.Y {
			t.Errorf("Snapshot %d: expected position %+v, got %+v", i, expectedPos, retrievedPos)
		}
	}
}

// TestPositionHistory_Interpolation verifies interpolation between snapshots
func TestPositionHistory_Interpolation(t *testing.T) {
	history := NewPositionHistory()
	playerID := "player1"
	baseTime := time.Now()

	// Record two snapshots 100ms apart
	history.RecordSnapshot(playerID, Vector2{X: 100, Y: 100}, baseTime)
	history.RecordSnapshot(playerID, Vector2{X: 200, Y: 150}, baseTime.Add(100*time.Millisecond))

	// Query position halfway between (50ms later)
	queryTime := baseTime.Add(50 * time.Millisecond)
	interpolatedPos, found := history.GetPositionAt(playerID, queryTime)
	if !found {
		t.Fatal("Expected to find interpolated position")
	}

	// Expected interpolated position: (150, 125)
	expectedX := 150.0
	expectedY := 125.0

	// Allow small floating point tolerance
	tolerance := 0.1
	if abs(interpolatedPos.X-expectedX) > tolerance {
		t.Errorf("Expected X=%.1f, got X=%.1f", expectedX, interpolatedPos.X)
	}
	if abs(interpolatedPos.Y-expectedY) > tolerance {
		t.Errorf("Expected Y=%.1f, got Y=%.1f", expectedY, interpolatedPos.Y)
	}
}

// abs returns the absolute value of a float64
func abs(x float64) float64 {
	if x < 0 {
		return -x
	}
	return x
}

// TestPositionHistory_NoFutureSnapshots verifies querying future time returns no position
func TestPositionHistory_NoFutureSnapshots(t *testing.T) {
	history := NewPositionHistory()
	playerID := "player1"
	baseTime := time.Now()

	// Record a snapshot at current time
	history.RecordSnapshot(playerID, Vector2{X: 100, Y: 100}, baseTime)

	// Query position in the future
	futureTime := baseTime.Add(1 * time.Second)
	_, found := history.GetPositionAt(playerID, futureTime)
	if found {
		t.Error("Expected no position for future timestamp")
	}
}

// TestPositionHistory_OldSnapshot verifies querying very old time returns no position
func TestPositionHistory_OldSnapshot(t *testing.T) {
	history := NewPositionHistory()
	playerID := "player1"
	baseTime := time.Now()

	// Record a snapshot at current time
	history.RecordSnapshot(playerID, Vector2{X: 100, Y: 100}, baseTime)

	// Query position way before first snapshot (outside buffer)
	oldTime := baseTime.Add(-2 * time.Second)
	_, found := history.GetPositionAt(playerID, oldTime)
	if found {
		t.Error("Expected no position for timestamp before buffer (too old)")
	}
}

// TestPositionHistory_MultiplePlayer verifies tracking multiple players independently
func TestPositionHistory_MultiplePlayers(t *testing.T) {
	history := NewPositionHistory()
	baseTime := time.Now()

	// Record snapshots for player1
	history.RecordSnapshot("player1", Vector2{X: 100, Y: 100}, baseTime)
	history.RecordSnapshot("player1", Vector2{X: 200, Y: 200}, baseTime.Add(100*time.Millisecond))

	// Record snapshots for player2
	history.RecordSnapshot("player2", Vector2{X: 300, Y: 300}, baseTime)
	history.RecordSnapshot("player2", Vector2{X: 400, Y: 400}, baseTime.Add(100*time.Millisecond))

	// Verify player1's position
	pos1, found1 := history.GetPositionAt("player1", baseTime)
	if !found1 {
		t.Fatal("Expected to find player1's position")
	}
	if pos1.X != 100 || pos1.Y != 100 {
		t.Errorf("Expected player1 position (100, 100), got (%f, %f)", pos1.X, pos1.Y)
	}

	// Verify player2's position
	pos2, found2 := history.GetPositionAt("player2", baseTime)
	if !found2 {
		t.Fatal("Expected to find player2's position")
	}
	if pos2.X != 300 || pos2.Y != 300 {
		t.Errorf("Expected player2 position (300, 300), got (%f, %f)", pos2.X, pos2.Y)
	}
}

// TestPositionHistory_ThreadSafety verifies concurrent access to position history
func TestPositionHistory_ThreadSafety(t *testing.T) {
	history := NewPositionHistory()
	baseTime := time.Now()

	// First, record some baseline snapshots sequentially
	for i := 0; i < 5; i++ {
		position := Vector2{X: float64(i * 10), Y: float64(i * 10)}
		timestamp := baseTime.Add(time.Duration(i*16) * time.Millisecond)
		history.RecordSnapshot("player1", position, timestamp)
	}

	// Spawn 10 goroutines that read/write concurrently
	done := make(chan bool, 20)

	// 10 writers
	for i := 0; i < 10; i++ {
		go func(index int) {
			playerID := "player1"
			position := Vector2{X: float64((index + 5) * 10), Y: float64((index + 5) * 10)}
			timestamp := baseTime.Add(time.Duration((index+5)*16) * time.Millisecond)
			history.RecordSnapshot(playerID, position, timestamp)
			done <- true
		}(i)
	}

	// 10 readers
	for i := 0; i < 10; i++ {
		go func(index int) {
			timestamp := baseTime.Add(time.Duration(index*16) * time.Millisecond)
			_, _ = history.GetPositionAt("player1", timestamp)
			done <- true
		}(i)
	}

	// Wait for all goroutines to complete
	for i := 0; i < 20; i++ {
		<-done
	}

	// Verify we can still read one of the baseline snapshots (proves thread safety)
	baselineTimestamp := baseTime.Add(2 * 16 * time.Millisecond)
	_, found := history.GetPositionAt("player1", baselineTimestamp)
	if !found {
		t.Error("Expected to find baseline snapshot after concurrent access")
	}

	// If we reach here without panics, thread safety is validated
}

// TestPositionHistory_ExactTimestampMatch verifies exact timestamp matching
func TestPositionHistory_ExactTimestampMatch(t *testing.T) {
	history := NewPositionHistory()
	playerID := "player1"
	timestamp := time.Now()
	position := Vector2{X: 150, Y: 250}

	// Record snapshot
	history.RecordSnapshot(playerID, position, timestamp)

	// Query with exact same timestamp
	retrievedPos, found := history.GetPositionAt(playerID, timestamp)
	if !found {
		t.Fatal("Expected to find position with exact timestamp")
	}

	if retrievedPos.X != position.X || retrievedPos.Y != position.Y {
		t.Errorf("Expected exact match: %+v, got %+v", position, retrievedPos)
	}
}
