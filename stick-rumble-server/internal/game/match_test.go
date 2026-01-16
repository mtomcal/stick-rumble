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

// TestDetermineWinners tests winner determination logic
func TestDetermineWinners(t *testing.T) {
	t.Run("single winner with most kills", func(t *testing.T) {
		match := NewMatch()
		match.AddKill("player-1")
		match.AddKill("player-1")
		match.AddKill("player-1")
		match.AddKill("player-2")
		match.AddKill("player-2")
		match.AddKill("player-3")

		winners := match.DetermineWinners()

		assert.Equal(t, []string{"player-1"}, winners)
	})

	t.Run("two-way tie returns both winners", func(t *testing.T) {
		match := NewMatch()
		match.AddKill("player-1")
		match.AddKill("player-1")
		match.AddKill("player-1")
		match.AddKill("player-2")
		match.AddKill("player-2")
		match.AddKill("player-2")
		match.AddKill("player-3")

		winners := match.DetermineWinners()

		assert.Len(t, winners, 2)
		assert.Contains(t, winners, "player-1")
		assert.Contains(t, winners, "player-2")
	})

	t.Run("three-way tie returns all three winners", func(t *testing.T) {
		match := NewMatch()
		match.AddKill("player-1")
		match.AddKill("player-1")
		match.AddKill("player-2")
		match.AddKill("player-2")
		match.AddKill("player-3")
		match.AddKill("player-3")

		winners := match.DetermineWinners()

		assert.Len(t, winners, 3)
		assert.Contains(t, winners, "player-1")
		assert.Contains(t, winners, "player-2")
		assert.Contains(t, winners, "player-3")
	})

	t.Run("all players tied at zero kills", func(t *testing.T) {
		match := NewMatch()
		// Simulate players exist but have no kills
		match.PlayerKills["player-1"] = 0
		match.PlayerKills["player-2"] = 0
		match.PlayerKills["player-3"] = 0

		winners := match.DetermineWinners()

		assert.Len(t, winners, 3)
		assert.Contains(t, winners, "player-1")
		assert.Contains(t, winners, "player-2")
		assert.Contains(t, winners, "player-3")
	})

	t.Run("single player with kills wins", func(t *testing.T) {
		match := NewMatch()
		match.AddKill("player-1")

		winners := match.DetermineWinners()

		assert.Equal(t, []string{"player-1"}, winners)
	})

	t.Run("returns empty when no players", func(t *testing.T) {
		match := NewMatch()

		winners := match.DetermineWinners()

		assert.Empty(t, winners)
	})

	t.Run("player with 20 kills wins via kill target", func(t *testing.T) {
		match := NewMatch()
		for i := 0; i < 20; i++ {
			match.AddKill("player-1")
		}
		match.AddKill("player-2")
		match.AddKill("player-2")

		winners := match.DetermineWinners()

		assert.Equal(t, []string{"player-1"}, winners)
	})
}

// TestGetFinalScores tests collecting final scores from match
func TestGetFinalScores(t *testing.T) {
	t.Run("collects scores for all players", func(t *testing.T) {
		// Create a world with players
		world := NewWorld()
		player1 := world.AddPlayer("player-1")
		player2 := world.AddPlayer("player-2")
		player3 := world.AddPlayer("player-3")

		// Update player stats
		player1.IncrementKills()
		player1.IncrementKills()
		player1.IncrementKills()
		player1.AddXP(150)

		player2.IncrementKills()
		player2.IncrementKills()
		player2.IncrementDeaths()
		player2.AddXP(100)

		player3.IncrementKills()
		player3.IncrementDeaths()
		player3.IncrementDeaths()
		player3.AddXP(50)

		// Create match and track kills
		match := NewMatch()
		match.AddKill("player-1")
		match.AddKill("player-1")
		match.AddKill("player-1")
		match.AddKill("player-2")
		match.AddKill("player-2")
		match.AddKill("player-3")

		scores := match.GetFinalScores(world)

		assert.Len(t, scores, 3)

		// Verify player-1 score
		score1 := findPlayerScore(scores, "player-1")
		assert.NotNil(t, score1)
		assert.Equal(t, "player-1", score1.PlayerID)
		assert.Equal(t, 3, score1.Kills)
		assert.Equal(t, 0, score1.Deaths)
		assert.Equal(t, 150, score1.XP)

		// Verify player-2 score
		score2 := findPlayerScore(scores, "player-2")
		assert.NotNil(t, score2)
		assert.Equal(t, "player-2", score2.PlayerID)
		assert.Equal(t, 2, score2.Kills)
		assert.Equal(t, 1, score2.Deaths)
		assert.Equal(t, 100, score2.XP)

		// Verify player-3 score
		score3 := findPlayerScore(scores, "player-3")
		assert.NotNil(t, score3)
		assert.Equal(t, "player-3", score3.PlayerID)
		assert.Equal(t, 1, score3.Kills)
		assert.Equal(t, 2, score3.Deaths)
		assert.Equal(t, 50, score3.XP)
	})

	t.Run("returns empty array when no players", func(t *testing.T) {
		world := NewWorld()
		match := NewMatch()

		scores := match.GetFinalScores(world)

		assert.Empty(t, scores)
	})

	t.Run("includes players with 0 kills in final scores", func(t *testing.T) {
		// Create a world with 3 players
		world := NewWorld()
		player1 := world.AddPlayer("player-1")
		player2 := world.AddPlayer("player-2")
		player3 := world.AddPlayer("player-3")

		// Player 1 gets 3 kills
		player1.IncrementKills()
		player1.IncrementKills()
		player1.IncrementKills()
		player1.AddXP(150)

		// Player 2 gets 1 kill and 1 death
		player2.IncrementKills()
		player2.IncrementDeaths()
		player2.AddXP(50)

		// Player 3 gets 0 kills but 2 deaths (should still be included!)
		player3.IncrementDeaths()
		player3.IncrementDeaths()
		// Player 3 gets base XP only
		player3.AddXP(50)

		// Create match and register all players
		match := NewMatch()
		match.RegisterPlayer("player-1")
		match.RegisterPlayer("player-2")
		match.RegisterPlayer("player-3")

		// Track kills in match (player-3 has no kills)
		match.AddKill("player-1")
		match.AddKill("player-1")
		match.AddKill("player-1")
		match.AddKill("player-2")

		scores := match.GetFinalScores(world)

		// All 3 players should be in final scores, even player-3 with 0 kills
		assert.Len(t, scores, 3)

		// Verify player-1 score
		score1 := findPlayerScore(scores, "player-1")
		assert.NotNil(t, score1)
		assert.Equal(t, 3, score1.Kills)
		assert.Equal(t, 0, score1.Deaths)
		assert.Equal(t, 150, score1.XP)

		// Verify player-2 score
		score2 := findPlayerScore(scores, "player-2")
		assert.NotNil(t, score2)
		assert.Equal(t, 1, score2.Kills)
		assert.Equal(t, 1, score2.Deaths)
		assert.Equal(t, 50, score2.XP)

		// Verify player-3 score (0 kills but should still be included)
		score3 := findPlayerScore(scores, "player-3")
		assert.NotNil(t, score3, "Player with 0 kills should be included in final scores")
		assert.Equal(t, 0, score3.Kills)
		assert.Equal(t, 2, score3.Deaths)
		assert.Equal(t, 50, score3.XP)
	})
}

// Helper function to find a player score by ID
func findPlayerScore(scores []PlayerScore, playerID string) *PlayerScore {
	for _, score := range scores {
		if score.PlayerID == playerID {
			return &score
		}
	}
	return nil
}
