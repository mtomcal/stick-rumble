import { describe, it, expect } from 'vitest';
import { calculateXP } from './xpCalculator';

describe('XP Calculator', () => {
  describe('calculateXP', () => {
    it('should calculate base XP only for 0 kills, no win, not top 3', () => {
      const result = calculateXP(0, false, false);

      expect(result.total).toBe(50);
      expect(result.breakdown).toEqual({
        base: 50,
        kills: 0,
        win: 0,
        topThree: 0,
      });
    });

    it('should calculate XP with kills only', () => {
      const result = calculateXP(5, false, false);

      expect(result.total).toBe(550); // 50 + (5 * 100)
      expect(result.breakdown).toEqual({
        base: 50,
        kills: 500,
        win: 0,
        topThree: 0,
      });
    });

    it('should calculate XP with win bonus only', () => {
      const result = calculateXP(0, true, false);

      expect(result.total).toBe(150); // 50 + 100
      expect(result.breakdown).toEqual({
        base: 50,
        kills: 0,
        win: 100,
        topThree: 0,
      });
    });

    it('should calculate XP with top 3 bonus only', () => {
      const result = calculateXP(0, false, true);

      expect(result.total).toBe(100); // 50 + 50
      expect(result.breakdown).toEqual({
        base: 50,
        kills: 0,
        win: 0,
        topThree: 50,
      });
    });

    it('should calculate XP with all bonuses', () => {
      const result = calculateXP(3, true, true);

      expect(result.total).toBe(500); // 50 + (3 * 100) + 100 + 50
      expect(result.breakdown).toEqual({
        base: 50,
        kills: 300,
        win: 100,
        topThree: 50,
      });
    });

    it('should calculate XP for high kill count', () => {
      const result = calculateXP(10, false, false);

      expect(result.total).toBe(1050); // 50 + (10 * 100)
      expect(result.breakdown).toEqual({
        base: 50,
        kills: 1000,
        win: 0,
        topThree: 0,
      });
    });

    it('should calculate XP with win bonus but not top 3', () => {
      const result = calculateXP(2, true, false);

      expect(result.total).toBe(350); // 50 + (2 * 100) + 100
      expect(result.breakdown).toEqual({
        base: 50,
        kills: 200,
        win: 100,
        topThree: 0,
      });
    });

    it('should calculate XP with top 3 but not win', () => {
      const result = calculateXP(4, false, true);

      expect(result.total).toBe(500); // 50 + (4 * 100) + 50
      expect(result.breakdown).toEqual({
        base: 50,
        kills: 400,
        win: 0,
        topThree: 50,
      });
    });

    it('should handle negative kills as 0', () => {
      const result = calculateXP(-5, false, false);

      expect(result.total).toBe(50);
      expect(result.breakdown).toEqual({
        base: 50,
        kills: 0,
        win: 0,
        topThree: 0,
      });
    });

    it('should handle fractional kills by flooring', () => {
      const result = calculateXP(2.7, false, false);

      expect(result.total).toBe(250); // 50 + (2 * 100)
      expect(result.breakdown).toEqual({
        base: 50,
        kills: 200,
        win: 0,
        topThree: 0,
      });
    });
  });
});
