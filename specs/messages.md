# Messages

> **Spec Version**: 1.1.0
> **Last Updated**: 2026-02-15
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

### Client → Server (7 types)

| Type | Description | Frequency |
|------|-------------|-----------|
| `input:state` | WASD movement and aim | Every input change (~60 Hz max) |
| `player:shoot` | Fire weapon request | On-demand (player clicks) |
| `player:reload` | Reload weapon request | On-demand (player presses R) |
| `weapon:pickup_attempt` | Pick up weapon crate | On-demand (player presses E) |
| `player:melee_attack` | Swing melee weapon | On-demand (player clicks) |
| `player:dodge_roll` | Initiate dodge roll | On-demand (player presses Space) |
| `test` | Echo test message | Testing only |

### Server → Client (22 types)

| Type | Description | Recipients |
|------|-------------|------------|
| `room:joined` | Player assigned to room | Joining player |
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
type InputStateData struct {
    Up          bool    `json:"up"`
    Down        bool    `json:"down"`
    Left        bool    `json:"left"`
    Right       bool    `json:"right"`
    AimAngle    float64 `json:"aimAngle"`
    IsSprinting bool    `json:"isSprinting"`
    Sequence    int     `json:"sequence"`
}
```

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

**When Sent:** Player clicks fire button (left mouse)

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

### `room:joined`

Confirms player successfully joined a room and provides their assigned ID.

**Why assigned ID?** Server generates UUIDs to prevent ID collisions and ensure uniqueness across all connections.

**When Sent:** Player's WebSocket connection is accepted and assigned to a room

**Recipients:** The joining player only

**Data Schema:**

**TypeScript:**
```typescript
interface RoomJoinedData {
  playerId: string; // UUID assigned to this player
}
```

**Go:**
```go
type RoomJoinedData struct {
    PlayerID string `json:"playerId"`
}
```

**Example:**
```json
{
  "type": "room:joined",
  "timestamp": 1704067200100,
  "data": {
    "playerId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

**Client Handling:**
1. Store local player ID
2. Clear any existing player sprites
3. Process queued `weapon:spawned` messages
4. Initialize health bar to 100%
5. Begin listening for `player:move` updates

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
1. Remove player sprite from scene
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
  position: Position;
  velocity: Velocity;
  health: number;
  maxHealth: number;
  rotation: number;     // Aim angle in radians
  isDead: boolean;
  isSprinting: boolean;
  isRolling: boolean;
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
    Position               Vector2    `json:"position"`
    Velocity               Vector2    `json:"velocity"`
    AimAngle               float64    `json:"aimAngle"`
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

> **Note:** The Go `PlayerStateSnapshot` struct serializes different JSON field names than the TypeBox `PlayerStateSchema` expects. For example, Go sends `aimAngle` while the TypeBox schema defines `rotation`; Go sends `deathTime` instead of `isDead`; Go omits `maxHealth` and `isSprinting`. This mismatch exists in the codebase and may be reconciled by the client-side handler.

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
        "health": 85,
        "maxHealth": 100,
        "rotation": 0.785,
        "isDead": false,
        "isSprinting": true,
        "isRolling": false
      },
      {
        "id": "660e8400-e29b-41d4-a716-446655440111",
        "position": { "x": 500.0, "y": 300.0 },
        "velocity": { "x": 0.0, "y": 0.0 },
        "health": 100,
        "maxHealth": 100,
        "rotation": 3.14,
        "isDead": false,
        "isSprinting": false,
        "isRolling": false
      }
    ]
  }
}
```

**Client Handling:**
1. Wait for `room:joined` before processing
2. For each player in array:
   - Create sprite if new player
   - Update position, rotation, health
   - Update local health bar if local player
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
1. Update scoreboard
2. Check win condition (kill target reached)
3. Show "+100 XP" feedback to killer

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

**Why include all scores?** Clients need final statistics for the end-of-match scoreboard. Including all data in one message prevents race conditions.

**When Sent:** Kill target reached OR timer expires

**Recipients:** All players in room

**Data Schema:**

**TypeScript:**
```typescript
interface PlayerScore {
  playerId: string;
  kills: number;
  deaths: number;
  xp: number;
}

interface MatchEndedData {
  winners: string[];            // Array of winner player IDs
  finalScores: PlayerScore[];   // All player stats
  reason: 'kill_target' | 'time_limit';
}
```

**Go:**
```go
type MatchEndedData struct {
    Winners     []string       `json:"winners"`
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
    "winners": ["660e8400-e29b-41d4-a716-446655440111"],
    "finalScores": [
      {
        "playerId": "660e8400-e29b-41d4-a716-446655440111",
        "kills": 20,
        "deaths": 5,
        "xp": 2000
      },
      {
        "playerId": "550e8400-e29b-41d4-a716-446655440000",
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
3. Stop processing `player:move` and `match:timer`
4. Show match results screen
5. Display winner announcement

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
1. Queue if `room:joined` not yet received
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
3. Update player's weapon visual
4. If local player: update weapon type for effects

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
  |<------ room:joined ------------|
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
2. **Queue Management**: Queue `weapon:spawned` until `room:joined`
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

### TS-MSG-006: match:ended stops game processing

**Category**: Integration
**Priority**: High

**Preconditions:**
- Active match

**Input:**
- Kill target reached (or timer expires)

**Expected Output:**
- Receive `match:ended` with winners and scores
- `player:move` messages stop being processed

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

### TS-MSG-010: room:joined provides valid UUID

**Category**: Unit
**Priority**: High

**Preconditions:**
- New WebSocket connection

**Input:**
- Connect to server

**Expected Output:**
- Receive `room:joined` with valid UUID format playerId

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-02-02 | Initial specification extracted from codebase |
| 1.1.0 | 2026-02-15 | Added `sequence` field to `input:state`. Added `clientTimestamp` field to `player:shoot`. Added `lastProcessedSequence` and `correctedPlayers` to `player:move`. Added new `state:snapshot` and `state:delta` message types for delta compression. Updated server→client count from 20 to 22. |
| 1.1.1 | 2026-02-16 | Fixed `projectile:spawn` Go section — server broadcast omits `weaponType` (only sends id, ownerId, position, velocity) |
| 1.1.2 | 2026-02-16 | Fixed `weapon:pickup_confirmed` `nextRespawnTime` — is Unix epoch timestamp in seconds (via `respawnTime.Unix()`), not duration in milliseconds |
| 1.1.3 | 2026-02-16 | Fixed `player:damaged` — melee path omits `projectileId` entirely; projectile path includes it. Made `projectileId` optional in TypeScript interface. |
