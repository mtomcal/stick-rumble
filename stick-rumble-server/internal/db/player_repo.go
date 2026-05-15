package db

import (
	"database/sql"
	"fmt"
	"time"
)

// PlayerRecord represents a player from the database.
type PlayerRecord struct {
	ID          string    `json:"id"`
	GoogleSub   string    `json:"-"`
	DisplayName string    `json:"displayName"`
	AvatarURL   string    `json:"avatarUrl,omitempty"`
	CreatedAt   time.Time `json:"createdAt"`
	LastSeenAt  time.Time `json:"lastSeenAt"`
}

// FindByGoogleSub looks up a player by their Google sub claim.
func FindByGoogleSub(database *sql.DB, googleSub string) (*PlayerRecord, error) {
	p := &PlayerRecord{}
	err := database.QueryRow(
		`SELECT id, google_sub, display_name, COALESCE(avatar_url, ''), created_at, last_seen_at 
		 FROM players WHERE google_sub = $1`, googleSub,
	).Scan(&p.ID, &p.GoogleSub, &p.DisplayName, &p.AvatarURL, &p.CreatedAt, &p.LastSeenAt)
	if err != nil {
		return nil, err
	}
	return p, nil
}

// CreatePlayer inserts a new player record. If email is provided, the local part
// before '@' is used as the initial display name (truncated to 16 chars).
func CreatePlayer(database *sql.DB, googleSub, email, avatarURL string) (*PlayerRecord, error) {
	displayName := "Player"
	if email != "" {
		parts := splitEmail(email)
		if parts != "" {
			displayName = parts
			if len(displayName) > 16 {
				displayName = displayName[:16]
			}
		}
	}

	p := &PlayerRecord{}
	err := database.QueryRow(
		`INSERT INTO players (google_sub, display_name, avatar_url) 
		 VALUES ($1, $2, $3) 
		 RETURNING id, google_sub, display_name, COALESCE(avatar_url, ''), created_at, last_seen_at`,
		googleSub, displayName, avatarURL,
	).Scan(&p.ID, &p.GoogleSub, &p.DisplayName, &p.AvatarURL, &p.CreatedAt, &p.LastSeenAt)
	if err != nil {
		return nil, fmt.Errorf("create player: %w", err)
	}
	return p, nil
}

// FindPlayerByID retrieves a player by their UUID.
func FindPlayerByID(database *sql.DB, id string) (*PlayerRecord, error) {
	p := &PlayerRecord{}
	err := database.QueryRow(
		`SELECT id, google_sub, display_name, COALESCE(avatar_url, ''), created_at, last_seen_at 
		 FROM players WHERE id = $1`, id,
	).Scan(&p.ID, &p.GoogleSub, &p.DisplayName, &p.AvatarURL, &p.CreatedAt, &p.LastSeenAt)
	if err != nil {
		return nil, err
	}
	return p, nil
}

// UpdateDisplayName sets a player's display name.
func UpdateDisplayName(database *sql.DB, playerID, displayName string) error {
	_, err := database.Exec(`UPDATE players SET display_name = $1 WHERE id = $2`, displayName, playerID)
	return err
}

// UpdateLastSeen sets last_seen_at to now for the given player.
func UpdateLastSeen(database *sql.DB, playerID string) error {
	_, err := database.Exec(`UPDATE players SET last_seen_at = NOW() WHERE id = $1`, playerID)
	return err
}

// splitEmail returns the local part (before '@') of an email address.
func splitEmail(email string) string {
	for i, c := range email {
		if c == '@' {
			return email[:i]
		}
	}
	return ""
}
