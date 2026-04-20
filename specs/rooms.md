# Rooms

> **Spec Version**: 1.4.0
> **Last Updated**: 2026-04-17
> **Depends On**: [constants.md](constants.md), [player.md](player.md), [networking.md](networking.md), [messages.md](messages.md), [maps.md](maps.md)
> **Depended By**: [match.md](match.md), [server-architecture.md](server-architecture.md)

---

## Overview

The room system manages how players are grouped together for matches. It handles matchmaking (pairing waiting players), room lifecycle (creation and destruction), room-level map assignment, and message broadcasting within rooms. The design prioritizes simplicity: when two players are waiting in the public queue, a room is automatically created, assigned a map, and the match begins.

Rooms come in two flavors:

1. **Public rooms** — created by auto-matchmaking against a shared waiting queue. No code. This is the default path for strangers who just want to play.
2. **Named rooms** — created by a player supplying a shared human-readable **room code** (e.g. `PIZZA`). Anyone who submits the same code lands in the same room. This is the "play with friends" escape hatch: the code is agreed on out of band (chat, text, voice), and no discovery or invite infrastructure is required.

Both kinds of rooms use the same `Room` struct, match lifecycle, and broadcast rules once populated. The only difference is how the first player causes the room to come into existence and how subsequent players find it.

**Why rooms instead of a single global arena?**
- Isolated game state prevents cheating across matches
- 8-player limit keeps matches manageable and server load predictable
- Parallel matches scale horizontally
- Match end doesn't affect players in other rooms

**Why support named rooms at all?**
Friends need a way to end up in the same match without a discovery UI, accounts, or an invite system. A shared code agreed on out of band is the minimum viable mechanism: it removes the round-trip of "create room → server returns code → host shares code" in favor of "everyone types the code we already agreed on." The tradeoff is that two unrelated groups could collide on the same code — acceptable at friend-group scale, would need to change if the game ever opens to strangers picking codes.

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
- [messages.md](messages.md) - `session:status`, `session:leave`, and `player:left` message formats
- [maps.md](maps.md) - map registry ownership and room-level map assignment

---

## Constants

| Constant | Value | Unit | Description |
|----------|-------|------|-------------|
| MAX_PLAYERS_PER_ROOM | 8 | players | Maximum room capacity |
| MIN_PLAYERS_TO_START | 2 | players | Minimum for auto-creation |
| SEND_BUFFER_SIZE | 256 | messages | Per-player message buffer |
| MIN_ROOM_CODE_LEN | 3 | chars | Shortest accepted room code after normalization |
| MAX_ROOM_CODE_LEN | 12 | chars | Longest accepted room code after normalization |
| MAX_DISPLAY_NAME_LEN | 16 | chars | Longest accepted display name after sanitization |
| FALLBACK_DISPLAY_NAME | `"Guest"` | string | Used when a client omits or sends an unusable name |

**Why 8 players max?**
- Larger than 8 becomes visually chaotic in a 1920x1080 arena
- Prevents spawn camping issues
- Keeps network traffic predictable

**Why 2 players minimum?**
- A deathmatch requires at least 2 combatants
- No waiting for "enough" players - matches start immediately
- Single player doesn't make sense for competitive gameplay

**Why these room-code limits?**
- 3 chars is the smallest memorable code; shorter encourages accidental collisions
- 12 chars covers memorable words and short phrases without inviting pasted junk
- Alphanumeric-only (after normalization) so codes are readable aloud and typeable on any keyboard

**Why 16 chars for display names?**
- Fits above a stick-figure nameplate at the target camera zoom without wrapping
- Long enough for most handles, short enough to keep kill-feed lines single-row
- Uniqueness is intentionally **not** enforced — display names are labels, not identities

---

## Data Structures

### Player (Network Context)

A minimal player representation used for room membership and message routing.

**Go:**
```go
type Player struct {
    ID          string       // UUID assigned on connection
    DisplayName string       // [NEW] Sanitized label from player:hello, passed to PlayerState on room entry
    SendChan    chan []byte  // Buffered channel for outgoing messages
    PingTracker *PingTracker // Per-player RTT measurement for lag compensation
    HelloSeen   bool         // [NEW] True once a valid player:hello has been processed; blocks gameplay until set
}
```

**Why store `DisplayName` on the network-context player and not only on `PlayerState`?**
The network layer needs the name before the player has a `PlayerState` — specifically, when routing the hello into a room and building the initial `session:status` payload. Once the player is attached to a room, the name is copied onto `PlayerState.DisplayName`, which becomes the authoritative source for gameplay broadcasts.

**Why a channel for sending?**
- Decouples game loop from socket writes
- Prevents slow connections from blocking game tick
- Buffer allows burst traffic (e.g., multiple projectile spawns)

### Room

A container for players in a single match.

**Go:**
```go
type Room struct {
    ID         string       // UUID, unique room identifier (opaque, server-internal)
    Kind       RoomKind     // [NEW] "public" or "code" — drives join eligibility
    Code       string       // [NEW] Normalized room code; empty string for public rooms
    Players    []*Player    // Current room members
    MaxPlayers int          // Always 8
    MapID      string       // Selected map for this room
    Match      *Match       // Match state (timer, scores)
    mu         sync.RWMutex // Protects Players slice
}

type RoomKind string

const (
    RoomKindPublic RoomKind = "public"
    RoomKindCode   RoomKind = "code"
)
```

**Why keep `ID` even when a room has a human `Code`?**
The `ID` is an opaque routing handle used inside the server (broadcast bookkeeping, `playerToRoom` lookup, logs, debug tools). The `Code` is a human-shared join key. Keeping them separate means two different code-rooms can coexist without the server ever having to treat a user-supplied string as a primary key across restarts or crash-recovery scenarios.

**TypeScript (Client doesn't track room state explicitly):**
```typescript
// Client receives pre-match lifecycle from session:status and only creates
// a MatchSession once state == "match_ready".
interface SessionStatusData {
    state: 'searching_for_match' | 'waiting_for_players' | 'match_ready';
    playerId: string;
    displayName: string;
    joinMode: 'public' | 'code';
    roomId?: string;
    code?: string;
    rosterSize?: number;
    minPlayers?: number;
    mapId?: string;
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
    codeIndex      map[string]string  // [NEW] Normalized room code → Room ID, only for RoomKindCode rooms
    waitingPlayers []*Player          // Queue of unmatched PUBLIC players awaiting auto-match
    playerToRoom   map[string]string  // Player ID → Room ID lookup
    mu             sync.RWMutex       // Protects all maps/slices
}
```

**Why a separate `codeIndex`?**
Looking up a code-room by its human code should be O(1) and must not depend on iterating `rooms`. When a code room is destroyed, its entry is removed from `codeIndex` at the same time as from `rooms` under the manager's lock, so a future player typing the same code gets a fresh room rather than the ghost of an ended match.

**Why a centralized manager?**
- Single source of truth for room state
- Prevents race conditions in matchmaking
- Enables room lookup by player ID

---

## Behavior

### Join Intent

A player's room assignment is driven by a **join intent** supplied by the client in its first message after the WebSocket upgrade (see [messages.md](messages.md#player-hello) for the `player:hello` envelope). The intent carries two pieces of information:

1. **Desired display name** — a human-readable label. Always optional; falls back to `FALLBACK_DISPLAY_NAME`.
2. **Room assignment** — one of:
    - `{ mode: "public" }` → enter the public auto-matchmaking queue (legacy default, used when the client does not know any other mode).
    - `{ mode: "code", code: "<string>" }` → join or create the named room identified by the normalized code.

The server must **not** assign a player to a room until it has received and processed a `player:hello`. Messages other than `player:hello` received before the hello are rejected with a `error:no_hello` message; the connection stays open and the client can still send a valid hello afterward.

**Failed-hello semantics.** A hello that fails validation (`error:bad_room_code`, `error:room_full`, schema-invalid) does **not** latch `HelloSeen`. The client may send another `player:hello` on the same connection after re-prompting the user. A **successful** hello sets `HelloSeen := true`, but a later successful `session:leave` from a pre-match state clears that latch so the same socket can submit a fresh join intent. While the player remains in an active session, subsequent `player:hello` messages on that connection are silently dropped.

**Why require an explicit hello instead of auto-joining on upgrade?**
The WebSocket upgrade gives the server a player ID, but at that instant the server has no idea whether the player wants to play with friends or strangers, and no display name to put on the nameplate. A single dedicated hello message is the simplest way to carry that intent without overloading existing gameplay messages.

### Client-Facing Session Outcomes

**2026-04-17 Amendment:** The room system now reports join progress to the client through `session:status`, not `room:joined`.

After a successful `player:hello`, the player-visible outcomes are:
- public hello with no ready room yet -> `session:status { state: "searching_for_match" }`
- named-room hello where the player is alone or still below threshold -> `session:status { state: "waiting_for_players" }`
- any room that has reached the start threshold and now has complete bootstrap context -> `session:status { state: "match_ready", roomId, mapId, ... }`

This distinction matters because the app shell now has separate React states for public queue waiting and named-room waiting. A player may therefore have a successful hello without yet having a playable match session.

**Regression notice — public tab-reload fast-path.**
Pre-MVP, a browser tab reload would transparently re-join the player to an existing 1-player public room without any re-handshake. Under Friends-MVP, the reconnecting client MUST re-send `player:hello` first because `HelloSeen` is per-connection and does not survive a socket close. The tab-reload fast-path in [`AddPublicPlayer`](rooms.md#room-creation-auto-matchmaking) still works — it re-finds a 1-player public room by the same `Player.ID` handling rules — but only **after** a fresh hello has been processed on the new connection. This is the documented MVP trade-off for having a clean join-intent contract; server-side session stickiness would need a persistent session token the server does not currently keep.

### Display Name Sanitization

Display names arrive as untrusted UTF-8 strings from the client and are sanitized before being stored on `PlayerState.DisplayName`.

**Algorithm (language-agnostic):**

```
function sanitizeDisplayName(raw):
    if raw is null or not a string:
        return FALLBACK_DISPLAY_NAME
    name = raw.trim()                       // strip leading/trailing whitespace
    name = stripControlCharacters(name)     // remove \x00-\x1F, \x7F
    name = collapseInternalWhitespace(name) // "  a   b  " -> "a b"
    if name.length == 0:
        return FALLBACK_DISPLAY_NAME
    if name.length > MAX_DISPLAY_NAME_LEN:
        name = name.slice(0, MAX_DISPLAY_NAME_LEN)
    return name
```

**Rules:**

- Uniqueness is **not** enforced. Two players can share a display name; they are still distinguished by their server-generated `ID`.
- The sanitized name is authoritative. The client does not get to dictate any stored form other than what survives sanitization.
- Sanitization failures (non-string, null, only-whitespace, only-control-characters) silently fall back to `FALLBACK_DISPLAY_NAME`. This is not an error — a joining player should never be blocked from entering the game by a bad name field.
- Profanity filtering, reserved-name lists, and impersonation checks are explicitly out of scope for the MVP. Revisit if and when abuse actually shows up.

**Why silent fallback instead of an error?**
An empty or garbage name is almost always a client bug or a user hitting submit too fast, not malice. Blocking the join hurts UX for zero security benefit — the name is a label, not a credential.

### Room Code Normalization

Room codes are normalized before being used for lookup so that `pizza`, `PIZZA`, ` Pizza `, and `piZZa` all resolve to the same room.

**Algorithm (language-agnostic):**

```
function normalizeRoomCode(raw):
    if raw is null or not a string:
        return { ok: false, reason: "missing" }
    code = raw.trim().toUpperCase()
    code = keepOnly(code, [A-Z, 0-9])        // drop everything else
    if code.length < MIN_ROOM_CODE_LEN:
        return { ok: false, reason: "too_short" }
    if code.length > MAX_ROOM_CODE_LEN:
        return { ok: false, reason: "too_long" }
    return { ok: true, code: code }
```

**Rules:**

- Normalization is case-insensitive and whitespace-insensitive but **not** Unicode-folded. Non-ASCII letters are stripped, not transliterated. This is intentional: codes are meant to be read aloud and retyped, so restricting to `[A-Z0-9]` eliminates ambiguity from lookalike glyphs.
- A normalized code of length 0 (e.g. client sent `"   "` or `"!!!"`) is rejected as `too_short`.
- The server uses the normalized form as the dictionary key. It never stores or exposes the raw client-submitted string.
- If normalization fails, the server replies with `error:bad_room_code` (see [messages.md](messages.md#error-bad-room-code)) and leaves the player unrouted. The client is responsible for re-prompting.

**Why strict `[A-Z0-9]` instead of a looser alphabet?**
Every extra character class (emoji, punctuation, accents) is another place two users can fail to coordinate because one of them can't type it. The MVP optimizes for "works over a voice call."

### Accepted Risk: Code Collisions Between Unrelated Groups

Friends-MVP intentionally ships **no collision mitigation**. Two unrelated friend groups who both pick the normalized code `GAME`, `PARTY`, `TEST`, `PIZZA`, or any other common word will silently land in the same room. The losing group has no way to tell they merged into someone else's match — they will just see strangers.

**Why accept this risk?**
- The target population for MVP is a small, trusted group of friends coordinating out of band.
- Every mitigation (salted codes, host-only creation tokens, server-chosen suffixes, first-creator-wins-until-empty) either adds coordination friction ("okay now the code is `PIZZA-7F3K`, spell it back to me") or adds a stateful server component that Friends-MVP deliberately does not have.
- At friend-group scale, the probability of two groups simultaneously picking the same short common word for a same-minute play session is low, and recovery is trivial: pick a different code and send a fresh `player:hello`.

**How collisions surface to users:**
- The joining player receives `session:status` with the expected `code`. They cannot distinguish "I joined my friend's room" from "I joined a stranger's room with the same code."
- If the stranger's room is already full, the joiner gets `error:room_full` and can retry with a different code.
- There is no server log alert for code collisions; they are invisible to operators as well as players.

**When this stops being acceptable:**
The moment the game is exposed to strangers picking codes (e.g. a public lobby browser or a discoverable-codes UI), this design must change. That is scope for a post-MVP iteration — see [deployment.md § Smoke Test](deployment.md#smoke-test) for the MVP-acceptance caveat.

### Room Creation (Auto-Matchmaking)

For public join intents, when a player connects, they're added to the waiting queue. When the queue reaches 2 players, a room is automatically created and assigned the default map ID.

**Pseudocode (public intent only — see "Named Room Join" below for the code path):**
```
function addPublicPlayer(player):
    lock(mu)
    defer unlock(mu)

    // Handle tab reload: check for PUBLIC room with exactly 1 player.
    // Named rooms are excluded here — they only accept players that submit the matching code.
    for room in rooms:
        if room.kind == "public" AND room.playerCount == 1 AND !room.match.isEnded:
            room.addPlayer(player)
            room.match.registerPlayer(player)
            playerToRoom[player.id] = room.id
            send session:status { state: "match_ready", roomId, playerId: player.id, displayName, joinMode: "public", mapId } to player
            return room

    // Normal flow: add to waiting list
    waitingPlayers.add(player)

    // Auto-create when 2 players waiting
    if len(waitingPlayers) >= 2:
        player1 = waitingPlayers.pop()
        player2 = waitingPlayers.pop()

        room = createRoom(kind = "public", mapId = defaultMapId)
        room.addPlayer(player1)
        room.addPlayer(player2)
        room.match.registerPlayer(player1)
        room.match.registerPlayer(player2)
        room.match.start()

        playerToRoom[player1.id] = room.id
        playerToRoom[player2.id] = room.id

        send session:status { state: "match_ready", roomId, playerId: player1.id, displayName, joinMode: "public", rosterSize: 2, minPlayers: 2, mapId } to player1
        send session:status { state: "match_ready", roomId, playerId: player2.id, displayName, joinMode: "public", rosterSize: 2, minPlayers: 2, mapId } to player2

        return room

    return nil  // Still waiting
```

**Go:**
```go
func (rm *RoomManager) AddPublicPlayer(player *Player) *Room {
    rm.mu.Lock()
    defer rm.mu.Unlock()

    // Tab reload handling: check for a PUBLIC room with exactly 1 player.
    // Code-rooms are intentionally excluded — rejoining them requires the code.
    for _, room := range rm.rooms {
        if room.Kind != RoomKindPublic {
            continue
        }
        if room.PlayerCount() == 1 && !room.Match.IsEnded() {
            room.AddPlayer(player)
            rm.playerToRoom[player.ID] = room.ID
            room.Match.RegisterPlayer(player.ID)

            // RoomManager sends session:status directly (not caller)
            rm.sendSessionStatus(player, room, "match_ready")
            return room
        }
    }

    // Add to waiting list
    rm.waitingPlayers = append(rm.waitingPlayers, player)

    // Auto-create room when 2 players waiting
    if len(rm.waitingPlayers) >= 2 {
        player1 := rm.waitingPlayers[0]
        player2 := rm.waitingPlayers[1]

        room := NewRoom(RoomKindPublic, "", defaultMapID)
        room.AddPlayer(player1)
        room.AddPlayer(player2)
        room.Match.RegisterPlayer(player1.ID)
        room.Match.RegisterPlayer(player2.ID)

        rm.waitingPlayers = rm.waitingPlayers[2:]
        rm.rooms[room.ID] = room
        rm.playerToRoom[player1.ID] = room.ID
        rm.playerToRoom[player2.ID] = room.ID

        room.Match.Start()

        // RoomManager sends match_ready session snapshots to both players
        rm.sendSessionStatus(player1, room, "match_ready")
        rm.sendSessionStatus(player2, room, "match_ready")

        return room
    }

    return nil
}
```

**Why check for partial rooms first?**
- Handles browser tab refresh gracefully
- Player reloads → new connection → joins same public room instead of waiting
- Prevents orphaned 1-player public rooms

### Named Room Join

For intents of the form `{ mode: "code", code: <raw> }`, the manager normalizes the code, looks it up in `codeIndex`, and either joins an existing code-room or creates a new one.

**Pseudocode:**
```
function joinCodedRoom(player, rawCode):
    result = normalizeRoomCode(rawCode)
    if not result.ok:
        send error:bad_room_code { reason: result.reason } to player
        return nil

    code = result.code

    lock(mu)
    defer unlock(mu)

    existingRoomID = codeIndex[code]
    if existingRoomID != nil:
        room = rooms[existingRoomID]

        // Full room rejection (8 players cap applies identically to both kinds)
        if room.playerCount >= MAX_PLAYERS_PER_ROOM:
            send error:room_full { code: code } to player
            return nil

        // Match already ended: the room is about to be destroyed.
        // Treat as "no such room" so the next player creates a fresh one.
        if room.match.isEnded:
            return createFreshCodedRoom(player, code)

        room.addPlayer(player)
        room.match.registerPlayer(player)
        playerToRoom[player.id] = room.id

        // Start the match the moment the join brings the room up to threshold.
        // Unlike the fresh-room path, this is where the transition actually
        // happens for code rooms — the host sat alone until now.
        if room.playerCount >= MIN_PLAYERS_TO_START and not room.match.isStarted:
            room.match.start()

        if room.playerCount >= MIN_PLAYERS_TO_START and room.match.isStarted:
            send session:status { state: "match_ready", roomId: room.id, playerId: player.id, displayName, joinMode: "code", code: code, rosterSize: room.playerCount, minPlayers: MIN_PLAYERS_TO_START, mapId: room.mapId } to player
        else:
            send session:status { state: "waiting_for_players", roomId: room.id, playerId: player.id, displayName, joinMode: "code", code: code, rosterSize: room.playerCount, minPlayers: MIN_PLAYERS_TO_START } to player
        return room

    return createFreshCodedRoom(player, code)


function createFreshCodedRoom(player, normalizedCode):
    room = createRoom(kind = "code", code = normalizedCode, mapId = defaultMapId)
    room.addPlayer(player)
    room.match.registerPlayer(player)

    rooms[room.id] = room
    codeIndex[normalizedCode] = room.id
    playerToRoom[player.id] = room.id

    // Match does NOT auto-start with 1 player. The host waits here until a
    // second player submits the same code; the joining branch above is the
    // one that flips match state to started.

    send session:status { state: "waiting_for_players", roomId, playerId, displayName, joinMode: "code", code: normalizedCode, rosterSize: 1, minPlayers: MIN_PLAYERS_TO_START } to player
    return room
```

**Why allow a 1-player code-room to exist and wait?**
A named-room host is explicitly inviting friends — making them sit in an empty room for a few seconds is the whole point. This is different from public matchmaking, where a lone player would have nothing to do.

**Why reject when the existing room's match has ended?**
A code-room whose match has ended is in teardown. The cleanest behavior is to treat that code as "available again" so the next player to type it spins up a fresh match. This also avoids a race where the first joiner after match-end would otherwise get stuck in a room that is about to be destroyed.

**Full-room behavior:** Named rooms use the same `MAX_PLAYERS_PER_ROOM` cap as public rooms. A 9th player trying to use a full code gets `error:room_full` and the connection stays open so they can submit a different code or switch to public matchmaking.

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
        // Only release the code if the index still points at THIS room.
        // A rematch in progress may have already overwritten codeIndex[code]
        // with a fresh room that shares the same code — deleting unconditionally
        // would unindex the new room and leave it unreachable.
        if room.kind == "code" and room.code != "":
            if codeIndex[room.code] == room.id:
                delete(codeIndex, room.code)
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
        if room.Kind == RoomKindCode && room.Code != "" {
            // Only release the code if the index still points at THIS room.
            // A rematch-in-progress may already have replaced the entry.
            if indexedID, ok := rm.codeIndex[room.Code]; ok && indexedID == room.ID {
                delete(rm.codeIndex, room.Code)
            }
        }
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
- Critical messages (`session:status`, `match:ended`) are sent individually

### Client Room Handling

The client doesn't maintain full room state explicitly. It learns the authoritative pre-match lifecycle through `session:status`, then derives a `MatchSession` only once `state == "match_ready"`.

**TypeScript:**
```typescript
function handleSessionStatus(message: Message): void {
    const data = message.data as SessionStatusData;
    appSession.replace(data);

    if (data.state !== 'match_ready') {
        return;
    }

    // Create gameplay bootstrap only once the room is actually playable
    const matchSession: MatchSession = {
        playerId: data.playerId,
        displayName: data.displayName,
        joinMode: data.joinMode,
        roomId: data.roomId!,
        mapId: data.mapId!,
        code: data.code,
    };

    mountPhaser(matchSession);
}
```

**Why split waiting from match-ready?**
- Public matchmaking can succeed logically while the player is still waiting in the queue
- Named-room hosts can sit in a valid room before a second player arrives
- The app shell needs deterministic screen states for `searching_for_match`, `waiting_for_players`, and `match_ready`

### Pending Message Queue

Messages may arrive before gameplay bootstrap due to network timing. The client queues gameplay-only messages until `session:status { state: "match_ready" }` has been received and Phaser is mounted.

**TypeScript:**
```typescript
// Queue pending messages if gameplay is not bootstrapped yet
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

// Inside match_ready handling:
// Pending player:move messages are DISCARDED (stale, captured before room was created)
this.pendingPlayerMoves = [];

// Pending weapon:spawned messages ARE replayed (crate positions are still valid)
for (const pendingData of this.pendingWeaponSpawns) {
    const weaponData = pendingData as WeaponSpawnedData;
    if (weaponData.crates) {
        for (const crateData of weaponData.crates) {
            this.weaponCrateManager.spawnCrate(crateData);
        }
    }
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

### Missing Hello

**Trigger**: Client sends any gameplay message before `player:hello`
**Detection**: `player.HelloSeen == false`
**Response**: Send `error:no_hello` to the offending player, drop the message
**Recovery**: Client retries with a valid `player:hello`; connection stays open

### Bad Display Name

**Trigger**: `player:hello` arrives with a missing, non-string, or all-whitespace display name
**Detection**: `sanitizeDisplayName` returns `FALLBACK_DISPLAY_NAME`
**Response**: No error sent — sanitization silently substitutes the fallback
**Recovery**: None needed; the player joins as "Guest"

### Bad Room Code

**Trigger**: `player:hello` with `mode: "code"` where normalization fails (too short/long/empty after sanitization)
**Detection**: `normalizeRoomCode(raw).ok == false`
**Response**: Send `error:bad_room_code { reason }` to the joining player
**Recovery**: Connection stays open; client re-prompts and sends a fresh `player:hello`

### Room Full (Named)

**Trigger**: Code-room lookup succeeds but target room already has 8 players
**Detection**: `room.PlayerCount() >= MAX_PLAYERS_PER_ROOM`
**Response**: Send `error:room_full { code }` to the joining player
**Recovery**: Connection stays open; client offers the user "try a different code or play public"

### Room Full (Public)

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
3. **Pending Queue**: Process queued messages after `session:status { state: "match_ready" }`
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
- Both players receive `session:status { state: "match_ready" }`

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

### TS-ROOM-004: `session:status(match_ready)` Sent To Both Players

**Category**: Integration
**Priority**: Critical

**Preconditions:**
- Two players connect via WebSocket

**Input:**
- Player 1 connects
- Player 2 connects

**Expected Output:**
- Player 1 receives `session:status { state: "match_ready" }` with their ID
- Player 2 receives `session:status { state: "match_ready" }` with their ID
- Different player IDs

**Pseudocode:**
```
test "session:status(match_ready) sent to both players":
    ws1 = connect("ws://localhost:8080/ws")
    ws2 = connect("ws://localhost:8080/ws")

    msg1 = ws1.receive()
    msg2 = ws2.receive()

    assert msg1.type == "session:status"
    assert msg1.data.state == "match_ready"
    assert msg2.type == "session:status"
    assert msg2.data.state == "match_ready"
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

    // Both receive session:status(match_ready)
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

### TS-ROOM-011: Named Room — First Player Creates, Second Joins

**Category**: Unit
**Priority**: Critical

**Preconditions:**
- RoomManager initialized, no rooms, no codeIndex entries

**Input:**
- Player A sends `player:hello { displayName: "Alice", mode: "code", code: "pizza" }`
- Player B sends `player:hello { displayName: "Bob",   mode: "code", code: "PIZZA " }`

**Expected Output:**
- Normalized code for both is `"PIZZA"`
- After A's hello: a new `RoomKindCode` room exists, `room.match.isStarted == false`
- After B's hello: `room.match.isStarted == true` (the join, not the creation, is what starts the match)
- Both receive `session:status` snapshots for the same `roomId` and `code: "PIZZA"`; the host first observes `waiting_for_players`, then both transition to `match_ready`
- `codeIndex["PIZZA"]` points to that room

### TS-ROOM-012: Named Room — Code Normalization Collisions Converge

**Category**: Unit
**Priority**: High

**Input:**
- Raw codes submitted by four players: `"pizza"`, `"PIZZA"`, `" Pizza "`, `"piZZa"`

**Expected Output:**
- All four normalize to `"PIZZA"`
- All four end up in the same room (assuming room is not full and match not ended)

### TS-ROOM-013: Named Room — Bad Code Rejected With Open Connection

**Category**: Unit
**Priority**: High

**Input:**
- Player sends `player:hello { mode: "code", code: "!!" }`

**Expected Output:**
- `normalizeRoomCode` returns `{ ok: false, reason: "too_short" }`
- Server sends `error:bad_room_code { reason: "too_short" }`
- Player is NOT assigned to any room, `HelloSeen` remains false
- Connection stays open; client may send another `player:hello`

### TS-ROOM-014: Named Room — Full Room Rejects 9th Player

**Category**: Unit
**Priority**: High

**Preconditions:**
- `codeIndex["PARTY"]` points to a room with 8 players, match in progress

**Input:**
- Player 9 sends `player:hello { mode: "code", code: "party" }`

**Expected Output:**
- Server sends `error:room_full { code: "PARTY" }`
- Existing room unchanged; `codeIndex` unchanged
- Connection stays open

### TS-ROOM-015: Named Room — Ended Match Releases Code

**Category**: Unit
**Priority**: Medium

**Preconditions:**
- `codeIndex["REMATCH"]` points to a room whose match has ended (not yet destroyed)

**Input:**
- New player sends `player:hello { mode: "code", code: "rematch" }`

**Expected Output:**
- Server treats the existing room as unavailable
- A fresh `RoomKindCode` room is created and becomes the new `codeIndex["REMATCH"]` entry

### TS-ROOM-016: Display Name — Sanitization Silently Substitutes Fallback

**Category**: Unit
**Priority**: Medium

**Input:**
- Player sends `player:hello { displayName: "   ", mode: "public" }`

**Expected Output:**
- `player.DisplayName == "Guest"`
- No error emitted; player joins the public queue normally

### TS-ROOM-018: Named Room — Rematch Does Not Unindex During Teardown

**Category**: Unit
**Priority**: High

**Preconditions:**
- `codeIndex["REMATCH"]` points to roomA whose match has ended; roomA still has
  players attached who have not yet disconnected
- roomA is about to be destroyed once those players leave

**Input:**
1. Player X sends `player:hello { mode: "code", code: "rematch" }`
   → server sees `roomA.match.isEnded`, creates roomB, sets `codeIndex["REMATCH"] = roomB.ID`
2. The last player leaves roomA, triggering room destruction

**Expected Output:**
- roomA is removed from `rooms`
- `codeIndex["REMATCH"]` still points at `roomB.ID` (NOT deleted)
- A subsequent player submitting `"rematch"` joins roomB, not a third fresh room
- roomB's players never become unreachable

**Why this test:**
This guards against the bug where room destruction deletes `codeIndex[code]`
unconditionally — which would silently unindex the fresh rematch room and
strand its occupants the moment the last straggler from the previous match
disconnects. The destruction path MUST only delete the code entry if the
index still points at the room being destroyed.

---

### TS-ROOM-017: Gameplay Message Before Hello Is Rejected

**Category**: Unit
**Priority**: High

**Preconditions:**
- New WebSocket connection; `player.HelloSeen == false`

**Input:**
- Client sends `input:state { ... }` before any `player:hello`

**Expected Output:**
- Server sends `error:no_hello`
- `input:state` message is dropped without mutating any state
- Connection stays open; a subsequent valid `player:hello` is accepted normally

---

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
| 1.4.0 | 2026-04-17 | Session-first client alignment: documented public `searching_for_match`, named-room `waiting_for_players`, and `match_ready` as explicit `session:status` outcomes after a successful hello; updated client-facing room handling to bootstrap gameplay only from `match_ready`; and switched room/messaging references from `room:joined` to `session:status` / `session:leave`. |
| 1.3.1 | 2026-04-11 | Friends-MVP pre-mortem fixes: (1) code-room join path now explicitly calls `match.start()` when the joiner crosses `MIN_PLAYERS_TO_START`; (2) room destruction now only deletes `codeIndex[code]` if the index still points at the room being destroyed, preventing a rematch-in-progress room from being unindexed when the old room's stragglers disconnect (new TS-ROOM-018); (3) failed-hello semantics clarified — `error:bad_room_code` / `error:room_full` do not latch `HelloSeen`; (4) added "Accepted Risk: Code Collisions Between Unrelated Groups" section making the collision trade-off explicit; (5) added regression notice for the public tab-reload fast-path now requiring a fresh `player:hello`. |
| 1.3.0 | 2026-04-11 | Friends-MVP: introduced named rooms (`RoomKindCode`), room-code normalization, join-intent via `player:hello`, display-name sanitization and `PlayerState.DisplayName`, error modes `error:no_hello` / `error:bad_room_code` / `error:room_full { code }`. Added TS-ROOM-011..017. |
| 1.0.0 | 2026-02-02 | Initial specification |
| 1.1.0 | 2026-02-15 | Added `PingTracker` field to Player struct for per-player RTT measurement. See [networking.md](networking.md#ping-tracking) for implementation details. |
| 1.1.2 | 2026-02-16 | Fixed health property name — `localPlayerHealth` not `currentHealth` |
| 1.1.1 | 2026-02-16 | Fixed `room:joined` data payload — server sends both `roomId` and `playerId` (was missing `roomId`). |
