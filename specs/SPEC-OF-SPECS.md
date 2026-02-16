# Spec-of-Specs: Stick Rumble Documentation Blueprint

> **Version**: 1.0.0
> **Purpose**: This document defines the structure, content requirements, and templates for all specification files in `specs/`.
> **Target Audience**: AI agents recreating Stick Rumble from scratch with zero existing code.

---

## Table of Contents

1. [Document Conventions](#document-conventions)
2. [Spec Template](#spec-template)
3. [File Specifications](#file-specifications)
   - [README.md](#readmemd)
   - [overview.md](#overviewmd)
   - [constants.md](#constantsmd)
   - [messages.md](#messagesmd)
   - [arena.md](#arenamd)
   - [player.md](#playermd)
   - [movement.md](#movementmd)
   - [dodge-roll.md](#dodge-rollmd)
   - [weapons.md](#weaponsmd)
   - [shooting.md](#shootingmd)
   - [melee.md](#meleemd)
   - [hit-detection.md](#hit-detectionmd)
   - [match.md](#matchmd)
   - [rooms.md](#roomsmd)
   - [networking.md](#networkingmd)
   - [client-architecture.md](#client-architecturemd)
   - [server-architecture.md](#server-architecturemd)
   - [audio.md](#audiomd)
   - [graphics.md](#graphicsmd)
   - [ui.md](#uimd)
   - [test-index.md](#test-indexmd)
4. [Cross-Reference Conventions](#cross-reference-conventions)
5. [Versioning Policy](#versioning-policy)

---

## Document Conventions

### Formatting Standards

- **All specs use Markdown** with GitHub-flavored extensions
- **Headers**: Use `#` for title, `##` for major sections, `###` for subsections
- **Code blocks**: Use triple backticks with language identifier
- **Tables**: Use for structured data (constants, message fields, weapon stats)
- **Math formulas**: Use inline code for simple formulas, LaTeX-style for complex

### Required Sections (Per Spec)

Every system spec MUST include these sections in order:

```markdown
# {System Name}

> **Spec Version**: 1.0.0
> **Depends On**: [list of spec dependencies]
> **Depended By**: [list of specs that depend on this]

## Overview
Brief description of the system's purpose and responsibilities.

## Dependencies
### Technology Dependencies
Exact versions of libraries/frameworks required.

### Spec Dependencies
Links to other specs this system requires.

## Data Structures
All types, interfaces, structs with full field definitions.

## Behavior
Detailed description of how the system works.

## Error Handling
Every possible error case and how it's handled.

## Implementation Notes
### TypeScript (Client)
Language-specific implementation guidance.

### Go (Server)
Language-specific implementation guidance.

## Test Scenarios
Exhaustive test cases with inputs and expected outputs.
```

### Code Example Format

Each behavioral section should include:

1. **Pseudocode** (language-agnostic algorithm)
2. **TypeScript example** (client implementation)
3. **Go example** (server implementation)

```markdown
### Example: {Behavior Name}

**Pseudocode:**
```
function calculateVelocity(input, currentVelocity, deltaTime):
    targetVelocity = input.direction * SPEED
    return lerp(currentVelocity, targetVelocity, ACCELERATION * deltaTime)
```

**TypeScript:**
```typescript
function calculateVelocity(
  input: InputState,
  currentVelocity: Vector2,
  deltaTime: number
): Vector2 {
  const targetVelocity = input.direction.scale(SPEED);
  return currentVelocity.lerp(targetVelocity, ACCELERATION * deltaTime);
}
```

**Go:**
```go
func CalculateVelocity(input InputState, currentVelocity Vector2, deltaTime float64) Vector2 {
    targetVelocity := input.Direction.Scale(SPEED)
    return currentVelocity.Lerp(targetVelocity, ACCELERATION*deltaTime)
}
```
```

### Test Scenario Format

```markdown
## Test Scenarios

### TS-{SPEC_PREFIX}-{NUMBER}: {Test Name}

**Category**: Unit | Integration | Visual
**Priority**: Critical | High | Medium | Low

**Preconditions:**
- List of required state before test

**Input:**
- Exact input values

**Expected Output:**
- Exact expected results

**Error Cases:**
- What happens if preconditions not met

**Pseudocode:**
```
test "{Test Name}":
    setup: ...
    action: ...
    assert: ...
```

**TypeScript (Vitest):**
```typescript
it('should {behavior}', () => {
  // test implementation
});
```

**Go:**
```go
func TestBehavior(t *testing.T) {
    // test implementation
}
```
```

---

## Spec Template

Use this template when creating new spec files:

```markdown
# {System Name}

> **Spec Version**: 1.0.0
> **Last Updated**: {DATE}
> **Depends On**: [{spec1.md}]({spec1.md}), [{spec2.md}]({spec2.md})
> **Depended By**: [{spec3.md}]({spec3.md})

---

## Overview

{1-3 paragraphs describing what this system does and why it exists}

---

## Dependencies

### Technology Dependencies

| Technology | Version | Purpose |
|------------|---------|---------|
| {name} | {version} | {why needed} |

### Spec Dependencies

- [{Spec Name}]({spec-file.md}) - {what is used from this spec}

---

## Constants

{If this spec has constants, list them here. Also note they exist in [constants.md](constants.md)}

| Constant | Value | Unit | Description |
|----------|-------|------|-------------|
| {NAME} | {value} | {unit} | {description} |

---

## Data Structures

### {StructureName}

{Description of what this structure represents}

**TypeScript:**
```typescript
interface StructureName {
  field1: type;  // description
  field2: type;  // description
}
```

**Go:**
```go
type StructureName struct {
    Field1 Type `json:"field1"` // description
    Field2 Type `json:"field2"` // description
}
```

---

## Behavior

### {Behavior 1}

{Detailed description}

**Pseudocode:**
```
{algorithm}
```

**TypeScript:**
```typescript
{implementation}
```

**Go:**
```go
{implementation}
```

### {Behavior 2}

{Continue pattern...}

---

## Error Handling

### {Error Case 1}

**Trigger**: {What causes this error}
**Detection**: {How the system detects it}
**Response**: {What the system does}
**Client Notification**: {Message sent to client, if any}
**Recovery**: {How to recover, if applicable}

---

## Implementation Notes

### TypeScript (Client)

{Client-specific implementation details, patterns, Phaser integration}

### Go (Server)

{Server-specific implementation details, concurrency, performance}

---

## Test Scenarios

### TS-{PREFIX}-001: {First Test}

{Follow test scenario format from conventions}

### TS-{PREFIX}-002: {Second Test}

{Continue...}

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | {DATE} | Initial specification |
```

---

## File Specifications

### README.md

**Purpose**: Entry point for AI agents. Provides reading order, dependency graph, and quick reference.

**Required Content**:

1. **Project Summary** (1 paragraph)
2. **Spec Version** (1.0.0)
3. **Technology Stack** (exact versions)
   - Go 1.25
   - Node.js LTS
   - Phaser 3.90.0
   - React 19.2.0
   - TypeScript 5.9.3
   - Vite 7.2.4
   - gorilla/websocket v1.5.3
   - Vitest 4.0.13
   - Playwright 1.57.0
4. **Reading Order** (numbered list for sequential implementation)
5. **Dependency Graph** (ASCII or Mermaid diagram showing spec relationships)
6. **Quick Reference Table** (all specs with one-line descriptions)
7. **Implementation Checklist** (checkbox list of all systems)

**Estimated Length**: 200-300 lines

---

### overview.md

**Purpose**: High-level architecture and design philosophy.

**Required Content**:

1. **Game Description**
   - Multiplayer stick figure arena shooter
   - 2-8 players per match
   - Browser-based, zero download
   - 3-7 minute competitive matches

2. **Architecture Pattern**
   - Server-authoritative model
   - Client-side prediction
   - 60Hz server tick, 20Hz client updates
   - WebSocket real-time communication

3. **Dual Application Structure**
   - Frontend: Phaser 3 + React + TypeScript
   - Backend: Go + WebSocket
   - Shared: TypeBox schemas

4. **Anti-Cheat Philosophy**
   - All game state validated server-side
   - Client is untrusted display layer
   - Input validation, rate limiting

5. **Folder Structure**
   - Complete tree with descriptions
   - File naming conventions
   - Module boundaries

**Estimated Length**: 300-400 lines

---

### constants.md

**Purpose**: Single source of truth for all magic numbers.

**Required Content**:

Organized by category with tables:

1. **Arena Constants**
   - WIDTH: 1920 pixels
   - HEIGHT: 1080 pixels

2. **Player Constants**
   - WIDTH: 32 pixels
   - HEIGHT: 64 pixels
   - MAX_HEALTH: 100 HP
   - RESPAWN_DELAY: 3000 ms
   - INVULNERABILITY_DURATION: 2000 ms
   - HEALTH_REGEN_DELAY: 5000 ms
   - HEALTH_REGEN_RATE: 10 HP/s

3. **Movement Constants**
   - SPEED: 200 px/s
   - SPRINT_SPEED: 300 px/s
   - SPRINT_MULTIPLIER: 1.5
   - ACCELERATION: 50 px/s²
   - DECELERATION: 1500 px/s²

4. **Dodge Roll Constants**
   - DURATION: 400 ms
   - DISTANCE: 100 px
   - VELOCITY: 250 px/s
   - COOLDOWN: 3000 ms
   - INVINCIBILITY_DURATION: 200 ms

5. **Network Constants**
   - SERVER_TICK_RATE: 60 Hz
   - CLIENT_UPDATE_RATE: 20 Hz
   - CLIENT_UPDATE_INTERVAL: 50 ms
   - RECONNECT_ATTEMPTS: 3
   - RECONNECT_DELAY: 1000 ms

6. **Weapon Constants**
   - PICKUP_RADIUS: 32 px
   - RESPAWN_TIME: 30000 ms
   - PROJECTILE_MAX_LIFETIME: 1000 ms
   - PROJECTILE_MAX_RANGE: 800 px
   - SPRINT_ACCURACY_PENALTY: 1.5

7. **Match Constants**
   - KILL_TARGET: 20
   - TIME_LIMIT: 420000 ms (7 minutes)
   - TEST_KILL_TARGET: 2
   - TEST_TIME_LIMIT: 10000 ms
   - MAX_PLAYERS_PER_ROOM: 8
   - MIN_PLAYERS_TO_START: 2

8. **Audio Constants**
   - MAX_AUDIO_DISTANCE: 1000 px
   - (additional audio constants)

9. **UI Constants**
   - KILL_FEED_MAX_ENTRIES: 5
   - KILL_FEED_FADE_TIME: 5000 ms
   - HEALTH_BAR_WIDTH: (value)
   - HEALTH_BAR_HEIGHT: (value)

**Estimated Length**: 200-250 lines

---

### messages.md

**Purpose**: Complete WebSocket message catalog.

**Required Content**:

1. **Base Message Format**
   ```typescript
   interface Message {
     type: string;
     timestamp: number;
     data?: unknown;
   }
   ```

2. **Client → Server Messages** (6 types)
   Each message includes:
   - Type string
   - Full data schema with types
   - When sent (trigger condition)
   - Rate limit (if any)
   - Example JSON

   Messages:
   - `input:state`
   - `player:shoot`
   - `player:reload`
   - `weapon:pickup_attempt`
   - `player:melee_attack`
   - `player:dodge_roll`

3. **Server → Client Messages** (22 types)
   Each message includes:
   - Type string
   - Full data schema with types
   - When sent (trigger condition)
   - Who receives (sender, room, all)
   - Example JSON

   Messages:
   - `room:joined`
   - `player:left`
   - `player:move`
   - `projectile:spawn`
   - `projectile:destroy`
   - `weapon:state`
   - `shoot:failed`
   - `player:damaged`
   - `hit:confirmed`
   - `player:death`
   - `player:kill_credit`
   - `player:respawn`
   - `match:timer`
   - `match:ended`
   - `weapon:spawned`
   - `weapon:pickup_confirmed`
   - `weapon:respawned`
   - `melee:hit`
   - `roll:start`
   - `roll:end`
   - `state:snapshot` (Epic 4: full player state for delta compression)
   - `state:delta` (Epic 4: partial player state updates)

4. **Message Flow Diagrams**
   - Connection sequence
   - Shooting sequence
   - Death/respawn sequence
   - Weapon pickup sequence

**Estimated Length**: 600-800 lines

---

### arena.md

**Purpose**: Game world boundaries and spatial rules.

**Required Content**:

1. **Dimensions**
   - Width: 1920 pixels
   - Height: 1080 pixels
   - Origin: Top-left (0, 0)
   - Coordinate system: Y increases downward

2. **Boundary Collision**
   - Hard clipping at edges
   - Player position clamped to valid range
   - Projectiles destroyed at boundaries
   - Dodge roll terminates at boundaries

3. **Spawn Points**
   - Player spawn locations (algorithm or fixed points)
   - Weapon crate spawn locations (5 fixed points with coordinates)

4. **Spatial Queries**
   - Distance calculations
   - Line-of-sight (if applicable)
   - Proximity detection

**Test Scenarios**:
- TS-ARENA-001: Player cannot move beyond left boundary
- TS-ARENA-002: Player cannot move beyond right boundary
- TS-ARENA-003: Player cannot move beyond top boundary
- TS-ARENA-004: Player cannot move beyond bottom boundary
- TS-ARENA-005: Projectile destroyed at boundary
- TS-ARENA-006: Dodge roll terminates at boundary
- TS-ARENA-007: Weapon crates spawn at correct positions

**Estimated Length**: 200-300 lines

---

### player.md

**Purpose**: Player entity state and lifecycle.

**Required Content**:

1. **Player State Structure**
   - ID (UUID)
   - Position (Vector2)
   - Velocity (Vector2)
   - AimAngle (radians)
   - Health (0-100)
   - MaxHealth (100)
   - IsInvulnerable (bool)
   - IsDead (bool)
   - DeathTime (timestamp or null)
   - Kills (int)
   - Deaths (int)
   - XP (int)
   - IsRegeneratingHealth (bool)
   - IsSprinting (bool)
   - IsRolling (bool)
   - CurrentWeapon (WeaponState)

2. **Health System**
   - Starting health: 100
   - Damage application
   - Death trigger (health ≤ 0)
   - Health regeneration (10 HP/s after 5s)

3. **Respawn System**
   - Death state duration: 3 seconds
   - Respawn position selection
   - Invulnerability: 2 seconds post-respawn
   - State reset on respawn

4. **Statistics Tracking**
   - Kill counting
   - Death counting
   - XP calculation (100 per kill)

**Test Scenarios**:
- TS-PLAYER-001: Player takes damage correctly
- TS-PLAYER-002: Player dies at 0 health
- TS-PLAYER-003: Player respawns after 3 seconds
- TS-PLAYER-004: Player is invulnerable for 2 seconds after respawn
- TS-PLAYER-005: Health regeneration starts after 5 seconds
- TS-PLAYER-006: Health regenerates at 10 HP/s
- TS-PLAYER-007: Damage interrupts health regeneration
- TS-PLAYER-008: Kill increments attacker's kill count
- TS-PLAYER-009: Death increments victim's death count
- TS-PLAYER-010: XP awarded on kill (100 XP)
- TS-PLAYER-011: Invulnerable player takes no damage

**Estimated Length**: 400-500 lines

---

### movement.md

**Purpose**: Physics-based movement system.

**Required Content**:

1. **Input State**
   - up (bool) - W key
   - down (bool) - S key
   - left (bool) - A key
   - right (bool) - D key
   - isSprinting (bool) - Shift key
   - aimAngle (radians) - Mouse position

2. **Velocity Calculation**
   - Direction from input (normalized)
   - Speed selection (200 or 300 px/s)
   - Acceleration model (50 px/s²)
   - Deceleration model (1500 px/s²)

3. **Position Update**
   - velocity * deltaTime
   - Boundary clamping

4. **Sprint Mechanics**
   - Speed multiplier: 1.5x
   - Accuracy penalty: 1.5x spread
   - No stamina limit

5. **Formulas**
   ```
   targetSpeed = isSprinting ? 300 : 200
   targetVelocity = normalize(inputDirection) * targetSpeed

   if inputDirection != zero:
       velocity = lerp(velocity, targetVelocity, acceleration * deltaTime)
   else:
       velocity = lerp(velocity, zero, deceleration * deltaTime)

   position = position + velocity * deltaTime
   position = clamp(position, arenaMin, arenaMax)
   ```

**Test Scenarios**:
- TS-MOVE-001: Player accelerates to target velocity
- TS-MOVE-002: Player decelerates when no input
- TS-MOVE-003: Sprint increases speed to 300 px/s
- TS-MOVE-004: Diagonal movement is normalized
- TS-MOVE-005: Position updates by velocity * deltaTime
- TS-MOVE-006: Position clamped to arena bounds
- TS-MOVE-007: Sprint applies accuracy penalty

**Estimated Length**: 350-450 lines

---

### dodge-roll.md

**Purpose**: Dodge roll evasion mechanic.

**Required Content**:

1. **Roll Parameters**
   - Duration: 400 ms
   - Distance: 100 px
   - Velocity: 250 px/s
   - Cooldown: 3000 ms
   - Invincibility window: 0-200 ms

2. **Roll Direction**
   - Determined by last movement input
   - If no input, use facing direction
   - Normalized to unit vector

3. **Roll State Machine**
   ```
   States: READY → ROLLING → COOLDOWN → READY

   READY:
       on dodge_roll_input:
           if canRoll: transition to ROLLING

   ROLLING:
       velocity = rollDirection * 250
       invincible = (elapsedTime < 200ms)
       on wall_collision: transition to COOLDOWN
       on duration_complete (400ms): transition to COOLDOWN

   COOLDOWN:
       on cooldown_complete (3000ms): transition to READY
   ```

4. **Collision Handling**
   - Wall collision terminates roll early
   - Position snapped to valid boundary
   - Cooldown still applies

5. **Server Messages**
   - `roll:start` - Sent when roll begins
   - `roll:end` - Sent when roll ends (with reason)

**Test Scenarios**:
- TS-ROLL-001: Roll moves player 100px over 400ms
- TS-ROLL-002: Player is invincible for first 200ms
- TS-ROLL-003: Player is vulnerable after 200ms
- TS-ROLL-004: Cooldown prevents roll for 3 seconds
- TS-ROLL-005: Wall collision ends roll early
- TS-ROLL-006: Roll direction matches last input
- TS-ROLL-007: roll:start message sent to all clients
- TS-ROLL-008: roll:end message includes reason
- TS-ROLL-009: Cannot roll while already rolling
- TS-ROLL-010: Cannot roll during cooldown

**Estimated Length**: 350-400 lines

---

### weapons.md

**Purpose**: Complete weapon definitions and switching.

**Required Content**:

1. **Weapon Categories**
   - Ranged: Pistol, Uzi, AK47, Shotgun
   - Melee: Bat, Katana

2. **Weapon Configuration Schema**
   ```typescript
   interface WeaponConfig {
     name: string;
     type: 'ranged' | 'melee';
     damage: number;
     fireRate: number;          // shots per second
     magazineSize: number;      // ammo capacity
     reloadTime: number;        // milliseconds
     projectileSpeed?: number;  // px/s (ranged only)
     spread?: number;           // degrees (ranged only)
     recoil?: RecoilConfig;     // (ranged only)
     range?: number;            // px (melee only)
     arc?: number;              // degrees (melee only)
     knockback?: number;        // px (melee only)
     pelletCount?: number;      // (shotgun only)
     visualConfig: VisualConfig;
   }
   ```

3. **Weapon Stats Table**

   | Weapon | Damage | Fire Rate | Magazine | Reload | Speed | Spread | Special |
   |--------|--------|-----------|----------|--------|-------|--------|---------|
   | Pistol | 25 | 3/s | 15 | 1500ms | 800 | 0° | Default weapon |
   | Uzi | 8 | 10/s | 30 | 1500ms | 800 | 5° | Vertical recoil |
   | AK47 | 20 | 6/s | 30 | 2000ms | 800 | 3° | Mixed recoil |
   | Shotgun | 60 | 1/s | 6 | 2500ms | 800 | 15° | 8 pellets |
   | Bat | 25 | 2/s | ∞ | N/A | N/A | 90° arc | 40px knockback |
   | Katana | 45 | 1.25/s | ∞ | N/A | N/A | 90° arc | 80px range |

4. **Recoil Configuration**
   - Vertical recoil (accumulates per shot)
   - Horizontal recoil (random per shot)
   - Recovery time
   - Movement spread penalty

5. **Weapon Switching**
   - Default weapon: Pistol
   - Pickup replaces current weapon
   - Ammo resets on pickup

6. **Weapon Spawn Locations**
   | Position | Weapon | Coordinates |
   |----------|--------|-------------|
   | Center top | Uzi | (960, 200) |
   | Left mid | AK47 | (300, 540) |
   | Right mid | Shotgun | (1620, 540) |
   | Bottom center | Katana | (960, 900) |
   | Top left | Bat | (200, 200) |

7. **Visual Configurations**
   - Muzzle flash (color, size, duration)
   - Projectile (color, diameter)
   - Tracer (color, width)

**Test Scenarios**:
- TS-WEAP-001: Pistol fires at 3 shots/second
- TS-WEAP-002: Uzi applies vertical recoil
- TS-WEAP-003: AK47 applies mixed recoil
- TS-WEAP-004: Shotgun fires 8 pellets in arc
- TS-WEAP-005: Bat applies 40px knockback
- TS-WEAP-006: Katana has 80px range
- TS-WEAP-007: Weapon pickup replaces current weapon
- TS-WEAP-008: Ammo resets on weapon pickup
- TS-WEAP-009: Weapon crates spawn at correct locations
- TS-WEAP-010: Each weapon has correct damage value

**Estimated Length**: 500-600 lines

---

### shooting.md

**Purpose**: Ranged attack mechanics.

**Required Content**:

1. **Shoot Request Flow**
   ```
   Client: player:shoot { aimAngle }
   Server validates:
       - Player exists and is alive
       - Not currently reloading
       - Ammo > 0
       - Cooldown expired
   If valid:
       - Create projectile
       - Decrement ammo
       - Reset cooldown
       - Broadcast projectile:spawn
       - Send weapon:state
   If invalid:
       - Send shoot:failed { reason }
   ```

2. **Fire Rate Enforcement**
   - Cooldown = 1000 / fireRate milliseconds
   - Server tracks lastShotTime per player
   - Client can show local cooldown UI

3. **Projectile Creation**
   - ID: UUID
   - Position: Player position + offset
   - Velocity: (cos(angle), sin(angle)) * speed
   - Apply spread (random within ± spread/2)
   - Apply recoil (accumulated + per-shot)

4. **Recoil System**
   ```
   verticalRecoil += weapon.recoil.vertical
   horizontalRecoil = random(-weapon.recoil.horizontal, +weapon.recoil.horizontal)
   finalAngle = aimAngle + verticalRecoil + horizontalRecoil

   // Recovery over time
   verticalRecoil = lerp(verticalRecoil, 0, recoveryRate * deltaTime)
   ```

5. **Spread Calculation**
   ```
   baseSpread = weapon.spread
   if isSprinting:
       baseSpread *= 1.5
   if isMoving:
       baseSpread += movementSpreadPenalty

   spreadAngle = random(-baseSpread/2, +baseSpread/2)
   ```

6. **Ammo & Reload**
   - Ammo decrements on each shot
   - Empty magazine: shoot:failed { reason: "empty" }
   - Reload request: player:reload
   - Reload duration: weapon.reloadTime
   - Auto-reload option (client preference)

7. **Shoot Failure Reasons**
   - `cooldown` - Fire rate not met
   - `empty` - No ammo in magazine
   - `reloading` - Currently reloading
   - `no_player` - Player not found
   - `dead` - Player is dead

**Test Scenarios**:
- TS-SHOOT-001: Successful shot creates projectile
- TS-SHOOT-002: Shot decrements ammo
- TS-SHOOT-003: Empty magazine returns shoot:failed
- TS-SHOOT-004: Cooldown enforced between shots
- TS-SHOOT-005: Reloading blocks shooting
- TS-SHOOT-006: Dead player cannot shoot
- TS-SHOOT-007: Spread applied to projectile angle
- TS-SHOOT-008: Recoil accumulates on rapid fire
- TS-SHOOT-009: Recoil recovers over time
- TS-SHOOT-010: Sprint increases spread by 1.5x
- TS-SHOOT-011: Reload restores full ammo
- TS-SHOOT-012: Reload takes correct duration

**Estimated Length**: 450-550 lines

---

### melee.md

**Purpose**: Melee attack mechanics.

**Required Content**:

1. **Melee Attack Flow**
   ```
   Client: player:melee_attack { aimAngle }
   Server validates:
       - Player exists and is alive
       - Weapon is melee type
       - Cooldown expired
   If valid:
       - Find all players in range AND arc
       - Apply damage to each
       - Apply knockback (if weapon has it)
       - Broadcast melee:hit
   If invalid:
       - Send shoot:failed { reason }
   ```

2. **Range Check**
   ```
   distance = |targetPosition - attackerPosition|
   inRange = distance <= weapon.range
   ```

3. **Arc Check**
   ```
   angleToTarget = atan2(target.y - attacker.y, target.x - attacker.x)
   angleDiff = normalizeAngle(angleToTarget - aimAngle)
   halfArc = weapon.arc / 2
   inArc = abs(angleDiff) <= halfArc
   ```

4. **Hit Detection**
   ```
   for each player in room:
       if player != attacker AND !player.isDead AND !player.isInvulnerable:
           if inRange(player) AND inArc(player):
               hits.add(player)
   ```

5. **Knockback Application**
   ```
   if weapon.knockback > 0:
       knockbackDirection = normalize(target.position - attacker.position)
       target.position += knockbackDirection * weapon.knockback
       clamp(target.position, arenaMin, arenaMax)
   ```

6. **Multi-Hit**
   - Single swing can hit multiple players
   - Each player hit receives full damage
   - Each player hit receives knockback (if applicable)

**Test Scenarios**:
- TS-MELEE-001: Bat hits player within 64px range
- TS-MELEE-002: Katana hits player within 80px range
- TS-MELEE-003: Player outside range is not hit
- TS-MELEE-004: Player outside arc is not hit
- TS-MELEE-005: Bat applies 40px knockback
- TS-MELEE-006: Katana applies no knockback
- TS-MELEE-007: Multiple players hit in single swing
- TS-MELEE-008: Dead players not hit
- TS-MELEE-009: Invulnerable players not damaged
- TS-MELEE-010: Cooldown enforced between swings
- TS-MELEE-011: Knockback respects arena boundaries
- TS-MELEE-012: melee:hit message lists all victims

**Estimated Length**: 350-400 lines

---

### hit-detection.md

**Purpose**: Collision detection and damage application.

**Required Content**:

1. **Projectile Collision**
   ```
   for each projectile:
       for each player:
           if player.id != projectile.ownerId AND !player.isDead AND !player.isInvulnerable:
               if circleRectCollision(projectile, player):
                   applyDamage(player, projectile.damage, projectile.ownerId)
                   destroyProjectile(projectile)
                   break
   ```

2. **Collision Geometry**
   - Projectile: Circle (radius = 4px)
   - Player: Rectangle (32x64 px)
   - Collision: Circle-rectangle intersection

3. **Circle-Rectangle Collision**
   ```
   function circleRectCollision(circle, rect):
       closestX = clamp(circle.x, rect.left, rect.right)
       closestY = clamp(circle.y, rect.top, rect.bottom)
       distanceX = circle.x - closestX
       distanceY = circle.y - closestY
       distanceSquared = distanceX² + distanceY²
       return distanceSquared < circle.radius²
   ```

4. **Damage Application**
   ```
   function applyDamage(victim, damage, attackerId):
       victim.health -= damage
       victim.isRegeneratingHealth = false
       victim.lastDamageTime = now()

       broadcast player:damaged { victimId, attackerId, damage, newHealth }
       send hit:confirmed to attacker

       if victim.health <= 0:
           triggerDeath(victim, attackerId)
   ```

5. **Death Trigger**
   ```
   function triggerDeath(victim, attackerId):
       victim.isDead = true
       victim.deathTime = now()
       victim.deaths++

       attacker = getPlayer(attackerId)
       attacker.kills++
       attacker.xp += 100

       broadcast player:death { victimId, attackerId }
       send player:kill_credit to attacker
       scheduleRespawn(victim, 3000ms)
   ```

6. **Projectile Expiration**
   - Max lifetime: 1000ms
   - Max range: 800px from spawn
   - Destroyed on arena boundary

7. **Invulnerability Check**
   - Skip damage if player.isInvulnerable
   - Invulnerable during first 200ms of dodge roll
   - Invulnerable for 2000ms after respawn

**Test Scenarios**:
- TS-HIT-001: Projectile collides with player hitbox
- TS-HIT-002: Projectile passes through owner
- TS-HIT-003: Damage reduces health correctly
- TS-HIT-004: Player dies at 0 health
- TS-HIT-005: Death increments attacker kills
- TS-HIT-006: Death awards 100 XP
- TS-HIT-007: player:damaged sent to all clients
- TS-HIT-008: hit:confirmed sent to attacker only
- TS-HIT-009: Invulnerable player not damaged
- TS-HIT-010: Projectile destroyed after 1000ms
- TS-HIT-011: Projectile destroyed at 800px range
- TS-HIT-012: Projectile destroyed at arena boundary
- TS-HIT-013: Dead player not damaged
- TS-HIT-014: Dodge roll invincibility blocks damage

**Estimated Length**: 450-500 lines

---

### match.md

**Purpose**: Match lifecycle and win conditions.

**Required Content**:

1. **Match States**
   ```
   States: WAITING → ACTIVE → ENDED

   WAITING:
       - Less than 2 players
       - No timer running
       - on player_count >= 2: transition to ACTIVE

   ACTIVE:
       - Timer counting down
       - Kills being tracked
       - on kill_target_reached: transition to ENDED
       - on time_expired: transition to ENDED

   ENDED:
       - Winners determined
       - Final scores broadcast
       - No more gameplay
   ```

2. **Win Conditions**
   - Kill Target: First player to reach kill count wins
   - Time Limit: Highest kills when timer expires wins
   - Tie: Multiple winners possible

3. **Configuration**
   | Mode | Kill Target | Time Limit |
   |------|-------------|------------|
   | Normal | 20 | 420s (7 min) |
   | Test | 2 | 10s |

4. **Timer System**
   - Starts when match becomes ACTIVE
   - Broadcasts match:timer every second
   - remainingSeconds decrements

5. **Score Tracking**
   - Per-player: kills, deaths, xp
   - All players included in final scores (even 0 kills)

6. **Match End**
   ```
   function endMatch(reason):
       state = ENDED
       winners = calculateWinners()
       finalScores = getAllPlayerScores()
       broadcast match:ended { winners, finalScores, reason }

   function calculateWinners():
       maxKills = max(player.kills for player in room)
       return [player.id for player in room if player.kills == maxKills]
   ```

7. **Environment Variable**
   - TEST_MODE=true enables test configuration

**Test Scenarios**:
- TS-MATCH-001: Match starts when 2 players join
- TS-MATCH-002: Timer counts down from 420 seconds
- TS-MATCH-003: match:timer sent every second
- TS-MATCH-004: Match ends when player reaches 20 kills
- TS-MATCH-005: Match ends when timer reaches 0
- TS-MATCH-006: Highest kills wins on time limit
- TS-MATCH-007: Tie results in multiple winners
- TS-MATCH-008: match:ended includes all player scores
- TS-MATCH-009: match:ended reason is "kill_target" or "time_limit"
- TS-MATCH-010: TEST_MODE uses 2 kills and 10 seconds
- TS-MATCH-011: Players with 0 kills included in final scores

**Estimated Length**: 350-400 lines

---

### rooms.md

**Purpose**: Room management and matchmaking.

**Required Content**:

1. **Room Structure**
   ```go
   type Room struct {
       ID        string
       Players   map[string]*Player
       Match     *Match
       World     *World
       CreatedAt time.Time
   }
   ```

2. **Room Capacity**
   - Minimum: 2 players
   - Maximum: 8 players

3. **RoomManager**
   ```
   - waitingPlayers: queue of unmatched players
   - rooms: map of active rooms
   - playerToRoom: player ID → room ID mapping

   on player_connect:
       add to waitingPlayers
       if len(waitingPlayers) >= 2:
           createRoom(waitingPlayers.pop(2))

   on player_disconnect:
       remove from room
       if room.empty:
           destroyRoom(room)
   ```

4. **Room Creation**
   ```
   function createRoom(players):
       room = new Room(uuid())
       for player in players:
           room.addPlayer(player)
           playerToRoom[player.id] = room.id
       rooms[room.id] = room
       room.startMatch()
       for player in players:
           send room:joined { playerId } to player
   ```

5. **Player Removal**
   ```
   function removePlayer(playerId):
       room = playerToRoom[playerId]
       room.removePlayer(playerId)
       delete playerToRoom[playerId]
       broadcast player:left { playerId } to room
       if room.playerCount == 0:
           delete rooms[room.id]
   ```

6. **Broadcasting**
   - Messages sent to room go to all players in that room
   - Each player has a SendChan for async delivery
   - Closed connections are cleaned up

**Test Scenarios**:
- TS-ROOM-001: Room created when 2 players waiting
- TS-ROOM-002: Room accepts up to 8 players
- TS-ROOM-003: Room rejects 9th player
- TS-ROOM-004: room:joined sent to both players
- TS-ROOM-005: player:left sent when player disconnects
- TS-ROOM-006: Empty room is destroyed
- TS-ROOM-007: Player mapped to correct room
- TS-ROOM-008: Broadcast reaches all room members
- TS-ROOM-009: Disconnected player removed from room
- TS-ROOM-010: New players matched to waiting queue

**Estimated Length**: 300-350 lines

---

### networking.md

**Purpose**: WebSocket protocol and connection lifecycle.

**Required Content**:

1. **Connection Establishment**
   ```
   Client:
       ws = new WebSocket("ws://server:8080/ws")
       on open: ready to send/receive
       on close: attempt reconnect
       on error: log and handle

   Server:
       HTTP upgrade to WebSocket
       Generate player ID (UUID)
       Add to waiting queue or room
       Start read/write goroutines
   ```

2. **Message Format**
   ```typescript
   interface Message {
     type: string;      // Message type identifier
     timestamp: number; // Unix milliseconds
     data?: unknown;    // Optional payload
   }
   ```

3. **Message Serialization**
   - JSON encoding/decoding
   - UTF-8 text frames
   - No binary frames

4. **Connection Lifecycle**
   ```
   CONNECTING → OPEN → CLOSING → CLOSED

   CONNECTING:
       - WebSocket handshake in progress

   OPEN:
       - Bidirectional communication active
       - Heartbeat/ping-pong (if implemented)

   CLOSING:
       - Graceful shutdown initiated
       - Cleanup in progress

   CLOSED:
       - Connection terminated
       - Resources released
   ```

5. **Reconnection Logic (Client)**
   - Max attempts: 3
   - Delay between attempts: 1000ms
   - On max attempts exceeded: show error UI

6. **Server Shutdown**
   - SIGTERM/SIGINT handling
   - 30 second graceful shutdown timeout
   - Close all client connections
   - Save state if needed

7. **Error Handling**
   - Malformed JSON: log and ignore
   - Unknown message type: log and ignore
   - Connection timeout: close and cleanup

8. **Rate Limiting**
   - Input state: 20 Hz max (50ms minimum interval)
   - Shoot requests: weapon fire rate dependent

**Test Scenarios**:
- TS-NET-001: WebSocket connection established
- TS-NET-002: Message serialized as JSON
- TS-NET-003: Malformed JSON ignored
- TS-NET-004: Unknown message type ignored
- TS-NET-005: Client reconnects on disconnect
- TS-NET-006: Max 3 reconnect attempts
- TS-NET-007: Server graceful shutdown
- TS-NET-008: Player removed on disconnect
- TS-NET-009: Input rate limited to 20 Hz
- TS-NET-010: Bidirectional communication works

**Estimated Length**: 400-450 lines

---

### client-architecture.md

**Purpose**: Frontend structure and rendering pipeline.

**Required Content**:

1. **Technology Stack**
   - Phaser 3.90.0 (game engine)
   - React 19.2.0 (UI framework)
   - TypeScript 5.9.3
   - Vite 7.2.4 (build tool)
   - Vitest 4.0.13 (testing)

2. **Application Structure**
   ```
   src/
   ├── game/
   │   ├── config/          # Phaser configuration
   │   ├── entities/        # Game entities and managers
   │   ├── input/           # Input handling
   │   ├── network/         # WebSocket client
   │   ├── scenes/          # Phaser scenes
   │   ├── audio/           # Audio system
   │   └── effects/         # Visual effects
   ├── shared/              # Constants and types
   └── ui/                  # React components
   ```

3. **Scene Lifecycle**
   ```
   GameScene:
       preload(): load assets (if any)
       create(): initialize managers, connect WebSocket
       update(time, delta): process input, update entities
       destroy(): cleanup resources, disconnect
   ```

4. **Manager Classes**
   - InputManager: Keyboard/mouse polling, input state
   - ShootingManager: Fire requests, cooldown tracking
   - DodgeRollManager: Roll state, cooldown progress
   - PlayerManager: Player rendering, position updates
   - ProjectileManager: Projectile lifecycle, pooling
   - WeaponCrateManager: Crate rendering, availability
   - MeleeWeaponManager: Swing animations
   - HitEffectManager: Particle effects, object pool

5. **Rendering Pipeline**
   ```
   Each frame (60 FPS):
       1. Poll input state
       2. Send input to server (if 50ms elapsed)
       3. Process server messages
       4. Update entity positions (interpolation)
       5. Render all entities
       6. Update UI elements
   ```

6. **React-Phaser Bridge**
   - PhaserGame component hosts canvas
   - React UI overlays game canvas
   - Communication via events/callbacks

7. **Asset Loading**
   - Procedural graphics (no sprite assets)
   - Audio files loaded on demand
   - No preloading required

**Test Scenarios**:
- TS-CLIENT-001: GameScene creates all managers
- TS-CLIENT-002: Input polled every frame
- TS-CLIENT-003: Input sent at 20 Hz
- TS-CLIENT-004: Server messages processed
- TS-CLIENT-005: Entities render correctly
- TS-CLIENT-006: Scene cleanup releases resources
- TS-CLIENT-007: WebSocket connected on create
- TS-CLIENT-008: WebSocket disconnected on destroy

**Estimated Length**: 450-500 lines

---

### server-architecture.md

**Purpose**: Backend structure and game loop.

**Required Content**:

1. **Technology Stack**
   - Go 1.25
   - gorilla/websocket v1.5.3
   - Standard library (net/http, sync, time)

2. **Application Structure**
   ```
   stick-rumble-server/
   ├── cmd/
   │   └── server/          # Entry point
   └── internal/
       ├── auth/            # Authentication (future)
       ├── db/              # Database (future)
       ├── game/            # Game logic
       └── network/         # WebSocket handling
   ```

3. **Game Loop**
   ```
   GameServer runs two goroutines:

   Ticker (60 Hz):
       for each tick:
           process input for all players
           update physics (positions, velocities)
           update projectiles
           check collisions
           apply damage
           check match conditions

   Broadcaster (20 Hz):
       for each broadcast:
           collect all player states
           send player:move to all clients
           send any queued events
   ```

4. **Concurrency Model**
   - RWMutex for shared state (World, Players)
   - Channels for message passing
   - Goroutine per connection (read + write)

5. **Message Processing**
   ```
   WebSocketHandler:
       on message received:
           parse JSON
           validate message type
           route to appropriate handler
           (optionally) validate against schema

   MessageProcessor:
       input:state → update player input
       player:shoot → process shoot request
       player:reload → start reload
       weapon:pickup_attempt → process pickup
       player:melee_attack → process melee
       player:dodge_roll → start roll
   ```

6. **Broadcast Patterns**
   - Room broadcast: send to all players in room
   - Single player: send to specific player only
   - Exclude sender: send to all except originator

7. **Graceful Shutdown**
   ```
   on SIGTERM/SIGINT:
       stop accepting new connections
       notify all clients
       wait up to 30 seconds for cleanup
       close all connections
       exit
   ```

**Test Scenarios**:
- TS-SERVER-001: Game loop runs at 60 Hz
- TS-SERVER-002: Broadcast runs at 20 Hz
- TS-SERVER-003: Physics updates each tick
- TS-SERVER-004: Collisions detected each tick
- TS-SERVER-005: Messages routed to correct handler
- TS-SERVER-006: Concurrent access is thread-safe
- TS-SERVER-007: Graceful shutdown completes
- TS-SERVER-008: Client messages processed

**Estimated Length**: 400-450 lines

---

### audio.md

**Purpose**: Sound effects and audio system.

**Required Content**:

1. **Audio Manager**
   - Global volume control
   - Mute toggle
   - Positional audio support

2. **Sound Effects**

   | Sound | Trigger | Waveform | Duration | Frequency | Notes |
   |-------|---------|----------|----------|-----------|-------|
   | Pistol fire | player:shoot (pistol) | Sharp attack | 100ms | 800-1200 Hz | Single pop |
   | Uzi fire | player:shoot (uzi) | Rapid bursts | 50ms | 600-1000 Hz | Automatic rhythm |
   | AK47 fire | player:shoot (ak47) | Heavy thump | 80ms | 400-800 Hz | Deeper than pistol |
   | Shotgun fire | player:shoot (shotgun) | Wide boom | 150ms | 200-600 Hz | Spread sound |
   | Bat swing | melee:hit (bat) | Whoosh | 200ms | 300-500 Hz | Wind sound |
   | Katana swing | melee:hit (katana) | Sharp slice | 150ms | 500-800 Hz | Metallic ring |
   | Dodge roll | roll:start | Whoosh | 400ms | 200-400 Hz | Movement sound |
   | Hit impact | player:damaged | Thud | 100ms | 300-500 Hz | Body impact |
   | Death | player:death | Heavy thud | 300ms | 100-300 Hz | Final sound |
   | Reload | weapon:state (reloading) | Click-clack | weapon.reloadTime | Mechanical | Weapon-specific |
   | Pickup | weapon:pickup_confirmed | Chime | 200ms | 800-1200 Hz | Positive feedback |

3. **Positional Audio**
   ```
   function calculateVolume(listenerPos, sourcePos):
       distance = |sourcePos - listenerPos|
       if distance > MAX_AUDIO_DISTANCE (1000px):
           return 0
       return 1 - (distance / MAX_AUDIO_DISTANCE)
   ```

4. **Audio Playback Rules**
   - Local player actions: full volume
   - Other player actions: positional volume
   - UI sounds: full volume, no position

5. **Implementation**
   - Web Audio API for generation
   - Phaser Sound Manager for playback
   - Pregenerated audio buffers preferred

**Test Scenarios**:
- TS-AUDIO-001: Weapon fire plays correct sound
- TS-AUDIO-002: Volume decreases with distance
- TS-AUDIO-003: Sound silent beyond 1000px
- TS-AUDIO-004: Mute toggle silences all sounds
- TS-AUDIO-005: Local player sounds at full volume
- TS-AUDIO-006: Reload sound matches weapon

**Estimated Length**: 300-350 lines

---

### graphics.md

**Purpose**: Procedural rendering specifications.

**Required Content**:

1. **Player Rendering (Stick Figure)**
   ```
   Components:
       Head: Circle
           - Radius: 8px
           - Color: Player color (assigned)
           - Position: (0, -24) relative to center

       Body: Line
           - Start: (0, -16)
           - End: (0, 16)
           - Width: 3px
           - Color: Player color

       Left Arm: Line
           - Start: (0, -8)
           - End: (-12, 4) (adjusted by animation)
           - Width: 2px

       Right Arm: Line
           - Start: (0, -8)
           - End: (12, 4) (adjusted by animation + weapon)
           - Width: 2px

       Left Leg: Line
           - Start: (0, 16)
           - End: (-8, 32) (adjusted by walk animation)
           - Width: 2px

       Right Leg: Line
           - Start: (0, 16)
           - End: (8, 32) (adjusted by walk animation)
           - Width: 2px
   ```

2. **Walk Animation**
   ```
   Leg oscillation using sine wave:
       cycleTime = time * walkSpeed
       leftLegAngle = sin(cycleTime) * maxAngle
       rightLegAngle = sin(cycleTime + PI) * maxAngle

   Parameters:
       - walkSpeed: proportional to velocity magnitude
       - maxAngle: 30 degrees
   ```

3. **Player Colors**
   | Index | Color | Hex |
   |-------|-------|-----|
   | 0 | Red | #FF0000 |
   | 1 | Blue | #0000FF |
   | 2 | Green | #00FF00 |
   | 3 | Yellow | #FFFF00 |
   | 4 | Cyan | #00FFFF |
   | 5 | Magenta | #FF00FF |
   | 6 | Orange | #FFA500 |
   | 7 | Purple | #800080 |

4. **Rotation**
   - Entire figure rotates around center
   - Rotation = aimAngle
   - Head always faces aim direction

5. **Health Bar**
   ```
   Position: Above player head
       - Offset: (0, -40) from player center
       - Width: 40px
       - Height: 6px

   Background:
       - Color: #333333 (dark gray)
       - Full width

   Foreground:
       - Color: gradient from #00FF00 (100%) to #FF0000 (0%)
       - Width: (health / maxHealth) * 40px

   Border:
       - Color: #000000 (black)
       - Width: 1px
   ```

6. **Aim Indicator**
   ```
   Line from player center toward aim direction:
       - Start: Player center
       - End: center + (cos(aimAngle), sin(aimAngle)) * 50px
       - Color: #FFFFFF (white)
       - Width: 1px
       - Alpha: 0.5
   ```

7. **Projectile Rendering**
   ```
   Circle:
       - Radius: 4px
       - Color: Weapon-specific (see weapons.md)

   Tracer:
       - Line from current position to (position - velocity * 0.05)
       - Width: 2px
       - Color: Weapon-specific tracer color
       - Alpha: 0.7
   ```

8. **Muzzle Flash**
   ```
   On shoot:
       - Position: Player weapon tip
       - Shape: Small circle burst
       - Color: Weapon-specific
       - Duration: 50ms
       - Size: 8-12px radius
   ```

9. **Weapon Crate Rendering**
   ```
   Box:
       - Size: 32x32 px
       - Color: #8B4513 (brown)
       - Border: 2px #000000

   Weapon Icon:
       - Centered in box
       - Simplified weapon silhouette
       - Color: #FFFFFF

   Unavailable State:
       - Alpha: 0.3
       - Grayed out
   ```

10. **Hit Effects**
    ```
    On player:damaged:
        - Spawn 5-10 particles
        - Color: #FF0000 (red)
        - Size: 2-4px
        - Velocity: Random outward burst
        - Duration: 300ms
        - Fade out over duration
    ```

11. **Death Effect**
    ```
    On player:death:
        - Player figure fades out (500ms)
        - Spawn larger particle burst (10-15 particles)
        - Screen shake (if local player killed)
    ```

12. **Dodge Roll Visual**
    ```
    During roll:
        - Player figure blur/stretch in roll direction
        - Afterimage trail (3-4 ghost images)
        - Alpha: Decreasing from 0.7 to 0.2
    ```

**Test Scenarios**:
- TS-GFX-001: Player renders with all body parts
- TS-GFX-002: Walk animation oscillates legs
- TS-GFX-003: Player color matches assigned index
- TS-GFX-004: Health bar width reflects health percentage
- TS-GFX-005: Aim indicator points at mouse
- TS-GFX-006: Projectile has tracer trail
- TS-GFX-007: Muzzle flash appears on shoot
- TS-GFX-008: Weapon crate renders with icon
- TS-GFX-009: Unavailable crate is grayed out
- TS-GFX-010: Hit particles spawn on damage
- TS-GFX-011: Player fades on death
- TS-GFX-012: Dodge roll shows afterimages

**Estimated Length**: 500-600 lines

---

### ui.md

**Purpose**: HUD and interface elements.

**Required Content**:

1. **HUD Layout**
   ```
   ┌─────────────────────────────────────────────┐
   │ [Health Bar]                    [Kill Feed] │
   │                                             │
   │                                             │
   │                                             │
   │                                             │
   │ [Weapon/Ammo]        [Timer]    [Score]     │
   └─────────────────────────────────────────────┘
   ```

2. **Health Bar UI (Top Left)**
   ```
   Position: (20, 20)
   Size: 200px x 20px

   Background: #333333
   Fill: Gradient #00FF00 → #FF0000
   Border: 2px #000000

   Text: "HP: {current}/{max}"
       - Font: 14px monospace
       - Color: #FFFFFF
       - Position: Centered in bar
   ```

3. **Kill Feed (Top Right)**
   ```
   Position: (screen.width - 300, 20)
   Max Entries: 5
   Entry Height: 24px

   Entry Format: "{killer} killed {victim}"
       - Killer name: Killer's color
       - "killed": #FFFFFF
       - Victim name: Victim's color

   Fade: 5 seconds after appearing
   Animation: Slide in from right
   ```

4. **Weapon/Ammo Display (Bottom Left)**
   ```
   Position: (20, screen.height - 60)

   Weapon Name:
       - Font: 18px bold
       - Color: #FFFFFF

   Ammo Counter: "{current} / {max}"
       - Font: 24px monospace
       - Color: #FFFFFF (normal), #FF0000 (low/empty)
       - Low threshold: 20% of max

   Reload Indicator:
       - Text: "RELOADING..."
       - Color: #FFFF00
       - Pulsing animation
   ```

5. **Match Timer (Bottom Center)**
   ```
   Position: (screen.width / 2, screen.height - 40)

   Format: "MM:SS"
       - Font: 32px monospace
       - Color: #FFFFFF (normal), #FF0000 (< 30 seconds)

   Alignment: Center
   ```

6. **Score Display (Bottom Right)**
   ```
   Position: (screen.width - 150, screen.height - 60)

   Format:
       "Kills: {kills}"
       "Deaths: {deaths}"
       "Score: {xp}"

   Font: 16px monospace
   Color: #FFFFFF
   Line Height: 20px
   ```

7. **Weapon Pickup Prompt**
   ```
   Visibility: When near available weapon crate
   Position: Center screen, offset up

   Text: "Press E to pick up {weapon}"
   Font: 20px
   Color: #FFFFFF
   Background: Semi-transparent black (#000000, 0.7 alpha)
   Padding: 10px
   ```

8. **Dodge Roll Cooldown**
   ```
   Position: Near player or fixed UI location

   Available State:
       - Icon: Filled circle or dash symbol
       - Color: #00FF00

   Cooldown State:
       - Circular progress indicator
       - Color: #666666 (background), #00FF00 (progress)
       - Fills clockwise as cooldown progresses
   ```

9. **Match End Screen**
   ```
   Overlay: Full screen, semi-transparent black

   Title: "MATCH ENDED"
       - Font: 48px bold
       - Color: #FFFFFF

   Winner(s): "{player} WINS!" or "TIE!"
       - Font: 36px
       - Color: Winner's player color

   Scoreboard: Table of all players
       - Columns: Rank, Player, Kills, Deaths, Score
       - Sorted by kills descending
       - Highlight winner row

   Continue Button: "Play Again" or "Exit"
   ```

10. **Connection Status**
    ```
    Position: Top center or corner

    Connected:
        - Icon: Green dot
        - Hidden or minimal

    Reconnecting:
        - Text: "Reconnecting... (attempt X/3)"
        - Color: #FFFF00

    Disconnected:
        - Text: "Connection Lost"
        - Color: #FF0000
    ```

**Test Scenarios**:
- TS-UI-001: Health bar reflects current health
- TS-UI-002: Kill feed shows recent kills
- TS-UI-003: Kill feed fades after 5 seconds
- TS-UI-004: Ammo counter updates on shoot
- TS-UI-005: Reload indicator shows during reload
- TS-UI-006: Timer counts down correctly
- TS-UI-007: Timer turns red under 30 seconds
- TS-UI-008: Score updates on kill
- TS-UI-009: Pickup prompt appears near crates
- TS-UI-010: Dodge cooldown shows progress
- TS-UI-011: Match end screen shows winner
- TS-UI-012: Scoreboard sorted correctly

**Estimated Length**: 400-450 lines

---

### test-index.md

**Purpose**: Cross-reference of all test scenarios for quick lookup.

**Required Content**:

1. **Test Scenario Summary Table**
   | ID | Spec | Category | Priority | Description |
   |----|------|----------|----------|-------------|
   | TS-ARENA-001 | arena.md | Unit | High | Player cannot move beyond left boundary |
   | ... | ... | ... | ... | ... |

2. **Tests by Category**
   - Unit Tests
   - Integration Tests
   - Visual Tests

3. **Tests by Priority**
   - Critical (must pass for basic functionality)
   - High (important gameplay features)
   - Medium (quality of life)
   - Low (edge cases)

4. **Tests by Spec**
   - Grouped listing of all tests per spec

5. **Total Counts**
   - Total test scenarios
   - By category
   - By priority

**Estimated Length**: 300-400 lines (depends on total test count)

---

## Cross-Reference Conventions

When referencing other specs, use relative markdown links:

```markdown
See [Player > Health System](player.md#health-system) for health mechanics.
```

Format: `[{Spec Name} > {Section}]({spec-file}.md#{anchor})`

Anchors are auto-generated from headers:
- `## Health System` → `#health-system`
- `### Damage Application` → `#damage-application`

---

## Versioning Policy

1. **Spec Version**: Each spec has its own version in the header
2. **Global Version**: README.md tracks overall spec suite version
3. **Version Format**: Semantic versioning (MAJOR.MINOR.PATCH)
   - MAJOR: Breaking changes to contracts
   - MINOR: New features, backward compatible
   - PATCH: Clarifications, typo fixes
4. **Changelog**: Each spec has a changelog table at the bottom
5. **Synchronization**: When specs are updated, update README.md version

---

## Implementation Order

For an AI agent recreating from scratch, implement in this order:

1. **Foundation**
   - overview.md
   - constants.md
   - arena.md

2. **Core Entities**
   - player.md
   - movement.md

3. **Networking**
   - messages.md
   - networking.md
   - rooms.md

4. **Combat**
   - weapons.md
   - shooting.md
   - hit-detection.md
   - melee.md

5. **Advanced Mechanics**
   - dodge-roll.md
   - match.md

6. **Client Implementation**
   - client-architecture.md
   - graphics.md
   - ui.md
   - audio.md

7. **Server Implementation**
   - server-architecture.md

8. **Verification**
   - test-index.md

---

## Actual Total Length

| Spec | Lines |
|------|-------|
| README.md | 356 |
| overview.md | 708 |
| constants.md | 540 |
| messages.md | 1808 |
| arena.md | 1001 |
| player.md | 966 |
| movement.md | 946 |
| dodge-roll.md | 1142 |
| weapons.md | 1045 |
| shooting.md | 1093 |
| melee.md | 953 |
| hit-detection.md | 1200 |
| match.md | 1335 |
| rooms.md | 871 |
| networking.md | 1146 |
| client-architecture.md | 1786 |
| server-architecture.md | 1329 |
| audio.md | 905 |
| graphics.md | 1073 |
| ui.md | 1243 |
| test-index.md | 645 |
| spec-of-specs-plan.md | 1064 |
| SPEC-OF-SPECS.md | 2074 |
| **TOTAL** | **~25,229 lines** |

---

## Next Steps

After reviewing this spec-of-specs:

1. Approve the structure and content requirements
2. Generate each spec file following this blueprint
3. Review generated specs for accuracy against codebase
4. Iterate on any gaps or corrections

---

*This document serves as the blueprint for complete Stick Rumble specification documentation.*
