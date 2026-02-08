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
import { ARENA } from '../../shared/constants';

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
  private isPointerHeld: boolean = false;

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

    // Set world and camera bounds to match arena size
    this.physics.world.setBounds(0, 0, ARENA.WIDTH, ARENA.HEIGHT);
    this.cameras.main.setBounds(0, 0, ARENA.WIDTH, ARENA.HEIGHT);

    // Add arena background
    this.add.rectangle(0, 0, ARENA.WIDTH, ARENA.HEIGHT, 0x222222).setOrigin(0, 0);

    // Add arena border
    this.add.rectangle(0, 0, ARENA.WIDTH, ARENA.HEIGHT, 0xffffff, 0)
      .setOrigin(0, 0)
      .setStrokeStyle(2, 0xffffff);

    // Add title (fixed to screen)
    const titleText = this.add.text(10, 10, 'Stick Rumble - WASD to move', {
      fontSize: '18px',
      color: '#ffffff'
    });
    titleText.setScrollFactor(0);

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
    this.healthBarUI = new HealthBarUI(this, 10, 70);

    // Initialize kill feed UI (top-right corner)
    this.killFeedUI = new KillFeedUI(this, ARENA.WIDTH - 10, 100);

    // Initialize UI module
    this.ui = new GameSceneUI(this);
    const camera = this.cameras.main;
    this.ui.createMatchTimer(camera.width / 2, 10);

    // Initialize dodge roll cooldown UI (bottom-right corner, fixed to screen)
    this.dodgeRollCooldownUI = new DodgeRollCooldownUI(this, camera.width - 50, camera.height - 50);
    this.ui.createDamageFlashOverlay(ARENA.WIDTH, ARENA.HEIGHT);

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

    // Connect to WebSocket server
    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8080/ws';
    this.wsClient = new WebSocketClient(wsUrl, false, this.networkSimulator);

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
      this.hitEffectManager
    );

    // Inject screen shake into event handlers for recoil feedback (Story 3.3 Polish)
    this.eventHandlers.setScreenShake(this.screenShake);

    // Inject audio manager into event handlers for weapon firing sounds (Story 3.3 Polish)
    this.eventHandlers.setAudioManager(this.audioManager);

    // Setup message handlers before connecting
    this.eventHandlers.setupEventHandlers();

    // Defer connection until next frame to ensure scene is fully initialized
    this.time.delayedCall(100, () => {
      this.wsClient.connect()
        .then(() => {
          console.log('Connected to server!');

          // Initialize input manager after connection and scene is ready
          this.inputManager = new InputManager(this, this.wsClient);
          this.inputManager.init();

          // Initialize shooting manager
          this.shootingManager = new ShootingManager(this, this.wsClient);

          // Initialize dodge roll manager
          this.dodgeRollManager = new DodgeRollManager();

          // Initialize prediction engine for client-side reconciliation (Story 4.2)
          this.predictionEngine = new PredictionEngine();

          // Pass managers to event handlers
          this.eventHandlers.setInputManager(this.inputManager);
          this.eventHandlers.setShootingManager(this.shootingManager);
          this.eventHandlers.setDodgeRollManager(this.dodgeRollManager);
          this.eventHandlers.setPredictionEngine(this.predictionEngine);

          // Setup mouse click for shooting/melee
          this.input.on('pointerdown', () => {
            if (this.shootingManager && this.inputManager) {
              // Track pointer held state for automatic weapons
              this.isPointerHeld = true;

              // Update shooting manager with current aim angle
              const aimAngle = this.inputManager.getAimAngle();
              this.shootingManager.setAimAngle(aimAngle);

              // Route to correct attack type based on current weapon
              if (this.shootingManager.isMeleeWeapon()) {
                const didAttack = this.shootingManager.meleeAttack();
                // Trigger local swing animation immediately for visual feedback
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
              } else {
                this.shootingManager.shoot();
              }
            }
          });

          // Setup mouse release to stop automatic fire
          this.input.on('pointerup', () => {
            this.isPointerHeld = false;
          });

          // Setup R key for reload
          const reloadKey = this.input.keyboard?.addKey('R');
          if (reloadKey) {
            reloadKey.on('down', () => {
              if (this.shootingManager) {
                this.shootingManager.reload();
              }
            });
          }

          // Setup E key for weapon pickup
          const pickupKey = this.input.keyboard?.addKey('E');
          if (pickupKey) {
            pickupKey.on('down', () => {
              if (this.nearbyWeaponCrate) {
                this.wsClient.send({
                  type: 'weapon:pickup_attempt',
                  timestamp: Date.now(),
                  data: { crateId: this.nearbyWeaponCrate.id }
                });
              }
            });
          }

          // Setup SPACE key for dodge roll
          const dodgeKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
          if (dodgeKey) {
            dodgeKey.on('down', () => {
              if (this.dodgeRollManager && this.dodgeRollManager.canDodgeRoll()) {
                // Calculate roll direction from WASD input or aim angle
                const inputState = this.inputManager.getState();
                const rollDirection = { x: 0, y: 0 };

                // Use WASD input if any direction keys are pressed
                if (inputState.up || inputState.down || inputState.left || inputState.right) {
                  if (inputState.right) rollDirection.x += 1;
                  if (inputState.left) rollDirection.x -= 1;
                  if (inputState.down) rollDirection.y += 1;
                  if (inputState.up) rollDirection.y -= 1;

                  // Normalize direction vector
                  const magnitude = Math.sqrt(rollDirection.x ** 2 + rollDirection.y ** 2);
                  if (magnitude > 0) {
                    rollDirection.x /= magnitude;
                    rollDirection.y /= magnitude;
                  }
                } else {
                  // Use aim angle if stationary
                  const aimAngle = this.inputManager.getAimAngle();
                  rollDirection.x = Math.cos(aimAngle);
                  rollDirection.y = Math.sin(aimAngle);
                }

                // Send dodge roll request to server
                this.wsClient.send({
                  type: 'player:dodge_roll',
                  timestamp: Date.now(),
                  data: { direction: rollDirection }
                });
              }
            });
          }

          // Add connection status (fixed to screen)
          const connectionText = this.add.text(10, 30, 'Connected! WASD=move, Click=shoot, R=reload, E=pickup, SPACE=dodge', {
            fontSize: '14px',
            color: '#00ff00'
          });
          connectionText.setScrollFactor(0);

          // Create ammo display
          this.ui.createAmmoDisplay(10, 50);
          this.ui.updateAmmoDisplay(this.shootingManager);

          // Create reload UI elements
          this.ui.createReloadProgressBar(10, 70, 200, 10);
          this.ui.createReloadCircleIndicator();

          // Create crosshair system
          this.ui.createCrosshair();
        })
        .catch(err => {
          console.error('Failed to connect:', err);

          // Display connection error
          this.add.text(10, 30, 'Failed to connect to server', {
            fontSize: '14px',
            color: '#ff0000'
          });
        });
    });
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
      this.inputManager.update();

      // Update local player's aim indicator immediately for responsive controls
      // This provides client-side prediction without waiting for server echo
      const currentAimAngle = this.inputManager.getAimAngle();
      this.playerManager.updateLocalPlayerAim(currentAimAngle);

      // Handle automatic fire for automatic weapons when pointer held
      if (this.isPointerHeld && this.shootingManager && !this.shootingManager.isMeleeWeapon() && this.shootingManager.isAutomatic()) {
        this.shootingManager.setAimAngle(currentAimAngle);
        this.shootingManager.shoot();
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

    // Update reload UI progress
    if (this.shootingManager && this.shootingManager.isReloading()) {
      const progress = this.shootingManager.getReloadProgress();
      this.ui.updateReloadProgress(progress, 10, 70, 200, 10);
      this.ui.updateReloadCircle(progress);
    }

    // Update crosshair
    if (this.playerManager && this.eventHandlers) {
      const isMoving = this.playerManager.isLocalPlayerMoving();
      const weaponType = this.eventHandlers.getCurrentWeaponType();

      // Map weapon type to spread degrees (matching server values)
      const WEAPON_SPREAD: Record<string, number> = {
        'uzi': 5.0,
        'ak47': 3.0,
        'shotgun': 15.0,
        'pistol': 2.0,
        'bat': 0,
        'katana': 0,
      };

      const spreadDegrees = WEAPON_SPREAD[weaponType.toLowerCase()] || 0;
      this.ui.updateCrosshair(isMoving, spreadDegrees, weaponType);
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

  /**
   * Check for nearby weapon crates and show pickup prompt
   */
  private checkWeaponProximity(): void {
    if (!this.weaponCrateManager || !this.pickupPromptUI || !this.playerManager) {
      return;
    }

    const localPlayerPos = this.playerManager.getLocalPlayerPosition();
    const nearest = this.weaponCrateManager.checkProximity(localPlayerPos);

    if (nearest) {
      this.pickupPromptUI.show(nearest.weaponType);
      this.nearbyWeaponCrate = nearest;
    } else {
      this.pickupPromptUI.hide();
      this.nearbyWeaponCrate = null;
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
    if (this.inputManager) {
      this.inputManager.destroy();
    }
    if (this.shootingManager) {
      this.shootingManager.destroy();
    }

    // Disconnect WebSocket on scene restart
    // This triggers a fresh connection with new player ID
    if (this.wsClient) {
      this.wsClient.disconnect();
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
