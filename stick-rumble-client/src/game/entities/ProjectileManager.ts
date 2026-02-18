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
  sprite: Phaser.GameObjects.Arc | Phaser.GameObjects.Graphics;
  tracer?: Phaser.GameObjects.Line;
  createdAt: number;
  shape: 'chevron' | 'circle';
  projectileColor: number;
  tracerLength: number;
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
    const shape = projectileVisuals?.shape ?? 'circle';
    const tracerLength = projectileVisuals?.tracerLength ?? 20;

    let sprite: Phaser.GameObjects.Arc | Phaser.GameObjects.Graphics;

    if (shape === 'chevron') {
      // Draw directional triangle polygon pointing in velocity direction
      sprite = this.createChevronSprite(
        data.position.x,
        data.position.y,
        data.velocity,
        projectileColor,
        tracerLength
      );
    } else {
      // Default circle sprite
      sprite = this.scene.add.circle(
        data.position.x,
        data.position.y,
        projectileDiameter / 2,
        projectileColor
      );
    }

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
      shape,
      projectileColor,
      tracerLength,
    };

    this.projectiles.set(data.id, projectile);
  }

  /**
   * Create a chevron (directional triangle) Graphics sprite for projectiles.
   * The triangle points in the velocity direction using tracerLength for scale.
   */
  private createChevronSprite(
    x: number,
    y: number,
    velocity: { x: number; y: number },
    color: number,
    tracerLength: number
  ): Phaser.GameObjects.Graphics {
    const gfx = this.scene.add.graphics();
    gfx.setPosition(x, y);
    gfx.setDepth(50);

    const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
    const angle = speed > 0 ? Math.atan2(velocity.y, velocity.x) : 0;

    this.drawChevron(gfx, angle, color, tracerLength);

    return gfx;
  }

  /**
   * Draw a chevron (triangle) on a Graphics object at the given angle.
   * The tip points forward in the aim direction.
   */
  private drawChevron(
    gfx: Phaser.GameObjects.Graphics,
    angle: number,
    color: number,
    size: number
  ): void {
    gfx.clear();
    gfx.fillStyle(color, 1);

    // Triangle tip is `size` px forward, base is `size/2` px behind, `size/3` wide
    const tipX = Math.cos(angle) * size;
    const tipY = Math.sin(angle) * size;
    const baseX = -Math.cos(angle) * (size / 2);
    const baseY = -Math.sin(angle) * (size / 2);
    const perpX = -Math.sin(angle) * (size / 3);
    const perpY = Math.cos(angle) * (size / 3);

    gfx.fillTriangle(
      tipX, tipY,
      baseX + perpX, baseY + perpY,
      baseX - perpX, baseY - perpY
    );
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
    const flashShape = muzzleFlashVisuals?.muzzleFlashShape ?? 'circle';

    let flash: Phaser.GameObjects.Arc | Phaser.GameObjects.Graphics;

    if (flashShape === 'starburst') {
      flash = this.createStarburstFlash(x, y, flashColor, flashSize);
    } else {
      flash = this.scene.add.circle(x, y, flashSize, flashColor);
    }

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
   * Create a starburst polygon muzzle flash effect.
   * Alternating long/short spikes radiating from center.
   */
  private createStarburstFlash(
    x: number,
    y: number,
    color: number,
    size: number
  ): Phaser.GameObjects.Graphics {
    const gfx = this.scene.add.graphics();
    gfx.setPosition(x, y);
    gfx.setDepth(60);

    gfx.fillStyle(color, 1);

    const numSpikes = 8;
    const outerRadius = size;
    const innerRadius = size * 0.4;

    const points: { x: number; y: number }[] = [];
    for (let i = 0; i < numSpikes * 2; i++) {
      const angle = (i * Math.PI) / numSpikes - Math.PI / 2;
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      points.push({
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
      });
    }

    gfx.fillPoints(points, true);

    return gfx;
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
