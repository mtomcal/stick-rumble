import type { SessionStatusData, WeaponSpawnedData } from '../../../../../events-schema/src/index.js';
import { adaptGameplayEvent } from './typedMessageAdapters';
import type { GameplayEventRouterCoordinator } from './routerTypes';

export function registerMatchBootstrapHandlers(router: GameplayEventRouterCoordinator): void {
  router.registerHandler('session:status', (data: unknown) => {
    const messageData = adaptGameplayEvent<SessionStatusData>(data);

    router.deps.onRosterSizeChanged?.(messageData.rosterSize ?? 0);

    if (messageData.state !== 'match_ready') {
      return;
    }

    router.state.matchEnded = false;
    router.state.currentWeaponType = 'pistol';
    router.runtime.inputManager?.enable?.();
    router.runtime.shootingManager?.enable?.();

    router.deps.playerManager.destroy();

    if (messageData.mapId) {
      router.deps.onMatchMapChanged(messageData.mapId);
    }

    if (!messageData.playerId) {
      return;
    }

    if (!messageData.displayName) {
      router.deps.onJoinError?.({
        type: 'error:no_hello',
        offendingType: 'session:status:missing_display_name',
      });
      return;
    }

    router.deps.playerManager.setLocalPlayerId(messageData.playerId);
    router.state.localPlayerHealth = 100;
    router.deps.getHealthBarUI().updateHealth(router.state.localPlayerHealth, 100, false);
    router.state.pendingPlayerMoves = [];

    router.runtime.chatLogUI?.addSystemMessage('You joined the match');

    if (messageData.roomId && messageData.mapId) {
      router.deps.onRoomJoined?.({
        roomId: messageData.roomId,
        playerId: messageData.playerId,
        mapId: messageData.mapId,
        displayName: messageData.displayName,
        joinMode: messageData.joinMode,
        code: messageData.code,
      });
    }

    for (const pendingData of router.state.pendingWeaponSpawns) {
      const weaponData = adaptGameplayEvent<WeaponSpawnedData>(pendingData);
      if (!weaponData.crates) {
        continue;
      }
      for (const crateData of weaponData.crates) {
        router.deps.weaponCrateManager.spawnCrate(crateData);
      }
    }
    router.state.pendingWeaponSpawns = [];
  });

  if (router.deps.onJoinError) {
    router.registerHandler('error:bad_room_code', (data: unknown) => {
      const messageData = adaptGameplayEvent<{ reason?: 'missing_code' | 'invalid_format' | 'not_found' | 'too_short' | 'too_long' }>(data);
      router.deps.onJoinError?.({
        type: 'error:bad_room_code',
        reason: messageData.reason,
      });
    });

    router.registerHandler('error:room_full', (data: unknown) => {
      const messageData = adaptGameplayEvent<{ code?: string }>(data);
      router.deps.onJoinError?.({
        type: 'error:room_full',
        code: messageData.code,
      });
    });

    router.registerHandler('error:no_hello', (data: unknown) => {
      const messageData = adaptGameplayEvent<{ offendingType?: string }>(data);
      router.deps.onJoinError?.({
        type: 'error:no_hello',
        offendingType: messageData.offendingType,
      });
    });
  }

  router.registerHandler('weapon:spawned', (data: unknown) => {
    if (router.shouldIgnoreLateGameplayEvent()) {
      return;
    }

    if (!router.deps.playerManager.getLocalPlayerId()) {
      if (router.state.pendingWeaponSpawns.length >= 10) {
        router.state.pendingWeaponSpawns.shift();
      }
      router.state.pendingWeaponSpawns.push(data);
      return;
    }

    const messageData = adaptGameplayEvent<WeaponSpawnedData>(data);
    if (!messageData.crates) {
      return;
    }
    for (const crateData of messageData.crates) {
      router.deps.weaponCrateManager.spawnCrate(crateData);
    }
  });
}
