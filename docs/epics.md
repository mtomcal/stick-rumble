# Stick Rumble - Epic Breakdown

**NOTICE: This file has been split into individual epic documents for better maintainability and agent context efficiency.**

## New Location

All epic documentation has been moved to the `docs/epics/` directory:

- **[Epic Index (README)](./epics/README.md)** - Overview, status summary, and quick links
- **[Epic 1: Foundation](./epics/epic-1-foundation.md)** - Project setup and infrastructure
- **[Epic 2: Core Combat](./epics/epic-2-core-combat.md)** - Multiplayer combat mechanics
- **[Epic 3: Weapon Systems](./epics/epic-3-weapon-systems.md)** - Weapons and game feel
- **[Epic 4: Netcode](./epics/epic-4-netcode.md)** - Client prediction and lag compensation
- **[Epic 5: Matchmaking](./epics/epic-5-matchmaking.md)** - Queues and lobbies
- **[Epic 6: Progression](./epics/epic-6-progression.md)** - OAuth, XP, stats, cosmetics
- **[Epic 7: Maps](./epics/epic-7-maps.md)** - Arena environments
- **[Epic 8: Mobile](./epics/epic-8-mobile.md)** - Cross-platform touch support
- **[Epic 9: Polish](./epics/epic-9-polish.md)** - Effects, audio, deployment
- **[FR Coverage Matrix](./epics/fr-coverage-matrix.md)** - Requirement traceability

## Why Split?

The original epics.md file was ~31K tokens and exceeded agent context limits. Individual epic files are ~2-4K tokens each, allowing agents to read only the relevant epic without wasting context on unrelated content.

## Migration Date

2026-01-12 (stick-rumble-350)
