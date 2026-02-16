# Spec Validation Plan

> Reference file for the worker loop. Read this at the START of each iteration to know what to do.

## Context

The specs in `specs/` were just bulk-updated by a previous Ralph job to match the current codebase. This validation pass reads each spec and its corresponding source code to verify accuracy. No edits — just flag remaining drift.

## Validation Checklist

- [x] 1. constants.md
- [x] 2. movement.md
- [x] 3. networking.md
- [x] 4. messages.md
- [x] 5. client-architecture.md
- [x] 6. server-architecture.md
- [x] 7. hit-detection.md
- [x] 8. player.md
- [x] 9. graphics.md
- [x] 10. shooting.md
- [x] 11. weapons.md
- [x] 12. overview.md
- [x] 13. rooms.md
- [ ] 14. ui.md
- [ ] 15. match.md
- [ ] 16. dodge-roll.md
- [ ] 17. melee.md
- [ ] 18. arena.md
- [ ] 19. audio.md
- [ ] 20. README.md
- [ ] 21. test-index.md
- [ ] 22. spec-of-specs-plan.md
- [ ] 23. SPEC-OF-SPECS.md

## Findings

| # | Spec | Finding | Severity |
|---|------|---------|----------|
| 1 | constants.md §UI Constants | Spec says HEALTH_BAR_WIDTH=40px and HEALTH_BAR_HEIGHT=6px, but `stick-rumble-client/src/game/entities/HealthBar.ts:11-12` has width=32 and height=4. | HIGH |
| 2 | movement.md §Error Handling | Spec documents a `sanitizeDeltaTime` function (lines 702-711) that caps deltaTime to 0.1s and defaults <=0 to 0.01667. This function does not exist anywhere in the codebase — no delta time capping is performed on server (`gameserver.go:155` uses raw delta) or client (`GameScene.ts:325` uses raw `delta/1000`). | HIGH |
| 3 | movement.md §Client-Side Prediction | Spec states "PredictionEngine uses identical math to the server's Physics.UpdatePlayer()" (line 595), but there are two asymmetries: (a) client `PredictionEngine.ts:152-157` caps velocity magnitude to `MOVEMENT.SPEED`, server `physics.go` does not; (b) client prediction ignores `isSprinting` (always uses 200 px/s), while server uses `SprintSpeed=300` when sprinting. | MEDIUM |
| 4 | networking.md §Technology Dependencies | Spec says `@sinclair/typebox` version is `0.32.x` (line 33), but actual version in `events-schema/package.json` and `stick-rumble-client/package.json` is `^0.34.27`. | LOW |
| 5 | messages.md §PlayerState Go struct | Spec (lines 557-561) shows Go `PlayerMoveData` with a simple `Players []PlayerState` struct containing fields `rotation`, `maxHealth`, `isDead`, `isSprinting`. Actual Go `PlayerStateSnapshot` (`player.go:47-62`) uses different field names and structure: `aimAngle` instead of `rotation` (json tag "aimAngle" not "rotation"), no `maxHealth` field, no `isDead` boolean (uses `deathTime *time.Time` instead), no `isSprinting` field. Also includes extra fields not in spec: `isInvulnerable`, `invulnerabilityEnd`, `deathTime`, `kills`, `deaths`, `xp`, `isRegenerating`. | HIGH |
| 6 | messages.md §projectile:spawn | Spec (lines 620-627) and TypeBox schema (`server-to-client.ts:142-151`) both include `weaponType` field in `projectile:spawn`. But `broadcast_helper.go:271-276` only sends `id`, `ownerId`, `position`, `velocity` — `weaponType` is missing from the Go broadcast. | HIGH |
| 7 | messages.md §weapon:pickup_confirmed nextRespawnTime | Spec (line 1205) and TypeBox schema say `nextRespawnTime` is "Time until the crate respawns (milliseconds)". But `broadcast_helper.go:488` sends `respawnTime.Unix()` which is a Unix epoch timestamp in seconds, not a duration in milliseconds. | HIGH |
| 8 | messages.md §player:damaged from melee | Spec (lines 806-812) and TypeBox schema require `projectileId` field in `player:damaged`. The projectile-hit code path (message_processor.go:117) includes it, but the melee damage path (`broadcast_helper.go:669-674`) omits `projectileId` entirely, sending only `victimId`, `attackerId`, `damage`, `newHealth`. | MEDIUM |
| 9 | messages.md §InputState Go struct | Spec (lines 160-168) shows a Go `InputStateData` struct with `Sequence int` field. The actual Go `InputState` struct (`player.go:14-22`) has no `sequence` field — it is extracted separately in `message_processor.go:39-42` and stored as a private `inputSequence` field on `PlayerState`. Not wrong but misleadingly implies sequence is part of InputState. | LOW |
| 10 | client-architecture.md §Dodge Roll Visual | Spec (line 585-586) says dodge roll uses `player.setAlpha(0.5)` for transparency. Actual code (`PlayerManager.ts:265-278`) uses 360° rotation animation + flickering visibility toggle (`setVisible()` with 200ms period), not alpha transparency. | MEDIUM |
| 11 | client-architecture.md §ShootingManager.shoot() | Spec (lines 922-930) says `shoot()` checks `weaponState.isMelee` and sends either `'player:melee_attack'` or `'player:shoot'`. Actual code has separate methods: `shoot()` (line 86) only sends `'player:shoot'`, and `meleeAttack()` (line 250) sends `'player:melee_attack'`. | MEDIUM |
| 12 | client-architecture.md §Directory Tree | Spec (line 239) lists `MatchTimer.ts` as a separate file in `scenes/`. This file does not exist — MatchTimer functionality is inline in `GameSceneUI.ts:35,260`. Also missing `xpCalculator.ts` from `utils/` directory listing. | LOW |
| 13 | client-architecture.md §update() camera follow | Spec (lines 459, 483) shows `followLocalPlayer()` called per-frame in update(). Actual code uses Phaser's `startFollow()` API (set once in `startCameraFollowIfNeeded()` at `GameScene.ts:472-493`), not a per-frame lerp call. The 0.1 lerp factor is passed to `startFollow()`, not manually applied. | LOW |
| 14 | client-architecture.md §update() method signatures | Spec (lines 452-454, 476-478) shows `dodgeRollManager.update(delta)` and `meleeWeaponManager.update(delta)` taking delta parameter. Both actual methods take no parameters: `DodgeRollManager.update()` at line 69 and `MeleeWeaponManager.update()` at line 86. | LOW |
| 15 | server-architecture.md §GameServer struct | Spec (line 111) shows `broadcastFunc func([]PlayerState)` but actual (`gameserver.go:40`) is `func(playerStates []PlayerStateSnapshot)`. Spec (line 114) shows `onReloadComplete func(playerID string, state WeaponState)` but actual (`gameserver.go:43`) is `func(playerID string)` — no WeaponState parameter. Spec (line 115) shows `onHit func(attackerID, victimID string, damage int, newHealth int)` but actual (`gameserver.go:46`) is `func(hit HitEvent)` — takes a struct instead of individual params. Spec (line 116) shows `onRespawn func(playerID string, pos Vector2, health int)` but actual (`gameserver.go:52`) is `func(playerID string, position Vector2)` — no health parameter. | HIGH |
| 16 | server-architecture.md §tick() deltaTime | Spec (line 276) shows `deltaTime := float64(gs.tickRate) / float64(time.Second)` (fixed from tickRate). Actual (`gameserver.go:136-137`) computes real elapsed time: `deltaTime := now.Sub(lastTick).Seconds()`. | MEDIUM |
| 17 | server-architecture.md §broadcastLoop | Spec (line 364) shows `gs.world.GetAllPlayerStates()`. Actual method name (`gameserver.go:187`) is `gs.world.GetAllPlayers()`. | LOW |
| 18 | server-architecture.md §handleInputState | Spec (lines 441-448) shows helper functions `getBool(data, "up")`, `getFloat64(data, "aimAngle")`, `getInt(data, "sequence")`. Actual (`message_processor.go:29-42`) uses direct type assertions `dataMap["up"].(bool)`, `dataMap["aimAngle"].(float64)`, `dataMap["sequence"].(float64)`. Also spec (lines 452-454) shows NaN/Inf sanitization of `input.AimAngle` inside handleInputState; actual code does not sanitize aim angle there. | MEDIUM |
| 19 | server-architecture.md §setupCallbacks | Spec (lines 495-518) shows an explicit `setupCallbacks()` method with inline closures matching the wrong signatures (e.g., `func(playerID string, state WeaponState)` for reload, `func(attackerID, victimID string, damage, newHealth int)` for hits). Actual (`websocket_handler.go:74-90`) registers method references directly (e.g., `handler.onReloadComplete`, `handler.onHit`) with different signatures (see finding #15). | HIGH |
| 20 | server-architecture.md §Room.Broadcast | Spec (lines 642-657) shows blocking channel send `player.SendChan <- msg` with recover from panic. Actual (`room.go:114-120`) uses non-blocking `select` with `default` case (drops message if full), plus recover. The spec's Error Handling §Channel Full (lines 779-786) correctly describes non-blocking, but the code example in §Concurrency contradicts it. | MEDIUM |
| 21 | server-architecture.md §Player struct | Spec (lines 593-596) shows `type Player struct { ID string; SendChan chan []byte }`. Actual (`room.go:15-19`) includes `PingTracker *PingTracker` field, omitted from the spec struct definition. | LOW |
| 22 | server-architecture.md §ManualClock mutex | Spec (line 936) shows `mu sync.Mutex`. Actual (`clock.go:41`) is `mu sync.RWMutex`. | LOW |
| 23 | server-architecture.md §main.go pattern | Spec (lines 709-710) shows `handler := network.NewWebSocketHandler()` and `handler.GameServer.Start(ctx)`. Actual (`main.go:34,46`) uses `network.HandleWebSocket` (package-level func) and `network.StartGlobalHandler(ctx)` — a global singleton pattern, not explicit handler instantiation. | MEDIUM |
| 24 | server-architecture.md §sanitizePosition | Spec (lines 836-844) documents a `sanitizePosition(pos Vector2)` function that replaces NaN/Inf with arena center. This function does not exist anywhere in the server codebase. | HIGH |
| 25 | hit-detection.md §Projectile struct | Spec (line 77) shows `SpawnPosition` with `json:"spawnPosition"` tag. Actual (`projectile.go:18`) has `SpawnPosition Vector2 json:"-"` — field is excluded from JSON serialization, not exposed as `spawnPosition`. | MEDIUM |
| 26 | hit-detection.md §checkHitDetection onHit call | Spec (line 186) shows `gs.onHit(hit.AttackerID, hit.VictimID, damage, hit.ProjectileID)` with individual parameters. Actual (`gameserver.go:597`) calls `gs.onHit(hit)` passing the entire `HitEvent` struct. The spec's code also shows damage lookup and `victim.TakeDamage()` inline in `checkHitDetection`, which does match actual (`gameserver.go:574-593`), but the callback signature is wrong. | HIGH |
| 27 | hit-detection.md §Death Trigger Go code | Spec (lines 375-406) shows a separate `handleDeath` method on `MessageProcessor`. Actual death handling is inline within `onHit()` in `message_processor.go:172-262`, not a separate method. Also, spec shows `h.gameServer.GetPlayerState()` returning a pointer used for stat updates, but actual code uses `h.gameServer.GetWorld().GetPlayer()` to get the mutable pointer (snapshot is read-only). | MEDIUM |
| 28 | hit-detection.md §Hitscan invulnerability check | Spec pseudocode (line 514) says hitscan skips "not invulnerable" players. Actual `processHitscanShot()` (`gameserver.go:746-749`) only checks `victimID == shooterID` and `!victim.IsAlive()` — does NOT check `IsInvulnerable` or `IsInvincibleFromRoll()` for hitscan targets. Invulnerable/rolling players can be hit by hitscan weapons. | HIGH |
| 29 | hit-detection.md §Client handleHitConfirmed | Spec (line 668) shows `this.audioManager.playHitmarker()`. Actual (`GameSceneEventHandlers.ts:416`) only calls `this.ui.showHitMarker()` — no audio playback, only a TODO comment for future audio. | LOW |
| 30 | hit-detection.md §Client handlePlayerDeath | Spec (lines 675-676) shows `victim.playDeathAnimation()` and `killFeed.addEntry()`. Actual (`GameSceneEventHandlers.ts:428-431`) hides the player sprite via `setPlayerVisible(false)` and enters spectator mode — no death animation method exists. Kill feed is handled in the separate `player:kill_credit` handler, not `player:death`. | MEDIUM |
| 31 | hit-detection.md §tick() method | Spec (lines 686-699) shows a simplified tick with 4 steps: `processAllInputs`, `updateAllPlayers`, `checkHitDetection`, `checkMatchEnd`. Actual (`gameserver.go:139-168`) has 9 steps: `updateAllPlayers`, `recordPositionSnapshots`, `projectileManager.Update`, `checkHitDetection`, `checkReloads`, `checkRespawns`, `checkRollDuration`, `updateInvulnerability`, `updateHealthRegeneration`, `checkWeaponRespawns`. No `processAllInputs` or `checkMatchEnd` calls exist in tick. Also shows `gs.world.Projectiles.UpdateAll()` but actual is `gs.projectileManager.Update()`. | MEDIUM |
| 32 | shooting.md §ShootResult struct | Spec (line 75) shows field `FailReason string`. Actual (`gameserver.go:22`) is `Reason string`. All spec code examples (lines 238, 249, 255, 260) use `FailReason` but actual uses `Reason`. | HIGH |
| 33 | shooting.md §PlayerShoot locking | Spec (line 232-233) shows `gs.mu.Lock(); defer gs.mu.Unlock()` around entire PlayerShoot. Actual (`gameserver.go:336-392`) has no `gs.mu` lock — only `gs.weaponMu.RLock()` for weapon state access. | MEDIUM |
| 34 | shooting.md §PlayerShoot alive check | Spec (line 237) shows `!player.IsAlive()` check at entry. Actual (`gameserver.go:338-341`) only checks `!exists`, NOT `!player.IsAlive()`. Dead players are not explicitly rejected in `PlayerShoot`. | HIGH |
| 35 | shooting.md §PlayerShoot projectile creation | Spec (lines 265-266) shows `proj := NewProjectile(...)` then `gs.projectileManager.AddProjectile(proj)`. Actual (`gameserver.go:380-386`) uses `gs.projectileManager.CreateProjectile(...)` which creates and adds in one call. `AddProjectile` method does not exist. | MEDIUM |
| 36 | shooting.md §StartReload IsMelee check | Spec (line 442) shows `StartReload` checking `ws.Weapon.IsMelee()`. Actual (`weapon.go:139-152`) checks `ws.IsReloading` and `ws.CurrentAmmo >= ws.Weapon.MagazineSize` (full magazine) — does NOT check `IsMelee()`. | HIGH |
| 37 | shooting.md §CanShoot scope | Spec (lines 300-307) shows `CanShoot()` as fire-rate-only check. Actual (`weapon.go:104-127`) also checks `IsReloading` and `CurrentAmmo` for ranged weapons, with melee bypass logic. The spec's `PlayerShoot` flow (lines 248-261) correctly shows separate reload/ammo checks before `CanShoot`, but the Go code block for `CanShoot()` is incomplete. | MEDIUM |
| 38 | shooting.md §Client shoot() signature | Spec (line 208) shows `shoot(aimAngle: number)` taking aimAngle as parameter. Actual (`ShootingManager.ts:86`) `shoot()` takes no parameters — uses `this.aimAngle` set via `setAimAngle()`. Also actual sends `clientTimestamp` in data (line 101), not shown in spec. | MEDIUM |
| 39 | shooting.md §Client canShoot() order | Spec (lines 187-205) checks cooldown first, then reload, then ammo. Actual (`ShootingManager.ts:135-153`) checks reload first, then ammo, then cooldown — reversed order from spec. | LOW |
| 40 | shooting.md §IsExpired operator | Spec (line 391) shows `time.Since(p.CreatedAt) > ProjectileMaxLifetime` (strict greater-than). Actual (`projectile.go:57`) uses `>=` (greater-than-or-equal). | LOW |
| 41 | weapons.md §Weapon struct | Spec (lines 104-117) shows Go `Weapon` struct without `IsHitscan` field. Actual (`weapon.go:53`) has `IsHitscan bool` field used for lag-compensated hitscan vs projectile branching (`gameserver.go:373`). Similarly, spec TypeScript `WeaponConfig` (lines 78-91) omits `isHitscan`, but `weapon-configs.json` includes `"isHitscan": true` for Pistol. | MEDIUM |
| 42 | weapons.md §Uzi Visual Config | Spec (line 220) says Uzi muzzleFlashSize=6px and muzzleFlashDuration=30ms. Actual `weapon-configs.json` (lines 78-79) has muzzleFlashSize=8 and muzzleFlashDuration=50. | HIGH |
| 43 | weapons.md §CreateWeaponByType return | Spec (lines 718-723) shows `weapon := CreateWeaponByType("ak47")` with single return value. Actual (`weapon_factory.go:165`) signature is `func CreateWeaponByType(weaponType string) (*Weapon, error)` — returns an error as second value. | MEDIUM |
| 44 | weapons.md §WeaponVisuals missing projectile sub-field | Spec's `WeaponConfig` TypeScript interface (line 90) shows `visuals: WeaponVisuals` but never defines the `projectile: ProjectileVisuals` nested structure. Actual (`weaponConfig.ts:13-18`) has `WeaponVisuals` containing `projectile: ProjectileVisuals` with fields `color`, `diameter`, `tracerColor`, `tracerWidth`. The spec's Visual Configuration table (lines 217-222) lists these values but doesn't reflect them in the TypeScript interface definition. | LOW |
| 45 | overview.md §Message Type Counts | Spec (line 306) says "Client→Server messages (7 types)" but actual `client-to-server.ts` defines 6 types: `input:state`, `player:shoot`, `player:reload`, `weapon:pickup_attempt`, `player:melee_attack`, `player:dodge_roll`. Spec (line 307) says "Server→Client messages (19 types)" but actual `server-to-client.ts` defines 22 types (missing from count: `melee:hit`, `roll:start`, `roll:end`, `state:snapshot`, `state:delta`; 17 listed + 5 unlisted = 22). | MEDIUM |
| 46 | overview.md §Spec File Listing | Spec (lines 428-445) lists spec files but omits 6 that actually exist: `audio.md`, `graphics.md`, `ui.md`, `test-index.md`, `spec-of-specs-plan.md`, `server-architecture.md`. | MEDIUM |
| 47 | overview.md §Folder Tree GDD.md | Spec (line 455) shows `GDD.md` at project root. File only exists at `docs/GDD.md`, not at root. | LOW |
| 48 | overview.md §Folder Tree .claude/todos.json | Spec (line 416) shows `.claude/todos.json` in folder tree. This file does not exist. | LOW |
| 49 | overview.md §GameServer Pattern | Spec (lines 282-288) shows `GameServer` struct with direct fields `Room *Room`, `Match *Match`, `ticker *time.Ticker`, `broadcaster *time.Ticker`. Actual (`gameserver.go:27-72`) has no `Room`, `Match`, `ticker`, or `broadcaster` fields — uses callback functions (`broadcastFunc`, `onMatchTimer`, `onCheckTimeLimit`) instead of direct references, and `tickRate`/`updateRate` durations instead of tickers. | HIGH |
| 50 | overview.md §Anti-Cheat PlayerShoot pseudocode | Spec (line 355) shows `player == nil || player.IsDead` check. Actual (`gameserver.go:338-341`) only checks `!exists` (player not found), does NOT check `IsDead`/`IsAlive`. Dead players are not rejected from shooting. Also spec uses `Reason` field name which is correct, but shows `player.Weapon.IsReloading` and `player.Weapon.CurrentAmmo` — actual code accesses weapon state via separate `weaponStates` map, not through player struct. | HIGH |
| 51 | overview.md §World struct | Spec (lines 551-554) shows `type World struct { mu sync.RWMutex; players map[string]*Player }`. Actual (`world.go:10-16`) has additional fields `clock Clock`, `rng *rand.Rand`, `rngMu sync.Mutex`, and map value type is `*PlayerState` not `*Player`. | LOW |
| 52 | rooms.md §AddPlayer Go code | Spec (lines 178-220) shows `room:joined` sent "by caller" in tab-reload path (comment line 189) and not sent at all in the 2-player creation path. Actual (`room.go:189,229-230`) calls `rm.sendRoomJoinedMessage()` inside `AddPlayer` for both paths — RoomManager sends `room:joined`, not the caller. | MEDIUM |
| 53 | rooms.md §room:joined data payload | Spec (line 98-100) shows `RoomJoinedData { playerId: string }` only. Actual `sendRoomJoinedMessage` (`room.go:244-245`) sends `{ "roomId": room.ID, "playerId": player.ID }` — the `roomId` field is sent by the server but undocumented in the spec (and absent from the TypeBox schema at `server-to-client.ts:36-41`). | MEDIUM |
| 54 | rooms.md §Client processPendingMessages | Spec (lines 429-441) shows a `processPendingMessages()` method that processes both `pendingPlayerMoves` and `pendingWeaponSpawns`. Actual code (`GameSceneEventHandlers.ts:276-289`) has no such method — pending player moves are **discarded** (cleared without processing, line 278), and only weapon spawns are processed inline. The spec incorrectly states pending player:move messages are replayed. | MEDIUM |
| 55 | rooms.md §Client health property name | Spec (line 393) uses `this.currentHealth = 100`. Actual (`GameSceneEventHandlers.ts:273`) uses `this.localPlayerHealth = 100`. | LOW |

Severity: LOW (cosmetic/minor), MEDIUM (missing info but not wrong), HIGH (factually incorrect)

## Per-Spec Process

```
1. Read the spec file in specs/
2. Read the relevant source files it references
3. Compare: does the spec accurately describe the code?
4. If drift found: add a row to the Findings table above
5. If no drift: just check it off
6. Check off the validation checklist
7. Stop — the loop restarts you for the next spec
```

## Rules

1. **Read-only** — Do NOT edit any spec files or source code
2. **One spec per iteration** — Validate one, update this plan, stop
3. **Be specific** — Findings must cite the spec section AND the source file/line that contradicts it
4. **Code is truth** — If spec says X but code does Y, that's drift
5. **Check cross-references** — If a spec references another spec, verify the reference is accurate
6. **Version/changelog** — Verify the spec has a recent changelog entry from the update pass
