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
	crates map[string]*WeaponCrate
	mu     sync.RWMutex
}

// NewWeaponCrateManager creates a new weapon crate manager with default spawn points
func NewWeaponCrateManager() *WeaponCrateManager {
	manager := &WeaponCrateManager{
		crates: make(map[string]*WeaponCrate),
	}
	manager.InitializeDefaultSpawns()
	return manager
}

// InitializeDefaultSpawns creates the default weapon spawn points for the arena
// Based on the weapon acquisition system design (Story 3.3A):
// - 5 fixed spawn points (one for each non-pistol weapon)
// - Balanced positions across the map
// - Strategic placement considering weapon power levels
func (wcm *WeaponCrateManager) InitializeDefaultSpawns() {
	spawns := []struct {
		Position   Vector2
		WeaponType string
	}{
		// Center top - Uzi (medium range, spray weapon)
		{Position: Vector2{X: ArenaWidth / 2, Y: ArenaHeight * 0.2}, WeaponType: "uzi"},

		// Left mid - AK47 (powerful long-range weapon, contested position)
		{Position: Vector2{X: ArenaWidth * 0.25, Y: ArenaHeight / 2}, WeaponType: "ak47"},

		// Right mid - Shotgun (close-range power weapon)
		{Position: Vector2{X: ArenaWidth * 0.75, Y: ArenaHeight / 2}, WeaponType: "shotgun"},

		// Bottom center - Katana (melee, high skill weapon)
		{Position: Vector2{X: ArenaWidth / 2, Y: ArenaHeight * 0.8}, WeaponType: "katana"},

		// Top left corner - Bat (melee, knockback weapon)
		{Position: Vector2{X: ArenaWidth * 0.15, Y: ArenaHeight * 0.15}, WeaponType: "bat"},
	}

	for i, spawn := range spawns {
		crateID := fmt.Sprintf("crate_%s_%d", spawn.WeaponType, i)
		wcm.crates[crateID] = &WeaponCrate{
			ID:          crateID,
			Position:    spawn.Position,
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
