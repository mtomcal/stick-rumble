import Phaser from 'phaser';

/**
 * HealthBar displays a player's health as a bar above their head
 * Size: 32x4 pixels
 * Colors: Green (health), Gray (background)
 */
export class HealthBar {
  private graphics: Phaser.GameObjects.Graphics;
  private health: number = 100;
  private readonly width: number = 32;
  private readonly height: number = 4;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.graphics = scene.add.graphics();
    this.setPosition(x, y);
    this.draw();
  }

  /**
   * Update health value (0-100) and redraw bar
   */
  setHealth(health: number): void {
    // Clamp health to 0-100 range
    this.health = Math.max(0, Math.min(100, health));
    this.draw();
  }

  /**
   * Get current health value
   */
  getHealth(): number {
    return this.health;
  }

  /**
   * Update position of the health bar
   * Position is centered horizontally above the given coordinates
   */
  setPosition(x: number, y: number): void {
    // Center the bar horizontally by offsetting by half width
    this.graphics.setPosition(x - this.width / 2, y);
  }

  /**
   * Set visibility of the health bar
   */
  setVisible(visible: boolean): void {
    this.graphics.setVisible(visible);
  }

  /**
   * Destroy the health bar graphics
   */
  destroy(): void {
    this.graphics.destroy();
  }

  /**
   * Draw the health bar
   */
  private draw(): void {
    this.graphics.clear();

    // Draw gray background
    this.graphics.fillStyle(0x888888);
    this.graphics.fillRect(0, 0, this.width, this.height);

    // Draw green health fill (proportional to health)
    const healthWidth = (this.health / 100) * this.width;
    this.graphics.fillStyle(0x00ff00);
    this.graphics.fillRect(0, 0, healthWidth, this.height);
  }
}
