package game

import (
	"math"
	"testing"
	"time"
)

func TestNewProjectile(t *testing.T) {
	ownerID := "player-123"
	startPos := Vector2{X: 100, Y: 200}
	aimAngle := math.Pi / 4 // 45 degrees
	speed := 800.0

	proj := NewProjectile(ownerID, startPos, aimAngle, speed)

	if proj.ID == "" {
		t.Error("projectile should have an ID")
	}

	if proj.OwnerID != ownerID {
		t.Errorf("expected owner ID '%s', got '%s'", ownerID, proj.OwnerID)
	}

	if proj.Position.X != startPos.X || proj.Position.Y != startPos.Y {
		t.Errorf("expected position %v, got %v", startPos, proj.Position)
	}

	// Verify velocity is correct based on angle and speed
	expectedVelX := math.Cos(aimAngle) * speed
	expectedVelY := math.Sin(aimAngle) * speed
	tolerance := 0.001

	if math.Abs(proj.Velocity.X-expectedVelX) > tolerance {
		t.Errorf("expected velocity X %f, got %f", expectedVelX, proj.Velocity.X)
	}

	if math.Abs(proj.Velocity.Y-expectedVelY) > tolerance {
		t.Errorf("expected velocity Y %f, got %f", expectedVelY, proj.Velocity.Y)
	}

	if proj.CreatedAt.IsZero() {
		t.Error("projectile should have creation timestamp")
	}

	if proj.Active != true {
		t.Error("projectile should be active initially")
	}
}

func TestProjectile_Update(t *testing.T) {
	startPos := Vector2{X: 100, Y: 100}
	proj := NewProjectile("player-1", startPos, 0, 800.0) // Moving right at 800 px/s

	// Update for 0.5 seconds
	deltaTime := 0.5
	proj.Update(deltaTime)

	// Should have moved 400 pixels to the right
	expectedX := startPos.X + 800.0*deltaTime
	tolerance := 0.001

	if math.Abs(proj.Position.X-expectedX) > tolerance {
		t.Errorf("expected position X %f, got %f", expectedX, proj.Position.X)
	}

	if math.Abs(proj.Position.Y-startPos.Y) > tolerance {
		t.Errorf("expected position Y to stay at %f, got %f", startPos.Y, proj.Position.Y)
	}
}

func TestProjectile_Update_DiagonalMovement(t *testing.T) {
	startPos := Vector2{X: 0, Y: 0}
	aimAngle := math.Pi / 4 // 45 degrees
	speed := 800.0
	proj := NewProjectile("player-1", startPos, aimAngle, speed)

	deltaTime := 1.0
	proj.Update(deltaTime)

	// At 45 degrees, X and Y components should be equal
	expectedComponent := math.Cos(aimAngle) * speed * deltaTime
	tolerance := 0.001

	if math.Abs(proj.Position.X-expectedComponent) > tolerance {
		t.Errorf("expected position X %f, got %f", expectedComponent, proj.Position.X)
	}

	if math.Abs(proj.Position.Y-expectedComponent) > tolerance {
		t.Errorf("expected position Y %f, got %f", expectedComponent, proj.Position.Y)
	}
}

func TestProjectile_IsExpired(t *testing.T) {
	proj := NewProjectile("player-1", Vector2{X: 0, Y: 0}, 0, 800.0)

	// Should not be expired initially
	if proj.IsExpired() {
		t.Error("projectile should not be expired immediately after creation")
	}

	// Simulate time passing (set created time in the past)
	proj.CreatedAt = time.Now().Add(-ProjectileMaxLifetime - 10*time.Millisecond)

	if !proj.IsExpired() {
		t.Error("projectile should be expired after max lifetime")
	}
}

func TestProjectile_IsOutOfBounds(t *testing.T) {
	testCases := []struct {
		name        string
		position    Vector2
		outOfBounds bool
	}{
		{"within bounds", Vector2{X: 100, Y: 100}, false},
		{"center", Vector2{X: ArenaWidth / 2, Y: ArenaHeight / 2}, false},
		{"negative X", Vector2{X: -1, Y: 100}, true},
		{"negative Y", Vector2{X: 100, Y: -1}, true},
		{"exceeds max X", Vector2{X: ArenaWidth + 1, Y: 100}, true},
		{"exceeds max Y", Vector2{X: 100, Y: ArenaHeight + 1}, true},
		{"at boundary X=0", Vector2{X: 0, Y: 100}, false},
		{"at boundary Y=0", Vector2{X: 100, Y: 0}, false},
		{"at boundary max X", Vector2{X: ArenaWidth, Y: 100}, false},
		{"at boundary max Y", Vector2{X: 100, Y: ArenaHeight}, false},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			proj := NewProjectile("player-1", tc.position, 0, 800.0)
			if proj.IsOutOfBounds() != tc.outOfBounds {
				t.Errorf("expected IsOutOfBounds=%v for position %v", tc.outOfBounds, tc.position)
			}
		})
	}
}

func TestProjectile_Deactivate(t *testing.T) {
	proj := NewProjectile("player-1", Vector2{X: 0, Y: 0}, 0, 800.0)

	if !proj.Active {
		t.Error("projectile should be active initially")
	}

	proj.Deactivate()

	if proj.Active {
		t.Error("projectile should be inactive after Deactivate")
	}
}

func TestNewProjectileManager(t *testing.T) {
	pm := NewProjectileManager()

	if pm == nil {
		t.Fatal("projectile manager should not be nil")
	}

	if len(pm.GetActiveProjectiles()) != 0 {
		t.Error("projectile manager should start with no projectiles")
	}
}

func TestProjectileManager_CreateProjectile(t *testing.T) {
	pm := NewProjectileManager()

	proj := pm.CreateProjectile("player-1", Vector2{X: 100, Y: 100}, 0, 800.0)

	if proj == nil {
		t.Fatal("created projectile should not be nil")
	}

	projectiles := pm.GetActiveProjectiles()
	if len(projectiles) != 1 {
		t.Errorf("expected 1 projectile, got %d", len(projectiles))
	}

	if projectiles[0].ID != proj.ID {
		t.Error("projectile in manager should match created projectile")
	}
}

func TestProjectileManager_Update(t *testing.T) {
	pm := NewProjectileManager()

	// Create a projectile moving right
	startPos := Vector2{X: 100, Y: 100}
	pm.CreateProjectile("player-1", startPos, 0, 800.0)

	// Update for 0.5 seconds
	pm.Update(0.5)

	projectiles := pm.GetActiveProjectiles()
	if len(projectiles) != 1 {
		t.Fatalf("expected 1 projectile, got %d", len(projectiles))
	}

	expectedX := startPos.X + 800.0*0.5
	tolerance := 0.001

	if math.Abs(projectiles[0].Position.X-expectedX) > tolerance {
		t.Errorf("expected position X %f, got %f", expectedX, projectiles[0].Position.X)
	}
}

func TestProjectileManager_RemovesExpiredProjectiles(t *testing.T) {
	pm := NewProjectileManager()

	proj := pm.CreateProjectile("player-1", Vector2{X: 100, Y: 100}, 0, 800.0)

	// Simulate expiration by setting creation time in the past
	proj.CreatedAt = time.Now().Add(-ProjectileMaxLifetime - 10*time.Millisecond)

	// Update should remove expired projectiles
	pm.Update(0.016) // One frame

	projectiles := pm.GetActiveProjectiles()
	if len(projectiles) != 0 {
		t.Errorf("expected 0 projectiles after expiration, got %d", len(projectiles))
	}
}

func TestProjectileManager_RemovesOutOfBoundsProjectiles(t *testing.T) {
	pm := NewProjectileManager()

	// Create projectile at edge moving out of bounds
	pm.CreateProjectile("player-1", Vector2{X: ArenaWidth - 10, Y: 100}, 0, 800.0)

	// Update enough time to move out of bounds (10 pixels at 800 px/s = 0.0125s)
	pm.Update(0.5) // Half second should definitely be out of bounds

	projectiles := pm.GetActiveProjectiles()
	if len(projectiles) != 0 {
		t.Errorf("expected 0 projectiles after going out of bounds, got %d", len(projectiles))
	}
}

func TestProjectileManager_RemovesDeactivatedProjectiles(t *testing.T) {
	pm := NewProjectileManager()

	proj := pm.CreateProjectile("player-1", Vector2{X: 100, Y: 100}, 0, 800.0)
	proj.Deactivate()

	pm.Update(0.016)

	projectiles := pm.GetActiveProjectiles()
	if len(projectiles) != 0 {
		t.Errorf("expected 0 projectiles after deactivation, got %d", len(projectiles))
	}
}

func TestProjectileManager_MultipleProjectiles(t *testing.T) {
	pm := NewProjectileManager()

	// Create 5 projectiles
	for i := 0; i < 5; i++ {
		pm.CreateProjectile("player-1", Vector2{X: float64(100 + i*50), Y: 100}, 0, 800.0)
	}

	projectiles := pm.GetActiveProjectiles()
	if len(projectiles) != 5 {
		t.Errorf("expected 5 projectiles, got %d", len(projectiles))
	}

	// Update
	pm.Update(0.1)

	// All should still be active
	projectiles = pm.GetActiveProjectiles()
	if len(projectiles) != 5 {
		t.Errorf("expected 5 projectiles after update, got %d", len(projectiles))
	}
}

func TestProjectileManager_GetProjectileByID(t *testing.T) {
	pm := NewProjectileManager()

	proj := pm.CreateProjectile("player-1", Vector2{X: 100, Y: 100}, 0, 800.0)

	found := pm.GetProjectileByID(proj.ID)
	if found == nil {
		t.Fatal("should find projectile by ID")
	}

	if found.ID != proj.ID {
		t.Error("found projectile ID should match")
	}

	// Non-existent ID
	notFound := pm.GetProjectileByID("non-existent")
	if notFound != nil {
		t.Error("should not find non-existent projectile")
	}
}

func TestProjectileManager_RemoveProjectile(t *testing.T) {
	pm := NewProjectileManager()

	proj := pm.CreateProjectile("player-1", Vector2{X: 100, Y: 100}, 0, 800.0)

	pm.RemoveProjectile(proj.ID)

	projectiles := pm.GetActiveProjectiles()
	if len(projectiles) != 0 {
		t.Errorf("expected 0 projectiles after removal, got %d", len(projectiles))
	}
}

func TestProjectileManager_GetProjectilesByOwner(t *testing.T) {
	pm := NewProjectileManager()

	// Create projectiles for different players
	pm.CreateProjectile("player-1", Vector2{X: 100, Y: 100}, 0, 800.0)
	pm.CreateProjectile("player-1", Vector2{X: 200, Y: 100}, 0, 800.0)
	pm.CreateProjectile("player-2", Vector2{X: 300, Y: 100}, 0, 800.0)

	player1Projs := pm.GetProjectilesByOwner("player-1")
	if len(player1Projs) != 2 {
		t.Errorf("expected 2 projectiles for player-1, got %d", len(player1Projs))
	}

	player2Projs := pm.GetProjectilesByOwner("player-2")
	if len(player2Projs) != 1 {
		t.Errorf("expected 1 projectile for player-2, got %d", len(player2Projs))
	}

	player3Projs := pm.GetProjectilesByOwner("player-3")
	if len(player3Projs) != 0 {
		t.Errorf("expected 0 projectiles for player-3, got %d", len(player3Projs))
	}
}

func TestProjectile_Snapshot(t *testing.T) {
	proj := NewProjectile("player-1", Vector2{X: 100, Y: 200}, math.Pi/4, 800.0)

	snapshot := proj.Snapshot()

	if snapshot.ID != proj.ID {
		t.Errorf("snapshot ID mismatch: expected %s, got %s", proj.ID, snapshot.ID)
	}

	if snapshot.OwnerID != proj.OwnerID {
		t.Errorf("snapshot OwnerID mismatch: expected %s, got %s", proj.OwnerID, snapshot.OwnerID)
	}

	if snapshot.Position.X != proj.Position.X || snapshot.Position.Y != proj.Position.Y {
		t.Errorf("snapshot Position mismatch: expected %v, got %v", proj.Position, snapshot.Position)
	}

	if snapshot.Velocity.X != proj.Velocity.X || snapshot.Velocity.Y != proj.Velocity.Y {
		t.Errorf("snapshot Velocity mismatch: expected %v, got %v", proj.Velocity, snapshot.Velocity)
	}
}

func TestProjectileSnapshot_ForNetworkTransmission(t *testing.T) {
	proj := NewProjectile("player-1", Vector2{X: 100, Y: 200}, 0, 800.0)

	snapshot := proj.Snapshot()

	// Verify all fields needed for network transmission are present
	if snapshot.ID == "" {
		t.Error("snapshot must have ID for network transmission")
	}

	if snapshot.OwnerID == "" {
		t.Error("snapshot must have OwnerID for network transmission")
	}
}

func TestProjectileConstants(t *testing.T) {
	// Verify projectile constants match story requirements
	expectedMaxLifetime := 1 * time.Second
	if ProjectileMaxLifetime != expectedMaxLifetime {
		t.Errorf("max lifetime should be %v, got %v", expectedMaxLifetime, ProjectileMaxLifetime)
	}
}
