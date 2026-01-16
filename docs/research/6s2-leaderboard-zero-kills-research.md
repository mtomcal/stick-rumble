# Research: Leaderboard Zero Kills/Deaths Investigation

**Date:** 2026-01-16
**Branch:** 6s2
**Issue:** Match end leaderboard displaying 0 kills/deaths instead of actual values

## Executive Summary

The leaderboard data flow has been traced from kill events to final display. The architecture is sound with proper separation of concerns:
- **Player stats** are tracked in `PlayerState.Kills` and `PlayerState.Deaths`
- **Match kills** are tracked separately in `Match.PlayerKills`
- **Final scores** are retrieved via `Match.GetFinalScores()` which reads player stats
- **Data is transmitted** via `match:ended` WebSocket message
- **React component** (`MatchEndScreen`) receives and displays the data

A **critical architectural issue** has been identified in `Match.GetFinalScores()`:

---

## 1. MatchEndScreen Component

**Location:** `/home/mtomcal/code/stick-rumble-worktrees/6s2/stick-rumble-client/src/ui/match/MatchEndScreen.tsx`

### Props Expected
```typescript
export interface MatchEndScreenProps {
  matchData: MatchEndData;
  localPlayerId: string;
  onClose: () => void;
  onPlayAgain: () => void;
}
```

### Data Structure
```typescript
export interface MatchEndData {
  winners: string[];
  finalScores: PlayerScore[];
  reason: string;
}

export interface PlayerScore {
  playerId: string;
  kills: number;
  deaths: number;
  xp: number;
}
```

### Display Logic
The component displays kills/deaths directly from the `finalScores` array:
- Line 137: `{player.kills}` - Kills value
- Line 138: `{player.deaths}` - Deaths value

**The component is working correctly** - it displays what it receives from the server.

---

## 2. GetFinalScores Function - ROOT CAUSE

**Location:** `/home/mtomcal/code/stick-rumble-server/internal/game/match.go` (Lines 185-213)

### Code
```go
func (m *Match) GetFinalScores(world *World) []PlayerScore {
	m.mu.RLock()
	defer m.mu.RUnlock()

	scores := []PlayerScore{}

	world.mu.RLock()
	defer world.mu.RUnlock()

	for playerID := range m.PlayerKills {  // ⚠️ ONLY iterates players with kills!
		player, exists := world.players[playerID]
		if !exists {
			continue
		}

		score := PlayerScore{
			PlayerID: playerID,
			Kills:    player.Kills,
			Deaths:   player.Deaths,
			XP:       player.XP,
		}
		scores = append(scores, score)
	}

	return scores
}
```

### THE BUG

**Line 196 iterates ONLY through `m.PlayerKills`**, which is a map populated only when players get kills.

**Players who never get a kill are completely excluded from final scores.**

### Data Sources
1. **Iteration source:** `m.PlayerKills` - Match-level kill tracking for win conditions
2. **Score data:** `player.Kills`, `player.Deaths`, `player.XP` - From `PlayerState` objects

### Problem Scenarios

**Scenario 1: Player Never Gets a Kill**
- Player joins → Survives → Gets killed → Never kills anyone
- Result: PlayerID never added to `m.PlayerKills`
- Consequence: **Player completely missing from final scores**

**Scenario 2: Match Ends by Time Limit (No/Few Kills)**
- Time expires before kills accumulate
- Few players have `m.PlayerKills` entries
- Result: **Most players excluded from leaderboard**

**Scenario 3: Partial Participation**
- Players A, B get kills (in `m.PlayerKills`)
- Player C only takes damage/dies (not in `m.PlayerKills`)
- Result: **Player C excluded**

---

## 3. Kill/Death Tracking During Gameplay

**Location:** `/home/mtomcal/code/stick-rumble-server/internal/network/message_processor.go` (Lines 88-243)

### When a Player Dies (onHit function)

```go
if !victimState.IsAlive() {  // Line 164
    // Mark player as dead
    h.gameServer.MarkPlayerDead(hit.VictimID)

    // ✓ Update player stats correctly
    attackerState, attackerExists := h.gameServer.GetPlayerState(hit.AttackerID)
    if attackerExists {
        attackerState.IncrementKills()      // ← PlayerState.Kills++
        attackerState.AddXP(game.KillXPReward)
    }
    victimState.IncrementDeaths()          // ← PlayerState.Deaths++

    // Broadcast events...

    if room != nil {
        room.Broadcast(deathBytes, "")

        // ✓ Track in match for win condition checking
        room.Match.AddKill(hit.AttackerID)  // ← Match.PlayerKills[id]++

        // Check win conditions...
    }
}
```

### Data Structures

**PlayerState** (`player.go`):
```go
type PlayerState struct {
    ID     string
    Kills  int  // ← Properly incremented with mutex protection
    Deaths int  // ← Properly incremented with mutex protection
    XP     int  // ← Properly incremented
}

func (p *PlayerState) IncrementKills() {
    p.mu.Lock()
    defer p.mu.Unlock()
    p.Kills++
}

func (p *PlayerState) IncrementDeaths() {
    p.mu.Lock()
    defer p.mu.Unlock()
    p.Deaths++
}
```

**Match** (`match.go`):
```go
type Match struct {
    PlayerKills map[string]int  // ← Only keys are players who got kills
}

func (m *Match) AddKill(playerID string) {
    m.mu.Lock()
    defer m.mu.Unlock()
    m.PlayerKills[playerID]++
}
```

### Critical Observation

**TWO separate kill-tracking systems exist:**
1. `PlayerState.Kills` - Individual player statistics
2. `Match.PlayerKills` - Match-level tracking for win conditions

These get out of sync because `GetFinalScores()` only looks at the second one!

---

## 4. match:ended WebSocket Event

**Location:** `/home/mtomcal/code/stick-rumble-server/internal/network/broadcast_helper.go` (Lines 246-286)

### Broadcasting
```go
func (h *WebSocketHandler) broadcastMatchEnded(room *game.Room, world *game.World) {
    winners := room.Match.DetermineWinners()
    finalScores := room.Match.GetFinalScores(world)  // ← Calls buggy function

    data := map[string]interface{}{
        "winners":     winners,
        "finalScores": finalScores,  // ← Contains incomplete data!
        "reason":      room.Match.EndReason,
    }

    message := Message{
        Type: "match:ended",
        Data: data,
    }

    msgBytes, err := json.Marshal(message)
    room.Broadcast(msgBytes, "")
}
```

### Event Schema

The `MatchEndedData` schema correctly defines the structure:

```typescript
export const MatchEndedDataSchema = Type.Object({
    winners: Type.Array(Type.String()),
    finalScores: Type.Array(PlayerScoreSchema),
    reason: Type.String(),
});
```

**The schema is correct; the data passed into it is incomplete.**

### Client Receives Incomplete Array

**Location:** `/home/mtomcal/code/stick-rumble-client/src/game/scenes/GameSceneEventHandlers.ts` (Lines 376-399)

```typescript
const matchEndedHandler = (data: unknown) => {
    const messageData = data as MatchEndedData;
    console.log('Final scores:', messageData.finalScores);  // ← Incomplete!

    if (localPlayerId && window.onMatchEnd) {
        window.onMatchEnd(messageData, localPlayerId);
    }
};
```

---

## 5. Complete Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│ Kill Event: Attacker shoots victim                           │
└────────────────────────┬────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ message_processor.go - onHit()                              │
│                                                              │
│ ✓ attackerState.IncrementKills()     [PlayerState.Kills++]  │
│ ✓ victimState.IncrementDeaths()      [PlayerState.Deaths++] │
│ ✓ room.Match.AddKill(attacker)       [Match.PlayerKills++]  │
└────────────────────────┬────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ Match Ends (Time or Kill Target)                             │
│ broadcast_helper.go - broadcastMatchEnded()                 │
│                                                              │
│ ⚠️  finalScores = room.Match.GetFinalScores(world)          │
│     ONLY iterates players in Match.PlayerKills              │
│     Missing players who never got kills!                    │
└────────────────────────┬────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ WebSocket Message: match:ended                              │
│ {                                                            │
│   finalScores: [INCOMPLETE ARRAY]                           │
│ }                                                            │
└────────────────────────┬────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ React Component: MatchEndScreen                             │
│                                                              │
│ Displays finalScores array as-is                           │
│ Result: Missing players OR 0 values                         │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. Test Analysis

### Current Test (match_test.go, Lines 351-411)

```go
func TestGetFinalScores(t *testing.T) {
    // Create players in world
    world := NewWorld()
    player1 := world.AddPlayer("player-1")
    player2 := world.AddPlayer("player-2")
    player3 := world.AddPlayer("player-3")

    // MANUALLY set both match kills AND player stats
    player1.IncrementKills()     // ← Manually sets both
    player1.IncrementKills()
    match.AddKill("player-1")    // ← Duplicates the data
    match.AddKill("player-1")

    scores := match.GetFinalScores(world)

    // Passes because all players are in Match.PlayerKills!
    assert.Len(t, scores, 3)
}
```

### Why Test Passes (False Confidence)

The test manually adds data to both systems, masking the bug. In real gameplay, a player with 0 kills never gets added to `Match.PlayerKills`.

### Missing Test Scenario

```go
// This test SHOULD fail with current code but doesn't exist:
func TestGetFinalScores_PlayerWithNeverKills(t *testing.T) {
    world := NewWorld()
    attacker := world.AddPlayer("attacker")
    defender := world.AddPlayer("defender")

    // Attacker kills defender
    attacker.IncrementKills()
    defender.IncrementDeaths()
    match.AddKill("attacker")  // Only attacker added to Match.PlayerKills!

    scores := match.GetFinalScores(world)

    // ❌ FAILS: Expects 2 players but gets 1
    // Defender is missing because never got a kill!
    assert.Len(t, scores, 2)
}
```

---

## 7. Why Individual Stats Show 0

### Stats ARE Being Tracked

The increment functions work correctly:
- `PlayerState.IncrementKills()` - Uses mutex, properly increments
- `PlayerState.IncrementDeaths()` - Uses mutex, properly increments
- `PlayerState.AddXP()` - Works correctly

### When 0 Values Appear

1. **Player not in `finalScores` at all** → Not displayed on leaderboard
2. **Player in `finalScores` with Kills=0, Deaths=0**:
   - They're in `Match.PlayerKills` (got at least one kill)
   - Their actual `PlayerState.Kills` and `Deaths` are 0
   - This could happen if: stats weren't incremented (but they are)

3. **Most likely:** Player never appears on leaderboard at all due to not being in the array

---

## Summary: Data Flow Path

1. **Kill happens** → `IncrementKills()` on PlayerState ✓
2. **Death happens** → `IncrementDeaths()` on PlayerState ✓
3. **Match.AddKill()** called → PlayerID added to `Match.PlayerKills` ✓
4. **Match ends** → `GetFinalScores()` called
5. **BUG:** `GetFinalScores()` iterates only `Match.PlayerKills` ❌
6. **Result:** Players never added to `PlayerKills` are excluded
7. **Server sends:** Incomplete `finalScores` array
8. **Client receives:** Incomplete data
9. **React displays:** Only players from the incomplete array

---

## Root Cause: Single Point of Failure

The bug is entirely in `Match.GetFinalScores()` at line 196:

```go
for playerID := range m.PlayerKills {  // ← Should iterate all players, not just killers
```

This should be:

```go
for playerID, player := range world.players {  // ← Include all players
    score := PlayerScore{
        PlayerID: playerID,
        Kills:    player.Kills,
        Deaths:   player.Deaths,
        XP:       player.XP,
    }
    scores = append(scores, score)
}
```

---

## Files Involved

**Server:**
- `stick-rumble-server/internal/game/match.go` - `GetFinalScores()` (THE BUG)
- `stick-rumble-server/internal/network/broadcast_helper.go` - Calls buggy function
- `stick-rumble-server/internal/network/message_processor.go` - Tracks kills correctly

**Client:**
- `stick-rumble-client/src/ui/match/MatchEndScreen.tsx` - Displays data correctly
- `stick-rumble-client/src/game/scenes/GameSceneEventHandlers.ts` - Receives data

---

This research document is now complete and ready for implementation of the fix.
