package game

import (
	"math"
)

// MeleeAttackResult represents the result of a melee attack
type MeleeAttackResult struct {
	HitPlayers       []*PlayerState // Players that were hit
	KnockbackApplied bool           // Whether knockback was applied
}

// PerformMeleeAttack executes a melee attack from an attacker
// Returns a result containing all players hit and whether knockback was applied
func PerformMeleeAttack(attacker *PlayerState, allPlayers []*PlayerState, weapon *Weapon, mapConfigs ...MapConfig) *MeleeAttackResult {
	if weapon == nil || !weapon.IsMelee() {
		return &MeleeAttackResult{
			HitPlayers:       []*PlayerState{},
			KnockbackApplied: false,
		}
	}

	result := &MeleeAttackResult{
		HitPlayers:       make([]*PlayerState, 0),
		KnockbackApplied: false,
	}

	mapConfig := resolveMapConfig(mapConfigs...)

	// Check each potential target
	for _, target := range allPlayers {
		// Skip self
		if target.ID == attacker.ID {
			continue
		}

		// Skip dead players
		if !target.IsAlive() {
			continue
		}

		// Check if target is within range and arc
		if isInMeleeRange(attacker, target, weapon) && hasMeleeReach(attacker, target, weapon, mapConfig) {
			result.HitPlayers = append(result.HitPlayers, target)

			// Apply damage using thread-safe method
			target.TakeDamage(weapon.Damage)

			// Apply knockback if weapon has it (Bat only)
			if weapon.KnockbackDistance > 0 {
				applyKnockback(attacker, target, weapon.KnockbackDistance, mapConfig)
				result.KnockbackApplied = true
			}
		}
	}

	return result
}

func hasMeleeReach(attacker *PlayerState, target *PlayerState, weapon *Weapon, mapConfig MapConfig) bool {
	attackerPos := attacker.GetPosition()
	aimAngle := attacker.GetAimAngle()
	samplePoints := meleeHitboxSamplePoints(target.GetPosition())

	centerPoint := samplePoints[0]
	if !meleePointWithinRangeAndArc(attackerPos, centerPoint, aimAngle, weapon) {
		return false
	}
	if segmentBlockedByObstacle(attackerPos, centerPoint, mapConfig.Obstacles) {
		return false
	}

	reachableCount := 1
	for _, point := range samplePoints[1:] {
		if !meleePointWithinRangeAndArc(attackerPos, point, aimAngle, weapon) {
			continue
		}

		if !segmentBlockedByObstacle(attackerPos, point, mapConfig.Obstacles) {
			reachableCount++
			if reachableCount >= 5 {
				return true
			}
		}
	}

	return false
}

func segmentBlockedByObstacle(start, end Vector2, obstacles []MapObstacle) bool {
	contact, blocked := firstObstacleContact(start, end, obstacles, func(obstacle MapObstacle) bool {
		return obstacle.BlocksMovement || obstacle.BlocksProjectiles || obstacle.BlocksLineOfSight
	})
	if !blocked {
		return false
	}

	targetDistance := calculateDistance(start, end)
	return contact.Distance <= targetDistance
}

// isInMeleeRange checks if target is within the melee weapon's range and arc
func isInMeleeRange(attacker *PlayerState, target *PlayerState, weapon *Weapon) bool {
	// Get positions (thread-safe)
	attackerPos := attacker.GetPosition()
	aimAngle := attacker.GetAimAngle()
	for _, point := range meleeHitboxSamplePoints(target.GetPosition()) {
		if meleePointWithinRangeAndArc(attackerPos, point, aimAngle, weapon) {
			return true
		}
	}
	return false
}

func meleeHitboxSamplePoints(targetPos Vector2) []Vector2 {
	left := targetPos.X - PlayerWidth/2
	right := targetPos.X + PlayerWidth/2
	top := targetPos.Y - PlayerHeight/2
	bottom := targetPos.Y + PlayerHeight/2
	return []Vector2{
		targetPos,
		{X: left, Y: targetPos.Y},
		{X: right, Y: targetPos.Y},
		{X: targetPos.X, Y: top},
		{X: targetPos.X, Y: bottom},
		{X: left, Y: top},
		{X: right, Y: top},
		{X: left, Y: bottom},
		{X: right, Y: bottom},
	}
}

func meleePointWithinRangeAndArc(attackerPos, targetPoint Vector2, aimAngle float64, weapon *Weapon) bool {
	dx := targetPoint.X - attackerPos.X
	dy := targetPoint.Y - attackerPos.Y
	distance := math.Sqrt(dx*dx + dy*dy)
	if distance > weapon.Range {
		return false
	}

	angleToTarget := math.Atan2(dy, dx) * (180 / math.Pi)
	if angleToTarget < 0 {
		angleToTarget += 360
	}
	aimAngleDeg := aimAngle * (180 / math.Pi)
	if aimAngleDeg < 0 {
		aimAngleDeg += 360
	}

	angleDiff := math.Abs(angleToTarget - aimAngleDeg)
	if angleDiff > 180 {
		angleDiff = 360 - angleDiff
	}

	return angleDiff <= weapon.ArcDegrees/2
}

// applyKnockback applies knockback to a target based on direction from attacker
// Knockback velocity is 200 px/s for 0.2s = 40px total displacement
func applyKnockback(attacker *PlayerState, target *PlayerState, knockbackDistance float64, mapConfigs ...MapConfig) {
	// Get positions (thread-safe)
	attackerPos := attacker.GetPosition()
	targetPos := target.GetPosition()
	mapConfig := resolveMapConfig(mapConfigs...)

	// Calculate direction from attacker to target
	dx := targetPos.X - attackerPos.X
	dy := targetPos.Y - attackerPos.Y
	distance := math.Sqrt(dx*dx + dy*dy)

	if distance == 0 {
		return // No knockback if exactly on top of each other
	}

	// Normalize direction vector
	dirX := dx / distance
	dirY := dy / distance

	// Apply knockback distance
	// Story 3.2 specifies: 200 px/s for 0.2s = 40px
	// We apply the displacement directly to position
	newX := targetPos.X + dirX*knockbackDistance
	newY := targetPos.Y + dirY*knockbackDistance

	desired := clampToArena(Vector2{X: newX, Y: newY}, mapConfig)
	finalPos := desired

	for _, obstacle := range movementBlockingObstacles(mapConfig) {
		expanded := rect{
			x:      obstacle.X - PlayerWidth/2,
			y:      obstacle.Y - PlayerHeight/2,
			width:  obstacle.Width + PlayerWidth,
			height: obstacle.Height + PlayerHeight,
		}

		contact, blocked := segmentRectContact(targetPos, desired, expanded)
		if blocked && contact.Distance < calculateDistance(targetPos, finalPos) {
			finalPos = contact.Point
		}
	}

	// Update position (thread-safe)
	target.SetPosition(finalPos)
}
