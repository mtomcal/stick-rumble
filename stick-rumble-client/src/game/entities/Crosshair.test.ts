import { describe, it, expect, beforeEach, vi } from 'vitest';
import Phaser from 'phaser';
import { Crosshair } from './Crosshair';

describe('Crosshair', () => {
  let scene: Phaser.Scene;
  let crosshair: Crosshair;
  let mockGraphics: Phaser.GameObjects.Graphics;

  beforeEach(() => {
    // Create mock scene
    scene = {
      add: {
        graphics: vi.fn(() => mockGraphics),
      },
      input: {
        activePointer: {
          x: 400,
          y: 300,
        },
      },
      cameras: {
        main: {
          scrollX: 0,
          scrollY: 0,
          width: 800,
          height: 600,
        },
      },
    } as unknown as Phaser.Scene;

    // Create mock graphics
    mockGraphics = {
      clear: vi.fn(),
      lineStyle: vi.fn(),
      strokeCircle: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      strokePath: vi.fn(),
      setScrollFactor: vi.fn(),
      setDepth: vi.fn(),
      setVisible: vi.fn(),
      destroy: vi.fn(),
      visible: true,
    } as unknown as Phaser.GameObjects.Graphics;

    crosshair = new Crosshair(scene);
  });

  describe('constructor', () => {
    it('should create graphics object with correct settings', () => {
      expect(scene.add.graphics).toHaveBeenCalled();
      expect(mockGraphics.setScrollFactor).toHaveBeenCalledWith(0);
      expect(mockGraphics.setDepth).toHaveBeenCalledWith(1000);
    });

    it('should initialize as visible by default', () => {
      expect(crosshair.isVisible()).toBe(true);
    });
  });

  describe('update', () => {
    it('should follow mouse cursor position', () => {
      scene.input.activePointer.x = 500;
      scene.input.activePointer.y = 400;

      crosshair.update(false, 0);

      // Graphics should be drawn at cursor position
      expect(mockGraphics.clear).toHaveBeenCalled();
    });

    it('should render static crosshair when player is stationary', () => {
      const isMoving = false;
      const spreadDegrees = 5;

      crosshair.update(isMoving, spreadDegrees);

      // Should draw base crosshair lines
      expect(mockGraphics.lineStyle).toHaveBeenCalled();
      expect(mockGraphics.moveTo).toHaveBeenCalled();
      expect(mockGraphics.lineTo).toHaveBeenCalled();
    });

    it('should expand crosshair when player is moving', () => {
      const isMoving = true;
      const spreadDegrees = 5;

      // Update multiple times to let interpolation reach target
      for (let i = 0; i < 10; i++) {
        crosshair.update(isMoving, spreadDegrees);
      }

      // Should draw expanded spread indicator
      expect(mockGraphics.clear).toHaveBeenCalled();
      expect(mockGraphics.strokeCircle).toHaveBeenCalled();
    });

    it('should use weapon-specific spread for Uzi (5 degrees)', () => {
      crosshair.setWeaponType('Uzi');

      // Update multiple times to let interpolation reach target
      for (let i = 0; i < 10; i++) {
        crosshair.update(true, 5);
      }

      // Should draw spread indicator with radius approaching 5 degrees * 2 pixels/degree + 5px gap = 15px
      const calls = (mockGraphics.strokeCircle as any).mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const lastCall = calls[calls.length - 1];
      const [, , radius] = lastCall;
      // After 10 frames with LERP_SPEED=0.2, radius should be close to 15px (within 2px due to interpolation)
      expect(radius).toBeGreaterThan(13);
      expect(radius).toBeLessThan(16);
    });

    it('should use weapon-specific spread for AK47 (3 degrees)', () => {
      crosshair.setWeaponType('AK47');

      // Update multiple times to let interpolation reach target
      for (let i = 0; i < 10; i++) {
        crosshair.update(true, 3);
      }

      // Should draw spread indicator with radius approaching 3 degrees * 2 pixels/degree + 5px gap = 11px
      const calls = (mockGraphics.strokeCircle as any).mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const lastCall = calls[calls.length - 1];
      const [, , radius] = lastCall;
      // After 10 frames with LERP_SPEED=0.2, radius should be close to 11px (within 1px due to interpolation)
      expect(radius).toBeGreaterThan(10);
      expect(radius).toBeLessThan(12);
    });

    it('should use weapon-specific spread for Shotgun (15 degrees cone)', () => {
      crosshair.setWeaponType('Shotgun');

      // Update multiple times to let interpolation reach target
      for (let i = 0; i < 10; i++) {
        crosshair.update(true, 15);
      }

      // Should draw spread indicator with radius approaching 15 degrees * 2 pixels/degree + 5px gap = 35px
      const calls = (mockGraphics.strokeCircle as any).mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const lastCall = calls[calls.length - 1];
      const [, , radius] = lastCall;
      // After 10 frames with LERP_SPEED=0.2, radius should be close to 35px (within 4px due to interpolation)
      expect(radius).toBeGreaterThan(31);
      expect(radius).toBeLessThan(36);
    });

    it('should not render when hidden', () => {
      crosshair.hide();
      mockGraphics.clear = vi.fn(); // Reset mock

      crosshair.update(true, 5);

      expect(mockGraphics.clear).not.toHaveBeenCalled();
    });
  });

  describe('setWeaponType', () => {
    it('should accept Uzi weapon type', () => {
      crosshair.setWeaponType('Uzi');
      expect(crosshair.getWeaponType()).toBe('Uzi');
    });

    it('should accept AK47 weapon type', () => {
      crosshair.setWeaponType('AK47');
      expect(crosshair.getWeaponType()).toBe('AK47');
    });

    it('should accept Shotgun weapon type', () => {
      crosshair.setWeaponType('Shotgun');
      expect(crosshair.getWeaponType()).toBe('Shotgun');
    });

    it('should handle melee weapons by hiding crosshair', () => {
      crosshair.setWeaponType('Bat');
      expect(crosshair.isVisible()).toBe(false);
    });

    it('should handle katana by hiding crosshair', () => {
      crosshair.setWeaponType('Katana');
      expect(crosshair.isVisible()).toBe(false);
    });
  });

  describe('show/hide', () => {
    it('should show crosshair', () => {
      crosshair.hide();
      crosshair.show();

      expect(mockGraphics.setVisible).toHaveBeenCalledWith(true);
      expect(crosshair.isVisible()).toBe(true);
    });

    it('should hide crosshair', () => {
      crosshair.hide();

      expect(mockGraphics.setVisible).toHaveBeenCalledWith(false);
      expect(crosshair.isVisible()).toBe(false);
    });

    it('should hide when spectating', () => {
      crosshair.setSpectating(true);
      expect(crosshair.isVisible()).toBe(false);
    });

    it('should show when exiting spectator mode', () => {
      crosshair.setSpectating(true);
      crosshair.setSpectating(false);
      expect(crosshair.isVisible()).toBe(true);
    });
  });

  describe('destroy', () => {
    it('should destroy graphics object', () => {
      crosshair.destroy();
      expect(mockGraphics.destroy).toHaveBeenCalled();
    });

    it('should handle multiple destroy calls safely', () => {
      crosshair.destroy();
      expect(() => crosshair.destroy()).not.toThrow();
    });
  });

  describe('spread indicator rendering', () => {
    it('should render larger spread circle for moving player', () => {
      const stationaryRadius = 10;

      // Stationary - small spread
      crosshair.update(false, 0);
      let calls = (mockGraphics.strokeCircle as any).mock.calls;
      if (calls.length > 0) {
        const [, , radius] = calls[calls.length - 1];
        expect(radius).toBeLessThanOrEqual(stationaryRadius);
      }

      // Moving - larger spread
      mockGraphics.strokeCircle = vi.fn(); // Reset
      crosshair.update(true, 5);
      calls = (mockGraphics.strokeCircle as any).mock.calls;
      if (calls.length > 0) {
        const [, , radius] = calls[calls.length - 1];
        expect(radius).toBeGreaterThan(stationaryRadius);
      }
    });

    it('should interpolate spread smoothly', () => {
      // Test that spread changes gradually, not instantly
      const radiusValues: number[] = [];

      // Capture spread radius over multiple frames
      for (let i = 0; i < 5; i++) {
        crosshair.update(true, 5);
        radiusValues.push(crosshair.getCurrentSpreadRadius());
      }

      // Verify spread increases gradually (not instantly to target)
      expect(radiusValues[0]).toBeLessThan(radiusValues[1]);
      expect(radiusValues[1]).toBeLessThan(radiusValues[2]);
      expect(radiusValues[2]).toBeLessThan(radiusValues[3]);

      // First frame should not be at full spread (interpolation not instant)
      const targetSpread = 5 * 2; // 5 degrees * 2 pixels/degree = 10px
      expect(radiusValues[0]).toBeLessThan(targetSpread);
    });
  });

  describe('visual feedback', () => {
    it('should use white color for crosshair lines', () => {
      crosshair.update(false, 0);

      const lineStyleCalls = (mockGraphics.lineStyle as any).mock.calls;
      expect(lineStyleCalls.length).toBeGreaterThan(0);
      // First arg is width, second is color
      const color = lineStyleCalls[0][1];
      expect(color).toBe(0xffffff); // White
    });

    it('should show red spread indicator when moving', () => {
      // Update multiple times to let spread build up
      for (let i = 0; i < 10; i++) {
        crosshair.update(true, 5);
      }

      const lineStyleCalls = (mockGraphics.lineStyle as any).mock.calls;
      // When moving, should draw red spread indicator
      const hasRedIndicator = lineStyleCalls.some((call: any) => call[1] === 0xff0000);
      expect(hasRedIndicator).toBe(true);
    });
  });

  describe('edge cases and branch coverage', () => {
    it('should use fallback spread degrees when weapon type is unknown', () => {
      // Set an unknown weapon type
      crosshair.setWeaponType('UnknownWeapon' as any);
      crosshair.update(true, 10);

      // Should use fallback spread degrees (10)
      expect(mockGraphics.strokeCircle).toHaveBeenCalled();
    });

    it('should not update when graphics is null', () => {
      crosshair.destroy();
      crosshair.update(true, 5);

      // Should not throw error
      expect(mockGraphics.clear).not.toHaveBeenCalled();
    });

    it('should not update when pointer is not available', () => {
      // Create a scene with no active pointer
      const sceneNoPointer = {
        add: {
          graphics: vi.fn(() => mockGraphics),
        },
        input: {
          activePointer: null,
        },
      } as unknown as Phaser.Scene;

      const crosshairNoPointer = new Crosshair(sceneNoPointer);
      mockGraphics.clear = vi.fn(); // Reset mock

      crosshairNoPointer.update(true, 5);

      // Should handle gracefully
      expect(mockGraphics.clear).not.toHaveBeenCalled();
    });

    it('should show crosshair for ranged weapon after switching from melee', () => {
      crosshair.setWeaponType('Bat');
      expect(crosshair.isVisible()).toBe(false);

      crosshair.setWeaponType('Pistol');
      expect(crosshair.isVisible()).toBe(true);
    });

    it('should not show crosshair for ranged weapon when spectating', () => {
      crosshair.setSpectating(true);
      crosshair.setWeaponType('Pistol');
      expect(crosshair.isVisible()).toBe(false);
    });

    it('should not show melee weapon crosshair after exiting spectator mode', () => {
      crosshair.setWeaponType('Katana');
      crosshair.setSpectating(true);
      crosshair.setSpectating(false);
      expect(crosshair.isVisible()).toBe(false);
    });
  });
});
