package game

import (
	"math"
	"testing"
)

// Helper function to create a player at a specific position with aim angle in degrees
func createTestPlayer(id string, x, y, aimAngleDegrees float64) *PlayerState {
	p := NewPlayerState(id)
	p.SetPosition(Vector2{X: x, Y: y})
	p.SetAimAngle(aimAngleDegrees * (math.Pi / 180)) // Convert degrees to radians
	return p
}

func TestPerformMeleeAttack_NilWeapon(t *testing.T) {
	attacker := createTestPlayer("attacker", 100, 100, 0)
	target := createTestPlayer("target", 150, 100, 0)

	result := PerformMeleeAttack(attacker, []*PlayerState{target}, nil)

	if len(result.HitPlayers) != 0 {
		t.Errorf("Expected 0 hits with nil weapon, got %d", len(result.HitPlayers))
	}
	if result.KnockbackApplied {
		t.Error("Expected no knockback with nil weapon")
	}
}

func TestPerformMeleeAttack_NonMeleeWeapon(t *testing.T) {
	attacker := createTestPlayer("attacker", 100, 100, 0)
	target := createTestPlayer("target", 150, 100, 0)
	pistol := NewPistol()

	result := PerformMeleeAttack(attacker, []*PlayerState{target}, pistol)

	if len(result.HitPlayers) != 0 {
		t.Errorf("Expected 0 hits with ranged weapon, got %d", len(result.HitPlayers))
	}
	if result.KnockbackApplied {
		t.Error("Expected no knockback with ranged weapon")
	}
}

func TestPerformMeleeAttack_BatHitsSingleTarget(t *testing.T) {
	bat := NewBat()
	attacker := createTestPlayer("attacker", 100, 100, 0) // Aiming right (0°)
	// Target at exactly 50px to the right (within 90px range, within 80° arc)
	target := createTestPlayer("target", 150, 100, 0)

	result := PerformMeleeAttack(attacker, []*PlayerState{attacker, target}, bat)

	if len(result.HitPlayers) != 1 {
		t.Errorf("Expected 1 hit, got %d", len(result.HitPlayers))
	}
	if result.HitPlayers[0].ID != "target" {
		t.Errorf("Expected target to be hit, got %s", result.HitPlayers[0].ID)
	}
	// Bat does 25 damage
	targetHealth := result.HitPlayers[0].Health
	if targetHealth != 75 {
		t.Errorf("Expected target health 75, got %d", targetHealth)
	}
	if !result.KnockbackApplied {
		t.Error("Expected knockback to be applied with Bat")
	}
}

func TestPerformMeleeAttack_KatanaHitsSingleTarget(t *testing.T) {
	katana := NewKatana()
	attacker := createTestPlayer("attacker", 100, 100, 0) // Aiming right (0°)
	// Target at exactly 70px to the right (within 110px range, within 80° arc)
	target := createTestPlayer("target", 170, 100, 0)

	result := PerformMeleeAttack(attacker, []*PlayerState{attacker, target}, katana)

	if len(result.HitPlayers) != 1 {
		t.Errorf("Expected 1 hit, got %d", len(result.HitPlayers))
	}
	// Katana does 45 damage
	targetHealth := result.HitPlayers[0].Health
	if targetHealth != 55 {
		t.Errorf("Expected target health 55, got %d", targetHealth)
	}
	if result.KnockbackApplied {
		t.Error("Expected no knockback with Katana")
	}
}

func TestPerformMeleeAttack_TargetOutOfRange(t *testing.T) {
	bat := NewBat() // 90px range
	attacker := createTestPlayer("attacker", 100, 100, 0)
	// Target at 100px to the right (beyond 90px range)
	target := createTestPlayer("target", 200, 100, 0)

	result := PerformMeleeAttack(attacker, []*PlayerState{attacker, target}, bat)

	if len(result.HitPlayers) != 0 {
		t.Errorf("Expected 0 hits (out of range), got %d", len(result.HitPlayers))
	}
	if target.Health != 100 {
		t.Errorf("Expected target health unchanged (100), got %d", target.Health)
	}
}

func TestPerformMeleeAttack_TargetOutsideArc(t *testing.T) {
	bat := NewBat()                                       // 80° arc (40° on each side of aim direction)
	attacker := createTestPlayer("attacker", 100, 100, 0) // Aiming right (0°)
	// Target directly behind attacker (180° from aim direction, outside 80° arc)
	target := createTestPlayer("target", 50, 100, 0)

	result := PerformMeleeAttack(attacker, []*PlayerState{attacker, target}, bat)

	if len(result.HitPlayers) != 0 {
		t.Errorf("Expected 0 hits (outside arc), got %d", len(result.HitPlayers))
	}
	if target.Health != 100 {
		t.Errorf("Expected target health unchanged (100), got %d", target.Health)
	}
}

func TestPerformMeleeAttack_MultipleTargetsInArc(t *testing.T) {
	bat := NewBat()                                       // 90px range, 80° arc
	attacker := createTestPlayer("attacker", 100, 100, 0) // Aiming right

	// Target 1: directly to the right (within range and arc)
	target1 := createTestPlayer("target1", 150, 100, 0)
	// Target 2: to the right and slightly up (within range and arc, ~20° from aim)
	target2 := createTestPlayer("target2", 140, 120, 0)
	// Target 3: to the right and down (within 40° half-arc, ~32° from aim)
	target3 := createTestPlayer("target3", 140, 125, 0)

	result := PerformMeleeAttack(attacker, []*PlayerState{attacker, target1, target2, target3}, bat)

	// All 3 should be hit (AoE attack)
	if len(result.HitPlayers) != 3 {
		t.Errorf("Expected 3 hits (AoE), got %d", len(result.HitPlayers))
	}

	// Verify all took damage
	if target1.Health != 75 {
		t.Errorf("Expected target1 health 75, got %d", target1.Health)
	}
	if target2.Health != 75 {
		t.Errorf("Expected target2 health 75, got %d", target2.Health)
	}
	if target3.Health != 75 {
		t.Errorf("Expected target3 health 75, got %d", target3.Health)
	}
}

func TestPerformMeleeAttack_SkipsDeadPlayers(t *testing.T) {
	bat := NewBat()
	attacker := createTestPlayer("attacker", 100, 100, 0)
	// Target is dead
	target := createTestPlayer("target", 150, 100, 0)
	target.TakeDamage(100) // Kill the target

	result := PerformMeleeAttack(attacker, []*PlayerState{attacker, target}, bat)

	if len(result.HitPlayers) != 0 {
		t.Errorf("Expected 0 hits (target dead), got %d", len(result.HitPlayers))
	}
}

func TestPerformMeleeAttack_SkipsSelf(t *testing.T) {
	bat := NewBat()
	attacker := createTestPlayer("attacker", 100, 100, 0)

	result := PerformMeleeAttack(attacker, []*PlayerState{attacker}, bat)

	if len(result.HitPlayers) != 0 {
		t.Errorf("Expected 0 hits (attacker can't hit self), got %d", len(result.HitPlayers))
	}
	if attacker.Health != 100 {
		t.Errorf("Expected attacker health unchanged, got %d", attacker.Health)
	}
}

func TestPerformMeleeAttack_KillsTarget(t *testing.T) {
	bat := NewBat() // 25 damage
	attacker := createTestPlayer("attacker", 100, 100, 0)
	// Target with low health
	target := createTestPlayer("target", 150, 100, 0)
	target.TakeDamage(80) // Reduce to 20 health

	result := PerformMeleeAttack(attacker, []*PlayerState{attacker, target}, bat)

	if len(result.HitPlayers) != 1 {
		t.Errorf("Expected 1 hit, got %d", len(result.HitPlayers))
	}
	// Health should be clamped to 0
	if target.Health != 0 {
		t.Errorf("Expected target health 0 (killed), got %d", target.Health)
	}
}

func TestApplyKnockback_BasicKnockback(t *testing.T) {
	attacker := createTestPlayer("attacker", 100, 100, 0)
	target := createTestPlayer("target", 150, 100, 0)

	initialPos := target.GetPosition()
	applyKnockback(attacker, target, 40) // Bat knockback is 40px

	newPos := target.GetPosition()
	// Target should be pushed 40px further to the right
	expectedX := initialPos.X + 40 // Direction is (1, 0), so 40px * 1 = 40px
	if math.Abs(newPos.X-expectedX) > 0.01 {
		t.Errorf("Expected target X %f, got %f", expectedX, newPos.X)
	}
	if newPos.Y != 100 {
		t.Errorf("Expected target Y unchanged (100), got %f", newPos.Y)
	}
}

func TestApplyKnockback_DiagonalKnockback(t *testing.T) {
	attacker := createTestPlayer("attacker", 100, 100, 45)
	// Target at 45° angle from attacker
	target := createTestPlayer("target", 130, 130, 0)

	initialPos := target.GetPosition()
	applyKnockback(attacker, target, 40)

	newPos := target.GetPosition()
	attackerPos := attacker.GetPosition()

	// Check that target moved away from attacker
	dx := newPos.X - attackerPos.X
	dy := newPos.Y - attackerPos.Y
	newDistance := math.Sqrt(dx*dx + dy*dy)

	oldDx := initialPos.X - attackerPos.X
	oldDy := initialPos.Y - attackerPos.Y
	oldDistance := math.Sqrt(oldDx*oldDx + oldDy*oldDy)

	if newDistance <= oldDistance {
		t.Errorf("Expected target to move away from attacker, old distance %f, new distance %f", oldDistance, newDistance)
	}

	// Total displacement should be approximately 40px
	movedX := newPos.X - initialPos.X
	movedY := newPos.Y - initialPos.Y
	totalMoved := math.Sqrt(movedX*movedX + movedY*movedY)
	if math.Abs(totalMoved-40) > 0.01 {
		t.Errorf("Expected total knockback distance 40px, got %f", totalMoved)
	}
}

func TestApplyKnockback_RightEdgeClamping(t *testing.T) {
	attacker := createTestPlayer("attacker", ArenaWidth-30, 100, 0)
	// Target near right edge
	target := createTestPlayer("target", ArenaWidth-10, 100, 0)

	applyKnockback(attacker, target, 40)

	newPos := target.GetPosition()
	// Target should be clamped to arena width
	if newPos.X != ArenaWidth {
		t.Errorf("Expected target X clamped to ArenaWidth (%f), got %f", ArenaWidth, newPos.X)
	}
}

func TestApplyKnockback_LeftEdgeClamping(t *testing.T) {
	attacker := createTestPlayer("attacker", 30, 100, 180) // Aiming left
	// Target near left edge
	target := createTestPlayer("target", 10, 100, 0)

	applyKnockback(attacker, target, 40)

	newPos := target.GetPosition()
	// Target should be clamped to 0
	if newPos.X != 0 {
		t.Errorf("Expected target X clamped to 0, got %f", newPos.X)
	}
}

func TestApplyKnockback_TopEdgeClamping(t *testing.T) {
	attacker := createTestPlayer("attacker", 100, 30, -90) // Aiming up
	// Target near top edge
	target := createTestPlayer("target", 100, 10, 0)

	applyKnockback(attacker, target, 40)

	newPos := target.GetPosition()
	// Target should be clamped to 0
	if newPos.Y != 0 {
		t.Errorf("Expected target Y clamped to 0, got %f", newPos.Y)
	}
}

func TestApplyKnockback_BottomEdgeClamping(t *testing.T) {
	attacker := createTestPlayer("attacker", 100, ArenaHeight-30, 90) // Aiming down
	// Target near bottom edge
	target := createTestPlayer("target", 100, ArenaHeight-10, 0)

	applyKnockback(attacker, target, 40)

	newPos := target.GetPosition()
	// Target should be clamped to ArenaHeight
	if newPos.Y != ArenaHeight {
		t.Errorf("Expected target Y clamped to ArenaHeight (%f), got %f", ArenaHeight, newPos.Y)
	}
}

func TestApplyKnockback_ZeroDistance(t *testing.T) {
	attacker := createTestPlayer("attacker", 100, 100, 0)
	target := createTestPlayer("target", 100, 100, 0)

	initialPos := target.GetPosition()
	applyKnockback(attacker, target, 40)

	newPos := target.GetPosition()
	// No knockback should be applied if players are at same position
	if newPos.X != initialPos.X || newPos.Y != initialPos.Y {
		t.Errorf("Expected no position change when at same location, got X:%f Y:%f", newPos.X, newPos.Y)
	}
}

func TestIsInMeleeRange_DirectlyInFront(t *testing.T) {
	bat := NewBat()
	attacker := createTestPlayer("attacker", 100, 100, 0)
	target := createTestPlayer("target", 150, 100, 0)

	inRange := isInMeleeRange(attacker, target, bat)

	if !inRange {
		t.Error("Expected target directly in front to be in range")
	}
}

func TestIsInMeleeRange_AtEdgeOfArc(t *testing.T) {
	bat := NewBat() // 80° arc = 40° on each side
	attacker := createTestPlayer("attacker", 100, 100, 0)
	// Target at 39° from aim direction (just inside edge of 40° half-arc)
	// Distance = 50px (within 90px range)
	angleRad := 39 * (math.Pi / 180)
	targetX := 100 + 50*math.Cos(angleRad)
	targetY := 100 + 50*math.Sin(angleRad)
	target := createTestPlayer("target", targetX, targetY, 0)

	inRange := isInMeleeRange(attacker, target, bat)

	if !inRange {
		t.Error("Expected target at 39° (inside 40° half-arc) to be in range")
	}
}

func TestIsInMeleeRange_JustOutsideArc(t *testing.T) {
	bat := NewBat() // 80° arc = 40° on each side
	attacker := createTestPlayer("attacker", 100, 100, 0)
	// Target at 41° from aim direction (outside 40° half-arc boundary)
	angleRad := 41 * (math.Pi / 180)
	targetX := 100 + 50*math.Cos(angleRad)
	targetY := 100 + 50*math.Sin(angleRad)
	target := createTestPlayer("target", targetX, targetY, 0)

	inRange := isInMeleeRange(attacker, target, bat)

	if inRange {
		t.Error("Expected target at 41° (outside 40° half-arc) to NOT be in range")
	}
}

func TestIsInMeleeRange_BehindPlayer(t *testing.T) {
	bat := NewBat()
	attacker := createTestPlayer("attacker", 100, 100, 0)
	// Target directly behind (180° from aim)
	target := createTestPlayer("target", 50, 100, 0)

	inRange := isInMeleeRange(attacker, target, bat)

	if inRange {
		t.Error("Expected target behind player to NOT be in range")
	}
}

func TestIsInMeleeRange_AtMaxRange(t *testing.T) {
	bat := NewBat() // 90px range
	attacker := createTestPlayer("attacker", 100, 100, 0)
	// Target at exactly 90px to the right
	target := createTestPlayer("target", 190, 100, 0)

	inRange := isInMeleeRange(attacker, target, bat)

	if !inRange {
		t.Error("Expected target at max range (90px) to be in range")
	}
}

func TestIsInMeleeRange_JustBeyondMaxRange(t *testing.T) {
	bat := NewBat() // 90px range
	attacker := createTestPlayer("attacker", 100, 100, 0)
	// Target at 91px to the right (just beyond range)
	target := createTestPlayer("target", 191, 100, 0)

	inRange := isInMeleeRange(attacker, target, bat)

	if inRange {
		t.Error("Expected target just beyond max range (91px) to NOT be in range")
	}
}

func TestIsInMeleeRange_NegativeAimAngle(t *testing.T) {
	bat := NewBat()
	attacker := createTestPlayer("attacker", 100, 100, -90) // Aiming down
	// Target below attacker
	target := createTestPlayer("target", 100, 50, 0)

	inRange := isInMeleeRange(attacker, target, bat)

	if !inRange {
		t.Error("Expected target in front (with negative aim angle) to be in range")
	}
}

func TestIsInMeleeRange_360DegreeWrap(t *testing.T) {
	bat := NewBat()
	attacker := createTestPlayer("attacker", 100, 100, 350) // Near 0°
	// Target at 10° (should be within 80° arc due to wraparound)
	angleRad := 10 * (math.Pi / 180)
	targetX := 100 + 50*math.Cos(angleRad)
	targetY := 100 + 50*math.Sin(angleRad)
	target := createTestPlayer("target", targetX, targetY, 0)

	inRange := isInMeleeRange(attacker, target, bat)

	if !inRange {
		t.Error("Expected target within arc (accounting for 360° wraparound) to be in range")
	}
}

func TestKatanaRange_LongerThanBat(t *testing.T) {
	bat := NewBat()
	katana := NewKatana()
	attacker := createTestPlayer("attacker", 100, 100, 0)
	// Target at 100px (beyond bat range 90px, within katana range 110px)
	target := createTestPlayer("target", 200, 100, 0)

	batInRange := isInMeleeRange(attacker, target, bat)
	katanaInRange := isInMeleeRange(attacker, target, katana)

	if batInRange {
		t.Error("Expected target at 100px to be out of Bat range (90px)")
	}
	if !katanaInRange {
		t.Error("Expected target at 100px to be in Katana range (110px)")
	}
}
