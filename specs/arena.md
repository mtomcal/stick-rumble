# Arena

> **Spec Version**: 1.0.0
> **Last Updated**: 2026-02-02
> **Depends On**: [constants.md](constants.md)
> **Depended By**: [player.md](player.md), [movement.md](movement.md), [dodge-roll.md](dodge-roll.md), [weapons.md](weapons.md), [shooting.md](shooting.md), [hit-detection.md](hit-detection.md), [graphics.md](graphics.md)

---

## Overview

The arena is the game world where all gameplay occurs. It defines the physical boundaries, coordinate system, and spatial rules that all entities must obey. Every position, movement calculation, and collision check references the arena's dimensions.

**Why a fixed-size arena?** A 1920x1080 arena matches standard 1080p displays, ensuring the entire play area is visible without scrolling. This creates fair gameplay where all players have equal visibility and no off-screen surprises.

**Why server-authoritative boundaries?** The server enforces arena boundaries to prevent position hacking. Clients mirror the same logic for responsive local prediction, but server state is always authoritative.

---

## Dependencies

### Technology Dependencies

| Technology | Version | Purpose |
|------------|---------|---------|
| Go | 1.25 | Server-side physics and boundary enforcement |
| TypeScript | 5.9.3 | Client-side prediction and rendering |
| Phaser 3 | 3.90.0 | World bounds and camera setup |

### Spec Dependencies

- [constants.md](constants.md) - Arena dimensions (ARENA_WIDTH, ARENA_HEIGHT)

---

## Constants

All arena-related constants are defined in [constants.md](constants.md). Key values:

| Constant | Value | Unit | Description |
|----------|-------|------|-------------|
| ARENA_WIDTH | 1920 | px | Horizontal play area |
| ARENA_HEIGHT | 1080 | px | Vertical play area |
| PLAYER_WIDTH | 32 | px | Player hitbox width (used in boundary clamping) |
| PLAYER_HEIGHT | 64 | px | Player hitbox height (used in boundary clamping) |
| SPAWN_MARGIN | 100 | px | Distance from edges for player spawns |
| WEAPON_PICKUP_RADIUS | 32 | px | Distance for weapon crate pickup |
| PROJECTILE_MAX_RANGE | 800 | px | Maximum projectile travel distance |

---

## Data Structures

### Vector2

Position and velocity throughout the game use a 2D vector structure.

**Why Vector2?** All spatial calculations require X and Y components. A consistent structure prevents errors and enables code reuse across physics, collision, and rendering.

**TypeScript:**
```typescript
interface Vector2 {
  x: number;  // horizontal position (0 = left edge)
  y: number;  // vertical position (0 = top edge)
}
```

**Go:**
```go
type Vector2 struct {
    X float64 `json:"x"` // horizontal position (0 = left edge)
    Y float64 `json:"y"` // vertical position (0 = top edge)
}
```

### Coordinate System

The arena uses a **screen-space coordinate system**:

- **Origin**: Top-left corner at (0, 0)
- **X-axis**: Increases rightward (0 to 1920)
- **Y-axis**: Increases downward (0 to 1080)
- **Units**: Pixels

**Why top-left origin?** This matches browser canvas and Phaser conventions. Using screen-space coordinates eliminates conversion bugs between game logic and rendering.

```
(0, 0)────────────────────────────────(1920, 0)
  │                                      │
  │              ARENA                   │
  │                                      │
  │            (960, 540)                │
  │              center                  │
  │                                      │
(0, 1080)────────────────────────(1920, 1080)
```

### Bounding Box

Players use an **Axis-Aligned Bounding Box (AABB)** for collision detection.

**Why AABB?** Stick figures rotate to aim, but using axis-aligned boxes simplifies collision math and matches player expectations of "fair" hitboxes. Rotated hitboxes would create unintuitive hit/miss scenarios.

```
Player position is CENTER of hitbox:

        ┌─────────┐  ← top = y - 32
        │         │
        │    X    │  ← center = (x, y)
        │         │
        └─────────┘  ← bottom = y + 32
        ↑         ↑
       left     right
     (x - 16)  (x + 16)
```

| Property | Formula |
|----------|---------|
| Half-width | PLAYER_WIDTH / 2 = 16 px |
| Half-height | PLAYER_HEIGHT / 2 = 32 px |
| Left edge | x - 16 |
| Right edge | x + 16 |
| Top edge | y - 32 |
| Bottom edge | y + 32 |

---

## Behavior

### Arena Dimensions

The arena is a rectangle with fixed dimensions:

- **Width**: 1920 pixels
- **Height**: 1080 pixels
- **Aspect ratio**: 16:9

**Why 1920x1080?**
1. Matches full HD displays (most common resolution)
2. Provides ~60,000 square pixels per player (with 8 players)
3. 40 Phaser tiles at 48px each = 1920px
4. Creates competitive visibility - entire arena fits on screen

**Constants:**
```typescript
// TypeScript (constants.ts)
export const ARENA = {
  WIDTH: 1920,
  HEIGHT: 1080,
} as const;
```

```go
// Go (constants.go)
const (
    ArenaWidth  = 1920.0
    ArenaHeight = 1080.0
)
```

> **Note:** There is no standalone `isInArena()` / `IsInArena()` function. Boundary checking is done inline via clamping (`physics.go:186-187`), projectile `IsOutOfBounds()` (`projectile.go:62-63`), and physics validation (`physics.go:340-341`).

### Boundary Clamping

Players cannot move outside the arena. Position is **clamped** to valid bounds after every physics update.

**Why clamp rather than bounce?** Clamping creates predictable "wall-sliding" behavior. Bouncing would cause chaotic movement near walls and feel uncontrolled.

**Algorithm:**
```
function clampToArena(position):
    halfWidth = PLAYER_WIDTH / 2    // 16 px
    halfHeight = PLAYER_HEIGHT / 2  // 32 px

    // Clamp X so hitbox stays inside arena
    minX = halfWidth                // 16
    maxX = ARENA_WIDTH - halfWidth  // 1904
    clampedX = max(minX, min(position.x, maxX))

    // Clamp Y so hitbox stays inside arena
    minY = halfHeight               // 32
    maxY = ARENA_HEIGHT - halfHeight // 1048
    clampedY = max(minY, min(position.y, maxY))

    return Vector2(clampedX, clampedY)
```

**Boundary Limits (for player center):**

| Boundary | Min Value | Max Value |
|----------|-----------|-----------|
| X (horizontal) | 16 | 1904 |
| Y (vertical) | 32 | 1048 |

**TypeScript:**
```typescript
export function clampToArena(pos: Vector2): Vector2 {
  const halfWidth = PLAYER.WIDTH / 2;   // 16
  const halfHeight = PLAYER.HEIGHT / 2; // 32

  return {
    x: Math.max(halfWidth, Math.min(pos.x, ARENA.WIDTH - halfWidth)),
    y: Math.max(halfHeight, Math.min(pos.y, ARENA.HEIGHT - halfHeight)),
  };
}
```

**Go:**
```go
func clampToArena(pos Vector2) Vector2 {
    halfWidth := PlayerWidth / 2.0   // 16
    halfHeight := PlayerHeight / 2.0 // 32

    return Vector2{
        X: math.Max(halfWidth, math.Min(pos.X, ArenaWidth-halfWidth)),
        Y: math.Max(halfHeight, math.Min(pos.Y, ArenaHeight-halfHeight)),
    }
}
```

### Projectile Boundary Check

Projectiles are destroyed immediately when they exit the arena bounds.

**Why destroy at boundary?** Projectiles outside the arena can never hit players, so tracking them wastes server resources. Immediate destruction keeps the game state clean.

**Algorithm:**
```
function isOutOfBounds(position):
    return position.x < 0
        OR position.x > ARENA_WIDTH
        OR position.y < 0
        OR position.y > ARENA_HEIGHT
```

**Note:** Projectiles use their center point for boundary checks (no hitbox offset like players).

**TypeScript:**
```typescript
function isOutOfBounds(position: Vector2): boolean {
  return (
    position.x < 0 ||
    position.x > ARENA.WIDTH ||
    position.y < 0 ||
    position.y > ARENA.HEIGHT
  );
}
```

**Go:**
```go
func (p *Projectile) IsOutOfBounds() bool {
    return p.Position.X < 0 || p.Position.X > ArenaWidth ||
           p.Position.Y < 0 || p.Position.Y > ArenaHeight
}
```

### Dodge Roll Boundary Termination

When a player hits a wall during a dodge roll, the roll ends immediately.

**Why terminate roll on wall hit?** Allowing players to "slide" along walls during a roll would provide unintended mobility. Termination creates a cost for misjudging distance.

**Detection algorithm:**
```
function updatePlayerPosition(player, newPosition):
    clampedPosition = clampToArena(newPosition)

    if player.isRolling():
        // Check if clamping changed the position (wall collision)
        if clampedPosition.x != newPosition.x OR clampedPosition.y != newPosition.y:
            player.endDodgeRoll()
            // Cooldown still applies

    player.position = clampedPosition
```

**Behavior:**
1. Roll velocity pushes player toward wall
2. `clampToArena()` stops player at wall
3. Difference detected between requested and clamped position
4. `endDodgeRoll()` called, player snapped to wall position
5. Cooldown timer starts (3 seconds)
6. Player regains normal control immediately

**TypeScript:**
```typescript
function updatePosition(player: Player, newPos: Vector2): void {
  const clampedPos = clampToArena(newPos);

  if (player.isRolling) {
    if (clampedPos.x !== newPos.x || clampedPos.y !== newPos.y) {
      player.endDodgeRoll(); // Wall collision during roll
    }
  }

  player.position = clampedPos;
}
```

**Go (inline in `UpdatePlayer`, not a separate method):**
```go
// Inside func (p *Physics) UpdatePlayer(player *PlayerState, deltaTime float64) UpdatePlayerResult:
clampedPos := clampToArena(newPos)

isRolling := player.IsRolling()
if isRolling && (clampedPos.X != newPos.X || clampedPos.Y != newPos.Y) {
    player.EndDodgeRoll()
    result.RollCancelled = true
}

clampedPos = sanitizeVector2(clampedPos, "UpdatePlayer position")
player.SetPosition(clampedPos)
```

> **Note:** There is no separate `UpdatePlayerPosition` method. Wall-collision roll termination is inline in `UpdatePlayer` alongside normal movement, anti-cheat validation, and position sanitization.

---

## Spawn Points

### Player Spawn Algorithm

Players spawn at positions that maximize distance from enemies, preventing spawn camping.

**Why balanced spawning?** Random spawning can place players directly next to enemies, creating unfair deaths. Distance-based spawning gives every player a fighting chance after respawn.

**Algorithm:**
```
SPAWN_MARGIN = 100  // pixels from arena edge

function getBalancedSpawnPoint(players):
    // Define valid spawn region (100px margin from all edges)
    minX = SPAWN_MARGIN               // 100
    maxX = ARENA_WIDTH - SPAWN_MARGIN // 1820
    minY = SPAWN_MARGIN               // 100
    maxY = ARENA_HEIGHT - SPAWN_MARGIN // 980

    // Get positions of all living enemies
    enemies = [p.position for p in players if p.isAlive]

    // If no enemies, spawn at center
    if enemies.length == 0:
        return Vector2(ARENA_WIDTH / 2, ARENA_HEIGHT / 2)  // (960, 540)

    bestCandidate = null
    bestMinDistance = -1

    // Try 10 random candidates
    for i in 1..10:
        candidate = Vector2(
            random(minX, maxX),
            random(minY, maxY)
        )

        // Find minimum distance to any enemy
        minDistanceToEnemy = infinity
        for enemy in enemies:
            distance = calculateDistance(candidate, enemy)
            minDistanceToEnemy = min(minDistanceToEnemy, distance)

        // Keep candidate with largest minimum distance
        if minDistanceToEnemy > bestMinDistance:
            bestMinDistance = minDistanceToEnemy
            bestCandidate = candidate

    return bestCandidate
```

**Spawn Region:**

```
(100, 100)────────────────────────(1820, 100)
    │                                  │
    │        VALID SPAWN REGION        │
    │                                  │
    │            (960, 540)            │
    │           fallback point         │
    │                                  │
(100, 980)────────────────────────(1820, 980)

Margin = 100px from all edges
```

**TypeScript:**
```typescript
function getBalancedSpawnPoint(players: Player[]): Vector2 {
  const SPAWN_MARGIN = 100;
  const minX = SPAWN_MARGIN;
  const maxX = ARENA.WIDTH - SPAWN_MARGIN;
  const minY = SPAWN_MARGIN;
  const maxY = ARENA.HEIGHT - SPAWN_MARGIN;

  const enemies = players.filter((p) => p.isAlive).map((p) => p.position);

  if (enemies.length === 0) {
    return { x: ARENA.WIDTH / 2, y: ARENA.HEIGHT / 2 };
  }

  let bestCandidate: Vector2 = { x: ARENA.WIDTH / 2, y: ARENA.HEIGHT / 2 };
  let bestMinDistance = -1;

  for (let i = 0; i < 10; i++) {
    const candidate = {
      x: minX + Math.random() * (maxX - minX),
      y: minY + Math.random() * (maxY - minY),
    };

    const minDistanceToEnemy = Math.min(
      ...enemies.map((e) => calculateDistance(candidate, e))
    );

    if (minDistanceToEnemy > bestMinDistance) {
      bestMinDistance = minDistanceToEnemy;
      bestCandidate = candidate;
    }
  }

  return bestCandidate;
}
```

**Go:**
```go
func (w *World) getBalancedSpawnPointLocked(excludePlayerID string) Vector2 {
    // Collect living enemy positions (excluding the respawning player)
    enemyPositions := make([]Vector2, 0)
    for id, player := range w.players {
        if id != excludePlayerID && !player.IsDead() {
            enemyPositions = append(enemyPositions, player.GetPosition())
        }
    }

    // Default to center if no enemies
    if len(enemyPositions) == 0 {
        return Vector2{X: ArenaWidth / 2, Y: ArenaHeight / 2}
    }

    bestSpawn := Vector2{X: ArenaWidth / 2, Y: ArenaHeight / 2}
    bestMinDistance := 0.0

    for i := 0; i < 10; i++ {
        margin := 100.0

        // Uses instance w.rng (not global rand) under w.rngMu lock
        w.rngMu.Lock()
        candidate := Vector2{
            X: margin + w.rng.Float64()*(ArenaWidth-2*margin),
            Y: margin + w.rng.Float64()*(ArenaHeight-2*margin),
        }
        w.rngMu.Unlock()

        minDistance := 1e18
        for _, enemyPos := range enemyPositions {
            dist := distance(candidate, enemyPos)
            if dist < minDistance {
                minDistance = dist
            }
        }

        if minDistance > bestMinDistance {
            bestMinDistance = minDistance
            bestSpawn = candidate
        }
    }

    return bestSpawn
}
```

### Weapon Crate Spawn Locations

Weapon crates spawn at **5 fixed positions** arranged in a pentagon pattern.

**Why fixed positions?** Fixed positions create predictable map control. Players learn the layout and can make strategic decisions about which weapons to contest. Random spawns would remove this skill element.

**Why a pentagon?** A pentagon provides:
- One crate near each corner region
- One crate at center-bottom (high-risk melee)
- Balanced coverage across the arena
- Natural rotation paths for players

| Weapon | Position | Arena % | Why This Location |
|--------|----------|---------|-------------------|
| Uzi | (960, 216) | (50%, 20%) | Center top - easy early grab, low-tier weapon |
| AK47 | (480, 540) | (25%, 50%) | Left mid - contested power position |
| Shotgun | (1440, 540) | (75%, 50%) | Right mid - mirrors AK47 for balance |
| Katana | (960, 864) | (50%, 80%) | Center bottom - high-risk melee in open |
| Bat | (288, 162) | (15%, 15%) | Top left corner - early aggressive pickup |

**Visual Layout:**
```
        Bat                    Uzi
       (288,162)              (960,216)
           ●                     ●



     AK47                             Shotgun
    (480,540)                        (1440,540)
       ●                                ●


                   Katana
                  (960,864)
                     ●
```

**Go:**
```go
func NewWeaponCrateManager() *WeaponCrateManager {
    manager := &WeaponCrateManager{
        crates: make(map[string]*WeaponCrate),  // map, not slice
    }
    manager.InitializeDefaultSpawns()
    return manager
}

func (wcm *WeaponCrateManager) InitializeDefaultSpawns() {
    spawns := []struct {
        Position   Vector2
        WeaponType string
    }{
        {Position: Vector2{X: ArenaWidth / 2, Y: ArenaHeight * 0.2}, WeaponType: "uzi"},
        {Position: Vector2{X: ArenaWidth * 0.25, Y: ArenaHeight / 2}, WeaponType: "ak47"},
        {Position: Vector2{X: ArenaWidth * 0.75, Y: ArenaHeight / 2}, WeaponType: "shotgun"},
        {Position: Vector2{X: ArenaWidth / 2, Y: ArenaHeight * 0.8}, WeaponType: "katana"},
        {Position: Vector2{X: ArenaWidth * 0.15, Y: ArenaHeight * 0.15}, WeaponType: "bat"},
    }

    for i, spawn := range spawns {
        crateID := fmt.Sprintf("crate_%s_%d", spawn.WeaponType, i)
        wcm.crates[crateID] = &WeaponCrate{
            ID:          crateID,       // e.g., "crate_uzi_0"
            Position:    spawn.Position,
            WeaponType:  spawn.WeaponType,
            IsAvailable: true,
        }
    }
}
```

---

## Spatial Queries

### Distance Calculation

**Euclidean distance** is used for all spatial calculations.

**Why Euclidean?** Real-world "as the crow flies" distance matches player intuition. Manhattan distance would create unintuitive weapon range shapes.

**Formula:**
```
distance = sqrt((x2 - x1)² + (y2 - y1)²)
```

**TypeScript:**
```typescript
export function calculateDistance(pos1: Vector2, pos2: Vector2): number {
  const dx = pos2.x - pos1.x;
  const dy = pos2.y - pos1.y;
  return Math.sqrt(dx * dx + dy * dy);
}
```

**Go:**
```go
func calculateDistance(pos1, pos2 Vector2) float64 {
    dx := pos2.X - pos1.X
    dy := pos2.Y - pos1.Y
    return math.Sqrt(dx*dx + dy*dy)
}
```

### AABB Collision Check

Used for projectile-player hit detection.

**Why AABB?** Fast O(1) collision check. Perfect for rectangular hitboxes. More complex shapes (circles, rotated rectangles) would require more expensive math without gameplay benefit.

**Algorithm:**
```
function checkAABBCollision(point, center, halfWidth, halfHeight):
    return abs(point.x - center.x) < halfWidth
       AND abs(point.y - center.y) < halfHeight
```

**TypeScript:**
```typescript
export function checkAABBCollision(
  point: Vector2,
  center: Vector2,
  halfWidth: number,
  halfHeight: number
): boolean {
  return (
    Math.abs(point.x - center.x) < halfWidth &&
    Math.abs(point.y - center.y) < halfHeight
  );
}
```

> **Note:** There is no standalone `CheckAABBCollision()` Go function. AABB collision is done inline within `physics.CheckProjectilePlayerCollision()` (`physics.go:252-299`). The TypeScript version may exist as a client utility but the Go server inlines the math.

### Weapon Pickup Proximity

Players can pick up weapon crates when within **32 pixels** of the crate center.

**Why 32 pixels?** Equals player width. Player must be "touching" the crate - no ranged pickups. Creates risk/reward for grabbing weapons during combat.

**Algorithm:**
```
function canPickupWeapon(player, crate):
    if player.isDead: return false
    if not crate.isAvailable: return false

    distance = calculateDistance(player.position, crate.position)
    return distance <= WEAPON_PICKUP_RADIUS  // 32 px
```

**TypeScript:**
```typescript
function canPickupWeapon(player: Player, crate: WeaponCrate): boolean {
  if (player.isDead) return false;
  if (!crate.isAvailable) return false;

  const distance = calculateDistance(player.position, crate.position);
  return distance <= WEAPON_PICKUP_RADIUS; // 32
}
```

**Go:**
```go
func (p *Physics) CheckPlayerCrateProximity(player *PlayerState, crate *WeaponCrate) bool {
    if player.IsDead() {
        return false
    }
    if !crate.IsAvailable {
        return false
    }

    distance := calculateDistance(player.GetPosition(), crate.Position)
    return distance <= WeaponPickupRadius // 32
}
```

---

## Error Handling

### Invalid Position Recovery

**Trigger**: Player position somehow becomes NaN or Infinity (rare edge case)
**Detection**: `sanitizeVector2()` checks `math.IsNaN()` and `math.IsInf()` on each component
**Response**: Replace NaN/Inf component with **0** (not arena center)
**Why**: Prevents cascading errors in physics calculations. Uses 0 as a safe fallback since arena clamping handles positioning afterward.

### Out-of-Bounds Recovery

**Trigger**: Player position outside arena (should not happen with clamping)
**Detection**: Position beyond [0, 1920] or [0, 1080]
**Response**: Clamp to nearest valid position
**Why**: Defensive programming against edge cases

---

## Implementation Notes

### TypeScript (Client)

1. **Phaser World Bounds**: Set during scene creation
   ```typescript
   this.physics.world.setBounds(0, 0, ARENA.WIDTH, ARENA.HEIGHT);
   this.cameras.main.setBounds(0, 0, ARENA.WIDTH, ARENA.HEIGHT);
   ```

2. **Background**: Draw arena as a solid rectangle
   ```typescript
   this.add.rectangle(0, 0, ARENA.WIDTH, ARENA.HEIGHT, 0x222222).setOrigin(0, 0);
   ```

3. **Local Prediction**: Client mirrors server's `clampToArena()` for responsive movement

### Go (Server)

1. **Thread Safety**: Arena constants are read-only, no mutex needed

2. **Physics Order**:
   1. Calculate new position from velocity
   2. Clamp to arena bounds
   3. Check for roll wall collision
   4. Update player state

3. **Spawn Point Locking**: `getBalancedSpawnPointLocked()` assumes world mutex is held

---

## Test Scenarios

### TS-ARENA-001: Player cannot move beyond left boundary

**Category**: Unit
**Priority**: Critical

**Preconditions:**
- Player at position (20, 540)
- Velocity (-100, 0) - moving left

**Input:**
- Update physics for 1 second

**Expected Output:**
- Player X position = 16 (not less)
- Player Y position = 540 (unchanged)

**Why**: Validates left boundary clamping at minimum X

**TypeScript (Vitest):**
```typescript
it('should clamp player to left boundary', () => {
  const pos = clampToArena({ x: -100, y: 540 });
  expect(pos.x).toBe(16);
  expect(pos.y).toBe(540);
});
```

**Go:**
```go
func TestClampToArenaLeft(t *testing.T) {
    pos := clampToArena(Vector2{X: -100, Y: 540})
    assert.Equal(t, 16.0, pos.X)
    assert.Equal(t, 540.0, pos.Y)
}
```

### TS-ARENA-002: Player cannot move beyond right boundary

**Category**: Unit
**Priority**: Critical

**Preconditions:**
- Player at position (1900, 540)
- Velocity (100, 0) - moving right

**Input:**
- Update physics for 1 second

**Expected Output:**
- Player X position = 1904 (not more)
- Player Y position = 540 (unchanged)

**Why**: Validates right boundary clamping at maximum X

### TS-ARENA-003: Player cannot move beyond top boundary

**Category**: Unit
**Priority**: Critical

**Preconditions:**
- Player at position (960, 40)
- Velocity (0, -100) - moving up

**Input:**
- Update physics for 1 second

**Expected Output:**
- Player X position = 960 (unchanged)
- Player Y position = 32 (not less)

**Why**: Validates top boundary clamping at minimum Y

### TS-ARENA-004: Player cannot move beyond bottom boundary

**Category**: Unit
**Priority**: Critical

**Preconditions:**
- Player at position (960, 1040)
- Velocity (0, 100) - moving down

**Input:**
- Update physics for 1 second

**Expected Output:**
- Player X position = 960 (unchanged)
- Player Y position = 1048 (not more)

**Why**: Validates bottom boundary clamping at maximum Y

### TS-ARENA-005: Projectile destroyed at boundary

**Category**: Unit
**Priority**: High

**Preconditions:**
- Projectile at position (1919, 540)
- Velocity (800, 0) - moving right

**Input:**
- Update projectile position

**Expected Output:**
- Projectile marked for destruction (isOutOfBounds = true)

**Why**: Validates projectile cleanup at boundaries

**TypeScript (Vitest):**
```typescript
it('should detect projectile out of bounds', () => {
  const result = isOutOfBounds({ x: 1921, y: 540 });
  expect(result).toBe(true);
});
```

### TS-ARENA-006: Dodge roll terminates at boundary

**Category**: Integration
**Priority**: High

**Preconditions:**
- Player at position (50, 540)
- Player initiates dodge roll toward left wall
- Roll direction (-1, 0)

**Input:**
- Simulate roll physics until completion or wall hit

**Expected Output:**
- Player X position = 16 (at boundary)
- Player isRolling = false
- Player rollCooldown started

**Why**: Validates roll wall collision detection

### TS-ARENA-007: Weapon crates spawn at correct positions

**Category**: Unit
**Priority**: Medium

**Preconditions:**
- New game initialized

**Input:**
- Get all weapon crate positions

**Expected Output:**
- Uzi at (960, 216)
- AK47 at (480, 540)
- Shotgun at (1440, 540)
- Katana at (960, 864)
- Bat at (288, 162)

**Why**: Validates fixed spawn configuration

**TypeScript (Vitest):**
```typescript
it('should have correct weapon crate positions', () => {
  const crates = createWeaponCrates();
  expect(crates.uzi.position).toEqual({ x: 960, y: 216 });
  expect(crates.ak47.position).toEqual({ x: 480, y: 540 });
  expect(crates.shotgun.position).toEqual({ x: 1440, y: 540 });
  expect(crates.katana.position).toEqual({ x: 960, y: 864 });
  expect(crates.bat.position).toEqual({ x: 288, y: 162 });
});
```

### TS-ARENA-008: Balanced spawn avoids enemies

**Category**: Integration
**Priority**: Medium

**Preconditions:**
- Enemy at position (200, 200)

**Input:**
- Get balanced spawn point

**Expected Output:**
- Spawn point distance from enemy > 500 pixels (usually)
- Spawn point within valid region [100, 1820] x [100, 980]

**Why**: Validates spawn algorithm provides reasonable distance

### TS-ARENA-009: Spawn fallback to center when no enemies

**Category**: Unit
**Priority**: Medium

**Preconditions:**
- No living players in arena

**Input:**
- Get balanced spawn point

**Expected Output:**
- Spawn point = (960, 540) - arena center

**Why**: Validates default spawn behavior

### TS-ARENA-010: Distance calculation is accurate

**Category**: Unit
**Priority**: Medium

**Preconditions:**
- Point A at (0, 0)
- Point B at (3, 4)

**Input:**
- Calculate distance between A and B

**Expected Output:**
- Distance = 5 (3-4-5 triangle)

**Why**: Validates Euclidean distance formula

**TypeScript (Vitest):**
```typescript
it('should calculate correct Euclidean distance', () => {
  const distance = calculateDistance({ x: 0, y: 0 }, { x: 3, y: 4 });
  expect(distance).toBe(5);
});
```

**Go:**
```go
func TestCalculateDistance(t *testing.T) {
    dist := calculateDistance(Vector2{X: 0, Y: 0}, Vector2{X: 3, Y: 4})
    assert.Equal(t, 5.0, dist)
}
```

### TS-ARENA-011: Weapon pickup radius check works

**Category**: Unit
**Priority**: Medium

**Preconditions:**
- Player at (960, 216)
- Uzi crate at (960, 216)

**Input:**
- Check pickup proximity

**Expected Output:**
- canPickup = true (distance = 0, within 32px radius)

**Why**: Validates pickup radius calculation

### TS-ARENA-012: Player cannot pick up weapon from far away

**Category**: Unit
**Priority**: Medium

**Preconditions:**
- Player at (100, 100)
- Uzi crate at (960, 216)

**Input:**
- Check pickup proximity

**Expected Output:**
- canPickup = false (distance > 32px)

**Why**: Validates pickup radius rejection

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.3 | 2026-02-16 | Removed nonexistent `CheckAABBCollision` standalone Go function — AABB is inlined in `CheckProjectilePlayerCollision`. Removed nonexistent `IsInArena` — boundary checking done inline. Renamed `CanPickupWeapon` → `CheckPlayerCrateProximity` to match source. |
| 1.0.0 | 2026-02-02 | Initial specification extracted from codebase |
