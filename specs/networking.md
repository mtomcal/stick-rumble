# Networking

> **Spec Version**: 1.1.0
> **Last Updated**: 2026-02-15
> **Depends On**: [messages.md](messages.md), [constants.md](constants.md)
> **Depended By**: [rooms.md](rooms.md), [client-architecture.md](client-architecture.md), [server-architecture.md](server-architecture.md)

---

## Overview

The networking layer provides real-time bidirectional communication between the game client and server using WebSocket connections. It handles connection establishment, message serialization, reconnection logic, graceful shutdown, and error handling.

**Why WebSocket?** WebSocket provides full-duplex communication over a single TCP connection, enabling low-latency real-time updates essential for multiplayer games. Unlike HTTP polling, WebSocket maintains a persistent connection that reduces overhead and enables server push—critical for broadcasting game state at 20 Hz without client polling.

**Why JSON over Binary?** JSON is used for message serialization because:
1. **Debuggability**: Messages are human-readable in browser DevTools
2. **Schema Validation**: TypeBox/Ajv can validate payloads at runtime
3. **Cross-Platform**: No endianness or struct packing concerns
4. **Performance**: For our message sizes (<1KB), JSON parsing overhead is negligible compared to network latency

---

## Dependencies

### Technology Dependencies

| Technology | Version | Purpose |
|------------|---------|---------|
| gorilla/websocket | v1.5.3 | Server WebSocket implementation (Go) |
| Browser WebSocket API | Native | Client WebSocket implementation |
| Ajv | 8.x | Client-side JSON Schema validation |
| @sinclair/typebox | ^0.34.27 | Schema definition and type inference |

### File Locations

| File | Purpose |
|------|---------|
| `stick-rumble-server/internal/network/websocket_handler.go` | WebSocket upgrade, message routing, ping/pong RTT |
| `stick-rumble-server/internal/network/message_processor.go` | Per-message-type handlers, broadcast callbacks |
| `stick-rumble-server/internal/network/broadcast_helper.go` | Player state broadcasts with delta compression |
| `stick-rumble-server/internal/network/delta_tracker.go` | Per-client delta compression state tracking |
| `stick-rumble-server/internal/network/network_simulator.go` | Server-side artificial latency/packet loss |
| `stick-rumble-server/internal/game/ping_tracker.go` | RTT measurement (circular buffer of 5) |
| `stick-rumble-server/internal/game/position_history.go` | Position rewind buffer for lag compensation |
| `stick-rumble-client/src/game/network/WebSocketClient.ts` | Client WebSocket wrapper with reconnect |
| `stick-rumble-client/src/game/network/NetworkSimulator.ts` | Client-side artificial latency/packet loss |

### Spec Dependencies

- [messages.md](messages.md) - Message type definitions and schemas
- [constants.md](constants.md) - Network timing constants (tick rates, reconnect delays)

---

## Constants

All networking constants are defined in [constants.md](constants.md#network-constants).

| Constant | Value | Unit | Description |
|----------|-------|------|-------------|
| SERVER_TICK_RATE | 60 | Hz | Server physics simulation rate |
| CLIENT_UPDATE_RATE | 20 | Hz | Broadcast rate to clients |
| CLIENT_UPDATE_INTERVAL | 50 | ms | Time between client updates |
| SERVER_TICK_INTERVAL | ~16.67 | ms | Time between server ticks |
| RECONNECT_ATTEMPTS | 3 | count | Maximum client reconnection attempts |
| RECONNECT_DELAY | 1000 | ms | Base delay between reconnection attempts |
| SEND_BUFFER_SIZE | 256 | messages | Server-side per-player send buffer |
| HTTP_READ_TIMEOUT | 15 | s | HTTP server read timeout |
| HTTP_WRITE_TIMEOUT | 15 | s | HTTP server write timeout |
| HTTP_IDLE_TIMEOUT | 60 | s | HTTP server idle timeout |
| GRACEFUL_SHUTDOWN_TIMEOUT | 30 | s | Maximum time to wait for graceful shutdown |

**Why 60 Hz server tick?** The server runs physics at 60 Hz to match typical display refresh rates, ensuring smooth interpolation on clients. This rate provides ~16.67ms precision for collision detection and movement.

**Why 20 Hz client updates?** Broadcasting at 20 Hz (every 50ms) balances bandwidth efficiency with visual smoothness. Higher rates provide diminishing returns due to network jitter, while lower rates cause visible stuttering.

**Why 256-message buffer?** The send buffer allows for burst traffic (e.g., multiple projectiles spawning) while preventing memory exhaustion from slow clients. If a client's buffer fills, messages are dropped with a warning log rather than blocking the game loop.

---

## Data Structures

### Message Format

The universal message format used for all WebSocket communication.

**Why this format?** Every message includes a `type` for routing, `timestamp` for debugging and latency measurement, and optional `data` for payload. This consistent structure enables generic message handling while supporting type-specific data.

**TypeScript:**
```typescript
interface Message {
  type: string;      // Message type identifier (e.g., "input:state", "player:move")
  timestamp: number; // Unix milliseconds when message was created
  data?: unknown;    // Optional payload specific to message type
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

### WebSocket Upgrader Configuration

Server-side configuration for HTTP-to-WebSocket upgrade.

**Why these buffer sizes?** 1024-byte buffers are sufficient for typical game messages (player state ~100 bytes, projectile spawn ~50 bytes) while keeping memory usage reasonable across many connections.

**Go:**
```go
var upgrader = websocket.Upgrader{
    ReadBufferSize:  1024,
    WriteBufferSize: 1024,
    CheckOrigin: func(r *http.Request) bool {
        // Development: Allow all origins
        // Production: Restrict to your domain
        return true
    },
}
```

### Client Connection State

Client-side state for managing WebSocket connection.

**Why these defaults?** 3 reconnection attempts with exponential backoff (1s, 2s, 4s) provide reasonable recovery from transient network issues without overwhelming the server during longer outages.

**TypeScript:**
```typescript
class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 3;
  private reconnectDelay: number = 1000; // ms
  private messageHandlers: Map<string, Set<(data: unknown) => void>> = new Map();
  private shouldReconnect: boolean = true;
}
```

---

## Behavior

### Connection Establishment

**Why this flow?** The server generates player IDs to ensure uniqueness and prevent client spoofing. The buffered send channel decouples message generation from socket writes, preventing game loop blocking on slow connections.

**Pseudocode:**
```
Client Connect:
    ws = new WebSocket("ws://server:port/ws")
    on open:
        log "WebSocket connected"
        reset reconnectAttempts to 0
        resolve connection promise
    on error:
        log error
        reject connection promise

Server Accept:
    upgrade HTTP to WebSocket
    generate UUID for player
    create buffered send channel (256 messages)
    create Player { ID, SendChan }
    log "Client connected: {playerID}"
    add player to RoomManager
    add player to GameServer
    start write goroutine (sendChan → conn.WriteMessage)
    enter message read loop
```

**TypeScript (Client):**
```typescript
connect(): Promise<void> {
  return new Promise((resolve, reject) => {
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
      resolve();
    };

    this.ws.onmessage = (event) => {
      try {
        const message: Message = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (err) {
        console.error('Failed to parse message:', err);
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      reject(error);
    };

    this.ws.onclose = (event) => {
      console.log('WebSocket closed:', event.code, event.reason);
      this.attemptReconnect();
    };
  });
}
```

**Go (Server):**
```go
func (h *WebSocketHandler) HandleWebSocket(w http.ResponseWriter, r *http.Request) {
    // Upgrade HTTP connection to WebSocket
    conn, err := upgrader.Upgrade(w, r, nil)
    if err != nil {
        log.Println("WebSocket upgrade failed:", err)
        return
    }
    defer conn.Close()

    // Create player with unique ID
    playerID := uuid.New().String()
    sendChan := make(chan []byte, 256)
    player := &game.Player{
        ID:       playerID,
        SendChan: sendChan,
    }

    log.Printf("Client connected: %s", playerID)

    // Add player to room manager (handles room:joined)
    room := h.roomManager.AddPlayer(player)
    h.gameServer.AddPlayer(playerID)

    // Start write goroutine
    done := make(chan struct{})
    go func() {
        defer close(done)
        for msg := range sendChan {
            if err := conn.WriteMessage(websocket.TextMessage, msg); err != nil {
                log.Printf("Write error for %s: %v", playerID, err)
                return
            }
        }
    }()

    // Message read loop
    for {
        _, messageBytes, err := conn.ReadMessage()
        if err != nil {
            if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
                log.Printf("WebSocket error: %v", err)
            }
            break
        }
        // ... process message
    }

    // Cleanup on disconnect
    h.roomManager.RemovePlayer(playerID)
    h.gameServer.RemovePlayer(playerID)
    close(sendChan)
    <-done
}
```

### Message Serialization

**Why JSON text frames?** WebSocket supports both text and binary frames. Text frames with JSON are used because:
1. Browser DevTools can inspect messages without additional tooling
2. JSON Schema validation is simpler than binary format validation
3. Go's `encoding/json` handles all edge cases (Unicode, escaping)

**Pseudocode:**
```
Client Send:
    if ws.readyState != OPEN:
        log warning
        return
    json = JSON.stringify(message)
    ws.send(json)

Server Send:
    msgBytes = json.Marshal(message)
    select:
        case player.SendChan <- msgBytes:
            // sent
        default:
            log "Channel full for player {ID}"
```

**TypeScript:**
```typescript
send(message: Message): void {
  if (this.ws && this.ws.readyState === WebSocket.OPEN) {
    this.ws.send(JSON.stringify(message));
  } else {
    console.warn('WebSocket not connected, cannot send message');
  }
}
```

**Go:**
```go
// Non-blocking send with drop on full buffer
func sendToPlayer(player *game.Player, msgBytes []byte) {
    // Recover from closed channel panics
    defer func() {
        if r := recover(); r != nil {
            log.Printf("Warning: Could not send to player %s (channel closed)", player.ID)
        }
    }()

    select {
    case player.SendChan <- msgBytes:
        // Sent successfully
    default:
        log.Printf("Warning: Could not send to player %s (channel full)", player.ID)
    }
}
```

### Message Routing

**Why switch-based routing?** A simple switch statement on message type provides O(1) routing, is easy to understand, and makes adding new message types straightforward. More complex routing (e.g., reflection-based) would add overhead without benefit.

**Pseudocode:**
```
Server Message Loop:
    for each received message:
        parse JSON into Message struct
        log "Received from {playerID}: type={type}"

        switch message.type:
            case "input:state":
                validate schema
                if match ended: ignore
                update player input in GameServer

            case "player:shoot":
                validate schema
                attempt shot via GameServer
                if success: broadcast projectile:spawn
                else: send shoot:failed

            case "player:reload":
                start reload via GameServer
                send weapon:state

            case "weapon:pickup_attempt":
                validate schema
                check crate exists and available
                check player proximity
                perform pickup
                broadcast weapon:pickup_confirmed

            case "player:dodge_roll":
                check if can roll
                start roll via GameServer
                broadcast roll:start

            case "player:melee_attack":
                validate schema
                attempt melee via GameServer
                broadcast melee:hit
                process damage/kills

            default:
                broadcast to room (backward compatibility)
```

**Go:**
```go
// In message loop
switch msg.Type {
case "input:state":
    h.handleInputState(playerID, msg.Data)

case "player:shoot":
    h.handlePlayerShoot(playerID, msg.Data)

case "player:reload":
    h.handlePlayerReload(playerID)

case "weapon:pickup_attempt":
    h.handleWeaponPickup(playerID, msg.Data)

case "player:dodge_roll":
    h.handlePlayerDodgeRoll(playerID)

case "player:melee_attack":
    h.handlePlayerMeleeAttack(playerID, msg.Data)

default:
    // Broadcast other messages to room
    room := h.roomManager.GetRoomByPlayerID(playerID)
    if room != nil {
        room.Broadcast(messageBytes, playerID)
    }
}
```

### Reconnection Logic

**Why exponential backoff?** Exponential backoff (1s, 2s, 4s) prevents reconnection storms that could overwhelm the server during transient outages while still providing fast recovery for single-connection issues.

**Why stop after 3 attempts?** If the server is down for more than ~7 seconds (1+2+4), it's likely a serious outage. Continuing to retry wastes resources and provides poor UX. Better to show an error and let the user manually retry.

**Pseudocode:**
```
Client Reconnect:
    if !shouldReconnect:
        return  // Intentional disconnect

    if reconnectAttempts >= maxReconnectAttempts:
        log "Max reconnection attempts reached"
        return

    reconnectAttempts++
    delay = reconnectDelay * 2^(reconnectAttempts - 1)  // 1s, 2s, 4s
    log "Reconnecting in {delay}ms... (attempt {reconnectAttempts})"

    setTimeout(delay):
        connect().catch(err => log "Reconnection failed")
```

**TypeScript:**
```typescript
private attemptReconnect(): void {
  // Don't reconnect if disconnect was intentional
  if (!this.shouldReconnect) {
    return;
  }

  if (this.reconnectAttempts >= this.maxReconnectAttempts) {
    console.error('Max reconnection attempts reached');
    return;
  }

  this.reconnectAttempts++;
  const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
  console.log(`Reconnecting in ${delay}ms... (attempt ${this.reconnectAttempts})`);

  setTimeout(() => {
    this.connect().catch(err => {
      console.error('Reconnection failed:', err);
    });
  }, delay);
}
```

### Intentional Disconnect

**Why set shouldReconnect=false?** Without this flag, closing the WebSocket would trigger reconnection attempts. Setting it before `close()` ensures clean disconnects don't waste resources on reconnection.

**Why code 1000?** WebSocket close code 1000 indicates a normal closure. This communicates to the server that the client is intentionally disconnecting, not experiencing an error.

**TypeScript:**
```typescript
disconnect(): void {
  this.shouldReconnect = false;  // Prevent reconnection attempts
  if (this.ws) {
    this.ws.close(1000, 'Client disconnect');
    this.ws = null;
  }
  // Clear all handlers to prevent memory leaks
  this.messageHandlers.clear();
}
```

### Graceful Server Shutdown

**Why 30-second timeout?** This provides enough time for:
1. Active game loops to complete their current tick
2. In-flight messages to be delivered
3. Clients to receive disconnect notifications

Longer timeouts delay deployments; shorter ones risk data loss.

**Pseudocode:**
```
Server Shutdown:
    on SIGTERM or SIGINT:
        log "Received signal: {signal}"
        cancel context  // Stops all goroutines

        // Graceful shutdown with timeout
        shutdownCtx = context with 30s timeout

        // Stop game server (stops tick and broadcast loops)
        gameServer.Stop()

        // Shutdown HTTP server (closes connections)
        httpServer.Shutdown(shutdownCtx)

        log "Server stopped"
```

**Go:**
```go
func main() {
    ctx, cancel := context.WithCancel(context.Background())
    defer cancel()

    // Handle shutdown signals
    sigChan := make(chan os.Signal, 1)
    signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

    go startServer(ctx)

    select {
    case sig := <-sigChan:
        log.Printf("Received signal: %v", sig)
        cancel()
        // Wait for graceful shutdown
    }
}

func startServer(ctx context.Context) error {
    // ... setup server ...

    select {
    case <-ctx.Done():
        shutdownCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
        defer cancel()

        log.Println("Shutting down server...")
        network.StopGlobalHandler()

        if err := server.Shutdown(shutdownCtx); err != nil {
            log.Printf("Server shutdown error: %v", err)
            return err
        }
        log.Println("Server stopped")
        return nil
    }
}
```

### Connection Cleanup

**Why wait for write goroutine?** Closing `sendChan` signals the write goroutine to exit. Waiting on the `done` channel ensures all queued messages are sent before the connection is truly closed.

**Go:**
```go
// On disconnect (after read loop exits)
h.roomManager.RemovePlayer(playerID)  // Broadcasts player:left
h.gameServer.RemovePlayer(playerID)   // Removes from physics simulation
close(sendChan)                        // Signals write goroutine to exit
<-done                                 // Wait for write goroutine to finish

log.Printf("Connection closed: %s", playerID)
```

---

## Error Handling

### Malformed JSON

**Trigger**: Client sends invalid JSON (syntax error, wrong encoding)
**Detection**: `json.Unmarshal` returns error
**Response**: Log error, ignore message, continue processing
**Client Notification**: None (client shouldn't send malformed JSON)
**Recovery**: Automatic (next message processed normally)

**Why ignore?** A single malformed message shouldn't disconnect the client. Logging helps debugging while ignoring preserves the connection.

```go
if err := json.Unmarshal(messageBytes, &msg); err != nil {
    log.Printf("Failed to parse message: %v", err)
    continue  // Skip this message, continue loop
}
```

### Unknown Message Type

**Trigger**: Client sends message with unrecognized `type` field
**Detection**: `switch` statement falls through to `default` case
**Response**: Broadcast to room for backward compatibility
**Client Notification**: None
**Recovery**: Automatic

**Why broadcast?** During development and testing, custom message types may be added. Broadcasting unknown types preserves flexibility without requiring server changes.

### Schema Validation Failure

**Trigger**: Message data doesn't match expected schema
**Detection**: Schema validator returns error
**Response**: Log error, ignore message
**Client Notification**: None
**Recovery**: Automatic

**Why validate?** Schema validation catches bugs early—a client sending wrong data types (e.g., `aimAngle: "45"` instead of `aimAngle: 45`) would cause crashes without validation.

```go
if err := h.validator.Validate("input-state-data", data); err != nil {
    log.Printf("Schema validation failed for input:state from %s: %v", playerID, err)
    return
}
```

### Channel Full (Buffer Overflow)

**Trigger**: Player's send buffer (256 messages) fills up due to slow client
**Detection**: Non-blocking send on channel fails
**Response**: Log warning, drop message
**Client Notification**: None (client likely unresponsive)
**Recovery**: Client continues receiving once caught up

**Why drop messages?** Blocking would pause the game loop for all players. Dropping is the lesser evil—the slow client will eventually receive state updates and resync.

```go
select {
case player.SendChan <- msgBytes:
    // Sent
default:
    log.Printf("Warning: Could not send to player %s (channel full)", player.ID)
}
```

### Connection Closed Unexpectedly

**Trigger**: Network failure, client crash, browser tab closed
**Detection**: `conn.ReadMessage()` returns error
**Response**: Clean up player from room and game server
**Client Notification**: Other players receive `player:left` message
**Recovery**: Client can reconnect (up to 3 attempts)

```go
_, messageBytes, err := conn.ReadMessage()
if err != nil {
    if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
        log.Printf("WebSocket error: %v", err)
    } else {
        log.Printf("Client disconnected: %s", playerID)
    }
    break  // Exit read loop, trigger cleanup
}
```

### Write Error

**Trigger**: Cannot write to WebSocket (connection broken)
**Detection**: `conn.WriteMessage()` returns error
**Response**: Log error, exit write goroutine
**Client Notification**: Connection closes, triggering client reconnect
**Recovery**: Client reconnects automatically

```go
for msg := range sendChan {
    if err := conn.WriteMessage(websocket.TextMessage, msg); err != nil {
        log.Printf("Write error for %s: %v", playerID, err)
        return  // Exit goroutine
    }
}
```

---

## Delta Compression

The server tracks per-client state and only sends changes, reducing bandwidth for the 20 Hz broadcast.

**Why delta compression?** Sending full state for 8 players × 20 Hz = 160 full messages/second per client. Most frames only 1-2 players change position. Delta compression cuts bandwidth by ~60-80%.

### Message Types

| Type | When Sent | Content |
|------|-----------|---------|
| `state:snapshot` | Every 1 second (or first update) | Full state: all players, projectiles, weapon crates |
| `state:delta` | Every 50ms between snapshots | Only changed players, added/removed projectiles |

Both message types include `lastProcessedSequence` — a map of playerID → input sequence number, used by clients for reconciliation (see [movement.md](movement.md#server-reconciliation)).

### Change Detection Thresholds

| Property | Threshold | Why |
|----------|-----------|-----|
| Position (x, y) | 0.1 px | Sub-pixel changes are invisible |
| Velocity (vx, vy) | 0.1 px/s | Negligible motion |
| Aim angle | 0.01 rad (~0.57°) | Imperceptible rotation |
| Health | Any change | Always relevant |
| Boolean flags | Any change | isDead, isInvulnerable, isRolling, isRegeneratingHealth |
| Stats (kills, deaths, XP) | Any change | Always relevant |

### Per-Client State Tracking

```go
type ClientState struct {
    LastSnapshot       time.Time
    LastPlayerStates   map[string]game.PlayerStateSnapshot
    LastProjectileIDs  map[string]bool
    LastWeaponCrateIDs map[string]bool
}
```

`DeltaTracker` maintains a `ClientState` per connected client. On each broadcast cycle:

1. Check `ShouldSendSnapshot(clientID)` — returns true if ≥1 second since last full snapshot
2. If snapshot: send `state:snapshot` with all entities, reset client state
3. If delta: compute changed players via `ComputePlayerDelta()`, compute added/removed projectiles via `ComputeProjectileDelta()`, send `state:delta`

### Snapshot vs Delta Payload

**`state:snapshot`:**
```json
{
  "players": [{ "id": "...", "x": 100, "y": 200, "vx": 0, "vy": 0, "health": 100, ... }],
  "projectiles": [{ "id": "...", "x": 500, "y": 300, ... }],
  "weaponCrates": [{ "id": "...", "type": "uzi", "available": true, ... }],
  "lastProcessedSequence": { "player1": 42, "player2": 38 },
  "correctedPlayers": ["player1"]
}
```

**`state:delta`:**
```json
{
  "players": [{ "id": "...", "x": 101, "y": 200, ... }],
  "projectilesAdded": [{ "id": "...", ... }],
  "projectilesRemoved": ["proj-123"],
  "lastProcessedSequence": { "player1": 43, "player2": 39 },
  "correctedPlayers": []
}
```

---

## Ping Tracking

RTT is measured using WebSocket ping/pong frames for lag compensation.

**Why ping/pong?** WebSocket has built-in ping/pong support (RFC 6455). The server sends a ping every 2 seconds; the browser automatically responds with a pong. RTT = pong receive time − ping send time.

### Implementation

```go
type PingTracker struct {
    measurements [5]int64     // Last 5 RTT samples (milliseconds)
    index        int          // Circular write position
    count        int          // Samples recorded (max 5)
}
```

- `RecordRTT(rtt)` — stores millisecond RTT in circular buffer
- `GetRTT()` — returns average of all recorded measurements
- Ping interval: 2 seconds (set in `websocket_handler.go`)
- Log: `"Player %s RTT: %dms (avg: %dms)"`

**Why 5 samples?** Averaging 5 measurements (10 seconds of pings) smooths out jitter while remaining responsive to network changes.

### Integration with Lag Compensation

The average RTT from `PingTracker.GetRTT()` is used by the hit detection system to rewind player positions. See [hit-detection.md](hit-detection.md) for the rewinding algorithm.

---

## Network Simulator

Both server and client support artificial network conditions for testing prediction, reconciliation, and interpolation under degraded networks.

### Server-Side (`network_simulator.go`)

Configured via environment variables:

| Variable | Range | Default | Purpose |
|----------|-------|---------|---------|
| `SIMULATE_LATENCY` | 0–300 ms | 0 (disabled) | Base one-way latency |
| `SIMULATE_PACKET_LOSS` | 0–20% | 0 (disabled) | Random packet drop rate |

**Jitter**: ±20ms random variation added to base latency.

**Integration**: Wraps `conn.WriteMessage()` in the write goroutine. If enabled, messages are delayed via `time.AfterFunc()` and randomly dropped.

### Client-Side (`NetworkSimulator.ts`)

Mirrors server-side API:

```typescript
interface NetworkSimulatorStats {
  enabled: boolean;
  latency: number;
  packetLoss: number;
}
```

- `simulateSend(message, sendFn)` — delays outgoing messages
- `simulateReceive(message, receiveFn)` — delays incoming messages
- `calculateDelay()` — returns latency ± 20ms jitter
- `shouldDropPacket()` — random drop based on loss percentage

---

## Input Sequence Numbers

Every `input:state` message includes a `sequence` number for client-side prediction reconciliation.

**Flow:**
1. Client assigns incrementing sequence number to each input
2. Server processes input and tracks `lastProcessedSequence` per player
3. Server includes `lastProcessedSequence` map in every `state:snapshot` and `state:delta`
4. Client discards input history entries with sequence ≤ `lastProcessedSequence`
5. Client replays remaining (unprocessed) inputs on top of server state

See [movement.md](movement.md#server-reconciliation) for the full reconciliation algorithm.

---

## Implementation Notes

### TypeScript (Client)

**Message Handler Pattern**:
```typescript
// Register handler
client.on('player:move', (data) => {
  const moveData = data as PlayerMoveData;
  updatePlayerPosition(moveData.playerId, moveData.position);
});

// Remove handler (important for cleanup)
client.off('player:move', handler);
```

**Validated Send Methods**: The client provides type-safe send methods that validate data against schemas before sending:

```typescript
sendInputState(data: InputStateData): void {
  if (!validateInputState(data)) {
    console.error('Validation failed:', validateInputState.errors);
    return;
  }
  this.send({ type: 'input:state', timestamp: Date.now(), data });
}
```

**Handler Cleanup**: Always remove handlers when components unmount to prevent memory leaks:

```typescript
// In Phaser scene
create() {
  this.moveHandler = (data) => this.onPlayerMove(data);
  this.wsClient.on('player:move', this.moveHandler);
}

destroy() {
  this.wsClient.off('player:move', this.moveHandler);
}
```

### Go (Server)

**Thread Safety**: All shared state access uses mutexes:
- `Room.mu` - Protects player list within a room
- `RoomManager.mu` - Protects room and player mappings
- `World.mu` - Protects player state map
- `GameServer.weaponMu` - Protects weapon states

**Singleton Handler**: A global `WebSocketHandler` instance ensures all connections share room state:

```go
var globalHandler *WebSocketHandler
var globalHandlerOnce sync.Once

func getGlobalHandler() *WebSocketHandler {
    globalHandlerOnce.Do(func() {
        globalHandler = NewWebSocketHandler()
    })
    return globalHandler
}
```

**Context Propagation**: All long-running goroutines accept a `context.Context` for graceful shutdown:

```go
func (gs *GameServer) tickLoop(ctx context.Context) {
    ticker := time.NewTicker(gs.tickRate)
    defer ticker.Stop()

    for {
        select {
        case <-ctx.Done():
            log.Println("Game tick loop stopped")
            return
        case now := <-ticker.C:
            gs.updateAllPlayers(deltaTime)
        }
    }
}
```

**Panic Recovery**: Channel operations recover from panics to handle closed channels:

```go
func() {
    defer func() {
        if r := recover(); r != nil {
            log.Printf("Warning: Channel closed for player %s", player.ID)
        }
    }()
    player.SendChan <- msgBytes
}()
```

---

## Test Scenarios

### TS-NET-001: WebSocket Connection Established

**Category**: Integration
**Priority**: Critical

**Preconditions:**
- Server is running on configured port

**Input:**
- Client calls `connect()` with server URL

**Expected Output:**
- Promise resolves
- `console.log('WebSocket connected')` logged
- `reconnectAttempts` reset to 0

**Pseudocode:**
```
test "WebSocket connection established":
    setup: start server
    action: client.connect()
    assert: connection promise resolves
    assert: ws.readyState == WebSocket.OPEN
```

### TS-NET-002: Message Serialized as JSON

**Category**: Unit
**Priority**: Critical

**Preconditions:**
- WebSocket connection is open

**Input:**
- Message object `{ type: "test", timestamp: 123, data: { foo: "bar" } }`

**Expected Output:**
- WebSocket sends `{"type":"test","timestamp":123,"data":{"foo":"bar"}}`

**Pseudocode:**
```
test "message serialized as JSON":
    setup: mock WebSocket.send
    action: client.send({ type: "test", timestamp: 123, data: { foo: "bar" } })
    assert: send called with JSON string
```

### TS-NET-003: Malformed JSON Ignored

**Category**: Unit
**Priority**: High

**Preconditions:**
- Client connected to server

**Input:**
- Raw bytes: `{invalid json`

**Expected Output:**
- Error logged: "Failed to parse message"
- Connection remains open
- Server continues processing subsequent messages

**Go:**
```go
func TestMalformedJSONIgnored(t *testing.T) {
    // ... setup mock connection ...

    // Send malformed JSON
    conn.WriteMessage(websocket.TextMessage, []byte("{invalid"))

    // Send valid message
    validMsg := Message{Type: "test", Timestamp: time.Now().UnixMilli()}
    conn.WriteJSON(validMsg)

    // Assert second message processed
}
```

### TS-NET-004: Unknown Message Type Broadcast

**Category**: Integration
**Priority**: Medium

**Preconditions:**
- Two players in same room

**Input:**
- Player 1 sends `{ type: "custom:event", timestamp: 123, data: {} }`

**Expected Output:**
- Player 2 receives the message
- Player 1 does not receive own message

### TS-NET-005: Client Reconnects on Disconnect

**Category**: Integration
**Priority**: High

**Preconditions:**
- Client connected
- `shouldReconnect` is true

**Input:**
- Server closes connection

**Expected Output:**
- `onclose` handler triggered
- `attemptReconnect()` called
- New connection attempted after 1000ms

**TypeScript:**
```typescript
it('should reconnect on unexpected disconnect', async () => {
  const client = new WebSocketClient(serverUrl);
  await client.connect();

  // Force disconnect
  mockServer.close();

  // Wait for reconnect attempt
  await new Promise(r => setTimeout(r, 1500));

  expect(client.reconnectAttempts).toBe(1);
});
```

### TS-NET-006: Max 3 Reconnect Attempts

**Category**: Unit
**Priority**: High

**Preconditions:**
- Client failed to connect

**Input:**
- Server unreachable for all 3 attempts

**Expected Output:**
- `reconnectAttempts` increments to 3
- After third failure, "Max reconnection attempts reached" logged
- No further reconnection attempts

### TS-NET-007: Server Graceful Shutdown

**Category**: Integration
**Priority**: Critical

**Preconditions:**
- Server running with connected clients

**Input:**
- Send SIGTERM to server process

**Expected Output:**
- Server logs "Shutting down server..."
- Game server stops (tick/broadcast loops exit)
- HTTP server shuts down within 30 seconds
- Server logs "Server stopped"

**Go:**
```go
func TestGracefulShutdown(t *testing.T) {
    ctx, cancel := context.WithCancel(context.Background())

    go startServer(ctx)
    // ... connect clients ...

    cancel()  // Trigger shutdown

    // Assert server stopped within timeout
}
```

### TS-NET-008: Player Removed on Disconnect

**Category**: Integration
**Priority**: Critical

**Preconditions:**
- Player in room with other players

**Input:**
- Player disconnects (close browser tab)

**Expected Output:**
- Player removed from room
- `player:left` message broadcast to remaining players
- Player removed from game server physics

### TS-NET-009: Input Rate Not Enforced (Server Trust)

**Category**: Unit
**Priority**: Medium

**Preconditions:**
- Player connected to server

**Input:**
- Client sends `input:state` faster than 20 Hz

**Expected Output:**
- All messages accepted (server trusts client input)
- Note: Excessive input may be rate-limited in future

**Why no server-side rate limiting?** The server currently trusts client input because:
1. Malicious fast input doesn't provide gameplay advantage
2. Rate limiting adds complexity and latency
3. Client-side enforcement (50ms minimum) is sufficient for normal clients

### TS-NET-010: Bidirectional Communication

**Category**: Integration
**Priority**: Critical

**Preconditions:**
- Client connected to server

**Input:**
- Client sends `input:state`
- Server broadcasts `player:move`

**Expected Output:**
- Server receives client message
- Client receives server message
- Round-trip completed

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-02-02 | Initial specification |
| 1.1.0 | 2026-02-15 | Added Delta Compression section (state:snapshot/state:delta, per-client tracking, change thresholds). Added Ping Tracking section (ping/pong RTT, circular buffer). Added Network Simulator section (server + client, env vars). Added Input Sequence Numbers section. Added File Locations table with new files (delta_tracker.go, ping_tracker.go, position_history.go, network_simulator.go, NetworkSimulator.ts, message_processor.go, broadcast_helper.go). |
