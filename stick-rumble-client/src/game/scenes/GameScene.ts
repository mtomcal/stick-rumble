import Phaser from 'phaser';
import { WebSocketClient } from '../network/WebSocketClient';
import { InputManager } from '../input/InputManager';
import { ShootingManager } from '../input/ShootingManager';
import { PlayerManager } from '../entities/PlayerManager';
import { ProjectileManager } from '../entities/ProjectileManager';
import { WeaponCrateManager } from '../entities/WeaponCrateManager';
import { MeleeWeaponManager } from '../entities/MeleeWeaponManager';
import { HealthBarUI } from '../ui/HealthBarUI';
import { KillFeedUI } from '../ui/KillFeedUI';
import { PickupPromptUI } from '../ui/PickupPromptUI';
import { GameSceneUI } from './GameSceneUI';
import { GameSceneSpectator } from './GameSceneSpectator';
import { GameSceneEventHandlers } from './GameSceneEventHandlers';
import { ScreenShake } from '../effects/ScreenShake';
import { AudioManager } from '../audio/AudioManager';
import { ARENA } from '../../shared/constants';

export class GameScene extends Phaser.Scene {
  private wsClient!: WebSocketClient;
  private inputManager!: InputManager;
  private shootingManager!: ShootingManager;
  private playerManager!: PlayerManager;
  private projectileManager!: ProjectileManager;
  private weaponCrateManager!: WeaponCrateManager;
  private meleeWeaponManager!: MeleeWeaponManager;
  private pickupPromptUI!: PickupPromptUI;
  private healthBarUI!: HealthBarUI;
  private killFeedUI!: KillFeedUI;
  private ui!: GameSceneUI;
  private spectator!: GameSceneSpectator;
  private eventHandlers!: GameSceneEventHandlers;
  private screenShake!: ScreenShake;
  private audioManager!: AudioManager;
  private lastDeltaTime: number = 0;
  private isCameraFollowing: boolean = false;
  private nearbyWeaponCrate: { id: string; weaponType: string } | null = null;

  constructor() {
    super({ key: 'GameScene' });
  }

  preload(): void {
    // Load audio assets
    AudioManager.preload(this);
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

    // Initialize player manager
    this.playerManager = new PlayerManager(this);

    // Initialize projectile manager
    this.projectileManager = new ProjectileManager(this);

    // Initialize weapon crate manager
    this.weaponCrateManager = new WeaponCrateManager(this);

    // Initialize melee weapon manager for swing animations
    this.meleeWeaponManager = new MeleeWeaponManager(this);

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
    this.ui.createDamageFlashOverlay(ARENA.WIDTH, ARENA.HEIGHT);

    // Initialize spectator module
    this.spectator = new GameSceneSpectator(this, this.playerManager, () => this.stopCameraFollow());

    // Initialize screen shake for recoil feedback (Story 3.3 Polish)
    this.screenShake = new ScreenShake(this.cameras.main);

    // Initialize audio manager (Story 3.3 Polish: Weapon-Specific Firing Sounds)
    this.audioManager = new AudioManager(this);

    // Connect to WebSocket server
    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8080/ws';
    this.wsClient = new WebSocketClient(wsUrl);

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
      this.meleeWeaponManager
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

          // Pass managers to event handlers
          this.eventHandlers.setInputManager(this.inputManager);
          this.eventHandlers.setShootingManager(this.shootingManager);

          // Setup mouse click for shooting/melee
          this.input.on('pointerdown', () => {
            if (this.shootingManager && this.inputManager) {
              // Update shooting manager with current aim angle
              this.shootingManager.setAimAngle(this.inputManager.getAimAngle());

              // Route to correct attack type based on current weapon
              if (this.shootingManager.isMeleeWeapon()) {
                this.shootingManager.meleeAttack();
              } else {
                this.shootingManager.shoot();
              }
            }
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

          // Add connection status (fixed to screen)
          const connectionText = this.add.text(10, 30, 'Connected! WASD=move, Click=shoot, R=reload, E=pickup', {
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

    // Update input manager to send player input to server (only when not spectating)
    if (this.inputManager && this.spectator && !this.spectator.isActive()) {
      this.inputManager.update();

      // Update local player's aim indicator immediately for responsive controls
      // This provides client-side prediction without waiting for server echo
      const currentAimAngle = this.inputManager.getAimAngle();
      this.playerManager.updateLocalPlayerAim(currentAimAngle);

      // Check for nearby weapon crates
      this.checkWeaponProximity();
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
   * Start camera follow on local player sprite if not already following
   */
  private startCameraFollowIfNeeded(): void {
    if (this.isCameraFollowing) {
      return;
    }

    const localPlayerSprite = this.playerManager.getLocalPlayerSprite();
    if (localPlayerSprite) {
      // Start following with smooth lerp (0.1 = smooth follow, 1 = instant)
      this.cameras.main.startFollow(localPlayerSprite, true, 0.1, 0.1);
      this.isCameraFollowing = true;
    }
  }

  /**
   * Stop camera follow (used when entering spectator mode)
   */
  private stopCameraFollow(): void {
    this.cameras.main.stopFollow();
    this.isCameraFollowing = false;
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

    // Disconnect WebSocket
    if (this.wsClient) {
      this.wsClient.disconnect();
    }
  }

  /**
   * Restart the match (for future Epic 5 lobby system)
   * This will trigger scene shutdown -> cleanup -> create cycle
   */
  restartMatch(): void {
    this.scene.restart();
  }
}
