# Graphics (Pre-BMM Archive)

> **Spec Version**: 1.0.0
> **Last Updated**: 2026-02-15
> **Archive Snapshot**: 2025-11-25 05:55:21
> **Depends On**: [types.ts](../types.ts), [StickFigure.ts](../game/objects/StickFigure.ts), [MainScene.ts](../game/scenes/MainScene.ts)
> **Depended By**: Player rendering, combat visuals, HUD

---

## Overview

The graphics system in the pre-BMM codebase renders all visual elements using a **hybrid approach**: stick figures are drawn procedurally via Phaser's `GameObjects.Graphics` API, while bullets use pre-generated textures. There are no external sprite sheets or image assets — all visuals are created programmatically at runtime.

**Key architectural differences from the current (post-BMM) codebase:**
- No dedicated graphics manager classes (ProceduralPlayerGraphics, HitEffectManager, etc.)
- Rendering logic is embedded directly in `StickFigure` and `MainScene`
- No object pooling for hit effects — effects are created and destroyed ad-hoc
- No world-space health bars on players — health is only shown in the React HUD
- No crosshair with dynamic spread — a static reticle sprite is used instead
- No dodge roll visuals (dodge roll mechanic doesn't exist)
- No melee swing arc rendering — melee uses a simple white stroke arc
- Bullet textures are pre-generated via `TextureGenerator`, not drawn per-frame
- Muzzle flash is a Phaser circle game object, not a Graphics-drawn diamond
- Player color is fixed: `0x222222` (dark gray) for human, `0xff0000` (red) for all bots
- Death creates a scattered-limb corpse graphic that fades after 5 seconds

---

## Dependencies

### Technology Dependencies

| Technology | Version | Purpose |
|------------|---------|---------|
| Phaser 3 | ^3.90.0 | Game framework, Graphics API, tweens |
| React | ^19.2.0 | HUD overlay (health bar, ammo, score) |
| TypeScript | ~5.8.2 | Type-safe development |
| Vite | ^6.2.0 | Build tool and dev server |

### File Dependencies

- `game/objects/StickFigure.ts` - Player/bot entity with embedded rendering
- `game/utils/TextureGenerator.ts` - Pre-generated bullet and UI textures
- `game/scenes/MainScene.ts` - Game loop, effects, minimap, tracers
- `game/world/LevelGenerator.ts` - Arena floor grid and wall rendering
- `game/phaserGame.ts` - Phaser config (renderer type, background)
- `App.tsx` - React HUD rendering (health bar, ammo, score, kill overlay)

---

## Constants

All graphics constants are hardcoded in source files.

### Colors

| Constant | Hex Value | Location | Description |
|----------|-----------|----------|-------------|
| Player Color | 0x222222 | `MainScene.ts:105` | Human player stick figure (dark gray) |
| Bot Color | 0xff0000 | `MainScene.ts:670` | All bot stick figures (red) |
| Dead Corpse Color | 0x444444 | `StickFigure.ts:430,445` | Death corpse lines and head |
| Background Color | #cfd8dc | `MainScene.ts:87` | Camera background (light blue-gray) |
| Background Alt | #1a1a1a | `phaserGame.ts:8` | Phaser config background (dark) |
| Floor Grid | 0xb0bec5 | `LevelGenerator.ts:12` | Floor grid lines (light gray) |
| Wall Color | 0x37474f | `LevelGenerator.ts:26` | Wall rectangles (blue-gray) |
| Desk Color | 0x795548 | `LevelGenerator.ts:27` | Desk furniture (brown) |
| Desk Stroke | 0x4e342e | `LevelGenerator.ts:43` | Desk outline (dark brown) |
| Bullet Pellet | 0xffffaa | `TextureGenerator.ts:13` | Pellet bullet fill color |
| Bullet Tracer Texture | 0xffffcc | `TextureGenerator.ts:19` | Tracer rectangle fill color |
| Muzzle Flash | 0xffffaa | `StickFigure.ts:226` | Muzzle flash circle color |
| Melee Slash | 0xffffff | `MainScene.ts:520` | Melee swing arc stroke color |
| Hit Marker | 0xffffff | `TextureGenerator.ts:41` | X-shaped hit marker |
| Blood Particle | 0xcc0000 | `MainScene.ts:960` | Damage blood particle color |
| Healing Particle | 0x00ff00 | `MainScene.ts:391` | Health regen particle color |
| Spark (Wall Block) | 0xffff00 | `MainScene.ts:569` | Bullet blocked by wall spark |

### Dimensions

| Constant | Value | Location | Description |
|----------|-------|----------|-------------|
| World Size | 1600x1600 | `MainScene.ts:88` | Physics world bounds |
| Head Radius | 13 | `StickFigure.ts:385` | Stick figure head circle |
| Foot Radius | 3 | `StickFigure.ts:336-337` | Foot circle radius |
| Hand Radius | 3 | `StickFigure.ts:379-380` | Hand circle radius |
| Leg Line Width | 3 | `StickFigure.ts:313` | Leg stroke width |
| Arm Line Width | 2 | `StickFigure.ts:367` | Arm stroke width |
| Head Outline Width | 1 | `StickFigure.ts:386` | Head outline stroke (0.3 alpha) |
| Stride Length | 16 | `StickFigure.ts:316` | Walk cycle stride (px) |
| Foot Side Offset | 8 | `StickFigure.ts:317` | Lateral foot offset (px) |
| Default Arm Reach | 20 | `StickFigure.ts:341-342` | Default hand X offset from center |
| Hitbox Radius | 15 | `StickFigure.ts:75` | Circle collider radius |
| Bullet Pellet Size | 4x4 | `TextureGenerator.ts:15` | Pellet texture dimensions |
| Bullet Tracer Size | 20x2 | `TextureGenerator.ts:21` | Tracer texture dimensions |
| Reticle Size | 32x32 | `TextureGenerator.ts:37` | Reticle sprite texture |
| Hit Marker Size | 20x20 | `TextureGenerator.ts:46` | Hit marker sprite texture |
| Hit Indicator Size | 16x16 | `TextureGenerator.ts:58` | Directional hit chevron |
| Reload Bar Width | 40 | `StickFigure.ts:107` | Reload progress bar (px) |
| Reload Bar Height | 6 | `StickFigure.ts:108` | Reload progress bar (px) |

### Animation Timings

| Constant | Value | Unit | Location | Description |
|----------|-------|------|----------|-------------|
| Walk Speed Factor | 0.02 | multiplier | `StickFigure.ts:259` | Walk cycle speed per delta ms |
| Walk Speed Threshold | 5 | px/s | `StickFigure.ts:258` | Minimum speed to animate legs |
| Melee Swing Duration | 100 | ms | `StickFigure.ts:203` | Weapon container swing tween |
| Recoil Duration | 50 | ms | `StickFigure.ts:219` | Gun recoil kickback tween |
| Muzzle Flash Fade | 40 | ms | `StickFigure.ts:242` | Muzzle flash alpha fade |
| Melee Arc Fade | 200 | ms | `MainScene.ts:524` | Melee slash arc fade |
| Hit Marker Fade | 150 | ms | `MainScene.ts:820` | Hit marker scale+fade |
| Damage Flash Duration | 100 | ms | `StickFigure.ts:395` | Damage alpha flash |
| Blood Particle Duration | 500 | ms | `MainScene.ts:969` | Blood particle fade |
| Healing Particle Duration | 600 | ms | `MainScene.ts:396` | Green heal particle rise+fade |
| Damage Number Duration | 800 | ms | `MainScene.ts:856` | Floating damage text fade |
| Tracer Fade Rate | delta/150 | per frame | `MainScene.ts:228` | Bullet tracer alpha decay |
| Death Corpse Delay | 5000 | ms | `StickFigure.ts:451` | Delay before corpse starts fading |
| Death Corpse Fade | 2000 | ms | `StickFigure.ts:451` | Corpse fade-out duration |
| Camera Shake | 50 | ms | `MainScene.ts:846` | Shake duration on hit confirm |
| Camera Flash | 100 | ms | `MainScene.ts:957` | Red flash on player hit |
| Wall Spark Fade | 100 | ms | `MainScene.ts:570` | Bullet-wall spark effect |
| Reload Animation | 200 | ms | `StickFigure.ts:183` | Weapon alpha/scale pulse |

---

## Data Structures

### Generated Textures

The `TextureGenerator.ts` pre-generates all textures during `preload()`. No external image files are loaded.

**Source**: `game/utils/TextureGenerator.ts`

| Texture Key | Shape | Dimensions | Description |
|-------------|-------|------------|-------------|
| `placeholder` | White circle | 30x30 | Base sprite texture (hidden; used for physics body) |
| `bullet_pellet` | Yellow-white circle | 4x4 | Small round bullet |
| `bullet_tracer` | Yellow-white rectangle | 20x2 | Elongated tracer line |
| `reticle` | Crosshair + circle | 32x32 | Aiming reticle with red center dot |
| `hitmarker` | White X | 20x20 | Hit confirmation marker |
| `hit_indicator` | White chevron | 16x16 | Directional damage indicator |
| `drop_{WeaponType}` | Colored rectangle | Varies | Weapon drop icons per weapon |

### Weapon Drop Icons

**Source**: `TextureGenerator.ts:61-76`

| Key | Color | Dimensions | Weapon |
|-----|-------|------------|--------|
| `drop_BAT` | 0xcccccc (silver) | 30x6 | Baseball bat |
| `drop_KATANA` | 0xffffff (white) | 40x4 | Katana |
| `drop_UZI` | 0x333333 (dark gray) | 20x12 | Uzi |
| `drop_AK47` | 0x5d4037 (brown) | 40x8 | AK-47 |
| `drop_SHOTGUN` | 0x5d4037 (brown) | 35x10 | Shotgun |

Each drop icon has a dark shadow circle, colored rectangle fill, and white outline stroke.

### Tracer (Runtime Data)

**Source**: `MainScene.ts:18-20`

```typescript
interface Tracer {
    x1: number; y1: number;  // Start position
    x2: number; y2: number;  // End position
    alpha: number;            // Current opacity (fades to 0)
    color: number;            // Tracer color
}
```

---

## Behavior

### Stick Figure Rendering

The stick figure is drawn procedurally every frame in `StickFigure.draw()`, called from `preUpdate()`. All positions are in local coordinates, rotated by the entity's aim angle.

**Source**: `StickFigure.ts:297-388`

**Components drawn (in order):**

1. **Legs**: Two 3px lines from center `(cx, cy)` to foot positions. Foot positions are computed using walk cycle sine waves with stride 16px and side offset 8px. Small filled circles (radius 3) at feet.

2. **Arms**: Two 2px lines from center to hand positions. Hand positions vary by weapon type. Small filled circles (radius 3) at hands.

3. **Head**: Filled circle at center, radius 13px. Thin black outline (1px, 0.3 alpha).

**Rotation model**: All points are rotated around the entity center using:
```typescript
calcPoint(localX, localY) = {
    x: cx + (localX * cos(rot) - localY * sin(rot)),
    y: cy + (localX * sin(rot) + localY * cos(rot))
}
```

Where `rot` is `this.rotation` (the aim angle).

**Key difference from current codebase**: The pre-BMM version draws in **world coordinates** (`cx = this.x, cy = this.y`), not local coordinates (0, 0). There is no container; the graphics object draws at the sprite's world position directly.

### Weapon-Specific Arm Positions

Hand positions change based on the equipped weapon to match the weapon's visual grip points.

**Source**: `StickFigure.ts:341-362`

| Weapon | Left Hand (X, Y) | Right Hand (X, Y) | Notes |
|--------|-------------------|-------------------|-------|
| Default (Pistol/none) | (20, -3) | (20, 3) | Both hands forward |
| UZI | (15, -2) | (15, 4) | Compact grip |
| BAT / KATANA | (10, -2) | (10, 2) | Two-handed grip, close in |
| AK47 | (35, -2) | (10, 4) | Left on handguard, right on grip |
| SHOTGUN | (32, 4) | (5, 2) | Left on pump, right on stock |

All X positions are modified by `recoilOffset` for ranged weapons (gun kickback effect).

### Walk Animation

Walk animation is driven by a `walkCycle` counter incremented in `preUpdate()`.

**Source**: `StickFigure.ts:251-262`

```
if speed > 5:
    walkCycle += delta * 0.02
else:
    walkCycle = 0

leftLegProgress = sin(walkCycle)
rightLegProgress = sin(walkCycle + PI)

leftFootPos = calcPoint(leftLegProgress * 16, -8)
rightFootPos = calcPoint(rightLegProgress * 16, 8)
```

The speed threshold of 5 (from `body.speed`) prevents leg animation during very slow movements. Setting `walkCycle = 0` when stopped snaps legs to neutral position.

### Aim Sway

Both players and bots have procedural aim sway computed per frame.

**Source**: `StickFigure.ts:264-272`

```
swayTime += delta
isMoving = speed > 10
swaySpeed = isMoving ? 0.008 : 0.002
swayMagnitude = isMoving ? 0.15 : 0.03   // radians (~8 degrees when moving)

aimSway = (sin(swayTime * swaySpeed) + sin(swayTime * swaySpeed * 0.7)) * swayMagnitude
```

The composite sine wave (two frequencies) creates less predictable motion. Sway affects:
- Visual weapon container rotation: `weaponContainer.setRotation(rotation + aimSway)`
- Bullet trajectory: `angle = shooter.rotation + (shooter.aimSway || 0)`

### Weapon Rendering

Weapons are drawn as `Phaser.GameObjects.Rectangle` composites in a `Phaser.GameObjects.Container`.

**Source**: `StickFigure.ts:119-172`

#### BAT (Aluminum)
```
Grip:   Rectangle(10, 0, 15x4, 0x000000)   // Black handle
Body:   Rectangle(30, 0, 35x6, 0xcccccc)   // Silver metal
EndCap: Rectangle(48, 0, 5x7, 0xcccccc)    // Silver end
```

#### KATANA
```
Handle: Rectangle(5, 0, 15x4, 0x212121)    // Dark handle
Guard:  Rectangle(15, 0, 4x12, 0xd4af37)   // Gold guard
Blade:  Rectangle(40, 0, 50x3, 0xffffff)   // White blade
```

#### UZI
```
Body:     Rectangle(20, 0, 20x10, 0x333333)  // Gray body
Handle:   Rectangle(15, 5, 8x8, 0x222222)    // Dark handle
Barrel:   Rectangle(32, -2, 8x4, 0x111111)   // Dark barrel
Magazine: Rectangle(22, 8, 6x10, 0x111111)   // Dark magazine
```

#### SHOTGUN
```
Stock:  Rectangle(0, 0, 12x6, 0x5d4037)    // Dark wood
Body:   Rectangle(18, 0, 20x6, 0x333333)   // Gray metal
Barrel: Rectangle(38, -1, 18x4, 0x111111)  // Dark barrel
Pump:   Rectangle(32, 3, 8x5, 0x5d4037)    // Dark wood
```

#### AK47 (Default)
```
Stock:     Rectangle(0, 0, 15x6, 0x8d6e63)   // Wood
Receiver:  Rectangle(20, 0, 25x6, 0x222222)  // Dark metal
Barrel:    Rectangle(40, 0, 20x3, 0x111111)  // Dark barrel
Handguard: Rectangle(35, 0, 12x5, 0x8d6e63) // Wood
Magazine:  Rectangle(25, 5, 6x12, 0x111111)  // Dark, rotated -0.3 radians
```

Note: There is no Pistol weapon in the pre-BMM codebase. AK47 is the default weapon case.

### Weapon Container Positioning

The weapon container follows the player position, offset by recoil.

**Source**: `StickFigure.ts:278-295`

```
recoilX = cos(rotation) * recoilOffset
recoilY = sin(rotation) * recoilOffset
weaponContainer.setPosition(x + recoilX, y + recoilY)

if not attacking:
    weaponContainer.setRotation(rotation + aimSway)
// During melee attack, tween controls rotation
```

### Attack Animations

#### Melee Swing (BAT/KATANA)

A tween rotates the weapon container from -45 to +60 degrees over 100ms with yoyo (back to start).

**Source**: `StickFigure.ts:199-210`

```
tween:
    targets: weaponContainer
    angle: from (current - 45) to (current + 60)
    duration: 100ms
    yoyo: true
    onComplete: reset to angle 0
```

#### Gun Recoil

A tween moves `recoilOffset` to a negative value and back. Simultaneously, a muzzle flash circle is created at the barrel end.

**Source**: `StickFigure.ts:212-248`

```
recoilOffset tween:
    distance: -6px (default), -10px (shotgun)
    duration: 50ms
    yoyo: true

muzzle flash:
    shape: Phaser circle (radius 8, color 0xffffaa)
    position: barrel end (30px default, 50px AK47, 35px UZI, 45px shotgun)
    scale: 0.8 + random()*0.4 (shotgun always 1.5x)
    fade: alpha 0, scale 0.5, 40ms duration
    destroyed on complete
```

#### Reload Animation

Weapon container pulses: alpha to 0.5, scale to 0.8, over 200ms, yoyo, repeat 2x.

**Source**: `StickFigure.ts:175-193`

### Melee Slash Arc (MainScene)

When a melee attack is performed, a white arc is drawn from the attacker's position.

**Source**: `MainScene.ts:519-524`

```
graphics.lineStyle(2, 0xffffff, 0.8)
arc(attacker.x, attacker.y, range, angle - 0.7, angle + 0.7)
strokePath()
tween alpha to 0 over 200ms, then destroy
```

The arc spans ~80 degrees (0.7 radians each side = 1.4 radians total). This is a simple visual indicator, not the detailed pie-slice fill used in the current codebase.

### Projectile Rendering

Projectiles use pre-generated textures from `TextureGenerator`, not per-frame Graphics drawing.

**Source**: `MainScene.ts:556-638`

| Weapon | Texture | Tint | Scale | Body Radius |
|--------|---------|------|-------|-------------|
| AK47 | `bullet_tracer` | 0xffaa00 | 1.0 | 2px |
| Shotgun | `bullet_pellet` | 0xff0000 | 1.2 | 3px |
| Default (UZI/etc) | `bullet_pellet` | 0xffff00 | 1.0 | 2px |

Projectile spread is applied per-weapon:
- UZI: `+/- 0.15 radians` random spread
- AK47: `+/- 0.025 radians` random spread
- Shotgun: `+/- 0.3 radians` random spread, 6 pellets, speed variance 0.8x-1.2x

Bots get additional `+/- 0.2 radians` aim error.

### Bullet Tracers (MainScene)

Tracers are drawn as fading lines in a separate `tracerGraphics` overlay (depth 999).

**Source**: `MainScene.ts:223-238`

```
for each tracer:
    tracer.alpha -= delta / 150
    if alpha <= 0: remove
    else:
        lineStyle(1, tracer.color, tracer.alpha)
        drawLine(x1, y1, x2, y2)
```

Tracers are added on hit confirmation (`MainScene.ts:841-843`): from player position to target position, with color white (normal hit) or red (kill).

### Hit Effects

#### Hit Marker

On hitting an enemy, a `hitmarker` sprite appears at the reticle position.

**Source**: `MainScene.ts:809-823`

- Normal hit: white tint, 1.2x scale
- Kill: red tint, 2.0x scale
- Fades and shrinks over 150ms

#### Directional Hit Indicator (Outgoing)

A `hit_indicator` chevron sprite appears between player and target, rotated to point at target.

**Source**: `MainScene.ts:825-838`

- Position: 60px from player in direction of target
- Color: white (normal) or red (kill)
- Fades with scale 1.5x over 200ms

#### Directional Hit Indicator (Incoming)

When the player takes damage, the same chevron appears pointing toward the damage source.

**Source**: `MainScene.ts:940-955`

- Position: 60px from player toward damage source
- Color: always red
- Fades with scale 1.5x over 400ms

#### Camera Flash (Incoming Damage)

Red camera flash on player damage.

**Source**: `MainScene.ts:957`

```
cameras.main.flash(100, 128, 0, 0)  // 100ms, RGB(128,0,0)
```

#### Blood Particles (Incoming Damage)

5 blood particles spawn at player position on damage.

**Source**: `MainScene.ts:959-973`

- Shape: circles, 2-5px radius, 0xcc0000
- Physics: velocity burst away from damage source, 50-150px/s
- Drag: 200
- Fade: alpha 0, scale 0, 500ms

#### Camera Shake (Outgoing)

Small camera shake on confirmed hit.

**Source**: `MainScene.ts:846`

```
cameras.main.shake(50, 0.001)  // 50ms, 0.1% intensity
```

#### Damage Numbers

Floating damage text appears above damaged entity.

**Source**: `MainScene.ts:849-860`

- Font: 16px Arial (normal), 24px (kill)
- Color: white (normal), red (kill)
- Black outline stroke 2px
- Floats upward by 50px, fades over 800ms

#### Wall Spark

When a bullet spawn point is blocked by a wall, a yellow spark appears.

**Source**: `MainScene.ts:569-571`

- Shape: circle, radius 3, 0xffff00
- Fades with scale 2x over 100ms

### Healing Particles

During health regeneration, green particles float upward from the player.

**Source**: `MainScene.ts:389-398`

- ~15% chance per frame (random > 0.85)
- Shape: circle, radius 2, 0x00ff00
- Position: random +/- 12.5px from player center
- Float upward 20px, fade over 600ms

### Death Corpse

When a `StickFigure` dies, a static corpse graphic is drawn and the entity is destroyed.

**Source**: `StickFigure.ts:417-456`

```
function die():
    isDead = true
    clear graphics, destroy weapon container + name text
    destroy sprite

    // Draw corpse: 4 limb lines in gray (0x444444)
    line width 3
    draw line from (x,y) to 20px at angle (rotation + 0.5)
    draw line from (x,y) to 20px at angle (rotation - 0.5)
    draw line from (x,y) to 20px at angle (rotation + 2.5)
    draw line from (x,y) to 20px at angle (rotation - 2.5)

    // Gray head circle
    fill circle at 25px in rotation direction, radius 10

    // Fade out
    tween alpha to 0 over 2000ms after 5000ms delay, then destroy
```

### Reticle (Crosshair)

The reticle is a pre-generated sprite texture, not a dynamic crosshair.

**Source**: `TextureGenerator.ts:24-37`

Composition:
- Outer ring: white circle stroke, radius 10, at center (16,16)
- Four cross lines: 6px each, from edges toward center
- Center dot: red filled circle, radius 2

**Usage**: `MainScene.ts:109`
```typescript
this.reticle = this.add.sprite(800, 800, 'reticle').setDepth(100).setAlpha(0.8);
```

The reticle follows the aim point (mouse world position or joystick direction) and is always visible when playing. There is no dynamic spread indicator.

### Reload Bar

A simple progress bar drawn above the reloading entity.

**Source**: `StickFigure.ts:102-117`

```
position: (entity.x - 20, entity.y - 60)
dimensions: 40x6 px
background: 0x000000, 0.8 alpha
fill: 0xffffff, width = (40 - 2) * progress
// progress ranges from 0 to 1 during reload
// hidden when progress >= 1 or <= 0
```

### Minimap

A minimap in the top-left corner shows walls, player, and nearby enemies.

**Source**: `MainScene.ts:139-327`

**Static layer** (drawn once):
- Position: (20, 20)
- Scale: 0.075 (1600px world → 120px minimap)
- Background: black, 0.7 alpha
- Border: white, 0.5 alpha, 2px
- Walls: gray (0x555555) rectangles

**Dynamic layer** (updated each frame):
- Player dot: green (0x00ff00), radius 4
- Enemy dots: red (0xff0000), radius 3
- Radar range: green circle, radius 600 * 0.075 = 45px, 0.15 alpha
- Player aim line: green, 10px long in rotation direction
- Enemies beyond 600px are hidden (radar range limit)

Both layers use `setScrollFactor(0)` for screen-fixed positioning. Static at depth 1999, dynamic at depth 2000.

### Arena Floor Grid

A simple grid drawn across the entire world.

**Source**: `LevelGenerator.ts:10-23`

```
lineStyle(1, 0xb0bec5, 0.5)  // Light gray, 50% alpha
vertical lines every 100px from x=0 to x=1600
horizontal lines every 100px from y=0 to y=1600
depth: -1 (below everything)
```

### Weapon Drops

When bots die, their weapon drops as a pickup.

**Source**: `MainScene.ts:888-912`

- Sprite uses pre-generated `drop_{WeaponType}` texture
- Depth: 5
- Bobbing: Y position -5px, yoyo, 1000ms, Sine.easeInOut, forever
- Glow ring: circle, stroke 2px 0xffff00 0.5 alpha, scale 1.5x pulse with fade, forever
- Auto-destroy: 30 seconds after spawn

---

## HUD Rendering (React)

The HUD is rendered as React components overlaying the Phaser canvas, not as in-game Phaser UI elements.

**Source**: `App.tsx:148-189`

### Health Bar

- Position: top-left (with left padding 176px to avoid minimap)
- Icon: `<Activity>` from lucide-react, red pulse when < 30%
- Bar: 192px wide, 16px tall, gray-800 background, rounded
- Fill: green-500 (>= 30%) or red-600 (< 30%), width transition 0.2s
- Text: `{Math.round(health)}%` in monospace bold

### Ammo Display

- Below health bar
- Icon: `<Crosshair>` (normal) or `<RefreshCw>` spinning (reloading)
- Color: yellow-500 (normal) or red-500 pulse (reloading)
- Text: `{ammo}/{maxAmmo}` or `INF` for melee weapons
- "RELOADING..." text when reloading

### Score Display

- Top-right
- Score: 6-digit zero-padded, 24px monospace bold
- Kills: red-400, monospace

### Game Over Screen

- Full-screen overlay: black, 80% opacity, backdrop blur
- Title: "YOU DIED", 48px bold white
- Trophy icon + score, Skull icon + kills
- "TRY AGAIN" button: white border, hover fills white

### Debug Text

A development overlay showing performance metrics.

**Source**: `MainScene.ts:134-136, 205-212`

- Position: (10, 150), fixed to screen
- Font: 10px monospace, green on dark background
- Shows: FPS, update time (ms), AI time (ms), entity/bullet counts
- Depth: 9999

---

## Error Handling

### Graphics Object Destroyed

All rendering calls check `this.graphics` existence before drawing.

**Source**: `StickFigure.ts:298`
```typescript
if (!this.graphics) return;
```

### Weapon Container Null Guard

Weapon drawing and updates check container existence.

**Source**: `StickFigure.ts:120, 282`
```typescript
if (!this.weaponContainer) return;
```

### Active State Guards

Attachment updates (name, weapon) check `.active` before modifying.

**Source**: `StickFigure.ts:279, 282`

### Tween Cancellation

Reload tweens check `unit.active` on each update tick and stop if the entity was destroyed mid-reload.

**Source**: `MainScene.ts:365-368`

---

## Implementation Notes

### TypeScript (Client)

**File Organization**: Unlike the current codebase with dedicated graphics manager classes, the pre-BMM codebase embeds all rendering in two files:
- `StickFigure.ts` - Entity rendering (body, weapon, reload bar, death)
- `MainScene.ts` - Effects (tracers, hit markers, blood, minimap, damage numbers)

**Texture Generation**: `TextureGenerator.ts` pre-generates all sprite textures in `preload()`. This avoids loading external assets while still using Phaser's sprite system for bullets (which need physics bodies).

**Performance Patterns**:
- `graphics.clear()` before each redraw in `draw()`
- Pre-generated textures for pooled bullets (max 50 per group)
- Minimap static elements drawn once, dynamic elements redrawn per frame
- Tracer array cleaned in reverse (splice from end)

**Depth Layering (Low to High)**:
1. Floor Grid: -1
2. Weapon Drops: 5
3. Reticle: 100
4. Hit Markers: 1000
5. Hit Indicators: 1001
6. Minimap Static: 1999
7. Minimap Dynamic: 2000
8. Debug Text: 9999
9. Tracer Graphics: 999

Note: `StickFigure` entities and walls have no explicit depth set (default 0).

### Go (Server)

There is no server in the pre-BMM codebase. The game is entirely client-side.

---

## Test Scenarios

### TS-GFX-001: Stick Figure Renders All Body Parts

**Category**: Visual
**Priority**: Critical

**Preconditions:**
- MainScene is active
- Player StickFigure exists

**Input:**
- StickFigure at position (800, 800), rotation 0

**Expected Output:**
- Head circle (radius 13) drawn at (800, 800)
- Two arm lines + hand circles (radius 3)
- Two leg lines + foot circles (radius 3)
- All parts in player color (0x222222)

---

### TS-GFX-002: Walk Animation Oscillates Legs

**Category**: Visual
**Priority**: High

**Preconditions:**
- Player body speed > 5

**Input:**
- Multiple frames with non-zero velocity

**Expected Output:**
- walkCycle increases by delta * 0.02 each frame
- Left foot position uses sin(walkCycle) * 16
- Right foot position uses sin(walkCycle + PI) * 16
- Legs move in opposite phase

---

### TS-GFX-003: Walk Cycle Resets When Stopped

**Category**: Unit
**Priority**: High

**Input:**
- Player velocity set to (0, 0)

**Expected Output:**
- walkCycle resets to 0
- Both legs return to neutral position

---

### TS-GFX-004: Weapon Visual Matches Equipped Type

**Category**: Visual
**Priority**: High

**Input:**
- StickFigure with each WeaponType

**Expected Output:**
- BAT: 3 rectangles (grip, body, end cap)
- KATANA: 3 rectangles (handle, guard, blade)
- UZI: 4 rectangles (body, handle, barrel, magazine)
- SHOTGUN: 4 rectangles (stock, body, barrel, pump)
- AK47: 5 rectangles (stock, receiver, barrel, handguard, magazine)

---

### TS-GFX-005: Muzzle Flash Appears on Ranged Attack

**Category**: Visual
**Priority**: Medium

**Preconditions:**
- Player fires a ranged weapon

**Expected Output:**
- Yellow circle (radius 8) at barrel end
- Scale randomized 0.8-1.2 (1.5 for shotgun)
- Fades to alpha 0 over 40ms
- Destroyed after fade

---

### TS-GFX-006: Melee Swing Shows Arc

**Category**: Visual
**Priority**: Medium

**Input:**
- Player attacks with BAT or KATANA

**Expected Output:**
- White arc stroke (2px, 0.8 alpha) centered on attacker
- Arc spans +-0.7 radians from aim angle
- Fades over 200ms

---

### TS-GFX-007: Death Corpse Rendered and Fades

**Category**: Visual
**Priority**: High

**Preconditions:**
- StickFigure dies

**Expected Output:**
- 4 gray lines radiating from death position
- Gray circle (radius 10) as head
- Remains visible for 5 seconds
- Fades over 2 seconds
- Graphics destroyed after fade

---

### TS-GFX-008: Minimap Shows Player and Enemies

**Category**: Visual
**Priority**: Medium

**Input:**
- Player at (800, 800)
- Enemy within 600px

**Expected Output:**
- Green dot at scaled player position
- Red dot at scaled enemy position
- Green aim line from player dot
- Radar range ring visible

---

### TS-GFX-009: Minimap Hides Distant Enemies

**Category**: Unit
**Priority**: Medium

**Input:**
- Enemy at > 600px from player

**Expected Output:**
- Enemy dot not drawn on minimap

---

### TS-GFX-010: Damage Number Floats Upward

**Category**: Visual
**Priority**: Medium

**Input:**
- Player damages enemy

**Expected Output:**
- Text showing damage amount appears above enemy
- Floats upward ~50px
- Fades over 800ms
- Kill: red, 24px; Normal: white, 16px

---

### TS-GFX-011: Blood Particles on Player Damage

**Category**: Visual
**Priority**: Medium

**Input:**
- Player takes damage from direction

**Expected Output:**
- 5 dark red circles spawn at player position
- Burst velocity away from damage source
- Fade and shrink over 500ms

---

### TS-GFX-012: Reload Bar Shows Progress

**Category**: Visual
**Priority**: High

**Input:**
- Entity starts reloading

**Expected Output:**
- Black bar (40x6) appears above entity at y-60
- White fill grows from 0 to full width as reload progresses
- Bar hidden when reload completes

---

### TS-GFX-013: Weapon Drop Bobs and Glows

**Category**: Visual
**Priority**: Medium

**Input:**
- Bot dies, weapon drop spawns

**Expected Output:**
- Weapon icon sprite at death position
- Y position oscillates +/-5px over 1000ms
- Yellow glow ring pulses around drop
- Auto-destroyed after 30 seconds

---

### TS-GFX-014: Pre-Generated Textures Created in Preload

**Category**: Unit
**Priority**: Critical

**Input:**
- Scene preload completes

**Expected Output:**
- `placeholder` texture exists (30x30)
- `bullet_pellet` texture exists (4x4)
- `bullet_tracer` texture exists (20x2)
- `reticle` texture exists (32x32)
- `hitmarker` texture exists (20x20)
- `hit_indicator` texture exists (16x16)
- All 5 `drop_*` textures exist

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-02-15 | Initial spec documenting pre-BMM archive snapshot |
| 1.0.1 | 2026-02-16 | Verified against source — all constants, colors, dimensions, line references match |
