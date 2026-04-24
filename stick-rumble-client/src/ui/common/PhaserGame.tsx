import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { createGameConfig } from '../../game/config/GameConfig';
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

function resizePhaserGame(game: Phaser.Game, width: number, height: number): void {
  const scaleManager = (game as Phaser.Game & {
    scale?: {
      resize?: (nextWidth: number, nextHeight: number) => void;
      refresh?: () => void;
    };
  }).scale

  scaleManager?.resize?.(width, height)
  scaleManager?.refresh?.()
}

export function PhaserGame({ bootstrap, layout, onMatchEnd }: PhaserGameProps) {
  const gameRef = useRef<Phaser.Game | null>(null);
  const initialLayoutRef = useRef(layout);
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
    if (!gameRef.current) {
      return
    }

    resizePhaserGame(gameRef.current, layout.width, layout.height)
  }, [layout.height, layout.width])

  useEffect(() => {
    // Initialize Phaser game
    if (!gameRef.current) {
      const initialLayout = initialLayoutRef.current
      gameRef.current = new Phaser.Game(createGameConfig(initialLayout.width, initialLayout.height));
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
