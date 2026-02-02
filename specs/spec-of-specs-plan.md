# Spec-of-Specs Implementation Plan

> **Created**: 2026-02-02
> **Purpose**: Track progress on generating specification documents from SPEC-OF-SPECS.md blueprint

---

## Implementation Status

### Phase 1: Foundation (Priority: Critical)

| Spec File | Status | Lines | Notes |
|-----------|--------|-------|-------|
| [README.md](README.md) | **Complete** | ~300 | Entry point with reading order and dependency graph |
| [overview.md](overview.md) | **Complete** | ~400 | High-level architecture and design philosophy |
| [constants.md](constants.md) | **Complete** | ~650 | Single source of truth for all magic numbers |
| [arena.md](arena.md) | **Complete** | ~450 | Game world boundaries and spatial rules |

### Phase 2: Core Entities

| Spec File | Status | Lines | Notes |
|-----------|--------|-------|-------|
| [player.md](player.md) | **Complete** | ~550 | Player entity state and lifecycle |
| [movement.md](movement.md) | **Complete** | ~520 | Physics-based movement system |

### Phase 3: Networking

| Spec File | Status | Lines | Notes |
|-----------|--------|-------|-------|
| [messages.md](messages.md) | **Complete** | ~950 | Complete WebSocket message catalog |
| [networking.md](networking.md) | **Complete** | ~980 | WebSocket protocol and connection lifecycle |
| [rooms.md](rooms.md) | **Complete** | ~420 | Room management and matchmaking |

### Phase 4: Combat

| Spec File | Status | Lines | Notes |
|-----------|--------|-------|-------|
| [weapons.md](weapons.md) | **Complete** | ~750 | Complete weapon definitions and switching |
| [shooting.md](shooting.md) | **Complete** | ~650 | Ranged attack mechanics |
| [hit-detection.md](hit-detection.md) | **Complete** | ~550 | Collision detection and damage application |
| [melee.md](melee.md) | **Complete** | ~580 | Melee attack mechanics |

### Phase 5: Advanced Mechanics

| Spec File | Status | Lines | Notes |
|-----------|--------|-------|-------|
| [dodge-roll.md](dodge-roll.md) | **Complete** | ~720 | Dodge roll evasion mechanic |
| [match.md](match.md) | **Complete** | ~750 | Match lifecycle and win conditions |

### Phase 6: Client Implementation

| Spec File | Status | Lines | Notes |
|-----------|--------|-------|-------|
| [client-architecture.md](client-architecture.md) | **Complete** | ~750 | Frontend structure and rendering pipeline |
| [graphics.md](graphics.md) | **Complete** | ~750 | Procedural rendering specifications |
| [ui.md](ui.md) | **Complete** | ~700 | HUD and interface elements |
| [audio.md](audio.md) | **Complete** | ~550 | Sound effects and audio system |

### Phase 7: Server Implementation

| Spec File | Status | Lines | Notes |
|-----------|--------|-------|-------|
| [server-architecture.md](server-architecture.md) | Pending | ~425 | Backend structure and game loop |

### Phase 8: Verification

| Spec File | Status | Lines | Notes |
|-----------|--------|-------|-------|
| [test-index.md](test-index.md) | Pending | ~350 | Cross-reference of all test scenarios |

---

## Progress Summary

- **Total Specs**: 21
- **Completed**: 19 (README.md, overview.md, constants.md, arena.md, player.md, movement.md, messages.md, networking.md, rooms.md, weapons.md, shooting.md, hit-detection.md, melee.md, dodge-roll.md, match.md, client-architecture.md, graphics.md, ui.md, audio.md)
- **Pending**: 2
- **Estimated Total Lines**: ~8,575

---

## Completed Work Log

### 2026-02-02: README.md

**What was done:**
- Created the entry point for AI agents recreating Stick Rumble from scratch
- Project summary explaining the game and architecture philosophy
- Complete technology stack with exact versions
- Reading order with 8 implementation phases (19 specs total)
- ASCII dependency graph showing spec relationships
- Key dependencies table for quick reference
- Quick reference table with all specs, descriptions, and line counts
- Implementation checklist with all major features grouped by category
- "Why This Architecture?" section explaining design rationale:
  - Server-authoritative design (anti-cheat)
  - Client-side prediction (responsiveness)
  - WebSocket over HTTP polling (latency)
  - Procedural graphics (simplicity)
  - TypeBox shared schemas (type safety)
- Getting started guide for new implementers
- Spec conventions documentation

**Why this spec is critical:**
- First document AI agents should read - provides the complete roadmap
- Dependency graph prevents implementing specs out of order
- Implementation checklist ensures nothing is forgotten
- "Why" sections transfer architectural knowledge, not just "what"

---

### 2026-02-02: constants.md

**What was done:**
- Extracted ALL game constants from both client and server codebases
- Organized by category: Arena, Player, Movement, Dodge Roll, Network, Weapons, Match, Audio, UI
- Documented the **WHY** for each constant value
- Included TypeScript and Go code examples for each section
- Added damage balance calculations (shots-to-kill for each weapon)
- Documented weapon spawn locations with coordinates
- Added 5 test scenarios

**Sources analyzed:**
- `stick-rumble-server/internal/game/constants.go`
- `stick-rumble-server/internal/game/weapon.go`
- `stick-rumble-server/internal/game/match.go`
- `stick-rumble-server/internal/game/room.go`
- `stick-rumble-server/internal/game/weapon_crate.go`
- `stick-rumble-client/src/shared/constants.ts`
- `weapon-configs.json`

**Key findings:**
- All 6 weapons fully documented with damage, fire rate, magazine, reload, range, spread, recoil
- Weapon spawn locations are fixed at 5 positions forming a pentagon pattern
- Damage falloff formula documented (50% range = 100% damage, 100% range = 0% damage)
- Network tick rates verified: 60 Hz server, 20 Hz client updates

### 2026-02-02: arena.md

**What was done:**
- Documented complete arena coordinate system (screen-space, origin top-left)
- Detailed boundary collision handling with clamping algorithm
- Projectile out-of-bounds destruction logic
- Dodge roll wall termination behavior
- Player spawn algorithm (balanced spawning away from enemies)
- All 5 weapon crate fixed spawn positions with pentagon pattern reasoning
- Distance calculation and AABB collision formulas
- Weapon pickup proximity check (32px radius)
- Documented the **WHY** for every design decision
- Added 12 test scenarios covering all boundary cases

**Sources analyzed:**
- `stick-rumble-server/internal/game/constants.go`
- `stick-rumble-server/internal/game/physics.go` (clampToArena, boundary logic)
- `stick-rumble-server/internal/game/world.go` (getBalancedSpawnPointLocked)
- `stick-rumble-server/internal/game/projectile.go` (IsOutOfBounds)
- `stick-rumble-server/internal/game/weapon_crate.go` (spawn positions)
- `stick-rumble-client/src/game/simulation/physics.ts`
- `stick-rumble-client/src/game/scenes/GameScene.ts` (world bounds setup)
- `stick-rumble-client/src/game/entities/ProjectileManager.ts`
- `stick-rumble-client/src/game/entities/WeaponCrateManager.ts`

**Key findings:**
- Player boundaries: X ∈ [16, 1904], Y ∈ [32, 1048] (accounting for 32x64 hitbox)
- Spawn margin: 100px from all edges, valid region [100, 1820] x [100, 980]
- Balanced spawn tries 10 random candidates, picks one farthest from all enemies
- Client mirrors server physics for client-side prediction
- Dodge roll terminates early when position clamping detects wall collision

### 2026-02-02: player.md

**What was done:**
- Documented complete PlayerState structure for both Go (server) and TypeScript (client)
- Health system: damage application, regeneration delay (5s), regeneration rate (10 HP/s)
- Death system: death trigger (health ≤ 0), death state management
- Respawn system: 3-second delay, state reset, 2-second invulnerability
- Statistics tracking: kills, deaths, XP (100 XP per kill), KD ratio calculation
- Documented the **WHY** for all design decisions (health values, timing, etc.)
- Added 14 test scenarios covering health, death, respawn, and statistics

**Sources analyzed:**
- `stick-rumble-server/internal/game/player.go` (PlayerState, all methods)
- `stick-rumble-server/internal/game/constants.go` (health, respawn constants)
- `stick-rumble-server/internal/game/gameserver.go` (respawn flow)
- `stick-rumble-client/src/game/entities/PlayerManager.ts`
- `events-schema/src/schemas/server-to-client.ts` (PlayerState schema)

**Key findings:**
- PlayerState uses sync.RWMutex for thread-safe access
- Health regeneration uses fractional accumulator for 60 Hz precision
- Respawn resets weapon to default Pistol
- Clock injection enables deterministic testing

### 2026-02-02: movement.md

**What was done:**
- Input direction calculation from WASD keys with diagonal normalization
- Velocity calculation: acceleration/deceleration model (50 px/s²)
- Position integration: velocity * deltaTime with boundary clamping
- Sprint mechanics: 1.5x speed (300 px/s), 1.5x accuracy penalty
- Client-server sync: 60 Hz server tick, 20 Hz broadcast, event-driven input
- Client-side prediction implementation
- Documented the **WHY** for physics model choices
- Added 10 test scenarios covering acceleration, sprint, normalization, boundaries

**Sources analyzed:**
- `stick-rumble-server/internal/game/physics.go` (physics engine)
- `stick-rumble-server/internal/game/player.go` (InputState)
- `stick-rumble-server/internal/game/gameserver.go` (tick/broadcast loops)
- `stick-rumble-server/internal/game/constants.go` (movement constants)
- `stick-rumble-client/src/game/input/InputManager.ts`
- `stick-rumble-client/src/game/simulation/physics.ts`

**Key findings:**
- Diagonal movement normalized to prevent √2 speed boost
- Symmetric acceleration/deceleration (50 px/s²) for predictable feel
- Time to reach max speed: 4 seconds (200 px/s ÷ 50 px/s²)
- Aim angle threshold (5°) prevents input spam on minor mouse movements
- Dodge roll overrides normal movement with 250 px/s fixed velocity

### 2026-02-02: messages.md

**What was done:**
- Documented ALL 26 WebSocket message types (7 Client→Server, 19 Server→Client)
- Complete TypeScript and Go schemas for every message with field descriptions
- Documented the **WHY** for each message's existence and design
- When each message is sent (trigger conditions)
- Who receives each message (single player vs room broadcast)
- Example JSON payloads for every message type
- Server processing logic for each Client→Server message
- Client handling instructions for each Server→Client message
- Message flow diagrams for major workflows (connection, shooting, death/respawn, weapon pickup, match end)
- Error handling section for invalid JSON, unknown types, schema validation
- Added 10 test scenarios covering critical message flows

**Sources analyzed:**
- `events-schema/src/schemas/common.ts` (base Message format, Position, Velocity)
- `events-schema/src/schemas/client-to-server.ts` (all 7 client→server schemas)
- `events-schema/src/schemas/server-to-client.ts` (all 19 server→client schemas)
- `stick-rumble-server/internal/network/websocket_handler.go` (connection handling)
- `stick-rumble-server/internal/network/message_processor.go` (message routing)
- `stick-rumble-server/internal/network/broadcast_helper.go` (broadcast patterns)
- `stick-rumble-client/src/game/network/WebSocketClient.ts` (client connection)
- `stick-rumble-client/src/game/scenes/GameSceneEventHandlers.ts` (message handlers)

**Key findings:**
- Message frequency: `input:state` (~60Hz), `player:move` (20Hz), `match:timer` (1Hz)
- Two sending patterns: targeted (single player) vs broadcast (all in room)
- `room:joined` must be received before processing `weapon:spawned` (client queues)
- `match:ended` flag stops processing of movement/timer messages
- Schema validation is optional (ENABLE_SCHEMA_VALIDATION=true for development)
- All failure messages (shoot:failed) include reason codes for debugging

### 2026-02-02: networking.md

**What was done:**
- Documented complete WebSocket connection lifecycle (client and server)
- Connection establishment with HTTP upgrade and player ID generation
- Message serialization (JSON over text frames) with rationale for JSON vs binary
- Message routing via switch statement with all 7 message types
- Reconnection logic: 3 attempts with exponential backoff (1s, 2s, 4s)
- Intentional disconnect handling (shouldReconnect flag, close code 1000)
- Graceful server shutdown: SIGTERM/SIGINT handling with 30s timeout
- Connection cleanup: send channel close, goroutine sync, room removal
- Error handling: malformed JSON, unknown types, schema validation, buffer overflow
- Documented the **WHY** for every protocol decision
- Added 10 test scenarios covering connection, serialization, reconnection, shutdown

**Sources analyzed:**
- `stick-rumble-server/internal/network/websocket_handler.go` (connection handling, message loop)
- `stick-rumble-server/internal/network/message_processor.go` (message routing)
- `stick-rumble-server/internal/game/room.go` (broadcast, channel management)
- `stick-rumble-server/internal/game/gameserver.go` (tick/broadcast loops)
- `stick-rumble-server/internal/game/constants.go` (network constants)
- `stick-rumble-server/cmd/server/main.go` (graceful shutdown)
- `stick-rumble-client/src/game/network/WebSocketClient.ts` (client connection)

**Key findings:**
- Send buffer size: 256 messages per player to allow burst traffic
- HTTP timeouts: Read/Write 15s, Idle 60s, Shutdown 30s
- WebSocket upgrader uses 1024-byte buffers (sufficient for ~100-byte messages)
- Global singleton handler ensures all connections share room state
- Write goroutine per connection decouples game loop from socket writes
- Channel operations use panic recovery for closed channel safety
- Context propagation enables graceful shutdown of all goroutines

### 2026-02-02: rooms.md

**What was done:**
- Documented complete room management system for multiplayer matchmaking
- RoomManager and Room data structures for both Go server
- Auto-matchmaking algorithm: 2 players waiting → room created automatically
- Room lifecycle: creation, destruction, player join/leave
- Broadcasting patterns: room broadcast, exclude player, non-blocking sends
- Pending message queue: handles race condition where messages arrive before room:joined
- Tab reload handling: detects partial rooms and joins instead of waiting
- Thread safety: RWMutex patterns for concurrent access
- Documented the **WHY** for all design decisions (capacity, auto-create, no lobbies)
- Added 10 test scenarios covering room creation, capacity, broadcasting, cleanup

**Sources analyzed:**
- `stick-rumble-server/internal/game/room.go` (Room, RoomManager, broadcast)
- `stick-rumble-server/internal/game/match.go` (Match state, RegisterPlayer)
- `stick-rumble-server/internal/network/websocket_handler.go` (connection handling)
- `stick-rumble-client/src/game/scenes/GameSceneEventHandlers.ts` (room:joined, player:left handlers)
- `stick-rumble-client/src/game/network/WebSocketClient.ts` (client connection)

**Key findings:**
- Send buffer size: 256 messages per player to handle burst traffic
- Room capacity: 8 max (visual clarity in 1920x1080 arena)
- Auto-create threshold: 2 players (no waiting for "full" lobby)
- Tab reload: AddPlayer checks for 1-player rooms first
- Pending queue: 10 message limit, FIFO drop to prevent memory growth
- Panic recovery: All broadcast operations recover from closed channel panics
- Empty rooms: Destroyed immediately (no reuse, fresh Match state)

### 2026-02-02: weapons.md

**What was done:**
- Documented ALL 6 weapons (Pistol, Uzi, AK47, Shotgun, Bat, Katana)
- Complete weapon stats table with damage, fire rate, magazine, reload, speed, range, spread, arc, knockback
- Recoil system with vertical/horizontal accumulation, recovery time, max accumulation
- Damage falloff formula (50% range = full damage, linear decline to max range)
- Shotgun pellet system (8 pellets, even distribution with ±10% randomness)
- Melee attack detection (range + arc check, 90° cone)
- Bat knockback mechanics (40px push, boundary clamping)
- Weapon spawn locations (5 fixed positions forming strategic pattern)
- Pickup mechanics (32px radius, 30s respawn delay)
- Visual configurations (muzzle flash, projectile colors, tracer widths)
- Weapon configuration file structure (weapon-configs.json)
- Documented the **WHY** for all design decisions
- Added 10 test scenarios covering fire rate, pellets, falloff, recoil, melee, knockback

**Sources analyzed:**
- `weapon-configs.json` (authoritative weapon stats)
- `stick-rumble-server/internal/game/weapon.go` (Weapon struct, WeaponState, CalculateDamageFalloff)
- `stick-rumble-server/internal/game/ranged_attack.go` (shotgun pellets, recoil application)
- `stick-rumble-server/internal/game/melee_attack.go` (melee range/arc, knockback)
- `stick-rumble-server/internal/game/weapon_crate.go` (spawn locations, pickup flow)
- `stick-rumble-server/internal/game/constants.go` (pickup radius, respawn delay, sprint multiplier)
- `stick-rumble-client/src/shared/weaponConfig.ts` (visual configs, TypeScript interfaces)

**Key findings:**
- All weapons load from shared JSON file for client/server consistency
- Shotgun pellet damage: 7.5 per pellet × 8 = 60 total (matches config)
- AK47 has mixed recoil (vertical + horizontal) making it harder to control at range
- Bat is only weapon with knockback (40px), Katana has higher damage instead
- Melee weapons identified by: magazineSize == 0 AND projectileSpeed == 0
- Sprint accuracy penalty: 1.5x spread multiplier
- Weapon crates use strategic positioning (center top, left/right mid, bottom center, corner)

### 2026-02-02: shooting.md

**What was done:**
- Documented complete shoot request flow (client → server → response)
- ShootResult and Projectile data structures for Go server
- All 4 shoot:failed reason codes (no_player, cooldown, empty, reloading)
- Fire rate enforcement with per-weapon cooldown calculations
- Projectile creation from aim angle with velocity calculation
- Projectile update and expiration (1000ms lifetime, arena bounds)
- Ammo system: decrement on shot, auto-reload on empty
- Reload system: StartReload, CheckReloadComplete, reload cancellation
- Recoil system: vertical accumulation, horizontal random, sprint penalty
- Shotgun pellet spread: 8 pellets, even distribution, 10% jitter
- Documented the **WHY** for all design decisions
- Added 12 test scenarios covering success, failure, cooldown, ammo, reload, recoil

**Sources analyzed:**
- `stick-rumble-server/internal/game/weapon.go` (WeaponState, CanShoot, RecordShot, StartReload)
- `stick-rumble-server/internal/game/projectile.go` (Projectile, NewProjectile, IsExpired, IsOutOfBounds)
- `stick-rumble-server/internal/game/ranged_attack.go` (ApplyRecoilToAngle, CalculateShotgunPelletAngles)
- `stick-rumble-server/internal/game/gameserver.go` (PlayerShoot, checkReloadComplete)
- `stick-rumble-server/internal/network/message_processor.go` (handlePlayerShoot)
- `stick-rumble-client/src/game/entities/ShootingManager.ts` (canShoot, shoot)
- `events-schema/src/schemas/client-to-server.ts` (PlayerShootData)
- `events-schema/src/schemas/server-to-client.ts` (projectile:spawn, shoot:failed, weapon:state)

**Key findings:**
- Server is authoritative - client sends only aimAngle, server validates everything
- Auto-reload triggers when shooting with empty magazine
- Fire rate enforced at 60 Hz precision (16.67ms resolution)
- Recoil has max accumulation cap to prevent infinite climb
- Sprint applies 1.5x spread penalty, stacking with weapon base spread
- Shotgun creates 8 independent projectiles, each tracked separately

### 2026-02-02: hit-detection.md

**What was done:**
- Documented complete AABB collision detection algorithm
- Projectile and HitEvent data structures for Go server
- Player hitbox dimensions (32x64 centered on position)
- 6-step collision check chain (alive, invulnerable, rolling, owner, range, AABB)
- Damage application with health regeneration interrupt
- Death trigger and kill/XP tracking
- Projectile expiration (1000ms lifetime, arena bounds)
- Invulnerability system (spawn protection + dodge roll i-frames)
- Message flow diagrams for hit-with-death and hit-without-death
- Documented the **WHY** for AABB vs circle collision, 60Hz tick rate, etc.
- Added 14 test scenarios covering collision, invulnerability, range, expiration

**Sources analyzed:**
- `stick-rumble-server/internal/game/physics.go` (CheckProjectilePlayerCollision, AABB algorithm)
- `stick-rumble-server/internal/game/projectile.go` (Projectile struct, IsExpired, IsOutOfBounds)
- `stick-rumble-server/internal/game/player.go` (TakeDamage, IsInvincibleFromRoll)
- `stick-rumble-server/internal/game/gameserver.go` (checkHitDetection, tick loop)
- `stick-rumble-server/internal/network/message_processor.go` (onHit callback, death handling)
- `stick-rumble-server/internal/game/gameserver_hitdetection_test.go` (test coverage)
- `stick-rumble-server/internal/game/physics_collision_test.go` (collision algorithm tests)

**Key findings:**
- AABB collision chosen over circle for stick figure shape (32x64 rectangle)
- Collision checks run at 60 Hz, O(projectiles × players) per tick
- Range validation (800px max) happens before collision test for efficiency
- Dodge roll i-frames only active for first 200ms of 400ms roll
- Death triggers kill:credit broadcast with updated stats (kills, XP)
- Hit detection is server-authoritative - clients receive results only

### 2026-02-02: melee.md

**What was done:**
- Documented complete melee attack system for Bat and Katana weapons
- MeleeAttackResult and MeleeResult data structures for Go server
- MeleeHitData message schema with attackerId, victims, knockbackApplied
- Range + arc hit detection algorithm (cone-shaped attack area)
- Multi-target AoE hit detection (single swing hits all targets in cone)
- Knockback application for Bat (40px displacement with boundary clamping)
- Client swing animation (200ms duration, 4 frames, pie-slice arc visual)
- Failure reason codes (no_player, no_weapon, not_melee, player_dead)
- Documented the **WHY** for all design decisions
- Added 14 test scenarios covering hits, range, arc, knockback, boundaries

**Sources analyzed:**
- `stick-rumble-server/internal/game/melee_attack.go` (PerformMeleeAttack, isInMeleeRange, applyKnockback)
- `stick-rumble-server/internal/game/melee_attack_test.go` (comprehensive test coverage)
- `stick-rumble-server/internal/game/gameserver.go` (PlayerMeleeAttack, MeleeResult)
- `stick-rumble-server/internal/network/message_processor.go` (handlePlayerMeleeAttack)
- `stick-rumble-client/src/game/entities/MeleeWeapon.ts` (swing animation, arc rendering)
- `stick-rumble-client/src/game/entities/MeleeWeaponManager.ts` (per-player weapon tracking)
- `stick-rumble-client/src/game/scenes/GameSceneEventHandlers.ts` (melee:hit handler)
- `events-schema/src/schemas/client-to-server.ts` (PlayerMeleeAttackData)
- `events-schema/src/schemas/server-to-client.ts` (MeleeHitData)
- `weapon-configs.json` (Bat/Katana stats)

**Key findings:**
- Bat: 25 damage, 64px range, 90° arc, 40px knockback, 2 swings/s
- Katana: 45 damage, 80px range, 90° arc, 0 knockback, 1.25 swings/s
- Cone hit detection: distance check + angle-from-aim check
- 360° wraparound handled in angle difference calculation
- Knockback direction: attacker → target normalized vector
- melee:hit broadcasts even with empty victims (for swing animation)
- Client swing animation triggered on melee:hit, not locally

### 2026-02-02: dodge-roll.md

**What was done:**
- Documented complete dodge roll evasion mechanic
- Roll state machine (READY → ROLLING → COOLDOWN → READY)
- RollState struct for server (IsRolling, RollStartTime, LastRollTime, RollDirection)
- DodgeRollManager class for client (cooldown tracking, input validation)
- Roll direction calculation (WASD priority over aim angle)
- Roll physics (250 px/s fixed velocity overriding normal movement)
- Invincibility frames: first 200ms of 400ms roll
- Wall collision detection and early termination
- Cooldown system: 3 seconds between rolls
- WebSocket messages: player:dodge_roll, roll:start, roll:end
- Cooldown UI: circular progress indicator
- Visual effects: 360° rotation, flicker during i-frames
- Documented the **WHY** for all design decisions
- Added 14 test scenarios covering roll physics, i-frames, cooldown, wall collision

**Sources analyzed:**
- `stick-rumble-server/internal/game/constants.go` (roll constants)
- `stick-rumble-server/internal/game/player.go` (RollState, CanDodgeRoll, StartDodgeRoll, EndDodgeRoll, IsInvincibleFromRoll)
- `stick-rumble-server/internal/game/physics.go` (roll velocity override, wall collision)
- `stick-rumble-server/internal/game/gameserver.go` (checkRollDuration, onRollEnd callback)
- `stick-rumble-server/internal/network/message_processor.go` (handlePlayerDodgeRoll)
- `stick-rumble-server/internal/network/broadcast_helper.go` (broadcastRollStart, broadcastRollEnd)
- `stick-rumble-client/src/game/input/DodgeRollManager.ts`
- `stick-rumble-client/src/game/ui/DodgeRollCooldownUI.ts`
- `stick-rumble-client/src/game/scenes/GameScene.ts` (SPACE key binding)
- `stick-rumble-client/src/game/scenes/GameSceneEventHandlers.ts` (roll:start, roll:end handlers)
- `stick-rumble-client/src/game/entities/PlayerManager.ts` (roll visual effects)
- `events-schema/src/schemas/client-to-server.ts` (PlayerDodgeRollMessageSchema)
- `events-schema/src/schemas/server-to-client.ts` (RollStartData, RollEndData)

**Key findings:**
- Roll is server-authoritative: client sends request, server validates and broadcasts
- WASD keys take priority over aim angle for roll direction (intuitive for "dodge backward while shooting")
- I-frames only for first half of roll (0.2s of 0.4s) - rewards early timing, punishes panic rolls
- Wall collision detected by comparing clamped vs unclamped position during physics update
- Cooldown starts when roll ends (not when it starts) - early wall termination still triggers full cooldown
- Roll velocity (250 px/s) is calculated from distance/duration (100px / 0.4s)
- Client tracks cooldown locally for UI, but server is authoritative for actual roll validation

### 2026-02-02: match.md

**What was done:**
- Documented complete match lifecycle (WAITING → ACTIVE → ENDED state machine)
- Match and MatchConfig data structures for Go server
- PlayerScore schema for match:ended message
- Win conditions: kill target (20 kills) and time limit (420 seconds / 7 minutes)
- Winner determination with tie handling (multiple winners if equal kills)
- Timer broadcast loop (1 Hz) with CheckTimeLimit in each iteration
- Kill target check after each death (immediate win detection)
- Test mode configuration (2 kills, 10 seconds) via TEST_MODE env var
- Player registration to ensure 0-kill players appear in final scores
- Client match:ended handling (freeze gameplay, display results)
- Documented the **WHY** for all design decisions
- Added 13 test scenarios covering state transitions, timer, win conditions, ties

**Sources analyzed:**
- `stick-rumble-server/internal/game/match.go` (Match struct, all methods)
- `stick-rumble-server/internal/game/match_test.go` (comprehensive test coverage)
- `stick-rumble-server/internal/game/room.go` (TEST_MODE env var, Match creation)
- `stick-rumble-server/internal/network/websocket_handler.go` (matchTimerLoop)
- `stick-rumble-server/internal/network/broadcast_helper.go` (broadcastMatchTimers, broadcastMatchEnded)
- `stick-rumble-server/internal/network/message_processor.go` (kill target check after death)
- `events-schema/src/schemas/server-to-client.ts` (MatchTimerData, MatchEndedData, PlayerScore)
- `stick-rumble-client/src/game/scenes/GameSceneEventHandlers.ts` (match:timer, match:ended handlers)

**Key findings:**
- Match state machine prevents re-ending (only end once, first reason wins)
- RegisteredPlayers separate from PlayerKills ensures 0-kill players in final scores
- Timer loop checks time limit after each broadcast (1 Hz granularity)
- Kill target checked immediately after each kill for instant win detection
- GetFinalScores reads from World (authoritative) not Match (partial)
- Client sets matchEnded flag to ignore late player:move and match:timer messages
- Multiple winners returned in array for tie handling

### 2026-02-02: client-architecture.md

**What was done:**
- Documented complete Phaser 3 + React frontend architecture
- Application folder structure with all major directories explained
- GameConfig with physics, scale mode, and scene configuration
- Scene lifecycle: preload, create (with initialization order), update, cleanup
- All 8 manager classes documented:
  - PlayerManager: stick figure rendering, player state tracking
  - ProjectileManager: projectile lifecycle, tracer effects, muzzle flash
  - WeaponCrateManager: crate rendering, availability tracking
  - MeleeWeaponManager: melee weapon visuals, swing animations
  - HitEffectManager: object pooling (20 objects), bullet/melee/muzzle effects
  - InputManager: WASD + mouse capture, aim angle calculation
  - ShootingManager: fire rate cooldowns, ammo state, reload
  - DodgeRollManager: roll state, cooldown tracking, i-frames
- Network integration: WebSocketClient event dispatch, GameSceneEventHandlers
- React-Phaser bridge: PhaserGame component, window.onMatchEnd, window.restartGame
- Complete rendering pipeline (frame order, depth layering)
- Data structures: InputState, PlayerState, WeaponState, ProjectileData, WeaponCrateData
- Documented the **WHY** for all architectural decisions
- Added 10 test scenarios covering managers, lifecycle, and network

**Sources analyzed:**
- `stick-rumble-client/src/game/scenes/GameScene.ts` (scene lifecycle, manager orchestration)
- `stick-rumble-client/src/game/scenes/GameSceneEventHandlers.ts` (16 message handlers)
- `stick-rumble-client/src/game/entities/PlayerManager.ts` (player rendering)
- `stick-rumble-client/src/game/entities/ProjectileManager.ts` (projectile lifecycle)
- `stick-rumble-client/src/game/entities/WeaponCrateManager.ts` (crate management)
- `stick-rumble-client/src/game/entities/MeleeWeaponManager.ts` (melee visuals)
- `stick-rumble-client/src/game/entities/HitEffectManager.ts` (object pooling)
- `stick-rumble-client/src/game/entities/ProceduralPlayerGraphics.ts` (stick figure rendering)
- `stick-rumble-client/src/game/entities/ProceduralWeaponGraphics.ts` (weapon rendering)
- `stick-rumble-client/src/game/input/InputManager.ts` (WASD + mouse)
- `stick-rumble-client/src/game/input/ShootingManager.ts` (fire/reload)
- `stick-rumble-client/src/game/input/DodgeRollManager.ts` (roll cooldown)
- `stick-rumble-client/src/game/network/WebSocketClient.ts` (connection wrapper)
- `stick-rumble-client/src/ui/common/PhaserGame.tsx` (React-Phaser bridge)
- `stick-rumble-client/src/App.tsx` (React root, match end state)
- `stick-rumble-client/src/game/config/GameConfig.ts` (Phaser configuration)

**Key findings:**
- Manager pattern isolates subsystems (one manager per entity type)
- 100ms delay in create() ensures scene stability before WebSocket connect
- Object pool size 20 handles 8-player combat effectively
- Walk animation driven by velocity magnitude (natural movement feel)
- Pending message queues handle race condition where messages arrive before room:joined
- Handler cleanup prevents accumulation across scene restarts
- Input threshold (5° for aim) prevents server spam
- Local visual updates before server response for responsive feel

### 2026-02-02: overview.md

**What was done:**
- Documented the high-level architecture and design philosophy for Stick Rumble
- Complete game description: multiplayer browser-based stick figure arena shooter
- Player count (2-8), match duration (3-7 minutes), win conditions (20 kills or 7 min timer)
- Server-authoritative architecture pattern with ASCII diagram
- Tick rates: 60 Hz server, 20 Hz broadcast, 60 Hz client render
- Client-side prediction approach to mask network latency
- Dual application structure documented:
  - Frontend: Phaser 3.90.0 + React 19.2.0 + TypeScript 5.9.3 + Vite 7.2.4
  - Backend: Go 1.25 + gorilla/websocket v1.5.3
  - Shared: TypeBox 0.34.27 schemas for type-safe messages
- Anti-cheat philosophy: trust no client, server validates all actions
- Input validation patterns with example shoot validation code
- Rate limiting table (input 60 Hz, shoot by weapon fire rate, reload once per mag, roll 3s cooldown)
- Schema validation for development with ENABLE_SCHEMA_VALIDATION env var
- Complete folder structure with descriptions
- Naming conventions table (kebab-case for specs, PascalCase for TS, snake_case for Go)
- Module boundaries diagram showing shared/client/server separation
- Key design decisions table with rationale
- Documented the **WHY** for all architectural choices
- Added 5 test scenarios covering tick rate, broadcast rate, schema sync, validation, input capture

**Sources analyzed:**
- `stick-rumble-client/package.json` (client dependencies and versions)
- `stick-rumble-server/go.mod` (server dependencies and versions)
- `events-schema/package.json` (shared schema dependencies)
- `CLAUDE.md` (project context and workflow)
- `docs/ARCHITECTURE.md` (system design overview)
- Project folder structure (both client and server)
- Existing specs for cross-reference data

**Why this spec is critical:**
- Root specification that all other specs depend on
- Provides architectural context needed to understand any specific system
- Explains WHY server-authoritative design was chosen (anti-cheat)
- Documents folder structure so AI agents can navigate codebase
- Key design decisions inform implementation choices in all other specs

### 2026-02-02: graphics.md

**What was done:**
- Documented complete procedural graphics system using Phaser GameObjects.Graphics
- Stick figure rendering with head, arms, legs, and rotation support
- Walk animation using sine wave oscillation (left/right leg opposite phase)
- Player colors: local (green), enemy (red), dead (gray)
- All 6 weapon procedural graphics from rectangles (Pistol, Bat, Katana, Uzi, AK47, Shotgun)
- Projectile rendering with tracer lines and weapon-specific colors
- Muzzle flash effects with per-weapon size/duration/color
- Health bar rendering (world-space above player + HUD with dynamic colors)
- Aim indicator lines and dynamic crosshair with spread visualization
- Weapon crate rendering with bobbing animation and glow effect
- Melee swing arc visualization (pie-slice for Bat/Katana)
- Hit effect object pooling system (20 effects: bullet, melee, muzzle)
- Dodge roll visual effects (360° rotation + i-frame flicker)
- Dodge roll cooldown UI (circular progress indicator)
- Death visual (gray color overlay)
- Rendering layer depths and Z-ordering
- Documented the **WHY** for all design decisions
- Added 14 test scenarios covering player, animation, effects, pooling

**Sources analyzed:**
- `stick-rumble-client/src/game/entities/ProceduralPlayerGraphics.ts`
- `stick-rumble-client/src/game/entities/ProceduralWeaponGraphics.ts`
- `stick-rumble-client/src/game/entities/PlayerManager.ts`
- `stick-rumble-client/src/game/entities/ProjectileManager.ts`
- `stick-rumble-client/src/game/entities/HitEffectManager.ts`
- `stick-rumble-client/src/game/entities/MeleeWeapon.ts`
- `stick-rumble-client/src/game/entities/WeaponCrateManager.ts`
- `stick-rumble-client/src/game/entities/HealthBar.ts`
- `stick-rumble-client/src/game/entities/Crosshair.ts`
- `stick-rumble-client/src/game/ui/HealthBarUI.ts`
- `stick-rumble-client/src/game/ui/DodgeRollCooldownUI.ts`
- `stick-rumble-client/src/shared/constants.ts`
- `stick-rumble-client/public/weapon-configs.json`

**Key findings:**
- All graphics are procedural (no sprites) using Phaser's Graphics API
- Object pooling for hit effects prevents GC stalls during combat
- Walk animation uses simple sine wave: walkCycle += delta * 0.02
- Rendering layers: Players (50), Effects (60), Melee arcs (100), UI (1000+)
- Weapon configs define per-weapon visual properties (muzzle flash color/size/duration)
- Health bar HUD uses color thresholds: green (>60%), yellow (30-60%), red (<30%)
- Melee swing shows 90° arc with semi-transparent fill for attack cone feedback
- Dodge roll flickers visibility during first 200ms (i-frames visual feedback)

### 2026-02-02: ui.md

**What was done:**
- Documented ALL 14 UI elements in the game with complete visual specifications
- Health Bar UI: Position, dimensions, color thresholds (green/yellow/red), regeneration pulse animation
- Kill Feed: FIFO queue, 5 max entries, 5s fade delay, right-aligned positioning
- Ammo Display: Current/max format, low ammo red color, hidden for melee weapons
- Reload Indicators: Progress bar, centered circle, flashing "RELOAD!" text with priorities
- Match Timer: MM:SS format, color transitions at 120s/60s thresholds
- Dodge Roll Cooldown: Circular progress indicator (gray background, green arc)
- Pickup Prompt: Bottom-center, yellow text, 32px proximity trigger
- Crosshair: Mouse-following with per-weapon spread circles, lerp smoothing
- Damage Flash: Full-screen red overlay, 200ms fade
- Hit Marker: X-pattern confirmation, 200ms fade
- Damage Numbers: Floating text above victim, 1000ms float+fade
- Match End Screen: React modal with scoreboard, XP breakdown, countdown
- Connection Status: Green/red text with control hints
- Documented the **WHY** for every design decision (positioning, colors, timing)
- Added 12 test scenarios covering all major UI behaviors

**Sources analyzed:**
- `stick-rumble-client/src/game/ui/HealthBarUI.ts`
- `stick-rumble-client/src/game/ui/KillFeedUI.ts`
- `stick-rumble-client/src/game/ui/DodgeRollCooldownUI.ts`
- `stick-rumble-client/src/game/ui/PickupPromptUI.ts`
- `stick-rumble-client/src/game/entities/Crosshair.ts`
- `stick-rumble-client/src/game/scenes/GameSceneUI.ts`
- `stick-rumble-client/src/ui/match/MatchEndScreen.tsx`
- `stick-rumble-client/src/ui/match/MatchEndScreen.css`
- `stick-rumble-client/src/game/scenes/GameScene.ts`
- `stick-rumble-client/src/game/scenes/GameSceneEventHandlers.ts`

**Key findings:**
- UI depth layering: 999 (damage flash) → 1000 (base) → 1001-1003 (reload indicators)
- All HUD elements use scrollFactor(0) for screen-fixed positioning
- React modal for match end enables accessibility and standard UI patterns
- Health color thresholds: >60% green, 30-60% yellow, <30% red
- Kill feed uses right-align to prevent overlap with left HUD
- Crosshair spread uses lerp (0.2 speed) for smooth transitions
- Melee weapons hide ammo display and spread circle (infinite attacks, no spread)
- Match end modal has 10s auto-restart countdown
- Event handlers update UI in response to server messages (not locally)

### 2026-02-02: audio.md

**What was done:**
- Documented complete audio system using Phaser's WebAudio-backed sound manager
- AudioManager class with volume control, mute state, and active sound tracking
- Weapon sound mappings (Uzi, AK47, Shotgun) with fallback for unmapped weapons
- Effect sounds (dodge roll whoosh)
- Positional audio implementation:
  - Pan calculation based on horizontal offset from listener
  - Linear volume falloff based on Euclidean distance
  - MAX_AUDIO_DISTANCE = 1000px for spatial boundary
- Local vs remote player sound playback differentiation
- Event integration flow (projectile:spawn, roll:start triggers)
- Audio asset requirements and current placeholder files
- Documented the **WHY** for all design decisions
- Added 10 test scenarios covering playback, positional audio, volume, mute

**Sources analyzed:**
- `stick-rumble-client/src/game/audio/AudioManager.ts` (core implementation)
- `stick-rumble-client/src/game/audio/AudioManager.test.ts` (test coverage)
- `stick-rumble-client/src/game/scenes/GameScene.ts` (integration)
- `stick-rumble-client/src/game/scenes/GameSceneEventHandlers.ts` (event triggers)
- `stick-rumble-client/public/assets/audio/` (asset files)
- `stick-rumble-client/public/assets/audio/README.md` (asset documentation)

**Key findings:**
- Audio is entirely client-side (server broadcasts events, clients render sound)
- Positional audio uses simple linear falloff: `volume = 1 - distance/maxDistance`
- Pan only on X-axis (stereo has no vertical component)
- Unknown weapon types fall back to Uzi sound for graceful degradation
- Active sounds tracked for proper cleanup on scene restart
- Future sounds planned: empty click, hit confirmation, reload, melee swing

**Why this spec matters:**
- Completes Phase 6 (Client Implementation)
- Audio provides critical gameplay feedback (weapon sounds, dodge roll confirmation)
- Positional audio creates spatial awareness in multiplayer combat
- Documents current implementation status and future audio work

---

## Next Priority

**Phase 6 (Client Implementation) is COMPLETE!**

Remaining specs in priority order:

1. **server-architecture.md** (Phase 7) - Backend structure, game loop
2. **test-index.md** (Phase 8) - Cross-reference of all test scenarios

---

## Validation Checklist

Before marking a spec as complete, verify:

- [ ] All constants referenced exist in constants.md
- [ ] TypeScript and Go code examples are syntactically correct
- [ ] Test scenarios follow the TS-{PREFIX}-{NUMBER} format
- [ ] Error handling section covers all edge cases
- [ ] Cross-references to other specs use correct markdown links
- [ ] Changelog entry added with current date
