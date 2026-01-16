import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProjectileManager, type ProjectileData } from './ProjectileManager';
import { EFFECTS, WEAPON } from '../../shared/constants';
import { ManualClock } from '../utils/Clock';

// Mock Phaser scene
const createMockScene = () => {
  const mockCircles: Map<string, { x: number; y: number; destroy: ReturnType<typeof vi.fn> }> = new Map();
  const mockLines: Map<string, { destroy: ReturnType<typeof vi.fn>; alpha: number; active: boolean }> = new Map();
  const mockTweens: object[] = [];

  return {
    add: {
      circle: vi.fn((x: number, y: number, radius: number) => {
        const id = `circle-${mockCircles.size}`;
        const circle = {
          x,
          y,
          radius,
          setFillStyle: vi.fn().mockReturnThis(),
          setPosition: vi.fn((newX: number, newY: number) => {
            circle.x = newX;
            circle.y = newY;
          }),
          destroy: vi.fn(),
        };
        mockCircles.set(id, circle);
        return circle;
      }),
      line: vi.fn((x1: number, y1: number, x2: number, y2: number) => {
        const id = `line-${mockLines.size}`;
        const line = {
          x1,
          y1,
          x2,
          y2,
          alpha: 1,
          active: true,
          setStrokeStyle: vi.fn().mockReturnThis(),
          setAlpha: vi.fn((alpha: number) => {
            line.alpha = alpha;
            return line;
          }),
          destroy: vi.fn(),
        };
        mockLines.set(id, line);
        return line;
      }),
    },
    tweens: {
      add: vi.fn((config: { onComplete?: () => void }) => {
        const tween = { remove: vi.fn() };
        mockTweens.push(tween);
        // Immediately call onComplete for testing
        if (config.onComplete) {
          setTimeout(config.onComplete, 0);
        }
        return tween;
      }),
    },
    time: {
      now: 0,
    },
    mockCircles,
    mockLines,
    mockTweens,
  } as unknown as Phaser.Scene & {
    mockCircles: Map<string, { x: number; y: number; destroy: ReturnType<typeof vi.fn> }>;
    mockLines: Map<string, { destroy: ReturnType<typeof vi.fn>; alpha: number; active: boolean }>;
    mockTweens: object[];
  };
};

describe('ProjectileManager', () => {
  let scene: ReturnType<typeof createMockScene>;
  let projectileManager: ProjectileManager;
  let clock: ManualClock;

  beforeEach(() => {
    scene = createMockScene();
    clock = new ManualClock();
    projectileManager = new ProjectileManager(scene, clock);
  });

  afterEach(() => {
    projectileManager.destroy();
  });

  describe('initialization', () => {
    it('should start with no projectiles', () => {
      expect(projectileManager.getProjectileCount()).toBe(0);
    });

    it('should use injected clock for time tracking', () => {
      const projectileData: ProjectileData = {
        id: 'proj-1',
        ownerId: 'player-1',
        weaponType: 'Pistol',
        position: { x: 100, y: 100 },
        velocity: { x: 100, y: 0 },
      };

      // Clock starts at 0
      expect(clock.now()).toBe(0);

      projectileManager.spawnProjectile(projectileData);

      // Advance clock
      clock.advance(500);

      // Projectile should still exist (lifetime is 1000ms)
      expect(projectileManager.getProjectileCount()).toBe(1);

      // Advance past lifetime
      clock.advance(600);
      projectileManager.update(0.016);

      // Projectile should be removed
      expect(projectileManager.getProjectileCount()).toBe(0);
    });
  });

  describe('spawnProjectile', () => {
    it('should create a projectile sprite', () => {
      const projectileData: ProjectileData = {
        id: 'proj-1',
        ownerId: 'player-1',
        weaponType: 'Pistol',
        position: { x: 100, y: 200 },
        velocity: { x: 800, y: 0 },
      };

      projectileManager.spawnProjectile(projectileData);

      expect(scene.add.circle).toHaveBeenCalled();
      expect(projectileManager.getProjectileCount()).toBe(1);
    });

    it('should create projectile with correct size', () => {
      const projectileData: ProjectileData = {
        id: 'proj-1',
        ownerId: 'player-1',
        weaponType: 'Pistol',
        position: { x: 100, y: 200 },
        velocity: { x: 800, y: 0 },
      };

      projectileManager.spawnProjectile(projectileData);

      expect(scene.add.circle).toHaveBeenCalledWith(
        100,
        200,
        EFFECTS.PROJECTILE_DIAMETER / 2,
        expect.any(Number)
      );
    });

    it('should not create duplicate projectiles with same ID', () => {
      const projectileData: ProjectileData = {
        id: 'proj-1',
        ownerId: 'player-1',
        weaponType: 'Pistol',
        position: { x: 100, y: 200 },
        velocity: { x: 800, y: 0 },
      };

      projectileManager.spawnProjectile(projectileData);
      projectileManager.spawnProjectile(projectileData);

      expect(projectileManager.getProjectileCount()).toBe(1);
    });

    it('should create bullet tracer line', () => {
      const projectileData: ProjectileData = {
        id: 'proj-1',
        ownerId: 'player-1',
        weaponType: 'Pistol',
        position: { x: 100, y: 200 },
        velocity: { x: 800, y: 0 },
      };

      projectileManager.spawnProjectile(projectileData);

      expect(scene.add.line).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should move projectiles based on velocity', () => {
      const projectileData: ProjectileData = {
        id: 'proj-1',
        ownerId: 'player-1',
        weaponType: 'Pistol',
        position: { x: 100, y: 100 },
        velocity: { x: 800, y: 0 }, // Moving right
      };

      projectileManager.spawnProjectile(projectileData);

      // Update for 0.5 seconds
      projectileManager.update(0.5);

      // Projectile should have moved 400 pixels to the right
      const proj = projectileManager.getProjectile('proj-1');
      expect(proj?.position.x).toBeCloseTo(500, 0);
    });

    it('should update projectile sprite position', () => {
      const projectileData: ProjectileData = {
        id: 'proj-1',
        ownerId: 'player-1',
        weaponType: 'Pistol',
        position: { x: 100, y: 100 },
        velocity: { x: 400, y: 0 },
      };

      projectileManager.spawnProjectile(projectileData);
      projectileManager.update(0.5);

      // The sprite's setPosition should have been called
      const circles = Array.from(scene.mockCircles.values());
      expect(circles[0].x).toBe(300); // 100 + 400 * 0.5
    });

    it('should remove projectiles that are out of bounds', () => {
      const projectileData: ProjectileData = {
        id: 'proj-1',
        ownerId: 'player-1',
        weaponType: 'Pistol',
        position: { x: 1900, y: 100 },
        velocity: { x: 800, y: 0 }, // Moving right, will exit bounds
      };

      projectileManager.spawnProjectile(projectileData);
      expect(projectileManager.getProjectileCount()).toBe(1);

      // Update enough to go out of bounds
      projectileManager.update(0.5);

      expect(projectileManager.getProjectileCount()).toBe(0);
    });

    it('should remove projectiles that exceed max lifetime', () => {
      const projectileData: ProjectileData = {
        id: 'proj-1',
        ownerId: 'player-1',
        weaponType: 'Pistol',
        position: { x: 100, y: 100 },
        velocity: { x: 100, y: 0 }, // Moving slowly
      };

      projectileManager.spawnProjectile(projectileData);

      // Advance clock past max lifetime
      clock.advance(WEAPON.PROJECTILE_MAX_LIFETIME + 100);
      projectileManager.update(0.016);

      expect(projectileManager.getProjectileCount()).toBe(0);
    });
  });

  describe('removeProjectile', () => {
    it('should remove a specific projectile by ID', () => {
      const projectileData: ProjectileData = {
        id: 'proj-1',
        ownerId: 'player-1',
        weaponType: 'Pistol',
        position: { x: 100, y: 200 },
        velocity: { x: 800, y: 0 },
      };

      projectileManager.spawnProjectile(projectileData);
      expect(projectileManager.getProjectileCount()).toBe(1);

      projectileManager.removeProjectile('proj-1');
      expect(projectileManager.getProjectileCount()).toBe(0);
    });

    it('should destroy the projectile sprite', () => {
      const projectileData: ProjectileData = {
        id: 'proj-1',
        ownerId: 'player-1',
        weaponType: 'Pistol',
        position: { x: 100, y: 200 },
        velocity: { x: 800, y: 0 },
      };

      projectileManager.spawnProjectile(projectileData);
      projectileManager.removeProjectile('proj-1');

      const circles = Array.from(scene.mockCircles.values());
      expect(circles[0].destroy).toHaveBeenCalled();
    });

    it('should handle removing non-existent projectile gracefully', () => {
      expect(() => projectileManager.removeProjectile('non-existent')).not.toThrow();
    });

    it('should destroy tracer when it is inactive', () => {
      const projectileData: ProjectileData = {
        id: 'proj-1',
        ownerId: 'player-1',
        weaponType: 'Pistol',
        position: { x: 100, y: 200 },
        velocity: { x: 800, y: 0 },
      };

      projectileManager.spawnProjectile(projectileData);

      // Set tracer to inactive (simulating tracer tween completed)
      const lines = Array.from(scene.mockLines.values());
      lines[0].active = false;

      projectileManager.removeProjectile('proj-1');

      // Tracer should have been destroyed since it was inactive
      expect(lines[0].destroy).toHaveBeenCalled();
    });

    it('should not destroy tracer when it is still active', () => {
      const projectileData: ProjectileData = {
        id: 'proj-1',
        ownerId: 'player-1',
        weaponType: 'Pistol',
        position: { x: 100, y: 200 },
        velocity: { x: 800, y: 0 },
      };

      projectileManager.spawnProjectile(projectileData);

      // Tracer is active by default
      const lines = Array.from(scene.mockLines.values());
      expect(lines[0].active).toBe(true);

      projectileManager.removeProjectile('proj-1');

      // Tracer should NOT have been destroyed since it was still active
      expect(lines[0].destroy).not.toHaveBeenCalled();
    });
  });

  describe('getProjectile', () => {
    it('should return projectile data by ID', () => {
      const projectileData: ProjectileData = {
        id: 'proj-1',
        ownerId: 'player-1',
        weaponType: 'Pistol',
        position: { x: 100, y: 200 },
        velocity: { x: 800, y: 0 },
      };

      projectileManager.spawnProjectile(projectileData);

      const proj = projectileManager.getProjectile('proj-1');
      expect(proj?.id).toBe('proj-1');
      expect(proj?.ownerId).toBe('player-1');
    });

    it('should return undefined for non-existent projectile', () => {
      const proj = projectileManager.getProjectile('non-existent');
      expect(proj).toBeUndefined();
    });
  });

  describe('destroy', () => {
    it('should remove all projectiles', () => {
      projectileManager.spawnProjectile({
        id: 'proj-1',
        ownerId: 'player-1',
        weaponType: 'Pistol',
        position: { x: 100, y: 200 },
        velocity: { x: 800, y: 0 },
      });

      projectileManager.spawnProjectile({
        id: 'proj-2',
        ownerId: 'player-2',
        weaponType: 'Uzi',
        position: { x: 200, y: 300 },
        velocity: { x: 400, y: 400 },
      });

      expect(projectileManager.getProjectileCount()).toBe(2);

      projectileManager.destroy();

      expect(projectileManager.getProjectileCount()).toBe(0);
    });
  });

  describe('createMuzzleFlash', () => {
    it('should create a muzzle flash effect', () => {
      projectileManager.createMuzzleFlash(100, 200);

      expect(scene.add.circle).toHaveBeenCalled();
    });

    it('should create muzzle flash at correct position', () => {
      projectileManager.createMuzzleFlash(150, 250);

      expect(scene.add.circle).toHaveBeenCalledWith(
        150,
        250,
        EFFECTS.MUZZLE_FLASH_RADIUS,
        expect.any(Number)
      );
    });

    it('should setup tween animation for muzzle flash fade out', () => {
      projectileManager.createMuzzleFlash(100, 200);

      // Verify tween was created with correct config
      expect(scene.tweens.add).toHaveBeenCalledWith(
        expect.objectContaining({
          alpha: 0,
          scale: 1.5,
          duration: EFFECTS.MUZZLE_FLASH_DURATION,
          onComplete: expect.any(Function),
        })
      );
    });

    it('should destroy muzzle flash when tween completes', async () => {
      // Create mock circle with destroy spy
      const mockFlash = {
        destroy: vi.fn(),
        setFillStyle: vi.fn().mockReturnThis(),
      };
      scene.add.circle = vi.fn().mockReturnValue(mockFlash);

      // Track the onComplete callback
      let capturedOnComplete: (() => void) | null = null;
      scene.tweens.add = vi.fn().mockImplementation((config: Record<string, unknown>) => {
        if (typeof config.onComplete === 'function') {
          capturedOnComplete = config.onComplete as () => void;
        }
        return { remove: vi.fn() };
      });

      projectileManager.createMuzzleFlash(100, 200);

      // Verify tween was created
      expect(scene.tweens.add).toHaveBeenCalled();

      // Manually trigger the onComplete callback
      expect(capturedOnComplete).not.toBeNull();
      capturedOnComplete!();

      // Verify flash was destroyed
      expect(mockFlash.destroy).toHaveBeenCalled();
    });
  });

  describe('weapon-specific projectile visuals', () => {
    it('should create Pistol projectile with correct visuals (yellow, 4px diameter, 2px tracer)', () => {
      const projectileData: ProjectileData = {
        id: 'proj-pistol',
        ownerId: 'player-1',
        weaponType: 'Pistol',
        position: { x: 100, y: 100 },
        velocity: { x: 800, y: 0 },
      };

      projectileManager.spawnProjectile(projectileData);

      // Verify projectile circle created with Pistol specs: diameter 4, yellow color (0xffff00)
      expect(scene.add.circle).toHaveBeenCalledWith(100, 100, 2, 0xffff00);

      // Verify tracer line created
      expect(scene.add.line).toHaveBeenCalled();

      // Get the created line and verify it has Pistol tracer properties
      const lines = Array.from(scene.mockLines.values());
      const tracerLine = lines[0];
      expect(tracerLine).toBeDefined();

      // Verify tracer styling (width 2, yellow color)
      const lineObject = tracerLine as unknown as { setStrokeStyle: ReturnType<typeof vi.fn> };
      expect(lineObject.setStrokeStyle).toHaveBeenCalledWith(2, 0xffff00);
    });

    it('should create Uzi projectile with correct visuals (orange, 3px diameter, 1.5px tracer)', () => {
      const projectileData: ProjectileData = {
        id: 'proj-uzi',
        ownerId: 'player-1',
        weaponType: 'Uzi',
        position: { x: 200, y: 150 },
        velocity: { x: 800, y: 0 },
      };

      projectileManager.spawnProjectile(projectileData);

      // Verify projectile circle created with Uzi specs: diameter 3, orange color (0xffaa00)
      expect(scene.add.circle).toHaveBeenCalledWith(200, 150, 1.5, 0xffaa00);

      // Verify tracer line created
      expect(scene.add.line).toHaveBeenCalled();

      // Get the created line and verify it has Uzi tracer properties
      const lines = Array.from(scene.mockLines.values());
      const tracerLine = lines[0];
      expect(tracerLine).toBeDefined();

      // Verify tracer styling (width 1.5, orange color)
      const lineObject = tracerLine as unknown as { setStrokeStyle: ReturnType<typeof vi.fn> };
      expect(lineObject.setStrokeStyle).toHaveBeenCalledWith(1.5, 0xffaa00);
    });

    it('should create AK47 projectile with correct visuals (gold, 5px diameter, 2.5px tracer)', () => {
      const projectileData: ProjectileData = {
        id: 'proj-ak47',
        ownerId: 'player-1',
        weaponType: 'AK47',
        position: { x: 300, y: 200 },
        velocity: { x: 800, y: 0 },
      };

      projectileManager.spawnProjectile(projectileData);

      // Verify projectile circle created with AK47 specs: diameter 5, gold color (0xffcc00)
      expect(scene.add.circle).toHaveBeenCalledWith(300, 200, 2.5, 0xffcc00);

      // Verify tracer line created
      expect(scene.add.line).toHaveBeenCalled();

      // Get the created line and verify it has AK47 tracer properties
      const lines = Array.from(scene.mockLines.values());
      const tracerLine = lines[0];
      expect(tracerLine).toBeDefined();

      // Verify tracer styling (width 2.5, gold color)
      const lineObject = tracerLine as unknown as { setStrokeStyle: ReturnType<typeof vi.fn> };
      expect(lineObject.setStrokeStyle).toHaveBeenCalledWith(2.5, 0xffcc00);
    });

    it('should create Shotgun projectile with correct visuals (orange-red, 6px diameter, 3px tracer)', () => {
      const projectileData: ProjectileData = {
        id: 'proj-shotgun',
        ownerId: 'player-1',
        weaponType: 'Shotgun',
        position: { x: 400, y: 250 },
        velocity: { x: 800, y: 0 },
      };

      projectileManager.spawnProjectile(projectileData);

      // Verify projectile circle created with Shotgun specs: diameter 6, orange-red color (0xff8800)
      expect(scene.add.circle).toHaveBeenCalledWith(400, 250, 3, 0xff8800);

      // Verify tracer line created
      expect(scene.add.line).toHaveBeenCalled();

      // Get the created line and verify it has Shotgun tracer properties
      const lines = Array.from(scene.mockLines.values());
      const tracerLine = lines[0];
      expect(tracerLine).toBeDefined();

      // Verify tracer styling (width 3, orange-red color)
      const lineObject = tracerLine as unknown as { setStrokeStyle: ReturnType<typeof vi.fn> };
      expect(lineObject.setStrokeStyle).toHaveBeenCalledWith(3, 0xff8800);
    });

    it('should create multiple projectiles with different weapon types and correct visuals', () => {
      const pistolData: ProjectileData = {
        id: 'proj-pistol',
        ownerId: 'player-1',
        weaponType: 'Pistol',
        position: { x: 100, y: 100 },
        velocity: { x: 800, y: 0 },
      };

      const shotgunData: ProjectileData = {
        id: 'proj-shotgun',
        ownerId: 'player-2',
        weaponType: 'Shotgun',
        position: { x: 500, y: 500 },
        velocity: { x: -800, y: 0 },
      };

      projectileManager.spawnProjectile(pistolData);
      projectileManager.spawnProjectile(shotgunData);

      expect(projectileManager.getProjectileCount()).toBe(2);

      // Verify both projectiles created with correct specs
      expect(scene.add.circle).toHaveBeenCalledWith(100, 100, 2, 0xffff00); // Pistol
      expect(scene.add.circle).toHaveBeenCalledWith(500, 500, 3, 0xff8800); // Shotgun
    });
  });
});
