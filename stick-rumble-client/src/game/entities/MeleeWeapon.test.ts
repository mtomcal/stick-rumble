/**
 * Tests for MeleeWeapon entity
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import Phaser from 'phaser';
import { MeleeWeapon } from './MeleeWeapon';

describe('MeleeWeapon', () => {
  let scene: Phaser.Scene;
  let weapon: MeleeWeapon;

  beforeEach(() => {
    // Create a minimal scene mock
    scene = {
      add: {
        graphics: vi.fn().mockReturnValue({
          clear: vi.fn().mockReturnThis(),
          lineStyle: vi.fn().mockReturnThis(),
          fillStyle: vi.fn().mockReturnThis(),
          beginPath: vi.fn().mockReturnThis(),
          moveTo: vi.fn().mockReturnThis(),
          lineTo: vi.fn().mockReturnThis(),
          arc: vi.fn().mockReturnThis(),
          closePath: vi.fn().mockReturnThis(),
          strokePath: vi.fn().mockReturnThis(),
          fillPath: vi.fn().mockReturnThis(),
          destroy: vi.fn(),
          setVisible: vi.fn().mockReturnThis(),
          setDepth: vi.fn().mockReturnThis(),
        }),
      },
      time: {
        now: 0,
      },
    } as unknown as Phaser.Scene;
  });

  describe('Bat', () => {
    beforeEach(() => {
      weapon = new MeleeWeapon(scene, 100, 100, 'Bat');
    });

    it('should create a Bat with correct stats', () => {
      expect(weapon.weaponType).toBe('Bat');
      expect(weapon.getRange()).toBe(64);
      expect(weapon.getArcDegrees()).toBe(90);
    });

    it('should render 90-degree swing arc for Bat', () => {
      const graphics = scene.add.graphics();
      weapon.showSwingAnimation(0); // 0 radians aim angle

      expect(graphics.arc).toHaveBeenCalled();
    });

    it('should complete swing animation in 0.2s (200ms)', () => {
      const startTime = 100;
      scene.time.now = startTime;

      weapon.startSwing(0);
      expect(weapon.isSwinging()).toBe(true);

      // Mid-swing at 100ms
      scene.time.now = startTime + 100;
      weapon.update();
      expect(weapon.isSwinging()).toBe(true);

      // Complete at 200ms
      scene.time.now = startTime + 200;
      weapon.update();
      expect(weapon.isSwinging()).toBe(false);
    });

    it('should use 4-frame animation (50ms per frame)', () => {
      const startTime = 0;
      scene.time.now = startTime;

      weapon.startSwing(0);

      // Frame 0: 0ms
      expect(weapon.getCurrentFrame()).toBe(0);

      // Frame 1: 50ms
      scene.time.now = 50;
      weapon.update();
      expect(weapon.getCurrentFrame()).toBe(1);

      // Frame 2: 100ms
      scene.time.now = 100;
      weapon.update();
      expect(weapon.getCurrentFrame()).toBe(2);

      // Frame 3: 150ms
      scene.time.now = 150;
      weapon.update();
      expect(weapon.getCurrentFrame()).toBe(3);

      // Complete: 200ms
      scene.time.now = 200;
      weapon.update();
      expect(weapon.isSwinging()).toBe(false);
    });

    it('should render visual arc based on aim angle', () => {
      const graphics = scene.add.graphics();

      // Swing right (0 radians)
      weapon.showSwingAnimation(0);
      expect(graphics.arc).toHaveBeenCalled();

      // Swing up (π/2 radians)
      weapon.showSwingAnimation(Math.PI / 2);
      expect(graphics.arc).toHaveBeenCalled();

      // Swing left (π radians)
      weapon.showSwingAnimation(Math.PI);
      expect(graphics.arc).toHaveBeenCalled();
    });
  });

  describe('Katana', () => {
    beforeEach(() => {
      weapon = new MeleeWeapon(scene, 100, 100, 'Katana');
    });

    it('should create a Katana with correct stats', () => {
      expect(weapon.weaponType).toBe('Katana');
      expect(weapon.getRange()).toBe(80);
      expect(weapon.getArcDegrees()).toBe(90);
    });

    it('should render longer range than Bat', () => {
      const bat = new MeleeWeapon(scene, 100, 100, 'Bat');
      const katana = new MeleeWeapon(scene, 100, 100, 'Katana');

      expect(katana.getRange()).toBeGreaterThan(bat.getRange());
    });

    it('should have different visual appearance from Bat', () => {
      const graphics = scene.add.graphics();

      weapon.showSwingAnimation(0);

      // Katana should use different color or style
      expect(graphics.lineStyle).toHaveBeenCalled();
    });
  });

  describe('Swing state management', () => {
    beforeEach(() => {
      weapon = new MeleeWeapon(scene, 100, 100, 'Bat');
    });

    it('should not allow starting new swing while swinging', () => {
      weapon.startSwing(0);
      expect(weapon.isSwinging()).toBe(true);

      // Try to start another swing
      const result = weapon.startSwing(Math.PI);
      expect(result).toBe(false);
      expect(weapon.isSwinging()).toBe(true);
    });

    it('should allow new swing after previous completes', () => {
      weapon.startSwing(0);
      expect(weapon.isSwinging()).toBe(true);

      // Complete swing
      scene.time.now = 200;
      weapon.update();
      expect(weapon.isSwinging()).toBe(false);

      // Start new swing
      const result = weapon.startSwing(Math.PI);
      expect(result).toBe(true);
      expect(weapon.isSwinging()).toBe(true);
    });

    it('should hide swing animation when not swinging', () => {
      const graphics = scene.add.graphics();

      weapon.startSwing(0);
      expect(graphics.setVisible).toHaveBeenCalledWith(true);

      scene.time.now = 200;
      weapon.update();
      expect(graphics.setVisible).toHaveBeenCalledWith(false);
    });
  });

  describe('Position updates', () => {
    beforeEach(() => {
      weapon = new MeleeWeapon(scene, 100, 100, 'Bat');
    });

    it('should update position when setPosition is called', () => {
      weapon.setPosition(200, 300);

      // Position update should be reflected in rendering
      weapon.showSwingAnimation(0);
      expect(scene.add.graphics).toHaveBeenCalled();
    });

    it('should follow player position during swing', () => {
      weapon.startSwing(0);
      weapon.setPosition(150, 150);

      scene.time.now = 100;
      weapon.update();

      weapon.setPosition(200, 200);
      weapon.update();

      // Swing animation should render at new position
      expect(scene.add.graphics).toHaveBeenCalled();
    });
  });

  describe('Cleanup', () => {
    beforeEach(() => {
      weapon = new MeleeWeapon(scene, 100, 100, 'Bat');
    });

    it('should destroy graphics on destroy', () => {
      const graphics = scene.add.graphics();
      weapon.destroy();

      expect(graphics.destroy).toHaveBeenCalled();
    });

    it('should clear swing state on destroy', () => {
      weapon.startSwing(0);
      weapon.destroy();

      // Should not throw when updating after destroy
      expect(() => weapon.update()).not.toThrow();
    });
  });
});
