package network

import (
	"log"
	"math/rand"
	"os"
	"strconv"
	"time"
)

// NetworkSimulator simulates artificial network latency and packet loss for testing
type NetworkSimulator struct {
	latency    int  // Base latency in milliseconds (0-300)
	packetLoss int  // Packet loss percentage (0-20)
	enabled    bool // Whether simulation is active
}

// NewNetworkSimulator creates a new network simulator from environment variables.
// Reads SIMULATE_LATENCY and SIMULATE_PACKET_LOSS environment variables.
// Returns nil if neither variable is set.
func NewNetworkSimulator() *NetworkSimulator {
	latencyStr := os.Getenv("SIMULATE_LATENCY")
	packetLossStr := os.Getenv("SIMULATE_PACKET_LOSS")

	// If neither env var is set, return nil (no simulation)
	if latencyStr == "" && packetLossStr == "" {
		return nil
	}

	sim := &NetworkSimulator{
		enabled: true,
	}

	// Parse latency
	if latencyStr != "" {
		latency, err := strconv.Atoi(latencyStr)
		if err != nil {
			log.Printf("[NetworkSimulator] Invalid SIMULATE_LATENCY value: %s", latencyStr)
		} else {
			sim.SetLatency(latency)
		}
	}

	// Parse packet loss
	if packetLossStr != "" {
		packetLoss, err := strconv.Atoi(packetLossStr)
		if err != nil {
			log.Printf("[NetworkSimulator] Invalid SIMULATE_PACKET_LOSS value: %s", packetLossStr)
		} else {
			sim.SetPacketLoss(packetLoss)
		}
	}

	if sim.latency > 0 || sim.packetLoss > 0 {
		log.Printf("[NetworkSimulator] Enabled with latency=%dms, packetLoss=%d%%", sim.latency, sim.packetLoss)
	}

	return sim
}

// SetLatency sets the base latency in milliseconds (clamped to 0-300ms)
func (s *NetworkSimulator) SetLatency(latency int) {
	if latency < 0 {
		latency = 0
	} else if latency > 300 {
		latency = 300
	}
	s.latency = latency
}

// GetLatency returns the current base latency
func (s *NetworkSimulator) GetLatency() int {
	return s.latency
}

// SetPacketLoss sets the packet loss percentage (clamped to 0-20%)
func (s *NetworkSimulator) SetPacketLoss(packetLoss int) {
	if packetLoss < 0 {
		packetLoss = 0
	} else if packetLoss > 20 {
		packetLoss = 20
	}
	s.packetLoss = packetLoss
}

// GetPacketLoss returns the current packet loss percentage
func (s *NetworkSimulator) GetPacketLoss() int {
	return s.packetLoss
}

// IsEnabled returns whether the simulator is enabled
func (s *NetworkSimulator) IsEnabled() bool {
	return s != nil && s.enabled
}

// ShouldDropPacket determines if a packet should be dropped based on packet loss rate
func (s *NetworkSimulator) ShouldDropPacket() bool {
	if s == nil || !s.enabled || s.packetLoss == 0 {
		return false
	}
	return rand.Intn(100) < s.packetLoss
}

// GetDelay calculates the delay to apply including jitter (+/-20ms)
func (s *NetworkSimulator) GetDelay() time.Duration {
	if s == nil || !s.enabled || s.latency == 0 {
		return 0
	}
	// Add jitter: +/-20ms
	jitter := rand.Intn(41) - 20 // -20 to +20
	delay := s.latency + jitter
	if delay < 0 {
		delay = 0
	}
	return time.Duration(delay) * time.Millisecond
}

// SimulateSend wraps a send function with artificial latency and packet loss.
// If the packet should be dropped, sendFn is not called.
// Otherwise, sendFn is called after the simulated delay.
func (s *NetworkSimulator) SimulateSend(sendFn func()) {
	if s == nil || !s.enabled {
		sendFn()
		return
	}

	// Check for packet loss first
	if s.ShouldDropPacket() {
		// Packet dropped - don't send
		return
	}

	// Get delay
	delay := s.GetDelay()
	if delay == 0 {
		sendFn()
		return
	}

	// Delay the send (asynchronously to not block)
	go func() {
		time.Sleep(delay)
		sendFn()
	}()
}
