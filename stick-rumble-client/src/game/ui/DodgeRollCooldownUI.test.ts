import { describe, it, expect, beforeEach, vi } from 'vitest';
import type Phaser from 'phaser';
import { DodgeRollCooldownUI } from './DodgeRollCooldownUI';

describe('DodgeRollCooldownUI', () => {
  let mockScene: Phaser.Scene;
  let mockGraphics: Phaser.GameObjects.Graphics;
  let ui: DodgeRollCooldownUI;

  beforeEach(() => {
    // Create mock graphics object
    mockGraphics = {
      clear: vi.fn().mockReturnThis(),
      lineStyle: vi.fn().mockReturnThis(),
      strokeCircle: vi.fn().mockReturnThis(),
      fillStyle: vi.fn().mockReturnThis(),
      fillCircle: vi.fn().mockReturnThis(),
      beginPath: vi.fn().mockReturnThis(),
      arc: vi.fn().mockReturnThis(),
      closePath: vi.fn().mockReturnThis(),
      fillPath: vi.fn().mockReturnThis(),
      setScrollFactor: vi.fn().mockReturnThis(),
      setDepth: vi.fn().mockReturnThis(),
      setAlpha: vi.fn().mockReturnThis(),
      destroy: vi.fn(),
    } as unknown as Phaser.GameObjects.Graphics;

    // Create mock scene
    mockScene = {
      add: {
        graphics: vi.fn().mockReturnValue(mockGraphics),
      },
    } as unknown as Phaser.Scene;

    ui = new DodgeRollCooldownUI(mockScene, 100, 100);
  });

  describe('Constructor', () => {
    it('should create graphics object', () => {
      expect(mockScene.add.graphics).toHaveBeenCalled();
    });

    it('should set scroll factor to 0 for screen-fixed UI', () => {
      expect(mockGraphics.setScrollFactor).toHaveBeenCalledWith(0);
    });

    it('should set high depth for UI visibility', () => {
      expect(mockGraphics.setDepth).toHaveBeenCalledWith(1000);
    });

    it('should store position correctly', () => {
      const customUI = new DodgeRollCooldownUI(mockScene, 200, 300);
      // Position should be used in draw calls (verified by update tests)
      expect(customUI).toBeDefined();
    });
  });

  describe('updateProgress()', () => {
    it('should clear graphics before redrawing', () => {
      ui.updateProgress(0.5);
      expect(mockGraphics.clear).toHaveBeenCalled();
    });

    it('should draw gray background circle at 0% progress', () => {
      ui.updateProgress(0.0);

      // Should draw background circle
      expect(mockGraphics.fillStyle).toHaveBeenCalledWith(0x666666, 0.5);
      expect(mockGraphics.fillCircle).toHaveBeenCalledWith(100, 100, 20);
    });

    it('should draw gray background circle at 50% progress', () => {
      ui.updateProgress(0.5);

      // Should draw background circle
      expect(mockGraphics.fillStyle).toHaveBeenCalledWith(0x666666, 0.5);
      expect(mockGraphics.fillCircle).toHaveBeenCalledWith(100, 100, 20);
    });

    it('should draw gray background circle at 99% progress', () => {
      ui.updateProgress(0.99);

      // Should draw background circle
      expect(mockGraphics.fillStyle).toHaveBeenCalledWith(0x666666, 0.5);
      expect(mockGraphics.fillCircle).toHaveBeenCalledWith(100, 100, 20);
    });

    it('should draw green circle at 100% progress (ready)', () => {
      ui.updateProgress(1.0);

      // Should NOT draw gray background, only green ready indicator
      expect(mockGraphics.fillStyle).toHaveBeenCalledWith(0x00ff00, 0.8);
      expect(mockGraphics.fillCircle).toHaveBeenCalledWith(100, 100, 20);
    });

    it('should draw progress arc at 25% progress', () => {
      ui.updateProgress(0.25);

      // Should draw background
      expect(mockGraphics.fillStyle).toHaveBeenCalledWith(0x666666, 0.5);

      // Should draw progress arc
      expect(mockGraphics.beginPath).toHaveBeenCalled();
      expect(mockGraphics.arc).toHaveBeenCalledWith(
        100, // x
        100, // y
        20, // radius
        expect.any(Number), // startAngle
        expect.any(Number), // endAngle
        false // anticlockwise
      );
      expect(mockGraphics.fillStyle).toHaveBeenCalledWith(0x00ff00, 0.6);
      expect(mockGraphics.fillPath).toHaveBeenCalled();
    });

    it('should draw progress arc at 50% progress', () => {
      ui.updateProgress(0.5);

      expect(mockGraphics.arc).toHaveBeenCalledWith(
        100,
        100,
        20,
        expect.any(Number),
        expect.any(Number),
        false
      );
    });

    it('should draw progress arc at 75% progress', () => {
      ui.updateProgress(0.75);

      expect(mockGraphics.arc).toHaveBeenCalledWith(
        100,
        100,
        20,
        expect.any(Number),
        expect.any(Number),
        false
      );
    });

    it('should handle progress values below 0', () => {
      ui.updateProgress(-0.5);

      // Should clamp to 0 and draw gray circle
      expect(mockGraphics.fillStyle).toHaveBeenCalledWith(0x666666, 0.5);
    });

    it('should handle progress values above 1', () => {
      ui.updateProgress(1.5);

      // Should clamp to 1 and draw green ready circle
      expect(mockGraphics.fillStyle).toHaveBeenCalledWith(0x00ff00, 0.8);
    });

    it('should redraw on multiple update calls', () => {
      ui.updateProgress(0.0);
      ui.updateProgress(0.5);
      ui.updateProgress(1.0);

      // Should clear 3 times (once per update)
      expect(mockGraphics.clear).toHaveBeenCalledTimes(3);
    });
  });

  describe('destroy()', () => {
    it('should destroy graphics object', () => {
      ui.destroy();
      expect(mockGraphics.destroy).toHaveBeenCalled();
    });

    it('should handle multiple destroy calls safely', () => {
      ui.destroy();
      ui.destroy();
      expect(mockGraphics.destroy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Visual Appearance', () => {
    it('should use consistent radius of 20 pixels', () => {
      ui.updateProgress(0.5);

      // Both background circle and progress arc should use radius 20
      expect(mockGraphics.fillCircle).toHaveBeenCalledWith(100, 100, 20);
      expect(mockGraphics.arc).toHaveBeenCalledWith(
        100,
        100,
        20,
        expect.any(Number),
        expect.any(Number),
        false
      );
    });

    it('should use gray color for cooldown state (0.5 alpha)', () => {
      ui.updateProgress(0.5);

      // Background should be gray with 0.5 alpha
      expect(mockGraphics.fillStyle).toHaveBeenCalledWith(0x666666, 0.5);
    });

    it('should use green color for ready state (0.8 alpha)', () => {
      ui.updateProgress(1.0);

      // Ready indicator should be green with 0.8 alpha
      expect(mockGraphics.fillStyle).toHaveBeenCalledWith(0x00ff00, 0.8);
    });

    it('should use green color for progress arc (0.6 alpha)', () => {
      ui.updateProgress(0.5);

      // Progress arc should be green with 0.6 alpha
      expect(mockGraphics.fillStyle).toHaveBeenCalledWith(0x00ff00, 0.6);
    });
  });

  describe('Edge Cases', () => {
    it('should handle exactly 0 progress', () => {
      ui.updateProgress(0);

      expect(mockGraphics.clear).toHaveBeenCalled();
      expect(mockGraphics.fillCircle).toHaveBeenCalled();
    });

    it('should handle exactly 1 progress', () => {
      ui.updateProgress(1);

      expect(mockGraphics.clear).toHaveBeenCalled();
      expect(mockGraphics.fillStyle).toHaveBeenCalledWith(0x00ff00, 0.8);
    });

    it('should handle very small progress (0.01)', () => {
      ui.updateProgress(0.01);

      expect(mockGraphics.arc).toHaveBeenCalled();
    });

    it('should handle near-complete progress (0.99)', () => {
      ui.updateProgress(0.99);

      expect(mockGraphics.arc).toHaveBeenCalled();
      // Should still draw gray background, not green ready circle
      expect(mockGraphics.fillStyle).toHaveBeenCalledWith(0x666666, 0.5);
    });
  });
});
