package game

import (
	"sync"
	"time"
)

// PingTracker tracks RTT (Round-Trip Time) measurements for a single connection.
// It maintains a circular buffer of the last 5 measurements and calculates
// a moving average for lag compensation.
type PingTracker struct {
	measurements [5]int64     // Circular buffer of RTT measurements in milliseconds
	index        int          // Current write position in circular buffer
	count        int          // Number of measurements recorded (capped at 5)
	mu           sync.RWMutex // Protects concurrent access
}

// NewPingTracker creates a new ping tracker with empty measurements
func NewPingTracker() *PingTracker {
	return &PingTracker{
		measurements: [5]int64{},
		index:        0,
		count:        0,
	}
}

// RecordRTT records a new RTT measurement in the circular buffer
func (pt *PingTracker) RecordRTT(rtt time.Duration) {
	pt.mu.Lock()
	defer pt.mu.Unlock()

	// Convert to milliseconds
	rttMs := rtt.Milliseconds()

	// Store in circular buffer
	pt.measurements[pt.index] = rttMs

	// Advance index (wrap around at 5)
	pt.index = (pt.index + 1) % 5

	// Increment count (capped at 5)
	if pt.count < 5 {
		pt.count++
	}
}

// GetRTT returns the average RTT in milliseconds over the last 5 measurements
func (pt *PingTracker) GetRTT() int64 {
	pt.mu.RLock()
	defer pt.mu.RUnlock()

	if pt.count == 0 {
		return 0
	}

	// Calculate average over recorded measurements
	var sum int64
	for i := 0; i < pt.count; i++ {
		sum += pt.measurements[i]
	}

	return sum / int64(pt.count)
}

// GetMeasurementCount returns the number of RTT measurements recorded
func (pt *PingTracker) GetMeasurementCount() int {
	pt.mu.RLock()
	defer pt.mu.RUnlock()

	return pt.count
}
