# Enemy AI (Pre-BMM Archive)

> **Spec Version**: 1.0.0
> **Last Updated**: 2026-02-15
> **Archive Snapshot**: 2025-11-25 05:55:21
> **Source Files**: `game/scenes/MainScene.ts` (lines 641-789 for spawning and AI), `game/objects/StickFigure.ts` (AI state fields), `game/systems/Pathfinder.ts` (A* navigation)
> **Depends On**: [types-and-events.md](types-and-events.md), [player.md](player.md), [combat.md](combat.md), [main-scene.md](main-scene.md), [pathfinder.md](pathfinder.md), [level-generator.md](level-generator.md)
> **Depended By**: [rendering.md](rendering.md), [ui.md](ui.md), [gemini-service.md](gemini-service.md)

---

## Overview

The pre-BMM prototype has no multiplayer — all opponents are client-side AI bots. The AI system handles enemy spawning, target selection, movement, pathfinding, line-of-sight checks, and attack execution. Everything runs in `MainScene.handleEnemies()`, called every frame during the `update()` loop.

**Key characteristics:**
- All AI is client-side; no server involvement
- Enemies spawn on a 1500ms timer and persist until killed
- Bots target the nearest entity (player or other bot) — they fight each other
- Movement uses direct steering when the target is visible, A* pathfinding when obscured by walls
- Line-of-sight is throttled to once every 200ms per enemy to save CPU
- Pathfinding updates are budgeted: only 1 path recalculation per frame across all enemies
- Bots share the same `executeAttack()` function as the player, with added aim inaccuracy
- Bots auto-reload when their magazine is empty

**Key differences from the current (post-BMM) codebase:**
- No server-side game loop or bot management
- No bot state machines or behavior trees — just a simple per-frame decision loop
- No difficulty scaling beyond enemy count increasing with wave number
- Bots don't dodge, sprint, or use any advanced movement
- Bots can damage and kill each other (friendly fire fully enabled)

---

## Dependencies

### Technology Dependencies

| Technology | Version | Purpose |
|------------|---------|---------|
| Phaser 3 | ^3.90.0 | Physics groups, distance/angle math, collision, moveToObject |
| TypeScript | ~5.8.2 | Type-safe source |

### File Dependencies

| File | What AI Uses |
|------|-------------|
| `game/scenes/MainScene.ts` | `spawnEnemy()`, `handleEnemies()`, `executeAttack()`, `reloadWeapon()`, `hasLineOfSight()` |
| `game/objects/StickFigure.ts` | Entity class with AI navigation state (`currentPath`, `pathIndex`, `lastPathTime`, `lastLOSTime`, `hasLOS`) |
| `game/systems/Pathfinder.ts` | `findPath()`, `isValidTile()` for spawn validation |
| `types.ts` | `WeaponType` enum |

---

## Constants

### Spawning Constants

| Constant | Value | Location | Description |
|----------|-------|----------|-------------|
| Spawn interval | 1500 ms | `MainScene.ts:131` | Timer loop delay between spawn attempts |
| Max enemies formula | `3 + floor(wave / 2)` | `MainScene.ts:642` | Scales with wave number |
| Spawn margin | 100–1500 px | `MainScene.ts:651` | Random x/y range for spawn position |
| Minimum player distance | 400 px | `MainScene.ts:657` | Enemies won't spawn within 400px of player |
| Max spawn attempts | 20 | `MainScene.ts:649` | Tries to find a valid position before giving up |

### AI Behavior Constants

| Constant | Value | Location | Description |
|----------|-------|----------|-------------|
| Bot movement speed | 160 px/s | `MainScene.ts:740, 770` | Fixed speed for all bots (vs player's 350) |
| LOS check interval | 200 ms | `MainScene.ts:724` | Throttle for line-of-sight recalculations |
| Path recalculation budget | 1 per frame | `MainScene.ts:682` | Only 1 enemy recalculates its path per frame |
| Path staleness threshold | 500 ms | `MainScene.ts:749` | Force path recalculation after 500ms |
| Waypoint arrival threshold | 10 px | `MainScene.ts:764` | Distance to consider a pathfinding node reached |
| Bot aim inaccuracy | ±0.2 rad (~11°) | `MainScene.ts:609` | Random angle error on ranged shots |
| Initial fire delay | 0–2000 ms | `MainScene.ts:674` | Random delay before first attack after spawn |

### Per-Weapon AI Ranges

Attack and movement ranges vary by weapon type. These are hardcoded in `handleEnemies()`.

**Source**: `MainScene.ts:719-720`

| Weapon Type | Attack Range (px) | Stop Distance (px) |
|-------------|------------------|-------------------|
| Melee (BAT/KATANA) | `stats.range + 20` (110/130) | 40 |
| UZI | 600 | 150 |
| SHOTGUN | 300 | 150 |
| AK47 | 600 | 250 |

---

## Data Structures

### AI Navigation State (on StickFigure)

Each `StickFigure` instance carries navigation state used by the AI loop. These properties are public and managed entirely by `MainScene.handleEnemies()`.

**Source**: `StickFigure.ts:29-33`

```typescript
// AI Navigation state on each StickFigure
public currentPath: { x: number, y: number }[] = [];  // A* result (world coords)
public pathIndex: number = 0;                           // Current waypoint index
public lastPathTime: number = 0;                        // Timestamp of last path calc
public lastLOSTime: number = 0;                         // Timestamp of last LOS check
public hasLOS: boolean = false;                         // Cached line-of-sight result
```

### Bot Names

A fixed pool of display names, chosen randomly on spawn.

**Source**: `MainScene.ts:665`

```typescript
const names = ['Noob', 'Camper', 'Lag', 'Bot_01', 'X_x_X', 'Reaper', 'Guest123', 'Sniper'];
```

---

## Behavior

### Enemy Spawning

Enemies are spawned by a repeating timer event every 1500ms.

**Source**: `MainScene.ts:130-131, 641-679`

```
function spawnEnemy():
    maxEnemies = 3 + floor(stats.wave / 2)
    if enemies.countActive() >= maxEnemies: return

    // Try up to 20 random positions
    attempts = 0
    while !valid AND attempts < 20:
        x = random(100, 1500)
        y = random(100, 1500)
        gx = floor(x / 50)     // Convert to pathfinder grid coords
        gy = floor(y / 50)

        // Must be on walkable tile AND > 400px from player
        if pathfinder.isValidTile(gx, gy):
            if distance(x, y, player.x, player.y) > 400:
                valid = true
        attempts++

    if valid:
        name = randomFrom(names)
        weapon = randomFrom([BAT, KATANA, UZI, AK47, SHOTGUN])
        color = 0xff0000    // All enemies are red

        enemy = new StickFigure(scene, x, y, color, name, weapon)
        enemy.lastFired = time.now + random(0, 2000)    // Stagger initial attacks
        enemy.setWeapon(weapon, WEAPON_STATS[weapon].clipSize)
        enemies.add(enemy)
```

**Key details:**
- The `wave` value starts at 1 and is part of `stats`, but `stats.wave` is never incremented in the code. This means `maxEnemies` is always `3 + floor(1/2) = 3`. Wave progression appears to be planned but not implemented.
- All enemies are colored red (`0xff0000`) regardless of weapon or name.
- Spawn uses the `Pathfinder.isValidTile()` check to avoid placing enemies inside walls.
- The `lastFired` offset of `time.now + random(0, 2000)` creates a staggered delay before the bot's first attack, preventing all newly spawned bots from firing simultaneously.
- Each bot gets a random weapon with a full magazine.

---

### Target Selection

Each frame, every living enemy selects its nearest target. Targets can be the player or any other bot.

**Source**: `MainScene.ts:688-706`

```
function selectTarget(enemy):
    target = null
    minDist = Infinity

    // Consider the player
    if !player.isDead:
        d = distance(enemy, player)
        target = player
        minDist = d

    // Consider all other enemies
    for each other in enemies:
        if other != enemy AND !other.isDead AND other.active:
            d = distance(enemy, other)
            if d < minDist:
                minDist = d
                target = other

    return target, minDist
```

**Key details:**
- Bots are **free-for-all**: they fight each other as well as the player.
- Selection is purely distance-based — no priority given to the player over other bots.
- If the player is dead and no other bots exist, the enemy stops and idles (`setVelocity(0,0)`).
- There is no target memory or aggro system — target selection happens fresh every frame.

---

### Line of Sight

LOS determines whether a bot can see its target. It uses `Phaser.Geom.Intersects.LineToRectangle` against all wall bounds cached during minimap setup.

**Source**: `MainScene.ts:403-412`

```
function hasLineOfSight(source, target):
    line = new Line(source.x, source.y, target.x, target.y)
    for each rect in wallBounds:
        if Line intersects Rectangle:
            return false
    return true
```

LOS is **throttled** to save CPU: each enemy rechecks LOS only every 200ms. The result is cached on the entity.

**Source**: `MainScene.ts:723-727`

```
// In handleEnemies():
if time - enemy.lastLOSTime > 200:
    enemy.lastLOSTime = time
    enemy.hasLOS = hasLineOfSight(enemy, target)
```

**Key details:**
- `wallBounds` is an array of `Phaser.Geom.Rectangle` populated in `drawMinimapStatic()` (`MainScene.ts:257-260`). It is built once during `create()`.
- The LOS check tests a single line from entity center to target center — it does not account for entity size.
- The 200ms throttle means a bot may briefly shoot at a target that has just ducked behind a wall, or delay attacking a target that has just emerged.
- Initial `hasLOS` is `false` (from `StickFigure` constructor default), so newly spawned bots won't attack until their first LOS check completes (within 200ms).

---

### Movement Logic

Bot movement depends on line-of-sight state. The logic implements a two-tier strategy: direct movement when the target is visible, pathfinding when it's not.

**Source**: `MainScene.ts:732-777`

```
function movementLogic(enemy, target, distToTarget, stats):
    stopDist = calculateStopDistance(enemy.weaponType)    // 40, 150, or 250

    // If close enough AND can see target: stop and aim
    if distToTarget < stopDist AND enemy.hasLOS:
        enemy.setVelocity(0, 0)
        enemy.setRotation(angleBetween(enemy, target))

    else:
        // Can see target: move directly toward it
        if enemy.hasLOS:
            moveToObject(enemy, target, speed=160)
            enemy.setRotation(angleBetween(enemy, target))
            enemy.currentPath = []       // Clear any stale path
            enemy.pathIndex = 0

        // Can't see target: use A* pathfinding
        else:
            // Budget: only 1 path recalculation per frame
            if pathUpdateBudget > 0 AND (
                enemy has no path OR
                path is exhausted OR
                path is older than 500ms
            ):
                pathUpdateBudget--
                enemy.currentPath = pathfinder.findPath(
                    Vector2(enemy.x, enemy.y),
                    Vector2(target.x, target.y)
                )
                enemy.pathIndex = 0
                enemy.lastPathTime = time

            // Follow path waypoints
            if enemy has valid path:
                nextNode = enemy.currentPath[enemy.pathIndex]
                distToNode = distance(enemy, nextNode)

                if distToNode < 10:     // Arrived at waypoint
                    enemy.pathIndex++

                if enemy.pathIndex < path length:
                    moveNode = enemy.currentPath[enemy.pathIndex]
                    moveTo(enemy, moveNode.x, moveNode.y, speed=160)
                    enemy.setRotation(angleBetween(enemy, moveNode))
            else:
                enemy.setVelocity(0, 0)     // No path, idle
```

**Key details:**
- All bots move at **160 px/s**, which is less than half the player's 350 px/s.
- Direct movement uses `Phaser.Physics.Arcade.moveToObject()`, which calculates velocity toward the target.
- When switching from pathfinding to direct movement, the path is cleared to prevent stale path-following on next LOS loss.
- Pathfinding budget of 1 per frame means that in a frame with 3 enemies needing paths, only the first one processed gets a new path; the others continue following their existing (possibly stale) paths.
- Path staleness is 500ms — a bot won't recalculate its path more often than every half second even if the target has moved.
- Waypoint arrival uses a 10px threshold before advancing to the next node.
- Path coordinates are world-space (converted from grid tiles by the Pathfinder — see [pathfinder.md](pathfinder.md)).

---

### Attack Logic

After movement, bots attempt to attack if the target is within attack range and visible.

**Source**: `MainScene.ts:779-787`

```
// Attack Logic (after movement):
if distToTarget < attackRange:
    if enemy.hasLOS:
        executeAttack(enemy, enemyBullets, isPlayer=false)
```

**Key details:**
- Attack range varies by weapon (see Per-Weapon AI Ranges table above).
- LOS is **required** for all attacks — both ranged and melee. Bots will not attack through walls.
- `executeAttack()` is the same function used for the player (see [combat.md](combat.md#attack-dispatch)). The `isPlayer=false` flag prevents ammo UI updates.
- Bot aim inaccuracy is applied inside `fireBullet()` (not in the AI loop): `angle += (random - 0.5) * 0.4` adds ±0.2 radians (~11°) of random error to every ranged shot.
- Bots also inherit `aimSway` from `StickFigure.preUpdate()` — the sinusoidal sway adds an additional ~0.15 radians of error when moving, ~0.03 radians when idle.
- The total angular deviation for a bot shot is: `rotation + aimSway + botInaccuracy + weaponSpread`.

---

### Auto-Reload

Bots reload automatically when their ammo runs out.

**Source**: `MainScene.ts:715-717`

```
if !stats.isMelee AND enemy.currentAmmo <= 0:
    reloadWeapon(enemy)
```

This check runs every frame for every living enemy. `reloadWeapon()` has an early-return guard for `isReloading`, so repeated calls are harmless. Bot reload uses the same reload system as the player (see [combat.md](combat.md#reload-system)), including the visual reload bar and animation.

---

### Frame Budget and Performance

The AI loop is the most expensive per-frame operation. The code includes built-in performance measurement.

**Source**: `MainScene.ts:193-195, 205-212`

```typescript
const aiStart = performance.now();
this.handleEnemies(time);
const aiEnd = performance.now();
// Displayed in debug text as "AI: X.XXms"
```

**Performance optimizations:**
- LOS throttling (200ms per enemy) avoids expensive ray-vs-rectangle checks every frame
- Path budget (1 recalculation per frame) caps A* computation
- `Pathfinder.findPath()` has an internal `MAX_PATH_STEPS = 500` limit
- Only 4-directional neighbors in A* (no diagonals) reduces search space
- Direct `moveToObject()` when LOS is available avoids pathfinding entirely

---

## Error Handling

### Spawn Failure

If 20 random positions all fail validation (inside walls or too close to player), no enemy is spawned for that timer tick. The timer fires again after 1500ms for the next attempt.

### No Target Available

If the player is dead and no other active bots exist, the `!target` check at `MainScene.ts:707-709` causes the bot to idle:

```typescript
if (!target) {
    enemy.setVelocity(0,0);
    return;
}
```

### Pathfinding Failures

If `pathfinder.findPath()` returns an empty array (no path found, exceeded MAX_PATH_STEPS, or error), the bot idles (`setVelocity(0,0)`) until the next path recalculation opportunity. The pathfinder wraps the entire algorithm in a try/catch and returns `[]` on any exception.

### Entity Destruction During AI Loop

The `enemies.getChildren().forEach()` loop iterates over all group members. If an entity is destroyed during the loop (e.g., killed by another bot's attack earlier in the same iteration), it will have `isDead = true` and the loop skips it. The `!enemy.isDead` guard at `MainScene.ts:686` prevents processing dead entities.

---

## Implementation Notes

### TypeScript (Client-Only)

**Monolithic AI**: All AI logic lives in `MainScene.handleEnemies()` — there are no separate AI classes, behavior trees, or state machines. Each bot's "state" is implicit from its navigation fields and the current frame's computed values.

**Shared attack system**: Bots use the exact same `executeAttack()` / `fireBullet()` / `performMeleeAttack()` as the player. The only bot-specific modifications are:
1. Bot aim inaccuracy in `fireBullet()` (`MainScene.ts:607-609`)
2. Auto-reload in `handleEnemies()` (`MainScene.ts:715-717`)
3. `isPlayer=false` flag suppresses ammo UI updates and changes kill credit tracking

**Enemy color**: All bots are `0xff0000` (red). The player is `0x222222` (near-black). There is no team system or per-bot color variation.

**Wave scaling (broken)**: The `stats.wave` field exists and is initialized to `1`, but is never incremented anywhere in the codebase. The `maxEnemies = 3 + floor(wave / 2)` formula always evaluates to `3`. This appears to be a planned feature that was never completed.

**Free-for-all targeting**: The target selection includes other bots in the distance comparison, meaning bots will preferentially attack nearby bots over a distant player. This creates emergent behavior where bots cluster and fight each other while the player can engage at range.

---

## Cross-Reference Index

| Topic | Spec |
|-------|------|
| StickFigure entity and AI state fields | [player.md](player.md) |
| `executeAttack()`, `fireBullet()`, `performMeleeAttack()` | [combat.md](combat.md) |
| WEAPON_STATS and attack constants | [combat.md](combat.md#weapon_stats) |
| MainScene update loop and initialization | [main-scene.md](main-scene.md) |
| A* pathfinding algorithm | [pathfinder.md](pathfinder.md) |
| Level layout and wall placement | [level-generator.md](level-generator.md) |
| Bot kill events and Gemini taunts | [gemini-service.md](gemini-service.md) |
| Hit markers and damage numbers | [rendering.md](rendering.md) |
| Score and kill count UI | [ui.md](ui.md) |
| Weapon types enum | [types-and-events.md](types-and-events.md) |

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-02-15 | Initial specification documenting pre-BMM archive snapshot |
| 1.0.1 | 2026-02-16 | Verified against source — all constants, behaviors, and line references match |
