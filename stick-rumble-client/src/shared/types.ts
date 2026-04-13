/**
 * Shared types for the client application
 */

/**
 * Player score data for match end
 */
export interface PlayerScore {
  playerId: string;
  kills: number;
  deaths: number;
  xp: number;
}

/**
 * Match end data from server
 */
export interface MatchEndData {
  winners: string[];
  finalScores: PlayerScore[];
  reason: string;
}

export type JoinMode = 'public' | 'code';

export interface JoinIntent {
  displayName?: string;
  mode: JoinMode;
  code?: string;
}

export interface JoinSuccessPayload {
  roomId: string;
  playerId: string;
  mapId: string;
  displayName: string;
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
    restartGame?: () => void;
    // Network simulator controls (F8 debug panel)
    onNetworkSimulatorToggle?: () => void;
    getNetworkSimulatorStats?: () => NetworkSimulatorStats | null;
    setNetworkSimulatorLatency?: (latency: number) => void;
    setNetworkSimulatorPacketLoss?: (packetLoss: number) => void;
    setNetworkSimulatorEnabled?: (enabled: boolean) => void;
    submitJoinIntent?: (intent: JoinIntent) => void;
    onJoinSuccess?: (payload: JoinSuccessPayload) => void;
    onJoinError?: (payload: JoinErrorPayload) => void;
    onRosterSizeChanged?: (count: number) => void;
    onReconnectReplayFailed?: (intent: JoinIntent) => void;
  }
}
