package game

import (
	"math"
)

// Physics handles game physics calculations
type Physics struct{}

// NewPhysics creates a new physics engine
func NewPhysics() *Physics {
	return &Physics{}
}

// UpdatePlayer updates a player's physics state based on input and delta time
// deltaTime is in seconds
func (p *Physics) UpdatePlayer(player *PlayerState, deltaTime float64) {
	input := player.GetInput()
	currentVel := player.GetVelocity()

	// Calculate input direction vector
	inputDir := Vector2{X: 0, Y: 0}

	if input.Left {
		inputDir.X -= 1
	}
	if input.Right {
		inputDir.X += 1
	}
	if input.Up {
		inputDir.Y -= 1
	}
	if input.Down {
		inputDir.Y += 1
	}

	// Normalize input direction for diagonal movement
	inputDir = normalize(inputDir)

	// Apply acceleration or deceleration
	var newVel Vector2
	if inputDir.X != 0 || inputDir.Y != 0 {
		// Player is giving input - accelerate toward target velocity
		targetVel := Vector2{
			X: inputDir.X * MovementSpeed,
			Y: inputDir.Y * MovementSpeed,
		}

		newVel = accelerateToward(currentVel, targetVel, Acceleration, deltaTime)
	} else {
		// No input - decelerate to zero
		newVel = decelerateToZero(currentVel, Deceleration, deltaTime)
	}

	player.SetVelocity(newVel)

	// Update position based on velocity
	currentPos := player.GetPosition()
	newPos := Vector2{
		X: currentPos.X + newVel.X*deltaTime,
		Y: currentPos.Y + newVel.Y*deltaTime,
	}

	// Clamp position to arena bounds
	newPos = clampToArena(newPos)

	player.SetPosition(newPos)
}

// normalize returns a normalized vector (length = 1) or zero vector if input is zero
func normalize(v Vector2) Vector2 {
	length := math.Sqrt(v.X*v.X + v.Y*v.Y)
	if length == 0 {
		return Vector2{X: 0, Y: 0}
	}
	return Vector2{
		X: v.X / length,
		Y: v.Y / length,
	}
}

// accelerateToward smoothly accelerates current velocity toward target velocity
func accelerateToward(current, target Vector2, accel, deltaTime float64) Vector2 {
	diff := Vector2{
		X: target.X - current.X,
		Y: target.Y - current.Y,
	}

	// Calculate the maximum change possible this frame
	maxChange := accel * deltaTime

	// If we're close enough, just snap to target
	diffLength := math.Sqrt(diff.X*diff.X + diff.Y*diff.Y)
	if diffLength <= maxChange {
		return target
	}

	// Otherwise, move toward target by maxChange amount
	diffNorm := Vector2{
		X: diff.X / diffLength,
		Y: diff.Y / diffLength,
	}

	return Vector2{
		X: current.X + diffNorm.X*maxChange,
		Y: current.Y + diffNorm.Y*maxChange,
	}
}

// decelerateToZero smoothly decelerates velocity to zero
func decelerateToZero(current Vector2, decel, deltaTime float64) Vector2 {
	return accelerateToward(current, Vector2{X: 0, Y: 0}, decel, deltaTime)
}

// clampToArena ensures position stays within arena bounds
func clampToArena(pos Vector2) Vector2 {
	// Clamp to arena boundaries (accounting for player size)
	halfWidth := PlayerWidth / 2
	halfHeight := PlayerHeight / 2

	x := math.Max(halfWidth, math.Min(pos.X, ArenaWidth-halfWidth))
	y := math.Max(halfHeight, math.Min(pos.Y, ArenaHeight-halfHeight))

	return Vector2{X: x, Y: y}
}
