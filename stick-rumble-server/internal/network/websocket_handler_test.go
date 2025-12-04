package network

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	"github.com/mtomcal/stick-rumble-server/internal/game"
	"github.com/stretchr/testify/assert"
)

func TestWebSocketUpgrade(t *testing.T) {
	// Create test server
	server := httptest.NewServer(http.HandlerFunc(HandleWebSocket))
	defer server.Close()

	// Convert http:// to ws://
	wsURL := "ws" + strings.TrimPrefix(server.URL, "http")

	// Connect as client
	conn, resp, err := websocket.DefaultDialer.Dial(wsURL, nil)
	assert.NoError(t, err, "WebSocket upgrade should succeed")
	assert.Equal(t, http.StatusSwitchingProtocols, resp.StatusCode, "Should return 101 Switching Protocols")
	defer conn.Close()

	// Verify connection is established and functional
	assert.NotNil(t, conn, "Connection should be established")

	// Verify we can send a ping to test connection is working
	err = conn.WriteMessage(websocket.PingMessage, []byte{})
	assert.NoError(t, err, "Should be able to send ping message")
}

func TestMessageEcho(t *testing.T) {
	// Note: This test now verifies room-based messaging (Story 1.4)
	// Single player won't receive echo since they're not in a room yet

	// Create test server with room management
	handler := NewWebSocketHandler()
	server := httptest.NewServer(http.HandlerFunc(handler.HandleWebSocket))
	defer server.Close()

	// Convert http:// to ws://
	wsURL := "ws" + strings.TrimPrefix(server.URL, "http")

	// Connect TWO clients to create a room
	conn1, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	assert.NoError(t, err, "Should connect client 1")
	defer conn1.Close()

	conn2, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	assert.NoError(t, err, "Should connect client 2")
	defer conn2.Close()

	// Consume room:joined messages
	conn1.SetReadDeadline(time.Now().Add(2 * time.Second))
	conn1.ReadMessage()
	conn2.SetReadDeadline(time.Now().Add(2 * time.Second))
	conn2.ReadMessage()

	// Create test message from client 1
	testMsg := Message{
		Type:      "test",
		Timestamp: time.Now().UnixMilli(),
		Data:      map[string]string{"message": "Hello from test!"},
	}

	// Send message from client 1
	msgBytes, err := json.Marshal(testMsg)
	assert.NoError(t, err, "Should marshal message")

	err = conn1.WriteMessage(websocket.TextMessage, msgBytes)
	assert.NoError(t, err, "Should send message")

	// Client 2 should receive the broadcast
	conn2.SetReadDeadline(time.Now().Add(2 * time.Second))
	_, responseBytes, err := conn2.ReadMessage()
	assert.NoError(t, err, "Should receive broadcast message")

	// Parse response
	var responseMsg Message
	err = json.Unmarshal(responseBytes, &responseMsg)
	assert.NoError(t, err, "Should parse broadcast message")

	// Verify message matches original
	assert.Equal(t, testMsg.Type, responseMsg.Type, "Type should match")
	assert.Equal(t, testMsg.Timestamp, responseMsg.Timestamp, "Timestamp should match")

	// Verify data field
	responseData, ok := responseMsg.Data.(map[string]any)
	assert.True(t, ok, "Data should be a map")
	assert.Equal(t, "Hello from test!", responseData["message"], "Message content should match")
}

func TestGracefulDisconnect(t *testing.T) {
	// Create test server
	server := httptest.NewServer(http.HandlerFunc(HandleWebSocket))
	defer server.Close()

	// Convert http:// to ws://
	wsURL := "ws" + strings.TrimPrefix(server.URL, "http")

	// Connect as client
	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	assert.NoError(t, err, "Should connect successfully")

	// Close connection gracefully
	err = conn.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, "Test close"))
	assert.NoError(t, err, "Should send close message")

	// Set read deadline to avoid hanging
	conn.SetReadDeadline(time.Now().Add(2 * time.Second))

	// Read the close response from server
	_, _, err = conn.ReadMessage()
	assert.Error(t, err, "Should receive close error after sending close message")

	// Verify it's a close error (not a timeout or other error)
	if closeErr, ok := err.(*websocket.CloseError); ok {
		assert.Equal(t, websocket.CloseNormalClosure, closeErr.Code, "Should receive normal closure")
	}

	conn.Close()
}

func TestInvalidJSON(t *testing.T) {
	// Create test server with room management
	handler := NewWebSocketHandler()
	server := httptest.NewServer(http.HandlerFunc(handler.HandleWebSocket))
	defer server.Close()

	// Convert http:// to ws://
	wsURL := "ws" + strings.TrimPrefix(server.URL, "http")

	// Connect TWO clients to create a room
	conn1, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	assert.NoError(t, err, "Should connect client 1")
	defer conn1.Close()

	conn2, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	assert.NoError(t, err, "Should connect client 2")
	defer conn2.Close()

	// Consume room:joined messages
	conn1.SetReadDeadline(time.Now().Add(2 * time.Second))
	conn1.ReadMessage()
	conn2.SetReadDeadline(time.Now().Add(2 * time.Second))
	conn2.ReadMessage()

	// Send invalid JSON from client 1
	err = conn1.WriteMessage(websocket.TextMessage, []byte("not valid json"))
	assert.NoError(t, err, "Should send invalid JSON")

	// Server should continue running (not crash)
	// Send a valid message to verify server is still responsive
	testMsg := Message{
		Type:      "test",
		Timestamp: time.Now().UnixMilli(),
	}
	msgBytes, _ := json.Marshal(testMsg)
	err = conn1.WriteMessage(websocket.TextMessage, msgBytes)
	assert.NoError(t, err, "Should send valid message after invalid one")

	// Client 2 should receive the valid broadcast
	conn2.SetReadDeadline(time.Now().Add(2 * time.Second))
	_, _, err = conn2.ReadMessage()
	assert.NoError(t, err, "Should receive broadcast after invalid message was sent")
}

func TestWebSocketUpgradeFailure(t *testing.T) {
	// Create test server
	handler := NewWebSocketHandler()
	server := httptest.NewServer(http.HandlerFunc(handler.HandleWebSocket))
	defer server.Close()

	// Make a regular HTTP request (not WebSocket upgrade)
	// This should fail to upgrade and return an error
	resp, err := http.Get(server.URL)
	assert.NoError(t, err, "HTTP request should succeed")
	defer resp.Body.Close()

	// WebSocket upgrade should have failed
	// The handler returns without upgrading, so we get a non-WebSocket response
	assert.NotEqual(t, http.StatusSwitchingProtocols, resp.StatusCode, "Should not upgrade to WebSocket")
}

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

		// Should not panic even if player doesn't exist
		handler.handleInputState("non-existent-player", validData)
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

// TestBroadcastPlayerStates tests the broadcastPlayerStates function
func TestBroadcastPlayerStates(t *testing.T) {
	t.Run("returns early for empty player list", func(t *testing.T) {
		handler := NewWebSocketHandler()

		// Call with empty list - should not panic
		handler.broadcastPlayerStates([]game.PlayerState{})
	})

	t.Run("broadcasts to players in room", func(t *testing.T) {
		handler := NewWebSocketHandler()
		server := httptest.NewServer(http.HandlerFunc(handler.HandleWebSocket))
		defer server.Close()

		wsURL := "ws" + strings.TrimPrefix(server.URL, "http")

		// Connect two clients to create a room
		conn1, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
		assert.NoError(t, err)
		defer conn1.Close()

		conn2, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
		assert.NoError(t, err)
		defer conn2.Close()

		// Consume room:joined messages
		conn1.SetReadDeadline(time.Now().Add(2 * time.Second))
		conn1.ReadMessage()
		conn2.SetReadDeadline(time.Now().Add(2 * time.Second))
		conn2.ReadMessage()

		// Give time for room setup
		time.Sleep(50 * time.Millisecond)

		// Create player states to broadcast
		playerStates := []game.PlayerState{
			{
				ID:       "player-1",
				Position: game.Vector2{X: 100, Y: 200},
				Velocity: game.Vector2{X: 10, Y: 20},
			},
		}

		// Broadcast - this uses room manager which should have the players
		handler.broadcastPlayerStates(playerStates)

		// The broadcast should complete without error
		// Note: We can't easily capture the actual player IDs from the WebSocket handler
	})

	t.Run("sends to waiting players not in room", func(t *testing.T) {
		handler := NewWebSocketHandler()
		server := httptest.NewServer(http.HandlerFunc(handler.HandleWebSocket))
		defer server.Close()

		wsURL := "ws" + strings.TrimPrefix(server.URL, "http")

		// Connect only ONE client (will be waiting, not in room)
		conn1, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
		assert.NoError(t, err)
		defer conn1.Close()

		// Give time for player setup
		time.Sleep(50 * time.Millisecond)

		// Create player states - use a dummy ID since we don't know the actual player ID
		playerStates := []game.PlayerState{
			{
				ID:       "some-player-id",
				Position: game.Vector2{X: 100, Y: 200},
				Velocity: game.Vector2{X: 0, Y: 0},
			},
		}

		// Broadcast - should handle waiting player case
		handler.broadcastPlayerStates(playerStates)

		// Should complete without error
	})
}

// TestHandlerStartStop tests the Start and Stop methods of WebSocketHandler
func TestHandlerStartStop(t *testing.T) {
	t.Run("starts game server", func(t *testing.T) {
		handler := NewWebSocketHandler()

		ctx, cancel := context.WithCancel(context.Background())

		// Start the handler
		handler.Start(ctx)

		// Give it time to initialize
		time.Sleep(50 * time.Millisecond)

		// Verify game server is running
		assert.True(t, handler.gameServer.IsRunning(), "Game server should be running after Start")

		// Cancel context first (goroutines wait on context)
		cancel()

		// Stop the handler (waits for goroutines)
		handler.Stop()

		// Verify game server stopped
		assert.False(t, handler.gameServer.IsRunning(), "Game server should be stopped after Stop")
	})

	t.Run("handles context cancellation", func(t *testing.T) {
		handler := NewWebSocketHandler()

		ctx, cancel := context.WithCancel(context.Background())

		// Start the handler
		handler.Start(ctx)

		// Give it time to initialize
		time.Sleep(50 * time.Millisecond)

		assert.True(t, handler.gameServer.IsRunning(), "Game server should be running")

		// Cancel context
		cancel()

		// Give it time for goroutines to stop
		time.Sleep(100 * time.Millisecond)

		// Stop should be callable without hanging (goroutines already exited)
		handler.Stop()

		assert.False(t, handler.gameServer.IsRunning(), "Game server should be stopped")
	})

	t.Run("stop is idempotent", func(t *testing.T) {
		handler := NewWebSocketHandler()

		ctx, cancel := context.WithCancel(context.Background())

		handler.Start(ctx)
		time.Sleep(50 * time.Millisecond)

		// Cancel context first
		cancel()

		// Call Stop multiple times - should not panic
		handler.Stop()
		handler.Stop()
		handler.Stop()

		assert.False(t, handler.gameServer.IsRunning(), "Game server should be stopped")
	})
}

// TestGlobalHandlerStartStop tests StartGlobalHandler and StopGlobalHandler
func TestGlobalHandlerStartStop(t *testing.T) {
	t.Run("starts and stops global handler", func(t *testing.T) {
		ctx, cancel := context.WithCancel(context.Background())

		// Start global handler
		StartGlobalHandler(ctx)

		// Give it time to initialize
		time.Sleep(50 * time.Millisecond)

		// Verify global handler is running
		assert.True(t, globalHandler.gameServer.IsRunning(), "Global handler game server should be running")

		// Cancel context first (goroutines wait on context)
		cancel()

		// Stop global handler
		StopGlobalHandler()

		// Verify stopped
		assert.False(t, globalHandler.gameServer.IsRunning(), "Global handler game server should be stopped")
	})

	t.Run("stop global handler is idempotent", func(t *testing.T) {
		// Call stop multiple times - should not panic
		// Note: Already stopped from previous test, goroutines already exited
		StopGlobalHandler()
		StopGlobalHandler()
	})
}
