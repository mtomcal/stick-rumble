# Client Architecture

> **Spec Version**: 1.1.0
> **Last Updated**: 2026-02-15
> **Depends On**: [constants.md](constants.md), [messages.md](messages.md), [networking.md](networking.md), [player.md](player.md), [movement.md](movement.md), [weapons.md](weapons.md)
> **Depended By**: [graphics.md](graphics.md), [ui.md](ui.md), [audio.md](audio.md)

---

## Overview

The Stick Rumble client is a browser-based game built with Phaser 3 and React. This spec documents the complete frontend architecture: application structure, scene lifecycle, manager classes, input handling, network integration, and rendering pipeline.

**Why This Architecture:**
- **Phaser 3** provides battle-tested 2D game engine with WebGL acceleration
- **React** handles persistent UI (match end screens, menus) outside the game canvas
- **Manager pattern** isolates subsystems for testability and clear responsibility boundaries
- **Procedural graphics** eliminate asset dependencies and allow infinite customization
- **Event-driven networking** decouples game logic from network layer
- **Client-side prediction** provides responsive controls despite network latency

**Key Design Principles:**
1. **Server is authoritative** - Client renders server state, never modifies game logic
2. **Procedural over assets** - All graphics generated at runtime from primitives
3. **Manager per subsystem** - Players, projectiles, weapons each have dedicated managers
4. **Object pooling** - Reuse graphics objects to prevent garbage collection stalls
5. **Handler cleanup** - All event handlers tracked and removed on scene restart

---

## Dependencies

### Technology Dependencies

| Technology | Version | Purpose |
|------------|---------|---------|
| Phaser 3 | 3.90.0 | 2D game engine with WebGL/Canvas rendering |
| React | 19.2.0 | UI framework for overlays and menus |
| TypeScript | 5.9.3 | Type safety and better tooling |
| Vite | 7.2.4 | Fast development server and bundler |
| Vitest | 4.0.13 | Unit testing framework |

| AJV | latest | JSON Schema validation for messages |

### Spec Dependencies

- [constants.md](constants.md) - All game constants (ARENA, PLAYER, MOVEMENT, WEAPON, NETWORK)
- [messages.md](messages.md) - WebSocket message schemas
- [networking.md](networking.md) - Connection lifecycle and protocols
- [player.md](player.md) - Player state structure
- [movement.md](movement.md) - Input state and physics
- [weapons.md](weapons.md) - Weapon configurations

---

## Constants

See [constants.md](constants.md) for all values. Key constants for client architecture:

| Constant | Value | Description |
|----------|-------|-------------|
| ARENA_WIDTH | 1920 | Arena width in pixels |
| ARENA_HEIGHT | 1080 | Arena height in pixels |
| WINDOW_WIDTH | 1280 | Default browser window width |
| WINDOW_HEIGHT | 720 | Default browser window height |
| SERVER_TICK_RATE | 60 | Server physics updates per second |
| CLIENT_UPDATE_RATE | 20 | player:move broadcast frequency (Hz) |
| CLIENT_UPDATE_INTERVAL | 50 | Milliseconds between player:move messages |

---

## Data Structures

### GameConfig

Phaser game configuration object.

**TypeScript:**
```typescript
const GameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,           // WebGL with Canvas fallback
  width: 1280,                 // Window width
  height: 720,                 // Window height
  parent: 'game-container',    // HTML div ID
  backgroundColor: '#C8CCC8',  // Light gray background (matches arena)

  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 }, // Top-down, no gravity
      debug: false
    }
  },

  scene: [GameScene],          // Scene classes to load

  scale: {
    mode: Phaser.Scale.FIT,    // Fit to browser window
    autoCenter: Phaser.Scale.CENTER_BOTH
  }
};
```

**Why:**
- `Phaser.AUTO` uses WebGL if available, Canvas fallback for compatibility
- `physics.arcade` with zero gravity enables top-down 2D gameplay
- `scale.FIT` maintains aspect ratio while filling browser window
- Light gray background (#C8CCC8) matches the arena floor color

### InputState

Player input captured each frame.

**TypeScript:**
```typescript
interface InputState {
  up: boolean;         // W key pressed
  down: boolean;       // S key pressed
  left: boolean;       // A key pressed
  right: boolean;      // D key pressed
  aimAngle: number;    // Radians from player to mouse cursor
  isSprinting: boolean; // Shift key pressed
}
```

**Why:**
- Boolean flags for WASD allow diagonal movement combinations
- Radians for aimAngle enable standard trigonometry (cos/sin)
- Server receives same structure for movement calculation

### PlayerState (Client View)

Partial player state received from server.

**TypeScript:**
```typescript
interface PlayerState {
  id: string;                    // UUID
  position: { x: number; y: number };
  velocity: { x: number; y: number };
  aimAngle?: number;             // Radians
  deathTime?: number;            // Timestamp when died (ms)
  health?: number;               // 0-100
  isRegenerating?: boolean;      // Health regen active
  isRolling?: boolean;           // Dodge roll active
}
```

**Why:**
- Matches server `player:move` message structure
- Optional fields only present when relevant (deathTime only when dead)
- Velocity needed for walk animation speed

### WeaponState

Client-side weapon tracking.

**TypeScript:**
```typescript
interface WeaponState {
  currentAmmo: number;
  maxAmmo: number;
  isReloading: boolean;
  canShoot: boolean;
  weaponType: string;
  isMelee: boolean;
}
```

**Why:**
- Mirrors server weapon state from `weapon:state` messages
- `canShoot` computed from ammo + reload + cooldown
- `isMelee` determines shoot vs melee attack behavior

### ProjectileData

Data for rendering a projectile.

**TypeScript:**
```typescript
interface ProjectileData {
  id: string;                    // UUID
  ownerId: string;               // Player who fired
  weaponType: string;            // For visual configuration
  position: { x: number; y: number };
  velocity: { x: number; y: number };
}
```

**Why:**
- `ownerId` prevents showing hit effects on self
- `weaponType` determines projectile color and size
- Client moves projectiles locally for smooth visuals (server authoritative)

### WeaponCrateData

Data for rendering a weapon crate.

**TypeScript:**
```typescript
interface WeaponCrateData {
  id: string;
  position: { x: number; y: number };
  weaponType: string;
  isAvailable: boolean;
}
```

**Why:**
- `isAvailable` controls visual alpha (1.0 vs 0.3)
- `weaponType` determines icon displayed on crate

---

## Application Structure

```
stick-rumble-client/
├── src/
│   ├── main.tsx                          # React entry point
│   ├── App.tsx                           # React root (match end state)
│   ├── shared/
│   │   ├── constants.ts                  # Game constants
│   │   ├── types.ts                      # Shared interfaces
│   │   └── weaponConfig.ts               # Weapon configurations
│   ├── ui/
│   │   ├── common/
│   │   │   └── PhaserGame.tsx            # React-Phaser bridge
│   │   └── match/
│   │       └── MatchEndScreen.tsx        # Match end statistics
│   └── game/
│       ├── config/
│       │   └── GameConfig.ts             # Phaser configuration
│       ├── scenes/
│       │   ├── GameScene.ts              # Main game scene
│       │   ├── GameSceneUI.ts            # UI rendering
│       │   ├── GameSceneEventHandlers.ts # Message handlers + reconciliation
│       │   └── GameSceneSpectator.ts     # Spectator mode
│       ├── entities/
│       │   ├── PlayerManager.ts          # Player rendering
│       │   ├── ProjectileManager.ts      # Projectile lifecycle
│       │   ├── WeaponCrateManager.ts     # Weapon crate rendering
│       │   ├── MeleeWeaponManager.ts     # Melee weapon visuals
│       │   ├── HitEffectManager.ts       # Object-pooled effects
│       │   ├── ProceduralPlayerGraphics.ts
│       │   ├── ProceduralWeaponGraphics.ts
│       │   ├── RangedWeapon.ts           # Ranged weapon logic
│       │   ├── MeleeWeapon.ts            # Melee weapon logic
│       │   ├── HealthBar.ts
│       │   └── Crosshair.ts
│       ├── input/
│       │   ├── InputManager.ts           # WASD + mouse + sequence numbers
│       │   ├── ShootingManager.ts        # Fire + reload
│       │   └── DodgeRollManager.ts       # Roll cooldown
│       ├── network/
│       │   ├── WebSocketClient.ts        # Connection wrapper
│       │   ├── NetworkSimulator.ts       # Artificial latency/packet loss
│       │   └── urlParams.ts              # URL parameter parsing
│       ├── physics/                       # [NEW: Epic 4] Client-side netcode
│       │   ├── PredictionEngine.ts       # Local player prediction (mirrors server physics)
│       │   └── InterpolationEngine.ts    # Remote player interpolation (100ms buffer)
│       ├── simulation/                    # [NEW: Epic 4] Pure logic (no Phaser)
│       │   ├── GameSimulation.ts         # Deterministic game simulation
│       │   ├── physics.ts               # Pure math: accelerate, normalize, clamp
│       │   ├── types.ts                 # Simulation type definitions
│       │   ├── InputRecorder.ts         # Input recording for replay/testing
│       │   ├── ScenarioRunner.ts        # Deterministic scenario execution
│       │   └── index.ts                 # Public exports
│       ├── ui/
│       │   ├── HealthBarUI.ts            # Top-left health
│       │   ├── KillFeedUI.ts             # Top-right kills
│       │   ├── PickupPromptUI.ts         # "Press E" prompt
│       │   ├── PickupNotificationUI.ts   # "Picked up [WEAPON]" confirmation
│       │   ├── DodgeRollCooldownUI.ts    # Cooldown indicator
│       │   ├── MinimapUI.ts              # 170x170 circular minimap
│       │   ├── ScoreDisplayUI.ts         # Top-right 6-digit score
│       │   ├── KillCounterUI.ts          # Top-right kill count
│       │   ├── DebugOverlayUI.ts         # FPS/Update/AI debug stats
│       │   └── ChatLogUI.ts              # Bottom-left chat panel
│       ├── effects/
│       │   ├── ScreenShake.ts            # Camera shake
│       │   ├── DamageNumberManager.ts    # Floating damage numbers
│       │   ├── HitIndicatorManager.ts    # Directional hit chevrons
│       │   ├── BloodEffectManager.ts     # Blood particle effects
│       │   └── DamageFlashOverlay.ts     # Full-viewport damage flash
│       ├── audio/
│       │   └── AudioManager.ts           # Positional audio
│       └── utils/
│           ├── Clock.ts                  # Time abstraction
│           └── xpCalculator.ts           # XP calculation logic
├── src/ui/
│   └── debug/                            # [NEW: Epic 4] Network debug tools
│       └── DebugNetworkPanel.tsx         # React panel for network simulation
└── tests/                                # Test setup and mocks
```

**Why This Structure:**
- **game/** contains all Phaser code, separate from React
- **entities/** isolates rendering managers (one per entity type)
- **input/** separates input capture from game logic
- **network/** centralizes WebSocket handling
- **ui/** under game/ for Phaser HUD, under src/ui/ for React overlays
- **effects/** for visual effects that don't belong to a specific entity

---

## Behavior

### Scene Lifecycle

GameScene follows Phaser's standard lifecycle with specific initialization order.

**Phase 1: Preload**

**Pseudocode:**
```
function preload():
    AudioManager.preload(this)  // Load audio assets
    // No sprite assets - procedural graphics only
```

**TypeScript:**
```typescript
preload(): void {
  AudioManager.preload(this);
}
```

**Why:** Procedural graphics eliminate asset loading delays. Audio is the only asset type.

---

**Phase 2: Create**

**Pseudocode:**
```
function create():
    // Register cleanup for scene shutdown
    registerShutdownHandler()

    // Configure world bounds
    physics.world.setBounds(0, 0, ARENA_WIDTH, ARENA_HEIGHT)

    // Render arena background
    renderArena()

    // Create static UI (title)
    createStaticUI()

    // Initialize entity managers (order matters)
    playerManager = new PlayerManager(this)
    projectileManager = new ProjectileManager(this)
    weaponCrateManager = new WeaponCrateManager(this)
    meleeWeaponManager = new MeleeWeaponManager(this)
    hitEffectManager = new HitEffectManager(this, poolSize: 20)

    // Initialize UI components (fixed to camera)
    pickupPromptUI = new PickupPromptUI(this)
    healthBarUI = new HealthBarUI(this, x: 10, y: 70)
    killFeedUI = new KillFeedUI(this)
    gameSceneUI = new GameSceneUI(this)
    dodgeRollUI = new DodgeRollCooldownUI(this)

    // Initialize visual effects
    screenShake = new ScreenShake(this)
    audioManager = new AudioManager(this)

    // Initialize spectator mode
    spectatorMode = new SpectatorMode(this)

    // Connect WebSocket (deferred 100ms for scene stability)
    setTimeout(() => {
        wsClient = new WebSocketClient()
        wsClient.connect()
        eventHandlers = new GameSceneEventHandlers(this, wsClient, managers)
        eventHandlers.setupEventHandlers()

        // Setup input after connection
        inputManager = new InputManager(this)
        shootingManager = new ShootingManager(wsClient)
        dodgeRollManager = new DodgeRollManager()

        registerKeyboardHandlers()
        registerMouseHandlers()
    }, 100)
```

**TypeScript:**
```typescript
create(): void {
  this.events.on('shutdown', this.cleanup, this);

  this.physics.world.setBounds(0, 0, ARENA.WIDTH, ARENA.HEIGHT);

  this.renderArena();
  this.createStaticUI();

  // Entity managers
  this.playerManager = new PlayerManager(this);
  this.projectileManager = new ProjectileManager(this);
  this.weaponCrateManager = new WeaponCrateManager(this);
  this.meleeWeaponManager = new MeleeWeaponManager(this);
  this.hitEffectManager = new HitEffectManager(this, 20);

  // UI components
  this.pickupPromptUI = new PickupPromptUI(this);
  this.healthBarUI = new HealthBarUI(this, 10, 70);
  this.killFeedUI = new KillFeedUI(this);
  this.gameSceneUI = new GameSceneUI(this);
  this.dodgeRollUI = new DodgeRollCooldownUI(this);

  // Effects
  this.screenShake = new ScreenShake(this);
  this.audioManager = new AudioManager(this);

  // Spectator
  this.spectatorMode = new SpectatorMode(this);

  // Deferred connection
  setTimeout(() => {
    this.wsClient = new WebSocketClient();
    this.wsClient.connect();
    this.eventHandlers = new GameSceneEventHandlers(this, this.wsClient, {
      playerManager: this.playerManager,
      projectileManager: this.projectileManager,
      // ... other managers
    });
    this.eventHandlers.setupEventHandlers();

    this.inputManager = new InputManager(this);
    this.shootingManager = new ShootingManager(this.wsClient);
    this.dodgeRollManager = new DodgeRollManager();

    this.registerKeyboardHandlers();
    this.registerMouseHandlers();
  }, 100);
}
```

**Why:**
- 100ms delay ensures scene is fully initialized before network connection
- Manager creation order ensures dependencies are available (PlayerManager before event handlers)
- Event handlers registered last to prevent processing messages before managers exist

---

**Phase 3: Update**

**Pseudocode:**
```
function update(time, delta):
    if not spectating:
        inputManager.update()
        playerManager.updateLocalPlayerAim(inputManager.aimAngle)

        if isAutomaticWeapon AND mouseHeld:
            shootingManager.shoot()

        checkWeaponProximity()

    dodgeRollManager.update()       // no params
    projectileManager.update(delta)
    meleeWeaponManager.update()     // no params

    updateReloadUI()
    updateCrosshair()
```

> **Note:** Camera follow is NOT per-frame. It is set up once via `startCameraFollowIfNeeded()`, which calls `this.cameras.main.startFollow(sprite, true, 0.1, 0.1)`. Phaser's built-in `startFollow` handles smooth lerp natively at 0.1 factor. The callback is triggered from event handlers (e.g., on first `player:move`), not from `update()`.

**TypeScript:**
```typescript
update(_time: number, delta: number): void {
  if (!this.isSpectating) {
    this.inputManager.update();
    this.playerManager.updateLocalPlayerAim(this.inputManager.getAimAngle());

    if (this.shootingManager.isAutomatic() && this.pointerDown) {
      this.shootingManager.shoot();
    }

    this.checkWeaponProximity();
  }

  this.dodgeRollManager.update();
  this.projectileManager.update(delta);
  this.meleeWeaponManager.update();

  this.updateReloadUI();
  this.updateCrosshair();
}
```

**Why:**
- Input processed first for minimum latency
- Local player aim updated immediately for responsive feel (before server confirms)
- Automatic weapons check pointer state for hold-to-fire
- Camera follow is set once via `startFollow()`, not per-frame

---

**Phase 4: Cleanup**

**Pseudocode:**
```
function cleanup():
    eventHandlers.cleanupHandlers()

    playerManager.destroy()
    projectileManager.destroy()
    weaponCrateManager.destroy()
    meleeWeaponManager.destroy()
    hitEffectManager.destroy()

    wsClient.disconnect()
```

**TypeScript:**
```typescript
cleanup(): void {
  this.eventHandlers?.cleanupHandlers();

  this.playerManager?.destroy();
  this.projectileManager?.destroy();
  this.weaponCrateManager?.destroy();
  this.meleeWeaponManager?.destroy();
  this.hitEffectManager?.destroy();

  this.wsClient?.disconnect();
}
```

**Why:**
- Handler cleanup prevents accumulation across scene restarts
- Manager destruction releases Phaser objects (prevents memory leaks)
- WebSocket disconnect triggers new player ID on reconnect

---

### Manager Classes

#### PlayerManager

**Purpose:** Render all players using procedural stick figures. Track player state from server.

**Internal Data:**
```typescript
players: Map<string, ProceduralPlayerGraphics>    // Visual objects
playerLabels: Map<string, Phaser.GameObjects.Text>
aimIndicators: Map<string, Phaser.GameObjects.Line>
weaponGraphics: Map<string, ProceduralWeaponGraphics>
healthBars: Map<string, HealthBar>
playerStates: Map<string, PlayerState>            // Server state
localPlayerId: string | null
```

**Key Methods:**

**Pseudocode:**
```
function updatePlayers(states: PlayerState[]):
    // Remove disconnected players
    for each playerId in players.keys():
        if playerId not in states:
            destroyPlayer(playerId)

    // Update or create players
    for each state in states:
        if state.id not in players:
            createPlayer(state.id, state.position)

        player = players.get(state.id)
        player.setPosition(state.position)
        player.setRotation(state.aimAngle)

        // Velocity drives walk animation
        isMoving = |state.velocity| > 0.1
        player.update(deltaTime, isMoving)

        // Health bar update
        if state.health exists:
            healthBars.get(state.id).setHealth(state.health)

        // Death state (gray color)
        if state.deathTime exists:
            player.setColor(0x888888)  // Gray
        else:
            player.setColor(playerColor)

        // Dodge roll visual (rotation + flicker)
        if state.isRolling:
            rollAngle = (clock.now() % 400) / 400 * 2PI  // 360° over 400ms
            player.setRotation(rollAngle)
            player.setVisible(clock.now() % 200 < 100)  // Flicker every 100ms
```

**TypeScript:**
```typescript
updatePlayers(states: PlayerState[]): void {
  const currentIds = new Set(states.map(s => s.id));

  // Remove disconnected
  for (const id of this.players.keys()) {
    if (!currentIds.has(id)) {
      this.destroyPlayer(id);
    }
  }

  // Update or create
  for (const state of states) {
    if (!this.players.has(state.id)) {
      this.createPlayer(state.id, state.position);
    }

    const player = this.players.get(state.id)!;
    player.setPosition(state.position.x, state.position.y);
    player.setRotation(state.aimAngle ?? 0);

    const isMoving = Math.hypot(state.velocity.x, state.velocity.y) > 0.1;
    player.update(this.scene.game.loop.delta, isMoving);

    if (state.health !== undefined) {
      this.healthBars.get(state.id)?.setHealth(state.health);
    }

    if (state.deathTime !== undefined) {
      player.setColor(0x888888);
    } else {
      player.setColor(this.getPlayerColor(state.id));
    }

    if (state.isRolling) {
      const rollAngle = ((this._clock.now() % 400) / 400) * Math.PI * 2;
      player.setRotation(rollAngle);
      player.setVisible(this._clock.now() % 200 < 100); // Flicker
    } else if (state.deathTime === undefined) {
      player.setRotation(0);
      player.setVisible(true);
    }
  }
}
```

**Why:**
- Map-based storage for O(1) lookup by player ID
- Walk animation driven by velocity magnitude (natural movement feel)
- Gray color clearly indicates dead players
- Alpha reduction during roll shows invincibility window visually

---

#### ProceduralPlayerGraphics (`game/entities/ProceduralPlayerGraphics.ts`)

**Purpose:** Render a stick figure player using procedural Phaser graphics primitives.

**Rendering Composition:**
- **Head circle**: Color depends on player type — local player `COLORS.PLAYER_HEAD` / `#2A2A2A` (dark), enemy `COLORS.ENEMY_HEAD` / `#FF0000` (red), dead `COLORS.DEAD_HEAD` / `#888888` (gray)
- **Body/limbs** (torso, arms, legs): All drawn in black (`0x000000`) for all player types
- **"YOU" label**: White bold text ~14px with dark drop shadow, floats above local player head at `(player.x, player.y - headRadius - 5px)`, centered on X
- **Name labels**: Player display name in gray/white text ~12-14px above enemy heads at same offset, centered on X

**Why:**
- Head-only color distinction provides clear friend/foe identification at a glance
- Black body/limbs create consistent silhouette regardless of team
- "YOU" label eliminates confusion in crowded combat
- Name labels identify enemies without requiring additional UI

---

#### ProjectileManager

**Purpose:** Render and update projectiles in flight. Create muzzle flash effects.

**Internal Data:**
```typescript
projectiles: Map<string, {
  sprite: Phaser.GameObjects.Arc;
  tracer: Phaser.GameObjects.Line;
  velocity: { x: number; y: number };
}>
```

**Key Methods:**

**Pseudocode:**
```
function spawnProjectile(data: ProjectileData):
    config = getWeaponConfig(data.weaponType)

    // Bullet sprite (filled circle)
    sprite = scene.add.circle(data.position.x, data.position.y,
                               PROJECTILE_DIAMETER / 2, config.color)

    // Tracer line (fading)
    tracerEnd = data.position - normalize(data.velocity) * TRACER_LENGTH
    tracer = scene.add.line(0, 0,
                            data.position.x, data.position.y,
                            tracerEnd.x, tracerEnd.y,
                            config.tracerColor)
    tracer.setAlpha(0.7)

    // Fade tracer over 100ms
    scene.tweens.add({
        targets: tracer,
        alpha: 0,
        duration: TRACER_FADE_DURATION
    })

    projectiles.set(data.id, { sprite, tracer, velocity: data.velocity })

function update(delta):
    for each projectile in projectiles.values():
        // Move projectile
        projectile.sprite.x += projectile.velocity.x * delta / 1000
        projectile.sprite.y += projectile.velocity.y * delta / 1000

        // Update tracer position
        projectile.tracer.setTo(...)

        // Remove if out of bounds (client-side cleanup)
        if isOutOfBounds(projectile.sprite):
            removeProjectile(projectile.id)
```

**TypeScript:**
```typescript
spawnProjectile(data: ProjectileData): void {
  const config = getWeaponConfig(data.weaponType);

  const sprite = this.scene.add.circle(
    data.position.x, data.position.y,
    EFFECTS.PROJECTILE_DIAMETER / 2,
    config.projectileColor
  );

  const tracerEnd = {
    x: data.position.x - (data.velocity.x / Math.hypot(data.velocity.x, data.velocity.y)) * 20,
    y: data.position.y - (data.velocity.y / Math.hypot(data.velocity.x, data.velocity.y)) * 20
  };

  const tracer = this.scene.add.line(
    0, 0,
    data.position.x, data.position.y,
    tracerEnd.x, tracerEnd.y,
    config.tracerColor
  );
  tracer.setAlpha(0.7);

  this.scene.tweens.add({
    targets: tracer,
    alpha: 0,
    duration: EFFECTS.TRACER_FADE_DURATION
  });

  this.projectiles.set(data.id, { sprite, tracer, velocity: data.velocity });
}

update(delta: number): void {
  for (const [id, proj] of this.projectiles.entries()) {
    proj.sprite.x += proj.velocity.x * delta / 1000;
    proj.sprite.y += proj.velocity.y * delta / 1000;

    if (this.isOutOfBounds(proj.sprite)) {
      this.removeProjectile(id);
    }
  }
}
```

**Why:**
- Client-side movement for smooth visuals (server authoritative on hits)
- Tracer shows bullet path, enhancing visual feedback
- Tweened tracer fade prevents abrupt visual changes
- Bounds checking prevents infinite projectile accumulation

---

#### HitEffectManager

**Purpose:** Object pool for visual effects. Prevents garbage collection during combat.

**Pool Design:**
```typescript
interface PooledEffect {
  graphics: Phaser.GameObjects.Graphics;
  type: 'bullet' | 'melee' | 'muzzle';
  inUse: boolean;
}

pool: PooledEffect[]
```

**Pseudocode:**
```
function constructor(scene, poolSize):
    for i in 0..poolSize:
        graphics = scene.add.graphics()
        graphics.setVisible(false)
        pool.push({ graphics, type: null, inUse: false })

function getFromPool():
    // Find unused effect
    for effect in pool:
        if not effect.inUse:
            effect.inUse = true
            effect.graphics.setVisible(true)
            return effect

    // Pool exhausted - reuse oldest
    oldest = pool[0]
    return oldest

function returnToPool(effect):
    effect.graphics.setVisible(false)
    effect.graphics.clear()
    effect.inUse = false

function showBulletImpact(x, y):
    effect = getFromPool()
    effect.graphics.fillStyle(0xFFFF00)  // Yellow
    effect.graphics.fillRect(x - 2, y - 2, 4, 4)

    scene.tweens.add({
        targets: effect.graphics,
        alpha: 0,
        duration: 100,
        onComplete: () => returnToPool(effect)
    })
```

**TypeScript:**
```typescript
constructor(scene: Phaser.Scene, poolSize: number) {
  this.scene = scene;
  this.pool = [];

  for (let i = 0; i < poolSize; i++) {
    const graphics = scene.add.graphics();
    graphics.setVisible(false);
    this.pool.push({ graphics, type: null, inUse: false });
  }
}

showBulletImpact(x: number, y: number): void {
  const effect = this.getFromPool();
  effect.graphics.fillStyle(0xFFFF00);
  effect.graphics.fillRect(x - 2, y - 2, 4, 4);
  effect.graphics.setPosition(x, y);

  this.scene.tweens.add({
    targets: effect.graphics,
    alpha: { from: 1, to: 0 },
    duration: 100,
    onComplete: () => this.returnToPool(effect)
  });
}
```

**Why:**
- Pool size 20 handles 8-player combat with overlapping effects
- Pre-creation eliminates allocation during gameplay
- Reuse oldest prevents memory growth even under heavy load
- Simple procedural graphics (no particle system complexity)

---

#### DamageNumberManager (`game/effects/DamageNumberManager.ts`)

**Purpose:** Object pool for floating damage numbers displayed at victim world positions.

- Pool size: ~10 reusable text objects
- On `player:damaged`: display damage value as bold red text (`COLORS.DAMAGE_NUMBER` / `#FF4444`), ~24px
- Animation: tween float upward ~30px over ~1000ms while fading alpha 1.0 to 0
- Triggered for ALL players' damage events (not just local player)
- Depth: 60 (hit effects layer)

---

#### HitIndicatorManager (`game/effects/HitIndicatorManager.ts`)

**Purpose:** Render directional hit indicators pointing toward the damage source for the local player.

- On `player:damaged` where `victimId === localPlayerId`: show 2-4 red triangular chevrons (`COLORS.HIT_CHEVRON` / `#CC3333`)
- Chevrons point toward the attacker's last known position (from `PlayerManager.playerStates`)
- Animation: fade in 100ms, hold 300ms, fade out 200ms (~500ms total)
- Multiple incoming attacks stack indicators
- Position: near the local player sprite

---

#### BloodEffectManager (`game/effects/BloodEffectManager.ts`)

**Purpose:** Render blood particle effects at victim positions on damage.

- On `player:damaged` for any player: spawn ~5-8 small circular particles
- Color: `COLORS.BLOOD` / `#CC3333` (pink-red), particle size 3-5px
- Animation: splatter outward ~30-50px over 300ms, then fade
- Method: `showBloodEffect(x: number, y: number): void`

---

#### DamageFlashOverlay (`game/effects/DamageFlashOverlay.ts`)

**Purpose:** Full-viewport red flash overlay on taking damage (local player only).

- On `player:damaged` where `victimId === localPlayerId`
- Renders a full-viewport rectangle, color `COLORS.DAMAGE_FLASH` / `#FF0000`, alpha 0.3-0.4
- Animation: flash in immediately, tween alpha to 0 over ~300ms
- Depth: 999 (below fixed HUD at 1000+, above all gameplay)

---

#### PickupNotificationUI (`game/ui/PickupNotificationUI.ts`)

**Purpose:** Display confirmation text after picking up a weapon.

- On `weapon:pickup_confirmed`: show `"Picked up {WEAPON_NAME}"` in gray text
- Position: center screen, scroll-factor 0 (fixed to camera)
- Animation: fade out after ~2000ms
- Depth: 1000 (fixed UI layer)

---

#### MinimapUI (`game/ui/MinimapUI.ts`)

**Purpose:** Render a circular minimap showing player positions on the arena.

- Size: 170x170px with circular mask and teal/green outline border
- Background: `#3A3A3A` at 50% alpha
- Green dot = local player, red dots = enemies
- Position: top-left of viewport, screen-fixed (scroll factor 0)
- Depth: 1000 (fixed UI layer)

---

#### ScoreDisplayUI (`game/ui/ScoreDisplayUI.ts`)

**Purpose:** Display the player's score (XP) as a 6-digit zero-padded number.

- Format: `String(score).padStart(6, '0')` (e.g., `"000100"`)
- Font: monospaced, ~28px, white `COLORS.SCORE` / `#FFFFFF`
- Position: top-right corner, right-aligned, screen-fixed
- Updated on `player:kill_credit` (score = killerXP)
- Depth: 1000 (fixed UI layer)

---

#### KillCounterUI (`game/ui/KillCounterUI.ts`)

**Purpose:** Display persistent kill count below the score display.

- Format: `"KILLS: N"`
- Color: `COLORS.KILL_COUNTER` / `#FF6666` (red/pink)
- Font: ~16px, right-aligned
- Position: below ScoreDisplayUI, top-right, screen-fixed
- Incremented on `player:kill_credit` for local player
- Depth: 1000 (fixed UI layer)

---

#### DebugOverlayUI (`game/ui/DebugOverlayUI.ts`)

**Purpose:** Display performance metrics for development/debugging.

- Color: `COLORS.DEBUG_OVERLAY` / `#00FF00` (bright green), monospaced font, ~12px
- Lines: `FPS: N`, `Update: Nms`, `AI: Nms`, `E: N | B: N`
- Position: below minimap, left side, screen-fixed
- Controlled by a debug flag (not shown in production)
- Depth: 1000 (fixed UI layer)

---

#### ChatLogUI (`game/ui/ChatLogUI.ts`)

**Purpose:** Render a chat log panel for system and player messages.

- Dimensions: ~300x120px
- Position: bottom-left of viewport, screen-fixed (scroll factor 0)
- Background: `#808080` at 70% opacity
- System messages: `COLORS.CHAT_SYSTEM` / `#BBA840` (yellow), prefixed `[SYSTEM]`
- Player messages: name in red/orange, message text in white
- Font: sans-serif, 14px
- Max visible lines with scroll behavior
- Depth: 1000 (fixed UI layer)

---

### Input Handling

#### InputManager

**Purpose:** Capture WASD keyboard and mouse aim input.

**Pseudocode:**
```
function init():
    keys.W = scene.input.keyboard.addKey('W')
    keys.A = scene.input.keyboard.addKey('A')
    keys.S = scene.input.keyboard.addKey('S')
    keys.D = scene.input.keyboard.addKey('D')
    keys.SHIFT = scene.input.keyboard.addKey('SHIFT')

function update():
    // Calculate aim angle from mouse
    mouseWorldPos = camera.getWorldPoint(pointer.x, pointer.y)
    dx = mouseWorldPos.x - playerPosition.x
    dy = mouseWorldPos.y - playerPosition.y
    newAimAngle = atan2(dy, dx)

    // Build input state
    newState = {
        up: keys.W.isDown,
        down: keys.S.isDown,
        left: keys.A.isDown,
        right: keys.D.isDown,
        aimAngle: newAimAngle,
        isSprinting: keys.SHIFT.isDown
    }

    // Only send if changed (with threshold for aim)
    if hasChanged(newState, lastSentState, aimThreshold: 0.087):  // ~5°
        wsClient.send({ type: 'input:state', data: newState })
        lastSentState = newState
```

**TypeScript:**
```typescript
update(): void {
  const mouseWorldPos = this.scene.cameras.main.getWorldPoint(
    this.scene.input.x,
    this.scene.input.y
  );

  const dx = mouseWorldPos.x - this.playerPosition.x;
  const dy = mouseWorldPos.y - this.playerPosition.y;
  const newAimAngle = Math.atan2(dy, dx);

  const newState: InputState = {
    up: this.keys.W.isDown,
    down: this.keys.S.isDown,
    left: this.keys.A.isDown,
    right: this.keys.D.isDown,
    aimAngle: newAimAngle,
    isSprinting: this.keys.SHIFT.isDown
  };

  if (this.hasChanged(newState, this.lastSentState, 0.087)) {
    this.wsClient.send({
      type: 'input:state',
      timestamp: Date.now(),
      data: newState
    });
    this.lastSentState = newState;
  }
}
```

**Why:**
- Aim threshold (5°) prevents flooding server with tiny mouse movements
- World-space aim calculation accounts for camera position
- Input sent immediately on change for minimum latency
- Sprint state included for server-side accuracy penalty

---

#### ShootingManager

**Purpose:** Manage weapon fire, reload, and cooldowns.

**Pseudocode:**
```
// Separate methods for ranged and melee — NOT a single shoot() with isMelee check
function shoot():
    if not canShoot(): return
    lastShotTime = now()
    wsClient.send({ type: 'player:shoot', data: { aimAngle, clientTimestamp: now() } })

function meleeAttack():
    if not canMeleeAttack(): return
    lastMeleeTime = now()
    wsClient.send({ type: 'player:melee_attack', data: { aimAngle } })

function canShoot():
    if weaponState.isReloading: return false
    if weaponState.currentAmmo <= 0: return false
    cooldownMs = 1000 / weaponConfig.fireRate
    if now() - lastShotTime < cooldownMs: return false
    return true

function canMeleeAttack():
    meleeCooldown = MELEE_COOLDOWNS[weaponType]
    if now() - lastMeleeTime < meleeCooldown: return false
    return true

function updateWeaponState(state):
    weaponState = state
    cooldownMs = 1000 / getWeaponConfig(state.weaponType).fireRate

function isAutomatic():
    return weaponState.weaponType === 'uzi' ||
           weaponState.weaponType === 'ak47'
```

**TypeScript:**
```typescript
shoot(): boolean {
  if (!this.isEnabled || !this.canShoot()) return false;
  this.lastShotTime = this.clock.now();
  this.wsClient.send({
    type: 'player:shoot',
    timestamp: this.clock.now(),
    data: { aimAngle: this.aimAngle, clientTimestamp: this.clock.now() }
  });
  return true;
}

meleeAttack(): boolean {
  if (!this.isEnabled || !this.canMeleeAttack()) return false;
  this.lastMeleeTime = this.clock.now();
  this.wsClient.send({
    type: 'player:melee_attack',
    timestamp: this.clock.now(),
    data: { aimAngle: this.aimAngle }
  });
  return true;
}

canShoot(): boolean {
  if (this.weaponState.isReloading) return false;
  if (this.weaponState.currentAmmo <= 0) return false;

  const config = getWeaponConfig(this.weaponState.weaponType);
  const cooldownMs = 1000 / config.fireRate;
  if (Date.now() - this.lastShotTime < cooldownMs) return false;

  return true;
}
```

**Why:**
- Client-side cooldown prevents spamming server with invalid requests
- Server is still authoritative (validates and may reject)
- Automatic weapon detection enables hold-to-fire behavior
- Weapon config lookup allows dynamic fire rate

---

#### DodgeRollManager

**Purpose:** Track dodge roll state and cooldown.

**Constants:**
- Roll duration: 400ms
- Invincibility frames: 200ms (first half)
- Cooldown: 3000ms

**Pseudocode:**
```
function canDodgeRoll():
    if isRolling: return false
    if now() - lastRollEndTime < COOLDOWN: return false
    return true

function startRoll():
    isRolling = true
    rollStartTime = now()

function endRoll():
    isRolling = false
    lastRollEndTime = now()

function getCooldownProgress():
    if isRolling: return 0
    elapsed = now() - lastRollEndTime
    return min(1, elapsed / COOLDOWN)

function isInInvincibilityFrames():
    if not isRolling: return false
    return now() - rollStartTime < INVINCIBILITY_DURATION
```

**TypeScript:**
```typescript
canDodgeRoll(): boolean {
  if (this.isRolling) return false;
  if (Date.now() - this.lastRollEndTime < ROLL_COOLDOWN) return false;
  return true;
}

getCooldownProgress(): number {
  if (this.isRolling) return 0;
  const elapsed = Date.now() - this.lastRollEndTime;
  return Math.min(1, elapsed / ROLL_COOLDOWN);
}
```

**Why:**
- Server triggers roll:start/roll:end, not client input
- Client tracks for UI (cooldown indicator)
- Invincibility frame tracking for visual feedback

---

### Network Integration

#### WebSocketClient

**Purpose:** WebSocket connection wrapper with event dispatch.

**Pseudocode:**
```
function connect():
    return new Promise((resolve, reject) => {
        ws = new WebSocket(SERVER_URL)

        ws.onopen = () => {
            isConnected = true
            resolve()
        }

        ws.onmessage = (event) => {
            message = JSON.parse(event.data)
            handlers = eventHandlers.get(message.type)
            for handler in handlers:
                handler(message.data)

        ws.onclose = () => {
            isConnected = false
            if shouldReconnect:
                attemptReconnect()

        ws.onerror = (error) => {
            reject(error)
    })

function send(message):
    if not isConnected: return
    ws.send(JSON.stringify(message))

function on(type, handler):
    if not eventHandlers.has(type):
        eventHandlers.set(type, [])
    eventHandlers.get(type).push(handler)

function off(type, handler):
    handlers = eventHandlers.get(type)
    index = handlers.indexOf(handler)
    if index >= 0:
        handlers.splice(index, 1)
```

**TypeScript:**
```typescript
connect(): Promise<void> {
  return new Promise((resolve, reject) => {
    this.ws = new WebSocket(this.serverUrl);

    this.ws.onopen = () => {
      this.isConnected = true;
      resolve();
    };

    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      const handlers = this.eventHandlers.get(message.type) ?? [];
      for (const handler of handlers) {
        handler(message.data);
      }
    };

    this.ws.onclose = () => {
      this.isConnected = false;
      if (this.shouldReconnect) {
        this.attemptReconnect();
      }
    };
  });
}
```

**Why:**
- Event-based dispatch allows multiple handlers per message type
- Promise-based connect enables async/await usage
- shouldReconnect flag prevents reconnect on intentional disconnect
- JSON parsing in one place prevents duplicate code

---

#### GameSceneEventHandlers

**Purpose:** Register handlers for all server messages.

**Handler Map:**
```typescript
handlerRefs: Map<string, (data: unknown) => void>
```

**Pseudocode:**
```
function setupEventHandlers():
    // Clear old handlers first (scene restart safety)
    cleanupHandlers()

    // Room events
    registerHandler('room:joined', (data) => {
        localPlayerId = data.playerId
        processPendingMessages()
    })

    // Player movement (20 Hz)
    registerHandler('player:move', (data) => {
        if localPlayerId is null:
            pendingPlayerMoves.push(data)
            return
        playerManager.updatePlayers(data.players)
    })

    // Combat events
    registerHandler('projectile:spawn', (data) => {
        projectileManager.spawnProjectile(data)
        if data.ownerId === localPlayerId:
            screenShake.shakeOnWeaponFire()
            audioManager.playWeaponSound(data.weaponType)
    })

    // ... 13 more message types

function registerHandler(type, handler):
    handlerRefs.set(type, handler)
    wsClient.on(type, handler)

function cleanupHandlers():
    for [type, handler] of handlerRefs:
        wsClient.off(type, handler)
    handlerRefs.clear()
```

**TypeScript:**
```typescript
setupEventHandlers(): void {
  this.cleanupHandlers();

  this.registerHandler('room:joined', (data: RoomJoinedData) => {
    this.scene.localPlayerId = data.playerId;
    this.processPendingMessages();
  });

  this.registerHandler('player:move', (data: PlayerMoveData) => {
    if (!this.scene.localPlayerId) {
      this.pendingPlayerMoves.push(data);
      return;
    }
    this.playerManager.updatePlayers(data.players);
  });

  // ... more handlers
}
```

**Why:**
- Handler cleanup prevents accumulation across scene restarts
- Pending queues handle race condition where messages arrive before room:joined
- All handlers in one file for easy maintenance
- TypeScript types ensure correct data access

---

### Client-Side Prediction & Interpolation (Epic 4)

These subsystems were added during Epic 4 to improve multiplayer responsiveness.

#### PredictionEngine (`game/physics/PredictionEngine.ts`)

**Purpose:** Predict local player position before server confirmation for instant-feeling controls.

- Mirrors server physics exactly: same acceleration/deceleration math
- Takes position, velocity, input, and deltaTime; returns predicted position/velocity
- Used by `GameScene.update()` each frame for local player
- `reconcile()` method replays unprocessed inputs on top of server state
- Correction threshold: 100px instant teleport, otherwise smooth lerp

See [movement.md](movement.md#client-side-prediction) for the full algorithm.

#### InterpolationEngine (`game/physics/InterpolationEngine.ts`)

**Purpose:** Smooth 20 Hz server updates to 60 FPS for remote players.

- Buffers last 10 position snapshots per player
- Renders at `currentTime - 100ms` (2 server updates behind)
- Linear interpolation between bracketing snapshots
- Extrapolates up to 100ms on packet loss, then freezes at 200ms
- Used by `PlayerManager.update()` each frame for non-local players

See [movement.md](movement.md#interpolation-other-players) for configuration details.

#### GameSimulation (`game/simulation/GameSimulation.ts`)

**Purpose:** Pure-logic game simulation without Phaser dependencies. Enables fast deterministic testing.

- Mirrors server-side `GameServer` pattern
- Uses `physics.ts` for pure math functions (normalize, accelerateToward, clampToArena)
- `types.ts` defines simulation-only types (SimulatedPlayerState, Projectile, HitEvent, etc.)
- `InputRecorder.ts` and `ScenarioRunner.ts` enable replay-based testing

#### NetworkSimulator (`game/network/NetworkSimulator.ts`)

**Purpose:** Artificial latency and packet loss for testing netcode under degraded conditions.

- Wraps send/receive with configurable delay and random drops
- Latency: 0–300ms base + ±20ms jitter
- Packet loss: 0–20%
- Controlled via `DebugNetworkPanel` (React UI) at `src/ui/debug/DebugNetworkPanel.tsx`

See [networking.md](networking.md#network-simulator) for server-side counterpart.

---

### React-Phaser Bridge

#### PhaserGame Component

**Purpose:** Mount Phaser game instance, enable React ↔ Phaser communication.

**Pseudocode:**
```
function PhaserGame({ onMatchEnd }):
    gameRef = useRef(null)

    useEffect(() => {
        if gameRef.current is null:
            gameRef.current = new Phaser.Game(GameConfig)

            // Phaser → React: match end callback
            window.onMatchEnd = onMatchEnd

            // React → Phaser: restart game
            window.restartGame = () => {
                scene = gameRef.current.scene.getScene('GameScene')
                scene.restart()
            }

        return () => {
            gameRef.current?.destroy()
            delete window.onMatchEnd
            delete window.restartGame
        }
    }, [onMatchEnd])

    return <div id="game-container" />
```

**TypeScript:**
```typescript
const PhaserGame: React.FC<{ onMatchEnd: (data: MatchEndData, playerId: string) => void }> = ({ onMatchEnd }) => {
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    if (!gameRef.current) {
      gameRef.current = new Phaser.Game(GameConfig);

      (window as any).onMatchEnd = onMatchEnd;
      (window as any).restartGame = () => {
        const scene = gameRef.current!.scene.getScene('GameScene') as GameScene;
        scene.scene.restart();
      };
    }

    return () => {
      gameRef.current?.destroy(true);
      delete (window as any).onMatchEnd;
      delete (window as any).restartGame;
    };
  }, [onMatchEnd]);

  return <div id="game-container" />;
};
```

**Why:**
- useRef prevents Phaser recreation on React re-renders
- Global window functions avoid tight coupling
- Cleanup prevents memory leaks and stale callbacks
- "game-container" div matches GameConfig.parent

---

### GameSceneSpectator (`game/scenes/GameSceneSpectator.ts`)

**Purpose:** Render the per-death overlay when the local player dies. Distinct from `MatchEndScreen` (React modal for `match:ended`).

**Trigger:** `player:death` where `victimId === localPlayerId`

**Layout:**
- Full-screen semi-transparent black rectangle (depth 990, 70% alpha)
- **"YOU DIED"** text: ~72px bold white, centered horizontally
- **Stats row** (centered below "YOU DIED"):
  - Trophy icon (yellow/gold) + score value (red) — score = killerXP, formatted as 6-digit zero-padded
  - Skull icon (red) + kill count (white)
- **"TRY AGAIN" button**: rectangular, thin white border, white text, centered below stats row

**Respawn Flow:**
- The server auto-respawns the player after `RESPAWN_DELAY` (3s) via `player:respawn`
- The "TRY AGAIN" button sends `player:respawn_request` to the server as user intent
- On receiving `player:respawn`, the overlay is dismissed and normal gameplay resumes

**Why:**
- Per-death overlay provides immediate feedback and brief pause after death
- Separate from `MatchEndScreen` which only appears on `match:ended`
- Depth 990 ensures visibility above game world but below fixed HUD elements

---

### Rendering Pipeline

**Frame Order (60 FPS, ~16ms per frame):**

```
┌─────────────────────────────────────────────────────────────┐
│ Frame Start                                                  │
├─────────────────────────────────────────────────────────────┤
│ 1. Input Processing                                          │
│    ├─ InputManager.update() - Read WASD + mouse              │
│    ├─ Calculate aim angle from mouse position                │
│    └─ Send input:state to server (if changed)                │
├─────────────────────────────────────────────────────────────┤
│ 2. Client-Side Prediction (local player)                      │
│    ├─ PredictionEngine.predictPosition(pos, vel, input, dt)  │
│    ├─ PlayerManager.setLocalPlayerPredictedPosition()        │
│    ├─ PlayerManager.updateLocalPlayerAim() - Rotate weapon   │
│    └─ Crosshair.update() - Follow mouse                      │
├─────────────────────────────────────────────────────────────┤
│ 3. Automatic Fire Check                                      │
│    └─ If Uzi/AK47 + pointer down → ShootingManager.shoot()   │
├─────────────────────────────────────────────────────────────┤
│ 4. Proximity Checks                                          │
│    └─ checkWeaponProximity() → Show/hide pickup prompt       │
├─────────────────────────────────────────────────────────────┤
│ 5. Interpolation + Manager Updates                            │
│    ├─ PlayerManager.update(delta) - Interpolate remote players│
│    ├─ DodgeRollManager.update(delta) - Cooldown tracking     │
│    ├─ ProjectileManager.update(delta) - Move projectiles     │
│    └─ MeleeWeaponManager.update(delta) - Animate swings      │
├─────────────────────────────────────────────────────────────┤
│ 6. UI Updates                                                │
│    ├─ Reload progress bar (if reloading)                     │
│    ├─ Crosshair spread (based on weapon + movement)          │
│    └─ Cooldown indicator (dodge roll)                        │
├─────────────────────────────────────────────────────────────┤
│ 7. Camera (handled by Phaser startFollow, not per-frame)     │
│    └─ Set once via startCameraFollowIfNeeded() (0.1 lerp)    │
├─────────────────────────────────────────────────────────────┤
│ 8. Phaser Render                                             │
│    └─ WebGL/Canvas draw all visible objects                  │
└─────────────────────────────────────────────────────────────┘

Async WebSocket Messages (any time):
┌─────────────────────────────────────────────────────────────┐
│ On 'state:snapshot' / 'state:delta' (20 Hz from server)      │
│    ├─ InterpolationEngine.addSnapshot() - Buffer remote pos  │
│    ├─ PredictionEngine.reconcile() - Replay pending inputs   │
│    └─ PlayerManager.updatePlayers() - Sync all positions     │
├─────────────────────────────────────────────────────────────┤
│ On 'projectile:spawn'                                        │
│    ├─ ProjectileManager.spawnProjectile()                    │
│    ├─ HitEffectManager.showMuzzleFlash()                     │
│    └─ AudioManager.playWeaponSound()                         │
├─────────────────────────────────────────────────────────────┤
│ On 'player:damaged'                                          │
│    ├─ Update health bar                                      │
│    ├─ Show damage number                                     │
│    └─ HitEffectManager.showBulletImpact()                    │
└─────────────────────────────────────────────────────────────┘
```

**Why This Order:**
1. Input first minimizes perceived latency
2. Local visual updates before server response for immediate feedback
3. Managers update in dependency order (dodge affects projectile)
4. Camera follow is automatic via Phaser's `startFollow` (set once, not per-frame)
5. Async messages can update at any point in frame

---

### renderArena()

Called once in `create()`. Fills the arena background and draws the floor grid.

- Background: fill full arena (1920x1080) with `COLORS.BACKGROUND` / `#C8CCC8` (light gray)
- Grid lines: draw using `scene.add.grid()` or manual `Graphics.lineTo()` with `COLORS.GRID_LINE` / `#D8DCD8` at cell size 64x64px
- Grid covers full arena dimensions
- Depth: 0 (background layer)

---

### Spawn Ring and Death Ragdoll Rendering

#### Spawn Invulnerability Ring

When `PlayerStateSnapshot.isInvulnerable === true`, draw a yellow ring (`COLORS.SPAWN_RING` / `#FFFF00`, ~50px diameter circle outline) around the player sprite. Remove the ring when invulnerability expires (i.e., `isInvulnerable` becomes `false`). Applied to both local and remote players.

#### Death Ragdoll

On `player:death`:
1. Transition stick figure to ragdoll X-pose (limbs spread at ~45 degrees)
2. Change head color to `COLORS.DEAD_HEAD` / `#888888` (gray)
3. Corpse persists for 5 seconds
4. After 5 seconds, tween alpha from 1 to 0 over 1 second, then destroy the graphics object

---

### Depth Layering

```
Depth 1000+: Fixed UI (reload bar, match timer, health display, minimap, score, kills, debug, chat)
Depth 999:   Damage flash overlay (below fixed HUD, above all gameplay)
Depth 100:   HUD elements (kill feed, pickup prompt)
Depth 60:    Hit effects (particles, impact markers, damage numbers)
Depth 50:    Players, weapons, projectiles
Depth 40:    Aim line (below players)
Depth 0:     Background, arena floor, grid
```

**Why:**
- Higher depth renders on top
- Fixed UI always visible above gameplay
- Hit effects briefly visible above players
- Consistent layering across all scenes

---

## Error Handling

### Connection Errors

**Trigger:** WebSocket fails to connect or loses connection
**Detection:** ws.onerror or ws.onclose events
**Response:** Attempt reconnect (3 attempts, 1s delay)
**Client Notification:** "Reconnecting... (attempt X/3)" UI
**Recovery:** Full scene restart on successful reconnect

### Invalid Server Message

**Trigger:** JSON parse error or unknown message type
**Detection:** try/catch around JSON.parse, missing handler
**Response:** Log warning, ignore message
**Client Notification:** None (silent recovery)
**Recovery:** Continue processing other messages

### Manager Initialization Failure

**Trigger:** Scene not ready when creating manager
**Detection:** undefined scene or missing dependencies
**Response:** Throw error, prevent game start
**Client Notification:** Error screen
**Recovery:** Refresh page

### Pending Message Overflow

**Trigger:** Too many messages before room:joined
**Detection:** pendingQueue.length > 10
**Response:** Drop oldest messages (FIFO)
**Client Notification:** None
**Recovery:** Fresh state from next player:move

---

## Implementation Notes

### TypeScript (Client)

1. **Strict Mode:** Enable `strict: true` in tsconfig for type safety
2. **Event Types:** Use discriminated unions for message types
3. **Manager Interfaces:** Define interfaces for all managers (enables mocking)
4. **Cleanup Pattern:** All managers implement `destroy()` method
5. **Constants Import:** `import { ARENA, MOVEMENT } from '@/shared/constants'`

### Testing Strategy

1. **Unit Tests:** Each manager tested in isolation with mocked dependencies
2. **Integration Tests:** Full scene lifecycle with real WebSocket

---

## Test Scenarios

### TS-CLIENT-001: Scene Creates All Managers

**Category:** Unit
**Priority:** Critical

**Preconditions:**
- GameScene instantiated

**Input:**
- Call scene.create()

**Expected Output:**
- All 5 entity managers created (PlayerManager, ProjectileManager, WeaponCrateManager, MeleeWeaponManager, HitEffectManager)
- All 4 UI components created
- WebSocket client created

**TypeScript (Vitest):**
```typescript
it('should create all managers in create()', () => {
  const scene = new GameScene();
  scene.create();

  expect(scene.playerManager).toBeDefined();
  expect(scene.projectileManager).toBeDefined();
  expect(scene.weaponCrateManager).toBeDefined();
  expect(scene.meleeWeaponManager).toBeDefined();
  expect(scene.hitEffectManager).toBeDefined();
});
```

---

### TS-CLIENT-002: Input Polled Every Frame

**Category:** Unit
**Priority:** High

**Preconditions:**
- InputManager initialized
- WASD keys registered

**Input:**
- Press W key, call update()

**Expected Output:**
- InputState.up === true
- input:state message sent to server

**TypeScript (Vitest):**
```typescript
it('should poll input every frame', () => {
  inputManager.keys.W.isDown = true;
  inputManager.update();

  expect(mockWsClient.send).toHaveBeenCalledWith(
    expect.objectContaining({
      type: 'input:state',
      data: expect.objectContaining({ up: true })
    })
  );
});
```

---

### TS-CLIENT-003: Input Rate Limited to 20 Hz

**Category:** Unit
**Priority:** High

**Preconditions:**
- InputManager initialized

**Input:**
- Call update() 60 times with same state

**Expected Output:**
- input:state sent only once (state unchanged)

**TypeScript (Vitest):**
```typescript
it('should not send duplicate input states', () => {
  for (let i = 0; i < 60; i++) {
    inputManager.update();
  }

  expect(mockWsClient.send).toHaveBeenCalledTimes(1);
});
```

---

### TS-CLIENT-004: Server Messages Processed

**Category:** Integration
**Priority:** Critical

**Preconditions:**
- GameScene running
- WebSocket connected

**Input:**
- Server sends player:move message

**Expected Output:**
- PlayerManager.updatePlayers() called
- Player sprites positioned correctly

**TypeScript (Vitest):**
```typescript
it('should process player:move message', async () => {
  const moveData = {
    players: [{ id: 'p1', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 } }]
  };

  wsClient.emit('player:move', moveData);

  expect(playerManager.players.get('p1')?.x).toBe(100);
  expect(playerManager.players.get('p1')?.y).toBe(200);
});
```

---

### TS-CLIENT-005: Entities Render Correctly

**Category:** Visual
**Priority:** High

**Preconditions:**
- GameScene running
- Player spawned

**Input:**
- Capture screenshot

**Expected Output:**
- Stick figure visible at correct position
- Health bar above head
- Weapon attached to player

**Test Method:**
- Visual regression test with Playwright
- Compare against baseline screenshot

---

### TS-CLIENT-006: Scene Cleanup Releases Resources

**Category:** Unit
**Priority:** High

**Preconditions:**
- GameScene running with players and projectiles

**Input:**
- Call scene.cleanup()

**Expected Output:**
- All managers destroyed
- Event handlers removed
- WebSocket disconnected

**TypeScript (Vitest):**
```typescript
it('should cleanup all resources', () => {
  scene.cleanup();

  expect(scene.playerManager.players.size).toBe(0);
  expect(eventHandlers.handlerRefs.size).toBe(0);
  expect(wsClient.isConnected).toBe(false);
});
```

---

### TS-CLIENT-007: WebSocket Connected on Create

**Category:** Integration
**Priority:** Critical

**Preconditions:**
- Server running on port 8080

**Input:**
- Call scene.create()
- Wait 100ms

**Expected Output:**
- WebSocket connected
- room:joined handler registered

**TypeScript (Vitest):**
```typescript
it('should connect WebSocket on create', async () => {
  scene.create();
  await new Promise(resolve => setTimeout(resolve, 150));

  expect(scene.wsClient.isConnected).toBe(true);
});
```

---

### TS-CLIENT-008: WebSocket Disconnected on Destroy

**Category:** Unit
**Priority:** High

**Preconditions:**
- Scene running with active WebSocket

**Input:**
- Call scene.cleanup()

**Expected Output:**
- WebSocket disconnected
- No reconnect attempted

**TypeScript (Vitest):**
```typescript
it('should disconnect WebSocket on cleanup', () => {
  scene.cleanup();

  expect(wsClient.disconnect).toHaveBeenCalled();
  expect(wsClient.shouldReconnect).toBe(false);
});
```

---

### TS-CLIENT-009: Object Pool Prevents GC

**Category:** Unit
**Priority:** Medium

**Preconditions:**
- HitEffectManager with pool size 20

**Input:**
- Call showBulletImpact() 30 times rapidly

**Expected Output:**
- No new graphics objects created after pool exhausted
- Oldest effects reused

**TypeScript (Vitest):**
```typescript
it('should reuse pooled effects', () => {
  const initialCount = hitEffectManager.pool.length;

  for (let i = 0; i < 30; i++) {
    hitEffectManager.showBulletImpact(100, 100);
  }

  expect(hitEffectManager.pool.length).toBe(initialCount);
});
```

---

### TS-CLIENT-010: Camera Follows Local Player

**Category:** Unit
**Priority:** Medium

**Preconditions:**
- Local player identified
- Player at position (500, 500)

**Input:**
- Trigger `startCameraFollowIfNeeded()` callback (e.g., first player:move received)

**Expected Output:**
- `cameras.main.startFollow()` called with local player sprite
- Lerp factors: 0.1 horizontal, 0.1 vertical
- Camera tracks player automatically via Phaser engine

**TypeScript (Vitest):**
```typescript
it('should follow local player with camera', () => {
  playerManager.setLocalPlayerId('local');
  playerManager.updatePlayers([{ id: 'local', position: { x: 500, y: 500 } }]);

  // Camera follow is set once via startCameraFollowIfNeeded(), not per update()
  scene.startCameraFollowIfNeeded();

  const camera = scene.cameras.main;
  expect(camera.scrollX).toBeCloseTo(500 - camera.width / 2, 1);
});
```

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-02-02 | Initial specification |
| 1.1.0 | 2026-02-15 | Added new directories: physics/, simulation/, ui/debug/. Added subsystem descriptions: PredictionEngine, InterpolationEngine, GameSimulation, NetworkSimulator, DebugNetworkPanel. Updated directory tree with new files (RangedWeapon.ts, MeleeWeapon.ts, GameSceneSpectator.ts, urlParams.ts). Updated rendering pipeline with prediction/interpolation steps. Updated async message flow for state:snapshot/state:delta. |
| 1.1.1 | 2026-02-16 | Fixed dodge roll visual — uses `setRotation` (360deg spin) + `setVisible` flicker (not `setAlpha(0.5)`) per `PlayerManager.ts:264-278`. |
| 1.1.5 | 2026-02-16 | Fixed update() pseudocode — `dodgeRollManager.update()` and `meleeWeaponManager.update()` take no params |
| 1.1.4 | 2026-02-16 | Fixed camera follow — uses `startFollow()` set once (not per-frame lerp in update). Removed `followLocalPlayer()` from update loop. |
| 1.1.3 | 2026-02-16 | Fixed directory tree — removed nonexistent MatchTimer.ts, added xpCalculator.ts to utils/ |
| 1.1.2 | 2026-02-16 | Fixed ShootingManager — separate `shoot()` and `meleeAttack()` methods (not single `shoot()` checking `isMelee`). Added `clientTimestamp` to shoot data. |
