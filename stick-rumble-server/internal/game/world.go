package game

import (
	"sync"
)

// World manages the game state and all players
type World struct {
	players map[string]*PlayerState
	mu      sync.RWMutex
}

// NewWorld creates a new game world
func NewWorld() *World {
	return &World{
		players: make(map[string]*PlayerState),
	}
}

// AddPlayer adds a new player to the world
func (w *World) AddPlayer(playerID string) *PlayerState {
	w.mu.Lock()
	defer w.mu.Unlock()

	player := NewPlayerState(playerID)
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
	return true
}
