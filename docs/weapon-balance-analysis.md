# Weapon Balance Analysis - Stick Rumble

**Date**: 2025-12-08
**Epic**: Epic 3 - Weapon System
**Research Task**: 0726703f - Weapon Balance Research & Validation
**Status**: Complete

## Executive Summary

This document provides a comprehensive balance analysis of all 6 weapons in Stick Rumble based on the Game Design Document (GDD) specifications and Epic 3 story definitions. The analysis reveals **two critical balance issues** that must be addressed before implementation:

1. **Melee weapons are underpowered**: Despite the GDD claiming "melee has highest DPS but requires close range", calculations show melee weapons have the LOWEST DPS in the game.
2. **AK47 is overpowered**: The AK47 has the highest DPS (120), longest range (800px), and large magazine (30 rounds) with no clear weakness, violating the "no strictly superior weapon" principle.

**Recommended Solution**: Implement damage falloff system (Option 3) to make range a meaningful trade-off, combined with selective melee buffs to align with GDD balance philosophy.

---

## 1. Weapon Statistics Table

### Complete Weapon Specifications

| Weapon | Type | Damage/Hit | Fire Rate | DPS (Max) | Magazine | Reload Time | Range (px) | Special Mechanics |
|--------|------|-----------|-----------|-----------|----------|-------------|-----------|-------------------|
| **Pistol** | Ranged | 25 | 3.0/s | 75 | 15 | 1.5s | 800 | Default spawn weapon |
| **Bat** | Melee | 25 | 2.0/s (0.5s cooldown) | 50 | N/A | N/A | 64 | Knockback (40px), 90° arc |
| **Katana** | Melee | 45 | 1.25/s (0.8s cooldown) | 56.25 | N/A | N/A | 80 | No knockback, 90° arc |
| **Uzi** | Ranged | 8 | 10.0/s | 80 | 30 | 1.5s | 600 | Recoil climb, ±5° spread |
| **AK47** | Ranged | 20 | 6.0/s | 120 | 30 | 2.0s | 800 | H+V recoil pattern, ±3° spread |
| **Shotgun** | Ranged | 60 total (8x7.5) | 1.0/s | 60 | 6 | 2.5s | 300 | 8 pellets, 15° cone spread |

### DPS Calculation Formula

```
DPS = Damage per Hit × Fire Rate (shots per second)
```

**Notes**:
- Melee fire rate calculated as `1 / cooldown` (e.g., Bat: 1/0.5s = 2 hits/second)
- Shotgun DPS assumes all 8 pellets hit (only realistic at very close range)
- Ranged weapons have damage falloff after 50% of max range (see Section 3)

---

## 2. Time-to-Kill (TTK) Analysis

### TTK Calculation Methodology

Base formula: `TTK = Player Health (100 HP) / DPS`

**Assumptions**:
- All shots hit (100% accuracy)
- No damage falloff unless specified
- No headshot multipliers (not implemented in GDD)
- No armor or defensive abilities

### 2.1 Base TTK (Point-Blank Range)

| Weapon | TTK (seconds) | Shots to Kill | Ranking |
|--------|---------------|---------------|---------|
| **AK47** | 0.83s | 5 shots | 1st (fastest) |
| **Uzi** | 1.25s | 13 shots | 2nd |
| **Pistol** | 1.33s | 4 shots | 3rd |
| **Shotgun** | 1.67s | 2 shots | 4th |
| **Katana** | 1.78s | 3 hits | 5th |
| **Bat** | 2.00s | 4 hits | 6th (slowest) |

**Key Findings**:
- AK47 is 40% faster than melee weapons at killing
- Melee weapons are the slowest TTK despite requiring high risk (close approach)
- Shotgun requires 2 perfect shots (all 16 pellets hit) for 1.67s TTK

### 2.2 TTK with Damage Falloff

Damage falloff formula (from Epic 3.3 technical notes):

```javascript
if (distance > maxRange * 0.5) {
    damageFalloff = 1.0 - ((distance - maxRange * 0.5) / (maxRange * 0.5))
    actualDamage = baseDamage * damageFalloff
} else {
    actualDamage = baseDamage
}
```

#### AK47 TTK at Various Ranges

| Distance | % of Max Range | Damage per Shot | DPS | TTK | Shots to Kill |
|----------|---------------|-----------------|-----|-----|---------------|
| 0-400px | 0-50% | 20 (100%) | 120 | 0.83s | 5 |
| 500px | 62.5% | 15 (75%) | 90 | 1.11s | 7 |
| 600px | 75% | 10 (50%) | 60 | 1.67s | 10 |
| 700px | 87.5% | 5 (25%) | 30 | 3.33s | 20 |
| 800px | 100% | 0 (0%) | 0 | Miss | ∞ |

#### Uzi TTK at Various Ranges

| Distance | % of Max Range | Damage per Shot | DPS | TTK | Shots to Kill |
|----------|---------------|-----------------|-----|-----|---------------|
| 0-300px | 0-50% | 8 (100%) | 80 | 1.25s | 13 |
| 375px | 62.5% | 6 (75%) | 60 | 1.67s | 17 |
| 450px | 75% | 4 (50%) | 40 | 2.50s | 25 |
| 525px | 87.5% | 2 (25%) | 20 | 5.00s | 50 |
| 600px | 100% | 0 (0%) | 0 | Miss | ∞ |

#### Shotgun TTK at Various Ranges

| Distance | % of Max Range | Damage Total (8 pellets) | DPS | TTK | Shots to Kill |
|----------|---------------|--------------------------|-----|-----|---------------|
| 0-150px | 0-50% | 60 (100%) | 60 | 1.67s | 2 |
| 188px | 62.5% | 45 (75%) | 45 | 2.22s | 3 |
| 225px | 75% | 30 (50%) | 30 | 3.33s | 4 |
| 263px | 87.5% | 15 (25%) | 15 | 6.67s | 7 |
| 300px | 100% | 0 (0%) | 0 | Miss | ∞ |

**Note**: Shotgun also has 15° cone spread, so at longer ranges pellets spread apart reducing hit probability. Effective range is realistically 100-150px.

#### Pistol TTK at Various Ranges

| Distance | % of Max Range | Damage per Shot | DPS | TTK | Shots to Kill |
|----------|---------------|-----------------|-----|-----|---------------|
| 0-400px | 0-50% | 25 (100%) | 75 | 1.33s | 4 |
| 500px | 62.5% | 19 (75%) | 57 | 1.75s | 6 |
| 600px | 75% | 13 (50%) | 39 | 2.56s | 8 |
| 700px | 87.5% | 6 (25%) | 18 | 5.56s | 17 |
| 800px | 100% | 0 (0%) | 0 | Miss | ∞ |

#### Melee Weapons (No Falloff)

Melee weapons have **no damage falloff** (they either hit or miss based on range check):

| Weapon | Range | TTK | Notes |
|--------|-------|-----|-------|
| **Bat** | 64px | 2.00s | Must be within 64px, any distance |
| **Katana** | 80px | 1.78s | Must be within 80px, any distance |

---

## 3. Effective Range Analysis

### Range Tier Classification

| Weapon | Max Range | 50% Falloff | Effective Range | Range Tier |
|--------|-----------|-------------|-----------------|------------|
| **Bat** | 64px | N/A | 0-64px | Melee (Very Close) |
| **Katana** | 80px | N/A | 0-80px | Melee (Close) |
| **Shotgun** | 300px | 150px | 0-150px | Close Range |
| **Uzi** | 600px | 300px | 0-375px | Medium Range |
| **AK47** | 800px | 400px | 0-500px | Long Range |
| **Pistol** | 800px | 400px | 0-500px | Long Range |

### Effective Range Definition

**Effective Range** = Maximum distance where weapon maintains >50% base damage.

**Findings**:
- **Melee weapons** have binary effectiveness (100% or 0%)
- **Shotgun** is only effective 0-150px (50% of max range)
- **Uzi** effective 0-375px (62.5% of max range)
- **AK47** and **Pistol** share same effective range (0-500px)

### Range Overlap Issues

**Problem**: AK47 and Pistol have identical range (800px) and falloff curves, but AK47 has:
- 60% higher DPS (120 vs 75)
- 37.5% faster TTK (0.83s vs 1.33s)
- Same magazine size (30 vs 15... wait, pistol only has 15!)

**Conclusion**: Pistol is strictly inferior to AK47 in every metric except reload time (1.5s vs 2.0s). This violates the "no strictly superior weapon" principle.

---

## 4. Risk/Reward Trade-off Matrix

### Trade-off Dimensions

| Weapon | Risk Level | Reward (DPS) | Accessibility | Ammo Economy | Skill Floor | Skill Ceiling |
|--------|-----------|--------------|---------------|--------------|-------------|---------------|
| **Bat** | Very High | 50 (LOW) | Easy to use | Infinite | Low | Medium |
| **Katana** | Very High | 56.25 (LOW) | Medium | Infinite | Medium | High |
| **Uzi** | Low | 80 (MEDIUM) | Easy (spray) | 30 rounds | Low | Medium |
| **AK47** | Very Low | 120 (HIGH) | Medium | 30 rounds | Medium | High |
| **Shotgun** | Medium | 60 (MEDIUM) | Medium | 6 rounds | Medium | Medium |
| **Pistol** | Low | 75 (MEDIUM) | Easy | 15 rounds | Low | Low |

### Risk Factors Explained

**Very High Risk (Melee)**:
- Must approach within 64-80 pixels of enemy
- Vulnerable to ranged weapons during approach
- No cover fire or suppression capability
- Zero effective range against ranged opponents

**Low Risk (Ranged)**:
- Can engage from 300-800px away
- Can take cover while reloading
- Can suppress enemies and control space
- Minimal exposure to counterattack

### Reward Validation Against GDD Claims

**GDD Claim** (lines 274-278): "Melee weapons have highest DPS but require close range (high risk/reward)"

**Reality Check**:

| Weapon Type | GDD Expected DPS | Actual DPS | Status |
|-------------|------------------|------------|--------|
| Melee (Bat) | Highest | 50 (LOWEST) | ❌ FAILED |
| Melee (Katana) | Highest | 56.25 (2nd LOWEST) | ❌ FAILED |
| Ranged (AK47) | Lower than melee | 120 (HIGHEST) | ❌ INVERTED |

**Conclusion**: **Risk/reward is currently inverted**. High-risk melee has low reward, low-risk ranged has high reward.

---

## 5. Weapon Role Analysis

### Intended Tactical Niches (from GDD)

| Weapon | Intended Role | Actual Performance | Role Validation |
|--------|---------------|-------------------|-----------------|
| **Bat** | Close quarters, quick hits, knockback control | Low DPS, requires suicide approach | ❌ Role unclear |
| **Katana** | Melee duels, higher damage per hit | Still loses to ranged in duels | ❌ Underpowered |
| **Uzi** | Spray and pray, suppression fire | Good suppression, medium DPS | ✅ Works as intended |
| **AK47** | Balanced all-rounder | Actually dominant in all scenarios | ❌ Too strong |
| **Shotgun** | Close range burst, area denial | Good burst, limited by range/ammo | ✅ Works as intended |
| **Pistol** | Reliable starter, ammo efficient | Outclassed by AK47 in every way | ❌ No niche |

### Rock-Paper-Scissors Balance Check

**Ideal Balance**:
- Melee > Shotgun (outmaneuver in close quarters)
- Shotgun > Mid-range (burst damage wins trades)
- Mid-range > Long-range (mobility advantage)
- Long-range > Melee (kite and shoot)

**Actual Balance**:
- AK47 > Everything (highest DPS, longest range, large magazine)
- Uzi > Melee (can spray down before they close distance)
- Shotgun ≈ Melee (if melee gets in range, both 2-shot kill)
- Pistol ≈ Uzi (similar TTK but Uzi has better DPS)

**Conclusion**: No meaningful rock-paper-scissors balance. AK47 is dominant strategy.

---

## 6. Balance Issues Identified

### Critical Issue #1: Melee Weapons Underpowered

**Evidence**:
- Bat DPS (50) is 58% LOWER than AK47 DPS (120)
- Katana DPS (56.25) is 53% LOWER than AK47 DPS (120)
- Melee weapons have 2-3x the TTK of ranged weapons
- Melee requires getting within 64-80px (high risk) but offers lowest reward

**Impact**:
- No incentive to pick up melee weapons
- Melee becomes "noob trap" (looks cool, performs poorly)
- Reduces weapon diversity in gameplay

**GDD Violation**: "Melee weapons have highest DPS" (lines 246-262) is demonstrably false.

### Critical Issue #2: AK47 Overpowered

**Evidence**:
- Highest DPS in game (120)
- Longest range tied with Pistol (800px)
- Large magazine (30 rounds = 6 theoretical kills)
- Fast TTK (0.83s, 40% faster than melee)
- No clear weakness

**Impact**:
- Optimal strategy is "always use AK47"
- Other weapons become inferior choices
- Reduces tactical diversity

**GDD Violation**: "No weapon is strictly superior to others" (lines 274-278).

### Moderate Issue #3: Pistol Lacks Identity

**Evidence**:
- Identical range to AK47 (800px) but 37% lower DPS
- Smaller magazine (15 vs 30 rounds)
- Only advantage: 0.5s faster reload (1.5s vs 2.0s)
- Intended as "starter weapon" but outclassed immediately

**Impact**:
- Players will abandon pistol for any other weapon
- No reason to use pistol if AK47 is available

### Minor Issue #4: Shotgun Pellet Spread

**Evidence**:
- 8 pellets in 15° cone
- At 150px, pellets spread 40px apart (assuming linear spread)
- Player hitbox estimated at 32x32 pixels
- High probability of only 3-5 pellets hitting at 150px

**Impact**:
- Actual damage at 150px: ~25 damage (not 60)
- TTK increases from 2 shots to 4+ shots at effective range

### Critical Issue #5: Client-Server Pistol Damage Mismatch

**Evidence**:
- Server: `PistolDamage = 25` (weapon.go:8)
- Client: `PISTOL_DAMAGE: 15` (constants.ts:59)
- 40% discrepancy in damage values

**Impact**:
- Visual damage feedback incorrect on client
- Confusion during testing
- Potential desync in health calculations
- Possible cheating vector if client damage is used

**Recommendation**: Change client to 25 to match server (maintains 4-shot kill design).

---

## 7. Recommended Stat Adjustments

### Option 1: Buff Melee Damage (Aggressive Fix)

**Goal**: Make melee DPS highest in game (align with GDD claim)

**Changes**:

| Weapon | Current Damage | New Damage | Current DPS | New DPS | TTK Change |
|--------|---------------|------------|-------------|---------|------------|
| **Bat** | 25 | 35 | 50 | 70 | 2.0s → 1.43s |
| **Katana** | 45 | 60 | 56.25 | 75 | 1.78s → 1.33s |

**Justification**:
- Bat DPS (70) now competitive with Pistol (75) and Shotgun (60)
- Katana DPS (75) matches Pistol, still below AK47
- Maintains risk/reward: still need to close distance, but worth the risk
- Bat becomes 3-hit kill (was 4-hit)
- Katana becomes 2-hit kill (was 3-hit)

**Pros**:
- ✅ Aligns with GDD balance philosophy
- ✅ Makes melee viable without breaking other weapons
- ✅ Clear risk/reward trade-off

**Cons**:
- ❌ Doesn't fix AK47 dominance
- ❌ Requires changing base damage values

### Option 2: Nerf Ranged DPS (Conservative Fix)

**Goal**: Reduce ranged weapon DPS to below melee

**Changes**:

| Weapon | Current Fire Rate | New Fire Rate | Current DPS | New DPS | TTK Change |
|--------|------------------|---------------|-------------|---------|------------|
| **AK47** | 6/s | 5/s | 120 | 100 | 0.83s → 1.0s |
| **Uzi** | 10/s | 8/s | 80 | 64 | 1.25s → 1.56s |

**Justification**:
- AK47 DPS (100) still highest but more balanced
- Uzi DPS (64) now slightly above Katana (56.25), balanced by range advantage
- Pistol (75) becomes competitive mid-tier weapon
- Preserves weapon roles, adjusts power curve

**Pros**:
- ✅ Fixes AK47 dominance
- ✅ Makes Pistol more relevant (no longer 37% weaker than AK47)

**Cons**:
- ❌ Melee still has lowest DPS (doesn't fix GDD claim)
- ❌ May feel bad to nerf popular weapons

### Option 3: Implement Damage Falloff (Recommended Solution)

**Goal**: Make range a meaningful trade-off without changing base stats

**Changes**: No base stat changes, implement falloff system server-side

**Falloff Formula** (from Epic 3.3 line 240):

```javascript
function calculateDamage(weapon, distance) {
    if (weapon.isMelee) {
        return weapon.damage; // No falloff
    }

    const maxRange = weapon.range;
    const falloffStart = maxRange * 0.5;

    if (distance <= falloffStart) {
        return weapon.damage; // Full damage
    }

    if (distance >= maxRange) {
        return 0; // Miss
    }

    const falloffPercent = 1.0 - ((distance - falloffStart) / (maxRange - falloffStart));
    return Math.floor(weapon.damage * falloffPercent);
}
```

**Impact on AK47 DPS at Range**:

| Distance | Current DPS | Falloff DPS | DPS Reduction |
|----------|-------------|-------------|---------------|
| 0-400px | 120 | 120 | 0% |
| 500px | 120 | 90 | 25% |
| 600px | 120 | 60 | 50% |
| 700px | 120 | 30 | 75% |

**At 600px** (common engagement range):
- AK47: 120 DPS → 60 DPS (same as Shotgun at close range)
- Uzi: 80 DPS → 40 DPS (halved)
- Pistol: 75 DPS → 39 DPS (nearly halved)

**Effective DPS Comparison (at 600px)**:

| Weapon | Point-Blank DPS | 600px DPS | DPS Retention |
|--------|----------------|-----------|---------------|
| **Bat** | 50 | 50 (if in range) | 100% |
| **Katana** | 56.25 | 56.25 (if in range) | 100% |
| **Shotgun** | 60 | N/A (max 300px) | N/A |
| **AK47** | 120 | 60 | 50% |
| **Uzi** | 80 | 40 | 50% |
| **Pistol** | 75 | 39 | 52% |

**Pros**:
- ✅ No base stat changes needed (easier to implement)
- ✅ Makes range meaningful (close-range weapons competitive at their range)
- ✅ AK47 still strong at long range, but not overpowered
- ✅ Preserves weapon identity
- ✅ Already documented in Epic 3.3 story

**Cons**:
- ❌ Doesn't fix melee DPS being lower than GDD claim
- ❌ Requires server-side damage calculation system

### Recommended Hybrid Approach

**Combine Option 1 + Option 3**:

1. **Implement damage falloff** (Option 3) for all ranged weapons
2. **Buff Bat damage** from 25 → 30 (DPS: 50 → 60)
3. **Buff Katana damage** from 45 → 50 (DPS: 56.25 → 62.5)

**Result**:
- Melee DPS (60-62.5) exceeds all ranged weapons at 600px+ (60 DPS or less)
- AK47 still strongest at point-blank (120 DPS) but balanced by falloff
- Clear tactical niches: melee for close quarters, ranged for distance
- Minimal changes to existing GDD specs

---

## 8. Validation Against Acceptance Criteria

### Epic 3.0 Story Requirements

**Requirement**: Create weapon balance spreadsheet with:

| Criterion | Status | Location |
|-----------|--------|----------|
| DPS calculations for each weapon | ✅ Complete | Section 1, 2 |
| Time-to-Kill (TTK) at various ranges | ✅ Complete | Section 2.2 |
| Effective range analysis | ✅ Complete | Section 3 |
| Risk/reward trade-off matrix | ✅ Complete | Section 4 |

**Requirement**: Validate that:

| Validation | Status | Findings |
|------------|--------|----------|
| Melee weapons have highest DPS | ❌ FAILED | Melee has LOWEST DPS (50-56 vs 60-120) |
| Melee requires close range (high risk/reward) | ⚠️ PARTIAL | High risk confirmed, but LOW reward |
| Ranged weapons have damage falloff | ⚠️ NOT IMPLEMENTED | Defined in Epic 3.3 but not in GDD |
| No weapon strictly superior | ❌ FAILED | AK47 dominates all scenarios |
| Weapon stats align with Epic 3 stories | ✅ PASSED | All specs from GDD match story definitions |

**Requirement**: Document recommended stat adjustments

| Requirement | Status | Location |
|-------------|--------|----------|
| Recommended stat adjustments | ✅ Complete | Section 7 (3 options) |

### Summary of Validation Results

**PASSED**:
- ✅ DPS/TTK spreadsheet complete
- ✅ Weapon stats from GDD align with Epic 3.2 and 3.3 stories
- ✅ Recommended adjustments documented

**FAILED**:
- ❌ Melee weapons do NOT have highest DPS
- ❌ AK47 is strictly superior weapon (no meaningful trade-offs)
- ❌ Risk/reward is inverted (high risk = low reward)

**CONCLUSION**: Current weapon balance does NOT meet GDD design goals. Recommended adjustments (Section 7) must be implemented before Epic 3 stories.

---

## 9. Implementation Roadmap

### Phase 1: Fix Critical Issues (Pre-Epic 3.2/3.3)

**Priority 1**: Resolve pistol damage mismatch
- Change client `PISTOL_DAMAGE` from 15 → 25
- File: `stick-rumble-client/src/shared/constants.ts:59`
- Verify server `PistolDamage = 25` unchanged

**Priority 2**: Implement damage falloff system
- Add `CalculateDamage()` function to server
- File: `stick-rumble-server/internal/game/weapon.go`
- Use falloff formula from Section 7, Option 3

**Priority 3**: Document final weapon stats in GDD
- Update GDD Section 2.3 with damage falloff formula
- Add effective range definitions
- Document design decisions

### Phase 2: Balance Adjustments (During Epic 3.2)

**Decision Point**: Choose balance approach:
- **Option A**: Buff melee (Bat: 25→30, Katana: 45→50)
- **Option B**: Nerf ranged (AK47: 6/s→5/s, Uzi: 10/s→8/s)
- **Option C**: Implement falloff only (wait for playtesting)

**Recommendation**: Start with Option C (falloff only), playtest, then apply Option A if melee still weak.

### Phase 3: Playtesting & Iteration (Post-Epic 3.3)

**Playtest Metrics**:
- Weapon pickup rates (which weapons are players choosing?)
- Kill distribution (which weapons get most kills?)
- Average engagement distance (are players using weapons at intended ranges?)
- Win rate by weapon (is one weapon dominating matches?)

**Iteration Triggers**:
- If melee pickup rate < 10%: Buff melee damage
- If AK47 win rate > 40%: Nerf AK47 fire rate
- If Shotgun kills < 5%: Reduce pellet spread or increase pellet damage

---

## 10. Open Questions for Product/Design

### Question 1: Headshot System

**Question**: Should the game have headshot multipliers?

**Context**:
- Not mentioned in GDD
- Common in shooters (1.5x-2.0x multiplier)
- Increases skill ceiling

**Impact on Balance**:
- AK47 with headshots: 20 × 1.5 = 30 damage (3-shot kill instead of 5)
- Could further increase AK47 dominance
- Melee weapons can't headshot (further disadvantage)

**Recommendation**: Skip headshots for MVP. Add in post-launch if skill ceiling too low.

### Question 2: Weapon Pickup System

**Question**: How do players acquire weapons beyond default Pistol?

**Options**:
- A) Random floor spawns (battle royale style)
- B) Weapon crates at fixed locations (arena shooter style)
- C) Loadout selection (pre-match choice)
- D) Kill rewards (earn better weapons)

**Balance Implications**:
- Option A/B: Weapon balance critical (bad weapons = bad RNG)
- Option C: Players will always pick AK47 (need forced variety)
- Option D: Could create snowball effect (rich get richer)

**Recommendation**: Needs GDD clarification before implementing Epic 3.

### Question 3: Ammo Economy

**Question**: Do players start with full ammo? Can they find more ammo?

**Current Spec**:
- Pistol: 15 rounds (3.75 kills max)
- Uzi: 30 rounds (3 kills max)
- AK47: 30 rounds (6 kills max)
- Shotgun: 6 rounds (3 kills max)

**Issue**: AK47 can get 6 kills per magazine vs Uzi's 3 kills (another advantage).

**Recommendation**: Either add ammo pickups or balance magazine sizes by TTK capacity (all weapons = 4 kills per mag).

### Question 4: Melee Design Philosophy

**Question**: Should melee be high-DPS risk/reward weapons, or utility/mobility tools?

**Option A**: High-DPS (align with GDD claim)
- Buff damage per recommendations
- Make melee the best choice IF you can close distance
- Risk/reward gameplay

**Option B**: Utility focus
- Keep lower DPS
- Add movement speed boost while holding melee
- Add special abilities (Bat knockback is good start)
- Melee becomes tactical tool, not primary weapon

**Recommendation**: Clarify design intent in GDD before implementing Epic 3.2.

### Question 5: Shotgun Consistency

**Question**: Should shotgun have consistent damage or RNG pellet spread?

**Current Spec**: 8 pellets, each with ±7.5° random spread

**Options**:
- A) Keep RNG (realistic, but frustrating when pellets miss)
- B) Fixed pellet pattern (predictable, skill-based)
- C) Hybrid (center pellets fixed, outer pellets random)

**Recommendation**: Use fixed pattern (Option B) for competitive fairness.

---

## 11. Conclusion

### Key Findings Summary

1. **Balance validation FAILED**: Current weapon stats do not meet GDD balance goals
2. **Melee underpowered**: Lowest DPS despite highest risk
3. **AK47 overpowered**: Dominant in all scenarios
4. **Damage falloff critical**: Must implement before Epic 3.3
5. **Pistol damage mismatch**: Critical bug (client 15 vs server 25)

### Recommended Next Steps

**Immediate Actions**:
1. Fix pistol damage mismatch (client 15 → 25)
2. Implement damage falloff system (use formula from Section 7)
3. Update GDD with falloff specs and effective ranges

**Before Epic 3.2 (Melee)**:
4. Decide on melee philosophy (high-DPS vs utility)
5. Apply recommended melee buffs if high-DPS approach chosen

**Before Epic 3.3 (Ranged)**:
6. Clarify weapon acquisition system (spawns vs loadouts)
7. Define ammo economy (starting ammo, pickups, etc.)

**Post-Implementation**:
8. Playtest with real players
9. Collect weapon usage metrics
10. Iterate based on data

### Final Recommendation

**Implement Hybrid Approach** (Option 1 + Option 3 from Section 7):
- ✅ Damage falloff system (already spec'd in Epic 3.3)
- ✅ Modest melee buffs (Bat: 25→30, Katana: 45→50)
- ✅ Minimal changes to GDD specs
- ✅ Preserves weapon identity and roles
- ✅ Achieves "no strictly superior weapon" goal

This approach balances development effort (small changes) with design goals (clear weapon niches) while maintaining flexibility for post-launch iteration.

---

## Appendix A: Calculation Methodology

### DPS Formula

```
DPS = (Damage per Hit) × (Fire Rate in shots/second)

Fire Rate = 1 / Cooldown Time (for melee)
Fire Rate = Rounds per Second (for ranged)
```

### TTK Formula

```
TTK = Player Health / DPS
Shots to Kill = ceil(Player Health / Damage per Hit)
Actual TTK = (Shots to Kill - 1) / Fire Rate
```

**Note**: Actual TTK accounts for final shot not needing full cooldown.

### Damage Falloff Formula

```javascript
function calculateDamage(baseDamage, distance, maxRange) {
    const falloffStart = maxRange * 0.5;

    if (distance <= falloffStart) {
        return baseDamage;
    }

    if (distance >= maxRange) {
        return 0;
    }

    const falloffRange = maxRange - falloffStart;
    const falloffDistance = distance - falloffStart;
    const falloffPercent = 1.0 - (falloffDistance / falloffRange);

    return Math.floor(baseDamage * falloffPercent);
}
```

### Effective DPS Formula (with Reload)

```
Sustained DPS = (Damage per Magazine) / (Time to Empty Magazine + Reload Time)

Time to Empty = Magazine Size / Fire Rate
Sustained DPS = (Magazine Size × Damage per Shot) / ((Magazine Size / Fire Rate) + Reload Time)
```

**Example for AK47**:
```
Magazine Size = 30
Damage per Shot = 20
Fire Rate = 6/s
Reload Time = 2s

Time to Empty = 30 / 6 = 5s
Total Cycle Time = 5s + 2s = 7s
Damage per Cycle = 30 × 20 = 600
Sustained DPS = 600 / 7 = 85.7 DPS (vs 120 burst DPS)
```

---

## Appendix B: Reference Data Sources

### Primary Sources

1. **Game Design Document**
   - File: `/Users/mtomcal/Code/stick-rumble/docs/GDD.md`
   - Lines 246-262: Weapon specifications
   - Lines 274-278: Balance philosophy

2. **Epic 3 Story Definitions**
   - File: `docs/epics.md`
   - Story 3.2 (Melee Weapons)
   - Story 3.3 (Ranged Weapons)

3. **Server Implementation**
   - File: `/Users/mtomcal/Code/stick-rumble/stick-rumble-server/internal/game/weapon.go`
   - Lines 8-30: Pistol constants

4. **Client Constants**
   - File: `/Users/mtomcal/Code/stick-rumble/stick-rumble-client/src/shared/constants.ts`
   - Lines 59-77: Weapon constants

5. **Research Document**
   - File: `/Users/mtomcal/Code/stick-rumble/research/2025-12-08-weapon-balance-research.md`
   - Comprehensive analysis of all weapon sources

### External Research

- Destiny 2 TTK Charts: https://www.blueberries.gg/weapons/destiny-2-ttk/
- Game Agnostic TTK Calculator: https://protovision.github.io/ttk-calc/
- Apex Legends Weapon Stats: https://www.gamebynumbers.com/Weapon-stats/apex-weapon-stats
- Warzone Weapon Stats: https://codmunity.gg/weapon-stats/warzone

---

**Document Version**: 1.0
**Last Updated**: 2025-12-08
**Next Review**: After Epic 3.3 implementation
