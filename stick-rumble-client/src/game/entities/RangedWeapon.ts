import * as Phaser from 'phaser';

/**
 * Weapon-specific visual properties
 */
interface WeaponVisuals {
  muzzleFlashColor: number;
  muzzleFlashSize: number;
  muzzleFlashDuration: number; // milliseconds
}

const WEAPON_VISUALS: Record<string, WeaponVisuals> = {
  Uzi: {
    muzzleFlashColor: 0xffaa00,
    muzzleFlashSize: 8,
    muzzleFlashDuration: 50,
  },
  AK47: {
    muzzleFlashColor: 0xffcc00,
    muzzleFlashSize: 12,
    muzzleFlashDuration: 80,
  },
  Shotgun: {
    muzzleFlashColor: 0xff8800,
    muzzleFlashSize: 16,
    muzzleFlashDuration: 100,
  },
};

/**
 * RangedWeapon handles visual effects for ranged weapons (Uzi, AK47, Shotgun)
 */
export class RangedWeapon {
  public readonly weaponType: string;
  private scene: Phaser.Scene;
  private visuals: WeaponVisuals;

  private x: number;
  private y: number;
  private firing: boolean = false;
  private muzzleFlashGraphics: Phaser.GameObjects.Graphics | null = null;
  private muzzleFlashStartTime: number = 0;
  private currentAimAngle: number = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, weaponType: string) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.weaponType = weaponType;
    this.visuals = WEAPON_VISUALS[weaponType] || WEAPON_VISUALS.Uzi;

    // Create graphics object for muzzle flash
    this.muzzleFlashGraphics = scene.add.graphics();
    this.muzzleFlashGraphics.setDepth(150); // Above players
    this.muzzleFlashGraphics.setVisible(false);
  }

  /**
   * Start firing animation
   * Returns false if already firing
   */
  startFiring(aimAngle: number): boolean {
    if (this.firing) {
      return false;
    }

    this.firing = true;
    this.currentAimAngle = aimAngle;
    this.muzzleFlashStartTime = this.scene.time.now;
    this.showMuzzleFlash();

    return true;
  }

  /**
   * Stop firing animation
   */
  stopFiring(): void {
    this.firing = false;
    if (this.muzzleFlashGraphics) {
      this.muzzleFlashGraphics.setVisible(false);
      this.muzzleFlashGraphics.clear();
    }
  }

  /**
   * Check if currently firing
   */
  isFiring(): boolean {
    return this.firing;
  }

  /**
   * Update weapon position (follows player)
   */
  setPosition(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }

  /**
   * Update muzzle flash animation
   */
  update(): void {
    if (!this.firing || !this.muzzleFlashGraphics) {
      return;
    }

    const elapsed = this.scene.time.now - this.muzzleFlashStartTime;

    // Hide muzzle flash after duration
    if (elapsed >= this.visuals.muzzleFlashDuration) {
      this.muzzleFlashGraphics.setVisible(false);
      this.muzzleFlashGraphics.clear();
      return;
    }

    // Update muzzle flash position if it's visible
    if (this.muzzleFlashGraphics.visible) {
      this.showMuzzleFlash();
    }
  }

  /**
   * Render muzzle flash at current position and angle
   */
  private showMuzzleFlash(): void {
    if (!this.muzzleFlashGraphics) {
      return;
    }

    this.muzzleFlashGraphics.clear();
    this.muzzleFlashGraphics.setVisible(true);

    // Calculate muzzle position (offset from player center along aim angle)
    const muzzleOffset = 20; // pixels from center
    const muzzleX = this.x + Math.cos(this.currentAimAngle) * muzzleOffset;
    const muzzleY = this.y + Math.sin(this.currentAimAngle) * muzzleOffset;

    // Draw muzzle flash
    this.muzzleFlashGraphics.fillStyle(this.visuals.muzzleFlashColor, 0.8);
    this.muzzleFlashGraphics.fillCircle(muzzleX, muzzleY, this.visuals.muzzleFlashSize);

    // Add outer glow
    this.muzzleFlashGraphics.fillStyle(this.visuals.muzzleFlashColor, 0.3);
    this.muzzleFlashGraphics.fillCircle(muzzleX, muzzleY, this.visuals.muzzleFlashSize * 1.5);
  }

  /**
   * Trigger a single shot muzzle flash (for shotgun/semi-auto)
   */
  triggerMuzzleFlash(aimAngle: number): void {
    this.currentAimAngle = aimAngle;
    this.muzzleFlashStartTime = this.scene.time.now;
    this.showMuzzleFlash();
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.firing = false;
    if (this.muzzleFlashGraphics) {
      this.muzzleFlashGraphics.destroy();
      this.muzzleFlashGraphics = null;
    }
  }
}
