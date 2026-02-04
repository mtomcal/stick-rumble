package game

import (
	"context"
	"sync"
	"testing"
	"time"
)

func TestGameServerMultiplePlayers(t *testing.T) {
	var lastBroadcast []PlayerStateSnapshot
	var mu sync.Mutex

	broadcastFunc := func(states []PlayerStateSnapshot) {
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

	broadcastFunc := func(states []PlayerStateSnapshot) {
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
