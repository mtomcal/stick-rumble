---
date: 2026-01-12T12:00:00-08:00
researcher: Claude
topic: "Headless Testing Strategies for Phaser.js Games"
tags: [research, testing, phaser, simulation, tdd, game-development]
status: complete
---

# Research: Headless Testing Strategies for Phaser.js Games

**Date**: 2026-01-12
**Researcher**: Claude

## Research Question
Find strategies for running scripted simulations of game behavior and asserting correctness headlessly, without relying on slow browser automation tools like Playwright/Puppeteer with LLM control.

## Summary

The key insight is that **fast, deterministic game testing requires separating game logic from rendering**. Your codebase already demonstrates excellent patterns for this, particularly on the server side with the injectable `Clock` interface and `simulateTick()` helper. The client can adopt similar patterns by extracting logic into testable "simulation" layers.

**Five main strategies identified:**

1. **Logic-First Architecture** - Separate game logic from Phaser rendering (you already do this well)
2. **Deterministic Simulation Testing** - Use injectable time and run simulations at "instant speed"
3. **Event-Driven Scenario Testing** - Script sequences of inputs and assert expected events/state
4. **Headless Phaser Mode** - Use `Phaser.HEADLESS` renderer for canvas-free unit tests
5. **Property-Based/Fuzz Testing** - Generate random input sequences and assert invariants

## Detailed Findings

### 1. Your Existing Excellent Patterns

Your codebase already has **production-ready patterns** for fast testing:

#### Server-Side: Injectable Clock Pattern
**File**: `stick-rumble-server/internal/game/clock.go:1-79`

```go
type Clock interface {
    Now() time.Time
    Since(t time.Time) time.Duration
}

type ManualClock struct {
    currentTime time.Time
    mu          sync.RWMutex
}

func (mc *ManualClock) Advance(d time.Duration) {
    mc.mu.Lock()
    defer mc.mu.Unlock()
    mc.currentTime = mc.currentTime.Add(d)
}
```

#### Server-Side: Instant Tick Simulation
**File**: `stick-rumble-server/internal/game/gameserver_tick_test.go:12-32`

```go
func simulateTick(gs *GameServer, clock *ManualClock, deltaTime time.Duration) {
    clock.Advance(deltaTime)
    gs.updateAllPlayers(deltaTime.Seconds())
    gs.projectileManager.Update(deltaTime.Seconds())
    gs.checkHitDetection()
    gs.checkReloads()
    gs.checkRespawns()
    gs.updateInvulnerability()
    gs.updateHealthRegeneration(deltaTime.Seconds())
    gs.checkWeaponRespawns()
}

func simulateTicks(gs *GameServer, clock *ManualClock, count int, tickRate time.Duration) {
    for i := 0; i < count; i++ {
        simulateTick(gs, clock, tickRate)
    }
}
```

This allows tests like simulating 5+ seconds of gameplay **instantly**:
```go
// Simulate 5 seconds at 60Hz = 300 ticks, runs in milliseconds
simulateTicks(gs, clock, 300, time.Duration(ServerTickInterval)*time.Millisecond)
```

#### Client-Side: Manager Isolation
Your managers are already decoupled from Phaser rendering:

**File**: `stick-rumble-client/src/game/input/InputManager.ts:21-43`
- Pure state management (`InputState` interface)
- Only touches Phaser for keyboard polling
- `getState()` returns copyable state snapshots

**File**: `stick-rumble-client/src/game/entities/PlayerManager.ts:29-35`
- State stored in plain `Map<string, PlayerState>`
- Rendering is separate from state updates
- `getLivingPlayers()`, `getPlayerPosition()` return pure data

---

### 2. Strategy: Simulation Layer Pattern

**Recommended Architecture:**

```
┌─────────────────────────────────────────────────────────────┐
│                    Game Logic Layer (Testable)               │
│  ┌──────────────┐  ┌────────────────┐  ┌─────────────────┐  │
│  │ GameState    │  │ InputProcessor │  │ PhysicsEngine   │  │
│  │ (pure data)  │  │ (state machine)│  │ (math only)     │  │
│  └──────────────┘  └────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  Rendering Layer (Not Tested)                │
│  ┌──────────────┐  ┌────────────────┐  ┌─────────────────┐  │
│  │ PlayerSprite │  │ EffectsManager │  │ UIComponents    │  │
│  └──────────────┘  └────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**Create a `GameSimulation` class that mirrors the server's `GameServer`:**

```typescript
// stick-rumble-client/src/game/simulation/GameSimulation.ts
export interface Clock {
  now(): number;
  advance(ms: number): void;
}

export class RealClock implements Clock {
  now(): number { return Date.now(); }
  advance(_ms: number): void { /* no-op in real time */ }
}

export class ManualClock implements Clock {
  private time = 0;
  now(): number { return this.time; }
  advance(ms: number): void { this.time += ms; }
}

export class GameSimulation {
  private players: Map<string, PlayerState> = new Map();
  private projectiles: Projectile[] = [];
  private clock: Clock;

  constructor(clock: Clock = new RealClock()) {
    this.clock = clock;
  }

  addPlayer(id: string, position: Vector2): void { /* ... */ }

  updateInput(playerId: string, input: InputState): void { /* ... */ }

  tick(deltaMs: number): void {
    // Pure logic: update positions, check collisions, etc.
    for (const [id, player] of this.players) {
      this.updatePlayerPhysics(player, deltaMs / 1000);
    }
    this.updateProjectiles(deltaMs / 1000);
    this.checkCollisions();
  }

  // Pure math, no Phaser
  private updatePlayerPhysics(player: PlayerState, dt: number): void {
    const input = player.input;
    let dx = 0, dy = 0;
    if (input.left) dx -= 1;
    if (input.right) dx += 1;
    if (input.up) dy -= 1;
    if (input.down) dy += 1;

    // Normalize diagonal movement
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > 0) {
      dx /= len;
      dy /= len;
    }

    player.velocity.x = this.accelerateToward(player.velocity.x, dx * MOVEMENT_SPEED, ACCELERATION, dt);
    player.velocity.y = this.accelerateToward(player.velocity.y, dy * MOVEMENT_SPEED, ACCELERATION, dt);

    player.position.x += player.velocity.x * dt;
    player.position.y += player.velocity.y * dt;

    // Clamp to arena
    player.position.x = Math.max(0, Math.min(ARENA.WIDTH, player.position.x));
    player.position.y = Math.max(0, Math.min(ARENA.HEIGHT, player.position.y));
  }

  getPlayerState(id: string): PlayerState | undefined { return this.players.get(id); }
  getAllPlayers(): PlayerState[] { return [...this.players.values()]; }
}
```

**Test Example:**

```typescript
describe('GameSimulation', () => {
  it('should move player right when right key is pressed', () => {
    const clock = new ManualClock();
    const sim = new GameSimulation(clock);

    sim.addPlayer('p1', { x: 500, y: 500 });
    sim.updateInput('p1', { up: false, down: false, left: false, right: true, aimAngle: 0 });

    // Simulate 1 second at 60 FPS (60 ticks)
    for (let i = 0; i < 60; i++) {
      sim.tick(16.67);
      clock.advance(16.67);
    }

    const state = sim.getPlayerState('p1')!;
    expect(state.position.x).toBeGreaterThan(500);
    expect(state.velocity.x).toBeGreaterThan(0);
  });

  it('should detect projectile-player collision', () => {
    const clock = new ManualClock();
    const sim = new GameSimulation(clock);

    sim.addPlayer('attacker', { x: 100, y: 500 });
    sim.addPlayer('victim', { x: 200, y: 500 });

    const hitEvents: HitEvent[] = [];
    sim.onHit((event) => hitEvents.push(event));

    // Attacker shoots at victim (aimAngle = 0 = right)
    sim.playerShoot('attacker', 0);

    // Simulate until projectile reaches victim (~100px at 800px/s = 125ms)
    for (let i = 0; i < 10; i++) {
      sim.tick(16.67);
      clock.advance(16.67);
    }

    expect(hitEvents.length).toBe(1);
    expect(hitEvents[0].victimId).toBe('victim');
    expect(hitEvents[0].attackerId).toBe('attacker');
  });
});
```

---

### 3. Strategy: Scenario/Replay Testing

**Record input sequences and replay them deterministically:**

```typescript
// stick-rumble-client/src/game/simulation/ScenarioRunner.ts
interface InputFrame {
  tick: number;
  playerId: string;
  input: InputState;
}

interface Scenario {
  name: string;
  players: { id: string; startPosition: Vector2 }[];
  inputs: InputFrame[];
  duration: number; // ticks
}

interface Assertion {
  tick: number;
  check: (sim: GameSimulation) => boolean;
  description: string;
}

class ScenarioRunner {
  run(scenario: Scenario, assertions: Assertion[]): TestResult[] {
    const clock = new ManualClock();
    const sim = new GameSimulation(clock);

    // Setup
    for (const p of scenario.players) {
      sim.addPlayer(p.id, p.startPosition);
    }

    const results: TestResult[] = [];
    const inputsByTick = groupBy(scenario.inputs, 'tick');

    // Run simulation
    for (let tick = 0; tick < scenario.duration; tick++) {
      // Apply inputs for this tick
      const frameInputs = inputsByTick.get(tick) ?? [];
      for (const input of frameInputs) {
        sim.updateInput(input.playerId, input.input);
      }

      // Advance simulation
      sim.tick(16.67);
      clock.advance(16.67);

      // Check assertions
      for (const assertion of assertions.filter(a => a.tick === tick)) {
        results.push({
          description: assertion.description,
          passed: assertion.check(sim),
          tick,
        });
      }
    }

    return results;
  }
}
```

**Usage in tests:**

```typescript
describe('Combat Scenarios', () => {
  it('two players face-off: first shooter wins', () => {
    const scenario: Scenario = {
      name: 'face-off',
      players: [
        { id: 'p1', startPosition: { x: 100, y: 500 } },
        { id: 'p2', startPosition: { x: 200, y: 500 } },
      ],
      inputs: [
        // P1 shoots first at tick 10
        { tick: 10, playerId: 'p1', input: { ...neutral, shoot: true, aimAngle: 0 } },
        // P2 shoots at tick 15 (too late)
        { tick: 15, playerId: 'p2', input: { ...neutral, shoot: true, aimAngle: Math.PI } },
      ],
      duration: 100,
    };

    const assertions: Assertion[] = [
      {
        tick: 50,
        description: 'P2 should have taken damage',
        check: (sim) => sim.getPlayerState('p2')!.health < 100,
      },
    ];

    const results = new ScenarioRunner().run(scenario, assertions);
    expect(results.every(r => r.passed)).toBe(true);
  });
});
```

---

### 4. Strategy: Headless Phaser for Edge Cases

When you need to test Phaser-specific behavior (scene lifecycle, input events):

**File**: `stick-rumble-client/vitest.config.ts:19-22`
```typescript
resolve: {
  alias: {
    phaser: path.resolve(__dirname, 'tests/__mocks__/phaser.ts'),
  },
},
```

Your current Phaser mock (`tests/__mocks__/phaser.ts`) is minimal. For deeper testing, use `Phaser.HEADLESS`:

```typescript
// tests/setup-headless-phaser.ts
import Phaser from 'phaser';

export function createHeadlessGame(SceneClass: typeof Phaser.Scene): Promise<{
  game: Phaser.Game;
  scene: Phaser.Scene;
}> {
  return new Promise((resolve) => {
    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.HEADLESS,
      width: 1920,
      height: 1080,
      scene: {
        create() {
          resolve({ game: this.game, scene: this });
        },
      },
      physics: {
        default: 'arcade',
        arcade: { debug: false },
      },
      // Disable audio, plugins that need browser
      audio: { noAudio: true },
    };

    new Phaser.Game(config);
  });
}
```

**Note:** `Phaser.HEADLESS` still requires a DOM environment (jsdom), but doesn't create Canvas/WebGL. It's useful for testing scene lifecycle, physics, and tweens without actual rendering.

---

### 5. Strategy: Property-Based Testing

Test invariants that should always hold, regardless of input sequence:

```typescript
import fc from 'fast-check';

describe('Game Invariants', () => {
  it('player position always stays within arena bounds', () => {
    fc.assert(
      fc.property(
        // Generate random input sequences
        fc.array(
          fc.record({
            up: fc.boolean(),
            down: fc.boolean(),
            left: fc.boolean(),
            right: fc.boolean(),
          }),
          { minLength: 60, maxLength: 600 } // 1-10 seconds of inputs
        ),
        (inputs) => {
          const sim = new GameSimulation(new ManualClock());
          sim.addPlayer('p1', { x: ARENA.WIDTH / 2, y: ARENA.HEIGHT / 2 });

          for (const input of inputs) {
            sim.updateInput('p1', { ...input, aimAngle: 0 });
            sim.tick(16.67);
          }

          const state = sim.getPlayerState('p1')!;

          // Invariant: player always within bounds
          return (
            state.position.x >= 0 &&
            state.position.x <= ARENA.WIDTH &&
            state.position.y >= 0 &&
            state.position.y <= ARENA.HEIGHT
          );
        }
      )
    );
  });

  it('health never goes below 0 or above max', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 1, max: 100 }), { minLength: 1, maxLength: 20 }),
        (damages) => {
          const sim = new GameSimulation(new ManualClock());
          sim.addPlayer('p1', { x: 500, y: 500 });

          for (const damage of damages) {
            sim.damagePlayer('p1', damage);
          }

          const state = sim.getPlayerState('p1')!;
          return state.health >= 0 && state.health <= 100;
        }
      )
    );
  });
});
```

---

### 6. Integration Testing Pattern (Already Exists)

**File**: `stick-rumble-client/src/game/network/WebSocketClient.integration.helpers.ts:220-256`

Your `waitForEvent<T>()` helper is already excellent:

```typescript
export async function waitForEvent<T>(
  eventType: string,
  client: WebSocketClient,
  timeout = 5000
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      client.off(eventType, handler);
      reject(new Error(`Timeout waiting for ${eventType}`));
    }, timeout);

    const handler = (data: T) => {
      clearTimeout(timer);
      client.off(eventType, handler);
      resolve(data);
    };

    client.on(eventType, handler);
  });
}
```

This pattern can be extended for simulation testing:

```typescript
async function waitForState(
  sim: GameSimulation,
  predicate: (sim: GameSimulation) => boolean,
  maxTicks = 600
): Promise<void> {
  const clock = sim.getClock();
  for (let tick = 0; tick < maxTicks; tick++) {
    if (predicate(sim)) return;
    sim.tick(16.67);
    clock.advance(16.67);
  }
  throw new Error('State condition not met within max ticks');
}
```

---

## Code References

- `stick-rumble-server/internal/game/clock.go:1-79` - Injectable clock interface
- `stick-rumble-server/internal/game/gameserver.go:66-85` - GameServer with clock injection
- `stick-rumble-server/internal/game/gameserver_tick_test.go:12-32` - `simulateTick()` helper
- `stick-rumble-server/internal/game/physics.go:16-73` - Pure physics calculations
- `stick-rumble-client/src/game/input/InputManager.ts:1-196` - Input state management
- `stick-rumble-client/src/game/entities/PlayerManager.ts:1-276` - Player state storage
- `stick-rumble-client/src/game/entities/ProjectileManager.ts:112-140` - Update loop with deltaTime
- `stick-rumble-client/src/game/scenes/GameScene.test.setup.ts:1-168` - Comprehensive mocking
- `stick-rumble-client/src/game/network/WebSocketClient.integration.helpers.ts:220-256` - Event waiting

## Architecture Insights

### Key Patterns Already Present

1. **Dependency Injection** - Server uses `NewGameServerWithClock()` for testable time
2. **State/View Separation** - Managers hold state in Maps, sprites are rendering-only
3. **Event-Driven Communication** - WebSocket handlers use callbacks, enabling mock injection
4. **Delta Time Physics** - All physics use `deltaTime` parameter, not real time

### Recommended Additions

1. **Client-Side Clock Interface** - Mirror the server's `Clock` pattern
2. **GameSimulation Class** - Pure logic layer for client-side testing
3. **Scenario File Format** - JSON/YAML for recording and replaying test scenarios
4. **Visual Regression Tests** - Screenshot comparison for UI elements (separate from logic tests)

### Testing Pyramid for Games

```
                 ┌───────────────────┐
                 │   Manual Play     │  (exploratory, feel testing)
                 │    Testing        │
                 └─────────┬─────────┘
                           │
              ┌────────────┴────────────┐
              │   Integration Tests     │  (client + server together)
              │   (Scenario Replay)     │
              └────────────┬────────────┘
                           │
         ┌─────────────────┴─────────────────┐
         │     Simulation Tests              │  (GameSimulation class)
         │   (Logic without rendering)       │
         └─────────────────┬─────────────────┘
                           │
    ┌──────────────────────┴──────────────────────┐
    │            Unit Tests                       │  (physics, math, managers)
    │     (Pure functions & isolated classes)     │
    └─────────────────────────────────────────────┘
```

## Open Questions

1. **Determinism across platforms** - Floating-point math can differ between Node.js and browsers. Consider using fixed-point math for critical physics if cross-platform replay is needed.

2. **Input recording** - Should input recording happen at the client (before network) or server (after validation)?

3. **Visual regression** - For UI testing, consider Playwright screenshot comparison (not LLM-driven, just pixel diff) as a separate test suite from logic tests.

## Sources

- [Testing Phaser Games with Vitest](https://dev.to/davidmorais/testing-phaser-games-with-vitest-3kon)
- [Phaser Unit Testing Discussion](https://phaser.discourse.group/t/unit-testing/2922)
- [Automated Testing the game - Phaser Forum](https://phaser.discourse.group/t/automated-testing-the-game/13994)
- [Deterministic simulation | GDQuest](https://school.gdquest.com/glossary/deterministic_simulation)
- [Developing Your Own Replay System](https://www.gamedeveloper.com/programming/developing-your-own-replay-system)
- [Test-Driven Development in Game Programming](https://hero.handmade.network/forums/code-discussion/t/42-test_driven_development_in_game_programming)
- [How I use TDD to make games - Ariel Coppes](https://arielcoppes.dev/2023/10/29/tdd-to-make-games.html)
- [sim-ecs: Batteries included TypeScript ECS](https://github.com/NSSTC/sim-ecs)
- [Building a tiny type-safe TypeScript ECS](https://dev.to/trymnilsen/building-a-tiny-type-safe-typescript-ecs-entity-component-system-dil)
