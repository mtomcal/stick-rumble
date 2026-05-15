import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchPlayerMe } from './playerApi';
import { clearSessionToken } from './sessionToken';

// Mock sessionToken module
vi.mock('./sessionToken', () => ({
  clearSessionToken: vi.fn(),
}));

vi.mock('../config/runtimeConfig', () => ({
  getApiBaseUrl: () => '/api',
}));

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

describe('fetchPlayerMe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls GET /api/player/me with Authorization header', async () => {
    const playerInfo = {
      playerId: 'abc-123',
      displayName: 'TestPlayer',
      lifetimeStats: { kills: 10, deaths: 5, wins: 2, gamesPlayed: 10, totalXp: 5000, damageDealt: 1000 },
      level: 4,
      currentLevelXp: 500,
      xpForNextLevel: 2500,
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => playerInfo,
    });

    const result = await fetchPlayerMe('test-token');
    expect(mockFetch).toHaveBeenCalledWith('/api/player/me', {
      headers: { Authorization: 'Bearer test-token' },
    });
    expect(result).toEqual(playerInfo);
  });

  it('returns null and clears token on 401', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
    });

    const result = await fetchPlayerMe('bad-token');
    expect(clearSessionToken).toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it('returns null on network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network failure'));
    const result = await fetchPlayerMe('test-token');
    expect(result).toBeNull();
  });
});
