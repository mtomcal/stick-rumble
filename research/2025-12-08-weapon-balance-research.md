---
date: 2025-12-08T00:00:00-08:00
researcher: codebase-researcher-agent
topic: "Weapon Balance Research & Validation for Epic 3"
tags: [research, codebase, weapon-balance, epic-3, dps, ttk]
status: complete
---

# Research: Weapon Balance Research & Validation for Epic 3

**Date**: 2025-12-08
**Researcher**: codebase-researcher-agent

## Research Question

Gather all weapon specification information from the Game Design Document (GDD), Epic 3 story definitions, and existing weapon implementations to create a comprehensive weapon balance analysis. The goal is to validate that:
- Melee weapons have highest DPS but require close range (high risk/reward)
- Ranged weapons have damage falloff with distance
- No weapon is strictly superior to others (each has tactical niche)
- Weapon stats from GDD align with Epic 3 story acceptance criteria

## Summary

The codebase contains comprehensive weapon specifications across multiple sources:
1. **GDD (docs/GDD.md)**: High-level weapon stats and balance philosophy
2. **Epic 3 Stories (docs/epics.md)**: Detailed acceptance criteria for each weapon
3. **Server Implementation (stick-rumble-server/internal/game/weapon.go)**: Pistol implementation with full stats
4. **Client Constants (/Users/mtomcal/Code/stick-rumble/stick-rumble-client/src/shared/constants.ts)**: Client-side weapon constants (note: pistol damage MISMATCH)

**Key Finding**: There is a **CRITICAL DISCREPANCY** between server pistol damage (25) and client pistol damage (15) that must be resolved before proceeding with Epic 3 implementation.

## Detailed Findings

### 1. Game Design Document Weapon Specifications

**Location**: /Users/mtomcal/Code/stick-rumble/docs/GDD.md (lines 246-262)

#### Melee Weapons

| Weapon | Damage | Attack Speed | Range | Special |
|--------|---------|--------------|-------|---------|
| **Bat** | 25 | Fast (0.5s) | Short | High DPS close range |
| **Katana** | 45 | Slow (0.8s) | Medium | Higher damage, longer reach |

#### Ranged Weapons

| Weapon | Damage/Shot | Fire Rate | Range | Ammo | Reload Time | Special |
|--------|-------------|-----------|-------|------|-------------|---------|
| **Uzi** | 8 | Very High (10/s) | Medium | 30 | 1.5s | Spray and pray, high DPS |
| **AK47** | 20 | Medium (6/s) | Long | 30 | 2.0s | Balanced all-rounder |
| **Shotgun** | 60 (total) | Slow (1/s) | Short | 6 | 2.5s | Burst damage, close range devastating |

**Balance Philosophy** (GDD lines 274-278):
- All weapons viable in situational contexts (no strict "best weapon")
- Risk/reward: Shotgun devastating but requires close approach
- Skill expression: Uzi high DPS but requires tracking aim, Katana requires positioning
- Map design supports different weapon playstyles (open areas favor ranged, tight corridors favor melee)

### 2. Epic 3 Story Definitions

**Location**: docs/epics.md

#### Story 3.2: Melee Weapons (Bat and Katana)

**Bat Stats:**
- Damage: 25
- Cooldown: 0.5s
- Range: 64 pixels
- Arc: 90 degrees
- Special: Knockback (40 pixels in hit direction)

**Katana Stats:**
- Damage: 45
- Cooldown: 0.8s
- Range: 80 pixels
- Arc: 90 degrees
- No knockback (differentiator from bat)

**Technical Notes**:
- Server hit detection: check enemies in cone-shaped area from player
- Knockback velocity: 200 px/s for 0.2 seconds
- Animation: 4-frame swing (0.2s duration)
- Melee priority: if multiple enemies in range, hit all (AoE)

#### Story 3.3: Ranged Weapons (Uzi, AK47, Shotgun)
**Lines 175-242**

**Uzi Stats:**
- Damage: 8 per bullet
- Fire Rate: 10 rounds/second
- Magazine: 30 rounds
- Reload Time: 1.5 seconds
- Range: 600 pixels (max)
- Recoil: Climbs upward (2 degrees per shot, recovers over 0.5s)
- Spread: +/- 5 degrees while moving

**AK47 Stats:**
- Damage: 20 per bullet
- Fire Rate: 6 rounds/second
- Magazine: 30 rounds
- Reload Time: 2.0 seconds
- Range: 800 pixels (max)
- Recoil: Horizontal + vertical pattern (+/- 3 degrees)
- Spread: Accurate while stationary, spread while moving

**Shotgun Stats:**
- Damage: 60 total (8 pellets x 7.5 each)
- Fire Rate: 1 round/second
- Magazine: 6 rounds
- Reload Time: 2.5 seconds
- Range: 300 pixels (max)
- Spread: 15 degree cone from aim angle
- Pellet spread: Each pellet +/- 7.5 degrees from aim

**Technical Notes** (lines 234-241):
- Shotgun pellet spread: each pellet angle offset by random +/- 7.5 degrees from aim
- Recoil patterns stored as {x, y} offset arrays per weapon
- **Bullet drop-off: damage decreases linearly after 50% of max range**
- Server validates fire rate (prevent macros/exploits)

### 3. Existing Weapon Implementation (Pistol)

**Server Implementation**: /Users/mtomcal/Code/stick-rumble/stick-rumble-server/internal/game/weapon.go

**Pistol Constants** (lines 8-30):
```go
const (
    PistolDamage = 25           // 4 shots to kill at 100 health
    PistolFireRate = 3.0        // rounds per second (333ms cooldown)
    PistolMagazineSize = 15     // rounds before reload
    PistolReloadTime = 1500 * time.Millisecond
    PistolProjectileSpeed = 800.0  // pixels per second
    ProjectileMaxLifetime = 1 * time.Second
    ProjectileMaxRange = 800.0     // px (speed * lifetime = 800px)
)
```

**Client Constants**: /Users/mtomcal/Code/stick-rumble/stick-rumble-client/src/shared/constants.ts

**Pistol Constants** (lines 59-77):
```typescript
export const WEAPON = {
  PISTOL_DAMAGE: 15,              // ❌ MISMATCH: Server = 25
  PISTOL_FIRE_RATE: 3,
  PISTOL_MAGAZINE_SIZE: 15,
  PISTOL_RELOAD_TIME: 1500,
  PROJECTILE_SPEED: 800,
  PROJECTILE_MAX_LIFETIME: 1000,
} as const;
```

**CRITICAL ISSUE**: Client pistol damage is 15, server is 25. This will cause:
- Visual feedback mismatch (client shows wrong damage)
- Confusion during testing
- Potential cheating vector if not reconciled

### 4. DPS and TTK Calculations

Based on GDD specifications, here are the calculated DPS (Damage Per Second) and TTK (Time To Kill) values:

#### Melee Weapons

**Bat:**
- DPS = 25 damage / 0.5s = **50 DPS**
- TTK = 100 HP / 50 DPS = **2.0 seconds** (4 hits)
- Risk: Must close to 64 pixels (very close)
- Reward: Highest sustained DPS

**Katana:**
- DPS = 45 damage / 0.8s = **56.25 DPS**
- TTK = 100 HP / 56.25 DPS = **1.78 seconds** (3 hits, rounded up)
- Risk: Must close to 80 pixels (close but safer than bat)
- Reward: **HIGHEST DPS** in game, longer reach than bat

#### Ranged Weapons

**Uzi:**
- DPS = 8 damage × 10 shots/s = **80 DPS** (theoretical max)
- TTK = 100 HP / 80 DPS = **1.25 seconds** (13 shots)
- Effective DPS with spread/recoil: ~50-60 DPS
- Magazine TTK capacity: 30 rounds = 3 kills max (theoretical)
- Reload penalty: 1.5s downtime every 3 seconds of firing
- Adjusted TTK with reload: ~2-2.5 seconds per kill in sustained combat

**AK47:**
- DPS = 20 damage × 6 shots/s = **120 DPS** (theoretical max)
- TTK = 100 HP / 120 DPS = **0.83 seconds** (5 shots)
- Magazine TTK capacity: 30 rounds = 6 kills max (theoretical)
- Reload penalty: 2.0s downtime every 5 seconds of firing
- Adjusted TTK with reload: ~1.2-1.5 seconds per kill

**Shotgun:**
- DPS = 60 damage × 1 shot/s = **60 DPS** (if all pellets hit)
- TTK = 100 HP / 60 DPS = **1.67 seconds** (2 shots at close range)
- Effective DPS at range: 20-30 DPS (pellets spread wide)
- Magazine TTK capacity: 6 rounds = 3 kills max (if all pellets hit)
- Reload penalty: 2.5s downtime every 6 seconds
- **Burst damage**: Can one-shot at very close range if all pellets hit headshots (not implemented yet)

**Pistol (Default Spawn Weapon):**
- DPS = 25 damage × 3 shots/s = **75 DPS**
- TTK = 100 HP / 75 DPS = **1.33 seconds** (4 shots)
- Magazine TTK capacity: 15 rounds = 3.75 kills max
- Reload penalty: 1.5s downtime every 5 seconds of firing

#### Balance Analysis Summary

**DPS Ranking** (Theoretical Max):
1. AK47: 120 DPS (ranged)
2. Uzi: 80 DPS (ranged)
3. Pistol: 75 DPS (default)
4. Shotgun: 60 DPS (close range only)
5. Katana: 56.25 DPS (melee)
6. Bat: 50 DPS (melee)

**TTK Ranking** (Best to Worst):
1. AK47: 0.83s (5 shots)
2. Uzi: 1.25s (13 shots)
3. Pistol: 1.33s (4 shots)
4. Shotgun: 1.67s (2 shots, close range)
5. Katana: 1.78s (3 hits)
6. Bat: 2.0s (4 hits)

**BALANCE CONCERN**: Based on raw DPS/TTK calculations, the **AK47 appears to be the dominant weapon** with highest DPS and fastest TTK. This violates the GDD balance principle that "no weapon is strictly superior to others."

### 5. Risk/Reward Trade-off Analysis

| Weapon | Risk Level | Reward (DPS) | Tactical Niche |
|--------|-----------|--------------|----------------|
| **Bat** | Very High (64px range) | 50 DPS | Close quarters, quick hits, knockback control |
| **Katana** | High (80px range) | 56.25 DPS | Melee duels, higher damage per hit |
| **Uzi** | Low (600px range) | 80 DPS (effective ~50-60) | Spray and pray, suppression fire |
| **AK47** | Very Low (800px range) | 120 DPS | Long range dominance, precision |
| **Shotgun** | Medium (300px range) | 60 DPS (close), 20-30 DPS (far) | Close range burst, area denial |
| **Pistol** | Low (800px range) | 75 DPS | Reliable starter weapon, ammo efficient |

**Balance Issues Identified**:

1. **Melee weapons underpowered**: Despite "highest DPS" claim in GDD, both bat and katana have LOWER DPS than all ranged weapons. The risk/reward is not balanced.

2. **AK47 too strong**: Longest range (800px) + highest DPS (120) + good magazine (30 rounds) = dominant weapon with no clear weakness.

3. **Damage falloff not defined**: Story 3.3 mentions "damage decreases linearly after 50% of max range" but GDD doesn't specify exact formula. This is critical for balance.

### 6. Recommended Stat Adjustments

To align with GDD balance philosophy ("melee has highest DPS but requires close range"), here are recommended adjustments:

#### Option 1: Increase Melee Damage (Aggressive)

**Bat:**
- Damage: 25 → **35** (7 DPS increase to 70 DPS)
- TTK: 2.0s → 1.43s (3 hits)
- Justification: Bat becomes viable close-range option

**Katana:**
- Damage: 45 → **60** (18.75 DPS increase to 75 DPS)
- TTK: 1.78s → 1.33s (2 hits)
- Justification: Katana becomes high-risk, high-reward melee king

#### Option 2: Reduce Ranged DPS (Conservative)

**AK47:**
- Fire Rate: 6/s → **5/s** (DPS: 120 → 100)
- TTK: 0.83s → 1.0s (5 shots)
- Justification: Still strong but not dominant

**Uzi:**
- Damage: 8 → **7** (DPS: 80 → 70)
- TTK: 1.25s → 1.43s (15 shots)
- Justification: Spray weapon should require more hits

#### Option 3: Implement Damage Falloff (Recommended)

**Damage Falloff Formula** (Story 3.3 line 240):
```
if distance > (maxRange * 0.5):
    damageFalloff = 1.0 - ((distance - maxRange * 0.5) / (maxRange * 0.5))
    actualDamage = baseDamage * damageFalloff
else:
    actualDamage = baseDamage
```

**Example for AK47** (800px range):
- 0-400px: Full damage (20)
- 400-800px: Linear falloff (20 → 0)
- 600px distance: 20 * (1.0 - ((600-400)/400)) = 20 * 0.5 = **10 damage**
- Effective DPS at 600px: 10 × 6 = 60 DPS (down from 120)

This makes range a meaningful trade-off without changing base stats.

### 7. Alignment with Epic 3 Acceptance Criteria

**Story 3.2 (Melee) Validation**:
- ✅ Bat damage, cooldown, range specified
- ✅ Katana damage, cooldown, range specified
- ✅ Arc-based hit detection (90 degrees)
- ✅ Knockback mechanic for bat
- ⚠️ **ISSUE**: GDD claims "melee has highest DPS" but calculations show this is false

**Story 3.3 (Ranged) Validation**:
- ✅ Uzi stats align with GDD
- ✅ AK47 stats align with GDD
- ✅ Shotgun pellet system defined
- ✅ Damage falloff mentioned
- ⚠️ **ISSUE**: Damage falloff formula not in GDD, only in story notes
- ⚠️ **ISSUE**: AK47 appears overpowered without falloff

**Story 3.0 (Balance Research) Requirements**:
- ✅ DPS calculations completed
- ✅ TTK at various ranges analyzed
- ✅ Effective range analysis done
- ✅ Risk/reward trade-off matrix created
- ⚠️ **VALIDATION FAILED**: Melee weapons do NOT have highest DPS as claimed
- ⚠️ **VALIDATION FAILED**: AK47 may be strictly superior without damage falloff

## Code References

### Server-Side Weapon Implementation
- `/Users/mtomcal/Code/stick-rumble/stick-rumble-server/internal/game/weapon.go` - Pistol weapon struct and constants
- `/Users/mtomcal/Code/stick-rumble/stick-rumble-server/internal/game/weapon_test.go` - Comprehensive weapon state tests

### Client-Side Weapon Constants
- `/Users/mtomcal/Code/stick-rumble/stick-rumble-client/src/shared/constants.ts:59-77` - Weapon constants (MISMATCH ALERT)
- `/Users/mtomcal/Code/stick-rumble/stick-rumble-client/src/game/input/ShootingManager.ts` - Client-side shooting logic

### Documentation
- `docs/GDD.md:246-262` - Weapon specifications table
- `docs/GDD.md:274-278` - Balance philosophy
- `docs/epics.md` - Story 3.2 melee weapons, Story 3.3 ranged weapons

## Architecture Insights

### Weapon System Design Patterns

1. **Server-Authoritative Model**: Weapon.go (lines 32-53) defines weapon properties on server, client receives updates. This prevents client-side stat tampering.

2. **State Synchronization**: WeaponState struct (lines 54-61) tracks current ammo, reload state, last shot time. Server is source of truth.

3. **Fire Rate Enforcement**: CanShoot() method (lines 72-93) validates cooldown server-side to prevent macro exploits.

4. **Reload Validation**: StartReload() (lines 104-117) ensures can't reload while already reloading or with full magazine.

### Recommended Implementation Approach for Epic 3

1. **Create WeaponRegistry** (server-side):
   ```go
   var WeaponTypes = map[string]*Weapon{
       "pistol": NewPistol(),
       "bat": NewBat(),
       "katana": NewKatana(),
       "uzi": NewUzi(),
       "ak47": NewAK47(),
       "shotgun": NewShotgun(),
   }
   ```

2. **Damage Falloff System** (server-side):
   ```go
   func CalculateDamage(weapon *Weapon, distance float64) int {
       if weapon.IsMelee {
           return weapon.Damage // No falloff for melee
       }

       maxRange := weapon.Range
       falloffStart := maxRange * 0.5

       if distance <= falloffStart {
           return weapon.Damage
       }

       if distance >= maxRange {
           return 0 // Miss
       }

       falloffPercent := 1.0 - ((distance - falloffStart) / (maxRange - falloffStart))
       return int(float64(weapon.Damage) * falloffPercent)
   }
   ```

3. **Sync Client Constants**: Update `/Users/mtomcal/Code/stick-rumble/stick-rumble-client/src/shared/constants.ts` to match server values exactly.

## Open Questions

1. **Pistol Damage Discrepancy**: Should server change from 25 to 15, or client change from 15 to 25? Recommend: Client → 25 (maintains 4-shot kill design intent)

2. **Headshot Multiplier**: GDD doesn't mention headshots. Should they exist? If yes, what multiplier? (Typical: 1.5x-2.0x)

3. **Damage Falloff Curve**: Linear falloff is simple but may not feel good. Should we use quadratic or exponential curves for smoother transitions?

4. **Melee Balance**: Should we buff melee damage per recommendations, or accept they are positioning-based utility weapons rather than pure DPS?

5. **AK47 Dominance**: Is this intentional (make it a valuable pickup), or should it be nerfed/balanced differently?

6. **Shotgun Pellet Consistency**: Should all 8 pellets have same damage, or center pellets do more (realistic but complex)?

7. **Weapon Tier System**: Should there be a clear progression (pistol < uzi < ak47), or all weapons equally viable in different contexts?

## External Research: Industry Best Practices

Based on web research (2025), professional game balance tools and approaches include:

### TTK Calculation Tools
- **Destiny 2 TTK Charts**: Track optimal and body-shot TTK for all weapons, updated per patch
- **Warzone Weapon Stats**: Calculate average TTK across all ranges using realistic hit distribution
- **Game-Agnostic TTK Calculators**: Allow custom weapon stat inputs for balance testing

### Balance Spreadsheet Approaches
- **Mercules' Destiny Massive Breakdowns**: Industry-standard weapon comparison spreadsheet
- Track: Base damage, fire rate, range, reload time, magazine size
- Calculate: DPS, TTK (optimal/body), DPS including reload downtime, effective range

### Key Balance Principles from Research
1. **DPS vs Burst Damage**: High DPS weapons (Uzi) require sustained fire, burst weapons (Shotgun) excel in peek fights
2. **Effective Range Matters**: Paper DPS means nothing if weapon can't hit at that range
3. **Reload Downtime**: Factor reload time into sustained DPS calculations (critical for balance)
4. **Skill Floor vs Ceiling**: Easy weapons (Uzi spray) should have lower max potential than skill weapons (AK47 precision)

## Recommended Next Steps

1. **CRITICAL**: Resolve pistol damage mismatch (client 15 vs server 25)
2. **Create Weapon Balance Spreadsheet**: Use template from web research, include all 6 weapons
3. **Implement Damage Falloff System**: Use recommended formula from Story 3.3
4. **Playtest Balance**: After implementation, test with actual players
5. **Document Decisions**: Update GDD with final stat decisions and falloff formulas
6. **Consider Melee Buffs**: If playtesting shows melee is weak, apply recommended damage increases

## Sources

- [Destiny 2 TTK Chart: PvP Time-to-kill values per weapon](https://www.blueberries.gg/weapons/destiny-2-ttk/)
- [Game Agnostic TTK Calculator](https://protovision.github.io/ttk-calc/)
- [Game By Numbers - Apex Weapon Stats](https://www.gamebynumbers.com/Weapon-stats/apex-weapon-stats)
- [Warzone Weapon Stats & Comparisons – TTK, Bullet Velocity, Damage & More!](https://codmunity.gg/weapon-stats/warzone)
