# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Stick Rumble is a multiplayer stick figure arena shooter built with a dual-application architecture:
- **Frontend**: Phaser 3 + React + TypeScript (client-side game)
- **Backend**: Go 1.24.1 + WebSocket (server-authoritative multiplayer)

The architecture prioritizes server-authoritative gameplay to prevent cheating while maintaining responsive controls through client-side prediction.

## Development Commands

### Frontend (stick-rumble-client/)

```bash
# Development
cd stick-rumble-client
npm install                  # Install dependencies
npm run dev                  # Start dev server (http://localhost:5173)

# Testing
npm test                     # Run tests in watch mode
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

**Frontend:**
```
stick-rumble-client/
├── src/
│   ├── game/              # Phaser game code
│   │   ├── scenes/        # Phaser scenes (GameScene, etc.)
│   │   ├── network/       # WebSocket client
│   │   └── config/        # Game configuration
│   ├── ui/                # React components
│   │   └── common/        # Shared components (PhaserGame bridge)
│   ├── shared/            # Shared types/constants
│   └── main.tsx           # Entry point
├── tests/                 # Test setup and mocks
└── vitest.config.ts       # Test configuration
```

**Backend:**
```
stick-rumble-server/
├── cmd/server/            # Application entry point
│   └── main.go            # HTTP server with graceful shutdown
├── internal/              # Private packages (unexported)
│   ├── game/              # Game logic (rooms, players)
│   └── network/           # WebSocket handling
└── go.mod                 # Go module definition
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
- Stories are tracked in `.readyq.md` using the ReadyQ task management system
- Each story has acceptance criteria, session logs, and implementation notes
- Follow TDD: Write tests first, then implement features
- Code reviews happen before marking stories complete

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
