import { describe, it, expect, beforeEach, vi } from 'vitest';
import Phaser from 'phaser';
import { ProceduralPlayerGraphics } from './ProceduralPlayerGraphics';
import { COLORS } from '../../shared/constants';

describe('ProceduralPlayerGraphics', () => {
  let scene: Phaser.Scene;
  let graphics: Phaser.GameObjects.Graphics;
  let mockText: any;

  let aimLineGraphics: Phaser.GameObjects.Graphics;

  beforeEach(() => {
    const makeGraphicsMock = () => ({
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
      x: 0,
      y: 0,
    } as unknown as Phaser.GameObjects.Graphics);

    graphics = makeGraphicsMock();
    aimLineGraphics = makeGraphicsMock();

    mockText = {
      setOrigin: vi.fn().mockReturnThis(),
      setDepth: vi.fn().mockReturnThis(),
      setVisible: vi.fn().mockReturnThis(),
      setText: vi.fn().mockReturnThis(),
      destroy: vi.fn(),
      x: 0,
      y: 0,
    };

    let callCount = 0;
    scene = {
      add: {
        graphics: vi.fn(() => {
          callCount++;
          return callCount === 1 ? graphics : aimLineGraphics;
        }),
        text: vi.fn(() => mockText),
      },
    } as unknown as Phaser.Scene;
  });

  describe('Stick figure creation', () => {
    it('should create graphics object', () => {
      new ProceduralPlayerGraphics(scene, 100, 100, COLORS.ENEMY_HEAD, COLORS.BODY);
      expect(scene.add.graphics).toHaveBeenCalled();
    });

    it('should set graphics depth to 50', () => {
      new ProceduralPlayerGraphics(scene, 100, 100, COLORS.ENEMY_HEAD, COLORS.BODY);
      expect(graphics.setDepth).toHaveBeenCalledWith(50);
    });

    it('should draw stick figure on creation', () => {
      new ProceduralPlayerGraphics(scene, 100, 100, COLORS.ENEMY_HEAD, COLORS.BODY);

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
    it('should use body color for legs and arms', () => {
      new ProceduralPlayerGraphics(scene, 100, 100, COLORS.PLAYER_HEAD, COLORS.BODY);

      // Body (legs/arms) should use COLORS.BODY (black)
      const lineStyleCalls = (graphics.lineStyle as any).mock.calls;
      const hasBodyColor = lineStyleCalls.some((call: any[]) => call[1] === COLORS.BODY);
      expect(hasBodyColor).toBe(true);
    });

    it('should use head color for the head', () => {
      new ProceduralPlayerGraphics(scene, 100, 100, COLORS.ENEMY_HEAD, COLORS.BODY);

      // Head should use enemy red
      const fillStyleCalls = (graphics.fillStyle as any).mock.calls;
      const hasHeadColor = fillStyleCalls.some((call: any[]) => call[0] === COLORS.ENEMY_HEAD);
      expect(hasHeadColor).toBe(true);
    });

    it('should use local player head color for local player', () => {
      new ProceduralPlayerGraphics(scene, 100, 100, COLORS.PLAYER_HEAD, COLORS.BODY);

      const fillStyleCalls = (graphics.fillStyle as any).mock.calls;
      const hasLocalHeadColor = fillStyleCalls.some((call: any[]) => call[0] === COLORS.PLAYER_HEAD);
      expect(hasLocalHeadColor).toBe(true);
    });

    it('should draw head circle at center position', () => {
      new ProceduralPlayerGraphics(scene, 100, 100, COLORS.ENEMY_HEAD, COLORS.BODY);

      // Head should be drawn at local (0, 0) with radius 13 (Graphics transform handles position)
      const fillCircleCalls = (graphics.fillCircle as any).mock.calls;
      const hasHeadCircle = fillCircleCalls.some(
        (call: any[]) => call[0] === 0 && call[1] === 0 && call[2] === 13
      );
      expect(hasHeadCircle).toBe(true);
    });

    it('should draw legs with line graphics', () => {
      new ProceduralPlayerGraphics(scene, 100, 100, COLORS.ENEMY_HEAD, COLORS.BODY);

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
      new ProceduralPlayerGraphics(scene, 100, 100, COLORS.ENEMY_HEAD, COLORS.BODY);

      // Should draw at least 2 circles with radius 3 (feet)
      const fillCircleCalls = (graphics.fillCircle as any).mock.calls;
      const feetCircles = fillCircleCalls.filter((call: any[]) => call[2] === 3);
      expect(feetCircles.length).toBeGreaterThanOrEqual(2);
    });

    it('should draw arms with thinner line graphics', () => {
      new ProceduralPlayerGraphics(scene, 100, 100, COLORS.ENEMY_HEAD, COLORS.BODY);

      // Should use lineStyle with width 2 for arms
      const lineStyleCalls = (graphics.lineStyle as any).mock.calls;
      const hasThinLine = lineStyleCalls.some((call: any[]) => call[0] === 2);
      expect(hasThinLine).toBe(true);
    });

    it('should draw hand circles', () => {
      new ProceduralPlayerGraphics(scene, 100, 100, COLORS.ENEMY_HEAD, COLORS.BODY);

      // Should draw circles with radius 3 for hands
      const fillCircleCalls = (graphics.fillCircle as any).mock.calls;
      const handCircles = fillCircleCalls.filter((call: any[]) => call[2] === 3);
      expect(handCircles.length).toBeGreaterThanOrEqual(2);
    });

    it('should use black body color when only headColor provided', () => {
      new ProceduralPlayerGraphics(scene, 100, 100, COLORS.PLAYER_HEAD);

      // Body defaults to black (0x000000)
      const lineStyleCalls = (graphics.lineStyle as any).mock.calls;
      const hasBlackBody = lineStyleCalls.some((call: any[]) => call[1] === 0x000000);
      expect(hasBlackBody).toBe(true);
    });
  });

  describe('Head/body color distinction', () => {
    it('should render body in black and head in enemy red', () => {
      new ProceduralPlayerGraphics(scene, 100, 100, COLORS.ENEMY_HEAD, COLORS.BODY);

      // Body (legs/arms) should use black
      const lineStyleCalls = (graphics.lineStyle as any).mock.calls;
      const hasBlackBody = lineStyleCalls.some(
        (call: any[]) => call[1] === COLORS.BODY && call[0] !== 1
      );
      expect(hasBlackBody).toBe(true);

      // Head should use enemy red
      const fillStyleCalls = (graphics.fillStyle as any).mock.calls;
      const hasRedHead = fillStyleCalls.some((call: any[]) => call[0] === COLORS.ENEMY_HEAD);
      expect(hasRedHead).toBe(true);
    });

    it('should render body in black and head in local player dark color', () => {
      new ProceduralPlayerGraphics(scene, 100, 100, COLORS.PLAYER_HEAD, COLORS.BODY);

      // Body (legs/arms) should use black
      const lineStyleCalls = (graphics.lineStyle as any).mock.calls;
      const hasBlackBody = lineStyleCalls.some(
        (call: any[]) => call[1] === COLORS.BODY && call[0] !== 1
      );
      expect(hasBlackBody).toBe(true);

      // Head should use local player head color
      const fillStyleCalls = (graphics.fillStyle as any).mock.calls;
      const hasDarkHead = fillStyleCalls.some((call: any[]) => call[0] === COLORS.PLAYER_HEAD);
      expect(hasDarkHead).toBe(true);
    });

    it('should render dead player head in gray', () => {
      new ProceduralPlayerGraphics(scene, 100, 100, COLORS.DEAD_HEAD, COLORS.BODY);

      const fillStyleCalls = (graphics.fillStyle as any).mock.calls;
      const hasGrayHead = fillStyleCalls.some((call: any[]) => call[0] === COLORS.DEAD_HEAD);
      expect(hasGrayHead).toBe(true);
    });
  });

  describe('Walk cycle animation', () => {
    it('should update walk cycle when moving', () => {
      const player = new ProceduralPlayerGraphics(scene, 100, 100, COLORS.ENEMY_HEAD, COLORS.BODY);
      (graphics.clear as any).mockClear();

      // Simulate movement
      player.update(16, true); // 16ms delta, moving

      // Should redraw
      expect(graphics.clear).toHaveBeenCalled();
    });

    it('should not increment walk cycle when idle', () => {
      const player = new ProceduralPlayerGraphics(scene, 100, 100, COLORS.ENEMY_HEAD, COLORS.BODY);

      // Simulate idle state
      player.update(16, false);

      // Walk cycle should be reset to 0
      expect((player as any).walkCycle).toBe(0);
    });

    it('should increment walk cycle when moving', () => {
      const player = new ProceduralPlayerGraphics(scene, 100, 100, COLORS.ENEMY_HEAD, COLORS.BODY);
      (player as any).walkCycle = 0;

      // Simulate movement
      player.update(16, true);

      // Walk cycle should have incremented
      expect((player as any).walkCycle).toBeGreaterThan(0);
    });

    it('should use delta time for animation speed', () => {
      const player = new ProceduralPlayerGraphics(scene, 100, 100, COLORS.ENEMY_HEAD, COLORS.BODY);
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
      const player = new ProceduralPlayerGraphics(scene, 100, 100, COLORS.ENEMY_HEAD, COLORS.BODY);
      (graphics.clear as any).mockClear();

      player.setPosition(200, 300);

      // Should redraw at new position
      expect(graphics.clear).toHaveBeenCalled();
    });

    it('should return current position', () => {
      const player = new ProceduralPlayerGraphics(scene, 100, 100, COLORS.ENEMY_HEAD, COLORS.BODY);
      player.setPosition(200, 300);

      const pos = player.getPosition();
      expect(pos.x).toBe(200);
      expect(pos.y).toBe(300);
    });

    it('should update Graphics transform for camera follow', () => {
      const player = new ProceduralPlayerGraphics(scene, 100, 100, COLORS.ENEMY_HEAD, COLORS.BODY);
      const graphicsObj = player.getGraphics();

      player.setPosition(200, 300);

      // Graphics object should have its transform updated for camera.startFollow()
      expect(graphicsObj.x).toBe(200);
      expect(graphicsObj.y).toBe(300);
    });
  });

  describe('Rotation', () => {
    it('should set rotation', () => {
      const player = new ProceduralPlayerGraphics(scene, 100, 100, COLORS.ENEMY_HEAD, COLORS.BODY);
      (graphics.clear as any).mockClear();

      player.setRotation(Math.PI / 4);

      // Should redraw with new rotation
      expect(graphics.clear).toHaveBeenCalled();
    });

    it('should return current rotation', () => {
      const player = new ProceduralPlayerGraphics(scene, 100, 100, COLORS.ENEMY_HEAD, COLORS.BODY);
      player.setRotation(Math.PI / 2);

      expect(player.getRotation()).toBe(Math.PI / 2);
    });
  });

  describe('Visibility', () => {
    it('should set visibility', () => {
      const player = new ProceduralPlayerGraphics(scene, 100, 100, COLORS.ENEMY_HEAD, COLORS.BODY);
      player.setVisible(false);

      expect(graphics.setVisible).toHaveBeenCalledWith(false);
    });

    it('should get visibility', () => {
      const player = new ProceduralPlayerGraphics(scene, 100, 100, COLORS.ENEMY_HEAD, COLORS.BODY);
      graphics.visible = true;

      expect(player.getVisible()).toBe(true);
    });

    it('should hide name label when setting visibility to false', () => {
      const player = new ProceduralPlayerGraphics(scene, 100, 100, COLORS.PLAYER_HEAD, COLORS.BODY);
      player.setNameLabel('YOU');
      player.setVisible(false);

      expect(mockText.setVisible).toHaveBeenCalledWith(false);
    });
  });

  describe('Cleanup', () => {
    it('should destroy graphics object', () => {
      const player = new ProceduralPlayerGraphics(scene, 100, 100, COLORS.ENEMY_HEAD, COLORS.BODY);
      player.destroy();

      expect(graphics.destroy).toHaveBeenCalled();
    });

    it('should destroy name label when it exists', () => {
      const player = new ProceduralPlayerGraphics(scene, 100, 100, COLORS.PLAYER_HEAD, COLORS.BODY);
      player.setNameLabel('YOU');
      player.destroy();

      expect(mockText.destroy).toHaveBeenCalled();
    });

    it('should handle destroy without name label', () => {
      const player = new ProceduralPlayerGraphics(scene, 100, 100, COLORS.ENEMY_HEAD, COLORS.BODY);
      expect(() => player.destroy()).not.toThrow();
    });
  });

  describe('Color updates', () => {
    it('should update head color via setColor', () => {
      const player = new ProceduralPlayerGraphics(scene, 100, 100, COLORS.ENEMY_HEAD, COLORS.BODY);
      (graphics.clear as any).mockClear();
      (graphics.fillStyle as any).mockClear();

      player.setColor(COLORS.DEAD_HEAD);

      // Should redraw with new head color
      expect(graphics.clear).toHaveBeenCalled();
      const fillStyleCalls = (graphics.fillStyle as any).mock.calls;
      const hasDeadColor = fillStyleCalls.some((call: any[]) => call[0] === COLORS.DEAD_HEAD);
      expect(hasDeadColor).toBe(true);
    });

    it('should keep body black when head color changes', () => {
      const player = new ProceduralPlayerGraphics(scene, 100, 100, COLORS.ENEMY_HEAD, COLORS.BODY);
      (graphics.lineStyle as any).mockClear();

      player.setColor(COLORS.DEAD_HEAD);

      // Body should still use black
      const lineStyleCalls = (graphics.lineStyle as any).mock.calls;
      const hasBlackBody = lineStyleCalls.some(
        (call: any[]) => call[1] === COLORS.BODY && call[0] !== 1
      );
      expect(hasBlackBody).toBe(true);
    });
  });

  describe('Graphics object access', () => {
    it('should return the underlying Graphics object', () => {
      const player = new ProceduralPlayerGraphics(scene, 100, 100, COLORS.ENEMY_HEAD, COLORS.BODY);
      const graphicsObj = player.getGraphics();

      expect(graphicsObj).toBeDefined();
      expect(graphicsObj).toBe(graphics); // Should return the same mock graphics object
    });
  });

  describe('Aim line (Task 4.2)', () => {
    it('should create aim line graphics at depth 40', () => {
      const player = new ProceduralPlayerGraphics(scene, 100, 100, COLORS.ENEMY_HEAD, COLORS.BODY);
      player.createAimLine();

      expect(aimLineGraphics.setDepth).toHaveBeenCalledWith(40);
    });

    it('should not create duplicate aim line graphics if called twice', () => {
      const player = new ProceduralPlayerGraphics(scene, 100, 100, COLORS.ENEMY_HEAD, COLORS.BODY);
      player.createAimLine();
      player.createAimLine();

      // Only 2 total graphics created: player + aim line (not a third)
      expect(scene.add.graphics).toHaveBeenCalledTimes(2);
    });

    it('should draw a line from barrel tip to target in updateAimLine', () => {
      const player = new ProceduralPlayerGraphics(scene, 100, 200, COLORS.ENEMY_HEAD, COLORS.BODY);
      player.setRotation(0); // Facing right
      player.createAimLine();

      player.updateAimLine(400, 200);

      expect(aimLineGraphics.clear).toHaveBeenCalled();
      expect(aimLineGraphics.lineStyle).toHaveBeenCalled();
      expect(aimLineGraphics.beginPath).toHaveBeenCalled();
      // barrel tip at rotation=0: x = 100+20 = 120, y = 200
      expect(aimLineGraphics.moveTo).toHaveBeenCalledWith(120, 200);
      expect(aimLineGraphics.lineTo).toHaveBeenCalledWith(400, 200);
      expect(aimLineGraphics.strokePath).toHaveBeenCalled();
    });

    it('should use COLORS.AIM_LINE (white) for aim line', () => {
      const player = new ProceduralPlayerGraphics(scene, 100, 100, COLORS.ENEMY_HEAD, COLORS.BODY);
      player.createAimLine();
      player.updateAimLine(400, 100);

      const lineStyleCalls = (aimLineGraphics.lineStyle as any).mock.calls;
      const hasAimLineColor = lineStyleCalls.some((call: any[]) => call[1] === 0xFFFFFF);
      expect(hasAimLineColor).toBe(true);
    });

    it('should not throw when updateAimLine called without createAimLine', () => {
      const player = new ProceduralPlayerGraphics(scene, 100, 100, COLORS.ENEMY_HEAD, COLORS.BODY);
      expect(() => player.updateAimLine(400, 100)).not.toThrow();
    });

    it('getBarrelPosition should return rotated position', () => {
      const player = new ProceduralPlayerGraphics(scene, 100, 200, COLORS.ENEMY_HEAD, COLORS.BODY);
      player.setRotation(0); // Facing right: barrel at (100+20, 200)

      const barrel = player.getBarrelPosition();
      expect(barrel.x).toBeCloseTo(120);
      expect(barrel.y).toBeCloseTo(200);
    });

    it('getBarrelPosition should rotate barrel tip with player rotation', () => {
      const player = new ProceduralPlayerGraphics(scene, 100, 200, COLORS.ENEMY_HEAD, COLORS.BODY);
      player.setRotation(Math.PI / 2); // Facing down: barrel at (100, 200+20)

      const barrel = player.getBarrelPosition();
      expect(barrel.x).toBeCloseTo(100);
      expect(barrel.y).toBeCloseTo(220);
    });

    it('should hide aim line with hideAimLine()', () => {
      const player = new ProceduralPlayerGraphics(scene, 100, 100, COLORS.ENEMY_HEAD, COLORS.BODY);
      player.createAimLine();
      player.hideAimLine();

      expect(aimLineGraphics.setVisible).toHaveBeenCalledWith(false);
    });

    it('should show aim line with showAimLine()', () => {
      const player = new ProceduralPlayerGraphics(scene, 100, 100, COLORS.ENEMY_HEAD, COLORS.BODY);
      player.createAimLine();
      player.showAimLine();

      expect(aimLineGraphics.setVisible).toHaveBeenCalledWith(true);
    });

    it('should destroy aim line graphics on destroy()', () => {
      const player = new ProceduralPlayerGraphics(scene, 100, 100, COLORS.ENEMY_HEAD, COLORS.BODY);
      player.createAimLine();
      player.destroy();

      expect(aimLineGraphics.destroy).toHaveBeenCalled();
    });
  });

  describe('Task 3.6: YOU / name labels', () => {
    it('should create a "YOU" text label above local player', () => {
      const player = new ProceduralPlayerGraphics(scene, 100, 200, COLORS.PLAYER_HEAD, COLORS.BODY);
      player.setNameLabel('YOU');

      expect(scene.add.text).toHaveBeenCalledWith(
        100,
        expect.any(Number),
        'YOU',
        expect.objectContaining({ fontStyle: 'bold', color: '#FFFFFF' })
      );
    });

    it('should position label above head (y = playerY - headRadius - 5)', () => {
      const player = new ProceduralPlayerGraphics(scene, 100, 200, COLORS.PLAYER_HEAD, COLORS.BODY);
      player.setNameLabel('YOU');

      // Head radius is 13, so label Y = 200 - 13 - 5 = 182
      expect(scene.add.text).toHaveBeenCalledWith(
        100,
        182,
        'YOU',
        expect.anything()
      );
    });

    it('should create enemy name label in gray', () => {
      const player = new ProceduralPlayerGraphics(scene, 100, 200, COLORS.ENEMY_HEAD, COLORS.BODY);
      player.setNameLabel('Player123');

      expect(scene.add.text).toHaveBeenCalledWith(
        100,
        expect.any(Number),
        'Player123',
        expect.objectContaining({ color: '#AAAAAA' })
      );
    });

    it('should set YOU label font size to 14px', () => {
      const player = new ProceduralPlayerGraphics(scene, 100, 200, COLORS.PLAYER_HEAD, COLORS.BODY);
      player.setNameLabel('YOU');

      expect(scene.add.text).toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(Number),
        'YOU',
        expect.objectContaining({ fontSize: '14px' })
      );
    });

    it('should set enemy name label font size to 12px', () => {
      const player = new ProceduralPlayerGraphics(scene, 100, 200, COLORS.ENEMY_HEAD, COLORS.BODY);
      player.setNameLabel('EnemyName');

      expect(scene.add.text).toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(Number),
        'EnemyName',
        expect.objectContaining({ fontSize: '12px' })
      );
    });

    it('should set label depth to 60', () => {
      const player = new ProceduralPlayerGraphics(scene, 100, 200, COLORS.PLAYER_HEAD, COLORS.BODY);
      player.setNameLabel('YOU');

      expect(mockText.setDepth).toHaveBeenCalledWith(60);
    });

    it('should set label origin to (0.5, 1) for centered bottom-anchored positioning', () => {
      const player = new ProceduralPlayerGraphics(scene, 100, 200, COLORS.PLAYER_HEAD, COLORS.BODY);
      player.setNameLabel('YOU');

      expect(mockText.setOrigin).toHaveBeenCalledWith(0.5, 1);
    });

    it('should update label text when setNameLabel called again', () => {
      const player = new ProceduralPlayerGraphics(scene, 100, 200, COLORS.PLAYER_HEAD, COLORS.BODY);
      player.setNameLabel('YOU');
      player.setNameLabel('NewName');

      expect(mockText.setText).toHaveBeenCalledWith('NewName');
    });

    it('should destroy label when setNameLabel called with null', () => {
      const player = new ProceduralPlayerGraphics(scene, 100, 200, COLORS.PLAYER_HEAD, COLORS.BODY);
      player.setNameLabel('YOU');
      player.setNameLabel(null);

      expect(mockText.destroy).toHaveBeenCalled();
    });

    it('should update label position when player moves', () => {
      const player = new ProceduralPlayerGraphics(scene, 100, 200, COLORS.PLAYER_HEAD, COLORS.BODY);
      player.setNameLabel('YOU');

      player.setPosition(300, 400);

      // Label should follow player position (x=300, y=400 - 13 - 5 = 382)
      expect(mockText.x).toBe(300);
      expect(mockText.y).toBe(382);
    });
  });

  describe('Task 3.7: Spawn invulnerability ring', () => {
    it('should not draw ring when not invulnerable', () => {
      new ProceduralPlayerGraphics(scene, 100, 100, COLORS.PLAYER_HEAD, COLORS.BODY);

      // strokeCircle should only be called for head outline (not ring)
      const strokeCircleCalls = (graphics.strokeCircle as any).mock.calls;
      // Only one stroke circle call (head outline at radius 13)
      const ringCalls = strokeCircleCalls.filter((call: any[]) => call[2] === 25);
      expect(ringCalls).toHaveLength(0);
    });

    it('should draw yellow ring when invulnerable', () => {
      const player = new ProceduralPlayerGraphics(scene, 100, 100, COLORS.PLAYER_HEAD, COLORS.BODY);
      (graphics.clear as any).mockClear();
      (graphics.lineStyle as any).mockClear();
      (graphics.strokeCircle as any).mockClear();

      player.setInvulnerable(true);

      // Should draw ring with SPAWN_RING color
      const lineStyleCalls = (graphics.lineStyle as any).mock.calls;
      const hasRingLineStyle = lineStyleCalls.some(
        (call: any[]) => call[1] === COLORS.SPAWN_RING
      );
      expect(hasRingLineStyle).toBe(true);
    });

    it('should draw ring at radius 25', () => {
      const player = new ProceduralPlayerGraphics(scene, 100, 100, COLORS.PLAYER_HEAD, COLORS.BODY);
      (graphics.strokeCircle as any).mockClear();

      player.setInvulnerable(true);

      const strokeCircleCalls = (graphics.strokeCircle as any).mock.calls;
      const hasRing = strokeCircleCalls.some((call: any[]) => call[2] === 25);
      expect(hasRing).toBe(true);
    });

    it('should stop drawing ring when invulnerability disabled', () => {
      const player = new ProceduralPlayerGraphics(scene, 100, 100, COLORS.PLAYER_HEAD, COLORS.BODY);
      player.setInvulnerable(true);
      (graphics.strokeCircle as any).mockClear();
      (graphics.lineStyle as any).mockClear();

      player.setInvulnerable(false);

      // Ring stroke circle should not be called
      const strokeCircleCalls = (graphics.strokeCircle as any).mock.calls;
      const ringCalls = strokeCircleCalls.filter((call: any[]) => call[2] === 25);
      expect(ringCalls).toHaveLength(0);
    });

    it('should trigger redraw when invulnerability changes', () => {
      const player = new ProceduralPlayerGraphics(scene, 100, 100, COLORS.PLAYER_HEAD, COLORS.BODY);
      (graphics.clear as any).mockClear();

      player.setInvulnerable(true);

      expect(graphics.clear).toHaveBeenCalled();
    });
  });
});
