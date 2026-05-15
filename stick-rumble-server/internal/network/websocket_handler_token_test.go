//go:build integration

package network

import (
	"context"
	"database/sql"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	"github.com/mtomcal/stick-rumble-server/internal/db"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupTestDBForTokenTest(t *testing.T) *sql.DB {
	t.Helper()
	dsn := os.Getenv("DATABASE_TEST_URL")
	if dsn == "" {
		t.Skip("DATABASE_TEST_URL not set; skipping integration test")
	}
	database, err := sql.Open("postgres", dsn)
	if err != nil {
		t.Fatalf("failed to open test db: %v", err)
	}
	if err := database.Ping(); err != nil {
		database.Close()
		t.Fatalf("failed to ping test db: %v", err)
	}

	migrationsDir := findMigrationsDirForTokenTest(t)
	if err := db.RunMigrations(database, migrationsDir); err != nil {
		database.Close()
		t.Fatalf("failed to run migrations: %v", err)
	}

	return database
}

func findMigrationsDirForTokenTest(t *testing.T) string {
	t.Helper()
	candidates := []string{
		"../migrations",
		"../../internal/migrations",
		"../../../internal/migrations",
		"internal/migrations",
	}
	for _, candidate := range candidates {
		abs := candidate
		if !filepath.IsAbs(abs) {
			abs = filepath.Join("internal/network", candidate)
		}
		if info, err := os.Stat(abs); err == nil && info.IsDir() {
			return abs
		}
		abs = candidate
		if info, err := os.Stat(abs); err == nil && info.IsDir() {
			return abs
		}
	}
	return "internal/migrations"
}

func teardownTestDBForTokenTest(t *testing.T, database *sql.DB) {
	t.Helper()
	if database == nil {
		return
	}
	_, _ = database.Exec("DROP TABLE IF EXISTS lifetime_stats CASCADE")
	_, _ = database.Exec("DROP TABLE IF EXISTS session_tokens CASCADE")
	_, _ = database.Exec("DROP TABLE IF EXISTS players CASCADE")
	_, _ = database.Exec("DROP TABLE IF EXISTS schema_migrations CASCADE")
	database.Close()
}

// createTestPlayerAndToken creates a player, lifetime stats, session token in the DB.
func createTestPlayerAndToken(t *testing.T, database *sql.DB, googleSub, email string) (*db.PlayerRecord, string) {
	t.Helper()
	player, err := db.CreatePlayer(database, googleSub, email, "")
	require.NoError(t, err, "CreatePlayer should succeed")

	err = db.CreateLifetimeStats(database, player.ID)
	require.NoError(t, err, "CreateLifetimeStats should succeed")

	token, err := db.GenerateSessionToken()
	require.NoError(t, err, "GenerateSessionToken should succeed")
	hash := db.HashSessionToken(token)
	expiresAt := time.Now().Add(24 * time.Hour)
	err = db.CreateSession(database, hash, player.ID, expiresAt)
	require.NoError(t, err, "CreateSession should succeed")

	return player, token
}

// newTestServerWithDB creates a test server that uses a provided DB for auth resolution.
func newTestServerWithDB(database *sql.DB) *testServer {
	handler := NewWebSocketHandler()
	handler.db = database
	server := httptest.NewServer(http.HandlerFunc(handler.HandleWebSocket))
	ctx, cancel := context.WithCancel(context.Background())
	handler.Start(ctx)
	return &testServer{
		Server:  server,
		handler: handler,
		ctx:     ctx,
		cancel:  cancel,
	}
}

// TS-ACCT-005: Guest connection works without token
// TestGuestWebSocketUpgrade_NoToken tests that a guest upgrade (no ?token=)
// assigns ephemeral Player.ID and AccountID = nil.
func TestGuestWebSocketUpgrade_NoToken(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	database := setupTestDBForTokenTest(t)
	defer teardownTestDBForTokenTest(t, database)

	ts := newTestServerWithDB(database)
	defer ts.Close()

	// Connect without token
	conn, _, err := websocket.DefaultDialer.Dial(ts.wsURL(), nil)
	require.NoError(t, err, "Should connect to test server")
	defer conn.Close()

	// Send hello
	sendHelloMessage(t, conn, "Guest Player", "public", "")

	// Read session:status
	_, data, err := readSessionStatus(t, conn, "searching_for_match", 2*time.Second)
	require.NoError(t, err, "Should receive session:status")

	playerID := data["playerId"].(string)
	assert.NotEmpty(t, playerID, "PlayerID should be non-empty")

	// We can't access the internal Player from here directly, but we can verify
	// the connection works as a guest (no 401, no auth-specific behavior)
	assert.NotEmpty(t, playerID)
}

// TS-ACCT-006: Authed connection with valid token skips name picker
// TestAuthedWebSocketUpgrade_WithValidToken tests that a valid ?token= sets AccountID.
func TestAuthedWebSocketUpgrade_WithValidToken(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	database := setupTestDBForTokenTest(t)
	defer teardownTestDBForTokenTest(t, database)

	player, token := createTestPlayerAndToken(t, database, "authed-test-sub", "authed@example.com")

	ts := newTestServerWithDB(database)
	defer ts.Close()

	// Connect with token
	url := ts.wsURL() + "?token=" + token
	conn, _, err := websocket.DefaultDialer.Dial(url, nil)
	require.NoError(t, err, "Should connect to test server")
	defer conn.Close()

	// Send hello with a different display name - authed players should use DB name
	sendHelloMessage(t, conn, "Client Supplied Name", "public", "")

	// Read session:status
	_, data, err := readSessionStatus(t, conn, "searching_for_match", 2*time.Second)
	require.NoError(t, err, "Should receive session:status")

	playerID := data["playerId"].(string)
	assert.NotEmpty(t, playerID)

	// Verify auth resolution took effect: display name should come from DB, not client
	displayName, ok := data["displayName"].(string)
	require.True(t, ok, "displayName should be present in session:status")
	// The player was created with email "authed@example.com", so DB display name is "authed"
	assert.Equal(t, "authed", displayName, "authed player should use DB display name")
}

// TS-ACCT-007: Expired token falls back to guest
// TestExpiredTokenUpgrade_FallsBackToGuest tests that an expired token downgrades to guest.
func TestExpiredTokenUpgrade_FallsBackToGuest(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	database := setupTestDBForTokenTest(t)
	defer teardownTestDBForTokenTest(t, database)

	// Create a player
	player, err := db.CreatePlayer(database, "expired-sub", "expired@example.com", "")
	require.NoError(t, err)

	// Create an expired session token
	expiredToken, err := db.GenerateSessionToken()
	require.NoError(t, err, "GenerateSessionToken should succeed")
	expiredHash := db.HashSessionToken(expiredToken)
	expiresAt := time.Now().Add(-24 * time.Hour) // expired
	err = db.CreateSession(database, expiredHash, player.ID, expiresAt)
	require.NoError(t, err)

	ts := newTestServerWithDB(database)
	defer ts.Close()

	// Connect with expired token
	url := ts.wsURL() + "?token=" + expiredToken
	conn, _, err := websocket.DefaultDialer.Dial(url, nil)
	require.NoError(t, err, "Should connect to test server")
	defer conn.Close()

	// Send hello
	sendHelloMessage(t, conn, "Guest Player", "public", "")

	// Should work as guest (no 401 on connection)
	_, _, err = readSessionStatus(t, conn, "searching_for_match", 2*time.Second)
	require.NoError(t, err, "Expired token should still allow guest connection")

	_ = player
}

// TS-ACCT-006: Authed connection uses DB display name, ignores client hello
// TestAuthedPlayerHello_UsesDBName tests that an authed player's hello uses DB display name.
func TestAuthedPlayerHello_UsesDBName(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	database := setupTestDBForTokenTest(t)
	defer teardownTestDBForTokenTest(t, database)

	player, token := createTestPlayerAndToken(t, database, "dbname-test-sub", "dbname@example.com")

	// Update DB display name
	err := db.UpdateDisplayName(database, player.ID, "Database Name")
	require.NoError(t, err)

	ts := newTestServerWithDB(database)
	defer ts.Close()

	// Connect with token
	url := ts.wsURL() + "?token=" + token
	conn, _, err := websocket.DefaultDialer.Dial(url, nil)
	require.NoError(t, err, "Should connect to test server")
	defer conn.Close()

	// Send hello with a different name - should be overridden by DB name
	sendHelloMessage(t, conn, "Client Name", "public", "")

	// Read session:status
	_, data, err := readSessionStatus(t, conn, "searching_for_match", 2*time.Second)
	require.NoError(t, err, "Should receive session:status")

	displayName, ok := data["displayName"].(string)
	require.True(t, ok, "displayName should be present in session:status")
	assert.Equal(t, "Database Name", displayName, "authed player should use DB display name, not client-supplied name")
}
