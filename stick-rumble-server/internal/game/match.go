package game

import (
	"sync"
	"time"
)

// MatchState represents the current state of a match
type MatchState string

const (
	MatchStateWaiting MatchState = "waiting" // Waiting for players
	MatchStateActive  MatchState = "active"  // Match in progress
	MatchStateEnded   MatchState = "ended"   // Match completed
)

// MatchConfig contains configuration for a match
type MatchConfig struct {
	KillTarget       int // Number of kills needed to win (e.g., 20)
	TimeLimitSeconds int // Time limit in seconds (e.g., 420 = 7 minutes)
}

// Match represents a game match with win conditions and state tracking
type Match struct {
	Config      MatchConfig
	State       MatchState
	StartTime   time.Time
	EndReason   string         // "kill_target" or "time_limit"
	PlayerKills map[string]int // Maps player ID to kill count
	mu          sync.RWMutex
}

// NewMatch creates a new match with default configuration
func NewMatch() *Match {
	return &Match{
		Config: MatchConfig{
			KillTarget:       20,
			TimeLimitSeconds: 420, // 7 minutes
		},
		State:       MatchStateWaiting,
		PlayerKills: make(map[string]int),
	}
}

// Start begins the match and records the start time
func (m *Match) Start() {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Don't restart if already active
	if m.State == MatchStateActive {
		return
	}

	m.State = MatchStateActive
	m.StartTime = time.Now()
}

// GetRemainingSeconds calculates the remaining time in the match
func (m *Match) GetRemainingSeconds() int {
	m.mu.RLock()
	defer m.mu.RUnlock()

	// If match not started, return full time
	if m.StartTime.IsZero() {
		return m.Config.TimeLimitSeconds
	}

	elapsed := int(time.Since(m.StartTime).Seconds())
	remaining := m.Config.TimeLimitSeconds - elapsed

	if remaining < 0 {
		return 0
	}

	return remaining
}

// AddKill increments the kill count for a player
func (m *Match) AddKill(playerID string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.PlayerKills[playerID]++
}

// CheckKillTarget checks if any player has reached the kill target
func (m *Match) CheckKillTarget() bool {
	m.mu.RLock()
	defer m.mu.RUnlock()

	for _, kills := range m.PlayerKills {
		if kills >= m.Config.KillTarget {
			return true
		}
	}

	return false
}

// CheckTimeLimit checks if the time limit has been reached
func (m *Match) CheckTimeLimit() bool {
	m.mu.RLock()
	defer m.mu.RUnlock()

	// If match not started, time limit not reached
	if m.StartTime.IsZero() {
		return false
	}

	elapsed := time.Since(m.StartTime).Seconds()
	return elapsed >= float64(m.Config.TimeLimitSeconds)
}

// EndMatch ends the match with the given reason
func (m *Match) EndMatch(reason string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Only end once
	if m.State == MatchStateEnded {
		return
	}

	m.State = MatchStateEnded
	m.EndReason = reason
}

// IsEnded returns true if the match has ended
func (m *Match) IsEnded() bool {
	m.mu.RLock()
	defer m.mu.RUnlock()

	return m.State == MatchStateEnded
}
