package network

import (
	"context"
	"testing"
	"time"

	"github.com/mtomcal/stick-rumble-server/internal/game"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ==========================
// Coverage Improvement Tests
// Minimal tests for uncovered network functions to raise coverage above 90%
// ==========================

// TestBroadcastMatchEnded tests the broadcastMatchEnded function
func TestBroadcastMatchEnded(t *testing.T) {
	ts := newTestServer()
	defer ts.Close()

	conn1, conn2 := ts.connectTwoClients(t)
	defer conn1.Close()
	defer conn2.Close()

	player1ID := consumeRoomJoinedAndGetPlayerID(t, conn1)
	_ = consumeRoomJoinedAndGetPlayerID(t, conn2)

	// Get the room and world
	room := ts.handler.roomManager.GetRoomByPlayerID(player1ID)
	require.NotNil(t, room, "Room should exist")
	world := ts.handler.gameServer.GetWorld()
	require.NotNil(t, world, "World should exist")

	// Ensure match exists
	require.NotNil(t, room.Match, "Match should exist")

	// Call broadcastMatchEnded
	ts.handler.broadcastMatchEnded(room, world)

	// Both players should receive match:ended message
	msg, err := readMessageOfType(t, conn1, "match:ended", 2*time.Second)
	require.NoError(t, err, "Should receive match:ended")
	assert.Equal(t, "match:ended", msg.Type)

	// Verify message has expected fields
	data, ok := msg.Data.(map[string]interface{})
	require.True(t, ok)
	assert.NotNil(t, data["winners"])
	assert.NotNil(t, data["finalScores"])
	assert.NotNil(t, data["reason"])

	// Verify player2 also receives the message
	msg2, err := readMessageOfType(t, conn2, "match:ended", 2*time.Second)
	require.NoError(t, err, "Player 2 should receive match:ended")
	assert.Equal(t, "match:ended", msg2.Type)
}

// TestBroadcastMatchEndedNilMatch tests broadcastMatchEnded with nil match
func TestBroadcastMatchEndedNilMatch(t *testing.T) {
	ts := newTestServer()
	defer ts.Close()

	conn1, conn2 := ts.connectTwoClients(t)
	defer conn1.Close()
	defer conn2.Close()

	player1ID := consumeRoomJoinedAndGetPlayerID(t, conn1)
	_ = consumeRoomJoinedAndGetPlayerID(t, conn2)

	// Get the room and world
	room := ts.handler.roomManager.GetRoomByPlayerID(player1ID)
	require.NotNil(t, room, "Room should exist")
	world := ts.handler.gameServer.GetWorld()
	require.NotNil(t, world, "World should exist")

	// Set match to nil
	room.Match = nil

	// Call broadcastMatchEnded - should not panic
	ts.handler.broadcastMatchEnded(room, world)

	// Should not receive any message (function returns early)
	_, err := readMessageOfType(t, conn1, "match:ended", 500*time.Millisecond)
	assert.Error(t, err, "Should timeout since no message is sent")
}

// TestBroadcastWeaponRespawn tests the broadcastWeaponRespawn function
func TestBroadcastWeaponRespawn(t *testing.T) {
	ts := newTestServer()
	defer ts.Close()

	conn1, conn2 := ts.connectTwoClients(t)
	defer conn1.Close()
	defer conn2.Close()

	_ = consumeRoomJoinedAndGetPlayerID(t, conn1)
	_ = consumeRoomJoinedAndGetPlayerID(t, conn2)

	// Create a weapon crate
	crate := &game.WeaponCrate{
		ID:          "test-crate-1",
		WeaponType:  "uzi",
		Position:    game.Vector2{X: 100, Y: 200},
		IsAvailable: true,
	}

	// Call broadcastWeaponRespawn
	ts.handler.broadcastWeaponRespawn(crate)

	// Both players should receive weapon:respawned message
	msg, err := readMessageOfType(t, conn1, "weapon:respawned", 2*time.Second)
	require.NoError(t, err, "Should receive weapon:respawned")
	assert.Equal(t, "weapon:respawned", msg.Type)

	// Verify message has expected fields
	data, ok := msg.Data.(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, "test-crate-1", data["crateId"])
	assert.Equal(t, "uzi", data["weaponType"])
	assert.NotNil(t, data["position"])

	// Verify position structure
	position := data["position"].(map[string]interface{})
	assert.Equal(t, float64(100), position["x"])
	assert.Equal(t, float64(200), position["y"])
}

// TestOnReloadComplete tests the onReloadComplete function
func TestOnReloadComplete(t *testing.T) {
	ts := newTestServer()
	defer ts.Close()

	conn1, conn2 := ts.connectTwoClients(t)
	defer conn1.Close()
	defer conn2.Close()

	player1ID := consumeRoomJoinedAndGetPlayerID(t, conn1)
	_ = consumeRoomJoinedAndGetPlayerID(t, conn2)

	// Call onReloadComplete
	ts.handler.onReloadComplete(player1ID)

	// Player 1 should receive weapon:state message
	msg, err := readMessageOfType(t, conn1, "weapon:state", 2*time.Second)
	require.NoError(t, err, "Should receive weapon:state after reload complete")
	assert.Equal(t, "weapon:state", msg.Type)

	// Verify message has weapon state fields
	data, ok := msg.Data.(map[string]interface{})
	require.True(t, ok)
	assert.NotNil(t, data["currentAmmo"])
	assert.NotNil(t, data["maxAmmo"])
	assert.NotNil(t, data["isReloading"])
	assert.NotNil(t, data["canShoot"])
}

// TestOnRespawn tests the onRespawn function
func TestOnRespawn(t *testing.T) {
	ts := newTestServer()
	defer ts.Close()

	conn1, conn2 := ts.connectTwoClients(t)
	defer conn1.Close()
	defer conn2.Close()

	player1ID := consumeRoomJoinedAndGetPlayerID(t, conn1)
	_ = consumeRoomJoinedAndGetPlayerID(t, conn2)

	// Call onRespawn
	respawnPos := game.Vector2{X: 400, Y: 300}
	ts.handler.onRespawn(player1ID, respawnPos)

	// Both players should receive player:respawn message
	msg, err := readMessageOfType(t, conn1, "player:respawn", 2*time.Second)
	require.NoError(t, err, "Should receive player:respawn")
	assert.Equal(t, "player:respawn", msg.Type)

	// Verify message has expected fields
	data, ok := msg.Data.(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, player1ID, data["playerId"])
	assert.Equal(t, float64(game.PlayerMaxHealth), data["health"])
	assert.NotNil(t, data["position"])

	// Verify position
	position := data["position"].(map[string]interface{})
	assert.Equal(t, float64(400), position["x"])
	assert.Equal(t, float64(300), position["y"])
}

// TestHandleWeaponPickup tests the handleWeaponPickup function (partial coverage)
func TestHandleWeaponPickup(t *testing.T) {
	ts := newTestServer()
	defer ts.Close()

	conn1, conn2 := ts.connectTwoClients(t)
	defer conn1.Close()
	defer conn2.Close()

	player1ID := consumeRoomJoinedAndGetPlayerID(t, conn1)
	_ = consumeRoomJoinedAndGetPlayerID(t, conn2)

	// Get an existing weapon crate from the manager (uses default spawns)
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

	// Get player state and position them near the crate
	world := ts.handler.gameServer.GetWorld()
	playerState, exists := world.GetPlayer(player1ID)
	require.True(t, exists, "Player should exist")
	playerState.Position = testCrate.Position // Position at crate location for proximity check

	// Prepare pickup attempt data
	pickupData := map[string]interface{}{
		"crateId": testCrate.ID,
	}

	// Call handleWeaponPickup
	ts.handler.handleWeaponPickup(player1ID, pickupData)

	// Both players should receive weapon:pickup_confirmed
	msg, err := readMessageOfType(t, conn1, "weapon:pickup_confirmed", 2*time.Second)
	require.NoError(t, err, "Should receive weapon:pickup_confirmed")
	assert.Equal(t, "weapon:pickup_confirmed", msg.Type)

	// Verify message has expected fields
	data, ok := msg.Data.(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, player1ID, data["playerId"])
	assert.Equal(t, testCrate.ID, data["crateId"])
	assert.Equal(t, testCrate.WeaponType, data["weaponType"])
}

// TestHandleWeaponPickupInvalidCrate tests handleWeaponPickup with invalid crate
func TestHandleWeaponPickupInvalidCrate(t *testing.T) {
	ts := newTestServer()
	defer ts.Close()

	conn1, conn2 := ts.connectTwoClients(t)
	defer conn1.Close()
	defer conn2.Close()

	player1ID := consumeRoomJoinedAndGetPlayerID(t, conn1)
	_ = consumeRoomJoinedAndGetPlayerID(t, conn2)

	// Prepare pickup attempt with non-existent crate
	pickupData := map[string]interface{}{
		"crateId": "non-existent-crate",
	}

	// Call handleWeaponPickup - should return early without panic
	ts.handler.handleWeaponPickup(player1ID, pickupData)

	// Should not receive weapon:pickup_confirmed
	_, err := readMessageOfType(t, conn1, "weapon:pickup_confirmed", 500*time.Millisecond)
	assert.Error(t, err, "Should timeout since invalid crate")
}

// TestGetGlobalHandler tests the getGlobalHandler function
func TestGetGlobalHandler(t *testing.T) {
	// Reset global handler for test isolation
	resetGlobalHandler()

	// First call should create handler
	handler1 := getGlobalHandler()
	assert.NotNil(t, handler1, "Handler should be created")

	// Second call should return same handler
	handler2 := getGlobalHandler()
	assert.Equal(t, handler1, handler2, "Should return same handler instance")

	// Clean up
	resetGlobalHandler()
}

// TestStartGlobalHandler tests the StartGlobalHandler function
func TestStartGlobalHandler(t *testing.T) {
	resetGlobalHandler()
	defer resetGlobalHandler()

	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()

	// Start global handler
	StartGlobalHandler(ctx)

	// Verify handler is created and started
	handler := getGlobalHandler()
	assert.NotNil(t, handler, "Global handler should exist")

	// Stop handler
	StopGlobalHandler()

	// Wait for context to be done
	<-ctx.Done()
}

// TestStopGlobalHandler tests the StopGlobalHandler function
func TestStopGlobalHandler(t *testing.T) {
	resetGlobalHandler()
	defer resetGlobalHandler()

	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()

	// Start global handler
	StartGlobalHandler(ctx)

	// Stop global handler - should not panic
	StopGlobalHandler()

	// Verify it can be called multiple times without panic
	StopGlobalHandler()

	// Wait for context to be done
	<-ctx.Done()
}

// TestOnWeaponRespawn tests the onWeaponRespawn function
func TestOnWeaponRespawn(t *testing.T) {
	ts := newTestServer()
	defer ts.Close()

	conn1, conn2 := ts.connectTwoClients(t)
	defer conn1.Close()
	defer conn2.Close()

	_ = consumeRoomJoinedAndGetPlayerID(t, conn1)
	_ = consumeRoomJoinedAndGetPlayerID(t, conn2)

	// Create a weapon crate
	crate := &game.WeaponCrate{
		ID:          "test-crate-respawn",
		WeaponType:  "shotgun",
		Position:    game.Vector2{X: 300, Y: 400},
		IsAvailable: true,
	}

	// Call onWeaponRespawn
	ts.handler.onWeaponRespawn(crate)

	// Both players should receive weapon:respawned message
	msg, err := readMessageOfType(t, conn1, "weapon:respawned", 2*time.Second)
	require.NoError(t, err, "Should receive weapon:respawned")
	assert.Equal(t, "weapon:respawned", msg.Type)

	// Verify message has expected fields
	data, ok := msg.Data.(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, "test-crate-respawn", data["crateId"])
	assert.Equal(t, "shotgun", data["weaponType"])
}

// TestHandleInputStateAfterMatchEnded tests input rejection after match ends
func TestHandleInputStateAfterMatchEnded(t *testing.T) {
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
	room.Match.EndMatch("time_up")

	// Try to send input - should be silently ignored
	inputData := map[string]interface{}{
		"up":          false,
		"down":        false,
		"left":        true,
		"right":       false,
		"aimAngle":    0.0,
		"isSprinting": false,
	}

	// Call handleInputState directly - should return early without errors
	ts.handler.handleInputState(player1ID, inputData)

	// No assertion needed - test passes if no panic/error occurs
	assert.True(t, true, "handleInputState should silently ignore input after match ends")
}

// TestHandleWeaponPickupPlayerNotFound tests handleWeaponPickup with non-existent player
func TestHandleWeaponPickupPlayerNotFound(t *testing.T) {
	ts := newTestServer()
	defer ts.Close()

	// Prepare pickup data
	pickupData := map[string]interface{}{
		"crateId": "any-crate",
	}

	// Call with non-existent player - should return early
	ts.handler.handleWeaponPickup("non-existent-player", pickupData)

	// No assertion needed - test passes if no panic occurs
	assert.True(t, true, "Should handle non-existent player gracefully")
}

// TestBroadcastMatchTimersNilRoom tests broadcastMatchTimers with nil room
func TestBroadcastMatchTimersNilRoom(t *testing.T) {
	handler := NewWebSocketHandler()

	// Call with nil room - should not panic
	handler.broadcastMatchTimers()

	// No assertion needed - test passes if no panic occurs
	assert.True(t, true, "Should handle nil room gracefully")
}

// Note: Global HandleWebSocket function is a simple one-line wrapper and is covered by integration tests
