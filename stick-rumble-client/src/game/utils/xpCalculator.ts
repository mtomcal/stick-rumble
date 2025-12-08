/**
 * XP Breakdown for match end screen
 */
export interface XPBreakdown {
  base: number;
  kills: number;
  win: number;
  topThree: number;
}

/**
 * XP Calculation result
 */
export interface XPResult {
  total: number;
  breakdown: XPBreakdown;
}

/**
 * Calculate XP earned from a match
 *
 * Formula: (kills * 100) + (win ? 100 : 0) + (topThree ? 50 : 0) + 50
 *
 * @param kills - Number of kills (negative values treated as 0, fractional values floored)
 * @param isWinner - Whether the player won the match
 * @param isTopThree - Whether the player placed in top 3
 * @returns XP result with total and breakdown
 */
export function calculateXP(kills: number, isWinner: boolean, isTopThree: boolean): XPResult {
  // Ensure kills is a non-negative integer
  const validKills = Math.max(0, Math.floor(kills));

  const breakdown: XPBreakdown = {
    base: 50,
    kills: validKills * 100,
    win: isWinner ? 100 : 0,
    topThree: isTopThree ? 50 : 0,
  };

  const total = breakdown.base + breakdown.kills + breakdown.win + breakdown.topThree;

  return {
    total,
    breakdown,
  };
}
