# Melee Combat v1.2.1 Implementation Plan
## Strict Line-of-Sight Requirements for Wall Blocking

**Based on Spec Commit**: `c0035ff` - specs(melee): v1.2.1 - strict line-of-sight requirements for wall blocking

---

## Overview

This plan implements the strict melee line-of-sight requirements from `specs/melee.md` v1.2.1 without regressing existing range/arc behavior.

The intended rule set is:

1. The target center point must be clear or the attack fails immediately.
2. At least 5 of 9 hitbox sample points must be reachable after occlusion is checked.
3. Segment-vs-wall checks are boundary-inclusive: touching a wall counts as blocked.
4. If multiple blockers exist, the closest blocking contact wins.
5. `hasMeleeReach` is an occlusion rule layered on top of existing range/arc gating, not a replacement for it.

---

## Current Code State

**Existing files**
- `stick-rumble-server/internal/game/melee_attack.go`
- `stick-rumble-server/internal/game/melee_attack_test.go`
- `stick-rumble-server/internal/game/barrier_geometry.go`
- `stick-rumble-server/internal/game/barrier_geometry_test.go`
- `stick-rumble-server/internal/game/gameserver_callbacks_test.go`

**What the current code already gets right**
- Samples 9 target hitbox points.
- Uses `firstObstacleContact` for obstacle ordering.
- Uses boundary-inclusive rectangle geometry today.
- Already has regression coverage for:
  - full wall block
  - partial cover still hitting
  - knockback stopping at first wall contact
  - blocked swing still consuming cooldown

**What is actually missing**
- `hasMeleeReach` returns true on the first reachable point instead of requiring a majority.
- `hasMeleeReach` does not short-circuit on blocked center.
- There is no direct unit test proving the strict center-clear rule.
- There is no direct unit test proving majority counting.

**Important implementation constraint**
- `PerformMeleeAttack` already resolves a default map config via `resolveMapConfig(...)`. Do not add a `nil mapConfig => fail closed` behavior; that would contradict current server behavior and break existing tests.
- `isInMeleeRange(...)` remains the primary range/arc gate. The new work should tighten occlusion only.

---

## Correct Implementation Shape

Target behavior for `hasMeleeReach`:

```go
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
	for i := 1; i < len(samplePoints); i++ {
		point := samplePoints[i]
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
```

Helper intent:

```go
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
```

Notes:
- Keep the center point range/arc check. If the center itself is outside the melee cone, the spec says the attack fails immediately.
- Do not rework `isInMeleeRange(...)` in this slice.
- Do not change `segmentRectContact(...)` unless a new boundary test proves it is wrong. Current geometry already appears inclusive.

---

## Red/Green TDD Slices

### Slice 1: Add a direct center-blocked unit test

**File**: `stick-rumble-server/internal/game/melee_attack_test.go`

Add a focused `hasMeleeReach(...)` test where:
- center point is in range/arc
- wall blocks the center segment
- several edge points remain geometrically exposed

Expected result:
- `hasMeleeReach(...) == false`

This test is important because it proves the new short-circuit rule directly instead of relying only on `PerformMeleeAttack(...)`.

### Slice 2: Implement center short-circuit in `hasMeleeReach`

Change `hasMeleeReach(...)` so that:
- it materializes the sample points once
- it checks the center point first
- it returns false immediately if the center path is blocked

Do not add any `nil`/missing-map early failure path.

### Slice 3: Add majority-counting tests with geometrically valid fixtures

**File**: `stick-rumble-server/internal/game/melee_attack_test.go`

Add two unit tests that use obstacle placement proven to create these cases:
- center clear, fewer than 5 reachable sample points => fail
- center clear, exactly 5 reachable sample points => pass

Constraints for these tests:
- Do not reuse the invalid wall fixtures from the previous draft plan.
- Prefer table-driven assertions if the geometry ends up clearer that way.
- If a single-obstacle fixture is too brittle, use two obstacles to create an unambiguous 4/9 or 5/9 outcome.

### Slice 4: Implement reachable-point counting

Update `hasMeleeReach(...)` so it:
- counts the center as reachable after it passes
- checks remaining sample points only when they are within range/arc
- returns true once `reachableCount >= 5`
- returns false if the loop ends below majority

This preserves the existing “hitbox edge within range can still hit” behavior while enforcing the stricter occlusion rule.

### Slice 5: Lock boundary-inclusive behavior with a test

**File**: `stick-rumble-server/internal/game/barrier_geometry_test.go`

Add a test where a segment ends exactly on a rectangle boundary and assert that:
- contact is reported
- the distance equals the endpoint distance

This should be treated as a required regression test, not “add if needed,” because the melee spec now depends on this exact rule.

### Slice 6: Lock first-contact resolution with a test

**File**: `stick-rumble-server/internal/game/barrier_geometry_test.go`

Add or keep a direct `firstObstacleContact(...)` test proving the nearer wall wins.

This may already be satisfied by existing coverage; if the current test is adequate, tighten it only if the assertion is too weak.

### Slice 7: Re-verify existing integration coverage

Confirm these still pass and still express the intended rules:
- `TestPerformMeleeAttack_WallBetweenPlayersPreventsDamage`
- `TestPerformMeleeAttack_PartialCoverStillHitsExposedTarget`
- `TestApplyKnockback_StopsAtFirstWallContact`
- `TestApplyKnockback_DiagonalWallContactDoesNotSlideSideways`
- `TestPlayerMeleeAttack_WallBlockedStillConsumesCooldown`
- `TestPlayerMeleeAttack_UsesWorldMapConfigForWallBlocking`

If `TestPerformMeleeAttack_PartialCoverStillHitsExposedTarget` does not actually prove the new majority rule strongly enough, tighten that test or add a second integration case.

---

## Test Design Notes

Avoid these mistakes:
- Do not make `hasMeleeReach(...)` re-implement overall melee eligibility. Range/arc is already split into `isInMeleeRange(...)` plus per-point filtering.
- Do not use wall fixtures that accidentally leave 6 reachable points while claiming to prove 4/9 or 5/9.
- Do not weaken boundary semantics with `<` when the spec requires “touching = blocked”; use `<=` at the blocking decision.
- Do not remove the default-map behavior from `PerformMeleeAttack(...)`.

Recommended test strategy:
- For majority tests, assert the final boolean outcome only if the fixture is obviously correct.
- If the fixture is non-obvious, add a local comment documenting which sample points are intended to remain reachable.
- Prefer deterministic integer coordinates.

---

## Verification Phase

After implementation:

1. Run targeted server tests for:
   - `melee_attack_test.go`
   - `barrier_geometry_test.go`
   - `gameserver_callbacks_test.go`
2. Run `make test-server`.
3. Optionally run a `test-quality-verifier` pass focused on:
   - `stick-rumble-server/internal/game/melee_attack_test.go`
   - `stick-rumble-server/internal/game/barrier_geometry_test.go`
   - `stick-rumble-server/internal/game/gameserver_callbacks_test.go`

If doing a pre-mortem via subagent, use a supported generic/default agent type rather than an invalid `general` type.

---

## Acceptance Criteria

Definition of done:

1. `hasMeleeReach(...)` fails immediately when the center point is blocked.
2. `hasMeleeReach(...)` requires at least 5 reachable sample points.
3. Blocking decisions treat wall-boundary contact as blocked.
4. Existing melee range/arc behavior does not regress.
5. Existing blocked-swing cooldown behavior does not regress.
6. `make test-server` passes.

---

## Implementation Checklist

- [ ] Add center-blocked `hasMeleeReach(...)` unit test
- [ ] Implement center short-circuit
- [ ] Add geometrically valid majority-rule unit tests
- [ ] Implement majority counting
- [ ] Add explicit boundary-inclusive geometry regression test
- [ ] Verify or tighten first-contact regression test
- [ ] Re-run melee and callback server tests
- [ ] Run `make test-server`

---

## References

- `specs/melee.md`
- `stick-rumble-server/internal/game/melee_attack.go`
- `stick-rumble-server/internal/game/melee_attack_test.go`
- `stick-rumble-server/internal/game/barrier_geometry.go`
- `stick-rumble-server/internal/game/barrier_geometry_test.go`
- `stick-rumble-server/internal/game/gameserver_callbacks_test.go`
