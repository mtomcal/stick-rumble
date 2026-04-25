# Stick Rumble Client

Phaser 3 + React + TypeScript browser client for Stick Rumble.

The client owns rendering, input capture, UI screens, local prediction, interpolation, and mobile/desktop presentation. The Go server remains authoritative for match state, movement validation, combat, scoring, respawns, and room membership.

Use the root `Makefile` for normal workflows:

```bash
make install
make dev-client
make test-client
make typecheck
make lint
make build
```

Package-specific commands are available when targeted work needs them:

```bash
npm run dev
npm test
npm run test:integration
npm run typecheck
npm run lint
npm run build
```

## Environment

Copy values from `.env.example` only when local defaults are not enough.

- `VITE_WS_URL`: WebSocket endpoint for the game server. When unset, local development derives the socket URL from the browser hostname and port `8080`.
- `VITE_CLIENT_BASE_URL`: Base URL used to generate shareable invite links. Defaults to the current browser origin, with a local fallback.

Current implementation intent lives in [`../specs/`](../specs/).
