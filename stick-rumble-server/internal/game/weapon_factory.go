package game

import (
	"fmt"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

var (
	// Global weapon configs loaded once at startup
	weaponConfigs     map[string]*WeaponConfig
	weaponConfigsOnce sync.Once
)

// initWeaponConfigs initializes weapon configs from JSON file or falls back to hardcoded values
func initWeaponConfigs() {
	weaponConfigsOnce.Do(func() {
		// Try to load from file at project root
		configPath := filepath.Join("..", "..", "weapon-configs.json")
		weaponConfigs = LoadWeaponConfigsOrDefault(configPath)
	})
}

// getWeaponConfig returns the weapon config for a given weapon name
func getWeaponConfig(name string) *WeaponConfig {
	initWeaponConfigs()
	return weaponConfigs[name]
}

// NewBat creates a new Bat weapon instance
// Stats loaded from weapon-configs.json or hardcoded defaults
func NewBat() *Weapon {
	config := getWeaponConfig("Bat")
	if config != nil {
		return config.ToWeapon()
	}

	// Fallback to hardcoded values if config not found
	return &Weapon{
		Name:              "Bat",
		Damage:            25,
		FireRate:          2.0,
		MagazineSize:      0,
		ReloadTime:        0,
		ProjectileSpeed:   0,
		Range:             64,
		ArcDegrees:        90,
		KnockbackDistance: 40,
		Recoil:            nil,
		SpreadDegrees:     0,
	}
}

// NewKatana creates a new Katana weapon instance
// Stats loaded from weapon-configs.json or hardcoded defaults
func NewKatana() *Weapon {
	config := getWeaponConfig("Katana")
	if config != nil {
		return config.ToWeapon()
	}

	// Fallback to hardcoded values if config not found
	return &Weapon{
		Name:              "Katana",
		Damage:            45,
		FireRate:          1.25,
		MagazineSize:      0,
		ReloadTime:        0,
		ProjectileSpeed:   0,
		Range:             80,
		ArcDegrees:        90,
		KnockbackDistance: 0,
		Recoil:            nil,
		SpreadDegrees:     0,
	}
}

// NewUzi creates a new Uzi weapon instance
// Stats loaded from weapon-configs.json or hardcoded defaults
func NewUzi() *Weapon {
	config := getWeaponConfig("Uzi")
	if config != nil {
		return config.ToWeapon()
	}

	// Fallback to hardcoded values if config not found
	return &Weapon{
		Name:              "Uzi",
		Damage:            8,
		FireRate:          10.0,
		MagazineSize:      30,
		ReloadTime:        1500 * time.Millisecond,
		ProjectileSpeed:   800.0,
		Range:             600,
		ArcDegrees:        0,
		KnockbackDistance: 0,
		Recoil: &RecoilPattern{
			VerticalPerShot:   2.0,
			HorizontalPerShot: 0.0,
			RecoveryTime:      0.5,
			MaxAccumulation:   20.0,
		},
		SpreadDegrees: 5.0,
	}
}

// NewAK47 creates a new AK47 weapon instance
// Stats loaded from weapon-configs.json or hardcoded defaults
func NewAK47() *Weapon {
	config := getWeaponConfig("AK47")
	if config != nil {
		return config.ToWeapon()
	}

	// Fallback to hardcoded values if config not found
	return &Weapon{
		Name:              "AK47",
		Damage:            20,
		FireRate:          6.0,
		MagazineSize:      30,
		ReloadTime:        2000 * time.Millisecond,
		ProjectileSpeed:   800.0,
		Range:             800,
		ArcDegrees:        0,
		KnockbackDistance: 0,
		Recoil: &RecoilPattern{
			VerticalPerShot:   1.5,
			HorizontalPerShot: 3.0,
			RecoveryTime:      0.6,
			MaxAccumulation:   15.0,
		},
		SpreadDegrees: 3.0,
	}
}

// NewShotgun creates a new Shotgun weapon instance
// Stats loaded from weapon-configs.json or hardcoded defaults
func NewShotgun() *Weapon {
	config := getWeaponConfig("Shotgun")
	if config != nil {
		return config.ToWeapon()
	}

	// Fallback to hardcoded values if config not found
	return &Weapon{
		Name:              "Shotgun",
		Damage:            60,
		FireRate:          1.0,
		MagazineSize:      6,
		ReloadTime:        2500 * time.Millisecond,
		ProjectileSpeed:   800.0,
		Range:             300,
		ArcDegrees:        15.0,
		KnockbackDistance: 0,
		Recoil:            nil,
		SpreadDegrees:     0,
	}
}

// CreateWeaponByType creates a weapon instance based on the weapon type string
// Weapon type strings are case-insensitive
// Returns error if weapon type is invalid
func CreateWeaponByType(weaponType string) (*Weapon, error) {
	switch strings.ToLower(weaponType) {
	case "bat":
		return NewBat(), nil
	case "katana":
		return NewKatana(), nil
	case "uzi":
		return NewUzi(), nil
	case "ak47":
		return NewAK47(), nil
	case "shotgun":
		return NewShotgun(), nil
	case "pistol":
		return NewPistol(), nil
	default:
		return nil, fmt.Errorf("invalid weapon type: %s", weaponType)
	}
}
