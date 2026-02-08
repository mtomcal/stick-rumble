package game

import (
	"sync"
	"testing"
	"time"
)

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
	result := gs.PlayerShoot(player1ID, 0.0, 0) // Angle 0 = right
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
	result := gs.PlayerShoot(player1ID, 0.0, 0)
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
		result := gs.PlayerShoot(player1ID, 0.0, 0)
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

	if player2State.Health > 0 {
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
	result := gs.PlayerShoot(player1ID, 0.0, 0)
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
