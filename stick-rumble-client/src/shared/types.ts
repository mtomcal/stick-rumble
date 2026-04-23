/**
 * Shared types for the client application
 */

export type SessionStatusState = 'searching_for_match' | 'waiting_for_players' | 'match_ready'
export type JoinMode = 'public' | 'code'

export interface PlayerScore {
  playerId: string;
  displayName: string;
  kills: number;
  deaths: number;
  xp: number;
}

export interface WinnerSummary {
  playerId: string;
  displayName: string;
}

export interface MatchEndData {
  winners: WinnerSummary[];
  finalScores: PlayerScore[];
  reason: 'kill_target' | 'time_limit' | string;
}

export interface JoinIntent {
  displayName?: string;
  mode: JoinMode;
  code?: string;
}

export interface SessionStatusData {
  state: SessionStatusState;
  playerId: string;
  displayName: string;
  joinMode: JoinMode;
  roomId?: string;
  code?: string;
  rosterSize?: number;
  minPlayers?: number;
  mapId?: string;
}

export interface MatchSession {
  roomId: string;
  playerId: string;
  mapId: string;
  displayName: string;
  joinMode: JoinMode;
  code?: string;
}

export interface JoinErrorPayload {
  type: 'error:bad_room_code' | 'error:room_full' | 'error:no_hello';
  reason?: string;
  code?: string;
  offendingType?: string;
}

import type { NetworkSimulatorStats } from '../game/network/NetworkSimulator';

/**
 * Window object extensions for Phaser-React communication
 */
declare global {
  interface Window {
    onMatchEnd?: (data: MatchEndData, playerId: string) => void;
    // Network simulator controls (F8 debug panel)
    onNetworkSimulatorToggle?: () => void;
    getNetworkSimulatorStats?: () => NetworkSimulatorStats | null;
    setNetworkSimulatorLatency?: (latency: number) => void;
    setNetworkSimulatorPacketLoss?: (packetLoss: number) => void;
    setNetworkSimulatorEnabled?: (enabled: boolean) => void;
  }
}
