package game

import (
	"sync"
	"testing"
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
