package game

import (
	"context"
	"sync"
	"testing"
	"time"
)

func TestGameServerTickLoop(t *testing.T) {
	var broadcastCount int
	var mu sync.Mutex

	broadcastFunc := func(states []PlayerState) {
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

	broadcastFunc := func(states []PlayerState) {
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
	result := gs.PlayerShoot(playerID, 0)
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
	result := gs.PlayerShoot(playerID, 0)
	if !result.Success {
		t.Fatal("Failed to shoot")
	}

	projectiles = gs.GetActiveProjectiles()
	if len(projectiles) != 1 {
		t.Errorf("Expected 1 projectile after shooting, got %d", len(projectiles))
	}
}
