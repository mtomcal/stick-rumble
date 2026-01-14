package game

import (
	"fmt"
	"strings"
	"time"
)

// NewBat creates a new Bat weapon instance
// Stats from weapon-balance-analysis.md and Story 3.2:
// - Damage: 25
// - Fire Rate: 2.0/s (0.5s cooldown)
// - Range: 64px (melee)
// - Arc: 90 degrees
// - Knockback: 40px (200 px/s for 0.2s)
func NewBat() *Weapon {
	return &Weapon{
		Name:              "Bat",
		Damage:            25,
		FireRate:          2.0,
		MagazineSize:      0,  // Melee has no ammo
		ReloadTime:        0,  // Melee has no reload
		ProjectileSpeed:   0,  // Melee has no projectiles
		Range:             64, // 64px melee range
		ArcDegrees:        90, // 90-degree swing arc
		KnockbackDistance: 40, // 40px knockback
	}
}

// NewKatana creates a new Katana weapon instance
// Stats from weapon-balance-analysis.md and Story 3.2:
// - Damage: 45
// - Fire Rate: 1.25/s (0.8s cooldown)
// - Range: 80px (melee)
// - Arc: 90 degrees
// - Knockback: None
func NewKatana() *Weapon {
	return &Weapon{
		Name:              "Katana",
		Damage:            45,
		FireRate:          1.25,
		MagazineSize:      0,  // Melee has no ammo
		ReloadTime:        0,  // Melee has no reload
		ProjectileSpeed:   0,  // Melee has no projectiles
		Range:             80, // 80px melee range (longer than Bat)
		ArcDegrees:        90, // 90-degree swing arc
		KnockbackDistance: 0,  // No knockback
	}
}

// NewUzi creates a new Uzi weapon instance
// Stats from weapon-balance-analysis.md:
// - Damage: 8
// - Fire Rate: 10.0/s
// - Magazine Size: 30
// - Reload Time: 1.5s
// - Range: 600px
func NewUzi() *Weapon {
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
	}
}

// NewAK47 creates a new AK47 weapon instance
// Stats from weapon-balance-analysis.md:
// - Damage: 20
// - Fire Rate: 6.0/s
// - Magazine Size: 30
// - Reload Time: 2.0s
// - Range: 800px
func NewAK47() *Weapon {
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
	}
}

// NewShotgun creates a new Shotgun weapon instance
// Stats from weapon-balance-analysis.md:
// - Damage: 60 total (8 pellets x 7.5 damage each)
// - Fire Rate: 1.0/s
// - Magazine Size: 6
// - Reload Time: 2.5s
// - Range: 300px
func NewShotgun() *Weapon {
	return &Weapon{
		Name:              "Shotgun",
		Damage:            60, // Total damage for all 8 pellets
		FireRate:          1.0,
		MagazineSize:      6,
		ReloadTime:        2500 * time.Millisecond,
		ProjectileSpeed:   800.0,
		Range:             300,
		ArcDegrees:        0,
		KnockbackDistance: 0,
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
