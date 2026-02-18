import Phaser from 'phaser';
import { COLORS } from '../../shared/constants';

/**
 * Effect type identifier
 */
type EffectType = 'bullet' | 'melee' | 'muzzle';

/**
 * Pooled effect object
 */
interface PooledEffect {
  graphics: Phaser.GameObjects.Graphics;
  type: EffectType;
  inUse: boolean;
}

/**
 * HitEffectManager manages visual hit effects with object pooling for performance.
 *
 * Features:
 * - Object pooling (reuse sprites, not create/destroy)
 * - Three effect types: bullet impact, melee hit, muzzle flash
 * - 60 FPS performance with 8 concurrent players
 * - Simple procedural graphics (no particle systems)
 *
 * Performance Requirements (Story 3.7B):
 * - Pool size tuned for 8 players fighting simultaneously
 * - Effects fade in 100ms and return to pool
 * - No frame drops during heavy combat
 */
export class HitEffectManager {
  private scene: Phaser.Scene;
  private pool: PooledEffect[] = [];
  private poolSize: number;
  private destroyed: boolean = false;

  // Visual constants
  private static readonly BULLET_COLOR = 0xffff00; // Yellow
  private static readonly MELEE_COLOR = 0xffffff; // White
  private static readonly MUZZLE_COLOR = COLORS.MUZZLE_FLASH;
  private static readonly EFFECT_DEPTH = 60; // Above players (50), below UI (100+)
  private static readonly FADE_DURATION = 100; // 100ms fade

  constructor(scene: Phaser.Scene, poolSize: number = 20) {
    this.scene = scene;
    this.poolSize = poolSize;

    // Pre-create pool of effects
    this.initializePool();
  }

  /**
   * Initialize object pool with pre-created graphics
   */
  private initializePool(): void {
    for (let i = 0; i < this.poolSize; i++) {
      const graphics = this.scene.add.graphics();
      graphics.setDepth(HitEffectManager.EFFECT_DEPTH);
      graphics.setVisible(false);

      this.pool.push({
        graphics,
        type: 'bullet', // Default type, will be reconfigured on use
        inUse: false,
      });
    }
  }

  /**
   * Get an available effect from the pool
   * If pool exhausted, reuse oldest in-use effect
   */
  private getPooledEffect(): PooledEffect {
    if (this.destroyed) {
      throw new Error('HitEffectManager has been destroyed');
    }

    // Try to find available effect
    let effect = this.pool.find((e) => !e.inUse);

    // If pool exhausted, reuse oldest (first in-use effect)
    if (!effect) {
      effect = this.pool.find((e) => e.inUse);
      if (!effect) {
        throw new Error('Effect pool is empty');
      }
    }

    effect.inUse = true;
    return effect;
  }

  /**
   * Return effect to pool
   */
  private returnToPool(effect: PooledEffect): void {
    effect.inUse = false;
    effect.graphics.setVisible(false);
    effect.graphics.clear();
  }

  /**
   * Create bullet impact texture (4x4 yellow flash)
   */
  private drawBulletImpact(graphics: Phaser.GameObjects.Graphics): void {
    graphics.clear();
    graphics.fillStyle(HitEffectManager.BULLET_COLOR, 1);
    graphics.fillRect(-2, -2, 4, 4); // 4x4 centered at origin
  }

  /**
   * Create melee hit texture (white impact lines)
   */
  private drawMeleeHit(graphics: Phaser.GameObjects.Graphics): void {
    graphics.clear();
    graphics.lineStyle(2, HitEffectManager.MELEE_COLOR, 1);

    // Draw impact lines in X pattern
    graphics.beginPath();
    graphics.moveTo(-6, -6);
    graphics.lineTo(6, 6);
    graphics.strokePath();

    graphics.beginPath();
    graphics.moveTo(6, -6);
    graphics.lineTo(-6, 6);
    graphics.strokePath();

    // Add center circle
    graphics.fillStyle(HitEffectManager.MELEE_COLOR, 1);
    graphics.fillCircle(0, 0, 2);
  }

  /**
   * Create muzzle flash texture (orange/yellow flash)
   */
  private drawMuzzleFlash(graphics: Phaser.GameObjects.Graphics): void {
    graphics.clear();
    graphics.fillStyle(HitEffectManager.MUZZLE_COLOR, 1);

    // Draw elongated flash pointing right (direction will be rotated)
    graphics.beginPath();
    graphics.moveTo(0, 0);
    graphics.lineTo(8, -3);
    graphics.lineTo(12, 0);
    graphics.lineTo(8, 3);
    graphics.closePath();
    graphics.fillPath();
  }

  /**
   * Show bullet impact effect at specified position
   * Returns to pool after 100ms fade
   */
  showBulletImpact(x: number, y: number): Phaser.GameObjects.Graphics {
    const effect = this.getPooledEffect();
    effect.type = 'bullet';

    this.drawBulletImpact(effect.graphics);
    effect.graphics.setPosition(x, y);
    effect.graphics.setAlpha(1);
    effect.graphics.setVisible(true);

    // Fade out and return to pool
    this.scene.tweens.add({
      targets: effect.graphics,
      alpha: 0,
      duration: HitEffectManager.FADE_DURATION,
      onComplete: () => {
        this.returnToPool(effect);
      },
    });

    return effect.graphics;
  }

  /**
   * Show melee hit effect at specified position
   * Returns to pool after 100ms fade
   */
  showMeleeHit(x: number, y: number): Phaser.GameObjects.Graphics {
    const effect = this.getPooledEffect();
    effect.type = 'melee';

    this.drawMeleeHit(effect.graphics);
    effect.graphics.setPosition(x, y);
    effect.graphics.setAlpha(1);
    effect.graphics.setVisible(true);

    // Fade out and return to pool
    this.scene.tweens.add({
      targets: effect.graphics,
      alpha: 0,
      duration: HitEffectManager.FADE_DURATION,
      onComplete: () => {
        this.returnToPool(effect);
      },
    });

    return effect.graphics;
  }

  /**
   * Show muzzle flash at specified position with rotation
   * Returns to pool after 100ms fade
   *
   * @param x Position x
   * @param y Position y
   * @param rotation Angle in radians (direction of gun barrel)
   */
  showMuzzleFlash(x: number, y: number, rotation: number): Phaser.GameObjects.Graphics {
    const effect = this.getPooledEffect();
    effect.type = 'muzzle';

    this.drawMuzzleFlash(effect.graphics);
    effect.graphics.setPosition(x, y);
    effect.graphics.setRotation(rotation);
    effect.graphics.setAlpha(1);
    effect.graphics.setVisible(true);

    // Fade out and return to pool
    this.scene.tweens.add({
      targets: effect.graphics,
      alpha: 0,
      duration: HitEffectManager.FADE_DURATION,
      onComplete: () => {
        this.returnToPool(effect);
      },
    });

    return effect.graphics;
  }

  /**
   * Show blood particles bursting from victim position away from damage source.
   * Creates 5 circles with random radius (2-5px), velocity (50-150 px/s),
   * direction (away from source ±0.5 rad), and 500ms fade+shrink tween.
   *
   * @param victimX Victim's x position
   * @param victimY Victim's y position
   * @param sourceX Attacker's x position (for direction calculation)
   * @param sourceY Attacker's y position (for direction calculation)
   */
  showBloodParticles(victimX: number, victimY: number, sourceX: number, sourceY: number): void {
    const baseAngle = Math.atan2(victimY - sourceY, victimX - sourceX);

    for (let i = 0; i < 8; i++) {
      const radius = 2 + Math.random() * 3; // 2-5px
      const circle = this.scene.add.circle(victimX, victimY, radius, COLORS.BLOOD);
      circle.setDepth(HitEffectManager.EFFECT_DEPTH);

      const angle = baseAngle + (Math.random() - 0.5); // ±0.5 rad spread
      const speed = 50 + Math.random() * 100; // 50-150 px/s
      // Simulate 500ms of movement with drag (200 px/s²)
      // Average effective distance ≈ speed * duration / 2 (due to drag)
      const duration = 500;
      const effectiveDistance = speed * (duration / 1000) * 0.5;
      const endX = victimX + Math.cos(angle) * effectiveDistance;
      const endY = victimY + Math.sin(angle) * effectiveDistance;

      this.scene.tweens.add({
        targets: circle,
        x: endX,
        y: endY,
        alpha: 0,
        scale: 0,
        duration: 500,
        onComplete: () => circle.destroy(),
      });
    }
  }

  /**
   * Cleanup all pooled effects
   */
  destroy(): void {
    this.destroyed = true;

    for (const effect of this.pool) {
      effect.graphics.destroy();
    }

    this.pool = [];
  }
}
