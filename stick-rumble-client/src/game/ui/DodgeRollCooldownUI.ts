import type Phaser from 'phaser';

/**
 * DodgeRollCooldownUI - Circular cooldown indicator for dodge roll
 *
 * Displays a circular timer showing dodge roll availability:
 * - Gray circle with green progress arc while on cooldown
 * - Solid green circle when ready to dodge
 * - Fixed to screen (bottom-right corner typically)
 */
export class DodgeRollCooldownUI {
  private graphics: Phaser.GameObjects.Graphics;
  private x: number;
  private y: number;
  private radius: number = 20;

  // Visual constants
  private readonly GRAY_COLOR = 0x666666;
  private readonly GREEN_COLOR = 0x00ff00;
  private readonly BACKGROUND_ALPHA = 0.5;
  private readonly PROGRESS_ALPHA = 0.6;
  private readonly READY_ALPHA = 0.8;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.x = x;
    this.y = y;

    // Create graphics object for drawing circular timer
    this.graphics = scene.add.graphics();
    this.graphics.setScrollFactor(0); // Fixed to screen
    this.graphics.setDepth(1000); // High depth for UI visibility
  }

  /**
   * Update cooldown progress display
   * @param progress - Value from 0.0 (just rolled) to 1.0 (ready to roll)
   */
  updateProgress(progress: number): void {
    // Clamp progress to [0, 1]
    progress = Math.max(0, Math.min(1, progress));

    // Clear previous drawing
    this.graphics.clear();

    if (progress >= 1.0) {
      // Ready to dodge - draw solid green circle
      this.graphics.fillStyle(this.GREEN_COLOR, this.READY_ALPHA);
      this.graphics.fillCircle(this.x, this.y, this.radius);
    } else {
      // On cooldown - draw gray background with green progress arc

      // Draw gray background circle
      this.graphics.fillStyle(this.GRAY_COLOR, this.BACKGROUND_ALPHA);
      this.graphics.fillCircle(this.x, this.y, this.radius);

      // Draw green progress arc (clockwise from top)
      // Convert progress (0-1) to radians for arc
      // Start at -90° (top of circle), sweep clockwise
      const startAngle = -Math.PI / 2; // -90° (top)
      const endAngle = startAngle + (progress * Math.PI * 2); // Sweep clockwise

      this.graphics.beginPath();
      this.graphics.arc(this.x, this.y, this.radius, startAngle, endAngle, false);
      this.graphics.closePath();
      this.graphics.fillStyle(this.GREEN_COLOR, this.PROGRESS_ALPHA);
      this.graphics.fillPath();
    }
  }

  /**
   * Cleanup graphics object
   */
  destroy(): void {
    if (this.graphics) {
      this.graphics.destroy();
      // Prevent multiple destroys by clearing reference
      this.graphics = null as unknown as Phaser.GameObjects.Graphics;
    }
  }
}
