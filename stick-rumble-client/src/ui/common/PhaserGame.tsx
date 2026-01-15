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

      // Expose restartGame function to allow React to trigger scene restart
      window.restartGame = () => {
        if (gameRef.current) {
          const scene = gameRef.current.scene.getScene('GameScene');
          if (scene) {
            scene.scene.restart();
          } else {
            console.warn('PhaserGame: GameScene not found, cannot restart');
          }
        } else {
          console.warn('PhaserGame: Game instance not available, cannot restart');
        }
      };
    }

    // Cleanup on unmount
    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }

      // Cleanup global callbacks
      if (onMatchEnd) {
        delete window.onMatchEnd;
      }
      delete window.restartGame;
    };
  }, [onMatchEnd]);

  return <div id="game-container" />;
}
