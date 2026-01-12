# Epic 6: Player Identity & Progression

**Goal:** Players build persistent identity with unlockable rewards

**Value Delivered:** OAuth login, XP/leveling, cosmetics, stat tracking

**FRs Covered:** FR8 (XP/leveling), FR9 (OAuth), FR18 (cosmetics), FR19 (stats)

**Status:** Not Started (0/7 stories)

---

## Stories

### Story 6.1: Implement Google OAuth Authentication

As a player,
I want to log in with my Google account,
So that my progress is saved across devices.

**Acceptance Criteria:**

**Given** I am on the login screen
**When** I click "Login with Google"
**Then** I am redirected to Google OAuth consent page

**And** after approving, Google redirects back to server `/auth/google/callback`
**And** server exchanges OAuth code for user profile using go-pkgz/auth
**And** server creates or retrieves player account in PostgreSQL
**And** server generates JWT token with {playerId, email, expiresIn: 7d}
**And** server redirects to frontend with JWT in URL or sets httpOnly cookie

**And** frontend stores JWT in localStorage (or uses cookie)
**And** frontend includes JWT in WebSocket handshake: `?token={jwt}`
**And** server validates JWT on WebSocket connection
**And** player name displayed as Google account name

**Prerequisites:** Story 5.5

**Technical Notes:**
- Backend auth setup: `go-pkgz/auth` with Google provider
- OAuth config: `{clientID, clientSecret, redirectURL: '/auth/google/callback'}`
- JWT signing: HMAC-SHA256 with secret key from environment variable
- Database: `players` table with `{id, email, google_id, created_at, mmr, xp, level}`
- WebSocket auth: extract JWT from query param, validate, associate connection with playerId
- Frontend: redirect to `/auth/google` on login click
- Error handling: if OAuth fails, show "Login failed" with retry button

---

### Story 6.2: Implement Guest Play Without Account

As a player,
I want to play without creating an account,
So that I can try the game with zero friction.

**Acceptance Criteria:**

**Given** I am on the login screen
**When** I click "Play as Guest"
**Then** I immediately enter matchmaking without authentication

**And** a temporary guest account is created: `{id: 'guest_{uuid}', name: 'Guest_1234'}`
**And** guest progress (XP, stats) is saved for current session only
**And** guest data is deleted when I close browser (not persisted)

**And** banner displays: "Playing as guest - Login to save progress"
**And** can upgrade guest to full account: click "Login" during session, progress transfers

**Prerequisites:** Story 6.1

**Technical Notes:**
- Generate guest UUID: `crypto.randomUUID()` on frontend
- Guest flag: `isGuest: true` stored with player state
- No database entry for guests (session-only in Redis)
- Session storage: `sessionStorage.setItem('guestId', uuid)`
- Upgrade path: if guest logs in, transfer session stats to permanent account
- Guest name: "Guest_" + random 4-digit number
- Limit: guests cannot access ranked mode (only casual)

---

### Story 6.3: Implement XP and Leveling System

As a player,
I want to earn XP and level up,
So that I feel progression and accomplishment.

**Acceptance Criteria:**

**Given** I complete a match with 5 kills and a win
**When** the match ends
**Then** I earn XP calculated as: `(kills x 100) + (win x 100) + (top3 x 50) + 50`

**And** XP total: (5 x 100) + 100 + 50 + 50 = 700 XP
**And** XP bar fills on match end screen showing progress toward next level
**And** if XP exceeds level threshold: level up animation plays, "LEVEL UP!" notification

**And** level progression: Level 1 requires 100 XP, each level requires +100 more
- Level 1->2: 100 XP
- Level 2->3: 200 XP
- Level 3->4: 300 XP (total 600 XP to reach level 4)

**And** current level displayed on profile and in-game nameplate
**And** max level: 50 (for MVP, expandable later)
**And** XP and level stored in database (`players.xp`, `players.level`)

**Prerequisites:** Story 6.2

**Technical Notes:**
- XP formula: `(kills * 100) + (matchCompletion * 50) + (win * 100) + (topThree * 50)`
- Level calculation: `level = floor(sqrt(xp / 100))` (quadratic scaling)
- Database update: `UPDATE players SET xp = xp + {earned}, level = {calculated} WHERE id = {playerId}`
- Level up check: compare old level vs new level after XP addition
- UI: circular XP bar around player avatar, fills with green gradient
- Level up animation: screen flash, "+1 LEVEL" text, fanfare sound

---

### Story 6.4: Implement Player Stats Tracking

As a player,
I want to see my lifetime stats,
So that I can track improvement and achievements.

**Acceptance Criteria:**

**Given** I have played 50 matches
**When** I open my profile
**Then** I see detailed stats:
- Total kills: 450
- Total deaths: 320
- K/D ratio: 1.41
- Wins: 18
- Win rate: 36%
- Matches played: 50
- Total playtime: 6 hours 23 minutes
- Favorite weapon: AK47 (35% usage)
- Highest killstreak: 12

**And** stats are updated after every match in database
**And** stats page includes graphs: kills per match over time, win rate trend
**And** leaderboard shows top players by kills, wins, K/D ratio

**Prerequisites:** Story 6.3

**Technical Notes:**
- Database: `player_stats` table with `{player_id, kills, deaths, wins, matches, playtime_seconds, weapon_usage_json}`
- Increment stats: `UPDATE player_stats SET kills = kills + {match_kills} WHERE player_id = {id}`
- Calculated stats: `kd_ratio = kills / MAX(deaths, 1)`, `win_rate = wins / matches * 100`
- Weapon usage: JSON field `{"uzi": 120, "ak47": 200, "shotgun": 85}` (kill counts per weapon)
- UI: React component `ProfileStats.tsx` with stat cards and charts
- Charts: use Chart.js or Recharts for visualizations
- Leaderboard: Redis sorted set `leaderboard:kills` + PostgreSQL for detailed stats

---

### Story 6.4.1: Implement Match History Persistence

As a player,
I want my match results saved permanently,
So that I can review past matches and track performance over time.

**Acceptance Criteria:**

**Given** a match ends
**When** the server determines final results
**Then** match data is saved to the database

**And** database stores: match ID, timestamp, game mode, winner(s), duration
**And** database stores: per-player stats (kills, deaths, XP earned, placement)
**And** match results link to player profiles (foreign key: player_id)
**And** players can view their last 20 matches in "Match History" tab
**And** each match entry shows: date, mode, result (Win/Loss), kills/deaths, XP earned

**And** match history is sorted by most recent first
**And** clicking a match shows detailed breakdown: all players, final scores, timestamps

**Prerequisites:** Story 6.4 (stats tracking)

**Technical Notes:**

**Database Schema:**
```sql
CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  game_mode VARCHAR(20) NOT NULL, -- 'ffa' or 'tdm'
  winner_ids TEXT[] NOT NULL, -- array of player IDs (handles ties)
  duration_seconds INTEGER NOT NULL,
  kill_target INTEGER, -- 20 for FFA
  time_limit_seconds INTEGER -- 420 for FFA
);

CREATE TABLE match_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  kills INTEGER NOT NULL DEFAULT 0,
  deaths INTEGER NOT NULL DEFAULT 0,
  xp_earned INTEGER NOT NULL DEFAULT 0,
  placement INTEGER, -- 1 = winner, 2-8 = rank by kills
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(match_id, player_id)
);

CREATE INDEX idx_match_participants_player ON match_participants(player_id, created_at DESC);
CREATE INDEX idx_matches_created_at ON matches(created_at DESC);
```

**Server Implementation:**
- Save match: called in `EndMatch()` after determining winners (internal/game/match.go)
- Insert match record: `INSERT INTO matches (...) VALUES (...) RETURNING id`
- Insert participant records: batch insert for all players
- Transaction: wrap both inserts in database transaction (atomic)
- Error handling: log errors but don't block match end flow

**Client UI:**
- React component: `MatchHistory.tsx` in profile section
- Fetch endpoint: `GET /api/players/{id}/matches?limit=20`
- Display format: table with columns (Date, Mode, Result, K/D, XP)
- Detail modal: click match row to see full scoreboard

**Quality Requirements:**
- Test coverage >90% for database save logic
- Unit tests: verify match and participant records created correctly
- Integration test: full match flow -> database save -> query results
- Edge case tests: ties, single player, database connection failure

**Estimated Effort:** 2-3 hours

**Deferred from Epic 2:**
- Original requirement in Story 2.6.3 moved here for proper database infrastructure
- Epic 2 shows match results in UI only (no persistence)

---

### Story 6.5: Implement Basic Cosmetic Customization

As a player,
I want to customize my stick figure appearance,
So that I can express individuality.

**Acceptance Criteria:**

**Given** I have reached level 5
**When** I open the customization menu
**Then** I can change my stick figure color from black to unlocked colors

**And** unlockable colors: Red (level 1), Blue (level 3), Green (level 5), Purple (level 10)
**And** selected color persists and is visible to all players in matches
**And** color selection synced to server and database

**And** cosmetic accessories unlockable:
- "Cool Hat" (level 8): top hat sprite on stick figure head
- "Cape" (level 15): flowing cape sprite attached to back
- "Sunglasses" (level 12): sunglasses sprite on face

**And** accessories can be toggled on/off independently
**And** cosmetics have zero gameplay impact (purely visual)

**Prerequisites:** Story 6.4

**Technical Notes:**
- Database: `player_cosmetics` table `{player_id, unlocked_items_json, equipped_items_json}`
- Unlocked items: `{"colors": ["black", "red", "blue"], "accessories": ["hat", "sunglasses"]}`
- Equipped items: `{"color": "blue", "accessories": ["hat"]}`
- Sprite rendering: overlay accessory sprites on base stick figure
- Unlock logic: check level thresholds on level up, add to unlocked_items
- UI: customization screen with color swatches, accessory preview
- Sync: send `player:cosmetics` message to server on change, broadcast to all clients

---

### Story 6.6: Implement Persistent Session Management

As a player,
I want to stay logged in across browser sessions,
So that I don't have to re-authenticate frequently.

**Acceptance Criteria:**

**Given** I log in with Google OAuth
**When** I close my browser and reopen the game
**Then** I am automatically logged in (JWT still valid)

**And** JWT token has 7-day expiration
**And** if JWT expired: automatically redirect to login screen
**And** refresh token mechanism: extend session if actively playing

**And** logout button clears JWT and ends session
**And** "Remember me" toggle: if disabled, JWT expires on browser close (session cookie)

**Prerequisites:** Story 6.5

**Technical Notes:**
- JWT storage: localStorage for persistent, sessionStorage for session-only
- JWT expiration: 7 days (configurable `expiresIn: '7d'`)
- Refresh token: optional separate token with 30-day expiration for silent refresh
- Auto-login: on page load, check for valid JWT, skip login if valid
- Logout: `localStorage.removeItem('jwt')`, redirect to login
- Security: httpOnly cookies alternative (prevents XSS token theft)
- Token validation: server checks expiration and signature on every WebSocket connection
