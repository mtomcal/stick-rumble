package game

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func noBroadcast(playerStates []PlayerStateSnapshot) {}

func TestGetWeaponCrateManager(t *testing.T) {
	gs := NewGameServer(noBroadcast)

	crateManager := gs.GetWeaponCrateManager()
	assert.NotNil(t, crateManager)
	assert.NotEmpty(t, crateManager.GetAllCrates())
}

func TestPlayerMeleeAttack_Success(t *testing.T) {
	gs := NewGameServer(noBroadcast)
	setGameServerOpenMap(gs)

	gs.AddPlayer("player1")
	gs.AddPlayer("player2")
	gs.SetWeaponState("player1", NewWeaponState(NewBat()))

	player1, _ := gs.world.GetPlayer("player1")
	player2, _ := gs.world.GetPlayer("player2")
	player1.Position = Vector2{X: 100, Y: 100}
	player2.Position = Vector2{X: 150, Y: 100}

	result := gs.PlayerMeleeAttack("player1", 0.0)

	assert.True(t, result.Success)
	assert.NotEmpty(t, result.HitPlayers)
	assert.Equal(t, "player2", result.HitPlayers[0].ID)
}

func TestPlayerMeleeAttack_PlayerNotFound(t *testing.T) {
	gs := NewGameServer(noBroadcast)
	result := gs.PlayerMeleeAttack("non-existent", 0.0)
	assert.False(t, result.Success)
	assert.Equal(t, MeleeFailedNoPlayer, result.Reason)
}

func TestPlayerMeleeAttack_PlayerDead(t *testing.T) {
	gs := NewGameServer(noBroadcast)
	gs.AddPlayer("player1")
	gs.MarkPlayerDead("player1")

	result := gs.PlayerMeleeAttack("player1", 0.0)
	assert.False(t, result.Success)
	assert.Equal(t, MeleeFailedPlayerDead, result.Reason)
}

func TestPlayerMeleeAttack_NoWeapon(t *testing.T) {
	gs := NewGameServer(noBroadcast)
	gs.AddPlayer("player1")

	gs.weaponMu.Lock()
	delete(gs.weaponStates, "player1")
	gs.weaponMu.Unlock()

	result := gs.PlayerMeleeAttack("player1", 0.0)
	assert.False(t, result.Success)
	assert.Equal(t, MeleeFailedNoWeapon, result.Reason)
}

func TestPlayerMeleeAttack_NotMeleeWeapon(t *testing.T) {
	gs := NewGameServer(noBroadcast)
	gs.AddPlayer("player1")
	gs.SetWeaponState("player1", NewWeaponState(NewPistol()))

	result := gs.PlayerMeleeAttack("player1", 0.0)
	assert.False(t, result.Success)
	assert.Equal(t, MeleeFailedNotMelee, result.Reason)
}

func TestPlayerMeleeAttack_NoVictims(t *testing.T) {
	gs := NewGameServer(noBroadcast)
	setGameServerOpenMap(gs)
	gs.AddPlayer("player1")
	gs.SetWeaponState("player1", NewWeaponState(NewBat()))

	result := gs.PlayerMeleeAttack("player1", 0.0)
	assert.True(t, result.Success)
	assert.Empty(t, result.HitPlayers)
}

func TestPlayerMeleeAttack_WallBlockedStillConsumesCooldown(t *testing.T) {
	gs := NewGameServer(noBroadcast)
	mapConfig := openTestMapConfig()
	mapConfig.Obstacles = []MapObstacle{
		{ID: "wall", X: 130, Y: 80, Width: 20, Height: 40, BlocksMovement: true, BlocksProjectiles: true, BlocksLineOfSight: true},
	}
	gs.world.mapConfig = mapConfig
	gs.physics = NewPhysics(mapConfig)
	gs.projectileManager = NewProjectileManager(mapConfig)

	gs.AddPlayer("player1")
	gs.AddPlayer("player2")
	gs.SetWeaponState("player1", NewWeaponState(NewBat()))

	player1, _ := gs.world.GetPlayer("player1")
	player2, _ := gs.world.GetPlayer("player2")
	player1.Position = Vector2{X: 100, Y: 100}
	player2.Position = Vector2{X: 170, Y: 100}

	result := gs.PlayerMeleeAttack("player1", 0.0)
	assert.True(t, result.Success)
	assert.Empty(t, result.HitPlayers)

	cooldownResult := gs.PlayerMeleeAttack("player1", 0.0)
	assert.False(t, cooldownResult.Success)
	assert.Equal(t, MeleeFailedCooldown, cooldownResult.Reason)
}

func TestPlayerMeleeAttack_UsesWorldMapConfigForWallBlocking(t *testing.T) {
	gs := NewGameServer(noBroadcast)
	mapConfig := openTestMapConfig()
	mapConfig.Obstacles = []MapObstacle{
		{ID: "wall", X: 130, Y: 80, Width: 20, Height: 40, BlocksMovement: true, BlocksProjectiles: true, BlocksLineOfSight: true},
	}
	gs.world.mapConfig = mapConfig
	gs.physics = NewPhysics(mapConfig)
	gs.projectileManager = NewProjectileManager(mapConfig)

	gs.AddPlayer("player1")
	gs.AddPlayer("player2")
	gs.SetWeaponState("player1", NewWeaponState(NewBat()))

	player1, _ := gs.world.GetPlayer("player1")
	player2, _ := gs.world.GetPlayer("player2")
	player1.Position = Vector2{X: 100, Y: 100}
	player2.Position = Vector2{X: 170, Y: 100}

	result := gs.PlayerMeleeAttack("player1", 0.0)
	assert.True(t, result.Success)
	assert.Empty(t, result.HitPlayers)
}

func TestGetWorld(t *testing.T) {
	gs := NewGameServer(noBroadcast)
	assert.Equal(t, gs.world, gs.GetWorld())
}
