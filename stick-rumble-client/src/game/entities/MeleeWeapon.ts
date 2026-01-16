import Phaser from 'phaser';

/**
 * Weapon stats from server implementation
 */
interface WeaponStats {
  range: number;
  arcDegrees: number;
  color: number;
}

const WEAPON_STATS: Record<string, WeaponStats> = {
  bat: {
    range: 64,
    arcDegrees: 90,
    color: 0x8B4513, // Brown
  },
  katana: {
    range: 80,
    arcDegrees: 90,
    color: 0xC0C0C0, // Silver
  },
};

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
  private swingStartTime: number = 0;
  private swingAimAngle: number = 0;
  private currentFrame: number = 0;

  private static readonly SWING_DURATION = 200; // 0.2s = 200ms
  private static readonly FRAME_COUNT = 4;
  private static readonly FRAME_DURATION = MeleeWeapon.SWING_DURATION / MeleeWeapon.FRAME_COUNT;

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
   * Start a melee swing animation
   * Returns false if already swinging
   */
  startSwing(aimAngle: number): boolean {
    if (this.swinging) {
      return false;
    }

    this.swinging = true;
    this.swingStartTime = this.scene.time.now;
    this.swingAimAngle = aimAngle;
    this.currentFrame = 0;
    this.graphics.setVisible(true);

    return true;
  }

  /**
   * Update swing animation
   */
  update(): void {
    if (!this.swinging) {
      return;
    }

    const elapsed = this.scene.time.now - this.swingStartTime;

    // Check if swing is complete
    if (elapsed >= MeleeWeapon.SWING_DURATION) {
      this.swinging = false;
      this.graphics.setVisible(false);
      this.graphics.clear();
      return;
    }

    // Update current frame
    this.currentFrame = Math.floor(elapsed / MeleeWeapon.FRAME_DURATION);

    // Render swing animation
    this.renderSwingAnimation();
  }

  /**
   * Render the swing animation for current frame
   */
  private renderSwingAnimation(): void {
    this.showSwingAnimation(this.swingAimAngle);
  }

  /**
   * Show swing animation at given aim angle
   * Public for testing
   */
  showSwingAnimation(aimAngle: number): void {
    this.graphics.clear();

    const arcRadians = (this.stats.arcDegrees * Math.PI) / 180;
    const halfArc = arcRadians / 2;

    // Calculate start and end angles for the arc
    const startAngle = aimAngle - halfArc;
    const endAngle = aimAngle + halfArc;

    // Draw swing arc
    this.graphics.lineStyle(3, this.stats.color, 0.8);
    this.graphics.beginPath();
    this.graphics.arc(this.x, this.y, this.stats.range, startAngle, endAngle, false);
    this.graphics.strokePath();

    // Add semi-transparent fill for visual feedback
    this.graphics.fillStyle(this.stats.color, 0.2);
    this.graphics.beginPath();
    this.graphics.moveTo(this.x, this.y);
    this.graphics.arc(this.x, this.y, this.stats.range, startAngle, endAngle, false);
    this.graphics.closePath();
    this.graphics.fillPath();
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
   * Get current animation frame (0-3)
   */
  getCurrentFrame(): number {
    return this.currentFrame;
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
