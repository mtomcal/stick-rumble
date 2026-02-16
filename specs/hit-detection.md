# Hit Detection

> **Spec Version**: 1.1.0
> **Last Updated**: 2026-02-15
> **Depends On**: [constants.md](constants.md), [player.md](player.md), [weapons.md](weapons.md), [shooting.md](shooting.md), [arena.md](arena.md), [messages.md](messages.md)
> **Depended By**: [match.md](match.md), [client-architecture.md](client-architecture.md), [server-architecture.md](server-architecture.md)

---

## Overview

The hit detection system is the collision detection and damage application layer that determines when projectiles hit players and handles the resulting game state changes. This is a **server-authoritative** system—all collision calculations happen on the server to prevent cheating. Clients receive only the results via WebSocket messages.

**Why server-authoritative hit detection?**
1. **Anti-cheat**: Clients cannot lie about hit registration
2. **Consistency**: All players see the same hit/miss results
3. **Fairness**: Lag compensation rewinds positions using each player's RTT

The system supports two collision modes:
- **Projectile collision** (Uzi, AK47, Shotgun): AABB point-vs-rectangle check each tick
- **Hitscan collision** (Pistol): Ray-circle intersection with lag-compensated position rewinding

The system runs at **60 Hz** (every 16.67ms) as part of the main game tick, checking all active projectiles against all alive players. When a hit is detected, damage is applied, messages are broadcast, and death/kill tracking is updated.

---

## Dependencies

### Technology Dependencies

| Technology | Version | Purpose |
|------------|---------|---------|
| Go | 1.25 | Server-side collision detection |
| gorilla/websocket | v1.5.3 | Broadcasting hit events |

### Spec Dependencies

- [constants.md](constants.md) - Hitbox dimensions, projectile max range/lifetime
- [player.md](player.md) - PlayerState structure, health system, invulnerability
- [weapons.md](weapons.md) - Weapon damage values
- [shooting.md](shooting.md) - Projectile creation and structure
- [arena.md](arena.md) - Boundary checks for projectile expiration
- [messages.md](messages.md) - `player:damaged`, `hit:confirmed`, `player:death`, `player:kill_credit` schemas

---

## Constants

All hit detection constants are defined in [constants.md](constants.md). Key values:

| Constant | Value | Unit | Description |
|----------|-------|------|-------------|
| PLAYER_WIDTH | 32 | px | Player hitbox width |
| PLAYER_HEIGHT | 64 | px | Player hitbox height |
| PROJECTILE_MAX_LIFETIME | 1000 | ms | Projectile auto-expire after 1 second |
| PROJECTILE_MAX_RANGE | 800 | px | Projectile ignored after traveling 800px |
| SPAWN_INVULNERABILITY_DURATION | 2000 | ms | Post-respawn invulnerability |
| DODGE_ROLL_INVINCIBILITY_DURATION | 200 | ms | I-frames during dodge roll |
| KILL_XP_REWARD | 100 | XP | XP awarded for each kill |

---

## Data Structures

### Projectile (Server)

**Description**: Represents an in-flight projectile with position, velocity, and tracking metadata.

**Go:**
```go
type Projectile struct {
    ID            string    `json:"id"`            // Unique projectile UUID
    OwnerID       string    `json:"ownerId"`       // Player who fired it
    WeaponType    string    `json:"weaponType"`    // Weapon that created it
    Position      Vector2   `json:"position"`      // Current position (X, Y)
    Velocity      Vector2   `json:"velocity"`      // Velocity vector (X, Y)
    SpawnPosition Vector2   `json:"-"`             // Where projectile was created (server-only, not serialized)
    CreatedAt     time.Time `json:"-"`             // Timestamp for lifetime check
    Active        bool      `json:"-"`             // Is projectile still active?
}
```

**TypeScript:**
```typescript
interface Projectile {
  id: string;           // Unique projectile UUID
  ownerId: string;      // Player who fired it
  weaponType: string;   // Weapon that created it
  position: Vector2;    // Current position
  velocity: Vector2;    // Velocity vector
  spawnPosition: Vector2; // Where projectile was created
  createdAt: number;    // Timestamp in ms
  active: boolean;      // Is projectile still active?
}
```

### HitEvent

**Description**: Represents a detected collision between a projectile and a player.

**Go:**
```go
type HitEvent struct {
    ProjectileID string  // Which projectile hit
    VictimID     string  // Who got hit
    AttackerID   string  // Who fired the projectile
}
```

**TypeScript:**
```typescript
interface HitEvent {
  projectileId: string; // Which projectile hit
  victimId: string;     // Who got hit
  attackerId: string;   // Who fired the projectile
}
```

### Player Hitbox

**Description**: The player hitbox is an axis-aligned bounding box (AABB) centered on the player's position.

```
Hitbox dimensions:
- Width: 32 pixels
- Height: 64 pixels
- Center: Player position (x, y)

Boundaries:
- Left:   x - 16
- Right:  x + 16
- Top:    y - 32
- Bottom: y + 32
```

**Why AABB instead of circle collision?**
1. **Stick figure shape**: Players are tall and thin (32x64), poorly approximated by a circle
2. **Performance**: AABB collision is faster than circle-rectangle
3. **Intuitive hitbox**: Matches the visual stick figure silhouette

---

## Behavior

### Hit Detection Loop

The hit detection loop runs every game tick (60 Hz) as part of the main game loop.

**Why 60 Hz?**
- Matches physics update rate for consistent collision detection
- Fast enough to catch high-speed projectiles (800 px/s = 13.3 px/frame)
- Low enough for acceptable server CPU load

**Pseudocode:**
```
function checkHitDetection():
    projectiles = getAllActiveProjectiles()
    players = getAllPlayers()

    for each projectile in projectiles:
        for each player in players:
            if checkProjectilePlayerCollision(projectile, player):
                hitEvents.add(HitEvent(projectile.ID, player.ID, projectile.OwnerID))

    for each hit in hitEvents:
        processHit(hit)
```

**Go:**
```go
func (gs *GameServer) checkHitDetection() {
    projectiles := gs.projectileManager.GetActiveProjectiles()
    if len(projectiles) == 0 {
        return
    }

    // Get all players under read lock
    gs.world.mu.RLock()
    players := make([]*PlayerState, 0, len(gs.world.players))
    for _, player := range gs.world.players {
        players = append(players, player)
    }
    gs.world.mu.RUnlock()

    hits := gs.physics.CheckAllProjectileCollisions(projectiles, players)

    for _, hit := range hits {
        gs.weaponMu.RLock()
        weaponState := gs.weaponStates[hit.AttackerID]
        gs.weaponMu.RUnlock()
        if weaponState == nil {
            continue
        }

        damage := weaponState.Weapon.Damage

        victim, exists := gs.world.GetPlayer(hit.VictimID)
        if !exists {
            continue
        }
        victim.TakeDamage(damage)

        gs.projectileManager.RemoveProjectile(hit.ProjectileID)

        if gs.onHit != nil {
            gs.onHit(hit)  // Passes entire HitEvent struct
        }
    }
}
```

### Projectile-Player Collision Check

This is the core collision detection algorithm. It performs multiple checks before testing the actual AABB collision.

**Why so many checks before collision?**
1. **Early rejection**: Skip expensive math when possible
2. **Game rules**: Enforce invulnerability, owner immunity, range limits
3. **Performance**: Most checks are simple boolean comparisons

**Pseudocode:**
```
function checkProjectilePlayerCollision(projectile, player):
    // Check 1: Player must be alive
    if not player.isAlive():
        return false

    // Check 2: Player must not be invulnerable (spawn protection)
    if player.isInvulnerable:
        return false

    // Check 3: Player must not have dodge roll i-frames
    if player.isInvincibleFromRoll():
        return false

    // Check 4: Cannot hit yourself (friendly fire off)
    if projectile.ownerID == player.id:
        return false

    // Check 5: Projectile must be within max range
    distanceTraveled = distance(projectile.position, projectile.spawnPosition)
    if distanceTraveled > PROJECTILE_MAX_RANGE:
        return false

    // Check 6: AABB collision test
    return aabbCollision(projectile.position, player.position, player.hitbox)
```

**Go:**
```go
func (p *Physics) CheckProjectilePlayerCollision(proj *Projectile, player *PlayerState) bool {
    // Check 1: Player alive
    if !player.IsAlive() {
        return false
    }

    // Check 2: Not invulnerable (spawn protection)
    if player.IsInvulnerable {
        return false
    }

    // Check 3: Not in dodge roll i-frames
    if player.IsInvincibleFromRoll() {
        return false
    }

    // Check 4: Not owner (no self-damage)
    if proj.OwnerID == player.ID {
        return false
    }

    // Check 5: Within max range
    distanceTraveled := proj.Position.DistanceTo(proj.SpawnPosition)
    if distanceTraveled > ProjectileMaxRange {
        return false
    }

    // Check 6: AABB collision
    playerPos := player.GetPosition()
    halfWidth := PlayerWidth / 2   // 16 pixels
    halfHeight := PlayerHeight / 2 // 32 pixels

    return math.Abs(proj.Position.X-playerPos.X) < halfWidth &&
           math.Abs(proj.Position.Y-playerPos.Y) < halfHeight
}
```

### AABB Collision Algorithm

The collision test uses a simple axis-aligned bounding box check. A projectile (treated as a point) hits if it's within the player's rectangular hitbox.

**Why point-vs-rectangle instead of circle-vs-rectangle?**
- Projectiles are small (4px diameter) relative to movement speed
- Point collision is faster to calculate
- Visual tracer gives perceived "thickness" without needing circle collision

**Pseudocode:**
```
function aabbCollision(point, center, halfSize):
    dx = abs(point.x - center.x)
    dy = abs(point.y - center.y)
    return dx < halfSize.x AND dy < halfSize.y
```

**Go:**
```go
func aabbCollision(pointX, pointY, centerX, centerY, halfWidth, halfHeight float64) bool {
    dx := math.Abs(pointX - centerX)
    dy := math.Abs(pointY - centerY)
    return dx < halfWidth && dy < halfHeight
}
```

**TypeScript:**
```typescript
function aabbCollision(
  pointX: number, pointY: number,
  centerX: number, centerY: number,
  halfWidth: number, halfHeight: number
): boolean {
  const dx = Math.abs(pointX - centerX);
  const dy = Math.abs(pointY - centerY);
  return dx < halfWidth && dy < halfHeight;
}
```

### Damage Application

When a hit is confirmed, damage is applied to the victim's health.

**Why stop health regeneration on damage?**
- Creates risk/reward for aggressive play
- Prevents "poke and regen" strategies
- Forces commitment to engagements

**Pseudocode:**
```
function applyDamage(victim, damage, attackerID):
    victim.health = victim.health - damage
    if victim.health < 0:
        victim.health = 0

    victim.lastDamageTime = now()
    victim.isRegeneratingHealth = false

    broadcast player:damaged { victimId, attackerId, damage, newHealth }
    send hit:confirmed to attacker { victimId, damage }

    if victim.health <= 0:
        triggerDeath(victim, attackerID)
```

**Go:**
```go
func (p *PlayerState) TakeDamage(amount int) {
    p.mu.Lock()
    defer p.mu.Unlock()

    p.Health -= amount
    if p.Health < 0 {
        p.Health = 0
    }
    p.lastDamageTime = p.clock.Now()
    p.IsRegeneratingHealth = false
}
```

### Death Trigger

Death is triggered when a player's health reaches 0 or below. The death logic is **inline in `onHit`**, not a separate method.

**Pseudocode:**
```
// Inside onHit callback, after applying damage:
if victimState.Health <= 0:
    markPlayerDead(victimID)

    attacker = world.GetPlayer(attackerID)
    attacker.kills++
    attacker.xp += KILL_XP_REWARD  // 100 XP

    victim = world.GetPlayer(victimID)
    victim.deaths++

    broadcast player:death { victimId, attackerId }
    broadcast player:kill_credit { killerId, victimId, killerKills, killerXP }

    match.AddKill(attackerID)
    if match.CheckKillTarget():
        match.EndMatch("kill_target")
        broadcast match:ended
```

**Go (inline in onHit):**
```go
// Inside func (h *WebSocketHandler) onHit(hit game.HitEvent):
if victimState.Health <= 0 {
    h.gameServer.MarkPlayerDead(hit.VictimID)

    // Must use GetWorld().GetPlayer() to get pointer — GetPlayerState() returns a copy
    attacker, attackerExists := h.gameServer.GetWorld().GetPlayer(hit.AttackerID)
    if attackerExists && attacker != nil {
        attacker.IncrementKills()
        attacker.AddXP(game.KillXPReward)
    }
    victim, victimExists := h.gameServer.GetWorld().GetPlayer(hit.VictimID)
    if victimExists && victim != nil {
        victim.IncrementDeaths()
    }

    // Broadcast player:death
    deathData := map[string]interface{}{
        "victimId":   hit.VictimID,
        "attackerId": hit.AttackerID,
    }
    // ... marshal and room.Broadcast(deathBytes, "")

    // Broadcast player:kill_credit
    killCreditData := map[string]interface{}{
        "killerId":    hit.AttackerID,
        "victimId":    hit.VictimID,
        "killerKills": attacker.Kills,
        "killerXP":    attacker.XP,
    }
    // ... marshal and room.Broadcast(creditBytes, "")

    // Track kill in match and check win conditions
    room.Match.AddKill(hit.AttackerID)
    if room.Match.CheckKillTarget() {
        room.Match.EndMatch("kill_target")
        h.broadcastMatchEnded(room, h.gameServer.GetWorld())
    }
}
```

> **Note:** There is no separate `handleDeath` method. Death handling is inline in the `onHit` callback on `WebSocketHandler`. The `GetWorld().GetPlayer()` call is necessary to get a mutable pointer — `GetPlayerState()` returns a copy.

### Projectile Expiration

Projectiles are removed from the game when they expire or leave the arena.

**Why 1 second lifetime?**
- Matches max range at 800 px/s speed (800px / 800px/s = 1s)
- Prevents infinite projectiles on missed shots
- Limits server memory usage

**Pseudocode:**
```
function checkProjectileExpiration(projectile):
    // Check lifetime (1 second)
    if now() - projectile.createdAt >= PROJECTILE_MAX_LIFETIME:
        return true

    // Check arena bounds
    if projectile.position.x < 0 or projectile.position.x > ARENA_WIDTH:
        return true
    if projectile.position.y < 0 or projectile.position.y > ARENA_HEIGHT:
        return true

    return false
```

**Go:**
```go
func (p *Projectile) IsExpired() bool {
    return time.Since(p.CreatedAt) >= ProjectileMaxLifetime
}

func (p *Projectile) IsOutOfBounds() bool {
    return p.Position.X < 0 || p.Position.X > ArenaWidth ||
           p.Position.Y < 0 || p.Position.Y > ArenaHeight
}
```

### Invulnerability Check

Players can be invulnerable from two sources, and neither can be damaged.

**Spawn Protection (2 seconds)**
- Granted after respawn
- Prevents spawn camping
- Gives time to orient and move

**Dodge Roll I-Frames (first 200ms of roll)**
- Rewards skillful timing
- Creates counterplay to projectile spam
- Only covers first half of roll (400ms total)

**Pseudocode:**
```
function isInvulnerable(player):
    // Check spawn protection
    if player.isInvulnerable:
        return true

    // Check dodge roll i-frames
    if player.isRolling:
        rollElapsed = now() - player.rollStartTime
        if rollElapsed < DODGE_ROLL_INVINCIBILITY_DURATION:
            return true

    return false
```

**Go:**
```go
func (p *PlayerState) IsInvincibleFromRoll() bool {
    p.mu.RLock()
    defer p.mu.RUnlock()

    if !p.IsRolling {
        return false
    }

    elapsed := p.clock.Now().Sub(p.RollStartTime)
    return elapsed.Seconds() < DodgeRollInvincibilityDuration
}
```

---

### Hitscan Hit Detection (Pistol)

Hitscan weapons use ray-circle collision with lag compensation, processed in `gameserver.go:processHitscanShot()`.

**Why hitscan for Pistol?** The Pistol is configured as `isHitscan: true` in `weapon-configs.json`. Hitscan means the bullet hits instantly (no travel time), requiring a raycast from the shooter's position in the aim direction.

**Algorithm:**

```
function processHitscanShot(shooterID, aimAngle, clientTimestamp):
    // 1. Get shooter's RTT for lag compensation
    shooterRTT = getPlayerRTT(shooterID)  // via PingTracker

    // 2. Calculate rewind time (capped at 150ms)
    rewindDuration = min(shooterRTT, 150ms)
    queryTime = now() - rewindDuration

    // 3. Raycast against all alive players at REWOUND positions
    closestHit = nil
    closestDistance = infinity

    for each player (not shooter, alive):
        // NOTE: Hitscan does NOT check IsInvulnerable or IsInvincibleFromRoll(),
        // unlike projectile collision (physics.go:262-268). Invulnerable/rolling
        // players CAN be hit by hitscan weapons.

        // Get where victim WAS at queryTime
        victimPosition = positionHistory.GetPositionAt(playerID, queryTime)
        if not found: use current position as fallback

        // Ray-circle intersection
        if raycastHit(shooterPos, aimAngle, victimPosition, radius=16px, maxRange):
            if hitDistance < closestDistance:
                closestHit = player
                closestDistance = hitDistance

    // 4. Apply damage to closest hit
    if closestHit != nil:
        applyDamage(closestHit, weaponDamage, shooterID)
```

**Ray-circle intersection** (`raycastHit()`):
1. Project victim center onto ray direction vector
2. If projection is negative or beyond max range: miss
3. Calculate perpendicular distance from ray to victim center
4. If distance ≤ radius (PlayerWidth/2 = 16px): hit

**Why 150ms cap?** Prevents players with extremely high latency from "seeing the past" too far back. At 150ms, positions are at most 150ms stale — beyond that, the advantage becomes unfair to other players.

### Lag Compensation via Position History

The position history system records snapshots every physics tick and replays them for hit detection.

**Recording (every tick at 60Hz):**
```
function recordPositionSnapshots():
    for each player in world:
        positionHistory.RecordSnapshot(player.ID, player.Position, now())
```

Called in `gameserver.go` tick loop. Stores 60 snapshots per player (1 second of history).

**Querying (on hitscan shot):**
```
position = positionHistory.GetPositionAt(playerID, queryTime)
```

If queryTime falls between two recorded snapshots, the position is **linearly interpolated**:
```
t = (queryTime - before.timestamp) / (after.timestamp - before.timestamp)
position = before.position + t * (after.position - before.position)
```

**Why only 1 second of history?** RTT is capped at 150ms, so 1 second provides ample margin. Storing more would waste memory and never be queried.

See [server-architecture.md](server-architecture.md#lag-compensation-subsystem-epic-4) for the PositionHistory implementation details.

---

## Message Flow

### Hit Without Death

```
Server detects collision
    │
    ├─► Apply damage to victim
    │
    ├─► Broadcast "player:damaged" to room
    │   {victimId, attackerId, damage, newHealth, projectileId}
    │
    ├─► Send "hit:confirmed" to attacker only
    │   {victimId, damage, projectileId}
    │
    └─► Remove projectile from world
```

### Hit With Death

```
Server detects collision
    │
    ├─► Apply damage to victim (health → 0)
    │
    ├─► Broadcast "player:damaged" to room
    │
    ├─► Send "hit:confirmed" to attacker
    │
    ├─► Mark victim as dead
    │
    ├─► Increment victim deaths, attacker kills
    │
    ├─► Add 100 XP to attacker
    │
    ├─► Broadcast "player:death" to room
    │   {victimId, attackerId}
    │
    ├─► Broadcast "player:kill_credit" to room
    │   {killerId, victimId, killerKills, killerXP}
    │
    └─► Schedule respawn (3 seconds)
```

---

## Error Handling

### Projectile Not Found

**Trigger**: Hit event references non-existent projectile (race condition)
**Detection**: Projectile lookup returns nil
**Response**: Skip processing this hit, log warning
**Recovery**: No action needed, game continues

### Player Not Found

**Trigger**: Hit event references disconnected player
**Detection**: Player lookup returns nil
**Response**: Skip damage application
**Recovery**: Projectile still removed to prevent ghost hits

### Concurrent Modification

**Trigger**: Multiple goroutines access player state
**Detection**: Go race detector in tests
**Response**: All PlayerState access uses RWMutex
**Recovery**: Mutex ensures consistent state

### Hit After Death

**Trigger**: Projectile reaches player who just died
**Detection**: `IsAlive()` check returns false
**Response**: Hit rejected, no damage applied
**Recovery**: Projectile continues until expired/bounds

---

## Implementation Notes

### TypeScript (Client)

The client does NOT perform hit detection. It only:
1. Receives `player:damaged`, `hit:confirmed`, `player:death` messages
2. Updates local player health display
3. Plays hit effects (particles, screen shake)
4. Updates kill feed

```typescript
// In GameSceneEventHandlers.ts
handlePlayerDamaged(data: PlayerDamagedData) {
  const player = this.playerManager.getPlayer(data.victimId);
  if (player) {
    player.setHealth(data.newHealth);
    this.hitEffectManager.playHitEffect(player.x, player.y);
  }
}

handleHitConfirmed(data: HitConfirmedData) {
  // Play hitmarker sound/visual for local player
  this.audioManager.playHitmarker();
  this.ui.showHitmarker();
}

handlePlayerDeath(data: PlayerDeathData) {
  const victim = this.playerManager.getPlayer(data.victimId);
  if (victim) {
    victim.playDeathAnimation();
    this.killFeed.addEntry(data.attackerId, data.victimId);
  }
}
```

### Go (Server)

Hit detection is part of the game loop in `gameserver.go`:

```go
func (gs *GameServer) tick() {
    // 1. Process input
    gs.processAllInputs()

    // 2. Update physics (positions, projectiles)
    gs.updateAllPlayers()
    gs.world.Projectiles.UpdateAll(gs.getDeltaTime())

    // 3. Check collisions
    gs.checkHitDetection()  // ← Hit detection happens here

    // 4. Check game end conditions
    gs.checkMatchEnd()
}
```

**Performance considerations:**
- Projectile list is typically small (0-20 active)
- Player list capped at 8 per room
- O(projectiles × players) per tick = max 160 collision checks
- AABB is extremely fast (4 comparisons)

---

## Test Scenarios

### TS-HIT-001: Direct Hit on Player

**Category**: Unit
**Priority**: Critical

**Preconditions:**
- Player A at position (500, 500)
- Projectile at position (500, 500) owned by Player B

**Input:**
- Check collision between projectile and Player A

**Expected Output:**
- Collision returns true
- Damage applied to Player A
- Projectile removed

**TypeScript (Vitest):**
```typescript
it('should detect direct hit at same position', () => {
  const player = createPlayer({ x: 500, y: 500, health: 100 });
  const projectile = createProjectile({ x: 500, y: 500, ownerId: 'other' });

  const hit = checkCollision(projectile, player);

  expect(hit).toBe(true);
});
```

**Go:**
```go
func TestDirectHit(t *testing.T) {
    player := createPlayer(500, 500)
    projectile := createProjectile(500, 500, "other")

    physics := NewPhysics()
    hit := physics.CheckProjectilePlayerCollision(projectile, player)

    if !hit {
        t.Error("Expected direct hit to return true")
    }
}
```

### TS-HIT-002: Hit at Hitbox Edge

**Category**: Unit
**Priority**: High

**Preconditions:**
- Player at position (500, 500) with 32x64 hitbox
- Projectile at position (515, 530) (just inside right-bottom edge)

**Input:**
- Check collision

**Expected Output:**
- Collision returns true (15 < 16 width, 30 < 32 height)

**Go:**
```go
func TestHitAtEdge(t *testing.T) {
    player := createPlayer(500, 500)
    projectile := createProjectile(515, 530, "other") // Inside by 1px

    physics := NewPhysics()
    hit := physics.CheckProjectilePlayerCollision(projectile, player)

    if !hit {
        t.Error("Expected edge hit to return true")
    }
}
```

### TS-HIT-003: Miss Outside Hitbox

**Category**: Unit
**Priority**: High

**Preconditions:**
- Player at position (500, 500)
- Projectile at position (520, 500) (4px outside right edge)

**Input:**
- Check collision

**Expected Output:**
- Collision returns false (20 > 16 width)

**Go:**
```go
func TestMissOutsideHitbox(t *testing.T) {
    player := createPlayer(500, 500)
    projectile := createProjectile(520, 500, "other") // Outside by 4px

    physics := NewPhysics()
    hit := physics.CheckProjectilePlayerCollision(projectile, player)

    if hit {
        t.Error("Expected miss to return false")
    }
}
```

### TS-HIT-004: Cannot Hit Dead Player

**Category**: Unit
**Priority**: Critical

**Preconditions:**
- Dead player at position (500, 500)
- Projectile at same position

**Input:**
- Check collision

**Expected Output:**
- Collision returns false

**Go:**
```go
func TestCannotHitDeadPlayer(t *testing.T) {
    player := createPlayer(500, 500)
    player.Health = 0 // Dead
    projectile := createProjectile(500, 500, "other")

    physics := NewPhysics()
    hit := physics.CheckProjectilePlayerCollision(projectile, player)

    if hit {
        t.Error("Expected hit on dead player to return false")
    }
}
```

### TS-HIT-005: Cannot Hit Invulnerable Player

**Category**: Unit
**Priority**: Critical

**Preconditions:**
- Player with spawn protection at position (500, 500)
- Projectile at same position

**Input:**
- Check collision

**Expected Output:**
- Collision returns false

**Go:**
```go
func TestCannotHitInvulnerablePlayer(t *testing.T) {
    player := createPlayer(500, 500)
    player.IsInvulnerable = true // Spawn protection
    projectile := createProjectile(500, 500, "other")

    physics := NewPhysics()
    hit := physics.CheckProjectilePlayerCollision(projectile, player)

    if hit {
        t.Error("Expected hit on invulnerable player to return false")
    }
}
```

### TS-HIT-006: Cannot Hit Self

**Category**: Unit
**Priority**: Critical

**Preconditions:**
- Player "A" at position (500, 500)
- Projectile owned by "A" at same position

**Input:**
- Check collision

**Expected Output:**
- Collision returns false (owner immunity)

**Go:**
```go
func TestCannotHitSelf(t *testing.T) {
    player := createPlayer(500, 500)
    player.ID = "player-a"
    projectile := createProjectile(500, 500, "player-a") // Same owner

    physics := NewPhysics()
    hit := physics.CheckProjectilePlayerCollision(projectile, player)

    if hit {
        t.Error("Expected self-hit to return false")
    }
}
```

### TS-HIT-007: Projectile Expires After 1 Second

**Category**: Unit
**Priority**: High

**Preconditions:**
- Projectile created 1001ms ago

**Input:**
- Check if projectile is expired

**Expected Output:**
- Returns true (expired)

**Go:**
```go
func TestProjectileExpires(t *testing.T) {
    projectile := &Projectile{
        CreatedAt: time.Now().Add(-1001 * time.Millisecond),
    }

    if !projectile.IsExpired() {
        t.Error("Expected projectile to be expired after 1001ms")
    }
}
```

### TS-HIT-008: Projectile Outside Max Range Ignored

**Category**: Unit
**Priority**: High

**Preconditions:**
- Projectile spawned at (0, 500), current position (850, 500)
- Distance traveled = 850px > 800px max range
- Player at (850, 500)

**Input:**
- Check collision

**Expected Output:**
- Collision returns false (out of range)

**Go:**
```go
func TestProjectileOutOfRange(t *testing.T) {
    player := createPlayer(850, 500)
    projectile := &Projectile{
        Position:      Vector2{X: 850, Y: 500},
        SpawnPosition: Vector2{X: 0, Y: 500}, // 850px away
        OwnerID:       "other",
    }

    physics := NewPhysics()
    hit := physics.CheckProjectilePlayerCollision(projectile, player)

    if hit {
        t.Error("Expected out-of-range projectile to miss")
    }
}
```

### TS-HIT-009: Damage Reduces Health Correctly

**Category**: Unit
**Priority**: Critical

**Preconditions:**
- Player with 100 health
- Weapon damage = 25

**Input:**
- Apply damage

**Expected Output:**
- Health reduced to 75

**Go:**
```go
func TestDamageReducesHealth(t *testing.T) {
    player := createPlayer(500, 500)
    player.Health = 100

    player.TakeDamage(25)

    if player.Health != 75 {
        t.Errorf("Expected health 75, got %d", player.Health)
    }
}
```

### TS-HIT-010: Death Triggered at Zero Health

**Category**: Integration
**Priority**: Critical

**Preconditions:**
- Player with 25 health
- Weapon damage = 25

**Input:**
- Apply damage

**Expected Output:**
- Health = 0
- Player marked as dead
- `player:death` message broadcast

**Go:**
```go
func TestDeathAtZeroHealth(t *testing.T) {
    player := createPlayer(500, 500)
    player.Health = 25

    player.TakeDamage(25)

    if player.Health != 0 {
        t.Errorf("Expected health 0, got %d", player.Health)
    }
    if player.IsAlive() {
        t.Error("Expected player to be dead")
    }
}
```

### TS-HIT-011: Kill Awards XP and Increments Stats

**Category**: Integration
**Priority**: High

**Preconditions:**
- Attacker with 0 kills, 0 XP
- Victim with 0 deaths

**Input:**
- Trigger death

**Expected Output:**
- Attacker: kills = 1, xp = 100
- Victim: deaths = 1

### TS-HIT-012: Dodge Roll I-Frames Block Damage

**Category**: Unit
**Priority**: High

**Preconditions:**
- Player in dodge roll, 100ms elapsed (< 200ms i-frames)
- Projectile at player position

**Input:**
- Check collision

**Expected Output:**
- Collision returns false

**Go:**
```go
func TestDodgeRollIFrames(t *testing.T) {
    player := createPlayer(500, 500)
    player.IsRolling = true
    player.RollStartTime = time.Now().Add(-100 * time.Millisecond)

    projectile := createProjectile(500, 500, "other")

    physics := NewPhysics()
    hit := physics.CheckProjectilePlayerCollision(projectile, player)

    if hit {
        t.Error("Expected hit during i-frames to return false")
    }
}
```

### TS-HIT-013: No I-Frames After 200ms of Roll

**Category**: Unit
**Priority**: High

**Preconditions:**
- Player in dodge roll, 250ms elapsed (> 200ms i-frames)
- Projectile at player position

**Input:**
- Check collision

**Expected Output:**
- Collision returns true (i-frames expired)

### TS-HIT-014: Projectile Destroyed at Arena Boundary

**Category**: Unit
**Priority**: Medium

**Preconditions:**
- Projectile at position (-5, 500)

**Input:**
- Check if out of bounds

**Expected Output:**
- Returns true (outside arena)

**Go:**
```go
func TestProjectileOutOfBounds(t *testing.T) {
    projectile := &Projectile{
        Position: Vector2{X: -5, Y: 500},
    }

    if !projectile.IsOutOfBounds() {
        t.Error("Expected projectile to be out of bounds")
    }
}
```

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-02-02 | Initial specification |
| 1.1.0 | 2026-02-15 | Added Hitscan Hit Detection section (Pistol ray-circle collision). Added Lag Compensation via Position History section (RTT-based rewind, 150ms cap, linear interpolation). Updated overview to distinguish projectile vs hitscan collision modes. |
| 1.1.1 | 2026-02-16 | Fixed `checkHitDetection` code block — `onHit(hit)` takes HitEvent struct (not individual params), weapon damage via `gs.weaponStates` map (not `gs.world.GetPlayerWeapon`), projectiles via `gs.projectileManager` (not `gs.world.Projectiles`), players accessed directly under RLock. |
| 1.1.2 | 2026-02-16 | Fixed hitscan pseudocode — hitscan does NOT check `IsInvulnerable` or `IsInvincibleFromRoll()` (unlike projectile collision). Invulnerable/rolling players can be hit by hitscan. |
