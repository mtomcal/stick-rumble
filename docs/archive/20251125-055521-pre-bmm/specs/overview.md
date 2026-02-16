# Overview

> **Spec Version**: 1.0.0
> **Last Updated**: 2026-02-15
> **Depends On**: None (root spec)
> **Depended By**: [types-and-events.md](types-and-events.md), [config.md](config.md), [stick-figure.md](stick-figure.md), [main-scene.md](main-scene.md)

---

## Overview

Stick Rumble (pre-BMM) is a single-player, client-only stick figure arena shooter. The player controls a stick figure in a 1600x1600 pixel top-down office arena, fighting waves of AI-controlled bots using melee and ranged weapons. Everything runs in the browser with zero server infrastructure. Phaser 3 handles the game loop and rendering, React provides the HUD overlay, and a Gemini 2.5 Flash API integration generates procedural bot trash-talk.

This prototype predates the server-authoritative multiplayer rewrite. There is no WebSocket protocol, no server game loop, and no networked state synchronization. The client is the single source of truth for all game state.

---

## Technology Stack

| Technology | Version | Role |
|------------|---------|------|
| Phaser 3 | ^3.90.0 | Game engine: Arcade physics, rendering, input, scene management |
| React | ^19.2.0 | UI overlay: HUD, menus, chat box |
| TypeScript | ~5.8.2 | Type-safe development across all source files |
| Vite | ^6.2.0 | Dev server (port 3000) and production bundler |
| Tailwind CSS | CDN | Utility-first CSS for React components |
| Lucide React | ^0.554.0 | Icon components (crosshair, shield, etc.) |
| @google/genai | ^1.30.0 | Gemini 2.5 Flash API for procedural bot dialogue |

All runtime dependencies are loaded via **CDN import maps** in `index.html` -- there is no bundled `node_modules` at runtime. Only dev dependencies (`@vitejs/plugin-react`, `typescript`, `vite`) are installed locally.

---

## Architecture

### Dual-Framework Pattern

The application uses two frameworks side by side:

1. **Phaser 3** -- Owns the game canvas, physics simulation, rendering, and input polling. Runs a single scene (`MainScene`) at 120 FPS physics / 60 FPS render.
2. **React** -- Owns the HTML overlay above the canvas. Renders HUD elements (health bar, ammo counter, score, chat), start/death screens, and mobile joystick controls.

The two frameworks communicate through an **EventBus** -- a singleton `Phaser.Events.EventEmitter` instance imported by both sides.

```
React (App.tsx)                    Phaser (MainScene.ts)
  ├── State: health, ammo,          ├── StickFigure (player + bots)
  │   score, kills, wave,           ├── LevelGenerator (walls, floor)
  │   isGameOver, chat msgs         ├── Pathfinder (A* for AI)
  ├── Joystick (x2, mobile)         ├── TextureGenerator (sprites)
  ├── ChatBox                       ├── Arcade Physics (120 FPS)
  └── geminiService                 └── Collision groups
         │                                    │
         └──────── EventBus ──────────────────┘
                (Phaser EventEmitter)
```

### Data Flow

```
1. Input Phase
   Desktop: WASD keys → MainScene.keys (Phaser cursors)
            Mouse position → MainScene pointer tracking
   Mobile:  Touch → Joystick component → EventBus 'joystick-move'
            → MainScene.virtualJoystick state

2. Update Phase (per frame, 120 FPS physics)
   MainScene.update():
     a. Read input (keys or virtual joystick)
     b. Calculate player velocity (250 px/s, diagonal normalized)
     c. Set player physics body velocity
     d. Update player aim angle (mouse or right joystick)
     e. Process AI for each enemy (pathfinding, LOS, attack decisions)
     f. Apply health regeneration if eligible
     g. Update UI elements (minimap, tracers, damage numbers)
     h. Emit stats to React via EventBus

3. Collision Phase (Phaser Arcade automatic)
   Player bullets → Enemies       → damage + kill tracking
   Enemy bullets  → Player        → damage + game over check
   Bullets        → Walls         → bullet destruction
   Player         → Enemies       → push-back overlap
   Player         → Weapon pickups → weapon switch

4. React Render Phase
   EventBus 'game-stats' → App.tsx setState → React re-render
   EventBus 'game-over'  → Show death screen
   EventBus 'enemy-killed' → Maybe trigger Gemini taunt (30% chance)
```

---

## Physics Configuration

The Phaser Arcade physics engine is configured in `game/phaserGame.ts`:

| Setting | Value | Rationale |
|---------|-------|-----------|
| World bounds | 1600 x 1600 px | Square arena, larger than viewport |
| Physics FPS | 120 | Doubled from standard 60 to prevent bullet tunneling through thin targets |
| Gravity | 0 (top-down) | No vertical gravity; movement is 2D planar |
| Debug rendering | `false` | Physics bodies not drawn in production |

The doubled physics rate is a deliberate choice: at 60 FPS, fast bullets can skip over narrow collision bodies between frames. At 120 FPS the per-frame displacement halves, making tunneling much less likely.

---

## Scene Architecture

The game uses a **single Phaser scene** (`MainScene`). There are no menu scenes, loading scenes, or pause scenes. The React layer handles all non-gameplay UI (start screen, death screen).

### MainScene Responsibilities

`MainScene` (~990 lines) is the monolithic game loop. It handles:

| Responsibility | Approximate Lines | Key Methods |
|---------------|-------------------|-------------|
| Weapon stats definitions | 30 | `WEAPON_STATS` object literal |
| Scene creation (physics groups, collisions, level, textures) | 150 | `create()` |
| Player movement and aiming | 60 | `update()` body |
| Enemy AI (spawning, pathfinding, targeting, attacking) | 250 | `update()`, `spawnEnemy()`, AI logic block |
| Combat (melee, ranged, damage, death) | 200 | Collision callbacks, `fireBullet()` |
| Visual effects (minimap, tracers, damage numbers, blood) | 150 | Various draw/update methods |
| Input handling (keyboard, mouse, virtual joystick) | 50 | `update()` input section |
| UI updates (EventBus emission, debug text) | 50 | End of `update()` |
| Collision setup and callbacks | 100 | `create()` overlap/collider calls |

### No State Machine

The game loop has no explicit state machine. Game-over is detected by checking `player.hp <= 0` after damage, which triggers an EventBus emission. The React layer then shows the death screen overlay. Restarting the game calls `scene.restart()`.

---

## Entity Model

### Player

A `StickFigure` instance stored as `this.player` in MainScene. The player has:
- Physics body: 15px radius circle
- Health: 100 HP, regenerates at ~40 HP/s after 3 seconds of no damage
- Weapons: starts with BAT, can pick up ranged weapons from the arena
- Movement: 250 px/s base speed

### AI Bots (Enemies)

Also `StickFigure` instances, stored in a Phaser physics group `this.enemies`. Bots:
- Spawn at 1.5-second intervals
- Maximum count: 3 + floor(wave / 2)
- Each bot gets a random weapon and a random name
- Use A* pathfinding on a 50px grid
- Check line-of-sight to player (throttled to every 200ms)
- Attack when in range (melee: 80px, ranged: 400px)

### Weapons

Five weapon types defined in a `WEAPON_STATS` object:

| Weapon | Type | Damage | Cooldown | Clip | Reload | Special |
|--------|------|--------|----------|------|--------|---------|
| BAT | Melee | 30 | 400ms | -- | -- | 80px range, 90deg arc |
| KATANA | Melee | 45 | 500ms | -- | -- | 100px range, 60deg arc |
| UZI | Ranged | 8 | 100ms | 30 | 1500ms | 0.3 spread |
| AK47 | Ranged | 20 | 150ms | 30 | 2000ms | 0.05 spread |
| SHOTGUN | Ranged | 12 | 800ms | 6 | 2500ms | 0.6 spread, 5 pellets |

Weapon pickups spawn at fixed positions in the arena. Picking up a weapon replaces the current one and resets ammo.

---

## AI System

Bot AI runs every frame in MainScene's `update()` method. Each enemy:

1. **Target selection**: Always targets the player (single-player, no team logic).
2. **Pathfinding**: Requests an A* path every 500ms. The pathfinder uses a 50px grid built from the level's wall geometry.
3. **Line-of-sight**: Raycasts from bot to player, checking wall intersections. Throttled to 200ms intervals. If LOS exists, the bot can aim and shoot directly.
4. **Movement**: Follows A* path waypoints if no LOS; moves directly toward player if LOS is clear.
5. **Attack**: Melee bots swing when within range (80-100px). Ranged bots fire with +/- 0.4 radians inaccuracy.

The pathfinder (`Pathfinder.ts`) implements A* with Manhattan distance heuristic, a 500-step limit, and fallback logic when the target tile is inside a wall (searches a radius-2 neighborhood for the nearest open tile).

---

## Level Layout

`LevelGenerator.ts` creates the office arena:

- **Floor**: 100px grid overlay (light blue lines on dark background)
- **Boundary walls**: 120px thick walls around the 1600x1600 perimeter
- **Interior walls**: Vertical walls at x=500 and x=1100; horizontal walls at y=600 and y=1000 (with gaps for passages)
- **Furniture**: Desk obstacles scattered through the arena
- All walls are Phaser static physics bodies in a single group

---

## Rendering Approach

All graphics are **procedural** -- there are no image/sprite assets:

| Element | Technique |
|---------|-----------|
| Stick figures | `Phaser.GameObjects.Graphics` -- lines for limbs, circles for head/hands |
| Bullets | Generated textures via `TextureGenerator` -- small colored circles/bars |
| Weapon pickups | Generated textures -- colored rectangles per weapon type |
| Reticle | Generated texture -- crosshair circle with center dot |
| Minimap | Graphics overlay drawn each frame at 0.075 scale |
| Tracers | Graphics lines per shot, cleared after short lifetime |
| Damage numbers | `Phaser.GameObjects.Text` with tween animation |
| Blood/heal particles | Graphics circles with velocity and fade |
| Hit indicators | Generated texture -- directional chevrons |

The `TextureGenerator` runs once during `MainScene.create()` to generate all reusable textures into the Phaser texture cache.

---

## React-Phaser Communication

The **EventBus** (`game/EventBus.ts`) is a `Phaser.Events.EventEmitter` singleton:

```typescript
import { Events } from 'phaser';
export const EventBus = new Events.EventEmitter();
```

### Events Emitted (Phaser → React)

| Event | Payload | Trigger |
|-------|---------|---------|
| `game-stats` | `GameStats` object | Every frame, from MainScene.update() |
| `game-over` | `{ kills, wave }` | Player health reaches 0 |
| `current-scene-ready` | `MainScene` instance | Scene create() completes |
| `enemy-killed` | `{ name, weapon }` | Enemy destroyed by player |
| `chat-message` | `ChatMessage` | Gemini API response received |

### Events Listened (React → Phaser)

| Event | Payload | Handler |
|-------|---------|---------|
| `joystick-move` | `VirtualJoystickData` | MainScene stores for mobile input |
| `joystick-aim` | `VirtualJoystickData` | MainScene stores for mobile aiming |

### Shared Types

Both frameworks import from `types.ts`:

```typescript
interface GameStats {
  health: number;
  maxHealth: number;
  ammo: number;
  maxAmmo: number;
  isReloading: boolean;
  score: number;
  kills: number;
  wave: number;
  isGameOver: boolean;
  currentWeapon: string;
}

interface ChatMessage {
  sender: string;
  text: string;
  isSystem: boolean;
}

interface VirtualJoystickData {
  x: number;   // -1 to 1
  y: number;   // -1 to 1
  active: boolean;
}

enum WeaponType { BAT, KATANA, UZI, AK47, SHOTGUN }
```

---

## Gemini API Integration

`services/geminiService.ts` wraps the `@google/genai` SDK:

- **Model**: `gemini-2.5-flash`
- **API key**: Read from `import.meta.env.VITE_GEMINI_API_KEY` (configured in Vite)
- **Two functions**:
  - `generateBotTaunt(botName, weaponUsed)` -- Max 10 words, temperature 1.2, 30 token limit
  - `generateAnnouncerText(waveNumber, enemiesLeft)` -- Max 5 words for wave announcements
- **Error handling**: Both functions return hardcoded fallback strings on API failure
- **Rate limiting**: App.tsx triggers taunts with only 30% probability on each bot kill to avoid API spam

---

## Wave System

The game uses a simple wave counter:

1. Enemies spawn continuously (1.5s interval)
2. Maximum enemy count = 3 + floor(wave / 2)
3. When all current enemies are killed, `wave` increments
4. Higher waves allow more concurrent enemies
5. There is no explicit wave transition screen -- the counter increments silently

The wave number is displayed in the React HUD and emitted via `game-stats`.

---

## Collision Groups

MainScene sets up these Phaser Arcade collision relationships in `create()`:

| Collider/Overlap | Group A | Group B | Result |
|-----------------|---------|---------|--------|
| Overlap | Player bullets | Enemies | Damage enemy, destroy bullet |
| Overlap | Enemy bullets | Player | Damage player, destroy bullet |
| Collider | All bullets | Walls | Destroy bullet |
| Overlap | Player | Enemies | Push-back (no damage) |
| Collider | Enemies | Enemies | Prevent stacking |
| Overlap | Player | Weapon pickups | Switch weapon |

---

## Camera

The Phaser camera follows the player with:
- `startFollow(player)` -- smooth tracking
- World bounds set to 1600x1600 -- camera stops at arena edges
- Viewport is the browser window size (responsive via Phaser `Scale.RESIZE`)

---

## Debug Overlay

MainScene draws debug text (top-left corner) showing:
- FPS
- Update loop time (ms)
- AI processing time (ms)
- Entity counts (enemies, bullets)

This runs in all builds -- there is no debug toggle.

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| 120 FPS physics | Prevents bullet tunneling through thin collision bodies |
| CDN import maps | Zero build step for runtime deps; faster iteration |
| Single scene | Prototype simplicity; no need for scene transitions |
| Procedural graphics | No asset pipeline; everything drawn in code |
| EventBus bridge | Decouples React UI from Phaser internals |
| 30% taunt chance | Avoids Gemini API rate limits while keeping chat lively |
| 50px pathfinding grid | Balances navigation accuracy with A* performance on 1600x1600 map |
| No state machine | Prototype scope; game-over handled by simple health check |

---

## File Dependency Graph

```
types.ts ─────────────────────────┐
    │                             │
    ▼                             ▼
App.tsx ◄──EventBus──► MainScene.ts
    │                    │  │  │  │
    │                    │  │  │  └─► TextureGenerator.ts
    │                    │  │  └────► LevelGenerator.ts
    │                    │  └───────► Pathfinder.ts
    │                    └──────────► StickFigure.ts
    │
    ├──► ChatBox.tsx
    ├──► Joystick.tsx
    └──► geminiService.ts

phaserGame.ts ──► MainScene (scene config)
index.tsx ──► App.tsx
index.html ──► CDN imports + #root mount
```

All arrows represent import/usage relationships. The EventBus is the only runtime bridge between the React and Phaser dependency trees.

---

## Limitations and Known Constraints

| Constraint | Impact |
|-----------|--------|
| No server | All state is client-side; no persistence, no anti-cheat |
| No multiplayer | Single human player only; bots are AI-controlled |
| Monolithic MainScene | ~990 lines in one file; hard to test in isolation |
| No asset loading | Procedural graphics limit visual fidelity |
| No pause | No pause menu or scene; game runs continuously |
| No save state | Closing the tab loses all progress |
| Gemini API dependency | Chat feature requires API key and network access |
| No audio | The prototype has no sound effects or music |

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-02-15 | Initial specification |
