# Graphics

> **Spec Version**: 1.0.0
> **Last Updated**: 2026-02-02
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
| PLAYER_DEPTH | 50 | Stick figures render at this depth |
| EFFECT_DEPTH | 60 | Hit effects render above players |
| MELEE_ARC_DEPTH | 100 | Melee swing arcs render above effects |
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

### Crosshair

**Why Dynamic Crosshair?**
Shows current weapon spread, helping players understand accuracy mechanics.

**Static Crosshair:**
- Shape: 4 lines forming + sign
- Size: 10px from center, 5px gap
- Width: 2px
- Color: White (0xffffff)
- Position: Mouse cursor (scrollFactor = 0)
- Depth: 1000

**Dynamic Spread Circle:**
- Shape: Circle outline
- Color: Red (0xff0000), 0.6 alpha
- Width: 2px
- Radius: currentSpread * PIXELS_PER_DEGREE + 5
- PIXELS_PER_DEGREE = 2

**Weapon Spread (in pixels):**

| Weapon | Base Spread° | Pixels |
|--------|-------------|--------|
| Pistol | 0° | 0 |
| Uzi | 5° | 10 |
| AK47 | 3° | 6 |
| Shotgun | 15° | 30 |
| Melee | N/A | Hidden |

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

**Why Pie-Slice Arc?**
Shows the attack cone visually, helping players aim melee attacks.

**Bat Swing:**
- Range: 64 pixels
- Arc: 90 degrees (π/2 radians)
- Color: 0x8B4513 (brown)
- Outline: 3px width, 0.8 alpha
- Fill: 0.2 alpha (semi-transparent)

**Katana Swing:**
- Range: 80 pixels
- Arc: 90 degrees
- Color: 0xC0C0C0 (silver)
- Outline: 3px width, 0.8 alpha
- Fill: 0.2 alpha

**Animation:**
- Duration: 200ms total
- Frames: 4
- Frame duration: 50ms each
- Depth: 100 (above players)

**Pseudocode:**
```
function renderMeleeSwing(x, y, aimAngle, weapon):
    arcRadians = weapon.arcDegrees * PI / 180
    halfArc = arcRadians / 2
    startAngle = aimAngle - halfArc
    endAngle = aimAngle + halfArc

    // Arc outline
    graphics.lineStyle(3, weapon.color, 0.8)
    graphics.arc(x, y, weapon.range, startAngle, endAngle)
    graphics.strokePath()

    // Filled pie slice
    graphics.fillStyle(weapon.color, 0.2)
    graphics.moveTo(x, y)
    graphics.arc(x, y, weapon.range, startAngle, endAngle)
    graphics.closePath()
    graphics.fillPath()
```

**TypeScript:**
```typescript
showSwingAnimation(aimAngle: number): void {
  this.graphics.clear();

  const arcRadians = (this.stats.arcDegrees * Math.PI) / 180;
  const halfArc = arcRadians / 2;
  const startAngle = aimAngle - halfArc;
  const endAngle = aimAngle + halfArc;

  // Arc outline
  this.graphics.lineStyle(3, this.stats.color, 0.8);
  this.graphics.beginPath();
  this.graphics.arc(this.x, this.y, this.stats.range, startAngle, endAngle, false);
  this.graphics.strokePath();

  // Fill
  this.graphics.fillStyle(this.stats.color, 0.2);
  this.graphics.beginPath();
  this.graphics.moveTo(this.x, this.y);
  this.graphics.arc(this.x, this.y, this.stats.range, startAngle, endAngle, false);
  this.graphics.closePath();
  this.graphics.fillPath();
}
```

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

### Dead Player Rendering

**Why Stay Visible?**
Players need to see where enemies died for tactical awareness (respawn locations).

**Visual Change:**
- Color: Changed to 0x888888 (gray)
- All body parts retain shape
- No transparency change
- No animation

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

### TS-GFX-011: Player Fades on Death

**Category**: Visual
**Priority**: Medium

**Input:**
- Player with isDead = true

**Expected Output:**
- Player color changes to 0x888888 (gray)
- Player remains visible

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

### TS-GFX-013: Melee Swing Shows Arc

**Category**: Visual
**Priority**: High

**Input:**
- Bat swing at aimAngle = 0

**Expected Output:**
- Arc from -45° to +45° (90° total)
- Radius = 64 pixels
- Brown color with semi-transparent fill

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

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-02-02 | Initial specification |
