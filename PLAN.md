# Live Player Footprint Implementation Plan
## Flush Blocker Contact + Stable Dodge Roll Body

**Based on spec commit:** `18f0a76` - `fix(specs): define flush blocker contact for live player body`

---

## Overview

This plan implements the spec changes in:

- `specs/graphics.md` v2.4.0
- `specs/arena.md` v2.1.1
- `specs/movement.md` v1.2.3
- `specs/dodge-roll.md` v1.0.5
- `specs/maps.md` v1.2.1

The core requirement is visual, not physics-side: the live player body must now read as the canonical on-screen representation of the authoritative `PLAYER_WIDTH x PLAYER_HEIGHT` collision footprint. That body must stay axis-aligned, remain visibly present during dodge roll, and read flush against blocker edges on all four sides without a false air gap.

The server and client movement systems already resolve obstacle contact using the shared `32x64` player hitbox. The implementation work is therefore mainly about bringing rendering, roll presentation, obstacle art treatment, and shipped readability coverage into line with geometry that already exists.

---

## Spec Delta To Implement

1. The live player's collision-carrying visible body must derive directly from `PLAYER.WIDTH` and `PLAYER.HEIGHT`.
2. The visible body's outer extents must match the authoritative hitbox within 1 rendered pixel per side.
3. The live body must stay axis-aligned in idle, movement, aim, and dodge roll states.
4. Dodge roll may add flair, but it may not rotate, hide, shrink, stretch, or otherwise distort the live collision-reading body.
5. Obstacle rendering must support the obstacle rectangle boundary as the real readable blocking edge.
6. Shipped map coverage must include representative blocker-contact checks for solid obstacle families; this can come from authored viewpoints, dedicated visual regression cases, or both.

---

## Current Code State

### What is already correct

- Server collision clamps against obstacles with `PlayerWidth / 2` and `PlayerHeight / 2` in `stick-rumble-server/internal/game/physics.go`.
- Client prediction mirrors that same obstacle resolution in `stick-rumble-client/src/game/physics/PredictionEngine.ts`.
- The shared constants already define `PLAYER.WIDTH = 32` and `PLAYER.HEIGHT = 64`.

### What is currently out of spec

- `stick-rumble-client/src/game/entities/ProceduralPlayerGraphics.ts` draws a small rotated stick figure whose main visible mass is a head circle, not a stable `32x64` live-body footprint.
- `stick-rumble-client/src/game/entities/PlayerManager.ts` rotates the live body 360 degrees during roll and flickers it invisible during i-frames.
- `stick-rumble-client/src/game/scenes/GameScene.ts` draws obstacle outlines in a way that is not explicitly locked to the authoritative blocker edge contract.
- Map validation currently requires the four generic visual outcomes, but it does not lock in blocker-contact coverage for the shipped office map by test name or fixture intent.

### Important implementation constraint

Do not change movement or server-authoritative collision rules unless a red test proves a true geometry mismatch. The spec change is about visible contact readability, not about inventing a new physics shape.

---

## Intended Implementation Shape

### Live body rendering

Refactor live-player rendering around a canonical body layer that:

- is centered on player position
- derives directly from `PLAYER.WIDTH` and `PLAYER.HEIGHT`
- stays axis-aligned regardless of aim or roll state
- remains the primary body read even when stylized details extend past it

The simplest acceptable shape is a rounded-rect or capsule-like body treatment drawn to the canonical footprint. Arms, legs, hands, head styling, held weapon, spawn ring, and labels remain secondary layers.

### Dodge roll presentation

Roll state should stop modifying the live body's rotation or visibility. If any roll flair remains, it must live on secondary layers only. A conservative implementation with no special body distortion is valid and lower risk than replacing one misleading effect with another.

### Blocker edge readability

Obstacle paint treatment must make the authored rectangle edge the readable blocking edge. If outline rendering is ambiguous, switch to a treatment where the fill edge is the contact read and any decorative stroke/highlight is inset or otherwise prevented from implying a false gap.

### Coverage strategy

Use red/green unit tests to lock geometry and roll behavior first. Then add blocker-contact coverage around the shipped office map so wall and desk families are represented by explicit tests and, if needed, additional authored viewpoints in `maps/default_office.json`.

Do not invent a new map schema field or a new `expectedOutcome` enum unless implementation proves it is necessary. The current spec change can be satisfied with targeted viewpoints and regression tests.

---

## Red/Green TDD Slices

### Slice 1: Lock the canonical live-body footprint in unit tests

**Red**

Add focused tests in `stick-rumble-client/src/game/entities/ProceduralPlayerGraphics.test.ts` that prove:

- the collision-reading body derives from `PLAYER.WIDTH` and `PLAYER.HEIGHT`
- the body remains centered on the player position
- the body's outer extents stay stable while idle, walking, and aiming
- aim changes do not rotate the body footprint

Prefer assertions against deterministic draw geometry or a small geometry helper over brittle snapshot-style checks.

**Green**

Refactor `stick-rumble-client/src/game/entities/ProceduralPlayerGraphics.ts` so the live body is drawn from shared constants instead of being implied by the stick-figure head/limbs alone.

**Refactor**

If the render math becomes hard to test, extract a small pure helper for canonical body bounds and detail anchor points.

---

### Slice 2: Preserve the live-body footprint through dodge roll

**Red**

Update `stick-rumble-client/src/game/entities/PlayerManager.test.ts` so roll-state tests require:

- no live-body rotation during roll
- no live-body visibility flicker during roll
- the live body still being visible after `roll:start`
- roll-end logic not depending on resetting body rotation from a spun state

Existing tests that currently endorse 360-degree rotation or body flicker should be rewritten, not retained.

**Green**

Change `stick-rumble-client/src/game/entities/PlayerManager.ts` to stop calling live-body `setRotation(...)` and `setVisible(...)` for roll presentation.

**Refactor**

If a secondary flair hook is introduced, keep it off the collision-reading body and test it separately from the body contract.

---

### Slice 3: Prove the live body stays axis-aligned across all live states

**Red**

Add one higher-level unit test in either:

- `stick-rumble-client/src/game/entities/ProceduralPlayerGraphics.test.ts`, or
- a new focused client render-geometry test file

that exercises idle, walking, aiming, and rolling states as a set and proves the canonical body extents remain stable within the 1-pixel tolerance required by `TS-GFX-025`.

**Green**

Finish any remaining render-state plumbing needed so roll state and aim state do not mutate the body footprint.

**Refactor**

Consolidate duplicated assertions into a reusable helper like `expectCanonicalFootprint(...)`.

---

### Slice 4: Lock blocker-contact reads on all four sides

**Red**

Add dedicated tests that place a canonical live body flush against an obstacle on the:

- north side
- east side
- south side
- west side

These tests should prove the body edge matches the authoritative blocker edge within the allowed 1-pixel tolerance from `TS-GFX-026` and `TS-ARENA-007`.

The most robust location is a geometry-focused client test that uses shared obstacle rectangles and canonical body bounds directly. Avoid screenshot-only testing as the first line of defense.

**Green**

Adjust live-body draw extents and, if necessary, blocker rendering treatment until all four-side contact tests pass consistently.

**Refactor**

Name the helper geometry in terms of authoritative edges, not pixels from ad hoc art offsets.

---

### Slice 5: Tighten obstacle rendering so the blocker edge reads as real

**Red**

Add a focused scene-rendering test around `stick-rumble-client/src/game/scenes/GameScene.ts` that proves obstacle drawing does not shift the readable blocker edge away from the authored rectangle.

This test should specifically guard against decorative stroke treatment implying a contact edge different from the obstacle rectangle.

**Green**

Update `drawObstacles(...)` in `stick-rumble-client/src/game/scenes/GameScene.ts` so the visible edge treatment supports flush live-player contact reads. If a stroke remains, it must not create a false visible gap or overhang beyond the allowed tolerance.

**Refactor**

Centralize obstacle colors and edge-treatment choices if they are currently inlined and hard to reuse in tests.

---

### Slice 6: Add shipped-map blocker-contact coverage

**Red**

Add regression coverage for the shipped office map that proves blocker-contact readability is not omitted for solid obstacle families. The minimum target is coverage for:

- wall contact
- desk contact

This can be implemented by:

- adding explicit blocker-contact viewpoints to `maps/default_office.json`, and/or
- adding dedicated visual/geometry regression tests that use real office-map obstacles

Add matching tests in:

- `maps-schema/src/map-schema.test.ts`
- `stick-rumble-server/internal/game/maps_test.go`

only to the extent needed to lock the chosen coverage approach into the shipped content.

**Green**

Update `maps/default_office.json` and any validation/test fixtures so the office map clearly carries representative blocker-contact coverage.

**Refactor**

Do not broaden schema validation beyond what the spec now says. The goal is to guarantee coverage, not to over-design a new map-authoring system.

---

### Slice 7: Reconfirm movement and prediction behavior without changing the physics contract

**Red**

Run or tighten targeted tests that already cover collision resolution:

- `stick-rumble-client/src/game/physics/PredictionEngine.test.ts`
- relevant server obstacle-collision tests under `stick-rumble-server/internal/game/`

The purpose is not to rewrite physics, but to prove the visual work still sits on top of the same blocker semantics.

**Green**

Only patch movement or collision code if a test exposes a real mismatch between rendered contact and authoritative placement.

**Refactor**

If no mismatch appears, leave physics untouched.

---

## Verification

### Local verification sequence

1. Run targeted client tests for:
   - `stick-rumble-client/src/game/entities/ProceduralPlayerGraphics.test.ts`
   - `stick-rumble-client/src/game/entities/PlayerManager.test.ts`
   - any new or updated `GameScene` rendering test
2. Run targeted map-validation tests for:
   - `maps-schema/src/map-schema.test.ts`
   - `stick-rumble-server/internal/game/maps_test.go`
3. Run `make test-client`
4. Run `make test-server`
5. Run `make lint`
6. Run `make typecheck`
7. Run `make test`

### Subagent verification passes

Run these after the local red/green work is green, not before.

#### Test verifier pass 1

Use `test-quality-verifier` on:

- `stick-rumble-client/src/game/entities/ProceduralPlayerGraphics.test.ts`

Prompt focus:

`Review the recent test changes for canonical live-body footprint coverage. Identify weak assertions, missing edge cases around PLAYER_WIDTH/PLAYER_HEIGHT alignment, and any places where the tests would pass even if the body rotated or shrank.`

#### Test verifier pass 2

Use `test-quality-verifier` on:

- `stick-rumble-client/src/game/entities/PlayerManager.test.ts`

Prompt focus:

`Review the recent dodge-roll presentation test changes. Identify vague assertions, any hidden dependency on old rotation/flicker behavior, and missing checks that the live body remains visible and axis-aligned during roll.`

#### Test verifier pass 3

Use `test-quality-verifier` on:

- `stick-rumble-client/src/game/scenes/GameScene.ts`
- any new or updated `GameScene` rendering test
- `maps-schema/src/map-schema.test.ts`
- `stick-rumble-server/internal/game/maps_test.go`

Prompt focus:

`Review the blocker-contact and shipped-map coverage tests. Identify weak assertions, missing north/east/south/west contact cases, and any map-readability coverage gaps for wall/desk obstacle families only.`

#### Pre-mortem pass

Use a supported generic/default subagent type for a pre-mortem review.

Prompt focus:

`Perform a pre-mortem on the live-player footprint implementation. Assume the code passed tests but still ships a bad visual read. Find the most likely failure modes around false wall gaps, roll-state regressions, obstacle-edge paint drift, map-coverage blind spots, and attachments accidentally becoming the collision-reading body.`

The pre-mortem should produce risks, not a rewrite plan.

---

## Acceptance Criteria

Definition of done:

1. The live player's collision-reading visible body is derived directly from `PLAYER.WIDTH` and `PLAYER.HEIGHT`.
2. The live body's outer extents match the authoritative hitbox within 1 rendered pixel per side.
3. Idle, walking, aiming, and rolling all preserve the same axis-aligned body footprint.
4. Dodge roll no longer rotates or hides the live body.
5. Live player contact against blockers reads flush on north, east, south, and west sides.
6. Obstacle art treatment does not imply a blocker edge different from the authoritative rectangle boundary.
7. The shipped office map has explicit blocker-contact coverage for its solid obstacle families.
8. `make test-client`, `make test-server`, `make lint`, `make typecheck`, and `make test` all pass.

---

## Implementation Checklist

- [ ] Add canonical live-footprint unit tests
- [ ] Refactor `ProceduralPlayerGraphics` to render a stable `PLAYER.WIDTH x PLAYER.HEIGHT` body
- [ ] Rewrite roll tests to reject live-body rotation and flicker
- [ ] Remove roll rotation/flicker from `PlayerManager`
- [ ] Add all-four-sides blocker-contact geometry tests
- [ ] Tighten obstacle rendering so the blocker rectangle edge is the readable edge
- [ ] Add shipped office-map blocker-contact coverage for wall and desk families
- [ ] Reconfirm prediction/server collision behavior without unnecessary physics edits
- [ ] Run targeted client and map tests
- [ ] Run `make test-client`
- [ ] Run `make test-server`
- [ ] Run `make lint`
- [ ] Run `make typecheck`
- [ ] Run `make test`
- [ ] Run 3x `test-quality-verifier` passes
- [ ] Run 1x generic/default pre-mortem subagent pass

---

## References

- `specs/graphics.md`
- `specs/arena.md`
- `specs/movement.md`
- `specs/dodge-roll.md`
- `specs/maps.md`
- `stick-rumble-client/src/shared/constants.ts`
- `stick-rumble-client/src/game/entities/ProceduralPlayerGraphics.ts`
- `stick-rumble-client/src/game/entities/ProceduralPlayerGraphics.test.ts`
- `stick-rumble-client/src/game/entities/PlayerManager.ts`
- `stick-rumble-client/src/game/entities/PlayerManager.test.ts`
- `stick-rumble-client/src/game/scenes/GameScene.ts`
- `stick-rumble-client/src/game/physics/PredictionEngine.ts`
- `stick-rumble-client/src/game/physics/PredictionEngine.test.ts`
- `maps/default_office.json`
- `maps-schema/src/map-schema.test.ts`
- `stick-rumble-server/internal/game/maps_test.go`
- `stick-rumble-server/internal/game/physics.go`
