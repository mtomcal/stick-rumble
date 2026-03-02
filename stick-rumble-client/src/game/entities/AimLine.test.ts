import { describe, it, expect, beforeEach, vi } from 'vitest';
import Phaser from 'phaser';
import { AimLine } from './AimLine';
import { HIT_TRAIL } from '../../shared/constants';

describe('AimLine (Hit Confirmation Trail)', () => {
  let scene: Phaser.Scene;
  let aimLine: AimLine;
  let mockGraphics: any;
  let mockTween: any;

  beforeEach(() => {
    mockTween = { stop: vi.fn() };

    mockGraphics = {
      lineStyle: vi.fn().mockReturnThis(),
      beginPath: vi.fn().mockReturnThis(),
      moveTo: vi.fn().mockReturnThis(),
      lineTo: vi.fn().mockReturnThis(),
      strokePath: vi.fn().mockReturnThis(),
      setAlpha: vi.fn().mockReturnThis(),
      setDepth: vi.fn().mockReturnThis(),
      destroy: vi.fn(),
    };

    scene = {
      add: {
        graphics: vi.fn(() => mockGraphics),
      },
      tweens: {
        add: vi.fn().mockReturnValue(mockTween),
      },
    } as unknown as Phaser.Scene;

    aimLine = new AimLine(scene);
  });

  describe('TS-GFX-005: Hit Confirmation Trail Renders on Hit', () => {
    it('should draw a line from barrel to target position in world coordinates', () => {
      aimLine.showTrail(100, 100, 300, 200);

      expect(scene.add.graphics).toHaveBeenCalled();
      expect(mockGraphics.moveTo).toHaveBeenCalledWith(100, 100);
      expect(mockGraphics.lineTo).toHaveBeenCalledWith(300, 200);
      expect(mockGraphics.strokePath).toHaveBeenCalled();
    });

    it('should set trail alpha to HIT_TRAIL.ALPHA (0.8)', () => {
      aimLine.showTrail(100, 100, 300, 200);
      expect(mockGraphics.setAlpha).toHaveBeenCalledWith(HIT_TRAIL.ALPHA);
    });

    it('should set trail depth to HIT_TRAIL.DEPTH (40)', () => {
      aimLine.showTrail(100, 100, 300, 200);
      expect(mockGraphics.setDepth).toHaveBeenCalledWith(HIT_TRAIL.DEPTH);
    });

    it('should set trail stroke to HIT_TRAIL.STROKE (1)', () => {
      aimLine.showTrail(100, 100, 300, 200);
      expect(mockGraphics.lineStyle).toHaveBeenCalledWith(HIT_TRAIL.STROKE, HIT_TRAIL.COLOR, 1);
    });

    it('should tween trail alpha to 0 after linger delay', () => {
      aimLine.showTrail(100, 100, 300, 200);

      expect(scene.tweens.add).toHaveBeenCalledWith(
        expect.objectContaining({
          targets: mockGraphics,
          alpha: 0,
          duration: HIT_TRAIL.FADE_DURATION,
          delay: HIT_TRAIL.LINGER_DURATION,
        })
      );
    });

    it('should destroy the trail after fade completes', () => {
      let onCompleteCallback: (() => void) | undefined;
      (scene.tweens.add as ReturnType<typeof vi.fn>).mockImplementation((config: any) => {
        onCompleteCallback = config.onComplete;
        return mockTween;
      });

      aimLine.showTrail(100, 100, 300, 200);

      expect(onCompleteCallback).toBeDefined();
      if (onCompleteCallback) onCompleteCallback();
      expect(mockGraphics.destroy).toHaveBeenCalled();
    });

    it('should work for off-screen targets (no range check)', () => {
      // Target far off screen — no clamping
      expect(() => aimLine.showTrail(100, 100, 5000, 5000)).not.toThrow();
      expect(mockGraphics.moveTo).toHaveBeenCalledWith(100, 100);
      expect(mockGraphics.lineTo).toHaveBeenCalledWith(5000, 5000);
    });

    it('should use white color (HIT_TRAIL.COLOR = 0xFFFFFF)', () => {
      expect(HIT_TRAIL.COLOR).toBe(0xFFFFFF);
      aimLine.showTrail(0, 0, 100, 100);
      expect(mockGraphics.lineStyle).toHaveBeenCalledWith(HIT_TRAIL.STROKE, 0xFFFFFF, 1);
    });
  });

  describe('getBarrelPosition', () => {
    it('should return pistol barrel tip using the rendered weapon origin and length', () => {
      const pos = aimLine.getBarrelPosition(110, 200, 0, 'Pistol');
      expect(pos.x).toBeCloseTo(135, 5);
      expect(pos.y).toBeCloseTo(200, 5);
    });

    it('should compute correctly for downward aim', () => {
      const pos = aimLine.getBarrelPosition(0, 10, Math.PI / 2, 'Pistol');
      expect(pos.x).toBeCloseTo(0, 5);
      expect(pos.y).toBeCloseTo(35, 5);
    });

    it('should compute correctly for diagonal aim with a longer weapon barrel', () => {
      const angle = Math.PI / 4; // 45 degrees
      const pos = aimLine.getBarrelPosition(50, 50, angle, 'AK47');
      expect(pos.x).toBeCloseTo(50 + Math.cos(angle) * 50, 5);
      expect(pos.y).toBeCloseTo(50 + Math.sin(angle) * 50, 5);
    });
  });

  describe('does NOT draw continuously each frame', () => {
    it('should NOT have an update() method that draws lines', () => {
      // The old AimLine.update() drew per frame — it must be gone
      expect((aimLine as any).update).toBeUndefined();
    });

    it('should NOT have a setEnabled() method', () => {
      expect((aimLine as any).setEnabled).toBeUndefined();
    });

    it('should NOT have a graphics property', () => {
      expect((aimLine as any).graphics).toBeUndefined();
    });
  });

  describe('destroy', () => {
    it('should not throw when destroyed', () => {
      expect(() => aimLine.destroy()).not.toThrow();
    });
  });
});
