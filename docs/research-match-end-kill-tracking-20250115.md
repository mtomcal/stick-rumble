# Research: Match End Kill/Death Tracking Bug

**Date:** 2025-01-15  
**Issue:** Match end leaderboard shows 0 kills and 0 deaths for all players, even when players got kills during the match. The XP breakdown shows correct base XP (50) but Kills multiplier shows 0.

---

## Executive Summary

A critical data structure mismatch exists between the server's kill/death tracking system and the client's match end screen. The server correctly tracks kills and deaths in `PlayerState` and collects them into `PlayerScore` objects, but the event schema and broadcast mechanism transform this data into an incompatible format (`Record<string, number>` instead of `PlayerScore[]`), causing all kill/death information to be lost before reaching the client.

---

## 1. Server-Side Kill/Death Tracking

### 1.1 PlayerState Structure (stick-rumble-server/internal/game/player.go)

The `PlayerState` struct maintains per-player statistics:

```go
type PlayerState struct {
    ID                     string     `json:"id"`
    Kills                  int        `json:"kills"`               // Number of kills
    Deaths                 int        `json:"deaths"`              // Number of deaths
    XP                     int        `json:"xp"`                  // Experience points
    // ... other fields
}
```

**Key Methods:**
- `IncrementKills()` - Called when player gets a kill (line 214)
- `IncrementDeaths()` - Called when player dies (line 221)
- `AddXP(amount)` - Called to award XP (line 228)

### 1.2 Where Stats Are Updated

**File:** `stick-rumble-server/internal/network/message_processor.go`  
**Function:** `onHit()` (lines 87-243)

When a projectile hits and kills a player:
```go
// Line 170: Attacker gets kill credit
attackerState.IncrementKills()
attackerState.AddXP(game.KillXPReward)

// Line 173: Victim gets death
victimState.IncrementDeaths()

// Lines 203-208: Build kill credit data with updated stats
killCreditData := map[string]interface{}{
    "killerId":    hit.AttackerID,
    "victimId":    hit.VictimID,
    "killerKills": attackerState.Kills,  // Current kill count
    "killerXP":    attackerState.XP,     // Current XP total
}
```

**During-Match Tracking:**
- `player:kill_credit` message is sent to update UI during gameplay (accurate)
- Match tracks kills in `Match.PlayerKills` map (line 232)
- Kills are used to check win conditions

### 1.3 Match Object Tracking

**File:** `stick-rumble-server/internal/game/match.go`

```go
type Match struct {
    PlayerKills map[string]int // Maps player ID to kill count
}

type PlayerScore struct {
    PlayerID string `json:"playerId"`
    Kills    int    `json:"kills"`
    Deaths   int    `json:"deaths"`
    XP       int    `json:"xp"`
}

// GetFinalScores collects final scores from all players in the match
func (m *Match) GetFinalScores(world *World) []PlayerScore {
    scores := []PlayerScore{}
    
    for playerID := range m.PlayerKills {
        player, exists := world.players[playerID]
        if !exists {
            continue
        }
        
        // Create score entry with player stats
        score := PlayerScore{
            PlayerID: playerID,
            Kills:    player.Kills,      // From PlayerState.Kills
            Deaths:   player.Deaths,     // From PlayerState.Deaths
            XP:       player.XP,         // From PlayerState.XP
        }
        scores = append(scores, score)
    }
    
    return scores
}
```

**Key Finding:** `GetFinalScores()` correctly retrieves kills and deaths from `PlayerState` and packages them into a `[]PlayerScore` array.

---

## 2. Match End Message Construction

### 2.1 broadcastMatchEnded Function

**File:** `stick-rumble-server/internal/network/broadcast_helper.go` (lines 245-284)

```go
func (h *WebSocketHandler) broadcastMatchEnded(room *game.Room, world *game.World) {
    // Determine winners and get final scores
    winners := room.Match.DetermineWinners()
    finalScores := room.Match.GetFinalScores(world)  // Returns []PlayerScore ✓
    
    // Create match:ended message data
    data := map[string]interface{}{
        "winners":     winners,
        "finalScores": finalScores,        // Correctly contains kills/deaths
        "reason":      room.Match.EndReason,
    }
    
    // ... marshal to JSON and broadcast
}
```

At this point in the code, `finalScores` is a correctly populated `[]PlayerScore` array with all kills, deaths, and XP data intact.

---

## 3. Data Schema Mismatch (ROOT CAUSE)

### 3.1 Server-to-Client Event Schema

**File:** `events-schema/src/schemas/server-to-client.ts` (lines 338-355)

```typescript
export const MatchEndedDataSchema = Type.Object(
  {
    winners: Type.Array(Type.String(), { description: 'Array of winner player IDs' }),
    finalScores: Type.Record(Type.String(), Type.Number(), {
      description: 'Map of player IDs to final scores',
    }),
    reason: Type.String({ description: 'Reason the match ended', minLength: 1 }),
  },
  { $id: 'MatchEndedData', description: 'Match ended event payload' }
);
```

**CRITICAL PROBLEM:** The schema defines `finalScores` as:
- **Actual Type:** `Type.Record(Type.String(), Type.Number())`
- **Translates to:** `Record<string, number>` (a simple map of player ID → single number)
- **Example:** `{ "player-1": 50, "player-2": 100 }` (just XP values!)

**Correct Type Should Be:**
- An array of objects: `PlayerScore[]`
- Each object: `{ playerId: string, kills: number, deaths: number, xp: number }`

### 3.2 Client-Side Type Definition

**File:** `stick-rumble-client/src/shared/types.ts` (lines 8-22)

```typescript
export interface PlayerScore {
  playerId: string;
  kills: number;
  deaths: number;
  xp: number;
}

export interface MatchEndData {
  winners: string[];
  finalScores: PlayerScore[];    // Expects array of objects
  reason: string;
}
```

The client correctly expects `PlayerScore[]` with kills and deaths fields.

### 3.3 The Mismatch

| Aspect | Server | Schema | Client |
|--------|--------|--------|--------|
| Builds | `[]PlayerScore` ✓ | `Record<string, number>` ✗ | Expects `[]PlayerScore` |
| Contains | Kills, Deaths, XP | Only a single number | Kills, Deaths, XP |
| Result | Correct data | Data lost in serialization | Receives Record instead of array |

---

## 4. Data Flow Analysis

### 4.1 Complete Pipeline

```
PlayerState.Kills        ┐
PlayerState.Deaths       ├─→ Match.GetFinalScores()  ┐
PlayerState.XP           ┘                            │
                                                      ├─→ broadcast_helper.go
                                                      │
                         []PlayerScore (correct)      │
                              ↓
                         JSON serialization
                              ↓
                         Wire format (JSON)
                              ↓
                         Schema Validation
                         (expects Record<string, number>)
                              ↓
                    CLIENT RECEIVES WRONG FORMAT
                              ↓
                    MatchEndScreen.tsx parses
                    as Record instead of array
                              ↓
              finalScores.kills → UNDEFINED (not in Record)
              finalScores.deaths → UNDEFINED (not in Record)
```

### 4.2 What Client Receives vs. Expects

**What Server Sends:**
```json
{
  "type": "match:ended",
  "data": {
    "winners": ["player-1"],
    "finalScores": [
      { "playerId": "player-1", "kills": 5, "deaths": 2, "xp": 750 },
      { "playerId": "player-2", "kills": 2, "deaths": 5, "xp": 300 }
    ],
    "reason": "kill_target"
  }
}
```

**What Schema Expects (due to Type.Record):**
```json
{
  "type": "match:ended",
  "data": {
    "winners": ["player-1"],
    "finalScores": {
      "player-1": 750,
      "player-2": 300
    },
    "reason": "kill_target"
  }
}
```

---

## 5. Client-Side Rendering Impact

### 5.1 MatchEndScreen.tsx Processing

**File:** `stick-rumble-client/src/ui/match/MatchEndScreen.tsx` (lines 16-31)

```typescript
const rankedPlayers = [...matchData.finalScores].sort((a, b) => {
  if (b.kills !== a.kills) {
    return b.kills - a.kills;   // Accessing .kills on Record → undefined
  }
  return a.deaths - b.deaths;   // Accessing .deaths on Record → undefined
});

// Calculate XP breakdown
const localPlayerKills = localPlayer?.kills ?? 0;  // Always 0!
const xpData = calculateXP(localPlayerKills, isWinner, isTopThree);
```

**Result:**
- `b.kills` → `undefined`
- Comparison logic fails
- `localPlayerKills` → `0` (default value)
- XP multiplier shows `0 × 100 = 0 kills bonus`

### 5.2 XP Calculator

**File:** `stick-rumble-client/src/game/utils/xpCalculator.ts` (lines 29-46)

```typescript
export function calculateXP(kills: number, isWinner: boolean, isTopThree: boolean): XPResult {
  const validKills = Math.max(0, Math.floor(kills));  // kills = 0
  
  const breakdown: XPBreakdown = {
    base: 50,
    kills: validKills * 100,   // 0 * 100 = 0
    win: isWinner ? 100 : 0,
    topThree: isTopThree ? 50 : 0,
  };
  // ...
}
```

This is why the XP breakdown shows:
- Base XP: 50 ✓ (always correct)
- Kills: 0 ✗ (because kills = 0)
- Win Bonus: 100 ✓ (if winner)
- Top 3: 50 ✓ (if top 3)

---

## 6. Root Cause Summary

| Layer | Issue |
|-------|-------|
| **Server Logic** | ✓ Kills/Deaths tracked correctly in PlayerState |
| **Match.GetFinalScores()** | ✓ Returns correct PlayerScore[] with all data |
| **broadcast_helper.go** | ✓ Passes correctly formatted data to JSON serializer |
| **Event Schema** | ✗ **MISMATCH** - Defines Record<string, number> instead of PlayerScore[] |
| **JSON Wire Format** | ✓ Server sends correct structure |
| **Client Type Validation** | ✗ **MISMATCH** - Expects PlayerScore[] array |
| **Client Rendering** | ✗ Tries to access .kills/.deaths on Record object → undefined |

---

## 7. Why This Bug Exists

The event schema in `events-schema/src/schemas/server-to-client.ts` was likely written before the final data structure was decided. The schema defines `finalScores` as a simple `Record<string, number>` (perhaps originally intended to map player IDs to total scores), but:

1. The server implementation evolved to use `PlayerScore` objects
2. The client type definition was created correctly
3. **The event schema was never updated to match the actual implementation**

This is a classic "schema drift" problem where the TypeBox schema definitions don't match the actual runtime types being sent over the wire.

---

## 8. Impact Assessment

### What Works:
- During-match kill tracking (player:kill_credit events are correct)
- XP accumulation on the server
- Base XP display (always 50)
- Win/Top 3 bonuses
- Match winner determination

### What's Broken:
- Final leaderboard shows 0 kills for all players
- Final leaderboard shows 0 deaths for all players
- XP breakdown shows 0 kills multiplier (0 × 100 = 0)
- Player ranking is broken (can't sort by kills when all are 0)

---

## 9. Recommendations

### Fix Priority: CRITICAL

The fix requires updating the event schema to match the actual data structure:

**Change in `events-schema/src/schemas/server-to-client.ts` (line 341):**

From:
```typescript
finalScores: Type.Record(Type.String(), Type.Number(), {
  description: 'Map of player IDs to final scores',
}),
```

To:
```typescript
finalScores: Type.Array(
  Type.Object({
    playerId: Type.String({ description: 'Player unique identifier' }),
    kills: Type.Integer({ description: 'Number of kills', minimum: 0 }),
    deaths: Type.Integer({ description: 'Number of deaths', minimum: 0 }),
    xp: Type.Integer({ description: 'Total XP earned', minimum: 0 }),
  }),
  { description: 'Array of final player scores' }
),
```

This will:
1. Update the TypeBox schema to match runtime types
2. Ensure Go server JSON marshaling produces correct format
3. Align with client expectations
4. Fix the leaderboard display
5. Fix XP breakdown calculations

---

## 10. Testing Implications

Once fixed, verify:
- [ ] Server sends `finalScores` as array of PlayerScore objects
- [ ] Client receives data without type errors
- [ ] Leaderboard displays correct kills (non-zero for players who got kills)
- [ ] Leaderboard displays correct deaths
- [ ] XP breakdown shows correct kills multiplier
- [ ] Player ranking sorts correctly by kills descending, deaths ascending
- [ ] Integration tests cover match end scenario

---

## Appendix: File Reference Map

| File | Purpose | Key Lines |
|------|---------|-----------|
| `player.go` | PlayerState kills/deaths tracking | 34-35, 214-225 |
| `match.go` | GetFinalScores collection | 185-213 |
| `message_processor.go` | Kill event handling | 170-173, 206-207 |
| `broadcast_helper.go` | Match end broadcast | 254 |
| `server-to-client.ts` | Event schema (BUG) | 338-347 |
| `types.ts` | Client MatchEndData type | 18-22 |
| `MatchEndScreen.tsx` | Leaderboard rendering (broken) | 16-31, 142 |
| `xpCalculator.ts` | XP formula | 35 |

