import type { PlayerMoveData } from '../../../../../events-schema/src/index.js';
import { adaptGameplayEvent } from './typedMessageAdapters';
import type { GameplayEventRouterCoordinator } from './routerTypes';

export function registerPlayerStateSyncHandlers(router: GameplayEventRouterCoordinator): void {
  router.registerHandler('player:move', (data: unknown) => {
    if (router.state.matchEnded) {
      return;
    }

    if (!router.deps.playerManager.getLocalPlayerId()) {
      if (router.state.pendingPlayerMoves.length >= 10) {
        router.state.pendingPlayerMoves.shift();
      }
      router.state.pendingPlayerMoves.push(data);
      return;
    }

    const messageData = adaptGameplayEvent<PlayerMoveData & { isFullSnapshot?: boolean }>(data);
    if (!messageData.players) {
      return;
    }

    const isDelta = messageData.isFullSnapshot === false;
    const renderPlayerStates = messageData.players.map((player) => router.toRenderPlayerState(player));
    router.deps.playerManager.updatePlayers(renderPlayerStates, { isDelta });
    if (!isDelta) {
      router.deps.onRosterSizeChanged?.(messageData.players.length);
    }

    for (const player of messageData.players) {
      router.deps.meleeWeaponManager.syncWeapon(player.id, player.weaponType, player.position);
    }

    if (router.runtime.inputManager && router.deps.playerManager.getLocalPlayerId()) {
      const localPlayer = messageData.players.find((player) => player.id === router.deps.playerManager.getLocalPlayerId());
      if (localPlayer) {
        router.runtime.inputManager.setPlayerPosition(localPlayer.position.x, localPlayer.position.y);

        if (localPlayer.health !== undefined) {
          router.state.localPlayerHealth = localPlayer.health;
          const isRegen =
            'isRegenerating' in localPlayer
              ? (localPlayer as { isRegenerating?: boolean }).isRegenerating ?? false
              : false;
          router.deps.getHealthBarUI().updateHealth(router.state.localPlayerHealth, 100, isRegen);
        }

        router.syncLocalHudStats(localPlayer.kills ?? 0, localPlayer.xp ?? 0);
      }
    }

    const localPlayerId = router.deps.playerManager.getLocalPlayerId();
    if (localPlayerId && router.runtime.predictionEngine && router.runtime.inputManager) {
      router.handleServerCorrection(messageData, localPlayerId);
    }

    if (localPlayerId && messageData.lastProcessedSequence && router.runtime.inputManager) {
      const lastProcessed = messageData.lastProcessedSequence[localPlayerId];
      if (lastProcessed !== undefined) {
        router.runtime.inputManager.clearInputHistoryUpTo(lastProcessed);
      }
    }

    router.deps.onCameraFollowNeeded();
  });
}
