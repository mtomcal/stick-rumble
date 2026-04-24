import { describe, it, expect } from 'vitest';
import Phaser from 'phaser';
import { createGameConfig, GameConfig } from './GameConfig';

describe('GameConfig', () => {
  it('should have correct game dimensions', () => {
    expect(GameConfig.width).toBe(1280);
    expect(GameConfig.height).toBe(720);
  });

  it('should use AUTO render type', () => {
    expect(GameConfig.type).toBe(Phaser.AUTO);
  });

  it('should target game-container parent element', () => {
    expect(GameConfig.parent).toBe('game-container');
  });

  it('should have correct background color', () => {
    expect(GameConfig.backgroundColor).toBe('#C8CCC8');
  });

  it('should configure arcade physics', () => {
    expect(GameConfig.physics).toBeDefined();
    expect(GameConfig.physics?.default).toBe('arcade');
  });

  it('should have zero gravity by default', () => {
    const physics = GameConfig.physics as any;
    expect(physics.arcade?.gravity?.x).toBe(0);
    expect(physics.arcade?.gravity?.y).toBe(0);
  });

  it('should have debug disabled in physics', () => {
    const physics = GameConfig.physics as any;
    expect(physics.arcade?.debug).toBe(false);
  });

  it('should include GameScene in scene array', () => {
    expect(GameConfig.scene).toBeDefined();
    expect(Array.isArray(GameConfig.scene)).toBe(true);
    expect((GameConfig.scene as any[]).length).toBeGreaterThan(0);
  });

  it('should have RESIZE scale mode', () => {
    expect(GameConfig.scale?.mode).toBe(Phaser.Scale.RESIZE);
  });

  it('creates runtime configs with the requested logical viewport size', () => {
    const mobileConfig = createGameConfig(844, 390);

    expect(mobileConfig.width).toBe(844);
    expect(mobileConfig.height).toBe(390);
    expect(mobileConfig.scale?.mode).toBe(Phaser.Scale.RESIZE);
    expect(mobileConfig.parent).toBe(GameConfig.parent);
    expect(mobileConfig.backgroundColor).toBe(GameConfig.backgroundColor);
    expect(mobileConfig.physics).toEqual(GameConfig.physics);
    expect(mobileConfig.scene).toEqual(GameConfig.scene);
  });

  it('should be a valid Phaser game config', () => {
    // Verify it can be used to create a game (without actually creating one in test)
    expect(GameConfig).toBeDefined();
    expect(typeof GameConfig).toBe('object');
    expect(GameConfig.type).toBeDefined();
    expect(GameConfig.scene).toBeDefined();
  });
});
