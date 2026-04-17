# Wall Barrier Implementation Plan

## Goal

Implement the wall-barrier feature described by commit `d2e0f4a` (`fix: tighten wall barrier specs`) using red/green TDD.

The specs are already updated in:

- `specs/arena.md`
- `specs/hit-detection.md`
- `specs/maps.md`
- `specs/melee.md`
- `specs/shooting.md`

Per the repo workflow, those specs are now the contract. This plan is for implementation only.

## Commit Summary

The latest spec commit tightened one shared rule across combat systems:

- first blocking contact wins
- projectiles must use swept-path wall resolution, not endpoint-only samples
- hitscan must stop at walls before target contact and respect partial cover on the 32x64 hitbox
- near-wall shots cannot spawn from the far side of a barrier
- blocked ranged shots still consume ammo and fire-rate cooldown
- melee cannot damage through blocking geometry
- bat knockback must stop at the first wall contact
- client visuals must never show projectile travel beyond the authoritative wall contact

## Current Code Gaps

Based on the current implementation, these are the main mismatches with the new specs:

- `stick-rumble-server/internal/game/projectile.go` removes projectiles on obstacle intersection but does not preserve the first contact point.
- `stick-rumble-server/internal/game/physics.go` still does endpoint-style projectile-vs-player checks and does not gate hits by wall contact.
- `stick-rumble-server/internal/game/gameserver.go` hitscan uses ray-vs-circle logic with no barrier test and no partial-cover AABB resolution.
- `stick-rumble-server/internal/game/melee_attack.go` uses range+arc only and applies knockback by direct displacement plus arena clamp.
- `stick-rumble-client/src/game/entities/ProjectileManager.ts` locally advances projectile visuals until destroy/out-of-bounds and has no wall-contact stop logic.
- `stick-rumble-client/src/shared/maps.ts` has a point-in-obstacle helper, but not the segment/contact helpers needed for near-wall shot mirroring.

## Non-Goals

This plan does not add:

- new obstacle shapes beyond authored rectangles
- new map authoring rules beyond the already-merged spec changes
- unrelated networking or room-flow changes
- deployment work

Avoid wire-contract churn unless implementation proves it is required for authoritative blocked-impact feedback.

## Delivery Strategy

Work in thin red/green slices. Each slice should add tests first, make the smallest implementation change that satisfies them, then rerun the narrow suite before moving on.

Recommended order:

1. shared server-side barrier geometry primitives
2. projectile swept travel and wall contact resolution
3. hitscan barrier gating and partial-cover targeting
4. melee reachability and knockback hard-stop behavior
5. client projectile presentation and near-wall feedback mirroring
6. integrated verification
7. subagent review pass

## Phase 0: Freeze Acceptance Cases

Before writing code, treat these spec scenarios as the executable target:

- `TS-ARENA-006`
- `TS-HIT-015`
- `TS-HIT-016`
- `TS-HIT-017`
- `TS-MELEE-016`
- `TS-MELEE-017`
- `TS-MELEE-018`
- `TS-SHOOT-014`
- `TS-SHOOT-015`

Definition of done for this phase:

- every scenario above maps to at least one planned test file
- no implementation work starts before that mapping is clear

## Phase 1: Shared Barrier Geometry Red/Green

Create one shared server-side geometry layer for “first blocking contact wins” so projectile, hitscan, melee, and knockback do not each invent slightly different wall rules.

Likely files:

- `stick-rumble-server/internal/game/maps.go`
- new helper file such as `stick-rumble-server/internal/game/barrier_geometry.go`
- new tests such as `stick-rumble-server/internal/game/barrier_geometry_test.go`

Red tests:

- segment intersects rectangle and returns the nearest contact point
- segment fully misses rectangle
- segment starting inside a blocking rectangle is treated as blocked at origin
- first contact is selected when multiple obstacles lie on the same path
- ray/segment against player AABB can distinguish exposed contact from barrier-first contact

Green implementation:

- add reusable helpers for segment-vs-rect and segment-vs-player-hitbox contact queries
- return contact distance and point, not just boolean intersection
- keep obstacle filtering explicit by blocker type

Exit criteria:

- projectile, hitscan, melee, and knockback can all call the same first-contact geometry functions

## Phase 2: Projectile Path Red/Green

Bring projectile motion and projectile hit detection in line with the swept-path contract.

Primary files:

- `stick-rumble-server/internal/game/projectile.go`
- `stick-rumble-server/internal/game/physics.go`
- `stick-rumble-server/internal/game/projectile_test.go`
- `stick-rumble-server/internal/game/physics_collision_test.go`
- `stick-rumble-server/internal/game/gameserver_shooting_test.go`

Red tests:

- projectile update stops at the first wall contact instead of moving through and then disappearing
- projectile snapshot position for the final frame is at the contact point
- projectile path blocked by a wall before target does not damage target
- fast projectile cannot tunnel through a thin wall between ticks
- projectile exactly reaching exposed hitbox before wall still damages

Green implementation:

- add previous-position or equivalent swept-path state to `Projectile`
- change projectile update to resolve candidate movement against the nearest projectile-blocking contact
- keep projectile removal authoritative, but preserve the final stop point first
- change projectile-player collision to use swept contact against the player hitbox and reject barrier-first paths

Exit criteria:

- the server never resolves projectile travel or projectile damage beyond the first blocking contact

## Phase 3: Hitscan And Near-Origin Gating Red/Green

Replace the current ray-vs-circle approximation with first-contact barrier-aware target resolution.

Primary files:

- `stick-rumble-server/internal/game/gameserver.go`
- `stick-rumble-server/internal/game/physics.go`
- `stick-rumble-server/internal/game/gameserver_shooting_test.go`
- `stick-rumble-server/internal/network/integration_test.go`

Red tests:

- hitscan cannot damage a target fully behind blocking geometry
- partially exposed target remains hittable on the exposed portion only
- covered center point but exposed shoulder/edge still counts as a valid hit
- near-wall shot with obstructed barrel segment is blocked immediately
- blocked near-wall shot still consumes ammo and cooldown
- blocked hitscan does not emit player-hit side effects

Green implementation:

- use the authoritative barrel origin contract, but gate the short muzzle segment against nearby walls
- resolve hitscan against player AABB exposure, not a circle around center mass
- compare nearest wall contact distance to nearest valid target contact distance
- keep ammo/cooldown accounting unchanged for blocked shots

Exit criteria:

- hitscan behavior matches the partial-cover and near-wall contracts without introducing a separate special-case path per weapon

## Phase 4: Melee Reachability And Knockback Red/Green

Make melee obey the same barrier contract as shooting.

Primary files:

- `stick-rumble-server/internal/game/melee_attack.go`
- `stick-rumble-server/internal/game/melee_attack_test.go`
- `stick-rumble-server/internal/game/gameserver.go`
- `stick-rumble-server/internal/network/melee_dodge_test.go`

Red tests:

- melee target in range and arc but behind wall is not damaged
- partially exposed melee target remains hittable if an exposed portion is reachable first
- bat knockback stops at the first wall contact
- knockback still respects outer arena bounds
- blocked melee swing still consumes cooldown

Green implementation:

- change melee reachability from “range+arc only” to “range+arc plus unobstructed reachable target volume”
- route bat knockback through the same first-contact barrier helper used elsewhere
- preserve current weapon identity and cooldown behavior

Exit criteria:

- melee damage and knockback cannot tunnel through authored blockers

## Phase 5: Client Presentation Red/Green

Bring client visuals in line with the authoritative barrier outcome.

Primary files:

- `stick-rumble-client/src/game/entities/ProjectileManager.ts`
- `stick-rumble-client/src/game/entities/ProjectileManager.test.ts`
- `stick-rumble-client/src/game/input/ShootingManager.ts`
- `stick-rumble-client/src/game/input/ShootingManager.test.ts`
- `stick-rumble-client/src/shared/maps.ts`
- `stick-rumble-client/src/game/scenes/GameScene.combat.test.ts`
- `stick-rumble-client/src/game/network/WebSocketClient.test.ts`

Red tests:

- projectile visual does not continue past the authoritative wall contact
- local projectile cleanup does not overshoot the last known authoritative position
- near-wall blocked shot can produce immediate local blocked feedback using map obstacle checks
- local blocked feedback does not fake a player hit

Green implementation:

- add client-side segment/contact helpers that mirror the authoritative rectangle rules
- clamp local projectile visual progression to the authoritative final stop point when available
- if immediate blocked-shot feedback is added, keep it presentation-only and barrier-themed
- avoid inventing a second gameplay authority on the client

Exit criteria:

- visible bullets do not appear to pass through walls, even under latency

## Phase 6: Integrated Verification

Run targeted suites during each phase, then run the repo-standard verification at the end.

Per-phase examples:

- `make test-server`
- `make test-client`
- focused Go tests for projectile, physics, melee, and shooting files
- focused client tests for projectile manager, shooting manager, and combat scene handling

Final pass:

- `make lint`
- `make typecheck`
- `make test`

If the full pass is too slow or flakes, record the exact failing command and keep the smallest reproducible targeted command in the work log.

## Endgame Subagents

After local green and before final sign-off, run four subagents. Use `gpt-5.4` with `high` reasoning for all of them.

### Subagent 1: Server Test Verification

Purpose:

- audit server-side combat tests for missing edge cases and false confidence

Suggested focus:

- `stick-rumble-server/internal/game/projectile_test.go`
- `stick-rumble-server/internal/game/physics_collision_test.go`
- `stick-rumble-server/internal/game/gameserver_shooting_test.go`
- `stick-rumble-server/internal/game/melee_attack_test.go`
- `stick-rumble-server/internal/network/integration_test.go`
- `stick-rumble-server/internal/network/melee_dodge_test.go`

Suggested prompt:

```text
Review the recent wall-barrier combat test changes in /home/mtomcal/code/stick-rumble-wall-bugs. Focus on these files: stick-rumble-server/internal/game/projectile_test.go, stick-rumble-server/internal/game/physics_collision_test.go, stick-rumble-server/internal/game/gameserver_shooting_test.go, stick-rumble-server/internal/game/melee_attack_test.go, stick-rumble-server/internal/network/integration_test.go, stick-rumble-server/internal/network/melee_dodge_test.go. Identify meaningful missing cases, false positives, or places where the tests would still pass if wall resolution were wrong.
```

### Subagent 2: Client Test Verification

Purpose:

- audit client-side visual and input tests for latency and presentation regressions

Suggested focus:

- `stick-rumble-client/src/game/entities/ProjectileManager.test.ts`
- `stick-rumble-client/src/game/input/ShootingManager.test.ts`
- `stick-rumble-client/src/game/scenes/GameScene.combat.test.ts`
- `stick-rumble-client/src/game/network/WebSocketClient.test.ts`

Suggested prompt:

```text
Review the recent client wall-barrier test changes in /home/mtomcal/code/stick-rumble-wall-bugs. Focus on these files: stick-rumble-client/src/game/entities/ProjectileManager.test.ts, stick-rumble-client/src/game/input/ShootingManager.test.ts, stick-rumble-client/src/game/scenes/GameScene.combat.test.ts, stick-rumble-client/src/game/network/WebSocketClient.test.ts. Identify missing assertions, untested latency-sensitive behavior, and cases where projectile or blocked-shot visuals could still regress without the tests catching it.
```

### Subagent 3: Assertion Vagueness And Coverage Audit

Purpose:

- specifically look for weak assertions, over-mocking, and spec scenarios that were never encoded

Suggested prompt:

```text
Review the recent wall-barrier test changes in /home/mtomcal/code/stick-rumble-wall-bugs for vague assertions, weak checks, over-mocked behavior, and spec gaps. Focus only on meaningful issues. Pay special attention to TS-ARENA-006, TS-HIT-015/016/017, TS-MELEE-016/017/018, and TS-SHOOT-014/015 coverage.
```

### Subagent 4: Pre-Mortem Analysis

Purpose:

- assume the change shipped and failed; identify the likeliest regression paths before merge

Suggested prompt:

```text
Run a pre-mortem on the wall-barrier implementation work in /home/mtomcal/code/stick-rumble-wall-bugs. Assume the feature shipped and players still reported wall bugs or new regressions. Identify the highest-risk failure modes, likely blind spots in the implementation/tests, performance risks from new geometry checks, and client/server desync risks. Be concrete and prioritize the top issues only.
```

## Recommended Commit Shape

Keep commits small and TDD-aligned:

1. shared geometry helpers plus tests
2. projectile sweep changes plus tests
3. hitscan barrier gating plus tests
4. melee and knockback barrier changes plus tests
5. client visual/presentation fixes plus tests
6. final cleanup after subagent feedback

## Done Criteria

This work is done when all of the following are true:

- wall resolution is shared across projectile, hitscan, melee, and knockback paths
- blocked near-wall shots consume ammo and cooldown
- exposed target portions remain hittable while covered portions remain protected
- client projectile visuals do not pass through walls
- `make lint`, `make typecheck`, and `make test` pass
- the three verification subagents and one pre-mortem subagent have been run and any real findings addressed
