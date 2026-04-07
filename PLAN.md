# Config-Driven Map System Plan

## Goal

Implement the spec changes from `HEAD~1..HEAD` so the game uses a shared, config-driven map system instead of hardcoded arena geometry, spawn logic, and weapon crate placement.

The shipped v1 target is one authoritative default map, `default_office`, with:
- shared JSON content loaded by both client and server
- schema validation and startup failure on invalid content
- room-level `mapId`
- map-authored spawn points and weapon spawns
- map-authored obstacles affecting movement, projectiles, and client rendering

## Scope From The Diff

The spec commit changes the contract in these ways:
- adds a new `maps.md` source-of-truth spec
- makes selected map dimensions authoritative instead of global arena constants
- adds `mapId` to room assignment and `room:joined`
- moves spawn selection and weapon spawn ownership into map data
- introduces blocking obstacle geometry for movement, projectiles, and LOS

## Implementation Strategy

Work in thin vertical slices with strict red/green TDD. Keep each slice small enough that failing tests clearly name the missing behavior.

Order:
1. Shared map contract and default content
2. Shared/network message contract updates
3. Server map registry and room assignment
4. Server spawn and weapon-crate ownership migration
5. Server obstacle and world-bound enforcement
6. Client map loading and visual/runtime adoption
7. End-to-end verification, test-quality review, and pre-mortem

## Phase 0: Contract Freeze

Before code changes:
- treat the spec diff as the contract baseline
- confirm whether `server-architecture.md` or client/server architecture docs need follow-up edits after implementation
- identify the archived office-layout reference that should inform `default_office.json`

Definition of done:
- no hidden requirements remain in legacy docs or code comments that contradict the new specs

## Phase 1: Shared Map Contract And Content

Target files and areas:
- `maps/`
- `maps-schema/`
- `events-schema/` if map schemas are exported there or reused from there

Red:
- add schema/unit tests for invalid map structure
- add schema/unit tests for spatial validation failures:
  - spawn inside blocking obstacle
  - weapon spawn inside blocking obstacle
  - positive-area obstacle overlap
  - out-of-bounds authored geometry
- add a success test for loading `default_office`

Green:
- create `maps/default_office.json`
- create `maps-schema` schema definitions and validators
- implement registry loading and validation helpers shared by both runtimes

Refactor:
- centralize map types and validation errors
- keep IDs and geometry helpers reusable across client and server

Exit criteria:
- one valid default map exists
- bad content fails deterministically before runtime use

## Phase 2: Shared Message Contract

Target files and areas:
- [events-schema/src/schemas/server-to-client.ts](/home/mtomcal/code/stick-rumble/events-schema/src/schemas/server-to-client.ts)
- generated JSON schema artifacts
- client/server tests asserting `room:joined`

Red:
- update schema tests so `room:joined` requires `roomId`, `playerId`, and `mapId`
- update integration tests that currently only assert `playerId`

Green:
- extend `RoomJoinedDataSchema`
- regenerate or refresh generated JSON schema artifacts if required by the repo workflow

Refactor:
- remove duplicated ad hoc `room:joined` payload assumptions in tests

Exit criteria:
- schema contract matches spec and downstream tests compile against it

## Phase 3: Server Map Registry And Room Assignment

Target files and areas:
- [stick-rumble-server/internal/game/room.go](/home/mtomcal/code/stick-rumble/stick-rumble-server/internal/game/room.go)
- room lifecycle tests
- server startup/bootstrap path that constructs shared game services

Red:
- add tests for room creation assigning the default `mapId`
- add tests for `room:joined` including `mapId`
- add tests for startup failure when required maps are missing or invalid

Green:
- add `MapID` to `Room`
- change `NewRoom()` to accept a selected/default map ID
- load the server map registry during startup
- emit `mapId` in `room:joined`

Refactor:
- avoid stringly-typed default-map duplication by defining one server-side constant/config entry

Exit criteria:
- every room has one authoritative `mapId`
- server will not boot with broken map content

## Phase 4: Server Spawn Selection And Weapon Spawn Ownership

Target files and areas:
- [stick-rumble-server/internal/game/world.go](/home/mtomcal/code/stick-rumble/stick-rumble-server/internal/game/world.go)
- [stick-rumble-server/internal/game/weapon_crate.go](/home/mtomcal/code/stick-rumble/stick-rumble-server/internal/game/weapon_crate.go)
- related tests in `world_test.go` and `weapon_crate_test.go`

Red:
- add tests for selecting the safest authored spawn point from map spawn points
- add tests that weapon crates are created from authored map spawn entries instead of hardcoded arena fractions
- add tests for rejecting authored spawn points that should have been filtered out by validation or runtime sanity checks

Green:
- inject selected map config into world/spawn logic
- replace random spawn candidate generation with scoring over authored spawn points
- initialize weapon crates from map `weaponSpawns`

Refactor:
- separate authored map data from mutable runtime crate state
- keep spawn scoring logic pure enough for focused unit tests

Exit criteria:
- respawns and weapon crate positions come from map data only

## Phase 5: Server Obstacle And World-Bound Enforcement

Target files and areas:
- [stick-rumble-server/internal/game/physics.go](/home/mtomcal/code/stick-rumble/stick-rumble-server/internal/game/physics.go)
- projectile logic
- dodge-roll logic
- any server-side LOS or hit-detection helpers affected by obstacle blocking

Red:
- add unit tests for clamping using selected map width/height instead of global constants
- add unit tests for player collision against movement-blocking rectangles
- add integration tests for projectile destruction on projectile-blocking obstacles
- add integration tests for dodge roll cancellation on obstacle collision

Green:
- thread selected map dimensions into clamping and bounds checks
- add rectangle collision/resolution for movement-blocking obstacles
- destroy projectiles when they intersect projectile-blocking obstacles
- terminate rolls when movement is stopped by obstacle collision

Refactor:
- introduce shared rectangle/spatial helpers instead of duplicating geometry math
- keep movement collision resolution deterministic between server ticks

Exit criteria:
- no authoritative movement or projectile system depends on hardcoded empty-arena assumptions

## Phase 6: Client Map Loading, Bootstrap, And Rendering

Target files and areas:
- [stick-rumble-client/src/game/scenes/GameScene.ts](/home/mtomcal/code/stick-rumble/stick-rumble-client/src/game/scenes/GameScene.ts)
- [stick-rumble-client/src/game/scenes/GameSceneEventHandlers.ts](/home/mtomcal/code/stick-rumble/stick-rumble-client/src/game/scenes/GameSceneEventHandlers.ts)
- crate/minimap/background rendering code
- client shared constants and map-loading helpers

Red:
- add tests for `room:joined` carrying `mapId` through client bootstrap
- add tests that the client resolves the same local map config by `mapId`
- add tests for rendering/initializing obstacles and weapon crates from map data
- add tests for replacing hardcoded arena bounds in scene setup where required

Green:
- load the shared client map registry at startup
- store/use `mapId` from `room:joined`
- set world bounds, camera bounds, background extents, minimap scale inputs, and crate positions from selected map
- render map obstacles in the scene

Refactor:
- move map bootstrap logic out of large scene methods where possible
- keep map rendering separate from authoritative network event handling

Exit criteria:
- client view is driven by the same map content ID as the server
- visible geometry and crate placement match authoritative behavior

## Phase 7: Verification And Finish

Primary verification sequence:
1. `make lint`
2. `make typecheck`
3. `make test`
4. `make test-integration`

If the test surface becomes too large during development, use narrower targets during red/green, but finish with the full repo gates above.

## Test Plan

Minimum new or updated test coverage:
- map schema validation unit tests
- `room:joined` schema and integration tests
- server room lifecycle tests for `mapId`
- spawn selection tests over authored points
- weapon crate initialization tests from map config
- physics tests for bounds and obstacle collision
- projectile obstacle-destruction tests
- client bootstrap tests using `mapId`
- client map rendering or manager tests for obstacle/crate loading

## Test-Quality Subagents

Run after the code is green and before final sign-off.

Subagent pass 1:
- use an `explorer` or `worker` focused only on changed tests
- ask for vague assertions, missing behavioral coverage, and false-positive risk
- focus on map schema tests, room lifecycle tests, physics tests, and client bootstrap/render tests

Suggested prompt:
`Review the recent test changes in /home/mtomcal/code/stick-rumble for vague assertions, weak tests, or coverage gaps. Focus on these files: <changed test file list>. Be specific: identify bad assertions or meaningful missing cases only.`

Subagent pass 2:
- if client and server test surfaces are both large, split review into two parallel subagents:
  - server tests
  - client and schema tests

Gate:
- address any high-signal findings before finalizing

## Pre-Mortem Checklist

Run after tests are green and after the test-quality subagent pass.

Questions to answer:
- Are client and server definitely loading the same `mapId` and same content version?
- Can any remaining hardcoded `ARENA_WIDTH` or `ARENA_HEIGHT` assumptions still affect runtime behavior?
- Does any startup path bypass map validation?
- Could obstacle collision behave differently between movement, dodge roll, projectile, and spawn logic?
- Do any tests only prove happy-path loading but not invalid-content failure?
- Could `room:joined` race with map bootstrap and leave the client in a partially initialized state?
- Are generated schema artifacts updated, committed, and actually used by the server validator?
- Could map-authored IDs collide or be relied on implicitly by brittle tests?
- Does the default office map preserve intended lane/control relationships, not just compile successfully?

## Risks To Watch Early

- hardcoded arena constants are deeply embedded in tests and helper constructors
- server world/physics code may need dependency injection for selected map state
- client scene bootstrap currently assumes arena size before any network event arrives
- generated schema artifacts can drift from TypeBox source changes
- obstacle collision can expand scope quickly if introduced in too many systems at once

## Working Rules

- keep specs as source of truth; if implementation exposes a spec gap, update specs before continuing
- prefer pure helpers for geometry and validation so tests stay narrow
- do not rewrite room/world/scene architecture unless TDD proves the current seams cannot support the contract
- keep each red/green slice shippable and easy to review
