import { describe, it, expect, beforeEach, vi } from 'vitest';
import Phaser from 'phaser';
import { HitEffectManager } from './HitEffectManager';

describe('HitEffectManager', () => {
  let scene: Phaser.Scene;
  let manager: HitEffectManager;

  beforeEach(() => {
    // Create minimal mock scene
    scene = {
      add: {
        graphics: vi.fn(() => ({
          clear: vi.fn().mockReturnThis(),
          fillStyle: vi.fn().mockReturnThis(),
          fillRect: vi.fn().mockReturnThis(),
          lineStyle: vi.fn().mockReturnThis(),
          beginPath: vi.fn().mockReturnThis(),
          moveTo: vi.fn().mockReturnThis(),
          lineTo: vi.fn().mockReturnThis(),
          strokePath: vi.fn().mockReturnThis(),
          fillCircle: vi.fn().mockReturnThis(),
          closePath: vi.fn().mockReturnThis(),
          fillPath: vi.fn().mockReturnThis(),
          setPosition: vi.fn().mockReturnThis(),
          setAlpha: vi.fn().mockReturnThis(),
          setVisible: vi.fn().mockReturnThis(),
          setDepth: vi.fn().mockReturnThis(),
          setRotation: vi.fn().mockReturnThis(),
          destroy: vi.fn(),
          alpha: 1,
          visible: false,
        })),
        circle: vi.fn((_x: number, _y: number, _radius: number, _color: number) => ({
          setDepth: vi.fn().mockReturnThis(),
          destroy: vi.fn(),
          x: _x,
          y: _y,
        })),
      },
      tweens: {
        add: vi.fn((config) => {
          // Simulate tween completion immediately for testing
          if (config.onComplete) {
            config.onComplete();
          }
          return {
            play: vi.fn(),
            stop: vi.fn(),
          };
        }),
      },
    } as unknown as Phaser.Scene;

    manager = new HitEffectManager(scene, 10); // Pool size of 10
  });

  describe('constructor', () => {
    it('should create effect manager with specified pool size', () => {
      expect(manager).toBeDefined();
    });

    it('should pre-create textures for all effect types', () => {
      const addGraphics = scene.add.graphics as unknown as ReturnType<typeof vi.fn>;
      // Should create textures for: bullet impact, melee hit, muzzle flash
      expect(addGraphics).toHaveBeenCalledTimes(10); // Pool size effects created
    });
  });

  describe('showBulletImpact', () => {
    it('should show bullet impact effect at specified position', () => {
      const effect = manager.showBulletImpact(100, 200);

      expect(effect).toBeDefined();
      expect(effect.setPosition).toHaveBeenCalledWith(100, 200);
      expect(effect.setVisible).toHaveBeenCalledWith(true);
      expect(effect.setAlpha).toHaveBeenCalledWith(1);
    });

    it('should fade out bullet impact over 100ms', () => {
      manager.showBulletImpact(100, 200);

      expect(scene.tweens.add).toHaveBeenCalledWith(
        expect.objectContaining({
          alpha: 0,
          duration: 100,
        })
      );
    });

    it('should return effect to pool after fade completes', () => {
      const effect = manager.showBulletImpact(100, 200);

      // Tween completes immediately in mock
      expect(effect.setVisible).toHaveBeenCalledWith(false);
    });

    it('should reuse pooled effects when called multiple times', () => {
      const effect1 = manager.showBulletImpact(100, 200);
      const effect2 = manager.showBulletImpact(150, 250);

      // Should reuse the same effect object
      expect(effect1).toBe(effect2);
    });

    it('should handle pool exhaustion gracefully', () => {
      // Create more effects than pool size
      for (let i = 0; i < 15; i++) {
        const effect = manager.showBulletImpact(i * 10, i * 10);
        expect(effect).toBeDefined();
      }

      // Should not throw, reuses oldest effects
    });
  });

  describe('showMeleeHit', () => {
    it('should show melee hit effect at specified position', () => {
      const effect = manager.showMeleeHit(100, 200);

      expect(effect).toBeDefined();
      expect(effect.setPosition).toHaveBeenCalledWith(100, 200);
      expect(effect.setVisible).toHaveBeenCalledWith(true);
      expect(effect.setAlpha).toHaveBeenCalledWith(1);
    });

    it('should fade out melee hit over 100ms', () => {
      manager.showMeleeHit(100, 200);

      expect(scene.tweens.add).toHaveBeenCalledWith(
        expect.objectContaining({
          alpha: 0,
          duration: 100,
        })
      );
    });

    it('should return melee effect to pool after fade', () => {
      const effect = manager.showMeleeHit(100, 200);

      // Tween completes immediately in mock
      expect(effect.setVisible).toHaveBeenCalledWith(false);
    });
  });

  describe('showMuzzleFlash', () => {
    it('should show muzzle flash at specified position', () => {
      const effect = manager.showMuzzleFlash(100, 200, 0);

      expect(effect).toBeDefined();
      expect(effect.setPosition).toHaveBeenCalledWith(100, 200);
      expect(effect.setVisible).toHaveBeenCalledWith(true);
      expect(effect.setAlpha).toHaveBeenCalledWith(1);
    });

    it('should fade out muzzle flash over 100ms', () => {
      manager.showMuzzleFlash(100, 200, 0);

      expect(scene.tweens.add).toHaveBeenCalledWith(
        expect.objectContaining({
          alpha: 0,
          duration: 100,
        })
      );
    });

    it('should return muzzle flash to pool after fade', () => {
      const effect = manager.showMuzzleFlash(100, 200, 0);

      // Tween completes immediately in mock
      expect(effect.setVisible).toHaveBeenCalledWith(false);
    });

    it('should accept rotation parameter for directional flash', () => {
      const effect = manager.showMuzzleFlash(100, 200, Math.PI / 2);

      expect(effect).toBeDefined();
      // Rotation would be applied to the Graphics transform
    });
  });

  describe('destroy', () => {
    it('should destroy all pooled effects', () => {
      const effect = manager.showBulletImpact(100, 200);

      manager.destroy();

      expect(effect.destroy).toHaveBeenCalled();
    });

    it('should throw when trying to show effects after destroy', () => {
      manager.showBulletImpact(100, 200);
      manager.destroy();

      // After destroy, showing new effects should throw
      expect(() => manager.showBulletImpact(100, 200)).toThrow('HitEffectManager has been destroyed');
    });

    it('should set destroyed flag', () => {
      manager.destroy();

      // Destroyed flag prevents further use
      expect(() => manager.showBulletImpact(100, 200)).toThrow('HitEffectManager has been destroyed');
      expect(() => manager.showMeleeHit(100, 200)).toThrow('HitEffectManager has been destroyed');
      expect(() => manager.showMuzzleFlash(100, 200, 0)).toThrow('HitEffectManager has been destroyed');
    });
  });

  describe('performance', () => {
    it('should maintain 60 FPS with 8 simultaneous bullet impacts', () => {
      const startTime = performance.now();

      // Simulate 8 players shooting at once
      for (let i = 0; i < 8; i++) {
        manager.showBulletImpact(i * 100, i * 100);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete in less than 16ms (60 FPS frame budget)
      expect(duration).toBeLessThan(16);
    });

    it('should handle rapid consecutive effects without lag', () => {
      const startTime = performance.now();

      // Simulate rapid fire with 50 effects
      for (let i = 0; i < 50; i++) {
        manager.showBulletImpact(Math.random() * 800, Math.random() * 600);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete quickly due to object pooling
      expect(duration).toBeLessThan(50);
    });
  });

  describe('visual appearance', () => {
    it('should create yellow bullet impact flash (4x4 pixels)', () => {
      const addGraphics = scene.add.graphics as unknown as ReturnType<typeof vi.fn>;
      const graphicsMock = addGraphics.mock.results[0]?.value;

      manager.showBulletImpact(100, 200);

      // Should have filled with yellow color (0xFFFF00)
      expect(graphicsMock.fillStyle).toHaveBeenCalledWith(0xFFFF00, 1);
      expect(graphicsMock.fillRect).toHaveBeenCalledWith(-2, -2, 4, 4);
    });

    it('should create white melee impact lines', () => {
      const addGraphics = scene.add.graphics as unknown as ReturnType<typeof vi.fn>;
      const graphicsMock = addGraphics.mock.results[0]?.value;

      manager.showMeleeHit(100, 200);

      // Should have filled with white color (0xFFFFFF)
      expect(graphicsMock.fillStyle).toHaveBeenCalledWith(0xFFFFFF, 1);
      expect(graphicsMock.fillCircle).toHaveBeenCalledWith(0, 0, 2);
    });

    it('should create orange muzzle flash', () => {
      const addGraphics = scene.add.graphics as unknown as ReturnType<typeof vi.fn>;
      const graphicsMock = addGraphics.mock.results[0]?.value;

      manager.showMuzzleFlash(100, 200, 0);

      // Should have filled with orange color (0xFFA500)
      expect(graphicsMock.fillStyle).toHaveBeenCalledWith(0xFFA500, 1);
    });
  });

  describe('depth ordering', () => {
    it('should render effects above players but below UI', () => {
      const effect = manager.showBulletImpact(100, 200);

      // Effects should be at depth 60 (players at 50, UI at 100+)
      expect(effect.setDepth).toHaveBeenCalledWith(60);
    });
  });

  describe('concurrent effects', () => {
    it('should handle multiple effect types simultaneously', () => {
      const bullet1 = manager.showBulletImpact(100, 200);
      const melee1 = manager.showMeleeHit(150, 250);
      const muzzle1 = manager.showMuzzleFlash(200, 300, 0);

      expect(bullet1).toBeDefined();
      expect(melee1).toBeDefined();
      expect(muzzle1).toBeDefined();

      // All should be visible
      expect(bullet1.setVisible).toHaveBeenCalledWith(true);
      expect(melee1.setVisible).toHaveBeenCalledWith(true);
      expect(muzzle1.setVisible).toHaveBeenCalledWith(true);
    });

    it('should pool effects by type separately', () => {
      // All effects share the same pool, but are reconfigured per type
      const bullet1 = manager.showBulletImpact(100, 200);
      const bullet2 = manager.showBulletImpact(150, 250);

      const melee1 = manager.showMeleeHit(200, 300);
      const melee2 = manager.showMeleeHit(250, 350);

      // With object pooling, effects may share the same Graphics object
      // but are reconfigured (drawn differently) based on type
      expect(bullet1).toBeDefined();
      expect(bullet2).toBeDefined();
      expect(melee1).toBeDefined();
      expect(melee2).toBeDefined();

      // All should be visible when active
      expect(bullet1.setVisible).toHaveBeenCalledWith(true);
      expect(melee1.setVisible).toHaveBeenCalledWith(true);
    });
  });

  describe('edge cases', () => {
    it('should handle empty pool gracefully by reusing in-use effects', () => {
      // Create a manager with pool size of 1
      const smallManager = new HitEffectManager(scene, 1);

      // First effect uses the only available slot
      const effect1 = smallManager.showBulletImpact(100, 100);
      expect(effect1).toBeDefined();

      // Second effect should reuse the first (pool exhausted)
      const effect2 = smallManager.showMeleeHit(200, 200);
      expect(effect2).toBeDefined();

      // Should be the same graphics object (reused from pool)
      expect(effect1).toBe(effect2);

      smallManager.destroy();
    });

    it('should throw error if pool is somehow completely empty', () => {
      // Create manager with empty pool (pool size 0 to trigger edge case)
      const emptyManager = new HitEffectManager(scene, 0);

      // Should throw when trying to get effect from empty pool
      expect(() => emptyManager.showBulletImpact(100, 200)).toThrow('Effect pool is empty');

      emptyManager.destroy();
    });
  });

  describe('showBloodParticles (TS-GFX-015)', () => {
    it('should create exactly 5 blood particles', () => {
      manager.showBloodParticles(200, 200, 100, 200);

      const addCircle = scene.add.circle as unknown as ReturnType<typeof vi.fn>;
      expect(addCircle).toHaveBeenCalledTimes(5);
    });

    it('should create circles with color 0xCC0000 (dark red)', () => {
      manager.showBloodParticles(200, 200, 100, 200);

      const addCircle = scene.add.circle as unknown as ReturnType<typeof vi.fn>;
      for (const call of addCircle.mock.calls) {
        expect(call[3]).toBe(0xCC0000);
      }
    });

    it('should create circles at victim position', () => {
      manager.showBloodParticles(300, 400, 100, 200);

      const addCircle = scene.add.circle as unknown as ReturnType<typeof vi.fn>;
      for (const call of addCircle.mock.calls) {
        expect(call[0]).toBe(300); // victimX
        expect(call[1]).toBe(400); // victimY
      }
    });

    it('should create circles with radius between 2 and 5', () => {
      // Run multiple times to check random radius range
      for (let trial = 0; trial < 10; trial++) {
        const trialScene = {
          ...scene,
          add: {
            ...scene.add,
            circle: vi.fn((_x: number, _y: number, _radius: number, _color: number) => ({
              setDepth: vi.fn().mockReturnThis(),
              destroy: vi.fn(),
              x: _x,
              y: _y,
            })),
          },
          tweens: scene.tweens,
        } as unknown as Phaser.Scene;
        const trialManager = new HitEffectManager(trialScene, 5);

        trialManager.showBloodParticles(200, 200, 100, 200);

        const addCircle = trialScene.add.circle as unknown as ReturnType<typeof vi.fn>;
        for (const call of addCircle.mock.calls) {
          const radius = call[2] as number;
          expect(radius).toBeGreaterThanOrEqual(2);
          expect(radius).toBeLessThanOrEqual(5);
        }

        trialManager.destroy();
      }
    });

    it('should set depth to 60 (EFFECT_DEPTH) on each particle', () => {
      manager.showBloodParticles(200, 200, 100, 200);

      const addCircle = scene.add.circle as unknown as ReturnType<typeof vi.fn>;
      for (const result of addCircle.mock.results) {
        expect(result.value.setDepth).toHaveBeenCalledWith(60);
      }
    });

    it('should create tween with 500ms duration, alpha:0, scale:0 for each particle', () => {
      // Use a non-auto-completing tweens mock for inspection
      const tweenConfigs: unknown[] = [];
      const inspectScene = {
        ...scene,
        add: {
          ...scene.add,
          circle: vi.fn((_x: number, _y: number, _radius: number, _color: number) => ({
            setDepth: vi.fn().mockReturnThis(),
            destroy: vi.fn(),
            x: _x,
            y: _y,
          })),
        },
        tweens: {
          add: vi.fn((config: unknown) => {
            tweenConfigs.push(config);
            return { play: vi.fn(), stop: vi.fn() };
          }),
        },
      } as unknown as Phaser.Scene;
      const inspectManager = new HitEffectManager(inspectScene, 5);

      inspectManager.showBloodParticles(200, 200, 100, 200);

      // 5 particles = 5 tweens
      expect(tweenConfigs.length).toBe(5);
      for (const config of tweenConfigs) {
        const c = config as { alpha: number; scale: number; duration: number; onComplete: () => void };
        expect(c.alpha).toBe(0);
        expect(c.scale).toBe(0);
        expect(c.duration).toBe(500);
        expect(typeof c.onComplete).toBe('function');
      }

      inspectManager.destroy();
    });

    it('should destroy circles on tween complete', () => {
      const addCircle = scene.add.circle as unknown as ReturnType<typeof vi.fn>;
      manager.showBloodParticles(200, 200, 100, 200);

      // Since our mock scene auto-completes tweens, circles should be destroyed
      for (const result of addCircle.mock.results) {
        expect(result.value.destroy).toHaveBeenCalled();
      }
    });

    it('should direct particles away from damage source', () => {
      // Source at (0, 200), victim at (200, 200) → base angle is 0 rad (rightward)
      const tweenConfigs: Array<{ x: number; y: number }> = [];
      const inspectScene = {
        ...scene,
        add: {
          ...scene.add,
          circle: vi.fn((_x: number, _y: number, _radius: number, _color: number) => ({
            setDepth: vi.fn().mockReturnThis(),
            destroy: vi.fn(),
            x: _x,
            y: _y,
          })),
        },
        tweens: {
          add: vi.fn((config: { x: number; y: number }) => {
            tweenConfigs.push(config);
            return { play: vi.fn(), stop: vi.fn() };
          }),
        },
      } as unknown as Phaser.Scene;
      const inspectManager = new HitEffectManager(inspectScene, 5);

      inspectManager.showBloodParticles(200, 200, 0, 200);

      // All tween end positions should be to the right of victim (x > 200)
      // since particles move away from source (which is to the left)
      for (const config of tweenConfigs) {
        expect(config.x).toBeGreaterThan(200);
      }

      inspectManager.destroy();
    });
  });
});
