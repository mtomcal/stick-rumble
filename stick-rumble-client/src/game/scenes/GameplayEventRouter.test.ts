import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GameplayEventRouter } from './gameplayEventRouter/GameplayEventRouter';
import type { WebSocketClient } from '../network/WebSocketClient';
import type { PlayerManager } from '../entities/PlayerManager';
import type { ProjectileManager } from '../entities/ProjectileManager';
import type { HealthBarUI } from '../ui/HealthBarUI';
import type { KillFeedUI } from '../ui/KillFeedUI';
import type { GameSceneUI } from './GameSceneUI';
import type { GameSceneSpectator } from './GameSceneSpectator';

type Handler = (payload: unknown) => void;

describe('GameplayEventRouter', () => {
  let handlers: Map<string, Handler>;
  let wsClient: WebSocketClient;
  let playerManager: PlayerManager;
  let projectileManager: ProjectileManager;
  let weaponCrateManager: any;
  let pickupPromptUI: any;
  let meleeWeaponManager: any;
  let hitEffectManager: any;
  let healthBarUI: HealthBarUI;
  let killFeedUI: KillFeedUI;
  let ui: GameSceneUI;
  let spectator: GameSceneSpectator;
  let screenShake: { shakeOnWeaponFire: ReturnType<typeof vi.fn> };
  let audioManager: {
    playWeaponSound: ReturnType<typeof vi.fn>;
    playWeaponSoundPositional: ReturnType<typeof vi.fn>;
    playDodgeRollSound: ReturnType<typeof vi.fn>;
  };
  let shootingManager: {
    enable: ReturnType<typeof vi.fn>;
    disable: ReturnType<typeof vi.fn>;
    updateWeaponState: ReturnType<typeof vi.fn>;
    setWeaponType: ReturnType<typeof vi.fn>;
    isReloading: ReturnType<typeof vi.fn>;
    isMeleeWeapon: ReturnType<typeof vi.fn>;
  };
  let inputManager: {
    enable: ReturnType<typeof vi.fn>;
    disable: ReturnType<typeof vi.fn>;
    setPlayerPosition: ReturnType<typeof vi.fn>;
    clearInputHistoryUpTo: ReturnType<typeof vi.fn>;
    getInputHistory: ReturnType<typeof vi.fn>;
  };
  let predictionEngine: {
    reconcile: ReturnType<typeof vi.fn>;
    needsInstantCorrection: ReturnType<typeof vi.fn>;
  };
  let onJoinError: ReturnType<typeof vi.fn>;
  let router: GameplayEventRouter;
  let onCameraFollowNeeded: ReturnType<typeof vi.fn>;
  let onMatchMapChanged: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    handlers = new Map<string, Handler>();
    wsClient = {
      on: vi.fn((event: string, handler: Handler) => {
        handlers.set(event, handler);
      }),
      off: vi.fn((event: string) => {
        handlers.delete(event);
      }),
      getTotalHandlerCount: vi.fn(),
    } as unknown as WebSocketClient;

    playerManager = {
      updatePlayers: vi.fn(),
      destroy: vi.fn(),
      removePlayer: vi.fn(),
      setLocalPlayerId: vi.fn(),
      getLocalPlayerId: vi.fn().mockReturnValue(undefined),
      getPlayerPosition: vi.fn().mockImplementation((id: string) => {
        if (id === 'player-1') {
          return { x: 100, y: 200 };
        }
        if (id === 'enemy-1') {
          return { x: 400, y: 200 };
        }
        return undefined;
      }),
      getLocalPlayerPosition: vi.fn().mockReturnValue({ x: 100, y: 200 }),
      getPlayerState: vi.fn(),
      updatePlayerWeapon: vi.fn(),
      triggerWeaponRecoil: vi.fn(),
      triggerReloadPulse: vi.fn(),
      applyReconciledPosition: vi.fn(),
      setLocalPlayerPredictedPosition: vi.fn(),
      getPlayerAimAngle: vi.fn().mockReturnValue(0),
      getWeaponBarrelPosition: vi.fn().mockReturnValue({ x: 135, y: 200 }),
    } as unknown as PlayerManager;

    projectileManager = {
      spawnProjectile: vi.fn(),
      removeProjectile: vi.fn(),
    } as unknown as ProjectileManager;

    weaponCrateManager = {
      spawnCrate: vi.fn(),
      markUnavailable: vi.fn(),
      markAvailable: vi.fn(),
    };
    pickupPromptUI = {
      isVisible: vi.fn().mockReturnValue(false),
      hide: vi.fn(),
    };
    meleeWeaponManager = {
      syncWeapon: vi.fn(),
      createWeapon: vi.fn(),
      removeWeapon: vi.fn(),
      updatePosition: vi.fn(),
      confirmSwing: vi.fn(),
      getWeaponType: vi.fn(),
    };
    hitEffectManager = {
      showMuzzleFlash: vi.fn(),
      showBulletImpact: vi.fn(),
      showBloodParticles: vi.fn(),
      showMeleeHit: vi.fn(),
    };
    healthBarUI = {
      updateHealth: vi.fn(),
    } as unknown as HealthBarUI;
    killFeedUI = {
      addKill: vi.fn(),
    } as unknown as KillFeedUI;
    ui = {
      updateAmmoDisplay: vi.fn(),
      updateMatchTimer: vi.fn(),
      showDamageFlash: vi.fn(),
      showDamageNumber: vi.fn(),
      showHitMarker: vi.fn(),
      showHitIndicator: vi.fn(),
      showWallSpark: vi.fn(),
      showCameraShake: vi.fn(),
      triggerCrosshairBloom: vi.fn(),
    } as unknown as GameSceneUI;
    spectator = {
      enterSpectatorMode: vi.fn(),
      exitSpectatorMode: vi.fn(),
    } as unknown as GameSceneSpectator;

    screenShake = {
      shakeOnWeaponFire: vi.fn(),
    };
    audioManager = {
      playWeaponSound: vi.fn(),
      playWeaponSoundPositional: vi.fn(),
      playDodgeRollSound: vi.fn(),
    };
    shootingManager = {
      enable: vi.fn(),
      disable: vi.fn(),
      updateWeaponState: vi.fn(),
      setWeaponType: vi.fn(),
      isReloading: vi.fn().mockReturnValue(false),
      isMeleeWeapon: vi.fn().mockReturnValue(false),
    };
    inputManager = {
      enable: vi.fn(),
      disable: vi.fn(),
      setPlayerPosition: vi.fn(),
      clearInputHistoryUpTo: vi.fn(),
      getInputHistory: vi.fn().mockReturnValue([{ sequence: 16 }]),
    };
    predictionEngine = {
      reconcile: vi.fn().mockReturnValue({
        position: { x: 122, y: 240 },
        velocity: { x: 12, y: 0 },
      }),
      needsInstantCorrection: vi.fn().mockReturnValue(false),
    };
    onCameraFollowNeeded = vi.fn<() => void>();
    onMatchMapChanged = vi.fn();
    onJoinError = vi.fn();

    router = new GameplayEventRouter(
      wsClient,
      playerManager,
      projectileManager,
      () => healthBarUI,
      killFeedUI,
      ui,
      spectator,
      onCameraFollowNeeded as unknown as () => void,
      weaponCrateManager,
      pickupPromptUI,
      meleeWeaponManager,
      hitEffectManager,
      onMatchMapChanged as unknown as (mapId: string) => void
    );
    router.setInputManager(inputManager as any);
    router.setShootingManager(shootingManager as any);
    router.setPredictionEngine(predictionEngine as any);
    router.setScreenShake(screenShake as any);
    router.setAudioManager(audioManager as any);
    router.setJoinCallbacks(
      null,
      onJoinError as unknown as (payload: import('../../shared/types').JoinErrorPayload) => void,
      null,
    );
    router.setupEventHandlers();
  });

  it('bootstraps the authoritative match session from session:status(match_ready)', () => {
    handlers.get('weapon:spawned')?.({
      crates: [{ id: 'crate-1', weaponType: 'AK47', x: 320, y: 180 }],
    });

    handlers.get('session:status')?.({
      state: 'match_ready',
      playerId: 'player-1',
      roomId: 'room-1',
      mapId: 'default_office',
      displayName: 'Alice',
      joinMode: 'public',
    });

    expect(playerManager.destroy).toHaveBeenCalledTimes(1);
    expect(playerManager.setLocalPlayerId).toHaveBeenCalledWith('player-1');
    expect(onMatchMapChanged).toHaveBeenCalledWith('default_office');
    expect(healthBarUI.updateHealth).toHaveBeenCalledWith(100, 100, false);
    expect(inputManager.enable).toHaveBeenCalledTimes(1);
    expect(shootingManager.enable).toHaveBeenCalledTimes(1);
    expect(weaponCrateManager.spawnCrate).toHaveBeenCalledWith({
      id: 'crate-1',
      weaponType: 'AK47',
      x: 320,
      y: 180,
    });
  });

  it('discards stale pre-bootstrap player snapshots when match_ready becomes authoritative', () => {
    handlers.get('player:move')?.({
      players: [
        {
          id: 'stale-player',
          displayName: 'Old',
          position: { x: 5, y: 5 },
          velocity: { x: 0, y: 0 },
        },
      ],
      isFullSnapshot: true,
    });

    expect(router.pendingPlayerMoves).toHaveLength(1);

    handlers.get('session:status')?.({
      state: 'match_ready',
      playerId: 'player-1',
      roomId: 'room-1',
      mapId: 'default_office',
      displayName: 'Alice',
      joinMode: 'public',
    });

    expect(router.pendingPlayerMoves).toHaveLength(0);
    expect(playerManager.updatePlayers).not.toHaveBeenCalled();
  });

  it('surfaces a bootstrap error when match_ready omits displayName', () => {
    handlers.get('session:status')?.({
      state: 'match_ready',
      playerId: 'player-1',
      roomId: 'room-1',
      mapId: 'default_office',
      joinMode: 'public',
    });

    expect(onJoinError).toHaveBeenCalledWith({
      type: 'error:no_hello',
      offendingType: 'session:status:missing_display_name',
    });
    expect(playerManager.setLocalPlayerId).not.toHaveBeenCalled();
  });

  it('reconciles player sync through the router seam and updates local HUD state', () => {
    vi.mocked(playerManager.getLocalPlayerId).mockReturnValue('player-1');

    handlers.get('player:move')?.({
      players: [
        {
          id: 'player-1',
          displayName: 'Alice',
          position: { x: 120, y: 240 },
          velocity: { x: 10, y: 0 },
          weaponType: 'Pistol',
          health: 72,
          kills: 3,
          xp: 250,
        },
      ],
      isFullSnapshot: true,
      lastProcessedSequence: { 'player-1': 15 },
    });

    expect(playerManager.updatePlayers).toHaveBeenCalledTimes(1);
    expect(meleeWeaponManager.syncWeapon).toHaveBeenCalledWith('player-1', 'Pistol', { x: 120, y: 240 });
    expect(inputManager.setPlayerPosition).toHaveBeenCalledWith(120, 240);
    expect(healthBarUI.updateHealth).toHaveBeenCalledWith(72, 100, false);
    expect(inputManager.clearInputHistoryUpTo).toHaveBeenCalledWith(15);
    expect(onCameraFollowNeeded).toHaveBeenCalledTimes(1);
    expect(predictionEngine.reconcile).toHaveBeenCalledWith(
      { x: 120, y: 240 },
      { x: 10, y: 0 },
      15,
      [{ sequence: 16 }],
    );
    expect(playerManager.applyReconciledPosition).toHaveBeenCalledWith(
      'player-1',
      { position: { x: 122, y: 240 }, velocity: { x: 12, y: 0 } },
      false,
    );
  });

  it('falls back to server position when reconciliation sequence info is absent', () => {
    vi.mocked(playerManager.getLocalPlayerId).mockReturnValue('player-1');

    handlers.get('player:move')?.({
      players: [
        {
          id: 'player-1',
          displayName: 'Alice',
          position: { x: 150, y: 260 },
          velocity: { x: 0, y: 5 },
          weaponType: 'Pistol',
        },
      ],
      isFullSnapshot: true,
    });

    expect(predictionEngine.reconcile).not.toHaveBeenCalled();
    expect(playerManager.setLocalPlayerPredictedPosition).toHaveBeenCalledWith({
      position: { x: 150, y: 260 },
      velocity: { x: 0, y: 5 },
    });
    expect(playerManager.applyReconciledPosition).toHaveBeenCalledWith(
      'player-1',
      { position: { x: 150, y: 260 }, velocity: { x: 0, y: 5 } },
      false,
    );
  });

  it('publishes projectile side effects for local-authority recoil, audio, and vfx', () => {
    vi.mocked(playerManager.getLocalPlayerId).mockReturnValue('player-1');

    handlers.get('projectile:spawn')?.({
      id: 'proj-1',
      ownerId: 'player-1',
      weaponType: 'AK47',
      position: { x: 100, y: 200 },
      velocity: { x: 500, y: 0 },
    });

    expect(projectileManager.spawnProjectile).toHaveBeenCalledWith({
      id: 'proj-1',
      ownerId: 'player-1',
      weaponType: 'AK47',
      position: { x: 100, y: 200 },
      velocity: { x: 500, y: 0 },
    });
    expect(hitEffectManager.showMuzzleFlash).toHaveBeenCalledTimes(1);
    expect(playerManager.triggerWeaponRecoil).toHaveBeenCalledWith('player-1');
    expect(screenShake.shakeOnWeaponFire).toHaveBeenCalledWith('AK47');
    expect(audioManager.playWeaponSound).toHaveBeenCalledWith('AK47');
  });

  it('applies authoritative weapon state to local weapon ownership and HUD', () => {
    vi.mocked(playerManager.getLocalPlayerId).mockReturnValue('player-1');

    handlers.get('weapon:state')?.({
      weaponType: 'Bat',
      currentAmmo: 0,
      maxAmmo: 0,
      isReloading: false,
      canShoot: true,
      isMelee: true,
    });

    expect(playerManager.updatePlayerWeapon).toHaveBeenCalledWith('player-1', 'Bat');
    expect(meleeWeaponManager.createWeapon).toHaveBeenCalledWith('player-1', 'Bat', { x: 100, y: 200 });
    expect(shootingManager.updateWeaponState).toHaveBeenCalledWith({
      weaponType: 'Bat',
      currentAmmo: 0,
      maxAmmo: 0,
      isReloading: false,
      canShoot: true,
      isMelee: true,
    });
    expect(shootingManager.setWeaponType).toHaveBeenCalledWith('Bat');
    expect(ui.updateAmmoDisplay).toHaveBeenCalledWith(shootingManager);
  });

  it('suppresses late gameplay events after match end', () => {
    vi.mocked(playerManager.getLocalPlayerId).mockReturnValue('player-1');
    vi.stubGlobal('window', {
      onMatchEnd: vi.fn(),
    });

    handlers.get('match:ended')?.({
      reason: 'score_limit',
      winners: ['player-1'],
      finalScores: [],
    });
    handlers.get('projectile:spawn')?.({
      id: 'proj-late',
      ownerId: 'player-1',
      weaponType: 'AK47',
      position: { x: 100, y: 200 },
      velocity: { x: 500, y: 0 },
    });
    handlers.get('weapon:state')?.({
      weaponType: 'AK47',
      currentAmmo: 25,
      maxAmmo: 30,
      isReloading: false,
      canShoot: true,
      isMelee: false,
    });

    expect(inputManager.disable).toHaveBeenCalledTimes(1);
    expect(shootingManager.disable).toHaveBeenCalledTimes(1);
    expect(projectileManager.spawnProjectile).not.toHaveBeenCalled();
    expect(shootingManager.updateWeaponState).not.toHaveBeenCalled();
  });
});
