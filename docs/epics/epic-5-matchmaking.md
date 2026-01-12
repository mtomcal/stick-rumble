# Epic 5: Matchmaking & Lobbies

**Goal:** Players find balanced matches quickly without manual coordination

**Value Delivered:** Automated skill-based matchmaking, fast queue times

**FRs Covered:** FR1 (join matches), FR20 (skill-based matchmaking)

**Status:** Not Started (0/6 stories)

---

## Stories

### Story 5.0: Database Infrastructure Setup (PostgreSQL + Redis)

As a developer,
I want database infrastructure configured with Docker Compose,
So that Epic 5 and Epic 6 features can persist player data.

**Acceptance Criteria:**

**Given** I am setting up the development environment
**When** I run `docker-compose up -d`
**Then** PostgreSQL and Redis containers start successfully

**And** PostgreSQL is accessible on localhost:5432
**And** Redis is accessible on localhost:6379
**And** database migrations run automatically on startup
**And** health checks confirm both services are ready
**And** connection pooling is configured for PostgreSQL
**And** database schema versioning is in place (migrations tooling)

**And** server connects to PostgreSQL and Redis on startup
**And** server logs show successful database connections
**And** graceful shutdown: server closes database connections cleanly

**Prerequisites:** Story 4.6 (completes Epic 4)

**Technical Notes:**

**Docker Compose Configuration:**
- `docker-compose.yml` in project root
- PostgreSQL 15 container: `postgres:15-alpine`
- Redis 7 container: `redis:7-alpine`
- Volume mounts: `./db/data` for PostgreSQL persistence
- Environment variables: `POSTGRES_DB=stickrumble`, `POSTGRES_USER=dev`, `POSTGRES_PASSWORD=devpass`
- Health checks: `pg_isready` for PostgreSQL, `redis-cli ping` for Redis

**Database Migrations:**
- Use `golang-migrate/migrate` or similar migration tool
- Migrations directory: `stick-rumble-server/migrations/`
- Initial schema: `000001_initial_schema.up.sql` (empty, ready for Epic 6)
- Migration command: `migrate -path ./migrations -database "postgres://..." up`
- Run migrations in Docker entrypoint or server startup

**Go Server Integration:**
- PostgreSQL driver: `github.com/lib/pq`
- Redis client: `github.com/go-redis/redis/v8`
- Connection pooling: `sql.DB` with `SetMaxOpenConns(25)`, `SetMaxIdleConns(5)`
- Server startup: connect to both databases, retry logic (max 5 attempts, 2s delay)
- Graceful shutdown: `defer db.Close()`, `defer redisClient.Close()`

**Environment Variables:**
```
DATABASE_URL=postgres://dev:devpass@localhost:5432/stickrumble?sslmode=disable
REDIS_URL=redis://localhost:6379/0
```

**Testing:**
- Integration test: verify PostgreSQL connection
- Integration test: verify Redis connection
- Unit test: connection retry logic
- Docker Compose smoke test: `docker-compose up && make test-integration`

**Quality Requirements:**
- All tests pass with database containers running
- Server starts successfully with database connections
- Clean shutdown with no connection leaks
- README.md updated with Docker Compose setup instructions

**Estimated Effort:** 2-3 hours

**Scope Boundaries:**
- IN SCOPE: Docker setup, connection pooling, health checks, migration tooling
- OUT OF SCOPE: Actual database schemas (defined in Epic 6 stories), production deployment config

---

### Story 5.1: Implement Redis-Based Matchmaking Queue

As a player,
I want to join a matchmaking queue,
So that I can find a match automatically.

**Acceptance Criteria:**

**Given** I am on the main menu
**When** I click "Play" button
**Then** I enter the matchmaking queue (sends `matchmaking:join` to server)

**And** server adds me to Redis queue: `ZADD matchmaking:queue {timestamp} {playerId}`
**And** queue position shown on UI: "In Queue: 3 players searching..."
**And** queue timeout: if no match after 60 seconds, show "Retry" button
**And** can cancel queue: clicking "Cancel" removes me from queue

**And** server polls queue every 1 second looking for enough players (2-8)
**And** when 2+ players available: server creates match and notifies players

**Prerequisites:** Story 5.0 (database infrastructure)

**Technical Notes:**
- Redis sorted set: `matchmaking:queue` with timestamp scores
- Queue join: `ZADD matchmaking:queue {now} {playerId}`
- Queue poll: `ZRANGE matchmaking:queue 0 7` (get up to 8 players)
- Min players: 2 (can start with 2, max 8)
- Matchmaker service: runs every 1s, checks queue, creates rooms
- Cancel: `ZREM matchmaking:queue {playerId}`
- Multiple queues possible: `matchmaking:queue:ffa`, `matchmaking:queue:tdm`

---

### Story 5.2: Implement Skill-Based Matchmaking with Hidden MMR

As a player,
I want to be matched with players of similar skill,
So that matches are competitive and fun.

**Acceptance Criteria:**

**Given** my hidden MMR is 1500 (Elo-style rating)
**When** I join the matchmaking queue
**Then** the server prefers matching me with players within +/-200 MMR

**And** if no close-skill players available after 15 seconds: widen range to +/-400 MMR
**And** if still no match after 30 seconds: widen to +/-800 MMR (any skill)
**And** match quality prioritized over wait time initially, then relaxed

**And** MMR is updated after each match:
- Win: +25 MMR (more if beat higher-skill players)
- Loss: -25 MMR (less if lost to higher-skill players)
- Starting MMR: 1000 for new players

**And** MMR is never shown to players (hidden to reduce toxicity)
**And** MMR stored in PostgreSQL player profile

**Prerequisites:** Story 5.1

**Technical Notes:**
- MMR stored: `players.mmr` column (integer, default 1000)
- Queue storage: `ZADD matchmaking:queue:mmr {mmr} {playerId}` (score = MMR not timestamp)
- Matchmaking algorithm:
  1. Get players from queue ordered by MMR
  2. Group players within +/-200 MMR
  3. If group >=2 players: create match
  4. After 15s: relax to +/-400, after 30s: +/-800
- MMR update: Elo formula `newMMR = oldMMR + K * (actualScore - expectedScore)`
- K-factor: 32 (how much MMR changes per match)
- Expected score: based on MMR difference (higher MMR = expected to win)

---

### Story 5.3: Implement Pre-Match Lobby with Ready System

As a player,
I want a pre-match lobby to see teammates and ready up,
So that matches start when everyone is prepared.

**Acceptance Criteria:**

**Given** a match has been created with 4 players
**When** all players join the lobby room
**Then** lobby screen displays all player names and ready status

**And** each player can click "Ready" button (toggles ready state)
**And** ready status is synchronized: other players see my ready state update
**And** countdown starts when all players are ready: "Match starts in 5... 4... 3..."
**And** if any player unreadies during countdown: countdown pauses

**And** if not all ready after 30 seconds: kick unready players, backfill from queue
**And** after countdown reaches 0: transition to game scene, match starts

**Prerequisites:** Story 5.2

**Technical Notes:**
- Lobby state stored in Redis: `room:{roomId}:lobby = {players: [{id, name, isReady}]}`
- Ready toggle: `lobby:ready` message updates player ready state
- Server broadcasts lobby updates to all players in room
- Countdown: server sends `lobby:countdown` with seconds remaining
- Kick timeout: 30s, server removes unready players, refills from queue
- Transition: `match:start` message with {roomId, players, mapName}
- UI: React component `LobbyScreen.tsx` with player list and ready button

---

### Story 5.4: Implement Game Mode Selection

As a player,
I want to choose between Free-For-All and Team Deathmatch,
So that I can play my preferred game mode.

**Acceptance Criteria:**

**Given** I am on the main menu
**When** I click "Play" button
**Then** I see game mode options: "Free-For-All" and "Team Deathmatch"

**And** clicking a mode enters that mode's queue: `matchmaking:join {mode: 'ffa'}`
**And** separate queues for each mode (faster matchmaking within preferred mode)
**And** mode selection persists (last selected mode pre-selected next time)

**And** Free-For-All: 2-8 players, everyone vs everyone
**And** Team Deathmatch: 4-8 players (2v2, 3v3, or 4v4), balanced teams
**And** server assigns balanced teams based on MMR (even skill distribution)

**Prerequisites:** Story 5.3

**Technical Notes:**
- Redis queues: `matchmaking:queue:ffa` and `matchmaking:queue:tdm`
- Mode parameter in `matchmaking:join` message
- Team assignment: sort by MMR, alternate players to teams (snake draft style)
- Team colors: Red vs Blue stick figures (outline/glow effect)
- LocalStorage: save last mode selection `localStorage.setItem('lastMode', 'ffa')`
- UI: mode selector with icons and descriptions

---

### Story 5.5: Implement Region Selection for Low Latency

As a player,
I want to select my region,
So that I play on nearby servers with low ping.

**Acceptance Criteria:**

**Given** I am on the main menu
**When** I open settings or region selector
**Then** I can choose region: "Auto", "North America", "Europe", "Asia"

**And** "Auto" detects best region via ping test to all server regions
**And** selected region determines which server I connect to
**And** region preference saved in localStorage (persists across sessions)

**And** ping is displayed next to each region option: "NA (35ms)", "EU (120ms)"
**And** matchmaking only includes players from same region (or allows cross-region if queue empty)

**And** if selected region offline: fallback to next lowest ping region

**Prerequisites:** Story 5.4

**Technical Notes:**
- Backend deployment: multiple servers in different regions (NA, EU, Asia)
- Frontend ping test: WebSocket handshake time to each regional server
- Region storage: `localStorage.setItem('region', 'na')`
- Server selection: connect to `wss://na.stickrumble.com/ws` based on region
- Cross-region fallback: if regional queue <2 players after 45s, merge with global queue
- Load balancer: route based on subdomain (na.*, eu.*, asia.*)
