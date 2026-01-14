package main

import (
	"context"
	"io"
	"net/http"
	"os"
	"testing"
	"time"
)

// TestHealthEndpoint verifies the /health endpoint returns 200 OK
func TestHealthEndpoint(t *testing.T) {
	// Set test port to avoid conflicts
	os.Setenv("PORT", "18080")
	defer os.Unsetenv("PORT")

	// Start server in background
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	go func() {
		if err := startServer(ctx); err != nil && err != http.ErrServerClosed {
			t.Logf("Server error: %v", err)
		}
	}()

	// Wait for server to start (with timeout)
	client := &http.Client{Timeout: 2 * time.Second}
	maxAttempts := 20
	var resp *http.Response
	var err error

	for i := 0; i < maxAttempts; i++ {
		resp, err = client.Get("http://localhost:18080/health")
		if err == nil {
			break
		}
		time.Sleep(100 * time.Millisecond)
	}

	if err != nil {
		t.Fatalf("Failed to connect to health endpoint after %d attempts: %v", maxAttempts, err)
	}
	defer resp.Body.Close()

	// Verify status code
	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected status 200, got %d", resp.StatusCode)
	}

	// Verify response body
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("Failed to read response body: %v", err)
	}

	expected := "OK"
	if string(body) != expected {
		t.Errorf("Expected body %q, got %q", expected, string(body))
	}
}

// TestWebSocketEndpoint verifies the /ws endpoint is registered
func TestWebSocketEndpoint(t *testing.T) {
	// Set test port to avoid conflicts
	os.Setenv("PORT", "18081")
	defer os.Unsetenv("PORT")

	// Start server in background
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	go func() {
		if err := startServer(ctx); err != nil && err != http.ErrServerClosed {
			t.Logf("Server error: %v", err)
		}
	}()

	// Wait for server to start
	client := &http.Client{Timeout: 2 * time.Second}
	maxAttempts := 20

	for i := 0; i < maxAttempts; i++ {
		_, err := client.Get("http://localhost:18081/health")
		if err == nil {
			break
		}
		time.Sleep(100 * time.Millisecond)
	}

	// Try to connect to WebSocket endpoint (should get upgrade error, not 404)
	resp, err := client.Get("http://localhost:18081/ws")
	if err != nil {
		t.Fatalf("Failed to connect to /ws endpoint: %v", err)
	}
	defer resp.Body.Close()

	// WebSocket endpoint should exist (return 400 Bad Request for non-WS connection)
	// Not 404 Not Found
	if resp.StatusCode == http.StatusNotFound {
		t.Errorf("WebSocket endpoint not registered (got 404)")
	}
}

// TestServerGracefulShutdown verifies the server shuts down cleanly
func TestServerGracefulShutdown(t *testing.T) {
	// Set test port to avoid conflicts
	os.Setenv("PORT", "18082")
	defer os.Unsetenv("PORT")

	// Start server in background
	ctx, cancel := context.WithCancel(context.Background())

	serverDone := make(chan error, 1)
	go func() {
		serverDone <- startServer(ctx)
	}()

	// Wait for server to start
	client := &http.Client{Timeout: 2 * time.Second}
	maxAttempts := 20

	for i := 0; i < maxAttempts; i++ {
		resp, err := client.Get("http://localhost:18082/health")
		if err == nil {
			resp.Body.Close()
			break
		}
		time.Sleep(100 * time.Millisecond)
	}

	// Trigger shutdown
	cancel()

	// Wait for server to stop (should complete within timeout)
	select {
	case err := <-serverDone:
		if err != nil && err != http.ErrServerClosed && err != context.Canceled {
			t.Errorf("Server shutdown error: %v", err)
		}
	case <-time.After(5 * time.Second):
		t.Error("Server did not shut down within timeout")
	}
}

// TestServerDefaultPort verifies the server uses default port when PORT env is not set
func TestServerDefaultPort(t *testing.T) {
	// Ensure PORT is not set
	os.Unsetenv("PORT")

	// Start server in background
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	go func() {
		if err := startServer(ctx); err != nil && err != http.ErrServerClosed {
			t.Logf("Server error: %v", err)
		}
	}()

	// Wait for server to start on default port 8080
	client := &http.Client{Timeout: 2 * time.Second}
	maxAttempts := 20

	for i := 0; i < maxAttempts; i++ {
		resp, err := client.Get("http://localhost:8080/health")
		if err == nil {
			resp.Body.Close()
			// Server started successfully on default port
			return
		}
		time.Sleep(100 * time.Millisecond)
	}

	t.Error("Server did not start on default port 8080")
}
