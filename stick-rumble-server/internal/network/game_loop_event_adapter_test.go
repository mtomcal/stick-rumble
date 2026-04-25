package network

import (
	"testing"
	"time"

	"github.com/mtomcal/stick-rumble-server/internal/game"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestHandleGameLoopEvent_ProjectileHitOutcomePublishesCombatMessages(t *testing.T) {
	ts := newTestServer()
	defer ts.Close()

	conn1, conn2 := ts.connectTwoClients(t)
	defer conn1.Close()
	defer conn2.Close()

	player1ID := consumeRoomJoinedAndGetPlayerID(t, conn1)
	player2ID := consumeRoomJoinedAndGetPlayerID(t, conn2)

	ts.handler.gameServer.DamagePlayer(player2ID, game.PlayerMaxHealth)
	outcome, ok := ts.handler.gameServer.ProcessProjectileHit(game.HitEvent{
		VictimID:     player2ID,
		AttackerID:   player1ID,
		ProjectileID: "projectile-1",
	})
	require.True(t, ok)

	ts.handler.HandleGameLoopEvent(game.ProjectileHitResolvedEvent{Outcome: outcome})

	damaged, err := readMessageOfType(t, conn2, "player:damaged", 2*time.Second)
	require.NoError(t, err)
	damagedData, ok := damaged.Data.(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, player2ID, damagedData["victimId"])
	assert.Equal(t, "projectile-1", damagedData["projectileId"])
	assert.Equal(t, float64(outcome.Damage), damagedData["damage"])
	assert.Equal(t, float64(outcome.NewHealth), damagedData["newHealth"])

	confirmed, err := readMessageOfType(t, conn1, "hit:confirmed", 2*time.Second)
	require.NoError(t, err)
	confirmedData, ok := confirmed.Data.(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, player2ID, confirmedData["victimId"])
	assert.Equal(t, "projectile-1", confirmedData["projectileId"])

	death, err := readMessageOfType(t, conn1, "player:death", 2*time.Second)
	require.NoError(t, err)
	deathData, ok := death.Data.(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, player2ID, deathData["victimId"])
	assert.Equal(t, player1ID, deathData["attackerId"])

	killCredit, err := readMessageOfType(t, conn1, "player:kill_credit", 2*time.Second)
	require.NoError(t, err)
	killCreditData, ok := killCredit.Data.(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, player1ID, killCreditData["killerId"])
	assert.Equal(t, player2ID, killCreditData["victimId"])
	assert.Equal(t, float64(outcome.KillerKills), killCreditData["killerKills"])
	assert.Equal(t, float64(outcome.KillerXP), killCreditData["killerXP"])
}

func TestHandleGameLoopEvent_ReloadCompletedSendsWeaponState(t *testing.T) {
	ts := newTestServer()
	defer ts.Close()

	conn1, conn2 := ts.connectTwoClients(t)
	defer conn1.Close()
	defer conn2.Close()

	player1ID := consumeRoomJoinedAndGetPlayerID(t, conn1)
	_ = consumeRoomJoinedAndGetPlayerID(t, conn2)

	ts.handler.HandleGameLoopEvent(game.ReloadCompletedEvent{PlayerID: player1ID})

	msg, err := readMessageOfType(t, conn1, "weapon:state", 2*time.Second)
	require.NoError(t, err)
	assert.Equal(t, "weapon:state", msg.Type)
	data, ok := msg.Data.(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, "Pistol", data["weaponType"])
	assert.Equal(t, float64(game.PistolMagazineSize), data["currentAmmo"])
	assert.Equal(t, float64(game.PistolMagazineSize), data["maxAmmo"])

	_, err = readMessageOfType(t, conn2, "weapon:state", 200*time.Millisecond)
	assert.Error(t, err, "reload completion weapon state should only be sent to the reloading player")
}

func TestHandleGameLoopEvent_MatchEventsPublishRoomMessages(t *testing.T) {
	ts := newTestServer()
	defer ts.Close()

	conn1, conn2 := ts.connectTwoClients(t)
	defer conn1.Close()
	defer conn2.Close()

	player1ID := consumeRoomJoinedAndGetPlayerID(t, conn1)
	player2ID := consumeRoomJoinedAndGetPlayerID(t, conn2)

	room := ts.handler.roomManager.GetRoomByPlayerID(player1ID)
	require.NotNil(t, room)
	require.Equal(t, room.ID, ts.handler.roomManager.GetRoomByPlayerID(player2ID).ID)

	world := ts.handler.gameServer.GetWorld()
	winners := room.Match.GetWinnerSummaries(world)
	finalScores := room.Match.GetFinalScores(world)

	ts.handler.HandleGameLoopEvent(game.MatchTimerUpdatedEvent{
		RoomID:           room.ID,
		RemainingSeconds: 9,
	})
	timerMsg1, err := readMessageOfType(t, conn1, "match:timer", 2*time.Second)
	require.NoError(t, err)
	timerData1, ok := timerMsg1.Data.(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, float64(9), timerData1["remainingSeconds"])
	timerMsg2, err := readMessageOfType(t, conn2, "match:timer", 2*time.Second)
	require.NoError(t, err)
	timerData2, ok := timerMsg2.Data.(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, float64(9), timerData2["remainingSeconds"])

	ts.handler.HandleGameLoopEvent(game.MatchEndedEvent{
		RoomID:      room.ID,
		Reason:      "time_limit",
		Winners:     winners,
		FinalScores: finalScores,
	})
	endMsg1, err := readMessageOfType(t, conn1, "match:ended", 2*time.Second)
	require.NoError(t, err)
	endData1, ok := endMsg1.Data.(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, "time_limit", endData1["reason"])
	endMsg2, err := readMessageOfType(t, conn2, "match:ended", 2*time.Second)
	require.NoError(t, err)
	endData2, ok := endMsg2.Data.(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, "time_limit", endData2["reason"])
}

func TestHandleGameLoopEvent_StateOutcomeRoutes(t *testing.T) {
	ts := newTestServer()
	defer ts.Close()

	conn1, conn2 := ts.connectTwoClients(t)
	defer conn1.Close()
	defer conn2.Close()

	player1ID := consumeRoomJoinedAndGetPlayerID(t, conn1)
	_ = consumeRoomJoinedAndGetPlayerID(t, conn2)

	ts.handler.HandleGameLoopEvent(game.PlayerRespawnedEvent{
		PlayerID:  player1ID,
		Position:  game.Vector2{X: 120, Y: 340},
		NewHealth: game.PlayerMaxHealth,
	})
	respawnMsg, err := readMessageOfType(t, conn2, "player:respawn", 2*time.Second)
	require.NoError(t, err)
	respawnData, ok := respawnMsg.Data.(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, player1ID, respawnData["playerId"])

	ts.handler.HandleGameLoopEvent(game.RollEndedEvent{
		PlayerID: player1ID,
		Reason:   "completed",
	})
	rollEndMsg, err := readMessageOfType(t, conn1, "roll:end", 2*time.Second)
	require.NoError(t, err)
	rollEndData, ok := rollEndMsg.Data.(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, player1ID, rollEndData["playerId"])
	assert.Equal(t, "completed", rollEndData["reason"])

	ts.handler.HandleGameLoopEvent(game.WeaponCrateRespawnedEvent{
		CrateID:    "crate-1",
		WeaponType: "Shotgun",
		Position:   game.Vector2{X: 50, Y: 75},
	})
	weaponRespawnMsg, err := readMessageOfType(t, conn1, "weapon:respawned", 2*time.Second)
	require.NoError(t, err)
	weaponRespawnData, ok := weaponRespawnMsg.Data.(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, "crate-1", weaponRespawnData["crateId"])
	assert.Equal(t, "Shotgun", weaponRespawnData["weaponType"])
}
