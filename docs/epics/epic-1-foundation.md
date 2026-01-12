# Epic 1: Foundation & Project Setup

**Goal:** Establish development environment and deployment pipeline enabling all subsequent work

**Value Delivered:** Working dev environment, basic multiplayer proof-of-concept showing 2 players can connect and see each other

**FRs Covered:** Infrastructure foundation for all FRs

**Status:** Complete (4/4 stories)

---

## Stories

### Story 1.1: Initialize Frontend Project with Phaser + React

As a developer,
I want the frontend project scaffolded with Phaser 3, React, and TypeScript,
So that I have a modern, type-safe development environment for building the game.

**Acceptance Criteria:**

**Given** a fresh project directory
**When** I run `npm create @phaserjs/game@latest stick-rumble-client`
**Then** the project is created with Phaser 3.90, React 18+, TypeScript, and Vite bundler

**And** the project structure includes:
- `src/game/` for Phaser code
- `src/ui/` for React components
- `src/shared/` for common types
- `public/assets/` for game assets

**And** `npm run dev` starts the development server with hot reload
**And** `npm run build` creates optimized production bundle
**And** `npm test` runs Vitest test suite

**Prerequisites:** None (first story)

**Technical Notes:**
- Use official Phaser CLI template (ensures correct Phaser <-> React bridge)
- TypeScript strict mode enabled
- Vite config supports asset bundling for images/audio
- Template includes example GameScene to verify Phaser renders
- Git repository initialized with `.gitignore` for node_modules

---

### Story 1.2: Initialize Backend Golang Server

As a developer,
I want the backend Go server project initialized with core dependencies,
So that I can build the multiplayer game server with WebSocket support.

**Acceptance Criteria:**

**Given** a new directory `stick-rumble-server/`
**When** I initialize the Go module with `go mod init`
**Then** the project is created with Go 1.23+ module

**And** core dependencies are installed:
- `github.com/gorilla/websocket@v1.5.3` (WebSocket library)
- `github.com/go-pkgz/auth/v2` (OAuth authentication)
- `github.com/lib/pq` (PostgreSQL driver)
- `github.com/redis/go-redis/v9` (Redis client)
- `github.com/stretchr/testify` (testing assertions)

**And** project structure follows Architecture doc:
- `cmd/server/main.go` - entry point
- `internal/game/` - game logic
- `internal/network/` - WebSocket handling
- `internal/auth/` - authentication
- `internal/db/` - database connections

**And** `go run cmd/server/main.go` starts a basic HTTP server on port 8080
**And** `go test ./...` runs all tests

**Prerequisites:** Story 1.1 (parallel development possible)

**Technical Notes:**
- Use Go modules for dependency management
- Directory structure matches Architecture doc (internal/ for private packages)
- Create basic `main.go` with HTTP server to verify setup
- `.gitignore` excludes binaries and vendor/
- README.md documents how to run server

---

### Story 1.3: Establish WebSocket Connection Between Client and Server

As a developer,
I want the client and server to establish a persistent WebSocket connection,
So that real-time bidirectional communication is possible.

**Acceptance Criteria:**

**Given** both frontend and backend servers are running
**When** the Phaser client connects via `new WebSocket('ws://localhost:8080/ws')`
**Then** the Go server upgrades the HTTP connection to WebSocket using gorilla/websocket

**And** the connection remains open and stable
**And** both sides can send/receive JSON messages
**And** connection close events are handled gracefully on both sides
**And** client shows "Connected" status in console
**And** server logs "Client connected: [connection_id]"

**And** test message sent from client appears on server
**And** test message sent from server appears in client console

**Prerequisites:** Story 1.1, Story 1.2

**Technical Notes:**
- Server WebSocket handler at `/ws` endpoint using `gorilla/websocket.Upgrader`
- Client WebSocket wrapper class `WebSocketClient.ts` in `src/game/network/`
- JSON message format: `{type: string, timestamp: number, data: any}`
- Handle connection errors with retry logic (3 attempts)
- CORS headers configured to allow frontend origin (localhost:5173 in dev)
- Log all connection lifecycle events for debugging

---

### Story 1.4: Implement Basic Game Room with 2-Player Synchronization

**UPDATED 2025-12-01:** Simplified to proof-of-concept scope. Game mechanics moved to Epic 2.

As a developer,
I want a basic game room that proves 2 clients can join and communicate,
So that the multiplayer foundation is proven to work.

**Acceptance Criteria:**

**Given** 2 clients connect to the server
**When** the server detects 2 connections
**Then** a room is automatically created and both players are assigned to it

**And** both clients receive `room:joined` messages with their player IDs and room ID

**And** when Player 1 sends a test message `{type: 'test', data: 'hello'}`
**Then** Player 2 receives the message via room broadcast

**And** when Player 2 sends a test message `{type: 'test', data: 'world'}`
**Then** Player 1 receives the message via room broadcast

**And** server logs show room creation: "Room created: [room_id] with players: [player1_id, player2_id]"

**And** when one player disconnects, the other player receives `player:left` event

**And** comprehensive test suite covers room creation, joining, broadcasting, disconnection

**And** test coverage exceeds 90% for room management code

**And** integration tests verify 2-client room workflow end-to-end

**Prerequisites:** Story 1.3

**Technical Notes:**
- Server `internal/game/room.go` manages basic room state (max 8 players for future)
- Simple room manager: when 2 players connect without a room, create one
- Message broadcast: when room receives message from one player, send to all others in room
- No game loop yet - just message routing proof-of-concept
- No movement, no rendering, no game state - that's Epic 2
- Focus: prove room joining and message broadcast works reliably

**Scope Removed (moved to Epic 2, Story 2.1):**
- Game tick loop -> Story 2.1
- WASD movement input -> Story 2.1
- Player position synchronization -> Story 2.1
- Phaser sprite rendering -> Story 2.1
- Server position validation -> Story 2.1

**Rationale:** Original scope contained premature game mechanics. Epic 1 should focus on infrastructure foundation. Gameplay belongs in Epic 2.

**Note:** Story 1.5 (Cloud Deployment) has been moved to Epic 9 as Stories 9.5A and 9.5B. See Epic 9 section.
