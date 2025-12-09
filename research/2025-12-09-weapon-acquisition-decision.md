---
date: 2025-12-09T16:30:00-08:00
author: implementation-agent
topic: "Weapon Acquisition System Design Decision"
tags: [design-decision, weapon-system, epic-3, story-3.3A]
status: complete
readyq_issue: a58bb26d
---

# Design Decision: Weapon Acquisition System

**Date**: 2025-12-09
**Author**: implementation-agent
**ReadyQ Issue**: a58bb26d (Story 3.3A - Define Weapon Acquisition System)
**Related Documents**:
- docs/weapon-balance-analysis.md (Section 10, Question 2)
- research/2025-12-09-weapon-acquisition-system.md

## Executive Summary

**Decision**: **Option B - Fixed Weapon Crates (Arena Shooter Style)**

The weapon acquisition system will use fixed spawn locations (3-5 per map) where specific weapons spawn. Players automatically pick up weapons by moving within 32px radius. Weapons respawn 30 seconds after pickup. This creates strategic map control objectives and skill-based gameplay without RNG frustration.

**Impact**:
- GDD Section "Weapon Pickup System" updated with complete specification
- Epic 3, Story 3.1 acceptance criteria updated to align with auto-pickup design
- Technical requirements fully defined for implementation

## Options Evaluated

### Option A: Random Floor Spawns (Battle Royale Style)

**Description**: Weapons spawn randomly across map at match start. Players find weapons by exploring.

**Pros**:
- Exploration gameplay
- Variety each match

**Cons**:
- High RNG variance (bad spawn = unfair disadvantage)
- Weapon balance critical (weak weapon = punishment)
- Frustrating for competitive play
- No strategic depth (luck-based)
- Doesn't match Stick Rumble's arena shooter identity

**Balance Implications**: From weapon-balance-analysis.md Section 10:
> "Option A: Weapon balance critical (bad weapons = bad RNG)"

**Decision**: ❌ REJECTED - Creates unfair RNG experiences

---

### Option B: Fixed Weapon Crates (Arena Shooter Style)

**Description**: 3-5 fixed locations on map, each spawns specific weapon type. 30-second respawn after pickup.

**Pros**:
- Strategic map control objective (fight for best weapons)
- Predictable, skill-based gameplay (learn spawn locations)
- No RNG frustration (everyone knows where weapons are)
- Classic arena shooter design (Quake, Halo, Stick Arena)
- Aligns with GDD philosophy: "Controlling weapon spawn points = strategic map control"
- Supports competitive play (predictability enables strategy)

**Cons**:
- Less variety between matches (same spawns every game)
- Players memorize locations (reduces exploration)

**Balance Implications**: From weapon-balance-analysis.md Section 10:
> "Recommendation: Option B (Fixed Weapon Crates) for MVP - predictable, balanced, competitive"

**Industry precedent**:
- Quake series: 15-30s weapon respawn timers
- Halo series: 20-60s weapon respawn timers
- Stick Arena: Fixed weapon spawn locations

**Alignment with GDD**:
- GDD already states: "Weapons spawn at fixed locations on map every 15-30 seconds"
- GDD philosophy: "Controlling weapon spawn points = strategic map control"

**Decision**: ✅ SELECTED - Best fit for competitive arena shooter

---

### Option C: Loadout Selection (Tactical Shooter Style)

**Description**: Players choose weapon before match starts. Everyone spawns with chosen weapon.

**Pros**:
- Player agency (choose preferred weapon)
- No weapon control objectives needed

**Cons**:
- Everyone picks AK47 (stats show it's dominant weapon)
- Eliminates weapon diversity (no reason to use other weapons)
- Removes tactical decision-making during match
- No map control objectives (weapons available at spawn)
- Boring meta (everyone uses same weapon)

**Balance Implications**: From weapon-balance-analysis.md Section 10:
> "Option C: Players will always pick AK47 (need forced variety)"

**Decision**: ❌ REJECTED - Eliminates weapon diversity and map control gameplay

---

### Option D: Kill Rewards (Progression System)

**Description**: Players start with Pistol. Earn better weapons by getting kills.

**Pros**:
- Progression feeling within match
- Rewards skilled players

**Cons**:
- Snowball effect (rich get richer)
- Punishes weaker players (fall behind, can't catch up)
- Discourages competitive balance
- Losing players have no comeback mechanic
- Doesn't match GDD's fair gameplay philosophy

**Balance Implications**: From weapon-balance-analysis.md Section 10:
> "Option D: Could create snowball effect (rich get richer)"

**Decision**: ❌ REJECTED - Creates unfair snowball mechanics

## Final Decision Rationale

**Option B (Fixed Weapon Crates)** selected because:

1. **Aligns with GDD philosophy**: "Controlling weapon spawn points = strategic map control" already documented
2. **Genre conventions**: Classic arena shooter design (Quake, Halo, Stick Arena)
3. **Research recommendation**: weapon-balance-analysis.md Section 10 explicitly recommends Option B
4. **Competitive fairness**: Predictable spawns enable skill-based gameplay (no RNG)
5. **Strategic depth**: Map control becomes core mechanic (fight for best weapons)
6. **Technical simplicity**: Well-understood pattern, existing implementations to reference
7. **Balance flexibility**: Weapon balance important but not critical (players choose when to pick up)

## Specification Details

### Core Mechanics

- **Fixed spawn locations**: 5 predetermined positions per map
- **Auto-pickup on contact**: Players automatically pick up when within 32px radius (no key press)
- **Instant weapon switch**: Picked-up weapon immediately replaces current weapon
- **30-second respawn timer**: After pickup, crate inactive for 30 seconds
- **Default spawn weapon**: All players spawn with Pistol
- **No weapon drops**: Current weapon destroyed on pickup (MVP simplicity)
- **No inventory**: Players carry one weapon at a time

### Weapon Spawn Configuration (Default Arena - 1920x1080)

| Spawn ID | Position (x, y) | Weapon Type | Strategic Location |
|----------|-----------------|-------------|-------------------|
| crate_1  | (960, 200)      | Uzi         | Top center (high-traffic area) |
| crate_2  | (400, 540)      | AK47        | Left middle (power position) |
| crate_3  | (1520, 540)     | Shotgun     | Right middle (close-quarters zone) |
| crate_4  | (960, 880)      | Katana      | Bottom center (melee control point) |
| crate_5  | (200, 200)      | Bat         | Top-left corner (flanking route) |

**Strategic positioning rationale**:
- Power weapons (AK47, Shotgun) in middle areas (contested zones)
- Melee weapons (Bat, Katana) at edges/corners (flanking routes)
- Uzi at top center (high-traffic, balanced position)
- Symmetric-ish layout (left/right balance)
- 100px+ margin from arena edges for playability

### Network Protocol

**Client → Server (Pickup Attempt)**:
```json
{
  "type": "weapon:pickup_attempt",
  "timestamp": 1234567890,
  "data": {
    "crateId": "crate_1"
  }
}
```

**Server → All Clients (Pickup Confirmed)**:
```json
{
  "type": "weapon:pickup_confirmed",
  "timestamp": 1234567890,
  "data": {
    "playerId": "player_123",
    "crateId": "crate_1",
    "weaponType": "uzi",
    "nextRespawn": 1234597890
  }
}
```

**Server → All Clients (Weapon Respawned)**:
```json
{
  "type": "weapon:respawned",
  "timestamp": 1234597890,
  "data": {
    "crateId": "crate_1",
    "weaponType": "uzi",
    "position": { "x": 960, "y": 200 }
  }
}
```

**Server → Client (Initial State Sync on Join)**:
```json
{
  "type": "weapon:spawned",
  "timestamp": 1234567890,
  "data": {
    "crates": [
      {
        "id": "crate_1",
        "weaponType": "uzi",
        "position": { "x": 960, "y": 200 },
        "isAvailable": true
      },
      {
        "id": "crate_2",
        "weaponType": "ak47",
        "position": { "x": 400, "y": 540 },
        "isAvailable": false,
        "nextRespawn": 1234567900
      }
      // ... remaining crates
    ]
  }
}
```

### Visual Feedback Requirements

**Available Crate**:
- Weapon sprite rendered at spawn position
- Pulsing glow effect (color-coded by weapon type)
- Minimap indicator showing weapon type

**Unavailable Crate**:
- Empty crate platform visual
- Countdown timer overlay (optional for MVP)
- Minimap indicator grayed out

**Respawning Crate**:
- Fade-in animation when becoming available
- Glow effect pulse intensifies
- Minimap indicator changes to active state

## Technical Implementation Requirements

### Server-Side (Go)

**Data Structures**:
```go
type WeaponCrate struct {
    ID          string
    Position    Vector2
    WeaponType  string    // "uzi", "ak47", "shotgun", "katana", "bat"
    IsAvailable bool
    RespawnTime time.Time
}

type WeaponSpawn struct {
    Position   Vector2
    WeaponType string
}

var DefaultArenaWeaponSpawns = []WeaponSpawn{
    {Position: Vector2{X: 960, Y: 200}, WeaponType: "uzi"},
    {Position: Vector2{X: 400, Y: 540}, WeaponType: "ak47"},
    {Position: Vector2{X: 1520, Y: 540}, WeaponType: "shotgun"},
    {Position: Vector2{X: 960, Y: 880}, WeaponType: "katana"},
    {Position: Vector2{X: 200, Y: 200}, WeaponType: "bat"},
}
```

**Required Functions**:
1. `InitializeWeaponCrates()` - Create crates from spawn config
2. `CheckPlayerCrateCollision(player, crate)` - Distance check (32px radius)
3. `HandleWeaponPickup(playerID, crateID)` - Validate and process pickup
4. `StartCrateRespawnTimer(crateID)` - 30-second timer
5. `RespawnWeaponCrate(crateID)` - Make crate available again
6. `BroadcastWeaponPickup(pickup details)` - Send to all players
7. `BroadcastWeaponRespawn(crateID)` - Send to all players

**Files to Modify**:
- `internal/game/weapon.go` - Add crate structs
- `internal/game/world.go` - Add crate initialization
- `internal/game/physics.go` - Add collision detection
- `internal/game/gameserver.go` - Add pickup tick logic
- `internal/network/message_processor.go` - Add pickup handlers
- `internal/game/constants.go` - Add spawn configurations

### Client-Side (TypeScript)

**Data Structures**:
```typescript
interface WeaponCrate {
  id: string;
  weaponType: string;
  position: { x: number; y: number };
  isAvailable: boolean;
  nextRespawn?: number; // Unix timestamp
}

interface WeaponCrateVisual {
  sprite: Phaser.GameObjects.Sprite;
  glow: Phaser.GameObjects.Graphics;
  crateData: WeaponCrate;
}
```

**Required Components**:
1. `WeaponCrateManager` class
   - `createCrate(crateData)` - Initialize visual
   - `updateCrate(crateId, state)` - Update visual state
   - `checkProximity(playerPos)` - Check player near crates
   - `handlePickupAttempt(crateId)` - Send to server
   - `handlePickupConfirmed(data)` - Update visuals
   - `handleCrateRespawn(data)` - Restore visual

2. Visual rendering
   - Weapon sprite (placeholder for MVP)
   - Glow effect (circle with stroke, pulsing tween)
   - Countdown timer (text overlay)

3. Network handlers
   - `onWeaponSpawned()` - Initial state sync
   - `onWeaponPickupConfirmed()` - Update crate state
   - `onWeaponRespawned()` - Restore crate

**Files to Create/Modify**:
- `src/game/entities/WeaponCrateManager.ts` - NEW
- `src/game/scenes/GameScene.ts` - Add crate manager
- `src/game/network/WebSocketClient.ts` - Add message handlers
- `src/shared/constants.ts` - Add weapon crate constants

### Collision Detection Pattern

**Reuse existing AABB system**:
```go
func (p *Physics) CheckPlayerCrateCollision(player *PlayerState, crate *WeaponCrate) bool {
    if !crate.IsAvailable {
        return false
    }

    playerPos := player.GetPosition()

    // Check if player center within pickup radius
    dx := crate.Position.X - playerPos.X
    dy := crate.Position.Y - playerPos.Y
    distance := math.Sqrt(dx*dx + dy*dy)

    return distance < PickupRadius // 32px default
}
```

**Client-side proximity check**:
```typescript
checkProximity(playerPos: { x: number; y: number }): string | null {
  for (const [crateId, visual] of this.crates) {
    if (!visual.crateData.isAvailable) continue;

    const dx = visual.crateData.position.x - playerPos.x;
    const dy = visual.crateData.position.y - playerPos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < 32) {
      return crateId; // Trigger pickup
    }
  }
  return null;
}
```

## Documentation Updates

### GDD Section "Weapon Pickup System" (docs/GDD.md lines 268-311)

**Changes**:
- Expanded from 4 bullets to comprehensive specification
- Added spawn configuration table with 5 locations
- Documented strategic design rationale
- Added visual feedback requirements
- Added server-authoritative implementation notes
- Clarified auto-pickup mechanics
- Documented no weapon drops policy

### Epic 3, Story 3.1 (docs/epics.md lines 745-784)

**Changes**:
- Updated acceptance criteria: Manual pickup → Auto-pickup
- Removed "Press E" requirement
- Added auto-trigger on contact
- Updated network message protocol (weapon:pickup_attempt, etc.)
- Added fixed spawn point coordinates
- Defined visual state requirements (available/unavailable/respawning)
- Added complete data structure specifications

## Quality Assurance

**Story 3.1 Implementation Readiness**:
- ✅ Acceptance criteria unambiguous
- ✅ Technical specifications complete
- ✅ Network protocol fully defined
- ✅ Spawn locations specified (5 fixed positions)
- ✅ Visual requirements clear
- ✅ Server-client architecture defined
- ✅ Collision detection pattern specified
- ✅ Data structures documented
- ✅ Message flow defined

**Design Decision Validation**:
- ✅ Aligns with weapon-balance-analysis.md recommendation
- ✅ Aligns with GDD existing philosophy
- ✅ Genre conventions followed (arena shooter)
- ✅ Balance implications considered
- ✅ Technical feasibility confirmed (uses existing patterns)
- ✅ Competitive gameplay supported (no RNG)

## Implementation Effort Estimate

**From research document** (research/2025-12-09-weapon-acquisition-system.md):
- Server: ~400 LOC (WeaponCrate, pickup logic, respawn system)
- Client: ~300 LOC (WeaponCrateManager, visual rendering)
- Testing: ~500 LOC (unit tests, integration tests)
- Total: ~1200 LOC for complete implementation

**Complexity**: Medium (relies on existing patterns, no novel algorithms)

**Risk**: Low (well-understood game mechanic, strong architectural foundation)

**Estimated Delivery**: 1-2 days for experienced developer following TDD

## References

1. **docs/weapon-balance-analysis.md** (Section 10, Question 2)
   - Analysis of acquisition options A/B/C/D
   - Recommendation for Option B
   - Balance implications

2. **research/2025-12-09-weapon-acquisition-system.md**
   - Codebase analysis
   - Existing systems review
   - Implementation patterns
   - Code references

3. **docs/GDD.md** (Section "Weapon Pickup System")
   - Updated with complete specification
   - Spawn configuration table
   - Strategic design rationale

4. **docs/epics.md** (Epic 3, Story 3.1)
   - Updated acceptance criteria
   - Technical specifications
   - Network protocol definition

## Approval Status

**Status**: ✅ APPROVED FOR IMPLEMENTATION

**Approved By**: Story 3.3A completion (ReadyQ issue a58bb26d)

**Date**: 2025-12-09

**Next Steps**:
1. Story 3.3A marked as done (unblocks Story 3.1)
2. Story 3.1 implementation can proceed with full specifications
3. Developer follows TDD workflow with >90% coverage requirement
4. Implementation validates against updated acceptance criteria
