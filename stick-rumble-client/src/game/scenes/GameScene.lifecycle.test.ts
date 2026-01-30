import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GameScene } from './GameScene';
import { createMockScene, createMockWebSocket } from './GameScene.test.setup';

// Mock Phaser for InputManager
vi.mock('phaser', () => ({
  default: {
    Scene: class {
      scene = { key: '', restart: vi.fn() };
      events = { once: vi.fn() };
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

describe('GameScene - Lifecycle Management', () => {
  let scene: GameScene;
  let originalWebSocket: typeof WebSocket;

  beforeEach(() => {
    // Save original WebSocket
    originalWebSocket = globalThis.WebSocket;

    // Create mock WebSocket
    const { MockWebSocket } = createMockWebSocket();
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

  describe('shutdown event handler', () => {
    it('should register shutdown event handler during create', () => {
      const mockSceneContext = createMockScene();
      Object.assign(scene, mockSceneContext);

      // Mock events.once to capture the shutdown handler
      const mockEventsOnce = vi.fn();
      (scene as unknown as { events: { once: typeof mockEventsOnce } }).events.once = mockEventsOnce;

      // Call create
      scene.create();

      // Should register shutdown event
      expect(mockEventsOnce).toHaveBeenCalledWith('shutdown', expect.any(Function));
    });
  });

  describe('cleanup lifecycle', () => {
    it('should have cleanup method defined', () => {
      expect((scene as unknown as { cleanup: () => void }).cleanup).toBeDefined();
      expect(typeof (scene as unknown as { cleanup: () => void }).cleanup).toBe('function');
    });

    it('should call cleanup when shutdown event fires', () => {
      const mockSceneContext = createMockScene();
      Object.assign(scene, mockSceneContext);

      // Mock cleanup method to verify it's called
      const cleanupMock = vi.fn();
      (scene as unknown as { cleanup: () => void }).cleanup = cleanupMock;

      // Capture shutdown handler
      let shutdownHandler: (() => void) | undefined;
      const mockEventsOnce = vi.fn((event: string, handler: () => void) => {
        if (event === 'shutdown') {
          shutdownHandler = handler;
        }
      });
      (scene as unknown as { events: { once: typeof mockEventsOnce } }).events.once = mockEventsOnce;

      // Call create to register shutdown handler
      scene.create();

      // Verify handler was registered
      expect(shutdownHandler).toBeDefined();

      // Fire shutdown event
      shutdownHandler!();

      // Should call cleanup
      expect(cleanupMock).toHaveBeenCalled();
    });

    it('should cleanup all managers when cleanup is called', () => {
      const mockSceneContext = createMockScene();
      Object.assign(scene, mockSceneContext);

      // Create mocks for all managers
      const mockEventHandlers = { destroy: vi.fn() };
      const mockPlayerManager = { destroy: vi.fn() };
      const mockProjectileManager = { destroy: vi.fn() };
      const mockWeaponCrateManager = { destroy: vi.fn() };
      const mockMeleeWeaponManager = { destroy: vi.fn() };
      const mockPickupPromptUI = { destroy: vi.fn() };
      const mockHealthBarUI = { destroy: vi.fn() };
      const mockKillFeedUI = { destroy: vi.fn() };
      const mockUI = { destroy: vi.fn() };
      const mockSpectator = { destroy: vi.fn() };
      const mockAudioManager = { destroy: vi.fn() };
      const mockInputManager = { destroy: vi.fn() };
      const mockShootingManager = { destroy: vi.fn() };
      const mockWsClient = { disconnect: vi.fn() };

      // Assign mocked managers to scene
      (scene as any).eventHandlers = mockEventHandlers;
      (scene as any).playerManager = mockPlayerManager;
      (scene as any).projectileManager = mockProjectileManager;
      (scene as any).weaponCrateManager = mockWeaponCrateManager;
      (scene as any).meleeWeaponManager = mockMeleeWeaponManager;
      (scene as any).pickupPromptUI = mockPickupPromptUI;
      (scene as any).healthBarUI = mockHealthBarUI;
      (scene as any).killFeedUI = mockKillFeedUI;
      (scene as any).ui = mockUI;
      (scene as any).spectator = mockSpectator;
      (scene as any).audioManager = mockAudioManager;
      (scene as any).inputManager = mockInputManager;
      (scene as any).shootingManager = mockShootingManager;
      (scene as any).wsClient = mockWsClient;

      // Call cleanup
      (scene as any).cleanup();

      // Verify all destroy methods were called
      expect(mockEventHandlers.destroy).toHaveBeenCalled();
      expect(mockPlayerManager.destroy).toHaveBeenCalled();
      expect(mockProjectileManager.destroy).toHaveBeenCalled();
      expect(mockWeaponCrateManager.destroy).toHaveBeenCalled();
      expect(mockMeleeWeaponManager.destroy).toHaveBeenCalled();
      expect(mockPickupPromptUI.destroy).toHaveBeenCalled();
      expect(mockHealthBarUI.destroy).toHaveBeenCalled();
      expect(mockKillFeedUI.destroy).toHaveBeenCalled();
      expect(mockUI.destroy).toHaveBeenCalled();
      expect(mockSpectator.destroy).toHaveBeenCalled();
      expect(mockAudioManager.destroy).toHaveBeenCalled();
      expect(mockInputManager.destroy).toHaveBeenCalled();
      expect(mockShootingManager.destroy).toHaveBeenCalled();
      expect(mockWsClient.disconnect).toHaveBeenCalled();
    });

    it('should not throw when cleanup is called with undefined managers', () => {
      // Don't assign any managers - they will be undefined
      expect(() => {
        (scene as any).cleanup();
      }).not.toThrow();
    });
  });

  describe('restartMatch', () => {
    it('should be defined and callable', () => {
      expect(scene.restartMatch).toBeDefined();
      expect(typeof scene.restartMatch).toBe('function');
    });

    it('should call scene.restart', () => {
      const mockSceneContext = createMockScene();
      Object.assign(scene, mockSceneContext);

      // Mock scene.restart
      const restartSpy = vi.fn();
      (scene as unknown as { scene: { restart: typeof restartSpy } }).scene.restart = restartSpy;

      // Call restartMatch
      scene.restartMatch();

      // Should call scene.restart
      expect(restartSpy).toHaveBeenCalled();
    });
  });
});
