import { clearSessionToken } from './sessionToken';
import { getApiBaseUrl } from '../config/runtimeConfig';
import type { PlayerInfo } from '../../shared/types';

export async function fetchPlayerMe(token: string): Promise<PlayerInfo | null> {
  try {
    const response = await fetch(`${getApiBaseUrl()}/player/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.status === 401) {
      clearSessionToken();
      return null;
    }

    if (!response.ok) {
      console.error('fetchPlayerMe returned', response.status);
      return null;
    }

    return await response.json();
  } catch (err) {
    console.error('fetchPlayerMe error:', err);
    return null;
  }
}
