import { vi } from 'vitest';

// Mock Phaser.Scene
class MockScene {
  scene = { key: 'GameScene' };
  add = {
    text: vi.fn(),
    circle: vi.fn(),
  };
  cameras = {
    main: {
      centerX: 640,
      centerY: 360,
    },
  };
  tweens = {
    add: vi.fn(),
  };

  constructor(config?: any) {
    if (config?.key) {
      this.scene.key = config.key;
    }
  }

  preload() {}
  create() {}
  update() {}
}

// Mock Phaser.Game
class MockGame {
  config: any;
  destroy: any;

  constructor(config: any) {
    this.config = config;
    this.destroy = vi.fn();
  }
}

// Mock Phaser namespace
const Phaser = {
  AUTO: 0,
  Scene: MockScene,
  Game: MockGame,
  Scale: {
    FIT: 1,
    CENTER_BOTH: 2,
  },
  Types: {
    Core: {},
    Physics: {
      Arcade: {},
    },
  },
};

export default Phaser;
