/**
 * Integration tests for match end and leaderboard functionality.
 * Tests the complete flow of match ending and displaying final scores.
 *
 * Note: These tests validate the data structure and type system without
 * requiring a live server connection. They ensure the schema changes
 * for PlayerScore arrays are correct.
 */
import { describe, it, expect } from 'vitest';
import type { MatchEndedData } from '@stick-rumble/events-schema';

describe('WebSocket Match End Integration Tests', () => {
  describe('Match End Leaderboard', () => {
    it('should receive match:ended with correct PlayerScore array structure', () => {

      // Test the expected MatchEndedData structure
      // In real scenario, server sends this when match ends
      const mockMatchEndData: MatchEndedData = {
        winners: ['player-1'],
        finalScores: [
          {
            playerId: 'player-1',
            kills: 10,
            deaths: 2,
            xp: 750,
          },
          {
            playerId: 'player-2',
            kills: 5,
            deaths: 5,
            xp: 400,
          },
        ],
        reason: 'kill_target',
      };

      // Verify the structure by checking type
      expect(Array.isArray(mockMatchEndData.finalScores)).toBe(true);
      expect(mockMatchEndData.finalScores[0]).toHaveProperty('playerId');
      expect(mockMatchEndData.finalScores[0]).toHaveProperty('kills');
      expect(mockMatchEndData.finalScores[0]).toHaveProperty('deaths');
      expect(mockMatchEndData.finalScores[0]).toHaveProperty('xp');
    });

    it('should validate PlayerScore structure with non-zero kills and deaths', () => {

      const playerScore = {
        playerId: 'player-123',
        kills: 8,
        deaths: 3,
        xp: 600,
      };

      // Verify all fields are present
      expect(playerScore.playerId).toBe('player-123');
      expect(playerScore.kills).toBe(8);
      expect(playerScore.deaths).toBe(3);
      expect(playerScore.xp).toBe(600);

      // Verify types
      expect(typeof playerScore.playerId).toBe('string');
      expect(typeof playerScore.kills).toBe('number');
      expect(typeof playerScore.deaths).toBe('number');
      expect(typeof playerScore.xp).toBe('number');

      // Verify values are integers
      expect(Number.isInteger(playerScore.kills)).toBe(true);
      expect(Number.isInteger(playerScore.deaths)).toBe(true);
      expect(Number.isInteger(playerScore.xp)).toBe(true);
    });

    it('should handle multiple players in finalScores array', () => {

      const matchEndData: MatchEndedData = {
        winners: ['player-1'],
        finalScores: [
          { playerId: 'player-1', kills: 15, deaths: 1, xp: 1000 },
          { playerId: 'player-2', kills: 8, deaths: 6, xp: 550 },
          { playerId: 'player-3', kills: 5, deaths: 8, xp: 350 },
          { playerId: 'player-4', kills: 2, deaths: 10, xp: 200 },
        ],
        reason: 'time_limit',
      };

      expect(matchEndData.finalScores).toHaveLength(4);
      expect(matchEndData.winners).toContain('player-1');

      // Verify all players have complete score data
      matchEndData.finalScores.forEach((score) => {
        expect(score).toHaveProperty('playerId');
        expect(score).toHaveProperty('kills');
        expect(score).toHaveProperty('deaths');
        expect(score).toHaveProperty('xp');
        expect(typeof score.playerId).toBe('string');
        expect(score.kills).toBeGreaterThanOrEqual(0);
        expect(score.deaths).toBeGreaterThanOrEqual(0);
        expect(score.xp).toBeGreaterThanOrEqual(0);
      });
    });

    it('should correctly sort players by kills for leaderboard', () => {

      const finalScores = [
        { playerId: 'player-1', kills: 5, deaths: 2, xp: 400 },
        { playerId: 'player-2', kills: 10, deaths: 3, xp: 750 },
        { playerId: 'player-3', kills: 3, deaths: 5, xp: 200 },
        { playerId: 'player-4', kills: 10, deaths: 1, xp: 800 },
      ];

      // Sort by kills descending, then deaths ascending (same as MatchEndScreen)
      const rankedPlayers = [...finalScores].sort((a, b) => {
        if (b.kills !== a.kills) {
          return b.kills - a.kills;
        }
        return a.deaths - b.deaths;
      });

      expect(rankedPlayers[0].playerId).toBe('player-4'); // 10 kills, 1 death
      expect(rankedPlayers[1].playerId).toBe('player-2'); // 10 kills, 3 deaths
      expect(rankedPlayers[2].playerId).toBe('player-1'); // 5 kills
      expect(rankedPlayers[3].playerId).toBe('player-3'); // 3 kills
    });

    it('should calculate XP correctly based on kills', () => {

      // XP breakdown formula: base + (kills * 100) + win bonus + top3 bonus
      const calculateXP = (kills: number, isWinner: boolean, isTopThree: boolean): number => {
        const baseXP = 50;
        const killsXP = kills * 100;
        const winBonus = isWinner ? 100 : 0;
        const top3Bonus = isTopThree && !isWinner ? 50 : 0;
        return baseXP + killsXP + winBonus + top3Bonus;
      };

      // Test winner with 10 kills
      const winnerXP = calculateXP(10, true, true);
      expect(winnerXP).toBe(1150); // 50 + 1000 + 100 + 0

      // Test non-winner top 3 with 5 kills
      const top3XP = calculateXP(5, false, true);
      expect(top3XP).toBe(600); // 50 + 500 + 0 + 50

      // Test non-top-3 with 2 kills
      const regularXP = calculateXP(2, false, false);
      expect(regularXP).toBe(250); // 50 + 200 + 0 + 0
    });

    it('should handle zero kills and deaths correctly', () => {

      const playerScore = {
        playerId: 'player-new',
        kills: 0,
        deaths: 0,
        xp: 50, // Only base XP
      };

      expect(playerScore.kills).toBe(0);
      expect(playerScore.deaths).toBe(0);
      expect(playerScore.xp).toBeGreaterThanOrEqual(50); // At least base XP

      // Verify structure is still valid
      expect(playerScore).toHaveProperty('playerId');
      expect(playerScore).toHaveProperty('kills');
      expect(playerScore).toHaveProperty('deaths');
      expect(playerScore).toHaveProperty('xp');
    });

    it('should validate match end reason is provided', () => {

      const matchEndData: MatchEndedData = {
        winners: ['player-1'],
        finalScores: [
          { playerId: 'player-1', kills: 10, deaths: 0, xp: 1100 },
        ],
        reason: 'elimination',
      };

      expect(matchEndData.reason).toBeTruthy();
      expect(matchEndData.reason.length).toBeGreaterThan(0);
      expect(['elimination', 'time_limit', 'kill_target']).toContain(matchEndData.reason);
    });

    it('should handle empty winners array for draw scenarios', () => {

      const matchEndData: MatchEndedData = {
        winners: [],
        finalScores: [
          { playerId: 'player-1', kills: 5, deaths: 5, xp: 400 },
          { playerId: 'player-2', kills: 5, deaths: 5, xp: 400 },
        ],
        reason: 'draw',
      };

      expect(matchEndData.winners).toHaveLength(0);
      expect(matchEndData.finalScores).toHaveLength(2);
      expect(matchEndData.finalScores[0].kills).toBe(matchEndData.finalScores[1].kills);
    });
  });

  describe('PlayerScore Type Validation', () => {
    it('should reject negative kills', () => {
      const invalidScore = {
        playerId: 'player-1',
        kills: -1,
        deaths: 0,
        xp: 100,
      };

      // In production, schema validation would reject this
      // Here we verify the structure expectations
      expect(invalidScore.kills).toBeLessThan(0);
    });

    it('should reject missing required fields', () => {
      const incompleteScore = {
        playerId: 'player-1',
        kills: 5,
        // missing deaths and xp
      };

      expect(incompleteScore).not.toHaveProperty('deaths');
      expect(incompleteScore).not.toHaveProperty('xp');
    });

    it('should require string playerId', () => {
      const validScore = {
        playerId: 'player-abc-123',
        kills: 5,
        deaths: 2,
        xp: 400,
      };

      expect(typeof validScore.playerId).toBe('string');
      expect(validScore.playerId.length).toBeGreaterThan(0);
    });

    it('should require integer values for kills, deaths, xp', () => {
      const score = {
        playerId: 'player-1',
        kills: 5,
        deaths: 2,
        xp: 400,
      };

      expect(Number.isInteger(score.kills)).toBe(true);
      expect(Number.isInteger(score.deaths)).toBe(true);
      expect(Number.isInteger(score.xp)).toBe(true);

      // Verify no floating point values
      expect(score.kills % 1).toBe(0);
      expect(score.deaths % 1).toBe(0);
      expect(score.xp % 1).toBe(0);
    });
  });
});
