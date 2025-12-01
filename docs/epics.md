# Stick Rumble - Epic Breakdown

**Author:** BMad
**Date:** 2025-11-25
**Project Level:** Game Development
**Target Scale:** Multiplayer Arena Shooter (2-8 players)

---

## Overview

This document provides the complete epic and story breakdown for Stick Rumble, decomposing the requirements from the [Game Design Document](./GDD.md) into implementable stories.

**Living Document Notice:** This is the initial version created from GDD + Architecture. Stories include tactical implementation details.

## Story Implementation Standards

**Based on completed Epic 1 stories (1.1-1.3), all future stories must adhere to these quality standards:**

### 1. Test Coverage Requirements
- **Minimum 90% statement coverage** for all business logic
- **Integration tests** for end-to-end workflows
- **Unit tests** for all critical functions and edge cases
- Test suites must pass before marking story as complete

### 2. Code Quality Gates
- **TypeScript:** `tsc -b --noEmit` passes with zero errors
- **ESLint:** Zero errors, zero warnings
- **Go:** `go vet ./...` and `go fmt` pass
- **Modern idioms:** Use current language best practices (e.g., `any` not `interface{}` in Go)
- **No commented-out code** or debug statements in final commits

### 3. Documentation
- **Session logs** in ReadyQ capture implementation learnings and decisions
- **Code review checklist** completed before marking done
- **README updates** where applicable (setup, configuration, usage)
- **Inline comments** for complex business logic

### 4. Definition of Done
- ✅ All acceptance criteria met and verified
- ✅ All tests passing (unit + integration)
- ✅ Code reviewed and refactored for clarity
- ✅ No known bugs or unresolved technical debt
- ✅ Documentation updated
- ✅ Changes committed with descriptive commit messages

**Quality Note:** These standards were derived from the excellent work completed in Stories 1.1, 1.2, and 1.3, which achieved 95%+ test coverage, comprehensive integration testing, and production-ready code quality.

---

## Functional Requirements Inventory

**Game Capabilities (extracted from GDD):**

- **FR1:** Players can join multiplayer matches (2-8 players) via matchmaking
- **FR2:** Players can control stick figure characters with WASD/touch movement and 360-degree aim
- **FR3:** Players can shoot weapons with click/tap controls and see hit feedback
- **FR4:** Players can pick up weapons from map spawns (Bat, Katana, Uzi, AK47, Shotgun)
- **FR5:** Players can reload weapons manually and switch weapons instantly
- **FR6:** Players can sprint for faster movement and dodge/roll with invincibility frames
- **FR7:** Players respawn after death within 3 seconds at balanced spawn points
- **FR8:** Players earn XP and level up through kills, wins, and match completion
- **FR9:** Players can authenticate via OAuth (Google/Discord) and maintain persistent accounts
- **FR10:** Players experience Free-For-All Deathmatch (MVP mode)
- **FR11:** Players experience Team Deathmatch with team scoring
- **FR12:** System provides server-authoritative hit detection (anti-cheat)
- **FR13:** System provides client-side prediction for responsive controls (<50ms feel)
- **FR14:** Players see HUD with health bar, ammo counter, minimap, kill feed, scoreboard
- **FR15:** Players can play on 2-3 arena maps with balanced layouts
- **FR16:** System maintains 60 FPS client performance and <100ms network latency
- **FR17:** Players can access game instantly in browser (zero download, cross-platform)
- **FR18:** Players can customize stick figure appearance with unlocked cosmetics
- **FR19:** System tracks player stats (kills, deaths, wins) persistently
- **FR20:** System provides skill-based matchmaking via hidden MMR

---

## Epic Structure Summary

### Epic 1: Foundation & Project Setup
**Goal:** Establish development environment and deployment pipeline for all subsequent work (greenfield foundation exception)
**Delivers:** Working development environment, basic multiplayer proof-of-concept

### Epic 2: Core Multiplayer Combat
**Goal:** Players can join matches and shoot each other in real-time
**Delivers:** Working 2-8 player deathmatch with basic weapons - USERS CAN PLAY THE GAME

### Epic 3: Weapon Systems & Game Feel
**Goal:** Players experience diverse, satisfying combat with multiple weapon types
**Delivers:** All 5 weapons implemented with distinct feel - USERS HAVE VARIETY AND CHOICE

### Epic 4: Responsive Networked Gameplay
**Goal:** Players experience smooth, fair combat despite network latency
**Delivers:** Lagless-feeling controls + cheat-proof validation - USERS TRUST THE GAME

### Epic 5: Matchmaking & Lobbies
**Goal:** Players find balanced matches quickly without manual coordination
**Delivers:** Automated matchmaking, skill-based fairness - USERS CAN EASILY FIND GAMES

### Epic 6: Player Identity & Progression
**Goal:** Players build persistent identity with unlockable rewards
**Delivers:** OAuth login, XP/leveling, stat tracking - USERS FEEL INVESTED

### Epic 7: Arena Environments
**Goal:** Players experience varied tactical combat across different map designs
**Delivers:** 2-3 polished maps with distinct playstyles - USERS HAVE MAP VARIETY

### Epic 8: Mobile Cross-Platform Play
**Goal:** Mobile players compete fairly against desktop players
**Delivers:** Touch controls with aim assist - USERS CAN PLAY ANYWHERE

### Epic 9: Polish & Production Launch
**Goal:** Players experience polished, reliable game ready for public audience
**Delivers:** Visual effects, audio, monitoring, deployment - USERS SEE FINISHED PRODUCT

---

## FR Coverage Map

- **Epic 1 (Foundation):** Infrastructure for all FRs
- **Epic 2 (Core Combat):** FR2, FR3, FR7, FR10, FR12, FR16, FR17
- **Epic 3 (Weapon Systems):** FR4, FR5, FR6
- **Epic 4 (Netcode):** FR13, FR16
- **Epic 5 (Matchmaking):** FR1, FR20
- **Epic 6 (Progression):** FR8, FR9, FR18, FR19
- **Epic 7 (Maps):** FR15
- **Epic 8 (Mobile):** FR17 (cross-platform aspect)
- **Epic 9 (Polish):** FR14 (HUD), FR16 (performance)

**Validation:** All 20 functional requirements covered by at least one epic ✅

---

## Epic 1: Foundation & Project Setup

**Goal:** Establish development environment and deployment pipeline enabling all subsequent work

**Value Delivered:** Working dev environment, basic multiplayer proof-of-concept showing 2 players can connect and see each other

**FRs Covered:** Infrastructure foundation for all FRs

---

### Story 1.1: Initialize Frontend Project with Phaser + React

As a developer,
I want the frontend project scaffolded with Phaser 3, React, and TypeScript,
So that I have a modern, type-safe development environment for building the game.

**Acceptance Criteria:**

**Given** a fresh project directory
**When** I run `npm create @phaserjs/game@latest stick-rumble-client`
**Then** the project is created with Phaser 3.90, React 18+, TypeScript, and Vite bundler

**And** the project structure includes:
- `src/game/` for Phaser code
- `src/ui/` for React components
- `src/shared/` for common types
- `public/assets/` for game assets

**And** `npm run dev` starts the development server with hot reload
**And** `npm run build` creates optimized production bundle
**And** `npm test` runs Vitest test suite

**Prerequisites:** None (first story)

**Technical Notes:**
- Use official Phaser CLI template (ensures correct Phaser ↔ React bridge)
- TypeScript strict mode enabled
- Vite config supports asset bundling for images/audio
- Template includes example GameScene to verify Phaser renders
- Git repository initialized with `.gitignore` for node_modules

---

### Story 1.2: Initialize Backend Golang Server

As a developer,
I want the backend Go server project initialized with core dependencies,
So that I can build the multiplayer game server with WebSocket support.

**Acceptance Criteria:**

**Given** a new directory `stick-rumble-server/`
**When** I initialize the Go module with `go mod init`
**Then** the project is created with Go 1.23+ module

**And** core dependencies are installed:
- `github.com/gorilla/websocket@v1.5.3` (WebSocket library)
- `github.com/go-pkgz/auth/v2` (OAuth authentication)
- `github.com/lib/pq` (PostgreSQL driver)
- `github.com/redis/go-redis/v9` (Redis client)
- `github.com/stretchr/testify` (testing assertions)

**And** project structure follows Architecture doc:
- `cmd/server/main.go` - entry point
- `internal/game/` - game logic
- `internal/network/` - WebSocket handling
- `internal/auth/` - authentication
- `internal/db/` - database connections

**And** `go run cmd/server/main.go` starts a basic HTTP server on port 8080
**And** `go test ./...` runs all tests

**Prerequisites:** Story 1.1 (parallel development possible)

**Technical Notes:**
- Use Go modules for dependency management
- Directory structure matches Architecture doc (internal/ for private packages)
- Create basic `main.go` with HTTP server to verify setup
- `.gitignore` excludes binaries and vendor/
- README.md documents how to run server

---

### Story 1.3: Establish WebSocket Connection Between Client and Server

As a developer,
I want the client and server to establish a persistent WebSocket connection,
So that real-time bidirectional communication is possible.

**Acceptance Criteria:**

**Given** both frontend and backend servers are running
**When** the Phaser client connects via `new WebSocket('ws://localhost:8080/ws')`
**Then** the Go server upgrades the HTTP connection to WebSocket using gorilla/websocket

**And** the connection remains open and stable
**And** both sides can send/receive JSON messages
**And** connection close events are handled gracefully on both sides
**And** client shows "Connected" status in console
**And** server logs "Client connected: [connection_id]"

**And** test message sent from client appears on server
**And** test message sent from server appears in client console

**Prerequisites:** Story 1.1, Story 1.2

**Technical Notes:**
- Server WebSocket handler at `/ws` endpoint using `gorilla/websocket.Upgrader`
- Client WebSocket wrapper class `WebSocketClient.ts` in `src/game/network/`
- JSON message format: `{type: string, timestamp: number, data: any}`
- Handle connection errors with retry logic (3 attempts)
- CORS headers configured to allow frontend origin (localhost:5173 in dev)
- Log all connection lifecycle events for debugging

---

### Story 1.4: Implement Basic Game Room with 2-Player Synchronization

**UPDATED 2025-12-01:** Simplified to proof-of-concept scope. Game mechanics moved to Epic 2.

As a developer,
I want a basic game room that proves 2 clients can join and communicate,
So that the multiplayer foundation is proven to work.

**Acceptance Criteria:**

**Given** 2 clients connect to the server
**When** the server detects 2 connections
**Then** a room is automatically created and both players are assigned to it

**And** both clients receive `room:joined` messages with their player IDs and room ID

**And** when Player 1 sends a test message `{type: 'test', data: 'hello'}`
**Then** Player 2 receives the message via room broadcast

**And** when Player 2 sends a test message `{type: 'test', data: 'world'}`
**Then** Player 1 receives the message via room broadcast

**And** server logs show room creation: "Room created: [room_id] with players: [player1_id, player2_id]"

**And** when one player disconnects, the other player receives `player:left` event

**And** comprehensive test suite covers room creation, joining, broadcasting, disconnection

**And** test coverage exceeds 90% for room management code

**And** integration tests verify 2-client room workflow end-to-end

**Prerequisites:** Story 1.3

**Technical Notes:**
- Server `internal/game/room.go` manages basic room state (max 8 players for future)
- Simple room manager: when 2 players connect without a room, create one
- Message broadcast: when room receives message from one player, send to all others in room
- No game loop yet - just message routing proof-of-concept
- No movement, no rendering, no game state - that's Epic 2
- Focus: prove room joining and message broadcast works reliably

**Scope Removed (moved to Epic 2, Story 2.1):**
- ❌ 60Hz tick loop → Story 2.1
- ❌ WASD movement input → Story 2.1
- ❌ Player position synchronization → Story 2.1
- ❌ Phaser sprite rendering → Story 2.1
- ❌ Server position validation → Story 2.1

**Rationale:** Original scope contained premature game mechanics. Epic 1 should focus on infrastructure foundation. Gameplay belongs in Epic 2.

**Note:** Story 1.5 (Cloud Deployment) has been moved to Epic 9 as Stories 9.5A and 9.5B. See Epic 9 section below.

---

## Epic 2: Core Multiplayer Combat

**Goal:** Players can join matches and shoot each other in real-time deathmatch

**Value Delivered:** Functional 2-8 player combat where users can actually play the game

**FRs Covered:** FR2 (movement/aim), FR3 (shooting), FR7 (respawn), FR10 (deathmatch), FR12 (server authority), FR16 (performance), FR17 (browser access)

---

### Story 2.1: Implement Server-Authoritative Player Movement

As a player,
I want smooth character movement with WASD controls,
So that I can navigate the arena naturally.

**Acceptance Criteria:**

**Given** I am in a match
**When** I press W, A, S, or D keys
**Then** my stick figure moves in the corresponding direction at 200 pixels/second

**And** movement has smooth acceleration (not instant start/stop)
**And** diagonal movement (W+A) is normalized (not 1.4x speed)
**And** server validates all movement (cannot move through walls or out of bounds)
**And** other players see my movement smoothly updated

**And** server physics runs at 60 ticks/second
**And** clients receive position updates at 20Hz
**And** invalid positions are rejected and corrected by server

**Prerequisites:** Story 1.4

**Technical Notes:**
- Server `internal/game/physics.go` handles movement with velocity and acceleration
- Movement speed: 200 px/s (configurable constant in `shared/constants.ts`)
- Acceleration: 50 px/s² for smooth feel
- Client sends input state (keys pressed) not positions
- Server calculates authoritative position based on inputs
- Bounds checking: keep players within arena boundaries (0-1920, 0-1080 for now)
- Sprite animation: 8-frame walk cycle at 12 FPS

---

### Story 2.2: Implement 360-Degree Mouse Aim

As a player,
I want to aim in any direction with my mouse,
So that I can target enemies precisely.

**Acceptance Criteria:**

**Given** I am in a match
**When** I move my mouse cursor
**Then** my stick figure's aim indicator (small crosshair or weapon barrel) points toward cursor

**And** aim angle is calculated as `Math.atan2(mouseY - playerY, mouseX - playerX)`
**And** aim direction is sent to server with player inputs
**And** other players see my aim direction rendered accurately
**And** aim indicator is visible to all players (weapon rotation or crosshair)

**And** aim updates at 60 FPS on client (smooth rotation)
**And** aim angle is included in `player:input` messages to server

**Prerequisites:** Story 2.1

**Technical Notes:**
- Client `src/game/systems/InputManager.ts` captures mouse position
- Calculate aim angle in radians, convert to degrees for display
- Weapon sprite rotates to aim angle (use Phaser `setRotation()`)
- Server stores aim angle for each player (needed for hit detection)
- Mobile will use virtual joystick (implemented in Epic 8)
- Clamp aim angle between 0-360 degrees

---

### Story 2.3: Implement Basic Shooting with Pistol

As a player,
I want to shoot a basic pistol by clicking,
So that I can damage other players.

**Acceptance Criteria:**

**Given** I am in a match with a pistol
**When** I click the left mouse button
**Then** my client sends `player:shoot` message with aim angle

**And** server creates a projectile traveling in the aim direction at 800 px/s
**And** projectile travels for max 1 second or until hitting a player
**And** visual bullet tracer appears on all clients (line from player to projectile)
**And** muzzle flash effect appears on the shooting player

**And** pistol fires at 3 rounds/second (cooldown prevents spam)
**And** pistol has 15-round magazine with reload required when empty
**And** shooting while empty plays "empty click" sound, no projectile

**Prerequisites:** Story 2.2

**Technical Notes:**
- Pistol damage: 15 per shot (health pool: 100)
- Server `internal/game/weapon.go` defines Pistol weapon type
- Projectile speed: 800 px/s (visible but fast)
- Client renders projectile as small circle sprite (4px diameter)
- Bullet tracer: thin line using Phaser graphics, fades after 0.1s
- Fire rate enforced server-side (cannot bypass client-side cooldown)
- Magazine size: 15, reload time: 1.5 seconds

---

### Story 2.4: Implement Server-Authoritative Hit Detection

As a player,
I want hits to be validated by the server,
So that the game is fair and cheat-proof.

**Acceptance Criteria:**

**Given** I shoot at another player
**When** my projectile intersects their hitbox on the server
**Then** the server calculates damage and sends `player:damaged` event to all clients

**And** hit detection uses server-authoritative positions (not client predictions)
**And** lag compensation considers shooter's ping (rewind player positions by latency)
**And** invalid hits (impossible angles, out of range) are rejected
**And** hit confirmation is broadcast to all players within 50ms

**And** victim's health decreases by weapon damage amount
**And** victim sees damage feedback (screen flash, damage number, health bar update)
**And** shooter sees hit marker confirmation (visual + audio)

**Prerequisites:** Story 2.3

**Technical Notes:**
- Server hit detection in `internal/game/physics.go` using AABB collision
- Hitbox: 32x64 pixel rectangle (stick figure body)
- Lag compensation: rewind world state by shooter's RTT / 2
- Max compensation: 150ms (prevent abuse of high latency)
- Damage calculation: `health -= weapon.damage`
- Hit validation: check projectile traveled straight line without obstacles
- Broadcast `player:damaged` with {victimId, attackerId, damage, newHealth}

---

### Story 2.5: Implement Health System and Death

As a player,
I want to die when my health reaches zero,
So that combat has meaningful consequences.

**Acceptance Criteria:**

**Given** my health is at 10 HP
**When** I take 15 damage from a bullet
**Then** my health reaches 0 and my player dies

**And** my stick figure plays death animation (fall/ragdoll)
**And** killer receives kill credit (+100 XP, +1 to kill count)
**And** kill event is added to kill feed visible to all players
**And** my view switches to spectator camera (can watch other players)

**And** after 3 seconds, I respawn at a balanced spawn point
**And** I respawn with full health (100 HP) and default pistol
**And** spawn invincibility: 2 seconds immunity to damage (visual indicator)

**Prerequisites:** Story 2.4

**Technical Notes:**
- Health range: 0-100 (integer)
- Death triggers on `health <= 0`
- Respawn timer: 3 seconds (configurable constant)
- Spawn point selection: furthest from enemy players (balanced spawning)
- Spawn invincibility: `isInvulnerable = true` for 2 seconds, visual glow effect
- Kill feed UI: `[Killer] eliminated [Victim]` with weapon icon
- Spectator mode: camera follows closest living player (temporary)

---

### Story 2.6: Implement Free-For-All Deathmatch Win Condition

As a player,
I want matches to end when someone reaches the kill target,
So that games have clear winners and limited duration.

**Acceptance Criteria:**

**Given** a Free-For-All match with 8 players
**When** any player reaches 20 kills OR 7 minutes elapse
**Then** the match ends and winner is determined

**And** if kill target reached: player with 20 kills wins
**And** if time expires: player with most kills wins
**And** tie: multiple players can share victory

**And** match end screen displays:
- Winner(s) name and final score
- All players ranked by kills
- XP earned breakdown
- "Play Again" button for quick re-queue

**And** match results are saved to database (kills, deaths, winner)
**And** players return to lobby after 10 seconds or "Play Again" click

**Prerequisites:** Story 2.5

**Technical Notes:**
- Match config: `{mode: 'FFA', killTarget: 20, timeLimitSeconds: 420}`
- Server tracks kills per player in `room.playerStats`
- Timer runs on server, broadcasts remaining time every second
- Win condition checked after each kill event
- Match end message: `match:ended` with {winnerId, finalScores, xpEarned}
- XP calculation: `(kills * 100) + (win ? 100 : 0) + (topThree ? 50 : 0) + 50`

---

### Story 2.7: Implement Health Regeneration

As a player,
I want my health to regenerate after not taking damage,
So that tactical disengagement is rewarded.

**Acceptance Criteria:**

**Given** my health is at 40 HP
**When** I avoid damage for 5 consecutive seconds
**Then** my health begins regenerating at 10 HP per second

**And** regeneration continues until health reaches 100 HP (full)
**And** taking any damage instantly stops regeneration and resets the 5-second timer
**And** regenerating health is visible on health bar with distinct color (lighter green)
**And** regeneration sound effect plays (subtle pulsing)

**Prerequisites:** Story 2.5

**Technical Notes:**
- Regeneration delay: 5 seconds after last damage taken
- Regeneration rate: 10 HP/second (takes 6 seconds to heal from 40 to 100)
- Server tracks `lastDamageTime` per player
- Server applies regeneration in tick loop: `if (now - lastDamageTime > 5000) { health = min(100, health + 10 * deltaTime) }`
- Client renders regeneration visual: health bar pulses with glow effect
- Regeneration stops immediately on damage (`lastDamageTime = now`)

---

## Epic 3: Weapon Systems & Game Feel

**Goal:** Players experience diverse, satisfying combat with multiple weapon types

**Value Delivered:** 5 distinct weapons (Bat, Katana, Uzi, AK47, Shotgun) with unique feel

**FRs Covered:** FR4 (weapon pickups), FR5 (reload/switch), FR6 (sprint/dodge)

---

### Story 3.1: Implement Weapon Pickup System

As a player,
I want to pick up weapons from map spawns,
So that I can gain tactical advantage.

**Acceptance Criteria:**

**Given** a weapon (Uzi) spawned at position {x: 500, y: 600}
**When** I move within 32 pixels of the weapon
**Then** "Press E to pick up Uzi" prompt appears on screen

**And** when I press E key, I send `player:pickup` message to server
**And** server validates I'm in range and weapon exists
**And** server removes weapon from map, adds to my inventory, broadcasts `weapon:pickedup`
**And** weapon sprite disappears for all players
**And** my current weapon is replaced (dropped at my location if not default pistol)

**And** weapon respawns at the same location after 30 seconds
**And** weapon spawn notification: subtle glow effect on map and minimap

**Prerequisites:** Story 2.6

**Technical Notes:**
- Weapon spawn data: `{id, type, x, y, respawnTime}`
- Server tracks weapon state: `{available: true/false, nextRespawn: timestamp}`
- Pickup range: 32 pixels (circular collision check)
- Weapon switch instant (no animation delay for MVP)
- Dropped weapons disappear after 10 seconds (prevent clutter)
- Each map has 3-5 fixed weapon spawn points defined in map config

---

### Story 3.2: Implement Melee Weapons (Bat and Katana)

As a player,
I want to use melee weapons for high-risk, high-reward close combat,
So that I can dominate at short range.

**Acceptance Criteria:**

**Given** I have a Bat equipped
**When** I click to attack
**Then** my stick figure swings the bat in a 90-degree arc in the aim direction

**And** any enemy within melee range (64 pixels) and within the swing arc takes 25 damage
**And** bat attacks at 0.5 second intervals (fast)
**And** hit enemies are knocked back slightly (40 pixels in hit direction)
**And** melee hit plays satisfying "thwack" sound with screen shake

**And** given I have a Katana equipped
**When** I click to attack
**Then** the katana slashes with 45 damage, 0.8 second cooldown, 80 pixel range

**And** katana has longer reach than bat but slower attack speed
**And** both weapons have no ammo (infinite uses)
**And** melee attacks require precise timing and positioning

**Prerequisites:** Story 3.1

**Technical Notes:**
- Bat stats: {damage: 25, cooldown: 0.5s, range: 64px, arc: 90°}
- Katana stats: {damage: 45, cooldown: 0.8s, range: 80px, arc: 90°}
- Server hit detection: check enemies in cone-shaped area from player
- Knockback velocity: 200 px/s for 0.2 seconds
- Animation: 4-frame swing (0.2s duration)
- Melee priority: if multiple enemies in range, hit all (AoE)
- Balance: melee is high-risk (need to close distance) but high DPS

---

### Story 3.3: Implement Ranged Weapons (Uzi, AK47, Shotgun)

As a player,
I want to use ranged weapons with distinct characteristics,
So that I can choose weapons matching my playstyle.

**Acceptance Criteria:**

**Given** I have an Uzi equipped
**When** I hold down mouse button
**Then** the Uzi fires in full-auto at 10 rounds/second

**And** each bullet does 8 damage with medium range (600px max)
**And** Uzi has 30-round magazine, 1.5 second reload
**And** recoil climbs upward (aim angle increases by 2° per shot, recovers over 0.5s)
**And** bullet spread increases while moving (±5° spread)

**And** given I have an AK47 equipped
**When** I click to fire
**Then** the AK47 fires semi-auto at 6 rounds/second (hold for continuous fire)

**And** each bullet does 20 damage with long range (800px max)
**And** AK47 has 30-round magazine, 2.0 second reload
**And** balanced recoil (horizontal + vertical, ±3° pattern)
**And** accurate while stationary, spread while moving

**And** given I have a Shotgun equipped
**When** I click to fire
**Then** the shotgun fires 8 pellets in spread pattern

**And** each pellet does 7.5 damage (60 total if all hit) with short range (300px max)
**And** pellet spread: 15° cone from aim angle
**And** devastating at close range (all pellets hit), weak at distance (spread too wide)
**And** slow fire rate: 1 shot per second, 6-round magazine, 2.5 second reload

**Prerequisites:** Story 3.2

**Technical Notes:**
- Uzi: {damage: 8, fireRate: 10/s, mag: 30, reload: 1.5s, range: 600px}
- AK47: {damage: 20, fireRate: 6/s, mag: 30, reload: 2.0s, range: 800px}
- Shotgun: {damage: 60 total (8 pellets × 7.5), fireRate: 1/s, mag: 6, reload: 2.5s, range: 300px}
- Shotgun pellet spread: each pellet angle offset by random ±7.5° from aim
- Recoil patterns stored as `{x, y}` offset arrays per weapon
- Bullet drop-off: damage decreases linearly after 50% of max range
- Server validates fire rate (prevent macros/exploits)

---

### Story 3.4: Implement Manual Reload Mechanic

As a player,
I want to manually reload my weapon,
So that I can choose optimal timing for vulnerability.

**Acceptance Criteria:**

**Given** my AK47 has 5 rounds remaining
**When** I press R key
**Then** reload animation starts (2.0 seconds for AK47)

**And** during reload, I cannot shoot (clicking does nothing)
**And** reload progress bar appears on HUD (fills over 2 seconds)
**And** reload can be canceled by switching weapons (lose progress)
**And** after reload completes, magazine refills to 30 rounds

**And** if I attempt to shoot with empty magazine, auto-reload starts
**And** empty magazine indicator: "RELOAD!" flashes on screen in red
**And** reload sound effect plays (unique per weapon)

**And** I can move, sprint, and dodge while reloading (not stunned)

**Prerequisites:** Story 3.3

**Technical Notes:**
- Reload time per weapon: Uzi (1.5s), AK47 (2.0s), Shotgun (2.5s)
- Server tracks reload state: `{isReloading: bool, reloadStartTime: timestamp}`
- Reload progress: `(now - reloadStartTime) / reloadDuration`
- Cancel reload: switch weapon or pickup new weapon
- Auto-reload trigger: attempt to shoot with `ammo === 0`
- Animation: character lowers weapon, reload gesture, raises weapon
- UI: circular reload indicator around crosshair

---

### Story 3.5: Implement Sprint Mechanic

As a player,
I want to sprint for faster movement,
So that I can reposition quickly or retreat from danger.

**Acceptance Criteria:**

**Given** I am moving with WASD keys
**When** I hold Shift key
**Then** my movement speed increases from 200 px/s to 300 px/s (1.5× multiplier)

**And** sprint has no stamina limit (can sprint indefinitely)
**And** sprinting applies accuracy penalty (bullet spread increases by 50%)
**And** sprinting makes louder footstep sounds (audio cue for enemies)
**And** visual indicator: subtle motion blur or speed lines

**And** sprinting does not prevent shooting, reloading, or aiming
**And** releasing Shift returns to normal movement speed instantly

**Prerequisites:** Story 3.4

**Technical Notes:**
- Sprint speed: 300 px/s (vs normal 200 px/s)
- Accuracy penalty: multiply bullet spread by 1.5 when `isSprinting === true`
- Server validates sprint input (cannot sprint + move slower, prevents speed hacks)
- Footstep volume: +30% louder while sprinting
- Visual effect: camera FOV increases slightly (zoom out effect)
- No stamina system for MVP (infinite sprint, simple mechanic)

---

### Story 3.6: Implement Dodge Roll with Invincibility Frames

As a player,
I want to dodge roll to evade attacks,
So that I can outplay opponents with skillful timing.

**Acceptance Criteria:**

**Given** I am in combat
**When** I press Space bar
**Then** my stick figure performs a roll in the current movement direction (or forward if stationary)

**And** roll duration: 0.4 seconds, covers 100 pixels
**And** during first 0.2 seconds: invincibility frames (cannot take damage)
**And** during last 0.2 seconds: vulnerable to damage
**And** dodge cooldown: 3 seconds (cannot roll again for 3s)

**And** visual indicator: character sprite rolls with transparency effect during i-frames
**And** cooldown UI: circular timer shows when dodge is available again
**And** dodge sound effect: quick "whoosh"

**And** cannot shoot, reload, or switch weapons during roll
**And** roll direction: based on WASD keys pressed (or aim direction if no keys pressed)

**Prerequisites:** Story 3.5

**Technical Notes:**
- Roll stats: {duration: 0.4s, distance: 100px, iframes: 0.2s, cooldown: 3s}
- Server tracks roll state: `{isRolling: bool, rollStartTime, lastRollTime}`
- Invincibility check: `if (isRolling && now - rollStartTime < 200) { return; }`
- Roll velocity: 250 px/s for 0.4 seconds
- Animation: 6-frame roll animation, sprite rotates 360°
- Cooldown enforcement: client shows UI, server validates (prevent spam)
- Roll cancels: stopped if hitting wall/obstacle

---

## Epic 4: Responsive Networked Gameplay

**Goal:** Players experience smooth, fair combat despite network latency

**Value Delivered:** Lag-compensated controls that feel instant + cheat-proof server validation

**FRs Covered:** FR13 (client prediction), FR16 (latency <100ms)

---

### Story 4.1: Implement Client-Side Movement Prediction

As a player,
I want my movement to feel instant,
So that controls are responsive despite network latency.

**Acceptance Criteria:**

**Given** I press W key with 80ms ping to server
**When** I press the key
**Then** my stick figure immediately moves on screen (no delay)

**And** client predicts position using local physics simulation
**And** client stores pending inputs with sequence numbers
**And** when server confirms movement, client reconciles predicted vs authoritative position
**And** if prediction was correct: no visual change (smooth)
**And** if prediction was wrong: smoothly interpolate to server position (not teleport)

**And** other players' movement is interpolated (smooth, slightly delayed) not predicted
**And** my movement feels <50ms responsive (imperceptible lag)

**Prerequisites:** Story 3.6

**Technical Notes:**
- Client `PredictionEngine.ts` runs physics simulation identical to server
- Store pending inputs: `{sequence: number, input: InputState, timestamp: number}[]`
- Server responds with `player:moved` including sequence number
- Reconciliation: replay pending inputs after confirmed sequence
- Error threshold: if predicted position differs from server by >50px, teleport correction
- Otherwise: smooth lerp over 100ms to correct position
- Interpolation for other players: render at (now - 100ms) using buffered states

---

### Story 4.2: Implement Server Reconciliation for Corrections

As a player,
I want the server to correct impossible movements,
So that cheating is prevented without ruining my experience.

**Acceptance Criteria:**

**Given** my client predicts I moved through a wall
**When** the server detects impossible movement
**Then** the server sends correction with authoritative position

**And** my client receives `player:moved` with `corrected: true` flag
**And** client discards incorrect prediction, replays inputs from server position
**And** visual correction is smooth (not jarring teleport if <100px error)
**And** large corrections (>100px): instant teleport with visual effect (prevent wall clipping)

**And** corrections are rare (<1% of moves) in normal gameplay
**And** corrections are frequent (>10%) if attempting to cheat

**Prerequisites:** Story 4.1

**Technical Notes:**
- Server validates all moves: bounds check, obstacle collision, speed limits
- Invalid move: server recalculates correct position, sends `corrected: true`
- Client reconciliation: on correction, reset position to server value, replay pending inputs
- Smooth correction: if error <100px, lerp over 100ms
- Instant correction: if error ≥100px, set position immediately with flash effect
- Anti-cheat: log correction frequency per player, kick if >20% corrections

---

### Story 4.3: Implement Interpolation for Other Players

As a player,
I want other players' movements to appear smooth,
So that gameplay feels polished even with varied latency.

**Acceptance Criteria:**

**Given** I am watching another player with 100ms ping
**When** I receive their position updates at 20 Hz (every 50ms)
**Then** their stick figure moves smoothly between received positions (not teleporting)

**And** client interpolates between last and current position over the update interval
**And** interpolation uses linear or cubic smoothing (no jitter)
**And** if update is delayed (packet loss): continue extrapolating briefly, then freeze
**And** other players rendered at (current time - 100ms) for smooth interpolation buffer

**And** animations sync with interpolated movement (walk cycle matches speed)

**Prerequisites:** Story 4.2

**Technical Notes:**
- Client maintains position history: last 10 positions per player with timestamps
- Interpolation: render position at (now - 100ms) using buffered snapshots
- Lerp between snapshots: `pos = lerp(prevPos, nextPos, (now - prevTime) / (nextTime - prevTime))`
- Extrapolation: if no new data for 200ms, continue last velocity for max 100ms, then freeze
- Animation sync: walk speed = distance / time between frames
- Buffer size: 100ms = ~2 server updates (provides smoothing buffer)

---

### Story 4.4: Implement Delta Compression for Reduced Bandwidth

As a developer,
I want to reduce network bandwidth usage,
So that the game runs smoothly on mobile data and scales to 8 players.

**Acceptance Criteria:**

**Given** a match with 8 players
**When** the server broadcasts game state at 20 Hz
**Then** messages use delta compression (only send changed values)

**And** first state update: full snapshot (all player positions, health, etc.)
**And** subsequent updates: only deltas (changed values since last update)
**And** if player position changed: send `{id, x, y}`
**And** if player didn't move: omit from update
**And** if health changed: send `{id, health}`, else omit

**And** bandwidth usage per player: 2-5 KB/s (vs 10-15 KB/s without compression)
**And** full snapshots sent every 1 second (prevent delta drift)

**Prerequisites:** Story 4.3

**Technical Notes:**
- Server tracks last sent state per client: `lastSentState[clientId] = {players: {}, projectiles: {}}`
- Diff calculation: `for each entity, if (current !== lastSent) { include in delta }`
- Delta format: `{type: 'delta', changed: {players: [{id, x, y}], projectiles: [...]}}`
- Full snapshot: `{type: 'snapshot', full: {players: [...], weapons: [...]}}`
- Client applies deltas: merge with local state
- Handle missing deltas: full snapshot every 1s ensures consistency

---

### Story 4.5: Implement Lag Compensation for Hit Detection

As a player,
I want my shots to hit where enemies appeared on my screen,
So that the game feels fair despite latency differences.

**Acceptance Criteria:**

**Given** I shoot at an enemy who has 100ms ping
**When** I click to fire, enemy is at position {x: 500, y: 600} on my screen
**Then** the server rewinds the world state by my ping (50ms) plus enemy ping (50ms)

**And** server checks if shot hit enemy at their position 100ms ago
**And** if hit at rewound position: hit is counted (fair for shooter)
**And** enemy sees hit even though they already moved on their screen (minor trade-off)

**And** max rewind time: 150ms (prevent exploiting high latency)
**And** lag compensation applied to all hitscan weapons (instant bullets)
**And** projectile weapons (Uzi, AK47) don't rewind (projectile travel time is natural compensation)

**Prerequisites:** Story 4.4

**Technical Notes:**
- Server stores world history: last 200ms of positions (snapshots every 16ms = 60Hz)
- On hit check: rewind by `shooterPing + victimPing / 2` (clamp to 150ms max)
- Retrieve victim position from history at `now - rewindTime`
- Perform hit detection at rewound position
- If hit: apply damage at current time (all clients see damage simultaneously)
- Trade-off: shooter advantage (you hit what you see), victim can die around corners

---

### Story 4.6: Implement Artificial Latency Testing Tool

As a developer,
I want to simulate network latency in development,
So that I can test and tune netcode without needing poor connections.

**Acceptance Criteria:**

**Given** I am testing netcode locally
**When** I enable artificial latency via debug UI (press F8)
**Then** I can set latency value (e.g., 100ms) and packet loss % (e.g., 5%)

**And** all client-server messages are delayed by the set latency
**And** random packets are dropped based on packet loss percentage
**And** jitter simulation: latency varies ±20ms randomly
**And** debug overlay shows current simulated conditions

**And** netcode behaves identically to real poor network conditions
**And** I can test prediction, interpolation, and lag compensation offline

**Prerequisites:** Story 4.5

**Technical Notes:**
- Client `NetworkSimulator.ts` wraps WebSocket send/receive
- Delay implementation: `setTimeout(() => actualSend(msg), latency + jitter())`
- Packet loss: `if (Math.random() < packetLossRate) { return; /* drop */ }`
- Jitter: `Math.random() * 40 - 20` (±20ms)
- Debug UI: sliders for latency (0-300ms) and loss (0-20%)
- Toggle: F8 key or URL param `?latency=100&loss=5`
- Server-side version: environment variable `SIMULATE_LATENCY=100`

---

## Epic 5: Matchmaking & Lobbies

**Goal:** Players find balanced matches quickly without manual coordination

**Value Delivered:** Automated skill-based matchmaking, fast queue times

**FRs Covered:** FR1 (join matches), FR20 (skill-based matchmaking)

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

**Prerequisites:** Story 4.6

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
**Then** the server prefers matching me with players within ±200 MMR

**And** if no close-skill players available after 15 seconds: widen range to ±400 MMR
**And** if still no match after 30 seconds: widen to ±800 MMR (any skill)
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
  2. Group players within ±200 MMR
  3. If group ≥2 players: create match
  4. After 15s: relax to ±400, after 30s: ±800
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

---

## Epic 6: Player Identity & Progression

**Goal:** Players build persistent identity with unlockable rewards

**Value Delivered:** OAuth login, XP/leveling, cosmetics, stat tracking

**FRs Covered:** FR8 (XP/leveling), FR9 (OAuth), FR18 (cosmetics), FR19 (stats)

---

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
**Then** I earn XP calculated as: `(kills × 100) + (win × 100) + (top3 × 50) + 50`

**And** XP total: (5 × 100) + 100 + 50 + 50 = 700 XP
**And** XP bar fills on match end screen showing progress toward next level
**And** if XP exceeds level threshold: level up animation plays, "LEVEL UP!" notification

**And** level progression: Level 1 requires 100 XP, each level requires +100 more
- Level 1→2: 100 XP
- Level 2→3: 200 XP
- Level 3→4: 300 XP (total 600 XP to reach level 4)

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

---

## Epic 7: Arena Environments

**Goal:** Players experience varied tactical combat across different map designs

**Value Delivered:** 2-3 polished maps with distinct playstyles and strategic depth

**FRs Covered:** FR15 (2-3 maps)

---

### Story 7.1: Design and Implement Industrial Arena Map

As a player,
I want to play on a balanced industrial-themed map,
So that I can experience competitive mid-range combat.

**Acceptance Criteria:**

**Given** I join a match on Industrial Arena
**When** the map loads
**Then** I see an industrial warehouse environment with shipping containers and metal platforms

**And** map size: 1920 × 1080 pixels (fits one screen at standard zoom)
**And** 4 balanced spawn points (corners of map)
**And** 5 weapon pickup locations (1 center, 4 around perimeter)
**And** mix of open center area and tight corridors around edges

**And** map features:
- Shipping containers as cover (block bullets, players can hide behind)
- Metal platforms with ramps (verticality, height advantage)
- Open center area (favors ranged weapons)
- Tight corridors near edges (favors close-range weapons)

**And** visual style: industrial gray/brown color palette, high contrast
**And** minimap generated from map layout (top-right corner UI)

**Prerequisites:** Story 6.6

**Technical Notes:**
- Map data: JSON file `maps/industrial_arena.json` with {tilesmap, spawnPoints, weaponSpawns, obstacles}
- Tileset: 32×32 pixel tiles (floor, wall, platform sprites)
- Collision layer: binary grid for obstacles (1 = solid, 0 = passable)
- Phaser tilemap: `this.make.tilemap({data: mapData, tileWidth: 32, tileHeight: 32})`
- Spawn points: `[{x: 100, y: 100}, {x: 1820, y: 100}, {x: 100, y: 980}, {x: 1820, y: 980}]`
- Weapon spawns: `[{x: 960, y: 540, type: 'ak47'}, ...]`
- Minimap: render map at 10% scale in top-right corner

---

### Story 7.2: Design and Implement Urban Rooftops Map

As a player,
I want to play on a close-quarters urban map,
So that I can experience intense CQC combat.

**Acceptance Criteria:**

**Given** I join a match on Urban Rooftops
**When** the map loads
**Then** I see a rooftop environment with buildings, alleyways, and neon signs

**And** map size: 1920 × 1080 pixels
**And** 4 balanced spawn points
**And** 5 weapon pickup locations
**And** emphasis on tight spaces and close-quarters engagements

**And** map features:
- Multi-level rooftops connected by stairs/ladders
- Narrow alleyways between buildings (chokepoints)
- Drop-down areas (one-way vertical movement)
- Fewer open sightlines (favors shotgun/melee)

**And** visual style: urban nighttime, neon signs, dark blue/purple palette
**And** distinct from Industrial Arena (players can easily identify which map they're on)

**Prerequisites:** Story 7.1

**Technical Notes:**
- Map data: `maps/urban_rooftops.json`
- Multi-level: use layered tilemaps (ground level + rooftop level)
- Ladders: special tiles trigger vertical movement (climb animation)
- Drop-downs: one-way collision (can jump down but not up)
- Lighting: darker overall, neon signs glow (emissive sprites)
- Balance: more corners and cover (slower gameplay, tactical)

---

### Story 7.3: Implement Map Selection and Rotation

As a player,
I want to play on different maps,
So that gameplay stays fresh and varied.

**Acceptance Criteria:**

**Given** a match is created in matchmaking
**When** the match starts
**Then** a map is selected (Industrial Arena or Urban Rooftops)

**And** map selection is random or based on player votes (if lobby voting enabled)
**And** consecutive matches avoid repeating same map (rotation prevents staleness)
**And** all players receive `match:start` message with `{mapName: 'industrial_arena'}`

**And** map loads on all clients simultaneously
**And** if map fails to load: fallback to default map (Industrial Arena)

**Prerequisites:** Story 7.2

**Technical Notes:**
- Server map pool: `['industrial_arena', 'urban_rooftops']` (expandable array)
- Random selection: `maps[Math.floor(Math.random() * maps.length)]`
- Rotation tracking: store `lastMapPlayed` in room state, exclude from next selection
- Client map loading: `this.scene.start('GameScene', {mapName: 'industrial_arena'})`
- Map registry: `{industrial_arena: require('./maps/industrial_arena.json'), ...}`
- Error handling: if map JSON missing, use fallback default map

---

### Story 7.4: Optimize Map Assets and Loading Times

As a developer,
I want map loading to be fast,
So that matches start quickly (<15 seconds).

**Acceptance Criteria:**

**Given** a match starts
**When** the map loads
**Then** all assets (tiles, sprites, collision data) load in <10 seconds on desktop

**And** mobile devices load in <15 seconds
**And** loading screen displays progress bar (0-100%)
**And** loading screen shows map preview image (gives players context)

**And** assets are optimized:
- Tileset sprites: PNG with compression, max 512×512 spritesheet
- Map JSON: minified, <100 KB
- Preloading: critical assets loaded during lobby countdown

**Prerequisites:** Story 7.3

**Technical Notes:**
- Phaser preload: `this.load.image('tileset', 'assets/maps/tileset.png')`
- Progress bar: `this.load.on('progress', (value) => { progressBar.fillRect(0, 0, 800 * value, 50) })`
- Asset optimization: use TexturePacker for sprite atlases
- Compression: optimize PNGs with TinyPNG or similar
- Lazy loading: load only selected map assets (not all maps at once)
- Cache: assets cached in browser after first load (faster subsequent loads)

---

### Story 7.5: Implement Minimap with Player Positions

As a player,
I want a minimap showing player locations,
So that I can maintain tactical awareness.

**Acceptance Criteria:**

**Given** I am in a match
**When** I look at the minimap (top-right corner)
**Then** I see a small overview of the entire map

**And** my position: green dot or icon
**And** teammates (in TDM): blue dots
**And** enemies: red dots (visible if within 400px or recently fired weapon)
**And** weapon spawn locations: gray icons

**And** minimap updates in real-time (every 50ms)
**And** minimap is semi-transparent (doesn't obstruct gameplay)
**And** can toggle minimap visibility with M key

**Prerequisites:** Story 7.4

**Technical Notes:**
- Minimap: Phaser Graphics object rendering map at 1:10 scale
- Size: 200×120 pixels (fits in top-right corner)
- Player dots: 4px circles at scaled positions
- Fog of war: only show enemies if `distance < 400px || recentlyFired`
- Update frequency: every 50ms (20 Hz)
- Toggle: `this.minimap.setVisible(!this.minimap.visible)`
- Background: map silhouette with collision walls shown

---

## Epic 8: Mobile Cross-Platform Play

**Goal:** Mobile players compete fairly against desktop players

**Value Delivered:** Touch controls with aim assist, cross-platform compatibility

**FRs Covered:** FR17 (cross-platform browser access)

---

### Story 8.1: Implement Virtual Joystick Controls for Touch

As a mobile player,
I want intuitive touch controls,
So that I can play comfortably on my phone or tablet.

**Acceptance Criteria:**

**Given** I open the game on a mobile device
**When** the game detects touch input
**Then** two virtual joysticks appear: left (movement) and right (aim)

**And** left joystick: drag to move in any direction, distance from center = movement speed
**And** right joystick: drag to aim, auto-fires when aimed at enemies
**And** joysticks are semi-transparent, positioned in bottom corners

**And** alternative control scheme: tap to move to location (optional setting)
**And** buttons for reload, dodge, weapon switch (right side of screen)
**And** joysticks persist during match, hidden in menus

**Prerequisites:** Story 7.5

**Technical Notes:**
- Virtual joystick library: `nipplejs` or Phaser's built-in virtual joystick plugin
- Left joystick: position (100, 900), radius 80px
- Right joystick: position (1820, 900), radius 80px
- Movement input: `{x: joystick.force * cos(joystick.angle), y: joystick.force * sin(joystick.angle)}`
- Auto-fire: when aiming joystick active + enemy in crosshair, trigger shoot
- UI buttons: reload (right side, top), dodge (right side, middle), weapon switch (right side, bottom)

---

### Story 8.2: Implement Mobile Aim Assist

As a mobile player,
I want aim assistance,
So that I can compete fairly with desktop mouse users.

**Acceptance Criteria:**

**Given** I am aiming with touch controls
**When** my crosshair is near an enemy (within 50 pixels)
**Then** aim is subtly magnetized toward enemy center (slowdown + attraction)

**And** aim assist strength: low (doesn't feel like aimbot, enhances natural aim)
**And** aim slowdown: when aiming over enemy, sensitivity reduces by 30%
**And** aim attraction: crosshair pulled toward enemy at 20% of distance per frame

**And** aim assist only active for mobile touch input (not desktop)
**And** setting to adjust aim assist strength: Off / Low / Medium / High
**And** aim assist doesn't work through walls (only visible enemies)

**Prerequisites:** Story 8.1

**Technical Notes:**
- Detection: `if (platform === 'mobile' && aimAssistEnabled)`
- Slowdown: `sensitivity *= 0.7` when crosshair within 50px of enemy
- Attraction: `aimAngle += (angleToEnemy - aimAngle) * 0.2` (smooth lerp)
- Visibility check: raycast from player to enemy, if wall hit, disable assist
- Settings: `aimAssistStrength` multiplier (0 = off, 0.5 = low, 1.0 = medium, 1.5 = high)
- Balance: tune in playtesting, goal is parity not advantage

---

### Story 8.3: Optimize Mobile Performance and Battery Usage

As a mobile player,
I want smooth 60 FPS gameplay without draining my battery,
So that I can play for extended sessions.

**Acceptance Criteria:**

**Given** I play on a mid-range mobile device (e.g., iPhone 12, Samsung S21)
**When** the game runs
**Then** I achieve 60 FPS in matches with 8 players

**And** battery consumption: 2+ hours of gameplay per full charge
**And** game auto-detects device capability and adjusts graphics quality
**And** mobile optimizations:
- Reduced particle effects (fewer particles, shorter lifetime)
- Lower texture resolution (half-res sprites)
- Simplified lighting (no dynamic shadows)
- Reduced network update frequency (15 Hz instead of 20 Hz)

**And** manual quality settings: Low / Medium / High / Auto (in settings menu)

**Prerequisites:** Story 8.2

**Technical Notes:**
- Device detection: `navigator.userAgent`, screen size, WebGL capabilities
- Auto-quality: benchmark FPS for 10 seconds, adjust down if <50 FPS
- Particle reduction: max 20 particles instead of 100
- Texture resolution: load mobile-specific assets at 50% resolution
- Network: mobile clients receive 15 Hz updates (vs 20 Hz desktop)
- Battery: use `requestAnimationFrame` with adaptive frame skipping if battery low
- Settings: dropdown menu for quality preset

---

### Story 8.4: Implement Responsive UI for Mobile Screens

As a mobile player,
I want a UI that fits my screen,
So that all information is readable and accessible.

**Acceptance Criteria:**

**Given** I play on a mobile device with 414×896 resolution (iPhone)
**When** the UI renders
**Then** all elements scale appropriately (no tiny text or buttons)

**And** HUD elements repositioned:
- Health bar: larger, bottom-left corner
- Ammo counter: larger, bottom-right corner
- Minimap: smaller or hidden (toggle with button)
- Kill feed: shorter, shows only last 3 kills
- Scoreboard: fullscreen overlay (not inline)

**And** touch targets: minimum 44×44 pixels (iOS guideline)
**And** font sizes: minimum 14px (readable on small screens)
**And** portrait mode: disabled, landscape-only (show "Rotate device" message)

**Prerequisites:** Story 8.3

**Technical Notes:**
- Responsive design: use CSS media queries or Phaser responsive scaling
- Phaser scale config: `{mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH}`
- Touch target size: all buttons at least 44×44 px
- HUD scaling: multiply sizes by `isMobile ? 1.5 : 1.0`
- Portrait check: `if (window.innerHeight > window.innerWidth) { showRotateMessage() }`
- React components: use responsive breakpoints (styled-components or TailwindCSS)

---

### Story 8.5: Implement iOS Safari Specific Workarounds

As a mobile player on iOS,
I want the game to work reliably on Safari,
So that I can play without technical issues.

**Acceptance Criteria:**

**Given** I play on iOS Safari
**When** the game loads
**Then** audio autoplay policy is handled (requires user interaction)

**And** audio starts after first tap anywhere on screen
**And** fullscreen mode works (press fullscreen button, Safari enters fullscreen)
**And** WebSocket connection remains stable during tab switching
**And** memory management: no crashes after 30 minutes of play

**And** iOS quirks handled:
- Audio context must be resumed on user gesture
- Canvas doesn't overflow viewport (no scroll)
- Touch events don't trigger zoom or scroll
- Home indicator hidden in fullscreen

**Prerequisites:** Story 8.4

**Technical Notes:**
- Audio: create AudioContext after first touch event `document.addEventListener('touchstart', () => audioContext.resume(), {once: true})`
- Fullscreen: use `document.documentElement.requestFullscreen()` on button press
- Viewport meta tag: `<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">`
- Touch events: `{passive: false, capture: true}` to prevent default scroll
- Memory: limit texture cache size, unload unused assets
- Home indicator: CSS `env(safe-area-inset-bottom)` for padding

---

## Epic 9: Polish & Production Launch

**Goal:** Players experience polished, reliable game ready for public audience

**Value Delivered:** Visual effects, audio, monitoring, stable deployment

**FRs Covered:** FR14 (HUD), FR16 (performance)

---

### Story 9.1: Implement Visual Effects and Particles

As a player,
I want satisfying visual feedback,
So that combat feels impactful and polished.

**Acceptance Criteria:**

**Given** I am in combat
**When** I shoot a weapon
**Then** I see muzzle flash particle effect (bright flash, fades in 0.1s)

**And** bullet tracer: line from gun to impact point (visible for 0.2s)
**And** bullet impact: spark particles on wall hit, blood splatter on player hit
**And** damage numbers: floating text showing damage dealt (red, rises and fades)

**And** death effect: ragdoll animation + particle explosion
**And** weapon pickup: glow effect pulsing around weapon sprite
**And** respawn: fade-in effect with spawn protection glow

**And** screen shake on taking damage (camera shakes for 0.2s)
**And** all effects optimized (no FPS drop below 55 on desktop, 45 on mobile)

**Prerequisites:** Story 8.5

**Technical Notes:**
- Phaser particle emitters: `this.add.particles('spark').createEmitter({...})`
- Muzzle flash: 10-particle burst, lifespan 100ms, scale 0.5-1.5
- Bullet tracer: Phaser line graphic, alpha fades from 1 to 0 over 200ms
- Damage numbers: Phaser text object, moves up 50px while fading
- Blood splatter: 5-particle burst, red tint, sticks to ground for 2s
- Screen shake: `this.cameras.main.shake(200, 0.01)`
- Performance: pool particles (reuse instead of create/destroy)

---

### Story 9.2: Integrate Audio and Sound Effects

As a player,
I want clear, satisfying audio,
So that I can hear combat and feel immersed.

**Acceptance Criteria:**

**Given** I am in a match
**When** I shoot the Uzi
**Then** I hear rapid gunfire sound effect (matches 10/s fire rate)

**And** each weapon has unique sound:
- Uzi: rapid "brrt brrt" (high pitch)
- AK47: heavier "bang bang" (mid pitch)
- Shotgun: loud "boom" (low pitch, bass)
- Bat: "whoosh" then "thwack" on hit
- Katana: "slash" sound

**And** hit confirmation: distinct "ding" sound when landing shots
**And** footsteps: subtle step sounds (louder when sprinting)
**And** damage taken: grunt/impact sound
**And** death: death sound effect
**And** UI sounds: menu clicks, button hovers

**And** spatial audio: gunfire from other players has directional positioning
**And** volume controls: master, music, SFX (independent sliders in settings)

**Prerequisites:** Story 9.1

**Technical Notes:**
- Audio format: MP3 or OGG (browser-compatible)
- Source: royalty-free SFX packs (GameAudioGDC, Kenney.nl)
- Phaser audio: `this.sound.add('uzi_fire', {volume: 0.5})`
- Spatial audio: `sound.setVolume(distance < 400 ? 1.0 : 0.3)`, pan based on x position
- Sound pooling: create multiple sound instances for overlapping (e.g., multiple Uzi shots)
- Settings: `localStorage` stores volume preferences

---

### Story 9.3: Implement Kill Feed and Scoreboard HUD

As a player,
I want to see recent kills and current scores,
So that I can track match progress.

**Acceptance Criteria:**

**Given** I am in a match
**When** a kill occurs
**Then** kill feed updates (top-right corner): "[Killer] eliminated [Victim] with [Weapon]"

**And** kill feed shows last 5 kills, oldest fades out
**And** my kills highlighted in different color (green)
**And** kill feed includes weapon icon next to message

**And** scoreboard (Tab key):
- Shows all players ranked by kills
- Displays: Name, Kills, Deaths, Ping
- My row highlighted
- Updates in real-time

**And** match timer visible (top-center): "5:23 remaining"
**And** kill target progress: "First to 20 kills" (below timer)

**Prerequisites:** Story 9.2

**Technical Notes:**
- Kill feed: React component with array of kill events
- Kill event: `{killerId, victimId, weapon, timestamp}`
- Feed update: on `player:killed` message, add to feed, remove oldest if >5
- Fade animation: CSS transition, opacity 1→0 over 0.5s after 5 seconds
- Scoreboard: React component, visible when Tab pressed
- Scoreboard data: sorted by kills descending
- Timer: server sends `match:time` every second with remaining seconds
- Render: `Math.floor(seconds / 60)}:${seconds % 60}`

---

### Story 9.4: Implement Server Monitoring and Metrics

As a developer,
I want real-time server monitoring,
So that I can detect and fix issues proactively.

**Acceptance Criteria:**

**Given** the server is running
**When** I access monitoring dashboard (Grafana)
**Then** I see real-time metrics:
- Active players (gauge: current count)
- Active matches (gauge: room count)
- Server CPU usage (line chart: %)
- Server memory usage (line chart: MB)
- Average latency (line chart: ms)
- Messages per second (line chart: count)
- Error rate (line chart: errors/min)

**And** alerts configured:
- CPU >80% for 5 minutes → alert
- Latency >150ms for 20% players → alert
- Error rate >10/min → alert
- Server crash → immediate alert

**And** logs are structured (JSON) and searchable
**And** can drill down into specific player sessions

**Prerequisites:** Story 9.3

**Technical Notes:**
- Metrics library: Prometheus client for Go
- Expose metrics: `/metrics` endpoint (Prometheus scrape target)
- Metrics collected:
  - `active_players` (gauge)
  - `active_matches` (gauge)
  - `cpu_usage_percent` (gauge)
  - `memory_usage_bytes` (gauge)
  - `websocket_messages_total` (counter)
  - `latency_milliseconds` (histogram)
  - `errors_total` (counter)
- Grafana dashboard: import JSON with pre-configured panels
- Alerts: Prometheus Alertmanager with webhook to Discord/Slack
- Logging: structured JSON logs with `{level, message, playerId, timestamp}`

---

### Story 9.5: Deploy to Production with CI/CD Pipeline

As a developer,
I want automated deployments,
So that updates are deployed reliably and quickly.

**Acceptance Criteria:**

**Given** I push code to GitHub main branch
**When** CI/CD pipeline runs
**Then** automated tests execute (frontend + backend)

**And** if tests pass: build production artifacts
- Frontend: Vite build → static assets
- Backend: Go binary compilation

**And** artifacts deployed:
- Frontend → Vercel/Netlify (automatic deployment)
- Backend → VPS via SSH (rsync + systemd restart)

**And** deployment completes in <10 minutes
**And** zero-downtime deployment: old server continues until new server ready
**And** rollback capability: if deployment fails, revert to previous version

**And** post-deployment: health check verifies server responding
**And** notification: Discord webhook announces deployment success/failure

**Prerequisites:** Story 9.4

**Technical Notes:**
- CI/CD: GitHub Actions workflow `.github/workflows/deploy.yml`
- Frontend deploy: Vercel GitHub integration (auto-deploy on push)
- Backend deploy steps:
  1. Run tests: `go test ./...`
  2. Build binary: `GOOS=linux GOARCH=amd64 go build -o server cmd/server/main.go`
  3. SCP to VPS: `rsync -avz server user@vps:/opt/stick-rumble/`
  4. Restart service: `ssh user@vps 'sudo systemctl restart stick-rumble'`
  5. Health check: `curl https://yourdomain.com/health`
- Zero-downtime: use systemd socket activation or blue-green deployment
- Rollback: keep last 5 binaries, script to revert: `cp server.backup server && systemctl restart`
- Notifications: use GitHub Actions Discord webhook action

---

### Story 9.5A: Backend Server Deployment to Cloud VPS

**MOVED FROM EPIC 1:** Production deployment belongs in polish/launch epic.
**NOTE:** Not yet added to ReadyQ - will be added when Epic 8 is complete.

As a developer,
I want the backend Go server deployed to a cloud VPS with systemd service,
So that the game can be tested and played remotely in production.

**Acceptance Criteria:**

**Given** a VPS instance (DigitalOcean/Hetzner/Fly.io) provisioned
**When** I deploy the Go server binary
**Then** the server is accessible at `ws://[public-ip]:8080/ws`

**And** server runs as a systemd service (auto-restart on crash)
**And** systemd service file exists at `/etc/systemd/system/stick-rumble.service`
**And** firewall allows traffic on port 8080 (WebSocket) and port 443 (HTTPS)
**And** server logs are accessible via `journalctl -u stick-rumble -f`
**And** basic health check endpoint `/health` responds with 200 OK
**And** deploy script automates: build binary, transfer to VPS, restart service

**Prerequisites:** Core game features complete (Epic 2-8)

**Technical Notes:**
- VPS requirements: 2GB RAM, 2 vCPUs minimum, Ubuntu 22.04 LTS
- Systemd service: runs as non-root user `stickrumble`
- Deploy script: `deploy.sh` automates build + rsync + restart
- Server binary location: `/opt/stick-rumble/server`
- Environment variables: configure via `/etc/stick-rumble/.env`
- Basic deployment first (HTTP/WS), SSL/TLS added in Story 9.5B

---

### Story 9.5B: Frontend Deployment and SSL/TLS Configuration

**MOVED FROM EPIC 1:** SSL/TLS configuration for production launch.
**NOTE:** Not yet added to ReadyQ - will be added when Epic 8 is complete.

As a developer,
I want the frontend deployed with SSL/TLS and configured to connect to the production backend,
So that players can access the game securely from anywhere.

**Acceptance Criteria:**

**Given** Story 9.5A backend is deployed and running
**When** I configure TLS/SSL certificate with Let's Encrypt
**Then** the server is accessible at `wss://[domain]/ws` (secure WebSocket)

**And** TLS/SSL certificate configured using Caddy or Certbot
**And** certificate auto-renews before expiration
**And** clients can connect from any network using wss:// protocol
**And** HTTP traffic redirects to HTTPS (port 80 → 443)
**And** frontend build deployed to Vercel/Netlify
**And** environment variable `VITE_WS_URL=wss://yourdomain.com/ws` configured
**And** production frontend connects successfully to production backend
**And** deployment process documented in README.md

**Prerequisites:** Story 9.5A

**Technical Notes:**
- Use Caddy for automatic Let's Encrypt SSL (simpler than Certbot)
- Caddyfile config: reverse proxy from domain to localhost:8080
- Frontend deployment: Vercel (preferred) or Netlify with auto-deploy on git push
- Environment variables: separate `.env.production` for production WebSocket URL
- Test end-to-end: open production URL, verify WebSocket connection established
- Document: deployment process, domain DNS setup, troubleshooting

---

## FR Coverage Matrix

**Complete traceability from functional requirements to implementation:**

- **FR1 (Players join matches via matchmaking):**
  - Epic 5, Story 5.1: Matchmaking Queue
  - Epic 5, Story 5.2: Skill-Based Matchmaking
  - Epic 5, Story 5.3: Lobby with Ready System

- **FR2 (Control stick figures with WASD/touch + 360° aim):**
  - Epic 2, Story 2.1: Player Movement
  - Epic 2, Story 2.2: Mouse Aim
  - Epic 8, Story 8.1: Virtual Joystick (touch)

- **FR3 (Shoot weapons with click/tap, see hit feedback):**
  - Epic 2, Story 2.3: Basic Shooting
  - Epic 2, Story 2.4: Hit Detection
  - Epic 9, Story 9.1: Visual Effects (hit feedback)

- **FR4 (Pick up weapons from map spawns):**
  - Epic 3, Story 3.1: Weapon Pickup System
  - Epic 3, Story 3.2: Melee Weapons
  - Epic 3, Story 3.3: Ranged Weapons

- **FR5 (Reload manually, switch weapons instantly):**
  - Epic 3, Story 3.4: Manual Reload

- **FR6 (Sprint and dodge/roll with i-frames):**
  - Epic 3, Story 3.5: Sprint Mechanic
  - Epic 3, Story 3.6: Dodge Roll

- **FR7 (Respawn after death within 3 seconds):**
  - Epic 2, Story 2.5: Health System and Death

- **FR8 (Earn XP and level up):**
  - Epic 6, Story 6.3: XP and Leveling

- **FR9 (OAuth authentication, persistent accounts):**
  - Epic 6, Story 6.1: Google OAuth
  - Epic 6, Story 6.2: Guest Play
  - Epic 6, Story 6.6: Session Management

- **FR10 (Free-For-All Deathmatch):**
  - Epic 2, Story 2.6: FFA Win Condition

- **FR11 (Team Deathmatch):**
  - Epic 5, Story 5.4: Game Mode Selection (TDM option)

- **FR12 (Server-authoritative hit detection):**
  - Epic 2, Story 2.4: Server-Authoritative Hit Detection
  - Epic 4, Story 4.2: Server Reconciliation

- **FR13 (Client-side prediction for responsive controls):**
  - Epic 4, Story 4.1: Client-Side Prediction
  - Epic 4, Story 4.3: Interpolation

- **FR14 (HUD with health, ammo, minimap, kill feed, scoreboard):**
  - Epic 7, Story 7.5: Minimap
  - Epic 9, Story 9.3: Kill Feed and Scoreboard

- **FR15 (2-3 arena maps with balanced layouts):**
  - Epic 7, Story 7.1: Industrial Arena
  - Epic 7, Story 7.2: Urban Rooftops
  - Epic 7, Story 7.3: Map Selection

- **FR16 (60 FPS client, <100ms network latency):**
  - Epic 1, Story 1.4: Basic Room Sync
  - Epic 4, Story 4.4: Delta Compression
  - Epic 4, Story 4.5: Lag Compensation
  - Epic 8, Story 8.3: Mobile Performance

- **FR17 (Instant browser access, cross-platform):**
  - Epic 1, Story 1.1: Frontend Project Setup
  - Epic 1, Story 1.5: Cloud Deployment
  - Epic 8: (entire epic for cross-platform mobile)

- **FR18 (Customize appearance with cosmetics):**
  - Epic 6, Story 6.5: Cosmetic Customization

- **FR19 (Track player stats persistently):**
  - Epic 6, Story 6.4: Stats Tracking

- **FR20 (Skill-based matchmaking with hidden MMR):**
  - Epic 5, Story 5.2: Skill-Based Matchmaking

**Validation:** All 20 functional requirements fully covered by epic stories ✅

---

## Summary

**Epic Breakdown Complete!**

**Total Epics:** 9
**Total Stories:** 56
**All FRs Covered:** ✅ (20/20 mapped to stories)

**Epic Flow:**
1. **Foundation** → Dev environment + multiplayer proof-of-concept
2. **Core Combat** → Playable deathmatch with shooting/respawn
3. **Weapon Systems** → 5 weapons + movement mechanics
4. **Netcode** → Smooth lag-compensated gameplay
5. **Matchmaking** → Automated queues + lobbies
6. **Progression** → OAuth, XP, stats, cosmetics
7. **Maps** → 2-3 tactical arenas
8. **Mobile** → Touch controls + cross-platform parity
9. **Polish** → Effects, audio, monitoring, deployment

**Context Incorporated:**
- ✅ GDD requirements
- ✅ Architecture technical decisions
- ✅ Server-authoritative netcode pattern
- ✅ Phaser + Golang stack
- ✅ OAuth + PostgreSQL + Redis infrastructure

**Ready for Phase 4 Implementation!**

Next recommended action: `/bmad:bmgd:workflows:sprint-planning` to generate sprint status tracker from these epics.

---

_For implementation: Use the `create-story` workflow to generate individual story implementation plans from this epic breakdown._

