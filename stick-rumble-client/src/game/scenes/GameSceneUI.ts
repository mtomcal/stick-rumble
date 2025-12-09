import Phaser from 'phaser';
import type { ShootingManager } from '../input/ShootingManager';
import type { PlayerManager } from '../entities/PlayerManager';

/**
 * GameSceneUI - Manages all UI elements for the game scene
 * Responsibility: UI rendering, updates, and visual feedback
 */
export class GameSceneUI {
  private scene: Phaser.Scene;
  private ammoText!: Phaser.GameObjects.Text;
  private matchTimerText: Phaser.GameObjects.Text | null = null;
  private damageFlashOverlay: Phaser.GameObjects.Rectangle | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Initialize UI elements (called during scene creation)
   */
  createMatchTimer(x: number, y: number): void {
    this.matchTimerText = this.scene.add.text(x, y, '7:00', {
      fontSize: '24px',
      color: '#ffffff',
      fontStyle: 'bold',
    });
    this.matchTimerText.setOrigin(0.5, 0);
    this.matchTimerText.setScrollFactor(0);
  }

  /**
   * Create damage flash overlay
   */
  createDamageFlashOverlay(width: number, height: number): void {
    this.damageFlashOverlay = this.scene.add.rectangle(
      width / 2,
      height / 2,
      width,
      height,
      0xff0000,
      0 // Fully transparent initially
    );
    this.damageFlashOverlay.setScrollFactor(0);
    this.damageFlashOverlay.setDepth(999);
  }

  /**
   * Create ammo text display
   */
  createAmmoDisplay(x: number, y: number): void {
    this.ammoText = this.scene.add.text(x, y, '15/15', {
      fontSize: '16px',
      color: '#ffffff'
    });
    this.ammoText.setScrollFactor(0);
  }

  /**
   * Update the ammo display text
   */
  updateAmmoDisplay(shootingManager: ShootingManager): void {
    if (this.ammoText && shootingManager) {
      const [current, max] = shootingManager.getAmmoInfo();
      const reloading = shootingManager.isReloading() ? ' [RELOADING]' : '';
      this.ammoText.setText(`${current}/${max}${reloading}`);
    }
  }

  /**
   * Update the match timer display with formatted time (MM:SS)
   */
  updateMatchTimer(remainingSeconds: number): void {
    if (!this.matchTimerText) {
      return;
    }

    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    const formattedTime = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    this.matchTimerText.setText(formattedTime);

    // Change color when time is running out (< 60 seconds)
    if (remainingSeconds < 60) {
      this.matchTimerText.setColor('#ff0000'); // Red
    } else if (remainingSeconds < 120) {
      this.matchTimerText.setColor('#ffff00'); // Yellow
    } else {
      this.matchTimerText.setColor('#ffffff'); // White
    }
  }

  /**
   * Show red screen flash when local player takes damage
   */
  showDamageFlash(): void {
    if (!this.damageFlashOverlay) {
      return;
    }

    // Reset alpha to 50% opacity
    this.damageFlashOverlay.setAlpha(0.5);

    // Fade out over 200ms
    this.scene.tweens.add({
      targets: this.damageFlashOverlay,
      alpha: 0,
      duration: 200,
      ease: 'Linear',
    });
  }

  /**
   * Show hit marker (crosshair confirmation) at screen center
   */
  showHitMarker(): void {
    const camera = this.scene.cameras.main;
    const centerX = camera.scrollX + camera.width / 2;
    const centerY = camera.scrollY + camera.height / 2;
    const lineLength = 15;
    const gap = 10; // Gap from center

    // Create 4 lines forming a crosshair (top, bottom, left, right)
    const lines = [
      // Top line
      this.scene.add.line(
        0, 0,
        centerX, centerY - gap,
        centerX, centerY - gap - lineLength,
        0xffffff
      ),
      // Bottom line
      this.scene.add.line(
        0, 0,
        centerX, centerY + gap,
        centerX, centerY + gap + lineLength,
        0xffffff
      ),
      // Left line
      this.scene.add.line(
        0, 0,
        centerX - gap, centerY,
        centerX - gap - lineLength, centerY,
        0xffffff
      ),
      // Right line
      this.scene.add.line(
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
    this.scene.tweens.add({
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

  /**
   * Show floating damage number above damaged player
   */
  showDamageNumber(playerManager: PlayerManager, victimId: string, damage: number): void {
    const position = playerManager.getPlayerPosition(victimId);
    if (!position) {
      return; // Player not found or already removed
    }

    // Create damage number text
    const damageText = this.scene.add.text(
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
    this.scene.tweens.add({
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
   * Cleanup all resources
   */
  destroy(): void {
    // Destroy UI elements if they exist
    if (this.ammoText) {
      this.ammoText.destroy();
    }
    if (this.matchTimerText) {
      this.matchTimerText.destroy();
    }
    if (this.damageFlashOverlay) {
      this.damageFlashOverlay.destroy();
    }
  }
}
