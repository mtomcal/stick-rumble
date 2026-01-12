package game

import (
	"sync"
	"testing"
	"time"
)

// TestRealClock verifies that RealClock uses actual system time
func TestRealClock(t *testing.T) {
	clock := &RealClock{}

	// Test Now() returns current time
	before := time.Now()
	now := clock.Now()
	after := time.Now()

	if now.Before(before) || now.After(after) {
		t.Errorf("RealClock.Now() returned time outside expected range: %v (expected between %v and %v)", now, before, after)
	}

	// Test Since() returns elapsed time
	start := clock.Now()
	time.Sleep(10 * time.Millisecond)
	elapsed := clock.Since(start)

	if elapsed < 10*time.Millisecond {
		t.Errorf("RealClock.Since() returned %v, expected at least 10ms", elapsed)
	}
}

// TestManualClock_Now verifies that ManualClock returns the current set time
func TestManualClock_Now(t *testing.T) {
	baseTime := time.Date(2026, 1, 12, 10, 0, 0, 0, time.UTC)
	clock := NewManualClock(baseTime)

	now := clock.Now()
	if !now.Equal(baseTime) {
		t.Errorf("ManualClock.Now() = %v, want %v", now, baseTime)
	}
}

// TestManualClock_Advance verifies time can be manually advanced
func TestManualClock_Advance(t *testing.T) {
	baseTime := time.Date(2026, 1, 12, 10, 0, 0, 0, time.UTC)
	clock := NewManualClock(baseTime)

	// Advance time by 5 seconds
	clock.Advance(5 * time.Second)

	expected := baseTime.Add(5 * time.Second)
	now := clock.Now()
	if !now.Equal(expected) {
		t.Errorf("After advancing 5s, ManualClock.Now() = %v, want %v", now, expected)
	}

	// Advance again
	clock.Advance(3 * time.Second)
	expected = expected.Add(3 * time.Second)
	now = clock.Now()
	if !now.Equal(expected) {
		t.Errorf("After advancing 3s more, ManualClock.Now() = %v, want %v", now, expected)
	}
}

// TestManualClock_Since verifies Since() works with manual time
func TestManualClock_Since(t *testing.T) {
	baseTime := time.Date(2026, 1, 12, 10, 0, 0, 0, time.UTC)
	clock := NewManualClock(baseTime)

	start := clock.Now()

	// Advance time by 2 seconds
	clock.Advance(2 * time.Second)

	elapsed := clock.Since(start)
	if elapsed != 2*time.Second {
		t.Errorf("ManualClock.Since() = %v, want 2s", elapsed)
	}
}

// TestManualClock_SetTime verifies we can set time to specific value
func TestManualClock_SetTime(t *testing.T) {
	baseTime := time.Date(2026, 1, 12, 10, 0, 0, 0, time.UTC)
	clock := NewManualClock(baseTime)

	newTime := time.Date(2026, 1, 12, 15, 30, 0, 0, time.UTC)
	clock.SetTime(newTime)

	now := clock.Now()
	if !now.Equal(newTime) {
		t.Errorf("After SetTime, ManualClock.Now() = %v, want %v", now, newTime)
	}
}

// TestManualClock_ThreadSafety verifies ManualClock is thread-safe
func TestManualClock_ThreadSafety(t *testing.T) {
	baseTime := time.Date(2026, 1, 12, 10, 0, 0, 0, time.UTC)
	clock := NewManualClock(baseTime)

	// Number of concurrent goroutines
	const numGoroutines = 100
	const iterations = 100

	var wg sync.WaitGroup
	wg.Add(numGoroutines * 2) // Half for readers, half for writers

	// Start reader goroutines
	for i := 0; i < numGoroutines; i++ {
		go func() {
			defer wg.Done()
			for j := 0; j < iterations; j++ {
				_ = clock.Now()
				_ = clock.Since(baseTime)
			}
		}()
	}

	// Start writer goroutines
	for i := 0; i < numGoroutines; i++ {
		go func() {
			defer wg.Done()
			for j := 0; j < iterations; j++ {
				clock.Advance(1 * time.Millisecond)
			}
		}()
	}

	wg.Wait()

	// Verify final time is correct (all advances succeeded)
	expectedTime := baseTime.Add(time.Duration(numGoroutines*iterations) * time.Millisecond)
	finalTime := clock.Now()

	if !finalTime.Equal(expectedTime) {
		t.Errorf("After concurrent operations, ManualClock.Now() = %v, want %v", finalTime, expectedTime)
	}
}

// TestManualClock_AdvanceNegative verifies negative advances work correctly
func TestManualClock_AdvanceNegative(t *testing.T) {
	baseTime := time.Date(2026, 1, 12, 10, 0, 0, 0, time.UTC)
	clock := NewManualClock(baseTime)

	// Advance forward first
	clock.Advance(10 * time.Second)

	// Advance backward
	clock.Advance(-5 * time.Second)

	expected := baseTime.Add(5 * time.Second)
	now := clock.Now()
	if !now.Equal(expected) {
		t.Errorf("After advancing -5s, ManualClock.Now() = %v, want %v", now, expected)
	}
}
