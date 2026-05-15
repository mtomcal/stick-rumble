# Accounts System

> **Spec Version**: 1.0.1
> **Last Updated**: 2026-05-15
> **Depends On**: [constants.md](constants.md), [server-architecture.md](server-architecture.md), [rooms.md](rooms.md)
> **Depended By**: [progression.md](progression.md), [client-architecture.md](client-architecture.md), [networking.md](networking.md)

---

## Overview

The accounts system provides persistent player identity, session management, and lifetime statistics via Google OAuth-only authentication. There are no passwords — Google is the sole identity provider. Guest play (no account) is preserved as the default entry path for casual players.

**Why Google OAuth-only?** Eliminates password management, password resets, and account security surface area. Google's token verification API validates the user's identity on the server side, so the server never sees or stores a password. The trade-off is that players without a Google account cannot sign in, but guest play remains fully functional without any account.

**Why long-lived session tokens instead of OAuth on every request?** The OAuth token is used exactly once during the initial sign-in handshake (a `POST` to `/api/auth/google`). The server issues its own opaque 256-bit session token that the client stores in `localStorage`. On subsequent page loads, the client presents this token to the WebSocket server (via `?token=` query parameter) for identity resolution. This avoids repeated OAuth round-trips on every page load and every WebSocket reconnect.

---

## Dependencies

### Technology Dependencies

| Technology | Version | Purpose |
|------------|---------|---------|
| Go | 1.25 | Server-side auth handling |
| PostgreSQL | 15+ | Persistent storage for players, sessions, stats |
| Google OAuth2 API | - | Token validation |
| TypeScript | 5.9.3 | Client-side auth UI and token management |

### Spec Dependencies

- [constants.md](constants.md) - Auth constants (token expiry, token bytes, validation URL)
- [server-architecture.md](server-architecture.md) - AuthHandler, StatsStore, HTTP endpoints
- [rooms.md](rooms.md) - Display name sanitization rules
- [progression.md](progression.md) - Lifetime stats accumulation

---

## Constants

All auth constants are defined in [constants.md](constants.md#auth-constants).

| Constant | Value | Description |
|----------|-------|-------------|
| SESSION_TOKEN_EXPIRY_DAYS | 30 | Session token lifetime |
| SESSION_TOKEN_BYTES | 32 | 256-bit random bytes encoded as a base64url session token with no padding |
| GOOGLE_TOKEN_VALIDATION_URL | `https://oauth2.googleapis.com/tokeninfo?id_token=` | Google ID token validation endpoint |

---

## Data Structures

### PlayerRecord

Persistent player identity stored in PostgreSQL.

**Why `google_sub` as the unique identity key?** Google's `sub` claim is a stable, per-user, per-application identifier that never changes. Using `display_name` as the identity key would break when a player changes their name. Using `player_id` (UUID) as the primary key allows the system to reference players without coupling to either Google's identifier or the player's display name.

**Go:**
```go
type PlayerRecord struct {
    PlayerID    string     `db:"player_id"`     // UUID primary key
    GoogleSub   string     `db:"google_sub"`    // Google's stable user ID (unique)
    DisplayName *string    `db:"display_name"`   // null until first login name picker
    AvatarURL   *string    `db:"avatar_url"`     // null if Google profile has no picture
    CreatedAt   time.Time  `db:"created_at"`
    LastSeenAt  time.Time  `db:"last_seen_at"`
}
```

### SessionToken

Persistent session token stored in PostgreSQL.

**Why SHA-256 of the encoded session token?** The server never stores the raw bearer token string. It generates 256-bit random bytes, encodes them as base64url with no padding, and stores only the SHA-256 hash of that encoded string. If the database is compromised, attackers cannot impersonate active sessions because they would need to reverse the SHA-256 hash.

**Go:**
```go
type SessionToken struct {
    TokenHash string    `db:"token_hash"`  // SHA-256 of base64url session token string (primary key)
    PlayerID  string    `db:"player_id"`   // FK to players
    ExpiresAt time.Time `db:"expires_at"`
    CreatedAt time.Time `db:"created_at"`
}
```

### LifetimeStats

Persistent lifetime statistics stored in PostgreSQL.

**Why separate from PlayerRecord?** Player identity and stats have different access patterns. Stats are updated on every match end (write-heavy). Player identity is read on every WebSocket upgrade (read-heavy). Keeping them in separate tables avoids lock contention and allows independent tuning.

**Go:**
```go
type LifetimeStats struct {
    PlayerID       string         `db:"player_id"`        // PK/FK to players
    TotalKills     int            `db:"total_kills"`      // lifetime kills
    TotalDeaths    int            `db:"total_deaths"`     // lifetime deaths
    TotalXP        int            `db:"total_xp"`         // lifetime XP
    TotalGames     int            `db:"total_games"`      // matches played
    TotalWins      int            `db:"total_wins"`       // matches won
    PerWeaponKills map[string]int `db:"per_weapon_kills"` // JSONB: {"pistol": 15, "ak47": 42}
    UpdatedAt      time.Time      `db:"updated_at"`
}
```

---

## Behavior

### Sign-In Flow (Google OAuth)

**Pseudocode:**
```
function googleSignIn(googleIdToken):
    // 1. Server validates token with Google
    googleClaims = validateWithGoogle(googleIdToken)
    if googleClaims == null:
        return { error: "invalid_token", status: 401 }

    // 2. Look up or create player record
    player = findPlayerByGoogleSub(googleClaims.sub)
    if player == null:
        player = createPlayer(
            playerId: generateUUID(),
            googleSub: googleClaims.sub,
            displayName: null,  // first login, name picker required
            avatarUrl: googleClaims.picture or null
        )
        createLifetimeStats(player.playerId)
        log "Created new player: {player.playerId}"
    else:
        updateLastSeenAt(player.playerId)

    // 3. Generate session token
    rawTokenBytes = generateRandomBytes(32)  // 256-bit
    sessionToken = base64urlNoPadding(rawTokenBytes)
    tokenHash = sha256(sessionToken)
    expiresAt = now() + 30 days

    storeSessionToken(tokenHash, player.playerId, expiresAt)

    // 4. Return session info to client
    hasDisplayName = player.displayName != null

    return {
        sessionToken: sessionToken,
        expiresAt: expiresAt.epochMs,
        player: {
            playerId: player.playerId,
            displayName: player.displayName or null,
            avatarUrl: player.avatarUrl or null,
            createdAt: player.createdAt.epochMs
        }
    }
```

**Go:**
```go
func (h *AuthHandler) HandleGoogleSignIn(googleIDToken string) (*SignInResponse, error) {
    // Validate Google token
    claims, err := h.validateGoogleToken(googleIDToken)
    if err != nil {
        return nil, ErrInvalidToken
    }

    // Look up or create player
    player, err := h.playerStore.FindByGoogleSub(claims.Sub)
    if err == ErrPlayerNotFound {
        player = &PlayerRecord{
            PlayerID:  uuid.New().String(),
            GoogleSub: claims.Sub,
            AvatarURL: claims.Picture,
        }
        if err := h.playerStore.Create(player); err != nil {
            return nil, err
        }
        if err := h.statsStore.CreateForPlayer(player.PlayerID); err != nil {
            return nil, err
        }
    } else if err != nil {
        return nil, err
    } else {
        h.playerStore.UpdateLastSeen(player.PlayerID)
    }

    // Generate session token
    rawTokenBytes := make([]byte, SessionTokenBytes)
    if _, err := rand.Read(rawTokenBytes); err != nil {
        return nil, err
    }
    sessionToken := base64.RawURLEncoding.EncodeToString(rawTokenBytes)
    tokenHash := sha256.Sum256([]byte(sessionToken))
    expiresAt := time.Now().Add(SessionTokenExpiryDays * 24 * time.Hour)

    session := &SessionToken{
        TokenHash: hex.EncodeToString(tokenHash[:]),
        PlayerID:  player.PlayerID,
        ExpiresAt: expiresAt,
    }
    if err := h.sessionStore.Create(session); err != nil {
        return nil, err
    }

    return &SignInResponse{
        SessionToken: sessionToken,
        ExpiresAt:    expiresAt.UnixMilli(),
        Player: PlayerInfo{
            PlayerID:    player.PlayerID,
            DisplayName: player.DisplayName,
            AvatarURL:   player.AvatarURL,
            CreatedAt:   player.CreatedAt.UnixMilli(),
        },
    }, nil
}
```

### Display Name Picker (First Login)

**Pseudocode:**
```
function setDisplayName(authorizationHeader, rawDisplayName):
    // 1. Validate bearer token and derive player identity server-side
    sessionToken = parseBearerToken(authorizationHeader)
    if sessionToken == null:
        return { error: "unauthorized", status: 401 }
    tokenHash = sha256(sessionToken)
    session = findSessionByHash(tokenHash)
    if session == null or session.expiresAt < now():
        return { error: "session_expired", status: 401 }
    playerId = session.playerId

    // 2. Sanitize display name (same rules as rooms.md)
    sanitized = sanitizeDisplayName(rawDisplayName)
    if sanitized is "Guest" and rawDisplayName was not empty:
        return { error: "bad_display_name", reason: "After sanitization the name was empty" }
    if length(sanitized) < 1 or length(sanitized) > 16:
        return { error: "bad_display_name", reason: "Display name must be 1-16 characters" }

    // 3. Update player record
    player.displayName = sanitized
    savePlayer(player)

    return { displayName: sanitized }
```

**Go:**
```go
func (h *AuthHandler) HandleSetDisplayName(w http.ResponseWriter, r *http.Request) {
    sessionToken, err := parseBearerToken(r.Header.Get("Authorization"))
    if err != nil {
        writeJSON(w, http.StatusUnauthorized, ErrorResponse{Error: "unauthorized"})
        return
    }

    session, err := h.sessionStore.FindByHash(sha256Hex(sessionToken))
    if err != nil || session.ExpiresAt.Before(time.Now()) {
        writeJSON(w, http.StatusUnauthorized, ErrorResponse{Error: "session_expired"})
        return
    }
    playerID := session.PlayerID

    rawName := readDisplayNameFromBody(r)
    sanitized := sanitizeDisplayName(rawName)
    if sanitized == FallbackDisplayName && rawName != "" {
        writeJSON(w, http.StatusBadRequest, ErrorResponse{Error: "bad_display_name"})
        return
    }
    if len(sanitized) < 1 || len(sanitized) > MaxDisplayNameLen {
        writeJSON(w, http.StatusBadRequest, ErrorResponse{Error: "bad_display_name"})
        return
    }

    if err := h.playerStore.UpdateDisplayName(playerID, sanitized); err != nil {
        writeJSON(w, http.StatusInternalServerError, ErrorResponse{Error: "internal_error"})
        return
    }

    writeJSON(w, http.StatusOK, SetDisplayNameResponse{DisplayName: sanitized})
}
```

### Display Name Sanitization

Uses the same sanitization rules as [rooms.md → Display Name Sanitization](rooms.md#display-name-sanitization):

```
function sanitizeDisplayName(raw):
    if raw is null or not a string:
        return FALLBACK_DISPLAY_NAME
    name = raw.trim()
    name = stripControlCharacters(name)
    name = collapseInternalWhitespace(name)
    if name.length == 0:
        return FALLBACK_DISPLAY_NAME
    if name.length > MAX_DISPLAY_NAME_LEN:
        name = name.slice(0, MAX_DISPLAY_NAME_LEN)
    return name
```

Uniqueness is **not** enforced — display names are labels, not identities.

### WebSocket Upgrade with Token

**Pseudocode:**
```
function handleWebSocketUpgrade(request):
    token = request.query.get("token")
    player = null

    if token != null and token != "":
        // Validate session token by hashing the presented base64url token string
        tokenHash = sha256(token)
        session = findSessionByHash(tokenHash)
        if session != null and session.expiresAt > now():
            player = findPlayer(session.playerId)
            if player != null:
                // Upgrade with authed identity. The gameplay connection ID remains ephemeral;
                // the persistent database UUID is stored separately as AccountID.
                upgrade(
                    connectionPlayerId = generateUUID(),
                    accountId = player.playerId,
                    displayName = player.displayName  // authoritative from DB
                )
                return

        // Token invalid or expired — fall through to guest
        log "Session token invalid or expired, falling back to guest"

    // Guest connection (existing behavior)
    upgrade(
        connectionPlayerId = generateUUID(),
        accountId = null,
        displayName = null  // will be set via player:hello
    )
```

**Key rules:**
- If token is present and valid: player is authed. `AccountID` and `display_name` come from the database; the gameplay `Player.ID` remains a fresh ephemeral UUID for this socket session.
- If token is absent or invalid: player is a guest. Server generates a fresh ephemeral `Player.ID` and leaves `AccountID = null`.
- Authed players still send `player:hello` (protocol uniformity), but the server ignores the `displayName` field — the DB name is authoritative.
- Guest players send `player:hello` as before; display name from the hello is used normally (sanitized per rooms.md rules).
- See [networking.md → Authenticated Connection](networking.md#authenticated-connection) for the full WebSocket upgrade contract.

### LocalStorage Token Management

**Pseudocode:**
```
function onPageLoad():
    token = localStorage.getItem("stick_rumble_session_token")
    if token != null:
        // Attempt to use token on WebSocket connection
        wsUrl = "ws://server:8080/ws?token=" + encodeURIComponent(token)
        connectWebSocket(wsUrl)
        // If server rejects (expired), fall back to guest
    else:
        // No token, show join_form (guest path)
        showJoinForm()

function onGoogleSignInSuccess(response):
    // 1. Exchange Google token for session token
    result = post("/api/auth/google", { googleIdToken: response.idToken })
    if result.error:
        showError(result.error)
        return

    // 2. Store session token
    localStorage.setItem("stick_rumble_session_token", result.sessionToken)

    // 3. Check if display name is needed
    if result.player.displayName == null:
        navigateTo("display_name_picker")
    else:
        navigateTo("lobby")

function onSignOut():
    localStorage.removeItem("stick_rumble_session_token")
    // WebSocket must disconnect — no guest reconnect needed when leaving to sign-in
    disconnectWebSocket()
    navigateTo("/sign-in")
```

### Match End Stats Update

When a match ends, the match system posts per-player stats to the accounts system for lifetime tracking. See [progression.md → Event to Track](progression.md#event-to-track) for the full specification of what data is posted and how level-up detection works.

**Pseudocode:**
```
function onMatchEnd(room):
    for each player in room:
        // Update lifetime stats. player.xp is the XP earned in this match.
        lifetimeStats = lifetimeStatsFor(player.playerId)
        lifetimeStats.totalKills += player.kills
        lifetimeStats.totalDeaths += player.deaths
        lifetimeStats.totalXP += player.xp
        lifetimeStats.totalGames += 1
        if player is winner:
            lifetimeStats.totalWins += 1
        updatePerWeaponKills(lifetimeStats, player.weaponBreakdown)
        saveLifetimeStats(lifetimeStats)
```

See [progression.md → Leveling Curve](progression.md#leveling-curve) for the XP-to-level formulas and [progression.md → Level-Up Toast](progression.md#level-up-toast-client-side) for the client-side display.

Level-up notifications are delivered to the client via the `GET /api/player/me` response after match end. The match system calls into the accounts system to update lifetime stats, and the lobby polls or receives the updated data on the next `GET /api/player/me` call. A future iteration may add a dedicated `progression:level_up` WebSocket message for real-time notification.

### Match-End Redirect Behavior

After a match concludes (the match system has processed stats updates), the client navigates to the appropriate screen based on auth state:

- **Authenticated player (has session token, `AccountID` is set):** Navigate to the lobby (`/lobby`). The lobby screen re-fetches `GET /api/player/me` to display updated lifetime stats, XP progress, and level-up notifications.
- **Guest player (no session token, `AccountID === null`):** Navigate to the join form (`join_form`). A CTA banner saying "Sign in to save your stats!" may be shown to encourage account creation.

**Client behavior on match end:**
```typescript
function onMatchEnd(data: MatchEndData): void {
  const token = localStorage.getItem('stick_rumble_session_token');
  if (token) {
    // Authed player → lobby
    navigateTo('/lobby');
  } else {
    // Guest player → join_form
    navigateTo('join_form');
  }
}
```

**Why separate destinations?** Authenticated players have persistent stats that accumulate across sessions, so returning to the lobby lets them see updated totals. Guest players have no persistent identity, so returning to the join form with a guest-play CTA provides the clearest next action.

**Post-match level-up toast (authed only):** When the client re-fetches `GET /api/player/me` and detects the player leveled up in the previous match, a level-up toast overlay appears in the lobby (see [progression.md → Level-Up Toast](progression.md#level-up-toast-client-side)).

---

## PostgreSQL Schema

```sql
CREATE TABLE players (
    player_id    UUID PRIMARY KEY,
    google_sub   TEXT NOT NULL UNIQUE,
    display_name TEXT,  -- null until first login name picker
    avatar_url   TEXT,  -- null if Google profile has no picture
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE session_tokens (
    token_hash  TEXT PRIMARY KEY,  -- SHA-256 of base64url session token string
    player_id   UUID NOT NULL REFERENCES players(player_id) ON DELETE CASCADE,
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE lifetime_stats (
    player_id       UUID PRIMARY KEY REFERENCES players(player_id) ON DELETE CASCADE,
    total_kills     INTEGER NOT NULL DEFAULT 0,
    total_deaths    INTEGER NOT NULL DEFAULT 0,
    total_xp        INTEGER NOT NULL DEFAULT 0,
    total_games     INTEGER NOT NULL DEFAULT 0,
    total_wins      INTEGER NOT NULL DEFAULT 0,
    per_weapon_kills JSONB NOT NULL DEFAULT '{}',
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Why `ON DELETE CASCADE`?** If a player record is ever removed (e.g., data deletion request), all associated sessions and stats are automatically cleaned up. This prevents orphaned rows and simplifies data lifecycle management.

---

## HTTP Endpoints

### `POST /api/auth/google`

**Request Body:**
```json
{
  "googleIdToken": "<Google OAuth ID token>"
}
```

**Success Response (200):**
```json
{
  "sessionToken": "<base64url-no-padding-session-token>",
  "expiresAt": 1715788800000,
  "needsDisplayName": true,
  "player": {
    "playerId": "550e8400-e29b-41d4-a716-446655440000",
    "displayName": null,
    "avatarUrl": "https://lh3.googleusercontent.com/a/example",
    "createdAt": 1715702400000
  }
}
```

**The `needsDisplayName` field** (`boolean`):
- `true` when `player.displayName === null` (first-time Google sign-in). The client should navigate to the display name picker screen at `/display-name`.
- `false` when `player.displayName` is set. The client should navigate to the lobby at `/lobby`.
- This field saves the client from making an additional `GET /api/player/me` call after sign-in just to check display name status.

**Error Responses:**
| Status | Body | Condition |
|--------|------|-----------|
| 401 | `{ "error": "invalid_token" }` | Google token validation failed |
| 500 | `{ "error": "internal_error" }` | Database or server error |

### `PUT /api/player/displayname`

**Request Headers:**
- `Authorization: Bearer <session_token>`

**Request Body:**
```json
{
  "displayName": "chosen_name"
}
```

**Success Response (200):**
```json
{
  "displayName": "chosen_name"
}
```

**Error Responses:**
| Status | Body | Condition |
|--------|------|-----------|
| 400 | `{ "error": "bad_display_name", "reason": "..." }` | Name too short/long or empty after sanitization |
| 401 | `{ "error": "session_expired" }` | Session token expired or invalid |

### `GET /api/player/me`

**Purpose:** Used by the lobby and profile screens to load player data and validate a stored session token without going through matchmaking. This avoids using a WebSocket upgrade as the token-validation mechanism.

**Request Headers:**
- `Authorization: Bearer <session_token>`

**Success Response (200):**
```json
{
  "player": {
    "playerId": "550e8400-e29b-41d4-a716-446655440000",
    "displayName": "Alice",
    "avatarUrl": "https://lh3.googleusercontent.com/a/example",
    "createdAt": 1715702400000
  },
  "lifetimeStats": {
    "totalKills": 42,
    "totalDeaths": 31,
    "totalXP": 10750,
    "totalGames": 12,
    "totalWins": 4,
    "perWeaponKills": { "pistol": 10, "ak47": 20 }
  },
  "level": 7,
  "currentLevelXp": 1250,
  "xpForNextLevel": 2500
}
```

**Error Responses:**
| Status | Body | Condition |
|--------|------|-----------|
| 401 | `{ "error": "unauthorized" }` | Missing, invalid, or expired bearer token |
| 500 | `{ "error": "internal_error" }` | Database or server error |

---

## Error Handling

### Invalid Google Token

**Trigger**: Client sends a `googleIdToken` that fails Google's validation API
**Detection**: Google API returns error response or token is malformed
**Response**: 401 `{ "error": "invalid_token" }`
**Recovery**: Client re-prompts the user to sign in with Google again

### Expired Session Token

**Trigger**: Client presents a session token whose `expires_at` has passed
**Detection**: Server checks `expires_at` on lookup; if expired, deletes the stale token
**Response**: On WebSocket upgrade: treat as guest connection (no error sent). On `PUT /api/player/displayname`: 401 `{ "error": "session_expired" }`
**Recovery**: Client clears `localStorage` token and shows the sign-in screen

### Display Name Too Short/Long

**Trigger**: Client sends a display name < 1 character or > 16 characters after sanitization
**Detection**: Server computes sanitized length and returns error
**Response**: 400 `{ "error": "bad_display_name", "reason": "..." }`
**Recovery**: Client shows inline validation and asks the user to choose a different name

### Display Name Collision

**Trigger**: Two players choose the same display name
**Detection**: Not detected — names are labels, not identities
**Response**: Both names are accepted; no error
**Why allowed?** The server-generated `player_id` is the true identity key. Display names are rendering labels only. Collisions are harmless and expected in a system with no uniqueness enforcement.

### Guest Cannot Use Protected Endpoints

**Trigger**: Guest player (no session token) attempts `PUT /api/player/displayname`
**Detection**: No bearer token or invalid token in Authorization header
**Response**: 401 `{ "error": "unauthorized" }`
**Recovery**: Client navigates to sign-in screen

---

## Implementation Notes

### TypeScript (Client)

1. **Token Storage**: Use `localStorage` with key `stick_rumble_session_token`. On page load, read the token and pass it as `?token=` query parameter when establishing the WebSocket connection.
2. **Token Refresh**: Session tokens expire after 30 days. There is no automatic refresh — the user must sign in again. The client may add automatic refresh in a future iteration.
3. **Sign Out**: Clear `localStorage` and reconnect WebSocket as a guest. No server-side invalidation is required (the token expires naturally).
4. **Google Sign-In Button**: Use the Google Identity Services library (`google.accounts.id.initialize()` and `google.accounts.id.renderButton()`). The callback receives a `CredentialResponse` with an `idToken` that is sent to `POST /api/auth/google`.

### Go (Server)

1. **AuthHandler**: Manages Google token validation, session token creation, player record lookup, and display name updates. Uses the database connection pool for all persistence.
2. **StatsStore**: Manages lifetime stats reads and writes. Called by the match system on match end to persist per-player stats.
3. **Database Connection**: Use `database/sql` with a PostgreSQL driver (`lib/pq` or `pgx`). Initialize the connection pool at server startup and inject it into `AuthHandler` and `StatsStore`.
4. **Google Token Validation**: Use Google's tokeninfo endpoint: `GET https://oauth2.googleapis.com/tokeninfo?id_token=<token>`. Validate the response includes the expected `aud` (client ID) and `iss` (`https://accounts.google.com`).
5. **HTTPS Requirement**: The Google OAuth flow requires a secure context. The server must be served over HTTPS in production. For local development, `http://localhost` is treated as a secure context by browsers.

---

## Test Scenarios

### TS-ACCT-001: First-Time Google Auth Creates Player Record

**Category**: Integration
**Priority**: Critical

**Preconditions:**
- No existing player with the given Google `sub`
- Valid Google ID token

**Input:**
- `POST /api/auth/google` with `{ "googleIdToken": "<valid_token>" }`

**Expected Output:**
- 200 response with session token
- Player record created in `players` table with `google_sub` matching token
- `display_name` is null (first login)
- `LifetimeStats` row created for the player
- Session token stored in `session_tokens` table
- `expiresAt` is approximately 30 days from now

### TS-ACCT-002: Returning Auth Returns Existing Player Record

**Category**: Integration
**Priority**: Critical

**Preconditions:**
- Existing player record with known `google_sub`
- Valid Google ID token for the same `google_sub`

**Input:**
- `POST /api/auth/google` with `{ "googleIdToken": "<valid_token>" }`

**Expected Output:**
- 200 response with session token
- Player record `player_id` matches existing record
- `last_seen_at` is updated
- `created_at` is unchanged
- No duplicate player records created

### TS-ACCT-003: Session Token Stored and Retrieved from localStorage

**Category**: Unit
**Priority**: High

**Preconditions:**
- Auth handler returns valid session token

**Input:**
- Client stores `result.sessionToken` to `localStorage.setItem("stick_rumble_session_token", token)`

**Expected Output:**
- `localStorage.getItem("stick_rumble_session_token")` returns the token
- Token persists across page reloads

### TS-ACCT-004: Display Name Picker Saves Name via PUT

**Category**: Integration
**Priority**: Critical

**Preconditions:**
- Valid session token (player with null display name)
- New player record with no display name set

**Input:**
- `PUT /api/player/displayname` with `Authorization: Bearer <session_token>` and body `{ "displayName": "Alice" }`

**Expected Output:**
- 200 response with `{ "displayName": "Alice" }`
- Player record `display_name` updated to "Alice"
- Subsequent `POST /api/auth/google` returns `displayName: "Alice"` (not null)

### TS-ACCT-005: Guest Connection Works Without Token

**Category**: Integration
**Priority**: Critical

**Preconditions:**
- Server running with auth enabled

**Input:**
- Client connects to `ws://server:8080/ws` (no `?token=` query parameter)
- Client sends `player:hello { mode: "public", displayName: "Bob" }`

**Expected Output:**
- Server accepts the connection as a guest
- Server assigns a fresh ephemeral `Player.ID` (UUID) with `AccountID = null`
- Server uses the display name from `player:hello` (sanitized)
- Player can play a match normally

### TS-ACCT-006: Authed Connection with Valid Token Skips Name Picker

**Category**: Integration
**Priority**: High

**Preconditions:**
- Player exists with non-null `display_name` ("Charlie")
- Valid session token for this player

**Input:**
- Client connects to `ws://server:8080/ws?token=<valid_token>`
- Client sends `player:hello { mode: "public", displayName: "DifferentName" }`

**Expected Output:**
- Server identifies the player as authed (sets `AccountID` from DB `player_id` and resolves `display_name` from DB)
- Server still assigns a fresh ephemeral `Player.ID` for the socket session
- Server uses `display_name` = "Charlie" (DB authoritative), ignores "DifferentName" from hello
- Player skips display name picker and goes directly to lobby

### TS-ACCT-007: Expired Token Falls Back to Guest

**Category**: Integration
**Priority**: High

**Preconditions:**
- Expired session token in `session_tokens` table
- Client has expired token in `localStorage`

**Input:**
- Client connects to `ws://server:8080/ws?token=<expired_token>`

**Expected Output:**
- Server detects expired token
- Server treats connection as guest
- Server assigns a fresh ephemeral `Player.ID` with `AccountID = null`
- Server does not return the DB display name
- Stale token row may be cleaned up

### TS-ACCT-008: Invalid Google Token Returns 401

**Category**: Integration
**Priority**: High

**Preconditions:**
- Server running

**Input:**
- `POST /api/auth/google` with `{ "googleIdToken": "clearly_invalid" }`

**Expected Output:**
- 401 response with `{ "error": "invalid_token" }`
- No player record created
- No session token issued

### TS-ACCT-009: Display Name Sanitization Follows Rooms.md Rules

**Category**: Unit
**Priority**: Medium

**Preconditions:**
- Valid session token

**Input:**
- `PUT /api/player/displayname` with `{ "displayName": "  A  B  " }` (contains internal whitespace and leading/trailing spaces)

**Expected Output:**
- Server sanitizes to "A B" (trimmed, internal whitespace collapsed)
- 200 response with `{ "displayName": "A B" }`
- Player record updated to "A B"

### TS-ACCT-010: Sign Out Clears Token and Redirects to /sign-in

**Category**: Unit
**Priority**: Medium

**Preconditions:**
- Client is signed in with a session token in `localStorage`
- WebSocket is connected with the token

**Input:**
- User clicks "Sign Out"
- Client calls `localStorage.removeItem("stick_rumble_session_token")`
- Client disconnects WebSocket
- Client navigates to `/sign-in` (the sign-in landing screen with Google sign-in and guest play options)

**Expected Output:**
- `localStorage` no longer contains the session token
- WebSocket is disconnected (no reconnect needed — `authMode` owns the screen, no socket)
- Client navigates to `/sign-in`
- `AuthState` transitions to `'unauthenticated'`
- No Phaser canvas and no WebSocket are active in this state

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.1 | 2026-05-15 | Fixed session token hashing to hash the base64url token string, added `avatarUrl`, corrected match-end XP accumulation, made display-name updates derive identity from the bearer token, added `GET /api/player/me`, and documented level-up delivery via player info refresh. |
| 1.0.0 | 2026-05-15 | Initial specification |
