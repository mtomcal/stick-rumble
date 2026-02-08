## CLIENT-SIDE PLAYER MOVEMENT AND PREDICTION SYSTEM RESEARCH

### EXECUTIVE SUMMARY

The client-side player movement system currently has the infrastructure for client-side prediction (PredictionEngine, InputManager with sequence tracking, reconciliation path), but **the local player position is NOT being driven by prediction** - it's being driven entirely by server state in `PlayerManager.update()` line 336-338.

**Root Cause**: Even though prediction infrastructure exists, there is no code that:
1. Runs client-side prediction on the local player each frame
2. Applies predicted positions to the local player
3. Uses the reconciliation path to correct prediction errors

**Result**: The local player feels sluggish because every position update waits for the server round-trip (~100-200ms on typical connections), despite having all the building blocks for instant client-side response.

---

### PART 1: CURRENT ARCHITECTURE

#### 1.1 Player Position Update Flow (CURRENT - Server-Driven)

**Frame 1: User presses W**
```
InputManager.update()
  ↓
hasStateChanged() returns true (W key down)
  ↓
sendInputState() sends to server with sequence=0
  ↓
inputHistory stored locally: [{sequence: 0, input: {up: true, ...}}]
  ↓
Server receives input, processes, simulates physics
  ↓
Server sends player:move message with updated position (500, 490)
  ↓
GameSceneEventHandlers.playerMoveHandler()
  ↓
PlayerManager.updatePlayers([{id: 'local', position: {x: 500, y: 490}, ...}])
  ↓
PlayerManager.update(delta)
  ↓
renderPosition = state.position (500, 490) [LINE 336-338]
  ↓
playerGraphics.setPosition(500, 490)
  ↓
Player renders at new position
```

**Latency Impact**: If server takes 100ms to process input and send response, player sees 100ms+ delay before visual feedback.

#### 1.2 Infrastructure That EXISTS But Is UNUSED

**PredictionEngine** (`stick-rumble-client/src/game/physics/PredictionEngine.ts`):
- **Implemented**: `predictPosition()` - simulates physics frame-by-frame
- **Implemented**: `reconcile()` - replays pending inputs from server state
- **Implemented**: `needsInstantCorrection()` - determines if correction is instant or smooth
- **Status**: Instantiated in GameScene.ts line 189 but NEVER called for local player prediction
- **Physics Model**: Acceleration-based, matches server exactly (uses MOVEMENT constants)

**InputManager** (`stick-rumble-client/src/game/input/InputManager.ts`):
- **Implemented**: Sequence numbering (line 52, incremented on line 211)
- **Implemented**: Input history tracking (line 53, stored on line 195-199)
- **Implemented**: `getInputHistory()` returns full history for reconciliation
- **Implemented**: `clearInputHistoryUpTo()` clears acknowledged inputs
- **Status**: Creates sequence trail but sequences only used for clearing history, not prediction

**Reconciliation Path** (`GameSceneEventHandlers.ts` line 234-248):
- **Implemented**: Server sends `correctedPlayers` array and `lastProcessedSequence`
- **Implemented**: `handleServerCorrection()` method (line 642-679)
- **Method**:
  1. Takes server's authoritative position
  2. Gets pending inputs from InputManager
  3. Replays them using PredictionEngine.reconcile()
  4. Applies reconciled position via PlayerManager.applyReconciledPosition()
- **Status**: Only runs when server explicitly sends `correctedPlayers` (line 237)

#### 1.3 Current Position Update Path (Line-by-Line Analysis)

**PlayerManager.updatePlayers()** (line 94-296):

```typescript
// Line 114-120: Store snapshots ONLY for remote players
if (state.id !== this.localPlayerId) {
  this.interpolationEngine.addSnapshot(state.id, {
    position: { ...state.position },
    velocity: { ...state.velocity },
    timestamp: this._clock.now(),
  });
}
```
**Issue**: Local player snapshots never stored - no interpolation data for local player.

```typescript
// Line 232-234: CRITICAL COMMENT - Position updates DISABLED during creation
// DO NOT set position here - update() is the sole position writer
// Position updates happen in update() via interpolation or server state
```
**Analysis**: This comment was added in commit 029b166 to fix flickering from dual position writers. The fix correctly prevents duplicate position updates during `updatePlayers()`, but it left NO alternative for prediction.

**PlayerManager.update()** (line 305-388):

```typescript
// Line 320-339: LOCAL PLAYER USES RAW SERVER STATE
if (playerId !== this.localPlayerId) {
  const interpolated = this.interpolationEngine.getInterpolatedPosition(
    playerId,
    this._clock.now()
  );
  if (interpolated) {
    renderPosition = interpolated.position;
    renderVelocity = interpolated.velocity;
  } else {
    renderPosition = state.position;
    renderVelocity = state.velocity;
  }
} else {
  // Local player: use raw server state (prediction will override this in the future)
  renderPosition = state.position;
  renderVelocity = state.velocity;
}
```

**Critical Finding**:
- **Remote players**: Use interpolation engine (smooth, responsive)
- **Local player**: Uses raw server state (sluggish, server-driven)
- **Comment on line 336**: "prediction will override this in the future" - indicates this is a known placeholder

```typescript
// Line 341-342: SOLE POSITION WRITER - applies raw server state
playerGraphics.setPosition(renderPosition.x, renderPosition.y);
```

---

### PART 2: THE MISSING PIECE - LOCAL PLAYER PREDICTION

#### 2.1 What Should Happen (Design Intent)

```
GameScene.update(delta):
  → InputManager.update()          [Collects WASD input, sends to server]
  → PredictionEngine.predictPosition()  [Predicts next frame's position LOCALLY]
  → PlayerManager.update()          [Renders predicted position immediately]

Meanwhile, server processes input and sends server:move:
  → GameSceneEventHandlers.playerMoveHandler()
  → Reconciliation: Compare predicted vs server position
  → If error detected: PredictionEngine.reconcile() replays inputs from server state
  → Apply reconciled position
```

**Result**:
- Frame 0: User presses W
- Frame 1: Prediction engine immediately advances local player position (INSTANT FEEDBACK)
- Frame 2: Server response arrives, reconciliation corrects any drift
- User experiences ~60 FPS local movement + smooth server corrections

#### 2.2 What's Missing From The Code

**Step 1: NO prediction running each frame for local player**
- `PredictionEngine.predictPosition()` is NEVER called in the GameScene update loop
- Local player position should be: previous_position + velocity_from_prediction
- Currently: just the raw server state

**Step 2: NO predicted position stored for local player**
- Remote players have interpolation snapshots
- Local player has... nothing. Just updates to `playerStates` from server
- Need: A predicted state that gets updated each frame

**Step 3: NO connection between input changes and prediction**
- InputManager detects input changes
- But prediction isn't triggered on input changes
- Both should happen together: send to server + predict locally

#### 2.3 How Prediction SHOULD Integrate

The fix would follow this pattern:

```typescript
// In PlayerManager class:
private localPlayerPredictedState: Map<string, {position, velocity}> = new Map()

// In GameScene.update():
if (this.inputManager && this.predictionEngine && this.playerManager.getLocalPlayerId()) {
  const localId = this.playerManager.getLocalPlayerId()
  const currentState = this.playerManager.playerStates.get(localId)
  const inputState = this.inputManager.getState()

  // Predict next position based on current input
  const predicted = this.predictionEngine.predictPosition(
    currentState.position,
    currentState.velocity,
    inputState,
    delta / 1000  // Convert ms to seconds
  )

  // Store predicted state for rendering
  this.playerManager.setLocalPlayerPredictedPosition(predicted)
}

// In PlayerManager.update():
if (playerId === this.localPlayerId) {
  // Use predicted position if available, fall back to server state
  if (this.localPlayerPredictedState.has(playerId)) {
    renderPosition = this.localPlayerPredictedState.get(playerId).position
    renderVelocity = this.localPlayerPredictedState.get(playerId).velocity
  } else {
    renderPosition = state.position  // Fallback during init
    renderVelocity = state.velocity
  }
} else {
  // Remote players use interpolation (unchanged)
  const interpolated = this.interpolationEngine.getInterpolatedPosition(...)
  ...
}
```

---

### PART 3: RECONCILIATION PATH (Currently Incomplete)

#### 3.1 When Reconciliation Is Triggered

**Current Code** (`GameSceneEventHandlers.ts` line 237-238):
```typescript
if (localPlayerId && messageData.correctedPlayers && messageData.correctedPlayers.includes(localPlayerId)) {
  this.handleServerCorrection(messageData, localPlayerId);
}
```

**Issue**: Only runs if server explicitly includes localPlayerId in `correctedPlayers` array.

**Server Implementation Required**: The server needs to:
1. Track what sequence each player's input was processed at
2. Send `correctedPlayers` array when it detects prediction error
3. Send `lastProcessedSequence` for each corrected player

#### 3.2 Current Reconciliation Implementation

**Method**: `handleServerCorrection()` (line 642-679)

```typescript
// Get server's authoritative position
const localPlayer = messageData.players.find(p => p.id === localPlayerId);

// Get last input sequence server processed
const lastProcessedSequence = messageData.lastProcessedSequence?.[localPlayerId];

// Get pending inputs from our history
const pendingInputs = this.inputManager.getInputHistory();

// Reconcile: Start from server state, replay pending inputs
const reconciledState = this.predictionEngine.reconcile(
  localPlayer.position,
  localPlayer.velocity,
  lastProcessedSequence,
  pendingInputs
);

// Determine if instant teleport or smooth lerp
const needsInstant = this.predictionEngine.needsInstantCorrection(
  currentPosition,
  localPlayer.position
);

// Apply reconciled state
this.playerManager.applyReconciledPosition(localPlayerId, reconciledState, needsInstant);
```

**Status**: Implementation is complete and correct, but only activates on explicit server correction signal.

---

### PART 4: TEST COVERAGE ANALYSIS

#### 4.1 Existing Tests

**Unit Tests**:
- `PredictionEngine.test.ts`: Tests `predictPosition()`, `reconcile()`, `needsInstantCorrection()` - ALL PASS
- `InputManager.test.ts`: Tests sequence numbering, input history - ALL PASS
- `InterpolationEngine.test.ts`: Tests remote player interpolation - ALL PASS
- `PlayerManager.test.ts`: Tests sprite creation, updates, but only for server state path

**Integration Tests**:
- `GameSceneEventHandlers.reconciliation.test.ts`: Tests reconciliation flow when `correctedPlayers` is set
- `WebSocketClient.player-movement.integration.test.ts`: Tests position updates arriving from server

#### 4.2 Missing Tests

NO TESTS for:
1. Local player prediction each frame
2. Predicted position being applied to local player sprite
3. Prediction + reconciliation together in realistic scenario
4. Smooth vs instant correction visually

**Gap**: Unit tests pass but the integrated prediction flow is completely untested because the glue code doesn't exist yet.

---

### PART 5: RELATED SYSTEMS

#### 5.1 InterpolationEngine (For Remote Players)

**How It Works**:
- Buffer: Keeps last 10 position snapshots per player (100ms window)
- Render Time: Renders at (now - 100ms) for smooth interpolation
- Extrapolation: Continues velocity if no update for 100ms
- Freeze: Stops at last position if no update for 200ms+

**Why This Works For Remote Players**:
- At 20Hz server rate, 100ms = ~2 updates in flight
- Smooth interpolation between them hides network latency
- Extrapolation bridges packet loss gaps

**Why It Doesn't Work For Local Player**:
- Local player controls are instant, should respond to input immediately
- Interpolation adds 100ms+ delay (buffer delay)
- Would contradict the point of client-side prediction

#### 5.2 Animation System (Walk Cycle)

**Current**:
```typescript
// Line 272-274, 384-386: Animation based on velocity from state
const isMoving = Math.sqrt(renderVelocity.x ** 2 + renderVelocity.y ** 2) > 0.1;
playerGraphics.update(delta, isMoving);
```

**Issue**: Animation will use server velocity initially until prediction starts providing velocity.

**Fix**: Once prediction runs, predicted velocity will automatically animate correctly.

#### 5.3 Aim Indicator (Immediate Visual Feedback)

**Current** (line 338-341 in GameScene.ts):
```typescript
const currentAimAngle = this.inputManager.getAimAngle();
this.playerManager.updateLocalPlayerAim(currentAimAngle);
```

**Note**: Aim IS updated immediately (client-side prediction), but position is NOT.

**Insight**: This proves the architecture supports immediate client-side feedback - we just need to apply the same pattern to position.

---

### PART 6: ISSUES AND GOTCHAS

#### 6.1 Delta Time Precision

**Current**: GameScene.update() receives delta in milliseconds (line 325-327):
```typescript
this.lastDeltaTime = delta / 1000;  // Convert to seconds
```

**For Prediction**: PredictionEngine.predictPosition() expects deltaTime in seconds.

**Test File**: PlayerManager receives mocked delta values. Currently using 16ms (60 FPS).

**Precision Risk**: Must ensure deltaTime conversion is consistent between prediction and server.

#### 6.2 Physics Constants Synchronization

**Location**: `/shared/constants.ts` defines:
- `MOVEMENT.SPEED` - max velocity
- `MOVEMENT.ACCELERATION` - how fast to accelerate
- `MOVEMENT.DECELERATION` - how fast to decelerate

**Criticality**: PredictionEngine uses these same constants (line 1-2).

**Risk**: If server constants change, prediction diverges. But since constants are in shared code, sync is guaranteed.

#### 6.3 Frame Skipping on High Load

**Issue**: If GameScene.update() is slow and skips frames, prediction could accumulate error.

**Current Safeguard**: Reconciliation handles drift regardless of how much error accumulated.

**Impact on Fix**: Prediction must run EVERY frame for accuracy. Frame skips will cause visible jitter.

#### 6.4 Camera Follow Lag

**Current** (line 448, 458):
```typescript
this.cameras.main.startFollow(localPlayerGraphics, true, 0.1, 0.1);
// Lerp: 0.1 = smooth follow, 1 = instant
```

**With Prediction**: Camera follows predicted position, so it will be slightly ahead of server truth. This is actually GOOD (no lag perception).

#### 6.5 Collision/Boundary Checks

**Missing**: No client-side collision detection mentioned in prediction code.

**Server Role**: Server validates all movements, prevents phase-through walls.

**Client Role**: Could add optimistic client-side boundary checks to prevent sending invalid inputs, but NOT required for prediction to work.

---

### PART 7: SEQUENCE FLOW DIAGRAM

```
Local Player Movement (Current Broken Flow):
┌─────────────────────────────────────────────────────────────────┐
│ T=0ms: User presses W                                           │
├─────────────────────────────────────────────────────────────────┤
│ T=0ms: InputManager detects W down, sends input:state (seq: 0)  │
│        Server receives, begins processing                       │
├─────────────────────────────────────────────────────────────────┤
│ T=0-100ms: Player SEES NO MOVEMENT (waiting for server)         │ ← SLUGGISH
├─────────────────────────────────────────────────────────────────┤
│ T=100ms: Server sends player:move with new position (500, 490)  │
│          GameSceneEventHandlers.playerMoveHandler() called      │
│          PlayerManager.updatePlayers() called                   │
│          PlayerManager.update() renders at (500, 490)           │
├─────────────────────────────────────────────────────────────────┤
│ T=100ms: Player FINALLY SEES MOVEMENT (100ms+ latency)          │
└─────────────────────────────────────────────────────────────────┘

What SHOULD Happen (With Prediction - Desired):
┌─────────────────────────────────────────────────────────────────┐
│ T=0ms: User presses W                                           │
├─────────────────────────────────────────────────────────────────┤
│ T=0ms: InputManager detects W down, sends input:state (seq: 0)  │
│        Prediction engine immediately calculates next position   │
│        PlayerManager renders PREDICTED position (500, 490)      │
├─────────────────────────────────────────────────────────────────┤
│ T=0-16ms: Player SEES INSTANT MOVEMENT (client-side)            │ ← RESPONSIVE
│           Predicted movement continues frame-by-frame           │
├─────────────────────────────────────────────────────────────────┤
│ T=100ms: Server sends player:move with actual position (500, 490) │
│          Reconciliation: compares predicted vs actual          │
│          Error detected: ZERO (prediction was perfect)          │
│          No correction needed, player sees smooth movement     │
├─────────────────────────────────────────────────────────────────┤
│ Result: Instant response + smooth server synchronization        │
└─────────────────────────────────────────────────────────────────┘
```

---

### PART 8: CODE LOCATIONS THAT NEED CHANGES

**File 1**: `stick-rumble-client/src/game/scenes/GameScene.ts`
- **Current**: Lines 325-413 in update() method
- **Needed**: Add local player prediction step after InputManager.update()
- **Pattern**: Similar to how updateLocalPlayerAim() is called on line 341

**File 2**: `stick-rumble-client/src/game/entities/PlayerManager.ts`
- **Current**: Lines 305-388 in update() method
- **Needed**: Add method to track local player's predicted state
- **Pattern**: Similar to how playerStates Map works

**File 3**: `stick-rumble-client/src/game/scenes/GameSceneEventHandlers.ts`
- **Current**: Reconciliation code already exists (lines 642-679)
- **Needed**: Ensure reconciliation is triggered on EVERY player:move, not just when correctedPlayers is set
- **Pattern**: Modify line 237 condition to be more permissive

**File 4**: Tests (NEW)
- **File**: `stick-rumble-client/src/game/physics/LocalPlayerPrediction.test.ts` (new)
- **Tests**: Prediction + reconciliation together in realistic scenarios

---

### PART 9: CRITICAL INSIGHTS

#### 9.1 Why This Bug Exists

1. **Story 4.1** (Feb 4, 2026): Added prediction infrastructure but not integrated it
2. **Story 4.2** (Feb 4, 2026): Added reconciliation but didn't wire it to run always
3. **Story 4.3** (Feb 4, 2026): Added interpolation for remote players
4. **Commit 029b166** (Feb 8, 2026): Fixed "flickering" by removing dual position writers, but didn't add the missing piece (prediction)

The fix for flickering was correct - stop writing position in updatePlayers(). But there should have been a prediction system writing instead. The comment "prediction will override this in the future" (line 336) suggests this was a known placeholder.

#### 9.2 Why Tests Pass But Movement Feels Sluggish

- Unit tests mock server responses immediately → prediction tests show zero latency
- Integration tests run server on same machine → <10ms latency
- Real deployments → 50-200ms latency becomes obvious
- No test simulates realistic network latency + prediction combo

#### 9.3 Architecture Is Actually Sound

The pieces that exist are well-designed:
- PredictionEngine matches server physics exactly
- InputManager tracks sequences properly
- Reconciliation path is robust
- InterpolationEngine is correct for remote players

**The only missing piece**: Glue code to run prediction + apply predicted positions to local player each frame.

---

### PART 10: IMPLEMENTATION CHECKLIST

**Must Have**:
- [ ] Run PredictionEngine.predictPosition() each frame for local player
- [ ] Apply predicted position to local player sprite
- [ ] Call reconciliation on every player:move (not just when correctedPlayers is set)
- [ ] Test local player prediction end-to-end

**Should Have**:
- [ ] Smooth lerp for small corrections (not just instant)
- [ ] Visual feedback for instant corrections (flash effect)
- [ ] Input buffering for very high-latency connections

**Nice to Have**:
- [ ] Client-side boundary/collision checks for prediction
- [ ] Metrics/debugging display of prediction vs server difference
- [ ] Replays/demos of prediction working correctly

---

## SUMMARY

**The Problem**: Server state overwrites client-side prediction because prediction isn't running for the local player yet.

**Root Cause**: PlayerManager.update() line 336-338 uses raw server state for local player instead of predicted state.

**The Fix**: Run PredictionEngine.predictPosition() each frame and apply the result to the local player in the same update() method that applies interpolation to remote players.

**Why It Matters**: Prediction is already fully implemented, just not connected. Adding ~50 lines of glue code would restore instant client-side feedback while maintaining server authority via reconciliation.

**Testing Gap**: No tests verify prediction + reconciliation working together on realistic scenarios. All tests use zero/minimal latency.
