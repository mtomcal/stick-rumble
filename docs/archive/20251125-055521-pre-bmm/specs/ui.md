# React UI & HUD

> **Spec Version**: 1.0.0
> **Last Updated**: 2026-02-16
> **Depends On**: [types-and-events.md](types-and-events.md), [overview.md](overview.md), [config.md](config.md), [input.md](input.md)
> **Depended By**: [README.md](README.md)

---

## Overview

The React UI layer overlays the Phaser game canvas and provides all non-game-world interface elements: start screen, death screen, HUD (health bar, ammo counter, score display), chat box, and mobile virtual joysticks. React and Phaser communicate exclusively through the `EventBus` singleton. The UI is defined entirely in `App.tsx` with two child components (`ChatBox.tsx`, `Joystick.tsx`). There is no routing, no state management library, and no server communication — all state is local React state driven by EventBus events.

---

## Dependencies

### Technology Dependencies

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 19.2.0 | UI framework (CDN import) |
| ReactDOM | 19.2.0 | DOM rendering |
| lucide-react | 0.554.0 | Icon components (Skull, Crosshair, Activity, Trophy, RefreshCw) |
| Tailwind CSS | CDN (runtime) | Utility-first styling |
| Press Start 2P | Google Fonts | Pixel-style font for titles/buttons |
| Roboto | Google Fonts | Body text font |

### Spec Dependencies

- [types-and-events.md](types-and-events.md) — `GameStats`, `ChatMessage`, `EVENTS` constants
- [overview.md](overview.md) — Architecture context (React ↔ Phaser bridge)
- [config.md](config.md) — CDN imports, HTML bootstrap, font loading
- [input.md](input.md) — Virtual joystick details (documented separately)

---

## Source Files

| File | Lines | Purpose |
|------|-------|---------|
| `App.tsx` | 194 | Root component: game lifecycle, HUD, event wiring |
| `components/ChatBox.tsx` | 33 | Chat message display |
| `components/Joystick.tsx` | 194 | Virtual joystick (documented in [input.md](input.md)) |
| `index.tsx` | 14 | React entry point |
| `index.html` | 40 | Bootstrap HTML, CDN imports, fonts, global styles |
| `game/EventBus.ts` | 4 | Singleton `Phaser.Events.EventEmitter` |

---

## Data Structures

### Component State (App.tsx)

```typescript
// React state managed by App component
const [gameStarted, setGameStarted] = useState(false);          // Has player clicked "ENTER ARENA"?
const [gameOver, setGameOver] = useState(false);                 // Has player died?
const [stats, setStats] = useState<GameStats>({                  // Live game stats from Phaser
  health: 100,
  ammo: 0,
  maxAmmo: 0,
  isReloading: false,
  score: 0,
  kills: 0,
  isGameOver: false,
  wave: 1
});
const [messages, setMessages] = useState<ChatMessage[]>([]);     // Chat message history
const [resetJoysticks, setResetJoysticks] = useState(0);         // Counter to trigger joystick resets
```

### GameStats (from types.ts)

```typescript
interface GameStats {
  health: number;       // 0-100
  ammo: number;         // Current ammo count
  maxAmmo: number;      // Magazine capacity (0 = infinite/melee)
  isReloading: boolean; // Currently reloading?
  score: number;        // Cumulative score (kills * 100)
  kills: number;        // Kill count
  isGameOver: boolean;  // Game over flag
  wave: number;         // Wave number (always 1, never incremented)
}
```

### ChatMessage (from types.ts)

```typescript
interface ChatMessage {
  id: string;           // Unique ID (Date.now() + Math.random())
  sender: string;       // Sender name ("SYSTEM" for system messages)
  text: string;         // Message content
  isSystem?: boolean;   // True for system messages (yellow text)
  isPlayer?: boolean;   // Defined but never used
  timestamp: number;    // Unix timestamp (Date.now())
}
```

---

## Behavior

### Application Lifecycle

The app has three visual states controlled by `gameStarted` and `gameOver`:

```
State 1: Start Screen (gameStarted=false)
  → Player clicks "ENTER ARENA"
State 2: Active Game (gameStarted=true, gameOver=false)
  → Player dies → GAME_OVER event
State 3: Death Screen (gameStarted=true, gameOver=true)
  → Player clicks "TRY AGAIN" → scene restarts
  → Returns to State 2
```

**Source**: `App.tsx:76-90`

### Game Initialization (startGame)

When the player clicks "ENTER ARENA":

```typescript
const startGame = () => {
  setGameStarted(true);     // Triggers useEffect to create Phaser game
  setGameOver(false);
  setMessages([]);           // Clear chat history
  setResetJoysticks(prev => prev + 1);  // Reset joystick positions
  addSystemMessage("Welcome to Stick Rumble. Survive.");
};
```

The `useEffect` hook at `App.tsx:30-58` fires when `gameStarted` becomes true:
1. Creates the Phaser game via `createGame('game-container')`
2. Registers three EventBus listeners:
   - `EVENTS.PLAYER_UPDATE` → merges incoming `GameStats` into React state
   - `EVENTS.GAME_OVER` → sets `gameOver=true`, adds system message with final score
   - `EVENTS.BOT_KILLED` → 30% chance to trigger Gemini API bot taunt
3. Returns cleanup function that destroys the Phaser game and removes all EventBus listeners

### Game Restart (restartGame)

When the player clicks "TRY AGAIN" on the death screen:

```typescript
const restartGame = () => {
  EventBus.emit(EVENTS.RESTART);   // MainScene listens → scene.restart()
  setGameOver(false);
  setResetJoysticks(prev => prev + 1);
  addSystemMessage("Restarting...");
};
```

**Note**: This does NOT destroy and recreate the Phaser game. It emits `EVENTS.RESTART` which MainScene handles by calling `this.scene.restart()`. The stats are NOT reset in React — they get overwritten when MainScene sends its first `PLAYER_UPDATE` after restart.

**Source**: `App.tsx:86-90`, `MainScene.ts:169`

### EventBus Bridge

The `EventBus` is a singleton `Phaser.Events.EventEmitter` instance that bridges React and Phaser:

```typescript
// game/EventBus.ts
export const EventBus = new Phaser.Events.EventEmitter();
```

**Events flowing Phaser → React (consumed by App.tsx):**

| Event | Data | Trigger |
|-------|------|---------|
| `EVENTS.PLAYER_UPDATE` | `GameStats` | Every stat change (health, ammo, score, kills) |
| `EVENTS.GAME_OVER` | `{ score, kills }` | Player death |
| `EVENTS.BOT_KILLED` | `{ name: string }` | Enemy killed by player |

**Events flowing React → Phaser (emitted by App.tsx):**

| Event | Data | Trigger |
|-------|------|---------|
| `EVENTS.INPUT_MOVE` | `{ x, y, active }` | Left joystick movement |
| `EVENTS.INPUT_AIM` | `{ x, y, active }` | Right joystick movement |
| `EVENTS.RESTART` | (none) | "TRY AGAIN" button click |

**Source**: `App.tsx:37-53`, `App.tsx:93-99`

### Chat System

Two helper functions manage chat messages:

```typescript
const addChatMessage = (sender: string, text: string) => {
  setMessages((prev) => [
    ...prev,
    { id: Date.now().toString() + Math.random(), sender, text, timestamp: Date.now() }
  ]);
};

const addSystemMessage = (text: string) => {
  setMessages((prev) => [
    ...prev,
    { id: Date.now().toString(), sender: 'SYSTEM', text, isSystem: true, timestamp: Date.now() }
  ]);
};
```

Messages accumulate in state but only the last 5 are rendered by ChatBox. Messages are never pruned from state.

**Source**: `App.tsx:61-73`

---

## UI Components

### Start Screen

Rendered when `gameStarted === false`. Full-screen overlay with:

| Element | Style | Content |
|---------|-------|---------|
| Title | `text-5xl md:text-7xl font-bold text-red-600 pixel-font` | "STICK RUMBLE" |
| Subtitle | `text-xl text-gray-400` | "AI REVENGE" |
| Button | `px-8 py-4 bg-white text-black font-bold text-xl rounded pixel-font` | "ENTER ARENA" |
| Instructions | `text-sm text-gray-600` | "WASD to Move \| Mouse to Aim/Shoot / Or use Touch Joysticks / 'R' to Reload" |

- Background: `bg-black bg-opacity-90`
- Layout: flex column, centered vertically and horizontally
- Z-index: 50 (above game canvas at z-0)

**Source**: `App.tsx:107-123`

### Death Screen

Rendered when `gameOver === true`. Full-screen overlay with:

| Element | Style | Content |
|---------|-------|---------|
| Title | `text-5xl text-white font-bold` | "YOU DIED" |
| Score icon | Trophy (lucide-react), `text-yellow-500` | Final score value |
| Kills icon | Skull (lucide-react), `text-red-500` | Kill count + " Kills" |
| Button | `px-6 py-3 border-2 border-white text-white font-bold pixel-font` | "TRY AGAIN" |

- Background: `bg-black bg-opacity-80 backdrop-blur-sm`
- Score and kills displayed side by side with 8-unit gap
- Z-index: 50

**Source**: `App.tsx:125-145`

### HUD (In-Game)

Rendered when `gameStarted && !gameOver`. The HUD consists of a top bar and chat box, all overlaid on the game canvas.

#### Top Bar Layout

```
┌──────────────────────────────────────────────────────────┐
│ [minimap gap] [Health Bar] [Ammo]          [Score] [Kills]│
│               (pl-44 = 176px left padding for minimap)    │
└──────────────────────────────────────────────────────────┘
```

**Source**: `App.tsx:148-178`

#### Health Bar

- **Position**: Top-left (after 176px left padding for minimap)
- **Icon**: `Activity` (lucide-react) — green normally, red + pulsing when health < 30
- **Bar**: 192px wide (`w-48`), 16px tall (`h-4`), rounded
  - Background: `bg-gray-800` with `border border-gray-600`
  - Fill: `bg-green-500` normally, `bg-red-600` when health < 30
  - Width: `{stats.health}%` with 200ms CSS transition
- **Text**: `{Math.round(stats.health)}%` in monospace bold

**Color thresholds:**
- Health >= 30: green icon, green bar
- Health < 30: red icon with `animate-pulse`, red bar

**Source**: `App.tsx:154-163`

#### Ammo Display

- **Position**: Below health bar, same left alignment
- **Icon**: `Crosshair` (lucide-react) normally, `RefreshCw` with `animate-spin` when reloading
- **Color**: `text-yellow-500` normally, `text-red-500 animate-pulse` when reloading
- **Text**: `{ammo}/{maxAmmo}` in monospace bold, or `INF` when `maxAmmo === 0` (melee weapons)
- **Reload indicator**: "RELOADING..." text in `text-sm font-mono` appears when `stats.isReloading`

**Source**: `App.tsx:164-171`

#### Score Display

- **Position**: Top-right
- **Score**: `{stats.score}` zero-padded to 6 digits (e.g., "000100"), `text-2xl font-bold font-mono`
- **Kills**: "KILLS: {stats.kills}" in `text-sm text-red-400 font-mono`

**Source**: `App.tsx:174-177`

### ChatBox Component

**File**: `components/ChatBox.tsx`

A simple message display anchored to the bottom-left of the screen.

**Props:**
```typescript
interface ChatBoxProps {
  messages: ChatMessage[];
}
```

**Behavior:**
1. Receives full message array but renders only the last 5 via `messages.slice(-5)`
2. Auto-scrolls to newest message via `useRef` + `scrollIntoView({ behavior: 'smooth' })`
3. System messages rendered in yellow bold: `[SYSTEM] {text}`
4. Non-system messages rendered as: `{sender}: {text}` (sender in red bold, text in white)

**Styling:**
- Position: `absolute bottom-4 left-4`
- Size: `w-64 h-48` (256px x 192px)
- Background: `bg-black bg-opacity-30` with 8px padding, rounded corners
- `pointer-events-none` — cannot be clicked/interacted with
- `overflow-hidden` — no scrollbar visible
- Z-index: 10

**Source**: `ChatBox.tsx:1-33`

### Mobile Virtual Joysticks

Two `Joystick` instances rendered for mobile (hidden on `md:` breakpoint and above via `md:hidden block`):

| Joystick | Side | Label | Color | EventBus Event |
|----------|------|-------|-------|----------------|
| Move | left | "MOVE" | blue | `EVENTS.INPUT_MOVE` |
| Aim/Fire | right | "AIM/FIRE" | red | `EVENTS.INPUT_AIM` |

Both receive `resetKey={resetJoysticks}` prop that triggers `handleEnd()` when incremented (on game start/restart).

Full joystick behavior is documented in [input.md](input.md).

**Source**: `App.tsx:184-187`

---

## React Entry Point

**File**: `index.tsx`

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  // StrictMode is removed for Phaser compatibility to prevent double initialization in dev
  <App />
);
```

React StrictMode is intentionally disabled because it causes Phaser to initialize twice in development mode (due to double-render behavior).

**Source**: `index.tsx:1-14`

---

## HTML Bootstrap

**File**: `index.html`

The HTML file provides:

1. **Viewport meta**: `maximum-scale=1.0, user-scalable=no` — prevents pinch-zoom on mobile
2. **CDN imports via import map**:
   - `react` / `react-dom` from aistudiocdn.com
   - `phaser` from aistudiocdn.com
   - `lucide-react` from aistudiocdn.com
   - `@google/genai` from aistudiocdn.com
3. **Font loading**: Google Fonts for Press Start 2P (pixel font) and Roboto (body text)
4. **Tailwind CSS**: Runtime CDN script (`cdn.tailwindcss.com`)
5. **Global styles**:
   - `body`: margin 0, overflow hidden, background `#1a1a1a`, font-family Roboto, `touch-action: none`
   - `canvas`: display block
   - `.pixel-font`: font-family 'Press Start 2P', cursive
6. **Root div**: `<div id="root"></div>`

**Source**: `index.html:1-40`

---

## Error Handling

### Missing Root Element

`index.tsx` throws an explicit error if `document.getElementById('root')` returns null. This is the only error handling in the UI layer.

### EventBus Listener Cleanup

The `useEffect` cleanup function in `App.tsx:54-57` calls:
- `game.destroy(true)` — destroys the Phaser game instance
- `EventBus.removeAllListeners()` — removes ALL listeners (not just the ones this component registered)

**Potential issue**: `removeAllListeners()` is aggressive — if other code registers EventBus listeners outside this component, they would also be removed. In practice this doesn't cause issues since the game is being destroyed anyway.

### Bot Taunt API Errors

The `BOT_KILLED` handler uses `async/await` with `generateBotTaunt()` but has no try/catch. If the Gemini API call fails, the error is unhandled and the taunt is silently dropped. See [gemini-service.md](gemini-service.md) for API error handling details.

**Source**: `App.tsx:46-51`

---

## Implementation Notes

### CSS Framework

Tailwind CSS is loaded at runtime from CDN (`cdn.tailwindcss.com`), not as a build-time dependency. This means:
- All Tailwind classes are available without configuration
- Dynamic class names (like `border-${color}-500` in Joystick.tsx) work because the CDN version scans the DOM at runtime
- No `tailwind.config.js` needed
- No purging of unused styles

### Z-Index Layering

| Layer | Z-Index | Content |
|-------|---------|---------|
| Game canvas | 0 | Phaser game (absolutely positioned, `inset-0`) |
| HUD elements | 10 | Health bar, ammo, score, chat box |
| Virtual joysticks | 20 | Mobile touch controls |
| Overlays (start/death) | 50 | Full-screen modal overlays |

### Pointer Events

- The game container div has no explicit pointer-events setting (defaults to `auto`)
- HUD top bar has `pointer-events-none` — mouse clicks pass through to the game canvas
- ChatBox has `pointer-events-none` — cannot be clicked
- Start/death screen overlays do NOT have `pointer-events-none` — they block game interaction
- Virtual joysticks have default pointer events (must capture touches)

### Responsive Behavior

- The main container is `w-full h-screen` — fills the viewport
- The Phaser game uses `Phaser.Scale.RESIZE` mode — fills its container
- Virtual joysticks are hidden on `md:` breakpoint (768px+) via `md:hidden block`
- Start screen title is responsive: `text-5xl md:text-7xl`

### No In-Game Minimap in React

The minimap is rendered entirely within Phaser's `MainScene` using `Phaser.GameObjects.Graphics` (see [rendering.md](rendering.md)). The HUD top bar has `pl-44` (176px left padding) to avoid overlapping the minimap. The minimap is at Z-index 1999-2000 within Phaser's display list, not the React DOM.

---

## Test Scenarios

### TS-UI-001: Start Screen Renders Before Game Start

**Category**: Unit
**Priority**: High

**Preconditions:**
- App component mounted
- `gameStarted` is false (initial state)

**Expected Output:**
- "STICK RUMBLE" title visible
- "ENTER ARENA" button visible
- No HUD elements visible
- No game canvas active

### TS-UI-002: Clicking ENTER ARENA Starts Game

**Category**: Integration
**Priority**: Critical

**Preconditions:**
- Start screen is displayed

**Input:**
- Click "ENTER ARENA" button

**Expected Output:**
- `gameStarted` set to true
- Phaser game created via `createGame('game-container')`
- System message "Welcome to Stick Rumble. Survive." added
- HUD becomes visible
- Start screen disappears

### TS-UI-003: Health Bar Updates on PLAYER_UPDATE

**Category**: Unit
**Priority**: High

**Input:**
- EventBus emits `PLAYER_UPDATE` with `{ health: 50 }`

**Expected Output:**
- Health bar fill width is 50%
- Health text shows "50%"
- Icon and bar remain green (health >= 30)

### TS-UI-004: Health Bar Turns Red Below 30%

**Category**: Unit
**Priority**: Medium

**Input:**
- EventBus emits `PLAYER_UPDATE` with `{ health: 25 }`

**Expected Output:**
- Activity icon turns red with pulse animation
- Health bar fill turns red (`bg-red-600`)
- Health text shows "25%"

### TS-UI-005: Ammo Counter Shows Current/Max

**Category**: Unit
**Priority**: High

**Input:**
- EventBus emits `PLAYER_UPDATE` with `{ ammo: 15, maxAmmo: 30, isReloading: false }`

**Expected Output:**
- Ammo text shows "15/30"
- Crosshair icon displayed (yellow)
- No reloading indicator

### TS-UI-006: Ammo Shows INF for Melee Weapons

**Category**: Unit
**Priority**: Medium

**Input:**
- EventBus emits `PLAYER_UPDATE` with `{ ammo: 0, maxAmmo: 0 }`

**Expected Output:**
- Ammo text shows "INF"

### TS-UI-007: Reload Indicator Appears During Reload

**Category**: Unit
**Priority**: Medium

**Input:**
- EventBus emits `PLAYER_UPDATE` with `{ isReloading: true }`

**Expected Output:**
- RefreshCw icon displayed with spin animation
- Text color changes to red with pulse
- "RELOADING..." text visible

### TS-UI-008: Score Display Shows Zero-Padded Score

**Category**: Unit
**Priority**: Low

**Input:**
- EventBus emits `PLAYER_UPDATE` with `{ score: 100, kills: 1 }`

**Expected Output:**
- Score shows "000100"
- Kills shows "KILLS: 1"

### TS-UI-009: Death Screen Shows Final Stats

**Category**: Integration
**Priority**: High

**Input:**
- EventBus emits `GAME_OVER` with `{ score: 500, kills: 5 }`

**Expected Output:**
- "YOU DIED" title visible
- Trophy icon with score "500"
- Skull icon with "5 Kills"
- "TRY AGAIN" button visible
- System message "GAME OVER! Score: 500" in chat

### TS-UI-010: TRY AGAIN Restarts Game

**Category**: Integration
**Priority**: High

**Preconditions:**
- Death screen is displayed

**Input:**
- Click "TRY AGAIN" button

**Expected Output:**
- `EVENTS.RESTART` emitted on EventBus
- `gameOver` set to false
- Joysticks reset
- System message "Restarting..." added
- HUD reappears

### TS-UI-011: ChatBox Shows Last 5 Messages

**Category**: Unit
**Priority**: Medium

**Input:**
- 7 messages in state

**Expected Output:**
- Only messages 3-7 visible (last 5)
- Auto-scrolled to newest message

### TS-UI-012: System Messages Styled Differently

**Category**: Unit
**Priority**: Low

**Input:**
- System message with `isSystem: true`

**Expected Output:**
- Rendered as `[SYSTEM] {text}` in yellow bold
- Non-system messages rendered as `{sender}: {text}` with red sender

### TS-UI-013: Bot Taunt Has 30% Trigger Rate

**Category**: Unit
**Priority**: Low

**Input:**
- EventBus emits `BOT_KILLED` with `{ name: "Noob" }`

**Expected Output:**
- ~30% of the time, `generateBotTaunt` is called and chat message added
- ~70% of the time, nothing happens (random check: `Math.random() > 0.7`)

### TS-UI-014: Joysticks Hidden on Desktop

**Category**: Visual
**Priority**: Medium

**Preconditions:**
- Viewport width >= 768px (md breakpoint)

**Expected Output:**
- Joystick elements have `display: none` via `md:hidden`

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-02-16 | Initial specification |
