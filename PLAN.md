# Spec Implementation Plan

## Goal

Implement the behavior changes introduced by the latest spec commit (`eb5c235`) using red/green TDD, then finish with explicit test-quality audits and a pre-mortem.

This plan covers four real change areas from the spec diff:

- movement is now prototype-faithful and immediate-feeling, not slow-ramp constant-driven
- HUD ownership changed, with a fixed bottom-left minimap and gameplay HUD exclusions
- weapon pickups must render as weapon-specific floor pickups rather than generic crate circles
- maps now include readability-driven acceptance requirements, including canonical viewpoints for visual QA

## Product Decisions Captured

These choices were confirmed before implementation and should drive both tests and code:

- movement should feel immediate from rest
- movement release should have no perceptible coast
- direction reversal should feel snappy and gamey rather than weighty
- sprint should behave as simply faster movement, not as a momentum-heavy committed state
- wall and desk contact should favor clean sliding over sticky snagging
- title text, connection status/hint text, chat, and debug overlay should be removed completely from normal gameplay HUD
- pickup rendering should be literal, weapon-specific floor silhouettes rather than abstract markers

## Scope From The Diff

Changed specs:

- `specs/movement.md`
- `specs/ui.md`
- `specs/graphics.md`
- `specs/maps.md`

Implementation consequences in the current codebase:

- movement tuning and prediction/reconciliation are out of spec on both client and server
- the scene still creates gameplay title text, connection text, chat, and debug overlay in HUD space
- the minimap is still laid out using the old top-left cluster assumptions
- pickups still use the old yellow-circle crate rendering
- shared map schema/content does not yet encode canonical visual acceptance viewpoints

## Known Spec Gaps To Resolve While Implementing

These should be treated as explicit cleanup tasks during the work:

- `specs/ui.md` now places the minimap bottom-left, but `TS-UI-018` still says the minimap is at `(20, 20)`
- `specs/maps.md` uses validation language for readability outcomes that cannot be proven by static schema checks alone

Working interpretation:

- static validation should enforce geometry/reachability invariants
- viewpoint-based visual readability should be enforced by authored metadata plus visual QA, not only by schema validation

## Delivery Strategy

Work in thin vertical slices with strict red/green cycles. Do not mix all four change areas into one batch.

Order:

1. spec clarification pass
2. executable acceptance targets
3. movement red/green
4. HUD red/green
5. pickup rendering red/green
6. map viewpoint/readability infrastructure red/green
7. repo-wide verification
8. subagent test-quality pass x3
9. subagent pre-mortem pass x1

## Phase 0: Spec Clarification Pass

Before code changes, update the relevant specs so the written contract reflects the confirmed product decisions and does not contain stale contradictions.

Target specs:

- `specs/movement.md`
- `specs/ui.md`
- `specs/graphics.md`
- `specs/maps.md`

Required clarifications:

- movement explicitly favors immediate start, no perceptible coast, crisp reversal, responsive sprint, and sliding over snagging
- UI explicitly removes title text, connection text, chat, and debug overlay from normal gameplay rather than merely moving them out of HUD corners
- pickup rendering explicitly favors literal weapon-specific floor silhouettes
- map spec distinguishes static validation from viewpoint-driven visual acceptance
- stale minimap expectations in `specs/ui.md` test scenarios are corrected to match the bottom-left contract

Definition of done:

- the relevant specs can be handed to another engineer without relying on our conversation as hidden context
- the spec text no longer contains contradictions that would produce misleading red tests

## Phase 1: Acceptance Target Freeze

Before changing behavior, translate the new spec language into measurable checks.

Define concrete thresholds for:

- immediate-feeling start from rest
- immediate-feeling stop on release
- crisp reversal
- sprint remaining clearly faster than normal movement
- acceptable reconciliation drift during ordinary movement
- acceptable wall-slide behavior along desks and walls
- HUD corner ownership and non-occlusion expectations
- pickup readability states
- canonical viewpoint data shape for map visual QA

Initial interpretation for movement feel:

- first movement input should produce visible motion immediately
- combat-usable speed should be reached very quickly rather than over a long ramp
- releasing input should drive the player to near-stop almost immediately
- reversing direction should clear prior-direction momentum quickly enough to feel arcade-like
- sprint should preserve the same responsiveness as normal movement while increasing top speed
- wall contact should resolve into clean slide behavior rather than sticky corner catches

Definition of done:

- the team can point to a concrete test or visual check for each new spec requirement
- stale or contradictory test text discovered during this phase is queued for correction

## Phase 2: Movement Red

Target files and areas:

- `stick-rumble-client/src/game/physics/PredictionEngine.ts`
- `stick-rumble-client/src/game/physics/PredictionEngine.test.ts`
- `stick-rumble-client/src/game/scenes/GameSceneEventHandlers.reconciliation.test.ts`
- `stick-rumble-server/internal/game/physics.go`
- `stick-rumble-server/internal/game/physics_movement_test.go`
- any reconciliation and wall-contact integration tests that expose routine correction behavior

Add failing tests for:

- client prediction reaching combat-usable speed quickly from rest
- server movement reaching combat-usable speed quickly from rest
- stop behavior on input release with no perceptible coast
- crisp direction reversal
- sprint prediction parity between client and server
- local wall contact sliding cleanly without sticky snagging
- no routine visible correction during normal obstacle contact

Important rule:

- do not keep tests that explicitly bless the old 4-second acceleration ramp
- do not add tests that reward weighty movement, sprint wind-up, or visible release slide

Exit criteria:

- the failing test set names the desired behavior clearly enough that implementation choices are obvious

## Phase 3: Movement Green

Implement the new movement semantics in the smallest cross-runtime slice possible.

Likely code changes:

- retune shared movement constants
- keep client and server movement math aligned
- ensure client prediction respects sprint semantics exactly
- tighten reconciliation so ordinary movement corrections remain effectively invisible
- preserve deterministic wall sliding and anti-cheat validation behavior

Refactor goals:

- centralize movement tuning values where client/server parity depends on them
- remove stale comments and test assumptions that describe visible momentum as desired behavior

Exit criteria:

- movement tests pass on both client and server
- ordinary sprinting and wall contact no longer rely on known prediction mismatch behavior

## Phase 4: HUD Red

Target files and areas:

- `stick-rumble-client/src/game/scenes/GameScene.ts`
- `stick-rumble-client/src/game/scenes/GameSceneUI.ts`
- `stick-rumble-client/src/game/scenes/GameSceneUI.test.ts`
- any scene/UI tests that currently assert the old HUD layout

Add failing tests for:

- minimap anchored bottom-left
- minimap no longer positioned under the health/ammo cluster
- top-left reserved for immediate survival/combat HUD only
- top-right reserved for score/kills/timer/feed
- bottom-right reserved for action-state widgets
- title text removed from normal gameplay scene
- connection hint/status text removed from normal gameplay scene
- chat removed from normal gameplay scene
- debug overlay removed from normal gameplay scene

If a mechanical non-occlusion assertion is feasible, add it. If not, capture it for the later visual QA pass.

Exit criteria:

- tests fail specifically on the current scene/UI layout assumptions

## Phase 5: HUD Green

Implement the HUD rezoning.

Likely code changes:

- move minimap to a fixed bottom-left anchor
- stop creating gameplay title/connection hint text in the normal gameplay scene
- remove chat/debug from the normal gameplay scene
- preserve existing required HUD widgets while aligning them to the new corner contract

Refactor goals:

- avoid scattering hardcoded HUD coordinates across scene bootstrap
- make corner ownership obvious in layout code

Exit criteria:

- gameplay HUD matches the new zoning rules
- stale tests that still encode the old minimap position are corrected

## Phase 6: Pickup Rendering Red

Target files and areas:

- `stick-rumble-client/src/game/entities/WeaponCrateManager.ts`
- `stick-rumble-client/src/game/entities/WeaponCrateManager.test.ts`
- any scene tests that assume old crate visuals

Add failing tests for:

- available pickup renders a weapon-specific silhouette
- unavailable pickup remains visible but subdued
- unavailable pickup still communicates returning weapon type
- persistent secondary pickup-zone affordance remains visible
- ranged pickups read as literal weapon objects rather than generic markers
- melee pickup visuals read as actual bat/katana objects instead of generic markers

Keep these tests assertion-focused. Prefer checking drawing calls, state transitions, and per-weapon rendering selection rather than broad snapshots first.

Exit criteria:

- tests clearly reject the old yellow-circle-only crate presentation

## Phase 7: Pickup Rendering Green

Implement the pickup redesign.

Likely code changes:

- replace generic crate-circle rendering with weapon-specific pickup rendering
- keep bobbing behavior if still desired by the spec
- preserve runtime available/unavailable state transitions
- ensure the empty/unavailable state still communicates weapon identity
- prefer literal silhouettes over abstract iconography

Refactor goals:

- separate pickup state from pickup drawing
- isolate per-weapon pickup art routines so tests stay readable

Exit criteria:

- pickup rendering behavior matches the new spec at the unit level

## Phase 8: Map Readability And Viewpoint Infrastructure Red

Target files and areas:

- `maps/default_office.json`
- `maps-schema/src/map-schema.ts`
- `maps-schema/src/map-schema.test.ts`
- shared client map-loading helpers
- any test harness used for visual acceptance or scripted viewpoints

Add failing tests for:

- map content supports canonical viewpoint metadata
- viewpoint entries include player position, facing/aim direction, and expected readability outcome
- any new static geometry checks required by the updated map spec
- optional reachability/safety-margin checks if they can be expressed deterministically

Do not overclaim static validation:

- false openings and invisible blockers are primarily visual acceptance concerns
- encode the authored viewpoints first so later visual QA has a contract to run against

Exit criteria:

- the map/schema layer can describe the new canonical acceptance viewpoints

## Phase 9: Map Readability And Viewpoint Infrastructure Green

Implement the map contract extensions.

Likely code changes:

- extend the map schema/types with viewpoint metadata
- add canonical viewpoints to `default_office`
- expose viewpoint data to any client-side visual QA harness if needed
- add any deterministic static validation that is actually enforceable from authored geometry alone

Refactor goals:

- keep viewpoint metadata independent from runtime state
- avoid polluting geometry validation with subjective render judgments

Exit criteria:

- the office map now declares the visual acceptance viewpoints required by the spec

## Verification Sequence

Use narrow targets during red/green loops, but finish with repo-level gates from the repo instructions.

Recommended final sequence:

1. `make lint`
2. `make typecheck`
3. `make test`

If a reliable visual or integration pass exists for the viewpoint work, run it after the unit/integration gates.

If any gate cannot be run, record exactly what was skipped and why.

## Test Quality Subagent Pass

Run after the code is green.

Requirement:

- use `gpt-5.4`
- run three separate subagent reviews focused on changed unit tests

Suggested split:

1. movement tests
2. HUD and pickup tests
3. map schema/viewpoint tests

Review prompt shape:

`Review the recent test changes in /home/mtomcal/code/stick-rumble for vague assertions, weak tests, false positives, or meaningful missing cases. Focus only on these files: <file list>. Be specific: identify bad assertions or meaningful missing coverage only.`

Gate:

- address high-signal findings before final sign-off

## Pre-Mortem Subagent Pass

Run after tests are green and after the test-quality passes.

Requirement:

- use one `gpt-5.4` subagent

Focus areas:

- movement feel regressions despite passing tests
- hidden client/server drift in sprint or reconciliation
- HUD overlap or corner ownership regressions at different viewport/camera states
- pickup readability failures against floor/background contrast
- map-schema additions that are present but not actually consumed by any QA path
- stale tests still encoding old spec assumptions

Expected output:

- a concise risk list ordered by severity
- concrete likely failure modes
- suggested mitigation or additional test for each serious risk

## Definition Of Done

The work is done when all of the following are true:

- movement behavior is updated and covered by passing red/green tests on both client and server
- gameplay HUD layout matches the new corner-ownership spec
- pickup rendering matches the new weapon-specific readability requirements
- the map contract includes canonical visual acceptance viewpoints for the office map
- repo verification passes, or any skipped verification is explicitly documented
- three `gpt-5.4` unit-test quality reviews have been completed and acted on
- one `gpt-5.4` pre-mortem review has been completed and acted on
