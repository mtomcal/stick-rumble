package game

type ProjectileHitOutcome struct {
	Hit         HitEvent
	Damage      int
	NewHealth   int
	Killed      bool
	KillerKills int
	KillerXP    int
}

func (gs *GameServer) ProcessProjectileHit(hit HitEvent) (ProjectileHitOutcome, bool) {
	outcome := ProjectileHitOutcome{
		Hit: hit,
	}

	gs.weaponMu.RLock()
	weaponState := gs.weaponStates[hit.AttackerID]
	gs.weaponMu.RUnlock()
	if weaponState == nil {
		return outcome, false
	}

	victim, exists := gs.world.GetPlayer(hit.VictimID)
	if !exists {
		return outcome, false
	}

	outcome.Damage = weaponState.Weapon.Damage
	victim.TakeDamage(outcome.Damage)
	gs.projectileManager.RemoveProjectile(hit.ProjectileID)

	victimSnapshot := victim.Snapshot()
	outcome.NewHealth = victimSnapshot.Health
	if victimSnapshot.Health > 0 {
		return outcome, true
	}

	victim.MarkDead()
	victim.IncrementDeaths()

	attacker, attackerExists := gs.world.GetPlayer(hit.AttackerID)
	if attackerExists && attacker != nil {
		attacker.IncrementKills()
		attacker.AddXP(KillXPReward)
		attackerSnapshot := attacker.Snapshot()
		outcome.KillerKills = attackerSnapshot.Kills
		outcome.KillerXP = attackerSnapshot.XP
	}

	outcome.Killed = true
	return outcome, true
}
