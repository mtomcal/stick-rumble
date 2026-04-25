# Pathfinder (Pre-BMM Archive)

> **Spec Version**: 1.0.0
> **Last Updated**: 2026-02-15
> **Archive Snapshot**: 2025-11-25 05:55:21
> **Source Files**: `game/systems/Pathfinder.ts` (171 lines)
> **Depends On**: [level-generator.md](level-generator.md)
> **Depended By**: [ai.md](ai.md), [main-scene.md](main-scene.md)

---

## Overview

The `Pathfinder` class implements A* pathfinding on a 2D grid for enemy AI navigation. It converts the game world into a boolean nav grid where each cell represents a 50x50 pixel tile that is either walkable or blocked by a wall. When an AI bot cannot see its target (line-of-sight is blocked), the bot requests a path from the pathfinder, which returns a sequence of world-space waypoints the bot follows.

**Key characteristics:**
- Classic A* algorithm with Manhattan distance heuristic
- 4-directional movement only (no diagonal neighbors)
- Grid cell size: 50x50 pixels on a 1600x1600 world (32x32 grid)
- Nav grid built once during scene initialization from wall geometry
- Handles blocked targets by searching for the nearest open cell within a radius of 2 tiles
- Hard limit of 500 A* steps to prevent infinite loops on unreachable goals
- Full try/catch error handling — any exception returns an empty path
- No path smoothing or optimization — paths follow grid centers

---

## Dependencies

### Technology Dependencies

| Technology | Version | Purpose |
|------------|---------|---------|
| Phaser 3 | ^3.90.0 | `Phaser.Geom.Rectangle`, `Phaser.Geom.Intersects.RectangleToRectangle`, `Phaser.Math.Vector2`, `Phaser.Math.Clamp` |
| TypeScript | ~5.8.2 | Type-safe source |

### File Dependencies

| File | What Pathfinder Uses |
|------|---------------------|
| `game/systems/Pathfinder.ts` | Entire Pathfinder class |
| `game/world/LevelGenerator.ts` | Produces the wall `GameObjects` passed to `buildNavGrid()` |
| `game/scenes/MainScene.ts` | Creates the Pathfinder, calls `buildNavGrid()`, `isValidTile()`, and `findPath()` |

---

## Constants

| Constant | Value | Location | Description |
|----------|-------|----------|-------------|
| `tileSize` | 50 px | `Pathfinder.ts:11` (default) | Width and height of each nav grid cell |
| `width` | 1600 px | `Pathfinder.ts:14` (default) | World width |
| `height` | 1600 px | `Pathfinder.ts:15` (default) | World height |
| `gridWidth` | 32 | Computed: `ceil(1600 / 50)` | Number of columns in the nav grid |
| `gridHeight` | 32 | Computed: `ceil(1600 / 50)` | Number of rows in the nav grid |
| `MAX_PATH_STEPS` | 500 | `Pathfinder.ts:101` | Maximum A* iterations before aborting |
| Wall-target search radius | 2 tiles | `Pathfinder.ts:73` | Search area when target lands in a wall cell |

---

## Data Structures

### Node (A* Search Node)

Internal interface used only within the `findPath()` method. Not exported.

**Source**: `Pathfinder.ts:3-7`

```typescript
interface Node {
    x: number;       // Grid column
    y: number;       // Grid row
    f: number;       // f = g + h (total estimated cost)
    g: number;       // Cost from start to this node
    h: number;       // Heuristic estimate to goal (Manhattan distance)
    parent: Node | null;  // Previous node in optimal path (for backtracking)
}
```

### navGrid (Walkability Grid)

A 2D boolean array where `true` means walkable and `false` means blocked.

**Source**: `Pathfinder.ts:10`

```typescript
private navGrid: boolean[][] = [];
// Indexed as: navGrid[row][column] — i.e., navGrid[y][x]
// Dimensions: 32 rows x 32 columns (for 1600x1600 world with 50px tiles)
```

### Pathfinder Class

**Source**: `Pathfinder.ts:9-171`

```typescript
export class Pathfinder {
    private navGrid: boolean[][] = [];
    private tileSize: number = 50;
    private gridWidth: number = 0;
    private gridHeight: number = 0;
    private width: number = 1600;
    private height: number = 1600;

    constructor(tileSize?: number, width?: number, height?: number);
    public buildNavGrid(walls: Phaser.GameObjects.GameObject[]): void;
    public isValidTile(x: number, y: number): boolean;
    public findPath(start: Phaser.Math.Vector2, target: Phaser.Math.Vector2): {x: number, y: number}[];
}
```

---

## Behavior

### Construction and Initialization

The Pathfinder is created once during `MainScene.create()` and its nav grid is built from the wall geometry produced by `LevelGenerator`.

**Source**: `MainScene.ts:92, 99`

```
// In MainScene.create():
pathfinder = new Pathfinder(50, 1600, 1600)
pathfinder.buildNavGrid(walls.getChildren())
```

The constructor accepts optional `tileSize`, `width`, and `height` parameters (all defaulting to 50, 1600, 1600 respectively). It computes `gridWidth` and `gridHeight` by dividing world dimensions by tile size and rounding up with `Math.ceil()`.

---

### Nav Grid Construction

`buildNavGrid()` creates the walkability grid by testing every grid cell against every wall rectangle.

**Source**: `Pathfinder.ts:25-46`

```
function buildNavGrid(walls):
    navGrid = []
    for y = 0 to gridHeight - 1:
        navGrid[y] = []
        for x = 0 to gridWidth - 1:
            navGrid[y][x] = true       // Assume walkable

            // Create a rectangle for this cell
            cellRect = Rectangle(x * tileSize, y * tileSize, tileSize, tileSize)

            // Test against every wall
            for each wall in walls:
                wallRect = wall.getBounds()
                if RectangleToRectangle(cellRect, wallRect):
                    navGrid[y][x] = false    // Blocked
                    break                     // No need to check more walls
```

**Key details:**
- The grid starts fully walkable (`true`) and cells are marked blocked when they intersect any wall.
- Intersection uses `Phaser.Geom.Intersects.RectangleToRectangle` — any overlap, even a single pixel, marks the cell as blocked.
- Wall objects are cast to `Phaser.GameObjects.Rectangle` and their bounds are retrieved with `getBounds()`.
- The grid is only built once during initialization. If walls were added or removed at runtime (they aren't), the grid would need to be rebuilt.
- With the default 1600x1600 world and 50px tiles, the grid is 32x32 = 1,024 cells. Each cell is tested against all walls (typically ~20 wall objects from `LevelGenerator`), making the total work ~20,000 intersection tests.

---

### Tile Validation

`isValidTile()` checks whether a grid cell is walkable. Used by `MainScene.spawnEnemy()` to validate spawn positions.

**Source**: `Pathfinder.ts:48-53`

```
function isValidTile(x, y):
    if y >= 0 AND y < gridHeight AND x >= 0 AND x < gridWidth:
        return navGrid[y][x]
    return false       // Out-of-bounds is invalid
```

**Key details:**
- Parameters are **grid coordinates** (not world coordinates). Callers must divide world positions by `tileSize` and floor the result.
- Out-of-bounds coordinates return `false` (non-walkable), not an error.
- The parameter order is `(x, y)` but internal array access is `navGrid[y][x]` (row-major).

---

### Path Finding (A* Algorithm)

`findPath()` computes a path from a start position to a target position in world coordinates. It returns an array of waypoints in world coordinates (cell centers).

**Source**: `Pathfinder.ts:55-170`

#### Step 1: Coordinate Conversion

World coordinates are converted to grid coordinates by dividing by tile size and flooring.

```
startX = floor(start.x / tileSize)
startY = floor(start.y / tileSize)
endX = floor(target.x / tileSize)
endY = floor(target.y / tileSize)
```

**Bounds checking:**
- If the start position is out of grid bounds, return `[]` immediately (no path).
- The end position is **clamped** to valid grid bounds using `Phaser.Math.Clamp`. This means targets slightly outside the arena will be snapped to the nearest edge cell rather than failing.

#### Step 2: Target Adjustment for Walled Cells

If the target cell is blocked (inside a wall), the algorithm searches a 5x5 area (radius 2) around the target for the nearest open cell, using Manhattan distance as the proximity metric.

**Source**: `Pathfinder.ts:68-93`

```
if !navGrid[endY][endX]:
    bestDist = Infinity
    bestNode = null

    for dy = -2 to +2:
        for dx = -2 to +2:
            nx = endX + dx
            ny = endY + dy
            if inBounds(nx, ny) AND navGrid[ny][nx]:
                dist = abs(dx) + abs(dy)     // Manhattan distance
                if dist < bestDist:
                    bestDist = dist
                    bestNode = {x: nx, y: ny}

    if bestNode:
        endX = bestNode.x
        endY = bestNode.y
    else:
        return []    // No open cell found nearby
```

**Key details:**
- This handles the common case where a player is hugging a wall, causing their center to fall in a blocked tile.
- The search radius of 2 checks a 5x5 area (25 cells).
- Manhattan distance is used to pick the closest open cell, not Euclidean distance.
- If all 25 cells are blocked, the function returns an empty path.
- When multiple cells tie for distance, the one found first in the scan order (top-to-bottom, left-to-right) wins.

#### Step 3: A* Search

Standard A* with Manhattan distance heuristic and 4-directional movement.

**Source**: `Pathfinder.ts:95-165`

```
openSet = [ Node(startX, startY, f=0, g=0, h=0, parent=null) ]
closedSet = Set<string>()
steps = 0

while openSet is not empty:
    steps++
    if steps > 500: return []    // Safety cutoff

    // Find node with lowest f score (linear scan)
    current = node in openSet with minimum f

    // Goal check
    if current.x == endX AND current.y == endY:
        // Backtrack to build path
        path = []
        node = current
        while node != null:
            path.push({
                x: node.x * tileSize + tileSize / 2,    // Convert to world center
                y: node.y * tileSize + tileSize / 2
            })
            node = node.parent
        return path.reverse()

    // Move current from open to closed
    remove current from openSet
    add "current.x,current.y" to closedSet

    // Expand 4 neighbors (up, down, left, right)
    neighbors = [{0,-1}, {0,+1}, {-1,0}, {+1,0}]

    for each offset in neighbors:
        nx = current.x + offset.x
        ny = current.y + offset.y

        if outOfBounds(nx, ny): continue
        if !navGrid[ny][nx]: continue          // Wall
        if closedSet.has("nx,ny"): continue    // Already processed

        gScore = current.g + 1     // Uniform cost: 1 per step

        neighborNode = find in openSet where x==nx AND y==ny

        if not found:
            // New node
            neighborNode = Node(nx, ny,
                g = gScore,
                h = abs(nx - endX) + abs(ny - endY),    // Manhattan
                f = gScore + h,
                parent = current
            )
            add to openSet

        else if gScore < neighborNode.g:
            // Better path found
            neighborNode.parent = current
            neighborNode.g = gScore
            neighborNode.f = gScore + neighborNode.h

return []    // No path found (openSet exhausted)
```

**Key details:**
- **Heuristic**: Manhattan distance (`|dx| + |dy|`), which is admissible and consistent for 4-directional grids. This guarantees optimal paths.
- **Movement cost**: Uniform cost of 1 per step. No diagonal movement means no `sqrt(2)` costs.
- **Open set**: Stored as a flat array with linear scan for minimum `f`. This is O(n) per iteration rather than O(log n) with a heap, but the grid is small (32x32 = 1024 max nodes) and the MAX_PATH_STEPS cap of 500 keeps it bounded.
- **Closed set**: Uses a `Set<string>` with keys formatted as `"x,y"` strings.
- **Neighbor lookup**: Linear scan of the open set to find existing nodes. Again O(n) but bounded by grid size and step cap.
- **Path output**: Waypoints are at tile **centers** (`x * tileSize + tileSize / 2`), not tile origins. For 50px tiles, the first column's center is at x=25, not x=0.
- **Path order**: The backtrack produces a reversed path (goal to start), so it's reversed before returning. The output goes from start to goal.

#### Step 4: Error Handling

The entire `findPath()` method is wrapped in a try/catch.

**Source**: `Pathfinder.ts:166-169`

```typescript
catch (err) {
    console.error("Pathfinding error", err);
    return [];
}
```

Any exception (e.g., out-of-bounds access, null reference) is caught, logged, and returns an empty path. This ensures the game never crashes due to pathfinding errors.

---

### Path Consumption by AI

The AI system in `MainScene.handleEnemies()` manages path following. This is documented in detail in [ai.md](ai.md#movement-logic), but the key integration points are:

**Source**: `MainScene.ts:746-776`

- Paths are requested when a bot has no line-of-sight and its existing path is empty, exhausted, or older than 500ms.
- Only 1 path recalculation is allowed per frame across all enemies (budget system).
- The bot follows waypoints sequentially, advancing to the next when within 10px of the current one.
- Movement speed along the path is 160 px/s (set by `Phaser.Physics.moveTo()`).
- When line-of-sight is regained, the path is cleared and the bot switches to direct movement.

---

## Error Handling

### Start Position Out of Bounds

**Trigger**: `start.x` or `start.y` converts to a grid coordinate outside `[0, gridWidth)` or `[0, gridHeight)`.
**Response**: Return `[]` immediately. No error is thrown.
**Source**: `Pathfinder.ts:62`

### Target Position in a Wall

**Trigger**: Target grid cell has `navGrid[endY][endX] == false`.
**Response**: Search radius-2 area for nearest open cell. If found, reroute to it. If not found, return `[]`.
**Source**: `Pathfinder.ts:68-93`

### No Path Exists

**Trigger**: Open set is exhausted without reaching the goal (completely enclosed areas).
**Response**: Return `[]`.
**Source**: `Pathfinder.ts:165`

### Step Limit Exceeded

**Trigger**: A* iterations exceed `MAX_PATH_STEPS` (500).
**Response**: Return `[]`. This prevents long-running searches on pathological grid configurations.
**Source**: `Pathfinder.ts:105`

### Runtime Exception

**Trigger**: Any unexpected error during path computation.
**Response**: Catch, log to `console.error`, return `[]`.
**Source**: `Pathfinder.ts:166-169`

---

## Implementation Notes

### TypeScript (Client-Only)

**Single class, no external dependencies beyond Phaser**: The Pathfinder is a self-contained A* implementation with no third-party pathfinding libraries. It only depends on Phaser geometry types for wall intersection testing.

**Grid vs. world coordinate confusion**: The class mixes coordinate systems. `isValidTile()` takes **grid** coordinates while `findPath()` takes **world** coordinates (as `Phaser.Math.Vector2`). Callers must handle the conversion themselves for `isValidTile()` (see `MainScene.ts:652-653`), but `findPath()` does its own conversion internally.

**No path caching or memoization**: Every `findPath()` call runs a full A* search from scratch. There's no waypoint cache, navigation mesh, or pre-computed shortest path table. This is acceptable given the small grid size and the per-frame budget cap.

**No diagonal movement**: The neighbor set only includes 4 cardinal directions. This means paths can appear inefficient (staircase patterns) when a direct diagonal route would be shorter. However, since the grid is coarse (50px tiles), the visual difference is minor — bots appear to navigate around obstacles with right-angle turns.

**Manhattan heuristic is optimal for 4-directional grids**: The choice of Manhattan distance as the heuristic is correct and guarantees optimal paths for this movement model. Using Euclidean distance would still work but could cause unnecessary extra node expansions.

**Open set implementation**: The open set is a flat array with linear scan for the minimum `f` node and linear scan for neighbor lookup. This is O(n) per iteration. A binary heap would improve to O(log n), but with the 500-step cap and small grid, the performance difference is negligible.

**String-based closed set**: The closed set uses string keys (`"x,y"`), which involves string allocation and hashing on every insert/lookup. A 2D boolean array would be more efficient, but again the performance impact is minimal at this grid size.

---

## Cross-Reference Index

| Topic | Spec |
|-------|------|
| AI movement and path following | [ai.md](ai.md#movement-logic) |
| Wall geometry and level layout | [level-generator.md](level-generator.md) |
| Enemy spawn position validation | [ai.md](ai.md#enemy-spawning) |
| MainScene initialization and update loop | [main-scene.md](main-scene.md) |
| Phaser physics and geometry types | [config.md](config.md) |

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-02-15 | Initial specification documenting pre-BMM archive snapshot |
| 1.0.1 | 2026-02-16 | Verified against source — all constants, A* algorithm, nav grid logic, and line references match |
