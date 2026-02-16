# Rooms

> **Spec Version**: 1.1.0
> **Last Updated**: 2026-02-15
> **Depends On**: [constants.md](constants.md), [player.md](player.md), [networking.md](networking.md), [messages.md](messages.md)
> **Depended By**: [match.md](match.md), [server-architecture.md](server-architecture.md)

---

## Overview

The room system manages how players are grouped together for matches. It handles matchmaking (pairing waiting players), room lifecycle (creation and destruction), and message broadcasting within rooms. The design prioritizes simplicity: when two players are waiting, a room is automatically created and the match begins. This removes the complexity of lobbies or manual room selection while ensuring minimal wait times for a fast-paced arena shooter.

**Why rooms instead of a single global arena?**
- Isolated game state prevents cheating across matches
- 8-player limit keeps matches manageable and server load predictable
- Parallel matches scale horizontally
- Match end doesn't affect players in other rooms

---

## Dependencies

### Technology Dependencies

| Technology | Version | Purpose |
|------------|---------|---------|
| Go sync.RWMutex | 1.25 | Thread-safe access to room state |
| UUID | - | Unique room and player identifiers |

### Spec Dependencies

- [constants.md](constants.md) - Room capacity limits
- [player.md](player.md) - Player state structure
- [networking.md](networking.md) - WebSocket connection lifecycle
- [messages.md](messages.md) - `room:joined` and `player:left` message formats

---

## Constants

| Constant | Value | Unit | Description |
|----------|-------|------|-------------|
| MAX_PLAYERS_PER_ROOM | 8 | players | Maximum room capacity |
| MIN_PLAYERS_TO_START | 2 | players | Minimum for auto-creation |
| SEND_BUFFER_SIZE | 256 | messages | Per-player message buffer |

**Why 8 players max?**
- Larger than 8 becomes visually chaotic in a 1920x1080 arena
- Prevents spawn camping issues
- Keeps network traffic predictable

**Why 2 players minimum?**
- A deathmatch requires at least 2 combatants
- No waiting for "enough" players - matches start immediately
- Single player doesn't make sense for competitive gameplay

---

## Data Structures

### Player (Network Context)

A minimal player representation used for room membership and message routing.

**Go:**
```go
type Player struct {
    ID          string       // UUID assigned on connection
    SendChan    chan []byte  // Buffered channel for outgoing messages
    PingTracker *PingTracker // [NEW] Per-player RTT measurement for lag compensation
}
```

**Why a channel for sending?**
- Decouples game loop from socket writes
- Prevents slow connections from blocking game tick
- Buffer allows burst traffic (e.g., multiple projectile spawns)

### Room

A container for players in a single match.

**Go:**
```go
type Room struct {
    ID         string       // UUID, unique room identifier
    Players    []*Player    // Current room members
    MaxPlayers int          // Always 8
    Match      *Match       // Match state (timer, scores)
    mu         sync.RWMutex // Protects Players slice
}
```

**TypeScript (Client doesn't track room state explicitly):**
```typescript
// Client receives both roomId and playerId after room:joined
interface RoomJoinedData {
    roomId: string;
    playerId: string;
}
```

**Why embed Match in Room?**
- One match per room, 1:1 relationship
- Match lifecycle is tied to room lifecycle
- Simplifies state management

### RoomManager

Singleton that manages all rooms and the waiting queue.

**Go:**
```go
type RoomManager struct {
    rooms          map[string]*Room   // Active rooms by ID
    waitingPlayers []*Player          // Queue of unmatched players
    playerToRoom   map[string]string  // Player ID → Room ID lookup
    mu             sync.RWMutex       // Protects all maps/slices
}
```

**Why a centralized manager?**
- Single source of truth for room state
- Prevents race conditions in matchmaking
- Enables room lookup by player ID

---

## Behavior

### Room Creation (Auto-Matchmaking)

When a player connects, they're added to the waiting queue. When the queue reaches 2 players, a room is automatically created.

**Pseudocode:**
```
function addPlayer(player):
    lock(mu)
    defer unlock(mu)

    // Handle tab reload: check for room with exactly 1 player
    for room in rooms:
        if room.playerCount == 1 AND !room.match.isEnded:
            room.addPlayer(player)
            room.match.registerPlayer(player)
            playerToRoom[player.id] = room.id
            send room:joined to player
            return room

    // Normal flow: add to waiting list
    waitingPlayers.add(player)

    // Auto-create when 2 players waiting
    if len(waitingPlayers) >= 2:
        player1 = waitingPlayers.pop()
        player2 = waitingPlayers.pop()

        room = createRoom()
        room.addPlayer(player1)
        room.addPlayer(player2)
        room.match.registerPlayer(player1)
        room.match.registerPlayer(player2)
        room.match.start()

        playerToRoom[player1.id] = room.id
        playerToRoom[player2.id] = room.id

        send room:joined { roomId: room.id, playerId: player1.id } to player1
        send room:joined { roomId: room.id, playerId: player2.id } to player2

        return room

    return nil  // Still waiting
```

**Go:**
```go
func (rm *RoomManager) AddPlayer(player *Player) *Room {
    rm.mu.Lock()
    defer rm.mu.Unlock()

    // Tab reload handling: check for room with exactly 1 player
    for _, room := range rm.rooms {
        if room.PlayerCount() == 1 && !room.Match.IsEnded() {
            room.AddPlayer(player)
            rm.playerToRoom[player.ID] = room.ID
            room.Match.RegisterPlayer(player.ID)

            // RoomManager sends room:joined directly (not caller)
            rm.sendRoomJoinedMessage(player, room)
            return room
        }
    }

    // Add to waiting list
    rm.waitingPlayers = append(rm.waitingPlayers, player)

    // Auto-create room when 2 players waiting
    if len(rm.waitingPlayers) >= 2 {
        player1 := rm.waitingPlayers[0]
        player2 := rm.waitingPlayers[1]

        room := NewRoom()
        room.AddPlayer(player1)
        room.AddPlayer(player2)
        room.Match.RegisterPlayer(player1.ID)
        room.Match.RegisterPlayer(player2.ID)

        rm.waitingPlayers = rm.waitingPlayers[2:]
        rm.rooms[room.ID] = room
        rm.playerToRoom[player1.ID] = room.ID
        rm.playerToRoom[player2.ID] = room.ID

        room.Match.Start()

        // RoomManager sends room:joined to both players
        rm.sendRoomJoinedMessage(player1, room)
        rm.sendRoomJoinedMessage(player2, room)

        return room
    }

    return nil
}
```

**Why check for partial rooms first?**
- Handles browser tab refresh gracefully
- Player reloads → new connection → joins same room instead of waiting
- Prevents orphaned 1-player rooms

### Room Destruction

Rooms are destroyed when the last player leaves.

**Pseudocode:**
```
function removePlayer(playerID):
    lock(mu)
    defer unlock(mu)

    // Check waiting list first
    for i, player in waitingPlayers:
        if player.id == playerID:
            waitingPlayers.remove(i)
            return

    // Find room
    roomID = playerToRoom[playerID]
    if roomID == nil:
        return  // Player not in any room

    room = rooms[roomID]
    room.removePlayer(playerID)

    // Broadcast player:left to remaining players
    room.broadcast(player:left { playerId: playerID }, excludePlayerID: "")

    // Cleanup mappings
    delete(playerToRoom, playerID)

    // Destroy empty room
    if room.isEmpty:
        delete(rooms, roomID)
```

**Go:**
```go
func (rm *RoomManager) RemovePlayer(playerID string) {
    rm.mu.Lock()
    defer rm.mu.Unlock()

    // Check waiting list first
    for i, p := range rm.waitingPlayers {
        if p.ID == playerID {
            rm.waitingPlayers = append(rm.waitingPlayers[:i], rm.waitingPlayers[i+1:]...)
            return
        }
    }

    // Find room by player ID
    roomID, ok := rm.playerToRoom[playerID]
    if !ok {
        return
    }

    room, ok := rm.rooms[roomID]
    if !ok {
        delete(rm.playerToRoom, playerID)
        return
    }

    // Remove player from room
    room.RemovePlayer(playerID)

    // Broadcast player:left
    message := Message{
        Type:      "player:left",
        Timestamp: time.Now().UnixMilli(),
        Data:      map[string]string{"playerId": playerID},
    }
    msgBytes, _ := json.Marshal(message)
    room.Broadcast(msgBytes, "")

    // Cleanup
    delete(rm.playerToRoom, playerID)

    // Destroy empty room
    if room.IsEmpty() {
        delete(rm.rooms, roomID)
    }
}
```

**Why not reuse empty rooms?**
- Rooms are cheap to create (just memory allocation)
- Match state would need resetting
- Simpler to create fresh

### Broadcasting

Messages sent to a room are delivered to all players (or all except one).

**Pseudocode:**
```
function broadcast(message, excludePlayerID):
    lock(mu) for read
    defer unlock(mu)

    for player in players:
        if player.id != excludePlayerID:
            select:
                case player.sendChan <- message:
                    // Success
                case timeout(10ms):
                    log("channel full, dropping message")
            recover from panic:
                log("channel closed")
```

**Go:**
```go
func (r *Room) Broadcast(message []byte, excludePlayerID string) {
    r.mu.RLock()
    defer r.mu.RUnlock()

    for _, player := range r.Players {
        if player.ID == excludePlayerID {
            continue
        }

        // Non-blocking send with recovery
        func() {
            defer func() {
                if r := recover(); r != nil {
                    log.Printf("Could not send message to player %s (channel closed)", player.ID)
                }
            }()

            select {
            case player.SendChan <- message:
                // Success
            default:
                log.Printf("Could not send message to player %s (channel full)", player.ID)
            }
        }()
    }
}
```

**Why non-blocking send?**
- Slow client shouldn't block game loop
- Buffer overflow drops messages (acceptable for position updates)
- Panic recovery handles disconnected players gracefully

**Why 10ms timeout instead of default?**
- Current implementation uses `default` (immediate)
- Dropping is acceptable for non-critical messages
- Critical messages (room:joined, match:ended) sent individually

### Client Room Handling

The client doesn't maintain room state explicitly. It only knows its own player ID after receiving `room:joined`.

**TypeScript:**
```typescript
function handleRoomJoined(message: Message): void {
    const data = message.data as RoomJoinedData;

    // Clear stale state from previous match
    playerManager.destroy();

    // Set local player identity
    playerManager.setLocalPlayerId(data.playerId);

    // Reset health (respawn state)
    this.currentHealth = 100;

    // Reset match state
    this.matchEnded = false;

    // Process queued messages that arrived before room:joined
    this.processPendingMessages();
}
```

**Why destroy before setting local player?**
- Prevents duplicate sprites from reconnection
- Clears references to old player entities
- Ensures clean slate for new match

### Pending Message Queue

Messages may arrive before `room:joined` due to network timing. The client queues these.

**TypeScript:**
```typescript
// Queue pending messages if room not joined yet
private pendingPlayerMoves: PlayerMoveData[] = [];
private pendingWeaponSpawns: WeaponSpawnedData[] = [];
private readonly MAX_PENDING_MESSAGES = 10;

function queueMessage(type: string, data: unknown): void {
    if (type === 'player:move') {
        if (this.pendingPlayerMoves.length >= MAX_PENDING_MESSAGES) {
            this.pendingPlayerMoves.shift(); // Drop oldest
        }
        this.pendingPlayerMoves.push(data as PlayerMoveData);
    }
    // Similar for weapon:spawned
}

function processPendingMessages(): void {
    // Process player moves
    for (const move of this.pendingPlayerMoves) {
        this.handlePlayerMove(move);
    }
    this.pendingPlayerMoves = [];

    // Process weapon spawns
    for (const spawn of this.pendingWeaponSpawns) {
        this.handleWeaponSpawned(spawn);
    }
    this.pendingWeaponSpawns = [];
}
```

**Why queue limit of 10?**
- Prevents unbounded memory growth
- 10 is enough for normal race conditions
- FIFO drop ensures freshest data

---

## Error Handling

### Room Full

**Trigger**: AddPlayer called when room has 8 players
**Detection**: `len(r.Players) >= r.MaxPlayers`
**Response**: Return error "room is full"
**Recovery**: Player stays in waiting queue

### Player Not Found

**Trigger**: RemovePlayer called with unknown ID
**Detection**: `playerToRoom[playerID]` not found
**Response**: No-op, log warning
**Recovery**: None needed

### Channel Closed

**Trigger**: Broadcast to disconnected player
**Detection**: Panic on channel send
**Response**: Recover from panic, log warning
**Recovery**: Player will be removed by disconnect handler

### Channel Full

**Trigger**: Player's send buffer is full (256 messages)
**Detection**: Non-blocking select falls through
**Response**: Drop message, log warning
**Recovery**: None - position updates are self-correcting

---

## Implementation Notes

### Go (Server)

1. **Lock Order**: Always lock RoomManager before Room to prevent deadlocks
2. **Defer Unlock**: Use `defer rm.mu.Unlock()` to ensure cleanup
3. **Read Locks**: Use `RLock()` for read-only operations (GetPlayers, PlayerCount)
4. **Channel Size**: 256-message buffer handles burst traffic

### TypeScript (Client)

1. **No Room State**: Client only knows its player ID, not room structure
2. **Handler Cleanup**: Call `clearHandlers()` on reconnect to prevent duplicates
3. **Pending Queue**: Process queued messages after `room:joined`
4. **Match End Flag**: Check `matchEnded` before processing movement messages

---

## Test Scenarios

### TS-ROOM-001: Room Created When Two Players Waiting

**Category**: Unit
**Priority**: Critical

**Preconditions:**
- RoomManager initialized with empty rooms map
- No players in waiting queue

**Input:**
- AddPlayer(player1)
- AddPlayer(player2)

**Expected Output:**
- After player1: Returns nil (waiting)
- After player2: Returns Room with both players
- Both players receive room:joined

**Pseudocode:**
```
test "room created when two players waiting":
    rm = new RoomManager()
    player1 = new Player("uuid-1")
    player2 = new Player("uuid-2")

    result1 = rm.AddPlayer(player1)
    assert result1 == nil

    result2 = rm.AddPlayer(player2)
    assert result2 != nil
    assert result2.PlayerCount() == 2
    assert result2.HasPlayer("uuid-1")
    assert result2.HasPlayer("uuid-2")
```

**Go:**
```go
func TestAutoCreateRoomWithTwoPlayers(t *testing.T) {
    rm := NewRoomManager()
    p1 := &Player{ID: "uuid-1", SendChan: make(chan []byte, 256)}
    p2 := &Player{ID: "uuid-2", SendChan: make(chan []byte, 256)}

    room1 := rm.AddPlayer(p1)
    assert.Nil(t, room1)

    room2 := rm.AddPlayer(p2)
    assert.NotNil(t, room2)
    assert.Equal(t, 2, room2.PlayerCount())
}
```

### TS-ROOM-002: Room Accepts Up To 8 Players

**Category**: Unit
**Priority**: High

**Preconditions:**
- Room created with 2 players

**Input:**
- AddPlayer for players 3-8

**Expected Output:**
- All 8 players successfully added
- PlayerCount returns 8

**Pseudocode:**
```
test "room accepts up to 8 players":
    room = new Room()
    for i in 1..8:
        err = room.AddPlayer(new Player("uuid-" + i))
        assert err == nil
    assert room.PlayerCount() == 8
```

**Go:**
```go
func TestRoomAcceptsEightPlayers(t *testing.T) {
    room := NewRoom()
    for i := 1; i <= 8; i++ {
        p := &Player{ID: fmt.Sprintf("uuid-%d", i), SendChan: make(chan []byte, 256)}
        err := room.AddPlayer(p)
        assert.NoError(t, err)
    }
    assert.Equal(t, 8, room.PlayerCount())
}
```

### TS-ROOM-003: Room Rejects 9th Player

**Category**: Unit
**Priority**: High

**Preconditions:**
- Room with 8 players

**Input:**
- AddPlayer(player9)

**Expected Output:**
- Error "room is full"
- PlayerCount remains 8

**Pseudocode:**
```
test "room rejects 9th player":
    room = new Room()
    for i in 1..8:
        room.AddPlayer(new Player("uuid-" + i))

    err = room.AddPlayer(new Player("uuid-9"))
    assert err.message == "room is full"
    assert room.PlayerCount() == 8
```

**Go:**
```go
func TestAddPlayerToFullRoom(t *testing.T) {
    room := NewRoom()
    for i := 1; i <= 8; i++ {
        p := &Player{ID: fmt.Sprintf("uuid-%d", i), SendChan: make(chan []byte, 256)}
        room.AddPlayer(p)
    }

    p9 := &Player{ID: "uuid-9", SendChan: make(chan []byte, 256)}
    err := room.AddPlayer(p9)
    assert.Error(t, err)
    assert.Equal(t, 8, room.PlayerCount())
}
```

### TS-ROOM-004: room:joined Sent To Both Players

**Category**: Integration
**Priority**: Critical

**Preconditions:**
- Two players connect via WebSocket

**Input:**
- Player 1 connects
- Player 2 connects

**Expected Output:**
- Player 1 receives room:joined with their ID
- Player 2 receives room:joined with their ID
- Different player IDs

**Pseudocode:**
```
test "room:joined sent to both players":
    ws1 = connect("ws://localhost:8080/ws")
    ws2 = connect("ws://localhost:8080/ws")

    msg1 = ws1.receive()
    msg2 = ws2.receive()

    assert msg1.type == "room:joined"
    assert msg2.type == "room:joined"
    assert msg1.data.playerId != msg2.data.playerId
```

### TS-ROOM-005: player:left Sent When Player Disconnects

**Category**: Integration
**Priority**: High

**Preconditions:**
- Room with 2 players

**Input:**
- Player 2 disconnects

**Expected Output:**
- Player 1 receives player:left { playerId: player2.id }

**Pseudocode:**
```
test "player:left sent when player disconnects":
    ws1 = connect("ws://localhost:8080/ws")
    ws2 = connect("ws://localhost:8080/ws")

    // Both receive room:joined
    ws1.receive()
    ws2.receive()

    // Player 2 disconnects
    ws2.close()

    msg = ws1.receive()
    assert msg.type == "player:left"
```

### TS-ROOM-006: Empty Room Is Destroyed

**Category**: Unit
**Priority**: High

**Preconditions:**
- Room with 2 players

**Input:**
- RemovePlayer(player1)
- RemovePlayer(player2)

**Expected Output:**
- Room no longer in rooms map
- GetRoomByPlayerID returns nil for both

**Pseudocode:**
```
test "empty room is destroyed":
    rm = new RoomManager()
    room = createRoomWithTwoPlayers(rm)
    roomID = room.ID

    rm.RemovePlayer("uuid-1")
    assert rm.GetRoom(roomID) != nil  // Still has player2

    rm.RemovePlayer("uuid-2")
    assert rm.GetRoom(roomID) == nil  // Room destroyed
```

**Go:**
```go
func TestEmptyRoomDestroyed(t *testing.T) {
    rm := NewRoomManager()
    p1 := &Player{ID: "uuid-1", SendChan: make(chan []byte, 256)}
    p2 := &Player{ID: "uuid-2", SendChan: make(chan []byte, 256)}

    rm.AddPlayer(p1)
    room := rm.AddPlayer(p2)
    roomID := room.ID

    rm.RemovePlayer("uuid-1")
    assert.NotNil(t, rm.GetRoomByPlayerID("uuid-2"))

    rm.RemovePlayer("uuid-2")
    assert.Nil(t, rm.GetRoomByPlayerID("uuid-2"))
}
```

### TS-ROOM-007: Player Mapped To Correct Room

**Category**: Unit
**Priority**: Medium

**Preconditions:**
- Multiple rooms exist

**Input:**
- GetRoomByPlayerID(playerID)

**Expected Output:**
- Returns correct room for each player

**Pseudocode:**
```
test "player mapped to correct room":
    rm = new RoomManager()
    room1 = createRoomWithTwoPlayers(rm, "p1", "p2")
    room2 = createRoomWithTwoPlayers(rm, "p3", "p4")

    assert rm.GetRoomByPlayerID("p1").ID == room1.ID
    assert rm.GetRoomByPlayerID("p3").ID == room2.ID
```

### TS-ROOM-008: Broadcast Reaches All Room Members

**Category**: Unit
**Priority**: High

**Preconditions:**
- Room with 3 players

**Input:**
- Broadcast("test message", "")

**Expected Output:**
- All 3 players receive message on their SendChan

**Pseudocode:**
```
test "broadcast reaches all room members":
    room = new Room()
    p1 = new Player("uuid-1")
    p2 = new Player("uuid-2")
    p3 = new Player("uuid-3")
    room.AddPlayer(p1)
    room.AddPlayer(p2)
    room.AddPlayer(p3)

    room.Broadcast([]byte("test"), "")

    assert len(p1.SendChan) == 1
    assert len(p2.SendChan) == 1
    assert len(p3.SendChan) == 1
```

### TS-ROOM-009: Disconnected Player Removed From Room

**Category**: Integration
**Priority**: High

**Preconditions:**
- Room with 2 players

**Input:**
- Player 2's WebSocket connection closes

**Expected Output:**
- Player 2 removed from room
- Room still exists (has player 1)
- player:left message sent

### TS-ROOM-010: Tab Reload Joins Existing Room

**Category**: Unit
**Priority**: Medium

**Preconditions:**
- Room with 1 player (player 1)
- Match not ended

**Input:**
- AddPlayer(player3) - simulating tab reload

**Expected Output:**
- Player 3 joins existing room
- Room has 2 players
- No new room created

**Pseudocode:**
```
test "tab reload joins existing room":
    rm = new RoomManager()
    p1 = new Player("uuid-1")
    rm.AddPlayer(p1)

    // Simulate room creation by forcing it
    room = new Room()
    room.AddPlayer(p1)
    rm.rooms[room.ID] = room

    // Player 3 connects (tab reload scenario)
    p3 = new Player("uuid-3")
    result = rm.AddPlayer(p3)

    assert result.ID == room.ID
    assert result.PlayerCount() == 2
```

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-02-02 | Initial specification |
| 1.1.0 | 2026-02-15 | Added `PingTracker` field to Player struct for per-player RTT measurement. See [networking.md](networking.md#ping-tracking) for implementation details. |
| 1.1.1 | 2026-02-16 | Fixed `room:joined` data payload — server sends both `roomId` and `playerId` (was missing `roomId`). |
