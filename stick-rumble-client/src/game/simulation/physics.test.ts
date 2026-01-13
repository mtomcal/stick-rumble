import { describe, it, expect } from 'vitest';
import {
  normalize,
  accelerateToward,
  decelerateToZero,
  clampToArena,
  calculateDistance,
  checkAABBCollision,
} from './physics';
import type { Vector2 } from './types';
import { ARENA, PLAYER } from '../../shared/constants';

describe('physics utilities', () => {
  describe('normalize', () => {
    it('should normalize a non-zero vector to unit length', () => {
      const v: Vector2 = { x: 3, y: 4 };
      const result = normalize(v);

      const length = Math.sqrt(result.x ** 2 + result.y ** 2);
      expect(length).toBeCloseTo(1, 5);
      expect(result.x).toBeCloseTo(0.6, 5);
      expect(result.y).toBeCloseTo(0.8, 5);
    });

    it('should return zero vector when normalizing zero vector', () => {
      const v: Vector2 = { x: 0, y: 0 };
      const result = normalize(v);

      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
    });

    it('should normalize diagonal vector correctly', () => {
      const v: Vector2 = { x: 1, y: 1 };
      const result = normalize(v);

      const length = Math.sqrt(result.x ** 2 + result.y ** 2);
      expect(length).toBeCloseTo(1, 5);
      expect(result.x).toBeCloseTo(0.707, 2);
      expect(result.y).toBeCloseTo(0.707, 2);
    });
  });

  describe('accelerateToward', () => {
    it('should accelerate current velocity toward target', () => {
      const current: Vector2 = { x: 0, y: 0 };
      const target: Vector2 = { x: 100, y: 0 };
      const accel = 50;
      const dt = 0.1; // 100ms

      const result = accelerateToward(current, target, accel, dt);

      // Should move 5 pixels toward target (50 px/s² * 0.1s = 5 px/s)
      expect(result.x).toBeCloseTo(5, 5);
      expect(result.y).toBe(0);
    });

    it('should snap to target when very close', () => {
      const current: Vector2 = { x: 99, y: 0 };
      const target: Vector2 = { x: 100, y: 0 };
      const accel = 50;
      const dt = 0.1;

      const result = accelerateToward(current, target, accel, dt);

      // Distance is 1, maxChange is 5, so should snap to target
      expect(result.x).toBe(100);
      expect(result.y).toBe(0);
    });

    it('should work in diagonal directions', () => {
      const current: Vector2 = { x: 0, y: 0 };
      const target: Vector2 = { x: 100, y: 100 };
      const accel = 50;
      const dt = 0.1;

      const result = accelerateToward(current, target, accel, dt);

      // Should move toward target equally in both axes
      expect(result.x).toBeGreaterThan(0);
      expect(result.y).toBeGreaterThan(0);
      expect(result.x).toBeCloseTo(result.y, 5);
    });

    it('should handle negative velocities', () => {
      const current: Vector2 = { x: -50, y: 0 };
      const target: Vector2 = { x: 0, y: 0 };
      const accel = 50;
      const dt = 0.1;

      const result = accelerateToward(current, target, accel, dt);

      // Should move toward zero
      expect(result.x).toBeGreaterThan(-50);
      expect(result.x).toBeLessThanOrEqual(0);
    });
  });

  describe('decelerateToZero', () => {
    it('should decelerate to zero', () => {
      const current: Vector2 = { x: 100, y: 50 };
      const decel = 50;
      const dt = 0.1;

      const result = decelerateToZero(current, decel, dt);

      // Should move toward zero
      expect(result.x).toBeLessThan(100);
      expect(result.y).toBeLessThan(50);
    });

    it('should snap to zero when very close', () => {
      const current: Vector2 = { x: 1, y: 1 };
      const decel = 50;
      const dt = 0.1;

      const result = decelerateToZero(current, decel, dt);

      // maxChange is 5, distance is sqrt(2) ≈ 1.4, should snap to zero
      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
    });
  });

  describe('clampToArena', () => {
    it('should not modify position within bounds', () => {
      const pos: Vector2 = { x: 500, y: 500 };
      const result = clampToArena(pos);

      expect(result.x).toBe(500);
      expect(result.y).toBe(500);
    });

    it('should clamp to left boundary', () => {
      const pos: Vector2 = { x: 0, y: 500 };
      const result = clampToArena(pos);

      expect(result.x).toBe(PLAYER.WIDTH / 2);
      expect(result.y).toBe(500);
    });

    it('should clamp to right boundary', () => {
      const pos: Vector2 = { x: ARENA.WIDTH + 100, y: 500 };
      const result = clampToArena(pos);

      expect(result.x).toBe(ARENA.WIDTH - PLAYER.WIDTH / 2);
      expect(result.y).toBe(500);
    });

    it('should clamp to top boundary', () => {
      const pos: Vector2 = { x: 500, y: 0 };
      const result = clampToArena(pos);

      expect(result.x).toBe(500);
      expect(result.y).toBe(PLAYER.HEIGHT / 2);
    });

    it('should clamp to bottom boundary', () => {
      const pos: Vector2 = { x: 500, y: ARENA.HEIGHT + 100 };
      const result = clampToArena(pos);

      expect(result.x).toBe(500);
      expect(result.y).toBe(ARENA.HEIGHT - PLAYER.HEIGHT / 2);
    });

    it('should clamp to corner', () => {
      const pos: Vector2 = { x: -100, y: -100 };
      const result = clampToArena(pos);

      expect(result.x).toBe(PLAYER.WIDTH / 2);
      expect(result.y).toBe(PLAYER.HEIGHT / 2);
    });
  });

  describe('calculateDistance', () => {
    it('should calculate distance between two points', () => {
      const pos1: Vector2 = { x: 0, y: 0 };
      const pos2: Vector2 = { x: 3, y: 4 };

      const distance = calculateDistance(pos1, pos2);

      expect(distance).toBe(5);
    });

    it('should return zero for same points', () => {
      const pos1: Vector2 = { x: 100, y: 200 };
      const pos2: Vector2 = { x: 100, y: 200 };

      const distance = calculateDistance(pos1, pos2);

      expect(distance).toBe(0);
    });

    it('should handle negative coordinates', () => {
      const pos1: Vector2 = { x: -10, y: -10 };
      const pos2: Vector2 = { x: 10, y: 10 };

      const distance = calculateDistance(pos1, pos2);

      expect(distance).toBeCloseTo(28.28, 2);
    });
  });

  describe('checkAABBCollision', () => {
    it('should detect collision when point is inside box', () => {
      const point: Vector2 = { x: 100, y: 100 };
      const center: Vector2 = { x: 100, y: 100 };
      const halfWidth = 20;
      const halfHeight = 30;

      const collision = checkAABBCollision(point, center, halfWidth, halfHeight);

      expect(collision).toBe(true);
    });

    it('should detect collision at edge of box', () => {
      const point: Vector2 = { x: 119, y: 100 };
      const center: Vector2 = { x: 100, y: 100 };
      const halfWidth = 20;
      const halfHeight = 30;

      const collision = checkAABBCollision(point, center, halfWidth, halfHeight);

      expect(collision).toBe(true);
    });

    it('should not detect collision outside box horizontally', () => {
      const point: Vector2 = { x: 121, y: 100 };
      const center: Vector2 = { x: 100, y: 100 };
      const halfWidth = 20;
      const halfHeight = 30;

      const collision = checkAABBCollision(point, center, halfWidth, halfHeight);

      expect(collision).toBe(false);
    });

    it('should not detect collision outside box vertically', () => {
      const point: Vector2 = { x: 100, y: 131 };
      const center: Vector2 = { x: 100, y: 100 };
      const halfWidth = 20;
      const halfHeight = 30;

      const collision = checkAABBCollision(point, center, halfWidth, halfHeight);

      expect(collision).toBe(false);
    });

    it('should handle negative coordinates', () => {
      const point: Vector2 = { x: -100, y: -100 };
      const center: Vector2 = { x: -100, y: -100 };
      const halfWidth = 10;
      const halfHeight = 10;

      const collision = checkAABBCollision(point, center, halfWidth, halfHeight);

      expect(collision).toBe(true);
    });
  });
});
