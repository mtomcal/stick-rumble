import Phaser from 'phaser';
import type { PlayerManager } from '../entities/PlayerManager';

/**
 * GameSceneSpectator - Manages spectator mode when local player dies
 * Responsibility: Death screen overlay, stats display, respawn request, camera following
 */
export class GameSceneSpectator {
  private scene: Phaser.Scene;
  private playerManager: PlayerManager;
  private isSpectating: boolean = false;
  private onStopCameraFollow: () => void;
  private onRespawnRequest: (() => void) | null;

  // Death screen overlay elements
  private overlay: Phaser.GameObjects.Rectangle | null = null;
  private diedText: Phaser.GameObjects.Text | null = null;
  private statsContainer: Phaser.GameObjects.Container | null = null;
  private tryAgainButton: Phaser.GameObjects.Container | null = null;

  constructor(
    scene: Phaser.Scene,
    playerManager: PlayerManager,
    onStopCameraFollow: () => void,
    onRespawnRequest: (() => void) | null = null
  ) {
    this.scene = scene;
    this.playerManager = playerManager;
    this.onStopCameraFollow = onStopCameraFollow;
    this.onRespawnRequest = onRespawnRequest;
  }

  /**
   * Set the respawn request callback after construction
   */
  setOnRespawnRequest(callback: () => void): void {
    this.onRespawnRequest = callback;
  }

  /**
   * Check if currently in spectator mode
   */
  isActive(): boolean {
    return this.isSpectating;
  }

  /**
   * Enter spectator mode when local player dies
   */
  enterSpectatorMode(score = 0, kills = 0): void {
    this.isSpectating = true;

    // Stop following local player when dead
    this.onStopCameraFollow();

    const camera = this.scene.cameras.main;
    const centerX = camera.width / 2;
    const centerY = camera.height / 2;

    // Dark overlay (depth 990, 70% alpha black) over full viewport
    this.overlay = this.scene.add.rectangle(centerX, centerY, camera.width, camera.height, 0x000000, 0.7);
    this.overlay.setScrollFactor(0);
    this.overlay.setDepth(990);

    // "YOU DIED" text: 72px bold white, centered
    this.diedText = this.scene.add.text(centerX, centerY - 100, 'YOU DIED', {
      fontSize: '72px',
      fontStyle: 'bold',
      color: '#FFFFFF',
    });
    this.diedText.setOrigin(0.5);
    this.diedText.setScrollFactor(0);
    this.diedText.setDepth(1000);

    // Stats row: trophy icon (gold circle) + score (red), skull icon (red circle) + kill count (white)
    const statsGraphics = this.scene.add.graphics();

    // Trophy icon (gold circle)
    statsGraphics.fillStyle(0xFFD700, 1);
    statsGraphics.fillCircle(-120, 0, 12);

    // Skull icon (red circle)
    statsGraphics.fillStyle(0xFF0000, 1);
    statsGraphics.fillCircle(20, 0, 12);

    const scoreText = this.scene.add.text(-100, 0, String(score).padStart(6, '0'), {
      fontSize: '24px',
      color: '#FF0000',
    });
    scoreText.setOrigin(0, 0.5);

    const killsText = this.scene.add.text(40, 0, String(kills), {
      fontSize: '24px',
      color: '#FFFFFF',
    });
    killsText.setOrigin(0, 0.5);

    this.statsContainer = this.scene.add.container(centerX, centerY, [statsGraphics, scoreText, killsText]);
    this.statsContainer.setScrollFactor(0);
    this.statsContainer.setDepth(1000);

    // "TRY AGAIN" button: rectangular, thin white border, white text, centered below stats
    const buttonBg = this.scene.add.rectangle(0, 0, 160, 40, 0x000000, 0);
    buttonBg.setStrokeStyle(2, 0xFFFFFF, 1);
    buttonBg.setInteractive({ hitArea: { contains: () => true }, useHandCursor: true });
    buttonBg.on('pointerdown', () => {
      if (this.onRespawnRequest) {
        this.onRespawnRequest();
      }
    });

    const buttonText = this.scene.add.text(0, 0, 'TRY AGAIN', {
      fontSize: '20px',
      color: '#FFFFFF',
    });
    buttonText.setOrigin(0.5);

    this.tryAgainButton = this.scene.add.container(centerX, centerY + 80, [buttonBg, buttonText]);
    this.tryAgainButton.setScrollFactor(0);
    this.tryAgainButton.setDepth(1000);
  }

  /**
   * Exit spectator mode when local player respawns
   */
  exitSpectatorMode(): void {
    this.isSpectating = false;

    if (this.overlay) {
      this.overlay.destroy();
      this.overlay = null;
    }

    if (this.diedText) {
      this.diedText.destroy();
      this.diedText = null;
    }

    if (this.statsContainer) {
      this.statsContainer.destroy();
      this.statsContainer = null;
    }

    if (this.tryAgainButton) {
      this.tryAgainButton.destroy();
      this.tryAgainButton = null;
    }
  }

  /**
   * Update spectator camera to follow nearest living player
   */
  updateSpectatorMode(): void {
    if (!this.isSpectating) return;

    // Follow nearest living player with camera
    const livingPlayers = this.playerManager.getLivingPlayers();
    const localPlayerId = this.playerManager.getLocalPlayerId();
    const otherPlayers = livingPlayers.filter(p => p.id !== localPlayerId);

    if (otherPlayers.length > 0) {
      const targetPlayer = otherPlayers[0];
      const camera = this.scene.cameras.main;

      // Smoothly pan camera to target player
      const targetX = targetPlayer.position.x - camera.width / 2;
      const targetY = targetPlayer.position.y - camera.height / 2;

      // Lerp camera position for smooth follow
      const lerpFactor = 0.1;
      camera.scrollX += (targetX - camera.scrollX) * lerpFactor;
      camera.scrollY += (targetY - camera.scrollY) * lerpFactor;
    }
  }

  /**
   * Cleanup all resources
   */
  destroy(): void {
    this.exitSpectatorMode();
  }
}
