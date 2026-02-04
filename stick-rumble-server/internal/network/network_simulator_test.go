package network

import (
	"os"
	"sync"
	"testing"
	"time"
)

func TestNewNetworkSimulator_NoEnvVars(t *testing.T) {
	// Clear any existing env vars
	os.Unsetenv("SIMULATE_LATENCY")
	os.Unsetenv("SIMULATE_PACKET_LOSS")

	sim := NewNetworkSimulator()

	if sim != nil {
		t.Error("Expected nil simulator when no env vars are set")
	}
}

func TestNewNetworkSimulator_WithLatency(t *testing.T) {
	os.Setenv("SIMULATE_LATENCY", "100")
	os.Unsetenv("SIMULATE_PACKET_LOSS")
	defer os.Unsetenv("SIMULATE_LATENCY")

	sim := NewNetworkSimulator()

	if sim == nil {
		t.Fatal("Expected non-nil simulator")
	}

	if sim.GetLatency() != 100 {
		t.Errorf("Expected latency 100, got %d", sim.GetLatency())
	}

	if !sim.IsEnabled() {
		t.Error("Expected simulator to be enabled")
	}
}

func TestNewNetworkSimulator_WithPacketLoss(t *testing.T) {
	os.Unsetenv("SIMULATE_LATENCY")
	os.Setenv("SIMULATE_PACKET_LOSS", "10")
	defer os.Unsetenv("SIMULATE_PACKET_LOSS")

	sim := NewNetworkSimulator()

	if sim == nil {
		t.Fatal("Expected non-nil simulator")
	}

	if sim.GetPacketLoss() != 10 {
		t.Errorf("Expected packet loss 10, got %d", sim.GetPacketLoss())
	}
}

func TestNewNetworkSimulator_WithBothSettings(t *testing.T) {
	os.Setenv("SIMULATE_LATENCY", "150")
	os.Setenv("SIMULATE_PACKET_LOSS", "5")
	defer func() {
		os.Unsetenv("SIMULATE_LATENCY")
		os.Unsetenv("SIMULATE_PACKET_LOSS")
	}()

	sim := NewNetworkSimulator()

	if sim == nil {
		t.Fatal("Expected non-nil simulator")
	}

	if sim.GetLatency() != 150 {
		t.Errorf("Expected latency 150, got %d", sim.GetLatency())
	}

	if sim.GetPacketLoss() != 5 {
		t.Errorf("Expected packet loss 5, got %d", sim.GetPacketLoss())
	}
}

func TestNewNetworkSimulator_InvalidValues(t *testing.T) {
	os.Setenv("SIMULATE_LATENCY", "invalid")
	os.Setenv("SIMULATE_PACKET_LOSS", "not_a_number")
	defer func() {
		os.Unsetenv("SIMULATE_LATENCY")
		os.Unsetenv("SIMULATE_PACKET_LOSS")
	}()

	// Should not panic, just log errors
	sim := NewNetworkSimulator()

	if sim == nil {
		t.Fatal("Expected non-nil simulator even with invalid values")
	}

	// Invalid values should result in 0
	if sim.GetLatency() != 0 {
		t.Errorf("Expected latency 0 for invalid value, got %d", sim.GetLatency())
	}
}

func TestSetLatency_Clamping(t *testing.T) {
	sim := &NetworkSimulator{enabled: true}

	// Test minimum clamping
	sim.SetLatency(-50)
	if sim.GetLatency() != 0 {
		t.Errorf("Expected latency 0 for negative value, got %d", sim.GetLatency())
	}

	// Test maximum clamping
	sim.SetLatency(500)
	if sim.GetLatency() != 300 {
		t.Errorf("Expected latency 300 for value > 300, got %d", sim.GetLatency())
	}

	// Test normal value
	sim.SetLatency(100)
	if sim.GetLatency() != 100 {
		t.Errorf("Expected latency 100, got %d", sim.GetLatency())
	}
}

func TestSetPacketLoss_Clamping(t *testing.T) {
	sim := &NetworkSimulator{enabled: true}

	// Test minimum clamping
	sim.SetPacketLoss(-10)
	if sim.GetPacketLoss() != 0 {
		t.Errorf("Expected packet loss 0 for negative value, got %d", sim.GetPacketLoss())
	}

	// Test maximum clamping
	sim.SetPacketLoss(50)
	if sim.GetPacketLoss() != 20 {
		t.Errorf("Expected packet loss 20 for value > 20, got %d", sim.GetPacketLoss())
	}

	// Test normal value
	sim.SetPacketLoss(10)
	if sim.GetPacketLoss() != 10 {
		t.Errorf("Expected packet loss 10, got %d", sim.GetPacketLoss())
	}
}

func TestIsEnabled_NilSimulator(t *testing.T) {
	var sim *NetworkSimulator = nil

	if sim.IsEnabled() {
		t.Error("Expected nil simulator to return false for IsEnabled")
	}
}

func TestShouldDropPacket_NilSimulator(t *testing.T) {
	var sim *NetworkSimulator = nil

	if sim.ShouldDropPacket() {
		t.Error("Expected nil simulator to return false for ShouldDropPacket")
	}
}

func TestShouldDropPacket_ZeroLoss(t *testing.T) {
	sim := &NetworkSimulator{enabled: true, packetLoss: 0}

	// Should never drop with 0% packet loss
	for i := 0; i < 100; i++ {
		if sim.ShouldDropPacket() {
			t.Error("Should never drop packet with 0% packet loss")
		}
	}
}

func TestShouldDropPacket_DisabledSimulator(t *testing.T) {
	sim := &NetworkSimulator{enabled: false, packetLoss: 100}

	// Should never drop when disabled
	for i := 0; i < 100; i++ {
		if sim.ShouldDropPacket() {
			t.Error("Should never drop packet when simulator is disabled")
		}
	}
}

func TestGetDelay_NilSimulator(t *testing.T) {
	var sim *NetworkSimulator = nil

	if sim.GetDelay() != 0 {
		t.Error("Expected nil simulator to return 0 delay")
	}
}

func TestGetDelay_ZeroLatency(t *testing.T) {
	sim := &NetworkSimulator{enabled: true, latency: 0}

	if sim.GetDelay() != 0 {
		t.Error("Expected 0 delay when latency is 0")
	}
}

func TestGetDelay_WithLatency(t *testing.T) {
	sim := &NetworkSimulator{enabled: true, latency: 100}

	// Run multiple times to verify jitter is applied
	delays := make([]time.Duration, 100)
	for i := 0; i < 100; i++ {
		delays[i] = sim.GetDelay()
	}

	// All delays should be between 80ms and 120ms (100ms +/- 20ms jitter)
	for _, d := range delays {
		if d < 80*time.Millisecond || d > 120*time.Millisecond {
			t.Errorf("Expected delay between 80ms and 120ms, got %v", d)
		}
	}
}

func TestSimulateSend_NilSimulator(t *testing.T) {
	var sim *NetworkSimulator = nil

	called := false
	sim.SimulateSend(func() {
		called = true
	})

	if !called {
		t.Error("Expected sendFn to be called immediately when simulator is nil")
	}
}

func TestSimulateSend_DisabledSimulator(t *testing.T) {
	sim := &NetworkSimulator{enabled: false, latency: 100}

	called := false
	sim.SimulateSend(func() {
		called = true
	})

	if !called {
		t.Error("Expected sendFn to be called immediately when simulator is disabled")
	}
}

func TestSimulateSend_WithDelay(t *testing.T) {
	sim := &NetworkSimulator{enabled: true, latency: 50, packetLoss: 0}

	var mu sync.Mutex
	called := false

	start := time.Now()
	sim.SimulateSend(func() {
		mu.Lock()
		called = true
		mu.Unlock()
	})

	// Should not be called immediately
	mu.Lock()
	if called {
		mu.Unlock()
		t.Error("Expected sendFn to not be called immediately with delay")
	}
	mu.Unlock()

	// Wait for delay + some buffer
	time.Sleep(100 * time.Millisecond)

	elapsed := time.Since(start)

	mu.Lock()
	defer mu.Unlock()
	if !called {
		t.Error("Expected sendFn to be called after delay")
	}

	// Should have taken at least 30ms (50ms - 20ms jitter)
	if elapsed < 30*time.Millisecond {
		t.Errorf("Expected at least 30ms delay, got %v", elapsed)
	}
}

func TestSimulateSend_PacketDropped(t *testing.T) {
	sim := &NetworkSimulator{enabled: true, latency: 10, packetLoss: 100}

	called := false
	sim.SimulateSend(func() {
		called = true
	})

	// Wait to ensure any async operations complete
	time.Sleep(50 * time.Millisecond)

	if called {
		t.Error("Expected sendFn to not be called when packet is dropped")
	}
}
