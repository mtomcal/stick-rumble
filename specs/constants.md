# Constants

> **Spec Version**: 1.3.0
> **Last Updated**: 2026-02-17
> **Depends On**: None (foundational spec)
> **Depended By**: [arena.md](arena.md), [player.md](player.md), [movement.md](movement.md), [dodge-roll.md](dodge-roll.md), [weapons.md](weapons.md), [shooting.md](shooting.md), [melee.md](melee.md), [hit-detection.md](hit-detection.md), [match.md](match.md), [rooms.md](rooms.md), [networking.md](networking.md), [audio.md](audio.md), [ui.md](ui.md), [graphics.md](graphics.md)

---

## Overview

This specification is the **single source of truth** for all magic numbers, configuration values, and tuning parameters in Stick Rumble. Every gameplay-affecting constant is defined here with its value, unit, and the **reason why** that specific value was chosen.

Constants serve three critical purposes:
1. **Synchronization**: Client and server must use identical values for physics, collision, and timing
2. **Balance**: Combat values are tuned for specific time-to-kill (TTK) and gameplay feel
3. **Reproducibility**: An AI agent implementing the game from scratch can achieve identical behavior

**Critical Rule**: Constants defined here MUST match the values in both `stick-rumble-server/internal/game/constants.go` (Go) and `stick-rumble-client/src/shared/constants.ts` (TypeScript).

---

## Dependencies

### Technology Dependencies

| Technology | Version | Purpose |
|------------|---------|---------|
| Go | 1.25 | Server-side constant definitions |
| TypeScript | 5.9.3 | Client-side constant definitions |

### File Locations

| Language | File Path | Purpose |
|----------|-----------|---------|
| Go | `stick-rumble-server/internal/game/constants.go` | Primary server constants |
| Go | `stick-rumble-server/internal/game/weapon.go` | Weapon-specific constants |
| Go | `stick-rumble-server/internal/game/match.go` | Match configuration |
| TypeScript | `stick-rumble-client/src/shared/constants.ts` | Client-side constants |
| JSON | `weapon-configs.json` | Weapon configurations |

---

## Arena Constants

These define the game world boundaries.

| Constant | Value | Unit | Why |
|----------|-------|------|-----|
| ARENA_WIDTH | 1920 | px | Standard 1080p width; provides room for 8 players with comfortable spacing. 40 Phaser tiles at 48px each. |
| ARENA_HEIGHT | 1080 | px | Standard 1080p height; maintains 16:9 aspect ratio for modern displays. |

**TypeScript:**
```typescript
export const ARENA = {
  WIDTH: 1920,
  HEIGHT: 1080,
} as const;
```

**Go:**
```go
const (
    ArenaWidth  = 1920.0
    ArenaHeight = 1080.0
)
```

---

## Player Constants

### Hitbox Dimensions

| Constant | Value | Unit | Why |
|----------|-------|------|-----|
| PLAYER_WIDTH | 32 | px | Small enough for tight movement in combat, large enough for reliable hit detection. 1/60th of arena width. |
| PLAYER_HEIGHT | 64 | px | 2:1 aspect ratio for stick figure; tall silhouette makes headshots meaningful. |

**Why these values**: A 32x64 hitbox is ~3.3% of arena width, meaning ~30 player widths across the screen. This allows tactical positioning without feeling cramped.

### Health & Status

| Constant | Value | Unit | Why |
|----------|-------|------|-----|
| PLAYER_MAX_HEALTH | 100 | HP | Round number for easy mental math. 25 damage = 4 shots to kill (pistol baseline). |
| HEALTH_REGEN_DELAY | 5.0 | s | Long enough that combat commits are meaningful; short enough for recovery after winning fights. |
| HEALTH_REGEN_RATE | 10.0 | HP/s | Full heal in 10 seconds; creates tension between healing and re-engaging. |
| RESPAWN_DELAY | 3.0 | s | Long enough to feel the death; short enough to stay engaged. Matches arena shooter conventions. |
| SPAWN_INVULNERABILITY | 2.0 | s | Prevents spawn camping; short enough to not feel unfair to enemies. |

**Why 100 HP**: Allows weapons to deal 8-60 damage meaningfully. Lower HP would make weak weapons useless; higher HP would make combat tedious.

**Why 5s regen delay**: Creates a risk/reward decision - disengage to heal or press the attack?

---

## Movement Constants

| Constant | Value | Unit | Why |
|----------|-------|------|-----|
| MOVEMENT_SPEED | 200 | px/s | Player crosses arena (~1920px) in ~10 seconds. Fast enough for responsive controls, slow enough for aiming. |
| SPRINT_SPEED | 300 | px/s | 1.5x normal speed. Meaningful advantage for positioning, but with accuracy penalty. |
| SPRINT_MULTIPLIER | 1.5 | ratio | Applied to weapon spread while sprinting. Encourages stop-and-shoot gameplay. |
| ACCELERATION | 50 | px/s² | Reaches full speed in 4 seconds (200/50). Smooth start without feeling sluggish. |
| DECELERATION | 1500 | px/s² | Near-instant stop (~0.13s from full speed). Prevents "ice physics" sliding; inputs feel crisp and responsive. |

**Why 200 px/s**: At 60 FPS, player moves 3.33 px/frame. This is smooth pixel movement without subpixel jitter issues.

**Why asymmetric accel/decel**: Acceleration is gradual (50 px/s²) for smooth ramp-up, but deceleration is near-instant (1500 px/s²) so players stop within ~0.13 seconds when releasing input. This prevents "sliding on ice" and makes directional changes feel crisp — critical for client-side prediction accuracy.

**TypeScript:**
```typescript
export const MOVEMENT = {
  SPEED: 200,
  ACCELERATION: 50,
  DECELERATION: 1500,
} as const;
```

**Go:**
```go
const (
    MovementSpeed          = 200.0
    SprintSpeed            = 300.0
    SprintSpreadMultiplier = 1.5
    Acceleration           = 50.0
    Deceleration           = 1500.0
)
```

---

## Dodge Roll Constants

| Constant | Value | Unit | Why |
|----------|-------|------|-----|
| DODGE_ROLL_DURATION | 0.4 | s | Long enough to read visually; short enough to feel snappy (400ms is ~24 frames at 60 FPS). |
| DODGE_ROLL_DISTANCE | 100 | px | ~3 player widths. Enough to escape melee range or cross a gap, not enough to traverse the map. |
| DODGE_ROLL_VELOCITY | 250 | px/s | Derived: 100px / 0.4s = 250 px/s. Faster than sprint (300 px/s) for brief burst feel. |
| DODGE_ROLL_COOLDOWN | 3.0 | s | Prevents roll spam. One roll per engagement forces commitment to positioning. |
| DODGE_ROLL_INVINCIBILITY | 0.2 | s | First half of roll is invincible (200ms/400ms). High-skill iframe window. |

**Why 400ms duration**: Tested values from 200ms to 800ms. 400ms is readable for enemies but feels responsive to the player.

**Why 3s cooldown**: Matches shooter conventions (e.g., Destiny, Division). One dodge per fight creates tension.

**Why only 200ms i-frames**: Reward timing-based skill. Rolling early/late gets you hit during the vulnerable second half.

**Go:**
```go
const (
    DodgeRollDuration              = 0.4
    DodgeRollDistance              = 100.0
    DodgeRollVelocity              = DodgeRollDistance / DodgeRollDuration // 250 px/s
    DodgeRollCooldown              = 3.0
    DodgeRollInvincibilityDuration = 0.2
)
```

---

## Network Constants

| Constant | Value | Unit | Why |
|----------|-------|------|-----|
| SERVER_TICK_RATE | 60 | Hz | Industry standard for responsive shooters. 16.67ms per tick matches 60 FPS. |
| CLIENT_UPDATE_RATE | 20 | Hz | Bandwidth optimization. 50ms between updates is imperceptible with interpolation. |
| CLIENT_UPDATE_INTERVAL | 50 | ms | Derived: 1000ms / 20 Hz = 50ms. Used for scheduling position broadcasts. |
| RECONNECT_ATTEMPTS | 3 | count | Balances retry effort with user patience. 3 attempts × 1s = 3s max wait. |
| RECONNECT_DELAY | 1000 | ms | 1 second between attempts. Allows transient issues to resolve without flooding. |

**Why 60 Hz server**: Lower rates (30, 20) feel laggy for fast-paced combat. Higher rates (128, 256) provide diminishing returns for browser-based games.

**Why 20 Hz client updates**: Sending at 60 Hz would triple bandwidth with no visible benefit. 20 Hz with interpolation is indistinguishable from 60 Hz.

**Desync window**: 2-3 server ticks occur between each client update, requiring client-side prediction for responsive controls.

**TypeScript:**
```typescript
export const NETWORK = {
  SERVER_TICK_RATE: 60,
  CLIENT_UPDATE_RATE: 20,
  CLIENT_UPDATE_INTERVAL: 1000 / 20, // 50ms
} as const;
```

**Go:**
```go
const (
    ServerTickRate       = 60
    ClientUpdateRate     = 20
    ServerTickInterval   = 1000 / ServerTickRate   // ~16.67ms
    ClientUpdateInterval = 1000 / ClientUpdateRate // 50ms
)
```

---

## Weapon Constants - General

| Constant | Value | Unit | Why |
|----------|-------|------|-----|
| PROJECTILE_SPEED | 800 | px/s | Fast enough to feel "instant" at close range; slow enough to see/dodge at long range. |
| PROJECTILE_MAX_LIFETIME | 1000 | ms | 1 second of flight time. Matches max range: 800 px/s × 1s = 800px. |
| PROJECTILE_MAX_RANGE | 800 | px | ~42% of arena width. Forces map movement; prevents cross-map camping. |
| WEAPON_PICKUP_RADIUS | 32 | px | Same as player width. Must be touching the crate to pick up. |
| WEAPON_RESPAWN_DELAY | 30 | s | Long enough to contest; short enough that weapons cycle during 7-minute matches. |

**Why 800 px/s projectile speed**: At maximum range (800px), projectile takes 1 second to arrive. Enemy can move 200px in that time (full dodge). This rewards prediction.

---

## Weapon Constants - Pistol (Default Weapon)

The pistol is the baseline all other weapons are balanced against.

| Constant | Value | Unit | Why |
|----------|-------|------|-----|
| PISTOL_DAMAGE | 25 | HP | 100 HP ÷ 25 = **4 shots to kill**. Baseline TTK ~1.3 seconds. |
| PISTOL_FIRE_RATE | 3.0 | shots/s | 333ms between shots. Fast enough for consistent DPS, slow enough for skill expression. |
| PISTOL_MAGAZINE_SIZE | 15 | rounds | 3+ kills per magazine. Encourages efficient shooting. |
| PISTOL_RELOAD_TIME | 1500 | ms | 1.5 seconds. Long enough to punish poor ammo management. |
| PISTOL_PROJECTILE_SPEED | 800 | px/s | See general projectile speed. |
| PISTOL_RANGE | 800 | px | Maximum effective range. No damage beyond this. |
| PISTOL_SPREAD | 0 | degrees | Perfectly accurate. Rewards aim skill for default weapon. |
| PISTOL_RECOIL | null | - | No recoil pattern. Consistent shot placement. |

**Why 4-shot kill**: Longer than average for pistols (usually 3), making it a backup weapon. Encourages picking up power weapons.

---

## Weapon Constants - Uzi (Spray Weapon)

High fire rate, low damage per shot. Close-range dominance.

| Constant | Value | Unit | Why |
|----------|-------|------|-----|
| UZI_DAMAGE | 8 | HP | 100 HP ÷ 8 = **13 shots to kill**. High volume compensates. |
| UZI_FIRE_RATE | 10.0 | shots/s | 100ms between shots. Full-auto spray feel. |
| UZI_MAGAZINE_SIZE | 30 | rounds | 2+ kills per magazine. Allows spray patterns. |
| UZI_RELOAD_TIME | 1500 | ms | Same as pistol. Punishing due to dependency on volume. |
| UZI_RANGE | 600 | px | Shorter than pistol. Forces close-range engagements. |
| UZI_SPREAD | 5.0 | degrees | ±5° spread. Encourages close range where spread is less impactful. |
| UZI_RECOIL_VERTICAL | 2.0 | degrees | Per-shot vertical climb. Creates recognizable spray pattern. |
| UZI_RECOIL_HORIZONTAL | 0.0 | degrees | No horizontal spray. Learnable vertical control. |
| UZI_RECOIL_RECOVERY | 0.5 | s | Half-second to reset. Encourages burst fire at range. |
| UZI_RECOIL_MAX | 20.0 | degrees | Maximum accumulated recoil. Caps spray-and-pray disadvantage. |

**Why 13 shots to kill**: At 10 shots/s, theoretical TTK is 1.2 seconds—slightly faster than pistol. But spread and recoil reduce effective DPS at range.

---

## Weapon Constants - AK47 (Balanced Assault Rifle)

Mid-range versatility with moderate recoil.

| Constant | Value | Unit | Why |
|----------|-------|------|-----|
| AK47_DAMAGE | 20 | HP | 100 HP ÷ 20 = **5 shots to kill**. Slightly weaker per-shot than pistol. |
| AK47_FIRE_RATE | 6.0 | shots/s | 166ms between shots. Automatic fire at controlled pace. |
| AK47_MAGAZINE_SIZE | 30 | rounds | Same as Uzi. Good for sustained engagements. |
| AK47_RELOAD_TIME | 2000 | ms | 2 seconds. Longest ranged reload. High-commitment weapon. |
| AK47_RANGE | 800 | px | Full arena range. Long-range capability. |
| AK47_SPREAD | 3.0 | degrees | ±3° spread while moving. Encourages ADS/stop-shooting. |
| AK47_RECOIL_VERTICAL | 1.5 | degrees | Less vertical climb than Uzi. |
| AK47_RECOIL_HORIZONTAL | 3.0 | degrees | Horizontal spray per shot. Harder to control than Uzi. |
| AK47_RECOIL_RECOVERY | 0.6 | s | Slightly slower recovery. Punishes long sprays. |
| AK47_RECOIL_MAX | 15.0 | degrees | Lower cap than Uzi. More controlled overall. |

**Why 5-shot kill**: At 6 shots/s, TTK is ~0.83 seconds—fastest ranged weapon. But horizontal recoil makes this theoretical.

---

## Weapon Constants - Shotgun (Close-Range Power)

High risk, high reward. One-shot potential at close range.

| Constant | Value | Unit | Why |
|----------|-------|------|-----|
| SHOTGUN_DAMAGE | 60 | HP | 100 HP ÷ 60 = **2 shots to kill**. Devastating at close range. |
| SHOTGUN_FIRE_RATE | 1.0 | shots/s | 1000ms between shots. High commitment per shot. |
| SHOTGUN_MAGAZINE_SIZE | 6 | rounds | Low capacity. 3 kills per magazine max. |
| SHOTGUN_RELOAD_TIME | 2500 | ms | 2.5 seconds. Longest reload. Fatal if caught reloading. |
| SHOTGUN_RANGE | 300 | px | ~16% of arena width. Must close distance to use effectively. |
| SHOTGUN_ARC | 15.0 | degrees | Pellet spread arc. Creates spread pattern. |
| SHOTGUN_PELLET_COUNT | 8 | pellets | 8 pellets per shot. At close range, all hit for 60 total damage. |
| SHOTGUN_PELLET_DAMAGE | 7.5 | HP | 60 total ÷ 8 pellets = 7.5 HP per pellet. Rewards accuracy. |
| SHOTGUN_RECOIL | null | - | No recoil tracking. Each shot is independent. |
| SHOTGUN_SPREAD | 0 | degrees | No additional movement spread. Arc is the spread. |

**Why 8 pellets**: Allows partial hits at range. Close range = 60 damage (all pellets). Mid range = ~30-45 damage (some miss). Creates skill ceiling.

**Why 2-shot kill**: At 1 shot/s, TTK is 1 second—competitive with other weapons. But requires being within 300px (very close).

---

## Weapon Constants - Bat (Melee, Knockback)

Close-range melee with crowd control.

| Constant | Value | Unit | Why |
|----------|-------|------|-----|
| BAT_DAMAGE | 25 | HP | Same as pistol. **4 hits to kill**. |
| BAT_FIRE_RATE | 2.0 | swings/s | 500ms between swings. Fast melee option. |
| BAT_MAGAZINE_SIZE | 0 | - | Infinite swings. Melee never reloads. |
| BAT_RANGE | 90 | px | Prototype-tested range. ~3 player widths. Generous reach for melee commitment. |
| BAT_ARC | 80 | degrees | ±0.7 rad (~80°). Slightly tighter than 90° for more directional precision. |
| BAT_KNOCKBACK | 40 | px | 1.25 player widths. Disrupts enemy positioning. |

**Why 40px knockback**: Pushes enemy out of melee range (64px), forcing them to close distance again. Creates hit-and-run playstyle.

---

## Weapon Constants - Katana (Melee, High Skill)

High damage, longer reach, no knockback. Commit to the kill.

| Constant | Value | Unit | Why |
|----------|-------|------|-----|
| KATANA_DAMAGE | 45 | HP | 100 HP ÷ 45 = **3 hits to kill** (technically 2.22). |
| KATANA_FIRE_RATE | 1.25 | swings/s | 800ms between swings. Slower than bat. |
| KATANA_MAGAZINE_SIZE | 0 | - | Infinite swings. |
| KATANA_RANGE | 110 | px | Prototype-tested range. ~3.4 player widths. Longest melee reach rewards skill. |
| KATANA_ARC | 80 | degrees | Same arc as bat. ±0.7 rad. |
| KATANA_KNOCKBACK | 0 | px | No knockback. Victim stays in range for follow-up. |

**Why no knockback**: Katana is the "commit" weapon. You either kill them in 3 hits or they escape/kill you. Bat is "poke and retreat."

---

## Weapon Spawn Locations

Fixed positions for weapon crates. Coordinates based on arena percentages.

| Weapon | Position | Arena % | Why |
|--------|----------|---------|-----|
| Uzi | (960, 216) | (50%, 20%) | Center top. Easy access, low-tier weapon. |
| AK47 | (480, 540) | (25%, 50%) | Left mid. Contested power position. |
| Shotgun | (1440, 540) | (75%, 50%) | Right mid. Mirror of AK47. Balanced spawns. |
| Katana | (960, 864) | (50%, 80%) | Center bottom. High-risk melee in open area. |
| Bat | (288, 162) | (15%, 15%) | Top left corner. Early pickup for aggressive players. |

**Why these positions**: Creates a rough pentagon pattern. Players rotate to contest weapons. No single "best" spawn.

---

## Match Constants

| Constant | Value | Unit | Why |
|----------|-------|------|-----|
| KILL_TARGET_NORMAL | 20 | kills | Target for a 5-7 minute match. ~3 kills/minute pace. |
| TIME_LIMIT_NORMAL | 420 | s (7 min) | Long enough for comebacks; short enough for quick sessions. |
| KILL_TARGET_TEST | 2 | kills | Fast testing. Match ends in <30 seconds. |
| TIME_LIMIT_TEST | 10 | s | Fast testing time limit. |
| KILL_XP_REWARD | 100 | XP | Round number. 20 kills = 2000 XP per match. |
| MAX_PLAYERS_PER_ROOM | 8 | players | 4v4 or free-for-all with 8. Good density in 1920×1080 arena. |
| MIN_PLAYERS_TO_START | 2 | players | Minimum for competitive play. 1v1 is valid. |

**Why 20 kills**: At average 4 kills/death, a dominant player reaches 20 in ~5 minutes. Creates urgency.

**Why 7 minutes**: Long enough for multiple weapon cycles (30s respawn) and rotation. Short for a web game.

---

## Audio Constants

| Constant | Value | Unit | Why |
|----------|-------|------|-----|
| MAX_AUDIO_DISTANCE | 1000 | px | ~52% of arena width. Distant fights are silent; encourages map awareness. |

**Why 1000px**: Sounds beyond half the arena are distracting. Players focus on nearby combat.

---

## Visual Effects Constants

| Constant | Value | Unit | Why |
|----------|-------|------|-----|
| TRACER_WIDTH | 2 | px | Visible but not obstructive. Matches projectile diameter. |
| TRACER_FADE_DURATION | 100 | ms | Quick fade. Prevents visual clutter during sustained fire. |
| MUZZLE_FLASH_RADIUS | 8 | px | Small flash. Doesn't obscure aim. |
| MUZZLE_FLASH_DURATION | 50 | ms | 3 frames at 60 FPS. Brief pop of light. |
| PROJECTILE_DIAMETER | 4 | px | Visible but small. Encourages leading shots. |
| DAMAGE_NUMBER_DURATION | 800 | ms | Float-up time before fade. Shorter than 1s for snappier feel. |
| DAMAGE_NUMBER_FLOAT_Y | 50 | px | Vertical distance numbers float upward. |

---

## Melee Visual Constants

| Constant | Value | Unit | Why |
|----------|-------|------|-----|
| MELEE_ARC_COLOR | 0xFFFFFF | hex | White stroke-only arc. Prototype used white for all weapons (no per-weapon colors). |
| MELEE_ARC_STROKE_WIDTH | 2 | px | Thin stroke, visible but not obstructive. |
| MELEE_ARC_ALPHA | 0.8 | ratio | Slightly transparent to not block view. |
| MELEE_ARC_FADE_DURATION | 200 | ms | Quick fade after swing. |
| MELEE_SWING_ANGLE_FROM | -45 | degrees | Container rotation start. Winds up behind player. |
| MELEE_SWING_ANGLE_TO | 60 | degrees | Container rotation end. Full forward swing. |
| MELEE_SWING_DURATION | 100 | ms | Fast 100ms yoyo tween. Snappy feel. |
| MELEE_CAMERA_SHAKE_DURATION | 50 | ms | Brief screen shake on melee hit. |
| MELEE_CAMERA_SHAKE_INTENSITY | 0.001 | ratio | Subtle shake. Felt but not disorienting. |

---

## Blood Particle Constants

| Constant | Value | Unit | Why |
|----------|-------|------|-----|
| BLOOD_PARTICLE_COUNT | 5 | count | Per-hit burst. Enough for impact feel without clutter. |
| BLOOD_COLOR | 0xCC0000 | hex | Dark red. Distinct from UI elements. |
| BLOOD_RADIUS_MIN | 2 | px | Smallest particle size. |
| BLOOD_RADIUS_MAX | 5 | px | Largest particle size. Variety in burst. |
| BLOOD_SPEED_MIN | 50 | px/s | Slow particles linger near impact. |
| BLOOD_SPEED_MAX | 150 | px/s | Fast particles spray outward. |
| BLOOD_DRAG_FACTOR | 0.5 | ratio | Drag approximation factor -- effective distance = `speed * (duration/1000) * 0.5`. No physics body used; tween interpolates to pre-calculated endpoint. |
| BLOOD_DURATION | 500 | ms | Fade-out time. Brief but visible. |

---

## Healing Particle Constants

| Constant | Value | Unit | Why |
|----------|-------|------|-----|
| HEALING_PARTICLE_COLOR | 0x00FF00 | hex | Green. Universal "healing" color. |
| HEALING_PARTICLE_RADIUS | 2 | px | Small floating motes. |
| HEALING_PARTICLE_CHANCE | 0.15 | ratio | 15% chance per regen tick. Subtle ambient effect. |
| HEALING_PARTICLE_SPREAD | 25 | px | Random offset from player center. |
| HEALING_PARTICLE_FLOAT | 20 | px | Vertical rise distance. |
| HEALING_PARTICLE_DURATION | 600 | ms | Gentle float-up and fade. |

---

## Death Corpse Constants

| Constant | Value | Unit | Why |
|----------|-------|------|-----|
| CORPSE_COLOR | 0x444444 | hex | Dark gray. Clearly "dead" not active. |
| CORPSE_LIMB_WIDTH | 3 | px | Line thickness for splayed limbs. |
| CORPSE_LIMB_LENGTH | 20 | px | Length of each of 4 limbs. |
| CORPSE_LIMB_ANGLES | ±0.5, ±2.5 | rad | Four limbs splayed outward from rotation. |
| CORPSE_HEAD_RADIUS | 10 | px | Smaller than living head (13px). |
| CORPSE_HEAD_OFFSET | 25 | px | Distance along rotation axis from center. |
| CORPSE_VISIBLE_DURATION | 5000 | ms | 5 seconds visible. Long enough to read the kill. |
| CORPSE_FADE_DURATION | 2000 | ms | 2-second fade-out after visible period. |

---

## Camera Effects Constants

### Hit Feedback Shake

Triggered by `hit:confirmed` event (server-authoritative). Confirms the local player's shot landed.

| Constant | Value | Unit | Why |
|----------|-------|------|-----|
| HIT_FEEDBACK_SHAKE_DURATION | 50 | ms | Brief shake when dealing damage. Server-confirmed hit feedback. |
| HIT_FEEDBACK_SHAKE_INTENSITY | 0.001 | ratio | Subtle. Felt not seen. |

### Per-Weapon Recoil Shake

Triggered by `projectile:spawn` event (fires immediately on client). Provides instant tactile feedback per weapon type. Only applies to ranged weapons with meaningful recoil — Pistol, Bat, and Katana have no recoil shake.

| Constant | Value | Unit | Why |
|----------|-------|------|-----|
| RECOIL_SHAKE_DURATION | 100 | ms | Longer than hit feedback shake; sells the "kick" of firing. |
| RECOIL_SHAKE_UZI | 0.005 | ratio | Light spray weapon. Mild shake per bullet. |
| RECOIL_SHAKE_AK47 | 0.007 | ratio | Medium assault rifle. Moderate shake. |
| RECOIL_SHAKE_SHOTGUN | 0.012 | ratio | Heavy single shot. Strongest recoil shake. |

**Why separate from hit feedback?** Recoil shake is immediate client-side feedback on firing. Hit feedback shake is server-confirmed damage. They serve different purposes and can overlap (fire + hit in same frame).

### Bat Melee Hit Shake

Triggered on melee hit with the Bat weapon. Heavier than the standard hit feedback shake to sell the physicality of a melee swing connecting.

| Constant | Value | Unit | Why |
|----------|-------|------|-----|
| MELEE_HIT_SHAKE_DURATION | 150 | ms | Longer than ranged hit feedback. Emphasizes melee impact. |
| MELEE_HIT_SHAKE_INTENSITY | 0.008 | ratio | 8x stronger than hit feedback. Melee hits should feel heavy. |

### Camera Flash (Damage Received)

| Constant | Value | Unit | Why |
|----------|-------|------|-----|
| CAMERA_FLASH_DURATION | 100 | ms | Red flash when taking damage. |
| CAMERA_FLASH_R | 128 | 0-255 | Half-intensity red. Not blinding. |
| CAMERA_FLASH_G | 0 | 0-255 | No green component. |
| CAMERA_FLASH_B | 0 | 0-255 | No blue component. |

---

## Crosshair / Reticle Constants

| Constant | Value | Unit | Why |
|----------|-------|------|-----|
| RETICLE_TEXTURE_SIZE | 32 | px | 32x32 pre-generated texture. |
| RETICLE_RING_RADIUS | 10 | px | Outer aiming ring. |
| RETICLE_RING_STROKE | 2 | px | White stroke width. |
| RETICLE_CENTER_DOT_COLOR | 0xFF0000 | hex | Red center dot for precision aiming. |
| RETICLE_CENTER_DOT_RADIUS | 2 | px | Small precise dot. |
| RETICLE_TICK_LENGTH | 6 | px | Cardinal direction tick marks (top/bottom/left/right). |
| RETICLE_ALPHA | 0.8 | ratio | Slightly transparent to not obscure targets. |
| RETICLE_DEPTH | 100 | z-index | Above all game objects. |

---

## Hit Indicator Constants

| Constant | Value | Unit | Why |
|----------|-------|------|-----|
| HIT_INDICATOR_TEXTURE_SIZE | 16 | px | 16x16 chevron texture. |
| HIT_INDICATOR_DISTANCE | 60 | px | Radius from player center. |
| HIT_INDICATOR_OUTGOING_DURATION | 200 | ms | Short flash for outgoing damage. |
| HIT_INDICATOR_INCOMING_DURATION | 400 | ms | Longer for incoming damage (more important to notice). |
| HIT_INDICATOR_DEPTH | 1001 | z-index | Above most UI elements. |

---

## Hit Marker Constants

| Constant | Value | Unit | Why |
|----------|-------|------|-----|
| HIT_MARKER_TEXTURE_SIZE | 20 | px | 20x20 white X texture. |
| HIT_MARKER_STROKE_WIDTH | 3 | px | Bold X strokes. |
| HIT_MARKER_NORMAL_SCALE | 1.2 | ratio | Slight enlargement for visibility. |
| HIT_MARKER_KILL_SCALE | 2.0 | ratio | Double size + red tint for kill confirmation. |
| HIT_MARKER_KILL_COLOR | 0xFF0000 | hex | Red tint on kill. |
| HIT_MARKER_FADE_DURATION | 150 | ms | Quick fade. Snappy feedback. |
| HIT_MARKER_DEPTH | 1000 | z-index | Above game, below indicators. |

---

## Gun Recoil Constants

| Constant | Value | Unit | Why |
|----------|-------|------|-----|
| GUN_RECOIL_DEFAULT | -6 | px | Backward kick on fire. Subtle visual feedback. |
| GUN_RECOIL_SHOTGUN | -10 | px | Heavier kick for shotgun. Matches weapon weight feel. |
| GUN_RECOIL_DURATION | 50 | ms | Fast yoyo tween. Snap back to position. |

---

## Aim Sway Constants

| Constant | Value | Unit | Why |
|----------|-------|------|-----|
| AIM_SWAY_MOVING_SPEED | 0.008 | rad/ms | Faster oscillation while moving. |
| AIM_SWAY_MOVING_MAGNITUDE | 0.15 | rad | ~8.6° sway while moving. Significant accuracy penalty. |
| AIM_SWAY_IDLE_SPEED | 0.002 | rad/ms | Slow breathing sway while still. |
| AIM_SWAY_IDLE_MAGNITUDE | 0.03 | rad | ~1.7° sway while still. Nearly imperceptible. |

**Formula**: Composite sine for natural feel:
```
aimSway = (sin(time * swaySpeed) + sin(time * swaySpeed * 0.7)) * swayMagnitude
```

---

## Reload Animation Constants

| Constant | Value | Unit | Why |
|----------|-------|------|-----|
| RELOAD_ANIM_ALPHA | 0.5 | ratio | Weapon fades to 50% during reload pulse. |
| RELOAD_ANIM_SCALE | 0.8 | ratio | Weapon shrinks to 80% during pulse. |
| RELOAD_ANIM_PULSE_DURATION | 200 | ms | Duration of each pulse. |
| RELOAD_ANIM_PULSE_COUNT | 3 | count | Three pulses (yoyo × 2 repeat = 3 total). |

---

## Floor Grid Constants

| Constant | Value | Unit | Why |
|----------|-------|------|-----|
| FLOOR_GRID_SPACING | 100 | px | Grid line every 100px. Helps judge distances. |
| FLOOR_GRID_COLOR | 0xB0BEC5 | hex | Light blue-gray. Subtle, not distracting. |
| FLOOR_GRID_ALPHA | 0.5 | ratio | Half-transparent. Background element. |
| FLOOR_GRID_DEPTH | -1 | z-index | Below all game objects. |

---

## Minimap Constants

| Constant | Value | Unit | Why |
|----------|-------|------|-----|
| MINIMAP_X | 20 | px | Top-left corner X offset. |
| MINIMAP_Y | 20 | px | Top-left corner Y offset. |
| MINIMAP_SCALE | 0.075 | ratio | World-to-minimap scale factor. 1600px world → 120px minimap. |
| MINIMAP_SIZE | 120 | px | Derived: 1600 × 0.075 = 120. Compact but readable. |
| MINIMAP_RADAR_RANGE | 600 | px | Enemies beyond 600px not shown. Encourages map awareness. |
| MINIMAP_BG_DEPTH | 1999 | z-index | Static layer (walls, background). |
| MINIMAP_DYNAMIC_DEPTH | 2000 | z-index | Dynamic layer (players, enemies). |
| MINIMAP_PLAYER_DOT_RADIUS | 4 | px | Green dot. Slightly larger than enemies. |
| MINIMAP_ENEMY_DOT_RADIUS | 3 | px | Red dot. Smaller than player. |

---

## Damage Number Constants

| Constant | Value | Unit | Why |
|----------|-------|------|-----|
| DAMAGE_NUMBER_NORMAL_COLOR | #FFFFFF | hex | White for normal hits. |
| DAMAGE_NUMBER_NORMAL_SIZE | 16 | px | Standard font size. |
| DAMAGE_NUMBER_KILL_COLOR | #FF0000 | hex | Red for killing blow. |
| DAMAGE_NUMBER_KILL_SIZE | 24 | px | Larger for emphasis. |
| DAMAGE_NUMBER_REMOTE_SCALE | 0.7 | ratio | Dimmer/smaller for non-local-player damage. |
| DAMAGE_NUMBER_REMOTE_ALPHA | 0.8 | ratio | Slightly transparent for remote hits. |
| DAMAGE_NUMBER_STROKE_COLOR | #000000 | hex | Black outline for readability. |
| DAMAGE_NUMBER_STROKE_WIDTH | 2 | px | Thin outline. |
| DAMAGE_NUMBER_DEPTH | 1000 | z-index | Above game objects. |

---

## UI Constants

| Constant | Value | Unit | Why |
|----------|-------|------|-----|
| KILL_FEED_MAX_ENTRIES | 5 | entries | Fits in corner without scrolling. |
| KILL_FEED_FADE_TIME | 5000 | ms | 5 seconds visible. Long enough to process, short enough to clear. |
| HEALTH_BAR_WIDTH | 32 | px | Matches player width (32px). Fits above player head without overlap. |
| HEALTH_BAR_HEIGHT | 4 | px | Thin bar. Readable without obstructing player. |
| DODGE_ROLL_UI_RADIUS | 20 | px | Circular cooldown indicator size. |

---

## Failure Reason Strings

These constants define the reason codes sent in `shoot:failed` and melee failure messages.

### Ranged Attack Failures

| Constant | Value | Why |
|----------|-------|-----|
| SHOOT_FAILED_NO_PLAYER | "no_player" | Player not found in world state. |
| SHOOT_FAILED_COOLDOWN | "cooldown" | Fire rate not yet cooled down. |
| SHOOT_FAILED_EMPTY | "empty" | Magazine is empty. |
| SHOOT_FAILED_RELOADING | "reloading" | Currently in reload animation. |

### Melee Attack Failures

| Constant | Value | Why |
|----------|-------|-----|
| MELEE_FAILED_NO_PLAYER | "no_player" | Attacker player not found. |
| MELEE_FAILED_NO_WEAPON | "no_weapon" | Player has no weapon equipped. |
| MELEE_FAILED_NOT_MELEE | "not_melee" | Current weapon is not melee type. |
| MELEE_FAILED_PLAYER_DEAD | "player_dead" | Attacker is dead. |

**Go:**
```go
const (
    ShootFailedNoPlayer = "no_player"
    ShootFailedCooldown = "cooldown"
    ShootFailedEmpty    = "empty"
    ShootFailedReload   = "reloading"
)

const (
    MeleeFailedNoPlayer   = "no_player"
    MeleeFailedNoWeapon   = "no_weapon"
    MeleeFailedNotMelee   = "not_melee"
    MeleeFailedPlayerDead = "player_dead"
)
```

---

## Damage Falloff Formula

Damage decreases at range to reward close combat.

```
if (distance > maxRange * 0.5):
    damageFalloff = 1.0 - ((distance - maxRange * 0.5) / (maxRange * 0.5))
    actualDamage = baseDamage * damageFalloff
```

**Why 50% range**: First half of range deals full damage. Second half linearly falls to 0. Rewards positioning.

| Range % | Damage % |
|---------|----------|
| 0-50% | 100% |
| 75% | 50% |
| 100% | 0% |

---

## Test Scenarios

### TS-CONST-001: Movement speed matches client and server

**Category**: Unit
**Priority**: Critical

**Preconditions:**
- Client MOVEMENT.SPEED defined
- Server MovementSpeed defined

**Expected Output:**
- Both values equal 200

### TS-CONST-002: Arena dimensions match client and server

**Category**: Unit
**Priority**: Critical

**Preconditions:**
- Client ARENA.WIDTH and ARENA.HEIGHT defined
- Server ArenaWidth and ArenaHeight defined

**Expected Output:**
- WIDTH/ArenaWidth = 1920
- HEIGHT/ArenaHeight = 1080

### TS-CONST-003: Pistol kills in 4 shots

**Category**: Integration
**Priority**: High

**Preconditions:**
- Player at 100 HP
- Pistol does 25 damage

**Input:**
- 4 pistol shots hit player

**Expected Output:**
- Player health = 0 (dead)

### TS-CONST-004: Dodge roll cooldown prevents chaining

**Category**: Unit
**Priority**: High

**Preconditions:**
- Player just completed a dodge roll

**Input:**
- Immediate dodge roll attempt

**Expected Output:**
- Dodge roll rejected (on cooldown)
- Cooldown = 3.0 seconds

### TS-CONST-005: Weapon respawns after 30 seconds

**Category**: Integration
**Priority**: Medium

**Preconditions:**
- Weapon crate picked up

**Input:**
- Wait 30 seconds

**Expected Output:**
- Weapon crate IsAvailable = true

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-02-02 | Initial specification extracted from codebase |
| 1.1.0 | 2026-02-15 | Updated DECELERATION from 50 to 1500 px/s² to match source code (changed during Epic 4 client-side prediction work). Updated rationale text and code snippets. |
| 1.1.1 | 2026-02-16 | Fixed HEALTH_BAR_WIDTH (40→32) and HEALTH_BAR_HEIGHT (6→4) to match HealthBar.ts source code. |
| 1.2.0 | 2026-02-16 | Added 14 new constant tables for ported pre-BMM visual systems: melee visual, blood particles, healing particles, death corpse, camera effects, crosshair/reticle, hit indicators, hit markers, gun recoil, aim sway, reload animation, floor grid, minimap, damage numbers. Updated Bat range (64→90px), Katana range (80→110px), melee arc (90°→80°). |
| 1.3.0 | 2026-02-17 | Expanded Camera Effects Constants into four subsections: Hit Feedback Shake (renamed from generic CAMERA_SHAKE), Per-Weapon Recoil Shake (Uzi=0.005, AK47=0.007, Shotgun=0.012, 100ms duration), Bat Melee Hit Shake (150ms/0.008), Camera Flash. |
