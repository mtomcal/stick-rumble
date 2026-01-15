package game

import (
	"math"
	"math/rand"
	"testing"
)

func TestCalculateShotgunPelletAngles_CorrectCount(t *testing.T) {
	aimAngle := 0.0 // 0 radians = pointing right
	spreadDegrees := 15.0

	angles := CalculateShotgunPelletAngles(aimAngle, spreadDegrees)

	if len(angles) != ShotgunPelletCount {
		t.Errorf("expected %d pellet angles, got %d", ShotgunPelletCount, len(angles))
	}
}

func TestCalculateShotgunPelletAngles_SpreadWithinCone(t *testing.T) {
	aimAngle := 0.0
	spreadDegrees := 15.0
	spreadRadians := (spreadDegrees * math.Pi) / 180.0
	halfSpread := spreadRadians / 2.0

	angles := CalculateShotgunPelletAngles(aimAngle, spreadDegrees)

	for i, angle := range angles {
		// Each pellet should be within the spread cone (with small tolerance for randomness)
		tolerance := spreadRadians * 0.15 // 15% tolerance for random offset
		if angle < aimAngle-halfSpread-tolerance || angle > aimAngle+halfSpread+tolerance {
			t.Errorf("pellet %d angle %f is outside spread cone [%f, %f] (with tolerance)",
				i, angle, aimAngle-halfSpread-tolerance, aimAngle+halfSpread+tolerance)
		}
	}
}

func TestCalculateShotgunPelletAngles_CenteredOnAimAngle(t *testing.T) {
	aimAngle := math.Pi / 4 // 45 degrees
	spreadDegrees := 15.0

	angles := CalculateShotgunPelletAngles(aimAngle, spreadDegrees)

	// Calculate average angle (should be close to aim angle)
	sum := 0.0
	for _, angle := range angles {
		sum += angle
	}
	avgAngle := sum / float64(len(angles))

	// Average should be within 5% of aim angle (accounting for random offsets)
	tolerance := aimAngle * 0.05
	if math.Abs(avgAngle-aimAngle) > tolerance {
		t.Errorf("average pellet angle %f is not centered on aim angle %f (tolerance %f)",
			avgAngle, aimAngle, tolerance)
	}
}

func TestCalculateShotgunPelletAngles_DifferentAimAngles(t *testing.T) {
	spreadDegrees := 15.0

	testAngles := []float64{
		0,                // Right
		math.Pi / 2,      // Up
		math.Pi,          // Left
		-math.Pi / 2,     // Down
		math.Pi / 4,      // Northeast
		-3 * math.Pi / 4, // Southwest
	}

	for _, aimAngle := range testAngles {
		angles := CalculateShotgunPelletAngles(aimAngle, spreadDegrees)

		if len(angles) != ShotgunPelletCount {
			t.Errorf("aim angle %f: expected %d pellets, got %d", aimAngle, ShotgunPelletCount, len(angles))
		}

		// All pellets should be unique (or nearly unique due to randomness)
		for i := 0; i < len(angles); i++ {
			for j := i + 1; j < len(angles); j++ {
				if angles[i] == angles[j] {
					t.Errorf("aim angle %f: pellets %d and %d have identical angles %f",
						aimAngle, i, j, angles[i])
				}
			}
		}
	}
}

func TestApplyRecoilToAngle_NoRecoilPattern(t *testing.T) {
	baseAngle := math.Pi / 4
	weapon := NewShotgun() // Shotgun has no recoil

	result := ApplyRecoilToAngle(baseAngle, weapon.Recoil, 5, false, false, weapon)

	if result != baseAngle {
		t.Errorf("expected no recoil when pattern is nil, got angle %f (base %f)", result, baseAngle)
	}
}

func TestApplyRecoilToAngle_UziVerticalClimb(t *testing.T) {
	uzi := NewUzi()
	baseAngle := 0.0

	// First shot: 2° vertical recoil
	angle1 := ApplyRecoilToAngle(baseAngle, uzi.Recoil, 1, false, false, uzi)
	expectedRadians1 := (2.0 * math.Pi) / 180.0
	tolerance := 0.1 // Radians tolerance (account for random horizontal)

	if math.Abs(angle1-baseAngle-expectedRadians1) > tolerance {
		t.Errorf("shot 1: expected ~%f radians recoil, got %f (delta %f)",
			expectedRadians1, angle1-baseAngle, angle1-baseAngle)
	}

	// Fifth shot: 10° vertical recoil (5 shots * 2° each)
	angle5 := ApplyRecoilToAngle(baseAngle, uzi.Recoil, 5, false, false, uzi)
	expectedRadians5 := (10.0 * math.Pi) / 180.0

	if math.Abs(angle5-baseAngle-expectedRadians5) > tolerance {
		t.Errorf("shot 5: expected ~%f radians recoil, got %f (delta %f)",
			expectedRadians5, angle5-baseAngle, angle5-baseAngle)
	}
}

func TestApplyRecoilToAngle_MaxAccumulation(t *testing.T) {
	uzi := NewUzi()
	baseAngle := 0.0

	// Fire 20 shots (should hit 20° max, but max accumulation is 20°)
	angle20 := ApplyRecoilToAngle(baseAngle, uzi.Recoil, 20, false, false, uzi)
	maxRadians := (uzi.Recoil.MaxAccumulation * math.Pi) / 180.0
	tolerance := 0.1

	recoil := angle20 - baseAngle
	if recoil > maxRadians+tolerance {
		t.Errorf("recoil %f exceeds max accumulation %f", recoil, maxRadians)
	}
}

func TestApplyRecoilToAngle_AK47HorizontalSpread(t *testing.T) {
	ak47 := NewAK47()
	baseAngle := 0.0

	// Fire multiple shots and check that horizontal recoil is applied
	angles := make([]float64, 10)
	for i := 0; i < 10; i++ {
		angles[i] = ApplyRecoilToAngle(baseAngle, ak47.Recoil, 1, false, false, ak47)
	}

	// Check that angles vary (horizontal recoil is random)
	allSame := true
	for i := 1; i < len(angles); i++ {
		if angles[i] != angles[0] {
			allSame = false
			break
		}
	}

	if allSame {
		t.Error("AK47 horizontal recoil should produce varying angles, but all are identical")
	}
}

func TestApplyRecoilToAngle_MovementSpread(t *testing.T) {
	uzi := NewUzi()
	baseAngle := 0.0

	// Fire while stationary
	angleStationary := ApplyRecoilToAngle(baseAngle, uzi.Recoil, 1, false, false, uzi)

	// Fire while moving (should have additional spread)
	anglesMoving := make([]float64, 10)
	for i := 0; i < 10; i++ {
		anglesMoving[i] = ApplyRecoilToAngle(baseAngle, uzi.Recoil, 1, true, false, uzi)
	}

	// Movement spread should cause variation
	hasVariation := false
	for _, angle := range anglesMoving {
		if math.Abs(angle-angleStationary) > 0.01 { // Small threshold for numerical precision
			hasVariation = true
			break
		}
	}

	if !hasVariation {
		t.Error("movement spread should cause angle variation, but all angles are similar")
	}
}

func TestShotgunPelletDamage(t *testing.T) {
	// Verify shotgun damage calculation
	// Total damage: 60
	// Pellets: 8
	// Per-pellet: 7.5
	expectedTotal := 60.0
	actualTotal := ShotgunPelletDamage * float64(ShotgunPelletCount)

	if actualTotal != expectedTotal {
		t.Errorf("shotgun total damage should be %f (8 pellets * 7.5), got %f",
			expectedTotal, actualTotal)
	}

	if ShotgunPelletDamage != 7.5 {
		t.Errorf("shotgun pellet damage should be 7.5, got %f", ShotgunPelletDamage)
	}

	if ShotgunPelletCount != 8 {
		t.Errorf("shotgun should fire 8 pellets, got %d", ShotgunPelletCount)
	}
}

func TestApplyRecoilToAngle_SprintSpreadMultiplier(t *testing.T) {
	// Use a fixed seed for deterministic test results
	// This prevents flaky test failures due to random variance
	rand.Seed(12345)

	uzi := NewUzi()
	baseAngle := 0.0

	// Use larger sample size (1000) for better statistical stability
	sampleSize := 1000

	// Fire multiple times while moving (not sprinting)
	anglesMoving := make([]float64, sampleSize)
	for i := 0; i < sampleSize; i++ {
		anglesMoving[i] = ApplyRecoilToAngle(baseAngle, uzi.Recoil, 1, true, false, uzi)
	}

	// Fire multiple times while sprinting (should have 1.5x spread)
	// DO NOT reset seed - we want different random values from the same sequence
	anglesSprinting := make([]float64, sampleSize)
	for i := 0; i < sampleSize; i++ {
		anglesSprinting[i] = ApplyRecoilToAngle(baseAngle, uzi.Recoil, 1, true, true, uzi)
	}

	// Calculate the absolute deviation from base angle for each set
	movingDeviations := 0.0
	for _, angle := range anglesMoving {
		movingDeviations += math.Abs(angle - baseAngle)
	}
	avgMovingDeviation := movingDeviations / float64(len(anglesMoving))

	sprintingDeviations := 0.0
	for _, angle := range anglesSprinting {
		sprintingDeviations += math.Abs(angle - baseAngle)
	}
	avgSprintingDeviation := sprintingDeviations / float64(len(anglesSprinting))

	// Sprint spread should be approximately 1.5x the moving spread
	// With fixed seed and large sample size, use reasonable tolerance (20%)
	// The tolerance accounts for the fact that we're also getting horizontal recoil
	// and vertical recoil in the mix, not just the movement spread
	expectedRatio := SprintSpreadMultiplier
	actualRatio := avgSprintingDeviation / avgMovingDeviation
	tolerance := 0.20

	if math.Abs(actualRatio-expectedRatio) > tolerance {
		t.Errorf("Sprint spread multiplier should be ~%v, got %v (moving avg: %v, sprint avg: %v)",
			expectedRatio, actualRatio, avgMovingDeviation, avgSprintingDeviation)
	}

	// Sprint deviation should always be greater than moving deviation (on average)
	if avgSprintingDeviation <= avgMovingDeviation {
		t.Errorf("Sprinting deviation (%v) should be greater than moving deviation (%v)",
			avgSprintingDeviation, avgMovingDeviation)
	}
}
