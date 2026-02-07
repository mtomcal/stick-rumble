# Stick Rumble - Epic Index

**Author:** BMad
**Date:** 2025-11-25
**Last Updated:** 2026-01-12

---

## Overview

This directory contains the epic breakdown for Stick Rumble, a multiplayer stick figure arena shooter. Each epic is organized in its own file for focused reading and easier maintenance.

**Living Document Notice:** These epics were initially created from the [Game Design Document](../GDD.md) and include tactical implementation details. Stories include test coverage requirements and quality gates.

---

## Epic Status Summary

| Epic | Name | Status | Progress |
|------|------|--------|----------|
| [Epic 1](./epic-1-foundation.md) | Foundation & Project Setup | Complete | 4/4 stories |
| [Epic 2](./epic-2-core-combat.md) | Core Multiplayer Combat | Complete | 13/13 stories |
| [Epic 3](./epic-3-weapon-systems.md) | Weapon Systems & Game Feel | ✅ Complete | 14/14 stories |
| [Epic 4](./epic-4-netcode.md) | Responsive Networked Gameplay | In Progress | 0/6 stories |
| [Epic 5](./epic-5-matchmaking.md) | Matchmaking & Lobbies | Not Started | 0/6 stories |
| [Epic 6](./epic-6-progression.md) | Player Identity & Progression | Not Started | 0/7 stories |
| [Epic 7](./epic-7-maps.md) | Arena Environments | Not Started | 0/5 stories |
| [Epic 8](./epic-8-mobile.md) | Mobile Cross-Platform Play | Not Started | 0/5 stories |
| [Epic 9](./epic-9-polish.md) | Polish & Production Launch | Not Started | 0/7 stories |

---

## Epic Dependencies

```
Epic 1 (Foundation)
    |
    v
Epic 2 (Core Combat) -----> Epic 3 (Weapons) -----> Epic 4 (Netcode)
                                                         |
                                                         v
                                                    Epic 5 (Matchmaking)
                                                         |
                                                         v
                                                    Epic 6 (Progression)
                                                         |
                                                         v
                                                    Epic 7 (Maps)
                                                         |
                                                         v
                                                    Epic 8 (Mobile)
                                                         |
                                                         v
                                                    Epic 9 (Polish)
```

---

## Functional Requirements Coverage

All 20 functional requirements from the GDD are covered across the epics:

- **FR1-FR3**: Core gameplay (Epics 2, 5)
- **FR4-FR6**: Weapon mechanics (Epic 3)
- **FR7**: Respawn system (Epic 2)
- **FR8-FR9**: Progression & Auth (Epic 6)
- **FR10-FR11**: Game modes (Epics 2, 5)
- **FR12-FR13**: Netcode (Epics 2, 4)
- **FR14**: HUD (Epics 7, 9)
- **FR15**: Maps (Epic 7)
- **FR16**: Performance (Epics 1, 4, 8)
- **FR17**: Cross-platform (Epics 1, 8)
- **FR18-FR19**: Cosmetics & Stats (Epic 6)
- **FR20**: Matchmaking (Epic 5)

See [fr-coverage-matrix.md](./fr-coverage-matrix.md) for detailed traceability.

---

## Story Implementation Standards

All stories must meet these quality gates (established in Epic 1):

1. **Test Coverage**: Minimum 90% statement coverage
2. **TypeScript**: `tsc -b --noEmit` passes with zero errors
3. **ESLint**: Zero errors, zero warnings
4. **Go**: `go vet ./...` and `gofmt` pass cleanly
5. **Documentation**: Session logs capture implementation decisions

---

## Quick Links

- [Game Design Document](../GDD.md)
- [Weapon Balance Analysis](../weapon-balance-analysis.md)
- [Architecture Documentation](../game-architecture.md)
