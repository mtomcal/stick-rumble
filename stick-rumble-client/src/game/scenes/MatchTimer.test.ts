import { describe, it, expect } from 'vitest';

/**
 * Helper function to format seconds as MM:SS
 * This is extracted from GameScene.updateMatchTimer for unit testing
 */
function formatMatchTimer(remainingSeconds: number): string {
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Helper function to get timer color based on remaining time
 */
function getTimerColor(remainingSeconds: number): string {
  if (remainingSeconds < 60) {
    return '#ff0000'; // Red
  } else if (remainingSeconds < 120) {
    return '#ffff00'; // Yellow
  } else {
    return '#ffffff'; // White
  }
}

describe('Match Timer Formatting', () => {
  describe('formatMatchTimer', () => {
    it('formats 420 seconds as 7:00', () => {
      expect(formatMatchTimer(420)).toBe('7:00');
    });

    it('formats 419 seconds as 6:59', () => {
      expect(formatMatchTimer(419)).toBe('6:59');
    });

    it('formats 60 seconds as 1:00', () => {
      expect(formatMatchTimer(60)).toBe('1:00');
    });

    it('formats 59 seconds as 0:59', () => {
      expect(formatMatchTimer(59)).toBe('0:59');
    });

    it('formats 10 seconds as 0:10', () => {
      expect(formatMatchTimer(10)).toBe('0:10');
    });

    it('formats 5 seconds as 0:05', () => {
      expect(formatMatchTimer(5)).toBe('0:05');
    });

    it('formats 0 seconds as 0:00', () => {
      expect(formatMatchTimer(0)).toBe('0:00');
    });

    it('formats 125 seconds as 2:05', () => {
      expect(formatMatchTimer(125)).toBe('2:05');
    });

    it('formats 200 seconds as 3:20', () => {
      expect(formatMatchTimer(200)).toBe('3:20');
    });

    it('pads single-digit seconds with leading zero', () => {
      expect(formatMatchTimer(305)).toBe('5:05');
      expect(formatMatchTimer(61)).toBe('1:01');
    });
  });

  describe('getTimerColor', () => {
    it('returns white for time >= 120 seconds', () => {
      expect(getTimerColor(420)).toBe('#ffffff');
      expect(getTimerColor(120)).toBe('#ffffff');
      expect(getTimerColor(200)).toBe('#ffffff');
    });

    it('returns yellow for 60 <= time < 120 seconds', () => {
      expect(getTimerColor(119)).toBe('#ffff00');
      expect(getTimerColor(60)).toBe('#ffff00');
      expect(getTimerColor(90)).toBe('#ffff00');
    });

    it('returns red for time < 60 seconds', () => {
      expect(getTimerColor(59)).toBe('#ff0000');
      expect(getTimerColor(30)).toBe('#ff0000');
      expect(getTimerColor(0)).toBe('#ff0000');
    });
  });
});
