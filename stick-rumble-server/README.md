# Stick Rumble - Backend Server

Multiplayer game server for Stick Rumble built with Go and WebSocket.

## Requirements

- Go 1.23+ (tested with Go 1.24.1)
- Network access for dependencies

## Dependencies

- `github.com/gorilla/websocket@v1.5.3` - WebSocket protocol implementation
- `github.com/go-pkgz/auth/v2` - OAuth authentication (Epic 6)
- `github.com/lib/pq` - PostgreSQL driver (Epic 6)
- `github.com/redis/go-redis/v9` - Redis client (Epic 5)
- `github.com/stretchr/testify` - Testing assertions

## Project Structure

```
stick-rumble-server/
├── cmd/
│   └── server/
│       └── main.go                 # Entry point
├── internal/
│   ├── game/                       # Game logic (Story 1.4+)
│   ├── network/
│   │   └── websocket_handler.go    # WebSocket stub (Story 1.3 will implement)
│   ├── auth/                       # OAuth (Epic 6)
│   ├── db/                         # Database (Epic 6)
│   └── config/                     # Server configuration
├── go.mod
├── go.sum
├── .gitignore
└── README.md
```

## Setup

### Install Dependencies

```bash
go mod download
```

### Run Development Server

```bash
go run cmd/server/main.go
```

Server will start on port 8080 by default.

### Configure Port

Use the `PORT` environment variable to change the port:

```bash
PORT=8081 go run cmd/server/main.go
```

## Endpoints

### Health Check

```bash
curl http://localhost:8080/health
```

Expected response: `OK` (HTTP 200)

### WebSocket (Coming in Story 1.3)

```
ws://localhost:8080/ws
```

Currently returns HTTP 501 Not Implemented.

## Testing

### Run All Tests

```bash
go test ./...
```

### Run Tests with Coverage

```bash
go test -cover ./...
```

### Run Tests in Verbose Mode

```bash
go test -v ./...
```

## Building

### Build Binary

```bash
go build -o server cmd/server/main.go
```

### Run Binary

```bash
./server
```

## Troubleshooting

### Port Already in Use

If port 8080 is already in use:

```bash
PORT=8081 go run cmd/server/main.go
```

### Module Path Error

Ensure you're using the correct module path in imports:

```go
import "github.com/mtomcal/stick-rumble-server/internal/network"
```

### Go Version Error

Ensure Go 1.23+ is installed:

```bash
go version
```

### Dependency Issues

If `go get` fails, try setting the proxy:

```bash
go env -w GOPROXY=https://proxy.golang.org,direct
go mod download
```

## Development Notes

- Uses Go standard library `net/http` (no third-party router needed for MVP)
- `internal/` directory prevents external imports (Go best practice)
- Environment-based configuration for deployment flexibility
- Health check endpoint required for monitoring and deployment

## Next Steps

- **Story 1.3**: Implement WebSocket connection handling
- **Story 1.4**: Add game room management and player synchronization
- **Story 1.5**: Deploy to cloud VPS for remote testing

## Architecture

Follows the architecture documented in `docs/game-architecture.md`:

- Server-authoritative gameplay
- 60 Hz tick rate for game logic
- 20 Hz broadcast rate for client updates
- WebSocket-based real-time communication
- JSON message format for MVP

## License

Copyright 2025 - Stick Rumble Game Project
