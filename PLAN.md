# Session-First Bootstrap Implementation Plan

## Goal

Implement the feature set defined by commit `baad148` `docs(specs): define ui bugfix flow and session bootstrap` using thin red/green TDD slices.

This plan supersedes the previous Friends-MVP `PLAN.md`. The source-of-truth requirements are already in `specs/`, so this document is now the execution plan for bringing code up to those specs.

## Source Spec Delta

Primary spec changes in `baad148`:

- `specs/messages.md`
- `specs/rooms.md`
- `specs/client-architecture.md`
- `specs/ui.md`
- `specs/match.md`
- `specs/graphics.md`

Feature areas introduced by that commit:

- session-first join lifecycle with `session:status` replacing `room:joined` as the primary bootstrap contract
- explicit `session:leave` support for queue and named-room waiting exits
- React-owned app session state machine with no mounted Phaser canvas before `match_ready`
- full-screen React match-end flow with display-ready winner and scoreboard names
- primary-fire-only mouse contract and context-menu suppression over gameplay
- HUD simplification: weapon label in ammo cluster, no world-space reload bar, no HUD `RELOADING...`
- overhead readability cleanup: local player keeps only `YOU`, remote players keep a readable `displayName` plus health stack
- UI safety rule that raw UUIDs must not appear in player-facing text

## Current State Summary

The codebase is only partially aligned with these specs.

- Server networking and room management still emit `room:joined` and do not handle `session:leave`.
- Server match-end payloads still send `winners: string[]` and do not guarantee display-ready winner summaries.
- Client transport logic still treats `room:joined` as the success latch for reconnect replay and bootstrap readiness.
- `App.tsx` already has some join/reconnect UI, but Phaser is mounted unconditionally and waiting states are overlays on top of a live canvas.
- `MatchEndScreen.tsx` still renders `playerId` values and behaves like a dismissible modal.
- `GameScene.ts` fires on any pointer-down and does not distinguish primary from secondary click.
- `GameSceneUI.ts` still renders `RELOADING...` text and a world-space reload progress bar.
- `PlayerManager.ts` still renders local overhead health and uses a looser label/health layout than the new readability contract.
- `GameSceneEventHandlers.ts` still falls back to truncated player IDs in visible text, which is now out of spec.

## Constraints

- Stay spec-first. The relevant specs are already updated; only change specs again if implementation uncovers a real contradiction.
- Use thin red/green slices. Do not mix schema, server, app-shell, and Phaser refactors into one large step.
- Prefer repo-root commands and final integrated verification with `make lint && make typecheck && make test`.
- Preserve existing behavior outside the new session/bootstrap/UI contract.
- Do not leave mixed bootstrap contracts in place longer than one slice. Every intermediate step must either keep `room:joined` working intentionally or switch both producer and consumer together in the same slice.

## Delivery Strategy

Recommended implementation order:

1. freeze the acceptance contract
2. update schemas red/green
3. update server session contract red/green
4. update client transport/bootstrap red/green
5. move the app shell to React-owned session states red/green
6. align gameplay/HUD/input rendering red/green
7. align match-end payload and UI red/green
8. run integrated verification
9. run end-of-work subagent audits

## Phase 0: Acceptance Contract Freeze

Translate the spec delta into a concrete checklist before touching code.

Acceptance points:

- `session:status` is the only authoritative pre-match lifecycle message for app-shell state.
- `session:status.state` supports `searching_for_match`, `waiting_for_players`, and `match_ready`.
- `session:leave` only affects pre-match states and is ignored once a match is active.
- Phaser must not mount before `match_ready`.
- visible UI text must prefer `displayName`; raw `playerId` values are forbidden in player-facing UI.
- `match:ended` winners and final scores must be display-ready.
- only primary click may trigger `player:shoot`.
- right click over the gameplay surface must not open the browser context menu.
- reload progress must be shown only by the reload arc.
- local overhead health bar must be removed.

Definition of done:

- every acceptance point maps to one or more tests in the phases below

## Phase 1: Shared Schema Red

Target files:

- `events-schema/src/schemas/client-to-server.ts`
- `events-schema/src/schemas/server-to-client.ts`
- `events-schema/src/index.ts`
- `events-schema/src/validate-schemas.test.ts`
- `events-schema/src/schemas/client-to-server.test.ts`
- `events-schema/src/schemas/server-to-client.test.ts`
- `stick-rumble-server/internal/network/schema_test.go`

Add failing tests for:

- `session:leave` client-to-server schema
- `session:status` server-to-client schema with all three states
- `session:status` field rules: `mapId` omitted before `match_ready`, `code` omitted for public sessions
- `match:ended` winners as structured summaries with `displayName`
- `match:ended.finalScores[*].displayName` required
- `room:joined` no longer being treated as the primary client bootstrap type in generated TS types

## Phase 2: Shared Schema Green

Implement the schema changes and regenerate artifacts.

Exit criteria:

- generated types compile on both client and server
- schema validation passes for `session:status`, `session:leave`, and updated `match:ended`
- legacy `room:joined` support is treated as compatibility-only, not as the main happy path

## Phase 3: Server Session Contract Red

Target files:

- `stick-rumble-server/internal/network/websocket_handler.go`
- `stick-rumble-server/internal/network/websocket_handler_test.go`
- `stick-rumble-server/internal/network/integration_test.go`
- `stick-rumble-server/internal/game/room.go`
- `stick-rumble-server/internal/game/room_lifecycle_test.go`
- `stick-rumble-server/internal/game/room_broadcast_test.go`
- `stick-rumble-server/internal/network/broadcast_helper.go`

Add failing tests for:

- public hello while unmatched returns `session:status { state: "searching_for_match" }`
- code-room hello below threshold returns `session:status { state: "waiting_for_players" }`
- second player joining a public or code session transitions both players to `match_ready`
- `session:leave` removes a waiting public player from the queue without disconnecting
- `session:leave` removes a single waiting code-room player cleanly
- `session:leave` is ignored after match start
- gameplay messages before hello still return `error:no_hello`
- reconnect success latches on `session:status { state: "match_ready" }`, not on queueing/waiting states
- match-end payload contains winner summaries and score display names

## Phase 4: Server Session Contract Green

Implement the server-side contract.

Required work:

- replace direct `room:joined` sends in `RoomManager` with `session:status`
- add a helper that builds full session snapshots instead of incremental room events
- add `session:leave` handling in `WebSocketHandler`
- ensure `player.HelloSeen` still latches only after a successful hello
- keep queue and named-room cleanup correct when leaving or disconnecting
- update match-end broadcasting to build winner summaries and display-ready score rows
- keep weapon spawns and gameplay broadcasts gated behind actual `match_ready`

Implementation note:

- if temporary compatibility with `room:joined` is needed for an intermediate slice, keep it short-lived and remove it before final verification

## Phase 5: Client Transport And Bootstrap Red

Target files:

- `stick-rumble-client/src/game/network/WebSocketClient.ts`
- `stick-rumble-client/src/game/network/WebSocketClient.test.ts`
- `stick-rumble-client/src/game/network/WebSocketClient.match-end.test.ts`
- `stick-rumble-client/src/game/scenes/GameSceneEventHandlers.ts`
- `stick-rumble-client/src/game/scenes/GameSceneEventHandlers.test.ts`
- `stick-rumble-client/src/shared/types.ts`

Add failing tests for:

- reconnect success is recorded only when `session:status.state === "match_ready"`
- waiting snapshots do not boot gameplay
- pending gameplay messages queue until `match_ready`
- join success callback receives a session snapshot-derived payload, not `room:joined`
- join failure paths continue to work on the same socket
- visible fallback names use `Guest`, not UUID fragments
- updated match-end client types accept structured winners and named score rows

## Phase 6: Client Transport And Bootstrap Green

Implement the transport/bootstrap migration.

Required work:

- add client-side `SessionStatusData`, `WinnerSummary`, and display-ready `PlayerScore` types
- switch the WebSocket client success latch from `room:joined` to `session:status(match_ready)`
- switch scene event handling from `room:joined` to `session:status`
- keep pending gameplay queues keyed to gameplay readiness, not just connection state
- remove ID-based visible-name fallback from gameplay-side UI helpers

## Phase 7: React App Session State Machine Red

Target files:

- `stick-rumble-client/src/App.tsx`
- `stick-rumble-client/src/App.test.tsx`
- `stick-rumble-client/src/ui/common/PhaserGame.tsx`
- `stick-rumble-client/src/ui/common/PhaserGame.test.tsx`
- `stick-rumble-client/src/App.css`

Add failing tests for:

- `join_form`, `searching_for_match`, `waiting_for_players`, `recoverable_error`, `match_end`, and `in_match` render as distinct app states
- Phaser is not mounted during pre-match states
- public waiting and code waiting render different screen content from the same `session:status` source
- waiting states expose `Back/Cancel`, and cancel sends `session:leave`
- invite links prefill code only and do not auto-submit without a saved display name
- replay reuses the last successful join intent and sends the user to `recoverable_error` if replay fails
- match end replaces the gameplay surface rather than layering over a live canvas

## Phase 8: React App Session State Machine Green

Implement the app-shell rewrite.

Required work:

- move WebSocket/session ownership fully into the React app shell
- mount `PhaserGame` only after a `MatchSession` exists
- make waiting and error states full React screens, not Phaser overlays
- wire `session:leave` into cancel/back actions
- keep duplicate-tab protection and invite-prefill behavior intact while removing any hidden-canvas dependency
- center the gameplay stage and align below-stage content to the same width

Implementation preference:

- introduce an explicit app-session reducer or state object rather than adding more ad hoc booleans to `App.tsx`

## Phase 9: Gameplay Input And HUD Red

Target files:

- `stick-rumble-client/src/game/scenes/GameScene.ts`
- `stick-rumble-client/src/game/scenes/GameScene.ui.test.ts`
- `stick-rumble-client/src/game/scenes/GameScene.events.test.ts`
- `stick-rumble-client/src/game/scenes/GameSceneUI.ts`
- `stick-rumble-client/src/game/entities/PlayerManager.ts`
- `stick-rumble-client/src/game/entities/PlayerManager.test.ts`
- `stick-rumble-client/src/game/input/InputManager.test.ts`

Add failing tests for:

- secondary click does not fire and the gameplay surface suppresses the browser context menu
- ammo cluster shows a weapon label next to ammo
- world-space reload bar is absent
- HUD `RELOADING...` text is absent
- empty-magazine warning still appears only when empty and not already reloading
- local player shows only `YOU` overhead text and no overhead health bar
- remote players keep separate readable name and health elements with stable ordering

## Phase 10: Gameplay Input And HUD Green

Implement the gameplay/HUD alignment.

Required work:

- gate shooting to primary pointer input only
- suppress context menu on the gameplay canvas or stage container
- simplify reload UI to the reload arc plus optional empty-magazine warning
- add a text-first equipped weapon label to the ammo cluster
- remove local overhead health bars
- tighten remote name/health spacing so they cannot visually collide

## Phase 11: Match-End And Player-Facing Name Safety Red

Target files:

- `stick-rumble-client/src/ui/match/MatchEndScreen.tsx`
- `stick-rumble-client/src/ui/match/MatchEndScreen.test.tsx`
- `stick-rumble-client/src/App.test.tsx`
- `stick-rumble-client/src/game/ui/KillFeedUI.test.ts`
- `stick-rumble-client/src/game/scenes/GameSceneEventHandlers.test.ts`

Add failing tests for:

- match-end winner banner renders `displayName`
- scoreboard renders player display names and still highlights the local player by `playerId`
- no raw UUID text appears in match-end UI
- no raw UUID text appears in kill feed fallback paths
- match-end no longer closes on backdrop click or ESC if presented as a full screen

## Phase 12: Match-End And Player-Facing Name Safety Green

Implement the match-end and visible-name cleanup.

Required work:

- convert `MatchEndScreen` from modal behavior to a full-screen result state
- render structured winners and named scoreboard rows
- keep identity logic keyed by `playerId` internally
- replace any remaining UUID-visible fallbacks with safe placeholders such as `Guest`

## Phase 13: Integrated Verification

Run, at minimum:

- `make test-client`
- `make test-server`
- `make lint`
- `make typecheck`
- `make test`

If a full integrated run fails for environmental reasons, record the exact blocker and run the smallest passing subset that still validates the changed surfaces.

## End-Of-Work Subagent Plan

Run these only after the implementation branch is locally green enough for review. All four subagents should use:

- model: `gpt-5.4`
- reasoning effort: `high`

### Subagent 1: Client Test Quality Verification

Role:

- `test-quality-verifier`

Focus:

- `stick-rumble-client/src/App.test.tsx`
- `stick-rumble-client/src/ui/common/PhaserGame.test.tsx`
- `stick-rumble-client/src/ui/match/MatchEndScreen.test.tsx`
- any new app-session tests added for the session-first rewrite

Prompt shape:

- review the recent client app-shell and match-end tests for vague assertions, missing state-transition coverage, and false-positive-prone mocks; report only meaningful issues

### Subagent 2: Gameplay/UI Assertion Audit

Role:

- `test-quality-verifier`

Focus:

- `stick-rumble-client/src/game/scenes/GameScene.ui.test.ts`
- `stick-rumble-client/src/game/scenes/GameScene.events.test.ts`
- `stick-rumble-client/src/game/scenes/GameSceneEventHandlers.test.ts`
- `stick-rumble-client/src/game/entities/PlayerManager.test.ts`
- any new tests for primary-click-only firing and overhead readability

Prompt shape:

- review gameplay/UI tests for assertion vagueness, weak visual-contract checks, and missing edge cases around `match_ready`, right-click suppression, reload UI removal, and overhead layout rules

### Subagent 3: Server And Schema Verification

Role:

- `test-quality-verifier`

Focus:

- `events-schema/src/schemas/*.test.ts`
- `events-schema/src/validate-schemas.test.ts`
- `stick-rumble-server/internal/network/websocket_handler_test.go`
- `stick-rumble-server/internal/network/integration_test.go`
- `stick-rumble-server/internal/game/room_lifecycle_test.go`

Prompt shape:

- review the session bootstrap and leave-flow tests for brittle assumptions, missing negative coverage, and schema/assertion gaps; report only substantive findings

### Subagent 4: Pre-Mortem Analysis

Role:

- `default`

Focus:

- final diff against `baad148` requirements
- architecture risks across server session state, app-shell ownership, Phaser mount timing, and reconnect behavior

Prompt shape:

- perform a pre-mortem on the implementation against commit `baad148`; identify the most likely regressions, hidden coupling points, and production failure modes that could still survive a green test run

## Exit Criteria

The work is complete when:

- the code path from hello to gameplay is driven by `session:status`
- the app shell owns pre-match and post-match screens with Phaser mounted only for actual gameplay
- match-end and other player-facing UI render display names rather than IDs
- the gameplay input and HUD behavior match the updated specs
- repo quality gates pass
- the three test-quality subagent passes and one pre-mortem pass have been reviewed and any real findings are addressed or explicitly accepted
