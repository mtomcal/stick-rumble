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

// RecoilPattern defines how a weapon's aim is affected by firing
type RecoilPattern struct {
	VerticalPerShot   float64 // Degrees of vertical climb per shot
	HorizontalPerShot float64 // Degrees of horizontal spread per shot (+/- random)
	RecoveryTime      float64 // Seconds for recoil to fully recover
	MaxAccumulation   float64 // Maximum accumulated recoil in degrees
}

// Weapon defines a weapon type with its properties
type Weapon struct {
	Name              string
	Damage            int
	FireRate          float64        // Rounds per second (or swings per second for melee)
	MagazineSize      int            // Rounds per magazine (0 for melee)
	ReloadTime        time.Duration  // Time to reload (0 for melee)
	ProjectileSpeed   float64        // Projectile speed in px/s (0 for melee)
	Range             float64        // Maximum range in pixels (for melee and ranged)
	ArcDegrees        float64        // Swing arc in degrees (for melee, 0 for ranged)
	KnockbackDistance float64        // Knockback distance in pixels (Bat only)
	Recoil            *RecoilPattern // Recoil pattern (nil for no recoil)
	SpreadDegrees     float64        // Movement spread in degrees (+/- while moving, 0 for stationary)
	IsHitscan         bool           // Story 4.5: Instant-hit weapon (lag compensated) vs projectile
}

// IsMelee returns true if this is a melee weapon
func (w *Weapon) IsMelee() bool {
	return w.MagazineSize == 0 && w.ProjectileSpeed == 0
}

// NewPistol creates a new Pistol weapon instance
func NewPistol() *Weapon {
	return &Weapon{
		Name:              "Pistol",
		Damage:            PistolDamage,
		FireRate:          PistolFireRate,
		MagazineSize:      PistolMagazineSize,
		ReloadTime:        PistolReloadTime,
		ProjectileSpeed:   PistolProjectileSpeed,
		Range:             ProjectileMaxRange,
		ArcDegrees:        0,
		KnockbackDistance: 0,
		Recoil:            nil, // Pistol has no recoil pattern
		SpreadDegrees:     0,   // Pistol has no movement spread
	}
}

// WeaponState tracks the current state of a player's weapon
type WeaponState struct {
	Weapon          *Weapon
	CurrentAmmo     int
	IsReloading     bool
	LastShotTime    time.Time
	ReloadStartTime time.Time
	clock           Clock // Clock for time operations (injectable for testing)
}

// NewWeaponState creates a new weapon state with full ammo and real clock
func NewWeaponState(weapon *Weapon) *WeaponState {
	return NewWeaponStateWithClock(weapon, &RealClock{})
}

// NewWeaponStateWithClock creates a new weapon state with a custom clock (for testing)
func NewWeaponStateWithClock(weapon *Weapon, clock Clock) *WeaponState {
	return &WeaponState{
		Weapon:      weapon,
		CurrentAmmo: weapon.MagazineSize,
		IsReloading: false,
		clock:       clock,
	}
}

// CanShoot returns true if the weapon can fire (or swing for melee)
func (ws *WeaponState) CanShoot() bool {
	// Melee weapons bypass ammo and reload checks
	isMelee := ws.Weapon.IsMelee()

	// Cannot shoot while reloading (ranged only)
	if !isMelee && ws.IsReloading {
		return false
	}

	// Cannot shoot with empty magazine (ranged only)
	if !isMelee && ws.CurrentAmmo <= 0 {
		return false
	}

	// Check fire rate cooldown (both melee and ranged)
	if !ws.LastShotTime.IsZero() {
		cooldown := time.Duration(float64(time.Second) / ws.Weapon.FireRate)
		if ws.clock.Since(ws.LastShotTime) < cooldown {
			return false
		}
	}

	return true
}

// RecordShot records that a shot was fired (or swing for melee), decrements ammo for ranged weapons
func (ws *WeaponState) RecordShot() {
	// Only decrement ammo for ranged weapons
	if !ws.Weapon.IsMelee() && ws.CurrentAmmo > 0 {
		ws.CurrentAmmo--
	}
	ws.LastShotTime = ws.clock.Now()
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
	ws.ReloadStartTime = ws.clock.Now()
}

// CheckReloadComplete checks if reload is done and refills ammo if so
// Returns true if reload just completed
func (ws *WeaponState) CheckReloadComplete() bool {
	if !ws.IsReloading {
		return false
	}

	if ws.clock.Since(ws.ReloadStartTime) >= ws.Weapon.ReloadTime {
		ws.CurrentAmmo = ws.Weapon.MagazineSize
		ws.IsReloading = false
		return true
	}

	return false
}

// CancelReload cancels an in-progress reload
// Used when switching weapons or picking up a new weapon
func (ws *WeaponState) CancelReload() {
	if !ws.IsReloading {
		return
	}

	ws.IsReloading = false
	// Ammo remains at current value (reload progress is lost)
}

// IsEmpty returns true if the magazine is empty
func (ws *WeaponState) IsEmpty() bool {
	return ws.CurrentAmmo <= 0
}

// GetAmmoInfo returns current and max ammo
func (ws *WeaponState) GetAmmoInfo() (current, max int) {
	return ws.CurrentAmmo, ws.Weapon.MagazineSize
}

// CalculateDamageFalloff calculates damage with distance-based falloff
// Damage falloff starts at 50% of max range and decreases linearly to 0 at max range
// Formula from Story 3.3:
//
//	if (distance > maxRange * 0.5) {
//	  damageFalloff = 1.0 - ((distance - maxRange * 0.5) / (maxRange * 0.5))
//	  actualDamage = baseDamage * damageFalloff
//	}
func CalculateDamageFalloff(baseDamage int, distance float64, maxRange float64) float64 {
	// No falloff within first half of range
	falloffStart := maxRange * 0.5
	if distance <= falloffStart {
		return float64(baseDamage)
	}

	// Beyond max range, no damage
	if distance >= maxRange {
		return 0
	}

	// Linear falloff from half range to max range
	falloffRange := maxRange - falloffStart
	distanceBeyondFalloffStart := distance - falloffStart
	damageFalloff := 1.0 - (distanceBeyondFalloffStart / falloffRange)

	return float64(baseDamage) * damageFalloff
}
