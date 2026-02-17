# Testing Strategy

This document describes the comprehensive validation infrastructure used to verify AI-generated code for Stick Rumble—a graphical, real-time multiplayer system where traditional unit tests alone are insufficient.

## The Challenge

AI-generated code faces unique validation challenges:

1. **Mocked rendering** - Unit tests verify function calls, not pixels on screen
2. **Timing sensitivity** - 60Hz game loops expose subtle bugs
3. **State complexity** - Multiplayer state synchronization is hard to test
4. **Visual correctness** - A passing test doesn't mean correct rendering

## Testing Pyramid

```mermaid
flowchart TB
    subgraph Pyramid["Test Pyramid"]
        direction TB
        Integration["Integration Tests - WebSocket E2E"]
        Unit["Unit Tests - 1,400+ tests"]
    end

    Integration --> Unit
```

| Layer | Count | Purpose | Catches |
|-------|-------|---------|---------|
| Unit | 1,400+ | Logic verification | Algorithm bugs, edge cases |
| Integration | ~50 | System communication | Protocol errors, timing issues |

## Unit Tests

### Client (Vitest)

```bash
make test-client           # Run once
npm run test:watch         # Interactive mode
npm run test:coverage      # With coverage report
```

**Structure:**
```
stick-rumble-client/src/
├── game/
│   ├── entities/
│   │   ├── PlayerManager.ts
│   │   └── PlayerManager.test.ts      # Colocated tests
│   ├── scenes/
│   │   ├── GameScene.ts
│   │   └── GameScene.test.setup.ts    # Shared setup
│   └── ...
└── tests/
    └── __mocks__/                      # Phaser mocks
```

**Coverage requirements:**
- >90% statement coverage for all business logic
- All edge cases covered
- All error paths tested

### Server (Go)

```bash
make test-server           # Run all
make test-server-verbose   # With output
go test ./internal/game -v -run TestName  # Single test
```

**Structure:**
```
stick-rumble-server/internal/
├── game/
│   ├── gameserver.go
│   ├── gameserver_tick_test.go
│   ├── gameserver_shooting_test.go
│   └── ...
└── network/
    ├── websocket_handler.go
    └── websocket_handler_test.go
```

**Testing patterns:**
- Table-driven tests for edge cases
- Mock clocks for timing-sensitive code
- In-memory channels for WebSocket simulation

## Integration Tests

Integration tests verify client-server communication over real WebSocket connections.

```bash
make test-integration      # Auto-starts server
```

**What they test:**
- Connection establishment and reconnection
- Message serialization/deserialization
- State synchronization
- Error handling

**Example: Health regeneration test**
```typescript
// WebSocketClient.health-regeneration.integration.test.ts
it('should receive health updates after damage', async () => {
  // Connect to real server
  const client = new WebSocketClient('ws://localhost:8080/ws');
  await client.connect();

  // Take damage (server-side)
  // ...

  // Verify health regeneration messages
  await expect(client).toReceiveMessage({
    type: 'player:damaged',
    data: { health: expect.any(Number) }
  });
});
```

## Coverage Requirements

| Component | Minimum Coverage |
|-----------|------------------|
| Client business logic | 90% statement |
| Server game logic | 90% statement |
| Network handlers | 90% statement |

### Measuring Coverage

```bash
# Client coverage
npm run test:coverage

# Server coverage
go test ./... -coverprofile=coverage.out
go tool cover -html=coverage.out
```

## Test Categories

### By Speed

| Category | Time | When to Run |
|----------|------|-------------|
| Unit | <30s | Every change |
| Integration | ~2min | Before commit |

### By Purpose

```mermaid
flowchart TB
    subgraph "What They Catch"
        Unit["Unit Tests"]
        Integration["Integration Tests"]
    end

    Unit --> Logic["Logic errors, edge cases, algorithm bugs"]
    Integration --> Protocol["Protocol errors, timing issues, state sync"]
```

## CI/CD Integration

All tests run in CI before merge:

```yaml
# Conceptual CI pipeline
jobs:
  test:
    steps:
      - make lint          # Code quality
      - make typecheck     # Type safety
      - make test-client   # Client unit tests
      - make test-server   # Server unit tests
```

## Common Testing Patterns

### Mock Clock Pattern (Server)

```go
// Inject mock clock for deterministic timing
func TestFireRate(t *testing.T) {
    mockClock := &MockClock{now: time.Now()}
    server := NewGameServerWithClock(broadcast, mockClock)

    // Fire first shot
    result := server.Shoot(playerID, rotation)
    assert.True(t, result.Success)

    // Advance time less than cooldown
    mockClock.Advance(100 * time.Millisecond)

    // Should be on cooldown
    result = server.Shoot(playerID, rotation)
    assert.False(t, result.Success)
    assert.Equal(t, "cooldown", result.Reason)
}
```

### Mock WebSocket Pattern (Client)

```typescript
// Mock WebSocket for unit tests
const mockWs = {
  send: vi.fn(),
  close: vi.fn(),
  readyState: WebSocket.OPEN,
};

vi.stubGlobal('WebSocket', vi.fn(() => mockWs));

const client = new WebSocketClient('ws://localhost:8080/ws');
await client.connect();

// Verify message sent
client.sendInput({ w: true, a: false, s: false, d: false });
expect(mockWs.send).toHaveBeenCalledWith(
  expect.stringContaining('"type":"input:state"')
);
```

## Debugging Test Failures

### Unit Test Failures

```bash
# Run single test with verbose output
npm test -- --reporter=verbose PlayerManager.test.ts
go test ./internal/game -v -run TestSpecificFunction
```

### Integration Test Failures

```bash
# Start server with debug logging
DEBUG=true make dev-server

# Run integration test
npm run test:integration -- WebSocketClient.integration.test.ts
```

## The Limits of Automated Testing

### Why Human Playtesting Remains Essential

Despite 1,400+ automated tests, **human playtesting is often the only way to catch certain classes of bugs** in real-time multiplayer games.

```mermaid
flowchart TB
    subgraph Automated["What Automated Tests Can Do"]
        Unit["Unit Tests: Discrete logic"]
        Integration["Integration Tests: Message flow"]
    end

    subgraph Human["What Only Humans Can Test"]
        Feel["Game Feel: Input responsiveness"]
        Emergent["Emergent Behavior: Multiplayer chaos"]
        Realtime["Real-Time: Latency perception"]
    end

    Automated -.->|"Gap"| Human
```

### The Real-Time Problem

AI agents (including LLMs) have fundamental limitations when testing real-time systems:

| Challenge | Why It's Hard for AI |
|-----------|---------------------|
| **60Hz game loops** | AI can't perceive or react at 16ms intervals |
| **Input timing** | Precise WASD + mouse coordination requires human reflexes |
| **Latency feel** | Subjective experience of "lag" isn't measurable by code |
| **Animation smoothness** | Frame-by-frame screenshots miss interpolation issues |
| **Emergent gameplay** | 8 players creating chaos produces untestable combinations |

### The Pragmatic Solution: Player Feedback Loop

When automated tests pass but something still feels wrong, **human playtesting is the final arbiter**:

```mermaid
flowchart TB
    subgraph Development["Development Cycle"]
        Code["Write Code"]
        Auto["Automated Tests"]
    end

    subgraph QA["Human QA"]
        Play["Player Testing"]
        Feedback["Player Feedback"]
    end

    subgraph Fix["Resolution"]
        Investigate["Investigate"]
        NewTest["Add Test"]
        Ship["Ship Fix"]
    end

    Code --> Auto --> Play
    Play --> Feedback
    Feedback --> Investigate --> NewTest --> Ship
    Feedback --> Investigate --> Ship
```

### What Human Testers Catch

Real examples of bugs that only human playtesting revealed:

1. **"Shooting feels unresponsive"** - Fire rate technically correct, but visual/audio feedback delayed by 2 frames
2. **"Players teleport sometimes"** - State sync working correctly, but interpolation had edge case at high velocity
3. **"Can't tell when I'm hit"** - Damage numbers rendering, but screen shake too subtle during combat chaos
4. **"Weapon pickup is frustrating"** - Proximity detection correct, but pickup prompt obscured by other UI

These bugs pass all automated tests because:
- The code is technically correct
- Individual components render properly
- Messages flow as expected
- Coverage is >90%

But the **holistic experience** is broken in ways only a human player perceives.

### Epic-Based Development with Playtesting Gates

The practical workflow integrates playtesting at the **epic level**, not per-story:

```mermaid
flowchart TB
    subgraph Epic["Epic: Weapon System"]
        S1["Story 1: Weapon pickup"]
        S2["Story 2: Ammo and reload"]
        S3["Story 3: Projectile physics"]
        S4["Story 4: Hit detection"]
        S5["Story 5: UI feedback"]
    end

    subgraph AI["AI Agent Implementation"]
        Parallel["AI Agent Implementation"]
        Tests["All Tests Pass"]
    end

    subgraph QA["Playtesting Gate"]
        Play["Serious Play Session"]
        Bugs["Integration Bugs Found"]
    end

    subgraph Fix["Bug Bash"]
        Issues["Bug Fixes"]
        Agents["AI Agents Fix"]
        Retest["Playtest Again"]
    end

    Epic --> AI --> Tests --> Play
    Play --> Bugs --> Issues --> Agents --> Retest
    Retest -->|"Still broken"| Bugs
    Retest -->|"Ship it"| Done["Epic Complete"]
```

**Why epic-level playtesting?**

Individual stories pass their tests in isolation. But when Story 1 (weapon pickup) meets Story 4 (hit detection) meets Story 5 (UI feedback), **integration seams appear**:

- Pickup animation interrupts shooting state machine
- Hit detection uses old weapon stats after switch
- UI shows wrong ammo count during reload-cancel edge case

These bugs are **invisible to per-story testing** because each component works correctly in isolation. Only when a human plays through full game loops—picking up weapons, shooting enemies, dying, respawning—do the integration misses surface.

### The Playtesting Session

After completing an epic with AI agents:

1. **Block off real time** - Not 5 minutes, but 30-60 minutes of actual gameplay
2. **Play the full loop** - Don't just test new features; play the whole game
3. **Take notes** - "Felt weird when..." is valid bug report data
4. **Hunt edge cases** - Spam inputs, switch weapons mid-reload, die while shooting
5. **Multi-client testing** - Run 2-4 game clients simultaneously

### Integrating Human Feedback

The workflow acknowledges this reality:

1. **Automated tests** gate code quality and catch regressions
2. **Epic completion** triggers a dedicated playtesting session
4. **Player feedback** becomes bug fixes for the next cycle

The workflow follows a **rhythm**: build epic → playtest → bug bash → playtest → ship. AI handles the implementation volume; humans validate the integrated experience.

### The Honest Truth

> **No amount of automated testing replaces playing your own game.**

AI-assisted development accelerates implementation. Automated tests prevent regressions. Visual tests catch rendering bugs. But for real-time multiplayer games, the final quality gate is—and always will be—humans playing the game and reporting what feels wrong.

This isn't a limitation to overcome. It's a recognition that games are experiential products, and experience is inherently human.
