package db

import (
	"database/sql"
	"os"
	"path/filepath"
	"testing"
)

func testDB(t *testing.T) *sql.DB {
	t.Helper()
	dsn := os.Getenv("DATABASE_TEST_URL")
	if dsn == "" {
		t.Skip("DATABASE_TEST_URL not set; skipping integration test")
	}
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		t.Fatalf("failed to open test db: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	if err := db.Ping(); err != nil {
		t.Fatalf("failed to ping test db: %v", err)
	}
	_, _ = db.Exec("DROP TABLE IF EXISTS schema_migrations CASCADE")
	return db
}

func writeMigFile(t *testing.T, dir, name, content string) {
	t.Helper()
	if err := os.WriteFile(filepath.Join(dir, name), []byte(content), 0644); err != nil {
		t.Fatalf("failed to write migration %s: %v", name, err)
	}
}

// ---------------------------------------------------------------------------
// RED tests — behaviors the current code does NOT yet satisfy
// ---------------------------------------------------------------------------

// TestDuplicateRecordMigration_isIdempotent tests that recording the same
// migration filename twice is a no-op (ON CONFLICT DO NOTHING).  Current code
// uses a plain INSERT that fails on the unique constraint → this WILL fail.
func TestDuplicateRecordMigration_isIdempotent(t *testing.T) {
	db := testDB(t)
	if err := ensureMigrationTable(db); err != nil {
		t.Fatalf("ensureMigrationTable: %v", err)
	}

	if err := recordMigration(db, "m001.sql"); err != nil {
		t.Fatalf("first recordMigration failed: %v", err)
	}

	// Second insert of the same filename — must not error.
	if err := recordMigration(db, "m001.sql"); err != nil {
		t.Fatalf("second recordMigration (duplicate) should not error, got: %v", err)
	}

	var count int
	if err := db.QueryRow("SELECT COUNT(*) FROM schema_migrations WHERE filename = $1", "m001.sql").Scan(&count); err != nil {
		t.Fatalf("query count: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected 1 row, got %d", count)
	}
}

// TestMigrationRolledback asserts that a failed migration is rolled back and
// not recorded.  Without transaction wrapping, the current code might record
// nothing after failure (because Exec fails before recordMigration), but the
// test ensures the desired invariant regardless.
func TestMigrationRolledback(t *testing.T) {
	db := testDB(t)
	dir := t.TempDir()

	writeMigFile(t, dir, "001_bad.sql", "CREATE TABLE NOT VALID SQL ;;;;")

	err := RunMigrations(db, dir)
	if err == nil {
		t.Fatal("expected error from bad migration, got nil")
	}

	var count int
	_ = db.QueryRow("SELECT COUNT(*) FROM schema_migrations").Scan(&count)
	if count != 0 {
		t.Fatalf("expected 0 migrations recorded after failure, got %d", count)
	}
}

// TestMultiFilePartialRollback checks that 001_good commits (per-file tx) and
// 002_bad rolls back.  With the old code both statements run bare against the
// connection — 001_good's table will exist, but neither is wrapped in a tx.
// The key assertion: 001_good is recorded, 002_bad is not.
func TestMultiFilePartialRollback(t *testing.T) {
	db := testDB(t)
	dir := t.TempDir()

	writeMigFile(t, dir, "001_good.sql", "CREATE TABLE IF NOT EXISTS safe_tbl (id SERIAL PRIMARY KEY);")
	writeMigFile(t, dir, "002_bad.sql", "CREATE TABLE NOT VALID SQL ;;;;")

	err := RunMigrations(db, dir)
	if err == nil {
		t.Fatal("expected error from 002_bad, got nil")
	}

	var total int
	_ = db.QueryRow("SELECT COUNT(*) FROM schema_migrations").Scan(&total)
	if total != 1 {
		t.Fatalf("expected exactly 1 migration recorded (001_good), got %d", total)
	}

	var exists bool
	_ = db.QueryRow("SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'safe_tbl')").Scan(&exists)
	if !exists {
		t.Fatal("expected safe_tbl to exist after 001_good committed")
	}
}

// TestIdempotentRun checks that running the same migrations twice is a no-op.
func TestIdempotentRun(t *testing.T) {
	db := testDB(t)
	dir := t.TempDir()

	writeMigFile(t, dir, "001_foo.sql", "CREATE TABLE IF NOT EXISTS foo (id SERIAL PRIMARY KEY);")

	if err := RunMigrations(db, dir); err != nil {
		t.Fatalf("first run: %v", err)
	}
	if err := RunMigrations(db, dir); err != nil {
		t.Fatalf("second run should be a no-op, got: %v", err)
	}

	var count int
	_ = db.QueryRow("SELECT COUNT(*) FROM schema_migrations").Scan(&count)
	if count != 1 {
		t.Fatalf("expected 1 row, got %d", count)
	}
}

// TestRunMigrations_success is a happy-path sanity check.
func TestRunMigrations_success(t *testing.T) {
	db := testDB(t)
	dir := t.TempDir()

	writeMigFile(t, dir, "001_a.sql", "CREATE TABLE IF NOT EXISTS tbl_a (id SERIAL PRIMARY KEY);")
	writeMigFile(t, dir, "002_b.sql", "CREATE TABLE IF NOT EXISTS tbl_b (id SERIAL PRIMARY KEY);")

	if err := RunMigrations(db, dir); err != nil {
		t.Fatalf("RunMigrations failed: %v", err)
	}

	var count int
	_ = db.QueryRow("SELECT COUNT(*) FROM schema_migrations").Scan(&count)
	if count != 2 {
		t.Fatalf("expected 2 migrations recorded, got %d", count)
	}
}

// TestRunMigrationsWithDefaults verifies it returns an error gracefully when
// the default dir doesn't exist.
func TestRunMigrationsWithDefaults(t *testing.T) {
	err := RunMigrationsWithDefaults(nil)
	if err == nil {
		t.Fatal("expected error with nil db, got nil")
	}
	t.Logf("RunMigrationsWithDefaults returned: %v", err)
}

// TestEnsureMigrationTable_idempotent verifies the table creation is idempotent.
func TestEnsureMigrationTable_idempotent(t *testing.T) {
	db := testDB(t)
	_, _ = db.Exec("DROP TABLE IF EXISTS schema_migrations CASCADE")

	if err := ensureMigrationTable(db); err != nil {
		t.Fatalf("first call: %v", err)
	}
	if err := ensureMigrationTable(db); err != nil {
		t.Fatalf("second call: %v", err)
	}
}
