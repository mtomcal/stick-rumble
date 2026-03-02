import Phaser from 'phaser';
import { HIT_TRAIL } from '../../shared/constants';
import { getWeaponBarrelTipPosition } from './WeaponGeometry';

/**
 * AimLine (renamed internally to HitConfirmationTrail) draws a temporary white line
 * from the local player's gun barrel to the hit target position.
 *
 * The trail is triggered ONLY by a `hit:confirmed` WebSocket event — it is NOT
 * drawn continuously each frame. Each trail is a transient Graphics object that
 * lingers for HIT_TRAIL.LINGER_DURATION ms, then fades over HIT_TRAIL.FADE_DURATION ms,
 * and is destroyed when complete.
 *
 * Depth: HIT_TRAIL.DEPTH (40) — above arena/projectiles but below player/HUD.
 */
export class AimLine {
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Get the barrel tip position from the rendered weapon origin and aim angle.
   */
  getBarrelPosition(weaponX: number, weaponY: number, aimAngle: number, weaponType: string = 'Pistol'): { x: number; y: number } {
    return getWeaponBarrelTipPosition(weaponX, weaponY, aimAngle, weaponType);
  }

  /**
   * Show a hit confirmation trail from the barrel tip to the target position.
   * Called by the hit:confirmed event handler.
   *
   * @param barrelX - World X of the local player's gun barrel tip
   * @param barrelY - World Y of the local player's gun barrel tip
   * @param targetX - World X of the hit target position
   * @param targetY - World Y of the hit target position
   */
  showTrail(barrelX: number, barrelY: number, targetX: number, targetY: number): void {
    const trail = this.scene.add.graphics();
    trail.lineStyle(HIT_TRAIL.STROKE, HIT_TRAIL.COLOR, 1);
    trail.beginPath();
    trail.moveTo(barrelX, barrelY);
    trail.lineTo(targetX, targetY);
    trail.strokePath();
    trail.setAlpha(HIT_TRAIL.ALPHA);
    trail.setDepth(HIT_TRAIL.DEPTH);

    this.scene.tweens.add({
      targets: trail,
      alpha: 0,
      duration: HIT_TRAIL.FADE_DURATION,
      delay: HIT_TRAIL.LINGER_DURATION,
      onComplete: () => trail.destroy(),
    });
  }

  /**
   * Clean up — nothing to tear down since each trail manages its own lifetime.
   */
  destroy(): void {
    // No persistent graphics objects to clean up.
    // Individual trails are self-destroying via tween onComplete.
  }
}
