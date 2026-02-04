package network

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ==========================
// handleInputState Coverage Tests
// Tests for handleInputState function to cover lines 27-41
// ==========================

// TestHandleInputStateSuccess tests successful input state update
func TestHandleInputStateSuccess(t *testing.T) {
	ts := newTestServer()
	defer ts.Close()

	conn1, conn2 := ts.connectTwoClients(t)
	defer conn1.Close()
	defer conn2.Close()

	player1ID := consumeRoomJoinedAndGetPlayerID(t, conn1)
	_ = consumeRoomJoinedAndGetPlayerID(t, conn2)

	// Get initial player input state
	world := ts.handler.gameServer.GetWorld()
	player, exists := world.GetPlayer(player1ID)
	require.True(t, exists)
	initialInput := player.GetInput()

	// Send valid input state data
	inputData := map[string]interface{}{
		"up":          true,
		"down":        false,
		"left":        true,
		"right":       false,
		"aimAngle":    1.57, // 90 degrees
		"isSprinting": false,
		"sequence":    1,
	}

	// Call handleInputState directly - should update input
	require.NotPanics(t, func() {
		ts.handler.handleInputState(player1ID, inputData)
	}, "handleInputState should process valid input without panic")

	// Verify input was updated (covers lines 27-41)
	player, _ = world.GetPlayer(player1ID)
	currentInput := player.GetInput()

	// Input should be different from initial
	assert.NotEqual(t, initialInput.Up, currentInput.Up, "Input.Up should change")
	assert.True(t, currentInput.Up, "Input.Up should be true")
	assert.True(t, currentInput.Left, "Input.Left should be true")
	assert.False(t, currentInput.Down, "Input.Down should be false")
	assert.False(t, currentInput.Right, "Input.Right should be false")
	assert.Equal(t, 1.57, currentInput.AimAngle, "AimAngle should be 1.57")
}

// TestHandleInputStateNonExistentPlayer tests UpdatePlayerInput failure
func TestHandleInputStateNonExistentPlayer(t *testing.T) {
	handler := NewWebSocketHandler()

	// Create valid input data
	inputData := map[string]interface{}{
		"up":          false,
		"down":        false,
		"left":        false,
		"right":       false,
		"aimAngle":    0.0,
		"isSprinting": false,
		"sequence":    1,
	}

	// Call handleInputState with non-existent player
	// Should trigger line 38-41 (UpdatePlayerInput returns false)
	require.NotPanics(t, func() {
		handler.handleInputState("non-existent-player-id", inputData)
	}, "Should handle non-existent player gracefully")

	// Verify player doesn't exist
	world := handler.gameServer.GetWorld()
	_, exists := world.GetPlayer("non-existent-player-id")
	assert.False(t, exists, "Player should not exist")
}

// TestHandleInputStateMatchEnded tests early return when match ended
func TestHandleInputStateMatchEnded(t *testing.T) {
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

	// End the match to test early return (line 13-18)
	room.Match.EndMatch("test_reason")
	assert.True(t, room.Match.IsEnded())

	// Get initial player input state
	world := ts.handler.gameServer.GetWorld()
	player, exists := world.GetPlayer(player1ID)
	require.True(t, exists)
	initialInput := player.GetInput()

	// Try to send input - should be silently ignored
	inputData := map[string]interface{}{
		"up":          true,
		"down":        false,
		"left":        true,
		"right":       false,
		"aimAngle":    2.0,
		"isSprinting": false,
		"sequence":    1,
	}

	// Call handleInputState directly - should return early without updating
	require.NotPanics(t, func() {
		ts.handler.handleInputState(player1ID, inputData)
	}, "handleInputState should silently ignore input after match ends")

	// Verify input was NOT updated (early return on match ended, line 17)
	player, _ = world.GetPlayer(player1ID)
	currentInput := player.GetInput()
	assert.Equal(t, initialInput, currentInput, "Input should not be updated after match ends")
}

// TestHandleInputStateSchemaValidationError tests schema validation failure path
func TestHandleInputStateSchemaValidationError(t *testing.T) {
	ts := newTestServer()
	defer ts.Close()

	conn1, conn2 := ts.connectTwoClients(t)
	defer conn1.Close()
	defer conn2.Close()

	player1ID := consumeRoomJoinedAndGetPlayerID(t, conn1)
	_ = consumeRoomJoinedAndGetPlayerID(t, conn2)

	// Get initial player state
	world := ts.handler.gameServer.GetWorld()
	player, exists := world.GetPlayer(player1ID)
	require.True(t, exists)
	initialInput := player.GetInput()

	// Send invalid input state (missing required fields "isSprinting" and "sequence")
	invalidData := map[string]interface{}{
		"up":       true,
		"down":     false,
		"left":     false,
		"right":    false,
		"aimAngle": 1.0,
		// Missing: "isSprinting" and "sequence"
	}

	// Call handleInputState - should handle validation failure gracefully (line 21-24)
	require.NotPanics(t, func() {
		ts.handler.handleInputState(player1ID, invalidData)
	}, "Should handle schema validation failure gracefully")

	// Verify input was NOT updated (early return on validation failure)
	player, _ = world.GetPlayer(player1ID)
	currentInput := player.GetInput()
	assert.Equal(t, initialInput, currentInput, "Input should not be updated after schema validation failure")
}

// TestHandleInputStateWithDifferentInputs tests various input combinations
func TestHandleInputStateWithDifferentInputs(t *testing.T) {
	ts := newTestServer()
	defer ts.Close()

	conn1, conn2 := ts.connectTwoClients(t)
	defer conn1.Close()
	defer conn2.Close()

	player1ID := consumeRoomJoinedAndGetPlayerID(t, conn1)
	_ = consumeRoomJoinedAndGetPlayerID(t, conn2)

	// Get player state
	world := ts.handler.gameServer.GetWorld()
	player, exists := world.GetPlayer(player1ID)
	require.True(t, exists)

	// Test Case 1: All directions true
	inputData1 := map[string]interface{}{
		"up":          true,
		"down":        true,
		"left":        true,
		"right":       true,
		"aimAngle":    3.14,
		"isSprinting": false,
		"sequence":    1,
	}
	ts.handler.handleInputState(player1ID, inputData1)
	player, _ = world.GetPlayer(player1ID)
	input1 := player.GetInput()
	assert.True(t, input1.Up)
	assert.True(t, input1.Down)
	assert.True(t, input1.Left)
	assert.True(t, input1.Right)
	assert.Equal(t, 3.14, input1.AimAngle)

	// Test Case 2: Diagonal movement
	inputData2 := map[string]interface{}{
		"up":          true,
		"down":        false,
		"left":        false,
		"right":       true,
		"aimAngle":    0.785, // 45 degrees
		"isSprinting": false,
		"sequence":    2,
	}
	ts.handler.handleInputState(player1ID, inputData2)
	player, _ = world.GetPlayer(player1ID)
	input2 := player.GetInput()
	assert.True(t, input2.Up)
	assert.False(t, input2.Down)
	assert.False(t, input2.Left)
	assert.True(t, input2.Right)
	assert.Equal(t, 0.785, input2.AimAngle)

	// Test Case 3: Stationary with aim
	inputData3 := map[string]interface{}{
		"up":          false,
		"down":        false,
		"left":        false,
		"right":       false,
		"aimAngle":    6.28, // 360 degrees
		"isSprinting": false,
		"sequence":    3,
	}
	ts.handler.handleInputState(player1ID, inputData3)
	player, _ = world.GetPlayer(player1ID)
	input3 := player.GetInput()
	assert.False(t, input3.Up)
	assert.False(t, input3.Down)
	assert.False(t, input3.Left)
	assert.False(t, input3.Right)
	assert.Equal(t, 6.28, input3.AimAngle)
}
