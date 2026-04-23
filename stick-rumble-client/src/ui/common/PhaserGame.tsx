import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { GameConfig } from '../../game/config/GameConfig';
import {
  setActiveMatchBootstrap,
  setViewportLayout,
  type MatchBootstrap,
} from '../../game/sessionRuntime';
import type { GameplayViewportLayout, MatchEndData } from '../../shared/types';

export interface PhaserGameProps {
  bootstrap: MatchBootstrap;
  layout: GameplayViewportLayout;
  onMatchEnd?: (data: MatchEndData, playerId: string) => void;
}

export function PhaserGame({ bootstrap, layout, onMatchEnd }: PhaserGameProps) {
  const gameRef = useRef<Phaser.Game | null>(null);
  const onMatchEndRef = useRef(onMatchEnd);

  useEffect(() => {
    onMatchEndRef.current = onMatchEnd;

    if (onMatchEnd) {
      window.onMatchEnd = (data, playerId) => onMatchEndRef.current?.(data, playerId);
      return () => {
        delete window.onMatchEnd;
      };
    }

    delete window.onMatchEnd;
    return undefined;
  }, [onMatchEnd]);

  useEffect(() => {
    setActiveMatchBootstrap(bootstrap);
  }, [bootstrap]);

  useEffect(() => {
    setViewportLayout(layout);
  }, [layout]);

  useEffect(() => {
    // Initialize Phaser game
    if (!gameRef.current) {
      gameRef.current = new Phaser.Game(GameConfig);
    }

    // Cleanup on unmount
    return () => {
      bootstrap.wsClient.setGameplayReady(false);
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }

      setActiveMatchBootstrap(null);
    };
  }, [bootstrap.wsClient]);

  return <div id="game-container" />;
}
