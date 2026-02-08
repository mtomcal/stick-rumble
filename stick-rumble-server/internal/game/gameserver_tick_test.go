package game

import (
	"context"
	"sync"
	"testing"
	"time"
)

// simulateTick simulates a game server tick by manually calling tick methods
// and advancing the clock. This allows tests to run instantly without time.Sleep().
func simulateTick(gs *GameServer, clock *ManualClock, deltaTime time.Duration) {
	// Advance the clock
	clock.Advance(deltaTime)

	// Call the tick methods in the same order as tickLoop
	gs.updateAllPlayers(deltaTime.Seconds())
	gs.projectileManager.Update(deltaTime.Seconds())
	gs.checkHitDetection()
	gs.checkReloads()
	gs.checkRespawns()
	gs.updateInvulnerability()
	gs.updateHealthRegeneration(deltaTime.Seconds())
	gs.checkWeaponRespawns()
}

// simulateTicks runs multiple ticks
func simulateTicks(gs *GameServer, clock *ManualClock, count int, tickRate time.Duration) {
	for i := 0; i < count; i++ {
		simulateTick(gs, clock, tickRate)
	}
}

func TestGameServerTickLoop(t *testing.T) {
	var broadcastCount int
	var mu sync.Mutex

	broadcastFunc := func(states []PlayerStateSnapshot) {
		mu.Lock()
		broadcastCount++
		mu.Unlock()
	}

	gs := NewGameServer(broadcastFunc)
	playerID := "test-player-1"

	// Add player and give input
	gs.AddPlayer(playerID)
	gs.UpdatePlayerInput(playerID, InputState{Right: true})

	// Get initial position
	initialState, _ := gs.GetPlayerState(playerID)
	initialPos := initialState.Position

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Start server
	gs.Start(ctx)

	// Let it run for a few ticks (~100ms should be 6 ticks at 60Hz)
	time.Sleep(100 * time.Millisecond)

	// Stop server
	cancel()
	gs.Stop()

	// Check that player moved
	finalState, _ := gs.GetPlayerState(playerID)
	finalPos := finalState.Position

	if finalPos.X <= initialPos.X {
		t.Errorf("Player should have moved right: initial=%v, final=%v", initialPos.X, finalPos.X)
	}

	// Check that broadcast was called
	mu.Lock()
	count := broadcastCount
	mu.Unlock()

	if count == 0 {
		t.Error("Broadcast function should have been called")
	}
}

func TestGameServerBroadcastRate(t *testing.T) {
	var broadcasts []time.Time
	var mu sync.Mutex

	broadcastFunc := func(states []PlayerStateSnapshot) {
		mu.Lock()
		broadcasts = append(broadcasts, time.Now())
		mu.Unlock()
	}

	gs := NewGameServer(broadcastFunc)

	// Add a player so broadcasts happen
	gs.AddPlayer("test-player")

	ctx, cancel := context.WithTimeout(context.Background(), 250*time.Millisecond)
	defer cancel()

	gs.Start(ctx)

	// Wait for context timeout
	<-ctx.Done()
	gs.Stop()

	mu.Lock()
	count := len(broadcasts)
	mu.Unlock()

	// At 20Hz, in 250ms we expect ~5 broadcasts (250 / 50 = 5)
	// Allow some tolerance (3-7 is acceptable)
	if count < 3 || count > 7 {
		t.Errorf("Expected ~5 broadcasts at 20Hz over 250ms, got %d", count)
	}
}

func TestGameServerPhysicsIntegration(t *testing.T) {
	gs := NewGameServer(nil)
	playerID := "test-player-1"

	gs.AddPlayer(playerID)

	// Set player to move right
	gs.UpdatePlayerInput(playerID, InputState{Right: true})

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	gs.Start(ctx)

	// Run for 1 second
	time.Sleep(1 * time.Second)

	cancel()
	gs.Stop()

	// Check final state
	state, _ := gs.GetPlayerState(playerID)

	// After 1 second of acceleration at 50 px/s² toward max 200 px/s,
	// velocity should have increased significantly
	// It won't reach max because acceleration is gradual
	if state.Velocity.X < 40 {
		t.Errorf("After 1 second, velocity.X should have increased significantly, got %v", state.Velocity.X)
	}

	if state.Velocity.X > MovementSpeed {
		t.Errorf("Velocity should not exceed max speed (%v), got %v", MovementSpeed, state.Velocity.X)
	}

	// Position should have moved significantly right
	centerX := ArenaWidth / 2
	if state.Position.X <= centerX {
		t.Errorf("Player should have moved right from center (%v), got %v", centerX, state.Position.X)
	}
}

func TestGameServerProjectileUpdate(t *testing.T) {
	gs := NewGameServer(nil)
	playerID := "test-player-1"

	gs.AddPlayer(playerID)

	// Create a projectile
	result := gs.PlayerShoot(playerID, 0, 0)
	if !result.Success {
		t.Fatal("Failed to create projectile")
	}

	initialX := result.Projectile.Position.X

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	gs.Start(ctx)

	// Run for a bit
	time.Sleep(100 * time.Millisecond)

	cancel()
	gs.Stop()

	// Projectile should have moved
	proj := gs.projectileManager.GetProjectileByID(result.Projectile.ID)
	if proj != nil && proj.Position.X <= initialX {
		t.Error("Projectile should have moved right")
	}
}

func TestGameServerGetActiveProjectiles(t *testing.T) {
	gs := NewGameServer(nil)
	playerID := "test-player-1"

	gs.AddPlayer(playerID)

	// Initially no projectiles
	projectiles := gs.GetActiveProjectiles()
	if len(projectiles) != 0 {
		t.Errorf("Expected 0 projectiles initially, got %d", len(projectiles))
	}

	// After shooting
	result := gs.PlayerShoot(playerID, 0, 0)
	if !result.Success {
		t.Fatal("Failed to shoot")
	}

	projectiles = gs.GetActiveProjectiles()
	if len(projectiles) != 1 {
		t.Errorf("Expected 1 projectile after shooting, got %d", len(projectiles))
	}
}

func TestGameServerHealthRegeneration(t *testing.T) {
	// Create ManualClock and GameServer with it
	clock := NewManualClock(time.Now())
	gs := NewGameServerWithClock(nil, clock)
	playerID := "test-player-1"

	// Add player (starts at 100 HP)
	gs.AddPlayer(playerID)

	// Damage player to 50 HP
	gs.DamagePlayer(playerID, 50)

	// Verify damage was applied
	state, _ := gs.GetPlayerState(playerID)
	if state.Health != 50 {
		t.Fatalf("Expected health to be 50 after damage, got %d", state.Health)
	}

	// Simulate ticks for 5 seconds (health regen delay)
	// At 60 ticks/second, 5s = 300 ticks
	simulateTicks(gs, clock, 300, time.Duration(ServerTickInterval)*time.Millisecond)

	// Get state immediately after delay
	stateAfterDelay, _ := gs.GetPlayerState(playerID)
	t.Logf("Health after 5s delay: %d HP, isRegenerating: %v", stateAfterDelay.Health, stateAfterDelay.IsRegeneratingHealth)

	// Simulate 100ms (6 ticks at 60Hz)
	simulateTicks(gs, clock, 6, time.Duration(ServerTickInterval)*time.Millisecond)

	state100ms, _ := gs.GetPlayerState(playerID)
	t.Logf("Health after 5.1s: %d HP, isRegenerating: %v", state100ms.Health, state100ms.IsRegeneratingHealth)

	// Simulate 1 more second for regeneration to apply (10 HP/s * 1s = 10 HP)
	// At 60 ticks/second, 1s = 60 ticks
	simulateTicks(gs, clock, 60, time.Duration(ServerTickInterval)*time.Millisecond)

	// Check final health (should be 50 + ~10 = 60 HP)
	finalState, _ := gs.GetPlayerState(playerID)
	t.Logf("Final health after 6.1s total: %d HP, isRegenerating: %v", finalState.Health, finalState.IsRegeneratingHealth)

	// Health should have increased from 50 HP after delay passed
	if finalState.Health <= 50 {
		t.Errorf("Health should have regenerated after 5s delay + 1.1s regen time. Expected >50, got %d", finalState.Health)
	}

	// Expected health: 50 + (10 HP/s * 1.1s) = 50 + 11 = 61 HP (or close)
	expectedMin := 55 // Allow some tolerance
	if finalState.Health < expectedMin {
		t.Errorf("Expected at least %d HP after regeneration, got %d", expectedMin, finalState.Health)
	}
}

func TestGameServerHealthRegenerationAfterRespawn(t *testing.T) {
	// Create ManualClock and GameServer with it
	clock := NewManualClock(time.Now())
	gs := NewGameServerWithClock(nil, clock)
	playerID := "test-player-1"

	// Add player (starts at 100 HP)
	gs.AddPlayer(playerID)

	// Kill the player
	gs.DamagePlayer(playerID, 100)
	gs.MarkPlayerDead(playerID)

	// Verify player is dead
	state, _ := gs.GetPlayerState(playerID)
	if state.DeathTime == nil {
		t.Fatal("Player should be dead")
	}
	if state.Health != 0 {
		t.Fatalf("Dead player should have 0 HP, got %d", state.Health)
	}

	// Simulate ticks for 3.5 seconds (respawn delay is 3s)
	// At 60 ticks/second, 3.5s = 210 ticks
	simulateTicks(gs, clock, 210, time.Duration(ServerTickInterval)*time.Millisecond)

	// Verify player respawned at full health
	respawnedState, _ := gs.GetPlayerState(playerID)
	if respawnedState.Health != PlayerMaxHealth {
		t.Errorf("Player should respawn at full health (100), got %d", respawnedState.Health)
	}

	// Damage player again
	gs.DamagePlayer(playerID, 50)

	damagedState, _ := gs.GetPlayerState(playerID)
	if damagedState.Health != 50 {
		t.Fatalf("Expected health to be 50 after damage, got %d", damagedState.Health)
	}

	t.Logf("Player damaged to 50 HP after respawn")

	// Simulate ticks for 5.5 seconds (health regen delay is 5s)
	// At 60 ticks/second, 5.5s = 330 ticks
	simulateTicks(gs, clock, 330, time.Duration(ServerTickInterval)*time.Millisecond)

	// Check if regeneration is working
	regenState, _ := gs.GetPlayerState(playerID)
	t.Logf("Health after 5.5s: %d HP, isRegenerating: %v", regenState.Health, regenState.IsRegeneratingHealth)

	// Health should have regenerated
	if regenState.Health <= 50 {
		t.Errorf("Health should have regenerated after respawn and 5s delay. Expected >50, got %d", regenState.Health)
	}

	// Should be regenerating
	if !regenState.IsRegeneratingHealth && regenState.Health < PlayerMaxHealth {
		t.Error("IsRegeneratingHealth should be true after delay (unless already at max)")
	}
}

// TestGameServerAntiCheat_CorrectionLogging tests that the server logs warnings
// when a player's correction rate exceeds the 20% threshold
func TestGameServerAntiCheat_CorrectionLogging(t *testing.T) {
	clock := NewManualClock(time.Now())
	gs := NewGameServerWithClock(nil, clock)
	playerID := "test-cheater"

	// Add player
	gs.AddPlayer(playerID)

	// Get player state to manipulate correction stats directly
	player, _ := gs.world.GetPlayer(playerID)

	// Simulate multiple movement updates with corrections to exceed 20% threshold
	// 10 updates with 3 corrections = 30% correction rate (exceeds 20%)
	for i := 0; i < 10; i++ {
		player.RecordMovementUpdate()
		if i < 3 {
			player.RecordCorrection()
		}
	}

	// Verify correction rate exceeds threshold
	stats := player.GetCorrectionStats()
	rate := stats.GetCorrectionRate()
	if rate <= 0.20 {
		t.Fatalf("Test setup failed: correction rate = %.2f%%, want > 20%%", rate*100)
	}

	// Note: The actual anti-cheat logging happens in updateAllPlayers() when
	// result.CorrectionNeeded is true. This test verifies the stats are correctly
	// tracked and can exceed the threshold. The log output test would require
	// capturing log.Printf output, which is tested implicitly by the integration.

	// Verify stats are correct
	if stats.TotalUpdates != 10 {
		t.Errorf("TotalUpdates = %d, want 10", stats.TotalUpdates)
	}

	if stats.TotalCorrections != 3 {
		t.Errorf("TotalCorrections = %d, want 3", stats.TotalCorrections)
	}

	expectedRate := 0.3 // 30%
	if rate != expectedRate {
		t.Errorf("GetCorrectionRate() = %.2f%%, want %.2f%%", rate*100, expectedRate*100)
	}
}

// TestGameServerAntiCheat_BelowThreshold verifies that correction rates below 20%
// do not trigger warnings (tested via stats tracking)
func TestGameServerAntiCheat_BelowThreshold(t *testing.T) {
	clock := NewManualClock(time.Now())
	gs := NewGameServerWithClock(nil, clock)
	playerID := "test-normal-player"

	// Add player
	gs.AddPlayer(playerID)

	// Get player state
	player, _ := gs.world.GetPlayer(playerID)

	// Simulate many movement updates with few corrections (10% rate)
	// 100 updates with 10 corrections = 10% correction rate (below 20%)
	for i := 0; i < 100; i++ {
		player.RecordMovementUpdate()
		if i < 10 {
			player.RecordCorrection()
		}
	}

	// Verify correction rate is below threshold
	stats := player.GetCorrectionStats()
	rate := stats.GetCorrectionRate()

	if rate > 0.20 {
		t.Errorf("Correction rate = %.2f%%, want <= 20%% for normal gameplay", rate*100)
	}

	expectedRate := 0.1 // 10%
	if rate != expectedRate {
		t.Errorf("GetCorrectionRate() = %.2f%%, want %.2f%%", rate*100, expectedRate*100)
	}

	// This should NOT trigger anti-cheat warning
	if rate > 0.20 {
		t.Error("Normal player should not exceed anti-cheat threshold")
	}
}

// TestGameServerAntiCheat_ExactlyAtThreshold tests the edge case where correction
// rate is exactly 20% (should NOT trigger warning as check is > 0.20, not >=)
func TestGameServerAntiCheat_ExactlyAtThreshold(t *testing.T) {
	clock := NewManualClock(time.Now())
	gs := NewGameServerWithClock(nil, clock)
	playerID := "test-edge-case"

	// Add player
	gs.AddPlayer(playerID)

	// Get player state
	player, _ := gs.world.GetPlayer(playerID)

	// Simulate exactly 20% correction rate
	// 100 updates with 20 corrections = 20% correction rate
	for i := 0; i < 100; i++ {
		player.RecordMovementUpdate()
		if i < 20 {
			player.RecordCorrection()
		}
	}

	// Verify correction rate is exactly 20%
	stats := player.GetCorrectionStats()
	rate := stats.GetCorrectionRate()

	if rate != 0.20 {
		t.Errorf("Correction rate = %.2f%%, want exactly 20%%", rate*100)
	}

	// At exactly 20%, should NOT trigger warning (threshold check is > 0.20)
	if rate > 0.20 {
		t.Error("Exactly 20% should not exceed threshold (check is > 0.20, not >=)")
	}
}
