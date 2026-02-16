# Overview

> **Spec Version**: 1.0.0
> **Last Updated**: 2026-02-02
> **Depends On**: None (root specification)
> **Depended By**: [constants.md](constants.md), [arena.md](arena.md), [player.md](player.md), [networking.md](networking.md), [client-architecture.md](client-architecture.md), [server-architecture.md](server-architecture.md)

---

## Overview

Stick Rumble is a multiplayer browser-based stick figure arena shooter that captures the essence of Flash-era games like Stick Arena with modern web technology. The game features fast-paced combat with 6 unique weapons, dodge roll mechanics, and competitive match-based gameplay.

This specification defines the high-level architecture, design philosophy, and structural organization that governs all other specifications in this suite. It serves as the foundational context that AI agents need before diving into specific systems.

**Why this spec exists:**
- Provides the architectural context that informs all other specs
- Explains the server-authoritative model that shapes every game system
- Documents the folder structure to help agents navigate the codebase
- Captures design decisions and their rationale so future implementations maintain consistency

---

## Dependencies

### Technology Dependencies

| Technology | Version | Purpose |
|------------|---------|---------|
| **Frontend** | | |
| Phaser | 3.90.0 | 2D game engine for rendering and physics |
| React | 19.2.0 | UI framework for HUD and menus |
| TypeScript | 5.9.3 | Type-safe JavaScript for client code |
| Vite | 7.2.4 | Fast build tool and dev server |
| Vitest | 4.0.13 | Unit and integration testing |
| Playwright | 1.57.0 | Visual regression testing |
| **Backend** | | |
| Go | 1.25 | Server runtime |
| gorilla/websocket | v1.5.3 | WebSocket implementation |
| **Shared** | | |
| TypeBox | 0.34.27 | JSON schema generation from TypeScript |
| Ajv | 8.17.1 | JSON schema validation |

### Spec Dependencies

This is the root specification. No dependencies.

---

## Game Description

### Core Concept

Stick Rumble is a top-down multiplayer shooter where stick figure characters battle in an arena using a variety of ranged and melee weapons. The game is designed for quick, competitive matches that last 3-7 minutes.

**Key characteristics:**
- **Browser-based**: No download required, play instantly via URL
- **Multiplayer**: 2-8 players per match
- **Fast-paced**: Instant respawns (3 seconds), high mobility
- **Competitive**: Kill-based scoring with time limits
- **Accessible**: Simple WASD + mouse controls

### Win Conditions

A match ends when either:
1. **Kill Target**: First player to reach 20 kills wins
2. **Time Limit**: After 7 minutes, player with most kills wins

Ties are possible when multiple players have equal kills at time limit.

### Weapons

Six weapons provide diverse combat options:

| Category | Weapons | Characteristics |
|----------|---------|-----------------|
| **Ranged** | Pistol, Uzi, AK47, Shotgun | Projectile-based, ammo limited |
| **Melee** | Bat, Katana | Close range, unlimited uses |

Players spawn with a Pistol and can pick up other weapons from crates around the arena.

### Movement

- **WASD**: Directional movement (200 px/s)
- **Shift**: Sprint (300 px/s, accuracy penalty)
- **Space**: Dodge roll (invincibility frames)
- **Mouse**: Aim direction
- **Click**: Fire weapon

**Why this design:**
- WASD + mouse mirrors industry-standard FPS controls
- Dodge roll adds skill expression and outplay potential
- Sprint creates risk/reward tradeoff (speed vs accuracy)

---

## Architecture Pattern

### Server-Authoritative Model

**Core principle:** All game state lives on the server. Clients are "untrusted display layers."

```
┌─────────────────────────────────────────────────────────────────┐
│                         SERVER (Go)                             │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐       │
│  │  Game State   │  │    Physics    │  │  Hit Detection│       │
│  │  (positions,  │  │  (60 Hz tick) │  │  (collisions) │       │
│  │   health,     │  │               │  │               │       │
│  │   ammo)       │  │               │  │               │       │
│  └───────────────┘  └───────────────┘  └───────────────┘       │
│                              │                                   │
│                    ┌─────────┴─────────┐                        │
│                    │  Broadcast (20Hz) │                        │
│                    └─────────┬─────────┘                        │
└──────────────────────────────│──────────────────────────────────┘
                               │ WebSocket
         ┌─────────────────────┼─────────────────────┐
         │                     │                     │
         ▼                     ▼                     ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│    CLIENT 1     │  │    CLIENT 2     │  │    CLIENT 3     │
│  (Phaser + React)│  │  (Phaser + React)│  │  (Phaser + React)│
│                 │  │                 │  │                 │
│  Sends: inputs  │  │  Sends: inputs  │  │  Sends: inputs  │
│  Receives: state│  │  Receives: state│  │  Receives: state│
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

**What clients send (inputs only):**
- WASD key states
- Mouse aim angle
- Shoot/reload/dodge requests

**What server sends (authoritative state):**
- Player positions (20 Hz)
- Projectile spawns/destroys
- Hit confirmations
- Match state updates

**Why this design:**
- **Prevents cheating**: JavaScript is client-side; any client can be modified. Server validation ensures no speed hacks, aimbots, or position manipulation.
- **Consistent gameplay**: All players see the same state, no "he was behind the wall on my screen" disputes.
- **Fair hit detection**: Server determines hits based on authoritative positions.
- **Trade-off**: Requires client-side prediction to mask latency.

### Tick Rates

| Rate | Hz | Interval | Purpose |
|------|-----|----------|---------|
| Server Tick | 60 | 16.67ms | Physics updates, collision detection |
| Client Broadcast | 20 | 50ms | Send state updates to all clients |
| Client Render | 60 | 16.67ms | Smooth visual updates |
| Input Send | 60 | 16.67ms | Stream input state to server |

**Why 60 Hz server tick:**
- Matches client render rate for smooth physics
- Sufficient precision for hit detection (projectiles travel ~13px per tick)
- Standard game development practice

**Why 20 Hz broadcast:**
- Balances bandwidth (~2-5 KB/s per player) vs visual smoothness
- 50ms updates are imperceptible with interpolation
- Reduces server network load by 3x vs 60 Hz

### Client-Side Prediction

To mask network latency (50-150ms typical), clients predict their own movement locally:

```
┌─────────────────────────────────────────────────────────────────┐
│                    CLIENT-SIDE PREDICTION                       │
│                                                                 │
│  Frame N:                                                       │
│    1. Read local input (WASD, mouse)                           │
│    2. Apply input to predicted position                         │
│    3. Render predicted position immediately                     │
│    4. Send input to server                                      │
│                                                                 │
│  Frame N+3 (50ms later):                                        │
│    5. Receive server state                                      │
│    6. Reconcile: If server position differs significantly,      │
│       snap to server position (server is authoritative)         │
│                                                                 │
│  Result: Player feels responsive, server remains authoritative  │
└─────────────────────────────────────────────────────────────────┘
```

**Why this design:**
- Without prediction, movement would feel laggy (50-150ms delay)
- Prediction makes controls feel instant while server validates
- Reconciliation prevents drift from server state

---

## Dual Application Structure

### Frontend (stick-rumble-client/)

The client is a Phaser 3 game embedded in a React application.

```
stick-rumble-client/
├── public/                    # Static assets served by Vite
│   └── assets/                # Game assets (audio, images)
├── src/
│   ├── game/                  # Phaser game code
│   │   ├── config/            # GameConfig (physics, scale)
│   │   ├── entities/          # Player, Projectile, WeaponCrate managers
│   │   ├── input/             # InputManager, ShootingManager, DodgeRollManager
│   │   ├── network/           # WebSocketClient wrapper
│   │   ├── scenes/            # GameScene (main game loop)
│   │   ├── simulation/        # Client-side prediction physics
│   │   ├── ui/                # In-game HUD elements
│   │   ├── effects/           # Visual effects (particles)
│   │   ├── audio/             # Sound effects
│   │   └── utils/             # Math helpers, color utilities
│   ├── shared/                # Constants, types, weapon configs
│   └── ui/                    # React components
│       ├── common/            # PhaserGame bridge component
│       └── match/             # Match end screen, scoreboard
├── tests/                     # Test files
│   ├── visual/                # Playwright visual tests
│   └── screenshots/           # Visual regression baselines
├── vite.config.ts             # Vite build configuration
└── package.json               # Node dependencies

Dev URL: http://localhost:5173
```

**Manager Pattern:**
The client uses manager classes to isolate subsystems:
- `PlayerManager`: Renders stick figures, tracks player state
- `ProjectileManager`: Spawns/destroys projectiles with pooling
- `WeaponCrateManager`: Renders crates, tracks availability
- `InputManager`: Captures keyboard/mouse input
- `ShootingManager`: Enforces fire rate, tracks ammo
- `DodgeRollManager`: Manages roll cooldown and state

**Why Phaser + React:**
- Phaser provides proven 2D game engine with WebGL renderer
- React handles UI outside the game canvas (menus, HUD overlays)
- Both are TypeScript-compatible for type safety

### Backend (stick-rumble-server/)

The server is a Go application using the standard library HTTP server with WebSocket upgrade.

```
stick-rumble-server/
├── cmd/
│   └── server/                # Application entry point
│       └── main.go            # HTTP server, graceful shutdown
├── internal/                  # Private packages (not importable externally)
│   ├── auth/                  # Authentication (planned)
│   ├── db/                    # Database layer (planned)
│   ├── game/                  # Game logic
│   │   ├── constants.go       # All game constants
│   │   ├── room.go            # Room and RoomManager
│   │   ├── match.go           # Match state machine
│   │   ├── player.go          # Player state
│   │   ├── world.go           # World state container
│   │   ├── physics.go         # Movement physics
│   │   ├── projectile.go      # Projectile lifecycle
│   │   ├── weapon.go          # Weapon stats, WeaponState
│   │   ├── weapon_crate.go    # Weapon crate spawning
│   │   ├── ranged_attack.go   # Shooting logic
│   │   ├── melee_attack.go    # Melee logic
│   │   └── gameserver.go      # Game loop orchestration
│   └── network/               # WebSocket handling
│       ├── websocket_handler.go  # HTTP→WS upgrade, connection lifecycle
│       ├── message_processor.go  # Message routing and validation
│       └── broadcast_helper.go   # Room broadcast patterns
├── go.mod                     # Go module definition
└── go.sum                     # Dependency checksums

API URL: http://localhost:8080/ws
```

**Game Server Pattern:**
```go
type GameServer struct {
    world              *World              // All players, projectiles, crates
    physics            *Physics            // Movement and collision calculations
    projectileManager  *ProjectileManager  // Active projectile tracking
    weaponCrateManager *WeaponCrateManager // Weapon crate lifecycle
    weaponStates       map[string]*WeaponState // playerID → weapon state

    tickRate   time.Duration // 16.67ms (60 Hz game loop)
    updateRate time.Duration // 50ms (20 Hz state broadcast)

    broadcastFunc func(playerStates []PlayerStateSnapshot) // Injected callback
    onHit         func(hit HitEvent)                       // Hit event callback
    onRespawn     func(playerID string, position Vector2)  // Respawn callback
    // ... additional callbacks for reload, weapon pickup, roll end, etc.
}
```

**Why Go:**
- Excellent concurrency (goroutines for each connection)
- Low latency WebSocket handling
- Simple deployment (single binary)
- Strong standard library (no framework needed)

### Shared Schema Layer (events-schema/)

TypeBox schemas provide a single source of truth for message types.

```
events-schema/
├── src/
│   ├── schemas/
│   │   ├── common.ts          # Position, Velocity, Message base
│   │   ├── client-to-server.ts # Client→Server messages (6 types)
│   │   └── server-to-client.ts # Server→Client messages (22 types)
│   ├── build-schemas.ts       # Generates JSON schemas for Go
│   ├── validate-schemas.ts    # Validates schema integrity
│   ├── check-schemas-up-to-date.ts # CI drift detection
│   └── index.ts               # Public exports
├── generated/                 # Auto-generated JSON schemas
│   └── *.json                 # Used by Go server for validation
├── package.json
└── tsconfig.json
```

**Why TypeBox:**
- TypeScript types AND JSON schemas from same definition
- Client uses TypeScript types directly
- Server uses generated JSON schemas for optional runtime validation
- Ensures client and server never drift out of sync

---

## Anti-Cheat Philosophy

### Trust No Client

The fundamental rule: **Never trust data from clients.**

| Data | Who Computes | Why |
|------|--------------|-----|
| Player position | Server | Prevents speed hacks, teleportation |
| Player health | Server | Prevents god mode |
| Ammo count | Server | Prevents infinite ammo |
| Hit detection | Server | Prevents aimbots, wall hacks |
| Damage values | Server | Prevents damage multipliers |

**What clients CAN control:**
- Their own input (but server validates timing)
- Visual preferences (muted, camera zoom)
- Nothing that affects other players

### Input Validation

Every client action is validated server-side:

```go
// Example: Shoot validation (simplified from gameserver.go:336)
func (gs *GameServer) PlayerShoot(playerID string, aimAngle float64, clientTimestamp int64) ShootResult {
    // 1. Player exists (no IsDead check — only existence is verified)
    player, exists := gs.world.GetPlayer(playerID)
    if !exists {
        return ShootResult{Success: false, Reason: "no_player"}
    }

    // 2. Weapon state from separate map (not player struct)
    gs.weaponMu.RLock()
    ws := gs.weaponStates[playerID]
    gs.weaponMu.RUnlock()
    if ws == nil {
        return ShootResult{Success: false, Reason: "no_player"}
    }

    // 3. Not currently reloading
    if ws.IsReloading {
        return ShootResult{Success: false, Reason: "reloading"}
    }

    // 4. Has ammo (auto-reload on empty)
    if ws.IsEmpty() {
        ws.StartReload()
        return ShootResult{Success: false, Reason: "empty"}
    }

    // 5. Fire rate cooldown
    if !ws.CanShoot() {
        return ShootResult{Success: false, Reason: "cooldown"}
    }

    // All checks passed - record shot and create projectile
    ws.RecordShot()
    // ... hitscan or projectile path
}
```

### Rate Limiting

Actions are rate-limited to prevent spam:

| Action | Rate Limit | Enforcement |
|--------|------------|-------------|
| Input state | 60 Hz max | Server ignores excess |
| Shoot | Weapon fire rate | Server rejects early shots |
| Reload | Once per magazine | Server rejects during reload |
| Dodge roll | 3s cooldown | Server rejects during cooldown |

### Schema Validation

Optional runtime validation ensures message integrity:

```bash
# Enable schema validation (development only)
ENABLE_SCHEMA_VALIDATION=true go run cmd/server/main.go
```

When enabled, the server validates every outgoing message against JSON schemas generated from TypeBox definitions. This catches bugs where the server sends malformed data.

**Why optional:**
- Validation has CPU cost (~1ms per message)
- Disabled in production for performance
- Enabled in development and CI for correctness

---

## Folder Structure

### Complete Project Tree

```
stick-rumble/
├── .claude/                       # Claude Code configuration
│   ├── settings.json              # AI agent settings
│   └── todos.json                 # Task tracking
│
├── docs/                          # Project documentation
│   ├── ARCHITECTURE.md            # System design overview
│   ├── TESTING-STRATEGY.md        # Testing approach
│   ├── GDD.md                     # Game Design Document
│   ├── epics/                     # Epic breakdown documents
│   ├── archive/                   # Historical documentation
│   └── research/                  # Technical research notes
│
├── events-schema/                 # Shared TypeBox schemas (see above)
│
├── specs/                         # Detailed specifications (this folder)
│   ├── README.md                  # Spec index and reading order
│   ├── SPEC-OF-SPECS.md           # Specification structure template
│   ├── spec-of-specs-plan.md      # Spec creation plan and work log
│   ├── test-index.md              # Cross-spec test scenario index
│   ├── overview.md                # This file
│   ├── constants.md               # All magic numbers
│   ├── arena.md                   # World boundaries
│   ├── player.md                  # Player mechanics
│   ├── movement.md                # Physics and input
│   ├── weapons.md                 # 6 weapon definitions
│   ├── shooting.md                # Ranged attack system
│   ├── melee.md                   # Melee attack system
│   ├── hit-detection.md           # Collision and damage
│   ├── dodge-roll.md              # Evasion mechanics
│   ├── match.md                   # Match state machine
│   ├── rooms.md                   # Matchmaking
│   ├── messages.md                # WebSocket messages
│   ├── networking.md              # Connection lifecycle
│   ├── client-architecture.md     # Phaser scenes and managers
│   ├── server-architecture.md     # Go server internals and game loop
│   ├── ui.md                      # HUD, kill feed, scoreboard, timers
│   ├── graphics.md                # Rendering and visual effects
│   └── audio.md                   # Sound effects and audio system
│
├── stick-rumble-client/           # Frontend application (see above)
│
├── stick-rumble-server/           # Backend application (see above)
│
├── weapon-configs.json            # Weapon balance data (shared)
├── Makefile                       # Root-level build commands
├── CLAUDE.md                      # AI agent instructions
├── README.md                      # Project entry point
└── GDD.md                         # Game Design Document (root copy)
```

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Spec files | kebab-case.md | `hit-detection.md` |
| TypeScript files | PascalCase.ts | `PlayerManager.ts` |
| Go files | snake_case.go | `melee_attack.go` |
| Test files | *.test.ts / *_test.go | `PlayerManager.test.ts` |
| Constants | SCREAMING_SNAKE | `MAX_PLAYERS_PER_ROOM` |

### Module Boundaries

```
┌─────────────────────────────────────────────────────────────────┐
│                        SHARED BOUNDARY                          │
│  events-schema/ ─── Defines message contracts ───────────────── │
│  weapon-configs.json ─── Defines weapon stats ───────────────── │
│  specs/ ─── Defines behavioral contracts ────────────────────── │
└─────────────────────────────────────────────────────────────────┘
                               │
          ┌────────────────────┼────────────────────┐
          │                    │                    │
          ▼                    │                    ▼
┌───────────────────┐          │         ┌───────────────────┐
│  CLIENT BOUNDARY  │          │         │  SERVER BOUNDARY  │
│                   │          │         │                   │
│  stick-rumble-    │   WebSocket        │  stick-rumble-    │
│  client/          │ ◄────────────────► │  server/          │
│                   │          │         │                   │
│  - Renders state  │          │         │  - Owns state     │
│  - Captures input │          │         │  - Validates input│
│  - Predicts locally│         │         │  - Broadcasts state│
└───────────────────┘          │         └───────────────────┘
```

**Import rules:**
- Client imports from `events-schema` (TypeScript types)
- Server loads from `events-schema/generated/` (JSON schemas)
- Neither client nor server imports from the other
- Specs are human documentation, not imported

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **WebSocket** | Real-time bidirectional communication. HTTP polling would add 50-100ms latency per request. |
| **JSON over Binary** | Debuggable, schema-validatable, human-readable. Performance is sufficient at 20 Hz. |
| **TypeBox** | Single source of truth for TypeScript types AND JSON schemas. No manual sync. |
| **Procedural graphics** | Stick figures render instantly, no asset loading. Enables rapid iteration. |
| **Manager pattern** | Isolates subsystems (players, projectiles, input). Each manager has single responsibility. |
| **60 Hz tick** | Matches 60 FPS display. Provides 16.67ms precision for physics and hit detection. |
| **20 Hz broadcast** | Balances bandwidth vs smoothness. Interpolation smooths between updates. |
| **Graceful shutdown** | 30-second timeout allows in-flight messages to complete before server exit. |

---

## Implementation Notes

### TypeScript (Client)

Key patterns used throughout the client:

```typescript
// 1. Manager pattern - single responsibility
class PlayerManager {
  private players: Map<string, PlayerState> = new Map();
  private graphics: Map<string, Phaser.GameObjects.Container> = new Map();

  update(delta: number): void {
    // Update all players each frame
  }
}

// 2. Event-driven architecture
wsClient.on('player:move', (data: PlayerMoveData) => {
  playerManager.updatePosition(data.id, data.position);
});

// 3. Object pooling for performance
class HitEffectManager {
  private pool: HitEffect[] = [];
  private readonly POOL_SIZE = 20;
}
```

### Go (Server)

Key patterns used throughout the server:

```go
// 1. RWMutex for concurrent access
type World struct {
    mu      sync.RWMutex
    players map[string]*Player
}

func (w *World) GetPlayer(id string) *Player {
    w.mu.RLock()
    defer w.mu.RUnlock()
    return w.players[id]
}

// 2. Channel-based broadcasting
type Player struct {
    SendChan chan []byte
}

func (r *Room) Broadcast(message []byte) {
    for _, player := range r.Players {
        select {
        case player.SendChan <- message:
        default:
            // Buffer full, message dropped
        }
    }
}

// 3. Context for graceful shutdown
func (s *Server) Serve(ctx context.Context) error {
    go s.gameLoop(ctx)
    <-ctx.Done()
    return s.shutdown()
}
```

---

## Test Scenarios

### TS-OV-001: Server Tick Rate

**Category**: Integration
**Priority**: Critical

**Preconditions:**
- Server running

**Input:**
- Start game loop
- Measure 100 ticks

**Expected Output:**
- Average tick interval: 16.67ms ± 1ms
- No ticks skipped

---

### TS-OV-002: Client Broadcast Rate

**Category**: Integration
**Priority**: Critical

**Preconditions:**
- Server running with 2+ players

**Input:**
- Observe player:move messages over 5 seconds

**Expected Output:**
- 100 messages ± 5 (20 Hz for 5 seconds)

---

### TS-OV-003: Client-Server Schema Sync

**Category**: Unit
**Priority**: High

**Preconditions:**
- events-schema/ package built

**Input:**
- Run schema validation

**Expected Output:**
- All TypeScript types match generated JSON schemas
- No schema drift

---

### TS-OV-004: Message Validation

**Category**: Unit
**Priority**: High

**Preconditions:**
- ENABLE_SCHEMA_VALIDATION=true

**Input:**
- Server sends player:move message

**Expected Output:**
- Message passes schema validation
- No validation errors logged

---

### TS-OV-005: Client Input Capture

**Category**: Unit
**Priority**: High

**Preconditions:**
- Client running, game scene active

**Input:**
- Press W key

**Expected Output:**
- InputManager captures `up: true`
- input:state message sent with `up: true`

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-02-02 | Initial specification |
| 1.0.1 | 2026-02-16 | Fixed GameServer struct — replaced nonexistent Room/Match/ticker/broadcaster fields with actual callbacks and duration configs from `gameserver.go`. |
| 1.0.2 | 2026-02-16 | Fixed anti-cheat PlayerShoot pseudocode — no `IsDead` check (only `!exists`), weapon state via `gs.weaponStates` map (not `player.Weapon`). |
| 1.0.3 | 2026-02-16 | Added 6 missing specs to folder tree: `server-architecture.md`, `ui.md`, `graphics.md`, `audio.md`, `test-index.md`, `spec-of-specs-plan.md`. |

---

*This specification provides the foundational context for understanding Stick Rumble's architecture. All other specs build upon the patterns and decisions documented here.*
