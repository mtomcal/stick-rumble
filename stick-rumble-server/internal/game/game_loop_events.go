package game

type GameLoopEvent interface {
	gameLoopEventName() string
}

type GameLoopEventSink interface {
	HandleGameLoopEvent(event GameLoopEvent)
}

type ProjectileHitResolvedEvent struct {
	Outcome ProjectileHitOutcome
}

func (ProjectileHitResolvedEvent) gameLoopEventName() string { return "projectile_hit_resolved" }

type ReloadCompletedEvent struct {
	PlayerID string
}

func (ReloadCompletedEvent) gameLoopEventName() string { return "reload_completed" }

type PlayerRespawnedEvent struct {
	PlayerID  string
	Position  Vector2
	NewHealth int
}

func (PlayerRespawnedEvent) gameLoopEventName() string { return "player_respawned" }

type RollEndedEvent struct {
	PlayerID string
	Reason   string
}

func (RollEndedEvent) gameLoopEventName() string { return "roll_ended" }

type WeaponCrateRespawnedEvent struct {
	CrateID    string
	WeaponType string
	Position   Vector2
}

func (WeaponCrateRespawnedEvent) gameLoopEventName() string { return "weapon_crate_respawned" }

type MatchTimerUpdatedEvent struct {
	RoomID           string
	RemainingSeconds int
}

func (MatchTimerUpdatedEvent) gameLoopEventName() string { return "match_timer_updated" }

type MatchEndedEvent struct {
	RoomID      string
	Reason      string
	Winners     []WinnerSummary
	FinalScores []PlayerScore
}

func (MatchEndedEvent) gameLoopEventName() string { return "match_ended" }

type GameServerConfig struct {
	BroadcastFunc func(playerStates []PlayerStateSnapshot)
	Clock         Clock
	EventSink     GameLoopEventSink
	RTTProvider   func(playerID string) int64
}

type MatchEventEmitter struct {
	clock Clock
	sink  GameLoopEventSink
}

func NewMatchEventEmitter(clock Clock, sink GameLoopEventSink) *MatchEventEmitter {
	if clock == nil {
		clock = &RealClock{}
	}

	return &MatchEventEmitter{
		clock: clock,
		sink:  sink,
	}
}

func (e *MatchEventEmitter) EmitRoomTick(roomID string, match *Match, world *World) {
	if e == nil || e.sink == nil || match == nil || world == nil {
		return
	}

	if match.IsEnded() {
		return
	}

	remainingSeconds := e.remainingSeconds(match)
	e.sink.HandleGameLoopEvent(MatchTimerUpdatedEvent{
		RoomID:           roomID,
		RemainingSeconds: remainingSeconds,
	})

	if !e.timeLimitReached(match) {
		return
	}

	match.EndMatch("time_limit")
	e.sink.HandleGameLoopEvent(MatchEndedEvent{
		RoomID:      roomID,
		Reason:      match.EndReason,
		Winners:     match.GetWinnerSummaries(world),
		FinalScores: match.GetFinalScores(world),
	})
}

func (e *MatchEventEmitter) remainingSeconds(match *Match) int {
	match.mu.RLock()
	defer match.mu.RUnlock()

	if match.StartTime.IsZero() {
		return match.Config.TimeLimitSeconds
	}

	elapsed := int(e.clock.Since(match.StartTime).Seconds())
	remaining := match.Config.TimeLimitSeconds - elapsed
	if remaining < 0 {
		return 0
	}

	return remaining
}

func (e *MatchEventEmitter) timeLimitReached(match *Match) bool {
	match.mu.RLock()
	defer match.mu.RUnlock()

	if match.StartTime.IsZero() {
		return false
	}

	return e.clock.Since(match.StartTime).Seconds() >= float64(match.Config.TimeLimitSeconds)
}
