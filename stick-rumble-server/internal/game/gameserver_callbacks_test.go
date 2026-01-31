package game

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Helper to create a dummy broadcast function
func noBroadcast(playerStates []PlayerState) {}

// ==========================
// Callback Setter Tests
// ==========================

func TestSetOnRespawn(t *testing.T) {
	clock := NewManualClock(time.Now())
	gs := NewGameServerWithClock(noBroadcast, clock)

	// Set respawn callback
	var respawnedPlayerID string
	var respawnPosition Vector2
	gs.SetOnRespawn(func(playerID string, position Vector2) {
		respawnedPlayerID = playerID
		respawnPosition = position
	})

	// Add player
	gs.AddPlayer("player1")

	// Kill player
	gs.MarkPlayerDead("player1")

	// Advance time past respawn delay (in seconds)
	clock.Advance(time.Duration(RespawnDelay*1000+100) * time.Millisecond)
	gs.checkRespawns()

	// Verify callback was called
	assert.Equal(t, "player1", respawnedPlayerID, "Callback should receive player ID")
	assert.NotZero(t, respawnPosition.X, "Callback should receive respawn position")
}

func TestSetOnWeaponPickup(t *testing.T) {
	clock := NewManualClock(time.Now())
	gs := NewGameServerWithClock(noBroadcast, clock)

	// Set weapon pickup callback
	callbackCalled := false

	gs.SetOnWeaponPickup(func(playerID, crateID, weaponType string, respawnTime time.Time) {
		callbackCalled = true
	})

	// Add player
	gs.AddPlayer("player1")

	// Get a weapon crate
	crateManager := gs.GetWeaponCrateManager()
	allCrates := crateManager.GetAllCrates()
	require.NotEmpty(t, allCrates, "Should have default weapon crates")

	var testCrate *WeaponCrate
	for _, crate := range allCrates {
		if crate.IsAvailable {
			testCrate = crate
			break
		}
	}
	require.NotNil(t, testCrate, "Should have at least one available crate")

	// Position player at crate
	player, exists := gs.world.GetPlayer("player1")
	require.True(t, exists)
	player.Position = testCrate.Position

	// Pickup weapon
	crateManager.PickupCrate(testCrate.ID)

	// Verify callback can be set (callback is triggered by network layer, not gameserver)
	assert.False(t, callbackCalled, "Callback should not be called by gameserver directly")
}

func TestSetOnWeaponRespawn(t *testing.T) {
	gs := NewGameServer(noBroadcast)

	// Set weapon respawn callback
	callbackCalled := false
	gs.SetOnWeaponRespawn(func(crate *WeaponCrate) {
		callbackCalled = true
	})

	// Verify callback can be set (actual respawn timing uses time.Now() not clock interface)
	// We just verify the setter works without panic
	assert.False(t, callbackCalled, "Callback should not be called immediately")
}

func TestSetOnRollEnd(t *testing.T) {
	clock := NewManualClock(time.Now())
	gs := NewGameServerWithClock(noBroadcast, clock)

	// Set roll end callback
	var rolledPlayerID string
	var rollEndReason string
	gs.SetOnRollEnd(func(playerID, reason string) {
		rolledPlayerID = playerID
		rollEndReason = reason
	})

	// Add player
	gs.AddPlayer("player1")

	// Get player and start a dodge roll
	player, exists := gs.world.GetPlayer("player1")
	require.True(t, exists)

	rollDirection := Vector2{X: 1.0, Y: 0.0}
	player.StartDodgeRoll(rollDirection)

	// Advance time past roll duration (in seconds)
	clock.Advance(time.Duration(DodgeRollDuration*1000+100) * time.Millisecond)

	// Check roll duration (should trigger callback)
	gs.checkRollDuration()

	// Verify callback was called
	assert.Equal(t, "player1", rolledPlayerID, "Callback should receive player ID")
	assert.Equal(t, "completed", rollEndReason, "Callback should receive reason")
}

func TestGetWeaponCrateManager(t *testing.T) {
	gs := NewGameServer(noBroadcast)

	// Get weapon crate manager
	crateManager := gs.GetWeaponCrateManager()
	assert.NotNil(t, crateManager, "Should return weapon crate manager")

	// Verify it has default weapon crates
	allCrates := crateManager.GetAllCrates()
	assert.NotEmpty(t, allCrates, "Should have default weapon crates")
}

// ==========================
// checkRollDuration Tests
// ==========================

func TestCheckRollDuration_Complete(t *testing.T) {
	clock := NewManualClock(time.Now())
	gs := NewGameServerWithClock(noBroadcast, clock)

	// Set roll end callback to track calls
	var callbackCalled bool
	var callbackPlayerID string
	gs.SetOnRollEnd(func(playerID, reason string) {
		callbackCalled = true
		callbackPlayerID = playerID
	})

	// Add player and start roll
	gs.AddPlayer("player1")
	player, _ := gs.world.GetPlayer("player1")

	rollDirection := Vector2{X: 1.0, Y: 0.0}
	player.StartDodgeRoll(rollDirection)

	// Advance time past roll duration
	clock.Advance(time.Duration(DodgeRollDuration*1000+50) * time.Millisecond)

	// Check roll duration
	gs.checkRollDuration()

	// Verify callback was called
	assert.True(t, callbackCalled, "Callback should be called")
	assert.Equal(t, "player1", callbackPlayerID)

	// Verify player is no longer rolling
	assert.False(t, player.IsRolling(), "Player should no longer be rolling")
}

func TestCheckRollDuration_StillRolling(t *testing.T) {
	clock := NewManualClock(time.Now())
	gs := NewGameServerWithClock(noBroadcast, clock)

	// Add player and start roll
	gs.AddPlayer("player1")
	player, _ := gs.world.GetPlayer("player1")

	rollDirection := Vector2{X: 1.0, Y: 0.0}
	player.StartDodgeRoll(rollDirection)

	// Advance time but not past roll duration
	clock.Advance(time.Duration(DodgeRollDuration*1000/2) * time.Millisecond)

	// Check roll duration
	gs.checkRollDuration()

	// Player should still be rolling
	assert.True(t, player.IsRolling(), "Player should still be rolling")
}

func TestCheckRollDuration_NoActivePlayers(t *testing.T) {
	gs := NewGameServer(noBroadcast)

	// Set callback to verify it's NOT called
	callbackCalled := false
	gs.SetOnRollEnd(func(playerID, reason string) {
		callbackCalled = true
	})

	// Check with no players - should not panic
	require.NotPanics(t, func() {
		gs.checkRollDuration()
	}, "Should handle no active players without panic")

	// Verify callback was NOT called (no players rolling)
	assert.False(t, callbackCalled, "Callback should not be called when no players exist")
}

func TestCheckRollDuration_MultipleRollingPlayers(t *testing.T) {
	clock := NewManualClock(time.Now())
	gs := NewGameServerWithClock(noBroadcast, clock)

	callCount := 0
	gs.SetOnRollEnd(func(playerID, reason string) {
		callCount++
	})

	// Add two players and start rolls
	gs.AddPlayer("player1")
	gs.AddPlayer("player2")

	player1, _ := gs.world.GetPlayer("player1")
	player2, _ := gs.world.GetPlayer("player2")

	player1.StartDodgeRoll(Vector2{X: 1.0, Y: 0.0})
	player2.StartDodgeRoll(Vector2{X: 0.0, Y: 1.0})

	// Advance time past roll duration
	clock.Advance(time.Duration(DodgeRollDuration*1000+50) * time.Millisecond)

	// Check roll duration
	gs.checkRollDuration()

	// Both callbacks should be called
	assert.Equal(t, 2, callCount, "Callback should be called for both players")
	assert.False(t, player1.IsRolling())
	assert.False(t, player2.IsRolling())
}

// ==========================
// checkWeaponRespawns Tests
// ==========================

func TestCheckWeaponRespawns_RespawnReady(t *testing.T) {
	gs := NewGameServer(noBroadcast)

	// Set weapon respawn callback
	callbackCalled := false
	gs.SetOnWeaponRespawn(func(crate *WeaponCrate) {
		callbackCalled = true
	})

	// Get a weapon crate
	crateManager := gs.GetWeaponCrateManager()
	allCrates := crateManager.GetAllCrates()
	require.NotEmpty(t, allCrates)

	var testCrate *WeaponCrate
	for _, crate := range allCrates {
		if crate.IsAvailable {
			testCrate = crate
			break
		}
	}
	require.NotNil(t, testCrate)

	// Pick up the crate
	crateManager.PickupCrate(testCrate.ID)
	assert.False(t, testCrate.IsAvailable, "Crate should not be available after pickup")

	// Set respawn time to the past to trigger respawn
	testCrate.RespawnTime = time.Now().Add(-1 * time.Second)

	// Check weapon respawns
	gs.checkWeaponRespawns()

	// Verify callback was called
	assert.True(t, callbackCalled, "Callback should be called for respawned crate")

	// Verify crate is now available
	updatedCrate := crateManager.GetCrate(testCrate.ID)
	assert.True(t, updatedCrate.IsAvailable, "Crate should be available after respawn")
}

func TestCheckWeaponRespawns_NotYetReady(t *testing.T) {
	gs := NewGameServer(noBroadcast)

	callbackCalled := false
	gs.SetOnWeaponRespawn(func(crate *WeaponCrate) {
		callbackCalled = true
	})

	// Get a weapon crate and pick it up
	crateManager := gs.GetWeaponCrateManager()
	allCrates := crateManager.GetAllCrates()
	require.NotEmpty(t, allCrates)

	var testCrate *WeaponCrate
	for _, crate := range allCrates {
		if crate.IsAvailable {
			testCrate = crate
			break
		}
	}
	require.NotNil(t, testCrate)

	crateManager.PickupCrate(testCrate.ID)

	// Set respawn time in the future
	testCrate.RespawnTime = time.Now().Add(100 * time.Second)

	// Check weapon respawns
	gs.checkWeaponRespawns()

	// Callback should not be called yet
	assert.False(t, callbackCalled, "Callback should not be called before respawn time")

	// Crate should still be unavailable
	assert.False(t, testCrate.IsAvailable, "Crate should still be unavailable")
}

func TestCheckWeaponRespawns_NoCrates(t *testing.T) {
	gs := NewGameServer(noBroadcast)

	// Set callback to verify it's NOT called
	callbackCalled := false
	gs.SetOnWeaponRespawn(func(crate *WeaponCrate) {
		callbackCalled = true
	})

	// Create game server without weapon crates
	gs.weaponCrateManager = NewWeaponCrateManager()

	// Check weapon respawns - should not panic
	require.NotPanics(t, func() {
		gs.checkWeaponRespawns()
	}, "Should handle no crates without panic")

	// Verify callback was NOT called (no crates to respawn)
	assert.False(t, callbackCalled, "Callback should not be called when no crates exist")
}

func TestCheckWeaponRespawns_AllAvailable(t *testing.T) {
	gs := NewGameServer(noBroadcast)

	callbackCalled := false
	gs.SetOnWeaponRespawn(func(crate *WeaponCrate) {
		callbackCalled = true
	})

	// All crates are available by default
	gs.checkWeaponRespawns()

	// Callback should not be called since all crates are available
	assert.False(t, callbackCalled, "Callback should not be called for already available crates")
}

// ==========================
// Additional Coverage Tests
// ==========================

func TestPlayerMeleeAttack_Success(t *testing.T) {
	gs := NewGameServer(noBroadcast)

	// Add two players
	gs.AddPlayer("player1")
	gs.AddPlayer("player2")

	// Equip player1 with melee weapon
	batWeapon := NewBat()
	gs.SetWeaponState("player1", NewWeaponState(batWeapon))

	// Position players close together
	player1, _ := gs.world.GetPlayer("player1")
	player2, _ := gs.world.GetPlayer("player2")

	player1.Position = Vector2{X: 100, Y: 100}
	player2.Position = Vector2{X: 110, Y: 100} // 10 units away

	// Perform melee attack
	result := gs.PlayerMeleeAttack("player1", 0.0)

	// Verify success
	assert.True(t, result.Success, "Melee attack should succeed")
	assert.NotEmpty(t, result.HitPlayers, "Should hit player2")
	assert.Equal(t, "player2", result.HitPlayers[0].ID)
}

func TestPlayerMeleeAttack_PlayerNotFound(t *testing.T) {
	gs := NewGameServer(noBroadcast)

	// Attempt melee attack with non-existent player
	result := gs.PlayerMeleeAttack("non-existent", 0.0)

	assert.False(t, result.Success, "Should fail")
	assert.Equal(t, MeleeFailedNoPlayer, result.Reason)
}

func TestPlayerMeleeAttack_PlayerDead(t *testing.T) {
	gs := NewGameServer(noBroadcast)

	// Add player and kill them
	gs.AddPlayer("player1")
	gs.MarkPlayerDead("player1")

	// Attempt melee attack
	result := gs.PlayerMeleeAttack("player1", 0.0)

	assert.False(t, result.Success, "Dead player should not be able to attack")
	assert.Equal(t, MeleeFailedPlayerDead, result.Reason)
}

func TestPlayerMeleeAttack_NoWeapon(t *testing.T) {
	gs := NewGameServer(noBroadcast)

	// Add player but don't set weapon
	gs.AddPlayer("player1")

	// Remove default weapon
	gs.weaponMu.Lock()
	delete(gs.weaponStates, "player1")
	gs.weaponMu.Unlock()

	// Attempt melee attack
	result := gs.PlayerMeleeAttack("player1", 0.0)

	assert.False(t, result.Success, "Should fail without weapon")
	assert.Equal(t, MeleeFailedNoWeapon, result.Reason)
}

func TestPlayerMeleeAttack_NotMeleeWeapon(t *testing.T) {
	gs := NewGameServer(noBroadcast)

	// Add player and equip with ranged weapon
	gs.AddPlayer("player1")

	pistol := NewPistol()
	gs.SetWeaponState("player1", NewWeaponState(pistol))

	// Attempt melee attack with ranged weapon
	result := gs.PlayerMeleeAttack("player1", 0.0)

	assert.False(t, result.Success, "Should fail with ranged weapon")
	assert.Equal(t, MeleeFailedNotMelee, result.Reason)
}

func TestPlayerMeleeAttack_NoVictims(t *testing.T) {
	gs := NewGameServer(noBroadcast)

	// Add player with melee weapon
	gs.AddPlayer("player1")

	batWeapon := NewBat()
	gs.SetWeaponState("player1", NewWeaponState(batWeapon))

	// No other players to hit
	result := gs.PlayerMeleeAttack("player1", 0.0)

	// Should succeed but with no victims
	assert.True(t, result.Success, "Attack should succeed")
	assert.Empty(t, result.HitPlayers, "Should have no victims")
}

func TestGetWorld(t *testing.T) {
	gs := NewGameServer(noBroadcast)

	world := gs.GetWorld()
	assert.NotNil(t, world, "Should return world instance")
	assert.Equal(t, gs.world, world, "Should return the game server's world")
}
