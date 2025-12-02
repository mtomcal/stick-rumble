package game

import (
	"math"
	"testing"
)

func TestNewPhysics(t *testing.T) {
	physics := NewPhysics()
	if physics == nil {
		t.Fatal("NewPhysics() returned nil")
	}
}

func TestNormalize(t *testing.T) {
	tests := []struct {
		name     string
		input    Vector2
		expected Vector2
	}{
		{
			name:     "zero vector",
			input:    Vector2{X: 0, Y: 0},
			expected: Vector2{X: 0, Y: 0},
		},
		{
			name:     "unit vector X",
			input:    Vector2{X: 1, Y: 0},
			expected: Vector2{X: 1, Y: 0},
		},
		{
			name:     "unit vector Y",
			input:    Vector2{X: 0, Y: 1},
			expected: Vector2{X: 0, Y: 1},
		},
		{
			name:     "diagonal vector",
			input:    Vector2{X: 1, Y: 1},
			expected: Vector2{X: 1 / math.Sqrt(2), Y: 1 / math.Sqrt(2)},
		},
		{
			name:     "arbitrary vector",
			input:    Vector2{X: 3, Y: 4},
			expected: Vector2{X: 0.6, Y: 0.8},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := normalize(tt.input)
			if !vectorsAlmostEqual(result, tt.expected, 0.0001) {
				t.Errorf("normalize(%+v) = %+v, want %+v", tt.input, result, tt.expected)
			}
		})
	}
}

func TestClampToArena(t *testing.T) {
	tests := []struct {
		name     string
		input    Vector2
		expected Vector2
	}{
		{
			name:     "within bounds",
			input:    Vector2{X: 960, Y: 540},
			expected: Vector2{X: 960, Y: 540},
		},
		{
			name:     "negative X",
			input:    Vector2{X: -100, Y: 540},
			expected: Vector2{X: PlayerWidth / 2, Y: 540},
		},
		{
			name:     "negative Y",
			input:    Vector2{X: 960, Y: -100},
			expected: Vector2{X: 960, Y: PlayerHeight / 2},
		},
		{
			name:     "exceeds max X",
			input:    Vector2{X: 2000, Y: 540},
			expected: Vector2{X: ArenaWidth - PlayerWidth/2, Y: 540},
		},
		{
			name:     "exceeds max Y",
			input:    Vector2{X: 960, Y: 1200},
			expected: Vector2{X: 960, Y: ArenaHeight - PlayerHeight/2},
		},
		{
			name:     "all bounds exceeded",
			input:    Vector2{X: -1000, Y: 5000},
			expected: Vector2{X: PlayerWidth / 2, Y: ArenaHeight - PlayerHeight/2},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := clampToArena(tt.input)
			if !vectorsAlmostEqual(result, tt.expected, 0.0001) {
				t.Errorf("clampToArena(%+v) = %+v, want %+v", tt.input, result, tt.expected)
			}
		})
	}
}

func TestAccelerateToward(t *testing.T) {
	tests := []struct {
		name      string
		current   Vector2
		target    Vector2
		accel     float64
		deltaTime float64
		wantClose Vector2 // "close to" for floating point
	}{
		{
			name:      "already at target",
			current:   Vector2{X: 100, Y: 100},
			target:    Vector2{X: 100, Y: 100},
			accel:     50,
			deltaTime: 0.1,
			wantClose: Vector2{X: 100, Y: 100},
		},
		{
			name:      "accelerate from zero",
			current:   Vector2{X: 0, Y: 0},
			target:    Vector2{X: 100, Y: 0},
			accel:     50,
			deltaTime: 0.1,
			wantClose: Vector2{X: 5, Y: 0}, // 50 * 0.1 = 5
		},
		{
			name:      "snap to target if close enough",
			current:   Vector2{X: 0, Y: 0},
			target:    Vector2{X: 3, Y: 0},
			accel:     50,
			deltaTime: 0.1,
			wantClose: Vector2{X: 3, Y: 0}, // Distance 3 < maxChange 5, so snap
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := accelerateToward(tt.current, tt.target, tt.accel, tt.deltaTime)
			if !vectorsAlmostEqual(result, tt.wantClose, 0.001) {
				t.Errorf("accelerateToward(%+v, %+v, %v, %v) = %+v, want ~%+v",
					tt.current, tt.target, tt.accel, tt.deltaTime, result, tt.wantClose)
			}
		})
	}
}

func TestDecelerateToZero(t *testing.T) {
	tests := []struct {
		name      string
		current   Vector2
		decel     float64
		deltaTime float64
		wantClose Vector2
	}{
		{
			name:      "already at zero",
			current:   Vector2{X: 0, Y: 0},
			decel:     50,
			deltaTime: 0.1,
			wantClose: Vector2{X: 0, Y: 0},
		},
		{
			name:      "decelerate X velocity",
			current:   Vector2{X: 100, Y: 0},
			decel:     50,
			deltaTime: 0.1,
			wantClose: Vector2{X: 95, Y: 0}, // 100 - 5 = 95
		},
		{
			name:      "snap to zero if close",
			current:   Vector2{X: 3, Y: 0},
			decel:     50,
			deltaTime: 0.1,
			wantClose: Vector2{X: 0, Y: 0}, // Distance 3 < maxChange 5, so snap
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := decelerateToZero(tt.current, tt.decel, tt.deltaTime)
			if !vectorsAlmostEqual(result, tt.wantClose, 0.001) {
				t.Errorf("decelerateToZero(%+v, %v, %v) = %+v, want ~%+v",
					tt.current, tt.decel, tt.deltaTime, result, tt.wantClose)
			}
		})
	}
}

func TestUpdatePlayerNoInput(t *testing.T) {
	physics := NewPhysics()
	player := NewPlayerState("test-player")

	// Set initial velocity
	player.SetVelocity(Vector2{X: 100, Y: 0})

	// Update with no input (should decelerate)
	physics.UpdatePlayer(player, 0.1)

	vel := player.GetVelocity()
	// Should have decelerated by Deceleration * deltaTime = 50 * 0.1 = 5
	expected := Vector2{X: 95, Y: 0}

	if !vectorsAlmostEqual(vel, expected, 0.001) {
		t.Errorf("After no input, velocity = %+v, want ~%+v", vel, expected)
	}
}

func TestUpdatePlayerWithInput(t *testing.T) {
	physics := NewPhysics()
	player := NewPlayerState("test-player")

	// Press right key
	player.SetInput(InputState{Right: true})

	initialPos := player.GetPosition()

	// Update
	physics.UpdatePlayer(player, 0.1)

	vel := player.GetVelocity()
	pos := player.GetPosition()

	// Velocity should be accelerating toward MovementSpeed (200)
	// Acceleration * deltaTime = 50 * 0.1 = 5
	expectedVel := Vector2{X: 5, Y: 0}
	if !vectorsAlmostEqual(vel, expectedVel, 0.001) {
		t.Errorf("After right input, velocity = %+v, want ~%+v", vel, expectedVel)
	}

	// Position should have moved right
	if pos.X <= initialPos.X {
		t.Errorf("After right input, position.X should increase, got %v -> %v", initialPos.X, pos.X)
	}
}

func TestUpdatePlayerDiagonalInput(t *testing.T) {
	physics := NewPhysics()
	player := NewPlayerState("test-player")

	// Press up and right (diagonal)
	player.SetInput(InputState{Up: true, Right: true})

	// Update
	physics.UpdatePlayer(player, 0.1)

	vel := player.GetVelocity()

	// Diagonal input should be normalized, so velocity magnitude should be same as single direction
	velMagnitude := math.Sqrt(vel.X*vel.X + vel.Y*vel.Y)

	// Should accelerate by 5 (Acceleration * deltaTime = 50 * 0.1)
	expected := 5.0

	if math.Abs(velMagnitude-expected) > 0.001 {
		t.Errorf("Diagonal velocity magnitude = %v, want ~%v", velMagnitude, expected)
	}

	// Both X and Y should be equal for 45-degree angle
	if math.Abs(math.Abs(vel.X)-math.Abs(vel.Y)) > 0.001 {
		t.Errorf("Diagonal velocity should have equal X and Y, got %+v", vel)
	}
}

func TestUpdatePlayerBoundsClamp(t *testing.T) {
	physics := NewPhysics()
	player := NewPlayerState("test-player")

	// Set position near edge
	player.SetPosition(Vector2{X: ArenaWidth - 10, Y: ArenaHeight / 2})
	player.SetVelocity(Vector2{X: 1000, Y: 0}) // High velocity to right

	// Update - should clamp to arena edge
	physics.UpdatePlayer(player, 1.0)

	pos := player.GetPosition()

	maxX := ArenaWidth - PlayerWidth/2
	if pos.X > maxX {
		t.Errorf("Position exceeded arena bounds: X = %v, max = %v", pos.X, maxX)
	}
}

func TestUpdatePlayerMultipleFrames(t *testing.T) {
	physics := NewPhysics()
	player := NewPlayerState("test-player")

	initialPos := player.GetPosition()

	// Hold right for multiple frames
	player.SetInput(InputState{Right: true})

	// Simulate 10 frames at 60 FPS (16.67ms each)
	for i := 0; i < 10; i++ {
		physics.UpdatePlayer(player, 1.0/60.0)
	}

	vel := player.GetVelocity()
	pos := player.GetPosition()

	// Velocity should have increased (but not exceeded max speed)
	if vel.X <= 0 {
		t.Errorf("After holding right, velocity.X should be positive, got %v", vel.X)
	}

	if vel.X > MovementSpeed {
		t.Errorf("Velocity exceeded max speed: %v > %v", vel.X, MovementSpeed)
	}

	// Position should have moved significantly right
	if pos.X <= initialPos.X {
		t.Errorf("After holding right, position should move right")
	}
}

// Helper function to compare vectors with tolerance for floating point errors
func vectorsAlmostEqual(a, b Vector2, epsilon float64) bool {
	return math.Abs(a.X-b.X) < epsilon && math.Abs(a.Y-b.Y) < epsilon
}
