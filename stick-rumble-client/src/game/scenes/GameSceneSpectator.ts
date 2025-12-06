import Phaser from 'phaser';
import type { PlayerManager } from '../entities/PlayerManager';

/**
 * GameSceneSpectator - Manages spectator mode when local player dies
 * Responsibility: Spectator UI, camera following, respawn countdown
 */
export class GameSceneSpectator {
  private scene: Phaser.Scene;
  private playerManager: PlayerManager;
  private isSpectating: boolean = false;
  private localPlayerDeathTime: number | null = null;
  private spectatorText: Phaser.GameObjects.Text | null = null;
  private respawnCountdownText: Phaser.GameObjects.Text | null = null;
  private onStopCameraFollow: () => void;

  constructor(scene: Phaser.Scene, playerManager: PlayerManager, onStopCameraFollow: () => void) {
    this.scene = scene;
    this.playerManager = playerManager;
    this.onStopCameraFollow = onStopCameraFollow;
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
  enterSpectatorMode(): void {
    this.isSpectating = true;
    this.localPlayerDeathTime = Date.now();

    // Stop following local player when dead
    this.onStopCameraFollow();

    // Get camera dimensions for centered positioning
    const camera = this.scene.cameras.main;
    const centerX = camera.width / 2;
    const centerY = camera.height / 2;

    // Create spectator UI (fixed to screen)
    this.spectatorText = this.scene.add.text(
      centerX,
      centerY - 50,
      'Spectating...',
      {
        fontSize: '24px',
        color: '#ffffff',
        backgroundColor: '#000000',
        padding: { x: 10, y: 5 },
      }
    );
    this.spectatorText.setOrigin(0.5);
    this.spectatorText.setScrollFactor(0);
    this.spectatorText.setDepth(1001);

    // Create respawn countdown UI (fixed to screen)
    this.respawnCountdownText = this.scene.add.text(
      centerX,
      centerY,
      'Respawning in 3...',
      {
        fontSize: '20px',
        color: '#00ff00',
        backgroundColor: '#000000',
        padding: { x: 10, y: 5 },
      }
    );
    this.respawnCountdownText.setOrigin(0.5);
    this.respawnCountdownText.setScrollFactor(0);
    this.respawnCountdownText.setDepth(1001);
  }

  /**
   * Exit spectator mode when local player respawns
   */
  exitSpectatorMode(): void {
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
  updateSpectatorMode(): void {
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
        const camera = this.scene.cameras.main;

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
}
