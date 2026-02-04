import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebSocketClient, type Message } from './WebSocketClient';
import { NetworkSimulator } from './NetworkSimulator';
import type { InputStateData } from '@stick-rumble/events-schema';

describe('WebSocketClient', () => {
  let mockWebSocket: any;
  let mockWebSocketInstance: any;
  let originalWebSocket: any;

  beforeEach(() => {
    // Save original WebSocket
    originalWebSocket = globalThis.WebSocket;

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

    globalThis.WebSocket = mockWebSocket as any;

    // Mock WebSocket constants
    (globalThis.WebSocket as any).OPEN = 1;
    (globalThis.WebSocket as any).CONNECTING = 0;
    (globalThis.WebSocket as any).CLOSING = 2;
    (globalThis.WebSocket as any).CLOSED = 3;
  });

  afterEach(() => {
    // Restore original WebSocket
    globalThis.WebSocket = originalWebSocket;
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

    it('should support multiple handlers for the same message type', async () => {
      const client = new WebSocketClient('ws://localhost:8080/ws');

      const connectPromise = client.connect();
      if (mockWebSocketInstance.onopen) {
        mockWebSocketInstance.onopen({});
      }
      await connectPromise;

      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const handler3 = vi.fn();

      client.on('test', handler1);
      client.on('test', handler2);
      client.on('test', handler3);

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

      // All three handlers should be called
      expect(handler1).toHaveBeenCalledWith({ foo: 'bar' });
      expect(handler2).toHaveBeenCalledWith({ foo: 'bar' });
      expect(handler3).toHaveBeenCalledWith({ foo: 'bar' });
    });

    it('should allow removing specific handler with off()', async () => {
      const client = new WebSocketClient('ws://localhost:8080/ws');

      const connectPromise = client.connect();
      if (mockWebSocketInstance.onopen) {
        mockWebSocketInstance.onopen({});
      }
      await connectPromise;

      const handler1 = vi.fn();
      const handler2 = vi.fn();

      client.on('test', handler1);
      client.on('test', handler2);

      // Remove handler1
      client.off('test', handler1);

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

      // Only handler2 should be called
      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalledWith({ foo: 'bar' });
    });

    it('should not call handler after off() is called', async () => {
      const client = new WebSocketClient('ws://localhost:8080/ws');

      const connectPromise = client.connect();
      if (mockWebSocketInstance.onopen) {
        mockWebSocketInstance.onopen({});
      }
      await connectPromise;

      const handler = vi.fn();
      client.on('test', handler);
      client.off('test', handler);

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

      expect(handler).not.toHaveBeenCalled();
    });

    it('should handle off() for non-existent handler gracefully', async () => {
      const client = new WebSocketClient('ws://localhost:8080/ws');

      const connectPromise = client.connect();
      if (mockWebSocketInstance.onopen) {
        mockWebSocketInstance.onopen({});
      }
      await connectPromise;

      const handler = vi.fn();

      // Try to remove handler that was never added
      expect(() => client.off('test', handler)).not.toThrow();
    });

    it('should handle off() for non-existent message type gracefully', async () => {
      const client = new WebSocketClient('ws://localhost:8080/ws');

      const connectPromise = client.connect();
      if (mockWebSocketInstance.onopen) {
        mockWebSocketInstance.onopen({});
      }
      await connectPromise;

      const handler = vi.fn();

      // Try to remove handler for message type with no handlers
      expect(() => client.off('nonexistent', handler)).not.toThrow();
    });

    it('should prevent memory leaks by cleaning up empty handler sets', async () => {
      const client = new WebSocketClient('ws://localhost:8080/ws');

      const connectPromise = client.connect();
      if (mockWebSocketInstance.onopen) {
        mockWebSocketInstance.onopen({});
      }
      await connectPromise;

      const handler = vi.fn();
      client.on('test', handler);
      client.off('test', handler);

      // Access private messageHandlers to verify cleanup
      const messageHandlers = (client as any).messageHandlers as Map<string, Set<(data: unknown) => void>>;

      // The 'test' key should be completely removed, not just an empty Set
      expect(messageHandlers.has('test')).toBe(false);
    });

    it('should not duplicate handlers when on() is called multiple times with same handler', async () => {
      const client = new WebSocketClient('ws://localhost:8080/ws');

      const connectPromise = client.connect();
      if (mockWebSocketInstance.onopen) {
        mockWebSocketInstance.onopen({});
      }
      await connectPromise;

      const handler = vi.fn();

      // Add the same handler twice
      client.on('test', handler);
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

      // Handler should only be called once (Set prevents duplicates)
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should silently ignore unhandled message types', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn');
      const consoleErrorSpy = vi.spyOn(console, 'error');
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

      // Should not log any warnings or errors for unhandled message types
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
      consoleWarnSpy.mockRestore();
      consoleErrorSpy.mockRestore();
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

    it('should prevent reconnection attempts after intentional disconnect', async () => {
      vi.useFakeTimers();
      const consoleSpy = vi.spyOn(console, 'log');
      const client = new WebSocketClient('ws://localhost:8080/ws');

      const connectPromise = client.connect();
      if (mockWebSocketInstance.onopen) {
        mockWebSocketInstance.onopen({});
      }
      await connectPromise;

      // Intentionally disconnect
      client.disconnect();

      // Clear the disconnect log
      consoleSpy.mockClear();

      // Simulate connection close event
      if (mockWebSocketInstance.onclose) {
        mockWebSocketInstance.onclose({ code: 1000, reason: 'Client disconnect' });
      }

      // Advance timers to allow reconnection attempt
      vi.advanceTimersByTime(2000);

      // Should NOT attempt to reconnect after intentional disconnect
      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('Reconnecting')
      );

      consoleSpy.mockRestore();
      vi.useRealTimers();
    });
  });

  describe('input recording', () => {
    it('should not record inputs by default', async () => {
      const client = new WebSocketClient('ws://localhost:8080/ws');
      const connectPromise = client.connect();

      if (mockWebSocketInstance.onopen) {
        mockWebSocketInstance.onopen({} as Event);
      }

      await connectPromise;

      const callback = vi.fn();
      client.onInputRecorded(callback);

      client.sendInputState({ up: false, down: false, left: false, right: true, aimAngle: 0, isSprinting: false, sequence: 0 } as InputStateData);

      expect(callback).not.toHaveBeenCalled();
      expect(client.getFrameNumber()).toBe(0);
    });

    it('should record inputs when enabled', async () => {
      const client = new WebSocketClient('ws://localhost:8080/ws');
      const connectPromise = client.connect();

      if (mockWebSocketInstance.onopen) {
        mockWebSocketInstance.onopen({} as Event);
      }

      await connectPromise;

      const callback = vi.fn();
      client.onInputRecorded(callback);
      client.setInputRecording(true);

      const inputData = { up: false, down: false, left: false, right: true, aimAngle: 0, isSprinting: false, sequence: 0 };
      client.sendInputState(inputData);

      expect(callback).toHaveBeenCalledOnce();
      expect(callback).toHaveBeenCalledWith(0, inputData);
      expect(client.getFrameNumber()).toBe(1);
    });

    it('should increment frame number for each input', async () => {
      const client = new WebSocketClient('ws://localhost:8080/ws');
      const connectPromise = client.connect();

      if (mockWebSocketInstance.onopen) {
        mockWebSocketInstance.onopen({} as Event);
      }

      await connectPromise;

      const callback = vi.fn();
      client.onInputRecorded(callback);
      client.setInputRecording(true);

      client.sendInputState({ up: false, down: false, left: false, right: true, aimAngle: 0, isSprinting: false, sequence: 0 } as InputStateData);
      client.sendInputState({ up: true, down: false, left: false, right: false, aimAngle: 1.5, isSprinting: false, sequence: 1 } as InputStateData);
      client.sendInputState({ up: false, down: true, left: false, right: false, aimAngle: 3.0, isSprinting: false, sequence: 2 } as InputStateData);

      expect(callback).toHaveBeenCalledTimes(3);
      expect(callback).toHaveBeenNthCalledWith(1, 0, expect.anything());
      expect(callback).toHaveBeenNthCalledWith(2, 1, expect.anything());
      expect(callback).toHaveBeenNthCalledWith(3, 2, expect.anything());
      expect(client.getFrameNumber()).toBe(3);
    });

    it('should stop recording when disabled', async () => {
      const client = new WebSocketClient('ws://localhost:8080/ws');
      const connectPromise = client.connect();

      if (mockWebSocketInstance.onopen) {
        mockWebSocketInstance.onopen({} as Event);
      }

      await connectPromise;

      const callback = vi.fn();
      client.onInputRecorded(callback);
      client.setInputRecording(true);

      client.sendInputState({ up: false, down: false, left: false, right: true, aimAngle: 0, isSprinting: false, sequence: 0 } as InputStateData);

      expect(callback).toHaveBeenCalledOnce();

      // Disable recording
      client.setInputRecording(false);
      callback.mockClear();

      client.sendInputState({ up: true, down: false, left: false, right: false, aimAngle: 1.5, isSprinting: false, sequence: 1 } as InputStateData);

      expect(callback).not.toHaveBeenCalled();
      expect(client.getFrameNumber()).toBe(1); // Should not increment when disabled
    });

    it('should reset frame number', async () => {
      const client = new WebSocketClient('ws://localhost:8080/ws');
      const connectPromise = client.connect();

      if (mockWebSocketInstance.onopen) {
        mockWebSocketInstance.onopen({} as Event);
      }

      await connectPromise;

      const callback = vi.fn();
      client.onInputRecorded(callback);
      client.setInputRecording(true);

      client.sendInputState({ up: false, down: false, left: false, right: true, aimAngle: 0, isSprinting: false, sequence: 0 } as InputStateData);
      client.sendInputState({ up: true, down: false, left: false, right: false, aimAngle: 1.5, isSprinting: false, sequence: 1 } as InputStateData);

      expect(client.getFrameNumber()).toBe(2);

      client.resetFrameNumber();

      expect(client.getFrameNumber()).toBe(0);

      client.sendInputState({ up: false, down: true, left: false, right: false, aimAngle: 3.0, isSprinting: false, sequence: 2 } as InputStateData);

      expect(callback).toHaveBeenLastCalledWith(0, expect.anything());
    });

    it('should work without callback set', async () => {
      const client = new WebSocketClient('ws://localhost:8080/ws');
      const connectPromise = client.connect();

      if (mockWebSocketInstance.onopen) {
        mockWebSocketInstance.onopen({} as Event);
      }

      await connectPromise;

      client.setInputRecording(true);

      // Should not throw without callback
      expect(() => {
        client.sendInputState({ up: false, down: false, left: false, right: true, aimAngle: 0, isSprinting: false, sequence: 0 } as InputStateData);
      }).not.toThrow();

      expect(client.getFrameNumber()).toBe(1);
    });
  });

  describe('NetworkSimulator integration', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should accept NetworkSimulator in constructor', () => {
      const simulator = new NetworkSimulator({ latency: 100, packetLoss: 5, enabled: true });
      const client = new WebSocketClient('ws://localhost:8080/ws', false, simulator);

      expect(client.getNetworkSimulator()).toBe(simulator);
    });

    it('should create default disabled simulator when none provided', () => {
      const client = new WebSocketClient('ws://localhost:8080/ws');
      const simulator = client.getNetworkSimulator();

      expect(simulator).toBeDefined();
      expect(simulator.isEnabled()).toBe(false);
    });

    it('should delay sending messages when simulator is enabled with latency', async () => {
      const simulator = new NetworkSimulator({ latency: 100, enabled: true });
      const client = new WebSocketClient('ws://localhost:8080/ws', false, simulator);

      const connectPromise = client.connect();
      if (mockWebSocketInstance.onopen) {
        mockWebSocketInstance.onopen({});
      }
      await connectPromise;

      const message: Message = { type: 'test', timestamp: Date.now(), data: { foo: 'bar' } };
      client.send(message);

      // Should not send immediately
      expect(mockWebSocketInstance.send).not.toHaveBeenCalled();

      // Advance time past latency + jitter
      vi.advanceTimersByTime(150);

      expect(mockWebSocketInstance.send).toHaveBeenCalledWith(JSON.stringify(message));
    });

    it('should drop sent messages based on packet loss rate', async () => {
      const simulator = new NetworkSimulator({ latency: 100, packetLoss: 20, enabled: true });
      const client = new WebSocketClient('ws://localhost:8080/ws', false, simulator);

      const connectPromise = client.connect();
      if (mockWebSocketInstance.onopen) {
        mockWebSocketInstance.onopen({});
      }
      await connectPromise;

      // Mock Math.random to return 0.1 (packet loss check)
      // 0.1 * 100 = 10 which is < 20, so packet should be dropped
      vi.spyOn(Math, 'random').mockReturnValue(0.1);

      const message: Message = { type: 'test', timestamp: Date.now() };
      client.send(message);

      vi.advanceTimersByTime(500);

      // Should not send due to packet loss
      expect(mockWebSocketInstance.send).not.toHaveBeenCalled();
    });

    it('should delay received messages when simulator is enabled with latency', async () => {
      const simulator = new NetworkSimulator({ latency: 100, enabled: true });
      const client = new WebSocketClient('ws://localhost:8080/ws', false, simulator);

      const connectPromise = client.connect();
      if (mockWebSocketInstance.onopen) {
        mockWebSocketInstance.onopen({});
      }
      await connectPromise;

      const handler = vi.fn();
      client.on('test', handler);

      const message: Message = { type: 'test', timestamp: Date.now(), data: { foo: 'bar' } };

      // Simulate incoming message
      if (mockWebSocketInstance.onmessage) {
        mockWebSocketInstance.onmessage({ data: JSON.stringify(message) });
      }

      // Handler should not be called immediately
      expect(handler).not.toHaveBeenCalled();

      // Advance time past latency + jitter
      vi.advanceTimersByTime(150);

      expect(handler).toHaveBeenCalledWith({ foo: 'bar' });
    });

    it('should drop received messages based on packet loss rate', async () => {
      const simulator = new NetworkSimulator({ latency: 100, packetLoss: 20, enabled: true });
      const client = new WebSocketClient('ws://localhost:8080/ws', false, simulator);

      const connectPromise = client.connect();
      if (mockWebSocketInstance.onopen) {
        mockWebSocketInstance.onopen({});
      }
      await connectPromise;

      const handler = vi.fn();
      client.on('test', handler);

      // Mock Math.random to return 0.1 (packet loss check)
      // 0.1 * 100 = 10 which is < 20, so packet should be dropped
      vi.spyOn(Math, 'random').mockReturnValue(0.1);

      const message: Message = { type: 'test', timestamp: Date.now(), data: { foo: 'bar' } };

      if (mockWebSocketInstance.onmessage) {
        mockWebSocketInstance.onmessage({ data: JSON.stringify(message) });
      }

      vi.advanceTimersByTime(500);

      // Handler should not be called due to packet loss
      expect(handler).not.toHaveBeenCalled();
    });

    it('should send immediately when simulator is disabled', async () => {
      const simulator = new NetworkSimulator({ latency: 100, enabled: false });
      const client = new WebSocketClient('ws://localhost:8080/ws', false, simulator);

      const connectPromise = client.connect();
      if (mockWebSocketInstance.onopen) {
        mockWebSocketInstance.onopen({});
      }
      await connectPromise;

      const message: Message = { type: 'test', timestamp: Date.now() };
      client.send(message);

      // Should send immediately without delay
      expect(mockWebSocketInstance.send).toHaveBeenCalledWith(JSON.stringify(message));
    });

    it('should receive immediately when simulator is disabled', async () => {
      const simulator = new NetworkSimulator({ latency: 100, enabled: false });
      const client = new WebSocketClient('ws://localhost:8080/ws', false, simulator);

      const connectPromise = client.connect();
      if (mockWebSocketInstance.onopen) {
        mockWebSocketInstance.onopen({});
      }
      await connectPromise;

      const handler = vi.fn();
      client.on('test', handler);

      const message: Message = { type: 'test', timestamp: Date.now(), data: { foo: 'bar' } };

      if (mockWebSocketInstance.onmessage) {
        mockWebSocketInstance.onmessage({ data: JSON.stringify(message) });
      }

      // Handler should be called immediately
      expect(handler).toHaveBeenCalledWith({ foo: 'bar' });
    });
  });
});
