# Accounts & Progression Implementation Plan

## Hybrid — spec-driven for existing spec coverage, decision-driven for architecture choices

**Based on spec commit:** `b11d302` — `fix(specs): address sage review blockers`

> **Status:** 15 design decisions resolved via grill-me session. Ready for TDD implementation.

---

## Overview

Implement Google OAuth authentication, session token management, lifetime stats tracking, a linear XP/leveling progression system, and the corresponding client-side React screens (Sign-In, Display Name Picker, Lobby, Profile). This replaces the current single-entry guest flow with a bifurcated path: authed players get persistent identity + progression, guests get drop-in play with no stats.

The implementation spans 7 vertical slices, starting with Docker Compose infrastructure and ending with a full test-quality-verifier + pre-mortem pass.

---

## Context Input

### Spec Delta To Implement

The branch `feat/logged-in` (commit `b11d302`) modifies these spec files. Full diff is 9 files, 365 insertions, 115 deletions.

| Spec File | Version | Key Changes |
|-----------|---------|-------------|
| `accounts.md` | 1.0.1 | Google OAuth flow, session tokens, `GET /api/player/me`, `avatarUrl`, match-end XP accumulation, display-name identity from bearer token, session token hashing |
| `client-architecture.md` | 1.6.0 | New session states (`sign_in`, `display_name_picker`, `lobby`, `profile`), page-load validation via `GET /api/player/me` (not WebSocket), `accountId` on `MatchSession` |
| `networking.md` | 1.3.2 | Fresh ephemeral `Player.ID` for authed connections, `AccountID` for persistent DB UUID, defer RoomManager enrollment to `player:hello`, security considerations |
| `rooms.md` | 1.5.1 | `IsAuthed`, `AccountID` on network `Player` struct, lobby-generated room code semantics |
| `server-architecture.md` | 1.3.2 | AuthHandler and StatsStore definitions, `GET /api/player/me` route, authed Player fields |
| `progression.md` | 1.0.1 | Corrected leveling table, `levelForXp` examples, lifetime XP bar inputs, match-end stat processing |
| `ui.md` | 2.8.0 | Design language (color palette, typography, spacing, cards, buttons), Lobby/Profile screen specs, avatar URL from auth response |
| `messages.md` | 1.5.2 | Authed `player:hello` ignores client `displayName`, uses DB authoritative name |
| `test-index.md` | 1.4.2 | 10 accounts tests (TS-ACCT-001 to 010), 5 progression tests (TS-PROG-001 to 005) added |

### Decisions (grill outcomes)

All decisions resolved in the 2026-05-15 grill-me session.

| # | Question | Decision | Source |
|---|----------|----------|--------|
| D1 | Implementation ordering | Server DB layer → server auth endpoints → client plumbing → client screens → progression | Grill session |
| D2 | Docker Compose | Step zero — PostgreSQL + server + migration volume for dev and test | User addition |
| D3 | Google auth fail mode | Fail closed (503 `auth_unavailable`), guest path always available | Grill session |
| D4 | Session token cleanup | Inline on `ResolveSessionToken` lookup, no background sweeper | Grill session |
| D5 | AccountID → PlayerScore bridge | `PlayerState.AccountID` with `json:"-"`, `PlayerScore` internal `AccountID`, public DTO strips it | Sage recommendation |
| D6 | WebSocket connection timing | Lazy — connects after lobby mounts, not on page load | Grill session |
| D7 | Client screen routing | React Router for app screens (`/sign-in`, `/lobby`, `/profile`, `/display-name`), match states as overlays | Grill session |
| D8 | Google OAuth mode | Popup only | Grill session |
| D9 | Server config | All env vars, same pattern as existing `runtime.go` | Grill session |
| D10 | Lobby data refresh | `GET /api/player/me` on mount (`useEffect`), not push | Grill session |
| D11 | Guest retroactive XP | No — sign-in applies to future matches only | Grill session |
| D12 | DB migrations | Numbered `.sql` files in `migrations/` dir + lightweight Go runner | Grill session |
| D13 | Integration test DB | Docker Compose + `//go:build integration` tags | Grill session |
| D14 | Design language | CSS custom properties on `:root` | Grill session |
| D15 | Progression location | Pure functions in `game/progression.go`, `ProcessMatchEndStats` in auth/stats package | Grill session |

---

## Current Code State

### What is already correct

- **Server WebSocket upgrade** (`websocket_handler.go:200`): Creates `game.NewPlayer()` with UUID, manages ping/pong, handles read/write loops, and sends messages through a buffered channel. The structure is solid — we only need to add token resolution at the top.
- **Server RoomManager enrollment**: The `HandleWebSocket` → message loop → `player:hello` → `RoomSessionFlow` pipeline works. We defer RoomManager enrollment to `player:hello` as required (no change needed).
- **Match end broadcast** (`broadcast_helper.go:426`): `broadcastMatchEndedEvent` broadcasts `match:ended` with `FinalScores`. We need to add `ProcessMatchEndStats` alongside it.
- **Client App.tsx state machine**: Conditional rendering via `viewState` works. We're adding a React Router layer *around* this for the new screens.
- **Client WebSocketClient**: Message handling, reconnect logic, and schema validation are solid. We need to accept a session token parameter and pass it as `?token=`.
- **Session flow** (`sessionFlow.ts`): Pure state functions (`beginJoin`, `applySessionStatus`, `applyMatchEnd`) are clean. We extend the pattern for the new states.

### What is currently out of spec / out of alignment

- **`game.Player` struct** (`room.go:53`): Missing `AccountID *string`, `IsAuthed bool` fields. `NewPlayer()` doesn't accept account identity.
- **WebSocket upgrade** (`websocket_handler.go:200`): No `?token=` query parameter parsing. No identity resolution. Adds to `RoomManager`/`GameServer` immediately instead of deferring to `player:hello`.
- **HTTP routes** (`main.go`): Only `/health` and `/ws`. Missing `POST /api/auth/google`, `PUT /api/player/displayname`, `GET /api/player/me`.
- **Server config** (`config/runtime.go`): Missing `DATABASE_URL`, `GOOGLE_CLIENT_ID`, `SESSION_TOKEN_EXPIRY_DAYS`.
- **Client session states** (`sessionFlow.ts`): `AppViewState` only has match-related states. Missing `sign_in`, `display_name_picker`, `lobby`, `profile`.
- **Client App.tsx**: No React Router. No routing logic for app screens.
- **Client WebSocketClient**: No session token parameter. Connects to bare URL always.
- **No DB layer**: No PostgreSQL connection, no migrations, no repositories.
- **No auth handler**: No Google token validation, no session token generation.
- **No progression functions**: No `xpForLevel`, `levelForXp`, `ProcessMatchEndStats`.
- **No design system**: No CSS custom properties for the gold/dark theme.

### Important implementation constraint

Do not touch the existing match physics, movement, combat, or barrier code. The changes are limited to: network identity (Player struct, WebSocket upgrade), HTTP endpoints (auth, player info), database (PostgreSQL, migrations, repositories), progression (level functions, match-end stats), and client UI (new screens, design language, routing). The `GameServer`, `World`, `Match`, and all physics/combat code remain untouched.

---

## Intended Implementation Shape

The architecture follows a clean layering:

```
┌─────────────────────────────────────────────┐
│  Client React Screens (Router-routed)       │
│  SignIn | DisplayNamePicker | Lobby | Profile│
├─────────────────────────────────────────────┤
│  Client Plumbing (token mgmt, WS, HTTP)     │
├─────────────────────────────────────────────┤
│  HTTP API (auth, player/me, displayname)    │
├─────────────────────────────────────────────┤
│  Server Auth Handler + WebSocket Upgrade    │
├─────────────────────────────────────────────┤
│  Progression (level math + match-end stats) │
├─────────────────────────────────────────────┤
│  DB Layer (migrations, repositories)        │
├─────────────────────────────────────────────┤
│  PostgreSQL (via Docker Compose)            │
└─────────────────────────────────────────────┘
```

Key architectural choices:
- `AccountID` lives on `PlayerState` with `json:"-"` (never serialized to clients)
- `PlayerScore` carries an internal `AccountID` field for `ProcessMatchEndStats`
- A public DTO in the `network` package strips `AccountID` before WebSocket broadcast
- The room stores the `AccountID` → `PlayerID` mapping; `GameServer.AddPlayer` copies identity from network `Player` to `PlayerState`
- Client-side React Router wraps app screens; match states are rendered as overlays outside the router
- CSS custom properties on `:root` drive the design language; no CSS framework dependency

---

## Red/Green TDD Slices

### Slice 0: Docker Compose + PostgreSQL Migrations

**Slice type:** Infrastructure (no tests needed — verified by Docker running)

#### Red — Write tests first

No red tests. This is infrastructure. Verification is: `docker compose up` starts PostgreSQL, migrations run, and `psql` can connect.

#### Green — Create Docker Compose and migration files

- **Source file:** `docker-compose.yml` (root) — PostgreSQL service + volume + Go server
- **Source file:** `docker-compose.test.yml` (root) — PostgreSQL-only for integration tests
- **Source file:** `stick-rumble-server/internal/migrations/001_create_players.sql`
- **Source file:** `stick-rumble-server/internal/migrations/002_create_session_tokens.sql`
- **Source file:** `stick-rumble-server/internal/migrations/003_create_lifetime_stats.sql`
- **Source file:** `stick-rumble-server/internal/db/postgres.go` — connection pool setup
- **Source file:** `stick-rumble-server/internal/db/migrate.go` — migration runner
- **Decision satisfied:** D2, D12

#### Refactor

None needed.

---

### Slice 1: Progression Pure Functions + Server Config

**Slice type:** Spec-driven (progression.md) + decision-driven (D15)

#### Red — Write tests first

- **Test file:** `stick-rumble-server/internal/game/progression_test.go`
- **What the test proves:**
  - `xpForLevel(1) = 500`, `xpForLevel(2) = 1000`, `xpForLevel(N) = N * 500`
  - `levelForXp(0) = 1`, `levelForXp(499) = 1`, `levelForXp(500) = 2`, `levelForXp(3200) = 4`, `levelForXp(10000) = 6`
  - Boundary values: 0, 499, 500, 1500, 3200, 4500, 10000
  - No off-by-one errors
- **Assertion strategy:** Deterministic pure function assertions
- **Existing tests to rewrite:** None

Run test suite. Must see failure (package doesn't exist yet).

#### Green — Make the red test pass

- **Source file:** `stick-rumble-server/internal/game/progression.go` (create)
- **What to change:** Implement `xpForLevel(level int) int` and `levelForXp(totalXp int) int` as exported pure functions
- **Source file:** `stick-rumble-server/internal/config/runtime.go` (modify)
- **What to change:** Add `DatabaseURL`, `GoogleClientID`, `SessionTokenExpiryDays` to `RuntimeConfig` struct and `Load()` with env-var defaults
- **Decision satisfied:** D15, D9

Run test suite. Progression tests pass. Existing tests still pass.

#### Refactor

None needed.

---

### Slice 2: Player Struct Changes + Session Token Resolver

**Slice type:** Spec-driven (rooms.md, networking.md, server-architecture.md) + decision-driven (D5)

#### Red — Write tests first

- **Test file:** `stick-rumble-server/internal/game/room_test.go` (modify existing or create new)
- **What the test proves:**
  - `NewPlayer` with account identity sets `AccountID` and `IsAuthed` correctly
  - `NewPlayer` without account identity leaves `AccountID = nil` and `IsAuthed = false`
  - `Player` struct serializes to JSON without `AccountID` leaking (it's on `game.Player`, *not* in JSON)
- **Test file:** `stick-rumble-server/internal/db/session_repo_test.go` (create, tagged `//go:build integration`)
- **What the test proves:**
  - `GenerateSessionToken()` returns base64url string (no padding) of 32 bytes
  - `HashSessionToken(token)` returns SHA-256 hex string
  - `CreateSession(hash, playerID, expiresAt)` inserts row
  - `FindSessionByHash(hash)` returns matching session
  - Expired session lookup returns nil (cleanup inline)
- **Assertion strategy:** Deterministic (token + hash), DB-backed for session repo
- **Existing tests to rewrite:** None

Run progression tests + room tests (unit, no DB). Room tests fail because `NewPlayer` signature changed. Session repo tests fail because package doesn't exist yet.

#### Green — Make the red test pass

- **Source file:** `stick-rumble-server/internal/game/room.go` (modify)
  - Add `AccountID *string` and `IsAuthed bool` to `Player` struct
  - Add `NewPlayerWithAccount(id string, sendChan chan []byte, accountID *string, displayName string, isAuthed bool) *Player`
  - Keep `NewPlayer` for backward compat (Guests)
  - Add `SetAccountIdentity(accountID *string, displayName string, isAuthed bool)` method for WS upgrade
- **Source file:** `stick-rumble-server/internal/db/postgres.go` (modify — add session token helpers)
- **Source file:** `stick-rumble-server/internal/db/session_repo.go` (create)
  - `GenerateSessionToken() string` — 32 random bytes, base64url no padding
  - `HashSessionToken(token string) string` — SHA-256, hex encoded
  - `CreateSession(hash, playerID, expiresAt) error`
  - `FindSessionByHash(hash) (*SessionToken, error)` — returns nil for expired (deletes inline)
- **Decision satisfied:** D4, D5

Run test suite. Unit tests pass. Integration tests need Docker running (`make test-integration`).

#### Refactor

- Extract `TokenHash` helper to `db/token.go` for reuse in auth handler

---

### Slice 3: Auth HTTP Endpoints + WebSocket Upgrade Flow

**Slice type:** Spec-driven (accounts.md, networking.md, server-architecture.md) + decision-driven (D3, D6)

#### Red — Write tests first

- **Test file:** `stick-rumble-server/internal/auth/handler_test.go` (create, unit tests for non-DB logic)
  - `sanitizeDisplayName` follows rooms.md rules (TS-ACCT-009)
  - Google token validation mock returns expected errors
  - `ParseBearerToken` extracts token from `Authorization` header
- **Test file:** `stick-rumble-server/internal/auth/handler_integration_test.go` (create, tagged `//go:build integration`)
  - `POST /api/auth/google` — first-time Google auth creates player + lifetime stats + session token (TS-ACCT-001)
  - `POST /api/auth/google` — returning auth updates `last_seen_at`, returns existing player (TS-ACCT-002)
  - `PUT /api/player/displayname` — saves name, updates player record (TS-ACCT-004)
  - `PUT /api/player/displayname` — invalid/session expired returns 401
  - `GET /api/player/me` — returns player + lifetime stats + level data
  - `GET /api/player/me` — 401 for missing/invalid token
  - `POST /api/auth/google` — invalid Google token returns 401 (TS-ACCT-008)
- **Test file:** `stick-rumble-server/internal/network/websocket_handler_token_test.go` (create, tagged `//go:build integration`)
  - Guest WS upgrade assigns ephemeral `Player.ID`, `AccountID = nil` (TS-ACCT-005)
  - Authed WS upgrade (with valid `?token=`) sets `AccountID` from DB, ignores `displayName` in `player:hello` (TS-ACCT-006)
  - Expired token upgrade falls back to guest (TS-ACCT-007)
  - Authed `player:hello` uses DB display name, ignores client-supplied name
- **Assertion strategy:** HTTP response codes + body JSON + DB state verification
- **Existing tests to rewrite:** Any existing WS handler tests that add to RoomManager during upgrade must be checked for behavioral change

Run test suite. Integration tests fail (auth package doesn't exist yet, WS handler doesn't read `?token=`).

#### Green — Make the red test pass

- **Source file:** `stick-rumble-server/internal/auth/handler.go` (create)
  - `HandleGoogleSignIn(w, r)` — validates Google ID token via `tokeninfo` API, creates/updates player record, generates session token, returns `SignInResponse`
  - `HandleSetDisplayName(w, r)` — parses bearer token, sanitizes display name, updates player record
  - `HandleGetPlayerInfo(w, r)` — parses bearer token, loads player + lifetime stats, computes level, returns response
  - `ResolveSessionToken(token string) (*PlayerRecord, error)` — hashes token, looks up session, returns player
  - `sanitizeDisplayName(raw string) string` — shared sanitizer (reuses rooms.md logic or imports it)
  - `parseBearerToken(header string) (string, error)` — extracts token from `Authorization: Bearer <token>`
- **Source file:** `stick-rumble-server/internal/db/player_repo.go` (create)
  - `FindByGoogleSub(sub string) (*PlayerRecord, error)`
  - `Create(player *PlayerRecord) error`
  - `UpdateDisplayName(playerID, displayName string) error`
  - `UpdateLastSeen(playerID string) error`
- **Source file:** `stick-rumble-server/internal/db/stats_repo.go` (create)
  - `GetByPlayerID(playerID string) (*LifetimeStats, error)`
  - `Save(stats *LifetimeStats) error`
  - `CreateForPlayer(playerID string) error`
- **Source file:** `stick-rumble-server/internal/network/websocket_handler.go` (modify)
  - Parse `?token=` query parameter at upgrade
  - Call `authHandler.ResolveSessionToken(token)` for valid tokens
  - Set `AccountID`, `DisplayName`, `IsAuthed` on `game.Player`
  - Defer `RoomManager`/`GameServer` enrollment to `player:hello`
  - In `player:hello` handling: for authed players, use DB `DisplayName` (ignore client field)
- **Source file:** `stick-rumble-server/cmd/server/main.go` (modify)
  - Register `POST /api/auth/google`, `PUT /api/player/displayname`, `GET /api/player/me`
  - Initialize `AuthHandler` with DB pool, Google client ID, session expiry
- **Decision satisfied:** D3, D4, D5, D6, D9

Run test suite. All integration tests pass with Docker PostgreSQL.

#### Refactor

- Extract shared sanitizer to `game/sanitize.go` so both `rooms.md` and `accounts.md` use the same function
- Add `AuthHandler` as a field on `WebSocketHandler` so upgrade can call `ResolveSessionToken`

---

### Slice 4: PlayerState AccountID + Match-End Stats Processing

**Slice type:** Spec-driven (progression.md, accounts.md) + decision-driven (D5, D11)

#### Red — Write tests first

- **Test file:** `stick-rumble-server/internal/game/player_state_account_test.go` (create)
  - `PlayerState` gains `AccountID` field (not in JSON serialization)
  - `PlayerStateSnapshot` does NOT include `AccountID`
  - `SetAccountID` and `GetAccountID` methods work
- **Test file:** `stick-rumble-server/internal/auth/stats_processor_test.go` (create, tagged `//go:build integration`)
  - `ProcessMatchEndStats` with guest player skips processing (TS-PROG-003 precondition)
  - `ProcessMatchEndStats` with authed player accumulates lifetime stats (TS-PROG-003)
  - Per-weapon kills accumulate correctly (TS-PROG-004)
  - Level-up detection fires on crossing threshold (TS-PROG-002)
  - Multiple matches accumulate correctly
- **Test file:** `stick-rumble-server/internal/network/broadcast_scores_test.go` (create)
  - `match:ended` WebSocket message excludes `AccountID` from `PlayerScore`
  - Public DTO has only: `playerId`, `displayName`, `kills`, `deaths`, `xp`
- **Assertion strategy:** JSON marshaling checks for HTTP/socket output; DB state checks for stats
- **Existing tests to rewrite:** `match_test.go` may need `GetFinalScores` check with AccountID

Run test suite. Player state tests fail (missing field). Stats processor tests fail (package doesn't exist). Broadcast tests fail (DTO doesn't exist).

#### Green — Make the red test pass

- **Source file:** `stick-rumble-server/internal/game/player.go` (modify)
  - Add `AccountID *string` field with `json:"-"` tag
  - Add `SetAccountID(accountID *string)` and `GetAccountID() *string` methods
  - In `NewPlayerState`, default `AccountID = nil`
  - In `PlayerStateSnapshot`, keep `AccountID` excluded (the `-` tag handles it)
- **Source file:** `stick-rumble-server/internal/game/gameserver.go` (modify)
  - `AddPlayer` now accepts account identity from network `Player` and copies to `PlayerState.AccountID`
- **Source file:** `stick-rumble-server/internal/game/match.go` (modify)
  - `PlayerScore` gains `AccountID *string` field (internal, not in JSON necessarily — used by processor)
  - `GetFinalScores` populates `AccountID` from `PlayerState.GetAccountID()`
- **Source file:** `stick-rumble-server/internal/auth/stats_processor.go` (create)
  - `ProcessMatchEndStats(player *PlayerState, score PlayerScore, winners []string, statsStore *StatsStore)` — skips guests, accumulates lifetime stats, detects level-up
- **Source file:** `stick-rumble-server/internal/network/publication.go` (modify)
  - Add `publicPlayerScore` DTO that excludes `AccountID`
  - `BroadcastMatchEnded` maps `PlayerScore` → `publicPlayerScore` before broadcast
- **Source file:** `stick-rumble-server/internal/network/broadcast_helper.go` (modify)
  - After `broadcastMatchEndedEvent`, call `ProcessMatchEndStats` for each player in `FinalScores`
- **Decision satisfied:** D5, D11

Run test suite. All tests pass.

#### Refactor

- Ensure `ProcessMatchEndStats` runs within a DB transaction (wrap the StatsStore calls)

---

### Slice 5: Client Plumbing — Token Management, HTTP Calls, WebSocket Token, React Router

**Slice type:** Spec-driven (client-architecture.md) + decision-driven (D6, D7, D8, D10)

#### Red — Write tests first

- **Test file:** `stick-rumble-client/src/game/network/sessionToken.test.ts` (create)
  - `storeSessionToken(token)` writes to `localStorage` under `stick_rumble_session_token` (TS-ACCT-003)
  - `getSessionToken()` reads from `localStorage`
  - `clearSessionToken()` removes from `localStorage`
  - `hasSessionToken()` returns true/false
  - Token survives across simulated page reloads
- **Test file:** `stick-rumble-client/src/game/network/playerApi.test.ts` (create)
  - `fetchPlayerMe(token)` calls `GET /api/player/me` with `Authorization: Bearer` header
  - 200 response returns typed `PlayerInfo` (playerId, displayName, avatarUrl, lifetimeStats, level, xp)
  - 401 response clears token and returns null
  - Network error returns null
- **Test file:** `stick-rumble-client/src/game/network/WebSocketClient.test.ts` (modify)
  - Constructor accepts optional session token
  - When token is present, WebSocket URL includes `?token=<encoded>` (TS-ACCT-006)
  - When token is absent, WebSocket URL has no query param (TS-ACCT-005)
- **Test file:** `stick-rumble-client/src/game/sessionFlow.test.ts` (modify)
  - New `AppViewState` values (`sign_in`, `display_name_picker`, `lobby`, `profile`) are valid
  - State transitions follow the session state machine diagram
- **Assertion strategy:** Mock `localStorage`, mock `fetch`, mock `WebSocket`
- **Existing tests to rewrite:** None (existing WS test doesn't pass token)

Run test suite. Tests fail (packages don't exist, constants not defined).

#### Green — Make the red test pass

- **Source file:** `stick-rumble-client/src/game/network/sessionToken.ts` (create)
  - `STICK_RUMBLE_SESSION_TOKEN_KEY = 'stick_rumble_session_token'`
  - Exported functions: `storeSessionToken`, `getSessionToken`, `clearSessionToken`, `hasSessionToken`
- **Source file:** `stick-rumble-client/src/game/network/playerApi.ts` (create)
  - `fetchPlayerMe(token: string): Promise<PlayerInfo | null>`
  - Fetches `GET /api/player/me`, handles 401 by clearing token, returns null on error
- **Source file:** `stick-rumble-client/src/game/network/WebSocketClient.ts` (modify)
  - Constructor signature: `constructor(baseUrl: string, sessionToken?: string)`
  - `connect()` uses `sessionToken` as `?token=` query param when present
- **Source file:** `stick-rumble-client/src/game/sessionFlow.ts` (modify)
  - Add `'sign_in' | 'display_name_picker' | 'lobby' | 'profile'` to `AppViewState`
  - Add `createInitialAppState()` returning `sign_in` (no token) or `lobby` (token found + valid)
- **Source file:** `stick-rumble-client/src/shared/types.ts` (modify)
  - Add `PlayerInfo` interface with `playerId`, `displayName`, `avatarUrl?`, `lifetimeStats`, `level`, `currentLevelXp`, `xpForNextLevel`
  - Add `LifetimeStats` interface
  - `MatchSession` gains `accountId?: string`
- **Source file:** `stick-rumble-client/src/shared/constants.ts` (modify)
  - Add `SESSION_TOKEN_KEY`, `API_BASE_URL`
- **Decision satisfied:** D6, D7, D8, D10

Run test suite. All client tests pass.

#### Refactor

- Extract `getApiBaseUrl()` into `runtimeConfig.ts` alongside `getWebSocketUrl()`

---

### Slice 6: Client React Screens — SignInScreen + DisplayNamePickerScreen

**Slice type:** Spec-driven (ui.md, client-architecture.md) + decision-driven (D7, D8, D14)

#### Red — Write tests first

- **Test file:** `stick-rumble-client/src/ui/auth/SignInScreen.test.tsx` (create)
  - Renders Google Sign-In button and "Play as Guest" link
  - Clicking "Play as Guest" calls `onGuestClick` callback
  - Google Sign-In callback triggers Google Identity Services initialization
- **Test file:** `stick-rumble-client/src/ui/auth/DisplayNamePickerScreen.test.tsx` (create)
  - Renders name input with validation
  - Empty name shows error
  - Name > 16 chars shows error
  - Valid name calls `onConfirm` with sanitized name
  - Loading state shows spinner (during PUT request)
- **Assertion strategy:** React Testing Library — render, click, assert
- **Existing tests to rewrite:** None

Run test suite. Tests fail (components don't exist).

#### Green — Make the red test pass

- **Source file:** `stick-rumble-client/src/ui/auth/SignInScreen.tsx` (create)
  - Renders Google Sign-In button via `google.accounts.id.initialize()` + `renderButton()`
  - Callback extracts `idToken` from `CredentialResponse`, calls `POST /api/auth/google`
  - On success: stores token via `storeSessionToken()`, navigates based on `displayName` presence
  - "Play as Guest" button navigates to `join_form` (legacy flow)
- **Source file:** `stick-rumble-client/src/ui/auth/DisplayNamePickerScreen.tsx` (create)
  - Input field with character counter (max 16)
  - Submit via `PUT /api/player/displayname` with bearer token
  - Loading state during PUT, error state for validation failures
  - On success: navigates to lobby
- **Source file:** `stick-rumble-client/src/ui/auth/AuthStyles.css` (create)
  - CSS custom properties imported from `:root` in `index.css`
- **Decision satisfied:** D7, D8, D14

Run test suite. Tests pass.

#### Refactor

- Extract shared `useApiClient` hook for API calls with bearer token

---

### Slice 7: Client React Screens — LobbyScreen + ProfileScreen + LevelUpToast + Design Language

**Slice type:** Spec-driven (ui.md, client-architecture.md, progression.md) + decision-driven (D7, D10, D14)

#### Red — Write tests first

- **Test file:** `stick-rumble-client/src/ui/lobby/LobbyScreen.test.tsx` (create)
  - Renders player level, XP progress bar, stats cluster (KILLS, DEATHS, K/D, XP), Google avatar, display name
  - "Play Public" button calls `onPlayPublic` callback
  - "Join with Code" shows input and calls `onJoinCode(code)`
  - "Profile" link navigates to `/profile`
  - "Sign Out" clears token and navigates to `/sign-in`
  - Room code section shows the server-generated code
  - XP bar shows correct width: `(currentLevelXp / xpForNextLevel) * 100%`
  - Loading state while `GET /api/player/me` is in flight
  - Level-up toast appears when `newLevel` prop changes
- **Test file:** `stick-rumble-client/src/ui/profile/ProfileScreen.test.tsx` (create)
  - Renders player level, hexagon level badge, XP progress bar
  - Renders all lifetime stats: kills, deaths, K/D (computed), XP, games, wins
  - Renders per-weapon kills table
  - "Back to Lobby" navigates to `/lobby`
- **Test file:** `stick-rumble-client/src/game/entities/LevelUpToast.test.ts` (create)
  - `show(5)` creates visible toast with "Level Up! You're now Level 5"
  - Duplicate `show(5)` calls are ignored while active (TS-PROG-005)
  - Toast auto-dismisses after 3 seconds
  - Guest players do not show toast
- **Assertion strategy:** React Testing Library for components, Phaser mock for toast
- **Existing tests to rewrite:** None

Run test suite. Tests fail (components don't exist).

#### Green — Make the red test pass

- **Source file:** `stick-rumble-client/src/ui/lobby/LobbyScreen.tsx` (create)
  - Calls `GET /api/player/me` on mount
  - Renders: nav bar with "STICK RUMBLE" gold gradient logo, PLAY + PROFILE links
  - Hexagon level badge (left), stats cluster (KILLS, DEATHS, K/D, XP) in dark surface cards
  - Google avatar (64×64, circle) + display name row below nav
  - XP progress bar with "XP 1,250 / 2,500" label
  - Room code section with "Share this code:" + copy button
  - Play Public button (gold filled), Create Room + Join with Code buttons (gold outlined)
  - Sign Out link
  - Level-up toast overlay (wraps `LevelUpToast` Phaser component or React version)
- **Source file:** `stick-rumble-client/src/ui/profile/ProfileScreen.tsx` (create)
  - Calls `GET /api/player/me` on mount
  - Hexagon level badge (large), XP bar, full stats grid
  - Per-weapon kills table with weapon icons and kill counts
  - Back button → `/lobby`
- **Source file:** `stick-rumble-client/src/game/entities/LevelUpToast.ts` (modify or create)
  - Phaser overlay: scale-in from 0.8→1.0, hold 3s, fade out 500ms
  - Idempotent — ignores duplicate `show()` calls with same or lower level
- **Source file:** `stick-rumble-client/src/index.css` (modify)
  - Add CSS custom properties on `:root`: `--color-bg-primary`, `--color-bg-surface`, `--color-accent-primary`, `--color-accent-secondary`, all typography tokens, spacing scale, card/button styles
- **Source file:** `stick-rumble-client/src/index.css` — add global resets and import
- **Source file:** `stick-rumble-client/src/App.tsx` (modify)
  - Wrap app screens in React Router: `/sign-in`, `/display-name`, `/lobby`, `/profile`
  - Match states (`joining`, `in_match`, `match_end`) remain as overlays
  - Page load: check `hasSessionToken()` → if yes, `fetchPlayerMe(token)` → valid → navigate to `/lobby`, else `/sign-in`
  - Guest flow: "Play as Guest" from `/sign-in` → shows `join_form` overlay (existing flow)
- **Decision satisfied:** D7, D10, D14

Run test suite. All tests pass.

#### Refactor

- Extract shared stat card component (`StatCard.tsx`) reused between Lobby and Profile
- Extract `HexagonBadge.tsx` component for level display
- Extract `XpProgressBar.tsx` component

---

### Slice 8: Integration Tests + Final Wiring

**Slice type:** Spec-driven (test-index.md) + decision-driven (D13)

#### Green — Wire existing integration test infrastructure

- **Source file:** `stick-rumble-server/internal/auth/handler_integration_test.go` (ensure all TS-ACCT tests exist)
- **Source file:** `stick-rumble-server/internal/db/session_repo_test.go` (ensure all session tests exist)
- **Source file:** `stick-rumble-server/internal/network/websocket_handler_token_test.go` (ensure all WS token tests exist)
- **Source file:** `stick-rumble-server/internal/auth/stats_processor_test.go` (ensure all TS-PROG tests exist)
- **Decision satisfied:** D13

Run `make test-integration`. All tests pass.

#### Refactor

None needed.

---

## Verification

### Local verification sequence

1. `make test-client` — all client unit tests (Plumbing + Screens + Toast)
2. `make test-server` — all server unit tests (Progression + Room + Network)
3. `make test-integration` — server integration tests (Auth + DB + Stats + WS Token)
4. `make lint` — Go vet + ESLint
5. `make typecheck` — TypeScript type checking

### Subagent verification passes

#### Test verifier pass 1

Use `test-quality-verifier` on:
- `stick-rumble-server/internal/game/progression_test.go`
- `stick-rumble-server/internal/auth/handler_test.go`
- `stick-rumble-server/internal/auth/handler_integration_test.go`

Prompt focus:

`Review the progression and auth tests for vague assertions. Focus on: (1) Are the level boundary tests at 0, 499, 500, 1500, 3200 correct? (2) Does the auth handler integration test actually verify DB state after the HTTP call, or just the HTTP response? (3) Are there missing test cases for parallel session tokens (same account, two devices)?`

#### Test verifier pass 2

Use `test-quality-verifier` on:
- `stick-rumble-client/src/ui/lobby/LobbyScreen.test.tsx`
- `stick-rumble-client/src/ui/profile/ProfileScreen.test.tsx`
- `stick-rumble-client/src/game/entities/LevelUpToast.test.ts`

Prompt focus:

`Review the lobby, profile, and level-up toast tests. Focus on: (1) Does the lobby test verify that GET /api/player/me is called on mount? (2) Does the XP bar test verify correct width at boundary values (0%, 50%, 100%)? (3) Does the toast test verify idempotency and auto-dismiss timing?`

#### Pre-mortem pass

Use a generic/default subagent for a pre-mortem review.

Prompt focus:

`Perform a pre-mortem on the accounts and progression feature. Assume the code passes all tests but still ships a bad experience. Find the most likely failure modes around: (1) Session token race — user opens two tabs, gets two valid tokens for the same account. What breaks? (2) Guest plays a match, then signs in during the match. What happens when ProcessMatchEndStats runs? (3) Google API rate-limiting — what if many users sign in simultaneously? (4) Database connection drops in the middle of ProcessMatchEndStats — is the transaction handling correct? (5) Lobby data is stale — GET /api/player/me returns data from 5 minutes ago because the DB write from ProcessMatchEndStats hasn't replicated yet.`

---

## Acceptance Criteria

1. First-time Google OAuth authentication creates a player record + lifetime stats row + session token in the database
2. Returning Google OAuth authentication updates `last_seen_at` and returns the existing player record
3. A valid session token passed as `?token=` query parameter on WebSocket upgrade authenticates the player, sets `AccountID` and `IsAuthed`, and uses the DB-authoritative display name
4. An expired or invalid session token causes the WebSocket upgrade to fall back to guest behavior
5. `POST /api/auth/google` returns 401 for invalid Google tokens and 503 when Google's API is unreachable
6. `PUT /api/player/displayname` updates the player's display name and returns the sanitized name
7. `GET /api/player/me` returns player info + lifetime stats + computed level for a valid bearer token
8. `GET /api/player/me` returns 401 for missing or invalid bearer tokens
9. Pure functions `xpForLevel(N) = N * 500` and `levelForXp(totalXp)` compute correctly for all boundary values
10. `ProcessMatchEndStats` accumulates lifetime stats across matches for authed players and skips guests
11. Guest post-match flow returns to `join_form` — no retroactive XP on sign-in
12. Sign-In screen renders Google OAuth button + "Play as Guest" link
13. Lobby screen renders player level, XP bar, stats cluster, avatar, room code, and Play/Profile/Sign-Out actions
14. Profile screen renders all lifetime stats + per-weapon kills breakdown
15. Level-Up toast appears in lobby after match-end stat processing and auto-dismisses after 3 seconds
16. CSS custom properties drive the gold/dark design language across all new screens
17. All quality gates pass: `make lint && make typecheck && make test && make test-integration`

---

## Implementation Checklist

- [ ] **Slice 0: Docker Compose + PostgreSQL Migrations**
  - [ ] Create `docker-compose.yml` (PostgreSQL + server)
  - [ ] Create `docker-compose.test.yml` (PostgreSQL only)
  - [ ] Create `internal/migrations/001_create_players.sql`
  - [ ] Create `internal/migrations/002_create_session_tokens.sql`
  - [ ] Create `internal/migrations/003_create_lifetime_stats.sql`
  - [ ] Create `internal/db/postgres.go` (connection pool)
  - [ ] Create `internal/db/migrate.go` (migration runner)
  - [ ] Verify: `docker compose up` starts and migrations apply

- [ ] **Slice 1: Progression Pure Functions + Config**
  - [ ] RED — Write `progression_test.go` with level boundary assertions
  - [ ] RED — Run test suite, observe failure
  - [ ] GREEN — Create `progression.go` with `xpForLevel` + `levelForXp`
  - [ ] GREEN — Add `DatabaseURL`, `GoogleClientID`, `SessionTokenExpiryDays` to `RuntimeConfig`
  - [ ] GREEN — Run test suite, observe pass
  - [ ] REFACTOR — None needed

- [ ] **Slice 2: Player Struct + Session Token Resolver**
  - [ ] RED — Write room_test.go for `Player` identity fields
  - [ ] RED — Write session_repo_test.go (integration-tagged)
  - [ ] RED — Run test suite, observe failure
  - [ ] GREEN — Add `AccountID *string`, `IsAuthed bool` to `game.Player`
  - [ ] GREEN — Add `NewPlayerWithAccount` constructor
  - [ ] GREEN — Create `db/session_repo.go` (Generate, Hash, Create, Find)
  - [ ] GREEN — Run test suite, observe pass
  - [ ] REFACTOR — Extract `db/token.go` for shared helpers

- [ ] **Slice 3: Auth HTTP Endpoints + WS Upgrade Flow**
  - [ ] RED — Write `auth/handler_test.go` (display name sanitization, bear token, etc.)
  - [ ] RED — Write `auth/handler_integration_test.go` (full HTTP endpoint tests, integration-tagged)
  - [ ] RED — Write `network/websocket_handler_token_test.go` (WS upgrade flow, integration-tagged)
  - [ ] RED — Run test suite, observe failure
  - [ ] GREEN — Create `auth/handler.go` (HandleGoogleSignIn, HandleSetDisplayName, HandleGetPlayerInfo, ResolveSessionToken, sanitizeDisplayName, parseBearerToken)
  - [ ] GREEN — Create `db/player_repo.go` (FindByGoogleSub, Create, UpdateDisplayName, UpdateLastSeen)
  - [ ] GREEN — Create `db/stats_repo.go` (GetByPlayerID, Save, CreateForPlayer)
  - [ ] GREEN — Modify `websocket_handler.go`: parse `?token=`, resolve identity, defer enrollment, ignore client displayName for authed `player:hello`
  - [ ] GREEN — Modify `main.go`: register HTTP routes, initialize AuthHandler
  - [ ] GREEN — Run test suite, observe pass
  - [ ] REFACTOR — Extract shared sanitizer to `game/sanitize.go`, add AuthHandler to WebSocketHandler

- [ ] **Slice 4: PlayerState AccountID + Match-End Stats**
  - [ ] RED — Write `player_state_account_test.go` (AccountID on PlayerState, not in JSON)
  - [ ] RED — Write `auth/stats_processor_test.go` (ProcessMatchEndStats integration)
  - [ ] RED — Write `network/broadcast_scores_test.go` (public DTO strips AccountID)
  - [ ] RED — Run test suite, observe failure
  - [ ] GREEN — Add `AccountID *string json:"-"` to `PlayerState`
  - [ ] GREEN — Modify `GameServer.AddPlayer` to copy AccountID to PlayerState
  - [ ] GREEN — Add `AccountID *string` to internal `PlayerScore`
  - [ ] GREEN — Create `auth/stats_processor.go` with `ProcessMatchEndStats`
  - [ ] GREEN — Add `publicPlayerScore` DTO in `network/publication.go`
  - [ ] GREEN — Modify `broadcastMatchEndedEvent` to call `ProcessMatchEndStats`
  - [ ] GREEN — Run test suite, observe pass
  - [ ] REFACTOR — Wrap StatsStore calls in DB transaction

- [ ] **Slice 5: Client Plumbing**
  - [ ] RED — Write `sessionToken.test.ts` (localStorage CRUD)
  - [ ] RED — Write `playerApi.test.ts` (fetch GET /api/player/me)
  - [ ] RED — Modify `WebSocketClient.test.ts` (token param in URL)
  - [ ] RED — Modify `sessionFlow.test.ts` (new AppViewState values)
  - [ ] RED — Run test suite, observe failure
  - [ ] GREEN — Create `sessionToken.ts` (store, get, clear, has)
  - [ ] GREEN — Create `playerApi.ts` (fetchPlayerMe)
  - [ ] GREEN — Modify `WebSocketClient.ts` (accept token, pass as `?token=`)
  - [ ] GREEN — Modify `sessionFlow.ts` (add new states)
  - [ ] GREEN — Modify `shared/types.ts` (PlayerInfo, LifetimeStats, MatchSession.accountId)
  - [ ] GREEN — Modify `shared/constants.ts` (SESSION_TOKEN_KEY, API_BASE_URL)
  - [ ] GREEN — Run test suite, observe pass
  - [ ] REFACTOR — Extract `getApiBaseUrl()` to `runtimeConfig.ts`

- [ ] **Slice 6: SignInScreen + DisplayNamePickerScreen**
  - [ ] RED — Write `SignInScreen.test.tsx` (render, Google button, Guest click)
  - [ ] RED — Write `DisplayNamePickerScreen.test.tsx` (validation, submit)
  - [ ] RED — Run test suite, observe failure
  - [ ] GREEN — Create `SignInScreen.tsx` (Google OAuth popup, guest fallback, token storage)
  - [ ] GREEN — Create `DisplayNamePickerScreen.tsx` (input, validation, PUT request)
  - [ ] GREEN — Create `AuthStyles.css`
  - [ ] GREEN — Run test suite, observe pass
  - [ ] REFACTOR — Extract `useApiClient` hook

- [ ] **Slice 7: LobbyScreen + ProfileScreen + LevelUpToast + Design Language**
  - [ ] RED — Write `LobbyScreen.test.tsx` (level, stats, avatar, buttons, XP bar, room code, toast)
  - [ ] RED — Write `ProfileScreen.test.tsx` (stats, per-weapon, back button)
  - [ ] RED — Write `LevelUpToast.test.ts` (show, idempotent, auto-dismiss)
  - [ ] RED — Run test suite, observe failure
  - [ ] GREEN — Create `LobbyScreen.tsx` (full screen with all sections)
  - [ ] GREEN — Create `ProfileScreen.tsx` (stats grid, weapon breakdown)
  - [ ] GREEN — Modify `LevelUpToast.ts` (Phaser overlay with animation)
  - [ ] GREEN — Add CSS custom properties to `index.css`
  - [ ] GREEN — Modify `App.tsx` (React Router, page load flow, screen routing)
  - [ ] GREEN — Run test suite, observe pass
  - [ ] REFACTOR — Extract `StatCard.tsx`, `HexagonBadge.tsx`, `XpProgressBar.tsx`

- [ ] **Slice 8: Integration Tests + Final Wiring**
  - [ ] Ensure all TS-ACCT-001 through TS-ACCT-010 tests exist in integration test files
  - [ ] Ensure all TS-PROG-001 through TS-PROG-005 tests exist
  - [ ] Run `make test-integration` — all pass
  - [ ] Run `make lint` — zero errors
  - [ ] Run `make typecheck` — zero errors

- [ ] **Verification Passes**
  - [ ] Run test-quality-verifier on progression + auth tests
  - [ ] Run test-quality-verifier on lobby + profile + toast tests
  - [ ] Run pre-mortem subagent review
  - [ ] Address all findings from verification passes

---

## References

### Spec Files
- `specs/accounts.md` (v1.0.1)
- `specs/client-architecture.md` (v1.6.0)
- `specs/messages.md` (v1.5.2)
- `specs/networking.md` (v1.3.2)
- `specs/progression.md` (v1.0.1)
- `specs/rooms.md` (v1.5.1)
- `specs/server-architecture.md` (v1.3.2)
- `specs/ui.md` (v2.8.0)
- `specs/test-index.md` (v1.4.2)

### Source Files (to be modified)
- `stick-rumble-server/cmd/server/main.go`
- `stick-rumble-server/internal/config/runtime.go`
- `stick-rumble-server/internal/game/room.go`
- `stick-rumble-server/internal/game/player.go`
- `stick-rumble-server/internal/game/gameserver.go`
- `stick-rumble-server/internal/game/match.go`
- `stick-rumble-server/internal/network/websocket_handler.go`
- `stick-rumble-server/internal/network/publication.go`
- `stick-rumble-server/internal/network/broadcast_helper.go`
- `stick-rumble-client/src/App.tsx`
- `stick-rumble-client/src/game/network/WebSocketClient.ts`
- `stick-rumble-client/src/game/sessionFlow.ts`
- `stick-rumble-client/src/shared/types.ts`
- `stick-rumble-client/src/shared/constants.ts`
- `stick-rumble-client/src/index.css`
- `stick-rumble-client/src/game/entities/LevelUpToast.ts`

### Source Files (to be created)
- `docker-compose.yml`
- `docker-compose.test.yml`
- `stick-rumble-server/internal/migrations/001_create_players.sql`
- `stick-rumble-server/internal/migrations/002_create_session_tokens.sql`
- `stick-rumble-server/internal/migrations/003_create_lifetime_stats.sql`
- `stick-rumble-server/internal/db/postgres.go`
- `stick-rumble-server/internal/db/migrate.go`
- `stick-rumble-server/internal/db/token.go`
- `stick-rumble-server/internal/db/player_repo.go`
- `stick-rumble-server/internal/db/session_repo.go`
- `stick-rumble-server/internal/db/stats_repo.go`
- `stick-rumble-server/internal/auth/handler.go`
- `stick-rumble-server/internal/auth/stats_processor.go`
- `stick-rumble-server/internal/game/progression.go`
- `stick-rumble-server/internal/game/sanitize.go`
- `stick-rumble-client/src/game/network/sessionToken.ts`
- `stick-rumble-client/src/game/network/playerApi.ts`
- `stick-rumble-client/src/ui/auth/SignInScreen.tsx`
- `stick-rumble-client/src/ui/auth/DisplayNamePickerScreen.tsx`
- `stick-rumble-client/src/ui/auth/AuthStyles.css`
- `stick-rumble-client/src/ui/lobby/LobbyScreen.tsx`
- `stick-rumble-client/src/ui/profile/ProfileScreen.tsx`
- `stick-rumble-client/src/ui/common/StatCard.tsx`
- `stick-rumble-client/src/ui/common/HexagonBadge.tsx`
- `stick-rumble-client/src/ui/common/XpProgressBar.tsx`

### Test Files (to be created or modified)
- `stick-rumble-server/internal/game/progression_test.go`
- `stick-rumble-server/internal/game/room_test.go` (modify)
- `stick-rumble-server/internal/game/player_state_account_test.go`
- `stick-rumble-server/internal/db/session_repo_test.go`
- `stick-rumble-server/internal/auth/handler_test.go`
- `stick-rumble-server/internal/auth/handler_integration_test.go`
- `stick-rumble-server/internal/auth/stats_processor_test.go`
- `stick-rumble-server/internal/network/websocket_handler_token_test.go`
- `stick-rumble-server/internal/network/broadcast_scores_test.go`
- `stick-rumble-client/src/game/network/sessionToken.test.ts`
- `stick-rumble-client/src/game/network/playerApi.test.ts`
- `stick-rumble-client/src/game/network/WebSocketClient.test.ts` (modify)
- `stick-rumble-client/src/game/sessionFlow.test.ts` (modify)
- `stick-rumble-client/src/ui/auth/SignInScreen.test.tsx`
- `stick-rumble-client/src/ui/auth/DisplayNamePickerScreen.test.tsx`
- `stick-rumble-client/src/ui/lobby/LobbyScreen.test.tsx`
- `stick-rumble-client/src/ui/profile/ProfileScreen.test.tsx`
- `stick-rumble-client/src/game/entities/LevelUpToast.test.ts`
