import type {
  HitConfirmedData,
  MatchEndedData,
  MatchTimerData,
  MeleeHitData,
  PlayerDamagedData,
  PlayerDeathData,
  PlayerKillCreditData,
  PlayerLeftData,
  PlayerRespawnData,
  ProjectileDestroyData,
  ProjectileSpawnData,
  RollEndData,
  RollStartData,
  ShootFailedData,
  WeaponPickupConfirmedData,
  WeaponRespawnedData,
  WeaponStateData,
} from '../../../../../events-schema/src/index.js';
import { adaptGameplayEvent } from './typedMessageAdapters';
import type { GameplayEventRouterCoordinator } from './routerTypes';
import {
  publishDamagePresentation,
  publishHitConfirmationPresentation,
  publishMatchEndPresentation,
  publishMeleeHitPresentation,
  publishProjectilePresentation,
} from './presentationEffects';

export function registerCombatEventHandlers(router: GameplayEventRouterCoordinator): void {
  router.registerHandler('player:left', (data: unknown) => {
    if (router.shouldIgnoreLateGameplayEvent()) {
      return;
    }
    const messageData = adaptGameplayEvent<PlayerLeftData>(data);
    router.deps.playerManager.removePlayer(messageData.playerId);
    router.deps.meleeWeaponManager.removeWeapon(messageData.playerId);
  });

  router.registerHandler('projectile:spawn', (data: unknown) => {
    if (router.shouldIgnoreLateGameplayEvent()) {
      return;
    }
    if (!router.deps.playerManager.getLocalPlayerId()) {
      return;
    }
    const messageData = adaptGameplayEvent<ProjectileSpawnData>(data);
    router.deps.projectileManager.spawnProjectile(messageData);
    publishProjectilePresentation(router, messageData);
  });

  router.registerHandler('projectile:destroy', (data: unknown) => {
    if (router.shouldIgnoreLateGameplayEvent()) {
      return;
    }
    const messageData = adaptGameplayEvent<ProjectileDestroyData>(data);
    router.deps.projectileManager.removeProjectile(messageData.id);
  });

  router.registerHandler('weapon:state', (data: unknown) => {
    if (router.shouldIgnoreLateGameplayEvent()) {
      return;
    }
    const messageData = adaptGameplayEvent<WeaponStateData>(data);
    const authoritativeWeaponType =
      typeof messageData.weaponType === 'string' && messageData.weaponType.length > 0
        ? messageData.weaponType
        : router.state.currentWeaponType;
    const previousWeaponType = router.state.currentWeaponType;
    router.state.currentWeaponType = authoritativeWeaponType;

    const localPlayerId = router.deps.playerManager.getLocalPlayerId();
    const weaponTypeChanged = previousWeaponType.toLowerCase() !== authoritativeWeaponType.toLowerCase();

    if (localPlayerId && weaponTypeChanged) {
      router.deps.playerManager.updatePlayerWeapon(localPlayerId, authoritativeWeaponType);

      const playerPosition = router.deps.playerManager.getPlayerPosition(localPlayerId);
      if (playerPosition) {
        router.deps.meleeWeaponManager.createWeapon(localPlayerId, authoritativeWeaponType, playerPosition);
      }
    }

    if (!router.runtime.shootingManager) {
      return;
    }

    const wasReloading = router.runtime.shootingManager.isReloading();
    router.runtime.shootingManager.updateWeaponState(messageData);
    if (messageData.weaponType === 'Bat' || messageData.weaponType === 'Katana') {
      router.runtime.shootingManager.setWeaponType(messageData.weaponType as 'Bat' | 'Katana');
    }
    router.deps.ui.updateAmmoDisplay(router.runtime.shootingManager);

    if (messageData.isReloading && !wasReloading && !router.runtime.shootingManager.isMeleeWeapon()) {
      const localId = router.deps.playerManager.getLocalPlayerId();
      if (localId) {
        router.deps.playerManager.triggerReloadPulse(localId);
      }
    }
  });

  router.registerHandler('shoot:failed', (data: unknown) => {
    if (router.shouldIgnoreLateGameplayEvent()) {
      return;
    }
    const messageData = adaptGameplayEvent<ShootFailedData>(data);
    if (messageData.reason === 'empty') {
      console.log('Click! Magazine empty');
    }
  });

  router.registerHandler('player:damaged', (data: unknown) => {
    if (router.shouldIgnoreLateGameplayEvent()) {
      return;
    }
    const messageData = adaptGameplayEvent<PlayerDamagedData>(data);
    publishDamagePresentation(router, messageData);
  });

  router.registerHandler('hit:confirmed', (data: unknown) => {
    if (router.shouldIgnoreLateGameplayEvent()) {
      return;
    }
    const messageData = adaptGameplayEvent<HitConfirmedData>(data);
    publishHitConfirmationPresentation(router, messageData);
  });

  router.registerHandler('player:death', (data: unknown) => {
    if (router.shouldIgnoreLateGameplayEvent()) {
      return;
    }
    const messageData = adaptGameplayEvent<PlayerDeathData>(data);
    if (messageData.victimId === router.deps.playerManager.getLocalPlayerId()) {
      router.deps.playerManager.setPlayerVisible(messageData.victimId, false);
      router.deps.spectator.enterSpectatorMode();
    }
  });

  router.registerHandler('player:kill_credit', (data: unknown) => {
    if (router.shouldIgnoreLateGameplayEvent()) {
      return;
    }
    const messageData = adaptGameplayEvent<PlayerKillCreditData>(data);
    console.log(
      `Kill credit: ${messageData.killerId} killed ${messageData.victimId} (Kills: ${messageData.killerKills}, XP: ${messageData.killerXP})`
    );
    router.deps.killFeedUI.addKill(
      router.resolvePlayerDisplayName(messageData.killerId),
      router.resolvePlayerDisplayName(messageData.victimId)
    );

    if (messageData.killerId === router.deps.playerManager.getLocalPlayerId()) {
      router.deps.ui.showHitMarker(true);

      const killLocalPos = router.deps.playerManager.getLocalPlayerPosition();
      const killVictimPos = router.deps.playerManager.getPlayerPosition(messageData.victimId);
      if (killLocalPos && killVictimPos) {
        router.deps.ui.showHitIndicator(killLocalPos.x, killLocalPos.y, killVictimPos.x, killVictimPos.y, 'outgoing', true);
      }

      router.syncLocalHudStats(messageData.killerKills, messageData.killerXP);
    }
  });

  router.registerHandler('player:respawn', (data: unknown) => {
    if (router.shouldIgnoreLateGameplayEvent()) {
      return;
    }
    const messageData = adaptGameplayEvent<PlayerRespawnData>(data);
    if (messageData.playerId === router.deps.playerManager.getLocalPlayerId()) {
      router.state.localPlayerHealth = messageData.health;
      router.deps.getHealthBarUI().updateHealth(router.state.localPlayerHealth, 100, false);
      router.resetLocalWeaponAuthorityToPistol();
      router.deps.playerManager.teleportPlayer(messageData.playerId, messageData.position);
      router.deps.playerManager.setPlayerVisible(messageData.playerId, true);
      router.deps.spectator.exitSpectatorMode();
    }
  });

  router.registerHandler('match:timer', (data: unknown) => {
    if (router.state.matchEnded) {
      return;
    }
    const messageData = adaptGameplayEvent<MatchTimerData>(data);
    router.deps.ui.updateMatchTimer(messageData.remainingSeconds);
  });

  router.registerHandler('match:ended', (data: unknown) => {
    const messageData = adaptGameplayEvent<MatchEndedData>(data);
    router.state.matchEnded = true;
    router.runtime.inputManager?.disable();
    router.runtime.shootingManager?.disable();
    publishMatchEndPresentation(router, messageData);
  });

  router.registerHandler('weapon:pickup_confirmed', (data: unknown) => {
    if (router.shouldIgnoreLateGameplayEvent()) {
      return;
    }
    const messageData = adaptGameplayEvent<WeaponPickupConfirmedData>(data);
    router.deps.weaponCrateManager.markUnavailable(messageData.crateId);
    if (router.deps.pickupPromptUI.isVisible()) {
      router.deps.pickupPromptUI.hide();
    }
    if (messageData.playerId === router.deps.playerManager.getLocalPlayerId()) {
      router.runtime.pickupNotificationUI?.show(messageData.weaponType);
    }
  });

  router.registerHandler('weapon:respawned', (data: unknown) => {
    if (router.shouldIgnoreLateGameplayEvent()) {
      return;
    }
    const messageData = adaptGameplayEvent<WeaponRespawnedData>(data);
    router.deps.weaponCrateManager.markAvailable(messageData.crateId);
  });

  router.registerHandler('melee:hit', (data: unknown) => {
    if (router.shouldIgnoreLateGameplayEvent()) {
      return;
    }
    const messageData = adaptGameplayEvent<MeleeHitData>(data);
    const attackerPos = router.deps.playerManager.getPlayerPosition(messageData.attackerId);
    if (!attackerPos) {
      return;
    }

    const aimAngle = router.deps.playerManager.getPlayerAimAngle(messageData.attackerId);
    if (aimAngle === null) {
      return;
    }

    const weaponType =
      router.deps.meleeWeaponManager.getWeaponType(messageData.attackerId)
      ?? router.deps.playerManager.getPlayerState(messageData.attackerId)?.weaponType
      ?? 'Bat';

    router.deps.meleeWeaponManager.createWeapon(messageData.attackerId, weaponType, attackerPos);
    router.deps.meleeWeaponManager.updatePosition(messageData.attackerId, attackerPos);
    router.deps.meleeWeaponManager.confirmSwing(messageData.attackerId, aimAngle);
    publishMeleeHitPresentation(router, messageData, weaponType);
  });

  router.registerHandler('roll:start', (data: unknown) => {
    if (router.shouldIgnoreLateGameplayEvent()) {
      return;
    }
    const messageData = adaptGameplayEvent<RollStartData>(data);
    console.log(`Player ${messageData.playerId} started dodge roll`);
    if (router.runtime.dodgeRollManager && messageData.playerId === router.deps.playerManager.getLocalPlayerId()) {
      router.runtime.dodgeRollManager.startRoll();
    }
    router.runtime.audioManager?.playDodgeRollSound();
  });

  router.registerHandler('roll:end', (data: unknown) => {
    if (router.shouldIgnoreLateGameplayEvent()) {
      return;
    }
    const messageData = adaptGameplayEvent<RollEndData>(data);
    console.log(`Player ${messageData.playerId} ended dodge roll (reason: ${messageData.reason})`);
    if (router.runtime.dodgeRollManager && messageData.playerId === router.deps.playerManager.getLocalPlayerId()) {
      router.runtime.dodgeRollManager.endRoll();
    }
  });
}
