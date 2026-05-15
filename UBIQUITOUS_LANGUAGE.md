# Ubiquitous Language

## Identity & Authentication

| Term | Definition | Aliases to avoid |
|------|------------|------------------|
| **Player** | A connected WebSocket session with an ephemeral UUID (`Player.ID`). Represents one socket connection, not a persistent identity. | Connection, session (ambiguous) |
| **Account** | A persistent player identity stored in the database with a stable UUID (`AccountID`). Created via Google OAuth. | Profile, user, player (ambiguous) |
| **AccountID** | The persistent database UUID of an **Account**. One **Account** can have many **Player** sessions over time. Nil for **Guests**. | playerId, user id, account id |
| **Guest** | A **Player** with no **Account**. All stats are ephemeral — no lifetime tracking, no progression. | Anonymous, unregistered |
| **Display Name** | A 1-16 character label shown to other players. For authed **Players**, the DB-stored name is authoritative. For **Guests**, it's set via `player:hello`. | Nickname, username, handle |
| **Google OAuth** | The sole authentication method. The server validates Google ID tokens and issues **Session Tokens**. No passwords. | Google sign-in, OAuth, login |
| **Session Token** | A 256-bit opaque bearer token, base64url-encoded, stored in `localStorage`. Presented via `?token=` on WebSocket upgrade or `Authorization: Bearer` on HTTP endpoints. | Token, auth token |

## Gameplay Identity

| Term | Definition | Aliases to avoid |
|------|------------|------------------|
| **PlayerState** | The in-game physics state of a **Player** — position, velocity, health, kills, deaths, XP. Lives in the **World** during a match. | Game state, physics state, world entity |
| **PlayerScore** | A snapshot of a **Player**'s match performance at end-of-match: kills, deaths, XP, and **AccountID** (internal only). | Score entry, match result |
| **Match** | A single round of gameplay with a start, running phase, and end condition (time limit or kill target). | Game, round |
| **Room** | A server-side grouping of **Players** who will play a **Match** together. Has a code for code-rooms. | Lobby (avoid — that's the client screen) |

## Progression

| Term | Definition | Aliases to avoid |
|------|------------|------------------|
| **XP** | Experience points earned per kill (100 XP each). Accumulates on **PlayerState** during a match, then added to **Lifetime Stats** at **Match** end. | Experience, points, score |
| **Level** | Derived from cumulative lifetime XP via `levelForXp()`. Linear curve: Level N requires `N * 500` XP. Purely cosmetic in MVP. | Rank, tier, badge |
| **Lifetime Stats** | Persistent accumulation of kills, deaths, XP, games played, wins, and per-weapon kills across all **Matches** for an **Account**. | Career stats, lifetime stats, overall stats |
| **Level-Up Toast** | A non-intrusive Phaser overlay shown in the **Lobby** after a **Match** when a **Level** threshold is crossed. | Level up notification, level popup |

## Client Screens & Flow

| Term | Definition | Aliases to avoid |
|------|------------|------------------|
| **Sign-In Screen** | Landing page with Google OAuth button and "Play as Guest" link. Shown when no valid **Session Token** exists. | Login screen, welcome page |
| **Display Name Picker** | First-login screen shown after Google OAuth when the **Account** has no **Display Name** yet. | Name picker, name selector, choose name |
| **Lobby** | Pre-match hub showing the **Player**'s **Level**, **Lifetime Stats**, avatar, room code, and Play/Profile/Sign-Out actions. | Main menu, home screen, staging area |
| **Profile Screen** | Full stats dashboard showing all **Lifetime Stats** including per-weapon kill breakdown. | Stats screen, career screen |
| **Match Session Flow** | The client state machine that manages join → match → post-match lifecycle. Distinct from the app screen flow. | Session state, match lifecycle |

## Relationships

- A **Player** (WebSocket connection) may or may not have an **Account**. If it does, `Player.AccountID` is set.
- An **Account** has exactly one set of **Lifetime Stats**.
- A **Match** produces one **PlayerScore** per participating **Player**.
- **XP** is earned per-match on **PlayerState**, then merged into **Lifetime Stats** at **Match** end.
- **Lifetime Stats** are the source of truth for **Level** calculation.
- The **Lobby** and **Profile Screen** load data from `GET /api/player/me`, which reads **Lifetime Stats** and computes **Level** server-side.
- One **Room** hosts exactly one **Match** at a time.
- A **Guest** has no **AccountID**, no **Lifetime Stats**, and never triggers **Level-Up Toast**.

## Example Dialogue

> **Dev:** "When an authenticated **Player** connects, do we assign a new **Player.ID** or reuse the **AccountID**?"
>
> **Domain expert:** "Always a fresh **Player.ID** — it's the ephemeral WebSocket session UUID. The **AccountID** is stored separately on the **Player** struct. The gameplay code never sees the **AccountID**; only the match-end processing needs it."
>
> **Dev:** "So when **ProcessMatchEndStats** runs, it reads the **PlayerScore.AccountID** (an internal field, stripped from WebSocket broadcasts) to look up the **Lifetime Stats** record?"
>
> **Domain expert:** "Exactly. The broadcast only sends `playerId` (the ephemeral **Player.ID**), `displayName`, kills, deaths, and XP. The **AccountID** is purely for the server-side DB update."
>
> **Dev:** "And a **Guest** — with `AccountID = nil` — gets skipped entirely in that processing?"
>
> **Domain expert:** "Yes. **Guests** see 'Sign in to save your stats!' after the match, but the match XP is ephemeral. They have no **Lifetime Stats** record."

## Flagged Ambiguities

- **"player"** — Used in the codebase to mean both the WebSocket connection context (`game.Player` in `room.go`) and the in-game physics state (`game.PlayerState` in `player.go`). These are distinct concepts. The glossary resolves this: **Player** = connection/session context, **PlayerState** = game world physics context. The `AccountID` bridge lives on **Player** (set at upgrade) and is copied to **PlayerState** (for match-end stats) with `json:"-"` to avoid serialization.
- **"session"** — Used for both the **Session Token** (auth) and the **Match Session Flow** (client state machine). These are unrelated. The glossary distinguishes them: **Session Token** for auth, **Match Session Flow** for the client state machine.
- **"lobby"** — Used in the specs to mean both the React screen (pre-match hub) and the in-game room's waiting state. The glossary reserves **Lobby** for the React screen. The server uses `SessionStatusWaitingForPlayers` for the waiting state.

## New Term Candidates

- **ProcessMatchEndStats** — The server-side function that takes match results, looks up **Lifetime Stats** by **AccountID**, accumulates values, detects **Level** changes, and persists. Cross-cutting between the match system and the accounts system.
