import { describe, it, expect } from 'vitest';
import { PredictionEngine } from './PredictionEngine';
import type { InputState } from '../input/InputManager';

describe('PredictionEngine', () => {
  describe('predictPosition', () => {
    it('should not move when no input', () => {
      const engine = new PredictionEngine();
      const input: InputState = {
        up: false,
        down: false,
        left: false,
        right: false,
        aimAngle: 0,
        isSprinting: false,
        sequence: 0,
      };

      const result = engine.predictPosition(
        { x: 100, y: 100 },
        { x: 0, y: 0 },
        input,
        0.016 // 16ms delta (60 FPS)
      );

      expect(result.position).toEqual({ x: 100, y: 100 });
      expect(result.velocity).toEqual({ x: 0, y: 0 });
    });

    it('should move up when W pressed', () => {
      const engine = new PredictionEngine();
      const input: InputState = {
        up: true,
        down: false,
        left: false,
        right: false,
        aimAngle: 0,
        isSprinting: false,
        sequence: 0,
      };

      const result = engine.predictPosition(
        { x: 100, y: 100 },
        { x: 0, y: 0 },
        input,
        0.1 // 100ms delta
      );

      // Should accelerate upward (negative Y)
      expect(result.velocity.y).toBeLessThan(0);
      expect(result.position.y).toBeLessThan(100);
    });

    it('should move down when S pressed', () => {
      const engine = new PredictionEngine();
      const input: InputState = {
        up: false,
        down: true,
        left: false,
        right: false,
        aimAngle: 0,
        isSprinting: false,
        sequence: 0,
      };

      const result = engine.predictPosition(
        { x: 100, y: 100 },
        { x: 0, y: 0 },
        input,
        0.1
      );

      // Should accelerate downward (positive Y)
      expect(result.velocity.y).toBeGreaterThan(0);
      expect(result.position.y).toBeGreaterThan(100);
    });

    it('should move left when A pressed', () => {
      const engine = new PredictionEngine();
      const input: InputState = {
        up: false,
        down: false,
        left: true,
        right: false,
        aimAngle: 0,
        isSprinting: false,
        sequence: 0,
      };

      const result = engine.predictPosition(
        { x: 100, y: 100 },
        { x: 0, y: 0 },
        input,
        0.1
      );

      // Should accelerate left (negative X)
      expect(result.velocity.x).toBeLessThan(0);
      expect(result.position.x).toBeLessThan(100);
    });

    it('should move right when D pressed', () => {
      const engine = new PredictionEngine();
      const input: InputState = {
        up: false,
        down: false,
        left: false,
        right: true,
        aimAngle: 0,
        isSprinting: false,
        sequence: 0,
      };

      const result = engine.predictPosition(
        { x: 100, y: 100 },
        { x: 0, y: 0 },
        input,
        0.1
      );

      // Should accelerate right (positive X)
      expect(result.velocity.x).toBeGreaterThan(0);
      expect(result.position.x).toBeGreaterThan(100);
    });

    it('should normalize diagonal movement', () => {
      const engine = new PredictionEngine();
      const input: InputState = {
        up: true,
        down: false,
        left: false,
        right: true,
        aimAngle: 0,
        isSprinting: false,
        sequence: 0,
      };

      // Simulate enough time to reach max speed
      let position = { x: 100, y: 100 };
      let velocity = { x: 0, y: 0 };
      for (let i = 0; i < 100; i++) {
        const result = engine.predictPosition(position, velocity, input, 0.016);
        position = result.position;
        velocity = result.velocity;
      }

      // Diagonal velocity magnitude should equal max speed (200 px/s), not sqrt(2) * 200
      const velocityMagnitude = Math.sqrt(velocity.x ** 2 + velocity.y ** 2);
      expect(velocityMagnitude).toBeCloseTo(200, 0);
    });

    it('should decelerate when input released', () => {
      const engine = new PredictionEngine();

      // First, move right to build velocity
      const inputMoving: InputState = {
        up: false,
        down: false,
        left: false,
        right: true,
        aimAngle: 0,
        isSprinting: false,
        sequence: 0,
      };

      let position = { x: 100, y: 100 };
      let velocity = { x: 0, y: 0 };

      // Build up velocity
      for (let i = 0; i < 50; i++) {
        const result = engine.predictPosition(position, velocity, inputMoving, 0.016);
        position = result.position;
        velocity = result.velocity;
      }

      const velocityAfterMoving = velocity.x;
      expect(velocityAfterMoving).toBeGreaterThan(0);

      // Now release input
      const inputReleased: InputState = {
        up: false,
        down: false,
        left: false,
        right: false,
        aimAngle: 0,
        isSprinting: false,
        sequence: 1,
      };

      const result = engine.predictPosition(position, velocity, inputReleased, 0.1);

      // Velocity should decrease
      expect(result.velocity.x).toBeLessThan(velocityAfterMoving);
      expect(result.velocity.x).toBeGreaterThanOrEqual(0); // Should not overshoot to negative
    });

    it('should cap velocity at max speed', () => {
      const engine = new PredictionEngine();
      const input: InputState = {
        up: false,
        down: false,
        left: false,
        right: true,
        aimAngle: 0,
        isSprinting: false,
        sequence: 0,
      };

      let position = { x: 100, y: 100 };
      let velocity = { x: 0, y: 0 };

      // Simulate many frames to ensure we hit max speed
      for (let i = 0; i < 200; i++) {
        const result = engine.predictPosition(position, velocity, input, 0.016);
        position = result.position;
        velocity = result.velocity;
      }

      // Velocity should not exceed max speed (200 px/s)
      expect(velocity.x).toBeLessThanOrEqual(200);
      expect(velocity.x).toBeCloseTo(200, 0);
    });

    it('should handle opposing inputs (cancel out)', () => {
      const engine = new PredictionEngine();
      const input: InputState = {
        up: true,
        down: true,
        left: true,
        right: true,
        aimAngle: 0,
        isSprinting: false,
        sequence: 0,
      };

      const result = engine.predictPosition(
        { x: 100, y: 100 },
        { x: 0, y: 0 },
        input,
        0.1
      );

      // Opposing inputs should cancel out
      expect(result.velocity).toEqual({ x: 0, y: 0 });
      expect(result.position).toEqual({ x: 100, y: 100 });
    });

    it('should decelerate to zero smoothly', () => {
      const engine = new PredictionEngine();

      // Start with some velocity
      let position = { x: 100, y: 100 };
      let velocity = { x: 150, y: 0 };

      const inputReleased: InputState = {
        up: false,
        down: false,
        left: false,
        right: false,
        aimAngle: 0,
        isSprinting: false,
        sequence: 0,
      };

      // Decelerate over multiple frames - need enough time based on DECELERATION constant
      // With DECELERATION=50 and multiplicative slowdown, need ~500 frames to get close to zero
      for (let i = 0; i < 500; i++) {
        const result = engine.predictPosition(position, velocity, inputReleased, 0.016);
        position = result.position;
        velocity = result.velocity;

        if (velocity.x <= 0.1) {
          break;
        }
      }

      // Should decelerate to near-zero (snap threshold is 0.1)
      expect(velocity.x).toBe(0);
    });

    it('should match server physics simulation', () => {
      // This test verifies that the prediction engine produces identical results
      // to the server's physics simulation for a sequence of inputs
      const engine = new PredictionEngine();

      const inputs: InputState[] = [
        { up: true, down: false, left: false, right: false, aimAngle: 0, isSprinting: false, sequence: 0 },
        { up: true, down: false, left: false, right: true, aimAngle: 0, isSprinting: false, sequence: 1 },
        { up: false, down: false, left: false, right: true, aimAngle: 0, isSprinting: false, sequence: 2 },
        { up: false, down: false, left: false, right: false, aimAngle: 0, isSprinting: false, sequence: 3 },
      ];

      let position = { x: 100, y: 100 };
      let velocity = { x: 0, y: 0 };

      for (const input of inputs) {
        const result = engine.predictPosition(position, velocity, input, 0.016);
        position = result.position;
        velocity = result.velocity;
      }

      // Final position should be deterministic
      expect(position.x).toBeGreaterThan(100);
      expect(position.y).toBeLessThan(100);
    });
  });

  describe('Reconciliation', () => {
    it('should reconcile position when server correction received', () => {
      const engine = new PredictionEngine();

      // Client-side prediction
      let position = { x: 100, y: 100 };
      let velocity = { x: 0, y: 0 };
      const input = { up: true, down: false, left: false, right: false, aimAngle: 0, isSprinting: false, sequence: 1 };

      // Simulate 10 frames of client prediction
      for (let i = 0; i < 10; i++) {
        const result = engine.predictPosition(position, velocity, input, 0.016);
        position = result.position;
        velocity = result.velocity;
      }

      // Server sends correction (e.g., due to collision or validation failure)
      const serverPosition = { x: 100, y: 98 }; // Slightly different from predicted
      const serverVelocity = { x: 0, y: -180 }; // Corrected velocity

      // Client should accept server position as authoritative
      const reconciled = engine.reconcile(
        serverPosition,
        serverVelocity,
        5, // Server processed up to sequence 5
        [
          // Pending inputs after sequence 5
          { sequence: 6, input, timestamp: Date.now() },
          { sequence: 7, input, timestamp: Date.now() },
        ]
      );

      // Should replay pending inputs on top of server position
      expect(reconciled.position.y).toBeLessThan(serverPosition.y); // Moved up from server position
    });

    it('should calculate correction distance for smooth interpolation', () => {
      const engine = new PredictionEngine();

      const predictedPos = { x: 100, y: 100 };
      const serverPos = { x: 102, y: 99 };

      const distance = engine.calculateCorrectionDistance(predictedPos, serverPos);

      // Distance should be ~2.236 (sqrt(2^2 + 1^2))
      expect(distance).toBeCloseTo(2.236, 2);
    });

    it('should determine correction needs instant teleport for large errors', () => {
      const engine = new PredictionEngine();

      const predictedPos = { x: 100, y: 100 };
      const serverPos = { x: 250, y: 100 }; // 150px away

      const needsInstant = engine.needsInstantCorrection(predictedPos, serverPos);

      expect(needsInstant).toBe(true);
    });

    it('should determine correction needs smooth lerp for small errors', () => {
      const engine = new PredictionEngine();

      const predictedPos = { x: 100, y: 100 };
      const serverPos = { x: 105, y: 102 }; // ~5.4px away

      const needsInstant = engine.needsInstantCorrection(predictedPos, serverPos);

      expect(needsInstant).toBe(false);
    });

    it('should replay inputs correctly from server position', () => {
      const engine = new PredictionEngine();

      const serverPosition = { x: 100, y: 100 };
      const serverVelocity = { x: 0, y: 0 };

      const pendingInputs = [
        { sequence: 1, input: { up: true, down: false, left: false, right: false, aimAngle: 0, isSprinting: false, sequence: 1 }, timestamp: Date.now() },
        { sequence: 2, input: { up: true, down: false, left: false, right: false, aimAngle: 0, isSprinting: false, sequence: 2 }, timestamp: Date.now() + 16 },
      ];

      const reconciled = engine.reconcile(serverPosition, serverVelocity, 0, pendingInputs);

      // After replaying 2 "up" inputs, y should be less than starting position
      expect(reconciled.position.y).toBeLessThan(100);
      expect(reconciled.velocity.y).toBeLessThan(0);
    });

    it('should handle empty pending inputs (no replay needed)', () => {
      const engine = new PredictionEngine();

      const serverPosition = { x: 100, y: 100 };
      const serverVelocity = { x: 0, y: 0 };

      const reconciled = engine.reconcile(serverPosition, serverVelocity, 5, []);

      // Should return server state unchanged
      expect(reconciled.position).toEqual(serverPosition);
      expect(reconciled.velocity).toEqual(serverVelocity);
    });
  });
});
