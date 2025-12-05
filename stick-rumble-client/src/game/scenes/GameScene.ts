import Phaser from 'phaser';
import { WebSocketClient } from '../network/WebSocketClient';
import { InputManager } from '../input/InputManager';
import { ShootingManager, type WeaponState } from '../input/ShootingManager';
import { PlayerManager, type PlayerState } from '../entities/PlayerManager';
import { ProjectileManager, type ProjectileData } from '../entities/ProjectileManager';
import { ARENA } from '../../shared/constants';

export class GameScene extends Phaser.Scene {
  private wsClient!: WebSocketClient;
  private inputManager!: InputManager;
  private shootingManager!: ShootingManager;
  private playerManager!: PlayerManager;
  private projectileManager!: ProjectileManager;
  private ammoText!: Phaser.GameObjects.Text;
  private lastDeltaTime: number = 0;

  constructor() {
    super({ key: 'GameScene' });
  }

  preload(): void {
    // Assets will be loaded here in future stories
  }

  create(): void {
    // Set world bounds to match arena size
    this.cameras.main.setBounds(0, 0, ARENA.WIDTH, ARENA.HEIGHT);

    // Add arena background
    this.add.rectangle(0, 0, ARENA.WIDTH, ARENA.HEIGHT, 0x222222).setOrigin(0, 0);

    // Add arena border
    this.add.rectangle(0, 0, ARENA.WIDTH, ARENA.HEIGHT, 0xffffff, 0)
      .setOrigin(0, 0)
      .setStrokeStyle(2, 0xffffff);

    // Add title
    this.add.text(10, 10, 'Stick Rumble - WASD to move', {
      fontSize: '18px',
      color: '#ffffff'
    });

    // Initialize player manager
    this.playerManager = new PlayerManager(this);

    // Initialize projectile manager
    this.projectileManager = new ProjectileManager(this);

    // Connect to WebSocket server
    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8080/ws';
    this.wsClient = new WebSocketClient(wsUrl);

    // Setup message handlers before connecting
    this.wsClient.on('player:move', (data) => {
      const messageData = data as { players: PlayerState[] };
      if (messageData.players) {
        this.playerManager.updatePlayers(messageData.players);

        // Update input manager with local player position for aim calculation
        if (this.inputManager && this.playerManager.getLocalPlayerId()) {
          const localPlayer = messageData.players.find(
            p => p.id === this.playerManager.getLocalPlayerId()
          );
          if (localPlayer) {
            this.inputManager.setPlayerPosition(
              localPlayer.position.x,
              localPlayer.position.y
            );
          }
        }
      }
    });

    this.wsClient.on('room:joined', (data) => {
      const messageData = data as { playerId: string };
      console.log('Joined room as player:', messageData.playerId);
      // Set local player ID so we can highlight our player
      if (messageData.playerId) {
        this.playerManager.setLocalPlayerId(messageData.playerId);
      }
    });

    // Handle projectile spawn from server
    this.wsClient.on('projectile:spawn', (data) => {
      const projectileData = data as ProjectileData;
      this.projectileManager.spawnProjectile(projectileData);

      // Create muzzle flash at projectile origin
      this.projectileManager.createMuzzleFlash(
        projectileData.position.x,
        projectileData.position.y
      );
    });

    // Handle projectile destroy from server
    this.wsClient.on('projectile:destroy', (data) => {
      const { id } = data as { id: string };
      this.projectileManager.removeProjectile(id);
    });

    // Handle weapon state updates from server
    this.wsClient.on('weapon:state', (data) => {
      const weaponState = data as WeaponState;
      if (this.shootingManager) {
        this.shootingManager.updateWeaponState(weaponState);
        this.updateAmmoDisplay();
      }
    });

    // Handle shoot failures (for empty click sound, etc.)
    this.wsClient.on('shoot:failed', (data) => {
      const { reason } = data as { reason: string };
      if (reason === 'empty') {
        // TODO: Play empty click sound in future story
        console.log('Click! Magazine empty');
      }
    });

    // Handle player damaged events
    this.wsClient.on('player:damaged', (data) => {
      const damageData = data as {
        victimId: string;
        attackerId: string;
        damage: number;
        newHealth: number;
        projectileId: string;
      };
      console.log(
        `Player ${damageData.victimId} took ${damageData.damage} damage from ${damageData.attackerId} (health: ${damageData.newHealth})`
      );
      // TODO: Visual damage feedback (screen flash, damage numbers, health bar) in Story 2.5
    });

    // Handle hit confirmation (for hit marker feedback)
    this.wsClient.on('hit:confirmed', (data) => {
      const hitData = data as {
        victimId: string;
        damage: number;
        projectileId: string;
      };
      console.log(`Hit confirmed! Dealt ${hitData.damage} damage to ${hitData.victimId}`);
      // TODO: Show hit marker (visual + audio) in Story 2.5
    });

    // Handle player death events
    this.wsClient.on('player:death', (data) => {
      const deathData = data as {
        victimId: string;
        attackerId: string;
      };
      console.log(`Player ${deathData.victimId} was killed by ${deathData.attackerId}`);
      // TODO: Death animations and respawn logic in future story
    });

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

          // Setup mouse click for shooting
          this.input.on('pointerdown', () => {
            if (this.shootingManager && this.inputManager) {
              // Update shooting manager with current aim angle
              this.shootingManager.setAimAngle(this.inputManager.getAimAngle());
              this.shootingManager.shoot();
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

          // Add connection status
          this.add.text(10, 30, 'Connected! WASD=move, Click=shoot, R=reload', {
            fontSize: '14px',
            color: '#00ff00'
          });

          // Add ammo display
          this.ammoText = this.add.text(10, 50, '15/15', {
            fontSize: '16px',
            color: '#ffffff'
          });
          this.updateAmmoDisplay();
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

  /**
   * Update the ammo display text
   */
  private updateAmmoDisplay(): void {
    if (this.ammoText && this.shootingManager) {
      const [current, max] = this.shootingManager.getAmmoInfo();
      const reloading = this.shootingManager.isReloading() ? ' [RELOADING]' : '';
      this.ammoText.setText(`${current}/${max}${reloading}`);
    }
  }

  update(_time: number, delta: number): void {
    // Convert delta from ms to seconds
    this.lastDeltaTime = delta / 1000;

    // Update input manager to send player input to server
    if (this.inputManager) {
      this.inputManager.update();
    }

    // Update projectiles
    if (this.projectileManager) {
      this.projectileManager.update(this.lastDeltaTime);
    }
  }
}
