package game

import (
	"log"
	"math"
)

// Physics handles game physics calculations
type Physics struct {
	mapConfig MapConfig
}

// NewPhysics creates a new physics engine
func NewPhysics(mapConfigs ...MapConfig) *Physics {
	return &Physics{mapConfig: resolveMapConfig(mapConfigs...)}
}

// UpdatePlayerResult contains the result of updating a player's physics
type UpdatePlayerResult struct {
	RollCancelled    bool // True if dodge roll was cancelled due to wall collision
	CorrectionNeeded bool // True if the movement required correction (anti-cheat flag)
}

// UpdatePlayer updates a player's physics state based on input and delta time
// deltaTime is in seconds
// Returns UpdatePlayerResult with correction information
func (p *Physics) UpdatePlayer(player *PlayerState, deltaTime float64) UpdatePlayerResult {
	result := UpdatePlayerResult{
		RollCancelled:    false,
		CorrectionNeeded: false,
	}

	// Store old position for validation
	oldPos := player.GetPosition()

	// Check if player is rolling - if so, use roll velocity instead of input
	if player.IsRolling() {
		rollState := player.GetRollState()
		// Set velocity to roll direction * roll velocity
		rollVel := Vector2{
			X: rollState.RollDirection.X * DodgeRollVelocity,
			Y: rollState.RollDirection.Y * DodgeRollVelocity,
		}
		rollVel = sanitizeVector2(rollVel, "UpdatePlayer roll velocity")
		player.SetVelocity(rollVel)
	} else {
		// Normal movement (not rolling)
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

		// Determine movement speed based on sprint state
		moveSpeed := MovementSpeed
		if input.IsSprinting {
			moveSpeed = SprintSpeed
		}

		// Apply acceleration or deceleration
		var newVel Vector2
		if inputDir.X != 0 || inputDir.Y != 0 {
			// Player is giving input - accelerate toward target velocity
			targetVel := Vector2{
				X: inputDir.X * moveSpeed,
				Y: inputDir.Y * moveSpeed,
			}

			newVel = accelerateToward(currentVel, targetVel, Acceleration, deltaTime)
		} else {
			// No input - decelerate to zero
			newVel = decelerateToZero(currentVel, Deceleration, deltaTime)
		}

		// Sanitize velocity before setting it
		newVel = sanitizeVector2(newVel, "UpdatePlayer velocity")
		player.SetVelocity(newVel)
	}

	// Update position based on velocity
	currentPos := player.GetPosition()
	currentVel := player.GetVelocity()
	newPos := Vector2{
		X: currentPos.X + currentVel.X*deltaTime,
		Y: currentPos.Y + currentVel.Y*deltaTime,
	}

	// Clamp position to map bounds and resolve obstacle collisions.
	clampedPos, movementBlocked := p.resolveMovement(currentPos, newPos)

	// Check if position was clamped during a roll (wall collision)
	isRolling := player.IsRolling()
	if isRolling && movementBlocked {
		// Wall collision detected during roll - end the roll
		player.EndDodgeRoll()
		result.RollCancelled = true
	}

	// Sanitize position before setting it
	clampedPos = sanitizeVector2(clampedPos, "UpdatePlayer position")

	// Validate the movement for anti-cheat detection
	input := player.GetInput()
	validation := p.ValidatePlayerMovement(oldPos, clampedPos, currentVel, deltaTime, isRolling, input.IsSprinting, movementBlocked)
	if !validation.Valid {
		// Movement failed validation - mark for correction
		result.CorrectionNeeded = true
		player.RecordCorrection()
		log.Printf("Player %s movement correction needed: %s (old=%+v new=%+v vel=%+v)",
			player.ID, validation.Reason, oldPos, clampedPos, currentVel)
	}

	// Record this movement update for anti-cheat statistics
	player.RecordMovementUpdate()

	player.SetPosition(clampedPos)

	return result
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

// clampToArena ensures position stays within map bounds
func clampToArena(pos Vector2, mapConfigs ...MapConfig) Vector2 {
	mapConfig := resolveMapConfig(mapConfigs...)
	halfWidth := PlayerWidth / 2
	halfHeight := PlayerHeight / 2

	x := math.Max(halfWidth, math.Min(pos.X, mapConfig.Width-halfWidth))
	y := math.Max(halfHeight, math.Min(pos.Y, mapConfig.Height-halfHeight))

	return Vector2{X: x, Y: y}
}

func (p *Physics) resolveMovement(currentPos, desiredPos Vector2) (Vector2, bool) {
	blocked := false

	resolvedX := clampToArena(Vector2{X: desiredPos.X, Y: currentPos.Y}, p.mapConfig)
	if resolvedX.X != desiredPos.X {
		blocked = true
	}
	var blockedX bool
	resolvedX.X, blockedX = p.resolveAxisCollisions(currentPos.X, resolvedX.X, currentPos.Y, true)
	blocked = blocked || blockedX

	resolvedY := clampToArena(Vector2{X: resolvedX.X, Y: desiredPos.Y}, p.mapConfig)
	if resolvedY.Y != desiredPos.Y {
		blocked = true
	}
	var blockedY bool
	resolvedY.Y, blockedY = p.resolveAxisCollisions(currentPos.Y, resolvedY.Y, resolvedX.X, false)
	blocked = blocked || blockedY

	return resolvedY, blocked
}

func (p *Physics) resolveAxisCollisions(oldAxis, newAxis, fixedAxis float64, horizontal bool) (float64, bool) {
	resolved := newAxis
	blocked := false

	for _, obstacle := range movementBlockingObstacles(p.mapConfig) {
		if !playerIntersectsObstacle(resolved, fixedAxis, obstacle, horizontal) {
			continue
		}

		if horizontal {
			if resolved > oldAxis {
				resolved = obstacle.X - PlayerWidth/2
			} else if resolved < oldAxis {
				resolved = obstacle.X + obstacle.Width + PlayerWidth/2
			}
		} else {
			if resolved > oldAxis {
				resolved = obstacle.Y - PlayerHeight/2
			} else if resolved < oldAxis {
				resolved = obstacle.Y + obstacle.Height + PlayerHeight/2
			}
		}

		blocked = true
	}

	return resolved, blocked
}

func playerIntersectsObstacle(axis, fixedAxis float64, obstacle MapObstacle, horizontal bool) bool {
	playerLeft := axis - PlayerWidth/2
	playerRight := axis + PlayerWidth/2
	playerTop := fixedAxis - PlayerHeight/2
	playerBottom := fixedAxis + PlayerHeight/2

	if !horizontal {
		playerLeft = fixedAxis - PlayerWidth/2
		playerRight = fixedAxis + PlayerWidth/2
		playerTop = axis - PlayerHeight/2
		playerBottom = axis + PlayerHeight/2
	}

	return playerRight > obstacle.X &&
		playerLeft < obstacle.X+obstacle.Width &&
		playerBottom > obstacle.Y &&
		playerTop < obstacle.Y+obstacle.Height
}

// HitEvent represents a successful projectile hit
type HitEvent struct {
	ProjectileID string
	VictimID     string
	AttackerID   string
}

// calculateDistance returns the Euclidean distance between two positions
func calculateDistance(pos1, pos2 Vector2) float64 {
	dx := pos2.X - pos1.X
	dy := pos2.Y - pos1.Y
	return math.Sqrt(dx*dx + dy*dy)
}

// sanitizeVector2 ensures a Vector2 contains no NaN or Inf values
// If NaN or Inf is detected, it's replaced with 0 and logged as an error
func sanitizeVector2(v Vector2, context string) Vector2 {
	result := v
	sanitized := false

	if math.IsNaN(v.X) || math.IsInf(v.X, 0) {
		log.Printf("ERROR: %s contains invalid X value: %v, replacing with 0", context, v.X)
		result.X = 0
		sanitized = true
	}
	if math.IsNaN(v.Y) || math.IsInf(v.Y, 0) {
		log.Printf("ERROR: %s contains invalid Y value: %v, replacing with 0", context, v.Y)
		result.Y = 0
		sanitized = true
	}

	if sanitized {
		log.Printf("WARNING: %s sanitized from %+v to %+v", context, v, result)
	}

	return result
}

// CheckPlayerCrateProximity checks if a player is within pickup range of a weapon crate
// Pickup range is defined by WeaponPickupRadius constant
// Returns false if crate is unavailable or player is dead
func (p *Physics) CheckPlayerCrateProximity(player *PlayerState, crate *WeaponCrate) bool {
	// Don't allow pickup if crate is unavailable
	if !crate.IsAvailable {
		return false
	}

	// Don't allow dead players to pick up weapons
	if !player.IsAlive() {
		return false
	}

	// Calculate distance between player and crate
	playerPos := player.GetPosition()
	distance := calculateDistance(playerPos, crate.Position)

	// Check if within pickup radius
	return distance <= WeaponPickupRadius
}

// CheckProjectilePlayerCollision checks if a projectile intersects a player's hitbox using AABB
// Hitbox is 48x48 pixels (PlayerWidth x PlayerHeight) centered on player position
// Returns true if collision detected
func (p *Physics) CheckProjectilePlayerCollision(proj *Projectile, player *PlayerState) bool {
	_, hit := p.projectilePlayerContact(proj, player)
	return hit
}

func (p *Physics) projectilePlayerContact(proj *Projectile, player *PlayerState) (segmentContact, bool) {
	// Don't check collision with dead players
	if !player.IsAlive() {
		return segmentContact{}, false
	}

	// Don't check collision with invulnerable players (spawn protection)
	if player.IsInvulnerable {
		return segmentContact{}, false
	}

	// Don't check collision with rolling players during i-frames
	if player.IsInvincibleFromRoll() {
		return segmentContact{}, false
	}

	// Don't check collision with owner
	if proj.OwnerID == player.ID {
		return segmentContact{}, false
	}

	playerPos := player.GetPosition()
	sweepStart := proj.PreviousPos
	sweepEnd := proj.Position
	if sweepStart == (Vector2{}) {
		sweepStart = proj.Position
	}

	// Validate range: reject hits beyond max projectile range
	startDistance := calculateDistance(proj.SpawnPosition, sweepStart)
	if startDistance > ProjectileMaxRange {
		return segmentContact{}, false
	}

	sweepEnd = clampSegmentToDistance(proj.SpawnPosition, sweepEnd, ProjectileMaxRange)
	playerContact, ok := segmentPlayerHitboxContact(sweepStart, sweepEnd, playerPos)
	if !ok {
		return segmentContact{}, false
	}

	wallContact, wallBlocked := firstObstacleContact(sweepStart, sweepEnd, p.mapConfig.Obstacles, func(obstacle MapObstacle) bool {
		return obstacle.BlocksProjectiles
	})
	if wallBlocked && wallContact.Distance <= playerContact.Distance {
		return segmentContact{}, false
	}

	return playerContact, true
}

// CheckAllProjectileCollisions checks all projectiles against all players
// Returns a slice of HitEvents for all detected collisions
func (p *Physics) CheckAllProjectileCollisions(projectiles []*Projectile, players []*PlayerState) []HitEvent {
	hits := make([]HitEvent, 0)

	for _, proj := range projectiles {
		if !proj.Active {
			continue
		}

		var nearestHit *HitEvent
		nearestDistance := math.MaxFloat64
		for _, player := range players {
			contact, ok := p.projectilePlayerContact(proj, player)
			if !ok {
				continue
			}
			if contact.Distance < nearestDistance {
				event := HitEvent{
					ProjectileID: proj.ID,
					VictimID:     player.ID,
					AttackerID:   proj.OwnerID,
				}
				nearestHit = &event
				nearestDistance = contact.Distance
			}
		}

		if nearestHit != nil {
			hits = append(hits, *nearestHit)
		}
	}

	return hits
}

// ValidationResult represents the result of movement validation
type ValidationResult struct {
	Valid  bool   // Whether the movement is valid
	Reason string // Reason for invalidity (empty if valid)
}

// ValidatePlayerMovement checks if a player's movement is physically possible
// This is used for server-side anti-cheat to detect impossible movements
// Returns a ValidationResult indicating if the movement is valid
func (p *Physics) ValidatePlayerMovement(oldPos, newPos, velocity Vector2, deltaTime float64, isRolling, isSprinting, movementBlocked bool) ValidationResult {
	// Constants for validation tolerance (allow small floating point errors)
	const speedTolerance = 1.05 // 5% tolerance for floating point precision

	// 1. Check bounds: player must stay within arena
	halfWidth := PlayerWidth / 2
	halfHeight := PlayerHeight / 2
	if newPos.X < halfWidth || newPos.X > p.mapConfig.Width-halfWidth ||
		newPos.Y < halfHeight || newPos.Y > p.mapConfig.Height-halfHeight {
		return ValidationResult{Valid: false, Reason: "out_of_bounds"}
	}

	// 2. Check speed limits based on player state
	var maxSpeed float64
	if isRolling {
		maxSpeed = DodgeRollVelocity
	} else if isSprinting {
		maxSpeed = SprintSpeed
	} else {
		maxSpeed = MovementSpeed
	}

	// Calculate actual velocity magnitude
	velocityMagnitude := math.Sqrt(velocity.X*velocity.X + velocity.Y*velocity.Y)

	// Check if velocity exceeds max speed (with tolerance)
	if velocityMagnitude > maxSpeed*speedTolerance {
		return ValidationResult{Valid: false, Reason: "speed_exceeded"}
	}

	// If movement was blocked by a wall or obstacle, actual delta will be less than expected
	// Skip the strict position matching check in this case
	if movementBlocked {
		return ValidationResult{Valid: true, Reason: ""}
	}

	// 3. Check if position change matches velocity * deltaTime (with tolerance)
	expectedDelta := Vector2{
		X: velocity.X * deltaTime,
		Y: velocity.Y * deltaTime,
	}
	actualDelta := Vector2{
		X: newPos.X - oldPos.X,
		Y: newPos.Y - oldPos.Y,
	}

	// Calculate magnitude of difference between expected and actual delta
	deltaDiff := Vector2{
		X: actualDelta.X - expectedDelta.X,
		Y: actualDelta.Y - expectedDelta.Y,
	}
	deltaDiffMagnitude := math.Sqrt(deltaDiff.X*deltaDiff.X + deltaDiff.Y*deltaDiff.Y)

	// Allow for some tolerance in position delta (5% of expected movement)
	expectedDeltaMagnitude := math.Sqrt(expectedDelta.X*expectedDelta.X + expectedDelta.Y*expectedDelta.Y)
	maxDeltaDiff := expectedDeltaMagnitude * 0.05

	// If the difference is too large, the movement is invalid
	// Only check this if there's actual movement (avoid division by zero for stationary players)
	if expectedDeltaMagnitude > 0.1 && deltaDiffMagnitude > maxDeltaDiff {
		return ValidationResult{Valid: false, Reason: "position_mismatch"}
	}

	return ValidationResult{Valid: true, Reason: ""}
}
