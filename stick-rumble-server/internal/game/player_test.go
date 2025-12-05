package game

import (
	"sync"
	"testing"
	"time"
)

func TestNewPlayerState(t *testing.T) {
	playerID := "test-player-123"
	player := NewPlayerState(playerID)

	if player.ID != playerID {
		t.Errorf("NewPlayerState() ID = %v, want %v", player.ID, playerID)
	}

	// Should spawn at center of arena
	expectedX := ArenaWidth / 2
	expectedY := ArenaHeight / 2

	if player.Position.X != expectedX {
		t.Errorf("NewPlayerState() Position.X = %v, want %v", player.Position.X, expectedX)
	}

	if player.Position.Y != expectedY {
		t.Errorf("NewPlayerState() Position.Y = %v, want %v", player.Position.Y, expectedY)
	}

	// Should start with zero velocity
	if player.Velocity.X != 0 || player.Velocity.Y != 0 {
		t.Errorf("NewPlayerState() Velocity = {%v, %v}, want {0, 0}", player.Velocity.X, player.Velocity.Y)
	}

	// Should start with no input
	input := player.GetInput()
	if input.Up || input.Down || input.Left || input.Right {
		t.Errorf("NewPlayerState() Input should be all false, got %+v", input)
	}
}

func TestPlayerStateSetGetInput(t *testing.T) {
	player := NewPlayerState("test-player")

	input := InputState{
		Up:    true,
		Down:  false,
		Left:  true,
		Right: false,
	}

	player.SetInput(input)
	retrieved := player.GetInput()

	if retrieved != input {
		t.Errorf("SetInput/GetInput mismatch: got %+v, want %+v", retrieved, input)
	}
}

func TestPlayerStateSetGetPosition(t *testing.T) {
	player := NewPlayerState("test-player")

	newPos := Vector2{X: 100.5, Y: 200.75}
	player.SetPosition(newPos)
	retrieved := player.GetPosition()

	if retrieved != newPos {
		t.Errorf("SetPosition/GetPosition mismatch: got %+v, want %+v", retrieved, newPos)
	}
}

func TestPlayerStateSetGetVelocity(t *testing.T) {
	player := NewPlayerState("test-player")

	newVel := Vector2{X: 50.0, Y: -30.0}
	player.SetVelocity(newVel)
	retrieved := player.GetVelocity()

	if retrieved != newVel {
		t.Errorf("SetVelocity/GetVelocity mismatch: got %+v, want %+v", retrieved, newVel)
	}
}

func TestPlayerStateSnapshot(t *testing.T) {
	player := NewPlayerState("test-player")

	// Set some state
	player.SetPosition(Vector2{X: 123.45, Y: 678.90})
	player.SetVelocity(Vector2{X: 10.0, Y: 20.0})

	snapshot := player.Snapshot()

	if snapshot.ID != player.ID {
		t.Errorf("Snapshot ID = %v, want %v", snapshot.ID, player.ID)
	}

	pos := player.GetPosition()
	if snapshot.Position != pos {
		t.Errorf("Snapshot Position = %+v, want %+v", snapshot.Position, pos)
	}

	vel := player.GetVelocity()
	if snapshot.Velocity != vel {
		t.Errorf("Snapshot Velocity = %+v, want %+v", snapshot.Velocity, vel)
	}
}

func TestPlayerStateThreadSafety(t *testing.T) {
	player := NewPlayerState("test-player")
	var wg sync.WaitGroup

	// Run concurrent reads and writes
	for i := 0; i < 100; i++ {
		wg.Add(3)

		go func() {
			defer wg.Done()
			player.SetPosition(Vector2{X: 100, Y: 200})
		}()

		go func() {
			defer wg.Done()
			player.GetPosition()
		}()

		go func() {
			defer wg.Done()
			player.Snapshot()
		}()
	}

	wg.Wait()
	// If we get here without a data race, the test passes
}

func TestPlayerStateAimAngle(t *testing.T) {
	player := NewPlayerState("test-player")

	// Should start with zero aim angle
	if player.GetAimAngle() != 0 {
		t.Errorf("NewPlayerState() AimAngle = %v, want 0", player.GetAimAngle())
	}

	// Test setting and getting aim angle
	testAngle := 1.5708 // ~90 degrees in radians
	player.SetAimAngle(testAngle)

	if player.GetAimAngle() != testAngle {
		t.Errorf("SetAimAngle/GetAimAngle mismatch: got %v, want %v", player.GetAimAngle(), testAngle)
	}
}

func TestInputStateWithAimAngle(t *testing.T) {
	player := NewPlayerState("test-player")

	input := InputState{
		Up:       true,
		Down:     false,
		Left:     true,
		Right:    false,
		AimAngle: 0.7854, // ~45 degrees
	}

	player.SetInput(input)
	retrieved := player.GetInput()

	if retrieved.AimAngle != input.AimAngle {
		t.Errorf("AimAngle in InputState mismatch: got %v, want %v", retrieved.AimAngle, input.AimAngle)
	}
}

func TestPlayerStateSnapshotIncludesAimAngle(t *testing.T) {
	player := NewPlayerState("test-player")

	// Set aim angle
	testAngle := 3.14159
	player.SetAimAngle(testAngle)

	snapshot := player.Snapshot()

	if snapshot.AimAngle != testAngle {
		t.Errorf("Snapshot AimAngle = %v, want %v", snapshot.AimAngle, testAngle)
	}
}

func TestPlayerStateAimAngleThreadSafety(t *testing.T) {
	player := NewPlayerState("test-player")
	var wg sync.WaitGroup

	// Run concurrent reads and writes of aim angle
	for i := 0; i < 100; i++ {
		wg.Add(2)

		go func() {
			defer wg.Done()
			player.SetAimAngle(1.234)
		}()

		go func() {
			defer wg.Done()
			player.GetAimAngle()
		}()
	}

	wg.Wait()
	// If we get here without a data race, the test passes
}

func TestNewPlayerState_Health(t *testing.T) {
	player := NewPlayerState("test-player")

	if player.Health != PlayerMaxHealth {
		t.Errorf("NewPlayerState() Health = %v, want %v", player.Health, PlayerMaxHealth)
	}

	if !player.IsAlive() {
		t.Error("NewPlayerState() should be alive")
	}
}

func TestPlayerState_TakeDamage(t *testing.T) {
	player := NewPlayerState("test-player")

	// Take 25 damage
	player.TakeDamage(25)

	if player.Health != 75 {
		t.Errorf("Health after 25 damage = %v, want 75", player.Health)
	}

	if !player.IsAlive() {
		t.Error("Player should still be alive")
	}
}

func TestPlayerState_TakeDamage_FatalDamage(t *testing.T) {
	player := NewPlayerState("test-player")

	// Take 100 damage (should kill)
	player.TakeDamage(100)

	if player.Health != 0 {
		t.Errorf("Health after fatal damage = %v, want 0", player.Health)
	}

	if player.IsAlive() {
		t.Error("Player should be dead")
	}
}

func TestPlayerState_TakeDamage_Overkill(t *testing.T) {
	player := NewPlayerState("test-player")

	// Take 150 damage (more than max health)
	player.TakeDamage(150)

	if player.Health != 0 {
		t.Errorf("Health after overkill = %v, want 0 (should not go negative)", player.Health)
	}

	if player.IsAlive() {
		t.Error("Player should be dead")
	}
}

func TestPlayerState_TakeDamage_MultipleTimes(t *testing.T) {
	player := NewPlayerState("test-player")

	// Take 25 damage four times (4 shots from pistol = 100 damage)
	player.TakeDamage(25)
	player.TakeDamage(25)
	player.TakeDamage(25)

	if player.Health != 25 {
		t.Errorf("Health after 3 shots = %v, want 25", player.Health)
	}

	if !player.IsAlive() {
		t.Error("Player should still be alive")
	}

	// Fourth shot kills
	player.TakeDamage(25)

	if player.Health != 0 {
		t.Errorf("Health after 4 shots = %v, want 0", player.Health)
	}

	if player.IsAlive() {
		t.Error("Player should be dead after 4 shots")
	}
}

func TestPlayerState_IsAlive_EdgeCase(t *testing.T) {
	player := NewPlayerState("test-player")

	// Reduce health to 1 HP
	player.TakeDamage(99)

	if player.Health != 1 {
		t.Errorf("Health = %v, want 1", player.Health)
	}

	if !player.IsAlive() {
		t.Error("Player with 1 HP should be alive")
	}

	// One more damage point kills
	player.TakeDamage(1)

	if player.IsAlive() {
		t.Error("Player with 0 HP should be dead")
	}
}

func TestPlayerState_HealthThreadSafety(t *testing.T) {
	player := NewPlayerState("test-player")
	var wg sync.WaitGroup

	// Run concurrent damage and alive checks
	for i := 0; i < 50; i++ {
		wg.Add(2)

		go func() {
			defer wg.Done()
			player.TakeDamage(1)
		}()

		go func() {
			defer wg.Done()
			player.IsAlive()
		}()
	}

	wg.Wait()
	// If we get here without a data race, the test passes
	// Player should have taken 50 damage
	if player.Health != 50 {
		t.Errorf("Health after 50 concurrent damage calls = %v, want 50", player.Health)
	}
}

func TestPlayerState_Snapshot_IncludesHealth(t *testing.T) {
	player := NewPlayerState("test-player")
	player.TakeDamage(30)

	snapshot := player.Snapshot()

	if snapshot.Health != 70 {
		t.Errorf("Snapshot Health = %v, want 70", snapshot.Health)
	}
}

// Respawn System Tests

func TestPlayerState_MarkDead(t *testing.T) {
	player := NewPlayerState("test-player")

	// Player starts alive
	if player.IsDead() {
		t.Error("New player should not be dead")
	}

	// Mark as dead
	player.MarkDead()

	// Verify death state
	if !player.IsDead() {
		t.Error("Player should be dead after MarkDead()")
	}

	if player.Health != 0 {
		t.Errorf("Health after MarkDead() = %v, want 0", player.Health)
	}

	if player.DeathTime == nil {
		t.Error("DeathTime should be set after MarkDead()")
	}
}

func TestPlayerState_CanRespawn_NotDead(t *testing.T) {
	player := NewPlayerState("test-player")

	// Living players cannot respawn
	if player.CanRespawn() {
		t.Error("Living player should not be able to respawn")
	}
}

func TestPlayerState_CanRespawn_TooSoon(t *testing.T) {
	player := NewPlayerState("test-player")
	player.MarkDead()

	// Immediately after death, should not be able to respawn
	if player.CanRespawn() {
		t.Error("Should not be able to respawn immediately after death")
	}

	// After 1 second (less than RespawnDelay), still cannot respawn
	time.Sleep(1 * time.Second)
	if player.CanRespawn() {
		t.Error("Should not be able to respawn before RespawnDelay")
	}
}

func TestPlayerState_CanRespawn_AfterDelay(t *testing.T) {
	player := NewPlayerState("test-player")
	player.MarkDead()

	// Wait for respawn delay
	time.Sleep(time.Duration(RespawnDelay*float64(time.Second)) + 100*time.Millisecond)

	// Should be able to respawn now
	if !player.CanRespawn() {
		t.Error("Should be able to respawn after RespawnDelay")
	}
}

func TestPlayerState_Respawn(t *testing.T) {
	player := NewPlayerState("test-player")

	// Kill player
	player.TakeDamage(100)
	player.MarkDead()

	// Respawn at a new position
	spawnPos := Vector2{X: 500, Y: 300}
	player.Respawn(spawnPos)

	// Verify respawn state
	if player.IsDead() {
		t.Error("Player should not be dead after respawn")
	}

	if player.Health != PlayerMaxHealth {
		t.Errorf("Health after respawn = %v, want %v", player.Health, PlayerMaxHealth)
	}

	if player.GetPosition() != spawnPos {
		t.Errorf("Position after respawn = %+v, want %+v", player.GetPosition(), spawnPos)
	}

	vel := player.GetVelocity()
	if vel.X != 0 || vel.Y != 0 {
		t.Errorf("Velocity after respawn = %+v, want {0, 0}", vel)
	}

	if player.DeathTime != nil {
		t.Error("DeathTime should be nil after respawn")
	}

	if !player.IsInvulnerable {
		t.Error("Player should be invulnerable after respawn")
	}
}

func TestPlayerState_SpawnInvulnerability(t *testing.T) {
	player := NewPlayerState("test-player")
	player.MarkDead()

	spawnPos := Vector2{X: 500, Y: 300}
	player.Respawn(spawnPos)

	// Should be invulnerable immediately after respawn
	if !player.IsInvulnerable {
		t.Error("Player should be invulnerable immediately after respawn")
	}

	// Check that invulnerability end time is set correctly
	expectedEnd := time.Now().Add(time.Duration(SpawnInvulnerabilityDuration * float64(time.Second)))
	diff := player.InvulnerabilityEndTime.Sub(expectedEnd).Abs()
	if diff > 100*time.Millisecond {
		t.Errorf("InvulnerabilityEndTime differs by %v, expected ~%v", diff, expectedEnd)
	}
}

func TestPlayerState_UpdateInvulnerability_StillActive(t *testing.T) {
	player := NewPlayerState("test-player")
	player.MarkDead()
	player.Respawn(Vector2{X: 500, Y: 300})

	// Update immediately - should still be invulnerable
	player.UpdateInvulnerability()

	if !player.IsInvulnerable {
		t.Error("Player should still be invulnerable immediately after respawn")
	}
}

func TestPlayerState_UpdateInvulnerability_Expired(t *testing.T) {
	player := NewPlayerState("test-player")
	player.MarkDead()
	player.Respawn(Vector2{X: 500, Y: 300})

	// Manually set invulnerability end time to past
	player.InvulnerabilityEndTime = time.Now().Add(-1 * time.Second)

	// Update - should remove invulnerability
	player.UpdateInvulnerability()

	if player.IsInvulnerable {
		t.Error("Player should not be invulnerable after expiration")
	}
}

func TestPlayerState_RespawnThreadSafety(t *testing.T) {
	player := NewPlayerState("test-player")
	player.MarkDead()

	var wg sync.WaitGroup

	// Concurrent respawns and checks
	for i := 0; i < 50; i++ {
		wg.Add(3)

		go func() {
			defer wg.Done()
			player.Respawn(Vector2{X: 100, Y: 200})
		}()

		go func() {
			defer wg.Done()
			player.IsDead()
		}()

		go func() {
			defer wg.Done()
			player.UpdateInvulnerability()
		}()
	}

	wg.Wait()
	// If we get here without a data race, the test passes
}

func TestPlayerState_Snapshot_IncludesRespawnFields(t *testing.T) {
	player := NewPlayerState("test-player")
	player.MarkDead()

	snapshot1 := player.Snapshot()

	if snapshot1.DeathTime == nil {
		t.Error("Snapshot should include DeathTime when dead")
	}

	// Respawn and snapshot again
	player.Respawn(Vector2{X: 500, Y: 300})
	snapshot2 := player.Snapshot()

	if snapshot2.DeathTime != nil {
		t.Error("Snapshot should have nil DeathTime after respawn")
	}

	if !snapshot2.IsInvulnerable {
		t.Error("Snapshot should show invulnerability after respawn")
	}
}

// Kill/Death Stats Tests

func TestPlayerState_NewPlayer_StatsInitialized(t *testing.T) {
	player := NewPlayerState("test-player")

	if player.Kills != 0 {
		t.Errorf("New player Kills = %v, want 0", player.Kills)
	}

	if player.Deaths != 0 {
		t.Errorf("New player Deaths = %v, want 0", player.Deaths)
	}

	if player.XP != 0 {
		t.Errorf("New player XP = %v, want 0", player.XP)
	}
}

func TestPlayerState_IncrementKills(t *testing.T) {
	player := NewPlayerState("test-player")

	player.IncrementKills()

	if player.Kills != 1 {
		t.Errorf("Kills after increment = %v, want 1", player.Kills)
	}

	// Increment again
	player.IncrementKills()

	if player.Kills != 2 {
		t.Errorf("Kills after second increment = %v, want 2", player.Kills)
	}
}

func TestPlayerState_IncrementDeaths(t *testing.T) {
	player := NewPlayerState("test-player")

	player.IncrementDeaths()

	if player.Deaths != 1 {
		t.Errorf("Deaths after increment = %v, want 1", player.Deaths)
	}

	// Increment again
	player.IncrementDeaths()

	if player.Deaths != 2 {
		t.Errorf("Deaths after second increment = %v, want 2", player.Deaths)
	}
}

func TestPlayerState_AddXP(t *testing.T) {
	player := NewPlayerState("test-player")

	// Add kill XP (100 points)
	player.AddXP(100)

	if player.XP != 100 {
		t.Errorf("XP after adding 100 = %v, want 100", player.XP)
	}

	// Add more XP
	player.AddXP(250)

	if player.XP != 350 {
		t.Errorf("XP after adding 250 more = %v, want 350", player.XP)
	}
}

func TestPlayerState_StatsThreadSafety(t *testing.T) {
	player := NewPlayerState("test-player")
	var wg sync.WaitGroup

	// Run concurrent stat updates
	for i := 0; i < 100; i++ {
		wg.Add(3)

		go func() {
			defer wg.Done()
			player.IncrementKills()
		}()

		go func() {
			defer wg.Done()
			player.IncrementDeaths()
		}()

		go func() {
			defer wg.Done()
			player.AddXP(10)
		}()
	}

	wg.Wait()

	// Verify all concurrent updates were applied
	if player.Kills != 100 {
		t.Errorf("Kills after concurrent updates = %v, want 100", player.Kills)
	}

	if player.Deaths != 100 {
		t.Errorf("Deaths after concurrent updates = %v, want 100", player.Deaths)
	}

	if player.XP != 1000 {
		t.Errorf("XP after concurrent updates = %v, want 1000", player.XP)
	}
}

func TestPlayerState_Snapshot_IncludesStats(t *testing.T) {
	player := NewPlayerState("test-player")

	// Set up some stats
	player.IncrementKills()
	player.IncrementKills()
	player.IncrementDeaths()
	player.AddXP(200)

	snapshot := player.Snapshot()

	if snapshot.Kills != 2 {
		t.Errorf("Snapshot Kills = %v, want 2", snapshot.Kills)
	}

	if snapshot.Deaths != 1 {
		t.Errorf("Snapshot Deaths = %v, want 1", snapshot.Deaths)
	}

	if snapshot.XP != 200 {
		t.Errorf("Snapshot XP = %v, want 200", snapshot.XP)
	}
}

func TestPlayerState_GetKDRatio(t *testing.T) {
	player := NewPlayerState("test-player")

	// Test with no deaths (avoid division by zero)
	player.IncrementKills()
	player.IncrementKills()

	ratio := player.GetKDRatio()
	if ratio != 2.0 {
		t.Errorf("K/D ratio with 2 kills, 0 deaths = %v, want 2.0", ratio)
	}

	// Test with deaths
	player.IncrementDeaths()

	ratio = player.GetKDRatio()
	if ratio != 2.0 {
		t.Errorf("K/D ratio with 2 kills, 1 death = %v, want 2.0", ratio)
	}

	// Test with more deaths than kills
	player.IncrementDeaths()
	player.IncrementDeaths()

	ratio = player.GetKDRatio()
	expected := 2.0 / 3.0
	if ratio != expected {
		t.Errorf("K/D ratio with 2 kills, 3 deaths = %v, want %v", ratio, expected)
	}

	// Test with no kills or deaths
	newPlayer := NewPlayerState("new-player")
	ratio = newPlayer.GetKDRatio()
	if ratio != 0.0 {
		t.Errorf("K/D ratio with 0 kills, 0 deaths = %v, want 0.0", ratio)
	}
}
