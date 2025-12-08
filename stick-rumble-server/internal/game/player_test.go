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

// Health Regeneration Tests

func TestPlayerState_RegenerationDelay(t *testing.T) {
	player := NewPlayerState("test-player")

	// Take damage to trigger regeneration timer
	player.TakeDamage(60)

	if player.Health != 40 {
		t.Errorf("Health after damage = %v, want 40", player.Health)
	}

	// Immediately after damage, should not be regenerating
	if player.IsRegenerating() {
		t.Error("Player should not be regenerating immediately after damage")
	}

	// After 4.9 seconds, still should not be regenerating (delay is 5 seconds)
	now := time.Now()
	canRegen := player.CanRegenerate(now.Add(4900 * time.Millisecond))
	if canRegen {
		t.Error("Player should not regenerate before 5 second delay")
	}

	// After 5 seconds, should be able to regenerate
	canRegen = player.CanRegenerate(now.Add(5000 * time.Millisecond))
	if !canRegen {
		t.Error("Player should be able to regenerate after 5 second delay")
	}
}

func TestPlayerState_RegenerationRate(t *testing.T) {
	player := NewPlayerState("test-player")

	// Take damage to set health to 40
	player.TakeDamage(60)

	// Simulate 5 seconds passing (to bypass delay)
	now := time.Now().Add(6 * time.Second)

	// Apply regeneration for 1 second (10 HP/s rate)
	deltaTime := 1.0 // 1 second
	player.ApplyRegeneration(now, deltaTime)

	if player.Health != 50 {
		t.Errorf("Health after 1 second regeneration = %v, want 50 (40 + 10)", player.Health)
	}

	// Apply regeneration for another 0.5 seconds (5 more HP)
	now = now.Add(500 * time.Millisecond)
	deltaTime = 0.5
	player.ApplyRegeneration(now, deltaTime)

	if player.Health != 55 {
		t.Errorf("Health after 0.5 second regeneration = %v, want 55 (50 + 5)", player.Health)
	}
}

func TestPlayerState_RegenerationRate_SmallDeltaTime(t *testing.T) {
	player := NewPlayerState("test-player")

	// Take damage to set health to 50
	player.TakeDamage(50)

	// Simulate 5 seconds passing (to bypass delay)
	now := time.Now().Add(6 * time.Second)

	// Apply regeneration with very small deltaTime (simulating 60Hz tick rate)
	// At 60Hz, deltaTime ≈ 0.01667 seconds
	// 10 HP/s * 0.01667s = 0.1667 HP (rounds to 0, but minimum is 1 HP)
	deltaTime := 1.0 / 60.0 // 0.01667 seconds (60Hz tick rate)
	player.ApplyRegeneration(now, deltaTime)

	// Should regenerate at least 1 HP even with small deltaTime
	if player.Health != 51 {
		t.Errorf("Health after small deltaTime regeneration = %v, want 51 (50 + 1 minimum)", player.Health)
	}

	// Apply regeneration multiple times to verify consistent 1 HP per tick
	for i := 0; i < 9; i++ {
		now = now.Add(time.Duration(deltaTime * float64(time.Second)))
		player.ApplyRegeneration(now, deltaTime)
	}

	// After 10 ticks at 60Hz, should have regenerated 10 HP (1 HP per tick)
	if player.Health != 60 {
		t.Errorf("Health after 10 ticks at 60Hz = %v, want 60 (50 + 10)", player.Health)
	}
}

func TestPlayerState_RegenerationStopsAtMaxHealth(t *testing.T) {
	player := NewPlayerState("test-player")

	// Take minimal damage
	player.TakeDamage(5)

	if player.Health != 95 {
		t.Errorf("Health after damage = %v, want 95", player.Health)
	}

	// Simulate 5 seconds passing
	now := time.Now().Add(6 * time.Second)

	// Apply regeneration for 1 second (would be +10 HP, but should cap at 100)
	deltaTime := 1.0
	player.ApplyRegeneration(now, deltaTime)

	if player.Health != 100 {
		t.Errorf("Health after regeneration = %v, want 100 (capped at max)", player.Health)
	}

	// After reaching max health, IsRegeneratingHealth should be false
	if player.IsRegeneratingHealth {
		t.Error("IsRegeneratingHealth should be false after reaching max health")
	}

	// Further regeneration should not increase health beyond 100
	now = now.Add(1 * time.Second)
	player.ApplyRegeneration(now, deltaTime)

	if player.Health != 100 {
		t.Errorf("Health should remain at max = %v, want 100", player.Health)
	}

	// IsRegeneratingHealth should still be false
	if player.IsRegeneratingHealth {
		t.Error("IsRegeneratingHealth should remain false at max health")
	}
}

func TestPlayerState_DamageResetsRegenerationTimer(t *testing.T) {
	player := NewPlayerState("test-player")

	// Take damage
	player.TakeDamage(60)

	// Record when damage was taken
	firstDamageTime := player.GetLastDamageTime()

	// Wait 3 seconds
	time.Sleep(3 * time.Second)

	// Take damage again (this should reset the timer)
	player.TakeDamage(10)

	secondDamageTime := player.GetLastDamageTime()

	// The second damage time should be significantly later
	if !secondDamageTime.After(firstDamageTime) {
		t.Error("Taking damage should update lastDamageTime")
	}

	// Should not be able to regenerate yet (timer was reset)
	now := time.Now()
	if player.CanRegenerate(now) {
		t.Error("Player should not be able to regenerate immediately after taking damage")
	}

	// After 5 more seconds from second damage, should be able to regenerate
	if !player.CanRegenerate(now.Add(5 * time.Second)) {
		t.Error("Player should be able to regenerate 5 seconds after last damage")
	}
}

func TestPlayerState_NoRegenerationAtFullHealth(t *testing.T) {
	player := NewPlayerState("test-player")

	// Player starts at full health (100 HP)
	if player.Health != 100 {
		t.Errorf("Player should start at full health, got %v", player.Health)
	}

	// Should not be able to regenerate at full health
	now := time.Now().Add(10 * time.Second)
	canRegen := player.CanRegenerate(now)

	if canRegen {
		t.Error("Player at full health should not be able to regenerate")
	}
}

func TestPlayerState_RegenerationWhileDead(t *testing.T) {
	player := NewPlayerState("test-player")

	// Take damage and then die
	player.TakeDamage(60)
	player.TakeDamage(40)
	player.MarkDead()

	// Try to regenerate after delay
	now := time.Now().Add(10 * time.Second)

	// Dead players should not regenerate
	canRegen := player.CanRegenerate(now)
	if canRegen {
		t.Error("Dead players should not be able to regenerate")
	}
}

func TestPlayerState_RegenerationWhileInvulnerable(t *testing.T) {
	player := NewPlayerState("test-player")

	// Simulate respawn with invulnerability
	player.MarkDead()
	player.Respawn(Vector2{X: 500, Y: 300})

	// Take damage (but player is invulnerable, so damage shouldn't apply in real game)
	// For this test, manually reduce health to simulate what would happen if invuln didn't block damage
	player.Health = 40

	// Even if invulnerable, regeneration timer logic should still work
	now := time.Now().Add(6 * time.Second)

	// Should be able to regenerate (regeneration is independent of invulnerability)
	deltaTime := 1.0
	player.ApplyRegeneration(now, deltaTime)

	if player.Health != 50 {
		t.Errorf("Health after regeneration = %v, want 50", player.Health)
	}
}

func TestPlayerState_IsRegenerating(t *testing.T) {
	player := NewPlayerState("test-player")

	// Take damage
	player.TakeDamage(60)

	// Should not be regenerating immediately
	now := time.Now()
	player.UpdateRegenerationState(now)

	if player.IsRegenerating() {
		t.Error("Should not be regenerating immediately after damage")
	}

	// After 5 seconds, should be regenerating
	now = now.Add(6 * time.Second)
	player.UpdateRegenerationState(now)

	if !player.IsRegenerating() {
		t.Error("Should be regenerating after 5 second delay with health < 100")
	}

	// Apply regeneration until full health
	for i := 0; i < 10; i++ {
		player.ApplyRegeneration(now, 1.0)
		now = now.Add(1 * time.Second)
	}

	// Should not be regenerating at full health
	player.UpdateRegenerationState(now)
	if player.IsRegenerating() {
		t.Error("Should not be regenerating at full health")
	}
}

func TestPlayerState_RegenerationThreadSafety(t *testing.T) {
	player := NewPlayerState("test-player")
	player.TakeDamage(60)

	var wg sync.WaitGroup
	now := time.Now().Add(6 * time.Second)

	// Concurrent regeneration operations
	for i := 0; i < 50; i++ {
		wg.Add(4)

		go func() {
			defer wg.Done()
			player.ApplyRegeneration(now, 0.1)
		}()

		go func() {
			defer wg.Done()
			player.CanRegenerate(now)
		}()

		go func() {
			defer wg.Done()
			player.IsRegenerating()
		}()

		go func() {
			defer wg.Done()
			player.GetLastDamageTime()
		}()
	}

	wg.Wait()
	// If we get here without a data race, the test passes
}

func TestPlayerState_Snapshot_IncludesRegenerationFields(t *testing.T) {
	player := NewPlayerState("test-player")

	// Take damage to trigger regeneration
	player.TakeDamage(60)

	// Update regeneration state
	now := time.Now().Add(6 * time.Second)
	player.UpdateRegenerationState(now)

	snapshot := player.Snapshot()

	// Snapshot should include IsRegeneratingHealth field
	// Note: lastDamageTime is not included in snapshot as it's server-only logic
	if !snapshot.IsRegeneratingHealth {
		t.Error("Snapshot should show regenerating state")
	}
}

// Bug fix: Test that new players don't immediately regenerate
func TestPlayerState_NewPlayer_NoRegenerationInitially(t *testing.T) {
	player := NewPlayerState("test-player")

	// New player at full health should not be able to regenerate
	now := time.Now()
	canRegen := player.CanRegenerate(now)

	if canRegen {
		t.Error("New player at full health should not be able to regenerate immediately")
	}

	// Even after 10 seconds, should not regenerate (at full health)
	canRegen = player.CanRegenerate(now.Add(10 * time.Second))
	if canRegen {
		t.Error("New player at full health should not be able to regenerate even after delay")
	}
}

// Bug fix: Test that players at full health never regenerate regardless of lastDamageTime
func TestPlayerState_FullHealth_NeverRegenerates(t *testing.T) {
	player := NewPlayerState("test-player")

	// Verify player is at full health
	if player.Health != PlayerMaxHealth {
		t.Fatalf("Expected full health (%d), got %d", PlayerMaxHealth, player.Health)
	}

	// Test at various time offsets
	baseTime := time.Now()
	testTimes := []time.Duration{
		0 * time.Second,
		5 * time.Second,
		10 * time.Second,
		100 * time.Second,
	}

	for _, offset := range testTimes {
		testTime := baseTime.Add(offset)
		canRegen := player.CanRegenerate(testTime)
		if canRegen {
			t.Errorf("Player at full health should not regenerate at time offset %v", offset)
		}

		// Also verify UpdateRegenerationState sets flag correctly
		player.UpdateRegenerationState(testTime)
		if player.IsRegenerating() {
			t.Errorf("IsRegenerating should be false at full health (time offset %v)", offset)
		}
	}
}

// Bug fix: Test that lastDamageTime is properly initialized
func TestPlayerState_LastDamageTime_Initialized(t *testing.T) {
	player := NewPlayerState("test-player")

	lastDamageTime := player.GetLastDamageTime()

	// lastDamageTime should be initialized to a recent time, not zero time
	// Zero time is January 1, year 1, 00:00:00 UTC
	zeroTime := time.Time{}
	if lastDamageTime == zeroTime {
		t.Error("lastDamageTime should be initialized, not zero value")
	}

	// Should be within the last second (recently initialized)
	timeSinceInit := time.Since(lastDamageTime)
	if timeSinceInit < 0 || timeSinceInit > 2*time.Second {
		t.Errorf("lastDamageTime should be initialized to recent time, got time since init: %v", timeSinceInit)
	}
}
