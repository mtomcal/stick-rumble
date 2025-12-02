package game

import "testing"

// TestConstants verifies that game constants have expected values
// These values must match the client-side constants in src/shared/constants.ts
func TestConstants(t *testing.T) {
	tests := []struct {
		name     string
		got      float64
		expected float64
	}{
		{"MovementSpeed", MovementSpeed, 200.0},
		{"Acceleration", Acceleration, 50.0},
		{"Deceleration", Deceleration, 50.0},
		{"ArenaWidth", ArenaWidth, 1920.0},
		{"ArenaHeight", ArenaHeight, 1080.0},
		{"PlayerWidth", PlayerWidth, 32.0},
		{"PlayerHeight", PlayerHeight, 64.0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.got != tt.expected {
				t.Errorf("%s = %v, want %v", tt.name, tt.got, tt.expected)
			}
		})
	}
}

// TestNetworkRates verifies network update rate constants
func TestNetworkRates(t *testing.T) {
	tests := []struct {
		name     string
		got      int
		expected int
	}{
		{"ServerTickRate", ServerTickRate, 60},
		{"ClientUpdateRate", ClientUpdateRate, 20},
		{"ServerTickInterval", ServerTickInterval, 16}, // 1000/60 ≈ 16.67ms
		{"ClientUpdateInterval", ClientUpdateInterval, 50},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.got != tt.expected {
				t.Errorf("%s = %v, want %v", tt.name, tt.got, tt.expected)
			}
		})
	}
}
