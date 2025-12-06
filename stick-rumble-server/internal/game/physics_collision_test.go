package game

import "testing"

// HitEvent collision detection tests

func TestCheckProjectilePlayerCollision_Hit(t *testing.T) {
	physics := NewPhysics()

	// Create projectile at position (500, 500)
	proj := &Projectile{
		ID:            "proj-1",
		OwnerID:       "player-1",
		Position:      Vector2{X: 500, Y: 500},
		SpawnPosition: Vector2{X: 500, Y: 500},
		Active:        true,
	}

	// Create target player at same position (should hit)
	target := NewPlayerState("player-2")
	target.SetPosition(Vector2{X: 500, Y: 500})

	result := physics.CheckProjectilePlayerCollision(proj, target)

	if !result {
		t.Error("Expected collision at same position")
	}
}

func TestCheckProjectilePlayerCollision_Miss(t *testing.T) {
	physics := NewPhysics()

	// Create projectile at position (500, 500)
	proj := &Projectile{
		ID:            "proj-1",
		OwnerID:       "player-1",
		Position:      Vector2{X: 500, Y: 500},
		SpawnPosition: Vector2{X: 500, Y: 500},
		Active:        true,
	}

	// Create target player far away (should miss)
	target := NewPlayerState("player-2")
	target.SetPosition(Vector2{X: 1000, Y: 1000})

	result := physics.CheckProjectilePlayerCollision(proj, target)

	if result {
		t.Error("Expected no collision when far apart")
	}
}

func TestCheckProjectilePlayerCollision_EdgeOfHitbox(t *testing.T) {
	physics := NewPhysics()

	// Create projectile
	proj := &Projectile{
		ID:            "proj-1",
		OwnerID:       "player-1",
		Position:      Vector2{X: 500, Y: 500},
		SpawnPosition: Vector2{X: 500, Y: 500},
		Active:        true,
	}

	// Create target just at edge of hitbox (should still hit)
	// Player hitbox is 32x64, so half-width is 16
	target := NewPlayerState("player-2")
	target.SetPosition(Vector2{X: 515, Y: 500}) // 15 pixels right (within 16)

	result := physics.CheckProjectilePlayerCollision(proj, target)

	if !result {
		t.Error("Expected collision at edge of hitbox")
	}
}

func TestCheckProjectilePlayerCollision_BarelyMiss(t *testing.T) {
	physics := NewPhysics()

	// Create projectile
	proj := &Projectile{
		ID:            "proj-1",
		OwnerID:       "player-1",
		Position:      Vector2{X: 500, Y: 500},
		SpawnPosition: Vector2{X: 500, Y: 500},
		Active:        true,
	}

	// Create target just outside hitbox (should miss)
	// Player hitbox half-width is 16, so 17 should miss
	target := NewPlayerState("player-2")
	target.SetPosition(Vector2{X: 517, Y: 500})

	result := physics.CheckProjectilePlayerCollision(proj, target)

	if result {
		t.Error("Expected no collision just outside hitbox")
	}
}

func TestCheckProjectilePlayerCollision_DeadPlayer(t *testing.T) {
	physics := NewPhysics()

	// Create projectile
	proj := &Projectile{
		ID:            "proj-1",
		OwnerID:       "player-1",
		Position:      Vector2{X: 500, Y: 500},
		SpawnPosition: Vector2{X: 500, Y: 500},
		Active:        true,
	}

	// Create dead player at same position
	target := NewPlayerState("player-2")
	target.SetPosition(Vector2{X: 500, Y: 500})
	target.TakeDamage(100) // Kill the player

	result := physics.CheckProjectilePlayerCollision(proj, target)

	if result {
		t.Error("Should not collide with dead player")
	}
}

func TestCheckProjectilePlayerCollision_InvulnerablePlayer(t *testing.T) {
	physics := NewPhysics()

	// Create projectile
	proj := &Projectile{
		ID:            "proj-1",
		OwnerID:       "player-1",
		Position:      Vector2{X: 500, Y: 500},
		SpawnPosition: Vector2{X: 500, Y: 500},
		Active:        true,
	}

	// Create invulnerable player at same position (spawn protection)
	target := NewPlayerState("player-2")
	target.SetPosition(Vector2{X: 500, Y: 500})
	target.Respawn(Vector2{X: 500, Y: 500}) // Respawn grants invulnerability

	result := physics.CheckProjectilePlayerCollision(proj, target)

	if result {
		t.Error("Should not collide with invulnerable player (spawn protection)")
	}
}

func TestCheckAllProjectileCollisions_SingleHit(t *testing.T) {
	physics := NewPhysics()

	// Create one projectile
	projectiles := []*Projectile{
		{
			ID:            "proj-1",
			OwnerID:       "player-1",
			Position:      Vector2{X: 500, Y: 500},
			SpawnPosition: Vector2{X: 500, Y: 500},
			Active:        true,
		},
	}

	// Create two players (one will be hit)
	players := []*PlayerState{
		NewPlayerState("player-1"), // Owner - should be ignored
		NewPlayerState("player-2"), // Target
	}
	players[0].SetPosition(Vector2{X: 300, Y: 300})
	players[1].SetPosition(Vector2{X: 500, Y: 500}) // Same as projectile

	hits := physics.CheckAllProjectileCollisions(projectiles, players)

	if len(hits) != 1 {
		t.Fatalf("Expected 1 hit, got %d", len(hits))
	}

	hit := hits[0]
	if hit.ProjectileID != "proj-1" {
		t.Errorf("Expected projectile ID 'proj-1', got '%s'", hit.ProjectileID)
	}
	if hit.VictimID != "player-2" {
		t.Errorf("Expected victim ID 'player-2', got '%s'", hit.VictimID)
	}
	if hit.AttackerID != "player-1" {
		t.Errorf("Expected attacker ID 'player-1', got '%s'", hit.AttackerID)
	}
}

func TestCheckAllProjectileCollisions_MultipleHits(t *testing.T) {
	physics := NewPhysics()

	// Create two projectiles
	projectiles := []*Projectile{
		{
			ID:            "proj-1",
			OwnerID:       "player-1",
			Position:      Vector2{X: 500, Y: 500},
			SpawnPosition: Vector2{X: 500, Y: 500},
			Active:        true,
		},
		{
			ID:            "proj-2",
			OwnerID:       "player-2",
			Position:      Vector2{X: 700, Y: 700},
			SpawnPosition: Vector2{X: 700, Y: 700},
			Active:        true,
		},
	}

	// Create three players
	players := []*PlayerState{
		NewPlayerState("player-1"),
		NewPlayerState("player-2"),
		NewPlayerState("player-3"),
	}
	players[0].SetPosition(Vector2{X: 700, Y: 700}) // Will be hit by proj-2
	players[1].SetPosition(Vector2{X: 300, Y: 300}) // No hits
	players[2].SetPosition(Vector2{X: 500, Y: 500}) // Will be hit by proj-1

	hits := physics.CheckAllProjectileCollisions(projectiles, players)

	if len(hits) != 2 {
		t.Fatalf("Expected 2 hits, got %d", len(hits))
	}
}

func TestCheckAllProjectileCollisions_NoHits(t *testing.T) {
	physics := NewPhysics()

	// Create projectiles and players that don't collide
	projectiles := []*Projectile{
		{
			ID:            "proj-1",
			OwnerID:       "player-1",
			Position:      Vector2{X: 100, Y: 100},
			SpawnPosition: Vector2{X: 100, Y: 100},
			Active:        true,
		},
	}

	players := []*PlayerState{
		NewPlayerState("player-1"),
		NewPlayerState("player-2"),
	}
	players[0].SetPosition(Vector2{X: 500, Y: 500})
	players[1].SetPosition(Vector2{X: 1000, Y: 1000})

	hits := physics.CheckAllProjectileCollisions(projectiles, players)

	if len(hits) != 0 {
		t.Errorf("Expected no hits, got %d", len(hits))
	}
}

func TestCheckAllProjectileCollisions_OwnerImmunity(t *testing.T) {
	physics := NewPhysics()

	// Create projectile from player-1
	projectiles := []*Projectile{
		{
			ID:            "proj-1",
			OwnerID:       "player-1",
			Position:      Vector2{X: 500, Y: 500},
			SpawnPosition: Vector2{X: 500, Y: 500},
			Active:        true,
		},
	}

	// Create players including owner at same position
	players := []*PlayerState{
		NewPlayerState("player-1"), // Owner at same position
	}
	players[0].SetPosition(Vector2{X: 500, Y: 500})

	hits := physics.CheckAllProjectileCollisions(projectiles, players)

	if len(hits) != 0 {
		t.Error("Projectile should not hit its owner")
	}
}

func TestCheckProjectilePlayerCollision_WithinMaxRange(t *testing.T) {
	physics := NewPhysics()

	// Create projectile that spawned at (100, 100) and traveled 700px (within 800px max range)
	proj := &Projectile{
		ID:            "proj-1",
		OwnerID:       "player-1",
		SpawnPosition: Vector2{X: 100, Y: 100},
		Position:      Vector2{X: 800, Y: 100}, // 700px traveled horizontally
		Active:        true,
	}

	// Create target player at projectile position (should hit - within range)
	target := NewPlayerState("player-2")
	target.SetPosition(Vector2{X: 800, Y: 100})

	result := physics.CheckProjectilePlayerCollision(proj, target)

	if !result {
		t.Error("Expected collision when projectile is within max range (700px < 800px)")
	}
}

func TestCheckProjectilePlayerCollision_ExceedsMaxRange(t *testing.T) {
	physics := NewPhysics()

	// Create projectile that spawned at (100, 100) and traveled 900px (exceeds 800px max range)
	proj := &Projectile{
		ID:            "proj-1",
		OwnerID:       "player-1",
		SpawnPosition: Vector2{X: 100, Y: 100},
		Position:      Vector2{X: 1000, Y: 100}, // 900px traveled horizontally
		Active:        true,
	}

	// Create target player at projectile position (should NOT hit - out of range)
	target := NewPlayerState("player-2")
	target.SetPosition(Vector2{X: 1000, Y: 100})

	result := physics.CheckProjectilePlayerCollision(proj, target)

	if result {
		t.Error("Expected no collision when projectile exceeds max range (900px > 800px)")
	}
}

func TestCheckProjectilePlayerCollision_ExactlyMaxRange(t *testing.T) {
	physics := NewPhysics()

	// Create projectile that traveled exactly 800px (at max range boundary)
	proj := &Projectile{
		ID:            "proj-1",
		OwnerID:       "player-1",
		SpawnPosition: Vector2{X: 100, Y: 100},
		Position:      Vector2{X: 900, Y: 100}, // exactly 800px traveled
		Active:        true,
	}

	// Create target player at projectile position (should hit - exactly at boundary)
	target := NewPlayerState("player-2")
	target.SetPosition(Vector2{X: 900, Y: 100})

	result := physics.CheckProjectilePlayerCollision(proj, target)

	if !result {
		t.Error("Expected collision when projectile is exactly at max range (800px = 800px)")
	}
}

func TestCheckProjectilePlayerCollision_DiagonalRange(t *testing.T) {
	physics := NewPhysics()

	// Create projectile that traveled diagonally ~707px (500^2 + 500^2 = 707px < 800px max)
	proj := &Projectile{
		ID:            "proj-1",
		OwnerID:       "player-1",
		SpawnPosition: Vector2{X: 100, Y: 100},
		Position:      Vector2{X: 600, Y: 600}, // sqrt(500^2 + 500^2) = ~707px
		Active:        true,
	}

	// Create target player at projectile position (should hit - diagonal within range)
	target := NewPlayerState("player-2")
	target.SetPosition(Vector2{X: 600, Y: 600})

	result := physics.CheckProjectilePlayerCollision(proj, target)

	if !result {
		t.Error("Expected collision when diagonal travel is within max range (~707px < 800px)")
	}
}
