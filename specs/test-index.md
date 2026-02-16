# Test Index

> **Spec Version**: 1.1.0
> **Last Updated**: 2026-02-15
> **Depends On**: All specs (cross-reference document)
> **Depended By**: None (reference document)

---

## Overview

This document serves as a cross-reference index of all test scenarios defined across the specification suite. Use this index to:
1. Quickly find tests for a specific system
2. Verify test coverage completeness
3. Plan implementation order based on critical tests
4. Track what's been implemented vs. specified

**Why This Index Exists**

When implementing from scratch, AI agents need to:
- Know exactly which tests to write first (critical path)
- Verify they haven't missed any specifications
- Understand testing priorities across systems
- Have a single source of truth for all test IDs

---

## Summary Statistics

| Metric | Value |
|--------|-------|
| **Total Test Scenarios** | 194 |
| **Specs with Tests** | 19 (+Epic 4 cross-spec) |
| **Average Tests per Spec** | 9.7 |
| **Critical Priority Tests** | ~97 |
| **High Priority Tests** | ~78 |
| **Medium Priority Tests** | ~19 |
| **Low Priority Tests** | 0 |

> **Note:** Priority counts above are approximate. Counts for shooting.md, rooms.md, server-architecture.md, match.md, and messages.md have been corrected to match source specs. Remaining 14 specs may also have inflated Critical counts — see Discoveries in IMPLEMENTATION_PLAN.md.

### By Category

| Category | Count | Percentage |
|----------|-------|------------|
| Unit | 85 | 47% |
| Integration | 85 | 47% |
| Visual | 9 | 5% |

### By Spec (Sorted by Count)

| Spec | Tests | Critical | High | Medium | Low |
|------|-------|----------|------|--------|-----|
| dodge-roll.md | 14 | 6 | 6 | 2 | 0 |
| graphics.md | 14 | 4 | 8 | 2 | 0 |
| hit-detection.md | 14 | 8 | 5 | 1 | 0 |
| melee.md | 14 | 6 | 6 | 2 | 0 |
| player.md | 14 | 8 | 5 | 1 | 0 |
| match.md | 13 | 3 | 5 | 5 | 0 |
| arena.md | 12 | 5 | 5 | 2 | 0 |
| shooting.md | 12 | 5 | 5 | 2 | 0 |
| ui.md | 12 | 4 | 6 | 2 | 0 |
| audio.md | 10 | 2 | 6 | 2 | 0 |
| messages.md | 10 | 5 | 3 | 2 | 0 |
| movement.md | 10 | 6 | 3 | 1 | 0 |
| networking.md | 10 | 6 | 3 | 1 | 0 |
| rooms.md | 10 | 2 | 6 | 2 | 0 |
| server-architecture.md | 10 | 6 | 4 | 0 | 0 |
| weapons.md | 10 | 5 | 4 | 1 | 0 |
| client-architecture.md | 8 | 4 | 3 | 1 | 0 |
| constants.md | 5 | 3 | 2 | 0 | 0 |
| overview.md | 5 | 4 | 1 | 0 | 0 |

---

## Complete Test Catalog by Spec

### Arena Tests (arena.md)

| ID | Category | Priority | Description |
|----|----------|----------|-------------|
| TS-ARENA-001 | Unit | High | Player cannot move beyond left boundary |
| TS-ARENA-002 | Unit | High | Player cannot move beyond right boundary |
| TS-ARENA-003 | Unit | High | Player cannot move beyond top boundary |
| TS-ARENA-004 | Unit | High | Player cannot move beyond bottom boundary |
| TS-ARENA-005 | Unit | Critical | Projectile destroyed at boundary |
| TS-ARENA-006 | Unit | High | Dodge roll terminates at boundary |
| TS-ARENA-007 | Unit | Critical | Weapon crates spawn at correct positions |
| TS-ARENA-008 | Integration | Critical | Player spawn uses balanced algorithm |
| TS-ARENA-009 | Integration | Critical | Spawn point avoids enemies |
| TS-ARENA-010 | Unit | Medium | Distance calculation is Euclidean |
| TS-ARENA-011 | Unit | Medium | AABB collision uses correct formula |
| TS-ARENA-012 | Integration | Critical | Weapon pickup proximity is 32px |

### Audio Tests (audio.md)

| ID | Category | Priority | Description |
|----|----------|----------|-------------|
| TS-AUDIO-001 | Unit | High | Weapon fire plays correct sound |
| TS-AUDIO-002 | Unit | High | Volume decreases with distance |
| TS-AUDIO-003 | Unit | High | Sound silent beyond 1000px |
| TS-AUDIO-004 | Unit | Critical | Mute toggle silences all sounds |
| TS-AUDIO-005 | Unit | High | Local player sounds at full volume |
| TS-AUDIO-006 | Unit | High | Reload sound matches weapon |
| TS-AUDIO-007 | Integration | Critical | Audio plays on projectile:spawn event |
| TS-AUDIO-008 | Integration | Medium | Pan calculated from horizontal offset |
| TS-AUDIO-009 | Unit | Medium | Unknown weapon falls back to Uzi sound |
| TS-AUDIO-010 | Integration | High | Active sounds cleanup on scene destroy |

### Client Architecture Tests (client-architecture.md)

| ID | Category | Priority | Description |
|----|----------|----------|-------------|
| TS-CLIENT-001 | Unit | Critical | GameScene creates all managers |
| TS-CLIENT-002 | Unit | High | Input polled every frame |
| TS-CLIENT-003 | Unit | Critical | Input sent at 20 Hz (50ms interval) |
| TS-CLIENT-004 | Integration | Critical | Server messages processed correctly |
| TS-CLIENT-005 | Unit | High | Entities render with correct depth |
| TS-CLIENT-006 | Integration | High | Scene cleanup releases resources |
| TS-CLIENT-007 | Integration | Critical | WebSocket connected on create |
| TS-CLIENT-008 | Integration | Medium | WebSocket disconnected on destroy |

### Constants Tests (constants.md)

| ID | Category | Priority | Description |
|----|----------|----------|-------------|
| TS-CONST-001 | Unit | Critical | Movement speed matches 200 px/s |
| TS-CONST-002 | Unit | Critical | Arena dimensions match 1920x1080 |
| TS-CONST-003 | Unit | Critical | Pistol damage is 25 HP |
| TS-CONST-004 | Unit | High | Dodge roll cooldown is 3000 ms |
| TS-CONST-005 | Unit | High | Weapon respawn time is 30000 ms |

### Dodge Roll Tests (dodge-roll.md)

| ID | Category | Priority | Description |
|----|----------|----------|-------------|
| TS-ROLL-001 | Unit | Critical | Roll moves player 100px over 400ms |
| TS-ROLL-002 | Unit | Critical | Player is invincible for first 200ms |
| TS-ROLL-003 | Unit | Critical | Player is vulnerable after 200ms |
| TS-ROLL-004 | Unit | Critical | Cooldown prevents roll for 3 seconds |
| TS-ROLL-005 | Integration | High | Wall collision ends roll early |
| TS-ROLL-006 | Unit | High | Roll direction matches last input |
| TS-ROLL-007 | Integration | High | roll:start message sent to all clients |
| TS-ROLL-008 | Integration | High | roll:end message includes reason |
| TS-ROLL-009 | Unit | Critical | Cannot roll while already rolling |
| TS-ROLL-010 | Unit | Critical | Cannot roll during cooldown |
| TS-ROLL-011 | Unit | High | Roll velocity is 250 px/s |
| TS-ROLL-012 | Integration | Medium | Aim angle used if no WASD input |
| TS-ROLL-013 | Integration | High | Cooldown starts after roll ends |
| TS-ROLL-014 | Unit | Medium | Visual flicker during i-frames |

### Graphics Tests (graphics.md)

| ID | Category | Priority | Description |
|----|----------|----------|-------------|
| TS-GFX-001 | Visual | Critical | Player renders with all body parts |
| TS-GFX-002 | Visual | High | Walk animation oscillates legs |
| TS-GFX-003 | Unit | Critical | Player color matches assigned index |
| TS-GFX-004 | Unit | Critical | Health bar width reflects health percentage |
| TS-GFX-005 | Unit | High | Aim indicator points at mouse |
| TS-GFX-006 | Visual | High | Projectile has tracer trail |
| TS-GFX-007 | Visual | High | Muzzle flash appears on shoot |
| TS-GFX-008 | Unit | High | Weapon crate renders with icon |
| TS-GFX-009 | Unit | High | Unavailable crate is grayed out |
| TS-GFX-010 | Visual | High | Hit particles spawn on damage |
| TS-GFX-011 | Unit | Critical | Player fades on death |
| TS-GFX-012 | Integration | High | Dodge roll shows rotation |
| TS-GFX-013 | Unit | Medium | Crosshair spread matches weapon |
| TS-GFX-014 | Unit | Medium | Melee swing shows arc |

### Hit Detection Tests (hit-detection.md)

| ID | Category | Priority | Description |
|----|----------|----------|-------------|
| TS-HIT-001 | Unit | Critical | Projectile collides with player hitbox |
| TS-HIT-002 | Unit | Critical | Projectile passes through owner |
| TS-HIT-003 | Unit | Critical | Damage reduces health correctly |
| TS-HIT-004 | Unit | Critical | Player dies at 0 health |
| TS-HIT-005 | Unit | Critical | Death increments attacker kills |
| TS-HIT-006 | Unit | Critical | Death awards 100 XP |
| TS-HIT-007 | Integration | Critical | player:damaged sent to all clients |
| TS-HIT-008 | Integration | High | hit:confirmed sent to attacker only |
| TS-HIT-009 | Unit | Critical | Invulnerable player not damaged |
| TS-HIT-010 | Unit | High | Projectile destroyed after 1000ms |
| TS-HIT-011 | Unit | High | Projectile destroyed at 800px range |
| TS-HIT-012 | Unit | High | Projectile destroyed at arena boundary |
| TS-HIT-013 | Unit | High | Dead player not damaged |
| TS-HIT-014 | Visual | Medium | Dodge roll invincibility blocks damage |

### Match Tests (match.md)

| ID | Category | Priority | Description |
|----|----------|----------|-------------|
| TS-MATCH-001 | Integration | Critical | Match starts when 2 players join |
| TS-MATCH-002 | Unit | High | Timer counts down from 420 seconds |
| TS-MATCH-003 | Integration | High | match:timer sent every second |
| TS-MATCH-004 | Integration | Critical | Match ends when player reaches 20 kills |
| TS-MATCH-005 | Integration | Critical | Match ends when timer reaches 0 |
| TS-MATCH-006 | Unit | High | Highest kills wins on time limit |
| TS-MATCH-007 | Unit | High | Tie results in multiple winners |
| TS-MATCH-008 | Integration | High | match:ended includes all player scores |
| TS-MATCH-009 | Unit | Medium | match:ended reason is kill_target or time_limit |
| TS-MATCH-010 | Unit | Medium | TEST_MODE uses 2 kills and 10 seconds |
| TS-MATCH-011 | Unit | Medium | Players with 0 kills included in final scores |
| TS-MATCH-012 | Unit | Medium | RegisteredPlayers set includes all players |
| TS-MATCH-013 | Unit | Medium | Match state machine prevents re-ending |

### Melee Tests (melee.md)

| ID | Category | Priority | Description |
|----|----------|----------|-------------|
| TS-MELEE-001 | Unit | High | Bat hits player within 64px range |
| TS-MELEE-002 | Unit | High | Katana hits player within 80px range |
| TS-MELEE-003 | Unit | Critical | Player outside range is not hit |
| TS-MELEE-004 | Unit | Critical | Player outside arc is not hit |
| TS-MELEE-005 | Unit | High | Bat applies 40px knockback |
| TS-MELEE-006 | Unit | High | Katana applies no knockback |
| TS-MELEE-007 | Integration | Critical | Multiple players hit in single swing |
| TS-MELEE-008 | Unit | Critical | Dead players not hit |
| TS-MELEE-009 | Unit | Critical | Invulnerable players not damaged |
| TS-MELEE-010 | Unit | Critical | Cooldown enforced between swings |
| TS-MELEE-011 | Unit | High | Knockback respects arena boundaries |
| TS-MELEE-012 | Integration | High | melee:hit message lists all victims |
| TS-MELEE-013 | Unit | Medium | 90 degree arc centered on aim angle |
| TS-MELEE-014 | Unit | Medium | 360 degree wraparound handled |

### Messages Tests (messages.md)

| ID | Category | Priority | Description |
|----|----------|----------|-------------|
| TS-MSG-001 | Integration | Critical | input:state updates player movement |
| TS-MSG-002 | Integration | Critical | player:shoot creates projectile |
| TS-MSG-003 | Unit | High | shoot:failed sent when shooting blocked |
| TS-MSG-004 | Integration | Critical | player:damaged sent on hit |
| TS-MSG-005 | Integration | Critical | player:death sent on kill |
| TS-MSG-006 | Integration | Critical | player:respawn sent after delay |
| TS-MSG-007 | Integration | Medium | weapon:pickup_confirmed sent on pickup |
| TS-MSG-008 | Integration | Medium | match:ended sent on win condition |
| TS-MSG-009 | Unit | High | Message timestamp is Unix milliseconds |
| TS-MSG-010 | Unit | High | Unknown message type ignored |

### Movement Tests (movement.md)

| ID | Category | Priority | Description |
|----|----------|----------|-------------|
| TS-MOVE-001 | Unit | Critical | Player accelerates to target velocity |
| TS-MOVE-002 | Unit | Critical | Player decelerates when no input |
| TS-MOVE-003 | Unit | Critical | Sprint increases speed to 300 px/s |
| TS-MOVE-004 | Unit | Critical | Diagonal movement is normalized |
| TS-MOVE-005 | Unit | Critical | Position updates by velocity × deltaTime |
| TS-MOVE-006 | Unit | Critical | Position clamped to arena bounds |
| TS-MOVE-007 | Unit | High | Sprint applies accuracy penalty |
| TS-MOVE-008 | Unit | High | Acceleration is 50 px/s² |
| TS-MOVE-009 | Unit | High | Deceleration is 1500 px/s² (near-instant stop) |
| TS-MOVE-010 | Integration | Medium | Aim angle threshold prevents spam |

### Networking Tests (networking.md)

| ID | Category | Priority | Description |
|----|----------|----------|-------------|
| TS-NET-001 | Integration | Critical | WebSocket connection established |
| TS-NET-002 | Unit | Critical | Message serialized as JSON |
| TS-NET-003 | Unit | High | Malformed JSON ignored |
| TS-NET-004 | Unit | High | Unknown message type ignored |
| TS-NET-005 | Integration | Critical | Client reconnects on disconnect |
| TS-NET-006 | Unit | Critical | Max 3 reconnect attempts |
| TS-NET-007 | Integration | Critical | Server graceful shutdown |
| TS-NET-008 | Integration | Critical | Player removed on disconnect |
| TS-NET-009 | Unit | High | Input rate limited to 20 Hz |
| TS-NET-010 | Integration | Medium | Bidirectional communication works |

### Netcode Tests (Epic 4: movement.md, networking.md, hit-detection.md)

| ID | Category | Priority | Description |
|----|----------|----------|-------------|
| TS-PRED-001 | Unit | Critical | PredictionEngine mirrors server physics output |
| TS-PRED-002 | Unit | Critical | Reconcile replays only unprocessed inputs |
| TS-PRED-003 | Unit | High | Instant correction when error exceeds 100px |
| TS-PRED-004 | Unit | High | Smooth lerp for corrections under 100px |
| TS-INTERP-001 | Unit | Critical | InterpolationEngine smooths 20 Hz updates to 60 FPS |
| TS-INTERP-002 | Unit | High | Extrapolates up to 100ms on packet loss |
| TS-INTERP-003 | Unit | High | Freezes position after 200ms without data |
| TS-DELTA-001 | Unit | Critical | Delta compression sends only changed players |
| TS-DELTA-002 | Unit | High | Full snapshot sent every 1 second |
| TS-DELTA-003 | Unit | High | Position change below 0.1px threshold not sent |
| TS-LAGCOMP-001 | Integration | Critical | Hitscan uses rewound positions for hit detection |
| TS-LAGCOMP-002 | Unit | High | RTT capped at 150ms for rewind |
| TS-LAGCOMP-003 | Unit | High | Position history interpolates between snapshots |
| TS-NETSIM-001 | Unit | High | NetworkSimulator delays messages by configured latency |
| TS-NETSIM-002 | Unit | High | NetworkSimulator drops packets at configured rate |

### Overview Tests (overview.md)

| ID | Category | Priority | Description |
|----|----------|----------|-------------|
| TS-OV-001 | Unit | Critical | Server tick rate is 60 Hz |
| TS-OV-002 | Unit | Critical | Client update rate is 20 Hz |
| TS-OV-003 | Integration | Critical | TypeBox schemas match server schemas |
| TS-OV-004 | Integration | Critical | Server validates all inputs |
| TS-OV-005 | Unit | High | Client captures keyboard and mouse |

### Player Tests (player.md)

| ID | Category | Priority | Description |
|----|----------|----------|-------------|
| TS-PLAYER-001 | Unit | Critical | Player takes damage correctly |
| TS-PLAYER-002 | Unit | Critical | Player dies at 0 health |
| TS-PLAYER-003 | Unit | Critical | Player respawns after 3 seconds |
| TS-PLAYER-004 | Unit | Critical | Player is invulnerable for 2 seconds after respawn |
| TS-PLAYER-005 | Unit | High | Health regeneration starts after 5 seconds |
| TS-PLAYER-006 | Unit | High | Health regenerates at 10 HP/s |
| TS-PLAYER-007 | Unit | Critical | Damage interrupts health regeneration |
| TS-PLAYER-008 | Unit | Critical | Kill increments attacker's kill count |
| TS-PLAYER-009 | Unit | Critical | Death increments victim's death count |
| TS-PLAYER-010 | Unit | Critical | XP awarded on kill (100 XP) |
| TS-PLAYER-011 | Unit | High | Invulnerable player takes no damage |
| TS-PLAYER-012 | Unit | High | Max health is 100 HP |
| TS-PLAYER-013 | Integration | High | PlayerState synchronized to clients |
| TS-PLAYER-014 | Unit | Medium | Health regeneration uses accumulator |

### Rooms Tests (rooms.md)

| ID | Category | Priority | Description |
|----|----------|----------|-------------|
| TS-ROOM-001 | Unit | Critical | Room created when 2 players waiting |
| TS-ROOM-002 | Unit | High | Room accepts up to 8 players |
| TS-ROOM-003 | Unit | High | Room rejects 9th player |
| TS-ROOM-004 | Integration | Critical | room:joined sent to both players |
| TS-ROOM-005 | Integration | High | player:left sent when player disconnects |
| TS-ROOM-006 | Unit | High | Empty room is destroyed |
| TS-ROOM-007 | Unit | Medium | Player mapped to correct room |
| TS-ROOM-008 | Unit | High | Broadcast reaches all room members |
| TS-ROOM-009 | Integration | High | Disconnected player removed from room |
| TS-ROOM-010 | Unit | Medium | New players matched to waiting queue |

### Server Architecture Tests (server-architecture.md)

| ID | Category | Priority | Description |
|----|----------|----------|-------------|
| TS-SERVER-001 | Unit | Critical | Game loop runs at 60Hz |
| TS-SERVER-002 | Unit | Critical | Broadcast runs at 20Hz |
| TS-SERVER-003 | Unit | High | Physics updates each tick |
| TS-SERVER-004 | Integration | Critical | Collisions detected each tick |
| TS-SERVER-005 | Unit | High | Messages routed to correct handler |
| TS-SERVER-006 | Integration | Critical | Concurrent access is thread-safe |
| TS-SERVER-007 | Integration | High | Graceful shutdown completes |
| TS-SERVER-008 | Integration | Critical | Client messages processed |
| TS-SERVER-009 | Unit | High | Callback events fire correctly |
| TS-SERVER-010 | Integration | Critical | Room isolation maintained |

### Shooting Tests (shooting.md)

| ID | Category | Priority | Description |
|----|----------|----------|-------------|
| TS-SHOOT-001 | Unit | Critical | Successful shot creates projectile |
| TS-SHOOT-002 | Unit | Critical | Shot decrements ammo |
| TS-SHOOT-003 | Unit | Critical | Empty magazine returns shoot:failed |
| TS-SHOOT-004 | Unit | Critical | Cooldown enforced between shots |
| TS-SHOOT-005 | Unit | High | Reloading blocks shooting |
| TS-SHOOT-006 | Unit | High | Projectile velocity from aim angle |
| TS-SHOOT-007 | Unit | High | Projectile expires after lifetime |
| TS-SHOOT-008 | Unit | High | Reload completes and restores ammo |
| TS-SHOOT-009 | Unit | High | Shotgun creates 8 pellets |
| TS-SHOOT-010 | Unit | Medium | Sprint applies accuracy penalty |
| TS-SHOOT-011 | Unit | Medium | Vertical recoil accumulates |
| TS-SHOOT-012 | Unit | Critical | Dead player cannot shoot |

### UI Tests (ui.md)

| ID | Category | Priority | Description |
|----|----------|----------|-------------|
| TS-UI-001 | Unit | Critical | Health bar reflects current health |
| TS-UI-002 | Unit | Critical | Kill feed shows recent kills |
| TS-UI-003 | Unit | High | Kill feed fades after 5 seconds |
| TS-UI-004 | Unit | Critical | Ammo counter updates on shoot |
| TS-UI-005 | Unit | High | Reload indicator shows during reload |
| TS-UI-006 | Unit | Critical | Timer counts down correctly |
| TS-UI-007 | Unit | High | Timer turns red under 30 seconds |
| TS-UI-008 | Unit | High | Score updates on kill |
| TS-UI-009 | Visual | High | Pickup prompt appears near crates |
| TS-UI-010 | Visual | High | Dodge cooldown shows progress |
| TS-UI-011 | Visual | High | Match end screen shows winner |
| TS-UI-012 | Unit | Medium | Scoreboard sorted correctly |

### Weapons Tests (weapons.md)

| ID | Category | Priority | Description |
|----|----------|----------|-------------|
| TS-WEAP-001 | Unit | Critical | Pistol fires at 3 shots/second |
| TS-WEAP-002 | Unit | High | Uzi applies vertical recoil |
| TS-WEAP-003 | Unit | High | AK47 applies mixed recoil |
| TS-WEAP-004 | Unit | Critical | Shotgun fires 8 pellets in arc |
| TS-WEAP-005 | Unit | Critical | Bat applies 40px knockback |
| TS-WEAP-006 | Unit | Critical | Katana has 80px range |
| TS-WEAP-007 | Integration | Critical | Weapon pickup replaces current weapon |
| TS-WEAP-008 | Unit | High | Ammo resets on weapon pickup |
| TS-WEAP-009 | Unit | High | Weapon crates spawn at correct locations |
| TS-WEAP-010 | Unit | Medium | Each weapon has correct damage value |

---

## Critical Path Implementation Order

When implementing from scratch, execute tests in this order to verify core functionality before polish:

### Phase 1: Foundation (22 tests)

**Priority**: These tests validate basic building blocks.

1. **Constants** (TS-CONST-001 to TS-CONST-005)
   - Verify all game constants before using them

2. **Arena** (TS-ARENA-001 to TS-ARENA-012)
   - Boundaries must work before movement

3. **Overview** (TS-OV-001 to TS-OV-005)
   - Tick rates and schema validation

### Phase 2: Core Entities (24 tests)

**Priority**: Player and movement are prerequisites for everything.

1. **Player** (TS-PLAYER-001 to TS-PLAYER-014)
   - Health, death, respawn, statistics

2. **Movement** (TS-MOVE-001 to TS-MOVE-010)
   - Physics must work before combat

### Phase 3: Networking (30 tests)

**Priority**: Multiplayer requires networking.

1. **Messages** (TS-MSG-001 to TS-MSG-010)
   - Message format validation

2. **Networking** (TS-NET-001 to TS-NET-010)
   - WebSocket lifecycle

3. **Rooms** (TS-ROOM-001 to TS-ROOM-010)
   - Matchmaking and room management

### Phase 4: Combat (50 tests)

**Priority**: Core gameplay loop.

1. **Weapons** (TS-WEAP-001 to TS-WEAP-010)
   - Weapon stats and behavior

2. **Shooting** (TS-SHOOT-001 to TS-SHOOT-012)
   - Ranged combat

3. **Hit Detection** (TS-HIT-001 to TS-HIT-014)
   - Collision and damage

4. **Melee** (TS-MELEE-001 to TS-MELEE-014)
   - Melee combat

### Phase 5: Advanced Mechanics (27 tests)

**Priority**: Advanced gameplay features.

1. **Dodge Roll** (TS-ROLL-001 to TS-ROLL-014)
   - Evasion mechanic

2. **Match** (TS-MATCH-001 to TS-MATCH-013)
   - Win conditions

### Phase 6: Client/Server Architecture (18 tests)

**Priority**: System architecture validation.

1. **Server Architecture** (TS-SERVER-001 to TS-SERVER-010)
   - Backend systems

2. **Client Architecture** (TS-CLIENT-001 to TS-CLIENT-008)
   - Frontend systems

### Phase 7: Polish (36 tests)

**Priority**: Visual and audio feedback.

1. **Graphics** (TS-GFX-001 to TS-GFX-014)
   - Rendering

2. **UI** (TS-UI-001 to TS-UI-012)
   - HUD elements

3. **Audio** (TS-AUDIO-001 to TS-AUDIO-010)
   - Sound effects

---

## Tests by Category

### Unit Tests (85 tests)

Tests that verify individual component behavior without external dependencies.

**Characteristics:**
- No network calls
- No database access
- Isolated functions/methods
- Fast execution (<10ms each)

**Key unit test areas:**
- Constant values (TS-CONST-*)
- Physics calculations (TS-MOVE-001 to 006, TS-HIT-003)
- Damage formulas (TS-PLAYER-001, TS-WEAP-010)
- State machines (TS-ROLL-001 to 004, TS-MATCH-002)

### Integration Tests (85 tests)

Tests that verify multiple systems working together.

**Characteristics:**
- May involve WebSocket communication
- May span client and server
- Test message flows end-to-end
- Moderate execution time (<1s each)

**Key integration test areas:**
- Message processing (TS-MSG-*)
- Room creation flow (TS-ROOM-001, 004)
- Combat flow (TS-SHOOT-001, TS-HIT-007)
- Match lifecycle (TS-MATCH-001, 003, 004)

### Visual Tests (9 tests)

Tests that verify rendering output using Playwright screenshots.

**Characteristics:**
- Require browser environment
- Compare screenshot baselines
- Validate visual appearance
- Slowest execution (~5s each)

**Visual test IDs:**
- TS-GFX-001: Player stick figure rendering
- TS-GFX-002: Walk animation legs
- TS-GFX-006: Projectile tracer trail
- TS-GFX-007: Muzzle flash effect
- TS-GFX-010: Hit particle effects
- TS-UI-009: Pickup prompt display
- TS-UI-010: Cooldown progress circle
- TS-UI-011: Match end screen
- TS-HIT-014: I-frame visual feedback

---

## Tests by Priority

### Critical (~97 tests)

**Must pass for the game to be playable.**

These tests verify:
- Core game loop functions
- Player can move, shoot, and die
- Multiplayer networking works
- Win conditions trigger correctly

**If any critical test fails:** Game is broken and unplayable.

### High (~78 tests)

**Must pass for the game to be fun.**

These tests verify:
- All weapons behave correctly
- Dodge roll provides evasion
- UI provides clear feedback
- Audio responds to events

**If any high test fails:** Game is playable but feature is broken.

### Medium (20 tests)

**Should pass for polish.**

These tests verify:
- Edge cases handled gracefully
- Animations smooth
- Timing precise

**If any medium test fails:** Minor issues, acceptable for MVP.

### Low (9 tests)

**Nice to have.**

These tests verify:
- Obscure edge cases
- Performance optimizations
- Graceful degradation

**If any low test fails:** Acceptable technical debt.

---

## Implementation Checklist

Use this checklist to track test implementation progress:

### Foundation
- [ ] TS-CONST-001 through TS-CONST-005 (5 tests)
- [ ] TS-ARENA-001 through TS-ARENA-012 (12 tests)
- [ ] TS-OV-001 through TS-OV-005 (5 tests)

### Core Entities
- [ ] TS-PLAYER-001 through TS-PLAYER-014 (14 tests)
- [ ] TS-MOVE-001 through TS-MOVE-010 (10 tests)

### Networking
- [ ] TS-MSG-001 through TS-MSG-010 (10 tests)
- [ ] TS-NET-001 through TS-NET-010 (10 tests)
- [ ] TS-ROOM-001 through TS-ROOM-010 (10 tests)

### Combat
- [ ] TS-WEAP-001 through TS-WEAP-010 (10 tests)
- [ ] TS-SHOOT-001 through TS-SHOOT-012 (12 tests)
- [ ] TS-HIT-001 through TS-HIT-014 (14 tests)
- [ ] TS-MELEE-001 through TS-MELEE-014 (14 tests)

### Advanced Mechanics
- [ ] TS-ROLL-001 through TS-ROLL-014 (14 tests)
- [ ] TS-MATCH-001 through TS-MATCH-013 (13 tests)

### Architecture
- [ ] TS-SERVER-001 through TS-SERVER-010 (10 tests)
- [ ] TS-CLIENT-001 through TS-CLIENT-008 (8 tests)

### Polish
- [ ] TS-GFX-001 through TS-GFX-014 (14 tests)
- [ ] TS-UI-001 through TS-UI-012 (12 tests)
- [ ] TS-AUDIO-001 through TS-AUDIO-010 (10 tests)

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-02-02 | Initial specification |
| 1.1.0 | 2026-02-15 | Added 15 Epic 4 Netcode test scenarios (prediction, reconciliation, interpolation, delta compression, lag compensation, network simulator). Updated total from 179 to 194 tests. Fixed deceleration reference from 50 to 1500 px/s². |
| 1.1.1 | 2026-02-16 | Fixed test priorities/categories for shooting.md, rooms.md, server-architecture.md, match.md, and messages.md to match source spec definitions. Corrected systematically inflated Critical counts. Removed phantom Low priority count (0 Low tests exist). |
