# Friends-MVP Implementation Plan

## Goal

Implement the April 11, 2026 Friends-MVP spec changes as production code using strict red/green TDD.

This plan covers the non-deployment behavior introduced by:

- `6a2fac0` `docs(specs): add friends-mvp join flow and aws mvp deployment`
- `881e6a5` `docs(specs): pre-mortem fixes for friends-mvp and aws deployment`

It also incorporates the product decisions confirmed during planning:

- invite links use a query param, not a routed path
- canonical share shape is `<configured-client-base-url>/?invite=PIZZA`
- if there is no saved display name, invite flow blocks on name entry before join
- if there is a saved display name, fresh invite opens auto-join immediately
- failed hello attempts stay on the same socket and return to the same join UI
- reconnect auto-replays the last successful hello once, then falls back to a reconnect card
- reconnect failure card shows only `Retry <CODE>` and `Play Public`
- duplicate same-browser invite tabs are hard-blocked client-side
- host waits in the arena with a minimal overlay, not a separate lobby screen
- primary share action is `Copy Invite Link`
- display name persists indefinitely in local storage after successful join
- mixed-version `room:joined` failures are fatal version mismatches
- server-side liveness enforcement is part of this work
- TTL is only a fallback for empty, unstarted code rooms
- code collision risk between unrelated groups remains an explicit accepted MVP risk

## Scope

This plan covers five implementation areas:

- shared wire contract updates for `player:hello`, new error messages, and `room:joined`
- server room assignment and connection lifecycle changes
- client invite/join/reconnect UX and state management
- display name propagation into gameplay rendering
- config and environment cleanup needed to keep the feature aligned with upcoming deployment work

## Non-Goals

This plan does not implement:

- CloudFront or S3 routing rules
- strict production `CheckOrigin` hardening
- Elastic IP, TLS, or systemd deployment work
- account systems, friend lists, or discoverable invite objects
- persistent session resume across reconnects
- collision mitigation for human room codes

Those are deployment or post-MVP concerns. This plan leaves clean seams for them.

## Product Flow To Implement

### Host Flow

1. Host opens the game.
2. Host enters a display name if none is already stored.
3. Host chooses friends mode and supplies a code, or lands through `?invite=<raw>`.
4. Client opens the WebSocket.
5. Client sends `player:hello` as the first gameplay-relevant message on that connection.
6. Server sanitizes the display name, normalizes the code, creates or joins the named room, and returns `room:joined`.
7. If the room is a code room with only one player, the host remains in the arena with a waiting overlay showing the normalized code and a `Copy Invite Link` action.

### Friend Join Flow

1. Friend opens `?invite=<raw>`.
2. If the browser has no saved display name, client shows a minimal join card with the raw invite code prefilled and blocks on name entry.
3. If the browser has a saved display name, client auto-joins immediately.
4. Client sends `player:hello { displayName, mode: "code", code: <raw> }`.
5. Server normalizes the code and either:
   - joins the existing room and starts the match if the threshold is crossed
   - creates a fresh code room if the old one ended
   - returns `error:bad_room_code`
   - returns `error:room_full`

### Reconnect Flow

1. Socket drops after a successful join.
2. Client reconnects and auto-replays the last successful hello once.
3. If replay succeeds, gameplay resumes on the new connection under MVP rules.
4. If replay fails, client shows a reconnect card with only:
   - `Retry <CODE>`
   - `Play Public`

### Duplicate Tab Flow

1. A second tab in the same browser profile opens the same invite while the first tab is active.
2. Client-side duplicate-tab guard detects the active claimant.
3. Second tab is hard-blocked with a blocking screen that directs the user to the existing tab.

## Implementation Principles

- `player:hello` is the only room-assignment entry point
- a successful hello latches, a failed hello does not
- the server remains authoritative for room-code normalization and display-name sanitization
- query-param invite parsing is convenience only, not a second room contract
- client reconnect behavior replays only the last successful hello, never failed drafts
- all environment access should be funneled through small config modules rather than scattered direct reads
- `.env.example` files are documentation, not required runtime dependencies
- invite-link generation must not assume ownership of any specific production domain

## Delivery Strategy

Work in thin red/green slices. Do not batch schema, server, client, and UX changes into one large commit-sized step.

Recommended order:

1. acceptance contract freeze
2. schema red/green
3. server room + hello contract red/green
4. client handshake and invite state red/green
5. waiting/reconnect/duplicate-tab UX red/green
6. rendering and display-name propagation red/green
7. stale-room pruning and socket liveness red/green
8. config/env cleanup
9. verification
10. subagent test-quality pass x3
11. subagent pre-mortem pass x1

## Phase 0: Acceptance Contract Freeze

Before code changes, ensure the plan treats the current specs as fixed for this MVP:

- `specs/player.md`
- `specs/rooms.md`
- `specs/messages.md`
- `specs/networking.md`

Translate those specs plus the planning decisions above into executable expectations:

- invite links use `?invite=<raw>`
- code room join is always driven by `player:hello`
- failed hellos do not latch `HelloSeen`
- `room:joined` now requires `displayName` and may include `code`
- reconnect requires a fresh hello every time
- invite flow requires a saved display name or explicit name entry
- duplicate same-browser invite tabs are blocked client-side
- only empty, unstarted code rooms are eligible for TTL reap
- invite links are generated from configuration, not a hardcoded public hostname

Definition of done:

- each product branch in this document maps to a concrete test or implementation slice

## Phase 1: Shared Schema Red

Target files:

- `events-schema/src/schemas/client-to-server.ts`
- `events-schema/src/schemas/server-to-client.ts`
- `events-schema/src/index.ts`
- `events-schema/src/validate-schemas.ts`
- existing schema tests in `events-schema`
- `stick-rumble-server/internal/network/schema_test.go`
- client schema-validation tests that import generated types

Add failing tests for:

- `player:hello` schema for public and code modes
- `room:joined` requiring `displayName`
- `room:joined.code` being optional
- `PlayerState.displayName` being present where required by broadcasts
- `error:no_hello`
- `error:bad_room_code`
- `error:room_full`

Exit criteria:

- schemas and generated types precisely match the Friends-MVP wire contract

## Phase 2: Shared Schema Green

Implement the schema changes and regenerate artifacts.

Required outcomes:

- server and client compile against the new types
- development schema validation can validate the new message family
- old `room:joined` payload shape is no longer accepted in Friends-MVP codepaths

## Phase 3: Server Hello And Room Contract Red

Target files:

- `stick-rumble-server/internal/game/room.go`
- `stick-rumble-server/internal/game/room_lifecycle_test.go`
- `stick-rumble-server/internal/network/websocket_handler.go`
- `stick-rumble-server/internal/network/websocket_handler_test.go`
- `stick-rumble-server/internal/network/message_processor.go`
- any new focused tests for hello handling

Add failing tests for:

- new sockets do not auto-join rooms on connect
- gameplay messages before hello receive `error:no_hello`
- valid public hello routes to public queue
- valid code hello creates a `RoomKindCode` room
- second joiner on a code room starts the match
- failed bad-code hello keeps the connection open and `HelloSeen == false`
- failed room-full hello keeps the connection open and `HelloSeen == false`
- successful hello latches and later hellos are ignored
- display-name sanitization falls back to `Guest`
- room-code normalization is server-authoritative
- ended code room releases to a fresh rematch room
- room destruction only deletes `codeIndex[code]` if the index still points at that room

Exit criteria:

- tests clearly reject the current pre-MVP auto-join behavior

## Phase 4: Server Hello And Room Contract Green

Implement the server-side contract.

Expected implementation work:

- extend `game.Player` with `DisplayName` and `HelloSeen`
- extend `Room` with `Kind`, `Code`, and timestamps needed for later pruning
- extend `RoomManager` with `codeIndex`
- replace `AddPlayer` as the connect-time room assignment path with explicit hello-driven public/code assignment
- implement `sanitizeDisplayName`
- implement `normalizeRoomCode`
- update `sendRoomJoinedMessage` to include authoritative `displayName` and optional `code`
- ensure code-room join path triggers `match.start()` when crossing the threshold
- preserve the rematch-safe `codeIndex` teardown guard

Refactor goals:

- keep public and code-room flows explicit
- avoid hiding hello gating inside unrelated gameplay handlers

## Phase 5: Client Hello State And Invite Boot Red

Target files:

- `stick-rumble-client/src/App.tsx`
- `stick-rumble-client/src/App.test.tsx`
- `stick-rumble-client/src/game/network/WebSocketClient.ts`
- `stick-rumble-client/src/game/network/WebSocketClient.test.ts`
- `stick-rumble-client/src/game/network/WebSocketClient.connection.integration.test.ts`
- `stick-rumble-client/src/game/network/WebSocketClient.integration.helpers.ts`
- `stick-rumble-client/src/game/scenes/GameScene.ts`
- `stick-rumble-client/src/game/scenes/GameSceneEventHandlers.ts`
- any new join/invite UI component tests

Add failing tests for:

- app parses `?invite=<raw>` on boot
- no saved display name shows a join card and blocks join
- saved display name with invite auto-joins immediately
- gameplay systems do not start merely because the socket opened
- hello is sent before gameplay messages on successful join
- failed hello keeps the join card active on the same socket
- `error:bad_room_code` preserves name and raw code entry
- `error:room_full` preserves name and shows equal-weight actions
- invite auto-join does not start gameplay input before a successful `room:joined`

Exit criteria:

- client tests clearly express the desired invite and hello sequencing behavior

## Phase 6: Client Hello State And Invite Boot Green

Implement the client invite and hello state machine.

Expected implementation work:

- parse the invite query param in app boot logic
- create a minimal join card state for:
  - invite code present with no saved name
  - invite code present with saved name
  - room-full retry
  - bad-code retry
- add local storage persistence for the last successful display name
- teach `WebSocketClient` or a thin wrapper to send hello as the first meaningful message
- ensure game input managers are not initialized until a successful room join path is established
- keep raw invite code in UI state until the server returns the authoritative normalized code
- source the share-link base URL from config with a safe local/dev fallback rather than a hardcoded domain

Refactor goals:

- keep transport concerns in the network layer
- keep invite/join UI state out of Phaser scene internals as much as practical

## Phase 7: Waiting Overlay, Reconnect, And Duplicate Tab Red

Target files:

- `stick-rumble-client/src/App.tsx`
- `stick-rumble-client/src/ui/common/`
- `stick-rumble-client/src/game/scenes/GameScene.ts`
- `stick-rumble-client/src/game/scenes/GameSceneEventHandlers.ts`
- network tests and any new UI component tests

Add failing tests for:

- host alone in a code room sees a waiting overlay in the arena
- waiting overlay uses the authoritative normalized code from `room:joined.code`
- primary action is `Copy Invite Link`
- reconnect replays the last successful hello once
- failed reconnect replay shows a reconnect card with only `Retry <CODE>` and `Play Public`
- second same-browser invite tab is blocked while the first tab heartbeat is active
- stale duplicate-tab claims clear after the owner tab is gone
- waiting overlay copies an invite link built from configured client base URL and authoritative normalized code

Exit criteria:

- tests reject silent reconnect loops, duplicate joins, and missing host feedback

## Phase 8: Waiting Overlay, Reconnect, And Duplicate Tab Green

Implement the user-facing invite lifecycle.

Expected implementation work:

- add a minimal in-arena waiting overlay for solo hosts in code rooms
- build canonical share link from the authoritative normalized code
- implement one automatic reconnect replay using the last successful hello
- on replay failure, show the reconnect card described above
- implement same-browser duplicate-tab guard using `BroadcastChannel` with a `localStorage` fallback heartbeat
- hard-block second tabs in the same browser/profile for the same invite + display name combination
- generate invite links from a configurable client base URL instead of any baked-in production hostname

Important constraints:

- fresh invite loads with a saved name auto-join immediately
- reconnect behavior may auto-replay once without confirmation
- duplicate-tab hard block is client-only and same-browser only

## Phase 9: Display Name Propagation Red

Target files:

- `stick-rumble-client/src/game/entities/PlayerManager.ts`
- `stick-rumble-client/src/game/entities/PlayerManager.test.ts`
- `stick-rumble-client/src/game/scenes/GameSceneEventHandlers.test.ts`
- any server tests covering player-state serialization

Add failing tests for:

- local player stores the authoritative `displayName`
- remote players render their server-authoritative display names
- fallback `Guest` renders correctly
- client treats missing `room:joined.displayName` as a fatal version mismatch
- mixed-version `room:joined` does not silently degrade

Exit criteria:

- tests make the breaking wire posture explicit

## Phase 10: Display Name Propagation Green

Implement display-name flow from server join to gameplay rendering.

Expected implementation work:

- extend client-side player state types with `displayName`
- thread authoritative display names through `room:joined` and player state updates
- replace placeholder labels in rendering with authoritative values
- add blocking version-mismatch handling when required Friends-MVP fields are missing

## Phase 11: Socket Liveness And Stale Room Reaping Red

Target files:

- `stick-rumble-server/internal/network/websocket_handler.go`
- `stick-rumble-server/internal/network/websocket_handler_test.go`
- `stick-rumble-server/internal/game/room.go`
- room lifecycle tests

Add failing tests for:

- pong activity extends connection liveness
- dead sockets time out and run disconnect cleanup
- timed-out disconnects remove players from rooms
- empty, unstarted code rooms become eligible for TTL cleanup
- started rooms are never reaped by the TTL sweeper
- live 1-player connected code rooms are never reaped by TTL

Exit criteria:

- tests capture the intended division of responsibility:
  - liveness handles dead sockets
  - TTL only cleans empty, unstarted leftovers

## Phase 12: Socket Liveness And Stale Room Reaping Green

Implement the cleanup hardening.

Expected implementation work:

- add read-deadline based liveness enforcement
- extend pong handling to refresh read deadlines
- keep periodic ping behavior
- add room timestamps needed for fallback stale-room cleanup
- add a background sweep that reaps only:
  - `RoomKindCode`
  - unstarted match
  - empty room
  - idle past configured TTL

Initial recommended values:

- ping interval: keep current periodic behavior unless tests force change
- stale-room sweep interval: 1 minute
- stale-room TTL: 15 minutes

## Phase 13: Config And Env Cleanup

Target files:

- `stick-rumble-client/.env.example`
- `stick-rumble-server/.env.example`
- client config helper module
- server config helper module
- `Makefile`
- docs or README sections that describe local setup

Required outcomes:

- no real `.env` files committed
- client environment access is centralized around:
  - `VITE_WS_URL`
  - invite/share client base URL
- server environment access is centralized around:
  - `PORT`
  - `ENABLE_SCHEMA_VALIDATION`
  - future-facing `GO_ENV`
  - future-facing `ALLOWED_ORIGINS`
- Friends-MVP code does not hardcode deployment hostnames
- invite-link generation uses a configurable base URL with a safe local fallback

## Phase 14: Invite Join Integration And Smoke Coverage

Because this feature is networking-heavy, unit coverage is not sufficient. Add explicit integration and smoke coverage for common invite flows.

Target files:

- `stick-rumble-client/src/game/network/WebSocketClient.connection.integration.test.ts`
- `stick-rumble-client/src/game/network/WebSocketClient.integration.helpers.ts`
- new or updated invite-focused integration tests
- any server-side websocket integration tests needed for hello gating and reconnect behavior

Add failing integration or smoke tests for:

- host creates a code room and receives `room:joined` with authoritative normalized `code`
- second client joins the same invite code and lands in the same room
- second client using a case/whitespace/punctuation variant of the code still joins the same room
- bad invite code returns `error:bad_room_code` and the same connection remains usable for a corrected hello
- full code room returns `error:room_full` and the same connection remains usable for `mode: "public"` or a different code
- reconnect replays the last successful hello once and can rejoin if the room is still eligible
- gameplay input sent before hello is rejected with `error:no_hello`
- a fresh socket created by reconnect still requires a new hello

Smoke-test expectations:

- these tests should exercise real websocket connect/read/write paths, not only mocked handlers
- at least one smoke path should cover the common happy path:
  - client A joins by code
  - client B joins by invite code
  - both receive compatible room assignment
  - match starts when B joins

Exit criteria:

- the common invite join paths are covered by real integration traffic, not only unit tests

Why this phase exists:

- it prevents deployment assumptions from leaking into game logic
- it keeps the upcoming deployment plan additive instead of corrective

## Verification Sequence

Use narrow targets during red/green loops, then finish with repo-level checks.

Recommended final sequence:

1. `make schema-generate`
2. `make test-server`
3. `make test-client`
4. `make test-integration`
5. `make lint`
6. `make typecheck`
7. `make test`

Skipped verification is unacceptable for this work. The feature is not done unless every required gate above runs and passes.

## Subagent Test-Quality Pass

Run after the full suite is green.

Requirements:

- use `gpt-5.4`
- run three separate subagent reviews
- focus only on recently changed tests

Suggested split:

1. schema + server hello/room tests
2. client invite/join/reconnect/duplicate-tab tests
3. display-name + cleanup/liveness tests

Review prompt shape:

`Review the recent test changes in /Users/mtomcal/Code/alpha/stick-rumble for vague assertions, false positives, weak coverage, or meaningful missing cases. Focus only on these files: <file list>. Be specific: identify bad assertions or meaningful missing coverage only.`

Gate:

- address high-signal findings before final sign-off

## Subagent Pre-Mortem Pass

Run after the code is green and after the test-quality passes are addressed.

Requirements:

- use one `gpt-5.4` subagent

Focus areas:

- invite query param boot flow failing on edge cases
- client/server hello sequencing races
- same-socket retry handling for failed hellos
- reconnect replay causing silent loops or stale-state bugs
- duplicate-tab hard block leaving stale locks
- code-room cleanup failing after dirty disconnects
- TTL sweep accidentally deleting reachable rooms
- mixed-version detection missing a partial failure path
- config seams that will conflict with the deployment phase later

Expected output:

- concise risk list ordered by severity
- concrete likely failure mode for each risk
- one mitigation or additional test for every serious risk

## Definition Of Done

The work is done when all of the following are true:

- `player:hello`, the new room errors, and the new `room:joined` shape are implemented end to end
- server no longer auto-assigns rooms on raw socket connect
- public and code-room join flows behave per spec
- invite query param flow works from fresh open through successful join
- no-saved-name invite opens block on name entry
- saved-name invite opens auto-join
- failed hello flows recover on the same socket
- reconnect auto-replays once and then falls back to the reconnect card
- duplicate same-browser invite tabs are hard-blocked
- host waiting overlay is present for solo code-room hosts
- authoritative display names render correctly
- dead sockets are cleaned up deterministically
- empty, unstarted code rooms are eligible for TTL cleanup and no broader rooms are reaped
- invite happy paths and recovery paths are covered by real websocket integration or smoke tests
- config and env access are centralized and deployment-friendly
- all required verification gates run and pass; skipped tests are unacceptable
- three `gpt-5.4` subagent unit-test reviews have been completed and acted on
- one `gpt-5.4` subagent pre-mortem review has been completed and acted on
