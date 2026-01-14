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

  // Weapon recoil shake configuration (Story 3.3 Polish)
  private static readonly RECOIL_DURATION = 100; // 100ms for snappy feel
  private static readonly UZI_RECOIL_INTENSITY = 0.005; // Light recoil
  private static readonly AK47_RECOIL_INTENSITY = 0.007; // Medium recoil
  private static readonly SHOTGUN_RECOIL_INTENSITY = 0.012; // Heavy recoil

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

  /**
   * Trigger screen shake for weapon recoil based on weapon type
   * @param weaponType - Type of weapon fired (uzi, ak47, shotgun)
   */
  shakeOnWeaponFire(weaponType: string): void {
    let intensity: number;

    switch (weaponType.toLowerCase()) {
      case 'uzi':
        intensity = ScreenShake.UZI_RECOIL_INTENSITY;
        break;
      case 'ak47':
        intensity = ScreenShake.AK47_RECOIL_INTENSITY;
        break;
      case 'shotgun':
        intensity = ScreenShake.SHOTGUN_RECOIL_INTENSITY;
        break;
      default:
        // No shake for other weapons (Pistol, Bat, Katana)
        return;
    }

    this.shake(ScreenShake.RECOIL_DURATION, intensity);
  }
}
