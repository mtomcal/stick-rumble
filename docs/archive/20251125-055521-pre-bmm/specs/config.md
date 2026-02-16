# Configuration and Build Setup

> **Spec Version**: 1.0.0
> **Last Updated**: 2026-02-15
> **Source Files**: `package.json` (24 lines), `vite.config.ts` (23 lines), `tsconfig.json` (28 lines), `index.html` (40 lines), `index.tsx` (14 lines), `game/phaserGame.ts` (26 lines)
> **Depends On**: [overview.md](overview.md), [types-and-events.md](types-and-events.md)
> **Depended By**: [stick-figure.md](stick-figure.md), [main-scene.md](main-scene.md), [ui.md](ui.md)

---

## Overview

This spec documents the build tooling, dependency management, TypeScript configuration, HTML bootstrap, CDN import maps, React entry point, and Phaser game factory for the pre-BMM prototype. The project uses Vite as the dev server and bundler, loads all runtime dependencies via CDN import maps (no bundled `node_modules` at runtime), and initializes a single Phaser game instance with Arcade physics at 120 FPS.

There is no test runner, no linter config, no CI pipeline, and no production deployment setup in the archive. The project is a development-only prototype.

---

## Dependencies

### Runtime Dependencies

Loaded via CDN import maps in `index.html`. Never bundled from `node_modules`.

**Source**: `package.json:11-17`

| Package | Version | Purpose |
|---------|---------|---------|
| `phaser` | `^3.90.0` | Game engine: Arcade physics, rendering, input, scene management |
| `react` | `^19.2.0` | UI framework for HUD overlay |
| `react-dom` | `^19.2.0` | React DOM renderer |
| `lucide-react` | `^0.554.0` | Icon components (crosshair, shield, etc.) |
| `@google/genai` | `^1.30.0` | Gemini 2.5 Flash API for bot trash-talk |

### Dev Dependencies

Installed locally via `npm install`. Used only at build time.

**Source**: `package.json:18-23`

| Package | Version | Purpose |
|---------|---------|---------|
| `@vitejs/plugin-react` | `^5.0.0` | Vite plugin for React JSX transform |
| `typescript` | `~5.8.2` | TypeScript compiler |
| `vite` | `^6.2.0` | Dev server and production bundler |
| `@types/node` | `^22.14.0` | Node.js type definitions (for `path` in vite config) |

### External CDN Dependencies (Non-npm)

Loaded via `<script>` tags and `<link>` tags in `index.html`. Not listed in `package.json`.

| Resource | Source | Purpose |
|----------|--------|---------|
| Tailwind CSS | `https://cdn.tailwindcss.com` | Utility-first CSS framework |
| Press Start 2P font | Google Fonts | Pixel-art style font for game UI |
| Roboto font | Google Fonts | Default body font |

---

## package.json

**Source**: `package.json` (24 lines)

```json
{
  "name": "stick-rumble",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  }
}
```

### Key Properties

| Property | Value | Significance |
|----------|-------|-------------|
| `name` | `"stick-rumble"` | Package name (not published) |
| `private` | `true` | Prevents accidental npm publish |
| `version` | `"0.0.0"` | Unversioned prototype |
| `type` | `"module"` | Enables ESM `import`/`export` syntax in Node.js context |

### Scripts

| Script | Command | Purpose |
|--------|---------|---------|
| `dev` | `vite` | Start Vite dev server on port 3000 |
| `build` | `vite build` | Production build (TypeScript + Vite bundling) |
| `preview` | `vite preview` | Preview the production build locally |

There is no `test`, `lint`, or `typecheck` script. The prototype has no test infrastructure.

---

## vite.config.ts

**Source**: `vite.config.ts` (23 lines)

```typescript
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
```

### Dev Server Configuration

| Setting | Value | Notes |
|---------|-------|-------|
| `port` | `3000` | Dev server listens on port 3000 |
| `host` | `'0.0.0.0'` | Binds to all network interfaces (accessible from LAN) |

### Plugins

| Plugin | Configuration | Purpose |
|--------|--------------|---------|
| `@vitejs/plugin-react` | Default options | Enables React JSX transform and Fast Refresh |

### Environment Variable Injection

The config uses `loadEnv(mode, '.', '')` to load environment variables from `.env` files (or the shell environment). It then injects the Gemini API key into the client bundle at build time:

```typescript
define: {
  'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
  'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
}
```

Both `process.env.API_KEY` and `process.env.GEMINI_API_KEY` are replaced at compile time with the value of the `GEMINI_API_KEY` environment variable. The `geminiService.ts` file reads this value to authenticate with the Gemini API.

**Note**: The env var is loaded as `GEMINI_API_KEY` (no `VITE_` prefix) because `loadEnv` is called with an empty prefix (`''`), which loads all environment variables, not just those prefixed with `VITE_`.

### Path Aliases

| Alias | Resolves To | Usage |
|-------|-------------|-------|
| `@` | Project root (`.`) | Allows imports like `@/types` instead of `./types` |

This alias is mirrored in `tsconfig.json` so TypeScript resolves the same paths.

---

## tsconfig.json

**Source**: `tsconfig.json` (28 lines)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "experimentalDecorators": true,
    "useDefineForClassFields": false,
    "module": "ESNext",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "types": ["node"],
    "moduleResolution": "bundler",
    "isolatedModules": true,
    "moduleDetection": "force",
    "allowJs": true,
    "jsx": "react-jsx",
    "paths": {
      "@/*": ["./*"]
    },
    "allowImportingTsExtensions": true,
    "noEmit": true
  }
}
```

### Compiler Options

| Option | Value | Rationale |
|--------|-------|-----------|
| `target` | `"ES2022"` | Modern JS output; allows top-level await, private fields |
| `module` | `"ESNext"` | ESM output; Vite handles module bundling |
| `lib` | `["ES2022", "DOM", "DOM.Iterable"]` | Includes DOM APIs needed for browser and iterator support |
| `jsx` | `"react-jsx"` | Uses React 17+ automatic JSX transform (no `import React` needed) |
| `moduleResolution` | `"bundler"` | Vite-compatible module resolution (supports extensionless imports) |
| `isolatedModules` | `true` | Required by Vite -- each file must be independently transformable |
| `moduleDetection` | `"force"` | Treats all files as ESM modules |
| `noEmit` | `true` | TypeScript is type-check only; Vite handles transpilation |
| `skipLibCheck` | `true` | Skips type-checking `.d.ts` files for faster compilation |
| `allowJs` | `true` | Permits `.js` file imports alongside `.ts` |
| `allowImportingTsExtensions` | `true` | Allows `.ts`/`.tsx` in import specifiers (requires `noEmit`) |
| `experimentalDecorators` | `true` | Enables TypeScript decorators (not actually used in the codebase) |
| `useDefineForClassFields` | `false` | Uses assignment semantics for class fields (Phaser compatibility) |
| `types` | `["node"]` | Includes Node.js type definitions (for `path` in vite config) |

### Path Mapping

```json
"paths": {
  "@/*": ["./*"]
}
```

Mirrors the Vite `resolve.alias` so TypeScript understands `@/` imports. Maps `@/anything` to `./anything` relative to the project root.

### Notable Absences

- No `strict` mode -- TypeScript runs without strict null checks, strict function types, or other strict flags
- No `include` or `exclude` arrays -- all `.ts`/`.tsx` files in the project are included by default
- No `outDir` -- consistent with `noEmit: true` (Vite handles output)

---

## index.html

**Source**: `index.html` (40 lines)

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0,
      maximum-scale=1.0, user-scalable=no" />
    <title>Stick Rumble</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P
      &family=Roboto:wght@400;700&display=swap" rel="stylesheet">
    <style>
      body {
        margin: 0;
        overflow: hidden;
        background-color: #1a1a1a;
        font-family: 'Roboto', sans-serif;
        touch-action: none;
      }
      canvas { display: block; }
      .pixel-font { font-family: 'Press Start 2P', cursive; }
    </style>
    <script type="importmap">
    {
      "imports": {
        "react-dom/": "https://aistudiocdn.com/react-dom@^19.2.0/",
        "lucide-react": "https://aistudiocdn.com/lucide-react@^0.554.0",
        "@google/genai": "https://aistudiocdn.com/@google/genai@^1.30.0",
        "react": "https://aistudiocdn.com/react@^19.2.0",
        "react/": "https://aistudiocdn.com/react@^19.2.0/",
        "phaser": "https://aistudiocdn.com/phaser@^3.90.0"
      }
    }
    </script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
```

### Viewport Configuration

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0,
  maximum-scale=1.0, user-scalable=no" />
```

- `maximum-scale=1.0` and `user-scalable=no` -- Prevents pinch-to-zoom on mobile (important for touch-based game controls)
- `initial-scale=1.0` -- Standard 1:1 viewport

### External Resources

| Resource | Type | URL | Purpose |
|----------|------|-----|---------|
| Tailwind CSS | Script | `https://cdn.tailwindcss.com` | Runtime Tailwind JIT compiler for utility classes |
| Press Start 2P | Font | Google Fonts | Pixel-art retro font, used via `.pixel-font` CSS class |
| Roboto | Font | Google Fonts | Default body font (400 and 700 weights) |

### Inline Styles

| Selector | Properties | Purpose |
|----------|-----------|---------|
| `body` | `margin: 0; overflow: hidden; background-color: #1a1a1a; font-family: 'Roboto', sans-serif; touch-action: none;` | Full-bleed dark canvas; prevents browser scrolling and touch gestures |
| `canvas` | `display: block;` | Removes default inline spacing below canvas element |
| `.pixel-font` | `font-family: 'Press Start 2P', cursive;` | Utility class for pixel-art styled text |

The `touch-action: none` on `body` is critical for mobile gameplay -- it prevents the browser from intercepting touch events for scrolling or zooming, allowing the game to handle all touch input directly.

### CDN Import Maps

The `<script type="importmap">` block maps bare module specifiers to CDN URLs. This is how the browser resolves `import Phaser from 'phaser'` without a local `node_modules` directory at runtime.

| Specifier | CDN URL | Notes |
|-----------|---------|-------|
| `react` | `https://aistudiocdn.com/react@^19.2.0` | React core |
| `react/` | `https://aistudiocdn.com/react@^19.2.0/` | React subpath imports (e.g., `react/jsx-runtime`) |
| `react-dom/` | `https://aistudiocdn.com/react-dom@^19.2.0/` | React DOM subpath imports (e.g., `react-dom/client`) |
| `phaser` | `https://aistudiocdn.com/phaser@^3.90.0` | Phaser game engine |
| `lucide-react` | `https://aistudiocdn.com/lucide-react@^0.554.0` | Icon components |
| `@google/genai` | `https://aistudiocdn.com/@google/genai@^1.30.0` | Gemini API SDK |

All CDN URLs point to `aistudiocdn.com` -- a Google AI Studio CDN that hosts npm packages for browser consumption. This eliminates the need to bundle these packages into the Vite output.

**Note**: There is no entry for `react-dom` (without trailing slash), only `react-dom/`. The code imports from `react-dom/client` which matches the `react-dom/` prefix mapping.

### Mount Point

```html
<div id="root"></div>
```

The sole DOM element. React mounts into `#root` via `index.tsx`. The Phaser canvas is created dynamically inside a child container by the `createGame()` factory.

---

## index.tsx (React Entry Point)

**Source**: `index.tsx` (14 lines)

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
  <App />
);
```

### Behavior

1. Finds the `#root` DOM element from `index.html`
2. Throws an error if `#root` is missing (defensive check)
3. Creates a React 19 concurrent root via `createRoot()`
4. Renders `<App />` without `<StrictMode>` wrapping

### No StrictMode

React's `StrictMode` is deliberately omitted. The source comment explains: "StrictMode is removed for Phaser compatibility to prevent double initialization in dev." In development mode, `StrictMode` causes effects to run twice, which would create two Phaser game instances and corrupt the game state.

---

## game/phaserGame.ts (Game Factory)

**Source**: `game/phaserGame.ts` (26 lines)

```typescript
import Phaser from 'phaser';
import { MainScene } from './scenes/MainScene';

export const createGame = (containerId: string) => {
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent: containerId,
    backgroundColor: '#1a1a1a',
    scale: {
      mode: Phaser.Scale.RESIZE,
      width: '100%',
      height: '100%',
    },
    physics: {
      default: 'arcade',
      arcade: {
        fps: 120,
        gravity: { x: 0, y: 0 },
        debug: false
      }
    },
    scene: [MainScene]
  };

  return new Phaser.Game(config);
};
```

### Configuration Table

| Setting | Value | Purpose |
|---------|-------|---------|
| `type` | `Phaser.AUTO` | Automatically selects WebGL or Canvas renderer |
| `parent` | `containerId` (parameter) | DOM element ID where the canvas is injected |
| `backgroundColor` | `'#1a1a1a'` | Dark gray background, matches `body` background |
| `scale.mode` | `Phaser.Scale.RESIZE` | Canvas resizes to fill its container (responsive) |
| `scale.width` | `'100%'` | Full width of parent container |
| `scale.height` | `'100%'` | Full height of parent container |
| `physics.default` | `'arcade'` | Uses Phaser's Arcade physics engine |
| `physics.arcade.fps` | `120` | Physics simulation at 120 FPS (double default) |
| `physics.arcade.gravity` | `{ x: 0, y: 0 }` | No gravity -- top-down 2D game |
| `physics.arcade.debug` | `false` | Physics debug rendering disabled |
| `scene` | `[MainScene]` | Single scene registered |

### 120 FPS Physics

The physics FPS is set to 120, double the standard 60. The source comment explains: "Double the physics step resolution to prevent bullet tunneling." At 60 FPS, fast-moving projectiles can skip over narrow collision bodies between physics steps. Doubling the simulation rate halves per-frame displacement, making tunneling significantly less likely.

### Factory Pattern

`createGame` is a factory function, not a class. It takes a container element ID, constructs the Phaser config, and returns a `Phaser.Game` instance. The caller (`App.tsx`) manages the lifecycle -- creating the game on mount and destroying it on unmount.

### Scene Registration

Only `MainScene` is registered. The game has no menu scene, loading scene, or pause scene. All non-gameplay UI (start screen, death screen, HUD) is handled by the React layer.

---

## Build and Runtime Architecture

### Module Resolution Flow

```
Browser loads index.html
  │
  ├── <script src="cdn.tailwindcss.com">     → Tailwind JIT (runtime CSS)
  ├── <link> Google Fonts                     → Press Start 2P, Roboto
  ├── <script type="importmap">               → Maps bare specifiers to CDN
  │
  └── Vite injects <script type="module" src="/index.tsx">
        │
        ├── import ReactDOM from 'react-dom/client'  → CDN via importmap
        ├── import App from './App'                   → Vite-served local module
        │     ├── import React from 'react'           → CDN via importmap
        │     ├── import { EventBus } from '@/game/EventBus'  → Vite '@' alias
        │     ├── import { EVENTS } from '@/types'    → Vite '@' alias
        │     └── import { createGame } from '@/game/phaserGame'
        │           └── import Phaser from 'phaser'   → CDN via importmap
        └── React mounts into #root
              └── App creates Phaser game into child container
```

### Dev vs Production

| Aspect | `npm run dev` | `npm run build` |
|--------|--------------|----------------|
| Server | Vite dev server on port 3000 | Static files |
| HMR | React Fast Refresh enabled | N/A |
| Module loading | ESM via importmap + Vite transform | Vite-bundled output |
| Env vars | `loadEnv` from `.env` file | Inlined at build time |
| Source maps | Inline | Configurable |

---

## Error Handling

### Missing Root Element

`index.tsx` throws if `#root` is not found:

```typescript
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}
```

This is the only explicit error handling in the configuration layer. The Phaser game factory does not validate its `containerId` argument -- passing an invalid ID would cause Phaser to append the canvas to `document.body` as a fallback.

### Missing API Key

If `GEMINI_API_KEY` is not set in the environment, `process.env.GEMINI_API_KEY` will be replaced with `undefined` at build time. The `geminiService.ts` handles this gracefully -- API calls will fail, and the hardcoded fallback strings will be used instead. See [gemini-service.md](gemini-service.md).

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-02-15 | Initial specification |
