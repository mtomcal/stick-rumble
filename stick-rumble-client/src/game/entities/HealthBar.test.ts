import { describe, it, expect, beforeEach, vi } from 'vitest';
import Phaser from 'phaser';
import { HealthBar } from './HealthBar';
import { COLORS } from '../../shared/constants';

describe('HealthBar', () => {
  let scene: Phaser.Scene;
  let healthBar: HealthBar;

  beforeEach(() => {
    // Create minimal scene mock
    const mockGraphics = {
      clear: vi.fn().mockReturnThis(),
      fillStyle: vi.fn().mockReturnThis(),
      fillRect: vi.fn().mockReturnThis(),
      setPosition: vi.fn().mockReturnThis(),
      destroy: vi.fn(),
    };

    scene = {
      add: {
        graphics: vi.fn().mockReturnValue(mockGraphics),
      },
    } as unknown as Phaser.Scene;
  });

  describe('constructor', () => {
    it('should create a health bar with correct initial dimensions', () => {
      healthBar = new HealthBar(scene, 100, 100);

      expect(scene.add.graphics).toHaveBeenCalled();
      expect(healthBar).toBeDefined();
    });

    it('should initialize with 100 health by default', () => {
      healthBar = new HealthBar(scene, 100, 100);

      expect(healthBar.getHealth()).toBe(100);
    });
  });

  describe('setHealth', () => {
    beforeEach(() => {
      healthBar = new HealthBar(scene, 100, 100);
    });

    it('should update health value', () => {
      healthBar.setHealth(50);
      expect(healthBar.getHealth()).toBe(50);
    });

    it('should clamp health to 0-100 range (lower bound)', () => {
      healthBar.setHealth(-10);
      expect(healthBar.getHealth()).toBe(0);
    });

    it('should clamp health to 0-100 range (upper bound)', () => {
      healthBar.setHealth(150);
      expect(healthBar.getHealth()).toBe(100);
    });

    it('should redraw the health bar when health changes', () => {
      const graphics = (scene.add.graphics as any).mock.results[0].value;
      graphics.clear.mockClear();
      graphics.fillStyle.mockClear();
      graphics.fillRect.mockClear();

      healthBar.setHealth(75);

      expect(graphics.clear).toHaveBeenCalled();
      expect(graphics.fillStyle).toHaveBeenCalledTimes(2); // Gray background + green fill
      expect(graphics.fillRect).toHaveBeenCalledTimes(2);
    });

    it('should draw gray background with full width', () => {
      const graphics = (scene.add.graphics as any).mock.results[0].value;
      graphics.fillRect.mockClear();

      healthBar.setHealth(50);

      // First fillRect call is gray background (full width)
      expect(graphics.fillRect).toHaveBeenNthCalledWith(
        1,
        0, 0, // x, y
        32, 4 // width, height
      );
    });

    it('should draw green health fill proportional to health percentage', () => {
      const graphics = (scene.add.graphics as any).mock.results[0].value;
      graphics.fillRect.mockClear();

      healthBar.setHealth(50);

      // Second fillRect call is green fill (50% = 16px width)
      expect(graphics.fillRect).toHaveBeenNthCalledWith(
        2,
        0, 0, // x, y
        16, 4 // width (50% of 32), height
      );
    });

    it('should draw zero-width health bar when health is 0', () => {
      const graphics = (scene.add.graphics as any).mock.results[0].value;
      graphics.fillRect.mockClear();

      healthBar.setHealth(0);

      // Green fill should be 0 width
      expect(graphics.fillRect).toHaveBeenNthCalledWith(
        2,
        0, 0, // x, y
        0, 4 // width (0% of 32), height
      );
    });

    it('should draw full-width health bar when health is 100', () => {
      const graphics = (scene.add.graphics as any).mock.results[0].value;
      graphics.fillRect.mockClear();

      healthBar.setHealth(100);

      // Green fill should be full width
      expect(graphics.fillRect).toHaveBeenNthCalledWith(
        2,
        0, 0, // x, y
        32, 4 // width (100% of 32), height
      );
    });
  });

  describe('setPosition', () => {
    beforeEach(() => {
      healthBar = new HealthBar(scene, 100, 100);
    });

    it('should center the health bar horizontally above the given position', () => {
      const graphics = (scene.add.graphics as any).mock.results[0].value;
      graphics.setPosition.mockClear();

      // Health bar is 32px wide, so should be offset by -16px to center
      healthBar.setPosition(200, 150);

      expect(graphics.setPosition).toHaveBeenCalledWith(200 - 16, 150);
    });

    it('should center the health bar for different positions', () => {
      const graphics = (scene.add.graphics as any).mock.results[0].value;
      graphics.setPosition.mockClear();

      healthBar.setPosition(100, 100);

      expect(graphics.setPosition).toHaveBeenCalledWith(100 - 16, 100);
    });
  });

  describe('destroy', () => {
    beforeEach(() => {
      healthBar = new HealthBar(scene, 100, 100);
    });

    it('should destroy the graphics object', () => {
      const graphics = (scene.add.graphics as any).mock.results[0].value;

      healthBar.destroy();

      expect(graphics.destroy).toHaveBeenCalled();
    });
  });

  describe('getHealth', () => {
    beforeEach(() => {
      healthBar = new HealthBar(scene, 100, 100);
    });

    it('should return current health value', () => {
      healthBar.setHealth(75);
      expect(healthBar.getHealth()).toBe(75);
    });
  });

  describe('visual appearance', () => {
    beforeEach(() => {
      healthBar = new HealthBar(scene, 100, 100);
    });

    it('should use depleted background color (COLORS.HEALTH_DEPLETED_BG = 0x333333)', () => {
      const graphics = (scene.add.graphics as any).mock.results[0].value;
      graphics.fillStyle.mockClear();

      healthBar.setHealth(50);

      // First fillStyle call is depleted background
      expect(graphics.fillStyle).toHaveBeenNthCalledWith(1, 0x333333);
    });

    it('should use COLORS.HEALTH_FULL (green) for health fill at >= 20%', () => {
      const graphics = (scene.add.graphics as any).mock.results[0].value;
      graphics.fillStyle.mockClear();

      healthBar.setHealth(50);

      // Second fillStyle call uses COLORS.HEALTH_FULL (green at >= 20%)
      expect(graphics.fillStyle).toHaveBeenNthCalledWith(2, COLORS.HEALTH_FULL);
    });

    it('should use COLORS.HEALTH_CRITICAL (red) for health fill at < 20%', () => {
      const graphics = (scene.add.graphics as any).mock.results[0].value;
      graphics.fillStyle.mockClear();

      healthBar.setHealth(19);

      // Second fillStyle call uses COLORS.HEALTH_CRITICAL (red at < 20%)
      expect(graphics.fillStyle).toHaveBeenNthCalledWith(2, COLORS.HEALTH_CRITICAL);
    });

    it('should use COLORS.HEALTH_FULL at exactly 20% threshold', () => {
      const graphics = (scene.add.graphics as any).mock.results[0].value;
      graphics.fillStyle.mockClear();

      healthBar.setHealth(20);

      expect(graphics.fillStyle).toHaveBeenNthCalledWith(2, COLORS.HEALTH_FULL);
    });
  });
});
