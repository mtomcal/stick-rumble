package config

import (
	"os"
	"strings"
)

const (
	DefaultHost = "0.0.0.0"
	DefaultPort = "8080"
)

type RuntimeConfig struct {
	Host                   string
	Port                   string
	EnableSchemaValidation bool
	GoEnv                  string
	AllowedOrigins         []string
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

	return RuntimeConfig{
		Host:                   host,
		Port:                   port,
		EnableSchemaValidation: strings.EqualFold(strings.TrimSpace(os.Getenv("ENABLE_SCHEMA_VALIDATION")), "true"),
		GoEnv:                  defaultString(strings.TrimSpace(os.Getenv("GO_ENV")), "development"),
		AllowedOrigins:         splitCSV(os.Getenv("ALLOWED_ORIGINS")),
	}
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
