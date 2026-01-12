# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Stick Rumble is a multiplayer stick figure arena shooter built with a dual-application architecture:
- **Frontend**: Phaser 3 + React + TypeScript (client-side game)
- **Backend**: Go 1.24.1 + WebSocket (server-authoritative multiplayer)

The architecture prioritizes server-authoritative gameplay to prevent cheating while maintaining responsive controls through client-side prediction.

**IMPORTANT FOR AGENTS: Always use the root-level Makefile commands (e.g., `make test`, `make dev-server`) instead of cd-ing into subdirectories. The Makefile handles all directory navigation automatically.**

## Development Commands

### Quick Start (Root-level Makefile)

The project root contains a Makefile that provides unified commands for both client and server:

```bash
# Setup
make install              # Install all dependencies (client + server)

# Development
make dev                  # Run both client and server in parallel
make dev-client           # Run client only (http://localhost:5173)
make dev-server           # Run server only (http://localhost:8080)

# Testing
make test                 # Run all tests (client + server)
make test-client          # Run client tests only
make test-server          # Run server tests only
make test-integration     # Run integration tests (auto-starts server)
make test-coverage        # Generate coverage reports for both

# Code Quality
make lint                 # Run all linters (ESLint + go vet + gofmt)
make typecheck            # TypeScript type checking

# Build
make build                # Build both for production
make clean                # Remove build artifacts

# Help
make help                 # Show all available commands
```

**REQUIRED workflow for agents:**
- **ALWAYS check your current directory with `pwd` before running commands**
- **Project root is `/home/mtomcal/code/stick-rumble`** - most commands should run from here
- **ALWAYS run commands from the project root directory** unless explicitly working on a single package
- **DO NOT cd into stick-rumble-client/ or stick-rumble-server/ directories** for most operations
- Starting work: `make dev-server` (for backend work) or `make dev` (for full stack)
- Running tests: `make test` to verify all changes
- Running server tests: `make test-server` (NOT `cd stick-rumble-server && go test`)
- Running client tests: `make test-client` (NOT `cd stick-rumble-client && npm test`)
- Integration tests: `make test-integration` (handles server startup/shutdown automatically)
- Pre-commit checks: `make lint && make typecheck && make test`

**Directory awareness best practices:**
- Before running any command, verify you're in the correct directory with `pwd`
- The Bash tool does not automatically change directories between commands
- If you run `cd stick-rumble-client`, all subsequent commands will run from that directory until you `cd` back
- Use absolute paths or `cd /home/mtomcal/code/stick-rumble` to return to project root
- Prefer using the Makefile from root rather than navigating into subdirectories

### Frontend (stick-rumble-client/)

```bash
# Development
cd stick-rumble-client
npm install                  # Install dependencies
npm run dev                  # Start dev server (http://localhost:5173)

# Testing
npm test                     # Run unit tests once (--run mode, good for agents/CI)
npm run test:watch           # Run unit tests in watch mode (interactive development)
npm run test:unit            # Explicit alias for unit tests
npm run test:unit:coverage   # Unit tests with coverage
npm run test:integration     # Run integration tests only (requires server)
npm run test:all             # Run all tests (unit + integration)
npm run test:ui              # Run tests with UI
npm run test:coverage        # Generate coverage report (requires >90% for PRs)

# Code Quality
npm run typecheck            # TypeScript type checking (must pass)
npm run lint                 # ESLint (must have zero errors/warnings)
npm run build                # Production build (TypeScript + Vite)
```

### Backend (stick-rumble-server/)

```bash
# Development
cd stick-rumble-server
go mod download              # Install dependencies
go run cmd/server/main.go    # Start server (default port 8080)
PORT=8081 go run cmd/server/main.go  # Custom port

# Testing
go test ./...                # Run all tests
go test ./internal/network -v  # Run specific package tests with verbose output
go test ./... -cover         # Run tests with coverage (requires >90% for PRs)

# Single test patterns
go test ./internal/network -v -run TestWebSocketHandler  # Run specific test
go test ./internal/game -v -run "TestRoom.*"            # Run tests matching pattern

# Code Quality
go vet ./...                 # Go static analysis (must pass)
gofmt -l .                   # Check formatting (must be clean)
go build -o server cmd/server/main.go  # Build binary
```

## Architecture Patterns

### WebSocket Communication

The client-server communication follows a standard message format:

```typescript
// Client (TypeScript)
interface Message {
  type: string;
  timestamp: number;
  data?: unknown;
}
```

```go
// Server (Go)
type Message struct {
    Type      string `json:"type"`
    Timestamp int64  `json:"timestamp"`
    Data      any    `json:"data,omitempty"`
}
```

**Key message types:**
- `room:joined` - Player successfully joined a room
- `player:left` - Player disconnected from room
- `input:state` - Client sends WASD input state to server
- `player:move` - Server broadcasts player position updates (20Hz)
- `test` - Test message for bidirectional communication

### Room Management

The server automatically creates rooms when 2+ players connect:
- **Room capacity**: 8 players max
- **Auto-creation**: When 2 waiting players exist, a room is created automatically
- **Broadcast**: Messages sent by one player are broadcast to all other players in the room
- **Cleanup**: Players are removed from rooms on disconnect, triggering `player:left` events

**Server implementation:**
- `internal/game/room.go` - Room and RoomManager implementation
- `internal/network/websocket_handler.go` - WebSocket upgrade and message routing

**Client implementation:**
- `src/game/network/WebSocketClient.ts` - WebSocket wrapper with reconnect logic (3 attempts)

### Project Structure

**Complete Folder Tree:**
```
stick-rumble/
├── .claude/                       # Claude Code configuration
├── docs/                          # Project documentation
│   └── archive/                   # Archived documentation
│       └── 20251125-055521-pre-bmm/  # Pre-BMM architecture snapshot
│           ├── components/
│           ├── game/
│           │   ├── objects/
│           │   ├── scenes/
│           │   ├── systems/
│           │   ├── utils/
│           │   └── world/
│           └── services/
├── internal/                      # Root-level shared packages
│   └── game/                      # Shared game logic (if needed)
├── stick-rumble-client/           # Frontend application
│   ├── public/                    # Static assets served by Vite
│   │   └── assets/                # Game assets (images, audio, etc.)
│   ├── src/
│   │   ├── assets/                # Source assets
│   │   ├── game/                  # Phaser game code
│   │   │   ├── config/            # Game configuration
│   │   │   ├── entities/          # Game entities (Player, etc.)
│   │   │   ├── input/             # Input handling
│   │   │   ├── network/           # WebSocket client
│   │   │   └── scenes/            # Phaser scenes (GameScene, etc.)
│   │   ├── shared/                # Shared types/constants
│   │   └── ui/                    # React components
│   │       └── common/            # Shared components (PhaserGame bridge)
│   └── tests/                     # Test setup and mocks
│       └── __mocks__/             # Mock implementations
└── stick-rumble-server/           # Backend application (Go)
    ├── cmd/
    │   └── server/                # Application entry point
    ├── internal/                  # Private packages (unexported)
    │   ├── auth/                  # Authentication logic
    │   ├── db/                    # Database layer
    │   ├── game/                  # Game logic (rooms, players)
    │   └── network/               # WebSocket handling
    └── (go.mod, go.sum)           # Go module definition
```

## Quality Standards

Based on completed Epic 1 stories, all code must meet these standards:

### Test Coverage
- **Minimum 90% statement coverage** for all business logic
- Integration tests for end-to-end workflows
- Unit tests for critical functions and edge cases
- All tests must pass before merging

### Code Quality Gates
- **TypeScript**: `tsc -b --noEmit` passes with zero errors
- **ESLint**: Zero errors, zero warnings
- **Go**: `go vet ./...` and `gofmt` pass cleanly
- Use modern idioms (e.g., `any` instead of `interface{}` in Go)
- No commented-out code or debug statements in commits

### Development Workflow
- Issues are tracked using **Beads** (`bd` CLI) - see `.beads/` directory
- Each issue has acceptance criteria and implementation notes
- Follow TDD: Write tests first, then implement features
- Code reviews happen before marking issues complete

## AI Development Workflow

This project uses **Beads** for issue tracking and **Swarm** for parallel AI agent execution.

### Issue Tracking with Beads

```bash
# View available work
bd ready

# Show issue details
bd show {id}

# Update issue status
bd update {id} --status in_progress

# Close completed issue
bd close {id} --reason "Implementation complete"

# Sync changes to git
bd sync
```

### Parallel Execution with Swarm

Use `/swarm:director` to orchestrate parallel AI workers:
- Spawns isolated git worktrees per worker
- Monitors progress and rescues incomplete work
- Creates PRs for completed issues
- Cleans up merged worktrees

### Available Commands

- `/beads:create-tasks` - Create issues from epics/stories
- `/beads:implement-task` - Implement a single issue with TDD
- `/beads:full-cycle` - Full implementation cycle with reviews
- `/beads:review` - Code review for an issue
- `/swarm:director` - Orchestrate parallel workers

### Workflow

1. Create issues: `/beads:create-tasks`
2. Single issue: `/beads:full-cycle id={id}`
3. Parallel work: `/swarm:director`
4. After PR merge: `/swarm:director action=cleanup`

## Common Workflows

### Running Integration Tests

The project has integration tests that require both client and server running:

```bash
# Terminal 1: Start server
cd stick-rumble-server
go run cmd/server/main.go

# Terminal 2: Run client integration tests
cd stick-rumble-client
npm test -- WebSocketClient.integration.test.ts
```

### Adding a New WebSocket Message Type

1. Define message type in both client and server:
   - Client: Update `src/game/network/WebSocketClient.ts` with new handler
   - Server: Update `internal/network/websocket_handler.go` message switch

2. Add tests:
   - Client: Add unit test in `WebSocketClient.test.ts`
   - Server: Add test in `websocket_handler_test.go`

3. Update room broadcasting logic if needed in `internal/game/room.go`

### Debugging WebSocket Issues

- Server logs connection events: "Client connected: [player_id]"
- Client logs: "WebSocket connected" in browser console
- Check browser DevTools → Network → WS tab for WebSocket messages
- Server-side: Add `log.Println()` statements in `websocket_handler.go`

## Technology Versions

- **Go**: 1.24.1
- **Node.js**: Latest LTS recommended
- **Phaser**: 3.90.0
- **React**: 19.2.0
- **TypeScript**: 5.9.3
- **Vite**: 7.2.4
- **gorilla/websocket**: v1.5.3
- **Vitest**: 4.0.13

## Important Notes

- **CORS**: Currently allows all origins for development (see `websocket_handler.go`). Restrict in production.
- **WebSocket URL**: Client connects to `ws://localhost:8080/ws` by default
- **Reconnect Logic**: Client automatically attempts 3 reconnections with 1s delay
- **Graceful Shutdown**: Server handles SIGTERM/SIGINT with 30s timeout for clean shutdown
- **Message Format**: All WebSocket messages use JSON with `{type, timestamp, data}` structure
