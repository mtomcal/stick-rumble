import Phaser from 'phaser';

/**
 * ScreenShake handles camera shake effects for visual feedback
 */
export class ScreenShake {
  private camera: Phaser.Cameras.Scene2D.Camera | null;
  private defaultIntensity: number;

  // Bat hit shake configuration
  private static readonly BAT_HIT_DURATION = 150; // 150ms for satisfying thwack
  private static readonly BAT_HIT_INTENSITY = 0.008; // Subtle but noticeable

  constructor(camera: Phaser.Cameras.Scene2D.Camera, defaultIntensity: number = ScreenShake.BAT_HIT_INTENSITY) {
    this.camera = camera;
    this.defaultIntensity = defaultIntensity;
  }

  /**
   * Trigger screen shake for Bat hit
   */
  shakeOnBatHit(): void {
    this.shake(ScreenShake.BAT_HIT_DURATION, this.defaultIntensity);
  }

  /**
   * Trigger custom screen shake
   * @param duration - Duration in milliseconds
   * @param intensity - Shake intensity (typical values: 0.001 - 0.02)
   */
  shake(duration: number, intensity: number): void {
    if (!this.camera) {
      return;
    }

    this.camera.shake(duration, intensity);
  }
}
