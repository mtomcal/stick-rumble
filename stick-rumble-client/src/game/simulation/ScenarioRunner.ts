/**
 * ScenarioRunner - Runs deterministic game scenarios for testing
 * Replays recorded inputs and validates game behavior
 */

import { GameSimulation } from './GameSimulation';
import type { Clock } from '../utils/Clock';
import { ManualClock } from '../utils/Clock';
import type {
  Scenario,
  Assertion,
  AssertionResult,
  ScenarioResult,
} from './types';

/**
 * Time per tick in milliseconds (60 FPS = 16.67ms per frame)
 */
const TICK_DURATION_MS = 16.67;

/**
 * ScenarioRunner executes scenarios with deterministic timing
 */
export class ScenarioRunner {
  private clock: Clock;

  constructor(clock?: Clock) {
    // Default to ManualClock for deterministic replay
    this.clock = clock ?? new ManualClock();
  }

  /**
   * Run a scenario with assertions
   * @param scenario The scenario to run
   * @param assertions Assertions to check during execution
   * @returns Results of the scenario execution
   */
  run(scenario: Scenario, assertions: Assertion[]): ScenarioResult {
    const startTime = Date.now();

    // Create simulation with the clock
    const sim = new GameSimulation(this.clock);

    // Setup players
    for (const player of scenario.players) {
      sim.addPlayer(player.id, player.startPosition);
    }

    // Group inputs by tick for efficient lookup
    const inputsByTick = new Map<number, typeof scenario.inputs>();
    for (const input of scenario.inputs) {
      const tickInputs = inputsByTick.get(input.tick) ?? [];
      tickInputs.push(input);
      inputsByTick.set(input.tick, tickInputs);
    }

    // Group assertions by tick
    const assertionsByTick = new Map<number, Assertion[]>();
    for (const assertion of assertions) {
      const tickAssertions = assertionsByTick.get(assertion.tick) ?? [];
      tickAssertions.push(assertion);
      assertionsByTick.set(assertion.tick, tickAssertions);
    }

    const assertionResults: AssertionResult[] = [];

    // Run simulation
    for (let tick = 0; tick < scenario.duration; tick++) {
      // Apply inputs for this tick
      const frameInputs = inputsByTick.get(tick);
      if (frameInputs) {
        for (const inputFrame of frameInputs) {
          sim.updateInput(inputFrame.playerId, inputFrame.input);
        }
      }

      // Advance simulation
      sim.tick(TICK_DURATION_MS);
      this.clock.advance(TICK_DURATION_MS);

      // Check assertions for this tick
      const tickAssertions = assertionsByTick.get(tick);
      if (tickAssertions) {
        for (const assertion of tickAssertions) {
          const result = this.checkAssertion(assertion, sim, tick);
          assertionResults.push(result);
        }
      }
    }

    const duration = Date.now() - startTime;
    const passed = assertionResults.every((r) => r.passed);

    return {
      scenarioName: scenario.name,
      passed,
      assertions: assertionResults,
      duration,
    };
  }

  /**
   * Run a scenario from JSON string
   * @param json JSON string containing scenario
   * @param assertions Assertions to check
   * @returns Results of the scenario execution
   */
  runFromJSON(json: string, assertions: Assertion[]): ScenarioResult {
    let scenario: Scenario;

    try {
      scenario = JSON.parse(json) as Scenario;
    } catch (error) {
      throw new Error(`Failed to parse scenario JSON: ${error}`);
    }

    return this.run(scenario, assertions);
  }

  /**
   * Check a single assertion
   * @private
   */
  private checkAssertion(
    assertion: Assertion,
    sim: GameSimulation,
    tick: number
  ): AssertionResult {
    try {
      const passed = assertion.check(sim);
      return {
        tick,
        description: assertion.description,
        passed,
      };
    } catch (error) {
      return {
        tick,
        description: assertion.description,
        passed: false,
        error: String(error),
      };
    }
  }
}
