# Shooting

> **Spec Version**: 1.1.0
> **Last Updated**: 2026-02-15
> **Depends On**: [constants.md](constants.md), [player.md](player.md), [weapons.md](weapons.md), [messages.md](messages.md)
> **Depended By**: [hit-detection.md](hit-detection.md), [client-architecture.md](client-architecture.md), [server-architecture.md](server-architecture.md)

---

## Overview

The shooting system handles all ranged attack mechanics in Stick Rumble. This spec documents the complete lifecycle of a shot: from player input, through server validation, to projectile creation and client notification.

**Why this design?**

The shooting system is **server-authoritative** to prevent cheating. The client sends shoot requests containing only the aim angle - the server validates everything else (ammo, cooldown, reload state). This ensures players cannot exploit client-side hacks to fire faster, have unlimited ammo, or shoot while reloading.

The system uses a **request-response pattern** rather than optimistic client-side projectile creation because:
1. Cheating prevention: only server-validated shots create projectiles
2. Consistency: all players see the same projectiles at the same time
3. Fairness: fire rate enforcement is absolute (60 Hz server tick precision)

---

## Dependencies

### Technology Dependencies

| Technology | Version | Purpose |
|------------|---------|---------|
| Go | 1.25 | Server-side shoot processing and projectile management |
| TypeScript | 5.9.3 | Client-side shoot input and feedback handling |
| gorilla/websocket | v1.5.3 | WebSocket message transport |

### Spec Dependencies

- [constants.md](constants.md) - Fire rate values, projectile speeds, reload times
- [player.md](player.md) - Player state (alive, invulnerable) for validation
- [weapons.md](weapons.md) - Weapon configurations (damage, fire rate, magazine size, recoil)
- [messages.md](messages.md) - Message schemas (`player:shoot`, `projectile:spawn`, `shoot:failed`)

---

## Constants

These shooting-related constants are defined in [constants.md](constants.md):

| Constant | Value | Unit | Description |
|----------|-------|------|-------------|
| `ProjectileMaxLifetime` | 1000 | ms | Time before projectile expires |
| `ProjectileMaxRange` | 800 | px | Maximum distance before expiration |
| `SprintSpreadMultiplier` | 1.5 | - | Spread penalty while sprinting |
| `ServerTickRate` | 60 | Hz | Server physics tick rate |
| `ClientUpdateRate` | 20 | Hz | Network update broadcast rate |

**Why these values?**

- **1-second lifetime**: Matches projectile speed (800 px/s) so projectiles expire at exactly max range
- **800px range**: Roughly half the arena width (1920px), balancing sniping vs close combat
- **60 Hz tick**: Ensures fire rate enforcement at high precision (16.67ms resolution)
- **1.5x sprint penalty**: Movement accuracy tradeoff - sprint for speed, stand for accuracy

---

## Data Structures

### ShootResult (Server)

The result of processing a shoot request.

**Go:**
```go
type ShootResult struct {
    Success    bool        // Whether shot was successful
    Reason     string      // Reason code if failed ("cooldown", "empty", etc.)
    Projectile *Projectile // Created projectile (nil if failed)
}
```

**Why?**

ShootResult bundles all outcomes into a single return value, allowing the caller to handle both success (broadcast projectile) and failure (send shoot:failed) without multiple function calls.

### Projectile (Server)

Represents a fired projectile in the game world.

**Go:**
```go
type Projectile struct {
    ID            string    // Unique identifier (UUID)
    OwnerID       string    // Player who fired it
    WeaponType    string    // Name of weapon that fired it
    Position      Vector2   // Current position in pixels
    Velocity      Vector2   // Movement vector in pixels/second
    SpawnPosition Vector2   // Initial spawn position (for range calculation)
    CreatedAt     time.Time // Spawn timestamp
    Active        bool      // Whether projectile is still in play
}
```

**Why?**

- **OwnerID**: Prevents self-damage and identifies the attacker for kill credit
- **WeaponType**: Determines damage, visual effects, and sound on hit
- **SpawnPosition**: Enables range-based damage falloff calculation
- **Active**: Allows soft-delete for pooling without immediate garbage collection

### ProjectileSnapshot (Network)

Serialized projectile data sent to clients.

**TypeScript:**
```typescript
interface ProjectileSnapshot {
    id: string;           // Unique identifier
    ownerId: string;      // Player who fired
    weaponType: string;   // Weapon name for visuals
    position: {x: number, y: number};
    velocity: {x: number, y: number};
}
```

**Go:**
```go
type ProjectileSnapshot struct {
    ID         string  `json:"id"`
    OwnerID    string  `json:"ownerId"`
    WeaponType string  `json:"weaponType"`
    Position   Vector2 `json:"position"`
    Velocity   Vector2 `json:"velocity"`
}
```

**Why?**

Velocity is included (not just position) so clients can predict projectile movement between network updates without desync.

---

## Behavior

### Shoot Request Flow

The complete flow from player input to projectile creation.

**Pseudocode:**
```
CLIENT:
    on mouse_click:
        if !canShoot(): return false
        send { type: "player:shoot", data: { aimAngle: mouseAngle } }
        localLastShotTime = now()

SERVER:
    on receive "player:shoot":
        player = getPlayer(playerID)
        if !player: return fail("no_player")

        weaponState = getWeaponState(playerID)
        if !weaponState: return fail("no_player")

        if weaponState.isReloading:
            return fail("reloading")

        if weaponState.currentAmmo == 0:
            weaponState.startReload()
            return fail("empty")

        if !weaponState.canShoot():  // Fire rate check
            return fail("cooldown")

        // SUCCESS - create projectile
        projectile = createProjectile(player.position, aimAngle, weapon.speed)
        weaponState.recordShot()  // Decrement ammo, set lastShotTime

        broadcast("projectile:spawn", projectile.snapshot())
        send(playerID, "weapon:state", weaponState.snapshot())
```

**TypeScript (Client):**
```typescript
class ShootingManager {
    private lastShotTime: number = 0;
    private fireCooldownMs: number;

    canShoot(): boolean {
        const now = this.clock.now();

        // Check local cooldown
        if (now - this.lastShotTime < this.fireCooldownMs) {
            return false;
        }

        // Check reload state
        if (this.weaponState?.isReloading) {
            return false;
        }

        // Check ammo
        if (this.weaponState?.currentAmmo === 0) {
            return false;
        }

        return true;
    }

    shoot(aimAngle: number): boolean {
        if (!this.canShoot()) {
            return false;
        }

        // Optimistic cooldown tracking
        this.lastShotTime = this.clock.now();

        // Send to server
        this.wsClient.send({
            type: 'player:shoot',
            timestamp: this.clock.now(),
            data: { aimAngle }
        });

        return true;
    }
}
```

**Go (Server):**
```go
func (gs *GameServer) PlayerShoot(playerID string, aimAngle float64, clientTimestamp int64) ShootResult {
    // clientTimestamp used for lag compensation on hitscan weapons — see hit-detection.md

    // Check if player exists (no IsAlive check — dead players not rejected here)
    player, exists := gs.world.GetPlayer(playerID)
    if !exists {
        return ShootResult{Success: false, Reason: ShootFailedNoPlayer}
    }

    // Get weapon state (uses weaponMu, not gs.mu)
    gs.weaponMu.RLock()
    ws := gs.weaponStates[playerID]
    gs.weaponMu.RUnlock()

    if ws == nil {
        return ShootResult{Success: false, Reason: ShootFailedNoPlayer}
    }

    // Check reload state
    if ws.IsReloading {
        return ShootResult{Success: false, Reason: ShootFailedReload}
    }

    // Check ammo (triggers auto-reload if empty)
    if ws.IsEmpty() {
        ws.StartReload()
        return ShootResult{Success: false, Reason: ShootFailedEmpty}
    }

    // Check fire rate cooldown
    if !ws.CanShoot() {
        return ShootResult{Success: false, Reason: ShootFailedCooldown}
    }

    // Record shot (decrement ammo, update cooldown)
    ws.RecordShot()

    // Branch: Hitscan vs Projectile weapon
    if ws.Weapon.IsHitscan {
        return gs.processHitscanShot(playerID, player, ws.Weapon, aimAngle, clientTimestamp)
    }

    // Projectile weapon: create projectile (CreateProjectile creates + adds in one call)
    pos := player.GetPosition()
    proj := gs.projectileManager.CreateProjectile(
        playerID, ws.Weapon.Name, pos, aimAngle, ws.Weapon.ProjectileSpeed,
    )

    return ShootResult{Success: true, Projectile: proj}
}
```

**Why this flow?**

1. **Client sends only aimAngle**: Minimizes trust in client data
2. **Auto-reload on empty**: Quality-of-life feature that prevents "click and nothing happens"
3. **Cooldown check last**: After all other validations, ensuring the reason returned is accurate
4. **Optimistic client tracking**: Client tracks cooldown locally for responsive UI feedback

### Fire Rate Enforcement

Precise enforcement of weapon fire rates.

**Pseudocode:**
```
function canShoot(weaponState):
    isMelee = weapon.isMelee()

    // Cannot shoot while reloading (ranged only)
    if !isMelee and weaponState.isReloading:
        return false

    // Cannot shoot with empty magazine (ranged only)
    if !isMelee and weaponState.currentAmmo <= 0:
        return false

    // Check fire rate cooldown (both melee and ranged)
    if weaponState.lastShotTime != zero:
        cooldown = 1 second / weapon.fireRate
        if now() - weaponState.lastShotTime < cooldown:
            return false

    return true
```

**Go:**
```go
func (ws *WeaponState) CanShoot() bool {
    isMelee := ws.Weapon.IsMelee()

    // Cannot shoot while reloading (ranged only)
    if !isMelee && ws.IsReloading {
        return false
    }

    // Cannot shoot with empty magazine (ranged only)
    if !isMelee && ws.CurrentAmmo <= 0 {
        return false
    }

    // Check fire rate cooldown (both melee and ranged)
    if !ws.LastShotTime.IsZero() {
        cooldown := time.Duration(float64(time.Second) / ws.Weapon.FireRate)
        if ws.clock.Since(ws.LastShotTime) < cooldown {
            return false
        }
    }

    return true
}
```

**Why?**

- **time.Duration precision**: Nanosecond accuracy for fair enforcement
- **Clock injection**: Enables deterministic testing with mock clocks
- **Server tick rate (60 Hz)**: Provides 16.67ms resolution, sufficient for fastest weapon (Uzi at 100ms)

| Weapon | Fire Rate | Cooldown | Ticks Between Shots |
|--------|-----------|----------|---------------------|
| Pistol | 3.0/s | 333ms | 20 ticks |
| Uzi | 10.0/s | 100ms | 6 ticks |
| AK47 | 6.0/s | 167ms | 10 ticks |
| Shotgun | 1.0/s | 1000ms | 60 ticks |

### Projectile Creation

Creating a new projectile with correct velocity.

**Pseudocode:**
```
function createProjectile(ownerID, position, aimAngle, speed):
    velocity.x = cos(aimAngle) * speed
    velocity.y = sin(aimAngle) * speed

    return Projectile{
        id: generateUUID(),
        ownerID: ownerID,
        position: position,
        velocity: velocity,
        spawnPosition: position,
        createdAt: now(),
        active: true
    }
```

**Go:**
```go
func NewProjectile(ownerID, weaponType string, position Vector2, aimAngle, speed float64) *Projectile {
    return &Projectile{
        ID:            uuid.New().String(),
        OwnerID:       ownerID,
        WeaponType:    weaponType,
        Position:      position,
        Velocity: Vector2{
            X: math.Cos(aimAngle) * speed,
            Y: math.Sin(aimAngle) * speed,
        },
        SpawnPosition: position,
        CreatedAt:     time.Now(),
        Active:        true,
    }
}
```

**Why?**

- **aimAngle in radians**: Standard math convention, compatible with `math.Cos/Sin`
- **Velocity from angle**: Constant speed in any direction, no bias toward cardinal directions
- **SpawnPosition stored**: Required for range-based damage falloff calculation

### Projectile Update

Updating projectile positions each server tick.

**Pseudocode:**
```
function updateProjectile(projectile, deltaTime):
    projectile.position += projectile.velocity * deltaTime

    if isExpired(projectile) or isOutOfBounds(projectile):
        projectile.active = false
        notify("projectile:destroy", projectile.id)
```

**Go:**
```go
func (p *Projectile) Update(deltaTime float64) {
    p.Position.X += p.Velocity.X * deltaTime
    p.Position.Y += p.Velocity.Y * deltaTime
}

func (p *Projectile) IsExpired() bool {
    return time.Since(p.CreatedAt) > ProjectileMaxLifetime
}

func (p *Projectile) IsOutOfBounds() bool {
    return p.Position.X < 0 || p.Position.X > ArenaWidth ||
           p.Position.Y < 0 || p.Position.Y > ArenaHeight
}
```

**Why?**

- **Position integration**: Simple Euler method is sufficient at 60 Hz
- **Dual expiration checks**: Both time (1000ms) and space (arena bounds) for completeness
- **No gravity**: Projectiles travel in straight lines for arcade-style gameplay

### Ammo & Reload

Managing ammunition and reload mechanics.

**Pseudocode:**
```
function recordShot(weaponState):
    weaponState.currentAmmo -= 1
    weaponState.lastShotTime = now()

function startReload(weaponState):
    if weaponState.isReloading: return  // Already reloading
    if weaponState.currentAmmo >= weaponState.weapon.magazineSize: return  // Full magazine

    weaponState.isReloading = true
    weaponState.reloadStartTime = now()

function checkReloadComplete(weaponState):
    if !weaponState.isReloading: return false

    elapsed = now() - weaponState.reloadStartTime
    if elapsed >= weaponState.weapon.reloadTime:
        weaponState.currentAmmo = weaponState.weapon.magazineSize
        weaponState.isReloading = false
        return true
    return false
```

**Go:**
```go
func (ws *WeaponState) RecordShot() {
    ws.CurrentAmmo--
    ws.LastShotTime = ws.clock.Now()
}

func (ws *WeaponState) StartReload() {
    // Don't reload if already reloading
    if ws.IsReloading {
        return
    }
    // Don't reload if magazine is full
    if ws.CurrentAmmo >= ws.Weapon.MagazineSize {
        return
    }
    ws.IsReloading = true
    ws.ReloadStartTime = ws.clock.Now()
}

func (ws *WeaponState) CheckReloadComplete() bool {
    if !ws.IsReloading {
        return false
    }

    if ws.clock.Since(ws.ReloadStartTime) >= ws.Weapon.ReloadTime {
        ws.CurrentAmmo = ws.Weapon.MagazineSize
        ws.IsReloading = false
        return true
    }
    return false
}
```

**Why?**

- **Server checks reload completion**: Every tick (60 Hz) for precise timing
- **Auto-reload on empty**: Triggered in shoot handler for seamless experience
- **No partial reloads**: Reload always restores full magazine (simpler gameplay)

### Recoil System

Applying recoil patterns to modify aim angle.

**Pseudocode:**
```
function applyRecoil(baseAngle, weapon, shotsFired, isMoving, isSprinting):
    recoil = weapon.recoil
    if !recoil: return baseAngle  // No recoil pattern

    // Vertical recoil (accumulates)
    verticalDeg = shotsFired * recoil.verticalPerShot
    if verticalDeg > recoil.maxAccumulation:
        verticalDeg = recoil.maxAccumulation

    // Horizontal recoil (random)
    horizontalDeg = random(-1, 1) * recoil.horizontalPerShot

    // Movement spread
    spreadDeg = 0
    if isMoving and weapon.spreadDegrees > 0:
        spreadDeg = random(-1, 1) * weapon.spreadDegrees
        if isSprinting:
            spreadDeg *= 1.5  // SprintSpreadMultiplier

    totalRecoilRad = (verticalDeg + horizontalDeg + spreadDeg) * PI / 180
    return baseAngle + totalRecoilRad
```

**Go:**
```go
func ApplyRecoilToAngle(
    baseAngle float64,
    recoil *RecoilPattern,
    shotsFired int,
    isMoving, isSprinting bool,
    weapon *Weapon,
) float64 {
    if recoil == nil {
        return baseAngle
    }

    // Vertical recoil (accumulates)
    verticalDeg := float64(shotsFired) * recoil.VerticalPerShot
    if verticalDeg > recoil.MaxAccumulation {
        verticalDeg = recoil.MaxAccumulation
    }

    // Horizontal recoil (random per shot)
    horizontalDeg := (rand.Float64() - 0.5) * 2.0 * recoil.HorizontalPerShot

    // Movement spread
    spreadDeg := 0.0
    if isMoving && weapon.SpreadDegrees > 0 {
        spreadDeg = (rand.Float64() - 0.5) * 2.0 * weapon.SpreadDegrees
        if isSprinting {
            spreadDeg *= SprintSpreadMultiplier
        }
    }

    // Convert to radians and apply
    totalRecoilRad := (verticalDeg + horizontalDeg + spreadDeg) * math.Pi / 180.0
    return baseAngle + totalRecoilRad
}
```

**Why?**

- **Vertical accumulates**: Creates upward "pull" during sustained fire
- **Horizontal random**: Adds unpredictability, prevents perfect tracking
- **Max accumulation cap**: Prevents infinite climb, allows muscle memory
- **Sprint penalty stacks**: Running + shooting is inherently inaccurate

### Shotgun Pellet Spread

Creating multiple pellets with spread distribution.

**Pseudocode:**
```
const PELLET_COUNT = 8
const PELLET_JITTER = 0.1  // 10% random variance

function calculatePelletAngles(aimAngle, spreadDegrees):
    spreadRad = spreadDegrees * PI / 180
    halfSpread = spreadRad / 2

    angles = []
    for i in 0 to PELLET_COUNT-1:
        // Even distribution across spread arc
        evenSpread = -halfSpread + (spreadRad * i / (PELLET_COUNT - 1))

        // Small random jitter
        spacing = spreadRad / (PELLET_COUNT - 1)
        jitter = (random() - 0.5) * spacing * PELLET_JITTER * 2

        angles.append(aimAngle + evenSpread + jitter)

    return angles
```

**Go:**
```go
func CalculateShotgunPelletAngles(aimAngle, spreadDegrees float64) []float64 {
    spreadRadians := spreadDegrees * math.Pi / 180.0
    halfSpread := spreadRadians / 2.0
    angles := make([]float64, ShotgunPelletCount)

    for i := 0; i < ShotgunPelletCount; i++ {
        // Even distribution
        evenSpread := -halfSpread + (spreadRadians * float64(i) / float64(ShotgunPelletCount-1))

        // 10% jitter
        spacing := spreadRadians / float64(ShotgunPelletCount-1)
        jitter := (rand.Float64() - 0.5) * spacing * 0.2

        angles[i] = aimAngle + evenSpread + jitter
    }

    return angles
}
```

**Why?**

- **8 pellets**: Balances visual density vs performance
- **Even distribution + jitter**: Consistent spread pattern with natural variance
- **15-degree arc**: Wide enough for close-range, narrow enough to require aiming

---

## Error Handling

### Shoot Failed: no_player

**Trigger**: Player ID not found in game world (disconnected or invalid)
**Detection**: `world.GetPlayer(playerID)` returns error
**Response**: Send `shoot:failed { reason: "no_player" }` to client
**Client Notification**: Client can display "Error: Not in game"
**Recovery**: Client should attempt reconnection

### Shoot Failed: cooldown

**Trigger**: Shot attempted before fire rate cooldown expired
**Detection**: `weaponState.CanShoot()` returns false
**Response**: Send `shoot:failed { reason: "cooldown" }` to client
**Client Notification**: None (client should prevent this locally)
**Recovery**: Wait for cooldown to expire

### Shoot Failed: empty

**Trigger**: Magazine has 0 rounds
**Detection**: `weaponState.CurrentAmmo == 0`
**Response**:
  1. Trigger auto-reload: `weaponState.StartReload()`
  2. Send `shoot:failed { reason: "empty" }` to client
  3. Send `weapon:state { isReloading: true }` to client
**Client Notification**: Show reload animation, play reload sound
**Recovery**: Wait for reload to complete

### Shoot Failed: reloading

**Trigger**: Shot attempted while reload in progress
**Detection**: `weaponState.IsReloading == true`
**Response**: Send `shoot:failed { reason: "reloading" }` to client
**Client Notification**: None (client should prevent this locally)
**Recovery**: Wait for reload to complete

### Projectile Expiration

**Trigger**: Projectile lifetime exceeds 1000ms or exits arena bounds
**Detection**: `projectile.IsExpired()` or `projectile.IsOutOfBounds()`
**Response**: Set `projectile.Active = false`, broadcast `projectile:destroy`
**Client Notification**: Remove projectile visual
**Recovery**: N/A (normal behavior)

---

## Implementation Notes

### TypeScript (Client)

**ShootingManager Pattern:**
- Maintains local cooldown state for responsive feedback
- Sends shoot requests immediately (no client-side prediction of projectiles)
- Updates local state from `weapon:state` messages (server is source of truth)
- Tracks `lastShotTime` locally but defers to server response

**Projectile Rendering:**
- Create visual on `projectile:spawn` message (not on local shoot)
- Interpolate position using received velocity
- Destroy visual on `projectile:destroy` message
- Use object pooling for performance (projectiles are frequent)

**Cooldown UI:**
- Display visual cooldown indicator based on local calculation
- Fire rate from weapon config: `cooldownMs = 1000 / weapon.fireRate`
- Progress: `(now - lastShotTime) / cooldownMs`

### Go (Server)

**Thread Safety:**
- All shoot processing holds `GameServer.mu` write lock
- WeaponState access is always within locked context
- Projectile updates happen in game tick (already locked)

**Projectile Management:**
- `ProjectileManager` maintains slice of active projectiles
- `Update()` iterates all projectiles each tick
- Expired/hit projectiles marked `Active = false`
- Periodic cleanup removes inactive projectiles

**Fire Rate Precision:**
- Use `time.Duration` for all timing calculations
- Clock injection (`Clock` interface) for deterministic tests
- Never rely on client-provided timestamps for cooldown

**Shotgun Handling:**
- Single `player:shoot` creates 8 projectiles
- All 8 broadcast in single `projectile:spawn` batch (future optimization)
- Each pellet tracked independently for hit detection

---

## Test Scenarios

### TS-SHOOT-001: Successful Shot Creates Projectile

**Category**: Unit
**Priority**: Critical

**Preconditions:**
- Player exists and is alive
- Weapon state has ammo > 0
- Not reloading
- Fire rate cooldown expired

**Input:**
- `player:shoot { aimAngle: 0 }` (pointing right)

**Expected Output:**
- Projectile created at player position
- `projectile:spawn` broadcast to all room members
- `weapon:state` sent to shooter with decremented ammo

**Pseudocode:**
```
test "successful shot creates projectile":
    setup:
        player = createPlayer(position: (500, 500))
        weaponState = createWeaponState(ammo: 15, weapon: Pistol)
    action:
        result = playerShoot(player.id, aimAngle: 0)
    assert:
        result.success == true
        result.projectile != nil
        result.projectile.velocity.x == 800  // cos(0) * 800
        result.projectile.velocity.y == 0    // sin(0) * 800
        weaponState.currentAmmo == 14
```

### TS-SHOOT-002: Shot Decrements Ammo

**Category**: Unit
**Priority**: Critical

**Preconditions:**
- Weapon state has ammo = 5

**Input:**
- `player:shoot { aimAngle: 0 }`

**Expected Output:**
- `weapon:state.currentAmmo` is 4

**Pseudocode:**
```
test "shot decrements ammo":
    setup:
        weaponState = createWeaponState(ammo: 5, weapon: Pistol)
    action:
        playerShoot(player.id, aimAngle: 0)
    assert:
        weaponState.currentAmmo == 4
```

### TS-SHOOT-003: Empty Magazine Returns shoot:failed

**Category**: Unit
**Priority**: Critical

**Preconditions:**
- Weapon state has ammo = 0
- Not currently reloading

**Input:**
- `player:shoot { aimAngle: 0 }`

**Expected Output:**
- `shoot:failed { reason: "empty" }` sent to player
- `weaponState.isReloading` set to true (auto-reload triggered)

**Pseudocode:**
```
test "empty magazine returns shoot:failed":
    setup:
        weaponState = createWeaponState(ammo: 0, weapon: Pistol)
    action:
        result = playerShoot(player.id, aimAngle: 0)
    assert:
        result.success == false
        result.reason == "empty"
        weaponState.isReloading == true
```

### TS-SHOOT-004: Fire Rate Cooldown Enforced

**Category**: Unit
**Priority**: Critical

**Preconditions:**
- Pistol weapon (fire rate 3.0/s = 333ms cooldown)
- Just fired a shot (lastShotTime = now)

**Input:**
- `player:shoot { aimAngle: 0 }` immediately after previous shot

**Expected Output:**
- `shoot:failed { reason: "cooldown" }` sent to player
- No projectile created

**Pseudocode:**
```
test "fire rate cooldown enforced":
    setup:
        weaponState = createWeaponState(ammo: 15, weapon: Pistol)
        playerShoot(player.id, 0)  // First shot
    action:
        clock.advance(100ms)  // Only 100ms elapsed, need 333ms
        result = playerShoot(player.id, 0)  // Second shot
    assert:
        result.success == false
        result.reason == "cooldown"
```

### TS-SHOOT-005: Reloading Blocks Shooting

**Category**: Unit
**Priority**: High

**Preconditions:**
- Weapon state has `isReloading = true`

**Input:**
- `player:shoot { aimAngle: 0 }`

**Expected Output:**
- `shoot:failed { reason: "reloading" }` sent to player
- No projectile created

**Pseudocode:**
```
test "reloading blocks shooting":
    setup:
        weaponState = createWeaponState(ammo: 0, weapon: Pistol)
        weaponState.startReload()
    action:
        result = playerShoot(player.id, 0)
    assert:
        result.success == false
        result.reason == "reloading"
```

### TS-SHOOT-006: Projectile Velocity From Aim Angle

**Category**: Unit
**Priority**: High

**Preconditions:**
- Pistol weapon (speed 800 px/s)

**Input:**
- `player:shoot { aimAngle: PI/4 }` (45 degrees, upper-right)

**Expected Output:**
- Projectile velocity.x = cos(PI/4) * 800 ≈ 565.69
- Projectile velocity.y = sin(PI/4) * 800 ≈ 565.69

**Pseudocode:**
```
test "projectile velocity from aim angle":
    setup:
        player = createPlayer(position: (500, 500))
        weaponState = createWeaponState(ammo: 15, weapon: Pistol)
    action:
        result = playerShoot(player.id, aimAngle: PI/4)
    assert:
        result.projectile.velocity.x ≈ 565.69 (±0.01)
        result.projectile.velocity.y ≈ 565.69 (±0.01)
```

### TS-SHOOT-007: Projectile Expires After Lifetime

**Category**: Unit
**Priority**: High

**Preconditions:**
- Projectile created at t=0

**Input:**
- Server tick at t=1001ms

**Expected Output:**
- `projectile.isExpired()` returns true
- `projectile:destroy` broadcast

**Pseudocode:**
```
test "projectile expires after lifetime":
    setup:
        projectile = createProjectile(createdAt: now)
    action:
        clock.advance(1001ms)
    assert:
        projectile.isExpired() == true
```

### TS-SHOOT-008: Reload Completes And Restores Ammo

**Category**: Unit
**Priority**: High

**Preconditions:**
- Pistol weapon (reload time 1500ms, magazine 15)
- Weapon state has ammo = 0, isReloading = true, reloadStartTime = now

**Input:**
- Server tick at t=1500ms

**Expected Output:**
- `weaponState.currentAmmo` = 15
- `weaponState.isReloading` = false
- `weapon:state` sent to player

**Pseudocode:**
```
test "reload completes and restores ammo":
    setup:
        weaponState = createWeaponState(ammo: 0, weapon: Pistol)
        weaponState.startReload()
    action:
        clock.advance(1500ms)
        weaponState.checkReloadComplete()
    assert:
        weaponState.currentAmmo == 15
        weaponState.isReloading == false
```

### TS-SHOOT-009: Shotgun Creates 8 Pellets

**Category**: Unit
**Priority**: High

**Preconditions:**
- Shotgun weapon (8 pellets, 15-degree spread)

**Input:**
- `player:shoot { aimAngle: 0 }`

**Expected Output:**
- 8 projectiles created
- Angles distributed within ±7.5 degrees of aim angle

**Pseudocode:**
```
test "shotgun creates 8 pellets":
    setup:
        weaponState = createWeaponState(ammo: 6, weapon: Shotgun)
    action:
        result = playerShoot(player.id, aimAngle: 0)
    assert:
        projectileCount == 8
        all projectile angles within [-7.5°, +7.5°] of aim
```

### TS-SHOOT-010: Sprint Applies Accuracy Penalty

**Category**: Unit
**Priority**: Medium

**Preconditions:**
- Uzi weapon (spread 5 degrees)
- Player is sprinting

**Input:**
- `player:shoot { aimAngle: 0 }`

**Expected Output:**
- Projectile angle has spread up to ±3.75 degrees (5 * 1.5 / 2)

**Pseudocode:**
```
test "sprint applies accuracy penalty":
    setup:
        player.isSprinting = true
        weaponState = createWeaponState(ammo: 30, weapon: Uzi)
    action:
        // Fire many shots and measure spread
        angles = []
        for i in 0 to 100:
            result = playerShoot(player.id, 0)
            angles.append(result.projectile.angle)
    assert:
        max(angles) - min(angles) <= 7.5 degrees  // ±3.75
        // Statistical: most spread beyond 2.5° (uzi base)
```

### TS-SHOOT-011: Vertical Recoil Accumulates

**Category**: Unit
**Priority**: Medium

**Preconditions:**
- Uzi weapon (2 degrees vertical recoil per shot)

**Input:**
- 5 consecutive shots at aimAngle = 0

**Expected Output:**
- First shot: ~0 degrees offset
- Fifth shot: ~10 degrees offset (5 * 2)

**Pseudocode:**
```
test "vertical recoil accumulates":
    setup:
        weaponState = createWeaponState(ammo: 30, weapon: Uzi)
    action:
        angles = []
        for i in 0 to 5:
            result = playerShoot(player.id, 0)
            angles.append(extractVerticalOffset(result))
    assert:
        angles[0] < angles[4]  // Recoil increases
        angles[4] ≈ 10 degrees (±1)
```

### TS-SHOOT-012: Dead Player Cannot Shoot

**Category**: Unit
**Priority**: Critical

**Preconditions:**
- Player is dead (health = 0)

**Input:**
- `player:shoot { aimAngle: 0 }`

**Expected Output:**
- `shoot:failed { reason: "no_player" }` sent to player
- No projectile created

**Pseudocode:**
```
test "dead player cannot shoot":
    setup:
        player = createPlayer(health: 0)  // Dead
    action:
        result = playerShoot(player.id, 0)
    assert:
        result.success == false
        result.reason == "no_player"
```

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-02-02 | Initial specification with complete shooting mechanics |
| 1.1.0 | 2026-02-15 | Added `clientTimestamp` parameter to `PlayerShoot()` for lag compensation on hitscan weapons. |
| 1.1.1 | 2026-02-16 | Fixed `ShootResult.FailReason` → `ShootResult.Reason` to match `gameserver.go:22`. |
| 1.1.2 | 2026-02-16 | Fixed `PlayerShoot` — only checks `!exists` (no `IsAlive` check), uses `weaponMu.RLock` (not `gs.mu.Lock`), uses `CreateProjectile` (not `NewProjectile+AddProjectile`), added hitscan branch. |
| 1.1.3 | 2026-02-16 | Fixed `StartReload` — checks `IsReloading` + `CurrentAmmo >= MagazineSize` (not `IsMelee()`). |
