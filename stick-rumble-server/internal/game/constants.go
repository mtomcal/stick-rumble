package game

// Movement constants - must match client-side values in src/shared/constants.ts
const (
	// MovementSpeed is the maximum movement speed in pixels per second
	MovementSpeed = 200.0

	// SprintSpeed is the maximum sprint speed in pixels per second (1.5x normal speed)
	SprintSpeed = 300.0

	// SprintSpreadMultiplier is the accuracy penalty multiplier while sprinting (1.5x spread)
	SprintSpreadMultiplier = 1.5

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

// Kill credit and stats
const (
	// KillXPReward is the amount of XP awarded for each kill
	KillXPReward = 100
)

// Health regeneration
const (
	// HealthRegenerationDelay is the time in seconds before health starts regenerating after taking damage
	HealthRegenerationDelay = 5.0

	// HealthRegenerationRate is the amount of HP restored per second
	HealthRegenerationRate = 10.0
)

// Weapon pickup system
const (
	// WeaponRespawnDelay is the time in seconds before a weapon respawns after pickup
	WeaponRespawnDelay = 30.0

	// WeaponPickupRadius is the distance in pixels for weapon pickup detection
	WeaponPickupRadius = 32.0
)

// Dodge roll system
const (
	// DodgeRollDuration is the total duration of a dodge roll in seconds
	DodgeRollDuration = 0.4

	// DodgeRollDistance is the total distance covered during a roll in pixels
	DodgeRollDistance = 100.0

	// DodgeRollVelocity is the velocity during a roll (distance / duration)
	DodgeRollVelocity = DodgeRollDistance / DodgeRollDuration // 250 px/s

	// DodgeRollCooldown is the time in seconds between rolls
	DodgeRollCooldown = 3.0

	// DodgeRollInvincibilityDuration is the duration of invincibility frames in seconds
	DodgeRollInvincibilityDuration = 0.2
)
