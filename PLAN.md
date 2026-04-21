# Wall-Clipped Melee Swing Arc Implementation Plan

## Goal

Implement the wall-clipped melee swing arc visual feature described by commit `ead9b2c` (`docs: spec wall-clipped melee swing arc`) using red/green TDD.

The specs are already updated in:

- `specs/melee.md` § Swing Animation
- `specs/graphics.md` § Melee Swing Arc
- `specs/constants.md` § Melee Visual Constants (`MELEE_ARC_MIN_VISIBLE_LENGTH`)
- `specs/test-index.md` (TS-MELEE-019 indexed)

Per the repo workflow, those specs are now the contract. This plan is for implementation only.

## Commit Summary

The latest spec commit added a radial ray-marching arc that clips to the first blocking obstacle contact on each radial ray:

- The arc is rendered as a **polyline approximation** of a circular sector, not a single `graphics.arc()` call
- Each sampled angle fires a radial ray from the attacker toward the weapon range
- Each ray is clipped to the first blocking contact (movement, projectile, or LOS blocker)
- If the contact distance is closer than `MELEE_ARC_MIN_VISIBLE_LENGTH` (20px), the arc renders at least that minimum length so the swing remains visible when flush against a wall
- The clipped arc geometry is computed once at swing start and remains static for the animation duration
- Obstacles are provided to `MeleeWeaponManager` via `setObstacles()`, mirroring the `ProjectileManager.setWorldBounds()` pattern
- All existing visual contracts remain unchanged: white stroke-only, 2px width, 0.8 alpha, 200ms fade, ±0.7 rad (~80°), weapon container rotation tween

## Current Code Gaps

Based on the current implementation, these are the main mismatches with the new spec:

- `stick-rumble-client/src/game/entities/MeleeWeapon.ts` uses `graphics.arc()` — a single continuous arc with no per-angle clipping
- `stick-rumble-client/src/game/entities/MeleeWeapon.ts` has no obstacle awareness; it does not receive or query blocking geometry
- `stick-rumble-client/src/game/entities/MeleeWeaponManager.ts` has no `setObstacles()` method and does not pass obstacle data to `MeleeWeapon`
- `stick-rumble-client/src/shared/constants.ts` does not define `MELEE_ARC_MIN_VISIBLE_LENGTH`
- `stick-rumble-client/src/game/entities/MeleeWeapon.test.ts` tests the old `graphics.arc()` behavior and has no coverage for wall-clipped polyline rendering

## Non-Goals

This plan does not add:

- new server-side logic (this is a client visual-only change)
- new WebSocket message types
- new map authoring rules
- changes to the melee hit-detection logic on the server
- changes to weapon stats, colors, or timing constants other than `MELEE_ARC_MIN_VISIBLE_LENGTH`
- deployment work

## Delivery Strategy

Work in thin red/green slices. Each slice should add tests first, make the smallest implementation change that satisfies them, then rerun the narrow suite before moving on.

Recommended order:

1. constant and shared geometry readiness
2. `MeleeWeapon` polyline arc with per-angle clipping
3. `MeleeWeaponManager.setObstacles()` plumbing
4. integrated verification
5. subagent review passes

---

## Phase 0: Freeze Acceptance Cases

Before writing code, treat these spec scenarios as the executable target:

- **TS-MELEE-019**: Melee arc clips to blocking geometry
  - Arc does not extend through blocking geometry
  - Each radial sample is clipped to the first blocking contact
  - Minimum visible length enforced at 20px
  - Clipped geometry computed once at swing start, static for animation
  - White stroke-only, 2px, 0.8 alpha, 200ms fade preserved
- **TS-GFX-013**: Melee arc renders as white stroke-only (existing — must not regress)
- **TS-MELEE-015**: Weapon container rotation tween on swing (existing — must not regress)

Definition of done for this phase:

- every scenario above maps to at least one planned test file
- no implementation work starts before that mapping is clear

---

## Phase 1: Shared Constant and Geometry Red/Green

Add the new constant and ensure the shared geometry helper is usable from the melee rendering path.

Likely files:

- `stick-rumble-client/src/shared/constants.ts`
- `stick-rumble-client/src/shared/maps.ts` (already has `getFirstBlockingObstacleContact`)

Red tests (in `stick-rumble-client/src/shared/constants.test.ts` or existing test file):

- `MELEE_ARC_MIN_VISIBLE_LENGTH` equals 20
- `getFirstBlockingObstacleContact` returns nearest contact when a ray intersects a blocking rectangle
- `getFirstBlockingObstacleContact` returns null when ray misses all obstacles
- `getFirstBlockingObstacleContact` returns distance 0 when start point is inside a blocking rectangle
- `getFirstBlockingObstacleContact` selects the nearest contact when multiple obstacles lie on the same ray

Green implementation:

- add `MELEE_ARC_MIN_VISIBLE_LENGTH: 20` to `shared/constants.ts` (under a `MELEE` or `VISUAL` grouping)
- verify `getFirstBlockingObstacleContact` in `shared/maps.ts` already implements the needed behavior; if gaps exist, patch them

Exit criteria:

- constant is importable from both `MeleeWeapon.ts` and its tests
- geometry helper is verified against the five cases above

---

## Phase 2: MeleeWeapon Polyline Arc Red/Green

Replace the single `graphics.arc()` call with a per-angle sampled polyline that clips each radial ray to the first blocking contact.

Primary files:

- `stick-rumble-client/src/game/entities/MeleeWeapon.ts`
- `stick-rumble-client/src/game/entities/MeleeWeapon.test.ts`

Red tests (new test block for TS-MELEE-019):

- with no obstacles, the arc renders at full weapon range (same as before)
- with a blocking obstacle directly in front, the arc is clipped to the contact distance
- when clipped contact is closer than 20px, the arc renders at least 20px minimum length
- with obstacles on some rays but not others, only the blocked rays are clipped
- the arc uses `moveTo`/`lineTo` polyline (not `arc`) when obstacles are provided
- stroke-only white style is preserved (2px, 0xFFFFFF, 0.8 alpha)
- swing fade tween and container rotation tween are unchanged

Green implementation:

- add optional `obstacles` parameter to `showSwingAnimation(aimAngle, obstacles?)`
- sample the arc at regular angular steps (e.g., 16–32 samples for smoothness)
- for each sample angle, compute ray end at weapon range
- if obstacles are provided, call `getFirstBlockingObstacleContact(attacker, rayEnd, obstacles)`
- effective radius = `contact ? max(contact.distance, MELEE_ARC_MIN_VISIBLE_LENGTH) : weaponRange`
- build polyline with `moveTo` on first sample, `lineTo` on subsequent samples
- call `strokePath()` — no fill
- when no obstacles provided, keep backward-compatible behavior (can still use `arc()` or the same polyline path)

Exit criteria:

- `MeleeWeapon.test.ts` passes with new wall-clipping assertions
- TS-GFX-013 tests still pass (no style regression)
- TS-MELEE-015 tests still pass (no tween regression)

---

## Phase 3: MeleeWeaponManager Obstacle Plumbing Red/Green

Provide the obstacle set to `MeleeWeaponManager` so it can pass it through to each `MeleeWeapon.startSwing()`.

Primary files:

- `stick-rumble-client/src/game/entities/MeleeWeaponManager.ts`
- `stick-rumble-client/src/game/entities/MeleeWeaponManager.test.ts`
- `stick-rumble-client/src/game/entities/MeleeWeapon.ts` (signature change for `startSwing`)

Red tests:

- `MeleeWeaponManager.setObstacles(obstacles)` stores the obstacle array
- `MeleeWeaponManager.startSwing()` passes stored obstacles to `MeleeWeapon.startSwing()`
- `MeleeWeapon.startSwing()` forwards obstacles to `showSwingAnimation()`
- swing still works when no obstacles have been set (undefined/null safe)

Green implementation:

- add private `obstacles` field to `MeleeWeaponManager`
- add `setObstacles(obstacles: MapObstacle[])` method
- update `MeleeWeaponManager.startSwing()` to call `weapon.startSwing(aimAngle, this.obstacles)`
- update `MeleeWeapon.startSwing()` signature to accept optional obstacles and pass them to `showSwingAnimation()`

Exit criteria:

- `MeleeWeaponManager.test.ts` passes with obstacle plumbing assertions
- manager can receive obstacles, store them, and pass them through on every swing
- no swing crashes when obstacles are absent

---

## Phase 4: GameScene Integration

Wire the map obstacle context into `MeleeWeaponManager` during scene setup or map load.

Primary files:

- `stick-rumble-client/src/game/scenes/GameScene.ts` or relevant scene file
- Scene tests that verify `setObstacles` is called after map load

Red tests:

- after map context is loaded, `MeleeWeaponManager.setObstacles()` is called with the map's obstacle list
- if map has no obstacles, `setObstacles([])` or equivalent is called

Green implementation:

- locate where `GameScene` loads `MatchMapContext` (via `getMatchMapContext`)
- after obstacles are available, call `this.meleeWeaponManager.setObstacles(mapContext.obstacles)`

Exit criteria:

- scene-level test passes
- actual gameplay scene sets obstacles before the first swing can occur

---

## Phase 5: Integrated Verification

Run targeted suites during each phase, then run the repo-standard verification at the end.

Per-phase examples:

- `make test-client -- MeleeWeapon.test.ts`
- `make test-client -- MeleeWeaponManager.test.ts`
- focused tests for `shared/maps.ts` geometry helpers

Final pass:

- `make lint`
- `make typecheck`
- `make test-client`
- `make test`

If the full pass is too slow or flakes, record the exact failing command and keep the smallest reproducible targeted command in the work log.

---

## Endgame Subagents

After local green and before final sign-off, run four subagent passes. Use `kimi-k2.6` with `high` reasoning for all of them.

### Subagent 1: MeleeWeapon Test Verification

Purpose:

- audit `MeleeWeapon.test.ts` for missing edge cases, false confidence, and spec coverage gaps specific to the wall-clipped arc

Suggested focus:

- `stick-rumble-client/src/game/entities/MeleeWeapon.test.ts`
- `stick-rumble-client/src/game/entities/MeleeWeaponManager.test.ts`

Suggested prompt:

```text
Review the recent wall-clipped melee swing arc test changes in /Users/mtomcal/Code/alpha/stick-rumble. Focus on these files: stick-rumble-client/src/game/entities/MeleeWeapon.test.ts, stick-rumble-client/src/game/entities/MeleeWeaponManager.test.ts. Identify meaningful missing cases, false positives, or places where the tests would still pass if wall-clipping logic were wrong. Pay special attention to TS-MELEE-019 coverage: arc clipping, minimum visible length, stroke-only style preservation, and obstacle plumbing.
```

### Subagent 2: Geometry Helper and Constant Test Verification

Purpose:

- audit shared geometry helpers and constants for correctness, edge cases, and regression risks

Suggested focus:

- `stick-rumble-client/src/shared/maps.ts`
- `stick-rumble-client/src/shared/constants.ts`
- any new or updated tests for the above

Suggested prompt:

```text
Review the recent wall-clipped melee swing arc test changes in /Users/mtomcal/Code/alpha/stick-rumble. Focus on these files: stick-rumble-client/src/shared/maps.ts and its tests, stick-rumble-client/src/shared/constants.ts and its tests. Identify missing edge cases in segment-vs-rect contact detection, incorrect constant values, or tests that would pass even if the geometry logic were flawed. Be specific about ray-marching accuracy and minimum-visible-length enforcement.
```

### Subagent 3: Assertion Vagueness and Coverage Audit

Purpose:

- specifically look for weak assertions, over-mocking, and spec scenarios that were never encoded

Suggested prompt:

```text
Review the recent wall-clipped melee swing arc test changes in /Users/mtomcal/Code/alpha/stick-rumble for vague assertions, weak checks, over-mocked behavior, and spec gaps. Focus only on meaningful issues. Pay special attention to TS-MELEE-019 coverage: polyline vs arc rendering, per-angle clipping, minimum visible length, obstacle parameter forwarding, and style preservation. Also verify TS-GFX-013 and TS-MELEE-015 are not regressed by incomplete assertions.
```

### Subagent 4: Pre-Mortem Analysis

Purpose:

- assume the change shipped and failed; identify the likeliest regression paths before merge

Suggested prompt:

```text
Run a pre-mortem on the wall-clipped melee swing arc implementation work in /Users/mtomcal/Code/alpha/stick-rumble. Assume the feature shipped and players still reported melee arc bugs or new regressions. Identify the highest-risk failure modes, likely blind spots in the implementation/tests, performance risks from per-angle ray-marching, visual desync risks between clipped arc and authoritative server reachability, and any client-side crash vectors. Be concrete and prioritize the top issues only.
```

---

## Recommended Commit Shape

Keep commits small and TDD-aligned:

1. add `MELEE_ARC_MIN_VISIBLE_LENGTH` constant + tests
2. add/update shared geometry helper tests (if gaps found)
3. implement `MeleeWeapon` polyline arc with clipping + tests
4. implement `MeleeWeaponManager.setObstacles()` plumbing + tests
5. wire `GameScene` to pass obstacles to manager + tests
6. final cleanup after subagent feedback

Use conventional commits:

```
feat: wall-clipped melee swing arc

test: add TS-MELEE-019 coverage for arc obstacle clipping
```

---

## Done Criteria

This work is done when all of the following are true:

- `MeleeWeapon` renders the swing arc as a polyline with per-angle radial ray-marching
- each radial ray is clipped to the first blocking obstacle contact
- arcs render at least `MELEE_ARC_MIN_VISIBLE_LENGTH` (20px) even when flush against a wall
- `MeleeWeaponManager` exposes `setObstacles()` and passes obstacles to swings
- white stroke-only style, 2px width, 0.8 alpha, 200ms fade, and container rotation tween are preserved
- existing TS-GFX-013 and TS-MELEE-015 tests continue to pass
- `make lint`, `make typecheck`, and `make test` pass
- the three verification subagents and one pre-mortem subagent have been run and any real findings addressed
