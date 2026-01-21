# Stick Rumble

**A multiplayer arena shooter built to validate AI-assisted development workflows**

Stick Rumble is a real-time multiplayer stick figure arena shooter demonstrating that AI agents can handle complex, stateful systems—including learning new languages (Go) in production.

> *"If the system can handle real-time multiplayer game development, it can handle anything."*

---

## Project Status

**Current State: Playable Alpha** — The game runs, players can connect, shoot each other, and matches end. But it's rough around the edges.

### Roadmap

| Epic | Name | Status | Description |
|------|------|--------|-------------|
| 1 | Foundation | **Complete** | Project setup, WebSocket connection, basic movement |
| 2 | Core Combat | **Complete** | Shooting, hit detection, health, death/respawn, match flow |
| 3 | Weapon Systems | **In Progress** | 5 weapon types, melee/ranged, sprint, dodge roll, sprites |
| 4 | Netcode | Not Started | Client prediction, interpolation, lag compensation |
| 5 | Matchmaking | Not Started | Lobbies, game modes, party system |
| 6 | Progression | Not Started | Player accounts, XP, unlocks, cosmetics |
| 7 | Maps | Not Started | Multiple arenas, destructibles, spawn balancing |
| 8 | Mobile | Not Started | Touch controls, cross-platform play |
| 9 | Polish | Not Started | Particles, animations, sound design, UI polish |

### Current Focus: Epic 3 (36% complete)

Building the weapon system with 5 distinct weapons:
- **Done**: Weapon pickup system, basic melee, basic ranged, reload, sprint, dodge roll
- **In Progress**: Character sprites, health bar UI, hit effects
- **Remaining**: Polish and balance tuning

### Known Rough Edges

This is an active development project. Current limitations:

| Area | Issue | Planned Fix |
|------|-------|-------------|
| **Netcode** | No client-side prediction — movement feels laggy on high latency | Epic 4: Full prediction/reconciliation system |
| **Visuals** | Primitive shapes, no real sprites yet | Epic 3 (Story 3.7A): Character & weapon sprites |
| **Game Feel** | No screen shake, minimal hit feedback | Epic 3 (Story 3.7B) + Epic 9 polish pass |
| **Multiplayer** | No lobby system — players auto-matched | Epic 5: Full matchmaking system |
| **Balance** | AK47 overpowered, melee underwhelming | Active tuning in Epic 3 with damage falloff |
| **Mobile** | Desktop only, no touch support | Epic 8: Mobile cross-platform |

### Why Ship Rough?

Each epic completes with a **playtesting gate** — a serious play session that catches integration bugs automated tests miss. The rough edges are documented and prioritized, not ignored. This is how real-time multiplayer games get built: iteratively, with human feedback in the loop.

---

## Project Highlights

| Metric | Value |
|--------|-------|
| **Test Cases** | 1,400+ (1,082 client + 383 server) |
| **Visual Regression Screenshots** | 40 baseline images |
| **WebSocket Message Types** | 27 (20 server→client, 7 client→server) |
| **Concurrent AI Agents** | Up to 8 parallel workers |
| **Test Coverage Target** | >90% statement coverage |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        STICK RUMBLE ARCHITECTURE                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────┐         WebSocket          ┌────────────────┐ │
│  │   PhaserJS 3     │◄─────── JSON/20Hz ────────►│    Go 1.25     │ │
│  │   + React 19     │                            │    Server      │ │
│  │                  │  ┌──────────────────────┐  │                │ │
│  │  Client-Side     │  │  TypeBox Schemas     │  │  Server-Auth   │ │
│  │  Prediction      │  │  (Shared Validation) │  │  Game State    │ │
│  └──────────────────┘  └──────────────────────┘  └────────────────┘ │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    VALIDATION INFRASTRUCTURE                  │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌──────────────────────┐  │   │
│  │  │ Unit Tests  │  │ Integration │  │ Visual Regression    │  │   │
│  │  │ (Vitest)    │  │ Tests       │  │ (Playwright)         │  │   │
│  │  │ 1,400+      │  │ WebSocket   │  │ 40 screenshots       │  │   │
│  │  └─────────────┘  └─────────────┘  └──────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    AI DEVELOPMENT SYSTEM                      │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌──────────────────────┐  │   │
│  │  │ Beads       │  │ Swarm       │  │ Claude Code Agents   │  │   │
│  │  │ (Issues)    │──│ (Orchestr.) │──│ (Up to 8 parallel)   │  │   │
│  │  └─────────────┘  └─────────────┘  └──────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Quick Start

```bash
# Install dependencies
make install

# Run development servers (client + server)
make dev

# Run all tests
make test

# Run visual regression tests
make test-visual
```

**Client**: http://localhost:5173
**Server**: http://localhost:8080

---

## Technology Stack

### Frontend
- **Phaser 3.90** - 2D game engine
- **React 19** - UI components
- **TypeScript 5.9** - Type safety
- **Vite 7** - Build tooling
- **Vitest** - Unit testing

### Backend
- **Go 1.25** - Server runtime
- **gorilla/websocket** - WebSocket handling
- **Server-authoritative architecture** - Anti-cheat by design

### Shared
- **TypeBox** - JSON Schema generation from TypeScript
- **events-schema** - Shared message type definitions

### Testing
- **Playwright** - Visual regression testing
- **Vitest** - Client unit/integration tests
- **Go testing** - Server unit tests

---

## Documentation

| Document | Description |
|----------|-------------|
| [Architecture](docs/ARCHITECTURE.md) | System design, data flow, and component diagrams |
| [Multi-Agent Workflow](docs/MULTI-AGENT-WORKFLOW.md) | AI orchestration system and parallel development |
| [Testing Strategy](docs/TESTING-STRATEGY.md) | Validation infrastructure and visual regression |
| [CLAUDE.md](CLAUDE.md) | AI agent instructions and project context |

---

## Key Features

### Server-Authoritative Gameplay
All game state lives on the server. Clients send inputs, server calculates results. This prevents cheating and ensures consistent gameplay across all connected players.

### Real-Time State Synchronization
- **20Hz tick rate** for player positions
- **Custom WebSocket protocol** with 27 message types
- **Client-side prediction** for responsive controls

### Comprehensive Test Coverage
- **Unit tests** verify business logic (1,400+ tests)
- **Integration tests** validate WebSocket communication
- **Visual regression tests** catch rendering bugs that unit tests miss
- **Human playtesting** remains essential—real-time games require human perception for final validation

### Multi-Agent Development
- **Beads** tracks issues and acceptance criteria
- **Swarm** orchestrates parallel Claude Code agents
- **Isolated worktrees** prevent agent conflicts

---

## Project Structure

```
stick-rumble/
├── stick-rumble-client/     # PhaserJS + React frontend
│   ├── src/
│   │   ├── game/            # Phaser game code
│   │   │   ├── entities/    # Player, weapons, projectiles
│   │   │   ├── scenes/      # Game scenes
│   │   │   ├── network/     # WebSocket client
│   │   │   └── ui/          # In-game UI
│   │   └── ui/              # React components
│   └── tests/
│       └── visual/          # Playwright visual tests
│
├── stick-rumble-server/     # Go WebSocket server
│   ├── cmd/server/          # Entry point
│   └── internal/
│       ├── game/            # Game logic, physics, weapons
│       └── network/         # WebSocket handling, broadcasting
│
├── events-schema/           # Shared TypeBox message schemas
│   ├── src/schemas/         # TypeScript definitions
│   └── generated/           # JSON schemas for Go validation
│
├── docs/                    # Documentation
└── .beads/                  # Issue tracking database
```

---

## Development Commands

```bash
# Development
make dev              # Run client + server
make dev-client       # Client only (port 5173)
make dev-server       # Server only (port 8080)

# Testing
make test             # All tests
make test-client      # Client unit tests
make test-server      # Server unit tests
make test-integration # WebSocket integration tests
make test-visual      # Visual regression tests

# Code Quality
make lint             # ESLint + go vet + gofmt
make typecheck        # TypeScript checking

# Build
make build            # Production build
```

---

## AI Development Workflow

This project uses a custom multi-agent system for parallel development:

```bash
# View available work
bd ready

# Spawn parallel workers
/swarm:director

# Implement single issue
/beads:full-cycle id={issue-id}
```

See [Multi-Agent Workflow](docs/MULTI-AGENT-WORKFLOW.md) for details.

---

## License

MIT
