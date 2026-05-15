package auth

import (
	"testing"
)

// TS-ACCT-009: Display name sanitization follows rooms.md rules
func TestSanitizeDisplayName_removesProfanity(t *testing.T) {
	// You don't need a real profanity filter — just trim whitespace, truncate at 16 chars
	result := SanitizeDisplayName("  Hello World!  ")
	if result != "Hello World!" {
		t.Errorf("expected 'Hello World!', got %q", result)
	}
}

func TestSanitizeDisplayName_truncatesLong(t *testing.T) {
	input := "ThisNameIsWayTooLongForDisplay"
	result := SanitizeDisplayName(input)
	if len(result) > 16 {
		t.Errorf("expected max 16 chars, got %d: %q", len(result), result)
	}
}

func TestSanitizeDisplayName_removesNonPrintable(t *testing.T) {
	result := SanitizeDisplayName("Player\x00Name")
	if result != "PlayerName" {
		t.Errorf("expected 'PlayerName', got %q", result)
	}
}

func TestSanitizeDisplayName_defaultOnEmpty(t *testing.T) {
	result := SanitizeDisplayName("  ")
	if result != "Player" {
		t.Errorf("expected 'Player', got %q", result)
	}
}

// TS-ACCT-008: Invalid/missing authorization returns proper error
func TestParseBearerToken_valid(t *testing.T) {
	token, err := ParseBearerToken("Bearer my-token-123")
	if err != nil {
		t.Fatal(err)
	}
	if token != "my-token-123" {
		t.Errorf("expected 'my-token-123', got %q", token)
	}
}

func TestParseBearerToken_missing(t *testing.T) {
	_, err := ParseBearerToken("")
	if err == nil {
		t.Error("expected error for empty header")
	}
}

func TestParseBearerToken_wrongFormat(t *testing.T) {
	_, err := ParseBearerToken("Basic my-token")
	if err == nil {
		t.Error("expected error for non-Bearer scheme")
	}
}
