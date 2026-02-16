/**
 * Tests for MeleeWeapon entity
 *
 * Validates: white stroke-only arc, alpha fade tween, weapon container rotation tween
 */
import { describe, it, expect, beforeEach } from 'vitest';
import Phaser from 'phaser';
import { MeleeWeapon } from './MeleeWeapon';

describe('MeleeWeapon', () => {
  let scene: Phaser.Scene;
  let weapon: MeleeWeapon;

  beforeEach(() => {
    scene = new Phaser.Scene({ key: 'TestScene' });
  });

  describe('Bat', () => {
    beforeEach(() => {
      weapon = new MeleeWeapon(scene, 100, 100, 'Bat');
    });

    it('should create a Bat with range=90 and arcDegrees=80', () => {
      expect(weapon.weaponType).toBe('Bat');
      expect(weapon.getRange()).toBe(90);
      expect(weapon.getArcDegrees()).toBe(80);
    });

    it('should create bat with lowercase type (server format)', () => {
      const lowercaseWeapon = new MeleeWeapon(scene, 100, 100, 'bat');
      expect(lowercaseWeapon.weaponType).toBe('bat');
      expect(lowercaseWeapon.getRange()).toBe(90);
      expect(lowercaseWeapon.getArcDegrees()).toBe(80);
    });
  });

  describe('Katana', () => {
    beforeEach(() => {
      weapon = new MeleeWeapon(scene, 100, 100, 'Katana');
    });

    it('should create a Katana with range=110 and arcDegrees=80', () => {
      expect(weapon.weaponType).toBe('Katana');
      expect(weapon.getRange()).toBe(110);
      expect(weapon.getArcDegrees()).toBe(80);
    });

    it('should create katana with lowercase type (server format)', () => {
      const lowercaseWeapon = new MeleeWeapon(scene, 100, 100, 'katana');
      expect(lowercaseWeapon.weaponType).toBe('katana');
      expect(lowercaseWeapon.getRange()).toBe(110);
      expect(lowercaseWeapon.getArcDegrees()).toBe(80);
    });

    it('should have longer range than Bat', () => {
      const bat = new MeleeWeapon(scene, 100, 100, 'Bat');
      expect(weapon.getRange()).toBeGreaterThan(bat.getRange());
    });
  });

  describe('Swing state management', () => {
    beforeEach(() => {
      weapon = new MeleeWeapon(scene, 100, 100, 'Bat');
    });

    it('should not allow starting new swing while swinging', () => {
      weapon.startSwing(0);
      expect(weapon.isSwinging()).toBe(true);

      const result = weapon.startSwing(Math.PI);
      expect(result).toBe(false);
      expect(weapon.isSwinging()).toBe(true);
    });

    it('should allow new swing after tween completes', () => {
      weapon.startSwing(0);
      expect(weapon.isSwinging()).toBe(true);

      // Manually invoke the onComplete callback from the tween
      const tweenCall = (scene.tweens.add as ReturnType<typeof import('vitest').vi.fn>).mock.calls[0][0];
      tweenCall.onComplete();
      expect(weapon.isSwinging()).toBe(false);

      const result = weapon.startSwing(Math.PI);
      expect(result).toBe(true);
    });
  });

  describe('Position updates', () => {
    beforeEach(() => {
      weapon = new MeleeWeapon(scene, 100, 100, 'Bat');
    });

    it('should update position when setPosition is called', () => {
      weapon.setPosition(200, 300);
      expect((weapon as any).x).toBe(200);
      expect((weapon as any).y).toBe(300);
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
      expect(weapon.isSwinging()).toBe(false);
    });

    it('should not error if graphics is null during destroy', () => {
      (weapon as any).graphics = null;
      expect(() => weapon.destroy()).not.toThrow();
    });
  });

  describe('TS-MELEE-013: White stroke-only arc renders correctly', () => {
    beforeEach(() => {
      weapon = new MeleeWeapon(scene, 100, 100, 'Bat');
    });

    it('should use white color (0xFFFFFF) with 2px stroke and 0.8 alpha for all weapons', () => {
      const graphics = (weapon as any).graphics;
      weapon.showSwingAnimation(0);
      expect(graphics.lineStyle).toHaveBeenCalledWith(2, 0xFFFFFF, 0.8);
    });

    it('should use same white color for Katana (no per-weapon colors)', () => {
      const katana = new MeleeWeapon(scene, 100, 100, 'Katana');
      const graphics = (katana as any).graphics;
      katana.showSwingAnimation(0);
      expect(graphics.lineStyle).toHaveBeenCalledWith(2, 0xFFFFFF, 0.8);
    });

    it('should render stroke path only (no fill)', () => {
      const graphics = (weapon as any).graphics;
      weapon.showSwingAnimation(0);

      expect(graphics.strokePath).toHaveBeenCalled();
      expect(graphics.fillPath).not.toHaveBeenCalled();
      expect(graphics.fillStyle).not.toHaveBeenCalled();
    });

    it('should render 80-degree arc at Bat range (90px)', () => {
      const graphics = (weapon as any).graphics;
      weapon.showSwingAnimation(0);

      expect(graphics.arc).toHaveBeenCalledWith(
        100, // x position
        100, // y position
        90,  // Bat range
        expect.any(Number),
        expect.any(Number),
        false
      );

      // Verify arc span is 80 degrees (80 * PI / 180 ≈ 1.3963 radians)
      const arcCall = graphics.arc.mock.calls[0];
      const startAngle = arcCall[3];
      const endAngle = arcCall[4];
      const arcSpan = endAngle - startAngle;
      expect(arcSpan).toBeCloseTo(80 * Math.PI / 180, 5);
    });

    it('should render 80-degree arc at Katana range (110px)', () => {
      const katana = new MeleeWeapon(scene, 100, 100, 'Katana');
      const graphics = (katana as any).graphics;
      katana.showSwingAnimation(Math.PI / 4);

      expect(graphics.arc).toHaveBeenCalledWith(
        100,
        100,
        110, // Katana range
        expect.any(Number),
        expect.any(Number),
        false
      );

      const arcCall = graphics.arc.mock.calls[0];
      const arcSpan = arcCall[4] - arcCall[3];
      expect(arcSpan).toBeCloseTo(80 * Math.PI / 180, 5);
    });

    it('should clear graphics before each render', () => {
      const graphics = (weapon as any).graphics;
      weapon.showSwingAnimation(0);
      expect(graphics.clear).toHaveBeenCalledTimes(1);

      weapon.showSwingAnimation(Math.PI / 2);
      expect(graphics.clear).toHaveBeenCalledTimes(2);
    });

    it('should set graphics depth to 100', () => {
      const graphics = (weapon as any).graphics;
      expect(graphics.depth).toBe(100);
    });
  });

  describe('TS-GFX-013: Melee arc renders as white stroke-only', () => {
    it('should render Bat arc with exact stroke params (2px, 0xFFFFFF, 0.8)', () => {
      const bat = new MeleeWeapon(scene, 50, 75, 'Bat');
      const graphics = (bat as any).graphics;
      bat.showSwingAnimation(Math.PI);

      expect(graphics.lineStyle).toHaveBeenCalledWith(2, 0xFFFFFF, 0.8);
      expect(graphics.arc).toHaveBeenCalledWith(
        50, 75, 90,
        expect.any(Number), expect.any(Number), false
      );
      expect(graphics.strokePath).toHaveBeenCalledTimes(1);
      expect(graphics.fillPath).not.toHaveBeenCalled();
    });

    it('should render Katana arc with exact stroke params (2px, 0xFFFFFF, 0.8)', () => {
      const katana = new MeleeWeapon(scene, 200, 150, 'Katana');
      const graphics = (katana as any).graphics;
      katana.showSwingAnimation(0);

      expect(graphics.lineStyle).toHaveBeenCalledWith(2, 0xFFFFFF, 0.8);
      expect(graphics.arc).toHaveBeenCalledWith(
        200, 150, 110,
        expect.any(Number), expect.any(Number), false
      );
      expect(graphics.strokePath).toHaveBeenCalledTimes(1);
      expect(graphics.fillPath).not.toHaveBeenCalled();
    });
  });

  describe('Alpha fade tween (startSwing)', () => {
    beforeEach(() => {
      weapon = new MeleeWeapon(scene, 100, 100, 'Bat');
    });

    it('should create alpha fade tween with duration=200 targeting graphics', () => {
      weapon.startSwing(0);

      expect(scene.tweens.add).toHaveBeenCalledWith(
        expect.objectContaining({
          targets: (weapon as any).graphics,
          alpha: 0,
          duration: 200,
          onComplete: expect.any(Function),
        })
      );
    });

    it('should make graphics visible at start of swing', () => {
      const graphics = (weapon as any).graphics;
      weapon.startSwing(0);
      // Graphics was set visible before tween started
      // (tween onComplete fires immediately in mock, but setVisible(true) was called first)
      expect(graphics.setVisible).toHaveBeenCalledWith(true);
    });
  });

  describe('TS-MELEE-015: Weapon container rotation tween', () => {
    beforeEach(() => {
      weapon = new MeleeWeapon(scene, 100, 100, 'Bat');
    });

    it('should create rotation tween when weaponContainer is provided', () => {
      const container = { angle: 0 } as Phaser.GameObjects.Container;
      weapon.startSwing(0, container);

      // Should have 2 tweens: arc fade + container rotation
      expect(scene.tweens.add).toHaveBeenCalledTimes(2);

      // Second call should be the container rotation tween
      const rotationCall = (scene.tweens.add as ReturnType<typeof import('vitest').vi.fn>).mock.calls[1][0];
      expect(rotationCall.targets).toBe(container);
      expect(rotationCall.angle).toEqual({ from: -45, to: 60 });
      expect(rotationCall.duration).toBe(100);
      expect(rotationCall.yoyo).toBe(true);
    });

    it('should not create rotation tween when no weaponContainer', () => {
      weapon.startSwing(0);

      // Only 1 tween (arc fade), no container rotation
      expect(scene.tweens.add).toHaveBeenCalledTimes(1);
    });

    it('should offset rotation from container current angle', () => {
      const container = { angle: 30 } as Phaser.GameObjects.Container;
      weapon.startSwing(0, container);

      const rotationCall = (scene.tweens.add as ReturnType<typeof import('vitest').vi.fn>).mock.calls[1][0];
      expect(rotationCall.angle).toEqual({ from: 30 + (-45), to: 30 + 60 });
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
  });
});
