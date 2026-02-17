import Phaser from 'phaser';

/**
 * Weapon type for crosshair display
 */
type WeaponType = 'Uzi' | 'AK47' | 'Shotgun' | 'Bat' | 'Katana' | 'Pistol';

/**
 * Crosshair UI class using pre-generated reticle texture.
 * Renders a ring with cardinal tick marks and red center dot.
 * No dynamic spread circle.
 */
export class Crosshair {
  private scene: Phaser.Scene;
  private sprite: Phaser.GameObjects.Sprite | null = null;
  private weaponType: WeaponType = 'Pistol';
  private visible: boolean = true;
  private isSpectating: boolean = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    // Generate reticle texture (32x32, once)
    this.generateReticleTexture();

    // Create sprite from generated texture
    this.sprite = scene.add.sprite(0, 0, 'reticle');
    this.sprite.setScrollFactor(0);
    this.sprite.setDepth(100);
    this.sprite.setAlpha(0.8);
  }

  /**
   * Generate the reticle texture: ring + 4 cardinal ticks + red center dot
   */
  private generateReticleTexture(): void {
    const gfx = this.scene.make.graphics({ x: 0, y: 0 }, false);

    // White ring (radius 10, 2px stroke)
    gfx.lineStyle(2, 0xffffff, 1);
    gfx.strokeCircle(16, 16, 10);

    // Cardinal tick marks (6px each)
    gfx.beginPath();
    gfx.moveTo(16, 2); gfx.lineTo(16, 8);   // Top tick
    gfx.moveTo(16, 24); gfx.lineTo(16, 30); // Bottom tick
    gfx.moveTo(2, 16); gfx.lineTo(8, 16);   // Left tick
    gfx.moveTo(24, 16); gfx.lineTo(30, 16); // Right tick
    gfx.strokePath();

    // Red center dot (radius 2)
    gfx.fillStyle(0xff0000, 1);
    gfx.fillCircle(16, 16, 2);

    gfx.generateTexture('reticle', 32, 32);
    gfx.destroy();
  }

  /**
   * Update crosshair position each frame.
   * @param _isMoving - Unused (spread removed)
   * @param _spreadDegrees - Unused (spread removed)
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  update(_isMoving: boolean, _spreadDegrees: number): void {
    if (!this.sprite || !this.visible) {
      return;
    }

    const pointer = this.scene.input?.activePointer;
    if (!pointer) {
      return;
    }

    this.sprite.setPosition(pointer.x, pointer.y);
  }

  /**
   * Set the current weapon type to adjust visibility
   */
  setWeaponType(weaponType: string): void {
    this.weaponType = weaponType as WeaponType;

    // Hide crosshair for melee weapons
    if (weaponType === 'Bat' || weaponType === 'Katana') {
      this.visible = false;
      if (this.sprite) {
        this.sprite.setVisible(false);
      }
    } else {
      // Show crosshair for ranged weapons (if not spectating)
      if (!this.isSpectating) {
        this.visible = true;
        if (this.sprite) {
          this.sprite.setVisible(true);
        }
      }
    }
  }

  /**
   * Show the crosshair
   */
  show(): void {
    this.visible = true;
    if (this.sprite) {
      this.sprite.setVisible(true);
    }
  }

  /**
   * Hide the crosshair
   */
  hide(): void {
    this.visible = false;
    if (this.sprite) {
      this.sprite.setVisible(false);
    }
  }

  /**
   * Set spectating mode (hides crosshair)
   */
  setSpectating(isSpectating: boolean): void {
    this.isSpectating = isSpectating;

    if (isSpectating) {
      this.hide();
    } else {
      // Only show if not a melee weapon
      if (this.weaponType !== 'Bat' && this.weaponType !== 'Katana') {
        this.show();
      }
    }
  }

  /**
   * Check if crosshair is visible
   */
  isVisible(): boolean {
    return this.visible;
  }

  /**
   * Get the current weapon type (for testing)
   */
  getWeaponType(): WeaponType {
    return this.weaponType;
  }

  /**
   * Get the current spread radius (always 0, spread removed)
   */
  getCurrentSpreadRadius(): number {
    return 0;
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.sprite) {
      this.sprite.destroy();
      this.sprite = null;
    }
  }
}
