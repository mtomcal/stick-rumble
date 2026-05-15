package db

import (
	"database/sql"
	"fmt"
	"time"

	_ "github.com/lib/pq"
)

// DB is a package-level reference to the application's database connection pool.
// It is set by Connect or ConnectWithConfig and can be used for singleton access.
var DB *sql.DB

// Connect opens a PostgreSQL connection pool using the provided database URL
// (e.g., "postgres://user:pass@host:5432/dbname?sslmode=disable"), verifies
// connectivity with a ping, and sets sensible pool defaults.
func Connect(databaseURL string) (*sql.DB, error) {
	db, err := ConnectWithConfig(databaseURL)
	if err != nil {
		return nil, err
	}
	return db, nil
}

// ConnectWithConfig opens a PostgreSQL connection pool using the given connection
// string, pings the database, and applies standard pool configuration.
func ConnectWithConfig(connStr string) (*sql.DB, error) {
	db, err := sql.Open("postgres", connStr)
	if err != nil {
		return nil, fmt.Errorf("db: failed to open connection: %w", err)
	}

	// Configure connection pool
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)
	db.SetConnMaxIdleTime(1 * time.Minute)

	if err := db.Ping(); err != nil {
		db.Close()
		return nil, fmt.Errorf("db: failed to ping database: %w", err)
	}

	DB = db
	return db, nil
}

// Close shuts down the package-level DB connection pool.
func Close() error {
	if DB != nil {
		return DB.Close()
	}
	return nil
}
