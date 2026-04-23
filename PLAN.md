# Mobile Mode Implementation Plan

## Inputs Studied

- Commit `985a940` on 2026-04-23 15:55 UTC: `docs: specify optional mobile mode support`
- Commit `aa41509` on 2026-04-23 16:03 UTC: `docs: refine auto-detected mobile mode spec`

Those two commits tighten the active contract in `specs/client-architecture.md`, `specs/ui.md`, `specs/overview.md`, and `specs/visual-spec/VISUAL-SPEC.md`.

## Contract To Implement

- Mobile mode is detected locally for phone-sized touch layouts.
- Desktop remains the baseline path and must continue using the centered stage.
- Mobile mode uses a full-bleed landscape stage that respects safe-area insets and dynamic viewport height.
- Portrait phone play in mobile mode shows a rotate-device gate instead of a usable gameplay layout.
- React owns touch overlays, orientation gating, and stage chrome.
- Phaser continues to own world rendering, camera, and in-canvas HUD.
- Touch controls must feed the same normalized gameplay intent that desktop input sends today.
- Mobile mode may not change matchmaking, sockets, message contracts, room assignment, or server authority.
- Layout transitions may not tear down the current session or recreate gameplay as a side effect.
- Chat remains inactive and may not reclaim HUD space on desktop or mobile.

## Working Assumptions

- We should preserve a single mounted Phaser game once `match_ready` has been reached, even when the layout flips between detected desktop/mobile states. Hiding or re-chroming the stage is acceptable; remounting is not.
- Detection should be conservative. A touch laptop or large tablet should not be forced into the phone layout just because it has touch support.
- The first implementation should optimize for spec compliance and testability, not for perfect virtual-stick feel.

## Expected Change Surface

- React shell and stage layout:
  - `stick-rumble-client/src/App.tsx`
  - `stick-rumble-client/src/App.css`
  - `stick-rumble-client/src/ui/common/PhaserGame.tsx`
  - likely new files under `stick-rumble-client/src/ui/common/` or `stick-rumble-client/src/ui/mobile/`
- Match runtime bridge:
  - `stick-rumble-client/src/game/sessionRuntime.ts`
  - `stick-rumble-client/src/shared/types.ts`
- Input normalization:
  - `stick-rumble-client/src/game/input/InputManager.ts`
  - `stick-rumble-client/src/game/input/ShootingManager.ts`
  - `stick-rumble-client/src/game/input/DodgeRollManager.ts`
- Scene and HUD layout:
  - `stick-rumble-client/src/game/scenes/GameScene.ts`
  - `stick-rumble-client/src/game/scenes/GameSceneUI.ts`
  - `stick-rumble-client/src/game/ui/HealthBarUI.ts`
  - any top-right HUD classes that need runtime repositioning
- Primary test files:
  - `stick-rumble-client/src/App.test.tsx`
  - `stick-rumble-client/src/ui/common/PhaserGame.test.tsx`
  - `stick-rumble-client/src/game/input/InputManager.test.ts`
  - `stick-rumble-client/src/game/scenes/GameScene.ui.test.ts`
  - `stick-rumble-client/src/game/scenes/GameScene.lifecycle.test.ts`
  - targeted tests for any new mobile-control components

## Red/Green TDD Sequence

### Phase 1: Detect mobile mode without breaking the existing session-first shell

Red:
- Add `App.test.tsx` coverage for desktop default behavior after `match_ready`.
- Add `App.test.tsx` coverage for automatic mobile-mode detection on a phone-sized touch layout.
- Add `App.test.tsx` coverage for the rotate-device gate while detected mobile mode is in portrait.
- Add `PhaserGame.test.tsx` coverage that layout-mode changes do not create a second Phaser instance or clear the active match bootstrap.

Green:
- Add a dedicated detection module or hook instead of inlining heuristics inside `App.tsx`.
- Teach the app shell to derive a `stageMode` such as `desktop`, `mobile-landscape`, or `mobile-portrait-blocked`.
- Keep `match_ready` as the only mount gate for Phaser; once mounted, switch stage chrome without remounting the game.
- Update `App.css` for centered desktop framing versus full-bleed mobile stage, safe-area padding, `100dvh`, and touch-safe `touch-action` rules.

Refactor:
- Extract stage-layout and detection logic into isolated React units with direct tests.
- Keep the old join/search/wait/match-end flows untouched except for the new gameplay-stage wrapper.

### Phase 2: Add React-owned mobile controls that emit normalized gameplay intent

Red:
- Add tests for a new mobile-controls component covering:
  - bottom-left movement control ownership
  - bottom-right aim/fire ownership
  - release behavior clearing active intent
  - action buttons for reload and dodge without stealing top-HUD space
- Add `InputManager.test.ts` coverage proving external touch intent can drive movement, aim angle, sprint false-by-default, and release-to-neutral behavior.
- Add regression tests proving keyboard/mouse behavior and current WebSocket payload shape remain unchanged when no mobile intent is present.

Green:
- Introduce a small shared runtime intent type for normalized gameplay input.
- Extend `InputManager` so desktop input remains the baseline source, but a React-owned external intent source can override or supply the same fields.
- Reuse existing firing, reload, and dodge pathways instead of inventing mobile-only network messages.
- Add a mobile-controls React component that publishes intent into the active gameplay runtime without coupling React to Phaser internals.

Refactor:
- Keep the touch-control publisher and Phaser consumer separated by a narrow runtime bridge.
- Avoid `window`-level ad hoc globals if the same bridge can live in `sessionRuntime` cleanly.

### Phase 3: Wire the runtime bridge into the active Phaser scene

Red:
- Add `PhaserGame.test.tsx` or scene lifecycle tests proving the current bootstrap gains access to the mobile-control bridge without recreating Phaser.
- Add lifecycle tests that bridge subscriptions are cleaned up on unmount/shutdown.
- Add scene tests proving mobile layout changes do not toggle gameplay readiness or cause extra connect/disconnect churn.

Green:
- Extend the active match bootstrap or runtime store so React can publish mobile intent to the currently running gameplay scene.
- Register the scene or input layer with that bridge during `GameScene.create()`.
- Keep socket ownership and `setGameplayReady(true)` behavior exactly where it is today.

Refactor:
- Make bridge setup explicit in one place so future spectator or replay work does not need to reverse-engineer mobile input plumbing.

### Phase 4: Make the HUD safe-area-aware while preserving the existing corner contract

Red:
- Add tests around `GameSceneUI` and HUD classes for top-left padding, minimap anchoring, and top-right score/kill/timer placement with injected viewport insets.
- Add tests proving zero insets preserve current desktop positions.
- Add tests proving mobile safe-area insets move HUD clusters inward without changing their ownership zones.

Green:
- Introduce a viewport-inset/layout API owned by the scene UI layer.
- Reposition top-left, top-right, bottom-left, and bottom-right HUD elements from shared layout inputs rather than fixed literals captured at scene creation.
- Keep the current desktop spacing as the zero-inset baseline.
- Ensure the bottom corners remain available for touch controls in mobile mode.

Refactor:
- Prefer one scene-level HUD layout pass over scattered one-off coordinate writes.
- Use measured layout helpers already present in the HUD code instead of adding new hardcoded offsets.

### Phase 5: Lock regressions and finish with whole-client verification

Red:
- Add at least one high-signal integration-style test that simulates a `match_ready` transition into mobile mode and then into desktop mode without losing the mounted gameplay instance.
- Add at least one test that mobile portrait gating does not destroy the current session state.

Green:
- Fix whatever whole-flow regressions appear after the earlier phases land.
- Keep implementation minimal; do not broaden into tablet UX polish, controller support, or server changes.

Refactor:
- Remove temporary bridge scaffolding, dead CSS, and duplicated viewport helpers before calling the work complete.

## Implementation Order

1. Land detection and stage-shell tests plus minimal stage-mode plumbing.
2. Land the touch-controls component and its isolated tests.
3. Extend the gameplay runtime bridge and `InputManager` so touch controls can drive the same authoritative input contract.
4. Make HUD layout inset-aware.
5. Run full client verification, then repo-wide validation.

## Verification

Primary local validation:

- `make test-client`
- `make lint`
- `make typecheck`
- `make test`

Focused local reruns during development:

- `npm --prefix stick-rumble-client test -- src/App.test.tsx src/ui/common/PhaserGame.test.tsx`
- `npm --prefix stick-rumble-client test -- src/game/input/InputManager.test.ts`
- `npm --prefix stick-rumble-client test -- src/game/scenes/GameScene.ui.test.ts src/game/scenes/GameScene.lifecycle.test.ts`

## Subagent Verification Passes

Run these after the green implementation is stable, not before the red/green loop.

### Pass 1: Test verifier for shell and stage transitions

Agent type:

- `test-quality-verifier`

Scope:

- `stick-rumble-client/src/App.test.tsx`
- `stick-rumble-client/src/ui/common/PhaserGame.test.tsx`
- tests for any new gameplay-stage or rotate-device components

Prompt:

`Review the recent mobile-mode test changes in /home/mtomcal/code/stick-rumble. Focus on App shell, stage-layout, rotate-device, and Phaser remount coverage only. Identify vague assertions, missing state-transition coverage, or tests that would pass even if gameplay remounts accidentally.`

### Pass 2: Test verifier for input normalization and touch controls

Agent type:

- `test-quality-verifier`

Scope:

- `stick-rumble-client/src/game/input/InputManager.test.ts`
- tests for any new mobile-touch-controls component
- tests for any runtime bridge used to publish touch intent

Prompt:

`Review the recent mobile-input test changes in /home/mtomcal/code/stick-rumble. Focus on normalized intent, release-to-neutral behavior, aim-angle assertions, and regressions that could let desktop input silently change shape. Identify only meaningful weaknesses.`

### Pass 3: Test verifier for scene and HUD layout behavior

Agent type:

- `test-quality-verifier`

Scope:

- `stick-rumble-client/src/game/scenes/GameScene.ui.test.ts`
- `stick-rumble-client/src/game/scenes/GameScene.lifecycle.test.ts`
- HUD-related tests updated for safe-area-aware layout

Prompt:

`Review the recent mobile HUD and scene-layout tests in /home/mtomcal/code/stick-rumble. Focus on safe-area inset handling, corner ownership preservation, and lifecycle cleanup. Flag weak assertions or meaningful missing cases only.`

### Pass 4: Pre-mortem review

There is no dedicated pre-mortem agent role in this workspace, so use a `default` or `explorer` subagent with a pre-mortem prompt.

Scope:

- the full mobile-mode diff after implementation

Prompt:

`Perform a pre-mortem review of the mobile-mode implementation in /home/mtomcal/code/stick-rumble. Assume the feature ships and then fails in production. Identify the most likely failure modes first: accidental Phaser remounts during orientation/layout changes, stuck touch intent after pointer cancel, double-fire from mouse plus touch overlap, safe-area/HUD overlap on iPhone landscape, and session churn caused by UI-only mode switches. Be specific about which files and tests are the weakest points.`

## Done Criteria

- Desktop gameplay still mounts and behaves exactly as before on non-mobile layouts.
- Phone-sized touch layouts automatically enter mobile mode without a user toggle.
- Portrait mobile mode blocks active play with a rotate-device gate.
- The same active match survives layout transitions without socket churn or Phaser recreation.
- Touch controls drive the existing authoritative input contract.
- HUD corner ownership remains intact with safe-area-aware offsets.
- All targeted tests and verification passes are complete.
