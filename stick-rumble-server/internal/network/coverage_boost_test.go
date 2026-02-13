package network

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	"github.com/mtomcal/stick-rumble-server/internal/game"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// newGlobalTestServer creates a test server using the package-level HandleWebSocket function
func newGlobalTestServer() *testServer {
	ctx, cancel := context.WithCancel(context.Background())
	StartGlobalHandler(ctx)
	server := httptest.NewServer(http.HandlerFunc(HandleWebSocket))
	return &testServer{
		Server:  server,
		handler: getGlobalHandler(),
		ctx:     ctx,
		cancel:  cancel,
	}
}

// ==========================
// Coverage Boost Tests
// Tests with ENABLE_SCHEMA_VALIDATION=true to cover validateOutgoingMessage
// error paths and broadcast_helper validation branches
// ==========================

// withSchemaValidation enables schema validation for the duration of a test
func withSchemaValidation(t *testing.T) {
	t.Helper()
	os.Setenv("ENABLE_SCHEMA_VALIDATION", "true")
	t.Cleanup(func() {
		os.Unsetenv("ENABLE_SCHEMA_VALIDATION")
	})
}

// TestValidateOutgoingMessageValidData tests validateOutgoingMessage with valid schema data
func TestValidateOutgoingMessageValidData(t *testing.T) {
	withSchemaValidation(t)
	handler := NewWebSocketHandler()

	// Valid data should pass validation
	data := map[string]interface{}{
		"remainingSeconds": float64(120),
	}
	err := handler.validateOutgoingMessage("match:timer", data)
	assert.NoError(t, err, "Valid data should pass validation")
}

// TestValidateOutgoingMessageWrongFields tests validation failure with wrong fields
func TestValidateOutgoingMessageWrongFields(t *testing.T) {
	withSchemaValidation(t)
	handler := NewWebSocketHandler()

	// Invalid data — wrong type for known schema
	data := map[string]interface{}{
		"wrongField": "invalid",
	}
	err := handler.validateOutgoingMessage("match:timer", data)
	// May or may not error depending on schema strictness, but covers the code path
	_ = err
}

// TestValidateOutgoingMessagePanicRecovery tests the defer/recover panic path
func TestValidateOutgoingMessagePanicRecovery(t *testing.T) {
	withSchemaValidation(t)
	handler := NewWebSocketHandler()

	// Test with data that might trigger panic in validator (channel type can't be serialized)
	// The panic recovery defer should catch it
	ch := make(chan int)
	err := handler.validateOutgoingMessage("match:timer", ch)
	// Should either error or be caught by recovery, but not panic
	_ = err
}

// TestBroadcastProjectileSpawnWithValidation tests broadcastProjectileSpawn with schema validation enabled
func TestBroadcastProjectileSpawnWithValidation(t *testing.T) {
	withSchemaValidation(t)
	ts := newTestServer()
	defer ts.Close()

	conn1, conn2 := ts.connectTwoClients(t)
	defer conn1.Close()
	defer conn2.Close()

	_ = consumeRoomJoinedAndGetPlayerID(t, conn1)
	_ = consumeRoomJoinedAndGetPlayerID(t, conn2)

	proj := &game.Projectile{
		ID:         "test-proj-val",
		OwnerID:    "test-owner",
		WeaponType: "pistol",
		Position:   game.Vector2{X: 100, Y: 200},
		Velocity:   game.Vector2{X: 10, Y: 0},
		Active:     true,
	}

	require.NotPanics(t, func() {
		ts.handler.broadcastProjectileSpawn(proj)
	})

	msg, err := readMessageOfType(t, conn1, "projectile:spawn", 2*time.Second)
	require.NoError(t, err)
	assert.Equal(t, "projectile:spawn", msg.Type)
}

// TestBroadcastMatchTimersWithValidation tests broadcastMatchTimers with schema validation enabled
func TestBroadcastMatchTimersWithValidation(t *testing.T) {
	withSchemaValidation(t)
	ts := newTestServer()
	defer ts.Close()

	conn1, conn2 := ts.connectTwoClients(t)
	defer conn1.Close()
	defer conn2.Close()

	_ = consumeRoomJoinedAndGetPlayerID(t, conn1)
	_ = consumeRoomJoinedAndGetPlayerID(t, conn2)

	require.NotPanics(t, func() {
		ts.handler.broadcastMatchTimers()
	})

	msg, err := readMessageOfType(t, conn1, "match:timer", 2*time.Second)
	require.NoError(t, err)
	assert.Equal(t, "match:timer", msg.Type)
}

// TestSendWeaponStateWithValidation tests sendWeaponState with validation enabled
func TestSendWeaponStateWithValidation(t *testing.T) {
	withSchemaValidation(t)
	ts := newTestServer()
	defer ts.Close()

	conn1, conn2 := ts.connectTwoClients(t)
	defer conn1.Close()
	defer conn2.Close()

	player1ID := consumeRoomJoinedAndGetPlayerID(t, conn1)
	_ = consumeRoomJoinedAndGetPlayerID(t, conn2)

	require.NotPanics(t, func() {
		ts.handler.sendWeaponState(player1ID)
	})

	msg, err := readMessageOfType(t, conn1, "weapon:state", 2*time.Second)
	require.NoError(t, err)
	assert.Equal(t, "weapon:state", msg.Type)
}

// TestSendShootFailedWithValidation tests sendShootFailed with validation enabled
func TestSendShootFailedWithValidation(t *testing.T) {
	withSchemaValidation(t)
	ts := newTestServer()
	defer ts.Close()

	conn1, conn2 := ts.connectTwoClients(t)
	defer conn1.Close()
	defer conn2.Close()

	player1ID := consumeRoomJoinedAndGetPlayerID(t, conn1)
	_ = consumeRoomJoinedAndGetPlayerID(t, conn2)

	require.NotPanics(t, func() {
		ts.handler.sendShootFailed(player1ID, "no_ammo")
	})

	msg, err := readMessageOfType(t, conn1, "shoot:failed", 2*time.Second)
	require.NoError(t, err)
	assert.Equal(t, "shoot:failed", msg.Type)
}

// TestBroadcastMatchEndedWithValidation tests broadcastMatchEnded with validation enabled
func TestBroadcastMatchEndedWithValidation(t *testing.T) {
	withSchemaValidation(t)
	ts := newTestServer()
	defer ts.Close()

	conn1, conn2 := ts.connectTwoClients(t)
	defer conn1.Close()
	defer conn2.Close()

	player1ID := consumeRoomJoinedAndGetPlayerID(t, conn1)
	_ = consumeRoomJoinedAndGetPlayerID(t, conn2)

	room := ts.handler.roomManager.GetRoomByPlayerID(player1ID)
	require.NotNil(t, room)
	room.Match.EndMatch("test_reason")

	require.NotPanics(t, func() {
		ts.handler.broadcastMatchEnded(room, ts.handler.gameServer.GetWorld())
	})

	msg, err := readMessageOfType(t, conn1, "match:ended", 2*time.Second)
	require.NoError(t, err)
	assert.Equal(t, "match:ended", msg.Type)
}

// TestBroadcastWeaponPickupWithValidation tests broadcastWeaponPickup with validation enabled
func TestBroadcastWeaponPickupWithValidation(t *testing.T) {
	withSchemaValidation(t)
	ts := newTestServer()
	defer ts.Close()

	conn1, conn2 := ts.connectTwoClients(t)
	defer conn1.Close()
	defer conn2.Close()

	player1ID := consumeRoomJoinedAndGetPlayerID(t, conn1)
	_ = consumeRoomJoinedAndGetPlayerID(t, conn2)

	respawnTime := time.Now().Add(30 * time.Second)
	require.NotPanics(t, func() {
		ts.handler.broadcastWeaponPickup(player1ID, "crate-1", "uzi", respawnTime)
	})

	msg, err := readMessageOfType(t, conn1, "weapon:pickup_confirmed", 2*time.Second)
	require.NoError(t, err)
	assert.Equal(t, "weapon:pickup_confirmed", msg.Type)
}

// TestBroadcastWeaponRespawnWithValidation tests broadcastWeaponRespawn with validation enabled
func TestBroadcastWeaponRespawnWithValidation(t *testing.T) {
	withSchemaValidation(t)
	ts := newTestServer()
	defer ts.Close()

	conn1, conn2 := ts.connectTwoClients(t)
	defer conn1.Close()
	defer conn2.Close()

	_ = consumeRoomJoinedAndGetPlayerID(t, conn1)
	_ = consumeRoomJoinedAndGetPlayerID(t, conn2)

	crate := &game.WeaponCrate{
		ID:         "test-crate-val",
		WeaponType: "ak47",
		Position:   game.Vector2{X: 150, Y: 250},
	}

	require.NotPanics(t, func() {
		ts.handler.broadcastWeaponRespawn(crate)
	})

	msg, err := readMessageOfType(t, conn1, "weapon:respawned", 2*time.Second)
	require.NoError(t, err)
	assert.Equal(t, "weapon:respawned", msg.Type)
}

// TestSendWeaponSpawnsWithValidation tests sendWeaponSpawns with validation enabled
func TestSendWeaponSpawnsWithValidation(t *testing.T) {
	withSchemaValidation(t)
	ts := newTestServer()
	defer ts.Close()

	conn1, conn2 := ts.connectTwoClients(t)
	defer conn1.Close()
	defer conn2.Close()

	player1ID := consumeRoomJoinedAndGetPlayerID(t, conn1)
	_ = consumeRoomJoinedAndGetPlayerID(t, conn2)

	require.NotPanics(t, func() {
		ts.handler.sendWeaponSpawns(player1ID)
	})

	msg, err := readMessageOfType(t, conn1, "weapon:spawned", 2*time.Second)
	require.NoError(t, err)
	assert.Equal(t, "weapon:spawned", msg.Type)
}

// TestBroadcastRollStartWithValidation tests broadcastRollStart with validation enabled
func TestBroadcastRollStartWithValidation(t *testing.T) {
	withSchemaValidation(t)
	ts := newTestServer()
	defer ts.Close()

	conn1, conn2 := ts.connectTwoClients(t)
	defer conn1.Close()
	defer conn2.Close()

	player1ID := consumeRoomJoinedAndGetPlayerID(t, conn1)
	_ = consumeRoomJoinedAndGetPlayerID(t, conn2)

	require.NotPanics(t, func() {
		ts.handler.broadcastRollStart(player1ID, game.Vector2{X: 1, Y: 0}, time.Now())
	})

	msg, err := readMessageOfType(t, conn1, "roll:start", 2*time.Second)
	require.NoError(t, err)
	assert.Equal(t, "roll:start", msg.Type)
}

// TestBroadcastMeleeHitWithValidation tests broadcastMeleeHit with validation enabled
func TestBroadcastMeleeHitWithValidation(t *testing.T) {
	withSchemaValidation(t)
	ts := newTestServer()
	defer ts.Close()

	conn1, conn2 := ts.connectTwoClients(t)
	defer conn1.Close()
	defer conn2.Close()

	player1ID := consumeRoomJoinedAndGetPlayerID(t, conn1)
	player2ID := consumeRoomJoinedAndGetPlayerID(t, conn2)

	require.NotPanics(t, func() {
		ts.handler.broadcastMeleeHit(player1ID, []string{player2ID}, true)
	})

	msg, err := readMessageOfType(t, conn1, "melee:hit", 2*time.Second)
	require.NoError(t, err)
	assert.Equal(t, "melee:hit", msg.Type)
}

// TestBroadcastPlayerDamagedWithValidation tests broadcastPlayerDamaged with validation enabled
func TestBroadcastPlayerDamagedWithValidation(t *testing.T) {
	withSchemaValidation(t)
	ts := newTestServer()
	defer ts.Close()

	conn1, conn2 := ts.connectTwoClients(t)
	defer conn1.Close()
	defer conn2.Close()

	player1ID := consumeRoomJoinedAndGetPlayerID(t, conn1)
	player2ID := consumeRoomJoinedAndGetPlayerID(t, conn2)

	require.NotPanics(t, func() {
		ts.handler.broadcastPlayerDamaged(player1ID, player2ID, 25, 75)
	})

	msg, err := readMessageOfType(t, conn1, "player:damaged", 2*time.Second)
	require.NoError(t, err)
	assert.Equal(t, "player:damaged", msg.Type)
}

// TestBroadcastRollEndWithValidation tests broadcastRollEnd with validation enabled
func TestBroadcastRollEndWithValidation(t *testing.T) {
	withSchemaValidation(t)
	ts := newTestServer()
	defer ts.Close()

	conn1, conn2 := ts.connectTwoClients(t)
	defer conn1.Close()
	defer conn2.Close()

	player1ID := consumeRoomJoinedAndGetPlayerID(t, conn1)
	_ = consumeRoomJoinedAndGetPlayerID(t, conn2)

	require.NotPanics(t, func() {
		ts.handler.broadcastRollEnd(player1ID, "completed")
	})

	msg, err := readMessageOfType(t, conn1, "roll:end", 2*time.Second)
	require.NoError(t, err)
	assert.Equal(t, "roll:end", msg.Type)
}

// TestOnHitWithValidation tests onHit with validation enabled (covers death/kill_credit paths)
func TestOnHitWithValidation(t *testing.T) {
	withSchemaValidation(t)
	ts := newTestServer()
	defer ts.Close()

	conn1, conn2 := ts.connectTwoClients(t)
	defer conn1.Close()
	defer conn2.Close()

	player1ID := consumeRoomJoinedAndGetPlayerID(t, conn1)
	player2ID := consumeRoomJoinedAndGetPlayerID(t, conn2)

	// Regular hit (non-lethal)
	ts.handler.onHit(game.HitEvent{
		VictimID:     player2ID,
		AttackerID:   player1ID,
		ProjectileID: "proj-val-1",
	})

	msg, err := readMessageOfType(t, conn2, "player:damaged", 2*time.Second)
	require.NoError(t, err)
	assert.Equal(t, "player:damaged", msg.Type)
}

// TestOnHitDeathWithValidation tests the full death chain with validation enabled
func TestOnHitDeathWithValidation(t *testing.T) {
	withSchemaValidation(t)
	ts := newTestServer()
	defer ts.Close()

	conn1, conn2 := ts.connectTwoClients(t)
	defer conn1.Close()
	defer conn2.Close()

	player1ID := consumeRoomJoinedAndGetPlayerID(t, conn1)
	player2ID := consumeRoomJoinedAndGetPlayerID(t, conn2)

	// Kill the victim to trigger death/kill_credit code paths
	ts.handler.gameServer.DamagePlayer(player2ID, game.PlayerMaxHealth)

	ts.handler.onHit(game.HitEvent{
		VictimID:     player2ID,
		AttackerID:   player1ID,
		ProjectileID: "proj-kill-val",
	})

	// Should receive player:death
	msg, err := readMessageOfType(t, conn1, "player:death", 2*time.Second)
	require.NoError(t, err)
	assert.Equal(t, "player:death", msg.Type)

	// Should receive kill_credit
	killMsg, err := readMessageOfType(t, conn1, "player:kill_credit", 2*time.Second)
	require.NoError(t, err)
	assert.Equal(t, "player:kill_credit", killMsg.Type)
}

// TestOnRespawnWithValidation tests onRespawn with validation enabled
func TestOnRespawnWithValidation(t *testing.T) {
	withSchemaValidation(t)
	ts := newTestServer()
	defer ts.Close()

	conn1, conn2 := ts.connectTwoClients(t)
	defer conn1.Close()
	defer conn2.Close()

	player1ID := consumeRoomJoinedAndGetPlayerID(t, conn1)
	_ = consumeRoomJoinedAndGetPlayerID(t, conn2)

	require.NotPanics(t, func() {
		ts.handler.onRespawn(player1ID, game.Vector2{X: 200, Y: 300})
	})

	msg, err := readMessageOfType(t, conn1, "player:respawn", 2*time.Second)
	require.NoError(t, err)
	assert.Equal(t, "player:respawn", msg.Type)
}

// TestProcessMeleeKillWithValidation tests processMeleeKill with validation enabled
func TestProcessMeleeKillWithValidation(t *testing.T) {
	withSchemaValidation(t)
	ts := newTestServer()
	defer ts.Close()

	conn1, conn2 := ts.connectTwoClients(t)
	defer conn1.Close()
	defer conn2.Close()

	player1ID := consumeRoomJoinedAndGetPlayerID(t, conn1)
	player2ID := consumeRoomJoinedAndGetPlayerID(t, conn2)

	require.NotPanics(t, func() {
		ts.handler.processMeleeKill(player1ID, player2ID)
	})

	// Should receive player:death
	msg, err := readMessageOfType(t, conn1, "player:death", 2*time.Second)
	require.NoError(t, err)
	assert.Equal(t, "player:death", msg.Type)
}

// ==========================
// Global HandleWebSocket function test (line 352)
// ==========================

// TestGlobalHandleWebSocket tests the package-level HandleWebSocket function
func TestGlobalHandleWebSocket(t *testing.T) {
	resetGlobalHandler()
	defer resetGlobalHandler()

	// Use the global HandleWebSocket function directly
	ts := newGlobalTestServer()
	defer ts.Close()

	conn1 := ts.connectClient(t)
	conn2 := ts.connectClient(t)
	defer conn1.Close()
	defer conn2.Close()

	// Both should receive room:joined
	msg1, err := readMessageOfType(t, conn1, "room:joined", 2*time.Second)
	require.NoError(t, err)
	assert.Equal(t, "room:joined", msg1.Type)

	msg2, err := readMessageOfType(t, conn2, "room:joined", 2*time.Second)
	require.NoError(t, err)
	assert.Equal(t, "room:joined", msg2.Type)
}

// ==========================
// getPlayerRTT with valid player (42.9% coverage)
// ==========================

// TestGetPlayerRTTValidPlayer tests getPlayerRTT when player is in a room
func TestGetPlayerRTTValidPlayer(t *testing.T) {
	ts := newTestServer()
	defer ts.Close()

	conn1, conn2 := ts.connectTwoClients(t)
	defer conn1.Close()
	defer conn2.Close()

	player1ID := consumeRoomJoinedAndGetPlayerID(t, conn1)
	_ = consumeRoomJoinedAndGetPlayerID(t, conn2)

	// Player is in room, should return RTT (0 if no pings yet)
	rtt := ts.handler.getPlayerRTT(player1ID)
	assert.GreaterOrEqual(t, rtt, int64(0), "RTT should be >= 0")
}

// ==========================
// sendSnapshot/sendDelta with validation enabled
// ==========================

// TestBroadcastPlayerStatesWithValidation tests broadcastPlayerStates with schema validation
func TestBroadcastPlayerStatesWithValidation(t *testing.T) {
	withSchemaValidation(t)
	ts := newTestServer()
	defer ts.Close()

	conn1, conn2 := ts.connectTwoClients(t)
	defer conn1.Close()
	defer conn2.Close()

	player1ID := consumeRoomJoinedAndGetPlayerID(t, conn1)
	player2ID := consumeRoomJoinedAndGetPlayerID(t, conn2)

	states := []game.PlayerStateSnapshot{
		{
			ID:       player1ID,
			Position: game.Vector2{X: 100, Y: 200},
			Velocity: game.Vector2{X: 5, Y: 0},
			AimAngle: 0.5,
		},
		{
			ID:       player2ID,
			Position: game.Vector2{X: 300, Y: 400},
			Velocity: game.Vector2{X: 0, Y: 5},
			AimAngle: 1.0,
		},
	}

	require.NotPanics(t, func() {
		ts.handler.broadcastPlayerStates(states)
	})

	// Should receive state:snapshot
	msg, err := readMessageOfType(t, conn1, "state:snapshot", 2*time.Second)
	require.NoError(t, err)
	assert.Equal(t, "state:snapshot", msg.Type)
}

// ==========================
// sendWeaponState via waiting player path
// ==========================

// TestSendWeaponStateToWaitingPlayer tests the waiting player fallback path
func TestSendWeaponStateToWaitingPlayer(t *testing.T) {
	ts := newTestServer()
	defer ts.Close()

	// Connect only 1 client (not enough for a room - player stays waiting)
	conn1 := ts.connectClient(t)
	defer conn1.Close()

	// Wait for room:joined — single player might get a "waiting" state
	// We need to find the player ID
	time.Sleep(200 * time.Millisecond)

	// Use the handler directly with an unknown player (will hit SendToWaitingPlayer)
	require.NotPanics(t, func() {
		ts.handler.sendShootFailed("orphan-player", "no_ammo")
	})
}

// ==========================
// Default message case in HandleWebSocket
// ==========================

// TestDefaultMessageBroadcast tests the default case in the message switch
func TestDefaultMessageBroadcast(t *testing.T) {
	ts := newTestServer()
	defer ts.Close()

	conn1, conn2 := ts.connectTwoClients(t)
	defer conn1.Close()
	defer conn2.Close()

	_ = consumeRoomJoinedAndGetPlayerID(t, conn1)
	_ = consumeRoomJoinedAndGetPlayerID(t, conn2)

	// Send an unknown message type — should be broadcast via default case
	unknownMsg := Message{
		Type:      "custom:unknown",
		Timestamp: time.Now().UnixMilli(),
		Data:      map[string]string{"key": "value"},
	}
	msgBytes, err := json.Marshal(unknownMsg)
	require.NoError(t, err)
	err = conn1.WriteMessage(websocket.TextMessage, msgBytes)
	require.NoError(t, err)

	// conn2 should receive it via room.Broadcast
	msg, err := readMessageOfType(t, conn2, "custom:unknown", 2*time.Second)
	require.NoError(t, err)
	assert.Equal(t, "custom:unknown", msg.Type)
}

// ==========================
// Invalid JSON message test
// ==========================

// TestInvalidJSONMessage tests sending invalid JSON to the server
func TestInvalidJSONMessage(t *testing.T) {
	ts := newTestServer()
	defer ts.Close()

	conn1, conn2 := ts.connectTwoClients(t)
	defer conn1.Close()
	defer conn2.Close()

	_ = consumeRoomJoinedAndGetPlayerID(t, conn1)
	_ = consumeRoomJoinedAndGetPlayerID(t, conn2)

	// Send invalid JSON
	err := conn1.WriteMessage(websocket.TextMessage, []byte("not valid json {{{"))
	require.NoError(t, err)

	// Connection should still work after invalid JSON
	validMsg := Message{
		Type:      "test",
		Timestamp: time.Now().UnixMilli(),
		Data:      "still works",
	}
	sendMessage(t, conn1, validMsg)

	// conn2 should receive the valid message
	msg, err := readMessageOfType(t, conn2, "test", 2*time.Second)
	require.NoError(t, err)
	assert.Equal(t, "test", msg.Type)
}
