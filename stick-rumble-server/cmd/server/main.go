package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/mtomcal/stick-rumble-server/internal/network"
)

// startServer initializes and starts the HTTP server with health and WebSocket endpoints
// Returns when context is cancelled or server encounters an error
func startServer(ctx context.Context) error {
	// Get port from environment or use default
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	// Create HTTP server with routes
	mux := http.NewServeMux()

	// Health check endpoint
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	// WebSocket endpoint
	mux.HandleFunc("/ws", network.HandleWebSocket)

	// Create server with configured timeouts
	server := &http.Server{
		Addr:         ":" + port,
		Handler:      mux,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Start game server (global handler)
	network.StartGlobalHandler(ctx)

	// Channel to capture server errors
	serverErrors := make(chan error, 1)

	// Start HTTP server in goroutine
	go func() {
		log.Printf("Starting server on port %s", port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			serverErrors <- err
		}
	}()

	// Wait for context cancellation or server error
	select {
	case err := <-serverErrors:
		return err
	case <-ctx.Done():
		// Graceful shutdown with timeout
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()

		log.Println("Shutting down server...")
		network.StopGlobalHandler()

		if err := server.Shutdown(shutdownCtx); err != nil {
			log.Printf("Server shutdown error: %v", err)
			return err
		}
		log.Println("Server stopped")
		return nil
	}
}

func main() {
	// Create context that listens for interrupt signals
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Handle shutdown signals
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

	// Start server in background
	serverDone := make(chan error, 1)
	go func() {
		serverDone <- startServer(ctx)
	}()

	// Wait for shutdown signal or server error
	select {
	case sig := <-sigChan:
		log.Printf("Received signal: %v", sig)
		cancel()
		<-serverDone // Wait for graceful shutdown
	case err := <-serverDone:
		if err != nil {
			log.Fatalf("Server error: %v", err)
		}
	}
}
