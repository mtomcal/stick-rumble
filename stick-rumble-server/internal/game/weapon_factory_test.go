package game

import (
	"testing"
	"time"
)

func TestNewBat(t *testing.T) {
	bat := NewBat()

	if bat == nil {
		t.Fatal("NewBat() returned nil")
	}

	// Verify bat stats from weapon-balance-analysis.md and Story 3.2
	if bat.Name != "Bat" {
		t.Errorf("Expected name 'Bat', got '%s'", bat.Name)
	}
	if bat.Damage != 25 {
		t.Errorf("Expected damage 25, got %d", bat.Damage)
	}
	if bat.FireRate != 2.0 {
		t.Errorf("Expected fire rate 2.0, got %f", bat.FireRate)
	}
	if bat.MagazineSize != 0 {
		t.Errorf("Expected magazine size 0 (melee has no ammo), got %d", bat.MagazineSize)
	}
	if bat.ReloadTime != 0 {
		t.Errorf("Expected reload time 0 (melee has no reload), got %v", bat.ReloadTime)
	}
	if bat.ProjectileSpeed != 0 {
		t.Errorf("Expected projectile speed 0 (melee has no projectiles), got %f", bat.ProjectileSpeed)
	}
	if bat.Range != 64 {
		t.Errorf("Expected range 64px, got %f", bat.Range)
	}
	if bat.ArcDegrees != 90 {
		t.Errorf("Expected arc 90 degrees, got %f", bat.ArcDegrees)
	}
	if bat.KnockbackDistance != 40 {
		t.Errorf("Expected knockback 40px, got %f", bat.KnockbackDistance)
	}
	if !bat.IsMelee() {
		t.Error("Bat should be identified as melee weapon")
	}
}

func TestNewKatana(t *testing.T) {
	katana := NewKatana()

	if katana == nil {
		t.Fatal("NewKatana() returned nil")
	}

	// Verify katana stats from weapon-balance-analysis.md and Story 3.2
	if katana.Name != "Katana" {
		t.Errorf("Expected name 'Katana', got '%s'", katana.Name)
	}
	if katana.Damage != 45 {
		t.Errorf("Expected damage 45, got %d", katana.Damage)
	}
	if katana.FireRate != 1.25 {
		t.Errorf("Expected fire rate 1.25, got %f", katana.FireRate)
	}
	if katana.MagazineSize != 0 {
		t.Errorf("Expected magazine size 0 (melee has no ammo), got %d", katana.MagazineSize)
	}
	if katana.ReloadTime != 0 {
		t.Errorf("Expected reload time 0 (melee has no reload), got %v", katana.ReloadTime)
	}
	if katana.ProjectileSpeed != 0 {
		t.Errorf("Expected projectile speed 0 (melee has no projectiles), got %f", katana.ProjectileSpeed)
	}
	if katana.Range != 80 {
		t.Errorf("Expected range 80px, got %f", katana.Range)
	}
	if katana.ArcDegrees != 90 {
		t.Errorf("Expected arc 90 degrees, got %f", katana.ArcDegrees)
	}
	if katana.KnockbackDistance != 0 {
		t.Errorf("Expected knockback 0px (katana has no knockback), got %f", katana.KnockbackDistance)
	}
	if !katana.IsMelee() {
		t.Error("Katana should be identified as melee weapon")
	}
}

func TestNewUzi(t *testing.T) {
	uzi := NewUzi()

	if uzi == nil {
		t.Fatal("NewUzi() returned nil")
	}

	// Verify Uzi stats from weapon-balance-analysis.md
	if uzi.Name != "Uzi" {
		t.Errorf("Expected name 'Uzi', got '%s'", uzi.Name)
	}
	if uzi.Damage != 8 {
		t.Errorf("Expected damage 8, got %d", uzi.Damage)
	}
	if uzi.FireRate != 10.0 {
		t.Errorf("Expected fire rate 10.0, got %f", uzi.FireRate)
	}
	if uzi.MagazineSize != 30 {
		t.Errorf("Expected magazine size 30, got %d", uzi.MagazineSize)
	}
	if uzi.ReloadTime != 1500*time.Millisecond {
		t.Errorf("Expected reload time 1500ms, got %v", uzi.ReloadTime)
	}
	if uzi.ProjectileSpeed != 800.0 {
		t.Errorf("Expected projectile speed 800.0, got %f", uzi.ProjectileSpeed)
	}
}

func TestNewAK47(t *testing.T) {
	ak47 := NewAK47()

	if ak47 == nil {
		t.Fatal("NewAK47() returned nil")
	}

	// Verify AK47 stats from weapon-balance-analysis.md
	if ak47.Name != "AK47" {
		t.Errorf("Expected name 'AK47', got '%s'", ak47.Name)
	}
	if ak47.Damage != 20 {
		t.Errorf("Expected damage 20, got %d", ak47.Damage)
	}
	if ak47.FireRate != 6.0 {
		t.Errorf("Expected fire rate 6.0, got %f", ak47.FireRate)
	}
	if ak47.MagazineSize != 30 {
		t.Errorf("Expected magazine size 30, got %d", ak47.MagazineSize)
	}
	if ak47.ReloadTime != 2000*time.Millisecond {
		t.Errorf("Expected reload time 2000ms, got %v", ak47.ReloadTime)
	}
	if ak47.ProjectileSpeed != 800.0 {
		t.Errorf("Expected projectile speed 800.0, got %f", ak47.ProjectileSpeed)
	}
}

func TestNewShotgun(t *testing.T) {
	shotgun := NewShotgun()

	if shotgun == nil {
		t.Fatal("NewShotgun() returned nil")
	}

	// Verify Shotgun stats from weapon-balance-analysis.md
	if shotgun.Name != "Shotgun" {
		t.Errorf("Expected name 'Shotgun', got '%s'", shotgun.Name)
	}
	// Shotgun does 60 total damage (8 pellets x 7.5 damage each)
	// Store the per-pellet damage in Damage field
	if shotgun.Damage != 60 {
		t.Errorf("Expected damage 60 (total for all pellets), got %d", shotgun.Damage)
	}
	if shotgun.FireRate != 1.0 {
		t.Errorf("Expected fire rate 1.0, got %f", shotgun.FireRate)
	}
	if shotgun.MagazineSize != 6 {
		t.Errorf("Expected magazine size 6, got %d", shotgun.MagazineSize)
	}
	if shotgun.ReloadTime != 2500*time.Millisecond {
		t.Errorf("Expected reload time 2500ms, got %v", shotgun.ReloadTime)
	}
	if shotgun.ProjectileSpeed != 800.0 {
		t.Errorf("Expected projectile speed 800.0, got %f", shotgun.ProjectileSpeed)
	}
}

func TestCreateWeaponByType_AllValidTypes(t *testing.T) {
	tests := []struct {
		weaponType   string
		expectedName string
	}{
		{"bat", "Bat"},
		{"katana", "Katana"},
		{"uzi", "Uzi"},
		{"ak47", "AK47"},
		{"shotgun", "Shotgun"},
		{"pistol", "Pistol"},
	}

	for _, tt := range tests {
		t.Run(tt.weaponType, func(t *testing.T) {
			weapon, err := CreateWeaponByType(tt.weaponType)
			if err != nil {
				t.Fatalf("CreateWeaponByType(%q) returned error: %v", tt.weaponType, err)
			}
			if weapon == nil {
				t.Fatalf("CreateWeaponByType(%q) returned nil weapon", tt.weaponType)
			}
			if weapon.Name != tt.expectedName {
				t.Errorf("Expected weapon name %q, got %q", tt.expectedName, weapon.Name)
			}
		})
	}
}

func TestCreateWeaponByType_InvalidType(t *testing.T) {
	invalidTypes := []string{
		"invalid",
		"sword",
		"rifle",
		"",
		"machinegun",
		"sniper",
	}

	for _, weaponType := range invalidTypes {
		t.Run(weaponType, func(t *testing.T) {
			weapon, err := CreateWeaponByType(weaponType)
			if err == nil {
				t.Errorf("CreateWeaponByType(%q) should return error, got nil", weaponType)
			}
			if weapon != nil {
				t.Errorf("CreateWeaponByType(%q) should return nil weapon on error, got %v", weaponType, weapon)
			}
		})
	}
}

func TestCreateWeaponByType_CaseInsensitive(t *testing.T) {
	// Test that weapon type strings are case-insensitive
	tests := []struct {
		input        string
		expectedName string
	}{
		{"Bat", "Bat"},
		{"BAT", "Bat"},
		{"Uzi", "Uzi"},
		{"UZI", "Uzi"},
		{"AK47", "AK47"},
		{"ak47", "AK47"},
		{"Ak47", "AK47"},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			weapon, err := CreateWeaponByType(tt.input)
			if err != nil {
				t.Fatalf("CreateWeaponByType(%q) returned error: %v", tt.input, err)
			}
			if weapon.Name != tt.expectedName {
				t.Errorf("Expected weapon name %q, got %q", tt.expectedName, weapon.Name)
			}
		})
	}
}
