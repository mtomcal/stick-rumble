import Phaser from 'phaser';

/**
 * ProceduralPlayerGraphics renders stick figure characters using procedural graphics
 * following the prototype pattern from StickFigure.ts (lines 297-388)
 *
 * Features:
 * - Stick figure with head, arms, legs
 * - Walk cycle animation using sine waves
 * - Color customization
 * - Rotation support for direction
 */
export class ProceduralPlayerGraphics {
  // @ts-expect-error - Scene kept for future weapon attachment support
  private scene: Phaser.Scene;
  private graphics: Phaser.GameObjects.Graphics;
  private x: number;
  private y: number;
  private rotation: number = 0;
  private color: number;
  private walkCycle: number = 0;

  // Animation constants (from prototype)
  private static readonly WALK_SPEED_FACTOR = 0.02;

  constructor(scene: Phaser.Scene, x: number, y: number, color: number) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.color = color;

    // Create graphics object
    this.graphics = scene.add.graphics();
    this.graphics.setDepth(50); // Render below UI but above background

    // Initial draw
    this.draw();
  }

  /**
   * Draw the stick figure
   * Based on StickFigure.ts lines 297-388
   */
  private draw(): void {
    this.graphics.clear();

    const cx = this.x;
    const cy = this.y;
    const rot = this.rotation;

    // Helper to rotate points around center
    const calcPoint = (localX: number, localY: number) => {
      return {
        x: cx + (localX * Math.cos(rot) - localY * Math.sin(rot)),
        y: cy + (localX * Math.sin(rot) + localY * Math.cos(rot)),
      };
    };

    // --- LEGS ---
    this.graphics.lineStyle(3, this.color, 1);

    const stride = 16;
    const footSideOffset = 8;

    const leftLegProgress = Math.sin(this.walkCycle);
    const rightLegProgress = Math.sin(this.walkCycle + Math.PI);

    const leftFootPos = calcPoint(leftLegProgress * stride, -footSideOffset);
    const rightFootPos = calcPoint(rightLegProgress * stride, footSideOffset);

    // Draw left leg
    this.graphics.beginPath();
    this.graphics.moveTo(cx, cy);
    this.graphics.lineTo(leftFootPos.x, leftFootPos.y);
    this.graphics.strokePath();

    // Draw right leg
    this.graphics.beginPath();
    this.graphics.moveTo(cx, cy);
    this.graphics.lineTo(rightFootPos.x, rightFootPos.y);
    this.graphics.strokePath();

    // Draw feet
    this.graphics.fillStyle(this.color, 1);
    this.graphics.fillCircle(leftFootPos.x, leftFootPos.y, 3);
    this.graphics.fillCircle(rightFootPos.x, rightFootPos.y, 3);

    // --- ARMS ---
    // Default arm positions (can be adjusted based on weapon type in future)
    const leftHandX = 20;
    const rightHandX = 20;
    const leftHandY = -3;
    const rightHandY = 3;

    const leftHandPos = calcPoint(leftHandX, leftHandY);
    const rightHandPos = calcPoint(rightHandX, rightHandY);

    this.graphics.lineStyle(2, this.color, 1);

    // Draw left arm
    this.graphics.beginPath();
    this.graphics.moveTo(cx, cy);
    this.graphics.lineTo(leftHandPos.x, leftHandPos.y);
    this.graphics.strokePath();

    // Draw right arm
    this.graphics.beginPath();
    this.graphics.moveTo(cx, cy);
    this.graphics.lineTo(rightHandPos.x, rightHandPos.y);
    this.graphics.strokePath();

    // Draw hands
    this.graphics.fillCircle(leftHandPos.x, leftHandPos.y, 3);
    this.graphics.fillCircle(rightHandPos.x, rightHandPos.y, 3);

    // --- HEAD ---
    this.graphics.fillStyle(this.color, 1);
    this.graphics.fillCircle(cx, cy, 13);
    this.graphics.lineStyle(1, 0x000000, 0.3);
    this.graphics.strokeCircle(cx, cy, 13);
  }

  /**
   * Update animation state
   * @param delta Delta time in milliseconds
   * @param isMoving Whether the player is moving
   */
  update(delta: number, isMoving: boolean): void {
    // Update walk cycle based on movement
    if (isMoving) {
      this.walkCycle += delta * ProceduralPlayerGraphics.WALK_SPEED_FACTOR;
    } else {
      this.walkCycle = 0; // Reset when idle
    }

    // Redraw with updated animation
    this.draw();
  }

  /**
   * Set position
   */
  setPosition(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.draw();
  }

  /**
   * Get position
   */
  getPosition(): { x: number; y: number } {
    return { x: this.x, y: this.y };
  }

  /**
   * Set rotation
   */
  setRotation(rotation: number): void {
    this.rotation = rotation;
    this.draw();
  }

  /**
   * Get rotation
   */
  getRotation(): number {
    return this.rotation;
  }

  /**
   * Set color
   */
  setColor(color: number): void {
    this.color = color;
    this.draw();
  }

  /**
   * Set visibility
   */
  setVisible(visible: boolean): void {
    this.graphics.setVisible(visible);
  }

  /**
   * Get visibility
   */
  getVisible(): boolean {
    return this.graphics.visible;
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.graphics) {
      this.graphics.destroy();
    }
  }
}
