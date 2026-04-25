import type { MatchEndedData, PlayerDamagedData, HitConfirmedData, MeleeHitData, ProjectileSpawnData } from '../../../../../events-schema/src/index.js';
import type { GameplayEventRouterCoordinator } from './routerTypes';

export function publishProjectilePresentation(
  router: GameplayEventRouterCoordinator,
  messageData: ProjectileSpawnData
): void {
  const { playerManager, hitEffectManager } = router.deps;
  const { screenShake, audioManager } = router.runtime;

  if (hitEffectManager) {
    const rotation = Math.atan2(messageData.velocity.y, messageData.velocity.x);
    hitEffectManager.showMuzzleFlash(messageData.position.x, messageData.position.y, rotation);
  }

  const localPlayerId = playerManager.getLocalPlayerId();
  const isLocalPlayer = messageData.ownerId === localPlayerId;
  const firedWeaponType =
    typeof messageData.weaponType === 'string' && messageData.weaponType.length > 0
      ? messageData.weaponType
      : router.state.currentWeaponType;

  playerManager.triggerWeaponRecoil(messageData.ownerId);

  if (screenShake && isLocalPlayer) {
    screenShake.shakeOnWeaponFire(firedWeaponType);
  }

  if (!audioManager) {
    return;
  }

  if (isLocalPlayer) {
    audioManager.playWeaponSound(firedWeaponType);
    return;
  }

  const localPlayerPosition = playerManager.getLocalPlayerPosition();
  if (!localPlayerPosition) {
    return;
  }

  audioManager.playWeaponSoundPositional(
    firedWeaponType,
    messageData.position.x,
    messageData.position.y,
    localPlayerPosition.x,
    localPlayerPosition.y
  );
}

export function publishDamagePresentation(
  router: GameplayEventRouterCoordinator,
  messageData: PlayerDamagedData
): void {
  const { playerManager, hitEffectManager, ui } = router.deps;

  if (messageData.victimId === playerManager.getLocalPlayerId()) {
    router.state.localPlayerHealth = messageData.newHealth;
    router.deps.getHealthBarUI().updateHealth(router.state.localPlayerHealth, 100, false);
    ui.showDamageFlash();

    const localPlayerPos = playerManager.getLocalPlayerPosition();
    const attackerPosition = playerManager.getPlayerPosition(messageData.attackerId);
    if (localPlayerPos && attackerPosition) {
      ui.showHitIndicator(localPlayerPos.x, localPlayerPos.y, attackerPosition.x, attackerPosition.y, 'incoming');
    }
  }

  const isKill = messageData.newHealth <= 0;
  const isLocal = messageData.attackerId === playerManager.getLocalPlayerId();
  ui.showDamageNumber(playerManager, messageData.victimId, messageData.damage, isKill, isLocal);

  const victimPos = playerManager.getPlayerPosition(messageData.victimId);
  if (!victimPos || !hitEffectManager) {
    return;
  }

  const damageType = 'damageType' in messageData ? (messageData as { damageType?: string }).damageType : undefined;
  if (damageType !== 'melee') {
    hitEffectManager.showBulletImpact(victimPos.x, victimPos.y);
  }

  const attackerPos = playerManager.getPlayerPosition(messageData.attackerId);
  if (attackerPos) {
    hitEffectManager.showBloodParticles(victimPos.x, victimPos.y, attackerPos.x, attackerPos.y);
  }
}

export function publishHitConfirmationPresentation(
  router: GameplayEventRouterCoordinator,
  messageData: HitConfirmedData
): void {
  const { playerManager, ui } = router.deps;
  const { aimLine } = router.runtime;

  ui.showHitMarker(false);
  ui.showCameraShake();

  const localPos = playerManager.getLocalPlayerPosition();
  const victimPos = playerManager.getPlayerPosition(messageData.victimId);
  if (localPos && victimPos) {
    ui.showHitIndicator(localPos.x, localPos.y, victimPos.x, victimPos.y, 'outgoing', false);
  }

  if (!aimLine || !localPos) {
    return;
  }

  const localPlayerId = playerManager.getLocalPlayerId();
  const aimAngle = localPlayerId ? (playerManager.getPlayerAimAngle(localPlayerId) ?? 0) : 0;
  const weaponOriginX = localPos.x + Math.cos(aimAngle) * 10;
  const weaponOriginY = localPos.y + Math.sin(aimAngle) * 10;
  const barrel = localPlayerId
    ? (playerManager.getWeaponBarrelPosition(localPlayerId)
      ?? aimLine.getBarrelPosition(weaponOriginX, weaponOriginY, aimAngle, router.state.currentWeaponType))
    : aimLine.getBarrelPosition(weaponOriginX, weaponOriginY, aimAngle, router.state.currentWeaponType);
  const trailTargetX = victimPos ? victimPos.x : localPos.x + Math.cos(aimAngle) * 200;
  const trailTargetY = victimPos ? victimPos.y : localPos.y + Math.sin(aimAngle) * 200;
  aimLine.showTrail(barrel.x, barrel.y, trailTargetX, trailTargetY);
}

export function publishMeleeHitPresentation(
  router: GameplayEventRouterCoordinator,
  messageData: MeleeHitData,
  weaponType: string
): void {
  const { playerManager, hitEffectManager } = router.deps;
  if (!hitEffectManager || messageData.victims.length === 0) {
    return;
  }

  for (const victimId of messageData.victims) {
    const victimPos = playerManager.getPlayerPosition(victimId);
    if (!victimPos) {
      continue;
    }
    hitEffectManager.showMeleeHit(victimPos.x, victimPos.y, weaponType);
  }
}

export function publishMatchEndPresentation(
  router: GameplayEventRouterCoordinator,
  messageData: MatchEndedData
): void {
  const localPlayerId = router.deps.playerManager.getLocalPlayerId();
  if (!localPlayerId || !window.onMatchEnd) {
    return;
  }

  const finalScoresWithDisplayNames = messageData.finalScores.map((score) => {
    const displayName = score.displayName?.trim();
    return {
      ...score,
      displayName:
        displayName && displayName.length > 0
          ? displayName
          : router.resolvePlayerDisplayName(score.playerId),
    };
  });

  window.onMatchEnd(
    {
      ...messageData,
      finalScores: finalScoresWithDisplayNames,
    } as unknown as import('../../../shared/types.js').MatchEndData,
    localPlayerId
  );
}
