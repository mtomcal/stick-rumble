package game

import (
	"testing"
	"time"
)

func TestNewPistol(t *testing.T) {
	pistol := NewPistol()

	if pistol.Name != "Pistol" {
		t.Errorf("expected name 'Pistol', got '%s'", pistol.Name)
	}

	if pistol.Damage != PistolDamage {
		t.Errorf("expected damage %d, got %d", PistolDamage, pistol.Damage)
	}

	if pistol.FireRate != PistolFireRate {
		t.Errorf("expected fire rate %f, got %f", PistolFireRate, pistol.FireRate)
	}

	if pistol.MagazineSize != PistolMagazineSize {
		t.Errorf("expected magazine size %d, got %d", PistolMagazineSize, pistol.MagazineSize)
	}

	if pistol.ReloadTime != PistolReloadTime {
		t.Errorf("expected reload time %v, got %v", PistolReloadTime, pistol.ReloadTime)
	}

	if pistol.ProjectileSpeed != PistolProjectileSpeed {
		t.Errorf("expected projectile speed %f, got %f", PistolProjectileSpeed, pistol.ProjectileSpeed)
	}
}

func TestNewWeaponState(t *testing.T) {
	pistol := NewPistol()
	state := NewWeaponState(pistol)

	if state.Weapon != pistol {
		t.Error("weapon reference mismatch")
	}

	if state.CurrentAmmo != pistol.MagazineSize {
		t.Errorf("expected ammo %d, got %d", pistol.MagazineSize, state.CurrentAmmo)
	}

	if state.IsReloading {
		t.Error("should not be reloading initially")
	}
}

func TestWeaponState_CanShoot(t *testing.T) {
	pistol := NewPistol()
	state := NewWeaponState(pistol)

	// Should be able to shoot initially
	if !state.CanShoot() {
		t.Error("should be able to shoot initially")
	}

	// After shooting, should respect fire rate cooldown
	state.RecordShot()
	if state.CanShoot() {
		t.Error("should not be able to shoot immediately after shooting (fire rate cooldown)")
	}

	// After cooldown, should be able to shoot again
	fireCooldown := time.Duration(float64(time.Second) / pistol.FireRate)
	time.Sleep(fireCooldown + 10*time.Millisecond)
	if !state.CanShoot() {
		t.Error("should be able to shoot after fire rate cooldown")
	}
}

func TestWeaponState_CanShoot_EmptyMagazine(t *testing.T) {
	pistol := NewPistol()
	state := NewWeaponState(pistol)

	// Empty the magazine
	state.CurrentAmmo = 0

	if state.CanShoot() {
		t.Error("should not be able to shoot with empty magazine")
	}
}

func TestWeaponState_CanShoot_WhileReloading(t *testing.T) {
	pistol := NewPistol()
	state := NewWeaponState(pistol)

	state.IsReloading = true

	if state.CanShoot() {
		t.Error("should not be able to shoot while reloading")
	}
}

func TestWeaponState_RecordShot(t *testing.T) {
	pistol := NewPistol()
	state := NewWeaponState(pistol)
	initialAmmo := state.CurrentAmmo

	state.RecordShot()

	if state.CurrentAmmo != initialAmmo-1 {
		t.Errorf("expected ammo %d, got %d", initialAmmo-1, state.CurrentAmmo)
	}

	if state.LastShotTime.IsZero() {
		t.Error("last shot time should be set after shooting")
	}
}

func TestWeaponState_RecordShot_DoesNotGoBelowZero(t *testing.T) {
	pistol := NewPistol()
	state := NewWeaponState(pistol)
	state.CurrentAmmo = 0

	state.RecordShot()

	if state.CurrentAmmo != 0 {
		t.Errorf("ammo should not go below 0, got %d", state.CurrentAmmo)
	}
}

func TestWeaponState_StartReload(t *testing.T) {
	pistol := NewPistol()
	state := NewWeaponState(pistol)
	state.CurrentAmmo = 5 // Partially empty

	state.StartReload()

	if !state.IsReloading {
		t.Error("should be reloading after StartReload")
	}

	if state.ReloadStartTime.IsZero() {
		t.Error("reload start time should be set")
	}
}

func TestWeaponState_StartReload_WhenFull(t *testing.T) {
	pistol := NewPistol()
	state := NewWeaponState(pistol)
	// Magazine is full

	state.StartReload()

	// Should not start reload when magazine is full
	if state.IsReloading {
		t.Error("should not reload when magazine is already full")
	}
}

func TestWeaponState_StartReload_WhenAlreadyReloading(t *testing.T) {
	pistol := NewPistol()
	state := NewWeaponState(pistol)
	state.CurrentAmmo = 5
	state.StartReload()
	firstReloadStart := state.ReloadStartTime

	// Try to reload again
	time.Sleep(10 * time.Millisecond)
	state.StartReload()

	// Reload start time should not change
	if !state.ReloadStartTime.Equal(firstReloadStart) {
		t.Error("reload start time should not change when already reloading")
	}
}

func TestWeaponState_CheckReloadComplete(t *testing.T) {
	pistol := NewPistol()
	state := NewWeaponState(pistol)
	state.CurrentAmmo = 0
	state.StartReload()

	// Immediately after starting, reload should not be complete
	if state.CheckReloadComplete() {
		t.Error("reload should not be complete immediately")
	}

	if state.CurrentAmmo != 0 {
		t.Errorf("ammo should still be 0, got %d", state.CurrentAmmo)
	}

	// Simulate time passing (faster for tests)
	state.ReloadStartTime = time.Now().Add(-pistol.ReloadTime - 10*time.Millisecond)

	if !state.CheckReloadComplete() {
		t.Error("reload should be complete after reload time")
	}

	if state.CurrentAmmo != pistol.MagazineSize {
		t.Errorf("ammo should be %d after reload, got %d", pistol.MagazineSize, state.CurrentAmmo)
	}

	if state.IsReloading {
		t.Error("should not be reloading after reload completes")
	}
}

func TestWeaponState_CheckReloadComplete_WhenNotReloading(t *testing.T) {
	pistol := NewPistol()
	state := NewWeaponState(pistol)

	// Should return false when not reloading
	if state.CheckReloadComplete() {
		t.Error("should return false when not reloading")
	}
}

func TestWeaponState_FireRateCooldown(t *testing.T) {
	pistol := NewPistol()
	state := NewWeaponState(pistol)

	// Fire rate is 3 rounds/second = 333ms cooldown
	expectedCooldown := time.Duration(float64(time.Second) / pistol.FireRate)

	// Shoot
	state.RecordShot()

	// Check cooldown times
	for i := 0; i < 5; i++ {
		if state.CanShoot() {
			t.Error("should not be able to shoot during cooldown")
		}
		time.Sleep(50 * time.Millisecond)
	}

	// After cooldown should be able to shoot
	time.Sleep(expectedCooldown)
	if !state.CanShoot() {
		t.Error("should be able to shoot after cooldown")
	}
}

func TestWeaponState_IsEmpty(t *testing.T) {
	pistol := NewPistol()
	state := NewWeaponState(pistol)

	if state.IsEmpty() {
		t.Error("should not be empty with full magazine")
	}

	state.CurrentAmmo = 0
	if !state.IsEmpty() {
		t.Error("should be empty with no ammo")
	}
}

func TestWeaponState_GetAmmoInfo(t *testing.T) {
	pistol := NewPistol()
	state := NewWeaponState(pistol)

	current, max := state.GetAmmoInfo()

	if current != pistol.MagazineSize {
		t.Errorf("expected current ammo %d, got %d", pistol.MagazineSize, current)
	}

	if max != pistol.MagazineSize {
		t.Errorf("expected max ammo %d, got %d", pistol.MagazineSize, max)
	}

	// After shooting
	state.RecordShot()
	current, max = state.GetAmmoInfo()

	if current != pistol.MagazineSize-1 {
		t.Errorf("expected current ammo %d, got %d", pistol.MagazineSize-1, current)
	}
}

func TestPistolConstants(t *testing.T) {
	// Verify pistol constants match story requirements
	if PistolDamage != 25 {
		t.Errorf("pistol damage should be 25 (4 shots to kill at 100 health), got %d", PistolDamage)
	}

	if PistolFireRate != 3.0 {
		t.Errorf("pistol fire rate should be 3.0 rounds/sec, got %f", PistolFireRate)
	}

	if PistolMagazineSize != 15 {
		t.Errorf("pistol magazine size should be 15, got %d", PistolMagazineSize)
	}

	expectedReloadTime := 1500 * time.Millisecond
	if PistolReloadTime != expectedReloadTime {
		t.Errorf("pistol reload time should be %v, got %v", expectedReloadTime, PistolReloadTime)
	}

	if PistolProjectileSpeed != 800.0 {
		t.Errorf("pistol projectile speed should be 800.0 px/s, got %f", PistolProjectileSpeed)
	}
}

// Melee weapon state tests

func TestWeaponState_MeleeCanShootInfinitely(t *testing.T) {
	bat := NewBat()
	clock := NewManualClock(time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC))
	state := NewWeaponStateWithClock(bat, clock)

	// Melee weapons should be able to "shoot" (swing) initially
	if !state.CanShoot() {
		t.Error("melee weapon should be able to swing initially")
	}

	// Record a swing
	state.RecordShot()

	// Ammo should not be decremented for melee weapons
	if state.CurrentAmmo != 0 {
		t.Errorf("melee weapon ammo should remain 0, got %d", state.CurrentAmmo)
	}

	// Should respect fire rate cooldown (don't advance clock yet)
	// Need to advance time by a tiny amount to ensure we're after the shot time
	clock.Advance(1 * time.Millisecond)
	if state.CanShoot() {
		t.Error("melee weapon should respect fire rate cooldown")
	}

	// After cooldown, should be able to swing again
	clock.Advance(time.Duration(float64(time.Second)/bat.FireRate) + 10*time.Millisecond)
	if !state.CanShoot() {
		t.Error("melee weapon should be able to swing after cooldown")
	}

	// Swing many times to verify infinite usage
	for i := 0; i < 100; i++ {
		clock.Advance(time.Duration(float64(time.Second)/bat.FireRate) + 10*time.Millisecond)
		if !state.CanShoot() {
			t.Errorf("melee weapon should always be able to swing after cooldown (iteration %d)", i)
		}
		state.RecordShot()
		if state.CurrentAmmo != 0 {
			t.Errorf("melee weapon ammo should always be 0, got %d (iteration %d)", state.CurrentAmmo, i)
		}
	}
}

func TestWeaponState_MeleeDoesNotReload(t *testing.T) {
	katana := NewKatana()
	state := NewWeaponState(katana)

	// Attempting to reload should do nothing
	state.StartReload()

	if state.IsReloading {
		t.Error("melee weapons should not reload")
	}

	// Should still be able to swing
	if !state.CanShoot() {
		t.Error("melee weapon should always be able to swing (no reload needed)")
	}
}

func TestWeaponState_BatCooldown(t *testing.T) {
	bat := NewBat() // Fire rate 2.0/s = 0.5s cooldown
	clock := NewManualClock(time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC))
	state := NewWeaponStateWithClock(bat, clock)

	// Record a swing
	state.RecordShot()

	// Should not be able to swing during cooldown (400ms < 500ms)
	clock.Advance(400 * time.Millisecond)
	if state.CanShoot() {
		t.Error("bat should not be able to swing before 0.5s cooldown")
	}

	// Should be able to swing after cooldown (550ms > 500ms)
	clock.Advance(150 * time.Millisecond)
	if !state.CanShoot() {
		t.Error("bat should be able to swing after 0.5s cooldown")
	}
}

func TestWeaponState_KatanaCooldown(t *testing.T) {
	katana := NewKatana() // Fire rate 1.25/s = 0.8s cooldown
	clock := NewManualClock(time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC))
	state := NewWeaponStateWithClock(katana, clock)

	// Record a swing
	state.RecordShot()

	// Should not be able to swing during cooldown (700ms < 800ms)
	clock.Advance(700 * time.Millisecond)
	if state.CanShoot() {
		t.Error("katana should not be able to swing before 0.8s cooldown")
	}

	// Should be able to swing after cooldown (850ms > 800ms)
	clock.Advance(150 * time.Millisecond)
	if !state.CanShoot() {
		t.Error("katana should be able to swing after 0.8s cooldown")
	}
}

func TestWeaponIsMelee(t *testing.T) {
	bat := NewBat()
	katana := NewKatana()
	pistol := NewPistol()

	if !bat.IsMelee() {
		t.Error("Bat should be identified as melee weapon")
	}

	if !katana.IsMelee() {
		t.Error("Katana should be identified as melee weapon")
	}

	if pistol.IsMelee() {
		t.Error("Pistol should NOT be identified as melee weapon")
	}
}
