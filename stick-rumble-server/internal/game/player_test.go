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
	clock := NewManualClock(time.Now())
	player := NewPlayerStateWithClock("test-player", clock)
	player.MarkDead()

	// Immediately after death, should not be able to respawn
	if player.CanRespawn() {
		t.Error("Should not be able to respawn immediately after death")
	}

	// After 1 second (less than RespawnDelay), still cannot respawn
	clock.Advance(1 * time.Second)
	if player.CanRespawn() {
		t.Error("Should not be able to respawn before RespawnDelay")
	}
}

func TestPlayerState_CanRespawn_AfterDelay(t *testing.T) {
	clock := NewManualClock(time.Now())
	player := NewPlayerStateWithClock("test-player", clock)
	player.MarkDead()

	// Advance clock past respawn delay
	clock.Advance(time.Duration(RespawnDelay*float64(time.Second)) + 100*time.Millisecond)

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
	// 10 HP/s * 0.01667s = 0.1667 HP per tick
	// Uses accumulator to track fractional HP across ticks
	deltaTime := 1.0 / 60.0 // 0.01667 seconds (60Hz tick rate)
	player.ApplyRegeneration(now, deltaTime)

	// After first tick: accumulator = 0.1667, health still 50 (no full HP yet)
	if player.Health != 50 {
		t.Errorf("Health after 1 tick = %v, want 50 (accumulating 0.1667 HP)", player.Health)
	}

	// Apply regeneration for 60 ticks total (1 second of game time)
	// 60 ticks * 0.1667 HP/tick = 10 HP (matches the 10 HP/s rate)
	for i := 0; i < 59; i++ {
		now = now.Add(time.Duration(deltaTime * float64(time.Second)))
		player.ApplyRegeneration(now, deltaTime)
	}

	// After 60 ticks at 60Hz (1 second), should have regenerated ~10 HP
	// Allow ±1 HP tolerance due to floating point accumulation
	if player.Health < 59 || player.Health > 61 {
		t.Errorf("Health after 60 ticks at 60Hz = %v, want 59-61 (50 + ~10 HP over 1 second)", player.Health)
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
	// Create player with ManualClock
	clock := NewManualClock(time.Now())
	player := NewPlayerStateWithClock("test-player", clock)

	// Take damage
	player.TakeDamage(60)

	// Record when damage was taken
	firstDamageTime := player.GetLastDamageTime()

	// Advance clock by 3 seconds
	clock.Advance(3 * time.Second)

	// Take damage again (this should reset the timer)
	player.TakeDamage(10)

	secondDamageTime := player.GetLastDamageTime()

	// The second damage time should be significantly later
	if !secondDamageTime.After(firstDamageTime) {
		t.Error("Taking damage should update lastDamageTime")
	}

	// Should not be able to regenerate yet (timer was reset)
	now := clock.Now()
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

// Bug fix: Test that Respawn() properly resets regeneration accumulator and timer
func TestPlayerState_Respawn_ResetsRegenerationState(t *testing.T) {
	player := NewPlayerState("test-player")

	// Damage player to trigger regeneration
	player.TakeDamage(50)

	if player.Health != 50 {
		t.Fatalf("Expected health to be 50 after damage, got %d", player.Health)
	}

	// Simulate time passing and start regeneration
	now := time.Now().Add(6 * time.Second)

	// Apply partial regeneration to accumulate fractional HP
	// At 10 HP/s with deltaTime 0.07s, we accumulate 0.7 HP
	deltaTime := 0.07
	player.ApplyRegeneration(now, deltaTime)

	// Verify accumulator has fractional value (not exposed, but we can infer from next regen)
	// Health should still be 50 (0.7 HP accumulated but not applied yet)
	if player.Health != 50 {
		t.Errorf("Health should still be 50 with fractional accumulator, got %d", player.Health)
	}

	// Kill the player
	player.TakeDamage(50)
	player.MarkDead()

	if player.Health != 0 {
		t.Fatalf("Player should have 0 HP after death, got %d", player.Health)
	}

	// Respawn the player
	spawnPos := Vector2{X: 500, Y: 300}
	player.Respawn(spawnPos)

	// Verify respawn reset all regeneration state
	if player.Health != PlayerMaxHealth {
		t.Errorf("Health should be max after respawn, got %d", player.Health)
	}

	// Try to regenerate immediately (should not work - 5 second delay)
	nowAfterRespawn := time.Now()
	canRegen := player.CanRegenerate(nowAfterRespawn)
	if canRegen {
		t.Error("Should not be able to regenerate immediately after respawn (5s delay required)")
	}

	// Damage player to test regeneration (can't test at full health)
	player.TakeDamage(50)

	// Wait 5+ seconds for delay
	time.Sleep(100 * time.Millisecond) // Small delay to ensure time passes
	testTime := time.Now().Add(6 * time.Second)

	// Apply one tick of regeneration
	player.ApplyRegeneration(testTime, 0.07)

	// Health should still be 50 (0.7 HP accumulated, not yet applied)
	// If accumulator wasn't reset, we'd see 51 HP here (old 0.7 + new 0.7 = 1.4 HP applied)
	if player.Health != 50 {
		t.Errorf("After respawn and 1 tick, health should be 50 (fractional), got %d (accumulator may not have been reset)", player.Health)
	}

	// Apply more ticks to reach 1.0 HP threshold
	// Need ~3 more ticks at 0.07 deltaTime to reach 0.7 + (3 * 0.7) = 2.8 HP
	for i := 0; i < 4; i++ {
		testTime = testTime.Add(70 * time.Millisecond)
		player.ApplyRegeneration(testTime, 0.07)
	}

	// After 5 ticks at 0.07s each (0.35s total), we should have 3.5 HP accumulated
	// This means 3 HP applied, health should be 53
	if player.Health < 52 || player.Health > 54 {
		t.Errorf("After 5 ticks of 0.7 HP each, expected 52-54 HP (50 + 3-4 HP), got %d", player.Health)
	}
}

// Test that lastDamageTime is reset on respawn
func TestPlayerState_Respawn_ResetsLastDamageTime(t *testing.T) {
	clock := NewManualClock(time.Now())
	player := NewPlayerStateWithClock("test-player", clock)

	// Record initial lastDamageTime
	initialTime := player.GetLastDamageTime()

	// Kill player
	player.TakeDamage(100)
	player.MarkDead()

	// Advance clock by 1 second before respawn
	clock.Advance(1 * time.Second)

	// Respawn
	player.Respawn(Vector2{X: 500, Y: 300})

	// Get new lastDamageTime
	respawnTime := player.GetLastDamageTime()

	// lastDamageTime should be reset to a recent time (within last 2 seconds)
	if !respawnTime.After(initialTime) {
		t.Error("lastDamageTime should be updated on respawn to a more recent time")
	}

	timeSinceRespawn := clock.Since(respawnTime)
	if timeSinceRespawn < 0 || timeSinceRespawn > 2*time.Second {
		t.Errorf("lastDamageTime should be reset to recent time on respawn, got %v ago", timeSinceRespawn)
	}
}

// Correction Tracking Tests (Anti-Cheat)

func TestCorrectionStats_GetCorrectionRate_NoUpdates(t *testing.T) {
	stats := CorrectionStats{}

	rate := stats.GetCorrectionRate()

	if rate != 0.0 {
		t.Errorf("GetCorrectionRate() with no updates = %v, want 0.0", rate)
	}
}

func TestCorrectionStats_GetCorrectionRate_NoCorrections(t *testing.T) {
	stats := CorrectionStats{
		TotalUpdates:     10,
		TotalCorrections: 0,
	}

	rate := stats.GetCorrectionRate()

	if rate != 0.0 {
		t.Errorf("GetCorrectionRate() with 0 corrections = %v, want 0.0", rate)
	}
}

func TestCorrectionStats_GetCorrectionRate_SomeCorrections(t *testing.T) {
	stats := CorrectionStats{
		TotalUpdates:     10,
		TotalCorrections: 3,
	}

	rate := stats.GetCorrectionRate()
	expected := 0.3 // 30%

	if rate != expected {
		t.Errorf("GetCorrectionRate() = %v, want %v", rate, expected)
	}
}

func TestCorrectionStats_GetCorrectionRate_AllCorrections(t *testing.T) {
	stats := CorrectionStats{
		TotalUpdates:     10,
		TotalCorrections: 10,
	}

	rate := stats.GetCorrectionRate()
	expected := 1.0 // 100%

	if rate != expected {
		t.Errorf("GetCorrectionRate() = %v, want %v", rate, expected)
	}
}

func TestPlayerState_RecordMovementUpdate(t *testing.T) {
	player := NewPlayerState("test-player")

	// Initially should be 0
	stats := player.GetCorrectionStats()
	if stats.TotalUpdates != 0 {
		t.Errorf("Initial TotalUpdates = %v, want 0", stats.TotalUpdates)
	}

	// Record one update
	player.RecordMovementUpdate()
	stats = player.GetCorrectionStats()

	if stats.TotalUpdates != 1 {
		t.Errorf("TotalUpdates after one record = %v, want 1", stats.TotalUpdates)
	}

	// Record multiple updates
	for i := 0; i < 9; i++ {
		player.RecordMovementUpdate()
	}
	stats = player.GetCorrectionStats()

	if stats.TotalUpdates != 10 {
		t.Errorf("TotalUpdates after 10 records = %v, want 10", stats.TotalUpdates)
	}
}

func TestPlayerState_RecordCorrection(t *testing.T) {
	clock := NewManualClock(time.Now())
	player := NewPlayerStateWithClock("test-player", clock)

	// Initially should be 0
	stats := player.GetCorrectionStats()
	if stats.TotalCorrections != 0 {
		t.Errorf("Initial TotalCorrections = %v, want 0", stats.TotalCorrections)
	}

	// Record one correction
	player.RecordCorrection()
	stats = player.GetCorrectionStats()

	if stats.TotalCorrections != 1 {
		t.Errorf("TotalCorrections after one record = %v, want 1", stats.TotalCorrections)
	}

	// Verify timestamp was set
	if stats.LastCorrectionAt.IsZero() {
		t.Error("LastCorrectionAt should be set after recording correction")
	}

	// Record another correction after time passes
	initialTime := stats.LastCorrectionAt
	clock.Advance(1 * time.Second)
	player.RecordCorrection()
	stats = player.GetCorrectionStats()

	if stats.TotalCorrections != 2 {
		t.Errorf("TotalCorrections after two records = %v, want 2", stats.TotalCorrections)
	}

	// Timestamp should be updated
	if !stats.LastCorrectionAt.After(initialTime) {
		t.Error("LastCorrectionAt should be updated on second correction")
	}
}

func TestPlayerState_GetCorrectionStats_Combined(t *testing.T) {
	player := NewPlayerState("test-player")

	// Record 10 updates with 3 corrections
	for i := 0; i < 10; i++ {
		player.RecordMovementUpdate()
		if i < 3 {
			player.RecordCorrection()
		}
	}

	stats := player.GetCorrectionStats()

	if stats.TotalUpdates != 10 {
		t.Errorf("TotalUpdates = %v, want 10", stats.TotalUpdates)
	}

	if stats.TotalCorrections != 3 {
		t.Errorf("TotalCorrections = %v, want 3", stats.TotalCorrections)
	}

	rate := stats.GetCorrectionRate()
	expected := 0.3 // 30%

	if rate != expected {
		t.Errorf("GetCorrectionRate() = %v, want %v", rate, expected)
	}
}

func TestPlayerState_CorrectionRate_ExceedsThreshold(t *testing.T) {
	player := NewPlayerState("test-player")

	// Record 10 updates with 3 corrections (30% - exceeds 20% threshold)
	for i := 0; i < 10; i++ {
		player.RecordMovementUpdate()
		if i < 3 {
			player.RecordCorrection()
		}
	}

	stats := player.GetCorrectionStats()
	rate := stats.GetCorrectionRate()

	// Verify rate exceeds 20% threshold
	if rate <= 0.20 {
		t.Errorf("GetCorrectionRate() = %v, want > 0.20 for anti-cheat test", rate)
	}

	// This should trigger anti-cheat warning in actual game loop
	if rate != 0.3 {
		t.Errorf("GetCorrectionRate() = %v, want 0.3", rate)
	}
}

func TestPlayerState_CorrectionRate_BelowThreshold(t *testing.T) {
	player := NewPlayerState("test-player")

	// Record 100 updates with 10 corrections (10% - below 20% threshold)
	for i := 0; i < 100; i++ {
		player.RecordMovementUpdate()
		if i < 10 {
			player.RecordCorrection()
		}
	}

	stats := player.GetCorrectionStats()
	rate := stats.GetCorrectionRate()

	// Verify rate is below 20% threshold
	if rate > 0.20 {
		t.Errorf("GetCorrectionRate() = %v, want <= 0.20", rate)
	}

	// Should not trigger anti-cheat warning
	if rate != 0.1 {
		t.Errorf("GetCorrectionRate() = %v, want 0.1", rate)
	}
}

func TestPlayerState_CorrectionRate_ExactlyAtThreshold(t *testing.T) {
	player := NewPlayerState("test-player")

	// Record 100 updates with 20 corrections (20% - exactly at threshold)
	for i := 0; i < 100; i++ {
		player.RecordMovementUpdate()
		if i < 20 {
			player.RecordCorrection()
		}
	}

	stats := player.GetCorrectionStats()
	rate := stats.GetCorrectionRate()

	// Verify rate is exactly 20%
	if rate != 0.20 {
		t.Errorf("GetCorrectionRate() = %v, want 0.20", rate)
	}

	// At exactly 20%, should NOT trigger warning (threshold is > 0.20, not >=)
	if rate > 0.20 {
		t.Error("Rate should not exceed threshold at exactly 20%")
	}
}

func TestPlayerState_CorrectionThreadSafety(t *testing.T) {
	player := NewPlayerState("test-player")
	var wg sync.WaitGroup

	// Concurrent correction tracking
	for i := 0; i < 100; i++ {
		wg.Add(3)

		go func() {
			defer wg.Done()
			player.RecordMovementUpdate()
		}()

		go func() {
			defer wg.Done()
			player.RecordCorrection()
		}()

		go func() {
			defer wg.Done()
			player.GetCorrectionStats()
		}()
	}

	wg.Wait()

	// Verify all updates were recorded
	stats := player.GetCorrectionStats()
	if stats.TotalUpdates != 100 {
		t.Errorf("TotalUpdates after concurrent operations = %v, want 100", stats.TotalUpdates)
	}

	if stats.TotalCorrections != 100 {
		t.Errorf("TotalCorrections after concurrent operations = %v, want 100", stats.TotalCorrections)
	}
}
