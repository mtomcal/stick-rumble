# Player

> **Spec Version**: 1.2.0
> **Last Updated**: 2026-02-16
> **Depends On**: [constants.md](constants.md), [arena.md](arena.md)
> **Depended By**: [movement.md](movement.md), [dodge-roll.md](dodge-roll.md), [weapons.md](weapons.md), [shooting.md](shooting.md), [melee.md](melee.md), [hit-detection.md](hit-detection.md), [match.md](match.md), [graphics.md](graphics.md), [ui.md](ui.md)

---

## Overview

The Player is the core entity in Stick Rumble. Every human user controls exactly one player, and all gameplay systems (movement, combat, scoring) operate on player state. This specification defines the complete player data model, lifecycle (spawn → alive → death → respawn), health mechanics, and statistics tracking.

**Why server-authoritative player state?** All player state is owned by the server to prevent cheating. Clients render what the server tells them; they cannot modify health, position, or stats locally. Client-side prediction provides responsive controls, but server state is always authoritative.

**Why a unified PlayerState structure?** Having all player data in one structure simplifies synchronization. When the server broadcasts `player:move`, it includes the complete snapshot needed for rendering. This reduces message types and ensures consistency.

---

## Dependencies

### Technology Dependencies

| Technology | Version | Purpose |
|------------|---------|---------|
| Go | 1.25 | Server-side player state management |
| TypeScript | 5.9.3 | Client-side player rendering |
| Phaser 3 | 3.90.0 | Entity rendering and animation |

### Spec Dependencies

- [constants.md](constants.md) - Player dimensions, health values, timing constants
- [arena.md](arena.md) - Spawn positions, boundary clamping

---

## Constants

All player-related constants are defined in [constants.md](constants.md). Key values:

| Constant | Value | Unit | Description |
|----------|-------|------|-------------|
| PLAYER_WIDTH | 32 | px | Hitbox width |
| PLAYER_HEIGHT | 64 | px | Hitbox height |
| PLAYER_MAX_HEALTH | 100 | HP | Maximum health |
| HEALTH_REGEN_DELAY | 5.0 | s | Delay before regeneration starts |
| HEALTH_REGEN_RATE | 10.0 | HP/s | Regeneration speed |
| RESPAWN_DELAY | 3.0 | s | Time before respawn is allowed |
| SPAWN_INVULNERABILITY | 2.0 | s | Protection duration after respawn |
| KILL_XP_REWARD | 100 | XP | Experience awarded per kill |

---

## Data Structures

### PlayerState (Server)

The authoritative player state maintained by the server. All fields are synchronized to clients via WebSocket messages.

**Why these specific fields?** Each field serves a distinct purpose:
- **Identity**: `ID` uniquely identifies the player across all systems
- **Physics**: `Position`, `Velocity`, `AimAngle` drive movement and combat
- **Health**: `Health`, `IsInvulnerable`, `IsRegeneratingHealth` handle damage and recovery
- **Lifecycle**: `DeathTime` tracks death state for respawn timing
- **Statistics**: `Kills`, `Deaths`, `XP` track performance
- **Actions**: `Rolling` tracks evasion state

**Go:**
```go
type PlayerState struct {
    ID                     string     `json:"id"`
    Position               Vector2    `json:"position"`
    Velocity               Vector2    `json:"velocity"`
    AimAngle               float64    `json:"aimAngle"`            // radians
    Health                 int        `json:"health"`              // 0-100
    IsInvulnerable         bool       `json:"isInvulnerable"`
    InvulnerabilityEndTime time.Time  `json:"invulnerabilityEnd"`
    DeathTime              *time.Time `json:"deathTime,omitempty"` // nil if alive
    Kills                  int        `json:"kills"`
    Deaths                 int        `json:"deaths"`
    XP                     int        `json:"xp"`
    IsRegeneratingHealth   bool       `json:"isRegenerating"`
    Rolling                bool       `json:"isRolling"`
    // Private fields (not serialized)
    lastDamageTime         time.Time
    regenAccumulator       float64
    input                  InputState
    inputSequence          uint64           // [NEW] Last processed input sequence for prediction reconciliation
    rollState              RollState
    correctionStats        CorrectionStats  // [NEW] Anti-cheat movement validation stats
    clock                  Clock
    mu                     sync.RWMutex
}

// CorrectionStats tracks anti-cheat movement validation metrics per player
type CorrectionStats struct {
    TotalUpdates     int
    TotalCorrections int
    LastCorrectionAt time.Time
}

// GetCorrectionRate returns the ratio of corrections to total updates
func (cs *CorrectionStats) GetCorrectionRate() float64
```

### PlayerState (Client)

Client-side representation received from server broadcasts. Subset of server state needed for rendering.

**TypeScript:**
```typescript
interface PlayerState {
  id: string;
  position: {
    x: number;
    y: number;
  };
  velocity: {
    x: number;
    y: number;
  };
  aimAngle?: number;         // radians
  deathTime?: number;        // ms since epoch, undefined if alive
  health?: number;           // 0-100
  isRegenerating?: boolean;
  isRolling?: boolean;
}
```

### InputState

Player input captured from keyboard/mouse, sent to server at 20 Hz.

**Why InputState structure?** Bundling all inputs into a single message reduces network overhead. Sending individual key events would create excessive traffic.

**TypeScript:**
```typescript
interface InputState {
  up: boolean;          // W key
  down: boolean;        // S key
  left: boolean;        // A key
  right: boolean;       // D key
  aimAngle: number;     // radians (mouse direction)
  isSprinting: boolean; // Shift key
}
```

**Go:**
```go
type InputState struct {
    Up          bool    `json:"up"`
    Down        bool    `json:"down"`
    Left        bool    `json:"left"`
    Right       bool    `json:"right"`
    AimAngle    float64 `json:"aimAngle"`
    IsSprinting bool    `json:"isSprinting"`
}
```

### RollState

Dodge roll tracking. Managed internally, not directly exposed to clients.

**Go:**
```go
type RollState struct {
    IsRolling     bool      `json:"isRolling"`
    RollStartTime time.Time `json:"rollStartTime"`
    LastRollTime  time.Time `json:"lastRollTime"`   // for cooldown
    RollDirection Vector2   `json:"rollDirection"`  // normalized
}
```

---

## Behavior

### Player Initialization

When a player connects, they receive a fresh PlayerState with default values.

**Why spawn at arena center?** For the first player in a room, center is the safest position. Subsequent spawns use balanced spawning (see [arena.md](arena.md)).

**Pseudocode:**
```
function createPlayer(playerId):
    return PlayerState {
        ID: playerId,
        Position: (ARENA_WIDTH / 2, ARENA_HEIGHT / 2),  // (960, 540)
        Velocity: (0, 0),
        Health: PLAYER_MAX_HEALTH,  // 100
        AimAngle: 0,
        IsInvulnerable: false,
        DeathTime: null,  // alive
        Kills: 0,
        Deaths: 0,
        XP: 0,
        IsRegeneratingHealth: false,
        Rolling: false,
        lastDamageTime: now()  // prevents immediate regen
    }
```

**Go:**
```go
func NewPlayerState(id string) *PlayerState {
    return &PlayerState{
        ID: id,
        Position: Vector2{
            X: ArenaWidth / 2,
            Y: ArenaHeight / 2,
        },
        Velocity:       Vector2{X: 0, Y: 0},
        Health:         PlayerMaxHealth,
        clock:          &RealClock{},
        lastDamageTime: time.Now(),
    }
}
```

**TypeScript:**
```typescript
function createLocalPlayer(id: string): PlayerState {
  return {
    id,
    position: { x: ARENA.WIDTH / 2, y: ARENA.HEIGHT / 2 },
    velocity: { x: 0, y: 0 },
    health: PLAYER.MAX_HEALTH,
  };
}
```

---

## Health System

### Overview

The health system manages player survivability through damage, death, and regeneration. Health is an integer from 0 to 100.

**Why integer health?** Integer math is deterministic across platforms. Floating-point health could cause subtle desync between client prediction and server authority.

### Taking Damage

When a projectile or melee attack hits a player, damage is applied server-side.

**Why reset regeneration on damage?** This creates meaningful combat decisions. Players cannot tank damage while passively healing; they must disengage to recover.

**Visual Feedback on Damage:**
- **Blood particles** spawn (5 particles, dark red, spray from impact angle) — see [graphics.md § Blood Particles](graphics.md#blood-particles)
- **Camera flash** (100ms red) on receiving damage — see [ui.md § Damage Flash](ui.md#damage-flash)
- **Directional hit indicator** shows damage source direction — see [graphics.md § Directional Hit Indicators](graphics.md#directional-hit-indicators)

**Pseudocode:**
```
function takeDamage(player, amount):
    player.health -= amount
    if player.health < 0:
        player.health = 0

    player.lastDamageTime = now()
    player.isRegeneratingHealth = false
    player.regenAccumulator = 0.0  // clear fractional HP
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
    p.regenAccumulator = 0.0
}
```

### Health Regeneration

After not taking damage for 5 seconds, health regenerates at 10 HP/second.

**Why 5 second delay?** Creates risk/reward: Players must fully disengage from combat to heal. Shorter delays would make hit-and-run too powerful; longer delays would feel punishing.

**Why 10 HP/second?** Full heal (0→100) takes 10 seconds. Fast enough to matter between fights, slow enough that damaged players are vulnerable if re-engaged.

**Why use a fractional accumulator?** At 60 Hz tick rate, `10 HP/s * 0.0167s ≈ 0.167 HP` per tick. Without accumulation, rounding would lose HP. The accumulator ensures precise regeneration.

**Pseudocode:**
```
function applyRegeneration(player, now, deltaTime):
    // Cannot regenerate if dead or at full health
    if player.deathTime != null OR player.health >= MAX_HEALTH:
        player.isRegeneratingHealth = false
        return

    // Check if delay has passed
    timeSinceLastDamage = now - player.lastDamageTime
    if timeSinceLastDamage < HEALTH_REGEN_DELAY:  // 5 seconds
        player.isRegeneratingHealth = false
        return

    // Accumulate fractional HP
    player.regenAccumulator += HEALTH_REGEN_RATE * deltaTime  // 10 * dt

    // Apply full HP points
    if player.regenAccumulator >= 1.0:
        regenAmount = floor(player.regenAccumulator)
        player.health += regenAmount
        player.regenAccumulator -= regenAmount

    // Cap at max
    if player.health >= MAX_HEALTH:
        player.health = MAX_HEALTH
        player.regenAccumulator = 0.0

    player.isRegeneratingHealth = (player.health < MAX_HEALTH)
```

**Go:**
```go
func (p *PlayerState) ApplyRegeneration(now time.Time, deltaTime float64) {
    p.mu.Lock()
    defer p.mu.Unlock()

    if p.DeathTime != nil || p.Health >= PlayerMaxHealth {
        p.IsRegeneratingHealth = false
        return
    }

    timeSinceLastDamage := now.Sub(p.lastDamageTime).Seconds()
    if timeSinceLastDamage < HealthRegenerationDelay {
        p.IsRegeneratingHealth = false
        return
    }

    p.regenAccumulator += HealthRegenerationRate * deltaTime

    if p.regenAccumulator >= 1.0 {
        regenAmount := int(p.regenAccumulator)
        p.Health += regenAmount
        p.regenAccumulator -= float64(regenAmount)
    }

    if p.Health >= PlayerMaxHealth {
        p.Health = PlayerMaxHealth
        p.regenAccumulator = 0.0
    }

    p.IsRegeneratingHealth = p.Health < PlayerMaxHealth
}
```

### Regeneration Timeline Example

```
Time    Event                           Health    Regen?
0.0s    Player takes 50 damage          50 HP     No
1.0s    (waiting)                       50 HP     No
3.0s    (waiting)                       50 HP     No
5.0s    Regen delay passed              50 HP     Yes (starts)
6.0s    +10 HP regenerated              60 HP     Yes
7.0s    +10 HP regenerated              70 HP     Yes
7.5s    Player takes 20 damage          50 HP     No (reset)
12.5s   Regen delay passed again        50 HP     Yes (restarts)
```

---

## Death System

### Death Trigger

A player dies when their health reaches 0.

**Why health ≤ 0 check?** Overkill damage should still trigger death. If a 100-damage shotgun hits a 25 HP player, they die (not negative health).

**Pseudocode:**
```
function checkDeath(player, attackerId):
    if player.health <= 0 AND player.deathTime == null:
        markDead(player)
        incrementDeaths(player)

        attacker = getPlayer(attackerId)
        incrementKills(attacker)
        addXP(attacker, KILL_XP_REWARD)  // 100 XP

        broadcast player:death { victimId: player.id, attackerId }
        send player:kill_credit to attacker
```

**Go:**
```go
func (p *PlayerState) MarkDead() {
    p.mu.Lock()
    defer p.mu.Unlock()
    now := p.clock.Now()
    p.DeathTime = &now
    p.Health = 0
}

func (p *PlayerState) IsDead() bool {
    p.mu.RLock()
    defer p.mu.RUnlock()
    return p.DeathTime != nil
}
```

### Alive Check

Used to determine if a player can take damage, shoot, or be hit.

**Go:**
```go
func (p *PlayerState) IsAlive() bool {
    p.mu.RLock()
    defer p.mu.RUnlock()
    return p.Health > 0
}
```

**TypeScript:**
```typescript
function isAlive(player: PlayerState): boolean {
  return player.deathTime === undefined && (player.health ?? 100) > 0;
}
```

---

## Respawn System

### Respawn Timing

Players must wait 3 seconds after death before respawning.

**Why 3 seconds?** Long enough to feel the death and see who killed you; short enough to stay engaged. Shorter respawns (1-2s) trivialize death; longer (5s+) feel punishing in a fast-paced game.

**Pseudocode:**
```
function canRespawn(player):
    if player.deathTime == null:
        return false
    return (now() - player.deathTime) >= RESPAWN_DELAY  // 3 seconds
```

**Go:**
```go
func (p *PlayerState) CanRespawn() bool {
    p.mu.RLock()
    defer p.mu.RUnlock()
    if p.DeathTime == nil {
        return false
    }
    return p.clock.Since(*p.DeathTime).Seconds() >= RespawnDelay
}
```

### Respawn State Reset

When respawning, all combat state is reset.

**Why reset to full health?** Players need a fighting chance. Spawning at low health would create frustrating death chains.

**Why reset weapon to pistol?** Prevents weapon hoarding. Players must re-earn powerful weapons each life, creating map control objectives.

**Why spawn invulnerability?** Prevents spawn camping. 2 seconds is enough to orient and start moving, but not enough to gain significant advantage.

**Pseudocode:**
```
function respawn(player, spawnPosition):
    player.health = PLAYER_MAX_HEALTH        // 100
    player.position = spawnPosition          // balanced spawn
    player.velocity = (0, 0)                 // stopped
    player.deathTime = null                  // mark alive
    player.isInvulnerable = true
    player.invulnerabilityEndTime = now() + SPAWN_INVULNERABILITY  // 2s
    player.regenAccumulator = 0.0
    player.lastDamageTime = now()            // prevent immediate regen

    // Reset weapon to pistol
    weaponStates[player.id] = newPistolState()
```

**Go:**
```go
func (p *PlayerState) Respawn(spawnPos Vector2) {
    p.mu.Lock()
    defer p.mu.Unlock()
    p.Health = PlayerMaxHealth
    p.Position = spawnPos
    p.Velocity = Vector2{X: 0, Y: 0}
    p.DeathTime = nil
    p.IsInvulnerable = true
    p.InvulnerabilityEndTime = p.clock.Now().Add(
        time.Duration(SpawnInvulnerabilityDuration * float64(time.Second)))
    p.regenAccumulator = 0.0
    p.lastDamageTime = p.clock.Now()
}
```

### Invulnerability Management

Spawn protection expires automatically after 2 seconds.

**Pseudocode:**
```
function updateInvulnerability(player):
    if player.isInvulnerable AND now() > player.invulnerabilityEndTime:
        player.isInvulnerable = false
```

**Go:**
```go
func (p *PlayerState) UpdateInvulnerability() {
    p.mu.Lock()
    defer p.mu.Unlock()
    if p.IsInvulnerable && p.clock.Now().After(p.InvulnerabilityEndTime) {
        p.IsInvulnerable = false
    }
}
```

### Respawn Timeline Example

```
Time    Event                               State
0.0s    Player killed                       Dead, DeathTime = 0.0s
0.5s    (waiting)                           Dead
1.5s    (waiting)                           Dead
3.0s    Respawn delay passed                Eligible for respawn
3.0s    Respawn triggered                   Alive, Invulnerable, 100 HP
3.5s    (protected)                         Alive, Invulnerable
5.0s    Invulnerability expires             Alive, Vulnerable
```

---

## Statistics Tracking

### Kill Tracking

Kills increment when the player eliminates an enemy.

**Go:**
```go
func (p *PlayerState) IncrementKills() {
    p.mu.Lock()
    defer p.mu.Unlock()
    p.Kills++
}
```

### Death Tracking

Deaths increment when the player is killed.

**Go:**
```go
func (p *PlayerState) IncrementDeaths() {
    p.mu.Lock()
    defer p.mu.Unlock()
    p.Deaths++
}
```

### XP System

XP is awarded for kills. 100 XP per kill.

**Why 100 XP per kill?** Round number for easy mental math. 20 kills = 2000 XP per match. Allows for future features like leveling or unlocks.

**Go:**
```go
func (p *PlayerState) AddXP(amount int) {
    p.mu.Lock()
    defer p.mu.Unlock()
    p.XP += amount
}
```

### Kill/Death Ratio

Helper function for statistics display.

**Go:**
```go
func (p *PlayerState) GetKDRatio() float64 {
    p.mu.RLock()
    defer p.mu.RUnlock()
    if p.Deaths == 0 {
        return float64(p.Kills)  // avoid division by zero
    }
    return float64(p.Kills) / float64(p.Deaths)
}
```

**TypeScript:**
```typescript
function getKDRatio(kills: number, deaths: number): number {
  if (deaths === 0) return kills;
  return kills / deaths;
}
```

---

## Error Handling

### Invalid Damage Amount

**Trigger**: Negative damage passed to TakeDamage
**Detection**: Check `amount < 0`
**Response**: Treat as 0 damage (no healing through damage)
**Why**: Prevents exploit where negative damage heals

### Duplicate Death

**Trigger**: MarkDead called on already-dead player
**Detection**: Check `DeathTime != nil`
**Response**: No-op (idempotent operation)
**Why**: Prevents double-counting deaths in race conditions

### Respawn Before Delay

**Trigger**: Respawn called before 3 seconds elapsed
**Detection**: CanRespawn returns false
**Response**: Skip respawn, player remains dead
**Why**: Enforces death penalty timing

### Invalid Player ID

**Trigger**: Operation on non-existent player ID
**Detection**: Player not found in world state
**Response**: Log warning, skip operation
**Why**: Handles disconnection race conditions

---

## Implementation Notes

### TypeScript (Client)

1. **Local Player State**: Client maintains predicted position for responsive controls. Server corrections snap or interpolate.

2. **Remote Player Interpolation**: Other players are rendered by interpolating between server updates (50ms apart).

3. **Health Bar Rendering**: Display health as bar above player head. Color gradient from green (100%) to red (0%).

4. **Death State Rendering**: Dead players fade out or show death animation. Do not render hitbox.

   > **Death Visual**: When a player dies, their stick figure is replaced by a splayed corpse graphic (4 limbs at ±0.5 and ±2.5 radians from rotation, gray head offset 25px along rotation axis). The corpse remains visible for 5 seconds then fades over 2 seconds. See [graphics.md § Death Corpse Rendering](graphics.md#death-corpse-rendering) for full visual specification and [constants.md § Death Corpse Constants](constants.md#death-corpse-constants) for values.

5. **Invulnerability Visual**: Show blinking or shield effect during 2-second invulnerability.

### Go (Server)

1. **Thread Safety**: All PlayerState methods use `sync.RWMutex`. Read operations use `RLock()`, write operations use `Lock()`.

2. **Clock Injection**: `Clock` interface allows deterministic testing. Production uses `RealClock`, tests use `MockClock`.

3. **Game Loop Integration**: Player state is updated each tick (60 Hz):
   - Apply input to velocity
   - Update position
   - Apply regeneration
   - Check invulnerability expiration
   - Check respawn eligibility

4. **Broadcast Frequency**: Player state is broadcast at 20 Hz (every 3rd tick). This includes position, velocity, health, and flags.

---

## Test Scenarios

### TS-PLAYER-001: Player takes damage correctly

**Category**: Unit
**Priority**: Critical

**Preconditions:**
- Player at 100 HP

**Input:**
- TakeDamage(25)

**Expected Output:**
- Player health = 75
- IsRegeneratingHealth = false

**TypeScript (Vitest):**
```typescript
it('should reduce health when taking damage', () => {
  const player = createPlayer('test-id');
  player.health = 100;
  takeDamage(player, 25);
  expect(player.health).toBe(75);
});
```

**Go:**
```go
func TestTakeDamage(t *testing.T) {
    player := NewPlayerState("test-id")
    player.TakeDamage(25)
    assert.Equal(t, 75, player.Health)
}
```

### TS-PLAYER-002: Player dies at 0 health

**Category**: Unit
**Priority**: Critical

**Preconditions:**
- Player at 25 HP

**Input:**
- TakeDamage(25)

**Expected Output:**
- Player health = 0
- IsAlive() = false

**Go:**
```go
func TestPlayerDiesAtZeroHealth(t *testing.T) {
    player := NewPlayerState("test-id")
    player.Health = 25
    player.TakeDamage(25)
    assert.Equal(t, 0, player.Health)
    assert.False(t, player.IsAlive())
}
```

### TS-PLAYER-003: Player respawns after 3 seconds

**Category**: Integration
**Priority**: Critical

**Preconditions:**
- Player marked dead at time T

**Input:**
- Check CanRespawn at T+2.9s
- Check CanRespawn at T+3.0s

**Expected Output:**
- T+2.9s: CanRespawn = false
- T+3.0s: CanRespawn = true

**Go:**
```go
func TestRespawnDelayTiming(t *testing.T) {
    clock := &MockClock{now: time.Now()}
    player := NewPlayerStateWithClock("test-id", clock)
    player.MarkDead()

    clock.Advance(2900 * time.Millisecond)
    assert.False(t, player.CanRespawn())

    clock.Advance(100 * time.Millisecond)
    assert.True(t, player.CanRespawn())
}
```

### TS-PLAYER-004: Player is invulnerable for 2 seconds after respawn

**Category**: Integration
**Priority**: High

**Preconditions:**
- Player respawned at time T

**Input:**
- Check IsInvulnerable at T+1.9s
- Check IsInvulnerable at T+2.1s (after UpdateInvulnerability)

**Expected Output:**
- T+1.9s: IsInvulnerable = true
- T+2.1s: IsInvulnerable = false

### TS-PLAYER-005: Health regeneration starts after 5 seconds

**Category**: Integration
**Priority**: High

**Preconditions:**
- Player at 50 HP
- Last damage at time T

**Input:**
- ApplyRegeneration at T+4.9s
- ApplyRegeneration at T+5.1s

**Expected Output:**
- T+4.9s: IsRegeneratingHealth = false, Health = 50
- T+5.1s: IsRegeneratingHealth = true

### TS-PLAYER-006: Health regenerates at 10 HP/s

**Category**: Unit
**Priority**: High

**Preconditions:**
- Player at 50 HP
- Regeneration active

**Input:**
- ApplyRegeneration for 1 second (deltaTime = 1.0)

**Expected Output:**
- Player health = 60

**Go:**
```go
func TestHealthRegenRate(t *testing.T) {
    clock := &MockClock{now: time.Now()}
    player := NewPlayerStateWithClock("test-id", clock)
    player.Health = 50
    player.lastDamageTime = clock.Now().Add(-6 * time.Second)

    player.ApplyRegeneration(clock.Now(), 1.0)
    assert.Equal(t, 60, player.Health)
}
```

### TS-PLAYER-007: Damage interrupts health regeneration

**Category**: Unit
**Priority**: High

**Preconditions:**
- Player regenerating health

**Input:**
- TakeDamage(10)

**Expected Output:**
- IsRegeneratingHealth = false
- lastDamageTime = now

### TS-PLAYER-008: Kill increments attacker's kill count

**Category**: Unit
**Priority**: High

**Preconditions:**
- Attacker with 5 kills

**Input:**
- IncrementKills()

**Expected Output:**
- Attacker kills = 6

### TS-PLAYER-009: Death increments victim's death count

**Category**: Unit
**Priority**: High

**Preconditions:**
- Victim with 3 deaths

**Input:**
- IncrementDeaths()

**Expected Output:**
- Victim deaths = 4

### TS-PLAYER-010: XP awarded on kill (100 XP)

**Category**: Unit
**Priority**: Medium

**Preconditions:**
- Attacker with 500 XP

**Input:**
- AddXP(KILL_XP_REWARD) // 100

**Expected Output:**
- Attacker XP = 600

### TS-PLAYER-011: Invulnerable player takes no damage

**Category**: Unit
**Priority**: High

**Preconditions:**
- Player at 100 HP
- IsInvulnerable = true

**Input:**
- Attempt to apply 50 damage (should be blocked by caller)

**Expected Output:**
- Player health = 100 (damage not applied)

**Note:** Invulnerability check happens in damage application logic, not in TakeDamage itself.

### TS-PLAYER-012: Overkill damage caps at 0 health

**Category**: Unit
**Priority**: Medium

**Preconditions:**
- Player at 25 HP

**Input:**
- TakeDamage(100)

**Expected Output:**
- Player health = 0 (not negative)

**Go:**
```go
func TestOverkillDamage(t *testing.T) {
    player := NewPlayerState("test-id")
    player.Health = 25
    player.TakeDamage(100)
    assert.Equal(t, 0, player.Health)
}
```

### TS-PLAYER-013: Respawn resets all combat state

**Category**: Integration
**Priority**: High

**Preconditions:**
- Dead player with:
  - Health = 0
  - Position = (100, 100)
  - Velocity = (50, 50)

**Input:**
- Respawn at (500, 500)

**Expected Output:**
- Health = 100
- Position = (500, 500)
- Velocity = (0, 0)
- DeathTime = nil
- IsInvulnerable = true
- IsRegeneratingHealth = false

### TS-PLAYER-014: Regeneration accumulator handles fractional HP

**Category**: Unit
**Priority**: Medium

**Preconditions:**
- Player at 50 HP
- Regeneration active

**Input:**
- ApplyRegeneration 6 times with deltaTime = 0.0167 (60 Hz)

**Expected Output:**
- After 6 ticks (0.1s): accumulator ≈ 1.0, health = 51
- Fractional HP preserved across ticks

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-02-02 | Initial specification extracted from codebase |
| 1.1.0 | 2026-02-15 | Added `inputSequence` field for prediction reconciliation. Added `CorrectionStats` struct for anti-cheat movement validation tracking. |
| 1.2.0 | 2026-02-16 | Added cross-references to new death corpse rendering, blood particles, camera flash, and directional hit indicators from pre-BMM visual port. |
