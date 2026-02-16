# Test Index

> **Spec Version**: 1.2.0
> **Last Updated**: 2026-02-16
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
| **Total Test Scenarios** | 244 |
| **Specs with Tests** | 19 (+Epic 4 cross-spec) |
| **Average Tests per Spec** | 12.2 |
| **Critical Priority Tests** | 71 |
| **High Priority Tests** | 111 |
| **Medium Priority Tests** | 62 |
| **Low Priority Tests** | 0 |

### By Category

| Category | Count | Percentage |
|----------|-------|------------|
| Unit | 155 | 64% |
| Integration | 57 | 23% |
| Visual | 32 | 13% |

### By Spec (Sorted by Count)

| Spec | Tests | Critical | High | Medium | Low |
|------|-------|----------|------|--------|-----|
| graphics.md | 24 | 1 | 13 | 10 | 0 |
| ui.md | 19 | 3 | 10 | 6 | 0 |
| melee.md | 15 | 3 | 7 | 5 | 0 |
| dodge-roll.md | 14 | 5 | 7 | 2 | 0 |
| hit-detection.md | 14 | 6 | 7 | 1 | 0 |
| player.md | 14 | 3 | 8 | 3 | 0 |
| match.md | 13 | 3 | 5 | 5 | 0 |
| arena.md | 13 | 4 | 2 | 7 | 0 |
| shooting.md | 13 | 5 | 6 | 2 | 0 |
| audio.md | 10 | 3 | 3 | 4 | 0 |
| client-architecture.md | 10 | 3 | 5 | 2 | 0 |
| messages.md | 10 | 3 | 4 | 3 | 0 |
| movement.md | 10 | 4 | 3 | 3 | 0 |
| networking.md | 10 | 5 | 3 | 2 | 0 |
| rooms.md | 10 | 2 | 6 | 2 | 0 |
| server-architecture.md | 10 | 6 | 4 | 0 | 0 |
| weapons.md | 10 | 3 | 5 | 2 | 0 |
| constants.md | 5 | 2 | 2 | 1 | 0 |
| overview.md | 5 | 2 | 3 | 0 | 0 |

---

## Complete Test Catalog by Spec

### Arena Tests (arena.md)

| ID | Category | Priority | Description |
|----|----------|----------|-------------|
| TS-ARENA-001 | Unit | Critical | Player cannot move beyond left boundary |
| TS-ARENA-002 | Unit | Critical | Player cannot move beyond right boundary |
| TS-ARENA-003 | Unit | Critical | Player cannot move beyond top boundary |
| TS-ARENA-004 | Unit | Critical | Player cannot move beyond bottom boundary |
| TS-ARENA-005 | Unit | High | Projectile destroyed at boundary |
| TS-ARENA-006 | Integration | High | Dodge roll terminates at boundary |
| TS-ARENA-007 | Unit | Medium | Weapon crates spawn at correct positions |
| TS-ARENA-008 | Integration | Medium | Balanced spawn avoids enemies |
| TS-ARENA-009 | Unit | Medium | Spawn fallback to center when no enemies |
| TS-ARENA-010 | Unit | Medium | Distance calculation is accurate |
| TS-ARENA-011 | Unit | Medium | Weapon pickup radius check works |
| TS-ARENA-012 | Unit | Medium | Player cannot pick up weapon from far away |
| TS-ARENA-013 | Visual | Medium | Floor grid renders at correct depth and spacing |

### Audio Tests (audio.md)

| ID | Category | Priority | Description |
|----|----------|----------|-------------|
| TS-AUDIO-001 | Unit | Critical | Weapon fire plays correct sound |
| TS-AUDIO-002 | Unit | High | Volume decreases with distance |
| TS-AUDIO-003 | Unit | High | Sound silent beyond 1000px |
| TS-AUDIO-004 | Unit | High | Mute toggle silences all sounds |
| TS-AUDIO-005 | Unit | Critical | Local player sounds at full volume |
| TS-AUDIO-006 | Unit | Medium | Reload sound matches weapon |
| TS-AUDIO-007 | Unit | Medium | Audio plays on projectile:spawn event |
| TS-AUDIO-008 | Unit | Medium | Pan calculated from horizontal offset |
| TS-AUDIO-009 | Unit | Medium | Unknown weapon falls back to Uzi sound |
| TS-AUDIO-010 | Unit | Critical | Active sounds cleanup on scene destroy |

### Client Architecture Tests (client-architecture.md)

| ID | Category | Priority | Description |
|----|----------|----------|-------------|
| TS-CLIENT-001 | Unit | Critical | GameScene creates all managers |
| TS-CLIENT-002 | Unit | High | Input polled every frame |
| TS-CLIENT-003 | Unit | High | Input rate limited to 20 Hz |
| TS-CLIENT-004 | Integration | Critical | Server messages processed correctly |
| TS-CLIENT-005 | Visual | High | Entities render correctly |
| TS-CLIENT-006 | Unit | High | Scene cleanup releases resources |
| TS-CLIENT-007 | Integration | Critical | WebSocket connected on create |
| TS-CLIENT-008 | Unit | High | WebSocket disconnected on destroy |
| TS-CLIENT-009 | Unit | Medium | Object pool prevents GC |
| TS-CLIENT-010 | Unit | Medium | Camera follows local player |

### Constants Tests (constants.md)

| ID | Category | Priority | Description |
|----|----------|----------|-------------|
| TS-CONST-001 | Unit | Critical | Movement speed matches client and server |
| TS-CONST-002 | Unit | Critical | Arena dimensions match client and server |
| TS-CONST-003 | Integration | High | Pistol kills in 4 shots |
| TS-CONST-004 | Unit | High | Dodge roll cooldown prevents chaining |
| TS-CONST-005 | Integration | Medium | Weapon respawns after 30 seconds |

### Dodge Roll Tests (dodge-roll.md)

| ID | Category | Priority | Description |
|----|----------|----------|-------------|
| TS-ROLL-001 | Unit | Critical | Roll moves player correct distance |
| TS-ROLL-002 | Unit | Critical | Player invincible during first 200ms |
| TS-ROLL-003 | Unit | Critical | Player vulnerable after 200ms |
| TS-ROLL-004 | Unit | Critical | Cooldown prevents roll for 3 seconds |
| TS-ROLL-005 | Unit | High | Wall collision ends roll early |
| TS-ROLL-006 | Unit | High | Roll direction matches WASD input |
| TS-ROLL-007 | Unit | High | Stationary roll uses aim direction |
| TS-ROLL-008 | Integration | High | roll:start message broadcast to all |
| TS-ROLL-009 | Integration | Medium | roll:end includes reason code |
| TS-ROLL-010 | Unit | High | Cannot roll while already rolling |
| TS-ROLL-011 | Unit | High | Cannot roll while dead |
| TS-ROLL-012 | Integration | Critical | Projectile passes through during i-frames |
| TS-ROLL-013 | Integration | High | Projectile hits after i-frames |
| TS-ROLL-014 | Unit | Medium | Cooldown UI shows progress |

### Graphics Tests (graphics.md)

| ID | Category | Priority | Description |
|----|----------|----------|-------------|
| TS-GFX-001 | Visual | Critical | Player renders all body parts |
| TS-GFX-002 | Visual | High | Walk animation oscillates legs |
| TS-GFX-003 | Unit | High | Player color matches state |
| TS-GFX-004 | Unit | High | Health bar width reflects percentage |
| TS-GFX-005 | Visual | Medium | Aim indicator points at mouse |
| TS-GFX-006 | Visual | High | Projectile has tracer trail |
| TS-GFX-007 | Visual | Medium | Muzzle flash appears on shoot |
| TS-GFX-008 | Visual | Medium | Weapon crate renders with glow |
| TS-GFX-009 | Visual | Medium | Unavailable crate is faded |
| TS-GFX-010 | Visual | High | Hit particles spawn on damage |
| TS-GFX-011 | Visual | Medium | Death corpse renders with splayed limbs |
| TS-GFX-012 | Visual | High | Dodge roll shows rotation |
| TS-GFX-013 | Visual | High | Melee arc renders as white stroke-only |
| TS-GFX-014 | Unit | High | Object pool reuses effects |
| TS-GFX-015 | Visual | High | Blood particles spawn on damage |
| TS-GFX-016 | Visual | Medium | Healing particles appear during regen |
| TS-GFX-017 | Visual | Medium | Wall spark on obstructed barrel |
| TS-GFX-018 | Visual | High | Gun recoil on ranged fire |
| TS-GFX-019 | Visual | High | Aim sway visual oscillation |
| TS-GFX-020 | Visual | Medium | Reload animation pulses |
| TS-GFX-021 | Visual | High | Directional hit indicator (outgoing) |
| TS-GFX-022 | Visual | High | Directional hit indicator (incoming) |
| TS-GFX-023 | Visual | Medium | Crosshair reticle texture |
| TS-GFX-024 | Visual | Medium | Death corpse fade timing |

### Hit Detection Tests (hit-detection.md)

| ID | Category | Priority | Description |
|----|----------|----------|-------------|
| TS-HIT-001 | Unit | Critical | Direct hit on player |
| TS-HIT-002 | Unit | High | Hit at hitbox edge |
| TS-HIT-003 | Unit | High | Miss outside hitbox |
| TS-HIT-004 | Unit | Critical | Cannot hit dead player |
| TS-HIT-005 | Unit | Critical | Cannot hit invulnerable player |
| TS-HIT-006 | Unit | Critical | Cannot hit self |
| TS-HIT-007 | Unit | High | Projectile expires after 1 second |
| TS-HIT-008 | Unit | High | Projectile outside max range ignored |
| TS-HIT-009 | Unit | Critical | Damage reduces health correctly |
| TS-HIT-010 | Integration | Critical | Death triggered at zero health |
| TS-HIT-011 | Integration | High | Kill awards XP and increments stats |
| TS-HIT-012 | Unit | High | Dodge roll i-frames block damage |
| TS-HIT-013 | Unit | High | No i-frames after 200ms of roll |
| TS-HIT-014 | Unit | Medium | Projectile destroyed at arena boundary |

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
| TS-MELEE-001 | Unit | Critical | Bat hits single target |
| TS-MELEE-002 | Unit | Critical | Katana hits single target |
| TS-MELEE-003 | Unit | High | Target out of range |
| TS-MELEE-004 | Unit | High | Target outside arc |
| TS-MELEE-005 | Unit | Critical | Multiple targets in arc |
| TS-MELEE-006 | Unit | High | Bat applies 40px knockback |
| TS-MELEE-007 | Unit | High | Knockback respects arena bounds |
| TS-MELEE-008 | Unit | High | Skip dead players |
| TS-MELEE-009 | Unit | Medium | Cannot hit self |
| TS-MELEE-010 | Unit | Medium | Target at arc edge (45°) |
| TS-MELEE-011 | Unit | Medium | Target just outside arc (50°) |
| TS-MELEE-012 | Integration | High | melee:hit broadcast includes all victims |
| TS-MELEE-013 | Visual | Medium | Swing animation renders 90° arc |
| TS-MELEE-014 | Unit | Medium | Non-melee weapon returns empty result |
| TS-MELEE-015 | Visual | High | Weapon container rotation tween on swing |

### Messages Tests (messages.md)

| ID | Category | Priority | Description |
|----|----------|----------|-------------|
| TS-MSG-001 | Integration | Critical | input:state updates player position |
| TS-MSG-002 | Integration | Critical | player:shoot creates projectile |
| TS-MSG-003 | Unit | High | shoot:failed sent on empty magazine |
| TS-MSG-004 | Integration | Critical | player:damaged sent on hit |
| TS-MSG-005 | Integration | High | player:death triggers respawn after 3 seconds |
| TS-MSG-006 | Integration | High | match:ended stops game processing |
| TS-MSG-007 | Integration | Medium | weapon:pickup_confirmed marks crate unavailable |
| TS-MSG-008 | Integration | Medium | roll:start and roll:end sequence |
| TS-MSG-009 | Integration | Medium | melee:hit includes all victims |
| TS-MSG-010 | Unit | High | room:joined provides valid UUID |

### Movement Tests (movement.md)

| ID | Category | Priority | Description |
|----|----------|----------|-------------|
| TS-MOVE-001 | Unit | Critical | Player accelerates to target velocity |
| TS-MOVE-002 | Unit | Critical | Player decelerates when no input |
| TS-MOVE-003 | Unit | High | Sprint increases speed to 300 px/s |
| TS-MOVE-004 | Unit | High | Diagonal movement is normalized |
| TS-MOVE-005 | Unit | Critical | Position updates by velocity × deltaTime |
| TS-MOVE-006 | Unit | Critical | Position clamped to arena bounds |
| TS-MOVE-007 | Integration | Medium | Sprint applies accuracy penalty |
| TS-MOVE-008 | Unit | High | Acceleration rate is 50 px/s² |
| TS-MOVE-009 | Unit | Medium | Direction changes smoothly |
| TS-MOVE-010 | Unit | Medium | Zero input produces zero velocity |

### Networking Tests (networking.md)

| ID | Category | Priority | Description |
|----|----------|----------|-------------|
| TS-NET-001 | Integration | Critical | WebSocket connection established |
| TS-NET-002 | Unit | Critical | Message serialized as JSON |
| TS-NET-003 | Unit | High | Malformed JSON ignored |
| TS-NET-004 | Integration | Medium | Unknown message type broadcast |
| TS-NET-005 | Integration | High | Client reconnects on disconnect |
| TS-NET-006 | Unit | High | Max 3 reconnect attempts |
| TS-NET-007 | Integration | Critical | Server graceful shutdown |
| TS-NET-008 | Integration | Critical | Player removed on disconnect |
| TS-NET-009 | Unit | Medium | Input rate not enforced (server trust) |
| TS-NET-010 | Integration | Critical | Bidirectional communication works |

### Netcode Tests (Epic 4: movement.md, networking.md, hit-detection.md)

> **Note:** These 15 test IDs are defined only in this index. They do not appear in any source spec's Test Scenarios section. They were added during Epic 4 spec updates as cross-spec coverage targets but have no corresponding source spec entries.

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
| TS-OV-001 | Integration | Critical | Server tick rate is 60 Hz |
| TS-OV-002 | Integration | Critical | Client broadcast rate is 20 Hz |
| TS-OV-003 | Unit | High | Client-server schema sync |
| TS-OV-004 | Unit | High | Message validation |
| TS-OV-005 | Unit | High | Client input capture |

### Player Tests (player.md)

| ID | Category | Priority | Description |
|----|----------|----------|-------------|
| TS-PLAYER-001 | Unit | Critical | Player takes damage correctly |
| TS-PLAYER-002 | Unit | Critical | Player dies at 0 health |
| TS-PLAYER-003 | Integration | Critical | Player respawns after 3 seconds |
| TS-PLAYER-004 | Integration | High | Player is invulnerable for 2 seconds after respawn |
| TS-PLAYER-005 | Integration | High | Health regeneration starts after 5 seconds |
| TS-PLAYER-006 | Unit | High | Health regenerates at 10 HP/s |
| TS-PLAYER-007 | Unit | High | Damage interrupts health regeneration |
| TS-PLAYER-008 | Unit | High | Kill increments attacker's kill count |
| TS-PLAYER-009 | Unit | High | Death increments victim's death count |
| TS-PLAYER-010 | Unit | Medium | XP awarded on kill (100 XP) |
| TS-PLAYER-011 | Unit | High | Invulnerable player takes no damage |
| TS-PLAYER-012 | Unit | Medium | Overkill damage caps at 0 health |
| TS-PLAYER-013 | Integration | High | Respawn resets all combat state |
| TS-PLAYER-014 | Unit | Medium | Regeneration accumulator handles fractional HP |

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
| TS-SHOOT-013 | Unit | High | Aim sway affects projectile trajectory |

### UI Tests (ui.md)

| ID | Category | Priority | Description |
|----|----------|----------|-------------|
| TS-UI-001 | Unit | Critical | Health bar reflects current health |
| TS-UI-002 | Unit | High | Kill feed shows recent kills |
| TS-UI-003 | Unit | Medium | Kill feed fades after 5 seconds |
| TS-UI-004 | Integration | High | Ammo counter updates on shoot |
| TS-UI-005 | Integration | High | Reload indicator shows during reload |
| TS-UI-006 | Integration | Critical | Timer counts down correctly |
| TS-UI-007 | Unit | Medium | Timer turns red under 60 seconds |
| TS-UI-008 | Integration | High | Score updates on kill |
| TS-UI-009 | Integration | High | Pickup prompt appears near crates |
| TS-UI-010 | Unit | Medium | Dodge cooldown shows progress |
| TS-UI-011 | Integration | Critical | Match end screen shows winner |
| TS-UI-012 | Unit | High | Scoreboard sorted correctly |
| TS-UI-013 | Visual | High | Camera flash on damage received |
| TS-UI-014 | Visual | High | Hit marker normal variant |
| TS-UI-015 | Visual | High | Hit marker kill variant |
| TS-UI-016 | Visual | Medium | Damage number variants |
| TS-UI-017 | Visual | Medium | Camera shake on dealing damage |
| TS-UI-018 | Visual | Medium | Minimap renders static layer |
| TS-UI-019 | Visual | Medium | Minimap radar range filters enemies |

### Weapons Tests (weapons.md)

| ID | Category | Priority | Description |
|----|----------|----------|-------------|
| TS-WEAP-001 | Unit | Critical | Pistol fire rate enforcement |
| TS-WEAP-002 | Unit | High | Shotgun pellet distribution |
| TS-WEAP-003 | Unit | High | Damage falloff at range |
| TS-WEAP-004 | Unit | High | Uzi vertical recoil accumulation |
| TS-WEAP-005 | Unit | Critical | Melee range and arc detection |
| TS-WEAP-006 | Unit | High | Bat knockback application |
| TS-WEAP-007 | Unit | Medium | Knockback arena boundary clamping |
| TS-WEAP-008 | Integration | High | Weapon crate respawn timing |
| TS-WEAP-009 | Unit | Medium | Sprint accuracy penalty |
| TS-WEAP-010 | Integration | Critical | Weapon pickup replaces current weapon |

---

## Critical Path Implementation Order

When implementing from scratch, execute tests in this order to verify core functionality before polish:

### Phase 1: Foundation (23 tests)

**Priority**: These tests validate basic building blocks.

1. **Constants** (TS-CONST-001 to TS-CONST-005)
   - Verify all game constants before using them

2. **Arena** (TS-ARENA-001 to TS-ARENA-013)
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

### Phase 4: Combat (52 tests)

**Priority**: Core gameplay loop.

1. **Weapons** (TS-WEAP-001 to TS-WEAP-010)
   - Weapon stats and behavior

2. **Shooting** (TS-SHOOT-001 to TS-SHOOT-013)
   - Ranged combat

3. **Hit Detection** (TS-HIT-001 to TS-HIT-014)
   - Collision and damage

4. **Melee** (TS-MELEE-001 to TS-MELEE-015)
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

### Phase 7: Polish (53 tests)

**Priority**: Visual and audio feedback.

1. **Graphics** (TS-GFX-001 to TS-GFX-024)
   - Rendering

2. **UI** (TS-UI-001 to TS-UI-019)
   - HUD elements

3. **Audio** (TS-AUDIO-001 to TS-AUDIO-010)
   - Sound effects

---

## Tests by Category

### Unit Tests (154 tests)

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

### Integration Tests (57 tests)

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

### Visual Tests (32 tests)

Tests that verify rendering output using Playwright screenshots.

**Characteristics:**
- Require browser environment
- Compare screenshot baselines
- Validate visual appearance
- Slowest execution (~5s each)

**Visual test IDs:**
- TS-ARENA-013: Floor grid renders at correct depth and spacing
- TS-CLIENT-005: Entities render correctly
- TS-GFX-001: Player renders all body parts
- TS-GFX-002: Walk animation oscillates legs
- TS-GFX-005: Aim indicator points at mouse
- TS-GFX-006: Projectile has tracer trail
- TS-GFX-007: Muzzle flash appears on shoot
- TS-GFX-008: Weapon crate renders with glow
- TS-GFX-009: Unavailable crate is faded
- TS-GFX-010: Hit particles spawn on damage
- TS-GFX-011: Death corpse renders with splayed limbs
- TS-GFX-012: Dodge roll shows rotation
- TS-GFX-013: Melee arc renders as white stroke-only
- TS-GFX-015: Blood particles spawn on damage
- TS-GFX-016: Healing particles appear during regen
- TS-GFX-017: Wall spark on obstructed barrel
- TS-GFX-018: Gun recoil on ranged fire
- TS-GFX-019: Aim sway visual oscillation
- TS-GFX-020: Reload animation pulses
- TS-GFX-021: Directional hit indicator (outgoing)
- TS-GFX-022: Directional hit indicator (incoming)
- TS-GFX-023: Crosshair reticle texture
- TS-GFX-024: Death corpse fade timing
- TS-MELEE-013: Swing animation renders 90° arc
- TS-MELEE-015: Weapon container rotation tween on swing
- TS-UI-013: Camera flash on damage received
- TS-UI-014: Hit marker normal variant
- TS-UI-015: Hit marker kill variant
- TS-UI-016: Damage number variants
- TS-UI-017: Camera shake on dealing damage
- TS-UI-018: Minimap renders static layer
- TS-UI-019: Minimap radar range filters enemies

---

## Tests by Priority

### Critical (71 tests)

**Must pass for the game to be playable.**

These tests verify:
- Core game loop functions
- Player can move, shoot, and die
- Multiplayer networking works
- Win conditions trigger correctly

**If any critical test fails:** Game is broken and unplayable.

### High (111 tests)

**Must pass for the game to be fun.**

These tests verify:
- All weapons behave correctly
- Dodge roll provides evasion
- UI provides clear feedback
- Audio responds to events
- Visual effects render correctly

**If any high test fails:** Game is playable but feature is broken.

### Medium (62 tests)

**Should pass for polish.**

These tests verify:
- Edge cases handled gracefully
- Animations smooth
- Timing precise
- Visual polish and effects

**If any medium test fails:** Minor issues, acceptable for MVP.

### Low (0 tests)

No tests are currently assigned Low priority.

---

## Implementation Checklist

Use this checklist to track test implementation progress:

### Foundation
- [ ] TS-CONST-001 through TS-CONST-005 (5 tests)
- [ ] TS-ARENA-001 through TS-ARENA-013 (13 tests)
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
- [ ] TS-SHOOT-001 through TS-SHOOT-013 (13 tests)
- [ ] TS-HIT-001 through TS-HIT-014 (14 tests)
- [ ] TS-MELEE-001 through TS-MELEE-015 (15 tests)

### Advanced Mechanics
- [ ] TS-ROLL-001 through TS-ROLL-014 (14 tests)
- [ ] TS-MATCH-001 through TS-MATCH-013 (13 tests)

### Architecture
- [ ] TS-SERVER-001 through TS-SERVER-010 (10 tests)
- [ ] TS-CLIENT-001 through TS-CLIENT-010 (10 tests)

### Polish
- [ ] TS-GFX-001 through TS-GFX-024 (24 tests)
- [ ] TS-UI-001 through TS-UI-019 (19 tests)
- [ ] TS-AUDIO-001 through TS-AUDIO-010 (10 tests)

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-02-02 | Initial specification |
| 1.1.0 | 2026-02-15 | Added 15 Epic 4 Netcode test scenarios (prediction, reconciliation, interpolation, delta compression, lag compensation, network simulator). Updated total from 179 to 194 tests. Fixed deceleration reference from 50 to 1500 px/s². |
| 1.1.1 | 2026-02-16 | Fixed test priorities/categories for shooting.md, rooms.md, server-architecture.md, match.md, and messages.md to match source spec definitions. Corrected systematically inflated Critical counts. Removed phantom Low priority count (0 Low tests exist). Flagged 15 netcode test IDs as index-only (no source spec entries). |
| 1.1.2 | 2026-02-16 | Fixed priority counts and categories for all 19 specs in By Spec table to match source spec definitions. Fixed detailed catalog entries for arena, audio, client-architecture (added 009/010), constants, dodge-roll, graphics, hit-detection, melee, messages, movement, networking, overview, player, ui, and weapons. Updated implementation checklist client-architecture count from 8 to 10. |
| 1.2.0 | 2026-02-16 | Added 20 pre-BMM visual port test scenarios. Graphics: 10 new tests (TS-GFX-015 to 024) for blood/healing particles, wall sparks, gun recoil, aim sway, reload pulse, hit indicators, crosshair, corpse fade. UI: 7 new tests (TS-UI-013 to 019) for camera flash/shake, hit markers, damage numbers, minimap. Melee: TS-MELEE-015 (weapon rotation tween). Shooting: TS-SHOOT-013 (aim sway trajectory). Arena: TS-ARENA-013 (floor grid). Updated TS-GFX-011 description (corpse with splayed limbs) and TS-GFX-013 (white stroke-only arc). Total tests: 224 → 244. Visual tests: 13 → 32. High priority: 102 → 111. Medium priority: 51 → 62. |
