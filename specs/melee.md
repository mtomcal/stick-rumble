# Melee Combat

> **Spec Version**: 1.2.2
> **Last Updated**: 2026-04-22
> **Depends On**: [constants.md](constants.md), [player.md](player.md), [weapons.md](weapons.md), [hit-detection.md](hit-detection.md)
> **Depended By**: [messages.md](messages.md), [graphics.md](graphics.md)

---

## Overview

Melee combat provides close-range weapons (Bat and Katana) as alternatives to ranged weapons. Unlike projectile-based attacks, melee attacks threaten targets within a cone-shaped area in front of the attacker only when those targets are fully visible and reachable through open space. A strict line-of-sight requirement ensures walls and barriers completely block melee attacks—enabling area-of-effect (AoE) damage only against exposed targets without allowing swords or bats to damage through solid barriers.

**Why melee weapons exist:**
1. **Risk/reward gameplay**: Higher damage per hit compensates for the danger of close-range engagement
2. **Counter to mobile players**: AoE cone attack can catch dodging enemies more easily than single projectiles
3. **No ammo management**: Infinite swings removes reload downtime but requires getting close
4. **Weapon variety**: Provides fundamentally different playstyle from ranged combat

**Weapon design philosophy:**
- **Bat**: Lower damage (25), faster swings (2/s), knockback creates spacing
- **Katana**: Higher damage (45), slower swings (1.25/s), longer reach rewards positioning

---

## Dependencies

### Technology Dependencies

| Technology | Version | Purpose |
|------------|---------|---------|
| Go | 1.25 | Server-side hit detection and damage |
| TypeScript | 5.9.3 | Client-side swing animations |
| Phaser 3 | 3.90.0 | Graphics rendering for swing arc |

### Spec Dependencies

- [constants.md](constants.md) - Melee weapon range, arc, and damage values
- [player.md](player.md) - Player position, aim angle, health, death handling
- [weapons.md](weapons.md) - Weapon stats (Bat: 90px range, 25 damage; Katana: 110px range, 45 damage)
- [hit-detection.md](hit-detection.md) - Damage application and death triggering

---

## Constants

All melee constants are defined in [constants.md](constants.md#melee-weapon-constants). Key values:

| Constant | Bat | Katana | Description |
|----------|-----|--------|-------------|
| Damage | 25 | 45 | HP removed per hit |
| Range | 90 px | 110 px | Maximum distance to target |
| Arc | 80° | 80° | Cone width (40° each side of aim) |
| Fire Rate | 2/s | 1.25/s | Swings per second |
| Knockback | 40 px | 0 px | Distance target is pushed |
| Cooldown | 500 ms | 800 ms | Time between swings |

**Why these values:**
- **Bat damage (25)**: 4 hits to kill (100 HP / 25 = 4), balanced by fast swing rate
- **Katana damage (45)**: ~2-3 hits to kill, but slower swing rate
- **80° arc**: Wide enough to catch strafing enemies, narrow enough to require aiming
- **Bat knockback (40px)**: Creates spacing after hit, prevents stunlock combos
- **Katana no knockback**: Higher damage is the trade-off for no crowd control

---

## Data Structures

### MeleeAttackResult (Server)

Result returned from `PerformMeleeAttack` function.

**Go:**
```go
type MeleeAttackResult struct {
    HitPlayers       []*PlayerState // Players that were hit
    KnockbackApplied bool           // Whether knockback was applied (Bat only)
}
```

### MeleeResult (Server)

Result returned from `GameServer.PlayerMeleeAttack`.

**Go:**
```go
type MeleeResult struct {
    Success          bool           // Whether the attack was executed
    Reason           string         // Failure reason if Success == false
    HitPlayers       []*PlayerState // Players hit by the attack
    KnockbackApplied bool           // Whether knockback was applied
}

// Failure reason constants
const (
    MeleeFailedNoPlayer   = "no_player"    // Player ID not found
    MeleeFailedNoWeapon   = "no_weapon"    // No weapon state for player
    MeleeFailedNotMelee   = "not_melee"    // Current weapon is ranged
    MeleeFailedPlayerDead = "player_dead"  // Attacker is dead
)
```

**Why these failure reasons:**
- Matching ranged attack pattern for consistency
- Enables client debugging of rejected attacks
- Server logs failures for exploit detection

### MeleeHitData (Message Schema)

Server-to-client message sent when a melee attack occurs.

**TypeScript:**
```typescript
interface MeleeHitData {
    attackerId: string;      // Player who swung
    victims: string[];       // Array of hit player IDs (may be empty)
    knockbackApplied: boolean; // True for Bat attacks
}
```

**Go (broadcast):**
```go
type MeleeHitMessage struct {
    Type      string `json:"type"`      // "melee:hit"
    Timestamp int64  `json:"timestamp"` // Unix milliseconds
    Data      struct {
        AttackerID       string   `json:"attackerId"`
        Victims          []string `json:"victims"`
        KnockbackApplied bool     `json:"knockbackApplied"`
    } `json:"data"`
}
```

**Why `melee:hit` broadcasts even with no victims:**
- Client needs to show swing animation regardless of hits
- Visual feedback that attack was attempted
- Audio cue plays on all swings

---

## Behavior

### Melee Attack Flow

**Sequence Diagram:**
```
Client                        Server
  |                             |
  |-- player:melee_attack ----->|
  |    { aimAngle }             |
  |                             |
  |                             | 1. Validate attacker exists
  |                             | 2. Check attacker is alive
  |                             | 3. Verify weapon is melee
  |                             | 4. Find targets in range + arc
  |                             | 5. Apply damage to each
  |                             | 6. Apply knockback (Bat only)
  |                             |
  |<---- melee:hit -------------|  (broadcast to room)
  |    { attackerId, victims,   |
  |      knockbackApplied }     |
  |                             |
  |<---- player:damaged --------|  (for each victim)
  |    { victimId, attackerId,  |
  |      damage, newHealth }    |
```

**Pseudocode:**
```
function PlayerMeleeAttack(playerID, aimAngle):
    // Validation
    player = world.GetPlayer(playerID)
    if player == null:
        return { Success: false, Reason: "no_player" }

    if !player.IsAlive():
        return { Success: false, Reason: "player_dead" }

    weapon = GetWeaponState(playerID)
    if weapon == null:
        return { Success: false, Reason: "no_weapon" }

    if !weapon.IsMelee():
        return { Success: false, Reason: "not_melee" }

    // Update aim direction
    player.SetAimAngle(aimAngle)

    // Perform attack
    result = PerformMeleeAttack(player, allPlayers, weapon)

    return {
        Success: true,
        HitPlayers: result.HitPlayers,
        KnockbackApplied: result.KnockbackApplied
    }
```

**Go Implementation:**
```go
func (gs *GameServer) PlayerMeleeAttack(playerID string, aimAngle float64) MeleeResult {
    player, exists := gs.world.GetPlayer(playerID)
    if !exists {
        return MeleeResult{Success: false, Reason: MeleeFailedNoPlayer}
    }

    if !player.IsAlive() {
        return MeleeResult{Success: false, Reason: MeleeFailedPlayerDead}
    }

    gs.weaponMu.RLock()
    ws := gs.weaponStates[playerID]
    gs.weaponMu.RUnlock()

    if ws == nil {
        return MeleeResult{Success: false, Reason: MeleeFailedNoWeapon}
    }

    if !ws.Weapon.IsMelee() {
        return MeleeResult{Success: false, Reason: MeleeFailedNotMelee}
    }

    player.SetAimAngle(aimAngle)

    // Get all players directly from world.players map (under read lock)
    gs.world.mu.RLock()
    allPlayers := make([]*PlayerState, 0, len(gs.world.players))
    for _, p := range gs.world.players {
        allPlayers = append(allPlayers, p)
    }
    gs.world.mu.RUnlock()

    result := PerformMeleeAttack(player, allPlayers, ws.Weapon)

    return MeleeResult{
        Success:          true,
        HitPlayers:       result.HitPlayers,
        KnockbackApplied: result.KnockbackApplied,
    }
}
```

---

### Hit Detection (Range + Arc + Occlusion Check)

Melee attacks use a cone-shaped hit area defined by range (distance) and arc (angle), but range and arc alone are not sufficient for a valid hit.

**Pseudocode:**
```
function isInMeleeRange(attacker, target, weapon):
    // Calculate distance
    dx = target.x - attacker.x
    dy = target.y - attacker.y
    distance = sqrt(dx² + dy²)

    // Check range
    if distance > weapon.range:
        return false

    // Calculate angle from attacker to target
    angleToTarget = atan2(dy, dx)  // radians

    // Normalize both angles to [0, 360)
    angleToTargetDeg = toDegrees(angleToTarget)
    if angleToTargetDeg < 0:
        angleToTargetDeg += 360

    aimAngleDeg = toDegrees(attacker.aimAngle)
    if aimAngleDeg < 0:
        aimAngleDeg += 360

    // Calculate angular difference (handle wraparound)
    angleDiff = abs(angleToTargetDeg - aimAngleDeg)
    if angleDiff > 180:
        angleDiff = 360 - angleDiff

    // Check if within arc (half on each side)
    halfArc = weapon.arcDegrees / 2
    if angleDiff > halfArc:
        return false

    // Range + arc are necessary but not sufficient
    // The target must also be reachable before any blocking barrier
    return hasUnobstructedMeleePath(attacker, target)
```

**Go Implementation:**
```go
func isInMeleeRange(attacker *PlayerState, target *PlayerState, weapon *Weapon) bool {
    attackerPos := attacker.GetPosition()
    targetPos := target.GetPosition()
    aimAngle := attacker.GetAimAngle()

    // Calculate distance
    dx := targetPos.X - attackerPos.X
    dy := targetPos.Y - attackerPos.Y
    distance := math.Sqrt(dx*dx + dy*dy)

    // Range check
    if distance > weapon.Range {
        return false
    }

    // Angle to target (in degrees)
    angleToTarget := math.Atan2(dy, dx) * (180 / math.Pi)
    if angleToTarget < 0 {
        angleToTarget += 360
    }

    // Aim angle (in degrees)
    aimAngleDeg := aimAngle * (180 / math.Pi)
    if aimAngleDeg < 0 {
        aimAngleDeg += 360
    }

    // Angular difference with wraparound handling
    angleDiff := math.Abs(angleToTarget - aimAngleDeg)
    if angleDiff > 180 {
        angleDiff = 360 - angleDiff
    }

    // Arc check
    halfArc := weapon.ArcDegrees / 2
    if angleDiff > halfArc {
        return false
    }

    // Target must still be reachable without blocking geometry in between.
    return hasUnobstructedMeleePath(attacker, target)
}
```

**Why cone detection instead of rectangle/circle:**
- **Intuitive**: Players aim with mouse, cone naturally extends from character
- **Balanced**: Wide enough to catch nearby enemies, requires directional aim
- **Visual match**: Swing animation draws a stroke-only arc that matches hitbox

### Barrier Occlusion

Range and arc are necessary but not sufficient. A melee hit is only valid if the target is fully reachable without a blocking barrier in between, using strict line-of-sight requirements.

**Strict Line-of-Sight Requirements:**
1. **Center point must be clear**: The target's center point must have an unobstructed path from the attacker. If blocked, the attack fails immediately (no hit).
2. **Majority of hitbox must be exposed**: At least 5 of 9 sample points on the target hitbox must be reachable (center + at least 4 of 8 edge/corner points).
3. **Segment geometry**: The path is evaluated as a finite line segment from the attacker's center position to each target sample point.
4. **Boundary-inclusive intersection**: If the segment touches or crosses any wall boundary, that target point is considered blocked (first-contact resolution applies).
5. **First-contact resolution**: When multiple obstacles exist, the closest obstacle along the segment blocks the path.

- the obstruction check uses authoritative gameplay geometry, not rendered sprite pixels
- the path is evaluated from the attacker center toward the victim's authoritative hit volume
- if a wall or other blocking barrier is reached first, the target is not hit

---

### Multi-Target Hit Detection

A single melee swing can hit multiple players within the cone.

**Pseudocode:**
```
function PerformMeleeAttack(attacker, allPlayers, weapon, mapConfig):
    if weapon == null OR !weapon.IsMelee():
        return { HitPlayers: [], KnockbackApplied: false }

    // Resolve a default map configuration if one is not provided
    mapConfig = resolveMapConfig(mapConfig)

    hitPlayers = []
    knockbackApplied = false

    for target in allPlayers:
        // Skip self
        if target.id == attacker.id:
            continue

        // Skip dead players
        if !target.IsAlive():
            continue

        // Check range, arc, and strict line-of-sight
        if isInMeleeRange(attacker, target, weapon) && hasMeleeReach(attacker, target, weapon, mapConfig):
            hitPlayers.append(target)
            target.TakeDamage(weapon.damage)

            // Apply knockback (Bat only)
            if weapon.knockbackDistance > 0:
                applyKnockback(attacker, target, weapon.knockbackDistance, mapConfig)
                knockbackApplied = true

    return { HitPlayers: hitPlayers, KnockbackApplied: knockbackApplied }

function hasMeleeReach(attacker, target, weapon, mapConfig):
    // Sample 9 points on target hitbox (center, edges, corners)
    samplePoints = getTargetHitboxSamplePoints(target.position)
    
    // Check center point first (short-circuit if blocked)
    centerPoint = samplePoints[0] // center
    if segmentBlockedByObstacle(attacker.position, centerPoint, mapConfig.obstacles):
        return false
    
    // Center is clear, check remaining points
    reachableCount = 1 // center counts as 1
    for i = 1 to 8: // remaining edge and corner points
        // Occlusion is checked here only for points that are already valid
        // melee candidates under the range/arc gate.
        if pointWithinRangeAndArc(attacker.position, samplePoints[i], attacker.aimAngle, weapon) &&
           !segmentBlockedByObstacle(attacker.position, samplePoints[i], mapConfig.obstacles):
            reachableCount++
        // Short-circuit: stop if we already have 5 reachable points
        if reachableCount >= 5:
            return true
    
    // Return true if majority (5/9) or more points are reachable
    return reachableCount >= 5

function segmentBlockedByObstacle(start, end, obstacles):
    // Find closest obstacle along segment (first-contact resolution)
    closestObstacle = null
    closestDistance = infinity
    
    for each obstacle in obstacles:
        if !obstacle.blocksMovement && !obstacle.blocksProjectiles && !obstacle.blocksLineOfSight:
            continue // Skip non-blocking obstacles
        
        // Check if segment intersects obstacle (boundary-inclusive)
        if segmentIntersectsRectangle(start, end, obstacle):
            distance = distanceToIntersection(start, end, obstacle)
            if distance < closestDistance:
                closestDistance = distance
                closestObstacle = obstacle
    
    // If any obstacle found, check if it's closer than target
    if closestObstacle != null:
        targetDistance = distance(start, end)
        return closestDistance <= targetDistance
    
    return false // No obstacle blocks the path
```

**Go Implementation:**
```go
func PerformMeleeAttack(attacker *PlayerState, allPlayers []*PlayerState, weapon *Weapon) *MeleeAttackResult {
    if weapon == nil || !weapon.IsMelee() {
        return &MeleeAttackResult{HitPlayers: []*PlayerState{}, KnockbackApplied: false}
    }

    result := &MeleeAttackResult{
        HitPlayers:       make([]*PlayerState, 0),
        KnockbackApplied: false,
    }

    for _, target := range allPlayers {
        if target.ID == attacker.ID {
            continue
        }
        if !target.IsAlive() {
            continue
        }
        if isInMeleeRange(attacker, target, weapon) {
            result.HitPlayers = append(result.HitPlayers, target)
            target.TakeDamage(weapon.Damage)

            if weapon.KnockbackDistance > 0 {
                applyKnockback(attacker, target, weapon.KnockbackDistance)
                result.KnockbackApplied = true
            }
        }
    }

    return result
}
```

**Why multi-hit:**
- **AoE attacks**: Core melee weapon advantage over ranged
- **Crowd control**: Bat knockback affects all targets in cone
- **Risk/reward**: Close range exposure compensated by multi-target potential

---

### Knockback Application

The Bat applies 40px knockback to all hit targets, pushing them away from the attacker until the first blocking contact.

**Pseudocode:**
```
function applyKnockback(attacker, target, knockbackDistance):
    // Calculate direction from attacker to target
    dx = target.x - attacker.x
    dy = target.y - attacker.y
    distance = sqrt(dx² + dy²)

    // No knockback if at same position (avoid divide by zero)
    if distance == 0:
        return

    // Normalize direction
    dirX = dx / distance
    dirY = dy / distance

    // Apply knockback displacement
    candidateX = target.x + dirX * knockbackDistance
    candidateY = target.y + dirY * knockbackDistance

    // Stop at first blocking contact; do not tunnel or slide through the barrier
    resolvedPosition = resolveFirstBlockingContact(target.position, (candidateX, candidateY))

    // Clamp to arena bounds after obstacle resolution
    resolvedPosition = clampToArena(resolvedPosition)

    target.SetPosition(resolvedPosition)
```

**Go Implementation:**
```go
func applyKnockback(attacker *PlayerState, target *PlayerState, knockbackDistance float64) {
    attackerPos := attacker.GetPosition()
    targetPos := target.GetPosition()

    dx := targetPos.X - attackerPos.X
    dy := targetPos.Y - attackerPos.Y
    distance := math.Sqrt(dx*dx + dy*dy)

    if distance == 0 {
        return // No knockback if at exact same position
    }

    // Normalize direction and apply displacement
    dirX := dx / distance
    dirY := dy / distance
    candidate := Vector2{
        X: targetPos.X + dirX*knockbackDistance,
        Y: targetPos.Y + dirY*knockbackDistance,
    }

    // Stop at the first blocking contact rather than tunneling or sliding.
    resolved := resolveKnockbackAgainstBarriers(targetPos, candidate)

    // Arena bounds are still authoritative after obstacle resolution.
    resolved = clampToArena(resolved)

    target.SetPosition(resolved)
}
```

**Why knockback exists:**
- **Spacing control**: Bat user can create distance after hit
- **Arena positioning**: Push enemies into corners or toward edges
- **Combo prevention**: Prevents infinite melee stunlock chains
- **Differentiation**: Bat = crowd control, Katana = raw damage

**Why Katana has no knockback:**
- Higher base damage (45 vs 25) is the trade-off
- Longer range (110px vs 90px) provides inherent safety
- Design choice: two distinct melee playstyles

**Hard-stop rule:** When knockback would push a victim into a solid barrier, the victim stops at the first blocking contact. The wall remains a hard stop. Knockback does not tunnel through the barrier and does not side-slide along it unless a future spec explicitly adds that behavior.

---

### Swing Animation

The melee attack is presented as a **weapon-following swing motion**, not a literal player-centered area-of-effect overlay. The range-and-arc hitbox remains a gameplay rule for server hit detection, but it is not rendered as a debug cone in normal play.

**Visual grammar:**
- Every swing shows readable weapon motion plus a short-lived motion trail
- The local attacker gets an immediate client-side swing preview on click for responsiveness
- Other players see the swing only from the server-confirmed `melee:hit` room event
- A whiff still shows swing motion, but **no** contact effect
- A confirmed hit spawns a separate world-space contact effect at each victim's contact point
- The swing trail follows the weapon's actual animated path (bat head / blade path), not a fixed-radius arc centered on the player
- The swing trail stays visually attached to the held weapon pivot and tip path so the sweep reads as the bat or blade moving through space
- The swing trail must not appear as a large player-centered radius or ring that floats ahead of the held weapon and overstates reach
- The player body remains mostly stable; the expressive motion lives in the arms and weapon

**Weapon feel by type:**
- **Bat**: slightly heavier anticipation, wider trail, chunkier follow-through, blunt impact burst / shock effect on contact
- **Katana**: tighter anticipation, faster release, thinner directional trail, sharp slash-flare effect on contact

| Property | Value |
|----------|-------|
| Local Preview | Immediate, attacker only |
| Remote Swing Visibility | Server-confirmed via `melee:hit` |
| Hitbox Overlay | Not shown literally |
| Motion Lifetime | Brief; readable but not telegraphed |
| Anticipation | Present, but subtle and fast |
| Contact Effect Location | Victim / contact point |
| Multi-Hit Behavior | Each victim gets its own contact effect |
| Camera Shake | 50ms, 0.001 intensity (on confirmed hit) |

See [constants.md § Melee Visual Constants](constants.md#melee-visual-constants) and [graphics.md § Melee Swing Motion](graphics.md#melee-swing-motion).

> **Readability over realism:** Swing timing, trail thickness, and contact silhouettes may be slightly exaggerated if needed to keep melee legible in crowded multiplayer combat.

---

### Client Event Handler

The local attacker sees an immediate preview swing on input, while the room still relies on `melee:hit` for the server-confirmed swing and contact confirmation.

**TypeScript Implementation:**
```typescript
// Local attacker preview on click
const didAttack = shootingManager.meleeAttack();
if (didAttack) {
    meleeWeaponManager.startLocalPreview(localPlayerId, aimAngle);
}

// Server-confirmed room event
const meleeHitHandler = (data: unknown) => {
    const messageData = data as MeleeHitData;

    // Get attacker position for animation origin
    const attackerPos = this.playerManager.getPlayerPosition(messageData.attackerId);
    if (!attackerPos) return;

    // Get attacker's aim angle
    const aimAngle = this.playerManager.getPlayerAimAngle(messageData.attackerId);
    if (aimAngle === null) return;

    // Update weapon position and trigger / continue the confirmed swing
    this.meleeWeaponManager.updatePosition(messageData.attackerId, attackerPos);
    this.meleeWeaponManager.startConfirmedSwing(messageData.attackerId, aimAngle);

    // Show per-victim contact effects at victim contact points
    for (const victimId of messageData.victims) {
        const victimPos = this.playerManager.getPlayerPosition(victimId);
        if (!victimPos || !this.hitEffectManager) continue;

        this.hitEffectManager.showMeleeContact(
            currentWeaponType,
            victimPos.x,
            victimPos.y,
            aimAngle
        );
    }
};

this.wsClient.on('melee:hit', meleeHitHandler);
```

While either swing phase is active, the visual must keep following the attacker's current weapon origin as the player moves. The swing is a weapon-following motion accent, not a static decal left behind at the original click point.

**Why hybrid local-preview + server-confirmed room event:**
- **Responsiveness**: The attacker gets immediate swing motion on click
- **Consistency**: Everyone else still sees only the server-confirmed swing
- **Authority**: Damage, contact effects, HUD hit confirmation, and stat changes remain server-confirmed
- **Safe rejection behavior**: If the server later rejects the swing, the local preview remains a harmless feint with no contact effect, no stat change, and no remote visibility

---

## Error Handling

### Invalid Melee Attack Attempts

**Trigger**: Client sends `player:melee_attack` with invalid conditions.

| Condition | Detection | Response | Recovery |
|-----------|-----------|----------|----------|
| Player not found | `GetPlayer` returns null | Return `no_player` | Log and ignore |
| Player is dead | `!player.IsAlive()` | Return `player_dead` | Wait for respawn |
| No weapon state | `weaponStates[id] == nil` | Return `no_weapon` | Log warning |
| Non-melee weapon | `!weapon.IsMelee()` | Return `not_melee` | Switch to melee weapon |

**Server Logging:**
```go
if !result.Success {
    log.Printf("Melee attack failed for player %s: %s", playerID, result.Reason)
    return
}
```

### Barrier-Blocked Swing

**Trigger**: A valid melee swing reaches blocking geometry before any reachable victim, or the swing origin is already obstructed by nearby blocking geometry
**Detection**: Range/arc checks succeed, but authoritative occlusion resolution finds a blocking barrier first
**Response**:
- the swing still executes and consumes its normal cooldown
- no victim damage, hit confirmation, or victim effects occur
- blocked-impact feedback may be shown at the barrier contact point
**Recovery**: Reposition and swing again

### Knockback Edge Cases

| Case | Handling | Reason |
|------|----------|--------|
| Players at same position | Skip knockback | Avoid divide-by-zero |
| Target at arena edge | Clamp to bounds | Prevent out-of-bounds |
| Knockback path crosses blocking geometry | Stop at first blocking contact | Preserve walls as hard stops |
| Multiple targets near edge | Each clamped independently | Fair positioning |

---

## Implementation Notes

### TypeScript (Client)

**MeleeWeaponManager Pattern:**
```typescript
class MeleeWeaponManager {
    private weapons: Map<string, MeleeWeapon> = new Map();

    createWeapon(playerId: string, weaponType: string, position: Position): void {
        // Remove existing weapon if switching
        if (this.weapons.has(playerId)) {
            this.removeWeapon(playerId);
        }

        // Only create for melee weapons
        const normalized = weaponType.toLowerCase();
        if (normalized !== 'bat' && normalized !== 'katana') {
            return;
        }

        const weapon = new MeleeWeapon(this.scene, position.x, position.y, weaponType);
        this.weapons.set(playerId, weapon);
    }

    startSwing(playerId: string, aimAngle: number): boolean {
        const weapon = this.weapons.get(playerId);
        return weapon ? weapon.startSwing(aimAngle) : false;
    }

    update(): void {
        for (const weapon of this.weapons.values()) {
            weapon.update();
        }
    }
}
```

**Key patterns:**
- Manager tracks per-player weapon visuals
- Automatic cleanup when player switches to ranged
- `update()` called every frame for animation progress

### Go (Server)

**Thread Safety:**
- `PlayerState` methods (`GetPosition`, `SetPosition`, `TakeDamage`) are mutex-protected
- `weaponStates` map accessed with `weaponMu` RWMutex
- `world.players` map accessed directly under `world.mu.RLock()` to get mutable `*PlayerState` pointers

**Attack Flow:**
```go
// Message processor routes to handler
case "player:melee_attack":
    h.handlePlayerMeleeAttack(playerID, data)

// Handler validates and executes
func (h *WebSocketHandler) handlePlayerMeleeAttack(playerID string, data any) {
    // Schema validation
    if err := h.validator.Validate("player-melee-attack-data", data); err != nil {
        log.Printf("Schema validation failed: %v", err)
        return
    }

    dataMap := data.(map[string]interface{})
    aimAngle := dataMap["aimAngle"].(float64)

    result := h.gameServer.PlayerMeleeAttack(playerID, aimAngle)

    if !result.Success {
        log.Printf("Melee attack failed: %s", result.Reason)
        return
    }

    // Broadcast to room
    victimIDs := make([]string, len(result.HitPlayers))
    for i, victim := range result.HitPlayers {
        victimIDs[i] = victim.ID
    }
    h.broadcastMeleeHit(playerID, victimIDs, result.KnockbackApplied)

    // Process damage for each victim
    for _, victim := range result.HitPlayers {
        // Damage events, death handling, etc.
    }
}
```

---

## Test Scenarios

### TS-MELEE-001: Bat Hits Single Target

**Category**: Unit
**Priority**: Critical

**Preconditions:**
- Attacker at position (100, 100) aiming right (0°)
- Target at position (150, 100) - within 90px range, within 80° arc
- Attacker has Bat equipped

**Input:**
- Call `PerformMeleeAttack(attacker, [target], bat)`

**Expected Output:**
- `HitPlayers` contains 1 player
- Target health reduced from 100 to 75 (25 damage)
- `KnockbackApplied` is true

**Go Test:**
```go
func TestPerformMeleeAttack_BatHitsSingleTarget(t *testing.T) {
    bat := NewBat()
    attacker := createTestPlayer("attacker", 100, 100, 0)
    target := createTestPlayer("target", 150, 100, 0)

    result := PerformMeleeAttack(attacker, []*PlayerState{attacker, target}, bat)

    if len(result.HitPlayers) != 1 {
        t.Errorf("Expected 1 hit, got %d", len(result.HitPlayers))
    }
    if target.Health != 75 {
        t.Errorf("Expected health 75, got %d", target.Health)
    }
    if !result.KnockbackApplied {
        t.Error("Expected knockback to be applied")
    }
}
```

---

### TS-MELEE-002: Katana Hits Single Target

**Category**: Unit
**Priority**: Critical

**Preconditions:**
- Attacker at (100, 100), target at (175, 100) - within 110px range
- Attacker has Katana equipped

**Expected Output:**
- Target health reduced from 100 to 55 (45 damage)
- `KnockbackApplied` is false

---

### TS-MELEE-003: Target Out of Range

**Category**: Unit
**Priority**: High

**Preconditions:**
- Bat equipped (90px range)
- Target at 150px distance (beyond range)

**Expected Output:**
- `HitPlayers` is empty
- Target health unchanged at 100

---

### TS-MELEE-004: Target Outside Arc

**Category**: Unit
**Priority**: High

**Preconditions:**
- Attacker aiming right (0°)
- Target directly behind (180° from aim direction)
- Target within range distance

**Expected Output:**
- `HitPlayers` is empty
- Target health unchanged

---

### TS-MELEE-005: Multiple Targets in Arc

**Category**: Unit
**Priority**: Critical

**Preconditions:**
- Bat equipped
- 3 targets within range and arc

**Expected Output:**
- All 3 targets hit
- All 3 reduced to 75 health
- `KnockbackApplied` is true

---

### TS-MELEE-006: Bat Applies 40px Knockback

**Category**: Unit
**Priority**: High

**Preconditions:**
- Attacker at (100, 100), target at (150, 100)
- Bat equipped

**Expected Output:**
- After attack, target position is (190, 100)
- Moved 40px in direction away from attacker

---

### TS-MELEE-007: Knockback Respects Arena Bounds

**Category**: Unit
**Priority**: High

**Preconditions:**
- Target near right edge at (ArenaWidth - 10, 100)
- Knockback would push beyond boundary

**Expected Output:**
- Target clamped to ArenaWidth
- No out-of-bounds position

---

### TS-MELEE-008: Skip Dead Players

**Category**: Unit
**Priority**: High

**Preconditions:**
- Target has 0 health (dead)
- Target within range and arc

**Expected Output:**
- `HitPlayers` is empty
- Dead player not damaged further

---

### TS-MELEE-009: Cannot Hit Self

**Category**: Unit
**Priority**: Medium

**Preconditions:**
- Only attacker in player list

**Expected Output:**
- `HitPlayers` is empty
- Attacker health unchanged

---

### TS-MELEE-010: Target at Arc Edge (40°)

**Category**: Unit
**Priority**: Medium

**Preconditions:**
- 80° arc = 40° on each side
- Target at exactly 40° from aim direction

**Expected Output:**
- Target is hit (boundary inclusive)

---

### TS-MELEE-011: Target Just Outside Arc (45°)

**Category**: Unit
**Priority**: Medium

**Preconditions:**
- 80° arc = 40° on each side
- Target at 45° from aim direction

**Expected Output:**
- Target is NOT hit

---

### TS-MELEE-012: melee:hit Broadcast Includes All Victims

**Category**: Integration
**Priority**: High

**Preconditions:**
- 3 targets hit by single swing

**Expected Output:**
- `melee:hit` message sent to room
- `victims` array contains all 3 player IDs

---

### TS-MELEE-013: Weapon-following swing trail renders correctly

**Category**: Visual
**Priority**: High

**Preconditions:**
- Player performs melee attack with any melee weapon

**Expected Output:**
- Swing trail follows the animated weapon path rather than a player-centered radius
- The attack does not render a literal cone / AoE overlay
- Bat trail reads heavier and wider than Katana trail
- Katana trail reads thinner and faster than Bat trail

---

### TS-MELEE-014: Non-Melee Weapon Returns Empty Result

**Category**: Unit
**Priority**: Medium

**Preconditions:**
- Attacker has Pistol equipped
- Call `PerformMeleeAttack` with Pistol

**Expected Output:**
- `HitPlayers` is empty
- No damage applied

---

### TS-MELEE-015: Swing motion includes anticipation, readable follow-through, and overlap protection

**Category**: Visual
**Priority**: High

**Preconditions:**
- Player swings a melee weapon

**Expected Output:**
- Swing includes a subtle anticipation before release
- Weapon motion is readable from the held weapon model even if the trail is faint
- Local preview and server-confirmed swing use the same visual family
- Overlap protection prevents stacked unreadable swings
- Camera shakes on melee hit (50ms, 0.001 intensity)

### TS-MELEE-016: melee cannot damage through blocking geometry

**Category**: Integration
**Priority**: Critical

**Preconditions:**
- Attacker and target are within melee range and arc
- A visible blocking wall lies between them

**Expected Output:**
- Target takes no damage
- Swing still executes
- Barrier remains authoritative hard stop for melee reachability

### TS-MELEE-017: bat knockback stops at first wall contact

**Category**: Integration
**Priority**: Critical

**Preconditions:**
- Bat hit is valid
- Knockback path from victim intersects blocking geometry before the full 40px displacement

**Expected Output:**
- Victim stops at the first blocking contact
- Victim is not moved through the wall
- No surprise sideways slide occurs

### TS-MELEE-018: blocked swing still consumes cooldown

**Category**: Integration
**Priority**: High

**Preconditions:**
- Attacker performs a melee swing into blocking geometry
- No reachable victim is available

**Expected Output:**
- Swing cooldown still applies
- Repeated wall probing is not free
- No victim damage occurs

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.2.3 | 2026-04-23 | Clarified swing readability: the melee trail must stay attached to the held weapon pivot/tip path and must not render as an oversized player-centered reach arc that floats ahead of the weapon. |
| 1.2.2 | 2026-04-22 | Merged the melee presentation and wall-occlusion updates: swings use weapon-following motion with per-victim contact effects, while authoritative hit validation still requires strict boundary-inclusive line of sight and stops bat knockback at the first blocking contact. |
| 1.2.1 | 2026-04-21 | Clarified strict line-of-sight requirements for melee wall blocking: (1) target's center point must have unobstructed path or attack fails immediately, (2) majority of hitbox points (5/9) must be reachable including center + at least 4 of 8 edge/corner points, (3) segment geometry from attacker center to target points, (4) boundary-inclusive intersection (touching wall = blocked), (5) first-contact resolution for multiple obstacles, (6) short-circuit at majority for efficiency. |
| 1.2.0 | 2026-04-17 | Reframed melee presentation around weapon-following swing motion instead of a visible AoE arc. Added hybrid local-preview/server-confirmed swing behavior, per-victim weapon-specific contact effects, whiff-vs-hit visual grammar, wall-blocked melee validation, barrier-stopped bat knockback, and blocked-swing cooldown consumption. |
| 1.0.0 | 2026-02-02 | Initial specification |
| 1.0.1 | 2026-02-16 | Fixed thread safety note — `world.players` accessed directly under `world.mu.RLock()`, not via `GetAllPlayers()` |
| 1.1.0 | 2026-02-16 | Updated Bat range (64→90px), Katana range (80→110px), melee arc (90°→80°). Replaced pie-slice arc with white stroke-only arc. Added weapon container rotation tween. Removed per-weapon color table. Added TS-MELEE-015. Ported from pre-BMM prototype. |
