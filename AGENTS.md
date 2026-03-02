# AGENTS.md

This file provides guidance to coding agents working in this repository.

## Project Overview

Stick Rumble is a multiplayer stick figure arena shooter with a dual-application architecture:
- Frontend: Phaser 3 + React + TypeScript
- Backend: Go 1.24.1 + WebSocket

The architecture is server-authoritative for game state, with client-side prediction for responsiveness.

## Root Workflow

Use the root-level `Makefile` for normal development tasks.

Important:
- Run commands from the repository root unless you are doing package-specific work.
- Prefer `make ...` targets over manually `cd`-ing into `stick-rumble-client/` or `stick-rumble-server/`.
- Use conventional commits for all commit messages.
- Before committing, ensure git identity is set to:

```bash
git config user.name "mtomcal"
git config user.email "mtomcal@users.noreply.github.com"
```

Do not commit with any other git identity.

## Standard Commands

### Setup

```bash
make install
```

### Development

```bash
make dev
make dev-client
make dev-server
```

### Testing

```bash
make test
make test-client
make test-server
make test-server-verbose
make test-integration
make test-coverage
```

### Quality

```bash
make lint
make typecheck
```

### Build

```bash
make build
make clean
make help
```

## Required Agent Workflow

- Start from the repo root.
- Use `make dev-server` for backend-only work or `make dev` for full-stack work.
- Use `make test` to verify integrated changes.
- Use `make test-client` instead of manually running client tests when possible.
- Use `make test-server` instead of manually running server tests when possible.
- Use `make test-integration` for integration coverage; it handles server startup and shutdown.
- Before finalizing a change, prefer:

```bash
make lint && make typecheck && make test
```

## Package-Specific Commands

Use these only when targeted work requires them.

### Frontend

```bash
cd stick-rumble-client
npm install
npm run dev
npm test
npm run test:watch
npm run test:unit
npm run test:unit:coverage
npm run test:integration
npm run test:all
npm run test:ui
npm run test:coverage
npm run typecheck
npm run lint
npm run build
```

### Backend

```bash
cd stick-rumble-server
go mod download
go run cmd/server/main.go
PORT=8081 go run cmd/server/main.go
go test ./...
go test ./internal/network -v
go test ./... -cover
go test ./internal/network -v -run TestWebSocketHandler
go test ./internal/game -v -run "TestRoom.*"
go vet ./...
gofmt -l .
go build -o server cmd/server/main.go
```

## Architecture Notes

### WebSocket Message Shape

Client:

```typescript
interface Message {
  type: string;
  timestamp: number;
  data?: unknown;
}
```

Server:

```go
type Message struct {
    Type      string `json:"type"`
    Timestamp int64  `json:"timestamp"`
    Data      any    `json:"data,omitempty"`
}
```

Common message types:
- `room:joined`
- `player:left`
- `input:state`
- `player:move`
- `test`

### Room Management

- Room capacity: 8 players
- Rooms are auto-created when 2 waiting players are available
- Messages are broadcast to other players in the room
- Disconnects trigger cleanup and `player:left`

Key files:
- Server: `stick-rumble-server/internal/game/room.go`
- Server networking: `stick-rumble-server/internal/network/websocket_handler.go`
- Client WebSocket wrapper: `stick-rumble-client/src/game/network/WebSocketClient.ts`

## Important Paths

- `events-schema/`: shared TypeBox schemas and generated JSON schemas
- `stick-rumble-client/src/game/`: Phaser game code
- `stick-rumble-client/src/ui/`: React UI
- `stick-rumble-server/cmd/server/`: server entrypoint
- `stick-rumble-server/internal/game/`: game logic
- `stick-rumble-server/internal/network/`: WebSocket and network handling

## Quality Standards

### Coverage and Tests

- Minimum 90% statement coverage for business logic
- Add integration tests for end-to-end flows where appropriate
- Add unit tests for critical behavior and edge cases
- All tests must pass before merging

### Code Quality Gates

- TypeScript must pass type checking with zero errors
- ESLint must have zero errors and zero warnings
- Go must pass `go vet ./...`
- Go formatting must be clean
- Use modern Go idioms such as `any` instead of `interface{}`
- Do not leave commented-out code or debug statements in commits

### Development Style

- Prefer TDD: write or tighten tests before implementation when practical
- Keep changes aligned with existing architecture and message contracts

## Common Workflows

### Integration Tests

Preferred:

```bash
make test-integration
```

Manual fallback:

```bash
cd stick-rumble-server
go run cmd/server/main.go
```

```bash
cd stick-rumble-client
npm test -- WebSocketClient.integration.test.ts
```

### Adding a New WebSocket Message Type

1. Update the client handler in `stick-rumble-client/src/game/network/WebSocketClient.ts`.
2. Update the server handling in `stick-rumble-server/internal/network/websocket_handler.go`.
3. Add or update client tests.
4. Add or update server tests.

## Subagent Templates

Use these as starting points when delegating narrow verification work to a subagent.

### Unit Test Verification

Template:

```text
Review the recent test changes in /home/mtomcal/code/stick-rumble-specs for vague assertions, weak tests, or coverage gaps. Focus on these files: <file list>. Be specific: identify bad assertions or meaningful missing cases only.
```

Example formula used in this repo:

```text
Review the recent test changes in /home/mtomcal/code/stick-rumble-specs for vague assertions, weak tests, or coverage gaps. Focus on these files: stick-rumble-client/src/game/entities/Crosshair.test.ts, stick-rumble-client/src/game/entities/AimLine.test.ts, stick-rumble-client/src/game/entities/RangedWeapon.test.ts, stick-rumble-client/src/game/entities/ProceduralPlayerGraphics.test.ts, stick-rumble-client/src/game/entities/ProceduralWeaponGraphics.test.ts, stick-rumble-client/src/game/entities/PlayerManager.test.ts, stick-rumble-client/src/game/scenes/GameSceneUI.test.ts, stick-rumble-client/src/game/scenes/GameSceneEventHandlers.test.ts. Be specific: identify bad assertions or meaningful missing cases only.
```

Recommended usage:
- Use an `explorer` subagent for static review of changed tests.
- Ask for specific findings, not a summary.
- Prefer “meaningful missing cases only” to avoid low-signal feedback.
