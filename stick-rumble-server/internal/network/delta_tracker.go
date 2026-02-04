package network

import (
	"math"
	"sync"
	"time"

	"github.com/mtomcal/stick-rumble-server/internal/game"
)

const (
	// SnapshotInterval defines how often to send full snapshots (prevent delta drift)
	SnapshotInterval = 1 * time.Second

	// PositionDeltaThreshold defines minimum position change to include in delta (pixels)
	PositionDeltaThreshold = 0.1

	// VelocityDeltaThreshold defines minimum velocity change to include in delta
	VelocityDeltaThreshold = 0.1

	// RotationDeltaThreshold defines minimum rotation change to include in delta (radians)
	RotationDeltaThreshold = 0.01
)

// ClientState tracks the last sent state for a single client
type ClientState struct {
	LastSnapshot       time.Time
	LastPlayerStates   map[string]game.PlayerStateSnapshot // playerID -> last sent state
	LastProjectileIDs  map[string]bool                     // projectileID -> exists
	LastWeaponCrateIDs map[string]bool                     // crateID -> exists
}

// DeltaTracker tracks last sent state per client for delta compression
type DeltaTracker struct {
	mu             sync.RWMutex
	lastSentStates map[string]*ClientState // clientID -> state
}

// NewDeltaTracker creates a new delta tracker
func NewDeltaTracker() *DeltaTracker {
	return &DeltaTracker{
		lastSentStates: make(map[string]*ClientState),
	}
}

// ShouldSendSnapshot returns true if it's time to send a full snapshot to the client
func (dt *DeltaTracker) ShouldSendSnapshot(clientID string) bool {
	dt.mu.RLock()
	defer dt.mu.RUnlock()

	clientState, exists := dt.lastSentStates[clientID]
	if !exists {
		// First message - send snapshot
		return true
	}

	// Check if snapshot interval elapsed
	return time.Since(clientState.LastSnapshot) >= SnapshotInterval
}

// UpdateLastSnapshot updates the last snapshot time for a client
func (dt *DeltaTracker) UpdateLastSnapshot(clientID string) {
	dt.mu.Lock()
	defer dt.mu.Unlock()

	clientState, exists := dt.lastSentStates[clientID]
	if !exists {
		clientState = &ClientState{
			LastPlayerStates:   make(map[string]game.PlayerStateSnapshot),
			LastProjectileIDs:  make(map[string]bool),
			LastWeaponCrateIDs: make(map[string]bool),
		}
		dt.lastSentStates[clientID] = clientState
	}

	clientState.LastSnapshot = time.Now()
}

// ComputePlayerDelta computes the delta between current and last sent player states
// Returns only the players that have changed
func (dt *DeltaTracker) ComputePlayerDelta(clientID string, currentStates []game.PlayerStateSnapshot) []game.PlayerStateSnapshot {
	dt.mu.RLock()
	defer dt.mu.RUnlock()

	clientState, exists := dt.lastSentStates[clientID]
	if !exists {
		// No previous state - return all players
		return currentStates
	}

	delta := make([]game.PlayerStateSnapshot, 0)

	for i := range currentStates {
		current := currentStates[i]
		last, hasLast := clientState.LastPlayerStates[current.ID]
		if !hasLast {
			// New player - include in delta
			delta = append(delta, current)
			continue
		}

		// Check if state changed significantly
		if stateChanged(current, last) {
			delta = append(delta, current)
		}
	}

	return delta
}

// stateChanged checks if player state changed beyond thresholds
func stateChanged(current, last game.PlayerStateSnapshot) bool {
	// Check position change
	dx := math.Abs(current.Position.X - last.Position.X)
	dy := math.Abs(current.Position.Y - last.Position.Y)
	if dx > PositionDeltaThreshold || dy > PositionDeltaThreshold {
		return true
	}

	// Check velocity change
	dvx := math.Abs(current.Velocity.X - last.Velocity.X)
	dvy := math.Abs(current.Velocity.Y - last.Velocity.Y)
	if dvx > VelocityDeltaThreshold || dvy > VelocityDeltaThreshold {
		return true
	}

	// Check aim angle change
	da := math.Abs(current.AimAngle - last.AimAngle)
	if da > RotationDeltaThreshold {
		return true
	}

	// Check health change
	if current.Health != last.Health {
		return true
	}

	// Check boolean flags
	currentIsDead := current.DeathTime != nil
	lastIsDead := last.DeathTime != nil
	if currentIsDead != lastIsDead ||
		current.IsInvulnerable != last.IsInvulnerable ||
		current.Rolling != last.Rolling ||
		current.IsRegeneratingHealth != last.IsRegeneratingHealth {
		return true
	}

	// Check stats changes (kills, deaths, XP)
	if current.Kills != last.Kills ||
		current.Deaths != last.Deaths ||
		current.XP != last.XP {
		return true
	}

	return false
}

// UpdatePlayerState updates the last sent player state for a client
func (dt *DeltaTracker) UpdatePlayerState(clientID string, states []game.PlayerStateSnapshot) {
	dt.mu.Lock()
	defer dt.mu.Unlock()

	clientState, exists := dt.lastSentStates[clientID]
	if !exists {
		clientState = &ClientState{
			LastSnapshot:       time.Now(),
			LastPlayerStates:   make(map[string]game.PlayerStateSnapshot),
			LastProjectileIDs:  make(map[string]bool),
			LastWeaponCrateIDs: make(map[string]bool),
		}
		dt.lastSentStates[clientID] = clientState
	}

	// Update player states
	for _, state := range states {
		clientState.LastPlayerStates[state.ID] = state
	}
}

// ComputeProjectileDelta computes added and removed projectiles
func (dt *DeltaTracker) ComputeProjectileDelta(clientID string, currentProjectiles []game.ProjectileSnapshot) (added []game.ProjectileSnapshot, removed []string) {
	dt.mu.RLock()
	defer dt.mu.RUnlock()

	clientState, exists := dt.lastSentStates[clientID]
	if !exists {
		// No previous state - all projectiles are new
		return currentProjectiles, nil
	}

	// Build current projectile set
	currentIDs := make(map[string]bool)
	for _, proj := range currentProjectiles {
		currentIDs[proj.ID] = true
	}

	// Find added projectiles
	for _, proj := range currentProjectiles {
		if !clientState.LastProjectileIDs[proj.ID] {
			added = append(added, proj)
		}
	}

	// Find removed projectiles
	for projID := range clientState.LastProjectileIDs {
		if !currentIDs[projID] {
			removed = append(removed, projID)
		}
	}

	return added, removed
}

// UpdateProjectileState updates the last sent projectile state for a client
func (dt *DeltaTracker) UpdateProjectileState(clientID string, projectiles []game.ProjectileSnapshot) {
	dt.mu.Lock()
	defer dt.mu.Unlock()

	clientState, exists := dt.lastSentStates[clientID]
	if !exists {
		clientState = &ClientState{
			LastSnapshot:       time.Now(),
			LastPlayerStates:   make(map[string]game.PlayerStateSnapshot),
			LastProjectileIDs:  make(map[string]bool),
			LastWeaponCrateIDs: make(map[string]bool),
		}
		dt.lastSentStates[clientID] = clientState
	}

	// Reset and rebuild projectile set
	clientState.LastProjectileIDs = make(map[string]bool)
	for _, proj := range projectiles {
		clientState.LastProjectileIDs[proj.ID] = true
	}
}

// RemoveClient removes tracking state for a disconnected client
func (dt *DeltaTracker) RemoveClient(clientID string) {
	dt.mu.Lock()
	defer dt.mu.Unlock()

	delete(dt.lastSentStates, clientID)
}
