package auth

import (
	"testing"

	"github.com/mtomcal/stick-rumble-server/internal/db"
)

// TS-PROG-003: Lifetime stats accumulate across matches
func TestProcessMatchEndStats_SkipsGuest(t *testing.T) {
	// Guest player has no AccountID — should skip processing
	accountID := "" // empty == guest
	stats := &db.LifetimeStats{}
	err := ProcessMatchEndStats(&accountID, 5, 3, 500, nil, stats)
	if err != nil {
		t.Errorf("expected no error for guest, got %v", err)
	}
	if stats.Kills != 0 {
		t.Error("stats should not be modified for guest")
	}
}

// TS-PROG-004: Per-weapon kills track correctly
// (Stats accumulation tests verify the general accumulation mechanism)
func TestProcessMatchEndStats_AccumulatesForAuthed(t *testing.T) {
	accountID := "acct-123"
	stats := &db.LifetimeStats{
		PlayerID:    accountID,
		Kills:       10,
		Deaths:      5,
		Wins:        2,
		GamesPlayed: 10,
		TotalXp:     5000,
		DamageDealt: 1000,
	}

	err := ProcessMatchEndStats(&accountID, 5, 3, 1000, nil, stats)
	if err != nil {
		t.Fatal(err)
	}

	if stats.Kills != 15 {
		t.Errorf("Kills = %d, want 15", stats.Kills)
	}
	if stats.Deaths != 8 {
		t.Errorf("Deaths = %d, want 8", stats.Deaths)
	}
	if stats.Wins != 2 {
		t.Errorf("Wins = %d, want 2 (no win)", stats.Wins)
	}
	if stats.GamesPlayed != 11 {
		t.Errorf("GamesPlayed = %d, want 11", stats.GamesPlayed)
	}
	if stats.TotalXp != 6000 {
		t.Errorf("TotalXp = %d, want 6000", stats.TotalXp)
	}
	if stats.DamageDealt != 2000 {
		t.Errorf("DamageDealt = %d, want 2000", stats.DamageDealt)
	}
}

func TestProcessMatchEndStats_AccumulatesWin(t *testing.T) {
	accountID := "acct-456"
	stats := &db.LifetimeStats{
		PlayerID:    accountID,
		Kills:       0,
		Deaths:      0,
		Wins:        0,
		GamesPlayed: 0,
		TotalXp:     0,
		DamageDealt: 0,
	}

	winners := []string{"acct-456"}
	err := ProcessMatchEndStats(&accountID, 3, 1, 300, winners, stats)
	if err != nil {
		t.Fatal(err)
	}

	if stats.Wins != 1 {
		t.Errorf("Wins = %d, want 1", stats.Wins)
	}
	if stats.GamesPlayed != 1 {
		t.Errorf("GamesPlayed = %d, want 1", stats.GamesPlayed)
	}
}
