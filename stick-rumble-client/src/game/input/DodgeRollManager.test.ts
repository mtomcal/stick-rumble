import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DodgeRollManager } from './DodgeRollManager';

describe('DodgeRollManager', () => {
  let manager: DodgeRollManager;

  beforeEach(() => {
    manager = new DodgeRollManager();
    // Reset time mocks
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should not be rolling initially', () => {
      expect(manager.isRolling()).toBe(false);
    });

    it('should not be in invincibility frames initially', () => {
      expect(manager.isInInvincibilityFrames()).toBe(false);
    });

    it('should allow dodge roll initially', () => {
      expect(manager.canDodgeRoll()).toBe(true);
    });

    it('should have cooldown progress at 1.0 initially', () => {
      expect(manager.getCooldownProgress()).toBe(1.0);
    });
  });

  describe('startRoll()', () => {
    it('should set isRolling to true', () => {
      manager.startRoll();
      expect(manager.isRolling()).toBe(true);
    });

    it('should set rollStartTime to current time', () => {
      const now = Date.now();
      manager.startRoll();
      // Allow small time difference due to execution time
      expect(manager.getRollStartTime()).toBeGreaterThanOrEqual(now - 10);
      expect(manager.getRollStartTime()).toBeLessThanOrEqual(now + 10);
    });

    it('should set lastRollTime to current time', () => {
      const now = Date.now();
      manager.startRoll();
      expect(manager.getLastRollTime()).toBeGreaterThanOrEqual(now - 10);
      expect(manager.getLastRollTime()).toBeLessThanOrEqual(now + 10);
    });

    it('should enable invincibility frames', () => {
      manager.startRoll();
      expect(manager.isInInvincibilityFrames()).toBe(true);
    });
  });

  describe('endRoll()', () => {
    it('should set isRolling to false', () => {
      manager.startRoll();
      manager.endRoll();
      expect(manager.isRolling()).toBe(false);
    });

    it('should disable invincibility frames', () => {
      manager.startRoll();
      manager.endRoll();
      expect(manager.isInInvincibilityFrames()).toBe(false);
    });

    it('should preserve lastRollTime for cooldown tracking', () => {
      manager.startRoll();
      const lastRollTime = manager.getLastRollTime();
      manager.endRoll();
      expect(manager.getLastRollTime()).toBe(lastRollTime);
    });
  });

  describe('canDodgeRoll()', () => {
    it('should return false when already rolling', () => {
      manager.startRoll();
      expect(manager.canDodgeRoll()).toBe(false);
    });

    it('should return false when cooldown is active', () => {
      // Start and end a roll
      manager.startRoll();
      manager.endRoll();

      // Should be on cooldown immediately after
      expect(manager.canDodgeRoll()).toBe(false);
    });

    it('should return true after cooldown expires (3 seconds)', () => {
      vi.useFakeTimers();
      const startTime = Date.now();
      vi.setSystemTime(startTime);

      manager.startRoll();
      manager.endRoll();

      // Advance time by 3 seconds
      vi.setSystemTime(startTime + 3000);
      manager.update();

      expect(manager.canDodgeRoll()).toBe(true);

      vi.useRealTimers();
    });

    it('should return false at 2.9 seconds after roll (cooldown not expired)', () => {
      vi.useFakeTimers();
      const startTime = Date.now();
      vi.setSystemTime(startTime);

      manager.startRoll();
      manager.endRoll();

      // Advance time by 2.9 seconds
      vi.setSystemTime(startTime + 2900);
      manager.update();

      expect(manager.canDodgeRoll()).toBe(false);

      vi.useRealTimers();
    });
  });

  describe('getCooldownProgress()', () => {
    it('should return 0.0 immediately after roll starts', () => {
      vi.useFakeTimers();
      const startTime = Date.now();
      vi.setSystemTime(startTime);

      manager.startRoll();
      manager.endRoll();
      expect(manager.getCooldownProgress()).toBe(0.0);

      vi.useRealTimers();
    });

    it('should return 0.5 at 1.5 seconds after roll', () => {
      vi.useFakeTimers();
      const startTime = Date.now();
      vi.setSystemTime(startTime);

      manager.startRoll();
      manager.endRoll();

      // Advance time by 1.5 seconds
      vi.setSystemTime(startTime + 1500);
      manager.update();

      expect(manager.getCooldownProgress()).toBeCloseTo(0.5, 2);

      vi.useRealTimers();
    });

    it('should return 1.0 at 3 seconds after roll (cooldown complete)', () => {
      vi.useFakeTimers();
      const startTime = Date.now();
      vi.setSystemTime(startTime);

      manager.startRoll();
      manager.endRoll();

      // Advance time by 3 seconds
      vi.setSystemTime(startTime + 3000);
      manager.update();

      expect(manager.getCooldownProgress()).toBe(1.0);

      vi.useRealTimers();
    });

    it('should never exceed 1.0 after cooldown expires', () => {
      vi.useFakeTimers();
      const startTime = Date.now();
      vi.setSystemTime(startTime);

      manager.startRoll();
      manager.endRoll();

      // Advance time by 5 seconds (well past cooldown)
      vi.setSystemTime(startTime + 5000);
      manager.update();

      expect(manager.getCooldownProgress()).toBe(1.0);

      vi.useRealTimers();
    });
  });

  describe('isInInvincibilityFrames()', () => {
    it('should return true during first 0.2 seconds of roll', () => {
      vi.useFakeTimers();
      const startTime = Date.now();
      vi.setSystemTime(startTime);

      manager.startRoll();

      // Test at 0ms
      expect(manager.isInInvincibilityFrames()).toBe(true);

      // Test at 100ms
      vi.setSystemTime(startTime + 100);
      manager.update();
      expect(manager.isInInvincibilityFrames()).toBe(true);

      // Test at 199ms
      vi.setSystemTime(startTime + 199);
      manager.update();
      expect(manager.isInInvincibilityFrames()).toBe(true);

      vi.useRealTimers();
    });

    it('should return false after 0.2 seconds of roll', () => {
      vi.useFakeTimers();
      const startTime = Date.now();
      vi.setSystemTime(startTime);

      manager.startRoll();

      // Test at 200ms (exactly at threshold)
      vi.setSystemTime(startTime + 200);
      manager.update();
      expect(manager.isInInvincibilityFrames()).toBe(false);

      // Test at 300ms
      vi.setSystemTime(startTime + 300);
      manager.update();
      expect(manager.isInInvincibilityFrames()).toBe(false);

      vi.useRealTimers();
    });

    it('should return false when not rolling', () => {
      expect(manager.isInInvincibilityFrames()).toBe(false);
    });

    it('should return false after roll ends', () => {
      manager.startRoll();
      manager.endRoll();
      expect(manager.isInInvincibilityFrames()).toBe(false);
    });
  });

  describe('update()', () => {
    it('should update cooldown progress over time', () => {
      vi.useFakeTimers();
      const startTime = Date.now();
      vi.setSystemTime(startTime);

      manager.startRoll();
      manager.endRoll();

      // Initial progress should be 0
      expect(manager.getCooldownProgress()).toBe(0.0);

      // Advance time and update
      vi.setSystemTime(startTime + 1000);
      manager.update();
      expect(manager.getCooldownProgress()).toBeCloseTo(0.333, 2);

      vi.setSystemTime(startTime + 2000);
      manager.update();
      expect(manager.getCooldownProgress()).toBeCloseTo(0.666, 2);

      vi.setSystemTime(startTime + 3000);
      manager.update();
      expect(manager.getCooldownProgress()).toBe(1.0);

      vi.useRealTimers();
    });

    it('should handle invincibility frame expiration', () => {
      vi.useFakeTimers();
      const startTime = Date.now();
      vi.setSystemTime(startTime);

      manager.startRoll();

      // Should have iframes
      expect(manager.isInInvincibilityFrames()).toBe(true);

      // Advance past iframe duration
      vi.setSystemTime(startTime + 201);
      manager.update();

      // Should no longer have iframes
      expect(manager.isInInvincibilityFrames()).toBe(false);

      vi.useRealTimers();
    });
  });

  describe('Getter Methods', () => {
    it('should expose getRollStartTime()', () => {
      const now = Date.now();
      manager.startRoll();
      expect(manager.getRollStartTime()).toBeGreaterThanOrEqual(now - 10);
    });

    it('should expose getLastRollTime()', () => {
      const now = Date.now();
      manager.startRoll();
      expect(manager.getLastRollTime()).toBeGreaterThanOrEqual(now - 10);
    });

    it('should return 0 for rollStartTime when not rolling', () => {
      expect(manager.getRollStartTime()).toBe(0);
    });

    it('should return 0 for lastRollTime when no roll has occurred', () => {
      expect(manager.getLastRollTime()).toBe(0);
    });
  });

  describe('Multiple Roll Cycles', () => {
    it('should handle multiple roll cycles correctly', () => {
      vi.useFakeTimers();
      let currentTime = Date.now();
      vi.setSystemTime(currentTime);

      // First roll
      manager.startRoll();
      expect(manager.isRolling()).toBe(true);
      manager.endRoll();
      expect(manager.isRolling()).toBe(false);

      // Wait for cooldown
      currentTime += 3000;
      vi.setSystemTime(currentTime);
      manager.update();
      expect(manager.canDodgeRoll()).toBe(true);

      // Second roll
      manager.startRoll();
      expect(manager.isRolling()).toBe(true);
      expect(manager.isInInvincibilityFrames()).toBe(true);
      manager.endRoll();

      // Wait for cooldown again
      currentTime += 3000;
      vi.setSystemTime(currentTime);
      manager.update();
      expect(manager.canDodgeRoll()).toBe(true);

      vi.useRealTimers();
    });
  });
});
