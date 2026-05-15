package db

import (
	"database/sql"
	"encoding/json"
	"fmt"
)

// LifetimeStats represents a player's lifetime game statistics.
type LifetimeStats struct {
	PlayerID       string         `json:"playerId"`
	Kills          int            `json:"kills"`
	Deaths         int            `json:"deaths"`
	Wins           int            `json:"wins"`
	GamesPlayed    int            `json:"gamesPlayed"`
	TotalXp        int            `json:"totalXp"`
	DamageDealt    int            `json:"damageDealt"`
	PerWeaponKills map[string]int `json:"perWeaponKills"`
}

// CreateLifetimeStats initializes a lifetime stats row for a new player.
func CreateLifetimeStats(database *sql.DB, playerID string) error {
	_, err := database.Exec(
		`INSERT INTO lifetime_stats (player_id) VALUES ($1)`, playerID,
	)
	return err
}

// GetLifetimeStats retrieves lifetime stats for a player.
func GetLifetimeStats(database *sql.DB, playerID string) (*LifetimeStats, error) {
	stats := &LifetimeStats{}
	var perWeaponJSON []byte
	err := database.QueryRow(
		`SELECT player_id, kills, deaths, wins, games_played, total_xp, damage_dealt, per_weapon_kills 
		 FROM lifetime_stats WHERE player_id = $1`, playerID,
	).Scan(&stats.PlayerID, &stats.Kills, &stats.Deaths, &stats.Wins, &stats.GamesPlayed,
		&stats.TotalXp, &stats.DamageDealt, &perWeaponJSON)
	if err != nil {
		return nil, err
	}

	stats.PerWeaponKills = make(map[string]int)
	if len(perWeaponJSON) > 0 {
		json.Unmarshal(perWeaponJSON, &stats.PerWeaponKills)
	}
	return stats, nil
}

// SaveLifetimeStats persists updated lifetime stats to the database.
func SaveLifetimeStats(database *sql.DB, stats *LifetimeStats) error {
	perWeaponJSON, err := json.Marshal(stats.PerWeaponKills)
	if err != nil {
		return fmt.Errorf("marshal per_weapon_kills: %w", err)
	}

	_, err = database.Exec(
		`UPDATE lifetime_stats 
		 SET kills = $1, deaths = $2, wins = $3, games_played = $4, total_xp = $5, damage_dealt = $6, per_weapon_kills = $7, updated_at = NOW()
		 WHERE player_id = $8`,
		stats.Kills, stats.Deaths, stats.Wins, stats.GamesPlayed, stats.TotalXp, stats.DamageDealt, perWeaponJSON, stats.PlayerID,
	)
	return err
}

// SaveLifetimeStatsTx persists updated lifetime stats within an existing transaction.
func SaveLifetimeStatsTx(tx *sql.Tx, stats *LifetimeStats) error {
	perWeaponJSON, err := json.Marshal(stats.PerWeaponKills)
	if err != nil {
		return fmt.Errorf("marshal per_weapon_kills: %w", err)
	}

	_, err = tx.Exec(
		`UPDATE lifetime_stats 
		 SET kills = $1, deaths = $2, wins = $3, games_played = $4, total_xp = $5, damage_dealt = $6, per_weapon_kills = $7, updated_at = NOW()
		 WHERE player_id = $8`,
		stats.Kills, stats.Deaths, stats.Wins, stats.GamesPlayed, stats.TotalXp, stats.DamageDealt, perWeaponJSON, stats.PlayerID,
	)
	return err
}

// GetLifetimeStatsTx retrieves lifetime stats for a player within an existing transaction.
func GetLifetimeStatsTx(tx *sql.Tx, playerID string) (*LifetimeStats, error) {
	stats := &LifetimeStats{}
	var perWeaponJSON []byte
	err := tx.QueryRow(
		`SELECT player_id, kills, deaths, wins, games_played, total_xp, damage_dealt, per_weapon_kills 
		 FROM lifetime_stats WHERE player_id = $1`, playerID,
	).Scan(&stats.PlayerID, &stats.Kills, &stats.Deaths, &stats.Wins, &stats.GamesPlayed,
		&stats.TotalXp, &stats.DamageDealt, &perWeaponJSON)
	if err != nil {
		return nil, err
	}

	stats.PerWeaponKills = make(map[string]int)
	if len(perWeaponJSON) > 0 {
		json.Unmarshal(perWeaponJSON, &stats.PerWeaponKills)
	}
	return stats, nil
}
