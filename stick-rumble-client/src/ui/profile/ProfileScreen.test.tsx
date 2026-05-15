import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ProfileScreen } from './ProfileScreen';

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

vi.mock('../../game/network/sessionToken', () => ({
  getSessionToken: vi.fn(() => 'test-token'),
}));

vi.mock('../../game/config/runtimeConfig', () => ({
  getApiBaseUrl: () => '/api',
}));

describe('ProfileScreen', () => {
  const mockOnBack = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        playerId: 'abc-123',
        displayName: 'TestPlayer',
        level: 10,
        currentLevelXp: 2500,
        xpForNextLevel: 5000,
        lifetimeStats: {
          kills: 500,
          deaths: 200,
          wins: 50,
          gamesPlayed: 200,
          totalXp: 25000,
          damageDealt: 50000,
        },
      }),
    });
  });

  it('renders loading state initially', () => {
    render(<ProfileScreen onBack={mockOnBack} />);
    expect(screen.getByText(/loading/i)).toBeDefined();
  });

  it('renders player display name after loading', async () => {
    render(<ProfileScreen onBack={mockOnBack} />);
    await waitFor(() => {
      expect(screen.getByText('TestPlayer')).toBeDefined();
    });
  });

  it('renders lifetime stats', async () => {
    render(<ProfileScreen onBack={mockOnBack} />);
    await waitFor(() => {
      expect(screen.getByText(/Kills/)).toBeDefined();
      expect(screen.getByText(/Deaths/)).toBeDefined();
      expect(screen.getByText(/Wins/)).toBeDefined();
      // Check that stat values are rendered (some may overlap, use getAllByText)
      const numbers = screen.getAllByText(/\d+/);
      expect(numbers.length).toBeGreaterThanOrEqual(6);
    });
  });

  it('renders Back to Lobby button', async () => {
    render(<ProfileScreen onBack={mockOnBack} />);
    await waitFor(() => {
      expect(screen.getByText(/back to lobby/i)).toBeDefined();
    });
  });
});
