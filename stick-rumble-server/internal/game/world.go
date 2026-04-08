package game

import (
	"math"
	"math/rand"
	"sync"
)

// World manages the game state and all players
type World struct {
	mapConfig MapConfig
	players   map[string]*PlayerState
	clock     Clock
	rng       *rand.Rand // Random number generator for deterministic spawn tie-breaking (protected by rngMu)
	mu        sync.RWMutex
	rngMu     sync.Mutex // Protects rng access (rand.Rand is not thread-safe)
}

// NewWorld creates a new game world with a real clock
func NewWorld(mapConfigs ...MapConfig) *World {
	return NewWorldWithClock(&RealClock{}, mapConfigs...)
}

// NewWorldWithClock creates a new game world with a custom clock (for testing)
func NewWorldWithClock(clock Clock, mapConfigs ...MapConfig) *World {
	mapConfig := resolveMapConfig(mapConfigs...)

	return &World{
		mapConfig: mapConfig,
		players:   make(map[string]*PlayerState),
		clock:     clock,
		rng:       rand.New(rand.NewSource(rand.Int63())), // Use a random seed by default
	}
}

// AddPlayer adds a new player to the world with balanced spawn positioning
func (w *World) AddPlayer(playerID string) *PlayerState {
	w.mu.Lock()
	defer w.mu.Unlock()

	player := NewPlayerStateWithClock(playerID, w.clock)

	// Get a balanced spawn point away from other players
	// Note: We can't call GetBalancedSpawnPoint here (would deadlock due to mutex)
	// Instead, inline the spawn logic
	spawnPos := w.getBalancedSpawnPointLocked(playerID)
	player.Position = spawnPos

	w.players[playerID] = player
	return player
}

// getBalancedSpawnPointLocked finds a spawn point furthest from all living enemy players
// MUST be called with w.mu already held (locked)
func (w *World) getBalancedSpawnPointLocked(excludePlayerID string) Vector2 {
	// Collect positions of all living enemy players
	enemyPositions := make([]Vector2, 0)
	for id, player := range w.players {
		if id != excludePlayerID && !player.IsDead() {
			enemyPositions = append(enemyPositions, player.GetPosition())
		}
	}

	return w.selectBestSpawnPoint(enemyPositions)
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
func (w *World) GetAllPlayers() []PlayerStateSnapshot {
	w.mu.RLock()
	defer w.mu.RUnlock()

	snapshots := make([]PlayerStateSnapshot, 0, len(w.players))
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

// SetRandSource sets a custom random source for spawn point generation (for testing)
func (w *World) SetRandSource(source rand.Source) {
	w.rngMu.Lock()
	defer w.rngMu.Unlock()
	w.rng = rand.New(source)
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

	return w.selectBestSpawnPoint(enemyPositions)
}

func (w *World) GetMapConfig() MapConfig {
	return w.mapConfig
}

func (w *World) selectBestSpawnPoint(enemyPositions []Vector2) Vector2 {
	candidates := w.validSpawnCandidates()
	if len(candidates) == 0 {
		return Vector2{X: w.mapConfig.Width / 2, Y: w.mapConfig.Height / 2}
	}

	if len(enemyPositions) == 0 {
		return candidates[0]
	}

	bestSpawn := candidates[0]
	bestScore := -1.0

	for _, candidate := range candidates {
		score := math.MaxFloat64
		for _, enemyPos := range enemyPositions {
			dist := distance(candidate, enemyPos)
			if dist < score {
				score = dist
			}
		}

		if score > bestScore {
			bestScore = score
			bestSpawn = candidate
		}
	}

	return bestSpawn
}

func (w *World) validSpawnCandidates() []Vector2 {
	blockingObstacles := movementBlockingObstacles(w.mapConfig)
	candidates := make([]Vector2, 0, len(w.mapConfig.SpawnPoints))

	for _, spawnPoint := range w.mapConfig.SpawnPoints {
		if !pointWithinBounds(spawnPoint.X, spawnPoint.Y, w.mapConfig) {
			continue
		}

		blocked := false
		for _, obstacle := range blockingObstacles {
			if pointInsideRect(spawnPoint.X, spawnPoint.Y, rectFromObstacle(obstacle)) {
				blocked = true
				break
			}
		}
		if blocked {
			continue
		}

		candidates = append(candidates, Vector2{X: spawnPoint.X, Y: spawnPoint.Y})
	}

	return candidates
}

func resolveMapConfig(mapConfigs ...MapConfig) MapConfig {
	if len(mapConfigs) > 0 {
		return mapConfigs[0]
	}

	return MustDefaultMapConfig()
}

// distance calculates the Euclidean distance between two points
func distance(a, b Vector2) float64 {
	dx := a.X - b.X
	dy := a.Y - b.Y
	return math.Sqrt(dx*dx + dy*dy)
}
