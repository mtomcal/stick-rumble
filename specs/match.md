# Match System

> **Spec Version**: 1.0.0
> **Last Updated**: 2026-02-02
> **Depends On**: [constants.md](constants.md), [rooms.md](rooms.md), [player.md](player.md), [messages.md](messages.md)
> **Depended By**: [test-index.md](test-index.md)

---

## Overview

The match system manages the lifecycle of competitive gameplay within a room. A match tracks win conditions, maintains a countdown timer, records kill statistics, determines winners, and broadcasts final scores when the match concludes.

**WHY**: Matches provide structure and competition. Without win conditions, the game would be an endless sandbox. The match system creates stakes and clear goals, driving player engagement.

---

## Dependencies

### Technology Dependencies

| Technology | Version | Purpose |
|------------|---------|---------|
| Go | 1.25 | Server-side match state management |
| sync.RWMutex | stdlib | Thread-safe concurrent access to match state |
| time | stdlib | Timer tracking and elapsed time calculations |

### Spec Dependencies

- [constants.md](constants.md) - Kill target, time limit values
- [rooms.md](rooms.md) - Room-to-match relationship, broadcast patterns
- [player.md](player.md) - Player statistics (kills, deaths, XP)
- [messages.md](messages.md) - `match:timer`, `match:ended` message schemas

---

## Constants

See [constants.md](constants.md) for the authoritative values. Key match constants:

| Constant | Value | Unit | Description |
|----------|-------|------|-------------|
| KILL_TARGET | 20 | kills | Number of kills to win (normal mode) |
| TIME_LIMIT_SECONDS | 420 | seconds | Match duration (7 minutes, normal mode) |
| TEST_KILL_TARGET | 2 | kills | Number of kills to win (test mode) |
| TEST_TIME_LIMIT_SECONDS | 10 | seconds | Match duration (test mode) |
| TIMER_BROADCAST_INTERVAL | 1 | second | How often `match:timer` is sent |

**WHY these values**:
- **20 kills**: High enough to prevent luck-based wins, low enough to complete in 7 minutes with 2-8 players
- **7 minutes**: Long enough for meaningful gameplay, short enough for quick sessions (browser-based audience)
- **Test mode (2 kills, 10s)**: Enables fast automated testing without waiting for real gameplay durations
- **1-second timer**: Matches player expectations from other games; finer granularity wastes bandwidth

---

## Data Structures

### MatchState Enum

Represents the current phase of the match lifecycle.

**Go:**
```go
type MatchState string

const (
    MatchStateWaiting MatchState = "waiting" // Waiting for players
    MatchStateActive  MatchState = "active"  // Match in progress
    MatchStateEnded   MatchState = "ended"   // Match completed
)
```

**WHY three states**:
- **waiting**: Prevents timer from counting down while room is under-populated
- **active**: Normal gameplay with timer running
- **ended**: Freezes all gameplay, prevents further kills/damage from affecting results

---

### MatchConfig

Configuration values for a match instance.

**Go:**
```go
type MatchConfig struct {
    KillTarget       int // Number of kills needed to win (default: 20)
    TimeLimitSeconds int // Time limit in seconds (default: 420)
}
```

**WHY configurable**:
- Allows test mode to override defaults without code changes
- Future: Could support custom game modes (quick match, extended match)

---

### Match

The main match state container.

**Go:**
```go
type Match struct {
    Config            MatchConfig
    State             MatchState
    StartTime         time.Time
    EndReason         string          // "kill_target" or "time_limit"
    PlayerKills       map[string]int  // Maps player ID to kill count
    RegisteredPlayers map[string]bool // Tracks all players (including 0-kill players)
    mu                sync.RWMutex
}
```

| Field | Type | Description |
|-------|------|-------------|
| Config | MatchConfig | Kill target and time limit values |
| State | MatchState | Current match state (waiting/active/ended) |
| StartTime | time.Time | When the match transitioned to active |
| EndReason | string | Why the match ended: `"kill_target"` or `"time_limit"` |
| PlayerKills | map[string]int | Kill count per player ID |
| RegisteredPlayers | map[string]bool | All players who joined (for final scores) |
| mu | sync.RWMutex | Thread-safety for concurrent access |

**WHY RegisteredPlayers separate from PlayerKills**:
- A player with 0 kills wouldn't appear in PlayerKills (map only has entries for players who scored)
- RegisteredPlayers ensures ALL players appear in final scores, even those with 0 kills
- This prevents confusion when scoreboard shows fewer players than were in the match

---

### PlayerScore

Final score data for a single player, used in `match:ended` message.

**Go:**
```go
type PlayerScore struct {
    PlayerID string `json:"playerId"`
    Kills    int    `json:"kills"`
    Deaths   int    `json:"deaths"`
    XP       int    `json:"xp"`
}
```

**TypeScript:**
```typescript
interface PlayerScore {
  playerId: string;
  kills: number;
  deaths: number;
  xp: number;
}
```

**WHY include deaths and XP**:
- Deaths show engagement (a player with 5 kills and 15 deaths was active)
- XP provides a secondary metric beyond raw kills
- Enables future features like K/D ratio display

---

## Behavior

### Match State Machine

```
          ┌─────────────────────────────────────────────────────┐
          │                                                     │
          ▼                                                     │
     ┌─────────┐     2+ players     ┌─────────┐             ┌───────┐
     │ WAITING │ ─────────────────► │ ACTIVE  │ ──────────► │ ENDED │
     └─────────┘      join          └─────────┘   kill/time └───────┘
          ▲                              │                       │
          │                              │                       │
          └──────────────────────────────┴───────────────────────┘
                    (No transitions back from ENDED)
```

**State Transitions:**

| From | To | Trigger | Action |
|------|-----|---------|--------|
| WAITING | ACTIVE | Room has 2+ players | Set StartTime, begin timer countdown |
| ACTIVE | ENDED | Kill target reached | Set EndReason="kill_target", broadcast `match:ended` |
| ACTIVE | ENDED | Time limit reached | Set EndReason="time_limit", broadcast `match:ended` |

**WHY no transition back from ENDED**:
- Match results are final once determined
- Prevents race conditions where late damage could alter results
- Clear endpoint for client to display final scoreboard

---

### Match Start

When a room reaches 2+ players, the match starts automatically.

**Pseudocode:**
```
function Start():
    lock match mutex

    if State == ACTIVE:
        return  // Already running, don't restart

    State = ACTIVE
    StartTime = now()

    unlock match mutex
```

**Go:**
```go
func (m *Match) Start() {
    m.mu.Lock()
    defer m.mu.Unlock()

    // Don't restart if already active
    if m.State == MatchStateActive {
        return
    }

    m.State = MatchStateActive
    m.StartTime = time.Now()
}
```

**WHY idempotent start**:
- Room might call Start() multiple times if players join rapidly
- Prevents timer reset if match already running
- First StartTime is authoritative

---

### Player Registration

All players joining a room must be registered to appear in final scores.

**Pseudocode:**
```
function RegisterPlayer(playerID):
    lock match mutex

    RegisteredPlayers[playerID] = true

    if PlayerKills[playerID] does not exist:
        PlayerKills[playerID] = 0

    unlock match mutex
```

**Go:**
```go
func (m *Match) RegisterPlayer(playerID string) {
    m.mu.Lock()
    defer m.mu.Unlock()

    m.RegisteredPlayers[playerID] = true
    if _, exists := m.PlayerKills[playerID]; !exists {
        m.PlayerKills[playerID] = 0
    }
}
```

**WHY register separately from kill tracking**:
- A player might never get a kill but should still appear in scores
- Registration happens on join, kill tracking happens on death events
- Separating concerns makes the code clearer

---

### Kill Tracking

Each kill is tracked in the match for win condition checking.

**Pseudocode:**
```
function AddKill(playerID):
    lock match mutex
    PlayerKills[playerID]++
    unlock match mutex
```

**Go:**
```go
func (m *Match) AddKill(playerID string) {
    m.mu.Lock()
    defer m.mu.Unlock()

    m.PlayerKills[playerID]++
}
```

**When called**: On each `player:death` event, the attacker's ID is passed to AddKill.

---

### Kill Target Check

Determines if any player has reached the kill target.

**Pseudocode:**
```
function CheckKillTarget() -> bool:
    lock match mutex (read)

    for each (playerID, kills) in PlayerKills:
        if kills >= Config.KillTarget:
            return true

    return false
```

**Go:**
```go
func (m *Match) CheckKillTarget() bool {
    m.mu.RLock()
    defer m.mu.RUnlock()

    for _, kills := range m.PlayerKills {
        if kills >= m.Config.KillTarget {
            return true
        }
    }

    return false
}
```

**WHY >= instead of ==**:
- Edge case: Multi-kill could push player from 19 to 21 kills
- Using `>=` ensures win is detected regardless of exact count

---

### Timer Calculation

Gets the remaining seconds in the match.

**Pseudocode:**
```
function GetRemainingSeconds() -> int:
    lock match mutex (read)

    if StartTime is zero:
        return Config.TimeLimitSeconds  // Match not started

    elapsed = now() - StartTime (in seconds)
    remaining = Config.TimeLimitSeconds - elapsed

    if remaining < 0:
        return 0

    return remaining
```

**Go:**
```go
func (m *Match) GetRemainingSeconds() int {
    m.mu.RLock()
    defer m.mu.RUnlock()

    if m.StartTime.IsZero() {
        return m.Config.TimeLimitSeconds
    }

    elapsed := int(time.Since(m.StartTime).Seconds())
    remaining := m.Config.TimeLimitSeconds - elapsed

    if remaining < 0 {
        return 0
    }

    return remaining
}
```

**WHY return full time if not started**:
- Client can display "7:00" even before match officially begins
- Prevents confusing negative or undefined timer displays

---

### Time Limit Check

Determines if the time limit has been reached.

**Pseudocode:**
```
function CheckTimeLimit() -> bool:
    lock match mutex (read)

    if StartTime is zero:
        return false  // Match not started, can't expire

    elapsed = now() - StartTime (in seconds)
    return elapsed >= Config.TimeLimitSeconds
```

**Go:**
```go
func (m *Match) CheckTimeLimit() bool {
    m.mu.RLock()
    defer m.mu.RUnlock()

    if m.StartTime.IsZero() {
        return false
    }

    elapsed := time.Since(m.StartTime).Seconds()
    return elapsed >= float64(m.Config.TimeLimitSeconds)
}
```

---

### Match End

Ends the match with a specific reason. Can only be called once.

**Pseudocode:**
```
function EndMatch(reason):
    lock match mutex

    if State == ENDED:
        return  // Already ended, don't change reason

    State = ENDED
    EndReason = reason

    unlock match mutex
```

**Go:**
```go
func (m *Match) EndMatch(reason string) {
    m.mu.Lock()
    defer m.mu.Unlock()

    if m.State == MatchStateEnded {
        return
    }

    m.State = MatchStateEnded
    m.EndReason = reason
}
```

**WHY only end once**:
- Race condition: Kill target reached at same tick as time limit
- First end reason wins, results are deterministic
- Prevents reason from flipping between "kill_target" and "time_limit"

---

### Winner Determination

Finds all players with the highest kill count.

**Pseudocode:**
```
function DetermineWinners() -> []string:
    lock match mutex (read)

    if PlayerKills is empty:
        return []

    maxKills = 0
    for each (_, kills) in PlayerKills:
        if kills > maxKills:
            maxKills = kills

    winners = []
    for each (playerID, kills) in PlayerKills:
        if kills == maxKills:
            winners.append(playerID)

    return winners
```

**Go:**
```go
func (m *Match) DetermineWinners() []string {
    m.mu.RLock()
    defer m.mu.RUnlock()

    if len(m.PlayerKills) == 0 {
        return []string{}
    }

    maxKills := 0
    for _, kills := range m.PlayerKills {
        if kills > maxKills {
            maxKills = kills
        }
    }

    winners := []string{}
    for playerID, kills := range m.PlayerKills {
        if kills == maxKills {
            winners = append(winners, playerID)
        }
    }

    return winners
}
```

**WHY return multiple winners**:
- Ties are valid outcomes (both players have 10 kills when time expires)
- Client displays "TIE" when winners array has > 1 entry
- More fair than arbitrary tiebreaker (first to kill, alphabetical, etc.)

---

### Final Scores Collection

Collects all player scores for the `match:ended` message.

**Pseudocode:**
```
function GetFinalScores(world) -> []PlayerScore:
    lock match mutex (read)
    lock world mutex (read)

    scores = []

    for each playerID in RegisteredPlayers:
        player = world.GetPlayer(playerID)
        if player does not exist:
            continue

        scores.append(PlayerScore{
            PlayerID: playerID,
            Kills: player.Kills,
            Deaths: player.Deaths,
            XP: player.XP,
        })

    return scores
```

**Go:**
```go
func (m *Match) GetFinalScores(world *World) []PlayerScore {
    m.mu.RLock()
    defer m.mu.RUnlock()

    scores := []PlayerScore{}

    world.mu.RLock()
    defer world.mu.RUnlock()

    for playerID := range m.RegisteredPlayers {
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

**WHY read from World instead of Match**:
- Player's Kills/Deaths/XP are the authoritative source (on PlayerState)
- Match.PlayerKills only tracks kills for win condition, not full stats
- World contains the complete, up-to-date player state

---

## Timer Broadcast Loop

The server broadcasts `match:timer` messages every second to all active rooms.

### Loop Implementation

**Pseudocode:**
```
function matchTimerLoop():
    ticker = createTicker(1 second)

    loop:
        wait for ticker

        for each room in allRooms:
            if room.Match.IsEnded():
                continue  // Skip ended matches

            remainingSeconds = room.Match.GetRemainingSeconds()

            broadcast to room: match:timer { remainingSeconds }

            if room.Match.CheckTimeLimit():
                room.Match.EndMatch("time_limit")
                broadcast to room: match:ended { winners, finalScores, reason }
```

**Go:**
```go
func (h *WebSocketHandler) matchTimerLoop(ctx context.Context) {
    ticker := time.NewTicker(h.timerInterval) // Default: 1 second
    defer ticker.Stop()

    for {
        select {
        case <-ctx.Done():
            log.Println("Match timer loop stopped")
            return
        case <-ticker.C:
            h.broadcastMatchTimers()
        }
    }
}
```

**WHY 1-second interval**:
- Matches UI expectation (seconds countdown)
- Lower bandwidth than per-tick updates (60Hz → 1Hz)
- Human-readable time remaining

---

### Kill Target Check Flow

Kill target is checked immediately after each death, not in the timer loop.

**Flow:**
```
1. Projectile hits player
2. Player health reaches 0
3. player:death broadcast
4. player:kill_credit broadcast
5. Match.AddKill(attackerID)
6. Match.CheckKillTarget()
7. If reached: Match.EndMatch("kill_target"), broadcast match:ended
```

**WHY check after each kill**:
- Immediate feedback when target reached
- No waiting for next timer tick
- Prevents additional kills being counted after win

---

## Test Mode

Reduces kill target and time limit for automated testing.

**Activation:**
```bash
TEST_MODE=true go run cmd/server/main.go
```

**Go:**
```go
func (m *Match) SetTestMode() {
    m.mu.Lock()
    defer m.mu.Unlock()

    m.Config.KillTarget = 2
    m.Config.TimeLimitSeconds = 10
}
```

**Where applied** (in room.go):
```go
match := NewMatch()
if os.Getenv("TEST_MODE") == "true" {
    match.SetTestMode()
}
```

**WHY environment variable**:
- No code changes needed for test vs production
- CI/CD can set env var for integration tests
- Prevents accidental test config in production

---

## Error Handling

### Match Already Ended

**Trigger**: Kill or time limit detected after match already ended
**Detection**: `m.State == MatchStateEnded` check
**Response**: No-op, return early
**Recovery**: None needed, state is final

### Player Not Found in World

**Trigger**: GetFinalScores called for player who disconnected
**Detection**: `!exists` check after world lookup
**Response**: Skip player, don't include in scores
**Recovery**: Disconnected players simply don't appear in final results

### Empty Match

**Trigger**: DetermineWinners called with no players
**Detection**: `len(m.PlayerKills) == 0`
**Response**: Return empty array `[]string{}`
**Client Handling**: Display "No winner" or similar

---

## WebSocket Messages

### match:timer

Sent every second to all players in active matches.

**Trigger**: Timer broadcast loop (1 Hz)
**Recipient**: All players in room

**TypeScript Schema:**
```typescript
interface MatchTimerData {
  remainingSeconds: number; // Seconds left (0-420 for normal mode)
}
```

**Go Broadcast:**
```go
data := map[string]interface{}{
    "remainingSeconds": remainingSeconds,
}
message := Message{
    Type:      "match:timer",
    Timestamp: 0,
    Data:      data,
}
room.Broadcast(msgBytes, "")
```

**Example JSON:**
```json
{
  "type": "match:timer",
  "timestamp": 0,
  "data": {
    "remainingSeconds": 315
  }
}
```

---

### match:ended

Sent when match concludes (kill target or time limit).

**Trigger**: Kill target reached or time limit expired
**Recipient**: All players in room

**TypeScript Schema:**
```typescript
interface MatchEndedData {
  winners: string[];       // Array of winner player IDs (multiple if tie)
  finalScores: PlayerScore[]; // All player stats
  reason: string;          // "kill_target" or "time_limit"
}
```

**Go Broadcast:**
```go
winners := room.Match.DetermineWinners()
finalScores := room.Match.GetFinalScores(world)

data := map[string]interface{}{
    "winners":     winners,
    "finalScores": finalScores,
    "reason":      room.Match.EndReason,
}
message := Message{
    Type:      "match:ended",
    Timestamp: 0,
    Data:      data,
}
room.Broadcast(msgBytes, "")
```

**Example JSON (kill target):**
```json
{
  "type": "match:ended",
  "timestamp": 0,
  "data": {
    "winners": ["player-abc123"],
    "finalScores": [
      { "playerId": "player-abc123", "kills": 20, "deaths": 5, "xp": 2000 },
      { "playerId": "player-def456", "kills": 12, "deaths": 8, "xp": 1200 },
      { "playerId": "player-ghi789", "kills": 0, "deaths": 7, "xp": 0 }
    ],
    "reason": "kill_target"
  }
}
```

**Example JSON (time limit with tie):**
```json
{
  "type": "match:ended",
  "timestamp": 0,
  "data": {
    "winners": ["player-abc123", "player-def456"],
    "finalScores": [
      { "playerId": "player-abc123", "kills": 10, "deaths": 5, "xp": 1000 },
      { "playerId": "player-def456", "kills": 10, "deaths": 6, "xp": 1000 }
    ],
    "reason": "time_limit"
  }
}
```

---

## Client Handling

### Timer Display

```typescript
// On match:timer message
wsClient.on('match:timer', (data: { remainingSeconds: number }) => {
  if (matchEnded) {
    return; // Ignore timer updates after match ends
  }

  const minutes = Math.floor(data.remainingSeconds / 60);
  const seconds = data.remainingSeconds % 60;
  timerDisplay.setText(`${minutes}:${seconds.toString().padStart(2, '0')}`);

  // Visual warning colors based on remaining time
  if (data.remainingSeconds < 60) {
    timerDisplay.setColor('#ff0000');   // Red: under 1 minute
  } else if (data.remainingSeconds < 120) {
    timerDisplay.setColor('#ffff00');   // Yellow: under 2 minutes
  } else {
    timerDisplay.setColor('#ffffff');   // White: normal
  }
});
```

### Match End Handling

```typescript
// In GameSceneEventHandlers.ts — match:ended handler
const matchEndedHandler = (data: unknown) => {
  const messageData = data as MatchEndedData;

  // Set flag to stop processing player:move messages
  this.matchEnded = true;

  // Freeze gameplay by disabling input
  if (this.inputManager) {
    // ... disable input handlers
  }

  // Bridge to React via window.onMatchEnd (React renders MatchEndScreen)
  const localPlayerId = this.playerManager.getLocalPlayerId();
  if (localPlayerId && window.onMatchEnd) {
    window.onMatchEnd(messageData as MatchEndData, localPlayerId);
  }
};
this.wsClient.on('match:ended', matchEndedHandler);
```

> **Note:** There is no `showEndScreen()` in Phaser. Match end display is handled by React via `window.onMatchEnd` — a bridge function set up by the React `PhaserGame` component. React renders the `MatchEndScreen` modal overlay.

**WHY set matchEnded flag**:
- Prevents processing `player:move` messages after match ends
- Freezes players in place on the scoreboard
- Ignores late `match:timer` messages that might arrive out of order

---

## Implementation Notes

### TypeScript (Client)

- Store `matchEnded` boolean flag to gate message processing
- Format remaining seconds as `MM:SS` for display
- Sort finalScores by kills descending for leaderboard
- Handle edge case: winners array may have 0, 1, or multiple entries

### Go (Server)

- Use `sync.RWMutex` for all Match operations
- Call `AddKill` after broadcasting `player:kill_credit`
- Check `CheckKillTarget()` immediately after each kill
- Use `CheckTimeLimit()` in the timer loop to detect expiration
- Lock order: Match mutex first, then World mutex (in GetFinalScores)

---

## Test Scenarios

### TS-MATCH-001: Match starts when 2 players join

**Category**: Integration
**Priority**: Critical

**Preconditions:**
- Empty room with WAITING match state

**Input:**
- Two players connect sequentially

**Expected Output:**
- Match state transitions to ACTIVE
- StartTime is set to current time (within tolerance)
- Timer countdown begins

**Pseudocode:**
```
test "Match starts when 2 players join":
    room = createRoom()
    assert room.Match.State == WAITING

    player1 = room.AddPlayer("p1")
    assert room.Match.State == WAITING  // Still waiting

    player2 = room.AddPlayer("p2")
    // Room auto-starts match when 2+ players
    assert room.Match.State == ACTIVE
    assert room.Match.StartTime != zero
```

---

### TS-MATCH-002: Timer counts down correctly

**Category**: Unit
**Priority**: High

**Preconditions:**
- Match started 10 seconds ago
- Default time limit (420s)

**Input:**
- Call GetRemainingSeconds()

**Expected Output:**
- Returns 410 (±1 second tolerance)

**Pseudocode:**
```
test "Timer counts down correctly":
    match = NewMatch()
    match.Start()
    match.StartTime = now() - 10 seconds

    remaining = match.GetRemainingSeconds()

    assert remaining ≈ 410
```

---

### TS-MATCH-003: match:timer sent every second

**Category**: Integration
**Priority**: High

**Preconditions:**
- Match is ACTIVE
- Client connected to room

**Input:**
- Wait 3 seconds

**Expected Output:**
- Client receives at least 2-3 match:timer messages
- Each has decreasing remainingSeconds

**Pseudocode:**
```
test "match:timer sent every second":
    connect two players
    wait for match:timer messages (3 seconds)

    assert received >= 2 messages
    assert messages[0].remainingSeconds > messages[1].remainingSeconds
```

---

### TS-MATCH-004: Match ends when player reaches kill target

**Category**: Integration
**Priority**: Critical

**Preconditions:**
- Match is ACTIVE
- Kill target is 20 (normal mode)

**Input:**
- Player1 gets 20 kills

**Expected Output:**
- Match state becomes ENDED
- EndReason is "kill_target"
- match:ended broadcast to all players
- winners contains Player1's ID

**Pseudocode:**
```
test "Match ends when player reaches kill target":
    match = NewMatch()
    match.Start()

    for i in 1..20:
        match.AddKill("player-1")

    assert match.CheckKillTarget() == true
    match.EndMatch("kill_target")

    assert match.State == ENDED
    assert match.EndReason == "kill_target"
    winners = match.DetermineWinners()
    assert winners == ["player-1"]
```

---

### TS-MATCH-005: Match ends when timer reaches 0

**Category**: Integration
**Priority**: Critical

**Preconditions:**
- Match is ACTIVE
- Time limit configured

**Input:**
- Time limit expires

**Expected Output:**
- Match state becomes ENDED
- EndReason is "time_limit"
- match:ended broadcast to all players

**Pseudocode:**
```
test "Match ends when timer reaches 0":
    match = NewMatch()
    match.Start()
    match.StartTime = now() - 421 seconds  // Past time limit

    assert match.CheckTimeLimit() == true
    match.EndMatch("time_limit")

    assert match.State == ENDED
    assert match.EndReason == "time_limit"
```

---

### TS-MATCH-006: Highest kills wins on time limit

**Category**: Unit
**Priority**: High

**Preconditions:**
- Match ended by time limit
- Multiple players with different kill counts

**Input:**
- Player1: 10 kills, Player2: 8 kills, Player3: 5 kills

**Expected Output:**
- DetermineWinners returns ["player-1"]

**Pseudocode:**
```
test "Highest kills wins on time limit":
    match = NewMatch()

    for i in 1..10: match.AddKill("player-1")
    for i in 1..8: match.AddKill("player-2")
    for i in 1..5: match.AddKill("player-3")

    winners = match.DetermineWinners()

    assert winners == ["player-1"]
```

---

### TS-MATCH-007: Tie results in multiple winners

**Category**: Unit
**Priority**: High

**Preconditions:**
- Match ended
- Two players have same highest kill count

**Input:**
- Player1: 10 kills, Player2: 10 kills

**Expected Output:**
- DetermineWinners returns both player IDs

**Pseudocode:**
```
test "Tie results in multiple winners":
    match = NewMatch()

    for i in 1..10: match.AddKill("player-1")
    for i in 1..10: match.AddKill("player-2")

    winners = match.DetermineWinners()

    assert len(winners) == 2
    assert "player-1" in winners
    assert "player-2" in winners
```

---

### TS-MATCH-008: match:ended includes all player scores

**Category**: Integration
**Priority**: High

**Preconditions:**
- Match ended
- 3 players in room (one with 0 kills)

**Input:**
- GetFinalScores()

**Expected Output:**
- Returns 3 PlayerScore entries
- Includes player with 0 kills

**Pseudocode:**
```
test "match:ended includes all player scores":
    world = NewWorld()
    world.AddPlayer("player-1")
    world.AddPlayer("player-2")
    world.AddPlayer("player-3")

    match = NewMatch()
    match.RegisterPlayer("player-1")
    match.RegisterPlayer("player-2")
    match.RegisterPlayer("player-3")

    // Only player-1 gets kills
    match.AddKill("player-1")
    match.AddKill("player-1")

    scores = match.GetFinalScores(world)

    assert len(scores) == 3
    assert findScore(scores, "player-3") != nil  // 0-kill player included
```

---

### TS-MATCH-009: match:ended reason reflects trigger

**Category**: Unit
**Priority**: Medium

**Preconditions:**
- Match can end by kill target or time limit

**Input:**
- End by kill target
- End by time limit (separate test)

**Expected Output:**
- EndReason matches the trigger

**Pseudocode:**
```
test "match:ended reason is kill_target":
    match = NewMatch()
    match.EndMatch("kill_target")
    assert match.EndReason == "kill_target"

test "match:ended reason is time_limit":
    match = NewMatch()
    match.EndMatch("time_limit")
    assert match.EndReason == "time_limit"
```

---

### TS-MATCH-010: TEST_MODE uses reduced values

**Category**: Unit
**Priority**: Medium

**Preconditions:**
- TEST_MODE environment variable set

**Input:**
- Create match with SetTestMode()

**Expected Output:**
- KillTarget = 2
- TimeLimitSeconds = 10

**Pseudocode:**
```
test "TEST_MODE uses reduced values":
    match = NewMatch()
    match.SetTestMode()

    assert match.Config.KillTarget == 2
    assert match.Config.TimeLimitSeconds == 10
```

---

### TS-MATCH-011: Players with 0 kills included in final scores

**Category**: Unit
**Priority**: Medium

**Preconditions:**
- Match with 3 players
- One player has 0 kills

**Input:**
- GetFinalScores()

**Expected Output:**
- All 3 players appear in scores
- 0-kill player has kills=0 in their entry

**Pseudocode:**
```
test "Players with 0 kills included":
    // Setup world and match
    world.AddPlayer("p1")
    world.AddPlayer("p2")
    world.AddPlayer("p3")

    match.RegisterPlayer("p1")
    match.RegisterPlayer("p2")
    match.RegisterPlayer("p3")

    // Only p1 gets kills
    world.GetPlayer("p1").IncrementKills()

    scores = match.GetFinalScores(world)

    p3Score = findScore(scores, "p3")
    assert p3Score != nil
    assert p3Score.Kills == 0
```

---

### TS-MATCH-012: Match can only end once

**Category**: Unit
**Priority**: Medium

**Preconditions:**
- Match is ACTIVE

**Input:**
- Call EndMatch("kill_target")
- Call EndMatch("time_limit")

**Expected Output:**
- EndReason remains "kill_target" (first call wins)

**Pseudocode:**
```
test "Match can only end once":
    match = NewMatch()
    match.Start()

    match.EndMatch("kill_target")
    match.EndMatch("time_limit")  // Should be ignored

    assert match.EndReason == "kill_target"
```

---

### TS-MATCH-013: Timer updates ignored after match ends

**Category**: Integration
**Priority**: Medium

**Preconditions:**
- Client received match:ended
- matchEnded flag is true

**Input:**
- Receive additional match:timer message

**Expected Output:**
- Timer display not updated
- No errors thrown

**TypeScript:**
```typescript
it('should skip match:timer updates after match has ended', () => {
  // Trigger match:ended
  matchEndedHandler({ winners: ['p1'], finalScores: [], reason: 'kill_target' });

  // Attempt timer update
  matchTimerHandler({ remainingSeconds: 100 });

  // Timer should not have changed from pre-end value
  expect(timerDisplay.text).not.toBe('1:40');
});
```

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-02-02 | Initial specification |
