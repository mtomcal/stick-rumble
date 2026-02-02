# Spec-of-Specs Implementation Plan

> **Created**: 2026-02-02
> **Purpose**: Track progress on generating specification documents from SPEC-OF-SPECS.md blueprint

---

## Implementation Status

### Phase 1: Foundation (Priority: Critical)

| Spec File | Status | Lines | Notes |
|-----------|--------|-------|-------|
| [README.md](README.md) | Pending | ~250 | Entry point with reading order and dependency graph |
| [overview.md](overview.md) | Pending | ~350 | High-level architecture and design philosophy |
| [constants.md](constants.md) | **Complete** | ~650 | Single source of truth for all magic numbers |
| [arena.md](arena.md) | **Complete** | ~450 | Game world boundaries and spatial rules |

### Phase 2: Core Entities

| Spec File | Status | Lines | Notes |
|-----------|--------|-------|-------|
| [player.md](player.md) | Pending | ~450 | Player entity state and lifecycle |
| [movement.md](movement.md) | Pending | ~400 | Physics-based movement system |

### Phase 3: Networking

| Spec File | Status | Lines | Notes |
|-----------|--------|-------|-------|
| [messages.md](messages.md) | Pending | ~700 | Complete WebSocket message catalog |
| [networking.md](networking.md) | Pending | ~425 | WebSocket protocol and connection lifecycle |
| [rooms.md](rooms.md) | Pending | ~325 | Room management and matchmaking |

### Phase 4: Combat

| Spec File | Status | Lines | Notes |
|-----------|--------|-------|-------|
| [weapons.md](weapons.md) | Pending | ~550 | Complete weapon definitions and switching |
| [shooting.md](shooting.md) | Pending | ~500 | Ranged attack mechanics |
| [hit-detection.md](hit-detection.md) | Pending | ~475 | Collision detection and damage application |
| [melee.md](melee.md) | Pending | ~375 | Melee attack mechanics |

### Phase 5: Advanced Mechanics

| Spec File | Status | Lines | Notes |
|-----------|--------|-------|-------|
| [dodge-roll.md](dodge-roll.md) | Pending | ~375 | Dodge roll evasion mechanic |
| [match.md](match.md) | Pending | ~375 | Match lifecycle and win conditions |

### Phase 6: Client Implementation

| Spec File | Status | Lines | Notes |
|-----------|--------|-------|-------|
| [client-architecture.md](client-architecture.md) | Pending | ~475 | Frontend structure and rendering pipeline |
| [graphics.md](graphics.md) | Pending | ~550 | Procedural rendering specifications |
| [ui.md](ui.md) | Pending | ~425 | HUD and interface elements |
| [audio.md](audio.md) | Pending | ~325 | Sound effects and audio system |

### Phase 7: Server Implementation

| Spec File | Status | Lines | Notes |
|-----------|--------|-------|-------|
| [server-architecture.md](server-architecture.md) | Pending | ~425 | Backend structure and game loop |

### Phase 8: Verification

| Spec File | Status | Lines | Notes |
|-----------|--------|-------|-------|
| [test-index.md](test-index.md) | Pending | ~350 | Cross-reference of all test scenarios |

---

## Progress Summary

- **Total Specs**: 21
- **Completed**: 2 (constants.md, arena.md)
- **Pending**: 19
- **Estimated Total Lines**: ~8,575

---

## Completed Work Log

### 2026-02-02: constants.md

**What was done:**
- Extracted ALL game constants from both client and server codebases
- Organized by category: Arena, Player, Movement, Dodge Roll, Network, Weapons, Match, Audio, UI
- Documented the **WHY** for each constant value
- Included TypeScript and Go code examples for each section
- Added damage balance calculations (shots-to-kill for each weapon)
- Documented weapon spawn locations with coordinates
- Added 5 test scenarios

**Sources analyzed:**
- `stick-rumble-server/internal/game/constants.go`
- `stick-rumble-server/internal/game/weapon.go`
- `stick-rumble-server/internal/game/match.go`
- `stick-rumble-server/internal/game/room.go`
- `stick-rumble-server/internal/game/weapon_crate.go`
- `stick-rumble-client/src/shared/constants.ts`
- `weapon-configs.json`

**Key findings:**
- All 6 weapons fully documented with damage, fire rate, magazine, reload, range, spread, recoil
- Weapon spawn locations are fixed at 5 positions forming a pentagon pattern
- Damage falloff formula documented (50% range = 100% damage, 100% range = 0% damage)
- Network tick rates verified: 60 Hz server, 20 Hz client updates

### 2026-02-02: arena.md

**What was done:**
- Documented complete arena coordinate system (screen-space, origin top-left)
- Detailed boundary collision handling with clamping algorithm
- Projectile out-of-bounds destruction logic
- Dodge roll wall termination behavior
- Player spawn algorithm (balanced spawning away from enemies)
- All 5 weapon crate fixed spawn positions with pentagon pattern reasoning
- Distance calculation and AABB collision formulas
- Weapon pickup proximity check (32px radius)
- Documented the **WHY** for every design decision
- Added 12 test scenarios covering all boundary cases

**Sources analyzed:**
- `stick-rumble-server/internal/game/constants.go`
- `stick-rumble-server/internal/game/physics.go` (clampToArena, boundary logic)
- `stick-rumble-server/internal/game/world.go` (getBalancedSpawnPointLocked)
- `stick-rumble-server/internal/game/projectile.go` (IsOutOfBounds)
- `stick-rumble-server/internal/game/weapon_crate.go` (spawn positions)
- `stick-rumble-client/src/game/simulation/physics.ts`
- `stick-rumble-client/src/game/scenes/GameScene.ts` (world bounds setup)
- `stick-rumble-client/src/game/entities/ProjectileManager.ts`
- `stick-rumble-client/src/game/entities/WeaponCrateManager.ts`

**Key findings:**
- Player boundaries: X ∈ [16, 1904], Y ∈ [32, 1048] (accounting for 32x64 hitbox)
- Spawn margin: 100px from all edges, valid region [100, 1820] x [100, 980]
- Balanced spawn tries 10 random candidates, picks one farthest from all enemies
- Client mirrors server physics for client-side prediction
- Dodge roll terminates early when position clamping detects wall collision

---

## Next Priority

The next most important specs to generate are **player.md** and **movement.md** because:
1. They complete the Core Entities phase (Phase 2)
2. player.md defines the entity that all other systems interact with
3. movement.md defines physics that shooting, dodge roll, and hit detection depend on
4. Both are medium complexity (~400-450 lines each)

After Core Entities, continue with **messages.md** (the largest spec at ~700 lines) to complete the Networking phase foundation.

---

## Validation Checklist

Before marking a spec as complete, verify:

- [ ] All constants referenced exist in constants.md
- [ ] TypeScript and Go code examples are syntactically correct
- [ ] Test scenarios follow the TS-{PREFIX}-{NUMBER} format
- [ ] Error handling section covers all edge cases
- [ ] Cross-references to other specs use correct markdown links
- [ ] Changelog entry added with current date
