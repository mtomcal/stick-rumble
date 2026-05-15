package config

import (
	"os"
	"strconv"
	"strings"
)

const (
	DefaultHost = "127.0.0.1"
	DefaultPort = "8080"
)

type RuntimeConfig struct {
	Host                   string
	Port                   string
	EnableSchemaValidation bool
	GoEnv                  string
	AllowedOrigins         []string
	DatabaseURL            string
	GoogleClientID         string
	SessionTokenExpiryDays int
}

func Load() RuntimeConfig {
	host := strings.TrimSpace(os.Getenv("HOST"))
	if host == "" {
		host = DefaultHost
	}

	port := strings.TrimSpace(os.Getenv("PORT"))
	if port == "" {
		port = DefaultPort
	}

	cfg := RuntimeConfig{
		Host:                   host,
		Port:                   port,
		EnableSchemaValidation: strings.EqualFold(strings.TrimSpace(os.Getenv("ENABLE_SCHEMA_VALIDATION")), "true"),
		GoEnv:                  defaultString(strings.TrimSpace(os.Getenv("GO_ENV")), "development"),
		AllowedOrigins:         splitCSV(os.Getenv("ALLOWED_ORIGINS")),
		DatabaseURL:            defaultString(strings.TrimSpace(os.Getenv("DATABASE_URL")), "postgres://stickrumble:stickrumble_dev@localhost:5432/stickrumble?sslmode=disable"),
		GoogleClientID:         defaultString(strings.TrimSpace(os.Getenv("GOOGLE_CLIENT_ID")), ""),
		SessionTokenExpiryDays: defaultInt(os.Getenv("SESSION_TOKEN_EXPIRY_DAYS"), 30),
	}

	if cfg.SessionTokenExpiryDays <= 0 {
		cfg.SessionTokenExpiryDays = 30 // fallback to default
	}

	return cfg
}

func (c RuntimeConfig) AllowsOrigin(origin string) bool {
	if len(c.AllowedOrigins) == 0 {
		return true
	}

	if strings.TrimSpace(origin) == "" {
		return false
	}

	for _, allowedOrigin := range c.AllowedOrigins {
		if origin == allowedOrigin {
			return true
		}
	}

	return false
}

func defaultInt(raw string, fallback int) int {
	if strings.TrimSpace(raw) == "" {
		return fallback
	}
	val, err := strconv.Atoi(strings.TrimSpace(raw))
	if err != nil {
		return fallback
	}
	return val
}

func defaultString(value, fallback string) string {
	if value == "" {
		return fallback
	}

	return value
}

func splitCSV(raw string) []string {
	if strings.TrimSpace(raw) == "" {
		return nil
	}

	parts := strings.Split(raw, ",")
	values := make([]string, 0, len(parts))
	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed != "" {
			values = append(values, trimmed)
		}
	}

	if len(values) == 0 {
		return nil
	}

	return values
}
