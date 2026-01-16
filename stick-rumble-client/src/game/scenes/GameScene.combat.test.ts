import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GameScene } from './GameScene';
import { createMockScene, createMockWebSocket } from './GameScene.test.setup';

// Mock Phaser for InputManager - MUST BE AT TOP LEVEL
vi.mock('phaser', () => ({
  default: {
    Scene: class {
      scene = { key: '' };
      constructor(config: { key: string }) {
        this.scene.key = config.key;
      }
    },
    Input: {
      Keyboard: {
        KeyCodes: {
          W: 87,
          A: 65,
          S: 83,
          D: 68,
        },
      },
    },
  },
}));

describe('GameScene - Combat', () => {
  let scene: GameScene;
  let mockWebSocketInstance: ReturnType<typeof createMockWebSocket>['mockWebSocketInstance'];
  let originalWebSocket: typeof WebSocket;

  beforeEach(() => {
    originalWebSocket = globalThis.WebSocket;
    const { MockWebSocket, mockWebSocketInstance: wsInstance } = createMockWebSocket();
    mockWebSocketInstance = wsInstance;
    globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;

    vi.stubGlobal('import.meta', {
      env: {
        VITE_WS_URL: 'ws://localhost:8080/ws',
      },
    });

    scene = new GameScene();
  });

  afterEach(() => {
    globalThis.WebSocket = originalWebSocket;
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  describe('shooting and reload input', () => {
    it('should setup pointerdown handler for shooting after connection', async () => {
      const mockSceneContext = createMockScene();
      // Add input.on mock
      const inputOnMock = vi.fn();
      mockSceneContext.input = {
        ...mockSceneContext.input,
        on: inputOnMock,
        keyboard: {
          addKey: vi.fn().mockReturnValue({
            on: vi.fn(),
          }),
          addKeys: mockSceneContext.input.keyboard.addKeys,
        },
      };
      Object.assign(scene, mockSceneContext);

      scene.create();

      // Trigger the delayed callback to start connection
      if (mockSceneContext.delayedCallCallbacks.length > 0) {
        mockSceneContext.delayedCallCallbacks[0]();
      }

      // Set readyState to OPEN and trigger onopen
      mockWebSocketInstance.readyState = 1;
      if (mockWebSocketInstance.onopen) {
        mockWebSocketInstance.onopen(new Event('open'));
      }

      await new Promise(resolve => setTimeout(resolve, 10));

      // Verify input.on was called for pointerdown
      expect(inputOnMock).toHaveBeenCalledWith('pointerdown', expect.any(Function));
    });

    it('should setup R key for reload after connection', async () => {
      const mockSceneContext = createMockScene();
      const reloadKeyOnMock = vi.fn();
      const addKeyMock = vi.fn().mockReturnValue({
        on: reloadKeyOnMock,
      });
      mockSceneContext.input = {
        ...mockSceneContext.input,
        on: vi.fn(),
        keyboard: {
          addKey: addKeyMock,
          addKeys: mockSceneContext.input.keyboard.addKeys,
        },
      };
      Object.assign(scene, mockSceneContext);

      scene.create();

      // Trigger the delayed callback to start connection
      if (mockSceneContext.delayedCallCallbacks.length > 0) {
        mockSceneContext.delayedCallCallbacks[0]();
      }

      // Set readyState to OPEN and trigger onopen
      mockWebSocketInstance.readyState = 1;
      if (mockWebSocketInstance.onopen) {
        mockWebSocketInstance.onopen(new Event('open'));
      }

      await new Promise(resolve => setTimeout(resolve, 10));

      // Verify R key was added
      expect(addKeyMock).toHaveBeenCalledWith('R');

      // Verify 'down' handler was registered
      expect(reloadKeyOnMock).toHaveBeenCalledWith('down', expect.any(Function));
    });

    it('should trigger reload when R key is pressed', async () => {
      const mockSceneContext = createMockScene();
      let reloadKeyHandler: (() => void) | null = null;

      // Create separate mocks for each key (R and E)
      const reloadKeyOnMock = vi.fn((_event: string, handler: () => void) => {
        if (_event === 'down') {
          reloadKeyHandler = handler;
        }
      });
      const pickupKeyOnMock = vi.fn();

      const addKeyMock = vi.fn((key: string) => {
        if (key === 'R') {
          return { on: reloadKeyOnMock };
        } else if (key === 'E') {
          return { on: pickupKeyOnMock };
        }
        return { on: vi.fn() };
      });

      mockSceneContext.input = {
        ...mockSceneContext.input,
        on: vi.fn(),
        keyboard: {
          addKey: addKeyMock,
          addKeys: mockSceneContext.input.keyboard.addKeys,
        },
      };
      Object.assign(scene, mockSceneContext);

      scene.create();

      // Trigger the delayed callback to start connection
      if (mockSceneContext.delayedCallCallbacks.length > 0) {
        mockSceneContext.delayedCallCallbacks[0]();
      }

      // Set readyState to OPEN and trigger onopen
      mockWebSocketInstance.readyState = 1;
      if (mockWebSocketInstance.onopen) {
        mockWebSocketInstance.onopen(new Event('open'));
      }

      await new Promise(resolve => setTimeout(resolve, 10));

      // Spy on shootingManager.reload
      const reloadSpy = vi.spyOn(scene['shootingManager'], 'reload');

      // Trigger the reload key handler
      expect(reloadKeyHandler).not.toBeNull();
      reloadKeyHandler!();

      expect(reloadSpy).toHaveBeenCalled();
    });

    it('should trigger shoot with correct aim angle on pointerdown', async () => {
      const mockSceneContext = createMockScene();
      let pointerdownHandler: (() => void) | null = null;
      const inputOnMock = vi.fn((_event: string, handler: () => void) => {
        if (_event === 'pointerdown') {
          pointerdownHandler = handler;
        }
      });
      mockSceneContext.input = {
        ...mockSceneContext.input,
        on: inputOnMock,
        keyboard: {
          addKey: vi.fn().mockReturnValue({
            on: vi.fn(),
          }),
          addKeys: mockSceneContext.input.keyboard.addKeys,
        },
      };
      Object.assign(scene, mockSceneContext);

      scene.create();

      // Trigger the delayed callback to start connection
      if (mockSceneContext.delayedCallCallbacks.length > 0) {
        mockSceneContext.delayedCallCallbacks[0]();
      }

      // Set readyState to OPEN and trigger onopen
      mockWebSocketInstance.readyState = 1;
      if (mockWebSocketInstance.onopen) {
        mockWebSocketInstance.onopen(new Event('open'));
      }

      await new Promise(resolve => setTimeout(resolve, 10));

      // Spy on shootingManager methods
      const setAimAngleSpy = vi.spyOn(scene['shootingManager'], 'setAimAngle');
      const shootSpy = vi.spyOn(scene['shootingManager'], 'shoot');

      // Mock inputManager.getAimAngle to return a specific angle
      vi.spyOn(scene['inputManager'], 'getAimAngle').mockReturnValue(1.5);

      // Trigger the pointerdown handler
      expect(pointerdownHandler).not.toBeNull();
      pointerdownHandler!();

      expect(setAimAngleSpy).toHaveBeenCalledWith(1.5);
      expect(shootSpy).toHaveBeenCalled();
    });

    it('should handle missing keyboard gracefully', async () => {
      const mockSceneContext = createMockScene();
      // Test when keyboard is not available (mobile devices, etc.)
      (mockSceneContext.input as { keyboard: unknown }).keyboard = null;
      mockSceneContext.input.on = vi.fn();
      Object.assign(scene, mockSceneContext);

      scene.create();

      // Trigger the delayed callback to start connection
      if (mockSceneContext.delayedCallCallbacks.length > 0) {
        mockSceneContext.delayedCallCallbacks[0]();
      }

      // Set readyState to OPEN and trigger onopen
      mockWebSocketInstance.readyState = 1;
      if (mockWebSocketInstance.onopen) {
        mockWebSocketInstance.onopen(new Event('open'));
      }

      // Should not throw error
      await expect(new Promise(resolve => setTimeout(resolve, 10))).resolves.toBeUndefined();
    });
  });

  describe('message handling', () => {
    it('should handle projectile:spawn messages and create projectiles', async () => {
      const mockSceneContext = createMockScene();
      Object.assign(scene, mockSceneContext);

      scene.create();

      // Trigger the delayed callback to create WebSocket
      if (mockSceneContext.delayedCallCallbacks.length > 0) {
        mockSceneContext.delayedCallCallbacks[0]();
      }

      // First send room:joined to set local player ID (required before projectile:spawn is processed)
      const roomJoinedMessage = {
        data: JSON.stringify({
          type: 'room:joined',
          timestamp: Date.now(),
          data: { playerId: 'local-player', roomId: 'room-1' }
        })
      };
      if (mockWebSocketInstance.onmessage) {
        mockWebSocketInstance.onmessage(roomJoinedMessage as MessageEvent);
      }

      // Mock projectileManager methods to avoid scene.add issues
      const spawnSpy = vi.spyOn(scene['projectileManager'], 'spawnProjectile').mockImplementation(() => {});
      const muzzleFlashSpy = vi.spyOn(scene['projectileManager'], 'createMuzzleFlash').mockImplementation(() => {});

      // Simulate projectile:spawn message
      const projectileSpawnMessage = {
        data: JSON.stringify({
          type: 'projectile:spawn',
          timestamp: Date.now(),
          data: {
            id: 'proj-1',
            ownerId: 'player-1',
            weaponType: 'Pistol',
            position: { x: 100, y: 200 },
            velocity: { x: 800, y: 0 }
          }
        })
      };

      if (mockWebSocketInstance.onmessage) {
        mockWebSocketInstance.onmessage(projectileSpawnMessage as MessageEvent);
      }

      expect(spawnSpy).toHaveBeenCalledWith({
        id: 'proj-1',
        ownerId: 'player-1',
        weaponType: 'Pistol',
        position: { x: 100, y: 200 },
        velocity: { x: 800, y: 0 }
      });

      expect(muzzleFlashSpy).toHaveBeenCalledWith(100, 200, 'Pistol');
    });

    it('should handle projectile:destroy messages and remove projectiles', async () => {
      const mockSceneContext = createMockScene();
      Object.assign(scene, mockSceneContext);

      scene.create();

      // Trigger the delayed callback to create WebSocket
      if (mockSceneContext.delayedCallCallbacks.length > 0) {
        mockSceneContext.delayedCallCallbacks[0]();
      }

      // Spy on projectileManager.removeProjectile
      const removeSpy = vi.spyOn(scene['projectileManager'], 'removeProjectile');

      // Simulate projectile:destroy message
      const projectileDestroyMessage = {
        data: JSON.stringify({
          type: 'projectile:destroy',
          timestamp: Date.now(),
          data: {
            id: 'proj-1'
          }
        })
      };

      if (mockWebSocketInstance.onmessage) {
        mockWebSocketInstance.onmessage(projectileDestroyMessage as MessageEvent);
      }

      expect(removeSpy).toHaveBeenCalledWith('proj-1');
    });
  });

  describe('Damage Event Handlers', () => {
    it('should register player:damaged message handler', async () => {
      const mockSceneContext = createMockScene();
      Object.assign(scene, mockSceneContext);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      scene.create();

      // Trigger the delayed callback to create WebSocket
      if (mockSceneContext.delayedCallCallbacks.length > 0) {
        mockSceneContext.delayedCallCallbacks[0]();
      }

      // Simulate player:damaged message
      const damagedMessage = {
        data: JSON.stringify({
          type: 'player:damaged',
          timestamp: Date.now(),
          data: {
            victimId: 'victim-1',
            attackerId: 'attacker-1',
            damage: 25,
            newHealth: 75,
            projectileId: 'proj-1'
          }
        })
      };

      if (mockWebSocketInstance.onmessage) {
        mockWebSocketInstance.onmessage(damagedMessage as MessageEvent);
      }

      // Verify handler was called and logged damage
      expect(consoleSpy).toHaveBeenCalledWith(
        'Player victim-1 took 25 damage from attacker-1 (health: 75)'
      );

      consoleSpy.mockRestore();
    });

    it('should register hit:confirmed message handler', async () => {
      const mockSceneContext = createMockScene();
      Object.assign(scene, mockSceneContext);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      scene.create();

      // Trigger the delayed callback to create WebSocket
      if (mockSceneContext.delayedCallCallbacks.length > 0) {
        mockSceneContext.delayedCallCallbacks[0]();
      }

      // Simulate hit:confirmed message
      const hitConfirmedMessage = {
        data: JSON.stringify({
          type: 'hit:confirmed',
          timestamp: Date.now(),
          data: {
            victimId: 'victim-1',
            damage: 25,
            projectileId: 'proj-1'
          }
        })
      };

      if (mockWebSocketInstance.onmessage) {
        mockWebSocketInstance.onmessage(hitConfirmedMessage as MessageEvent);
      }

      // Verify handler was called and logged hit confirmation
      expect(consoleSpy).toHaveBeenCalledWith(
        'Hit confirmed! Dealt 25 damage to victim-1'
      );

      consoleSpy.mockRestore();
    });

    it('should register player:death message handler', async () => {
      const mockSceneContext = createMockScene();
      Object.assign(scene, mockSceneContext);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      scene.create();

      // Trigger the delayed callback to create WebSocket
      if (mockSceneContext.delayedCallCallbacks.length > 0) {
        mockSceneContext.delayedCallCallbacks[0]();
      }

      // Simulate player:death message
      const deathMessage = {
        data: JSON.stringify({
          type: 'player:death',
          timestamp: Date.now(),
          data: {
            victimId: 'victim-1',
            attackerId: 'attacker-1'
          }
        })
      };

      if (mockWebSocketInstance.onmessage) {
        mockWebSocketInstance.onmessage(deathMessage as MessageEvent);
      }

      // Verify handler was called and logged death event
      expect(consoleSpy).toHaveBeenCalledWith(
        'Player victim-1 was killed by attacker-1'
      );

      consoleSpy.mockRestore();
    });

    it('should register player:respawn message handler', async () => {
      const mockSceneContext = createMockScene();
      Object.assign(scene, mockSceneContext);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      scene.create();

      // Trigger the delayed callback to create WebSocket
      if (mockSceneContext.delayedCallCallbacks.length > 0) {
        mockSceneContext.delayedCallCallbacks[0]();
      }

      // Simulate player:respawn message
      const respawnMessage = {
        data: JSON.stringify({
          type: 'player:respawn',
          timestamp: Date.now(),
          data: {
            playerId: 'player-1',
            position: { x: 500, y: 300 },
            health: 100
          }
        })
      };

      if (mockWebSocketInstance.onmessage) {
        mockWebSocketInstance.onmessage(respawnMessage as MessageEvent);
      }

      // Verify handler was called and logged respawn event
      expect(consoleSpy).toHaveBeenCalledWith(
        'Player player-1 respawned at (500, 300)'
      );

      consoleSpy.mockRestore();
    });
  });

  describe('automatic weapon hold-to-fire', () => {
    it('should setup pointerup handler after connection', async () => {
      const mockSceneContext = createMockScene();
      const inputOnMock = vi.fn();
      mockSceneContext.input = {
        ...mockSceneContext.input,
        on: inputOnMock,
        keyboard: {
          addKey: vi.fn().mockReturnValue({
            on: vi.fn(),
          }),
          addKeys: mockSceneContext.input.keyboard.addKeys,
        },
      };
      Object.assign(scene, mockSceneContext);

      scene.create();

      // Trigger the delayed callback to start connection
      if (mockSceneContext.delayedCallCallbacks.length > 0) {
        mockSceneContext.delayedCallCallbacks[0]();
      }

      // Set readyState to OPEN and trigger onopen
      mockWebSocketInstance.readyState = 1;
      if (mockWebSocketInstance.onopen) {
        mockWebSocketInstance.onopen(new Event('open'));
      }

      await new Promise(resolve => setTimeout(resolve, 10));

      // Verify input.on was called for both pointerdown and pointerup
      expect(inputOnMock).toHaveBeenCalledWith('pointerdown', expect.any(Function));
      expect(inputOnMock).toHaveBeenCalledWith('pointerup', expect.any(Function));
    });

    it('should continuously fire automatic weapon (Uzi) when pointer held', async () => {
      const mockSceneContext = createMockScene();
      let pointerdownHandler: (() => void) | null = null;
      let pointerupHandler: (() => void) | null = null;

      const inputOnMock = vi.fn((event: string, handler: () => void) => {
        if (event === 'pointerdown') {
          pointerdownHandler = handler;
        } else if (event === 'pointerup') {
          pointerupHandler = handler;
        }
      });

      mockSceneContext.input = {
        ...mockSceneContext.input,
        on: inputOnMock,
        keyboard: {
          addKey: vi.fn().mockReturnValue({
            on: vi.fn(),
          }),
          addKeys: mockSceneContext.input.keyboard.addKeys,
        },
      };
      Object.assign(scene, mockSceneContext);

      scene.create();

      // Trigger the delayed callback to start connection
      if (mockSceneContext.delayedCallCallbacks.length > 0) {
        mockSceneContext.delayedCallCallbacks[0]();
      }

      // Set readyState to OPEN and trigger onopen
      mockWebSocketInstance.readyState = 1;
      if (mockWebSocketInstance.onopen) {
        mockWebSocketInstance.onopen(new Event('open'));
      }

      await new Promise(resolve => setTimeout(resolve, 10));

      // Set weapon to Uzi (automatic)
      vi.spyOn(scene['shootingManager'], 'isAutomatic').mockReturnValue(true);
      vi.spyOn(scene['shootingManager'], 'isMeleeWeapon').mockReturnValue(false);
      vi.spyOn(scene['inputManager'], 'getAimAngle').mockReturnValue(0);

      const shootSpy = vi.spyOn(scene['shootingManager'], 'shoot').mockReturnValue(true);

      // Trigger pointerdown
      expect(pointerdownHandler).not.toBeNull();
      pointerdownHandler!();

      // First shot from pointerdown
      expect(shootSpy).toHaveBeenCalledTimes(1);
      shootSpy.mockClear();

      // Call update() while pointer held (simulate automatic fire)
      scene.update(0, 16);
      expect(shootSpy).toHaveBeenCalled();

      // Release pointer
      expect(pointerupHandler).not.toBeNull();
      pointerupHandler!();
      shootSpy.mockClear();

      // Update should not fire after pointer released
      scene.update(0, 16);
      expect(shootSpy).not.toHaveBeenCalled();
    });

    it('should NOT continuously fire semi-automatic weapon (Pistol) when pointer held', async () => {
      const mockSceneContext = createMockScene();
      let pointerdownHandler: (() => void) | null = null;

      const inputOnMock = vi.fn((event: string, handler: () => void) => {
        if (event === 'pointerdown') {
          pointerdownHandler = handler;
        }
      });

      mockSceneContext.input = {
        ...mockSceneContext.input,
        on: inputOnMock,
        keyboard: {
          addKey: vi.fn().mockReturnValue({
            on: vi.fn(),
          }),
          addKeys: mockSceneContext.input.keyboard.addKeys,
        },
      };
      Object.assign(scene, mockSceneContext);

      scene.create();

      // Trigger the delayed callback to start connection
      if (mockSceneContext.delayedCallCallbacks.length > 0) {
        mockSceneContext.delayedCallCallbacks[0]();
      }

      // Set readyState to OPEN and trigger onopen
      mockWebSocketInstance.readyState = 1;
      if (mockWebSocketInstance.onopen) {
        mockWebSocketInstance.onopen(new Event('open'));
      }

      await new Promise(resolve => setTimeout(resolve, 10));

      // Set weapon to Pistol (semi-automatic)
      vi.spyOn(scene['shootingManager'], 'isAutomatic').mockReturnValue(false);
      vi.spyOn(scene['shootingManager'], 'isMeleeWeapon').mockReturnValue(false);
      vi.spyOn(scene['inputManager'], 'getAimAngle').mockReturnValue(0);

      const shootSpy = vi.spyOn(scene['shootingManager'], 'shoot').mockReturnValue(true);

      // Trigger pointerdown
      expect(pointerdownHandler).not.toBeNull();
      pointerdownHandler!();

      // First shot from pointerdown
      expect(shootSpy).toHaveBeenCalledTimes(1);
      shootSpy.mockClear();

      // Call update() while pointer held - should NOT fire for semi-auto
      scene.update(0, 16);
      expect(shootSpy).not.toHaveBeenCalled();
    });

    it('should NOT fire automatic weapon when pointer not held', async () => {
      const mockSceneContext = createMockScene();
      mockSceneContext.input = {
        ...mockSceneContext.input,
        on: vi.fn(),
        keyboard: {
          addKey: vi.fn().mockReturnValue({
            on: vi.fn(),
          }),
          addKeys: mockSceneContext.input.keyboard.addKeys,
        },
      };
      Object.assign(scene, mockSceneContext);

      scene.create();

      // Trigger the delayed callback to start connection
      if (mockSceneContext.delayedCallCallbacks.length > 0) {
        mockSceneContext.delayedCallCallbacks[0]();
      }

      // Set readyState to OPEN and trigger onopen
      mockWebSocketInstance.readyState = 1;
      if (mockWebSocketInstance.onopen) {
        mockWebSocketInstance.onopen(new Event('open'));
      }

      await new Promise(resolve => setTimeout(resolve, 10));

      // Set weapon to Uzi (automatic)
      vi.spyOn(scene['shootingManager'], 'isAutomatic').mockReturnValue(true);
      vi.spyOn(scene['shootingManager'], 'isMeleeWeapon').mockReturnValue(false);

      const shootSpy = vi.spyOn(scene['shootingManager'], 'shoot');

      // Call update() without pressing pointer - should NOT fire
      scene.update(0, 16);
      expect(shootSpy).not.toHaveBeenCalled();
    });

    it('should continue melee weapon behavior (no auto-attack)', async () => {
      const mockSceneContext = createMockScene();
      let pointerdownHandler: (() => void) | null = null;

      const inputOnMock = vi.fn((event: string, handler: () => void) => {
        if (event === 'pointerdown') {
          pointerdownHandler = handler;
        }
      });

      mockSceneContext.input = {
        ...mockSceneContext.input,
        on: inputOnMock,
        keyboard: {
          addKey: vi.fn().mockReturnValue({
            on: vi.fn(),
          }),
          addKeys: mockSceneContext.input.keyboard.addKeys,
        },
      };
      Object.assign(scene, mockSceneContext);

      scene.create();

      // Trigger the delayed callback to start connection
      if (mockSceneContext.delayedCallCallbacks.length > 0) {
        mockSceneContext.delayedCallCallbacks[0]();
      }

      // Set readyState to OPEN and trigger onopen
      mockWebSocketInstance.readyState = 1;
      if (mockWebSocketInstance.onopen) {
        mockWebSocketInstance.onopen(new Event('open'));
      }

      await new Promise(resolve => setTimeout(resolve, 10));

      // Set weapon to Bat (melee)
      vi.spyOn(scene['shootingManager'], 'isAutomatic').mockReturnValue(false);
      vi.spyOn(scene['shootingManager'], 'isMeleeWeapon').mockReturnValue(true);
      vi.spyOn(scene['inputManager'], 'getAimAngle').mockReturnValue(0);

      const meleeAttackSpy = vi.spyOn(scene['shootingManager'], 'meleeAttack').mockReturnValue(true);
      const shootSpy = vi.spyOn(scene['shootingManager'], 'shoot');

      // Trigger pointerdown - should call meleeAttack, not shoot
      expect(pointerdownHandler).not.toBeNull();
      pointerdownHandler!();

      expect(meleeAttackSpy).toHaveBeenCalledTimes(1);
      expect(shootSpy).not.toHaveBeenCalled();
      meleeAttackSpy.mockClear();

      // Call update() while pointer held - should NOT auto-repeat melee
      scene.update(0, 16);
      expect(meleeAttackSpy).not.toHaveBeenCalled();
      expect(shootSpy).not.toHaveBeenCalled();
    });
  });
});
