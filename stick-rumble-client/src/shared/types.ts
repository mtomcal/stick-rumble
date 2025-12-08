/**
 * Shared types for the client application
 */

/**
 * Player score data for match end
 */
export interface PlayerScore {
  playerId: string;
  kills: number;
  deaths: number;
  xp: number;
}

/**
 * Match end data from server
 */
export interface MatchEndData {
  winners: string[];
  finalScores: PlayerScore[];
  reason: string;
}
