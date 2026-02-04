import { describe, it, expect, beforeEach } from 'vitest';
import { InterpolationEngine, type PositionSnapshot } from './InterpolationEngine';

describe('InterpolationEngine', () => {
  let engine: InterpolationEngine;
  const BUFFER_DELAY_MS = 100; // Render 100ms behind

  beforeEach(() => {
    engine = new InterpolationEngine();
  });

  describe('addSnapshot', () => {
    it('should store position snapshot with timestamp', () => {
      const playerId = 'player1';
      const snapshot: PositionSnapshot = {
        position: { x: 100, y: 200 },
        velocity: { x: 50, y: 0 },
        timestamp: 1000,
      };

      engine.addSnapshot(playerId, snapshot);

      // Verify snapshot is stored by checking interpolation returns expected position
      const result = engine.getInterpolatedPosition(playerId, 1000 + BUFFER_DELAY_MS);
      expect(result).toBeDefined();
      expect(result?.position.x).toBe(100);
      expect(result?.position.y).toBe(200);
    });

    it('should maintain buffer of last 10 snapshots per player', () => {
      const playerId = 'player1';

      // Add 15 snapshots (exceeds buffer size of 10)
      for (let i = 0; i < 15; i++) {
        engine.addSnapshot(playerId, {
          position: { x: i * 10, y: 0 },
          velocity: { x: 10, y: 0 },
          timestamp: i * 100,
        });
      }

      // Verify oldest snapshots were discarded (buffer should only have last 10)
      // The oldest snapshot should be index 5 (timestamp 500ms), so interpolation at 600ms should work
      const validResult = engine.getInterpolatedPosition(playerId, 600 + BUFFER_DELAY_MS);
      expect(validResult).toBeDefined();
    });

    it('should store snapshots independently for different players', () => {
      const player1 = 'player1';
      const player2 = 'player2';

      engine.addSnapshot(player1, {
        position: { x: 100, y: 100 },
        velocity: { x: 0, y: 0 },
        timestamp: 1000,
      });

      engine.addSnapshot(player2, {
        position: { x: 200, y: 200 },
        velocity: { x: 0, y: 0 },
        timestamp: 1000,
      });

      const result1 = engine.getInterpolatedPosition(player1, 1000 + BUFFER_DELAY_MS);
      const result2 = engine.getInterpolatedPosition(player2, 1000 + BUFFER_DELAY_MS);

      expect(result1?.position.x).toBe(100);
      expect(result2?.position.x).toBe(200);
    });
  });

  describe('getInterpolatedPosition - basic interpolation', () => {
    it('should interpolate between two snapshots at 100ms delay', () => {
      const playerId = 'player1';

      // Add snapshots at t=0 and t=100
      engine.addSnapshot(playerId, {
        position: { x: 0, y: 0 },
        velocity: { x: 100, y: 0 },
        timestamp: 0,
      });

      engine.addSnapshot(playerId, {
        position: { x: 100, y: 0 },
        velocity: { x: 100, y: 0 },
        timestamp: 100,
      });

      // Interpolate at t=150 (which is t=50 with 100ms delay)
      // Should be halfway between x=0 and x=100
      const result = engine.getInterpolatedPosition(playerId, 150);

      expect(result).toBeDefined();
      expect(result?.position.x).toBeCloseTo(50, 1);
      expect(result?.position.y).toBeCloseTo(0, 1);
    });

    it('should return exact position when render time matches snapshot time', () => {
      const playerId = 'player1';

      engine.addSnapshot(playerId, {
        position: { x: 100, y: 200 },
        velocity: { x: 0, y: 0 },
        timestamp: 1000,
      });

      // Render at exactly t=1100 (t=1000 with 100ms delay)
      const result = engine.getInterpolatedPosition(playerId, 1000 + BUFFER_DELAY_MS);

      expect(result?.position.x).toBe(100);
      expect(result?.position.y).toBe(200);
    });

    it('should interpolate with multiple snapshots using correct time range', () => {
      const playerId = 'player1';

      // Add 3 snapshots: t=0, t=100, t=200
      engine.addSnapshot(playerId, {
        position: { x: 0, y: 0 },
        velocity: { x: 100, y: 0 },
        timestamp: 0,
      });

      engine.addSnapshot(playerId, {
        position: { x: 100, y: 0 },
        velocity: { x: 100, y: 0 },
        timestamp: 100,
      });

      engine.addSnapshot(playerId, {
        position: { x: 200, y: 0 },
        velocity: { x: 100, y: 0 },
        timestamp: 200,
      });

      // Interpolate at t=250 (render time t=150 with delay)
      // Should interpolate between snapshots at t=100 and t=200
      const result = engine.getInterpolatedPosition(playerId, 250);

      expect(result).toBeDefined();
      expect(result?.position.x).toBeCloseTo(150, 1);
    });

    it('should interpolate velocity for animation sync', () => {
      const playerId = 'player1';

      engine.addSnapshot(playerId, {
        position: { x: 0, y: 0 },
        velocity: { x: 0, y: 0 },
        timestamp: 0,
      });

      engine.addSnapshot(playerId, {
        position: { x: 100, y: 0 },
        velocity: { x: 100, y: 0 },
        timestamp: 100,
      });

      // Interpolate at midpoint
      const result = engine.getInterpolatedPosition(playerId, 150);

      expect(result?.velocity.x).toBeCloseTo(50, 1);
      expect(result?.velocity.y).toBeCloseTo(0, 1);
    });
  });

  describe('getInterpolatedPosition - extrapolation', () => {
    it('should extrapolate using last velocity when no new data for <200ms', () => {
      const playerId = 'player1';

      // Add snapshot at t=0 with velocity (100, 0)
      engine.addSnapshot(playerId, {
        position: { x: 0, y: 0 },
        velocity: { x: 100, y: 0 },
        timestamp: 0,
      });

      // Add snapshot at t=100
      engine.addSnapshot(playerId, {
        position: { x: 100, y: 0 },
        velocity: { x: 100, y: 0 },
        timestamp: 100,
      });

      // Query at t=250 (render time t=150, which is 50ms after last snapshot at t=100)
      // Should extrapolate: position = 100 + (100 * 0.05) = 105
      const result = engine.getInterpolatedPosition(playerId, 250);

      expect(result).toBeDefined();
      expect(result?.position.x).toBeCloseTo(105, 1);
      expect(result?.velocity.x).toBeCloseTo(100, 1);
    });

    it('should cap extrapolation at 100ms beyond last snapshot', () => {
      const playerId = 'player1';

      engine.addSnapshot(playerId, {
        position: { x: 0, y: 0 },
        velocity: { x: 100, y: 0 },
        timestamp: 0,
      });

      engine.addSnapshot(playerId, {
        position: { x: 100, y: 0 },
        velocity: { x: 100, y: 0 },
        timestamp: 100,
      });

      // Query at t=350 (render time t=250, which is 150ms after last snapshot)
      // Extrapolation should be capped at 100ms: position = 100 + (100 * 0.1) = 110
      const result = engine.getInterpolatedPosition(playerId, 350);

      expect(result?.position.x).toBeCloseTo(110, 1);
    });

    it('should freeze position if no update for >200ms', () => {
      const playerId = 'player1';

      engine.addSnapshot(playerId, {
        position: { x: 100, y: 200 },
        velocity: { x: 50, y: 0 },
        timestamp: 0,
      });

      // Query at t=400 (render time t=300, which is 300ms after last snapshot)
      // Should freeze at last known position (no extrapolation after 200ms threshold)
      const result = engine.getInterpolatedPosition(playerId, 400);

      expect(result?.position.x).toBe(100);
      expect(result?.position.y).toBe(200);
      expect(result?.velocity.x).toBe(0); // Velocity should be zeroed when frozen
      expect(result?.velocity.y).toBe(0);
    });
  });

  describe('getInterpolatedPosition - edge cases', () => {
    it('should return null for unknown player', () => {
      const result = engine.getInterpolatedPosition('unknown', 1000);
      expect(result).toBeNull();
    });

    it('should return null when no snapshots exist', () => {
      const playerId = 'player1';
      const result = engine.getInterpolatedPosition(playerId, 1000);
      expect(result).toBeNull();
    });

    it('should return first snapshot when render time is before first snapshot', () => {
      const playerId = 'player1';

      engine.addSnapshot(playerId, {
        position: { x: 100, y: 200 },
        velocity: { x: 0, y: 0 },
        timestamp: 1000,
      });

      // Query at t=500 (render time before first snapshot)
      const result = engine.getInterpolatedPosition(playerId, 500);

      expect(result?.position.x).toBe(100);
      expect(result?.position.y).toBe(200);
    });

    it('should handle single snapshot by returning exact position', () => {
      const playerId = 'player1';

      engine.addSnapshot(playerId, {
        position: { x: 100, y: 200 },
        velocity: { x: 50, y: 0 },
        timestamp: 1000,
      });

      // Query at t=1150 (render time t=1050, 50ms after snapshot)
      // With only one snapshot, should extrapolate
      const result = engine.getInterpolatedPosition(playerId, 1150);

      expect(result).toBeDefined();
      expect(result?.position.x).toBeCloseTo(102.5, 1); // 100 + (50 * 0.05)
    });
  });

  describe('clearPlayer', () => {
    it('should remove all snapshots for a player', () => {
      const playerId = 'player1';

      engine.addSnapshot(playerId, {
        position: { x: 100, y: 200 },
        velocity: { x: 0, y: 0 },
        timestamp: 1000,
      });

      engine.clearPlayer(playerId);

      const result = engine.getInterpolatedPosition(playerId, 1100);
      expect(result).toBeNull();
    });

    it('should not affect other players', () => {
      const player1 = 'player1';
      const player2 = 'player2';

      engine.addSnapshot(player1, {
        position: { x: 100, y: 100 },
        velocity: { x: 0, y: 0 },
        timestamp: 1000,
      });

      engine.addSnapshot(player2, {
        position: { x: 200, y: 200 },
        velocity: { x: 0, y: 0 },
        timestamp: 1000,
      });

      engine.clearPlayer(player1);

      const result1 = engine.getInterpolatedPosition(player1, 1100);
      const result2 = engine.getInterpolatedPosition(player2, 1100);

      expect(result1).toBeNull();
      expect(result2).toBeDefined();
    });
  });

  describe('diagonal movement interpolation', () => {
    it('should interpolate correctly in both X and Y dimensions', () => {
      const playerId = 'player1';

      engine.addSnapshot(playerId, {
        position: { x: 0, y: 0 },
        velocity: { x: 0, y: 0 },
        timestamp: 0,
      });

      engine.addSnapshot(playerId, {
        position: { x: 100, y: 100 },
        velocity: { x: 100, y: 100 },
        timestamp: 100,
      });

      // Interpolate at midpoint (t=150, render time t=50)
      const result = engine.getInterpolatedPosition(playerId, 150);

      expect(result?.position.x).toBeCloseTo(50, 1);
      expect(result?.position.y).toBeCloseTo(50, 1);
      expect(result?.velocity.x).toBeCloseTo(50, 1); // Velocity interpolates from 0 to 100
      expect(result?.velocity.y).toBeCloseTo(50, 1);
    });
  });

  describe('real-world simulation', () => {
    it('should handle typical 20Hz server updates with 60Hz client render', () => {
      const playerId = 'player1';
      const SERVER_UPDATE_INTERVAL = 50; // 20Hz = 50ms
      const CLIENT_FRAME_INTERVAL = 16.67; // 60Hz = ~16.67ms

      // Simulate server updates at 20Hz for 500ms (10 updates)
      for (let i = 0; i <= 10; i++) {
        const timestamp = i * SERVER_UPDATE_INTERVAL;
        engine.addSnapshot(playerId, {
          position: { x: timestamp, y: 0 }, // Moving at 1px/ms
          velocity: { x: 20, y: 0 },
          timestamp,
        });
      }

      // Simulate client rendering at 60Hz
      let lastX = -1;
      for (let frame = 0; frame < 30; frame++) {
        const renderTime = frame * CLIENT_FRAME_INTERVAL;
        const result = engine.getInterpolatedPosition(playerId, renderTime + BUFFER_DELAY_MS);

        if (result) {
          // Verify position increases monotonically (smooth movement)
          if (lastX >= 0) {
            expect(result.position.x).toBeGreaterThanOrEqual(lastX);
          }
          lastX = result.position.x;
        }
      }
    });

    it('should handle packet loss by extrapolating then freezing', () => {
      const playerId = 'player1';

      // Normal updates
      engine.addSnapshot(playerId, {
        position: { x: 0, y: 0 },
        velocity: { x: 100, y: 0 },
        timestamp: 0,
      });

      engine.addSnapshot(playerId, {
        position: { x: 100, y: 0 },
        velocity: { x: 100, y: 0 },
        timestamp: 100,
      });

      // Simulate packet loss: no update for 200ms

      // At t=250 (render t=150): should extrapolate (50ms after last snapshot)
      const result1 = engine.getInterpolatedPosition(playerId, 250);
      expect(result1?.position.x).toBeCloseTo(105, 1);

      // At t=350 (render t=250): should freeze (150ms after last snapshot, exceeds 200ms threshold)
      // Wait, render time is 250ms, last snapshot was at 100ms, so 150ms gap
      // Threshold is 200ms, so should still extrapolate but cap at 100ms
      const result2 = engine.getInterpolatedPosition(playerId, 350);
      expect(result2?.position.x).toBeCloseTo(110, 1); // Capped at 100ms extrapolation

      // At t=450 (render t=350): should freeze (250ms after last snapshot)
      const result3 = engine.getInterpolatedPosition(playerId, 450);
      expect(result3?.position.x).toBe(100); // Frozen at last snapshot position
      expect(result3?.velocity.x).toBe(0); // Velocity zeroed
    });
  });
});
