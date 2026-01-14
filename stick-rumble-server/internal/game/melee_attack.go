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
func PerformMeleeAttack(attacker *PlayerState, allPlayers []*PlayerState, weapon *Weapon) *MeleeAttackResult {
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
		if isInMeleeRange(attacker, target, weapon) {
			result.HitPlayers = append(result.HitPlayers, target)

			// Apply damage using thread-safe method
			target.TakeDamage(weapon.Damage)

			// Apply knockback if weapon has it (Bat only)
			if weapon.KnockbackDistance > 0 {
				applyKnockback(attacker, target, weapon.KnockbackDistance)
				result.KnockbackApplied = true
			}
		}
	}

	return result
}

// isInMeleeRange checks if target is within the melee weapon's range and arc
func isInMeleeRange(attacker *PlayerState, target *PlayerState, weapon *Weapon) bool {
	// Get positions (thread-safe)
	attackerPos := attacker.GetPosition()
	targetPos := target.GetPosition()
	aimAngle := attacker.GetAimAngle()

	// Calculate distance between attacker and target
	dx := targetPos.X - attackerPos.X
	dy := targetPos.Y - attackerPos.Y
	distance := math.Sqrt(dx*dx + dy*dy)

	// Check if within range
	if distance > weapon.Range {
		return false
	}

	// Check if within arc (cone in front of player based on aim direction)
	// Calculate angle from attacker to target
	angleToTarget := math.Atan2(dy, dx) * (180 / math.Pi)

	// Normalize angles to [0, 360)
	if angleToTarget < 0 {
		angleToTarget += 360
	}
	aimAngleDeg := aimAngle * (180 / math.Pi) // Convert radians to degrees
	if aimAngleDeg < 0 {
		aimAngleDeg += 360
	}

	// Calculate angular difference
	angleDiff := math.Abs(angleToTarget - aimAngleDeg)
	if angleDiff > 180 {
		angleDiff = 360 - angleDiff
	}

	// Check if within arc (weapon.ArcDegrees is the full cone, so half on each side)
	halfArc := weapon.ArcDegrees / 2
	return angleDiff <= halfArc
}

// applyKnockback applies knockback to a target based on direction from attacker
// Knockback velocity is 200 px/s for 0.2s = 40px total displacement
func applyKnockback(attacker *PlayerState, target *PlayerState, knockbackDistance float64) {
	// Get positions (thread-safe)
	attackerPos := attacker.GetPosition()
	targetPos := target.GetPosition()

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

	// Ensure target stays within arena bounds
	if newX < 0 {
		newX = 0
	}
	if newX > ArenaWidth {
		newX = ArenaWidth
	}
	if newY < 0 {
		newY = 0
	}
	if newY > ArenaHeight {
		newY = ArenaHeight
	}

	// Update position (thread-safe)
	target.SetPosition(Vector2{X: newX, Y: newY})
}
