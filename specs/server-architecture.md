# Server Architecture

> **Spec Version**: 1.1.0
> **Last Updated**: 2026-02-15
> **Depends On**: [overview.md](overview.md), [constants.md](constants.md), [networking.md](networking.md), [rooms.md](rooms.md), [messages.md](messages.md)
> **Depended By**: None (leaf spec)

---

## Overview

The Stick Rumble server is a **server-authoritative** game server written in Go that handles all game logic, physics simulation, and state management. The client is treated as an untrusted display layer—all validation happens server-side to prevent cheating.

**Why Server-Authoritative?**

In competitive multiplayer games, client-side authority enables cheating (speed hacks, wallhacks, damage manipulation). By making the server the single source of truth, we guarantee:
1. **Fair play** - No player can modify their damage, speed, or health
2. **Deterministic simulation** - All players see the same game state
3. **Anti-cheat by design** - Clients can only send inputs, not state changes

The server uses a **dual-loop architecture**: a 60Hz physics tick for accurate simulation and a 20Hz broadcast for network efficiency.

---

## Dependencies

### Technology Dependencies

| Technology | Version | Purpose |
|------------|---------|---------|
| Go | 1.25 | Server language |
| gorilla/websocket | v1.5.3 | WebSocket protocol implementation |
| google/uuid | v1.6.0 | Player and room ID generation |
| kaptinlin/jsonschema | v0.6.6 | Optional message schema validation |
| Standard library | - | net/http, sync, time, context |

### Spec Dependencies

- [overview.md](overview.md) - Architecture philosophy and design patterns
- [constants.md](constants.md) - All game constants (tick rates, speeds, durations)
- [networking.md](networking.md) - WebSocket protocol and message format
- [rooms.md](rooms.md) - Room management and matchmaking logic
- [messages.md](messages.md) - Complete message catalog

---

## Application Structure

```
stick-rumble-server/
├── cmd/
│   └── server/
│       └── main.go           # Entry point, HTTP server, graceful shutdown
└── internal/
    ├── game/
    │   ├── clock.go           # Time abstraction for testing
    │   ├── constants.go       # Game constants
    │   ├── gameserver.go      # Dual-loop game engine
    │   ├── match.go           # Match lifecycle and win conditions
    │   ├── melee_attack.go    # Melee hit detection
    │   ├── physics.go         # Movement and collision
    │   ├── ping_tracker.go    # [NEW] RTT measurement (circular buffer of 5)
    │   ├── player.go          # PlayerState and InputState
    │   ├── position_history.go # [NEW] Position rewind buffer for lag compensation
    │   ├── projectile.go      # Projectile lifecycle
    │   ├── ranged_attack.go   # Ranged attack processing
    │   ├── room.go            # Room and RoomManager
    │   ├── weapon.go          # Weapon and WeaponState
    │   ├── weapon_config.go   # Weapon stat loading
    │   ├── weapon_crate.go    # Weapon spawn management
    │   ├── weapon_factory.go  # [NEW] Weapon creation factory
    │   └── world.go           # World state and spawn points
    └── network/
        ├── broadcast_helper.go     # Message broadcast with delta compression
        ├── delta_tracker.go        # [NEW] Per-client delta compression state
        ├── message_processor.go    # Message routing and handlers
        ├── network_simulator.go    # [NEW] Artificial latency/packet loss
        ├── schema_loader.go        # JSON schema loading
        ├── schema_validator.go     # Optional message validation
        └── websocket_handler.go    # WebSocket connection lifecycle + ping/pong
```

**Why This Structure?**

- **`cmd/`** contains only application entry points—no business logic
- **`internal/`** prevents external packages from importing our code (Go convention)
- **`game/`** encapsulates all game logic, making it testable without network dependencies
- **`network/`** handles WebSocket I/O, keeping protocol details separate from game rules
- This separation enables testing game logic with mock clocks and injected broadcasts

---

## Data Structures

### GameServer

The central orchestrator that runs the game simulation.

**Go:**
```go
type GameServer struct {
    world              *World
    physics            *Physics
    projectileManager  *ProjectileManager
    weaponCrateManager *WeaponCrateManager
    weaponStates       map[string]*WeaponState  // playerID → weapon
    weaponMu           sync.RWMutex             // Protects weaponStates
    positionHistory    *PositionHistory          // Position history for lag compensation
    tickRate           time.Duration             // 16.67ms (60Hz)
    updateRate         time.Duration             // 50ms (20Hz)
    clock              Clock                     // Injectable for testing

    broadcastFunc func(playerStates []PlayerStateSnapshot)  // Injected for decoupling

    // Event callbacks for network layer
    onReloadComplete func(playerID string)
    onHit            func(hit HitEvent)
    getRTT           func(playerID string) int64
    onRespawn        func(playerID string, position Vector2)
    onMatchTimer     func(roomID string, remainingSeconds int)
    onCheckTimeLimit func()
    onWeaponPickup   func(playerID, crateID, weaponType string, respawnTime time.Time)
    onWeaponRespawn  func(crate *WeaponCrate)
    onRollEnd        func(playerID string, reason string)

    running bool
    mu      sync.RWMutex
    wg      sync.WaitGroup
}
```

**Why Callbacks?**

The GameServer is decoupled from network code via callbacks. This allows:
1. Unit testing game logic without WebSocket dependencies
2. Swapping network implementations (e.g., for load testing)
3. Clear separation of concerns

### WebSocketHandler

Manages WebSocket connections and routes messages to the game server.

**Go:**
```go
type WebSocketHandler struct {
    roomManager       *RoomManager
    gameServer        *GameServer
    timerInterval     time.Duration      // 1s for match timer broadcasts
    validator         *SchemaValidator   // Incoming message validation
    outgoingValidator *SchemaValidator   // Outgoing message validation
    deltaTracker      *DeltaTracker      // Per-client delta compression state
    networkSimulator  *NetworkSimulator  // Artificial latency/packet loss (testing)
}

type Message struct {
    Type      string `json:"type"`
    Timestamp int64  `json:"timestamp"`
    Data      any    `json:"data,omitempty"`
}
```

**Why Singleton Handler?**

All WebSocket connections share a single handler instance to ensure:
1. All connections share the same RoomManager (matchmaking state)
2. All connections share the same GameServer (physics simulation)
3. Global broadcasts reach all players correctly

### World

Central state container for all players.

**Go:**
```go
type World struct {
    players map[string]*PlayerState  // playerID → state
    clock   Clock                    // Injectable for testing
    rng     *rand.Rand              // For spawn point randomization

    mu    sync.RWMutex  // Protects players map
    rngMu sync.Mutex    // Protects rand.Rand (not thread-safe)
}
```

**Why Separate RNG Mutex?**

Go's `rand.Rand` is not thread-safe. Using a separate mutex for RNG operations:
1. Avoids holding the main lock during random number generation
2. Allows concurrent reads of player state while generating spawn points
3. Follows Go's pattern of fine-grained locking

---

## Game Loop

The server runs two independent loops for different purposes.

### Tick Loop (60Hz)

**Purpose**: Physics simulation, collision detection, game state updates

**Interval**: 16.67ms (1/60th of a second)

**Pseudocode:**
```
function tickLoop(ctx):
    ticker = NewTicker(16.67ms)
    for:
        select:
            case <- ctx.Done():
                return  // Shutdown signal
            case now <- ticker.C:
                deltaTime = now - lastTick  // Real elapsed, not fixed 16.67ms
                lastTick = now

                // 1. Update all player positions
                for player in world.players:
                    if player.isAlive:
                        physics.UpdatePlayer(player, deltaTime)

                // 2. Update all projectiles
                for projectile in projectileManager:
                    projectile.Update(deltaTime)
                    if projectile.IsExpired() or projectile.IsOutOfBounds():
                        projectileManager.Remove(projectile)

                // 3. Check projectile-player collisions
                hits = physics.CheckAllProjectileCollisions()
                for hit in hits:
                    applyDamage(hit.victimID, hit.damage, hit.attackerID)
                    projectileManager.Remove(hit.projectileID)

                // 4. Check reload completions
                for playerID, weaponState in weaponStates:
                    if weaponState.CheckReloadComplete():
                        onReloadComplete(playerID, weaponState)

                // 5. Check respawns
                for player in world.players:
                    if player.ShouldRespawn():
                        player.Respawn()
                        onRespawn(player.ID, player.Position, player.Health)

                // 6. Check dodge roll durations
                for player in world.players:
                    if player.IsRollComplete():
                        player.EndDodgeRoll()
                        onRollEnd(player.ID, "completed")

                // 7. Update invulnerability
                for player in world.players:
                    player.UpdateInvulnerability()

                // 8. Update health regeneration
                for player in world.players:
                    player.UpdateHealthRegen(deltaTime)

                // 9. Check weapon crate respawns
                for crate in weaponCrateManager:
                    if crate.ShouldRespawn():
                        crate.Respawn()
                        onWeaponRespawn(crate.ID, crate.WeaponType, crate.Position)
```

**Go:**
```go
func (gs *GameServer) runTickLoop(ctx context.Context) {
    defer gs.wg.Done()
    ticker := time.NewTicker(gs.tickRate)
    defer ticker.Stop()

    for {
        select {
        case <-ctx.Done():
            return
        case <-ticker.C:
            gs.tick()
        }
    }
}

// Note: No separate tick() method — logic is inline in runTickLoop
// deltaTime uses real elapsed time, not fixed from tickRate
case now := <-ticker.C:
    deltaTime := now.Sub(lastTick).Seconds()
    lastTick = now

    // Update physics for all players
    gs.world.ForEachPlayer(func(p *PlayerState) {
        gs.physics.UpdatePlayer(p, deltaTime)
    })

    // Update projectiles and check collisions
    gs.projectileManager.Update(deltaTime)
    hits := gs.physics.CheckAllProjectileCollisions(
        gs.projectileManager.GetAll(),
        gs.world.GetAllPlayers(),
    )
    for _, hit := range hits {
        gs.processHit(hit)
    }

    // Check reload completions
    gs.mu.RLock()
    for playerID, ws := range gs.weaponStates {
        if ws.CheckReloadComplete() && gs.onReloadComplete != nil {
            gs.onReloadComplete(playerID, *ws)
        }
    }
    gs.mu.RUnlock()

    // Check respawns
    gs.world.ForEachPlayer(func(p *PlayerState) {
        if p.ShouldRespawn() {
            p.Respawn()
            if gs.onRespawn != nil {
                gs.onRespawn(p.GetID(), p.GetPosition(), p.GetHealth())
            }
        }
    })

    // Check dodge roll completions
    gs.checkRollDurations()

    // Update invulnerability and health regen
    gs.world.ForEachPlayer(func(p *PlayerState) {
        p.UpdateInvulnerability()
        p.UpdateHealthRegen(deltaTime)
    })

    // Check weapon crate respawns
    gs.weaponCrateManager.CheckRespawns(gs.onWeaponRespawn)
}
```

**Why 60Hz?**

- **Physics accuracy**: Lower tick rates cause "tunneling" (fast projectiles passing through players)
- **Input responsiveness**: 16.67ms maximum input latency before processing
- **Industry standard**: Most competitive shooters use 60-128Hz server tick
- **CPU budget**: 60Hz is achievable on modest server hardware

### Broadcast Loop (20Hz)

**Purpose**: Send player state updates to all clients

**Interval**: 50ms (20 times per second)

**Pseudocode:**
```
function broadcastLoop(ctx):
    ticker = NewTicker(50ms)
    for:
        select:
            case <- ctx.Done():
                return  // Shutdown signal
            case <- ticker.C:
                states = world.GetAllPlayerStates()
                broadcastFunc(states)  // Send to network layer
```

**Go:**
```go
func (gs *GameServer) runBroadcastLoop(ctx context.Context) {
    defer gs.wg.Done()
    ticker := time.NewTicker(gs.updateRate)
    defer ticker.Stop()

    for {
        select {
        case <-ctx.Done():
            return
        case <-ticker.C:
            states := gs.world.GetAllPlayerStates()
            if gs.broadcastFunc != nil {
                gs.broadcastFunc(states)
            }
        }
    }
}
```

**Why 20Hz (not 60Hz)?**

- **Bandwidth**: 20 updates/second × 8 players × ~100 bytes = 16KB/s (acceptable)
- **Interpolation**: Clients interpolate between updates for smooth visuals
- **Latency tolerance**: 50ms update interval is imperceptible with interpolation
- **Server CPU**: Broadcasting is I/O-bound; 20Hz reduces context switches

**Why Separate Loops?**

Decoupling physics (60Hz) from networking (20Hz):
1. Physics runs at high frequency for accuracy without network overhead
2. Network broadcasts are batched for efficiency
3. Either rate can be tuned independently
4. Testing can mock broadcasts without affecting physics

---

## Message Processing

### Message Routing

When a WebSocket message arrives, it's routed by type:

**Go:**
```go
func (h *WebSocketHandler) handleMessage(msg Message, playerID string) {
    switch msg.Type {
    case "input:state":
        h.handleInputState(msg, playerID)
    case "player:shoot":
        h.handlePlayerShoot(msg, playerID)
    case "player:reload":
        h.handlePlayerReload(msg, playerID)
    case "weapon:pickup_attempt":
        h.handleWeaponPickup(msg, playerID)
    case "player:dodge_roll":
        h.handlePlayerDodgeRoll(msg, playerID)
    case "player:melee_attack":
        h.handlePlayerMeleeAttack(msg, playerID)
    default:
        log.Printf("Unknown message type: %s", msg.Type)
    }
}
```

### Message Handlers

Each message type has a dedicated handler that validates input and calls GameServer methods:

**Example: handleInputState**

**Go:**
```go
func (h *WebSocketHandler) handleInputState(playerID string, data any) {
    // 1. Reject input if match has ended
    room := h.roomManager.GetRoomByPlayerID(playerID)
    if room != nil && room.Match.IsEnded() {
        return
    }

    // 2. Validate data against JSON schema (returns early on failure)
    if err := h.validator.Validate("input-state-data", data); err != nil {
        log.Printf("Schema validation failed for input:state from %s: %v", playerID, err)
        return
    }

    // 3. Direct type assertions (no helper functions — schema validation guarantees types)
    dataMap := data.(map[string]interface{})

    input := game.InputState{
        Up:          dataMap["up"].(bool),
        Down:        dataMap["down"].(bool),
        Left:        dataMap["left"].(bool),
        Right:       dataMap["right"].(bool),
        AimAngle:    dataMap["aimAngle"].(float64),
        IsSprinting: dataMap["isSprinting"].(bool),
    }

    // 4. Extract sequence number (optional, for client-side prediction reconciliation)
    var sequence uint64
    if seqFloat, ok := dataMap["sequence"].(float64); ok {
        sequence = uint64(seqFloat)
    }

    // 5. Update game server with input and sequence
    success := h.gameServer.UpdatePlayerInputWithSequence(playerID, input, sequence)
    if !success {
        log.Printf("Failed to update input for player %s", playerID)
    }
}
```

**Example: handlePlayerShoot**

**Go:**
```go
func (h *WebSocketHandler) handlePlayerShoot(msg Message, playerID string) {
    data, ok := msg.Data.(map[string]interface{})
    if !ok {
        return
    }

    aimAngle := getFloat64(data, "aimAngle")
    clientTimestamp := getInt64(data, "clientTimestamp")

    // Attempt shoot via game server (clientTimestamp used for lag compensation)
    result := h.gameServer.PlayerShoot(playerID, aimAngle, clientTimestamp)

    if result.Success {
        // Broadcast projectile spawn to all players
        h.broadcastProjectileSpawn(result.Projectile)
        // Send updated weapon state to shooter
        h.sendWeaponState(playerID, result.WeaponState)
    } else {
        // Send failure reason to shooter only
        h.sendShootFailed(playerID, result.Reason)
    }
}
```

### Event Callbacks

The network layer registers callbacks with GameServer directly in the constructor (`websocket_handler.go:74-90`), passing method references rather than wrapping in anonymous functions:

**Go:**
```go
// In NewWebSocketHandler() constructor — not a separate setupCallbacks() method
handler.gameServer.SetOnReloadComplete(handler.onReloadComplete)
handler.gameServer.SetOnHit(handler.onHit)
handler.gameServer.SetOnRespawn(handler.onRespawn)
handler.gameServer.SetOnWeaponRespawn(handler.onWeaponRespawn)
handler.gameServer.SetOnRollEnd(handler.broadcastRollEnd)
handler.gameServer.SetGetRTT(handler.getPlayerRTT)
```

**Why Callbacks (Not Direct Calls)?**

1. **Testability**: GameServer tests can use mock callbacks
2. **Decoupling**: Game logic doesn't import network package
3. **Flexibility**: Multiple listeners possible (e.g., logging, analytics)

---

## Concurrency Model

### Goroutine Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Main Goroutine                         │
│  - HTTP server (ListenAndServe)                            │
│  - Signal handling (SIGTERM/SIGINT)                        │
└─────────────────────────────────────────────────────────────┘
         │
         ├──────────────────┬──────────────────┬───────────────┐
         ▼                  ▼                  ▼               │
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐   │
│  Tick Loop      │ │ Broadcast Loop  │ │ Timer Loop      │   │
│  (60Hz)         │ │ (20Hz)          │ │ (1Hz)           │   │
│  - Physics      │ │ - Player states │ │ - Match timer   │   │
│  - Collisions   │ │ - Batch send    │ │ - Time limit    │   │
│  - Respawns     │ │                 │ │                 │   │
└─────────────────┘ └─────────────────┘ └─────────────────┘   │
                                                               │
         ┌─────────────────────────────────────────────────────┘
         │ (Per WebSocket connection)
         ▼
┌─────────────────────────────────────────────────────────────┐
│                    Connection Goroutines                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ Conn 1 Read │  │ Conn 2 Read │  │ Conn N Read │  ...    │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘         │
│         ▼                ▼                ▼                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ Conn 1 Send │  │ Conn 2 Send │  │ Conn N Send │  ...    │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

### Synchronization Primitives

| Primitive | Location | Protects | Why This Type |
|-----------|----------|----------|---------------|
| `sync.RWMutex` | World | players map | Read-heavy (broadcasts read, mutations write) |
| `sync.RWMutex` | GameServer | weaponStates | Read-heavy (tick reads, shoots write) |
| `sync.RWMutex` | Room | Players list | Read-heavy (broadcasts read, join/leave write) |
| `sync.RWMutex` | RoomManager | rooms map | Read-heavy (lookups read, create/destroy write) |
| `sync.RWMutex` | ProjectileManager | projectiles | Read-heavy (collision reads, spawn/destroy write) |
| `sync.RWMutex` | Match | State, PlayerKills | Read-heavy (timer reads, kills write) |
| `sync.Mutex` | World.rngMu | rand.Rand | rand.Rand is not thread-safe |
| Channel | Player.SendChan | Message queue | Non-blocking I/O, 256-message buffer |

**Why RWMutex Everywhere?**

The game loop is read-heavy:
- **60 reads/second**: Tick loop reads all player states
- **20 reads/second**: Broadcast loop reads all player states
- **~1 write/second**: Player inputs arrive ~60Hz but only change state

RWMutex allows multiple concurrent reads while blocking writes.

### Channel Design

Each player has a buffered send channel:

**Go:**
```go
type Player struct {
    ID       string
    SendChan chan []byte  // 256-message buffer
}

// Non-blocking send (prevents slowdown from one slow client)
func (p *Player) Send(msg []byte) bool {
    select {
    case p.SendChan <- msg:
        return true
    default:
        // Channel full - message dropped
        return false
    }
}
```

**Why 256-Message Buffer?**

- **Burst tolerance**: During combat, many messages fire rapidly
- **Backpressure**: If buffer fills, slow clients drop messages (better than blocking)
- **Memory bound**: 256 × ~100 bytes × 8 players = ~200KB (acceptable)

### Deadlock Prevention

**Pattern 1: No Nested Locks**
```go
// WRONG - Can deadlock if called from within world lock
func (w *World) SomeMethod() {
    w.mu.Lock()
    room.mu.Lock()  // Dangerous!
    // ...
}

// RIGHT - Acquire locks in consistent order
func (w *World) SomeMethod() {
    w.mu.Lock()
    // ... do world work
    w.mu.Unlock()

    room.mu.Lock()
    // ... do room work
    room.mu.Unlock()
}
```

**Pattern 2: Recover from Channel Panics**
```go
func (r *Room) Broadcast(msg []byte) {
    r.mu.RLock()
    defer r.mu.RUnlock()

    for _, player := range r.Players {
        func() {
            defer func() {
                if r := recover(); r != nil {
                    // Channel was closed - player disconnected
                    log.Printf("Send failed to player %s", player.ID)
                }
            }()
            player.SendChan <- msg
        }()
    }
}
```

---

## Graceful Shutdown

The server handles SIGTERM and SIGINT for clean shutdown.

**Pseudocode:**
```
function main():
    ctx, cancel = context.WithCancel(context.Background())

    // Start shutdown listener
    go func():
        signals = waitForSignal(SIGTERM, SIGINT)
        log.Print("Shutdown signal received")
        cancel()  // Trigger shutdown

    // Start game loops
    gameServer.Start(ctx)

    // Start HTTP server
    server.ListenAndServe()

    // Wait for shutdown
    <- ctx.Done()

    // Graceful shutdown with timeout
    shutdownCtx, _ = context.WithTimeout(context.Background(), 30s)
    server.Shutdown(shutdownCtx)

    // Wait for game loops to finish
    gameServer.Stop()
```

**Go:**
```go
func main() {
    ctx, cancel := context.WithCancel(context.Background())

    // Signal handling
    sigChan := make(chan os.Signal, 1)
    signal.Notify(sigChan, syscall.SIGTERM, syscall.SIGINT)

    go func() {
        sig := <-sigChan
        log.Printf("Received signal: %v", sig)
        cancel()
    }()

    // Initialize components
    handler := network.NewWebSocketHandler()
    handler.GameServer.Start(ctx)

    // HTTP server
    server := &http.Server{
        Addr:         ":" + getPort(),
        ReadTimeout:  15 * time.Second,
        WriteTimeout: 15 * time.Second,
        IdleTimeout:  60 * time.Second,
    }

    http.HandleFunc("/ws", handler.HandleWebSocket)
    http.HandleFunc("/health", healthHandler)

    // Start server in goroutine
    go func() {
        if err := server.ListenAndServe(); err != http.ErrServerClosed {
            log.Fatal(err)
        }
    }()

    // Wait for shutdown signal
    <-ctx.Done()

    // Graceful shutdown
    shutdownCtx, shutdownCancel := context.WithTimeout(
        context.Background(),
        30*time.Second,
    )
    defer shutdownCancel()

    server.Shutdown(shutdownCtx)
    handler.GameServer.Stop()

    log.Println("Server stopped gracefully")
}
```

**Why 30-Second Timeout?**

- **Match completion**: Allows in-progress matches to end naturally
- **Client notification**: Gives time to send disconnect messages
- **Resource cleanup**: Ensures all goroutines finish
- **Industry standard**: Kubernetes default grace period is 30s

---

## Error Handling

### Schema Validation Errors

**Handling**: Log and continue (non-blocking)

```go
if err := h.validator.Validate(schemaName, msg.Data); err != nil {
    log.Printf("[WARN] Schema validation failed for %s: %v", schemaName, err)
    // Continue processing - validation is advisory in production
}
```

**Why Non-Blocking?**

- Schema validation catches bugs during development
- In production, slightly malformed messages shouldn't crash the game
- Logging allows debugging without service interruption

### Channel Full

**Handling**: Drop message, log warning

```go
select {
case player.SendChan <- msg:
    // Success
default:
    log.Printf("[WARN] Send buffer full for player %s, dropping message", player.ID)
}
```

**Why Drop (Not Block)?**

- One slow client shouldn't affect other players
- Better to skip a position update than freeze the game loop
- Client interpolation masks occasional dropped updates

### Closed Channel

**Handling**: Recover from panic

```go
defer func() {
    if r := recover(); r != nil {
        // Player disconnected between check and send
        log.Printf("[INFO] Player %s disconnected during send", player.ID)
    }
}()
player.SendChan <- msg
```

**Why Recover (Not Check)?**

- Race condition: channel can close between nil check and send
- Recover handles all edge cases safely
- Alternative (mutex around send) adds unnecessary overhead

### Player Not Found

**Handling**: Silent return

```go
player := world.GetPlayer(playerID)
if player == nil {
    return  // Player disconnected, nothing to do
}
```

**Why Silent?**

- Common in racing scenarios (disconnect during message processing)
- Not an error—normal gameplay condition
- Logging would spam during player disconnects

### Invalid Data (NaN/Inf)

**Handling**: Sanitize to safe defaults via `sanitizeVector2` in `physics.go`

```go
// sanitizeVector2 ensures a Vector2 contains no NaN or Inf values
// If NaN or Inf is detected, it's replaced with 0 and logged as an error
func sanitizeVector2(v Vector2, context string) Vector2 {
    result := v
    sanitized := false

    if math.IsNaN(v.X) || math.IsInf(v.X, 0) {
        log.Printf("ERROR: %s contains invalid X value: %v, replacing with 0", context, v.X)
        result.X = 0
        sanitized = true
    }
    if math.IsNaN(v.Y) || math.IsInf(v.Y, 0) {
        log.Printf("ERROR: %s contains invalid Y value: %v, replacing with 0", context, v.Y)
        result.Y = 0
        sanitized = true
    }

    if sanitized {
        log.Printf("WARNING: %s sanitized from %+v to %+v", context, v, result)
    }

    return result
}
```

This function is called in `UpdatePlayer` for both velocity and position sanitization. The broadcast layer (`broadcast_helper.go`) also independently sanitizes `aimAngle` NaN/Inf values to 0 before JSON marshaling.

**Why Sanitize (Not Reject)?**

- NaN can propagate from physics calculations
- Rejecting would cause visible player teleportation
- Sanitizing maintains game continuity
- Logged as ERROR for debugging

---

## Lag Compensation Subsystem (Epic 4)

These components work together to ensure fair hit detection despite client latency.

### PingTracker (`game/ping_tracker.go`)

Measures per-player RTT using WebSocket ping/pong frames.

- Circular buffer of 5 RTT measurements
- `RecordRTT(rtt)` stores millisecond-precision measurements
- `GetRTT()` returns moving average of all recorded samples
- Ping sent every 2 seconds from `websocket_handler.go`

### PositionHistory (`game/position_history.go`)

Maintains 1-second rewind buffer for server-side hit detection with lag compensation.

- Per-player circular buffer of 60 snapshots (1 second at 60Hz)
- `RecordSnapshot(playerID, position, timestamp)` called each physics tick
- `GetPositionAt(playerID, queryTime)` returns position at any past time
- Linear interpolation between snapshots when exact timestamp doesn't exist
- Returns `(Vector2{}, false)` if data is too old or too new

### DeltaTracker (`network/delta_tracker.go`)

Per-client delta compression state to reduce bandwidth.

- Tracks last-sent state per client (players, projectiles, weapon crates)
- Change detection thresholds: 0.1px position, 0.1 velocity, 0.01rad rotation
- `ShouldSendSnapshot(clientID)` → true every 1 second
- `ComputePlayerDelta()` → returns only changed players
- `ComputeProjectileDelta()` → returns added/removed projectiles
- Client removed on disconnect via `RemoveClient()`

See [networking.md](networking.md#delta-compression) for wire format details.

### NetworkSimulator (`network/network_simulator.go`)

Artificial network conditions for testing netcode.

- Reads `SIMULATE_LATENCY` (0–300ms) and `SIMULATE_PACKET_LOSS` (0–20%) env vars
- `ShouldDropPacket()` → random check based on loss percentage
- `GetDelay()` → base latency + ±20ms jitter
- `SimulateSend(sendFn)` → wraps message send with delay/drop
- Returns nil if neither env var is set (production default)

### WeaponFactory (`game/weapon_factory.go`)

Centralizes weapon creation with proper configuration.

- Creates weapons from `weapon-configs.json` or hardcoded fallback
- Validates weapon constraints (damage > 0, fire rate > 0, etc.)
- Used by game server when players pick up weapon crates

---

## Implementation Notes

### Clock Abstraction

For deterministic testing, all time operations use an injectable `Clock` interface:

```go
type Clock interface {
    Now() time.Time
    Since(t time.Time) time.Duration
}

type RealClock struct{}

func (RealClock) Now() time.Time {
    return time.Now()
}

func (RealClock) Since(t time.Time) time.Duration {
    return time.Since(t)
}

// For testing
type ManualClock struct {
    current time.Time
    mu      sync.Mutex
}

func (c *ManualClock) Advance(d time.Duration) {
    c.mu.Lock()
    c.current = c.current.Add(d)
    c.mu.Unlock()
}
```

**Usage in Tests:**
```go
func TestRespawnDelay(t *testing.T) {
    clock := NewManualClock(time.Now())
    player := NewPlayerState("test", clock)

    player.Die(clock.Now())
    assert.True(t, player.IsDead())

    // Advance 2 seconds - not enough
    clock.Advance(2 * time.Second)
    assert.False(t, player.ShouldRespawn())

    // Advance 1 more second - should respawn
    clock.Advance(1 * time.Second)
    assert.True(t, player.ShouldRespawn())
}
```

### Broadcast Function Injection

GameServer accepts a broadcast function instead of importing network code:

```go
func NewGameServer(broadcastFunc func([]PlayerState)) *GameServer {
    return &GameServer{
        broadcastFunc: broadcastFunc,
        // ...
    }
}

// In production:
handler := NewWebSocketHandler()
gameServer := NewGameServer(func(states []PlayerState) {
    handler.BroadcastPlayerStates(states)
})

// In tests:
var capturedStates []PlayerState
gameServer := NewGameServer(func(states []PlayerState) {
    capturedStates = states
})
```

### Schema Validation (Development Only)

Enable via environment variable:

```bash
ENABLE_SCHEMA_VALIDATION=true go run cmd/server/main.go
```

**Go:**
```go
func NewSchemaValidator() *SchemaValidator {
    if os.Getenv("ENABLE_SCHEMA_VALIDATION") != "true" {
        return nil  // Disabled in production
    }
    return &SchemaValidator{
        schemas: loadSchemas("events-schema/generated/"),
    }
}
```

**Why Optional?**

- Schema validation has CPU overhead
- Production prioritizes performance
- Development prioritizes correctness
- CI can run with validation enabled

---

## Test Scenarios

### TS-SERVER-001: Game Loop Runs at 60Hz

**Category**: Unit
**Priority**: Critical

**Preconditions:**
- GameServer initialized with 60Hz tick rate
- MockClock for time control

**Input:**
- Start game server
- Advance clock by 100ms

**Expected Output:**
- Exactly 6 ticks executed (100ms / 16.67ms)

**Go:**
```go
func TestTickRate60Hz(t *testing.T) {
    clock := NewManualClock(time.Now())
    tickCount := 0
    gs := NewGameServer(nil)
    gs.SetClock(clock)
    gs.SetTickCallback(func() { tickCount++ })

    ctx, cancel := context.WithCancel(context.Background())
    gs.Start(ctx)

    clock.Advance(100 * time.Millisecond)
    time.Sleep(10 * time.Millisecond)  // Let goroutine process

    cancel()
    gs.Stop()

    assert.Equal(t, 6, tickCount)
}
```

### TS-SERVER-002: Broadcast Loop Runs at 20Hz

**Category**: Unit
**Priority**: Critical

**Preconditions:**
- GameServer initialized with 20Hz update rate
- Mock broadcast function

**Input:**
- Start game server
- Advance clock by 200ms

**Expected Output:**
- Exactly 4 broadcasts (200ms / 50ms)

**Go:**
```go
func TestBroadcastRate20Hz(t *testing.T) {
    broadcastCount := 0
    gs := NewGameServer(func(states []PlayerState) {
        broadcastCount++
    })

    ctx, cancel := context.WithCancel(context.Background())
    gs.Start(ctx)

    time.Sleep(200 * time.Millisecond)

    cancel()
    gs.Stop()

    assert.GreaterOrEqual(t, broadcastCount, 3)
    assert.LessOrEqual(t, broadcastCount, 5)  // Allow timing variance
}
```

### TS-SERVER-003: Physics Updates Each Tick

**Category**: Unit
**Priority**: High

**Preconditions:**
- Player with velocity (100, 0)
- 60Hz tick rate

**Input:**
- Run 1 tick (16.67ms)

**Expected Output:**
- Player position += (100 * 0.01667, 0) ≈ (1.67, 0)

### TS-SERVER-004: Collisions Detected Each Tick

**Category**: Integration
**Priority**: Critical

**Preconditions:**
- Projectile at (100, 100)
- Player hitbox at (90-122, 68-132)

**Input:**
- Run collision check

**Expected Output:**
- Hit detected
- `onHit` callback invoked

### TS-SERVER-005: Messages Routed to Correct Handler

**Category**: Unit
**Priority**: High

**Preconditions:**
- WebSocketHandler initialized
- All message handlers registered

**Input:**
- Message with type "player:shoot"

**Expected Output:**
- `handlePlayerShoot` invoked

### TS-SERVER-006: Concurrent Access is Thread-Safe

**Category**: Integration
**Priority**: Critical

**Preconditions:**
- World with 8 players
- Concurrent goroutines accessing player state

**Input:**
- 100 concurrent reads
- 10 concurrent writes

**Expected Output:**
- No race conditions (run with `-race` flag)
- All operations complete successfully

**Go:**
```go
func TestConcurrentAccess(t *testing.T) {
    world := NewWorld(nil)
    for i := 0; i < 8; i++ {
        world.AddPlayer(fmt.Sprintf("player%d", i))
    }

    var wg sync.WaitGroup

    // 100 concurrent reads
    for i := 0; i < 100; i++ {
        wg.Add(1)
        go func() {
            defer wg.Done()
            _ = world.GetAllPlayerStates()
        }()
    }

    // 10 concurrent writes
    for i := 0; i < 10; i++ {
        wg.Add(1)
        go func(idx int) {
            defer wg.Done()
            world.UpdatePlayerPosition(
                fmt.Sprintf("player%d", idx%8),
                Vector2{X: float64(idx), Y: float64(idx)},
            )
        }(i)
    }

    wg.Wait()  // Should complete without race detector complaints
}
```

### TS-SERVER-007: Graceful Shutdown Completes

**Category**: Integration
**Priority**: High

**Preconditions:**
- Server running with active connections
- Game loops running

**Input:**
- Send SIGTERM

**Expected Output:**
- All connections closed
- All goroutines terminated
- Exit code 0

### TS-SERVER-008: Client Messages Processed

**Category**: Integration
**Priority**: Critical

**Preconditions:**
- WebSocket connection established
- Player in room

**Input:**
- Send `input:state` message

**Expected Output:**
- Player input state updated
- Next tick applies movement

### TS-SERVER-009: Callback Events Fire Correctly

**Category**: Unit
**Priority**: High

**Preconditions:**
- GameServer with all callbacks registered
- Player at 0 health

**Input:**
- Apply damage to player

**Expected Output:**
- `onHit` callback invoked with correct parameters
- Death triggers respawn scheduling

### TS-SERVER-010: Room Isolation Maintained

**Category**: Integration
**Priority**: Critical

**Preconditions:**
- Room A with Players 1, 2
- Room B with Players 3, 4

**Input:**
- Player 1 shoots

**Expected Output:**
- Projectile visible to Players 1, 2 only
- Players 3, 4 receive no projectile message

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-02-02 | Initial specification |
| 1.1.0 | 2026-02-15 | Added Lag Compensation Subsystem section (PingTracker, PositionHistory, DeltaTracker, NetworkSimulator, WeaponFactory). Updated directory tree with 5 new files. Removed non-existent auth/ and db/ dirs. Added deltaTracker and networkSimulator to WebSocketHandler struct. Updated handleInputState with sequence field. Updated handlePlayerShoot with clientTimestamp for lag compensation. |
| 1.1.1 | 2026-02-16 | Fixed GameServer struct — corrected callback signatures to match `gameserver.go:27-72`: `broadcastFunc` takes `[]PlayerStateSnapshot` not `[]PlayerState`, `onReloadComplete` takes only `playerID` (no WeaponState), `onHit` takes `HitEvent` struct not individual params, `onRespawn` has no `health` param, `onWeaponRespawn` takes `*WeaponCrate`. Added missing fields: `weaponMu`, `positionHistory`, `clock`, `getRTT`, `onMatchTimer`, `onCheckTimeLimit`, `onWeaponPickup`. |
| 1.1.2 | 2026-02-16 | Fixed setupCallbacks section — callbacks are registered as method references in the constructor (not a separate `setupCallbacks()` method), added `SetGetRTT` and `SetOnWeaponRespawn` registrations. |
| 1.1.3 | 2026-02-16 | Replaced nonexistent `sanitizePosition` with actual `sanitizeVector2` from `physics.go:208` — NaN/Inf replaced with 0 (not arena center). |
| 1.1.4 | 2026-02-16 | Fixed tick() deltaTime — uses real elapsed `now.Sub(lastTick).Seconds()` not fixed from tickRate. Logic is inline in loop, not separate `tick()` method. |
| 1.1.5 | 2026-02-16 | Fixed handleInputState — correct signature `(playerID string, data any)` not `(msg Message, playerID string)`, direct type assertions instead of `getBool`/`getFloat64`/`getInt` helpers, no NaN/Inf sanitization (schema validation guarantees types), validation returns early on failure (not non-blocking). |
