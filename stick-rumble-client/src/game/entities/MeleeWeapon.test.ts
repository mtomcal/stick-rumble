/**
 * Tests for MeleeWeapon entity
 *
 * Phase 3 Critical Tests: Rendering validation to catch bugs that slip through mocks
 * These tests verify that graphics methods are actually called, not just mocked
 */
import { describe, it, expect, beforeEach } from 'vitest';
import Phaser from 'phaser';
import { MeleeWeapon } from './MeleeWeapon';

describe('MeleeWeapon', () => {
  let scene: Phaser.Scene;
  let weapon: MeleeWeapon;

  beforeEach(() => {
    // Use enhanced Phaser mock with real state tracking
    scene = new Phaser.Scene({ key: 'TestScene' });
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

    it('should create bat with lowercase type (server format)', () => {
      const lowercaseWeapon = new MeleeWeapon(scene, 100, 100, 'bat');
      expect(lowercaseWeapon.weaponType).toBe('bat');
      expect(lowercaseWeapon.getRange()).toBe(64);
      expect(lowercaseWeapon.getArcDegrees()).toBe(90);
    });

    it('should render 90-degree swing arc for Bat', () => {
      const graphics = (weapon as any).graphics;
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
      const graphics = (weapon as any).graphics;

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

    it('should create katana with lowercase type (server format)', () => {
      const lowercaseWeapon = new MeleeWeapon(scene, 100, 100, 'katana');
      expect(lowercaseWeapon.weaponType).toBe('katana');
      expect(lowercaseWeapon.getRange()).toBe(80);
      expect(lowercaseWeapon.getArcDegrees()).toBe(90);
    });

    it('should render longer range than Bat', () => {
      const bat = new MeleeWeapon(scene, 100, 100, 'Bat');
      const katana = new MeleeWeapon(scene, 100, 100, 'Katana');

      expect(katana.getRange()).toBeGreaterThan(bat.getRange());
    });

    it('should have different visual appearance from Bat', () => {
      const graphics = (weapon as any).graphics;

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
      const graphics = (weapon as any).graphics;

      weapon.startSwing(0);
      expect(graphics.visible).toBe(true);

      scene.time.now = 200;
      weapon.update();
      expect(graphics.visible).toBe(false);
    });
  });

  describe('Position updates', () => {
    beforeEach(() => {
      weapon = new MeleeWeapon(scene, 100, 100, 'Bat');
    });

    it('should update position when setPosition is called', () => {
      weapon.setPosition(200, 300);

      // Position update should be reflected in internal state
      expect((weapon as any).x).toBe(200);
      expect((weapon as any).y).toBe(300);
    });

    it('should follow player position during swing', () => {
      weapon.startSwing(0);
      weapon.setPosition(150, 150);

      scene.time.now = 100;
      weapon.update();

      weapon.setPosition(200, 200);
      weapon.update();

      // Position should be updated in internal state
      expect((weapon as any).x).toBe(200);
      expect((weapon as any).y).toBe(200);
    });
  });

  describe('Cleanup', () => {
    beforeEach(() => {
      weapon = new MeleeWeapon(scene, 100, 100, 'Bat');
    });

    it('should destroy graphics on destroy', () => {
      const graphics = (weapon as any).graphics;
      weapon.destroy();

      expect(graphics.destroyed).toBe(true);
    });

    it('should clear swing state on destroy', () => {
      weapon.startSwing(0);
      weapon.destroy();

      // Should not throw when updating after destroy
      expect(() => weapon.update()).not.toThrow();
    });
  });

  describe('Phase 3 Critical: Rendering Validation', () => {
    describe('Graphics visibility tracking', () => {
      beforeEach(() => {
        weapon = new MeleeWeapon(scene, 100, 100, 'Bat');
      });

      it('should create graphics object that is initially invisible', () => {
        const graphics = (weapon as any).graphics;
        expect(graphics.visible).toBe(false);
      });

      it('should make graphics visible during swing', () => {
        const graphics = (weapon as any).graphics;
        weapon.startSwing(0);
        expect(graphics.visible).toBe(true);
      });

      it('should hide graphics after swing completes', () => {
        const graphics = (weapon as any).graphics;
        weapon.startSwing(0);

        scene.time.now = 250; // Beyond 200ms duration
        weapon.update();

        expect(graphics.visible).toBe(false);
        expect(graphics.clear).toHaveBeenCalled();
      });

      it('should set graphics depth to 100 (render above players)', () => {
        const graphics = (weapon as any).graphics;
        expect(graphics.depth).toBe(100);
      });
    });

    describe('Bat rendering validation', () => {
      beforeEach(() => {
        weapon = new MeleeWeapon(scene, 100, 100, 'Bat');
      });

      it('should call graphics.arc() when rendering Bat swing', () => {
        const graphics = (weapon as any).graphics;
        weapon.showSwingAnimation(0);
        expect(graphics.arc).toHaveBeenCalled();
      });

      it('should use brown color (0x8B4513) for Bat', () => {
        const graphics = (weapon as any).graphics;
        weapon.showSwingAnimation(0);
        expect(graphics.lineStyle).toHaveBeenCalledWith(3, 0x8B4513, 0.8);
      });

      it('should render 90-degree arc at correct position', () => {
        const graphics = (weapon as any).graphics;
        weapon.showSwingAnimation(0);

        expect(graphics.arc).toHaveBeenCalledWith(
          100, // x position
          100, // y position
          64,  // Bat range
          expect.any(Number), // startAngle
          expect.any(Number), // endAngle
          false
        );

        // Verify arc span is 90 degrees (PI/2 radians)
        const arcCall = graphics.arc.mock.calls[0];
        const startAngle = arcCall[3];
        const endAngle = arcCall[4];
        const arcSpan = endAngle - startAngle;
        expect(arcSpan).toBeCloseTo(Math.PI / 2, 5);
      });

      it('should render both stroke and fill', () => {
        const graphics = (weapon as any).graphics;
        weapon.showSwingAnimation(0);

        expect(graphics.strokePath).toHaveBeenCalled();
        expect(graphics.fillPath).toHaveBeenCalled();
        expect(graphics.fillStyle).toHaveBeenCalledWith(0x8B4513, 0.2);
      });

      it('should clear graphics before each frame', () => {
        const graphics = (weapon as any).graphics;
        weapon.showSwingAnimation(0);
        expect(graphics.clear).toHaveBeenCalledTimes(1);

        weapon.showSwingAnimation(Math.PI / 2);
        expect(graphics.clear).toHaveBeenCalledTimes(2);
      });
    });

    describe('Katana rendering validation', () => {
      beforeEach(() => {
        weapon = new MeleeWeapon(scene, 100, 100, 'Katana');
      });

      it('should call graphics.arc() when rendering Katana swing', () => {
        const graphics = (weapon as any).graphics;
        weapon.showSwingAnimation(0);
        expect(graphics.arc).toHaveBeenCalled();
      });

      it('should use silver color (0xC0C0C0) for Katana', () => {
        const graphics = (weapon as any).graphics;
        weapon.showSwingAnimation(0);
        expect(graphics.lineStyle).toHaveBeenCalledWith(3, 0xC0C0C0, 0.8);
      });

      it('should render 90-degree arc with longer range (80px)', () => {
        const graphics = (weapon as any).graphics;
        weapon.showSwingAnimation(Math.PI / 4); // 45 degrees

        expect(graphics.arc).toHaveBeenCalledWith(
          100, // x position
          100, // y position
          80,  // Katana range (longer than Bat)
          expect.any(Number),
          expect.any(Number),
          false
        );

        const arcCall = graphics.arc.mock.calls[0];
        const startAngle = arcCall[3];
        const endAngle = arcCall[4];
        const arcSpan = endAngle - startAngle;
        expect(arcSpan).toBeCloseTo(Math.PI / 2, 5);
      });
    });

    describe('Graphics destruction validation', () => {
      beforeEach(() => {
        weapon = new MeleeWeapon(scene, 100, 100, 'Bat');
      });

      it('should mark graphics as destroyed when weapon is destroyed', () => {
        const graphics = (weapon as any).graphics;
        expect(graphics.destroyed).toBe(false);

        weapon.destroy();
        expect(graphics.destroyed).toBe(true);
      });

      it('should not error if graphics is null during destroy', () => {
        (weapon as any).graphics = null;
        expect(() => weapon.destroy()).not.toThrow();
      });
    });
  });
});
