import Phaser from 'phaser';
import { WebSocketClient } from '../network/WebSocketClient';
import { InputManager } from '../input/InputManager';
import { ShootingManager, type WeaponState } from '../input/ShootingManager';
import { PlayerManager, type PlayerState } from '../entities/PlayerManager';
import { ProjectileManager, type ProjectileData } from '../entities/ProjectileManager';
import { HealthBarUI } from '../ui/HealthBarUI';
import { KillFeedUI } from '../ui/KillFeedUI';
import { ARENA } from '../../shared/constants';

export class GameScene extends Phaser.Scene {
  private wsClient!: WebSocketClient;
  private inputManager!: InputManager;
  private shootingManager!: ShootingManager;
  private playerManager!: PlayerManager;
  private projectileManager!: ProjectileManager;
  private healthBarUI!: HealthBarUI;
  private killFeedUI!: KillFeedUI;
  private ammoText!: Phaser.GameObjects.Text;
  private lastDeltaTime: number = 0;
  private isSpectating: boolean = false;
  private localPlayerDeathTime: number | null = null;
  private spectatorText: Phaser.GameObjects.Text | null = null;
  private respawnCountdownText: Phaser.GameObjects.Text | null = null;
  private localPlayerHealth: number = 100;
  private damageFlashOverlay: Phaser.GameObjects.Rectangle | null = null;

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

    // Initialize health bar UI (top-left corner)
    this.healthBarUI = new HealthBarUI(this, 10, 70);

    // Initialize kill feed UI (top-right corner)
    this.killFeedUI = new KillFeedUI(this, ARENA.WIDTH - 10, 100);

    // Create damage flash overlay (initially invisible)
    this.damageFlashOverlay = this.add.rectangle(
      ARENA.WIDTH / 2,
      ARENA.HEIGHT / 2,
      ARENA.WIDTH,
      ARENA.HEIGHT,
      0xff0000,
      0 // Fully transparent initially
    );
    this.damageFlashOverlay.setScrollFactor(0); // Fixed to screen
    this.damageFlashOverlay.setDepth(999); // Below health bar but above everything else

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

      // Update health bar if local player was damaged
      if (damageData.victimId === this.playerManager.getLocalPlayerId()) {
        this.localPlayerHealth = damageData.newHealth;
        this.healthBarUI.updateHealth(this.localPlayerHealth, 100);
        this.showDamageFlash();
      }

      // Show damage numbers above damaged player
      this.showDamageNumber(damageData.victimId, damageData.damage);
    });

    // Handle hit confirmation (for hit marker feedback)
    this.wsClient.on('hit:confirmed', (data) => {
      const hitData = data as {
        victimId: string;
        damage: number;
        projectileId: string;
      };
      console.log(`Hit confirmed! Dealt ${hitData.damage} damage to ${hitData.victimId}`);
      this.showHitMarker();
      // TODO: Audio feedback (ding sound) - deferred to audio story
    });

    // Handle player death events
    this.wsClient.on('player:death', (data) => {
      const deathData = data as {
        victimId: string;
        attackerId: string;
      };
      console.log(`Player ${deathData.victimId} was killed by ${deathData.attackerId}`);

      // If local player died, enter spectator mode
      if (deathData.victimId === this.playerManager.getLocalPlayerId()) {
        this.enterSpectatorMode();
      }
    });

    // Handle player kill credit events
    this.wsClient.on('player:kill_credit', (data) => {
      const killData = data as {
        killerId: string;
        victimId: string;
        killerKills: number;
        killerXP: number;
      };
      console.log(`Kill credit: ${killData.killerId} killed ${killData.victimId} (Kills: ${killData.killerKills}, XP: ${killData.killerXP})`);

      // Add kill to feed (using player IDs for now - will be replaced with names later)
      this.killFeedUI.addKill(killData.killerId.substring(0, 8), killData.victimId.substring(0, 8));
    });

    // Handle player respawn events
    this.wsClient.on('player:respawn', (data) => {
      const respawnData = data as {
        playerId: string;
        position: { x: number; y: number };
        health: number;
      };
      console.log(`Player ${respawnData.playerId} respawned at (${respawnData.position.x}, ${respawnData.position.y})`);

      // If local player respawned, exit spectator mode and reset health
      if (respawnData.playerId === this.playerManager.getLocalPlayerId()) {
        this.localPlayerHealth = respawnData.health;
        this.healthBarUI.updateHealth(this.localPlayerHealth, 100);
        this.exitSpectatorMode();
      }
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

    // Update input manager to send player input to server (only when not spectating)
    if (this.inputManager && !this.isSpectating) {
      this.inputManager.update();
    }

    // Update projectiles
    if (this.projectileManager) {
      this.projectileManager.update(this.lastDeltaTime);
    }

    // Update spectator mode
    if (this.isSpectating) {
      this.updateSpectatorMode();
    }
  }

  /**
   * Enter spectator mode when local player dies
   */
  private enterSpectatorMode(): void {
    this.isSpectating = true;
    this.localPlayerDeathTime = Date.now();

    // Create spectator UI
    this.spectatorText = this.add.text(
      ARENA.WIDTH / 2,
      ARENA.HEIGHT / 2 - 50,
      'Spectating...',
      {
        fontSize: '24px',
        color: '#ffffff',
        backgroundColor: '#000000',
        padding: { x: 10, y: 5 },
      }
    );
    this.spectatorText.setOrigin(0.5);

    // Create respawn countdown UI
    this.respawnCountdownText = this.add.text(
      ARENA.WIDTH / 2,
      ARENA.HEIGHT / 2,
      'Respawning in 3...',
      {
        fontSize: '20px',
        color: '#00ff00',
        backgroundColor: '#000000',
        padding: { x: 10, y: 5 },
      }
    );
    this.respawnCountdownText.setOrigin(0.5);
  }

  /**
   * Exit spectator mode when local player respawns
   */
  private exitSpectatorMode(): void {
    this.isSpectating = false;
    this.localPlayerDeathTime = null;

    // Remove spectator UI
    if (this.spectatorText) {
      this.spectatorText.destroy();
      this.spectatorText = null;
    }

    if (this.respawnCountdownText) {
      this.respawnCountdownText.destroy();
      this.respawnCountdownText = null;
    }
  }

  /**
   * Update spectator camera to follow nearest living player
   */
  private updateSpectatorMode(): void {
    // Update respawn countdown
    if (this.respawnCountdownText && this.localPlayerDeathTime) {
      const elapsed = (Date.now() - this.localPlayerDeathTime) / 1000;
      const remaining = Math.max(0, 3 - elapsed);
      this.respawnCountdownText.setText(`Respawning in ${remaining.toFixed(1)}...`);
    }

    // Follow nearest living player with camera
    const livingPlayers = this.playerManager.getLivingPlayers();
    if (livingPlayers.length > 0) {
      // Find nearest living player (excluding self)
      const localPlayerId = this.playerManager.getLocalPlayerId();
      const otherPlayers = livingPlayers.filter(p => p.id !== localPlayerId);

      if (otherPlayers.length > 0) {
        const targetPlayer = otherPlayers[0];
        const camera = this.cameras.main;

        // Smoothly pan camera to target player
        const targetX = targetPlayer.position.x - camera.width / 2;
        const targetY = targetPlayer.position.y - camera.height / 2;

        // Lerp camera position for smooth follow
        const lerpFactor = 0.1;
        camera.scrollX += (targetX - camera.scrollX) * lerpFactor;
        camera.scrollY += (targetY - camera.scrollY) * lerpFactor;

        // Update spectator text to show who we're watching
        if (this.spectatorText) {
          this.spectatorText.setText(`Spectating Player`);
        }
      }
    } else {
      // No living players to spectate
      if (this.spectatorText) {
        this.spectatorText.setText('No players to spectate');
      }
    }
  }

  /**
   * Show floating damage number above damaged player
   */
  private showDamageNumber(victimId: string, damage: number): void {
    const position = this.playerManager.getPlayerPosition(victimId);
    if (!position) {
      return; // Player not found or already removed
    }

    // Create damage number text
    const damageText = this.add.text(
      position.x,
      position.y - 30, // Above player
      `-${damage}`,
      {
        fontSize: '24px',
        color: '#ff0000',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 3,
      }
    );
    damageText.setOrigin(0.5);

    // Animate: float up and fade out
    this.tweens.add({
      targets: damageText,
      y: position.y - 80, // Move up 50 pixels
      alpha: 0, // Fade to transparent
      duration: 1000, // 1 second
      ease: 'Cubic.easeOut',
      onComplete: () => {
        damageText.destroy(); // Clean up after animation
      },
    });
  }

  /**
   * Show red screen flash when local player takes damage
   */
  private showDamageFlash(): void {
    if (!this.damageFlashOverlay) {
      return;
    }

    // Reset alpha to 50% opacity
    this.damageFlashOverlay.setAlpha(0.5);

    // Fade out over 200ms
    this.tweens.add({
      targets: this.damageFlashOverlay,
      alpha: 0,
      duration: 200,
      ease: 'Linear',
    });
  }

  /**
   * Show hit marker (crosshair confirmation) at screen center
   */
  private showHitMarker(): void {
    const camera = this.cameras.main;
    const centerX = camera.scrollX + camera.width / 2;
    const centerY = camera.scrollY + camera.height / 2;
    const lineLength = 15;
    const gap = 10; // Gap from center

    // Create 4 lines forming a crosshair (top, bottom, left, right)
    const lines = [
      // Top line
      this.add.line(
        0, 0,
        centerX, centerY - gap,
        centerX, centerY - gap - lineLength,
        0xffffff
      ),
      // Bottom line
      this.add.line(
        0, 0,
        centerX, centerY + gap,
        centerX, centerY + gap + lineLength,
        0xffffff
      ),
      // Left line
      this.add.line(
        0, 0,
        centerX - gap, centerY,
        centerX - gap - lineLength, centerY,
        0xffffff
      ),
      // Right line
      this.add.line(
        0, 0,
        centerX + gap, centerY,
        centerX + gap + lineLength, centerY,
        0xffffff
      ),
    ];

    // Set high depth so crosshair appears above everything
    lines.forEach(line => {
      line.setDepth(1001);
      line.setLineWidth(3);
    });

    // Animate: expand slightly and fade out, then clean up
    this.tweens.add({
      targets: lines,
      alpha: 0,
      duration: 200,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        // Clean up lines after animation
        lines.forEach(line => line.destroy());
      },
    });
  }
}
