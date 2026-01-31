import { describe, it, expect, beforeEach, vi } from 'vitest';
import Phaser from 'phaser';
import { ProceduralPlayerGraphics } from './ProceduralPlayerGraphics';

describe('ProceduralPlayerGraphics', () => {
  let scene: Phaser.Scene;
  let graphics: Phaser.GameObjects.Graphics;

  beforeEach(() => {
    graphics = {
      clear: vi.fn(),
      lineStyle: vi.fn(),
      fillStyle: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      strokePath: vi.fn(),
      fillCircle: vi.fn(),
      strokeCircle: vi.fn(),
      destroy: vi.fn(),
      setVisible: vi.fn(),
      setDepth: vi.fn(),
      visible: true,
      destroyed: false,
      depth: 0,
    } as unknown as Phaser.GameObjects.Graphics;

    scene = {
      add: {
        graphics: vi.fn(() => graphics),
      },
    } as unknown as Phaser.Scene;
  });

  describe('Stick figure creation', () => {
    it('should create graphics object', () => {
      new ProceduralPlayerGraphics(scene, 100, 100, 0xff0000);
      expect(scene.add.graphics).toHaveBeenCalled();
    });

    it('should set graphics depth to 50', () => {
      new ProceduralPlayerGraphics(scene, 100, 100, 0xff0000);
      expect(graphics.setDepth).toHaveBeenCalledWith(50);
    });

    it('should draw stick figure on creation', () => {
      new ProceduralPlayerGraphics(scene, 100, 100, 0xff0000);

      // Should clear graphics
      expect(graphics.clear).toHaveBeenCalled();

      // Should draw limbs (legs and arms)
      expect(graphics.lineStyle).toHaveBeenCalled();
      expect(graphics.beginPath).toHaveBeenCalled();
      expect(graphics.strokePath).toHaveBeenCalled();

      // Should draw circles (head, hands, feet)
      expect(graphics.fillCircle).toHaveBeenCalled();
    });
  });

  describe('Stick figure rendering', () => {
    it('should use specified color for rendering', () => {
      new ProceduralPlayerGraphics(scene, 100, 100, 0xff0000);

      // Check that lineStyle was called with the specified color
      const lineStyleCalls = (graphics.lineStyle as any).mock.calls;
      const hasRedColor = lineStyleCalls.some((call: any[]) => call[1] === 0xff0000);
      expect(hasRedColor).toBe(true);
    });

    it('should draw head circle at center position', () => {
      new ProceduralPlayerGraphics(scene, 100, 100, 0xff0000);

      // Head should be drawn at (100, 100) with radius 13
      const fillCircleCalls = (graphics.fillCircle as any).mock.calls;
      const hasHeadCircle = fillCircleCalls.some(
        (call: any[]) => call[0] === 100 && call[1] === 100 && call[2] === 13
      );
      expect(hasHeadCircle).toBe(true);
    });

    it('should draw legs with line graphics', () => {
      new ProceduralPlayerGraphics(scene, 100, 100, 0xff0000);

      // Should use lineStyle with width 3
      const lineStyleCalls = (graphics.lineStyle as any).mock.calls;
      const hasThickLine = lineStyleCalls.some((call: any[]) => call[0] === 3);
      expect(hasThickLine).toBe(true);

      // Should draw lines with moveTo and lineTo
      expect(graphics.moveTo).toHaveBeenCalled();
      expect(graphics.lineTo).toHaveBeenCalled();
      expect(graphics.strokePath).toHaveBeenCalled();
    });

    it('should draw feet circles', () => {
      new ProceduralPlayerGraphics(scene, 100, 100, 0xff0000);

      // Should draw at least 2 circles with radius 3 (feet)
      const fillCircleCalls = (graphics.fillCircle as any).mock.calls;
      const feetCircles = fillCircleCalls.filter((call: any[]) => call[2] === 3);
      expect(feetCircles.length).toBeGreaterThanOrEqual(2);
    });

    it('should draw arms with thinner line graphics', () => {
      new ProceduralPlayerGraphics(scene, 100, 100, 0xff0000);

      // Should use lineStyle with width 2 for arms
      const lineStyleCalls = (graphics.lineStyle as any).mock.calls;
      const hasThinLine = lineStyleCalls.some((call: any[]) => call[0] === 2);
      expect(hasThinLine).toBe(true);
    });

    it('should draw hand circles', () => {
      new ProceduralPlayerGraphics(scene, 100, 100, 0xff0000);

      // Should draw circles with radius 3 for hands
      const fillCircleCalls = (graphics.fillCircle as any).mock.calls;
      const handCircles = fillCircleCalls.filter((call: any[]) => call[2] === 3);
      expect(handCircles.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Walk cycle animation', () => {
    it('should update walk cycle when moving', () => {
      const player = new ProceduralPlayerGraphics(scene, 100, 100, 0xff0000);
      (graphics.clear as any).mockClear();

      // Simulate movement
      player.update(16, true); // 16ms delta, moving

      // Should redraw
      expect(graphics.clear).toHaveBeenCalled();
    });

    it('should not increment walk cycle when idle', () => {
      const player = new ProceduralPlayerGraphics(scene, 100, 100, 0xff0000);

      // Simulate idle state
      player.update(16, false);

      // Walk cycle should be reset to 0
      expect((player as any).walkCycle).toBe(0);
    });

    it('should increment walk cycle when moving', () => {
      const player = new ProceduralPlayerGraphics(scene, 100, 100, 0xff0000);
      (player as any).walkCycle = 0;

      // Simulate movement
      player.update(16, true);

      // Walk cycle should have incremented
      expect((player as any).walkCycle).toBeGreaterThan(0);
    });

    it('should use delta time for animation speed', () => {
      const player = new ProceduralPlayerGraphics(scene, 100, 100, 0xff0000);
      (player as any).walkCycle = 0;

      // Update with larger delta should increment more
      player.update(32, true);
      const cycle32 = (player as any).walkCycle;

      (player as any).walkCycle = 0;
      player.update(16, true);
      const cycle16 = (player as any).walkCycle;

      expect(cycle32).toBeGreaterThan(cycle16);
    });
  });

  describe('Position updates', () => {
    it('should update position', () => {
      const player = new ProceduralPlayerGraphics(scene, 100, 100, 0xff0000);
      (graphics.clear as any).mockClear();

      player.setPosition(200, 300);

      // Should redraw at new position
      expect(graphics.clear).toHaveBeenCalled();
    });

    it('should return current position', () => {
      const player = new ProceduralPlayerGraphics(scene, 100, 100, 0xff0000);
      player.setPosition(200, 300);

      const pos = player.getPosition();
      expect(pos.x).toBe(200);
      expect(pos.y).toBe(300);
    });
  });

  describe('Rotation', () => {
    it('should set rotation', () => {
      const player = new ProceduralPlayerGraphics(scene, 100, 100, 0xff0000);
      (graphics.clear as any).mockClear();

      player.setRotation(Math.PI / 4);

      // Should redraw with new rotation
      expect(graphics.clear).toHaveBeenCalled();
    });

    it('should return current rotation', () => {
      const player = new ProceduralPlayerGraphics(scene, 100, 100, 0xff0000);
      player.setRotation(Math.PI / 2);

      expect(player.getRotation()).toBe(Math.PI / 2);
    });
  });

  describe('Visibility', () => {
    it('should set visibility', () => {
      const player = new ProceduralPlayerGraphics(scene, 100, 100, 0xff0000);
      player.setVisible(false);

      expect(graphics.setVisible).toHaveBeenCalledWith(false);
    });

    it('should get visibility', () => {
      const player = new ProceduralPlayerGraphics(scene, 100, 100, 0xff0000);
      graphics.visible = true;

      expect(player.getVisible()).toBe(true);
    });
  });

  describe('Cleanup', () => {
    it('should destroy graphics object', () => {
      const player = new ProceduralPlayerGraphics(scene, 100, 100, 0xff0000);
      player.destroy();

      expect(graphics.destroy).toHaveBeenCalled();
    });
  });

  describe('Color updates', () => {
    it('should update color', () => {
      const player = new ProceduralPlayerGraphics(scene, 100, 100, 0xff0000);
      (graphics.clear as any).mockClear();
      (graphics.lineStyle as any).mockClear();

      player.setColor(0x00ff00);

      // Should redraw with new color
      expect(graphics.clear).toHaveBeenCalled();
      const lineStyleCalls = (graphics.lineStyle as any).mock.calls;
      const hasGreenColor = lineStyleCalls.some((call: any[]) => call[1] === 0x00ff00);
      expect(hasGreenColor).toBe(true);
    });
  });

  describe('Graphics object access', () => {
    it('should return the underlying Graphics object', () => {
      const player = new ProceduralPlayerGraphics(scene, 100, 100, 0xff0000);
      const graphicsObj = player.getGraphics();

      expect(graphicsObj).toBeDefined();
      expect(graphicsObj).toBe(graphics); // Should return the same mock graphics object
    });
  });
});
