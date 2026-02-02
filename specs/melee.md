# Melee Combat

> **Spec Version**: 1.0.0
> **Last Updated**: 2026-02-02
> **Depends On**: [constants.md](constants.md), [player.md](player.md), [weapons.md](weapons.md), [hit-detection.md](hit-detection.md)
> **Depended By**: [messages.md](messages.md), [graphics.md](graphics.md)

---

## Overview

Melee combat provides close-range weapons (Bat and Katana) as alternatives to ranged weapons. Unlike projectile-based attacks, melee attacks instantly hit all targets within a cone-shaped area in front of the attacker, enabling area-of-effect (AoE) damage.

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
- [weapons.md](weapons.md) - Weapon stats (Bat: 64px range, 25 damage; Katana: 80px range, 45 damage)
- [hit-detection.md](hit-detection.md) - Damage application and death triggering

---

## Constants

All melee constants are defined in [constants.md](constants.md#melee-weapon-constants). Key values:

| Constant | Bat | Katana | Description |
|----------|-----|--------|-------------|
| Damage | 25 | 45 | HP removed per hit |
| Range | 64 px | 80 px | Maximum distance to target |
| Arc | 90° | 90° | Cone width (45° each side of aim) |
| Fire Rate | 2/s | 1.25/s | Swings per second |
| Knockback | 40 px | 0 px | Distance target is pushed |
| Cooldown | 500 ms | 800 ms | Time between swings |

**Why these values:**
- **Bat damage (25)**: 4 hits to kill (100 HP / 25 = 4), balanced by fast swing rate
- **Katana damage (45)**: ~2-3 hits to kill, but slower swing rate
- **90° arc**: Wide enough to catch strafing enemies, narrow enough to require aiming
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

    // Get all players and perform attack
    allPlayers := gs.world.GetAllPlayers()
    result := PerformMeleeAttack(player, allPlayers, ws.Weapon)

    return MeleeResult{
        Success:          true,
        HitPlayers:       result.HitPlayers,
        KnockbackApplied: result.KnockbackApplied,
    }
}
```

---

### Hit Detection (Range + Arc Check)

Melee attacks use a cone-shaped hit area defined by range (distance) and arc (angle).

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
    return angleDiff <= halfArc
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
    return angleDiff <= halfArc
}
```

**Why cone detection instead of rectangle/circle:**
- **Intuitive**: Players aim with mouse, cone naturally extends from character
- **Balanced**: Wide enough to catch nearby enemies, requires directional aim
- **Visual match**: Swing animation draws a pie-slice arc that matches hitbox

---

### Multi-Target Hit Detection

A single melee swing can hit multiple players within the cone.

**Pseudocode:**
```
function PerformMeleeAttack(attacker, allPlayers, weapon):
    if weapon == null OR !weapon.IsMelee():
        return { HitPlayers: [], KnockbackApplied: false }

    hitPlayers = []
    knockbackApplied = false

    for target in allPlayers:
        // Skip self
        if target.id == attacker.id:
            continue

        // Skip dead players
        if !target.IsAlive():
            continue

        // Check range and arc
        if isInMeleeRange(attacker, target, weapon):
            hitPlayers.append(target)
            target.TakeDamage(weapon.damage)

            // Apply knockback (Bat only)
            if weapon.knockbackDistance > 0:
                applyKnockback(attacker, target, weapon.knockbackDistance)
                knockbackApplied = true

    return { HitPlayers: hitPlayers, KnockbackApplied: knockbackApplied }
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

The Bat applies 40px knockback to all hit targets, pushing them away from the attacker.

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
    newX = target.x + dirX * knockbackDistance
    newY = target.y + dirY * knockbackDistance

    // Clamp to arena bounds
    newX = clamp(newX, 0, ArenaWidth)
    newY = clamp(newY, 0, ArenaHeight)

    target.SetPosition(newX, newY)
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
    newX := targetPos.X + dirX*knockbackDistance
    newY := targetPos.Y + dirY*knockbackDistance

    // Clamp to arena bounds
    if newX < 0 {
        newX = 0
    }
    if newX > ArenaWidth {
        newX = ArenaWidth
    }
    if newY < 0 {
        newY = 0
    }
    if newY > ArenaHeight {
        newY = ArenaHeight
    }

    target.SetPosition(Vector2{X: newX, Y: newY})
}
```

**Why knockback exists:**
- **Spacing control**: Bat user can create distance after hit
- **Arena positioning**: Push enemies into corners or toward edges
- **Combo prevention**: Prevents infinite melee stunlock chains
- **Differentiation**: Bat = crowd control, Katana = raw damage

**Why Katana has no knockback:**
- Higher base damage (45 vs 25) is the trade-off
- Longer range (80px vs 64px) provides inherent safety
- Design choice: two distinct melee playstyles

---

### Swing Animation (Client)

Client displays a visual arc representing the melee attack cone.

**Animation Parameters:**
| Parameter | Value | Description |
|-----------|-------|-------------|
| Duration | 200 ms | Total animation time |
| Frames | 4 | Animation keyframes |
| Frame Duration | 50 ms | Time per frame |

**TypeScript Implementation:**
```typescript
class MeleeWeapon {
    private static readonly SWING_DURATION = 200;
    private static readonly FRAME_COUNT = 4;

    startSwing(aimAngle: number): boolean {
        if (this.swinging) return false;

        this.swinging = true;
        this.swingStartTime = this.scene.time.now;
        this.swingAimAngle = aimAngle;
        this.graphics.setVisible(true);

        return true;
    }

    showSwingAnimation(aimAngle: number): void {
        this.graphics.clear();

        const arcRadians = (this.stats.arcDegrees * Math.PI) / 180;
        const halfArc = arcRadians / 2;
        const startAngle = aimAngle - halfArc;
        const endAngle = aimAngle + halfArc;

        // Draw arc outline
        this.graphics.lineStyle(3, this.stats.color, 0.8);
        this.graphics.beginPath();
        this.graphics.arc(this.x, this.y, this.stats.range, startAngle, endAngle, false);
        this.graphics.strokePath();

        // Draw semi-transparent fill
        this.graphics.fillStyle(this.stats.color, 0.2);
        this.graphics.beginPath();
        this.graphics.moveTo(this.x, this.y);
        this.graphics.arc(this.x, this.y, this.stats.range, startAngle, endAngle, false);
        this.graphics.closePath();
        this.graphics.fillPath();
    }
}
```

**Weapon Colors:**
| Weapon | Color | Hex | Reason |
|--------|-------|-----|--------|
| Bat | Brown | 0x8B4513 | Wood material |
| Katana | Silver | 0xC0C0C0 | Metal blade |

---

### Client Event Handler

The `melee:hit` message triggers swing animation on all clients.

**TypeScript Implementation:**
```typescript
const meleeHitHandler = (data: unknown) => {
    const messageData = data as MeleeHitData;

    // Get attacker position for animation origin
    const attackerPos = this.playerManager.getPlayerPosition(messageData.attackerId);
    if (!attackerPos) return;

    // Get attacker's aim angle
    const aimAngle = this.playerManager.getPlayerAimAngle(messageData.attackerId);
    if (aimAngle === null) return;

    // Update weapon position and trigger swing
    this.meleeWeaponManager.updatePosition(messageData.attackerId, attackerPos);
    this.meleeWeaponManager.startSwing(messageData.attackerId, aimAngle);

    // Show hit effect in front of attacker
    if (this.hitEffectManager) {
        const effectDistance = 30;
        const effectX = attackerPos.x + Math.cos(aimAngle) * effectDistance;
        const effectY = attackerPos.y + Math.sin(aimAngle) * effectDistance;
        this.hitEffectManager.showMeleeHit(effectX, effectY);
    }
};

this.wsClient.on('melee:hit', meleeHitHandler);
```

**Why animation triggered on `melee:hit` (not locally):**
- **Server-authoritative**: Animation only shows when server confirms attack
- **Consistency**: All clients see same swing at same time
- **Anti-cheat**: Can't fake swings that didn't happen

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

### Knockback Edge Cases

| Case | Handling | Reason |
|------|----------|--------|
| Players at same position | Skip knockback | Avoid divide-by-zero |
| Target at arena edge | Clamp to bounds | Prevent out-of-bounds |
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
- `world.GetAllPlayers()` returns snapshot under read lock

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
- Target at position (150, 100) - within 64px range, within 90° arc
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
- Attacker at (100, 100), target at (175, 100) - within 80px range
- Attacker has Katana equipped

**Expected Output:**
- Target health reduced from 100 to 55 (45 damage)
- `KnockbackApplied` is false

---

### TS-MELEE-003: Target Out of Range

**Category**: Unit
**Priority**: High

**Preconditions:**
- Bat equipped (64px range)
- Target at 100px distance (beyond range)

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

### TS-MELEE-010: Target at Arc Edge (45°)

**Category**: Unit
**Priority**: Medium

**Preconditions:**
- 90° arc = 45° on each side
- Target at exactly 45° from aim direction

**Expected Output:**
- Target is hit (boundary inclusive)

---

### TS-MELEE-011: Target Just Outside Arc (50°)

**Category**: Unit
**Priority**: Medium

**Preconditions:**
- 90° arc = 45° on each side
- Target at 50° from aim direction

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

### TS-MELEE-013: Swing Animation Renders 90° Arc

**Category**: Visual
**Priority**: Medium

**Preconditions:**
- Client receives `melee:hit` message

**Expected Output:**
- Arc drawn from (aimAngle - 45°) to (aimAngle + 45°)
- Arc radius matches weapon range

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

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-02-02 | Initial specification |
