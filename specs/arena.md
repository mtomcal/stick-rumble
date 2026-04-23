# Arena

> **Spec Version**: 2.1.3
> **Last Updated**: 2026-04-22
> **Depends On**: [constants.md](constants.md), [maps.md](maps.md)
> **Depended By**: [player.md](player.md), [movement.md](movement.md), [dodge-roll.md](dodge-roll.md), [weapons.md](weapons.md), [shooting.md](shooting.md), [hit-detection.md](hit-detection.md), [graphics.md](graphics.md)

---

## Overview

The arena is the selected map instance for the current match. It defines world bounds, coordinate space, solid geometry, and the spatial rules that movement, projectiles, spawning, pickups, and line-of-sight checks must obey.

**Why this change?**
- The game no longer assumes a permanently empty `1920x1080` rectangle
- Internal map geometry is now part of the gameplay contract
- The server and client both derive arena behavior from the same map config

---

## Dependencies

### Technology Dependencies

| Technology | Version | Purpose |
|------------|---------|---------|
| Go | 1.25 | Authoritative spatial enforcement |
| TypeScript | 5.9.3 | Client-side rendering and local spatial queries |
| Phaser 3 | 3.90.0 | World bounds, obstacle rendering, camera setup |

### Spec Dependencies

- [constants.md](constants.md) - Player dimensions, projectile and pickup constants
- [maps.md](maps.md) - Match-selected map definition and validation rules

---

## Constants

All arena-adjacent tuning values are defined in [constants.md](constants.md). The selected map defines actual runtime width and height.

| Constant | Value | Unit | Description |
|----------|-------|------|-------------|
| PLAYER_WIDTH | 48 | px | Player hitbox width for clamping and obstacle collision |
| PLAYER_HEIGHT | 48 | px | Player hitbox height for clamping and obstacle collision |
| WEAPON_PICKUP_RADIUS | 32 | px | Distance for weapon crate pickup |
| PROJECTILE_MAX_RANGE | 800 | px | Maximum projectile travel distance |

---

## Data Structures

### Vector2

Position and velocity use a shared 2D vector structure.

**TypeScript:**
```typescript
interface Vector2 {
  x: number;
  y: number;
}
```

**Go:**
```go
type Vector2 struct {
    X float64 `json:"x"`
    Y float64 `json:"y"`
}
```

### Coordinate System

The arena uses screen-space coordinates:

- origin at top-left `(0, 0)`
- X increases to the right
- Y increases downward
- units are pixels

The maximum X and Y extents come from the selected map:

```text
0 <= x <= map.width
0 <= y <= map.height
```

### Player Bounding Box

Players use an axis-aligned bounding box for collision and boundary enforcement.

| Property | Formula |
|----------|---------|
| Half-width | PLAYER_WIDTH / 2 = 24 px |
| Half-height | PLAYER_HEIGHT / 2 = 24 px |
| Left edge | x - 24 |
| Right edge | x + 24 |
| Top edge | y - 24 |
| Bottom edge | y + 24 |

### Arena Obstacle

Arena obstacle geometry is sourced from the selected map's `obstacles` array. In v1 every obstacle is an axis-aligned rectangle with explicit movement, projectile, and LOS blocking flags. See [maps.md](maps.md) for the authoring contract.

---

## Behavior

### Arena Dimensions

Each match uses the width and height declared by its selected map.

**v1 shipped baseline:** the first map remains `1920x1080`, but that value comes from the map file rather than from a universal hardcoded arena assumption.

### Boundary Clamping

Players cannot move outside the selected map bounds. After movement and obstacle resolution, the player position is clamped so the hitbox remains fully inside the map rectangle.

**Algorithm:**
```text
minX = PLAYER_WIDTH / 2
maxX = map.width - PLAYER_WIDTH / 2
minY = PLAYER_HEIGHT / 2
maxY = map.height - PLAYER_HEIGHT / 2
```

Clamp the player center to that range.

**Why clamp rather than bounce?** Clamping creates predictable wall-sliding behavior and keeps server/client reconciliation simple.

### Obstacle Collision

Movement-blocking obstacles are part of authoritative arena collision in v1.

**Rules:**
- players may not occupy movement-blocking obstacle space
- projectiles may not pass through projectile-blocking obstacles
- LOS queries treat LOS-blocking obstacles as opaque
- authoritative blocking geometry is also a hard stop for hitscan traces, melee reachability checks, and forced movement such as knockback
- along any attempted path, the first blocking contact wins and systems may not tunnel through or resolve beyond that contact point
- for live-player contact readability, the authoritative obstacle rectangle edge is the real blocking edge; rendering must not imply a different collision edge

For the first recreated office map, every obstacle blocks movement, projectiles, and line of sight.

### Projectile Boundary Check

Projectiles are destroyed when either:
- they leave the selected map bounds
- they collide with a projectile-blocking obstacle
- they exceed their weapon range or lifetime rules

Projectile out-of-bounds checks use the selected map width and height. Projectile-wall resolution must use the swept path from the previous position to the candidate position for the frame, not only the end-point sample. When that swept path intersects blocking geometry, the projectile terminates at the first blocking contact point and must not continue visually or physically past the barrier.

### Shared Barrier Contract

The selected map's authoritative blocking geometry is the shared source of truth for all spatial systems.

- movement, projectile travel, hitscan traces, melee reachability, LOS, and forced movement all resolve against the same map-authored blockers
- client prediction and local presentation may mirror barrier checks for responsiveness, but the server remains authoritative for whether a barrier stopped the interaction
- if a barrier blocks the path before the intended destination or victim, everything beyond that first blocking contact is treated as unreachable for that resolution step
- the live player's canonical visible footprint from [graphics.md](graphics.md) must read flush to that same authoritative blocker edge within the visual tolerance defined there

### Dodge Roll Boundary Termination

A dodge roll ends immediately if its attempted movement is stopped by either:
- the outer arena bounds
- a movement-blocking obstacle

**Why terminate on collision?** Rolling through blocked geometry would create unintended mobility and make obstacle reads unreliable.

### Spawn And Weapon Ownership

Player spawn points and weapon spawn locations are authored in the selected map, not in this spec.

- player spawn authoring and validation: [maps.md](maps.md)
- weapon spawn authoring and validation: [maps.md](maps.md)
- weapon pickup behavior and respawn timing: [weapons.md](weapons.md)

### Spatial Queries

All core spatial systems use Euclidean distance:

```text
distance = sqrt((x2 - x1)^2 + (y2 - y1)^2)
```

This applies to pickup checks, spawn scoring, projectile range, and similar geometry-driven systems.

---

## Test Scenarios

### TS-ARENA-001: player cannot move beyond left boundary

**Category:** Unit  
**Priority:** Critical

Given a selected map with valid width and height  
When player movement attempts to place the hitbox beyond the left edge  
Then the player center is clamped to the minimum valid X

### TS-ARENA-002: player cannot move beyond right boundary

**Category:** Unit  
**Priority:** Critical

Given a selected map with valid width and height  
When player movement attempts to place the hitbox beyond the right edge  
Then the player center is clamped to the maximum valid X

### TS-ARENA-003: player collides with movement-blocking obstacle

**Category:** Unit  
**Priority:** Critical

Given a movement-blocking obstacle from the selected map  
When a player attempts to move into it  
Then authoritative movement resolution prevents overlap and the obstacle's rectangle edge remains the real blocking edge for live-player contact reads

### TS-ARENA-004: projectile is destroyed by projectile-blocking obstacle

**Category:** Integration  
**Priority:** Critical

Given a projectile path intersecting an obstacle that blocks projectiles  
When the projectile reaches the obstacle  
Then it is destroyed and does not continue through the geometry

### TS-ARENA-005: dodge roll ends on obstacle collision

**Category:** Integration  
**Priority:** High

Given a rolling player intersecting blocking geometry  
When the roll movement is stopped by collision  
Then the roll ends immediately and cooldown still applies

### TS-ARENA-006: first blocking contact wins for shared barrier resolution

**Category:** Integration  
**Priority:** Critical

Given authoritative blocking geometry between an origin and a later destination or victim  
When a movement, attack, LOS, or forced-movement path reaches the barrier first  
Then resolution stops at that first blocking contact and nothing beyond it is treated as reachable in that step

### TS-ARENA-007: authoritative obstacle edge is the visual contact edge for live players

**Category:** Integration  
**Priority:** High

Given a live player rendered flush against a movement-blocking obstacle  
When the player body reaches north, east, south, or west contact against that obstacle  
Then the visible contact read is anchored to the obstacle's authoritative rectangle edge rather than to decorative stroke or shading

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 2.1.3 | 2026-04-22 | Updated the authoritative player bounding box from 32x32 to 48x48. Arena clamping and obstacle collision examples now use a 24px half-size. |
| 2.1.2 | 2026-04-22 | Updated the authoritative player bounding box to 32x32. Arena clamping and obstacle collision examples now use a 16px half-height instead of 32px. |
| 2.1.1 | 2026-04-22 | Clarified that the obstacle rectangle edge is the real blocking edge for live-player contact reads. Cross-referenced the canonical visible-footprint contract from `graphics.md` and added TS-ARENA-007 for visual edge alignment. |
| 2.1.0 | 2026-04-17 | Introduced map-selected arena geometry as the authoritative source for movement bounds, obstacle collision, LOS blocking, projectile blocking, and spawn-space validation. Added shared barrier contract and first-blocking-contact rule across movement, projectiles, melee, LOS, and forced movement. |
