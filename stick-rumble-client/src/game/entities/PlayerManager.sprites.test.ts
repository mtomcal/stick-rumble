import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PlayerManager, type PlayerState } from './PlayerManager';
import * as Phaser from 'phaser';
import { ManualClock } from '../utils/Clock';

describe('PlayerManager - Sprite Rendering', () => {
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

  describe('sprite creation', () => {
    it('should create sprite instead of rectangle for new player', () => {
      const playerState: PlayerState = {
        id: 'player1',
        position: { x: 100, y: 200 },
        velocity: { x: 0, y: 0 },
      };

      playerManager.updatePlayers([playerState]);

      expect(scene.add.sprite).toHaveBeenCalledWith(100, 200, 'player-walk');
    });

    it('should create sprite for local player', () => {
      playerManager.setLocalPlayerId('local-player');

      const playerState: PlayerState = {
        id: 'local-player',
        position: { x: 150, y: 250 },
        velocity: { x: 0, y: 0 },
      };

      playerManager.updatePlayers([playerState]);

      expect(scene.add.sprite).toHaveBeenCalledWith(150, 250, 'player-walk');
    });
  });

  describe('animation state machine', () => {
    it('should play walk animation when player is moving', () => {
      const playerState: PlayerState = {
        id: 'player1',
        position: { x: 100, y: 200 },
        velocity: { x: 5, y: 0 }, // Moving right
      };

      playerManager.updatePlayers([playerState]);

      // First sprite is player sprite
      const playerSprite = createdSprites[0];
      expect(playerSprite.play).toHaveBeenCalledWith('player-walk', true);
    });

    it('should not restart animation if already playing', () => {
      const playerState: PlayerState = {
        id: 'player1',
        position: { x: 100, y: 200 },
        velocity: { x: 5, y: 0 },
      };

      // First update
      playerManager.updatePlayers([playerState]);
      const playerSprite = createdSprites[0];
      const firstCallCount = playerSprite.play.mock.calls.length;

      // Second update with same state
      playerSprite.anims.currentAnim = { key: 'player-walk' };
      playerManager.updatePlayers([playerState]);

      // Play should only be called once (with ignoreIfPlaying=true)
      expect(playerSprite.play).toHaveBeenCalledTimes(firstCallCount);
    });

    it('should use idle pose when velocity is zero', () => {
      const playerState: PlayerState = {
        id: 'player1',
        position: { x: 100, y: 200 },
        velocity: { x: 0, y: 0 }, // Not moving
      };

      playerManager.updatePlayers([playerState]);

      // First sprite is player sprite
      const playerSprite = createdSprites[0];
      // For MVP, idle uses first frame of walk animation
      expect(playerSprite.play).toHaveBeenCalledWith('player-walk', true);
    });

    it('should detect movement with small velocity threshold', () => {
      const playerState: PlayerState = {
        id: 'player1',
        position: { x: 100, y: 200 },
        velocity: { x: 0.05, y: 0.05 }, // Very small movement
      };

      playerManager.updatePlayers([playerState]);

      // First sprite is player sprite
      const playerSprite = createdSprites[0];
      // Should still play walk animation for tiny movements
      expect(playerSprite.play).toHaveBeenCalledWith('player-walk', true);
    });
  });

  describe('dodge roll animation', () => {
    it('should apply rotation during dodge roll', () => {
      mockClock.reset(0);

      const playerState: PlayerState = {
        id: 'player1',
        position: { x: 100, y: 200 },
        velocity: { x: 5, y: 0 },
        isRolling: true,
      };

      playerManager.updatePlayers([playerState]);

      const playerSprite = createdSprites[0];
      expect(playerSprite.setAngle).toHaveBeenCalled();
    });

    it('should set transparency during dodge roll', () => {
      const playerState: PlayerState = {
        id: 'player1',
        position: { x: 100, y: 200 },
        velocity: { x: 5, y: 0 },
        isRolling: true,
      };

      playerManager.updatePlayers([playerState]);

      const playerSprite = createdSprites[0];
      expect(playerSprite.setAlpha).toHaveBeenCalledWith(0.5);
    });

    it('should reset rotation after dodge roll ends', () => {
      const playerState: PlayerState = {
        id: 'player1',
        position: { x: 100, y: 200 },
        velocity: { x: 5, y: 0 },
        isRolling: false,
      };

      playerManager.updatePlayers([playerState]);

      expect(createdSprites[0].setAngle).toHaveBeenCalledWith(0);
    });

    it('should reset alpha after dodge roll ends', () => {
      const playerState: PlayerState = {
        id: 'player1',
        position: { x: 100, y: 200 },
        velocity: { x: 5, y: 0 },
        isRolling: false,
      };

      playerManager.updatePlayers([playerState]);

      expect(createdSprites[0].setAlpha).toHaveBeenCalledWith(1);
    });
  });

  describe('death animation', () => {
    it('should apply gray tint when player is dead', () => {
      const playerState: PlayerState = {
        id: 'player1',
        position: { x: 100, y: 200 },
        velocity: { x: 0, y: 0 },
        deathTime: Date.now(),
      };

      playerManager.updatePlayers([playerState]);

      expect(createdSprites[0].setAlpha).toHaveBeenCalledWith(0.5);
      expect(createdSprites[0].setTint).toHaveBeenCalledWith(0x888888);
    });

    it('should clear tint when player respawns', () => {
      const playerState: PlayerState = {
        id: 'player1',
        position: { x: 100, y: 200 },
        velocity: { x: 0, y: 0 },
        deathTime: undefined, // Alive again
      };

      playerManager.updatePlayers([playerState]);

      expect(createdSprites[0].clearTint).toHaveBeenCalled();
    });
  });

  describe('sprite positioning', () => {
    it('should update sprite position when player moves', () => {
      const initialState: PlayerState = {
        id: 'player1',
        position: { x: 100, y: 200 },
        velocity: { x: 5, y: 0 },
      };

      playerManager.updatePlayers([initialState]);

      const updatedState: PlayerState = {
        id: 'player1',
        position: { x: 150, y: 200 },
        velocity: { x: 5, y: 0 },
      };

      playerManager.updatePlayers([updatedState]);

      expect(createdSprites[0].setPosition).toHaveBeenCalledWith(150, 200);
    });
  });
});
