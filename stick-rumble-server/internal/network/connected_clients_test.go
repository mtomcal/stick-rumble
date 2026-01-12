package network

import (
	"testing"
	"time"

	"github.com/mtomcal/stick-rumble-server/internal/game"
	"github.com/stretchr/testify/assert"
)

// TestBroadcastWeaponPickup_WithConnectedClients tests broadcastWeaponPickup with real connections
func TestBroadcastWeaponPickup_WithConnectedClients(t *testing.T) {
	ts := newTestServer()
	defer ts.Close()

	// Connect two clients
	conn1, conn2 := ts.connectTwoClients(t)
	defer conn1.Close()
	defer conn2.Close()

	// Consume initial messages
	player1ID := consumeRoomJoinedAndGetPlayerID(t, conn1)
	consumeRoomJoined(t, conn2)
	time.Sleep(50 * time.Millisecond)

	// Call broadcastWeaponPickup - this will exercise the BroadcastToAll path
	respawnTime := time.Now().Add(30 * time.Second)
	ts.handler.broadcastWeaponPickup(player1ID, "crate-test", "uzi", respawnTime)

	// Give time for message to propagate
	time.Sleep(50 * time.Millisecond)
}

// TestSendShootFailed_WithConnectedClients tests sendShootFailed with real connections
func TestSendShootFailed_WithConnectedClients(t *testing.T) {
	ts := newTestServer()
	defer ts.Close()

	// Connect two clients
	conn1, conn2 := ts.connectTwoClients(t)
	defer conn1.Close()
	defer conn2.Close()

	// Get player IDs
	player1ID := consumeRoomJoinedAndGetPlayerID(t, conn1)
	consumeRoomJoined(t, conn2)
	time.Sleep(50 * time.Millisecond)

	// Call sendShootFailed - this will exercise the send path
	ts.handler.sendShootFailed(player1ID, "empty_magazine")

	// Give time for message to propagate
	time.Sleep(50 * time.Millisecond)
}

// TestOnHit_WithConnectedClients_NonFatalHit tests onHit with non-fatal hit
func TestOnHit_WithConnectedClients_NonFatalHit(t *testing.T) {
	ts := newTestServer()
	defer ts.Close()

	// Connect two clients
	conn1, conn2 := ts.connectTwoClients(t)
	defer conn1.Close()
	defer conn2.Close()

	// Get player IDs
	player1ID := consumeRoomJoinedAndGetPlayerID(t, conn1)
	player2ID := consumeRoomJoinedAndGetPlayerID(t, conn2)
	time.Sleep(100 * time.Millisecond)

	// Create non-fatal hit
	hitEvent := game.HitEvent{
		VictimID:     player2ID,
		AttackerID:   player1ID,
		ProjectileID: "non-fatal-proj",
	}
	ts.handler.onHit(hitEvent)

	// Give time for all messages to propagate
	time.Sleep(100 * time.Millisecond)
}

// TestBroadcastMatchEnded_WithConnectedClients tests broadcastMatchEnded with real connections
func TestBroadcastMatchEnded_WithConnectedClients(t *testing.T) {
	ts := newTestServer()
	defer ts.Close()

	// Connect two clients
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

	// End the match
	room.Match.EndReason = "time_limit"
	ts.handler.broadcastMatchEnded(room, world)

	// Give time for message to propagate
	time.Sleep(50 * time.Millisecond)
}

// TestSendWeaponState_WithConnectedClients tests sendWeaponState with real connections
func TestSendWeaponState_WithConnectedClients(t *testing.T) {
	ts := newTestServer()
	defer ts.Close()

	// Connect two clients
	conn1, conn2 := ts.connectTwoClients(t)
	defer conn1.Close()
	defer conn2.Close()

	// Get player ID
	player1ID := consumeRoomJoinedAndGetPlayerID(t, conn1)
	consumeRoomJoined(t, conn2)
	time.Sleep(50 * time.Millisecond)

	// Call sendWeaponState multiple times
	for i := 0; i < 5; i++ {
		ts.handler.sendWeaponState(player1ID)
		time.Sleep(10 * time.Millisecond)
	}
}

// TestSendWeaponSpawns_WithConnectedClients tests sendWeaponSpawns with real connections
func TestSendWeaponSpawns_WithConnectedClients(t *testing.T) {
	ts := newTestServer()
	defer ts.Close()

	// Connect two clients
	conn1, conn2 := ts.connectTwoClients(t)
	defer conn1.Close()
	defer conn2.Close()

	// Get player ID
	player1ID := consumeRoomJoinedAndGetPlayerID(t, conn1)
	consumeRoomJoined(t, conn2)
	time.Sleep(50 * time.Millisecond)

	// Call sendWeaponSpawns multiple times
	for i := 0; i < 3; i++ {
		ts.handler.sendWeaponSpawns(player1ID)
		time.Sleep(10 * time.Millisecond)
	}
}

// TestBroadcastMatchTimers_WithConnectedClients tests broadcastMatchTimers with real connections
func TestBroadcastMatchTimers_WithConnectedClients(t *testing.T) {
	ts := newTestServer()
	defer ts.Close()

	// Connect two clients
	conn1, conn2 := ts.connectTwoClients(t)
	defer conn1.Close()
	defer conn2.Close()

	// Consume initial messages
	consumeRoomJoined(t, conn1)
	consumeRoomJoined(t, conn2)
	time.Sleep(50 * time.Millisecond)

	// Call broadcastMatchTimers multiple times
	for i := 0; i < 5; i++ {
		ts.handler.broadcastMatchTimers()
		time.Sleep(10 * time.Millisecond)
	}
}
