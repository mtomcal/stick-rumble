import { getApiBaseUrl } from '../config/runtimeConfig';
import type { PlayerInfo } from '../../shared/types';

export type FetchPlayerMeResult = 
  | { status: 'ok'; player: PlayerInfo }
  | { status: 'unauthorized' }
  | { status: 'error'; error: string };

export async function fetchPlayerMe(token: string): Promise<FetchPlayerMeResult> {
  try {
    const response = await fetch(`${getApiBaseUrl()}/player/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.status === 401) {
      return { status: 'unauthorized' };
    }

    if (!response.ok) {
      return { status: 'error', error: `Server returned ${response.status}` };
    }

    const player: PlayerInfo = await response.json();
    return { status: 'ok', player };
  } catch (err) {
    return { status: 'error', error: err instanceof Error ? err.message : 'Unknown error' };
  }
}
