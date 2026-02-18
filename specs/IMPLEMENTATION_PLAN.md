# Art Style Implementation Plan — Spec Updates

> Goal: Update spec documents to match the prototype video art style
> Generated: 2026-02-17

---

## Executive Summary

A thorough review of the prototype footage (52-second recording, ~58fps, 1920x1386) against all spec documents reveals two categories of gaps. The first and most impactful category is **incorrect values**: background colors, health bar formats, crosshair colors, and player body rendering that are directly contradicted by what the prototype shows. These affect the most visible elements of the game and must be corrected first. The second category is **missing sections**: entire visual features — floating damage numbers, hit direction indicators, blood effects, damage screen flash, death screen overlay, score display, kill counter, debug overlay, and chat log — that are clearly present throughout the prototype but have no spec coverage at all.

The gaps span six spec files (`graphics.md`, `arena.md`, `ui.md`, `constants.md`, `hit-detection.md`, `client-architecture.md`) and three secondary files (`shooting.md`, `weapons.md`, `messages.md`, `server-architecture.md`). Architecture gaps are mostly additive — new managers and UI component classes must be named and described so the implementation has a clear blueprint. The message schema gaps are low-severity: most visual features can work with current messages, but documenting workarounds is needed where data is absent (e.g., blood splatter placement, reload progress tracking).

No new spec files are required. All changes fit within existing documents. The total scope is approximately 45 changes: 10 P0 corrections of fundamental visual identity, 20 P1 additions of significant polish systems, and 15 P2 refinements.

---

## Priority Definitions

- **P0**: Core art style — changes that fundamentally define the game's visual identity (color of the world, player differentiation, primary HUD elements)
- **P1**: Important polish — visual systems that significantly impact gameplay feel (damage feedback, combat effects, missing HUD panels)
- **P2**: Nice-to-have — refinements and minor visual details (threshold tuning, minor color corrections, architecture documentation completeness)

---

## Changes by Spec File

---

### graphics.md

**1. [P0] Player/Enemy Color Scheme — full-body vs. head-only distinction**
- **Section:** `§ Player Colors` and `renderStickFigure` pseudocode
- **Current:** Entire stick figure is green (`0x00ff00`) for local player, red (`0xff0000`) for enemies
- **Target:** Head-only color distinction. Draw head in type color: local player `#2A2A2A` (dark brown/black), enemy `#FF0000` (bright red), dead `#888888` (gray). Draw all body/limbs (torso, arms, legs) in black (`0x000000`) for all player types
- **Update test:** `TS-GFX-003` to reflect head-only color distinction

**2. [P0] Crosshair Shape — white "+" in circle, no red dot**
- **Section:** `§ Crosshair / Reticle`
- **Current:** Ring with cardinal tick marks and a **red center dot** (`0xff0000`, 2px circle)
- **Target:** White `"+"` (cross) shape inside a circle outline. No red center dot. All elements white (`#FFFFFF`)
- **Update test:** `TS-GFX-023` expected output

**3. [P0] Weapon Crate Appearance — yellow circle, not brown rectangle**
- **Section:** `§ Weapon Crate Rendering`
- **Current:** Shape is brown rectangle 48×48px (`0x996633`) with separate yellow circle glow outline at 0.5 alpha
- **Target:** Remove brown rectangle. The crate IS a yellow circle outline (~40px diameter, `#CCCC00`) with a small dark cross/icon inside. The yellow circle is the primary visual, not an aura
- **Update tests:** `TS-GFX-008`, `TS-GFX-009`

**4. [P0] Spawn Invulnerability Ring — add new documentation**
- **Section:** Add new `§ Spawn Invulnerability Ring`
- **Current:** No documentation. `player.md` vaguely says "blinking or shield effect"
- **Target:** Yellow circle outline, radius ~25px, color `#FFFF00`, visible when `isInvulnerable === true` for any player (local and remote). Hidden when invulnerability expires. Applied to all players on spawn

**5. [P0] "YOU" Label — add new documentation**
- **Section:** Add new `§ Local Player Label`
- **Current:** Not documented
- **Target:** Text "YOU" in white bold, ~14px, dark drop shadow for readability. Floats above local player head. Position: `(player.x, player.y - headRadius - 5px)`, centered on X

**6. [P0] Enemy Name Labels — add new documentation**
- **Section:** Add new `§ Remote Player Name Labels`
- **Current:** Not documented
- **Target:** Player display name in gray/white text above enemy head. Font size ~12-14px. Position: `(player.x, player.y - headRadius - 5px)`, centered on X. Content: player's display name from server state

**7. [P1] Crosshair Bloom — add dynamic size expansion on firing**
- **Section:** `§ Crosshair / Reticle`
- **Current:** Explicitly states "There is NO dynamic spread circle"
- **Target:** Crosshair diameter expands during firing. Base size: ~40px diameter. Expanded: ~60-80px. Snap to expanded on shot, ease back over 200-300ms. Also expands proportionally during movement
- **Note:** Contradicts current spec text — must remove "NO dynamic spread circle" statement

**8. [P1] Aim / Trajectory Line — correct color and length**
- **Section:** `§ Aim Indicator`
- **Current:** Line from player center, 50px length, green (`0x00ff00`) for local player, yellow (`0xffff00`) for enemies
- **Target:** White line (`#FFFFFF`) extending from player through crosshair toward target. No length cap — terminates at crosshair cursor position. Line is visible during active aiming. Enemies may not display aim lines (prototype shows line primarily for local player — clarify)

**9. [P1] Damage Screen Flash — add new documentation**
- **Section:** Add new `§ Damage Screen Flash`
- **Current:** Not documented in `graphics.md` (player.md references "camera flash 100ms" only)
- **Target:** Full-viewport red overlay rectangle, color `#FF0000`, alpha 0.3-0.4. Flash in immediately, fade out over 300ms. Triggered by `player:damaged` for local player only. Implementation: semi-transparent Phaser graphics object or `cameras.main.flash()`

**10. [P1] World-Space Health Bar Background Color**
- **Section:** `§ Health Bar (World-Space)`
- **Current:** Background `0x888888` (gray)
- **Target:** Background `#333333` (dark navy)
- **Update test:** `TS-GFX-004`

**11. [P1] HUD Health Bar Text Format**
- **Section:** `§ Health Bar UI (HUD)`
- **Current:** Text format `"100/100"` (fraction)
- **Target:** Percentage format `"N%"` (e.g., `"100%"`, `"76%"`). Text color white, positioned to the right of the bar. Add heartbeat/EKG icon to the left of the bar

**12. [P1] Health Bar Color Thresholds — 3-tier to 2-tier**
- **Section:** `§ Health Bar UI (HUD)`, `§ Constants` (HEALTH_BAR_MEDIUM)
- **Current:** Three states: green >60%, yellow 30-60%, red <30%
- **Target:** Two states based on prototype: green (≥20%), red (<20%). Remove yellow intermediate band or document as unobserved (recommend removal unless gameplay requires it)
- **Note:** Critical threshold changes from <30% to <20%

**13. [P2] Blood Effect Color**
- **Section:** `§ Blood Particles`
- **Current:** Color `0xCC0000` (dark red)
- **Target:** Color `0xCC3333` (pink-red, matching prototype)
- **Update test:** `TS-GFX-015`

**14. [P2] Hit Direction Indicator Color**
- **Section:** `§ Directional Hit Indicators`
- **Current:** Incoming hit tint `0xff0000` (pure bright red)
- **Target:** `0xCC3333` (pinkish-red chevron, matching prototype)
- **Update test:** `TS-GFX-022`

**15. [P2] Muzzle Flash Color — constants vs. per-weapon**
- **Section:** `§ Constants` → `MUZZLE_FLASH_COLOR`
- **Current:** `MUZZLE_FLASH_COLOR: 0xffa500` (orange). Pistol: `muzzleFlashColor: 0xffdd00`. Uzi: `0xffaa00`
- **Target:** Update `MUZZLE_FLASH_COLOR` constant to `0xFFD700` (bright yellow, matching prototype). Review Pistol and Uzi per-weapon values for consistency

**16. [P2] Weapon Crate Respawning State — glow remains visible**
- **Section:** `§ Weapon Crate Rendering` → Unavailable state
- **Current:** `Unavailable: Alpha 0.3, glow hidden`
- **Target:** Glow (yellow circle) remains VISIBLE at reduced alpha (not hidden) to show ghostly respawning indicator. Alpha 0.3 is correct for the overall crate. Update `TS-GFX-009` to show glow visible (faded), not hidden

---

### arena.md

**17. [P0] Background Color — light gray not dark charcoal**
- **Section:** `§ Implementation Notes` (TypeScript section)
- **Current:** `this.add.rectangle(0, 0, ARENA.WIDTH, ARENA.HEIGHT, 0x222222).setOrigin(0, 0);`
- **Target:** Change fill color from `0x222222` (near-black) to `0xC8CCC8` (light gray). This is the single most visually prominent element — the prototype shows a bright light-gray arena, not a dark one

**18. [P1] Floor Grid Line Color**
- **Section:** `§ Floor Grid`
- **Current:** Line color `0xB0BEC5` (light blue-gray)
- **Target:** Line color `0xD8DCD8` (lighter gray, subtly lighter than background `#C8CCC8`)
- **Update test:** `TS-ARENA-013`

---

### player.md

**19. [P0] Spawn Invulnerability Visual — specify yellow ring**
- **Section:** `§ Implementation Notes` point 5 (Invulnerability Visual)
- **Current:** "blinking or shield effect" (vague)
- **Target:** Yellow ring (`#FFFF00`, ~50px diameter circle outline) rendered around the player sprite during spawn invulnerability. Corresponds to `graphics.md § Spawn Invulnerability Ring`

**20. [P2] Damage Screen Flash — reconcile with graphics.md**
- **Section:** `§ Player Damage Feedback` (wherever "camera flash" is referenced)
- **Current:** "Camera flash (100ms red) on receiving damage"
- **Target:** Reference `graphics.md § Damage Screen Flash` as the authoritative spec. Clarify that the flash is a full-viewport overlay, not just a camera effect. Duration: ~300ms fade-out

---

### ui.md

**21. [P0] HUD Layout Diagram — complete rewrite to match prototype**
- **Section:** `§ HUD Layout` (ASCII diagram)
- **Current:** Shows `[Title]`, `[Status]`, `[Kill Feed]`, `[Ammo]`, `[Health Bar]`, `[Timer]`, `[Crosshair]` — no minimap, no score, no kills, no debug overlay
- **Target:** Update ASCII diagram to:
  ```
  [Minimap]  [EKG] [====Health Bar====] 100%      [000000]
  FPS: N     [Ammo Icon] 20/20                     KILLS: 0
  Update: Nms
  AI: Nms
  E: N | B: N
  ...
                         GAME WORLD
  ...
  [Chat Log Panel (bottom-left)]
  ```

**22. [P0] Health Bar UI — icon, format, thresholds, depleted color**
- **Section:** `§ Health Bar UI`
- **Current:** Text `"HP: {current}/{max}"` centered in white. Three-tier color (green/yellow/red). Background `#000000`. No EKG icon
- **Target:** Heartbeat/EKG icon to the left of the bar. Text format `"N%"` to the right of the bar in white. Depleted portion background `#333333` (dark navy). Two-tier threshold: green (≥20%), red (<20%). Critical at <20% not <30%

**23. [P0] Ammo Counter — icon, color, RELOADING text, INF state**
- **Section:** `§ Ammo Display`
- **Current:** Ammo text color white `#ffffff` always. No icon. No "RELOADING..." text. No INF state
- **Target:**
  - Icon: yellow/orange target/crosshair icon when ready (`#E0A030`); red rotating spinner icon when reloading
  - Ammo text color: yellow/orange `#E0A030` when ready
  - "RELOADING..." text in red/coral `#CC5555` appears to the right of the counter during reload
  - "INF" display for fist/infinite-ammo weapons (no max shown)

**24. [P0] Score Display — add new section**
- **Section:** Add new `§ Score Display (Top Right)`
- **Current:** Not documented. Only a Kill Feed (scrolling) exists, not a persistent score counter
- **Target:**
  - Format: 6-digit zero-padded (e.g., `String(score).padStart(6, '0')`)
  - Font: Monospaced, ~28px, white `#FFFFFF`
  - Position: top-right corner, right-aligned
  - Updated by `player:kill_credit` (when local player is killer)
  - Depth: 1000

**25. [P0] Kill Counter — add new section**
- **Section:** Add new `§ Kill Counter (Top Right, Below Score)`
- **Current:** Not documented (Kill Feed is a different concept)
- **Target:**
  - Format: `"KILLS: N"`
  - Color: `#FF6666` (red/pink)
  - Font: ~16px, right-aligned
  - Position: below score display, top-right
  - Incremented on `player:kill_credit` for local player

**26. [P1] Chat Log — add new section**
- **Section:** Add new `§ Chat Log (Bottom Left)`
- **Current:** No chat system specified anywhere in `ui.md`
- **Target:**
  - Dimensions: ~300×120px
  - Position: bottom-left of viewport, screen-fixed (scroll factor 0)
  - Background: `#808080` at 70% opacity
  - System messages: yellow `#BBA840`, prefixed `[SYSTEM]` (e.g., "Welcome to Stick Rumble. Survive.")
  - Player messages: name in red/orange, message text in white (e.g., "Reaper: Bruh")
  - Font: sans-serif, 14px
  - Specify max visible lines, scroll behavior, and depth (1000)

**27. [P1] Death Screen Overlay (Per-Death) — add new section**
- **Section:** Add new `§ Death Screen Overlay (Per-Death)` (distinct from MatchEndScreen)
- **Current:** Only `MatchEndScreen` (React modal) for `match:ended` is specified. No per-death overlay
- **Target:**
  - Trigger: `player:death` for local player
  - Dark overlay: 70% opacity black over full viewport
  - "YOU DIED" text: ~72px bold white, centered
  - Stats row: trophy icon (yellow/gold) + score (red), skull icon (red) + kill count (white)
  - "TRY AGAIN" button: rectangular, thin white border, white text, centered below stats
  - Dismiss: on "TRY AGAIN" click (clarify if server respawn is manual or automatic)
  - Depth: above game world, below React modals
- **Also update:** `§ Match End Screen` with a note clarifying the two screens are distinct

**28. [P1] Debug Overlay — add new section**
- **Section:** Add new `§ Debug Overlay (Top Left, Below Minimap)`
- **Current:** Only a "Debug Network Panel" (React component for network simulation) is mentioned. No in-game performance overlay
- **Target:**
  - Color: bright green `#00FF00`, monospaced font, ~12px
  - Lines: `FPS: N`, `Update: Nms`, `AI: Nms`, `E: N | B: N`
  - Position: below minimap, left side, screen-fixed
  - Controlled by a debug flag (not shown in production)
  - Depth: 1000

**29. [P1] Minimap — size, shape, background correction**
- **Section:** `§ Minimap`
- **Current:** Size 120×120px (from `MINIMAP_SCALE=0.075`), background black at 0.7 alpha, square shape — no circular border mentioned
- **Target:**
  - Size: ~170×170px (update `MINIMAP_SIZE` constant to 170, update `MINIMAP_SCALE` to ~0.106)
  - Background: `#3A3A3A` at 50% alpha (not black at 0.7)
  - Add specification for circular/radar ring border with teal/green outline
  - Green dot = local player, red dots = enemies (unchanged)

**30. [P1] Reload Progress Bar — world-space, size, color correction**
- **Section:** `§ Reload Indicators § Reload Progress Bar`
- **Current:** Position screen-fixed top-left at `(10, 70)`, dimensions 200×10px, fill color green `#00ff00`
- **Target:**
  - Position: world-space above the player character (not screen-fixed), same pattern as health bars rendered above entities
  - Width: ~60px (not 200px)
  - Fill color: white `#FFFFFF` (not green)
  - Depth: world-space

**31. [P1] Weapon Pickup Notification — add new section**
- **Section:** Add new `§ Weapon Pickup Notification` (distinct from existing `§ Weapon Pickup Prompt`)
- **Current:** The prompt "Press E to pick up {WEAPON_NAME}" exists, but no confirmation notification after pickup occurs
- **Target:**
  - Text: `"Picked up {WEAPON_NAME}"` in gray
  - Position: center screen
  - Animation: fade out after ~2 seconds
  - Triggered by `weapon:pickup_confirmed` event

**32. [P2] Crosshair — outer circle with "+" not four-line crosshair**
- **Section:** `§ Crosshair`
- **Current:** 4 white lines (2px), 10px long, 5px gap from center. Red spread circle `#ff0000`
- **Target:** White `"+"` shape inside an outer circle outline. The outer circle expands during firing (recoil bloom). All elements white `#FFFFFF`. Remove the red spread circle (was not observed in prototype — remove or document as debug-only)

**33. [P2] Damage Flash — clarify mechanism**
- **Section:** `§ Damage Flash` / `constants.md § Camera Flash`
- **Current:** `cameras.main.flash()` with `RGB(128, 0, 0)` for 100ms
- **Target:** Clarify whether implementation uses Phaser's `cameras.main.flash()` (which produces bright-to-transparent) vs. a persistent red overlay rectangle at 0.3-0.4 alpha. The prototype shows a persistent red tint (not a bright flash). Document the preferred approach. If using overlay rectangle, depth should be 999 (below fixed HUD)

**34. [P2] HEALTH_BAR_WIDTH naming conflict**
- **Section:** `§ UI Constants` (constants table at top of ui.md)
- **Current:** `HEALTH_BAR_WIDTH = 200` in ui.md conflicts with `HEALTH_BAR_WIDTH = 32` in constants.md (these are two different bars)
- **Target:** Rename the above-player world-space bar constant in constants.md to `PLAYER_HEALTH_BAR_WIDTH`. Keep `HUD_HEALTH_BAR_WIDTH = 200` for the HUD bar (add to constants.md if not present)

---

### hit-detection.md

**35. [P1] Floating Damage Numbers — add new section**
- **Section:** Add `§ Damage Numbers (Client)` to client implementation section
- **Current:** `hitEffectManager.playHitEffect()` is referenced but no color, font, animation, or duration is specified for floating numbers
- **Target:**
  - On `player:damaged`: display floating red text showing damage value at victim's world position
  - Font: Bold, ~24px, color `#FF4444`
  - Animation: float upward ~40px over 600ms while fading from alpha 1.0 to 0
  - Trigger for ALL players' damage events (not just local player)
  - Implement via object pool (`DamageNumberManager`)

**36. [P1] Hit Direction Indicators — add new section**
- **Section:** Add `§ Hit Direction Indicators (Client)` to client implementation section
- **Current:** Not documented anywhere
- **Target:**
  - On `player:damaged` where `victimId === localPlayerId`
  - Show 1-3 red triangular chevrons (`#CC3333`) pointing toward the attacker's position
  - Position: near the local player sprite
  - Animation: fade in 100ms, hold 300ms, fade out 200ms
  - Direction: calculate angle from local player to `attackerId`'s last known position from `PlayerManager.playerStates`
  - Multiple incoming attacks stack indicators

**37. [P1] Blood Particle Effects — add new section**
- **Section:** Add `§ Blood Particle Effects (Client)` to client implementation section
- **Current:** `hitEffectManager.playHitEffect(player.x, player.y)` referenced without describing blood particles
- **Target:**
  - On `player:damaged` for any player
  - Spawn 6-10 small circular particles at victim world position
  - Color: `#CC3333` (pink-red), particle size 3-5px
  - Animation: splatter outward ~30-50px over 300ms, then fade

**38. [P1] Damage Screen Flash — add new section**
- **Section:** Add `§ Damage Screen Flash (Client)` to client implementation section
- **Current:** Not documented in `hit-detection.md`
- **Target:**
  - On `player:damaged` where `victimId === localPlayerId` only
  - Full-viewport red overlay, `#FF0000` at 0.3-0.4 alpha
  - Flash in immediately, fade out over 300ms
  - See also `graphics.md § Damage Screen Flash`

---

### shooting.md

**39. [P1] Aim / Trajectory Line — add new section**
- **Section:** Add `§ Aim Line Visual`
- **Current:** Not mentioned (recoil, aim sway, and projectile creation are specified, but no aim line visual)
- **Target:**
  - Thin white line from player barrel tip toward crosshair
  - Visible whenever player is aiming (continuous, not just on fire)
  - Color: white `#FFFFFF`
  - Extends from barrel position to crosshair/cursor position with no explicit length cap
  - Drawn each frame in `preUpdate()` or `update()`, cleared and redrawn from current `aimAngle` and crosshair position
  - Add `aimLineColor: 0xffffff` to `WeaponVisuals` or as a shared constant

**40. [P2] Crosshair Bloom — add specification**
- **Section:** Add to `§ Recoil System` or as `§ Crosshair Bloom`
- **Current:** No crosshair bloom behavior specified in shooting spec
- **Target:**
  - Crosshair expands on firing (recoil bloom)
  - Base diameter: ~40px. Expanded: ~60-80px
  - Snap to expanded on shot, ease back to base over 200-300ms
  - Also expands during movement proportional to aim sway magnitude
  - Implementation: `Crosshair.ts` adjusts circle radius based on firing state and velocity

**41. [P2] Shotgun Spread Rendering — clarify client behavior**
- **Section:** Add to `§ Shotgun Pellet Spread` (TypeScript implementation note)
- **Current:** Server-side spread is well-specified, but no client-side rendering note
- **Target:** Document that each of the 8 pellets spawns a separate `projectile:spawn` event, resulting in 8 individual chevron+trail entities visible as a fan-spread pattern within the 15° cone. No special shotgun blast visual — each pellet uses standard projectile rendering

---

### weapons.md

**42. [P1] Projectile Shape — chevron, not circle**
- **Section:** `§ Weapon Statistics` → Visual Configuration table → `ProjectileVisuals`
- **Current:** `ProjectileVisuals.diameter` implies circular dot for all weapons (Pistol: 4px, Uzi: 3px, etc.)
- **Target:** Add `shape: "chevron" | "circle"` field to `ProjectileVisuals`. Set `shape: "chevron"` for all weapons (prototype shows directional triangular arrow shapes, not circle dots). Add `tracerLength: number` (~20px) since prototype shows ~20px orange trail segments (only `tracerWidth` currently specified)

**43. [P2] Bullet Trail Color — Pistol correction**
- **Section:** `§ Weapon Statistics` → Visual Configuration → Pistol
- **Current:** Pistol `tracerColor: "0xffff00"` (yellow)
- **Target:** Update Pistol `tracerColor` to `"0xffaa00"` (orange). Prototype color palette lists `#FFA500` as the bullet trail color and the prototype consistently shows orange trails for the default weapon

**44. [P2] Muzzle Flash Duration**
- **Section:** `§ Weapon Statistics` → Visual Configuration → `muzzleFlashDuration`
- **Current:** Pistol `muzzleFlashDuration: 50ms`, Shotgun `100ms`
- **Target:** Reduce to 33ms (2 frames at 60fps) for Pistol to match prototype (flash visible only 1-2 frames). Add `muzzleFlashShape: "starburst" | "circle"` to `WeaponVisuals` to clarify that the muzzle flash is a small starburst or filled circle at the barrel tip

---

### constants.md

**45. [P0] Add `COLORS` constant group**
- **Section:** Add new `§ Visual Color Constants`
- **Current:** No visual color constants defined. Code examples reference magic hex values
- **Target:** Add a `COLORS` object to `shared/constants.ts` containing the full prototype palette:
  ```
  BACKGROUND: 0xC8CCC8
  GRID_LINE: 0xD8DCD8
  PLAYER_HEAD: 0x2A2A2A
  ENEMY_HEAD: 0xFF0000
  DEAD_HEAD: 0x888888
  HEALTH_FULL: 0x00CC00
  HEALTH_CRITICAL: 0xFF0000
  HEALTH_DEPLETED_BG: 0x333333
  AMMO_READY: 0xE0A030
  AMMO_RELOADING: 0xCC5555
  SCORE: 0xFFFFFF
  KILL_COUNTER: 0xFF6666
  DEBUG_OVERLAY: 0x00FF00
  CHAT_SYSTEM: 0xBBA840
  MUZZLE_FLASH: 0xFFD700
  BULLET_TRAIL: 0xFFA500
  DAMAGE_NUMBER: 0xFF4444
  BLOOD: 0xCC3333
  SPAWN_RING: 0xFFFF00
  DAMAGE_FLASH: 0xFF0000
  HIT_CHEVRON: 0xCC3333
  WEAPON_CRATE: 0xCCCC00
  ```

**46. [P1] Fix HEALTH_BAR_WIDTH naming conflict**
- **Section:** `§ UI Constants`
- **Current:** `HEALTH_BAR_WIDTH = 32` (above-player world-space bar). Conflicts with `HEALTH_BAR_WIDTH = 200` in ui.md (HUD bar)
- **Target:** Rename to `PLAYER_HEALTH_BAR_WIDTH = 32`. Add `HUD_HEALTH_BAR_WIDTH = 200`

**47. [P1] Update MINIMAP constants**
- **Section:** `§ Minimap Constants`
- **Current:** `MINIMAP_SIZE = 120`, `MINIMAP_SCALE = 0.075`
- **Target:** `MINIMAP_SIZE = 170`, `MINIMAP_SCALE = 0.106` (170 / 1600)

---

### client-architecture.md

**48. [P0] Background color in GameConfig**
- **Section:** `§ Data Structures → GameConfig`
- **Current:** `GameConfig.backgroundColor = '#282c34'` (dark charcoal)
- **Target:** `GameConfig.backgroundColor = '#C8CCC8'` (light gray, matching arena background)

**49. [P1] Add missing visual effect manager classes**
- **Section:** `§ Manager Classes` and `§ Application Structure`
- **Current:** Only `HitEffectManager` (bullet impact + muzzle flash) and `ScreenShake` are listed
- **Target:** Add the following to the class listing under `game/effects/` or `game/ui/`:
  - `DamageNumberManager` — object pool (~10), tween float-and-fade, ~1000ms, rise ~30px
  - `HitIndicatorManager` — 2-4 red chevrons pointing toward damage source, fade over ~500ms
  - `BloodEffectManager` — pink/red particles (`#CC3333`), ~5-8 per hit, `showBloodEffect(x, y)`
  - `DamageFlashOverlay` — full-viewport rectangle at depth 999, `#FF0000` 30-40% alpha, tween alpha to 0 over ~300ms
  - `PickupNotificationUI` — center-screen fading gray text "Picked up [WEAPON NAME]", ~2000ms

**50. [P1] Add missing HUD component classes**
- **Section:** `§ Application Structure → game/ui/`
- **Current:** `HealthBarUI`, `KillFeedUI`, `PickupPromptUI`, `DodgeRollCooldownUI` listed. No minimap, score, kill counter, debug overlay, or chat log
- **Target:** Add:
  - `MinimapUI` — 170×170px, circular mask, player dots, `#3A3A3A` bg 50% alpha, teal border
  - `ScoreDisplayUI` — top-right, 6-digit zero-padded, white monospaced ~28px
  - `KillCounterUI` — below score, "KILLS: N", `#FF6666`, ~16px
  - `DebugOverlayUI` — bright green `#00FF00` monospaced ~12px, FPS/Update/AI/E/B lines
  - `ChatLogUI` — bottom-left, ~300×120px, 70% opacity panel, system/player message types

**51. [P1] Document ProceduralPlayerGraphics class**
- **Section:** `§ Application Structure` or `§ Rendering Pipeline`
- **Current:** `ProceduralPlayerGraphics` is listed as a file but never described
- **Target:** Document that this class renders a stick figure composed of: head circle (local `#2A2A2A`, enemy `#FF0000`, dead `#888888`), torso line, arms, legs — all body/limbs in black (`0x000000`). Include "YOU" label above local player, name labels above enemies

**52. [P1] Add rendering specs for spawn ring and death ragdoll**
- **Section:** `§ Rendering Pipeline` or `§ Player Rendering`
- **Current:** Invulnerability ring not mentioned. Ragdoll partially covered (gray color when `deathTime` set) but no X-pose, no yellow circle, no fade-out
- **Target:**
  - Spawn ring: when `PlayerStateSnapshot.isInvulnerable === true`, draw yellow ring (`#FFFF00`, ~50px diameter) around player. Remove when invulnerability expires
  - Death animation: on `player:death`, transition to ragdoll pose (limbs ~45° spread), add yellow circle outline (~50px, `#FFFF00`), change head to gray (`#888888`), persist 5 seconds, then tween alpha 1→0 over 1 second and destroy

**53. [P1] Describe renderArena() with grid spec**
- **Section:** `§ Rendering Pipeline`
- **Current:** `renderArena()` is called in `create()` but never described
- **Target:** Describe: fills background with `#C8CCC8` (light gray), draws grid lines using `scene.add.grid()` or manual `Graphics.lineTo()` with `#D8DCD8` at cell size 64×64px, covering full arena (1920×1080). Depth: 0

**54. [P2] Add depth layer for aim line and damage flash**
- **Section:** `§ Rendering Pipeline → Depth Layering`
- **Current:** Layers: 1000+ (fixed UI), 100 (HUD), 60 (hit effects), 50 (players/projectiles), 0 (background)
- **Target:** Add: depth 40 (aim line, below players), depth 999 (damage flash overlay, below fixed UI)

**55. [P2] Document GameSceneSpectator.ts**
- **Section:** `§ Application Structure → game/scenes/`
- **Current:** `GameSceneSpectator.ts` listed but never described
- **Target:** Document as: on local player death, renders full-screen semi-transparent black rectangle (depth 990, 70% alpha) plus "YOU DIED" layout. Includes trophy/score, skull/kill count. Provides "TRY AGAIN" button. Clarify whether respawn requires button click or is auto-triggered by server `player:respawn`

---

### messages.md

**56. [P2] Add `isInvulnerable` and `invulnerabilityEndTime` to TypeScript `PlayerState` interface**
- **Section:** `§ player:move → TypeScript PlayerState interface`
- **Current:** Go `PlayerStateSnapshot` includes `IsInvulnerable` and `InvulnerabilityEndTime` but the TypeScript client interface omits them
- **Target:** Add `isInvulnerable: boolean` and `invulnerabilityEndTime: number` to the client TypeScript `PlayerState` type definition. These are needed for spawn protection ring rendering

**57. [P2] Document reload progress tracking approach**
- **Section:** `§ weapon:state`
- **Current:** `weapon:state` sends `isReloading: boolean` but no `reloadProgress` (0.0-1.0) or `reloadStartTime`
- **Target:** Document client-side workaround: on first `isReloading: true` message, client records local timestamp as `reloadStartTime`. On each frame, `progress = (now - reloadStartTime) / weapon.reloadDuration`. Alternatively, add `reloadStartTime` (server timestamp ms) to the data payload. Choose one approach and document it

**58. [P2] Clarify score vs. XP for score display**
- **Section:** `§ player:kill_credit`
- **Current:** `player:kill_credit` includes `killerKills` and `killerXP`. No `killerScore` (points) field. It's unclear if the 6-digit score display maps to XP or is a separate value
- **Target:** Either document that score = XP (and format XP as 6-digit zero-padded in the HUD), or add a `killerScore` field. Choose and document the canonical approach

**59. [P2] Resolve player:move field name mismatch (existing note)**
- **Section:** `§ player:move`
- **Current:** Existing note: "Go sends `aimAngle` while TypeBox schema defines `rotation`; Go sends `deathTime` instead of `isDead`; Go omits `maxHealth` and `isSprinting`"
- **Target:** Resolve the mismatch: align Go field names to TypeScript schema or vice versa. Document definitively. Explicitly document that the client reads `deathTime` (not `isDead`) and considers a player dead when `deathTime !== null`

---

### server-architecture.md

**60. [P2] Document invulnerability set on Respawn()**
- **Section:** `§ Game Loop → Tick Loop → Step 5 (Check Respawns)`
- **Current:** Step 5 calls `player.Respawn()` but does not state that `Respawn()` sets `IsInvulnerable = true` for 2 seconds
- **Target:** Add explicit note: `player.Respawn()` sets `IsInvulnerable = true` with 2-second duration. `UpdateInvulnerability()` in Step 7 clears it when timer expires. This ensures subsequent broadcasts include the invulnerability state for client ring rendering

---

## Cross-Cutting Concerns

**Color Palette Standardization**
All spec files currently use inline magic hex values (e.g., `0x222222`, `0xff0000`) without referencing a central constant. The `COLORS` group added to `constants.md` (change #45) should be adopted across all specs. When any spec document references a color, it should use the constant name (e.g., `COLORS.ENEMY_HEAD`) rather than a bare hex value. This prevents future drift when the palette is adjusted.

**Health Bar Instances — Two Separate Bars**
There are two health bars: (1) a world-space bar rendered above each player entity, and (2) a HUD bar at the top of the screen. These have different sizes, formats, and behavior. The `HEALTH_BAR_WIDTH` constant naming conflict (change #46, #34) exposes a pattern of conflation. All specs must clearly distinguish "world-space player health bar" from "HUD health bar" in section headers and constant names.

**Depth Layer Ordering**
Current depth layers need two additions (aim line at 40, damage flash overlay at 999). Any new visual objects added by these changes must declare their depth explicitly. The rendering pipeline table in `client-architecture.md` should be the canonical reference.

**hitEffectManager Responsibilities**
Multiple gap files reference `hitEffectManager.playHitEffect()` as a catch-all. After these spec updates, `hitEffectManager` should have a narrowly defined scope (bullet impacts, muzzle flash). Blood effects, damage numbers, hit direction indicators, and screen flash each go to their own managers (changes #49, #35-38). Update any pseudocode that uses `hitEffectManager` for these effects.

**Respawn vs. Death Flow Clarification**
The prototype shows a manual "TRY AGAIN" button on the death screen. The current spec implies auto-respawn triggered by a server timer. This ambiguity affects `client-architecture.md § GameSceneSpectator.ts` and `ui.md § Death Screen Overlay`. A design decision is needed: does the server send `player:respawn` automatically, or does the client send a `player:respawn_request` triggered by the button? The specs should reflect whichever is chosen consistently.

---

## New Specs Needed

None. All changes fit within existing spec files.

---

## Estimated Scope

| Priority | Count | Description |
|----------|-------|-------------|
| P0 | 10 | Core art style corrections (background color, player colors, weapon crate, "YOU" label, enemy labels, spawn ring, score display, kill counter, ammo counter, color constants) |
| P1 | 28 | Important polish additions (damage feedback systems, death screen, chat log, debug overlay, minimap corrections, reload bar, pickup notification, all missing manager/component classes, aim line, ragdoll death) |
| P2 | 22 | Refinements (threshold tuning, minor color corrections, muzzle flash duration, shotgun visual note, schema field additions, architecture documentation completeness) |
| **Total** | **60** | Changes across 10 spec files |

> Note: Several items flagged as "From Prototype — Not Yet Implemented" in the visual requirements are excluded from this plan (platforms, walls, map zones). These represent future game features, not art style corrections, and already have "NOT YET IMPLEMENTED" markers in the relevant spec files.
