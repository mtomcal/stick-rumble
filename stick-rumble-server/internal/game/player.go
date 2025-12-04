package game

import (
	"sync"
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
	ID       string     `json:"id"`
	Position Vector2    `json:"position"`
	Velocity Vector2    `json:"velocity"`
	AimAngle float64    `json:"aimAngle"` // Aim angle in radians
	input    InputState // Private field, accessed via methods
	mu       sync.RWMutex
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

// Snapshot returns a thread-safe copy of the player's current state
func (p *PlayerState) Snapshot() PlayerState {
	p.mu.RLock()
	defer p.mu.RUnlock()
	return PlayerState{
		ID:       p.ID,
		Position: p.Position,
		Velocity: p.Velocity,
		AimAngle: p.AimAngle,
	}
}
