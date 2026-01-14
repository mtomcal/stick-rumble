/**
 * Clock provides time-related operations for game logic.
 * This interface enables dependency injection for testing,
 * allowing tests to use a manual clock that can be advanced
 * instantly instead of waiting for real time to pass.
 *
 * Mirrors the server-side Clock pattern from stick-rumble-server/internal/game/clock.go
 */
export interface Clock {
  /**
   * Returns the current time in milliseconds since epoch.
   * For RealClock, this is Date.now().
   * For ManualClock, this is the manually-set time.
   */
  now(): number;

  /**
   * Advances the clock by the given duration in milliseconds.
   * For RealClock, this is a no-op (time advances naturally).
   * For ManualClock, this instantly moves time forward (or backward if negative).
   */
  advance(ms: number): void;
}

/**
 * RealClock implements Clock using the actual system time.
 * This is the production implementation used in real gameplay.
 */
export class RealClock implements Clock {
  /**
   * Returns the current system time in milliseconds.
   */
  now(): number {
    return Date.now();
  }

  /**
   * No-op for RealClock. Time advances naturally.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  advance(_ms: number): void {
    // No-op: real time cannot be manually advanced
  }
}

/**
 * ManualClock implements Clock with manually controllable time.
 * This is used in tests to advance time instantly without waiting.
 *
 * Example usage:
 * ```typescript
 * const clock = new ManualClock();
 * console.log(clock.now()); // 0
 * clock.advance(1000);
 * console.log(clock.now()); // 1000
 *
 * // Simulate 5 seconds at 60 FPS instantly
 * for (let i = 0; i < 300; i++) {
 *   clock.advance(16.67);
 *   // Run game logic here
 * }
 * ```
 */
export class ManualClock implements Clock {
  private currentTime: number;

  /**
   * Creates a new ManualClock.
   * @param startTime Initial time in milliseconds. Defaults to 0.
   */
  constructor(startTime: number = 0) {
    this.currentTime = startTime;
  }

  /**
   * Returns the current manual time.
   */
  now(): number {
    return this.currentTime;
  }

  /**
   * Advances the manual clock by the given duration.
   * Can be negative to move time backward.
   * @param ms Duration to advance in milliseconds
   */
  advance(ms: number): void {
    this.currentTime += ms;
  }

  /**
   * Resets the clock to a specific time.
   * @param time Time in milliseconds. Defaults to 0.
   */
  reset(time: number = 0): void {
    this.currentTime = time;
  }
}
