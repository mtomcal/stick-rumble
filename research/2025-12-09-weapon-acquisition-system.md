---
date: 2025-12-09T12:00:00-08:00
researcher: codebase-researcher-agent
topic: "Weapon Acquisition System Implementation Analysis"
tags: [research, codebase, weapon-system, epic-3, story-3.3A]
status: complete
---

# Research: Weapon Acquisition System Implementation Analysis

**Date**: 2025-12-09
**Researcher**: codebase-researcher-agent
**ReadyQ Issue**: a58bb26d (Story 3.3A - Define Weapon Acquisition System)

## Research Question

How should the weapon acquisition system be implemented in Stick Rumble? What existing systems are in place, and what needs to be created to support fixed weapon crate spawns on the map?

## Summary

The codebase currently has a **complete weapon system** for the Pistol (default spawn weapon) with full client-server synchronization, but **no weapon pickup/spawn system exists**. Players currently spawn with a Pistol and have no way to acquire other weapons. The recommended approach is **Option B: Fixed Weapon Crates** at predetermined map locations with respawn timers.

**Key Findings**:
1. ✅ Weapon data structures exist (server: `Weapon` struct, client: `WEAPON` constants)
2. ✅ Only Pistol is implemented (Bat, Katana, Uzi, AK47, Shotgun defined in docs only)
3. ❌ No spawn system exists (need to create)
4. ❌ No pickup collision detection (need to create)
5. ❌ No weapon switching logic (need to create)
6. ✅ Map structure exists (1920x1080 arena with AABB collision system)
7. ✅ Network synchronization patterns established (`player:shoot`, `weapon:state`)

## Detailed Findings

### 1. Current Weapon System Implementation

#### Server-Side Weapon Structure (`stick-rumble-server/internal/game/weapon.go`)

**Weapon Definition (lines 33-40)**:
```go
type Weapon struct {
    Name            string
    Damage          int
    FireRate        float64       // Rounds per second
    MagazineSize    int           // Rounds per magazine
    ReloadTime      time.Duration // Time to reload
    ProjectileSpeed float64       // Projectile speed in px/s
}
```

**WeaponState Tracking (lines 55-61)**:
```go
type WeaponState struct {
    Weapon          *Weapon
    CurrentAmmo     int
    IsReloading     bool
    LastShotTime    time.Time
    ReloadStartTime time.Time
}
```

**Current Implementation Status**:
- ✅ Only `NewPistol()` factory function exists (line 43-52)
- ❌ No other weapon types implemented (Bat, Katana, Uzi, AK47, Shotgun)
- ❌ No weapon switching capability
- ❌ No weapon type enum/identifier

**Player Weapon Assignment (`stick-rumble-server/internal/game/gameserver.go:183-186`)**:
```go
func (gs *GameServer) AddPlayer(playerID string) *PlayerState {
    player := gs.world.AddPlayer(playerID)
    gs.weaponStates[playerID] = NewWeaponState(NewPistol()) // Everyone starts with pistol
    return player
}
```

#### Client-Side Weapon Constants (`stick-rumble-client/src/shared/constants.ts:59-77`)

```typescript
export const WEAPON = {
  PISTOL_DAMAGE: 25,
  PISTOL_FIRE_RATE: 3,
  PISTOL_MAGAZINE_SIZE: 15,
  PISTOL_RELOAD_TIME: 1500,
  PROJECTILE_SPEED: 800,
  PROJECTILE_MAX_LIFETIME: 1000,
} as const;
```

**Status**:
- ✅ Pistol constants match server (verified in weapon-balance-analysis.md)
- ❌ No other weapon constants defined
- ❌ No weapon type enum

#### Weapon State Synchronization (`stick-rumble-client/src/game/input/ShootingManager.ts`)

**Client tracks weapon state (lines 8-13)**:
```typescript
export interface WeaponState {
  currentAmmo: number;
  maxAmmo: number;
  isReloading: boolean;
  canShoot: boolean;
}
```

**Network messages already defined**:
- `player:shoot` - Client sends when firing (line 63)
- `player:reload` - Client sends when reloading (line 90)
- `weapon:state` - Server sends ammo updates (broadcast_helper.go:137)

### 2. Map & Spawn System Analysis

#### Arena Structure (`stick-rumble-server/internal/game/constants.go:15-22`)

```go
const (
    ArenaWidth = 1920.0   // pixels
    ArenaHeight = 1080.0  // pixels
)
```

**Visual representation (`stick-rumble-client/src/game/scenes/GameScene.ts:43-52`)**:
- Dark gray background (0x222222)
- White border (2px stroke)
- Camera bounds match arena size

#### Player Spawn System (Already Exists)

**Balanced spawn point algorithm (`stick-rumble-server/internal/game/world.go:78-126`)**:
```go
func (w *World) GetBalancedSpawnPoint(excludePlayerID string) Vector2 {
    // Collects enemy positions
    // Tries 10 random candidates
    // Picks location furthest from enemies
    // Includes 100px margin from edges
}
```

**Key insights**:
- ✅ Spawn point logic exists and is sophisticated
- ✅ Respawn system functional (3 second delay, 2 second invulnerability)
- ❌ No weapon spawn point system (need to create)
- ❌ No fixed location spawn mechanics

#### Collision Detection System

**AABB collision exists (`stick-rumble-server/internal/game/physics.go:170-210`)**:
```go
func (p *Physics) CheckProjectilePlayerCollision(proj *Projectile, player *PlayerState) bool {
    // Uses axis-aligned bounding box (AABB)
    // Player hitbox: 32x64 pixels
    // Checks projectile point vs player box
    // Validates range (max 800px)
}
```

**Status**:
- ✅ Projectile-player collision working
- ✅ AABB system can be reused for weapon pickups
- ✅ Physics system handles position/velocity updates
- ❌ No player-object pickup collision (need to create)

### 3. Network/Server Architecture

#### Server-Authoritative Design

**Message flow for shooting (`research/2025-12-07-websocket-event-sequence.md`)**:
1. Client sends `player:shoot` with aim angle
2. Server validates (cooldown, ammo, reload state)
3. Server spawns projectile if valid
4. Server broadcasts `projectile:spawn` to all players
5. Server sends `weapon:state` to shooter (ammo update)

**Hit detection flow**:
1. Server ticks at 60Hz (`gameserver.go:96-136`)
2. Server checks projectile-player collisions (`gameserver.go:354-406`)
3. Server applies damage server-side
4. Server broadcasts `player:damaged` to all
5. Server broadcasts `player:death` if health ≤ 0

**Key principles**:
- ✅ Server is authoritative for all game state
- ✅ Client sends inputs, server validates
- ✅ Server broadcasts results to all clients
- ✅ Client-side prediction for responsiveness (aim indicator)

#### Message Processor Pattern

**Current handler structure (`stick-rumble-server/internal/network/websocket_handler.go:174-178`)**:
```go
case "player:shoot":
    h.handlePlayerShoot(playerID, msg.Data)
case "player:reload":
    h.handlePlayerReload(playerID)
```

**Message processor delegates to handlers (`message_processor.go:42-75`)**:
- `handlePlayerShoot()` - Validates and spawns projectile
- `handlePlayerReload()` - Starts reload process
- `onReloadComplete()` - Callback when reload finishes

**Pattern for weapon pickup**:
```go
// Proposed addition:
case "player:pickup":
    h.handlePlayerPickup(playerID, msg.Data)
```

### 4. Related Systems

#### Player Movement System

**Movement handled by Physics engine (`stick-rumble-server/internal/game/physics.go:18-73`)**:
- Input state: `{Up, Down, Left, Right, AimAngle}` (player.go:14-21)
- Updates at 60Hz server tick rate
- Smooth acceleration/deceleration (50 px/s²)
- Max speed: 200 px/s
- Clamped to arena bounds

**Client-side input (`stick-rumble-client/src/game/input/InputManager.ts`)**:
- WASD keys captured
- Mouse position tracked for aim
- Sends `input:state` to server at 20Hz
- Client-side prediction for smooth movement

#### Game Object Management

**Player rendering (`stick-rumble-client/src/game/entities/PlayerManager.ts`)**:
- Manages Phaser rectangles for players
- Updates positions from server state
- Handles death visual effects (fade to gray)
- Aim indicator rendering (50px line)

**Projectile rendering (`stick-rumble-client/src/game/entities/ProjectileManager.ts`)**:
- Creates visual bullets from server `projectile:spawn`
- Updates client-side based on velocity
- Removes on server `projectile:hit` message
- Visual effects: tracers, muzzle flash

**Pattern for weapon crates**:
- ✅ Similar manager pattern would work
- ✅ Server controls spawn/respawn timing
- ✅ Client renders visual representation
- ❌ No WeaponCrateManager exists (need to create)

### 5. Archived Implementation Reference

#### Pre-BMM Weapon Drop System (`docs/archive/20251125-055521-pre-bmm/game/scenes/MainScene.ts`)

**Old implementation had weapon drops (lines 888-912)**:
```typescript
private spawnWeaponDrop(x: number, y: number, type: WeaponType) {
    const dropKey = `drop_${type}`;
    const drop = this.weaponDrops.create(x, y, dropKey);
    drop.weaponType = type;

    // Visual bobbing animation
    this.tweens.add({
        targets: drop, y: y - 5, yoyo: true, duration: 1000,
        repeat: -1, ease: 'Sine.easeInOut'
    });

    // Glow effect
    const glow = this.add.circle(x, y, 20);
    glow.setStrokeStyle(2, 0xffff00, 0.5);

    // 30 second despawn timer
    this.time.delayedCall(30000, () => { drop.destroy(); });
}
```

**Pickup handler (lines 914-921)**:
```typescript
private handleWeaponPickup(player: any, drop: any) {
    const newWeapon = drop.weaponType as WeaponType;
    this.showDamageNumber(player.x, player.y - 20, 0, false)
        .setText(`Picked up ${newWeapon}`);
    this.setPlayerWeapon(newWeapon);
    drop.destroy();
}
```

**Key insights from old code**:
- ✅ Visual polish: bobbing animation, glow effect
- ✅ 30-second despawn timer
- ✅ Collision-based pickup (Arcade Physics overlap)
- ❌ This was single-player only (not server-authoritative)
- ❌ Drops appeared on enemy death (not fixed spawns)

### 6. Design Document Requirements

#### GDD Weapon Pickup Spec (`docs/GDD.md:197-200`)

```
**Weapon System:**
- **Weapon pickups** - Spawn at fixed map locations, controlling spawns is strategic
- **Limited ammo** - Manual reload required, ammo management tactical
- **Weapon diversity** - Melee (Bat, Katana) and Ranged (Uzi, AK47, Shotgun)
- **Weapon switching** - Instant switch to picked-up weapon, no inventory scrolling
```

#### Epic 3 Story Requirements (`docs/epics.md:742-758`)

**Story 3.3A (Current Task)**:
```
As a player,
I want to pick up weapons from map spawns,
So that I can acquire better weapons during matches.

**Given** a weapon (Uzi) spawned at position {x: 500, y: 600}
**And** I move within pickup radius (32px)
**When** I press interact key (F) or auto-pickup enabled
**Then** weapon pickup:success event sent to server
**And** server validates pickup (distance check, weapon available)
**And** server sends weapon:pickup_confirmed with new weapon data
**And** my current weapon is replaced (dropped at my location if not default pistol)
**And** weapon respawns at the same location after 30 seconds
**And** weapon spawn notification: subtle glow effect on map and minimap
```

**Technical notes from epic**:
- Server tracks weapon state: `{available: true/false, nextRespawn: timestamp}`
- Pickup validation: distance check (Manhattan or Euclidean)
- Each map has 3-5 fixed weapon spawn points defined in map config
- Broadcast weapon pickup to all players for UI updates

#### Weapon Balance Analysis (`docs/weapon-balance-analysis.md:563-578`)

**Question 2: Weapon Pickup System**

Options analyzed:
- **A) Random floor spawns** (battle royale style) - High RNG variance
- **B) Weapon crates at fixed locations** (arena shooter style) - **RECOMMENDED**
- **C) Loadout selection** (pre-match choice) - Players always pick AK47
- **D) Kill rewards** (earn better weapons) - Snowball effect

**Recommendation**: Option B (Fixed Weapon Crates)
- Classic arena shooter design (Quake, Halo, Stick Arena)
- Strategic map control objective
- Predictable weapon locations promote skill
- No RNG frustration

## Code References

### Server-Side
- `stick-rumble-server/internal/game/weapon.go` - Weapon struct, WeaponState, Pistol implementation
- `stick-rumble-server/internal/game/gameserver.go:183-186` - Player weapon initialization
- `stick-rumble-server/internal/game/gameserver.go:239-287` - Shooting logic (PlayerShoot)
- `stick-rumble-server/internal/game/world.go:78-126` - Spawn point system (reusable pattern)
- `stick-rumble-server/internal/game/physics.go:170-210` - AABB collision detection
- `stick-rumble-server/internal/network/message_processor.go:42-75` - Message handling pattern
- `stick-rumble-server/internal/game/constants.go:15-22` - Arena dimensions

### Client-Side
- `stick-rumble-client/src/shared/constants.ts:59-77` - Weapon constants
- `stick-rumble-client/src/game/input/ShootingManager.ts` - Weapon state management
- `stick-rumble-client/src/game/scenes/GameScene.ts:43-52` - Arena rendering
- `stick-rumble-client/src/game/entities/PlayerManager.ts` - Entity management pattern
- `stick-rumble-client/src/game/entities/ProjectileManager.ts` - Projectile rendering pattern

### Reference/Archived
- `docs/archive/20251125-055521-pre-bmm/game/scenes/MainScene.ts:888-921` - Old weapon drop implementation (visual polish reference)
- `docs/GDD.md:197-200` - Weapon system design philosophy
- `docs/epics.md:742-758` - Story 3.3A acceptance criteria
- `docs/weapon-balance-analysis.md:563-578` - Pickup system design analysis

## Architecture Insights

### Pattern: Server-Authoritative Entity Spawning

**Established pattern from projectile system**:
1. Server owns entity state (position, type, active status)
2. Server broadcasts spawn event with entity ID
3. Clients create visual representation
4. Server handles entity lifecycle (spawn, update, despawn)
5. Server broadcasts state changes

**Apply to weapon crates**:
```go
// Server-side
type WeaponCrate struct {
    ID          string
    Position    Vector2
    WeaponType  string    // "uzi", "ak47", "shotgun", etc.
    IsAvailable bool
    RespawnTime time.Time
}

// Broadcast on spawn
type WeaponSpawnMessage struct {
    Type string `json:"type"` // "weapon:spawned"
    Data struct {
        CrateID    string  `json:"crateId"`
        Position   Vector2 `json:"position"`
        WeaponType string  `json:"weaponType"`
    } `json:"data"`
}
```

### Pattern: Collision Detection Reuse

**Existing AABB collision can be adapted**:
```go
// Current: CheckProjectilePlayerCollision
// Adapted: CheckPlayerCrateCollision
func (p *Physics) CheckPlayerCrateCollision(player *PlayerState, crate *WeaponCrate) bool {
    if !crate.IsAvailable {
        return false
    }

    playerPos := player.GetPosition()

    // Check if player center within pickup radius
    dx := crate.Position.X - playerPos.X
    dy := crate.Position.Y - playerPos.Y
    distance := math.Sqrt(dx*dx + dy*dy)

    return distance < PickupRadius // 32px default
}
```

### Pattern: State Synchronization

**weapon:state pattern can be extended**:
```go
// Current: sendWeaponState(playerID) - ammo updates
// Extended: sendWeaponSwitch(playerID, newWeapon)

func (h *WebSocketHandler) handlePlayerPickup(playerID string, crateID string) {
    // 1. Validate pickup (distance, availability)
    // 2. Update player's weapon
    // 3. Mark crate as unavailable
    // 4. Start respawn timer
    // 5. Broadcast pickup to all players
    // 6. Send weapon data to picker
}
```

## Open Questions

### 1. Weapon Type Identification
**Question**: How do we identify weapon types in code?

**Options**:
- A) String constants: `"pistol"`, `"uzi"`, `"ak47"`
- B) Integer enum: `const (WeaponPistol = 0, WeaponUzi = 1, ...)`
- C) Weapon registry: `map[string]*Weapon`

**Recommendation**: Option A (string constants) for:
- JSON serialization simplicity
- Client-server type matching
- Debuggability (readable in logs)

### 2. Weapon Crate Spawn Configuration
**Question**: Where should weapon spawn points be defined?

**Options**:
- A) Hardcoded in World struct
- B) JSON map configuration file
- C) Database table

**Recommendation**: Option A for MVP (hardcoded), then B (JSON) for multi-map support:
```go
var DefaultArenaWeaponSpawns = []WeaponSpawn{
    {Position: Vector2{X: 960, Y: 200}, WeaponType: "uzi"},
    {Position: Vector2{X: 400, Y: 540}, WeaponType: "ak47"},
    {Position: Vector2{X: 1520, Y: 540}, WeaponType: "shotgun"},
}
```

### 3. Weapon Switching: Drop or Replace?
**Question**: When picking up weapon, what happens to current weapon?

**Options**:
- A) Drop current weapon (creates floor loot)
- B) Replace and destroy (no drops)
- C) 2-weapon inventory (swap between two)

**Recommendation**: Option B for MVP (simplest), Option A for v2:
- Pistol: Always destroyed (default weapon)
- Other weapons: Destroyed (no drop clutter)
- Rationale: Reduces server state, simpler collision detection

### 4. Auto-Pickup vs Manual?
**Question**: Should pickups be automatic or require key press?

**Options**:
- A) Auto-pickup on collision
- B) Manual with F key
- C) Configurable setting

**Recommendation**: Option A (auto-pickup):
- Faster paced gameplay
- No extra keybind needed
- Consistent with modern shooters
- Can add delay to prevent spam

### 5. Respawn Timer: Fixed or Variable?
**Question**: Should all weapons respawn at same rate?

**Spec from epic**: 30 seconds

**Options**:
- A) Fixed 30s for all weapons
- B) Weapon-specific (e.g., AK47: 45s, Uzi: 20s)
- C) Dynamic based on usage

**Recommendation**: Option A for MVP (simpler balance), Option B for tuning later

## Web Research: Industry Best Practices

### Arena Shooter Design Patterns (2025)

**Fixed spawn locations remain standard** ([Arena FPS](https://arenafps.com/spawn-protection-ut4/)):
- Weapon control is core strategic element
- Map knowledge creates skill ceiling
- Predictable spawns enable team coordination

**Random spawns debate** ([Quora discussion](https://www.quora.com/Is-the-randomised-spawn-system-still-utilised-in-modern-first-person-shooters-outdated-If-so-what-system-should-be-used-instead?top_ans=99120622)):
- Pure random spawns can be exploited
- Spawn protection systems mitigate abuse
- Balance requires spawn distance from enemies

**Modern implementations** (2025):
- Hybrid systems common (fixed weapon spawns, balanced player spawns)
- Tactical modes: loadouts, no pickups
- Efficiency modes: all weapons at spawn

**Stick Rumble alignment**:
- ✅ Fixed weapon crates match genre expectations
- ✅ Balanced player spawn system already exists
- ✅ 30s respawn timer is genre-standard (Halo: 20-60s, Quake: 15-30s)

## Recommended Implementation Approach

### Phase 1: Core Infrastructure (Story 3.3A)

**Server-side**:
1. Create `WeaponCrate` struct with spawn points
2. Add weapon factory functions (NewUzi, NewAK47, NewShotgun)
3. Implement pickup validation in Physics
4. Add respawn timer system in GameServer
5. Create message handlers for pickup flow

**Client-side**:
1. Create `WeaponCrateManager` (similar to ProjectileManager)
2. Add weapon crate visual rendering (sprite + glow)
3. Handle `weapon:spawned`, `weapon:pickup`, `weapon:respawn` messages
4. Update UI to show picked-up weapon type

**Network protocol**:
```typescript
// Client → Server
{
  type: "weapon:pickup_attempt",
  data: { crateId: "crate_1" }
}

// Server → All clients
{
  type: "weapon:pickup_confirmed",
  data: {
    playerId: "player_123",
    crateId: "crate_1",
    weaponType: "uzi",
    nextRespawn: 1234567890 // Unix timestamp
  }
}

// Server → All clients (30s later)
{
  type: "weapon:respawned",
  data: {
    crateId: "crate_1",
    weaponType: "uzi",
    position: { x: 960, y: 200 }
  }
}
```

### Phase 2: Weapon Diversity (Stories 3.2, 3.3)

1. Implement Bat & Katana (melee weapons)
2. Implement Uzi, AK47, Shotgun (ranged weapons)
3. Add weapon-specific shooting logic (fire rate, damage, spread)
4. Implement damage falloff system (50% range threshold)

### Phase 3: Polish (Story 3.4)

1. Visual effects (pickup animation, respawn glow)
2. Sound effects (pickup sound, weapon switch)
3. UI feedback (weapon name display, ammo counter update)
4. Minimap indicators for weapon spawns

## Conclusion

The weapon acquisition system requires **creating new spawn/pickup infrastructure**, but can leverage existing patterns:
- ✅ Collision detection system (AABB)
- ✅ Network message flow (server-authoritative)
- ✅ Entity management patterns (ProjectileManager)
- ✅ Spawn point algorithms (GetBalancedSpawnPoint)

**Recommended approach**: Fixed weapon crates (Option B) with:
- 3-5 spawn points per map
- 30-second respawn timers
- Auto-pickup on collision
- String-based weapon type identification
- Simple replace (no weapon drops for MVP)

**Development effort estimate**:
- Server: ~400 LOC (WeaponCrate, pickup logic, respawn system)
- Client: ~300 LOC (WeaponCrateManager, visual rendering)
- Testing: ~500 LOC (unit tests, integration tests)
- Total: ~1200 LOC for complete implementation

**Complexity**: Medium (relies on existing patterns, no novel algorithms)

**Risk**: Low (well-understood game mechanic, strong architectural foundation)

---

## Sources

Web research sources:
- [Arena FPS - Spawn Protection Discussion](https://arenafps.com/spawn-protection-ut4/)
- [Quora - Spawn System Design Debate](https://www.quora.com/Is-the-randomised-spawn-system-still-utilised-in-modern-first-person-shooters-outdated-If-so-what-system-should-be-used-instead?top_ans=99120622)
- [Wikipedia - Arena Shooter](https://en.wikipedia.org/wiki/Arena_shooter)
