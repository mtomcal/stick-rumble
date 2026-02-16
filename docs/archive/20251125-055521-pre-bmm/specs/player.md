# Player (Pre-BMM Archive)

> **Spec Version**: 1.0.0
> **Last Updated**: 2026-02-15
> **Archive Snapshot**: 2025-11-25 05:55:21
> **Depends On**: [types.ts](../types.ts)
> **Depended By**: MainScene (movement, combat, health regen, death)

---

## Overview

The player entity in the pre-BMM codebase is the `StickFigure` class, a Phaser `Arcade.Sprite` subclass that handles both the human-controlled player and AI-controlled bots. There is **no server**; the entire game is single-player client-only with local AI enemies. All player state is managed locally in the browser.

**Key architectural differences from the current (post-BMM) codebase:**
- No server-authoritative state; everything is client-side
- No WebSocket communication or multiplayer
- No dedicated PlayerState struct; state lives as fields on `StickFigure` and `MainScene.stats`
- No client-side prediction or interpolation (not needed without a server)
- AI bots use the same `StickFigure` class as the human player
- No respawn system; death is game-over for the human player
- Health regeneration is time-based with a simpler model (no fractional accumulator)

---

## Dependencies

### Technology Dependencies

| Technology | Version | Purpose |
|------------|---------|---------|
| Phaser 3 | ^3.90.0 | Game framework, physics, rendering |
| React | ^19.2.0 | UI overlay (HUD, menus) |
| TypeScript | ~5.8.2 | Type-safe development |
| Vite | ^6.2.0 | Build tool and dev server |

### File Dependencies

- `game/objects/StickFigure.ts` - Player entity class
- `game/scenes/MainScene.ts` - Game loop, player management, combat
- `types.ts` - Shared types (`GameStats`, `WeaponType`, `EVENTS`)
- `game/EventBus.ts` - Phaser EventEmitter bridge to React UI
- `App.tsx` - React HUD rendering

---

## Data Structures

### StickFigure (Player Entity)

The `StickFigure` class extends `Phaser.Physics.Arcade.Sprite` and serves as both the human player and AI bot entity. It is **not** a pure data model; it combines state, rendering, and animation.

**Source**: `game/objects/StickFigure.ts`

```typescript
class StickFigure extends Phaser.Physics.Arcade.Sprite {
  // --- Public State ---
  isDead: boolean = false;
  hp: number = 100;
  maxHp: number = 100;
  lastFired: number = 0;              // timestamp of last attack
  weaponType: WeaponType;

  // Ammo & Reloading
  currentAmmo: number = 0;
  maxAmmo: number = 0;
  isReloading: boolean = false;

  // AI Navigation
  currentPath: { x: number; y: number }[] = [];
  pathIndex: number = 0;
  lastPathTime: number = 0;
  lastLOSTime: number = 0;            // Line of Sight throttle
  hasLOS: boolean = false;

  // Aim Mechanics
  aimSway: number = 0;

  // --- Private State ---
  private color: number;
  private graphics: Phaser.GameObjects.Graphics;
  private reloadBar: Phaser.GameObjects.Graphics;
  private weaponContainer: Phaser.GameObjects.Container;
  private nameText: Phaser.GameObjects.Text;
  private walkCycle: number = 0;
  private isAttacking: boolean = false;
  private recoilOffset: number = 0;
  private swayTime: number = 0;
}
```

### GameStats (UI State)

Maintained on `MainScene` and emitted to React via `EventBus`.

**Source**: `types.ts`

```typescript
interface GameStats {
  health: number;       // 0-100
  ammo: number;
  maxAmmo: number;
  isReloading: boolean;
  score: number;
  kills: number;
  isGameOver: boolean;
  wave: number;
}
```

### WeaponType (Enum)

**Source**: `types.ts`

```typescript
enum WeaponType {
  BAT = 'BAT',
  KATANA = 'KATANA',
  UZI = 'UZI',
  AK47 = 'AK47',
  SHOTGUN = 'SHOTGUN'
}
```

---

## Constants

All player-related constants are hardcoded in source files, not centralized.

| Constant | Value | Location | Description |
|----------|-------|----------|-------------|
| Max HP | 100 | `StickFigure.ts:18` | Maximum health |
| Movement Speed | 350 | `MainScene.ts:415` | Player movement speed (px/s) |
| Bot Movement Speed | 160 | `MainScene.ts:740-770` | AI movement speed (px/s) |
| Hitbox Radius | 15 | `StickFigure.ts:75` | Circle collider radius |
| Regen Delay | 3000 | `MainScene.ts:66` | ms before health regen starts |
| Regen Rate | 0.04 | `MainScene.ts:383` | HP per ms of delta time |
| World Size | 1600x1600 | `MainScene.ts:88` | Physics world bounds |
| Physics FPS | 120 | `phaserGame.ts:18` | Doubled for bullet tunneling prevention |
| Head Radius | 13 | `StickFigure.ts:385` | Visual head circle radius (px) |
| Name Tag Y Offset | -45 | `StickFigure.ts:64` | Name text position above entity |
| Reload Bar Width | 40 | `StickFigure.ts:107` | Reload progress bar width (px) |
| Reload Bar Height | 6 | `StickFigure.ts:108` | Reload progress bar height (px) |
| Enemy Spawn Interval | 1500 | `MainScene.ts:131` | ms between enemy spawn attempts |
| Min Spawn Distance | 400 | `MainScene.ts:657` | Min distance from player for spawns |
| Radar Range | 600 | `MainScene.ts:280` | Minimap enemy visibility range |
| Dead Body Fade Delay | 5000 | `StickFigure.ts:451` | ms before death corpse starts fading |
| Dead Body Fade Duration | 2000 | `StickFigure.ts:451` | ms for corpse fade-out animation |

---

## Behavior

### Player Initialization

The human player is created in `MainScene.create()` with a random starting weapon.

**Source**: `MainScene.ts:102-106`

```typescript
// Random Start Weapon
const startWeapons = [WeaponType.BAT, WeaponType.UZI, WeaponType.AK47,
                      WeaponType.KATANA, WeaponType.SHOTGUN];
const myWeapon = Phaser.Utils.Array.GetRandom(startWeapons);

this.player = new StickFigure(this, 800, 800, 0x222222, 'YOU', myWeapon);
```

The `StickFigure` constructor:
1. Calls `super()` with a `'placeholder'` texture key
2. Hides the base sprite (`setVisible(false)`) since rendering is done via `Graphics`
3. Creates `Graphics` objects for body, reload bar, and weapon container
4. Sets a circular physics body with radius 15 and `collideWorldBounds(true)`
5. Adds a name tag text above the entity at Y offset -45

**Source**: `StickFigure.ts:46-77`

### Player Movement

Movement is handled entirely in `MainScene.handleMovement()`. WASD/arrow keys and virtual joystick input are combined into a velocity vector, normalized, and scaled to speed 350.

**Source**: `MainScene.ts:414-437`

```
function handleMovement():
    speed = 350
    velocityX, velocityY = 0

    // Keyboard input
    if left key down: velocityX = -1
    else if right key down: velocityX = 1
    if up key down: velocityY = -1
    else if down key down: velocityY = 1

    // Virtual joystick overrides
    if moveStick active:
        velocityX = moveStick.x
        velocityY = moveStick.y

    // Normalize and apply
    vec = normalize(velocityX, velocityY)
    if vec.length > 0:
        player.setVelocity(vec.x * speed, vec.y * speed)
    else:
        player.setVelocity(0, 0)
```

There is no sprint mechanic, no deceleration model, and no server-side physics. Phaser's arcade physics handles collision resolution with walls and world bounds.

### Aiming

Aiming is dual-input: virtual joystick (mobile) takes priority, with mouse pointer as fallback.

**Source**: `MainScene.ts:439-471`

- **Joystick aim**: `atan2(aimStick.y, aimStick.x)` directly sets rotation
- **Mouse aim**: Converts screen coordinates to world coordinates via `cameras.main.getWorldPoint()`, then calculates angle with `Phaser.Math.Angle.Between()`
- A reticle sprite follows the aim point

### Aim Sway

Bots (and the player) have procedural aim sway computed in `StickFigure.preUpdate()`.

**Source**: `StickFigure.ts:264-272`

```
swaySpeed = isMoving ? 0.008 : 0.002
swayMagnitude = isMoving ? 0.15 : 0.03  // radians (~8 degrees when moving)
aimSway = (sin(swayTime * swaySpeed) + sin(swayTime * swaySpeed * 0.7)) * swayMagnitude
```

The composite sine wave creates less predictable motion. Sway affects both visual weapon rotation and bullet trajectory (`finalAngle = rotation + aimSway`).

---

## Health System

### Taking Damage

Damage is applied directly to the `hp` field on `StickFigure`. There is a brief alpha-flash visual effect on hit.

**Source**: `StickFigure.ts:390-415`

```typescript
takeDamage(amount: number) {
    this.hp = Math.max(0, this.hp - amount);

    // Flash effect: tween alpha 255 -> 0 -> 255 over 100ms
    if (this.scene && this.graphics) {
        this.scene.tweens.addCounter({ /* alpha flash */ });
    }

    if (this.hp <= 0 && !this.isDead) {
        this.die();
    }
}
```

**Player damage path** (`MainScene.damagePlayer`, line 976):
1. Check `isDead` guard
2. Record `lastDamageTime` for regen interruption
3. Call `player.takeDamage(amount)`
4. Update `stats.health` and emit `PLAYER_UPDATE` to React HUD
5. Show damage received visual effects (directional indicator, camera flash, blood particles)
6. If dead, emit `GAME_OVER` event

### Health Regeneration

Regeneration uses a simpler model than the current codebase: no fractional accumulator, just direct floating-point addition per frame.

**Source**: `MainScene.ts:381-401`

```
function handleHealthRegen(time, delta):
    if time > lastDamageTime + REGEN_DELAY (3000ms) AND player.hp < 100:
        regenRate = 0.04
        amount = regenRate * delta    // delta is ms, so ~0.04 * 16.67 = ~0.67 HP/frame
        player.hp = min(100, player.hp + amount)

        // ~15% chance per frame: spawn green healing particle
        if random() > 0.85:
            spawn green circle particle floating upward
```

**Effective regen rate**: `0.04 * 1000 = 40 HP/second` (at 60fps, `0.04 * 16.67 ≈ 0.67 HP/frame`). This is significantly faster than the current codebase's 10 HP/s.

**Key differences from current codebase:**
- Regen delay is 3 seconds (vs. current 5 seconds)
- Regen rate is ~40 HP/s (vs. current 10 HP/s)
- No fractional accumulator (direct float addition to hp)
- Visual healing particles (green circles floating upward)
- `hp` is a float on `StickFigure` (despite `GameStats.health` being typed as `number`)

---

## Death System

### Player Death (Game Over)

When the human player dies, the game ends. There is no respawn.

**Source**: `MainScene.ts:986-988`

```typescript
if (this.player.isDead) {
    EventBus.emit(EVENTS.GAME_OVER, { score: this.stats.score, kills: this.stats.kills });
}
```

The React UI shows a "YOU DIED" overlay with final score and kill count, plus a "TRY AGAIN" button that restarts the scene.

### StickFigure Death Animation

When any `StickFigure` dies (player or bot), a death effect is drawn:

**Source**: `StickFigure.ts:417-456`

```
function die():
    isDead = true
    clear all graphics (body, reload bar)
    destroy weapon container and name text
    destroy the sprite itself

    // Draw death corpse: scattered limb lines in gray
    draw 4 lines radiating from death position at angles +-0.5 and +-2.5 from rotation
    draw gray circle (head) at offset 25px in rotation direction

    // Corpse fades out after 5 seconds over 2 seconds
    tween corpse alpha to 0 over 2000ms after 5000ms delay, then destroy
```

### Bot Death

When a bot dies:
1. Weapon drop is spawned at death location (`MainScene.spawnWeaponDrop`)
2. If killed by player: increment `kills`, add 100 to `score`, emit `BOT_KILLED` event
3. The `BOT_KILLED` event triggers a 30% chance Gemini API call for a bot death taunt in chat

**Source**: `MainScene.ts:877-885`

---

## Statistics Tracking

Statistics are simple counters on `MainScene.stats`:

| Stat | Type | Updated When |
|------|------|-------------|
| `health` | number (0-100) | Every damage/regen tick |
| `ammo` | number | Every shot, reload, weapon switch |
| `maxAmmo` | number | Weapon switch |
| `isReloading` | boolean | Reload start/complete |
| `score` | number | +100 per bot kill |
| `kills` | number | +1 per bot kill |
| `wave` | number | Affects max enemy count (`3 + floor(wave/2)`) |
| `isGameOver` | boolean | On player death |

Stats are emitted to React via `EventBus.emit(EVENTS.PLAYER_UPDATE, stats)` for HUD rendering.

There is no K/D ratio, no XP system, and no per-player statistics tracking (since there's only one human player).

---

## Input Handling

### Keyboard

**Source**: `MainScene.ts:115-122`

- WASD and arrow keys for movement (via Phaser's `createCursorKeys()` and `addKeys()`)
- R key for manual reload
- Mouse left-click for shooting (checked via `mousePointer.primaryDown`)

### Virtual Joysticks (Mobile)

**Source**: `App.tsx:93-99`, `components/Joystick.tsx`

- Left joystick: movement (emits `INPUT_MOVE` via `EventBus`)
- Right joystick: aim and auto-fire (emits `INPUT_AIM` via `EventBus`)
- Auto-fire threshold: joystick displacement > 0.3 on either axis

### Input → EventBus Flow

```
Joystick.tsx → EventBus.emit('input-move') → MainScene.moveStick
Joystick.tsx → EventBus.emit('input-aim')  → MainScene.aimStick
Mouse/Keys  → Direct Phaser input polling in update()
```

---

## Rendering

### Stick Figure Drawing

The player is rendered procedurally via `Phaser.GameObjects.Graphics` in `StickFigure.draw()`, called every frame from `preUpdate()`.

**Source**: `StickFigure.ts:297-388`

Components drawn (in order):
1. **Legs**: Two lines from center to foot positions, animated by walk cycle sine wave. Stride length 16px, side offset 8px. Small 3px circles at feet.
2. **Arms**: Two lines from center to hand positions. Hand positions vary by weapon type (e.g., AK47 has left hand at 35px forward, right at 10px forward). 3px circles at hands.
3. **Head**: Filled circle radius 13px at center, with thin dark outline.

All positions are rotated by the entity's `rotation` (aim angle) using a `calcPoint()` helper.

### Walk Cycle

**Source**: `StickFigure.ts:251-262`

Walk animation is driven by `walkCycle` counter that increments by `delta * 0.02` when speed > 5. Leg positions oscillate via `sin(walkCycle)` and `sin(walkCycle + PI)`.

### Weapon Visuals

Weapons are drawn as `Phaser.GameObjects.Rectangle` composites in a container:

| Weapon | Visual Components |
|--------|------------------|
| BAT | Black grip (15x4), silver body (35x6), silver end cap (5x7) |
| KATANA | Dark handle (15x4), gold guard (4x12), white blade (50x3) |
| UZI | Gray body (20x10), dark handle (8x8), dark barrel (8x4), dark magazine (6x10) |
| SHOTGUN | Wood stock (12x6), gray body (20x6), dark barrel (18x4), wood pump (8x5) |
| AK47 | Wood stock (15x6), dark receiver (25x6), dark barrel (20x3), wood handguard (12x5), angled magazine (6x12) |

**Source**: `StickFigure.ts:119-172`

### Attack Animations

**Melee** (BAT/KATANA): Weapon container swings from -45 to +60 degrees over 100ms with yoyo.

**Ranged**: Recoil offset tween (-6px, or -10px for shotgun) over 50ms with yoyo. Muzzle flash circle (8px radius, yellow) at barrel end, fades in 40ms. Shotgun flash is 1.5x scale.

**Source**: `StickFigure.ts:196-248`

---

## AI Behavior

Bots use the same `StickFigure` class. AI logic is in `MainScene.handleEnemies()`.

**Source**: `MainScene.ts:681-788`

### Target Selection

Each bot finds the nearest living entity (player or other bot) as its target.

### Movement Strategy

1. **Line of Sight (LOS)**: Checked every 200ms via `hasLineOfSight()` (ray vs wall rectangles)
2. **If LOS**: Move directly toward target at 160px/s via `physics.moveToObject()`
3. **If no LOS**: Use A* pathfinding (`Pathfinder.findPath()`) with 50px grid tiles, max 500 steps. Path recalculated every 500ms or when path is exhausted.
4. **Stop distance**: Melee = 40px, UZI/Shotgun = 150px, AK47/default = 250px

### Attack Logic

- Bots attack when target is within attack range AND has LOS
- Same `executeAttack()` function as player (shared firing code)
- Additional aim inaccuracy: `+/- 0.2 radians (~11 degrees)` random offset added to bot aim
- Bots auto-reload when ammo reaches 0

### Spawn Logic

- Enemies spawn every 1500ms
- Max enemies: `3 + floor(wave/2)`
- Spawn position: random within 100-1500 range, must be on valid nav tile and > 400px from player
- Random weapon and name from preset lists
- Color: `0xff0000` (red) for all bots vs `0x222222` (dark gray) for player

---

## Error Handling

### Null/Destroyed Guards

The codebase uses extensive null/active checks before accessing game objects:

- `StickFigure.preUpdate()` checks `this.graphics` before `draw()`
- `StickFigure.updateAttachments()` checks `nameText.active` and `weaponContainer.active`
- `MainScene.update()` returns early if `!this.player || this.player.isDead`
- Bullet collision handlers check `bullet.active && enemy.active`
- Reload tween checks `unit.active` before updating/completing

### Friendly Fire Prevention

- `handleEnemyBulletHitEnemy()` checks `bullet.owner === enemy` to prevent self-damage
- `handlePlayerHitByBullet()` checks `bullet.owner === player` (implicit via separate bullet groups)

### World Bounds

- Physics world bounds set to 1600x1600
- `collideWorldBounds(true)` on player entity
- Bullets cleaned up if they exit 0-1600 range on either axis

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-02-15 | Initial spec documenting pre-BMM archive snapshot |
| 1.0.1 | 2026-02-16 | Verified against source — no corrections needed (all values, line numbers, and descriptions match) |
