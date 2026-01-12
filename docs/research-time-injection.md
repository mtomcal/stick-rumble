# Research: Time Injection for Server Tests

## Summary of Findings

The stick-rumble-server codebase heavily relies on `time.Now()` and `time.Sleep()` for:
1. **Game Timing**: Server tick loop (60Hz) and broadcast loop (20Hz)
2. **Player State Management**: Respawn delays (3s), spawn invulnerability (2s), health regeneration (5s delay)
3. **Weapon System**: Fire rate cooldowns (333ms for pistol), reload times (1500ms)
4. **Weapon Crates**: Respawn delays (30s)
5. **Match Management**: Match start time and elapsed time calculations
6. **Testing**: Extensive use of `time.Sleep()` to wait for async operations (50-5500ms waits)

## Time.Sleep Usage Statistics
- **Total occurrences**: 55
- **Test files**: 52 instances
- **Production code**: 0 instances (good - only in tests)

## Time.Now() Usage Statistics
- **Total occurrences**: 66+
- **Production code locations**:
  - `gameserver.go`: 2 (line 111, 499)
  - `player.go`: 6 (lines 54, 124, 160, 191, 193, 200)
  - `weapon.go`: 2 (lines 100, 116)
  - `weapon_crate.go`: 2 (lines 82, 93)
  - `match.go`: 1 (line 74)
  - `room.go`: 2 (lines 205, 265)
  - `projectile.go`: 1 (line 41)
- **Test file locations**: 40+ instances across test files

## Key Timing Constants (from constants.go)
- `ServerTickRate`: 60 Hz (16.67ms per tick)
- `ClientUpdateRate`: 20 Hz (50ms per update)
- `RespawnDelay`: 3.0 seconds
- `SpawnInvulnerabilityDuration`: 2.0 seconds
- `HealthRegenerationDelay`: 5.0 seconds
- `HealthRegenerationRate`: 10.0 HP/second
- `WeaponRespawnDelay`: 30.0 seconds
- `PistolReloadTime`: 1500 milliseconds
- `PistolFireRate`: 3.0 rounds/second
- `ProjectileMaxLifetime`: 1 second

## Key Files Requiring Clock Injection

### 1. internal/game/gameserver.go
- Line 111: `lastTick := time.Now()`
- Line 499: `now := time.Now()`
- Uses ticker.C for main loops

### 2. internal/game/player.go
- Line 54: `lastDamageTime: time.Now()`
- Line 124: `p.lastDamageTime = time.Now()`
- Line 160: `now := time.Now()`
- Line 191: `p.InvulnerabilityEndTime = time.Now().Add(...)`
- Line 193: `p.lastDamageTime = time.Now()`
- Line 200: `time.Now().After(p.InvulnerabilityEndTime)`

### 3. internal/game/weapon.go
- Line 100: `ws.LastShotTime = time.Now()`
- Line 116: `ws.ReloadStartTime = time.Now()`
- Uses `time.Since()` for cooldown and reload checks

### 4. internal/game/weapon_crate.go
- Line 82: `crate.RespawnTime = time.Now().Add(WeaponRespawnDelay * time.Second)`
- Line 93: `now := time.Now()`

### 5. internal/game/match.go
- Line 74: `m.StartTime = time.Now()`
- Uses `time.Since()` for elapsed time calculations

### 6. internal/game/projectile.go
- Line 41: `CreatedAt: time.Now()`

### 7. internal/game/room.go
- Lines 205, 265: `time.Now().UnixMilli()`

## Recommended Clock Interface Design

```go
// Clock interface for testability
type Clock interface {
    Now() time.Time
    Since(t time.Time) time.Duration
}

// RealClock uses actual system time
type RealClock struct{}

func (rc *RealClock) Now() time.Time {
    return time.Now()
}

func (rc *RealClock) Since(t time.Time) time.Duration {
    return time.Since(t)
}

// ManualClock for testing - allows advancing time manually
type ManualClock struct {
    currentTime time.Time
    mu          sync.RWMutex
}

func (mc *ManualClock) Now() time.Time {
    mc.mu.RLock()
    defer mc.mu.RUnlock()
    return mc.currentTime
}

func (mc *ManualClock) Advance(d time.Duration) {
    mc.mu.Lock()
    defer mc.mu.Unlock()
    mc.currentTime = mc.currentTime.Add(d)
}
```

## Implementation Priority Order

### Phase 1 - Core Infrastructure
- Create `Clock` interface and implementations (RealClock, ManualClock)
- Inject clock into `GameServer` (high impact on tick loops)
- Update `gameserver.go` and its tests

### Phase 2 - Player State
- Inject clock into `PlayerState`
- Update respawn checks, invulnerability, and health regeneration
- Update player tests

### Phase 3 - Weapon System
- Inject clock into `WeaponState`
- Update fire rate and reload checks
- Update weapon tests

### Phase 4 - Game Objects
- Inject clock into `WeaponCrate` and `WeaponCrateManager`
- Inject clock into `Match`
- Inject clock into `Projectile`

### Phase 5 - Test Helpers
- Create test utilities for time advancement
- Remove `time.Sleep()` calls from tests where possible
- Update test patterns to use manual clock advances

## Testing Benefits

Current test patterns use `time.Sleep()` extensively (55 instances). With clock injection:
- Tests become deterministic and fast
- Reduce flakiness from timing-dependent tests
- Enable testing of long delays (respawn, weapon respawn) instantly
- Better control over game state transitions

## Implementation Challenges to Address

1. **Goroutine Timing**: `time.Ticker` won't work with manual clock; need to extract ticker logic or create mock tickers
2. **Test Deadline Handling**: WebSocket test helpers use `SetReadDeadline(time.Now().Add(...))` which still needs real time
3. **Broadcast Loop**: Currently coupled to real-time ticker; needs refactoring for testability
4. **Concurrency**: Clock implementations must be thread-safe (RWMutex protection)

## Slow Test Breakdown (from issue)
- `TestGameServerHealthRegenerationAfterRespawn`: 9.00s
- `TestGameServerHealthRegeneration`: 6.10s
- `TestGameServerRespawn_WeaponStateReset`: 3.10s
- `TestGameServerReloadCompleteCallback`: 1.70s
- `TestGameServerReloadCompleteCallback_NoCallback`: 1.70s
- `TestGameServerPhysicsIntegration`: 1.00s
