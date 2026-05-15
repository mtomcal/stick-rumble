import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LobbyScreen } from './LobbyScreen';

const mockFetchPlayerMe = vi.hoisted(() => vi.fn());
vi.mock('../../game/network/playerApi', () => ({
  fetchPlayerMe: mockFetchPlayerMe,
}));

vi.mock('../../game/network/sessionToken', () => ({
  getSessionToken: vi.fn(() => 'test-token'),
  clearSessionToken: vi.fn(),
  hasSessionToken: vi.fn(() => true),
}));

describe('LobbyScreen', () => {
  const mockOnPlayPublic = vi.fn();
  const mockOnSignOut = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchPlayerMe.mockResolvedValue({ status: 'ok', player: {
      playerId: 'abc-123',
      displayName: 'TestPlayer',
      avatarUrl: 'https://example.com/avatar.jpg',
      level: 4,
      currentLevelXp: 500,
      xpForNextLevel: 2500,
      lifetimeStats: {
        kills: 100,
        deaths: 50,
        wins: 20,
        gamesPlayed: 80,
        totalXp: 5000,
        damageDealt: 10000,
      },
    } });
  });

  it('renders loading state initially', () => {
    render(<LobbyScreen onPlayPublic={mockOnPlayPublic} onSignOut={mockOnSignOut} />);
    expect(screen.getByText(/loading/i)).toBeDefined();
  });

  it('renders player display name after loading', async () => {
    render(<LobbyScreen onPlayPublic={mockOnPlayPublic} onSignOut={mockOnSignOut} />);
    await waitFor(() => {
      expect(screen.getByText('TestPlayer')).toBeDefined();
    });
  });

  it('renders Play Public button', async () => {
    render(<LobbyScreen onPlayPublic={mockOnPlayPublic} onSignOut={mockOnSignOut} />);
    await waitFor(() => {
      expect(screen.getByText(/play public/i)).toBeDefined();
    });
  });

  it('calls onPlayPublic when Play Public is clicked', async () => {
    render(<LobbyScreen onPlayPublic={mockOnPlayPublic} onSignOut={mockOnSignOut} />);
    await waitFor(() => {
      fireEvent.click(screen.getByText(/play public/i));
    });
    expect(mockOnPlayPublic).toHaveBeenCalled();
  });

  it('renders Sign Out button', async () => {
    render(<LobbyScreen onPlayPublic={mockOnPlayPublic} onSignOut={mockOnSignOut} />);
    await waitFor(() => {
      expect(screen.getByText(/sign out/i)).toBeDefined();
    });
  });

  it('calls onSignOut when Sign Out is clicked', async () => {
    render(<LobbyScreen onPlayPublic={mockOnPlayPublic} onSignOut={mockOnSignOut} />);
    await waitFor(() => {
      fireEvent.click(screen.getByText(/sign out/i));
    });
    expect(mockOnSignOut).toHaveBeenCalled();
  });

  it('renders XP progress bar', async () => {
    render(<LobbyScreen onPlayPublic={mockOnPlayPublic} onSignOut={mockOnSignOut} />);
    await waitFor(() => {
      const xpElements = screen.getAllByText(/xp/i);
      expect(xpElements.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders stats cluster', async () => {
    render(<LobbyScreen onPlayPublic={mockOnPlayPublic} onSignOut={mockOnSignOut} />);
    await waitFor(() => {
      expect(screen.getByText(/kills/i)).toBeDefined();
      expect(screen.getByText(/deaths/i)).toBeDefined();
    });
  });
});
