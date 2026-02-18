import type Phaser from 'phaser';
import { COLORS } from '../../shared/constants';

/**
 * HealthBarUI displays the player's current health in the top-left corner
 * Features:
 * - Green bar for health >= 20% (COLORS.HEALTH_FULL)
 * - Red bar for health < 20% (COLORS.HEALTH_CRITICAL)
 * - "N%" format text display
 * - EKG heartbeat icon to the left of the bar
 * - Real-time health updates
 * - Fixed to screen (doesn't scroll with camera)
 */
export class HealthBarUI {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private healthBar: Phaser.GameObjects.Rectangle;
  private healthText: Phaser.GameObjects.Text;
  private ekgIcon: Phaser.GameObjects.Graphics;
  private readonly BAR_WIDTH = 200;
  private readonly BAR_HEIGHT = 30;
  private isRegenerating: boolean = false;
  private pulseTween: Phaser.Tweens.Tween | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;
    // Create container for health bar components
    this.container = scene.add.container(x, y);

    // Add background (black with opacity)
    const background = scene.add.rectangle(
      0,
      0,
      this.BAR_WIDTH + 4,
      this.BAR_HEIGHT + 4,
      0x000000,
      0.7
    );
    background.setOrigin(0, 0);

    // Add health bar (green by default)
    this.healthBar = scene.add.rectangle(
      2,
      2,
      this.BAR_WIDTH,
      this.BAR_HEIGHT,
      COLORS.HEALTH_FULL
    );
    this.healthBar.setOrigin(0, 0);

    // Add EKG heartbeat icon to the left of the bar
    this.ekgIcon = scene.add.graphics();
    this.drawEKGIcon();

    // Add health text (percentage format)
    this.healthText = scene.add.text(5, 5, '100%', {
      fontSize: '18px',
      color: '#ffffff',
      fontStyle: 'bold',
    });
    this.healthText.setOrigin(0, 0);

    // Add components to container
    this.container.add([background, this.healthBar, this.ekgIcon, this.healthText]);

    // Make health bar fixed to screen (doesn't scroll with camera)
    this.container.setScrollFactor(0);

    // Set high depth so it's always on top
    this.container.setDepth(1000);
  }

  /**
   * Draw EKG heartbeat icon graphic to the left of the bar
   */
  private drawEKGIcon(): void {
    this.ekgIcon.clear();
    this.ekgIcon.lineStyle(2, COLORS.HEALTH_FULL, 1);
    // Simple EKG waveform: flat, spike up, spike down, flat
    // Positioned to the left of the bar (negative x offset)
    this.ekgIcon.beginPath();
    this.ekgIcon.moveTo(-28, 17);
    this.ekgIcon.lineTo(-22, 17);
    this.ekgIcon.lineTo(-19, 8);
    this.ekgIcon.lineTo(-16, 26);
    this.ekgIcon.lineTo(-13, 5);
    this.ekgIcon.lineTo(-10, 17);
    this.ekgIcon.lineTo(-4, 17);
    this.ekgIcon.strokePath();
  }

  /**
   * Update the health bar display
   * @param currentHealth Current health value
   * @param maxHealth Maximum health value
   * @param isRegenerating Whether health is currently regenerating
   */
  updateHealth(currentHealth: number, maxHealth: number, isRegenerating: boolean = false): void {
    // Clamp health values
    const health = Math.max(0, Math.min(currentHealth, maxHealth));
    const ratio = maxHealth > 0 ? health / maxHealth : 0;

    // Update bar width
    const barWidth = this.BAR_WIDTH * ratio;
    this.healthBar.setDisplaySize(barWidth, this.BAR_HEIGHT);

    // 2-tier color logic: green >= 20%, red < 20%
    if (ratio >= 0.2) {
      this.healthBar.fillColor = COLORS.HEALTH_FULL; // Green
    } else {
      this.healthBar.fillColor = COLORS.HEALTH_CRITICAL; // Red
    }

    // Update text in percentage format
    this.healthText.setText(`${Math.round(ratio * 100)}%`);

    // Handle regeneration visual feedback
    if (isRegenerating && !this.isRegenerating) {
      // Start regeneration animation
      this.startRegenerationEffect();
    } else if (!isRegenerating && this.isRegenerating) {
      // Stop regeneration animation
      this.stopRegenerationEffect();
    }

    this.isRegenerating = isRegenerating;
  }

  /**
   * Start pulsing animation to indicate health regeneration
   * Note: This method is only called when transitioning from not regenerating to regenerating,
   * so pulseTween should always be null. The guard at updateHealth() prevents duplicate calls.
   */
  private startRegenerationEffect(): void {
    // Create pulsing alpha effect (0.6 to 1.0 and back)
    this.pulseTween = this.scene.tweens.add({
      targets: this.healthBar,
      alpha: 0.6,
      duration: 500,
      yoyo: true,
      repeat: -1, // Infinite repeat
      ease: 'Sine.easeInOut',
    });
  }

  /**
   * Stop the regeneration animation
   */
  private stopRegenerationEffect(): void {
    if (this.pulseTween) {
      this.pulseTween.stop();
      this.pulseTween = null;
    }
    // Reset alpha to full opacity
    this.healthBar.setAlpha(1.0);
  }

  /**
   * Cleanup all resources
   */
  destroy(): void {
    // Stop any active regeneration effect
    this.stopRegenerationEffect();

    // Destroy container (automatically destroys all children)
    this.container.destroy();
  }
}
