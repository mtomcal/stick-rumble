package game

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestProcessProjectileHitAppliesDamageAndStats(t *testing.T) {
	gs := NewGameServer(func([]PlayerStateSnapshot) {})
	attacker := gs.AddPlayer("attacker")
	victim := gs.AddPlayer("victim")

	weaponState := gs.GetWeaponState(attacker.ID)
	require.NotNil(t, weaponState)
	damage := weaponState.Weapon.Damage
	victim.Health = damage

	outcome, ok := gs.ProcessProjectileHit(HitEvent{
		ProjectileID: "projectile-1",
		AttackerID:   attacker.ID,
		VictimID:     victim.ID,
	})
	require.True(t, ok)

	assert.Equal(t, "projectile-1", outcome.Hit.ProjectileID)
	assert.Equal(t, damage, outcome.Damage)
	assert.Equal(t, 0, outcome.NewHealth)
	assert.True(t, outcome.Killed)
	assert.Equal(t, 1, outcome.KillerKills)
	assert.Equal(t, KillXPReward, outcome.KillerXP)

	victimSnapshot, exists := gs.GetPlayerState(victim.ID)
	require.True(t, exists)
	assert.Equal(t, 0, victimSnapshot.Health)
	assert.NotEmpty(t, victimSnapshot.DeathTime)
	assert.Equal(t, 1, victimSnapshot.Deaths)

	attackerSnapshot, exists := gs.GetPlayerState(attacker.ID)
	require.True(t, exists)
	assert.Equal(t, 1, attackerSnapshot.Kills)
	assert.Equal(t, KillXPReward, attackerSnapshot.XP)
}
