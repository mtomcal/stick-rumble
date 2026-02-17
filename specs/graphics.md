# Graphics

> **Spec Version**: 2.0.0
> **Last Updated**: 2026-02-16
> **Depends On**: [constants.md](constants.md), [player.md](player.md), [weapons.md](weapons.md), [arena.md](arena.md)
> **Depended By**: [client-architecture.md](client-architecture.md), [test-index.md](test-index.md)

---

## Overview

The graphics system renders all visual elements in Stick Rumble using **procedural generation**. There are no sprite sheets or texture atlases—every visual is constructed from primitive shapes (circles, rectangles, lines, arcs) using Phaser's `GameObjects.Graphics` API.

**Why Procedural Graphics?**
- **Simplicity**: No asset pipeline, no file management, no loading states
- **Flexibility**: Weapon colors, player colors, and effects can be changed dynamically
- **Consistency**: Same rendering code on all browsers and devices
- **Small Bundle**: Zero image assets means faster initial load

All rendering uses Phaser 3.90.0's Canvas/WebGL rendering with a 60 FPS target.

---

## Dependencies

### Technology Dependencies

| Technology | Version | Purpose |
|------------|---------|---------|
| Phaser | 3.90.0 | Game engine with Graphics API |
| TypeScript | 5.9.3 | Type-safe implementation |

### Spec Dependencies

- [constants.md](constants.md) - Arena dimensions (1920×1080), player dimensions (32×64)
- [player.md](player.md) - Player state structure, health system
- [weapons.md](weapons.md) - Weapon configurations, melee ranges
- [arena.md](arena.md) - World bounds for rendering context

---

## Constants

All graphics constants are documented here for single-source-of-truth. These values are extracted from the implementation.

### Rendering Layer Depths

| Constant | Value | Description |
|----------|-------|-------------|
| FLOOR_GRID_DEPTH | -1 | Floor grid renders below all |
| PLAYER_DEPTH | 50 | Stick figures render at this depth |
| DEATH_CORPSE_DEPTH | 5 | Dead player corpses render below live players |
| EFFECT_DEPTH | 60 | Hit effects render above players |
| MELEE_ARC_DEPTH | 100 | Melee swing arcs render above effects |
| HIT_MARKER_DEPTH | 1000 | Hit markers render above game objects |
| HIT_INDICATOR_DEPTH | 1001 | Directional hit indicators render above markers |
| MINIMAP_BG_DEPTH | 1999 | Minimap background |
| MINIMAP_DYNAMIC_DEPTH | 2000 | Minimap dynamic elements |
| UI_DEPTH | 1000+ | UI elements render above all game objects |

### Animation Timings

| Constant | Value | Unit | Description |
|----------|-------|------|-------------|
| WALK_SPEED_FACTOR | 0.02 | multiplier | Walk cycle animation speed |
| TRACER_FADE_DURATION | 100 | ms | Bullet tracer fade time |
| MUZZLE_FLASH_DURATION | 50-100 | ms | Per-weapon muzzle flash time |
| MELEE_SWING_DURATION | 200 | ms | Melee arc animation time |
| HIT_EFFECT_FADE | 100 | ms | Hit particle fade time |
| WEAPON_CRATE_BOB | 1000 | ms | Crate bobbing cycle |

### Colors

| Constant | Hex Value | RGB | Description |
|----------|-----------|-----|-------------|
| LOCAL_PLAYER_COLOR | 0x00ff00 | Green | Local player stick figure |
| ENEMY_PLAYER_COLOR | 0xff0000 | Red | Other player stick figures |
| DEAD_PLAYER_COLOR | 0x888888 | Gray | Dead player overlay |
| BULLET_IMPACT_COLOR | 0xffff00 | Yellow | Bullet hit effect |
| MELEE_IMPACT_COLOR | 0xffffff | White | Melee hit effect |
| MUZZLE_FLASH_COLOR | 0xffa500 | Orange | Generic muzzle flash |
| HEALTH_BAR_FULL | 0x00ff00 | Green | Health bar at >60% |
| HEALTH_BAR_MEDIUM | 0xffff00 | Yellow | Health bar at 30-60% |
| HEALTH_BAR_LOW | 0xff0000 | Red | Health bar at <30% |
| WEAPON_CRATE_COLOR | 0x996633 | Brown | Weapon crate box |
| WEAPON_CRATE_GLOW | 0xffff00 | Yellow | Crate availability glow |

---

## Data Structures

### Vector2

**Description**: 2D vector for positions and directions.

**TypeScript:**
```typescript
interface Vector2 {
  x: number;  // X coordinate in pixels
  y: number;  // Y coordinate in pixels
}
```

### RenderedPlayer

**Description**: State needed to render a player stick figure.

**TypeScript:**
```typescript
interface RenderedPlayer {
  id: string;           // Player UUID
  position: Vector2;    // World position (center)
  aimAngle: number;     // Radians, 0 = right, π/2 = down
  isMoving: boolean;    // True if velocity > 0
  isDead: boolean;      // True if deathTime set
  isLocal: boolean;     // True if this client's player
  isRolling: boolean;   // True during dodge roll
  rollStartTime?: number;  // When roll started (for animation)
  health: number;       // 0-100
  weaponType: string;   // Current weapon name
  // Damage direction computed on-the-fly from attacker/victim positions in event handlers
}
```

---

## Behavior

### Player Rendering (Stick Figure)

**Why Stick Figures?**
Stick figures are fast to render procedurally, instantly recognizable, and create the distinctive visual style of the game. They require no sprites, scale perfectly, and animate smoothly.

The stick figure is composed of:
1. **Head**: Filled circle at center
2. **Arms**: Two lines from center to hands, with circular hands
3. **Legs**: Two lines from center to feet, with circular feet

**Stick Figure Geometry:**

```
                    ┌────────────────┐
                    │  HEAD (r=13)   │
                    │    @ (0,0)     │
                    └────────────────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
     LEFT ARM (2px)   BODY ORIGIN    RIGHT ARM (2px)
     (20, -3)          (0, 0)         (20, 3)
       ○ hand                          ○ hand
                           │
           ┌───────────────┼───────────────┐
           │               │               │
     LEFT LEG (3px)                  RIGHT LEG (3px)
     (animated)                      (animated)
       ○ foot                          ○ foot
```

**Pseudocode:**
```
function renderStickFigure(player, walkCycle):
    graphics.clear()
    cx, cy = 0, 0  // Local coordinates
    rot = player.aimAngle

    // Rotation helper
    calcPoint(localX, localY):
        return {
            x: cx + localX * cos(rot) - localY * sin(rot),
            y: cy + localX * sin(rot) + localY * cos(rot)
        }

    // LEGS (animated with walk cycle)
    stride = 16
    footSideOffset = 8
    leftLegProgress = sin(walkCycle)
    rightLegProgress = sin(walkCycle + PI)

    leftFootPos = calcPoint(leftLegProgress * stride, -footSideOffset)
    rightFootPos = calcPoint(rightLegProgress * stride, footSideOffset)

    graphics.lineStyle(3, playerColor)
    drawLine(cx, cy, leftFootPos)
    drawLine(cx, cy, rightFootPos)
    graphics.fillCircle(leftFootPos, 3)
    graphics.fillCircle(rightFootPos, 3)

    // ARMS
    leftHandPos = calcPoint(20, -3)
    rightHandPos = calcPoint(20, 3)

    graphics.lineStyle(2, playerColor)
    drawLine(cx, cy, leftHandPos)
    drawLine(cx, cy, rightHandPos)
    graphics.fillCircle(leftHandPos, 3)
    graphics.fillCircle(rightHandPos, 3)

    // HEAD
    graphics.fillStyle(playerColor)
    graphics.fillCircle(cx, cy, 13)
    graphics.lineStyle(1, 0x000000, 0.3)
    graphics.strokeCircle(cx, cy, 13)
```

**TypeScript:**
```typescript
private draw(): void {
  this.graphics.clear();
  const cx = 0, cy = 0;
  const rot = this.rotation;

  const calcPoint = (localX: number, localY: number) => ({
    x: cx + (localX * Math.cos(rot) - localY * Math.sin(rot)),
    y: cy + (localX * Math.sin(rot) + localY * Math.cos(rot)),
  });

  // Legs
  this.graphics.lineStyle(3, this.color, 1);
  const stride = 16;
  const footSideOffset = 8;
  const leftLegProgress = Math.sin(this.walkCycle);
  const rightLegProgress = Math.sin(this.walkCycle + Math.PI);

  const leftFootPos = calcPoint(leftLegProgress * stride, -footSideOffset);
  const rightFootPos = calcPoint(rightLegProgress * stride, footSideOffset);

  this.graphics.beginPath();
  this.graphics.moveTo(cx, cy);
  this.graphics.lineTo(leftFootPos.x, leftFootPos.y);
  this.graphics.strokePath();

  this.graphics.beginPath();
  this.graphics.moveTo(cx, cy);
  this.graphics.lineTo(rightFootPos.x, rightFootPos.y);
  this.graphics.strokePath();

  this.graphics.fillStyle(this.color, 1);
  this.graphics.fillCircle(leftFootPos.x, leftFootPos.y, 3);
  this.graphics.fillCircle(rightFootPos.x, rightFootPos.y, 3);

  // Arms
  this.graphics.lineStyle(2, this.color, 1);
  const leftHandPos = calcPoint(20, -3);
  const rightHandPos = calcPoint(20, 3);

  this.graphics.beginPath();
  this.graphics.moveTo(cx, cy);
  this.graphics.lineTo(leftHandPos.x, leftHandPos.y);
  this.graphics.strokePath();

  this.graphics.beginPath();
  this.graphics.moveTo(cx, cy);
  this.graphics.lineTo(rightHandPos.x, rightHandPos.y);
  this.graphics.strokePath();

  this.graphics.fillCircle(leftHandPos.x, leftHandPos.y, 3);
  this.graphics.fillCircle(rightHandPos.x, rightHandPos.y, 3);

  // Head
  this.graphics.fillStyle(this.color, 1);
  this.graphics.fillCircle(cx, cy, 13);
  this.graphics.lineStyle(1, 0x000000, 0.3);
  this.graphics.strokeCircle(cx, cy, 13);
}
```

### Walk Animation

**Why Sine Wave Animation?**
Sine waves produce natural, smooth oscillation that mimics biological motion. The opposite-phase legs create realistic walking movement.

**Animation Formula:**
```
walkCycle += delta * WALK_SPEED_FACTOR  // WALK_SPEED_FACTOR = 0.02

leftLegAngle = sin(walkCycle) * stride
rightLegAngle = sin(walkCycle + PI) * stride

// When not moving, reset to neutral:
if !isMoving:
    walkCycle = 0
```

**TypeScript:**
```typescript
update(delta: number, isMoving: boolean): void {
  if (isMoving) {
    this.walkCycle += delta * ProceduralPlayerGraphics.WALK_SPEED_FACTOR;
  } else {
    this.walkCycle = 0;
  }
  this.draw();
}
```

### Player Colors

**Why These Colors?**
- Green for local player: Universal "friendly" color, high visibility
- Red for enemies: Universal "danger" color, immediate recognition
- Gray for dead: Indicates inactive state without removing visibility

| State | Color | Hex |
|-------|-------|-----|
| Local player (alive) | Green | 0x00ff00 |
| Enemy player (alive) | Red | 0xff0000 |
| Dead player | Gray | 0x888888 |

**TypeScript:**
```typescript
private getPlayerColor(playerId: string, isDead: boolean): number {
  if (isDead) {
    return 0x888888; // Gray for dead
  }
  return playerId === this.localPlayerId ? 0x00ff00 : 0xff0000;
}
```

### Weapon Rendering

**Why Rectangles?**
Weapons are built from simple rectangles in containers. This approach:
- Allows easy weapon switching without sprite management
- Enables rotation with player aim angle
- Provides clear silhouettes even at small sizes

Each weapon is constructed from colored rectangles with specific positions and sizes:

#### Pistol

```
Handle: Rectangle(5, 2, 8x10, 0x222222)
Body:   Rectangle(12, 0, 12x6, 0x333333)
Barrel: Rectangle(20, 0, 10x4, 0x111111)
```

#### Bat (Aluminum)

```
Grip:   Rectangle(10, 0, 15x4, 0x000000)
Body:   Rectangle(30, 0, 35x6, 0xcccccc)
EndCap: Rectangle(48, 0, 5x7, 0xcccccc)
```

#### Katana

```
Handle: Rectangle(5, 0, 15x4, 0x212121)
Guard:  Rectangle(15, 0, 4x12, 0xd4af37)  // Gold
Blade:  Rectangle(40, 0, 50x3, 0xffffff)  // White
```

#### Uzi

```
Body:     Rectangle(20, 0, 20x10, 0x333333)
Handle:   Rectangle(15, 5, 8x8, 0x222222)
Barrel:   Rectangle(32, -2, 8x4, 0x111111)
Magazine: Rectangle(22, 8, 6x10, 0x111111)
```

#### AK47

```
Stock:     Rectangle(0, 0, 15x6, 0x8d6e63)   // Wood
Receiver:  Rectangle(20, 0, 25x6, 0x222222)  // Metal
Barrel:    Rectangle(40, 0, 20x3, 0x111111)
Handguard: Rectangle(35, 0, 12x5, 0x8d6e63) // Wood
Magazine:  Rectangle(25, 5, 6x12, 0x111111) @ -0.3rad rotation
```

#### Shotgun

```
Stock:  Rectangle(0, 0, 12x6, 0x5d4037)   // Dark wood
Body:   Rectangle(18, 0, 20x6, 0x333333)
Barrel: Rectangle(38, -1, 18x4, 0x111111)
Pump:   Rectangle(32, 3, 8x5, 0x5d4037)
```

**TypeScript:**
```typescript
private buildPistol(): void {
  const handle = this.scene.add.rectangle(5, 2, 8, 10, 0x222222);
  const body = this.scene.add.rectangle(12, 0, 12, 6, 0x333333);
  const barrel = this.scene.add.rectangle(20, 0, 10, 4, 0x111111);
  this.container.add([handle, body, barrel]);
}
```

**Weapon Positioning:**
- Offset from player: 10 pixels in aim direction
- Rotation: Matches aimAngle in radians
- Vertical flip: When aiming left (90°-270°), scaleY = -1

### Projectile Rendering

**Why Circle + Tracer?**
Projectiles need to be visible at high speeds. The tracer line shows motion direction and makes fast projectiles easier to track.

**Projectile Circle:**
- Shape: Filled circle
- Diameter: 4 pixels (from constants)
- Color: Weapon-specific

**Tracer Line:**
- Shape: Line from current to previous position
- Width: 2 pixels
- Color: Weapon-specific
- Fade: Alpha 1.0 → 0 over 100ms

**Weapon Projectile Colors:**

| Weapon | Projectile Color | Hex |
|--------|-----------------|-----|
| Pistol | Yellow | 0xffdd00 |
| Uzi | Orange | 0xffaa00 |
| AK47 | Gold | 0xffcc00 |
| Shotgun | Orange-Red | 0xff8800 |

**Pseudocode:**
```
function renderProjectile(projectile, weapon):
    // Draw tracer line
    graphics.lineStyle(2, weapon.tracerColor)
    prevX = projectile.x - projectile.vx * 0.05
    prevY = projectile.y - projectile.vy * 0.05
    drawLine(prevX, prevY, projectile.x, projectile.y)

    // Draw projectile circle
    graphics.fillStyle(weapon.projectileColor)
    graphics.fillCircle(projectile.x, projectile.y, 2)  // radius = diameter/2
```

### Muzzle Flash

**Why Muzzle Flash?**
Provides instant visual feedback that a weapon fired, even before the projectile is visible. Creates satisfying weapon feel.

**Configuration per Weapon:**

| Weapon | Color | Size (px) | Duration (ms) |
|--------|-------|-----------|---------------|
| Pistol | 0xffdd00 | 8 | 50 |
| Uzi | 0xffaa00 | 8 | 50 |
| AK47 | 0xffcc00 | 12 | 80 |
| Shotgun | 0xff8800 | 16 | 100 |

**Animation:**
- Alpha: 1.0 → 0 (fade out)
- Scale: 1.0 → 1.5 (expand)
- Easing: Linear

### Health Bar (World-Space)

**Why Above Player Head?**
Players need to see enemy health at a glance during combat without looking away from the action.

**Dimensions:**
- Width: 32 pixels (matches player width)
- Height: 4 pixels
- Position: 8 pixels above player head (y - PLAYER.HEIGHT/2 - 8)
- Centered horizontally on player

**Colors:**
- Background: 0x888888 (gray)
- Health fill: 0x00ff00 (green)
- Fill width: (health / 100) * 32px

**TypeScript:**
```typescript
render(x: number, y: number, health: number): void {
  const barX = x - 16;  // Center horizontally
  const barY = y - 32 - 8;  // Above head

  // Background
  this.graphics.fillStyle(0x888888, 1);
  this.graphics.fillRect(barX, barY, 32, 4);

  // Health fill
  const healthWidth = (health / 100) * 32;
  this.graphics.fillStyle(0x00ff00, 1);
  this.graphics.fillRect(barX, barY, healthWidth, 4);
}
```

### Health Bar UI (HUD)

**Why Larger HUD Bar?**
The world-space bar is too small for precise health reading. The HUD bar provides exact numbers and color-coding for critical health states.

**Position:** Top-left corner (20, 20)

**Dimensions:**
- Bar width: 200px
- Bar height: 30px
- Background: 40px wider with 2px padding

**Dynamic Colors:**
- >60% health: 0x00ff00 (green)
- 30-60% health: 0xffff00 (yellow)
- <30% health: 0xff0000 (red)

**Components:**
1. Black background rectangle (0x000000, 0.7 alpha)
2. Colored health bar (scales with health)
3. White text: "100/100" format

**Regeneration Effect:**
- Pulsing animation when regenerating
- Alpha oscillates 0.6 → 1.0
- Duration: 500ms per cycle
- Ease: Sine.easeInOut

### Aim Indicator

**Why Aim Lines?**
Shows where each player is aiming, essential for predicting enemy shots and tracking local aim direction.

**Visual:**
- Shape: Line from player center
- Length: 50 pixels in aim direction
- Color: Green (0x00ff00) for local, Yellow (0xffff00) for enemies

**Formula:**
```
endX = playerX + cos(aimAngle) * 50
endY = playerY + sin(aimAngle) * 50
```

### Crosshair / Reticle

The crosshair is a **pre-generated texture** (not procedural per-frame). It consists of a ring with cardinal tick marks and a red center dot. There is NO dynamic spread circle.

**Texture Generation** (32×32, generated once in `preload()`):

```typescript
// TextureGenerator.ts — reticle texture
const gfx = scene.make.graphics({ x: 0, y: 0 }, false);
gfx.lineStyle(2, 0xffffff, 1);
gfx.strokeCircle(16, 16, 10);           // Outer ring (radius 10)

gfx.beginPath();
gfx.moveTo(16, 2); gfx.lineTo(16, 8);   // Top tick
gfx.moveTo(16, 24); gfx.lineTo(16, 30); // Bottom tick
gfx.moveTo(2, 16); gfx.lineTo(8, 16);   // Left tick
gfx.moveTo(24, 16); gfx.lineTo(30, 16); // Right tick
gfx.strokePath();

gfx.fillStyle(0xff0000, 1);
gfx.fillCircle(16, 16, 2);              // Red center dot
gfx.generateTexture('reticle', 32, 32);
```

**Placement**: Sprite at cursor/aim position, depth 100, alpha 0.8.

**Constants**: See [constants.md § Crosshair / Reticle Constants](constants.md#crosshair--reticle-constants).

### Weapon Crate Rendering

**Why Bobbing Animation?**
Draws attention to pickups, makes them feel valuable and interactive.

**Crate Box:**
- Shape: Rectangle (48×48 pixels)
- Color: 0x996633 (brown)
- Origin: Center

**Glow Effect:**
- Shape: Circle outline
- Radius: 32px
- Color: 0xffff00 (yellow)
- Stroke: 2px, 0.5 alpha
- Visible only when available

**Bobbing Animation:**
- Distance: 5px up/down
- Duration: 1000ms cycle
- Ease: Sine.easeInOut
- Type: Yoyo (repeat forever)

**Availability States:**
- Available: Alpha 1.0, glow visible
- Unavailable: Alpha 0.3, glow hidden

### Melee Swing Arc

The melee swing uses a **white stroke-only arc** (no pie-slice fill, no per-weapon colors) combined with a **weapon container rotation tween**.

**Arc Rendering**:
```typescript
// Stroke-only arc — no fill, white color, all weapons
const slash = this.add.graphics();
slash.lineStyle(2, 0xffffff, 0.8);
slash.beginPath();
slash.arc(attacker.x, attacker.y, range, angle - 0.7, angle + 0.7, false);
slash.strokePath();
this.tweens.add({ targets: slash, alpha: 0, duration: 200, onComplete: () => slash.destroy() });
```

**Weapon Container Swing Tween**:
```typescript
// 100ms yoyo rotation: -45° to +60°
this.scene.tweens.add({
    targets: this.weaponContainer,
    angle: { from: this.weaponContainer.angle - 45, to: this.weaponContainer.angle + 60 },
    duration: 100,
    yoyo: true,
    onComplete: () => {
        this.isAttacking = false;
        this.weaponContainer.setAngle(0);
    }
});
```

| Property | Value | Source |
|----------|-------|--------|
| Arc Color | 0xFFFFFF (white) | All weapons use white |
| Arc Stroke | 2px | Thin, visible |
| Arc Alpha | 0.8 | Slightly transparent |
| Arc Angle | ±0.7 rad (~80°) | `constants.md` |
| Arc Fade | 200ms | Quick dissolve |
| Swing From | -45° | Wind-up behind player |
| Swing To | +60° | Forward swing |
| Swing Duration | 100ms | Fast yoyo tween |

**Constants**: See [constants.md § Melee Visual Constants](constants.md#melee-visual-constants).

### Hit Effects

**Why Object Pooling?**
During 8-player combat, many hit effects spawn simultaneously. Pre-creating a pool of reusable graphics objects prevents garbage collection stalls.

**Pool Size:** 20 effects (handles 8-player combat)

**Bullet Impact:**
- Shape: 4×4 filled rectangle
- Color: 0xffff00 (yellow)
- Fade: 100ms

**Melee Impact:**
- Shape: X pattern (2 crossing lines) + center circle
- Lines: 2px width, white (0xffffff)
- Line positions: (-6,-6) to (6,6) and (6,-6) to (-6,6)
- Center: 2px radius circle
- Fade: 100ms

**Muzzle Flash Effect:**
- Shape: Elongated diamond pointing right
- Vertices: (0,0) → (8,-3) → (12,0) → (8,3)
- Color: 0xffa500 (orange)
- Rotated to match weapon direction
- Scale: 1.0 → 1.5 during fade
- Fade: 100ms

**TypeScript:**
```typescript
private drawBulletImpact(graphics: Phaser.GameObjects.Graphics): void {
  graphics.clear();
  graphics.fillStyle(0xffff00, 1);
  graphics.fillRect(-2, -2, 4, 4);
}

private drawMeleeHit(graphics: Phaser.GameObjects.Graphics): void {
  graphics.clear();
  graphics.lineStyle(2, 0xffffff, 1);

  graphics.beginPath();
  graphics.moveTo(-6, -6);
  graphics.lineTo(6, 6);
  graphics.strokePath();

  graphics.beginPath();
  graphics.moveTo(6, -6);
  graphics.lineTo(-6, 6);
  graphics.strokePath();

  graphics.fillStyle(0xffffff, 1);
  graphics.fillCircle(0, 0, 2);
}
```

### Dodge Roll Visual

**Why 360° Rotation + Flicker?**
- Rotation: Clear visual that player is rolling, makes action feel dynamic
- Flicker: Indicates i-frames, teaches players when they're protected

**Roll Animation:**
- Rotation: 360° over 400ms (full roll duration)
- Formula: `rollAngle = ((now - rollStartTime) / 400) * 2 * PI`

**Invincibility Flicker (First 200ms):**
- Visibility toggles on/off
- Period: 100ms (flicker every 100ms)
- Formula: `isVisible = ((now - rollStartTime) % 200) < 100`

**TypeScript:**
```typescript
// During roll
if (isRolling) {
  const rollElapsed = clock.now() - rollStartTime;
  const rollAngle = (rollElapsed / 400) * Math.PI * 2;
  graphics.setRotation(rollAngle);

  // I-frame flicker (first 200ms)
  if (rollElapsed < 200) {
    const isVisible = (rollElapsed % 200) < 100;
    graphics.setVisible(isVisible);
  } else {
    graphics.setVisible(true);
  }
}
```

### Dodge Roll Cooldown UI

**Why Circular Progress?**
Fits the dodge roll theme (circular motion), provides intuitive "filling up" feedback.

**Position:** Fixed to screen (scrollFactor = 0)

**Ready State:**
- Shape: Filled circle
- Color: 0x00ff00 (green)
- Radius: 20 pixels
- Alpha: 0.8

**Cooldown State:**
- Background circle: 0x666666 (gray), 0.5 alpha, 20px radius
- Progress arc: 0x00ff00 (green), 0.6 alpha
- Arc: Clockwise from top (-π/2) based on progress
- Formula: `endAngle = -PI/2 + (progress * 2 * PI)`

### Death Corpse Rendering

When a player dies, the live stick figure is destroyed and replaced with a static **splayed corpse** graphic. The corpse has 4 limbs extending outward and an offset head circle.

**Implementation**:
```typescript
// On death — create corpse graphic
const deadGfx = scene.add.graphics();
deadGfx.lineStyle(3, 0x444444, 1);
const x = this.x;
const y = this.y;
const rot = this.rotation;

// 4 splayed limbs at ±0.5 and ±2.5 radians from rotation
deadGfx.moveTo(x, y);
deadGfx.lineTo(x + Math.cos(rot + 0.5) * 20, y + Math.sin(rot + 0.5) * 20);
deadGfx.moveTo(x, y);
deadGfx.lineTo(x + Math.cos(rot - 0.5) * 20, y + Math.sin(rot - 0.5) * 20);
deadGfx.moveTo(x, y);
deadGfx.lineTo(x + Math.cos(rot + 2.5) * 20, y + Math.sin(rot + 2.5) * 20);
deadGfx.moveTo(x, y);
deadGfx.lineTo(x + Math.cos(rot - 2.5) * 20, y + Math.sin(rot - 2.5) * 20);
deadGfx.strokePath();

// Head offset along rotation axis
deadGfx.fillStyle(0x444444);
deadGfx.fillCircle(x + Math.cos(rot) * 25, y + Math.sin(rot) * 25, 10);

// Fade out after 5 seconds
scene.tweens.add({
    targets: deadGfx,
    alpha: 0,
    duration: 2000,
    delay: 5000,
    onComplete: () => deadGfx.destroy()
});
```

| Property | Value | Source |
|----------|-------|--------|
| Color | 0x444444 (dark gray) | `constants.md § Death Corpse Constants` |
| Limb Width | 3px stroke | — |
| Limb Length | 20px | — |
| Limb Angles | ±0.5, ±2.5 rad from rotation | 4 splayed limbs |
| Head Radius | 10px | Smaller than live (13px) |
| Head Offset | 25px along rotation | — |
| Visible Duration | 5000ms | — |
| Fade Duration | 2000ms | After visible period |
| Depth | 5 | Below live players |

**Constants**: See [constants.md § Death Corpse Constants](constants.md#death-corpse-constants).

### Blood Particles

When a player takes damage, 5 blood particles burst from the impact point, spraying away from the damage source.

**Implementation** (tween-based, no physics bodies):
```typescript
// On damage received
for (let i = 0; i < 5; i++) {
    const circle = this.add.circle(player.x, player.y, Phaser.Math.Between(2, 5), 0xcc0000);
    const angle = Phaser.Math.Angle.Between(sourceX, sourceY, player.x, player.y) + (Math.random() - 0.5);
    const speed = Phaser.Math.Between(50, 150);
    const duration = 500;

    // Pre-calculate end position (approximates drag deceleration)
    const effectiveDistance = speed * (duration / 1000) * 0.5;
    const endX = player.x + Math.cos(angle) * effectiveDistance;
    const endY = player.y + Math.sin(angle) * effectiveDistance;

    this.tweens.add({
        targets: circle,
        x: endX,
        y: endY,
        alpha: 0,
        scale: 0,
        duration,
        onComplete: () => circle.destroy(),
    });
}
```

| Property | Value | Source |
|----------|-------|--------|
| Count | 5 per hit | `constants.md § Blood Particle Constants` |
| Color | 0xCC0000 (dark red) | — |
| Radius | 2-5px random | — |
| Speed | 50-150 px/s random | Used to compute effective distance |
| Direction | Away from damage source ±0.5 rad | — |
| Effective Distance | `speed × (duration/1000) × 0.5` | Approximates drag deceleration |
| Duration | 500ms fade + shrink | — |

**Constants**: See [constants.md § Blood Particle Constants](constants.md#blood-particle-constants).

### Healing Particles

During health regeneration, small green particles occasionally float upward from the player, providing subtle visual feedback that healing is active.

**Implementation**:
```typescript
// During health regen tick (15% chance per tick)
if (Math.random() > 0.85) {
    const part = this.add.circle(
        player.x + (Math.random() - 0.5) * 25,
        player.y + (Math.random() - 0.5) * 25,
        2, 0x00ff00
    );
    this.tweens.add({
        targets: part, y: part.y - 20, alpha: 0, duration: 600,
        onComplete: () => part.destroy()
    });
}
```

| Property | Value | Source |
|----------|-------|--------|
| Color | 0x00FF00 (green) | `constants.md § Healing Particle Constants` |
| Radius | 2px | — |
| Spawn Chance | 15% per regen tick | — |
| Spread | ±25px from center | Random offset |
| Float Distance | 20px upward | — |
| Duration | 600ms | Fade + float |

**Constants**: See [constants.md § Healing Particle Constants](constants.md#healing-particle-constants).

### Wall Spark

When a bullet's barrel position extends outside the arena boundaries, a spark effect appears instead of firing the bullet.

> **Note:** Currently the arena has no internal walls -- obstruction detection checks arena bounds only. "Wall" in this context means the arena boundary edges (0, 0, 1920, 1080). Internal wall geometry support is a future enhancement.

**Implementation**:
```typescript
// When bullet spawn point is outside the arena boundaries
const spark = this.add.circle(startPos.x, startPos.y, 3, 0xffff00);
this.tweens.add({
    targets: spark, alpha: 0, scale: 2, duration: 100,
    onComplete: () => spark.destroy()
});
```

| Property | Value |
|----------|-------|
| Color | 0xFFFF00 (yellow) |
| Radius | 3px |
| Scale Tween | 1.0 → 2.0 |
| Duration | 100ms |

### Gun Recoil

When a ranged weapon fires, the weapon container kicks backward along the aim axis, then snaps back. This provides visceral feedback for each shot.

**Implementation**:
```typescript
// On ranged weapon fire
this.recoilOffset = 0;
let recoilDist = -6;  // Default kickback
if (this.weaponType === WeaponType.SHOTGUN) recoilDist = -10;  // Heavier kick

this.scene.tweens.add({
    targets: this,
    recoilOffset: recoilDist,
    duration: 50,
    yoyo: true
});

// Applied during weapon container positioning:
const recoilX = Math.cos(this.rotation) * this.recoilOffset;
const recoilY = Math.sin(this.rotation) * this.recoilOffset;
this.weaponContainer.setPosition(this.x + recoilX, this.y + recoilY);
```

| Property | Value | Source |
|----------|-------|--------|
| Default Recoil | -6px | `constants.md § Gun Recoil Constants` |
| Shotgun Recoil | -10px | — |
| Duration | 50ms yoyo | — |
| Direction | Backward along aim axis | Opposite of rotation |

**Constants**: See [constants.md § Gun Recoil Constants](constants.md#gun-recoil-constants).

### Aim Sway

The weapon container visually oscillates based on player movement state. This is NOT just visual — it affects actual projectile trajectory. See [shooting.md § Aim Sway](shooting.md#aim-sway) for gameplay impact.

**Visual Application**:
```typescript
// In updateAttachments() — weapon follows aim + sway
this.weaponContainer.setRotation(this.rotation + this.aimSway);
```

| State | Speed | Magnitude | Visual Effect |
|-------|-------|-----------|---------------|
| Moving (>10 px/s) | 0.008 rad/ms | ±0.15 rad (~8.6°) | Noticeable wobble |
| Idle (≤10 px/s) | 0.002 rad/ms | ±0.03 rad (~1.7°) | Subtle breathing |

**Constants**: See [constants.md § Aim Sway Constants](constants.md#aim-sway-constants).

### Reload Animation

During weapon reload, the weapon container pulses (fades and shrinks) to indicate the reload state.

**Implementation**:
```typescript
this.scene.tweens.add({
    targets: this.weaponContainer,
    alpha: 0.5,
    scaleX: 0.8,
    scaleY: 0.8,
    duration: 200,
    yoyo: true,
    repeat: 2,  // 3 total pulses (initial + 2 repeats)
    onComplete: () => {
        this.weaponContainer.setAlpha(1);
        this.weaponContainer.setScale(1);
    }
});
```

| Property | Value | Source |
|----------|-------|--------|
| Alpha | 1.0 → 0.5 → 1.0 | `constants.md § Reload Animation Constants` |
| Scale | 1.0 → 0.8 → 1.0 | — |
| Pulse Duration | 200ms each | — |
| Pulse Count | 3 total | yoyo with repeat: 2 |

**Constants**: See [constants.md § Reload Animation Constants](constants.md#reload-animation-constants).

### Directional Hit Indicators

Chevron-shaped indicators appear around the player pointing toward the source of damage (both incoming and outgoing).

**Texture** (16×16 chevron, pre-generated):
```typescript
const gfx = scene.make.graphics({ x: 0, y: 0 }, false);
gfx.fillStyle(0xffffff, 1);
gfx.beginPath();
gfx.moveTo(0, 0);
gfx.lineTo(16, 8);
gfx.lineTo(0, 16);
gfx.lineTo(4, 8);
gfx.closePath();
gfx.fillPath();
gfx.generateTexture('hit_indicator', 16, 16);
```

**Outgoing Hit Indicator** (dealing damage):
```typescript
const angle = Phaser.Math.Angle.Between(player.x, player.y, target.x, target.y);
const ix = player.x + Math.cos(angle) * 60;
const iy = player.y + Math.sin(angle) * 60;
const indicator = this.add.sprite(ix, iy, 'hit_indicator').setDepth(1001);
indicator.setRotation(angle);
indicator.setTint(kill ? 0xff0000 : 0xffffff);
this.tweens.add({ targets: indicator, alpha: 0, scale: 1.5, duration: 200, onComplete: () => indicator.destroy() });
```

**Incoming Hit Indicator** (taking damage):
```typescript
// Same positioning but longer duration (400ms) and always red
indicator.setTint(0xff0000);
this.tweens.add({ targets: indicator, alpha: 0, scale: 1.5, duration: 400, onComplete: () => indicator.destroy() });
```

| Property | Outgoing | Incoming | Source |
|----------|----------|----------|--------|
| Distance | 60px from center | 60px from center | `constants.md` |
| Color | White (normal) / Red (kill) | Always red | — |
| Duration | 200ms | 400ms | — |
| Depth | 1001 | 1001 | — |

**Constants**: See [constants.md § Hit Indicator Constants](constants.md#hit-indicator-constants).

---

## Error Handling

### Graphics Object Destroyed

**Trigger**: Attempt to draw on destroyed graphics object
**Detection**: Check `graphics.active` before drawing
**Response**: Skip draw operation, log warning
**Recovery**: Graphics will be recreated on next spawn

### Pool Exhaustion

**Trigger**: All 20 hit effect objects in use
**Detection**: No objects have `inUse = false`
**Response**: Reuse oldest in-use effect
**Client Notification**: None (graceful degradation)
**Recovery**: Automatic - oldest effect recycled

---

## Implementation Notes

### TypeScript (Client)

**File Organization:**
- `ProceduralPlayerGraphics.ts`: Stick figure rendering
- `ProceduralWeaponGraphics.ts`: Weapon rectangle construction
- `HitEffectManager.ts`: Object-pooled hit effects
- `MeleeWeapon.ts`: Melee swing arc animation
- `HealthBar.ts`: World-space health bar
- `HealthBarUI.ts`: HUD health bar
- `Crosshair.ts`: Dynamic crosshair with spread
- `DodgeRollCooldownUI.ts`: Cooldown progress indicator

**Performance Patterns:**
- Use `graphics.clear()` before each redraw
- Avoid creating new graphics objects during gameplay
- Pre-create object pools during scene initialization
- Use Phaser tweens for animations (hardware accelerated)

**Depth Layering (Low to High):**
1. Background/Arena: 0
2. Weapon Crates: 40
3. Players: 50
4. Hit Effects: 60
5. Melee Arcs: 100
6. UI Elements: 1000+

### Go (Server)

The server does not perform any rendering. All graphics are client-side only. The server provides:
- Player positions for rendering
- Hit events for triggering effects
- Weapon state for displaying correct weapon

---

## Test Scenarios

### TS-GFX-001: Player Renders All Body Parts

**Category**: Visual
**Priority**: Critical

**Preconditions:**
- GameScene is active
- Player exists in room

**Input:**
- Player with position (100, 100), aimAngle 0

**Expected Output:**
- Head circle visible at center
- Two arms with hands visible
- Two legs with feet visible
- All parts in player color

**Pseudocode:**
```
test "player renders all body parts":
    setup: create player graphics at (100, 100)
    action: render player with aimAngle = 0
    assert: graphics contains head circle (radius 13)
    assert: graphics contains 2 arm lines + 2 hand circles
    assert: graphics contains 2 leg lines + 2 foot circles
```

---

### TS-GFX-002: Walk Animation Oscillates Legs

**Category**: Visual
**Priority**: High

**Preconditions:**
- Player is moving (isMoving = true)

**Input:**
- Update called with delta = 16ms multiple times

**Expected Output:**
- walkCycle increases each frame
- Left leg position uses sin(walkCycle)
- Right leg position uses sin(walkCycle + PI)
- Legs move in opposite phase

---

### TS-GFX-003: Player Color Matches State

**Category**: Unit
**Priority**: High

**Preconditions:**
- Player exists

**Input:**
- Local player ID and target player ID

**Expected Output:**
- Local player: 0x00ff00 (green)
- Enemy player: 0xff0000 (red)
- Dead player: 0x888888 (gray)

---

### TS-GFX-004: Health Bar Width Reflects Percentage

**Category**: Unit
**Priority**: High

**Input:**
- Health = 75

**Expected Output:**
- Health bar fill width = 75% of total width
- Formula: (75 / 100) * 32 = 24 pixels

---

### TS-GFX-005: Aim Indicator Points at Mouse

**Category**: Visual
**Priority**: Medium

**Input:**
- Player at (100, 100)
- aimAngle = PI/4 (45 degrees)

**Expected Output:**
- Line ends at (100 + cos(PI/4) * 50, 100 + sin(PI/4) * 50)
- Approximately (135, 135)

---

### TS-GFX-006: Projectile Has Tracer Trail

**Category**: Visual
**Priority**: High

**Preconditions:**
- Projectile spawned

**Input:**
- Projectile at position (200, 100) moving right

**Expected Output:**
- Circle rendered at (200, 100)
- Line from (190, 100) to (200, 100)
- Tracer fades over 100ms

---

### TS-GFX-007: Muzzle Flash Appears on Shoot

**Category**: Visual
**Priority**: Medium

**Preconditions:**
- Player shoots weapon

**Input:**
- Shoot event at player position

**Expected Output:**
- Circle appears at weapon barrel
- Color matches weapon config
- Fades over weapon-specific duration

---

### TS-GFX-008: Weapon Crate Renders With Glow

**Category**: Visual
**Priority**: Medium

**Preconditions:**
- Weapon crate is available

**Input:**
- Crate at position (500, 500)

**Expected Output:**
- Brown rectangle (48x48)
- Yellow glow circle (radius 32)
- Bobbing animation active

---

### TS-GFX-009: Unavailable Crate Is Faded

**Category**: Visual
**Priority**: Medium

**Input:**
- Crate with available = false

**Expected Output:**
- Alpha = 0.3
- Glow not visible

---

### TS-GFX-010: Hit Particles Spawn on Damage

**Category**: Visual
**Priority**: High

**Preconditions:**
- Player takes damage

**Input:**
- player:damaged event at (300, 300)

**Expected Output:**
- Yellow rectangle effect at (300, 300)
- Fades over 100ms

---

### TS-GFX-011: Death corpse renders with splayed limbs

**Category**: Visual
**Priority**: High

**Preconditions:**
- Player dies

**Expected Output:**
- 4 limbs drawn at ±0.5 and ±2.5 rad from rotation
- Head circle at 25px offset along rotation axis
- Color is 0x444444 (dark gray)
- Visible for 5000ms, then fades over 2000ms

---

### TS-GFX-012: Dodge Roll Shows Rotation

**Category**: Visual
**Priority**: High

**Input:**
- Player rolling, rollStartTime = 200ms ago

**Expected Output:**
- Player rotation = (200 / 400) * 2 * PI = PI radians (180°)
- Visible (past i-frame flicker window)

---

### TS-GFX-013: Melee arc renders as white stroke-only

**Category**: Visual
**Priority**: High

**Preconditions:**
- Player performs melee attack

**Expected Output:**
- Arc is stroke-only (no fill), white color (0xFFFFFF)
- Arc spans ±0.7 rad from aim direction
- Weapon container rotates from -45° to +60° over 100ms (yoyo)
- Arc fades in 200ms

---

### TS-GFX-014: Object Pool Reuses Effects

**Category**: Unit
**Priority**: High

**Input:**
- Create 25 hit effects (exceeds pool size of 20)

**Expected Output:**
- No new graphics objects created after initial 20
- First effects recycled for later calls

---

### TS-GFX-015: Blood particles spawn on damage

**Category**: Visual
**Priority**: High

**Preconditions:**
- Player takes damage from a source

**Expected Output:**
- 5 particles spawn at player position
- Particles are dark red (0xCC0000), radius 2-5px
- Particles spray away from damage source at 50-150 px/s
- Particles fade and shrink over 500ms

---

### TS-GFX-016: Healing particles appear during regen

**Category**: Visual
**Priority**: Medium

**Preconditions:**
- Player is regenerating health

**Expected Output:**
- Green particles (0x00FF00) occasionally appear (~15% chance per tick)
- Particles float upward 20px and fade over 600ms

---

### TS-GFX-017: Wall spark on obstructed barrel

**Category**: Visual
**Priority**: Medium

**Preconditions:**
- Player fires with barrel position extending outside the arena boundaries

> **Note:** "Wall" here means arena boundary edges. No internal wall geometry exists yet.

**Expected Output:**
- Yellow spark (0xFFFF00) appears at barrel position
- Spark scales up 2× and fades over 100ms
- No bullet is created

---

### TS-GFX-018: Gun recoil on ranged fire

**Category**: Visual
**Priority**: High

**Preconditions:**
- Player fires a ranged weapon

**Expected Output:**
- Weapon container kicks backward: -6px default, -10px shotgun
- 50ms yoyo tween returns to original position

---

### TS-GFX-019: Aim sway visual oscillation

**Category**: Visual
**Priority**: High

**Preconditions:**
- Player is moving (speed > 10 px/s)

**Expected Output:**
- Weapon container rotation includes sway offset
- Sway magnitude ~0.15 rad while moving
- Sway magnitude ~0.03 rad while idle

---

### TS-GFX-020: Reload animation pulses

**Category**: Visual
**Priority**: Medium

**Preconditions:**
- Player initiates reload

**Expected Output:**
- Weapon container pulses 3 times (alpha 1→0.5→1, scale 1→0.8→1)
- Each pulse takes 200ms
- Container resets to alpha 1, scale 1 on completion

---

### TS-GFX-021: Directional hit indicator (outgoing)

**Category**: Visual
**Priority**: High

**Preconditions:**
- Player deals damage to a target

**Expected Output:**
- Chevron indicator appears 60px from player toward target
- White tint for normal hit, red for kill
- Fades over 200ms

---

### TS-GFX-022: Directional hit indicator (incoming)

**Category**: Visual
**Priority**: High

**Preconditions:**
- Player receives damage from a source

**Expected Output:**
- Red chevron indicator appears 60px from player toward source
- Fades over 400ms (longer than outgoing)

---

### TS-GFX-023: Crosshair reticle texture

**Category**: Visual
**Priority**: Medium

**Preconditions:**
- Game scene loaded

**Expected Output:**
- Reticle sprite at cursor position, depth 100, alpha 0.8
- Contains ring (radius 10), 4 cardinal ticks, red center dot
- No dynamic spread circle

---

### TS-GFX-024: Death corpse fade timing

**Category**: Visual
**Priority**: Medium

**Preconditions:**
- Player death corpse rendered

**Expected Output:**
- Corpse remains fully visible (alpha 1) for 5000ms
- Begins fade to alpha 0 over 2000ms after delay
- Graphics object destroyed after fade completes

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 2.0.0 | 2026-02-16 | Major overhaul: Ported all pre-BMM visual systems. Replaced crosshair with pre-generated reticle texture. Replaced melee arc with white stroke-only + container tween. Replaced dead player with splayed corpse. Added blood particles, healing particles, wall spark, gun recoil, aim sway, reload animation, directional hit indicators. Updated depth table. Added tests TS-GFX-015 through TS-GFX-024. |
| 1.0.0 | 2026-02-02 | Initial specification |
