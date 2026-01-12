package game

import (
	"context"
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

func TestGameServerRespawn_WeaponStateReset(t *testing.T) {
	// Create ManualClock and GameServer with it
	clock := NewManualClock(time.Now())
	gs := NewGameServerWithClock(nil, clock)
	playerID := "test-player-1"

	// Add player and get weapon state
	gs.AddPlayer(playerID)
	ws := gs.GetWeaponState(playerID)

	// Deplete ammo by shooting
	for i := 0; i < 10; i++ {
		if ws.CanShoot() {
			ws.RecordShot()
			// Advance clock past fire rate cooldown
			clock.Advance(400 * time.Millisecond)
		}
	}

	// Start reloading
	ws.StartReload()

	// Verify weapon is not in default state
	if ws.CurrentAmmo >= PistolMagazineSize {
		t.Error("Ammo should be depleted before respawn")
	}
	if !ws.IsReloading {
		t.Error("Weapon should be reloading before respawn")
	}

	// Kill the player
	player, _ := gs.world.GetPlayer(playerID)
	player.MarkDead()

	// Advance clock past respawn delay and manually call checkRespawns
	clock.Advance(time.Duration(RespawnDelay*1000+100) * time.Millisecond)
	gs.checkRespawns()

	// Get weapon state after respawn
	wsAfterRespawn := gs.GetWeaponState(playerID)

	// Verify weapon state is reset to default pistol
	if wsAfterRespawn.CurrentAmmo != PistolMagazineSize {
		t.Errorf("After respawn: CurrentAmmo = %d, want %d", wsAfterRespawn.CurrentAmmo, PistolMagazineSize)
	}
	if wsAfterRespawn.IsReloading {
		t.Error("After respawn: weapon should not be reloading")
	}
	if wsAfterRespawn.Weapon.Name != "Pistol" {
		t.Errorf("After respawn: weapon name = %s, want Pistol", wsAfterRespawn.Weapon.Name)
	}
}
