import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MatchEndScreen } from './MatchEndScreen';
import type { MatchEndData } from '../../shared/types';

describe('MatchEndScreen', () => {
  const mockOnClose = vi.fn();

  const mockMatchData: MatchEndData = {
    winners: ['player-1'],
    finalScores: [
      { playerId: 'player-1', kills: 5, deaths: 2, xp: 150 },
      { playerId: 'player-2', kills: 3, deaths: 4, xp: 100 },
      { playerId: 'player-3', kills: 1, deaths: 5, xp: 75 },
    ],
    reason: 'time_expired',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Rendering', () => {
    it('should render match end screen with winner name', () => {
      render(
        <MatchEndScreen
          matchData={mockMatchData}
          localPlayerId="player-2"
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText(/Winner:/i)).toBeInTheDocument();
      expect(screen.getByText(/Winner:/i)).toHaveTextContent('player-1');
    });

    it('should render multiple winners when there is a tie', () => {
      const tieData: MatchEndData = {
        ...mockMatchData,
        winners: ['player-1', 'player-2'],
      };

      render(
        <MatchEndScreen
          matchData={tieData}
          localPlayerId="player-3"
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText(/Winners:/i)).toBeInTheDocument();
      expect(screen.getByText(/Winners:/i)).toHaveTextContent('player-1, player-2');
    });

    it('should render final scores table with all players', () => {
      render(
        <MatchEndScreen
          matchData={mockMatchData}
          localPlayerId="player-2"
          onClose={mockOnClose}
        />
      );

      // Check table headers
      expect(screen.getByText('Rank')).toBeInTheDocument();
      expect(screen.getByText('Player')).toBeInTheDocument();
      expect(screen.getByText('Kills')).toBeInTheDocument();
      expect(screen.getByText('Deaths')).toBeInTheDocument();

      // Check player data - use getAllByText since players appear in table
      const rows = screen.getAllByRole('row');
      expect(rows.length).toBeGreaterThan(3); // header + 3 players
    });

    it('should rank players by kills descending', () => {
      render(
        <MatchEndScreen
          matchData={mockMatchData}
          localPlayerId="player-2"
          onClose={mockOnClose}
        />
      );

      const rows = screen.getAllByRole('row');
      // Skip header row (index 0), check data rows
      expect(rows[1]).toHaveTextContent('1');
      expect(rows[1]).toHaveTextContent('player-1');
      expect(rows[1]).toHaveTextContent('5');

      expect(rows[2]).toHaveTextContent('2');
      expect(rows[2]).toHaveTextContent('player-2');
      expect(rows[2]).toHaveTextContent('3');

      expect(rows[3]).toHaveTextContent('3');
      expect(rows[3]).toHaveTextContent('player-3');
      expect(rows[3]).toHaveTextContent('1');
    });

    it('should rank tied players by deaths ascending', () => {
      const tiedData: MatchEndData = {
        ...mockMatchData,
        finalScores: [
          { playerId: 'player-1', kills: 5, deaths: 3, xp: 150 },
          { playerId: 'player-2', kills: 5, deaths: 2, xp: 150 },
          { playerId: 'player-3', kills: 3, deaths: 4, xp: 100 },
        ],
      };

      render(
        <MatchEndScreen
          matchData={tiedData}
          localPlayerId="player-2"
          onClose={mockOnClose}
        />
      );

      const rows = screen.getAllByRole('row');
      // player-2 should be ranked higher (fewer deaths)
      expect(rows[1]).toHaveTextContent('player-2');
      expect(rows[2]).toHaveTextContent('player-1');
    });

    it('should display XP earned for local player', () => {
      render(
        <MatchEndScreen
          matchData={mockMatchData}
          localPlayerId="player-2"
          onClose={mockOnClose}
        />
      );

      // Check that XP section is shown
      expect(screen.getByText(/XP Earned/i)).toBeInTheDocument();
    });

    it('should display XP breakdown with base, kills, win, and top 3 bonuses', () => {
      render(
        <MatchEndScreen
          matchData={mockMatchData}
          localPlayerId="player-2"
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText(/Base XP:/i)).toBeInTheDocument();
      expect(screen.getByText(/Kills \(/i)).toBeInTheDocument();
      expect(screen.getByText(/Win Bonus:/i)).toBeInTheDocument();
      expect(screen.getByText(/Top 3 Bonus:/i)).toBeInTheDocument();
    });

    it('should show win bonus only for winner', () => {
      render(
        <MatchEndScreen
          matchData={mockMatchData}
          localPlayerId="player-1"
          onClose={mockOnClose}
        />
      );

      const winBonusElement = screen.getByText(/Win Bonus/i).parentElement;
      expect(winBonusElement).toHaveTextContent('100');
    });

    it('should not show win bonus for non-winner', () => {
      render(
        <MatchEndScreen
          matchData={mockMatchData}
          localPlayerId="player-2"
          onClose={mockOnClose}
        />
      );

      const winBonusElement = screen.getByText(/Win Bonus/i).parentElement;
      expect(winBonusElement).toHaveTextContent('0');
    });

    it('should show top 3 bonus for top 3 players', () => {
      render(
        <MatchEndScreen
          matchData={mockMatchData}
          localPlayerId="player-2"
          onClose={mockOnClose}
        />
      );

      const topThreeBonusElement = screen.getByText(/Top 3 Bonus/i).parentElement;
      expect(topThreeBonusElement).toHaveTextContent('50');
    });

    it('should show Play Again button with placeholder message', () => {
      render(
        <MatchEndScreen
          matchData={mockMatchData}
          localPlayerId="player-2"
          onClose={mockOnClose}
        />
      );

      const playAgainButton = screen.getByRole('button', { name: /Play Again/i });
      expect(playAgainButton).toBeInTheDocument();
    });

    it('should display countdown timer starting at 10 seconds', () => {
      render(
        <MatchEndScreen
          matchData={mockMatchData}
          localPlayerId="player-2"
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText(/Returning to lobby in 10s/i)).toBeInTheDocument();
    });

    it('should countdown timer decrease every second', () => {
      render(
        <MatchEndScreen
          matchData={mockMatchData}
          localPlayerId="player-2"
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText(/Returning to lobby in 10s/i)).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(screen.getByText(/Returning to lobby in 9s/i)).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(screen.getByText(/Returning to lobby in 8s/i)).toBeInTheDocument();
    });

    it('should stop countdown at 0', () => {
      render(
        <MatchEndScreen
          matchData={mockMatchData}
          localPlayerId="player-2"
          onClose={mockOnClose}
        />
      );

      act(() => {
        vi.advanceTimersByTime(10000);
      });
      expect(screen.getByText(/Returning to lobby in 0s/i)).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(screen.getByText(/Returning to lobby in 0s/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have dialog role for match end screen', () => {
      render(
        <MatchEndScreen
          matchData={mockMatchData}
          localPlayerId="player-2"
          onClose={mockOnClose}
        />
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('should have aria-label for match end screen', () => {
      render(
        <MatchEndScreen
          matchData={mockMatchData}
          localPlayerId="player-2"
          onClose={mockOnClose}
        />
      );

      expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', 'Match End Results');
    });

    it('should have accessible close button', () => {
      render(
        <MatchEndScreen
          matchData={mockMatchData}
          localPlayerId="player-2"
          onClose={mockOnClose}
        />
      );

      const closeButton = screen.getByRole('button', { name: /Close/i });
      expect(closeButton).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('should call onClose when ESC key is pressed', () => {
      render(
        <MatchEndScreen
          matchData={mockMatchData}
          localPlayerId="player-2"
          onClose={mockOnClose}
        />
      );

      fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when close button is clicked', () => {
      render(
        <MatchEndScreen
          matchData={mockMatchData}
          localPlayerId="player-2"
          onClose={mockOnClose}
        />
      );

      const closeButton = screen.getByRole('button', { name: /Close/i });
      fireEvent.click(closeButton);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when clicking backdrop', () => {
      render(
        <MatchEndScreen
          matchData={mockMatchData}
          localPlayerId="player-2"
          onClose={mockOnClose}
        />
      );

      const backdrop = screen.getByRole('dialog').parentElement;
      if (backdrop) {
        fireEvent.click(backdrop);
        expect(mockOnClose).toHaveBeenCalledTimes(1);
      }
    });

    it('should not close when clicking inside the modal', () => {
      render(
        <MatchEndScreen
          matchData={mockMatchData}
          localPlayerId="player-2"
          onClose={mockOnClose}
        />
      );

      const dialog = screen.getByRole('dialog');
      fireEvent.click(dialog);
      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it('should show placeholder message when Play Again is clicked', () => {
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

      render(
        <MatchEndScreen
          matchData={mockMatchData}
          localPlayerId="player-2"
          onClose={mockOnClose}
        />
      );

      const playAgainButton = screen.getByRole('button', { name: /Play Again/i });
      fireEvent.click(playAgainButton);

      expect(alertSpy).toHaveBeenCalledWith('Lobby system coming in Epic 5');
      alertSpy.mockRestore();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty winners array', () => {
      const noWinnerData: MatchEndData = {
        ...mockMatchData,
        winners: [],
      };

      render(
        <MatchEndScreen
          matchData={noWinnerData}
          localPlayerId="player-2"
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText(/No Winner/i)).toBeInTheDocument();
    });

    it('should handle single player in finalScores', () => {
      const singlePlayerData: MatchEndData = {
        winners: ['player-1'],
        finalScores: [{ playerId: 'player-1', kills: 0, deaths: 0, xp: 50 }],
        reason: 'time_expired',
      };

      render(
        <MatchEndScreen
          matchData={singlePlayerData}
          localPlayerId="player-1"
          onClose={mockOnClose}
        />
      );

      const rows = screen.getAllByRole('row');
      expect(rows.length).toBe(2); // header + 1 player
    });

    it('should handle local player not in match', () => {
      render(
        <MatchEndScreen
          matchData={mockMatchData}
          localPlayerId="unknown-player"
          onClose={mockOnClose}
        />
      );

      // Should still render but with 0 XP
      expect(screen.getByText(/XP Earned/i)).toBeInTheDocument();
    });
  });
});
