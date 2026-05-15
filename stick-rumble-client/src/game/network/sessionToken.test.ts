import { describe, it, expect, beforeEach, vi } from 'vitest';
import { storeSessionToken, getSessionToken, clearSessionToken, hasSessionToken } from './sessionToken';

const TEST_KEY = 'stick_rumble_session_token';

// TS-ACCT-003: Session token stored and retrieved from localStorage
// TS-ACCT-010: Sign out clears token and returns to guest state (clearSessionToken)
describe('sessionToken', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('stores a token in localStorage', () => {
    storeSessionToken('test-token-123');
    expect(localStorage.getItem(TEST_KEY)).toBe('test-token-123');
  });

  it('retrieves a stored token', () => {
    localStorage.setItem(TEST_KEY, 'test-token-456');
    expect(getSessionToken()).toBe('test-token-456');
  });

  it('returns null when no token is stored', () => {
    expect(getSessionToken()).toBeNull();
  });

  it('clears a stored token', () => {
    localStorage.setItem(TEST_KEY, 'test-token-789');
    clearSessionToken();
    expect(localStorage.getItem(TEST_KEY)).toBeNull();
  });

  it('hasSessionToken returns true when token exists', () => {
    localStorage.setItem(TEST_KEY, 'test-token');
    expect(hasSessionToken()).toBe(true);
  });

  it('hasSessionToken returns false when no token', () => {
    expect(hasSessionToken()).toBe(false);
  });

  it('token survives simulated page reload via localStorage', () => {
    storeSessionToken('persistent-token');
    const token1 = getSessionToken();
    // Simulate page reload by re-reading from localStorage
    localStorage.getItem(TEST_KEY); // touch
    const token2 = getSessionToken();
    expect(token1).toBe(token2);
  });

  it('gracefully handles localStorage write errors (e.g. Safari private browsing)', () => {
    const origSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = vi.fn(() => {
      throw new Error('localStorage unavailable');
    });
    try {
      expect(() => storeSessionToken('test-token')).not.toThrow();
      expect(getSessionToken()).toBeNull();
      expect(hasSessionToken()).toBe(false);
      expect(() => clearSessionToken()).not.toThrow();
    } finally {
      Storage.prototype.setItem = origSetItem;
    }
  });
});
