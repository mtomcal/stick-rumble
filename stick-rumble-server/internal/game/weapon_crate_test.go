package game

import (
	"sync"
	"testing"
	"time"
)

func TestNewWeaponCrateManager(t *testing.T) {
	manager := NewWeaponCrateManager()

	if manager == nil {
		t.Fatal("NewWeaponCrateManager() returned nil")
	}

	// Verify default crates are initialized
	crates := manager.GetAllCrates()
	if len(crates) == 0 {
		t.Error("Expected default weapon crates to be initialized, got 0 crates")
	}

	// Verify all crates are initially available
	for _, crate := range crates {
		if !crate.IsAvailable {
			t.Errorf("Crate %s should be available initially", crate.ID)
		}
	}
}

func TestWeaponCrateManager_InitializeDefaultSpawns(t *testing.T) {
	manager := NewWeaponCrateManager()
	crates := manager.GetAllCrates()

	// Verify we have exactly 5 default spawn points (one for each weapon type except pistol)
	expectedCount := 5
	if len(crates) != expectedCount {
		t.Errorf("Expected %d default weapon crates, got %d", expectedCount, len(crates))
	}

	// Verify all weapon types are represented
	weaponTypes := make(map[string]bool)
	for _, crate := range crates {
		weaponTypes[crate.WeaponType] = true
	}

	expectedTypes := []string{"bat", "katana", "uzi", "ak47", "shotgun"}
	for _, expectedType := range expectedTypes {
		if !weaponTypes[expectedType] {
			t.Errorf("Expected weapon type %q in default spawns, not found", expectedType)
		}
	}

	// Verify all crates have valid positions within arena bounds
	for _, crate := range crates {
		if crate.Position.X < 0 || crate.Position.X > ArenaWidth {
			t.Errorf("Crate %s has invalid X position: %f (arena width: %f)", crate.ID, crate.Position.X, ArenaWidth)
		}
		if crate.Position.Y < 0 || crate.Position.Y > ArenaHeight {
			t.Errorf("Crate %s has invalid Y position: %f (arena height: %f)", crate.ID, crate.Position.Y, ArenaHeight)
		}
	}
}

func TestWeaponCrateManager_PickupCrate_Success(t *testing.T) {
	manager := NewWeaponCrateManager()
	crates := manager.GetAllCrates()

	if len(crates) == 0 {
		t.Fatal("No crates available for testing")
	}

	// Get first crate ID
	var crateID string
	for id := range crates {
		crateID = id
		break
	}

	// Pickup the crate
	success := manager.PickupCrate(crateID)
	if !success {
		t.Errorf("PickupCrate(%q) should return true for available crate", crateID)
	}

	// Verify crate is now unavailable
	crate := manager.GetCrate(crateID)
	if crate == nil {
		t.Fatalf("GetCrate(%q) returned nil", crateID)
	}

	if crate.IsAvailable {
		t.Error("Crate should be unavailable after pickup")
	}

	// Verify respawn time is set (should be ~30 seconds from now)
	expectedRespawnTime := time.Now().Add(WeaponRespawnDelay * time.Second)
	timeDiff := crate.RespawnTime.Sub(expectedRespawnTime).Abs()
	if timeDiff > 100*time.Millisecond {
		t.Errorf("Respawn time not set correctly. Expected ~%v, got %v (diff: %v)",
			expectedRespawnTime, crate.RespawnTime, timeDiff)
	}
}

func TestWeaponCrateManager_PickupCrate_AlreadyPickedUp(t *testing.T) {
	manager := NewWeaponCrateManager()
	crates := manager.GetAllCrates()

	if len(crates) == 0 {
		t.Fatal("No crates available for testing")
	}

	// Get first crate ID
	var crateID string
	for id := range crates {
		crateID = id
		break
	}

	// Pickup the crate first time (should succeed)
	success := manager.PickupCrate(crateID)
	if !success {
		t.Fatalf("First pickup should succeed")
	}

	// Try to pickup same crate again (should fail)
	success = manager.PickupCrate(crateID)
	if success {
		t.Error("PickupCrate() should return false for already picked up crate")
	}
}

func TestWeaponCrateManager_PickupCrate_InvalidID(t *testing.T) {
	manager := NewWeaponCrateManager()

	// Try to pickup non-existent crate
	success := manager.PickupCrate("invalid_crate_id")
	if success {
		t.Error("PickupCrate() should return false for non-existent crate")
	}
}

func TestWeaponCrateManager_UpdateRespawns_NoRespawns(t *testing.T) {
	manager := NewWeaponCrateManager()

	// Pickup a crate but don't wait for respawn
	crates := manager.GetAllCrates()
	var crateID string
	for id := range crates {
		crateID = id
		break
	}
	manager.PickupCrate(crateID)

	// Check for respawns immediately (should be none)
	respawned := manager.UpdateRespawns()
	if len(respawned) != 0 {
		t.Errorf("Expected 0 respawns, got %d", len(respawned))
	}

	// Verify crate is still unavailable
	crate := manager.GetCrate(crateID)
	if crate.IsAvailable {
		t.Error("Crate should still be unavailable")
	}
}

func TestWeaponCrateManager_UpdateRespawns_AfterDelay(t *testing.T) {
	manager := NewWeaponCrateManager()

	// Get first crate
	crates := manager.GetAllCrates()
	var crateID string
	for id := range crates {
		crateID = id
		break
	}

	// Pickup the crate
	manager.PickupCrate(crateID)

	// Manually set respawn time to the past (simulate 30s elapsed)
	crate := manager.GetCrate(crateID)
	crate.RespawnTime = time.Now().Add(-1 * time.Second)

	// Check for respawns
	respawned := manager.UpdateRespawns()
	if len(respawned) != 1 {
		t.Fatalf("Expected 1 respawn, got %d", len(respawned))
	}

	if respawned[0] != crateID {
		t.Errorf("Expected respawned crate ID %q, got %q", crateID, respawned[0])
	}

	// Verify crate is now available again
	crate = manager.GetCrate(crateID)
	if !crate.IsAvailable {
		t.Error("Crate should be available after respawn")
	}
}

func TestWeaponCrateManager_UpdateRespawns_MultipleCrates(t *testing.T) {
	manager := NewWeaponCrateManager()
	crates := manager.GetAllCrates()

	// Pickup all crates
	crateIDs := make([]string, 0)
	for id := range crates {
		crateIDs = append(crateIDs, id)
		manager.PickupCrate(id)
	}

	// Set all respawn times to the past
	for _, id := range crateIDs {
		crate := manager.GetCrate(id)
		crate.RespawnTime = time.Now().Add(-1 * time.Second)
	}

	// Check for respawns
	respawned := manager.UpdateRespawns()
	if len(respawned) != len(crateIDs) {
		t.Errorf("Expected %d respawns, got %d", len(crateIDs), len(respawned))
	}

	// Verify all crates are available again
	for _, id := range crateIDs {
		crate := manager.GetCrate(id)
		if !crate.IsAvailable {
			t.Errorf("Crate %s should be available after respawn", id)
		}
	}
}

func TestWeaponCrateManager_GetCrate(t *testing.T) {
	manager := NewWeaponCrateManager()
	crates := manager.GetAllCrates()

	// Get first crate ID
	var crateID string
	for id := range crates {
		crateID = id
		break
	}

	// Test getting existing crate
	crate := manager.GetCrate(crateID)
	if crate == nil {
		t.Errorf("GetCrate(%q) returned nil for existing crate", crateID)
	}

	// Test getting non-existent crate
	crate = manager.GetCrate("invalid_id")
	if crate != nil {
		t.Error("GetCrate() should return nil for non-existent crate")
	}
}

func TestWeaponCrateManager_GetAllCrates(t *testing.T) {
	manager := NewWeaponCrateManager()

	crates := manager.GetAllCrates()
	if crates == nil {
		t.Fatal("GetAllCrates() returned nil")
	}

	// Verify we get a copy, not the internal map
	crates["test_id"] = &WeaponCrate{ID: "test_id"}

	// Verify internal state not modified
	if manager.GetCrate("test_id") != nil {
		t.Error("GetAllCrates() should return a copy, not the internal map")
	}
}

func TestWeaponCrateManager_ConcurrentAccess(t *testing.T) {
	manager := NewWeaponCrateManager()
	crates := manager.GetAllCrates()

	// Get all crate IDs
	crateIDs := make([]string, 0, len(crates))
	for id := range crates {
		crateIDs = append(crateIDs, id)
	}

	if len(crateIDs) < 2 {
		t.Skip("Need at least 2 crates for concurrent access test")
	}

	// Test concurrent pickups on different crates
	var wg sync.WaitGroup
	for i := 0; i < len(crateIDs) && i < 5; i++ {
		wg.Add(1)
		go func(id string) {
			defer wg.Done()
			manager.PickupCrate(id)
		}(crateIDs[i])
	}
	wg.Wait()

	// Test concurrent reads
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			manager.GetAllCrates()
		}()
	}
	wg.Wait()

	// Test concurrent respawn updates
	for i := 0; i < 5; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			manager.UpdateRespawns()
		}()
	}
	wg.Wait()

	// If we get here without race conditions or panics, test passes
}
