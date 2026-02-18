import type Phaser from 'phaser';

/**
 * PickupNotificationUI shows a brief center-screen notification when a weapon is picked up
 * Features:
 * - Text: "Picked up {WEAPON_NAME}"
 * - Color: Gray (#AAAAAA)
 * - Font: 18px, centered
 * - Position: Center screen
 * - Animation: Fade out after ~2 seconds (alpha 1.0 → 0.0 over 500ms starting at 1500ms)
 * - Triggered by weapon:pickup_confirmed event
 * - Depth: 1000
 */
export class PickupNotificationUI {
  private scene: Phaser.Scene;
  private text: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;

    this.text = scene.add.text(x, y, '', {
      fontSize: '18px',
      color: '#AAAAAA',
    });

    this.text.setOrigin(0.5, 0.5);
    this.text.setScrollFactor(0);
    this.text.setDepth(1000);
    this.text.setVisible(false);
  }

  /**
   * Show the weapon pickup notification for the given weapon name.
   * Fades out after ~2 seconds.
   */
  show(weaponName: string): void {
    this.text.setText(`Picked up ${weaponName}`);
    this.text.setAlpha(1);
    this.text.setVisible(true);

    // Fade out after 1500ms over 500ms
    this.scene.time.delayedCall(1500, () => {
      this.scene.tweens.add({
        targets: this.text,
        alpha: 0,
        duration: 500,
        onComplete: () => {
          this.text.setVisible(false);
        },
      });
    });
  }

  /**
   * Cleanup all resources
   */
  destroy(): void {
    this.text.destroy();
  }
}
