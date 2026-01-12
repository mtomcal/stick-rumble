package network

import (
	"os"
	"testing"
	"time"

	"github.com/mtomcal/stick-rumble-server/internal/game"
	"github.com/stretchr/testify/assert"
)

// TestValidateOutgoingMessage tests schema validation for outgoing messages
func TestValidateOutgoingMessage(t *testing.T) {
	// Enable schema validation for tests
	os.Setenv("ENABLE_SCHEMA_VALIDATION", "true")
	defer os.Unsetenv("ENABLE_SCHEMA_VALIDATION")

	handler := NewWebSocketHandler()

	t.Run("validates player:move message successfully", func(t *testing.T) {
		data := map[string]interface{}{
			"players": []map[string]interface{}{
				{
					"id": "player-123",
					"position": map[string]interface{}{
						"x": 100.0,
						"y": 200.0,
					},
					"velocity": map[string]interface{}{
						"x": 10.0,
						"y": 20.0,
					},
					"aimAngle": 1.57,
					"health":   100,
					"kills":    5,
					"xp":       150,
				},
			},
		}

		err := handler.validateOutgoingMessage("player:move", data)
		assert.NoError(t, err, "Valid player:move data should pass validation")
	})

	t.Run("validates room:joined message successfully", func(t *testing.T) {
		data := map[string]interface{}{
			"playerId": "player-456",
		}

		err := handler.validateOutgoingMessage("room:joined", data)
		assert.NoError(t, err, "Valid room:joined data should pass validation")
	})

	t.Run("validates projectile:spawn message successfully", func(t *testing.T) {
		data := map[string]interface{}{
			"id":      "projectile-789",
			"ownerId": "player-123",
			"position": map[string]interface{}{
				"x": 50.0,
				"y": 75.0,
			},
			"velocity": map[string]interface{}{
				"x": 100.0,
				"y": 50.0,
			},
		}

		err := handler.validateOutgoingMessage("projectile:spawn", data)
		assert.NoError(t, err, "Valid projectile:spawn data should pass validation")
	})

	t.Run("validates weapon:state message successfully", func(t *testing.T) {
		data := map[string]interface{}{
			"currentAmmo": 25,
			"maxAmmo":     30,
			"isReloading": false,
			"canShoot":    true,
		}

		err := handler.validateOutgoingMessage("weapon:state", data)
		assert.NoError(t, err, "Valid weapon:state data should pass validation")
	})

	t.Run("validates match:timer message successfully", func(t *testing.T) {
		data := map[string]interface{}{
			"remainingSeconds": 120,
		}

		err := handler.validateOutgoingMessage("match:timer", data)
		assert.NoError(t, err, "Valid match:timer data should pass validation")
	})

	t.Run("validates match:ended message successfully", func(t *testing.T) {
		data := map[string]interface{}{
			"winners": []string{"player-123"},
			"finalScores": map[string]interface{}{
				"player-123": 10,
				"player-456": 5,
			},
			"reason": "time_limit",
		}

		err := handler.validateOutgoingMessage("match:ended", data)
		assert.NoError(t, err, "Valid match:ended data should pass validation")
	})

	t.Run("validates weapon:spawned message successfully", func(t *testing.T) {
		data := map[string]interface{}{
			"crates": []map[string]interface{}{
				{
					"id": "crate-1",
					"position": map[string]interface{}{
						"x": 300.0,
						"y": 400.0,
					},
					"weaponType":  "uzi",
					"isAvailable": true,
				},
			},
		}

		err := handler.validateOutgoingMessage("weapon:spawned", data)
		assert.NoError(t, err, "Valid weapon:spawned data should pass validation")
	})

	t.Run("validates weapon:pickup_confirmed message successfully", func(t *testing.T) {
		data := map[string]interface{}{
			"playerId":        "player-123",
			"crateId":         "crate-1",
			"weaponType":      "uzi",
			"nextRespawnTime": time.Now().Unix(),
		}

		err := handler.validateOutgoingMessage("weapon:pickup_confirmed", data)
		assert.NoError(t, err, "Valid weapon:pickup_confirmed data should pass validation")
	})

	t.Run("fails validation for invalid player:move data", func(t *testing.T) {
		data := map[string]interface{}{
			// Missing required "players" field entirely
			"invalid": "data",
		}

		err := handler.validateOutgoingMessage("player:move", data)
		assert.Error(t, err, "Invalid player:move data should fail validation")
	})

	t.Run("fails validation for missing required field", func(t *testing.T) {
		data := map[string]interface{}{
			// Missing playerId
		}

		err := handler.validateOutgoingMessage("room:joined", data)
		assert.Error(t, err, "Missing required field should fail validation")
	})

	t.Run("skips validation when ENABLE_SCHEMA_VALIDATION is false", func(t *testing.T) {
		os.Setenv("ENABLE_SCHEMA_VALIDATION", "false")
		defer os.Setenv("ENABLE_SCHEMA_VALIDATION", "true")

		data := map[string]interface{}{
			// Invalid data (missing required fields)
		}

		err := handler.validateOutgoingMessage("room:joined", data)
		assert.NoError(t, err, "Validation should be skipped when disabled")
	})

	t.Run("skips validation when ENABLE_SCHEMA_VALIDATION is not set", func(t *testing.T) {
		os.Unsetenv("ENABLE_SCHEMA_VALIDATION")
		defer os.Setenv("ENABLE_SCHEMA_VALIDATION", "true")

		data := map[string]interface{}{
			// Invalid data (missing required fields)
		}

		err := handler.validateOutgoingMessage("room:joined", data)
		assert.NoError(t, err, "Validation should be skipped when not enabled")
	})

	t.Run("validates player:damaged message successfully", func(t *testing.T) {
		data := map[string]interface{}{
			"victimId":     "player-123",
			"attackerId":   "player-456",
			"damage":       25,
			"newHealth":    75,
			"projectileId": "projectile-789",
		}

		err := handler.validateOutgoingMessage("player:damaged", data)
		assert.NoError(t, err, "Valid player:damaged data should pass validation")
	})

	t.Run("validates hit:confirmed message successfully", func(t *testing.T) {
		data := map[string]interface{}{
			"victimId":     "player-123",
			"damage":       25,
			"projectileId": "projectile-789",
		}

		err := handler.validateOutgoingMessage("hit:confirmed", data)
		assert.NoError(t, err, "Valid hit:confirmed data should pass validation")
	})

	t.Run("validates player:death message successfully", func(t *testing.T) {
		data := map[string]interface{}{
			"victimId":   "player-123",
			"attackerId": "player-456",
		}

		err := handler.validateOutgoingMessage("player:death", data)
		assert.NoError(t, err, "Valid player:death data should pass validation")
	})

	t.Run("validates player:kill_credit message successfully", func(t *testing.T) {
		data := map[string]interface{}{
			"killerId":    "player-456",
			"victimId":    "player-123",
			"killerKills": 3,
			"killerXP":    150,
		}

		err := handler.validateOutgoingMessage("player:kill_credit", data)
		assert.NoError(t, err, "Valid player:kill_credit data should pass validation")
	})

	t.Run("validates player:respawn message successfully", func(t *testing.T) {
		data := map[string]interface{}{
			"playerId": "player-123",
			"position": map[string]interface{}{
				"x": 100.0,
				"y": 200.0,
			},
			"health": 100,
		}

		err := handler.validateOutgoingMessage("player:respawn", data)
		assert.NoError(t, err, "Valid player:respawn data should pass validation")
	})

	t.Run("validates projectile:destroy message successfully", func(t *testing.T) {
		data := map[string]interface{}{
			"id": "projectile-789",
		}

		err := handler.validateOutgoingMessage("projectile:destroy", data)
		assert.NoError(t, err, "Valid projectile:destroy data should pass validation")
	})

	t.Run("validates shoot:failed message successfully", func(t *testing.T) {
		data := map[string]interface{}{
			"reason": "reloading",
		}

		err := handler.validateOutgoingMessage("shoot:failed", data)
		assert.NoError(t, err, "Valid shoot:failed data should pass validation")
	})

	t.Run("validates weapon:respawned message successfully", func(t *testing.T) {
		data := map[string]interface{}{
			"crateId":    "crate-1",
			"weaponType": "uzi",
			"position": map[string]interface{}{
				"x": 300.0,
				"y": 400.0,
			},
		}

		err := handler.validateOutgoingMessage("weapon:respawned", data)
		assert.NoError(t, err, "Valid weapon:respawned data should pass validation")
	})
}

// TestBroadcastWithValidation tests that broadcast functions validate messages
func TestBroadcastWithValidation(t *testing.T) {
	// Enable schema validation for tests
	os.Setenv("ENABLE_SCHEMA_VALIDATION", "true")
	defer os.Unsetenv("ENABLE_SCHEMA_VALIDATION")

	handler := NewWebSocketHandler()

	t.Run("broadcastPlayerStates validates message schema", func(t *testing.T) {
		// Valid player state
		playerStates := []game.PlayerState{
			{
				ID:       "player-123",
				Position: game.Vector2{X: 100, Y: 200},
				Velocity: game.Vector2{X: 10, Y: 20},
				AimAngle: 1.57,
				Health:   100,
				Kills:    5,
				XP:       150,
			},
		}

		// Should not panic with valid data
		assert.NotPanics(t, func() {
			handler.broadcastPlayerStates(playerStates)
		}, "broadcastPlayerStates should not panic with valid data")
	})

	t.Run("broadcastProjectileSpawn validates message schema", func(t *testing.T) {
		// Valid projectile
		proj := &game.Projectile{
			ID:       "projectile-789",
			OwnerID:  "player-123",
			Position: game.Vector2{X: 50, Y: 75},
			Velocity: game.Vector2{X: 100, Y: 50},
		}

		// Should not panic with valid data
		assert.NotPanics(t, func() {
			handler.broadcastProjectileSpawn(proj)
		}, "broadcastProjectileSpawn should not panic with valid data")
	})
}
