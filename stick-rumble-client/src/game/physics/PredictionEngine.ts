import { MOVEMENT } from '../../shared/constants';
import type { InputState } from '../input/InputManager';

/**
 * Position in 2D space
 */
export interface Position {
  x: number;
  y: number;
}

/**
 * Velocity in 2D space
 */
export interface Velocity {
  x: number;
  y: number;
}

/**
 * Result of physics prediction
 */
export interface PredictionResult {
  position: Position;
  velocity: Velocity;
}

/**
 * PredictionEngine simulates player physics on the client for client-side prediction.
 * This MUST match the server's physics simulation exactly to minimize prediction errors.
 *
 * Physics model:
 * - Acceleration-based movement (not instant velocity)
 * - Diagonal movement is normalized to prevent faster diagonal speed
 * - Velocity capped at MOVEMENT.SPEED
 * - Deceleration when no input is active
 */
export class PredictionEngine {
  /**
   * Predict the next position and velocity based on current state and input.
   * This implements the same physics as the server's movement system.
   *
   * @param currentPosition - Current player position
   * @param currentVelocity - Current player velocity
   * @param input - Player input state (WASD keys)
   * @param deltaTime - Time step in seconds (e.g., 0.016 for 60 FPS)
   * @returns Predicted position and velocity
   */
  predictPosition(
    currentPosition: Position,
    currentVelocity: Velocity,
    input: InputState,
    deltaTime: number
  ): PredictionResult {
    // Calculate desired direction from input
    let directionX = 0;
    let directionY = 0;

    if (input.up) directionY -= 1;
    if (input.down) directionY += 1;
    if (input.left) directionX -= 1;
    if (input.right) directionX += 1;

    // Normalize diagonal movement to prevent faster movement
    const directionMagnitude = Math.sqrt(directionX ** 2 + directionY ** 2);
    if (directionMagnitude > 0) {
      directionX /= directionMagnitude;
      directionY /= directionMagnitude;
    }

    // Calculate new velocity with acceleration
    let newVelocityX = currentVelocity.x;
    let newVelocityY = currentVelocity.y;

    if (directionMagnitude > 0) {
      // Apply acceleration toward desired direction
      const targetVelocityX = directionX * MOVEMENT.SPEED;
      const targetVelocityY = directionY * MOVEMENT.SPEED;

      // Accelerate toward target velocity
      newVelocityX += (targetVelocityX - newVelocityX) * MOVEMENT.ACCELERATION * deltaTime;
      newVelocityY += (targetVelocityY - newVelocityY) * MOVEMENT.ACCELERATION * deltaTime;
    } else {
      // No input: decelerate toward zero
      const currentSpeed = Math.sqrt(newVelocityX ** 2 + newVelocityY ** 2);
      if (currentSpeed > 0) {
        const decelerationAmount = MOVEMENT.DECELERATION * deltaTime;
        const decelerationFactor = Math.max(0, 1 - decelerationAmount / currentSpeed);
        newVelocityX *= decelerationFactor;
        newVelocityY *= decelerationFactor;

        // Snap to zero if very close (prevent floating point drift)
        if (Math.abs(newVelocityX) < 0.1) newVelocityX = 0;
        if (Math.abs(newVelocityY) < 0.1) newVelocityY = 0;
      }
    }

    // Cap velocity at max speed
    const velocityMagnitude = Math.sqrt(newVelocityX ** 2 + newVelocityY ** 2);
    if (velocityMagnitude > MOVEMENT.SPEED) {
      const scale = MOVEMENT.SPEED / velocityMagnitude;
      newVelocityX *= scale;
      newVelocityY *= scale;
    }

    // Update position based on velocity
    const newPositionX = currentPosition.x + newVelocityX * deltaTime;
    const newPositionY = currentPosition.y + newVelocityY * deltaTime;

    return {
      position: { x: newPositionX, y: newPositionY },
      velocity: { x: newVelocityX, y: newVelocityY },
    };
  }
}
