import type Phaser from 'phaser';

/**
 * HealthBarUI displays the player's current health in the top-left corner
 * Features:
 * - Green bar for health >60%
 * - Yellow bar for health 30-60%
 * - Red bar for health <30%
 * - Real-time health updates
 * - Fixed to screen (doesn't scroll with camera)
 */
export class HealthBarUI {
  private container: Phaser.GameObjects.Container;
  private healthBar: Phaser.GameObjects.Rectangle;
  private healthText: Phaser.GameObjects.Text;
  private readonly BAR_WIDTH = 200;
  private readonly BAR_HEIGHT = 30;

  constructor(scene: Phaser.Scene, x: number, y: number) {
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
      0x00ff00
    );
    this.healthBar.setOrigin(0, 0);

    // Add health text (centered in bar)
    this.healthText = scene.add.text(5, 5, '100/100', {
      fontSize: '18px',
      color: '#ffffff',
      fontStyle: 'bold',
    });
    this.healthText.setOrigin(0, 0);

    // Add components to container
    this.container.add([background, this.healthBar, this.healthText]);

    // Make health bar fixed to screen (doesn't scroll with camera)
    this.container.setScrollFactor(0);

    // Set high depth so it's always on top
    this.container.setDepth(1000);
  }

  /**
   * Update the health bar display
   * @param currentHealth Current health value
   * @param maxHealth Maximum health value
   */
  updateHealth(currentHealth: number, maxHealth: number): void {
    // Clamp health values
    const health = Math.max(0, Math.min(currentHealth, maxHealth));
    const percentage = maxHealth > 0 ? health / maxHealth : 0;

    // Update bar width
    const barWidth = this.BAR_WIDTH * percentage;
    this.healthBar.setDisplaySize(barWidth, this.BAR_HEIGHT);

    // Update bar color based on health percentage
    if (percentage > 0.6) {
      this.healthBar.fillColor = 0x00ff00; // Green
    } else if (percentage > 0.3) {
      this.healthBar.fillColor = 0xffff00; // Yellow
    } else {
      this.healthBar.fillColor = 0xff0000; // Red
    }

    // Update text
    this.healthText.setText(`${Math.floor(health)}/${maxHealth}`);
  }
}
