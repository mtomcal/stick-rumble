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

  describe('TS-MELEE-019: Wall-clipped melee swing arc', () => {
    beforeEach(() => {
      weapon = new MeleeWeapon(scene, 100, 100, 'Bat');
    });

    it('should use moveTo/lineTo polyline instead of arc when obstacles are provided', () => {
      const graphics = (weapon as any).graphics;
      const obstacles = [
        {
          id: 'wall',
          type: 'wall' as const,
          shape: 'rectangle' as const,
          x: 150,
          y: 80,
          width: 20,
          height: 40,
          blocksMovement: true,
          blocksProjectiles: true,
          blocksLineOfSight: true,
        },
      ];

      weapon.showSwingAnimation(0, obstacles);

      expect(graphics.arc).not.toHaveBeenCalled();
      expect(graphics.beginPath).toHaveBeenCalledTimes(1);
      expect(graphics.moveTo).toHaveBeenCalledTimes(1);
      expect(graphics.lineTo).toHaveBeenCalledTimes(16);
      expect(graphics.strokePath).toHaveBeenCalledTimes(1);
    });

    it('should still use arc when no obstacles are provided', () => {
      const graphics = (weapon as any).graphics;
      weapon.showSwingAnimation(0);

      expect(graphics.arc).toHaveBeenCalled();
      expect(graphics.moveTo).not.toHaveBeenCalled();
      expect(graphics.lineTo).not.toHaveBeenCalled();
    });

    it('should clip arc to first blocking contact when obstacle is in front', () => {
      const graphics = (weapon as any).graphics;
      // Place a wall directly in front (aimAngle=0 means facing right)
      const obstacles = [
        {
          id: 'wall',
          type: 'wall' as const,
          shape: 'rectangle' as const,
          x: 150,
          y: 80,
          width: 20,
          height: 40,
          blocksMovement: true,
          blocksProjectiles: true,
          blocksLineOfSight: true,
        },
      ];

      weapon.showSwingAnimation(0, obstacles);

      // With weapon at (100,100), aimAngle=0, range=90, the ray end would be at (190, 100)
      // Wall at x=150 blocks it. Contact distance is 50px.
      const lineToCalls = graphics.lineTo.mock.calls as number[][];
      expect(lineToCalls.length).toBe(16);

      // Verify central ray is clipped to the wall contact distance (~50px from origin => x≈150)
      const midCall = lineToCalls[Math.floor(lineToCalls.length / 2)];
      expect(midCall[0]).toBeCloseTo(150, 0);
    });

    it('should enforce minimum visible length of 20px when flush against a wall', () => {
      const graphics = (weapon as any).graphics;
      // Place a wall very close to the weapon (contact distance 5px)
      const obstacles = [
        {
          id: 'wall',
          type: 'wall' as const,
          shape: 'rectangle' as const,
          x: 105,
          y: 80,
          width: 20,
          height: 40,
          blocksMovement: true,
          blocksProjectiles: true,
          blocksLineOfSight: true,
        },
      ];

      weapon.showSwingAnimation(0, obstacles);

      const lineToCalls = graphics.lineTo.mock.calls as number[][];
      expect(lineToCalls.length).toBe(16);

      // The central ray should render at least 20px Euclidean distance from weapon position
      const midCall = lineToCalls[Math.floor(lineToCalls.length / 2)];
      const distance = Math.hypot(midCall[0] - 100, midCall[1] - 100);
      expect(distance).toBeCloseTo(20, 10);
    });

    it('should clamp to exactly 20px when contact distance is between 0 and 20', () => {
      const graphics = (weapon as any).graphics;
      // Wall at contact distance 15px
      const obstacles = [
        {
          id: 'wall',
          type: 'wall' as const,
          shape: 'rectangle' as const,
          x: 115,
          y: 80,
          width: 20,
          height: 40,
          blocksMovement: true,
          blocksProjectiles: true,
          blocksLineOfSight: true,
        },
      ];

      weapon.showSwingAnimation(0, obstacles);

      const lineToCalls = graphics.lineTo.mock.calls as number[][];
      const midCall = lineToCalls[Math.floor(lineToCalls.length / 2)];
      const distance = Math.hypot(midCall[0] - 100, midCall[1] - 100);
      expect(distance).toBeCloseTo(20, 10);
    });

    it('should use actual contact distance when it is greater than 20px', () => {
      const graphics = (weapon as any).graphics;
      // Wall at contact distance 25px
      const obstacles = [
        {
          id: 'wall',
          type: 'wall' as const,
          shape: 'rectangle' as const,
          x: 125,
          y: 80,
          width: 20,
          height: 40,
          blocksMovement: true,
          blocksProjectiles: true,
          blocksLineOfSight: true,
        },
      ];

      weapon.showSwingAnimation(0, obstacles);

      const lineToCalls = graphics.lineTo.mock.calls as number[][];
      const midCall = lineToCalls[Math.floor(lineToCalls.length / 2)];
      const distance = Math.hypot(midCall[0] - 100, midCall[1] - 100);
      expect(distance).toBeCloseTo(25, 0);
    });

    it('should enforce 20px minimum when weapon starts inside an obstacle', () => {
      const graphics = (weapon as any).graphics;
      // Weapon at (100,100), wall encompasses the origin
      const obstacles = [
        {
          id: 'wall',
          type: 'wall' as const,
          shape: 'rectangle' as const,
          x: 90,
          y: 90,
          width: 20,
          height: 20,
          blocksMovement: true,
          blocksProjectiles: true,
          blocksLineOfSight: true,
        },
      ];

      weapon.showSwingAnimation(0, obstacles);

      const lineToCalls = graphics.lineTo.mock.calls as number[][];
      const midCall = lineToCalls[Math.floor(lineToCalls.length / 2)];
      const distance = Math.hypot(midCall[0] - 100, midCall[1] - 100);
      expect(distance).toBeCloseTo(20, 10);
    });

    it('should only clip rays that intersect obstacles, leaving others at full range', () => {
      const graphics = (weapon as any).graphics;
      // Place a wall that only blocks the upper half of the arc
      const obstacles = [
        {
          id: 'wall',
          type: 'wall' as const,
          shape: 'rectangle' as const,
          x: 150,
          y: 60,
          width: 20,
          height: 30,
          blocksMovement: true,
          blocksProjectiles: true,
          blocksLineOfSight: true,
        },
      ];

      weapon.showSwingAnimation(0, obstacles);

      const lineToCalls = graphics.lineTo.mock.calls as number[][];
      expect(lineToCalls.length).toBe(16);

      // Some rays should be at full range (~190), others clipped (~150)
      const xs = lineToCalls.map((call) => call[0]);
      const maxX = Math.max(...xs);
      const minX = Math.min(...xs);

      // At least one ray should be at full range (close to 190)
      expect(maxX).toBeCloseTo(190, 0);
      // At least one ray should be clipped (close to 150)
      expect(minX).toBeCloseTo(150, 0);
    });

    it('should preserve white stroke-only style when using polyline', () => {
      const graphics = (weapon as any).graphics;
      const obstacles = [
        {
          id: 'wall',
          type: 'wall' as const,
          shape: 'rectangle' as const,
          x: 150,
          y: 80,
          width: 20,
          height: 40,
          blocksMovement: true,
          blocksProjectiles: true,
          blocksLineOfSight: true,
        },
      ];

      weapon.showSwingAnimation(0, obstacles);

      expect(graphics.lineStyle).toHaveBeenCalledWith(2, 0xFFFFFF, 0.8);
      expect(graphics.fillStyle).not.toHaveBeenCalled();
      expect(graphics.fillPath).not.toHaveBeenCalled();
    });

    it('should pass obstacles through startSwing to showSwingAnimation', () => {
      const graphics = (weapon as any).graphics;
      const obstacles = [
        {
          id: 'wall',
          type: 'wall' as const,
          shape: 'rectangle' as const,
          x: 150,
          y: 80,
          width: 20,
          height: 40,
          blocksMovement: true,
          blocksProjectiles: true,
          blocksLineOfSight: true,
        },
      ];

      weapon.startSwing(0, undefined, obstacles);

      expect(graphics.arc).not.toHaveBeenCalled();
      expect(graphics.beginPath).toHaveBeenCalledTimes(1);
      expect(graphics.moveTo).toHaveBeenCalledTimes(1);
      expect(graphics.lineTo).toHaveBeenCalledTimes(16);
    });

    it('should ignore obstacles that do not block projectiles', () => {
      const graphics = (weapon as any).graphics;
      const obstacles = [
        {
          id: 'glass',
          type: 'wall' as const,
          shape: 'rectangle' as const,
          x: 150,
          y: 80,
          width: 20,
          height: 40,
          blocksMovement: false,
          blocksProjectiles: false,
          blocksLineOfSight: false,
        },
      ];

      weapon.showSwingAnimation(0, obstacles);

      // Still uses polyline path because obstacles array is non-empty,
      // but no rays are clipped since the obstacle does not block projectiles
      expect(graphics.arc).not.toHaveBeenCalled();
      expect(graphics.lineTo).toHaveBeenCalledTimes(16);

      // Central ray should be at full range (~190)
      const lineToCalls = graphics.lineTo.mock.calls as number[][];
      const midCall = lineToCalls[Math.floor(lineToCalls.length / 2)];
      expect(midCall[0]).toBeCloseTo(190, 0);
    });

    it('should clip to the nearest obstacle when multiple block the same ray', () => {
      const graphics = (weapon as any).graphics;
      const obstacles = [
        {
          id: 'far-wall',
          type: 'wall' as const,
          shape: 'rectangle' as const,
          x: 160,
          y: 80,
          width: 20,
          height: 40,
          blocksMovement: true,
          blocksProjectiles: true,
          blocksLineOfSight: true,
        },
        {
          id: 'near-wall',
          type: 'wall' as const,
          shape: 'rectangle' as const,
          x: 140,
          y: 80,
          width: 20,
          height: 40,
          blocksMovement: true,
          blocksProjectiles: true,
          blocksLineOfSight: true,
        },
      ];

      weapon.showSwingAnimation(0, obstacles);

      const lineToCalls = graphics.lineTo.mock.calls as number[][];
      const midCall = lineToCalls[Math.floor(lineToCalls.length / 2)];
      // Should clip to the nearer wall at x≈140 (contact distance 40px), not x≈160
      expect(midCall[0]).toBeCloseTo(140, 0);
    });

    it('should clip correctly for non-zero aim angles', () => {
      const graphics = (weapon as any).graphics;
      // aimAngle = π/2 means facing down; place wall below
      const obstacles = [
        {
          id: 'wall',
          type: 'wall' as const,
          shape: 'rectangle' as const,
          x: 80,
          y: 150,
          width: 40,
          height: 20,
          blocksMovement: true,
          blocksProjectiles: true,
          blocksLineOfSight: true,
        },
      ];

      weapon.showSwingAnimation(Math.PI / 2, obstacles);

      const lineToCalls = graphics.lineTo.mock.calls as number[][];
      expect(lineToCalls.length).toBe(16);

      // Central ray should be clipped to wall at y≈150
      const midCall = lineToCalls[Math.floor(lineToCalls.length / 2)];
      expect(midCall[1]).toBeCloseTo(150, 0);
    });

    it('should render an 80-degree arc span as a polyline', () => {
      const graphics = (weapon as any).graphics;
      const obstacles = [
        {
          id: 'wall',
          type: 'wall' as const,
          shape: 'rectangle' as const,
          x: 150,
          y: 80,
          width: 20,
          height: 40,
          blocksMovement: true,
          blocksProjectiles: true,
          blocksLineOfSight: true,
        },
      ];

      weapon.showSwingAnimation(0, obstacles);

      const moveToCall = graphics.moveTo.mock.calls[0] as number[];
      const lineToCalls = graphics.lineTo.mock.calls as number[][];
      const firstPoint = moveToCall;
      const lastPoint = lineToCalls[lineToCalls.length - 1];

      // First and last points should be at ±40° from aimAngle=0
      const firstAngle = Math.atan2(firstPoint[1] - 100, firstPoint[0] - 100);
      const lastAngle = Math.atan2(lastPoint[1] - 100, lastPoint[0] - 100);
      const arcSpan = lastAngle - firstAngle;
      expect(arcSpan).toBeCloseTo(80 * Math.PI / 180, 5);
    });

    it('should clip Katana arc at its longer range', () => {
      const katana = new MeleeWeapon(scene, 100, 100, 'Katana');
      const graphics = (katana as any).graphics;
      const obstacles = [
        {
          id: 'wall',
          type: 'wall' as const,
          shape: 'rectangle' as const,
          x: 170,
          y: 80,
          width: 20,
          height: 40,
          blocksMovement: true,
          blocksProjectiles: true,
          blocksLineOfSight: true,
        },
      ];

      katana.showSwingAnimation(0, obstacles);

      const lineToCalls = graphics.lineTo.mock.calls as number[][];
      const midCall = lineToCalls[Math.floor(lineToCalls.length / 2)];
      // Katana range is 110, wall at x=170 blocks at distance 70px
      expect(midCall[0]).toBeCloseTo(170, 0);
    });
  });
});
