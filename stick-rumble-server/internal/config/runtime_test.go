package config

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestLoadDefaults(t *testing.T) {
	t.Setenv("HOST", "")
	t.Setenv("PORT", "")
	t.Setenv("ENABLE_SCHEMA_VALIDATION", "")
	t.Setenv("GO_ENV", "")
	t.Setenv("ALLOWED_ORIGINS", "")
	t.Setenv("DATABASE_URL", "")
	t.Setenv("GOOGLE_CLIENT_ID", "")
	t.Setenv("SESSION_TOKEN_EXPIRY_DAYS", "")

	cfg := Load()

	assert.Equal(t, DefaultHost, cfg.Host)
	assert.Equal(t, DefaultPort, cfg.Port)
	assert.False(t, cfg.EnableSchemaValidation)
	assert.Equal(t, "development", cfg.GoEnv)
	assert.Nil(t, cfg.AllowedOrigins)
	assert.Equal(t, "postgres://stickrumble:stickrumble_dev@localhost:5432/stickrumble?sslmode=disable", cfg.DatabaseURL)
	assert.Equal(t, "", cfg.GoogleClientID)
	assert.Equal(t, 30, cfg.SessionTokenExpiryDays)
}

func TestLoadConfiguredValues(t *testing.T) {
	t.Setenv("HOST", "127.0.0.1")
	t.Setenv("PORT", "9090")
	t.Setenv("ENABLE_SCHEMA_VALIDATION", "true")
	t.Setenv("GO_ENV", "production")
	t.Setenv("ALLOWED_ORIGINS", "https://stickrumble.example, https://cdn.example")
	t.Setenv("DATABASE_URL", "postgres://user:pass@prod:5432/stickrumble")
	t.Setenv("GOOGLE_CLIENT_ID", "my-client-id.apps.googleusercontent.com")
	t.Setenv("SESSION_TOKEN_EXPIRY_DAYS", "14")

	cfg := Load()

	assert.Equal(t, "127.0.0.1", cfg.Host)
	assert.Equal(t, "9090", cfg.Port)
	assert.True(t, cfg.EnableSchemaValidation)
	assert.Equal(t, "production", cfg.GoEnv)
	assert.Equal(t, []string{"https://stickrumble.example", "https://cdn.example"}, cfg.AllowedOrigins)
	assert.Equal(t, "postgres://user:pass@prod:5432/stickrumble", cfg.DatabaseURL)
	assert.Equal(t, "my-client-id.apps.googleusercontent.com", cfg.GoogleClientID)
	assert.Equal(t, 14, cfg.SessionTokenExpiryDays)
}

func TestAllowsOrigin(t *testing.T) {
	cfg := RuntimeConfig{
		AllowedOrigins: []string{"https://stickrumble.example"},
	}

	assert.True(t, cfg.AllowsOrigin("https://stickrumble.example"))
	assert.False(t, cfg.AllowsOrigin("https://other.example"))
	assert.False(t, cfg.AllowsOrigin(""))
}

func TestAllowsOriginWithNoAllowlist(t *testing.T) {
	cfg := RuntimeConfig{}

	assert.True(t, cfg.AllowsOrigin("https://stickrumble.example"))
	assert.True(t, cfg.AllowsOrigin(""))
}
