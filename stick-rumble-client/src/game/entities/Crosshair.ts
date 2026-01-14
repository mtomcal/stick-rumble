import Phaser from 'phaser';

/**
 * Weapon type for crosshair display
 */
type WeaponType = 'Uzi' | 'AK47' | 'Shotgun' | 'Bat' | 'Katana' | 'Pistol';

/**
 * Weapon-specific spread values (in degrees)
 * Matches server-side SpreadDegrees values
 */
const WEAPON_SPREAD: Record<WeaponType, number> = {
  Uzi: 5.0,      // +/-5° while moving
  AK47: 3.0,     // +/-3° while moving
  Shotgun: 15.0, // Wide cone spread (base pattern)
  Bat: 0,        // Melee weapon, no spread
  Katana: 0,     // Melee weapon, no spread
  Pistol: 2.0,   // Default pistol spread
};

/**
 * Crosshair UI class - HUD element following mouse cursor
 * Shows dynamic spread indicator based on player movement
 */
export class Crosshair {
  private scene: Phaser.Scene;
  private graphics: Phaser.GameObjects.Graphics | null;
  private weaponType: WeaponType = 'Pistol';
  private visible: boolean = true;
  private isSpectating: boolean = false;
  private currentSpreadRadius: number = 0;
  private targetSpreadRadius: number = 0;

  // Visual constants
  private readonly BASE_CROSSHAIR_SIZE = 10; // Size of static crosshair
  private readonly BASE_CROSSHAIR_GAP = 5;   // Gap from center
  private readonly SPREAD_LERP_SPEED = 0.2;  // Smoothing for spread transitions
  private readonly PIXELS_PER_DEGREE = 2;    // Conversion from degrees to pixels

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    // Create graphics for rendering crosshair
    this.graphics = scene.add.graphics();
    this.graphics.setScrollFactor(0); // HUD element - doesn't scroll with camera
    this.graphics.setDepth(1000);     // Above most game elements
  }

  /**
   * Update crosshair position and spread indicator
   * @param isMoving - Whether the player is currently moving
   * @param spreadDegrees - Weapon's spread in degrees (server value)
   */
  update(isMoving: boolean, spreadDegrees: number): void {
    if (!this.graphics || !this.visible) {
      return;
    }

    // Get mouse position relative to camera
    const pointer = this.scene.input?.activePointer;
    if (!pointer) {
      return; // No pointer available yet
    }

    const mouseX = pointer.x;
    const mouseY = pointer.y;

    // Calculate target spread radius based on movement
    if (isMoving) {
      // Use weapon-specific spread when moving
      const weaponSpread = WEAPON_SPREAD[this.weaponType] || spreadDegrees;
      this.targetSpreadRadius = weaponSpread * this.PIXELS_PER_DEGREE;
    } else {
      // No spread when stationary
      this.targetSpreadRadius = 0;
    }

    // Smooth interpolation for spread transitions
    // Linear interpolation: a + (b - a) * t
    this.currentSpreadRadius =
      this.currentSpreadRadius +
      (this.targetSpreadRadius - this.currentSpreadRadius) * this.SPREAD_LERP_SPEED;

    // Clear previous frame
    this.graphics.clear();

    // Draw static crosshair
    this.drawStaticCrosshair(mouseX, mouseY);

    // Draw spread indicator if moving
    if (this.currentSpreadRadius > 1) {
      this.drawSpreadIndicator(mouseX, mouseY);
    }
  }

  /**
   * Draw the base crosshair (white lines)
   */
  private drawStaticCrosshair(x: number, y: number): void {
    if (!this.graphics) return;

    const size = this.BASE_CROSSHAIR_SIZE;
    const gap = this.BASE_CROSSHAIR_GAP;

    this.graphics.lineStyle(2, 0xffffff, 1.0); // White, 2px wide

    // Top line
    this.graphics.beginPath();
    this.graphics.moveTo(x, y - gap);
    this.graphics.lineTo(x, y - gap - size);
    this.graphics.strokePath();

    // Bottom line
    this.graphics.beginPath();
    this.graphics.moveTo(x, y + gap);
    this.graphics.lineTo(x, y + gap + size);
    this.graphics.strokePath();

    // Left line
    this.graphics.beginPath();
    this.graphics.moveTo(x - gap, y);
    this.graphics.lineTo(x - gap - size, y);
    this.graphics.strokePath();

    // Right line
    this.graphics.beginPath();
    this.graphics.moveTo(x + gap, y);
    this.graphics.lineTo(x + gap + size, y);
    this.graphics.strokePath();
  }

  /**
   * Draw spread indicator circle (red when moving)
   */
  private drawSpreadIndicator(x: number, y: number): void {
    if (!this.graphics) return;

    // Red circle showing spread penalty
    this.graphics.lineStyle(2, 0xff0000, 0.6); // Red, semi-transparent
    this.graphics.strokeCircle(x, y, this.currentSpreadRadius + this.BASE_CROSSHAIR_GAP);
  }

  /**
   * Set the current weapon type to adjust spread visualization
   */
  setWeaponType(weaponType: string): void {
    this.weaponType = weaponType as WeaponType;

    // Hide crosshair for melee weapons
    if (weaponType === 'Bat' || weaponType === 'Katana') {
      this.visible = false;
      if (this.graphics) {
        this.graphics.setVisible(false);
      }
    } else {
      // Show crosshair for ranged weapons (if not spectating)
      if (!this.isSpectating) {
        this.visible = true;
        if (this.graphics) {
          this.graphics.setVisible(true);
        }
      }
    }
  }

  /**
   * Show the crosshair
   */
  show(): void {
    this.visible = true;
    if (this.graphics) {
      this.graphics.setVisible(true);
    }
  }

  /**
   * Hide the crosshair
   */
  hide(): void {
    this.visible = false;
    if (this.graphics) {
      this.graphics.setVisible(false);
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
   * Get the current spread radius (for testing)
   */
  getCurrentSpreadRadius(): number {
    return this.currentSpreadRadius;
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.graphics) {
      this.graphics.destroy();
      this.graphics = null;
    }
  }
}
