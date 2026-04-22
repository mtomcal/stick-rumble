# Graphics

> **Spec Version**: 2.4.0
> **Last Updated**: 2026-04-22
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
| PLAYER_HEAD_COLOR | 0x2A2A2A | Dark Gray | Local player head |
| ENEMY_HEAD_COLOR | 0xFF0000 | Red | Enemy player head |
| DEAD_HEAD_COLOR | 0x888888 | Gray | Dead player head |
| BODY_COLOR | 0x000000 | Black | All player body/limbs |
| BULLET_IMPACT_COLOR | 0xffff00 | Yellow | Bullet hit effect |
| MELEE_IMPACT_COLOR | 0xffffff | White | Melee hit effect |
| MUZZLE_FLASH_COLOR | 0xFFD700 | Bright Yellow | Generic muzzle flash |
| HEALTH_BAR_FULL | 0x00CC00 | Green | Health bar at ≥20% |
| HEALTH_BAR_LOW | 0xFF0000 | Red | Health bar at <20% |
| WEAPON_CRATE_COLOR | 0xCCCC00 | Yellow | Weapon crate circle outline |
| WEAPON_CRATE_GLOW | 0xCCCC00 | Yellow | Crate circle (same as crate) |

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

### Player Rendering (Live Body)

**Why this contract exists**
The live player body is not just decorative art. It is the on-screen representation of authoritative movement collision. If the visible body shows air where the movement system reads solid contact, players will perceive false openings and false wall gaps even when the underlying physics is internally consistent.

### Canonical Visible Footprint

Every live player must render a stable canonical visible footprint that is the visual representation of the shared player dimensions:

- width derives directly from `PLAYER_WIDTH`
- height derives directly from `PLAYER_HEIGHT`
- the footprint is centered on the player world position
- the footprint stays axis-aligned to the world and does not rotate with aim

For the current game, that means the live player's collision-carrying visible body must read as a `32x64` footprint centered on the player position because `PLAYER_WIDTH = 32` and `PLAYER_HEIGHT = 64`.

**Hard rules:**
- the canonical visible footprint is the primary live-player body read on screen
- the canonical visible footprint must be present in all live states: idle, walking, sprinting, aiming, and dodge rolling
- the canonical visible footprint may not intentionally inset from the authoritative hitbox on any side
- the outer rendered extents of that footprint must match the authoritative hitbox within at most 1 rendered pixel on each side
- against movement-blocking obstacles, the live player body must read flush to the authoritative obstacle rectangle edge on the north, east, south, and west sides with no readable air gap at normal gameplay scale
- this contract applies to the live player body only; corpses, invulnerability rings, labels, weapons, and other attachments are not the collision-reading body

**Obstacle-edge rule:**
- the real blocking edge is the obstacle's authoritative rectangle boundary from [arena.md](arena.md)
- obstacle paint treatment must support that edge read; fills, outlines, shadows, or highlights may not create a false visible gap or false visible overlap larger than 1 rendered pixel relative to that boundary

### Footprint-First Styling

The live player still uses a stylized stick-figure presentation, but the rendering contract is footprint-first:

- the canonical visible footprint is mandatory
- stylized details such as head, arms, hands, legs, feet, and held weapon are secondary layers on top of that footprint
- those secondary layers may extend beyond the canonical footprint for expression, but they do not redefine where the live body "is" for blocker contact
- attachments may not be used to hide a body-gap bug or to satisfy flush-contact readability by themselves

The exact artistic shape used to realize the canonical footprint is intentionally not fixed to one named silhouette. A rounded rectangle, capsule-like mass, or another body treatment is acceptable if it satisfies the footprint contract above.

### Preserved Stick-Figure Detail Layer

Stick-figure detail remains part of the live player style because it preserves the prototype's readability and personality. The detail layer is composed of:
1. **Head**: Filled circle at center
2. **Arms**: Two lines from center to hands, with circular hands
3. **Legs**: Two lines from center to feet, with circular feet

These details may animate and aim expressively, but they must not change the canonical collision-carrying outer footprint.

**Rendering order (conceptual):**
```
function renderLivePlayer(player, walkCycle):
    graphics.clear()

    canonicalFootprint = bodyFootprintFromPlayerDimensions(
        width = PLAYER_WIDTH,
        height = PLAYER_HEIGHT,
        center = player.position
    )

    drawCanonicalFootprint(canonicalFootprint)
    drawStickFigureDetailsInsideOrOnTop(canonicalFootprint, walkCycle, player.aimAngle)
    drawNonCollisionReadingAttachments(player.weapon, player.label, player.ring)
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

**Constraint:** Walk animation may move internal detail, but it may not deform the canonical visible footprint or change the live player's collision-carrying outer extents.

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

### Player Rendering Bugs

> **Bug (to fix)**: A 50px green aim indicator line (`AIM_INDICATOR_LENGTH`) is drawn from the player center along the aim direction in `PlayerManager.ts`. This line (green `0x00FF00` for local, yellow `0xFFFF00` for enemies) does NOT appear in the prototype and must be **completely removed**. It is not part of the intended visual design — the hit confirmation trail serves the purpose of showing shot direction on hit.

> **Bug (to fix)**: An orange dot appears in the top-left corner of the screen during gameplay. This is likely a stale muzzle flash circle (`fillCircle` with orange color `0xFFAA00` / `0xFFCC00` / `0xFF8800`) that is not being properly cleared or positioned. Investigate `RangedWeapon.ts` muzzle flash rendering and ensure muzzle flash graphics are cleared each frame and only drawn at the barrel tip position during the flash duration.

### Player Colors

**Head-Only Color Distinction:**
Only the **head** uses a type-specific color to distinguish players. All body parts (torso, arms, legs) are drawn in black (`0x000000`) for all player types.

- Local player head: Dark gray (`COLORS.PLAYER_HEAD` / `0x2A2A2A`)
- Enemy player head: Red (`COLORS.ENEMY_HEAD` / `0xFF0000`) — immediate threat recognition
- Dead player head: Gray (`COLORS.DEAD_HEAD` / `0x888888`) — inactive state

| Part | Local Player | Enemy Player | Dead Player |
|------|-------------|-------------|-------------|
| Head | 0x2A2A2A (dark gray) | 0xFF0000 (red) | 0x888888 (gray) |
| Body/Limbs | 0x000000 (black) | 0x000000 (black) | 0x000000 (black) |

**TypeScript:**
```typescript
private getHeadColor(playerId: string, isDead: boolean): number {
  if (isDead) {
    return 0x888888; // COLORS.DEAD_HEAD
  }
  return playerId === this.localPlayerId ? 0x2A2A2A : 0xFF0000;
}

private getBodyColor(): number {
  return 0x000000; // Black for all player types
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
- Background (depleted): `COLORS.HEALTH_DEPLETED_BG` / `0x333333` (dark)
- Health fill: `COLORS.HEALTH_FULL` / `0x00CC00` (green)
- Fill width: (health / 100) * 32px

**TypeScript:**
```typescript
render(x: number, y: number, health: number): void {
  const barX = x - 16;  // Center horizontally
  const barY = y - 32 - 8;  // Above head

  // Background (depleted portion)
  this.graphics.fillStyle(0x333333, 1);  // COLORS.HEALTH_DEPLETED_BG
  this.graphics.fillRect(barX, barY, 32, 4);

  // Health fill
  const healthWidth = (health / 100) * 32;
  this.graphics.fillStyle(0x00CC00, 1);  // COLORS.HEALTH_FULL
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

**Dynamic Colors (2-tier):**
- ≥20% health: `COLORS.HEALTH_FULL` / `0x00CC00` (green)
- <20% health: `COLORS.HEALTH_CRITICAL` / `0xFF0000` (red) — critical threshold

**Components:**
1. Heartbeat/EKG icon to the left of the bar
2. Depleted portion background: `COLORS.HEALTH_DEPLETED_BG` / `0x333333`
3. Colored health bar (scales with health)
4. White text: "N%" format (e.g., "100%", "76%") to the right of the bar

**Regeneration Effect:**
- Pulsing animation when regenerating
- Alpha oscillates 0.6 → 1.0
- Duration: 500ms per cycle
- Ease: Sine.easeInOut

### Hit Confirmation Trail

**Why Hit Trails?**
Provides visual confirmation when a shot connects, especially useful for confirming hits on off-screen enemies.

**Trigger:** `hit:confirmed` event (appears for ALL hits — on-screen and off-screen targets)

**Visual:**
- Shape: Line from the **actual gun barrel tip** to the hit target's position
- The barrel position MUST be computed from the weapon graphic's rendered position and aim angle — not from a generic player-center offset. The trail must visually originate from the end of the gun barrel.
- Color: `HIT_TRAIL_COLOR` / `0xFFFFFF` (white)
- Stroke: `HIT_TRAIL_STROKE` / 1px
- Alpha: `HIT_TRAIL_ALPHA` / 0.8
- Depth: `HIT_TRAIL_DEPTH` / 40
- Lingers for `HIT_TRAIL_LINGER_DURATION` / 300ms, then fades over `HIT_TRAIL_FADE_DURATION` / 200ms
- **Bug (to fix)**: Trail start point is offset from the actual gun barrel — it should originate from the weapon tip, not a detached position.

**Pseudocode:**
```
// On hit:confirmed event
function showHitTrail(barrelX, barrelY, targetX, targetY):
    trail = scene.add.line(0, 0, barrelX, barrelY, targetX, targetY, 0xFFFFFF)
    trail.setAlpha(0.8)
    trail.setDepth(40)
    trail.setLineWidth(1)

    // Linger 300ms, then fade over 200ms
    scene.tweens.add({
        targets: trail,
        alpha: 0,
        duration: 200,   // HIT_TRAIL_FADE_DURATION
        delay: 300,       // HIT_TRAIL_LINGER_DURATION
        onComplete: () => trail.destroy()
    })
```

**Constants**: See [constants.md § Hit Trail Constants](constants.md#hit-trail-constants).

### Crosshair / Reticle

The crosshair is a **simple `+` (plus/cross) shape** — no circle, no ring. White color (`#FFFFFF`), ~20px span, 2px stroke. There is **no dynamic expansion or bloom** — the crosshair remains at a fixed size at all times.

**Texture Generation** (32×32, generated once in `preload()`):

```typescript
// TextureGenerator.ts — crosshair texture (plus shape only, NO circle)
const gfx = scene.make.graphics({ x: 0, y: 0 }, false);
gfx.lineStyle(2, 0xffffff, 1);

// White "+" cross shape ONLY — no outer circle
gfx.beginPath();
gfx.moveTo(16, 6); gfx.lineTo(16, 26);  // Vertical bar
gfx.moveTo(6, 16); gfx.lineTo(26, 16);  // Horizontal bar
gfx.strokePath();

gfx.generateTexture('reticle', 32, 32);
```

**Placement**: Sprite at exact mouse cursor position, depth 100, alpha 0.8. The `+` crosshair sits directly at the cursor location.

**Constants**: See [constants.md § Crosshair / Reticle Constants](constants.md#crosshair--reticle-constants).

### Weapon Pickup Rendering

**Why this design?**
Players should know what they are walking toward before they enter prompt range. Pickup readability comes primarily from the weapon itself, not from a generic marker.

Generic pickup markers (for example a standalone yellow circle or `⊕` icon without a weapon silhouette) are out of spec for normal gameplay.

**Available State:**
- the floor pickup renders as the actual weapon silhouette for its weapon type
- the weapon uses recognizable pickup coloring and contrast against the arena floor
- melee pickups must read as their real objects: the bat should look like a brown bat, not blend into the floor; the katana should read as a blade, not a generic stub
- a subtle persistent pickup-zone affordance remains visible around the weapon as a secondary cue

**Unavailable State:**
- the pickup spot remains visible while on respawn cooldown
- the empty spot still communicates the exact returning weapon type
- unavailable presentation is visibly subdued relative to the active pickup, but still readable as a future item location

**Bobbing Animation:**
- Distance: 5px up/down
- Duration: 1000ms cycle
- Ease: Sine.easeInOut
- Type: Yoyo (repeat forever)

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
- Color: `COLORS.MUZZLE_FLASH` / 0xFFD700 (bright yellow)
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

**Why the live body must stay stable**
The dodge roll is still resolved against the same authoritative `PLAYER_WIDTH x PLAYER_HEIGHT` collision body. The live player's collision-carrying visible footprint therefore stays stable during the roll. Roll presentation must not reintroduce false side gaps or make the player body disappear exactly when obstacle contact matters most.

**Roll visual rules:**
- the canonical live-player footprint remains visible during the entire roll
- the canonical live-player footprint remains axis-aligned and does not rotate with the roll
- the canonical live-player footprint keeps the same outer extents during the roll as in ordinary movement
- any roll-specific flair must be a secondary, non-collision-reading layer and must not hide, rotate, or distort the canonical footprint

**Allowed roll flair examples:**
- weapon or attachment motion
- non-body accent effects
- additional timing cues that do not replace the live body read

**Out of spec:**
- rotating the live collision-carrying body during the roll
- toggling the live body fully invisible during i-frames
- shrinking, stretching, or otherwise changing the live body's outer footprint during the roll

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
| Yellow Outline | ~50px circle, `COLORS.SPAWN_RING` / 0xFFFF00 | Visual spec line 265 |

**Yellow Circle Outline**: Dead enemies have a yellow circle outline (~50px diameter) surrounding the corpse body. This is drawn as a stroke-only circle at the corpse position using `COLORS.SPAWN_RING` / `0xFFFF00`.

**Constants**: See [constants.md § Death Corpse Constants](constants.md#death-corpse-constants).

### Held Weapon Visibility

Held weapons must render at the **same scale** for both the local player and remote players. They must be full-sized and visually identifiable during moment-to-moment combat, not tiny nubs, invisible silhouettes, or floor-colored stubs.

**Requirements:**
- Local and remote weapon containers use the same `ProceduralWeaponGraphics` rendering rules
- Weapon scale must be 1:1 between local and remote players
- All weapon types (pistol, uzi, ak47, shotgun, bat, katana) must be clearly recognizable while held
- The bat must read as a brown wooden bat in-hand; it must not visually blend into the gray arena floor or disappear against the player body
- Melee weapons must remain readable in both left-facing and right-facing aim states

> **Bug (to fix)**: Current build can render held melee weapons, especially the bat, with too little contrast against the arena. Held weapons must stay readable during combat.

### Blood Particles

When a player takes damage, 5 blood particles burst from the impact point, spraying away from the damage source.

**Implementation** (tween-based, no physics bodies):
```typescript
// On damage received
for (let i = 0; i < 5; i++) {
    const circle = this.add.circle(player.x, player.y, Phaser.Math.Between(2, 5), 0xCC3333);
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
| Color | `COLORS.BLOOD` / 0xCC3333 (pink-red) | — |
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
// Same positioning but longer duration (400ms) and always pinkish-red
indicator.setTint(0xCC3333);  // COLORS.HIT_CHEVRON
this.tweens.add({ targets: indicator, alpha: 0, scale: 1.5, duration: 400, onComplete: () => indicator.destroy() });
```

| Property | Outgoing | Incoming | Source |
|----------|----------|----------|--------|
| Distance | 60px from center | 60px from center | `constants.md` |
| Color | White (normal) / Red (kill) | `COLORS.HIT_CHEVRON` / 0xCC3333 (pinkish-red) | — |
| Duration | 200ms | 400ms | — |
| Depth | 1001 | 1001 | — |

**Constants**: See [constants.md § Hit Indicator Constants](constants.md#hit-indicator-constants).

### Spawn Invulnerability Ring

When a player spawns (or respawns), they receive a brief invulnerability window. During this window, a yellow circle outline is rendered around the player.

**Visual:**
- Shape: Circle outline (stroke only)
- Radius: ~25px
- Color: `COLORS.SPAWN_RING` / `0xFFFF00` (yellow)
- Stroke: 2px
- Visible when `isInvulnerable === true` for any player (local and remote)
- Hidden when invulnerability expires

**TypeScript:**
```typescript
// Rendered each frame when player.isInvulnerable === true
if (player.isInvulnerable) {
  this.graphics.lineStyle(2, 0xFFFF00, 1);  // COLORS.SPAWN_RING
  this.graphics.strokeCircle(player.x, player.y, 25);
}
```

### Local Player Label

A "YOU" label floats above the local player's head for quick identification.

**Visual:**
- Text: "YOU"
- Font: Bold, ~14px
- Color: White (`#FFFFFF`)
- Drop shadow: Dark, for readability against any background
- Position: `(player.x, player.y - headRadius - 5px)`, centered on X
- Depth: Above player sprite

### Remote Player Name Labels

Enemy players display their name above their head.

**Visual:**
- Text: Player's display name from server state
- Font: ~12-14px
- Color: Gray/white
- Position: `(player.x, player.y - headRadius - 5px)`, centered on X
- Depth: Above player sprite

### Damage Screen Flash

When the local player takes damage, a full-viewport red overlay flashes to provide visceral feedback.

**Visual:**
- Shape: Full-viewport rectangle
- Color: `COLORS.DAMAGE_FLASH` / `#FF0000`
- Alpha: 0.3-0.4
- Animation: Flash in immediately, fade out over 300ms
- Triggered by `player:damaged` for local player only
- Depth: 999 (below fixed HUD at 1000+)

**TypeScript:**
```typescript
// On player:damaged where victimId === localPlayerId
const overlay = this.add.rectangle(
  camera.scrollX + camera.width / 2,
  camera.scrollY + camera.height / 2,
  camera.width, camera.height,
  0xFF0000, 0.35  // COLORS.DAMAGE_FLASH
).setDepth(999).setScrollFactor(0);

this.tweens.add({
  targets: overlay,
  alpha: 0,
  duration: 300,
  onComplete: () => overlay.destroy()
});
```

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

### TS-GFX-003: Player Head Color Matches State (Body Always Black)

**Category**: Unit
**Priority**: High

**Preconditions:**
- Player exists

**Input:**
- Local player ID and target player ID

**Expected Output:**
- Local player head: 0x2A2A2A (dark gray), body/limbs: 0x000000 (black)
- Enemy player head: 0xFF0000 (red), body/limbs: 0x000000 (black)
- Dead player head: 0x888888 (gray), body/limbs: 0x000000 (black)

---

### TS-GFX-004: Health Bar Width Reflects Percentage

**Category**: Unit
**Priority**: High

**Input:**
- Health = 75

**Expected Output:**
- Health bar fill width = 75% of total width
- Formula: (75 / 100) * 32 = 24 pixels
- Background (depleted portion): 0x333333 (`COLORS.HEALTH_DEPLETED_BG`)
- Fill color: 0x00CC00 (green, since 75% ≥ 20% threshold)

---

### TS-GFX-005: Hit Confirmation Trail Renders on Hit

**Category**: Visual
**Priority**: Medium

**Input:**
- `hit:confirmed` event with barrel position (100, 100) and target position (300, 200)

**Expected Output:**
- Line rendered from barrel (100, 100) to hit target position (300, 200)
- Trail color: white (0xFFFFFF), stroke 1px, alpha 0.8
- Trail lingers for 300ms, then fades over 200ms
- Trail depth: 40

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

### TS-GFX-008: Available Pickup Renders Weapon-Specific Silhouette

**Category**: Visual
**Priority**: Medium

**Preconditions:**
- Weapon pickup is available

**Input:**
- Pickup at position (500, 500)

**Expected Output:**
- Pickup renders as weapon-specific floor silhouette (not generic marker-only iconography)
- Subtle pickup-zone affordance remains visible as a secondary cue
- Bobbing animation active

---

### TS-GFX-009: Unavailable Pickup Is Faded But Still Type-Readable

**Category**: Visual
**Priority**: Medium

**Input:**
- Crate with available = false

**Expected Output:**
- Alpha = 0.3
- Yellow circle (glow) remains visible at reduced alpha as ghostly respawning indicator

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

### TS-GFX-012: Dodge Roll Preserves Canonical Live Footprint

**Category**: Visual
**Priority**: High

**Input:**
- Player rolling, rollStartTime = 200ms ago

**Expected Output:**
- Live body remains visibly present
- Live body remains axis-aligned rather than rotating with the roll
- Live body outer extents still match `PLAYER_WIDTH x PLAYER_HEIGHT` within 1 rendered pixel
- Any roll-specific flair remains secondary and does not become the collision-reading body

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
- Particles are pink-red (`COLORS.BLOOD` / 0xCC3333), radius 2-5px
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

> **Note:** "Wall" may mean either arena boundary edges or authored map obstacles that block projectiles.

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
- Pinkish-red chevron indicator (`COLORS.HIT_CHEVRON` / 0xCC3333) appears 60px from player toward source
- Fades over 400ms (longer than outgoing)

---

### TS-GFX-023: Crosshair reticle texture

**Category**: Visual
**Priority**: Medium

**Preconditions:**
- Game scene loaded

**Expected Output:**
- Fixed ~20-25px `⊕` reticle sprite at cursor position, depth 100, alpha 0.8
- Contains white outer circle (radius 10) with white "+" cross shape inside
- No red center dot
- No dynamic expansion or bloom — reticle stays at fixed compact size

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

### TS-GFX-025: Canonical live footprint matches shared player dimensions

**Category**: Unit
**Priority**: Critical

**Preconditions:**
- Live player rendered in ordinary gameplay state

**Input:**
- Render the live player while idle, walking, aiming, and rolling

**Expected Output:**
- The collision-carrying visible body derives directly from `PLAYER_WIDTH` and `PLAYER_HEIGHT`
- The visible body's outer extents match the authoritative `32x64` hitbox within 1 rendered pixel on each side
- The visible body remains axis-aligned in every tested live state
- Animation and aim detail stay inside or on top of that stable outer footprint rather than redefining it

### TS-GFX-026: Live player reads flush against blockers on all four sides

**Category**: Visual
**Priority**: Critical

**Preconditions:**
- A movement-blocking obstacle with known authoritative rectangle edges
- A live player placed so the canonical visible footprint is resolved against the obstacle

**Input:**
- Test north-side contact
- Test east-side contact
- Test south-side contact
- Test west-side contact

**Expected Output:**
- The live player's visible body reads flush to the obstacle's authoritative rectangle edge in every direction
- No readable air gap appears between the live body and the blocker at normal gameplay scale
- No visible body overhang beyond the authoritative blocker edge exceeds 1 rendered pixel
- Weapons, hands, labels, rings, or other attachments are not relied on to sell the contact read

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 2.4.0 | 2026-04-22 | Reframed live-player rendering around a canonical visible footprint derived directly from `PLAYER_WIDTH` and `PLAYER_HEIGHT`. Added a footprint-first contract: the live body must stay axis-aligned, stable across movement and dodge roll, and read flush against authoritative blocker edges on all four sides within a 1 rendered-pixel tolerance. Replaced dodge-roll body rotation/flicker as normative behavior. Added TS-GFX-025 and TS-GFX-026 for geometry and four-direction contact acceptance. |
| 2.3.2 | 2026-04-10 | Renamed enemy weapon visibility to held weapon visibility. Clarified that local and remote held weapons share the same readability contract, and explicitly required the bat to remain visibly brown and recognizable in-hand. |
| 2.3.1 | 2026-04-09 | Clarified pickup rendering contract: normal gameplay pickups must be weapon-specific floor silhouettes with a secondary zone affordance; generic marker-only presentation is explicitly out of spec. Updated TS-GFX-008 and TS-GFX-009 wording accordingly. |
| 2.3.0 | 2026-03-02 | Crosshair changed from `⊕` (circle+cross) to simple `+` (cross only, no circle). Hands/arms now grip weapon and follow aim rotation. Hit trail must originate from actual gun barrel tip. Added bugs: remove green aim indicator line, remove orange dot artifact, fix hit trail barrel attachment. |
| 2.2.0 | 2026-02-23 | Renamed "Aim Indicator" → "Hit Confirmation Trail" (triggered by hit:confirmed, not continuously visible). Rewrote crosshair section: fixed ~20-25px reticle, no bloom. Updated weapon crate icon to yellow `⊕` symbol. Added yellow circle outline to death corpse rendering. Added "Enemy Weapon Visibility" section with bug note. Updated tests TS-GFX-005, TS-GFX-023, TS-GFX-008. |
| 2.1.0 | 2026-02-18 | Art style alignment: Head-only player color distinction (body/limbs always black). Crosshair changed to white "+" in circle with bloom on firing. Weapon crate changed to yellow circle outline. Added spawn invulnerability ring, "YOU" label, enemy name labels, damage screen flash sections. Aim line changed to white, extends to crosshair. Health bar updated to 2-tier thresholds (green ≥20%, red <20%), "N%" text format, EKG icon, dark depleted background. Blood/hit indicator colors updated to 0xCC3333. Muzzle flash color updated to 0xFFD700. Unavailable weapon crate glow remains visible. Updated tests TS-GFX-003, TS-GFX-004, TS-GFX-008, TS-GFX-009, TS-GFX-015, TS-GFX-022, TS-GFX-023. |
| 2.0.0 | 2026-02-16 | Major overhaul: Ported all pre-BMM visual systems. Replaced crosshair with pre-generated reticle texture. Replaced melee arc with white stroke-only + container tween. Replaced dead player with splayed corpse. Added blood particles, healing particles, wall spark, gun recoil, aim sway, reload animation, directional hit indicators. Updated depth table. Added tests TS-GFX-015 through TS-GFX-024. |
| 1.0.0 | 2026-02-02 | Initial specification |
