package game

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestLoadWeaponConfigs_Success(t *testing.T) {
	// Create temporary config file
	tmpDir := t.TempDir()
	configPath := filepath.Join(tmpDir, "weapon-configs.json")

	config := WeaponConfigFile{
		Version: "1.0.0",
		Weapons: map[string]WeaponConfig{
			"Pistol": {
				Name:              "Pistol",
				Damage:            25,
				FireRate:          3.0,
				MagazineSize:      15,
				ReloadTimeMs:      1500,
				ProjectileSpeed:   800.0,
				Range:             800.0,
				ArcDegrees:        0,
				KnockbackDistance: 0,
				Recoil:            nil,
				SpreadDegrees:     0,
				Visuals: WeaponVisuals{
					MuzzleFlashColor:    "0xffdd00",
					MuzzleFlashSize:     8,
					MuzzleFlashDuration: 50,
				},
			},
		},
	}

	data, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		t.Fatalf("Failed to marshal config: %v", err)
	}

	if err := os.WriteFile(configPath, data, 0644); err != nil {
		t.Fatalf("Failed to write config file: %v", err)
	}

	// Test loading
	configs, err := LoadWeaponConfigs(configPath)
	if err != nil {
		t.Fatalf("LoadWeaponConfigs failed: %v", err)
	}

	if configs == nil {
		t.Fatal("Expected configs to be non-nil")
	}

	if configs["Pistol"] == nil {
		t.Fatal("Expected Pistol config to exist")
	}

	pistol := configs["Pistol"]
	if pistol.Name != "Pistol" {
		t.Errorf("Expected name 'Pistol', got '%s'", pistol.Name)
	}
	if pistol.Damage != 25 {
		t.Errorf("Expected damage 25, got %d", pistol.Damage)
	}
	if pistol.FireRate != 3.0 {
		t.Errorf("Expected fire rate 3.0, got %f", pistol.FireRate)
	}
}

func TestLoadWeaponConfigs_FileNotFound(t *testing.T) {
	_, err := LoadWeaponConfigs("/nonexistent/path/weapon-configs.json")
	if err == nil {
		t.Fatal("Expected error for nonexistent file, got nil")
	}
}

func TestLoadWeaponConfigs_InvalidJSON(t *testing.T) {
	tmpDir := t.TempDir()
	configPath := filepath.Join(tmpDir, "weapon-configs.json")

	// Write invalid JSON
	if err := os.WriteFile(configPath, []byte("invalid json {"), 0644); err != nil {
		t.Fatalf("Failed to write config file: %v", err)
	}

	_, err := LoadWeaponConfigs(configPath)
	if err == nil {
		t.Fatal("Expected error for invalid JSON, got nil")
	}
}

func TestLoadWeaponConfigs_AllWeapons(t *testing.T) {
	// Test with actual production config
	// Path from stick-rumble-server/internal/game/ to project root
	configPath := filepath.Join("..", "..", "..", "weapon-configs.json")

	configs, err := LoadWeaponConfigs(configPath)
	if err != nil {
		t.Fatalf("LoadWeaponConfigs failed: %v", err)
	}

	expectedWeapons := []string{"Pistol", "Bat", "Katana", "Uzi", "AK47", "Shotgun"}
	for _, weaponName := range expectedWeapons {
		if configs[weaponName] == nil {
			t.Errorf("Expected weapon '%s' to be in configs", weaponName)
		}
	}
}

func TestWeaponConfigToWeapon_Pistol(t *testing.T) {
	config := &WeaponConfig{
		Name:              "Pistol",
		Damage:            25,
		FireRate:          3.0,
		MagazineSize:      15,
		ReloadTimeMs:      1500,
		ProjectileSpeed:   800.0,
		Range:             800.0,
		ArcDegrees:        0,
		KnockbackDistance: 0,
		Recoil:            nil,
		SpreadDegrees:     0,
	}

	weapon := config.ToWeapon()

	if weapon.Name != "Pistol" {
		t.Errorf("Expected name 'Pistol', got '%s'", weapon.Name)
	}
	if weapon.Damage != 25 {
		t.Errorf("Expected damage 25, got %d", weapon.Damage)
	}
	if weapon.FireRate != 3.0 {
		t.Errorf("Expected fire rate 3.0, got %f", weapon.FireRate)
	}
	if weapon.MagazineSize != 15 {
		t.Errorf("Expected magazine size 15, got %d", weapon.MagazineSize)
	}
	if weapon.ReloadTime != 1500*time.Millisecond {
		t.Errorf("Expected reload time 1500ms, got %v", weapon.ReloadTime)
	}
	if weapon.ProjectileSpeed != 800.0 {
		t.Errorf("Expected projectile speed 800.0, got %f", weapon.ProjectileSpeed)
	}
	if weapon.Range != 800.0 {
		t.Errorf("Expected range 800.0, got %f", weapon.Range)
	}
	if weapon.Recoil != nil {
		t.Error("Expected nil recoil for Pistol")
	}
}

func TestWeaponConfigToWeapon_WithRecoil(t *testing.T) {
	config := &WeaponConfig{
		Name:              "Uzi",
		Damage:            8,
		FireRate:          10.0,
		MagazineSize:      30,
		ReloadTimeMs:      1500,
		ProjectileSpeed:   800.0,
		Range:             600.0,
		ArcDegrees:        0,
		KnockbackDistance: 0,
		Recoil: &RecoilConfig{
			VerticalPerShot:   2.0,
			HorizontalPerShot: 0.0,
			RecoveryTime:      0.5,
			MaxAccumulation:   20.0,
		},
		SpreadDegrees: 5.0,
	}

	weapon := config.ToWeapon()

	if weapon.Name != "Uzi" {
		t.Errorf("Expected name 'Uzi', got '%s'", weapon.Name)
	}
	if weapon.Recoil == nil {
		t.Fatal("Expected recoil to be non-nil for Uzi")
	}
	if weapon.Recoil.VerticalPerShot != 2.0 {
		t.Errorf("Expected vertical recoil 2.0, got %f", weapon.Recoil.VerticalPerShot)
	}
	if weapon.Recoil.HorizontalPerShot != 0.0 {
		t.Errorf("Expected horizontal recoil 0.0, got %f", weapon.Recoil.HorizontalPerShot)
	}
	if weapon.Recoil.RecoveryTime != 0.5 {
		t.Errorf("Expected recovery time 0.5, got %f", weapon.Recoil.RecoveryTime)
	}
	if weapon.Recoil.MaxAccumulation != 20.0 {
		t.Errorf("Expected max accumulation 20.0, got %f", weapon.Recoil.MaxAccumulation)
	}
	if weapon.SpreadDegrees != 5.0 {
		t.Errorf("Expected spread degrees 5.0, got %f", weapon.SpreadDegrees)
	}
}

func TestWeaponConfigToWeapon_MeleeWeapon(t *testing.T) {
	config := &WeaponConfig{
		Name:              "Bat",
		Damage:            25,
		FireRate:          2.0,
		MagazineSize:      0,
		ReloadTimeMs:      0,
		ProjectileSpeed:   0,
		Range:             90.0,
		ArcDegrees:        80,
		KnockbackDistance: 40,
		Recoil:            nil,
		SpreadDegrees:     0,
	}

	weapon := config.ToWeapon()

	if weapon.Name != "Bat" {
		t.Errorf("Expected name 'Bat', got '%s'", weapon.Name)
	}
	if weapon.MagazineSize != 0 {
		t.Errorf("Expected magazine size 0 for melee, got %d", weapon.MagazineSize)
	}
	if weapon.ReloadTime != 0 {
		t.Errorf("Expected reload time 0 for melee, got %v", weapon.ReloadTime)
	}
	if weapon.Range != 90.0 {
		t.Errorf("Expected range 90.0, got %f", weapon.Range)
	}
	if weapon.ArcDegrees != 80 {
		t.Errorf("Expected arc degrees 80, got %f", weapon.ArcDegrees)
	}
	if weapon.KnockbackDistance != 40 {
		t.Errorf("Expected knockback distance 40, got %f", weapon.KnockbackDistance)
	}
	if !weapon.IsMelee() {
		t.Error("Expected weapon to be identified as melee")
	}
}

func TestGetDefaultConfigPath(t *testing.T) {
	path := GetDefaultConfigPath()
	if path == "" {
		t.Error("Expected non-empty default config path")
	}
	if filepath.Base(path) != "weapon-configs.json" {
		t.Errorf("Expected filename 'weapon-configs.json', got '%s'", filepath.Base(path))
	}
}

func TestValidateWeaponConfig_Valid(t *testing.T) {
	config := &WeaponConfig{
		Name:              "Pistol",
		Damage:            25,
		FireRate:          3.0,
		MagazineSize:      15,
		ReloadTimeMs:      1500,
		ProjectileSpeed:   800.0,
		Range:             800.0,
		ArcDegrees:        0,
		KnockbackDistance: 0,
		Recoil:            nil,
		SpreadDegrees:     0,
		Visuals: WeaponVisuals{
			MuzzleFlashColor:    "0xffdd00",
			MuzzleFlashSize:     8,
			MuzzleFlashDuration: 50,
		},
	}

	err := ValidateWeaponConfig(config)
	if err != nil {
		t.Errorf("Expected valid config to pass validation, got error: %v", err)
	}
}

func TestValidateWeaponConfig_MissingName(t *testing.T) {
	config := &WeaponConfig{
		Name:            "",
		Damage:          25,
		FireRate:        3.0,
		MagazineSize:    15,
		ProjectileSpeed: 800.0,
		Range:           800.0,
	}

	err := ValidateWeaponConfig(config)
	if err == nil {
		t.Error("Expected error for missing name, got nil")
	}
}

func TestValidateWeaponConfig_InvalidDamage(t *testing.T) {
	config := &WeaponConfig{
		Name:            "Invalid",
		Damage:          0,
		FireRate:        3.0,
		MagazineSize:    15,
		ProjectileSpeed: 800.0,
		Range:           800.0,
	}

	err := ValidateWeaponConfig(config)
	if err == nil {
		t.Error("Expected error for invalid damage, got nil")
	}
}

func TestValidateWeaponConfig_InvalidFireRate(t *testing.T) {
	config := &WeaponConfig{
		Name:            "Invalid",
		Damage:          25,
		FireRate:        0,
		MagazineSize:    15,
		ProjectileSpeed: 800.0,
		Range:           800.0,
	}

	err := ValidateWeaponConfig(config)
	if err == nil {
		t.Error("Expected error for invalid fire rate, got nil")
	}
}

func TestValidateWeaponConfig_InvalidRange(t *testing.T) {
	config := &WeaponConfig{
		Name:            "Invalid",
		Damage:          25,
		FireRate:        3.0,
		MagazineSize:    15,
		ProjectileSpeed: 800.0,
		Range:           0,
	}

	err := ValidateWeaponConfig(config)
	if err == nil {
		t.Error("Expected error for invalid range, got nil")
	}
}

func TestValidateWeaponConfig_RangedWeaponRequiresProjectileSpeed(t *testing.T) {
	config := &WeaponConfig{
		Name:            "InvalidGun",
		Damage:          25,
		FireRate:        3.0,
		MagazineSize:    15, // Has magazine but no projectile speed
		ProjectileSpeed: 0,
		Range:           800.0,
	}

	err := ValidateWeaponConfig(config)
	if err == nil {
		t.Error("Expected error for ranged weapon without projectile speed, got nil")
	}
}

func TestValidateWeaponConfig_InvalidRecoilRecoveryTime(t *testing.T) {
	config := &WeaponConfig{
		Name:            "InvalidRecoil",
		Damage:          25,
		FireRate:        3.0,
		MagazineSize:    15,
		ProjectileSpeed: 800.0,
		Range:           800.0,
		Recoil: &RecoilConfig{
			VerticalPerShot:   2.0,
			HorizontalPerShot: 1.0,
			RecoveryTime:      0, // Invalid
			MaxAccumulation:   20.0,
		},
	}

	err := ValidateWeaponConfig(config)
	if err == nil {
		t.Error("Expected error for invalid recoil recovery time, got nil")
	}
}

func TestValidateWeaponConfig_InvalidRecoilMaxAccumulation(t *testing.T) {
	config := &WeaponConfig{
		Name:            "InvalidRecoil",
		Damage:          25,
		FireRate:        3.0,
		MagazineSize:    15,
		ProjectileSpeed: 800.0,
		Range:           800.0,
		Recoil: &RecoilConfig{
			VerticalPerShot:   2.0,
			HorizontalPerShot: 1.0,
			RecoveryTime:      0.5,
			MaxAccumulation:   0, // Invalid
		},
	}

	err := ValidateWeaponConfig(config)
	if err == nil {
		t.Error("Expected error for invalid recoil max accumulation, got nil")
	}
}

func TestLoadWeaponConfigsOrDefault_Success(t *testing.T) {
	// Create temporary config file
	tmpDir := t.TempDir()
	configPath := filepath.Join(tmpDir, "weapon-configs.json")

	config := WeaponConfigFile{
		Version: "1.0.0",
		Weapons: map[string]WeaponConfig{
			"TestWeapon": {
				Name:            "TestWeapon",
				Damage:          50,
				FireRate:        5.0,
				MagazineSize:    20,
				ReloadTimeMs:    2000,
				ProjectileSpeed: 900.0,
				Range:           700.0,
			},
		},
	}

	data, _ := json.MarshalIndent(config, "", "  ")
	os.WriteFile(configPath, data, 0644)

	configs := LoadWeaponConfigsOrDefault(configPath)
	if configs == nil {
		t.Fatal("Expected configs to be non-nil")
	}
	if configs["TestWeapon"] == nil {
		t.Error("Expected TestWeapon to be loaded")
	}
}

func TestLoadWeaponConfigsOrDefault_FallbackToHardcoded(t *testing.T) {
	// Test with non-existent path
	configs := LoadWeaponConfigsOrDefault("/nonexistent/path.json")
	if configs == nil {
		t.Fatal("Expected configs to be non-nil (fallback)")
	}

	// Should have hardcoded weapons
	expectedWeapons := []string{"Pistol", "Bat", "Katana", "Uzi", "AK47", "Shotgun"}
	for _, weaponName := range expectedWeapons {
		if configs[weaponName] == nil {
			t.Errorf("Expected hardcoded weapon '%s' to exist in fallback", weaponName)
		}
	}
}
