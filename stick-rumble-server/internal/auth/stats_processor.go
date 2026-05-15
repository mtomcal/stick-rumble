package auth

import (
	"github.com/mtomcal/stick-rumble-server/internal/db"
)

// ProcessMatchEndStats accumulates lifetime stats from a completed match.
// Skips guest players (empty/nil accountID). Returns nil if skipped.
func ProcessMatchEndStats(accountID *string, kills, deaths int, xpEarned int, winners []string, stats *db.LifetimeStats) error {
	if accountID == nil || *accountID == "" {
		return nil // skip guest
	}

	stats.Kills += kills
	stats.Deaths += deaths
	stats.GamesPlayed++
	stats.TotalXp += xpEarned
	stats.DamageDealt += xpEarned // damage tracking TBD — using xpEarned as proxy

	// Check if this player was a winner
	for _, w := range winners {
		if w == *accountID {
			stats.Wins++
			break
		}
	}

	return nil
}
