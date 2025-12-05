import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlayerManager, type PlayerState } from './PlayerManager';

// Create mock Phaser scene
const createMockScene = () => {
  const rectangles: Array<{
    x: number;
    y: number;
    setPosition: ReturnType<typeof vi.fn>;
    setAlpha: ReturnType<typeof vi.fn>;
    setTint: ReturnType<typeof vi.fn>;
    clearTint: ReturnType<typeof vi.fn>;
    setFillStyle: ReturnType<typeof vi.fn>;
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
    add: {
      rectangle: vi.fn((x: number, y: number) => {
        const rect = {
          x,
          y,
          setPosition: vi.fn(),
          setAlpha: vi.fn().mockReturnThis(),
          setTint: vi.fn().mockReturnThis(),
          clearTint: vi.fn().mockReturnThis(),
          setFillStyle: vi.fn().mockReturnThis(),
          destroy: vi.fn(),
        };
        rectangles.push(rect);
        return rect;
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
    rectangles,
    texts,
    lines,
  };
};

describe('PlayerManager', () => {
  let playerManager: PlayerManager;
  let mockScene: ReturnType<typeof createMockScene>;

  beforeEach(() => {
    mockScene = createMockScene();
    playerManager = new PlayerManager(mockScene as unknown as Phaser.Scene);
  });

  describe('constructor', () => {
    it('should initialize without errors', () => {
      expect(playerManager).toBeDefined();
    });
  });

  describe('setLocalPlayerId', () => {
    it('should set the local player ID', () => {
      playerManager.setLocalPlayerId('player-123');
      expect(playerManager.getLocalPlayerId()).toBe('player-123');
    });
  });

  describe('updatePlayers', () => {
    it('should handle null scene.add gracefully', () => {
      const sceneWithoutAdd = {} as Phaser.Scene;
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const manager = new PlayerManager(sceneWithoutAdd);
      const playerStates: PlayerState[] = [
        { id: 'player-1', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 } },
      ];

      // Should not throw, just log error and skip player creation
      expect(() => manager.updatePlayers(playerStates)).not.toThrow();
      expect(consoleSpy).toHaveBeenCalledWith('Scene add system not available');

      consoleSpy.mockRestore();
    });

    it('should create player sprites for new players', () => {
      const playerStates: PlayerState[] = [
        { id: 'player-1', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 } },
      ];

      playerManager.updatePlayers(playerStates);

      expect(mockScene.add.rectangle).toHaveBeenCalledWith(
        100, 200, 32, 64, expect.any(Number)
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

      expect(mockScene.add.rectangle).toHaveBeenCalledWith(
        100, 200, 32, 64, 0x00ff00
      );
    });

    it('should create remote player with red color (0xff0000)', () => {
      playerManager.setLocalPlayerId('local-player');

      const playerStates: PlayerState[] = [
        { id: 'remote-player', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 } },
      ];

      playerManager.updatePlayers(playerStates);

      expect(mockScene.add.rectangle).toHaveBeenCalledWith(
        100, 200, 32, 64, 0xff0000
      );
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

      const sprite = mockScene.rectangles[0];

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

      const player1Sprite = mockScene.rectangles[0];
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

      expect(mockScene.add.rectangle).toHaveBeenCalledTimes(3);
      expect(mockScene.add.text).toHaveBeenCalledTimes(3);
    });

    it('should not create duplicate sprites for same player', () => {
      const playerStates: PlayerState[] = [
        { id: 'player-1', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 } },
      ];

      playerManager.updatePlayers(playerStates);
      playerManager.updatePlayers(playerStates);
      playerManager.updatePlayers(playerStates);

      expect(mockScene.add.rectangle).toHaveBeenCalledTimes(1);
      expect(mockScene.add.text).toHaveBeenCalledTimes(1);
    });

    it('should handle empty player list', () => {
      // First add some players
      const playerStates: PlayerState[] = [
        { id: 'player-1', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 } },
      ];

      playerManager.updatePlayers(playerStates);

      const sprite = mockScene.rectangles[0];
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

      for (const rect of mockScene.rectangles) {
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
        { id: 'player-1', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 }, deathTime: Date.now() },
      ];

      expect(() => playerManager.updatePlayers(deadState)).not.toThrow();
    });

    it('should apply death visual effects (fade + gray) to dead players', () => {
      const aliveState: PlayerState[] = [
        { id: 'player-1', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 } },
      ];

      playerManager.updatePlayers(aliveState);

      const sprite = mockScene.rectangles[0];
      const setAlphaSpy = vi.fn();
      const setFillStyleSpy = vi.fn();
      sprite.setAlpha = setAlphaSpy;
      sprite.setFillStyle = setFillStyleSpy;

      // Mark as dead
      const deadState: PlayerState[] = [
        { id: 'player-1', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 }, deathTime: Date.now() },
      ];

      playerManager.updatePlayers(deadState);

      expect(setAlphaSpy).toHaveBeenCalledWith(0.5);
      expect(setFillStyleSpy).toHaveBeenCalledWith(0x888888);
    });

    it('should restore visual effects when player respawns', () => {
      const deadState: PlayerState[] = [
        { id: 'player-1', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 }, deathTime: Date.now() },
      ];

      playerManager.updatePlayers(deadState);

      const sprite = mockScene.rectangles[0];
      const setAlphaSpy = vi.fn();
      const setFillStyleSpy = vi.fn();
      sprite.setAlpha = setAlphaSpy;
      sprite.setFillStyle = setFillStyleSpy;

      // Respawn (deathTime removed)
      const aliveState: PlayerState[] = [
        { id: 'player-1', position: { x: 500, y: 300 }, velocity: { x: 0, y: 0 } },
      ];

      playerManager.updatePlayers(aliveState);

      expect(setAlphaSpy).toHaveBeenCalledWith(1.0);
      expect(setFillStyleSpy).toHaveBeenCalledWith(0xff0000); // Red for non-local player
    });

    it('should return list of living players excluding dead ones', () => {
      const playerStates: PlayerState[] = [
        { id: 'player-1', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 } },
        { id: 'player-2', position: { x: 300, y: 400 }, velocity: { x: 0, y: 0 }, deathTime: Date.now() },
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
        { id: 'player-1', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 }, deathTime: Date.now() },
        { id: 'player-2', position: { x: 300, y: 400 }, velocity: { x: 0, y: 0 }, deathTime: Date.now() },
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
        { id: 'player-1', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 }, deathTime: Date.now() },
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
});
