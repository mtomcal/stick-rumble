.PHONY: help install dev-client dev-server dev test test-client test-server test-integration test-coverage lint build clean check-zombies kill-dev

# Default target - show help
help:
	@echo "Stick Rumble - Build Commands"
	@echo ""
	@echo "Setup:"
	@echo "  make install          Install dependencies for both client and server"
	@echo ""
	@echo "Development:"
	@echo "  make dev              Run both client and server in parallel"
	@echo "  make dev-client       Run client dev server only (http://localhost:5173)"
	@echo "  make dev-server       Run server only (http://localhost:8080)"
	@echo "  make check-zombies    Check for orphaned dev processes"
	@echo "  make kill-dev         Kill any orphaned dev processes"
	@echo ""
	@echo "Testing:"
	@echo "  make test             Run all tests (client + server)"
	@echo "  make test-client      Run client tests only"
	@echo "  make test-server      Run server tests only"
	@echo "  make test-integration Run integration tests (starts server automatically)"
	@echo "  make test-coverage    Run tests with coverage reports"
	@echo ""
	@echo "Code Quality:"
	@echo "  make lint             Run linters for both client and server"
	@echo "  make typecheck        Run TypeScript type checking"
	@echo ""
	@echo "Build:"
	@echo "  make build            Build both client and server for production"
	@echo "  make clean            Remove build artifacts"

# Install dependencies
install:
	@echo "Installing client dependencies..."
	cd stick-rumble-client && npm install
	@echo "Installing server dependencies..."
	cd stick-rumble-server && go mod download
	@echo "✓ All dependencies installed"

# Development - Run both client and server
dev:
	@echo "Starting client and server..."
	@echo "Client: http://localhost:5173"
	@echo "Server: http://localhost:8080"
	@echo ""
	@trap 'kill 0' EXIT; \
	cd stick-rumble-server && go run cmd/server/main.go & \
	cd stick-rumble-client && npm run dev

# Development - Client only
dev-client:
	@echo "Starting client dev server..."
	cd stick-rumble-client && npm run dev

# Development - Server only
dev-server:
	@echo "Starting server..."
	cd stick-rumble-server && go run cmd/server/main.go

# Run all tests
test:
	@echo "Running client tests..."
	cd stick-rumble-client && npm test
	@echo ""
	@echo "Running server tests..."
	cd stick-rumble-server && go test ./...
	@echo ""
	@echo "✓ All tests passed"

# Run client tests only
test-client:
	@echo "Running client tests..."
	cd stick-rumble-client && npm test

# Run server tests only
test-server:
	@echo "Running server tests..."
	cd stick-rumble-server && go test ./... -v

# Run integration tests (starts server automatically)
test-integration:
	@echo "Starting server for integration tests..."
	@{ cd stick-rumble-server && go run cmd/server/main.go >/dev/null 2>&1 & }; \
	SERVER_PID=$$!; \
	echo "Server PID: $$SERVER_PID"; \
	sleep 2; \
	echo "Running integration tests..."; \
	{ cd stick-rumble-client && npm run test:integration; }; \
	TEST_EXIT=$$?; \
	echo "Stopping server (PID: $$SERVER_PID)..."; \
	pkill -P $$SERVER_PID 2>/dev/null || true; \
	kill -TERM $$SERVER_PID 2>/dev/null || true; \
	sleep 1; \
	pkill -9 -P $$SERVER_PID 2>/dev/null || true; \
	kill -9 $$SERVER_PID 2>/dev/null || true; \
	lsof -ti:8080 | xargs kill -9 2>/dev/null || true; \
	wait $$SERVER_PID 2>/dev/null || true; \
	exit $$TEST_EXIT

# Run tests with coverage
test-coverage:
	@echo "Running client tests with coverage..."
	cd stick-rumble-client && npm run test:coverage
	@echo ""
	@echo "Running server tests with coverage..."
	cd stick-rumble-server && go test ./... -cover
	@echo ""
	@echo "✓ Coverage reports generated"

# Run linters
lint:
	@echo "Running client linters..."
	cd stick-rumble-client && npm run lint
	@echo ""
	@echo "Running server checks..."
	cd stick-rumble-server && go vet ./...
	cd stick-rumble-server && gofmt -l . | grep . && exit 1 || echo "✓ Go formatting OK"
	@echo ""
	@echo "✓ All linters passed"

# TypeScript type checking
typecheck:
	@echo "Running TypeScript type checking..."
	cd stick-rumble-client && npm run typecheck

# Build for production
build:
	@echo "Building client..."
	cd stick-rumble-client && npm run build
	@echo ""
	@echo "Building server..."
	cd stick-rumble-server && go build -o server cmd/server/main.go
	@echo ""
	@echo "✓ Build complete"
	@echo "  Client: stick-rumble-client/dist/"
	@echo "  Server: stick-rumble-server/server"

# Clean build artifacts
clean:
	@echo "Cleaning build artifacts..."
	rm -rf stick-rumble-client/dist
	rm -rf stick-rumble-client/coverage
	rm -f stick-rumble-server/server
	@echo "✓ Clean complete"

# Check for zombie processes
check-zombies:
	@echo "Checking for orphaned dev processes..."
	@lsof -ti:8080 && echo "⚠️  Port 8080 is in use" || echo "✓ Port 8080 is free"
	@lsof -ti:5173 && echo "⚠️  Port 5173 is in use" || echo "✓ Port 5173 is free"
	@ps aux | grep -E "go run.*server/main.go" | grep -v grep && echo "⚠️  Zombie Go server found" || echo "✓ No zombie Go servers"
	@ps aux | grep -E "vite.*dev" | grep -v grep && echo "⚠️  Zombie Vite server found" || echo "✓ No zombie Vite servers"

# Kill any orphaned dev processes
kill-dev:
	@echo "Killing orphaned dev processes..."
	@lsof -ti:8080 | xargs kill -9 2>/dev/null || echo "Port 8080 was already free"
	@lsof -ti:5173 | xargs kill -9 2>/dev/null || echo "Port 5173 was already free"
	@echo "✓ Cleanup complete"
