# Texture Generator

> **Spec Version**: 1.0.0
> **Last Updated**: 2026-02-15
> **Depends On**: [types-and-events.md](types-and-events.md), [config.md](config.md)
> **Depended By**: [main-scene.md](main-scene.md), [combat.md](combat.md), [player.md](player.md)

---

## Overview

The TextureGenerator is a utility module that procedurally creates all sprite textures used in the game at runtime using Phaser's `Graphics` API. There are zero external image assets — every visual element (bullets, reticle, hit markers, directional indicators, and weapon drop icons) is generated as a Phaser texture during the scene's `preload()` phase.

This approach eliminates asset loading latency and keeps the entire game self-contained. The generated textures are registered in Phaser's texture manager by key name and referenced throughout the codebase by those keys.

**Source file**: `game/utils/TextureGenerator.ts` (77 lines)

---

## Dependencies

### Technology Dependencies

| Technology | Version | Purpose |
|------------|---------|---------|
| Phaser | 3 (CDN) | Graphics API for procedural texture generation |

### Spec Dependencies

- [types-and-events.md](types-and-events.md) — `WeaponType` enum used for weapon drop icon key generation
- [config.md](config.md) — Phaser loaded via CDN in `index.html`

---

## Constants

All dimensions, colors, and positions are hardcoded inline in `TextureGenerator.ts`. There is no separate constants file for texture parameters.

### Generated Texture Keys

| Key | Size (px) | Description |
|-----|-----------|-------------|
| `placeholder` | 30 x 30 | White circle; used as invisible base sprite for `StickFigure` |
| `bullet_pellet` | 4 x 4 | Small yellow-white dot for standard bullet projectiles |
| `bullet_tracer` | 20 x 2 | Thin horizontal line for AK47 tracer rounds |
| `reticle` | 32 x 32 | Crosshair with outer ring, four ticks, and red center dot |
| `hitmarker` | 20 x 20 | White X shape displayed on successful hit |
| `hit_indicator` | 16 x 16 | Filled chevron/arrow for directional damage indication |
| `drop_BAT` | 30 x 6 | Weapon drop icon for Bat |
| `drop_KATANA` | 40 x 4 | Weapon drop icon for Katana |
| `drop_UZI` | 20 x 12 | Weapon drop icon for Uzi |
| `drop_AK47` | 40 x 8 | Weapon drop icon for AK47 |
| `drop_SHOTGUN` | 35 x 10 | Weapon drop icon for Shotgun |

---

## Data Structures

### Function Signature

The module exports a single function, not a class:

```typescript
export const generateGameTextures = (scene: Phaser.Scene) => void;
```

It takes the active Phaser scene and registers textures into its texture manager via `graphics.generateTexture(key, width, height)`.

### No Persistent State

The function is stateless. All `Graphics` objects created during generation are temporary (created with `scene.make.graphics({ x: 0, y: 0 }, false)` — the `false` means they are not added to the display list). After `generateTexture()` is called, the graphics object is abandoned (not explicitly destroyed, but not rendered).

---

## Behavior

### Invocation

`generateGameTextures(this)` is called in `MainScene.preload()` (line 73 of `MainScene.ts`). This ensures all textures are available before `create()` runs.

### Texture Generation Details

#### 1. Placeholder Sprite

```typescript
const graphics = scene.make.graphics({ x: 0, y: 0 }, false);
graphics.fillStyle(0xffffff);
graphics.fillCircle(15, 15, 15);
graphics.generateTexture('placeholder', 30, 30);
```

- **Shape**: Filled white circle, radius 15px, centered in a 30x30 canvas
- **Usage**: Base sprite for `StickFigure` (set invisible immediately; only the custom `Graphics` draw calls are visible). Referenced at `StickFigure` constructor line 47: `super(scene, x, y, 'placeholder')`
- **Color**: `0xffffff` (white)

#### 2. Bullet Pellet

```typescript
const pelletGfx = scene.make.graphics({ x: 0, y: 0 }, false);
pelletGfx.fillStyle(0xffffaa);
pelletGfx.fillCircle(2, 2, 2);
pelletGfx.generateTexture('bullet_pellet', 4, 4);
```

- **Shape**: Filled circle, radius 2px, centered at (2,2) in a 4x4 canvas
- **Color**: `0xffffaa` (pale yellow)
- **Usage**: Default bullet group texture for `this.bullets` and `this.enemyBullets` groups (MainScene lines 112-113). Tinted per weapon at fire time:
  - **UZI/default ranged**: tinted `0xffff00` (yellow), scale 1, body circle radius 2
  - **Shotgun**: tinted `0xff0000` (red), scale 1.2, body circle radius 3

#### 3. Bullet Tracer

```typescript
const tracerGfx = scene.make.graphics({ x: 0, y: 0 }, false);
tracerGfx.fillStyle(0xffffcc);
tracerGfx.fillRect(0, 0, 20, 2);
tracerGfx.generateTexture('bullet_tracer', 20, 2);
```

- **Shape**: Filled rectangle, 20px wide x 2px tall
- **Color**: `0xffffcc` (light cream yellow)
- **Usage**: Used exclusively for AK47 bullets. Applied at fire time (MainScene line 589) with tint `0xffaa00` (orange) and body circle radius 2.

#### 4. Reticle (Crosshair)

```typescript
const reticleGfx = scene.make.graphics({ x: 0, y: 0 }, false);
reticleGfx.lineStyle(2, 0xffffff, 1);
reticleGfx.strokeCircle(16, 16, 10); // Outer ring

reticleGfx.beginPath();
reticleGfx.moveTo(16, 2); reticleGfx.lineTo(16, 8);   // Top tick
reticleGfx.moveTo(16, 24); reticleGfx.lineTo(16, 30); // Bottom tick
reticleGfx.moveTo(2, 16); reticleGfx.lineTo(8, 16);   // Left tick
reticleGfx.moveTo(24, 16); reticleGfx.lineTo(30, 16); // Right tick
reticleGfx.strokePath();

reticleGfx.fillStyle(0xff0000, 1);
reticleGfx.fillCircle(16, 16, 2); // Center dot
reticleGfx.generateTexture('reticle', 32, 32);
```

- **Composition**:
  - Outer ring: white circle stroke, radius 10px, centered at (16,16), line width 2
  - Four cardinal ticks: white lines, 6px long each, extending inward from edge toward center
  - Center dot: red filled circle, radius 2px
- **Canvas size**: 32 x 32
- **Usage**: Instantiated as a sprite at MainScene line 109: `this.reticle = this.add.sprite(800, 800, 'reticle').setDepth(100).setAlpha(0.8)`. Positioned at mouse/joystick aim point each frame.

#### 5. Hit Marker

```typescript
const hitGfx = scene.make.graphics({ x: 0, y: 0 }, false);
hitGfx.lineStyle(3, 0xffffff, 1);
hitGfx.beginPath();
hitGfx.moveTo(2, 2); hitGfx.lineTo(18, 18);   // Top-left to bottom-right
hitGfx.moveTo(18, 2); hitGfx.lineTo(2, 18);   // Top-right to bottom-left
hitGfx.strokePath();
hitGfx.generateTexture('hitmarker', 20, 20);
```

- **Shape**: White X (two diagonal lines), line width 3
- **Canvas size**: 20 x 20
- **Usage**: Spawned at reticle position on successful hit (MainScene `showHitMarker` ~line 813). Tinted white for normal hits, red (`0xff0000`) and scaled 2.0x for kills. Fades out over 150ms.

#### 6. Directional Hit Indicator

```typescript
const dirIndGfx = scene.make.graphics({ x: 0, y: 0 }, false);
dirIndGfx.fillStyle(0xffffff, 1);
dirIndGfx.beginPath();
dirIndGfx.moveTo(0, 0);
dirIndGfx.lineTo(16, 8);
dirIndGfx.lineTo(0, 16);
dirIndGfx.lineTo(4, 8);
dirIndGfx.closePath();
dirIndGfx.fillPath();
dirIndGfx.generateTexture('hit_indicator', 16, 16);
```

- **Shape**: Filled chevron/arrowhead polygon pointing right, with vertices at (0,0), (16,8), (0,16), (4,8)
- **Color**: White fill
- **Canvas size**: 16 x 16
- **Usage**: Two contexts:
  1. **Outgoing damage indicator**: Spawned around player at 60px radius when hitting an enemy (MainScene `showHitMarker` ~line 831). Rotated to point toward the hit target. White for hits, red for kills.
  2. **Incoming damage indicator**: Spawned around player at 60px radius when taking damage (MainScene `showDamageReceived` ~line 947). Rotated to point toward damage source. Always red.

#### 7. Weapon Drop Icons

```typescript
const createDropIcon = (key: string, color: number, w: number, h: number) => {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0x000000, 0.5); // Shadow
    g.fillCircle(w/2 + 2, h/2 + 2, Math.max(w, h) / 2);
    g.fillStyle(color, 1);
    g.fillRect(0, 0, w, h);
    g.lineStyle(1, 0xffffff, 0.8); // Outline
    g.strokeRect(0, 0, w, h);
    g.generateTexture(key, w, h);
};

createDropIcon(`drop_${WeaponType.BAT}`, 0xcccccc, 30, 6);
createDropIcon(`drop_${WeaponType.KATANA}`, 0xffffff, 40, 4);
createDropIcon(`drop_${WeaponType.UZI}`, 0x333333, 20, 12);
createDropIcon(`drop_${WeaponType.AK47}`, 0x5d4037, 40, 8);
createDropIcon(`drop_${WeaponType.SHOTGUN}`, 0x5d4037, 35, 10);
```

Each weapon drop icon consists of:
1. **Shadow**: Semi-transparent black circle (50% alpha) offset +2px right and +2px down, radius = `max(width, height) / 2`
2. **Body**: Colored filled rectangle at full size
3. **Outline**: White stroke rectangle (80% alpha), line width 1

| Weapon | Key | Color | Dimensions | Notes |
|--------|-----|-------|------------|-------|
| BAT | `drop_BAT` | `0xcccccc` (silver) | 30 x 6 | Thin horizontal bar |
| KATANA | `drop_KATANA` | `0xffffff` (white) | 40 x 4 | Thinnest, longest |
| UZI | `drop_UZI` | `0x333333` (dark gray) | 20 x 12 | Most square/compact |
| AK47 | `drop_AK47` | `0x5d4037` (brown) | 40 x 8 | Wide, medium height |
| SHOTGUN | `drop_SHOTGUN` | `0x5d4037` (brown) | 35 x 10 | Slightly shorter than AK47 |

**Usage**: Spawned as physics sprites via `MainScene.spawnWeaponDrop()` (line 889) using key `drop_${type}`. Drops bob up and down with a `Sine.easeInOut` tween and have a pulsing yellow glow ring. Destroyed after 30 seconds if not picked up.

---

## Error Handling

### No Explicit Error Handling

The function does not contain any try/catch blocks or validation. Potential failure modes:

- **Missing scene**: If `scene` is null/undefined, Phaser's `scene.make.graphics()` will throw. This cannot happen in practice since `preload()` always has a valid scene.
- **Duplicate texture keys**: If `generateGameTextures` is called more than once per scene lifecycle, Phaser will issue a console warning about duplicate texture keys but will overwrite silently.
- **Graphics not destroyed**: The temporary `Graphics` objects created via `scene.make.graphics({}, false)` are not explicitly destroyed after texture generation. They exist as orphaned objects but are not on the display list, so they have no visual impact. They will be garbage collected when the scene is destroyed.

---

## Implementation Notes

### TypeScript (Client-Only)

This is a client-only module. There is no server-side equivalent — the server has no concept of textures.

**Key patterns**:

1. **`scene.make.graphics({}, false)`** — The `false` second argument prevents adding the graphics to the scene's display list. This is important: these are throwaway drawing surfaces used only to rasterize a texture.

2. **`graphics.generateTexture(key, width, height)`** — Phaser's API that rasterizes the current graphics commands into a canvas texture registered under `key` in the global texture manager. After this call, any game object can use the texture by referencing the key string.

3. **Weapon key interpolation** — Drop icon keys use template literals: `` `drop_${WeaponType.BAT}` `` resolves to `"drop_BAT"`. This couples the texture keys to the `WeaponType` enum values. If a new weapon type were added to the enum, a corresponding `createDropIcon` call would be needed.

4. **Note on shadow clipping** — The shadow circle in `createDropIcon` has a center offset of `(w/2 + 2, h/2 + 2)` with radius `max(w, h) / 2`, which for some icons extends beyond the canvas dimensions (e.g., BAT shadow center is at (17, 5) with radius 15, extending to x=32 on a 30px-wide canvas). Phaser clips this to the canvas bounds, so the shadow is partially visible.

### Texture Usage Map

| Texture Key | Used By | Location |
|-------------|---------|----------|
| `placeholder` | `StickFigure` constructor | `StickFigure.ts:47` |
| `bullet_pellet` | Bullet physics groups (default key) | `MainScene.ts:112-113` |
| `bullet_tracer` | AK47 bullets (set at fire time) | `MainScene.ts:589` |
| `reticle` | Aim reticle sprite | `MainScene.ts:109` |
| `hitmarker` | Hit confirmation feedback | `MainScene.ts:813` |
| `hit_indicator` | Directional damage indicators | `MainScene.ts:831, 947` |
| `drop_*` | Weapon drop sprites | `MainScene.ts:890` |

---

## Test Scenarios

### TS-TEX-001: All Textures Registered

**Category**: Unit
**Priority**: Critical

**Preconditions:**
- Phaser scene is initialized

**Input:**
- Call `generateGameTextures(scene)`

**Expected Output:**
- 11 textures registered in scene's texture manager: `placeholder`, `bullet_pellet`, `bullet_tracer`, `reticle`, `hitmarker`, `hit_indicator`, `drop_BAT`, `drop_KATANA`, `drop_UZI`, `drop_AK47`, `drop_SHOTGUN`

---

### TS-TEX-002: Placeholder Texture Dimensions

**Category**: Unit
**Priority**: High

**Preconditions:**
- `generateGameTextures(scene)` has been called

**Input:**
- Retrieve texture `placeholder` from texture manager

**Expected Output:**
- Width: 30px, Height: 30px

---

### TS-TEX-003: Bullet Pellet Dimensions

**Category**: Unit
**Priority**: High

**Preconditions:**
- `generateGameTextures(scene)` has been called

**Input:**
- Retrieve texture `bullet_pellet`

**Expected Output:**
- Width: 4px, Height: 4px

---

### TS-TEX-004: Bullet Tracer Dimensions

**Category**: Unit
**Priority**: High

**Preconditions:**
- `generateGameTextures(scene)` has been called

**Input:**
- Retrieve texture `bullet_tracer`

**Expected Output:**
- Width: 20px, Height: 2px

---

### TS-TEX-005: Reticle Texture Dimensions

**Category**: Unit
**Priority**: High

**Preconditions:**
- `generateGameTextures(scene)` has been called

**Input:**
- Retrieve texture `reticle`

**Expected Output:**
- Width: 32px, Height: 32px

---

### TS-TEX-006: Hit Marker Dimensions

**Category**: Unit
**Priority**: Medium

**Preconditions:**
- `generateGameTextures(scene)` has been called

**Input:**
- Retrieve texture `hitmarker`

**Expected Output:**
- Width: 20px, Height: 20px

---

### TS-TEX-007: Weapon Drop Icons for All WeaponTypes

**Category**: Unit
**Priority**: High

**Preconditions:**
- `generateGameTextures(scene)` has been called

**Input:**
- Iterate over all `WeaponType` values: `BAT`, `KATANA`, `UZI`, `AK47`, `SHOTGUN`
- Check for texture key `drop_${type}`

**Expected Output:**
- All 5 weapon drop textures exist with correct dimensions:
  - `drop_BAT`: 30 x 6
  - `drop_KATANA`: 40 x 4
  - `drop_UZI`: 20 x 12
  - `drop_AK47`: 40 x 8
  - `drop_SHOTGUN`: 35 x 10

---

### TS-TEX-008: Function Called in Preload Phase

**Category**: Integration
**Priority**: Critical

**Preconditions:**
- `MainScene` is started

**Input:**
- Scene lifecycle runs through `preload()`

**Expected Output:**
- All texture keys are available by the time `create()` executes
- No texture-not-found errors during `create()`

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-02-15 | Initial specification |
