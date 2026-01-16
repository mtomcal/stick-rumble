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
make test-server-verbose  # Run server tests with verbose output (debugging)
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
├── events-schema/                 # Shared TypeBox schemas for WebSocket messages
│   ├── src/
│   │   └── schemas/               # Schema definitions
│   │       ├── common.ts          # Shared types (Position, Velocity, Message)
│   │       ├── client-to-server.ts # Client→Server messages
│   │       └── server-to-client.ts # Server→Client messages (16 types)
│   └── generated/                 # Generated JSON schemas for Go server
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

## 👁️ Visual Regression Testing - CLAUDE HAS EYES NOW

**THIS IS CRITICAL**: Unit tests with 90%+ coverage have repeatedly failed to catch rendering bugs. PRs claiming to "fix" bugs pass all tests but the bug still exists in the browser. Visual regression tests give Claude the ability to actually SEE the game and verify fixes work.

### Why Visual Tests Matter

**The Pattern That Kept Happening:**
1. Agent submits PR saying "fixed sprite duplication"
2. Unit tests pass (90%+ coverage) ✅
3. PR merged ✅
4. Bug STILL EXISTS in browser ❌
5. Human playtesting catches the bug days later

**Why Unit Tests Failed:**
- Unit tests mock Phaser - they verify method calls, not actual rendering
- `expect(graphics.arc).toHaveBeenCalled()` passes even if nothing draws on screen
- Scene lifecycle (restart, cleanup) isn't tested in isolation
- Tests verify CODE runs, not that PIXELS appear

**Visual Tests Fix This:**
- Playwright runs a REAL browser with REAL Phaser rendering
- Screenshots capture ACTUAL pixels on screen
- If the arc doesn't render, the screenshot shows empty frame
- If sprites duplicate, the screenshot shows two sprites

### Visual Test Commands

```bash
# Run ALL visual tests
cd stick-rumble-client && npx playwright test tests/visual/

# Run specific visual test file
npx playwright test tests/visual/player-sprites.spec.ts
npx playwright test tests/visual/melee-animation.spec.ts
npx playwright test tests/visual/projectile-visuals.spec.ts
npx playwright test tests/visual/scene-lifecycle.spec.ts

# Update baseline snapshots after fixing a bug
npx playwright test tests/visual/player-sprites.spec.ts --update-snapshots
```

### How to Verify Your Fix Actually Works

**MANDATORY FOR ALL RENDERING BUG FIXES:**

1. **Run the relevant visual tests:**
   ```bash
   npx playwright test tests/visual/{relevant-test}.spec.ts
   ```

2. **Use the Read tool to VIEW the screenshots:**
   ```
   Read: stick-rumble-client/tests/screenshots/{test-name}/{screenshot}.png
   ```

3. **Verify with your own eyes (Claude's eyes):**
   - Is the sprite/arc/projectile actually visible?
   - Is it the correct color?
   - Is there only ONE sprite (not duplicates)?
   - Does the animation appear/disappear correctly?

4. **If you fixed the bug, update snapshots:**
   ```bash
   npx playwright test tests/visual/{test}.spec.ts --update-snapshots
   ```

5. **READ the new snapshots to confirm the fix:**
   - The new baseline should show the CORRECT rendering
   - Commit the updated snapshots with your fix

### Visual Test File Locations

```
stick-rumble-client/
├── tests/
│   └── visual/                          # Playwright visual test specs
│       ├── player-sprites.spec.ts       # Player rendering, duplication bugs
│       ├── melee-animation.spec.ts      # Bat/Katana swing arcs
│       ├── projectile-visuals.spec.ts   # Projectile colors
│       ├── scene-lifecycle.spec.ts      # Zombie sprites, cleanup
│       ├── health-bar.spec.ts           # Health bar UI
│       └── kill-feed.spec.ts            # Kill feed UI
│   └── screenshots/                     # Baseline snapshots (COMMITTED TO REPO)
│       ├── player-sprites.spec.ts/
│       │   ├── player-single.png        # Single player rendering
│       │   ├── player-multiple.png      # Multiple players
│       │   └── player-after-restart.png # After scene restart (catches AT3)
│       ├── melee-animation.spec.ts/
│       │   ├── melee-bat-swing.png      # Brown arc visible
│       │   ├── melee-katana-swing.png   # Silver arc visible
│       │   └── melee-after-swing.png    # Arc gone after animation
│       └── ...
├── public/
│   └── ui-test-entities.html            # Test harness page
└── src/
    └── entity-test-scene.ts             # Test scene with window.* functions
```

### Entity Test Harness

The test harness (`ui-test-entities.html`) exposes window functions for Playwright:

```typescript
// Spawn a player at position
window.spawnPlayer(id: string, x: number, y: number, color: string)

// Remove a player
window.removePlayer(id: string)

// Get active sprite count (for verifying no duplicates)
window.getActiveSprites(): Array<{id, x, y}>
window.getPlayerCount(): number

// Trigger melee animation
window.triggerMeleeSwing(weaponType: 'Bat' | 'Katana', angle: number)

// Scene lifecycle
window.restartScene()      // Simulates match restart
window.clearAllSprites()   // Clean slate

// Projectiles
window.spawnProjectile(weaponType: string, x: number, y: number): string

// Frame-stepping for deterministic animation capture
window.pauseGameLoop()
window.resumeGameLoop()
window.stepFrame(n: number)  // Advance exactly N frames
window.getFrameCount(): number
```

### CRITICAL Tests That Catch Known Bugs

| Bug | Test File | Test Name | What It Catches |
|-----|-----------|-----------|-----------------|
| AT3 (sprite duplication) | `player-sprites.spec.ts:137` | "should not duplicate sprites after scene restart" | Spawns player, restarts scene, spawns again, verifies count=1 |
| o5y (melee not rendering) | `melee-animation.spec.ts:132` | "arc should be visible during animation" | Screenshots mid-animation, verifies arc pixels exist |
| wzq (wrong projectile colors) | `projectile-visuals.spec.ts` | Color-specific tests | Verifies Uzi=orange, AK47=gold, not all yellow |

### DO NOT CLAIM A BUG IS FIXED UNLESS:

1. ✅ You ran the visual tests
2. ✅ You READ the screenshot files with the Read tool
3. ✅ You VISUALLY CONFIRMED the fix (saw the sprite/arc/color)
4. ✅ You updated and committed the new baseline snapshots
5. ✅ The screenshot shows the EXPECTED result, not an empty frame

**Example verification workflow:**
```
1. Fix the sprite duplication bug in PlayerManager.ts
2. Run: npx playwright test tests/visual/player-sprites.spec.ts
3. Read: tests/screenshots/player-sprites.spec.ts/player-after-restart.png
4. LOOK AT IT - is there ONE player or TWO?
5. If ONE player → fix worked, update snapshots, commit
6. If TWO players → fix didn't work, keep debugging
```

## Quality Standards

Based on completed Epic 1 stories, all code must meet these standards:

### Test Coverage
- **Minimum 90% statement coverage** for all business logic
- Integration tests for end-to-end workflows
- Unit tests for critical functions and edge cases
- **Visual regression tests for ALL rendering-related changes**
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

### Events Schema System

The project uses a shared schema system (`events-schema/`) for type-safe WebSocket messages between client and server.

**Package Location:** `events-schema/`

**Key Files:**
- `src/schemas/common.ts` - Shared types (Position, Velocity, Message base)
- `src/schemas/client-to-server.ts` - Client→Server message schemas
- `src/schemas/server-to-client.ts` - Server→Client message schemas (16 types)
- `src/index.ts` - Public exports
- `src/build-schemas.ts` - Generates JSON schemas for Go server
- `src/validate-schemas.ts` - Validates generated schemas
- `src/check-schemas-up-to-date.ts` - CI drift detection

**Schema Commands:**
```bash
# From project root
make schema-build         # Generate JSON schemas from TypeBox
make schema-validate      # Check schemas are up-to-date (CI uses this)

# From events-schema/
npm run build:schemas     # Generate schemas
npm run check:schemas     # Verify no drift
npm test                  # Run schema unit tests
```

**Adding a New WebSocket Message Type (Schema-First Approach):**

1. **Define schema in TypeBox** (`events-schema/src/schemas/`):
   ```typescript
   // In server-to-client.ts or client-to-server.ts
   import { Type, type Static } from '@sinclair/typebox';
   import { createTypedMessageSchema } from './common.js';

   export const MyNewDataSchema = Type.Object({
     fieldName: Type.String({ description: 'Field description' }),
   });
   export type MyNewData = Static<typeof MyNewDataSchema>;

   export const MyNewMessageSchema = createTypedMessageSchema('my:new', MyNewDataSchema);
   export type MyNewMessage = Static<typeof MyNewMessageSchema>;
   ```

2. **Export from index.ts**:
   ```typescript
   export { MyNewDataSchema, MyNewMessageSchema, type MyNewData, type MyNewMessage } from './schemas/server-to-client.js';
   ```

3. **Add tests** in corresponding `.test.ts` file

4. **Generate JSON schemas**:
   ```bash
   make schema-build
   ```

5. **Update client handlers** (`stick-rumble-client/src/game/scenes/GameSceneEventHandlers.ts`):
   ```typescript
   import type { MyNewData } from '@stick-rumble/events-schema';

   // In handler:
   const data = message.data as MyNewData;
   ```

6. **Update server broadcast** (`stick-rumble-server/internal/network/`):
   - Add validation call if ENABLE_SCHEMA_VALIDATION is set
   - The server loads JSON schemas from `events-schema/generated/`

**Server-Side Schema Validation:**
- Enabled via `ENABLE_SCHEMA_VALIDATION=true` environment variable
- Development-only (skipped in production for performance)
- Validates outgoing messages in `broadcast_helper.go` and `message_processor.go`
- Logs warnings on validation failures without blocking messages

**Available Message Types:**

Client→Server:
- `input:state` - WASD input state
- `player:shoot` - Shoot request
- `player:reload` - Reload request
- `weapon:pickup_attempt` - Weapon pickup request

Server→Client (16 types):
- `room:joined` - Player joined room
- `player:move` - Player position updates (20Hz)
- `projectile:spawn` / `projectile:destroy` - Projectile lifecycle
- `weapon:state` - Ammo/reload state
- `shoot:failed` - Shoot rejection reason
- `player:damaged` / `hit:confirmed` - Damage events
- `player:death` / `player:kill_credit` / `player:respawn` - Death/respawn cycle
- `match:timer` / `match:ended` - Match state
- `weapon:spawned` / `weapon:pickup_confirmed` / `weapon:respawned` - Weapon crates

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
