import type Phaser from 'phaser';
import { COLORS } from '../../shared/constants';

/**
 * ScoreDisplayUI displays the player's current score in the top-right corner
 * Features:
 * - 6-digit zero-padded format (e.g., "001250")
 * - Monospaced ~28px, white (COLORS.SCORE)
 * - Fixed to screen (doesn't scroll with camera)
 * - Updated on player:kill_credit events (killerXP = score)
 * - Depth: 1000
 */
export class ScoreDisplayUI {
  private scoreText: Phaser.GameObjects.Text;
  private score = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scoreText = scene.add.text(x, y, '000000', {
      fontSize: '28px',
      fontFamily: 'monospace',
      color: `#${COLORS.SCORE.toString(16).padStart(6, '0')}`,
    });

    // Right-align text
    this.scoreText.setOrigin(1, 0);

    // Fixed to screen
    this.scoreText.setScrollFactor(0);

    // High depth to appear above game entities
    this.scoreText.setDepth(1000);
  }

  /**
   * Update the score display
   * @param killerXP XP value from player:kill_credit event (becomes the score)
   */
  setScore(score: number): void {
    this.score = score;
    this.scoreText.setText(String(this.score).padStart(6, '0'));
  }

  updateScore(killerXP: number): void {
    this.setScore(killerXP);
  }

  /**
   * Get current score value
   */
  getScore(): number {
    return this.score;
  }

  setPosition(x: number, y: number): void {
    this.scoreText.setPosition(x, y);
  }

  setScale(scale: number): void {
    this.scoreText.setScale(scale);
  }

  /**
   * Cleanup all resources
   */
  destroy(): void {
    this.scoreText.destroy();
  }
}
