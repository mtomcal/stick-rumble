import type Phaser from 'phaser';
import { COLORS } from '../../shared/constants';

/**
 * KillCounterUI displays the player's kill count below the score display
 * Features:
 * - Format: "KILLS: N"
 * - Color: #FF6666 (COLORS.KILL_COUNTER)
 * - ~16px, right-aligned
 * - Fixed to screen (doesn't scroll with camera)
 * - Updated on player:kill_credit events
 * - Depth: 1000
 */
export class KillCounterUI {
  private scene: Phaser.Scene;
  private killText: Phaser.GameObjects.Text;
  private kills = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;

    this.killText = scene.add.text(x, y, 'KILLS: 0', {
      fontSize: '16px',
      color: `#${COLORS.KILL_COUNTER.toString(16).padStart(6, '0')}`,
    });

    // Right-align text
    this.killText.setOrigin(1, 0);

    // Fixed to screen
    this.killText.setScrollFactor(0);

    // High depth to appear above game entities
    this.killText.setDepth(1000);
  }

  /**
   * Increment kill count and update display
   */
  incrementKills(): void {
    this.kills++;
    this.killText.setText(`KILLS: ${this.kills}`);
  }

  /**
   * Get current kill count
   */
  getKills(): number {
    return this.kills;
  }

  /**
   * Cleanup all resources
   */
  destroy(): void {
    this.killText.destroy();
  }
}
