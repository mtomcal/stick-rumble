import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { act } from 'react';
import { SignInScreen } from './SignInScreen';

// Mock fetch for auth API calls
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

// Mock the Google Identity Services library
vi.mock('../../game/network/playerApi', () => ({
  fetchPlayerMe: vi.fn(),
}));

vi.mock('../../game/network/sessionToken', () => ({
  storeSessionToken: vi.fn(),
  getSessionToken: vi.fn(() => null),
  hasSessionToken: vi.fn(() => false),
}));

vi.mock('../../game/config/runtimeConfig', () => ({
  getApiBaseUrl: () => '/api',
}));

describe('SignInScreen', () => {
  const mockOnGuestClick = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Sign In heading', () => {
    render(<SignInScreen onGuestClick={mockOnGuestClick} />);
    expect(screen.getByRole('heading', { name: /sign in/i })).toBeDefined();
  });

  it('renders Play as Guest button', () => {
    render(<SignInScreen onGuestClick={mockOnGuestClick} />);
    const guestButton = screen.getByText(/play as guest/i);
    expect(guestButton).toBeDefined();
  });

  it('calls onGuestClick when Play as Guest is clicked', () => {
    render(<SignInScreen onGuestClick={mockOnGuestClick} />);
    fireEvent.click(screen.getByText(/play as guest/i));
    expect(mockOnGuestClick).toHaveBeenCalled();
  });

  it('renders Google Sign-In button container', () => {
    render(<SignInScreen onGuestClick={mockOnGuestClick} />);
    // Google button is rendered via GIS which creates the container div
    expect(screen.getByTestId('google-signin-container')).toBeDefined();
  });

  it('shows GIS error message when gisError is set', () => {
    render(<SignInScreen onGuestClick={mockOnGuestClick} />);

    const scripts = document.querySelectorAll('script');
    const gsiScript = Array.from(scripts).find(
      (s) => s.src === 'https://accounts.google.com/gsi/client'
    );
    if (gsiScript) {
      act(() => {
        gsiScript.onerror?.(new Event('error'));
      });
    }

    expect(
      screen.getByText(/Google Sign-In is temporarily unavailable/i)
    ).toBeDefined();
  });

  it('shows auth error message when auth fails', async () => {
    render(<SignInScreen onGuestClick={mockOnGuestClick} />);

    // Trigger the script onload so initialize and callback are set up
    const scripts = document.querySelectorAll('script');
    const gsiScript = Array.from(scripts).find(
      (s) => s.src === 'https://accounts.google.com/gsi/client'
    );
    expect(gsiScript).toBeDefined();
    if (gsiScript) {
      // Mock window.google
      (window as any).google = {
        accounts: {
          id: {
            initialize: vi.fn(),
            renderButton: vi.fn(),
          },
        },
      };
      act(() => {
        gsiScript.onload?.(new Event('load'));
      });
    }

    // Now trigger the callback with a failed response
    const initializeMock = (window as any).google.accounts.id.initialize;
    expect(initializeMock.mock.calls.length).toBeGreaterThan(0);
    const config = initializeMock.mock.calls[0][0];
    const callback = config.callback;

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
    });

    await act(async () => {
      await callback({ credential: 'test-token' });
    });

    expect(screen.getByText(/Authentication failed/i)).toBeDefined();
  });
});
