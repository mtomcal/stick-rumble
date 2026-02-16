# Types and Events

> **Spec Version**: 1.0.0
> **Last Updated**: 2026-02-15
> **Source File**: `types.ts` (45 lines), `game/EventBus.ts` (4 lines)
> **Depends On**: [overview.md](overview.md)
> **Depended By**: [config.md](config.md), [stick-figure.md](stick-figure.md), [main-scene.md](main-scene.md), [combat.md](combat.md), [ui.md](ui.md), [input.md](input.md), [gemini-service.md](gemini-service.md)

---

## Overview

`types.ts` is the shared type definition file for the entire prototype. It exports three interfaces (`GameStats`, `ChatMessage`, `VirtualJoystickData`), one enum (`WeaponType`), and one constant object (`EVENTS`). These types are the contract between the React UI layer and the Phaser game loop -- both sides import from this single file.

`EventBus.ts` is a 4-line file that creates a singleton `Phaser.Events.EventEmitter` instance. It is the only runtime communication bridge between React and Phaser. The event names used with the EventBus are defined in the `EVENTS` constant.

---

## Data Structures

### GameStats

HUD state emitted from Phaser to React every frame via the `EVENTS.PLAYER_UPDATE` event. React uses this to render the health bar, ammo counter, score display, and wave indicator.

**Source**: `types.ts:1-10`

```typescript
export interface GameStats {
  health: number;      // Current HP (0-100)
  ammo: number;        // Current magazine ammo count
  maxAmmo: number;     // Magazine capacity (0 for melee weapons)
  isReloading: boolean; // True while reload timer is active
  score: number;       // Cumulative score (100 per kill)
  kills: number;       // Total enemy kills
  isGameOver: boolean; // True when player health reaches 0
  wave: number;        // Current wave number (starts at 1)
}
```

**Default values** (as initialized in `App.tsx:15-24`):

| Field | Default |
|-------|---------|
| `health` | `100` |
| `ammo` | `0` |
| `maxAmmo` | `0` |
| `isReloading` | `false` |
| `score` | `0` |
| `kills` | `0` |
| `isGameOver` | `false` |
| `wave` | `1` |

**Consumers**:
- **App.tsx** -- Receives via `EventBus.on(EVENTS.PLAYER_UPDATE)`, stores in React state, renders in HUD
- **MainScene.ts** -- Emits via `EventBus.emit(EVENTS.PLAYER_UPDATE, this.stats)` at end of `update()` and after significant state changes (damage, kills, game over)

**Note**: The `overview.md` spec lists additional fields (`maxHealth`, `currentWeapon`) in its GameStats description. These fields do not exist in the actual `types.ts` source. The `health` field is used directly as a percentage (0-100), and the weapon name is not part of the stats interface.

---

### ChatMessage

Represents a single message in the chat overlay. Messages come from two sources: system announcements (game events) and bot taunts (Gemini API responses).

**Source**: `types.ts:12-19`

```typescript
export interface ChatMessage {
  id: string;          // Unique ID (Date.now() + Math.random())
  sender: string;      // Bot name or "SYSTEM"
  text: string;        // Message content
  isSystem?: boolean;  // True for system announcements (yellow styling)
  isPlayer?: boolean;  // Defined but never used in the codebase
  timestamp: number;   // Unix milliseconds when message was created
}
```

**Consumers**:
- **App.tsx** -- Creates messages via `addChatMessage()` and `addSystemMessage()` helpers, passes array to `ChatBox`
- **ChatBox.tsx** -- Receives `messages` prop, renders last 5 messages with conditional styling

**Note**: The `isPlayer` field is defined as optional but never set or read anywhere in the codebase. It appears to be a placeholder that was never implemented.

---

### VirtualJoystickData

Payload for mobile virtual joystick input. Emitted from React (Joystick component) to Phaser (MainScene) via the EventBus.

**Source**: `types.ts:21-25`

```typescript
export interface VirtualJoystickData {
  x: number;      // Horizontal axis, -1 (left) to 1 (right)
  y: number;      // Vertical axis, -1 (up) to 1 (down)
  active: boolean; // True while finger/mouse is touching the joystick
}
```

**Note**: The `Joystick.tsx` component does not import `VirtualJoystickData` directly. Its `onMove` callback uses an inline type `{ x: number; y: number; active: boolean }` that matches the interface structurally. The `App.tsx` file also uses the inline type in its joystick handler functions rather than referencing `VirtualJoystickData`. The interface exists in `types.ts` but is never imported by name anywhere in the codebase.

---

### WeaponType

Enum defining all weapon types in the game. Used as keys for the `WEAPON_STATS` lookup table in MainScene and as identifiers on StickFigure entities.

**Source**: `types.ts:27-33`

```typescript
export enum WeaponType {
  BAT = 'BAT',
  KATANA = 'KATANA',
  UZI = 'UZI',
  AK47 = 'AK47',
  SHOTGUN = 'SHOTGUN'
}
```

**Consumers**:
- **MainScene.ts** -- `WEAPON_STATS` object uses `WeaponType` enum values as keys; weapon pickups, bot weapon assignment, and combat logic all reference the enum
- **StickFigure.ts** -- Each entity has a `weaponType` property; rendering adjusts based on weapon (e.g., arm positions, swing arcs)
- **TextureGenerator.ts** -- Generates weapon pickup textures keyed by `WeaponType`

**Weapon categories**:

| Weapon | Category | Notes |
|--------|----------|-------|
| `BAT` | Melee | Default starting weapon |
| `KATANA` | Melee | Higher damage, longer range |
| `UZI` | Ranged | Fast fire rate, high spread |
| `AK47` | Ranged | Medium fire rate, low spread |
| `SHOTGUN` | Ranged | Slow fire rate, multiple pellets |

See [combat.md](combat.md) for detailed weapon stats.

---

## EVENTS Constant

A frozen-shape constant object mapping semantic event names to string literals. Used with the `EventBus` for all React-Phaser communication.

**Source**: `types.ts:36-45`

```typescript
export const EVENTS = {
  PLAYER_UPDATE: 'player-update',   // Phaser → React: HUD stats refresh
  GAME_OVER: 'game-over',           // Phaser → React: player died
  BOT_KILLED: 'bot-killed',         // Phaser → React: triggers Gemini taunt (30% chance)
  PLAYER_DAMAGED: 'player-damaged', // UNUSED — defined but never emitted or listened
  ADD_CHAT: 'add-chat',             // UNUSED — defined but never emitted or listened
  INPUT_MOVE: 'input-move',         // React → Phaser: virtual joystick movement
  INPUT_AIM: 'input-aim',           // React → Phaser: virtual joystick aiming
  RESTART: 'restart',               // React → Phaser: restart game after death
};
```

### Event Flow Diagram

```
React (App.tsx)                          Phaser (MainScene.ts)
     │                                         │
     │  PLAYER_UPDATE  ◄─────────────────────  │  (every frame + on kill/damage/death)
     │  GAME_OVER      ◄─────────────────────  │  (player health ≤ 0)
     │  BOT_KILLED     ◄─────────────────────  │  (enemy destroyed)
     │                                         │
     │  INPUT_MOVE     ─────────────────────►  │  (mobile joystick touch)
     │  INPUT_AIM      ─────────────────────►  │  (mobile joystick touch)
     │  RESTART        ─────────────────────►  │  (death screen button click)
     │                                         │
```

### Event Details

#### PLAYER_UPDATE (`'player-update'`)

**Direction**: Phaser → React
**Payload**: `GameStats`
**Emitter**: `MainScene.ts:339, 387, 883, 982`
**Listener**: `App.tsx:37` -- `setStats((prev) => ({ ...prev, ...newStats }))`

Emitted at the end of every `update()` frame and after significant state changes (enemy kill at line 883, player damage at line 982). The React HUD merges the incoming stats with its current state.

#### GAME_OVER (`'game-over'`)

**Direction**: Phaser → React
**Payload**: `{ score: number, kills: number }`
**Emitter**: `MainScene.ts:987`
**Listener**: `App.tsx:41` -- Sets `gameOver` state to `true`, adds system message

Emitted once when player health drops to 0. The React layer shows the "YOU DIED" death screen overlay.

#### BOT_KILLED (`'bot-killed'`)

**Direction**: Phaser → React
**Payload**: `{ name: string }`
**Emitter**: `MainScene.ts:882`
**Listener**: `App.tsx:46` -- 30% chance to call `generateBotTaunt()`, adds chat message on success

Emitted when the player destroys an enemy. The `name` field is read from the enemy's `nameText.text` display object. React uses this to trigger a Gemini API call with 30% probability (`Math.random() > 0.7`).

#### INPUT_MOVE (`'input-move'`)

**Direction**: React → Phaser
**Payload**: `{ x: number, y: number, active: boolean }` (matches `VirtualJoystickData` shape)
**Emitter**: `App.tsx:94` via `handleMove` callback
**Listener**: `MainScene.ts:171` -- Stores in `this.virtualJoystick` for mobile movement input

Emitted continuously while the left virtual joystick is being touched. When `active` is `false`, the joystick has been released.

#### INPUT_AIM (`'input-aim'`)

**Direction**: React → Phaser
**Payload**: `{ x: number, y: number, active: boolean }` (matches `VirtualJoystickData` shape)
**Emitter**: `App.tsx:98` via `handleAim` callback
**Listener**: `MainScene.ts:172` -- Stores in `this.virtualAimJoystick` for mobile aiming

Emitted continuously while the right virtual joystick is being touched. MainScene converts the x/y values to an aim angle.

#### RESTART (`'restart'`)

**Direction**: React → Phaser
**Payload**: None
**Emitter**: `App.tsx:86` via `restartGame` callback
**Listener**: `MainScene.ts:173` -- Calls `this.scene.restart()` to reset the Phaser scene

Emitted when the player clicks the "TRY AGAIN" button on the death screen.

#### PLAYER_DAMAGED (`'player-damaged'`) -- UNUSED

Defined in `EVENTS` but never emitted or listened to anywhere in the codebase. Likely a placeholder for a feature that was never implemented (e.g., directional damage indicators, screen shake on hit).

#### ADD_CHAT (`'add-chat'`) -- UNUSED

Defined in `EVENTS` but never emitted or listened to anywhere in the codebase. Chat messages are added directly through React state management (`addChatMessage` and `addSystemMessage` in `App.tsx`) rather than through the EventBus.

---

## EventBus

The singleton event emitter that bridges React and Phaser at runtime.

**Source**: `game/EventBus.ts:1-4`

```typescript
import Phaser from 'phaser';

// A singleton event bus to bridge React UI and Phaser Game Scene
export const EventBus = new Phaser.Events.EventEmitter();
```

This is a plain `Phaser.Events.EventEmitter` instance (which extends Node.js-style `EventEmitter`). It supports:
- `on(event, callback)` -- Register listener
- `off(event, callback)` -- Remove specific listener
- `emit(event, ...args)` -- Fire event with arguments
- `removeAllListeners()` -- Clear all listeners

**Lifecycle**: Created once at module load. Listeners are added during `MainScene.create()` and `App.tsx`'s `useEffect`. All listeners are removed via `EventBus.removeAllListeners()` in `App.tsx`'s cleanup function and individual `EventBus.off()` calls in `MainScene`'s shutdown handler.

---

## Import Graph

```
types.ts
  ├── App.tsx ────────── imports: EVENTS, GameStats, ChatMessage
  ├── ChatBox.tsx ────── imports: ChatMessage
  ├── MainScene.ts ───── imports: EVENTS, WeaponType
  ├── StickFigure.ts ─── imports: WeaponType
  └── TextureGenerator.ts imports: WeaponType

game/EventBus.ts
  ├── App.tsx ────────── imports: EventBus
  └── MainScene.ts ───── imports: EventBus
```

**Not imported anywhere**: `VirtualJoystickData` -- the interface exists but is never referenced by name. Components use structurally equivalent inline types.

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-02-15 | Initial specification |
