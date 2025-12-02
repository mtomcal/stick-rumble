package game

import (
	"context"
	"sync"
	"testing"
	"time"
)

func TestNewGameServer(t *testing.T) {
	gs := NewGameServer(nil)

	if gs == nil {
		t.Fatal("NewGameServer() returned nil")
	}

	if gs.world == nil {
		t.Error("GameServer.world is nil")
	}

	if gs.physics == nil {
		t.Error("GameServer.physics is nil")
	}

	if gs.running {
		t.Error("GameServer should not be running initially")
	}
}

func TestGameServerStartStop(t *testing.T) {
	gs := NewGameServer(nil)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Start the server
	gs.Start(ctx)

	if !gs.IsRunning() {
		t.Error("GameServer should be running after Start()")
	}

	// Give it a moment to actually start
	time.Sleep(50 * time.Millisecond)

	// Stop the server
	cancel()
	gs.Stop()

	if gs.IsRunning() {
		t.Error("GameServer should not be running after Stop()")
	}
}

func TestGameServerAddRemovePlayer(t *testing.T) {
	gs := NewGameServer(nil)
	playerID := "test-player-1"

	// Add player
	player := gs.AddPlayer(playerID)

	if player == nil {
		t.Fatal("AddPlayer() returned nil")
	}

	if player.ID != playerID {
		t.Errorf("AddPlayer() ID = %v, want %v", player.ID, playerID)
	}

	// Verify player exists
	_, exists := gs.GetPlayerState(playerID)
	if !exists {
		t.Error("GetPlayerState() should find added player")
	}

	// Remove player
	gs.RemovePlayer(playerID)

	// Verify player removed
	_, exists = gs.GetPlayerState(playerID)
	if exists {
		t.Error("GetPlayerState() should not find removed player")
	}
}

func TestGameServerUpdatePlayerInput(t *testing.T) {
	gs := NewGameServer(nil)
	playerID := "test-player-1"

	gs.AddPlayer(playerID)

	input := InputState{Up: true, Right: true}

	// Update input
	success := gs.UpdatePlayerInput(playerID, input)
	if !success {
		t.Error("UpdatePlayerInput() should return true for existing player")
	}

	// Verify input was set
	player, _ := gs.world.GetPlayer(playerID)
	retrievedInput := player.GetInput()

	if retrievedInput != input {
		t.Errorf("Player input = %+v, want %+v", retrievedInput, input)
	}

	// Try updating non-existent player
	success = gs.UpdatePlayerInput("non-existent", input)
	if success {
		t.Error("UpdatePlayerInput() should return false for non-existent player")
	}
}

func TestGameServerTickLoop(t *testing.T) {
	var broadcastCount int
	var mu sync.Mutex

	broadcastFunc := func(states []PlayerState) {
		mu.Lock()
		broadcastCount++
		mu.Unlock()
	}

	gs := NewGameServer(broadcastFunc)
	playerID := "test-player-1"

	// Add player and give input
	gs.AddPlayer(playerID)
	gs.UpdatePlayerInput(playerID, InputState{Right: true})

	// Get initial position
	initialState, _ := gs.GetPlayerState(playerID)
	initialPos := initialState.Position

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Start server
	gs.Start(ctx)

	// Let it run for a few ticks (~100ms should be 6 ticks at 60Hz)
	time.Sleep(100 * time.Millisecond)

	// Stop server
	cancel()
	gs.Stop()

	// Check that player moved
	finalState, _ := gs.GetPlayerState(playerID)
	finalPos := finalState.Position

	if finalPos.X <= initialPos.X {
		t.Errorf("Player should have moved right: initial=%v, final=%v", initialPos.X, finalPos.X)
	}

	// Check that broadcast was called
	mu.Lock()
	count := broadcastCount
	mu.Unlock()

	if count == 0 {
		t.Error("Broadcast function should have been called")
	}
}

func TestGameServerBroadcastRate(t *testing.T) {
	var broadcasts []time.Time
	var mu sync.Mutex

	broadcastFunc := func(states []PlayerState) {
		mu.Lock()
		broadcasts = append(broadcasts, time.Now())
		mu.Unlock()
	}

	gs := NewGameServer(broadcastFunc)

	// Add a player so broadcasts happen
	gs.AddPlayer("test-player")

	ctx, cancel := context.WithTimeout(context.Background(), 250*time.Millisecond)
	defer cancel()

	gs.Start(ctx)

	// Wait for context timeout
	<-ctx.Done()
	gs.Stop()

	mu.Lock()
	count := len(broadcasts)
	mu.Unlock()

	// At 20Hz, in 250ms we expect ~5 broadcasts (250 / 50 = 5)
	// Allow some tolerance (3-7 is acceptable)
	if count < 3 || count > 7 {
		t.Errorf("Expected ~5 broadcasts at 20Hz over 250ms, got %d", count)
	}
}

func TestGameServerPhysicsIntegration(t *testing.T) {
	gs := NewGameServer(nil)
	playerID := "test-player-1"

	gs.AddPlayer(playerID)

	// Set player to move right
	gs.UpdatePlayerInput(playerID, InputState{Right: true})

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	gs.Start(ctx)

	// Run for 1 second
	time.Sleep(1 * time.Second)

	cancel()
	gs.Stop()

	// Check final state
	state, _ := gs.GetPlayerState(playerID)

	// After 1 second of acceleration at 50 px/s² toward max 200 px/s,
	// velocity should have increased significantly
	// It won't reach max because acceleration is gradual
	if state.Velocity.X < 40 {
		t.Errorf("After 1 second, velocity.X should have increased significantly, got %v", state.Velocity.X)
	}

	if state.Velocity.X > MovementSpeed {
		t.Errorf("Velocity should not exceed max speed (%v), got %v", MovementSpeed, state.Velocity.X)
	}

	// Position should have moved significantly right
	centerX := ArenaWidth / 2
	if state.Position.X <= centerX {
		t.Errorf("Player should have moved right from center (%v), got %v", centerX, state.Position.X)
	}
}

func TestGameServerMultiplePlayers(t *testing.T) {
	var lastBroadcast []PlayerState
	var mu sync.Mutex

	broadcastFunc := func(states []PlayerState) {
		mu.Lock()
		lastBroadcast = states
		mu.Unlock()
	}

	gs := NewGameServer(broadcastFunc)

	// Add multiple players
	gs.AddPlayer("player-1")
	gs.AddPlayer("player-2")
	gs.AddPlayer("player-3")

	// Set different inputs
	gs.UpdatePlayerInput("player-1", InputState{Right: true})
	gs.UpdatePlayerInput("player-2", InputState{Left: true})
	gs.UpdatePlayerInput("player-3", InputState{Up: true})

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	gs.Start(ctx)

	// Run for a bit
	time.Sleep(100 * time.Millisecond)

	cancel()
	gs.Stop()

	// Check that broadcast included all players
	mu.Lock()
	broadcast := lastBroadcast
	mu.Unlock()

	if len(broadcast) != 3 {
		t.Errorf("Broadcast should include 3 players, got %d", len(broadcast))
	}

	// Verify all player IDs are present
	foundIDs := make(map[string]bool)
	for i := range broadcast {
		foundIDs[broadcast[i].ID] = true
	}

	expected := []string{"player-1", "player-2", "player-3"}
	for _, id := range expected {
		if !foundIDs[id] {
			t.Errorf("Broadcast missing player %v", id)
		}
	}
}

func TestGameServerNoBroadcastWithoutPlayers(t *testing.T) {
	var broadcastCount int
	var mu sync.Mutex

	broadcastFunc := func(states []PlayerState) {
		mu.Lock()
		broadcastCount++
		mu.Unlock()
	}

	gs := NewGameServer(broadcastFunc)

	// Don't add any players

	ctx, cancel := context.WithTimeout(context.Background(), 150*time.Millisecond)
	defer cancel()

	gs.Start(ctx)
	<-ctx.Done()
	gs.Stop()

	mu.Lock()
	count := broadcastCount
	mu.Unlock()

	// Should not broadcast when there are no players
	if count != 0 {
		t.Errorf("Should not broadcast without players, got %d broadcasts", count)
	}
}
