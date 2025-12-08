import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { GameConfig } from '../../game/config/GameConfig';
import type { MatchEndData } from '../../shared/types';

export interface PhaserGameProps {
  onMatchEnd?: (data: MatchEndData, playerId: string) => void;
}

export function PhaserGame({ onMatchEnd }: PhaserGameProps) {
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    // Initialize Phaser game
    if (!gameRef.current) {
      gameRef.current = new Phaser.Game(GameConfig);

      // Expose onMatchEnd callback to Phaser game
      if (onMatchEnd) {
        window.onMatchEnd = onMatchEnd;
      }
    }

    // Cleanup on unmount
    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }

      // Cleanup global callback
      if (onMatchEnd) {
        delete window.onMatchEnd;
      }
    };
  }, [onMatchEnd]);

  return <div id="game-container" />;
}
