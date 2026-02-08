package game

import (
	"math"
	"testing"
)

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

	// Update with no input (should decelerate to zero)
	// At Deceleration=1500, maxChange = 1500*0.1 = 150. Since 150 > 100, snaps to zero.
	physics.UpdatePlayer(player, 0.1)

	vel := player.GetVelocity()
	expected := Vector2{X: 0, Y: 0}

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

// NaN validation tests for movement functions

func TestAccelerateToward_NeverReturnsNaN(t *testing.T) {
	tests := []struct {
		name      string
		current   Vector2
		target    Vector2
		accel     float64
		deltaTime float64
	}{
		{
			name:      "current equals target (zero diff)",
			current:   Vector2{X: 100, Y: 100},
			target:    Vector2{X: 100, Y: 100},
			accel:     50,
			deltaTime: 0.1,
		},
		{
			name:      "very close to target",
			current:   Vector2{X: 100, Y: 100},
			target:    Vector2{X: 100.0001, Y: 100.0001},
			accel:     50,
			deltaTime: 0.1,
		},
		{
			name:      "zero acceleration",
			current:   Vector2{X: 100, Y: 100},
			target:    Vector2{X: 200, Y: 200},
			accel:     0,
			deltaTime: 0.1,
		},
		{
			name:      "zero delta time",
			current:   Vector2{X: 100, Y: 100},
			target:    Vector2{X: 200, Y: 200},
			accel:     50,
			deltaTime: 0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := accelerateToward(tt.current, tt.target, tt.accel, tt.deltaTime)
			if math.IsNaN(result.X) || math.IsNaN(result.Y) {
				t.Errorf("accelerateToward(%+v, %+v, %v, %v) produced NaN: %+v",
					tt.current, tt.target, tt.accel, tt.deltaTime, result)
			}
			if math.IsInf(result.X, 0) || math.IsInf(result.Y, 0) {
				t.Errorf("accelerateToward(%+v, %+v, %v, %v) produced Inf: %+v",
					tt.current, tt.target, tt.accel, tt.deltaTime, result)
			}
		})
	}
}

func TestUpdatePlayer_NeverProducesNaN(t *testing.T) {
	physics := NewPhysics()

	tests := []struct {
		name      string
		input     InputState
		velocity  Vector2
		deltaTime float64
	}{
		{
			name:      "zero delta time",
			input:     InputState{Right: true},
			velocity:  Vector2{X: 100, Y: 100},
			deltaTime: 0,
		},
		{
			name:      "very small delta time",
			input:     InputState{Right: true},
			velocity:  Vector2{X: 100, Y: 100},
			deltaTime: 1e-10,
		},
		{
			name:      "opposing inputs",
			input:     InputState{Up: true, Down: true, Left: true, Right: true},
			velocity:  Vector2{X: 100, Y: 100},
			deltaTime: 0.016,
		},
		{
			name:      "zero velocity with no input",
			input:     InputState{},
			velocity:  Vector2{X: 0, Y: 0},
			deltaTime: 0.016,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			player := NewPlayerState("test-player")
			player.SetInput(tt.input)
			player.SetVelocity(tt.velocity)

			physics.UpdatePlayer(player, tt.deltaTime)

			pos := player.GetPosition()
			vel := player.GetVelocity()

			if math.IsNaN(pos.X) || math.IsNaN(pos.Y) {
				t.Errorf("Position contains NaN: %+v", pos)
			}
			if math.IsInf(pos.X, 0) || math.IsInf(pos.Y, 0) {
				t.Errorf("Position contains Inf: %+v", pos)
			}
			if math.IsNaN(vel.X) || math.IsNaN(vel.Y) {
				t.Errorf("Velocity contains NaN: %+v", vel)
			}
			if math.IsInf(vel.X, 0) || math.IsInf(vel.Y, 0) {
				t.Errorf("Velocity contains Inf: %+v", vel)
			}
		})
	}
}

// Sprint mechanic tests

func TestUpdatePlayerSprintSpeed(t *testing.T) {
	physics := NewPhysics()
	player := NewPlayerState("test-player")

	// Set input: moving right while sprinting
	player.SetInput(InputState{Right: true, IsSprinting: true})

	// Simulate movement over several seconds to reach target velocity
	// At 50 px/s² acceleration, reaching 300 px/s takes 6 seconds
	// 60 Hz * 7 seconds = 420 frames to be safe
	for i := 0; i < 420; i++ {
		physics.UpdatePlayer(player, 1.0/60.0)
	}

	vel := player.GetVelocity()

	// Velocity should approach sprint speed (300 px/s), not normal speed (200 px/s)
	tolerance := 1.0
	if math.Abs(vel.X-SprintSpeed) > tolerance {
		t.Errorf("Sprint velocity should be ~%v, got %v", SprintSpeed, vel.X)
	}

	// Should not exceed sprint speed
	if vel.X > SprintSpeed+tolerance {
		t.Errorf("Velocity exceeded sprint speed: %v > %v", vel.X, SprintSpeed)
	}
}

func TestUpdatePlayerNormalSpeed(t *testing.T) {
	physics := NewPhysics()
	player := NewPlayerState("test-player")

	// Set input: moving right WITHOUT sprinting
	player.SetInput(InputState{Right: true, IsSprinting: false})

	// Simulate movement over several seconds to reach target velocity
	// At 50 px/s² acceleration, reaching 200 px/s takes 4 seconds
	// 60 Hz * 5 seconds = 300 frames to be safe
	for i := 0; i < 300; i++ {
		physics.UpdatePlayer(player, 1.0/60.0)
	}

	vel := player.GetVelocity()

	// Velocity should approach normal speed (200 px/s), not sprint speed (300 px/s)
	tolerance := 1.0
	if math.Abs(vel.X-MovementSpeed) > tolerance {
		t.Errorf("Normal velocity should be ~%v, got %v", MovementSpeed, vel.X)
	}

	// Should not exceed normal speed
	if vel.X > MovementSpeed+tolerance {
		t.Errorf("Velocity exceeded normal speed: %v > %v", vel.X, MovementSpeed)
	}
}

func TestSprintSpeedTransition(t *testing.T) {
	physics := NewPhysics()
	player := NewPlayerState("test-player")

	// Start sprinting
	player.SetInput(InputState{Right: true, IsSprinting: true})

	// Build up to sprint speed
	for i := 0; i < 420; i++ {
		physics.UpdatePlayer(player, 1.0/60.0)
	}

	velSprint := player.GetVelocity()

	// Stop sprinting (but keep moving)
	player.SetInput(InputState{Right: true, IsSprinting: false})

	// Allow velocity to adjust to normal speed (decelerate from 300 to 200 takes ~2 seconds)
	for i := 0; i < 150; i++ {
		physics.UpdatePlayer(player, 1.0/60.0)
	}

	velNormal := player.GetVelocity()

	// Sprint velocity should be faster than normal velocity
	if velSprint.X <= velNormal.X {
		t.Errorf("Sprint velocity (%v) should be faster than normal velocity (%v)", velSprint.X, velNormal.X)
	}

	// Normal velocity should be close to MovementSpeed
	tolerance := 1.0
	if math.Abs(velNormal.X-MovementSpeed) > tolerance {
		t.Errorf("After stopping sprint, velocity should return to ~%v, got %v", MovementSpeed, velNormal.X)
	}
}

func TestSprintWithDiagonalMovement(t *testing.T) {
	physics := NewPhysics()
	player := NewPlayerState("test-player")

	// Sprint diagonally (up-right)
	player.SetInput(InputState{Up: true, Right: true, IsSprinting: true})

	// Simulate movement (7 seconds to reach full sprint speed)
	for i := 0; i < 420; i++ {
		physics.UpdatePlayer(player, 1.0/60.0)
	}

	vel := player.GetVelocity()

	// Calculate velocity magnitude
	velMagnitude := math.Sqrt(vel.X*vel.X + vel.Y*vel.Y)

	// Magnitude should be close to sprint speed (normalized diagonal movement)
	tolerance := 1.0
	if math.Abs(velMagnitude-SprintSpeed) > tolerance {
		t.Errorf("Diagonal sprint velocity magnitude should be ~%v, got %v", SprintSpeed, velMagnitude)
	}
}
