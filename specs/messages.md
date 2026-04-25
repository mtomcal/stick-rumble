# Messages

> **Spec Version**: 1.5.1
> **Last Updated**: 2026-04-25
> **Depends On**: [constants.md](constants.md), [player.md](player.md)
> **Depended By**: [networking.md](networking.md), [rooms.md](rooms.md), [weapons.md](weapons.md), [shooting.md](shooting.md), [melee.md](melee.md), [hit-detection.md](hit-detection.md), [match.md](match.md), [client-architecture.md](client-architecture.md), [server-architecture.md](server-architecture.md)

---

## Overview

This specification defines the complete WebSocket message catalog for Stick Rumble. Every message exchanged between client and server is documented here with its exact schema, trigger conditions, recipients, and example payloads.

**Why a formal message catalog?** WebSocket messages are the contract between client and server. Both implementations must agree on exact message formats. This spec serves as the single source of truth, preventing desync bugs and enabling independent implementation.

**Why TypeBox schemas?** The project uses TypeBox to define schemas in TypeScript, which then generates JSON schemas for server-side validation. This ensures type safety at compile time (TypeScript) and runtime (JSON Schema validation).

---

## Dependencies

### Technology Dependencies

| Technology | Version | Purpose |
|------------|---------|---------|
| Go | 1.25 | Server-side message processing |
| TypeScript | 5.9.3 | Client-side message handling |
| TypeBox | - | Schema definitions |
| gorilla/websocket | v1.5.3 | WebSocket transport |

### Spec Dependencies

- [constants.md](constants.md) - Message rate limits, timing values
- [player.md](player.md) - PlayerState structure used in messages

### File Locations

| Location | Purpose |
|----------|---------|
| `events-schema/src/schemas/common.ts` | Shared types (Position, Velocity, Message) |
| `events-schema/src/schemas/client-to-server.ts` | Client→Server message schemas |
| `events-schema/src/schemas/server-to-client.ts` | Server→Client message schemas |
| `stick-rumble-server/internal/network/message_processor.go` | Server message handling |
| `stick-rumble-server/internal/network/outgoing_message.go` | Server outgoing message construction and validation |
| `stick-rumble-client/src/game/scenes/GameSceneEventHandlers.ts` | Client message handling |

---

## Base Message Format

All WebSocket messages follow this envelope structure.

**Why this structure?** The `type` field enables routing to appropriate handlers. The `timestamp` enables latency calculation and event ordering. The optional `data` field allows messages with or without payloads.

**TypeScript:**
```typescript
interface Message {
  type: string;      // Message type identifier (e.g., "input:state")
  timestamp: number; // Unix timestamp in milliseconds
  data?: unknown;    // Optional payload (varies by message type)
}
```

**Go:**
```go
type Message struct {
    Type      string `json:"type"`
    Timestamp int64  `json:"timestamp"`
    Data      any    `json:"data,omitempty"`
}
```

### Server Outgoing Message Module

The server outgoing message module owns construction of every server-to-client envelope before delivery. It accepts a message type and payload, applies the standard timestamp rule, validates the payload against the generated server-to-client schema when validation is enabled, and marshals the final JSON envelope.

**Responsibilities:**
- preserve the universal message envelope for all server-to-client messages
- centralize timestamp assignment so message producers do not each choose their own clock behavior
- centralize outgoing schema validation and marshal error handling
- return bytes plus an error to the caller; it does not decide room membership, recipient selection, or gameplay rules

**Non-responsibilities:**
- It does not process client-to-server messages.
- It does not mutate game state.
- It does not choose whether a message goes to one player, one room, waiting players, or every room.

**Why this module exists:** Server-side message producers otherwise repeat the same low-level construction steps for every message type. Centralizing the envelope and validation behavior keeps the message catalog as the test surface and lets broadcast code focus on delivery.

**Example:**
```json
{
  "type": "player:shoot",
  "timestamp": 1704067200000,
  "data": {
    "aimAngle": 1.571
  }
}
```

---

## Message Summary

### Client → Server (9 types)

| Type | Description | Frequency |
|------|-------------|-----------|
| `player:hello` | Join intent (display name + room assignment) | Exactly once per connection, before any gameplay message |
| `session:leave` | Leave queue or pre-match waiting state | On-demand (user presses Back/Cancel) |
| `input:state` | WASD movement and aim | Every input change (~60 Hz max) |
| `player:shoot` | Fire weapon request | On-demand (player clicks) |
| `player:reload` | Reload weapon request | On-demand (player presses R) |
| `weapon:pickup_attempt` | Pick up weapon crate | On-demand (player presses E) |
| `player:melee_attack` | Swing melee weapon | On-demand (player clicks) |
| `player:dodge_roll` | Initiate dodge roll | On-demand (player presses Space) |
| `test` | Echo test message | Testing only |

### Server → Client (25 types)

| Type | Description | Recipients |
|------|-------------|------------|
| `session:status` | Authoritative pre-match session snapshot | Joining / waiting / ready player |
| `error:no_hello` | Gameplay message received before `player:hello` | Offending player |
| `error:bad_room_code` | `player:hello` room code failed normalization | Offending player |
| `error:room_full` | Named-room join rejected because room has 8 players | Offending player |
| `player:left` | Player disconnected | Room broadcast |
| `player:move` | Position updates | Room broadcast (20 Hz) |
| `projectile:spawn` | Projectile created | Room broadcast |
| `projectile:destroy` | Projectile removed | Room broadcast |
| `weapon:state` | Ammo/reload status | Single player |
| `shoot:failed` | Shot rejected | Single player |
| `player:damaged` | Player took damage | Room broadcast |
| `hit:confirmed` | Hit registered | Attacker only |
| `player:death` | Player killed | Room broadcast |
| `player:kill_credit` | Kill statistics | Room broadcast |
| `player:respawn` | Player respawned | Room broadcast |
| `match:timer` | Time remaining | Room broadcast (1 Hz) |
| `match:ended` | Match complete | Room broadcast |
| `weapon:spawned` | Weapon crates created | Room broadcast |
| `weapon:pickup_confirmed` | Pickup succeeded | Room broadcast |
| `weapon:respawned` | Crate available again | Room broadcast |
| `melee:hit` | Melee connected | Room broadcast |
| `roll:start` | Dodge roll began | Room broadcast |
| `roll:end` | Dodge roll ended | Room broadcast |
| `state:snapshot` | Full state (delta compression) | Per-client (1 Hz) |
| `state:delta` | Incremental state changes | Per-client (20 Hz) |

### Session Lifecycle Contract

`session:status` is the authoritative readiness signal for both production clients and automated tests.

- A successful `player:hello` does **not** guarantee the player can immediately enter gameplay.
- Consumers that need a playable match session must wait for `session:status.state == "match_ready"`.
- Consumers that only need to confirm the player has joined a pre-match session may wait for a non-error `session:status` state such as `searching_for_match` or `waiting_for_players`.
- `room:joined` remains a legacy compatibility event only. New client flows, app bootstrap logic, and integration tests must not rely on it as the primary synchronization point.

**Why make this explicit?** The session-first flow separates "the server accepted my join intent" from "the match is ready to bootstrap." Tests that wait for a ready-room event when the player is still waiting can leak sockets, stall teardown, and misdiagnose correct waiting behavior as a networking failure.

---

## Client → Server Messages

### `input:state`

Player movement and aim input, sent when input changes.

**Why event-driven?** Sending input only when it changes reduces bandwidth compared to fixed-rate sending. The server processes input at 60 Hz tick rate regardless of client send frequency.

**When Sent:**
- WASD key pressed or released
- Shift (sprint) toggled
- Aim angle changes by more than 5° (0.087 radians)

**Rate Limit:** Implied by client frame rate (~60 Hz max)

**Data Schema:**

**TypeScript:**
```typescript
interface InputStateData {
  up: boolean;          // W key pressed
  down: boolean;        // S key pressed
  left: boolean;        // A key pressed
  right: boolean;       // D key pressed
  aimAngle: number;     // Aim angle in radians (0 to 2π)
  isSprinting: boolean; // Shift key pressed
  sequence: number;     // Monotonically increasing sequence number (≥0)
}
```

**Go:**
```go
// InputState struct (player.go) — does NOT include sequence
type InputState struct {
    Up          bool    `json:"up"`
    Down        bool    `json:"down"`
    Left        bool    `json:"left"`
    Right       bool    `json:"right"`
    AimAngle    float64 `json:"aimAngle"`
    IsSprinting bool    `json:"isSprinting"`
}
```

> **Note:** The `sequence` field is present in the JSON payload but is NOT part of the Go `InputState` struct. It is extracted separately in `message_processor.go` via direct type assertion (`dataMap["sequence"].(float64)`) and passed to `UpdatePlayerInputWithSequence(playerID, input, sequence)`.

**Why `sequence`?** The sequence number enables client-side prediction reconciliation. The server echoes `lastProcessedSequence` in state broadcasts so the client knows which inputs have been applied server-side and can replay only unprocessed inputs. See [movement.md](movement.md#server-reconciliation).

**Example:**
```json
{
  "type": "input:state",
  "timestamp": 1704067200000,
  "data": {
    "up": true,
    "down": false,
    "left": false,
    "right": true,
    "aimAngle": 0.785,
    "isSprinting": false,
    "sequence": 42
  }
}
```

**Server Processing:**
1. Validate message against schema
2. Store input in player's InputState with sequence number
3. Physics system reads input each tick (60 Hz)
4. Sequence tracked for `lastProcessedSequence` in broadcasts
5. Ignored after `match:ended`

---

### `player:shoot`

Request to fire the current weapon.

**Why server validation?** Prevents rapid-fire hacks. Server enforces fire rate, ammo, and reload state.

**When Sent:** Player activates the primary fire input (left mouse on desktop, touch-equivalent primary fire on future supported platforms)

**Input Contract Amendment (2026-04-17):**
- Only primary fire input may produce `player:shoot`
- Right mouse / secondary click must be ignored for gameplay firing
- The browser context menu must be suppressed over the gameplay surface so secondary click does not interrupt play

**Data Schema:**

**TypeScript:**
```typescript
interface PlayerShootData {
  aimAngle: number;        // Aim angle in radians (0 to 2π)
  clientTimestamp: number;  // Client-side timestamp in ms when shot was fired (≥0)
}
```

**Go:**
```go
type PlayerShootData struct {
    AimAngle        float64 `json:"aimAngle"`
    ClientTimestamp  int64   `json:"clientTimestamp"`
}
```

**Why `clientTimestamp`?** Used for server-side lag compensation. The server rewinds other players' positions to where they were at `clientTimestamp` before performing hit detection, compensating for network latency. See [hit-detection.md](hit-detection.md).

**Example:**
```json
{
  "type": "player:shoot",
  "timestamp": 1704067200500,
  "data": {
    "aimAngle": 1.571,
    "clientTimestamp": 1704067200480
  }
}
```

**Server Processing:**
1. Validate player exists and is alive
2. Check weapon is not melee type
3. Check fire rate cooldown
4. Check ammo > 0
5. Check not currently reloading
6. If valid: create projectile using `clientTimestamp` for lag compensation, broadcast `projectile:spawn`, send `weapon:state`
7. If invalid: send `shoot:failed` with reason

**Failure Reasons:**

| Reason | Description |
|--------|-------------|
| `no_player` | Player not found in world |
| `cooldown` | Fire rate not cooled down |
| `empty` | Magazine is empty |
| `reloading` | Currently reloading |

---

### `player:reload`

Request to reload the current weapon.

**When Sent:** Player presses reload key (R)

**Data Schema:** No data payload

**Example:**
```json
{
  "type": "player:reload",
  "timestamp": 1704067200600
}
```

**Server Processing:**
1. Validate player exists and is alive
2. Check weapon is ranged (not melee)
3. Check not already reloading
4. Check ammo < max
5. If valid: start reload timer, send `weapon:state` when complete

---

### `weapon:pickup_attempt`

Request to pick up a weapon crate.

**Why explicit request?** Players must actively choose to pick up weapons. This prevents accidental weapon swaps during combat.

**When Sent:** Player presses pickup key (E) near a weapon crate

**Data Schema:**

**TypeScript:**
```typescript
interface WeaponPickupAttemptData {
  crateId: string; // Unique identifier for weapon crate
}
```

**Go:**
```go
type WeaponPickupAttemptData struct {
    CrateID string `json:"crateId"`
}
```

**Example:**
```json
{
  "type": "weapon:pickup_attempt",
  "timestamp": 1704067201000,
  "data": {
    "crateId": "ak47-1"
  }
}
```

**Server Processing:**
1. Validate player exists and is alive
2. Find crate by ID
3. Check crate is available
4. Check player within pickup radius (32 px)
5. If valid: mark crate unavailable, give weapon to player, broadcast `weapon:pickup_confirmed`
6. If invalid: silently reject (no error message)

---

### `player:melee_attack`

Request to swing a melee weapon.

**When Sent:** Player clicks attack button while holding Bat or Katana

**Data Schema:**

**TypeScript:**
```typescript
interface PlayerMeleeAttackData {
  aimAngle: number; // Swing direction in radians
}
```

**Go:**
```go
type PlayerMeleeAttackData struct {
    AimAngle float64 `json:"aimAngle"`
}
```

**Example:**
```json
{
  "type": "player:melee_attack",
  "timestamp": 1704067201500,
  "data": {
    "aimAngle": 2.356
  }
}
```

**Server Processing:**
1. Validate player exists and is alive
2. Check weapon is melee type
3. Check attack cooldown
4. Find all players in range AND within swing arc
5. Apply damage to each victim
6. Apply knockback if weapon has it (Bat)
7. Broadcast `melee:hit` with victim list
8. Broadcast `player:damaged` for each victim

**Failure Reasons:**

| Reason | Description |
|--------|-------------|
| `no_player` | Player not found |
| `no_weapon` | No weapon equipped |
| `not_melee` | Weapon is ranged |
| `player_dead` | Player is dead |

---

### `player:dodge_roll`

Request to perform a dodge roll.

**When Sent:** Player presses dodge key (Space)

**Data Schema:** No data payload

**Example:**
```json
{
  "type": "player:dodge_roll",
  "timestamp": 1704067202000
}
```

**Server Processing:**
1. Validate player exists and is alive
2. Check not currently rolling
3. Check cooldown expired (3 seconds since last roll)
4. If valid: start roll, broadcast `roll:start`
5. When roll completes: broadcast `roll:end`

---

### `player:hello`

Join intent. Declares the player's display name and whether they want public matchmaking or a named room. Must be the **first** message the client sends after the WebSocket upgrade; any other client-to-server message received first is rejected with `error:no_hello`.

**Why a dedicated hello instead of reusing an existing message?**
At upgrade time the server has no idea whether the player wants to play with strangers or friends, and no label to render above their head. A one-shot hello is the narrowest possible place to carry that information without complicating the high-frequency gameplay messages.

**When Sent:** Exactly once **per successful hello** per WebSocket connection, before any gameplay input. On every new connection (including reconnects triggered by the client's backoff logic in [networking.md § Reconnection Logic](networking.md#reconnection-logic)), the client MUST re-send `player:hello` as its first message — the server discards all per-connection state, including `HelloSeen`, when a socket closes.

**Rate Limit and Latching:**
- A **failed** hello (schema invalid, `error:bad_room_code`, `error:room_full`) does **not** latch. `HelloSeen` stays false and the connection stays open so the client can send another hello — e.g. after re-prompting the user for a different room code or falling back to `mode: "public"`.
- A **successful** hello latches immediately: `HelloSeen := true` and `Player.DisplayName` / room assignment become authoritative for the remainder of the connection. Subsequent `player:hello` messages on the same connection are silently dropped (no error emitted) — they do **not** rename the player mid-match, re-route them to a different room, or reset their stats. To change rooms or display name, disconnect and reconnect.

**Reconnection and match resume (MVP scope):** Reconnecting to the *same* in-progress match is explicitly out of scope for Friends-MVP. A reconnect starts a brand-new `player:hello` handshake and the client is free to rejoin a public queue or re-submit a code. If the code-room's match is still running with capacity, the player will land back in it; if it has ended, the code releases per [rooms.md § Named Room Join](rooms.md#named-room-join). There is no server-side session stickiness — this is a regression relative to pre-MVP tab-reload behavior for public rooms, and is accepted for MVP because the alternative requires a persistent session identifier the server does not currently keep.

**Data Schema:**

**TypeScript:**
```typescript
type PlayerHelloData =
  | {
      displayName?: string;       // up to 16 chars after sanitization; optional, falls back to "Guest"
      mode: "public";             // join the public auto-matchmaking queue
    }
  | {
      displayName?: string;
      mode: "code";
      code: string;               // raw room code, normalized server-side to [A-Z0-9]{3..12}
    };
```

**Go:**
```go
type PlayerHelloData struct {
    DisplayName string `json:"displayName,omitempty"`
    Mode        string `json:"mode"`              // "public" | "code"
    Code        string `json:"code,omitempty"`    // required when Mode == "code"
}
```

**Examples:**
```json
{
  "type": "player:hello",
  "timestamp": 1704067200000,
  "data": {
    "displayName": "Alice",
    "mode": "public"
  }
}
```

```json
{
  "type": "player:hello",
  "timestamp": 1704067200000,
  "data": {
    "displayName": "Bob",
    "mode": "code",
    "code": "pizza"
  }
}
```

**Server Processing:**
1. Validate message against schema
2. Sanitize `displayName` per [rooms.md → Display Name Sanitization](rooms.md#display-name-sanitization); store on `Player.DisplayName`
3. If `mode == "public"`: route to public auto-matchmaking (`AddPublicPlayer`)
4. If `mode == "code"`: normalize code per [rooms.md → Room Code Normalization](rooms.md#room-code-normalization) and route to `JoinCodedRoom`. On normalization failure, send `error:bad_room_code` and leave the player unrouted
5. On successful room assignment, set `Player.HelloSeen = true` and send `session:status`

---

### `session:leave`

Request to leave the current pre-match session without disconnecting the socket. This message exists so the React app shell can offer an explicit `Back/Cancel` action from `searching_for_match` and `waiting_for_players` instead of forcing a browser refresh.

**When Sent:** On-demand while the client is still in a pre-match state and the user explicitly abandons the current join attempt.

**Rate Limit:** User-driven. Repeated `session:leave` messages when the player is already back at the join form are ignored.

**Data Schema:** No payload.

**Example:**
```json
{
  "type": "session:leave",
  "timestamp": 1704067200500
}
```

**Server Processing:**
1. If the player is in the public queue, remove them from the queue
2. If the player is alone in a named room that has not started, remove them from that room
3. If the player is in a pre-match waiting state that still allows clean exit, release that waiting state
4. Clear the connection's pre-match hello latch so the same socket may send a fresh `player:hello`
5. Send no gameplay bootstrap message afterward; the client returns to `join_form`
6. If the match is already active, ignore `session:leave` and require a normal disconnect/reconnect instead

---

### `test`

Echo test message for connection verification.

**When Sent:** Testing and debugging only

**Data Schema:** Any data (echoed back)

**Example:**
```json
{
  "type": "test",
  "timestamp": 1704067200000,
  "data": {
    "ping": true
  }
}
```

**Server Processing:** Echo message back to sender

---

## Server → Client Messages

### `session:status`

Authoritative pre-match session snapshot for the React app shell. This message replaces `room:joined` as the client-facing bootstrap contract for join, waiting, match-ready, replay, and reconnect recovery flows.

**Why a full snapshot instead of several smaller lifecycle messages?**
- The client can replace its entire pre-match state atomically instead of inferring meaning from message order
- Public queue waiting and named-room waiting become explicit, testable states
- Phaser does not need to mount before the session is actually playable
- Replay and reconnect flows can reuse the same shape as normal join flow

**When Sent:** Any time the authoritative pre-match session state changes for a player after a successful `player:hello`

**Recipients:** The affected player only

**Data Schema:**

**TypeScript:**
```typescript
type SessionStatusState =
  | 'searching_for_match'
  | 'waiting_for_players'
  | 'match_ready';

interface SessionStatusData {
  state: SessionStatusState;
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

**Go:**
```go
type SessionStatusData struct {
    State       string `json:"state"`
    PlayerID    string `json:"playerId"`
    DisplayName string `json:"displayName"`
    JoinMode    string `json:"joinMode"`
    RoomID      string `json:"roomId,omitempty"`
    Code        string `json:"code,omitempty"`
    RosterSize  int    `json:"rosterSize,omitempty"`
    MinPlayers  int    `json:"minPlayers,omitempty"`
    MapID       string `json:"mapId,omitempty"`
}
```

**State Semantics:**
- `searching_for_match`: successful public join intent, still in the public queue, no playable room yet
- `waiting_for_players`: successful named-room join intent, room exists, but roster is below `MIN_PLAYERS_TO_START`
- `match_ready`: the player now has the full bootstrap context required to mount Phaser and enter gameplay

**Examples:**
```json
{
  "type": "session:status",
  "timestamp": 1704067200100,
  "data": {
    "state": "searching_for_match",
    "playerId": "550e8400-e29b-41d4-a716-446655440000",
    "displayName": "Alice",
    "joinMode": "public",
    "minPlayers": 2
  }
}
```

```json
{
  "type": "session:status",
  "timestamp": 1704067200200,
  "data": {
    "state": "waiting_for_players",
    "playerId": "550e8400-e29b-41d4-a716-446655440000",
    "displayName": "Alice",
    "joinMode": "code",
    "roomId": "6d64957a-5330-4bca-a668-e2f9f8df7970",
    "code": "PIZZA",
    "rosterSize": 1,
    "minPlayers": 2
  }
}
```

```json
{
  "type": "session:status",
  "timestamp": 1704067201200,
  "data": {
    "state": "match_ready",
    "playerId": "550e8400-e29b-41d4-a716-446655440000",
    "displayName": "Alice",
    "joinMode": "code",
    "roomId": "6d64957a-5330-4bca-a668-e2f9f8df7970",
    "code": "PIZZA",
    "rosterSize": 2,
    "minPlayers": 2,
    "mapId": "default_office"
  }
}
```

**Field Rules:**
- `session:status` is a full snapshot. The client replaces its previous pre-match session state rather than merging incremental fields.
- `displayName` is always the server-authoritative sanitized form and may be persisted locally by the client.
- `mapId` is omitted until `state == "match_ready"`. Clients MUST NOT mount gameplay before they have a `match_ready` snapshot.
- `code` is omitted for public sessions.

**Client Handling:**
1. Replace the app shell's previous session snapshot with the new payload
2. Render the corresponding React screen state
3. Persist `displayName` as the last authoritative local name
4. Create the gameplay bootstrap object and mount Phaser only after `match_ready`
5. Never render raw UUIDs in player-facing session UI; if display-ready text is unexpectedly unavailable, render a safe placeholder such as `Guest`

---

### `room:joined`

> **Deprecated client bootstrap note (2026-04-17):** `session:status` is now the sole authoritative pre-match lifecycle contract for the app shell. This `room:joined` section is retained only as historical context for the old Phaser-owned bootstrap flow and must not be used as the primary join/search/wait contract in new client work.

Confirms player successfully joined a room and provides the authoritative room and map context needed to initialize gameplay.

**Why include room, player, and map identity together?**
- the server generates the player ID to prevent spoofing and collisions
- the client needs the room ID for contextual state
- the client must know the selected `mapId` before it can load the shared map config and initialize arena geometry correctly

**When Sent:** Player's WebSocket connection is accepted and assigned to a room

**Recipients:** The joining player only

**Data Schema:**

**TypeScript:**
```typescript
interface RoomJoinedData {
  roomId: string;        // UUID of the assigned room (opaque)
  playerId: string;      // UUID assigned to this player
  mapId: string;         // ID of the selected authoritative map config
  displayName: string;   // Server-sanitized name the player will be shown under
  code?: string;         // Present iff the room is a named room; normalized form
}
```

**Go:**
```go
type RoomJoinedData struct {
    RoomID      string `json:"roomId"`
    PlayerID    string `json:"playerId"`
    MapID       string `json:"mapId"`
    DisplayName string `json:"displayName"`
    Code        string `json:"code,omitempty"` // omitted for public rooms
}
```

**Example (public):**
```json
{
  "type": "room:joined",
  "timestamp": 1704067200100,
  "data": {
    "roomId": "6d64957a-5330-4bca-a668-e2f9f8df7970",
    "mapId": "default_office",
    "playerId": "550e8400-e29b-41d4-a716-446655440000",
    "displayName": "Alice"
  }
}
```

**Example (named):**
```json
{
  "type": "room:joined",
  "timestamp": 1704067200100,
  "data": {
    "roomId": "6d64957a-5330-4bca-a668-e2f9f8df7970",
    "mapId": "default_office",
    "playerId": "550e8400-e29b-41d4-a716-446655440000",
    "displayName": "Alice",
    "code": "PIZZA"
  }
}
```

**Why echo `displayName` back?**
Sanitization happens server-side and may change the name (trimming, truncation, fallback to "Guest"). The client needs to know the authoritative form so its local HUD matches what other players see.

**Compatibility posture (Friends-MVP).**
The addition of `displayName` (required) and `code` (optional) to `room:joined` is a **breaking wire change**. Friends-MVP ships client and server together; there is **no** backward-compatibility path for pre-MVP clients that never send a `player:hello`:
- The server will never emit `room:joined` for a connection that has not produced a valid hello (it cannot — there is no display name to put in the payload), so legacy clients connecting to a new server hang at `error:no_hello`.
- New clients connecting to a pre-MVP server never see `displayName` in `room:joined` and must treat that as a fatal version mismatch.
- Strict schema validation (`ENABLE_SCHEMA_VALIDATION=true` in [server-architecture.md](server-architecture.md)) MUST accept `displayName` as a required string and `code` as optional, as defined in [events-schema](./../events-schema/src/schemas/server-to-client.ts). No compatibility shim.

The client and server components of Friends-MVP are expected to be deployed atomically. Mixed-version deployments are not supported.

**Client Handling:**
1. Store local room ID, player ID, and authoritative display name
2. Resolve the local shared map config by `mapId`
3. Initialize arena bounds and obstacle geometry from that map
4. Clear any existing player sprites
5. Process queued `weapon:spawned` messages
6. Initialize health bar to 100%
7. Begin listening for `player:move` updates

---

### `error:no_hello`

Sent when a client issues a gameplay message (`input:state`, `player:shoot`, etc.) before the server has processed a valid `player:hello`.

**When Sent:** Any client-to-server message arrives on a connection where `Player.HelloSeen == false` and the message is not itself a `player:hello`.

**Recipients:** The offending player only.

**Data Schema:**

**TypeScript:**
```typescript
interface ErrorNoHelloData {
  offendingType: string; // the type the client tried to send
}
```

**Example:**
```json
{
  "type": "error:no_hello",
  "timestamp": 1704067200200,
  "data": { "offendingType": "input:state" }
}
```

**Server Behavior:** The offending message is dropped. `HelloSeen` is unchanged (still `false`). The connection stays open; the client can still send a valid `player:hello`.

**Client Handling:** If this fires unexpectedly it usually means a bug in the client's hello sequencing — most commonly, gameplay input racing the hello after a reconnect. Clients should log it, send a fresh `player:hello`, and retry the dropped intent. Transport failures such as "WebSocket could not connect" or "reconnect attempt still in progress" are a separate client-state concern and MUST NOT be surfaced by fabricating an `error:no_hello` payload.

---

### `error:bad_room_code`

Sent when a `player:hello` with `mode: "code"` fails [room code normalization](rooms.md#room-code-normalization).

**When Sent:** `normalizeRoomCode(raw).ok == false`.

**Recipients:** The offending player only.

**Data Schema:**

**TypeScript:**
```typescript
interface ErrorBadRoomCodeData {
  reason: "missing" | "too_short" | "too_long";
}
```

**Example:**
```json
{
  "type": "error:bad_room_code",
  "timestamp": 1704067200200,
  "data": { "reason": "too_short" }
}
```

**Server Behavior:** The player is not assigned to any room. `HelloSeen` remains `false` — this is a **failed** hello and does not latch, so the client is free to send another `player:hello` on the same connection. The connection stays open.

**Client Handling:** Re-prompt the user for a code and send another `player:hello`. The client may also offer "play public instead" and send `{ mode: "public" }`.

---

### `error:room_full`

Sent when a named-room join succeeds at the lookup step but the target room already has `MAX_PLAYERS_PER_ROOM` (8) players.

**When Sent:** `codeIndex[normalizedCode]` exists and `room.PlayerCount() >= 8`.

**Recipients:** The offending player only.

**Data Schema:**

**TypeScript:**
```typescript
interface ErrorRoomFullData {
  code: string; // normalized code that was full
}
```

**Example:**
```json
{
  "type": "error:room_full",
  "timestamp": 1704067200200,
  "data": { "code": "PARTY" }
}
```

**Server Behavior:** The player is not assigned. `HelloSeen` remains `false` (failed hellos never latch), so the client is free to send another `player:hello` on the same connection. The connection stays open.

**Client Handling:** Offer the user two choices: try a different code, or fall back to `mode: "public"`. Either resolution is a fresh `player:hello` on the same socket.

---

### `player:left`

Notifies room that a player disconnected.

**When Sent:** Player's WebSocket connection closes

**Recipients:** All remaining players in room

**Data Schema:**

**TypeScript:**
```typescript
interface PlayerLeftData {
  playerId: string; // ID of disconnected player
}
```

**Example:**
```json
{
  "type": "player:left",
  "timestamp": 1704067200200,
  "data": {
    "playerId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

**Client Handling:**
1. Remove the disconnected player's scene objects immediately using `playerId`
2. Do not wait for omission from a future `player:move` payload, because delta updates may omit unchanged players without implying disconnection
2. Update scoreboard/UI

---

### `player:move`

Broadcasts all player positions and states. This is the primary synchronization message.

**Why batch all players?** Sending individual player updates would require more messages. Batching reduces overhead and ensures consistent state across all clients.

**When Sent:** Every 50ms (20 Hz) during active match

**Recipients:** All players in room

**Data Schema:**

**TypeScript:**
```typescript
interface Position {
  x: number;
  y: number;
}

interface Velocity {
  x: number;
  y: number;
}

interface PlayerState {
  id: string;
  displayName: string;
  position: Position;
  velocity: Velocity;
  aimAngle: number;              // Aim angle in radians
  weaponType: string;            // Equipped weapon identity for authoritative remote presentation
  health: number;
  isRolling: boolean;
  isInvulnerable: boolean;       // Spawn protection active
  invulnerabilityEndTime: number; // Timestamp (ms) when invulnerability expires
  deathTime?: number;
  kills: number;
  deaths: number;
  xp: number;
  isRegenerating: boolean;
}

interface PlayerMoveData {
  players: PlayerState[];
  lastProcessedSequence?: Record<string, number>; // playerID → last processed input sequence
  correctedPlayers?: string[];                     // playerIDs whose positions were server-corrected
}
```

**Go:**
```go
// PlayerStateSnapshot is the struct serialized for each player in broadcasts
type PlayerStateSnapshot struct {
    ID                     string     `json:"id"`
    DisplayName            string     `json:"displayName"`
    Position               Vector2    `json:"position"`
    Velocity               Vector2    `json:"velocity"`
    AimAngle               float64    `json:"aimAngle"`
    WeaponType             string     `json:"weaponType"`
    Health                 int        `json:"health"`
    IsInvulnerable         bool       `json:"isInvulnerable"`
    InvulnerabilityEndTime time.Time  `json:"invulnerabilityEnd"`
    DeathTime              *time.Time `json:"deathTime,omitempty"`
    Kills                  int        `json:"kills"`
    Deaths                 int        `json:"deaths"`
    XP                     int        `json:"xp"`
    IsRegeneratingHealth   bool       `json:"isRegenerating"`
    Rolling                bool       `json:"isRolling"`
}
```

**Canonical wire contract:**
- `aimAngle` is transmitted on the wire as `aimAngle`
- `aimAngle` is authoritative for remote facing, held-weapon orientation, melee swing direction, and any projectile visuals derived from the player's aim
- `weaponType` is transmitted for every player and is authoritative for remote held-weapon identity, including respawn resets back to pistol
- accepting a new `input:state` updates the player's authoritative `aimAngle` immediately, even if the player is stationary
- remote clients must not infer a player's current held weapon from `weapon:pickup_confirmed`; pickup messages are room events, while current remote weapon identity comes from the player-state stream
- client-only convenience fields may be derived locally, but they must not replace the wire-level `aimAngle`

**Example:**
```json
{
  "type": "player:move",
  "timestamp": 1704067200200,
  "data": {
    "players": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "position": { "x": 100.5, "y": 200.3 },
        "velocity": { "x": 5.0, "y": -2.5 },
        "aimAngle": 0.785,
        "weaponType": "AK47",
        "health": 85,
        "isInvulnerable": false,
        "invulnerabilityEndTime": 1704067201200,
        "isRolling": false
      },
      {
        "id": "660e8400-e29b-41d4-a716-446655440111",
        "position": { "x": 500.0, "y": 300.0 },
        "velocity": { "x": 0.0, "y": 0.0 },
        "aimAngle": 3.14,
        "weaponType": "Pistol",
        "health": 100,
        "isInvulnerable": false,
        "invulnerabilityEndTime": 1704067201200,
        "isRolling": false
      }
    ]
  }
}
```

**Client Handling:**
1. Wait for `session:status { state: "match_ready" }` before processing
2. For each player in array:
   - Create sprite if new player
   - Update position, `aimAngle`, health, and `weaponType`
   - Update remote body pose using `aimAngle`
   - Update remote held weapon from `weaponType` in the player-state stream
   - Update local health bar if local player
   - Allow local kills / deaths / XP / held-weapon presentation to reconcile from the authoritative local player state if an earlier event-driven HUD update drifted
3. Remove sprites for players no longer in array
4. Ignored after `match:ended`

---

### `projectile:spawn`

Announces creation of a new projectile.

**When Sent:** Server validates a shoot request and creates a projectile

**Recipients:** All players in room

**Data Schema:**

**TypeScript:**
```typescript
interface ProjectileSpawnData {
  id: string;           // Unique projectile ID
  ownerId: string;      // Player who fired
  weaponType: string;   // Weapon type (e.g., "Pistol", "AK47")
  position: Position;   // Spawn position
  velocity: Velocity;   // Direction and speed
}
```

**Go Broadcast (actual):**

The Go server does **not** use a named struct for this message. Instead, `broadcast_helper.go:broadcastProjectileSpawn` builds an inline `map[string]interface{}` with only four fields:

```go
data := map[string]interface{}{
    "id":       proj.ID,
    "ownerId":  proj.OwnerID,
    "position": proj.Position,
    "velocity": proj.Velocity,
}
```

> **Note:** The Go broadcast omits `weaponType` even though the TypeBox `ProjectileSpawnDataSchema` defines it as a required field. This means the server sends only `id`, `ownerId`, `position`, and `velocity`. Schema validation in development mode (`ENABLE_SCHEMA_VALIDATION=true`) would flag this mismatch.

**Example (actual server payload):**
```json
{
  "type": "projectile:spawn",
  "timestamp": 1704067200300,
  "data": {
    "id": "proj-xyz789",
    "ownerId": "550e8400-e29b-41d4-a716-446655440000",
    "position": { "x": 100, "y": 200 },
    "velocity": { "x": 800, "y": 0 }
  }
}
```

**Client Handling:**
1. Create projectile sprite at position
2. Apply velocity for client-side prediction
3. Create muzzle flash effect at owner position
4. Play weapon fire sound
5. Screen shake if local player is shooter

---

### `projectile:destroy`

Announces removal of a projectile.

**When Sent:** Projectile hits a player, exits bounds, or times out

**Recipients:** All players in room

**Data Schema:**

**TypeScript:**
```typescript
interface ProjectileDestroyData {
  id: string; // Projectile ID to remove
}
```

**Example:**
```json
{
  "type": "projectile:destroy",
  "timestamp": 1704067200400,
  "data": {
    "id": "proj-xyz789"
  }
}
```

**Client Handling:**
1. Find projectile by ID
2. Remove sprite from scene
3. Optionally show impact effect

---

### `weapon:state`

Updates player's current weapon status.

**When Sent:**
- After successful shot (ammo decremented)
- When reload starts/completes
- After weapon pickup

**Recipients:** Single player (weapon owner)

**Data Schema:**

**TypeScript:**
```typescript
interface WeaponStateData {
  currentAmmo: number;  // Current ammo in magazine
  maxAmmo: number;      // Magazine capacity
  isReloading: boolean; // Currently reloading
  canShoot: boolean;    // Can fire (not reloading, has ammo, cooldown ready)
  weaponType: string;   // Weapon name
  isMelee: boolean;     // Is melee weapon (infinite ammo)
}
```

**Go:**
```go
type WeaponStateData struct {
    CurrentAmmo int    `json:"currentAmmo"`
    MaxAmmo     int    `json:"maxAmmo"`
    IsReloading bool   `json:"isReloading"`
    CanShoot    bool   `json:"canShoot"`
    WeaponType  string `json:"weaponType"`
    IsMelee     bool   `json:"isMelee"`
}
```

**Example:**
```json
{
  "type": "weapon:state",
  "timestamp": 1704067200500,
  "data": {
    "currentAmmo": 14,
    "maxAmmo": 15,
    "isReloading": false,
    "canShoot": true,
    "weaponType": "Pistol",
    "isMelee": false
  }
}
```

**Client Handling:**
1. Update ammo display UI
2. Update shooting manager state
3. Show reload indicator if reloading

**Reload Progress Tracking:** The `weapon:state` message sends `isReloading: boolean` but no `reloadProgress` (0.0-1.0) or `reloadStartTime`. The client tracks reload progress locally: on the first `isReloading: true` message, the client records the local timestamp as `reloadStartTime`. On each frame, progress is computed as `(now - reloadStartTime) / weapon.reloadDuration`. When `isReloading` transitions to `false`, the reload bar is hidden. This avoids adding a `reloadStartTime` field to the server broadcast payload.

---

### `shoot:failed`

Informs player why their shot was rejected.

**When Sent:** Player attempts to shoot but fails validation

**Recipients:** Player who attempted shot

**Data Schema:**

**TypeScript:**
```typescript
interface ShootFailedData {
  reason: 'no_player' | 'cooldown' | 'empty' | 'reloading';
}
```

**Example:**
```json
{
  "type": "shoot:failed",
  "timestamp": 1704067200600,
  "data": {
    "reason": "empty"
  }
}
```

**Client Handling:**
1. Log failure reason
2. Play empty click sound (if "empty")
3. Show visual feedback (UI flash)

---

### `player:damaged`

Announces that a player took damage.

**When Sent:** Projectile or melee attack successfully damages a player

**Recipients:** All players in room

**Data Schema:**

**TypeScript:**
```typescript
interface PlayerDamagedData {
  victimId: string;      // Player who took damage
  attackerId: string;    // Player who dealt damage
  damage: number;        // Amount of damage
  newHealth: number;     // Victim's health after damage
  projectileId?: string; // Present for projectile/hitscan hits; ABSENT for melee hits
}
```

**Go:**

> **Note:** No shared struct. The projectile hit path (`onHit` in `message_processor.go:112-117`) constructs the map inline with `projectileId`. The melee path (`broadcastPlayerDamaged` in `broadcast_helper.go:669-674`) omits `projectileId` entirely.

```go
// Projectile hit path (message_processor.go:112-117):
data := map[string]interface{}{
    "victimId":     hit.VictimID,
    "attackerId":   hit.AttackerID,
    "damage":       damage,
    "newHealth":    victimState.Health,
    "projectileId": hit.ProjectileID,
}

// Melee hit path (broadcast_helper.go:669-674):
data := map[string]interface{}{
    "victimId":   victimID,
    "attackerId": attackerID,
    "damage":     damage,
    "newHealth":  newHealth,
    // projectileId is NOT included
}
```

**Example:**
```json
{
  "type": "player:damaged",
  "timestamp": 1704067200700,
  "data": {
    "victimId": "550e8400-e29b-41d4-a716-446655440000",
    "attackerId": "660e8400-e29b-41d4-a716-446655440111",
    "damage": 25,
    "newHealth": 75,
    "projectileId": "proj-xyz789"
  }
}
```

**Client Handling:**
1. Update victim's health bar
2. Show damage number floating text
3. Show bullet impact effect at victim position
4. If local player is victim: flash screen red

---

### `hit:confirmed`

Confirms to the attacker that their hit was registered.

**Why separate from player:damaged?** This message is only for the attacker, providing immediate feedback. The `player:damaged` goes to all players for visual sync.

**When Sent:** Immediately after damage is applied

**Recipients:** Attacker only

**Data Schema:**

**TypeScript:**
```typescript
interface HitConfirmedData {
  victimId: string;     // Player who was hit
  damage: number;       // Damage dealt
  projectileId: string; // Projectile that hit
}
```

**Example:**
```json
{
  "type": "hit:confirmed",
  "timestamp": 1704067200800,
  "data": {
    "victimId": "550e8400-e29b-41d4-a716-446655440000",
    "damage": 25,
    "projectileId": "proj-xyz789"
  }
}
```

**Client Handling:**
1. Show hit marker crosshair
2. Play hit confirmation sound
3. Positive visual feedback

---

### `player:death`

Announces that a player was killed.

**When Sent:** Player's health reaches 0

**Recipients:** All players in room

**Data Schema:**

**TypeScript:**
```typescript
interface PlayerDeathData {
  victimId: string;   // Player who died
  attackerId: string; // Player who got the kill
}
```

**Example:**
```json
{
  "type": "player:death",
  "timestamp": 1704067200900,
  "data": {
    "victimId": "550e8400-e29b-41d4-a716-446655440000",
    "attackerId": "660e8400-e29b-41d4-a716-446655440111"
  }
}
```

**Client Handling:**
1. Play death animation on victim
2. Remove victim from active gameplay
3. If local player: enter spectator mode, show respawn timer
4. Add to kill feed UI

---

### `player:kill_credit`

Announces kill statistics update.

**When Sent:** After `player:death`, once stats are updated

**Recipients:** All players in room

**Data Schema:**

**TypeScript:**
```typescript
interface PlayerKillCreditData {
  killerId: string;     // Player who got the kill
  victimId: string;     // Player who died
  killerKills: number;  // Killer's total kills in match
  killerXP: number;     // Killer's total XP in match
}
```

**Example:**
```json
{
  "type": "player:kill_credit",
  "timestamp": 1704067201000,
  "data": {
    "killerId": "660e8400-e29b-41d4-a716-446655440111",
    "victimId": "550e8400-e29b-41d4-a716-446655440000",
    "killerKills": 3,
    "killerXP": 450
  }
}
```

**Client Handling:**
1. Update kill feed / scoreboard surfaces
2. If `killerId` matches the local player, update local score display from `killerXP`
3. If `killerId` matches the local player, update local kill counter from `killerKills`
4. If `killerId` does **not** match the local player, do not increment or overwrite the local HUD kill / XP display
5. Show "+100 XP" feedback to killer
6. Check win condition (kill target reached)
7. Allow the next authoritative player-state broadcast to reconcile local kills / XP if this event was missed or arrived out of order

> **Score = XP:** The 6-digit score display in the top-right HUD maps directly to `killerXP`. There is no separate `killerScore` field. The client formats XP as zero-padded 6 digits (e.g., XP of 450 displays as `"000450"`).

---

### `player:respawn`

Announces player has respawned.

**When Sent:** 3 seconds after death

**Recipients:** All players in room

**Data Schema:**

**TypeScript:**
```typescript
interface PlayerRespawnData {
  playerId: string;   // Player who respawned
  position: Position; // Spawn location
  health: number;     // Starting health (100)
}
```

**Example:**
```json
{
  "type": "player:respawn",
  "timestamp": 1704067201100,
  "data": {
    "playerId": "550e8400-e29b-41d4-a716-446655440000",
    "position": { "x": 256, "y": 384 },
    "health": 100
  }
}
```

**Client Handling:**
1. Create player sprite at spawn position
2. Reset health bar to 100%
3. If local player: exit spectator mode, resume input
4. Show spawn invulnerability effect (2 seconds)

---

### `match:timer`

Broadcasts remaining match time.

**When Sent:** Every second during active match

**Recipients:** All players in room

**Data Schema:**

**TypeScript:**
```typescript
interface MatchTimerData {
  remainingSeconds: number; // Seconds left (0 = time's up)
}
```

**Example:**
```json
{
  "type": "match:timer",
  "timestamp": 1704067201200,
  "data": {
    "remainingSeconds": 180
  }
}
```

**Client Handling:**
1. Update timer display (MM:SS format)
2. Flash red when < 30 seconds
3. Ignored after `match:ended`

---

### `match:ended`

Announces match completion with final results.

**Why include all scores?** Clients need final statistics for the end-of-match scoreboard. Including all data in one message prevents race conditions and creates a single frozen result snapshot.

**When Sent:** Kill target reached OR timer expires

**Strict cutoff rule:** The server emits `match:ended` only after every qualifying kill that completed before the cutoff has been fully resolved into deaths, kills, XP, winners, and `finalScores`. After `match:ended` is broadcast, standings are frozen; later stale or in-flight gameplay events do not modify the result.

**Recipients:** All players in room

**Data Schema:**

**TypeScript:**
```typescript
interface WinnerSummary {
  playerId: string;
  displayName: string;
}

interface PlayerScore {
  playerId: string;
  displayName: string;
  kills: number;
  deaths: number;
  xp: number;
}

interface MatchEndedData {
  winners: WinnerSummary[];     // Display-ready winner identities
  finalScores: PlayerScore[];   // All player stats
  reason: 'kill_target' | 'time_limit';
}
```

**Go:**
```go
type WinnerSummary struct {
    PlayerID    string `json:"playerId"`
    DisplayName string `json:"displayName"`
}

type MatchEndedData struct {
    Winners     []WinnerSummary `json:"winners"`
    FinalScores []PlayerScore  `json:"finalScores"`
    Reason      string         `json:"reason"`
}
```

**Example:**
```json
{
  "type": "match:ended",
  "timestamp": 1704067201300,
  "data": {
    "winners": [
      {
        "playerId": "660e8400-e29b-41d4-a716-446655440111",
        "displayName": "Alice"
      }
    ],
    "finalScores": [
      {
        "playerId": "660e8400-e29b-41d4-a716-446655440111",
        "displayName": "Alice",
        "kills": 20,
        "deaths": 5,
        "xp": 2000
      },
      {
        "playerId": "550e8400-e29b-41d4-a716-446655440000",
        "displayName": "Bob",
        "kills": 15,
        "deaths": 12,
        "xp": 1500
      }
    ],
    "reason": "kill_target"
  }
}
```

**Client Handling:**
1. Set match ended flag
2. Disable player input
3. Stop processing `player:move`, `match:timer`, and any later stat-changing gameplay UI updates
4. Freeze in-match HUD stats
5. Show match results screen
6. Display winner announcement and rankings using `displayName`
7. Use `playerId` only for non-visible identity logic such as local-player highlighting

---

### `weapon:spawned`

Announces initial weapon crate positions.

**When Sent:** When room is created, before first `player:move`

**Recipients:** All players in room

**Data Schema:**

**TypeScript:**
```typescript
interface WeaponCrate {
  id: string;           // Unique crate identifier
  position: Position;   // Location on map
  weaponType: string;   // Weapon available (e.g., "AK47")
  isAvailable: boolean; // Can be picked up
}

interface WeaponSpawnedData {
  crates: WeaponCrate[];
}
```

**Example:**
```json
{
  "type": "weapon:spawned",
  "timestamp": 1704067200000,
  "data": {
    "crates": [
      {
        "id": "uzi-1",
        "position": { "x": 960, "y": 216 },
        "weaponType": "Uzi",
        "isAvailable": true
      },
      {
        "id": "ak47-1",
        "position": { "x": 480, "y": 540 },
        "weaponType": "AK47",
        "isAvailable": true
      },
      {
        "id": "shotgun-1",
        "position": { "x": 1440, "y": 540 },
        "weaponType": "Shotgun",
        "isAvailable": true
      },
      {
        "id": "katana-1",
        "position": { "x": 960, "y": 864 },
        "weaponType": "Katana",
        "isAvailable": true
      },
      {
        "id": "bat-1",
        "position": { "x": 288, "y": 162 },
        "weaponType": "Bat",
        "isAvailable": true
      }
    ]
  }
}
```

**Client Handling:**
1. Queue if `session:status { state: "match_ready" }` not yet received
2. Create crate sprites at positions
3. Initialize crate manager

---

### `weapon:pickup_confirmed`

Announces successful weapon pickup.

**When Sent:** Player successfully picks up weapon crate

**Recipients:** All players in room

**Data Schema:**

**TypeScript:**
```typescript
interface WeaponPickupConfirmedData {
  playerId: string;        // Player who picked up
  crateId: string;         // Crate that was picked up
  weaponType: string;      // Weapon type received
  nextRespawnTime: number; // Unix epoch timestamp in seconds when crate respawns
}
```

**Example:**
```json
{
  "type": "weapon:pickup_confirmed",
  "timestamp": 1704067201400,
  "data": {
    "playerId": "550e8400-e29b-41d4-a716-446655440000",
    "crateId": "ak47-1",
    "weaponType": "AK47",
    "nextRespawnTime": 1704067231
  }
}
```

**Client Handling:**
1. Mark crate as unavailable (gray out sprite)
2. Hide pickup prompt if showing
3. Update pickup-related world feedback (crate state, notifications, optional room-visible pickup feedback)
4. Do **not** treat this message as authoritative for the local equipped weapon; local equip truth comes from `weapon:state`
5. Do **not** treat this message as authoritative for remote held-weapon identity; remote equip truth comes from the player-state stream (`player:move` / `state:snapshot` / `state:delta`)

---

### `weapon:respawned`

Announces weapon crate is available again.

**When Sent:** 30 seconds after pickup

**Recipients:** All players in room

**Data Schema:**

**TypeScript:**
```typescript
interface WeaponRespawnedData {
  crateId: string;     // Crate that respawned
  weaponType: string;  // Weapon type
  position: Position;  // Crate location
}
```

**Example:**
```json
{
  "type": "weapon:respawned",
  "timestamp": 1704067231400,
  "data": {
    "crateId": "ak47-1",
    "weaponType": "AK47",
    "position": { "x": 480, "y": 540 }
  }
}
```

**Client Handling:**
1. Mark crate as available
2. Refresh crate sprite (full opacity)

---

### `melee:hit`

Announces melee attack connected with one or more targets.

**When Sent:** Melee attack hits at least one player

**Recipients:** All players in room

**Data Schema:**

**TypeScript:**
```typescript
interface MeleeHitData {
  attackerId: string;         // Player who swung
  victims: string[];          // All players hit (can be multiple)
  knockbackApplied: boolean;  // Whether Bat knockback was applied
}
```

**Example:**
```json
{
  "type": "melee:hit",
  "timestamp": 1704067201500,
  "data": {
    "attackerId": "550e8400-e29b-41d4-a716-446655440000",
    "victims": ["660e8400-e29b-41d4-a716-446655440111"],
    "knockbackApplied": true
  }
}
```

**Client Handling:**
1. Play melee swing animation
2. Show hit effect at swing origin
3. Wait for `player:damaged` for damage numbers

---

### `roll:start`

Announces player began dodge roll.

**When Sent:** Server validates and starts dodge roll

**Recipients:** All players in room

**Data Schema:**

**TypeScript:**
```typescript
interface RollStartData {
  playerId: string;      // Player who started rolling
  direction: {
    x: number;           // Roll direction (normalized)
    y: number;
  };
  rollStartTime: number; // Server timestamp (ms)
}
```

**Example:**
```json
{
  "type": "roll:start",
  "timestamp": 1704067201600,
  "data": {
    "playerId": "550e8400-e29b-41d4-a716-446655440000",
    "direction": { "x": 0.707, "y": 0.707 },
    "rollStartTime": 1704067201600
  }
}
```

**Client Handling:**
1. Start dodge roll animation (blur/transparency)
2. Show afterimages
3. Play whoosh sound
4. If local player: update cooldown UI

---

### `roll:end`

Announces dodge roll completed or was interrupted.

**When Sent:** Roll duration expires OR player hits wall

**Recipients:** All players in room

**Data Schema:**

**TypeScript:**
```typescript
interface RollEndData {
  playerId: string;                        // Player who stopped rolling
  reason: 'completed' | 'wall_collision';  // Why roll ended
}
```

**Example:**
```json
{
  "type": "roll:end",
  "timestamp": 1704067201700,
  "data": {
    "playerId": "550e8400-e29b-41d4-a716-446655440000",
    "reason": "completed"
  }
}
```

**Client Handling:**
1. End dodge roll animation
2. Restore normal transparency
3. Start cooldown timer display

---

### `state:snapshot`

Full game state for delta compression reset. Sent per-client (not broadcast).

**Why per-client?** Each client has its own delta tracker. A snapshot resets that client's baseline, preventing state drift when deltas miss changes.

**When Sent:** Every 1 second per connected client, or on first update after connect

**Recipients:** Individual client

**Data Schema:**

**TypeScript:**
```typescript
interface ProjectileSnapshot {
  id: string;
  ownerId: string;
  position: Position;
  velocity: Velocity;
}

interface WeaponCrateSnapshot {
  id: string;
  position: Position;
  weaponType: string;
  isAvailable: boolean;
}

interface StateSnapshotData {
  players: PlayerState[];
  projectiles: ProjectileSnapshot[];
  weaponCrates: WeaponCrateSnapshot[];
  lastProcessedSequence?: Record<string, number>;
  correctedPlayers?: string[];
}
```

**Example:**
```json
{
  "type": "state:snapshot",
  "timestamp": 1704067201800,
  "data": {
    "players": [{ "id": "p1", "position": {"x": 100, "y": 200}, ... }],
    "projectiles": [{ "id": "proj-1", "ownerId": "p1", "position": {"x": 500, "y": 300}, "velocity": {"x": 800, "y": 0} }],
    "weaponCrates": [{ "id": "uzi-1", "position": {"x": 960, "y": 216}, "weaponType": "Uzi", "isAvailable": true }],
    "lastProcessedSequence": { "p1": 42, "p2": 38 },
    "correctedPlayers": []
  }
}
```

---

### `state:delta`

Incremental state update for bandwidth optimization. Only includes changed entities.

**Why deltas?** Most 50ms broadcast windows have 0-2 players changing position. Sending only changes reduces bandwidth by ~60-80% compared to full snapshots.

**When Sent:** Every 50ms (20 Hz) between snapshots, per-client

**Recipients:** Individual client

**Data Schema:**

**TypeScript:**
```typescript
interface StateDeltaData {
  players?: PlayerState[];           // Only players whose state changed
  projectilesAdded?: ProjectileSnapshot[];  // Newly spawned projectiles
  projectilesRemoved?: string[];     // IDs of destroyed projectiles
  lastProcessedSequence?: Record<string, number>;
  correctedPlayers?: string[];
}
```

**Example:**
```json
{
  "type": "state:delta",
  "timestamp": 1704067201850,
  "data": {
    "players": [{ "id": "p1", "position": {"x": 103, "y": 200}, ... }],
    "projectilesAdded": [],
    "projectilesRemoved": ["proj-old"],
    "lastProcessedSequence": { "p1": 43 },
    "correctedPlayers": []
  }
}
```

**Client Handling:**
1. Merge delta players into local state (update only listed players)
2. Add new projectiles from `projectilesAdded`
3. Remove projectiles listed in `projectilesRemoved`
4. Use `lastProcessedSequence` for prediction reconciliation
5. If `correctedPlayers` includes local player: apply server correction

---

## Message Flow Diagrams

### Connection Flow

```
Client                          Server
  |                                |
  |--- WebSocket Connect --------->|
  |                                | Create player
  |--- player:hello ------------->|
  |<------ session:status ---------|
  |<------ weapon:spawned ---------|
  |                                |
  |<------ player:move (20Hz) -----|
  |--- input:state --------------->|
  |                                |
```

### Shooting Flow

```
Client                          Server
  |                                |
  |--- player:shoot -------------->|
  |                                | Validate
  |<------ projectile:spawn -------|
  |<------ weapon:state -----------|
  |                                |
  |    ... projectile travels ...  |
  |                                |
  |                                | Hit detected
  |<------ player:damaged ---------|
  |<------ hit:confirmed ----------| (to shooter)
  |<------ projectile:destroy -----|
  |                                |
```

### Death/Respawn Flow

```
Client                          Server
  |                                |
  |<------ player:damaged ---------| (final damage)
  |<------ player:death -----------|
  |<------ player:kill_credit -----|
  |                                |
  |    ... 3 second delay ...      |
  |                                |
  |<------ player:respawn ---------|
  |                                |
```

### Weapon Pickup Flow

```
Client                          Server
  |                                |
  |--- weapon:pickup_attempt ----->|
  |                                | Validate proximity
  |<------ weapon:pickup_confirmed-|
  |<------ weapon:state -----------|
  |                                |
  |    ... 30 second delay ...     |
  |                                |
  |<------ weapon:respawned -------|
  |                                |
```

### Match End Flow

```
Client                          Server
  |                                |
  |<------ match:timer (0) --------| or kill target reached
  |<------ match:ended ------------|
  |                                |
  |    (stop processing moves)     |
  |    (show results screen)       |
  |                                |
```

---

## Error Handling

### Invalid JSON

**Trigger**: Malformed JSON received
**Detection**: JSON parse error
**Response**: Log warning, ignore message
**Why**: Don't crash on bad data from potentially malicious client

### Unknown Message Type

**Trigger**: Unrecognized `type` field
**Detection**: No handler registered
**Response**: Log warning, ignore message
**Why**: Forward compatibility with future message types

### Schema Validation Failure

**Trigger**: Data doesn't match schema (development only)
**Detection**: JSON Schema validation error
**Response**: Log warning, process anyway
**Why**: Development aid, not production blocking

---

## Implementation Notes

### TypeScript (Client)

1. **Event Registration**: Use typed event handlers with TypeBox-generated types
2. **Queue Management**: Queue `weapon:spawned` until `session:status { state: "match_ready" }`
3. **Match State**: Track `matchEnded` flag to ignore stale messages

### Go (Server)

1. **Schema Validation**: Optional via `ENABLE_SCHEMA_VALIDATION=true`
2. **Broadcast Helper**: Use `broadcastToRoom()` for room-wide messages
3. **Targeted Messages**: Use player's SendChan for individual messages
4. **Thread Safety**: Message processing runs in game loop goroutine

---

## Test Scenarios

### TS-MSG-001: input:state updates player position

**Category**: Integration
**Priority**: Critical

**Preconditions:**
- Player connected and in room

**Input:**
- Send `input:state` with `up: true`
- Wait for next `player:move` broadcast

**Expected Output:**
- Player Y position decreased (moved up)

### TS-MSG-002: player:shoot creates projectile

**Category**: Integration
**Priority**: Critical

**Preconditions:**
- Player has ammo > 0
- Fire rate cooldown expired

**Input:**
- Send `player:shoot` with aim angle 0

**Expected Output:**
- Receive `projectile:spawn` with correct aimAngle
- Receive `weapon:state` with decremented ammo

### TS-MSG-003: shoot:failed sent on empty magazine

**Category**: Unit
**Priority**: High

**Preconditions:**
- Player ammo = 0

**Input:**
- Send `player:shoot`

**Expected Output:**
- Receive `shoot:failed` with reason "empty"

### TS-MSG-004: player:damaged sent on hit

**Category**: Integration
**Priority**: Critical

**Preconditions:**
- Two players in room
- Player A shoots toward Player B

**Input:**
- Projectile collides with Player B

**Expected Output:**
- All players receive `player:damaged` with victimId = B
- Player A receives `hit:confirmed`

### TS-MSG-005: player:death triggers respawn after 3 seconds

**Category**: Integration
**Priority**: High

**Preconditions:**
- Player at low health

**Input:**
- Apply lethal damage

**Expected Output:**
- Receive `player:death`
- After 3 seconds, receive `player:respawn`

### TS-MSG-006: match:ended freezes gameplay and stat processing

**Category**: Integration
**Priority**: High

**Preconditions:**
- Active match

**Input:**
- Kill target reached (or timer expires)

**Expected Output:**
- Receive `match:ended` with winners and scores
- `player:move` messages stop being processed
- Late stat-changing gameplay events do not mutate the frozen HUD

### TS-MSG-007: weapon:pickup_confirmed marks crate unavailable

**Category**: Integration
**Priority**: Medium

**Preconditions:**
- Player near available weapon crate

**Input:**
- Send `weapon:pickup_attempt`

**Expected Output:**
- Receive `weapon:pickup_confirmed`
- Crate shows as unavailable
- After 30 seconds, receive `weapon:respawned`

### TS-MSG-008: roll:start and roll:end sequence

**Category**: Integration
**Priority**: Medium

**Preconditions:**
- Player not on roll cooldown

**Input:**
- Send `player:dodge_roll`

**Expected Output:**
- Receive `roll:start` with direction
- After 400ms, receive `roll:end` with reason "completed"

### TS-MSG-009: melee:hit includes all victims

**Category**: Integration
**Priority**: Medium

**Preconditions:**
- Player has melee weapon
- Two enemies in swing arc

**Input:**
- Send `player:melee_attack`

**Expected Output:**
- Receive `melee:hit` with 2 victims
- Receive 2 `player:damaged` messages

### TS-MSG-010: session:status provides valid UUID

**Category**: Unit
**Priority**: High

**Preconditions:**
- New WebSocket connection

**Input:**
- Connect to server

**Expected Output:**
- Receive `session:status` with valid UUID format `playerId`

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.5.1 | 2026-04-23 | Clarified client handling for `error:no_hello`: it remains a real server protocol rejection only, and clients must not fabricate it to represent local WebSocket connect/reconnect transport failures. |
| 1.5.0 | 2026-04-23 | Merged the April contract changes: `session:leave` and `session:status` define the session-first bootstrap flow, `match:ended` winners and final scores are display-ready with `displayName` while `playerId` remains non-visible identity data, `player:move` documents authoritative per-player `weaponType` for remote held-weapon presentation, `weapon:pickup_confirmed` is room feedback rather than equip authority, `player:kill_credit` only updates local HUD stats for the local killer, and `match:ended` freezes later stat-facing UI updates. |
| 1.3.1 | 2026-04-11 | Friends-MVP pre-mortem fixes: (1) `player:hello` latching tightened — only **successful** hellos set `HelloSeen`; failed hellos (`error:bad_room_code`, `error:room_full`) leave the connection free to send another hello; (2) reconnection contract made explicit — every new connection must begin with a fresh `player:hello`, in-progress match resume is out of scope for MVP; (3) `room:joined` compatibility posture documented as breaking (no pre-MVP client support, atomic client+server deploy required); (4) `error:no_hello` / `error:bad_room_code` / `error:room_full` server-behavior blocks updated to explicitly state `HelloSeen` stays `false`. |
| 1.3.0 | 2026-04-11 | Friends-MVP: added `player:hello` (required join intent), `error:no_hello`, `error:bad_room_code`, `error:room_full`. Extended `room:joined` with authoritative `displayName` and optional `code`. Client-to-server count: 7→8; server-to-client: 22→25. |
| 1.2.0 | 2026-02-18 | Art style alignment: Added isInvulnerable and invulnerabilityEndTime to TypeScript PlayerState. Documented reload progress tracking (client-side timestamp approach). Documented score=XP mapping. Added Go-to-TypeScript field name mapping table for player:move. |
| 1.1.4 | 2026-02-16 | Clarified `input:state` Go struct — `sequence` is not part of `InputState` struct, extracted separately in `message_processor.go` |
| 1.1.3 | 2026-02-16 | Fixed `player:damaged` — melee path omits `projectileId` entirely; projectile path includes it. Made `projectileId` optional in TypeScript interface. |
| 1.1.2 | 2026-02-16 | Fixed `weapon:pickup_confirmed` `nextRespawnTime` — is Unix epoch timestamp in seconds (via `respawnTime.Unix()`), not duration in milliseconds |
| 1.1.1 | 2026-02-16 | Fixed `projectile:spawn` Go section — server broadcast omits `weaponType` (only sends id, ownerId, position, velocity) |
| 1.1.0 | 2026-02-15 | Added `sequence` field to `input:state`. Added `clientTimestamp` field to `player:shoot`. Added `lastProcessedSequence` and `correctedPlayers` to `player:move`. Added new `state:snapshot` and `state:delta` message types for delta compression. Updated server→client count from 20 to 22. |
| 1.0.0 | 2026-02-02 | Initial specification extracted from codebase |
