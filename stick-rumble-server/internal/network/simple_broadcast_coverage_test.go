package network

import (
	"testing"
	"time"

	"github.com/mtomcal/stick-rumble-server/internal/game"
	"github.com/stretchr/testify/assert"
)

// TestBroadcastWeaponPickup_SimpleCoverage tests happy path for broadcastWeaponPickup
func TestBroadcastWeaponPickup_SimpleCoverage(t *testing.T) {
	ts := newTestServer()
	defer ts.Close()

	// Connect clients
	conn1, conn2 := ts.connectTwoClients(t)
	defer conn1.Close()
	defer conn2.Close()

	// Consume initial messages
	player1ID := consumeRoomJoinedAndGetPlayerID(t, conn1)
	consumeRoomJoined(t, conn2)
	time.Sleep(50 * time.Millisecond)

	// Test broadcastWeaponPickup with various valid inputs
	testCases := []struct {
		playerID   string
		crateID    string
		weaponType string
	}{
		{player1ID, "crate-1", "uzi"},
		{player1ID, "crate-2", "ak47"},
		{player1ID, "crate-3", "shotgun"},
	}

	for _, tc := range testCases {
		respawnTime := time.Now().Add(30 * time.Second)
		assert.NotPanics(t, func() {
			ts.handler.broadcastWeaponPickup(tc.playerID, tc.crateID, tc.weaponType, respawnTime)
		}, "Should not panic for valid inputs")
	}
}

// TestBroadcastWeaponRespawn_SimpleCoverage tests happy path for broadcastWeaponRespawn
func TestBroadcastWeaponRespawn_SimpleCoverage(t *testing.T) {
	ts := newTestServer()
	defer ts.Close()

	// Connect clients
	conn1, conn2 := ts.connectTwoClients(t)
	defer conn1.Close()
	defer conn2.Close()

	// Consume initial messages
	consumeRoomJoined(t, conn1)
	consumeRoomJoined(t, conn2)
	time.Sleep(50 * time.Millisecond)

	// Test broadcastWeaponRespawn with various weapon types
	weaponTypes := []string{"uzi", "ak47", "shotgun", "pistol", "bat", "katana"}
	for i, wType := range weaponTypes {
		crate := &game.WeaponCrate{
			ID:          "crate-" + string(rune('a'+i)),
			WeaponType:  wType,
			Position:    game.Vector2{X: float64(100 * i), Y: float64(100 * i)},
			IsAvailable: true,
		}
		assert.NotPanics(t, func() {
			ts.handler.broadcastWeaponRespawn(crate)
		}, "Should not panic for weapon type: %s", wType)
	}
}

// TestSendShootFailed_SimpleCoverage tests happy path for sendShootFailed
func TestSendShootFailed_SimpleCoverage(t *testing.T) {
	ts := newTestServer()
	defer ts.Close()

	// Connect clients
	conn1, conn2 := ts.connectTwoClients(t)
	defer conn1.Close()
	defer conn2.Close()

	// Get player ID
	player1ID := consumeRoomJoinedAndGetPlayerID(t, conn1)
	consumeRoomJoined(t, conn2)
	time.Sleep(50 * time.Millisecond)

	// Test sendShootFailed with various reasons
	reasons := []string{"empty_magazine", "cooldown", "reloading", "invalid_weapon"}
	for _, reason := range reasons {
		assert.NotPanics(t, func() {
			ts.handler.sendShootFailed(player1ID, reason)
		}, "Should not panic for reason: %s", reason)
	}
}

// TestOnRespawn_SimpleCoverage tests happy path for onRespawn
func TestOnRespawn_SimpleCoverage(t *testing.T) {
	ts := newTestServer()
	defer ts.Close()

	// Connect clients
	conn1, conn2 := ts.connectTwoClients(t)
	defer conn1.Close()
	defer conn2.Close()

	// Get player ID
	player1ID := consumeRoomJoinedAndGetPlayerID(t, conn1)
	consumeRoomJoined(t, conn2)
	time.Sleep(50 * time.Millisecond)

	// Test onRespawn with various positions
	positions := []game.Vector2{
		{X: 100, Y: 100},
		{X: 200, Y: 300},
		{X: 400, Y: 500},
		{X: 0, Y: 0},
		{X: 800, Y: 600},
	}
	for _, pos := range positions {
		assert.NotPanics(t, func() {
			ts.handler.onRespawn(player1ID, pos)
		}, "Should not panic for position: %+v", pos)
	}
}

// TestSendWeaponState_SimpleCoverage tests happy path for sendWeaponState
func TestSendWeaponState_SimpleCoverage(t *testing.T) {
	ts := newTestServer()
	defer ts.Close()

	// Connect clients
	conn1, conn2 := ts.connectTwoClients(t)
	defer conn1.Close()
	defer conn2.Close()

	// Get player ID
	player1ID := consumeRoomJoinedAndGetPlayerID(t, conn1)
	consumeRoomJoined(t, conn2)
	time.Sleep(50 * time.Millisecond)

	// Test sendWeaponState multiple times
	for i := 0; i < 5; i++ {
		assert.NotPanics(t, func() {
			ts.handler.sendWeaponState(player1ID)
		}, "Should not panic on call %d", i)
		time.Sleep(10 * time.Millisecond)
	}
}

// TestSendWeaponSpawns_SimpleCoverage tests happy path for sendWeaponSpawns
func TestSendWeaponSpawns_SimpleCoverage(t *testing.T) {
	ts := newTestServer()
	defer ts.Close()

	// Connect clients
	conn1, conn2 := ts.connectTwoClients(t)
	defer conn1.Close()
	defer conn2.Close()

	// Get player ID
	player1ID := consumeRoomJoinedAndGetPlayerID(t, conn1)
	consumeRoomJoined(t, conn2)
	time.Sleep(50 * time.Millisecond)

	// Test sendWeaponSpawns multiple times
	for i := 0; i < 3; i++ {
		assert.NotPanics(t, func() {
			ts.handler.sendWeaponSpawns(player1ID)
		}, "Should not panic on call %d", i)
	}
}

// TestBroadcastMatchEnded_SimpleCoverage tests happy path for broadcastMatchEnded
func TestBroadcastMatchEnded_SimpleCoverage(t *testing.T) {
	ts := newTestServer()
	defer ts.Close()

	// Connect clients
	conn1, conn2 := ts.connectTwoClients(t)
	defer conn1.Close()
	defer conn2.Close()

	// Get player ID
	player1ID := consumeRoomJoinedAndGetPlayerID(t, conn1)
	consumeRoomJoined(t, conn2)
	time.Sleep(50 * time.Millisecond)

	// Get room
	room := ts.handler.roomManager.GetRoomByPlayerID(player1ID)
	assert.NotNil(t, room, "Room should exist")
	world := ts.handler.gameServer.GetWorld()

	// Test broadcastMatchEnded with different reasons
	reasons := []string{"time_limit", "kill_target", "manual", "disconnect"}
	for _, reason := range reasons {
		room.Match.EndReason = reason
		assert.NotPanics(t, func() {
			ts.handler.broadcastMatchEnded(room, world)
		}, "Should not panic for reason: %s", reason)
	}
}

// TestBroadcastMatchTimers_SimpleCoverage tests happy path for broadcastMatchTimers
func TestBroadcastMatchTimers_SimpleCoverage(t *testing.T) {
	ts := newTestServer()
	defer ts.Close()

	// Connect clients
	conn1, conn2 := ts.connectTwoClients(t)
	defer conn1.Close()
	defer conn2.Close()

	// Consume initial messages
	consumeRoomJoined(t, conn1)
	consumeRoomJoined(t, conn2)
	time.Sleep(50 * time.Millisecond)

	// Test broadcastMatchTimers multiple times
	for i := 0; i < 5; i++ {
		assert.NotPanics(t, func() {
			ts.handler.broadcastMatchTimers()
		}, "Should not panic on call %d", i)
		time.Sleep(10 * time.Millisecond)
	}
}

// TestOnHit_SimpleCoverage tests happy path variations for onHit
func TestOnHit_SimpleCoverage(t *testing.T) {
	ts := newTestServer()
	defer ts.Close()

	// Connect clients
	conn1, conn2 := ts.connectTwoClients(t)
	defer conn1.Close()
	defer conn2.Close()

	// Get player IDs
	player1ID := consumeRoomJoinedAndGetPlayerID(t, conn1)
	player2ID := consumeRoomJoinedAndGetPlayerID(t, conn2)
	time.Sleep(100 * time.Millisecond)

	// Test non-fatal hits
	for i := 0; i < 3; i++ {
		hitEvent := game.HitEvent{
			VictimID:     player2ID,
			AttackerID:   player1ID,
			ProjectileID: "proj-" + string(rune('a'+i)),
		}
		assert.NotPanics(t, func() {
			ts.handler.onHit(hitEvent)
		}, "Should not panic for hit %d", i)
		time.Sleep(50 * time.Millisecond)
	}
}

// TestHandleWeaponPickup_SimpleCoverage tests various valid pickup scenarios
func TestHandleWeaponPickup_SimpleCoverage(t *testing.T) {
	handler := NewWebSocketHandler()

	// Add player
	playerID := "test-player"
	handler.gameServer.AddPlayer(playerID)

	// Get player from world
	player, exists := handler.gameServer.GetWorld().GetPlayer(playerID)
	assert.True(t, exists, "Player should exist")

	// Test with each available crate
	crates := handler.gameServer.GetWeaponCrateManager().GetAllCrates()
	crateCount := 0
	for id, crate := range crates {
		if crate.IsAvailable && crateCount < 3 {
			// Position player at crate
			player.SetPosition(crate.Position)

			data := map[string]interface{}{
				"crateId": id,
			}

			assert.NotPanics(t, func() {
				handler.handleWeaponPickup(playerID, data)
			}, "Should not panic for crate: %s", id)

			crateCount++
		}
	}
}

// TestHandleInputState_SimpleCoverage tests various valid input states
func TestHandleInputState_SimpleCoverage(t *testing.T) {
	handler := NewWebSocketHandler()

	// Add player
	playerID := "test-player"
	handler.gameServer.AddPlayer(playerID)

	// Test with various input combinations
	inputs := []map[string]interface{}{
		{"up": true, "down": false, "left": false, "right": false, "aimAngle": 0.0},
		{"up": false, "down": true, "left": false, "right": false, "aimAngle": 1.57},
		{"up": false, "down": false, "left": true, "right": false, "aimAngle": 3.14},
		{"up": false, "down": false, "left": false, "right": true, "aimAngle": 4.71},
		{"up": true, "down": false, "left": true, "right": false, "aimAngle": 0.785},
	}

	for i, input := range inputs {
		assert.NotPanics(t, func() {
			handler.handleInputState(playerID, input)
		}, "Should not panic for input %d", i)
	}
}
