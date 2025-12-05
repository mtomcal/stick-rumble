package game

import (
	"time"
)

// Weapon constants for Pistol (from Story 2.3 requirements)
const (
	// PistolDamage is the damage per shot (25 damage = 4 shots to kill at 100 health)
	PistolDamage = 25

	// PistolFireRate is rounds per second (3 rounds/sec = 333ms cooldown)
	PistolFireRate = 3.0

	// PistolMagazineSize is the number of rounds before reload required
	PistolMagazineSize = 15

	// PistolReloadTime is the time required to reload in milliseconds
	PistolReloadTime = 1500 * time.Millisecond

	// PistolProjectileSpeed is the projectile travel speed in pixels per second
	PistolProjectileSpeed = 800.0

	// ProjectileMaxLifetime is the maximum time a projectile exists (1 second)
	ProjectileMaxLifetime = 1 * time.Second

	// ProjectileMaxRange is the maximum range for hit detection (px)
	// Set to projectile speed * lifetime = 800px/s * 1s = 800px
	ProjectileMaxRange = 800.0
)

// Weapon defines a weapon type with its properties
type Weapon struct {
	Name            string
	Damage          int
	FireRate        float64       // Rounds per second
	MagazineSize    int           // Rounds per magazine
	ReloadTime      time.Duration // Time to reload
	ProjectileSpeed float64       // Projectile speed in px/s
}

// NewPistol creates a new Pistol weapon instance
func NewPistol() *Weapon {
	return &Weapon{
		Name:            "Pistol",
		Damage:          PistolDamage,
		FireRate:        PistolFireRate,
		MagazineSize:    PistolMagazineSize,
		ReloadTime:      PistolReloadTime,
		ProjectileSpeed: PistolProjectileSpeed,
	}
}

// WeaponState tracks the current state of a player's weapon
type WeaponState struct {
	Weapon          *Weapon
	CurrentAmmo     int
	IsReloading     bool
	LastShotTime    time.Time
	ReloadStartTime time.Time
}

// NewWeaponState creates a new weapon state with full ammo
func NewWeaponState(weapon *Weapon) *WeaponState {
	return &WeaponState{
		Weapon:      weapon,
		CurrentAmmo: weapon.MagazineSize,
		IsReloading: false,
	}
}

// CanShoot returns true if the weapon can fire
func (ws *WeaponState) CanShoot() bool {
	// Cannot shoot while reloading
	if ws.IsReloading {
		return false
	}

	// Cannot shoot with empty magazine
	if ws.CurrentAmmo <= 0 {
		return false
	}

	// Check fire rate cooldown
	if !ws.LastShotTime.IsZero() {
		cooldown := time.Duration(float64(time.Second) / ws.Weapon.FireRate)
		if time.Since(ws.LastShotTime) < cooldown {
			return false
		}
	}

	return true
}

// RecordShot records that a shot was fired, decrements ammo
func (ws *WeaponState) RecordShot() {
	if ws.CurrentAmmo > 0 {
		ws.CurrentAmmo--
	}
	ws.LastShotTime = time.Now()
}

// StartReload begins the reload process
func (ws *WeaponState) StartReload() {
	// Don't reload if already reloading
	if ws.IsReloading {
		return
	}

	// Don't reload if magazine is full
	if ws.CurrentAmmo >= ws.Weapon.MagazineSize {
		return
	}

	ws.IsReloading = true
	ws.ReloadStartTime = time.Now()
}

// CheckReloadComplete checks if reload is done and refills ammo if so
// Returns true if reload just completed
func (ws *WeaponState) CheckReloadComplete() bool {
	if !ws.IsReloading {
		return false
	}

	if time.Since(ws.ReloadStartTime) >= ws.Weapon.ReloadTime {
		ws.CurrentAmmo = ws.Weapon.MagazineSize
		ws.IsReloading = false
		return true
	}

	return false
}

// IsEmpty returns true if the magazine is empty
func (ws *WeaponState) IsEmpty() bool {
	return ws.CurrentAmmo <= 0
}

// GetAmmoInfo returns current and max ammo
func (ws *WeaponState) GetAmmoInfo() (current, max int) {
	return ws.CurrentAmmo, ws.Weapon.MagazineSize
}
