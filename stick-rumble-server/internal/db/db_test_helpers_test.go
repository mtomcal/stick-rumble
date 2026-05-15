//go:build integration

package db

import (
	"database/sql"
	"os"
	"path/filepath"
	"testing"
)

// setupTestDB creates a test database connection using DATABASE_TEST_URL
// and runs the migrations to set up the schema. It registers a cleanup
// function that drops the schema_migrations table.
func setupTestDB(t *testing.T) *sql.DB {
	t.Helper()
	dsn := os.Getenv("DATABASE_TEST_URL")
	if dsn == "" {
		t.Skip("DATABASE_TEST_URL not set; skipping integration test")
	}
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		t.Fatalf("failed to open test db: %v", err)
	}
	if err := db.Ping(); err != nil {
		db.Close()
		t.Fatalf("failed to ping test db: %v", err)
	}

	// Run migrations from the project's migrations directory
	migrationsDir := findMigrationsDir(t)
	if err := RunMigrations(db, migrationsDir); err != nil {
		db.Close()
		t.Fatalf("failed to run migrations: %v", err)
	}

	return db
}

// teardownTestDB drops all tables and closes the connection.
func teardownTestDB(t *testing.T, db *sql.DB) {
	t.Helper()
	if db == nil {
		return
	}
	// Drop all tables in reverse dependency order
	_, _ = db.Exec("DROP TABLE IF EXISTS lifetime_stats CASCADE")
	_, _ = db.Exec("DROP TABLE IF EXISTS session_tokens CASCADE")
	_, _ = db.Exec("DROP TABLE IF EXISTS players CASCADE")
	_, _ = db.Exec("DROP TABLE IF EXISTS schema_migrations CASCADE")
	db.Close()
}

// findMigrationsDir walks up from the current directory to find internal/migrations.
func findMigrationsDir(t *testing.T) string {
	t.Helper()
	// Try common relative paths
	candidates := []string{
		"../migrations",
		"../../internal/migrations",
		"../../../internal/migrations",
		"internal/migrations",
	}
	// Also try walking up from the test file location
	for _, candidate := range candidates {
		abs := candidate
		if !filepath.IsAbs(abs) {
			// Resolve relative to the db package directory
			abs = filepath.Join("internal/db", candidate)
		}
		if info, err := os.Stat(abs); err == nil && info.IsDir() {
			return abs
		}
		abs = candidate
		if info, err := os.Stat(abs); err == nil && info.IsDir() {
			return abs
		}
	}
	// Last resort: try from the project root
	return "internal/migrations"
}
