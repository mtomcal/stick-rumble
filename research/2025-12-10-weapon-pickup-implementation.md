---
date: 2025-12-10T00:00:00-08:00
researcher: codebase-researcher-agent
topic: "Weapon Pickup System Implementation Research for Story 3.1"
tags: [research, codebase, weapon-pickup, epic-3, story-3.1]
status: complete
---

# Research: Weapon Pickup System Implementation (Story 3.1)

**Date**: 2025-12-10
**Researcher**: codebase-researcher-agent

## Research Question

How should the weapon pickup system be implemented for Story 3.1? What existing patterns and systems can be reused, and where does new code need to be added?

**Key Research Areas:**
1. How are weapons currently implemented? (entities, stats, firing logic)
2. How is map configuration structured? Where would weapon spawn points be defined?
3. How does the client-server architecture handle entity interactions? (pickup messages, validation)
4. How are game entities spawned and managed on both client and server?
5. What's the existing pattern for proximity detection and interaction prompts?
6. How are WebSocket messages structured for game events?
7. Where should weapon spawn data be stored and how should respawn timers be managed?
8. What's the existing pattern for inventory management (if any)?

## Summary

The codebase has **strong foundations** for implementing weapon pickups but **no pickup system currently exists**. Players spawn with a Pistol only. The weapon pickup system should follow established server-authoritative patterns from the projectile and respawn systems.

**Key Findings:**
- ✅ Weapon data structures exist (`Weapon`, `WeaponState`) with full shooting logic
- ✅ Server-authoritative patterns well-established (projectile spawning, hit detection)
- ✅ AABB collision detection exists and can be adapted for pickup radius
- ✅ Entity manager pattern exists (PlayerManager, ProjectileManager) - can create WeaponCrateManager
- ✅ Network message flow documented (client sends request → server validates → server broadcasts)
- ❌ No weapon pickup collision detection exists
- ❌ No weapon spawn point configuration system
- ❌ No weapon respawn timer management
- ❌ No interaction prompts ("Press E") UI system
- ❌ No inventory system (only single weapon held)

## Detailed Findings

### 1. Current Weapon Implementation

#### Server-Side Weapon Structure

**File**: `/home/mtomcal/code/stick-rumble/trees/feature-weapon-pickup-system/stick-rumble-server/internal/game/weapon.go`

**Weapon Struct (lines 33-40)**:
```go
type Weapon struct {
    Name            string
    Damage          int
    FireRate        float64       // Rounds per second
    MagazineSize    int           // Rounds per magazine
    ReloadTime      time.Duration // Time to reload
    ProjectileSpeed float64       // Projectile speed in px/s
}
```

**WeaponState Tracking (lines 55-61)**:
```go
type WeaponState struct {
    Weapon          *Weapon
    CurrentAmmo     int
    IsReloading     bool
    LastShotTime    time.Time
    ReloadStartTime time.Time
}
```

**Current Implementation Status**:
- ✅ Only `NewPistol()` factory function exists (weapon.go:43-52)
- ✅ Complete firing logic with fire rate cooldown (weapon.go:73-93)
- ✅ Reload system with time tracking (weapon.go:104-133)
- ❌ No other weapon types (Bat, Katana, Uzi, AK47, Shotgun) implemented yet
- ❌ No weapon type identifier enum/string

**Player Weapon Assignment**:
```go
// gameserver.go:183-186
func (gs *GameServer) AddPlayer(playerID string) *PlayerState {
    player := gs.world.AddPlayer(playerID)
    gs.weaponStates[playerID] = NewWeaponState(NewPistol()) // Everyone starts with pistol
    return player
}
```

#### Client-Side Weapon Constants

**File**: `/home/mtomcal/code/stick-rumble/trees/feature-weapon-pickup-system/stick-rumble-client/src/shared/constants.ts:59-77`

```typescript
export const WEAPON = {
  PISTOL_DAMAGE: 25,
  PISTOL_FIRE_RATE: 3,
  PISTOL_MAGAZINE_SIZE: 15,
  PISTOL_RELOAD_TIME: 1500,
  PROJECTILE_SPEED: 800,
  PROJECTILE_MAX_LIFETIME: 1000,
} as const;
```

**Status**: Pistol-only constants, matches server implementation

### 2. Map Configuration & Spawn Systems

#### Arena Dimensions

**Server**: `/home/mtomcal/code/stick-rumble/trees/feature-weapon-pickup-system/stick-rumble-server/internal/game/constants.go:15-22`
```go
const (
    ArenaWidth  = 1920.0  // pixels
    ArenaHeight = 1080.0  // pixels
)
```

**Client**: `/home/mtomcal/code/stick-rumble/trees/feature-weapon-pickup-system/stick-rumble-client/src/shared/constants.ts:23-29`
```typescript
export const ARENA = {
  WIDTH: 1920,
  HEIGHT: 1080,
} as const;
```

#### Existing Spawn Point System (Player Respawns)

**File**: `/home/mtomcal/code/stick-rumble/trees/feature-weapon-pickup-system/stick-rumble-server/internal/game/world.go:78-126`

```go
// GetBalancedSpawnPoint finds a spawn point furthest from all living enemy players
func (w *World) GetBalancedSpawnPoint(excludePlayerID string) Vector2 {
    // Collects positions of all living enemy players
    enemyPositions := make([]Vector2, 0)
    for id, player := range w.players {
        if id != excludePlayerID && !player.IsDead() {
            enemyPositions = append(enemyPositions, player.GetPosition())
        }
    }

    // If no enemies, spawn at center
    if len(enemyPositions) == 0 {
        return Vector2{X: ArenaWidth / 2, Y: ArenaHeight / 2}
    }

    // Try 10 random spawn candidates and pick the one furthest from enemies
    // Uses distance calculation to maximize minimum distance from enemies
    // Includes 100px margin from arena edges
}

// distance calculates the Euclidean distance between two points
func distance(a, b Vector2) float64 {
    dx := a.X - b.X
    dy := a.Y - b.Y
    return math.Sqrt(dx*dx + dy*dy)
}
```

**Key Insights**:
- ✅ Sophisticated spawn point selection exists
- ✅ Distance calculation function `distance()` available for reuse
- ✅ Respawn system works (3 second delay, 2 second invulnerability)
- ❌ No fixed position spawn system (always randomized for players)
- ❌ No weapon spawn point configuration

**Recommendation**: Create `WeaponSpawnConfig` struct with fixed positions:
```go
type WeaponSpawnPoint struct {
    ID         string
    Position   Vector2
    WeaponType string  // "bat", "katana", "uzi", "ak47", "shotgun"
}

var DefaultArenaWeaponSpawns = []WeaponSpawnPoint{
    {ID: "spawn_1", Position: Vector2{X: 960, Y: 200}, WeaponType: "uzi"},
    {ID: "spawn_2", Position: Vector2{X: 400, Y: 540}, WeaponType: "ak47"},
    {ID: "spawn_3", Position: Vector2{X: 1520, Y: 540}, WeaponType: "shotgun"},
}
```

### 3. Client-Server Architecture & Entity Interactions

#### Server-Authoritative Pattern

**Message Flow** (from existing projectile system):

1. **Client sends request**: `player:shoot` with aim angle
2. **Server validates**: Checks ammo, cooldown, reload state
3. **Server updates state**: Spawns projectile if valid
4. **Server broadcasts**: `projectile:spawn` to all clients
5. **Server confirms**: `weapon:state` to shooter with updated ammo

**File References**:
- Server validation: `stick-rumble-server/internal/network/message_processor.go:42-65`
- Broadcast helper: `stick-rumble-server/internal/network/broadcast_helper.go`

**Existing Message Types**:
```go
// websocket_handler.go:170-180
case "input:state":
    h.handleInputState(playerID, msg.Data)
case "player:shoot":
    h.handlePlayerShoot(playerID, msg.Data)
case "player:reload":
    h.handlePlayerReload(playerID)
```

**Proposed Pickup Flow**:
```
1. Client detects proximity to weapon crate (32px range)
2. Client displays "Press E to pick up [Weapon]" prompt
3. Player presses E → Client sends "weapon:pickup_attempt" {crateId}
4. Server validates: distance check, weapon available, player alive
5. Server updates: assigns weapon, marks crate unavailable, starts respawn timer
6. Server broadcasts: "weapon:pickup_confirmed" {playerId, crateId, weaponType}
7. Server schedules: "weapon:respawn" after 30 seconds
```

#### Network Message Structure

**Client Interface**: `/home/mtomcal/code/stick-rumble/trees/feature-weapon-pickup-system/stick-rumble-client/src/game/network/WebSocketClient.ts:1-5`
```typescript
export interface Message {
  type: string;
  timestamp: number;
  data?: unknown;
}
```

**Server Struct**: `/home/mtomcal/code/stick-rumble/trees/feature-weapon-pickup-system/stick-rumble-server/internal/network/websocket_handler.go:26-30`
```go
type Message struct {
    Type      string `json:"type"`
    Timestamp int64  `json:"timestamp"`
    Data      any    `json:"data,omitempty"`
}
```

**Proposed New Messages**:
```typescript
// Client → Server
{
  type: "weapon:pickup_attempt",
  timestamp: Date.now(),
  data: { crateId: "crate_uzi_1" }
}

// Server → All Clients
{
  type: "weapon:pickup_confirmed",
  timestamp: serverTime,
  data: {
    playerId: "player_123",
    crateId: "crate_uzi_1",
    weaponType: "uzi",
    nextRespawnTime: 1733850000
  }
}

// Server → All Clients (after 30s)
{
  type: "weapon:respawned",
  timestamp: serverTime,
  data: {
    crateId: "crate_uzi_1",
    weaponType: "uzi",
    position: { x: 960, y: 200 }
  }
}
```

### 4. Game Entity Spawning & Management

#### Server-Side Entity Management

**GameServer Tick Loop**: `stick-rumble-server/internal/game/gameserver.go:96-136`
```go
func (gs *GameServer) tickLoop(ctx context.Context) {
    ticker := time.NewTicker(gs.tickRate) // 60Hz
    for {
        case now := <-ticker.C:
            deltaTime := now.Sub(lastTick).Seconds()

            // Update all players
            gs.updateAllPlayers(deltaTime)

            // Update all projectiles
            gs.projectileManager.Update(deltaTime)

            // Check for projectile-player collisions
            gs.checkHitDetection()

            // Check for reload completions
            gs.checkReloads()

            // Check for respawns
            gs.checkRespawns()

            // Update invulnerability status
            gs.updateInvulnerability()

            // Update health regeneration
            gs.updateHealthRegeneration(deltaTime)
    }
}
```

**Add to Tick Loop**:
```go
// Check for weapon crate pickups (proximity detection)
gs.checkWeaponPickups()

// Update weapon respawn timers
gs.updateWeaponRespawns()
```

**ProjectileManager Pattern**: `stick-rumble-server/internal/game/projectile.go:91-127`
```go
type ProjectileManager struct {
    projectiles map[string]*Projectile
    mu          sync.RWMutex
}

func (pm *ProjectileManager) SpawnProjectile(proj *Projectile) {
    pm.mu.Lock()
    defer pm.mu.Unlock()
    pm.projectiles[proj.ID] = proj
}

func (pm *ProjectileManager) Update(deltaTime float64) {
    // Update positions, remove expired
}

func (pm *ProjectileManager) RemoveProjectile(id string) {
    pm.mu.Lock()
    defer pm.mu.Unlock()
    delete(pm.projectiles, id)
}
```

**Recommended WeaponCrateManager**:
```go
type WeaponCrate struct {
    ID           string
    Position     Vector2
    WeaponType   string
    IsAvailable  bool
    RespawnTime  time.Time
}

type WeaponCrateManager struct {
    crates map[string]*WeaponCrate
    mu     sync.RWMutex
}

func NewWeaponCrateManager() *WeaponCrateManager {
    manager := &WeaponCrateManager{
        crates: make(map[string]*WeaponCrate),
    }
    // Initialize with default spawn points
    manager.InitializeDefaultSpawns()
    return manager
}

func (wcm *WeaponCrateManager) PickupCrate(crateID string) bool {
    wcm.mu.Lock()
    defer wcm.mu.Unlock()

    crate, exists := wcm.crates[crateID]
    if !exists || !crate.IsAvailable {
        return false
    }

    crate.IsAvailable = false
    crate.RespawnTime = time.Now().Add(30 * time.Second)
    return true
}

func (wcm *WeaponCrateManager) UpdateRespawns() []string {
    // Returns list of crate IDs that respawned
}
```

#### Client-Side Entity Management

**PlayerManager Pattern**: `/home/mtomcal/code/stick-rumble/trees/feature-weapon-pickup-system/stick-rumble-client/src/game/entities/PlayerManager.ts:29-45`
```typescript
export class PlayerManager {
  private scene: Phaser.Scene;
  private players: Map<string, Phaser.GameObjects.Rectangle> = new Map();
  private playerLabels: Map<string, Phaser.GameObjects.Text> = new Map();
  private aimIndicators: Map<string, Phaser.GameObjects.Line> = new Map();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  updatePlayers(playerStates: PlayerState[]): void {
    // Remove players that no longer exist
    // Update or create players
    // Update positions and visual effects
  }
}
```

**ProjectileManager Pattern**: `/home/mtomcal/code/stick-rumble/trees/feature-weapon-pickup-system/stick-rumble-client/src/game/entities/ProjectileManager.ts:30-74`
```typescript
export class ProjectileManager {
  private scene: Phaser.Scene;
  private projectiles: Map<string, Projectile> = new Map();

  spawnProjectile(data: ProjectileData): void {
    // Create projectile sprite
    const sprite = this.scene.add.circle(
      data.position.x,
      data.position.y,
      EFFECTS.PROJECTILE_DIAMETER / 2,
      0xffff00
    );

    // Create bullet tracer
    const tracer = this.createTracer(...);

    this.projectiles.set(data.id, { sprite, tracer, ... });
  }

  update(deltaTime: number): void {
    // Update projectile positions client-side
  }

  removeProjectile(id: string): void {
    // Destroy sprites
  }
}
```

**Recommended WeaponCrateManager (Client)**:
```typescript
export interface WeaponCrateData {
  id: string;
  position: { x: number; y: number };
  weaponType: string; // "bat", "katana", "uzi", "ak47", "shotgun"
  isAvailable: boolean;
}

export class WeaponCrateManager {
  private scene: Phaser.Scene;
  private crates: Map<string, {
    sprite: Phaser.GameObjects.Sprite;
    glow: Phaser.GameObjects.Circle;
    isAvailable: boolean;
  }> = new Map();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  spawnCrate(data: WeaponCrateData): void {
    // Create weapon crate sprite (box or weapon icon)
    const sprite = this.scene.add.rectangle(
      data.position.x,
      data.position.y,
      48, 48,
      0x996633 // Brown crate color
    );

    // Add glow effect for visibility
    const glow = this.scene.add.circle(
      data.position.x,
      data.position.y,
      32,
      0xffff00,
      0
    );
    glow.setStrokeStyle(2, 0xffff00, 0.5);

    // Add bobbing animation
    this.scene.tweens.add({
      targets: sprite,
      y: data.position.y - 5,
      yoyo: true,
      duration: 1000,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    this.crates.set(data.id, { sprite, glow, isAvailable: true });
  }

  markUnavailable(crateId: string): void {
    const crate = this.crates.get(crateId);
    if (crate) {
      crate.sprite.setAlpha(0.3); // Fade out
      crate.glow.setVisible(false);
      crate.isAvailable = false;
    }
  }

  markAvailable(crateId: string): void {
    const crate = this.crates.get(crateId);
    if (crate) {
      crate.sprite.setAlpha(1.0);
      crate.glow.setVisible(true);
      crate.isAvailable = true;
    }
  }
}
```

### 5. Proximity Detection & Interaction Prompts

#### Existing Collision Detection (AABB)

**File**: `/home/mtomcal/code/stick-rumble/trees/feature-weapon-pickup-system/stick-rumble-server/internal/game/physics.go:170-210`

```go
// CheckProjectilePlayerCollision checks if a projectile hits a player
func (p *Physics) CheckProjectilePlayerCollision(proj *Projectile, player *PlayerState) bool {
    // Skip if player is invulnerable
    if player.IsInvulnerable {
        return false
    }

    playerPos := player.GetPosition()

    // Player hitbox is centered
    halfWidth := PlayerWidth / 2
    halfHeight := PlayerHeight / 2

    // AABB collision detection
    if proj.Position.X >= playerPos.X-halfWidth &&
       proj.Position.X <= playerPos.X+halfWidth &&
       proj.Position.Y >= playerPos.Y-halfHeight &&
       proj.Position.Y <= playerPos.Y+halfHeight {

        // Validate range: reject hits beyond max projectile range
        distanceTraveled := calculateDistance(proj.SpawnPosition, proj.Position)
        if distanceTraveled > ProjectileMaxRange {
            return false
        }

        return true
    }

    return false
}

// calculateDistance returns the Euclidean distance between two positions
func calculateDistance(pos1, pos2 Vector2) float64 {
    dx := pos1.X - pos2.X
    dy := pos1.Y - pos2.Y
    return math.Sqrt(dx*dx + dy*dy)
}
```

**Adapt for Weapon Pickups**:
```go
// CheckPlayerCrateProximity checks if player is within pickup range of crate
func (p *Physics) CheckPlayerCrateProximity(player *PlayerState, crate *WeaponCrate) bool {
    if !crate.IsAvailable {
        return false
    }

    if player.IsDead() {
        return false
    }

    playerPos := player.GetPosition()
    distance := calculateDistance(playerPos, crate.Position)

    return distance <= PickupRadius // 32px from Story 3.1
}

const PickupRadius = 32.0 // pixels
```

#### Interaction Prompt System (NEW - Needs Implementation)

**Story 3.1 Requirement**: "Press E to pick up [Weapon]" prompt when within 32px range

**Client-Side Proximity Check** (runs in GameScene.update):
```typescript
// In GameScene.update() or new InteractionManager class
private checkWeaponProximity(): void {
  const localPlayerPos = this.playerManager.getPlayerPosition(this.localPlayerId);
  if (!localPlayerPos) return;

  let closestCrate: { id: string, weaponType: string } | null = null;
  let closestDistance = Infinity;

  for (const [crateId, crate] of this.weaponCrateManager.getCrates()) {
    if (!crate.isAvailable) continue;

    const dx = crate.position.x - localPlayerPos.x;
    const dy = crate.position.y - localPlayerPos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance <= 32 && distance < closestDistance) {
      closestCrate = { id: crateId, weaponType: crate.weaponType };
      closestDistance = distance;
    }
  }

  if (closestCrate) {
    this.showPickupPrompt(closestCrate.weaponType);
    this.nearbyWeaponCrate = closestCrate;
  } else {
    this.hidePickupPrompt();
    this.nearbyWeaponCrate = null;
  }
}

private showPickupPrompt(weaponType: string): void {
  if (!this.pickupPromptText) {
    this.pickupPromptText = this.add.text(
      this.cameras.main.centerX,
      this.cameras.main.height - 100,
      '',
      { fontSize: '20px', color: '#ffff00' }
    );
    this.pickupPromptText.setOrigin(0.5);
    this.pickupPromptText.setScrollFactor(0); // Fixed to screen
  }

  this.pickupPromptText.setText(`Press E to pick up ${weaponType.toUpperCase()}`);
  this.pickupPromptText.setVisible(true);
}

private hidePickupPrompt(): void {
  if (this.pickupPromptText) {
    this.pickupPromptText.setVisible(false);
  }
}
```

**Input Handling** (add to GameScene.create):
```typescript
// Setup E key for weapon pickup
const pickupKey = this.input.keyboard?.addKey('E');
if (pickupKey) {
  pickupKey.on('down', () => {
    if (this.nearbyWeaponCrate) {
      // Send pickup request to server
      this.wsClient.send({
        type: 'weapon:pickup_attempt',
        timestamp: Date.now(),
        data: { crateId: this.nearbyWeaponCrate.id }
      });
    }
  });
}
```

**Phaser 3 Proximity Detection Patterns** (from web research):
- Arcade Physics: `closest()` method finds nearest body to a source
- Matter.js Physics: Query module for efficient collision queries
- Custom distance calculation (current approach) is standard for non-physics-based proximity

### 6. WebSocket Message Structure

#### Message Handler Registration

**Client**: `/home/mtomcal/code/stick-rumble/trees/feature-weapon-pickup-system/stick-rumble-client/src/game/network/WebSocketClient.ts:90-112`
```typescript
on(messageType: string, handler: (data: unknown) => void): void {
  const handlers = this.messageHandlers.get(messageType) || new Set();
  handlers.add(handler);
  this.messageHandlers.set(messageType, handlers);
}

private handleMessage(message: Message): void {
  const handlers = this.messageHandlers.get(message.type);
  if (handlers) {
    handlers.forEach(handler => handler(message.data));
  }
}
```

**Server**: `/home/mtomcal/code/stick-rumble/trees/feature-weapon-pickup-system/stick-rumble-server/internal/network/websocket_handler.go:168-180`
```go
// Message handling loop
switch msg.Type {
case "input:state":
    h.handleInputState(playerID, msg.Data)
case "player:shoot":
    h.handlePlayerShoot(playerID, msg.Data)
case "player:reload":
    h.handlePlayerReload(playerID)
default:
    // Broadcast other messages to room
    room := h.roomManager.GetRoomByPlayerID(playerID)
    if room != nil {
        room.Broadcast(messageBytes, playerID)
    }
}
```

**Add Weapon Pickup Handler**:
```go
case "weapon:pickup_attempt":
    h.handleWeaponPickup(playerID, msg.Data)
```

#### Broadcast Pattern

**Example from Projectile Spawn**: `stick-rumble-server/internal/network/broadcast_helper.go`
```go
func (h *WebSocketHandler) broadcastProjectileSpawn(proj *game.Projectile) {
    message := Message{
        Type:      "projectile:spawn",
        Timestamp: 0,
        Data: map[string]interface{}{
            "id":       proj.ID,
            "ownerId":  proj.OwnerID,
            "position": proj.Position,
            "velocity": proj.Velocity,
        },
    }

    msgBytes, err := json.Marshal(message)
    if err != nil {
        log.Printf("Error marshaling projectile:spawn: %v", err)
        return
    }

    // Broadcast to all players
    h.roomManager.BroadcastToAll(msgBytes)
}
```

**Apply to Weapon Pickup**:
```go
func (h *WebSocketHandler) broadcastWeaponPickup(playerID, crateID, weaponType string, respawnTime time.Time) {
    message := Message{
        Type:      "weapon:pickup_confirmed",
        Timestamp: time.Now().UnixMilli(),
        Data: map[string]interface{}{
            "playerId":        playerID,
            "crateId":         crateID,
            "weaponType":      weaponType,
            "nextRespawnTime": respawnTime.Unix(),
        },
    }

    msgBytes, _ := json.Marshal(message)
    h.roomManager.BroadcastToAll(msgBytes)
}

func (h *WebSocketHandler) broadcastWeaponRespawn(crate *game.WeaponCrate) {
    message := Message{
        Type:      "weapon:respawned",
        Timestamp: time.Now().UnixMilli(),
        Data: map[string]interface{}{
            "crateId":    crate.ID,
            "weaponType": crate.WeaponType,
            "position":   crate.Position,
        },
    }

    msgBytes, _ := json.Marshal(message)
    h.roomManager.BroadcastToAll(msgBytes)
}
```

### 7. Weapon Spawn Data & Respawn Timer Management

#### Respawn Timer Pattern (from Player Respawn)

**File**: `/home/mtomcal/code/stick-rumble/trees/feature-weapon-pickup-system/stick-rumble-server/internal/game/gameserver.go`

**Player Respawn Check** (lines 413-451):
```go
func (gs *GameServer) checkRespawns() {
    gs.world.mu.RLock()
    players := make([]*PlayerState, 0, len(gs.world.players))
    for _, player := range gs.world.players {
        players = append(players, player)
    }
    gs.world.mu.RUnlock()

    for _, player := range players {
        if player.CanRespawn() {
            // Find balanced spawn point
            spawnPos := gs.world.GetBalancedSpawnPoint(player.ID)

            // Respawn the player
            player.Respawn(spawnPos)

            // Notify clients via callback
            if gs.onRespawn != nil {
                gs.onRespawn(player.ID, spawnPos)
            }
        }
    }
}
```

**Player Respawn Timing**: `stick-rumble-server/internal/game/player.go:172-180`
```go
// CanRespawn returns true if the respawn delay has passed
func (p *PlayerState) CanRespawn() bool {
    p.mu.RLock()
    defer p.mu.RUnlock()
    if p.DeathTime == nil {
        return false
    }
    return time.Since(*p.DeathTime).Seconds() >= RespawnDelay // 3.0 seconds
}
```

**Apply to Weapon Crates**:
```go
// In WeaponCrateManager
func (wcm *WeaponCrateManager) UpdateRespawns() []string {
    wcm.mu.Lock()
    defer wcm.mu.Unlock()

    respawned := make([]string, 0)
    now := time.Now()

    for id, crate := range wcm.crates {
        if !crate.IsAvailable && now.After(crate.RespawnTime) {
            crate.IsAvailable = true
            respawned = append(respawned, id)
        }
    }

    return respawned
}

// In GameServer tick loop
func (gs *GameServer) checkWeaponRespawns() {
    respawnedCrates := gs.weaponCrateManager.UpdateRespawns()

    for _, crateID := range respawnedCrates {
        crate := gs.weaponCrateManager.GetCrate(crateID)
        if crate != nil && gs.onWeaponRespawn != nil {
            gs.onWeaponRespawn(crate)
        }
    }
}
```

**Constants**:
```go
// In constants.go
const (
    // WeaponRespawnDelay is the time in seconds before a weapon respawns after pickup
    WeaponRespawnDelay = 30.0

    // WeaponPickupRadius is the distance in pixels for weapon pickup detection
    WeaponPickupRadius = 32.0
)
```

#### Weapon Spawn Configuration Storage

**Recommendation**: Hardcode initial spawn points in `WeaponCrateManager`, migrate to JSON config file in future

```go
// weapon_crate_manager.go
func (wcm *WeaponCrateManager) InitializeDefaultSpawns() {
    spawns := []struct {
        Position   Vector2
        WeaponType string
    }{
        {Position: Vector2{X: 960, Y: 200}, WeaponType: "uzi"},
        {Position: Vector2{X: 400, Y: 540}, WeaponType: "ak47"},
        {Position: Vector2{X: 1520, Y: 540}, WeaponType: "shotgun"},
        {Position: Vector2{X: 960, Y: 880}, WeaponType: "katana"},
        {Position: Vector2{X: 200, Y: 200}, WeaponType: "bat"},
    }

    for i, spawn := range spawns {
        crateID := fmt.Sprintf("crate_%s_%d", spawn.WeaponType, i)
        wcm.crates[crateID] = &WeaponCrate{
            ID:          crateID,
            Position:    spawn.Position,
            WeaponType:  spawn.WeaponType,
            IsAvailable: true,
        }
    }
}
```

**Future Enhancement**: Load from JSON map configuration
```json
{
  "mapName": "default_arena",
  "weaponSpawns": [
    {"id": "spawn_uzi_center", "position": {"x": 960, "y": 200}, "weaponType": "uzi"},
    {"id": "spawn_ak47_left", "position": {"x": 400, "y": 540}, "weaponType": "ak47"}
  ]
}
```

### 8. Inventory Management Patterns

**Current Status**: ❌ No inventory system exists

**Player State**: Only tracks single weapon via `weaponStates[playerID]`

**Story 3.1 Requirement**:
- "my current weapon is replaced (dropped at my location if not default pistol)"
- Implies single weapon slot (no multi-weapon inventory)

**Recommended Approach for MVP**:
```go
// Simple weapon switching (no inventory)
func (h *WebSocketHandler) handleWeaponPickup(playerID string, data any) {
    dataMap, ok := data.(map[string]interface{})
    if !ok {
        return
    }

    crateID, _ := dataMap["crateId"].(string)

    // 1. Validate pickup (proximity, availability, player alive)
    crate := h.gameServer.weaponCrateManager.GetCrate(crateID)
    if crate == nil || !crate.IsAvailable {
        return
    }

    player, exists := h.gameServer.GetPlayerState(playerID)
    if !exists || player.IsDead() {
        return
    }

    // 2. Check distance
    playerPos := player.GetPosition()
    distance := calculateDistance(playerPos, crate.Position)
    if distance > WeaponPickupRadius {
        return
    }

    // 3. Update player's weapon (simple replacement)
    oldWeapon := h.gameServer.GetWeaponState(playerID)

    // Drop old weapon if not pistol (for future implementation)
    // For MVP: just destroy/replace

    // 4. Assign new weapon
    newWeapon := CreateWeaponByType(crate.WeaponType)
    h.gameServer.SetWeaponState(playerID, NewWeaponState(newWeapon))

    // 5. Mark crate as picked up
    h.gameServer.weaponCrateManager.PickupCrate(crateID)

    // 6. Broadcast pickup to all clients
    h.broadcastWeaponPickup(playerID, crateID, crate.WeaponType, crate.RespawnTime)

    // 7. Send weapon state to picker
    h.sendWeaponState(playerID)
}
```

**No Multi-Weapon Inventory Needed** (for Story 3.1):
- ✅ Single weapon slot simplifies implementation
- ✅ Matches GDD: "Weapon switching - Instant switch to picked-up weapon"
- ✅ No UI for inventory management needed
- ✅ Server tracks: `weaponStates[playerID] = WeaponState`

## Code References

### Server-Side Files
- `stick-rumble-server/internal/game/weapon.go` - Weapon struct, WeaponState, Pistol implementation
- `stick-rumble-server/internal/game/constants.go:15-22` - Arena dimensions (1920x1080)
- `stick-rumble-server/internal/game/gameserver.go:96-136` - Game tick loop (60Hz)
- `stick-rumble-server/internal/game/world.go:78-134` - Spawn point system, distance calculation
- `stick-rumble-server/internal/game/physics.go:139-210` - AABB collision detection, distance functions
- `stick-rumble-server/internal/game/projectile.go:91-127` - ProjectileManager pattern
- `stick-rumble-server/internal/network/websocket_handler.go:168-180` - Message handler switch
- `stick-rumble-server/internal/network/message_processor.go:42-75` - Message processing pattern
- `stick-rumble-server/internal/network/broadcast_helper.go` - Broadcast message pattern

### Client-Side Files
- `stick-rumble-client/src/shared/constants.ts:23-77` - Arena/weapon constants
- `stick-rumble-client/src/game/scenes/GameScene.ts` - Main game scene, managers initialization
- `stick-rumble-client/src/game/entities/PlayerManager.ts:29-264` - Entity manager pattern
- `stick-rumble-client/src/game/entities/ProjectileManager.ts:30-100` - Projectile spawning/rendering
- `stick-rumble-client/src/game/network/WebSocketClient.ts:90-124` - Message handler system

### Reference Documents
- `research/2025-12-09-weapon-acquisition-system.md` - Weapon acquisition system design analysis
- `docs/weapon-balance-analysis.md:563-578` - Pickup system options (recommends fixed crates)
- `docs/epics.md` - Story 3.1 acceptance criteria (32px range, E key, 30s respawn)

## Architecture Insights

### Pattern 1: Server-Authoritative Entity Lifecycle

**Established Pattern** (from Projectile system):
1. Server owns entity state (position, type, active status)
2. Server broadcasts spawn event with entity ID
3. Clients create visual representation only
4. Server handles entity lifecycle (spawn, update, despawn)
5. Server validates all interactions
6. Server broadcasts state changes to all clients

**Apply to Weapon Crates**:
- Server creates crates on match start
- Server tracks availability and respawn timers
- Server validates pickup attempts (distance, availability)
- Server broadcasts pickup/respawn events
- Clients render visual crates and update based on server events

### Pattern 2: Manager-Based Entity Organization

**Established Pattern**:
- PlayerManager: Tracks sprites, labels, aim indicators
- ProjectileManager: Tracks projectiles, tracers, updates
- Both use `Map<string, Entity>` for entity lookup
- Both have `update()` methods for tick-based updates
- Both have `destroy()` cleanup methods

**Apply to Weapon Crates**:
```typescript
// Client: WeaponCrateManager
class WeaponCrateManager {
  private crates: Map<string, CrateVisual> = new Map();

  spawnCrate(data: WeaponCrateData): void
  markUnavailable(crateId: string): void
  markAvailable(crateId: string): void
  checkProximity(playerPos: Vector2): WeaponCrate | null
  destroy(): void
}
```

```go
// Server: WeaponCrateManager
type WeaponCrateManager struct {
    crates map[string]*WeaponCrate
    mu     sync.RWMutex
}

func (wcm *WeaponCrateManager) PickupCrate(crateID string) bool
func (wcm *WeaponCrateManager) UpdateRespawns() []string
func (wcm *WeaponCrateManager) GetCrate(crateID string) *WeaponCrate
```

### Pattern 3: Tick-Based State Updates

**Established Pattern** (60Hz server tick):
- `updateAllPlayers()` - Update physics, movement
- `checkHitDetection()` - Projectile-player collisions
- `checkReloads()` - Weapon reload completion
- `checkRespawns()` - Player respawn timing
- `updateHealthRegeneration()` - HP recovery

**Add for Weapon Pickups**:
- `checkWeaponPickups()` - Proximity detection for auto-pickup OR validate manual pickup requests
- `checkWeaponRespawns()` - Update respawn timers, broadcast respawn events

### Pattern 4: Callback-Based Event Handling

**Established Pattern**:
```go
type GameServer struct {
    onReloadComplete func(playerID string)
    onHit            func(hit HitEvent)
    onRespawn        func(playerID string, position Vector2)
}

// Set callbacks in WebSocketHandler
handler.gameServer.SetOnReloadComplete(handler.onReloadComplete)
handler.gameServer.SetOnHit(handler.onHit)
```

**Apply to Weapon Pickups**:
```go
type GameServer struct {
    onWeaponPickup  func(playerID, crateID, weaponType string)
    onWeaponRespawn func(crate *WeaponCrate)
}

// In message processor
func (h *WebSocketHandler) onWeaponPickup(playerID, crateID, weaponType string) {
    // Broadcast pickup to all clients
    h.broadcastWeaponPickup(playerID, crateID, weaponType, respawnTime)
}

func (h *WebSocketHandler) onWeaponRespawn(crate *WeaponCrate) {
    // Broadcast respawn to all clients
    h.broadcastWeaponRespawn(crate)
}
```

## Implementation Recommendations

### Phase 1: Server-Side Core (Story 3.1A)

**Files to Create**:
1. `stick-rumble-server/internal/game/weapon_crate.go` - WeaponCrate struct, WeaponCrateManager
2. `stick-rumble-server/internal/game/weapon_factory.go` - Weapon factory functions (NewBat, NewKatana, NewUzi, NewAK47, NewShotgun)

**Files to Modify**:
1. `stick-rumble-server/internal/game/gameserver.go`:
   - Add `weaponCrateManager *WeaponCrateManager`
   - Add `checkWeaponRespawns()` to tick loop
   - Add `onWeaponPickup` and `onWeaponRespawn` callbacks
2. `stick-rumble-server/internal/game/physics.go`:
   - Add `CheckPlayerCrateProximity()` function
3. `stick-rumble-server/internal/game/constants.go`:
   - Add `WeaponRespawnDelay = 30.0`
   - Add `WeaponPickupRadius = 32.0`
4. `stick-rumble-server/internal/network/message_processor.go`:
   - Add `handleWeaponPickup()` function
5. `stick-rumble-server/internal/network/websocket_handler.go`:
   - Add `case "weapon:pickup_attempt"` to message switch
6. `stick-rumble-server/internal/network/broadcast_helper.go`:
   - Add `broadcastWeaponPickup()` function
   - Add `broadcastWeaponRespawn()` function

**Estimated LOC**: ~400 lines

### Phase 2: Client-Side Rendering (Story 3.1B)

**Files to Create**:
1. `stick-rumble-client/src/game/entities/WeaponCrateManager.ts` - Client crate manager
2. `stick-rumble-client/src/game/ui/PickupPromptUI.ts` - "Press E" prompt

**Files to Modify**:
1. `stick-rumble-client/src/game/scenes/GameScene.ts`:
   - Add `weaponCrateManager` initialization
   - Add proximity check to `update()` loop
   - Add E key handler for pickup
2. `stick-rumble-client/src/game/scenes/GameSceneEventHandlers.ts`:
   - Add `weapon:pickup_confirmed` handler
   - Add `weapon:respawned` handler
   - Add `weapon:spawned` handler (for match start)
3. `stick-rumble-client/src/shared/constants.ts`:
   - Add weapon type constants

**Estimated LOC**: ~300 lines

### Phase 3: Testing (Story 3.1C)

**Server Tests**:
1. `weapon_crate_test.go` - WeaponCrateManager unit tests
2. `weapon_factory_test.go` - Weapon creation tests
3. `physics_proximity_test.go` - Proximity detection tests
4. `websocket_handler_pickup_test.go` - Pickup message handling tests

**Client Tests**:
1. `WeaponCrateManager.test.ts` - Crate rendering tests
2. `GameScene.pickup.test.ts` - Pickup flow integration tests

**Estimated LOC**: ~500 lines

## Open Questions

### Q1: Auto-Pickup vs Manual Pickup?

**Story 3.1 says**: "When I press interact key (F) or auto-pickup enabled"

**Options**:
- A) Manual only (E key required)
- B) Auto-pickup on collision
- C) Configurable setting

**Recommendation**: Option A (Manual with E key) for MVP
- Gives players control over weapon choice
- Prevents accidental pickups
- Simpler to implement (no auto-pickup toggle setting)
- Can add auto-pickup setting in future if requested

### Q2: Dropped Weapons on Pickup?

**Story 3.1 says**: "dropped at my location if not default pistol"

**Options**:
- A) Drop old weapon as pickup-able crate (creates floor loot)
- B) Simple replace without drop (no floor loot)
- C) Drop only non-pistol weapons

**Recommendation**: Option B for MVP (no drops)
- Simpler server state management
- Avoids crate clutter on map
- Story 3.1 focus is pickup, not drop mechanics
- Can add weapon dropping in Story 3.4 (polish)

**Future Enhancement**: Option C (drop non-pistol)
- 10 second despawn timer for dropped weapons (from Story 3.1 context)
- Dropped weapons go to same spawn point they came from
- Prevents excessive floor loot

### Q3: Multiple Weapons at Same Spawn Point?

**Question**: Can different weapon types spawn at the same location across matches?

**Options**:
- A) Fixed weapon per spawn point (e.g., Uzi always at position X)
- B) Random weapon per spawn point
- C) Rotation based on match time

**Recommendation**: Option A for MVP
- Predictable map control strategy
- Players learn weapon locations
- Simpler implementation
- Matches arena shooter genre (Quake, Halo)

### Q4: Initial Weapon State on Match Start?

**Question**: Are all weapon crates available at match start?

**Options**:
- A) All available immediately
- B) Staggered spawns (e.g., 10s, 20s, 30s delays)
- C) Random initial delays

**Recommendation**: Option A (all available)
- Simplest implementation
- Fair for all players
- No complex spawn scheduling needed
- Matches Story 3.1 expectations

## Industry Best Practices (2025)

### Server-Authoritative Multiplayer Patterns

From web research on server authoritative game design:

**Flow for All Actions**:
1. Clients request actions through input commands
2. Server validates against authoritative game state
3. Server updates its simulation
4. Clients receive state updates to reconcile predictions

**Spawn Authority**:
- Server should maintain authoritative game state for all entities
- Dynamic spawning optimizes performance (spawn entities as players approach)
- For weapon crates: fixed spawns are acceptable (small quantity, always relevant)

**State Synchronization**:
- Server periodically sends updates (20Hz in Stick Rumble)
- Clients interpolate between updates for smooth visuals
- Critical events (pickups, deaths) broadcast immediately

**Validation**:
- Distance checks prevent impossible pickups
- Availability checks prevent race conditions
- Server is single source of truth

### Phaser 3 Proximity Detection

From Phaser documentation and community examples:

**Arcade Physics Approach**:
- `closest()` method finds nearest body
- Good for physics-enabled objects
- Overkill for static weapon crates

**Custom Distance Calculation**:
- Manual Euclidean distance check (current approach)
- More control over pickup radius
- Lower overhead than full physics system
- **Recommended for weapon pickups**

**Visual Feedback**:
- Glow effects for pickup-able items (seen in archived code)
- Bobbing animations for visibility (tweens.add with yoyo)
- Alpha fade for unavailable items

## Conclusion

The weapon pickup system can be implemented by **extending existing patterns**:

**Strong Foundations**:
- ✅ Server-authoritative architecture established
- ✅ Entity manager pattern (PlayerManager, ProjectileManager)
- ✅ Network message flow (request → validate → broadcast)
- ✅ AABB collision detection system
- ✅ Respawn timer system (from player respawns)
- ✅ Distance calculation utilities

**New Components Needed**:
1. WeaponCrateManager (server + client)
2. Weapon factory functions (NewUzi, NewAK47, etc.)
3. Proximity detection for pickups
4. Pickup prompt UI ("Press E")
5. Weapon pickup message handlers
6. Respawn timer for weapon crates

**Estimated Development Effort**:
- Server: ~400 LOC
- Client: ~300 LOC
- Tests: ~500 LOC
- **Total**: ~1200 LOC

**Complexity**: Medium (leverages existing patterns)

**Risk**: Low (well-understood mechanics, strong architectural foundation)

**Recommended Approach**:
- Manual pickup with E key (not auto-pickup)
- Simple weapon replacement (no drops for MVP)
- Fixed spawn points (predictable map control)
- 30 second respawn timer (from Story 3.1)
- 32 pixel pickup radius (from Story 3.1)

## Sources

Web research sources:

Phaser 3 Proximity Detection:
- [Phaser - Continuous Collision Detection in Phaser](https://phaser.io/news/2025/02/continuous-collision-detection-in-phaser)
- [Phaser - Distance between objects](https://phaser.discourse.group/t/distance-between-objects/3400)
- [MatterPhysics Documentation](https://docs.phaser.io/api-documentation/class/physics-matter-matterphysics)

Server-Authoritative Multiplayer:
- [Unity Multiplayer - Server Authoritative Movement](https://subscription.packtpub.com/book/game-development/9781849692328/6/ch06lvl1sec68/implementing-server-authoritative-movement)
- [What are Server-authoritative Realtime Games? - Medium](https://medium.com/mighty-bear-games/what-are-server-authoritative-realtime-games-e2463db534d1)
- [Game Networking Fundamentals 2025 - Generalist Programmer](https://generalistprogrammer.com/tutorials/game-networking-fundamentals-complete-multiplayer-guide-2025)
- [Client-Server Game Architecture - Gabriel Gambetta](https://www.gabrielgambetta.com/client-server-game-architecture.html)
- [Mastering Multiplayer Game Architecture - Getgud.io](https://www.getgud.io/blog/mastering-multiplayer-game-architecture-choosing-the-right-approach/)
