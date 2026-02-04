package network

import (
	"testing"
	"time"

	"github.com/mtomcal/stick-rumble-server/internal/game"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ==========================
// Broadcast Helper Tests
// ==========================

func TestBroadcastPlayerMove(t *testing.T) {
	ts := newTestServer()
	defer ts.Close()

	conn1, conn2 := ts.connectTwoClients(t)
	defer conn1.Close()
	defer conn2.Close()

	player1ID := consumeRoomJoinedAndGetPlayerID(t, conn1)
	player2ID := consumeRoomJoinedAndGetPlayerID(t, conn2)

	// Send input to move player 1
	sendInputState(t, conn1, true, false, false, false)

	// Both players should receive state updates (either state:snapshot or state:delta)
	// First message is always a snapshot
	msg, err := readMessage(t, conn1, 2*time.Second)
	require.NoError(t, err, "Should receive state update message")

	// Accept either state:snapshot or state:delta
	require.Contains(t, []string{"state:snapshot", "state:delta"}, msg.Type, "Should receive state update")

	data, ok := msg.Data.(map[string]interface{})
	require.True(t, ok)

	players, ok := data["players"].([]interface{})
	require.True(t, ok)
	assert.NotEmpty(t, players, "Should have player updates")

	// Verify update structure
	for _, player := range players {
		updateMap := player.(map[string]interface{})
		playerID := updateMap["id"].(string)
		assert.NotEmpty(t, playerID)
		assert.Contains(t, []string{player1ID, player2ID}, playerID)

		position := updateMap["position"].(map[string]interface{})
		assert.NotNil(t, position["x"])
		assert.NotNil(t, position["y"])

		velocity := updateMap["velocity"].(map[string]interface{})
		assert.NotNil(t, velocity["x"])
		assert.NotNil(t, velocity["y"])
	}
}

func TestBroadcastProjectileSpawn(t *testing.T) {
	ts := newTestServer()
	defer ts.Close()

	conn1, conn2 := ts.connectTwoClients(t)

	_ = consumeRoomJoinedAndGetPlayerID(t, conn1)
	_ = consumeRoomJoinedAndGetPlayerID(t, conn2)

	// Player 1 shoots
	sendShootMessage(t, conn1, 1.57) // Aim at 90 degrees

	// Both players should receive projectile:spawn
	msg, err := readMessageOfType(t, conn2, "projectile:spawn", 2*time.Second)
	require.NoError(t, err, "Should receive projectile:spawn")

	assert.Equal(t, "projectile:spawn", msg.Type)

	data, ok := msg.Data.(map[string]interface{})
	require.True(t, ok)

	// Verify projectile data - schema uses "id" not "projectileId"
	assert.NotNil(t, data["id"], "id should not be nil")
	if projectileID, ok := data["id"].(string); ok {
		assert.NotEmpty(t, projectileID, "id should not be empty")
	}
	assert.NotNil(t, data["position"])
	assert.NotNil(t, data["velocity"])

	position := data["position"].(map[string]interface{})
	assert.NotNil(t, position["x"])
	assert.NotNil(t, position["y"])

	velocity := data["velocity"].(map[string]interface{})
	assert.NotNil(t, velocity["x"])
	assert.NotNil(t, velocity["y"])

	// Close connections after reading messages
	conn1.Close()
	conn2.Close()
}

// TestBroadcastProjectileDestroy is removed - projectile destruction is tested through shooting integration

func TestBroadcastPlayerDamaged(t *testing.T) {
	ts := newTestServer()
	defer ts.Close()

	conn1, conn2 := ts.connectTwoClients(t)

	player1ID := consumeRoomJoinedAndGetPlayerID(t, conn1)
	player2ID := consumeRoomJoinedAndGetPlayerID(t, conn2)

	// Apply damage to player 2 first (onHit only broadcasts, doesn't apply damage)
	ts.handler.gameServer.DamagePlayer(player2ID, 25)

	// Trigger hit broadcast
	ts.handler.onHit(game.HitEvent{
		VictimID:     player2ID,
		AttackerID:   player1ID,
		ProjectileID: "test-proj",
	})

	// Player 2 should receive player:damaged
	msg, err := readMessageOfType(t, conn2, "player:damaged", 2*time.Second)
	require.NoError(t, err, "Victim should receive player:damaged")

	data, ok := msg.Data.(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, player2ID, data["victimId"])

	newHealth, ok := data["newHealth"].(float64)
	require.True(t, ok)
	assert.Less(t, newHealth, 100.0, "Health should be reduced")

	damage, ok := data["damage"].(float64)
	require.True(t, ok)
	assert.Greater(t, damage, 0.0, "Damage should be positive")

	// Close connections after reading messages
	conn1.Close()
	conn2.Close()
}

func TestBroadcastPlayerDeath(t *testing.T) {
	ts := newTestServer()
	defer ts.Close()

	conn1, conn2 := ts.connectTwoClients(t)

	player1ID := consumeRoomJoinedAndGetPlayerID(t, conn1)
	player2ID := consumeRoomJoinedAndGetPlayerID(t, conn2)

	// Kill player 2 completely using DamagePlayer (GetPlayerState returns a snapshot)
	ts.handler.gameServer.DamagePlayer(player2ID, game.PlayerMaxHealth)

	// Deal killing blow
	ts.handler.onHit(game.HitEvent{
		VictimID:     player2ID,
		AttackerID:   player1ID,
		ProjectileID: "killing-blow",
	})

	// Both players should receive player:death
	msg, err := readMessageOfType(t, conn1, "player:death", 2*time.Second)
	require.NoError(t, err, "Should receive player:death")

	data, ok := msg.Data.(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, player2ID, data["victimId"])

	// Close connections after reading messages
	conn1.Close()
	conn2.Close()
}

func TestBroadcastKillCredit(t *testing.T) {
	ts := newTestServer()
	defer ts.Close()

	conn1, conn2 := ts.connectTwoClients(t)

	player1ID := consumeRoomJoinedAndGetPlayerID(t, conn1)
	player2ID := consumeRoomJoinedAndGetPlayerID(t, conn2)

	// Kill player 2 completely using DamagePlayer (GetPlayerState returns a snapshot)
	ts.handler.gameServer.DamagePlayer(player2ID, game.PlayerMaxHealth)

	// Deal killing blow
	ts.handler.onHit(game.HitEvent{
		VictimID:     player2ID,
		AttackerID:   player1ID,
		ProjectileID: "killing-blow",
	})

	// Player 1 should receive kill credit
	msg, err := readMessageOfType(t, conn1, "player:kill_credit", 2*time.Second)
	require.NoError(t, err, "Attacker should receive kill credit")

	data, ok := msg.Data.(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, player1ID, data["killerId"])
	assert.Equal(t, player2ID, data["victimId"])

	// killerKills field (not newKills)
	killerKills, ok := data["killerKills"].(float64)
	require.True(t, ok)
	assert.GreaterOrEqual(t, killerKills, 1.0)

	// Close connections after reading messages
	conn1.Close()
	conn2.Close()
}

// TestBroadcastPlayerRespawn is tested via integration test in integration_test.go
// Removed to simplify test suite

func TestBroadcastWeaponState(t *testing.T) {
	ts := newTestServer()
	defer ts.Close()

	conn1, conn2 := ts.connectTwoClients(t)
	defer conn1.Close()
	defer conn2.Close()

	player1ID := consumeRoomJoinedAndGetPlayerID(t, conn1)
	_ = consumeRoomJoinedAndGetPlayerID(t, conn2)

	// Trigger weapon state broadcast
	ts.handler.sendWeaponState(player1ID)

	// Player 1 should receive weapon:state
	msg, err := readMessageOfType(t, conn1, "weapon:state", 2*time.Second)
	require.NoError(t, err, "Should receive weapon:state")

	data, ok := msg.Data.(map[string]interface{})
	require.True(t, ok)

	// Verify weapon state structure
	assert.NotNil(t, data["currentAmmo"])
	assert.NotNil(t, data["maxAmmo"])
	assert.NotNil(t, data["isReloading"])
	assert.NotNil(t, data["canShoot"])
	assert.NotNil(t, data["weaponType"])
	assert.NotNil(t, data["isMelee"])

	currentAmmo, ok := data["currentAmmo"].(float64)
	require.True(t, ok)
	assert.GreaterOrEqual(t, currentAmmo, 0.0)

	maxAmmo, ok := data["maxAmmo"].(float64)
	require.True(t, ok)
	assert.Greater(t, maxAmmo, 0.0)

	weaponType, ok := data["weaponType"].(string)
	require.True(t, ok)
	assert.NotEmpty(t, weaponType, "weaponType should not be empty")

	isMelee, ok := data["isMelee"].(bool)
	require.True(t, ok)
	// Default weapon is Pistol which is not melee
	assert.False(t, isMelee, "Default Pistol should not be melee")
}

func TestBroadcastShootFailed(t *testing.T) {
	ts := newTestServer()
	defer ts.Close()

	conn1, conn2 := ts.connectTwoClients(t)
	defer conn1.Close()
	defer conn2.Close()

	player1ID := consumeRoomJoinedAndGetPlayerID(t, conn1)
	_ = consumeRoomJoinedAndGetPlayerID(t, conn2)

	// Send shoot failed message
	ts.handler.sendShootFailed(player1ID, "no_ammo")

	// Player 1 should receive shoot:failed
	msg, err := readMessageOfType(t, conn1, "shoot:failed", 2*time.Second)
	require.NoError(t, err, "Should receive shoot:failed")

	data, ok := msg.Data.(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, "no_ammo", data["reason"])
}

func TestBroadcastWeaponPickup(t *testing.T) {
	ts := newTestServer()
	defer ts.Close()

	conn1, conn2 := ts.connectTwoClients(t)

	player1ID := consumeRoomJoinedAndGetPlayerID(t, conn1)
	_ = consumeRoomJoinedAndGetPlayerID(t, conn2)

	// Broadcast weapon pickup
	respawnTime := time.Now().Add(30 * time.Second)
	ts.handler.broadcastWeaponPickup(player1ID, "crate-1", "uzi", respawnTime)

	// Both players should receive weapon:pickup_confirmed
	msg, err := readMessageOfType(t, conn1, "weapon:pickup_confirmed", 2*time.Second)
	require.NoError(t, err, "Should receive weapon:pickup_confirmed")

	data, ok := msg.Data.(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, player1ID, data["playerId"])
	assert.Equal(t, "crate-1", data["crateId"])
	assert.Equal(t, "uzi", data["weaponType"])
	// Schema uses "nextRespawnTime" as unix timestamp
	assert.NotNil(t, data["nextRespawnTime"], "Should have nextRespawnTime field")

	// Close connections after reading messages
	conn1.Close()
	conn2.Close()
}

// TestBroadcastWeaponRespawn is tested via integration test in integration_test.go
// Removed to simplify test suite

func TestBroadcastMatchTimer(t *testing.T) {
	ts := newTestServerWithConfig(100 * time.Millisecond)
	defer ts.Close()

	conn1, conn2 := ts.connectTwoClients(t)

	_ = consumeRoomJoinedAndGetPlayerID(t, conn1)
	_ = consumeRoomJoinedAndGetPlayerID(t, conn2)

	// Should receive match:timer messages periodically
	msg, err := readMessageOfType(t, conn1, "match:timer", 2*time.Second)
	require.NoError(t, err, "Should receive match:timer")

	data, ok := msg.Data.(map[string]interface{})
	require.True(t, ok)

	// Verify data contains expected field - schema only has remainingSeconds
	assert.NotNil(t, data["remainingSeconds"], "Should have remainingSeconds field")

	// Close connections after reading messages
	conn1.Close()
	conn2.Close()
}

// TestBroadcastMatchEnded is tested in integration_test.go

// ==========================
// Broadcast Validation Tests
// ==========================

func TestBroadcastWithNilPlayer(t *testing.T) {
	handler := NewWebSocketHandler()

	// Attempt to send weapon state to non-existent player - should not panic
	require.NotPanics(t, func() {
		handler.sendWeaponState("non-existent-player")
		handler.sendShootFailed("non-existent-player", "test")
	}, "Should handle non-existent player without panic")

	// Verify room lookup returns nil
	room := handler.roomManager.GetRoomByPlayerID("non-existent-player")
	assert.Nil(t, room, "Room should be nil for non-existent player")
}

// TestBroadcastWithNilRoom removed - simplified test suite

// TestBroadcastWithEmptyRoom removed - simplified test suite

// ==========================
// Hit Confirmation Tests
// ==========================

func TestHitConfirmedBroadcast(t *testing.T) {
	ts := newTestServer()
	defer ts.Close()

	conn1, conn2 := ts.connectTwoClients(t)
	defer conn1.Close()
	defer conn2.Close()

	player1ID := consumeRoomJoinedAndGetPlayerID(t, conn1)
	player2ID := consumeRoomJoinedAndGetPlayerID(t, conn2)

	// Trigger hit
	ts.handler.onHit(game.HitEvent{
		VictimID:     player2ID,
		AttackerID:   player1ID,
		ProjectileID: "hit-proj",
	})

	// Attacker should receive hit:confirmed
	msg, err := readMessageOfType(t, conn1, "hit:confirmed", 2*time.Second)
	require.NoError(t, err, "Attacker should receive hit:confirmed")

	data, ok := msg.Data.(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, player2ID, data["victimId"])
	assert.Equal(t, "hit-proj", data["projectileId"])

	// Damage field exists
	assert.NotNil(t, data["damage"], "Should have damage field")
}

// ==========================
// Message Validation Tests
// ==========================

func TestMessageTimestamps(t *testing.T) {
	ts := newTestServer()
	defer ts.Close()

	conn1, conn2 := ts.connectTwoClients(t)
	defer conn1.Close()
	defer conn2.Close()

	_ = consumeRoomJoinedAndGetPlayerID(t, conn1)
	_ = consumeRoomJoinedAndGetPlayerID(t, conn2)

	beforeTime := time.Now().UnixMilli()

	// Send a test message
	testMsg := Message{
		Type:      "test",
		Timestamp: time.Now().UnixMilli(),
		Data:      "timestamp-test",
	}
	sendMessage(t, conn1, testMsg)

	// Receive the message
	msg, err := readMessageOfType(t, conn2, "test", 2*time.Second)
	require.NoError(t, err)

	afterTime := time.Now().UnixMilli()

	// Verify timestamp is within reasonable range
	assert.GreaterOrEqual(t, msg.Timestamp, beforeTime)
	assert.LessOrEqual(t, msg.Timestamp, afterTime)
}

func TestInvalidMessageType(t *testing.T) {
	ts := newTestServer()
	defer ts.Close()

	conn1, conn2 := ts.connectTwoClients(t)
	defer conn1.Close()
	defer conn2.Close()

	_ = consumeRoomJoinedAndGetPlayerID(t, conn1)
	_ = consumeRoomJoinedAndGetPlayerID(t, conn2)

	// Send message with unknown type - should be broadcast as-is
	unknownMsg := Message{
		Type:      "unknown:type",
		Timestamp: time.Now().UnixMilli(),
		Data:      "test",
	}
	sendMessage(t, conn1, unknownMsg)

	// Player 2 should still receive it (default behavior)
	msg, err := readMessageOfType(t, conn2, "unknown:type", 2*time.Second)
	require.NoError(t, err)
	assert.Equal(t, "unknown:type", msg.Type)
}

// ==========================
// Performance Tests
// ==========================

func TestMultipleSimultaneousBroadcasts(t *testing.T) {
	ts := newTestServer()
	defer ts.Close()

	conn1, conn2 := ts.connectTwoClients(t)
	defer conn1.Close()
	defer conn2.Close()

	_ = consumeRoomJoinedAndGetPlayerID(t, conn1)
	_ = consumeRoomJoinedAndGetPlayerID(t, conn2)

	// Send multiple messages rapidly
	for i := 0; i < 10; i++ {
		msg := Message{
			Type:      "test",
			Timestamp: time.Now().UnixMilli(),
			Data:      i,
		}
		sendMessage(t, conn1, msg)
	}

	// Verify we receive all messages
	receivedCount := 0
	timeout := time.Now().Add(3 * time.Second)
	for time.Now().Before(timeout) && receivedCount < 10 {
		msg, err := readMessageOfType(t, conn2, "test", 500*time.Millisecond)
		if err == nil && msg != nil {
			receivedCount++
		}
	}

	assert.GreaterOrEqual(t, receivedCount, 8, "Should receive most messages")
}

// ==========================
// Edge Case Coverage Tests
// ==========================

func TestBroadcastPlayerStatesWithEmptyArray(t *testing.T) {
	handler := NewWebSocketHandler()

	// Should not panic with empty player states (early return on line 19)
	require.NotPanics(t, func() {
		handler.broadcastPlayerStates([]game.PlayerStateSnapshot{})
	}, "Should handle empty player states without panic")

	// Verify no rooms exist (early return prevents broadcast)
	rooms := handler.roomManager.GetAllRooms()
	assert.Empty(t, rooms, "Should have no rooms for empty broadcast")
}

func TestSendWeaponSpawnsMessage(t *testing.T) {
	ts := newTestServer()
	defer ts.Close()

	conn1, conn2 := ts.connectTwoClients(t)
	defer conn1.Close()
	defer conn2.Close()

	player1ID := consumeRoomJoinedAndGetPlayerID(t, conn1)
	_ = consumeRoomJoinedAndGetPlayerID(t, conn2)

	// Send weapon spawns message
	ts.handler.sendWeaponSpawns(player1ID)

	// Should receive weapon:spawned message
	msg, err := readMessageOfType(t, conn1, "weapon:spawned", 2*time.Second)
	require.NoError(t, err, "Should receive weapon:spawned")

	data, ok := msg.Data.(map[string]interface{})
	require.True(t, ok)
	assert.NotNil(t, data["crates"], "Should have crates field")
}
