# Story 1.4: Implement Basic Game Room with 2-Player Synchronization

Status: drafted

## Story

As a developer,
I want a basic game room that synchronizes player positions between 2 clients,
So that the multiplayer foundation is proven to work.

## Acceptance Criteria

1. **Given** 2 clients connect to the server **When** the server creates a room and assigns both players **Then** both clients receive `room:joined` messages with player IDs

2. **And** when Player 1 sends `player:move` with position {x: 100, y: 200} **Then** Player 2 receives `game:state` update showing Player 1 at {x: 100, y: 200}

3. **And** when Player 2 sends `player:move` with position {x: 300, y: 400} **Then** Player 1 receives `game:state` update showing Player 2 at {x: 300, y: 400}

4. **And** both players' stick figures render on screen at synchronized positions

5. **And** movement feels responsive (<100ms visual update)

6. **And** disconnection of one player removes them from other player's view

## Tasks / Subtasks

- [ ] Implement Room data structure on server (AC: #1, #6)
  - [ ] Create `internal/game/room.go` file with Room struct
  - [ ] Add Room fields: ID, Players map, mutex, stopChan, tickCount
  - [ ] Create Player struct: ID, Conn, Position, Keys
  - [ ] Define Position struct: X, Y (float64)
  - [ ] Implement NewRoom(id string) constructor
  - [ ] Set max players constant to 8

- [ ] Implement room player management (AC: #1, #6)
  - [ ] Implement AddPlayer(playerID string, conn *websocket.Conn) method
  - [ ] Check room capacity (reject if >= 8 players)
  - [ ] Initialize player position with offset spawn (100 + player_count*50, 100)
  - [ ] Send `room:joined` message to joining player with roomId and playerId
  - [ ] Implement RemovePlayer(playerID string) method
  - [ ] Clean up player from Players map
  - [ ] Log player join/leave events with room population count

- [ ] Implement server game loop (AC: #2, #3, #5)
  - [ ] Define tick rate constant: 60 Hz (TickDuration = 16.67ms)
  - [ ] Define broadcast rate constant: 20 Hz (every 3 ticks)
  - [ ] Implement Run() method with time.Ticker loop
  - [ ] Create tick() method for game logic updates
  - [ ] Increment tickCount on each tick
  - [ ] Call broadcastState() every 3 ticks (20 Hz)
  - [ ] Handle stopChan signal to gracefully stop loop
  - [ ] Log game loop start and stop events

- [ ] Implement player input processing (AC: #2, #3)
  - [ ] Create ProcessInput(playerID string, keys []string) method
  - [ ] Define moveSpeed constant: 3.33 px/tick (200 px/s at 60 Hz)
  - [ ] Process 'w' key: decrease Y by moveSpeed
  - [ ] Process 's' key: increase Y by moveSpeed
  - [ ] Process 'a' key: decrease X by moveSpeed
  - [ ] Process 'd' key: increase X by moveSpeed
  - [ ] Update player.Keys field with current keys
  - [ ] Use mutex to protect concurrent access

- [ ] Implement state broadcasting (AC: #2, #3, #5)
  - [ ] Create broadcastState() method
  - [ ] Collect all player states into []PlayerState slice
  - [ ] Create Message with type "game:state"
  - [ ] Include tick count and players array in data
  - [ ] Send message to all players using WriteJSON
  - [ ] Handle write errors and log failures
  - [ ] Add timestamp to message (time.Now().UnixMilli())

- [ ] Update WebSocket handler to use Room (AC: #1, #6)
  - [ ] Update `internal/network/websocket_handler.go`
  - [ ] Create global currentRoom variable (single room for MVP)
  - [ ] Initialize room in init() function and start game loop
  - [ ] Generate unique player ID using uuid.New().String()
  - [ ] Call AddPlayer on connection
  - [ ] Defer RemovePlayer on disconnect
  - [ ] Update message routing to handle "player:move" messages
  - [ ] Extract keys from message data
  - [ ] Call room.ProcessInput with player ID and keys

- [ ] Implement client input sending (AC: #2, #3)
  - [ ] Update `src/game/scenes/GameScene.ts`
  - [ ] Store myPlayerId from room:joined message
  - [ ] Create Phaser keyboard input (createCursorKeys)
  - [ ] Create time event to send inputs every 50ms (20 Hz)
  - [ ] Check which WASD keys are pressed
  - [ ] Send `player:move` message with keys array
  - [ ] Include timestamp in message

- [ ] Implement client state rendering (AC: #2, #3, #4, #6)
  - [ ] Create playerSprites Map<string, Phaser.GameObjects.Rectangle>
  - [ ] Register handler for "game:state" messages
  - [ ] Define GameState and PlayerState TypeScript interfaces
  - [ ] Iterate through received players in state
  - [ ] Create new sprite for new players (20x40 rectangle)
  - [ ] Use green color for self (0x00ff00), red for others (0xff0000)
  - [ ] Update sprite position to match state
  - [ ] Add text label "You" or "Other" above each player
  - [ ] Remove sprites for disconnected players
  - [ ] Update label positions with sprite positions

- [ ] Add visual feedback and UI elements (AC: #4, #5)
  - [ ] Display player ID on screen (substring first 8 chars)
  - [ ] Display "Use WASD to move" instructions
  - [ ] Add connection status display
  - [ ] Ensure sprites are visible on dark/light backgrounds
  - [ ] Verify 20x40 sprite size is appropriate

- [ ] Testing and validation (All ACs)
  - [ ] Write unit tests for Room (room_test.go)
  - [ ] Test AddPlayer increments player count
  - [ ] Test ProcessInput updates player position
  - [ ] Test RemovePlayer decrements player count
  - [ ] Test room capacity enforcement (max 8 players)
  - [ ] Manual test: Open 2 browser tabs
  - [ ] Verify both see 2 rectangles (green + red)
  - [ ] Verify WASD movement synchronizes between tabs
  - [ ] Verify closing one tab removes sprite from other tab
  - [ ] Measure latency (should be <100ms local network)

## Dev Notes

### Technical Requirements

**Server Room Implementation:**

**internal/game/room.go:**
```go
package game

import (
    "encoding/json"
    "log"
    "sync"
    "time"
    "github.com/gorilla/websocket"
)

const (
    MaxPlayers   = 8
    TickRate     = 60                           // Server ticks per second
    TickDuration = time.Second / TickRate       // 16.67ms
    BroadcastRate = 20                          // Client updates per second
    BroadcastInterval = TickRate / BroadcastRate // Every 3 ticks
)

type Position struct {
    X float64 `json:"x"`
    Y float64 `json:"y"`
}

type PlayerState struct {
    ID       string   `json:"id"`
    Position Position `json:"position"`
    Keys     []string `json:"keys"`
}

type Room struct {
    ID       string
    Players  map[string]*Player
    mutex    sync.RWMutex
    stopChan chan struct{}
    tickCount uint64
}

type Player struct {
    ID       string
    Conn     *websocket.Conn
    Position Position
    Keys     []string
}

func NewRoom(id string) *Room {
    return &Room{
        ID:       id,
        Players:  make(map[string]*Player),
        stopChan: make(chan struct{}),
    }
}

func (r *Room) AddPlayer(playerID string, conn *websocket.Conn) {
    r.mutex.Lock()
    defer r.mutex.Unlock()

    if len(r.Players) >= MaxPlayers {
        log.Printf("Room %s is full, rejecting player %s", r.ID, playerID)
        return
    }

    r.Players[playerID] = &Player{
        ID:       playerID,
        Conn:     conn,
        Position: Position{X: 100 + float64(len(r.Players)*50), Y: 100}, // Offset spawns
        Keys:     []string{},
    }

    log.Printf("Player %s joined room %s (%d/%d)", playerID, r.ID, len(r.Players), MaxPlayers)

    // Send join confirmation
    r.sendToPlayer(playerID, Message{
        Type:      "room:joined",
        Timestamp: time.Now().UnixMilli(),
        Data: map[string]interface{}{
            "roomId":   r.ID,
            "playerId": playerID,
        },
    })
}

func (r *Room) RemovePlayer(playerID string) {
    r.mutex.Lock()
    defer r.mutex.Unlock()

    delete(r.Players, playerID)
    log.Printf("Player %s left room %s (%d/%d)", playerID, r.ID, len(r.Players), MaxPlayers)
}

func (r *Room) ProcessInput(playerID string, keys []string) {
    r.mutex.Lock()
    defer r.mutex.Unlock()

    player, exists := r.Players[playerID]
    if !exists {
        return
    }

    // Simple movement (200 px/s at 60 ticks/s = 3.33 px per tick)
    const moveSpeed = 3.33

    for _, key := range keys {
        switch key {
        case "w":
            player.Position.Y -= moveSpeed
        case "s":
            player.Position.Y += moveSpeed
        case "a":
            player.Position.X -= moveSpeed
        case "d":
            player.Position.X += moveSpeed
        }
    }

    player.Keys = keys
}

func (r *Room) Run() {
    ticker := time.NewTicker(TickDuration)
    defer ticker.Stop()

    log.Printf("Room %s game loop started", r.ID)

    for {
        select {
        case <-ticker.C:
            r.tick()
            r.tickCount++

            // Broadcast every 3 ticks (20 Hz)
            if r.tickCount%BroadcastInterval == 0 {
                r.broadcastState()
            }

        case <-r.stopChan:
            log.Printf("Room %s game loop stopped", r.ID)
            return
        }
    }
}

func (r *Room) tick() {
    // Future: Game logic updates happen here
    // For now, position updates handled in ProcessInput
}

func (r *Room) broadcastState() {
    r.mutex.RLock()
    defer r.mutex.RUnlock()

    // Collect player states
    playerStates := make([]PlayerState, 0, len(r.Players))
    for _, player := range r.Players {
        playerStates = append(playerStates, PlayerState{
            ID:       player.ID,
            Position: player.Position,
            Keys:     player.Keys,
        })
    }

    message := Message{
        Type:      "game:state",
        Timestamp: time.Now().UnixMilli(),
        Data: map[string]interface{}{
            "tick":    r.tickCount,
            "players": playerStates,
        },
    }

    // Send to all players
    for _, player := range r.Players {
        if err := player.Conn.WriteJSON(message); err != nil {
            log.Printf("Failed to send state to player %s: %v", player.ID, err)
        }
    }
}

func (r *Room) sendToPlayer(playerID string, message Message) {
    r.mutex.RLock()
    player, exists := r.Players[playerID]
    r.mutex.RUnlock()

    if !exists {
        return
    }

    if err := player.Conn.WriteJSON(message); err != nil {
        log.Printf("Failed to send message to player %s: %v", playerID, err)
    }
}

func (r *Room) Stop() {
    close(r.stopChan)
}

type Message struct {
    Type      string                 `json:"type"`
    Timestamp int64                  `json:"timestamp"`
    Data      map[string]interface{} `json:"data"`
}
```

**Client Implementation:**

**src/game/scenes/GameScene.ts (updated):**
```typescript
import Phaser from 'phaser';
import { WebSocketClient, Message } from '../network/WebSocketClient';

interface Position {
  x: number;
  y: number;
}

interface PlayerState {
  id: string;
  position: Position;
  keys: string[];
}

interface GameState {
  tick: number;
  players: PlayerState[];
}

export class GameScene extends Phaser.Scene {
  private wsClient!: WebSocketClient;
  private myPlayerId: string = '';
  private playerSprites: Map<string, Phaser.GameObjects.Rectangle> = new Map();
  private keys!: Phaser.Types.Input.Keyboard.CursorKeys;

  constructor() {
    super({ key: 'GameScene' });
  }

  create() {
    // Setup input
    this.keys = this.input.keyboard!.createCursorKeys();

    // Connect to server
    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8080/ws';
    this.wsClient = new WebSocketClient(wsUrl);

    this.wsClient.connect()
      .then(() => {
        console.log('Connected to server!');
      })
      .catch(err => {
        console.error('Failed to connect:', err);
      });

    // Message handlers
    this.wsClient.on('room:joined', (data: any) => {
      this.myPlayerId = data.playerId;
      console.log('Joined room:', data.roomId, 'as player:', data.playerId);

      this.add.text(10, 10, `Player ID: ${data.playerId.substring(0, 8)}`, {
        fontSize: '16px',
        color: '#00ff00'
      });
    });

    this.wsClient.on('game:state', (data: GameState) => {
      this.updateGameState(data);
    });

    // Send inputs to server
    this.time.addEvent({
      delay: 50, // 20 Hz input send rate
      loop: true,
      callback: () => this.sendInputs()
    });

    // Display instructions
    this.add.text(10, 40, 'Use WASD to move', {
      fontSize: '14px',
      color: '#ffffff'
    });
  }

  private sendInputs(): void {
    const keys: string[] = [];

    if (this.keys.up?.isDown) keys.push('w');
    if (this.keys.down?.isDown) keys.push('s');
    if (this.keys.left?.isDown) keys.push('a');
    if (this.keys.right?.isDown) keys.push('d');

    if (keys.length > 0 || this.playerSprites.has(this.myPlayerId)) {
      this.wsClient.send({
        type: 'player:move',
        timestamp: Date.now(),
        data: { keys }
      });
    }
  }

  private updateGameState(state: GameState): void {
    // Update/create sprites for each player
    state.players.forEach(playerState => {
      let sprite = this.playerSprites.get(playerState.id);

      if (!sprite) {
        // Create new sprite (black rectangle for stick figure placeholder)
        const color = playerState.id === this.myPlayerId ? 0x00ff00 : 0xff0000;
        sprite = this.add.rectangle(
          playerState.position.x,
          playerState.position.y,
          20,
          40,
          color
        );
        this.playerSprites.set(playerState.id, sprite);

        // Label
        const label = this.add.text(
          playerState.position.x - 30,
          playerState.position.y - 30,
          playerState.id === this.myPlayerId ? 'You' : 'Other',
          { fontSize: '12px', color: '#ffffff' }
        );
        label.setDepth(1);
        (sprite as any).label = label; // Store reference
      }

      // Update position
      sprite.setPosition(playerState.position.x, playerState.position.y);

      // Update label position
      const label = (sprite as any).label;
      if (label) {
        label.setPosition(playerState.position.x - 30, playerState.position.y - 30);
      }
    });

    // Remove disconnected players
    this.playerSprites.forEach((sprite, playerId) => {
      if (!state.players.find(p => p.id === playerId)) {
        sprite.destroy();
        (sprite as any).label?.destroy();
        this.playerSprites.delete(playerId);
      }
    });
  }
}
```

**Updated WebSocket Handler:**

**internal/network/websocket_handler.go (updated):**
```go
package network

import (
    "log"
    "net/http"
    "github.com/google/uuid"
    "github.com/gorilla/websocket"
    "github.com/yourusername/stick-rumble-server/internal/game"
)

var (
    upgrader = websocket.Upgrader{
        ReadBufferSize:  1024,
        WriteBufferSize: 1024,
        CheckOrigin: func(r *http.Request) bool {
            return true // MVP: allow all origins
        },
    }

    // Simple in-memory room manager (will be extracted later)
    currentRoom *game.Room
)

func init() {
    // Create default room for testing
    currentRoom = game.NewRoom("room_001")
    go currentRoom.Run() // Start game loop
}

func HandleWebSocket(w http.ResponseWriter, r *http.Request) {
    conn, err := upgrader.Upgrade(w, r, nil)
    if err != nil {
        log.Println("WebSocket upgrade failed:", err)
        return
    }
    defer conn.Close()

    playerID := uuid.New().String()
    log.Println("Client connected:", playerID)

    // Add player to room
    currentRoom.AddPlayer(playerID, conn)
    defer currentRoom.RemovePlayer(playerID)

    // Message handling loop
    for {
        var msg game.Message
        if err := conn.ReadJSON(&msg); err != nil {
            log.Println("Client disconnected:", err)
            break
        }

        // Route message based on type
        switch msg.Type {
        case "player:move":
            keys, ok := msg.Data["keys"].([]interface{})
            if !ok {
                continue
            }

            keyStrings := make([]string, len(keys))
            for i, k := range keys {
                keyStrings[i] = k.(string)
            }

            currentRoom.ProcessInput(playerID, keyStrings)

        default:
            log.Printf("Unknown message type: %s", msg.Type)
        }
    }
}
```

### Architecture Patterns and Constraints

**Game Loop Architecture:**
- **Server Authoritative:** Server runs game loop at 60 Hz, clients are display-only
- **Tick Rate:** 60 ticks/second (TickDuration = 16.67ms)
- **Broadcast Rate:** 20 Hz (every 3 ticks) to reduce bandwidth
- **Future-proof:** Tick loop structure ready for physics, collision, etc.

**Movement Model:**
- **Speed:** 200 pixels/second = 3.33 pixels/tick at 60 Hz
- **Input Model:** Client sends key states, server calculates positions
- **No Client Prediction:** MVP uses simple server-only position updates
- **Future:** Epic 4 will add client-side prediction for responsiveness

**Room Management:**
- **Single Room:** MVP uses one global room for simplicity
- **Max Players:** 8 (constant, easy to change later)
- **UUID Player IDs:** Unique identifiers using google/uuid
- **Future:** Epic 5 will add matchmaking and multiple rooms

**Synchronization:**
- **State Format:** Server broadcasts full player states every 50ms
- **Position Format:** {x: float64, y: float64} in pixels
- **Coordinate System:** Phaser canvas coordinates (top-left origin)
- **Update Frequency:** 20 Hz balances responsiveness and bandwidth

**Concurrency Safety:**
- **Mutex Protection:** RWMutex protects Room.Players map
- **Read Lock:** Used for broadcasting (multiple concurrent reads safe)
- **Write Lock:** Used for AddPlayer, RemovePlayer, ProcessInput
- **WebSocket Safety:** gorilla/websocket handles concurrent writes internally

### Testing Standards Summary

**Server Unit Tests (Go):**
- Test Room creation and initialization
- Test AddPlayer with capacity enforcement
- Test ProcessInput position calculation
- Test RemovePlayer cleanup
- Test concurrent access safety (difficult, may skip for MVP)

**Client Tests (TypeScript/Vitest):**
- Test GameState interface parsing
- Test sprite creation logic
- Test sprite cleanup on disconnect
- Integration testing via manual browser testing

**Manual Integration Testing:**
1. Start server: `go run cmd/server/main.go`
2. Start client: `npm run dev`
3. Open 2 browser tabs at localhost:5173
4. Verify both tabs show 2 rectangles (1 green, 1 red each)
5. Press WASD in tab 1 → Verify movement in tab 2
6. Press WASD in tab 2 → Verify movement in tab 1
7. Close tab 1 → Verify sprite disappears in tab 2
8. Measure latency with browser network tools (<100ms target)

### Project Structure Notes

**New Files Created:**
- `internal/game/room.go` - Room and Player structs, game loop logic
- `internal/game/room_test.go` - Room unit tests

**Modified Files:**
- `internal/network/websocket_handler.go` - Add room integration, player:move routing
- `src/game/scenes/GameScene.ts` - Add input sending, state rendering, sprite management

**Dependencies:**
- `github.com/google/uuid` - Generate unique player IDs (already in go.mod from Story 1.2)

### Learnings from Previous Story

**From Story 1.3: Establish WebSocket Connection (Status: done)**

**Successfully Completed:**
- ✅ Bidirectional WebSocket communication working (client ↔ server)
- ✅ JSON message protocol implemented: `{type: string, timestamp: number, data?: any}`
- ✅ WebSocketClient wrapper class with reconnection logic (exponential backoff)
- ✅ Message routing system via handler registry (Map<type, handler>)
- ✅ All 16 tests passing (5 Go + 14 TypeScript)
- ✅ gorilla/websocket@v1.5.3 fully operational
- ✅ Environment configuration via VITE_WS_URL working

**Key Patterns to Reuse:**
- **Message Format:** Already established `{type, timestamp, data}` - continue using
- **Message Routing:** Client-side `wsClient.on(type, handler)` pattern works well
- **Error Handling:** Log errors, handle gracefully, don't crash server
- **Testing Pattern:** httptest for WebSocket handlers, Vitest mocks for client

**WebSocket Infrastructure Available:**
- `WebSocketClient.ts` ready to use - just add new message handlers
- `websocket_handler.go` ready to extend - just add new message types to switch
- Connection stability proven - ready for higher message volume

**Technical Debt from Story 1.3:**
- ⚠️ No message validation (accepts any JSON) - acceptable for MVP, server ignores unknown types
- ⚠️ CORS allows all origins (CheckOrigin returns true) - must restrict in production
- ⚠️ No authentication yet - Epic 6 will add OAuth

**Review Findings from Story 1.3:**
- Perfect architecture alignment - continue same patterns
- Excellent test coverage (16/16 passing) - maintain same standard
- Message protocol well-designed - extensible for new types
- Reconnection logic robust - no changes needed

**Files to Reference:**
- `src/game/network/WebSocketClient.ts` - Use `on()` and `send()` methods
- `internal/network/websocket_handler.go` - Extend switch statement for "player:move"
- Story 1.3 message format - Ensure "player:move" and "game:state" match protocol

**Integration Points:**
- WebSocketClient already in GameScene - just add more handlers
- Server message loop already routing by type - just add "player:move" case
- JSON serialization/deserialization working - use same for new messages

[Source: docs/sprint-artifacts/1-3-establish-websocket-connection-between-client-and-server.md]

### References

**Source Documents:**
- [Source: docs/game-architecture.md#Game-Loop-Architecture] (Architecture patterns)
- [Source: docs/game-architecture.md#Network-Synchronization] (20 Hz broadcast rate)
- [Source: docs/epic-1-tech-spec.md#Story-1.4] (lines 790-1300)
- [Source: docs/epics.md#Epic-1-Story-1.4] (lines 215-246)
- [Source: docs/sprint-artifacts/1-3-establish-websocket-connection-between-client-and-server.md#Learnings] (Previous story context)

**Key Architecture Decisions:**
- Server-authoritative game loop (ADR: Server authority for anti-cheat)
- 60 Hz tick rate with 20 Hz broadcast (Bandwidth optimization)
- Simple WASD movement for MVP (No prediction yet - Epic 4)
- Single global room (Simplified MVP - Epic 5 adds matchmaking)

**Message Protocol Specification:**
- `player:move` (client → server): `{type: "player:move", timestamp: number, data: {keys: string[]}}`
- `room:joined` (server → client): `{type: "room:joined", timestamp: number, data: {roomId: string, playerId: string}}`
- `game:state` (server → all clients): `{type: "game:state", timestamp: number, data: {tick: number, players: PlayerState[]}}`

**Troubleshooting:**
- **Sprites don't appear:** Check browser console, verify game:state messages received
- **Movement not synchronized:** Verify player:move messages sent, check server logs
- **Lag/stuttering:** Check broadcast rate (should be 20 Hz), measure network latency
- **Player doesn't disappear on disconnect:** Check RemovePlayer called in defer
- **Multiple players spawn at same position:** Verify offset spawn logic (X: 100 + count*50)

## Dev Agent Record

### Context Reference

(Story context file will be generated during implementation)

### Agent Model Used

(Will be recorded during implementation)

### Debug Log References

(Will be recorded during implementation)

### Completion Notes List

(Will be recorded during implementation)

### File List

**Expected New Files:**
- stick-rumble-server/internal/game/room.go
- stick-rumble-server/internal/game/room_test.go
- docs/sprint-artifacts/1-4-implement-basic-game-room-with-2-player-synchronization.context.xml

**Expected Modified Files:**
- stick-rumble-server/internal/network/websocket_handler.go
- stick-rumble-client/src/game/scenes/GameScene.ts
- docs/sprint-artifacts/sprint-status.yaml
- docs/sprint-artifacts/1-4-implement-basic-game-room-with-2-player-synchronization.md

## Senior Developer Review (AI)

(Will be completed after implementation)

## Change Log

- **2025-11-26**: Story drafted - Basic game room with 2-player synchronization story created from Epic 1 technical spec and epics file. Ready for development. Prerequisites: Story 1.3 (done - WebSocket connection operational). Incorporates learnings from Story 1.3 regarding message protocol, WebSocketClient usage, and routing patterns. Server-side game loop architecture defined with 60 Hz ticks and 20 Hz broadcasts. Client-side input sending and state rendering specified.
