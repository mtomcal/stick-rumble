# Movement

> **Spec Version**: 1.1.0
> **Last Updated**: 2026-02-15
> **Depends On**: [constants.md](constants.md), [arena.md](arena.md), [player.md](player.md)
> **Depended By**: [dodge-roll.md](dodge-roll.md), [shooting.md](shooting.md), [hit-detection.md](hit-detection.md)

---

## Overview

The movement system translates player input into physics-based motion. Players control their character using WASD keys for direction and Shift for sprinting. The system uses acceleration-based physics for smooth, responsive movement that feels natural.

**Why acceleration-based physics?** Instant velocity changes feel robotic and make aiming difficult. Acceleration creates smooth start/stop that players can anticipate, improving both control feel and competitive skill expression.

**Why server-authoritative movement?** All position updates are validated server-side to prevent speed hacking or teleportation cheats. Clients predict movement locally for responsiveness, but server state is always authoritative.

---

## Dependencies

### Technology Dependencies

| Technology | Version | Purpose |
|------------|---------|---------|
| Go | 1.25 | Server-side physics simulation |
| TypeScript | 5.9.3 | Client-side prediction |
| Phaser 3 | 3.90.0 | Input capture and rendering |

### Spec Dependencies

- [constants.md](constants.md) - Movement speeds, acceleration rates
- [arena.md](arena.md) - Boundary clamping rules
- [player.md](player.md) - Player state structure

---

## Constants

All movement constants are defined in [constants.md](constants.md). Key values:

| Constant | Value | Unit | Description |
|----------|-------|------|-------------|
| MOVEMENT_SPEED | 200 | px/s | Normal maximum speed |
| SPRINT_SPEED | 300 | px/s | Sprint maximum speed |
| SPRINT_MULTIPLIER | 1.5 | ratio | Sprint speed / normal speed |
| ACCELERATION | 50 | px/s² | Rate of speed increase |
| DECELERATION | 1500 | px/s² | Rate of speed decrease (near-instant stop) |
| SERVER_TICK_RATE | 60 | Hz | Physics update frequency |
| CLIENT_UPDATE_RATE | 20 | Hz | Position broadcast frequency |
| SPRINT_SPREAD_MULTIPLIER | 1.5 | ratio | Accuracy penalty while sprinting |

---

## Data Structures

### InputState

Player input captured from keyboard and mouse each frame.

**Why bundle all inputs?** Sending inputs as a single message reduces network overhead. At 20 Hz input rate, individual key events would create excessive traffic.

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

### Vector2

Position and velocity representation.

**TypeScript:**
```typescript
interface Vector2 {
  x: number;
  y: number;
}
```

**Go:**
```go
type Vector2 struct {
    X float64 `json:"x"`
    Y float64 `json:"y"`
}
```

---

## Behavior

### Input Direction Calculation

WASD keys are converted to a normalized direction vector.

**Why normalize diagonal movement?** Without normalization, diagonal movement (W+D) would be √2 ≈ 1.414x faster than cardinal movement (W only). Normalization ensures all movement directions travel at the same speed.

**Pseudocode:**
```
function getInputDirection(input):
    direction = Vector2(0, 0)

    if input.left:  direction.x -= 1
    if input.right: direction.x += 1
    if input.up:    direction.y -= 1  // Y increases downward
    if input.down:  direction.y += 1

    return normalize(direction)
```

**Normalization Formula:**
```
function normalize(v):
    length = sqrt(v.x² + v.y²)
    if length == 0:
        return Vector2(0, 0)
    return Vector2(v.x / length, v.y / length)
```

**Go:**
```go
func getInputDirection(input InputState) Vector2 {
    inputDir := Vector2{X: 0, Y: 0}

    if input.Left {
        inputDir.X -= 1
    }
    if input.Right {
        inputDir.X += 1
    }
    if input.Up {
        inputDir.Y -= 1
    }
    if input.Down {
        inputDir.Y += 1
    }

    return normalize(inputDir)
}

func normalize(v Vector2) Vector2 {
    length := math.Sqrt(v.X*v.X + v.Y*v.Y)
    if length == 0 {
        return Vector2{X: 0, Y: 0}
    }
    return Vector2{
        X: v.X / length,
        Y: v.Y / length,
    }
}
```

**TypeScript:**
```typescript
function getInputDirection(input: InputState): Vector2 {
  const dir = { x: 0, y: 0 };

  if (input.left) dir.x -= 1;
  if (input.right) dir.x += 1;
  if (input.up) dir.y -= 1;
  if (input.down) dir.y += 1;

  return normalize(dir);
}

function normalize(v: Vector2): Vector2 {
  const length = Math.sqrt(v.x * v.x + v.y * v.y);
  if (length === 0) return { x: 0, y: 0 };
  return { x: v.x / length, y: v.y / length };
}
```

### Direction Vector Examples

| Keys Pressed | Raw Direction | Normalized Direction |
|--------------|---------------|---------------------|
| W | (0, -1) | (0, -1) |
| W + D | (1, -1) | (0.707, -0.707) |
| D | (1, 0) | (1, 0) |
| S + D | (1, 1) | (0.707, 0.707) |
| S | (0, 1) | (0, 1) |
| S + A | (-1, 1) | (-0.707, 0.707) |
| A | (-1, 0) | (-1, 0) |
| W + A | (-1, -1) | (-0.707, -0.707) |
| None | (0, 0) | (0, 0) |

---

### Velocity Calculation

Movement uses an acceleration/deceleration model for smooth transitions.

**Why asymmetric accel/decel?** Acceleration is gradual (50 px/s²) for smooth ramp-up, but deceleration is near-instant (1500 px/s²) so players stop within ~0.13 seconds when releasing input. This prevents "ice physics" sliding and is critical for accurate client-side prediction — fast deceleration means fewer frames of drift between predicted and authoritative states.

**Why 50 px/s² acceleration?** At 50 px/s², reaching 200 px/s takes 4 seconds. This is intentionally slow—players feel the momentum but can still make quick direction changes.

**Why 1500 px/s² deceleration?** At full speed (200 px/s), the player stops in ~0.13 seconds (200/1500). This makes directional changes feel crisp and responsive — releasing a key immediately halts movement.

**Speed Selection:**
```
function getTargetSpeed(input):
    if input.isSprinting:
        return SPRINT_SPEED     // 300 px/s
    else:
        return MOVEMENT_SPEED   // 200 px/s
```

**Target Velocity:**
```
targetVelocity = inputDirection * targetSpeed
```

**Acceleration Model:**

When player has input, velocity accelerates toward target:

```
function accelerateToward(current, target, accel, deltaTime):
    diff = target - current
    maxChange = accel * deltaTime

    diffLength = length(diff)
    if diffLength <= maxChange:
        return target  // snap to target if close enough

    diffNorm = diff / diffLength
    return current + diffNorm * maxChange
```

**Deceleration Model:**

When player has no input, velocity decelerates to zero:

```
function decelerateToZero(current, decel, deltaTime):
    return accelerateToward(current, Vector2(0, 0), decel, deltaTime)
```

**Go:**
```go
func accelerateToward(current, target Vector2, accel, deltaTime float64) Vector2 {
    diff := Vector2{
        X: target.X - current.X,
        Y: target.Y - current.Y,
    }

    maxChange := accel * deltaTime

    diffLength := math.Sqrt(diff.X*diff.X + diff.Y*diff.Y)
    if diffLength <= maxChange {
        return target
    }

    diffNorm := Vector2{
        X: diff.X / diffLength,
        Y: diff.Y / diffLength,
    }

    return Vector2{
        X: current.X + diffNorm.X*maxChange,
        Y: current.Y + diffNorm.Y*maxChange,
    }
}

func decelerateToZero(current Vector2, decel, deltaTime float64) Vector2 {
    return accelerateToward(current, Vector2{X: 0, Y: 0}, decel, deltaTime)
}
```

**TypeScript:**
```typescript
function accelerateToward(
  current: Vector2,
  target: Vector2,
  accel: number,
  deltaTime: number
): Vector2 {
  const diff = {
    x: target.x - current.x,
    y: target.y - current.y,
  };

  const maxChange = accel * deltaTime;
  const diffLength = Math.sqrt(diff.x * diff.x + diff.y * diff.y);

  if (diffLength <= maxChange) {
    return target;
  }

  return {
    x: current.x + (diff.x / diffLength) * maxChange,
    y: current.y + (diff.y / diffLength) * maxChange,
  };
}
```

### Complete Velocity Update

**Pseudocode:**
```
function updateVelocity(player, input, deltaTime):
    inputDir = getInputDirection(input)

    // Determine target speed
    moveSpeed = MOVEMENT_SPEED  // 200 px/s
    if input.isSprinting:
        moveSpeed = SPRINT_SPEED  // 300 px/s

    currentVel = player.velocity

    if inputDir != (0, 0):
        // Player has input - accelerate toward target
        targetVel = inputDir * moveSpeed
        newVel = accelerateToward(currentVel, targetVel, ACCELERATION, deltaTime)
    else:
        // No input - decelerate to stop
        newVel = decelerateToZero(currentVel, DECELERATION, deltaTime)

    player.velocity = newVel
```

**Go:**
```go
func updateVelocity(player *PlayerState, input InputState, deltaTime float64) {
    inputDir := getInputDirection(input)

    moveSpeed := MovementSpeed
    if input.IsSprinting {
        moveSpeed = SprintSpeed
    }

    currentVel := player.GetVelocity()
    var newVel Vector2

    if inputDir.X != 0 || inputDir.Y != 0 {
        targetVel := Vector2{
            X: inputDir.X * moveSpeed,
            Y: inputDir.Y * moveSpeed,
        }
        newVel = accelerateToward(currentVel, targetVel, Acceleration, deltaTime)
    } else {
        newVel = decelerateToZero(currentVel, Deceleration, deltaTime)
    }

    player.SetVelocity(newVel)
}
```

---

### Position Update

Position is updated by integrating velocity over time, then clamping to arena bounds.

**Formula:**
```
newPosition = currentPosition + velocity * deltaTime
clampedPosition = clampToArena(newPosition)
```

**Why clamp after integration?** Clamping ensures players never leave the arena, even at high velocities. The order matters: integrate first, then clamp.

**Go:**
```go
func updatePosition(player *PlayerState, deltaTime float64) {
    currentPos := player.GetPosition()
    currentVel := player.GetVelocity()

    newPos := Vector2{
        X: currentPos.X + currentVel.X*deltaTime,
        Y: currentPos.Y + currentVel.Y*deltaTime,
    }

    clampedPos := clampToArena(newPos)
    player.SetPosition(clampedPos)
}
```

**TypeScript:**
```typescript
function updatePosition(player: PlayerState, deltaTime: number): void {
  const newPos = {
    x: player.position.x + player.velocity.x * deltaTime,
    y: player.position.y + player.velocity.y * deltaTime,
  };

  player.position = clampToArena(newPos);
}
```

### Boundary Clamping

See [arena.md](arena.md) for complete clamping behavior. Summary:

```
function clampToArena(pos):
    halfWidth = PLAYER_WIDTH / 2   // 16
    halfHeight = PLAYER_HEIGHT / 2 // 32

    x = clamp(pos.x, halfWidth, ARENA_WIDTH - halfWidth)   // [16, 1904]
    y = clamp(pos.y, halfHeight, ARENA_HEIGHT - halfHeight) // [32, 1048]

    return Vector2(x, y)
```

---

### Sprint Mechanics

Sprinting increases maximum speed by 1.5x but applies an accuracy penalty.

**Why 1.5x multiplier?** Sprint speed (300 px/s) vs normal (200 px/s) = 1.5x. This is meaningful for repositioning but not so fast that aiming becomes impossible.

**Why no stamina?** Stamina systems add management overhead without improving core gameplay. Players can sprint indefinitely, making sprint a tactical choice (speed vs accuracy) rather than a resource.

**Accuracy Penalty:**

While sprinting, weapon spread is multiplied by `SPRINT_SPREAD_MULTIPLIER` (1.5x). This encourages stop-and-shoot gameplay.

```
if player.isSprinting:
    effectiveSpread = baseSpread * SPRINT_SPREAD_MULTIPLIER
```

| State | Max Speed | Spread Multiplier |
|-------|-----------|-------------------|
| Walking | 200 px/s | 1.0x |
| Sprinting | 300 px/s | 1.5x |

---

## Game Loop Integration

### Server Tick (60 Hz)

The server updates physics every ~16.67ms.

**Why 60 Hz?** Industry standard for responsive shooters. Lower rates (30, 20) feel laggy; higher rates (128+) provide diminishing returns for browser games.

**Pseudocode:**
```
function serverTick(players, deltaTime):  // deltaTime ≈ 0.01667s
    for each player in players:
        if player.isDead():
            continue

        input = player.getInput()

        if player.isRolling():
            // Dodge roll overrides normal movement
            rollVelocity = player.rollDirection * DODGE_ROLL_VELOCITY
            player.setVelocity(rollVelocity)
        else:
            // Normal movement
            updateVelocity(player, input, deltaTime)

        updatePosition(player, deltaTime)
```

**Go:**
```go
func (gs *GameServer) updateAllPlayers(deltaTime float64) {
    players := gs.world.GetAllPlayers()

    for _, player := range players {
        if player.IsDead() {
            continue
        }

        // Delegate to physics engine
        gs.physics.UpdatePlayer(player, deltaTime)
    }
}
```

### Client Broadcast (20 Hz)

Position updates are sent to clients every 50ms.

**Why 20 Hz?** Sending at 60 Hz would triple bandwidth with no visible benefit. With interpolation, 20 Hz is indistinguishable from 60 Hz.

**Go:**
```go
func (gs *GameServer) broadcastLoop(ctx context.Context) {
    ticker := time.NewTicker(gs.updateRate)  // 50ms
    defer ticker.Stop()

    for {
        select {
        case <-ctx.Done():
            return
        case <-ticker.C:
            if gs.broadcastFunc != nil {
                playerStates := gs.world.GetAllPlayers()
                if len(playerStates) > 0 {
                    gs.broadcastFunc(playerStates)
                }
            }
        }
    }
}
```

### Input Sending (Event-Driven)

Clients send input when it changes, not at a fixed rate.

**Why event-driven?** Reduces unnecessary traffic when player is idle. Input is sent immediately when keys change, providing responsive feel.

**TypeScript:**
```typescript
private shouldSendInput(): boolean {
  return this.hasStateChanged();
}

private hasStateChanged(): boolean {
  const keysChanged =
    this.currentState.up !== this.lastSentState.up ||
    this.currentState.down !== this.lastSentState.down ||
    this.currentState.left !== this.lastSentState.left ||
    this.currentState.right !== this.lastSentState.right ||
    this.currentState.isSprinting !== this.lastSentState.isSprinting;

  const aimAngleChanged =
    Math.abs(this.currentState.aimAngle - this.lastSentAimAngle) > AIM_ANGLE_THRESHOLD;

  return keysChanged || aimAngleChanged;
}
```

**Aim Angle Threshold:** 0.087 radians ≈ 5 degrees (prevents spam on minor mouse movements)

---

## Client-Side Prediction

Clients predict movement locally for responsive controls using `PredictionEngine` (`src/game/physics/PredictionEngine.ts`).

**Why prediction?** Round-trip latency (client → server → client) could be 50-200ms. Without prediction, controls would feel sluggish. The client mirrors server physics locally and renders the predicted position immediately, then reconciles when server updates arrive.

### Prediction Pipeline

Each client frame in `GameScene.update()`:

```
1. Capture input (WASD + mouse)
2. Send input to server with sequence number
3. Call PredictionEngine.predictPosition(lastServerPos, lastServerVel, input, dt)
4. Render local player at predicted position
```

**PredictionEngine.predictPosition()** (`PredictionEngine.ts:100-170`):

```typescript
predictPosition(position, velocity, input, deltaTime):
    // 1. Calculate normalized input direction from WASD
    direction = getInputDirection(input)

    // 2. Accelerate or decelerate (always uses MOVEMENT.SPEED = 200)
    if direction != (0,0):
        targetVel = direction * MOVEMENT.SPEED
        newVel = accelerateToward(velocity, targetVel, ACCELERATION, dt)
    else:
        newVel = accelerateToward(velocity, (0,0), DECELERATION, dt)

    // 3. Cap velocity to MOVEMENT.SPEED (200 px/s)
    if magnitude(newVel) > MOVEMENT.SPEED:
        newVel = normalize(newVel) * MOVEMENT.SPEED

    // 4. Integrate position
    newPos = position + newVel * dt

    return { position: newPos, velocity: newVel }
```

> **Known asymmetry:** The client PredictionEngine always uses `MOVEMENT.SPEED` (200 px/s). It does NOT check `input.isSprinting` or use `SPRINT_SPEED` (300 px/s). The server's `Physics.UpdatePlayer()` does use `SprintSpeed` when sprinting. This means sprinting players will experience visible reconciliation corrections as the server position advances faster than the client prediction. The client constants (`constants.ts`) also lack `SPRINT_SPEED` and `SPRINT_MULTIPLIER` definitions.

### Server Reconciliation

When the server sends a `player:move` update (20 Hz), the client reconciles predicted state with authoritative state in `GameSceneEventHandlers.ts`.

**Reconciliation process:**

```
1. Server sends: { position, velocity, lastProcessedSequence }
2. Client finds pending inputs with sequence > lastProcessedSequence
3. Starting from server's authoritative position/velocity:
   - Replay each pending input through PredictionEngine.predictPosition()
4. Result = reconciled position (server truth + unprocessed predictions)
5. If distance(reconciled, currentPredicted) >= 100px: instant teleport
6. Otherwise: smooth lerp to reconciled position
```

**Why replay pending inputs?** The server state reflects inputs up to `lastProcessedSequence`. The client may have already predicted several frames ahead. Replaying unprocessed inputs on top of server state produces the correct predicted position.

**Input history**: The client maintains a buffer of sent inputs with sequence numbers via `InputManager.getInputHistory()`. Inputs older than `lastProcessedSequence` are discarded during reconciliation.

### Interpolation (Other Players)

Non-local players are rendered using `InterpolationEngine` (`src/game/physics/InterpolationEngine.ts`) to smooth 20 Hz server updates into 60 FPS visuals.

**Configuration:**

| Constant | Value | Why |
|----------|-------|-----|
| BUFFER_SIZE | 10 | Sliding window of position snapshots |
| BUFFER_DELAY_MS | 100 | Render 100ms in the past (2 server updates) |
| FREEZE_THRESHOLD_MS | 200 | Stop extrapolating after 200ms of no data |
| EXTRAPOLATION_MAX_MS | 100 | Max extrapolation time on packet loss |

**Algorithm:**

```
renderTime = currentTime - BUFFER_DELAY_MS  // 100ms in the past

// Find two snapshots bracketing renderTime
prevSnapshot, nextSnapshot = findBracketingSnapshots(renderTime)

// Linear interpolation between them
t = (renderTime - prevSnapshot.time) / (nextSnapshot.time - prevSnapshot.time)
interpolatedPos = lerp(prevSnapshot.position, nextSnapshot.position, t)

// If no future snapshot: extrapolate using velocity (max 100ms)
if renderTime > latestSnapshot.time:
    extrapolationTime = min(renderTime - latestTime, EXTRAPOLATION_MAX_MS)
    extrapolatedPos = lastPos + lastVel * extrapolationTime
```

**Why 100ms delay?** At 20 Hz updates (50ms apart), a 100ms buffer guarantees two snapshots are available for interpolation. This trades a small latency increase for smooth visuals.

### File Locations

| File | Purpose |
|------|---------|
| `src/game/physics/PredictionEngine.ts` | Client-side prediction (mirrors server physics) |
| `src/game/physics/InterpolationEngine.ts` | Smooths other players' 20 Hz updates |
| `src/game/simulation/physics.ts` | Pure math: accelerateToward, normalize, clamp |
| `src/game/scenes/GameSceneEventHandlers.ts` | Server reconciliation logic |
| `src/game/scenes/GameScene.ts` | Calls prediction/interpolation each frame |

---

## Movement Timeline Example

Starting from rest, pressing W (move up):

```
Time     Velocity (px/s)   Position (y)   Notes
0.0s     0                 540            Start at rest
0.017s   0.83              539.99         First tick: 50 * 0.017 = 0.83 px/s
0.033s   1.67              539.97         Second tick
0.05s    2.5               539.93         Third tick
...
1.0s     50                537.5          After 1 second: 50 px/s
2.0s     100               487.5          After 2 seconds: 100 px/s
3.0s     150               412.5          After 3 seconds: 150 px/s
4.0s     200               312.5          After 4 seconds: max speed (200 px/s)
4.017s   200               309.17         At max speed
```

**Time to reach max speed:** 200 px/s ÷ 50 px/s² = 4 seconds

---

## Error Handling

### NaN/Infinity Velocity

**Trigger**: Division by zero or math error produces invalid velocity
**Detection**: Check `isNaN()` or `isInfinity()` before using
**Response**: Reset velocity to (0, 0)
**Why**: Prevents cascading errors in position calculation

### Extreme Delta Time

**Note**: Neither the server nor the client currently sanitizes or caps deltaTime. The server computes real elapsed time via `now.Sub(lastTick).Seconds()` (`gameserver.go:136`) and the client converts Phaser's frame delta from ms to seconds (`GameScene.ts:325-327`). Both use the raw value directly — no `sanitizeDeltaTime` function exists. Large lag spikes could theoretically cause position jumps, but this is not currently guarded against.

---

## Implementation Notes

### TypeScript (Client)

1. **Input Capture**: Use Phaser's keyboard events for WASD, Shift. Mouse position for aim angle.

2. **Frame Update**: Apply prediction in scene's `update()` method.

3. **Server Reconciliation**: On receiving `player:move`, update position. Use interpolation for smooth visuals.

4. **Aim Angle Calculation**:
   ```typescript
   const aimAngle = Math.atan2(
     mouseY - playerY,
     mouseX - playerX
   );
   ```

### Go (Server)

1. **Thread Safety**: Physics updates run in game loop goroutine. Player state protected by mutex.

2. **Determinism**: Use `float64` for all calculations. Avoid time-dependent randomness.

3. **Clock Injection**: Use `Clock` interface for testable physics.

4. **Physics Order**:
   1. Get input state
   2. Check if rolling (override movement)
   3. Calculate velocity
   4. Update position
   5. Clamp to bounds

---

## Test Scenarios

### TS-MOVE-001: Player accelerates to target velocity

**Category**: Unit
**Priority**: Critical

**Preconditions:**
- Player at rest (velocity = 0)
- Input: W key pressed (up)

**Input:**
- Run physics for 4 seconds (240 ticks at 60 Hz)

**Expected Output:**
- Velocity Y approaches -200 px/s
- Velocity magnitude ≈ 200 px/s

**Go:**
```go
func TestAccelerationToMaxSpeed(t *testing.T) {
    player := NewPlayerState("test")
    input := InputState{Up: true}

    // Simulate 4 seconds at 60 Hz
    for i := 0; i < 240; i++ {
        physics.UpdatePlayer(player, 1.0/60.0)
    }

    vel := player.GetVelocity()
    assert.InDelta(t, -200.0, vel.Y, 1.0)
}
```

### TS-MOVE-002: Player decelerates when no input

**Category**: Unit
**Priority**: Critical

**Preconditions:**
- Player moving at 200 px/s

**Input:**
- Release all keys
- Run physics for ~0.15 seconds (9 ticks at 60 Hz)

**Expected Output:**
- Velocity approaches (0, 0) within ~0.13 seconds (200 px/s ÷ 1500 px/s²)

### TS-MOVE-003: Sprint increases speed to 300 px/s

**Category**: Unit
**Priority**: High

**Preconditions:**
- Player at rest
- Input: W + Shift

**Input:**
- Run physics for 6 seconds

**Expected Output:**
- Velocity Y approaches -300 px/s

**Go:**
```go
func TestSprintSpeed(t *testing.T) {
    player := NewPlayerState("test")
    input := InputState{Up: true, IsSprinting: true}

    for i := 0; i < 420; i++ {  // 7 seconds
        player.SetInput(input)
        physics.UpdatePlayer(player, 1.0/60.0)
    }

    vel := player.GetVelocity()
    assert.InDelta(t, -300.0, vel.Y, 1.0)
}
```

### TS-MOVE-004: Diagonal movement is normalized

**Category**: Unit
**Priority**: High

**Preconditions:**
- Player at rest

**Input:**
- W + D keys pressed
- Run physics to max speed

**Expected Output:**
- Velocity magnitude = 200 px/s (not 200 * √2 ≈ 282)
- Direction = (0.707, -0.707)

**Go:**
```go
func TestDiagonalNormalization(t *testing.T) {
    player := NewPlayerState("test")
    input := InputState{Up: true, Right: true}

    for i := 0; i < 240; i++ {
        player.SetInput(input)
        physics.UpdatePlayer(player, 1.0/60.0)
    }

    vel := player.GetVelocity()
    magnitude := math.Sqrt(vel.X*vel.X + vel.Y*vel.Y)
    assert.InDelta(t, 200.0, magnitude, 1.0)
}
```

### TS-MOVE-005: Position updates by velocity * deltaTime

**Category**: Unit
**Priority**: Critical

**Preconditions:**
- Player at (960, 540)
- Velocity = (100, 0)

**Input:**
- deltaTime = 0.5s

**Expected Output:**
- Position = (1010, 540)

### TS-MOVE-006: Position clamped to arena bounds

**Category**: Unit
**Priority**: Critical

**Preconditions:**
- Player at (1900, 540)
- Velocity = (200, 0)

**Input:**
- Run physics for 1 second

**Expected Output:**
- Position X = 1904 (max valid X)

### TS-MOVE-007: Sprint applies accuracy penalty

**Category**: Integration
**Priority**: Medium

**Preconditions:**
- Player sprinting
- Weapon with 5° base spread

**Input:**
- Calculate effective spread

**Expected Output:**
- Spread = 5° * 1.5 = 7.5°

### TS-MOVE-008: Acceleration rate is 50 px/s²

**Category**: Unit
**Priority**: High

**Preconditions:**
- Player at rest

**Input:**
- W key pressed
- Check velocity after 1 second (60 ticks)

**Expected Output:**
- Velocity ≈ 50 px/s

### TS-MOVE-009: Direction changes smoothly

**Category**: Unit
**Priority**: Medium

**Preconditions:**
- Player moving right at 200 px/s

**Input:**
- Press W (change to up)

**Expected Output:**
- Velocity smoothly transitions from (200, 0) toward (0, -200)
- No instant snap

### TS-MOVE-010: Zero input produces zero velocity

**Category**: Unit
**Priority**: Medium

**Preconditions:**
- Player at rest
- No keys pressed

**Input:**
- Run physics for any duration

**Expected Output:**
- Velocity remains (0, 0)

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-02-02 | Initial specification extracted from codebase |
| 1.1.0 | 2026-02-15 | Updated DECELERATION from 50→1500 px/s². Rewrote Client-Side Prediction section to document PredictionEngine, server reconciliation (with input sequence replay), and InterpolationEngine. Updated deceleration test scenario timing. Added file location table for new physics modules. |
| 1.1.1 | 2026-02-16 | Removed nonexistent `sanitizeDeltaTime` function from Error Handling section to match source code (raw delta used) |
| 1.1.2 | 2026-02-16 | Documented client prediction sprint asymmetry — PredictionEngine always uses MOVEMENT.SPEED (200), ignores sprint. Server uses SprintSpeed (300) when sprinting. |
