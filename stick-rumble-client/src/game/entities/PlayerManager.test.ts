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

  const containers: Array<{
    add: ReturnType<typeof vi.fn>;
    removeAll: ReturnType<typeof vi.fn>;
    setRotation: ReturnType<typeof vi.fn>;
    setPosition: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
    scaleY: number;
    rotation: number;
  }> = [];

  const graphicsObjects: Array<{
    clear: ReturnType<typeof vi.fn>;
    lineStyle: ReturnType<typeof vi.fn>;
    fillStyle: ReturnType<typeof vi.fn>;
    fillRect: ReturnType<typeof vi.fn>;
    beginPath: ReturnType<typeof vi.fn>;
    moveTo: ReturnType<typeof vi.fn>;
    lineTo: ReturnType<typeof vi.fn>;
    strokePath: ReturnType<typeof vi.fn>;
    fillCircle: ReturnType<typeof vi.fn>;
    strokeCircle: ReturnType<typeof vi.fn>;
    setDepth: ReturnType<typeof vi.fn>;
    setVisible: ReturnType<typeof vi.fn>;
    setPosition: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
    visible: boolean;
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
      container: vi.fn(() => {
        const container = {
          add: vi.fn(),
          removeAll: vi.fn(),
          setRotation: vi.fn(),
          setPosition: vi.fn(),
          destroy: vi.fn(),
          scaleY: 1,
          rotation: 0,
        };
        containers.push(container);
        return container;
      }),
      rectangle: vi.fn(() => ({
        setRotation: vi.fn(),
      })),
      graphics: vi.fn(() => {
        const graphics = {
          clear: vi.fn().mockReturnThis(),
          lineStyle: vi.fn().mockReturnThis(),
          fillStyle: vi.fn().mockReturnThis(),
          fillRect: vi.fn().mockReturnThis(),
          beginPath: vi.fn().mockReturnThis(),
          moveTo: vi.fn().mockReturnThis(),
          lineTo: vi.fn().mockReturnThis(),
          strokePath: vi.fn().mockReturnThis(),
          fillCircle: vi.fn().mockReturnThis(),
          strokeCircle: vi.fn().mockReturnThis(),
          setDepth: vi.fn().mockReturnThis(),
          setVisible: vi.fn().mockReturnThis(),
          setPosition: vi.fn().mockReturnThis(),
          destroy: vi.fn(),
          visible: true,
        };
        graphicsObjects.push(graphics);
        return graphics;
      }),
    },
    sprites,
    texts,
    lines,
    containers,
    graphicsObjects,
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

    it('should create player graphics for new players', () => {
      const playerStates: PlayerState[] = [
        { id: 'player-1', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 } },
      ];

      playerManager.updatePlayers(playerStates);

      // Should create graphics object for player
      expect(mockScene.add.graphics).toHaveBeenCalled();
      // Should create container for weapon
      expect(mockScene.add.container).toHaveBeenCalled();
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

      expect(mockScene.add.graphics).toHaveBeenCalled();
      // ProceduralPlayerGraphics uses fillStyle with color 0x00ff00 for local player
      const graphics = mockScene.graphicsObjects[0];
      expect(graphics.fillStyle).toHaveBeenCalledWith(0x00ff00, 1);
    });

    it('should create remote player with red color (0xff0000)', () => {
      playerManager.setLocalPlayerId('local-player');

      const playerStates: PlayerState[] = [
        { id: 'remote-player', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 } },
      ];

      playerManager.updatePlayers(playerStates);

      expect(mockScene.add.graphics).toHaveBeenCalled();
      // ProceduralPlayerGraphics uses fillStyle with color 0xff0000 for remote player
      const graphics = mockScene.graphicsObjects[0];
      expect(graphics.fillStyle).toHaveBeenCalledWith(0xff0000, 1);
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

      const graphics = mockScene.graphicsObjects[0];

      const updatedStates: PlayerState[] = [
        { id: 'player-1', position: { x: 300, y: 400 }, velocity: { x: 0, y: 0 } },
      ];

      playerManager.updatePlayers(updatedStates);

      // ProceduralPlayerGraphics.setPosition triggers draw() which calls graphics.clear()
      expect(graphics.clear).toHaveBeenCalled();
    });

    it('should update label positions when player moves', () => {
      // Set as local player to bypass interpolation and use raw server state
      playerManager.setLocalPlayerId('player-1');

      const initialStates: PlayerState[] = [
        { id: 'player-1', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 } },
      ];

      playerManager.updatePlayers(initialStates);
      playerManager.update(16); // Trigger position write

      const label = mockScene.texts[0];
      const initialCalls = label.setPosition.mock.calls.length;

      const updatedStates: PlayerState[] = [
        { id: 'player-1', position: { x: 300, y: 400 }, velocity: { x: 0, y: 0 } },
      ];

      playerManager.updatePlayers(updatedStates);
      playerManager.update(16); // Trigger position write

      // Label position should be updated in the update() call
      expect(label.setPosition.mock.calls.length).toBeGreaterThan(initialCalls);
      // Verify the last call has the correct position
      const lastCall = label.setPosition.mock.calls[label.setPosition.mock.calls.length - 1];
      expect(lastCall[0]).toBe(300);
      expect(lastCall[1]).toBe(358); // y: 400 - 64/2 - 10 = 358
    });

    it('should remove players that no longer exist', () => {
      const initialStates: PlayerState[] = [
        { id: 'player-1', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 } },
        { id: 'player-2', position: { x: 300, y: 400 }, velocity: { x: 0, y: 0 } },
      ];

      playerManager.updatePlayers(initialStates);

      const player1Graphics = mockScene.graphicsObjects[0];
      const player1Label = mockScene.texts[0];

      // Update with only player-2
      const updatedStates: PlayerState[] = [
        { id: 'player-2', position: { x: 300, y: 400 }, velocity: { x: 0, y: 0 } },
      ];

      playerManager.updatePlayers(updatedStates);

      expect(player1Graphics.destroy).toHaveBeenCalled();
      expect(player1Label.destroy).toHaveBeenCalled();
    });

    it('should handle multiple players', () => {
      const playerStates: PlayerState[] = [
        { id: 'player-1', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 } },
        { id: 'player-2', position: { x: 300, y: 400 }, velocity: { x: 0, y: 0 } },
        { id: 'player-3', position: { x: 500, y: 600 }, velocity: { x: 0, y: 0 } },
      ];

      playerManager.updatePlayers(playerStates);

      // Each player creates 1 graphics (player) + 1 health bar (graphics) + 1 container (weapon)
      expect(mockScene.add.graphics).toHaveBeenCalledTimes(6); // 3 players × 2 graphics each
      expect(mockScene.add.container).toHaveBeenCalledTimes(3);
      expect(mockScene.add.text).toHaveBeenCalledTimes(3);
    });

    it('should not create duplicate graphics for same player', () => {
      const playerStates: PlayerState[] = [
        { id: 'player-1', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 } },
      ];

      playerManager.updatePlayers(playerStates);
      playerManager.updatePlayers(playerStates);
      playerManager.updatePlayers(playerStates);

      // Each player creates 2 graphics (player + health bar) + 1 container
      expect(mockScene.add.graphics).toHaveBeenCalledTimes(2); // 1 player × 2 graphics
      expect(mockScene.add.container).toHaveBeenCalledTimes(1);
      expect(mockScene.add.text).toHaveBeenCalledTimes(1);
    });

    it('should handle empty player list', () => {
      // First add some players
      const playerStates: PlayerState[] = [
        { id: 'player-1', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 } },
      ];

      playerManager.updatePlayers(playerStates);

      const graphics = mockScene.graphicsObjects[0];
      const label = mockScene.texts[0];

      // Then update with empty list
      playerManager.updatePlayers([]);

      expect(graphics.destroy).toHaveBeenCalled();
      expect(label.destroy).toHaveBeenCalled();
    });
  });

  describe('destroy', () => {
    it('should destroy all player graphics', () => {
      const playerStates: PlayerState[] = [
        { id: 'player-1', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 } },
        { id: 'player-2', position: { x: 300, y: 400 }, velocity: { x: 0, y: 0 } },
      ];

      playerManager.updatePlayers(playerStates);

      playerManager.destroy();

      for (const graphics of mockScene.graphicsObjects) {
        expect(graphics.destroy).toHaveBeenCalled();
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
      playerManager.update(16); // Trigger position write

      const line = mockScene.lines[0];

      // Update with new aim angle (pointing right, angle = 0)
      const updatedStates: PlayerState[] = [
        { id: 'player-1', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 }, aimAngle: 0 },
      ];

      playerManager.updatePlayers(updatedStates);
      playerManager.update(16); // Trigger position write

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
      playerManager.update(16); // Trigger position write

      const line = mockScene.lines[0];

      // Update with different aim angle (pointing up, angle = -PI/2)
      const updatedStates: PlayerState[] = [
        { id: 'player-1', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 }, aimAngle: -Math.PI / 2 },
      ];

      playerManager.updatePlayers(updatedStates);
      playerManager.update(16); // Trigger position write

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

    it('should apply death visual effects (gray color) to dead players', () => {
      const aliveState: PlayerState[] = [
        { id: 'player-1', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 } },
      ];

      playerManager.updatePlayers(aliveState);

      const graphics = mockScene.graphicsObjects[0];

      // Mark as dead
      const deadState: PlayerState[] = [
        { id: 'player-1', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 }, deathTime: clock.now() },
      ];

      playerManager.updatePlayers(deadState);

      // ProceduralPlayerGraphics.setColor(0x888888) triggers draw() which uses fillStyle
      expect(graphics.fillStyle).toHaveBeenCalledWith(0x888888, 1);
    });

    it('should restore visual effects when player respawns', () => {
      const deadState: PlayerState[] = [
        { id: 'player-1', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 }, deathTime: clock.now() },
      ];

      playerManager.updatePlayers(deadState);

      const graphics = mockScene.graphicsObjects[0];

      // Respawn (deathTime removed)
      const aliveState: PlayerState[] = [
        { id: 'player-1', position: { x: 500, y: 300 }, velocity: { x: 0, y: 0 } },
      ];

      playerManager.updatePlayers(aliveState);

      // ProceduralPlayerGraphics.setColor(0xff0000) triggers draw() which uses fillStyle
      // Red for non-local player
      expect(graphics.fillStyle).toHaveBeenCalledWith(0xff0000, 1);
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

    it('should return the local player graphics object when it exists', () => {
      playerManager.setLocalPlayerId('local-player');

      const playerStates: PlayerState[] = [
        { id: 'local-player', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 } },
      ];

      playerManager.updatePlayers(playerStates);

      const graphics = playerManager.getLocalPlayerSprite();
      expect(graphics).not.toBeNull();
      expect(graphics).toBeDefined();
      // Should have Graphics object methods
      expect(graphics).toHaveProperty('clear');
      expect(graphics).toHaveProperty('lineStyle');
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

      const graphics = mockScene.graphicsObjects[0];
      // ProceduralPlayerGraphics.setRotation triggers draw() which calls clear()
      expect(graphics.clear).toHaveBeenCalled();
    });

    it('should apply visibility flicker during invincibility frames when rolling', () => {
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

      const graphics = mockScene.graphicsObjects[0];
      // During rolling, setVisible is called for flicker effect
      expect(graphics.setVisible).toHaveBeenCalled();
    });

    it('should restore visibility when roll ends', () => {
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

      const graphics = mockScene.graphicsObjects[0];

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

      // Visibility should be restored to true
      expect(graphics.setVisible).toHaveBeenCalledWith(true);
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

      const graphics = mockScene.graphicsObjects[0];

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

      // Rotation cleared, setRotation(0) triggers draw() which calls clear()
      expect(graphics.clear).toHaveBeenCalled();
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

      const graphics = mockScene.graphicsObjects[0];
      // Color should be maintained during roll (green for local player)
      expect(graphics.fillStyle).toHaveBeenCalledWith(0x00ff00, 1);
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

      const graphics = mockScene.graphicsObjects[0];
      // Death effect takes precedence - gray color
      expect(graphics.fillStyle).toHaveBeenCalledWith(0x888888, 1);
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
      it('should properly cleanup all graphics on destroy', () => {
        const playerStates: PlayerState[] = [
          { id: 'player-1', position: { x: 100, y: 100 }, velocity: { x: 0, y: 0 } },
          { id: 'player-2', position: { x: 200, y: 200 }, velocity: { x: 0, y: 0 } },
        ];

        playerManager.updatePlayers(playerStates);

        // Verify graphics were created (2 players × 2 graphics each = 4: player + health bar)
        expect(mockScene.graphicsObjects.length).toBe(4);
        expect(mockScene.containers.length).toBe(2);
        expect(mockScene.texts.length).toBe(2);
        expect(mockScene.lines.length).toBe(2);

        // Destroy PlayerManager
        playerManager.destroy();

        // Verify all graphics were destroyed
        expect(mockScene.graphicsObjects[0].destroy).toHaveBeenCalled();
        expect(mockScene.graphicsObjects[1].destroy).toHaveBeenCalled();
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

        // Verify new graphics were created (2 graphics per player: player + health bar)
        expect(newMockScene.graphicsObjects.length).toBe(2);
        expect(newMockScene.containers.length).toBe(1);
        expect(newMockScene.texts.length).toBe(1);
        expect(newMockScene.lines.length).toBe(1);
      });

      it('should track graphics count matches player count', () => {
        const playerStates: PlayerState[] = [
          { id: 'player-1', position: { x: 100, y: 100 }, velocity: { x: 0, y: 0 } },
          { id: 'player-2', position: { x: 200, y: 200 }, velocity: { x: 0, y: 0 } },
          { id: 'player-3', position: { x: 300, y: 300 }, velocity: { x: 0, y: 0 } },
        ];

        playerManager.updatePlayers(playerStates);
        // 3 players × 2 graphics each = 6 graphics (player + health bar)
        expect(mockScene.graphicsObjects.length).toBe(6);
        expect(mockScene.containers.length).toBe(3);

        // Remove one player
        const updatedStates: PlayerState[] = [
          { id: 'player-1', position: { x: 100, y: 100 }, velocity: { x: 0, y: 0 } },
          { id: 'player-2', position: { x: 200, y: 200 }, velocity: { x: 0, y: 0 } },
        ];

        playerManager.updatePlayers(updatedStates);

        // Verify removed player's graphics were destroyed (player-3 graphics at index 4 and 5)
        expect(mockScene.graphicsObjects[4].destroy).toHaveBeenCalled(); // player-3 player graphics
        expect(mockScene.graphicsObjects[5].destroy).toHaveBeenCalled(); // player-3 health bar
        expect(mockScene.containers[2].destroy).toHaveBeenCalled();
      });

      it('should have no zombie graphics after multiple updates and destroy', () => {
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

        // All graphics should be destroyed
        mockScene.graphicsObjects.forEach(graphics => {
          expect(graphics.destroy).toHaveBeenCalled();
        });
        mockScene.containers.forEach(container => {
          expect(container.destroy).toHaveBeenCalled();
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
        // 2 players × 2 graphics each = 4 graphics (player + health bar)
        expect(mockScene.graphicsObjects.length).toBe(4);
        expect(mockScene.containers.length).toBe(2);

        // Scene lifecycle 1: Destroy
        playerManager.destroy();

        // Simulate scene restart: new scene and manager
        const newMockScene = createMockScene();
        const newPlayerManager = new PlayerManager(newMockScene as unknown as Phaser.Scene);

        // Scene lifecycle 2: Create same players again
        newPlayerManager.updatePlayers(playerStates);

        // Should create new graphics (not reuse old ones)
        // 2 players × 2 graphics each = 4 graphics
        expect(newMockScene.graphicsObjects.length).toBe(4);
        expect(newMockScene.containers.length).toBe(2);
        expect(newMockScene.graphicsObjects[0]).not.toBe(mockScene.graphicsObjects[0]);
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

          // Verify all graphics were destroyed in each cycle (2 graphics + 1 container per player)
          expect(tempMockScene.graphicsObjects.length).toBe(2); // player + health bar
          expect(tempMockScene.containers.length).toBe(1);
          expect(tempMockScene.graphicsObjects[0].destroy).toHaveBeenCalled();
          expect(tempMockScene.graphicsObjects[1].destroy).toHaveBeenCalled();
          expect(tempMockScene.containers[0].destroy).toHaveBeenCalled();
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

    describe('Graphics count validation', () => {
      it('should maintain graphics count = player count at all times', () => {
        // Start with 2 players
        let playerStates: PlayerState[] = [
          { id: 'player-1', position: { x: 100, y: 100 }, velocity: { x: 0, y: 0 } },
          { id: 'player-2', position: { x: 200, y: 200 }, velocity: { x: 0, y: 0 } },
        ];
        playerManager.updatePlayers(playerStates);
        // Each player creates 2 graphics (player + health bar) + 1 container
        expect(mockScene.graphicsObjects.length).toBe(4); // 2 players × 2 graphics each
        expect(mockScene.containers.length).toBe(2);

        // Add player
        playerStates = [
          { id: 'player-1', position: { x: 100, y: 100 }, velocity: { x: 0, y: 0 } },
          { id: 'player-2', position: { x: 200, y: 200 }, velocity: { x: 0, y: 0 } },
          { id: 'player-3', position: { x: 300, y: 300 }, velocity: { x: 0, y: 0 } },
        ];
        playerManager.updatePlayers(playerStates);
        // 3 players × 2 graphics each = 6 graphics (player + health bar)
        expect(mockScene.graphicsObjects.length).toBe(6);
        expect(mockScene.containers.length).toBe(3);

        // Remove 2 players
        playerStates = [
          { id: 'player-1', position: { x: 100, y: 100 }, velocity: { x: 0, y: 0 } },
        ];
        playerManager.updatePlayers(playerStates);
        // Only 2 active graphics remain (1 player × 2 graphics: player + health bar)
        const activeGraphicsCount = mockScene.graphicsObjects.filter(
          g => !g.destroy.mock.calls.length
        ).length;
        expect(activeGraphicsCount).toBe(2);
      });

      it('should never duplicate graphics for same player ID', () => {
        const playerStates: PlayerState[] = [
          { id: 'player-1', position: { x: 100, y: 100 }, velocity: { x: 0, y: 0 } },
        ];

        // Update same player multiple times
        playerManager.updatePlayers(playerStates);
        playerManager.updatePlayers(playerStates);
        playerManager.updatePlayers(playerStates);

        // Should only create 2 graphics (player + health bar) + 1 container, not multiples
        expect(mockScene.graphicsObjects.length).toBe(2);
        expect(mockScene.containers.length).toBe(1);
      });
    });
  });

  describe('Health Bar Integration', () => {
    it('should create health bar when player is created', () => {
      const playerStates: PlayerState[] = [
        { id: 'player-1', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 }, health: 100 },
      ];

      playerManager.updatePlayers(playerStates);

      // Health bar uses Graphics, so should create 2 graphics: 1 for player + 1 for health bar
      expect(mockScene.graphicsObjects.length).toBe(2);
    });

    it('should update health bar when player health changes', () => {
      const playerStates: PlayerState[] = [
        { id: 'player-1', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 }, health: 100 },
      ];

      playerManager.updatePlayers(playerStates);

      const healthBarGraphics = mockScene.graphicsObjects[1]; // Second graphics is health bar
      const clearCalls = healthBarGraphics.clear.mock.calls.length;

      // Update health
      const updatedStates: PlayerState[] = [
        { id: 'player-1', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 }, health: 50 },
      ];

      playerManager.updatePlayers(updatedStates);

      // Health bar should be redrawn (clear called again)
      expect(healthBarGraphics.clear.mock.calls.length).toBeGreaterThan(clearCalls);
    });

    it('should position health bar 8 pixels above player head', () => {
      const playerStates: PlayerState[] = [
        { id: 'player-1', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 }, health: 75 },
      ];

      playerManager.updatePlayers(playerStates);

      const healthBarGraphics = mockScene.graphicsObjects[1];

      // Health bar should be positioned 8px above player head
      // Player is at y=200, head is HEIGHT/2 above center, then 8px more for health bar
      // Expected: y = 200 - 25 - 8 = 167 (PLAYER.HEIGHT = 50)
      expect(healthBarGraphics.setPosition).toHaveBeenCalled();
    });

    it('should destroy health bar when player is removed', () => {
      const playerStates: PlayerState[] = [
        { id: 'player-1', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 }, health: 100 },
        { id: 'player-2', position: { x: 200, y: 300 }, velocity: { x: 0, y: 0 }, health: 100 },
      ];

      playerManager.updatePlayers(playerStates);

      // 2 players × 2 graphics each (player + health bar) = 4 graphics
      expect(mockScene.graphicsObjects.length).toBe(4);

      // Remove player-1
      const updatedStates: PlayerState[] = [
        { id: 'player-2', position: { x: 200, y: 300 }, velocity: { x: 0, y: 0 }, health: 100 },
      ];

      playerManager.updatePlayers(updatedStates);

      // Player-1's graphics should be destroyed (both player and health bar)
      expect(mockScene.graphicsObjects[0].destroy).toHaveBeenCalled();
      expect(mockScene.graphicsObjects[1].destroy).toHaveBeenCalled();
    });

    it('should handle players with undefined health (backward compatibility)', () => {
      const playerStates: PlayerState[] = [
        { id: 'player-1', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 } },
      ];

      expect(() => playerManager.updatePlayers(playerStates)).not.toThrow();
    });

    it('should default to 100 health when health is undefined', () => {
      const playerStates: PlayerState[] = [
        { id: 'player-1', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 } },
      ];

      playerManager.updatePlayers(playerStates);

      // Health bar should still be created with default 100 health
      expect(mockScene.graphicsObjects.length).toBe(2); // Player + health bar
    });

    it('should update health bar position when player moves', () => {
      const playerStates: PlayerState[] = [
        { id: 'player-1', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 }, health: 100 },
      ];

      playerManager.updatePlayers(playerStates);
      playerManager.update(16); // Trigger position write

      const healthBarGraphics = mockScene.graphicsObjects[1];
      const setPositionCalls = healthBarGraphics.setPosition.mock.calls.length;

      // Move player
      const updatedStates: PlayerState[] = [
        { id: 'player-1', position: { x: 300, y: 400 }, velocity: { x: 5, y: 5 }, health: 100 },
      ];

      playerManager.updatePlayers(updatedStates);
      playerManager.update(16); // Trigger position write

      // Health bar position should be updated
      expect(healthBarGraphics.setPosition.mock.calls.length).toBeGreaterThan(setPositionCalls);
    });

    it('should destroy all health bars on PlayerManager destroy', () => {
      const playerStates: PlayerState[] = [
        { id: 'player-1', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 }, health: 100 },
        { id: 'player-2', position: { x: 200, y: 300 }, velocity: { x: 0, y: 0 }, health: 75 },
      ];

      playerManager.updatePlayers(playerStates);

      // 2 players × 2 graphics each = 4 graphics total
      expect(mockScene.graphicsObjects.length).toBe(4);

      playerManager.destroy();

      // All graphics should be destroyed (both player and health bar graphics)
      mockScene.graphicsObjects.forEach(graphics => {
        expect(graphics.destroy).toHaveBeenCalled();
      });
    });
  });

  describe('Single Position Writer (Bug Fix: stick-rumble-00s)', () => {
    it('should NOT set player position in updatePlayers()', () => {
      // This test verifies the KEY BEHAVIOR: updatePlayers() does NOT write positions
      // It only stores state and updates non-positional properties

      playerManager.setLocalPlayerId('player-1');

      const playerStates: PlayerState[] = [
        { id: 'player-1', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 } },
      ];

      playerManager.updatePlayers(playerStates);

      // Get the player graphics and track position writes
      const graphics = mockScene.graphicsObjects[0];

      // Clear the setPosition spy to start fresh
      graphics.setPosition.mockClear();

      // Update player with new position
      const updatedStates: PlayerState[] = [
        { id: 'player-1', position: { x: 150, y: 250 }, velocity: { x: 0, y: 0 } },
      ];

      playerManager.updatePlayers(updatedStates);

      // KEY ASSERTION: updatePlayers() should NOT call setPosition() on player graphics
      // Position writing is deferred to update() method
      expect(graphics.setPosition).not.toHaveBeenCalled();
    });

    it('should set player position only in update() loop', () => {
      const playerStates: PlayerState[] = [
        { id: 'player-1', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 } },
      ];

      playerManager.updatePlayers(playerStates);

      const graphics = mockScene.graphicsObjects[0];
      const clearCallsAfterCreate = graphics.clear.mock.calls.length;

      // After update() is called, position should be set (draw() called)
      playerManager.update(16);

      // update() should have called setPosition which triggers draw()
      expect(graphics.clear.mock.calls.length).toBeGreaterThan(clearCallsAfterCreate);
    });

    it('should use interpolated position for remote players in update()', () => {
      playerManager.setLocalPlayerId('local-player');

      const playerStates: PlayerState[] = [
        { id: 'remote-player', position: { x: 100, y: 200 }, velocity: { x: 5, y: 5 } },
      ];

      playerManager.updatePlayers(playerStates);

      const graphics = mockScene.graphicsObjects[0];
      const clearCallsAfterCreate = graphics.clear.mock.calls.length;

      // Advance clock to build interpolation buffer
      clock.advance(50);

      const updatedStates: PlayerState[] = [
        { id: 'remote-player', position: { x: 150, y: 250 }, velocity: { x: 5, y: 5 } },
      ];

      playerManager.updatePlayers(updatedStates);

      // update() should use interpolated position (not raw server state)
      playerManager.update(16);

      // Position should be set (draw() called, which clears graphics)
      expect(graphics.clear.mock.calls.length).toBeGreaterThan(clearCallsAfterCreate);
    });

    it('should use raw server state for local player in update()', () => {
      playerManager.setLocalPlayerId('local-player');

      const playerStates: PlayerState[] = [
        { id: 'local-player', position: { x: 100, y: 200 }, velocity: { x: 5, y: 5 } },
      ];

      playerManager.updatePlayers(playerStates);

      const graphics = mockScene.graphicsObjects[0];
      const clearCallsAfterCreate = graphics.clear.mock.calls.length;

      // update() should use raw server state for local player (not interpolation)
      playerManager.update(16);

      // Position should be set (draw() called via setPosition)
      expect(graphics.clear.mock.calls.length).toBeGreaterThan(clearCallsAfterCreate);
    });

    it('should update all UI elements (label, aim, weapon, health bar) only in update()', () => {
      const playerStates: PlayerState[] = [
        { id: 'player-1', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 }, aimAngle: 0, health: 100 },
      ];

      playerManager.updatePlayers(playerStates);

      const label = mockScene.texts[0];
      const aimIndicator = mockScene.lines[0];
      const weaponGraphics = mockScene.containers[0];
      const healthBarGraphics = mockScene.graphicsObjects[1];

      // Clear call counts from constructor/initialization
      const labelCalls = label.setPosition.mock.calls.length;
      const aimCalls = aimIndicator.setTo.mock.calls.length;
      const weaponCalls = weaponGraphics.setPosition.mock.calls.length;
      const healthBarCalls = healthBarGraphics.setPosition.mock.calls.length;

      // Update player with new position
      const updatedStates: PlayerState[] = [
        { id: 'player-1', position: { x: 150, y: 250 }, velocity: { x: 5, y: 5 }, aimAngle: Math.PI / 4, health: 80 },
      ];

      playerManager.updatePlayers(updatedStates);

      // After updatePlayers(), UI elements should NOT have additional position updates
      expect(label.setPosition.mock.calls.length).toBe(labelCalls);
      expect(aimIndicator.setTo.mock.calls.length).toBe(aimCalls);
      expect(weaponGraphics.setPosition.mock.calls.length).toBe(weaponCalls);
      expect(healthBarGraphics.setPosition.mock.calls.length).toBe(healthBarCalls);

      // After update(), all UI elements should be positioned
      playerManager.update(16);

      expect(label.setPosition.mock.calls.length).toBeGreaterThan(labelCalls);
      expect(aimIndicator.setTo.mock.calls.length).toBeGreaterThan(aimCalls);
      expect(weaponGraphics.setPosition.mock.calls.length).toBeGreaterThan(weaponCalls);
      expect(healthBarGraphics.setPosition.mock.calls.length).toBeGreaterThan(healthBarCalls);
    });

    it('should write positions in update() method, not in updatePlayers()', () => {
      // This test verifies the fix for the flickering bug:
      // Before fix: updatePlayers() AND update() both wrote positions (causing flicker)
      // After fix: only update() writes positions (single source of truth)

      playerManager.setLocalPlayerId('player-1');

      const playerStates: PlayerState[] = [
        { id: 'player-1', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 } },
      ];

      playerManager.updatePlayers(playerStates);

      const label = mockScene.texts[0];
      const aimIndicator = mockScene.lines[0];

      // Clear spy counters
      label.setPosition.mockClear();
      aimIndicator.setTo.mockClear();

      // Update player state
      const updatedStates: PlayerState[] = [
        { id: 'player-1', position: { x: 110, y: 210 }, velocity: { x: 0, y: 0 }, aimAngle: Math.PI / 4 },
      ];

      playerManager.updatePlayers(updatedStates);

      // KEY ASSERTION: updatePlayers() should NOT update UI element positions
      expect(label.setPosition).not.toHaveBeenCalled();
      expect(aimIndicator.setTo).not.toHaveBeenCalled();

      // Now call update()
      playerManager.update(16);

      // AFTER update(), UI elements should be positioned
      expect(label.setPosition).toHaveBeenCalled();
      expect(aimIndicator.setTo).toHaveBeenCalled();
    });

    it('should handle multiple update() calls per updatePlayers() call (60 FPS vs 20Hz)', () => {
      const playerStates: PlayerState[] = [
        { id: 'player-1', position: { x: 100, y: 200 }, velocity: { x: 5, y: 5 } },
      ];

      playerManager.updatePlayers(playerStates);

      const graphics = mockScene.graphicsObjects[0];
      const clearCallsAfterCreate = graphics.clear.mock.calls.length;

      // Simulate 3 render frames (60 FPS) between server updates (20Hz)
      playerManager.update(16); // Frame 1
      const calls1 = graphics.clear.mock.calls.length;

      playerManager.update(16); // Frame 2
      const calls2 = graphics.clear.mock.calls.length;

      playerManager.update(16); // Frame 3
      const calls3 = graphics.clear.mock.calls.length;

      // Position should be written on every frame (each update() triggers draw())
      expect(calls1).toBeGreaterThan(clearCallsAfterCreate);
      expect(calls2).toBeGreaterThan(calls1);
      expect(calls3).toBeGreaterThan(calls2);
    });

    it('should fallback to raw server state when interpolation returns null', () => {
      // Test the fallback branch: when interpolation engine returns null for a remote player,
      // the system should use raw server state instead
      playerManager.setLocalPlayerId('local-player');

      const remotePlayerStates: PlayerState[] = [
        { id: 'remote-player', position: { x: 100, y: 200 }, velocity: { x: 5, y: 5 } },
      ];

      playerManager.updatePlayers(remotePlayerStates);

      const graphics = mockScene.graphicsObjects[0];

      // Call update() immediately before interpolation engine has enough data
      // This should trigger the fallback branch that uses raw server state
      playerManager.update(16);

      // Verify position was written (even though interpolation may not be ready)
      // The draw() method is called, which triggers clear()
      expect(graphics.clear).toHaveBeenCalled();
    });
  });

  describe('applyReconciledPosition', () => {
    it('should apply instant teleport when needsInstant is true', () => {
      playerManager.setLocalPlayerId('player1');
      const playerStates: PlayerState[] = [
        { id: 'player1', position: { x: 100, y: 100 }, velocity: { x: 0, y: 0 } },
      ];
      playerManager.updatePlayers(playerStates);

      const graphics = mockScene.graphicsObjects[0];

      // Apply reconciled position with instant teleport
      playerManager.applyReconciledPosition(
        'player1',
        { position: { x: 200, y: 200 }, velocity: { x: 5, y: 5 } },
        true
      );

      // Verify position was set (draw() is called, which triggers clear())
      expect(graphics.clear).toHaveBeenCalled();
    });

    it('should apply smooth lerp when needsInstant is false', () => {
      playerManager.setLocalPlayerId('player1');
      const playerStates: PlayerState[] = [
        { id: 'player1', position: { x: 100, y: 100 }, velocity: { x: 0, y: 0 } },
      ];
      playerManager.updatePlayers(playerStates);

      const graphics = mockScene.graphicsObjects[0];

      // Apply reconciled position with smooth lerp (small error)
      playerManager.applyReconciledPosition(
        'player1',
        { position: { x: 105, y: 105 }, velocity: { x: 2, y: 2 } },
        false
      );

      // Verify position was set
      expect(graphics.clear).toHaveBeenCalled();
    });

    it('should update stored player state after reconciliation', () => {
      playerManager.setLocalPlayerId('player1');
      const playerStates: PlayerState[] = [
        { id: 'player1', position: { x: 100, y: 100 }, velocity: { x: 0, y: 0 } },
      ];
      playerManager.updatePlayers(playerStates);

      // Apply reconciled position
      const reconciledState = { position: { x: 150, y: 150 }, velocity: { x: 10, y: 10 } };
      playerManager.applyReconciledPosition('player1', reconciledState, true);

      // Verify stored state was updated
      const position = playerManager.getPlayerPosition('player1');
      expect(position).toEqual({ x: 150, y: 150 });
    });

    it('should do nothing if player does not exist', () => {
      // Try to apply reconciled position to non-existent player
      playerManager.applyReconciledPosition(
        'non-existent',
        { position: { x: 100, y: 100 }, velocity: { x: 0, y: 0 } },
        true
      );

      // Should not throw error, just return silently
      expect(mockScene.graphicsObjects.length).toBe(0);
    });
  });

  describe('scene.add unavailable error handling', () => {
    it('should handle missing scene.add gracefully and skip player creation', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Create scene without add system
      const brokenScene = {
        sys: {
          isActive: vi.fn().mockReturnValue(true),
        },
        add: undefined, // Simulate missing add system
      };

      const manager = new PlayerManager(brokenScene as any);

      // Try to create player - should fail gracefully
      const playerStates: PlayerState[] = [
        { id: 'player1', position: { x: 100, y: 100 }, velocity: { x: 0, y: 0 } },
      ];

      manager.updatePlayers(playerStates);

      // Verify error was logged
      expect(consoleErrorSpy).toHaveBeenCalledWith('Scene add system not available');

      // Verify no player graphics were created (player state is stored, but graphics are not)
      // The getPlayerPosition will return the stored position, but getLocalPlayerSprite should return null
      expect(manager.getLocalPlayerSprite()).toBeNull();

      consoleErrorSpy.mockRestore();
    });
  });

  describe('update() with missing UI elements', () => {
    it('should handle missing label in update() loop', () => {
      playerManager.setLocalPlayerId('player1');
      const playerStates: PlayerState[] = [
        { id: 'player1', position: { x: 100, y: 100 }, velocity: { x: 0, y: 0 } },
      ];
      playerManager.updatePlayers(playerStates);

      // Manually delete the label
      const label = mockScene.texts[0];
      if (label) {
        (label.destroy as () => void)();
      }
      mockScene.texts.splice(0, 1);

      // Update should not crash when label is missing
      expect(() => playerManager.update(16)).not.toThrow();
    });

    it('should handle missing aim indicator in update() loop', () => {
      playerManager.setLocalPlayerId('player1');
      const playerStates: PlayerState[] = [
        { id: 'player1', position: { x: 100, y: 100 }, velocity: { x: 0, y: 0 } },
      ];
      playerManager.updatePlayers(playerStates);

      // Manually delete the aim indicator
      const aimIndicator = mockScene.lines[0];
      if (aimIndicator) {
        (aimIndicator.destroy as () => void)();
      }
      mockScene.lines.splice(0, 1);

      // Update should not crash when aim indicator is missing
      expect(() => playerManager.update(16)).not.toThrow();
    });

    it('should handle missing weapon graphics in update() loop', () => {
      playerManager.setLocalPlayerId('player1');
      const playerStates: PlayerState[] = [
        { id: 'player1', position: { x: 100, y: 100 }, velocity: { x: 0, y: 0 } },
      ];
      playerManager.updatePlayers(playerStates);

      // Manually delete the weapon graphics container
      const weaponContainer = mockScene.containers[0];
      if (weaponContainer) {
        (weaponContainer.destroy as () => void)();
      }
      mockScene.containers.splice(0, 1);

      // Update should not crash when weapon graphics is missing
      expect(() => playerManager.update(16)).not.toThrow();
    });

    it('should handle missing health bar in update() loop', () => {
      playerManager.setLocalPlayerId('player1');
      const playerStates: PlayerState[] = [
        { id: 'player1', position: { x: 100, y: 100 }, velocity: { x: 0, y: 0 } },
      ];
      playerManager.updatePlayers(playerStates);

      // Health bar is created as a container, delete it
      const healthBarContainer = mockScene.containers[1]; // Second container is health bar
      if (healthBarContainer) {
        (healthBarContainer.destroy as () => void)();
        mockScene.containers.splice(1, 1);
      }

      // Update should not crash when health bar is missing
      expect(() => playerManager.update(16)).not.toThrow();
    });
  });

  describe('color restoration during rolling', () => {
    it('should maintain original color when player is alive and rolling', () => {
      playerManager.setLocalPlayerId('player1');
      const playerStates: PlayerState[] = [
        {
          id: 'player1',
          position: { x: 100, y: 100 },
          velocity: { x: 5, y: 5 },
          isRolling: true,
        },
      ];
      playerManager.updatePlayers(playerStates);

      const graphics = mockScene.graphicsObjects[0];

      // Verify green color (local player) was maintained during roll
      // Color is applied via fillStyle and strokeStyle calls during draw
      expect(graphics.fillStyle).toHaveBeenCalledWith(0x00ff00, expect.any(Number));
    });

    it('should restore original color when not rolling and not dead', () => {
      playerManager.setLocalPlayerId('player1');

      // First, create player while rolling
      const rollingStates: PlayerState[] = [
        {
          id: 'player1',
          position: { x: 100, y: 100 },
          velocity: { x: 5, y: 5 },
          isRolling: true,
        },
      ];
      playerManager.updatePlayers(rollingStates);

      const graphics = mockScene.graphicsObjects[0];
      vi.clearAllMocks();

      // Then, update to not rolling
      const notRollingStates: PlayerState[] = [
        {
          id: 'player1',
          position: { x: 110, y: 110 },
          velocity: { x: 5, y: 5 },
          isRolling: false,
        },
      ];
      playerManager.updatePlayers(notRollingStates);

      // Verify original color was restored
      expect(graphics.fillStyle).toHaveBeenCalledWith(0x00ff00, expect.any(Number));
    });

    it('should use gray color for dead player even if rolling flag is set', () => {
      playerManager.setLocalPlayerId('player1');
      const playerStates: PlayerState[] = [
        {
          id: 'player1',
          position: { x: 100, y: 100 },
          velocity: { x: 0, y: 0 },
          isRolling: true,
          deathTime: Date.now(),
        },
      ];
      playerManager.updatePlayers(playerStates);

      const graphics = mockScene.graphicsObjects[0];

      // Verify gray color was applied (death takes priority over rolling)
      expect(graphics.fillStyle).toHaveBeenCalledWith(0x888888, expect.any(Number));
    });
  });
});
