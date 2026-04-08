package game

import (
	"fmt"
	"sync"
	"time"
)

// WeaponCrate represents a weapon spawn point on the map
type WeaponCrate struct {
	ID          string
	Position    Vector2
	WeaponType  string
	IsAvailable bool
	RespawnTime time.Time
}

// WeaponCrateManager manages all weapon crates in the game
type WeaponCrateManager struct {
	mapConfig MapConfig
	crates    map[string]*WeaponCrate
	mu        sync.RWMutex
}

// NewWeaponCrateManager creates a new weapon crate manager with default spawn points
func NewWeaponCrateManager(mapConfigs ...MapConfig) *WeaponCrateManager {
	mapConfig := resolveMapConfig(mapConfigs...)
	manager := &WeaponCrateManager{
		mapConfig: mapConfig,
		crates:    make(map[string]*WeaponCrate),
	}
	manager.InitializeMapSpawns()
	return manager
}

// InitializeMapSpawns creates weapon crate runtime state from authored map spawn points.
func (wcm *WeaponCrateManager) InitializeMapSpawns() {
	for _, spawn := range wcm.mapConfig.WeaponSpawns {
		crateID := spawn.ID
		if crateID == "" {
			crateID = fmt.Sprintf("crate_%s", spawn.WeaponType)
		}

		wcm.crates[crateID] = &WeaponCrate{
			ID:          crateID,
			Position:    Vector2{X: spawn.X, Y: spawn.Y},
			WeaponType:  spawn.WeaponType,
			IsAvailable: true,
		}
	}
}

// PickupCrate attempts to pick up a weapon crate
// Returns true if pickup was successful, false if crate doesn't exist or is unavailable
func (wcm *WeaponCrateManager) PickupCrate(crateID string) bool {
	wcm.mu.Lock()
	defer wcm.mu.Unlock()

	crate, exists := wcm.crates[crateID]
	if !exists || !crate.IsAvailable {
		return false
	}

	crate.IsAvailable = false
	crate.RespawnTime = time.Now().Add(WeaponRespawnDelay * time.Second)
	return true
}

// UpdateRespawns checks for crates that should respawn and makes them available again
// Returns a slice of crate IDs that respawned
func (wcm *WeaponCrateManager) UpdateRespawns() []string {
	wcm.mu.Lock()
	defer wcm.mu.Unlock()

	respawned := make([]string, 0)
	now := time.Now()

	for id, crate := range wcm.crates {
		if !crate.IsAvailable && now.After(crate.RespawnTime) {
			crate.IsAvailable = true
			respawned = append(respawned, id)
		}
	}

	return respawned
}

// GetCrate returns a weapon crate by ID
// Returns nil if crate doesn't exist
func (wcm *WeaponCrateManager) GetCrate(crateID string) *WeaponCrate {
	wcm.mu.RLock()
	defer wcm.mu.RUnlock()

	return wcm.crates[crateID]
}

// GetAllCrates returns a copy of all weapon crates
// Returns a map copy to prevent external modification
func (wcm *WeaponCrateManager) GetAllCrates() map[string]*WeaponCrate {
	wcm.mu.RLock()
	defer wcm.mu.RUnlock()

	// Return a shallow copy of the map
	crates := make(map[string]*WeaponCrate, len(wcm.crates))
	for id, crate := range wcm.crates {
		crates[id] = crate
	}
	return crates
}
