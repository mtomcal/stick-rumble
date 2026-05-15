package main

import (
	"context"
	"database/sql"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/mtomcal/stick-rumble-server/internal/auth"
	"github.com/mtomcal/stick-rumble-server/internal/config"
	"github.com/mtomcal/stick-rumble-server/internal/db"
	"github.com/mtomcal/stick-rumble-server/internal/network"
)

// initDatabase connects to PostgreSQL, runs migrations, and returns the connection pool.
// Returns nil if the database URL is empty or connection fails (non-fatal for testing).
func initDatabase(databaseURL string) *sql.DB {
	if databaseURL == "" {
		log.Println("No DATABASE_URL set; skipping database initialization")
		return nil
	}

	database, err := db.Connect(databaseURL)
	if err != nil {
		log.Printf("Failed to connect to database: %v (continuing without DB)", err)
		return nil
	}

	log.Println("Running database migrations...")
	if err := db.RunMigrationsWithDefaults(database); err != nil {
		database.Close()
		log.Printf("Failed to run migrations: %v (continuing without DB)", err)
		return nil
	}
	log.Println("Database migrations complete")

	return database
}

// startServer initializes and starts the HTTP server with health and WebSocket endpoints
// Returns when context is cancelled or server encounters an error
func startServer(ctx context.Context) error {
	runtimeConfig := config.Load()

	// Initialize database connection (optional; will be nil if unavailable)
	database := initDatabase(runtimeConfig.DatabaseURL)
	if database != nil {
		defer database.Close()
	}

	// Create auth handler with DB connection
	authHandler := auth.NewAuthHandler(database, runtimeConfig.GoogleClientID, runtimeConfig.SessionTokenExpiryDays)

	// Create HTTP server with routes
	mux := http.NewServeMux()

	// Health check endpoint
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	// Auth endpoints
	mux.HandleFunc("/api/auth/google", authHandler.HandleGoogleSignIn)
	mux.HandleFunc("/api/player/displayname", authHandler.HandleSetDisplayName)
	mux.HandleFunc("/api/player/me", authHandler.HandleGetPlayerInfo)

	// WebSocket endpoint
	mux.HandleFunc("/ws", network.HandleWebSocket)

	// Create server with configured timeouts
	server := &http.Server{
		Addr:         runtimeConfig.Host + ":" + runtimeConfig.Port,
		Handler:      mux,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Start game server (global handler)
	network.StartGlobalHandler(ctx)
	// Wire database to global handler for WebSocket token validation
	network.SetGlobalHandlerDB(database)

	// Channel to capture server errors
	serverErrors := make(chan error, 1)

	// Start HTTP server in goroutine
	go func() {
		log.Printf("Starting server on %s:%s", runtimeConfig.Host, runtimeConfig.Port)
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
