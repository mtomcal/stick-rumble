# Pre-BMM Prototype Specification Index

> **Spec Suite Version**: 1.0.0
> **Archive Snapshot**: 2025-11-25 05:55:21
> **Last Updated**: 2026-02-15

---

## Project Summary

Stick Rumble (pre-BMM) is a single-player, client-only stick figure arena shooter built with Phaser 3 and React. The player fights waves of AI bots in a 1600x1600 office arena using melee and ranged weapons. There is no server, no multiplayer, and no network code. All game state runs in the browser. AI bots use A* pathfinding, line-of-sight checks, and the same combat system as the player. A Gemini 2.5 Flash API integration provides procedural bot trash-talk in a chat overlay.

This archive predates the server-authoritative multiplayer rewrite (BMM — "Big Multiplayer Migration"). These specs document the prototype **as it existed** in the November 2025 snapshot.

---

## Technology Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| Phaser 3 | ^3.90.0 | Game engine (Arcade physics, rendering, input) |
| React | ^19.2.0 | UI overlay (HUD, menus, chat) |
| TypeScript | ~5.8.2 | Type-safe development |
| Vite | ^6.2.0 | Build tool and dev server |
| Tailwind CSS | CDN | Utility-first CSS for React UI |
| Lucide React | ^0.554.0 | Icon components for HUD |
| @google/genai | ^1.30.0 | Gemini 2.5 Flash API for bot taunts |

All dependencies are loaded via CDN import maps in `index.html` — there is no bundled `node_modules` runtime. Dev dependencies (`@vitejs/plugin-react`, `typescript`, `vite`) are used only at build time.

---

## Architecture Overview

```
React (App.tsx) ←EventBus→ Phaser (MainScene.ts)
  ├── Joystick (×2, mobile)      ├── StickFigure (player + AI bots)
  ├── ChatBox                    ├── LevelGenerator (walls, floor grid)
  └── geminiService              ├── Pathfinder (A* for AI navigation)
                                 ├── TextureGenerator (procedural sprites)
                                 └── Arcade Physics (120 FPS, top-down)
```

**Key architectural traits:**
- **No server** — all game logic is client-side
- **No multiplayer** — single human player vs AI bots
- **No networking** — no WebSocket, no message protocol
- **EventBus bridge** — Phaser `EventEmitter` singleton connects React UI to Phaser game loop
- **Procedural graphics** — all sprites, bullets, and effects are drawn via `Graphics` objects, no image assets
- **Physics at 120 FPS** — doubled from standard 60 to prevent bullet tunneling through thin targets

---

## Source File Inventory

| # | File | Lines | Purpose |
|---|------|-------|---------|
| 1 | `App.tsx` | 193 | React root: game lifecycle, HUD, EventBus wiring, Gemini integration |
| 2 | `index.tsx` | ~10 | React DOM entry point |
| 3 | `index.html` | 40 | Bootstrap HTML, CDN import maps (Phaser, React, Tailwind, Gemini SDK) |
| 4 | `types.ts` | 44 | Shared types: `GameStats`, `ChatMessage`, `WeaponType` enum, `EVENTS` |
| 5 | `package.json` | 24 | Dependencies and scripts |
| 6 | `vite.config.ts` | ~23 | Dev server config, env vars |
| 7 | `tsconfig.json` | ~28 | TypeScript config |
| 8 | `components/ChatBox.tsx` | ~35 | Chat message display (last 5 messages) |
| 9 | `components/Joystick.tsx` | ~193 | Virtual joystick for mobile (touch + mouse) |
| 10 | `services/geminiService.ts` | ~50 | Gemini 2.5 Flash API for bot trash-talk |
| 11 | `game/phaserGame.ts` | 25 | Phaser game factory (config, physics, scene) |
| 12 | `game/EventBus.ts` | 3 | Singleton event emitter bridging React and Phaser |
| 13 | `game/scenes/MainScene.ts` | ~989 | Central game loop: movement, combat, AI, rendering |
| 14 | `game/objects/StickFigure.ts` | ~465 | Player/enemy entity: rendering, animation, damage, death |
| 15 | `game/systems/Pathfinder.ts` | ~171 | A* pathfinding on 50px grid |
| 16 | `game/utils/TextureGenerator.ts` | ~77 | Procedural sprite generation (bullets, pickups, reticle) |
| 17 | `game/world/LevelGenerator.ts` | ~69 | Office arena layout with walls and desks |

---

## Reading Order

Read the specs in this order. Each spec lists its dependencies so you can also navigate by need.

1. **[overview.md](overview.md)** — High-level architecture, data flow, design patterns
2. **[types-and-events.md](types-and-events.md)** — Shared types, enums, event constants
3. **[config.md](config.md)** — Build tooling, CDN setup, Phaser game config
4. **[player.md](player.md)** — StickFigure class: rendering, animation, weapons, damage
5. **[main-scene.md](main-scene.md)** — MainScene game loop, player movement, aiming, collision setup
6. **[combat.md](combat.md)** — Melee and ranged attacks, damage, cooldowns, reload, weapon stats
7. **[graphics.md](graphics.md)** — Procedural stick figure rendering, draw methods, colors, animations
8. **[ai.md](ai.md)** — Enemy AI: spawning, target selection, pathfinding, LOS, attacks
9. **[pathfinder.md](pathfinder.md)** — A* algorithm, nav grid, wall detection, path smoothing
10. **[level-generator.md](level-generator.md)** — Office arena layout, wall placement, floor grid
11. **[texture-generator.md](texture-generator.md)** — Procedural texture creation: sprites, projectiles, pickups
12. **[rendering.md](rendering.md)** — Minimap, tracers, hit markers, damage numbers, blood particles
13. **[input.md](input.md)** — WASD + mouse (desktop), dual virtual joysticks (mobile), aim sway
14. **[ui.md](ui.md)** — React HUD, start/death screens, health bar, ammo, chat, EventBus bridge
15. **[gemini-service.md](gemini-service.md)** — Gemini API integration: bot taunts, wave announcements

---

## Dependency Graph

```
                      types-and-events.md
                       /       |       \
                      /        |        \
              config.md      player.md      overview.md
                            /        \
                           /          \
                  main-scene.md    combat.md
                /    |    \    \        |
               /     |     \    \       |
          ai.md  input.md  rendering.md  graphics.md
           |                    |
      pathfinder.md         ui.md
           |
   level-generator.md
           |
   texture-generator.md

   gemini-service.md (standalone, called from App.tsx)
```

Arrows flow downward: a spec depends on specs above it.

---

## Quick Reference Table

| Spec | One-Line Description |
|------|---------------------|
| [overview.md](overview.md) | Architecture, data flow, key design decisions |
| [types-and-events.md](types-and-events.md) | `GameStats`, `ChatMessage`, `WeaponType`, `EVENTS` constants |
| [config.md](config.md) | `package.json`, Vite config, TypeScript config, CDN import maps |
| [player.md](player.md) | `StickFigure` class: procedural stick figure, weapons, hit/death animations |
| [main-scene.md](main-scene.md) | `MainScene`: create/update loop, physics groups, camera, collision wiring |
| [combat.md](combat.md) | Weapon stats table, melee/ranged attack flow, reload, damage application |
| [graphics.md](graphics.md) | Procedural stick figure drawing, draw methods, colors, line widths, animations |
| [ai.md](ai.md) | Bot spawning, wave system, target selection, movement strategies, attack logic |
| [pathfinder.md](pathfinder.md) | A* on 50px grid, nav grid construction, wall avoidance, step limit |
| [level-generator.md](level-generator.md) | `LevelGenerator`: floor grid, office walls, desk obstacles |
| [texture-generator.md](texture-generator.md) | `generateGameTextures()`: bullet, tracer, pickup, and reticle textures |
| [rendering.md](rendering.md) | Minimap, bullet tracers, hit markers, damage indicators, blood/heal particles |
| [input.md](input.md) | Keyboard (WASD/arrows/R), mouse aim/fire, virtual joysticks, aim sway |
| [ui.md](ui.md) | React HUD: health bar, ammo, score, start screen, death screen, chat overlay |
| [gemini-service.md](gemini-service.md) | Gemini 2.5 Flash: bot taunts on death, wave announcements, error handling |

---

## Implementation Checklist

Use this checklist when recreating the prototype from specs.

- [ ] Shared types and event constants (`types.ts`)
- [ ] Build configuration (Vite, TypeScript, CDN imports)
- [ ] Phaser game factory (`phaserGame.ts`)
- [ ] EventBus singleton (`EventBus.ts`)
- [ ] Procedural texture generation (`TextureGenerator.ts`)
- [ ] Level/arena layout (`LevelGenerator.ts`)
- [ ] StickFigure entity class (`StickFigure.ts`)
- [ ] MainScene game loop skeleton (`MainScene.ts`)
- [ ] Player movement and aiming
- [ ] Combat system (melee + ranged + reload)
- [ ] A* pathfinding (`Pathfinder.ts`)
- [ ] AI bot behavior (spawning, targeting, movement, attacks)
- [ ] Rendering effects (minimap, tracers, particles, damage numbers)
- [ ] Input handling (keyboard, mouse, virtual joysticks)
- [ ] React UI (HUD, start screen, death screen, chat)
- [ ] Gemini AI integration (bot taunts)

---

## Key Differences from Current (Post-BMM) Codebase

This prototype differs fundamentally from the current multiplayer Stick Rumble:

| Aspect | Pre-BMM (this archive) | Post-BMM (current) |
|--------|----------------------|---------------------|
| Architecture | Client-only, single-player | Server-authoritative, multiplayer |
| Networking | None | WebSocket, Go server |
| Players | 1 human + AI bots | 2-8 human players |
| Physics authority | Client (Phaser Arcade) | Server (Go game loop) |
| Death behavior | Game over, restart | 3-second respawn |
| Health regen rate | ~40 HP/s after 3s | 10 HP/s after 5s |
| World size | 1600x1600 | 1920x1080 |
| Physics FPS | 120 (anti-tunneling) | 60 server tick |
| AI | A* pathfinding + LOS bots | No AI (human players only) |
| Chat | Gemini-powered bot taunts | Not implemented |

---

## Conventions Used in These Specs

- **Code is truth** — specs document what the code actually does, not what it should do
- **Source citations** — line numbers reference the archive snapshot, not the current codebase
- **Cross-references** — specs link to each other using relative markdown links: `[Spec > Section](spec.md#section)`
- **Constants inline** — values are documented where they appear in source, since there is no centralized constants file
- **No server sections** — unlike SPEC-OF-SPECS.md (designed for the multiplayer codebase), these specs have no Go/server implementation notes
- **Prototype scope** — these specs are intentionally simpler than the multiplayer spec template

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-02-15 | Initial specification index |
| 1.0.1 | 2026-02-16 | Fix stick-figure.md → player.md links, correct line counts, add missing graphics.md to reading order/reference table/dependency graph |
