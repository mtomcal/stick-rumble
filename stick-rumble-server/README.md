# Stick Rumble Server

Go WebSocket game server for Stick Rumble.

The server owns the authoritative simulation: rooms, matchmaking, movement validation, combat, weapons, health, deaths, respawns, scoring, snapshots, deltas, and WebSocket message handling.

Use the root `Makefile` for normal workflows:

```bash
make install
make dev-server
make test-server
make test-server-verbose
make test-integration
make lint
make build
```

Package-specific commands are available when targeted work needs them:

```bash
go mod download
go run cmd/server/main.go
PORT=8081 go run cmd/server/main.go
go test ./...
go test ./... -cover
go vet ./...
go build -o server cmd/server/main.go
```

## Endpoints

- `GET /health` returns `OK` for health checks.
- `GET /ws` upgrades to the game WebSocket protocol.

## Environment

Copy values from `.env.example` only when local defaults are not enough.

- `PORT`: HTTP/WebSocket port. Defaults to `8080`.
- `HOST`: Bind host. Local root workflows bind to `0.0.0.0` for LAN testing.
- `ENABLE_SCHEMA_VALIDATION`: Enables outgoing schema validation when set to `true`.
- `GO_ENV`: Environment flag for deployment wiring. Defaults to `development`.
- `ALLOWED_ORIGINS`: Optional comma-separated origin allowlist. Production deployments should configure this explicitly.
- `LOG_LEVEL`: Server log level.

Current implementation intent lives in [`../specs/`](../specs/).
