/**
 * Tests for ScreenShake effect
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import Phaser from 'phaser';
import { ScreenShake } from './ScreenShake';

describe('ScreenShake', () => {
  let camera: Phaser.Cameras.Scene2D.Camera;
  let screenShake: ScreenShake;

  beforeEach(() => {
    // Create a minimal camera mock
    camera = {
      shake: vi.fn(),
      isShaking: false,
    } as unknown as Phaser.Cameras.Scene2D.Camera;

    screenShake = new ScreenShake(camera);
  });

  describe('Bat hit shake', () => {
    it('should trigger screen shake on Bat hit', () => {
      screenShake.shakeOnBatHit();

      expect(camera.shake).toHaveBeenCalled();
    });

    it('should use appropriate intensity for Bat hit', () => {
      screenShake.shakeOnBatHit();

      const callArgs = (camera.shake as ReturnType<typeof vi.fn>).mock.calls[0];
      const duration = callArgs[0];
      const intensity = callArgs[1];

      expect(duration).toBeGreaterThan(0);
      expect(intensity).toBeGreaterThan(0);
    });

    it('should shake for short duration (satisfying thwack feel)', () => {
      screenShake.shakeOnBatHit();

      const callArgs = (camera.shake as ReturnType<typeof vi.fn>).mock.calls[0];
      const duration = callArgs[0];

      // Short shake for impact feel (< 500ms)
      expect(duration).toBeLessThan(500);
      expect(duration).toBeGreaterThan(50);
    });

    it('should allow multiple shakes in sequence', () => {
      screenShake.shakeOnBatHit();
      screenShake.shakeOnBatHit();
      screenShake.shakeOnBatHit();

      expect(camera.shake).toHaveBeenCalledTimes(3);
    });
  });

  describe('Custom shake', () => {
    it('should allow custom shake with specified duration and intensity', () => {
      screenShake.shake(300, 0.01);

      expect(camera.shake).toHaveBeenCalledWith(300, 0.01);
    });

    it('should handle zero intensity gracefully', () => {
      screenShake.shake(100, 0);

      expect(camera.shake).toHaveBeenCalledWith(100, 0);
    });

    it('should handle very short duration', () => {
      screenShake.shake(10, 0.005);

      expect(camera.shake).toHaveBeenCalledWith(10, 0.005);
    });

    it('should handle long duration shake', () => {
      screenShake.shake(1000, 0.02);

      expect(camera.shake).toHaveBeenCalledWith(1000, 0.02);
    });
  });

  describe('Configuration', () => {
    it('should use default intensity if not specified', () => {
      const defaultShake = new ScreenShake(camera);
      defaultShake.shakeOnBatHit();

      expect(camera.shake).toHaveBeenCalled();
    });

    it('should allow custom default intensity', () => {
      const customShake = new ScreenShake(camera, 0.02);
      customShake.shakeOnBatHit();

      const callArgs = (camera.shake as ReturnType<typeof vi.fn>).mock.calls[0];
      const intensity = callArgs[1];

      expect(intensity).toBe(0.02);
    });
  });

  describe('Edge cases', () => {
    it('should not throw when camera is null', () => {
      const nullShake = new ScreenShake(null as unknown as Phaser.Cameras.Scene2D.Camera);

      expect(() => nullShake.shakeOnBatHit()).not.toThrow();
    });

    it('should not throw when shake is called rapidly', () => {
      expect(() => {
        for (let i = 0; i < 100; i++) {
          screenShake.shake(50, 0.005);
        }
      }).not.toThrow();
    });
  });
});
