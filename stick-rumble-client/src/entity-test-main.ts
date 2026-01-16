/**
 * Entity Test Entry Point
 * Minimal Phaser game instance for entity visual regression testing
 */

import Phaser from 'phaser';
import { EntityTestScene } from './entity-test-scene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.CANVAS,
  width: 800,
  height: 600,
  parent: 'game-container',
  backgroundColor: '#1a1a1a',
  scene: [EntityTestScene],
  // Disable physics for entity-only tests
  physics: {
    default: undefined,
  },
  // Disable audio
  audio: {
    noAudio: true,
  },
  // Render settings for consistent screenshots
  render: {
    antialias: false,
    pixelArt: false,
    roundPixels: false,
  },
};

const game = new Phaser.Game(config);

// Expose game instance globally for debugging
interface WindowWithGame extends Window {
  game: Phaser.Game;
}

(window as unknown as WindowWithGame).game = game;
