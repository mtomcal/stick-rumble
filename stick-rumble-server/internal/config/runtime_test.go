package config

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestLoadDefaults(t *testing.T) {
	t.Setenv("PORT", "")
	t.Setenv("ENABLE_SCHEMA_VALIDATION", "")
	t.Setenv("GO_ENV", "")
	t.Setenv("ALLOWED_ORIGINS", "")

	cfg := Load()

	assert.Equal(t, DefaultPort, cfg.Port)
	assert.False(t, cfg.EnableSchemaValidation)
	assert.Equal(t, "development", cfg.GoEnv)
	assert.Nil(t, cfg.AllowedOrigins)
}

func TestLoadConfiguredValues(t *testing.T) {
	t.Setenv("PORT", "9090")
	t.Setenv("ENABLE_SCHEMA_VALIDATION", "true")
	t.Setenv("GO_ENV", "production")
	t.Setenv("ALLOWED_ORIGINS", "https://stickrumble.example, https://cdn.example")

	cfg := Load()

	assert.Equal(t, "9090", cfg.Port)
	assert.True(t, cfg.EnableSchemaValidation)
	assert.Equal(t, "production", cfg.GoEnv)
	assert.Equal(t, []string{"https://stickrumble.example", "https://cdn.example"}, cfg.AllowedOrigins)
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
