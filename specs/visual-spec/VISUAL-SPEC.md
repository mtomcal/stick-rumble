# Stick Rumble - Visual Spec (Extracted from Prototype Video)

> Source: Screen Recording 2026-02-17, 52 seconds, 1920x1386, ~58fps

## Table of Contents
- [Color Palette](#color-palette)
- [HUD Layout](#hud-layout)
- [Player Character](#player-character)
- [Enemy Characters](#enemy-characters)
- [Combat Visuals](#combat-visuals)
- [Weapon System](#weapon-system)
- [Health System](#health-system)
- [Death & Respawn](#death--respawn)
- [Map & Environment](#map--environment)
- [Weapon Crates](#weapon-crates)
- [Chat System](#chat-system)
- [Scoring](#scoring)
- [Frame Reference](#frame-reference)

---

## Color Palette

| Element | Color | Hex (approx) |
|---------|-------|---------------|
| Background | Light gray with grid lines | `#C8CCC8` |
| Grid lines | Lighter gray | `#D8DCD8` |
| Platforms (brown blocks) | Dark brown/maroon | `#7A4A3A` |
| Walls/structural blocks | Dark charcoal/slate | `#4A5A5A` |
| Player head | Dark brown/black | `#2A2A2A` |
| Enemy heads | Bright red | `#FF0000` |
| Health bar (healthy) | Green | `#00CC00` |
| Health bar (critical <20%) | Red | `#FF0000` |
| Health bar (depleted bg) | Dark navy | `#333333` |
| Ammo text (ready) | Yellow/orange | `#E0A030` |
| Ammo text (reloading) | Red/coral | `#CC5555` |
| Score text | White | `#FFFFFF` |
| Kill counter text | Red/pink | `#FF6666` |
| Debug overlay | Bright green | `#00FF00` |
| Chat system messages | Dark yellow/olive | `#BBA840` |
| Muzzle flash | Bright yellow | `#FFD700` |
| Bullet trails | Orange | `#FFA500` |
| Damage numbers | Red | `#FF4444` |
| Blood effects | Pink/red | `#CC3333` |
| Death circle highlight | Yellow | `#FFFF00` |
| Damage screen flash | Red at ~30% opacity | `#FF0000` @ 30% |
| Hit direction indicators | Red chevrons | `#CC3333` |
| Weapon crate outline | Yellow circle | `#CCCC00` |

---

## HUD Layout

```
+--------------------------------------------------+
| [Minimap]  [Heart] [====Health Bar====] 100%      |  [000000]
| FPS:120    [Ammo Icon] 20/20                      |  KILLS: 0
| Update:0ms                                        |
| AI:0ms                                            |
| E:0|B:0                                           |
|                                                    |
|                                                    |
|                    GAME WORLD                      |
|                                                    |
|                                                    |
| +---Chat Log-----------+                           |
| | [SYSTEM] messages...  |                           |
| | [Player] messages...  |                           |
| +-----------------------+                           |
+--------------------------------------------------+
```

### Minimap (top-left)
- Size: ~170x170px
- Dark semi-transparent background (`#3A3A3A` @ ~50% opacity)
- Circular radar ring border (teal/green outline)
- Green dot = local player
- Red dots = enemies
- Shows simplified map layout with dark rectangles for walls/platforms *(from prototype -- minimap wall rendering is currently a no-op since no internal wall geometry exists)*
- **Bug (to fix)**: Player and enemy dots are NOT clipped to the radar circle boundary — they visibly travel outside the circle as the player moves. Dots should be clamped to stay within the radar circumference.
- **Bug (to fix)**: The minimap circle overlaps and obscures the HUD elements directly beneath it (health bar, ammo, debug text). The minimap needs to be positioned or sized so it does not overlap critical HUD info.
- **Bug (to fix)**: Minimap border is rendering as gray instead of the specified teal/green outline color.
- **Ref frames**: `02-gameplay-respawn-full-hud.jpg`, `53-corrections-aim-line-overshoots-cursor.jpg` through `71-corrections-cursor-directly-above-player-short-line.jpg`

### Health Bar (top-center-left)
- Green heartbeat/EKG icon on the left
- Green filled bar (~200px wide)
- Percentage text to the right in white
- Bar turns red when health < ~20%
- **Ref frames**: `02-gameplay-respawn-full-hud.jpg`, `09-critical-health-red-bar.jpg`

### Ammo Counter (below health bar)
- Icon changes based on state:
  - Ready: Yellow/orange crosshair/target icon
  - Reloading: Red rotating arrows (spinner) icon
- Format: "current/max" (e.g., "20/20")
- "RELOADING..." text in red/coral appears during reload
- "INF" displayed for infinite-ammo weapons (fists/default)
- **Ref frames**: `08-reloading-progress-bar.jpg`, `46-infinite-ammo-weapon-switch.jpg`

### Score (top-right)
- 6-digit zero-padded monospaced font (e.g., `000000`, `000100`, `000500`)
- White color, ~28px
- Right-aligned
- **Bug (to fix)**: Score is currently rendering as 7 digits (e.g., `0000100`) instead of 6. Must be zero-padded to exactly 6 digits.
- **Ref frames**: `02-gameplay-respawn-full-hud.jpg`, `57-corrections-aim-line-cursor-reticle-first-kill.jpg`

### Kill Counter (below score)
- Format: "KILLS: N"
- Red/pink text, ~16px
- Right-aligned
- **Ref frames**: `06-post-kill-score-increment.jpg`

### Debug Overlay (below minimap)
- Green monospaced text, ~12px
- Lines: FPS, Update time, AI time, Entity/Bullet counts
- Format: `E: N | B: N`
- Must be positioned **below** the minimap, not overlapping it
- **Bug (to fix)**: Debug/ammo text currently overlaps the top-left corner of the minimap circle instead of sitting below it. Reposition so it renders beneath the minimap.
- **Ref frames**: `02-gameplay-respawn-full-hud.jpg`, `58-corrections-reloading-arc-progress-dead-enemy.jpg`

---

## Player Character

- **Head**: Dark brown/black circle (~20-30px diameter)
- **Body**: Black stick figure with visible limbs
- **Label**: "YOU" in white bold text with dark shadow, ~14px, floats above head
- **Weapon**: Dark stick extending from body in aim direction
- **Aim direction**: Character arm/gun rotates to follow crosshair/mouse position
- **Bug (to fix)**: A short green horizontal bar/line renders near the player's head in the current build. This does NOT appear in the original prototype. It should be removed — it is not part of the intended visual design. Likely an erroneous health bar or debug indicator rendered on the player sprite itself rather than in the HUD.
  - **Ref frames**: `53-corrections-aim-line-overshoots-cursor.jpg`, `56-corrections-shooting-damage-number-on-enemy.jpg`, `63-corrections-ak47-equipped-aim-line-cursor.jpg`, `65-corrections-aiming-at-red-enemy-two-players.jpg`
- **Crosshair cursor**: Small crosshair reticle (`⊕`) — a circle with a `+` inside, ~20-25px diameter, follows mouse position
  - **Correction**: NOT a large 40-60px circle. The reticle is compact and sits at the exact mouse cursor location.
  - No evidence of size expansion during firing in corrected footage
- **Ref frames**: `02-gameplay-respawn-full-hud.jpg`, `03-gameplay-player-moving-right.jpg`, `54-corrections-aim-line-terminates-at-cursor.jpg`, `59-corrections-aim-line-short-reticle-near-player.jpg`, `64-corrections-ak47-aiming-small-crosshair-reticle.jpg`, `69-corrections-small-crosshair-reticle-at-cursor.jpg`

---

## Enemy Characters

- **Head**: Bright red circle (`#FF0000`, ~25-30px diameter)
- **Body**: Black stick figure (same as player but with red head)
- **Name label**: Player name in gray/white text above head (~12-14px)
  - Observed names: "Sniper", "Lag", "X_x_X", "Camper", "Reaper", "Guest123"
- **Health number**: Red "20" text displayed near enemy (health or damage indicator)
- **Yellow ring**: Yellow circle outline (~50px) around enemies, possibly indicating:
  - Spawn protection/invulnerability
  - Highlighted/targeted state
  - Active enemy indicator
- **Special case**: "Guest123" rendered with WHITE body (not black), possibly indicating a different team or newly connected player
- **Bug (to fix)**: Enemy weapon is nearly invisible in the current build — only a tiny dark nub/stub renders on the enemy body. In the original prototype, enemy weapons are clearly visible, full-sized, and proportional to the player's weapon. Enemy weapons should match the scale and visibility of the player's weapon.
  - **Ref frames (prototype — correct)**: `04-combat-shooting-muzzle-flash-bullet.jpg`, `07-multi-enemy-combat-low-ammo.jpg`, `22-three-enemies-camper-appears.jpg`
  - **Ref frames (current build — bug)**: `65-corrections-aiming-at-red-enemy-two-players.jpg`, `66-corrections-cursor-on-enemy-about-to-shoot.jpg`

---

## Combat Visuals

### Muzzle Flash
- Bright yellow/orange flame shape at gun barrel tip
- Small (~8px), appears for 1-2 frames during firing
- **Ref frames**: `04-combat-shooting-muzzle-flash-bullet.jpg`, `18-firing-left-muzzle-flash-bullet-trail.jpg`

### Bullet/Projectile
- White triangular arrow shape (chevron) traveling in aim direction
- Orange/yellow line segments (~20px) as bullet trails
- Small yellow dots (~4px) as shell casings or impact particles
- **Ref frames**: `04-combat-shooting-muzzle-flash-bullet.jpg`, `21-heavy-fire-multiple-projectiles.jpg`

### Aim/Trajectory Line
- Thin white line connecting the player's gun barrel **to the crosshair cursor position** — it terminates exactly at the cursor, it does NOT extend beyond it
- **Correction**: This is NOT a bullet trail. It is a live aim line that updates every frame as the mouse moves.
- Always present while aiming; disappears when cursor is very close to player
- **Ref frames**: `11-shooting-downward-trajectory-line.jpg`, `48-firing-upward-aim-line.jpg`, `53-corrections-aim-line-overshoots-cursor.jpg`, `54-corrections-aim-line-terminates-at-cursor.jpg`, `55-corrections-aim-line-far-overshoot-bottom.jpg`, `70-corrections-aim-line-long-diagonal-to-cursor.jpg`

### Damage Numbers (Floating)
- Red bold text ("20", "12") floating near hit location
- ~20-30px font size
- Float upward and fade out
- **Ref frames**: `23-damage-number-20-three-way-fight.jpg`, `35-kill-confirmed-damage-numbers-20.jpg`

### Hit Direction Indicators
- Red triangular chevrons/arrows near player
- Point toward the source of incoming damage
- **Ref frames**: `26-hit-direction-indicators-76-health.jpg`

### Blood Effects
- Pink/red splatters on hit
- Small particle effects
- **Ref frames**: `07-multi-enemy-combat-low-ammo.jpg`, `34-shooting-camper-blood-tracers.jpg`

### Damage Screen Flash
- Entire viewport gets red tint overlay (~30-40% opacity red)
- All game elements tinted reddish-pink
- Background becomes muted rose/salmon
- Platforms become dark maroon
- **Ref frames**: `05-damage-taken-red-screen-flash.jpg`

---

## Weapon System

### Default Weapon (Pistol/SMG)
- Magazine: 20 rounds
- Ammo display: "20/20" in yellow/orange
- Fires individual bullets with orange trails

### Shotgun
- Magazine: 6 rounds
- Ammo display: "6/6" in yellow
- Picked up from weapon crates
- Pickup notification: "Picked up SHOTGUN" fading gray text at center screen
- **Ref frames**: `40-picked-up-shotgun-notification.jpg`, `42-shotgun-firing-at-guest123.jpg`

### Default/Fists (Infinite Ammo)
- Ammo display: "INF" in yellow
- Appears when no gun is equipped or as fallback
- **Ref frames**: `46-infinite-ammo-weapon-switch.jpg`

### Reload Mechanic
- Triggered at 0 ammo
- Visual indicators:
  - Ammo icon changes to red rotating arrows (spinner)
  - "RELOADING..." text in red/coral to the right of ammo counter
  - Green arc sweeps around the player character (progress indicator), centered on the player body
- **Bug (to fix)**: Reload arc is misaligned — it sweeps only on the right side of the player rather than centering around the player body. The arc origin point must be centered on the player.
- **Ref frames**: `08-reloading-progress-bar.jpg`, `14-post-respawn-reloading-enemy-above.jpg`, `58-corrections-reloading-arc-progress-dead-enemy.jpg`

---

## Health System

### Health Bar States
- **Full (100%)**: Solid green bar, "100%" text
- **Damaged (20-99%)**: Partially filled green bar, depleted portion is dark/navy
- **Critical (<20%)**: Bar color changes from green to RED, percentage in white
- **Regeneration**: Health slowly recovers over time (observed 16% -> 34% -> 74% -> 100%)
- **Ref frames**: `09-critical-health-red-bar.jpg`, `29-health-regen-81-percent.jpg`

### Damage Feedback
1. Health bar decreases with percentage update
2. Red screen flash overlay on the entire viewport
3. Red directional chevrons pointing toward damage source
4. Blood particle effects on the player
- **Ref frames**: `05-damage-taken-red-screen-flash.jpg`, `26-hit-direction-indicators-76-health.jpg`

---

## Death & Respawn

### Death Screen
- Dark semi-transparent overlay (~70% opacity black) over the game world
- **"YOU DIED"** - Large bold white text, centered, ~72px font
- **Trophy icon** - Yellow/gold, center-left
- **Score** - Red number below trophy (e.g., "0")
- **Skull icon** - Red, center-right
- **Kill count** - White text next to skull (e.g., "0 Kills")
- **"TRY AGAIN" button** - Rectangular, thin white border, white text, centered below stats
- **Ref frames**: `01-death-screen-you-died-overlay.jpg`

### Enemy Death Animation
- Body enters ragdoll "X" pose (limbs spread out)
- Yellow circle outline (~50px) surrounds the body
- Head changes to gray (from red)
- Body persists on the ground for several seconds
- Fades out gradually (ghost/translucent effect observed)
- **Ref frames**: `19-enemy-killed-ragdoll-death-pose.jpg`, `45-dead-enemy-xpose-ragdoll.jpg`

### Respawn
- Player respawns at a spawn point with:
  - 100% health
  - 0/20 ammo (starts reloading immediately)
  - Same score and kill count preserved
- **Ref frames**: `02-gameplay-respawn-full-hud.jpg`, `14-post-respawn-reloading-enemy-above.jpg`

---

## Map & Environment

### Background
- Light gray (`#C8CCC8`) with subtle grid pattern
- Grid lines form large squares (lighter gray `#D8DCD8`)
- Provides spatial reference for movement
- **Bug (to fix)**: Grid pattern is not rendering — background appears as flat solid gray with no grid lines visible in the current build.
- **Ref frames**: `53-corrections-aim-line-overshoots-cursor.jpg` (no grid visible vs intended spec)

### Platforms (Brown Blocks) -- *From Prototype -- Not Yet Implemented*

> **Note:** The following platform geometry was observed in the prototype video but has not been implemented. The current arena is a flat 1920x1080 rectangle with no internal geometry.

- Dark brown/maroon (`#7A4A3A`)
- Rectangular, ~170x80-100px each
- Arranged in grid patterns (typically 3x2 rows)
- Regular spacing between blocks
- Players can stand on top, walk between gaps
- **Ref frames**: `31-platform-grid-layout-visible.jpg`

### Walls (Dark Structures) -- *From Prototype -- Not Yet Implemented*

> **Note:** The following wall geometry was observed in the prototype video but has not been implemented. The current arena has boundary-edge collision only (the outer 1920x1080 rectangle). There are no internal walls, corridors, or rooms.

- Dark charcoal/slate (`#4A5A5A`)
- Large horizontal bars and vertical bars
- Form corridors and enclosed rooms
- Create distinct map zones:
  - **Open areas**: Platform grids with large sightlines
  - **Corridor areas**: Tight passages formed by walls
- **Ref frames**: `38-walled-corridor-area.jpg`

### Map Zones -- *From Prototype -- Not Yet Implemented*

> **Note:** The following zone layout was observed in the prototype video but has not been implemented. The current arena is a single open zone with no internal structures.

The level has two distinct zone types:
1. **Open platform grid**: Brown blocks in 3x2 arrangements with open space between them
2. **Walled corridors**: Dark charcoal walls forming L-shapes, rooms, and narrow passages

---

## Weapon Crates

- **Appearance**: Yellow circle outline (~40px diameter) with a `+` (crosshair/plus) icon inside — **Correction**: not a "dark rectangular" icon, it is the same crosshair `⊕` symbol used for the player cursor
- **Color**: Clean yellow (`#CCCC00`) — consistent across all crates
- **Respawning**: Faded/ghostly yellow circle indicates a crate that has been collected and is respawning
- **Pickup notification**: Center-screen fading gray text: "Picked up [WEAPON NAME]" — weapon name must be uppercase (e.g., "Picked up AK47", not "Picked up ak47")
- **Proximity prompt**: When the player is near a crate, a dark rectangular tooltip appears at bottom-center of screen: **"Press E to pick up [WEAPON NAME]"** (dark background, white text, ~14px)
- **Scattered placement**: Multiple crates visible across the map at any time; all crates should be the same size
- **Bug (to fix)**: Crate ring color has a yellow-green tint instead of clean yellow, and crate ring sizes are inconsistent across instances.
- **Bug (to fix)**: Pickup confirmation text uses lowercase weapon name (e.g., "ak47") — must match the uppercase format used in the proximity prompt.
- **Ref frames**: `17-weapon-crate-pickup-visible.jpg`, `20-new-enemy-lag-weapon-crate.jpg`, `40-picked-up-shotgun-notification.jpg`, `61-corrections-press-e-pickup-ak47-tooltip.jpg`, `62-corrections-picked-up-ak47-confirmation.jpg`

---

## Chat System

- **Position**: Bottom-left corner
- **Size**: ~300x120px
- **Background**: Dark semi-transparent panel (`#808080` @ ~70% opacity) — the game world must be partially visible through the panel
- **System messages**: Yellow text (`#BBA840`), prefixed with "[SYSTEM]"
  - "Welcome to Stick Rumble. Survive."
  - "GAME OVER! Score: N"
  - "Restarting..."
- **Player messages**: Player name in red/orange, message in white
  - e.g., "Reaper: Bruh"
- **Font**: Sans-serif, ~14px
- **Bug (to fix)**: Chat panel is rendering as a flat opaque gray rectangle with no transparency — the game background is not visible through it. Must be semi-transparent.
- **Ref frames**: `02-gameplay-respawn-full-hud.jpg`, `28-idle-chat-message-reaper-bruh.jpg`, `53-corrections-aim-line-overshoots-cursor.jpg`

---

## Scoring

- **Points per kill**: +100
- **Display**: 6-digit zero-padded (e.g., "000100", "000500")
- **Kill tracking**: Separate "KILLS: N" counter
- **Death screen**: Shows final score and kill count with trophy/skull icons
- **Ref frames**: `06-post-kill-score-increment.jpg`, `44-kill-confirmed-score-500-kills-5.jpg`

---

## Frame Reference

| Frame | Timestamp | Key Content |
|-------|-----------|-------------|
| `01-death-screen-you-died-overlay.jpg` | 0s | Death screen with "YOU DIED", stats, "TRY AGAIN" button |
| `02-gameplay-respawn-full-hud.jpg` | 1s | Fresh respawn, full HUD visible, all elements labeled |
| `03-gameplay-player-moving-right.jpg` | 2s | Player movement, aim direction follows mouse |
| `04-combat-shooting-muzzle-flash-bullet.jpg` | 3s | First combat, muzzle flash, bullet in flight, enemy "Sniper" |
| `05-damage-taken-red-screen-flash.jpg` | 4s | Full-screen red damage overlay, health at 76% |
| `06-post-kill-score-increment.jpg` | 5s | Score +100, kills +1, yellow spawn ring on enemy |
| `07-multi-enemy-combat-low-ammo.jpg` | 6s | 2 enemies, blood effects, 56% health, 5/20 ammo |
| `08-reloading-progress-bar.jpg` | 7s | Reload state: spinner icon, "RELOADING..." text, progress bar above player |
| `09-critical-health-red-bar.jpg` | 8s | 16% health, bar turned RED (critical), still reloading |
| `10-reload-complete-low-health.jpg` | 9s | Reload done (20/20), still at 16% health |
| `11-shooting-downward-trajectory-line.jpg` | 10s | White aim line, shooting downward at enemies below |
| `12-combat-bullet-trails-health-regen.jpg` | 11s | Health regenerating (34%), green muzzle particles |
| `13-near-wall-green-muzzle-particles.jpg` | 12s | Health at 74% (regen continues), near large wall |
| `14-post-respawn-reloading-enemy-above.jpg` | 13s | Post-respawn, reloading, enemy "XxX" above |
| `15-reloading-enemy-moving.jpg` | 14s | Still reloading, enemy repositioning |
| `16-reload-complete-full-ammo.jpg` | 15s | Reload done, ammo icon changes from red spinner to yellow target |
| `17-weapon-crate-pickup-visible.jpg` | 16s | Weapon crate on ground (gray circle, red dot center) |
| `18-firing-left-muzzle-flash-bullet-trail.jpg` | 17s | Firing LEFT, muzzle flash + orange bullet trail mid-flight |
| `19-enemy-killed-ragdoll-death-pose.jpg` | 18s | Enemy killed, ragdoll X-pose, yellow death circle, score +100 |
| `20-new-enemy-lag-weapon-crate.jpg` | 19s | New enemy "Lag" spawned, weapon crate with yellow highlight |
| `21-heavy-fire-multiple-projectiles.jpg` | 20s | 7 active bullets, heavy combat, muzzle flash + trails |
| `22-three-enemies-camper-appears.jpg` | 21s | 3 enemies including new "Camper" with rifle weapon |
| `23-damage-number-20-three-way-fight.jpg` | 22s | Red "20" damage number, three-way fight, "Camper" shooting |
| `24-reloading-under-fire-damage-12.jpg` | 23s | Reloading while under fire, "12" damage number |
| `25-reloading-dead-bodies-fading.jpg` | 24s | Dead bodies fading (translucent ghost effect) |
| `26-hit-direction-indicators-76-health.jpg` | 25s | Red chevron hit indicators, new enemy "Reaper", 76% health |
| `27-combat-score-300-kills-3.jpg` | 26s | Score 300, kills 3, active shooting with damage "20" |
| `28-idle-chat-message-reaper-bruh.jpg` | 27s | Player chat: "Reaper: Bruh", idle moment |
| `29-health-regen-81-percent.jpg` | 28s | Health regen to 81%, green dot on player |
| `30-reloading-player-falling.jpg` | 29s | Reloading, player appears rotated/falling |
| `31-platform-grid-layout-visible.jpg` | 30s | Clear 3x2 platform grid pattern visible |
| `32-reload-complete-large-walls.jpg` | 31s | Full ammo, large dark wall structures visible |
| `33-aiming-at-camper-crosshair.jpg` | 32s | Crosshair directly on "Camper" (red body enemy) |
| `34-shooting-camper-blood-tracers.jpg` | 33s | Shooting "Camper", blood drip trail, orange tracers |
| `35-kill-confirmed-damage-numbers-20.jpg` | 34s | Kill confirmed, two "20" damage floats, score +100, kills 4 |
| `36-post-kill-exploring-map.jpg` | 35s | Post-kill exploration, dark walls prominent |
| `37-close-quarters-standoff.jpg` | 36s | Enemy ~170px away, standoff before engagement |
| `38-walled-corridor-area.jpg` | 37s | Map zone: corridor/room section formed by walls |
| `39-guest123-white-player-corridors.jpg` | 38s | "Guest123" with WHITE body, different from black enemies |
| `40-picked-up-shotgun-notification.jpg` | 39s | "Picked up SHOTGUN" notification, ammo now 6/6 |
| `41-shotgun-equipped-weapon-crates.jpg` | 40s | Shotgun equipped, multiple weapon crates visible |
| `42-shotgun-firing-at-guest123.jpg` | 41s | Firing shotgun at "Guest123", health "20" shown |
| `43-shotgun-combat-continued.jpg` | 42s | Continued shotgun fire, 3 active bullets |
| `44-kill-confirmed-score-500-kills-5.jpg` | 43s | Kill 5, score 500, "20" damage float, X-pose death |
| `45-dead-enemy-xpose-ragdoll.jpg` | 44s | Dead enemy ragdoll persisting on ground |
| `46-infinite-ammo-weapon-switch.jpg` | 45s | Ammo shows "INF", weapon switched, "Camper" reappears |
| `47-picked-up-weapon-fading-text.jpg` | 46s | "Picked up E..." fading text, entity count 3 |
| `48-firing-upward-aim-line.jpg` | 47s | Pink/white aim line firing upward at "Camper" |
| `49-aiming-at-camper-above.jpg` | 48s | Crosshair on "Camper" above on platform |
| `50-tracking-camper-on-platform.jpg` | 49s | Tracking enemy on upper platform level |
| `51-camper-moving-right-tracking.jpg` | 50s | "Camper" moving right, player tracking |
| `52-final-frame-aiming-upward.jpg` | 51s | Final frame, aiming upward at distant "Camper" |

### Corrections Video Frames (Corrections.mov)

| Frame | Key Content |
|-------|-------------|
| `53-corrections-aim-line-overshoots-cursor.jpg` | Aim line extends well past the cursor to the far right — bug demonstration of overshoot |
| `54-corrections-aim-line-terminates-at-cursor.jpg` | Aim line correctly terminates at the small crosshair reticle at cursor — corrected behavior |
| `55-corrections-aim-line-far-overshoot-bottom.jpg` | Aim line shoots far past cursor to the bottom-right corner — severe overshoot bug |
| `56-corrections-shooting-damage-number-on-enemy.jpg` | Player shooting at red enemy, "-35" floating damage number, bullet trail visible |
| `57-corrections-aim-line-cursor-reticle-first-kill.jpg` | Aim line to cursor with small reticle; score 000100, KILLS:1 visible top-right |
| `58-corrections-reloading-arc-progress-dead-enemy.jpg` | Reload state: green arc progress indicator around player, "RELOADING..." in HUD, dead enemy on screen |
| `59-corrections-aim-line-short-reticle-near-player.jpg` | Very short aim line with small crosshair reticle positioned close to the player |
| `60-corrections-aim-line-to-cursor-reticle-left.jpg` | Aim line extending lower-left to cursor, small reticle correctly at cursor position |
| `61-corrections-press-e-pickup-ak47-tooltip.jpg` | "Press E to pick up AK47" dark tooltip at bottom-center when near weapon crate |
| `62-corrections-picked-up-ak47-confirmation.jpg` | "Picked up ak47" confirmation text floating next to player after collecting weapon |
| `63-corrections-ak47-equipped-aim-line-cursor.jpg` | AK47 rifle visible on player sprite, aim line to cursor, small reticle at cursor |
| `64-corrections-ak47-aiming-small-crosshair-reticle.jpg` | AK47-equipped player aiming lower-right, small (~20px) crosshair reticle at cursor |
| `65-corrections-aiming-at-red-enemy-two-players.jpg` | Two players — local AK47 player aiming toward red enemy player on the right |
| `66-corrections-cursor-on-enemy-about-to-shoot.jpg` | Cursor positioned on top of red enemy, aim line reaching them |
| `67-corrections-shoot-hit-enemy-score-kills-2.jpg` | Hit on enemy, score 000200, KILLS:2 in top-right |
| `68-corrections-minimap-dot-faded-after-second-kill.jpg` | Minimap dot appears gray/faded indicating dead enemy; dot visible outside radar boundary |
| `69-corrections-small-crosshair-reticle-at-cursor.jpg` | Demonstration of correctly sized small crosshair reticle (~20px) at cursor position |
| `70-corrections-aim-line-long-diagonal-to-cursor.jpg` | Long diagonal aim line from player upper-right down to cursor in lower-center |
| `71-corrections-cursor-directly-above-player-short-line.jpg` | Cursor directly above player head, short upward aim line with reticle at cursor |

---

## Game Systems Summary

| System | Details |
|--------|---------|
| Art Style | Flat 2D, minimal textures, stick figures with circle heads |
| Characters | Black stick figures (player), red heads (enemies), white body (Guest123) |
| HUD | Minimap (TL), health+ammo (TC-L), score+kills (TR), chat (BL), debug (L) |
| Health | %-based, green bar, red when critical, passive regen over time |
| Ammo | Magazine-based (20 for pistol, 6 for shotgun, INF for fists) |
| Reload | Progress bar above player, spinner icon, "RELOADING..." text |
| Combat | Aim line, muzzle flash, bullet trails, damage numbers, hit indicators |
| Death | "YOU DIED" overlay, trophy+skull stats, "TRY AGAIN" button |
| Enemy Death | X-pose ragdoll, yellow circle, fade-out over time |
| Scoring | +100 per kill, 6-digit zero-padded display |
| Weapons | Pistol (20 mag), Shotgun (6 mag), Fists (INF), picked up from crates |
| Map | Light gray grid background, brown platform blocks, dark charcoal walls |
| Map Zones | Open platform grids + enclosed wall corridors |
| Chat | System messages (yellow) + player messages (red name, white text) |
