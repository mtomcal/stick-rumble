package game

// XpForLevel returns the XP required to reach the given level.
// XP scales linearly: level N requires N * 500 XP.
func XpForLevel(level int) int {
	return level * XpPerLevelBase
}

// LevelForXp returns the player's level given their total XP.
// Uses cumulative XP thresholds: each level N costs XpForLevel(N) to advance from N to N+1.
// Minimum returned level is 1.
func LevelForXp(totalXp int) int {
	if totalXp < 0 {
		return 1
	}
	// Cap at a reasonable maximum to prevent CPU exhaustion from corrupted data.
	// Level 10000 requires ~50 billion cumulative XP, far beyond any realistic play.
	const maxLevel = 10000
	level := 1
	for level <= maxLevel && totalXp >= XpForLevel(level) {
		totalXp -= XpForLevel(level)
		level++
	}
	return level
}
