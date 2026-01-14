import { describe, it, expect, beforeEach } from 'vitest';
import { ScenarioRunner } from './ScenarioRunner';
import { ManualClock } from '../utils/Clock';
import type { Scenario, Assertion, InputState } from './types';

describe('ScenarioRunner', () => {
  let runner: ScenarioRunner;

  const neutralInput: InputState = {
    up: false,
    down: false,
    left: false,
    right: false,
  };

  beforeEach(() => {
    runner = new ScenarioRunner();
  });

  describe('run', () => {
    it('should run empty scenario successfully', () => {
      const scenario: Scenario = {
        name: 'empty-scenario',
        players: [],
        inputs: [],
        duration: 0,
      };

      const result = runner.run(scenario, []);

      expect(result.scenarioName).toBe('empty-scenario');
      expect(result.passed).toBe(true);
      expect(result.assertions).toHaveLength(0);
    });

    it('should create players at specified positions', () => {
      const scenario: Scenario = {
        name: 'player-spawn',
        players: [
          { id: 'player1', startPosition: { x: 100, y: 200 } },
          { id: 'player2', startPosition: { x: 300, y: 400 } },
        ],
        inputs: [],
        duration: 10,
      };

      const assertions: Assertion[] = [
        {
          tick: 0,
          description: 'Player 1 at spawn position',
          check: (sim) => {
            const p1 = sim.getPlayerState('player1')!;
            return p1.position.x === 100 && p1.position.y === 200;
          },
        },
        {
          tick: 0,
          description: 'Player 2 at spawn position',
          check: (sim) => {
            const p2 = sim.getPlayerState('player2')!;
            return p2.position.x === 300 && p2.position.y === 400;
          },
        },
      ];

      const result = runner.run(scenario, assertions);

      expect(result.passed).toBe(true);
      expect(result.assertions).toHaveLength(2);
      expect(result.assertions[0].passed).toBe(true);
      expect(result.assertions[1].passed).toBe(true);
    });

    it('should apply inputs at correct ticks', () => {
      const scenario: Scenario = {
        name: 'input-application',
        players: [{ id: 'player1', startPosition: { x: 500, y: 500 } }],
        inputs: [
          { tick: 5, playerId: 'player1', input: { ...neutralInput, right: true } },
          { tick: 10, playerId: 'player1', input: { ...neutralInput, left: true } },
        ],
        duration: 20,
      };

      const assertions: Assertion[] = [
        {
          tick: 6,
          description: 'Player should be moving right',
          check: (sim) => {
            const p1 = sim.getPlayerState('player1')!;
            return p1.position.x > 500;
          },
        },
      ];

      const result = runner.run(scenario, assertions);

      expect(result.passed).toBe(true);
      expect(result.assertions[0].passed).toBe(true);
    });

    it('should handle multiple inputs at same tick', () => {
      const scenario: Scenario = {
        name: 'simultaneous-inputs',
        players: [
          { id: 'player1', startPosition: { x: 100, y: 500 } },
          { id: 'player2', startPosition: { x: 200, y: 500 } },
        ],
        inputs: [
          { tick: 0, playerId: 'player1', input: { ...neutralInput, right: true } },
          { tick: 0, playerId: 'player2', input: { ...neutralInput, left: true } },
        ],
        duration: 60,
      };

      const assertions: Assertion[] = [
        {
          tick: 30,
          description: 'Player 1 moved right',
          check: (sim) => sim.getPlayerState('player1')!.position.x > 100,
        },
        {
          tick: 30,
          description: 'Player 2 moved left',
          check: (sim) => sim.getPlayerState('player2')!.position.x < 200,
        },
      ];

      const result = runner.run(scenario, assertions);

      expect(result.passed).toBe(true);
      expect(result.assertions.every((a) => a.passed)).toBe(true);
    });

    it('should check assertions at correct ticks', () => {
      const scenario: Scenario = {
        name: 'assertion-timing',
        players: [{ id: 'player1', startPosition: { x: 500, y: 500 } }],
        inputs: [],
        duration: 100,
      };

      const ticksChecked: number[] = [];

      const assertions: Assertion[] = [
        {
          tick: 0,
          description: 'Check at tick 0',
          check: () => {
            ticksChecked.push(0);
            return true;
          },
        },
        {
          tick: 50,
          description: 'Check at tick 50',
          check: () => {
            ticksChecked.push(50);
            return true;
          },
        },
        {
          tick: 99,
          description: 'Check at tick 99',
          check: () => {
            ticksChecked.push(99);
            return true;
          },
        },
      ];

      const result = runner.run(scenario, assertions);

      expect(result.passed).toBe(true);
      expect(ticksChecked).toEqual([0, 50, 99]);
    });

    it('should mark scenario as failed if any assertion fails', () => {
      const scenario: Scenario = {
        name: 'failing-scenario',
        players: [{ id: 'player1', startPosition: { x: 500, y: 500 } }],
        inputs: [],
        duration: 10,
      };

      const assertions: Assertion[] = [
        {
          tick: 0,
          description: 'Passing assertion',
          check: () => true,
        },
        {
          tick: 5,
          description: 'Failing assertion',
          check: () => false,
        },
      ];

      const result = runner.run(scenario, assertions);

      expect(result.passed).toBe(false);
      expect(result.assertions).toHaveLength(2);
      expect(result.assertions[0].passed).toBe(true);
      expect(result.assertions[1].passed).toBe(false);
    });

    it('should capture assertion errors', () => {
      const scenario: Scenario = {
        name: 'error-scenario',
        players: [],
        inputs: [],
        duration: 10,
      };

      const assertions: Assertion[] = [
        {
          tick: 5,
          description: 'Throwing assertion',
          check: () => {
            throw new Error('Test error message');
          },
        },
      ];

      const result = runner.run(scenario, assertions);

      expect(result.passed).toBe(false);
      expect(result.assertions[0].passed).toBe(false);
      expect(result.assertions[0].error).toContain('Test error message');
    });

    it('should record execution duration', () => {
      const scenario: Scenario = {
        name: 'duration-test',
        players: [],
        inputs: [],
        duration: 10,
      };

      const result = runner.run(scenario, []);

      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should use deterministic time with ManualClock', () => {
      const clock = new ManualClock();
      const runnerWithClock = new ScenarioRunner(clock);

      const scenario: Scenario = {
        name: 'deterministic-time',
        players: [{ id: 'player1', startPosition: { x: 500, y: 500 } }],
        inputs: [{ tick: 0, playerId: 'player1', input: { ...neutralInput, right: true } }],
        duration: 60,
      };

      const assertions: Assertion[] = [
        {
          tick: 59,
          description: 'Position check',
          check: (sim) => {
            const p1 = sim.getPlayerState('player1')!;
            return Math.abs(p1.position.x - 500) > 1;
          },
        },
      ];

      // Run twice and check for identical results
      const result1 = runnerWithClock.run(scenario, assertions);

      // Reset clock
      clock.reset();

      const result2 = runnerWithClock.run(scenario, assertions);

      // Results should be identical
      expect(result1.passed).toBe(result2.passed);
      expect(result1.assertions.length).toBeGreaterThan(0);
      expect(result2.assertions.length).toBeGreaterThan(0);
      expect(result1.assertions[0].passed).toBe(result2.assertions[0].passed);
    });

    it('should handle projectile spawning via simulation', () => {
      const scenario: Scenario = {
        name: 'projectile-test',
        players: [{ id: 'player1', startPosition: { x: 100, y: 100 } }],
        inputs: [],
        duration: 10,
      };

      const assertions: Assertion[] = [
        {
          tick: 5,
          description: 'Projectile should exist after spawn',
          check: (sim) => {
            // Spawn a projectile at tick 5
            sim.spawnProjectile('player1', 0);
            const projectiles = sim.getActiveProjectiles();
            return projectiles.length === 1;
          },
        },
      ];

      const result = runner.run(scenario, assertions);

      expect(result.passed).toBe(true);
      expect(result.assertions[0].passed).toBe(true);
    });
  });

  describe('runFromJSON', () => {
    it('should run scenario from JSON string', () => {
      const scenarioJSON = JSON.stringify({
        name: 'json-scenario',
        description: 'Test scenario from JSON',
        players: [{ id: 'player1', startPosition: { x: 100, y: 100 } }],
        inputs: [],
        duration: 10,
      });

      const assertions: Assertion[] = [
        {
          tick: 0,
          description: 'Player exists',
          check: (sim) => sim.getPlayerState('player1') !== undefined,
        },
      ];

      const result = runner.runFromJSON(scenarioJSON, assertions);

      expect(result.scenarioName).toBe('json-scenario');
      expect(result.passed).toBe(true);
    });

    it('should throw error for invalid JSON', () => {
      expect(() => {
        runner.runFromJSON('invalid json', []);
      }).toThrow();
    });
  });
});
