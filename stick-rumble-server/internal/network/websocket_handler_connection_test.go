package network

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
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
