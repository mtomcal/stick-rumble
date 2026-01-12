# Epic 4: Responsive Networked Gameplay

**Goal:** Players experience smooth, fair combat despite network latency

**Value Delivered:** Lag-compensated controls that feel instant + cheat-proof server validation

**FRs Covered:** FR13 (client prediction), FR16 (latency <100ms)

**Status:** Not Started (0/6 stories)

---

## Stories

### Story 4.1: Implement Client-Side Movement Prediction

As a player,
I want my movement to feel instant,
So that controls are responsive despite network latency.

**Acceptance Criteria:**

**Given** I press W key with 80ms ping to server
**When** I press the key
**Then** my stick figure immediately moves on screen (no delay)

**And** client predicts position using local physics simulation
**And** client stores pending inputs with sequence numbers
**And** when server confirms movement, client reconciles predicted vs authoritative position
**And** if prediction was correct: no visual change (smooth)
**And** if prediction was wrong: smoothly interpolate to server position (not teleport)

**And** other players' movement is interpolated (smooth, slightly delayed) not predicted
**And** my movement feels <50ms responsive (imperceptible lag)

**Prerequisites:** Story 3.6

**Technical Notes:**
- Client `PredictionEngine.ts` runs physics simulation identical to server
- Store pending inputs: `{sequence: number, input: InputState, timestamp: number}[]`
- Server responds with `player:moved` including sequence number
- Reconciliation: replay pending inputs after confirmed sequence
- Error threshold: if predicted position differs from server by >50px, teleport correction
- Otherwise: smooth lerp over 100ms to correct position
- Interpolation for other players: render at (now - 100ms) using buffered states

---

### Story 4.2: Implement Server Reconciliation for Corrections

As a player,
I want the server to correct impossible movements,
So that cheating is prevented without ruining my experience.

**Acceptance Criteria:**

**Given** my client predicts I moved through a wall
**When** the server detects impossible movement
**Then** the server sends correction with authoritative position

**And** my client receives `player:moved` with `corrected: true` flag
**And** client discards incorrect prediction, replays inputs from server position
**And** visual correction is smooth (not jarring teleport if <100px error)
**And** large corrections (>100px): instant teleport with visual effect (prevent wall clipping)

**And** corrections are rare (<1% of moves) in normal gameplay
**And** corrections are frequent (>10%) if attempting to cheat

**Prerequisites:** Story 4.1

**Technical Notes:**
- Server validates all moves: bounds check, obstacle collision, speed limits
- Invalid move: server recalculates correct position, sends `corrected: true`
- Client reconciliation: on correction, reset position to server value, replay pending inputs
- Smooth correction: if error <100px, lerp over 100ms
- Instant correction: if error >=100px, set position immediately with flash effect
- Anti-cheat: log correction frequency per player, kick if >20% corrections

---

### Story 4.3: Implement Interpolation for Other Players

As a player,
I want other players' movements to appear smooth,
So that gameplay feels polished even with varied latency.

**Acceptance Criteria:**

**Given** I am watching another player with 100ms ping
**When** I receive their position updates at 20 Hz (every 50ms)
**Then** their stick figure moves smoothly between received positions (not teleporting)

**And** client interpolates between last and current position over the update interval
**And** interpolation uses linear or cubic smoothing (no jitter)
**And** if update is delayed (packet loss): continue extrapolating briefly, then freeze
**And** other players rendered at (current time - 100ms) for smooth interpolation buffer

**And** animations sync with interpolated movement (walk cycle matches speed)

**Prerequisites:** Story 4.2

**Technical Notes:**
- Client maintains position history: last 10 positions per player with timestamps
- Interpolation: render position at (now - 100ms) using buffered snapshots
- Lerp between snapshots: `pos = lerp(prevPos, nextPos, (now - prevTime) / (nextTime - prevTime))`
- Extrapolation: if no new data for 200ms, continue last velocity for max 100ms, then freeze
- Animation sync: walk speed = distance / time between frames
- Buffer size: 100ms = ~2 server updates (provides smoothing buffer)

---

### Story 4.4: Implement Delta Compression for Reduced Bandwidth

As a developer,
I want to reduce network bandwidth usage,
So that the game runs smoothly on mobile data and scales to 8 players.

**Acceptance Criteria:**

**Given** a match with 8 players
**When** the server broadcasts game state at 20 Hz
**Then** messages use delta compression (only send changed values)

**And** first state update: full snapshot (all player positions, health, etc.)
**And** subsequent updates: only deltas (changed values since last update)
**And** if player position changed: send `{id, x, y}`
**And** if player didn't move: omit from update
**And** if health changed: send `{id, health}`, else omit

**And** bandwidth usage per player: 2-5 KB/s (vs 10-15 KB/s without compression)
**And** full snapshots sent every 1 second (prevent delta drift)

**Prerequisites:** Story 4.3

**Technical Notes:**
- Server tracks last sent state per client: `lastSentState[clientId] = {players: {}, projectiles: {}}`
- Diff calculation: `for each entity, if (current !== lastSent) { include in delta }`
- Delta format: `{type: 'delta', changed: {players: [{id, x, y}], projectiles: [...]}}`
- Full snapshot: `{type: 'snapshot', full: {players: [...], weapons: [...]}}`
- Client applies deltas: merge with local state
- Handle missing deltas: full snapshot every 1s ensures consistency

---

### Story 4.5: Implement Lag Compensation for Hit Detection

As a player,
I want my shots to hit where enemies appeared on my screen,
So that the game feels fair despite latency differences.

**Acceptance Criteria:**

**Given** I shoot at an enemy who has 100ms ping
**When** I click to fire, enemy is at position {x: 500, y: 600} on my screen
**Then** the server rewinds the world state by my ping (50ms) plus enemy ping (50ms)

**And** server checks if shot hit enemy at their position 100ms ago
**And** if hit at rewound position: hit is counted (fair for shooter)
**And** enemy sees hit even though they already moved on their screen (minor trade-off)

**And** max rewind time: 150ms (prevent exploiting high latency)
**And** lag compensation applied to all hitscan weapons (instant bullets)
**And** projectile weapons (Uzi, AK47) don't rewind (projectile travel time is natural compensation)

**Prerequisites:** Story 4.4

**Technical Notes:**
- Server stores world history: last 200ms of positions (snapshots every 16ms = 60Hz)
- On hit check: rewind by `shooterPing + victimPing / 2` (clamp to 150ms max)
- Retrieve victim position from history at `now - rewindTime`
- Perform hit detection at rewound position
- If hit: apply damage at current time (all clients see damage simultaneously)
- Trade-off: shooter advantage (you hit what you see), victim can die around corners

---

### Story 4.6: Implement Artificial Latency Testing Tool

As a developer,
I want to simulate network latency in development,
So that I can test and tune netcode without needing poor connections.

**Acceptance Criteria:**

**Given** I am testing netcode locally
**When** I enable artificial latency via debug UI (press F8)
**Then** I can set latency value (e.g., 100ms) and packet loss % (e.g., 5%)

**And** all client-server messages are delayed by the set latency
**And** random packets are dropped based on packet loss percentage
**And** jitter simulation: latency varies +/-20ms randomly
**And** debug overlay shows current simulated conditions

**And** netcode behaves identically to real poor network conditions
**And** I can test prediction, interpolation, and lag compensation offline

**Prerequisites:** Story 4.5

**Technical Notes:**
- Client `NetworkSimulator.ts` wraps WebSocket send/receive
- Delay implementation: `setTimeout(() => actualSend(msg), latency + jitter())`
- Packet loss: `if (Math.random() < packetLossRate) { return; /* drop */ }`
- Jitter: `Math.random() * 40 - 20` (+/-20ms)
- Debug UI: sliders for latency (0-300ms) and loss (0-20%)
- Toggle: F8 key or URL param `?latency=100&loss=5`
- Server-side version: environment variable `SIMULATE_LATENCY=100`
