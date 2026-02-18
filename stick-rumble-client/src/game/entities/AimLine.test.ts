import { describe, it, expect, beforeEach, vi } from 'vitest';
import Phaser from 'phaser';
import { AimLine } from './AimLine';

describe('AimLine', () => {
  let scene: Phaser.Scene;
  let aimLine: AimLine;
  let mockGraphics: any;

  beforeEach(() => {
    mockGraphics = {
      setDepth: vi.fn().mockReturnThis(),
      clear: vi.fn().mockReturnThis(),
      lineStyle: vi.fn().mockReturnThis(),
      beginPath: vi.fn().mockReturnThis(),
      moveTo: vi.fn().mockReturnThis(),
      lineTo: vi.fn().mockReturnThis(),
      strokePath: vi.fn().mockReturnThis(),
      destroy: vi.fn(),
    };

    scene = {
      add: {
        graphics: vi.fn(() => mockGraphics),
      },
      input: {
        activePointer: {
          worldX: 500,
          worldY: 400,
          x: 500,
          y: 400,
        },
      },
      cameras: {
        main: {
          scrollX: 0,
          scrollY: 0,
        },
      },
    } as unknown as Phaser.Scene;

    aimLine = new AimLine(scene);
  });

  describe('constructor', () => {
    it('should create graphics object', () => {
      expect(scene.add.graphics).toHaveBeenCalled();
    });

    it('should set depth to 40', () => {
      expect(mockGraphics.setDepth).toHaveBeenCalledWith(40);
    });
  });

  describe('update', () => {
    it('should clear graphics on every update', () => {
      aimLine.update(100, 200, 0);
      expect(mockGraphics.clear).toHaveBeenCalled();
    });

    it('should draw line from barrel tip to cursor', () => {
      const playerX = 100;
      const playerY = 200;
      const aimAngle = 0; // pointing right

      scene.input!.activePointer.worldX = 500;
      scene.input!.activePointer.worldY = 200;

      aimLine.update(playerX, playerY, aimAngle);

      // Barrel tip at offset 30 from player in aim direction
      expect(mockGraphics.moveTo).toHaveBeenCalledWith(130, 200); // 100 + 30*cos(0), 200 + 30*sin(0)
      expect(mockGraphics.lineTo).toHaveBeenCalledWith(500, 200);
    });

    it('should use white color (COLORS.AIM_LINE = 0xFFFFFF)', () => {
      aimLine.update(100, 200, 0);
      expect(mockGraphics.lineStyle).toHaveBeenCalledWith(1, 0xffffff, 0.6);
    });

    it('should not draw when disabled', () => {
      aimLine.setEnabled(false);
      aimLine.update(100, 200, 0);
      expect(mockGraphics.lineStyle).not.toHaveBeenCalled();
    });

    it('should not draw when pointer is not available', () => {
      const sceneNoPointer = {
        add: { graphics: vi.fn(() => mockGraphics) },
        input: { activePointer: null },
        cameras: { main: { scrollX: 0, scrollY: 0 } },
      } as unknown as Phaser.Scene;

      const aimLineNoPointer = new AimLine(sceneNoPointer);
      mockGraphics.lineStyle.mockClear();

      aimLineNoPointer.update(100, 200, 0);
      expect(mockGraphics.lineStyle).not.toHaveBeenCalled();
    });

    it('should compute correct barrel position for angled aim', () => {
      const angle = Math.PI / 2; // pointing down
      aimLine.update(100, 100, angle);

      // Barrel tip: (100 + 30*cos(π/2), 100 + 30*sin(π/2)) ≈ (100, 130)
      const barrelX = 100 + Math.cos(angle) * 30;
      const barrelY = 100 + Math.sin(angle) * 30;
      expect(mockGraphics.moveTo).toHaveBeenCalledWith(
        expect.closeTo(barrelX, 5),
        expect.closeTo(barrelY, 5)
      );
    });
  });

  describe('getBarrelPosition', () => {
    it('should return barrel tip offset from player by 30px in aim direction', () => {
      const pos = aimLine.getBarrelPosition(100, 200, 0);
      expect(pos.x).toBeCloseTo(130, 5);
      expect(pos.y).toBeCloseTo(200, 5);
    });

    it('should compute correctly for downward aim', () => {
      const pos = aimLine.getBarrelPosition(0, 0, Math.PI / 2);
      expect(pos.x).toBeCloseTo(0, 5);
      expect(pos.y).toBeCloseTo(30, 5);
    });
  });

  describe('setEnabled', () => {
    it('should clear graphics when disabled', () => {
      mockGraphics.clear.mockClear();
      aimLine.setEnabled(false);
      expect(mockGraphics.clear).toHaveBeenCalled();
    });

    it('should resume drawing when re-enabled', () => {
      aimLine.setEnabled(false);
      mockGraphics.lineStyle.mockClear();
      aimLine.setEnabled(true);
      aimLine.update(100, 200, 0);
      expect(mockGraphics.lineStyle).toHaveBeenCalled();
    });
  });

  describe('destroy', () => {
    it('should clear and destroy graphics', () => {
      aimLine.destroy();
      expect(mockGraphics.clear).toHaveBeenCalled();
      expect(mockGraphics.destroy).toHaveBeenCalled();
    });
  });
});
