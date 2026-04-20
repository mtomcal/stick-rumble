import Phaser from 'phaser';

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

type SwingPhase = 'idle' | 'preview' | 'confirmed';

interface SwingStyle {
  color: number;
  width: number;
  alpha: number;
  fadeDuration: number;
  radiusMultiplier: number;
}

const PREVIEW_STYLES: Record<string, SwingStyle> = {
  bat: { color: 0xf6d365, width: 4, alpha: 0.4, fadeDuration: 90, radiusMultiplier: 0.72 },
  katana: { color: 0xb8f2ff, width: 3, alpha: 0.35, fadeDuration: 80, radiusMultiplier: 0.88 },
};

const CONFIRMED_STYLES: Record<string, SwingStyle> = {
  bat: { color: 0xfff2bf, width: 7, alpha: 0.85, fadeDuration: 150, radiusMultiplier: 1 },
  katana: { color: 0xf4fbff, width: 5, alpha: 0.92, fadeDuration: 130, radiusMultiplier: 1.08 },
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
  private swingPhase: SwingPhase = 'idle';
  private animationToken = 0;
  private activeAimAngle: number | null = null;
  private activeStyle: SwingStyle | null = null;
  private activeTween: Phaser.Tweens.Tween | null = null;

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
   * Start a harmless local preview motion.
   */
  startPreviewSwing(aimAngle: number): boolean {
    if (this.swingPhase !== 'idle') {
      return false;
    }

    this.swingPhase = 'preview';
    this.playSwingAnimation(aimAngle, PREVIEW_STYLES[this.weaponType.toLowerCase()] || PREVIEW_STYLES.bat);
    return true;
  }

  /**
   * Start or upgrade to the authoritative confirmed swing motion.
   */
  confirmSwing(aimAngle: number): boolean {
    if (this.swingPhase === 'confirmed') {
      return false;
    }

    this.swingPhase = 'confirmed';
    this.playSwingAnimation(aimAngle, CONFIRMED_STYLES[this.weaponType.toLowerCase()] || CONFIRMED_STYLES.bat);
    return true;
  }

  startSwing(aimAngle: number, weaponContainer?: Phaser.GameObjects.Container): boolean {
    void weaponContainer;
    return this.startPreviewSwing(aimAngle);
  }

  showSwingAnimation(aimAngle: number): void {
    this.graphics.setVisible(true);
    this.drawSwingArc(aimAngle, CONFIRMED_STYLES[this.weaponType.toLowerCase()] || CONFIRMED_STYLES.bat);
  }

  private playSwingAnimation(aimAngle: number, style: SwingStyle): void {
    this.activeTween?.stop();
    this.activeTween = null;
    this.animationToken += 1;
    const token = this.animationToken;
    this.activeAimAngle = aimAngle;
    this.activeStyle = style;

    this.graphics.setVisible(true);
    this.graphics.setAlpha(style.alpha);
    this.drawSwingArc(aimAngle, style);

    this.activeTween = this.scene.tweens.add({
      targets: this.graphics,
      alpha: 0,
      duration: style.fadeDuration,
      onComplete: () => {
        if (this.animationToken !== token) {
          return;
        }
        this.swingPhase = 'idle';
        this.activeAimAngle = null;
        this.activeStyle = null;
        this.activeTween = null;
        this.graphics.setVisible(false);
        this.graphics.clear();
      },
    });
  }

  private drawSwingArc(aimAngle: number, style: SwingStyle): void {
    this.graphics.clear();

    const arcRadians = (this.stats.arcDegrees * Math.PI) / 180;
    const halfArc = arcRadians / 2;
    const radius = this.stats.range * style.radiusMultiplier;
    const startAngle = aimAngle - halfArc;
    const endAngle = aimAngle + halfArc;

    this.graphics.lineStyle(style.width, style.color, style.alpha);
    this.graphics.beginPath();
    this.graphics.arc(this.x, this.y, radius, startAngle, endAngle, false);
    this.graphics.strokePath();
  }

  /**
   * Update — no-op since animations are now tween-based
   */
  update(): void {
    if (this.swingPhase === 'idle' || this.activeAimAngle === null || this.activeStyle === null) {
      return;
    }

    this.drawSwingArc(this.activeAimAngle, this.activeStyle);
  }

  /**
   * Set weapon position (follows player)
   */
  setPosition(x: number, y: number): void {
    this.x = x;
    this.y = y;

    if (this.swingPhase !== 'idle' && this.activeAimAngle !== null && this.activeStyle !== null) {
      this.drawSwingArc(this.activeAimAngle, this.activeStyle);
    }
  }

  /**
   * Check if currently swinging
   */
  isSwinging(): boolean {
    return this.swingPhase !== 'idle';
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
    this.swingPhase = 'idle';
    this.activeAimAngle = null;
    this.activeStyle = null;
    this.activeTween?.stop();
    this.activeTween = null;
    if (this.graphics) {
      this.graphics.destroy();
    }
  }
}
