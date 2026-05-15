package db

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

// defaultMigrationTimeout is the maximum time allowed for running all pending
// migrations. If the context for a single migration file expires, the entire
// migration run is aborted to avoid partial application.
const defaultMigrationTimeout = 30 * time.Second

// RunMigrations reads SQL migration files from migrationsDir (sorted by
// filename), applies each one that has not yet been recorded in the
// schema_migrations tracking table, and records the result.
//
// Each migration file is executed within its own database transaction so that
// a failure does not leave partial state.  The schema_migrations table is
// created automatically if it does not exist.
//
// A default context timeout of 30 seconds is applied to the whole migration
// run.
func RunMigrations(db *sql.DB, migrationsDir string) error {
	ctx, cancel := context.WithTimeout(context.Background(), defaultMigrationTimeout)
	defer cancel()
	return RunMigrationsWithContext(ctx, db, migrationsDir)
}

// RunMigrationsWithContext is like RunMigrations but uses the caller-provided
// context for cancellation and timeout control.
func RunMigrationsWithContext(ctx context.Context, db *sql.DB, migrationsDir string) error {
	if db == nil {
		return errors.New("db: database connection is nil")
	}

	// Check for context cancellation before doing any work.
	if ctx.Err() != nil {
		return fmt.Errorf("db: migration aborted: %w", ctx.Err())
	}

	if err := ensureMigrationTable(db); err != nil {
		return fmt.Errorf("db: failed to create schema_migrations table: %w", err)
	}

	entries, err := os.ReadDir(migrationsDir)
	if err != nil {
		return fmt.Errorf("db: failed to read migrations directory %s: %w", migrationsDir, err)
	}

	var sqlFiles []string
	for _, entry := range entries {
		if !entry.IsDir() && strings.HasSuffix(strings.ToLower(entry.Name()), ".sql") {
			sqlFiles = append(sqlFiles, entry.Name())
		}
	}
	sort.Strings(sqlFiles)

	for _, filename := range sqlFiles {
		// Check context before each migration.
		if ctx.Err() != nil {
			return fmt.Errorf("db: migration aborted: %w", ctx.Err())
		}

		applied, err := isMigrationApplied(db, filename)
		if err != nil {
			return fmt.Errorf("db: failed to check migration %s: %w", filename, err)
		}
		if applied {
			log.Printf("db: migration %s already applied, skipping", filename)
			continue
		}

		content, err := os.ReadFile(filepath.Join(migrationsDir, filename))
		if err != nil {
			return fmt.Errorf("db: failed to read migration file %s: %w", filename, err)
		}

		// Wrap each migration in its own transaction so that partial
		// failure never leaves the database in an inconsistent state.
		tx, err := db.BeginTx(ctx, nil)
		if err != nil {
			return fmt.Errorf("db: failed to begin transaction for %s: %w", filename, err)
		}

		if _, err := tx.ExecContext(ctx, string(content)); err != nil {
			_ = tx.Rollback()
			return fmt.Errorf("db: failed to execute migration %s: %w", filename, err)
		}

		if err := tx.Commit(); err != nil {
			return fmt.Errorf("db: failed to commit transaction for %s: %w", filename, err)
		}

		// Record the migration AFTER the transaction has committed
		// successfully.  Use ON CONFLICT DO NOTHING so that two server
		// instances racing do not cause a duplicate-key error.
		if err := recordMigration(db, filename); err != nil {
			return fmt.Errorf("db: failed to record migration %s: %w", filename, err)
		}

		log.Printf("db: applied migration %s", filename)
	}

	return nil
}

// ensureMigrationTable creates the schema_migrations tracking table if it does not exist.
func ensureMigrationTable(db *sql.DB) error {
	query := `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version SERIAL PRIMARY KEY,
			filename VARCHAR(255) NOT NULL UNIQUE,
			applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`
	_, err := db.Exec(query)
	return err
}

// isMigrationApplied checks whether a given migration filename has already been recorded.
func isMigrationApplied(db *sql.DB, filename string) (bool, error) {
	var count int
	err := db.QueryRow("SELECT COUNT(*) FROM schema_migrations WHERE filename = $1", filename).Scan(&count)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

// recordMigration inserts a record into schema_migrations for the given
// filename.  It uses ON CONFLICT DO NOTHING so that duplicate inserts (which
// can happen when two server instances race) do not produce an error.
func recordMigration(db *sql.DB, filename string) error {
	_, err := db.Exec(
		"INSERT INTO schema_migrations (filename, applied_at) VALUES ($1, NOW()) ON CONFLICT (filename) DO NOTHING",
		filename,
	)
	return err
}

// RunMigrationsWithDefaults is a convenience helper that calls RunMigrations
// with the default migrations directory path (relative to the server binary).
func RunMigrationsWithDefaults(db *sql.DB) error {
	return RunMigrations(db, "internal/migrations")
}
