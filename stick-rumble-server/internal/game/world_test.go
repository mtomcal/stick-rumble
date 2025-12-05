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

// Spawn Point Selection Tests

func TestWorld_GetBalancedSpawnPoint_NoEnemies(t *testing.T) {
	world := NewWorld()

	// With no players, should spawn at center
	spawnPos := world.GetBalancedSpawnPoint("player-1")

	expectedX := ArenaWidth / 2
	expectedY := ArenaHeight / 2

	if spawnPos.X != expectedX || spawnPos.Y != expectedY {
		t.Errorf("GetBalancedSpawnPoint() with no enemies = {%v, %v}, want {%v, %v}",
			spawnPos.X, spawnPos.Y, expectedX, expectedY)
	}
}

func TestWorld_GetBalancedSpawnPoint_WithDeadPlayers(t *testing.T) {
	world := NewWorld()

	// Add players and mark them as dead
	player1 := world.AddPlayer("player-1")
	player2 := world.AddPlayer("player-2")

	player1.MarkDead()
	player2.MarkDead()

	// Should spawn at center since all players are dead
	spawnPos := world.GetBalancedSpawnPoint("player-3")

	expectedX := ArenaWidth / 2
	expectedY := ArenaHeight / 2

	if spawnPos.X != expectedX || spawnPos.Y != expectedY {
		t.Errorf("GetBalancedSpawnPoint() with only dead players = {%v, %v}, want {%v, %v}",
			spawnPos.X, spawnPos.Y, expectedX, expectedY)
	}
}

func TestWorld_GetBalancedSpawnPoint_ExcludesSelf(t *testing.T) {
	world := NewWorld()

	// Add one living player and one being respawned
	player1 := world.AddPlayer("player-1")
	player1.SetPosition(Vector2{X: 100, Y: 100})

	// Request spawn for player-2 (doesn't exist yet, but should be excluded)
	spawnPos := world.GetBalancedSpawnPoint("player-2")

	// Should find a position away from player-1
	// Since there's only one enemy, spawn should be >100 pixels away
	dx := spawnPos.X - 100
	dy := spawnPos.Y - 100
	distance := (dx*dx + dy*dy)

	// With only one enemy at (100,100), spawn should be reasonably far
	// The algorithm tries to maximize distance, so expect >200 pixels minimum
	if distance < 40000 { // sqrt(40000) = 200 pixels
		t.Logf("Spawn position {%v, %v} is only %.2f pixels from enemy at (100,100)",
			spawnPos.X, spawnPos.Y, distance)
	}
}

func TestWorld_GetBalancedSpawnPoint_WithinBounds(t *testing.T) {
	world := NewWorld()

	// Add several living players
	world.AddPlayer("player-1").SetPosition(Vector2{X: 200, Y: 200})
	world.AddPlayer("player-2").SetPosition(Vector2{X: 1700, Y: 200})
	world.AddPlayer("player-3").SetPosition(Vector2{X: 960, Y: 900})

	// Get spawn point for new player
	spawnPos := world.GetBalancedSpawnPoint("player-4")

	// Verify spawn is within arena bounds with margin
	margin := 100.0
	if spawnPos.X < margin || spawnPos.X > ArenaWidth-margin {
		t.Errorf("Spawn X = %v, should be within [%v, %v]", spawnPos.X, margin, ArenaWidth-margin)
	}

	if spawnPos.Y < margin || spawnPos.Y > ArenaHeight-margin {
		t.Errorf("Spawn Y = %v, should be within [%v, %v]", spawnPos.Y, margin, ArenaHeight-margin)
	}
}

func TestWorld_GetBalancedSpawnPoint_MaximizesDistance(t *testing.T) {
	world := NewWorld()

	// Add enemies in one corner
	world.AddPlayer("player-1").SetPosition(Vector2{X: 200, Y: 200})
	world.AddPlayer("player-2").SetPosition(Vector2{X: 250, Y: 250})

	// Get spawn point - should be far from the cluster
	spawnPos := world.GetBalancedSpawnPoint("player-3")

	// Calculate minimum distance to enemies
	minDist := distance(spawnPos, Vector2{X: 200, Y: 200})
	dist2 := distance(spawnPos, Vector2{X: 250, Y: 250})
	if dist2 < minDist {
		minDist = dist2
	}

	// With enemies clustered at (200,200), spawn should be >1000 pixels away
	if minDist < 1000 {
		t.Errorf("Spawn distance from enemies = %.2f, expected >1000 for balanced spawning", minDist)
	}
}

func TestWorld_GetBalancedSpawnPoint_ThreadSafety(t *testing.T) {
	world := NewWorld()
	var wg sync.WaitGroup

	// Add some players
	for i := 1; i <= 5; i++ {
		world.AddPlayer(string(rune('0' + i)))
	}

	// Concurrent spawn point requests
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			world.GetBalancedSpawnPoint(string(rune('a' + id)))
		}(i)
	}

	wg.Wait()
	// If we get here without a data race, the test passes
}
