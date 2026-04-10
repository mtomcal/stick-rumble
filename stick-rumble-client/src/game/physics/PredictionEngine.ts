import { ARENA, MOVEMENT, PLAYER } from '../../shared/constants';
import type { InputState, InputHistoryEntry } from '../input/InputManager';
import type { MapObstacle } from '../../shared/maps';

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

interface PredictionMapContext {
  width: number;
  height: number;
  obstacles: readonly MapObstacle[];
}

// Threshold for instant correction vs smooth lerp (in pixels)
const INSTANT_CORRECTION_THRESHOLD = 100;

/**
 * PredictionEngine simulates player physics on the client for client-side prediction.
 * This MUST match the server's physics simulation exactly to minimize prediction errors.
 *
 * Physics model:
 * - Acceleration-based movement (not instant velocity)
 * - Diagonal movement is normalized to prevent faster diagonal speed
 * - Velocity capped at MOVEMENT.SPEED
 * - Deceleration when no input is active
 *
 * Reconciliation:
 * - When server sends correction, discard incorrect predictions
 * - Replay pending inputs from server's authoritative position
 * - Smooth corrections for small errors, instant teleport for large errors
 */
export class PredictionEngine {
  private mapContext: PredictionMapContext = {
    width: ARENA.WIDTH,
    height: ARENA.HEIGHT,
    obstacles: [],
  };

  setMapContext(mapContext: PredictionMapContext): void {
    this.mapContext = mapContext;
  }

  /**
   * Accelerate current velocity toward target velocity.
   * This matches the server's accelerateToward() function in physics.go.
   *
   * @param current - Current velocity vector
   * @param target - Target velocity vector
   * @param accel - Acceleration rate in px/s²
   * @param deltaTime - Time step in seconds
   * @returns New velocity vector
   */
  private accelerateToward(
    current: Velocity,
    target: Velocity,
    accel: number,
    deltaTime: number
  ): Velocity {
    // Calculate difference vector
    const diffX = target.x - current.x;
    const diffY = target.y - current.y;

    // Calculate maximum change possible this frame
    const maxChange = accel * deltaTime;

    // Calculate distance to target
    const diffLength = Math.sqrt(diffX * diffX + diffY * diffY);

    // If we're close enough, snap to target
    if (diffLength <= maxChange) {
      return { x: target.x, y: target.y };
    }

    // Normalize difference vector and apply maxChange
    const diffNormX = diffX / diffLength;
    const diffNormY = diffY / diffLength;

    return {
      x: current.x + diffNormX * maxChange,
      y: current.y + diffNormY * maxChange,
    };
  }
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
    
    const maxSpeed = input.isSprinting ? MOVEMENT.SPRINT_SPEED : MOVEMENT.SPEED;

    if (directionMagnitude > 0) {
      // Apply acceleration toward desired direction
      const targetVelocity = {
        x: directionX * maxSpeed,
        y: directionY * maxSpeed,
      };

      // Accelerate toward target velocity using direction-based algorithm
      const newVelocity = this.accelerateToward(
        { x: newVelocityX, y: newVelocityY },
        targetVelocity,
        MOVEMENT.ACCELERATION,
        deltaTime
      );
      newVelocityX = newVelocity.x;
      newVelocityY = newVelocity.y;
    } else {
      // No input: decelerate to zero
      const decelerated = this.accelerateToward(
        { x: newVelocityX, y: newVelocityY },
        { x: 0, y: 0 },
        MOVEMENT.DECELERATION,
        deltaTime
      );
      newVelocityX = decelerated.x;
      newVelocityY = decelerated.y;
    }

    // Cap velocity at max speed
    const velocityMagnitude = Math.sqrt(newVelocityX ** 2 + newVelocityY ** 2);
    if (velocityMagnitude > maxSpeed) {
      const scale = maxSpeed / velocityMagnitude;
      newVelocityX *= scale;
      newVelocityY *= scale;
    }

    // Update position based on velocity
    const candidatePosition = {
      x: currentPosition.x + newVelocityX * deltaTime,
      y: currentPosition.y + newVelocityY * deltaTime,
    };
    const resolvedPosition = this.resolveMovement(currentPosition, candidatePosition);

    return {
      position: resolvedPosition,
      velocity: { x: newVelocityX, y: newVelocityY },
    };
  }

  private clampToArena(position: Position): Position {
    const halfWidth = PLAYER.WIDTH / 2;
    const halfHeight = PLAYER.HEIGHT / 2;

    return {
      x: Math.max(halfWidth, Math.min(position.x, this.mapContext.width - halfWidth)),
      y: Math.max(halfHeight, Math.min(position.y, this.mapContext.height - halfHeight)),
    };
  }

  private resolveMovement(currentPosition: Position, desiredPosition: Position): Position {
    const resolvedXBase = this.clampToArena({ x: desiredPosition.x, y: currentPosition.y });
    const resolvedX = this.resolveAxisCollisions(currentPosition.x, resolvedXBase.x, currentPosition.y, true);

    const resolvedYBase = this.clampToArena({ x: resolvedX, y: desiredPosition.y });
    const resolvedY = this.resolveAxisCollisions(currentPosition.y, resolvedYBase.y, resolvedX, false);

    return { x: resolvedX, y: resolvedY };
  }

  private resolveAxisCollisions(oldAxis: number, newAxis: number, fixedAxis: number, horizontal: boolean): number {
    let resolved = newAxis;

    for (const obstacle of this.getMovementBlockingObstacles()) {
      if (!this.playerIntersectsObstacle(resolved, fixedAxis, obstacle, horizontal)) {
        continue;
      }

      if (horizontal) {
        if (resolved > oldAxis) {
          resolved = obstacle.x - PLAYER.WIDTH / 2;
        } else if (resolved < oldAxis) {
          resolved = obstacle.x + obstacle.width + PLAYER.WIDTH / 2;
        }
      } else {
        if (resolved > oldAxis) {
          resolved = obstacle.y - PLAYER.HEIGHT / 2;
        } else if (resolved < oldAxis) {
          resolved = obstacle.y + obstacle.height + PLAYER.HEIGHT / 2;
        }
      }
    }

    return resolved;
  }

  private playerIntersectsObstacle(
    axis: number,
    fixedAxis: number,
    obstacle: MapObstacle,
    horizontal: boolean
  ): boolean {
    let playerLeft = axis - PLAYER.WIDTH / 2;
    let playerRight = axis + PLAYER.WIDTH / 2;
    let playerTop = fixedAxis - PLAYER.HEIGHT / 2;
    let playerBottom = fixedAxis + PLAYER.HEIGHT / 2;

    if (!horizontal) {
      playerLeft = fixedAxis - PLAYER.WIDTH / 2;
      playerRight = fixedAxis + PLAYER.WIDTH / 2;
      playerTop = axis - PLAYER.HEIGHT / 2;
      playerBottom = axis + PLAYER.HEIGHT / 2;
    }

    return (
      playerRight > obstacle.x &&
      playerLeft < obstacle.x + obstacle.width &&
      playerBottom > obstacle.y &&
      playerTop < obstacle.y + obstacle.height
    );
  }

  private getMovementBlockingObstacles(): readonly MapObstacle[] {
    return this.mapContext.obstacles.filter((obstacle) => obstacle.blocksMovement);
  }

  /**
   * Reconcile client prediction with server authoritative state.
   * When server sends a correction, we:
   * 1. Accept server position/velocity as authoritative
   * 2. Replay all pending inputs (inputs sent but not yet acknowledged by server)
   * 3. Return the reconciled state
   *
   * @param serverPosition - Server's authoritative position
   * @param serverVelocity - Server's authoritative velocity
   * @param lastProcessedSequence - Last input sequence the server processed
   * @param pendingInputs - Inputs sent but not yet processed by server
   * @returns Reconciled position and velocity after replaying pending inputs
   */
  reconcile(
    serverPosition: Position,
    serverVelocity: Velocity,
    lastProcessedSequence: number,
    pendingInputs: InputHistoryEntry[]
  ): PredictionResult {
    // Start from server's authoritative state
    let position = { ...serverPosition };
    let velocity = { ...serverVelocity };

    // Replay all inputs that came after the server's last processed sequence
    const inputsToReplay = pendingInputs.filter(entry => entry.sequence > lastProcessedSequence);

    // Sort by sequence to ensure correct order
    inputsToReplay.sort((a, b) => a.sequence - b.sequence);

    // Replay each input using the same physics as prediction
    for (const entry of inputsToReplay) {
      const result = this.predictPosition(position, velocity, entry.input, 0.016);
      position = result.position;
      velocity = result.velocity;
    }

    return { position, velocity };
  }

  /**
   * Calculate the distance between predicted and server positions
   * Used to determine if correction should be smooth or instant
   *
   * @param predictedPos - Client's predicted position
   * @param serverPos - Server's authoritative position
   * @returns Distance in pixels
   */
  calculateCorrectionDistance(predictedPos: Position, serverPos: Position): number {
    const dx = serverPos.x - predictedPos.x;
    const dy = serverPos.y - predictedPos.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Determine if a correction needs instant teleport or can use smooth lerp
   * Large corrections (>=100px) are instant to avoid jarring visual drift
   * Small corrections (<100px) are smoothed over time
   *
   * @param predictedPos - Client's predicted position
   * @param serverPos - Server's authoritative position
   * @returns True if correction should be instant, false if smooth
   */
  needsInstantCorrection(predictedPos: Position, serverPos: Position): boolean {
    return this.calculateCorrectionDistance(predictedPos, serverPos) >= INSTANT_CORRECTION_THRESHOLD;
  }
}
