/**
 * SpriteAssetManager - Centralized sprite and animation management
 *
 * Handles loading and configuration of all sprite assets in the game.
 * Follows the AudioManager pattern for consistency.
 */

import * as Phaser from 'phaser';

/**
 * Configuration for player sprite assets
 */
const PLAYER_SPRITE_CONFIG = {
  walk: {
    key: 'player-walk',
    path: 'assets/sprites/player/player-walk.png',
    frameWidth: 16,
    frameHeight: 32,
  },
};

/**
 * Configuration for weapon sprite assets
 */
const WEAPON_SPRITE_PATHS: Record<string, string> = {
  Pistol: 'assets/sprites/weapons/pistol.png',
  Bat: 'assets/sprites/weapons/bat.png',
  Katana: 'assets/sprites/weapons/katana.png',
  Uzi: 'assets/sprites/weapons/uzi.png',
  AK47: 'assets/sprites/weapons/ak47.png',
  Shotgun: 'assets/sprites/weapons/shotgun.png',
};

/**
 * Configuration for player animations
 */
const PLAYER_ANIMATION_CONFIG = {
  walk: {
    key: 'player-walk',
    spriteKey: 'player-walk',
    startFrame: 0,
    endFrame: 3,
    frameRate: 10, // 10 FPS as per acceptance criteria
    repeat: -1, // Loop infinitely
  },
};

/**
 * SpriteAssetManager provides centralized sprite loading and animation creation.
 *
 * Usage in GameScene:
 * ```typescript
 * preload() {
 *   SpriteAssetManager.preloadPlayerSprites(this);
 *   SpriteAssetManager.preloadWeaponSprites(this);
 * }
 *
 * create() {
 *   SpriteAssetManager.createPlayerAnimations(this);
 * }
 * ```
 */
export class SpriteAssetManager {
  /**
   * Preload player sprite sheets
   * @param scene Phaser scene to load assets into
   */
  static preloadPlayerSprites(scene: Phaser.Scene): void {
    const config = PLAYER_SPRITE_CONFIG.walk;
    scene.load.spritesheet(config.key, config.path, {
      frameWidth: config.frameWidth,
      frameHeight: config.frameHeight,
    });
  }

  /**
   * Preload all weapon sprites
   * @param scene Phaser scene to load assets into
   */
  static preloadWeaponSprites(scene: Phaser.Scene): void {
    Object.entries(WEAPON_SPRITE_PATHS).forEach(([weaponType, path]) => {
      const key = `weapon-${weaponType.toLowerCase()}`;
      scene.load.image(key, path);
    });
  }

  /**
   * Create player animations
   * @param scene Phaser scene to create animations in
   */
  static createPlayerAnimations(scene: Phaser.Scene): void {
    const config = PLAYER_ANIMATION_CONFIG.walk;

    scene.anims.create({
      key: config.key,
      frames: scene.anims.generateFrameNumbers(config.spriteKey, {
        start: config.startFrame,
        end: config.endFrame,
      }),
      frameRate: config.frameRate,
      repeat: config.repeat,
    });
  }

  /**
   * Get the sprite key for a weapon type
   * @param weaponType Weapon type (e.g., 'Pistol', 'Uzi')
   * @returns Sprite key to use with Phaser (e.g., 'weapon-pistol')
   */
  static getWeaponSpriteKey(weaponType: string): string {
    const normalizedType = weaponType.toLowerCase();

    // Check if weapon type exists
    const weaponExists = Object.keys(WEAPON_SPRITE_PATHS).some(
      key => key.toLowerCase() === normalizedType
    );

    if (weaponExists) {
      return `weapon-${normalizedType}`;
    }

    // Default to pistol if weapon type unknown
    return 'weapon-pistol';
  }
}
