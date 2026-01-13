/**
 * Pure physics functions for game simulation
 * No Phaser dependencies - just math
 * Mirrors server-side physics.go patterns
 */

import type { Vector2 } from './types';
import { ARENA, PLAYER } from '../../shared/constants';

/**
 * Normalize a vector to unit length
 * Returns zero vector if input is zero
 */
export function normalize(v: Vector2): Vector2 {
  const length = Math.sqrt(v.x * v.x + v.y * v.y);
  if (length === 0) {
    return { x: 0, y: 0 };
  }
  return {
    x: v.x / length,
    y: v.y / length,
  };
}

/**
 * Smoothly accelerate current velocity toward target velocity
 * @param current Current velocity
 * @param target Target velocity
 * @param accel Acceleration rate (pixels per second squared)
 * @param deltaTime Time step in seconds
 */
export function accelerateToward(
  current: Vector2,
  target: Vector2,
  accel: number,
  deltaTime: number
): Vector2 {
  const diff = {
    x: target.x - current.x,
    y: target.y - current.y,
  };

  // Calculate the maximum change possible this frame
  const maxChange = accel * deltaTime;

  // If we're close enough, just snap to target
  const diffLength = Math.sqrt(diff.x * diff.x + diff.y * diff.y);
  if (diffLength <= maxChange) {
    return target;
  }

  // Otherwise, move toward target by maxChange amount
  const diffNorm = {
    x: diff.x / diffLength,
    y: diff.y / diffLength,
  };

  return {
    x: current.x + diffNorm.x * maxChange,
    y: current.y + diffNorm.y * maxChange,
  };
}

/**
 * Smoothly decelerate velocity to zero
 * @param current Current velocity
 * @param decel Deceleration rate (pixels per second squared)
 * @param deltaTime Time step in seconds
 */
export function decelerateToZero(
  current: Vector2,
  decel: number,
  deltaTime: number
): Vector2 {
  return accelerateToward(current, { x: 0, y: 0 }, decel, deltaTime);
}

/**
 * Clamp position to arena bounds accounting for player size
 * @param pos Position to clamp
 */
export function clampToArena(pos: Vector2): Vector2 {
  const halfWidth = PLAYER.WIDTH / 2;
  const halfHeight = PLAYER.HEIGHT / 2;

  const x = Math.max(halfWidth, Math.min(pos.x, ARENA.WIDTH - halfWidth));
  const y = Math.max(halfHeight, Math.min(pos.y, ARENA.HEIGHT - halfHeight));

  return { x, y };
}

/**
 * Calculate Euclidean distance between two positions
 */
export function calculateDistance(pos1: Vector2, pos2: Vector2): number {
  const dx = pos2.x - pos1.x;
  const dy = pos2.y - pos1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Check if a point is within a rectangular hitbox using AABB collision
 * @param point Point to check
 * @param center Center of the rectangle
 * @param halfWidth Half width of the rectangle
 * @param halfHeight Half height of the rectangle
 */
export function checkAABBCollision(
  point: Vector2,
  center: Vector2,
  halfWidth: number,
  halfHeight: number
): boolean {
  return (
    Math.abs(point.x - center.x) < halfWidth &&
    Math.abs(point.y - center.y) < halfHeight
  );
}
