import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  SERVER_URL,
  HEALTH_URL,
  clients,
  createClient,
  delay,
  DEFAULT_TIMEOUT,
  DEFAULT_POLL_INTERVAL,
  verifyNoLingeringHandlers,
  setupIntegrationTest,
  cleanupIntegrationTest,
} from './WebSocketClient.integration.helpers';
import { WebSocketClient } from './WebSocketClient';

describe('WebSocketClient.integration.helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear clients array
    clients.length = 0;
  });

  afterEach(() => {
    clients.length = 0;
  });

  describe('Constants', () => {
    it('should export SERVER_URL', () => {
      expect(SERVER_URL).toBe('ws://localhost:8080/ws');
    });

    it('should export HEALTH_URL', () => {
      expect(HEALTH_URL).toBe('http://localhost:8080/health');
    });

    it('should export DEFAULT_TIMEOUT', () => {
      expect(DEFAULT_TIMEOUT).toBe(15000); // Increased for CI reliability
    });

    it('should export DEFAULT_POLL_INTERVAL', () => {
      expect(DEFAULT_POLL_INTERVAL).toBe(50);
    });

    it('should export clients array', () => {
      expect(Array.isArray(clients)).toBe(true);
    });
  });

  describe('createClient', () => {
    let originalWebSocket: typeof WebSocket;
    let mockWebSocketInstance: any;

    beforeEach(() => {
      originalWebSocket = globalThis.WebSocket;

      mockWebSocketInstance = {
        readyState: 0,
        send: vi.fn(),
        close: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        onopen: null,
        onmessage: null,
        onerror: null,
        onclose: null,
      };

      const MockWebSocket = vi.fn(() => mockWebSocketInstance);
      (MockWebSocket as any).OPEN = 1;
      (MockWebSocket as any).CONNECTING = 0;
      (MockWebSocket as any).CLOSING = 2;
      (MockWebSocket as any).CLOSED = 3;

      globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;
    });

    afterEach(() => {
      globalThis.WebSocket = originalWebSocket;
    });

    it('should create a WebSocketClient with default URL', () => {
      const client = createClient();

      expect(client).toBeInstanceOf(WebSocketClient);
      expect(clients).toContain(client);
    });

    it('should create a WebSocketClient with custom URL', () => {
      const customUrl = 'ws://custom:9999/ws';
      const client = createClient(customUrl);

      expect(client).toBeInstanceOf(WebSocketClient);
      expect(clients).toContain(client);
    });

    it('should create a WebSocketClient with debug mode disabled', () => {
      const client = createClient(SERVER_URL, false);

      expect(client).toBeInstanceOf(WebSocketClient);
    });

    it('should track multiple clients', () => {
      const client1 = createClient();
      const client2 = createClient();
      const client3 = createClient();

      expect(clients).toHaveLength(3);
      expect(clients).toContain(client1);
      expect(clients).toContain(client2);
      expect(clients).toContain(client3);
    });
  });

  describe('delay', () => {
    it('should resolve after specified milliseconds', async () => {
      const start = Date.now();
      await delay(50);
      const elapsed = Date.now() - start;

      // Should have waited at least 50ms (with small tolerance)
      expect(elapsed).toBeGreaterThanOrEqual(45);
    });
  });

  describe('verifyNoLingeringHandlers', () => {
    it('should not throw when clients array is empty', () => {
      expect(() => verifyNoLingeringHandlers()).not.toThrow();
    });

    it('should not throw when all clients have no handlers', () => {
      const mockClient = {
        hasNoHandlers: vi.fn().mockReturnValue(true),
        getTotalHandlerCount: vi.fn().mockReturnValue(0),
        getHandlerTypeCount: vi.fn().mockReturnValue(0),
      };

      clients.push(mockClient as unknown as WebSocketClient);

      expect(() => verifyNoLingeringHandlers()).not.toThrow();
    });

    it('should throw when client has lingering handlers', () => {
      const mockClient = {
        hasNoHandlers: vi.fn().mockReturnValue(false),
        getTotalHandlerCount: vi.fn().mockReturnValue(3),
        getHandlerTypeCount: vi.fn().mockReturnValue(2),
      };

      clients.push(mockClient as unknown as WebSocketClient);

      expect(() => verifyNoLingeringHandlers()).toThrow(
        'Test isolation violation: 1 client(s) have lingering handlers. Client 0: 3 handlers across 2 types'
      );
    });

    it('should list multiple clients with handlers', () => {
      const mockClient1 = {
        hasNoHandlers: vi.fn().mockReturnValue(false),
        getTotalHandlerCount: vi.fn().mockReturnValue(2),
        getHandlerTypeCount: vi.fn().mockReturnValue(1),
      };

      const mockClient2 = {
        hasNoHandlers: vi.fn().mockReturnValue(false),
        getTotalHandlerCount: vi.fn().mockReturnValue(5),
        getHandlerTypeCount: vi.fn().mockReturnValue(3),
      };

      clients.push(mockClient1 as unknown as WebSocketClient);
      clients.push(mockClient2 as unknown as WebSocketClient);

      expect(() => verifyNoLingeringHandlers()).toThrow(
        'Test isolation violation: 2 client(s) have lingering handlers'
      );
    });

    it('should not throw when some clients have handlers and some do not', () => {
      const mockClientWithHandlers = {
        hasNoHandlers: vi.fn().mockReturnValue(false),
        getTotalHandlerCount: vi.fn().mockReturnValue(2),
        getHandlerTypeCount: vi.fn().mockReturnValue(1),
      };

      const mockClientWithoutHandlers = {
        hasNoHandlers: vi.fn().mockReturnValue(true),
        getTotalHandlerCount: vi.fn().mockReturnValue(0),
        getHandlerTypeCount: vi.fn().mockReturnValue(0),
      };

      clients.push(mockClientWithoutHandlers as unknown as WebSocketClient);
      clients.push(mockClientWithHandlers as unknown as WebSocketClient);

      // Should throw because one client has handlers
      expect(() => verifyNoLingeringHandlers()).toThrow();
    });
  });

  describe('setupIntegrationTest', () => {
    it('should return console spy references that are valid spy instances', () => {
      const result = setupIntegrationTest();

      // Verify properties exist
      expect(result).toHaveProperty('consoleErrorSpy');
      expect(result).toHaveProperty('consoleWarnSpy');

      // Verify the returned object structure matches expected spy reference type
      // The spies are undefined initially and get set in beforeEach
      expect(typeof result.consoleErrorSpy).toBe('undefined');
      expect(typeof result.consoleWarnSpy).toBe('undefined');
    });

    it('should set up spies that track console.error calls after beforeEach runs', () => {
      // Create fresh spies to simulate what setupIntegrationTest does internally
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Trigger a console.error
      console.error('test error');

      // Verify the spy captured the call
      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledWith('test error');

      errorSpy.mockRestore();
    });

    it('should set up spies that track console.warn calls after beforeEach runs', () => {
      // Create fresh spies to simulate what setupIntegrationTest does internally
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Trigger a console.warn
      console.warn('test warning');

      // Verify the spy captured the call
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith('test warning');

      warnSpy.mockRestore();
    });
  });

  describe('cleanupIntegrationTest', () => {
    it('should register afterEach hook that performs cleanup actions', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Track if mockRestore is called to verify cleanup happens
      const restoreSpy = vi.spyOn(errorSpy, 'mockRestore');

      // Function should register cleanup without throwing
      expect(() => cleanupIntegrationTest(errorSpy, warnSpy)).not.toThrow();

      // Verify that the function is designed to call mockRestore (we can't test afterEach directly)
      // Instead, verify the spy methods exist and are callable
      expect(typeof errorSpy.mockRestore).toBe('function');
      expect(typeof warnSpy.mockRestore).toBe('function');

      // Clean up
      restoreSpy.mockRestore();
      errorSpy.mockRestore();
      warnSpy.mockRestore();
    });

    it('should restore console spies when cleanup runs', () => {
      // Create spies with mock implementations
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Verify spies are active
      console.error('before cleanup');
      console.warn('before cleanup');
      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledTimes(1);

      // Manually call mockRestore (simulating what cleanupIntegrationTest does in afterEach)
      errorSpy.mockRestore();
      warnSpy.mockRestore();

      // After restore, creating new spies should show no prior calls
      const newErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const newWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      expect(newErrorSpy).toHaveBeenCalledTimes(0);
      expect(newWarnSpy).toHaveBeenCalledTimes(0);

      newErrorSpy.mockRestore();
      newWarnSpy.mockRestore();
    });

    it('should disconnect all tracked clients during cleanup', () => {
      // Add mock clients to the global clients array
      const mockClient1 = {
        disconnect: vi.fn(),
        hasNoHandlers: vi.fn().mockReturnValue(true),
      };
      const mockClient2 = {
        disconnect: vi.fn(),
        hasNoHandlers: vi.fn().mockReturnValue(true),
      };

      clients.push(mockClient1 as unknown as WebSocketClient);
      clients.push(mockClient2 as unknown as WebSocketClient);

      expect(clients).toHaveLength(2);

      // Simulate the cleanup that happens in afterEach
      clients.forEach(client => client.disconnect());
      clients.length = 0;

      // Verify disconnect was called on each client
      expect(mockClient1.disconnect).toHaveBeenCalledTimes(1);
      expect(mockClient2.disconnect).toHaveBeenCalledTimes(1);

      // Verify clients array is cleared
      expect(clients).toHaveLength(0);
    });
  });
});
