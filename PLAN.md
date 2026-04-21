# Melee Combat v1.2.1 Implementation Plan
## Strict Line-of-Sight Requirements for Wall Blocking

**Based on Spec Commit**: `c0035ff` - specs(melee): v1.2.1 - strict line-of-sight requirements for wall blocking

---

## Overview

This plan implements the strict line-of-sight (LoS) requirements specified in melee.md v1.2.1. The key behavioral change is that melee attacks now require:

1. **Center point must be clear**: The target's center point must have an unobstructed path from the attacker. If blocked, the attack fails immediately (no hit).
2. **Majority of hitbox must be exposed**: At least 5 of 9 sample points on the target hitbox must be reachable (center + at least 4 of 8 edge/corner points).
3. **Boundary-inclusive intersection**: If the segment touches or crosses any wall boundary, that target point is considered blocked.
4. **First-contact resolution**: When multiple obstacles exist, the closest obstacle along the segment blocks the path.

---

## Current Code State

**Existing Files**:
- `stick-rumble-server/internal/game/melee_attack.go` - Contains `PerformMeleeAttack`, `hasMeleeReach`, `isInMeleeRange`, `meleeHitboxSamplePoints`, `meleePointWithinRangeAndArc`, `applyKnockback`
- `stick-rumble-server/internal/game/melee_attack_test.go` - 527 lines of existing tests
- `stick-rumble-server/internal/game/barrier_geometry.go` - Geometry helpers: `segmentRectContact`, `firstObstacleContact`, `clampSegmentToDistance`

**Current `hasMeleeReach` Implementation** (lines 60-79 in melee_attack.go):
```go
func hasMeleeReach(attacker *PlayerState, target *PlayerState, weapon *Weapon, mapConfig MapConfig) bool {
	attackerPos := attacker.GetPosition()
	aimAngle := attacker.GetAimAngle()
	for _, point := range meleeHitboxSamplePoints(target.GetPosition()) {
		if !meleePointWithinRangeAndArc(attackerPos, point, aimAngle, weapon) {
			continue
		}

		sweepEnd := clampSegmentToDistance(attackerPos, point, weapon.Range)
		wallContact, blocked := firstObstacleContact(attackerPos, sweepEnd, mapConfig.Obstacles, func(obstacle MapObstacle) bool {
			return obstacle.BlocksMovement || obstacle.BlocksProjectiles || obstacle.BlocksLineOfSight
		})
		pointDistance := calculateDistance(attackerPos, point)
		if !blocked || wallContact.Distance > pointDistance {
			return true
		}
	}

	return false
}
```

**Gap Analysis**: The current implementation:
1. ✅ Samples 9 points on target hitbox
2. ✅ Checks range and arc for each point
3. ✅ Uses `firstObstacleContact` for blocking
4. ❌ Does NOT short-circuit if center point is blocked
5. ❌ Does NOT require majority (5/9) of points to be reachable - returns true on first reachable point
6. ❌ Does NOT properly count reachable points

---

## Red/Green TDD Implementation Slices

### Slice 1: Center Point Short-Circuit Test (RED)

**File**: `stick-rumble-server/internal/game/melee_attack_test.go`

**New Test**:
```go
func TestHasMeleeReach_CenterBlockedShortCircuit(t *testing.T) {
	bat := NewBat()
	mapConfig := openTestMapConfig()
	mapConfig.Obstacles = []MapObstacle{
		{ID: "wall", X: 130, Y: 90, Width: 20, Height: 20, BlocksMovement: true, BlocksProjectiles: true, BlocksLineOfSight: true},
	}
	attacker := createTestPlayer("attacker", 100, 100, 0)
	target := createTestPlayer("target", 170, 100, 0)

	// Center point is blocked by wall - should fail immediately
	reachable := hasMeleeReach(attacker, target, bat, mapConfig)

	if reachable {
		t.Error("Expected hasMeleeReach to return false when center point is blocked")
	}
}
```

**Expected**: Test fails because current implementation doesn't check center point first.

### Slice 2: Implement Center Point Short-Circuit (GREEN)

**File**: `stick-rumble-server/internal/game/melee_attack.go`

**Modify `hasMeleeReach`** (lines 60-79):
```go
func hasMeleeReach(attacker *PlayerState, target *PlayerState, weapon *Weapon, mapConfig MapConfig) bool {
	attackerPos := attacker.GetPosition()
	aimAngle := attacker.GetAimAngle()
	samplePoints := meleeHitboxSamplePoints(target.GetPosition())

	// 1. Center point must be clear (short-circuit if blocked)
	centerPoint := samplePoints[0] // center is first point
	if !meleePointWithinRangeAndArc(attackerPos, centerPoint, aimAngle, weapon) {
		return false
	}
	sweepEnd := clampSegmentToDistance(attackerPos, centerPoint, weapon.Range)
	wallContact, blocked := firstObstacleContact(attackerPos, sweepEnd, mapConfig.Obstacles, func(obstacle MapObstacle) bool {
		return obstacle.BlocksMovement || obstacle.BlocksProjectiles || obstacle.BlocksLineOfSight
	})
	centerDistance := calculateDistance(attackerPos, centerPoint)
	if blocked && wallContact.Distance <= centerDistance {
		return false // Center point is blocked
	}

	// 2. Count reachable points (center already counted as reachable)
	reachableCount := 1
	for i := 1; i < len(samplePoints); i++ {
		point := samplePoints[i]
		if !meleePointWithinRangeAndArc(attackerPos, point, aimAngle, weapon) {
			continue
		}

		sweepEnd := clampSegmentToDistance(attackerPos, point, weapon.Range)
		wallContact, blocked := firstObstacleContact(attackerPos, sweepEnd, mapConfig.Obstacles, func(obstacle MapObstacle) bool {
			return obstacle.BlocksMovement || obstacle.BlocksProjectiles || obstacle.BlocksLineOfSight
		})
		pointDistance := calculateDistance(attackerPos, point)
		if !blocked || wallContact.Distance > pointDistance {
			reachableCount++
			// Short-circuit: stop if we already have 5 reachable points
			if reachableCount >= 5 {
				return true
			}
		}
	}

	// 3. Return true if majority (5/9) or more points are reachable
	return reachableCount >= 5
}
```

**Expected**: Slice 1 test now passes.

### Slice 3: Majority Reachable Points Test (RED)

**File**: `stick-rumble-server/internal/game/melee_attack_test.go`

**New Test**:
```go
func TestHasMeleeReach_MajorityReachableRequired(t *testing.T) {
	bat := NewBat()
	mapConfig := openTestMapConfig()
	// Wall blocks 5 of 9 points (center + 4 others), leaving only 4 reachable
	mapConfig.Obstacles = []MapObstacle{
		{ID: "wall", X: 130, Y: 98, Width: 20, Height: 4, BlocksMovement: true, BlocksProjectiles: true, BlocksLineOfSight: true},
	}
	attacker := createTestPlayer("attacker", 100, 100, 0)
	target := createTestPlayer("target", 170, 100, 0)

	reachable := hasMeleeReach(attacker, target, bat, mapConfig)

	// Only 4 points reachable (less than majority of 5), should fail
	if reachable {
		t.Error("Expected hasMeleeReach to return false when fewer than 5 points are reachable")
	}
}

func TestHasMeleeReach_ExactlyFivePointsReachable(t *testing.T) {
	bat := NewBat()
	mapConfig := openTestMapConfig()
	// Wall blocks exactly 4 points, leaving 5 reachable (majority)
	mapConfig.Obstacles = []MapObstacle{
		{ID: "wall", X: 130, Y: 98, Width: 20, Height: 2, BlocksMovement: true, BlocksProjectiles: true, BlocksLineOfSight: true},
	}
	attacker := createTestPlayer("attacker", 100, 100, 0)
	target := createTestPlayer("target", 170, 100, 0)

	reachable := hasMeleeReach(attacker, target, bat, mapConfig)

	// Exactly 5 points reachable (majority), should succeed
	if !reachable {
		t.Error("Expected hasMeleeReach to return true when exactly 5 points are reachable")
	}
}
```

**Expected**: Tests fail because current implementation returns true on first reachable point, not majority.

### Slice 4: Boundary-Inclusive Intersection Test (RED)

**File**: `stick-rumble-server/internal/game/barrier_geometry_test.go`

**New Test**:
```go
func TestSegmentRectContact_BoundaryInclusive(t *testing.T) {
	// Segment that touches the rectangle boundary exactly
	start := Vector2{X: 100, Y: 100}
	end := Vector2{X: 150, Y: 100}
	
	// Rectangle with left edge at x=150 (segment ends exactly on boundary)
	area := rect{x: 150, y: 90, width: 20, height: 20}
	
	contact, blocked := segmentRectContact(start, end, area)
	
	// Touching the boundary should be considered blocked (inclusive)
	if !blocked {
		t.Error("Expected segment touching rectangle boundary to be blocked (boundary-inclusive)")
	}
	if contact.Distance != 50 {
		t.Errorf("Expected contact distance 50, got %f", contact.Distance)
	}
}
```

**Expected**: Test may pass depending on current `segmentRectContact` implementation. If it fails, we need to verify boundary-inclusive behavior.

### Slice 5: First-Contact Resolution Test (RED)

**File**: `stick-rumble-server/internal/game/barrier_geometry_test.go`

**New Test**:
```go
func TestFirstObstacleContact_ReturnsClosestObstacle(t *testing.T) {
	start := Vector2{X: 100, Y: 100}
	end := Vector2{X: 300, Y: 100}
	
	obstacles := []MapObstacle{
		{ID: "far-wall", X: 250, Y: 80, Width: 20, Height: 40, BlocksMovement: true, BlocksProjectiles: true, BlocksLineOfSight: true},
		{ID: "near-wall", X: 150, Y: 80, Width: 20, Height: 40, BlocksMovement: true, BlocksProjectiles: true, BlocksLineOfSight: true},
	}
	
	contact, blocked := firstObstacleContact(start, end, obstacles, func(ob MapObstacle) bool {
		return ob.BlocksLineOfSight
	})
	
	if !blocked {
		t.Error("Expected path to be blocked")
	}
	if contact.Obstacle == nil || contact.Obstacle.ID != "near-wall" {
		t.Errorf("Expected closest obstacle to be 'near-wall' at x=150, got %v", contact.Obstacle)
	}
	// Distance from (100,100) to near-wall at x=150 should be ~50
	if contact.Distance < 49 || contact.Distance > 51 {
		t.Errorf("Expected contact distance ~50, got %f", contact.Distance)
	}
}
```

**Expected**: Test verifies that `firstObstacleContact` correctly returns the closest obstacle. Should pass if implementation is correct.

### Slice 6: Integration - Strict LoS Implementation (GREEN)

After all unit tests pass, verify the integration in `hasMeleeReach`:

**File**: `stick-rumble-server/internal/game/melee_attack_test.go`

**Update Existing Tests** if needed:
- `TestPerformMeleeAttack_WallBetweenPlayersPreventsDamage` - should already pass
- `TestPerformMeleeAttack_PartialCoverStillHitsExposedTarget` - should verify majority rule

### Slice 7: Knockback Hard-Stop Verification (RED/GREEN)

Verify existing knockback tests align with v1.2.1:

**Existing Tests to Verify**:
- `TestApplyKnockback_StopsAtFirstWallContact` ✅
- `TestApplyKnockback_DiagonalWallContactDoesNotSlideSideways` ✅

---

## Verification Phase: Subagent Passes

After implementation is complete, run the following subagent verification passes:

### Pass 1: Test Quality Verifier (Subagent 1)

**Tool**: `@test-quality-verifier`  
**Focus**: All melee-related test files  
**Command**:
```
Review the melee attack test changes in /Users/mtomcal/Code/alpha/stick-rumble for vague assertions, weak tests, or coverage gaps. Focus on these files: stick-rumble-server/internal/game/melee_attack_test.go, stick-rumble-server/internal/game/barrier_geometry_test.go. Be specific: identify bad assertions or meaningful missing cases only.
```

### Pass 2: Test Quality Verifier (Subagent 2)

**Tool**: `@test-quality-verifier`  
**Focus**: Integration tests  
**Command**:
```
Review the melee integration tests in /Users/mtomcal/Code/alpha/stick-rumble for vague assertions, weak tests, or coverage gaps. Focus on these files: stick-rumble-server/internal/network/melee_dodge_test.go, stick-rumble-server/internal/game/gameserver_hitdetection_test.go. Check that TS-MELEE-016, TS-MELEE-017, and TS-MELEE-018 are covered. Be specific: identify bad assertions or meaningful missing cases only.
```

### Pass 3: Test Quality Verifier (Subagent 3)

**Tool**: `@test-quality-verifier`  
**Focus**: Edge cases and boundary conditions  
**Command**:
```
Review the melee barrier occlusion tests in /Users/mtomcal/Code/alpha/stick-rumble for edge case coverage. Focus on these areas: boundary-inclusive intersection (touching wall = blocked), 9-sample-point hitbox coverage, first-contact resolution with multiple obstacles, and short-circuit behavior when center is blocked. Check files: stick-rumble-server/internal/game/melee_attack_test.go, stick-rumble-server/internal/game/barrier_geometry_test.go. Be specific: identify missing edge cases or vague boundary assertions.
```

### Pass 4: Pre-Mortem Subagent

**Tool**: `general` subagent  
**Purpose**: Identify potential failure modes before they happen  
**Prompt**:
```
Review the melee combat v1.2.1 implementation in /Users/mtomcal/Code/alpha/stick-rumble for potential failure modes and risks. Focus on:

1. Thread safety issues in hasMeleeReach when accessing player positions and map config
2. Performance concerns with 9 sample points × N targets × M obstacles per melee attack
3. Numerical precision issues with boundary-inclusive intersection (floating point comparisons)
4. Inconsistencies between melee line-of-sight and projectile/hitscan barrier logic
5. Knockback edge cases when player is sandwiched between attacker and wall
6. Arena bounds clamping interaction with obstacle contact resolution

Read the relevant files: stick-rumble-server/internal/game/melee_attack.go, stick-rumble-server/internal/game/barrier_geometry.go, stick-rumble-server/internal/game/gameserver.go

Return a structured report with: (1) identified risks, (2) severity (high/medium/low), (3) recommended mitigations, (4) specific code locations to review.
```

---

## Acceptance Criteria

Definition of done for this implementation:

1. **All existing tests pass**: `make test-server` returns 0
2. **New tests added**:
   - `TestHasMeleeReach_CenterBlockedShortCircuit`
   - `TestHasMeleeReach_MajorityReachableRequired`
   - `TestHasMeleeReach_ExactlyFivePointsReachable`
   - `TestSegmentRectContact_BoundaryInclusive` (if needed)
   - `TestFirstObstacleContact_ReturnsClosestObstacle` (if needed)
3. **Spec compliance**:
   - Center point is checked first and short-circuits if blocked
   - Majority (5/9) of hitbox points must be reachable
   - Boundary-inclusive intersection (touching = blocked)
   - First-contact resolution for multiple obstacles
4. **Subagent verification**: All 4 subagent passes complete with no critical issues

---

## Implementation Checklist

- [ ] Slice 1: Write `TestHasMeleeReach_CenterBlockedShortCircuit` (RED)
- [ ] Slice 2: Implement center point short-circuit in `hasMeleeReach` (GREEN)
- [ ] Slice 3: Write `TestHasMeleeReach_MajorityReachableRequired` and `TestHasMeleeReach_ExactlyFivePointsReachable` (RED)
- [ ] Slice 4: Implement majority counting logic in `hasMeleeReach` (GREEN)
- [ ] Slice 5: Verify boundary-inclusive intersection (add test if needed)
- [ ] Slice 6: Verify first-contact resolution (add test if needed)
- [ ] Slice 7: Run `make test-server` and fix any regressions
- [ ] Slice 8: Run subagent verification passes (3x test-verifier + 1x pre-mortem)

---

## Rollback Plan

If implementation fails:

1. `git stash` or `git checkout -- stick-rumble-server/internal/game/melee_attack.go`
2. `git checkout -- stick-rumble-server/internal/game/melee_attack_test.go`
3. `make test-server` to verify clean state
4. Re-attempt with smaller slices

---

## References

- **Spec Source**: `specs/melee.md` v1.2.1
- **Key Test Scenarios**: TS-MELEE-016, TS-MELEE-017, TS-MELEE-018
- **Related Files**:
  - `stick-rumble-server/internal/game/melee_attack.go`
  - `stick-rumble-server/internal/game/melee_attack_test.go`
  - `stick-rumble-server/internal/game/barrier_geometry.go`
  - `stick-rumble-server/internal/game/barrier_geometry_test.go`
