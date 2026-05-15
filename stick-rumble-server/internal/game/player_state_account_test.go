package game

import (
	"encoding/json"
	"testing"
)

func TestPlayerStateAccountID(t *testing.T) {
	ps := NewPlayerState("player-1", "TestPlayer")

	if ps.AccountID != nil {
		t.Error("AccountID should be nil initially")
	}

	accountID := "acct-123"
	ps.SetAccountID(&accountID)

	if ps.AccountID == nil {
		t.Fatal("AccountID should not be nil after SetAccountID")
	}
	if *ps.AccountID != accountID {
		t.Errorf("AccountID = %q, want %q", *ps.AccountID, accountID)
	}

	// Set back to nil (guest)
	ps.SetAccountID(nil)
	if ps.AccountID != nil {
		t.Error("AccountID should be nil after setting to nil")
	}
}

func TestPlayerStateJSONDoesNotLeakAccountID(t *testing.T) {
	ps := NewPlayerState("player-2", "TestPlayer")
	accountID := "secret-acct"
	ps.SetAccountID(&accountID)

	data, err := json.Marshal(ps)
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
}
