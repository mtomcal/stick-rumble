import type { WebSocketClient } from '../../network/WebSocketClient';
import type { PlayerManager, PlayerState as RenderPlayerState } from '../../entities/PlayerManager';
import type { ProjectileManager } from '../../entities/ProjectileManager';
import type { WeaponCrateManager } from '../../entities/WeaponCrateManager';
import type { MeleeWeaponManager } from '../../entities/MeleeWeaponManager';
import type { HitEffectManager } from '../../entities/HitEffectManager';
import type { PickupPromptUI } from '../../ui/PickupPromptUI';
import type { InputManager } from '../../input/InputManager';
import type { ShootingManager } from '../../input/ShootingManager';
import type { DodgeRollManager } from '../../input/DodgeRollManager';
import type { HealthBarUI } from '../../ui/HealthBarUI';
import type { KillFeedUI } from '../../ui/KillFeedUI';
import type { GameSceneUI } from '../GameSceneUI';
import type { GameSceneSpectator } from '../GameSceneSpectator';
import type { ScreenShake } from '../../effects/ScreenShake';
import type { AudioManager } from '../../audio/AudioManager';
import type { PredictionEngine } from '../../physics/PredictionEngine';
import type { ScoreDisplayUI } from '../../ui/ScoreDisplayUI';
import type { KillCounterUI } from '../../ui/KillCounterUI';
import type { ChatLogUI } from '../../ui/ChatLogUI';
import type { PickupNotificationUI } from '../../ui/PickupNotificationUI';
import type { AimLine } from '../../entities/AimLine';
import type { JoinErrorPayload, MatchSession } from '../../../shared/types';
import type { PlayerMoveData } from '../../../../../events-schema/src/index.js';

export interface GameplayEventRouterState {
  localPlayerHealth: number;
  currentWeaponType: string;
  matchEnded: boolean;
  pendingPlayerMoves: unknown[];
  pendingWeaponSpawns: unknown[];
}

export interface GameplayEventRouterRuntime {
  inputManager: InputManager | null;
  shootingManager: ShootingManager | null;
  dodgeRollManager: DodgeRollManager | null;
  predictionEngine: PredictionEngine | null;
  screenShake: ScreenShake | null;
  audioManager: AudioManager | null;
  scoreDisplayUI: ScoreDisplayUI | null;
  killCounterUI: KillCounterUI | null;
  chatLogUI: ChatLogUI | null;
  pickupNotificationUI: PickupNotificationUI | null;
  aimLine: AimLine | null;
}

export interface GameplayEventRouterDeps {
  wsClient: WebSocketClient;
  playerManager: PlayerManager;
  projectileManager: ProjectileManager;
  weaponCrateManager: WeaponCrateManager;
  meleeWeaponManager: MeleeWeaponManager;
  hitEffectManager: HitEffectManager;
  pickupPromptUI: PickupPromptUI;
  getHealthBarUI: () => HealthBarUI;
  killFeedUI: KillFeedUI;
  ui: GameSceneUI;
  spectator: GameSceneSpectator;
  onCameraFollowNeeded: () => void;
  onMatchMapChanged: (mapId: string) => void;
  onRoomJoined: ((payload: MatchSession) => void) | null;
  onJoinError: ((payload: JoinErrorPayload) => void) | null;
  onRosterSizeChanged: ((count: number) => void) | null;
}

export interface GameplayEventRouterCoordinator {
  deps: GameplayEventRouterDeps;
  runtime: GameplayEventRouterRuntime;
  state: GameplayEventRouterState;
  handlerRefs: Map<string, (data: unknown) => void>;
  registerHandler(eventType: string, handler: (data: unknown) => void): void;
  shouldIgnoreLateGameplayEvent(): boolean;
  resetLocalWeaponAuthorityToPistol(): void;
  syncLocalHudStats(kills: number, xp: number): void;
  resolvePlayerDisplayName(playerId: string): string;
  toRenderPlayerState(player: PlayerMoveData['players'][number]): RenderPlayerState;
  handleServerCorrection(messageData: PlayerMoveData, localPlayerId: string): void;
}
