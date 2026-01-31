import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SpriteAssetManager } from './SpriteAssetManager';
import * as Phaser from 'phaser';

describe('SpriteAssetManager', () => {
  let mockScene: Phaser.Scene;
  let mockLoad: any;
  let mockAnims: any;

  beforeEach(() => {
    mockLoad = {
      spritesheet: vi.fn(),
      image: vi.fn(),
    };

    mockAnims = {
      create: vi.fn(),
      generateFrameNumbers: vi.fn().mockReturnValue([
        { key: 'player-walk', frame: 0 },
        { key: 'player-walk', frame: 1 },
        { key: 'player-walk', frame: 2 },
        { key: 'player-walk', frame: 3 },
      ]),
    };

    mockScene = {
      load: mockLoad,
      anims: mockAnims,
    } as any;
  });

  describe('preloadPlayerSprites', () => {
    it('should load player walk spritesheet', () => {
      SpriteAssetManager.preloadPlayerSprites(mockScene);

      expect(mockLoad.spritesheet).toHaveBeenCalledWith(
        'player-walk',
        'assets/sprites/player/player-walk.png',
        { frameWidth: 16, frameHeight: 32 }
      );
    });
  });

  describe('preloadWeaponSprites', () => {
    it('should load pistol sprite', () => {
      SpriteAssetManager.preloadWeaponSprites(mockScene);

      expect(mockLoad.image).toHaveBeenCalledWith(
        'weapon-pistol',
        'assets/sprites/weapons/pistol.png'
      );
    });

    it('should load bat sprite', () => {
      SpriteAssetManager.preloadWeaponSprites(mockScene);

      expect(mockLoad.image).toHaveBeenCalledWith(
        'weapon-bat',
        'assets/sprites/weapons/bat.png'
      );
    });

    it('should load katana sprite', () => {
      SpriteAssetManager.preloadWeaponSprites(mockScene);

      expect(mockLoad.image).toHaveBeenCalledWith(
        'weapon-katana',
        'assets/sprites/weapons/katana.png'
      );
    });

    it('should load uzi sprite', () => {
      SpriteAssetManager.preloadWeaponSprites(mockScene);

      expect(mockLoad.image).toHaveBeenCalledWith(
        'weapon-uzi',
        'assets/sprites/weapons/uzi.png'
      );
    });

    it('should load ak47 sprite', () => {
      SpriteAssetManager.preloadWeaponSprites(mockScene);

      expect(mockLoad.image).toHaveBeenCalledWith(
        'weapon-ak47',
        'assets/sprites/weapons/ak47.png'
      );
    });

    it('should load shotgun sprite', () => {
      SpriteAssetManager.preloadWeaponSprites(mockScene);

      expect(mockLoad.image).toHaveBeenCalledWith(
        'weapon-shotgun',
        'assets/sprites/weapons/shotgun.png'
      );
    });

    it('should load all 6 weapon sprites', () => {
      SpriteAssetManager.preloadWeaponSprites(mockScene);

      expect(mockLoad.image).toHaveBeenCalledTimes(6);
    });
  });

  describe('createPlayerAnimations', () => {
    it('should create player-walk animation', () => {
      SpriteAssetManager.createPlayerAnimations(mockScene);

      expect(mockAnims.create).toHaveBeenCalledWith({
        key: 'player-walk',
        frames: expect.any(Array),
        frameRate: 10,
        repeat: -1,
      });
    });

    it('should generate frames 0-3 for walk animation', () => {
      SpriteAssetManager.createPlayerAnimations(mockScene);

      expect(mockAnims.generateFrameNumbers).toHaveBeenCalledWith(
        'player-walk',
        { start: 0, end: 3 }
      );
    });
  });

  describe('getWeaponSpriteKey', () => {
    it('should return correct sprite key for Pistol', () => {
      const key = SpriteAssetManager.getWeaponSpriteKey('Pistol');
      expect(key).toBe('weapon-pistol');
    });

    it('should return correct sprite key for Bat', () => {
      const key = SpriteAssetManager.getWeaponSpriteKey('Bat');
      expect(key).toBe('weapon-bat');
    });

    it('should return correct sprite key for Katana', () => {
      const key = SpriteAssetManager.getWeaponSpriteKey('Katana');
      expect(key).toBe('weapon-katana');
    });

    it('should return correct sprite key for Uzi', () => {
      const key = SpriteAssetManager.getWeaponSpriteKey('Uzi');
      expect(key).toBe('weapon-uzi');
    });

    it('should return correct sprite key for AK47', () => {
      const key = SpriteAssetManager.getWeaponSpriteKey('AK47');
      expect(key).toBe('weapon-ak47');
    });

    it('should return correct sprite key for Shotgun', () => {
      const key = SpriteAssetManager.getWeaponSpriteKey('Shotgun');
      expect(key).toBe('weapon-shotgun');
    });

    it('should return pistol as default for unknown weapon', () => {
      const key = SpriteAssetManager.getWeaponSpriteKey('UnknownWeapon');
      expect(key).toBe('weapon-pistol');
    });
  });
});
