package game

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

// TestNewMatch tests match creation with proper configuration
func TestNewMatch(t *testing.T) {
	t.Run("creates match with default config", func(t *testing.T) {
		match := NewMatch()

		assert.NotNil(t, match)
		assert.Equal(t, 20, match.Config.KillTarget)
		assert.Equal(t, 420, match.Config.TimeLimitSeconds)
		assert.Equal(t, MatchStateWaiting, match.State)
		assert.NotNil(t, match.PlayerKills)
		assert.Equal(t, 0, len(match.PlayerKills))
	})
}

// TestMatchStart tests match start time tracking
func TestMatchStart(t *testing.T) {
	t.Run("sets match state to active and records start time", func(t *testing.T) {
		match := NewMatch()

		match.Start()

		assert.Equal(t, MatchStateActive, match.State)
		assert.False(t, match.StartTime.IsZero())
		assert.WithinDuration(t, time.Now(), match.StartTime, 100*time.Millisecond)
	})

	t.Run("does not restart if already active", func(t *testing.T) {
		match := NewMatch()
		match.Start()
		firstStartTime := match.StartTime

		time.Sleep(10 * time.Millisecond)
		match.Start()

		assert.Equal(t, firstStartTime, match.StartTime)
	})
}

// TestGetRemainingSeconds tests remaining time calculation
func TestGetRemainingSeconds(t *testing.T) {
	t.Run("returns full time when match not started", func(t *testing.T) {
		match := NewMatch()

		remaining := match.GetRemainingSeconds()

		assert.Equal(t, 420, remaining)
	})

	t.Run("calculates remaining time correctly", func(t *testing.T) {
		match := NewMatch()
		match.Start()

		// Manually set start time to 10 seconds ago
		match.StartTime = time.Now().Add(-10 * time.Second)

		remaining := match.GetRemainingSeconds()

		assert.InDelta(t, 410, remaining, 1) // Allow 1 second tolerance
	})

	t.Run("returns 0 when time expired", func(t *testing.T) {
		match := NewMatch()
		match.Start()

		// Set start time to 421 seconds ago (past time limit)
		match.StartTime = time.Now().Add(-421 * time.Second)

		remaining := match.GetRemainingSeconds()

		assert.Equal(t, 0, remaining)
	})
}

// TestAddKill tests kill tracking and kill target checking
func TestAddKill(t *testing.T) {
	t.Run("tracks kill for player", func(t *testing.T) {
		match := NewMatch()
		playerID := "player-1"

		match.AddKill(playerID)

		assert.Equal(t, 1, match.PlayerKills[playerID])
	})

	t.Run("increments kills for existing player", func(t *testing.T) {
		match := NewMatch()
		playerID := "player-1"

		match.AddKill(playerID)
		match.AddKill(playerID)
		match.AddKill(playerID)

		assert.Equal(t, 3, match.PlayerKills[playerID])
	})

	t.Run("tracks kills for multiple players", func(t *testing.T) {
		match := NewMatch()

		match.AddKill("player-1")
		match.AddKill("player-2")
		match.AddKill("player-1")

		assert.Equal(t, 2, match.PlayerKills["player-1"])
		assert.Equal(t, 1, match.PlayerKills["player-2"])
	})
}

// TestCheckKillTarget tests kill target win condition
func TestCheckKillTarget(t *testing.T) {
	t.Run("returns false when no player reached kill target", func(t *testing.T) {
		match := NewMatch()
		match.AddKill("player-1")
		match.AddKill("player-2")

		reached := match.CheckKillTarget()

		assert.False(t, reached)
	})

	t.Run("returns true when player reaches exactly 20 kills", func(t *testing.T) {
		match := NewMatch()

		for i := 0; i < 20; i++ {
			match.AddKill("player-1")
		}

		reached := match.CheckKillTarget()

		assert.True(t, reached)
	})

	t.Run("returns true when player exceeds 20 kills", func(t *testing.T) {
		match := NewMatch()

		for i := 0; i < 25; i++ {
			match.AddKill("player-1")
		}

		reached := match.CheckKillTarget()

		assert.True(t, reached)
	})
}

// TestCheckTimeLimit tests time limit win condition
func TestCheckTimeLimit(t *testing.T) {
	t.Run("returns false when time remaining", func(t *testing.T) {
		match := NewMatch()
		match.Start()

		expired := match.CheckTimeLimit()

		assert.False(t, expired)
	})

	t.Run("returns false when match not started", func(t *testing.T) {
		match := NewMatch()

		expired := match.CheckTimeLimit()

		assert.False(t, expired)
	})

	t.Run("returns true when time expired", func(t *testing.T) {
		match := NewMatch()
		match.Start()

		// Set start time to 421 seconds ago
		match.StartTime = time.Now().Add(-421 * time.Second)

		expired := match.CheckTimeLimit()

		assert.True(t, expired)
	})

	t.Run("returns true when exactly at time limit", func(t *testing.T) {
		match := NewMatch()
		match.Start()

		// Set start time to exactly 420 seconds ago
		match.StartTime = time.Now().Add(-420 * time.Second)

		expired := match.CheckTimeLimit()

		assert.True(t, expired)
	})
}

// TestEndMatch tests match end logic
func TestEndMatch(t *testing.T) {
	t.Run("sets match state to ended", func(t *testing.T) {
		match := NewMatch()
		match.Start()

		match.EndMatch("kill_target")

		assert.Equal(t, MatchStateEnded, match.State)
	})

	t.Run("stores end reason", func(t *testing.T) {
		match := NewMatch()
		match.Start()

		match.EndMatch("time_limit")

		assert.Equal(t, "time_limit", match.EndReason)
	})

	t.Run("can only end once", func(t *testing.T) {
		match := NewMatch()
		match.Start()

		match.EndMatch("kill_target")
		match.EndMatch("time_limit")

		assert.Equal(t, "kill_target", match.EndReason)
		assert.Equal(t, MatchStateEnded, match.State)
	})
}

// TestIsEnded tests match ended state check
func TestIsEnded(t *testing.T) {
	t.Run("returns false for new match", func(t *testing.T) {
		match := NewMatch()

		assert.False(t, match.IsEnded())
	})

	t.Run("returns false for active match", func(t *testing.T) {
		match := NewMatch()
		match.Start()

		assert.False(t, match.IsEnded())
	})

	t.Run("returns true for ended match", func(t *testing.T) {
		match := NewMatch()
		match.Start()
		match.EndMatch("kill_target")

		assert.True(t, match.IsEnded())
	})
}
