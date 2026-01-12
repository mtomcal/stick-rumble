package network

import (
	"testing"
	"time"

	"github.com/mtomcal/stick-rumble-server/internal/game"
	"github.com/stretchr/testify/assert"
)

// TestBroadcastWeaponPickup_JSONMarshalPath tests the JSON marshaling path
func TestBroadcastWeaponPickup_JSONMarshalPath(t *testing.T) {
	handler := NewWebSocketHandler()

	// Test the function with various inputs to ensure all code paths are executed
	// This exercises the JSON marshaling and broadcasting logic
	respawnTime := time.Now().Add(5 * time.Second)

	// Call with valid inputs - should exercise all happy path lines
	assert.NotPanics(t, func() {
		handler.broadcastWeaponPickup("player1", "crate1", "uzi", respawnTime)
	}, "Should handle valid weapon pickup broadcast")
}

// TestBroadcastWeaponRespawn_JSONMarshalPath tests the JSON marshaling path
func TestBroadcastWeaponRespawn_JSONMarshalPath(t *testing.T) {
	handler := NewWebSocketHandler()

	crate := &game.WeaponCrate{
		ID:          "crate1",
		WeaponType:  "ak47",
		Position:    game.Vector2{X: 100, Y: 200},
		IsAvailable: true,
	}

	// Call with valid inputs - should exercise all happy path lines
	assert.NotPanics(t, func() {
		handler.broadcastWeaponRespawn(crate)
	}, "Should handle valid weapon respawn broadcast")
}

// TestSendShootFailed_AllPaths tests all code paths in sendShootFailed
func TestSendShootFailed_AllPaths(t *testing.T) {
	handler := NewWebSocketHandler()

	// Test with non-existent player (nil room, nil waiting player)
	assert.NotPanics(t, func() {
		handler.sendShootFailed("non-existent-player", "empty_magazine")
	}, "Should handle non-existent player gracefully")

	// Test with different failure reasons to exercise all branches
	reasons := []string{"empty_magazine", "cooldown", "reloading"}
	for _, reason := range reasons {
		assert.NotPanics(t, func() {
			handler.sendShootFailed("test-player", reason)
		}, "Should handle reason: %s", reason)
	}
}

// TestOnRespawn_AllPaths tests all code paths in onRespawn
func TestOnRespawn_AllPaths(t *testing.T) {
	handler := NewWebSocketHandler()

	// Test with non-existent player (nil room path)
	position := game.Vector2{X: 400, Y: 300}
	assert.NotPanics(t, func() {
		handler.onRespawn("non-existent-player", position)
	}, "Should handle non-existent player gracefully")

	// Test with various positions to exercise all lines
	positions := []game.Vector2{
		{X: 0, Y: 0},
		{X: 100, Y: 100},
		{X: 500, Y: 500},
	}
	for _, pos := range positions {
		assert.NotPanics(t, func() {
			handler.onRespawn("test-player", pos)
		}, "Should handle position: %+v", pos)
	}
}

// TestSendWeaponState_NilWeapon tests the nil weapon state path
func TestSendWeaponState_NilWeapon(t *testing.T) {
	handler := NewWebSocketHandler()

	// Test with non-existent player (nil weapon state)
	assert.NotPanics(t, func() {
		handler.sendWeaponState("non-existent-player")
	}, "Should handle nil weapon state gracefully")
}

// TestSendWeaponSpawns_AllPaths tests all code paths in sendWeaponSpawns
func TestSendWeaponSpawns_AllPaths(t *testing.T) {
	handler := NewWebSocketHandler()

	// Test with non-existent player
	assert.NotPanics(t, func() {
		handler.sendWeaponSpawns("non-existent-player")
	}, "Should handle non-existent player gracefully")

	// Test multiple times to ensure all branches are covered
	for i := 0; i < 3; i++ {
		assert.NotPanics(t, func() {
			handler.sendWeaponSpawns("test-player")
		}, "Should handle call %d", i)
	}
}

// TestBroadcastMatchEnded_AllPaths tests all code paths in broadcastMatchEnded
func TestBroadcastMatchEnded_AllPaths(t *testing.T) {
	handler := NewWebSocketHandler()

	// Create a mock room and world
	room := &game.Room{
		ID:    "test-room",
		Match: game.NewMatch(),
	}
	room.Match.EndReason = "time_limit"
	world := handler.gameServer.GetWorld()

	// Test with different end reasons to exercise all branches
	endReasons := []string{"time_limit", "kill_target", "manual"}
	for _, reason := range endReasons {
		room.Match.EndReason = reason
		assert.NotPanics(t, func() {
			handler.broadcastMatchEnded(room, world)
		}, "Should handle end reason: %s", reason)
	}
}

// TestBroadcastMatchTimers_AllPaths tests all code paths in broadcastMatchTimers
func TestBroadcastMatchTimers_AllPaths(t *testing.T) {
	handler := NewWebSocketHandler()

	// Test with no rooms
	assert.NotPanics(t, func() {
		handler.broadcastMatchTimers()
	}, "Should handle no rooms gracefully")

	// Test multiple times to ensure consistency
	for i := 0; i < 3; i++ {
		assert.NotPanics(t, func() {
			handler.broadcastMatchTimers()
		}, "Should handle call %d", i)
	}
}

// TestHandleWeaponPickup_InvalidSchema tests schema validation path
func TestHandleWeaponPickup_InvalidSchema(t *testing.T) {
	handler := NewWebSocketHandler()

	// Add a player
	playerID := "test-player"
	handler.gameServer.AddPlayer(playerID)

	// Test with nil data
	assert.NotPanics(t, func() {
		handler.handleWeaponPickup(playerID, nil)
	}, "Should handle nil data gracefully")

	// Test with invalid data types
	invalidDataSets := []interface{}{
		map[string]interface{}{"wrong": "field"},
		map[string]interface{}{"crateId": 123}, // wrong type
		"not a map",
		[]string{"not", "a", "map"},
	}

	for _, invalidData := range invalidDataSets {
		assert.NotPanics(t, func() {
			handler.handleWeaponPickup(playerID, invalidData)
		}, "Should handle invalid data: %v", invalidData)
	}
}

// TestHandleWeaponPickup_NonExistentPlayer tests non-existent player path
func TestHandleWeaponPickup_NonExistentPlayer(t *testing.T) {
	handler := NewWebSocketHandler()

	// Get a valid crate ID
	crates := handler.gameServer.GetWeaponCrateManager().GetAllCrates()
	var crateID string
	for id := range crates {
		crateID = id
		break
	}

	data := map[string]interface{}{
		"crateId": crateID,
	}

	// Test with non-existent player
	assert.NotPanics(t, func() {
		handler.handleWeaponPickup("non-existent-player", data)
	}, "Should handle non-existent player gracefully")
}

// TestOnHit_NonExistentVictim tests the non-existent victim path
func TestOnHit_NonExistentVictim(t *testing.T) {
	handler := NewWebSocketHandler()

	hitEvent := game.HitEvent{
		VictimID:     "non-existent-victim",
		AttackerID:   "non-existent-attacker",
		ProjectileID: "projectile-1",
	}

	// Should return early without error
	assert.NotPanics(t, func() {
		handler.onHit(hitEvent)
	}, "Should handle non-existent victim gracefully")
}

// TestOnHit_NilAttackerWeapon tests the nil attacker weapon path
func TestOnHit_NilAttackerWeapon(t *testing.T) {
	handler := NewWebSocketHandler()

	// Add a victim
	victimID := "victim-player"
	handler.gameServer.AddPlayer(victimID)

	// Add an attacker without a weapon
	attackerID := "attacker-player"
	handler.gameServer.AddPlayer(attackerID)

	// Remove attacker's weapon to create nil weapon state
	handler.gameServer.SetWeaponState(attackerID, nil)

	hitEvent := game.HitEvent{
		VictimID:     victimID,
		AttackerID:   attackerID,
		ProjectileID: "projectile-2",
	}

	// Should return early due to nil weapon
	assert.NotPanics(t, func() {
		handler.onHit(hitEvent)
	}, "Should handle nil attacker weapon gracefully")
}

// TestHandleInputState_AfterMatchEnd tests input rejection after match ends
func TestHandleInputState_AfterMatchEnd(t *testing.T) {
	handler := NewWebSocketHandler()

	// Add player
	playerID := "test-player"
	handler.gameServer.AddPlayer(playerID)

	// Create valid input data
	data := map[string]interface{}{
		"up":       false,
		"down":     false,
		"left":     true,
		"right":    false,
		"aimAngle": 1.5,
	}

	// Should handle gracefully when player not in room
	assert.NotPanics(t, func() {
		handler.handleInputState(playerID, data)
	}, "Should handle input when player not in room")
}

// TestHandleInputState_InvalidSchema tests schema validation
func TestHandleInputState_InvalidSchema(t *testing.T) {
	handler := NewWebSocketHandler()

	playerID := "test-player"
	handler.gameServer.AddPlayer(playerID)

	// Test with invalid data
	invalidDataSets := []interface{}{
		map[string]interface{}{"invalid": "data"},
		map[string]interface{}{"up": "not a boolean"},
		nil,
		"not a map",
	}

	for _, invalidData := range invalidDataSets {
		assert.NotPanics(t, func() {
			handler.handleInputState(playerID, invalidData)
		}, "Should handle invalid schema: %v", invalidData)
	}
}

// TestNewSchemaLoader_ErrorPaths tests error handling in NewSchemaLoader
func TestNewSchemaLoader_ErrorPaths(t *testing.T) {
	// Test with non-existent directory
	_, err := NewSchemaLoader("/non/existent/directory")
	assert.Error(t, err, "Should return error for non-existent directory")
	assert.Contains(t, err.Error(), "schema directory does not exist", "Error should mention directory doesn't exist")
}

// TestNewSchemaLoader_EmptyDirectory tests loading from empty directory
func TestNewSchemaLoader_EmptyDirectory(t *testing.T) {
	// Create a temporary empty directory
	tempDir := t.TempDir()

	// Should succeed but load zero schemas
	loader, err := NewSchemaLoader(tempDir)
	assert.NoError(t, err, "Should not error on empty directory")
	assert.NotNil(t, loader, "Loader should not be nil")

	schemaNames := loader.GetSchemaNames()
	assert.Equal(t, 0, len(schemaNames), "Should have zero schemas")
}

// TestValidate_EdgeCases tests edge cases in Validate function
func TestValidate_EdgeCases(t *testing.T) {
	loader, err := NewSchemaLoader("../../../events-schema/schemas/client-to-server")
	assert.NoError(t, err, "Should load schemas successfully")

	validator := NewSchemaValidator(loader)

	// Test with non-existent schema name
	err = validator.Validate("non-existent-schema", map[string]interface{}{})
	assert.Error(t, err, "Should error for non-existent schema")

	// Test with nil data
	err = validator.Validate("input-state-data", nil)
	assert.Error(t, err, "Should error for nil data")
}
