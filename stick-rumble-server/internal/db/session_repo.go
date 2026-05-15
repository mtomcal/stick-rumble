package db

import (
	"database/sql"
	"log"
	"time"
)

// SessionToken represents a stored session token record.
type SessionToken struct {
	TokenHash string    `json:"-"`
	PlayerID  string    `json:"playerId"`
	ExpiresAt time.Time `json:"expiresAt"`
	CreatedAt time.Time `json:"createdAt"`
}

// CreateSession inserts a new session token record.
func CreateSession(db *sql.DB, hash, playerID string, expiresAt time.Time) error {
	_, err := db.Exec(
		`INSERT INTO session_tokens (token_hash, player_id, expires_at) VALUES ($1, $2, $3)`,
		hash, playerID, expiresAt,
	)
	return err
}

// FindSessionByHash looks up a session by its hash. Returns nil if the session
// is expired. Expired session cleanup is handled by the CleanExpiredSessions goroutine.
func FindSessionByHash(db *sql.DB, hash string) (*SessionToken, error) {
	session := &SessionToken{}
	err := db.QueryRow(
		`SELECT token_hash, player_id, expires_at, created_at FROM session_tokens WHERE token_hash = $1`,
		hash,
	).Scan(&session.TokenHash, &session.PlayerID, &session.ExpiresAt, &session.CreatedAt)

	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	// Check expiry inline (deletion handled by CleanExpiredSessions goroutine)
	if time.Now().After(session.ExpiresAt) {
		return nil, nil
	}

	return session, nil
}

// CleanExpiredSessions periodically deletes expired session tokens.
// Runs every hour by default. Should be started as a goroutine.
func CleanExpiredSessions(db *sql.DB, interval time.Duration) {
	if interval <= 0 {
		interval = 1 * time.Hour
	}
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for range ticker.C {
		result, err := db.Exec(`DELETE FROM session_tokens WHERE expires_at < NOW()`)
		if err != nil {
			log.Printf("failed to clean expired sessions: %v", err)
			continue
		}
		if n, _ := result.RowsAffected(); n > 0 {
			log.Printf("cleaned %d expired session tokens", n)
		}
	}
}
