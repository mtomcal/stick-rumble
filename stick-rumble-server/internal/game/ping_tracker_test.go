package game

import (
	"testing"
	"time"
)

// TestNewPingTracker verifies PingTracker initialization
func TestNewPingTracker(t *testing.T) {
	tracker := NewPingTracker()

	if tracker == nil {
		t.Fatal("NewPingTracker() returned nil")
	}

	// Should have zero RTT initially (no measurements)
	rtt := tracker.GetRTT()
	if rtt != 0 {
		t.Errorf("Expected initial RTT 0ms, got %dms", rtt)
	}

	// Should have zero measurements
	count := tracker.GetMeasurementCount()
	if count != 0 {
		t.Errorf("Expected 0 measurements, got %d", count)
	}
}

// TestPingTracker_SingleMeasurement tests recording a single RTT measurement
func TestPingTracker_SingleMeasurement(t *testing.T) {
	tracker := NewPingTracker()

	// Record a single measurement
	tracker.RecordRTT(50 * time.Millisecond)

	// Should return the recorded RTT
	rtt := tracker.GetRTT()
	if rtt != 50 {
		t.Errorf("Expected RTT 50ms, got %dms", rtt)
	}

	// Should have 1 measurement
	count := tracker.GetMeasurementCount()
	if count != 1 {
		t.Errorf("Expected 1 measurement, got %d", count)
	}
}

// TestPingTracker_MultipleM easurements tests averaging over multiple RTT measurements
func TestPingTracker_MultipleMeasurements(t *testing.T) {
	tracker := NewPingTracker()

	// Record 5 measurements (buffer size is 5)
	measurements := []time.Duration{
		40 * time.Millisecond,
		50 * time.Millisecond,
		60 * time.Millisecond,
		30 * time.Millisecond,
		70 * time.Millisecond,
	}

	for _, rtt := range measurements {
		tracker.RecordRTT(rtt)
	}

	// Average should be (40 + 50 + 60 + 30 + 70) / 5 = 50ms
	expectedAvg := int64(50)
	actualAvg := tracker.GetRTT()

	if actualAvg != expectedAvg {
		t.Errorf("Expected average RTT %dms, got %dms", expectedAvg, actualAvg)
	}

	// Should have 5 measurements
	count := tracker.GetMeasurementCount()
	if count != 5 {
		t.Errorf("Expected 5 measurements, got %d", count)
	}
}

// TestPingTracker_CircularBuffer tests that buffer wraps around after 5 measurements
func TestPingTracker_CircularBuffer(t *testing.T) {
	tracker := NewPingTracker()

	// Record 7 measurements (buffer size is 5, so first 2 should be overwritten)
	measurements := []time.Duration{
		10 * time.Millisecond, // Will be overwritten
		20 * time.Millisecond, // Will be overwritten
		30 * time.Millisecond,
		40 * time.Millisecond,
		50 * time.Millisecond,
		60 * time.Millisecond, // Overwrites first (10ms)
		70 * time.Millisecond, // Overwrites second (20ms)
	}

	for _, rtt := range measurements {
		tracker.RecordRTT(rtt)
	}

	// Buffer now contains: [60, 70, 30, 40, 50]
	// Average should be (60 + 70 + 30 + 40 + 50) / 5 = 50ms
	expectedAvg := int64(50)
	actualAvg := tracker.GetRTT()

	if actualAvg != expectedAvg {
		t.Errorf("Expected average RTT %dms, got %dms", expectedAvg, actualAvg)
	}

	// Should still report 5 measurements (buffer is full)
	count := tracker.GetMeasurementCount()
	if count != 5 {
		t.Errorf("Expected 5 measurements, got %d", count)
	}
}

// TestPingTracker_ThreadSafety tests concurrent access to PingTracker
func TestPingTracker_ThreadSafety(t *testing.T) {
	tracker := NewPingTracker()

	// Spawn 10 goroutines that record RTT concurrently
	done := make(chan bool, 10)
	for i := 0; i < 10; i++ {
		go func(rtt time.Duration) {
			tracker.RecordRTT(rtt)
			_ = tracker.GetRTT()
			_ = tracker.GetMeasurementCount()
			done <- true
		}(time.Duration(i*10) * time.Millisecond)
	}

	// Wait for all goroutines to complete
	for i := 0; i < 10; i++ {
		<-done
	}

	// Should have at most 5 measurements (buffer size)
	count := tracker.GetMeasurementCount()
	if count > 5 {
		t.Errorf("Expected at most 5 measurements, got %d", count)
	}

	// RTT should be a valid average
	rtt := tracker.GetRTT()
	if rtt < 0 {
		t.Errorf("Expected non-negative RTT, got %dms", rtt)
	}
}

// TestPingTracker_ZeroRTT tests handling of zero RTT (same machine, localhost)
func TestPingTracker_ZeroRTT(t *testing.T) {
	tracker := NewPingTracker()

	// Record zero RTT
	tracker.RecordRTT(0)

	rtt := tracker.GetRTT()
	if rtt != 0 {
		t.Errorf("Expected RTT 0ms, got %dms", rtt)
	}
}

// TestPingTracker_HighLatency tests handling of high latency measurements
func TestPingTracker_HighLatency(t *testing.T) {
	tracker := NewPingTracker()

	// Record high latency (300ms)
	tracker.RecordRTT(300 * time.Millisecond)

	rtt := tracker.GetRTT()
	if rtt != 300 {
		t.Errorf("Expected RTT 300ms, got %dms", rtt)
	}
}

// TestPingTracker_MixedLatencies tests averaging of varied latencies
func TestPingTracker_MixedLatencies(t *testing.T) {
	tracker := NewPingTracker()

	// Record mixed latencies
	measurements := []time.Duration{
		0 * time.Millisecond,
		100 * time.Millisecond,
		200 * time.Millisecond,
		50 * time.Millisecond,
		150 * time.Millisecond,
	}

	for _, rtt := range measurements {
		tracker.RecordRTT(rtt)
	}

	// Average: (0 + 100 + 200 + 50 + 150) / 5 = 100ms
	expectedAvg := int64(100)
	actualAvg := tracker.GetRTT()

	if actualAvg != expectedAvg {
		t.Errorf("Expected average RTT %dms, got %dms", expectedAvg, actualAvg)
	}
}
