package game

// Movement constants - must match client-side values in src/shared/constants.ts
const (
	// MovementSpeed is the maximum movement speed in pixels per second
	MovementSpeed = 200.0

	// Acceleration is the rate at which players accelerate in pixels per second squared
	Acceleration = 50.0

	// Deceleration is the rate at which players decelerate when no input
	Deceleration = 50.0
)

// Arena bounds - must match client-side values in src/shared/constants.ts
const (
	// ArenaWidth is the arena width in pixels
	ArenaWidth = 1920.0

	// ArenaHeight is the arena height in pixels
	ArenaHeight = 1080.0
)

// Network update rates
const (
	// ServerTickRate is the server physics tick rate in Hz
	ServerTickRate = 60

	// ClientUpdateRate is the rate at which clients receive position updates in Hz
	ClientUpdateRate = 20

	// ServerTickInterval is the duration between server ticks in milliseconds
	ServerTickInterval = 1000 / ServerTickRate // ~16.67ms

	// ClientUpdateInterval is the duration between client updates in milliseconds
	ClientUpdateInterval = 1000 / ClientUpdateRate // 50ms
)

// Player appearance
const (
	// PlayerWidth is the player sprite width in pixels
	PlayerWidth = 32.0

	// PlayerHeight is the player sprite height in pixels
	PlayerHeight = 64.0
)

// Player health
const (
	// PlayerMaxHealth is the maximum health a player can have
	PlayerMaxHealth = 100
)

// Respawn system
const (
	// RespawnDelay is the time in seconds before a player respawns after death
	RespawnDelay = 3.0

	// SpawnInvulnerabilityDuration is the time in seconds of spawn protection
	SpawnInvulnerabilityDuration = 2.0
)
