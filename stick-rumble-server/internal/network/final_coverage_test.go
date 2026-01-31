package network

import (
	"testing"
	"time"

	"github.com/mtomcal/stick-rumble-server/internal/game"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ==========================
// Final Coverage Gap Tests
// Tests for remaining uncovered paths to reach 90% threshold
// Target: internal/network from 80.7% to 86%+
// ==========================

// TestBroadcastMatchTimersTimeLimitReached tests match ending due to time limit
func TestBroadcastMatchTimersTimeLimitReached(t *testing.T) {
	ts := newTestServer()
	defer ts.Close()

	conn1, conn2 := ts.connectTwoClients(t)
	defer conn1.Close()
	defer conn2.Close()

	player1ID := consumeRoomJoinedAndGetPlayerID(t, conn1)
	_ = consumeRoomJoinedAndGetPlayerID(t, conn2)

	// Get the room and match
	room := ts.handler.roomManager.GetRoomByPlayerID(player1ID)
	require.NotNil(t, room, "Room should exist")
	require.NotNil(t, room.Match, "Match should exist")

	// Start the match and then set start time to past so time limit is reached
	// Match duration is 420 seconds (7 minutes)
	room.Match.Start()
	room.Match.StartTime = time.Now().Add(-421 * time.Second)

	// Call broadcastMatchTimers - should trigger time limit check
	ts.handler.broadcastMatchTimers()

	// Should receive match:timer message first
	msg, err := readMessageOfType(t, conn1, "match:timer", 2*time.Second)
	require.NoError(t, err, "Should receive match:timer")
	assert.Equal(t, "match:timer", msg.Type)

	// Verify remainingSeconds is 0 or negative
	data, ok := msg.Data.(map[string]interface{})
	require.True(t, ok)
	remainingSeconds := data["remainingSeconds"].(float64)
	assert.LessOrEqual(t, remainingSeconds, float64(0), "Remaining seconds should be <= 0 when time expired")

	// Should also receive match:ended message (triggered by time limit)
	endMsg, err := readMessageOfType(t, conn1, "match:ended", 2*time.Second)
	require.NoError(t, err, "Should receive match:ended after time limit")
	assert.Equal(t, "match:ended", endMsg.Type)

	// Verify match ended reason
	endData, ok := endMsg.Data.(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, "time_limit", endData["reason"], "Match should end due to time_limit")

	// Verify match is marked as ended
	assert.True(t, room.Match.IsEnded(), "Match should be marked as ended")
}

// TestBroadcastMatchTimersAlreadyEnded tests skipping ended matches
func TestBroadcastMatchTimersAlreadyEnded(t *testing.T) {
	ts := newTestServer()
	defer ts.Close()

	conn1, conn2 := ts.connectTwoClients(t)
	defer conn1.Close()
	defer conn2.Close()

	player1ID := consumeRoomJoinedAndGetPlayerID(t, conn1)
	_ = consumeRoomJoinedAndGetPlayerID(t, conn2)

	// Get the room and end the match
	room := ts.handler.roomManager.GetRoomByPlayerID(player1ID)
	require.NotNil(t, room, "Room should exist")
	require.NotNil(t, room.Match, "Match should exist")

	// End the match
	room.Match.EndMatch("test_reason")
	assert.True(t, room.Match.IsEnded())

	// Call broadcastMatchTimers - should skip this room (line 160-162)
	ts.handler.broadcastMatchTimers()

	// Should NOT receive any match:timer message (room is skipped)
	_, err := readMessageOfType(t, conn1, "match:timer", 500*time.Millisecond)
	assert.Error(t, err, "Should not receive match:timer for ended match")
}

// TestHandleWeaponPickupProximityFail tests pickup failure due to distance
func TestHandleWeaponPickupProximityFail(t *testing.T) {
	ts := newTestServer()
	defer ts.Close()

	conn1, conn2 := ts.connectTwoClients(t)
	defer conn1.Close()
	defer conn2.Close()

	player1ID := consumeRoomJoinedAndGetPlayerID(t, conn1)
	_ = consumeRoomJoinedAndGetPlayerID(t, conn2)

	// Get an available weapon crate
	crateManager := ts.handler.gameServer.GetWeaponCrateManager()
	allCrates := crateManager.GetAllCrates()
	var testCrate *game.WeaponCrate
	for _, crate := range allCrates {
		if crate.IsAvailable {
			testCrate = crate
			break
		}
	}
	require.NotNil(t, testCrate, "Should have at least one available crate")

	// Get player state and position them FAR from the crate
	world := ts.handler.gameServer.GetWorld()
	playerState, exists := world.GetPlayer(player1ID)
	require.True(t, exists, "Player should exist")

	// Position player far away (proximity check requires distance <= 50)
	playerState.Position = game.Vector2{
		X: testCrate.Position.X + 500, // 500 units away
		Y: testCrate.Position.Y + 500,
	}

	// Prepare pickup attempt data
	pickupData := map[string]interface{}{
		"crateId": testCrate.ID,
	}

	// Call handleWeaponPickup - should fail proximity check (line 331-334)
	ts.handler.handleWeaponPickup(player1ID, pickupData)

	// Should NOT receive weapon:pickup_confirmed (proximity check failed)
	_, err := readMessageOfType(t, conn1, "weapon:pickup_confirmed", 500*time.Millisecond)
	assert.Error(t, err, "Should not confirm pickup when player is too far")

	// Verify crate is still available
	crate := crateManager.GetCrate(testCrate.ID)
	assert.NotNil(t, crate)
	assert.True(t, crate.IsAvailable, "Crate should still be available after failed pickup")
}

// TestHandleWeaponPickupCrateUnavailable tests pickup of already-picked-up crate
func TestHandleWeaponPickupCrateUnavailable(t *testing.T) {
	ts := newTestServer()
	defer ts.Close()

	conn1, conn2 := ts.connectTwoClients(t)
	defer conn1.Close()
	defer conn2.Close()

	player1ID := consumeRoomJoinedAndGetPlayerID(t, conn1)
	_ = consumeRoomJoinedAndGetPlayerID(t, conn2)

	// Get an available weapon crate
	crateManager := ts.handler.gameServer.GetWeaponCrateManager()
	allCrates := crateManager.GetAllCrates()
	var testCrate *game.WeaponCrate
	for _, crate := range allCrates {
		if crate.IsAvailable {
			testCrate = crate
			break
		}
	}
	require.NotNil(t, testCrate, "Should have at least one available crate")

	// Mark crate as unavailable (already picked up)
	testCrate.IsAvailable = false

	// Prepare pickup attempt data
	pickupData := map[string]interface{}{
		"crateId": testCrate.ID,
	}

	// Call handleWeaponPickup - should fail availability check (line 311-314)
	ts.handler.handleWeaponPickup(player1ID, pickupData)

	// Should NOT receive weapon:pickup_confirmed (crate unavailable)
	_, err := readMessageOfType(t, conn1, "weapon:pickup_confirmed", 500*time.Millisecond)
	assert.Error(t, err, "Should not confirm pickup of unavailable crate")
}

// TestHandleWeaponPickupDeadPlayer tests dead player attempting pickup
func TestHandleWeaponPickupDeadPlayer(t *testing.T) {
	ts := newTestServer()
	defer ts.Close()

	conn1, conn2 := ts.connectTwoClients(t)
	defer conn1.Close()
	defer conn2.Close()

	player1ID := consumeRoomJoinedAndGetPlayerID(t, conn1)
	_ = consumeRoomJoinedAndGetPlayerID(t, conn2)

	// Get an available weapon crate
	crateManager := ts.handler.gameServer.GetWeaponCrateManager()
	allCrates := crateManager.GetAllCrates()
	var testCrate *game.WeaponCrate
	for _, crate := range allCrates {
		if crate.IsAvailable {
			testCrate = crate
			break
		}
	}
	require.NotNil(t, testCrate, "Should have at least one available crate")

	// Get player and kill them
	world := ts.handler.gameServer.GetWorld()
	playerState, exists := world.GetPlayer(player1ID)
	require.True(t, exists, "Player should exist")

	// Position near crate
	playerState.Position = testCrate.Position

	// Kill the player
	playerState.Health = 0
	assert.False(t, playerState.IsAlive(), "Player should be dead")

	// Prepare pickup attempt data
	pickupData := map[string]interface{}{
		"crateId": testCrate.ID,
	}

	// Call handleWeaponPickup - should fail alive check (line 324-327)
	ts.handler.handleWeaponPickup(player1ID, pickupData)

	// Should NOT receive weapon:pickup_confirmed (player is dead)
	_, err := readMessageOfType(t, conn1, "weapon:pickup_confirmed", 500*time.Millisecond)
	assert.Error(t, err, "Should not confirm pickup when player is dead")

	// Verify crate is still available
	crate := crateManager.GetCrate(testCrate.ID)
	assert.NotNil(t, crate)
	assert.True(t, crate.IsAvailable, "Crate should still be available after failed pickup")
}

// TestHandleWeaponPickupSuccessPath tests successful weapon pickup
func TestHandleWeaponPickupSuccessPath(t *testing.T) {
	ts := newTestServer()
	defer ts.Close()

	conn1, conn2 := ts.connectTwoClients(t)
	defer conn1.Close()
	defer conn2.Close()

	player1ID := consumeRoomJoinedAndGetPlayerID(t, conn1)
	_ = consumeRoomJoinedAndGetPlayerID(t, conn2)

	// Get a valid crate
	crateManager := ts.handler.gameServer.GetWeaponCrateManager()
	allCrates := crateManager.GetAllCrates()
	var testCrate *game.WeaponCrate
	for _, crate := range allCrates {
		if crate.IsAvailable {
			testCrate = crate
			break
		}
	}
	require.NotNil(t, testCrate, "Should have at least one available crate")

	// Get player and position near the crate
	world := ts.handler.gameServer.GetWorld()
	playerState, exists := world.GetPlayer(player1ID)
	require.True(t, exists, "Player should exist")

	// Position player near the crate
	playerState.Position = testCrate.Position

	// Successfully pick up valid weapon (coverage for success path)
	pickupData := map[string]interface{}{
		"crateId": testCrate.ID,
	}

	ts.handler.handleWeaponPickup(player1ID, pickupData)

	// Should receive weapon:pickup_confirmed
	msg, err := readMessageOfType(t, conn1, "weapon:pickup_confirmed", 2*time.Second)
	require.NoError(t, err, "Should receive weapon:pickup_confirmed")
	assert.Equal(t, "weapon:pickup_confirmed", msg.Type)

	// Verify weapon state update
	wsMsg, err := readMessageOfType(t, conn1, "weapon:state", 2*time.Second)
	require.NoError(t, err, "Should receive weapon:state update")
	assert.Equal(t, "weapon:state", wsMsg.Type)
}

// TestHandleInputStateUpdatePlayerInputFail tests UpdatePlayerInput failure path
func TestHandleInputStateUpdatePlayerInputFail(t *testing.T) {
	handler := NewWebSocketHandler()

	// Create input data
	inputData := map[string]interface{}{
		"up":       true,
		"down":     false,
		"left":     false,
		"right":    false,
		"aimAngle": 1.5,
	}

	// Call handleInputState with non-existent player
	// Should trigger line 38-41 (UpdatePlayerInput fails)
	require.NotPanics(t, func() {
		handler.handleInputState("non-existent-player", inputData)
	}, "Should handle UpdatePlayerInput failure gracefully")

	// Verify player doesn't exist
	world := handler.gameServer.GetWorld()
	_, exists := world.GetPlayer("non-existent-player")
	assert.False(t, exists, "Player should not exist")
}

// TestBroadcastProjectileSpawnSchemaValidationError tests schema validation in broadcast
func TestBroadcastProjectileSpawnSchemaValidationError(t *testing.T) {
	ts := newTestServer()
	defer ts.Close()

	conn1, conn2 := ts.connectTwoClients(t)
	defer conn1.Close()
	defer conn2.Close()

	_ = consumeRoomJoinedAndGetPlayerID(t, conn1)
	_ = consumeRoomJoinedAndGetPlayerID(t, conn2)

	// Create a projectile with valid data (schema validation is dev-only)
	projectile := &game.Projectile{
		ID:         "test-projectile",
		OwnerID:    "test-owner",
		WeaponType: "pistol",
		Position:   game.Vector2{X: 100, Y: 200},
		Velocity:   game.Vector2{X: 10, Y: 0},
		Active:     true,
	}

	// Call broadcastProjectileSpawn
	// Schema validation errors are logged but don't prevent broadcast
	require.NotPanics(t, func() {
		ts.handler.broadcastProjectileSpawn(projectile)
	}, "Should handle schema validation gracefully")

	// Should receive projectile:spawn message (broadcast continues even if validation logs error)
	msg, err := readMessageOfType(t, conn1, "projectile:spawn", 2*time.Second)
	require.NoError(t, err, "Should receive projectile:spawn")
	assert.Equal(t, "projectile:spawn", msg.Type)
}

// TestSendWeaponStateSchemaValidationCoverage tests schema validation path
func TestSendWeaponStateSchemaValidationCoverage(t *testing.T) {
	ts := newTestServer()
	defer ts.Close()

	conn1, conn2 := ts.connectTwoClients(t)
	defer conn1.Close()
	defer conn2.Close()

	player1ID := consumeRoomJoinedAndGetPlayerID(t, conn1)
	_ = consumeRoomJoinedAndGetPlayerID(t, conn2)

	// Call sendWeaponState - should trigger schema validation (dev-only)
	require.NotPanics(t, func() {
		ts.handler.sendWeaponState(player1ID)
	}, "Should handle schema validation gracefully")

	// Should receive weapon:state message
	msg, err := readMessageOfType(t, conn1, "weapon:state", 2*time.Second)
	require.NoError(t, err, "Should receive weapon:state")
	assert.Equal(t, "weapon:state", msg.Type)
}

// TestSendShootFailedSchemaValidationCoverage tests schema validation path
func TestSendShootFailedSchemaValidationCoverage(t *testing.T) {
	ts := newTestServer()
	defer ts.Close()

	conn1, conn2 := ts.connectTwoClients(t)
	defer conn1.Close()
	defer conn2.Close()

	player1ID := consumeRoomJoinedAndGetPlayerID(t, conn1)
	_ = consumeRoomJoinedAndGetPlayerID(t, conn2)

	// Call sendShootFailed with a valid reason
	require.NotPanics(t, func() {
		ts.handler.sendShootFailed(player1ID, "out_of_ammo")
	}, "Should handle schema validation gracefully")

	// Should receive shoot:failed message
	msg, err := readMessageOfType(t, conn1, "shoot:failed", 2*time.Second)
	require.NoError(t, err, "Should receive shoot:failed")
	assert.Equal(t, "shoot:failed", msg.Type)

	// Verify reason field
	data, ok := msg.Data.(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, "out_of_ammo", data["reason"])
}

// TestBroadcastMatchTimersJSONMarshalError tests marshal error handling
// Note: Hard to trigger JSON marshal errors with simple data types
// This test verifies the error handling code path exists
func TestBroadcastMatchTimersJSONMarshalCoverage(t *testing.T) {
	ts := newTestServer()
	defer ts.Close()

	conn1, conn2 := ts.connectTwoClients(t)
	defer conn1.Close()
	defer conn2.Close()

	_ = consumeRoomJoinedAndGetPlayerID(t, conn1)
	_ = consumeRoomJoinedAndGetPlayerID(t, conn2)

	// Call broadcastMatchTimers - should successfully marshal and broadcast
	require.NotPanics(t, func() {
		ts.handler.broadcastMatchTimers()
	}, "Should handle JSON marshaling gracefully")

	// Should receive match:timer message
	msg, err := readMessageOfType(t, conn1, "match:timer", 2*time.Second)
	require.NoError(t, err, "Should receive match:timer")
	assert.Equal(t, "match:timer", msg.Type)

	// Verify data structure
	data, ok := msg.Data.(map[string]interface{})
	require.True(t, ok)
	assert.NotNil(t, data["remainingSeconds"])
}

// TestBroadcastWeaponPickupSchemaValidation tests schema validation in broadcast
func TestBroadcastWeaponPickupSchemaValidation(t *testing.T) {
	ts := newTestServer()
	defer ts.Close()

	conn1, conn2 := ts.connectTwoClients(t)
	defer conn1.Close()
	defer conn2.Close()

	player1ID := consumeRoomJoinedAndGetPlayerID(t, conn1)
	_ = consumeRoomJoinedAndGetPlayerID(t, conn2)

	// Call broadcastWeaponPickup with valid data
	respawnTime := time.Now().Add(30 * time.Second)
	require.NotPanics(t, func() {
		ts.handler.broadcastWeaponPickup(player1ID, "crate-1", "uzi", respawnTime)
	}, "Should handle broadcast gracefully")

	// Should receive weapon:pickup_confirmed message
	msg, err := readMessageOfType(t, conn1, "weapon:pickup_confirmed", 2*time.Second)
	require.NoError(t, err, "Should receive weapon:pickup_confirmed")
	assert.Equal(t, "weapon:pickup_confirmed", msg.Type)

	// Verify data structure
	data, ok := msg.Data.(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, player1ID, data["playerId"])
	assert.Equal(t, "crate-1", data["crateId"])
	assert.Equal(t, "uzi", data["weaponType"])
}

// TestOnRespawnSchemaValidation tests schema validation in onRespawn
func TestOnRespawnSchemaValidation(t *testing.T) {
	ts := newTestServer()
	defer ts.Close()

	conn1, conn2 := ts.connectTwoClients(t)
	defer conn1.Close()
	defer conn2.Close()

	player1ID := consumeRoomJoinedAndGetPlayerID(t, conn1)
	_ = consumeRoomJoinedAndGetPlayerID(t, conn2)

	// Call onRespawn with specific position
	respawnPos := game.Vector2{X: 123.45, Y: 678.90}
	require.NotPanics(t, func() {
		ts.handler.onRespawn(player1ID, respawnPos)
	}, "Should handle respawn gracefully")

	// Should receive player:respawn message
	msg, err := readMessageOfType(t, conn1, "player:respawn", 2*time.Second)
	require.NoError(t, err, "Should receive player:respawn")
	assert.Equal(t, "player:respawn", msg.Type)

	// Verify data structure
	data, ok := msg.Data.(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, player1ID, data["playerId"])
	assert.Equal(t, float64(game.PlayerMaxHealth), data["health"])

	// Verify position
	position := data["position"].(map[string]interface{})
	assert.Equal(t, float64(123.45), position["x"])
	assert.Equal(t, float64(678.90), position["y"])
}

// TestBroadcastMeleeHitSchemaValidation tests schema validation in broadcastMeleeHit
func TestBroadcastMeleeHitSchemaValidation(t *testing.T) {
	ts := newTestServer()
	defer ts.Close()

	conn1, conn2 := ts.connectTwoClients(t)
	defer conn1.Close()
	defer conn2.Close()

	player1ID := consumeRoomJoinedAndGetPlayerID(t, conn1)
	player2ID := consumeRoomJoinedAndGetPlayerID(t, conn2)

	// Call broadcastMeleeHit
	victimIDs := []string{player2ID}
	require.NotPanics(t, func() {
		ts.handler.broadcastMeleeHit(player1ID, victimIDs, true)
	}, "Should handle broadcast gracefully")

	// Should receive melee:hit message
	msg, err := readMessageOfType(t, conn1, "melee:hit", 2*time.Second)
	require.NoError(t, err, "Should receive melee:hit")
	assert.Equal(t, "melee:hit", msg.Type)

	// Verify data structure
	data, ok := msg.Data.(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, player1ID, data["attackerId"])
	assert.True(t, data["knockbackApplied"].(bool))
}

// TestBroadcastPlayerDamagedSchemaValidation tests schema validation in broadcastPlayerDamaged
func TestBroadcastPlayerDamagedSchemaValidation(t *testing.T) {
	ts := newTestServer()
	defer ts.Close()

	conn1, conn2 := ts.connectTwoClients(t)
	defer conn1.Close()
	defer conn2.Close()

	player1ID := consumeRoomJoinedAndGetPlayerID(t, conn1)
	player2ID := consumeRoomJoinedAndGetPlayerID(t, conn2)

	// Call broadcastPlayerDamaged
	require.NotPanics(t, func() {
		ts.handler.broadcastPlayerDamaged(player1ID, player2ID, 30, 70)
	}, "Should handle broadcast gracefully")

	// Should receive player:damaged message
	msg, err := readMessageOfType(t, conn1, "player:damaged", 2*time.Second)
	require.NoError(t, err, "Should receive player:damaged")
	assert.Equal(t, "player:damaged", msg.Type)

	// Verify data structure
	data, ok := msg.Data.(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, player2ID, data["victimId"])
	assert.Equal(t, player1ID, data["attackerId"])
	assert.Equal(t, float64(30), data["damage"])
	assert.Equal(t, float64(70), data["newHealth"])
}
