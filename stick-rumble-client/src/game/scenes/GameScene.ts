import Phaser from 'phaser';
import { WebSocketClient } from '../network/WebSocketClient';
import { NetworkSimulator } from '../network/NetworkSimulator';
import { parseNetworkSimulatorParams } from '../network/urlParams';
import { InputManager } from '../input/InputManager';
import { ShootingManager } from '../input/ShootingManager';
import { DodgeRollManager } from '../input/DodgeRollManager';
import { PredictionEngine } from '../physics/PredictionEngine';
import { PlayerManager } from '../entities/PlayerManager';
import { ProjectileManager } from '../entities/ProjectileManager';
import { WeaponCrateManager } from '../entities/WeaponCrateManager';
import { MeleeWeaponManager } from '../entities/MeleeWeaponManager';
import { HitEffectManager } from '../entities/HitEffectManager';
import { HealthBarUI } from '../ui/HealthBarUI';
import { KillFeedUI } from '../ui/KillFeedUI';
import { PickupPromptUI } from '../ui/PickupPromptUI';
import { DodgeRollCooldownUI } from '../ui/DodgeRollCooldownUI';
import { GameSceneUI } from './GameSceneUI';
import { GameSceneSpectator } from './GameSceneSpectator';
import { GameSceneEventHandlers } from './GameSceneEventHandlers';
import { ScreenShake } from '../effects/ScreenShake';
import { AudioManager } from '../audio/AudioManager';
import { AimLine } from '../entities/AimLine';
import { getWeaponBarrelLength } from '../entities/WeaponGeometry';
import { ScoreDisplayUI } from '../ui/ScoreDisplayUI';
import { KillCounterUI } from '../ui/KillCounterUI';
import { PickupNotificationUI } from '../ui/PickupNotificationUI';
import { COLORS } from '../../shared/constants';
import {
  getDefaultMatchMapContext,
  getFirstBlockingObstacleContact,
  getMatchMapContext,
  isPointInsideBlockingObstacle,
  type MapObstacle,
  type MatchMapContext,
} from '../../shared/maps';
import type { GameplayIntentState, GameplayViewportLayout } from '../../shared/types';
import {
  getActiveMatchBootstrap,
  getMobileGameplayIntent,
  getViewportLayout,
  setMobilePickupAction,
  subscribeMobileGameplayIntent,
  subscribeRuntimeAction,
  subscribeViewportLayout,
} from '../sessionRuntime';

const OBSTACLE_EDGE_INSET_PX = 1;
const MOBILE_BOTTOM_RIGHT_HUD_RESERVE = 180;
const DESKTOP_CAMERA_ZOOM = 1;
const MOBILE_LANDSCAPE_CAMERA_ZOOM = 1.15;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function getObstacleReadableEdgeStrokeRect(obstacle: MapObstacle): {
  x: number;
  y: number;
  width: number;
  height: number;
} | null {
  if (obstacle.width <= OBSTACLE_EDGE_INSET_PX * 2 || obstacle.height <= OBSTACLE_EDGE_INSET_PX * 2) {
    return null;
  }

  return {
    x: obstacle.x + OBSTACLE_EDGE_INSET_PX,
    y: obstacle.y + OBSTACLE_EDGE_INSET_PX,
    width: obstacle.width - OBSTACLE_EDGE_INSET_PX * 2,
    height: obstacle.height - OBSTACLE_EDGE_INSET_PX * 2,
  };
}

export class GameScene extends Phaser.Scene {
  private wsClient!: WebSocketClient;
  private networkSimulator!: NetworkSimulator;
  private inputManager!: InputManager;
  private shootingManager!: ShootingManager;
  private dodgeRollManager!: DodgeRollManager;
  private predictionEngine!: PredictionEngine;
  private playerManager!: PlayerManager;
  private projectileManager!: ProjectileManager;
  private weaponCrateManager!: WeaponCrateManager;
  private meleeWeaponManager!: MeleeWeaponManager;
  private hitEffectManager!: HitEffectManager;
  private pickupPromptUI!: PickupPromptUI;
  private healthBarUI!: HealthBarUI;
  private killFeedUI!: KillFeedUI;
  private dodgeRollCooldownUI!: DodgeRollCooldownUI;
  private ui!: GameSceneUI;
  private spectator!: GameSceneSpectator;
  private eventHandlers!: GameSceneEventHandlers;
  private screenShake!: ScreenShake;
  private audioManager!: AudioManager;
  private lastDeltaTime: number = 0;
  private isCameraFollowing: boolean = false;
  private cameraFollowTarget: Phaser.GameObjects.Graphics | null = null;
  private nearbyWeaponCrate: { id: string; weaponType: string } | null = null;
  private aimLine!: AimLine;
  private scoreDisplayUI!: ScoreDisplayUI;
  private killCounterUI!: KillCounterUI;
  private pickupNotificationUI!: PickupNotificationUI;
  private matchMapContext: MatchMapContext = getDefaultMatchMapContext();
  private arenaBackground: Phaser.GameObjects.Rectangle | null = null;
  private arenaBorder: Phaser.GameObjects.Rectangle | null = null;
  private floorGridGraphics: Phaser.GameObjects.Graphics | null = null;
  private obstacleGraphics: Phaser.GameObjects.Graphics | null = null;
  private mobileIntent: GameplayIntentState | null = getMobileGameplayIntent();
  private viewportLayout: GameplayViewportLayout = getViewportLayout();
  private desktopFireHeld: boolean = false;
  private mobileFireHeld: boolean = false;
  private unsubscribeMobileIntent: (() => void) | null = null;
  private unsubscribeViewportLayout: (() => void) | null = null;
  private unsubscribeRuntimeAction: (() => void) | null = null;

  constructor() {
    super({ key: 'GameScene' });
  }

  preload(): void {
    // Load audio assets
    AudioManager.preload(this);

    // No sprite assets needed - using procedural graphics
  }

  create(): void {
    // Register shutdown event handler for cleanup
    this.events.once('shutdown', () => {
      this.cleanup();
    });

    // Initialize aim line (local player only, depth 40)
    this.aimLine = new AimLine(this);

    // Initialize player manager (using procedural graphics)
    this.playerManager = new PlayerManager(this);

    // Initialize projectile manager
    this.projectileManager = new ProjectileManager(this);

    // Initialize weapon crate manager
    this.weaponCrateManager = new WeaponCrateManager(this);

    // Initialize melee weapon manager for swing animations
    this.meleeWeaponManager = new MeleeWeaponManager(this);

    // Initialize hit effect manager with object pooling (Story 3.7B)
    this.hitEffectManager = new HitEffectManager(this, 20);

    // Initialize pickup prompt UI
    this.pickupPromptUI = new PickupPromptUI(this);

    // Initialize health bar UI (top-left corner)
    this.healthBarUI = new HealthBarUI(
      this,
      0,
      0
    );

    const camera = this.cameras.main;

    // Initialize kill feed UI (top-right corner)
    this.killFeedUI = new KillFeedUI(this, camera.width - 10, 100);

    // Initialize UI module
    this.ui = new GameSceneUI(this);
    this.ui.createMatchTimer(camera.width / 2, 10);

    // Initialize dodge roll cooldown UI (bottom-right corner, fixed to screen)
    this.dodgeRollCooldownUI = new DodgeRollCooldownUI(this, camera.width - 50, camera.height - 50);
    this.ui.createDamageFlashOverlay(camera.width, camera.height);

    // Initialize new UI components
    this.scoreDisplayUI = new ScoreDisplayUI(this, camera.width - 10, 10);
    this.killCounterUI = new KillCounterUI(this, camera.width - 10, 42);
    this.pickupNotificationUI = new PickupNotificationUI(this, camera.width / 2, camera.height / 2);

    this.applyMatchMapContext(this.matchMapContext);

    // Initialize spectator module
    this.spectator = new GameSceneSpectator(this, this.playerManager, () => this.stopCameraFollow());

    // Initialize screen shake for recoil feedback (Story 3.3 Polish)
    this.screenShake = new ScreenShake(this.cameras.main);

    // Initialize audio manager (Story 3.3 Polish: Weapon-Specific Firing Sounds)
    this.audioManager = new AudioManager(this);

    // Initialize network simulator with URL params (Story 4.6: Artificial Latency Testing)
    const urlSimulatorConfig = parseNetworkSimulatorParams();
    this.networkSimulator = new NetworkSimulator(urlSimulatorConfig || undefined);
    if (urlSimulatorConfig) {
      console.log('[NetworkSimulator] Configured from URL params:', urlSimulatorConfig);
    }

    // Setup window globals for React debug panel communication
    this.setupNetworkSimulatorGlobals();

    // Setup F8 key for network debug panel toggle
    this.setupF8KeyHandler();

    const bootstrap = getActiveMatchBootstrap();
    if (!bootstrap) {
      throw new Error('GameScene requires an active match bootstrap')
    }

    this.wsClient = bootstrap.wsClient;
    this.applyMatchMapContext(getMatchMapContext(bootstrap.session.mapId));

    // Initialize event handlers module
    this.eventHandlers = new GameSceneEventHandlers(
      this.wsClient,
      this.playerManager,
      this.projectileManager,
      () => this.healthBarUI,
      this.killFeedUI,
      this.ui,
      this.spectator,
      () => this.startCameraFollowIfNeeded(),
      this.weaponCrateManager,
      this.pickupPromptUI,
      this.meleeWeaponManager,
      this.hitEffectManager,
      (mapId: string) => this.applyMatchMapContext(getMatchMapContext(mapId))
    );

    // Inject new UI components into event handlers
    this.eventHandlers.setScoreDisplayUI(this.scoreDisplayUI);
    this.eventHandlers.setKillCounterUI(this.killCounterUI);
    this.eventHandlers.setPickupNotificationUI(this.pickupNotificationUI);
    this.eventHandlers.setAimLine(this.aimLine);

    // Inject screen shake into event handlers for recoil feedback (Story 3.3 Polish)
    this.eventHandlers.setScreenShake(this.screenShake);

    // Inject audio manager into event handlers for weapon firing sounds (Story 3.3 Polish)
    this.eventHandlers.setAudioManager(this.audioManager);

    // Setup message handlers before connecting
    this.eventHandlers.setupEventHandlers();
    this.playerManager.setLocalPlayerId(bootstrap.session.playerId);
    this.healthBarUI.updateHealth(100, 100, false);
    this.initializeGameplaySystems();
    this.bindRuntimeBridge();
    this.applyViewportLayout(this.viewportLayout);
    this.wsClient.setGameplayReady(true);
  }

  update(_time: number, delta: number): void {
    // Convert delta from ms to seconds
    this.lastDeltaTime = delta / 1000;

    // Update player positions with interpolation (Story 4.3)
    if (this.playerManager) {
      this.playerManager.update(delta);
    }

    // Update input manager to send player input to server (only when not spectating)
    if (this.inputManager && this.spectator && !this.spectator.isActive()) {
      // Apply aim sway offset before sending input to server
      this.inputManager.setAimSwayOffset(this.playerManager.getLocalPlayerAimSway());
      this.inputManager.update();

      // Client-side prediction for local player (Story stick-rumble-nki)
      // Predict next frame's position based on current input for instant visual feedback
      if (this.predictionEngine && this.playerManager.getLocalPlayerId()) {
        const localPlayerId = this.playerManager.getLocalPlayerId();
        if (localPlayerId) {
          const currentState = this.playerManager.getPlayerState(localPlayerId);
          if (currentState) {
            const inputState = this.inputManager.getState();

            // Use predicted position if available, fallback to server state for first prediction
            const predictedState = this.playerManager.getLocalPlayerPredictedState();
            const basePosition = predictedState?.position ?? currentState.position;
            const baseVelocity = predictedState?.velocity ?? currentState.velocity;

            // Predict next position based on current input
            const predicted = this.predictionEngine.predictPosition(
              basePosition,
              baseVelocity,
              inputState,
              this.lastDeltaTime
            );

            // Store predicted state for rendering
            this.playerManager.setLocalPlayerPredictedPosition(predicted);
          }
        }
      }

      // Update local player's aim indicator immediately for responsive controls
      // This provides client-side prediction without waiting for server echo
      const currentAimAngle = this.inputManager.getAimAngle();
      this.playerManager.updateLocalPlayerAim(currentAimAngle);

      // Desktop hold-fire remains automatic-only; mobile hold-fire repeats for all weapons at their normal cadence.
      const shouldRepeatDesktopFire = this.desktopFireHeld && this.shootingManager?.isAutomatic();
      const shouldRepeatMobileFire = this.mobileFireHeld;
      if ((shouldRepeatDesktopFire || shouldRepeatMobileFire) && this.shootingManager) {
        this.shootingManager.setAimAngle(currentAimAngle);

        if (this.shootingManager.isMeleeWeapon()) {
          const didAttack = this.shootingManager.meleeAttack();
          if (didAttack) {
            const localPlayerId = this.playerManager.getLocalPlayerId();
            if (localPlayerId) {
              const localPos = this.playerManager.getPlayerPosition(localPlayerId);
              if (localPos) {
                this.meleeWeaponManager.updatePosition(localPlayerId, localPos);
                this.meleeWeaponManager.startSwing(localPlayerId, currentAimAngle);
              }
            }
          }
        } else {
          const obstructed = this.getObstructedBarrelPosition(currentAimAngle);
          const didShoot = this.shootingManager.shoot();
          if (didShoot && obstructed) {
            this.ui.showWallSpark(obstructed.x, obstructed.y);
          }
        }
      }

      // Check for nearby weapon crates
      this.checkWeaponProximity();
    }

    // Update dodge roll manager
    if (this.dodgeRollManager) {
      this.dodgeRollManager.update();

      // Update dodge roll cooldown UI
      if (this.dodgeRollCooldownUI) {
        const cooldownProgress = this.dodgeRollManager.getCooldownProgress();
        this.dodgeRollCooldownUI.updateProgress(cooldownProgress);
      }
    }

    // Update projectiles
    if (this.projectileManager) {
      this.projectileManager.update(this.lastDeltaTime);
    }

    // Update melee weapon animations and positions
    if (this.meleeWeaponManager) {
      this.meleeWeaponManager.update();
    }

    // Update reload UI progress using the reload arc only.
    if (this.shootingManager && this.shootingManager.isReloading()) {
      const progress = this.shootingManager.getReloadProgress();
      const localPos = this.playerManager?.getLocalPlayerPosition();
      const playerX = localPos?.x ?? 0;
      const playerY = localPos?.y ?? 0;
      this.ui.updateReloadCircle(progress, playerX, playerY);
    }

    // Update crosshair — fixed-size reticle, no spread visualization
    if (this.eventHandlers) {
      const weaponType = this.eventHandlers.getCurrentWeaponType();
      this.ui.updateCrosshair(false, 0, weaponType);
    }

    // Update minimap
    if (this.ui && this.playerManager) {
      this.ui.updateMinimap(this.playerManager);
    }

    // Update spectator mode
    if (this.spectator && this.spectator.isActive()) {
      this.spectator.updateSpectatorMode();
      // Hide crosshair when spectating
      if (this.ui) {
        this.ui.setCrosshairSpectating(true);
      }
    } else {
      // Show crosshair when not spectating
      if (this.ui) {
        this.ui.setCrosshairSpectating(false);
      }
    }
  }

  private initializeGameplaySystems(): void {
    if (this.inputManager || this.shootingManager) {
      return;
    }

    this.inputManager = new InputManager(this, this.wsClient);
    this.inputManager.init();
    this.inputManager.setExternalIntent(this.mobileIntent);
    this.input.mouse?.disableContextMenu();

    this.shootingManager = new ShootingManager(this, this.wsClient);
    this.dodgeRollManager = new DodgeRollManager();
    this.predictionEngine = new PredictionEngine();
    this.predictionEngine.setMapContext(this.matchMapContext);

    this.eventHandlers.setInputManager(this.inputManager);
    this.eventHandlers.setShootingManager(this.shootingManager);
    this.eventHandlers.setDodgeRollManager(this.dodgeRollManager);
    this.eventHandlers.setPredictionEngine(this.predictionEngine);

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.button !== 0) {
        return;
      }

      this.setFireHeld('desktop', true);
    });

    this.input.on('pointerup', () => {
      this.setFireHeld('desktop', false);
    });

    const reloadKey = this.input.keyboard?.addKey('R');
    reloadKey?.on('down', () => {
      this.shootingManager?.reload();
    });

    const pickupKey = this.input.keyboard?.addKey('E');
    pickupKey?.on('down', () => {
      if (this.nearbyWeaponCrate) {
        this.wsClient.send({
          type: 'weapon:pickup_attempt',
          timestamp: Date.now(),
          data: { crateId: this.nearbyWeaponCrate.id },
        });
      }
    });

    const dodgeKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    dodgeKey?.on('down', () => {
      this.attemptDodgeRoll();
    });

    this.ui.createAmmoDisplay(
      0,
      0
    );
    this.ui.layoutTopLeftCluster(this.healthBarUI);
    this.ui.updateAmmoDisplay(this.shootingManager);
    this.ui.createReloadCircleIndicator();
    this.ui.createCrosshair();
    this.ui.setupMinimap();
  }

  private bindRuntimeBridge(): void {
    this.unsubscribeMobileIntent?.();
    this.unsubscribeRuntimeAction?.();
    this.unsubscribeViewportLayout?.();

    this.unsubscribeMobileIntent = subscribeMobileGameplayIntent((intent) => {
      this.mobileIntent = intent;
      this.inputManager?.setExternalIntent(intent);
      this.setFireHeld('mobile', intent?.fireActive ?? false);
    });

    this.unsubscribeRuntimeAction = subscribeRuntimeAction((action) => {
      if (action === 'reload') {
        this.shootingManager?.reload();
        return;
      }
      if (action === 'pickup') {
        if (this.nearbyWeaponCrate) {
          this.wsClient.send({
            type: 'weapon:pickup_attempt',
            timestamp: Date.now(),
            data: { crateId: this.nearbyWeaponCrate.id },
          });
        }
        return;
      }
      this.attemptDodgeRoll();
    });

    this.unsubscribeViewportLayout = subscribeViewportLayout((layout) => {
      this.viewportLayout = layout;
      this.applyViewportLayout(layout);
    });
  }

  private applyViewportLayout(layout: GameplayViewportLayout): void {
    this.ui?.setViewportLayout(layout);

    const camera = this.cameras.main;
    const previousZoom =
      typeof (camera as Phaser.Cameras.Scene2D.Camera & { zoom?: number }).zoom === 'number'
        ? (camera as Phaser.Cameras.Scene2D.Camera & { zoom: number }).zoom
        : DESKTOP_CAMERA_ZOOM;
    const previousVisibleWidth = camera.width / previousZoom;
    const previousVisibleHeight = camera.height / previousZoom;
    const previousCenterX = camera.scrollX + previousVisibleWidth / 2;
    const previousCenterY = camera.scrollY + previousVisibleHeight / 2;
    const nextZoom = layout.mode === 'mobile-landscape' ? MOBILE_LANDSCAPE_CAMERA_ZOOM : DESKTOP_CAMERA_ZOOM;
    if (camera.width !== layout.width || camera.height !== layout.height) {
      if (typeof camera.setSize === 'function') {
        camera.setSize(layout.width, layout.height);
      } else {
        (camera as Phaser.Cameras.Scene2D.Camera & { width: number; height: number }).width = layout.width;
        (camera as Phaser.Cameras.Scene2D.Camera & { width: number; height: number }).height = layout.height;
      }
    }

    if (typeof camera.setZoom === 'function') {
      camera.setZoom(nextZoom);
    } else {
      (camera as Phaser.Cameras.Scene2D.Camera & { zoom: number }).zoom = nextZoom;
    }

    if (!this.isCameraFollowing) {
      const visibleWidth = layout.width / nextZoom;
      const visibleHeight = layout.height / nextZoom;
      const maxScrollX = Math.max(this.matchMapContext.width - visibleWidth, 0);
      const maxScrollY = Math.max(this.matchMapContext.height - visibleHeight, 0);
      camera.scrollX = clamp(previousCenterX - visibleWidth / 2, 0, maxScrollX);
      camera.scrollY = clamp(previousCenterY - visibleHeight / 2, 0, maxScrollY);
    }

    this.spectator?.setViewportSize(layout.width, layout.height);

    const { width, height, insets } = layout;
    const hudFrameRight = layout.hudFrame.x + layout.hudFrame.width;
    const topInset = insets.top;
    const rightInset = insets.right;
    const bottomInset = insets.bottom;
    const mobileBottomRightReserve = layout.mode === 'mobile-landscape' ? MOBILE_BOTTOM_RIGHT_HUD_RESERVE : 0;

    this.scoreDisplayUI?.setPosition(hudFrameRight - 10 - rightInset, 10 + topInset);
    this.killCounterUI?.setPosition(hudFrameRight - 10 - rightInset, 42 + topInset);
    this.killFeedUI?.setPosition(hudFrameRight - 10 - rightInset, 100 + topInset);
    this.dodgeRollCooldownUI?.setPosition(
      hudFrameRight - 50 - rightInset,
      height - 50 - bottomInset - mobileBottomRightReserve
    );
    this.pickupPromptUI?.setPosition(width / 2, height - 100 - bottomInset);
    this.pickupNotificationUI?.setPosition(width / 2, height / 2);
  }

  private isPrimaryFireHeld(): boolean {
    return this.desktopFireHeld || this.mobileFireHeld;
  }

  private setFireHeld(source: 'desktop' | 'mobile', isHeld: boolean): void {
    const wasHeld = this.isPrimaryFireHeld();

    if (source === 'desktop') {
      this.desktopFireHeld = isHeld;
    } else {
      this.mobileFireHeld = isHeld;
    }

    const isNowHeld = this.isPrimaryFireHeld();
    if (!wasHeld && isNowHeld) {
      this.handlePrimaryFireStart();
    } else if (wasHeld && !isNowHeld) {
      this.handlePrimaryFireEnd();
    }
  }

  private handlePrimaryFireStart(): void {
    if (!this.shootingManager || !this.inputManager) {
      return;
    }

    const aimAngle = this.inputManager.getAimAngle();
    this.shootingManager.setAimAngle(aimAngle);

    if (this.shootingManager.isMeleeWeapon()) {
      const didAttack = this.shootingManager.meleeAttack();
      if (didAttack) {
        const localPlayerId = this.playerManager.getLocalPlayerId();
        if (localPlayerId) {
          const localPos = this.playerManager.getPlayerPosition(localPlayerId);
          if (localPos) {
            this.meleeWeaponManager.updatePosition(localPlayerId, localPos);
            this.meleeWeaponManager.startSwing(localPlayerId, aimAngle);
          }
        }
      }
      return;
    }

    const obstructed = this.getObstructedBarrelPosition(aimAngle);
    const didShoot = this.shootingManager.shoot();
    if (didShoot && obstructed) {
      this.ui.showWallSpark(obstructed.x, obstructed.y);
    }
  }

  private handlePrimaryFireEnd(): void {
    this.desktopFireHeld = false;
    this.mobileFireHeld = false;
  }

  private attemptDodgeRoll(): void {
    if (!this.dodgeRollManager || !this.dodgeRollManager.canDodgeRoll() || !this.inputManager) {
      return;
    }

    const inputState = this.inputManager.getState();
    const rollDirection = { x: 0, y: 0 };

    if (inputState.up || inputState.down || inputState.left || inputState.right) {
      if (inputState.right) rollDirection.x += 1;
      if (inputState.left) rollDirection.x -= 1;
      if (inputState.down) rollDirection.y += 1;
      if (inputState.up) rollDirection.y -= 1;

      const magnitude = Math.sqrt(rollDirection.x ** 2 + rollDirection.y ** 2);
      if (magnitude > 0) {
        rollDirection.x /= magnitude;
        rollDirection.y /= magnitude;
      }
    } else {
      const aimAngle = this.inputManager.getAimAngle();
      rollDirection.x = Math.cos(aimAngle);
      rollDirection.y = Math.sin(aimAngle);
    }

    this.wsClient.send({
      type: 'player:dodge_roll',
      timestamp: Date.now(),
      data: { direction: rollDirection },
    });
  }

  /**
   * Check if the weapon barrel position is inside arena wall geometry.
   * Returns the barrel position if obstructed, or null if clear.
   */
  private applyMatchMapContext(mapContext: MatchMapContext): void {
    this.matchMapContext = mapContext;

    this.physics.world.setBounds(0, 0, mapContext.width, mapContext.height);
    this.cameras.main.setBounds(0, 0, mapContext.width, mapContext.height);

    if (!this.arenaBackground) {
      this.arenaBackground = this.add.rectangle(0, 0, mapContext.width, mapContext.height, COLORS.BACKGROUND)
        .setOrigin(0, 0)
        .setDepth(-2);
    } else {
      this.arenaBackground.setPosition(0, 0);
      this.arenaBackground.setDisplaySize(mapContext.width, mapContext.height);
    }

    if (!this.arenaBorder) {
      this.arenaBorder = this.add.rectangle(0, 0, mapContext.width, mapContext.height, 0xffffff, 0)
        .setOrigin(0, 0)
        .setStrokeStyle(2, 0xffffff)
        .setDepth(-2);
    } else {
      this.arenaBorder.setPosition(0, 0);
      this.arenaBorder.setDisplaySize(mapContext.width, mapContext.height);
    }

    if (!this.floorGridGraphics) {
      this.floorGridGraphics = this.add.graphics();
      this.floorGridGraphics.setDepth(-1);
    }
    this.drawFloorGrid(mapContext);

    if (!this.obstacleGraphics) {
      this.obstacleGraphics = this.add.graphics();
      this.obstacleGraphics.setDepth(1);
    }
    this.drawObstacles(mapContext);

    if (this.ui) {
      this.ui.setMinimapWorldSize(mapContext.width, mapContext.height);
    }
    if (this.predictionEngine) {
      this.predictionEngine.setMapContext(mapContext);
    }
    if (this.projectileManager) {
      this.projectileManager.setWorldBounds(mapContext.width, mapContext.height, mapContext.obstacles);
    }
    if (this.weaponCrateManager) {
      this.weaponCrateManager.initializeFromMapWeaponSpawns(mapContext.weaponSpawns);
    }
  }

  private drawFloorGrid(mapContext: MatchMapContext): void {
    if (!this.floorGridGraphics) {
      return;
    }

    this.floorGridGraphics.clear();
    this.floorGridGraphics.lineStyle(1, COLORS.GRID_LINE, 0.5);

    for (let x = 0; x <= mapContext.width; x += 100) {
      this.floorGridGraphics.moveTo(x, 0);
      this.floorGridGraphics.lineTo(x, mapContext.height);
    }
    for (let y = 0; y <= mapContext.height; y += 100) {
      this.floorGridGraphics.moveTo(0, y);
      this.floorGridGraphics.lineTo(mapContext.width, y);
    }

    this.floorGridGraphics.strokePath();
  }

  private drawObstacles(mapContext: MatchMapContext): void {
    if (!this.obstacleGraphics) {
      return;
    }

    this.obstacleGraphics.clear();

    for (const obstacle of mapContext.obstacles) {
      const fillColor = obstacle.type === 'desk' ? 0x8f948f : 0x646864;
      this.obstacleGraphics.fillStyle(fillColor, 1);
      this.obstacleGraphics.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
      const readableEdgeStroke = getObstacleReadableEdgeStrokeRect(obstacle);
      if (readableEdgeStroke) {
        this.obstacleGraphics.lineStyle(1, 0x2f3330, 1);
        this.obstacleGraphics.strokeRect(
          readableEdgeStroke.x,
          readableEdgeStroke.y,
          readableEdgeStroke.width,
          readableEdgeStroke.height
        );
      }
    }
  }

  private getObstructedBarrelPosition(aimAngle: number): { x: number; y: number } | null {
    const playerPos = this.playerManager.getLocalPlayerPosition();
    if (!playerPos) return null;

    const localPlayerId = this.playerManager.getLocalPlayerId();
    const barrel = localPlayerId
      ? this.playerManager.getWeaponBarrelPosition(localPlayerId)
      : null;
    const barrelX = barrel?.x ?? (playerPos.x + Math.cos(aimAngle) * 35);
    const barrelY = barrel?.y ?? (playerPos.y + Math.sin(aimAngle) * 35);
    const weaponType = this.shootingManager?.getWeaponState().weaponType ?? 'Pistol';
    const barrelLength = getWeaponBarrelLength(weaponType);
    const muzzleOriginX = barrelX - Math.cos(aimAngle) * barrelLength;
    const muzzleOriginY = barrelY - Math.sin(aimAngle) * barrelLength;
    const wallContact = getFirstBlockingObstacleContact(
      { x: muzzleOriginX, y: muzzleOriginY },
      { x: barrelX, y: barrelY },
      this.matchMapContext.obstacles
    );
    if (wallContact) {
      return { x: wallContact.x, y: wallContact.y };
    }

    if (
      barrelX < 0 ||
      barrelX > this.matchMapContext.width ||
      barrelY < 0 ||
      barrelY > this.matchMapContext.height ||
      isPointInsideBlockingObstacle(barrelX, barrelY, this.matchMapContext.obstacles)
    ) {
      return { x: barrelX, y: barrelY };
    }

    return null;
  }

  /**
   * Check for nearby weapon crates and show pickup prompt
   */
  private checkWeaponProximity(): void {
    if (!this.weaponCrateManager || !this.pickupPromptUI || !this.playerManager) {
      return;
    }

    const localPlayerPos = this.playerManager.getLocalPlayerPosition();
    if (!localPlayerPos) {
      return;
    }

    const nearest = this.weaponCrateManager.checkProximity(localPlayerPos);

    if (nearest) {
      this.pickupPromptUI.show(nearest.weaponType);
      this.nearbyWeaponCrate = nearest;
      setMobilePickupAction({
        crateId: nearest.id,
        weaponType: nearest.weaponType,
      });
    } else {
      this.pickupPromptUI.hide();
      this.nearbyWeaponCrate = null;
      setMobilePickupAction(null);
    }
  }

  /**
   * Start camera follow on local player graphics object if not already following.
   * Also re-attaches camera if the sprite reference changed (e.g., sprite was
   * destroyed and recreated due to delta compression clearing it).
   */
  private startCameraFollowIfNeeded(): void {
    const localPlayerGraphics = this.playerManager.getLocalPlayerSprite();
    if (!localPlayerGraphics) {
      return;
    }

    // Re-attach camera if sprite reference changed (recreated after destroy)
    if (this.isCameraFollowing && this.cameraFollowTarget !== localPlayerGraphics) {
      this.cameras.main.startFollow(localPlayerGraphics, true, 0.1, 0.1);
      this.cameraFollowTarget = localPlayerGraphics;
      return;
    }

    if (this.isCameraFollowing) {
      return;
    }

    // Start following with smooth lerp (0.1 = smooth follow, 1 = instant)
    this.cameras.main.startFollow(localPlayerGraphics, true, 0.1, 0.1);
    this.isCameraFollowing = true;
    this.cameraFollowTarget = localPlayerGraphics;
  }

  /**
   * Stop camera follow (used when entering spectator mode)
   */
  private stopCameraFollow(): void {
    this.cameras.main.stopFollow();
    this.isCameraFollowing = false;
    this.cameraFollowTarget = null;
  }

  /**
   * Cleanup all managers and resources on scene shutdown
   * This prevents memory leaks and sprite duplication when scene restarts
   */
  private cleanup(): void {
    // Cleanup event handlers first to prevent handler accumulation
    if (this.eventHandlers) {
      this.eventHandlers.destroy();
    }

    // Destroy aim line
    if (this.aimLine) {
      this.aimLine.destroy();
    }

    // Destroy all managers
    if (this.playerManager) {
      this.playerManager.destroy();
    }
    if (this.projectileManager) {
      this.projectileManager.destroy();
    }
    if (this.weaponCrateManager) {
      this.weaponCrateManager.destroy();
    }
    if (this.meleeWeaponManager) {
      this.meleeWeaponManager.destroy();
    }
    if (this.hitEffectManager) {
      this.hitEffectManager.destroy();
    }
    if (this.pickupPromptUI) {
      this.pickupPromptUI.destroy();
    }
    if (this.healthBarUI) {
      this.healthBarUI.destroy();
    }
    if (this.killFeedUI) {
      this.killFeedUI.destroy();
    }
    if (this.ui) {
      this.ui.destroy();
    }
    if (this.spectator) {
      this.spectator.destroy();
    }
    if (this.audioManager) {
      this.audioManager.destroy();
    }
    if (this.scoreDisplayUI) {
      this.scoreDisplayUI.destroy();
    }
    if (this.killCounterUI) {
      this.killCounterUI.destroy();
    }
    if (this.pickupNotificationUI) {
      this.pickupNotificationUI.destroy();
    }
    if (this.floorGridGraphics) {
      this.floorGridGraphics.destroy();
    }
    if (this.obstacleGraphics) {
      this.obstacleGraphics.destroy();
    }
    if (this.arenaBackground) {
      this.arenaBackground.destroy();
    }
    if (this.arenaBorder) {
      this.arenaBorder.destroy();
    }
    if (this.inputManager) {
      this.inputManager.destroy();
    }
    if (this.shootingManager) {
      this.shootingManager.destroy();
    }
    this.unsubscribeMobileIntent?.();
    this.unsubscribeRuntimeAction?.();
    this.unsubscribeViewportLayout?.();
    setMobilePickupAction(null);

    if (this.wsClient) {
      this.wsClient.setGameplayReady(false);
    }

    // Cleanup network simulator globals
    this.cleanupNetworkSimulatorGlobals();
  }

  /**
   * Restart the match (for future Epic 5 lobby system)
   * This will trigger scene shutdown -> cleanup -> create cycle
   */
  restartMatch(): void {
    this.scene.restart();
  }

  /**
   * Setup F8 key handler to toggle network debug panel (Story 4.6)
   */
  private setupF8KeyHandler(): void {
    const f8Key = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.F8);
    if (f8Key) {
      f8Key.on('down', () => {
        if (window.onNetworkSimulatorToggle) {
          window.onNetworkSimulatorToggle();
        }
      });
    }
  }

  /**
   * Setup window globals for React debug panel to control network simulator (Story 4.6)
   */
  private setupNetworkSimulatorGlobals(): void {
    window.getNetworkSimulatorStats = () => {
      return this.networkSimulator ? this.networkSimulator.getStats() : null;
    };

    window.setNetworkSimulatorLatency = (latency: number) => {
      if (this.networkSimulator) {
        this.networkSimulator.setLatency(latency);
      }
    };

    window.setNetworkSimulatorPacketLoss = (packetLoss: number) => {
      if (this.networkSimulator) {
        this.networkSimulator.setPacketLoss(packetLoss);
      }
    };

    window.setNetworkSimulatorEnabled = (enabled: boolean) => {
      if (this.networkSimulator) {
        this.networkSimulator.setEnabled(enabled);
      }
    };
  }

  /**
   * Cleanup window globals on scene shutdown (Story 4.6)
   */
  private cleanupNetworkSimulatorGlobals(): void {
    delete window.getNetworkSimulatorStats;
    delete window.setNetworkSimulatorLatency;
    delete window.setNetworkSimulatorPacketLoss;
    delete window.setNetworkSimulatorEnabled;
  }
}
