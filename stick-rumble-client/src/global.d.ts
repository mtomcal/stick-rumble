import type { MatchEndData } from './shared/types';

declare global {
  interface Window {
    onMatchEnd?: (data: MatchEndData, playerId: string) => void;
  }
}

export {};
