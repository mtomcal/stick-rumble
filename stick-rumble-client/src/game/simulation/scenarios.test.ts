import { describe, it, expect } from 'vitest';
import { ScenarioRunner } from './ScenarioRunner';
import { ManualClock } from '../utils/Clock';
import type { Scenario, Assertion } from './types';

// Import scenario JSON files
import faceOffCombat from '../../../tests/scenarios/face-off-combat.json';
import playerMovementCorners from '../../../tests/scenarios/player-movement-corners.json';
import weaponPickupRace from '../../../tests/scenarios/weapon-pickup-race.json';

describe('Scenario Integration Tests', () => {
  describe('Face-off Combat', () => {
    it('should run face-off combat scenario', () => {
      const runner = new ScenarioRunner(new ManualClock());
      const scenario = faceOffCombat as Scenario;

      const assertions: Assertion[] = [
        {
          tick: 0,
          description: 'Both players start at correct positions',
          check: (sim) => {
            const p1 = sim.getPlayerState('player1')!;
            const p2 = sim.getPlayerState('player2')!;
            return (
              p1.position.x === 100 &&
              p1.position.y === 500 &&
              p2.position.x === 200 &&
              p2.position.y === 500
            );
          },
        },
        {
          tick: 99,
          description: 'Both players are still alive at end (no shooting implemented yet)',
          check: (sim) => {
            const p1 = sim.getPlayerState('player1')!;
            const p2 = sim.getPlayerState('player2')!;
            return p1.isAlive && p2.isAlive;
          },
        },
      ];

      const result = runner.run(scenario, assertions);

      expect(result.scenarioName).toBe('face-off-combat');
      expect(result.passed).toBe(true);
      expect(result.assertions.every((a) => a.passed)).toBe(true);
    });
  });

  describe('Player Movement Corners', () => {
    it('should move player through all corners', () => {
      const runner = new ScenarioRunner(new ManualClock());
      const scenario = playerMovementCorners as Scenario;

      const assertions: Assertion[] = [
        {
          tick: 119,
          description: 'Player moved away from center after first input',
          check: (sim) => {
            const p1 = sim.getPlayerState('player1')!;
            // Should have moved from center (960, 540)
            const movedFromCenter =
              Math.abs(p1.position.x - 960) > 10 || Math.abs(p1.position.y - 540) > 10;
            return movedFromCenter;
          },
        },
        {
          tick: 300,
          description: 'Player still moving after direction changes',
          check: (sim) => {
            const p1 = sim.getPlayerState('player1')!;
            // Check that player has non-zero velocity
            return Math.abs(p1.velocity.x) > 1 || Math.abs(p1.velocity.y) > 1;
          },
        },
        {
          tick: 599,
          description: 'Player stopped moving after last input',
          check: (sim) => {
            const p1 = sim.getPlayerState('player1')!;
            // Velocity should be very close to zero after deceleration
            return Math.abs(p1.velocity.x) < 100 && Math.abs(p1.velocity.y) < 100;
          },
        },
      ];

      const result = runner.run(scenario, assertions);

      expect(result.scenarioName).toBe('player-movement-corners');
      expect(result.passed).toBe(true);
      expect(result.assertions.every((a) => a.passed)).toBe(true);
    });

    it('should keep player within arena bounds', () => {
      const runner = new ScenarioRunner(new ManualClock());
      const scenario = playerMovementCorners as Scenario;

      const ARENA_WIDTH = 1920;
      const ARENA_HEIGHT = 1080;

      const assertions: Assertion[] = [];

      // Check bounds every 60 ticks
      for (let tick = 0; tick < scenario.duration; tick += 60) {
        assertions.push({
          tick,
          description: `Player within bounds at tick ${tick}`,
          check: (sim) => {
            const p1 = sim.getPlayerState('player1')!;
            return (
              p1.position.x >= 0 &&
              p1.position.x <= ARENA_WIDTH &&
              p1.position.y >= 0 &&
              p1.position.y <= ARENA_HEIGHT
            );
          },
        });
      }

      const result = runner.run(scenario, assertions);

      expect(result.passed).toBe(true);
      expect(result.assertions.every((a) => a.passed)).toBe(true);
    });
  });

  describe('Weapon Pickup Race', () => {
    it('should have both players move toward center', () => {
      const runner = new ScenarioRunner(new ManualClock());
      const scenario = weaponPickupRace as Scenario;

      const assertions: Assertion[] = [
        {
          tick: 0,
          description: 'Players start equidistant from center',
          check: (sim) => {
            const p1 = sim.getPlayerState('player1')!;
            const p2 = sim.getPlayerState('player2')!;

            const centerX = 960;
            const dist1 = Math.abs(p1.position.x - centerX);
            const dist2 = Math.abs(p2.position.x - centerX);

            // Both should be 200 pixels from center
            return Math.abs(dist1 - dist2) < 1;
          },
        },
        {
          tick: 30,
          description: 'Player 1 moving right toward center',
          check: (sim) => {
            const p1 = sim.getPlayerState('player1')!;
            return p1.position.x > 760 && p1.velocity.x > 0;
          },
        },
        {
          tick: 30,
          description: 'Player 2 moving left toward center',
          check: (sim) => {
            const p2 = sim.getPlayerState('player2')!;
            return p2.position.x < 1160 && p2.velocity.x < 0;
          },
        },
        {
          tick: 59,
          description: 'Players have moved closer to center',
          check: (sim) => {
            const p1 = sim.getPlayerState('player1')!;
            const p2 = sim.getPlayerState('player2')!;

            const centerX = 960;
            const dist1 = Math.abs(p1.position.x - centerX);
            const dist2 = Math.abs(p2.position.x - centerX);

            // Should be closer than starting distance of 200
            return dist1 < 200 && dist2 < 200;
          },
        },
        {
          tick: 119,
          description: 'Players have stopped (velocity near zero)',
          check: (sim) => {
            const p1 = sim.getPlayerState('player1')!;
            const p2 = sim.getPlayerState('player2')!;

            // Velocity should be very close to zero after deceleration
            return (
              Math.abs(p1.velocity.x) < 10 &&
              Math.abs(p1.velocity.y) < 10 &&
              Math.abs(p2.velocity.x) < 10 &&
              Math.abs(p2.velocity.y) < 10
            );
          },
        },
      ];

      const result = runner.run(scenario, assertions);

      expect(result.scenarioName).toBe('weapon-pickup-race');
      expect(result.passed).toBe(true);
      expect(result.assertions.every((a) => a.passed)).toBe(true);
    });
  });

  describe('Scenario Runner fromJSON', () => {
    it('should load and run scenario from JSON string', () => {
      const runner = new ScenarioRunner(new ManualClock());

      const scenarioJSON = JSON.stringify(faceOffCombat);

      const assertions: Assertion[] = [
        {
          tick: 0,
          description: 'Players exist',
          check: (sim) => {
            const p1 = sim.getPlayerState('player1');
            const p2 = sim.getPlayerState('player2');
            return p1 !== undefined && p2 !== undefined;
          },
        },
      ];

      const result = runner.runFromJSON(scenarioJSON, assertions);

      expect(result.scenarioName).toBe('face-off-combat');
      expect(result.passed).toBe(true);
    });
  });
});
