package game

import (
	"math"
	"math/rand"
)

const (
	// ShotgunPelletCount is the number of pellets fired per shotgun shot
	ShotgunPelletCount = 8

	// ShotgunPelletDamage is the damage per individual pellet (60 total / 8 pellets = 7.5)
	ShotgunPelletDamage = 7.5
)

// CalculateShotgunPelletAngles calculates the aim angles for all shotgun pellets
// Distributes pellets evenly within the cone spread (ArcDegrees)
// aimAngle is the center aim angle in radians
// Returns slice of angles in radians for each pellet
func CalculateShotgunPelletAngles(aimAngle float64, spreadDegrees float64) []float64 {
	angles := make([]float64, ShotgunPelletCount)
	spreadRadians := (spreadDegrees * math.Pi) / 180.0
	halfSpread := spreadRadians / 2.0

	// Distribute pellets evenly within the spread cone
	// Add some randomness for natural spread pattern
	for i := 0; i < ShotgunPelletCount; i++ {
		// Even distribution from -halfSpread to +halfSpread
		evenSpread := -halfSpread + (spreadRadians * float64(i) / float64(ShotgunPelletCount-1))

		// Add small random offset for natural feel (±10% of even spacing)
		spacing := spreadRadians / float64(ShotgunPelletCount-1)
		randomOffset := (rand.Float64() - 0.5) * spacing * 0.2

		angles[i] = aimAngle + evenSpread + randomOffset
	}

	return angles
}

// ApplyRecoilToAngle applies recoil pattern to aim angle
// Returns the modified angle in radians with recoil applied
func ApplyRecoilToAngle(baseAngle float64, recoil *RecoilPattern, shotsFired int, isMoving bool, weapon *Weapon) float64 {
	if recoil == nil {
		return baseAngle
	}

	// Calculate vertical recoil (accumulates with shots)
	verticalRecoilDegrees := float64(shotsFired) * recoil.VerticalPerShot
	if verticalRecoilDegrees > recoil.MaxAccumulation {
		verticalRecoilDegrees = recoil.MaxAccumulation
	}

	// Calculate horizontal recoil (random per shot)
	horizontalRecoilDegrees := (rand.Float64() - 0.5) * 2.0 * recoil.HorizontalPerShot

	// Apply movement spread if moving
	movementSpreadDegrees := 0.0
	if isMoving && weapon.SpreadDegrees > 0 {
		movementSpreadDegrees = (rand.Float64() - 0.5) * 2.0 * weapon.SpreadDegrees
	}

	// Convert to radians and apply
	totalRecoilRadians := ((verticalRecoilDegrees + horizontalRecoilDegrees + movementSpreadDegrees) * math.Pi) / 180.0

	return baseAngle + totalRecoilRadians
}
