# Stick Rumble Specification Suite

> **Version**: 1.1.0
> **Last Updated**: 2026-02-15
> **Purpose**: Complete specification for recreating Stick Rumble from scratch

---

## Project Summary

Stick Rumble is a browser-based multiplayer stick figure arena shooter. The game supports 2-8 players in fast-paced 3-7 minute competitive matches. Players spawn with a Pistol and fight to reach the kill target (20 kills) or have the highest score when time expires (7 minutes). Weapon pickups, melee attacks, and dodge rolls add tactical depth.

The architecture is **server-authoritative** to prevent cheating: the client is an untrusted display layer that sends inputs and receives validated game state. Client-side prediction provides responsive controls despite network latency.

---

## Technology Stack

| Component | Technology | Version | Purpose |
|-----------|------------|---------|---------|
| Game Engine | Phaser | 3.90.0 | 2D rendering, scene management, input |
| UI Framework | React | 19.2.0 | HUD overlays, match end screen |
| Type System | TypeScript | 5.9.3 | Static typing for client code |
| Build Tool | Vite | 7.2.4 | Development server, production builds |
| Backend Runtime | Go | 1.25 | Server-side game logic |
| WebSocket | gorilla/websocket | v1.5.3 | Real-time bidirectional communication |
| Testing (Client) | Vitest | 4.0.13 | Unit and integration tests |
| E2E Testing | Playwright | 1.57.0 | Visual regression testing |
| Schema System | TypeBox | 0.34 | Shared message schemas |

---

## Reading Order

For an AI agent recreating Stick Rumble from scratch, read specs in this order:

### Phase 1: Foundation (Start Here)

1. **[constants.md](constants.md)** - All game constants with rationale
2. **[arena.md](arena.md)** - World boundaries and spatial rules

### Phase 2: Core Entities

3. **[player.md](player.md)** - Player state, health, death, respawn
4. **[movement.md](movement.md)** - Physics, WASD, sprint, acceleration

### Phase 3: Networking

5. **[messages.md](messages.md)** - All 28 WebSocket message types
6. **[networking.md](networking.md)** - Connection lifecycle, reconnection
7. **[rooms.md](rooms.md)** - Matchmaking, room management

### Phase 4: Combat

8. **[weapons.md](weapons.md)** - All 6 weapons, stats, recoil, spread
9. **[shooting.md](shooting.md)** - Ranged attacks, projectiles, reload
10. **[hit-detection.md](hit-detection.md)** - Collision detection, damage
11. **[melee.md](melee.md)** - Bat and Katana mechanics, knockback

### Phase 5: Advanced Mechanics

12. **[dodge-roll.md](dodge-roll.md)** - Evasion, i-frames, cooldown
13. **[match.md](match.md)** - Win conditions, timer, state machine

### Phase 6: Client Implementation

14. **[client-architecture.md](client-architecture.md)** - Phaser scenes, managers
15. **[graphics.md](graphics.md)** - Procedural rendering
16. **[ui.md](ui.md)** - HUD elements, kill feed
17. **[audio.md](audio.md)** - Sound effects and audio system

### Phase 7: Server Implementation

18. **[server-architecture.md](server-architecture.md)** - Game loop, concurrency

### Phase 8: Verification

19. **[test-index.md](test-index.md)** - All test scenarios cross-reference

---

## Dependency Graph

```
                        ┌─────────────────┐
                        │   constants.md  │
                        └────────┬────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              │                  │                  │
              ▼                  ▼                  ▼
        ┌───────────┐      ┌──────────┐      ┌───────────┐
        │ arena.md  │      │player.md │      │ match.md  │
        └─────┬─────┘      └────┬─────┘      └─────┬─────┘
              │                 │                  │
              │    ┌────────────┼────────────┐     │
              │    │            │            │     │
              ▼    ▼            ▼            ▼     ▼
        ┌──────────────┐  ┌──────────┐  ┌──────────────┐
        │ movement.md  │  │weapons.md│  │  rooms.md    │
        └──────┬───────┘  └────┬─────┘  └──────┬───────┘
               │               │               │
               │    ┌──────────┴──────────┐    │
               │    │                     │    │
               ▼    ▼                     ▼    ▼
        ┌─────────────────┐       ┌────────────────┐
        │  dodge-roll.md  │       │  shooting.md   │
        └────────┬────────┘       └───────┬────────┘
                 │                        │
                 │    ┌───────────────────┤
                 │    │                   │
                 ▼    ▼                   ▼
        ┌─────────────────┐       ┌────────────────┐
        │hit-detection.md │       │   melee.md     │
        └────────┬────────┘       └───────┬────────┘
                 │                        │
                 └────────────┬───────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐    ┌────────────────┐    ┌────────────────┐
│ messages.md   │    │ networking.md  │    │client-arch.md  │
└───────────────┘    └────────────────┘    └───────┬────────┘
                                                   │
                     ┌─────────────────────────────┤
                     │              │              │
                     ▼              ▼              ▼
              ┌───────────┐  ┌──────────┐  ┌────────────┐
              │graphics.md│  │  ui.md   │  │ audio.md   │
              └───────────┘  └──────────┘  └────────────┘
```

### Key Dependencies

| Spec | Depends On | Depended By |
|------|------------|-------------|
| constants.md | - | All other specs |
| arena.md | constants.md | movement.md, dodge-roll.md, hit-detection.md |
| player.md | constants.md | movement.md, weapons.md, match.md |
| movement.md | player.md, arena.md | dodge-roll.md |
| messages.md | All gameplay specs | networking.md, client-architecture.md |
| networking.md | messages.md | rooms.md |
| rooms.md | networking.md | match.md |
| weapons.md | constants.md, player.md | shooting.md, melee.md |
| shooting.md | weapons.md | hit-detection.md |
| hit-detection.md | shooting.md, player.md, arena.md | client-architecture.md |
| melee.md | weapons.md | hit-detection.md |
| dodge-roll.md | movement.md, arena.md | hit-detection.md |
| match.md | player.md, rooms.md | client-architecture.md |
| client-architecture.md | All gameplay specs | graphics.md, ui.md, audio.md |
| graphics.md | constants.md, player.md, weapons.md, arena.md | client-architecture.md, test-index.md |
| ui.md | constants.md, player.md, weapons.md, match.md, client-architecture.md, graphics.md | test-index.md |
| audio.md | constants.md, weapons.md, dodge-roll.md, client-architecture.md | - (leaf spec) |

---

## Quick Reference Table

| Spec | Description | Lines |
|------|-------------|-------|
| [constants.md](constants.md) | All magic numbers with rationale (speeds, damage, timing) | ~650 |
| [arena.md](arena.md) | 1920x1080 world, boundaries, spawn points, collision | ~450 |
| [player.md](player.md) | 100 HP, 5s regen delay, 3s respawn, 2s invuln | ~550 |
| [movement.md](movement.md) | 200/300 px/s walk/sprint, 50/1500 px/s² accel/decel | ~620 |
| [messages.md](messages.md) | 6 client→server, 22 server→client message types | ~1100 |
| [networking.md](networking.md) | WebSocket lifecycle, reconnect, graceful shutdown | ~980 |
| [rooms.md](rooms.md) | 2-8 players, auto-matchmaking, broadcast patterns | ~420 |
| [weapons.md](weapons.md) | Pistol, Uzi, AK47, Shotgun, Bat, Katana stats | ~750 |
| [shooting.md](shooting.md) | Fire rate, ammo, reload, recoil, spread | ~650 |
| [hit-detection.md](hit-detection.md) | AABB collision, damage, death, expiration | ~550 |
| [melee.md](melee.md) | Range + arc detection, knockback, multi-hit | ~580 |
| [dodge-roll.md](dodge-roll.md) | 400ms roll, 200ms i-frames, 3s cooldown | ~720 |
| [match.md](match.md) | 20 kills or 7 minutes, WAITING→ACTIVE→ENDED | ~750 |
| [client-architecture.md](client-architecture.md) | Phaser scenes, managers, prediction, interpolation | ~850 |
| [server-architecture.md](server-architecture.md) | Dual-loop engine, lag compensation, delta compression | ~1200 |
| [graphics.md](graphics.md) | Procedural stick figures, weapons, effects, death visuals | ~800 |
| [ui.md](ui.md) | HUD elements, kill feed, scoreboard, match end screen | ~1250 |
| [audio.md](audio.md) | Positional audio, weapon sounds, UI feedback | ~500 |
| [overview.md](overview.md) | Architecture philosophy, prediction/reconciliation patterns | ~300 |
| [test-index.md](test-index.md) | Cross-reference of all test scenarios across specs | ~400 |

---

## Implementation Checklist

Use this checklist when implementing Stick Rumble from scratch:

### Server Setup

- [ ] Go project structure with `cmd/server/` and `internal/`
- [ ] WebSocket endpoint at `/ws` with HTTP upgrade
- [ ] 60 Hz game tick loop
- [ ] 20 Hz client broadcast loop
- [ ] Room manager with auto-matchmaking
- [ ] Graceful shutdown on SIGTERM/SIGINT

### Client Setup

- [ ] Vite + React + TypeScript project
- [ ] Phaser 3 game with single scene
- [ ] WebSocket client with reconnect logic
- [ ] Input manager for WASD + mouse

### Core Gameplay

- [ ] Player state (position, velocity, health, weapon)
- [ ] Movement physics (acceleration, sprint, boundary clamping)
- [ ] Health system (damage, death, respawn, regeneration)
- [ ] Invulnerability (spawn protection, dodge roll i-frames)

### Combat

- [ ] Weapon configuration loading from JSON
- [ ] Ranged attack (projectile creation, lifetime, expiration)
- [ ] Ammo and reload system
- [ ] Recoil and spread mechanics
- [ ] Melee attack (range + arc detection)
- [ ] Knockback (Bat only)
- [ ] AABB collision detection
- [ ] Damage application and kill tracking

### Advanced Features

- [ ] Dodge roll (direction, velocity, cooldown)
- [ ] Weapon crate spawning and pickup
- [ ] Match timer (1 Hz broadcast)
- [ ] Win condition detection (kills or time)
- [ ] Match end with final scores

### Client Rendering

- [ ] Procedural stick figure (head, body, limbs)
- [ ] Walk animation (leg oscillation)
- [ ] Weapon rendering (attached to player)
- [ ] Projectile with tracer effect
- [ ] Muzzle flash on shoot
- [ ] Hit particle effects
- [ ] Weapon crate rendering
- [ ] Health bar (above player)
- [ ] HUD (ammo, timer, kills, death)
- [ ] Kill feed (top right)
- [ ] Match end screen

### Testing

- [ ] Unit tests for physics calculations
- [ ] Unit tests for collision detection
- [ ] Unit tests for weapon mechanics
- [ ] Unit tests for match state machine
- [ ] Integration tests for WebSocket flow
- [ ] Visual regression tests for rendering

---

## Why This Architecture?

### Server-Authoritative Design

**Why?** Browser games are trivially cheatable. If the client determines hit detection, players can modify JavaScript to always hit. The server must validate all game actions.

**Trade-off:** Adds latency to player actions. Mitigated with client-side prediction.

### Client-Side Prediction

**Why?** Without prediction, controls feel sluggish (50-100ms round-trip). The client predicts movement locally, then reconciles with server state.

**Trade-off:** Occasional visual "rubber-banding" when prediction mismatches server.

### WebSocket over HTTP Polling

**Why?** Real-time games need sub-100ms latency. WebSocket provides full-duplex communication without HTTP overhead.

**Trade-off:** More complex connection management, requires reconnection logic.

### Procedural Graphics

**Why?** Stick figures are simple to render procedurally, eliminating asset loading complexity. Enables instant iteration on visual style.

**Trade-off:** Less visual polish than sprite-based graphics.

### TypeBox Shared Schemas

**Why?** Client (TypeScript) and server (Go) must agree on message formats. TypeBox schemas generate both TypeScript types and JSON Schema for Go validation.

**Trade-off:** Additional build step to generate schemas.

---

## Getting Started

1. **Read [constants.md](constants.md)** to understand all game values
2. **Read [arena.md](arena.md)** to understand the game world
3. **Read [player.md](player.md)** and [movement.md](movement.md)** for player mechanics
4. **Read [messages.md](messages.md)** to understand the communication protocol
5. **Continue through the Reading Order** above

When implementing, cross-reference specs frequently. Each spec includes:
- Data structures with TypeScript and Go examples
- Behavior algorithms with pseudocode
- Error handling for edge cases
- Test scenarios with inputs and expected outputs
- The **WHY** behind each design decision

---

## Spec Conventions

### Required Sections

Every spec follows this structure:

```markdown
# {System Name}

> **Spec Version**: 1.0.0
> **Depends On**: [list of dependencies]
> **Depended By**: [list of dependents]

## Overview
## Dependencies
## Constants
## Data Structures
## Behavior
## Error Handling
## Implementation Notes
## Test Scenarios
## Changelog
```

### Cross-References

When referencing other specs:
```markdown
See [Player > Health System](player.md#health-system) for details.
```

### Test Scenario IDs

Test scenarios use the format `TS-{SPEC}-{NUMBER}`:
- `TS-ARENA-001` - Arena boundary test
- `TS-PLAYER-003` - Player respawn test
- `TS-HIT-007` - Hit detection test

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.1 | 2026-02-02 | Added audio.md spec (19 specs complete) |
| 1.0.0 | 2026-02-02 | Initial specification suite with 14 complete specs |
| 1.1.4 | 2026-02-16 | Removed (TODO) markers from complete specs: server-architecture.md, test-index.md |
| 1.1.3 | 2026-02-16 | Added graphics.md, ui.md, audio.md to Key Dependencies table |
| 1.1.2 | 2026-02-16 | Added ui.md to Quick Reference Table |
| 1.1.1 | 2026-02-16 | Fixed message count in Reading Order (28 total, not 26) |
| 1.1.0 | 2026-02-15 | Updated Quick Reference Table: added server-architecture, graphics, audio, overview, test-index specs. Updated movement.md line counts (deceleration change). Updated messages.md counts (6 client→server, 22 server→client). |
