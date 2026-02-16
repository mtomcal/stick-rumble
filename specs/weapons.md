# Weapons

> **Spec Version**: 1.0.0
> **Last Updated**: 2026-02-02
> **Depends On**: [constants.md](constants.md), [arena.md](arena.md), [player.md](player.md)
> **Depended By**: [shooting.md](shooting.md), [melee.md](melee.md), [hit-detection.md](hit-detection.md)

---

## Overview

The weapons system defines all offensive tools available to players in Stick Rumble. The game features **6 weapons** divided into two categories: **ranged weapons** (Pistol, Uzi, AK47, Shotgun) that fire projectiles, and **melee weapons** (Bat, Katana) that deal damage in close-range arcs.

**Why this design?**
- **6 weapons** provide meaningful variety without overwhelming new players
- **Pistol as default** ensures all players have a baseline weapon, never feeling "unarmed"
- **Ranged vs melee split** creates distinct playstyles and encourages map movement toward weapon crates
- **Single weapon slot** (no inventory) keeps gameplay fast-paced and decisions instant

All weapon stats are defined in a shared `weapon-configs.json` file that both client and server load, ensuring consistency without manual synchronization.

---

## Dependencies

### Technology Dependencies

| Technology | Version | Purpose |
|------------|---------|---------|
| Go | 1.25 | Server-side weapon logic and damage calculations |
| TypeScript | 5.9.3 | Client-side weapon config loading and validation |
| JSON | N/A | Shared weapon configuration format |

### Spec Dependencies

- [constants.md](constants.md) - Weapon respawn delay, pickup radius, sprint spread multiplier
- [arena.md](arena.md) - Arena dimensions for spawn locations and boundary clamping
- [player.md](player.md) - Health system for damage calculations

---

## Constants

All weapon-related constants from [constants.md](constants.md):

| Constant | Value | Unit | Description |
|----------|-------|------|-------------|
| `WeaponPickupRadius` | 32.0 | px | Detection distance for weapon pickup |
| `WeaponRespawnDelay` | 30.0 | s | Time before weapon crate respawns |
| `SprintSpreadMultiplier` | 1.5 | ratio | Accuracy penalty while sprinting |
| `ProjectileMaxLifetime` | 1000 | ms | Maximum projectile existence time |
| `ProjectileMaxRange` | 800 | px | Maximum projectile travel distance |
| `ShotgunPelletCount` | 8 | count | Number of pellets per shotgun shot |
| `ShotgunPelletDamage` | 7.5 | HP | Damage per individual shotgun pellet |

---

## Data Structures

### Weapon

The core weapon definition structure containing all stats and behavior parameters.

**Why this structure?**
- **Flat structure** (no nested configs) makes JSON parsing simple across languages
- **Optional fields** (Recoil, ArcDegrees) are nullable to clearly indicate which features apply
- **All timing in milliseconds** for consistency with network timestamps

**TypeScript:**
```typescript
interface ProjectileVisuals {
  color: string;              // Hex color for projectile circle
  diameter: number;           // Projectile circle diameter (px)
  tracerColor: string;        // Hex color for tracer trail
  tracerWidth: number;        // Tracer line width (px)
}

interface WeaponVisuals {
  muzzleFlashColor: string;   // Hex color for muzzle flash
  muzzleFlashSize: number;    // Muzzle flash radius (px)
  muzzleFlashDuration: number; // Muzzle flash duration (ms)
  projectile: ProjectileVisuals; // Projectile rendering config
}

interface RecoilConfig {
  verticalPerShot: number;    // Degrees of vertical climb per shot
  horizontalPerShot: number;  // Degrees of horizontal spread (±random)
  recoveryTime: number;       // Seconds to fully recover from recoil
  maxAccumulation: number;    // Maximum accumulated recoil in degrees
}

interface WeaponConfig {
  name: string;               // Display name ("Pistol", "AK47", etc.)
  damage: number;             // Base damage per hit (HP)
  fireRate: number;           // Rounds per second (or swings for melee)
  magazineSize: number;       // Ammo capacity (0 for melee = infinite)
  reloadTimeMs: number;       // Reload duration (0 for melee)
  projectileSpeed: number;    // Projectile velocity px/s (0 for melee)
  range: number;              // Maximum effective range (px)
  arcDegrees: number;         // Attack cone width (melee) or pellet spread (shotgun)
  knockbackDistance: number;  // Knockback push distance (Bat only)
  recoil: RecoilConfig | null; // Recoil pattern (null = no recoil)
  spreadDegrees: number;      // Movement inaccuracy (degrees ± while moving)
  visuals: WeaponVisuals;     // Client-side rendering config
}
```

**Go:**
```go
// RecoilPattern defines how a weapon's aim is affected by firing
type RecoilPattern struct {
    VerticalPerShot   float64 // Degrees of vertical climb per shot
    HorizontalPerShot float64 // Degrees of horizontal spread per shot (+/- random)
    RecoveryTime      float64 // Seconds for recoil to fully recover
    MaxAccumulation   float64 // Maximum accumulated recoil in degrees
}

// Weapon defines a weapon type with its properties
type Weapon struct {
    Name              string
    Damage            int
    FireRate          float64        // Rounds per second (or swings per second for melee)
    MagazineSize      int            // Rounds per magazine (0 for melee)
    ReloadTime        time.Duration  // Time to reload (0 for melee)
    ProjectileSpeed   float64        // Projectile speed in px/s (0 for melee)
    Range             float64        // Maximum range in pixels
    ArcDegrees        float64        // Swing arc in degrees (melee) or pellet spread (shotgun)
    KnockbackDistance float64        // Knockback distance in pixels (Bat only)
    Recoil            *RecoilPattern // Recoil pattern (nil for no recoil)
    SpreadDegrees     float64        // Movement spread in degrees (+/- while moving, 0 for stationary)
    IsHitscan         bool           // Instant-hit weapon (lag compensated) vs projectile
}

// IsMelee returns true if this is a melee weapon
func (w *Weapon) IsMelee() bool {
    return w.MagazineSize == 0 && w.ProjectileSpeed == 0
}
```

### WeaponState

Tracks the runtime state of a player's currently equipped weapon.

**Why separate from Weapon?**
- `Weapon` is the immutable definition (stats)
- `WeaponState` is the mutable runtime state (ammo, cooldowns)
- Allows multiple players to use the same weapon type with independent state

**TypeScript:**
```typescript
interface WeaponState {
  weapon: WeaponConfig;       // Reference to weapon definition
  currentAmmo: number;        // Remaining ammo in magazine
  isReloading: boolean;       // Currently reloading
  lastShotTime: number;       // Timestamp of last shot (ms)
  reloadStartTime: number;    // When reload started (ms)
}
```

**Go:**
```go
type WeaponState struct {
    Weapon          *Weapon
    CurrentAmmo     int
    IsReloading     bool
    LastShotTime    time.Time
    ReloadStartTime time.Time
    clock           Clock // Injected for testing
}
```

### WeaponCrate

Represents a weapon spawn point on the map.

**TypeScript:**
```typescript
interface WeaponCrate {
  id: string;                 // Unique crate identifier
  position: { x: number; y: number };
  weaponType: string;         // Weapon name (lowercase)
  isAvailable: boolean;       // Can be picked up
  nextRespawnTime?: number;   // When crate respawns (ms timestamp)
}
```

**Go:**
```go
type WeaponCrate struct {
    ID          string
    Position    Vector2
    WeaponType  string
    IsAvailable bool
    RespawnTime time.Time
}
```

---

## Weapon Statistics

### Complete Weapon Stats Table

| Weapon | Type | Damage | Fire Rate | Magazine | Reload | Speed | Range | Spread | Arc | Knockback |
|--------|------|--------|-----------|----------|--------|-------|-------|--------|-----|-----------|
| **Pistol** | Ranged | 25 | 3.0/s | 15 | 1500ms | 800 px/s | 800px | 0° | 0° | 0 |
| **Uzi** | Ranged | 8 | 10.0/s | 30 | 1500ms | 800 px/s | 600px | 5° | 0° | 0 |
| **AK47** | Ranged | 20 | 6.0/s | 30 | 2000ms | 800 px/s | 800px | 3° | 0° | 0 |
| **Shotgun** | Ranged | 60* | 1.0/s | 6 | 2500ms | 800 px/s | 300px | 0° | 15° | 0 |
| **Bat** | Melee | 25 | 2.0/s | ∞ | N/A | N/A | 64px | 0° | 90° | 40px |
| **Katana** | Melee | 45 | 1.25/s | ∞ | N/A | N/A | 80px | 0° | 90° | 0 |

*Shotgun fires 8 pellets at 7.5 damage each = 60 total if all hit

### Recoil Configuration

| Weapon | Vertical/Shot | Horizontal/Shot | Recovery | Max Accumulation |
|--------|---------------|-----------------|----------|------------------|
| **Pistol** | N/A | N/A | N/A | N/A |
| **Uzi** | 2.0° | 0° | 0.5s | 20° |
| **AK47** | 1.5° | ±3.0° | 0.6s | 15° |
| **Shotgun** | N/A | N/A | N/A | N/A |

**Why these recoil patterns?**
- **Pistol**: No recoil - forgiving for new players, default weapon should be reliable
- **Uzi**: Vertical only - creates predictable spray pattern that rewards "pull down" skill
- **AK47**: Mixed recoil - unpredictable, harder to control, balances its high damage
- **Shotgun**: No recoil - single slow shots don't accumulate, emphasizes aim over control

### Visual Configuration

| Weapon | Muzzle Color | Flash Size | Flash Duration | Projectile Color | Diameter | Tracer Width |
|--------|--------------|------------|----------------|------------------|----------|--------------|
| **Pistol** | 0xffdd00 | 8px | 50ms | 0xffff00 (Yellow) | 4px | 2px |
| **Uzi** | 0xffaa00 | 8px | 50ms | 0xffaa00 (Orange) | 3px | 1.5px |
| **AK47** | 0xffcc00 | 12px | 80ms | 0xffcc00 (Gold) | 5px | 2.5px |
| **Shotgun** | 0xff8800 | 16px | 100ms | 0xff8800 (Orange-red) | 6px | 3px |

**Why these visual choices?**
- **Larger weapons = bigger effects** - AK47 and Shotgun have more visual impact
- **Color coding** - Each weapon has a distinct color for instant recognition
- **Tracer width scales with damage** - Higher damage weapons have more visible trails

---

## Behavior

### Shots to Kill (TTK Analysis)

Understanding how many shots each weapon needs to kill helps balance the game.

| Weapon | Shots to Kill | Time to Kill | DPS |
|--------|---------------|--------------|-----|
| Pistol | 4 | 1.0s | 75 |
| Uzi | 13 | 1.2s | 80 |
| AK47 | 5 | 0.67s | 120 |
| Shotgun | 2 (all pellets) | 1.0s | 60 |
| Bat | 4 | 1.5s | 50 |
| Katana | 3 | 1.6s | 56 |

**Why AK47 has highest DPS?**
The AK47 is intentionally the "power weapon" - it requires players to contest a specific map location (left mid) to obtain it. Its mixed recoil makes it harder to use at range, balancing its raw damage output.

### Damage Falloff System

Ranged weapons deal reduced damage at longer distances.

**Why damage falloff?**
- Prevents sniping with high-DPS weapons across the arena
- Makes weapon range stat meaningful (not just projectile lifetime)
- Rewards players for closing distance appropriately

**Formula:**
```
if (distance <= maxRange * 0.5):
    actualDamage = baseDamage  // Full damage in first 50% of range
else if (distance >= maxRange):
    actualDamage = 0  // Beyond max range = miss
else:
    // Linear falloff from 50% to 100% of max range
    falloffRange = maxRange * 0.5
    distanceBeyondFalloff = distance - (maxRange * 0.5)
    falloffPercent = 1.0 - (distanceBeyondFalloff / falloffRange)
    actualDamage = baseDamage * falloffPercent
```

**Pseudocode:**
```
function calculateDamageFalloff(baseDamage, distance, maxRange):
    falloffStart = maxRange * 0.5

    if distance <= falloffStart:
        return baseDamage

    if distance >= maxRange:
        return 0

    falloffRange = maxRange - falloffStart
    distanceBeyondStart = distance - falloffStart
    falloffPercent = 1.0 - (distanceBeyondStart / falloffRange)

    return baseDamage * falloffPercent
```

**Go:**
```go
func CalculateDamageFalloff(baseDamage int, distance float64, maxRange float64) float64 {
    falloffStart := maxRange * 0.5
    if distance <= falloffStart {
        return float64(baseDamage)
    }
    if distance >= maxRange {
        return 0
    }
    falloffRange := maxRange - falloffStart
    distanceBeyondFalloffStart := distance - falloffStart
    damageFalloff := 1.0 - (distanceBeyondFalloffStart / falloffRange)
    return float64(baseDamage) * damageFalloff
}
```

**Effective Ranges (50% damage point):**
| Weapon | Full Damage Range | 50% Damage Range | Zero Damage |
|--------|-------------------|------------------|-------------|
| Pistol | 0-400px | 400-800px | >800px |
| Uzi | 0-300px | 300-600px | >600px |
| AK47 | 0-400px | 400-800px | >800px |
| Shotgun | 0-150px | 150-300px | >300px |

### Shotgun Pellet System

The Shotgun fires multiple pellets in a cone pattern.

**Why 8 pellets?**
- Creates satisfying "spray" effect
- Partial hits feel impactful without full-damage close range dominance
- 8 divides evenly for spread calculations

**Pellet Distribution:**
```
pelletCount = 8
spreadDegrees = 15° (total cone width)
halfSpread = 7.5° (each side of center)

For each pellet i (0-7):
    // Even distribution across cone
    evenSpread = -halfSpread + (spreadDegrees * i / 7)

    // Small random offset for natural feel (±10% of spacing)
    spacing = spreadDegrees / 7
    randomOffset = (random - 0.5) * spacing * 0.2

    pelletAngle[i] = aimAngle + evenSpread + randomOffset
```

**Go:**
```go
func CalculateShotgunPelletAngles(aimAngle float64, spreadDegrees float64) []float64 {
    angles := make([]float64, ShotgunPelletCount)
    spreadRadians := (spreadDegrees * math.Pi) / 180.0
    halfSpread := spreadRadians / 2.0

    for i := 0; i < ShotgunPelletCount; i++ {
        evenSpread := -halfSpread + (spreadRadians * float64(i) / float64(ShotgunPelletCount-1))
        spacing := spreadRadians / float64(ShotgunPelletCount-1)
        randomOffset := (rand.Float64() - 0.5) * spacing * 0.2
        angles[i] = aimAngle + evenSpread + randomOffset
    }
    return angles
}
```

### Recoil System

Recoil affects aim angle when firing automatic weapons.

**Why recoil?**
- Adds skill ceiling to automatic weapons
- Prevents "spray and pray" at long range
- Creates learning curve for each weapon's unique pattern

**Recoil Calculation:**
```
function applyRecoil(baseAngle, recoil, shotsFired, isMoving, isSprinting, weapon):
    if recoil is null:
        return baseAngle

    // Vertical recoil accumulates with each shot (capped)
    verticalRecoil = min(shotsFired * recoil.verticalPerShot, recoil.maxAccumulation)

    // Horizontal recoil is random per shot
    horizontalRecoil = (random - 0.5) * 2.0 * recoil.horizontalPerShot

    // Movement spread (if moving and weapon has spread)
    movementSpread = 0
    if isMoving AND weapon.spreadDegrees > 0:
        movementSpread = (random - 0.5) * 2.0 * weapon.spreadDegrees

        if isSprinting:
            movementSpread *= 1.5  // Sprint penalty

    // Convert degrees to radians and apply
    totalRecoil = (verticalRecoil + horizontalRecoil + movementSpread) * PI / 180

    return baseAngle + totalRecoil
```

**Go:**
```go
func ApplyRecoilToAngle(baseAngle float64, recoil *RecoilPattern, shotsFired int,
                        isMoving bool, isSprinting bool, weapon *Weapon) float64 {
    if recoil == nil {
        return baseAngle
    }

    verticalRecoilDegrees := float64(shotsFired) * recoil.VerticalPerShot
    if verticalRecoilDegrees > recoil.MaxAccumulation {
        verticalRecoilDegrees = recoil.MaxAccumulation
    }

    horizontalRecoilDegrees := (rand.Float64() - 0.5) * 2.0 * recoil.HorizontalPerShot

    movementSpreadDegrees := 0.0
    if isMoving && weapon.SpreadDegrees > 0 {
        movementSpreadDegrees = (rand.Float64() - 0.5) * 2.0 * weapon.SpreadDegrees
        if isSprinting {
            movementSpreadDegrees *= SprintSpreadMultiplier
        }
    }

    totalRecoilRadians := ((verticalRecoilDegrees + horizontalRecoilDegrees +
                           movementSpreadDegrees) * math.Pi) / 180.0
    return baseAngle + totalRecoilRadians
}
```

### Melee Attack Detection

Melee weapons use range + arc detection instead of projectiles.

**Why range + arc?**
- Feels like a "swing" rather than a point attack
- Multiple enemies can be hit in one swing (rewarding positioning)
- 90° arc (45° each side) matches intuitive expectation of "in front of me"

**Detection Algorithm:**
```
function isInMeleeRange(attacker, target, weapon):
    // Step 1: Calculate distance
    dx = target.x - attacker.x
    dy = target.y - attacker.y
    distance = sqrt(dx² + dy²)

    // Step 2: Range check
    if distance > weapon.range:
        return false

    // Step 3: Calculate angle to target
    angleToTarget = atan2(dy, dx) * (180 / PI)
    if angleToTarget < 0:
        angleToTarget += 360

    // Step 4: Normalize attacker's aim angle
    aimAngle = attacker.aimAngle * (180 / PI)
    if aimAngle < 0:
        aimAngle += 360

    // Step 5: Calculate angular difference
    angleDiff = abs(angleToTarget - aimAngle)
    if angleDiff > 180:
        angleDiff = 360 - angleDiff

    // Step 6: Check against half arc (weapon.arcDegrees is full cone)
    halfArc = weapon.arcDegrees / 2
    return angleDiff <= halfArc
```

### Knockback System (Bat Only)

The Bat applies knockback to hit targets, pushing them away.

**Why only Bat has knockback?**
- Creates unique identity for the "weaker" melee weapon
- Allows strategic plays (push into corner, off objectives)
- Katana relies on damage alone as its advantage

**Knockback Application:**
```
function applyKnockback(attacker, target, knockbackDistance):
    // Calculate direction from attacker to target
    dx = target.x - attacker.x
    dy = target.y - attacker.y
    distance = sqrt(dx² + dy²)

    if distance == 0:
        return  // No knockback if overlapping

    // Normalize direction
    dirX = dx / distance
    dirY = dy / distance

    // Apply knockback displacement
    newX = target.x + dirX * knockbackDistance
    newY = target.y + dirY * knockbackDistance

    // Clamp to arena bounds
    newX = clamp(newX, 0, ArenaWidth)
    newY = clamp(newY, 0, ArenaHeight)

    target.position = (newX, newY)
```

**Go:**
```go
func applyKnockback(attacker *PlayerState, target *PlayerState, knockbackDistance float64) {
    attackerPos := attacker.GetPosition()
    targetPos := target.GetPosition()

    dx := targetPos.X - attackerPos.X
    dy := targetPos.Y - attackerPos.Y
    distance := math.Sqrt(dx*dx + dy*dy)

    if distance == 0 {
        return
    }

    dirX := dx / distance
    dirY := dy / distance

    newX := targetPos.X + dirX*knockbackDistance
    newY := targetPos.Y + dirY*knockbackDistance

    newX = math.Max(0, math.Min(ArenaWidth, newX))
    newY = math.Max(0, math.Min(ArenaHeight, newY))

    target.SetPosition(Vector2{X: newX, Y: newY})
}
```

---

## Weapon Spawn System

### Spawn Locations

Weapons spawn at **5 fixed locations** forming a strategic pattern across the arena.

**Why fixed spawns?**
- Players learn map control (knowing where weapons are)
- Creates contested "hot spots" for gameplay
- No randomness = fair access for all players

| Position | Weapon | Coordinates | Strategic Reasoning |
|----------|--------|-------------|---------------------|
| Center Top | Uzi | (960, 216) | Early aggression, contested center |
| Left Mid | AK47 | (480, 540) | Power weapon, side control |
| Right Mid | Shotgun | (1440, 540) | Power weapon, opposite side |
| Bottom Center | Katana | (960, 864) | High-risk melee, back line |
| Top Left | Bat | (288, 162) | Corner utility, knockback control |

**Coordinate Calculation:**
```
ArenaWidth = 1920, ArenaHeight = 1080

uzi.position     = (ArenaWidth / 2, ArenaHeight * 0.2)       = (960, 216)
ak47.position    = (ArenaWidth * 0.25, ArenaHeight / 2)      = (480, 540)
shotgun.position = (ArenaWidth * 0.75, ArenaHeight / 2)      = (1440, 540)
katana.position  = (ArenaWidth / 2, ArenaHeight * 0.8)       = (960, 864)
bat.position     = (ArenaWidth * 0.15, ArenaHeight * 0.15)   = (288, 162)
```

### Pickup Mechanics

**Why 32px radius?**
- Large enough to be forgiving (don't need pixel-perfect positioning)
- Small enough that you must deliberately approach the crate
- Matches player width (32px) for intuitive "overlap" feeling

**Pickup Flow:**
```
1. Player approaches crate
2. Client detects proximity (distance < 32px)
3. Client displays "Press E to pickup" prompt
4. Player presses E → client sends weapon:pickup_attempt { crateId }
5. Server validates:
   - Crate exists
   - Crate is available
   - Player within pickup radius
6. If valid:
   - Mark crate unavailable
   - Set respawn time = now + 30 seconds
   - Replace player's weapon with new weapon
   - Reset weapon state (full ammo, not reloading)
   - Broadcast weapon:pickup_confirmed
7. After 30 seconds:
   - Mark crate available
   - Broadcast weapon:respawned
```

### Weapon Replacement

When picking up a weapon, the player's current weapon is replaced entirely.

**Why no weapon inventory?**
- Keeps pace fast (no weapon switching delays)
- Forces meaningful decisions (trade current weapon for new one)
- Simpler UI (no inventory management)

**State Reset on Pickup:**
```
function equipWeapon(player, newWeapon):
    // Create fresh weapon state
    player.weaponState = {
        weapon: newWeapon,
        currentAmmo: newWeapon.magazineSize,
        isReloading: false,
        lastShotTime: 0,
        reloadStartTime: 0
    }
```

---

## Weapon Configuration File

All weapon stats are stored in `weapon-configs.json` at the project root.

**Why shared JSON?**
- Single source of truth for both client and server
- Easy to balance (edit one file, both sides update)
- Prevents drift between client prediction and server authority

**File Structure:**
```json
{
  "version": "1.0.0",
  "weapons": {
    "Pistol": {
      "name": "Pistol",
      "damage": 25,
      "fireRate": 3.0,
      "magazineSize": 15,
      "reloadTimeMs": 1500,
      "projectileSpeed": 800.0,
      "range": 800.0,
      "arcDegrees": 0,
      "knockbackDistance": 0,
      "recoil": null,
      "spreadDegrees": 0,
      "visuals": {
        "muzzleFlashColor": "0xffdd00",
        "muzzleFlashSize": 8,
        "muzzleFlashDuration": 50,
        "projectile": {
          "color": "0xffff00",
          "diameter": 4,
          "tracerColor": "0xffff00",
          "tracerWidth": 2
        }
      }
    }
    // ... other weapons
  }
}
```

**Loading Priority:**
1. Try to load `weapon-configs.json` from filesystem/network
2. If load fails, use hardcoded fallback values
3. Log warning if using fallback (indicates configuration issue)

---

## Error Handling

### Invalid Weapon Type

**Trigger**: Request references unknown weapon type
**Detection**: Weapon factory lookup returns nil/null
**Response**: Log error, use Pistol as fallback
**Client Notification**: None (graceful fallback)
**Recovery**: Automatic

### Weapon Config Load Failure

**Trigger**: JSON file missing or malformed
**Detection**: File read or parse error
**Response**: Use hardcoded defaults, log warning
**Client Notification**: Console warning only
**Recovery**: Automatic with fallback values

### Invalid Pickup Attempt

**Trigger**: Player attempts pickup when:
- Crate doesn't exist
- Crate is unavailable (on cooldown)
- Player not within 32px radius

**Detection**: Server-side validation
**Response**: Ignore request silently
**Client Notification**: No confirmation message (pickup simply doesn't happen)
**Recovery**: N/A (no action taken)

### Weapon Config Validation Errors

**Trigger**: Config file has invalid values (negative damage, zero fire rate, etc.)
**Detection**: Validation function checks all fields
**Response**: Return error list, reject invalid config
**Client Notification**: Console error with specific field issues
**Recovery**: Manual fix required

---

## Implementation Notes

### TypeScript (Client)

**Config Loading:**
```typescript
// Load at game start (async)
await loadWeaponConfigs();

// Access synchronously after load
const pistol = getWeaponConfigSync('Pistol');

// Parse hex colors for Phaser
const color = parseHexColor(config.visuals.muzzleFlashColor);
```

**Weapon State Management:**
- Track locally for responsive UI (ammo display, reload bar)
- Server `weapon:state` messages are authoritative
- Reconcile on server message receipt

### Go (Server)

**Factory Pattern:**
```go
// CreateWeaponByType returns (*Weapon, error) — error for unknown weapon types
weapon, err := CreateWeaponByType("ak47")
if err != nil {
    // "invalid weapon type: ..."
}

// Case-insensitive lookup (uses strings.ToLower internally)
weapon, _ := CreateWeaponByType("AK47")  // Same result
weapon, _ := CreateWeaponByType("Ak47")  // Same result
```

**Thread Safety:**
- WeaponState uses clock injection for deterministic testing
- WeaponCrateManager uses RWMutex for concurrent access
- All state mutations go through thread-safe methods

**Cooldown Enforcement:**
```go
func (ws *WeaponState) CanShoot() bool {
    cooldown := time.Duration(float64(time.Second) / ws.Weapon.FireRate)
    return ws.clock.Since(ws.LastShotTime) >= cooldown
}
```

---

## Test Scenarios

### TS-WEAP-001: Pistol Fire Rate Enforcement

**Category**: Unit
**Priority**: Critical

**Preconditions:**
- Player equipped with Pistol (default)
- Pistol fire rate = 3.0 shots/second = 333ms cooldown

**Input:**
- First shot at T=0
- Attempt second shot at T=200ms
- Attempt third shot at T=400ms

**Expected Output:**
- First shot: fires successfully
- Second shot: blocked (only 200ms elapsed, need 333ms)
- Third shot: fires successfully (400ms > 333ms)

**TypeScript (Vitest):**
```typescript
it('should enforce pistol fire rate cooldown', () => {
  const mockClock = new MockClock();
  const state = new WeaponState(createPistol(), mockClock);

  expect(state.canShoot()).toBe(true);
  state.recordShot();

  mockClock.advance(200);
  expect(state.canShoot()).toBe(false);

  mockClock.advance(200);
  expect(state.canShoot()).toBe(true);
});
```

---

### TS-WEAP-002: Shotgun Pellet Distribution

**Category**: Unit
**Priority**: High

**Preconditions:**
- Weapon is Shotgun
- Aim angle = 0 radians (facing right)
- Arc = 15 degrees

**Input:**
- Calculate pellet angles

**Expected Output:**
- 8 pellet angles returned
- Angles span from -7.5° to +7.5° around aim angle
- Small random variation (±10% of spacing)

**Go:**
```go
func TestShotgunPelletDistribution(t *testing.T) {
    angles := CalculateShotgunPelletAngles(0, 15)

    assert.Len(t, angles, 8)
    assert.InDelta(t, -0.131, angles[0], 0.03) // -7.5° in radians ± variance
    assert.InDelta(t, 0.131, angles[7], 0.03)  // +7.5° in radians ± variance
}
```

---

### TS-WEAP-003: Damage Falloff at Range

**Category**: Unit
**Priority**: High

**Preconditions:**
- Base damage = 20
- Max range = 800px

**Input:**
- Calculate damage at distances: 0px, 400px, 600px, 800px, 900px

**Expected Output:**
- 0px: 20 damage (full)
- 400px: 20 damage (full, at 50% range)
- 600px: 10 damage (50% falloff)
- 800px: 0 damage (at max range)
- 900px: 0 damage (beyond max range)

**Go:**
```go
func TestDamageFalloff(t *testing.T) {
    assert.Equal(t, 20.0, CalculateDamageFalloff(20, 0, 800))
    assert.Equal(t, 20.0, CalculateDamageFalloff(20, 400, 800))
    assert.Equal(t, 10.0, CalculateDamageFalloff(20, 600, 800))
    assert.Equal(t, 0.0, CalculateDamageFalloff(20, 800, 800))
    assert.Equal(t, 0.0, CalculateDamageFalloff(20, 900, 800))
}
```

---

### TS-WEAP-004: Uzi Vertical Recoil Accumulation

**Category**: Unit
**Priority**: High

**Preconditions:**
- Weapon is Uzi
- Recoil: 2° vertical per shot, max 20°

**Input:**
- Fire 5 shots consecutively
- Fire 15 shots consecutively

**Expected Output:**
- After 5 shots: 10° accumulated recoil
- After 15 shots: 20° accumulated recoil (capped at max)

**Go:**
```go
func TestUziRecoilAccumulation(t *testing.T) {
    uzi := NewUzi()

    angle5 := ApplyRecoilToAngle(0, uzi.Recoil, 5, false, false, uzi)
    expectedRad5 := (10.0 * math.Pi) / 180.0
    assert.InDelta(t, expectedRad5, angle5, 0.01)

    angle15 := ApplyRecoilToAngle(0, uzi.Recoil, 15, false, false, uzi)
    expectedRad15 := (20.0 * math.Pi) / 180.0  // Capped at max
    assert.InDelta(t, expectedRad15, angle15, 0.01)
}
```

---

### TS-WEAP-005: Melee Range and Arc Detection

**Category**: Unit
**Priority**: Critical

**Preconditions:**
- Attacker at (100, 100) facing right (aimAngle = 0)
- Bat with 64px range, 90° arc

**Input:**
- Target at (150, 100): 50px away, 0° angle (in front)
- Target at (100, 50): 50px away, 90° angle (above)
- Target at (200, 100): 100px away, 0° angle (too far)

**Expected Output:**
- First target: hit (within range and arc)
- Second target: miss (outside 45° half-arc)
- Third target: miss (outside 64px range)

**Go:**
```go
func TestMeleeRangeAndArc(t *testing.T) {
    attacker := createPlayer(100, 100, 0) // aimAngle = 0 (facing right)
    bat := NewBat()

    targetInFront := createPlayer(150, 100, 0)
    targetAbove := createPlayer(100, 50, 0)
    targetTooFar := createPlayer(200, 100, 0)

    assert.True(t, isInMeleeRange(attacker, targetInFront, bat))
    assert.False(t, isInMeleeRange(attacker, targetAbove, bat))
    assert.False(t, isInMeleeRange(attacker, targetTooFar, bat))
}
```

---

### TS-WEAP-006: Bat Knockback Application

**Category**: Unit
**Priority**: High

**Preconditions:**
- Attacker at (100, 100)
- Target at (140, 100) (40px to the right)
- Bat knockback = 40px

**Input:**
- Apply knockback from attacker to target

**Expected Output:**
- Target moved to (180, 100) (pushed 40px in direction away from attacker)

**Go:**
```go
func TestBatKnockback(t *testing.T) {
    attacker := createPlayer(100, 100, 0)
    target := createPlayer(140, 100, 0)

    applyKnockback(attacker, target, 40)

    pos := target.GetPosition()
    assert.Equal(t, 180.0, pos.X)
    assert.Equal(t, 100.0, pos.Y)
}
```

---

### TS-WEAP-007: Knockback Arena Boundary Clamping

**Category**: Unit
**Priority**: Medium

**Preconditions:**
- Target at (1900, 540) (20px from right edge)
- Bat knockback = 40px

**Input:**
- Apply knockback pushing target right

**Expected Output:**
- Target clamped to (1920, 540) (arena edge, not beyond)

**Go:**
```go
func TestKnockbackBoundaryClamping(t *testing.T) {
    attacker := createPlayer(1860, 540, 0)
    target := createPlayer(1900, 540, 0)

    applyKnockback(attacker, target, 40)

    pos := target.GetPosition()
    assert.Equal(t, 1920.0, pos.X)  // Clamped to arena width
}
```

---

### TS-WEAP-008: Weapon Crate Respawn Timing

**Category**: Integration
**Priority**: High

**Preconditions:**
- Weapon crate available
- Respawn delay = 30 seconds

**Input:**
- Pick up weapon at T=0
- Check availability at T=29s
- Check availability at T=31s

**Expected Output:**
- After pickup: crate unavailable
- At T=29s: crate still unavailable
- At T=31s: crate respawned and available

---

### TS-WEAP-009: Sprint Accuracy Penalty

**Category**: Unit
**Priority**: Medium

**Preconditions:**
- AK47 with 3° movement spread
- Sprint multiplier = 1.5x

**Input:**
- Calculate spread while sprinting

**Expected Output:**
- Base spread when moving: ±3°
- Spread when sprinting: ±4.5° (3° × 1.5)

---

### TS-WEAP-010: Weapon Pickup Replaces Current Weapon

**Category**: Integration
**Priority**: Critical

**Preconditions:**
- Player has AK47 with 15/30 ammo
- Approaches Shotgun crate

**Input:**
- Pick up Shotgun

**Expected Output:**
- Player now has Shotgun
- Ammo reset to 6/6 (full Shotgun magazine)
- Not reloading
- AK47 state is discarded

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-02-02 | Initial specification |
| 1.0.2 | 2026-02-16 | Added `ProjectileVisuals` and `WeaponVisuals` interfaces to TypeScript section, added `projectile` sub-field to JSON example |
| 1.0.1 | 2026-02-16 | Fixed Uzi visual config — muzzleFlashSize=8 (not 6), muzzleFlashDuration=50 (not 30) per `weaponConfig.ts:199-200`. |
