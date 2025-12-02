package game

import (
	"context"
	"log"
	"sync"
	"time"
)

// GameServer manages the game loop and physics simulation
type GameServer struct {
	world      *World
	physics    *Physics
	tickRate   time.Duration
	updateRate time.Duration // Rate at which to broadcast updates to clients

	// Broadcast function to send state updates to clients
	broadcastFunc func(playerStates []PlayerState)

	running bool
	mu      sync.RWMutex
	wg      sync.WaitGroup
}

// NewGameServer creates a new game server
func NewGameServer(broadcastFunc func(playerStates []PlayerState)) *GameServer {
	return &GameServer{
		world:         NewWorld(),
		physics:       NewPhysics(),
		tickRate:      time.Duration(ServerTickInterval) * time.Millisecond,
		updateRate:    time.Duration(ClientUpdateInterval) * time.Millisecond,
		broadcastFunc: broadcastFunc,
		running:       false,
	}
}

// Start begins the game loop
func (gs *GameServer) Start(ctx context.Context) {
	gs.mu.Lock()
	if gs.running {
		gs.mu.Unlock()
		return
	}
	gs.running = true
	gs.mu.Unlock()

	gs.wg.Add(2)
	go gs.tickLoop(ctx)
	go gs.broadcastLoop(ctx)
}

// Stop gracefully stops the game server
func (gs *GameServer) Stop() {
	gs.mu.Lock()
	gs.running = false
	gs.mu.Unlock()

	gs.wg.Wait()
}

// tickLoop runs the physics simulation at ServerTickRate (60Hz)
func (gs *GameServer) tickLoop(ctx context.Context) {
	defer gs.wg.Done()

	ticker := time.NewTicker(gs.tickRate)
	defer ticker.Stop()

	lastTick := time.Now()

	for {
		select {
		case <-ctx.Done():
			log.Println("Game tick loop stopped")
			return
		case now := <-ticker.C:
			// Calculate delta time in seconds
			deltaTime := now.Sub(lastTick).Seconds()
			lastTick = now

			// Update all players
			gs.updateAllPlayers(deltaTime)
		}
	}
}

// broadcastLoop sends state updates to clients at ClientUpdateRate (20Hz)
func (gs *GameServer) broadcastLoop(ctx context.Context) {
	defer gs.wg.Done()

	ticker := time.NewTicker(gs.updateRate)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			log.Println("Game broadcast loop stopped")
			return
		case <-ticker.C:
			// Get all player states and broadcast
			if gs.broadcastFunc != nil {
				playerStates := gs.world.GetAllPlayers()
				if len(playerStates) > 0 {
					gs.broadcastFunc(playerStates)
				}
			}
		}
	}
}

// updateAllPlayers updates physics for all players
func (gs *GameServer) updateAllPlayers(deltaTime float64) {
	// Get all players (this is thread-safe and returns pointers)
	gs.world.mu.RLock()
	players := make([]*PlayerState, 0, len(gs.world.players))
	for _, player := range gs.world.players {
		players = append(players, player)
	}
	gs.world.mu.RUnlock()

	// Update each player's physics
	for _, player := range players {
		gs.physics.UpdatePlayer(player, deltaTime)
	}
}

// AddPlayer adds a new player to the game world
func (gs *GameServer) AddPlayer(playerID string) *PlayerState {
	return gs.world.AddPlayer(playerID)
}

// RemovePlayer removes a player from the game world
func (gs *GameServer) RemovePlayer(playerID string) {
	gs.world.RemovePlayer(playerID)
}

// UpdatePlayerInput updates a player's input state
func (gs *GameServer) UpdatePlayerInput(playerID string, input InputState) bool {
	return gs.world.UpdatePlayerInput(playerID, input)
}

// GetPlayerState returns a snapshot of a player's state
func (gs *GameServer) GetPlayerState(playerID string) (PlayerState, bool) {
	player, exists := gs.world.GetPlayer(playerID)
	if !exists {
		return PlayerState{}, false
	}
	return player.Snapshot(), true
}

// IsRunning returns whether the game server is currently running
func (gs *GameServer) IsRunning() bool {
	gs.mu.RLock()
	defer gs.mu.RUnlock()
	return gs.running
}
