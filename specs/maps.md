# Maps

> **Spec Version**: 1.1.0
> **Last Updated**: 2026-04-09
> **Depends On**: [constants.md](constants.md)
> **Depended By**: [arena.md](arena.md), [rooms.md](rooms.md), [messages.md](messages.md), [weapons.md](weapons.md), [client-architecture.md](client-architecture.md), [server-architecture.md](server-architecture.md)

---

## Overview

The map system defines the gameplay-relevant spatial layout for each playable arena. A map is a shared configuration contract consumed by both server and client. The server treats the selected map as authoritative for movement boundaries, obstacle collision, line-of-sight blocking, spawn selection, and weapon crate placement. The client loads the same map by ID for rendering, minimap generation, and local spatial queries.

**Why this spec exists:**
- Replaces hardcoded arena geometry and spawn layouts with a shared configuration system
- Prevents drift between what the client renders and what the server enforces
- Establishes a schema-first contract for future map additions
- Provides a clean path to recreate the archived office prototype layout in the current `1920x1080` format
- Makes visual readability a first-class map requirement instead of relying on collision correctness alone

---

## Dependencies

### Technology Dependencies

| Technology | Version | Purpose |
|------------|---------|---------|
| JSON | N/A | Map content files |
| TypeScript | 5.9.3 | Schema definitions, client loading |
| Go | 1.25 | Server loading and authoritative enforcement |
| TypeBox / JSON Schema | 0.34.x | Validation and generated schema artifacts |

### Spec Dependencies

- [constants.md](constants.md) - Player dimensions, pickup radius, weapon respawn delay

---

## Source Of Truth

Maps are stored in shared top-level directories:

- `maps/` - JSON map content files
- `maps-schema/` - schema definitions, generated artifacts, and validation helpers

**Why shared top-level ownership?**
- Maps are neither client-owned nor server-owned
- Both runtimes must load the same content by the same `mapId`
- Validation belongs next to the content contract, not buried inside one runtime

---

## Core Rules

1. A map file is the single source of truth for gameplay-relevant spatial data.
2. The selected map defines the world width and height for the match.
3. All authored gameplay entities require stable human-authored IDs.
4. Map files are JSON and must pass schema validation before runtime use.
5. Invalid or missing maps are fatal errors; there is no silent fallback in v1.
6. The client and server both load maps from the local shared registry by `mapId`.
7. Blocking geometry must read as blocking geometry on screen; traversable space must read as traversable space on screen.
8. If a player can perceive a false opening, invisible blocker, or misleading wall edge, the map is invalid even if the raw rectangles are internally consistent.

---

## Data Model

### MapConfig

**TypeScript:**
```typescript
interface MapConfig {
  id: string;
  name: string;
  width: number;
  height: number;
  obstacles: MapObstacle[];
  spawnPoints: MapSpawnPoint[];
  weaponSpawns: MapWeaponSpawn[];
}
```

**Go:**
```go
type MapConfig struct {
    ID           string           `json:"id"`
    Name         string           `json:"name"`
    Width        float64          `json:"width"`
    Height       float64          `json:"height"`
    Obstacles    []MapObstacle    `json:"obstacles"`
    SpawnPoints  []MapSpawnPoint  `json:"spawnPoints"`
    WeaponSpawns []MapWeaponSpawn `json:"weaponSpawns"`
}
```

### MapObstacle

All v1 obstacle geometry uses axis-aligned rectangles authored with top-left coordinates.

```typescript
interface MapObstacle {
  id: string;
  type: 'wall' | 'desk' | 'pillar';
  shape: 'rectangle';
  x: number;
  y: number;
  width: number;
  height: number;
  blocksMovement: boolean;
  blocksProjectiles: boolean;
  blocksLineOfSight: boolean;
}
```

### MapSpawnPoint

```typescript
interface MapSpawnPoint {
  id: string;
  x: number;
  y: number;
}
```

### MapWeaponSpawn

```typescript
interface MapWeaponSpawn {
  id: string;
  x: number;
  y: number;
  weaponType: 'uzi' | 'ak47' | 'shotgun' | 'katana' | 'bat';
}
```

---

## Validation Rules

Validation occurs before a map is admitted to the runtime registry.

### Structural Validation

- `id` must be non-empty and unique within the registry
- `width` and `height` must be positive
- every obstacle, spawn point, and weapon spawn must have a non-empty unique `id`
- v1 obstacles must declare `shape: "rectangle"`
- required gameplay fields should be explicit in JSON

### Spatial Validation

- obstacle rectangles must lie fully inside map bounds
- spawn points must lie inside map bounds
- weapon spawn points must lie inside map bounds
- spawn points must not overlap movement-blocking obstacles
- weapon spawn points must not overlap movement-blocking obstacles
- obstacles may touch edges or corners but may not have positive-area overlap with each other
- intended traversable openings must exceed the player collision width by a safety margin rather than merely matching it
- weapon spawn locations must sit in clearly reachable, readable space rather than cramped near-blocked pockets

### Readability Validation

- any feature that blocks movement, projectiles, or line of sight must be visually aligned with its authoritative geometry closely enough that players never perceive a false gap or hidden blocker
- rendered wall and desk edges must not suggest passability where collision forbids passage
- any opening that is intended to be traversable must read as open at gameplay camera scale
- authored visual composition must support clean wall sliding and corridor readability during combat movement

**Why fail at load time?**
- Spatial mistakes are content authoring errors, not runtime decisions
- The server and client must not "cope differently" with a bad map
- Fast failure keeps debugging local and deterministic

---

## Runtime Behavior

### Registry Loading

Both runtimes construct a cached map registry at startup.

**Rules:**
- load all configured maps once at startup
- validate every map before accepting it into the registry
- fail startup if any required map is missing or invalid
- expose lookup by `mapId`

### Room Assignment

Each room has exactly one selected `mapId`.

**v1 policy:**
- a registry exists immediately
- exactly one default map is assigned to every room
- future map rotation or voting may build on the same contract later

### World Bounds

The selected map defines the authoritative playable rectangle:

```text
X range: 0 to map.width
Y range: 0 to map.height
```

Player boundary clamping and projectile out-of-bounds checks use the selected map dimensions, not global fixed arena size constants.

### Spawn Selection

Maps provide fixed authored spawn points. The server chooses among them at spawn time.

**v1 selection algorithm:**
1. discard any invalid points
2. score remaining points by minimum distance to living enemy players
3. choose the highest-scoring point
4. optionally break ties deterministically or randomly

### Weapon Spawn Ownership

Weapon crate locations belong to the map file, not to separate hardcoded gameplay constants.

**v1 behavior:**
- each weapon spawn entry defines a fixed weapon type
- weapon respawn timing remains governed by global gameplay tuning in [constants.md](constants.md)
- crate availability and respawn state are runtime state layered onto authored spawn locations

### Obstacle Semantics

Obstacle `type` is semantic metadata. In v1, all recreated office-map obstacles block movement, projectiles, and LOS, but the schema keeps those behaviors explicit so future maps can vary them without changing the format.

### Collision And Visual Alignment

Authoritative collision geometry and rendered obstacle art are related but distinct concerns.

- gameplay correctness is determined by authoritative geometry
- player readability is determined by what the camera shows
- the shipped map is only valid when those two layers agree in practice

**Required outcome:** a player must never see a usable-looking lane that is collision-blocked, and must never be surprised by collision where no blocker visually reads.

---

## Default Office Map

The first map in the new system recreates the archived office prototype layout as a real configuration-driven map.

**Required outcome:**
- preserve the recognizable office obstacle vocabulary: boundary walls, interior walls, pillars, and desks
- preserve the prototype's tactical relationships and lane structure
- adapt the geometry intentionally to the current `1920x1080` one-screen format
- do not preserve the archived `1600x1600` dimensions literally
- reproduce the prototype exactly where the reference is known
- only deviate where the prototype reference is unclear or where exact reproduction would violate the readability and collision-alignment rules in this spec

### Visual Acceptance Viewpoints

The office map must define a small set of canonical screenshot viewpoints derived from known failure cases. These viewpoints are part of the contract and are used for automated or agent-assisted visual QA.

The initial viewpoint set must cover:

- a corridor or wall edge where false openings previously appeared
- a known invisible-collision location
- a corner/camera extreme where world entities previously overlapped HUD
- a pickup spawn where low-contrast floor readability previously failed

Each viewpoint must define:

- player world position
- facing/aim direction
- expected readability outcome such as "reads blocked", "reads open", "pickup clearly visible", or "HUD unobscured"

---

## Test Scenarios

### TS-MAP-001: invalid map file fails validation

**Category:** Unit  
**Priority:** Critical

Given a map JSON missing required fields or containing malformed values  
When the registry loads the file  
Then validation fails and the runtime rejects the map

### TS-MAP-002: spawn point inside solid obstacle is rejected

**Category:** Unit  
**Priority:** Critical

Given a map file with a spawn point inside a movement-blocking obstacle  
When validation runs  
Then the map is rejected

### TS-MAP-003: positive-area obstacle overlap is rejected

**Category:** Unit  
**Priority:** High

Given two authored obstacles whose rectangles overlap in area  
When validation runs  
Then the map is rejected

### TS-MAP-004: room announces selected map ID

**Category:** Integration  
**Priority:** Critical

Given a room is created successfully  
When `room:joined` is sent to a player  
Then the payload includes the authoritative `mapId`

### TS-MAP-005: server selects safest authored spawn point

**Category:** Unit  
**Priority:** High

Given multiple valid authored spawn points and living enemy positions  
When the server chooses a respawn location  
Then it selects the highest-scoring safe spawn point

### TS-MAP-006: client and server load same map by ID

**Category:** Integration  
**Priority:** Critical

Given a valid `mapId` assigned to a room  
When the room starts on both runtimes  
Then both client and server resolve the same local map configuration

### TS-MAP-007: blocking geometry never reads as a false opening

**Category:** Visual acceptance  
**Priority:** Critical

Given a canonical office-map viewpoint that previously suggested an open gap  
When the scene is rendered from that viewpoint  
Then the blocking geometry clearly reads as blocked

### TS-MAP-008: intended traversable opening reads as traversable

**Category:** Visual acceptance  
**Priority:** Critical

Given a canonical office-map viewpoint looking at an intended path  
When the scene is rendered from that viewpoint  
Then the opening clearly reads as passable and matches collision behavior

### TS-MAP-009: pickup spawn is clearly reachable and readable

**Category:** Visual acceptance  
**Priority:** High

Given a canonical pickup viewpoint  
When the scene is rendered with the pickup available  
Then the pickup is visibly identifiable and its surrounding space reads as comfortably reachable

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.1.0 | 2026-04-09 | Added player-facing readability rules: blocking geometry must visually align with collision, traversable openings require safety margin beyond hitbox width, interactable spaces must be clearly reachable, office recreation now defaults to exact prototype fidelity where known, and canonical visual acceptance viewpoints were added for false-gap, invisible-collision, HUD-overlap, and pickup-readability failures. |
| 1.0.0 | 2026-04-07 | Initial map system specification. |
