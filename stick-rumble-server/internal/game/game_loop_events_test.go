package game

import (
	"reflect"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type recordingGameLoopSink struct {
	events []GameLoopEvent
}

func (s *recordingGameLoopSink) HandleGameLoopEvent(event GameLoopEvent) {
	s.events = append(s.events, event)
}

func newGameServerWithSink(clock Clock, sink GameLoopEventSink) *GameServer {
	return NewGameServerWithConfig(GameServerConfig{
		Clock:     clock,
		EventSink: sink,
	})
}

func requireSingleEvent[T any](t *testing.T, events []GameLoopEvent) T {
	t.Helper()

	require.Len(t, events, 1)

	event, ok := events[0].(T)
	require.True(t, ok, "unexpected event type: %T", events[0])
	return event
}

func TestGameServerEmitsProjectileHitResolvedEvent(t *testing.T) {
	sink := &recordingGameLoopSink{}
	gs := newGameServerWithSink(&RealClock{}, sink)

	attacker := gs.AddPlayer("attacker")
	victim := gs.AddPlayer("victim")

	weaponState := gs.GetWeaponState(attacker.ID)
	require.NotNil(t, weaponState)
	victim.Health = weaponState.Weapon.Damage

	projectile := gs.projectileManager.CreateProjectile(attacker.ID, weaponState.Weapon.Name, attacker.GetPosition(), 0, weaponState.Weapon.ProjectileSpeed)
	victim.Position = projectile.Position

	gs.checkHitDetection()

	event := requireSingleEvent[ProjectileHitResolvedEvent](t, sink.events)
	assert.Equal(t, attacker.ID, event.Outcome.Hit.AttackerID)
	assert.Equal(t, victim.ID, event.Outcome.Hit.VictimID)
	assert.True(t, event.Outcome.Killed)
}

func TestGameServerEmitsRespawnEvent(t *testing.T) {
	clock := NewManualClock(time.Now())
	sink := &recordingGameLoopSink{}
	gs := newGameServerWithSink(clock, sink)

	player := gs.AddPlayer("player1")
	player.MarkDead()
	clock.Advance(time.Duration(RespawnDelay*1000+100) * time.Millisecond)

	gs.checkRespawns()

	event := requireSingleEvent[PlayerRespawnedEvent](t, sink.events)
	assert.Equal(t, "player1", event.PlayerID)
	assert.Equal(t, PlayerMaxHealth, event.NewHealth)
}

func TestGameServerEmitsReloadCompleteEvent(t *testing.T) {
	clock := NewManualClock(time.Now())
	sink := &recordingGameLoopSink{}
	gs := newGameServerWithSink(clock, sink)

	playerID := "player1"
	gs.AddPlayer(playerID)
	ws := gs.GetWeaponState(playerID)
	ws.CurrentAmmo = 1
	require.True(t, gs.PlayerReload(playerID))

	clock.Advance(ws.Weapon.ReloadTime + 100*time.Millisecond)
	gs.checkReloads()

	event := requireSingleEvent[ReloadCompletedEvent](t, sink.events)
	assert.Equal(t, playerID, event.PlayerID)
}

func TestGameServerEmitsRollEndedEvent(t *testing.T) {
	clock := NewManualClock(time.Now())
	sink := &recordingGameLoopSink{}
	gs := newGameServerWithSink(clock, sink)

	player := gs.AddPlayer("player1")
	player.StartDodgeRoll(Vector2{X: 1, Y: 0})
	clock.Advance(time.Duration(DodgeRollDuration*1000+50) * time.Millisecond)

	gs.checkRollDuration()

	event := requireSingleEvent[RollEndedEvent](t, sink.events)
	assert.Equal(t, "player1", event.PlayerID)
	assert.Equal(t, "completed", event.Reason)
}

func TestGameServerEmitsRollEndedEventForWallCollision(t *testing.T) {
	sink := &recordingGameLoopSink{}
	gs := newGameServerWithSink(&RealClock{}, sink)
	mapConfig := openTestMapConfig()
	mapConfig.Obstacles = []MapObstacle{
		{ID: "wall", X: 130, Y: 80, Width: 20, Height: 40, BlocksMovement: true},
	}
	gs.world.mapConfig = mapConfig
	gs.physics = NewPhysics(mapConfig)
	gs.projectileManager = NewProjectileManager(mapConfig)

	player := gs.AddPlayer("player1")
	player.SetPosition(Vector2{X: 125, Y: 100})
	player.StartDodgeRoll(Vector2{X: 1, Y: 0})

	gs.updateAllPlayers(1.0 / 60.0)

	event := requireSingleEvent[RollEndedEvent](t, sink.events)
	assert.Equal(t, "wall_collision", event.Reason)
}

func TestGameServerEmitsWeaponRespawnEvent(t *testing.T) {
	sink := &recordingGameLoopSink{}
	gs := newGameServerWithSink(&RealClock{}, sink)

	var crate *WeaponCrate
	for _, candidate := range gs.GetWeaponCrateManager().GetAllCrates() {
		if candidate.IsAvailable {
			crate = candidate
			break
		}
	}
	require.NotNil(t, crate)

	require.True(t, gs.GetWeaponCrateManager().PickupCrate(crate.ID))
	crate.RespawnTime = time.Now().Add(-time.Second)

	gs.checkWeaponRespawns()

	event := requireSingleEvent[WeaponCrateRespawnedEvent](t, sink.events)
	assert.Equal(t, crate.ID, event.CrateID)
	assert.Equal(t, crate.WeaponType, event.WeaponType)
}

func TestMatchEventEmitterEmitsTimerAndMatchEndedEvents(t *testing.T) {
	clock := NewManualClock(time.Now())
	sink := &recordingGameLoopSink{}
	emitter := NewMatchEventEmitter(clock, sink)

	world := NewWorldWithClock(clock)
	player := world.AddPlayer("player1")
	player.SetDisplayName("Alpha")

	match := NewMatch()
	match.RegisterPlayer("player1")
	match.StartTime = clock.Now().Add(-time.Duration(match.Config.TimeLimitSeconds) * time.Second)
	match.State = MatchStateActive

	emitter.EmitRoomTick("room-1", match, world)

	require.Len(t, sink.events, 2)
	_, ok := sink.events[0].(MatchTimerUpdatedEvent)
	require.True(t, ok)

	ended, ok := sink.events[1].(MatchEndedEvent)
	require.True(t, ok)
	assert.Equal(t, "room-1", ended.RoomID)
	assert.Equal(t, "time_limit", ended.Reason)
}

func TestMatchEventEmitterEmitsTimerWithoutEndingActiveMatch(t *testing.T) {
	clock := NewManualClock(time.Now())
	sink := &recordingGameLoopSink{}
	emitter := NewMatchEventEmitter(clock, sink)

	world := NewWorldWithClock(clock)
	world.AddPlayer("player1")

	match := NewMatch()
	match.RegisterPlayer("player1")
	match.StartTime = clock.Now().Add(-5 * time.Second)
	match.State = MatchStateActive

	emitter.EmitRoomTick("room-1", match, world)

	event := requireSingleEvent[MatchTimerUpdatedEvent](t, sink.events)
	assert.Equal(t, "room-1", event.RoomID)
	assert.False(t, match.IsEnded())
}

func TestGameServerRemovesLegacyTransportCallbackSetters(t *testing.T) {
	gameServerType := reflect.TypeOf((*GameServer)(nil))
	legacyMethods := []string{
		"SetOnReloadComplete",
		"SetOnHit",
		"SetOnProjectileHitOutcome",
		"SetOnRespawn",
		"SetOnWeaponPickup",
		"SetOnWeaponRespawn",
		"SetOnRollEnd",
	}

	for _, methodName := range legacyMethods {
		_, exists := gameServerType.MethodByName(methodName)
		assert.False(t, exists, "legacy setter %s should be removed", methodName)
	}
}
