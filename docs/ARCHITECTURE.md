# Architecture

This document describes the system architecture of Stick Rumble, a real-time multiplayer arena shooter with a server-authoritative design.

## System Overview

```mermaid
flowchart TB
    subgraph Client["Client (Browser)"]
        Phaser["PhaserJS 3\nGame Engine"]
        React["React 19\nUI Layer"]
        WS_Client["WebSocket\nClient"]
        Prediction["Client-Side\nPrediction"]
    end

    subgraph Server["Server (Go)"]
        WS_Handler["WebSocket\nHandler"]
        GameServer["Game Server\n(60Hz tick)"]
        Physics["Physics\nEngine"]
        RoomManager["Room\nManager"]
        Broadcast["Broadcast\nHelper"]
    end

    subgraph Shared["Shared"]
        Schema["TypeBox\nSchemas"]
        JSON["Generated\nJSON Schema"]
    end

    Client <-->|"WebSocket\nJSON Messages"| Server
    Schema --> WS_Client
    Schema --> JSON
    JSON --> WS_Handler
```

## Server-Authoritative Model

All game state is computed on the server. Clients are "dumb terminals" that:
1. Send inputs (WASD, mouse position, shoot requests)
2. Receive authoritative state updates
3. Render what the server tells them

This prevents cheating—clients cannot lie about their position, health, or damage dealt.

```mermaid
sequenceDiagram
    participant C as Client
    participant S as Server
    participant W as World State

    C->>S: input:state {w: true, a: false, ...}
    S->>W: Apply movement physics
    W->>S: New player position
    S->>C: player:move {players: [...]}

    C->>S: player:shoot {rotation: 1.57}
    S->>W: Validate cooldown, ammo
    alt Shoot allowed
        W->>S: Create projectile
        S->>C: projectile:spawn {...}
    else Shoot denied
        S->>C: shoot:failed {reason: "cooldown"}
    end
```

## Data Flow

### Game Loop (Server)

The server runs a 60Hz physics tick loop and broadcasts player state at 20Hz:

```mermaid
flowchart LR
    subgraph Tick["Every 16.67ms (60Hz)"]
        Input["Process\nInputs"]
        Physics["Update\nPhysics"]
        Collision["Check\nCollisions"]
        Projectiles["Update\nProjectiles"]
    end

    subgraph Broadcast["Every 50ms (20Hz)"]
        Gather["Gather\nPlayer States"]
        Send["Broadcast\nto Clients"]
    end

    Input --> Physics --> Collision --> Projectiles
    Projectiles -.-> Gather --> Send
```

### Message Flow

```mermaid
flowchart TD
    subgraph "Client → Server"
        IS["input:state\n(WASD + mouse)"]
        PS["player:shoot"]
        PR["player:reload"]
        WP["weapon:pickup_attempt"]
    end

    subgraph "Server → Client"
        RJ["room:joined"]
        PM["player:move"]
        PSp["projectile:spawn"]
        PD["projectile:destroy"]
        WS["weapon:state"]
        SF["shoot:failed"]
        PDmg["player:damaged"]
        HC["hit:confirmed"]
        PDeath["player:death"]
        PKill["player:kill_credit"]
        PRespawn["player:respawn"]
        MT["match:timer"]
        ME["match:ended"]
        WSp["weapon:spawned"]
        WPick["weapon:pickup_confirmed"]
        WResp["weapon:respawned"]
    end
```

## Component Architecture

### Client Components

```mermaid
flowchart TB
    subgraph GameScene["GameScene (Phaser)"]
        direction TB
        PlayerManager["PlayerManager\n- Local player\n- Remote players"]
        ProjectileManager["ProjectileManager\n- Spawn/destroy\n- Visual only"]
        WeaponCrateManager["WeaponCrateManager\n- Pickup prompts"]
        InputManager["InputManager\n- WASD state\n- Mouse tracking"]
        ShootingManager["ShootingManager\n- Fire rate control"]
    end

    subgraph UI["UI Layer"]
        HealthBarUI["HealthBarUI"]
        KillFeedUI["KillFeedUI"]
        MatchTimerUI["MatchTimerUI"]
        DodgeRollUI["DodgeRollCooldownUI"]
    end

    subgraph Network["Network"]
        WebSocketClient["WebSocketClient\n- Reconnect logic\n- Message handlers"]
    end

    WebSocketClient --> GameScene
    GameScene --> UI
```

### Server Components

```mermaid
flowchart TB
    subgraph Handler["WebSocket Handler"]
        Upgrade["HTTP → WS\nUpgrade"]
        MessageProcessor["Message\nProcessor"]
        BroadcastHelper["Broadcast\nHelper"]
    end

    subgraph Game["Game Package"]
        GameServer["GameServer\n- 60Hz tick loop\n- State management"]
        World["World\n- Player positions\n- Spawn points"]
        Physics["Physics\n- Movement\n- Collision"]
        ProjectileManager_S["ProjectileManager"]
        WeaponCrateManager_S["WeaponCrateManager"]
    end

    subgraph Rooms["Room Management"]
        RoomManager["RoomManager\n- Create/join rooms\n- Player assignment"]
        Room["Room\n- 8 players max\n- Match state"]
        Match["Match\n- Kill tracking\n- Timer"]
    end

    Handler --> Game
    Game --> Rooms
```

## WebSocket Protocol

### Message Format

All messages follow this structure:

```typescript
interface Message {
  type: string;      // e.g., "player:move", "input:state"
  timestamp: number; // Unix milliseconds
  data?: unknown;    // Type-specific payload
}
```

### Schema Validation

Schemas are defined in TypeScript using TypeBox, then compiled to JSON Schema for Go validation:

```mermaid
flowchart LR
    TS["TypeBox\nSchemas"]
    Build["Build\nScript"]
    JSON["JSON\nSchema"]
    GoValid["Go\nValidator"]
    TSType["TypeScript\nTypes"]

    TS --> Build
    Build --> JSON
    Build --> TSType
    JSON --> GoValid
    TSType --> Client
    GoValid --> Server
```

### Message Types

| Direction | Type | Purpose |
|-----------|------|---------|
| C→S | `input:state` | WASD input + mouse position |
| C→S | `player:shoot` | Fire weapon request |
| C→S | `player:reload` | Reload weapon request |
| C→S | `weapon:pickup_attempt` | Pick up weapon crate |
| S→C | `room:joined` | Player assigned to room |
| S→C | `player:move` | All player positions (20Hz) |
| S→C | `projectile:spawn` | New projectile created |
| S→C | `projectile:destroy` | Projectile removed |
| S→C | `weapon:state` | Ammo count, reload status |
| S→C | `shoot:failed` | Why shoot was rejected |
| S→C | `player:damaged` | Health reduced |
| S→C | `hit:confirmed` | You hit someone |
| S→C | `player:death` | Player died |
| S→C | `player:kill_credit` | You killed someone |
| S→C | `player:respawn` | Player respawned |
| S→C | `match:timer` | Time remaining |
| S→C | `match:ended` | Match results |
| S→C | `weapon:spawned` | Weapon crate appeared |
| S→C | `weapon:pickup_confirmed` | Pickup successful |
| S→C | `weapon:respawned` | Crate respawned |

## Room Management

Players are automatically assigned to rooms:

```mermaid
stateDiagram-v2
    [*] --> Waiting: Connect
    Waiting --> InRoom: 2+ players
    InRoom --> Playing: Match starts
    Playing --> Ended: Kill limit or time
    Ended --> Playing: Rematch
    InRoom --> Waiting: Player leaves
    Waiting --> [*]: Disconnect
```

### Room Lifecycle

1. **Connect**: Player establishes WebSocket connection
2. **Waiting**: Player waits for opponents (room needs 2+ players)
3. **Room Created**: RoomManager creates room, assigns players
4. **Match Active**: GameServer runs physics, broadcasts state
5. **Match End**: Kill limit reached or time expires
6. **Cleanup**: Players removed on disconnect, empty rooms destroyed

## Physics System

The server physics engine handles:

- **Movement**: Velocity-based with friction
- **Collision**: AABB against world boundaries
- **Projectiles**: Ray-based hit detection
- **Spawn Points**: Random selection from predefined positions

```mermaid
flowchart LR
    Input["Input\nVelocity"]
    Friction["Apply\nFriction"]
    Move["Update\nPosition"]
    Bounds["Clamp to\nWorld Bounds"]
    Output["Final\nPosition"]

    Input --> Friction --> Move --> Bounds --> Output
```

## Weapon System

```mermaid
classDiagram
    class WeaponConfig {
        +string type
        +int damage
        +int fireRateMs
        +int magazineSize
        +int reloadTimeMs
        +int projectileSpeed
    }

    class WeaponState {
        +string type
        +int currentAmmo
        +bool isReloading
        +int64 lastFireTime
        +int64 reloadStartTime
    }

    class WeaponCrate {
        +string id
        +Vector2 position
        +string weaponType
        +bool isPickedUp
        +Time respawnTime
    }

    WeaponConfig --> WeaponState : creates
    WeaponCrate --> WeaponState : grants
```

### Available Weapons

| Weapon | Damage | Fire Rate | Magazine | Reload |
|--------|--------|-----------|----------|--------|
| Pistol | 15 | 400ms | 12 | 1500ms |
| Uzi | 10 | 80ms | 30 | 2000ms |
| Shotgun | 8×6 | 800ms | 6 | 2500ms |
| AK47 | 20 | 120ms | 30 | 2500ms |
| Bat | 35 | 500ms | ∞ | - |
| Katana | 50 | 600ms | ∞ | - |

## Error Handling

### Client Reconnection

```mermaid
sequenceDiagram
    participant C as Client
    participant S as Server

    C->>S: Connect
    S--xC: Connection lost

    loop 3 attempts
        C->>S: Reconnect (1s delay)
        alt Success
            S->>C: room:joined
        else Failure
            Note over C: Retry
        end
    end

    Note over C: Show error UI
```

### Graceful Shutdown

Server handles SIGTERM/SIGINT with 30-second timeout:

1. Stop accepting new connections
2. Notify connected clients
3. Wait for in-flight messages
4. Close all connections
5. Exit cleanly
