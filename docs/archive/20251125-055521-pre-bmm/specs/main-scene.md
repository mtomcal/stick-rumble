# MainScene

> **Spec Version**: 1.0.0
> **Last Updated**: 2026-02-15
> **Archive Snapshot**: 2025-11-25 05:55:21
> **Source File**: `game/scenes/MainScene.ts` (~990 lines)
> **Depends On**: [types-and-events.md](types-and-events.md), [player.md](player.md)
> **Depended By**: [combat.md](combat.md), [ai.md](ai.md), [rendering.md](rendering.md), [input.md](input.md)

---

## Overview

`MainScene` is the sole Phaser scene in the pre-BMM prototype. It is a monolithic ~990-line class that orchestrates the entire game: initialization, physics groups, collision wiring, the frame-by-frame update loop, player movement, aiming, combat dispatch, AI coordination, rendering effects, and React HUD communication. There are no other scenes -- all menus and overlays are handled by the React layer.

The scene key is `'MainScene'`. The class extends `Phaser.Scene` and is registered in the game config at `game/phaserGame.ts:22`.

---

## Dependencies

### Technology Dependencies

| Technology | Version | Purpose |
|------------|---------|---------|
| Phaser 3 | ^3.90.0 | Scene lifecycle, physics groups, input, camera, tweens |
| React | ^19.2.0 | HUD overlay (communicated via EventBus) |
| TypeScript | ~5.8.2 | Type-safe source |

### File Dependencies

| File | What MainScene Uses |
|------|---------------------|
| `game/objects/StickFigure.ts` | Player and enemy entity class |
| `game/EventBus.ts` | Singleton event emitter for React-Phaser communication |
| `game/world/LevelGenerator.ts` | Office arena layout creation |
| `game/systems/Pathfinder.ts` | A* pathfinding for AI bots |
| `game/utils/TextureGenerator.ts` | Procedural texture generation (called in `preload()`) |
| `types.ts` | `EVENTS` constant, `WeaponType` enum |

---

## Constants

All constants are hardcoded in `MainScene.ts` -- there is no centralized constants file.

| Constant | Value | Location | Description |
|----------|-------|----------|-------------|
| `REGEN_DELAY` | 3000 ms | line 66 | Time after last damage before health regen starts |
| `regenRate` | 0.04 | line 383 | HP per ms of delta time (~40 HP/s effective) |
| Player speed | 350 px/s | line 415 | Player movement speed |
| Bot speed | 160 px/s | line 740, 770 | AI bot movement speed (moveToObject/moveTo) |
| Physics world bounds | 1600x1600 | line 88 | World size for Arcade physics |
| Background color | `#cfd8dc` | line 87 | Camera background color (light gray-blue) |
| Pathfinder grid size | 50 px | line 92 | A* grid cell size |
| Enemy spawn interval | 1500 ms | line 131 | Time between enemy spawn attempts |
| Bullet group max size | 50 | line 112-113 | Max active bullets per group |
| Minimap scale | 0.075 | line 245, 277 | World-to-minimap scaling factor |
| Radar range | 600 px | line 280 | Max distance to show enemies on minimap |
| Tracer fade rate | delta/150 | line 228 | Alpha decrease per frame for bullet tracers |
| Debug text position | (10, 150) | line 134 | On-screen debug overlay position |
| Reticle depth | 100 | line 109 | Z-depth of the aim reticle sprite |
| Tracer graphics depth | 999 | line 128 | Z-depth of bullet tracer lines |
| Minimap static depth | 1999 | line 142 | Z-depth of minimap wall layer |
| Minimap dynamic depth | 2000 | line 146 | Z-depth of minimap entity layer |

---

## Data Structures

### Scene State

MainScene holds game state as private/public instance fields rather than a dedicated state object.

```typescript
class MainScene extends Phaser.Scene {
  // Entities
  private player!: StickFigure;
  private enemies!: Phaser.Physics.Arcade.Group;

  // Projectile pools
  private bullets!: Phaser.Physics.Arcade.Group;       // Player bullets
  private enemyBullets!: Phaser.Physics.Arcade.Group;  // Bot bullets

  // Level geometry
  private walls!: Phaser.Physics.Arcade.StaticGroup;
  private wallBounds: Phaser.Geom.Rectangle[] = [];     // Cached wall rects for LOS

  // Weapon pickups
  private weaponDrops!: Phaser.Physics.Arcade.Group;

  // Rendering
  private reticle!: Phaser.GameObjects.Sprite;
  private minimapGraphics!: Phaser.GameObjects.Graphics;
  private minimapStaticGraphics!: Phaser.GameObjects.Graphics;
  private tracerGraphics!: Phaser.GameObjects.Graphics;
  private activeTracers: Tracer[] = [];
  private debugText!: Phaser.GameObjects.Text;

  // Input
  private cursorKeys!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasdKeys!: any;
  private reloadKey!: Phaser.Input.Keyboard.Key;
  private moveStick = { x: 0, y: 0 };
  private aimStick = { x: 0, y: 0, active: false };

  // Systems
  private levelGenerator!: LevelGenerator;
  private pathfinder!: Pathfinder;

  // HUD state
  private stats = {
    health: 100, ammo: 20, maxAmmo: 20, isReloading: false,
    score: 0, kills: 0, wave: 1, isGameOver: false
  };

  // Health regen
  private lastDamageTime: number = 0;
  private readonly REGEN_DELAY = 3000;
}
```

### Tracer

Internal interface for bullet trail lines that fade over time.

**Source**: `MainScene.ts:18-20`

```typescript
interface Tracer {
  x1: number; y1: number;   // Start point (world coords)
  x2: number; y2: number;   // End point (world coords)
  alpha: number;             // Current opacity (decreases each frame)
  color: number;             // Line color (hex)
}
```

### WEAPON_STATS

Top-level constant object defining all weapon parameters. Keyed by `WeaponType` enum.

**Source**: `MainScene.ts:10-16`

```typescript
const WEAPON_STATS = {
  [WeaponType.BAT]:     { damage: 60,  cooldown: 425, range: 90,  isMelee: true,  color: 0xcccccc, speed: 0,    clipSize: 0,  reloadTime: 0 },
  [WeaponType.KATANA]:  { damage: 100, cooldown: 800, range: 110, isMelee: true,  color: 0xffffff, speed: 0,    clipSize: 0,  reloadTime: 0 },
  [WeaponType.UZI]:     { damage: 12,  cooldown: 100, range: 600, isMelee: false, color: 0xffff00, speed: 850,  clipSize: 30, reloadTime: 1200 },
  [WeaponType.AK47]:    { damage: 20,  cooldown: 150, range: 1000,isMelee: false, color: 0xffaa00, speed: 1250, clipSize: 20, reloadTime: 2000 },
  [WeaponType.SHOTGUN]: { damage: 20,  cooldown: 950, range: 350, isMelee: false, color: 0x5d4037, speed: 900,  clipSize: 6,  reloadTime: 2000, pellets: 6 },
};
```

See [combat.md](combat.md) for detailed weapon behavior.

---

## Behavior

### Scene Lifecycle

#### `constructor()`

Calls `super('MainScene')` to register the scene key.

**Source**: `MainScene.ts:68-70`

#### `preload()`

Calls `generateGameTextures(this)` to create all procedural textures (bullets, pickups, reticle, hit markers) into the Phaser texture cache.

**Source**: `MainScene.ts:72-74`

See [texture-generator.md](texture-generator.md) for texture details.

#### `create()`

The main initialization method. Runs once when the scene starts (and again on `scene.restart()`).

**Source**: `MainScene.ts:76-137`

Execution order:

1. **Cursor setup**: Sets crosshair cursor, disables right-click context menu
2. **Stats reset**: Reinitializes `stats` to defaults (health=100, ammo=0, score=0, etc.)
3. **Camera**: Sets background color to `#cfd8dc`
4. **Physics world**: Sets bounds to 1600x1600
5. **Level generation**: Creates `LevelGenerator` and `Pathfinder` instances
6. **Walls**: Creates static physics group, calls `levelGenerator.createOfficeLayout(walls)` and `levelGenerator.drawFloorGrid()`
7. **Pathfinding grid**: Calls `pathfinder.buildNavGrid(walls.getChildren())` to build A* navigation grid from wall geometry
8. **Player creation**: Picks random weapon from all 5 types, creates `StickFigure` at (800, 800) with color `0x222222` and name `'YOU'`
9. **Camera follow**: `cameras.main.startFollow(player)`
10. **Reticle**: Creates aim reticle sprite at (800, 800), depth 100, alpha 0.8
11. **Physics groups**: Creates `enemies` (with `runChildUpdate: true`), `weaponDrops`, `bullets` (maxSize 50), `enemyBullets` (maxSize 50)
12. **Keyboard input**: Creates cursor keys, WASD keys, and R (reload) key bindings
13. **Minimap**: Calls `setupMinimap()` to create static and dynamic minimap graphics layers
14. **Collisions**: Calls `setupCollisions()` to wire all physics collider/overlap handlers
15. **Events**: Calls `setupEvents()` to register EventBus listeners
16. **Tracer graphics**: Creates graphics object at depth 999
17. **Enemy spawn timer**: 1500ms repeating timer calling `spawnEnemy()`
18. **Debug text**: Creates monospace text at (10, 150) with scroll factor 0, depth 9999

#### `update(time, delta)`

The per-frame game loop. Runs every render frame.

**Source**: `MainScene.ts:184-213`

```
function update(time, delta):
    if !player or player.isDead:
        return early

    1. handleMovement()         // Player velocity from keyboard/joystick
    2. handleAiming()           // Player rotation from mouse/joystick
    3. handleAttacks(time)      // Check fire input, execute attacks
    4. handleReloadInput()      // R key manual reload

    5. handleEnemies(time)      // AI: targeting, movement, pathfinding, attacks

    6. handleHealthRegen(time, delta)  // Passive health recovery
    7. updateMinimap()                 // Redraw dynamic minimap elements
    8. updateTracers(delta)            // Fade and draw bullet tracers

    9. cleanupBullets(bullets)         // Destroy out-of-bounds player bullets
    10. cleanupBullets(enemyBullets)   // Destroy out-of-bounds enemy bullets

    11. Update debug text (FPS, update time, AI time, entity counts)
```

**Performance tracking**: The update loop measures total frame time and AI processing time via `performance.now()` and displays them in the debug overlay.

**Early exit**: If the player is null or dead, the entire update loop is skipped. This means enemies, tracers, and the minimap freeze when the player dies.

---

### Collision Setup

All physics interactions are wired in `setupCollisions()` during `create()`.

**Source**: `MainScene.ts:151-164`

| # | Type | Group A | Group B | Handler | Behavior |
|---|------|---------|---------|---------|----------|
| 1 | `collider` | `player` | `enemies` | (default) | Physics push-back, no damage |
| 2 | `overlap` | `player` | `weaponDrops` | `handleWeaponPickup` | Switch weapon, destroy drop |
| 3 | `collider` | `bullets` | `enemies` | `handleBulletEnemyCollision` | Damage enemy, destroy bullet |
| 4 | `collider` | `player` | `enemyBullets` | `handlePlayerHitByBullet` | Damage player, destroy bullet |
| 5 | `collider` | `enemies` | `enemies` | (default) | Prevent bot stacking |
| 6 | `overlap` | `enemyBullets` | `enemies` | `handleEnemyBulletHitEnemy` | Bot-on-bot damage (friendly fire) |
| 7 | `collider` | `player` | `walls` | (default) | Block movement |
| 8 | `collider` | `enemies` | `walls` | (default) | Block movement |
| 9 | `collider` | `bullets` | `walls` | `handleBulletWallCollision` | Destroy bullet |
| 10 | `collider` | `enemyBullets` | `walls` | `handleBulletWallCollision` | Destroy bullet |

**Notable details:**
- Player bullets and enemy bullets are in **separate groups**. This prevents player self-damage without explicit owner checks (bullets in `bullets` only collide with `enemies`, not `player`).
- Bot-on-bot friendly fire is enabled via overlap #6. The handler checks `bullet.owner === enemy` to prevent self-damage.
- All bullet-wall interactions simply destroy the bullet (no ricochet, no penetration).
- Player-enemy collision is a `collider` (physics push-back) not an `overlap`, meaning entities bounce off each other without damage.

---

### EventBus Wiring

`setupEvents()` registers three EventBus listeners and a scene shutdown cleanup handler.

**Source**: `MainScene.ts:166-182`

| Event | Direction | Handler |
|-------|-----------|---------|
| `EVENTS.INPUT_MOVE` | React -> Phaser | Stores `{ x, y }` in `this.moveStick` |
| `EVENTS.INPUT_AIM` | React -> Phaser | Stores `{ x, y, active }` in `this.aimStick` |
| `EVENTS.RESTART` | React -> Phaser | Calls `this.scene.restart()` |

**Shutdown cleanup** (line 175-181): On scene `'shutdown'` event, all three EventBus listeners are explicitly removed with `EventBus.off()`, and `activeTracers` is cleared. The cursor is reset to `'default'`.

---

### Player Movement

Movement is handled in `handleMovement()`, called once per frame.

**Source**: `MainScene.ts:414-437`

```
function handleMovement():
    speed = 350

    // 1. Read keyboard input
    velocityX = 0, velocityY = 0
    if (WASD-left OR arrow-left): velocityX = -1
    else if (WASD-right OR arrow-right): velocityX = 1
    if (WASD-up OR arrow-up): velocityY = -1
    else if (WASD-down OR arrow-down): velocityY = 1

    // 2. Virtual joystick overrides keyboard
    if moveStick.x != 0 OR moveStick.y != 0:
        velocityX = moveStick.x    // continuous -1 to 1 range
        velocityY = moveStick.y

    // 3. Normalize and apply
    vec = new Vector2(velocityX, velocityY)
    if vec.length > 0:
        vec.normalize().scale(350)
        player.setVelocity(vec.x, vec.y)
    else:
        player.setVelocity(0, 0)
```

**Key characteristics:**
- No sprint mechanic
- No acceleration/deceleration model -- velocity is instant
- Diagonal movement is properly normalized (no speed boost)
- Virtual joystick values (continuous float -1 to 1) override discrete keyboard input (0 or 1)
- Phaser's Arcade physics handles wall collision resolution and world bounds clamping
- Speed 350 px/s applies to all directions equally

---

### Player Aiming

Aiming is handled in `handleAiming()`, called once per frame.

**Source**: `MainScene.ts:439-471`

Two input sources, with joystick taking priority:

#### Joystick Aim (Mobile)

```
if aimStick.active AND (aimStick.x != 0 OR aimStick.y != 0):
    aimAngle = atan2(aimStick.y, aimStick.x)
    player.setRotation(aimAngle)
    reticle.setPosition(player.x + cos(aimAngle) * 250, player.y + sin(aimAngle) * 250)
    reticle.setVisible(true)
```

The reticle is placed 250px from the player in the aim direction.

#### Mouse Aim (Desktop)

```
else:
    pointer = input.mousePointer
    worldPoint = cameras.main.getWorldPoint(pointer.x, pointer.y)
    aimAngle = Angle.Between(player.x, player.y, worldPoint.x, worldPoint.y)
    player.setRotation(aimAngle)
    reticle.setPosition(worldPoint.x, worldPoint.y)
    reticle.setVisible(true)
```

**Critical detail**: The code explicitly uses `input.mousePointer` (not `input.activePointer`) to avoid ambiguity with touch inputs on mobile. Screen coordinates are converted to world coordinates via `cameras.main.getWorldPoint()` because the camera follows the player and scrolls.

---

### Health Regeneration

Handled in `handleHealthRegen()`, called once per frame.

**Source**: `MainScene.ts:381-401`

```
function handleHealthRegen(time, delta):
    if time > lastDamageTime + 3000 AND player.hp < 100:
        amount = 0.04 * delta       // delta is ms, so ~0.04 * 16.67 = ~0.67 HP/frame at 60fps
        player.hp = min(100, player.hp + amount)
        stats.health = player.hp
        emit PLAYER_UPDATE to React

        // Visual: 15% chance per frame to spawn green healing particle
        if random() > 0.85:
            spawn green circle at player position +-12.5px
            tween upward 20px, fade to 0 over 600ms, then destroy
```

**Effective rate**: `0.04 * 1000 = 40 HP/second` (at 60fps render). This is significantly faster than the post-BMM codebase (10 HP/s).

---

### Line of Sight

A utility used by AI and melee attack systems to check wall obstruction.

**Source**: `MainScene.ts:403-412`

```
function hasLineOfSight(source, target) -> boolean:
    line = new Line(source.x, source.y, target.x, target.y)
    for each rect in wallBounds:
        if LineToRectangle(line, rect):
            return false
    return true
```

The `wallBounds` array is populated once during minimap static initialization (`drawMinimapStatic()`, line 257-260) by calling `getBounds()` on each wall rectangle. This array is then reused for all LOS checks without recomputation.

---

### Bullet Cleanup

Out-of-bounds bullets are destroyed each frame for both player and enemy bullet groups.

**Source**: `MainScene.ts:215-221`

```
function cleanupBullets(group):
    for each bullet in group:
        if bullet.active AND (x < 0 OR x > 1600 OR y < 0 OR y > 1600):
            bullet.destroy()
```

This is a safety net -- most bullets are destroyed by wall collisions before reaching the world edge. The check uses the 1600x1600 world bounds.

---

### Stats Emission to React

The `stats` object is emitted to React via EventBus in multiple places:

| Trigger | Source Line | What Changed |
|---------|------------|--------------|
| Weapon switch/reload | `updateAmmoUI()` (line 335-339) | ammo, maxAmmo, isReloading |
| Health regen tick | line 387 | health |
| Enemy killed by player | line 883 | kills, score |
| Player damaged | line 982 | health |
| Player dies | line 987 | (GAME_OVER event emitted instead) |

The `updateAmmoUI()` helper syncs `stats.ammo`, `stats.maxAmmo`, and `stats.isReloading` from the player's `StickFigure` properties, then emits `EVENTS.PLAYER_UPDATE`.

**Source**: `MainScene.ts:335-339`

---

### Weapon Pickup

When the player overlaps a weapon drop, `handleWeaponPickup()` fires.

**Source**: `MainScene.ts:914-921`

```
function handleWeaponPickup(player, drop):
    if !drop.active: return
    newWeapon = drop.weaponType
    show floating text "Picked up {weaponName}"
    setPlayerWeapon(newWeapon)       // Updates player weapon and ammo
    destroy drop's glow effect
    destroy drop
```

`setPlayerWeapon()` (line 329-333) calls `player.setWeapon(type, clipSize)` and then `updateAmmoUI()`.

---

### Weapon Drop Spawning

When an enemy dies, its weapon is dropped at the death location.

**Source**: `MainScene.ts:888-912`

```
function spawnWeaponDrop(x, y, weaponType):
    1. Create sprite using generated texture 'drop_{weaponType}'
    2. Set depth 5
    3. Add bobbing tween (y -5px, yoyo, 1000ms repeat forever)
    4. Add glowing ring effect (circle stroke, scale 1.5x, alpha fade, repeat)
    5. Auto-destroy after 30 seconds if still active
```

Weapon drops are added to the `weaponDrops` physics group and collide with the player via overlap handler.

---

### Scene Restart

When the player dies and clicks "TRY AGAIN" in the React UI:

1. React emits `EVENTS.RESTART` via EventBus
2. MainScene listener calls `this.scene.restart()`
3. Phaser destroys all current game objects and calls `create()` again
4. All state reinitializes from scratch (stats reset, new random weapon, enemies cleared)

The shutdown handler (line 175-181) ensures EventBus listeners are cleaned up before restart to prevent duplicate listeners.

---

## Error Handling

### Null Guards

- `update()` returns early if `!this.player || this.player.isDead` (line 186)
- `updateTracers()` checks `!this.tracerGraphics` (line 224)
- `drawMinimapStatic()` checks `!this.minimapStaticGraphics` (line 242)
- `updateMinimap()` checks `!this.minimapGraphics` (line 274)
- Reload tween callbacks check `unit.active` before updating (line 365, 372)
- Bullet collision handlers check `bullet.active && enemy.active` (line 792, 800)
- Weapon pickup checks `drop.active` (line 915)

### Self-Damage Prevention

- Player and enemy bullets are in separate groups, preventing player from hitting themselves with their own projectiles
- `handleEnemyBulletHitEnemy()` checks `bullet.owner === enemy` to prevent bot self-damage (line 801)
- `handlePlayerHitByBullet()` checks `bullet.owner === player` (line 931)

### Entity Cleanup

- Dead body corpses auto-fade and destroy after 7 seconds (5s delay + 2s fade, handled in `StickFigure.die()`)
- Weapon drops auto-destroy after 30 seconds (line 906)
- Bullet groups have maxSize 50, limiting memory usage
- Out-of-bounds bullets are destroyed every frame

---

## Implementation Notes

### TypeScript (Client-Only)

This is a client-only prototype with no server component. All logic runs in the browser.

**Class architecture**: `MainScene` is a God class that handles everything. In the post-BMM rewrite, these responsibilities were split into separate manager classes (InputManager, ShootingManager, PlayerManager, etc.). The monolithic design is a deliberate prototype simplification.

**Physics group pattern**: Phaser's `Arcade.Group` is used as both an object pool (maxSize 50 for bullets) and a collision target. The `runChildUpdate: true` option on the enemies group causes Phaser to call `preUpdate()` on each `StickFigure`, which drives their walk animation and aim sway.

**Debug text**: The debug overlay runs in all builds with no toggle. It shows FPS, update loop time, AI processing time, and entity counts. This is left enabled because the prototype never shipped to production.

**Cursor style**: MainScene sets `crosshair` cursor during gameplay and resets to `default` on shutdown. The right-click context menu is disabled via `input.mouse.disableContextMenu()`.

---

## Cross-Reference Index

| Topic | Spec |
|-------|------|
| StickFigure entity class | [player.md](player.md) |
| WEAPON_STATS detailed behavior | [combat.md](combat.md) |
| Enemy AI logic in `handleEnemies()` | [ai.md](ai.md) |
| A* pathfinding system | [pathfinder.md](pathfinder.md) |
| Office arena layout | [level-generator.md](level-generator.md) |
| Procedural texture generation | [texture-generator.md](texture-generator.md) |
| Minimap, tracers, hit effects | [rendering.md](rendering.md) |
| Keyboard, mouse, joystick input | [input.md](input.md) |
| React HUD and EventBus bridge | [ui.md](ui.md) |
| Types and event constants | [types-and-events.md](types-and-events.md) |
| Gemini bot taunts on kill | [gemini-service.md](gemini-service.md) |

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-02-15 | Initial specification |
| 1.0.1 | 2026-02-16 | Fix stick-figure.md → player.md references in header and cross-reference index |
