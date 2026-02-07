package game

import (
	"sync"
	"time"
)

// PositionSnapshot represents a player's position at a specific time
type PositionSnapshot struct {
	Position  Vector2
	Timestamp time.Time
}

// PositionHistory maintains a circular buffer of position snapshots for lag compensation
// Buffer size: 60 snapshots = 1 second at 60Hz physics tick rate
type PositionHistory struct {
	players map[string]*playerPositionBuffer
	mu      sync.RWMutex
}

// playerPositionBuffer stores position history for a single player
type playerPositionBuffer struct {
	snapshots [60]PositionSnapshot // Circular buffer (1 second at 60Hz)
	index     int                  // Current write position
	count     int                  // Number of snapshots recorded (capped at 60)
	mu        sync.RWMutex
}

// NewPositionHistory creates a new position history tracker
func NewPositionHistory() *PositionHistory {
	return &PositionHistory{
		players: make(map[string]*playerPositionBuffer),
	}
}

// RecordSnapshot records a player's position at a given timestamp
func (ph *PositionHistory) RecordSnapshot(playerID string, position Vector2, timestamp time.Time) {
	ph.mu.Lock()
	buffer, exists := ph.players[playerID]
	if !exists {
		buffer = &playerPositionBuffer{
			snapshots: [60]PositionSnapshot{},
			index:     0,
			count:     0,
		}
		ph.players[playerID] = buffer
	}
	ph.mu.Unlock()

	// Record snapshot in player's buffer
	buffer.mu.Lock()
	defer buffer.mu.Unlock()

	buffer.snapshots[buffer.index] = PositionSnapshot{
		Position:  position,
		Timestamp: timestamp,
	}

	// Advance index (wrap around at 60)
	buffer.index = (buffer.index + 1) % 60

	// Increment count (capped at 60)
	if buffer.count < 60 {
		buffer.count++
	}
}

// GetPositionAt retrieves a player's position at a specific timestamp
// If the exact timestamp doesn't exist, it interpolates between the two nearest snapshots
// Returns the position and true if found, or zero position and false if no data available
func (ph *PositionHistory) GetPositionAt(playerID string, queryTime time.Time) (Vector2, bool) {
	ph.mu.RLock()
	buffer, exists := ph.players[playerID]
	ph.mu.RUnlock()

	if !exists {
		return Vector2{}, false
	}

	buffer.mu.RLock()
	defer buffer.mu.RUnlock()

	if buffer.count == 0 {
		return Vector2{}, false
	}

	// Find the two snapshots that bracket the query time
	var before, after *PositionSnapshot
	oldestIdx := buffer.index // In circular buffer, current write position points to oldest entry (when full)
	if buffer.count < 60 {
		oldestIdx = 0 // Buffer not full, start from beginning
	}

	// Get the oldest and newest timestamps in buffer
	oldestSnapshot := &buffer.snapshots[oldestIdx]
	newestIdx := (buffer.index - 1 + 60) % 60
	newestSnapshot := &buffer.snapshots[newestIdx]

	// If query time is before oldest snapshot, return false (data too old)
	if queryTime.Before(oldestSnapshot.Timestamp) {
		return Vector2{}, false
	}

	// If query time is after newest snapshot, return false (data in future)
	if queryTime.After(newestSnapshot.Timestamp) {
		return Vector2{}, false
	}

	// Iterate through all recorded snapshots
	for i := 0; i < buffer.count; i++ {
		idx := (oldestIdx + i) % 60
		snapshot := &buffer.snapshots[idx]

		// If exact match
		if snapshot.Timestamp.Equal(queryTime) {
			return snapshot.Position, true
		}

		// Track snapshots before and after query time
		if snapshot.Timestamp.Before(queryTime) {
			before = snapshot
		} else if after == nil && snapshot.Timestamp.After(queryTime) {
			after = snapshot
			break // Found our bracket
		}
	}

	// If we have both, interpolate
	if before != nil && after != nil {
		return interpolatePosition(*before, *after, queryTime), true
	}

	// No valid data
	return Vector2{}, false
}

// interpolatePosition linearly interpolates between two position snapshots
func interpolatePosition(before, after PositionSnapshot, queryTime time.Time) Vector2 {
	// Calculate time deltas
	totalDuration := after.Timestamp.Sub(before.Timestamp).Seconds()
	if totalDuration == 0 {
		return before.Position
	}

	queryDuration := queryTime.Sub(before.Timestamp).Seconds()
	t := queryDuration / totalDuration // Interpolation factor [0, 1]

	// Linear interpolation: pos = before + t * (after - before)
	return Vector2{
		X: before.Position.X + t*(after.Position.X-before.Position.X),
		Y: before.Position.Y + t*(after.Position.Y-before.Position.Y),
	}
}
