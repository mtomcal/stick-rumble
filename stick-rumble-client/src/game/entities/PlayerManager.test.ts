import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlayerManager, type PlayerState } from './PlayerManager';
import { ManualClock } from '../utils/Clock';

// Create mock Phaser scene
const createMockScene = () => {
  const sprites: Array<{
    x: number;
    y: number;
    setPosition: ReturnType<typeof vi.fn>;
    setAlpha: ReturnType<typeof vi.fn>;
    setAngle: ReturnType<typeof vi.fn>;
    setTint: ReturnType<typeof vi.fn>;
    clearTint: ReturnType<typeof vi.fn>;
    setOrigin: ReturnType<typeof vi.fn>;
    setRotation: ReturnType<typeof vi.fn>;
    setFlipY: ReturnType<typeof vi.fn>;
    setTexture: ReturnType<typeof vi.fn>;
    play: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
  }> = [];

  const texts: Array<{
    x: number;
    y: number;
    setOrigin: ReturnType<typeof vi.fn>;
    setPosition: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
  }> = [];

  const lines: Array<{
    setTo: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
  }> = [];

  return {
    sys: {
      isActive: vi.fn().mockReturnValue(true),
    },
    add: {
      sprite: vi.fn((x: number, y: number) => {
        const sprite = {
          x,
          y,
          setPosition: vi.fn(),
          setAlpha: vi.fn().mockReturnThis(),
          setAngle: vi.fn().mockReturnThis(),
          setTint: vi.fn().mockReturnThis(),
          clearTint: vi.fn().mockReturnThis(),
          setOrigin: vi.fn().mockReturnThis(),
          setRotation: vi.fn().mockReturnThis(),
          setFlipY: vi.fn().mockReturnThis(),
          setTexture: vi.fn().mockReturnThis(),
          play: vi.fn().mockReturnThis(),
          destroy: vi.fn(),
        };
        sprites.push(sprite);
        return sprite;
      }),
      text: vi.fn((x: number, y: number) => {
        const text = {
          x,
          y,
          setOrigin: vi.fn().mockReturnThis(),
          setPosition: vi.fn(),
          destroy: vi.fn(),
        };
        texts.push(text);
        return text;
      }),
      line: vi.fn(() => {
        const line = {
          setTo: vi.fn(),
          destroy: vi.fn(),
        };
        lines.push(line);
        return line;
      }),
    },
    sprites,
    texts,
    lines,
  };
};

describe('PlayerManager', () => {
  let playerManager: PlayerManager;
  let mockScene: ReturnType<typeof createMockScene>;
  let clock: ManualClock;

  beforeEach(() => {
    mockScene = createMockScene();
    clock = new ManualClock();
    playerManager = new PlayerManager(mockScene as unknown as Phaser.Scene, clock);
  });

  describe('constructor', () => {
    it('should initialize without errors', () => {
      expect(playerManager).toBeDefined();
    });

    it('should use injected clock', () => {
      const injectedClock = playerManager.getClock();
      expect(injectedClock).toBe(clock);
      expect(injectedClock.now()).toBe(0); // ManualClock starts at 0
    });

    it('should advance clock time when clock.advance() is called', () => {
      clock.advance(1000);
      expect(playerManager.getClock().now()).toBe(1000);
    });
  });

  describe('setLocalPlayerId', () => {
    it('should set the local player ID', () => {
      playerManager.setLocalPlayerId('player-123');
      expect(playerManager.getLocalPlayerId()).toBe('player-123');
    });
  });

  describe('updatePlayers', () => {
    it('should handle invalid scene gracefully', () => {
      // Scene without sys.isActive() returns early from isSceneValid() guard
      const sceneWithoutSys = {} as Phaser.Scene;

      const manager = new PlayerManager(sceneWithoutSys);
      const playerStates: PlayerState[] = [
        { id: 'player-1', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 } },
      ];

      // Should not throw, just skip player creation due to scene validation
      expect(() => manager.updatePlayers(playerStates)).not.toThrow();
    });

    it('should create player sprites for new players', () => {
      const playerStates: PlayerState[] = [
        { id: 'player-1', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 } },
      ];

      playerManager.updatePlayers(playerStates);

      expect(mockScene.add.sprite).toHaveBeenCalledWith(
        100, 200, 'player-walk'
      );
      expect(mockScene.add.text).toHaveBeenCalledWith(
        100,
        158, // y: 200 - 64/2 - 10 = 158
        'Player',
        expect.objectContaining({
          fontSize: '14px',
          color: '#ffffff',
        })
      );
    });

    it('should create local player with green color (0x00ff00)', () => {
      playerManager.setLocalPlayerId('local-player');

      const playerStates: PlayerState[] = [
        { id: 'local-player', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 } },
      ];

      playerManager.updatePlayers(playerStates);

      expect(mockScene.add.sprite).toHaveBeenCalledWith(
        100, 200, 'player-walk'
      );
      expect(mockScene.sprites[0].setTint).toHaveBeenCalledWith(0x00ff00);
    });

    it('should create remote player with red color (0xff0000)', () => {
      playerManager.setLocalPlayerId('local-player');

      const playerStates: PlayerState[] = [
        { id: 'remote-player', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 } },
      ];

      playerManager.updatePlayers(playerStates);

      expect(mockScene.add.sprite).toHaveBeenCalledWith(
        100, 200, 'player-walk'
      );
      expect(mockScene.sprites[0].setTint).toHaveBeenCalledWith(0xff0000);
    });

    it('should add "You" label for local player', () => {
      playerManager.setLocalPlayerId('local-player');

      const playerStates: PlayerState[] = [
        { id: 'local-player', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 } },
      ];

      playerManager.updatePlayers(playerStates);

      expect(mockScene.add.text).toHaveBeenCalledWith(
        100,
        158, // y: 200 - 64/2 - 10 = 158
        'You',
        expect.objectContaining({
          fontSize: '14px',
          color: '#ffffff',
        })
      );
    });

    it('should add "Player" label for remote player', () => {
      playerManager.setLocalPlayerId('local-player');

      const playerStates: PlayerState[] = [
        { id: 'remote-player', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 } },
      ];

      playerManager.updatePlayers(playerStates);

      expect(mockScene.add.text).toHaveBeenCalledWith(
        100,
        158, // y: 200 - 64/2 - 10 = 158
        'Player',
        expect.objectContaining({
          fontSize: '14px',
          color: '#ffffff',
        })
      );
    });

    it('should update existing player positions', () => {
      const initialStates: PlayerState[] = [
        { id: 'player-1', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 } },
      ];

      playerManager.updatePlayers(initialStates);

      const sprite = mockScene.sprites[0];

      const updatedStates: PlayerState[] = [
        { id: 'player-1', position: { x: 300, y: 400 }, velocity: { x: 0, y: 0 } },
      ];

      playerManager.updatePlayers(updatedStates);

      expect(sprite.setPosition).toHaveBeenCalledWith(300, 400);
    });

    it('should update label positions when player moves', () => {
      const initialStates: PlayerState[] = [
        { id: 'player-1', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 } },
      ];

      playerManager.updatePlayers(initialStates);

      const label = mockScene.texts[0];

      const updatedStates: PlayerState[] = [
        { id: 'player-1', position: { x: 300, y: 400 }, velocity: { x: 0, y: 0 } },
      ];

      playerManager.updatePlayers(updatedStates);

      expect(label.setPosition).toHaveBeenCalledWith(300, 358); // y: 400 - 64/2 - 10 = 358
    });

    it('should remove players that no longer exist', () => {
      const initialStates: PlayerState[] = [
        { id: 'player-1', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 } },
        { id: 'player-2', position: { x: 300, y: 400 }, velocity: { x: 0, y: 0 } },
      ];

      playerManager.updatePlayers(initialStates);

      const player1Sprite = mockScene.sprites[0];
      const player1Label = mockScene.texts[0];

      // Update with only player-2
      const updatedStates: PlayerState[] = [
        { id: 'player-2', position: { x: 300, y: 400 }, velocity: { x: 0, y: 0 } },
      ];

      playerManager.updatePlayers(updatedStates);

      expect(player1Sprite.destroy).toHaveBeenCalled();
      expect(player1Label.destroy).toHaveBeenCalled();
    });

    it('should handle multiple players', () => {
      const playerStates: PlayerState[] = [
        { id: 'player-1', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 } },
        { id: 'player-2', position: { x: 300, y: 400 }, velocity: { x: 0, y: 0 } },
        { id: 'player-3', position: { x: 500, y: 600 }, velocity: { x: 0, y: 0 } },
      ];

      playerManager.updatePlayers(playerStates);

      // Each player creates 2 sprites: player + weapon
      expect(mockScene.add.sprite).toHaveBeenCalledTimes(6);
      expect(mockScene.add.text).toHaveBeenCalledTimes(3);
    });

    it('should not create duplicate sprites for same player', () => {
      const playerStates: PlayerState[] = [
        { id: 'player-1', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 } },
      ];

      playerManager.updatePlayers(playerStates);
      playerManager.updatePlayers(playerStates);
      playerManager.updatePlayers(playerStates);

      // Each player creates 2 sprites: player + weapon
      expect(mockScene.add.sprite).toHaveBeenCalledTimes(2);
      expect(mockScene.add.text).toHaveBeenCalledTimes(1);
    });

    it('should handle empty player list', () => {
      // First add some players
      const playerStates: PlayerState[] = [
        { id: 'player-1', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 } },
      ];

      playerManager.updatePlayers(playerStates);

      const sprite = mockScene.sprites[0];
      const label = mockScene.texts[0];

      // Then update with empty list
      playerManager.updatePlayers([]);

      expect(sprite.destroy).toHaveBeenCalled();
      expect(label.destroy).toHaveBeenCalled();
    });
  });

  describe('destroy', () => {
    it('should destroy all player sprites', () => {
      const playerStates: PlayerState[] = [
        { id: 'player-1', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 } },
        { id: 'player-2', position: { x: 300, y: 400 }, velocity: { x: 0, y: 0 } },
      ];

      playerManager.updatePlayers(playerStates);

      playerManager.destroy();

      for (const rect of mockScene.sprites) {
        expect(rect.destroy).toHaveBeenCalled();
      }
    });

    it('should destroy all player labels', () => {
      const playerStates: PlayerState[] = [
        { id: 'player-1', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 } },
        { id: 'player-2', position: { x: 300, y: 400 }, velocity: { x: 0, y: 0 } },
      ];

      playerManager.updatePlayers(playerStates);

      playerManager.destroy();

      for (const text of mockScene.texts) {
        expect(text.destroy).toHaveBeenCalled();
      }
    });

    it('should handle destroy when no players exist', () => {
      expect(() => playerManager.destroy()).not.toThrow();
    });
  });

  describe('aim indicator', () => {
    it('should create aim indicator line for new players', () => {
      const playerStates: PlayerState[] = [
        { id: 'player-1', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 }, aimAngle: 0 },
      ];

      playerManager.updatePlayers(playerStates);

      expect(mockScene.add.line).toHaveBeenCalled();
    });

    it('should update aim indicator based on aim angle', () => {
      const playerStates: PlayerState[] = [
        { id: 'player-1', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 }, aimAngle: 0 },
      ];

      playerManager.updatePlayers(playerStates);

      const line = mockScene.lines[0];

      // Update with new aim angle (pointing right, angle = 0)
      const updatedStates: PlayerState[] = [
        { id: 'player-1', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 }, aimAngle: 0 },
      ];

      playerManager.updatePlayers(updatedStates);

      // Line should be updated from player center to point in aim direction
      // For angle = 0 (pointing right), line should extend 50px to the right
      // Expected: setTo(100, 200, 100 + 50*cos(0), 200 + 50*sin(0)) = setTo(100, 200, 150, 200)
      expect(line.setTo).toHaveBeenCalled();
      const lastCall = line.setTo.mock.calls[line.setTo.mock.calls.length - 1];
      expect(lastCall[0]).toBe(100); // x1: player x
      expect(lastCall[1]).toBe(200); // y1: player y
      expect(lastCall[2]).toBeCloseTo(150, 1); // x2: player x + 50*cos(0)
      expect(lastCall[3]).toBeCloseTo(200, 1); // y2: player y + 50*sin(0)
    });

    it('should update aim indicator when aim angle changes', () => {
      const playerStates: PlayerState[] = [
        { id: 'player-1', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 }, aimAngle: 0 },
      ];

      playerManager.updatePlayers(playerStates);

      const line = mockScene.lines[0];

      // Update with different aim angle (pointing up, angle = -PI/2)
      const updatedStates: PlayerState[] = [
        { id: 'player-1', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 }, aimAngle: -Math.PI / 2 },
      ];

      playerManager.updatePlayers(updatedStates);

      // For angle = -PI/2 (pointing up), line should extend 50px upward (negative Y)
      // Expected: setTo(100, 200, 100 + 50*cos(-PI/2), 200 + 50*sin(-PI/2)) = setTo(100, 200, 100, 150)
      expect(line.setTo).toHaveBeenCalled();
      const lastCall = line.setTo.mock.calls[line.setTo.mock.calls.length - 1];
      expect(lastCall[0]).toBe(100); // x1: player x
      expect(lastCall[1]).toBe(200); // y1: player y
      expect(lastCall[2]).toBeCloseTo(100, 1); // x2: player x + 50*cos(-PI/2) ≈ 100
      expect(lastCall[3]).toBeCloseTo(150, 1); // y2: player y + 50*sin(-PI/2) = 200 - 50
    });

    it('should destroy aim indicator when player is removed', () => {
      const playerStates: PlayerState[] = [
        { id: 'player-1', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 }, aimAngle: 0 },
      ];

      playerManager.updatePlayers(playerStates);

      const line = mockScene.lines[0];

      // Remove player
      playerManager.updatePlayers([]);

      expect(line.destroy).toHaveBeenCalled();
    });

    it('should handle players without aim angle (defaults to 0)', () => {
      // Test backward compatibility - players without aimAngle field
      const playerStates: PlayerState[] = [
        { id: 'player-1', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 } },
      ];

      expect(() => playerManager.updatePlayers(playerStates)).not.toThrow();
      expect(mockScene.add.line).toHaveBeenCalled();
    });

    it('should destroy aim indicators on manager destroy', () => {
      const playerStates: PlayerState[] = [
        { id: 'player-1', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 }, aimAngle: 0 },
      ];

      playerManager.updatePlayers(playerStates);

      playerManager.destroy();

      for (const line of mockScene.lines) {
        expect(line.destroy).toHaveBeenCalled();
      }
    });
  });

  describe('death state', () => {
    it('should mark player as dead when deathTime is provided', () => {
      const aliveState: PlayerState[] = [
        { id: 'player-1', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 } },
      ];

      playerManager.updatePlayers(aliveState);

      // Mark as dead
      const deadState: PlayerState[] = [
        { id: 'player-1', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 }, deathTime: clock.now() },
      ];

      expect(() => playerManager.updatePlayers(deadState)).not.toThrow();
    });

    it('should apply death visual effects (fade + gray) to dead players', () => {
      const aliveState: PlayerState[] = [
        { id: 'player-1', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 } },
      ];

      playerManager.updatePlayers(aliveState);

      const sprite = mockScene.sprites[0];
      const setAlphaSpy = vi.fn();
      const setTintSpy = vi.fn();
      sprite.setAlpha = setAlphaSpy;
      sprite.setTint = setTintSpy;

      // Mark as dead
      const deadState: PlayerState[] = [
        { id: 'player-1', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 }, deathTime: clock.now() },
      ];

      playerManager.updatePlayers(deadState);

      expect(setAlphaSpy).toHaveBeenCalledWith(0.5);
      expect(setTintSpy).toHaveBeenCalledWith(0x888888);
    });

    it('should restore visual effects when player respawns', () => {
      const deadState: PlayerState[] = [
        { id: 'player-1', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 }, deathTime: clock.now() },
      ];

      playerManager.updatePlayers(deadState);

      const sprite = mockScene.sprites[0];
      const setAlphaSpy = vi.fn();
      const setTintSpy = vi.fn();
      sprite.setAlpha = setAlphaSpy;
      sprite.setTint = setTintSpy;

      // Respawn (deathTime removed)
      const aliveState: PlayerState[] = [
        { id: 'player-1', position: { x: 500, y: 300 }, velocity: { x: 0, y: 0 } },
      ];

      playerManager.updatePlayers(aliveState);

      expect(setAlphaSpy).toHaveBeenCalledWith(1.0);
      expect(setTintSpy).toHaveBeenCalledWith(0xff0000); // Red for non-local player
    });

    it('should return list of living players excluding dead ones', () => {
      const playerStates: PlayerState[] = [
        { id: 'player-1', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 } },
        { id: 'player-2', position: { x: 300, y: 400 }, velocity: { x: 0, y: 0 }, deathTime: clock.now() },
        { id: 'player-3', position: { x: 500, y: 600 }, velocity: { x: 0, y: 0 } },
      ];

      playerManager.updatePlayers(playerStates);

      const livingPlayers = playerManager.getLivingPlayers();

      expect(livingPlayers).toHaveLength(2);
      expect(livingPlayers).toContainEqual({ id: 'player-1', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 } });
      expect(livingPlayers).toContainEqual({ id: 'player-3', position: { x: 500, y: 600 }, velocity: { x: 0, y: 0 } });
    });

    it('should return empty array when no living players exist', () => {
      const playerStates: PlayerState[] = [
        { id: 'player-1', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 }, deathTime: clock.now() },
        { id: 'player-2', position: { x: 300, y: 400 }, velocity: { x: 0, y: 0 }, deathTime: clock.now() },
      ];

      playerManager.updatePlayers(playerStates);

      const livingPlayers = playerManager.getLivingPlayers();

      expect(livingPlayers).toHaveLength(0);
    });

    it('should check if local player is dead', () => {
      playerManager.setLocalPlayerId('player-1');

      const aliveState: PlayerState[] = [
        { id: 'player-1', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 } },
      ];

      playerManager.updatePlayers(aliveState);

      expect(playerManager.isLocalPlayerDead()).toBe(false);

      const deadState: PlayerState[] = [
        { id: 'player-1', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 }, deathTime: clock.now() },
      ];

      playerManager.updatePlayers(deadState);

      expect(playerManager.isLocalPlayerDead()).toBe(true);
    });

    it('should return false for isLocalPlayerDead when no local player', () => {
      expect(playerManager.isLocalPlayerDead()).toBe(false);
    });
  });

  describe('getLocalPlayerSprite', () => {
    it('should return null when no local player ID is set', () => {
      expect(playerManager.getLocalPlayerSprite()).toBeNull();
    });

    it('should return null when local player sprite does not exist', () => {
      playerManager.setLocalPlayerId('local-player');
      expect(playerManager.getLocalPlayerSprite()).toBeNull();
    });

    it('should return the local player sprite when it exists', () => {
      playerManager.setLocalPlayerId('local-player');

      const playerStates: PlayerState[] = [
        { id: 'local-player', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 } },
      ];

      playerManager.updatePlayers(playerStates);

      const sprite = playerManager.getLocalPlayerSprite();
      expect(sprite).not.toBeNull();
      expect(sprite?.x).toBe(100);
      expect(sprite?.y).toBe(200);
    });

    it('should return null after local player is removed', () => {
      playerManager.setLocalPlayerId('local-player');

      const playerStates: PlayerState[] = [
        { id: 'local-player', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 } },
      ];

      playerManager.updatePlayers(playerStates);

      // Remove local player
      playerManager.updatePlayers([]);

      expect(playerManager.getLocalPlayerSprite()).toBeNull();
    });
  });

  describe('updateLocalPlayerAim', () => {
    it('should update local player aim indicator immediately', () => {
      playerManager.setLocalPlayerId('local-player');

      const playerStates: PlayerState[] = [
        { id: 'local-player', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 }, aimAngle: 0 },
      ];

      playerManager.updatePlayers(playerStates);

      const line = mockScene.lines[0];
      const setToSpy = vi.fn();
      line.setTo = setToSpy;

      // Update aim angle to point up (90 degrees = PI/2 radians)
      const newAimAngle = Math.PI / 2;
      playerManager.updateLocalPlayerAim(newAimAngle);

      expect(setToSpy).toHaveBeenCalledWith(
        100, 200, // Start position (player position)
        100, 200 + 50, // End position (pointing up, 50 pixels)
      );
    });

    it('should do nothing if local player ID is not set', () => {
      const playerStates: PlayerState[] = [
        { id: 'player-1', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 }, aimAngle: 0 },
      ];

      playerManager.updatePlayers(playerStates);

      const line = mockScene.lines[0];
      const setToSpy = vi.fn();
      line.setTo = setToSpy;

      playerManager.updateLocalPlayerAim(Math.PI / 2);

      expect(setToSpy).not.toHaveBeenCalled();
    });

    it('should do nothing if local player does not exist', () => {
      playerManager.setLocalPlayerId('non-existent');

      playerManager.updateLocalPlayerAim(Math.PI / 2);

      // Should not throw error, just silently skip
      expect(mockScene.lines).toHaveLength(0);
    });

    it('should correctly calculate aim line end position for different angles', () => {
      playerManager.setLocalPlayerId('local-player');

      const playerStates: PlayerState[] = [
        { id: 'local-player', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 }, aimAngle: 0 },
      ];

      playerManager.updatePlayers(playerStates);

      const line = mockScene.lines[0];
      const setToSpy = vi.fn();
      line.setTo = setToSpy;

      // Test pointing right (0 radians)
      playerManager.updateLocalPlayerAim(0);
      expect(setToSpy).toHaveBeenCalledWith(100, 200, 150, 200);

      // Test pointing left (PI radians)
      playerManager.updateLocalPlayerAim(Math.PI);
      expect(setToSpy).toHaveBeenCalledWith(100, 200, 50, 200);

      // Test pointing down (PI/2 radians)
      playerManager.updateLocalPlayerAim(Math.PI / 2);
      expect(setToSpy).toHaveBeenCalledWith(100, 200, 100, 250);

      // Test pointing up (-PI/2 radians)
      playerManager.updateLocalPlayerAim(-Math.PI / 2);
      expect(setToSpy).toHaveBeenCalledWith(100, 200, 100, 150);
    });
  });

  describe('getPlayerPosition', () => {
    it('should return player position when player exists', () => {
      const playerStates: PlayerState[] = [
        { id: 'player-1', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 } },
      ];

      playerManager.updatePlayers(playerStates);

      const position = playerManager.getPlayerPosition('player-1');

      expect(position).toEqual({ x: 100, y: 200 });
    });

    it('should return null when player does not exist', () => {
      const playerStates: PlayerState[] = [
        { id: 'player-1', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 } },
      ];

      playerManager.updatePlayers(playerStates);

      const position = playerManager.getPlayerPosition('non-existent');

      expect(position).toBeNull();
    });

    it('should return null when no players exist', () => {
      const position = playerManager.getPlayerPosition('any-id');

      expect(position).toBeNull();
    });
  });

  describe('dodge roll visual effects', () => {
    it('should apply 360° rotation animation when player is rolling', () => {
      playerManager.setLocalPlayerId('player-1');

      const rollingState: PlayerState[] = [
        {
          id: 'player-1',
          position: { x: 100, y: 200 },
          velocity: { x: 0, y: 0 },
          isRolling: true
        },
      ];

      playerManager.updatePlayers(rollingState);

      const sprite = mockScene.sprites[0];
      expect(sprite.setAngle).toHaveBeenCalled();
    });

    it('should apply transparency (alpha 0.5) during invincibility frames when rolling', () => {
      playerManager.setLocalPlayerId('player-1');

      // Player rolling (first 0.2s = i-frames)
      const rollingState: PlayerState[] = [
        {
          id: 'player-1',
          position: { x: 100, y: 200 },
          velocity: { x: 0, y: 0 },
          isRolling: true
        },
      ];

      playerManager.updatePlayers(rollingState);

      const sprite = mockScene.sprites[0];
      // During i-frames, alpha should be 0.5
      expect(sprite.setAlpha).toHaveBeenCalledWith(0.5);
    });

    it('should restore alpha to 1.0 when roll ends', () => {
      playerManager.setLocalPlayerId('player-1');

      // Start rolling
      const rollingState: PlayerState[] = [
        {
          id: 'player-1',
          position: { x: 100, y: 200 },
          velocity: { x: 0, y: 0 },
          isRolling: true
        },
      ];

      playerManager.updatePlayers(rollingState);

      const sprite = mockScene.sprites[0];
      const setAlphaSpy = vi.fn();
      sprite.setAlpha = setAlphaSpy;

      // End rolling
      const notRollingState: PlayerState[] = [
        {
          id: 'player-1',
          position: { x: 100, y: 200 },
          velocity: { x: 0, y: 0 },
          isRolling: false
        },
      ];

      playerManager.updatePlayers(notRollingState);

      // Alpha should be restored to 1.0
      expect(setAlphaSpy).toHaveBeenCalledWith(1.0);
    });

    it('should clear rotation when roll ends', () => {
      playerManager.setLocalPlayerId('player-1');

      // Start rolling
      const rollingState: PlayerState[] = [
        {
          id: 'player-1',
          position: { x: 100, y: 200 },
          velocity: { x: 0, y: 0 },
          isRolling: true
        },
      ];

      playerManager.updatePlayers(rollingState);

      const sprite = mockScene.sprites[0];
      const setAngleSpy = vi.fn();
      sprite.setAngle = setAngleSpy;

      // End rolling
      const notRollingState: PlayerState[] = [
        {
          id: 'player-1',
          position: { x: 100, y: 200 },
          velocity: { x: 0, y: 0 },
          isRolling: false
        },
      ];

      playerManager.updatePlayers(notRollingState);

      // Rotation should be cleared (angle = 0)
      expect(setAngleSpy).toHaveBeenCalledWith(0);
    });

    it('should handle players with undefined isRolling (backward compatibility)', () => {
      const playerStates: PlayerState[] = [
        { id: 'player-1', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 } },
      ];

      expect(() => playerManager.updatePlayers(playerStates)).not.toThrow();
    });
  });

  describe('getPlayerAimAngle', () => {
    it('should return aim angle when player exists', () => {
      const playerStates: PlayerState[] = [
        { id: 'player-1', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 }, aimAngle: Math.PI / 2 },
      ];

      playerManager.updatePlayers(playerStates);

      const aimAngle = playerManager.getPlayerAimAngle('player-1');
      expect(aimAngle).toBe(Math.PI / 2);
    });

    it('should return null when player does not exist', () => {
      const aimAngle = playerManager.getPlayerAimAngle('non-existent');
      expect(aimAngle).toBeNull();
    });

    it('should return null when player exists but aimAngle is not set', () => {
      const playerStates: PlayerState[] = [
        { id: 'player-1', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 } },
      ];

      playerManager.updatePlayers(playerStates);

      const aimAngle = playerManager.getPlayerAimAngle('player-1');
      expect(aimAngle).toBeNull();
    });
  });

  describe('getLocalPlayerPosition', () => {
    it('should return position when local player exists', () => {
      playerManager.setLocalPlayerId('local-player');

      const playerStates: PlayerState[] = [
        { id: 'local-player', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 } },
      ];

      playerManager.updatePlayers(playerStates);

      const position = playerManager.getLocalPlayerPosition();
      expect(position).toEqual({ x: 100, y: 200 });
    });

    it('should return undefined when no local player ID is set', () => {
      const position = playerManager.getLocalPlayerPosition();
      expect(position).toBeUndefined();
    });

    it('should return undefined when local player does not exist', () => {
      playerManager.setLocalPlayerId('non-existent');

      const position = playerManager.getLocalPlayerPosition();
      expect(position).toBeUndefined();
    });
  });

  describe('isLocalPlayerMoving', () => {
    it('should return true when player is moving', () => {
      playerManager.setLocalPlayerId('local-player');

      const playerStates: PlayerState[] = [
        { id: 'local-player', position: { x: 100, y: 200 }, velocity: { x: 5, y: 3 } },
      ];

      playerManager.updatePlayers(playerStates);

      expect(playerManager.isLocalPlayerMoving()).toBe(true);
    });

    it('should return false when player is stationary', () => {
      playerManager.setLocalPlayerId('local-player');

      const playerStates: PlayerState[] = [
        { id: 'local-player', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 } },
      ];

      playerManager.updatePlayers(playerStates);

      expect(playerManager.isLocalPlayerMoving()).toBe(false);
    });

    it('should return false when velocity is below threshold', () => {
      playerManager.setLocalPlayerId('local-player');

      const playerStates: PlayerState[] = [
        { id: 'local-player', position: { x: 100, y: 200 }, velocity: { x: 0.05, y: 0.05 } },
      ];

      playerManager.updatePlayers(playerStates);

      expect(playerManager.isLocalPlayerMoving()).toBe(false);
    });

    it('should return false when no local player ID is set', () => {
      expect(playerManager.isLocalPlayerMoving()).toBe(false);
    });

    it('should return false when local player does not exist', () => {
      playerManager.setLocalPlayerId('non-existent');

      expect(playerManager.isLocalPlayerMoving()).toBe(false);
    });
  });

  describe('dodge roll and death state combination', () => {
    it('should maintain color while rolling for alive player', () => {
      playerManager.setLocalPlayerId('player-1');

      // Alive player rolling
      const rollingState: PlayerState[] = [
        {
          id: 'player-1',
          position: { x: 100, y: 200 },
          velocity: { x: 0, y: 0 },
          isRolling: true
        },
      ];

      playerManager.updatePlayers(rollingState);

      const sprite = mockScene.sprites[0];
      // Color should be maintained during roll (green for local player)
      expect(sprite.setTint).toHaveBeenCalledWith(0x00ff00);
    });

    it('should apply death effects even when rolling flag is set', () => {
      playerManager.setLocalPlayerId('player-1');

      // Dead player with rolling flag (edge case)
      const deadAndRollingState: PlayerState[] = [
        {
          id: 'player-1',
          position: { x: 100, y: 200 },
          velocity: { x: 0, y: 0 },
          deathTime: clock.now(),
          isRolling: true
        },
      ];

      playerManager.updatePlayers(deadAndRollingState);

      const sprite = mockScene.sprites[0];
      // Death effect takes precedence
      expect(sprite.setAlpha).toHaveBeenCalledWith(0.5);
      expect(sprite.setTint).toHaveBeenCalledWith(0x888888);
    });
  });

  describe('edge cases - missing label/aim indicator', () => {
    it('should handle missing label during player removal', () => {
      const playerStates: PlayerState[] = [
        { id: 'player-1', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 } },
      ];

      playerManager.updatePlayers(playerStates);

      // Manually remove the label from internal map to simulate edge case
      const playerLabels = (playerManager as any).playerLabels as Map<string, any>;
      playerLabels.delete('player-1');

      // Remove player - should not throw even though label is missing
      expect(() => {
        playerManager.updatePlayers([]);
      }).not.toThrow();
    });

    it('should handle missing aim indicator during player removal', () => {
      const playerStates: PlayerState[] = [
        { id: 'player-1', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 } },
      ];

      playerManager.updatePlayers(playerStates);

      // Manually remove the aim indicator from internal map to simulate edge case
      const aimIndicators = (playerManager as any).aimIndicators as Map<string, any>;
      aimIndicators.delete('player-1');

      // Remove player - should not throw even though aim indicator is missing
      expect(() => {
        playerManager.updatePlayers([]);
      }).not.toThrow();
    });

    it('should handle missing label during position update', () => {
      const playerStates: PlayerState[] = [
        { id: 'player-1', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 } },
      ];

      playerManager.updatePlayers(playerStates);

      // Manually remove the label from internal map to simulate edge case
      const playerLabels = (playerManager as any).playerLabels as Map<string, any>;
      playerLabels.delete('player-1');

      // Update player position - should not throw even though label is missing
      const updatedStates: PlayerState[] = [
        { id: 'player-1', position: { x: 300, y: 400 }, velocity: { x: 0, y: 0 } },
      ];

      expect(() => {
        playerManager.updatePlayers(updatedStates);
      }).not.toThrow();
    });

    it('should handle missing aim indicator during angle update', () => {
      const playerStates: PlayerState[] = [
        { id: 'player-1', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 }, aimAngle: 0 },
      ];

      playerManager.updatePlayers(playerStates);

      // Manually remove the aim indicator from internal map to simulate edge case
      const aimIndicators = (playerManager as any).aimIndicators as Map<string, any>;
      aimIndicators.delete('player-1');

      // Update player with new aim angle - should not throw even though aim indicator is missing
      const updatedStates: PlayerState[] = [
        { id: 'player-1', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 }, aimAngle: Math.PI / 2 },
      ];

      expect(() => {
        playerManager.updatePlayers(updatedStates);
      }).not.toThrow();
    });
  });

  describe('Phase 2 Critical: Scene Lifecycle Tests', () => {
    describe('Destroy and recreation cycle', () => {
      it('should properly cleanup all sprites on destroy', () => {
        const playerStates: PlayerState[] = [
          { id: 'player-1', position: { x: 100, y: 100 }, velocity: { x: 0, y: 0 } },
          { id: 'player-2', position: { x: 200, y: 200 }, velocity: { x: 0, y: 0 } },
        ];

        playerManager.updatePlayers(playerStates);

        // Verify sprites were created (2 players × 2 sprites each = 4)
        expect(mockScene.sprites.length).toBe(4);
        expect(mockScene.texts.length).toBe(2);
        expect(mockScene.lines.length).toBe(2);

        // Destroy PlayerManager
        playerManager.destroy();

        // Verify all sprites were destroyed
        expect(mockScene.sprites[0].destroy).toHaveBeenCalled();
        expect(mockScene.sprites[1].destroy).toHaveBeenCalled();
        expect(mockScene.texts[0].destroy).toHaveBeenCalled();
        expect(mockScene.texts[1].destroy).toHaveBeenCalled();
        expect(mockScene.lines[0].destroy).toHaveBeenCalled();
        expect(mockScene.lines[1].destroy).toHaveBeenCalled();
      });

      it('should allow recreation after destroy', () => {
        const playerStates: PlayerState[] = [
          { id: 'player-1', position: { x: 100, y: 100 }, velocity: { x: 0, y: 0 } },
        ];

        // First lifecycle: create and destroy
        playerManager.updatePlayers(playerStates);
        playerManager.destroy();

        // Second lifecycle: create new manager and add players
        const newMockScene = createMockScene();
        const newPlayerManager = new PlayerManager(newMockScene as unknown as Phaser.Scene);

        newPlayerManager.updatePlayers(playerStates);

        // Verify new sprites were created (2 per player: player + weapon)
        expect(newMockScene.sprites.length).toBe(2);
        expect(newMockScene.texts.length).toBe(1);
        expect(newMockScene.lines.length).toBe(1);
      });

      it('should track sprite count matches player count', () => {
        const playerStates: PlayerState[] = [
          { id: 'player-1', position: { x: 100, y: 100 }, velocity: { x: 0, y: 0 } },
          { id: 'player-2', position: { x: 200, y: 200 }, velocity: { x: 0, y: 0 } },
          { id: 'player-3', position: { x: 300, y: 300 }, velocity: { x: 0, y: 0 } },
        ];

        playerManager.updatePlayers(playerStates);
        expect(mockScene.sprites.length).toBe(6);

        // Remove one player
        const updatedStates: PlayerState[] = [
          { id: 'player-1', position: { x: 100, y: 100 }, velocity: { x: 0, y: 0 } },
          { id: 'player-2', position: { x: 200, y: 200 }, velocity: { x: 0, y: 0 } },
        ];

        playerManager.updatePlayers(updatedStates);

        // Verify removed player's sprites were destroyed (player-3 had 2 sprites: indices 4 and 5)
        expect(mockScene.sprites[4].destroy).toHaveBeenCalled();
        expect(mockScene.sprites[5].destroy).toHaveBeenCalled();
      });

      it('should have no zombie sprites after multiple updates and destroy', () => {
        // Create players
        const playerStates1: PlayerState[] = [
          { id: 'player-1', position: { x: 100, y: 100 }, velocity: { x: 0, y: 0 } },
        ];
        playerManager.updatePlayers(playerStates1);

        // Add more players
        const playerStates2: PlayerState[] = [
          { id: 'player-1', position: { x: 100, y: 100 }, velocity: { x: 0, y: 0 } },
          { id: 'player-2', position: { x: 200, y: 200 }, velocity: { x: 0, y: 0 } },
        ];
        playerManager.updatePlayers(playerStates2);

        // Remove all players
        playerManager.updatePlayers([]);

        // All sprites should be destroyed
        mockScene.sprites.forEach(sprite => {
          expect(sprite.destroy).toHaveBeenCalled();
        });
        mockScene.texts.forEach(text => {
          expect(text.destroy).toHaveBeenCalled();
        });
        mockScene.lines.forEach(line => {
          expect(line.destroy).toHaveBeenCalled();
        });

        // Final destroy should not error
        expect(() => playerManager.destroy()).not.toThrow();
      });
    });

    describe('Scene restart simulation', () => {
      it('should handle complete scene restart cycle', () => {
        // Scene lifecycle 1: Create players
        const playerStates: PlayerState[] = [
          { id: 'player-1', position: { x: 100, y: 100 }, velocity: { x: 0, y: 0 } },
          { id: 'player-2', position: { x: 200, y: 200 }, velocity: { x: 0, y: 0 } },
        ];
        playerManager.updatePlayers(playerStates);
        expect(mockScene.sprites.length).toBe(4);

        // Scene lifecycle 1: Destroy
        playerManager.destroy();

        // Simulate scene restart: new scene and manager
        const newMockScene = createMockScene();
        const newPlayerManager = new PlayerManager(newMockScene as unknown as Phaser.Scene);

        // Scene lifecycle 2: Create same players again
        newPlayerManager.updatePlayers(playerStates);

        // Should create new sprites (not reuse old ones)
        expect(newMockScene.sprites.length).toBe(4);
        expect(newMockScene.sprites[0]).not.toBe(mockScene.sprites[0]);
      });

      it('should handle multiple consecutive restarts without leaks', () => {
        for (let i = 0; i < 3; i++) {
          const tempMockScene = createMockScene();
          const tempManager = new PlayerManager(tempMockScene as unknown as Phaser.Scene);

          const playerStates: PlayerState[] = [
            { id: 'player-1', position: { x: 100, y: 100 }, velocity: { x: 0, y: 0 } },
          ];

          tempManager.updatePlayers(playerStates);
          tempManager.destroy();

          // Verify all sprites were destroyed in each cycle (2 per player: player + weapon)
          expect(tempMockScene.sprites.length).toBe(2);
          expect(tempMockScene.sprites[0].destroy).toHaveBeenCalled();
          expect(tempMockScene.sprites[1].destroy).toHaveBeenCalled();
        }
      });

      it('should clear all internal maps on destroy', () => {
        const playerStates: PlayerState[] = [
          { id: 'player-1', position: { x: 100, y: 100 }, velocity: { x: 0, y: 0 } },
        ];

        playerManager.setLocalPlayerId('player-1');
        playerManager.updatePlayers(playerStates);

        // Verify maps have data
        const players = (playerManager as any).players as Map<string, any>;
        const playerLabels = (playerManager as any).playerLabels as Map<string, any>;
        const aimIndicators = (playerManager as any).aimIndicators as Map<string, any>;
        const playerStatesMap = (playerManager as any).playerStates as Map<string, any>;

        expect(players.size).toBe(1);
        expect(playerLabels.size).toBe(1);
        expect(aimIndicators.size).toBe(1);
        expect(playerStatesMap.size).toBe(1);

        // Destroy
        playerManager.destroy();

        // All maps should be cleared
        expect(players.size).toBe(0);
        expect(playerLabels.size).toBe(0);
        expect(aimIndicators.size).toBe(0);
        expect(playerStatesMap.size).toBe(0);
      });

      it('should return null for local player sprite after destroy', () => {
        const playerStates: PlayerState[] = [
          { id: 'player-1', position: { x: 100, y: 100 }, velocity: { x: 0, y: 0 } },
        ];

        playerManager.setLocalPlayerId('player-1');
        playerManager.updatePlayers(playerStates);

        expect(playerManager.getLocalPlayerSprite()).not.toBeNull();

        playerManager.destroy();

        expect(playerManager.getLocalPlayerSprite()).toBeNull();
      });
    });

    describe('Sprite count validation', () => {
      it('should maintain sprite count = player count at all times', () => {
        // Start with 2 players
        let playerStates: PlayerState[] = [
          { id: 'player-1', position: { x: 100, y: 100 }, velocity: { x: 0, y: 0 } },
          { id: 'player-2', position: { x: 200, y: 200 }, velocity: { x: 0, y: 0 } },
        ];
        playerManager.updatePlayers(playerStates);
        // Each player creates 2 sprites (player + weapon)
        expect(mockScene.sprites.length).toBe(4);

        // Add player
        playerStates = [
          { id: 'player-1', position: { x: 100, y: 100 }, velocity: { x: 0, y: 0 } },
          { id: 'player-2', position: { x: 200, y: 200 }, velocity: { x: 0, y: 0 } },
          { id: 'player-3', position: { x: 300, y: 300 }, velocity: { x: 0, y: 0 } },
        ];
        playerManager.updatePlayers(playerStates);
        // 3 players * 2 sprites each = 6 sprites
        expect(mockScene.sprites.length).toBe(6);

        // Remove 2 players
        playerStates = [
          { id: 'player-1', position: { x: 100, y: 100 }, velocity: { x: 0, y: 0 } },
        ];
        playerManager.updatePlayers(playerStates);
        // Only 2 active sprites remain (1 player + 1 weapon)
        const activeSpriteCount = mockScene.sprites.filter(
          s => !s.destroy.mock.calls.length
        ).length;
        expect(activeSpriteCount).toBe(2);
      });

      it('should never duplicate sprites for same player ID', () => {
        const playerStates: PlayerState[] = [
          { id: 'player-1', position: { x: 100, y: 100 }, velocity: { x: 0, y: 0 } },
        ];

        // Update same player multiple times
        playerManager.updatePlayers(playerStates);
        playerManager.updatePlayers(playerStates);
        playerManager.updatePlayers(playerStates);

        // Should only create 2 sprites (player + weapon), not six
        expect(mockScene.sprites.length).toBe(2);
      });
    });
  });
});
