import Phaser from 'phaser';
import { MainScene } from './scenes/MainScene';

export const createGame = (containerId: string) => {
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent: containerId,
    backgroundColor: '#1a1a1a',
    scale: {
      mode: Phaser.Scale.RESIZE,
      width: '100%',
      height: '100%',
    },
    physics: {
      default: 'arcade',
      arcade: {
        fps: 120, // Double the physics step resolution to prevent bullet tunneling
        gravity: { x: 0, y: 0 }, // Top down, no gravity
        debug: false
      }
    },
    scene: [MainScene]
  };

  return new Phaser.Game(config);
};