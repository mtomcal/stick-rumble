import { SESSION_TOKEN_KEY } from '../../shared/constants';

export function storeSessionToken(token: string): void {
  try {
    localStorage.setItem(SESSION_TOKEN_KEY, token);
  } catch {
    // localStorage unavailable (e.g., Safari private browsing), silently degrade
  }
}

export function getSessionToken(): string | null {
  try {
    return localStorage.getItem(SESSION_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function clearSessionToken(): void {
  try {
    localStorage.removeItem(SESSION_TOKEN_KEY);
  } catch {
    // silently degrade
  }
}

export function hasSessionToken(): boolean {
  try {
    return localStorage.getItem(SESSION_TOKEN_KEY) !== null;
  } catch {
    return false;
  }
}
