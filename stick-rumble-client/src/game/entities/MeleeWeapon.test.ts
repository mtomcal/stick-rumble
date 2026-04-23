/**
 * Tests for MeleeWeapon entity
 *
 * Validates: preview/confirmed swing state, per-weapon arc styling, fade tween lifecycle
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

    it('should use preview styling for startSwing and heavier styling when confirmed', () => {
      const graphics = (weapon as any).graphics;

      weapon.startSwing(0);
      expect(graphics.lineStyle).toHaveBeenLastCalledWith(4, 0xf6d365, 0.4);

      weapon.confirmSwing(0);
      expect(graphics.lineStyle).toHaveBeenLastCalledWith(7, 0xfff2bf, 0.85);
    });

    it('should use katana-specific preview styling', () => {
      const katana = new MeleeWeapon(scene, 100, 100, 'Katana');
      const graphics = (katana as any).graphics;

      katana.startSwing(0);

      expect(graphics.lineStyle).toHaveBeenLastCalledWith(3, 0xb8f2ff, 0.35);
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

    it('should redraw an active swing at the new position', () => {
      const graphics = (weapon as any).graphics;
      weapon.startSwing(0);
      graphics.arc.mockClear();

      weapon.setPosition(200, 300);

      expect(graphics.arc).toHaveBeenCalledWith(
        200,
        300,
        expect.any(Number),
        expect.any(Number),
        expect.any(Number),
        false
      );
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

  describe('TS-MELEE-013: Confirmed swing grammar renders correctly', () => {
    beforeEach(() => {
      weapon = new MeleeWeapon(scene, 100, 100, 'Bat');
    });

    it('should use a heavier bat-confirmed trail style', () => {
      const graphics = (weapon as any).graphics;
      weapon.showSwingAnimation(0);
      expect(graphics.lineStyle).toHaveBeenCalledWith(7, 0xfff2bf, 0.85);
    });

    it('should use a distinct katana-confirmed trail style', () => {
      const katana = new MeleeWeapon(scene, 100, 100, 'Katana');
      const graphics = (katana as any).graphics;
      katana.showSwingAnimation(0);
      expect(graphics.lineStyle).toHaveBeenCalledWith(5, 0xf4fbff, 0.92);
    });

    it('should render stroke path only (no fill)', () => {
      const graphics = (weapon as any).graphics;
      weapon.showSwingAnimation(0);

      expect(graphics.strokePath).toHaveBeenCalled();
      expect(graphics.fillPath).not.toHaveBeenCalled();
      expect(graphics.fillStyle).not.toHaveBeenCalled();
    });

    it('should render the full 80-degree bat-confirmed arc', () => {
      const graphics = (weapon as any).graphics;
      weapon.showSwingAnimation(0);
      expect(graphics.setVisible).toHaveBeenCalledWith(true);

      expect(graphics.arc).toHaveBeenCalledWith(
        100, // x position
        100, // y position
        90,  // Bat confirmed radius
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

    it('should render the full 80-degree katana-confirmed arc with extended radius', () => {
      const katana = new MeleeWeapon(scene, 100, 100, 'Katana');
      const graphics = (katana as any).graphics;
      katana.showSwingAnimation(Math.PI / 4);

      const arcCall = graphics.arc.mock.calls[0];
      expect(arcCall[0]).toBe(100);
      expect(arcCall[1]).toBe(100);
      expect(arcCall[2]).toBeCloseTo(118.8, 5);
      expect(arcCall[5]).toBe(false);
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

  describe('TS-GFX-013: Melee arc renders with weapon-specific readability styling', () => {
    it('should render Bat arc with confirmed bat stroke params', () => {
      const bat = new MeleeWeapon(scene, 50, 75, 'Bat');
      const graphics = (bat as any).graphics;
      bat.showSwingAnimation(Math.PI);

      expect(graphics.lineStyle).toHaveBeenCalledWith(7, 0xfff2bf, 0.85);
      expect(graphics.arc).toHaveBeenCalledWith(
        50, 75, 90,
        expect.any(Number), expect.any(Number), false
      );
      expect(graphics.strokePath).toHaveBeenCalledTimes(1);
      expect(graphics.fillPath).not.toHaveBeenCalled();
    });

    it('should render Katana arc with confirmed katana stroke params', () => {
      const katana = new MeleeWeapon(scene, 200, 150, 'Katana');
      const graphics = (katana as any).graphics;
      katana.showSwingAnimation(0);

      expect(graphics.lineStyle).toHaveBeenCalledWith(5, 0xf4fbff, 0.92);
      const arcCall = graphics.arc.mock.calls[0];
      expect(arcCall[0]).toBe(200);
      expect(arcCall[1]).toBe(150);
      expect(arcCall[2]).toBeCloseTo(118.8, 5);
      expect(arcCall[5]).toBe(false);
      expect(graphics.strokePath).toHaveBeenCalledTimes(1);
      expect(graphics.fillPath).not.toHaveBeenCalled();
    });
  });

  describe('Alpha fade tween (startSwing)', () => {
    beforeEach(() => {
      weapon = new MeleeWeapon(scene, 100, 100, 'Bat');
    });

    it('should create preview fade tween targeting graphics', () => {
      weapon.startSwing(0);

      expect(scene.tweens.add).toHaveBeenCalledWith(
        expect.objectContaining({
          targets: (weapon as any).graphics,
          alpha: 0,
          duration: 90,
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

  describe('TS-MELEE-015: Preview/confirm overlap protection', () => {
    beforeEach(() => {
      weapon = new MeleeWeapon(scene, 100, 100, 'Bat');
    });

    it('should allow preview then upgrade into confirmed swing', () => {
      expect(weapon.startPreviewSwing(0)).toBe(true);
      expect(weapon.confirmSwing(0)).toBe(true);
    });

    it('should not stack multiple confirmed swings on top of each other', () => {
      weapon.confirmSwing(0);
      expect(weapon.confirmSwing(0)).toBe(false);
      expect(scene.tweens.add).toHaveBeenCalledTimes(1);
    });

    it('should keep a harmless preview to a single tween', () => {
      weapon.startPreviewSwing(0);
      expect(scene.tweens.add).toHaveBeenCalledTimes(1);
    });

    it('should not let preview completion clear a later confirmed swing', () => {
      weapon.startPreviewSwing(0);
      const previewTween = (scene.tweens.add as ReturnType<typeof import('vitest').vi.fn>).mock.calls[0][0];

      weapon.confirmSwing(0);
      const graphics = (weapon as any).graphics;
      const setVisibleCallsBeforePreviewCompletion = graphics.setVisible.mock.calls.length;

      previewTween.onComplete();

      expect(weapon.isSwinging()).toBe(true);
      expect(graphics.setVisible.mock.calls.length).toBe(setVisibleCallsBeforePreviewCompletion);
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
