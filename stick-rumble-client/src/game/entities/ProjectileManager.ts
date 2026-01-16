import Phaser from 'phaser';
import { ARENA, EFFECTS, WEAPON } from '../../shared/constants';
import type { Clock } from '../utils/Clock';
import { RealClock } from '../utils/Clock';
import { getWeaponConfigSync, parseHexColor } from '../../shared/weaponConfig';

/**
 * Projectile data received from server
 */
export interface ProjectileData {
  id: string;
  ownerId: string;
  weaponType: string;
  position: { x: number; y: number };
  velocity: { x: number; y: number };
}

/**
 * Internal projectile state
 */
interface Projectile {
  id: string;
  ownerId: string;
  weaponType: string;
  position: { x: number; y: number };
  velocity: { x: number; y: number };
  sprite: Phaser.GameObjects.Arc;
  tracer?: Phaser.GameObjects.Line;
  createdAt: number;
}

/**
 * ProjectileManager handles rendering and updating all projectiles
 */
export class ProjectileManager {
  private scene: Phaser.Scene;
  private projectiles: Map<string, Projectile> = new Map();
  private clock: Clock;

  constructor(scene: Phaser.Scene, clock: Clock = new RealClock()) {
    this.scene = scene;
    this.clock = clock;
  }

  /**
   * Spawn a new projectile from server data
   */
  spawnProjectile(data: ProjectileData): void {
    // Don't create duplicate projectiles
    if (this.projectiles.has(data.id)) {
      return;
    }

    // Get weapon config for visual settings
    const weaponConfig = getWeaponConfigSync(data.weaponType);
    const projectileVisuals = weaponConfig?.visuals.projectile;

    // Use weapon-specific visuals or fallback to defaults
    const projectileColor = projectileVisuals
      ? parseHexColor(projectileVisuals.color)
      : 0xffff00;
    const projectileDiameter = projectileVisuals?.diameter ?? EFFECTS.PROJECTILE_DIAMETER;
    const tracerColor = projectileVisuals
      ? parseHexColor(projectileVisuals.tracerColor)
      : 0xffff00;
    const tracerWidth = projectileVisuals?.tracerWidth ?? EFFECTS.TRACER_WIDTH;

    // Create projectile sprite with weapon-specific color and size
    const sprite = this.scene.add.circle(
      data.position.x,
      data.position.y,
      projectileDiameter / 2,
      projectileColor
    );

    // Create bullet tracer with weapon-specific color and width
    const tracer = this.createTracer(
      data.position.x,
      data.position.y,
      data.position.x,
      data.position.y,
      tracerColor,
      tracerWidth
    );

    const projectile: Projectile = {
      id: data.id,
      ownerId: data.ownerId,
      weaponType: data.weaponType,
      position: { ...data.position },
      velocity: { ...data.velocity },
      sprite,
      tracer,
      createdAt: this.clock.now(),
    };

    this.projectiles.set(data.id, projectile);
  }

  /**
   * Create a bullet tracer line
   */
  private createTracer(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    color: number = 0xffff00,
    width: number = EFFECTS.TRACER_WIDTH
  ): Phaser.GameObjects.Line {
    const line = this.scene.add.line(
      0,
      0,
      startX,
      startY,
      endX,
      endY,
      color
    );
    line.setStrokeStyle(width, color);

    // Fade out the tracer
    this.scene.tweens.add({
      targets: line,
      alpha: 0,
      duration: EFFECTS.TRACER_FADE_DURATION,
      onComplete: () => {
        line.destroy();
      },
    });

    return line;
  }

  /**
   * Update all projectiles
   */
  update(deltaTime: number): void {
    const toRemove: string[] = [];

    for (const [id, projectile] of this.projectiles) {
      // Update position based on velocity
      projectile.position.x += projectile.velocity.x * deltaTime;
      projectile.position.y += projectile.velocity.y * deltaTime;

      // Update sprite position
      projectile.sprite.setPosition(projectile.position.x, projectile.position.y);

      // Check if out of bounds
      if (this.isOutOfBounds(projectile.position)) {
        toRemove.push(id);
        continue;
      }

      // Check if expired (max lifetime)
      const age = this.clock.now() - projectile.createdAt;
      if (age >= WEAPON.PROJECTILE_MAX_LIFETIME) {
        toRemove.push(id);
      }
    }

    // Remove expired/out-of-bounds projectiles
    for (const id of toRemove) {
      this.removeProjectile(id);
    }
  }

  /**
   * Check if position is out of arena bounds
   */
  private isOutOfBounds(position: { x: number; y: number }): boolean {
    return (
      position.x < 0 ||
      position.x > ARENA.WIDTH ||
      position.y < 0 ||
      position.y > ARENA.HEIGHT
    );
  }

  /**
   * Remove a projectile by ID
   */
  removeProjectile(id: string): void {
    const projectile = this.projectiles.get(id);
    if (!projectile) {
      return;
    }

    // Destroy sprite
    projectile.sprite.destroy();

    // Destroy tracer if it still exists
    if (projectile.tracer && !projectile.tracer.active) {
      projectile.tracer.destroy();
    }

    this.projectiles.delete(id);
  }

  /**
   * Get projectile by ID
   */
  getProjectile(id: string): ProjectileData | undefined {
    const projectile = this.projectiles.get(id);
    if (!projectile) {
      return undefined;
    }

    return {
      id: projectile.id,
      ownerId: projectile.ownerId,
      weaponType: projectile.weaponType,
      position: { ...projectile.position },
      velocity: { ...projectile.velocity },
    };
  }

  /**
   * Get count of active projectiles
   */
  getProjectileCount(): number {
    return this.projectiles.size;
  }

  /**
   * Create a muzzle flash effect at the given position
   */
  createMuzzleFlash(x: number, y: number, weaponType?: string): void {
    // Get weapon config for visual settings
    const weaponConfig = weaponType ? getWeaponConfigSync(weaponType) : null;
    const muzzleFlashVisuals = weaponConfig?.visuals;

    // Use weapon-specific visuals or fallback to defaults
    const flashColor = muzzleFlashVisuals
      ? parseHexColor(muzzleFlashVisuals.muzzleFlashColor)
      : 0xffffff;
    const flashSize = muzzleFlashVisuals?.muzzleFlashSize ?? EFFECTS.MUZZLE_FLASH_RADIUS;
    const flashDuration = muzzleFlashVisuals?.muzzleFlashDuration ?? EFFECTS.MUZZLE_FLASH_DURATION;

    const flash = this.scene.add.circle(x, y, flashSize, flashColor);

    // Fade and remove the flash
    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 1.5,
      duration: flashDuration,
      onComplete: () => {
        flash.destroy();
      },
    });
  }

  /**
   * Cleanup all projectiles
   */
  destroy(): void {
    for (const [id] of this.projectiles) {
      this.removeProjectile(id);
    }
    this.projectiles.clear();
  }
}
