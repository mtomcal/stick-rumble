# Dodge Roll

> **Spec Version**: 1.0.0
> **Last Updated**: 2026-02-02
> **Depends On**: [constants.md](constants.md), [player.md](player.md), [movement.md](movement.md), [arena.md](arena.md), [messages.md](messages.md)
> **Depended By**: [hit-detection.md](hit-detection.md), [graphics.md](graphics.md), [ui.md](ui.md)

---

## Overview

The dodge roll is an evasion mechanic that allows players to quickly reposition while briefly becoming invincible. It serves as the primary defensive ability in combat, enabling skilled players to avoid damage through timing and positioning.

**Why dodge roll exists:**
1. **Skill Expression**: Creates a learnable defensive skill that rewards practice and timing
2. **Combat Depth**: Adds a counterplay option against ranged weapons - dodging becomes as important as aiming
3. **Movement Variety**: Provides a burst movement option distinct from sprinting
4. **Engagement Risk/Reward**: Aggressive players can close distance, but cooldown punishes reckless use

The dodge roll system is fully server-authoritative - the client sends a request, and the server validates whether the roll can occur, tracks the roll state, and broadcasts updates to all players.

---

## Dependencies

### Technology Dependencies

| Technology | Version | Purpose |
|------------|---------|---------|
| Go | 1.25 | Server-side roll state machine and physics |
| TypeScript | 5.9.3 | Client-side input handling and visual effects |
| Phaser | 3.90.0 | Roll animation and cooldown UI rendering |
| gorilla/websocket | v1.5.3 | roll:start and roll:end message transport |

### Spec Dependencies

- [constants.md](constants.md) - Roll duration, velocity, cooldown, and i-frame timing values
- [player.md](player.md) - PlayerState.isRolling field and death state checking
- [movement.md](movement.md) - Roll velocity overrides normal movement physics
- [arena.md](arena.md) - Boundary collision terminates roll early
- [messages.md](messages.md) - player:dodge_roll, roll:start, roll:end message schemas

---

## Constants

All dodge roll constants are defined in [constants.md](constants.md). Key values:

| Constant | Value | Unit | Description |
|----------|-------|------|-------------|
| DODGE_ROLL_DURATION | 0.4 | seconds | Total time the roll animation plays |
| DODGE_ROLL_DISTANCE | 100 | pixels | Total distance traveled during roll |
| DODGE_ROLL_VELOCITY | 250 | px/s | Fixed velocity during roll (100 / 0.4) |
| DODGE_ROLL_COOLDOWN | 3.0 | seconds | Time before another roll can be initiated |
| DODGE_ROLL_INVINCIBILITY_DURATION | 0.2 | seconds | Duration of invincibility frames (i-frames) |

**Why these specific values:**

- **0.4s duration**: Short enough to feel responsive, long enough to visually read. Testing showed faster rolls felt "instant" and harder to track.
- **100px distance**: Approximately 3x player width (32px), allowing significant repositioning without crossing the arena.
- **250 px/s velocity**: Calculated from distance/duration. Faster than sprint (300 px/s) makes roll feel like a burst move.
- **3s cooldown**: Long enough to prevent roll-spam invalidating gunplay, short enough to allow multiple rolls per engagement.
- **0.2s i-frames**: First half of the roll. Rewards early dodge timing; late in the roll you're vulnerable, punishing panic rolls.

---

## Data Structures

### RollState (Server)

Tracks the current state of a player's dodge roll on the server.

**Go:**
```go
type RollState struct {
    IsRolling     bool      `json:"isRolling"`     // Whether player is currently rolling
    RollStartTime time.Time `json:"rollStartTime"` // When the current roll started
    LastRollTime  time.Time `json:"lastRollTime"`  // When the last roll finished (for cooldown)
    RollDirection Vector2   `json:"rollDirection"` // Direction vector of the roll (normalized)
}
```

**Why this structure:**
- `IsRolling`: Boolean flag for quick state checks in physics and collision code
- `RollStartTime`: Required to calculate i-frame window (first 0.2s) and roll completion (0.4s)
- `LastRollTime`: Required to enforce 3s cooldown between rolls
- `RollDirection`: Normalized vector set at roll start, determines fixed trajectory

### PlayerState Extensions

The PlayerState has roll-related fields:

**Go:**
```go
type PlayerState struct {
    // ... other fields ...
    Rolling   bool      `json:"isRolling"` // Public field for JSON export
    rollState RollState // Private field: detailed roll state
}
```

**TypeScript:**
```typescript
interface PlayerState {
  // ... other fields ...
  isRolling?: boolean; // Whether player is currently dodge rolling
}
```

**Why separate public/private fields:**
- `Rolling` (public): Exported in `player:move` messages so clients know when to render roll visuals
- `rollState` (private): Internal state machine details not needed by clients

### DodgeRollManager (Client)

Client-side state tracking for roll cooldown UI and input validation.

**TypeScript:**
```typescript
class DodgeRollManager {
  private _isRolling: boolean = false;
  private rollStartTime: number = 0;
  private lastRollTime: number = 0;

  private readonly INVINCIBILITY_DURATION_MS = 200; // 0.2 seconds
  private readonly COOLDOWN_MS = 3000;              // 3 seconds
}
```

**Why client-side tracking:**
- Enables immediate cooldown UI feedback without waiting for server round-trip
- Allows client to suppress redundant roll requests (server still validates)
- Mirrors server constants for consistent behavior

---

## Behavior

### Roll State Machine

The dodge roll follows a simple state machine:

```
                   ┌──────────────────────────────┐
                   │                              │
                   v                              │
    ┌──────────────────────┐                      │
    │        READY         │                      │
    │  (Can initiate roll) │                      │
    └──────────┬───────────┘                      │
               │                                  │
               │ player:dodge_roll                │
               │ (if canRoll = true)              │
               v                                  │
    ┌──────────────────────┐                      │
    │       ROLLING        │                      │
    │ velocity = 250 px/s  │                      │
    │ i-frames: 0-200ms    │                      │
    └──────────┬───────────┘                      │
               │                                  │
               │ 400ms elapsed OR wall collision  │
               v                                  │
    ┌──────────────────────┐                      │
    │      COOLDOWN        │──────────────────────┘
    │   (3000ms waiting)   │     cooldown expired
    └──────────────────────┘
```

### Initiating a Roll

**Preconditions:**
1. Player is alive (`DeathTime == nil`)
2. Player is not already rolling (`IsRolling == false`)
3. Cooldown has expired (`now - LastRollTime >= 3.0s`)

**Pseudocode:**
```
function handleDodgeRollRequest(player):
    if not player.canDodgeRoll():
        return  // Silently ignore invalid request

    direction = calculateRollDirection(player.input)
    player.startDodgeRoll(direction)
    broadcast roll:start { playerId, direction, rollStartTime }
```

**Go (Server):**
```go
// CanDodgeRoll checks if the player can initiate a dodge roll (thread-safe)
func (p *PlayerState) CanDodgeRoll() bool {
    p.mu.RLock()
    defer p.mu.RUnlock()

    // Cannot roll if dead
    if p.DeathTime != nil {
        return false
    }

    // Cannot roll if already rolling
    if p.rollState.IsRolling {
        return false
    }

    // Check cooldown
    now := p.clock.Now()
    timeSinceLastRoll := now.Sub(p.rollState.LastRollTime).Seconds()
    return timeSinceLastRoll >= DodgeRollCooldown
}

// StartDodgeRoll initiates a dodge roll in the given direction
func (p *PlayerState) StartDodgeRoll(direction Vector2) {
    p.mu.Lock()
    defer p.mu.Unlock()

    now := p.clock.Now()
    p.rollState.IsRolling = true
    p.rollState.RollStartTime = now
    p.rollState.RollDirection = direction
    p.Rolling = true // Update public field for JSON export
}
```

**TypeScript (Client Input):**
```typescript
// GameScene.ts - SPACE key handler
dodgeKey.on('down', () => {
  if (this.dodgeRollManager.canDodgeRoll()) {
    // Calculate direction from WASD or aim angle
    const direction = this.calculateRollDirection();

    // Send request to server
    this.wsClient.send({
      type: 'player:dodge_roll',
      timestamp: Date.now(),
      data: { direction }
    });
  }
});
```

### Roll Direction Calculation

The roll direction is determined at the moment the roll starts based on player input:

**Priority:**
1. If WASD keys are pressed → Roll in movement direction
2. If stationary → Roll in aim direction (where mouse is pointing)

**Pseudocode:**
```
function calculateRollDirection(input):
    direction = Vector2(0, 0)

    // Check WASD input
    if input.up:    direction.y -= 1
    if input.down:  direction.y += 1
    if input.left:  direction.x -= 1
    if input.right: direction.x += 1

    // If no movement input, use aim angle
    if direction == Vector2(0, 0):
        direction.x = cos(input.aimAngle)
        direction.y = sin(input.aimAngle)

    // Normalize to unit vector
    return normalize(direction)
```

**Go (Server):**
```go
// Determine roll direction based on input
input := playerState.GetInput()
direction := game.Vector2{X: 0, Y: 0}

// Use WASD keys if any are pressed
if input.Up || input.Down || input.Left || input.Right {
    if input.Up {
        direction.Y -= 1
    }
    if input.Down {
        direction.Y += 1
    }
    if input.Left {
        direction.X -= 1
    }
    if input.Right {
        direction.X += 1
    }
} else {
    // If stationary, roll in aim direction
    direction.X = math.Cos(input.AimAngle)
    direction.Y = math.Sin(input.AimAngle)
}

// Normalize direction
length := math.Sqrt(direction.X*direction.X + direction.Y*direction.Y)
if length > 0 {
    direction.X /= length
    direction.Y /= length
}
```

**Why WASD priority over aim:**
- Players naturally expect to roll in the direction they're trying to move
- "Dodge backward while shooting forward" is a common tactic
- Aim-direction fallback enables stationary dodges when surprised

### Roll Physics

During a roll, the player's velocity is fixed to the roll direction times roll velocity. Normal movement input is ignored.

**Pseudocode:**
```
function updatePlayerPhysics(player, deltaTime):
    if player.isRolling:
        // Override velocity with roll velocity
        velocity = player.rollDirection * DODGE_ROLL_VELOCITY
        player.velocity = velocity
    else:
        // Normal movement physics from movement.md
        ...

    // Update position
    newPosition = player.position + player.velocity * deltaTime

    // Clamp to arena bounds
    clampedPosition = clampToArena(newPosition)

    // Check for wall collision during roll
    if player.isRolling and clampedPosition != newPosition:
        player.endDodgeRoll()
        return "wall_collision"

    player.position = clampedPosition
```

**Go (Server):**
```go
// UpdatePlayer updates a player's physics state
// Returns true if a dodge roll was cancelled due to wall collision
func (p *Physics) UpdatePlayer(player *PlayerState, deltaTime float64) bool {
    rollCancelled := false

    if player.IsRolling() {
        rollState := player.GetRollState()
        // Set velocity to roll direction * roll velocity
        rollVel := Vector2{
            X: rollState.RollDirection.X * DodgeRollVelocity,
            Y: rollState.RollDirection.Y * DodgeRollVelocity,
        }
        player.SetVelocity(rollVel)
    } else {
        // Normal movement handling...
    }

    // Update position
    currentPos := player.GetPosition()
    currentVel := player.GetVelocity()
    newPos := Vector2{
        X: currentPos.X + currentVel.X*deltaTime,
        Y: currentPos.Y + currentVel.Y*deltaTime,
    }

    // Clamp to arena bounds
    clampedPos := clampToArena(newPos)

    // Check if position was clamped during a roll (wall collision)
    if player.IsRolling() && (clampedPos.X != newPos.X || clampedPos.Y != newPos.Y) {
        player.EndDodgeRoll()
        rollCancelled = true
    }

    player.SetPosition(clampedPos)
    return rollCancelled
}
```

**Why fixed velocity:**
- Predictable distance traveled (exactly 100px over 0.4s)
- Cannot "super roll" by combining with sprint
- Consistent timing for opponents to track

### Invincibility Frames (I-Frames)

The player is invincible for the first 0.2 seconds of the 0.4 second roll. During this window, projectiles pass through harmlessly.

**Pseudocode:**
```
function isInvincibleFromRoll(player):
    if not player.isRolling:
        return false

    timeSinceRollStart = now - player.rollStartTime
    return timeSinceRollStart < INVINCIBILITY_DURATION (0.2s)
```

**Go (Server):**
```go
// IsInvincibleFromRoll checks if the player is currently invincible from roll i-frames
func (p *PlayerState) IsInvincibleFromRoll() bool {
    p.mu.RLock()
    defer p.mu.RUnlock()

    if !p.rollState.IsRolling {
        return false
    }

    timeSinceRollStart := p.clock.Since(p.rollState.RollStartTime).Seconds()
    return timeSinceRollStart < DodgeRollInvincibilityDuration
}
```

**Integration with Hit Detection:**
```go
// CheckProjectilePlayerCollision in physics.go
func (p *Physics) CheckProjectilePlayerCollision(proj *Projectile, player *PlayerState) bool {
    // ... other checks ...

    // Don't check collision with rolling players during i-frames
    if player.IsInvincibleFromRoll() {
        return false
    }

    // ... AABB collision check ...
}
```

**Why 0.2s i-frames (first half of roll):**
- **Rewards anticipation**: You must dodge *before* the projectile hits, not react to getting hit
- **Punishes panic rolls**: Rolling too late (after 0.2s) leaves you vulnerable
- **Creates counterplay**: Attackers can time shots for the second half of the roll
- **Visual consistency**: The "spin" animation is most dramatic in the first half

### Roll Termination

A roll ends in one of two ways:

1. **Duration Complete** (normal): Roll lasts full 0.4 seconds
2. **Wall Collision** (early): Player hits arena boundary

**Pseudocode:**
```
// Server tick loop
function checkRollDuration():
    for each player in world:
        if player.isRolling:
            timeSinceRollStart = now - player.rollStartTime

            if timeSinceRollStart >= ROLL_DURATION (0.4s):
                player.endDodgeRoll()
                broadcast roll:end { playerId, reason: "completed" }
```

**Go (Server):**
```go
// checkRollDuration checks if any player's dodge roll should end
func (gs *GameServer) checkRollDuration() {
    gs.world.mu.RLock()
    players := make([]*PlayerState, 0, len(gs.world.players))
    for _, player := range gs.world.players {
        players = append(players, player)
    }
    gs.world.mu.RUnlock()

    now := gs.clock.Now()
    for _, player := range players {
        if player.IsRolling() {
            rollState := player.GetRollState()
            timeSinceRollStart := now.Sub(rollState.RollStartTime).Seconds()

            if timeSinceRollStart >= DodgeRollDuration {
                player.EndDodgeRoll()

                if gs.onRollEnd != nil {
                    gs.onRollEnd(player.ID, "completed")
                }
            }
        }
    }
}

// EndDodgeRoll ends the current dodge roll
func (p *PlayerState) EndDodgeRoll() {
    p.mu.Lock()
    defer p.mu.Unlock()

    p.rollState.IsRolling = false
    p.rollState.LastRollTime = p.clock.Now() // Start cooldown timer
    p.Rolling = false
}
```

**Wall collision handling** is in the physics update (see Roll Physics section above).

### Cooldown System

After a roll ends, the player must wait 3 seconds before rolling again.

**Client-side cooldown tracking** (for UI):
```typescript
class DodgeRollManager {
  canDodgeRoll(): boolean {
    if (this._isRolling) {
      return false;
    }

    // First roll is always allowed
    if (this.lastRollTime === 0) {
      return true;
    }

    const timeSinceLastRoll = Date.now() - this.lastRollTime;
    return timeSinceLastRoll >= this.COOLDOWN_MS;
  }

  getCooldownProgress(): number {
    if (this.lastRollTime === 0) {
      return 1.0; // Ready
    }

    const timeSinceLastRoll = Date.now() - this.lastRollTime;
    return Math.min(timeSinceLastRoll / this.COOLDOWN_MS, 1.0);
  }
}
```

**Why 3 second cooldown:**
- **Prevents roll-spam**: Without cooldown, skilled players could chain rolls indefinitely, making them nearly unhittable
- **Commitment cost**: Rolling is a decision with consequences; you can't immediately roll again if you dodge the wrong direction
- **Combat pacing**: Forces periods of vulnerability between defensive actions
- **Resource management**: Players must decide when to "spend" their roll vs save it

---

## WebSocket Messages

### Client → Server: player:dodge_roll

Sent when the player presses SPACE to request a dodge roll.

**Schema:**
```typescript
// No data payload - server uses current input state for direction
interface PlayerDodgeRollMessage {
  type: 'player:dodge_roll';
  timestamp: number;
}
```

**Why no direction in message:**
- Server already has the player's input state (WASD, aim angle)
- Prevents client from sending arbitrary directions (cheat prevention)
- Reduces message size

### Server → Client: roll:start

Broadcast to all players when a roll begins.

**Schema:**
```typescript
interface RollStartData {
  playerId: string;      // Player who started rolling
  direction: {           // Normalized roll direction
    x: number;
    y: number;
  };
  rollStartTime: number; // Server timestamp (ms since epoch)
}
```

**When sent:** Immediately when server validates and starts a roll

**Who receives:** All players in the room (including the roller)

**Client handling:**
```typescript
wsClient.on('roll:start', (data: RollStartData) => {
  if (data.playerId === this.localPlayerId) {
    this.dodgeRollManager.startRoll();
    this.audioManager?.playDodgeRollSound();
  }
  // PlayerManager will show roll animation based on player.isRolling
});
```

### Server → Client: roll:end

Broadcast to all players when a roll ends.

**Schema:**
```typescript
interface RollEndData {
  playerId: string; // Player who stopped rolling
  reason: string;   // "completed" or "wall_collision"
}
```

**When sent:** When roll duration expires OR wall collision occurs

**Who receives:** All players in the room

**Client handling:**
```typescript
wsClient.on('roll:end', (data: RollEndData) => {
  if (data.playerId === this.localPlayerId) {
    this.dodgeRollManager.endRoll();
  }
  // PlayerManager will clear roll animation based on player.isRolling
});
```

**Why include reason:**
- Allows different client feedback (sound, visual) for wall collision vs normal end
- Useful for debugging and replay analysis
- Future: Could affect animation (stumble on wall hit vs clean finish)

---

## Error Handling

### Invalid Roll Request

**Trigger**: Player sends `player:dodge_roll` when cannot roll
**Detection**: `CanDodgeRoll()` returns false
**Response**: Request silently ignored
**Client Notification**: None (client should have predicted this)
**Recovery**: Player must wait for cooldown or death/respawn

**Why silent ignore:**
- No error message needed - client tracks cooldown locally
- Prevents spam of error messages if player mashes SPACE
- Server is authoritative; client prediction may occasionally desync

### Player Not Found

**Trigger**: `player:dodge_roll` received for unknown player ID
**Detection**: `GetPlayer(playerID)` returns false
**Response**: Log warning, ignore request
**Client Notification**: None
**Recovery**: None needed - likely race condition during disconnect

### Wall Collision During Roll

**Trigger**: Roll movement would place player outside arena
**Detection**: `clampToArena(newPos) != newPos`
**Response**: End roll early, position clamped to boundary
**Client Notification**: `roll:end { reason: "wall_collision" }`
**Recovery**: Cooldown starts from early termination time

---

## Implementation Notes

### TypeScript (Client)

**Key Files:**
- `src/game/input/DodgeRollManager.ts` - Cooldown tracking, state management
- `src/game/ui/DodgeRollCooldownUI.ts` - Visual cooldown indicator
- `src/game/scenes/GameScene.ts` - SPACE key binding, direction calculation
- `src/game/scenes/GameSceneEventHandlers.ts` - roll:start, roll:end handlers
- `src/game/entities/PlayerManager.ts` - Roll visual effects (rotation, flicker)

**Input Binding:**
```typescript
// SPACE key triggers dodge roll
const dodgeKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
```

**Cooldown UI Pattern:**
- Fixed position: bottom-right corner of screen (50px from edge)
- Circular progress indicator fills clockwise
- Gray background → green fill as cooldown progresses
- Solid green when ready

**Visual Effects During Roll:**
- 360° rotation animation over 0.4s duration
- Flicker effect during i-frames (visible/invisible alternation at 100ms intervals)
- Smooth transition back to normal state on roll:end

### Go (Server)

**Key Files:**
- `internal/game/constants.go` - Roll constants (duration, velocity, cooldown, i-frames)
- `internal/game/player.go` - RollState struct, CanDodgeRoll, StartDodgeRoll, EndDodgeRoll, IsInvincibleFromRoll
- `internal/game/physics.go` - Roll velocity override, wall collision detection
- `internal/game/gameserver.go` - checkRollDuration in tick loop, onRollEnd callback
- `internal/network/message_processor.go` - handlePlayerDodgeRoll
- `internal/network/broadcast_helper.go` - broadcastRollStart, broadcastRollEnd

**Thread Safety:**
- All PlayerState roll methods use `sync.RWMutex`
- RLock for reads (CanDodgeRoll, IsRolling, IsInvincibleFromRoll)
- Lock for writes (StartDodgeRoll, EndDodgeRoll)

**Clock Injection:**
```go
// Player uses injectable clock for deterministic testing
type PlayerState struct {
    clock Clock // Injected; defaults to realClock
}

// Tests can inject mockClock to control time
func (p *PlayerState) SetClock(c Clock) {
    p.clock = c
}
```

**Callback Pattern:**
```go
// GameServer notifies network layer of roll events via callback
onRollEnd func(playerID string, reason string)

// Network layer sets callback during initialization
gameServer.SetOnRollEnd(func(playerID, reason string) {
    h.broadcastRollEnd(playerID, reason)
})
```

**Tick Integration:**
- `checkRollDuration()` called every tick (60 Hz)
- Wall collision detected in `UpdatePlayer()` during physics step
- Both can trigger roll end; `IsRolling` check prevents double-end

---

## Test Scenarios

### TS-ROLL-001: Roll Moves Player Correct Distance

**Category**: Unit
**Priority**: Critical

**Preconditions:**
- Player at position (500, 500)
- Player not on cooldown
- No walls in roll path

**Input:**
- `player:dodge_roll` with direction (1, 0) (rightward)
- Wait 400ms (roll duration)

**Expected Output:**
- Player position approximately (600, 500) (100px rightward)
- Roll velocity was 250 px/s during roll

**Pseudocode:**
```
test "Roll moves player 100px over 400ms":
    player.position = (500, 500)
    player.startDodgeRoll(direction: (1, 0))

    simulate 400ms at 60Hz

    assert player.position.x ≈ 600
    assert player.position.y ≈ 500
```

### TS-ROLL-002: Player Invincible During First 200ms

**Category**: Unit
**Priority**: Critical

**Preconditions:**
- Player rolling
- Roll started less than 200ms ago

**Input:**
- Check `isInvincibleFromRoll()` at 100ms into roll

**Expected Output:**
- Returns true (player is invincible)

**Pseudocode:**
```
test "Player invincible during first 200ms":
    player.startDodgeRoll((1, 0))

    advance time 100ms
    assert player.isInvincibleFromRoll() == true

    advance time 50ms  // Now at 150ms
    assert player.isInvincibleFromRoll() == true
```

### TS-ROLL-003: Player Vulnerable After 200ms

**Category**: Unit
**Priority**: Critical

**Preconditions:**
- Player rolling
- Roll started more than 200ms ago

**Input:**
- Check `isInvincibleFromRoll()` at 250ms into roll

**Expected Output:**
- Returns false (player is vulnerable)

**Pseudocode:**
```
test "Player vulnerable after 200ms":
    player.startDodgeRoll((1, 0))

    advance time 250ms
    assert player.isInvincibleFromRoll() == false

    advance time 100ms  // Now at 350ms, still rolling
    assert player.isRolling() == true
    assert player.isInvincibleFromRoll() == false
```

### TS-ROLL-004: Cooldown Prevents Roll for 3 Seconds

**Category**: Unit
**Priority**: Critical

**Preconditions:**
- Player completed a roll
- Less than 3 seconds since roll ended

**Input:**
- Attempt `canDodgeRoll()` at 1 second after roll
- Attempt `canDodgeRoll()` at 2.5 seconds after roll
- Attempt `canDodgeRoll()` at 3.1 seconds after roll

**Expected Output:**
- 1s: false (cooldown)
- 2.5s: false (cooldown)
- 3.1s: true (ready)

**Pseudocode:**
```
test "Cooldown prevents roll for 3 seconds":
    player.startDodgeRoll((1, 0))
    advance time 400ms  // Roll completes
    player.endDodgeRoll()

    advance time 1000ms
    assert player.canDodgeRoll() == false

    advance time 1500ms  // Now 2.5s after roll
    assert player.canDodgeRoll() == false

    advance time 600ms   // Now 3.1s after roll
    assert player.canDodgeRoll() == true
```

### TS-ROLL-005: Wall Collision Ends Roll Early

**Category**: Unit
**Priority**: High

**Preconditions:**
- Player at position (1880, 500) (near right edge)
- Rolling rightward

**Input:**
- Start roll with direction (1, 0)
- Run physics for 100ms

**Expected Output:**
- Roll ended early (position clamped to 1904)
- `roll:end` sent with reason "wall_collision"

**Pseudocode:**
```
test "Wall collision ends roll early":
    player.position = (1880, 500)
    player.startDodgeRoll((1, 0))

    rollCancelled = physics.updatePlayer(player, 0.1)

    assert rollCancelled == true
    assert player.isRolling() == false
    assert player.position.x == 1904  // Clamped to right boundary
```

### TS-ROLL-006: Roll Direction Matches WASD Input

**Category**: Unit
**Priority**: High

**Preconditions:**
- Player pressing W and D keys (up-right)

**Input:**
- Calculate roll direction from input

**Expected Output:**
- Direction is normalized (0.707, -0.707) (up-right diagonal)

**Pseudocode:**
```
test "Roll direction matches WASD input":
    input = { up: true, down: false, left: false, right: true }
    direction = calculateRollDirection(input)

    assert direction.x ≈ 0.707
    assert direction.y ≈ -0.707  // Y is inverted (up is negative)
```

### TS-ROLL-007: Stationary Roll Uses Aim Direction

**Category**: Unit
**Priority**: High

**Preconditions:**
- Player not pressing any WASD keys
- Aim angle is 45° (π/4 radians)

**Input:**
- Calculate roll direction from input

**Expected Output:**
- Direction is (cos(π/4), sin(π/4)) ≈ (0.707, 0.707)

**Pseudocode:**
```
test "Stationary roll uses aim direction":
    input = { up: false, down: false, left: false, right: false, aimAngle: π/4 }
    direction = calculateRollDirection(input)

    assert direction.x ≈ 0.707
    assert direction.y ≈ 0.707
```

### TS-ROLL-008: roll:start Message Broadcast to All

**Category**: Integration
**Priority**: High

**Preconditions:**
- 2 players in room (player A and player B)
- Player A initiates roll

**Input:**
- Player A sends `player:dodge_roll`

**Expected Output:**
- Both players receive `roll:start` with player A's ID

**Pseudocode:**
```
test "roll:start broadcast to all players":
    playerA.sendMessage({ type: "player:dodge_roll" })

    messageA = playerA.receiveMessage()
    messageB = playerB.receiveMessage()

    assert messageA.type == "roll:start"
    assert messageA.data.playerId == playerA.id
    assert messageB.type == "roll:start"
    assert messageB.data.playerId == playerA.id
```

### TS-ROLL-009: roll:end Includes Reason Code

**Category**: Integration
**Priority**: Medium

**Preconditions:**
- Player rolling
- Roll duration expires (0.4s)

**Input:**
- Wait for roll to complete

**Expected Output:**
- `roll:end` message with `reason: "completed"`

**Pseudocode:**
```
test "roll:end includes reason 'completed'":
    player.startDodgeRoll((1, 0))
    advance time 400ms

    message = player.receiveMessage()
    assert message.type == "roll:end"
    assert message.data.reason == "completed"
```

### TS-ROLL-010: Cannot Roll While Already Rolling

**Category**: Unit
**Priority**: High

**Preconditions:**
- Player currently in a roll

**Input:**
- Attempt `canDodgeRoll()` during active roll

**Expected Output:**
- Returns false

**Pseudocode:**
```
test "Cannot roll while already rolling":
    player.startDodgeRoll((1, 0))

    advance time 100ms  // Mid-roll
    assert player.isRolling() == true
    assert player.canDodgeRoll() == false
```

### TS-ROLL-011: Cannot Roll While Dead

**Category**: Unit
**Priority**: High

**Preconditions:**
- Player is dead (`DeathTime` is set)

**Input:**
- Attempt `canDodgeRoll()`

**Expected Output:**
- Returns false

**Pseudocode:**
```
test "Cannot roll while dead":
    player.health = 0
    player.triggerDeath()

    assert player.canDodgeRoll() == false
```

### TS-ROLL-012: Projectile Passes Through During I-Frames

**Category**: Integration
**Priority**: Critical

**Preconditions:**
- Player rolling (within first 200ms)
- Projectile intersects player hitbox

**Input:**
- Check collision between projectile and rolling player

**Expected Output:**
- No collision detected (projectile passes through)

**Pseudocode:**
```
test "Projectile passes through during i-frames":
    player.startDodgeRoll((1, 0))
    advance time 100ms  // In i-frame window

    projectile = createProjectile(position: player.position, owner: other)

    collision = physics.checkProjectilePlayerCollision(projectile, player)
    assert collision == false
```

### TS-ROLL-013: Projectile Hits After I-Frames

**Category**: Integration
**Priority**: High

**Preconditions:**
- Player rolling (after 200ms mark)
- Projectile intersects player hitbox

**Input:**
- Check collision between projectile and rolling player

**Expected Output:**
- Collision detected (player takes damage)

**Pseudocode:**
```
test "Projectile hits after i-frames":
    player.startDodgeRoll((1, 0))
    advance time 250ms  // Past i-frame window

    projectile = createProjectile(position: player.position, owner: other)

    collision = physics.checkProjectilePlayerCollision(projectile, player)
    assert collision == true
```

### TS-ROLL-014: Cooldown UI Shows Progress

**Category**: Unit
**Priority**: Medium

**Preconditions:**
- Player completed a roll 1.5 seconds ago

**Input:**
- Query `getCooldownProgress()`

**Expected Output:**
- Returns 0.5 (50% of 3-second cooldown)

**TypeScript:**
```typescript
it('should show 50% progress at 1.5s', () => {
  // Roll started at t=0, ended at t=400
  manager.startRoll();
  jest.advanceTimersByTime(400);
  manager.endRoll();

  // Now at t=1900 (1500ms after roll end)
  jest.advanceTimersByTime(1500);

  const progress = manager.getCooldownProgress();
  expect(progress).toBeCloseTo(0.5);
});
```

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-02-02 | Initial specification |
