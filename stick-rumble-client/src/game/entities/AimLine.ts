import Phaser from 'phaser';
import { COLORS } from '../../shared/constants';

// Offset from player center to approximate barrel tip
const BARREL_OFFSET = 30;

/**
 * AimLine renders a thin white line from the local player's barrel tip to the
 * cursor position. Drawn every frame (cleared and redrawn). Local player only.
 * Depth 40 — renders above arena/projectiles but below player/HUD.
 */
export class AimLine {
  private scene: Phaser.Scene;
  private graphics: Phaser.GameObjects.Graphics;
  private enabled: boolean = true;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.graphics = scene.add.graphics();
    this.graphics.setDepth(40);
  }

  /**
   * Update the aim line from barrel tip to cursor position.
   * Call every frame from the game scene's update().
   * @param playerX - Local player world X
   * @param playerY - Local player world Y
   * @param aimAngle - Aim angle in radians
   */
  update(playerX: number, playerY: number, aimAngle: number): void {
    this.graphics.clear();

    if (!this.enabled) {
      return;
    }

    const pointer = this.scene.input?.activePointer;
    if (!pointer) {
      return;
    }

    // Barrel tip position
    const barrelX = playerX + Math.cos(aimAngle) * BARREL_OFFSET;
    const barrelY = playerY + Math.sin(aimAngle) * BARREL_OFFSET;

    // Cursor world position
    const cursorX = pointer.worldX ?? (pointer.x + this.scene.cameras.main.scrollX);
    const cursorY = pointer.worldY ?? (pointer.y + this.scene.cameras.main.scrollY);

    // Draw thin white line
    this.graphics.lineStyle(1, COLORS.AIM_LINE, 0.6); // white at 60% alpha
    this.graphics.beginPath();
    this.graphics.moveTo(barrelX, barrelY);
    this.graphics.lineTo(cursorX, cursorY);
    this.graphics.strokePath();
  }

  /**
   * Show or hide the aim line (e.g., hide for melee weapons or spectator mode)
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.graphics.clear();
    }
  }

  /**
   * Get the barrel tip position for the given player position and aim angle.
   * Exposed for testing.
   */
  getBarrelPosition(playerX: number, playerY: number, aimAngle: number): { x: number; y: number } {
    return {
      x: playerX + Math.cos(aimAngle) * BARREL_OFFSET,
      y: playerY + Math.sin(aimAngle) * BARREL_OFFSET,
    };
  }

  /**
   * Clean up graphics resources
   */
  destroy(): void {
    this.graphics.clear();
    this.graphics.destroy();
  }
}
