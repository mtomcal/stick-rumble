package game

import (
	"context"
	"sync"
	"testing"
	"time"
)

func TestNewGameServer(t *testing.T) {
	gs := NewGameServer(nil)

	if gs == nil {
		t.Fatal("NewGameServer() returned nil")
	}

	if gs.world == nil {
		t.Error("GameServer.world is nil")
	}

	if gs.physics == nil {
		t.Error("GameServer.physics is nil")
	}

	if gs.running {
		t.Error("GameServer should not be running initially")
	}
}

func TestGameServerStartStop(t *testing.T) {
	gs := NewGameServer(nil)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Start the server
	gs.Start(ctx)

	if !gs.IsRunning() {
		t.Error("GameServer should be running after Start()")
	}

	// Give it a moment to actually start
	time.Sleep(50 * time.Millisecond)

	// Stop the server
	cancel()
	gs.Stop()

	if gs.IsRunning() {
		t.Error("GameServer should not be running after Stop()")
	}
}

func TestGameServerAddRemovePlayer(t *testing.T) {
	gs := NewGameServer(nil)
	playerID := "test-player-1"

	// Add player
	player := gs.AddPlayer(playerID)

	if player == nil {
		t.Fatal("AddPlayer() returned nil")
	}

	if player.ID != playerID {
		t.Errorf("AddPlayer() ID = %v, want %v", player.ID, playerID)
	}

	// Verify player exists
	_, exists := gs.GetPlayerState(playerID)
	if !exists {
		t.Error("GetPlayerState() should find added player")
	}

	// Remove player
	gs.RemovePlayer(playerID)

	// Verify player removed
	_, exists = gs.GetPlayerState(playerID)
	if exists {
		t.Error("GetPlayerState() should not find removed player")
	}
}

func TestGameServerUpdatePlayerInput(t *testing.T) {
	gs := NewGameServer(nil)
	playerID := "test-player-1"

	gs.AddPlayer(playerID)

	input := InputState{Up: true, Right: true}

	// Update input
	success := gs.UpdatePlayerInput(playerID, input)
	if !success {
		t.Error("UpdatePlayerInput() should return true for existing player")
	}

	// Verify input was set
	player, _ := gs.world.GetPlayer(playerID)
	retrievedInput := player.GetInput()

	if retrievedInput != input {
		t.Errorf("Player input = %+v, want %+v", retrievedInput, input)
	}

	// Try updating non-existent player
	success = gs.UpdatePlayerInput("non-existent", input)
	if success {
		t.Error("UpdatePlayerInput() should return false for non-existent player")
	}
}

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

func TestGameServerMultiplePlayers(t *testing.T) {
	var lastBroadcast []PlayerState
	var mu sync.Mutex

	broadcastFunc := func(states []PlayerState) {
		mu.Lock()
		lastBroadcast = states
		mu.Unlock()
	}

	gs := NewGameServer(broadcastFunc)

	// Add multiple players
	gs.AddPlayer("player-1")
	gs.AddPlayer("player-2")
	gs.AddPlayer("player-3")

	// Set different inputs
	gs.UpdatePlayerInput("player-1", InputState{Right: true})
	gs.UpdatePlayerInput("player-2", InputState{Left: true})
	gs.UpdatePlayerInput("player-3", InputState{Up: true})

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	gs.Start(ctx)

	// Run for a bit
	time.Sleep(100 * time.Millisecond)

	cancel()
	gs.Stop()

	// Check that broadcast included all players
	mu.Lock()
	broadcast := lastBroadcast
	mu.Unlock()

	if len(broadcast) != 3 {
		t.Errorf("Broadcast should include 3 players, got %d", len(broadcast))
	}

	// Verify all player IDs are present
	foundIDs := make(map[string]bool)
	for i := range broadcast {
		foundIDs[broadcast[i].ID] = true
	}

	expected := []string{"player-1", "player-2", "player-3"}
	for _, id := range expected {
		if !foundIDs[id] {
			t.Errorf("Broadcast missing player %v", id)
		}
	}
}

func TestGameServerNoBroadcastWithoutPlayers(t *testing.T) {
	var broadcastCount int
	var mu sync.Mutex

	broadcastFunc := func(states []PlayerState) {
		mu.Lock()
		broadcastCount++
		mu.Unlock()
	}

	gs := NewGameServer(broadcastFunc)

	// Don't add any players

	ctx, cancel := context.WithTimeout(context.Background(), 150*time.Millisecond)
	defer cancel()

	gs.Start(ctx)
	<-ctx.Done()
	gs.Stop()

	mu.Lock()
	count := broadcastCount
	mu.Unlock()

	// Should not broadcast when there are no players
	if count != 0 {
		t.Errorf("Should not broadcast without players, got %d broadcasts", count)
	}
}

func TestGameServerPlayerShoot(t *testing.T) {
	gs := NewGameServer(nil)
	playerID := "test-player-1"

	gs.AddPlayer(playerID)

	// Player should be able to shoot initially
	result := gs.PlayerShoot(playerID, 0) // Aim angle 0 (right)

	if !result.Success {
		t.Error("Player should be able to shoot initially")
	}

	if result.Projectile == nil {
		t.Error("Shoot should return a projectile")
	}

	if result.Projectile.OwnerID != playerID {
		t.Errorf("Projectile owner should be %s, got %s", playerID, result.Projectile.OwnerID)
	}

	// Verify projectile is in the manager
	projectiles := gs.GetActiveProjectiles()
	if len(projectiles) != 1 {
		t.Errorf("Expected 1 projectile, got %d", len(projectiles))
	}
}

func TestGameServerPlayerShoot_FireRateCooldown(t *testing.T) {
	gs := NewGameServer(nil)
	playerID := "test-player-1"

	gs.AddPlayer(playerID)

	// First shot should succeed
	result1 := gs.PlayerShoot(playerID, 0)
	if !result1.Success {
		t.Error("First shot should succeed")
	}

	// Immediate second shot should fail (fire rate cooldown)
	result2 := gs.PlayerShoot(playerID, 0)
	if result2.Success {
		t.Error("Second shot should fail due to fire rate cooldown")
	}

	if result2.Reason != ShootFailedCooldown {
		t.Errorf("Expected reason %s, got %s", ShootFailedCooldown, result2.Reason)
	}
}

func TestGameServerPlayerShoot_EmptyMagazine(t *testing.T) {
	gs := NewGameServer(nil)
	playerID := "test-player-1"

	gs.AddPlayer(playerID)

	// Empty the magazine by manipulating weapon state directly
	ws := gs.GetWeaponState(playerID)
	ws.CurrentAmmo = 0

	// Shot should fail with empty magazine
	result := gs.PlayerShoot(playerID, 0)
	if result.Success {
		t.Error("Shot should fail with empty magazine")
	}

	if result.Reason != ShootFailedEmpty {
		t.Errorf("Expected reason %s, got %s", ShootFailedEmpty, result.Reason)
	}
}

func TestGameServerPlayerShoot_NonExistentPlayer(t *testing.T) {
	gs := NewGameServer(nil)

	result := gs.PlayerShoot("non-existent", 0)

	if result.Success {
		t.Error("Shot should fail for non-existent player")
	}

	if result.Reason != ShootFailedNoPlayer {
		t.Errorf("Expected reason %s, got %s", ShootFailedNoPlayer, result.Reason)
	}
}

func TestGameServerPlayerReload(t *testing.T) {
	gs := NewGameServer(nil)
	playerID := "test-player-1"

	gs.AddPlayer(playerID)

	// Use some ammo
	ws := gs.GetWeaponState(playerID)
	ws.CurrentAmmo = 5

	// Start reload
	success := gs.PlayerReload(playerID)
	if !success {
		t.Error("Reload should start successfully")
	}

	if !ws.IsReloading {
		t.Error("Weapon should be reloading")
	}
}

func TestGameServerPlayerReload_AlreadyFull(t *testing.T) {
	gs := NewGameServer(nil)
	playerID := "test-player-1"

	gs.AddPlayer(playerID)

	// Reload when already full
	success := gs.PlayerReload(playerID)
	if success {
		t.Error("Reload should not start when magazine is full")
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

func TestGameServerGetWeaponState(t *testing.T) {
	gs := NewGameServer(nil)
	playerID := "test-player-1"

	gs.AddPlayer(playerID)

	ws := gs.GetWeaponState(playerID)
	if ws == nil {
		t.Fatal("GetWeaponState should return weapon state for existing player")
	}

	if ws.CurrentAmmo != PistolMagazineSize {
		t.Errorf("Expected ammo %d, got %d", PistolMagazineSize, ws.CurrentAmmo)
	}

	// Non-existent player
	wsNil := gs.GetWeaponState("non-existent")
	if wsNil != nil {
		t.Error("GetWeaponState should return nil for non-existent player")
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

func TestGameServerReloadCompleteCallback(t *testing.T) {
	var callbackPlayerID string
	var callbackCalled bool
	var mu sync.Mutex

	gs := NewGameServer(nil)
	playerID := "test-player-1"

	// Set the reload complete callback
	gs.SetOnReloadComplete(func(pID string) {
		mu.Lock()
		callbackPlayerID = pID
		callbackCalled = true
		mu.Unlock()
	})

	gs.AddPlayer(playerID)

	// Use some ammo to allow reload
	ws := gs.GetWeaponState(playerID)
	ws.CurrentAmmo = 5

	// Start reload
	success := gs.PlayerReload(playerID)
	if !success {
		t.Fatal("Reload should start successfully")
	}

	// Callback should not be called immediately
	mu.Lock()
	if callbackCalled {
		t.Error("Callback should not be called before reload completes")
	}
	mu.Unlock()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	gs.Start(ctx)

	// Wait for reload to complete (1.5 seconds + buffer)
	time.Sleep(1700 * time.Millisecond)

	cancel()
	gs.Stop()

	// Callback should have been called
	mu.Lock()
	defer mu.Unlock()

	if !callbackCalled {
		t.Error("Reload complete callback should have been called")
	}

	if callbackPlayerID != playerID {
		t.Errorf("Callback should receive player ID %s, got %s", playerID, callbackPlayerID)
	}

	// Ammo should be refilled
	if ws.CurrentAmmo != PistolMagazineSize {
		t.Errorf("Ammo should be refilled to %d, got %d", PistolMagazineSize, ws.CurrentAmmo)
	}
}

func TestGameServerReloadCompleteCallback_NoCallback(t *testing.T) {
	gs := NewGameServer(nil)
	playerID := "test-player-1"

	// Don't set callback - should not panic

	gs.AddPlayer(playerID)

	// Use some ammo to allow reload
	ws := gs.GetWeaponState(playerID)
	ws.CurrentAmmo = 5

	// Start reload
	gs.PlayerReload(playerID)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	gs.Start(ctx)

	// Wait for reload to complete (should not panic even without callback)
	time.Sleep(1700 * time.Millisecond)

	cancel()
	gs.Stop()

	// Ammo should still be refilled
	if ws.CurrentAmmo != PistolMagazineSize {
		t.Errorf("Ammo should be refilled to %d, got %d", PistolMagazineSize, ws.CurrentAmmo)
	}
}

func TestGameServerHitDetection(t *testing.T) {
	hitCount := 0
	var hitEvent HitEvent
	var mu sync.Mutex

	onHit := func(hit HitEvent) {
		mu.Lock()
		hitCount++
		hitEvent = hit
		mu.Unlock()
	}

	gs := NewGameServer(nil)
	gs.SetOnHit(onHit)

	// Add two players
	player1ID := "player-1"
	player2ID := "player-2"
	gs.AddPlayer(player1ID)
	gs.AddPlayer(player2ID)

	// Position player2 at a specific location
	player2, _ := gs.world.GetPlayer(player2ID)
	player2.SetPosition(Vector2{X: 1000, Y: 540})

	// Shoot from player1 toward player2
	result := gs.PlayerShoot(player1ID, 0.0) // Angle 0 = right
	if !result.Success {
		t.Fatal("PlayerShoot should succeed")
	}

	// Manually place projectile at player2's position to trigger hit
	proj := gs.projectileManager.GetProjectileByID(result.Projectile.ID)
	if proj == nil {
		t.Fatal("Projectile should exist")
	}
	proj.Position = Vector2{X: 1000, Y: 540}

	// Run one hit detection check
	gs.checkHitDetection()

	// Verify hit was detected
	mu.Lock()
	defer mu.Unlock()

	if hitCount != 1 {
		t.Errorf("Expected 1 hit, got %d", hitCount)
	}

	if hitEvent.VictimID != player2ID {
		t.Errorf("Expected victim %s, got %s", player2ID, hitEvent.VictimID)
	}

	if hitEvent.AttackerID != player1ID {
		t.Errorf("Expected attacker %s, got %s", player1ID, hitEvent.AttackerID)
	}

	// Verify player2 took damage
	player2State, _ := gs.GetPlayerState(player2ID)
	expectedHealth := PlayerMaxHealth - PistolDamage
	if player2State.Health != expectedHealth {
		t.Errorf("Expected health %d, got %d", expectedHealth, player2State.Health)
	}

	// Verify projectile was removed
	proj = gs.projectileManager.GetProjectileByID(result.Projectile.ID)
	if proj != nil {
		t.Error("Projectile should be removed after hit")
	}
}

func TestGameServerHitDetection_NoHit(t *testing.T) {
	hitCount := 0
	var mu sync.Mutex

	onHit := func(hit HitEvent) {
		mu.Lock()
		hitCount++
		mu.Unlock()
	}

	gs := NewGameServer(nil)
	gs.SetOnHit(onHit)

	// Add two players far apart
	player1ID := "player-1"
	player2ID := "player-2"
	gs.AddPlayer(player1ID)
	gs.AddPlayer(player2ID)

	player1, _ := gs.world.GetPlayer(player1ID)
	player2, _ := gs.world.GetPlayer(player2ID)
	player1.SetPosition(Vector2{X: 100, Y: 100})
	player2.SetPosition(Vector2{X: 1000, Y: 1000})

	// Shoot from player1
	result := gs.PlayerShoot(player1ID, 0.0)
	if !result.Success {
		t.Fatal("PlayerShoot should succeed")
	}

	// Run hit detection check (should find no hits)
	gs.checkHitDetection()

	mu.Lock()
	defer mu.Unlock()

	if hitCount != 0 {
		t.Errorf("Expected no hits, got %d", hitCount)
	}

	// Verify player2 health unchanged
	player2State, _ := gs.GetPlayerState(player2ID)
	if player2State.Health != PlayerMaxHealth {
		t.Errorf("Expected full health %d, got %d", PlayerMaxHealth, player2State.Health)
	}
}

func TestGameServerHitDetection_MultipleHits(t *testing.T) {
	hitCount := 0
	var mu sync.Mutex

	onHit := func(hit HitEvent) {
		mu.Lock()
		hitCount++
		mu.Unlock()
	}

	gs := NewGameServer(nil)
	gs.SetOnHit(onHit)

	// Add two players
	player1ID := "player-1"
	player2ID := "player-2"
	gs.AddPlayer(player1ID)
	gs.AddPlayer(player2ID)

	player2, _ := gs.world.GetPlayer(player2ID)
	player2.SetPosition(Vector2{X: 1000, Y: 540})

	// Fire 4 shots (should kill with 25 damage each = 100 total)
	for i := 0; i < 4; i++ {
		result := gs.PlayerShoot(player1ID, 0.0)
		if !result.Success {
			t.Fatalf("PlayerShoot %d should succeed", i+1)
		}

		// Position projectile at player2
		proj := gs.projectileManager.GetProjectileByID(result.Projectile.ID)
		proj.Position = Vector2{X: 1000, Y: 540}

		// Run hit detection
		gs.checkHitDetection()

		// Reset cooldown for next shot
		ws := gs.GetWeaponState(player1ID)
		ws.LastShotTime = time.Now().Add(-1 * time.Second)
	}

	// Verify 4 hits
	mu.Lock()
	defer mu.Unlock()

	if hitCount != 4 {
		t.Errorf("Expected 4 hits, got %d", hitCount)
	}

	// Verify player2 is dead
	player2State, _ := gs.GetPlayerState(player2ID)
	if player2State.Health != 0 {
		t.Errorf("Expected health 0, got %d", player2State.Health)
	}

	if player2State.IsAlive() {
		t.Error("Player should be dead")
	}
}

func TestGameServerHitDetection_DeadPlayerNoHit(t *testing.T) {
	hitCount := 0
	var mu sync.Mutex

	onHit := func(hit HitEvent) {
		mu.Lock()
		hitCount++
		mu.Unlock()
	}

	gs := NewGameServer(nil)
	gs.SetOnHit(onHit)

	// Add two players
	player1ID := "player-1"
	player2ID := "player-2"
	gs.AddPlayer(player1ID)
	gs.AddPlayer(player2ID)

	player2, _ := gs.world.GetPlayer(player2ID)
	player2.SetPosition(Vector2{X: 1000, Y: 540})
	player2.TakeDamage(100) // Kill player2

	// Shoot at dead player
	result := gs.PlayerShoot(player1ID, 0.0)
	if !result.Success {
		t.Fatal("PlayerShoot should succeed")
	}

	// Position projectile at dead player
	proj := gs.projectileManager.GetProjectileByID(result.Projectile.ID)
	proj.Position = Vector2{X: 1000, Y: 540}

	// Run hit detection
	gs.checkHitDetection()

	// Should not register hit
	mu.Lock()
	defer mu.Unlock()

	if hitCount != 0 {
		t.Error("Should not hit dead players")
	}
}
