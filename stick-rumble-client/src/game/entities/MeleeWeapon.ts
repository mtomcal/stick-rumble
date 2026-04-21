import Phaser from 'phaser';
import { MELEE } from '../../shared/constants';
import { getFirstBlockingObstacleContact, type MapObstacle } from '../../shared/maps';

/**
 * Weapon stats from server implementation
 */
interface WeaponStats {
  range: number;
  arcDegrees: number;
}

const WEAPON_STATS: Record<string, WeaponStats> = {
  bat: {
    range: 90,
    arcDegrees: 80,
  },
  katana: {
    range: 110,
    arcDegrees: 80,
  },
};

// Melee arc visual constants (all weapons use the same style)
const ARC_COLOR = 0xFFFFFF;
const ARC_STROKE_WIDTH = 2;
const ARC_STROKE_ALPHA = 0.8;
const ARC_FADE_DURATION = 200;
const SWING_ANGLE_FROM = -45;
const SWING_ANGLE_TO = 60;
const SWING_DURATION = 100;
const ARC_SAMPLES = 16;

/**
 * MeleeWeapon handles visual rendering of melee weapon swing animations
 */
export class MeleeWeapon {
  public readonly weaponType: string;
  private scene: Phaser.Scene;
  private graphics: Phaser.GameObjects.Graphics;
  private stats: WeaponStats;

  private x: number;
  private y: number;
  private swinging: boolean = false;

  constructor(scene: Phaser.Scene, x: number, y: number, weaponType: string) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.weaponType = weaponType;
    this.stats = WEAPON_STATS[weaponType.toLowerCase()] || WEAPON_STATS.bat;

    // Create graphics object for rendering swing arc
    this.graphics = scene.add.graphics();
    this.graphics.setDepth(100); // Render above players
    this.graphics.setVisible(false);
  }

  /**
   * Start a melee swing animation with alpha fade tween
   * Returns false if already swinging
   */
  startSwing(aimAngle: number, weaponContainer?: Phaser.GameObjects.Container, obstacles?: readonly MapObstacle[]): boolean {
    if (this.swinging) {
      return false;
    }

    this.swinging = true;
    this.graphics.setVisible(true);
    this.graphics.setAlpha(1);

    // Render the arc
    this.showSwingAnimation(aimAngle, obstacles);

    // Alpha fade tween on the arc graphics
    this.scene.tweens.add({
      targets: this.graphics,
      alpha: 0,
      duration: ARC_FADE_DURATION,
      onComplete: () => {
        this.swinging = false;
        this.graphics.setVisible(false);
        this.graphics.clear();
      },
    });

    // Weapon container rotation tween (swing visual)
    if (weaponContainer) {
      this.scene.tweens.add({
        targets: weaponContainer,
        angle: { from: weaponContainer.angle + SWING_ANGLE_FROM, to: weaponContainer.angle + SWING_ANGLE_TO },
        duration: SWING_DURATION,
        yoyo: true,
      });
    }

    return true;
  }

  /**
   * Show swing animation at given aim angle — white stroke-only arc
   * Public for testing
   */
  showSwingAnimation(aimAngle: number, obstacles?: readonly MapObstacle[]): void {
    this.graphics.clear();

    const arcRadians = (this.stats.arcDegrees * Math.PI) / 180;
    const halfArc = arcRadians / 2;

    // Calculate start and end angles for the arc
    const startAngle = aimAngle - halfArc;
    const endAngle = aimAngle + halfArc;

    // Draw swing arc — stroke only, white for all weapons
    this.graphics.lineStyle(ARC_STROKE_WIDTH, ARC_COLOR, ARC_STROKE_ALPHA);

    if (obstacles && obstacles.length > 0) {
      // Polyline approximation with per-angle obstacle clipping
      this.graphics.beginPath();
      const step = arcRadians / ARC_SAMPLES;
      for (let i = 0; i <= ARC_SAMPLES; i++) {
        const angle = startAngle + step * i;
        const rayEndX = this.x + Math.cos(angle) * this.stats.range;
        const rayEndY = this.y + Math.sin(angle) * this.stats.range;
        const contact = getFirstBlockingObstacleContact(
          { x: this.x, y: this.y },
          { x: rayEndX, y: rayEndY },
          obstacles
        );
        const effectiveRadius = contact
          ? Math.max(contact.distance, MELEE.ARC_MIN_VISIBLE_LENGTH)
          : this.stats.range;
        const px = this.x + Math.cos(angle) * effectiveRadius;
        const py = this.y + Math.sin(angle) * effectiveRadius;
        if (i === 0) {
          this.graphics.moveTo(px, py);
        } else {
          this.graphics.lineTo(px, py);
        }
      }
      this.graphics.strokePath();
    } else {
      // Backward-compatible single arc call when no obstacles provided
      this.graphics.beginPath();
      this.graphics.arc(this.x, this.y, this.stats.range, startAngle, endAngle, false);
      this.graphics.strokePath();
    }
  }

  /**
   * Update — no-op since animations are now tween-based
   */
  update(): void {
    // Animations handled by Phaser tweens, no per-frame logic needed
  }

  /**
   * Set weapon position (follows player)
   */
  setPosition(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }

  /**
   * Check if currently swinging
   */
  isSwinging(): boolean {
    return this.swinging;
  }

  /**
   * Get weapon range
   */
  getRange(): number {
    return this.stats.range;
  }

  /**
   * Get weapon arc in degrees
   */
  getArcDegrees(): number {
    return this.stats.arcDegrees;
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.swinging = false;
    if (this.graphics) {
      this.graphics.destroy();
    }
  }
}
