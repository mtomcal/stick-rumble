package game

import (
	"sync"
	"time"
)

// Vector2 represents a 2D vector for position and velocity
type Vector2 struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

// InputState represents the player's current input (WASD keys and aim)
type InputState struct {
	Up       bool    `json:"up"`       // W key
	Down     bool    `json:"down"`     // S key
	Left     bool    `json:"left"`     // A key
	Right    bool    `json:"right"`    // D key
	AimAngle float64 `json:"aimAngle"` // Aim angle in radians
}

// PlayerState represents a player's physics state in the game world
type PlayerState struct {
	ID                     string     `json:"id"`
	Position               Vector2    `json:"position"`
	Velocity               Vector2    `json:"velocity"`
	AimAngle               float64    `json:"aimAngle"`            // Aim angle in radians
	Health                 int        `json:"health"`              // Current health (0-100)
	IsInvulnerable         bool       `json:"isInvulnerable"`      // Spawn protection flag
	InvulnerabilityEndTime time.Time  `json:"invulnerabilityEnd"`  // When spawn protection ends
	DeathTime              *time.Time `json:"deathTime,omitempty"` // When player died (nil if alive)
	Kills                  int        `json:"kills"`               // Number of kills
	Deaths                 int        `json:"deaths"`              // Number of deaths
	XP                     int        `json:"xp"`                  // Experience points
	IsRegeneratingHealth   bool       `json:"isRegenerating"`      // Whether health is currently regenerating
	lastDamageTime         time.Time  // Private field: when player last took damage
	regenAccumulator       float64    // Private field: accumulated fractional HP for regeneration
	input                  InputState // Private field, accessed via methods
	clock                  Clock      // Private field: clock for time operations (injectable for testing)
	mu                     sync.RWMutex
}

// NewPlayerState creates a new player state with default spawn position and real clock
func NewPlayerState(id string) *PlayerState {
	return NewPlayerStateWithClock(id, &RealClock{})
}

// NewPlayerStateWithClock creates a new player state with a custom clock (for testing)
func NewPlayerStateWithClock(id string, clock Clock) *PlayerState {
	return &PlayerState{
		ID: id,
		Position: Vector2{
			X: ArenaWidth / 2,
			Y: ArenaHeight / 2,
		},
		Velocity:       Vector2{X: 0, Y: 0},
		Health:         PlayerMaxHealth,
		input:          InputState{},
		clock:          clock,
		lastDamageTime: clock.Now(), // Initialize to prevent immediate regeneration
	}
}

// SetInput updates the player's input state (thread-safe)
func (p *PlayerState) SetInput(input InputState) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.input = input
}

// GetInput retrieves the player's input state (thread-safe)
func (p *PlayerState) GetInput() InputState {
	p.mu.RLock()
	defer p.mu.RUnlock()
	return p.input
}

// SetPosition updates the player's position (thread-safe)
func (p *PlayerState) SetPosition(pos Vector2) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.Position = pos
}

// GetPosition retrieves the player's position (thread-safe)
func (p *PlayerState) GetPosition() Vector2 {
	p.mu.RLock()
	defer p.mu.RUnlock()
	return p.Position
}

// SetVelocity updates the player's velocity (thread-safe)
func (p *PlayerState) SetVelocity(vel Vector2) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.Velocity = vel
}

// GetVelocity retrieves the player's velocity (thread-safe)
func (p *PlayerState) GetVelocity() Vector2 {
	p.mu.RLock()
	defer p.mu.RUnlock()
	return p.Velocity
}

// SetAimAngle updates the player's aim angle (thread-safe)
func (p *PlayerState) SetAimAngle(angle float64) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.AimAngle = angle
}

// GetAimAngle retrieves the player's aim angle (thread-safe)
func (p *PlayerState) GetAimAngle() float64 {
	p.mu.RLock()
	defer p.mu.RUnlock()
	return p.AimAngle
}

// TakeDamage reduces the player's health by the given amount (thread-safe)
// Health will not go below 0
// Updates lastDamageTime to reset regeneration timer
func (p *PlayerState) TakeDamage(amount int) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.Health -= amount
	if p.Health < 0 {
		p.Health = 0
	}
	p.lastDamageTime = p.clock.Now()
	p.IsRegeneratingHealth = false // Stop regeneration when taking damage
	p.regenAccumulator = 0.0       // Reset regeneration accumulator
}

// IsAlive returns true if the player has health remaining (thread-safe)
func (p *PlayerState) IsAlive() bool {
	p.mu.RLock()
	defer p.mu.RUnlock()
	return p.Health > 0
}

// Snapshot returns a thread-safe copy of the player's current state
func (p *PlayerState) Snapshot() PlayerState {
	p.mu.RLock()
	defer p.mu.RUnlock()
	return PlayerState{
		ID:                     p.ID,
		Position:               p.Position,
		Velocity:               p.Velocity,
		AimAngle:               p.AimAngle,
		Health:                 p.Health,
		IsInvulnerable:         p.IsInvulnerable,
		InvulnerabilityEndTime: p.InvulnerabilityEndTime,
		DeathTime:              p.DeathTime,
		Kills:                  p.Kills,
		Deaths:                 p.Deaths,
		XP:                     p.XP,
		IsRegeneratingHealth:   p.IsRegeneratingHealth,
	}
}

// MarkDead marks the player as dead and records the death time (thread-safe)
func (p *PlayerState) MarkDead() {
	p.mu.Lock()
	defer p.mu.Unlock()
	now := p.clock.Now()
	p.DeathTime = &now
	p.Health = 0
}

// IsDead returns true if the player is currently dead (thread-safe)
func (p *PlayerState) IsDead() bool {
	p.mu.RLock()
	defer p.mu.RUnlock()
	return p.DeathTime != nil
}

// CanRespawn returns true if the respawn delay has passed (thread-safe)
func (p *PlayerState) CanRespawn() bool {
	p.mu.RLock()
	defer p.mu.RUnlock()
	if p.DeathTime == nil {
		return false
	}
	return p.clock.Since(*p.DeathTime).Seconds() >= RespawnDelay
}

// Respawn resets the player to alive state at the given position (thread-safe)
func (p *PlayerState) Respawn(spawnPos Vector2) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.Health = PlayerMaxHealth
	p.Position = spawnPos
	p.Velocity = Vector2{X: 0, Y: 0}
	p.DeathTime = nil
	p.IsInvulnerable = true
	p.InvulnerabilityEndTime = p.clock.Now().Add(time.Duration(SpawnInvulnerabilityDuration * float64(time.Second)))
	p.regenAccumulator = 0.0         // Clear regeneration accumulator on respawn
	p.lastDamageTime = p.clock.Now() // Reset regeneration timer to prevent immediate regeneration
}

// UpdateInvulnerability checks and updates invulnerability status (thread-safe)
func (p *PlayerState) UpdateInvulnerability() {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.IsInvulnerable && p.clock.Now().After(p.InvulnerabilityEndTime) {
		p.IsInvulnerable = false
	}
}

// IncrementKills increments the player's kill count (thread-safe)
func (p *PlayerState) IncrementKills() {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.Kills++
}

// IncrementDeaths increments the player's death count (thread-safe)
func (p *PlayerState) IncrementDeaths() {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.Deaths++
}

// AddXP adds experience points to the player (thread-safe)
func (p *PlayerState) AddXP(amount int) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.XP += amount
}

// GetKDRatio calculates the kill/death ratio (thread-safe)
// Returns 0 if player has no kills or deaths
func (p *PlayerState) GetKDRatio() float64 {
	p.mu.RLock()
	defer p.mu.RUnlock()
	if p.Deaths == 0 {
		return float64(p.Kills)
	}
	return float64(p.Kills) / float64(p.Deaths)
}

// GetLastDamageTime returns the time when the player last took damage (thread-safe)
func (p *PlayerState) GetLastDamageTime() time.Time {
	p.mu.RLock()
	defer p.mu.RUnlock()
	return p.lastDamageTime
}

// CanRegenerate checks if the player can regenerate health at the given time (thread-safe)
// Returns true if enough time has passed since last damage and health is below max
func (p *PlayerState) CanRegenerate(now time.Time) bool {
	p.mu.RLock()
	defer p.mu.RUnlock()

	// Cannot regenerate if dead
	if p.DeathTime != nil {
		return false
	}

	// Cannot regenerate if at full health
	if p.Health >= PlayerMaxHealth {
		return false
	}

	// Check if enough time has passed since last damage
	timeSinceLastDamage := now.Sub(p.lastDamageTime).Seconds()
	return timeSinceLastDamage >= HealthRegenerationDelay
}

// ApplyRegeneration applies health regeneration for the given deltaTime (thread-safe)
// Only regenerates if conditions are met (delay passed, not at max health, not dead)
func (p *PlayerState) ApplyRegeneration(now time.Time, deltaTime float64) {
	p.mu.Lock()
	defer p.mu.Unlock()

	// Check if we can regenerate
	if p.DeathTime != nil || p.Health >= PlayerMaxHealth {
		p.IsRegeneratingHealth = false
		return
	}

	timeSinceLastDamage := now.Sub(p.lastDamageTime).Seconds()
	if timeSinceLastDamage < HealthRegenerationDelay {
		p.IsRegeneratingHealth = false
		return
	}

	// Apply regeneration using accumulator for fractional HP
	// At 60Hz tick rate (deltaTime ≈ 0.0167s), HealthRegenerationRate * deltaTime ≈ 0.167 HP
	// We accumulate fractional HP and only apply full HP when accumulator >= 1.0
	p.regenAccumulator += HealthRegenerationRate * deltaTime

	// Apply accumulated HP as integer value
	if p.regenAccumulator >= 1.0 {
		regenAmount := int(p.regenAccumulator)
		p.Health += regenAmount
		p.regenAccumulator -= float64(regenAmount) // Keep the fractional remainder
	}

	// Cap at max health and clear accumulator
	if p.Health >= PlayerMaxHealth {
		p.Health = PlayerMaxHealth
		p.regenAccumulator = 0.0 // Clear accumulator at max health
	}

	// Update regeneration state
	p.IsRegeneratingHealth = p.Health < PlayerMaxHealth
}

// UpdateRegenerationState updates the IsRegeneratingHealth flag based on current conditions (thread-safe)
func (p *PlayerState) UpdateRegenerationState(now time.Time) {
	p.mu.Lock()
	defer p.mu.Unlock()

	// Update regeneration state
	if p.DeathTime != nil || p.Health >= PlayerMaxHealth {
		p.IsRegeneratingHealth = false
		return
	}

	timeSinceLastDamage := now.Sub(p.lastDamageTime).Seconds()
	p.IsRegeneratingHealth = timeSinceLastDamage >= HealthRegenerationDelay
}

// IsRegenerating returns whether the player is currently regenerating health (thread-safe)
func (p *PlayerState) IsRegenerating() bool {
	p.mu.RLock()
	defer p.mu.RUnlock()
	return p.IsRegeneratingHealth
}
