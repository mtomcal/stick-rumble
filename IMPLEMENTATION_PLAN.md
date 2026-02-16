# Spec Drift Fix Plan

> Reference file for the worker loop. Read this at the START of each iteration to know what to do.

## Context

The specs in `specs/` were bulk-updated and then validated by a prior Ralph job. That validation found 104 drift findings (39 HIGH, 37 MEDIUM, 28 LOW). This job fixes them all by editing specs to match the actual source code.

### Context Table

| # | Spec File | Findings | Key Source Files |
|---|-----------|----------|------------------|
| 1 | constants.md | 1 | `stick-rumble-client/src/game/entities/HealthBar.ts` |
| 2 | movement.md | 2 | `stick-rumble-server/internal/game/physics.go`, `gameserver.go`, `PredictionEngine.ts`, `GameScene.ts` |
| 3 | networking.md | 1 | `events-schema/package.json` |
| 4 | messages.md | 7 | `player.go`, `broadcast_helper.go`, `message_processor.go`, `server-to-client.ts` |
| 5 | client-architecture.md | 5 | `PlayerManager.ts`, `ShootingManager.ts`, `GameScene.ts`, `GameSceneUI.ts` |
| 6 | server-architecture.md | 10 | `gameserver.go`, `message_processor.go`, `websocket_handler.go`, `room.go`, `clock.go`, `main.go` |
| 7 | hit-detection.md | 7 | `projectile.go`, `gameserver.go`, `physics.go`, `GameSceneEventHandlers.ts` |
| 8 | shooting.md | 9 | `gameserver.go`, `weapon.go`, `ShootingManager.ts` |
| 9 | weapons.md | 4 | `weapon.go`, `weapon-configs.json`, `weapon_factory.go`, `weaponConfig.ts` |
| 10 | overview.md | 7 | `client-to-server.ts`, `server-to-client.ts`, `gameserver.go`, `world.go` |
| 11 | rooms.md | 4 | `room.go`, `GameSceneEventHandlers.ts`, `server-to-client.ts` |
| 12 | ui.md | 12 | `KillFeedUI.ts`, `GameSceneUI.ts`, `MatchEndScreen.tsx`, `WebSocketClient.ts`, `GameScene.ts` |
| 13 | match.md | 2 | `GameSceneUI.ts`, `GameSceneEventHandlers.ts` |
| 14 | dodge-roll.md | 4 | `physics.go`, `GameSceneEventHandlers.ts`, `GameScene.ts`, `message_processor.go` |
| 15 | melee.md | 1 | `gameserver.go`, `world.go` |
| 16 | arena.md | 7 | `weapon_crate.go`, `world.go`, `physics.go` |
| 17 | README.md | 6 | N/A (cross-references to other specs) |
| 18 | test-index.md | 7 | Cross-references to all spec test sections |
| 19 | spec-of-specs-plan.md | 4 | N/A (historical plan doc) |
| 20 | SPEC-OF-SPECS.md | 8 | `constants.ts`, `server-to-client.ts`, `client-to-server.ts` |

## Fix Checklist

### Tier 1 — HIGH severity (factually incorrect, fix first)

**What to Check:** Code blocks with wrong struct fields, function signatures, or constant values. Verify the spec's code snippet matches the actual source line-for-line.

- [x] 1. constants.md — Health bar dimensions (HEALTH_BAR_WIDTH=40/HEIGHT=6 vs actual 32/4)
- [x] 2. movement.md — Remove nonexistent `sanitizeDeltaTime` function docs
- [x] 5. messages.md — Fix PlayerState Go struct (wrong field names, missing fields)
- [ ] 6. messages.md — Add missing `weaponType` note for projectile:spawn Go broadcast
- [ ] 7. messages.md — Fix weapon:pickup_confirmed nextRespawnTime (Unix timestamp, not ms duration)
- [ ] 15. server-architecture.md — Fix GameServer callback signatures (broadcastFunc, onReloadComplete, onHit, onRespawn)
- [ ] 19. server-architecture.md — Fix setupCallbacks method references and signatures
- [ ] 24. server-architecture.md — Remove nonexistent `sanitizePosition` function docs
- [ ] 26. hit-detection.md — Fix checkHitDetection onHit call signature (HitEvent struct, not individual params)
- [ ] 28. hit-detection.md — Fix hitscan invulnerability check (doesn't check IsInvulnerable/IsInvincibleFromRoll)
- [ ] 32. shooting.md — Fix ShootResult.FailReason to .Reason
- [ ] 34. shooting.md — Fix PlayerShoot alive check (only checks !exists, not IsAlive)
- [ ] 36. shooting.md — Fix StartReload IsMelee check (actually checks IsReloading + full magazine)
- [ ] 42. weapons.md — Fix Uzi visual config values (muzzleFlashSize=8, duration=50)
- [ ] 49. overview.md — Fix GameServer struct (no Room/Match/ticker/broadcaster fields)
- [ ] 50. overview.md — Fix anti-cheat PlayerShoot pseudocode (no IsDead check, weaponStates map)
- [ ] 53. rooms.md — Fix room:joined data payload (includes roomId from server)
- [ ] 87. test-index.md — Fix priority counts per spec (systematically inflated Critical counts)
- [ ] 88. test-index.md — Fix summary statistics totals
- [ ] 89. test-index.md — Fix category counts (Unit/Integration/Visual mismatches)
- [ ] 91. test-index.md — Fix description scrambling (wrong IDs mapped to descriptions)
- [ ] 92. test-index.md — Remove or flag 15 netcode test IDs not in source specs
- [ ] 97. SPEC-OF-SPECS.md — Fix DECELERATION constant (50 vs actual 1500 px/s^2)
- [ ] 98. SPEC-OF-SPECS.md — Fix Server->Client message count (19 listed but 22 actual)

### Tier 2 — MEDIUM severity (missing info or misleading)

**What to Check:** Prose descriptions that contradict source behavior, missing fields/params, wrong method names. Verify the spec's narrative matches actual control flow.

- [ ] 3. movement.md — Fix client-side prediction asymmetries (velocity cap, sprint speed)
- [ ] 8. messages.md — Fix player:damaged melee path (missing projectileId)
- [ ] 10. client-architecture.md — Fix dodge roll visual (rotation+flicker, not alpha)
- [ ] 11. client-architecture.md — Fix ShootingManager.shoot() vs meleeAttack() separation
- [ ] 16. server-architecture.md — Fix tick() deltaTime (real elapsed, not fixed from tickRate)
- [ ] 18. server-architecture.md — Fix handleInputState (direct type assertions, no NaN sanitization)
- [ ] 20. server-architecture.md — Fix Room.Broadcast (non-blocking select, not blocking channel)
- [ ] 23. server-architecture.md — Fix main.go pattern (global singleton, not explicit handler)
- [ ] 25. hit-detection.md — Fix Projectile SpawnPosition json tag (json:"-", not "spawnPosition")
- [ ] 27. hit-detection.md — Fix death trigger (inline in onHit, not separate handleDeath method)
- [ ] 30. hit-detection.md — Fix client handlePlayerDeath (setVisible+spectator, not death animation)
- [ ] 31. hit-detection.md — Fix tick() method (9 steps, not 4)
- [ ] 33. shooting.md — Fix PlayerShoot locking (weaponMu.RLock, not gs.mu.Lock)
- [ ] 35. shooting.md — Fix projectile creation (CreateProjectile, not NewProjectile+AddProjectile)
- [ ] 37. shooting.md — Fix CanShoot scope (also checks IsReloading and CurrentAmmo)
- [ ] 38. shooting.md — Fix client shoot() signature (no params, uses this.aimAngle)
- [ ] 41. weapons.md — Fix Weapon struct (add IsHitscan field)
- [ ] 43. weapons.md — Fix CreateWeaponByType return (returns error too)
- [ ] 45. overview.md — Fix message type counts (6 C→S, 22 S→C = 28 total)
- [ ] 46. overview.md — Fix spec file listing (missing 6 specs)
- [ ] 52. rooms.md — Fix AddPlayer Go code (RoomManager sends room:joined, not caller)
- [ ] 54. rooms.md — Fix processPendingMessages (pending moves discarded, not replayed)
- [ ] 56. ui.md — Fix kill feed ordering (push+shift, not unshift+pop)
- [ ] 57. ui.md — Fix hit marker shape (+ pattern, not X)
- [ ] 58. ui.md — Fix match end screen title/format
- [ ] 60. ui.md — Fix ammo low-ammo color (no color change logic exists)
- [ ] 61. ui.md — Fix connection status reconnecting UI (console only, no visible text)
- [ ] 67. match.md — Fix client timer red threshold (< 60, not < 30)
- [ ] 68. match.md — Fix client match end mechanism (window.onMatchEnd bridge, not showEndScreen)
- [ ] 69. dodge-roll.md — Fix UpdatePlayer return type (UpdatePlayerResult struct, not bool)
- [ ] 73. melee.md — Fix PlayerMeleeAttack (direct world.players access, not GetAllPlayers)
- [ ] 74. arena.md — Fix NewWeaponCrateManager (map, computed positions, different ID format)
- [ ] 75. arena.md — Fix getBalancedSpawnPointLocked signature (excludePlayerID param)
- [ ] 77. arena.md — Fix NaN recovery (sanitizeVector2 uses 0, not arena center)
- [ ] 79. arena.md — Fix dodge roll Go code (inline in UpdatePlayer, not separate method)
- [ ] 81. README.md — Fix message count (28 total, not 26)
- [ ] 83. README.md — Add ui.md to Quick Reference Table
- [ ] 84. README.md — Add graphics.md, ui.md, audio.md to Key Dependencies table
- [ ] 99. SPEC-OF-SPECS.md — Fix client→server `test` message (no formal schema)
- [ ] 100. SPEC-OF-SPECS.md — Fix estimated total length (24,924 actual, not 8,575)
- [ ] 101. SPEC-OF-SPECS.md — Fix shooting test scenario descriptions
- [ ] 102. SPEC-OF-SPECS.md — Fix UI timer red threshold (< 60, not < 30)
- [ ] 90. test-index.md — Fix client-architecture.md test count (10, not 8)

### Tier 3 — LOW severity (cosmetic, minor)

**What to Check:** Version numbers, line counts, file paths, formatting, operator typos. Quick cross-reference against source or filesystem.

- [ ] 4. networking.md — Fix typebox version (0.34.x, not 0.32.x)
- [ ] 9. messages.md — Clarify InputState sequence field extraction
- [ ] 12. client-architecture.md — Fix directory tree (no MatchTimer.ts, add xpCalculator.ts)
- [ ] 13. client-architecture.md — Fix camera follow (startFollow once, not per-frame lerp)
- [ ] 14. client-architecture.md — Fix update() method signatures (no delta param)
- [ ] 17. server-architecture.md — Fix broadcastLoop method name (GetAllPlayers, not GetAllPlayerStates)
- [ ] 21. server-architecture.md — Add PingTracker field to Player struct
- [ ] 22. server-architecture.md — Fix ManualClock mutex type (RWMutex, not Mutex)
- [ ] 29. hit-detection.md — Fix client handleHitConfirmed (no audio, only showHitMarker)
- [ ] 39. shooting.md — Fix client canShoot() check order (reload, ammo, cooldown)
- [ ] 40. shooting.md — Fix IsExpired operator (>= not >)
- [ ] 44. weapons.md — Add projectile sub-field to WeaponVisuals interface
- [ ] 47. overview.md — Fix GDD.md path (docs/GDD.md, not root)
- [ ] 48. overview.md — Remove .claude/todos.json from folder tree
- [ ] 51. overview.md — Fix World struct (add clock, rng, rngMu fields, PlayerState type)
- [ ] 55. rooms.md — Fix health property name (localPlayerHealth, not currentHealth)
- [ ] 59. ui.md — Fix scoreboard player ID (full ID, no truncation)
- [ ] 62. ui.md — Note connection status font size (14px)
- [ ] 63. ui.md — Fix match timer boundary conditions (>= vs >)
- [ ] 64. ui.md — Fix reload circle opacity (1.0, not 0.6)
- [ ] 65. ui.md — Fix hit marker scrollFactor (world coords, not setScrollFactor(0))
- [ ] 66. ui.md — Add dual-source health bar update (player:move + player:damaged)
- [ ] 70. dodge-roll.md — Fix roll:start audio scope (all players, not just local)
- [ ] 71. dodge-roll.md — Fix player:dodge_roll data payload (sends direction, not empty)
- [ ] 72. dodge-roll.md — Fix error handling (logs warning, not silent)
- [ ] 76. arena.md — Fix CanPickupWeapon function name (CheckPlayerCrateProximity)
- [ ] 78. arena.md — Remove nonexistent isInArena function docs
- [ ] 80. arena.md — Remove nonexistent CheckAABBCollision standalone Go function
- [ ] 82. README.md — Remove TODO markers from complete specs
- [ ] 85. README.md — Fix approximate line counts
- [ ] 86. README.md — Fix broken markdown bold formatting
- [ ] 93. spec-of-specs-plan.md — Fix line count estimates
- [ ] 94. spec-of-specs-plan.md — Fix work log message counts
- [ ] 95. spec-of-specs-plan.md — Fix work log test priority counts
- [ ] 96. spec-of-specs-plan.md — Fix final validation summary counts
- [ ] 103. SPEC-OF-SPECS.md — Add spec-of-specs-plan.md to table of contents
- [ ] 104. SPEC-OF-SPECS.md — Add changelog/update date

## Findings Reference

The full 104 findings with exact source citations are below. Worker: use these to know exactly what to change in each spec.

| # | Spec | Finding | Severity |
|---|------|---------|----------|
| 1 | constants.md | Spec says HEALTH_BAR_WIDTH=40px and HEALTH_BAR_HEIGHT=6px, but `HealthBar.ts:11-12` has width=32 and height=4. | HIGH |
| 2 | movement.md | Spec documents `sanitizeDeltaTime` function (capping deltaTime to 0.1s). Function does not exist anywhere. Server `gameserver.go:155` and client `GameScene.ts:325` use raw delta. | HIGH |
| 3 | movement.md | Client `PredictionEngine.ts:152-157` caps velocity magnitude to MOVEMENT.SPEED; server `physics.go` does not. Client ignores isSprinting (always 200 px/s); server uses SprintSpeed=300. | MEDIUM |
| 4 | networking.md | Spec says typebox `0.32.x`, actual is `^0.34.27`. | LOW |
| 5 | messages.md | Go `PlayerMoveData` spec shows `rotation`, `maxHealth`, `isDead`, `isSprinting`. Actual `PlayerStateSnapshot` uses `aimAngle`, no maxHealth, `deathTime *time.Time` instead of isDead, no isSprinting. Has extra: `isInvulnerable`, `invulnerabilityEnd`, `deathTime`, `kills`, `deaths`, `xp`, `isRegenerating`. | HIGH |
| 6 | messages.md | Spec and TypeBox include `weaponType` in `projectile:spawn`. `broadcast_helper.go:271-276` only sends `id`, `ownerId`, `position`, `velocity` — no `weaponType`. | HIGH |
| 7 | messages.md | Spec says `nextRespawnTime` is duration in milliseconds. `broadcast_helper.go:488` sends `respawnTime.Unix()` — Unix epoch timestamp in seconds. | HIGH |
| 8 | messages.md | Spec requires `projectileId` in `player:damaged`. Melee path `broadcast_helper.go:669-674` omits it, sending only `victimId`, `attackerId`, `damage`, `newHealth`. | MEDIUM |
| 9 | messages.md | Spec shows Go `InputStateData` with `Sequence int` field. Actual has no sequence field — extracted separately in `message_processor.go:39-42`. | LOW |
| 10 | client-architecture.md | Spec says dodge roll uses `player.setAlpha(0.5)`. Actual `PlayerManager.ts:265-278` uses 360deg rotation + flickering visibility toggle. | MEDIUM |
| 11 | client-architecture.md | Spec says `shoot()` checks `weaponState.isMelee` and sends either message. Actual has separate `shoot()` and `meleeAttack()` methods. | MEDIUM |
| 12 | client-architecture.md | Spec lists `MatchTimer.ts` as separate file. Doesn't exist — inline in `GameSceneUI.ts:35,260`. Missing `xpCalculator.ts` from directory listing. | LOW |
| 13 | client-architecture.md | Spec shows per-frame `followLocalPlayer()`. Actual uses `startFollow()` set once in `startCameraFollowIfNeeded()` at `GameScene.ts:472-493`. | LOW |
| 14 | client-architecture.md | Spec shows `dodgeRollManager.update(delta)` and `meleeWeaponManager.update(delta)`. Both actual methods take no parameters. | LOW |
| 15 | server-architecture.md | `broadcastFunc`, `onReloadComplete`, `onHit`, `onRespawn` signatures all wrong vs actual `gameserver.go:40-52`. | HIGH |
| 16 | server-architecture.md | Spec shows fixed deltaTime from tickRate. Actual `gameserver.go:136-137` computes real elapsed: `now.Sub(lastTick).Seconds()`. | MEDIUM |
| 17 | server-architecture.md | Spec shows `gs.world.GetAllPlayerStates()`. Actual is `gs.world.GetAllPlayers()`. | LOW |
| 18 | server-architecture.md | Spec shows helper functions `getBool`, `getFloat64`, `getInt`. Actual uses direct type assertions. No NaN/Inf sanitization of aimAngle. | MEDIUM |
| 19 | server-architecture.md | Spec shows `setupCallbacks()` with wrong signatures. Actual `websocket_handler.go:74-90` registers method references directly. | HIGH |
| 20 | server-architecture.md | Spec shows blocking `player.SendChan <- msg` with recover. Actual `room.go:114-120` uses non-blocking `select` with `default`. | MEDIUM |
| 21 | server-architecture.md | Spec omits `PingTracker *PingTracker` field from Player struct. | LOW |
| 22 | server-architecture.md | Spec shows `mu sync.Mutex`. Actual `clock.go:41` is `sync.RWMutex`. | LOW |
| 23 | server-architecture.md | Spec shows `handler := network.NewWebSocketHandler()`. Actual uses global singleton `network.HandleWebSocket` / `network.StartGlobalHandler(ctx)`. | MEDIUM |
| 24 | server-architecture.md | Spec documents `sanitizePosition(pos Vector2)` function. Does not exist in server codebase. | HIGH |
| 25 | hit-detection.md | Spec shows `SpawnPosition` with `json:"spawnPosition"`. Actual has `json:"-"` (excluded from JSON). | MEDIUM |
| 26 | hit-detection.md | Spec shows `gs.onHit(hit.AttackerID, hit.VictimID, damage, hit.ProjectileID)`. Actual calls `gs.onHit(hit)` with entire HitEvent struct. | HIGH |
| 27 | hit-detection.md | Spec shows separate `handleDeath` method. Actual death handling is inline in `onHit()` at `message_processor.go:172-262`. | MEDIUM |
| 28 | hit-detection.md | Spec says hitscan skips invulnerable players. Actual `gameserver.go:746-749` only checks self-hit and IsAlive — invulnerable/rolling players CAN be hit by hitscan. | HIGH |
| 29 | hit-detection.md | Spec shows `this.audioManager.playHitmarker()`. Actual only calls `this.ui.showHitMarker()` — TODO comment for audio. | LOW |
| 30 | hit-detection.md | Spec shows `victim.playDeathAnimation()` and `killFeed.addEntry()`. Actual hides sprite via `setPlayerVisible(false)` + spectator mode. Kill feed in separate handler. | MEDIUM |
| 31 | hit-detection.md | Spec shows 4-step tick. Actual has 9 steps: updateAllPlayers, recordPositionSnapshots, projectileManager.Update, checkHitDetection, checkReloads, checkRespawns, checkRollDuration, updateInvulnerability, updateHealthRegeneration, checkWeaponRespawns. | MEDIUM |
| 32 | shooting.md | Spec shows `FailReason string`. Actual is `Reason string`. | HIGH |
| 33 | shooting.md | Spec shows `gs.mu.Lock()` around PlayerShoot. Actual has no gs.mu — only `gs.weaponMu.RLock()`. | MEDIUM |
| 34 | shooting.md | Spec shows `!player.IsAlive()` check. Actual only checks `!exists`. Dead players not rejected. | HIGH |
| 35 | shooting.md | Spec shows `NewProjectile()` then `AddProjectile()`. Actual uses `CreateProjectile()` (create+add in one). | MEDIUM |
| 36 | shooting.md | Spec shows StartReload checking `IsMelee()`. Actual checks `IsReloading` and `CurrentAmmo >= MagazineSize`. | HIGH |
| 37 | shooting.md | Spec shows CanShoot as fire-rate only. Actual also checks IsReloading and CurrentAmmo. | MEDIUM |
| 38 | shooting.md | Spec shows `shoot(aimAngle: number)`. Actual `shoot()` takes no params, uses `this.aimAngle`. Sends `clientTimestamp`. | MEDIUM |
| 39 | shooting.md | Spec checks cooldown→reload→ammo. Actual checks reload→ammo→cooldown. | LOW |
| 40 | shooting.md | Spec shows `>` for IsExpired. Actual uses `>=`. | LOW |
| 41 | weapons.md | Spec omits `IsHitscan bool` field from Weapon struct. Used in `gameserver.go:373`. | MEDIUM |
| 42 | weapons.md | Spec says Uzi muzzleFlashSize=6, duration=30. Actual: size=8, duration=50. | HIGH |
| 43 | weapons.md | Spec shows single return from CreateWeaponByType. Actual returns `(*Weapon, error)`. | MEDIUM |
| 44 | weapons.md | Spec WeaponVisuals missing `projectile: ProjectileVisuals` nested structure. | LOW |
| 45 | overview.md | Spec says 7 C→S and 19 S→C. Actual: 6 C→S, 22 S→C (28 total). | MEDIUM |
| 46 | overview.md | Spec file listing missing 6 specs: audio.md, graphics.md, ui.md, test-index.md, spec-of-specs-plan.md, server-architecture.md. | MEDIUM |
| 47 | overview.md | Spec shows `GDD.md` at project root. Actual at `docs/GDD.md`. | LOW |
| 48 | overview.md | Spec shows `.claude/todos.json` in folder tree. File doesn't exist. | LOW |
| 49 | overview.md | Spec shows GameServer with Room, Match, ticker, broadcaster fields. Actual uses callbacks and duration configs. | HIGH |
| 50 | overview.md | Spec shows `player.IsDead` check. Actual only checks `!exists`. Weapon access via weaponStates map, not player struct. | HIGH |
| 51 | overview.md | Spec World struct missing clock, rng, rngMu fields. Map type is *PlayerState, not *Player. | LOW |
| 52 | rooms.md | Spec shows room:joined sent "by caller" or not at all. Actual: `rm.sendRoomJoinedMessage()` called inside AddPlayer for both paths. | MEDIUM |
| 53 | rooms.md | Spec shows `RoomJoinedData { playerId }` only. Actual sends `{ roomId, playerId }`. | MEDIUM |
| 54 | rooms.md | Spec shows processPendingMessages replaying player:move. Actual discards pending moves (cleared without processing). | MEDIUM |
| 55 | rooms.md | Spec uses `this.currentHealth`. Actual is `this.localPlayerHealth`. | LOW |
| 56 | ui.md | Spec uses `unshift+pop` for kill feed. Actual uses `push+shift`. | MEDIUM |
| 57 | ui.md | Spec says "4 white lines forming X pattern" (diagonal). Actual draws + pattern (vertical/horizontal). | MEDIUM |
| 58 | ui.md | Spec shows "MATCH ENDED" h1 + "{PlayerName} WINS!". Actual: no h1, "Winner: {name}" / "Winners: {names}". | MEDIUM |
| 59 | ui.md | Spec shows `playerId.slice(0, 8)`. Actual shows full playerId. | LOW |
| 60 | ui.md | Spec says ammo turns red at <=20%. No color change logic exists in actual code. | MEDIUM |
| 61 | ui.md | Spec shows "Reconnecting... (attempt X/3)" in yellow. Actual only logs to console. | MEDIUM |
| 62 | ui.md | Spec doesn't specify font size. Actual 14px. | LOW |
| 63 | ui.md | Spec boundary: 120s=yellow. Actual: 120s=white. At 60s: spec=red, actual=yellow. | LOW |
| 64 | ui.md | Spec says reload circle 0.6 alpha. Actual 1.0. | LOW |
| 65 | ui.md | Spec shows `setScrollFactor(0)`. Actual uses world coords with camera offset. | LOW |
| 66 | ui.md | Spec only shows health bar from player:move. Actual also updates from player:damaged. | LOW |
| 67 | match.md | Spec says timer red at < 30s. Actual: < 60s red, < 120s yellow. | MEDIUM |
| 68 | match.md | Spec shows inline showEndScreen(). Actual delegates to window.onMatchEnd() React bridge. | MEDIUM |
| 69 | dodge-roll.md | Spec shows UpdatePlayer returns bool. Actual returns UpdatePlayerResult struct. | MEDIUM |
| 70 | dodge-roll.md | Spec shows roll:start audio only for local player. Actual plays for all players. | LOW |
| 71 | dodge-roll.md | Spec says "no data payload". Client actually sends `{ direction: rollDirection }`. | LOW |
| 72 | dodge-roll.md | Spec says invalid rolls "silently ignored". Actual logs warning. | LOW |
| 73 | melee.md | Spec shows `gs.world.GetAllPlayers()`. Actual directly accesses `gs.world.players` under RLock for mutable pointers. | MEDIUM |
| 74 | arena.md | Spec shows slice with hardcoded IDs/positions. Actual uses map, computed positions, different ID format. | MEDIUM |
| 75 | arena.md | Spec shows no params. Actual takes `excludePlayerID string`. Also unexported `w.players`, instance `w.rng`. | MEDIUM |
| 76 | arena.md | Spec says `CanPickupWeapon`. Actual function name is `CheckPlayerCrateProximity`. | LOW |
| 77 | arena.md | Spec says NaN → arena center (960, 540). Actual `sanitizeVector2` replaces with 0. | MEDIUM |
| 78 | arena.md | Spec documents `isInArena()` function. Does not exist — boundary via `clampToArena()` only. | LOW |
| 79 | arena.md | Spec shows separate `UpdatePlayerPosition` method. Doesn't exist — inline in `UpdatePlayer`. | MEDIUM |
| 80 | arena.md | Spec shows standalone `CheckAABBCollision` Go function. Doesn't exist — inline in CheckProjectilePlayerCollision. Client version does exist. | LOW |
| 81 | README.md | Says "All 26 WebSocket message types". Should be 28 (6+22). Quick Reference correctly says 6+22. | MEDIUM |
| 82 | README.md | server-architecture.md and test-index.md marked "(TODO)" but both are complete (v1.1.0). | LOW |
| 83 | README.md | Quick Reference Table (17 specs) omits ui.md (1251 lines). | MEDIUM |
| 84 | README.md | Key Dependencies table missing graphics.md, ui.md, audio.md. | MEDIUM |
| 85 | README.md | Several line counts significantly off (messages.md ~1100 vs 1774, etc.). | LOW |
| 86 | README.md | Broken markdown bold at line 290. | LOW |
| 87 | test-index.md | Priority distributions wrong for ALL 19 specs. Critical counts systematically inflated. | HIGH |
| 88 | test-index.md | Summary claims 71C/94H/20M/9L=194. Wrong due to per-spec errors. | HIGH |
| 89 | test-index.md | Category counts 85U/85I/9V have mismatches between index and source specs. | HIGH |
| 90 | test-index.md | Lists 8 tests for client-architecture.md. Actual spec defines 10. | MEDIUM |
| 91 | test-index.md | Multiple specs have descriptions mapped to wrong test IDs. | HIGH |
| 92 | test-index.md | 15 netcode test IDs exist only in test-index.md, not in source specs. | HIGH |
| 93 | spec-of-specs-plan.md | Line estimates ~10k total vs actual ~24,924. | LOW |
| 94 | spec-of-specs-plan.md | Work log says "26 message types (7 C→S, 19 S→C)". Should be 28 (6+22). | LOW |
| 95 | spec-of-specs-plan.md | Work log says "Critical (65), High (85)". Out of date. | LOW |
| 96 | spec-of-specs-plan.md | Final validation summary says "7 C→S, 20 S→C" and "55 JSON schemas". Pre-Epic 4. | LOW |
| 97 | SPEC-OF-SPECS.md | DECELERATION: 50 px/s^2. Actual: 1500 px/s^2. Off by 30x. | HIGH |
| 98 | SPEC-OF-SPECS.md | Says 19 S→C types, lists 20. Actual: 22 (missing state:snapshot, state:delta). | HIGH |
| 99 | SPEC-OF-SPECS.md | Lists `test` as C→S type. No formal schema. Actually 6 formal C→S types. | MEDIUM |
| 100 | SPEC-OF-SPECS.md | Estimated ~8,575 total lines. Actual 24,924 (~2.9x). | MEDIUM |
| 101 | SPEC-OF-SPECS.md | Shooting test scenario descriptions don't match actual shooting.md test IDs. | MEDIUM |
| 102 | SPEC-OF-SPECS.md | UI timer red threshold < 30s. Actual < 60s. | MEDIUM |
| 103 | SPEC-OF-SPECS.md | spec-of-specs-plan.md not listed in ToC or file specs section. | LOW |
| 104 | SPEC-OF-SPECS.md | No changelog or update date. Still at v1.0.0, never updated. | LOW |

## Discoveries

Worker: when you find additional drift while fixing a finding, add a row here.

| # | Spec | Discovery | Severity |
|---|------|-----------|----------|
| | | | |

## Per-Item Process

```
1. Read the finding from the table above — note the spec file, the cited source files, and what's wrong
2. Read the spec file section that needs fixing
3. Read the actual source code file(s) cited in the finding
4. Edit the spec to match the source code (targeted fix, not a rewrite)
5. Commit: "docs: Fix {spec-name} — {brief description}"
6. Check off the item in the Fix Checklist above
7. Stop — the loop restarts you for the next finding
```

## Rules

1. **Spec-only edits** — Do NOT edit source code, only spec files in `specs/`
2. **One finding per iteration** — Fix one, commit, check off, stop
3. **Read source first** — Always verify the source code before editing the spec. The finding may be stale if code changed since validation.
4. **Targeted fixes** — Change only what the finding describes. Don't rewrite surrounding paragraphs.
5. **Preserve spec structure** — Keep headings, section order, and formatting intact
6. **Code blocks must match reality** — If a finding says a Go struct has different fields, update the code block to match the actual struct
7. **Update changelog** — If the spec has a changelog table, add a row: `| 1.1.1 | 2026-02-16 | Fixed {what} to match source code |`
8. **Don't invent** — If you're unsure what the source code actually does, read it. Don't guess.
9. **Commit message format** — `docs: Fix {spec-name} — {brief description of what was corrected}`
10. **HIGH findings first** — Work through Tier 1, then Tier 2, then Tier 3
