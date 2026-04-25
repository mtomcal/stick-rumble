# Combat (Pre-BMM Archive)

> **Spec Version**: 1.0.0
> **Last Updated**: 2026-02-15
> **Archive Snapshot**: 2025-11-25 05:55:21
> **Source File**: `game/scenes/MainScene.ts` (lines 474-639 for attack/fire, lines 791-989 for collision/damage)
> **Depends On**: [types-and-events.md](types-and-events.md), [player.md](player.md)
> **Depended By**: [ai.md](ai.md), [rendering.md](rendering.md), [ui.md](ui.md)

---

## Overview

The combat system in the pre-BMM prototype handles all weapon attacks, projectile creation, damage application, and death processing. There is **no server** — all combat is client-side. The system is split into melee and ranged subsystems that share a common `executeAttack()` dispatcher, unified `WEAPON_STATS` configuration, and collision-based hit detection via Phaser's Arcade physics.

**Key differences from the current (post-BMM) codebase:**
- No server-authoritative validation; all attacks resolve locally
- No WebSocket messages (`player:shoot`, `shoot:failed`, etc.)
- No fire rate enforcement by a server — cooldowns are tracked client-side via `lastFired`
- No separate ShootingManager or MeleeWeaponManager — everything lives in `MainScene`
- Ranged spread is per-weapon-type hardcoded, not driven by a configurable `WeaponConfig` schema
- No recoil accumulation system — spread is random per-shot only
- Friendly fire between bots is enabled (via separate bullet group overlap)
- Player death is permanent (game over), not respawn-based

---

## Dependencies

### Technology Dependencies

| Technology | Version | Purpose |
|------------|---------|---------|
| Phaser 3 | ^3.90.0 | Arcade physics groups, collision detection, tweens |
| TypeScript | ~5.8.2 | Type-safe source |

### File Dependencies

| File | What Combat Uses |
|------|------------------|
| `game/scenes/MainScene.ts` | All combat logic (attack dispatch, bullet creation, melee, damage, death) |
| `game/objects/StickFigure.ts` | Entity state (`hp`, `lastFired`, `currentAmmo`, `isReloading`, `weaponType`, `aimSway`), `takeDamage()`, `getBarrelPosition()`, `playAttackAnimation()` |
| `types.ts` | `WeaponType` enum, `EVENTS` constants |
| `game/EventBus.ts` | Emitting `PLAYER_UPDATE`, `GAME_OVER`, `BOT_KILLED` events |

---

## Constants

### WEAPON_STATS

The single source of truth for all weapon parameters, defined as a top-level constant in `MainScene.ts`.

**Source**: `MainScene.ts:10-16`

| Weapon | damage | cooldown (ms) | range (px) | isMelee | color | speed (px/s) | clipSize | reloadTime (ms) | pellets |
|--------|--------|--------------|------------|---------|-------|-------------|----------|----------------|---------|
| BAT | 60 | 425 | 90 | true | 0xcccccc | 0 | 0 | 0 | — |
| KATANA | 100 | 800 | 110 | true | 0xffffff | 0 | 0 | 0 | — |
| UZI | 12 | 100 | 600 | false | 0xffff00 | 850 | 30 | 1200 | — |
| AK47 | 20 | 150 | 1000 | false | 0xffaa00 | 1250 | 20 | 2000 | — |
| SHOTGUN | 20 | 950 | 350 | false | 0x5d4037 | 900 | 6 | 2000 | 6 |

**Notes:**
- `damage` is per-hit for melee and per-bullet for ranged. The shotgun fires 6 pellets at 20 damage each, for a maximum of 120 damage per shot if all pellets connect.
- `cooldown` is the minimum milliseconds between attacks (not fire rate). Effective fire rates: BAT ~2.35/s, KATANA ~1.25/s, UZI 10/s, AK47 ~6.67/s, SHOTGUN ~1.05/s.
- `range` has different meanings: for melee weapons it's the radius of the swing arc check; for ranged weapons it's unused in hit detection (bullets travel until wall collision or world bounds).
- `color` is used for bullet tint (ranged) and slash arc color is always white for melee.
- `speed` is bullet velocity in px/s (0 for melee).
- `clipSize` of 0 means unlimited (melee weapons never need ammo/reload).
- `pellets` only exists on SHOTGUN; defaults to 1 for all other weapons.

### Other Combat Constants

| Constant | Value | Location | Description |
|----------|-------|----------|-------------|
| Bot aim inaccuracy | ±0.2 rad (~11°) | `MainScene.ts:609` | Random angle error added to bot shots |
| Melee arc half-angle | 1.0 rad (~57°) | `MainScene.ts:545` | `abs(angleDiff) < 1.0` check for melee hits |
| UZI spread | ±0.15 rad | `MainScene.ts:615` | `(random - 0.5) * 0.3` |
| AK47 spread | ±0.025 rad | `MainScene.ts:617` | `(random - 0.5) * 0.05` |
| SHOTGUN spread | ±0.3 rad | `MainScene.ts:619` | `(random - 0.5) * 0.6` |
| Shotgun speed variance | 0.8x-1.2x | `MainScene.ts:626-628` | `speed * (0.8 + random * 0.4)` |
| Bullet group max size | 50 | `MainScene.ts:112-113` | Per group (player and enemy separate) |
| Kill score | 100 | `MainScene.ts:881` | Points per bot kill |
| Weapon drop despawn | 30000 ms | `MainScene.ts:906` | Time before weapon drop auto-destroys |

---

## Data Structures

### Bullet Properties

Bullets are Phaser sprites obtained from an `Arcade.Group` pool. Custom properties are added dynamically at creation time (no TypeScript interface — uses `any`).

**Source**: `MainScene.ts:578-636`

```typescript
// Properties set on each bullet sprite
bullet.damageAmount: number;     // Damage to apply on hit
bullet.weaponType: WeaponType;   // Source weapon type
bullet.sourceX: number;          // Shooter's X position at fire time
bullet.sourceY: number;          // Shooter's Y position at fire time
bullet.owner: StickFigure;       // Reference to shooting entity
```

### Tracer

Visual bullet trail lines tracked per frame.

**Source**: `MainScene.ts:18-20`

```typescript
interface Tracer {
  x1: number; y1: number;   // Start point
  x2: number; y2: number;   // End point
  alpha: number;             // Decreases by delta/150 per frame
  color: number;             // 0xffffff (hit) or 0xff0000 (kill)
}
```

---

## Behavior

### Attack Dispatch

All attacks (player and bot, melee and ranged) flow through a common dispatcher chain.

**Source**: `MainScene.ts:474-513`

```
function handleAttacks(time):
    // Mobile: auto-fire when aim joystick deflected > 0.3
    isMobileFiring = aimStick.active AND (abs(aimStick.x) > 0.3 OR abs(aimStick.y) > 0.3)

    // Desktop: left mouse button (only when joystick not active)
    isMouseFiring = !aimStick.active AND (mousePointer.primaryDown OR mousePointer.isDown)

    if isMobileFiring OR isMouseFiring:
        executeAttack(player, bullets, isPlayer=true)


function executeAttack(unit, bulletGroup, isPlayer):
    if unit.isReloading: return    // Can't attack while reloading

    now = time.now
    stats = WEAPON_STATS[unit.weaponType]

    if now > unit.lastFired + stats.cooldown:
        if !stats.isMelee:
            if unit.currentAmmo <= 0:
                reloadWeapon(unit)     // Auto-reload on empty
                return
            unit.currentAmmo--
            if isPlayer: updateAmmoUI()

        unit.lastFired = now
        unit.playAttackAnimation()

        if stats.isMelee:
            performMeleeAttack(unit, stats, isPlayer)
        else:
            fireBullet(unit, bulletGroup, stats.color, stats.speed, stats.damage, unit.weaponType)
```

**Key details:**
- `executeAttack()` is the same function for both player and bots
- Cooldown is enforced via `lastFired` timestamp comparison
- Reloading blocks all attacks (both melee and ranged, though melee weapons never reload)
- Empty magazine triggers auto-reload and aborts the shot
- Ammo decrement happens before bullet creation (if bullet pool is full, ammo is still consumed)

---

### Ranged Attack (fireBullet)

Creates one or more projectile sprites from the shooter's barrel position.

**Source**: `MainScene.ts:556-639`

```
function fireBullet(shooter, group, color, speed, damage, weaponType):
    startPos = shooter.getBarrelPosition()

    // 1. Wall obstruction check: if barrel is inside a wall, spark and abort
    lineOfFire = Line(shooter.x, shooter.y, startPos.x, startPos.y)
    for each wall rect:
        if line intersects rect:
            spawn yellow spark at startPos, abort
            return

    // 2. Determine pellet count (1 for all except SHOTGUN which is 6)
    pelletCount = stats.pellets OR 1

    // 3. Create each pellet
    for i = 0 to pelletCount:
        bullet = group.get(startPos.x, startPos.y)
        if !bullet: continue    // Pool exhausted

        // Set custom properties
        bullet.damageAmount = damage
        bullet.weaponType = weaponType
        bullet.sourceX = shooter.x
        bullet.sourceY = shooter.y
        bullet.owner = shooter

        // Texture and visual setup per weapon type
        if AK47:  bullet_tracer texture, tint 0xffaa00, body circle radius 2
        if SHOTGUN: bullet_pellet texture, tint 0xff0000, scale 1.2, body circle radius 3
        else:     bullet_pellet texture, tint 0xffff00, scale 1, body circle radius 2

        // 4. Calculate final angle
        angle = shooter.rotation + shooter.aimSway

        // Bot inaccuracy: ±0.2 rad (~11°)
        if shooter != player:
            angle += (random - 0.5) * 0.4

        // Per-weapon spread
        spread = 0
        if UZI:     spread = (random - 0.5) * 0.3
        if AK47:    spread = (random - 0.5) * 0.05
        if SHOTGUN:  spread = (random - 0.5) * 0.6

        finalAngle = angle + spread

        // Shotgun speed variance
        actualSpeed = speed
        if SHOTGUN: actualSpeed = speed * (0.8 + random * 0.4)

        // 5. Apply velocity
        vec = velocityFromRotation(finalAngle, actualSpeed)
        bullet.setRotation(finalAngle)
        bullet.body.reset(startPos.x, startPos.y)
        bullet.setVelocity(vec.x, vec.y)
```

**Barrel position** is calculated by `StickFigure.getBarrelPosition()` which offsets from the entity center by a weapon-specific distance along the `rotation + aimSway` angle:

| Weapon | Barrel Offset (px) |
|--------|-------------------|
| AK47 | 55 |
| SHOTGUN | 45 |
| UZI | 35 |
| Default | 30 |

**Source**: `StickFigure.ts:89-100`

**Wall obstruction**: Before firing, a line is traced from the shooter's center to the barrel tip. If it intersects any wall rectangle, the shot is blocked and a brief yellow spark visual is spawned. This prevents shooting through walls when the shooter is pressed against one.

**Spread model**: There is no recoil accumulation. Each shot independently samples a random spread within the weapon's range. The total angular deviation of a bullet is: `rotation + aimSway + botInaccuracy + weaponSpread`.

---

### Melee Attack (performMeleeAttack)

Melee attacks check a range + angle cone and apply damage to all entities within it.

**Source**: `MainScene.ts:515-554`

```
function performMeleeAttack(attacker, stats, isPlayer):
    range = stats.range
    angle = attacker.rotation

    // 1. Visual: draw white arc at attacker position
    draw arc from (angle - 0.7) to (angle + 0.7) at radius=range
    tween arc alpha to 0 over 200ms, then destroy

    // 2. Build victim list
    potentialVictims = []
    if !isPlayer AND !player.isDead: add player
    for each enemy != attacker AND !dead AND active: add enemy

    // 3. Check each victim
    for each victim:
        dist = distance(attacker, victim)
        if dist < range:
            // Line of sight check (melee can't go through walls)
            if !hasLineOfSight(attacker, victim): skip

            // Angle check: is victim within the swing arc?
            angleToVictim = atan2(victim.y - attacker.y, victim.x - attacker.x)
            diff = angleWrap(angleToVictim - attacker.rotation)
            if abs(diff) < 1.0:     // ~57 degrees half-arc
                if victim is player:
                    damagePlayer(stats.damage, attacker.x, attacker.y)
                else:
                    damageEnemy(victim, stats.damage, attacker)
```

**Key details:**
- Multi-hit: a single melee swing can hit multiple entities
- Line of sight is checked per-victim (melee can't hit through walls)
- The angle check uses `Phaser.Math.Angle.Wrap()` to normalize the difference to [-PI, PI], then checks if `abs(diff) < 1.0` radians (~57° half-arc, ~114° total arc)
- The visual arc is drawn from `-0.7` to `+0.7` radians relative to attacker rotation (~80° visual arc), which is narrower than the actual hit detection arc (~114°)
- No knockback system exists in the prototype (unlike the post-BMM spec)
- Both BAT and KATANA use the same melee logic; only `range` and `damage` differ

---

### Reload System

Reload is triggered manually (R key) or automatically (empty magazine during fire attempt).

**Source**: `MainScene.ts:342-379`

```
function handleReloadInput():
    if R key down AND !player.isReloading AND player.currentAmmo < player.maxAmmo:
        if weapon is not melee:
            reloadWeapon(player)


function reloadWeapon(unit):
    if unit.isReloading: return
    if weapon is melee: return

    unit.isReloading = true
    if unit is player: updateAmmoUI()

    unit.playReloadAnimation()    // Visual: weapon container pulses alpha/scale

    // Progress bar tween
    tweens.addCounter({
        from: 0, to: 1,
        duration: stats.reloadTime,    // UZI=1200ms, AK47=2000ms, SHOTGUN=2000ms
        onUpdate: (tween) =>
            if !unit.active: tween.stop()
            unit.drawReloadBar(tween.getValue())
        onComplete: () =>
            if !unit.active: return
            unit.isReloading = false
            unit.currentAmmo = unit.maxAmmo    // Full clip restored
            unit.drawReloadBar(0)              // Clear reload bar
            if unit is player: updateAmmoUI()
    })
```

**Key details:**
- Reload restores full magazine (`currentAmmo = maxAmmo`), not individual rounds
- Manual reload (R key) only works when not already reloading and ammo < max
- Auto-reload triggers when `executeAttack()` finds ammo at 0 for a ranged weapon
- The reload progress bar is drawn above the entity (see [player.md](player.md) for visual)
- If the entity is destroyed during reload (e.g., killed), the tween stops early
- Bots auto-reload when their ammo reaches 0 (checked in `handleEnemies()`, `MainScene.ts:715-717`)

---

### Collision and Hit Detection

Hit detection is handled by Phaser's built-in Arcade physics colliders, not manual per-frame checks.

**Source**: `MainScene.ts:151-164` (setup), `791-938` (handlers)

#### Player Bullet → Enemy

**Source**: `MainScene.ts:791-797`

```
function handleBulletEnemyCollision(bullet, enemy):
    if bullet.active AND enemy.active:
        bullet.destroy()
        damage = bullet.damageAmount OR 10    // Fallback to 10 if unset
        damageEnemy(enemy, damage, player)    // Always credits player
```

**Note**: The attacker is hardcoded as `this.player` since the `bullets` group only contains player-fired projectiles.

#### Enemy Bullet → Player

**Source**: `MainScene.ts:929-938`

```
function handlePlayerHitByBullet(player, bullet):
    if bullet.active AND !player.isDead:
        if bullet.owner === player: return    // Self-damage prevention
        damage = bullet.damageAmount OR 10
        sourceX = bullet.sourceX OR bullet.x
        sourceY = bullet.sourceY OR bullet.y
        bullet.destroy()
        damagePlayer(damage, sourceX, sourceY)
```

#### Enemy Bullet → Enemy (Friendly Fire)

**Source**: `MainScene.ts:799-807`

```
function handleEnemyBulletHitEnemy(bullet, enemy):
    if bullet.active AND enemy.active:
        if bullet.owner === enemy: return     // Self-damage prevention
        bullet.destroy()
        damage = bullet.damageAmount OR 10
        attacker = bullet.owner
        damageEnemy(enemy, damage, attacker)
```

Bot-on-bot friendly fire is enabled. The only protection is the self-damage check (`bullet.owner === enemy`).

#### Bullet → Wall

**Source**: `MainScene.ts:923-927`

```
function handleBulletWallCollision(bullet, wall):
    if bullet.active:
        bullet.destroy()
```

Bullets are simply destroyed on wall contact. No ricochet, no penetration.

---

### Damage Application

#### damageEnemy

Applies damage to a bot, handles kill scoring, and spawns weapon drops.

**Source**: `MainScene.ts:862-886`

```
function damageEnemy(enemy, amount, attacker):
    enemy.takeDamage(amount)    // StickFigure.takeDamage: hp -= amount, flash, maybe die()

    isKill = enemy.isDead
    isPlayerAttack = (attacker === player)

    if isPlayerAttack:
        showHitMarker(enemy, isKill)           // Reticle marker + directional indicator
        showDamageNumber(enemy.x, enemy.y, amount, isKill)   // Floating number
    else:
        showDamageNumber(...).setScale(0.7).setAlpha(0.8)     // Dimmer for bot-on-bot

    if isKill:
        spawnWeaponDrop(enemy.x, enemy.y, enemy.weaponType)
        if isPlayerAttack:
            stats.kills++
            stats.score += 100
            emit BOT_KILLED { name: enemy.nameText.text }
            emit PLAYER_UPDATE(stats)
```

#### damagePlayer

Applies damage to the human player, handles game over.

**Source**: `MainScene.ts:976-989`

```
function damagePlayer(amount, sourceX, sourceY):
    if player.isDead: return

    lastDamageTime = time.now       // Reset regen delay
    player.takeDamage(amount)
    stats.health = player.hp
    emit PLAYER_UPDATE(stats)

    showDamageReceived(sourceX, sourceY)   // Directional indicator, camera flash, blood

    if player.isDead:
        emit GAME_OVER { score: stats.score, kills: stats.kills }
```

**Key details:**
- `lastDamageTime` reset interrupts health regeneration (3-second delay before regen resumes)
- Player death is final — `GAME_OVER` event triggers the React death screen
- No invulnerability frames after taking damage

#### StickFigure.takeDamage

The entity-level damage method.

**Source**: `StickFigure.ts:390-415`

```
function takeDamage(amount):
    hp = max(0, hp - amount)

    // Visual: flash alpha 255→0→255 over 100ms
    if scene AND graphics:
        tween alpha flash

    if hp <= 0 AND !isDead:
        die()
```

---

### Death and Weapon Drops

#### StickFigure.die()

**Source**: `StickFigure.ts:417-456`

```
function die():
    isDead = true
    clear all graphics
    destroy weapon container, name text, sprite

    // Draw death corpse: 4 gray lines radiating from death position, gray circle head
    // Corpse fades out after 5000ms delay over 2000ms duration
```

#### Weapon Drop Spawning

When an enemy dies, their weapon is dropped.

**Source**: `MainScene.ts:888-912`

```
function spawnWeaponDrop(x, y, weaponType):
    drop = weaponDrops.create(x, y, 'drop_{type}')
    drop.weaponType = type
    drop.setDepth(5)

    // Bobbing animation: y -5px, yoyo, 1000ms repeat forever
    // Glowing ring: circle stroke scale 1.5x, alpha fade, repeat forever

    // Auto-destroy after 30 seconds
    time.delayedCall(30000, () => destroy if still active)
```

#### Weapon Pickup

**Source**: `MainScene.ts:914-921`

```
function handleWeaponPickup(player, drop):
    if !drop.active: return
    newWeapon = drop.weaponType
    show floating text "Picked up {weapon}"
    setPlayerWeapon(newWeapon)    // Full clip, new weapon type
    destroy glow effect and drop
```

`setPlayerWeapon()` calls `player.setWeapon(type, clipSize)` which resets ammo to full, clears reload state, and redraws the weapon visual.

---

### Damage Visual Effects

#### Hit Marker (Player → Enemy)

**Source**: `MainScene.ts:809-847`

When the player hits an enemy:
1. Reticle-position hit marker sprite, fading over 150ms
   - Kill: red tint, scale 2.0
   - Hit: white tint, scale 1.2
2. Directional indicator sprite at 60px from player toward enemy, fading over 200ms
3. Tracer line from player to target added to `activeTracers` (white for hit, red for kill)
4. Camera shake: 50ms duration, 0.001 intensity

#### Damage Number

**Source**: `MainScene.ts:849-860`

Floating text showing damage amount above the target. Rises 50px and fades over 800ms.
- Kill: red, 24px font
- Hit: white, 16px font
- Bot-on-bot: dimmer (0.7 scale, 0.8 alpha)

#### Damage Received (Enemy → Player)

**Source**: `MainScene.ts:940-974`

When the player takes damage:
1. Directional indicator at 60px from player toward damage source, red tint, fades over 400ms
2. Camera flash: 100ms, red overlay (`128, 0, 0`)
3. Blood particles: 5 circles (radius 2-5px, color `0xcc0000`) burst outward from damage direction, with physics drag 200, fade over 500ms

---

## Error Handling

### Ammo Edge Cases

- `currentAmmo` is decremented before bullet creation. If the bullet pool is full (`group.get()` returns null), ammo is consumed but no bullet appears.
- Melee weapons have `clipSize: 0`, so `currentAmmo` and `maxAmmo` are both 0. The `isMelee` check in `executeAttack()` skips the ammo decrement entirely.

### Destroyed Entity Guards

- `handleBulletEnemyCollision()` checks `bullet.active && enemy.active`
- `handlePlayerHitByBullet()` checks `bullet.active && !player.isDead`
- `handleEnemyBulletHitEnemy()` checks `bullet.active && enemy.active`
- `handleWeaponPickup()` checks `drop.active`
- Reload tween callbacks check `unit.active` before updating/completing
- `damagePlayer()` returns early if `player.isDead`
- `damageEnemy()` checks `typeof enemy.takeDamage === 'function'` before calling

### Self-Damage Prevention

- Player and enemy bullets are in **separate groups** — the physics collider for `bullets` only targets `enemies`, and `enemyBullets` only targets `player`.
- `handleEnemyBulletHitEnemy()` explicitly checks `bullet.owner === enemy` to prevent bots from damaging themselves with their own projectiles.
- `handlePlayerHitByBullet()` checks `bullet.owner === player` to prevent edge cases.

### Wall Interaction

- Bullets are destroyed on wall collision (no penetration)
- `fireBullet()` checks barrel-to-center line for wall intersection before creating bullets (prevents shooting through walls when pressed against them)
- `performMeleeAttack()` checks line of sight per victim (melee can't hit through walls)

---

## Implementation Notes

### TypeScript (Client-Only)

**Attack timing**: Cooldowns use `this.time.now` (Phaser's scene clock) rather than `Date.now()`. This means cooldowns pause when the scene is paused or the tab is inactive, and are tied to the game timeline rather than wall clock.

**Bullet pooling**: `Phaser.Physics.Arcade.Group` with `maxSize: 50` acts as an object pool. `group.get()` returns a recycled sprite or `null` if the pool is exhausted. Bullets are activated/deactivated rather than created/destroyed for performance.

**Collision architecture**: The separation of `bullets` and `enemyBullets` into distinct groups is the core self-damage prevention mechanism. This avoids per-bullet owner checks for the majority case (player vs enemies) while still supporting bot-on-bot friendly fire through the additional overlap handler.

**Damage fallback**: All collision handlers use `bullet.damageAmount || 10` as a fallback. The `|| 10` is defensive coding against bullets missing their `damageAmount` property, though in practice this property is always set in `fireBullet()`.

**No damage types**: There is no concept of damage types, armor, resistance, or critical hits. All damage is flat subtraction from `hp`.

---

## Cross-Reference Index

| Topic | Spec |
|-------|------|
| StickFigure entity (hp, takeDamage, die) | [player.md](player.md) |
| Attack animations (swing, recoil, muzzle flash) | [player.md](player.md#attack-animations) |
| AI attack logic (when bots fire) | [ai.md](ai.md) |
| Hit markers, damage numbers, blood particles | [rendering.md](rendering.md) |
| Ammo UI, health bar, game over screen | [ui.md](ui.md) |
| WEAPON_STATS declared in MainScene | [main-scene.md](main-scene.md#weapon_stats) |
| Weapon types and EVENTS constants | [types-and-events.md](types-and-events.md) |
| Line of sight system | [main-scene.md](main-scene.md#line-of-sight) |
| Gemini bot taunts on BOT_KILLED | [gemini-service.md](gemini-service.md) |

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-02-15 | Initial specification documenting pre-BMM archive snapshot |
| 1.0.1 | 2026-02-16 | Verified against source — all weapon stats, line numbers, spread values, and combat mechanics match |
