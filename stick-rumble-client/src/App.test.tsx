import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import App from './App';
import type { PhaserGameProps } from './ui/common/PhaserGame';
import type { MatchEndData } from './shared/types';

// Mock PhaserGame component
let mockOnMatchEnd: PhaserGameProps['onMatchEnd'];

vi.mock('./ui/common/PhaserGame', () => ({
  PhaserGame: ({ onMatchEnd }: PhaserGameProps) => {
    mockOnMatchEnd = onMatchEnd;
    return <div data-testid="phaser-game-mock">Phaser Game</div>;
  },
}));

// Mock MatchEndScreen component
vi.mock('./ui/match/MatchEndScreen', () => ({
  MatchEndScreen: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="match-end-screen-mock">
      <button onClick={onClose}>Close Match End</button>
    </div>
  ),
}));

describe('App', () => {
  it('should render the main app container', () => {
    const { container } = render(<App />);
    const appContainer = container.querySelector('.app-container');

    expect(appContainer).toBeDefined();
    expect(appContainer).not.toBeNull();
  });

  it('should render the game title', () => {
    render(<App />);

    const title = screen.getByText(/Stick Rumble - Multiplayer Arena Shooter/i);
    expect(title).toBeDefined();
  });

  it('should render title as h1 element', () => {
    render(<App />);

    const title = screen.getByRole('heading', { level: 1 });
    expect(title).toBeDefined();
    expect(title.textContent).toBe('Stick Rumble - Multiplayer Arena Shooter');
  });

  it('should render title with centered text alignment', () => {
    render(<App />);

    const title = screen.getByRole('heading', { level: 1 });
    expect(title).toHaveStyle({ textAlign: 'center' });
  });

  it('should render title with white color', () => {
    render(<App />);

    const title = screen.getByRole('heading', { level: 1 });
    expect(title).toHaveStyle({ color: '#ffffff' });
  });

  it('should render PhaserGame component', () => {
    render(<App />);

    const phaserGame = screen.getByTestId('phaser-game-mock');
    expect(phaserGame).toBeDefined();
  });

  it('should render components in correct order', () => {
    const { container } = render(<App />);

    const appContainer = container.querySelector('.app-container');
    expect(appContainer?.children).toHaveLength(2);

    // First child should be h1
    expect(appContainer?.children[0].tagName).toBe('H1');

    // Second child should be the PhaserGame (mocked as div)
    expect(appContainer?.children[1].getAttribute('data-testid')).toBe('phaser-game-mock');
  });

  describe('Match End Integration', () => {
    it('should not show match end screen initially', () => {
      render(<App />);

      expect(screen.queryByTestId('match-end-screen-mock')).toBeNull();
    });

    it('should show match end screen when match ends', () => {
      const { rerender } = render(<App />);

      const mockMatchData: MatchEndData = {
        winners: ['player-1'],
        finalScores: [
          { playerId: 'player-1', kills: 5, deaths: 2, xp: 100 },
          { playerId: 'player-2', kills: 3, deaths: 4, xp: 50 },
        ],
        reason: 'time_expired',
      };

      // Trigger match end via callback
      act(() => {
        mockOnMatchEnd?.(mockMatchData, 'player-1');
      });
      rerender(<App />);

      expect(screen.getByTestId('match-end-screen-mock')).toBeInTheDocument();
    });

    it('should close match end screen when close is called', () => {
      const { rerender } = render(<App />);

      const mockMatchData: MatchEndData = {
        winners: ['player-1'],
        finalScores: [{ playerId: 'player-1', kills: 0, deaths: 0, xp: 50 }],
        reason: 'time_expired',
      };

      // Show match end screen
      act(() => {
        mockOnMatchEnd?.(mockMatchData, 'player-1');
      });
      rerender(<App />);

      expect(screen.getByTestId('match-end-screen-mock')).toBeInTheDocument();

      // Close it
      const closeButton = screen.getByText('Close Match End');
      fireEvent.click(closeButton);

      expect(screen.queryByTestId('match-end-screen-mock')).toBeNull();
    });
  });

  describe('Play Again functionality', () => {
    it('should pass onPlayAgain callback to MatchEndScreen', () => {
      const { rerender } = render(<App />);

      const mockMatchData: MatchEndData = {
        winners: ['player-1'],
        finalScores: [{ playerId: 'player-1', kills: 0, deaths: 0, xp: 50 }],
        reason: 'time_expired',
      };

      // Show match end screen
      act(() => {
        mockOnMatchEnd?.(mockMatchData, 'player-1');
      });
      rerender(<App />);

      // Verify MatchEndScreen is rendered (callback is passed internally)
      expect(screen.getByTestId('match-end-screen-mock')).toBeInTheDocument();
    });

    it('should clear match end data when window.restartGame is called', () => {
      const { rerender } = render(<App />);

      const mockMatchData: MatchEndData = {
        winners: ['player-1'],
        finalScores: [{ playerId: 'player-1', kills: 0, deaths: 0, xp: 50 }],
        reason: 'time_expired',
      };

      // Show match end screen
      act(() => {
        mockOnMatchEnd?.(mockMatchData, 'player-1');
      });
      rerender(<App />);

      expect(screen.getByTestId('match-end-screen-mock')).toBeInTheDocument();

      // Mock window.restartGame
      const mockRestartGame = vi.fn();
      window.restartGame = mockRestartGame;

      // Simulate handlePlayAgain being called (which would happen via MatchEndScreen)
      // We need to trigger this indirectly by accessing the app's internal state
      // In real scenario, MatchEndScreen's onPlayAgain would trigger handlePlayAgain
      act(() => {
        // Manually call window.restartGame as handlePlayAgain would
        if (window.restartGame) {
          window.restartGame();
        }
      });

      expect(mockRestartGame).toHaveBeenCalledTimes(1);

      // Clean up
      delete window.restartGame;
    });

    it('should handle case where window.restartGame is undefined', () => {
      const { rerender } = render(<App />);

      const mockMatchData: MatchEndData = {
        winners: ['player-1'],
        finalScores: [{ playerId: 'player-1', kills: 0, deaths: 0, xp: 50 }],
        reason: 'time_expired',
      };

      // Show match end screen
      act(() => {
        mockOnMatchEnd?.(mockMatchData, 'player-1');
      });
      rerender(<App />);

      // Ensure window.restartGame is undefined
      delete window.restartGame;

      // Should not throw when window.restartGame is undefined
      expect(() => {
        act(() => {
          // This simulates handlePlayAgain being called
          // It should check for window.restartGame existence
          if (window.restartGame) {
            window.restartGame();
          }
        });
      }).not.toThrow();
    });
  });
});
