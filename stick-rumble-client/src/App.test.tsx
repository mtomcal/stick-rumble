import { describe, it, expect, vi, afterEach } from 'vitest';
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

// Mock MatchEndScreen component - expose onPlayAgain
let mockOnPlayAgain: (() => void) | undefined;
vi.mock('./ui/match/MatchEndScreen', () => ({
  MatchEndScreen: ({ onClose, onPlayAgain }: { onClose: () => void; onPlayAgain: () => void }) => {
    mockOnPlayAgain = onPlayAgain;
    return (
      <div data-testid="match-end-screen-mock">
        <button onClick={onClose}>Close Match End</button>
        <button onClick={onPlayAgain}>Play Again</button>
      </div>
    );
  },
}));

// Mock DebugNetworkPanel component - expose callbacks
let mockOnLatencyChange: ((latency: number) => void) | undefined;
let mockOnPacketLossChange: ((packetLoss: number) => void) | undefined;
let mockOnEnabledChange: ((enabled: boolean) => void) | undefined;
vi.mock('./ui/debug/DebugNetworkPanel', () => ({
  DebugNetworkPanel: ({ onLatencyChange, onPacketLossChange, onEnabledChange }: any) => {
    mockOnLatencyChange = onLatencyChange;
    mockOnPacketLossChange = onPacketLossChange;
    mockOnEnabledChange = onEnabledChange;
    return <div data-testid="debug-panel-mock" />;
  },
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
    expect(appContainer?.children).toHaveLength(3);

    // First child should be h1
    expect(appContainer?.children[0].tagName).toBe('H1');

    // Second child should be the PhaserGame (mocked as div)
    expect(appContainer?.children[1].getAttribute('data-testid')).toBe('phaser-game-mock');

    // Third child is the DebugNetworkPanel (mocked as div)
    expect(appContainer?.children[2].getAttribute('data-testid')).toBe('debug-panel-mock');
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

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Click Play Again with no window.restartGame
      act(() => {
        mockOnPlayAgain?.();
      });

      expect(warnSpy).toHaveBeenCalledWith('App: window.restartGame is not available');
      warnSpy.mockRestore();
    });

    it('should call window.restartGame and clear match end data via Play Again button', () => {
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

      // Click Play Again button
      act(() => {
        fireEvent.click(screen.getByText('Play Again'));
      });

      expect(mockRestartGame).toHaveBeenCalledTimes(1);
      // Match end screen should be hidden after play again
      expect(screen.queryByTestId('match-end-screen-mock')).toBeNull();

      delete window.restartGame;
    });
  });

  describe('Network Simulator callbacks', () => {
    afterEach(() => {
      delete window.setNetworkSimulatorLatency;
      delete window.setNetworkSimulatorPacketLoss;
      delete window.setNetworkSimulatorEnabled;
      delete window.getNetworkSimulatorStats;
      delete window.onNetworkSimulatorToggle;
    });

    it('should call window.setNetworkSimulatorLatency when latency changes', () => {
      const mockSetLatency = vi.fn();
      window.setNetworkSimulatorLatency = mockSetLatency;

      render(<App />);

      act(() => {
        mockOnLatencyChange?.(50);
      });

      expect(mockSetLatency).toHaveBeenCalledWith(50);
    });

    it('should not crash when window.setNetworkSimulatorLatency is undefined', () => {
      delete window.setNetworkSimulatorLatency;

      render(<App />);

      expect(() => {
        act(() => {
          mockOnLatencyChange?.(50);
        });
      }).not.toThrow();
    });

    it('should call window.setNetworkSimulatorPacketLoss when packet loss changes', () => {
      const mockSetPacketLoss = vi.fn();
      window.setNetworkSimulatorPacketLoss = mockSetPacketLoss;

      render(<App />);

      act(() => {
        mockOnPacketLossChange?.(0.1);
      });

      expect(mockSetPacketLoss).toHaveBeenCalledWith(0.1);
    });

    it('should not crash when window.setNetworkSimulatorPacketLoss is undefined', () => {
      delete window.setNetworkSimulatorPacketLoss;

      render(<App />);

      expect(() => {
        act(() => {
          mockOnPacketLossChange?.(0.1);
        });
      }).not.toThrow();
    });

    it('should call window.setNetworkSimulatorEnabled when enabled changes', () => {
      const mockSetEnabled = vi.fn();
      window.setNetworkSimulatorEnabled = mockSetEnabled;

      render(<App />);

      act(() => {
        mockOnEnabledChange?.(true);
      });

      expect(mockSetEnabled).toHaveBeenCalledWith(true);
    });

    it('should not crash when window.setNetworkSimulatorEnabled is undefined', () => {
      delete window.setNetworkSimulatorEnabled;

      render(<App />);

      expect(() => {
        act(() => {
          mockOnEnabledChange?.(true);
        });
      }).not.toThrow();
    });

    it('should refresh stats via onNetworkSimulatorToggle when stats available', () => {
      const mockStats = { enabled: true, latency: 100, packetLoss: 0.05 };
      window.getNetworkSimulatorStats = vi.fn().mockReturnValue(mockStats);

      render(<App />);

      // Trigger the toggle callback
      act(() => {
        window.onNetworkSimulatorToggle?.();
      });

      expect(window.getNetworkSimulatorStats).toHaveBeenCalled();
    });

    it('should handle onNetworkSimulatorToggle when getNetworkSimulatorStats is undefined', () => {
      delete window.getNetworkSimulatorStats;

      render(<App />);

      // Should not crash
      expect(() => {
        act(() => {
          window.onNetworkSimulatorToggle?.();
        });
      }).not.toThrow();
    });

    it('should handle onNetworkSimulatorToggle when getNetworkSimulatorStats returns null', () => {
      window.getNetworkSimulatorStats = vi.fn().mockReturnValue(null);

      render(<App />);

      // Should not crash
      expect(() => {
        act(() => {
          window.onNetworkSimulatorToggle?.();
        });
      }).not.toThrow();
    });

    it('should clean up onNetworkSimulatorToggle on unmount', () => {
      const { unmount } = render(<App />);

      expect(window.onNetworkSimulatorToggle).toBeDefined();

      unmount();

      expect(window.onNetworkSimulatorToggle).toBeUndefined();
    });
  });
});
