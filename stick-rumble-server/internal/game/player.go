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
	input                  InputState // Private field, accessed via methods
	mu                     sync.RWMutex
}

// NewPlayerState creates a new player state with default spawn position
func NewPlayerState(id string) *PlayerState {
	return &PlayerState{
		ID: id,
		Position: Vector2{
			X: ArenaWidth / 2,
			Y: ArenaHeight / 2,
		},
		Velocity: Vector2{X: 0, Y: 0},
		Health:   PlayerMaxHealth,
		input:    InputState{},
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
func (p *PlayerState) TakeDamage(amount int) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.Health -= amount
	if p.Health < 0 {
		p.Health = 0
	}
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
	}
}

// MarkDead marks the player as dead and records the death time (thread-safe)
func (p *PlayerState) MarkDead() {
	p.mu.Lock()
	defer p.mu.Unlock()
	now := time.Now()
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
	return time.Since(*p.DeathTime).Seconds() >= RespawnDelay
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
	p.InvulnerabilityEndTime = time.Now().Add(time.Duration(SpawnInvulnerabilityDuration * float64(time.Second)))
}

// UpdateInvulnerability checks and updates invulnerability status (thread-safe)
func (p *PlayerState) UpdateInvulnerability() {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.IsInvulnerable && time.Now().After(p.InvulnerabilityEndTime) {
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
