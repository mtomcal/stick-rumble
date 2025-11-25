# Epic 1: Foundation & Project Setup - Technical Specification

**Epic ID:** Epic 1
**Epic Name:** Foundation & Project Setup
**Project:** Stick Rumble
**Date:** 2025-11-25
**Version:** 1.0

---

## Executive Summary

### Epic Goal
Establish development environment and deployment pipeline enabling all subsequent work, culminating in a basic multiplayer proof-of-concept demonstrating 2 players can connect, see each other, and interact in real-time.

### Value Delivered
- Working development environment (frontend + backend)
- Basic multiplayer proof-of-concept (2 players can connect and move)
- Deployed cloud infrastructure for remote testing
- Foundation for all subsequent epics

### Success Criteria
- ✅ Frontend project initialized with Phaser 3.90 + React + TypeScript + Vite
- ✅ Backend Go server initialized with WebSocket support
- ✅ Client-server WebSocket connection established
- ✅ 2 players can join room and see synchronized movement
- ✅ Server deployed to cloud VPS with public access

---

## FR Coverage

**Functional Requirements Addressed:**
- **Infrastructure foundation for all FRs** - This epic provides the technical foundation required by all other functional requirements

**Non-Functional Requirements Addressed:**
- **NFR-1: Performance** - Initial architecture supports 60 FPS client target
- **NFR-2: Scalability** - Cloud deployment strategy enables horizontal scaling
- **NFR-3: Security** - Server-authoritative pattern established from start
- **NFR-4: Cross-Platform** - Web-based architecture supports desktop + mobile

---

## Architecture Context

### Technology Stack

**Frontend:**
- **Framework:** Phaser 3.90 (game engine)
- **UI Layer:** React 18+
- **Language:** TypeScript 5.0+
- **Bundler:** Vite 5.0+
- **Testing:** Vitest

**Backend:**
- **Language:** Go 1.23+
- **WebSocket:** gorilla/websocket v1.5.3
- **HTTP Router:** Standard library net/http
- **Testing:** Go testing + testify

**Infrastructure:**
- **Deployment:** VPS (DigitalOcean/Hetzner/Fly.io)
- **Reverse Proxy:** Nginx or Caddy
- **SSL:** Let's Encrypt (free TLS certificates)
- **Monitoring:** Basic health checks (logs via systemd)

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Client (Browser)                         │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Phaser 3 Game Canvas                                 │  │
│  │  - GameScene (multiplayer test)                       │  │
│  │  - Player sprites                                     │  │
│  │  - Input handling (WASD)                              │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  React UI Layer                                       │  │
│  │  - Connection status                                  │  │
│  │  - Player count display                               │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  WebSocket Client                                     │  │
│  │  - Persistent connection                              │  │
│  │  - JSON message handling                              │  │
│  └───────────────────────────────────────────────────────┘  │
└──────────────────────┬──────────────────────────────────────┘
                       │ WebSocket (wss://)
                       │ JSON Messages
┌──────────────────────▼──────────────────────────────────────┐
│                  Cloud VPS Server                            │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Nginx/Caddy Reverse Proxy                            │  │
│  │  - SSL termination (Let's Encrypt)                    │  │
│  │  - WebSocket upgrade                                  │  │
│  │  - Static file serving (optional)                     │  │
│  └────────────────────┬──────────────────────────────────┘  │
│                       │                                      │
│  ┌────────────────────▼──────────────────────────────────┐  │
│  │  Go Server (:8081)                                    │  │
│  │  ┌──────────────────────────────────────────────────┐ │  │
│  │  │  WebSocket Handler                               │ │  │
│  │  │  - Connection upgrade                            │ │  │
│  │  │  - Message routing                               │ │  │
│  │  └──────────────────────────────────────────────────┘ │  │
│  │  ┌──────────────────────────────────────────────────┐ │  │
│  │  │  Room Manager                                    │ │  │
│  │  │  - Create/destroy rooms                          │ │  │
│  │  │  - Player join/leave                             │ │  │
│  │  │  - Room state tracking                           │ │  │
│  │  └──────────────────────────────────────────────────┘ │  │
│  │  ┌──────────────────────────────────────────────────┐ │  │
│  │  │  Game Loop (60 Hz)                               │ │  │
│  │  │  - Process player inputs                         │ │  │
│  │  │  - Update game state                             │ │  │
│  │  │  - Broadcast state (20 Hz)                       │ │  │
│  │  └──────────────────────────────────────────────────┘ │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

**Connection Establishment:**
1. Client loads in browser → Connects to `wss://yourdomain.com/ws`
2. Nginx receives request → Upgrades to WebSocket → Forwards to Go server :8081
3. Go server accepts connection → Creates player session → Assigns to room
4. Server sends `room:joined` → Client receives confirmation
5. Connection established (persistent bidirectional communication)

**Player Movement (Basic Sync):**
1. Player presses 'W' key → Client sends `player:move` with {x, y, keys: ['w']}
2. Server receives input → Validates → Updates player position
3. Server broadcasts `game:state` to all players in room (20 Hz)
4. Other clients receive state → Update remote player positions
5. Movement synchronized across all connected clients

---

## Story Breakdown

### Story 1.1: Initialize Frontend Project with Phaser + React

**Technical Requirements:**

**Setup Command:**
```bash
npm create @phaserjs/game@latest stick-rumble-client
```

**During CLI Prompts, Select:**
- Template: **React**
- Language: **TypeScript**
- Bundler: **Vite**

**Expected Project Structure:**
```
stick-rumble-client/
├── src/
│   ├── game/
│   │   ├── scenes/
│   │   │   └── GameScene.ts        # Example scene from template
│   │   └── config/
│   │       └── GameConfig.ts       # Phaser configuration
│   ├── ui/
│   │   └── App.tsx                 # React root component
│   ├── main.tsx                    # Entry point
│   └── vite-env.d.ts
├── public/
│   ├── assets/                     # Game assets directory
│   └── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── vitest.config.ts
```

**Required Dependencies (Auto-installed by Template):**
```json
{
  "dependencies": {
    "phaser": "^3.90.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "vite": "^5.0.0",
    "@types/react": "^18.0.0",
    "vitest": "latest"
  }
}
```

**Configuration Files:**

**vite.config.ts (should exist from template):**
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true, // Allow external connections (for mobile testing)
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
```

**tsconfig.json (should exist from template):**
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

**Acceptance Criteria:**
- ✅ `npm run dev` starts development server on http://localhost:5173
- ✅ Hot module replacement (HMR) works (changes reflect instantly)
- ✅ `npm run build` creates optimized production bundle in `dist/`
- ✅ `npm test` runs Vitest test suite (even if no tests yet)
- ✅ Phaser canvas renders on page with example GameScene
- ✅ No console errors on page load
- ✅ TypeScript compilation succeeds without errors

**Validation Tests:**
```typescript
// tests/setup.test.ts
import { describe, test, expect } from 'vitest';

describe('Project Setup', () => {
  test('Phaser is available', () => {
    expect(Phaser).toBeDefined();
    expect(Phaser.VERSION).toMatch(/^3\.90/);
  });

  test('React is available', () => {
    expect(React).toBeDefined();
  });
});
```

**Troubleshooting:**
- **Issue:** `npm create` fails
  - **Fix:** Update npm: `npm install -g npm@latest`
- **Issue:** Port 5173 already in use
  - **Fix:** Change port in vite.config.ts or kill process: `lsof -ti:5173 | xargs kill`
- **Issue:** Phaser canvas doesn't render
  - **Fix:** Check browser console for errors, ensure WebGL support

**Implementation Notes:**
- Official Phaser CLI template ensures correct Phaser ↔ React bridge
- TypeScript strict mode catches bugs early
- Vite provides near-instant HMR (<100ms updates)
- Template includes working example to verify Phaser renders

**Prerequisites:** None (first story)

**Estimated Effort:** 30 minutes

---

### Story 1.2: Initialize Backend Golang Server

**Technical Requirements:**

**Setup Commands:**
```bash
# Create directory and initialize Go module
mkdir stick-rumble-server
cd stick-rumble-server
go mod init github.com/yourusername/stick-rumble-server

# Install core dependencies
go get github.com/gorilla/websocket@v1.5.3
go get github.com/go-pkgz/auth/v2
go get github.com/lib/pq
go get github.com/redis/go-redis/v9
go get github.com/stretchr/testify
```

**Project Structure:**
```
stick-rumble-server/
├── cmd/
│   └── server/
│       └── main.go                 # Entry point
├── internal/
│   ├── game/
│   │   ├── room.go                # Room management
│   │   ├── player.go              # Player state
│   │   └── constants.go           # Game constants
│   ├── network/
│   │   ├── websocket_handler.go   # WebSocket upgrade/handling
│   │   ├── connection.go          # Connection wrapper
│   │   └── protocol.go            # Message type definitions
│   └── config/
│       └── config.go              # Server configuration
├── go.mod
├── go.sum
├── .gitignore
└── README.md
```

**Initial Implementation:**

**cmd/server/main.go:**
```go
package main

import (
    "log"
    "net/http"
    "os"
    "github.com/yourusername/stick-rumble-server/internal/network"
)

func main() {
    port := os.Getenv("PORT")
    if port == "" {
        port = "8080"
    }

    // Health check endpoint
    http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
        w.WriteHeader(http.StatusOK)
        w.Write([]byte("OK"))
    })

    // WebSocket endpoint (Story 1.3 will implement this)
    http.HandleFunc("/ws", network.HandleWebSocket)

    log.Printf("Server starting on port %s", port)
    if err := http.ListenAndServe(":"+port, nil); err != nil {
        log.Fatal("Server failed:", err)
    }
}
```

**internal/network/websocket_handler.go (stub for now):**
```go
package network

import (
    "log"
    "net/http"
)

// HandleWebSocket will be implemented in Story 1.3
func HandleWebSocket(w http.ResponseWriter, r *http.Request) {
    log.Println("WebSocket endpoint hit (not yet implemented)")
    w.WriteHeader(http.StatusNotImplemented)
    w.Write([]byte("WebSocket handler coming in Story 1.3"))
}
```

**.gitignore:**
```
# Binaries
*.exe
*.exe~
*.dll
*.so
*.dylib
server
stick-rumble-server

# Test binary
*.test

# Output of go coverage tool
*.out

# Dependency directories
vendor/

# Go workspace file
go.work

# Environment variables
.env
.env.local
```

**go.mod (after dependencies installed):**
```go
module github.com/yourusername/stick-rumble-server

go 1.23

require (
    github.com/gorilla/websocket v1.5.3
    github.com/go-pkgz/auth/v2 v2.x.x
    github.com/lib/pq vX.X.X
    github.com/redis/go-redis/v9 v9.X.X
    github.com/stretchr/testify v1.X.X
)
```

**Acceptance Criteria:**
- ✅ `go run cmd/server/main.go` starts HTTP server on port 8080
- ✅ `curl http://localhost:8080/health` returns "OK" with 200 status
- ✅ `go test ./...` runs successfully (even with no tests yet)
- ✅ `go build -o server cmd/server/main.go` creates binary successfully
- ✅ All dependencies listed in go.mod with specific versions
- ✅ Server logs "Server starting on port 8080" to stdout
- ✅ No compilation errors or warnings

**Validation Tests:**
```go
// cmd/server/main_test.go
package main

import (
    "net/http"
    "net/http/httptest"
    "testing"
    "github.com/stretchr/testify/assert"
)

func TestHealthEndpoint(t *testing.T) {
    req := httptest.NewRequest("GET", "/health", nil)
    w := httptest.NewRecorder()

    http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        w.WriteHeader(http.StatusOK)
        w.Write([]byte("OK"))
    }).ServeHTTP(w, req)

    assert.Equal(t, http.StatusOK, w.Code)
    assert.Equal(t, "OK", w.Body.String())
}
```

**Troubleshooting:**
- **Issue:** `go get` fails with network error
  - **Fix:** Check internet connection, try `go env -w GOPROXY=https://proxy.golang.org,direct`
- **Issue:** Port 8080 already in use
  - **Fix:** Set PORT environment variable: `PORT=8081 go run cmd/server/main.go`
- **Issue:** Module path error
  - **Fix:** Use your actual GitHub username in module path

**Implementation Notes:**
- Use Go modules for dependency management (no vendor/ needed)
- internal/ directory prevents external imports (good practice)
- Standard library net/http sufficient for MVP (no Gin/Echo needed)
- Health check enables monitoring/load balancer probes

**Prerequisites:** Story 1.1 (parallel development possible)

**Estimated Effort:** 45 minutes

---

### Story 1.3: Establish WebSocket Connection Between Client and Server

**Technical Requirements:**

**Server Implementation:**

**internal/network/websocket_handler.go:**
```go
package network

import (
    "log"
    "net/http"
    "github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
    ReadBufferSize:  1024,
    WriteBufferSize: 1024,
    CheckOrigin: func(r *http.Request) bool {
        // MVP: Allow all origins (for localhost development)
        // Production: Restrict to your domain
        return true
    },
}

func HandleWebSocket(w http.ResponseWriter, r *http.Request) {
    // Upgrade HTTP connection to WebSocket
    conn, err := upgrader.Upgrade(w, r, nil)
    if err != nil {
        log.Println("WebSocket upgrade failed:", err)
        return
    }
    defer conn.Close()

    log.Println("Client connected:", conn.RemoteAddr())

    // Echo loop for testing (Story 1.4 will add room logic)
    for {
        messageType, message, err := conn.ReadMessage()
        if err != nil {
            log.Println("Client disconnected:", err)
            break
        }

        log.Printf("Received: %s", message)

        // Echo message back
        if err := conn.WriteMessage(messageType, message); err != nil {
            log.Println("Write error:", err)
            break
        }
    }
}
```

**Client Implementation:**

**src/game/network/WebSocketClient.ts:**
```typescript
export interface Message {
  type: string;
  timestamp: number;
  data?: any;
}

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private reconnectDelay = 1000; // ms
  private messageHandlers: Map<string, (data: any) => void> = new Map();

  constructor(url: string) {
    this.url = url;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
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
      } catch (err) {
        reject(err);
      }
    });
  }

  send(message: Message): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not connected, cannot send message');
    }
  }

  on(messageType: string, handler: (data: any) => void): void {
    this.messageHandlers.set(messageType, handler);
  }

  private handleMessage(message: Message): void {
    const handler = this.messageHandlers.get(message.type);
    if (handler) {
      handler(message.data);
    } else {
      console.warn('No handler for message type:', message.type);
    }
  }

  private attemptReconnect(): void {
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

  disconnect(): void {
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
  }
}
```

**Integration Example (src/game/scenes/GameScene.ts):**
```typescript
import Phaser from 'phaser';
import { WebSocketClient } from '../network/WebSocketClient';

export class GameScene extends Phaser.Scene {
  private wsClient!: WebSocketClient;

  constructor() {
    super({ key: 'GameScene' });
  }

  create() {
    // Connect to WebSocket server
    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8080/ws';
    this.wsClient = new WebSocketClient(wsUrl);

    this.wsClient.connect()
      .then(() => {
        console.log('Connected to server!');

        // Send test message
        this.wsClient.send({
          type: 'test',
          timestamp: Date.now(),
          data: { message: 'Hello from client!' }
        });
      })
      .catch(err => {
        console.error('Failed to connect:', err);
      });

    // Setup message handlers
    this.wsClient.on('test', (data) => {
      console.log('Received echo from server:', data);
    });

    // Display connection status
    this.add.text(10, 10, 'Connected to server!', {
      fontSize: '18px',
      color: '#00ff00'
    });
  }
}
```

**Environment Configuration (.env.local):**
```bash
VITE_WS_URL=ws://localhost:8080/ws
```

**Acceptance Criteria:**
- ✅ Client successfully connects to server WebSocket endpoint
- ✅ Server logs "Client connected: [address]" on connection
- ✅ Client sends test message → Server receives and logs it
- ✅ Server echoes message back → Client receives and logs it
- ✅ "Connected to server!" displays in Phaser canvas
- ✅ Connection remains stable (doesn't disconnect immediately)
- ✅ Graceful close handling (both sides log disconnect)
- ✅ Client reconnects automatically after temporary disconnect (3 attempts)

**Validation Tests:**

**Server Test (internal/network/websocket_handler_test.go):**
```go
package network

import (
    "net/http/httptest"
    "strings"
    "testing"
    "github.com/gorilla/websocket"
    "github.com/stretchr/testify/assert"
)

func TestWebSocketUpgrade(t *testing.T) {
    server := httptest.NewServer(http.HandlerFunc(HandleWebSocket))
    defer server.Close()

    wsURL := "ws" + strings.TrimPrefix(server.URL, "http") + "/ws"

    ws, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
    assert.NoError(t, err)
    defer ws.Close()

    // Send test message
    testMsg := []byte("test message")
    err = ws.WriteMessage(websocket.TextMessage, testMsg)
    assert.NoError(t, err)

    // Read echo
    _, message, err := ws.ReadMessage()
    assert.NoError(t, err)
    assert.Equal(t, testMsg, message)
}
```

**Client Test (src/game/network/WebSocketClient.test.ts):**
```typescript
import { describe, test, expect, vi } from 'vitest';
import { WebSocketClient } from './WebSocketClient';

// Mock WebSocket
global.WebSocket = vi.fn().mockImplementation(() => ({
  readyState: WebSocket.OPEN,
  send: vi.fn(),
  close: vi.fn(),
  addEventListener: vi.fn(),
}));

describe('WebSocketClient', () => {
  test('should send JSON messages', () => {
    const client = new WebSocketClient('ws://localhost:8080/ws');
    const mockWs = new WebSocket('');
    client['ws'] = mockWs;

    client.send({
      type: 'test',
      timestamp: 123456,
      data: { foo: 'bar' }
    });

    expect(mockWs.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'test', timestamp: 123456, data: { foo: 'bar' } })
    );
  });
});
```

**Troubleshooting:**
- **Issue:** Connection refused
  - **Fix:** Ensure backend server running: `go run cmd/server/main.go`
- **Issue:** CORS error in browser
  - **Fix:** Check `CheckOrigin` function in upgrader allows your origin
- **Issue:** WebSocket closes immediately
  - **Fix:** Check server logs for errors, verify no firewall blocking
- **Issue:** Messages not received
  - **Fix:** Check JSON parsing, ensure message format matches on both sides

**Implementation Notes:**
- JSON format prioritized for MVP (easy debugging, sufficient performance)
- Exponential backoff for reconnection (1s, 2s, 4s delays)
- CORS configured for localhost development (restrict in production)
- Message type routing enables extensibility (easy to add new handlers)

**Prerequisites:** Story 1.1, Story 1.2

**Estimated Effort:** 2 hours

---

### Story 1.4: Implement Basic Game Room with 2-Player Synchronization

**Technical Requirements:**

**Server Implementation:**

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

**Acceptance Criteria:**
- ✅ Opening 2 browser tabs connects 2 players to server
- ✅ Both clients receive `room:joined` message with player IDs
- ✅ Each client sees 2 rectangles (green for self, red for other player)
- ✅ Pressing WASD in tab 1 moves green rectangle
- ✅ Tab 2 sees red rectangle move (synchronized from server)
- ✅ Movement updates appear within 100ms (<100ms perceived latency)
- ✅ Server logs show 20 Hz broadcast rate ("game:state" every 50ms)
- ✅ Closing one tab removes that player's sprite from other client
- ✅ No console errors in client or server logs

**Validation Tests:**

**Server Test (internal/game/room_test.go):**
```go
package game

import (
    "testing"
    "github.com/stretchr/testify/assert"
)

func TestRoomAddPlayer(t *testing.T) {
    room := NewRoom("test_room")

    // Mock connection (nil acceptable for this test)
    room.AddPlayer("player1", nil)

    assert.Equal(t, 1, len(room.Players))
    assert.Equal(t, "player1", room.Players["player1"].ID)
}

func TestRoomProcessInput(t *testing.T) {
    room := NewRoom("test_room")
    room.AddPlayer("player1", nil)

    initialX := room.Players["player1"].Position.X

    room.ProcessInput("player1", []string{"d"}) // Move right

    assert.Greater(t, room.Players["player1"].Position.X, initialX)
}

func TestRoomMaxPlayers(t *testing.T) {
    room := NewRoom("test_room")

    // Add MaxPlayers
    for i := 0; i < MaxPlayers; i++ {
        room.AddPlayer(fmt.Sprintf("player%d", i), nil)
    }

    assert.Equal(t, MaxPlayers, len(room.Players))

    // Try to add one more (should be rejected)
    room.AddPlayer("extra_player", nil)
    assert.Equal(t, MaxPlayers, len(room.Players))
}
```

**Troubleshooting:**
- **Issue:** Second player doesn't appear
  - **Fix:** Check both clients connected (server logs), check browser console
- **Issue:** Movement feels laggy
  - **Fix:** Verify server broadcasting at 20 Hz, check network latency
- **Issue:** Players don't see each other move
  - **Fix:** Check message routing in `game:state` handler
- **Issue:** Sprites positioned incorrectly
  - **Fix:** Verify coordinate system (Phaser origin top-left)

**Implementation Notes:**
- Room game loop runs at 60 Hz (16.67ms ticks) for future physics
- Broadcasts reduced to 20 Hz to save bandwidth
- Mutex protects shared room state from concurrent access
- Simple WASD movement (3.33 px/tick = 200 px/s) for testing

**Prerequisites:** Story 1.3

**Estimated Effort:** 4 hours

---

### Story 1.5: Deploy to Cloud VPS for Remote Testing

**Technical Requirements:**

**VPS Provider Options:**
- **DigitalOcean Droplets** - $6/month for 1GB RAM, 25GB SSD
- **Hetzner Cloud** - €4.49/month for 2GB RAM, 40GB SSD (better value)
- **Fly.io** - Free tier includes 3 shared VMs (easiest for MVP)

**Recommended for MVP:** Fly.io (free tier, simplest deployment)

**Deployment Steps:**

**1. Prepare Backend for Deployment:**

**Create Dockerfile:**
```dockerfile
# Build stage
FROM golang:1.23-alpine AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN go build -o server cmd/server/main.go

# Runtime stage
FROM alpine:latest

RUN apk --no-cache add ca-certificates

WORKDIR /root/

COPY --from=builder /app/server .

EXPOSE 8080

CMD ["./server"]
```

**Create .dockerignore:**
```
.git
*.md
.env
.env.local
```

**2. Deploy to Fly.io:**

**Install flyctl CLI:**
```bash
# macOS/Linux
curl -L https://fly.io/install.sh | sh

# Login
fly auth login
```

**Initialize Fly app:**
```bash
cd stick-rumble-server
fly launch
```

**Follow prompts:**
- App name: `stick-rumble-server` (or custom)
- Region: Choose closest to you
- Database: No (not needed yet)
- Deploy now: Yes

**fly.toml (generated, customize if needed):**
```toml
app = "stick-rumble-server"
primary_region = "sjc"

[build]

[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 1

[[services]]
  protocol = "tcp"
  internal_port = 8080

  [[services.ports]]
    port = 80
    handlers = ["http"]
    force_https = true

  [[services.ports]]
    port = 443
    handlers = ["http", "tls"]

[env]
  PORT = "8080"
```

**Deploy:**
```bash
fly deploy
```

**Get app URL:**
```bash
fly status
# Note the hostname: stick-rumble-server.fly.dev
```

**3. Deploy Frontend to Vercel:**

**Install Vercel CLI:**
```bash
npm install -g vercel
```

**Deploy:**
```bash
cd stick-rumble-client
vercel
```

**Follow prompts:**
- Set up and deploy: Yes
- Scope: Your account
- Link to existing project: No
- Project name: `stick-rumble-client`
- Directory: `./` (default)
- Override settings: No

**Set environment variable:**
```bash
vercel env add VITE_WS_URL
# Value: wss://stick-rumble-server.fly.dev/ws
```

**Deploy production:**
```bash
vercel --prod
```

**4. Configure SSL (Automatic with Fly.io):**

Fly.io automatically provisions TLS certificates. Verify:
```bash
curl https://stick-rumble-server.fly.dev/health
# Should return: OK
```

**5. Test WebSocket Connection:**

Open browser console on deployed frontend:
```javascript
const ws = new WebSocket('wss://stick-rumble-server.fly.dev/ws');
ws.onopen = () => console.log('Connected!');
ws.onmessage = (e) => console.log('Message:', e.data);
ws.onerror = (e) => console.error('Error:', e);
```

**Alternative: Traditional VPS Deployment (DigitalOcean/Hetzner):**

**Setup Script (for Ubuntu 22.04):**
```bash
#!/bin/bash

# Install dependencies
sudo apt update
sudo apt install -y golang-go nginx certbot python3-certbot-nginx

# Clone repository
git clone https://github.com/yourusername/stick-rumble-server.git
cd stick-rumble-server

# Build server
go build -o server cmd/server/main.go

# Create systemd service
sudo tee /etc/systemd/system/stick-rumble.service > /dev/null <<EOF
[Unit]
Description=Stick Rumble Game Server
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/stick-rumble-server
ExecStart=/home/ubuntu/stick-rumble-server/server
Restart=always
RestartSec=10
Environment="PORT=8080"

[Install]
WantedBy=multi-user.target
EOF

# Start service
sudo systemctl daemon-reload
sudo systemctl enable stick-rumble
sudo systemctl start stick-rumble

# Configure Nginx reverse proxy
sudo tee /etc/nginx/sites-available/stick-rumble > /dev/null <<EOF
upstream gameserver {
    server localhost:8080;
}

server {
    listen 80;
    server_name yourdomain.com;

    location /ws {
        proxy_pass http://gameserver;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_read_timeout 3600s;
    }

    location / {
        proxy_pass http://gameserver;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }
}
EOF

sudo ln -s /etc/nginx/sites-available/stick-rumble /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# Setup SSL with Let's Encrypt
sudo certbot --nginx -d yourdomain.com
```

**Acceptance Criteria:**
- ✅ Server deployed and accessible at public URL (e.g., `stick-rumble-server.fly.dev`)
- ✅ `curl https://yourdomain.com/health` returns "OK" with 200 status
- ✅ WebSocket endpoint accessible via `wss://yourdomain.com/ws` (secure)
- ✅ Frontend deployed to Vercel/Netlify with production URL
- ✅ Frontend connects to deployed backend successfully
- ✅ Two players on different networks can connect and play together
- ✅ SSL/TLS certificate valid (no browser warnings)
- ✅ Server stays running after deployment (doesn't crash)
- ✅ Server auto-restarts on crash (systemd or Fly.io handles this)

**Validation Tests:**

**Health Check:**
```bash
# Test from command line
curl -I https://yourdomain.com/health
# Expected: HTTP/2 200

# Test WebSocket upgrade
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" -H "Sec-WebSocket-Version: 13" -H "Sec-WebSocket-Key: test" https://yourdomain.com/ws
# Expected: 101 Switching Protocols
```

**Remote Multi-Player Test:**
```bash
# Open deployed frontend on two different devices/networks
# Both should connect and see each other move
```

**Troubleshooting:**
- **Issue:** `fly deploy` fails with build error
  - **Fix:** Test Dockerfile locally: `docker build -t test .`
- **Issue:** WebSocket connection refused
  - **Fix:** Check Fly.io logs: `fly logs`, verify port 8080 exposed
- **Issue:** SSL certificate not working
  - **Fix:** Fly.io auto-provisions, wait 1-2 minutes after deploy
- **Issue:** CORS errors
  - **Fix:** Update `CheckOrigin` in upgrader to allow your frontend domain
- **Issue:** Server crashes after deployment
  - **Fix:** Check logs for panic, add error handling, redeploy

**Implementation Notes:**
- Fly.io free tier sufficient for MVP (3 shared VMs)
- Automatic TLS certificates via Fly.io/Let's Encrypt
- systemd ensures auto-restart on traditional VPS
- Use Nginx as reverse proxy for WebSocket upgrade + SSL termination
- Environment variables set via Fly.io dashboard or .env file

**Prerequisites:** Story 1.4

**Estimated Effort:** 3 hours (Fly.io), 4-5 hours (traditional VPS)

---

## Testing Strategy

### Unit Tests

**Frontend Unit Tests (Vitest):**
- WebSocketClient connection/reconnection logic
- Message serialization/deserialization
- Input handling (WASD key capture)

**Backend Unit Tests (Go testing):**
- Room creation and player management
- Player movement calculations
- Message routing logic
- WebSocket upgrade handling

**Example Test Coverage Goals:**
- WebSocketClient: 80%+ coverage
- Room logic: 90%+ coverage (critical for fairness)
- Message handlers: 70%+ coverage

### Integration Tests

**Client-Server Integration:**
1. Start local server
2. Connect client via WebSocket
3. Verify `room:joined` message received
4. Send `player:move` input
5. Verify `game:state` broadcast contains updated position
6. Disconnect and verify cleanup

**Multi-Client Integration:**
1. Start local server
2. Connect 2 clients
3. Move player 1 → Verify player 2 sees update
4. Move player 2 → Verify player 1 sees update
5. Disconnect player 1 → Verify player 2 no longer receives player 1 state

### Manual Testing Checklist

**Story 1.1:**
- [ ] `npm run dev` starts without errors
- [ ] Hot reload works (edit file, see change instantly)
- [ ] `npm run build` succeeds
- [ ] `npm test` runs Vitest
- [ ] Phaser canvas displays on page

**Story 1.2:**
- [ ] `go run cmd/server/main.go` starts without errors
- [ ] `/health` endpoint returns "OK"
- [ ] `go test ./...` passes
- [ ] `go build` creates binary

**Story 1.3:**
- [ ] Client connects to server WebSocket
- [ ] "Connected" message displays in console
- [ ] Test message echoed back from server
- [ ] Connection stable for 1+ minute
- [ ] Disconnect handled gracefully

**Story 1.4:**
- [ ] 2 browser tabs both connect
- [ ] Each tab sees 2 player sprites
- [ ] Moving in tab 1 updates position in tab 2
- [ ] Movement feels responsive (<100ms)
- [ ] Closing tab removes player sprite

**Story 1.5:**
- [ ] Server accessible via public URL
- [ ] SSL certificate valid (no warnings)
- [ ] WebSocket connects over wss://
- [ ] Two remote players can connect
- [ ] Server stays running after deployment

---

## Implementation Guidance

### Development Workflow

**Day 1: Project Setup (Stories 1.1 - 1.2)**
1. Initialize frontend with Phaser CLI
2. Initialize backend Go project
3. Verify both run locally
4. Commit to git repository

**Day 2: WebSocket Foundation (Story 1.3)**
1. Implement server WebSocket handler
2. Implement client WebSocketClient class
3. Test connection establishment
4. Test message echo
5. Implement reconnection logic

**Day 3: Basic Multiplayer (Story 1.4)**
1. Implement Room management on server
2. Add game loop (60 Hz ticks)
3. Implement basic movement on server
4. Render player sprites on client
5. Test with 2 local browser tabs

**Day 4: Deployment (Story 1.5)**
1. Create Dockerfile
2. Deploy to Fly.io or VPS
3. Configure SSL/TLS
4. Deploy frontend to Vercel
5. Test remote multiplayer

**Day 5: Polish & Bug Fixes**
1. Fix any issues discovered in testing
2. Add basic error handling
3. Improve logging
4. Document deployment process
5. Celebrate MVP foundation complete! 🎉

### Code Review Checklist

**Before Merging:**
- [ ] All acceptance criteria met
- [ ] Unit tests written and passing
- [ ] Manual testing completed
- [ ] No console errors or warnings
- [ ] Code follows architecture patterns (naming, structure)
- [ ] README updated with new instructions if needed
- [ ] Environment variables documented

### Common Pitfalls and Solutions

**Pitfall:** WebSocket closes immediately after connection
**Solution:** Check for unhandled errors in message loop, add logging

**Pitfall:** CORS errors blocking WebSocket connection
**Solution:** Configure `CheckOrigin` in gorilla/websocket upgrader

**Pitfall:** Movement feels sluggish/delayed
**Solution:** Verify server broadcasting at 20 Hz, check network latency

**Pitfall:** Port conflicts (8080 or 5173 already in use)
**Solution:** Change ports via environment variables or config files

**Pitfall:** Deployment fails with "out of memory"
**Solution:** Use multi-stage Dockerfile (Go build, then Alpine runtime)

---

## Acceptance Criteria Summary

### Epic-Level Acceptance Criteria

**Must Have (MVP):**
- ✅ Frontend project initialized with Phaser 3.90 + React + TypeScript
- ✅ Backend Go server initialized with WebSocket support
- ✅ Client-server WebSocket connection established and stable
- ✅ 2 players can join room and see each other
- ✅ Real-time movement synchronization working
- ✅ Server deployed to cloud with public access
- ✅ All 5 stories completed and tested

**Should Have:**
- ✅ Basic error handling (connection failures, disconnects)
- ✅ Reconnection logic (3 attempts with exponential backoff)
- ✅ Logging for debugging (both client and server)
- ✅ Health check endpoint for monitoring

**Could Have (Future):**
- More sophisticated spawn point selection
- Player limit configuration (not hardcoded 8)
- Multiple rooms support (currently only 1 room)
- Metrics/monitoring dashboard

**Won't Have (Out of Scope):**
- Authentication (Epic 6)
- Multiple game modes (Epic 5)
- Advanced netcode (prediction/reconciliation - Epic 4)
- Combat mechanics (Epic 3)

---

## Dependencies and Prerequisites

### External Dependencies

**Frontend:**
- Node.js 20+ (LTS)
- npm 10+
- Modern browser with WebGL support

**Backend:**
- Go 1.23+
- Git

**Deployment:**
- Fly.io account (free tier) OR
- VPS provider (DigitalOcean/Hetzner)
- Domain name (optional, can use provided subdomain)

### Internal Dependencies

**Story Dependencies:**
- Story 1.2 can be developed in parallel with 1.1
- Story 1.3 requires 1.1 AND 1.2 complete
- Story 1.4 requires 1.3 complete
- Story 1.5 requires 1.4 complete (deployable artifact)

**Epic Dependencies:**
- Epic 2 (Core Combat) depends on Epic 1 completion
- Epic 3 (Weapons) depends on Epic 2 completion
- Epic 4 (Netcode) depends on Epic 2 completion
- All subsequent epics depend on Epic 1 foundation

---

## Risks and Mitigations

### Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **WebSocket latency too high** | Low | High | Use client-side prediction (Epic 4), test with artificial latency |
| **Fly.io free tier limits** | Medium | Medium | Have backup VPS provider ready (Hetzner), monitor usage |
| **CORS/SSL configuration issues** | Medium | Low | Use Fly.io auto-SSL, document CORS setup clearly |
| **Phaser 3 performance issues** | Low | Medium | Profile early, optimize asset loading, use object pooling |
| **Go server crashes** | Low | High | Add panic recovery, comprehensive error handling, monitoring |

### Schedule Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **Story 1.4 takes longer than estimated** | Medium | Medium | Simplify to 1-player if needed, basic sync is acceptable |
| **Deployment issues delay completion** | Medium | Low | Test deployment early, have fallback to localhost demo |
| **Dependencies version conflicts** | Low | Low | Lock versions in go.mod and package.json |

### Mitigation Actions

**If Epic 1 Delayed:**
1. Reduce Story 1.4 scope (1 player moving instead of 2)
2. Skip Story 1.5 temporarily (demo on localhost)
3. Defer error handling improvements to Epic 2

**If Critical Blocker:**
1. Use simpler tech stack (consider WebRTC alternative)
2. Prototype with existing .io game framework (Colyseus)
3. Re-evaluate Thursday deadline feasibility

---

## Success Metrics

### Quantitative Metrics

**Technical Performance:**
- Client connects to server: <2 seconds
- WebSocket connection stable: >99% uptime
- Movement latency: <100ms perceived delay
- Server handles 2 concurrent players: 100% success rate
- Deployment uptime: >95% (Fly.io auto-restart)

**Development Velocity:**
- Epic 1 completed: 4-5 days (per estimates)
- Code review turnaround: <24 hours
- Bug fix time: <2 hours average

### Qualitative Metrics

**Code Quality:**
- Architecture patterns followed consistently
- Code is readable and maintainable
- Tests provide confidence for refactoring
- Documentation enables next developer to continue

**User Experience (Basic):**
- Connection feels instant
- Movement feels responsive
- No confusing errors
- Clear visual feedback (player sprites visible)

### Validation Criteria

**Epic 1 Complete When:**
- ✅ All 5 stories' acceptance criteria met
- ✅ Manual testing checklist completed
- ✅ Deployed server accessible remotely
- ✅ 2 remote players successfully tested together
- ✅ Code reviewed and approved
- ✅ Documentation updated (README, deployment guide)

---

## Appendix

### Glossary

**Terms:**
- **WebSocket:** Persistent bidirectional communication protocol (vs HTTP request/response)
- **Goroutine:** Lightweight Go concurrency primitive (like threads but cheaper)
- **Phaser Scene:** Game state container (menu, lobby, gameplay are separate scenes)
- **Tick:** One iteration of server game loop (60 ticks/second = 60 Hz)
- **Broadcast:** Send message to all connected clients
- **Reconciliation:** Client correcting predicted state based on server authority

### References

**Official Documentation:**
- Phaser 3 Docs: https://photonstorm.github.io/phaser3-docs/
- gorilla/websocket: https://pkg.go.dev/github.com/gorilla/websocket
- Fly.io Docs: https://fly.io/docs/
- Vite Docs: https://vitejs.dev/

**Architecture Documents:**
- Game Design Document: `docs/GDD.md`
- Game Architecture: `docs/game-architecture.md`
- Epic Breakdown: `docs/epics.md`

**Code Examples:**
- Phaser + React Template: Created by `npm create @phaserjs/game@latest`
- WebSocket Echo Server: gorilla/websocket examples
- Fly.io Go Deployment: Fly.io quickstart guide

### Change Log

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2025-11-25 | 1.0 | Initial technical specification created | AI Agent |

---

**Document Status:** ✅ Complete and Ready for Implementation

**Next Actions:**
1. Review this technical specification with team/stakeholders
2. Begin Story 1.1 implementation (Initialize Frontend Project)
3. Run `/bmad:bmgd:workflows:create-story` workflow for Story 1.1 detailed implementation plan (optional)
4. Update sprint status after each story completion

---

*Generated by BMad Epic Tech Context Workflow v1.0*
*Project: Stick Rumble - Multiplayer Arena Shooter*
*Epic: Foundation & Project Setup*
