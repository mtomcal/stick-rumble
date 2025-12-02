package game

import (
	"sync"
	"testing"
)

func TestNewWorld(t *testing.T) {
	world := NewWorld()

	if world == nil {
		t.Fatal("NewWorld() returned nil")
	}

	if world.PlayerCount() != 0 {
		t.Errorf("NewWorld() PlayerCount = %d, want 0", world.PlayerCount())
	}
}

func TestWorldAddPlayer(t *testing.T) {
	world := NewWorld()
	playerID := "player-1"

	player := world.AddPlayer(playerID)

	if player == nil {
		t.Fatal("AddPlayer() returned nil")
	}

	if player.ID != playerID {
		t.Errorf("AddPlayer() created player with ID = %v, want %v", player.ID, playerID)
	}

	if world.PlayerCount() != 1 {
		t.Errorf("After AddPlayer(), PlayerCount = %d, want 1", world.PlayerCount())
	}
}

func TestWorldGetPlayer(t *testing.T) {
	world := NewWorld()
	playerID := "player-1"

	world.AddPlayer(playerID)

	player, exists := world.GetPlayer(playerID)

	if !exists {
		t.Error("GetPlayer() returned exists = false, want true")
	}

	if player.ID != playerID {
		t.Errorf("GetPlayer() ID = %v, want %v", player.ID, playerID)
	}

	// Test non-existent player
	_, exists = world.GetPlayer("non-existent")
	if exists {
		t.Error("GetPlayer() for non-existent player returned exists = true, want false")
	}
}

func TestWorldRemovePlayer(t *testing.T) {
	world := NewWorld()
	playerID := "player-1"

	world.AddPlayer(playerID)
	world.RemovePlayer(playerID)

	if world.PlayerCount() != 0 {
		t.Errorf("After RemovePlayer(), PlayerCount = %d, want 0", world.PlayerCount())
	}

	_, exists := world.GetPlayer(playerID)
	if exists {
		t.Error("After RemovePlayer(), GetPlayer() still found player")
	}
}

func TestWorldGetAllPlayers(t *testing.T) {
	world := NewWorld()

	// Add multiple players
	world.AddPlayer("player-1")
	world.AddPlayer("player-2")
	world.AddPlayer("player-3")

	players := world.GetAllPlayers()

	if len(players) != 3 {
		t.Errorf("GetAllPlayers() returned %d players, want 3", len(players))
	}

	// Verify all player IDs are present
	foundIDs := make(map[string]bool)
	for i := range players {
		foundIDs[players[i].ID] = true
	}

	expectedIDs := []string{"player-1", "player-2", "player-3"}
	for _, id := range expectedIDs {
		if !foundIDs[id] {
			t.Errorf("GetAllPlayers() missing player ID %v", id)
		}
	}
}

func TestWorldUpdatePlayerInput(t *testing.T) {
	world := NewWorld()
	playerID := "player-1"

	world.AddPlayer(playerID)

	input := InputState{
		Up:    true,
		Left:  true,
		Down:  false,
		Right: false,
	}

	success := world.UpdatePlayerInput(playerID, input)
	if !success {
		t.Error("UpdatePlayerInput() returned false, want true")
	}

	player, _ := world.GetPlayer(playerID)
	retrievedInput := player.GetInput()

	if retrievedInput != input {
		t.Errorf("UpdatePlayerInput() input = %+v, want %+v", retrievedInput, input)
	}

	// Test updating non-existent player
	success = world.UpdatePlayerInput("non-existent", input)
	if success {
		t.Error("UpdatePlayerInput() for non-existent player returned true, want false")
	}
}

func TestWorldThreadSafety(t *testing.T) {
	world := NewWorld()
	var wg sync.WaitGroup

	// Concurrent add/remove/get operations
	for i := 0; i < 50; i++ {
		wg.Add(4)

		playerID := "player"

		go func() {
			defer wg.Done()
			world.AddPlayer(playerID)
		}()

		go func() {
			defer wg.Done()
			world.GetPlayer(playerID)
		}()

		go func() {
			defer wg.Done()
			world.GetAllPlayers()
		}()

		go func() {
			defer wg.Done()
			world.RemovePlayer(playerID)
		}()
	}

	wg.Wait()
	// If we get here without a data race, the test passes
}
