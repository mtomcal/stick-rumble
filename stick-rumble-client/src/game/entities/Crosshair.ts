import Phaser from 'phaser';

/**
 * Weapon type for crosshair display
 */
type WeaponType = 'Uzi' | 'AK47' | 'Shotgun' | 'Bat' | 'Katana' | 'Pistol';

// Crosshair display sizes in pixels (sprite texture is 32x32)
const BASE_SIZE = 40;       // Base crosshair size (at rest, not moving)
const EXPANDED_SIZE = 60;   // Expanded when shooting
const MOVING_EXPANDED_SIZE = 80;  // Expanded when moving
const TEXTURE_SIZE = 32;

const BASE_SCALE = BASE_SIZE / TEXTURE_SIZE;
const EXPANDED_SCALE = EXPANDED_SIZE / TEXTURE_SIZE;
const MOVING_EXPANDED_SCALE = MOVING_EXPANDED_SIZE / TEXTURE_SIZE;

const BLOOM_TWEEN_DURATION = 250; // ms for bloom to decay back to base

/**
 * Crosshair UI class using pre-generated reticle texture.
 * Renders a white '+' shape (crosshair) inside a ring.
 * Supports dynamic size bloom on shoot.
 */
export class Crosshair {
  private scene: Phaser.Scene;
  private sprite: Phaser.GameObjects.Sprite | null = null;
  private weaponType: WeaponType = 'Pistol';
  private visible: boolean = true;
  private isSpectating: boolean = false;
  private currentScale: number = BASE_SCALE;
  private bloomTween: Phaser.Tweens.Tween | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    // Generate reticle texture (32x32, once)
    this.generateReticleTexture();

    // Create sprite from generated texture
    this.sprite = scene.add.sprite(0, 0, 'reticle');
    this.sprite.setScrollFactor(0);
    this.sprite.setDepth(100);
    this.sprite.setAlpha(0.8);
    this.sprite.setScale(BASE_SCALE);
  }

  /**
   * Generate the reticle texture: ring + white '+' cross
   */
  private generateReticleTexture(): void {
    const gfx = this.scene.make.graphics({ x: 0, y: 0 }, false);

    // White ring (radius 10, 2px stroke)
    gfx.lineStyle(2, 0xffffff, 1);
    gfx.strokeCircle(16, 16, 10);

    // White '+' cross lines
    gfx.beginPath();
    gfx.moveTo(16, 6); gfx.lineTo(16, 26);  // Vertical bar
    gfx.moveTo(6, 16); gfx.lineTo(26, 16);  // Horizontal bar
    gfx.strokePath();

    gfx.generateTexture('reticle', 32, 32);
    gfx.destroy();
  }

  /**
   * Update crosshair position and size each frame.
   * @param isMoving - Whether the player is currently moving
   * @param spreadDegrees - Current weapon spread in degrees
   */
  update(isMoving: boolean, spreadDegrees: number): void {
    if (!this.sprite || !this.visible) {
      return;
    }

    const pointer = this.scene.input?.activePointer;
    if (!pointer) {
      return;
    }

    this.sprite.setPosition(pointer.x, pointer.y);

    // Adjust scale based on movement and spread (only if not mid-bloom)
    if (!this.bloomTween || !this.bloomTween.isPlaying()) {
      let targetScale: number;
      if (isMoving) {
        // Expand more when moving
        const movementFactor = Math.min(1, spreadDegrees / 10);
        targetScale = BASE_SCALE + (MOVING_EXPANDED_SCALE - BASE_SCALE) * movementFactor;
      } else {
        // Expand based on spread
        const spreadFactor = Math.min(1, spreadDegrees / 10);
        targetScale = BASE_SCALE + (EXPANDED_SCALE - BASE_SCALE) * spreadFactor;
      }
      this.currentScale = targetScale;
      this.sprite.setScale(this.currentScale);
    }
  }

  /**
   * Trigger bloom animation: snap to expanded size, tween back to base.
   * Called when a projectile is spawned for the local player.
   */
  triggerBloom(): void {
    if (!this.sprite) {
      return;
    }

    // Stop any existing bloom tween
    if (this.bloomTween) {
      this.bloomTween.stop();
      this.bloomTween = null;
    }

    // Snap to expanded size
    const expandedScale = this.currentScale > BASE_SCALE ? MOVING_EXPANDED_SCALE : EXPANDED_SCALE;
    this.sprite.setScale(expandedScale);

    // Tween back to base scale
    this.bloomTween = this.scene.tweens.add({
      targets: this.sprite,
      scaleX: BASE_SCALE,
      scaleY: BASE_SCALE,
      duration: BLOOM_TWEEN_DURATION,
      ease: 'Sine.easeOut',
      onComplete: () => {
        this.bloomTween = null;
        this.currentScale = BASE_SCALE;
      },
    });
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
   * Get the current spread radius in pixels (half of current display size)
   */
  getCurrentSpreadRadius(): number {
    return (this.currentScale * TEXTURE_SIZE) / 2;
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.bloomTween) {
      this.bloomTween.stop();
      this.bloomTween = null;
    }
    if (this.sprite) {
      this.sprite.destroy();
      this.sprite = null;
    }
  }
}
