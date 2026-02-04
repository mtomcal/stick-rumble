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
  }
}
