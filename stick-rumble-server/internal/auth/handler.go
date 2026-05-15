package auth

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/mtomcal/stick-rumble-server/internal/db"
	"github.com/mtomcal/stick-rumble-server/internal/game"
)

// AuthHandler handles authentication HTTP endpoints.
type AuthHandler struct {
	DB                     *sql.DB
	GoogleClientID         string
	SessionTokenExpiryDays int
}

// SignInResponse is returned after successful Google sign-in.
type SignInResponse struct {
	Token       string `json:"token"`
	PlayerID    string `json:"playerId"`
	DisplayName string `json:"displayName"`
	AvatarURL   string `json:"avatarUrl,omitempty"`
	IsNewPlayer bool   `json:"isNewPlayer"`
}

// PlayerInfoResponse is returned by GET /api/player/me.
type PlayerInfoResponse struct {
	PlayerID       string                `json:"playerId"`
	DisplayName    string                `json:"displayName"`
	AvatarURL      string                `json:"avatarUrl,omitempty"`
	Level          int                   `json:"level"`
	CurrentLevelXp int                   `json:"currentLevelXp"`
	XpForNextLevel int                   `json:"xpForNextLevel"`
	LifetimeStats  LifetimeStatsResponse `json:"lifetimeStats"`
}

// LifetimeStatsResponse represents lifetime statistics in API responses.
type LifetimeStatsResponse struct {
	Kills       int `json:"kills"`
	Deaths      int `json:"deaths"`
	Wins        int `json:"wins"`
	GamesPlayed int `json:"gamesPlayed"`
	TotalXp     int `json:"totalXp"`
	DamageDealt int `json:"damageDealt"`
}

// NewAuthHandler creates a new AuthHandler.
func NewAuthHandler(database *sql.DB, googleClientID string, sessionTokenExpiryDays int) *AuthHandler {
	if sessionTokenExpiryDays <= 0 {
		sessionTokenExpiryDays = 30
	}
	return &AuthHandler{
		DB:                     database,
		GoogleClientID:         googleClientID,
		SessionTokenExpiryDays: sessionTokenExpiryDays,
	}
}

// HandleGoogleSignIn validates a Google ID token, creates or updates the player,
// generates a session token, and returns sign-in response.
func (h *AuthHandler) HandleGoogleSignIn(w http.ResponseWriter, r *http.Request) {
	if h.DB == nil {
		http.Error(w, `{"error":"service_unavailable"}`, http.StatusServiceUnavailable)
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, 4096)

	var req struct {
		IDToken string `json:"idToken"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid_request"}`, http.StatusBadRequest)
		return
	}

	if req.IDToken == "" {
		http.Error(w, `{"error":"missing_id_token"}`, http.StatusBadRequest)
		return
	}

	googleSub, email, avatarURL, err := validateGoogleToken(req.IDToken, h.GoogleClientID)
	if err != nil {
		http.Error(w, `{"error":"auth_unavailable"}`, http.StatusServiceUnavailable)
		return
	}
	if googleSub == "" {
		http.Error(w, `{"error":"invalid_token"}`, http.StatusUnauthorized)
		return
	}

	player, err := db.FindByGoogleSub(h.DB, googleSub)
	isNewPlayer := false
	if err == sql.ErrNoRows || player == nil {
		isNewPlayer = true
		player, err = db.CreatePlayer(h.DB, googleSub, email, avatarURL)
		if err != nil {
			http.Error(w, `{"error":"failed_to_create_player"}`, http.StatusInternalServerError)
			return
		}
		if err := db.CreateLifetimeStats(h.DB, player.ID); err != nil {
			http.Error(w, `{"error":"failed_to_initialize_stats"}`, http.StatusInternalServerError)
			return
		}
	} else if err != nil {
		http.Error(w, `{"error":"internal_error"}`, http.StatusInternalServerError)
		return
	} else {
		_ = db.UpdateLastSeen(h.DB, player.ID)
	}

	token, err := db.GenerateSessionToken()
	if err != nil {
		http.Error(w, `{"error":"failed_to_generate_token"}`, http.StatusInternalServerError)
		return
	}
	hash := db.HashSessionToken(token)
	expiresAt := time.Now().Add(time.Duration(h.SessionTokenExpiryDays) * 24 * time.Hour)

	if err := db.CreateSession(h.DB, hash, player.ID, expiresAt); err != nil {
		http.Error(w, `{"error":"failed_to_create_session"}`, http.StatusInternalServerError)
		return
	}

	resp := SignInResponse{
		Token:       token,
		PlayerID:    player.ID,
		DisplayName: player.DisplayName,
		AvatarURL:   player.AvatarURL,
		IsNewPlayer: isNewPlayer,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

// validateGoogleToken calls Google's tokeninfo endpoint to validate the ID token.
func validateGoogleToken(idToken, clientID string) (sub string, email string, avatarURL string, err error) {
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Get(fmt.Sprintf("https://oauth2.googleapis.com/tokeninfo?id_token=%s", idToken))
	if err != nil {
		log.Printf("google tokeninfo API error: %v", err)
		return "", "", "", fmt.Errorf("google api unreachable: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", "", "", nil
	}

	var info struct {
		Sub           string `json:"sub"`
		Email         string `json:"email"`
		Picture       string `json:"picture"`
		Aud           string `json:"aud"`
		EmailVerified string `json:"email_verified"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&info); err != nil {
		return "", "", "", fmt.Errorf("failed to decode google response: %w", err)
	}

	if clientID != "" && info.Aud != clientID {
		return "", "", "", nil
	}

	return info.Sub, info.Email, info.Picture, nil
}

// HandleSetDisplayName updates the player's display name.
func (h *AuthHandler) HandleSetDisplayName(w http.ResponseWriter, r *http.Request) {
	if h.DB == nil {
		http.Error(w, `{"error":"service_unavailable"}`, http.StatusServiceUnavailable)
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, 4096)

	token, err := ParseBearerToken(r.Header.Get("Authorization"))
	if err != nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	player, err := ResolveSessionToken(h.DB, token)
	if err != nil || player == nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	var req struct {
		DisplayName string `json:"displayName"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid_request"}`, http.StatusBadRequest)
		return
	}

	sanitized := SanitizeDisplayName(req.DisplayName)
	if err := db.UpdateDisplayName(h.DB, player.ID, sanitized); err != nil {
		http.Error(w, `{"error":"failed_to_update"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"displayName": sanitized})
}

// HandleGetPlayerInfo returns player info with lifetime stats and level.
func (h *AuthHandler) HandleGetPlayerInfo(w http.ResponseWriter, r *http.Request) {
	if h.DB == nil {
		http.Error(w, `{"error":"service_unavailable"}`, http.StatusServiceUnavailable)
		return
	}

	token, err := ParseBearerToken(r.Header.Get("Authorization"))
	if err != nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	player, err := ResolveSessionToken(h.DB, token)
	if err != nil || player == nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	stats, err := db.GetLifetimeStats(h.DB, player.ID)
	if err != nil {
		stats = &db.LifetimeStats{}
	}

	level := 1
	currentLevelXp := 0
	xpForNextLevel := 500

	resp := PlayerInfoResponse{
		PlayerID:       player.ID,
		DisplayName:    player.DisplayName,
		AvatarURL:      player.AvatarURL,
		Level:          level,
		CurrentLevelXp: currentLevelXp,
		XpForNextLevel: xpForNextLevel,
		LifetimeStats: LifetimeStatsResponse{
			Kills:       stats.Kills,
			Deaths:      stats.Deaths,
			Wins:        stats.Wins,
			GamesPlayed: stats.GamesPlayed,
			TotalXp:     stats.TotalXp,
			DamageDealt: stats.DamageDealt,
		},
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

// ResolveSessionToken hashes a bearer token and looks up the session,
// returning the associated PlayerRecord.
func ResolveSessionToken(database *sql.DB, token string) (*db.PlayerRecord, error) {
	hash := db.HashSessionToken(token)
	session, err := db.FindSessionByHash(database, hash)
	if err != nil {
		return nil, err
	}
	if session == nil {
		return nil, nil
	}
	return db.FindPlayerByID(database, session.PlayerID)
}

// SanitizeDisplayName cleans up a display name for storage using the shared game function.
func SanitizeDisplayName(raw string) string {
	return game.SanitizeDisplayNameString(raw)
}

// FindPlayerByID retrieves a player by their DB UUID using an *sql.DB connection.
func FindPlayerByID(database *sql.DB, playerID string) (*db.PlayerRecord, error) {
	return db.FindPlayerByID(database, playerID)
}

// ParseBearerToken extracts the token from an Authorization header.
func ParseBearerToken(header string) (string, error) {
	if header == "" {
		return "", fmt.Errorf("missing authorization header")
	}
	parts := strings.SplitN(header, " ", 2)
	if len(parts) != 2 || parts[0] != "Bearer" {
		return "", fmt.Errorf("invalid authorization scheme")
	}
	return parts[1], nil
}
