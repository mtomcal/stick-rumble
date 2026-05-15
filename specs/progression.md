# Progression System

> **Spec Version**: 1.0.0
> **Last Updated**: 2026-05-15
> **Depends On**: [constants.md](constants.md), [accounts.md](accounts.md), [player.md](player.md)
> **Depended By**: [client-architecture.md](client-architecture.md), [ui.md](ui.md)

---

## Overview

The progression system provides a level-based progression model driven by lifetime experience points (XP). Players gain XP by participating in matches and earning kills. Levels are purely cosmetic in the MVP — there are no gameplay unlocks, no skill trees, and no item gating. The level is displayed in the lobby and profile screens, and a level-up toast provides positive feedback after matches.

**Why visual-only progression in MVP?** Gameplay unlocks (perks, weapon variants, map unlocks) are a major design surface that requires careful balancing, player testing, and anti-cheat consideration. Shipping purely cosmetic progression first validates the XP and leveling pipeline without committing to specific unlock mechanics. When unlocks are added later, the underlying XP and level infrastructure is already tested and deployed.

**Why achievements are explicitly out of scope?** Achievements require a separate tracking system (badges, milestones, conditional triggers) that adds significant complexity. The MVP focuses on the core loop: earn XP → gain levels → display level. Achievements can be added post-MVP as a separate system built on top of the existing lifetime stats infrastructure.

---

## Dependencies

### Technology Dependencies

| Technology | Version | Purpose |
|------------|---------|---------|
| Go | 1.25 | Server-side level calculation, match-end stats processing |
| TypeScript | 5.9.3 | Client-side level display, toast UI |
| React | 19.2.0 | Level-up toast in lobby and profile screens |

### Spec Dependencies

- [constants.md](constants.md) - Progression constants (XP_PER_KILL, XP_PER_LEVEL_BASE)
- [accounts.md](accounts.md) - LifetimeStats data structure, match-end stats update
- [player.md](player.md) - Per-match XP tracking

---

## Constants

All progression constants are defined in [constants.md](constants.md#progression-constants).

| Constant | Value | Description |
|----------|-------|-------------|
| XP_PER_KILL | 100 | XP awarded per kill |
| XP_PER_LEVEL_BASE | 500 | Base XP required for Level 1 |

---

## Data Structures

No new data structures. The progression system operates on:
- `PlayerState.XP` — per-match XP (resets to 0 on new match). Defined in [player.md](player.md).
- `LifetimeStats.total_xp` — cumulative lifetime XP across all matches. Defined in [accounts.md](accounts.md).

---

## Behavior

### Leveling Curve

The XP required for each level increases linearly: Level N requires `N * 500` XP.

| Level | XP Required | Cumulative XP |
|-------|-------------|---------------|
| 1 | 500 | 0-499 |
| 2 | 1,000 | 500-1,499 |
| 3 | 1,500 | 1,500-2,999 |
| 4 | 2,000 | 3,000-4,999 |
| 5 | 2,500 | 5,000-7,499 |
| 10 | 5,000 | 27,500-32,499 |
| 20 | 10,000 | 105,000-114,999 |
| 50 | 25,000 | 637,500-662,499 |
| 100 | 50,000 | 2,525,000-2,574,999 |

```
function xpForLevel(level: int) -> int:
    return level * XP_PER_LEVEL_BASE

function levelForXp(totalXp: int) -> int:
    level = 1
    remaining = totalXp
    while remaining >= xpForLevel(level):
        remaining -= xpForLevel(level)
        level++
    return level
```

**Why linear scaling instead of exponential?** Linear scaling creates a predictable, easy-to-understand progression curve. Every level requires exactly `level * 500` XP, which means the time to advance grows linearly (not exponentially). This keeps early levels fast and rewarding while maintaining a clear path to high levels. Exponential scaling (common in MMOs) would make high levels feel unreachable in a game with 3-7 minute matches.

**Example calculation:**
- A player with 3,200 lifetime XP:
  - Level 1: 3,200 >= 500 → subtract 500, remaining = 2,700
  - Level 2: 2,700 >= 1,000 → subtract 1,000, remaining = 1,700
  - Level 3: 1,700 >= 1,500 → subtract 1,500, remaining = 200
  - Level 4: 200 < 2,000 → stop
  - Result: Level 3 (4,500 XP consumed total), 200 XP toward Level 4

### Event to Track

On match end, the match system posts per-player stats to the accounts system for lifetime tracking. This is the single integration point between the match system and the progression system.

**Pseudocode:**
```
function onMatchEnd(room, finalScores):
    for each score in finalScores:
        player = getPlayer(score.playerId)
        if player is guest:
            continue  // Guests do not have lifetime stats

        lifetimeStats = loadLifetimeStats(player.playerId)
        preMatchTotalXP = lifetimeStats.totalXP

        // Update lifetime stats
        lifetimeStats.totalKills += score.kills
        lifetimeStats.totalDeaths += score.deaths
        lifetimeStats.totalXP += score.xp
        lifetimeStats.totalGames += 1
        if player.id in winners:
            lifetimeStats.totalWins += 1

        // Weapon breakdown tracking
        for each (weaponType, killCount) in player.weaponBreakdown:
            lifetimeStats.perWeaponKills[weaponType] += killCount

        saveLifetimeStats(lifetimeStats)

        // Level-up detection
        preLevel = levelForXp(preMatchTotalXP)
        postLevel = levelForXp(lifetimeStats.totalXP)
        if postLevel > preLevel:
            notifyLevelUp(player.playerId, postLevel)
```

**Go:**
```go
func ProcessMatchEndStats(player *PlayerState, score PlayerScore, winners []string, statsStore *StatsStore) {
    if player.IsGuest {
        return
    }

    lifetimeStats, err := statsStore.GetByPlayerID(player.PlayerID)
    if err != nil {
        log.Printf("Failed to load lifetime stats for player %s: %v", player.PlayerID, err)
        return
    }

    preMatchTotalXP := lifetimeStats.TotalXP

    lifetimeStats.TotalKills += score.Kills
    lifetimeStats.TotalDeaths += score.Deaths
    lifetimeStats.TotalXP += score.XP
    lifetimeStats.TotalGames++
    for _, winner := range winners {
        if winner == player.PlayerID {
            lifetimeStats.TotalWins++
            break
        }
    }

    for weapon, kills := range player.WeaponBreakdown {
        lifetimeStats.PerWeaponKills[weapon] += kills
    }

    if err := statsStore.Save(lifetimeStats); err != nil {
        log.Printf("Failed to save lifetime stats for player %s: %v", player.PlayerID, err)
        return
    }

    // Level-up detection
    preLevel := levelForXp(preMatchTotalXP)
    postLevel := levelForXp(lifetimeStats.TotalXP)
    if postLevel > preLevel {
        notifyLevelUp(player.PlayerID, postLevel)
    }
}
```

**Why process on match end (not in real-time)?** Batch processing on match end is simpler, more reliable, and avoids concurrency issues with stats being updated during an active match. The match results are the authoritative source of truth for a player's performance in that match.

### Level-Up Detection

Level-up detection compares the player's pre-match level against their post-match level. If the level increased, a level-up event is fired.

**Pseudocode:**
```
function detectLevelUp(preMatchTotalXP: int, postMatchTotalXP: int) -> int or null:
    preLevel = levelForXp(preMatchTotalXP)
    postLevel = levelForXp(postMatchTotalXP)
    if postLevel > preLevel:
        return postLevel  // The new level
    return null
```

The level-up event contains:
- `playerId`: The ID of the player who leveled up
- `newLevel`: The player's new level (integer)
- `levelsGained`: How many levels were gained (typically 1, but could be more in edge cases)

**Edge case: Multi-level gain.** If a player accumulates enough XP to jump multiple levels (e.g., from Level 1 to Level 3 in one match), only one level-up notification is sent with the final level. Individual per-level toasts are not shown for skipped intermediate levels.

### Level-Up Toast (Client-Side)

A level-up toast is displayed in the lobby after match end. It is a simple, non-intrusive notification.

**Visual specification:**
- Position: Center of screen, slightly above center
- Text: "Level Up! You're now Level N" (e.g., "Level Up! You're now Level 5")
- Font: 28px bold, white (#FFFFFF)
- Background: Semi-transparent dark overlay behind text
- Duration: ~3 seconds visible, then auto-dismiss
- Animation: Scale in from 0.8 → 1.0 (100ms ease-out), hold for 3 seconds, fade out (500ms)
- Depth: 2000 (above all other UI elements)

**TypeScript:**
```typescript
export class LevelUpToast {
  private container: Phaser.GameObjects.Container;
  private text: Phaser.GameObjects.Text;
  private active = false;

  show(newLevel: number): void {
    if (this.active) return; // Prevent duplicate toasts for same level

    this.active = true;
    this.text.setText(`Level Up! You're now Level ${newLevel}`);
    this.container.setScale(0.8).setAlpha(1).setVisible(true);

    this.scene.tweens.add({
      targets: this.container,
      scale: 1.0,
      duration: 100,
      ease: 'Power2',
      onComplete: () => {
        this.scene.time.delayedCall(3000, () => {
          this.scene.tweens.add({
            targets: this.container,
            alpha: 0,
            duration: 500,
            onComplete: () => {
              this.container.setVisible(false);
              this.active = false;
            }
          });
        });
      }
    });
  }
}
```

**Rules:**
- Only shown once per level (never repeat for the same level).
- If the player levels up multiple times in one match, only the final level is shown.
- The toast is shown in the lobby screen after match end, not during the match.
- If the player is a guest, no level-up toast is shown (guests do not have progression).

### XP Per Kill

Each kill awards 100 XP (`XP_PER_KILL`). This XP accumulates on `PlayerState.XP` during the match. On match end, the per-match XP is added to `LifetimeStats.total_xp` and the per-match XP resets to 0.

> Note: `PlayerState.XP` is the per-match XP, separate from lifetime XP. See [player.md](player.md#xp-system) for the per-match XP tracking.

### XP Source Summary

| Source | XP | Frequency |
|--------|-----|-----------|
| Kill | 100 | Per kill |
| Match participation | 0 | Participation alone does not award XP in MVP |

---

## Error Handling

### Guest Player Stats Update Attempt

**Trigger**: Match end processing attempts to update lifetime stats for a guest player
**Detection**: Guest player has no `player_id` that corresponds to a `PlayerRecord`
**Response**: Silently skip — guests do not have lifetime stats
**Recovery**: None needed; guest players are expected to not have stats

### Database Failure on Stats Save

**Trigger**: `saveLifetimeStats` fails due to database error
**Detection**: `statsStore.Save()` returns an error
**Response**: Log the error. The match result is unaffected — the match already ended, and the player's match XP is not lost (it was temporary per-match XP). On the next successful save, missing rounds will cause a gap in stats but will not corrupt existing data.
**Recovery**: Operator intervention required to investigate database issue

### Zero XP Match

**Trigger**: A player finishes a match with 0 kills and 0 XP
**Detection**: `score.xp == 0`
**Response**: Update `total_games` (increment by 1) and `total_deaths` appropriately. No XP is added. This is a normal case — not an error.
**Recovery**: None needed

---

## Implementation Notes

### TypeScript (Client)

1. **Level-Up Toast**: A React component or a Phaser overlay that appears in the lobby after match end. The lobby receives the new level as part of the match result payload.
2. **Level Display**: The lobby and profile screens show the player's current level as a large number with an XP progress bar indicating progress to the next level.
3. **XP Progress Bar**: Shows `currentMatchXP` / `xpForLevel(currentLevel)`. The bar fills proportionally.

### Go (Server)

1. **Level Functions**: Pure functions (`xpForLevel`, `levelForXp`) that take and return integers. No side effects, no database access. Easy to unit test.
2. **Match End Integration**: The `ProcessMatchEndStats` function is called by the match system when `match:ended` is emitted. It runs within a database transaction to ensure atomic updates.
3. **Level-Up Notification**: Level-up events are pushed to the WebSocket connection for delivery to the lobby screen. They are not broadcast during an active match.

---

## Test Scenarios

### TS-PROG-001: XP Converts to Correct Level

**Category**: Unit
**Priority**: Critical

**Preconditions:**
- `xpForLevel(1) = 500`, `xpForLevel(2) = 1000`, `xpForLevel(3) = 1500`

**Input:**
- `levelForXp(0)` → Level 1
- `levelForXp(499)` → Level 1
- `levelForXp(500)` → Level 2
- `levelForXp(1499)` → Level 2
- `levelForXp(1500)` → Level 3
- `levelForXp(3200)` → Level 3 (3200 - 500 - 1000 - 1500 = 200 remaining, < 2000)

**Expected Output:**
- Correct level for each input
- No off-by-one errors at boundary values

**Pseudocode:**
```
test "XP converts to correct level":
    assert levelForXp(0) == 1
    assert levelForXp(499) == 1
    assert levelForXp(500) == 2
    assert levelForXp(1499) == 2
    assert levelForXp(1500) == 3
    assert levelForXp(3200) == 3
    assert levelForXp(4500) == 4  // 4500 - 500 - 1000 - 1500 - 2000 = -500
    assert levelForXp(10000) == 5 // 10000 - 500 - 1000 - 1500 - 2000 - 2500 = 2500 leftover... approx Level 5→6 boundary
```

### TS-PROG-002: Level-Up Detection Fires on Crossing Threshold

**Category**: Unit
**Priority**: High

**Preconditions:**
- Player has 400 lifetime XP (Level 1, 100 XP away from Level 2)
- Match awards 200 XP (2 kills)

**Input:**
- `detectLevelUp(400, 600)`

**Expected Output:**
- `preLevel = levelForXp(400) = 1`
- `postLevel = levelForXp(600) = 2`
- Returns `newLevel = 2`

### TS-PROG-003: Lifetime Stats Accumulate Across Matches

**Category**: Integration
**Priority**: Critical

**Preconditions:**
- Player has existing lifetime stats: 10 kills, 5 deaths, 1000 XP, 3 games

**Input:**
- Match 1: 5 kills, 2 deaths, 500 XP, win
- Match 2: 3 kills, 4 deaths, 300 XP

**Expected Output:**
- After Match 1: 15 kills, 7 deaths, 1500 XP, 4 games, 1 win
- After Match 2: 18 kills, 11 deaths, 1800 XP, 5 games, 1 win

### TS-PROG-004: Per-Weapon Kills Track Correctly

**Category**: Unit
**Priority**: Medium

**Preconditions:**
- Player has existing `perWeaponKills`: `{"pistol": 5, "ak47": 10}`
- Match weapons breakdown: `{"ak47": 3, "shotgun": 2}`

**Input:**
- ProcessMatchEndStats updates weapon breakdown

**Expected Output:**
- `perWeaponKills["ak47"]` = 13 (10 + 3)
- `perWeaponKills["shotgun"]` = 2 (0 + 2)
- `perWeaponKills["pistol"]` = 5 (unchanged)

### TS-PROG-005: Level-Up Toast Only Shows Once Per Level

**Category**: Unit
**Priority**: Medium

**Preconditions:**
- Level-up toast is showing for Level 5

**Input:**
- Server sends another level-up notification for Level 5 (should not happen, but guard for idempotency)

**Expected Output:**
- Toast `show(5)` is called while `active == true`
- Second call is silently ignored (`show` returns early)
- No duplicate toast appears

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-05-15 | Initial specification |
