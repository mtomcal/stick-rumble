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
	if PistolDamage != 15 {
		t.Errorf("pistol damage should be 15, got %d", PistolDamage)
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
