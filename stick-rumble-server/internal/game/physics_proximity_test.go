package game

import (
	"testing"
)

func TestCheckPlayerCrateProximity_WithinRange(t *testing.T) {
	physics := NewPhysics()

	// Create player at position (500, 500)
	player := NewPlayerState("player1")
	player.SetPosition(Vector2{X: 500, Y: 500})

	// Create crate at position (520, 520) - distance = ~28.28px (within 32px)
	crate := &WeaponCrate{
		ID:          "crate1",
		Position:    Vector2{X: 520, Y: 520},
		WeaponType:  "uzi",
		IsAvailable: true,
	}

	inRange := physics.CheckPlayerCrateProximity(player, crate)
	if !inRange {
		t.Error("Player should be within pickup range of crate")
	}
}

func TestCheckPlayerCrateProximity_ExactlyAtRange(t *testing.T) {
	physics := NewPhysics()

	// Create player at position (500, 500)
	player := NewPlayerState("player1")
	player.SetPosition(Vector2{X: 500, Y: 500})

	// Create crate exactly 32px away (500 + 32 = 532 on X axis)
	crate := &WeaponCrate{
		ID:          "crate1",
		Position:    Vector2{X: 532, Y: 500},
		WeaponType:  "uzi",
		IsAvailable: true,
	}

	inRange := physics.CheckPlayerCrateProximity(player, crate)
	if !inRange {
		t.Error("Player should be within pickup range at exactly 32px")
	}
}

func TestCheckPlayerCrateProximity_BeyondRange(t *testing.T) {
	physics := NewPhysics()

	// Create player at position (500, 500)
	player := NewPlayerState("player1")
	player.SetPosition(Vector2{X: 500, Y: 500})

	// Create crate at position (600, 600) - distance = ~141px (beyond 32px)
	crate := &WeaponCrate{
		ID:          "crate1",
		Position:    Vector2{X: 600, Y: 600},
		WeaponType:  "uzi",
		IsAvailable: true,
	}

	inRange := physics.CheckPlayerCrateProximity(player, crate)
	if inRange {
		t.Error("Player should NOT be within pickup range of distant crate")
	}
}

func TestCheckPlayerCrateProximity_JustBeyondRange(t *testing.T) {
	physics := NewPhysics()

	// Create player at position (500, 500)
	player := NewPlayerState("player1")
	player.SetPosition(Vector2{X: 500, Y: 500})

	// Create crate at 33px away (just beyond the 32px threshold)
	crate := &WeaponCrate{
		ID:          "crate1",
		Position:    Vector2{X: 533, Y: 500},
		WeaponType:  "uzi",
		IsAvailable: true,
	}

	inRange := physics.CheckPlayerCrateProximity(player, crate)
	if inRange {
		t.Error("Player should NOT be within pickup range at 33px (beyond 32px threshold)")
	}
}

func TestCheckPlayerCrateProximity_CrateUnavailable(t *testing.T) {
	physics := NewPhysics()

	// Create player at position (500, 500)
	player := NewPlayerState("player1")
	player.SetPosition(Vector2{X: 500, Y: 500})

	// Create unavailable crate close to player
	crate := &WeaponCrate{
		ID:          "crate1",
		Position:    Vector2{X: 510, Y: 510},
		WeaponType:  "uzi",
		IsAvailable: false, // Unavailable
	}

	inRange := physics.CheckPlayerCrateProximity(player, crate)
	if inRange {
		t.Error("Unavailable crate should not be considered in range")
	}
}

func TestCheckPlayerCrateProximity_PlayerDead(t *testing.T) {
	physics := NewPhysics()

	// Create dead player at position (500, 500)
	player := NewPlayerState("player1")
	player.SetPosition(Vector2{X: 500, Y: 500})
	player.TakeDamage(100) // Kill the player

	// Create available crate close to player
	crate := &WeaponCrate{
		ID:          "crate1",
		Position:    Vector2{X: 510, Y: 510},
		WeaponType:  "uzi",
		IsAvailable: true,
	}

	inRange := physics.CheckPlayerCrateProximity(player, crate)
	if inRange {
		t.Error("Dead player should not be able to pick up crates")
	}
}

func TestCheckPlayerCrateProximity_SamePosition(t *testing.T) {
	physics := NewPhysics()

	// Create player and crate at exact same position
	player := NewPlayerState("player1")
	player.SetPosition(Vector2{X: 500, Y: 500})

	crate := &WeaponCrate{
		ID:          "crate1",
		Position:    Vector2{X: 500, Y: 500},
		WeaponType:  "uzi",
		IsAvailable: true,
	}

	inRange := physics.CheckPlayerCrateProximity(player, crate)
	if !inRange {
		t.Error("Player should be within pickup range when at exact same position as crate")
	}
}

func TestCheckPlayerCrateProximity_DiagonalDistance(t *testing.T) {
	physics := NewPhysics()

	// Test various diagonal positions within range
	testCases := []struct {
		name            string
		playerPos       Vector2
		cratePos        Vector2
		shouldBeInRange bool
	}{
		{
			name:            "diagonal within range",
			playerPos:       Vector2{X: 500, Y: 500},
			cratePos:        Vector2{X: 520, Y: 520}, // ~28.28px diagonal
			shouldBeInRange: true,
		},
		{
			name:            "diagonal at edge of range",
			playerPos:       Vector2{X: 500, Y: 500},
			cratePos:        Vector2{X: 522.6, Y: 522.6}, // ~32px diagonal
			shouldBeInRange: true,
		},
		{
			name:            "diagonal beyond range",
			playerPos:       Vector2{X: 500, Y: 500},
			cratePos:        Vector2{X: 525, Y: 525}, // ~35.36px diagonal
			shouldBeInRange: false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			player := NewPlayerState("player1")
			player.SetPosition(tc.playerPos)

			crate := &WeaponCrate{
				ID:          "crate1",
				Position:    tc.cratePos,
				WeaponType:  "uzi",
				IsAvailable: true,
			}

			inRange := physics.CheckPlayerCrateProximity(player, crate)
			if inRange != tc.shouldBeInRange {
				t.Errorf("Expected in range: %v, got: %v", tc.shouldBeInRange, inRange)
			}
		})
	}
}
