package game

import "math"

// vectorsAlmostEqual compares two vectors with tolerance for floating point errors
func vectorsAlmostEqual(a, b Vector2, epsilon float64) bool {
	return math.Abs(a.X-b.X) < epsilon && math.Abs(a.Y-b.Y) < epsilon
}
