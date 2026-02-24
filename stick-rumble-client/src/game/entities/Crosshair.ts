import Phaser from 'phaser';

/**
 * Crosshair renders a fixed-size ⊕ reticle (~20-25px) at the mouse cursor position.
 *
 * Visual: white outer circle (radius 10, 1.5px stroke, alpha 0.8) with a white "+"
 * cross shape inside (±6px, 2px stroke). The reticle is a pre-generated 32×32 texture.
 *
 * Spec requirements (TS-GFX-023):
 * - Fixed compact size — NO bloom, NO expansion during firing, NO spread visualization
 * - Hidden for melee weapons (Bat, Katana)
 * - Depth: 100, alpha: 0.8
 * - Positioned at exact mouse cursor position (scrollFactor = 0)
 */
export class Crosshair {
  private scene: Phaser.Scene;
  private sprite: Phaser.GameObjects.Sprite | null = null;
  private weaponType: string = 'Pistol';
  private visible: boolean = true;
  private isSpectating: boolean = false;
  // Tracks whether visibility was hidden due to melee weapon (vs explicit hide() call)
  private hiddenByMelee: boolean = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    this.generateReticleTexture();

    this.sprite = scene.add.sprite(0, 0, 'reticle');
    this.sprite.setScrollFactor(0);
    this.sprite.setDepth(100);
    this.sprite.setAlpha(0.8);
  }

  /**
   * Generate the reticle texture: ring + white '+' cross (32×32, generated once)
   */
  private generateReticleTexture(): void {
    const gfx = this.scene.make.graphics({ x: 0, y: 0 }, false);

    gfx.lineStyle(2, 0xffffff, 1);
    gfx.strokeCircle(16, 16, 10);

    gfx.beginPath();
    gfx.moveTo(16, 6); gfx.lineTo(16, 26);
    gfx.moveTo(6, 16); gfx.lineTo(26, 16);
    gfx.strokePath();

    gfx.generateTexture('reticle', 32, 32);
    gfx.destroy();
  }

  /**
   * Update crosshair position each frame.
   * weaponType is used only to control visibility (melee = hidden).
   * There is NO dynamic scaling — the reticle stays at its fixed compact size.
   *
   * @param weaponType - Current weapon type (for melee check)
   */
  update(weaponType: string): void {
    if (!this.sprite) {
      return;
    }

    this.setWeaponType(weaponType);

    if (!this.visible) {
      return;
    }

    const pointer = this.scene.input?.activePointer;
    if (!pointer) {
      return;
    }

    this.sprite.setPosition(pointer.x, pointer.y);
  }

  /**
   * Set the current weapon type to adjust visibility.
   * Hidden for melee weapons (Bat, Katana).
   * Ranged weapons only restore visibility if previously hidden by melee switch.
   * Explicit hide() calls are preserved across weapon type changes.
   */
  setWeaponType(weaponType: string): void {
    this.weaponType = weaponType;

    const isMelee = weaponType === 'Bat' || weaponType === 'bat' ||
                    weaponType === 'Katana' || weaponType === 'katana';

    if (isMelee) {
      this.hiddenByMelee = true;
      this.visible = false;
      if (this.sprite) {
        this.sprite.setVisible(false);
      }
    } else if (this.hiddenByMelee && !this.isSpectating) {
      // Restore only if the hide was melee-triggered (not from explicit hide())
      this.hiddenByMelee = false;
      this.visible = true;
      if (this.sprite) {
        this.sprite.setVisible(true);
      }
    }
  }

  /**
   * Show the crosshair
   */
  show(): void {
    this.hiddenByMelee = false;
    this.visible = true;
    if (this.sprite) {
      this.sprite.setVisible(true);
    }
  }

  /**
   * Hide the crosshair (explicit override — persists across weapon type changes)
   */
  hide(): void {
    this.hiddenByMelee = false; // Explicit hide, not melee-triggered
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
      const isMelee = this.weaponType === 'Bat' || this.weaponType === 'bat' ||
                      this.weaponType === 'Katana' || this.weaponType === 'katana';
      if (!isMelee) {
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
  getWeaponType(): string {
    return this.weaponType;
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
