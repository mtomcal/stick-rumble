import { describe, it, expect, beforeEach } from 'vitest';
import { RealClock, ManualClock } from './Clock';

describe('RealClock', () => {
  let clock: RealClock;

  beforeEach(() => {
    clock = new RealClock();
  });

  it('should return current time in milliseconds', () => {
    const before = Date.now();
    const clockTime = clock.now();
    const after = Date.now();

    expect(clockTime).toBeGreaterThanOrEqual(before);
    expect(clockTime).toBeLessThanOrEqual(after);
  });

  it('should return time close to Date.now()', () => {
    const expected = Date.now();
    const actual = clock.now();

    // Allow 10ms tolerance for execution time
    expect(Math.abs(actual - expected)).toBeLessThan(10);
  });

  it('should advance in real time', async () => {
    const start = clock.now();
    await new Promise(resolve => setTimeout(resolve, 50));
    const end = clock.now();

    expect(end - start).toBeGreaterThanOrEqual(40); // Allow some margin
    expect(end - start).toBeLessThan(100);
  });

  it('advance() should be a no-op', () => {
    const before = clock.now();
    clock.advance(1000);
    const after = clock.now();

    // Time should have advanced naturally, not by 1000ms
    expect(after - before).toBeLessThan(100);
  });
});

describe('ManualClock', () => {
  let clock: ManualClock;

  beforeEach(() => {
    clock = new ManualClock();
  });

  it('should start at time 0 by default', () => {
    expect(clock.now()).toBe(0);
  });

  it('should start at provided initial time', () => {
    const startTime = 12345;
    const clockWithStart = new ManualClock(startTime);

    expect(clockWithStart.now()).toBe(startTime);
  });

  it('should not advance automatically', async () => {
    const start = clock.now();
    await new Promise(resolve => setTimeout(resolve, 50));
    const end = clock.now();

    expect(end).toBe(start);
    expect(end).toBe(0);
  });

  it('should advance by specified amount', () => {
    expect(clock.now()).toBe(0);

    clock.advance(100);
    expect(clock.now()).toBe(100);

    clock.advance(50);
    expect(clock.now()).toBe(150);

    clock.advance(1000);
    expect(clock.now()).toBe(1150);
  });

  it('should handle negative advance (go backward)', () => {
    clock.advance(1000);
    expect(clock.now()).toBe(1000);

    clock.advance(-500);
    expect(clock.now()).toBe(500);
  });

  it('should handle zero advance', () => {
    clock.advance(100);
    const before = clock.now();

    clock.advance(0);
    expect(clock.now()).toBe(before);
  });

  it('should support large time advances', () => {
    clock.advance(1000000);
    expect(clock.now()).toBe(1000000);
  });

  it('should support fractional milliseconds', () => {
    clock.advance(16.67);
    expect(clock.now()).toBeCloseTo(16.67, 2);

    clock.advance(16.67);
    expect(clock.now()).toBeCloseTo(33.34, 2);
  });

  it('should allow multiple sequential advances', () => {
    const advances = [10, 20, 30, 40, 50];
    let expectedTotal = 0;

    advances.forEach(ms => {
      clock.advance(ms);
      expectedTotal += ms;
      expect(clock.now()).toBe(expectedTotal);
    });

    expect(clock.now()).toBe(150);
  });

  it('should be independent from real time', async () => {
    clock.advance(5000);
    const timeAfterAdvance = clock.now();

    // Wait in real time
    await new Promise(resolve => setTimeout(resolve, 50));

    // Manual clock should not have changed
    expect(clock.now()).toBe(timeAfterAdvance);
    expect(clock.now()).toBe(5000);
  });

  it('should support instant simulation of game seconds', () => {
    // Simulate 10 seconds of game time instantly
    const tickRate = 1000 / 60; // 60 FPS
    const numTicks = 60 * 10; // 10 seconds

    for (let i = 0; i < numTicks; i++) {
      clock.advance(tickRate);
    }

    expect(clock.now()).toBeCloseTo(10000, 0);
  });
});

describe('Clock interface compliance', () => {
  it('RealClock should implement Clock interface', () => {
    const clock: { now: () => number; advance: (ms: number) => void } = new RealClock();

    expect(typeof clock.now).toBe('function');
    expect(typeof clock.advance).toBe('function');
  });

  it('ManualClock should implement Clock interface', () => {
    const clock: { now: () => number; advance: (ms: number) => void } = new ManualClock();

    expect(typeof clock.now).toBe('function');
    expect(typeof clock.advance).toBe('function');
  });

  it('should be usable polymorphically', () => {
    const clocks: Array<{ now: () => number; advance: (ms: number) => void }> = [
      new RealClock(),
      new ManualClock(),
      new ManualClock(5000),
    ];

    clocks.forEach(clock => {
      const time = clock.now();
      expect(typeof time).toBe('number');

      clock.advance(100);
      // No assertion on value since RealClock is a no-op
    });
  });
});
