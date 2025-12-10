package network

import (
	"encoding/json"
	"testing"

	"github.com/mtomcal/stick-rumble-server/internal/game"
)

// TestHandleWeaponPickup_Success tests successful weapon pickup
func TestHandleWeaponPickup_Success(t *testing.T) {
	handler := NewWebSocketHandler()

	// Add player to game server
	playerID := "player1"
	handler.gameServer.AddPlayer(playerID)

	// Get player from world
	player, exists := handler.gameServer.GetWorld().GetPlayer(playerID)
	if !exists {
		t.Fatal("Player not found in world")
	}

	// Get first weapon crate from manager
	crates := handler.gameServer.GetWeaponCrateManager().GetAllCrates()
	var testCrate *game.WeaponCrate
	var testCrateID string
	for id, crate := range crates {
		if crate.IsAvailable {
			testCrate = crate
			testCrateID = id
			break
		}
	}

	if testCrate == nil {
		t.Fatal("No available weapon crates found")
	}

	// Position player within pickup range (32px) - use SetPosition method
	player.SetPosition(testCrate.Position)

	// Prepare pickup request data
	data := map[string]interface{}{
		"crateId": testCrateID,
	}

	// Call handleWeaponPickup
	handler.handleWeaponPickup(playerID, data)

	// Verify crate is now unavailable
	updatedCrate := handler.gameServer.GetWeaponCrateManager().GetCrate(testCrateID)
	if updatedCrate.IsAvailable {
		t.Error("Expected crate to be unavailable after pickup")
	}

	// Verify player now has the weapon
	weaponState := handler.gameServer.GetWeaponState(playerID)
	if weaponState == nil {
		t.Fatal("Expected weapon state to exist")
	}

	// Verify weapon type matches crate
	expectedWeaponName := getExpectedWeaponName(testCrate.WeaponType)
	if weaponState.Weapon.Name != expectedWeaponName {
		t.Errorf("Expected weapon name %s, got %s", expectedWeaponName, weaponState.Weapon.Name)
	}
}

// TestHandleWeaponPickup_OutOfRange tests pickup rejection when player is out of range
func TestHandleWeaponPickup_OutOfRange(t *testing.T) {
	handler := NewWebSocketHandler()

	// Add player to game server
	playerID := "player1"
	handler.gameServer.AddPlayer(playerID)

	// Get player from world
	player, _ := handler.gameServer.GetWorld().GetPlayer(playerID)

	// Get a weapon crate
	crates := handler.gameServer.GetWeaponCrateManager().GetAllCrates()
	var testCrateID string
	var testCrate *game.WeaponCrate
	for id, crate := range crates {
		if crate.IsAvailable {
			testCrateID = id
			testCrate = crate
			break
		}
	}

	// Position player far from crate (100px away, beyond 32px range)
	player.SetPosition(game.Vector2{
		X: testCrate.Position.X + 100,
		Y: testCrate.Position.Y + 100,
	})

	// Prepare pickup request data
	data := map[string]interface{}{
		"crateId": testCrateID,
	}

	// Store original weapon
	originalWeapon := handler.gameServer.GetWeaponState(playerID).Weapon.Name

	// Call handleWeaponPickup (should fail silently)
	handler.handleWeaponPickup(playerID, data)

	// Verify crate is still available
	updatedCrate := handler.gameServer.GetWeaponCrateManager().GetCrate(testCrateID)
	if !updatedCrate.IsAvailable {
		t.Error("Expected crate to remain available when pickup fails")
	}

	// Verify player weapon unchanged
	currentWeapon := handler.gameServer.GetWeaponState(playerID).Weapon.Name
	if currentWeapon != originalWeapon {
		t.Errorf("Expected weapon to remain %s, got %s", originalWeapon, currentWeapon)
	}
}

// TestHandleWeaponPickup_UnavailableCrate tests pickup rejection when crate is unavailable
func TestHandleWeaponPickup_UnavailableCrate(t *testing.T) {
	handler := NewWebSocketHandler()

	// Add player to game server
	playerID := "player1"
	handler.gameServer.AddPlayer(playerID)

	// Get player from world
	player, _ := handler.gameServer.GetWorld().GetPlayer(playerID)

	// Get a weapon crate and mark it unavailable
	crates := handler.gameServer.GetWeaponCrateManager().GetAllCrates()
	var testCrateID string
	var testCrate *game.WeaponCrate
	for id, crate := range crates {
		testCrateID = id
		testCrate = crate
		break
	}

	// Mark crate as picked up
	handler.gameServer.GetWeaponCrateManager().PickupCrate(testCrateID)

	// Position player at crate location
	player.SetPosition(testCrate.Position)

	// Prepare pickup request data
	data := map[string]interface{}{
		"crateId": testCrateID,
	}

	// Store original weapon
	originalWeapon := handler.gameServer.GetWeaponState(playerID).Weapon.Name

	// Call handleWeaponPickup (should fail silently)
	handler.handleWeaponPickup(playerID, data)

	// Verify player weapon unchanged
	currentWeapon := handler.gameServer.GetWeaponState(playerID).Weapon.Name
	if currentWeapon != originalWeapon {
		t.Errorf("Expected weapon to remain %s, got %s", originalWeapon, currentWeapon)
	}
}

// TestHandleWeaponPickup_DeadPlayer tests pickup rejection when player is dead
func TestHandleWeaponPickup_DeadPlayer(t *testing.T) {
	handler := NewWebSocketHandler()

	// Add player to game server
	playerID := "player1"
	handler.gameServer.AddPlayer(playerID)

	// Get player from world and mark player as dead
	player, _ := handler.gameServer.GetWorld().GetPlayer(playerID)
	handler.gameServer.MarkPlayerDead(playerID)

	// Get a weapon crate
	crates := handler.gameServer.GetWeaponCrateManager().GetAllCrates()
	var testCrateID string
	var testCrate *game.WeaponCrate
	for id, crate := range crates {
		if crate.IsAvailable {
			testCrateID = id
			testCrate = crate
			break
		}
	}

	// Position player at crate location
	player.SetPosition(testCrate.Position)

	// Prepare pickup request data
	data := map[string]interface{}{
		"crateId": testCrateID,
	}

	// Call handleWeaponPickup (should fail silently)
	handler.handleWeaponPickup(playerID, data)

	// Verify crate is still available
	updatedCrate := handler.gameServer.GetWeaponCrateManager().GetCrate(testCrateID)
	if !updatedCrate.IsAvailable {
		t.Error("Expected crate to remain available when dead player attempts pickup")
	}
}

// TestHandleWeaponPickup_InvalidCrateID tests pickup with non-existent crate ID
func TestHandleWeaponPickup_InvalidCrateID(t *testing.T) {
	handler := NewWebSocketHandler()

	// Add player to game server
	playerID := "player1"
	handler.gameServer.AddPlayer(playerID)

	// Prepare pickup request with invalid crate ID
	data := map[string]interface{}{
		"crateId": "invalid_crate_id",
	}

	// Store original weapon
	originalWeapon := handler.gameServer.GetWeaponState(playerID).Weapon.Name

	// Call handleWeaponPickup (should fail silently)
	handler.handleWeaponPickup(playerID, data)

	// Verify player weapon unchanged
	currentWeapon := handler.gameServer.GetWeaponState(playerID).Weapon.Name
	if currentWeapon != originalWeapon {
		t.Errorf("Expected weapon to remain %s, got %s", originalWeapon, currentWeapon)
	}
}

// TestHandleWeaponPickup_InvalidDataFormat tests handling of malformed data
func TestHandleWeaponPickup_InvalidDataFormat(t *testing.T) {
	handler := NewWebSocketHandler()

	// Add player to game server
	playerID := "player1"
	handler.gameServer.AddPlayer(playerID)

	// Test with non-map data
	handler.handleWeaponPickup(playerID, "invalid_data")

	// Test with missing crateId field
	handler.handleWeaponPickup(playerID, map[string]interface{}{})

	// Test with wrong type for crateId
	handler.handleWeaponPickup(playerID, map[string]interface{}{
		"crateId": 12345, // Should be string
	})

	// If we got here without panicking, test passes
}

// TestBroadcastWeaponPickup tests weapon pickup broadcast message
func TestBroadcastWeaponPickup(t *testing.T) {
	handler := NewWebSocketHandler()

	playerID := "player1"
	crateID := "crate_uzi_0"
	weaponType := "uzi"
	respawnTime := handler.gameServer.GetWeaponCrateManager().GetCrate(crateID).RespawnTime

	// Call broadcast function (doesn't panic = success for now)
	handler.broadcastWeaponPickup(playerID, crateID, weaponType, respawnTime)
}

// TestBroadcastWeaponRespawn tests weapon respawn broadcast message
func TestBroadcastWeaponRespawn(t *testing.T) {
	handler := NewWebSocketHandler()

	// Get a weapon crate
	crates := handler.gameServer.GetWeaponCrateManager().GetAllCrates()
	var testCrate *game.WeaponCrate
	for _, crate := range crates {
		testCrate = crate
		break
	}

	// Call broadcast function (doesn't panic = success for now)
	handler.broadcastWeaponRespawn(testCrate)
}

// TestOnWeaponRespawn tests the respawn callback
func TestOnWeaponRespawn(t *testing.T) {
	handler := NewWebSocketHandler()

	// Get a weapon crate and mark it unavailable
	crates := handler.gameServer.GetWeaponCrateManager().GetAllCrates()
	var testCrate *game.WeaponCrate
	var testCrateID string
	for id, crate := range crates {
		testCrateID = id
		testCrate = crate
		break
	}

	// Mark crate unavailable
	handler.gameServer.GetWeaponCrateManager().PickupCrate(testCrateID)

	// Make it available again (simulate respawn)
	testCrate.IsAvailable = true

	// Call respawn callback
	handler.onWeaponRespawn(testCrate)

	// Test passes if no panic
}

// Helper function to get expected weapon name from weapon type
func getExpectedWeaponName(weaponType string) string {
	switch weaponType {
	case "bat":
		return "Bat"
	case "katana":
		return "Katana"
	case "uzi":
		return "Uzi"
	case "ak47":
		return "AK-47"
	case "shotgun":
		return "Shotgun"
	default:
		return "Unknown"
	}
}

// TestWeaponPickupIntegration tests the full pickup flow
func TestWeaponPickupIntegration(t *testing.T) {
	handler := NewWebSocketHandler()

	// Setup: Add player
	playerID := "player1"
	handler.gameServer.AddPlayer(playerID)
	player, _ := handler.gameServer.GetWorld().GetPlayer(playerID)

	// Get a weapon crate
	crates := handler.gameServer.GetWeaponCrateManager().GetAllCrates()
	var testCrateID string
	var testCrate *game.WeaponCrate
	for id, crate := range crates {
		if crate.IsAvailable && crate.WeaponType == "uzi" {
			testCrateID = id
			testCrate = crate
			break
		}
	}

	if testCrate == nil {
		t.Fatal("No Uzi crate found")
	}

	// Position player at crate
	player.SetPosition(testCrate.Position)

	// Verify initial state
	initialWeapon := handler.gameServer.GetWeaponState(playerID).Weapon.Name
	if initialWeapon != "Pistol" {
		t.Errorf("Expected initial weapon Pistol, got %s", initialWeapon)
	}

	// Simulate pickup request
	data := map[string]interface{}{
		"crateId": testCrateID,
	}
	handler.handleWeaponPickup(playerID, data)

	// Verify weapon changed
	newWeapon := handler.gameServer.GetWeaponState(playerID).Weapon.Name
	if newWeapon != "Uzi" {
		t.Errorf("Expected weapon Uzi after pickup, got %s", newWeapon)
	}

	// Verify crate unavailable
	if testCrate.IsAvailable {
		t.Error("Expected crate to be unavailable after pickup")
	}

	// Verify respawn time is set (30 seconds from now)
	if testCrate.RespawnTime.IsZero() {
		t.Error("Expected respawn time to be set")
	}
}

// TestGetString tests the getString helper function
func TestGetString(t *testing.T) {
	tests := []struct {
		name     string
		m        map[string]interface{}
		key      string
		expected string
	}{
		{
			name:     "Valid string",
			m:        map[string]interface{}{"key": "value"},
			key:      "key",
			expected: "value",
		},
		{
			name:     "Missing key",
			m:        map[string]interface{}{},
			key:      "key",
			expected: "",
		},
		{
			name:     "Wrong type (int)",
			m:        map[string]interface{}{"key": 123},
			key:      "key",
			expected: "",
		},
		{
			name:     "Wrong type (bool)",
			m:        map[string]interface{}{"key": true},
			key:      "key",
			expected: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := getString(tt.m, tt.key)
			if result != tt.expected {
				t.Errorf("Expected %s, got %s", tt.expected, result)
			}
		})
	}
}

// TestMessageSerialization tests that weapon pickup messages can be marshaled
func TestMessageSerialization(t *testing.T) {
	// Test weapon:pickup_confirmed message
	pickupMsg := Message{
		Type:      "weapon:pickup_confirmed",
		Timestamp: 1234567890,
		Data: map[string]interface{}{
			"playerId":        "player1",
			"crateId":         "crate_uzi_0",
			"weaponType":      "uzi",
			"nextRespawnTime": int64(1234567920),
		},
	}

	_, err := json.Marshal(pickupMsg)
	if err != nil {
		t.Errorf("Failed to marshal pickup message: %v", err)
	}

	// Test weapon:respawned message
	respawnMsg := Message{
		Type:      "weapon:respawned",
		Timestamp: 1234567920,
		Data: map[string]interface{}{
			"crateId":    "crate_uzi_0",
			"weaponType": "uzi",
			"position": game.Vector2{
				X: 960,
				Y: 216,
			},
		},
	}

	_, err = json.Marshal(respawnMsg)
	if err != nil {
		t.Errorf("Failed to marshal respawn message: %v", err)
	}
}
