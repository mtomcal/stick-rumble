package network

import (
	"encoding/json"
	"testing"

	"github.com/mtomcal/stick-rumble-server/internal/game"
)

func TestPublicPlayerScoreExcludesAccountID(t *testing.T) {
	score := game.PlayerScore{
		PlayerID:    "player-1",
		DisplayName: "TestPlayer",
		Kills:       5,
		Deaths:      3,
		XP:          500,
		AccountID:   strPtr("secret-acct"),
	}

	// Test that marshaling the public DTO doesn't include AccountID
	data, err := json.Marshal(score)
	if err != nil {
		t.Fatal(err)
	}

	var result map[string]any
	if err := json.Unmarshal(data, &result); err != nil {
		t.Fatal(err)
	}

	if _, exists := result["AccountID"]; exists {
		t.Error("AccountID leaked into JSON output (capitalized)")
	}
	if _, exists := result["accountID"]; exists {
		t.Error("accountID leaked into JSON output (camelCase)")
	}

	// Verify expected fields are present
	if result["playerId"] != "player-1" {
		t.Errorf("playerId = %v, want player-1", result["playerId"])
	}
	if result["displayName"] != "TestPlayer" {
		t.Errorf("displayName = %v, want TestPlayer", result["displayName"])
	}
}

func strPtr(s string) *string { return &s }
