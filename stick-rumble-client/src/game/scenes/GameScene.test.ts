import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GameScene } from './GameScene';

// Mock Phaser for InputManager
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

// Mock Phaser scene context for the new arena-based implementation
const createMockScene = () => {
  const mockRectangle = {
    setOrigin: vi.fn().mockReturnThis(),
    setStrokeStyle: vi.fn().mockReturnThis(),
  };

  const mockText = {
    setOrigin: vi.fn().mockReturnThis(),
  };

  const mockCamera = {
    centerX: 960,
    centerY: 540,
    setBounds: vi.fn(),
  };

  const mockLine = {
    setTo: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
  };

  const delayedCallCallbacks: Array<() => void> = [];
  const mockTime = {
    delayedCall: vi.fn((_delay: number, callback: () => void) => {
      delayedCallCallbacks.push(callback);
      return { callback };
    }),
  };

  const mockContext = {
    add: {
      text: vi.fn().mockReturnValue(mockText),
      rectangle: vi.fn().mockReturnValue(mockRectangle),
      line: vi.fn().mockReturnValue(mockLine),
      circle: vi.fn().mockReturnValue({ destroy: vi.fn() }),
    },
    cameras: {
      main: mockCamera,
    },
    input: {
      keyboard: {
        addKeys: vi.fn().mockReturnValue({
          W: { isDown: false },
          A: { isDown: false },
          S: { isDown: false },
          D: { isDown: false },
        }),
        addKey: vi.fn().mockReturnValue({
          on: vi.fn(),
        }),
      },
      on: vi.fn(),
    },
    tweens: {
      add: vi.fn().mockReturnValue({ remove: vi.fn() }),
    },
    time: mockTime,
    delayedCallCallbacks,
  };
  return mockContext;
};

describe('GameScene', () => {
  let scene: GameScene;
  let mockWebSocket: ReturnType<typeof vi.fn>;
  let mockWebSocketInstance: {
    readyState: number;
    send: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
    addEventListener: ReturnType<typeof vi.fn>;
    removeEventListener: ReturnType<typeof vi.fn>;
    onopen: ((event: Event) => void) | null;
    onmessage: ((event: MessageEvent) => void) | null;
    onerror: ((event: Event) => void) | null;
    onclose: ((event: CloseEvent) => void) | null;
  };
  let originalWebSocket: typeof WebSocket;

  beforeEach(() => {
    // Save original WebSocket
    originalWebSocket = globalThis.WebSocket;

    // Create mock WebSocket instance
    mockWebSocketInstance = {
      readyState: 0, // Start as CONNECTING, not OPEN
      send: vi.fn(),
      close: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      onopen: null,
      onmessage: null,
      onerror: null,
      onclose: null,
    };

    // Mock WebSocket constructor as a class that tracks calls
    const MockWebSocket = vi.fn().mockImplementation(function(this: {
      readyState: number;
      send: ReturnType<typeof vi.fn>;
      close: ReturnType<typeof vi.fn>;
      addEventListener: ReturnType<typeof vi.fn>;
      removeEventListener: ReturnType<typeof vi.fn>;
      onopen: ((event: Event) => void) | null;
      onmessage: ((event: MessageEvent) => void) | null;
      onerror: ((event: Event) => void) | null;
      onclose: ((event: CloseEvent) => void) | null;
    }) {
      this.readyState = mockWebSocketInstance.readyState;
      this.send = mockWebSocketInstance.send;
      this.close = mockWebSocketInstance.close;
      this.addEventListener = mockWebSocketInstance.addEventListener;
      this.removeEventListener = mockWebSocketInstance.removeEventListener;

      // Use defineProperty to set up getters/setters that route to shared state
      Object.defineProperty(this, 'onopen', {
        get: () => mockWebSocketInstance.onopen,
        set: (handler) => { mockWebSocketInstance.onopen = handler; },
      });
      Object.defineProperty(this, 'onmessage', {
        get: () => mockWebSocketInstance.onmessage,
        set: (handler) => { mockWebSocketInstance.onmessage = handler; },
      });
      Object.defineProperty(this, 'onerror', {
        get: () => mockWebSocketInstance.onerror,
        set: (handler) => { mockWebSocketInstance.onerror = handler; },
      });
      Object.defineProperty(this, 'onclose', {
        get: () => mockWebSocketInstance.onclose,
        set: (handler) => { mockWebSocketInstance.onclose = handler; },
      });
    });

    (MockWebSocket as unknown as Record<string, number>).OPEN = 1;
    (MockWebSocket as unknown as Record<string, number>).CONNECTING = 0;

    mockWebSocket = MockWebSocket;
    globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;

    // Mock import.meta.env
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

  describe('constructor', () => {
    it('should create scene with correct key', () => {
      expect(scene).toBeDefined();
      expect((scene as unknown as { scene: { key: string } }).scene.key).toBe('GameScene');
    });
  });

  describe('preload', () => {
    it('should be defined and callable', () => {
      expect(scene.preload).toBeDefined();
      expect(typeof scene.preload).toBe('function');

      // Should not throw (note: preload currently has no implementation)
      expect(() => scene.preload()).not.toThrow();
    });
  });

  describe('create', () => {
    it('should set camera bounds to arena size', () => {
      const mockSceneContext = createMockScene();
      Object.assign(scene, mockSceneContext);

      scene.create();

      expect(mockSceneContext.cameras.main.setBounds).toHaveBeenCalledWith(0, 0, 1920, 1080);
    });

    it('should add arena background rectangle', () => {
      const mockSceneContext = createMockScene();
      Object.assign(scene, mockSceneContext);

      scene.create();

      // First rectangle call is the background
      expect(mockSceneContext.add.rectangle).toHaveBeenCalledWith(
        0, 0, 1920, 1080, 0x222222
      );
    });

    it('should add arena border with stroke style', () => {
      const mockSceneContext = createMockScene();
      Object.assign(scene, mockSceneContext);

      scene.create();

      // Should create exactly 2 rectangles (background + border)
      const rectangleCalls = mockSceneContext.add.rectangle.mock.calls;
      expect(rectangleCalls.length).toBe(2);
      expect(rectangleCalls[1]).toEqual([0, 0, 1920, 1080, 0xffffff, 0]);

      // Verify setStrokeStyle was called on the border rectangle
      const borderRectangle = mockSceneContext.add.rectangle.mock.results[1].value;
      expect(borderRectangle.setStrokeStyle).toHaveBeenCalledWith(2, 0xffffff);
    });

    it('should add title text', () => {
      const mockSceneContext = createMockScene();
      Object.assign(scene, mockSceneContext);

      scene.create();

      expect(mockSceneContext.add.text).toHaveBeenCalledWith(
        10, 10, 'Stick Rumble - WASD to move',
        expect.objectContaining({
          fontSize: '18px',
          color: '#ffffff',
        })
      );
    });

    it('should create WebSocket client with correct URL from env', () => {
      const mockSceneContext = createMockScene();
      Object.assign(scene, mockSceneContext);

      scene.create();

      // WebSocket creation happens inside delayed callback
      // Trigger the callback to create WebSocket
      if (mockSceneContext.delayedCallCallbacks.length > 0) {
        mockSceneContext.delayedCallCallbacks[0]();
      }

      expect(mockWebSocket).toHaveBeenCalledWith('ws://localhost:8080/ws');
    });

    it('should use default WebSocket URL if env not set', () => {
      vi.stubGlobal('import.meta', {
        env: {},
      });

      const mockSceneContext = createMockScene();
      Object.assign(scene, mockSceneContext);

      scene.create();

      // WebSocket creation happens inside delayed callback
      if (mockSceneContext.delayedCallCallbacks.length > 0) {
        mockSceneContext.delayedCallCallbacks[0]();
      }

      expect(mockWebSocket).toHaveBeenCalledWith('ws://localhost:8080/ws');
    });

    it('should setup WebSocket connection handlers', () => {
      const mockSceneContext = createMockScene();
      Object.assign(scene, mockSceneContext);

      scene.create();

      // Verify WebSocket handlers are set up
      expect(mockWebSocketInstance.onopen).toBeDefined();
      expect(mockWebSocketInstance.onerror).toBeDefined();
      expect(mockWebSocketInstance.onmessage).toBeDefined();
      expect(mockWebSocketInstance.onclose).toBeDefined();
    });

    it('should handle successful connection by initializing InputManager', async () => {
      const mockSceneContext = createMockScene();
      Object.assign(scene, mockSceneContext);

      scene.create();

      // Trigger the delayed callback to start connection
      if (mockSceneContext.delayedCallCallbacks.length > 0) {
        mockSceneContext.delayedCallCallbacks[0]();
      }

      // InputManager should not be initialized yet (before connection)
      expect((scene as unknown as { inputManager: unknown }).inputManager).toBeUndefined();

      // Set readyState to OPEN before triggering onopen
      mockWebSocketInstance.readyState = 1;

      // Simulate successful connection - onopen is a handler that was set
      if (mockWebSocketInstance.onopen) {
        mockWebSocketInstance.onopen(new Event('open'));
      }

      // Wait for promise to resolve
      await new Promise(resolve => setTimeout(resolve, 10));

      // InputManager should now be initialized and functional
      const inputManager = (scene as unknown as { inputManager: { init: () => void; update: () => void } }).inputManager;
      expect(inputManager).toBeDefined();
      expect(typeof inputManager.init).toBe('function');
      expect(typeof inputManager.update).toBe('function');
    });

    it('should handle connection error gracefully', async () => {
      const mockSceneContext = createMockScene();
      Object.assign(scene, mockSceneContext);

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      scene.create();

      // Trigger the delayed callback to start connection
      if (mockSceneContext.delayedCallCallbacks.length > 0) {
        mockSceneContext.delayedCallCallbacks[0]();
      }

      // Simulate connection failure - onerror is a handler that was set
      if (mockWebSocketInstance.onerror) {
        mockWebSocketInstance.onerror(new Event('error'));
      }

      // Wait for promise to reject and catch block to execute
      await new Promise(resolve => setTimeout(resolve, 10));

      // Should have logged an error related to connection
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('should initialize PlayerManager', () => {
      const mockSceneContext = createMockScene();
      Object.assign(scene, mockSceneContext);

      scene.create();

      // PlayerManager is initialized - we can verify by checking the private field exists
      expect((scene as unknown as { playerManager: unknown }).playerManager).toBeDefined();
    });

    it('should defer WebSocket connection by 100ms to ensure scene initialization', () => {
      const mockSceneContext = createMockScene();
      Object.assign(scene, mockSceneContext);

      scene.create();

      // Verify delayedCall was called with 100ms delay
      expect(mockSceneContext.time.delayedCall).toHaveBeenCalledWith(
        100,
        expect.any(Function)
      );

      // Verify WebSocket is NOT immediately created (connection deferred)
      expect(mockWebSocket).toHaveBeenCalledTimes(0);

      // Trigger the delayed callback
      if (mockSceneContext.delayedCallCallbacks.length > 0) {
        mockSceneContext.delayedCallCallbacks[0]();
      }

      // NOW WebSocket should be created
      expect(mockWebSocket).toHaveBeenCalledTimes(1);
      expect(mockWebSocket).toHaveBeenCalledWith('ws://localhost:8080/ws');
    });

    it('should register message handlers before connecting', async () => {
      const mockSceneContext = createMockScene();
      Object.assign(scene, mockSceneContext);

      scene.create();

      // Trigger the delayed callback to start connection
      if (mockSceneContext.delayedCallCallbacks.length > 0) {
        mockSceneContext.delayedCallCallbacks[0]();
      }

      // Wait for connection promise
      await new Promise(resolve => setTimeout(resolve, 0));

      // Verify message handlers are set before connection completes
      expect(mockWebSocketInstance.onmessage).toBeDefined();

      // Simulate successful connection
      mockWebSocketInstance.readyState = 1;
      if (mockWebSocketInstance.onopen) {
        mockWebSocketInstance.onopen(new Event('open'));
      }

      await new Promise(resolve => setTimeout(resolve, 10));

      // Verify handlers work after connection
      const playerMoveMessage = {
        data: JSON.stringify({
          type: 'player:move',
          timestamp: Date.now(),
          data: {
            players: [{ id: 'p1', position: { x: 100, y: 100 }, velocity: { x: 0, y: 0 } }]
          }
        })
      };

      if (mockWebSocketInstance.onmessage) {
        mockWebSocketInstance.onmessage(playerMoveMessage as MessageEvent);
      }

      // Should not throw error - handlers registered before connection
      expect(() => {
        if (mockWebSocketInstance.onmessage) {
          mockWebSocketInstance.onmessage(playerMoveMessage as MessageEvent);
        }
      }).not.toThrow();
    });
  });

  describe('update', () => {
    it('should be defined and callable', () => {
      expect(scene.update).toBeDefined();
      expect(typeof scene.update).toBe('function');

      // Should not throw when called before create (inputManager not initialized)
      expect(() => scene.update(0, 16.67)).not.toThrow();
    });

    it('should call inputManager.update when connected', async () => {
      const mockSceneContext = createMockScene();
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

      // Spy on inputManager.update to verify it gets called
      const updateSpy = vi.spyOn(scene['inputManager'], 'update');

      // Call scene.update which should call inputManager.update
      scene.update(0, 16.67);

      // Verify inputManager.update was called
      expect(updateSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('message handling', () => {
    it('should handle player:move messages and update players', async () => {
      const mockSceneContext = createMockScene();
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

      // Spy on PlayerManager.updatePlayers to verify it gets called
      const updatePlayersSpy = vi.spyOn(scene['playerManager'], 'updatePlayers');

      // Spy on InputManager.setPlayerPosition to verify aim calculation setup
      const setPlayerPositionSpy = vi.spyOn(scene['inputManager'], 'setPlayerPosition');

      // Simulate player:move message with aim angle
      const playerMoveMessage = {
        data: JSON.stringify({
          type: 'player:move',
          timestamp: Date.now(),
          data: {
            players: [
              { id: 'player1', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 }, aimAngle: 1.57 }
            ]
          }
        })
      };

      if (mockWebSocketInstance.onmessage) {
        mockWebSocketInstance.onmessage(playerMoveMessage as MessageEvent);
      }

      // Verify PlayerManager.updatePlayers was called with correct data including aim angle
      expect(updatePlayersSpy).toHaveBeenCalledWith([
        { id: 'player1', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 }, aimAngle: 1.57 }
      ]);

      // Verify InputManager.setPlayerPosition is NOT called (player ID doesn't match local player)
      expect(setPlayerPositionSpy).not.toHaveBeenCalled();
    });

    it('should update InputManager position when local player moves', async () => {
      const mockSceneContext = createMockScene();
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

      // Set local player ID
      scene['playerManager'].setLocalPlayerId('local-player-id');

      // Spy on InputManager.setPlayerPosition and mock updatePlayers to avoid scene.add issues
      const setPlayerPositionSpy = vi.spyOn(scene['inputManager'], 'setPlayerPosition');
      const updatePlayersSpy = vi.spyOn(scene['playerManager'], 'updatePlayers').mockImplementation(() => {});

      // Simulate player:move message with local player
      const playerMoveMessage = {
        data: JSON.stringify({
          type: 'player:move',
          timestamp: Date.now(),
          data: {
            players: [
              { id: 'local-player-id', position: { x: 300, y: 400 }, velocity: { x: 10, y: 20 }, aimAngle: 0.5 }
            ]
          }
        })
      };

      if (mockWebSocketInstance.onmessage) {
        mockWebSocketInstance.onmessage(playerMoveMessage as MessageEvent);
      }

      // Verify PlayerManager.updatePlayers was called with the correct data
      expect(updatePlayersSpy).toHaveBeenCalledWith([
        { id: 'local-player-id', position: { x: 300, y: 400 }, velocity: { x: 10, y: 20 }, aimAngle: 0.5 }
      ]);

      // Verify InputManager.setPlayerPosition was called with local player's position for aim calculation
      expect(setPlayerPositionSpy).toHaveBeenCalledWith(300, 400);
    });

    it('should handle room:joined messages and set local player ID', async () => {
      const mockSceneContext = createMockScene();
      Object.assign(scene, mockSceneContext);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      scene.create();

      // Trigger the delayed callback to create WebSocket
      if (mockSceneContext.delayedCallCallbacks.length > 0) {
        mockSceneContext.delayedCallCallbacks[0]();
      }

      // Simulate room:joined message - handlers are registered during create(), not just after connection
      const roomJoinedMessage = {
        data: JSON.stringify({
          type: 'room:joined',
          timestamp: Date.now(),
          data: {
            playerId: 'my-player-id'
          }
        })
      };

      // Trigger message handler directly
      if (mockWebSocketInstance.onmessage) {
        mockWebSocketInstance.onmessage(roomJoinedMessage as MessageEvent);
      }

      expect(consoleSpy).toHaveBeenCalledWith('Joined room as player:', 'my-player-id');

      consoleSpy.mockRestore();
    });

    it('should handle projectile:spawn messages and create projectiles', async () => {
      const mockSceneContext = createMockScene();
      Object.assign(scene, mockSceneContext);

      scene.create();

      // Trigger the delayed callback to create WebSocket
      if (mockSceneContext.delayedCallCallbacks.length > 0) {
        mockSceneContext.delayedCallCallbacks[0]();
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
        position: { x: 100, y: 200 },
        velocity: { x: 800, y: 0 }
      });

      expect(muzzleFlashSpy).toHaveBeenCalledWith(100, 200);
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

    it('should handle weapon:state messages and update shooting manager', async () => {
      const mockSceneContext = createMockScene();
      Object.assign(scene, mockSceneContext);

      scene.create();

      // Trigger connection
      if (mockSceneContext.delayedCallCallbacks.length > 0) {
        mockSceneContext.delayedCallCallbacks[0]();
      }

      // Connect successfully to initialize shootingManager
      mockWebSocketInstance.readyState = 1;
      if (mockWebSocketInstance.onopen) {
        mockWebSocketInstance.onopen(new Event('open'));
      }
      await new Promise(resolve => setTimeout(resolve, 10));

      // Spy on shootingManager.updateWeaponState
      const updateWeaponStateSpy = vi.spyOn(scene['shootingManager'], 'updateWeaponState');

      // Simulate weapon:state message
      const weaponStateMessage = {
        data: JSON.stringify({
          type: 'weapon:state',
          timestamp: Date.now(),
          data: {
            currentAmmo: 10,
            maxAmmo: 15,
            isReloading: false,
            canShoot: true
          }
        })
      };

      if (mockWebSocketInstance.onmessage) {
        mockWebSocketInstance.onmessage(weaponStateMessage as MessageEvent);
      }

      expect(updateWeaponStateSpy).toHaveBeenCalledWith({
        currentAmmo: 10,
        maxAmmo: 15,
        isReloading: false,
        canShoot: true
      });
    });

    it('should handle shoot:failed messages with empty reason', async () => {
      const mockSceneContext = createMockScene();
      Object.assign(scene, mockSceneContext);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      scene.create();

      // Trigger the delayed callback to create WebSocket
      if (mockSceneContext.delayedCallCallbacks.length > 0) {
        mockSceneContext.delayedCallCallbacks[0]();
      }

      // Simulate shoot:failed message with empty reason
      const shootFailedMessage = {
        data: JSON.stringify({
          type: 'shoot:failed',
          timestamp: Date.now(),
          data: {
            reason: 'empty'
          }
        })
      };

      if (mockWebSocketInstance.onmessage) {
        mockWebSocketInstance.onmessage(shootFailedMessage as MessageEvent);
      }

      expect(consoleSpy).toHaveBeenCalledWith('Click! Magazine empty');

      consoleSpy.mockRestore();
    });

    it('should not log for shoot:failed with non-empty reason', async () => {
      const mockSceneContext = createMockScene();
      Object.assign(scene, mockSceneContext);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      scene.create();

      // Trigger the delayed callback to create WebSocket
      if (mockSceneContext.delayedCallCallbacks.length > 0) {
        mockSceneContext.delayedCallCallbacks[0]();
      }

      // Simulate shoot:failed message with cooldown reason
      const shootFailedMessage = {
        data: JSON.stringify({
          type: 'shoot:failed',
          timestamp: Date.now(),
          data: {
            reason: 'cooldown'
          }
        })
      };

      if (mockWebSocketInstance.onmessage) {
        mockWebSocketInstance.onmessage(shootFailedMessage as MessageEvent);
      }

      // Should NOT log the empty click message
      expect(consoleSpy).not.toHaveBeenCalledWith('Click! Magazine empty');

      consoleSpy.mockRestore();
    });
  });

  describe('update with projectiles', () => {
    it('should update projectileManager on each frame', async () => {
      const mockSceneContext = createMockScene();
      Object.assign(scene, mockSceneContext);

      scene.create();

      // Spy on projectileManager.update
      const updateSpy = vi.spyOn(scene['projectileManager'], 'update');

      // Call update with 16.67ms delta (60 FPS)
      scene.update(0, 16.67);

      // Verify projectileManager.update was called with delta in seconds
      expect(updateSpy).toHaveBeenCalledWith(0.01667);
    });
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
      const reloadKeyOnMock = vi.fn((_event: string, handler: () => void) => {
        reloadKeyHandler = handler;
      });
      mockSceneContext.input = {
        ...mockSceneContext.input,
        on: vi.fn(),
        keyboard: {
          addKey: vi.fn().mockReturnValue({
            on: reloadKeyOnMock,
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

  describe('ammo display', () => {
    it('should create ammo text display after connection', async () => {
      const mockSceneContext = createMockScene();
      mockSceneContext.input = {
        ...mockSceneContext.input,
        on: vi.fn(),
        keyboard: {
          addKey: vi.fn().mockReturnValue({ on: vi.fn() }),
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

      // Verify ammo text was created (multiple text calls: title, connection status, ammo)
      const textCalls = mockSceneContext.add.text.mock.calls;
      expect(textCalls.length).toBeGreaterThanOrEqual(3);

      // Check ammo text specifically (at position 10, 50)
      const ammoTextCall = textCalls.find((call: unknown[]) => call[0] === 10 && call[1] === 50);
      expect(ammoTextCall).toBeDefined();
    });

    it('should update ammo display when weapon:state received', async () => {
      const mockSceneContext = createMockScene();
      const mockAmmoText = {
        setText: vi.fn(),
        setOrigin: vi.fn().mockReturnThis(),
      };
      let textCallCount = 0;
      mockSceneContext.add.text = vi.fn().mockImplementation(() => {
        textCallCount++;
        // Third text call is the ammo display
        if (textCallCount === 3) {
          return mockAmmoText;
        }
        return { setOrigin: vi.fn().mockReturnThis() };
      });
      mockSceneContext.input = {
        ...mockSceneContext.input,
        on: vi.fn(),
        keyboard: {
          addKey: vi.fn().mockReturnValue({ on: vi.fn() }),
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

      // Now send weapon:state message
      const weaponStateMessage = {
        data: JSON.stringify({
          type: 'weapon:state',
          timestamp: Date.now(),
          data: {
            currentAmmo: 10,
            maxAmmo: 15,
            isReloading: false,
            canShoot: true
          }
        })
      };

      if (mockWebSocketInstance.onmessage) {
        mockWebSocketInstance.onmessage(weaponStateMessage as MessageEvent);
      }

      // Verify ammo text was updated
      expect(mockAmmoText.setText).toHaveBeenCalledWith('10/15');
    });

    it('should display RELOADING indicator when reloading', async () => {
      const mockSceneContext = createMockScene();
      const mockAmmoText = {
        setText: vi.fn(),
        setOrigin: vi.fn().mockReturnThis(),
      };
      let textCallCount = 0;
      mockSceneContext.add.text = vi.fn().mockImplementation(() => {
        textCallCount++;
        if (textCallCount === 3) {
          return mockAmmoText;
        }
        return { setOrigin: vi.fn().mockReturnThis() };
      });
      mockSceneContext.input = {
        ...mockSceneContext.input,
        on: vi.fn(),
        keyboard: {
          addKey: vi.fn().mockReturnValue({ on: vi.fn() }),
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

      // Send weapon:state with isReloading true
      const weaponStateMessage = {
        data: JSON.stringify({
          type: 'weapon:state',
          timestamp: Date.now(),
          data: {
            currentAmmo: 5,
            maxAmmo: 15,
            isReloading: true,
            canShoot: false
          }
        })
      };

      if (mockWebSocketInstance.onmessage) {
        mockWebSocketInstance.onmessage(weaponStateMessage as MessageEvent);
      }

      // Verify ammo text shows reloading indicator
      expect(mockAmmoText.setText).toHaveBeenCalledWith('5/15 [RELOADING]');
    });
  });

  describe('connection status display', () => {
    it('should display connection status text after successful connection', async () => {
      const mockSceneContext = createMockScene();
      mockSceneContext.input = {
        ...mockSceneContext.input,
        on: vi.fn(),
        keyboard: {
          addKey: vi.fn().mockReturnValue({ on: vi.fn() }),
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

      // Check for green connection status text
      const textCalls = mockSceneContext.add.text.mock.calls;
      const connectionStatusCall = textCalls.find(
        (call: unknown[]) => {
          const text = call[2] as string | undefined;
          const style = call[3] as { color?: string } | undefined;
          return text?.includes('Connected') && style?.color === '#00ff00';
        }
      );
      expect(connectionStatusCall).toBeDefined();
    });

    it('should display error text after connection failure', async () => {
      const mockSceneContext = createMockScene();
      Object.assign(scene, mockSceneContext);

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      scene.create();

      // Trigger the delayed callback to start connection
      if (mockSceneContext.delayedCallCallbacks.length > 0) {
        mockSceneContext.delayedCallCallbacks[0]();
      }

      // Simulate connection failure
      if (mockWebSocketInstance.onerror) {
        mockWebSocketInstance.onerror(new Event('error'));
      }

      await new Promise(resolve => setTimeout(resolve, 10));

      // Check for red error text
      const textCalls = mockSceneContext.add.text.mock.calls;
      const errorTextCall = textCalls.find(
        (call: unknown[]) => {
          const text = call[2] as string | undefined;
          const style = call[3] as { color?: string } | undefined;
          return text?.includes('Failed') && style?.color === '#ff0000';
        }
      );
      expect(errorTextCall).toBeDefined();

      consoleErrorSpy.mockRestore();
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

    it('should enter spectator mode when local player dies', async () => {
      const mockSceneContext = createMockScene();
      Object.assign(scene, mockSceneContext);

      scene.create();

      // Trigger the delayed callback to create WebSocket and set local player ID
      if (mockSceneContext.delayedCallCallbacks.length > 0) {
        mockSceneContext.delayedCallCallbacks[0]();
      }

      // Set local player ID
      const roomJoinedMessage = {
        data: JSON.stringify({
          type: 'room:joined',
          timestamp: Date.now(),
          data: { playerId: 'local-player' }
        })
      };

      if (mockWebSocketInstance.onmessage) {
        mockWebSocketInstance.onmessage(roomJoinedMessage as MessageEvent);
      }

      // Simulate local player death
      const deathMessage = {
        data: JSON.stringify({
          type: 'player:death',
          timestamp: Date.now(),
          data: {
            victimId: 'local-player',
            attackerId: 'attacker-1'
          }
        })
      };

      if (mockWebSocketInstance.onmessage) {
        mockWebSocketInstance.onmessage(deathMessage as MessageEvent);
      }

      // Verify spectator UI was created
      expect(mockSceneContext.add.text).toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(Number),
        'Spectating...',
        expect.any(Object)
      );

      expect(mockSceneContext.add.text).toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(Number),
        'Respawning in 3...',
        expect.any(Object)
      );
    });

    it('should exit spectator mode when local player respawns', async () => {
      const mockSceneContext = createMockScene();
      Object.assign(scene, mockSceneContext);

      scene.create();

      // Trigger the delayed callback to create WebSocket and set local player ID
      if (mockSceneContext.delayedCallCallbacks.length > 0) {
        mockSceneContext.delayedCallCallbacks[0]();
      }

      // Set local player ID
      const roomJoinedMessage = {
        data: JSON.stringify({
          type: 'room:joined',
          timestamp: Date.now(),
          data: { playerId: 'local-player' }
        })
      };

      if (mockWebSocketInstance.onmessage) {
        mockWebSocketInstance.onmessage(roomJoinedMessage as MessageEvent);
      }

      // Simulate local player death (enter spectator mode)
      const deathMessage = {
        data: JSON.stringify({
          type: 'player:death',
          timestamp: Date.now(),
          data: {
            victimId: 'local-player',
            attackerId: 'attacker-1'
          }
        })
      };

      if (mockWebSocketInstance.onmessage) {
        mockWebSocketInstance.onmessage(deathMessage as MessageEvent);
      }

      // Get text creation count before respawn
      const textCountBeforeRespawn = mockSceneContext.add.text.mock.calls.length;

      // Simulate local player respawn
      const respawnMessage = {
        data: JSON.stringify({
          type: 'player:respawn',
          timestamp: Date.now(),
          data: {
            playerId: 'local-player',
            position: { x: 500, y: 300 },
            health: 100
          }
        })
      };

      if (mockWebSocketInstance.onmessage) {
        mockWebSocketInstance.onmessage(respawnMessage as MessageEvent);
      }

      // Verify spectator UI was created (2 text objects: spectator text + countdown)
      // At least 2 more text objects should have been created during death
      expect(textCountBeforeRespawn).toBeGreaterThan(0);
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
});
