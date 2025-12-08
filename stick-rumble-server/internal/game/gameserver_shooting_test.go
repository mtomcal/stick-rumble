package game

import (
	"context"
	"sync"
	"testing"
	"time"
)

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
