//go:build integration

package db

import (
	"strings"
	"testing"
	"time"
)

// TS-ACCT-003: Session token stored and retrieved properly
func TestGenerateSessionToken(t *testing.T) {
	token, err := GenerateSessionToken()
	if err != nil {
		t.Fatal(err)
	}
	if len(token) == 0 {
		t.Error("token should not be empty")
	}
	// Should be base64url encoded (no padding), 32 bytes = 43 chars
	if len(token) != 43 {
		t.Errorf("expected token length 43 (32 bytes base64url), got %d", len(token))
	}
	// No padding characters
	if strings.Contains(token, "=") {
		t.Error("token should not contain padding characters")
	}
}

func TestHashSessionToken(t *testing.T) {
	token := "test-token-value"
	hash := HashSessionToken(token)
	// SHA-256 hex = 64 chars
	if len(hash) != 64 {
		t.Errorf("expected hash length 64, got %d", len(hash))
	}
	// Deterministic
	hash2 := HashSessionToken(token)
	if hash != hash2 {
		t.Error("hash should be deterministic")
	}
	// Different input => different hash
	hash3 := HashSessionToken("different-token")
	if hash == hash3 {
		t.Error("different tokens should produce different hashes")
	}
}

func TestCreateAndFindSession(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	DB := setupTestDB(t)
	defer teardownTestDB(t, DB)

	token, err := GenerateSessionToken()
	if err != nil {
		t.Fatal(err)
	}
	hash := HashSessionToken(token)

	// Create a test player first
	var playerID string
	err = DB.QueryRow("INSERT INTO players (display_name, google_sub) VALUES ($1, $2) RETURNING id", "TestPlayer", "test-sub-123").Scan(&playerID)
	if err != nil {
		t.Fatal(err)
	}

	expiresAt := time.Now().Add(24 * time.Hour)
	err = CreateSession(DB, hash, playerID, expiresAt)
	if err != nil {
		t.Fatal(err)
	}

	session, err := FindSessionByHash(DB, hash)
	if err != nil {
		t.Fatal(err)
	}
	if session == nil {
		t.Fatal("expected session, got nil")
	}
	if session.PlayerID != playerID {
		t.Errorf("PlayerID = %q, want %q", session.PlayerID, playerID)
	}
}

func TestFindExpiredSessionReturnsNil(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	DB := setupTestDB(t)
	defer teardownTestDB(t, DB)

	token, err := GenerateSessionToken()
	if err != nil {
		t.Fatal(err)
	}
	hash := HashSessionToken(token)

	var playerID string
	err = DB.QueryRow("INSERT INTO players (display_name, google_sub) VALUES ($1, $2) RETURNING id", "ExpiredPlayer", "expired-sub").Scan(&playerID)
	if err != nil {
		t.Fatal(err)
	}

	// Create session in the past (already expired)
	expiresAt := time.Now().Add(-24 * time.Hour)
	CreateSession(DB, hash, playerID, expiresAt)

	session, err := FindSessionByHash(DB, hash)
	if err != nil {
		t.Fatal(err)
	}
	if session != nil {
		t.Error("expected nil for expired session, got non-nil")
	}
}
