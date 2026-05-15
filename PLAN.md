# Plan: Wire Auth Screens + CSS Design Language

Sage-approved after 5 review rounds. 24 issues identified and resolved.

---

## Goal

Wire up React Router, integrate four existing auth screen components (SignIn, DisplayNamePicker, Lobby, Profile), adopt the CSS design language, and handle the authed vs guest match-end split.

## Architecture — Two-Mode App.tsx

**authMode** — HashRouter renders auth/progress screens. No Phaser, no match shell, no WebSocket.

Route guards using `authState: { status: 'loading' | 'authenticated' | 'unauthenticated', token?: string, player?: PlayerInfo, error?: string }`:
- `/sign-in` → SignInScreen. Redirects authed+name users to /lobby
- `/display-name` → DisplayNamePickerScreen. Requires valid token + needsDisplayName, else /sign-in
- `/lobby` → LobbyScreen. Requires auth + display name, else redirect
- `/profile` → ProfileScreen. Requires auth + display name, else redirect
- `/play` → enters matchMode. Passes token if authed, otherwise guest. Loading state shows spinner/retry
- `*` → redirect to /sign-in

**matchMode** — `<MatchShell>` component extracted from current App.tsx. Props: `{ sessionToken?: string, isAuthed: boolean, onExitToLobby: () => void }`.

- Calls `useMatchAppShell({ sessionToken, isAuthed })` internally
- Match-end close: authed → `onExitToLobby`, guest → `shell.actions.returnToJoinForm()`
- App.tsx never calls `useMatchAppShell` — only MatchShell does, and only in matchMode
- WebSocket is constructed with `?token=<session>` for authed, no query param for guests

**Auth state hydration flow:**

```
page load
  ├─ no token → authState = { status: 'unauthenticated' }
  ├─ has token → fetchPlayerMe(token)
  │    ├─ unauthorized (401) → clearSessionToken() → authState = { status: 'unauthenticated' }
  │    ├─ server error / network → keep token → authState = { status: 'loading', error }
  │    └─ ok → authState = { status: 'authenticated', token, player }
  │         ├─ player.needsDisplayName → redirect /display-name
  │         └─ player has display name → guard redirects handled per-route

Google sign-in (from SignInScreen):
  client: POST /api/auth/google → { token, needsDisplayName }
  → onAuthenticated({ token, needsDisplayName })
  → storeSessionToken(token)
  → fetchPlayerMe(token) → update authState
  → needsDisplayName ? /display-name : /lobby

Display-name confirm (from DisplayNamePickerScreen):
  client: PUT /api/player/displayname → { displayName }
  → onConfirm()
  → fetchPlayerMe(token) → update authState
  → /lobby
```

---

## Slice 0: Update Specs

**Files:**
- Modify: `specs/client-architecture.md` — add route table (HashRouter paths), page-load auth validation flow, two-mode App architecture, MatchShell extraction, `needsDisplayName` on auth response
- Modify: `specs/ui.md` — document lobby/profile CSS file responsibilities, confirm gold/dark color scheme with token values
- Modify: `specs/accounts.md` — clarify match-end redirect: authed → lobby, guest → join_form, document `needsDisplayName` field on auth response

No RED tests.

---

## Slice 1: HashRouter + Auth Routes + Page-Load Check + API Refactor

**Risk:** standard<br>
**Reviews:** test, design<br>
**Depends on:** slice 0

### Files
- Modify: `stick-rumble-client/src/main.tsx` — wrap `<App />` in `<HashRouter>`
- Modify: `stick-rumble-client/package.json` + `package-lock.json` — add `react-router-dom`
- Create: `stick-rumble-client/src/ui/auth/routes.tsx` — route config exported for testability
- Modify: `stick-rumble-client/src/game/network/playerApi.ts` — refactor `fetchPlayerMe` to return discriminated union
- Modify: `stick-rumble-client/src/ui/auth/SignInScreen.tsx` — replace `window.location.hash` with `useNavigate()`, add `onAuthenticated` callback prop
- Modify: `stick-rumble-client/src/ui/auth/DisplayNamePickerScreen.tsx` — `onConfirm(displayName: string)` → App refreshes authState, navigates
- Modify: `stick-rumble-client/src/ui/lobby/LobbyScreen.tsx` — add profile navigation button
- Read/Modify: `stick-rumble-client/src/ui/profile/ProfileScreen.tsx` — refactor to use centralized authState
- Modify: `stick-rumble-client/src/App.tsx` — two-mode, authState, route guards, page-load check

### RED — AppRouter.test.tsx (~18 tests)

1. `/sign-in` renders SignInScreen
2. `/lobby` with valid token + display name renders LobbyScreen
3. `/lobby` without token redirects to /sign-in
4. `/lobby` with token + needsDisplayName redirects to /display-name
5. `/profile` without token redirects to /sign-in
6. `/profile` with valid token renders ProfileScreen
7. `/display-name` without token redirects to /sign-in
8. `/display-name` with token + has display name redirects to /lobby
9. Stored token + `fetchPlayerMe` unauthorized → clear token, authState = unauthenticated, /sign-in
10. Stored token + `fetchPlayerMe` server error → token kept, authState = loading with error
11. Stored token + `fetchPlayerMe` network error → token kept, authState = loading with error
12. Auth routes do NOT instantiate gameplay WebSocket (mock WebSocket)
13. `/play` + pending auth → loading/retry UI, no guest WebSocket (match-mode assertion in Slice 2)
14. SignInScreen `onAuthenticated` called with `{ token, needsDisplayName }`
15. App stores token and calls `fetchPlayerMe` after `onAuthenticated`, updates authState
16. DisplayNamePickerScreen `onConfirm` → App refreshes authState, navigates to /lobby
17. Lobby profile button navigates to /profile
18. Sign-out → `clearSessionToken()`, authState = unauthenticated, navigates to /sign-in
19. Unknown route → redirect to /sign-in
20. Authed user visiting /sign-in → redirected to /lobby

### GREEN — Implement

- `HashRouter` in `main.tsx`
- Two-mode App.tsx with `authState`, route guards, page-load auth check
- Route config in `routes.tsx`
- `playerApi.ts` discriminated result (remove internal `clearSessionToken`)
- `SignInScreen` with `onAuthenticated` callback, no hash nav
- `DisplayNamePickerScreen` with `onConfirm` → App refreshes + navigates
- `LobbyScreen` profile button
- `ProfileScreen` using centralized authState

---

## Slice 2: Extract MatchShell + Wire Auth→Match Transition + Token Propagation

**Risk:** standard<br>
**Reviews:** test, quality<br>
**Depends on:** slice 1

### Files
- Create: `stick-rumble-client/src/ui/match/MatchShell.tsx` — extracted match rendering component
- Modify: `stick-rumble-client/src/App.tsx` — render `<MatchShell>` only in matchMode
- Modify: `stick-rumble-client/src/game/useMatchAppShell.ts` — accept optional `sessionToken` param, pass to `WebSocketClient`
- Modify: `stick-rumble-client/src/game/network/WebSocketClient.ts` — ensure `connect()` appends `?token=` when sessionToken present
- Modify: `stick-rumble-client/src/ui/lobby/LobbyScreen.tsx` — Play Public → enters matchMode with token
- Modify: `stick-rumble-client/src/ui/auth/SignInScreen.tsx` — Play as Guest → navigates to `/play` → enters matchMode without token

### MatchShell component

```tsx
interface MatchShellProps {
  sessionToken?: string
  isAuthed: boolean
  onExitToLobby: () => void
}

function MatchShell({ sessionToken, isAuthed, onExitToLobby }: MatchShellProps) {
  const shell = useMatchAppShell({ sessionToken, isAuthed })
  // renders: game-frame, PhaserGame, MobileControls, RotateDeviceGate,
  //          overlay cards (join_form, searching, waiting, etc.),
  //          MatchEndScreen, DebugNetworkPanel

  return (
    <div className={`app-shell${...}`}>
      {/* app-header hidden in matchMode */}
      <div className="app-container">
        {/* game-frame, PhaserGame, overlays — same as today */}
        {shell.viewState === 'match_end' && shell.matchEndData && (
          <MatchEndScreen
            matchData={shell.matchEndData}
            localPlayerId={shell.localPlayerId}
            onClose={isAuthed ? onExitToLobby : shell.actions.returnToJoinForm}
            onPlayAgain={shell.actions.playAgain}
          />
        )}
      </div>
      <DebugNetworkPanel ... />
    </div>
  )
}
```

### RED — App.test.tsx (~5 tests)

1. Play Public from Lobby → App enters matchMode → MatchShell renders join_form overlay
2. Play as Guest → navigates to `/play` → matchMode → MatchShell renders join_form
3. MatchShell mounts fresh → WebSocketClient constructed with encoded token (authed) or no token (guest)
4. Match end (authed) → MatchEndScreen close → `onExitToLobby` → App exits matchMode → renders `/lobby`
5. Match end (guest) → MatchEndScreen close → `returnToJoinForm()` → stays in matchMode, join_form

### GREEN — Implement

- `MatchShell.tsx` component (extract from current App.tsx match rendering)
- `App.tsx` matchMode rendering + mode transitions
- `useMatchAppShell` token param + WebSocketClient plumbing
- Lobby/SignIn play action wiring

---

## Slice 3: CSS Design Token Adoption (Colors + Typography Only)

**Risk:** routine<br>
**Reviews:** test, design<br>
**Depends on:** none (parallel with slices 1-2)

### Files
- Modify: `stick-rumble-client/src/index.css` — fill empty token values (`--font-heading`, `--font-body`, `--spacing-card`)
- Modify: `stick-rumble-client/src/App.css` — replace ONLY colors/typography with `var(--color-*)`
- Modify: `stick-rumble-client/src/ui/auth/AuthStyles.css` — refactor to use `var(--color-*)`
- Create: `stick-rumble-client/src/ui/lobby/LobbyStyles.css` — gold/dark lobby screen styling
- Create: `stick-rumble-client/src/ui/profile/ProfileStyles.css` — gold/dark profile screen styling
- Modify: `stick-rumble-client/src/ui/lobby/LobbyScreen.tsx` — import LobbyStyles.css
- Modify: `stick-rumble-client/src/ui/profile/ProfileScreen.tsx` — import ProfileStyles.css

### App.css replacement table

| Hardcoded | Replace with |
|-----------|-------------|
| `#16181c` / `#0d0f12` body gradient | `var(--color-bg-primary)` |
| `#f3efe3` text | `var(--color-text-primary)` |
| `#c6bca4` labels | `var(--color-text-secondary)` |
| `#e3a84e` buttons/thumb | `var(--color-accent-primary)` |
| `rgba(13,15,18,0.92)` card bg | `var(--color-bg-surface)` |
| `1px solid rgba(255,235,188,0.18)` card border | `var(--color-accent-primary)` with ~0.2 opacity |
| `0.4rem` / `0.75rem` gaps | `var(--spacing-sm)` / `var(--spacing-md)` |
| `14px` / `16px` / `10px` radii | `var(--border-radius-lg)` / `var(--border-radius)` |
| `#ff9074` error | `var(--color-error)` |
| h1 solid white | `background: linear-gradient(135deg, var(--color-accent-primary), var(--color-accent-secondary)); -webkit-background-clip: text; -webkit-text-fill-color: transparent;` |

**Constraint:** Do NOT touch layout/dimension properties in `game-frame`, `mobile-controls`, or `rotate-device-gate` sections. Only color, typography, border-color, accent.

No RED tests.

---

## Slice 4: Hover/Focus States

**Risk:** routine<br>
**Reviews:** design<br>
**Depends on:** slice 3

### Files
- Modify: `stick-rumble-client/src/App.css` — `:hover` (`filter: brightness(1.1)`) and `:focus-visible` (gold outline) on overlay buttons
- Modify: `stick-rumble-client/src/ui/auth/AuthStyles.css` — same hover/focus states
- Modify: `stick-rumble-client/src/ui/lobby/LobbyStyles.css` — button states
- Modify: `stick-rumble-client/src/ui/profile/ProfileStyles.css` — button states

No RED tests.

---

## Slice 5: Integration Verification

**Risk:** routine<br>
**Reviews:** test<br>
**Depends on:** slices 1-4

```bash
make lint && make typecheck
make test-client
```

**Playwright walkthrough:**
```
playwright-cli goto http://localhost:5173          # → /sign-in
playwright-cli goto http://localhost:5173/lobby    # → redirect /sign-in (no token)
playwright-cli click "Play as Guest"               # → /play → matchMode, join_form overlay
playwright-cli goto http://localhost:5173/sign-in  # → SignInScreen
```

---

## Implementation Checklist

### Slice 0: Update Specs
- [ ] Update `specs/client-architecture.md` with route table, two-mode architecture, MatchShell
- [ ] Update `specs/ui.md` with lobby/profile CSS, gold/dark token values
- [ ] Update `specs/accounts.md` with match-end split, needsDisplayName

### Slice 1: HashRouter + Auth Routes + Page-Load Check + API Refactor
- [ ] RED — Write AppRouter.test.tsx with ~18 tests
- [ ] RED — Run `npm test`, observe failure
- [ ] GREEN — Add `react-router-dom` to package.json + lock file
- [ ] GREEN — Wrap App in HashRouter in main.tsx
- [ ] GREEN — Create routes.tsx with route config
- [ ] GREEN — Refactor playerApi.ts to return FetchPlayerMeResult discriminated union
- [ ] GREEN — Refactor SignInScreen: onAuthenticated callback, remove hash nav
- [ ] GREEN — Refactor DisplayNamePickerScreen: onConfirm → App refreshes
- [ ] GREEN — Refactor LobbyScreen: add profile button
- [ ] GREEN — Refactor ProfileScreen: use centralized authState
- [ ] GREEN — Implement App.tsx two-mode, authState, route guards, page-load check
- [ ] GREEN — Run `npm test`, observe pass

### Slice 2: Extract MatchShell + Wire Transitions + Token
- [ ] RED — Write App.test.tsx with ~5 tests
- [ ] RED — Run `npm test`, observe failure
- [ ] GREEN — Create MatchShell.tsx
- [ ] GREEN — Modify App.tsx: render MatchShell in matchMode
- [ ] GREEN — Modify useMatchAppShell: accept sessionToken, pass to WebSocketClient
- [ ] GREEN — Modify WebSocketClient: ensure `?token=` in connect()
- [ ] GREEN — Wire LobbyScreen Play Public → matchMode with token
- [ ] GREEN — Wire SignInScreen Play as Guest → /play → matchMode
- [ ] GREEN — Run `npm test`, observe pass

### Slice 3: CSS Design Tokens
- [ ] Fill empty token values in index.css
- [ ] Replace colors/typography in App.css with var(--color-*)
- [ ] Refactor AuthStyles.css to use design tokens
- [ ] Create LobbyStyles.css with gold/dark styling
- [ ] Create ProfileStyles.css with gold/dark styling
- [ ] Import new CSS files in LobbyScreen.tsx, ProfileScreen.tsx

### Slice 4: Hover/Focus States
- [ ] Add :hover and :focus-visible to all button elements
- [ ] Ensure consistent focus ring using var(--color-accent-primary)

### Slice 5: Integration Verification
- [ ] Run `make lint`
- [ ] Run `make typecheck`
- [ ] Run `make test-client`
- [ ] Playwright walkthrough of all routes
