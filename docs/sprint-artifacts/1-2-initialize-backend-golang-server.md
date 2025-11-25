# Story 1.2: Initialize Backend Golang Server

Status: ready-for-dev

## Story

As a developer,
I want the backend Go server project initialized with core dependencies,
So that I can build the multiplayer game server with WebSocket support.

## Acceptance Criteria

1. **Given** a new directory `stick-rumble-server/` **When** I initialize the Go module with `go mod init` **Then** the project is created with Go 1.23+ module

2. **And** core dependencies are installed:
   - `github.com/gorilla/websocket@v1.5.3` (WebSocket library)
   - `github.com/go-pkgz/auth/v2` (OAuth authentication)
   - `github.com/lib/pq` (PostgreSQL driver)
   - `github.com/redis/go-redis/v9` (Redis client)
   - `github.com/stretchr/testify` (testing assertions)

3. **And** project structure follows Architecture doc:
   - `cmd/server/main.go` - entry point
   - `internal/game/` - game logic
   - `internal/network/` - WebSocket handling
   - `internal/auth/` - authentication
   - `internal/db/` - database connections

4. **And** `go run cmd/server/main.go` starts a basic HTTP server on port 8080

5. **And** `curl http://localhost:8080/health` returns "OK" with 200 status

6. **And** `go test ./...` runs successfully (even with no tests yet)

7. **And** `go build -o server cmd/server/main.go` creates binary successfully

8. **And** all dependencies listed in go.mod with specific versions

9. **And** server logs "Server starting on port 8080" to stdout

10. **And** no compilation errors or warnings

## Tasks / Subtasks

- [ ] Initialize Go project structure (AC: #1, #3)
  - [ ] Create `stick-rumble-server/` directory
  - [ ] Run `go mod init github.com/yourusername/stick-rumble-server`
  - [ ] Create directory structure: `cmd/server/`, `internal/{game,network,auth,db,config}/`
  - [ ] Verify Go 1.23+ is used

- [ ] Install core dependencies (AC: #2, #8)
  - [ ] Run `go get github.com/gorilla/websocket@v1.5.3`
  - [ ] Run `go get github.com/go-pkgz/auth/v2`
  - [ ] Run `go get github.com/lib/pq`
  - [ ] Run `go get github.com/redis/go-redis/v9`
  - [ ] Run `go get github.com/stretchr/testify`
  - [ ] Verify go.mod lists all dependencies with versions

- [ ] Implement basic HTTP server (AC: #4, #9)
  - [ ] Create `cmd/server/main.go` with HTTP server
  - [ ] Add `/health` endpoint returning "OK"
  - [ ] Add `/ws` stub endpoint for future WebSocket handler
  - [ ] Configure server to use PORT environment variable (default 8080)
  - [ ] Add proper logging on server start

- [ ] Create WebSocket handler stub (AC: #4)
  - [ ] Create `internal/network/websocket_handler.go`
  - [ ] Implement `HandleWebSocket` function returning "not yet implemented"
  - [ ] Import in main.go and register `/ws` endpoint

- [ ] Verify server functionality (AC: #5, #6, #7, #10)
  - [ ] Run `go run cmd/server/main.go` and verify it starts
  - [ ] Test `/health` endpoint with `curl http://localhost:8080/health`
  - [ ] Run `go test ./...` and verify no errors
  - [ ] Run `go build -o server cmd/server/main.go` and verify binary created
  - [ ] Check for compilation warnings or errors

- [ ] Create supporting files (AC: #3, #10)
  - [ ] Create `.gitignore` excluding binaries, vendor/, .env files
  - [ ] Create `README.md` documenting how to run server
  - [ ] Document required Go version and dependencies

- [ ] Write unit tests (Testing standard)
  - [ ] Create `cmd/server/main_test.go` with health endpoint test
  - [ ] Use testify assertions for cleaner tests
  - [ ] Verify tests pass with `go test ./...`

## Dev Notes

### Technical Requirements

**Setup Commands:**
```bash
# Create directory and initialize Go module
mkdir stick-rumble-server
cd stick-rumble-server
go mod init github.com/yourusername/stick-rumble-server

# Install core dependencies
go get github.com/gorilla/websocket@v1.5.3
go get github.com/go-pkgz/auth/v2
go get github.com/lib/pq
go get github.com/redis/go-redis/v9
go get github.com/stretchr/testify
```

**Required Go Version:** Go 1.23+

**Core Dependencies:**
- gorilla/websocket@v1.5.3 - WebSocket protocol implementation
- go-pkgz/auth/v2 - OAuth authentication (Epic 6)
- lib/pq - PostgreSQL driver (Epic 6)
- redis/go-redis/v9 - Redis client (Epic 5)
- stretchr/testify - Testing assertions

### Architecture Patterns and Constraints

**Project Structure:**
- Use Go modules for dependency management (no vendor/ needed)
- `internal/` directory prevents external imports (Go best practice)
- Standard library `net/http` sufficient for MVP (no Gin/Echo needed)
- Separate concerns: cmd/ for entry points, internal/ for implementation

**Coding Standards:**
- Package naming: lowercase, single word (e.g., `package network`)
- File naming: snake_case (e.g., `websocket_handler.go`)
- Error handling: check all errors, log appropriately
- Use `log` package for logging (structured logging can come later)

**HTTP Server Configuration:**
- Use PORT environment variable for flexibility
- Default to 8080 if PORT not set
- Health check endpoint required for monitoring/deployment

### Testing Standards Summary

**Testing Framework:** Go testing + testify
**Test Location:** `_test.go` files next to source
**Coverage Goal:** 70%+ for server logic

**Test Example:**
```go
// cmd/server/main_test.go
func TestHealthEndpoint(t *testing.T) {
    req := httptest.NewRequest("GET", "/health", nil)
    w := httptest.NewRecorder()

    http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        w.WriteHeader(http.StatusOK)
        w.Write([]byte("OK"))
    }).ServeHTTP(w, req)

    assert.Equal(t, http.StatusOK, w.Code)
    assert.Equal(t, "OK", w.Body.String())
}
```

### Project Structure Notes

**Alignment with unified project structure:**
- Backend in `stick-rumble-server/` directory (sibling to stick-rumble-client/)
- Frontend (Story 1.1) in `stick-rumble-client/` directory
- Follows architecture document structure exactly

**Directory Structure:**
```
stick-rumble-server/
├── cmd/
│   └── server/
│       └── main.go                 # Entry point
├── internal/
│   ├── game/
│   │   ├── room.go                # Room management (Story 1.4)
│   │   ├── player.go              # Player state (Story 1.4)
│   │   └── constants.go           # Game constants
│   ├── network/
│   │   ├── websocket_handler.go   # WebSocket stub (Story 1.3 will complete)
│   │   ├── connection.go          # Connection wrapper (Story 1.3)
│   │   └── protocol.go            # Message definitions (Story 1.3)
│   ├── auth/                      # OAuth (Epic 6)
│   ├── db/                        # Database (Epic 6)
│   └── config/
│       └── config.go              # Server configuration
├── go.mod
├── go.sum
├── .gitignore
└── README.md
```

### Learnings from Previous Story

**From Story 1.1: Initialize Frontend Project (Status: done)**

**Key Achievements from Story 1.1:**
- ✅ Frontend successfully initialized with Phaser 3.90, React 19.2, TypeScript 5.9, Vite 7.2
- ✅ Project structure properly separated: src/game/, src/ui/, src/shared/, public/assets/
- ✅ Dev server, build process, and testing all verified working
- ✅ All review findings resolved, story APPROVED

**Project Organization Pattern:**
- Story 1.1 created `stick-rumble-client/` directory as separate project
- This story should create `stick-rumble-server/` as sibling directory (not subdirectory)
- Both projects are independent with their own dependencies
- Mirrors architecture document's project separation

**Testing Approach:**
- Story 1.1 created minimal tests to verify setup (2 tests)
- Use similar approach: create 1-2 tests to verify server setup
- Test health endpoint and basic HTTP server functionality
- More comprehensive tests will come in future stories

**Configuration Management:**
- Story 1.1 used environment variables for flexibility (VITE_WS_URL)
- Use PORT environment variable for server configuration
- Document environment variables in README.md
- This enables deployment flexibility (Story 1.5)

**Development Experience:**
- Story 1.1 emphasized hot reload and fast feedback
- While Go doesn't have HMR, ensure quick rebuild/restart cycles
- Use `go run` for development (fast iteration)
- `go build` for production binaries

**Documentation Standards:**
- Story 1.1 created comprehensive README with setup instructions
- Follow same pattern: document Go version, dependencies, how to run
- Include troubleshooting section for common issues
- Document available endpoints (/health, /ws)

**Files to Reference:**
- Frontend project structure at `stick-rumble-client/` for consistency
- Architecture patterns established in Story 1.1's implementation

[Source: docs/sprint-artifacts/1-1-initialize-frontend-project-with-phaser-react.md#Dev-Agent-Record]

### References

**Source Documents:**
- [Source: docs/game-architecture.md#Backend-Architecture]
- [Source: docs/epic-1-tech-spec.md#Story-1.2]
- [Source: docs/epics.md#Epic-1-Story-1.2]

**Key Architecture Decisions:**
- Go standard library net/http (ADR-004: Minimal Dependencies for MVP)
- internal/ package structure for encapsulation
- Environment-based configuration (PORT variable)
- Health check endpoint for deployment readiness

**Troubleshooting:**
- If `go get` fails: Check internet, try `go env -w GOPROXY=https://proxy.golang.org,direct`
- If port 8080 in use: Set PORT environment variable `PORT=8081 go run cmd/server/main.go`
- If module path error: Use your actual GitHub username in module path
- If Go version error: Ensure Go 1.23+ installed with `go version`

## Dev Agent Record

### Context Reference

- Story Context: [1-2-initialize-backend-golang-server.context.xml](./1-2-initialize-backend-golang-server.context.xml)

### Agent Model Used

Claude Sonnet 4.5 (claude-sonnet-4-5-20250929)

### Debug Log References

<!-- Implementation notes, decisions, and debug information will be added here -->

### Completion Notes List

<!-- Achievements, patterns, deviations, warnings will be added here after implementation -->

### File List

<!-- Created, modified, deleted files will be listed here after implementation -->

## Change Log

- **2025-11-25**: Story drafted - Backend Golang server initialization story created from Epic 1 technical spec and epics file. Ready for development. Prerequisites: Story 1.1 complete (done). Incorporates learnings from Story 1.1 regarding project organization, testing approach, and documentation standards.
