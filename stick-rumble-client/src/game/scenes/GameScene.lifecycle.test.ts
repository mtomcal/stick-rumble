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
