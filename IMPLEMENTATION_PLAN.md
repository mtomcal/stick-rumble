# Pre-BMM Visual Systems Implementation Plan

> Bring code into compliance with specs v1.2.0 / v2.0.0 (commit c7dd8ef).
> Organized by system. Each system lists spec requirements, current code state, and concrete changes.

---

## Overview

The specs were updated to port visual systems from the pre-BMM (before-multiplayer) prototype. The code still reflects the old designs. This plan brings the code into compliance across **7 work systems** spanning both client and server.

### Scope Summary

| # | System | Server Changes | Client Changes | New Files | Priority |
|---|--------|---------------|----------------|-----------|----------|
| 1 | Melee Constants & Visuals | Yes (ranges, arc) | Yes (arc rendering, swing tween) | No | High |
| 2 | Aim Sway | No | Yes (new system) | Maybe | High |
| 3 | Death & Damage Feedback | No | Yes (corpse, blood, healing particles) | No | High |
| 4 | Crosshair & Hit Feedback | No | Yes (reticle, hit markers, damage numbers) | Maybe | Medium |
| 5 | Camera Effects | No | Yes (flash, shake) | No | Medium |
| 6 | Gun Recoil & Reload | No | Yes (weapon kickback, reload pulse) | No | Medium |
| 7 | Arena & HUD (Floor Grid, Minimap) | No | Yes (new systems) | Maybe | Low |

---

## Comprehensive Implementation Checklist

### Validation Errata

The following discrepancies were found between this plan and the spec diff (c7dd8ef). Address during implementation:

- **RenderedPlayer interface**: Spec adds `lastDamageTime?: number` and `lastDamageSourceAngle?: number` fields — needed for blood particles and hit indicators
- **Hit marker tween**: Spec includes scale-down (`scale: marker.scale * 0.5`) during 150ms fade — not just alpha fade
- **Hit indicator tween**: Spec scales indicators to 1.5× while fading — not just alpha fade
- **Damage number depth**: Should be set to 1000 (from `constants.md`)
- **Healing particle spread**: Spec table says ±25px but code gives ±12.5px — use `(Math.random() - 0.5) * 50` for ±25px per table
- **Camera shake**: Systems 1 and 5 both describe `shake(50, 0.001)` — these are the same effect triggered from melee hit AND ranged hit contexts

---

### Phase 1: Foundation Constants

#### System 1 — Server: Melee Range & Arc Values

> **Current state**: Bat=64px, Katana=80px, Arc=90° in both `weapon_factory.go` and `weapon_config.go`.

- [ ] **weapon_factory.go — Bat range**: Change `Range: 64` → `Range: 90`
- [ ] **weapon_factory.go — Katana range**: Change `Range: 80` → `Range: 110`
- [ ] **weapon_factory.go — Bat arc**: Change `ArcDegrees: 90` → `ArcDegrees: 80`
- [ ] **weapon_factory.go — Katana arc**: Change `ArcDegrees: 90` → `ArcDegrees: 80`
- [ ] **weapon_config.go**: Apply same changes if values are duplicated
- [ ] **Server tests pass**: `make test-server` — melee range/arc detection still works
- [ ] **Spec validation**: Verify against `constants.md` line 217 (Bat=90), line 228 (Katana=110), `melee.md` line 1165 (both ranges), `weapons.md` lines 2330-2331. Arc 80° matches `constants.md` and `melee.md` ±0.7 rad
- [ ] **Assertion quality**: Server tests assert exact range/arc values (e.g., `assert.Equal(t, 90, bat.Range)`), not just `!= 0` or `require.NotNil`
- [ ] **Coverage gate**: `go test ./internal/game/... -cover` — weapon_factory.go and weapon_config.go ≥90% statement coverage

#### System 1 — Client: Melee Range & Arc Values

> **Current state**: Same stale values (64/80/90) in both `weaponConfig.ts` and `weapon-configs.json`.

- [ ] **weaponConfig.ts — Bat**: range=90, arc=80
- [ ] **weaponConfig.ts — Katana**: range=110, arc=80
- [ ] **weapon-configs.json — Bat**: range=90, arc=80
- [ ] **weapon-configs.json — Katana**: range=110, arc=80
- [ ] **Client tests pass**: `make test-client`
- [ ] **Spec validation**: Verify client values match server values exactly: Bat range=90, Katana range=110, both arc=80. Cross-check `weaponConfig.ts` AND `weapon-configs.json` — no stale values (64, 80, 90°) remain
- [ ] **Assertion quality**: Tests assert exact numeric values (`expect(bat.range).toBe(90)`, `expect(katana.arcDegrees).toBe(80)`), not `toBeDefined()` or `toBeTruthy()`
- [ ] **Coverage gate**: `npm run test:unit:coverage` — weaponConfig.ts ≥90% statements/lines/functions

---

### Phase 2: Core Visual Overhauls

#### System 1 — Client: Melee Arc Visual (MeleeWeapon.ts)

> **Current state**: Per-weapon colors (brown/silver), fill+stroke arc, 200ms 4-frame animation.

- [ ] **Remove per-weapon colors**: No more brown (bat) / silver (katana) — all arcs use 0xFFFFFF white
- [ ] **Remove fill rendering**: Delete `fillStyle` / `fillPath` — stroke only
- [ ] **Stroke width**: Change from 3px to 2px
- [ ] **Stroke alpha**: Set to 0.8
- [ ] **Remove 4-frame animation**: Delete old frame-based animation approach
- [ ] **Add alpha fade tween**: `tweens.add({ targets: graphics, alpha: 0, duration: 200, onComplete: destroy })`
- [ ] **Add weapon container rotation tween**: `angle: { from: container.angle - 45, to: container.angle + 60 }, duration: 100, yoyo: true`
- [ ] **Add camera shake on melee hit**: `cameras.main.shake(50, 0.001)`
- [ ] **Test TS-MELEE-013**: White stroke-only arc renders correctly
- [ ] **Test TS-MELEE-015**: Weapon container rotation tween works
- [ ] **Test TS-GFX-013**: Melee arc renders as white stroke-only
- [ ] **Spec validation**: Verify against `constants.md` lines 246-254 — color=0xFFFFFF, strokeWidth=2, strokeAlpha=0.8, fadeDuration=200, swingFrom=-45°, swingTo=+60°, swingDuration=100ms, yoyo=true, shakeDuration=50ms, shakeIntensity=0.001. Confirm NO fill rendering, NO per-weapon colors
- [ ] **Assertion quality**: Tests verify exact color (`toHaveBeenCalledWith(2, 0xFFFFFF, 0.8)`), exact tween params (`duration: 200`, `angle: {from: -45, to: 60}`), not bare `toHaveBeenCalled()` without args
- [ ] **Assertion quality**: No `toBeDefined()` on graphics objects — assert specific draw calls with exact stroke width (2), alpha (0.8), and arc angle (80° / ±0.7 rad)
- [ ] **Coverage gate**: MeleeWeapon.ts ≥90% statements/lines/functions in coverage report
- [ ] **Visual test**: `make test-visual` — read screenshots to verify white arc appearance

#### System 3a — Client: Death Corpse (PlayerManager.ts)

> **Current state**: `PlayerManager.ts` sets dead player color to 0x888888 (gray). No splayed corpse.

- [ ] **Hide normal player graphics** on death state detection
- [ ] **Create splayed corpse Graphics object**: 4 limbs at ±0.5 and ±2.5 rad from rotation
- [ ] **Limb stroke**: 3px, 20px length
- [ ] **Head circle**: 10px radius, offset 25px along rotation axis
- [ ] **Color**: 0x444444 (dark gray)
- [ ] **Depth**: Set to 5 (below live players at 50)
- [ ] **Fade tween**: `delay: 5000, duration: 2000, alpha: 0, onComplete: destroy`
- [ ] **Test TS-GFX-011**: Death corpse renders with splayed limbs
- [ ] **Test TS-GFX-024**: Death corpse fade timing (5s visible + 2s fade)
- [ ] **Spec validation**: Verify against `graphics.md` lines 666-674 — 4 limb angles exactly [+0.5, -0.5, +2.5, -2.5] rad, and `constants.md` lines 290-297 — all 8 constants match
- [ ] **Assertion quality**: Tests assert exact limb angles (±0.5, ±2.5 rad), exact color (0x444444), exact delay/duration args — not bare `toHaveBeenCalled()` on `lineStyle`/`lineTo`
- [ ] **Coverage gate**: Death corpse rendering code path in PlayerManager.ts ≥90% statements/lines/functions
- [ ] **Visual test**: Read screenshot to confirm corpse appearance

#### System 5 — Client: Camera Effects (GameSceneUI.ts, ScreenShake.ts)

> **Current state**: Damage flash is a red overlay rectangle at 0.5 alpha, 200ms fade in `GameSceneUI.ts`. Camera shake in `ScreenShake.ts` uses per-weapon intensities (100-150ms, 0.005-0.012).

- [ ] **Remove damageOverlay rectangle**: Delete rectangle creation and tween
- [ ] **Add camera flash on damage received**: `cameras.main.flash(100, 128, 0, 0)`
- [ ] **Normalize camera shake**: On dealing damage (hit:confirmed) → `cameras.main.shake(50, 0.001)`
- [ ] **Evaluate per-weapon shake**: Decide whether old per-weapon values in ScreenShake.ts should be replaced with uniform 50ms/0.001
- [ ] **Test TS-UI-013**: Camera flash on damage received
- [ ] **Test TS-UI-017**: Camera shake on dealing damage
- [ ] **Spec validation**: Verify flash args match `constants.md` lines 303-310 exactly: `flash(100, 128, 0, 0)` — duration 100ms, RGB (128, 0, 0). Verify shake matches lines 305-306: `shake(50, 0.001)`
- [ ] **Assertion quality**: Tests assert `flash` called with exact 4 args `(100, 128, 0, 0)`, `shake` called with exact `(50, 0.001)` — not bare `cameras.main.flash.toHaveBeenCalled()`
- [ ] **Coverage gate**: GameSceneUI.ts damage flash path + ScreenShake.ts shake path ≥90% statements/lines/functions

---

### Phase 3: New Client Systems

#### System 2 — Client: Aim Sway (PlayerManager.ts + weapon/shooting)

> **Current state**: Not implemented. Server uses raw aimAngle from client. No oscillation.
> **Design decision**: Client-only. Sway computed in client update loop, server receives sway-affected angle via `input:state`. No server changes needed.

- [ ] **Add sway state**: `swayTime: number = 0`, `aimSway: number = 0` per player
- [ ] **Compute sway each frame**: Detect speed > 10px/s for moving vs idle
- [ ] **Moving params**: speed=0.008 rad/ms, magnitude=±0.15 rad
- [ ] **Idle params**: speed=0.002 rad/ms, magnitude=±0.03 rad
- [ ] **Formula**: `aimSway = (sin(time * speed) + sin(time * speed * 0.7)) * magnitude`
- [ ] **Apply to weapon rotation**: `weaponGraphics.setRotation(aimAngle + aimSway)`
- [ ] **Apply to projectile angle**: Fire with `aimAngle + aimSway` sent to server
- [ ] **Apply to barrel position**: Include sway offset in barrel calculation
- [ ] **Test TS-SHOOT-013**: Aim sway affects projectile trajectory
- [ ] **Test TS-GFX-019**: Aim sway visual oscillation visible
- [ ] **Spec validation**: Verify formula matches `constants.md` lines 369-376 exactly: speed 0.008/0.002, magnitude 0.15/0.03, threshold 10 px/s, composite sine `(sin(t*s) + sin(t*s*0.7)) * mag`. Verify `shooting.md` lines 1490-1518 — sway applied to both visual AND trajectory
- [ ] **Assertion quality**: Tests compute expected sway output for known time/speed inputs using `toBeCloseTo()` with ≥2 decimal precision — not just `expect(sway).not.toBe(0)` or `toBeDefined()`
- [ ] **Assertion quality**: Trajectory test verifies fired angle equals `aimAngle + computedSway` with `toBeCloseTo()`, not just "angle changed"
- [ ] **Coverage gate**: Aim sway computation + application code paths ≥90% statements/lines/functions

#### System 3b — Client: Blood Particles (GameSceneEventHandlers.ts)

> **Current state**: Not implemented. HitEffectManager exists but no blood particles.

- [ ] **Add RenderedPlayer fields**: `lastDamageTime?: number`, `lastDamageSourceAngle?: number`
- [ ] **On player:damaged event**: Create 5 circles at victim position
- [ ] **Color**: 0xCC0000 (dark red)
- [ ] **Radius**: Random 2-5px per particle
- [ ] **Speed**: Random 50-150 px/s, direction away from damage source ±0.5 rad
- [ ] **Drag**: 200 px/s²
- [ ] **Fade + shrink tween**: alpha and scale to 0 over 500ms
- [ ] **Test TS-GFX-015**: Blood particles spawn on damage
- [ ] **Spec validation**: Verify against `constants.md` lines 262-269 — all 8 blood particle constants match: count=5, color=0xCC0000, minRadius=2, maxRadius=5, minSpeed=50, maxSpeed=150, drag=200, duration=500. Verify direction spread ±0.5 rad per `graphics.md` line 713
- [ ] **Assertion quality**: Tests assert exactly 5 particles created (`toHaveBeenCalledTimes(5)` or array length check), assert color `0xCC0000` in `fillStyle` call, assert tween duration is exactly 500 — not `toBeGreaterThan(0)` on particle count
- [ ] **Coverage gate**: Blood particle creation + tween code path ≥90% statements/lines/functions

#### System 3c — Client: Healing Particles (PlayerManager.ts or HealthBarUI)

> **Current state**: `HealthBarUI.ts` only pulses health bar alpha. No floating particles.

- [ ] **Detect isRegenerating state**: Check each update tick
- [ ] **15% chance per tick**: `Math.random() > 0.85`
- [ ] **Create green circle**: 0x00FF00, 2px radius
- [ ] **Random offset**: ±25px from player center (use `(Math.random() - 0.5) * 50`)
- [ ] **Float-up tween**: y -= 20, alpha: 0, duration: 600ms, onComplete: destroy
- [ ] **Test TS-GFX-016**: Healing particles appear during regen
- [ ] **Spec validation**: Verify against `constants.md` lines 277-282 — color=0x00FF00, radius=2, chance=0.15, spread=25, floatDistance=20, duration=600. Note: use `(Math.random() - 0.5) * 50` for ±25px (spec code has ±12.5px bug)
- [ ] **Assertion quality**: Tests assert exact color `0x00FF00` in `fillStyle`, exact tween params `{y: '-=20', alpha: 0, duration: 600}`, circle radius exactly 2 — not `toBeTruthy()` on particle object
- [ ] **Coverage gate**: Healing particle creation + probability gate code path ≥90% statements/lines/functions

#### System 6a — Client: Gun Recoil Visual (PlayerManager.ts)

> **Current state**: `ScreenShake.ts` only does camera shake, no weapon container movement.

- [ ] **Add recoilOffset property**: `recoilOffset: number = 0` per weapon
- [ ] **On fire event**: Tween recoilOffset to -6px (default) or -10px (shotgun)
- [ ] **Tween config**: 50ms duration, yoyo: true
- [ ] **Apply offset**: `cos(rotation) * recoilOffset`, `sin(rotation) * recoilOffset` in weapon position update
- [ ] **Test TS-GFX-018**: Gun recoil on ranged fire
- [ ] **Spec validation**: Verify against `constants.md` lines 359-361 — default=-6, shotgun=-10, duration=50, yoyo=true. Verify offset formula matches `graphics.md` lines 818-820: `x += cos(rotation) * recoilOffset`, `y += sin(rotation) * recoilOffset`
- [ ] **Assertion quality**: Tests assert tween target value is exactly -6 (default) or -10 (shotgun), duration exactly 50, yoyo is `true` — not bare `toHaveBeenCalled()` on `tweens.add`
- [ ] **Coverage gate**: Recoil tween creation + offset application code path ≥90% statements/lines/functions

---

### Phase 4: Hit Feedback Overhaul

#### System 4a — Client: Crosshair → Reticle Texture (Crosshair.ts)

> **Current state**: `Crosshair.ts` draws white + sign (10px, 5px gap) + red spread circle (radius = spread * 2px/deg).

- [ ] **Generate reticle texture**: `make.graphics()` + `generateTexture('reticle', 32, 32)`
- [ ] **Ring**: radius 10, 2px white stroke
- [ ] **4 cardinal tick marks**: 6px each
- [ ] **Red center dot**: 0xFF0000, radius 2
- [ ] **Replace procedural crosshair**: Use Sprite with 'reticle' texture
- [ ] **Remove spread circle logic**: Delete dynamic spread rendering entirely
- [ ] **Set depth 100, alpha 0.8**
- [ ] **Position at cursor/aim point each frame**
- [ ] **Test TS-GFX-023**: Crosshair reticle texture renders correctly
- [ ] **Spec validation**: Verify against `constants.md` lines 318-325 — size=32×32, ringRadius=10, ringStroke=2, dotColor=0xFF0000, dotRadius=2, tickLength=6, depth=100, alpha=0.8. Confirm spread circle completely removed (no `spread` or `spreadRadius` references in Crosshair.ts)
- [ ] **Assertion quality**: Tests assert `generateTexture` called with exact `('reticle', 32, 32)`, assert `strokeCircle` with exact `(16, 16, 10)`, assert `fillCircle` with exact `(16, 16, 2)` and color `0xFF0000`, depth exactly 100, alpha exactly 0.8 — not bare `toHaveBeenCalled()`
- [ ] **Coverage gate**: Crosshair.ts ≥90% statements/lines/functions
- [ ] **Visual test**: Read screenshot to confirm reticle appearance

#### System 4b — Client: Hit Marker → X Texture (GameSceneUI.ts)

> **Current state**: `GameSceneUI.ts` draws 4 white lines forming + pattern at screen center, 200ms fade.

- [ ] **Generate hitmarker texture**: 20×20, two diagonal lines forming X, white 3px stroke
- [ ] **Replace line-based hit marker**: Use sprite instead of 4 procedural lines
- [ ] **Normal hit**: White tint, scale 1.2×
- [ ] **Kill hit**: Red (0xFF0000) tint, scale 2.0×
- [ ] **Position at reticle**: Not screen center
- [ ] **Fade tween**: 150ms (not 200ms), include scale-down to `marker.scale * 0.5`
- [ ] **Test TS-UI-014**: Hit marker normal variant
- [ ] **Test TS-UI-015**: Hit marker kill variant
- [ ] **Spec validation**: Verify against `constants.md` lines 345-350 — size=20×20, stroke=3, normalScale=1.2, killScale=2.0, killColor=0xFF0000, fadeDuration=150. Verify scale-down to `marker.scale * 0.5` per `ui.md` tween code. Verify position is at reticle per `ui.md` line 1981
- [ ] **Assertion quality**: Tests assert normal scale exactly 1.2, kill scale exactly 2.0, kill tint exactly 0xFF0000, tween duration exactly 150 (not 200), scale end value is `initialScale * 0.5` — not bare `expect(marker).toBeDefined()` or `toHaveBeenCalled()`
- [ ] **Coverage gate**: Hit marker creation + variant branching code path ≥90% statements/lines/functions

#### System 4c — Client: Damage Number Variants (GameSceneUI.ts)

> **Current state**: `GameSceneUI.ts` always renders red, 24px, 3px stroke, 1000ms. No variants.

- [ ] **Accept variant params**: `isKill` and `isLocal` in `showDamageNumber()`
- [ ] **Normal hit**: White (#FFFFFF), 16px font
- [ ] **Kill hit**: Red (#FF0000), 24px font
- [ ] **Remote (non-local)**: White 16px, scale 0.7×, alpha 0.8
- [ ] **Stroke thickness**: Change 3px → 2px black
- [ ] **Duration**: Change 1000ms → 800ms
- [ ] **Float distance**: 50px (unchanged)
- [ ] **Depth**: Set to 1000
- [ ] **Test TS-UI-016**: Damage number variants render correctly
- [ ] **Spec validation**: Verify against `constants.md` lines 423-431 — normalColor=#FFFFFF, normalSize=16, killColor=#FF0000, killSize=24, remoteScale=0.7, remoteAlpha=0.8, strokeWidth=2, strokeColor=#000000, depth=1000. Verify duration=800 and float=50 per `constants.md` lines 237-238
- [ ] **Assertion quality**: Test each variant separately — normal asserts color `#FFFFFF` and fontSize `16px`, kill asserts color `#FF0000` and fontSize `24px`, remote asserts scale 0.7 and alpha 0.8. Assert stroke exactly `2px` not `3px`. Assert tween duration exactly 800 not 1000. Assert depth exactly 1000
- [ ] **Coverage gate**: `showDamageNumber()` all 3 variant branches ≥90% statements/lines/functions (branch coverage critical here)

#### System 4d — Client: Directional Hit Indicators (GameSceneUI.ts or new utility)

> **Current state**: Not implemented.

- [ ] **Generate chevron texture**: 16×16 `hit_indicator`
- [ ] **Position**: 60px from player center, pointing toward damage source/target
- [ ] **Outgoing (hit:confirmed)**: White, 200ms fade, scale to 1.5×; red on kill
- [ ] **Incoming (player:damaged for local)**: Red, 400ms fade, scale to 1.5×
- [ ] **Depth**: 1001
- [ ] **Test TS-GFX-021**: Directional hit indicator (outgoing)
- [ ] **Test TS-GFX-022**: Directional hit indicator (incoming)
- [ ] **Spec validation**: Verify against `constants.md` lines 333-337 — size=16×16, distance=60, outgoingDuration=200, incomingDuration=400, depth=1001. Verify scale-up to 1.5× per `graphics.md` lines 905, 912. Verify incoming is always red, outgoing is white (red on kill)
- [ ] **Assertion quality**: Tests assert outgoing tween duration exactly 200, incoming tween duration exactly 400, scale target exactly 1.5, depth exactly 1001, distance from player center exactly 60px. Assert incoming tint is always red regardless of kill state. No bare `toHaveBeenCalled()` on sprite creation
- [ ] **Coverage gate**: Hit indicator outgoing + incoming + kill variant branches ≥90% statements/lines/functions

---

### Phase 5: Polish & New Features

#### System 6b — Client: Reload Animation Pulse (PlayerManager.ts)

> **Current state**: `GameSceneUI.ts` shows progress bar + circular arc + "RELOAD!" text. No weapon container pulse.

- [ ] **On reload start**: Add tween to weapon container
- [ ] **Alpha pulse**: 1 → 0.5 → 1
- [ ] **Scale pulse**: 1 → 0.8 → 1
- [ ] **Timing**: 200ms per pulse, yoyo: true, repeat: 2 (3 total pulses)
- [ ] **On complete**: Reset alpha=1, scaleX=1, scaleY=1
- [ ] **Keep existing reload UI**: Progress bar, circle, text remain — this ADDS the weapon pulse
- [ ] **Test TS-GFX-020**: Reload animation pulses
- [ ] **Spec validation**: Verify against `constants.md` lines 385-388 — alpha=0.5, scaleX=0.8, scaleY=0.8, duration=200, yoyo=true, repeat=2. Verify reset on complete per `graphics.md` lines 863-866
- [ ] **Assertion quality**: Tests assert tween config has alpha exactly 0.5, scaleX/scaleY exactly 0.8, duration exactly 200, repeat exactly 2, yoyo is `true`. Assert onComplete resets alpha to 1 and scale to 1 — not bare `tweens.add.toHaveBeenCalled()`
- [ ] **Coverage gate**: Reload pulse tween creation + completion handler ≥90% statements/lines/functions

#### System 6c — Client: Wall Spark (GameScene.ts or ShootingManager)

> **Current state**: Not implemented.

- [ ] **Check barrel overlap**: Before creating bullet client-side, test if barrel position overlaps wall geometry
- [ ] **Spark visual**: Yellow circle (0xFFFF00), 3px radius
- [ ] **Tween**: Scale 1→2, alpha fade over 100ms
- [ ] **Skip bullet creation**: No bullet created when barrel is inside wall
- [ ] **Test TS-GFX-017**: Wall spark on obstructed barrel
- [ ] **Spec validation**: Verify against `graphics.md` lines 778-790 — color=0xFFFF00, radius=3, scaleEnd=2, duration=100. Verify bullet suppression: no projectile created when barrel is obstructed
- [ ] **Assertion quality**: Tests assert spark color exactly 0xFFFF00, radius exactly 3, tween scale target exactly 2, tween duration exactly 100. Assert bullet creation was NOT called (`not.toHaveBeenCalled()` or `toHaveBeenCalledTimes(0)`) when barrel is in wall
- [ ] **Coverage gate**: Wall detection + spark creation + bullet suppression code path ≥90% statements/lines/functions

#### System 7a — Client: Floor Grid (GameScene.ts)

> **Current state**: `GameScene.ts` only draws background rectangle and border. No grid.

- [ ] **Draw in create()**: After background rectangle
- [ ] **Grid spacing**: 100px covering entire arena
- [ ] **Line style**: 1px, color 0xB0BEC5, alpha 0.5
- [ ] **Draw vertical lines**: `for x = 0 to ARENA.WIDTH step 100`
- [ ] **Draw horizontal lines**: `for y = 0 to ARENA.HEIGHT step 100`
- [ ] **Depth**: -1 (below everything)
- [ ] **Test TS-ARENA-013**: Floor grid renders at correct depth and spacing
- [ ] **Spec validation**: Verify against `constants.md` lines 396-399 and `arena.md` lines 133-137 — spacing=100, color=0xB0BEC5, alpha=0.5, lineWidth=1, depth=-1. Verify grid covers full arena (lines from 0 to ARENA.WIDTH/HEIGHT)
- [ ] **Assertion quality**: Tests assert `lineStyle` called with exact `(1, 0xB0BEC5, 0.5)`, assert `setDepth(-1)`, assert correct number of vertical lines (`ARENA.WIDTH / 100 + 1`) and horizontal lines (`ARENA.HEIGHT / 100 + 1`) — not just `graphics.strokePath.toHaveBeenCalled()`
- [ ] **Coverage gate**: Grid drawing code path ≥90% statements/lines/functions

#### System 7b — Client: Minimap (GameSceneUI.ts or new MinimapUI)

> **Current state**: Not implemented.

- [ ] **Position**: (20, 20), 120×120px
- [ ] **Scale**: 0.075 (1600px world → 120px minimap)
- [ ] **Static layer (depth 1999)**: Black bg, white border, wall positions; `setScrollFactor(0)`
- [ ] **Dynamic layer (depth 2000)**: Player/enemy dots, radar ring, aim line; `setScrollFactor(0)`
- [ ] **Player dot**: Green, 4px
- [ ] **Enemy dots**: Red, 3px; only within 600px radar range
- [ ] **Update every frame**: Clear + redraw dynamic layer
- [ ] **Test TS-UI-018**: Minimap renders static layer
- [ ] **Test TS-UI-019**: Minimap radar range filters enemies
- [ ] **Spec validation**: Verify against `constants.md` lines 407-415 — x=20, y=20, scale=0.075, size=120, radarRange=600, staticDepth=1999, dynamicDepth=2000, playerDotSize=4, enemyDotSize=3. Verify both layers use `setScrollFactor(0)` per `ui.md`
- [ ] **Assertion quality**: TS-UI-018 asserts static layer depth exactly 1999, position exactly (20,20), `setScrollFactor(0)` called. TS-UI-019 asserts enemy at 500px distance IS shown, enemy at 700px IS NOT shown (exact boundary test at 600px) — not just "some dots rendered"
- [ ] **Coverage gate**: Minimap static setup + dynamic update + radar filtering ≥90% statements/lines/functions (branch coverage on radar range filter critical)

---

### Final Verification

#### Automated Tests
- [ ] `make test-server` — all server tests pass
- [ ] `make test-client` — all client tests pass
- [ ] `make test-visual` — visual regression tests pass
- [ ] `make lint` — no lint errors
- [ ] `make typecheck` — no type errors

#### Global Coverage Gate
- [ ] Client overall: ≥90% statements, ≥90% lines, ≥90% functions, ≥87.8% branches (per vitest.config.ts thresholds)
- [ ] Server overall: ≥90% statement coverage on changed packages (`go test ./internal/game/... -cover`)
- [ ] No new file has <90% coverage — run `npm run test:unit:coverage` and check HTML report for uncovered lines

#### Global Assertion Quality Audit
- [ ] Grep for `toBeDefined()` in new/modified test files — ZERO instances on graphics, tween, or rendering objects (acceptable only for constructor existence checks)
- [ ] Grep for bare `.toHaveBeenCalled()` (without `With`) in new/modified test files — ZERO instances on rendering calls (every `lineStyle`, `fillCircle`, `strokeCircle`, `flash`, `shake`, `tweens.add` must assert args)
- [ ] Grep for `toBeTruthy()` / `toBeFalsy()` in new/modified test files — ZERO instances where a specific value should be asserted instead
- [ ] Every tween assertion checks at minimum: `duration`, `targets`, and primary animated property — not just that `tweens.add` was called
- [ ] Every color assertion uses exact hex value (e.g., `0xFFFFFF`, `0xCC0000`) — not `expect(color).toBeTruthy()` or `.not.toBe(0)`

#### Global Spec Validation Audit
- [ ] Cross-reference every numeric constant in code against `specs/constants.md` — all values match exactly
- [ ] Cross-reference every depth value against depth table in `specs/graphics.md` — no depth conflicts or mismatches
- [ ] Cross-reference every test ID (TS-XXX-NNN) against `specs/test-index.md` — all referenced tests exist and descriptions match
- [ ] Verify no stale old values remain (search for: range 64, range 80, arc 90°, stroke 3px on arcs, 200ms hit marker fade, 1000ms damage number duration, 24px red-only damage numbers)

#### Visual Regression (Read Screenshots) — HUMAN ONLY

> **Not for agent workers.** These require a human to visually inspect screenshot PNGs and confirm rendering correctness. Agents cannot meaningfully evaluate visual output.

- [ ] Melee arc: white stroke-only, correct size
- [ ] Death corpse: splayed limbs, correct color/depth
- [ ] Reticle crosshair: ring + ticks + red dot
- [ ] Hit markers: X shape, correct tint on kill
- [ ] Damage numbers: correct sizes/colors per variant
- [ ] Floor grid: visible at correct spacing
- [ ] Minimap: static + dynamic layers rendering

#### Manual Playtest — HUMAN ONLY

> **Not for agent workers.** These require a human to run the game in a browser and interactively verify gameplay feel, animation timing, and visual feedback. No automated substitute exists for these checks.

- [ ] Melee swing: white arc appears and fades, weapon container rotates
- [ ] Aim sway: weapon oscillates while moving, steadies when idle
- [ ] Aim sway affects bullet trajectory (shots spread while moving)
- [ ] Blood particles: spray away from damage source on hit
- [ ] Death corpse: appears with splayed limbs, fades after 5s
- [ ] Healing particles: green dots float up during regen
- [ ] Camera flash: red flash on taking damage (100ms)
- [ ] Camera shake: subtle shake on dealing damage (50ms)
- [ ] Crosshair: pre-rendered reticle at cursor, no spread circle
- [ ] Hit markers: white X on hit, red X on kill, at reticle position
- [ ] Damage numbers: white 16px normal, red 24px kill, small for remote
- [ ] Directional indicators: chevrons point toward damage source/target
- [ ] Gun recoil: weapon kicks back on fire, snaps back
- [ ] Reload pulse: weapon flickers during reload
- [ ] Wall spark: yellow spark when barrel is in wall, no bullet
- [ ] Floor grid: visible grid lines across arena
- [ ] Minimap: shows self (green), nearby enemies (red), walls
