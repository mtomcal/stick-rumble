# Level Generator (Pre-BMM Archive)

> **Spec Version**: 1.0.0
> **Last Updated**: 2026-02-15
> **Archive Snapshot**: 2025-11-25 05:55:21
> **Source Files**: `game/world/LevelGenerator.ts` (69 lines)
> **Depends On**: [config.md](config.md)
> **Depended By**: [pathfinder.md](pathfinder.md), [main-scene.md](main-scene.md), [rendering.md](rendering.md), [ai.md](ai.md)

---

## Overview

The `LevelGenerator` class builds the static office-arena environment: a floor grid and a set of wall/desk obstacles. It is instantiated once during `MainScene.create()` and produces all the physical geometry that players, enemies, and projectiles collide with. Its output is a Phaser `StaticGroup` of `Rectangle` game objects that feed into:

- **Arcade Physics colliders** — blocking movement for players, enemies, and bullets
- **Pathfinder nav grid** — `buildNavGrid()` consumes the wall children to mark blocked tiles
- **Line-of-sight checks** — `wallBounds[]` (extracted from the group in MainScene) is used by `hasLineOfSight()` and `fireBullet()` for LOS occlusion
- **Minimap rendering** — walls are drawn on the static minimap overlay

The class exposes exactly two public methods: `drawFloorGrid()` and `createOfficeLayout()`. There is no dynamic level generation, no randomization, and no configuration — the layout is hardcoded.

---

## Dependencies

### Technology Dependencies

| Technology | Version | Purpose |
|------------|---------|---------|
| Phaser 3 | ^3.90.0 | `Scene`, `GameObjects.Graphics`, `Physics.Arcade.StaticGroup`, `Physics.Arcade.Body`, `GameObjects.Rectangle` |
| TypeScript | ~5.8.2 | Type-safe source |

### File Dependencies

| File | Relationship |
|------|-------------|
| `game/world/LevelGenerator.ts` | This class |
| `game/scenes/MainScene.ts` | Creates instance, passes `walls` StaticGroup, calls both public methods |
| `game/systems/Pathfinder.ts` | Consumes the wall children via `buildNavGrid()` |

---

## Constants

The world size is **1600x1600 pixels**. All coordinates below use Phaser's center-origin convention: `(x, y)` is the center of the rectangle, and `(w, h)` is the full width and height.

### Colors

| Name | Hex | Usage |
|------|-----|-------|
| Wall color | `0x37474f` | Interior walls and boundary walls |
| Desk color | `0x795548` | Desk obstacles |
| Desk stroke | `0x4e342e` | 2px border on desks |
| Floor grid | `0xb0bec5` | Grid lines at 0.5 alpha |

### Grid

| Constant | Value | Description |
|----------|-------|-------------|
| Grid cell size | 100 px | Spacing between floor grid lines |
| Grid extent | 0–1600 | Covers full world in both axes |
| Grid line width | 1 px | Thin guide lines |
| Grid alpha | 0.5 | Semi-transparent |
| Grid depth | -1 | Rendered behind all other objects |

---

## Data Structures

### LevelGenerator

```typescript
class LevelGenerator {
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene);
  public drawFloorGrid(): void;
  public createOfficeLayout(wallsGroup: Phaser.Physics.Arcade.StaticGroup): void;
}
```

The class holds only a reference to the Phaser scene. It has no internal state beyond that reference — it is essentially a builder that populates external data structures (the `wallsGroup` and the scene's display list).

---

## Behavior

### Floor Grid Drawing

`drawFloorGrid()` creates a set of horizontal and vertical grid lines across the 1600x1600 world using a single `Graphics` object.

**Source**: `LevelGenerator.ts:10–23`

```typescript
public drawFloorGrid() {
  const graphics = this.scene.add.graphics();
  graphics.lineStyle(1, 0xb0bec5, 0.5);
  // Vertical lines every 100px from x=0 to x=1600
  for (let x = 0; x <= 1600; x += 100) {
    graphics.moveTo(x, 0);
    graphics.lineTo(x, 1600);
  }
  // Horizontal lines every 100px from y=0 to y=1600
  for (let y = 0; y <= 1600; y += 100) {
    graphics.moveTo(0, y);
    graphics.lineTo(1600, y);
  }
  graphics.strokePath();
  graphics.setDepth(-1);
}
```

This produces a 17x17 grid of lines (0, 100, 200, … 1600). The depth of `-1` ensures the grid renders behind all game objects.

### Office Layout Creation

`createOfficeLayout(wallsGroup)` populates the provided `StaticGroup` with wall and desk rectangles. Each rectangle is added to the Phaser physics system as an immovable, non-moving static body.

**Source**: `LevelGenerator.ts:25–68`

The method defines two internal factory functions:

1. **`createBlock(x, y, w, h, color)`** — Creates a `Phaser.GameObjects.Rectangle`, adds it to the physics system as a static body, sets `immovable = true` and `moves = false`, then adds it to `wallsGroup`.
2. **`createWall(x, y, w, h)`** — Calls `createBlock` with wall color `0x37474f`.
3. **`createDesk(x, y, w, h)`** — Calls `createBlock` with desk color `0x795548`, then applies a 2px stroke of `0x4e342e`.

Walls and desks behave identically for physics — both block movement and bullets. The only difference is visual (color and stroke).

### Object Inventory

All coordinates are `(centerX, centerY, width, height)`.

#### Boundary Walls (4)

Thick boundary walls prevent entities from escaping the arena. Each boundary is 120px thick and extends along the full 1600px edge.

| Label | x | y | w | h | Notes |
|-------|---|---|---|---|-------|
| Top boundary | 800 | 0 | 1600 | 120 | Centered at y=0 (extends 60px above and below) |
| Bottom boundary | 800 | 1600 | 1600 | 120 | Centered at y=1600 |
| Left boundary | 0 | 800 | 120 | 1600 | Centered at x=0 |
| Right boundary | 1600 | 800 | 120 | 1600 | Centered at x=1600 |

The effective playable area is approximately **60–1540** on both axes (from the inner edges of the 120px-thick boundaries).

#### Interior Walls (4)

| Label | x | y | w | h | Notes |
|-------|---|---|---|---|-------|
| Left vertical wall | 500 | 400 | 64 | 800 | Tall wall dividing left side |
| Right vertical wall | 1100 | 1200 | 64 | 800 | Tall wall dividing right side |
| Upper horizontal wall | 800 | 600 | 600 | 64 | Spans center-left to center-right |
| Lower horizontal wall | 800 | 1000 | 600 | 64 | Spans center-left to center-right |

#### Pillars (2)

| Label | x | y | w | h |
|-------|---|---|---|---|
| Left pillar | 600 | 800 | 64 | 64 |
| Right pillar | 1000 | 800 | 64 | 64 |

These are small square walls that act as cover in the central corridor.

#### Desks (9)

| Label | x | y | w | h | Notes |
|-------|---|---|---|---|-------|
| Top-left desk | 250 | 250 | 160 | 100 | Single desk, upper-left area |
| Top-right desk | 1300 | 300 | 300 | 140 | Large desk cluster, upper-right area |
| Bottom-left row 1, desk 0 | 200 | 1200 | 100 | 60 | `i=0` of first loop |
| Bottom-left row 1, desk 1 | 350 | 1200 | 100 | 60 | `i=1` of first loop |
| Bottom-left row 1, desk 2 | 500 | 1200 | 100 | 60 | `i=2` of first loop |
| Bottom-left row 2, desk 0 | 200 | 1400 | 100 | 60 | `i=0` of second loop |
| Bottom-left row 2, desk 1 | 350 | 1400 | 100 | 60 | `i=1` of second loop |
| Bottom-left row 2, desk 2 | 500 | 1400 | 100 | 60 | `i=2` of second loop |
| Bottom-right desk | 1400 | 1400 | 120 | 120 | Large square desk, lower-right area |

The 6 bottom-left desks are generated in a loop: `for (i = 0; i < 3; i++)` with x = `200 + (i * 150)`, creating two rows of 3 desks each at y=1200 and y=1400.

### Total Objects: 19

| Category | Count |
|----------|-------|
| Boundary walls | 4 |
| Interior walls | 4 |
| Pillars | 2 |
| Desks | 9 |
| **Total** | **19** |

All 19 objects are added to the same `StaticGroup`. There is no distinction in the physics group between walls, pillars, and desks — all are collision-enabled static bodies.

---

## Integration with Other Systems

### Physics Colliders (MainScene)

MainScene wires up Arcade Physics colliders using the `walls` StaticGroup:

```typescript
// MainScene.ts:94–95, 160–163
this.walls = this.physics.add.staticGroup();
this.levelGenerator.createOfficeLayout(this.walls);

this.physics.add.collider(this.player, this.walls);
this.physics.add.collider(this.enemies, this.walls);
this.physics.add.collider(this.bullets, this.walls, this.handleBulletWallCollision, ...);
this.physics.add.collider(this.enemyBullets, this.walls, this.handleBulletWallCollision, ...);
```

### Pathfinder Nav Grid

The Pathfinder builds its blocked-tile grid from the wall children:

```typescript
// MainScene.ts:99
this.pathfinder.buildNavGrid(this.walls.getChildren());
```

See [pathfinder.md > Nav Grid Construction](pathfinder.md#nav-grid-construction) for how wall rectangles are converted to blocked grid cells.

### Wall Bounds Cache (LOS)

MainScene extracts `Phaser.Geom.Rectangle` bounds from each wall child and caches them in `wallBounds[]`. This cache is rebuilt when the minimap static layer is drawn:

```typescript
// MainScene.ts:256–260
const walls = this.walls.getChildren();
this.wallBounds = [];
for (const wall of walls) {
    const rect = (wall as Phaser.GameObjects.Rectangle);
    this.wallBounds.push(rect.getBounds());
}
```

`wallBounds` is then used by:
- **`hasLineOfSight(source, target)`** — returns `false` if a line between two points intersects any wall rectangle (MainScene.ts:403–412)
- **`fireBullet()`** — checks if the barrel position is obstructed by a wall before spawning a bullet (MainScene.ts:560–567)

### Minimap

Wall positions and dimensions are drawn onto the static minimap overlay at a scaled-down size. See [rendering.md](rendering.md) for minimap details.

---

## Layout Diagram

```
  0       200   350   500       800      1000  1100    1300    1600
  ┌────────────────────────────────────────────────────────────────┐
  │▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ TOP BOUNDARY (y=0, h=120) ▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
  │                                                                │
  │   [desk]                          [====desk====]               │
  │   250,250                          1300,300                    │
  │   160×100                          300×140                     │
  │          ║                                                     │
  │          ║ wall                                                 │
  │          ║ 500,400              ┌─────────────┐                │
  │          ║ 64×800    upper wall │  800,600     │                │
  │          ║           600×64     └─────────────┘                │
  │          ║                                                     │
  │          ║      [■]                    [■]                     │
  │          ║   600,800               1000,800                    │
  │          ║   pillars 64×64                        ║            │
  │                              ┌─────────────┐     ║ wall       │
  │                  lower wall  │  800,1000    │     ║ 1100,1200  │
  │                  600×64      └─────────────┘     ║ 64×800     │
  │                                                   ║            │
  │  [d][d][d]    desks at y=1200                     ║            │
  │  200 350 500  each 100×60                         ║            │
  │                                                   ║            │
  │  [d][d][d]    desks at y=1400          [desk]     ║            │
  │  200 350 500  each 100×60           1400,1400                  │
  │                                     120×120                    │
  │                                                                │
  │▓▓▓▓▓▓▓▓▓▓▓▓▓ BOTTOM BOUNDARY (y=1600, h=120) ▓▓▓▓▓▓▓▓▓▓▓▓▓│
  └────────────────────────────────────────────────────────────────┘
  ▓ LEFT (x=0)                                    ▓ RIGHT (x=1600)
```

> ASCII is approximate. Walls use center-origin placement — the left vertical wall at `(500, 400, 64, 800)` spans from x=468 to x=532 and y=0 to y=800.

---

## Error Handling

The LevelGenerator has no error handling. It assumes:
- The `scene` reference is a valid Phaser Scene with an active `add` factory and physics system.
- The `wallsGroup` is a valid `Phaser.Physics.Arcade.StaticGroup`.
- Physics bodies are instances of `Phaser.Physics.Arcade.Body` (guarded by an `instanceof` check before setting `immovable`/`moves`).

If the physics body cast fails (e.g., if the body is a `StaticBody` instead of `Body`), the `immovable` and `moves` properties are simply not set. This has no practical effect because `StaticGroup` members are already immovable by default.

---

## Implementation Notes

### Why 120px Boundaries?

The boundaries are 120px thick rather than a thin 1–2px border. This prevents fast-moving entities (at 120 FPS physics, entities can travel significant distances per frame) from tunneling through thin walls. The extra thickness provides a comfortable collision margin.

### Coordinate Convention

All `createBlock`/`createWall`/`createDesk` calls pass coordinates as **(centerX, centerY, width, height)**, matching `Phaser.GameObjects.Rectangle`'s constructor. This means:
- A wall at `(800, 600, 600, 64)` spans from x=500 to x=1100 and y=568 to y=632.
- Boundary wall at `(800, 0, 1600, 120)` spans from x=0 to x=1600 and y=-60 to y=60.

### No Randomization

The layout is entirely deterministic — every wall and desk is at a hardcoded position. There is no seed, no procedural generation, and no configuration. Any change requires editing the source.

---

## Test Scenarios

### TS-LEVEL-001: Floor Grid Covers World

**Category**: Visual
**Priority**: Low

**Preconditions:** Scene is initialized.

**Expected Output:**
- 17 vertical lines at x = 0, 100, 200, … 1600
- 17 horizontal lines at y = 0, 100, 200, … 1600
- Line color `0xb0bec5`, alpha 0.5, width 1px
- Graphics depth = -1 (behind all game objects)

---

### TS-LEVEL-002: Boundary Walls Block Arena Edges

**Category**: Unit
**Priority**: Critical

**Preconditions:** `createOfficeLayout()` called with a `StaticGroup`.

**Expected Output:**
- 4 boundary walls exist in the group
- Top: `(800, 0, 1600, 120)`
- Bottom: `(800, 1600, 1600, 120)`
- Left: `(0, 800, 120, 1600)`
- Right: `(1600, 800, 120, 1600)`
- All are static, immovable physics bodies

---

### TS-LEVEL-003: Interior Walls Created at Correct Positions

**Category**: Unit
**Priority**: High

**Preconditions:** `createOfficeLayout()` called.

**Expected Output:**
- Left vertical wall at `(500, 400, 64, 800)`
- Right vertical wall at `(1100, 1200, 64, 800)`
- Upper horizontal wall at `(800, 600, 600, 64)`
- Lower horizontal wall at `(800, 1000, 600, 64)`

---

### TS-LEVEL-004: Desks Created with Correct Positions and Styling

**Category**: Unit
**Priority**: Medium

**Preconditions:** `createOfficeLayout()` called.

**Expected Output:**
- 9 desk rectangles in the group
- All desks have fill color `0x795548` and stroke `0x4e342e` (2px)
- Loop-generated desks at correct positions (200, 350, 500 × 1200 and 1400)

---

### TS-LEVEL-005: All Objects Are Static Physics Bodies

**Category**: Unit
**Priority**: High

**Preconditions:** `createOfficeLayout()` called.

**Expected Output:**
- 19 total children in the `StaticGroup`
- Each child has an Arcade Physics body
- Body properties: `immovable = true`, `moves = false`

---

### TS-LEVEL-006: Pillar Obstacles Exist

**Category**: Unit
**Priority**: Medium

**Preconditions:** `createOfficeLayout()` called.

**Expected Output:**
- Two 64×64 pillars at `(600, 800)` and `(1000, 800)`
- Both are wall-colored `0x37474f`
- Both are collision-enabled

---

### TS-LEVEL-007: Walls Integrate with Pathfinder Nav Grid

**Category**: Integration
**Priority**: High

**Preconditions:** `createOfficeLayout()` called, then `pathfinder.buildNavGrid(walls.getChildren())`.

**Expected Output:**
- Nav grid tiles overlapping any wall or desk rectangle are marked as blocked
- Tiles in open areas are marked as walkable
- A* paths route around wall obstacles

---

### TS-LEVEL-008: Walls Integrate with LOS Checks

**Category**: Integration
**Priority**: High

**Preconditions:** `createOfficeLayout()` called, `wallBounds[]` populated from wall children.

**Expected Output:**
- `hasLineOfSight(source, target)` returns `false` when the line crosses any wall rectangle
- `hasLineOfSight(source, target)` returns `true` when no walls obstruct the line

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-02-15 | Initial specification |
| 1.0.1 | 2026-02-16 | Verified against source — all 19 objects (walls, desks, pillars), colors, dimensions, and line references match |
