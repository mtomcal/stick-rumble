import { getWeaponConfigSync } from '../../../shared/weaponConfig';
import type {
  PlayerMoveData,
  PlayerState,
} from '../../../../../events-schema/src/index.js';
import type { JoinErrorPayload, MatchSession } from '../../../shared/types';
import type {
  AimLine,
} from '../../entities/AimLine';
import type { AudioManager } from '../../audio/AudioManager';
import type { HitEffectManager } from '../../entities/HitEffectManager';
import type { MeleeWeaponManager } from '../../entities/MeleeWeaponManager';
import type { PlayerManager, PlayerState as RenderPlayerState } from '../../entities/PlayerManager';
import type { ProjectileManager } from '../../entities/ProjectileManager';
import type { WeaponCrateManager } from '../../entities/WeaponCrateManager';
import type { DodgeRollManager } from '../../input/DodgeRollManager';
import type { InputManager } from '../../input/InputManager';
import type { ShootingManager } from '../../input/ShootingManager';
import type { PredictionEngine } from '../../physics/PredictionEngine';
import type { ScreenShake } from '../../effects/ScreenShake';
import type { ChatLogUI } from '../../ui/ChatLogUI';
import type { HealthBarUI } from '../../ui/HealthBarUI';
import type { KillCounterUI } from '../../ui/KillCounterUI';
import type { KillFeedUI } from '../../ui/KillFeedUI';
import type { PickupNotificationUI } from '../../ui/PickupNotificationUI';
import type { PickupPromptUI } from '../../ui/PickupPromptUI';
import type { ScoreDisplayUI } from '../../ui/ScoreDisplayUI';
import type { WebSocketClient } from '../../network/WebSocketClient';
import type { GameSceneSpectator } from '../GameSceneSpectator';
import type { GameSceneUI } from '../GameSceneUI';
import { registerCombatEventHandlers } from './registerCombatEventHandlers';
import { registerMatchBootstrapHandlers } from './registerMatchBootstrapHandlers';
import { registerPlayerStateSyncHandlers } from './registerPlayerStateSyncHandlers';
import type {
  GameplayEventRouterCoordinator,
  GameplayEventRouterDeps,
  GameplayEventRouterRuntime,
  GameplayEventRouterState,
} from './routerTypes';

export class GameplayEventRouter implements GameplayEventRouterCoordinator {
  readonly deps: GameplayEventRouterDeps;

  readonly runtime: GameplayEventRouterRuntime = {
    inputManager: null,
    shootingManager: null,
    dodgeRollManager: null,
    predictionEngine: null,
    screenShake: null,
    audioManager: null,
    scoreDisplayUI: null,
    killCounterUI: null,
    chatLogUI: null,
    pickupNotificationUI: null,
    aimLine: null,
  };

  readonly state: GameplayEventRouterState = {
    localPlayerHealth: 100,
    currentWeaponType: 'pistol',
    matchEnded: false,
    pendingPlayerMoves: [],
    pendingWeaponSpawns: [],
  };

  readonly handlerRefs: Map<string, (data: unknown) => void> = new Map();

  constructor(
    wsClient: WebSocketClient,
    playerManager: PlayerManager,
    projectileManager: ProjectileManager,
    getHealthBarUI: () => HealthBarUI,
    killFeedUI: KillFeedUI,
    ui: GameSceneUI,
    spectator: GameSceneSpectator,
    onCameraFollowNeeded: () => void,
    weaponCrateManager: WeaponCrateManager,
    pickupPromptUI: PickupPromptUI,
    meleeWeaponManager: MeleeWeaponManager,
    hitEffectManager: HitEffectManager,
    onMatchMapChanged: (mapId: string) => void = () => {}
  ) {
    this.deps = {
      wsClient,
      playerManager,
      projectileManager,
      weaponCrateManager,
      meleeWeaponManager,
      hitEffectManager,
      pickupPromptUI,
      getHealthBarUI,
      killFeedUI,
      ui,
      spectator,
      onCameraFollowNeeded,
      onMatchMapChanged,
      onRoomJoined: null,
      onJoinError: null,
      onRosterSizeChanged: null,
    };
  }

  get currentWeaponType(): string {
    return this.state.currentWeaponType;
  }

  set currentWeaponType(value: string) {
    this.state.currentWeaponType = value;
  }

  get pendingPlayerMoves(): unknown[] {
    return this.state.pendingPlayerMoves;
  }

  set pendingPlayerMoves(value: unknown[]) {
    this.state.pendingPlayerMoves = value;
  }

  get pendingWeaponSpawns(): unknown[] {
    return this.state.pendingWeaponSpawns;
  }

  set pendingWeaponSpawns(value: unknown[]) {
    this.state.pendingWeaponSpawns = value;
  }

  setInputManager(inputManager: InputManager): void {
    this.runtime.inputManager = inputManager;
  }

  setShootingManager(shootingManager: ShootingManager): void {
    this.runtime.shootingManager = shootingManager;
  }

  setScreenShake(screenShake: ScreenShake): void {
    this.runtime.screenShake = screenShake;
  }

  setAudioManager(audioManager: AudioManager): void {
    this.runtime.audioManager = audioManager;
  }

  setDodgeRollManager(dodgeRollManager: DodgeRollManager): void {
    this.runtime.dodgeRollManager = dodgeRollManager;
  }

  setPredictionEngine(predictionEngine: PredictionEngine): void {
    this.runtime.predictionEngine = predictionEngine;
  }

  setScoreDisplayUI(scoreDisplayUI: ScoreDisplayUI): void {
    this.runtime.scoreDisplayUI = scoreDisplayUI;
  }

  setKillCounterUI(killCounterUI: KillCounterUI): void {
    this.runtime.killCounterUI = killCounterUI;
  }

  setChatLogUI(chatLogUI: ChatLogUI): void {
    this.runtime.chatLogUI = chatLogUI;
  }

  setPickupNotificationUI(pickupNotificationUI: PickupNotificationUI): void {
    this.runtime.pickupNotificationUI = pickupNotificationUI;
  }

  setAimLine(aimLine: AimLine): void {
    this.runtime.aimLine = aimLine;
  }

  setJoinCallbacks(
    onRoomJoined: ((payload: MatchSession) => void) | null,
    onJoinError: ((payload: JoinErrorPayload) => void) | null,
    onRosterSizeChanged: ((count: number) => void) | null
  ): void {
    this.deps.onRoomJoined = onRoomJoined;
    this.deps.onJoinError = onJoinError;
    this.deps.onRosterSizeChanged = onRosterSizeChanged;
  }

  getCurrentWeaponType(): string {
    return this.state.currentWeaponType;
  }

  resolvePlayerDisplayName(playerId: string): string {
    const playerState = this.deps.playerManager.getPlayerState(playerId);
    const displayName = playerState?.displayName?.trim();
    return displayName && displayName.length > 0 ? displayName : 'Guest';
  }

  shouldIgnoreLateGameplayEvent(): boolean {
    return this.state.matchEnded;
  }

  resetLocalWeaponAuthorityToPistol(): void {
    this.state.currentWeaponType = 'Pistol';

    const localPlayerId = this.deps.playerManager.getLocalPlayerId();
    if (!localPlayerId) {
      return;
    }

    this.deps.playerManager.updatePlayerWeapon(localPlayerId, 'Pistol');

    const playerPosition = this.deps.playerManager.getPlayerPosition(localPlayerId);
    if (playerPosition) {
      this.deps.meleeWeaponManager.syncWeapon(localPlayerId, 'Pistol', playerPosition);
    } else {
      this.deps.meleeWeaponManager.removeWeapon(localPlayerId);
    }

    if (!this.runtime.shootingManager) {
      return;
    }

    const pistolConfig = getWeaponConfigSync('Pistol');
    const pistolMagazine = pistolConfig?.magazineSize ?? 15;

    this.runtime.shootingManager.updateWeaponState({
      currentAmmo: pistolMagazine,
      maxAmmo: pistolMagazine,
      isReloading: false,
      canShoot: true,
      weaponType: 'Pistol',
      isMelee: false,
    });
    this.runtime.shootingManager.setWeaponType('Pistol');
    this.deps.ui.updateAmmoDisplay(this.runtime.shootingManager);
  }

  syncLocalHudStats(kills: number, xp: number): void {
    if (this.state.matchEnded) {
      return;
    }

    this.runtime.scoreDisplayUI?.setScore(xp);
    this.runtime.killCounterUI?.setKills(kills);
  }

  private cleanupHandlers(): void {
    for (const [eventType, handler] of this.handlerRefs) {
      this.deps.wsClient.off(eventType, handler);
    }
    this.handlerRefs.clear();
    this.state.matchEnded = false;
    this.state.pendingPlayerMoves = [];
    this.state.pendingWeaponSpawns = [];
  }

  destroy(): void {
    this.cleanupHandlers();
  }

  registerHandler(eventType: string, handler: (data: unknown) => void): void {
    this.handlerRefs.set(eventType, handler);
    this.deps.wsClient.on(eventType, handler);
  }

  setupEventHandlers(): void {
    this.cleanupHandlers();
    registerMatchBootstrapHandlers(this);
    registerPlayerStateSyncHandlers(this);
    registerCombatEventHandlers(this);
  }

  toRenderPlayerState(player: PlayerState): RenderPlayerState {
    const renderPlayerState: RenderPlayerState = {
      id: player.id,
      displayName: player.displayName,
      position: player.position,
      velocity: player.velocity,
    };

    if (player.aimAngle !== undefined) {
      renderPlayerState.aimAngle = player.aimAngle;
    }
    if (player.weaponType !== undefined) {
      renderPlayerState.weaponType = player.weaponType;
    }
    if (player.deathTime !== undefined) {
      renderPlayerState.deathTime = Date.parse(player.deathTime);
    }
    if (player.health !== undefined) {
      renderPlayerState.health = player.health;
    }
    if (player.isRegenerating !== undefined) {
      renderPlayerState.isRegenerating = player.isRegenerating;
    }
    if (player.isRolling !== undefined) {
      renderPlayerState.isRolling = player.isRolling;
    }
    if (player.isInvulnerable !== undefined) {
      renderPlayerState.isInvulnerable = player.isInvulnerable;
    }
    if (player.invulnerabilityEnd !== undefined) {
      renderPlayerState.invulnerabilityEndTime = Date.parse(player.invulnerabilityEnd);
    }

    return renderPlayerState;
  }

  handleServerCorrection(messageData: PlayerMoveData, localPlayerId: string): void {
    if (!this.runtime.inputManager || !this.runtime.predictionEngine) {
      return;
    }

    const localPlayer = messageData.players.find((player) => player.id === localPlayerId);
    if (!localPlayer) {
      return;
    }

    const lastProcessedSequence = messageData.lastProcessedSequence?.[localPlayerId];
    if (lastProcessedSequence === undefined) {
      this.deps.playerManager.setLocalPlayerPredictedPosition({
        position: localPlayer.position,
        velocity: localPlayer.velocity,
      });
      this.deps.playerManager.applyReconciledPosition(
        localPlayerId,
        { position: localPlayer.position, velocity: localPlayer.velocity },
        false
      );
      return;
    }

    const pendingInputs = this.runtime.inputManager.getInputHistory();
    const reconciledState = this.runtime.predictionEngine.reconcile(
      localPlayer.position,
      localPlayer.velocity,
      lastProcessedSequence,
      pendingInputs
    );

    this.deps.playerManager.setLocalPlayerPredictedPosition(reconciledState);

    const currentPosition = this.deps.playerManager.getPlayerPosition(localPlayerId);
    const needsInstant = currentPosition
      ? this.runtime.predictionEngine.needsInstantCorrection(currentPosition, localPlayer.position)
      : false;

    this.deps.playerManager.applyReconciledPosition(localPlayerId, reconciledState, needsInstant);
  }
}
