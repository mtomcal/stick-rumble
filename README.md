# Stick Rumble

**A multiplayer arena shooter built to validate AI-assisted development workflows**

Stick Rumble is a real-time multiplayer stick figure arena shooter demonstrating that AI agents can handle complex, stateful systems—including learning new languages (Go) in production.

> *"If the system can handle real-time multiplayer game development, it can handle anything."*

---

## Project Status

**Current State: Playable Alpha** — The game runs with full combat, 5 weapon types, client-side prediction, and netcode optimizations. Core gameplay loop is solid.

### Roadmap

| Epic | Name | Status | Description |
|------|------|--------|-------------|
| 1 | Foundation | **Complete** | Project setup, WebSocket connection, basic movement |
| 2 | Core Combat | **Complete** | Shooting, hit detection, health, death/respawn, match flow |
| 3 | Weapon Systems | **Complete** | 5 weapon types, melee/ranged, sprint, dodge roll, sprites |
| 4 | Netcode | **Complete** | Client prediction, interpolation, lag compensation, delta compression |
| 5 | Matchmaking | Not Started | Lobbies, game modes, party system |
| 6 | Progression | Not Started | Player accounts, XP, unlocks, cosmetics |
| 7 | Maps | Not Started | Multiple arenas, destructibles, spawn balancing |
| 8 | Mobile | Not Started | Touch controls, cross-platform play |
| 9 | Polish | Not Started | Particles, animations, sound design, UI polish |

### What's Been Built (Epics 1-4)

**Combat**: 5 weapons (Pistol, AK47, Shotgun, Bat, Katana) with weapon pickups, reload mechanics, damage falloff, and melee swing animations.

**Movement**: Sprint, dodge roll with invincibility frames, client-side prediction for instant-feeling controls, and server reconciliation for corrections.

**Netcode**: Full client-side prediction pipeline, smooth interpolation for other players, delta compression for bandwidth optimization, and lag compensation for fair hit detection. Includes an artificial latency testing tool for development.

**Visuals**: Procedural character and weapon sprites, health bars, hit effects, kill feed, and match end screens — all validated by visual regression tests.

### Known Rough Edges

This is an active development project. Current limitations:

| Area | Issue | Planned Fix |
|------|-------|-------------|
| **Multiplayer** | No lobby system — players auto-matched | Epic 5: Full matchmaking system |
| **Balance** | Weapon tuning ongoing | Continued iteration with playtesting |
| **Mobile** | Desktop only, no touch support | Epic 8: Mobile cross-platform |
| **Polish** | Minimal particles and screen effects | Epic 9: Full polish pass |

---

## Project Highlights

| Metric | Value |
|--------|-------|
| **Test Cases** | 2,000+ (1,340 client + 682 server) |
| **Visual Regression Screenshots** | 44 baseline images |
| **WebSocket Message Types** | 28 (22 server→client, 6 client→server) |
| **Issues Tracked** | 122 (121 closed) |
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
│  │  │ 2,000+      │  │ WebSocket   │  │ 44 screenshots       │  │   │
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
- **Custom WebSocket protocol** with 28 message types
- **Client-side prediction** with server reconciliation for responsive controls
- **Delta compression** for bandwidth optimization
- **Lag compensation** for fair hit detection across latencies

### Comprehensive Test Coverage
- **Unit tests** verify business logic (2,000+ tests)
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
