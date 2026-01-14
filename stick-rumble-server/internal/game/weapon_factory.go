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
		MagazineSize:      0,   // Melee has no ammo
		ReloadTime:        0,   // Melee has no reload
		ProjectileSpeed:   0,   // Melee has no projectiles
		Range:             64,  // 64px melee range
		ArcDegrees:        90,  // 90-degree swing arc
		KnockbackDistance: 40,  // 40px knockback
		Recoil:            nil, // No recoil for melee
		SpreadDegrees:     0,   // No spread for melee
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
		MagazineSize:      0,   // Melee has no ammo
		ReloadTime:        0,   // Melee has no reload
		ProjectileSpeed:   0,   // Melee has no projectiles
		Range:             80,  // 80px melee range (longer than Bat)
		ArcDegrees:        90,  // 90-degree swing arc
		KnockbackDistance: 0,   // No knockback
		Recoil:            nil, // No recoil for melee
		SpreadDegrees:     0,   // No spread for melee
	}
}

// NewUzi creates a new Uzi weapon instance
// Stats from weapon-balance-analysis.md and Story 3.3:
// - Damage: 8
// - Fire Rate: 10.0/s
// - Magazine Size: 30
// - Reload Time: 1.5s
// - Range: 600px
// - Recoil: 2° vertical per shot, recovers over 0.5s
// - Spread: +/-5° while moving
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
		Recoil: &RecoilPattern{
			VerticalPerShot:   2.0,  // 2° climb per shot
			HorizontalPerShot: 0.0,  // No horizontal recoil
			RecoveryTime:      0.5,  // 0.5s recovery
			MaxAccumulation:   20.0, // Max 20° recoil (10 shots worth)
		},
		SpreadDegrees: 5.0, // +/-5° while moving
	}
}

// NewAK47 creates a new AK47 weapon instance
// Stats from weapon-balance-analysis.md and Story 3.3:
// - Damage: 20
// - Fire Rate: 6.0/s
// - Magazine Size: 30
// - Reload Time: 2.0s
// - Range: 800px
// - Recoil: balanced horizontal + vertical, +/-3° pattern
// - Spread: +/-3° while moving
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
		Recoil: &RecoilPattern{
			VerticalPerShot:   1.5,  // 1.5° vertical per shot
			HorizontalPerShot: 3.0,  // +/-3° horizontal per shot
			RecoveryTime:      0.6,  // 0.6s recovery
			MaxAccumulation:   15.0, // Max 15° recoil
		},
		SpreadDegrees: 3.0, // +/-3° while moving
	}
}

// NewShotgun creates a new Shotgun weapon instance
// Stats from weapon-balance-analysis.md and Story 3.3:
// - Damage: 60 total (8 pellets x 7.5 damage each)
// - Fire Rate: 1.0/s
// - Magazine Size: 6
// - Reload Time: 2.5s
// - Range: 300px
// - Spread: 15° cone (pellets)
// - No recoil pattern (1 shot/second is slow enough)
func NewShotgun() *Weapon {
	return &Weapon{
		Name:              "Shotgun",
		Damage:            60, // Total damage for all 8 pellets
		FireRate:          1.0,
		MagazineSize:      6,
		ReloadTime:        2500 * time.Millisecond,
		ProjectileSpeed:   800.0,
		Range:             300,
		ArcDegrees:        15.0, // 15° cone spread for pellets
		KnockbackDistance: 0,
		Recoil:            nil, // No recoil (slow fire rate)
		SpreadDegrees:     0,   // No additional movement spread
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
