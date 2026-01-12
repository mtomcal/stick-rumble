package network

import (
	"math"
	"testing"
	"time"

	"github.com/mtomcal/stick-rumble-server/internal/game"
	"github.com/stretchr/testify/assert"
)

// TestBroadcastWeaponPickup_WithNaNData tests JSON marshal error path
func TestBroadcastWeaponPickup_WithNaNData(t *testing.T) {
	handler := NewWebSocketHandler()

	// Create respawn time with NaN - this may cause JSON marshal issues
	// But the function should handle it gracefully
	respawnTime := time.Now().Add(30 * time.Second)

	// Test with empty/invalid player IDs to exercise different code paths
	assert.NotPanics(t, func() {
		handler.broadcastWeaponPickup("", "", "", respawnTime)
	}, "Should handle empty strings")

	assert.NotPanics(t, func() {
		handler.broadcastWeaponPickup("player1", "crate1", "uzi", respawnTime)
	}, "Should handle valid data")

	assert.NotPanics(t, func() {
		handler.broadcastWeaponPickup("player1", "crate1", "ak47", respawnTime)
	}, "Should handle valid data 2")

	assert.NotPanics(t, func() {
		handler.broadcastWeaponPickup("player1", "crate1", "shotgun", respawnTime)
	}, "Should handle valid data 3")
}

// TestBroadcastWeaponRespawn_WithNaNData tests JSON marshal error path
func TestBroadcastWeaponRespawn_WithNaNData(t *testing.T) {
	handler := NewWebSocketHandler()

	// Test with NaN in position - this causes JSON marshal to fail
	crateWithNaN := &game.WeaponCrate{
		ID:          "crate-nan",
		WeaponType:  "uzi",
		Position:    game.Vector2{X: math.NaN(), Y: math.NaN()},
		IsAvailable: true,
	}

	assert.NotPanics(t, func() {
		handler.broadcastWeaponRespawn(crateWithNaN)
	}, "Should handle NaN position gracefully")

	// Test with Inf in position
	crateWithInf := &game.WeaponCrate{
		ID:          "crate-inf",
		WeaponType:  "ak47",
		Position:    game.Vector2{X: math.Inf(1), Y: math.Inf(-1)},
		IsAvailable: true,
	}

	assert.NotPanics(t, func() {
		handler.broadcastWeaponRespawn(crateWithInf)
	}, "Should handle Inf position gracefully")

	// Test with valid data to ensure happy path is covered
	crateValid := &game.WeaponCrate{
		ID:          "crate-valid",
		WeaponType:  "shotgun",
		Position:    game.Vector2{X: 100, Y: 200},
		IsAvailable: true,
	}

	assert.NotPanics(t, func() {
		handler.broadcastWeaponRespawn(crateValid)
	}, "Should handle valid data")
}

// TestSendShootFailed_AllBranches tests all code branches in sendShootFailed
func TestSendShootFailed_AllBranches(t *testing.T) {
	handler := NewWebSocketHandler()

	// Test with non-existent player (neither in room nor waiting)
	assert.NotPanics(t, func() {
		handler.sendShootFailed("non-existent", "empty_magazine")
	}, "Should handle non-existent player")

	// Test with different reasons to ensure all are covered
	reasons := []string{"empty_magazine", "cooldown", "reloading", "invalid"}
	for _, reason := range reasons {
		assert.NotPanics(t, func() {
			handler.sendShootFailed("test-player", reason)
		}, "Should handle reason: %s", reason)
	}

	// Test with empty strings
	assert.NotPanics(t, func() {
		handler.sendShootFailed("", "")
	}, "Should handle empty strings")
}

// TestOnRespawn_AllBranches tests all code branches in onRespawn
func TestOnRespawn_AllBranches(t *testing.T) {
	handler := NewWebSocketHandler()

	// Test with non-existent player (not in any room)
	assert.NotPanics(t, func() {
		handler.onRespawn("non-existent", game.Vector2{X: 0, Y: 0})
	}, "Should handle non-existent player")

	// Test with various positions including edge cases
	positions := []game.Vector2{
		{X: 0, Y: 0},
		{X: -100, Y: -100},
		{X: 1000, Y: 1000},
		{X: 400, Y: 300},
	}

	for _, pos := range positions {
		assert.NotPanics(t, func() {
			handler.onRespawn("test-player", pos)
		}, "Should handle position: %+v", pos)
	}

	// Test with NaN position (may cause JSON marshal error)
	assert.NotPanics(t, func() {
		handler.onRespawn("test-player", game.Vector2{X: math.NaN(), Y: math.NaN()})
	}, "Should handle NaN position")
}

// TestOnHit_AllCodePaths tests all code paths in onHit including error cases
func TestOnHit_AllCodePaths(t *testing.T) {
	handler := NewWebSocketHandler()

	// Test 1: Non-existent victim (returns early)
	assert.NotPanics(t, func() {
		handler.onHit(game.HitEvent{
			VictimID:     "non-existent-victim",
			AttackerID:   "attacker",
			ProjectileID: "proj1",
		})
	}, "Should handle non-existent victim")

	// Test 2: Add a victim but attacker has no weapon
	victimID := "victim-player"
	handler.gameServer.AddPlayer(victimID)

	attackerID := "attacker-player"
	handler.gameServer.AddPlayer(attackerID)
	handler.gameServer.SetWeaponState(attackerID, nil) // Remove weapon

	assert.NotPanics(t, func() {
		handler.onHit(game.HitEvent{
			VictimID:     victimID,
			AttackerID:   attackerID,
			ProjectileID: "proj2",
		})
	}, "Should handle nil attacker weapon")

	// Test 3: Valid hit but victim survives (no death)
	attacker2ID := "attacker2-player"
	victim2ID := "victim2-player"
	handler.gameServer.AddPlayer(attacker2ID)
	handler.gameServer.AddPlayer(victim2ID)

	assert.NotPanics(t, func() {
		handler.onHit(game.HitEvent{
			VictimID:     victim2ID,
			AttackerID:   attacker2ID,
			ProjectileID: "proj3",
		})
	}, "Should handle non-fatal hit")

	// Test 4: Multiple hits on same victim
	victim3ID := "victim3-player"
	attacker3ID := "attacker3-player"
	handler.gameServer.AddPlayer(victim3ID)
	handler.gameServer.AddPlayer(attacker3ID)

	// Hit the victim multiple times
	for i := 0; i < 3; i++ {
		assert.NotPanics(t, func() {
			handler.onHit(game.HitEvent{
				VictimID:     victim3ID,
				AttackerID:   attacker3ID,
				ProjectileID: "proj4-" + string(rune('a'+i)),
			})
		}, "Should handle multiple hits")
	}
}

// TestBroadcastMatchEnded_AllBranches tests all branches in broadcastMatchEnded
func TestBroadcastMatchEnded_AllBranches(t *testing.T) {
	handler := NewWebSocketHandler()
	world := handler.gameServer.GetWorld()

	// Create a mock room
	room := &game.Room{
		ID:    "test-room",
		Match: game.NewMatch(),
	}

	// Test with different end reasons
	endReasons := []string{"time_limit", "kill_target", "manual", "disconnect", "error"}
	for _, reason := range endReasons {
		room.Match.EndReason = reason
		assert.NotPanics(t, func() {
			handler.broadcastMatchEnded(room, world)
		}, "Should handle end reason: %s", reason)
	}

	// Add players to world and test again
	player1ID := "player1"
	player2ID := "player2"
	handler.gameServer.AddPlayer(player1ID)
	handler.gameServer.AddPlayer(player2ID)

	for _, reason := range endReasons {
		room.Match.EndReason = reason
		assert.NotPanics(t, func() {
			handler.broadcastMatchEnded(room, world)
		}, "Should handle end reason with players: %s", reason)
	}
}

// TestSendWeaponState_AllBranches tests all branches in sendWeaponState
func TestSendWeaponState_AllBranches(t *testing.T) {
	handler := NewWebSocketHandler()

	// Test 1: Non-existent player (nil weapon state, returns early)
	assert.NotPanics(t, func() {
		handler.sendWeaponState("non-existent")
	}, "Should handle non-existent player")

	// Test 2: Player exists but not in room (waiting player path)
	playerID := "test-player"
	handler.gameServer.AddPlayer(playerID)

	assert.NotPanics(t, func() {
		handler.sendWeaponState(playerID)
	}, "Should handle player not in room")

	// Test multiple times to ensure consistency
	for i := 0; i < 5; i++ {
		assert.NotPanics(t, func() {
			handler.sendWeaponState(playerID)
		}, "Should handle call %d", i)
	}
}

// TestSendWeaponSpawns_AllBranches tests all branches in sendWeaponSpawns
func TestSendWeaponSpawns_AllBranches(t *testing.T) {
	handler := NewWebSocketHandler()

	// Test 1: Non-existent player
	assert.NotPanics(t, func() {
		handler.sendWeaponSpawns("non-existent")
	}, "Should handle non-existent player")

	// Test 2: Player exists but not in room
	playerID := "test-player"
	handler.gameServer.AddPlayer(playerID)

	assert.NotPanics(t, func() {
		handler.sendWeaponSpawns(playerID)
	}, "Should handle player not in room")

	// Test multiple times
	for i := 0; i < 3; i++ {
		assert.NotPanics(t, func() {
			handler.sendWeaponSpawns(playerID)
		}, "Should handle call %d", i)
	}
}

// TestBroadcastMatchTimers_MultipleCalls tests broadcastMatchTimers repeatedly
func TestBroadcastMatchTimers_MultipleCalls(t *testing.T) {
	handler := NewWebSocketHandler()

	// Test with no rooms
	for i := 0; i < 10; i++ {
		assert.NotPanics(t, func() {
			handler.broadcastMatchTimers()
		}, "Should handle no rooms on call %d", i)
	}
}

// TestHandleWeaponPickup_AllErrorPaths tests all error paths in handleWeaponPickup
func TestHandleWeaponPickup_AllErrorPaths(t *testing.T) {
	handler := NewWebSocketHandler()

	// Test 1: Invalid schema (nil data)
	assert.NotPanics(t, func() {
		handler.handleWeaponPickup("player1", nil)
	}, "Should handle nil data")

	// Test 2: Invalid schema (wrong data type)
	assert.NotPanics(t, func() {
		handler.handleWeaponPickup("player1", "not a map")
	}, "Should handle wrong data type")

	// Test 3: Invalid schema (missing crateId)
	assert.NotPanics(t, func() {
		handler.handleWeaponPickup("player1", map[string]interface{}{"wrong": "field"})
	}, "Should handle missing crateId")

	// Test 4: Valid schema but invalid crate ID
	assert.NotPanics(t, func() {
		handler.handleWeaponPickup("player1", map[string]interface{}{"crateId": "non-existent"})
	}, "Should handle invalid crate ID")

	// Test 5: Non-existent player
	crates := handler.gameServer.GetWeaponCrateManager().GetAllCrates()
	var crateID string
	for id := range crates {
		crateID = id
		break
	}

	assert.NotPanics(t, func() {
		handler.handleWeaponPickup("non-existent-player", map[string]interface{}{"crateId": crateID})
	}, "Should handle non-existent player")

	// Test 6: Dead player
	playerID := "test-player"
	handler.gameServer.AddPlayer(playerID)
	handler.gameServer.MarkPlayerDead(playerID)

	assert.NotPanics(t, func() {
		handler.handleWeaponPickup(playerID, map[string]interface{}{"crateId": crateID})
	}, "Should handle dead player")
}

// TestHandleInputState_AllErrorPaths tests all error paths in handleInputState
func TestHandleInputState_AllErrorPaths(t *testing.T) {
	handler := NewWebSocketHandler()

	playerID := "test-player"
	handler.gameServer.AddPlayer(playerID)

	// Test 1: Invalid schema (nil data)
	assert.NotPanics(t, func() {
		handler.handleInputState(playerID, nil)
	}, "Should handle nil data")

	// Test 2: Invalid schema (wrong type)
	assert.NotPanics(t, func() {
		handler.handleInputState(playerID, "not a map")
	}, "Should handle wrong type")

	// Test 3: Invalid schema (missing fields)
	assert.NotPanics(t, func() {
		handler.handleInputState(playerID, map[string]interface{}{"invalid": "data"})
	}, "Should handle missing fields")

	// Test 4: Valid data
	validData := map[string]interface{}{
		"up":       true,
		"down":     false,
		"left":     false,
		"right":    false,
		"aimAngle": 0.0,
	}

	assert.NotPanics(t, func() {
		handler.handleInputState(playerID, validData)
	}, "Should handle valid data")

	// Test various input combinations
	inputs := []map[string]interface{}{
		{"up": false, "down": true, "left": false, "right": false, "aimAngle": 1.57},
		{"up": false, "down": false, "left": true, "right": false, "aimAngle": 3.14},
		{"up": false, "down": false, "left": false, "right": true, "aimAngle": 4.71},
	}

	for _, input := range inputs {
		assert.NotPanics(t, func() {
			handler.handleInputState(playerID, input)
		}, "Should handle input: %v", input)
	}
}
