package network

import (
	"testing"
	"time"

	"github.com/mtomcal/stick-rumble-server/internal/game"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ==========================
// Melee Attack Tests
// ==========================

func TestHandlePlayerMeleeAttack_Success(t *testing.T) {
	ts := newTestServer()
	defer ts.Close()

	conn1, conn2 := ts.connectTwoClients(t)
	defer conn1.Close()
	defer conn2.Close()

	player1ID := consumeRoomJoinedAndGetPlayerID(t, conn1)
	player2ID := consumeRoomJoinedAndGetPlayerID(t, conn2)

	// Equip player 1 with a melee weapon (Bat)
	batWeapon := game.NewBat()
	ts.handler.gameServer.SetWeaponState(player1ID, game.NewWeaponState(batWeapon))

	// Position players close together for melee range
	world := ts.handler.gameServer.GetWorld()
	attacker, exists := world.GetPlayer(player1ID)
	require.True(t, exists)
	victim, exists := world.GetPlayer(player2ID)
	require.True(t, exists)

	// Set positions within melee range (30 units)
	attacker.Position = game.Vector2{X: 100, Y: 100}
	victim.Position = game.Vector2{X: 110, Y: 100} // 10 units away

	// Prepare melee attack data
	attackData := map[string]interface{}{
		"aimAngle": 0.0, // Aiming right towards victim
	}

	// Send melee attack
	ts.handler.handlePlayerMeleeAttack(player1ID, attackData)

	// Both players should receive melee:hit message
	msg, err := readMessageOfType(t, conn1, "melee:hit", 2*time.Second)
	require.NoError(t, err, "Should receive melee:hit")
	assert.Equal(t, "melee:hit", msg.Type)

	data, ok := msg.Data.(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, player1ID, data["attackerId"])
	assert.NotNil(t, data["victims"])
	assert.NotNil(t, data["knockbackApplied"])

	// Victims should include player2
	victims := data["victims"].([]interface{})
	assert.Contains(t, victims, player2ID, "Victim list should include player2")
}

func TestHandlePlayerMeleeAttack_NoVictims(t *testing.T) {
	ts := newTestServer()
	defer ts.Close()

	conn1, conn2 := ts.connectTwoClients(t)
	defer conn1.Close()
	defer conn2.Close()

	player1ID := consumeRoomJoinedAndGetPlayerID(t, conn1)
	_ = consumeRoomJoinedAndGetPlayerID(t, conn2)

	// Equip player 1 with a melee weapon
	batWeapon := game.NewBat()
	ts.handler.gameServer.SetWeaponState(player1ID, game.NewWeaponState(batWeapon))

	// Players are far apart (out of melee range)
	world := ts.handler.gameServer.GetWorld()
	attacker, exists := world.GetPlayer(player1ID)
	require.True(t, exists)

	attacker.Position = game.Vector2{X: 100, Y: 100}

	// Prepare melee attack data
	attackData := map[string]interface{}{
		"aimAngle": 0.0,
	}

	// Send melee attack
	ts.handler.handlePlayerMeleeAttack(player1ID, attackData)

	// Should still receive melee:hit with empty victims (for swing animation)
	msg, err := readMessageOfType(t, conn1, "melee:hit", 2*time.Second)
	require.NoError(t, err, "Should receive melee:hit even with no victims")

	data, ok := msg.Data.(map[string]interface{})
	require.True(t, ok)
	victims := data["victims"].([]interface{})
	assert.Empty(t, victims, "Should have empty victim list")
}

func TestHandlePlayerMeleeAttack_InvalidData(t *testing.T) {
	ts := newTestServer()
	defer ts.Close()

	conn1, conn2 := ts.connectTwoClients(t)
	defer conn1.Close()
	defer conn2.Close()

	player1ID := consumeRoomJoinedAndGetPlayerID(t, conn1)
	_ = consumeRoomJoinedAndGetPlayerID(t, conn2)

	// Send invalid data (missing aimAngle)
	invalidData := map[string]interface{}{
		"invalid": "data",
	}

	// Should fail schema validation and return early
	ts.handler.handlePlayerMeleeAttack(player1ID, invalidData)

	// Should not receive melee:hit message
	_, err := readMessageOfType(t, conn1, "melee:hit", 500*time.Millisecond)
	assert.Error(t, err, "Should timeout since validation failed")
}

func TestBroadcastMeleeHit(t *testing.T) {
	ts := newTestServer()
	defer ts.Close()

	conn1, conn2 := ts.connectTwoClients(t)
	defer conn1.Close()
	defer conn2.Close()

	player1ID := consumeRoomJoinedAndGetPlayerID(t, conn1)
	player2ID := consumeRoomJoinedAndGetPlayerID(t, conn2)

	// Broadcast melee hit
	victimIDs := []string{player2ID}
	ts.handler.broadcastMeleeHit(player1ID, victimIDs, true)

	// Both players should receive melee:hit
	msg, err := readMessageOfType(t, conn1, "melee:hit", 2*time.Second)
	require.NoError(t, err, "Should receive melee:hit")

	data, ok := msg.Data.(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, player1ID, data["attackerId"])
	assert.True(t, data["knockbackApplied"].(bool))

	victims := data["victims"].([]interface{})
	assert.Len(t, victims, 1)
	assert.Equal(t, player2ID, victims[0])
}

func TestBroadcastPlayerDamaged_MeleeVersion(t *testing.T) {
	ts := newTestServer()
	defer ts.Close()

	conn1, conn2 := ts.connectTwoClients(t)
	defer conn1.Close()
	defer conn2.Close()

	player1ID := consumeRoomJoinedAndGetPlayerID(t, conn1)
	player2ID := consumeRoomJoinedAndGetPlayerID(t, conn2)

	// Broadcast player damaged (melee attack version)
	ts.handler.broadcastPlayerDamaged(player1ID, player2ID, 30, 70)

	// Both players should receive player:damaged
	msg, err := readMessageOfType(t, conn1, "player:damaged", 2*time.Second)
	require.NoError(t, err, "Should receive player:damaged")

	data, ok := msg.Data.(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, player2ID, data["victimId"])
	assert.Equal(t, player1ID, data["attackerId"])
	assert.Equal(t, float64(30), data["damage"])
	assert.Equal(t, float64(70), data["newHealth"])
}

func TestProcessMeleeKill(t *testing.T) {
	ts := newTestServer()
	defer ts.Close()

	conn1, conn2 := ts.connectTwoClients(t)
	defer conn1.Close()
	defer conn2.Close()

	player1ID := consumeRoomJoinedAndGetPlayerID(t, conn1)
	player2ID := consumeRoomJoinedAndGetPlayerID(t, conn2)

	// Process melee kill
	ts.handler.processMeleeKill(player1ID, player2ID)

	// Both players should receive player:death
	msg, err := readMessageOfType(t, conn1, "player:death", 2*time.Second)
	require.NoError(t, err, "Should receive player:death")

	data, ok := msg.Data.(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, player2ID, data["victimId"])
	assert.Equal(t, player1ID, data["attackerId"])

	// Should also receive player:kill_credit
	creditMsg, err := readMessageOfType(t, conn1, "player:kill_credit", 2*time.Second)
	require.NoError(t, err, "Should receive player:kill_credit")

	creditData, ok := creditMsg.Data.(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, player1ID, creditData["killerId"])
	assert.Equal(t, player2ID, creditData["victimId"])

	// Verify attacker's kills incremented
	killerKills := creditData["killerKills"].(float64)
	assert.GreaterOrEqual(t, killerKills, 1.0, "Attacker should have at least 1 kill")
}

func TestHandlePlayerMeleeAttack_WithKill(t *testing.T) {
	ts := newTestServer()
	defer ts.Close()

	conn1, conn2 := ts.connectTwoClients(t)
	defer conn1.Close()
	defer conn2.Close()

	player1ID := consumeRoomJoinedAndGetPlayerID(t, conn1)
	player2ID := consumeRoomJoinedAndGetPlayerID(t, conn2)

	// Equip player 1 with a melee weapon
	katanaWeapon := game.NewKatana()
	ts.handler.gameServer.SetWeaponState(player1ID, game.NewWeaponState(katanaWeapon))

	// Position players close together
	world := ts.handler.gameServer.GetWorld()
	attacker, exists := world.GetPlayer(player1ID)
	require.True(t, exists)
	victim, exists := world.GetPlayer(player2ID)
	require.True(t, exists)

	attacker.Position = game.Vector2{X: 100, Y: 100}
	victim.Position = game.Vector2{X: 110, Y: 100}

	// Damage victim to near-death
	ts.handler.gameServer.DamagePlayer(player2ID, game.PlayerMaxHealth-10)

	// Prepare melee attack data
	attackData := map[string]interface{}{
		"aimAngle": 0.0,
	}

	// Send melee attack (should kill the victim)
	ts.handler.handlePlayerMeleeAttack(player1ID, attackData)

	// Should receive melee:hit
	_, err := readMessageOfType(t, conn1, "melee:hit", 2*time.Second)
	require.NoError(t, err, "Should receive melee:hit")

	// Should receive player:damaged
	_, err = readMessageOfType(t, conn1, "player:damaged", 2*time.Second)
	require.NoError(t, err, "Should receive player:damaged")

	// Should receive player:death
	deathMsg, err := readMessageOfType(t, conn1, "player:death", 2*time.Second)
	require.NoError(t, err, "Should receive player:death")

	deathData, ok := deathMsg.Data.(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, player2ID, deathData["victimId"])
}

// ==========================
// Dodge Roll Tests
// ==========================

func TestHandlePlayerDodgeRoll_WithInput(t *testing.T) {
	ts := newTestServer()
	defer ts.Close()

	conn1, conn2 := ts.connectTwoClients(t)
	defer conn1.Close()
	defer conn2.Close()

	player1ID := consumeRoomJoinedAndGetPlayerID(t, conn1)
	_ = consumeRoomJoinedAndGetPlayerID(t, conn2)

	// Get player and set input state (rolling forward)
	world := ts.handler.gameServer.GetWorld()
	player, exists := world.GetPlayer(player1ID)
	require.True(t, exists)

	// Set WASD input for roll direction
	input := game.InputState{
		Up:       true,
		Down:     false,
		Left:     false,
		Right:    false,
		AimAngle: 0.0,
	}
	player.SetInput(input)

	// Handle dodge roll
	ts.handler.handlePlayerDodgeRoll(player1ID)

	// Both players should receive roll:start
	msg, err := readMessageOfType(t, conn1, "roll:start", 2*time.Second)
	require.NoError(t, err, "Should receive roll:start")

	data, ok := msg.Data.(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, player1ID, data["playerId"])
	assert.NotNil(t, data["direction"])
	assert.NotNil(t, data["rollStartTime"])

	// Verify direction structure
	direction := data["direction"].(map[string]interface{})
	assert.NotNil(t, direction["x"])
	assert.NotNil(t, direction["y"])
}

func TestHandlePlayerDodgeRoll_StaticWithAimAngle(t *testing.T) {
	ts := newTestServer()
	defer ts.Close()

	conn1, conn2 := ts.connectTwoClients(t)
	defer conn1.Close()
	defer conn2.Close()

	player1ID := consumeRoomJoinedAndGetPlayerID(t, conn1)
	_ = consumeRoomJoinedAndGetPlayerID(t, conn2)

	// Get player and set aim angle (no WASD input)
	world := ts.handler.gameServer.GetWorld()
	player, exists := world.GetPlayer(player1ID)
	require.True(t, exists)

	// Set aim angle without WASD (rolls in aim direction)
	input := game.InputState{
		Up:       false,
		Down:     false,
		Left:     false,
		Right:    false,
		AimAngle: 1.57, // ~90 degrees
	}
	player.SetInput(input)

	// Handle dodge roll
	ts.handler.handlePlayerDodgeRoll(player1ID)

	// Should receive roll:start
	msg, err := readMessageOfType(t, conn1, "roll:start", 2*time.Second)
	require.NoError(t, err, "Should receive roll:start")

	data, ok := msg.Data.(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, player1ID, data["playerId"])
}

func TestHandlePlayerDodgeRoll_PlayerNotFound(t *testing.T) {
	ts := newTestServer()
	defer ts.Close()

	conn1, conn2 := ts.connectTwoClients(t)
	defer conn1.Close()
	defer conn2.Close()

	_ = consumeRoomJoinedAndGetPlayerID(t, conn1)
	_ = consumeRoomJoinedAndGetPlayerID(t, conn2)

	// Try to roll with non-existent player
	ts.handler.handlePlayerDodgeRoll("non-existent-player")

	// Should not receive roll:start
	_, err := readMessageOfType(t, conn1, "roll:start", 500*time.Millisecond)
	assert.Error(t, err, "Should timeout since player not found")
}

func TestBroadcastRollStart(t *testing.T) {
	ts := newTestServer()
	defer ts.Close()

	conn1, conn2 := ts.connectTwoClients(t)
	defer conn1.Close()
	defer conn2.Close()

	player1ID := consumeRoomJoinedAndGetPlayerID(t, conn1)
	_ = consumeRoomJoinedAndGetPlayerID(t, conn2)

	// Broadcast roll start
	direction := game.Vector2{X: 1.0, Y: 0.0}
	rollStartTime := time.Now()
	ts.handler.broadcastRollStart(player1ID, direction, rollStartTime)

	// Both players should receive roll:start
	msg, err := readMessageOfType(t, conn1, "roll:start", 2*time.Second)
	require.NoError(t, err, "Should receive roll:start")

	data, ok := msg.Data.(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, player1ID, data["playerId"])

	// Verify direction
	rollDirection := data["direction"].(map[string]interface{})
	assert.Equal(t, float64(1.0), rollDirection["x"])
	assert.Equal(t, float64(0.0), rollDirection["y"])

	// Verify timestamp
	rollTime := data["rollStartTime"].(float64)
	assert.GreaterOrEqual(t, rollTime, float64(rollStartTime.UnixMilli()-100))
}

func TestBroadcastRollEnd(t *testing.T) {
	ts := newTestServer()
	defer ts.Close()

	conn1, conn2 := ts.connectTwoClients(t)
	defer conn1.Close()
	defer conn2.Close()

	player1ID := consumeRoomJoinedAndGetPlayerID(t, conn1)
	_ = consumeRoomJoinedAndGetPlayerID(t, conn2)

	// Broadcast roll end
	ts.handler.broadcastRollEnd(player1ID, "duration_complete")

	// Both players should receive roll:end
	msg, err := readMessageOfType(t, conn1, "roll:end", 2*time.Second)
	require.NoError(t, err, "Should receive roll:end")

	data, ok := msg.Data.(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, player1ID, data["playerId"])
	assert.Equal(t, "duration_complete", data["reason"])
}

func TestHandlePlayerDodgeRoll_DiagonalDirection(t *testing.T) {
	ts := newTestServer()
	defer ts.Close()

	conn1, conn2 := ts.connectTwoClients(t)
	defer conn1.Close()
	defer conn2.Close()

	player1ID := consumeRoomJoinedAndGetPlayerID(t, conn1)
	_ = consumeRoomJoinedAndGetPlayerID(t, conn2)

	// Get player and set diagonal input (up+right)
	world := ts.handler.gameServer.GetWorld()
	player, exists := world.GetPlayer(player1ID)
	require.True(t, exists)

	input := game.InputState{
		Up:       true,
		Down:     false,
		Left:     false,
		Right:    true,
		AimAngle: 0.0,
	}
	player.SetInput(input)

	// Handle dodge roll
	ts.handler.handlePlayerDodgeRoll(player1ID)

	// Should receive roll:start with normalized diagonal direction
	msg, err := readMessageOfType(t, conn1, "roll:start", 2*time.Second)
	require.NoError(t, err, "Should receive roll:start")

	data, ok := msg.Data.(map[string]interface{})
	require.True(t, ok)

	direction := data["direction"].(map[string]interface{})
	x := direction["x"].(float64)
	y := direction["y"].(float64)

	// Direction should be normalized (length ~1.0)
	length := x*x + y*y
	assert.InDelta(t, 1.0, length, 0.01, "Direction should be normalized")
}
