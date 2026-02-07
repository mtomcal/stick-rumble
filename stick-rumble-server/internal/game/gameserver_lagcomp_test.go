package game

import (
	"testing"
	"time"
)

// TestHitscanWeapon_LagCompensation tests that hitscan weapons use lag compensation
func TestHitscanWeapon_LagCompensation(t *testing.T) {
	clock := NewManualClock(time.Now())
	gs := NewGameServerWithClock(nil, clock)

	shooterID := "shooter"
	victimID := "victim"

	// Add players
	gs.AddPlayer(shooterID)
	gs.AddPlayer(victimID)

	// Create hitscan weapon
	pistol := NewPistol()
	pistol.IsHitscan = true
	gs.SetWeaponState(shooterID, NewWeaponState(pistol))

	// Position shooter at (100, 100)
	shooter, _ := gs.world.GetPlayer(shooterID)
	shooter.SetPosition(Vector2{X: 100, Y: 100})

	// Position victim at (200, 100) - directly to the right
	victim, _ := gs.world.GetPlayer(victimID)
	victim.SetPosition(Vector2{X: 200, Y: 100})

	// Record position history snapshot
	gs.recordPositionSnapshots(clock.Now())

	// Simulate 50ms of time passing and victim moving
	clock.Advance(50 * time.Millisecond)
	victim.SetPosition(Vector2{X: 300, Y: 100}) // Victim moved

	// Mock getRTT callback to return 50ms RTT
	gs.SetGetRTT(func(playerID string) int64 {
		return 50 // 50ms RTT
	})

	// Shooter aims right (0 degrees) and shoots
	// With lag comp, should hit victim at OLD position (200, 100), not new (300, 100)
	result := gs.PlayerShoot(shooterID, 0, clock.Now().UnixMilli())

	if !result.Success {
		t.Fatalf("Hitscan shot should succeed, got: %v", result.Reason)
	}

	// Check victim took damage (hit at rewound position)
	// Pistol does 25 damage, so health should be 100 - 25 = 75
	expectedHealth := 100 - PistolDamage
	if victim.Health != expectedHealth {
		t.Errorf("Victim should have health %d after taking Pistol damage, got %d", expectedHealth, victim.Health)
	}
}

// TestHitscanWeapon_MaxRewindClamp tests that rewind time is clamped to 150ms
func TestHitscanWeapon_MaxRewindClamp(t *testing.T) {
	clock := NewManualClock(time.Now())
	gs := NewGameServerWithClock(nil, clock)

	shooterID := "shooter"
	victimID := "victim"

	gs.AddPlayer(shooterID)
	gs.AddPlayer(victimID)

	// Create hitscan weapon
	pistol := NewPistol()
	pistol.IsHitscan = true
	gs.SetWeaponState(shooterID, NewWeaponState(pistol))

	// Position players
	shooter, _ := gs.world.GetPlayer(shooterID)
	shooter.SetPosition(Vector2{X: 100, Y: 100})

	victim, _ := gs.world.GetPlayer(victimID)
	victim.SetPosition(Vector2{X: 200, Y: 100})

	// Record initial position
	gs.recordPositionSnapshots(clock.Now())

	// Move victim far away after 200ms
	clock.Advance(200 * time.Millisecond)
	victim.SetPosition(Vector2{X: 1000, Y: 100}) // Moved far out of range

	// Mock getRTT callback to return 300ms RTT (exceeds 150ms max)
	gs.SetGetRTT(func(playerID string) int64 {
		return 300 // High latency - would rewind 300ms but should clamp to 150ms
	})

	// Shoot should miss because:
	// - 300ms RTT would rewind to initial position (200, 100) = HIT
	// - But clamped to 150ms, rewinds only to time=50ms, victim already moved = MISS
	result := gs.PlayerShoot(shooterID, 0, clock.Now().UnixMilli())

	if !result.Success {
		t.Fatalf("Hitscan shot should succeed (fire weapon), got: %v", result.Reason)
	}

	// Victim should NOT take damage (rewind was clamped, victim out of range at 150ms ago)
	if victim.Health != 100 {
		t.Errorf("Victim should not take damage when rewind is clamped and out of range, health=%d", victim.Health)
	}
}

// TestProjectileWeapon_NoLagCompensation tests that projectile weapons don't use lag comp
func TestProjectileWeapon_NoLagCompensation(t *testing.T) {
	clock := NewManualClock(time.Now())
	gs := NewGameServerWithClock(nil, clock)

	shooterID := "shooter"

	gs.AddPlayer(shooterID)

	// Create projectile weapon (Uzi)
	uzi := &Weapon{
		Name:            "Uzi",
		Damage:          8,
		FireRate:        10,
		MagazineSize:    30,
		ProjectileSpeed: 800,
		Range:           600,
		IsHitscan:       false, // Projectile weapon
	}
	gs.SetWeaponState(shooterID, NewWeaponState(uzi))

	// Mock getRTT callback
	gs.SetGetRTT(func(playerID string) int64 {
		return 50
	})

	// Shoot
	result := gs.PlayerShoot(shooterID, 0, clock.Now().UnixMilli())

	if !result.Success {
		t.Fatalf("Projectile shot should succeed, got: %v", result.Reason)
	}

	// Should create a projectile (not instant hit)
	if result.Projectile == nil {
		t.Error("Projectile weapon should create a projectile")
	}

	// Verify projectile exists in manager
	projectiles := gs.GetActiveProjectiles()
	if len(projectiles) != 1 {
		t.Errorf("Expected 1 projectile, got %d", len(projectiles))
	}
}

// TestRaycastHit_DirectHit tests raycast hitting target dead center
func TestRaycastHit_DirectHit(t *testing.T) {
	gs := NewGameServer(nil)

	origin := Vector2{X: 0, Y: 0}
	targetPos := Vector2{X: 100, Y: 0}
	aimAngle := 0.0 // Aiming right

	hit := gs.raycastHit(origin, aimAngle, 200, targetPos, 16)

	if !hit {
		t.Error("Raycast should hit target directly in front")
	}
}

// TestRaycastHit_EdgeHit tests raycast hitting edge of circular hitbox
func TestRaycastHit_EdgeHit(t *testing.T) {
	gs := NewGameServer(nil)

	origin := Vector2{X: 0, Y: 0}
	targetPos := Vector2{X: 100, Y: 15} // Just within 16px radius
	aimAngle := 0.0                     // Aiming right

	hit := gs.raycastHit(origin, aimAngle, 200, targetPos, 16)

	if !hit {
		t.Error("Raycast should hit target at edge of hitbox")
	}
}

// TestRaycastHit_Miss tests raycast missing target
func TestRaycastHit_Miss(t *testing.T) {
	gs := NewGameServer(nil)

	origin := Vector2{X: 0, Y: 0}
	targetPos := Vector2{X: 100, Y: 20} // Outside 16px radius
	aimAngle := 0.0                     // Aiming right

	hit := gs.raycastHit(origin, aimAngle, 200, targetPos, 16)

	if hit {
		t.Error("Raycast should miss target outside hitbox")
	}
}

// TestRaycastHit_BehindRay tests that targets behind the ray are not hit
func TestRaycastHit_BehindRay(t *testing.T) {
	gs := NewGameServer(nil)

	origin := Vector2{X: 100, Y: 0}
	targetPos := Vector2{X: 0, Y: 0} // Behind the ray
	aimAngle := 0.0                  // Aiming right

	hit := gs.raycastHit(origin, aimAngle, 200, targetPos, 16)

	if hit {
		t.Error("Raycast should not hit target behind the ray")
	}
}

// TestRaycastHit_OutOfRange tests that targets beyond range are not hit
func TestRaycastHit_OutOfRange(t *testing.T) {
	gs := NewGameServer(nil)

	origin := Vector2{X: 0, Y: 0}
	targetPos := Vector2{X: 300, Y: 0} // Beyond 200px range
	aimAngle := 0.0                    // Aiming right

	hit := gs.raycastHit(origin, aimAngle, 200, targetPos, 16)

	if hit {
		t.Error("Raycast should not hit target beyond weapon range")
	}
}

// TestHitscanShoot_SkipsDeadPlayers tests that hitscan doesn't hit dead players
func TestHitscanShoot_SkipsDeadPlayers(t *testing.T) {
	clock := NewManualClock(time.Now())
	gs := NewGameServerWithClock(nil, clock)

	shooterID := "shooter"
	deadVictimID := "dead-victim"

	gs.AddPlayer(shooterID)
	gs.AddPlayer(deadVictimID)

	// Create hitscan weapon
	pistol := NewPistol()
	pistol.IsHitscan = true
	gs.SetWeaponState(shooterID, NewWeaponState(pistol))

	// Position players
	shooter, _ := gs.world.GetPlayer(shooterID)
	shooter.SetPosition(Vector2{X: 100, Y: 100})

	deadVictim, _ := gs.world.GetPlayer(deadVictimID)
	deadVictim.SetPosition(Vector2{X: 200, Y: 100})
	deadVictim.MarkDead() // Kill the victim

	// Shoot - should not hit dead player
	initialHealth := deadVictim.Health
	gs.PlayerShoot(shooterID, 0, clock.Now().UnixMilli())

	if deadVictim.Health != initialHealth {
		t.Error("Hitscan should not damage dead players")
	}
}

// TestHitscanShoot_SkipsShooter tests that hitscan doesn't hit the shooter
func TestHitscanShoot_SkipsShooter(t *testing.T) {
	clock := NewManualClock(time.Now())
	gs := NewGameServerWithClock(nil, clock)

	shooterID := "shooter"

	gs.AddPlayer(shooterID)

	// Create hitscan weapon
	pistol := NewPistol()
	pistol.IsHitscan = true
	gs.SetWeaponState(shooterID, NewWeaponState(pistol))

	shooter, _ := gs.world.GetPlayer(shooterID)
	shooter.SetPosition(Vector2{X: 100, Y: 100})

	initialHealth := shooter.Health

	// Shoot - should not hit self
	gs.PlayerShoot(shooterID, 0, clock.Now().UnixMilli())

	if shooter.Health != initialHealth {
		t.Error("Hitscan should not damage the shooter")
	}
}

// TestHitscanShoot_ClosestHit tests that closest victim is hit when multiple targets are in line
func TestHitscanShoot_ClosestHit(t *testing.T) {
	clock := NewManualClock(time.Now())
	gs := NewGameServerWithClock(nil, clock)

	shooterID := "shooter"
	nearVictimID := "near-victim"
	farVictimID := "far-victim"

	gs.AddPlayer(shooterID)
	gs.AddPlayer(nearVictimID)
	gs.AddPlayer(farVictimID)

	// Create hitscan weapon
	pistol := NewPistol()
	pistol.IsHitscan = true
	gs.SetWeaponState(shooterID, NewWeaponState(pistol))

	shooter, _ := gs.world.GetPlayer(shooterID)
	shooter.SetPosition(Vector2{X: 0, Y: 0})

	nearVictim, _ := gs.world.GetPlayer(nearVictimID)
	nearVictim.SetPosition(Vector2{X: 100, Y: 0}) // Closer

	farVictim, _ := gs.world.GetPlayer(farVictimID)
	farVictim.SetPosition(Vector2{X: 200, Y: 0}) // Farther

	nearInitialHealth := nearVictim.Health
	farInitialHealth := farVictim.Health

	// Shoot - should hit nearest target
	gs.PlayerShoot(shooterID, 0, clock.Now().UnixMilli())

	// Near victim should be hit
	if nearVictim.Health >= nearInitialHealth {
		t.Error("Near victim should have been hit")
	}

	// Far victim should NOT be hit (bullet stopped at first target)
	if farVictim.Health != farInitialHealth {
		t.Error("Far victim should not be hit (closest target takes the hit)")
	}
}

// TestHitscanShoot_NoPositionHistory tests fallback to current position when no history available
func TestHitscanShoot_NoPositionHistory(t *testing.T) {
	clock := NewManualClock(time.Now())
	gs := NewGameServerWithClock(nil, clock)

	shooterID := "shooter"
	victimID := "victim"

	// Add players
	gs.AddPlayer(shooterID)
	gs.AddPlayer(victimID)

	// Create hitscan weapon
	pistol := NewPistol()
	pistol.IsHitscan = true
	gs.SetWeaponState(shooterID, NewWeaponState(pistol))

	// Position players
	shooter, _ := gs.world.GetPlayer(shooterID)
	shooter.SetPosition(Vector2{X: 100, Y: 100})

	victim, _ := gs.world.GetPlayer(victimID)
	victim.SetPosition(Vector2{X: 200, Y: 100})

	// DO NOT record position history - shoot immediately after player added
	// This tests the fallback to current position when no history exists

	// Mock getRTT to return 50ms
	gs.SetGetRTT(func(playerID string) int64 {
		return 50
	})

	// Shoot - should use current position as fallback
	result := gs.PlayerShoot(shooterID, 0, clock.Now().UnixMilli())

	if !result.Success {
		t.Fatalf("Hitscan shot should succeed with position history fallback, got: %v", result.Reason)
	}

	// Victim should take damage (hit at current position since no history)
	expectedHealth := 100 - PistolDamage
	if victim.Health != expectedHealth {
		t.Errorf("Victim should have health %d after hit (fallback to current pos), got %d", expectedHealth, victim.Health)
	}
}
