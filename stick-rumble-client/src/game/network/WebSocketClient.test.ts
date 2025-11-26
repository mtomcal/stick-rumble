import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebSocketClient, Message } from './WebSocketClient';

describe('WebSocketClient', () => {
  let mockWebSocket: any;
  let mockWebSocketInstance: any;
  let originalWebSocket: any;

  beforeEach(() => {
    // Save original WebSocket
    originalWebSocket = global.WebSocket;

    // Create mock WebSocket instance
    mockWebSocketInstance = {
      readyState: 1, // WebSocket.OPEN
      send: vi.fn(),
      close: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      onopen: null,
      onmessage: null,
      onerror: null,
      onclose: null,
    };

    // Mock WebSocket constructor as a proper class
    mockWebSocket = vi.fn(function(this: any) {
      return mockWebSocketInstance;
    });

    global.WebSocket = mockWebSocket as any;

    // Mock WebSocket constants
    (global.WebSocket as any).OPEN = 1;
    (global.WebSocket as any).CONNECTING = 0;
    (global.WebSocket as any).CLOSING = 2;
    (global.WebSocket as any).CLOSED = 3;
  });

  afterEach(() => {
    // Restore original WebSocket
    global.WebSocket = originalWebSocket;
    vi.clearAllMocks();
  });

  describe('connect', () => {
    it('should create WebSocket connection with correct URL', async () => {
      const client = new WebSocketClient('ws://localhost:8080/ws');

      const connectPromise = client.connect();

      // Trigger onopen callback
      if (mockWebSocketInstance.onopen) {
        mockWebSocketInstance.onopen({});
      }

      await connectPromise;

      expect(mockWebSocket).toHaveBeenCalledWith('ws://localhost:8080/ws');
    });

    it('should log connection success', async () => {
      const consoleSpy = vi.spyOn(console, 'log');
      const client = new WebSocketClient('ws://localhost:8080/ws');

      const connectPromise = client.connect();

      // Trigger onopen callback
      if (mockWebSocketInstance.onopen) {
        mockWebSocketInstance.onopen({});
      }

      await connectPromise;

      expect(consoleSpy).toHaveBeenCalledWith('WebSocket connected');
      consoleSpy.mockRestore();
    });

    it('should reject on connection error', async () => {
      const client = new WebSocketClient('ws://localhost:8080/ws');

      const connectPromise = client.connect();

      // Trigger onerror callback
      const error = new Error('Connection failed');
      if (mockWebSocketInstance.onerror) {
        mockWebSocketInstance.onerror(error);
      }

      await expect(connectPromise).rejects.toThrow();
    });
  });

  describe('send', () => {
    it('should send JSON serialized message when connected', async () => {
      const client = new WebSocketClient('ws://localhost:8080/ws');

      const connectPromise = client.connect();
      if (mockWebSocketInstance.onopen) {
        mockWebSocketInstance.onopen({});
      }
      await connectPromise;

      const message: Message = {
        type: 'test',
        timestamp: Date.now(),
        data: { message: 'Hello!' }
      };

      client.send(message);

      expect(mockWebSocketInstance.send).toHaveBeenCalledWith(
        JSON.stringify(message)
      );
    });

    it('should warn when sending while not connected', () => {
      const consoleSpy = vi.spyOn(console, 'warn');
      const client = new WebSocketClient('ws://localhost:8080/ws');

      const message: Message = {
        type: 'test',
        timestamp: Date.now()
      };

      client.send(message);

      expect(consoleSpy).toHaveBeenCalledWith(
        'WebSocket not connected, cannot send message'
      );
      consoleSpy.mockRestore();
    });

    it('should not send when WebSocket is not in OPEN state', async () => {
      const client = new WebSocketClient('ws://localhost:8080/ws');

      const connectPromise = client.connect();
      if (mockWebSocketInstance.onopen) {
        mockWebSocketInstance.onopen({});
      }
      await connectPromise;

      // Change state to CLOSING
      mockWebSocketInstance.readyState = 2; // WebSocket.CLOSING

      const message: Message = {
        type: 'test',
        timestamp: Date.now()
      };

      client.send(message);

      expect(mockWebSocketInstance.send).not.toHaveBeenCalled();
    });
  });

  describe('message routing', () => {
    it('should route messages to registered handlers', async () => {
      const client = new WebSocketClient('ws://localhost:8080/ws');

      const connectPromise = client.connect();
      if (mockWebSocketInstance.onopen) {
        mockWebSocketInstance.onopen({});
      }
      await connectPromise;

      const handler = vi.fn();
      client.on('test', handler);

      const message: Message = {
        type: 'test',
        timestamp: Date.now(),
        data: { foo: 'bar' }
      };

      // Simulate incoming message
      if (mockWebSocketInstance.onmessage) {
        mockWebSocketInstance.onmessage({
          data: JSON.stringify(message)
        });
      }

      expect(handler).toHaveBeenCalledWith({ foo: 'bar' });
    });

    it('should warn for unhandled message types', async () => {
      const consoleSpy = vi.spyOn(console, 'warn');
      const client = new WebSocketClient('ws://localhost:8080/ws');

      const connectPromise = client.connect();
      if (mockWebSocketInstance.onopen) {
        mockWebSocketInstance.onopen({});
      }
      await connectPromise;

      const message: Message = {
        type: 'unknown',
        timestamp: Date.now()
      };

      // Simulate incoming message
      if (mockWebSocketInstance.onmessage) {
        mockWebSocketInstance.onmessage({
          data: JSON.stringify(message)
        });
      }

      expect(consoleSpy).toHaveBeenCalledWith(
        'No handler for message type:',
        'unknown'
      );
      consoleSpy.mockRestore();
    });

    it('should handle JSON parse errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error');
      const client = new WebSocketClient('ws://localhost:8080/ws');

      const connectPromise = client.connect();
      if (mockWebSocketInstance.onopen) {
        mockWebSocketInstance.onopen({});
      }
      await connectPromise;

      // Simulate incoming invalid JSON
      if (mockWebSocketInstance.onmessage) {
        mockWebSocketInstance.onmessage({
          data: 'not valid json'
        });
      }

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to parse message:',
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });
  });

  describe('reconnection logic', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should attempt reconnection on close', async () => {
      const consoleSpy = vi.spyOn(console, 'log');
      const client = new WebSocketClient('ws://localhost:8080/ws');

      const connectPromise = client.connect();
      if (mockWebSocketInstance.onopen) {
        mockWebSocketInstance.onopen({});
      }
      await connectPromise;

      // Trigger close event
      if (mockWebSocketInstance.onclose) {
        mockWebSocketInstance.onclose({ code: 1006, reason: '' });
      }

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Reconnecting in 1000ms... (attempt 1)')
      );
      consoleSpy.mockRestore();
    });

    it('should use exponential backoff for reconnection delays', async () => {
      const consoleSpy = vi.spyOn(console, 'log');
      const client = new WebSocketClient('ws://localhost:8080/ws');

      const connectPromise = client.connect();
      if (mockWebSocketInstance.onopen) {
        mockWebSocketInstance.onopen({});
      }
      await connectPromise;

      // First close - 1000ms delay (attempt 1)
      if (mockWebSocketInstance.onclose) {
        mockWebSocketInstance.onclose({ code: 1006, reason: '' });
      }
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('1000ms... (attempt 1)')
      );

      // Don't trigger onopen - let it fail to reconnect
      // Second close without successful reconnect - 2000ms delay (attempt 2)
      vi.advanceTimersByTime(1100);
      if (mockWebSocketInstance.onclose) {
        mockWebSocketInstance.onclose({ code: 1006, reason: '' });
      }
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('2000ms... (attempt 2)')
      );

      consoleSpy.mockRestore();
    });

    it('should stop reconnecting after max attempts', async () => {
      const consoleSpy = vi.spyOn(console, 'error');
      const client = new WebSocketClient('ws://localhost:8080/ws');

      const connectPromise = client.connect();
      if (mockWebSocketInstance.onopen) {
        mockWebSocketInstance.onopen({});
      }
      await connectPromise;

      // Trigger close 3 times
      for (let i = 0; i < 3; i++) {
        if (mockWebSocketInstance.onclose) {
          mockWebSocketInstance.onclose({ code: 1006, reason: '' });
        }
        vi.advanceTimersByTime(10000); // Advance past all delays
      }

      // Fourth close should not reconnect
      if (mockWebSocketInstance.onclose) {
        mockWebSocketInstance.onclose({ code: 1006, reason: '' });
      }

      expect(consoleSpy).toHaveBeenCalledWith('Max reconnection attempts reached');
      consoleSpy.mockRestore();
    });
  });

  describe('disconnect', () => {
    it('should close WebSocket connection', async () => {
      const client = new WebSocketClient('ws://localhost:8080/ws');

      const connectPromise = client.connect();
      if (mockWebSocketInstance.onopen) {
        mockWebSocketInstance.onopen({});
      }
      await connectPromise;

      client.disconnect();

      expect(mockWebSocketInstance.close).toHaveBeenCalledWith(
        1000,
        'Client disconnect'
      );
    });

    it('should handle disconnect when not connected', () => {
      const client = new WebSocketClient('ws://localhost:8080/ws');

      // Should not throw error
      expect(() => client.disconnect()).not.toThrow();
    });
  });
});
