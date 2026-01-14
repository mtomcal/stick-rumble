package game

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"
)

// WeaponVisuals defines visual properties for weapon rendering (client-side)
type WeaponVisuals struct {
	MuzzleFlashColor    string `json:"muzzleFlashColor"`
	MuzzleFlashSize     int    `json:"muzzleFlashSize"`
	MuzzleFlashDuration int    `json:"muzzleFlashDuration"`
}

// RecoilConfig defines recoil pattern configuration from JSON
type RecoilConfig struct {
	VerticalPerShot   float64 `json:"verticalPerShot"`
	HorizontalPerShot float64 `json:"horizontalPerShot"`
	RecoveryTime      float64 `json:"recoveryTime"`
	MaxAccumulation   float64 `json:"maxAccumulation"`
}

// WeaponConfig defines weapon configuration from JSON
type WeaponConfig struct {
	Name              string        `json:"name"`
	Damage            int           `json:"damage"`
	FireRate          float64       `json:"fireRate"`
	MagazineSize      int           `json:"magazineSize"`
	ReloadTimeMs      int           `json:"reloadTimeMs"`
	ProjectileSpeed   float64       `json:"projectileSpeed"`
	Range             float64       `json:"range"`
	ArcDegrees        float64       `json:"arcDegrees"`
	KnockbackDistance float64       `json:"knockbackDistance"`
	Recoil            *RecoilConfig `json:"recoil"`
	SpreadDegrees     float64       `json:"spreadDegrees"`
	Visuals           WeaponVisuals `json:"visuals"`
}

// WeaponConfigFile defines the structure of weapon-configs.json
type WeaponConfigFile struct {
	Version string                  `json:"version"`
	Weapons map[string]WeaponConfig `json:"weapons"`
}

// ToWeapon converts WeaponConfig to Weapon struct
func (wc *WeaponConfig) ToWeapon() *Weapon {
	weapon := &Weapon{
		Name:              wc.Name,
		Damage:            wc.Damage,
		FireRate:          wc.FireRate,
		MagazineSize:      wc.MagazineSize,
		ReloadTime:        time.Duration(wc.ReloadTimeMs) * time.Millisecond,
		ProjectileSpeed:   wc.ProjectileSpeed,
		Range:             wc.Range,
		ArcDegrees:        wc.ArcDegrees,
		KnockbackDistance: wc.KnockbackDistance,
		SpreadDegrees:     wc.SpreadDegrees,
	}

	// Convert recoil config if present
	if wc.Recoil != nil {
		weapon.Recoil = &RecoilPattern{
			VerticalPerShot:   wc.Recoil.VerticalPerShot,
			HorizontalPerShot: wc.Recoil.HorizontalPerShot,
			RecoveryTime:      wc.Recoil.RecoveryTime,
			MaxAccumulation:   wc.Recoil.MaxAccumulation,
		}
	}

	return weapon
}

// LoadWeaponConfigs loads weapon configurations from a JSON file
func LoadWeaponConfigs(configPath string) (map[string]*WeaponConfig, error) {
	data, err := os.ReadFile(configPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read weapon config file: %w", err)
	}

	var configFile WeaponConfigFile
	if err := json.Unmarshal(data, &configFile); err != nil {
		return nil, fmt.Errorf("failed to parse weapon config JSON: %w", err)
	}

	// Convert map to pointer map
	configs := make(map[string]*WeaponConfig)
	for name, config := range configFile.Weapons {
		configCopy := config // Create copy to get stable pointer
		configs[name] = &configCopy
	}

	return configs, nil
}

// GetDefaultConfigPath returns the default path to weapon-configs.json
// Assumes the config is at the project root (two levels up from internal/game)
func GetDefaultConfigPath() string {
	// Get the current working directory
	cwd, err := os.Getwd()
	if err != nil {
		// Fallback to relative path
		return "../../weapon-configs.json"
	}

	// Navigate to project root: internal/game -> internal -> stick-rumble-server -> project root
	projectRoot := filepath.Join(cwd, "..", "..", "..")
	return filepath.Join(projectRoot, "weapon-configs.json")
}

// ValidateWeaponConfig validates a weapon configuration
func ValidateWeaponConfig(config *WeaponConfig) error {
	if config.Name == "" {
		return fmt.Errorf("weapon name cannot be empty")
	}
	if config.Damage <= 0 {
		return fmt.Errorf("weapon damage must be positive, got %d", config.Damage)
	}
	if config.FireRate <= 0 {
		return fmt.Errorf("weapon fire rate must be positive, got %f", config.FireRate)
	}
	if config.Range <= 0 {
		return fmt.Errorf("weapon range must be positive, got %f", config.Range)
	}

	// Validate ranged weapon constraints
	if config.MagazineSize > 0 && config.ProjectileSpeed <= 0 {
		return fmt.Errorf("ranged weapon must have positive projectile speed")
	}

	// Validate recoil if present
	if config.Recoil != nil {
		if config.Recoil.RecoveryTime <= 0 {
			return fmt.Errorf("recoil recovery time must be positive")
		}
		if config.Recoil.MaxAccumulation <= 0 {
			return fmt.Errorf("recoil max accumulation must be positive")
		}
	}

	return nil
}

// LoadWeaponConfigsOrDefault loads weapon configs from file, or returns hardcoded defaults on error
func LoadWeaponConfigsOrDefault(configPath string) map[string]*WeaponConfig {
	configs, err := LoadWeaponConfigs(configPath)
	if err != nil {
		// Fallback to hardcoded configs
		return getHardcodedWeaponConfigs()
	}
	return configs
}

// getHardcodedWeaponConfigs returns hardcoded weapon configs as fallback
func getHardcodedWeaponConfigs() map[string]*WeaponConfig {
	return map[string]*WeaponConfig{
		"Pistol": {
			Name:              "Pistol",
			Damage:            PistolDamage,
			FireRate:          PistolFireRate,
			MagazineSize:      PistolMagazineSize,
			ReloadTimeMs:      int(PistolReloadTime.Milliseconds()),
			ProjectileSpeed:   PistolProjectileSpeed,
			Range:             ProjectileMaxRange,
			ArcDegrees:        0,
			KnockbackDistance: 0,
			Recoil:            nil,
			SpreadDegrees:     0,
		},
		"Bat": {
			Name:              "Bat",
			Damage:            25,
			FireRate:          2.0,
			MagazineSize:      0,
			ReloadTimeMs:      0,
			ProjectileSpeed:   0,
			Range:             64,
			ArcDegrees:        90,
			KnockbackDistance: 40,
			Recoil:            nil,
			SpreadDegrees:     0,
		},
		"Katana": {
			Name:              "Katana",
			Damage:            45,
			FireRate:          1.25,
			MagazineSize:      0,
			ReloadTimeMs:      0,
			ProjectileSpeed:   0,
			Range:             80,
			ArcDegrees:        90,
			KnockbackDistance: 0,
			Recoil:            nil,
			SpreadDegrees:     0,
		},
		"Uzi": {
			Name:            "Uzi",
			Damage:          8,
			FireRate:        10.0,
			MagazineSize:    30,
			ReloadTimeMs:    1500,
			ProjectileSpeed: 800.0,
			Range:           600,
			ArcDegrees:      0,
			Recoil: &RecoilConfig{
				VerticalPerShot:   2.0,
				HorizontalPerShot: 0.0,
				RecoveryTime:      0.5,
				MaxAccumulation:   20.0,
			},
			SpreadDegrees: 5.0,
		},
		"AK47": {
			Name:            "AK47",
			Damage:          20,
			FireRate:        6.0,
			MagazineSize:    30,
			ReloadTimeMs:    2000,
			ProjectileSpeed: 800.0,
			Range:           800,
			ArcDegrees:      0,
			Recoil: &RecoilConfig{
				VerticalPerShot:   1.5,
				HorizontalPerShot: 3.0,
				RecoveryTime:      0.6,
				MaxAccumulation:   15.0,
			},
			SpreadDegrees: 3.0,
		},
		"Shotgun": {
			Name:              "Shotgun",
			Damage:            60,
			FireRate:          1.0,
			MagazineSize:      6,
			ReloadTimeMs:      2500,
			ProjectileSpeed:   800.0,
			Range:             300,
			ArcDegrees:        15.0,
			KnockbackDistance: 0,
			Recoil:            nil,
			SpreadDegrees:     0,
		},
	}
}
