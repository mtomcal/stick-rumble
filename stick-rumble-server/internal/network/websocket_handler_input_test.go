package network

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	"github.com/stretchr/testify/assert"
)

// TestGetFloat64 tests the getFloat64 helper function
func TestGetFloat64(t *testing.T) {
	tests := []struct {
		name     string
		input    map[string]interface{}
		key      string
		expected float64
	}{
		{
			name:     "returns float64 value",
			input:    map[string]interface{}{"key": 1.5},
			key:      "key",
			expected: 1.5,
		},
		{
			name:     "returns zero for missing key",
			input:    map[string]interface{}{"other": 1.5},
			key:      "key",
			expected: 0,
		},
		{
			name:     "returns zero for non-float64 string value",
			input:    map[string]interface{}{"key": "1.5"},
			key:      "key",
			expected: 0,
		},
		{
			name:     "returns zero for non-float64 bool value",
			input:    map[string]interface{}{"key": true},
			key:      "key",
			expected: 0,
		},
		{
			name:     "returns zero for nil value",
			input:    map[string]interface{}{"key": nil},
			key:      "key",
			expected: 0,
		},
		{
			name:     "returns zero for empty map",
			input:    map[string]interface{}{},
			key:      "key",
			expected: 0,
		},
		{
			name:     "returns negative float64 value",
			input:    map[string]interface{}{"key": -3.14159},
			key:      "key",
			expected: -3.14159,
		},
		{
			name:     "returns zero float64 value",
			input:    map[string]interface{}{"key": 0.0},
			key:      "key",
			expected: 0.0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := getFloat64(tt.input, tt.key)
			assert.Equal(t, tt.expected, result)
		})
	}
}

// TestGetBool tests the getBool helper function
func TestGetBool(t *testing.T) {
	tests := []struct {
		name     string
		input    map[string]interface{}
		key      string
		expected bool
	}{
		{
			name:     "returns true for true value",
			input:    map[string]interface{}{"key": true},
			key:      "key",
			expected: true,
		},
		{
			name:     "returns false for false value",
			input:    map[string]interface{}{"key": false},
			key:      "key",
			expected: false,
		},
		{
			name:     "returns false for missing key",
			input:    map[string]interface{}{"other": true},
			key:      "key",
			expected: false,
		},
		{
			name:     "returns false for non-boolean string value",
			input:    map[string]interface{}{"key": "true"},
			key:      "key",
			expected: false,
		},
		{
			name:     "returns false for non-boolean int value",
			input:    map[string]interface{}{"key": 1},
			key:      "key",
			expected: false,
		},
		{
			name:     "returns false for nil value",
			input:    map[string]interface{}{"key": nil},
			key:      "key",
			expected: false,
		},
		{
			name:     "returns false for empty map",
			input:    map[string]interface{}{},
			key:      "key",
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := getBool(tt.input, tt.key)
			assert.Equal(t, tt.expected, result)
		})
	}
}

// TestHandleInputState tests the handleInputState function
func TestHandleInputState(t *testing.T) {
	t.Run("processes valid input state", func(t *testing.T) {
		handler := NewWebSocketHandler()
		playerID := "test-player-1"

		// Add player to game server first
		handler.gameServer.AddPlayer(playerID)

		// Create valid input data
		validData := map[string]interface{}{
			"up":    true,
			"down":  false,
			"left":  true,
			"right": false,
		}

		// Handle the input state
		handler.handleInputState(playerID, validData)

		// Verify the input was applied
		state, exists := handler.gameServer.GetPlayerState(playerID)
		assert.True(t, exists, "Player should exist")
		// The state returned is a snapshot, input is private
		// We verify the player exists and was updated without error
		assert.Equal(t, playerID, state.ID)
	})

	t.Run("handles invalid data format (not a map)", func(t *testing.T) {
		handler := NewWebSocketHandler()
		playerID := "test-player-2"

		// Add player to game server
		handler.gameServer.AddPlayer(playerID)

		// Pass invalid data (string instead of map)
		handler.handleInputState(playerID, "invalid data")

		// Should not panic, player should still exist
		_, exists := handler.gameServer.GetPlayerState(playerID)
		assert.True(t, exists, "Player should still exist after invalid input")
	})

	t.Run("handles nil data", func(t *testing.T) {
		handler := NewWebSocketHandler()
		playerID := "test-player-3"

		// Add player to game server
		handler.gameServer.AddPlayer(playerID)

		// Pass nil data
		handler.handleInputState(playerID, nil)

		// Should not panic, player should still exist
		_, exists := handler.gameServer.GetPlayerState(playerID)
		assert.True(t, exists, "Player should still exist after nil input")
	})

	t.Run("handles partial input (missing keys)", func(t *testing.T) {
		handler := NewWebSocketHandler()
		playerID := "test-player-4"

		// Add player to game server
		handler.gameServer.AddPlayer(playerID)

		// Create partial input data (only up key)
		partialData := map[string]interface{}{
			"up": true,
		}

		// Handle the input state
		handler.handleInputState(playerID, partialData)

		// Should not panic, player should still exist
		_, exists := handler.gameServer.GetPlayerState(playerID)
		assert.True(t, exists, "Player should still exist after partial input")
	})

	t.Run("handles non-existent player", func(t *testing.T) {
		handler := NewWebSocketHandler()

		// Create valid input data for non-existent player
		validData := map[string]interface{}{
			"up":    true,
			"down":  false,
			"left":  false,
			"right": false,
		}

		// Verify player doesn't exist before
		_, existsBefore := handler.gameServer.GetPlayerState("non-existent-player")
		assert.False(t, existsBefore, "Player should not exist before handleInputState")

		// Handle input for non-existent player
		handler.handleInputState("non-existent-player", validData)

		// Verify no player was created (no side effects)
		_, existsAfter := handler.gameServer.GetPlayerState("non-existent-player")
		assert.False(t, existsAfter, "Player should not be created by handleInputState")
	})

	t.Run("handles all direction combinations", func(t *testing.T) {
		handler := NewWebSocketHandler()
		playerID := "test-player-5"

		// Add player to game server
		handler.gameServer.AddPlayer(playerID)

		// Test all true
		allTrue := map[string]interface{}{
			"up":    true,
			"down":  true,
			"left":  true,
			"right": true,
		}
		handler.handleInputState(playerID, allTrue)

		// Test all false
		allFalse := map[string]interface{}{
			"up":    false,
			"down":  false,
			"left":  false,
			"right": false,
		}
		handler.handleInputState(playerID, allFalse)

		// Player should still exist
		_, exists := handler.gameServer.GetPlayerState(playerID)
		assert.True(t, exists, "Player should still exist after input updates")
	})

	t.Run("processes aim angle from input state", func(t *testing.T) {
		handler := NewWebSocketHandler()
		playerID := "test-player-aim"

		// Add player to game server
		handler.gameServer.AddPlayer(playerID)

		// Create input data with aim angle
		inputWithAim := map[string]interface{}{
			"up":       false,
			"down":     false,
			"left":     false,
			"right":    false,
			"aimAngle": 1.5708, // ~90 degrees in radians
		}

		// Handle the input state
		handler.handleInputState(playerID, inputWithAim)

		// Verify the aim angle was applied
		state, exists := handler.gameServer.GetPlayerState(playerID)
		assert.True(t, exists, "Player should exist")
		assert.InDelta(t, 1.5708, state.AimAngle, 0.0001, "Aim angle should be set")
	})
}

// TestHandleInputStateViaWebSocket tests input:state message handling through WebSocket
func TestHandleInputStateViaWebSocket(t *testing.T) {
	handler := NewWebSocketHandler()
	server := httptest.NewServer(http.HandlerFunc(handler.HandleWebSocket))
	defer server.Close()

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http")

	// Connect a client
	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	assert.NoError(t, err, "Should connect")
	defer conn.Close()

	// Give time for player to be added to game server
	time.Sleep(50 * time.Millisecond)

	// Send input:state message
	inputMsg := Message{
		Type:      "input:state",
		Timestamp: time.Now().UnixMilli(),
		Data: map[string]interface{}{
			"up":    true,
			"down":  false,
			"left":  true,
			"right": false,
		},
	}

	msgBytes, err := json.Marshal(inputMsg)
	assert.NoError(t, err)

	err = conn.WriteMessage(websocket.TextMessage, msgBytes)
	assert.NoError(t, err, "Should send input:state message")

	// Give time for message to be processed
	time.Sleep(50 * time.Millisecond)

	// The message should be processed without error
	// We can't easily verify internal state from here, but we verify no crash
}
