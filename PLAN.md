# April 17 Spec Delta Implementation Plan

## Goal

Implement the behavior described by commit `0098cf0` (`docs(specs): clarify weapon authority and round-end rules`) using thin red/green TDD slices.

This plan treats the April 17, 2026 spec updates as the contract for production code. The implementation scope is broader than the commit title and currently spans four linked behavior changes:

- equipped-weapon authority and reconciliation
- match-end result freezing and standings presentation
- local HUD stat authority
- melee presentation grammar

## Source Of Truth

Primary specs updated by `0098cf0`:

- `specs/weapons.md`
- `specs/messages.md`
- `specs/match.md`
- `specs/ui.md`
- `specs/melee.md`
- `specs/graphics.md`
- `specs/test-index.md`

## Current Gaps Confirmed In Code

These are the main mismatches between the new specs and the current implementation:

- `stick-rumble-client/src/game/scenes/GameSceneEventHandlers.ts`
  - `weapon:pickup_confirmed` still mutates local equipped-weapon truth
  - `player:kill_credit` updates local score and kills even when another player gets the kill
  - `match:ended` stops movement/timer handling, but not all late stat-facing UI mutation paths
  - `melee:hit` still drives the old generic swing + generic melee impact behavior
- `stick-rumble-client/src/ui/match/MatchEndScreen.tsx`
  - tie ordering still uses deaths as a hidden tiebreaker
  - winner banner still renders raw player IDs instead of authoritative display names
  - ranks do not collapse ties into shared placement
- `stick-rumble-client/src/game/entities/PlayerManager.ts`
  - client-side player state does not yet treat `weaponType` as authoritative player-stream data
- `stick-rumble-server/internal/game/player.go`
  - `PlayerStateSnapshot` does not yet include `weaponType`
- `stick-rumble-server/internal/network/delta_tracker.go`
  - player delta comparison does not treat weapon identity changes as state changes
- `stick-rumble-client/src/game/entities/MeleeWeaponManager.ts`
  - only supports a single `startSwing` path, not preview vs confirmed motion
- `stick-rumble-client/src/game/entities/HitEffectManager.ts`
  - still renders the old symbolic melee `X` marker

## Delivery Strategy

Work in narrow slices. Each slice starts red, then turns green, then gets folded into the next slice. Do not batch all client, server, and UI behavior into one change.

Recommended order:

1. contract audit and test map
2. weapon authority red
3. weapon authority green
4. match-end and HUD authority red
5. match-end and HUD authority green
6. melee presentation red
7. melee presentation green
8. full verification
9. subagent review passes

## Phase 0: Contract Audit

Before changing production code, freeze the acceptance contract from the April 17 specs into concrete test targets.

Verify whether any schema or shared-type changes are still needed in:

- `events-schema/src/schemas/server-to-client.ts`
- `events-schema/src/schemas/server-to-client.test.ts`
- `stick-rumble-client/src/shared/types.ts`
- `stick-rumble-client/src/game/network/WebSocketClient.ts`

Acceptance statements to lock in:

- local equipped weapon comes only from `weapon:state`
- remote equipped weapon comes from the player-state stream, not `weapon:pickup_confirmed`
- respawn must reset local and remote weapon presentation back to pistol from authoritative state
- `player:kill_credit` updates local HUD only if the local player is the killer
- authoritative player-state updates may reconcile local HUD drift
- `match:ended` is a frozen result snapshot
- equal kills share placement; deaths remain display-only
- winners render using authoritative display names when available
- melee motion is weapon-following preview + confirmed motion, with per-victim contact effects

Definition of done:

- every statement above maps to at least one failing test before implementation begins

## Phase 1: Weapon Authority Red

Target tests:

- `stick-rumble-client/src/game/scenes/GameSceneEventHandlers.test.ts`
- `stick-rumble-client/src/game/scenes/GameSceneEventHandlers.reconciliation.test.ts`
- `stick-rumble-client/src/game/entities/PlayerManager.test.ts`
- `stick-rumble-client/src/game/entities/PlayerManager.weapon-sprites.test.ts`
- `stick-rumble-client/src/game/network/WebSocketClient.test.ts`
- `stick-rumble-server/internal/network/delta_tracker_test.go`
- `stick-rumble-server/internal/network/integration_test.go`

Add failing tests for:

- `weapon:pickup_confirmed` updates crate UX and pickup notification, but does not overwrite local `currentWeaponType`
- remote held-weapon visuals update from `player:move` / `state:snapshot` / `state:delta` `weaponType`
- local respawn presentation returns to pistol only when authoritative state says pistol
- player-state deltas include weapon-only changes
- player-state snapshots include `weaponType` for every player

## Phase 2: Weapon Authority Green

Implementation targets:

- `stick-rumble-server/internal/game/player.go`
- `stick-rumble-server/internal/network/broadcast_helper.go`
- `stick-rumble-server/internal/network/delta_tracker.go`
- `stick-rumble-client/src/game/entities/PlayerManager.ts`
- `stick-rumble-client/src/game/scenes/GameSceneEventHandlers.ts`

Expected work:

- add authoritative `weaponType` to server player snapshots
- source that value from the actual equipped weapon state
- make weapon identity changes trigger delta emission
- update `PlayerManager.updatePlayers(...)` to reconcile weapon visuals from streamed player state
- leave `weapon:pickup_confirmed` as room feedback only
- keep `weapon:state` as the only local equip authority

Exit criteria:

- no client subsystem keeps a divergent durable weapon truth

## Phase 3: Match-End And HUD Authority Red

Target tests:

- `stick-rumble-client/src/game/scenes/GameSceneEventHandlers.test.ts`
- `stick-rumble-client/src/game/network/WebSocketClient.match-end.test.ts`
- `stick-rumble-client/src/game/scenes/GameSceneUI.test.ts`
- `stick-rumble-client/src/ui/match/MatchEndScreen.test.tsx`
- `stick-rumble-server/internal/game/match_test.go`
- `stick-rumble-server/internal/network/broadcast_test.go`
- `stick-rumble-server/internal/network/integration_test.go`

Add failing tests for:

- non-local `player:kill_credit` updates kill feed only, not local score/kills HUD
- local `player:kill_credit` sets HUD from server totals instead of blindly incrementing
- a later authoritative player-state can reconcile local XP/kills after missed or out-of-order events
- `match:ended` freezes stat-facing gameplay UI updates after the event arrives
- result ordering is kills descending with shared displayed ranks for ties
- deaths do not break ties
- winners render display names, with player ID fallback only when name data is absent
- server `finalScores` snapshot is consistent with resolved pre-end kills

## Phase 4: Match-End And HUD Authority Green

Implementation targets:

- `stick-rumble-client/src/game/scenes/GameSceneEventHandlers.ts`
- `stick-rumble-client/src/game/ui/ScoreDisplayUI.ts`
- `stick-rumble-client/src/game/ui/KillCounterUI.ts`
- `stick-rumble-client/src/ui/match/MatchEndScreen.tsx`
- `stick-rumble-server/internal/game/match.go`
- `stick-rumble-server/internal/network/message_processor.go`
- `stick-rumble-server/internal/network/broadcast_helper.go`

Expected work:

- gate HUD stat updates on local-player kill ownership
- convert score and kill widgets to set authoritative totals rather than incrementing locally
- ensure `match:ended` freezes downstream stat mutation paths
- update standings helpers so equal-kill players share rank
- resolve winner labels and scoreboard player labels from authoritative display names
- audit server end-of-match sequencing so `match:ended` is emitted only after qualifying kills are fully reflected in `finalScores`

Exit criteria:

- HUD, frozen result modal, and authoritative stats all agree at match end

## Phase 5: Melee Presentation Red

Target tests:

- `stick-rumble-client/src/game/entities/MeleeWeaponManager.test.ts`
- `stick-rumble-client/src/game/entities/HitEffectManager.test.ts`
- `stick-rumble-client/src/game/scenes/GameSceneEventHandlers.test.ts`
- any existing visual harness tests tied to `TS-MELEE-013` and `TS-MELEE-015`

Add failing tests for:

- local melee input can trigger an immediate preview motion without confirmed hit effects
- confirmed `melee:hit` continues or triggers the authoritative room-visible swing
- Bat and Katana use distinct motion/effect families
- contact effects spawn per victim, not once at the attacker origin
- whiffs do not render contact effects
- overlap protection prevents unreadable stacked swings

## Phase 6: Melee Presentation Green

Implementation targets:

- `stick-rumble-client/src/game/entities/MeleeWeapon.ts`
- `stick-rumble-client/src/game/entities/MeleeWeaponManager.ts`
- `stick-rumble-client/src/game/entities/HitEffectManager.ts`
- `stick-rumble-client/src/game/scenes/GameSceneEventHandlers.ts`
- possibly `stick-rumble-client/src/game/input/ShootingManager.ts`

Expected work:

- split local preview motion from server-confirmed swing flow
- replace the old debug-like arc grammar with weapon-following motion
- replace the old melee `X` impact with bat/katana-specific contact effects
- keep preview harmless when the server does not confirm a hit

Exit criteria:

- melee visuals follow the new readability-first grammar without changing server authority over damage

## Phase 7: Verification

Preferred repo-level verification before handoff:

- `make lint`
- `make typecheck`
- `make test`

Likely targeted red/green loops during implementation:

- `make test-client`
- `make test-server`
- targeted Vitest files for `GameSceneEventHandlers`, `PlayerManager`, `MatchEndScreen`, `MeleeWeaponManager`, `HitEffectManager`
- targeted Go tests for `match`, `delta_tracker`, `broadcast`, and network integration

If visual behavior proves hard to lock with unit tests alone, add the smallest focused Playwright or screenshot-based coverage necessary for the new melee motion grammar and tie-rank results UI.

## End-Of-Implementation Subagents

Run these only after the main implementation is green locally. All four subagents should use:

- model: `gpt-5.4`
- reasoning: `high`

### Subagent 1: Client Test Quality Review

Goal:

- review changed client tests for weak assertions, hidden coupling, and missing behavioral checks

Suggested scope:

- changed tests under `stick-rumble-client/src/game/scenes/`
- `stick-rumble-client/src/game/entities/`
- `stick-rumble-client/src/ui/match/`

### Subagent 2: Server And Integration Test Review

Goal:

- review changed Go tests for meaningful coverage around match-end freeze, weapon-state streaming, and delta emission

Suggested scope:

- changed tests under `stick-rumble-server/internal/game/`
- `stick-rumble-server/internal/network/`

### Subagent 3: Assertion Vagueness And Regression Gap Pass

Goal:

- specifically hunt for vague assertions, structure-only tests, and cases where the suite could pass while the spec is still broken

Suggested scope:

- changed client, server, and schema tests across the implementation

### Subagent 4: Pre-Mortem

Goal:

- perform a pre-mortem on the completed implementation and identify the most likely real regressions before merge

Focus areas:

- late-arriving events after `match:ended`
- respawn/pickup ordering races
- remote weapon desync from delta compression
- local preview melee motion diverging from confirmed state
- display-name availability gaps in results UI

## Notes For Execution

- keep commits and code changes small
- prefer fixing one authority boundary at a time
- do not start with the melee visual rewrite before the weapon-state authority path is stable
- when a spec area already matches code or schemas, keep it unchanged and move on
