package game

import (
	"sync"
	"time"
)

// Clock provides time-related operations for game logic.
// This interface enables dependency injection for testing,
// allowing tests to use a manual clock that can be advanced
// instantly instead of waiting for real time to pass.
type Clock interface {
	// Now returns the current time.
	Now() time.Time

	// Since returns the time elapsed since t.
	// Equivalent to Now().Sub(t).
	Since(t time.Time) time.Duration
}

// RealClock implements Clock using the actual system time.
// This is the production implementation.
type RealClock struct{}

// Now returns the current system time.
func (rc *RealClock) Now() time.Time {
	return time.Now()
}

// Since returns the time elapsed since t using system time.
func (rc *RealClock) Since(t time.Time) time.Duration {
	return time.Since(t)
}

// ManualClock implements Clock with manually controllable time.
// This is used in tests to advance time instantly without waiting.
// ManualClock is thread-safe and can be used in concurrent tests.
type ManualClock struct {
	currentTime time.Time
	mu          sync.RWMutex
}

// NewManualClock creates a new ManualClock starting at the given time.
func NewManualClock(startTime time.Time) *ManualClock {
	return &ManualClock{
		currentTime: startTime,
	}
}

// Now returns the current manual time.
func (mc *ManualClock) Now() time.Time {
	mc.mu.RLock()
	defer mc.mu.RUnlock()
	return mc.currentTime
}

// Since returns the time elapsed since t based on the manual clock.
func (mc *ManualClock) Since(t time.Time) time.Duration {
	mc.mu.RLock()
	defer mc.mu.RUnlock()
	return mc.currentTime.Sub(t)
}

// Advance moves the manual clock forward (or backward) by the given duration.
// This method is thread-safe.
func (mc *ManualClock) Advance(d time.Duration) {
	mc.mu.Lock()
	defer mc.mu.Unlock()
	mc.currentTime = mc.currentTime.Add(d)
}

// SetTime sets the manual clock to a specific time.
// This method is thread-safe.
func (mc *ManualClock) SetTime(t time.Time) {
	mc.mu.Lock()
	defer mc.mu.Unlock()
	mc.currentTime = t
}
