import Phaser from 'phaser';
import { GameScene } from '../scenes/GameScene';
import { DESKTOP_VIEWPORT_HEIGHT, DESKTOP_VIEWPORT_WIDTH } from './viewport';

export const GameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: DESKTOP_VIEWPORT_WIDTH,
  height: DESKTOP_VIEWPORT_HEIGHT,
  parent: 'game-container',
  backgroundColor: '#C8CCC8',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  scene: [GameScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};

export function createGameConfig(width: number, height: number): Phaser.Types.Core.GameConfig {
  return {
    ...GameConfig,
    width,
    height,
  };
}
