package game

import (
	"testing"
)

// TestValidatePlayerMovement tests the movement validation logic
func TestValidatePlayerMovement(t *testing.T) {
	physics := NewPhysics()

	tests := []struct {
		name           string
		oldPos         Vector2
		newPos         Vector2
		velocity       Vector2
		deltaTime      float64
		isRolling      bool
		isSprinting    bool
		expectValid    bool
		expectedReason string
	}{
		{
			name:        "valid normal movement within speed limit",
			oldPos:      Vector2{X: 100, Y: 100},
			newPos:      Vector2{X: 102, Y: 100},
			velocity:    Vector2{X: 200, Y: 0},
			deltaTime:   0.01,
			isRolling:   false,
			isSprinting: false,
			expectValid: true,
		},
		{
			name:        "valid sprint movement within speed limit",
			oldPos:      Vector2{X: 100, Y: 100},
			newPos:      Vector2{X: 103, Y: 100},
			velocity:    Vector2{X: 300, Y: 0},
			deltaTime:   0.01,
			isRolling:   false,
			isSprinting: true,
			expectValid: true,
		},
		{
			name:        "valid dodge roll movement within speed limit",
			oldPos:      Vector2{X: 100, Y: 100},
			newPos:      Vector2{X: 102.5, Y: 100},
			velocity:    Vector2{X: 250, Y: 0},
			deltaTime:   0.01,
			isRolling:   true,
			isSprinting: false,
			expectValid: true,
		},
		{
			name:           "invalid movement exceeds normal speed limit",
			oldPos:         Vector2{X: 100, Y: 100},
			newPos:         Vector2{X: 105, Y: 100},
			velocity:       Vector2{X: 500, Y: 0},
			deltaTime:      0.01,
			isRolling:      false,
			isSprinting:    false,
			expectValid:    false,
			expectedReason: "speed_exceeded",
		},
		{
			name:           "invalid movement exceeds sprint speed limit",
			oldPos:         Vector2{X: 100, Y: 100},
			newPos:         Vector2{X: 107, Y: 100},
			velocity:       Vector2{X: 700, Y: 0},
			deltaTime:      0.01,
			isRolling:      false,
			isSprinting:    true,
			expectValid:    false,
			expectedReason: "speed_exceeded",
		},
		{
			name:           "invalid movement exceeds dodge roll speed limit",
			oldPos:         Vector2{X: 100, Y: 100},
			newPos:         Vector2{X: 106, Y: 100},
			velocity:       Vector2{X: 600, Y: 0},
			deltaTime:      0.01,
			isRolling:      true,
			isSprinting:    false,
			expectValid:    false,
			expectedReason: "speed_exceeded",
		},
		{
			name:           "invalid movement outside arena bounds (negative x)",
			oldPos:         Vector2{X: 5, Y: 100},
			newPos:         Vector2{X: -10, Y: 100},
			velocity:       Vector2{X: -150, Y: 0},
			deltaTime:      0.1,
			isRolling:      false,
			isSprinting:    false,
			expectValid:    false,
			expectedReason: "out_of_bounds",
		},
		{
			name:           "invalid movement outside arena bounds (exceeds width)",
			oldPos:         Vector2{X: 1900, Y: 100},
			newPos:         Vector2{X: 1950, Y: 100},
			velocity:       Vector2{X: 200, Y: 0},
			deltaTime:      0.25,
			isRolling:      false,
			isSprinting:    false,
			expectValid:    false,
			expectedReason: "out_of_bounds",
		},
		{
			name:           "invalid movement outside arena bounds (negative y)",
			oldPos:         Vector2{X: 100, Y: 20},
			newPos:         Vector2{X: 100, Y: -10},
			velocity:       Vector2{X: 0, Y: -150},
			deltaTime:      0.2,
			isRolling:      false,
			isSprinting:    false,
			expectValid:    false,
			expectedReason: "out_of_bounds",
		},
		{
			name:           "invalid movement outside arena bounds (exceeds height)",
			oldPos:         Vector2{X: 100, Y: 1050},
			newPos:         Vector2{X: 100, Y: 1100},
			velocity:       Vector2{X: 0, Y: 200},
			deltaTime:      0.25,
			isRolling:      false,
			isSprinting:    false,
			expectValid:    false,
			expectedReason: "out_of_bounds",
		},
		{
			name:        "edge case: movement at exact boundary is valid",
			oldPos:      Vector2{X: PlayerWidth / 2, Y: PlayerHeight / 2},
			newPos:      Vector2{X: PlayerWidth / 2, Y: PlayerHeight / 2},
			velocity:    Vector2{X: 0, Y: 0},
			deltaTime:   0.01,
			isRolling:   false,
			isSprinting: false,
			expectValid: true,
		},
		{
			name:        "edge case: movement at maximum boundary is valid",
			oldPos:      Vector2{X: ArenaWidth - PlayerWidth/2, Y: ArenaHeight - PlayerHeight/2},
			newPos:      Vector2{X: ArenaWidth - PlayerWidth/2, Y: ArenaHeight - PlayerHeight/2},
			velocity:    Vector2{X: 0, Y: 0},
			deltaTime:   0.01,
			isRolling:   false,
			isSprinting: false,
			expectValid: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := physics.ValidatePlayerMovement(tt.oldPos, tt.newPos, tt.velocity, tt.deltaTime, tt.isRolling, tt.isSprinting)

			if result.Valid != tt.expectValid {
				t.Errorf("ValidatePlayerMovement() valid = %v, want %v", result.Valid, tt.expectValid)
			}

			if !tt.expectValid && result.Reason != tt.expectedReason {
				t.Errorf("ValidatePlayerMovement() reason = %v, want %v", result.Reason, tt.expectedReason)
			}
		})
	}
}

// TestValidatePlayerMovementWithTolerance tests that the validation allows for minor floating-point errors
func TestValidatePlayerMovementWithTolerance(t *testing.T) {
	physics := NewPhysics()

	// Test movement that's just barely over the limit due to floating point precision
	// Should still be valid due to tolerance
	oldPos := Vector2{X: 100, Y: 100}
	// Normal speed is 200px/s, so in 0.01s we expect 2px movement
	// Add a tiny bit more for floating point error
	newPos := Vector2{X: 102.001, Y: 100}
	velocity := Vector2{X: 200.1, Y: 0}
	deltaTime := 0.01

	result := physics.ValidatePlayerMovement(oldPos, newPos, velocity, deltaTime, false, false)

	if !result.Valid {
		t.Errorf("ValidatePlayerMovement() should allow minor floating point errors, got valid=%v reason=%v", result.Valid, result.Reason)
	}
}
