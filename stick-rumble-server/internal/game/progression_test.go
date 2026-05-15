package game

import "testing"

// TS-PROG-001: XP converts to correct level
func TestXpForLevel(t *testing.T) {
	// xpForLevel(N) = N * 500
	tests := []struct {
		level    int
		expected int
	}{
		{1, 500},
		{2, 1000},
		{3, 1500},
		{5, 2500},
		{10, 5000},
	}
	for _, tt := range tests {
		result := XpForLevel(tt.level)
		if result != tt.expected {
			t.Errorf("XpForLevel(%d) = %d, want %d", tt.level, result, tt.expected)
		}
	}
}

// TS-PROG-002: Level-up detection fires on crossing threshold
// (LevelForXp function is the core building block for level-up detection)
func TestLevelForXp(t *testing.T) {
	// boundary values
	tests := []struct {
		totalXp  int
		expected int
	}{
		{-1, 1},
		{-500, 1},
		{0, 1},
		{499, 1},
		{500, 2},
		{999, 2},
		{1500, 3},
		{3200, 4},
		{4500, 4},
		{10000, 6},
		{0, 1}, // double-check 0
	}
	for _, tt := range tests {
		result := LevelForXp(tt.totalXp)
		if result != tt.expected {
			t.Errorf("LevelForXp(%d) = %d, want %d", tt.totalXp, result, tt.expected)
		}
	}
}
