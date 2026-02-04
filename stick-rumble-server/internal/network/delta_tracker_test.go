package network

import (
	"testing"

	"github.com/mtomcal/stick-rumble-server/internal/game"
)

// TestDeltaTracker_InitialState tests that a new tracker starts empty
func TestDeltaTracker_InitialState(t *testing.T) {
	tracker := NewDeltaTracker()

	if tracker == nil {
		t.Fatal("NewDeltaTracker() returned nil")
	}

	// Should have no last sent states
	if len(tracker.lastSentStates) != 0 {
		t.Errorf("Expected empty tracker, got %d entries", len(tracker.lastSentStates))
	}
}

// TestDeltaTracker_ShouldSendSnapshot tests snapshot timing logic
func TestDeltaTracker_ShouldSendSnapshot(t *testing.T) {
	tracker := NewDeltaTracker()
	playerID := "player1"

	// First call should always return true (initial snapshot)
	if !tracker.ShouldSendSnapshot(playerID) {
		t.Error("First call should return true for initial snapshot")
	}

	// Update last snapshot time
	tracker.UpdateLastSnapshot(playerID)

	// Immediately after, should return false
	if tracker.ShouldSendSnapshot(playerID) {
		t.Error("Should return false immediately after snapshot")
	}
}

// TestDeltaTracker_ComputePlayerDelta tests delta calculation for players
func TestDeltaTracker_ComputePlayerDelta(t *testing.T) {
	tracker := NewDeltaTracker()
	playerID := "player1"

	currentState := []game.PlayerStateSnapshot{
		{
			ID:       "player1",
			Position: game.Vector2{X: 100, Y: 200},
			Velocity: game.Vector2{X: 10, Y: 20},
			Health:   80,
			AimAngle: 0,
		},
		{
			ID:       "player2",
			Position: game.Vector2{X: 300, Y: 400},
			Velocity: game.Vector2{X: 5, Y: 15},
			Health:   90,
			AimAngle: 0,
		},
	}

	// First delta should include all players (no previous state)
	delta := tracker.ComputePlayerDelta(playerID, currentState)
	if len(delta) != 2 {
		t.Errorf("Expected 2 players in initial delta, got %d", len(delta))
	}

	// Update tracker with current state
	tracker.UpdatePlayerState(playerID, currentState)

	// Second delta with no changes should be empty
	delta = tracker.ComputePlayerDelta(playerID, currentState)
	if len(delta) != 0 {
		t.Errorf("Expected empty delta for unchanged state, got %d players", len(delta))
	}

	// Change player1's position (make copy to avoid modifying slice element directly)
	newState := make([]game.PlayerStateSnapshot, len(currentState))
	copy(newState, currentState)
	newState[0].Position.X = 150
	delta = tracker.ComputePlayerDelta(playerID, newState)
	if len(delta) != 1 {
		t.Errorf("Expected 1 player in delta, got %d", len(delta))
	}
	if delta[0].ID != "player1" {
		t.Errorf("Expected player1 in delta, got %s", delta[0].ID)
	}
}

// TestDeltaTracker_MultipleClients tests isolated state tracking per client
func TestDeltaTracker_MultipleClients(t *testing.T) {
	tracker := NewDeltaTracker()

	states := []game.PlayerStateSnapshot{
		{ID: "player1", Position: game.Vector2{X: 100, Y: 100}, Health: 100, Velocity: game.Vector2{X: 0, Y: 0}},
	}

	// Update state for client1
	tracker.UpdatePlayerState("client1", states)

	// client2 should still get full state (no previous state for client2)
	delta := tracker.ComputePlayerDelta("client2", states)
	if len(delta) != 1 {
		t.Errorf("Expected full state for new client, got %d players", len(delta))
	}

	// client1 should get empty delta (no changes)
	delta = tracker.ComputePlayerDelta("client1", states)
	if len(delta) != 0 {
		t.Errorf("Expected empty delta for client1, got %d players", len(delta))
	}
}

// TestDeltaTracker_PositionThreshold tests position change detection
func TestDeltaTracker_PositionThreshold(t *testing.T) {
	tracker := NewDeltaTracker()
	playerID := "player1"

	initialState := []game.PlayerStateSnapshot{
		{ID: "player1", Position: game.Vector2{X: 100, Y: 100}, Health: 100, Velocity: game.Vector2{X: 0, Y: 0}},
	}
	tracker.UpdatePlayerState(playerID, initialState)

	// Small change (below threshold) should not trigger delta
	smallChange := []game.PlayerStateSnapshot{
		{ID: "player1", Position: game.Vector2{X: 100.05, Y: 100.05}, Health: 100, Velocity: game.Vector2{X: 0, Y: 0}},
	}
	delta := tracker.ComputePlayerDelta(playerID, smallChange)
	if len(delta) != 0 {
		t.Errorf("Expected no delta for small position change, got %d players", len(delta))
	}

	// Large change (above threshold) should trigger delta
	largeChange := []game.PlayerStateSnapshot{
		{ID: "player1", Position: game.Vector2{X: 110, Y: 110}, Health: 100, Velocity: game.Vector2{X: 0, Y: 0}},
	}
	delta = tracker.ComputePlayerDelta(playerID, largeChange)
	if len(delta) != 1 {
		t.Errorf("Expected delta for large position change, got %d players", len(delta))
	}
}

// TestDeltaTracker_HealthChange tests health change detection
func TestDeltaTracker_HealthChange(t *testing.T) {
	tracker := NewDeltaTracker()
	playerID := "player1"

	initialState := []game.PlayerStateSnapshot{
		{ID: "player1", Position: game.Vector2{X: 100, Y: 100}, Health: 100, Velocity: game.Vector2{X: 0, Y: 0}},
	}
	tracker.UpdatePlayerState(playerID, initialState)

	// Health change should trigger delta
	changedHealth := []game.PlayerStateSnapshot{
		{ID: "player1", Position: game.Vector2{X: 100, Y: 100}, Health: 80, Velocity: game.Vector2{X: 0, Y: 0}},
	}
	delta := tracker.ComputePlayerDelta(playerID, changedHealth)
	if len(delta) != 1 {
		t.Errorf("Expected delta for health change, got %d players", len(delta))
	}
	if delta[0].Health != 80 {
		t.Errorf("Expected health 80, got %d", delta[0].Health)
	}
}

// TestDeltaTracker_ProjectileDelta tests projectile delta calculation
func TestDeltaTracker_ProjectileDelta(t *testing.T) {
	tracker := NewDeltaTracker()
	playerID := "player1"

	currentProjectiles := []game.ProjectileSnapshot{
		{
			ID:       "proj1",
			OwnerID:  "player1",
			Position: game.Vector2{X: 100, Y: 200},
			Velocity: game.Vector2{X: 50, Y: 0},
		},
	}

	// First delta should include all projectiles
	added, removed := tracker.ComputeProjectileDelta(playerID, currentProjectiles)
	if len(added) != 1 {
		t.Errorf("Expected 1 projectile in initial delta, got %d", len(added))
	}
	if len(removed) != 0 {
		t.Errorf("Expected 0 removed projectiles, got %d", len(removed))
	}

	// Update tracker
	tracker.UpdateProjectileState(playerID, currentProjectiles)

	// No changes should yield empty delta
	added, removed = tracker.ComputeProjectileDelta(playerID, currentProjectiles)
	if len(added) != 0 {
		t.Errorf("Expected no added projectiles, got %d", len(added))
	}
	if len(removed) != 0 {
		t.Errorf("Expected no removed projectiles, got %d", len(removed))
	}

	// Remove projectile
	emptyProjectiles := []game.ProjectileSnapshot{}
	added, removed = tracker.ComputeProjectileDelta(playerID, emptyProjectiles)
	if len(added) != 0 {
		t.Errorf("Expected no added projectiles, got %d", len(added))
	}
	if len(removed) != 1 {
		t.Errorf("Expected 1 removed projectile, got %d", len(removed))
	}
	if removed[0] != "proj1" {
		t.Errorf("Expected proj1 to be removed, got %s", removed[0])
	}
}

// TestDeltaTracker_ThreadSafety tests concurrent access
func TestDeltaTracker_ThreadSafety(t *testing.T) {
	tracker := NewDeltaTracker()

	states := []game.PlayerStateSnapshot{
		{ID: "player1", Position: game.Vector2{X: 100, Y: 100}, Health: 100, Velocity: game.Vector2{X: 0, Y: 0}},
	}

	// Concurrent updates should not panic
	done := make(chan bool)
	for i := 0; i < 10; i++ {
		go func(id int) {
			playerID := "player1"
			tracker.UpdatePlayerState(playerID, states)
			tracker.ComputePlayerDelta(playerID, states)
			tracker.ShouldSendSnapshot(playerID)
			done <- true
		}(i)
	}

	// Wait for all goroutines
	for i := 0; i < 10; i++ {
		<-done
	}
}

// TestDeltaTracker_VelocityChange tests velocity change detection
func TestDeltaTracker_VelocityChange(t *testing.T) {
	tracker := NewDeltaTracker()
	playerID := "player1"

	initialState := []game.PlayerStateSnapshot{
		{ID: "player1", Position: game.Vector2{X: 100, Y: 100}, Health: 100, Velocity: game.Vector2{X: 10, Y: 20}},
	}
	tracker.UpdatePlayerState(playerID, initialState)

	// Small velocity change (below threshold) should not trigger delta
	smallChange := []game.PlayerStateSnapshot{
		{ID: "player1", Position: game.Vector2{X: 100, Y: 100}, Health: 100, Velocity: game.Vector2{X: 10.05, Y: 20.05}},
	}
	delta := tracker.ComputePlayerDelta(playerID, smallChange)
	if len(delta) != 0 {
		t.Errorf("Expected no delta for small velocity change, got %d players", len(delta))
	}

	// Large velocity change (above threshold) should trigger delta
	largeChange := []game.PlayerStateSnapshot{
		{ID: "player1", Position: game.Vector2{X: 100, Y: 100}, Health: 100, Velocity: game.Vector2{X: 15, Y: 25}},
	}
	delta = tracker.ComputePlayerDelta(playerID, largeChange)
	if len(delta) != 1 {
		t.Errorf("Expected delta for large velocity change, got %d players", len(delta))
	}
	if delta[0].Velocity.X != 15 || delta[0].Velocity.Y != 25 {
		t.Errorf("Expected velocity (15, 25), got (%f, %f)", delta[0].Velocity.X, delta[0].Velocity.Y)
	}
}

// TestDeltaTracker_AimAngleChange tests aim angle change detection
func TestDeltaTracker_AimAngleChange(t *testing.T) {
	tracker := NewDeltaTracker()
	playerID := "player1"

	initialState := []game.PlayerStateSnapshot{
		{ID: "player1", Position: game.Vector2{X: 100, Y: 100}, Health: 100, Velocity: game.Vector2{X: 0, Y: 0}, AimAngle: 0.0},
	}
	tracker.UpdatePlayerState(playerID, initialState)

	// Small aim angle change (below threshold) should not trigger delta
	smallChange := []game.PlayerStateSnapshot{
		{ID: "player1", Position: game.Vector2{X: 100, Y: 100}, Health: 100, Velocity: game.Vector2{X: 0, Y: 0}, AimAngle: 0.005},
	}
	delta := tracker.ComputePlayerDelta(playerID, smallChange)
	if len(delta) != 0 {
		t.Errorf("Expected no delta for small aim angle change, got %d players", len(delta))
	}

	// Large aim angle change (above threshold) should trigger delta
	largeChange := []game.PlayerStateSnapshot{
		{ID: "player1", Position: game.Vector2{X: 100, Y: 100}, Health: 100, Velocity: game.Vector2{X: 0, Y: 0}, AimAngle: 1.5},
	}
	delta = tracker.ComputePlayerDelta(playerID, largeChange)
	if len(delta) != 1 {
		t.Errorf("Expected delta for large aim angle change, got %d players", len(delta))
	}
	if delta[0].AimAngle != 1.5 {
		t.Errorf("Expected aim angle 1.5, got %f", delta[0].AimAngle)
	}
}

// TestDeltaTracker_BooleanFlags tests boolean flag change detection
func TestDeltaTracker_BooleanFlags(t *testing.T) {
	tracker := NewDeltaTracker()
	playerID := "player1"

	initialState := []game.PlayerStateSnapshot{
		{ID: "player1", Position: game.Vector2{X: 100, Y: 100}, Health: 100, Velocity: game.Vector2{X: 0, Y: 0}, Rolling: false, IsInvulnerable: false, IsRegeneratingHealth: false},
	}
	tracker.UpdatePlayerState(playerID, initialState)

	// Change Rolling flag
	rollingChange := []game.PlayerStateSnapshot{
		{ID: "player1", Position: game.Vector2{X: 100, Y: 100}, Health: 100, Velocity: game.Vector2{X: 0, Y: 0}, Rolling: true, IsInvulnerable: false, IsRegeneratingHealth: false},
	}
	delta := tracker.ComputePlayerDelta(playerID, rollingChange)
	if len(delta) != 1 {
		t.Errorf("Expected delta for Rolling change, got %d players", len(delta))
	}
	if !delta[0].Rolling {
		t.Error("Expected Rolling to be true")
	}

	// Update state and change IsInvulnerable
	tracker.UpdatePlayerState(playerID, rollingChange)
	invulnerableChange := []game.PlayerStateSnapshot{
		{ID: "player1", Position: game.Vector2{X: 100, Y: 100}, Health: 100, Velocity: game.Vector2{X: 0, Y: 0}, Rolling: true, IsInvulnerable: true, IsRegeneratingHealth: false},
	}
	delta = tracker.ComputePlayerDelta(playerID, invulnerableChange)
	if len(delta) != 1 {
		t.Errorf("Expected delta for IsInvulnerable change, got %d players", len(delta))
	}
	if !delta[0].IsInvulnerable {
		t.Error("Expected IsInvulnerable to be true")
	}

	// Update state and change IsRegeneratingHealth
	tracker.UpdatePlayerState(playerID, invulnerableChange)
	regenChange := []game.PlayerStateSnapshot{
		{ID: "player1", Position: game.Vector2{X: 100, Y: 100}, Health: 100, Velocity: game.Vector2{X: 0, Y: 0}, Rolling: true, IsInvulnerable: true, IsRegeneratingHealth: true},
	}
	delta = tracker.ComputePlayerDelta(playerID, regenChange)
	if len(delta) != 1 {
		t.Errorf("Expected delta for IsRegeneratingHealth change, got %d players", len(delta))
	}
	if !delta[0].IsRegeneratingHealth {
		t.Error("Expected IsRegeneratingHealth to be true")
	}
}

// TestDeltaTracker_StatsChange tests stats change detection (Kills, Deaths, XP)
func TestDeltaTracker_StatsChange(t *testing.T) {
	tracker := NewDeltaTracker()
	playerID := "player1"

	initialState := []game.PlayerStateSnapshot{
		{ID: "player1", Position: game.Vector2{X: 100, Y: 100}, Health: 100, Velocity: game.Vector2{X: 0, Y: 0}, Kills: 0, Deaths: 0, XP: 0},
	}
	tracker.UpdatePlayerState(playerID, initialState)

	// Change Kills
	killsChange := []game.PlayerStateSnapshot{
		{ID: "player1", Position: game.Vector2{X: 100, Y: 100}, Health: 100, Velocity: game.Vector2{X: 0, Y: 0}, Kills: 1, Deaths: 0, XP: 0},
	}
	delta := tracker.ComputePlayerDelta(playerID, killsChange)
	if len(delta) != 1 {
		t.Errorf("Expected delta for Kills change, got %d players", len(delta))
	}
	if delta[0].Kills != 1 {
		t.Errorf("Expected Kills 1, got %d", delta[0].Kills)
	}

	// Update state and change Deaths
	tracker.UpdatePlayerState(playerID, killsChange)
	deathsChange := []game.PlayerStateSnapshot{
		{ID: "player1", Position: game.Vector2{X: 100, Y: 100}, Health: 100, Velocity: game.Vector2{X: 0, Y: 0}, Kills: 1, Deaths: 1, XP: 0},
	}
	delta = tracker.ComputePlayerDelta(playerID, deathsChange)
	if len(delta) != 1 {
		t.Errorf("Expected delta for Deaths change, got %d players", len(delta))
	}
	if delta[0].Deaths != 1 {
		t.Errorf("Expected Deaths 1, got %d", delta[0].Deaths)
	}

	// Update state and change XP
	tracker.UpdatePlayerState(playerID, deathsChange)
	xpChange := []game.PlayerStateSnapshot{
		{ID: "player1", Position: game.Vector2{X: 100, Y: 100}, Health: 100, Velocity: game.Vector2{X: 0, Y: 0}, Kills: 1, Deaths: 1, XP: 100},
	}
	delta = tracker.ComputePlayerDelta(playerID, xpChange)
	if len(delta) != 1 {
		t.Errorf("Expected delta for XP change, got %d players", len(delta))
	}
	if delta[0].XP != 100 {
		t.Errorf("Expected XP 100, got %d", delta[0].XP)
	}
}
