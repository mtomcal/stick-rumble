# Stick Rumble

**Playable MVP public alpha:** https://stickrumble.com

Stick Rumble is a browser-based multiplayer stick-figure arena shooter for desktop and phone. It uses a Phaser/React TypeScript client, a Go WebSocket server, and shared schema contracts for real-time multiplayer state.

I started the project in November 2025 as a full-stack enterprise software engineer, not a game developer, to push outside my comfort zone and test AI engineering workflows on a system with real-time state, game feel, rendering, shared contracts, deployment, and production feedback.

Current status: live public alpha with public matchmaking, room codes, 2-8 player matches, six weapons, dodge roll, server-authoritative gameplay, desktop controls, and mobile landscape presentation.

## Current Capabilities

- Public matchmaking and room-code joins
- 2-8 player matches with kill target and time limit
- Server-authoritative movement, combat, deaths, respawns, scoring, and weapon pickups
- Client-side prediction, interpolation, delta snapshots, and reconciliation for smoother multiplayer feel
- Six weapons: Pistol, Uzi, AK47, Shotgun, Bat, and Katana
- Sprint, dodge roll, reloads, health regeneration, melee knockback, and damage feedback
- Shared TypeBox/JSON Schema message contracts between the TypeScript client and Go server
- Map configuration and validation through shared map schemas
- Desktop keyboard/mouse play plus mobile landscape presentation
- AWS deployment with S3/CloudFront for the client and an EC2/Caddy/Go WebSocket server

## Project Scale

| Area | Ballpark |
|------|----------|
| Tests | 2,100+ test cases across 120+ test files |
| Specs | 25+ active spec documents plus 70+ visual reference frames |
| Runtime | Phaser/React TypeScript client + Go WebSocket server |
| Contracts | Shared TypeBox schemas with generated JSON Schema validation |
| Deployment | Public AWS-backed deployment at stickrumble.com |

## Specs as Project Memory

The `specs/` directory is the central brain of the project.

I use spec changes first as an intention and taste engine: a way to write down what the game should feel like, what tradeoffs matter, and what behavior must stay stable before asking an agent to touch code. That gave the project durable memory across many small sessions and helped avoid expensive hill-climbing where each implementation pass locally improves one thing while drifting away from the larger product direction.

The specs are not only feature notes. They capture gameplay contracts, networking behavior, UI expectations, visual direction, deployment decisions, and test obligations.

## Context Management History

The repo reflects an evolution in context management as the project grew:

1. **Prototype context** — a client-only single-player prototype from Google AI Studio explored game feel, controls, AI bots, and visual direction.
2. **BMad/task-plan context** — BMad-generated GDD, architecture, and epic docs were useful for early game planning and helped turn a loose idea into a structured multiplayer rewrite. They were much less useful as implementation context: the docs were large, token-heavy, and inefficient to keep in an agent's working context.
3. **Spec-first context** — the current workflow in `specs/`, where focused specs act as the central brain for product intent, engineering constraints, acceptance criteria, validation, and agent context.

## Architecture

```text
Browser client                         Game server
Phaser 3 + React + TypeScript  <---->  Go + gorilla/websocket
Client prediction + interpolation       Server-authoritative simulation
Shared TypeBox message schemas          JSON Schema validation
```

The server owns authoritative game state. Clients send inputs and render the validated state they receive back. The client predicts local movement for responsiveness, then reconciles against server snapshots.

## Validation

The project is validated through a mix of automated tests, visual review, and real playtesting:

- Vitest unit/integration coverage for the TypeScript client and shared schema packages
- Go unit tests for game rules, room behavior, WebSocket handling, combat, movement, and server utilities
- WebSocket integration tests that start a real server and exercise client/server flows
- Visual reference frames in `specs/visual-spec/` for gameplay readability and UI polish
- Manual playtesting against the deployed environment
- Video-driven debugging: record fast gameplay loops, break the footage into frames, and use those frames to trace visual bugs, timing issues, and feel regressions that are hard to catch in traditional web-app test loops

The normal local gate is:

```bash
make lint && make typecheck && make test
```

## Quick Start

```bash
make install
make dev
```

Client: http://localhost:5173

Server: http://localhost:8080

Run the full local test suite:

```bash
make test
```

## Development Commands

```bash
# Development
make dev              # Run client + server
make dev-client       # Client only
make dev-server       # Server only

# Testing
make test             # All tests
make test-client      # Client unit tests
make test-server      # Server unit tests
make test-integration # WebSocket integration tests

# Quality
make lint             # ESLint + go vet + gofmt
make typecheck        # TypeScript checking

# Build
make build            # Production build
```

## Repository Map

```text
.
├── specs/                # Active project brain and implementation contracts
├── stick-rumble-client/  # Phaser/React TypeScript client
├── stick-rumble-server/  # Go WebSocket game server
├── events-schema/        # Shared WebSocket message schemas
├── maps-schema/          # Shared map schema definitions
├── maps/                 # Authored map configs
├── research/             # Focused implementation investigations
└── docs/                 # Historical docs, archived planning, and prototype context
```

## Documentation

| Path | Purpose |
|------|---------|
| [`specs/`](specs/) | Active project brain: current behavior contracts, product intent, visual references, deployment notes, and test obligations |
| [`events-schema/`](events-schema/) | Shared TypeBox message schemas and generated JSON Schema artifacts |
| [`maps-schema/`](maps-schema/) | Shared map schema definitions and validation |
| [`docs/`](docs/) | Legacy design docs, early research, archived epics, and historical planning material |
| [`research/`](research/) | Focused implementation investigations and bug research notes |

## Next Directions

Stick Rumble is live as a playable MVP public alpha. Future work is less about turning it into a product and more about continuing to explore the technical and design surface area of a real multiplayer game.

| Area | Direction |
|------|-----------|
| Player identity | Login, player profiles, persistent names, and account-level stats |
| Progression | XP, unlocks, cosmetics, and reasons to care about repeat matches |
| Leaderboards | Public rankings, recent match summaries, and competitive history |
| Match flow | Better lobby flow, room invites, and visibility into active games |
| Maps and balance | More arenas, weapon tuning, spawn improvements, and playtest-driven adjustments |
| Infrastructure | Infrastructure as code, safer deploy automation, observability, and production hardening |

## License

MIT
