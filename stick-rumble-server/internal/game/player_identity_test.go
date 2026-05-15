package game

import (
	"encoding/json"
	"testing"
)

func TestNewPlayerWithoutAccount(t *testing.T) {
	id := "player-1"
	sendChan := make(chan []byte, 10)
	p := NewPlayer(id, sendChan)

	if p.ID != id {
		t.Errorf("ID = %q, want %q", p.ID, id)
	}
	if p.AccountID != nil {
		t.Errorf("AccountID should be nil for guest player, got %v", p.AccountID)
	}
	if p.IsAuthed != false {
		t.Errorf("IsAuthed should be false for guest player")
	}
}

func TestNewPlayerWithAccount(t *testing.T) {
	id := "player-2"
	sendChan := make(chan []byte, 10)
	accountID := "acct-123"
	p := NewPlayerWithAccount(id, sendChan, &accountID, "TestPlayer", true)

	if p.ID != id {
		t.Errorf("ID = %q, want %q", p.ID, id)
	}
	if p.AccountID == nil {
		t.Fatal("AccountID should not be nil for authed player")
	}
	if *p.AccountID != accountID {
		t.Errorf("AccountID = %q, want %q", *p.AccountID, accountID)
	}
	if p.IsAuthed != true {
		t.Errorf("IsAuthed should be true for authed player")
	}
	if p.DisplayName != "TestPlayer" {
		t.Errorf("DisplayName = %q, want %q", p.DisplayName, "TestPlayer")
	}
}

func TestSetAccountIdentity(t *testing.T) {
	id := "player-3"
	sendChan := make(chan []byte, 10)
	p := NewPlayer(id, sendChan)

	// Initially guest
	if p.AccountID != nil || p.IsAuthed {
		t.Error("Expected guest player initially")
	}

	// Set identity
	accountID := "acct-456"
	p.SetAccountIdentity(&accountID, "AuthedPlayer", true)

	if p.AccountID == nil || *p.AccountID != accountID {
		t.Errorf("AccountID = %v, want %q", p.AccountID, accountID)
	}
	if !p.IsAuthed {
		t.Error("IsAuthed should be true after SetAccountIdentity")
	}
	if p.DisplayName != "AuthedPlayer" {
		t.Errorf("DisplayName = %q, want %q", p.DisplayName, "AuthedPlayer")
	}
}

func TestPlayerJSONDoesNotLeakAccountID(t *testing.T) {
	sendChan := make(chan []byte, 10)
	accountID := "secret-acct-789"
	p := NewPlayerWithAccount("player-4", sendChan, &accountID, "TestPlayer", true)

	data, err := json.Marshal(p)
	if err != nil {
		t.Fatal(err)
	}

	var result map[string]any
	if err := json.Unmarshal(data, &result); err != nil {
		t.Fatal(err)
	}

	// AccountID must not appear in JSON output
	if _, exists := result["AccountID"]; exists {
		t.Error("AccountID leaked into JSON output")
	}
	if _, exists := result["accountID"]; exists {
		t.Error("accountID leaked into JSON output (lowercase)")
	}
	if _, exists := result["IsAuthed"]; exists {
		t.Error("IsAuthed leaked into JSON output")
	}
}
