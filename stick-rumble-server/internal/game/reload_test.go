package game

import (
	"testing"
	"time"
)

// TestPlayerShoot_AutoReload tests that shooting with an empty magazine triggers automatic reload
func TestPlayerShoot_AutoReload(t *testing.T) {
	clock := NewManualClock(time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC))
	gs := NewGameServerWithClock(nil, clock)

	// Add player
	playerID := "player1"
	gs.AddPlayer(playerID)

	// Empty the magazine
	ws := gs.GetWeaponState(playerID)
	ws.CurrentAmmo = 0

	// Attempt to shoot with empty magazine
	result := gs.PlayerShoot(playerID, 0, 0)

	if result.Success {
		t.Error("shoot should fail with empty magazine")
	}

	if result.Reason != ShootFailedEmpty {
		t.Errorf("expected reason %s, got %s", ShootFailedEmpty, result.Reason)
	}

	// Verify auto-reload was triggered
	if !ws.IsReloading {
		t.Error("auto-reload should be triggered when shooting with empty magazine")
	}
}

// TestPlayerShoot_NoAutoReloadWhenAlreadyReloading tests that auto-reload doesn't restart an existing reload
func TestPlayerShoot_NoAutoReloadWhenAlreadyReloading(t *testing.T) {
	clock := NewManualClock(time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC))
	gs := NewGameServerWithClock(nil, clock)

	// Add player
	playerID := "player1"
	gs.AddPlayer(playerID)

	// Empty the magazine and start reload
	ws := gs.GetWeaponState(playerID)
	ws.CurrentAmmo = 0
	ws.StartReload()
	firstReloadStart := ws.ReloadStartTime

	// Attempt to shoot while reloading
	result := gs.PlayerShoot(playerID, 0, 0)

	if result.Success {
		t.Error("shoot should fail while reloading")
	}

	if result.Reason != ShootFailedReload {
		t.Errorf("expected reason %s, got %s", ShootFailedReload, result.Reason)
	}

	// Verify reload start time didn't change
	if !ws.ReloadStartTime.Equal(firstReloadStart) {
		t.Error("reload should not restart when already reloading")
	}
}

// TestSetWeaponState_CancelsReload tests that switching weapons cancels an in-progress reload
func TestSetWeaponState_CancelsReload(t *testing.T) {
	clock := NewManualClock(time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC))
	gs := NewGameServerWithClock(nil, clock)

	// Add player
	playerID := "player1"
	gs.AddPlayer(playerID)

	// Start a reload on the pistol
	ws := gs.GetWeaponState(playerID)
	ws.CurrentAmmo = 5
	ws.StartReload()

	if !ws.IsReloading {
		t.Fatal("should be reloading before weapon switch")
	}

	// Switch to a new weapon (Uzi)
	newWeapon := NewWeaponStateWithClock(NewUzi(), clock)
	gs.SetWeaponState(playerID, newWeapon)

	// Old weapon's reload should be cancelled
	if ws.IsReloading {
		t.Error("old weapon reload should be cancelled after weapon switch")
	}

	// New weapon should not be reloading
	newWS := gs.GetWeaponState(playerID)
	if newWS.IsReloading {
		t.Error("new weapon should not be reloading")
	}
}

// TestManualReload_Success tests that pressing R triggers a manual reload
func TestManualReload_Success(t *testing.T) {
	clock := NewManualClock(time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC))
	gs := NewGameServerWithClock(nil, clock)

	// Add player
	playerID := "player1"
	gs.AddPlayer(playerID)

	// Fire a few shots to partially empty magazine
	ws := gs.GetWeaponState(playerID)
	ws.CurrentAmmo = 10

	// Trigger manual reload
	success := gs.PlayerReload(playerID)

	if !success {
		t.Error("manual reload should succeed")
	}

	if !ws.IsReloading {
		t.Error("weapon should be reloading after manual reload")
	}
}

// TestManualReload_FullMagazine tests that manual reload fails when magazine is full
func TestManualReload_FullMagazine(t *testing.T) {
	clock := NewManualClock(time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC))
	gs := NewGameServerWithClock(nil, clock)

	// Add player
	playerID := "player1"
	gs.AddPlayer(playerID)

	// Magazine is full
	ws := gs.GetWeaponState(playerID)
	if ws.CurrentAmmo != ws.Weapon.MagazineSize {
		t.Fatal("magazine should be full initially")
	}

	// Attempt manual reload
	success := gs.PlayerReload(playerID)

	if success {
		t.Error("manual reload should fail when magazine is full")
	}

	if ws.IsReloading {
		t.Error("weapon should not be reloading when magazine is full")
	}
}

// TestReloadCompletion tests that reload properly completes and refills ammo
func TestReloadCompletion(t *testing.T) {
	clock := NewManualClock(time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC))
	gs := NewGameServerWithClock(nil, clock)

	// Set up callback to track reload completion
	reloadCompleted := false
	gs.SetOnReloadComplete(func(playerID string) {
		reloadCompleted = true
	})

	// Add player
	playerID := "player1"
	gs.AddPlayer(playerID)

	// Start a reload
	ws := gs.GetWeaponState(playerID)
	ws.CurrentAmmo = 5
	ws.StartReload()

	// Verify reload is in progress
	if !ws.IsReloading {
		t.Fatal("reload should be in progress")
	}

	// Advance time past reload duration
	clock.Advance(ws.Weapon.ReloadTime + 100*time.Millisecond)

	// Manually call checkReloads (normally called by game loop)
	gs.checkReloads()

	// Verify reload completed
	if ws.IsReloading {
		t.Error("reload should be complete")
	}

	if ws.CurrentAmmo != ws.Weapon.MagazineSize {
		t.Errorf("magazine should be full after reload, got %d/%d", ws.CurrentAmmo, ws.Weapon.MagazineSize)
	}

	if !reloadCompleted {
		t.Error("reload completion callback should have been called")
	}
}

// TestReloadTimes tests that different weapons have correct reload times
func TestReloadTimes(t *testing.T) {
	tests := []struct {
		name         string
		weapon       *Weapon
		expectedTime time.Duration
	}{
		{"Pistol", NewPistol(), 1500 * time.Millisecond},
		{"Uzi", NewUzi(), 1500 * time.Millisecond},
		{"AK47", NewAK47(), 2000 * time.Millisecond},
		{"Shotgun", NewShotgun(), 2500 * time.Millisecond},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.weapon.ReloadTime != tt.expectedTime {
				t.Errorf("%s reload time should be %v, got %v", tt.name, tt.expectedTime, tt.weapon.ReloadTime)
			}
		})
	}
}

// TestMovementDuringReload tests that players can move while reloading
func TestMovementDuringReload(t *testing.T) {
	clock := NewManualClock(time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC))
	gs := NewGameServerWithClock(nil, clock)

	// Add player
	playerID := "player1"
	player := gs.AddPlayer(playerID)

	// Start a reload
	ws := gs.GetWeaponState(playerID)
	ws.CurrentAmmo = 5
	ws.StartReload()

	// Update player input to move forward
	input := InputState{
		Up:       true,
		Down:     false,
		Left:     false,
		Right:    false,
		AimAngle: 0,
	}
	gs.UpdatePlayerInput(playerID, input)

	// Store initial position
	initialPos := player.GetPosition()

	// Update physics for one tick
	gs.physics.UpdatePlayer(player, 1.0/60.0)

	// Verify player moved
	newPos := player.GetPosition()
	if newPos.Y >= initialPos.Y {
		t.Error("player should have moved upward during reload")
	}

	// Verify reload is still in progress
	if !ws.IsReloading {
		t.Error("reload should still be in progress after movement")
	}
}
