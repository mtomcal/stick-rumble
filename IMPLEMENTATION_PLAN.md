# Art Style Implementation Plan — Code Changes

> Goal: Bring client/server code into compliance with updated spec documents (art style alignment).
> Specs were updated in branch `ralph/art-style-specs` (merged 2026-02-18). Code has NOT been updated yet.
> Generated: 2026-02-18

---

## Executive Summary

The spec documents now describe 60 visual changes to match the prototype art style. The source code still reflects old designs. This plan maps each spec change to concrete code modifications: exact file paths, line numbers, what to change, and dependencies.

**Scope:** ~25 files modified, ~9 new files created, across 6 phases.

---

## Phase 0: Foundation (Constants & Config)

> Must land first — nearly every other change imports COLORS or depends on renamed constants.

### Task 0.1: Add COLORS constant group to shared/constants.ts

**Spec changes covered:** #45
**File:** `stick-rumble-client/src/shared/constants.ts` (lines 1-98, no COLORS exist)
**Action:** Add `COLORS` export with all 22 prototype palette values:

```typescript
export const COLORS = {
  BACKGROUND: 0xC8CCC8,
  GRID_LINE: 0xD8DCD8,
  PLAYER_HEAD: 0x2A2A2A,
  ENEMY_HEAD: 0xFF0000,
  DEAD_HEAD: 0x888888,
  BODY: 0x000000,
  HEALTH_FULL: 0x00CC00,
  HEALTH_CRITICAL: 0xFF0000,
  HEALTH_DEPLETED_BG: 0x333333,
  AMMO_READY: 0xE0A030,
  AMMO_RELOADING: 0xCC5555,
  SCORE: 0xFFFFFF,
  KILL_COUNTER: 0xFF6666,
  DEBUG_OVERLAY: 0x00FF00,
  CHAT_SYSTEM: 0xBBA840,
  MUZZLE_FLASH: 0xFFD700,
  BULLET_TRAIL: 0xFFA500,
  DAMAGE_NUMBER: 0xFF4444,
  BLOOD: 0xCC3333,
  SPAWN_RING: 0xFFFF00,
  DAMAGE_FLASH: 0xFF0000,
  HIT_CHEVRON: 0xCC3333,
  WEAPON_CRATE: 0xCCCC00,
} as const;
```

**Complexity:** Simple
**Tests:** Add/update constants test to verify COLORS object exists with all keys.

---

### Task 0.2: Add MINIMAP constants + rename HEALTH_BAR_WIDTH

**Spec changes covered:** #46, #47
**File:** `stick-rumble-client/src/shared/constants.ts`
**Action:**
- Add `MINIMAP` constant group: `{ SIZE: 170, SCALE: 0.106, RADAR_RANGE: 600, BG_COLOR: 0x3A3A3A, BORDER_COLOR: 0x00CCCC }`
- Rename `PLAYER.HEALTH_BAR_WIDTH` → `PLAYER.PLAYER_HEALTH_BAR_WIDTH` (if exists)
- Add `PLAYER.HUD_HEALTH_BAR_WIDTH = 200`
- Update all references to the renamed constant

**Complexity:** Simple
**Tests:** Update constants tests.

---

### Task 0.3: Update GameConfig background color

**Spec changes covered:** #48
**File:** `stick-rumble-client/src/game/config/GameConfig.ts` (or equivalent config file) line 9
**Action:** Change `backgroundColor: '#282c34'` → `'#C8CCC8'`
**Complexity:** Trivial

---

### Task 0.4: Add isInvulnerable to client PlayerState interface

**Spec changes covered:** #56
**File:** `stick-rumble-client/src/game/entities/PlayerManager.ts` lines 13-28 (PlayerState interface)
**Action:** Add `isInvulnerable?: boolean` and `invulnerabilityEndTime?: number`
**Note:** Server already has these fields (`stick-rumble-server/internal/game/player.go` lines 54-55)
**Complexity:** Trivial

---

### Task 0.5: Add projectile shape + tracerLength to weapon config interfaces

**Spec changes covered:** #42 (partial), #44 (partial)
**File:** `stick-rumble-client/src/shared/weaponConfig.ts` lines 6-18
**Action:**
- Add `shape: 'chevron' | 'circle'` and `tracerLength: number` to `ProjectileVisuals` interface
- Add `muzzleFlashShape: 'starburst' | 'circle'` to `WeaponVisuals` interface
- Update all hardcoded weapon fallback defaults (lines 106-262) with new fields
**Complexity:** Simple

---

## Phase 1: Trivial Color/Value Fixes (One-Line Changes)

> Each is a single constant/color swap. Can be done in any order after Phase 0.

### Task 1.1: Arena background color

**Spec changes covered:** #17
**File:** `stick-rumble-client/src/game/scenes/GameScene.ts` line 74
**Action:** Change `0x222222` → `COLORS.BACKGROUND` (0xC8CCC8)
**Complexity:** Trivial

### Task 1.2: Grid line color

**Spec changes covered:** #18
**File:** `stick-rumble-client/src/game/scenes/GameScene.ts` line 83
**Action:** Change `0xb0bec5` → `COLORS.GRID_LINE` (0xD8DCD8)
**Complexity:** Trivial

### Task 1.3: World-space health bar background

**Spec changes covered:** #10
**File:** `stick-rumble-client/src/game/entities/HealthBar.ts` lines 63-66
**Action:** Change `0x888888` → `COLORS.HEALTH_DEPLETED_BG` (0x333333)
**Complexity:** Trivial

### Task 1.4: Blood particle color

**Spec changes covered:** #13, #37 (partial)
**File:** `stick-rumble-client/src/game/entities/HitEffectManager.ts` line 249
**Action:** Change `0xCC0000` → `COLORS.BLOOD` (0xCC3333). Also increase particle count from 5 to 6-10 (line 247).
**Complexity:** Trivial

### Task 1.5: Hit direction indicator color

**Spec changes covered:** #14, #36 (partial)
**File:** `stick-rumble-client/src/game/scenes/GameSceneUI.ts` line 435
**Action:** Change `indicator.setTint(0xff0000)` → `indicator.setTint(COLORS.HIT_CHEVRON)` (0xCC3333)
**Complexity:** Trivial

### Task 1.6: Muzzle flash color constant

**Spec changes covered:** #15
**File:** `stick-rumble-client/src/game/entities/HitEffectManager.ts` line 40
**Action:** Change `MUZZLE_COLOR = 0xffa500` → `COLORS.MUZZLE_FLASH` (0xFFD700)
**Complexity:** Trivial

### Task 1.7: Weapon crate respawn glow visible

**Spec changes covered:** #16
**File:** `stick-rumble-client/src/game/entities/WeaponCrateManager.ts` line 98
**Action:** Change `crate.glow.setVisible(false)` → `crate.glow.setAlpha(UNAVAILABLE_ALPHA)` (keep visible, just faded)
**Complexity:** Trivial

### Task 1.8: Pistol tracer color

**Spec changes covered:** #43
**File:** `stick-rumble-client/src/shared/weaponConfig.ts` line 127
**Action:** Change `tracerColor: '0xffff00'` → `'0xffaa00'`
**Also:** Update both `weapon-configs.json` files (root + `stick-rumble-client/public/`) — add `projectile` sub-object to each weapon if missing.
**Complexity:** Low

### Task 1.9: Muzzle flash duration (Pistol)

**Spec changes covered:** #44 (partial)
**Files:** `stick-rumble-client/src/shared/weaponConfig.ts` line 123, both `weapon-configs.json` copies
**Action:** Change Pistol `muzzleFlashDuration: 50` → `33`
**Complexity:** Trivial

### Task 1.10: Damage number color

**Spec changes covered:** #35 (partial)
**File:** `stick-rumble-client/src/game/scenes/GameSceneUI.ts` line 379
**Action:** Change non-kill damage number color from `'#ffffff'` → `'#FF4444'` (COLORS.DAMAGE_NUMBER). Adjust timing from 800ms→600ms and float distance from 50px→40px.
**Complexity:** Low

---

## Phase 2: Small Modifications to Existing Files

> Targeted changes to existing methods. 1-2 hours each.

### Task 2.1: Player head-only color distinction

**Spec changes covered:** #1
**File:** `stick-rumble-client/src/game/entities/ProceduralPlayerGraphics.ts` lines 61-121
**Action:**
- Add `headColor: number` and `bodyColor: number` constructor params (replace single `color`)
- Lines 61, 85, 99: Change `this.color` → `this.bodyColor` (0x000000 for all players)
- Lines 118-121: Change `this.color` → `this.headColor` (local 0x2A2A2A, enemy 0xFF0000, dead 0x888888)
**Also:** `PlayerManager.ts` — update caller to pass headColor/bodyColor instead of single color
**Complexity:** Small-Medium
**Tests:** Update `ProceduralPlayerGraphics.test.ts`

### Task 2.2: Crosshair shape — white "+" in circle

**Spec changes covered:** #2, #32
**File:** `stick-rumble-client/src/game/entities/Crosshair.ts` lines 36-57
**Action in `generateReticleTexture()`:**
- Remove cardinal tick marks (lines 44-49)
- Remove red center dot (lines 51-53)
- Add vertical bar: `moveTo(16, 6); lineTo(16, 26)`
- Add horizontal bar: `moveTo(6, 16); lineTo(26, 16)`
**Complexity:** Small
**Tests:** Update `Crosshair.test.ts`

### Task 2.3: Health bar 2-tier thresholds + percentage format

**Spec changes covered:** #11, #12, #22
**File 1:** `stick-rumble-client/src/game/ui/HealthBarUI.ts` lines 82-91
**Action:**
- Replace 3-tier color logic (green>60%/yellow>30%/red) with 2-tier (green≥20%/red<20%)
- Change text format from `"${health}/${maxHealth}"` → `"${Math.round(ratio*100)}%"`
- Add EKG heartbeat icon graphics object to left of bar (new rendering)
**File 2:** `stick-rumble-client/src/game/entities/HealthBar.ts` line 71
**Action:** Apply same 2-tier threshold logic (was always green)
**Complexity:** Medium
**Tests:** Update `HealthBarUI.test.ts`, `HealthBar.test.ts`

### Task 2.4: Ammo counter rework

**Spec changes covered:** #23
**File:** Locate ammo display in `GameSceneUI.ts` or related UI file
**Action:**
- Add crosshair icon (yellow/orange `COLORS.AMMO_READY` when ready; red spinner when reloading)
- Change ammo text color to `COLORS.AMMO_READY` (#E0A030) when ready
- Add "RELOADING..." text in `COLORS.AMMO_RELOADING` (#CC5555) during reload
- Add "INF" display for fist/infinite-ammo weapons
- Hide ammo counter for melee weapons
**Complexity:** Medium
**Tests:** Update relevant ammo display tests

### Task 2.5: Damage screen flash — replace camera.flash with overlay

**Spec changes covered:** #9, #33, #38
**File:** `stick-rumble-client/src/game/scenes/GameSceneUI.ts` lines 86-88, 315-317
**Action:**
- Fill in `createDamageFlashOverlay()` no-op stub (line 86-88) with actual red rectangle
- Replace `showDamageFlash()` body: remove `cameras.main.flash(100, 128, 0, 0)`, add full-viewport `Phaser.GameObjects.Rectangle` at depth 999, `COLORS.DAMAGE_FLASH` alpha 0.35, tween alpha→0 over 300ms
**Note:** `GameScene.ts` already calls `createDamageFlashOverlay()` at line 133 — just needs the no-op filled in.
**Complexity:** Low
**Tests:** Update `GameSceneUI.test.ts`

### Task 2.6: Hit direction indicator timing

**Spec changes covered:** #36 (timing)
**File:** `stick-rumble-client/src/game/scenes/GameSceneUI.ts` lines 436-440
**Action:** Replace simple fade tween with 3-phase: fade-in 100ms → hold 300ms → fade-out 200ms (total ~600ms)
**Complexity:** Low
**Tests:** Update `GameSceneUI.test.ts`

### Task 2.7: Weapon crate visual — yellow circle

**Spec changes covered:** #3
**File:** `stick-rumble-client/src/game/entities/WeaponCrateManager.ts` lines 1-63
**Action:**
- Remove brown rectangle (`sprite`) creation (lines 43-50)
- Replace with `Phaser.GameObjects.Graphics` drawing yellow circle outline (~40px diameter, `COLORS.WEAPON_CRATE`) with small dark cross icon inside
- Update `CrateVisual` interface to use Graphics instead of Rectangle
- Update bobbing tween target from `sprite` → new graphics object
**Complexity:** Medium
**Tests:** Update `WeaponCrateManager.test.ts`

### Task 2.8: Minimap rework — size, shape, colors

**Spec changes covered:** #29 (partial)
**File:** `stick-rumble-client/src/game/scenes/GameSceneUI.ts` lines 459-533
**Action:**
- Line 460: `scale = 0.075` → `MINIMAP.SCALE` (0.106)
- Line 463: `mapSize = 1600 * scale` → `MINIMAP.SIZE` (170)
- Line 471: `fillStyle(0x000000, 0.7)` → `fillStyle(MINIMAP.BG_COLOR, 0.5)`
- Line 472: `fillRect(...)` → `fillCircle(...)` (circular shape)
- Line 475: `lineStyle(2, 0xffffff, 0.5)` → `lineStyle(2, MINIMAP.BORDER_COLOR, 1)` (teal)
- Line 476: `strokeRect(...)` → `strokeCircle(...)`
- Lines 491-492: Update scale references
**Complexity:** Medium
**Tests:** Update minimap tests in `GameSceneUI.test.ts`

---

## Phase 3: New UI Component Classes

> Independent of each other, but all depend on Phase 0 constants. Can be done in parallel.

### Task 3.1: ScoreDisplayUI (new file)

**Spec changes covered:** #24
**New file:** `stick-rumble-client/src/game/ui/ScoreDisplayUI.ts`
**Spec:** 6-digit zero-padded (`String(score).padStart(6, '0')`), monospaced ~28px, white `COLORS.SCORE`, top-right corner, depth 1000.
**Integration:** Instantiate in `GameScene.ts`. Update on `player:kill_credit` in `GameSceneEventHandlers.ts` lines 472-491 (currently only logs). Score = killerXP.
**Complexity:** Simple
**Tests:** Create `ScoreDisplayUI.test.ts`

### Task 3.2: KillCounterUI (new file)

**Spec changes covered:** #25
**New file:** `stick-rumble-client/src/game/ui/KillCounterUI.ts`
**Spec:** `"KILLS: N"`, color `COLORS.KILL_COUNTER` (#FF6666), ~16px, right-aligned, below score display.
**Integration:** Same as ScoreDisplayUI — wire into `player:kill_credit` handler.
**Complexity:** Simple
**Tests:** Create `KillCounterUI.test.ts`

### Task 3.3: ChatLogUI (new file)

**Spec changes covered:** #26
**New file:** `stick-rumble-client/src/game/ui/ChatLogUI.ts`
**Spec:** 300×120px, bottom-left, `#808080` at 70% opacity background, scroll factor 0. System messages `COLORS.CHAT_SYSTEM` (#BBA840) prefixed `[SYSTEM]`. Player messages: name in red/orange, text in white. Font sans-serif 14px. Max ~6 visible lines. Depth 1000.
**Methods:** `addSystemMessage(text)`, `addPlayerMessage(name, text)`
**Complexity:** Medium (similar to KillFeedUI pattern)
**Tests:** Create `ChatLogUI.test.ts`

### Task 3.4: DebugOverlayUI (new file)

**Spec changes covered:** #28
**New file:** `stick-rumble-client/src/game/ui/DebugOverlayUI.ts`
**Spec:** Bright green `COLORS.DEBUG_OVERLAY` (#00FF00), monospaced ~12px. Lines: `FPS: N`, `Update: Nms`, `AI: Nms`, `E: N | B: N`. Below minimap, left side, screen-fixed. Debug flag controlled (not shown in production). Depth 1000.
**Method:** `update(fps, updateTime, aiTime, entityCount, bulletCount)`
**Complexity:** Simple
**Tests:** Create `DebugOverlayUI.test.ts`

### Task 3.5: PickupNotificationUI (new file)

**Spec changes covered:** #31
**New file:** `stick-rumble-client/src/game/ui/PickupNotificationUI.ts`
**Spec:** `"Picked up {WEAPON_NAME}"` in gray (#AAAAAA), center screen, fade out after ~2 seconds. Triggered by `weapon:pickup_confirmed`.
**Integration:** Wire into `weapon:pickup_confirmed` handler in `GameSceneEventHandlers.ts`.
**Complexity:** Simple
**Tests:** Create `PickupNotificationUI.test.ts`

### Task 3.6: "YOU" label + enemy name labels

**Spec changes covered:** #5, #6
**File:** `stick-rumble-client/src/game/entities/ProceduralPlayerGraphics.ts` or `PlayerManager.ts`
**Action:**
- For local player: add `Phaser.GameObjects.Text` "YOU", white bold ~14px, dark drop shadow, positioned at `(player.x, player.y - headRadius - 5px)`
- For enemies: add `Phaser.GameObjects.Text` with player display name, gray/white ~12-14px, same positioning
- Labels move with player each frame
**Dependency:** Player names must be available in server state messages (verify)
**Complexity:** Small
**Tests:** Update `ProceduralPlayerGraphics.test.ts` or `PlayerManager.test.ts`

### Task 3.7: Spawn invulnerability ring rendering

**Spec changes covered:** #4, #19, #52
**File:** `stick-rumble-client/src/game/entities/ProceduralPlayerGraphics.ts`
**Action:** In `draw()` method, add conditional: if `isInvulnerable === true`, draw yellow circle outline (`COLORS.SPAWN_RING`, ~25px radius) around player.
**Dependency:** Task 0.4 (isInvulnerable in PlayerState)
**Complexity:** Small
**Tests:** Update `ProceduralPlayerGraphics.test.ts`

---

## Phase 4: Medium Complexity Features

> Features requiring new rendering logic or significant rework.

### Task 4.1: Crosshair bloom (dynamic size expansion)

**Spec changes covered:** #7, #40
**File:** `stick-rumble-client/src/game/entities/Crosshair.ts` lines 12, 65-76, 154-156
**Action:**
- Remove "No dynamic spread circle" comment (line 12)
- In `update()`: use `_spreadDegrees` and `_isMoving` to adjust sprite scale (base 40px → expanded 60-80px)
- Add `triggerBloom()` method: snap to expanded, tween back to base over 200-300ms
- Update `getCurrentSpreadRadius()` to return actual radius (line 154-156, currently returns 0)
- Wire: call `triggerBloom()` on `projectile:spawn` for local player
**Also:** `GameSceneUI.ts` line 221-231 — pass spread/movement state to crosshair update
**Complexity:** Medium
**Tests:** Update `Crosshair.test.ts`

### Task 4.2: Aim line visual (new feature)

**Spec changes covered:** #8, #39
**Current:** No aim line exists anywhere in codebase.
**Action:** Add `aimLineGraphics: Phaser.GameObjects.Graphics` — thin white line (`COLORS.AIM_LINE` / #FFFFFF) from barrel tip to crosshair/cursor position. Depth 40. Drawn every frame in `preUpdate()` or `update()`, cleared and redrawn. Local player only (enemies may not show).
**File:** `ProceduralPlayerGraphics.ts` (add to draw method) or standalone in `GameScene.ts`
**Need:** `getBarrelPosition()` method if not present
**Complexity:** Medium
**Tests:** Add aim line tests

### Task 4.3: Projectile chevron shape

**Spec changes covered:** #42
**File:** `stick-rumble-client/src/game/entities/ProjectileManager.ts` lines 69-74
**Action:**
- Currently: `this.scene.add.circle()` — always circle
- Replace with: when `shape === 'chevron'`, draw directional triangle polygon pointing in velocity direction
- Use `tracerLength` (~20px) for tracer trail segments
- Update all weapon entries in `weaponConfig.ts` hardcoded defaults with `shape: 'chevron'`
**Also:** Add `projectile` sub-object to both `weapon-configs.json` files for all 6 weapons
**Complexity:** Medium-High (triangle geometry rendering)
**Tests:** Update `ProjectileManager.test.ts`

### Task 4.4: Muzzle flash starburst shape

**Spec changes covered:** #44 (shape)
**File:** `stick-rumble-client/src/game/entities/ProjectileManager.ts` lines 228-252 (`createMuzzleFlash()`)
**Action:** Currently always uses `scene.add.circle()`. When `muzzleFlashShape === 'starburst'`, render small starburst polygon at barrel tip instead.
**Complexity:** Medium
**Tests:** Update `ProjectileManager.test.ts`

### Task 4.5: Death screen overlay rewrite

**Spec changes covered:** #27, #55
**File:** `stick-rumble-client/src/game/scenes/GameSceneSpectator.ts` lines 46-75
**Current:** Shows "Spectating..." + countdown text. No overlay, no stats, no button.
**Required:**
- Dark overlay rectangle (depth 990, 70% alpha black) over full viewport
- "YOU DIED" text: ~72px bold white, centered
- Stats row: trophy icon (yellow/gold) + score (red), skull icon (red) + kill count (white)
- "TRY AGAIN" button: rectangular, thin white border, white text, centered below stats
- On button click: send `player:respawn_request` message
- Dismiss on server `player:respawn` event
**Complexity:** High (substantial rewrite)
**Tests:** Update `GameSceneSpectator.test.ts`

---

## Phase 5: Server-Side & Cross-Cutting

### Task 5.1: Document invulnerability on Respawn (server)

**Spec changes covered:** #60
**File:** `stick-rumble-server/internal/game/` — verify `Respawn()` sets `IsInvulnerable = true`
**Note:** Server code at `player.go` lines 54-55 already has the fields. Verify the broadcast includes them. If not, add to the broadcast payload.
**Complexity:** Low (likely already working, just verify)

### Task 5.2: Reload progress tracking (client-side)

**Spec changes covered:** #57
**File:** `stick-rumble-client/src/game/scenes/GameSceneUI.ts` reload progress bar area
**Action:** Verify client-side timestamp-based progress works: on first `isReloading: true`, record `reloadStartTime`, compute `progress = (now - reloadStartTime) / weapon.reloadDuration` each frame.
**Also:** Reload progress bar should be world-space (above player, ~60px wide, white fill) per spec change #30 — currently may be screen-fixed at (10, 70).
**Complexity:** Low-Medium

### Task 5.3: Wire all new UI components into GameScene

**Spec changes covered:** #21 (HUD layout), #50
**File:** `stick-rumble-client/src/game/scenes/GameScene.ts` (~lines 118-136)
**Action:** Import and instantiate all new UI classes (ScoreDisplayUI, KillCounterUI, DebugOverlayUI, ChatLogUI, PickupNotificationUI). Wire event handlers in GameSceneEventHandlers.ts.
**Dependency:** All Phase 3 tasks complete
**Complexity:** Medium (integration work)

---

## Spec Change Coverage Matrix

| Spec # | Phase.Task | Description |
|--------|-----------|-------------|
| #1 | 2.1 | Player head-only color |
| #2 | 2.2 | Crosshair white "+" shape |
| #3 | 2.7 | Weapon crate yellow circle |
| #4 | 3.7 | Spawn invulnerability ring |
| #5 | 3.6 | "YOU" label |
| #6 | 3.6 | Enemy name labels |
| #7 | 4.1 | Crosshair bloom |
| #8 | 4.2 | Aim line visual |
| #9 | 2.5 | Damage screen flash |
| #10 | 1.3 | World-space health bar bg |
| #11 | 2.3 | HUD health bar text format |
| #12 | 2.3 | Health bar 2-tier thresholds |
| #13 | 1.4 | Blood effect color |
| #14 | 1.5 | Hit indicator color |
| #15 | 1.6 | Muzzle flash color |
| #16 | 1.7 | Crate respawn glow |
| #17 | 1.1 | Background color |
| #18 | 1.2 | Grid line color |
| #19 | 3.7 | Spawn ring (player.md) |
| #20 | 2.5 | Damage flash (player.md) |
| #21 | 5.3 | HUD layout diagram |
| #22 | 2.3 | Health bar UI rework |
| #23 | 2.4 | Ammo counter rework |
| #24 | 3.1 | Score display |
| #25 | 3.2 | Kill counter |
| #26 | 3.3 | Chat log |
| #27 | 4.5 | Death screen overlay |
| #28 | 3.4 | Debug overlay |
| #29 | 2.8 | Minimap rework |
| #30 | 5.2 | Reload progress bar |
| #31 | 3.5 | Weapon pickup notification |
| #32 | 2.2 | Crosshair (ui.md) |
| #33 | 2.5 | Damage flash mechanism |
| #34 | 0.2 | HEALTH_BAR_WIDTH naming |
| #35 | 1.10 | Damage number color/timing |
| #36 | 1.5 + 2.6 | Hit indicator color + timing |
| #37 | 1.4 | Blood particles color/count |
| #38 | 2.5 | Damage flash (hit-detection) |
| #39 | 4.2 | Aim line (shooting.md) |
| #40 | 4.1 | Crosshair bloom (shooting) |
| #41 | — | No code change needed |
| #42 | 0.5 + 4.3 | Projectile chevron shape |
| #43 | 1.8 | Pistol tracer color |
| #44 | 0.5 + 1.9 + 4.4 | Muzzle flash duration/shape |
| #45 | 0.1 | COLORS constants |
| #46 | 0.2 | HEALTH_BAR_WIDTH rename |
| #47 | 0.2 | MINIMAP constants |
| #48 | 0.3 | GameConfig bg color |
| #49 | 1.1 | Arena fill (architecture) |
| #50 | 5.3 | HUD components (architecture) |
| #51 | 2.1 | Player colors (architecture) |
| #52 | 3.7 | Spawn ring (architecture) |
| #53 | 2.8 | renderArena grid (architecture) |
| #54 | 0.4 | PlayerState invulnerability |
| #55 | 4.5 | GameSceneSpectator (architecture) |
| #56 | 0.4 | isInvulnerable in messages |
| #57 | 5.2 | Reload progress tracking |
| #58 | 3.1 | Score=XP mapping |
| #59 | — | Field name mismatch (doc-only, see messages.md) |
| #60 | 5.1 | Server invulnerability on respawn |

---

## Worker Task Sizing (for loop.sh)

Each task below = one commit. Grouped for a Sonnet worker:

**Commit 1:** Tasks 0.1-0.5 (Foundation — constants, config, interfaces)
**Commit 2:** Tasks 1.1-1.10 (All trivial one-line color/value fixes)
**Commit 3:** Task 2.1 (Player head-only color distinction)
**Commit 4:** Task 2.2 (Crosshair white "+" shape)
**Commit 5:** Task 2.3 (Health bar 2-tier + percentage format)
**Commit 6:** Task 2.4 (Ammo counter rework)
**Commit 7:** Task 2.5 + 2.6 (Damage flash overlay + hit indicator timing)
**Commit 8:** Task 2.7 (Weapon crate yellow circle)
**Commit 9:** Task 2.8 (Minimap rework)
**Commit 10:** Tasks 3.1 + 3.2 (ScoreDisplayUI + KillCounterUI)
**Commit 11:** Task 3.3 (ChatLogUI)
**Commit 12:** Tasks 3.4 + 3.5 (DebugOverlayUI + PickupNotificationUI)
**Commit 13:** Tasks 3.6 + 3.7 ("YOU"/name labels + spawn ring)
**Commit 14:** Task 4.1 (Crosshair bloom)
**Commit 15:** Task 4.2 (Aim line visual)
**Commit 16:** Tasks 4.3 + 4.4 (Projectile chevron + muzzle starburst)
**Commit 17:** Task 4.5 (Death screen overlay rewrite)
**Commit 18:** Tasks 5.1-5.3 (Server verify + reload bar + wire all UI)

**Total: ~18 commits**

---

## Risk Areas

1. **weapon-configs.json dual copies** — root `weapon-configs.json` and `stick-rumble-client/public/weapon-configs.json` must stay in sync. Both need `projectile` sub-object added.

2. **ProceduralPlayerGraphics constructor signature change** (Task 2.1) — changing from single `color` to `headColor`/`bodyColor` propagates to `PlayerManager.ts` and all test files that instantiate player graphics.

3. **GameSceneUI.ts is a large file** — multiple tasks touch it (damage flash, hit indicators, minimap, damage numbers). If parallelizing workers, assign all GameSceneUI changes to one worker to avoid merge conflicts.

4. **Crosshair.ts overhaul** — Tasks 2.2 and 4.1 both modify `Crosshair.ts` (shape change + bloom). Do them sequentially (shape first, then bloom).

5. **Death screen rewrite** (Task 4.5) is the highest-risk item — complete rewrite of `GameSceneSpectator.ts` and introduces `player:respawn_request` client-to-server message. Verify server handles this message type.

6. **Missing player names in server messages** — Task 3.6 (enemy labels) requires display names from server state. Verify `player:move` broadcasts include player names, or add them.

---

## Rules for Workers

1. **Read before editing** — always read the target file AND the relevant spec section before making changes
2. **One commit per task group** — follow the commit sizing above
3. **Run tests after each commit** — `make test-client` must pass
4. **Import COLORS** — use `COLORS.*` constants, not inline hex values
5. **Spec is truth** — when plan and spec disagree, spec wins
6. **Update existing tests** — don't just add new tests; update existing assertions that check old values (e.g., old colors)
7. **Two JSON files** — always update BOTH `weapon-configs.json` copies

---

## Implementation Results

> Completed: 2026-02-18

### Stats

| Metric | Value |
|--------|-------|
| **Files changed** | 50 |
| **Lines added** | 3,778 |
| **Lines removed** | 878 |
| **Feature commits** | 21 (19 task + 1 post-merge fix + 1 wiring) |
| **Tests passing** | 1,632 |
| **Lint errors** | 0 |
| **Typecheck errors** | 0 |
| **Spec changes covered** | 60/60 |

### Timing

| Phase | Wall clock | Notes |
|-------|-----------|-------|
| Planning + team setup | ~10 min | Task breakdown, branch creation, dependency graph |
| Foundation (Phase 0+1) | ~8 min | 1 worker, sequential |
| Parallel workers (Phase 2-4) | ~35 min | 3 workers simultaneous |
| Rate limit downtime | ~2.5 hrs | Workers idled 14:32–17:08 |
| Worker respawn + finish | ~10 min | 2 workers, 1 task each |
| Merge + wiring (Phase 5) | ~18 min | 1 Opus worker |
| Test quality verification | ~3 min | 1 Opus worker |
| **Total productive time** | **~85 min** | Excludes rate limit downtime |

### Team Composition

| Role | Model | Tasks | Commits | Respawns |
|------|-------|-------|---------|----------|
| **Lead** (orchestrator) | Opus 4.6 | Coordination, server verification (5.1/5.2), monitoring | — | — |
| **foundation** | Sonnet 4.6 | Phase 0 constants + Phase 1 trivial fixes | 2 | 0 |
| **scene-ui** | Sonnet 4.6 | HealthBarUI, ammo counter, damage flash, hit indicators, minimap, reload bar | 6 | 2 (worktree migration, rate limit) |
| **entities** | Sonnet 4.6 | Player colors, crosshair, crates, bloom, aim line, projectiles | 6 | 2 (worktree migration, rate limit) |
| **new-ui** | Sonnet 4.6 | 5 new UI components, death screen, labels, spawn ring | 5 | 0 |
| **merge-shepherd** | Opus 4.6 | Branch merging, conflict resolution, Task 5.3 UI wiring | 2 | 0 |
| **test-verifier** | Opus 4.6 | Test quality audit (spawned test-quality-verifier subagent) | 0 (no fixes needed) | 0 |
| **server-verify** | Sonnet 4.6 | Server code research for Tasks 5.1/5.2 | — | 0 |

**Total agents spawned:** 8 (+ 4 respawns = 12 agent instances)
**Model mix:** 5 Sonnet workers, 3 Opus workers (lead, merge-shepherd, test-verifier)

### Lessons Learned

1. **Worktrees are essential for multi-agent work.** Workers sharing one working directory caused branch checkout stomping and cross-contamination (commits landing on wrong branches). Switching to `git worktree` per worker eliminated the issue. Future jobs should create worktrees *before* spawning workers.

2. **Rate limits still burn time.** ~2.5 hours of idle time from rate limiting. Workers went into idle-spam loops. Mitigation: detect rate limits earlier and pause instead of retrying.

3. **Worker respawns are cheap.** Because each task = one commit, respawning a worker after rate limits or context exhaustion only risks losing the current in-progress task. Committed work is safe on the branch.

4. **File ownership prevents merge conflicts.** Assigning all GameSceneUI.ts changes to one worker (scene-ui) and all entity files to another (entities) meant the only real merge conflict was the expected ProceduralPlayerGraphics constructor change.

5. **Sonnet handled the "hardest" task fine.** The death screen rewrite (Task 4.5, flagged as highest risk) was completed by Sonnet without needing Opus escalation.

6. **Opus for merging was the right call.** The ProceduralPlayerGraphics conflict required understanding both the headColor/bodyColor refactor and the label/ring additions — Opus resolved it cleanly.
