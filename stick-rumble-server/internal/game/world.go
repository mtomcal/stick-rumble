package game

import (
	"math"
	"math/rand"
	"sync"
)

// World manages the game state and all players
type World struct {
	players map[string]*PlayerState
	clock   Clock
	mu      sync.RWMutex
}

// NewWorld creates a new game world with a real clock
func NewWorld() *World {
	return NewWorldWithClock(&RealClock{})
}

// NewWorldWithClock creates a new game world with a custom clock (for testing)
func NewWorldWithClock(clock Clock) *World {
	return &World{
		players: make(map[string]*PlayerState),
		clock:   clock,
	}
}

// AddPlayer adds a new player to the world
func (w *World) AddPlayer(playerID string) *PlayerState {
	w.mu.Lock()
	defer w.mu.Unlock()

	player := NewPlayerStateWithClock(playerID, w.clock)
	w.players[playerID] = player
	return player
}

// RemovePlayer removes a player from the world
func (w *World) RemovePlayer(playerID string) {
	w.mu.Lock()
	defer w.mu.Unlock()
	delete(w.players, playerID)
}

// GetPlayer retrieves a player by ID
func (w *World) GetPlayer(playerID string) (*PlayerState, bool) {
	w.mu.RLock()
	defer w.mu.RUnlock()
	player, exists := w.players[playerID]
	return player, exists
}

// GetAllPlayers returns snapshots of all players (thread-safe)
func (w *World) GetAllPlayers() []PlayerState {
	w.mu.RLock()
	defer w.mu.RUnlock()

	snapshots := make([]PlayerState, 0, len(w.players))
	for _, player := range w.players {
		snapshots = append(snapshots, player.Snapshot())
	}
	return snapshots
}

// PlayerCount returns the number of players in the world
func (w *World) PlayerCount() int {
	w.mu.RLock()
	defer w.mu.RUnlock()
	return len(w.players)
}

// UpdatePlayerInput updates a player's input state
func (w *World) UpdatePlayerInput(playerID string, input InputState) bool {
	player, exists := w.GetPlayer(playerID)
	if !exists {
		return false
	}
	player.SetInput(input)
	// Also update the player's aim angle for broadcasting
	player.SetAimAngle(input.AimAngle)
	return true
}

// GetBalancedSpawnPoint finds a spawn point furthest from all living enemy players
// Returns the center position if no enemies are present
func (w *World) GetBalancedSpawnPoint(excludePlayerID string) Vector2 {
	w.mu.RLock()
	defer w.mu.RUnlock()

	// Collect positions of all living enemy players
	enemyPositions := make([]Vector2, 0)
	for id, player := range w.players {
		if id != excludePlayerID && !player.IsDead() {
			enemyPositions = append(enemyPositions, player.GetPosition())
		}
	}

	// If no enemies, spawn at center
	if len(enemyPositions) == 0 {
		return Vector2{X: ArenaWidth / 2, Y: ArenaHeight / 2}
	}

	// Try 10 random spawn candidates and pick the one furthest from enemies
	bestSpawn := Vector2{X: ArenaWidth / 2, Y: ArenaHeight / 2}
	bestMinDistance := 0.0

	for i := 0; i < 10; i++ {
		// Generate random spawn point with margin from edges
		margin := 100.0
		candidate := Vector2{
			X: margin + rand.Float64()*(ArenaWidth-2*margin),
			Y: margin + rand.Float64()*(ArenaHeight-2*margin),
		}

		// Find minimum distance to any enemy
		minDistance := math.MaxFloat64
		for _, enemyPos := range enemyPositions {
			dist := distance(candidate, enemyPos)
			if dist < minDistance {
				minDistance = dist
			}
		}

		// Keep the spawn point with the largest minimum distance
		if minDistance > bestMinDistance {
			bestMinDistance = minDistance
			bestSpawn = candidate
		}
	}

	return bestSpawn
}

// distance calculates the Euclidean distance between two points
func distance(a, b Vector2) float64 {
	dx := a.X - b.X
	dy := a.Y - b.Y
	return math.Sqrt(dx*dx + dy*dy)
}
