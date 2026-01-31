import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PlayerManager, type PlayerState } from './PlayerManager';
import * as Phaser from 'phaser';
import { ManualClock } from '../utils/Clock';

// DEPRECATED: Sprite-based weapon rendering replaced by procedural graphics
// See: ProceduralWeaponGraphics.test.ts
describe.skip('PlayerManager - Weapon Sprite Rendering', () => {
  let scene: Phaser.Scene;
  let playerManager: PlayerManager;
  let mockClock: ManualClock;
  let createdSprites: any[];

  beforeEach(() => {
    createdSprites = [];

    // Create mock sprite factory
    const createMockSprite = () => {
      const sprite = {
        x: 0,
        y: 0,
        setPosition: vi.fn().mockReturnThis(),
        setAlpha: vi.fn().mockReturnThis(),
        setAngle: vi.fn().mockReturnThis(),
        setTint: vi.fn().mockReturnThis(),
        clearTint: vi.fn().mockReturnThis(),
        setOrigin: vi.fn().mockReturnThis(),
        setRotation: vi.fn().mockReturnThis(),
        setFlipY: vi.fn().mockReturnThis(),
        setTexture: vi.fn().mockReturnThis(),
        destroy: vi.fn(),
        play: vi.fn().mockReturnThis(),
        anims: {
          currentAnim: null,
        },
      };
      createdSprites.push(sprite);
      return sprite;
    };

    // Create mock scene
    scene = {
      add: {
        sprite: vi.fn(() => createMockSprite()),
        text: vi.fn().mockReturnValue({
          setOrigin: vi.fn().mockReturnThis(),
          setPosition: vi.fn().mockReturnThis(),
          destroy: vi.fn(),
        }),
        line: vi.fn().mockReturnValue({
          setPosition: vi.fn().mockReturnThis(),
          setRotation: vi.fn().mockReturnThis(),
          setStrokeStyle: vi.fn().mockReturnThis(),
          setTo: vi.fn().mockReturnThis(),
          destroy: vi.fn(),
        }),
      },
      sys: {
        isActive: vi.fn().mockReturnValue(true),
      },
    } as any;

    mockClock = new ManualClock();
    playerManager = new PlayerManager(scene, mockClock);
  });

  describe('weapon sprite creation', () => {
    it('should create weapon sprite for new player', () => {
      const playerState: PlayerState = {
        id: 'player1',
        position: { x: 100, y: 200 },
        velocity: { x: 0, y: 0 },
        aimAngle: 0,
      };

      playerManager.updatePlayers([playerState]);

      // Should create 2 sprites: player sprite + weapon sprite
      expect(scene.add.sprite).toHaveBeenCalledTimes(2);
      expect(scene.add.sprite).toHaveBeenCalledWith(100, 200, 'player-walk');
      expect(scene.add.sprite).toHaveBeenCalledWith(100, 200, 'weapon-pistol');
    });

    it('should set weapon sprite origin to handle position', () => {
      const playerState: PlayerState = {
        id: 'player1',
        position: { x: 100, y: 200 },
        velocity: { x: 0, y: 0 },
        aimAngle: 0,
      };

      playerManager.updatePlayers([playerState]);

      // Second sprite is weapon sprite
      const weaponSprite = createdSprites[1];
      expect(weaponSprite.setOrigin).toHaveBeenCalledWith(0.2, 0.5);
    });
  });

  describe('weapon sprite rotation', () => {
    it('should rotate weapon based on aimAngle', () => {
      const playerState: PlayerState = {
        id: 'player1',
        position: { x: 100, y: 200 },
        velocity: { x: 0, y: 0 },
        aimAngle: Math.PI / 4, // 45 degrees
      };

      playerManager.updatePlayers([playerState]);

      // Weapon sprite should be rotated
      const weaponSprite = createdSprites[1];
      expect(weaponSprite.setRotation).toHaveBeenCalledWith(Math.PI / 4);
    });

    it('should flip weapon vertically when aiming left', () => {
      const playerState: PlayerState = {
        id: 'player1',
        position: { x: 100, y: 200 },
        velocity: { x: 0, y: 0 },
        aimAngle: Math.PI, // 180 degrees (aiming left)
      };

      playerManager.updatePlayers([playerState]);

      // Weapon sprite should be flipped
      const weaponSprite = createdSprites[1];
      expect(weaponSprite.setFlipY).toHaveBeenCalledWith(true);
    });

    it('should not flip weapon when aiming right', () => {
      const playerState: PlayerState = {
        id: 'player1',
        position: { x: 100, y: 200 },
        velocity: { x: 0, y: 0 },
        aimAngle: 0, // 0 degrees (aiming right)
      };

      playerManager.updatePlayers([playerState]);

      // Weapon sprite should not be flipped
      const weaponSprite = createdSprites[1];
      expect(weaponSprite.setFlipY).toHaveBeenCalledWith(false);
    });
  });

  describe('weapon sprite positioning', () => {
    it('should position weapon offset from player center', () => {
      const playerState: PlayerState = {
        id: 'player1',
        position: { x: 100, y: 200 },
        velocity: { x: 0, y: 0 },
        aimAngle: 0,
      };

      playerManager.updatePlayers([playerState]);

      // Weapon sprite should be positioned 10px in front of player
      const weaponSprite = createdSprites[1];
      expect(weaponSprite.setPosition).toHaveBeenCalledWith(110, 200);
    });

    it('should update weapon position when player moves', () => {
      const playerState: PlayerState = {
        id: 'player1',
        position: { x: 100, y: 200 },
        velocity: { x: 5, y: 0 },
        aimAngle: 0,
      };

      playerManager.updatePlayers([playerState]);

      // Move player
      playerState.position = { x: 150, y: 200 };
      playerManager.updatePlayers([playerState]);

      // Weapon sprite should follow player
      const weaponSprite = createdSprites[1];
      expect(weaponSprite.setPosition).toHaveBeenCalledWith(160, 200);
    });
  });

  describe('weapon type changes', () => {
    it('should update weapon sprite when weapon type changes', () => {
      const playerState: PlayerState = {
        id: 'player1',
        position: { x: 100, y: 200 },
        velocity: { x: 0, y: 0 },
        aimAngle: 0,
      };

      playerManager.updatePlayers([playerState]);

      // Change weapon type
      playerManager.updatePlayerWeapon('player1', 'Uzi');

      // Weapon sprite should be updated
      const weaponSprite = createdSprites[1];
      expect(weaponSprite.setTexture).toHaveBeenCalledWith('weapon-uzi');
    });

    it('should handle weapon type for all 6 weapons', () => {
      const weapons = ['Pistol', 'Bat', 'Katana', 'Uzi', 'AK47', 'Shotgun'];

      const playerState: PlayerState = {
        id: 'player1',
        position: { x: 100, y: 200 },
        velocity: { x: 0, y: 0 },
        aimAngle: 0,
      };

      playerManager.updatePlayers([playerState]);
      const weaponSprite = createdSprites[1];

      weapons.forEach(weapon => {
        playerManager.updatePlayerWeapon('player1', weapon);
        expect(weaponSprite.setTexture).toHaveBeenCalledWith(
          `weapon-${weapon.toLowerCase()}`
        );
      });
    });
  });

  describe('weapon sprite cleanup', () => {
    it('should destroy weapon sprite when player is removed', () => {
      const playerState: PlayerState = {
        id: 'player1',
        position: { x: 100, y: 200 },
        velocity: { x: 0, y: 0 },
        aimAngle: 0,
      };

      playerManager.updatePlayers([playerState]);

      const weaponSprite = createdSprites[1];

      // Remove player
      playerManager.updatePlayers([]);

      expect(weaponSprite.destroy).toHaveBeenCalled();
    });

    it('should destroy all weapon sprites on manager destroy', () => {
      const playerStates: PlayerState[] = [
        { id: 'player1', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 }, aimAngle: 0 },
        { id: 'player2', position: { x: 200, y: 300 }, velocity: { x: 0, y: 0 }, aimAngle: 0 },
      ];

      playerManager.updatePlayers(playerStates);

      const weapon1 = createdSprites[1];
      const weapon2 = createdSprites[3];

      playerManager.destroy();

      expect(weapon1.destroy).toHaveBeenCalled();
      expect(weapon2.destroy).toHaveBeenCalled();
    });
  });
});
