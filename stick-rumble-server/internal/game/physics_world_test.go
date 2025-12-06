package game

import (
	"math"
	"testing"
)

func TestNewPhysics(t *testing.T) {
	physics := NewPhysics()
	if physics == nil {
		t.Fatal("NewPhysics() returned nil")
	}
}

func TestNormalize(t *testing.T) {
	tests := []struct {
		name     string
		input    Vector2
		expected Vector2
	}{
		{
			name:     "zero vector",
			input:    Vector2{X: 0, Y: 0},
			expected: Vector2{X: 0, Y: 0},
		},
		{
			name:     "unit vector X",
			input:    Vector2{X: 1, Y: 0},
			expected: Vector2{X: 1, Y: 0},
		},
		{
			name:     "unit vector Y",
			input:    Vector2{X: 0, Y: 1},
			expected: Vector2{X: 0, Y: 1},
		},
		{
			name:     "diagonal vector",
			input:    Vector2{X: 1, Y: 1},
			expected: Vector2{X: 1 / math.Sqrt(2), Y: 1 / math.Sqrt(2)},
		},
		{
			name:     "arbitrary vector",
			input:    Vector2{X: 3, Y: 4},
			expected: Vector2{X: 0.6, Y: 0.8},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := normalize(tt.input)
			if !vectorsAlmostEqual(result, tt.expected, 0.0001) {
				t.Errorf("normalize(%+v) = %+v, want %+v", tt.input, result, tt.expected)
			}
		})
	}
}

func TestClampToArena(t *testing.T) {
	tests := []struct {
		name     string
		input    Vector2
		expected Vector2
	}{
		{
			name:     "within bounds",
			input:    Vector2{X: 960, Y: 540},
			expected: Vector2{X: 960, Y: 540},
		},
		{
			name:     "negative X",
			input:    Vector2{X: -100, Y: 540},
			expected: Vector2{X: PlayerWidth / 2, Y: 540},
		},
		{
			name:     "negative Y",
			input:    Vector2{X: 960, Y: -100},
			expected: Vector2{X: 960, Y: PlayerHeight / 2},
		},
		{
			name:     "exceeds max X",
			input:    Vector2{X: 2000, Y: 540},
			expected: Vector2{X: ArenaWidth - PlayerWidth/2, Y: 540},
		},
		{
			name:     "exceeds max Y",
			input:    Vector2{X: 960, Y: 1200},
			expected: Vector2{X: 960, Y: ArenaHeight - PlayerHeight/2},
		},
		{
			name:     "all bounds exceeded",
			input:    Vector2{X: -1000, Y: 5000},
			expected: Vector2{X: PlayerWidth / 2, Y: ArenaHeight - PlayerHeight/2},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := clampToArena(tt.input)
			if !vectorsAlmostEqual(result, tt.expected, 0.0001) {
				t.Errorf("clampToArena(%+v) = %+v, want %+v", tt.input, result, tt.expected)
			}
		})
	}
}

// NaN validation tests for world/math functions

func TestNormalize_NeverReturnsNaN(t *testing.T) {
	tests := []struct {
		name  string
		input Vector2
	}{
		{
			name:  "zero vector",
			input: Vector2{X: 0, Y: 0},
		},
		{
			name:  "very small values",
			input: Vector2{X: 1e-100, Y: 1e-100},
		},
		{
			name:  "near-zero values",
			input: Vector2{X: 1e-15, Y: 1e-15},
		},
		{
			name:  "one component zero",
			input: Vector2{X: 0, Y: 1e-100},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := normalize(tt.input)
			if math.IsNaN(result.X) || math.IsNaN(result.Y) {
				t.Errorf("normalize(%+v) produced NaN: %+v", tt.input, result)
			}
			if math.IsInf(result.X, 0) || math.IsInf(result.Y, 0) {
				t.Errorf("normalize(%+v) produced Inf: %+v", tt.input, result)
			}
		})
	}
}
