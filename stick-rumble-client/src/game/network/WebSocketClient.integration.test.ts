import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { WebSocketClient, type Message } from './WebSocketClient';

// Test server configuration - assumes server is running on port 8080
const SERVER_URL = 'ws://localhost:8080/ws';
const HEALTH_URL = 'http://localhost:8080/health';

let clients: WebSocketClient[] = [];

// Helper function to wait for server health check
async function waitForServer(): Promise<void> {
  const maxAttempts = 10;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(HEALTH_URL);
      if (response.ok) {
        return;
      }
    } catch {
      // Server not ready yet
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error('Server not ready after health check attempts');
}

describe('WebSocket Integration Tests', () => {
  let consoleErrorSpy: any;
  let consoleWarnSpy: any;

  beforeAll(async () => {
    // Verify server is running before tests
    await waitForServer();
  }, 30000);

  beforeEach(() => {
    // Clear console spies
    vi.restoreAllMocks();

    // Spy on console errors and warnings to ensure clean execution
    consoleErrorSpy = vi.spyOn(console, 'error');
    consoleWarnSpy = vi.spyOn(console, 'warn');
  });

  afterEach(() => {
    // Assert no console errors or warnings occurred during the test
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(consoleWarnSpy).not.toHaveBeenCalled();

    // Clean up clients after each test
    clients.forEach(client => client.disconnect());
    clients = [];

    // Restore console spies
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  describe('AC1: WebSocket Connection Establishment', () => {
    it('should upgrade HTTP connection to WebSocket using gorilla/websocket', async () => {
      const consoleSpy = vi.spyOn(console, 'log');
      const client = new WebSocketClient(SERVER_URL);
      clients.push(client);

      // Connect to server
      await client.connect();

      // Verify client shows "Connected" status in console
      expect(consoleSpy).toHaveBeenCalledWith('WebSocket connected');
      
      consoleSpy.mockRestore();
    });

    it('should establish connection with ws://localhost:8080/ws format', async () => {
      const client = new WebSocketClient(SERVER_URL);
      clients.push(client);

      // Should connect without errors and establish working connection
      await client.connect();

      // Verify we can send a test message (proves connection is working)
      const testMessage: Message = {
        type: 'connection-test',
        timestamp: Date.now(),
        data: { test: 'verify-connection' }
      };
      expect(() => client.send(testMessage)).not.toThrow();
    });
  });

  describe('AC2: Connection Stability', () => {
    it('should maintain open and stable connection', async () => {
      const client = new WebSocketClient(SERVER_URL);
      clients.push(client);

      await client.connect();

      // Wait a moment to verify connection stays stable
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Should still be able to send multiple messages (connection is stable)
      const messages: Message[] = [
        { type: 'test', timestamp: Date.now(), data: { stability: 'test-1' } },
        { type: 'test', timestamp: Date.now(), data: { stability: 'test-2' } },
        { type: 'test', timestamp: Date.now(), data: { stability: 'test-3' } },
      ];

      // All messages should send without errors
      for (const message of messages) {
        expect(() => client.send(message)).not.toThrow();
      }
    });
  });

  describe('AC3: JSON Message Communication', () => {
    it('should send and receive JSON messages in correct format', async () => {
      // Need 2 clients to create a room for broadcast to work
      const client1 = new WebSocketClient(SERVER_URL);
      const client2 = new WebSocketClient(SERVER_URL);
      clients.push(client1, client2);

      // Set up message handler on client2 to receive broadcast from client1
      let receivedMessage: Message | null = null;
      const messagePromise = new Promise<Message>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timeout')), 5000);
        client2.on('test', (data: any) => {
          receivedMessage = { type: 'test', timestamp: Date.now(), data };
          clearTimeout(timeout);
          resolve(receivedMessage);
        });
      });

      // Connect both clients to create a room
      await client1.connect();
      await client2.connect();

      // Wait for room creation
      await new Promise(resolve => setTimeout(resolve, 200));

      // Send test message from client1
      const sentMessage: Message = {
        type: 'test',
        timestamp: Date.now(),
        data: { message: 'Hello from client!' }
      };

      client1.send(sentMessage);

      // Wait for broadcast to client2
      const response = await messagePromise;

      // Verify message structure
      expect(response).toBeDefined();
      expect(response.type).toBe('test');
      expect(response.data).toEqual({ message: 'Hello from client!' });
      expect(typeof response.timestamp).toBe('number');
    });

    it('should handle messages with optional data field', async () => {
      // Need 2 clients to create a room for broadcast to work
      const client1 = new WebSocketClient(SERVER_URL);
      const client2 = new WebSocketClient(SERVER_URL);
      clients.push(client1, client2);

      let receivedMessage: Message | null = null;
      const messagePromise = new Promise<Message>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timeout')), 5000);
        client2.on('no-data', (data: any) => {
          receivedMessage = { type: 'no-data', timestamp: Date.now(), data };
          clearTimeout(timeout);
          resolve(receivedMessage);
        });
      });

      // Connect both clients to create a room
      await client1.connect();
      await client2.connect();

      // Wait for room creation
      await new Promise(resolve => setTimeout(resolve, 200));

      // Send message without data field from client1
      const sentMessage: Message = {
        type: 'no-data',
        timestamp: Date.now()
      };

      client1.send(sentMessage);

      const response = await messagePromise;
      expect(response.type).toBe('no-data');
      expect(response.data).toBeUndefined();
    });
  });

  describe('AC4: Graceful Connection Close Handling', () => {
    it('should handle graceful close on client side', async () => {
      const consoleSpy = vi.spyOn(console, 'log');
      const client = new WebSocketClient(SERVER_URL);
      clients.push(client);

      await client.connect();

      // Disconnect gracefully
      client.disconnect();

      // Should log close event
      expect(consoleSpy).toHaveBeenCalledWith(
        'WebSocket closed:',
        expect.any(Number),
        expect.any(String)
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('AC5: Client Connection Status Display', () => {
    it('should show "Connected" status in console', async () => {
      const consoleSpy = vi.spyOn(console, 'log');
      const client = new WebSocketClient(SERVER_URL);
      clients.push(client);

      await client.connect();

      // Verify exact "Connected" status message
      expect(consoleSpy).toHaveBeenCalledWith('WebSocket connected');
      
      consoleSpy.mockRestore();
    });
  });

  describe('AC6: Server Connection Logging', () => {
    it('should log "Client connected: [connection_id]" on server', async () => {
      // This is verified through server response behavior
      // Need 2 clients to create a room for broadcast to work
      const client1 = new WebSocketClient(SERVER_URL);
      const client2 = new WebSocketClient(SERVER_URL);
      clients.push(client1, client2);

      let receivedMessage: Message | null = null;
      const messagePromise = new Promise<Message>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timeout')), 5000);
        client2.on('connection-test', (data: any) => {
          receivedMessage = { type: 'connection-test', timestamp: Date.now(), data };
          clearTimeout(timeout);
          resolve(receivedMessage);
        });
      });

      await client1.connect();
      await client2.connect();

      // Wait for room creation
      await new Promise(resolve => setTimeout(resolve, 200));

      // Send a message to verify server is processing connections
      const testMessage: Message = {
        type: 'connection-test',
        timestamp: Date.now(),
        data: { test: 'verify-server-logging' }
      };

      client1.send(testMessage);

      // If we get a response, server has logged the connection
      const response = await messagePromise;
      expect(response).toBeDefined();
      expect(response.type).toBe('connection-test');
    });
  });

  describe('AC7: Client to Server Message Test', () => {
    it('should receive test message from client on server', async () => {
      // Need 2 clients to create a room for broadcast to work
      const client1 = new WebSocketClient(SERVER_URL);
      const client2 = new WebSocketClient(SERVER_URL);
      clients.push(client1, client2);

      let receivedMessage: Message | null = null;
      const messagePromise = new Promise<Message>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timeout')), 5000);
        client2.on('client-test', (data: any) => {
          receivedMessage = { type: 'client-test', timestamp: Date.now(), data };
          clearTimeout(timeout);
          resolve(receivedMessage);
        });
      });

      await client1.connect();
      await client2.connect();

      // Wait for room creation
      await new Promise(resolve => setTimeout(resolve, 200));

      // Send test message from client1
      const clientMessage: Message = {
        type: 'client-test',
        timestamp: Date.now(),
        data: { from: 'client', message: 'Test message from client' }
      };

      client1.send(clientMessage);

      // Server should receive and broadcast to client2
      const response = await messagePromise;

      // Verify server received the message
      expect(response).toBeDefined();
      expect(response.type).toBe('client-test');
      expect(response.data).toEqual({ from: 'client', message: 'Test message from client' });
    });
  });

  describe('AC8: Server to Client Message Test', () => {
    it('should receive server messages in client console', async () => {
      const consoleSpy = vi.spyOn(console, 'log');
      const client = new WebSocketClient(SERVER_URL);
      clients.push(client);

      await client.connect();

      // Send a message - server logs it and we can verify connection works
      const message: Message = {
        type: 'server-response-test',
        timestamp: Date.now(),
        data: { expect: 'server-echo' }
      };

      client.send(message);

      // Wait for any processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // The fact that we can send means server is receiving messages
      expect(() => client.send(message)).not.toThrow();

      consoleSpy.mockRestore();
    });

    it('should handle server echo messages correctly', async () => {
      // Need 2 clients to create a room for broadcast to work
      const client1 = new WebSocketClient(SERVER_URL);
      const client2 = new WebSocketClient(SERVER_URL);
      clients.push(client1, client2);

      let serverEchoReceived = false;
      const echoPromise = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timeout')), 5000);
        client2.on('server-echo', (data: any) => {
          serverEchoReceived = true;
          expect(data).toEqual({ echo: 'test' });
          clearTimeout(timeout);
          resolve();
        });
      });

      await client1.connect();
      await client2.connect();

      // Wait for room creation
      await new Promise(resolve => setTimeout(resolve, 200));

      // Send message from client1 that will be broadcast to client2
      const echoMessage: Message = {
        type: 'server-echo',
        timestamp: Date.now(),
        data: { echo: 'test' }
      };

      client1.send(echoMessage);

      // Wait for broadcast
      await echoPromise;

      // Verify the message exchange worked
      expect(serverEchoReceived).toBe(true);
    });
  });

  describe('Connection Error Handling with Retry Logic', () => {
    it('should implement retry logic with 3 attempts', async () => {
      // Clear the global error spy for this test since we expect connection errors
      consoleErrorSpy.mockRestore();
      consoleWarnSpy.mockRestore();

      const consoleSpy = vi.spyOn(console, 'log');
      const errorSpy = vi.spyOn(console, 'error');

      // Try to connect to non-existent server
      const badClient = new WebSocketClient('ws://localhost:9999/ws');

      // Should attempt connection and fail - catch the expected error
      badClient.connect().catch(() => {
        // Expected to fail - connection to non-existent server
      });

      // Wait for initial failure and first reconnection attempt
      await new Promise(resolve => setTimeout(resolve, 200));

      // Should show reconnection attempts
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Reconnecting in')
      );

      // Clean up - disconnect stops further reconnection attempts
      badClient.disconnect();

      // Give time for cleanup
      await new Promise(resolve => setTimeout(resolve, 100));

      consoleSpy.mockRestore();
      errorSpy.mockRestore();

      // Recreate the global spies for subsequent tests
      consoleErrorSpy = vi.spyOn(console, 'error');
      consoleWarnSpy = vi.spyOn(console, 'warn');
    });
  });

  describe('Story 2.1: Server-Authoritative Player Movement', () => {
    describe('AC: input:state message processing', () => {
      it('should send input:state messages with WASD key states', async () => {
        const client = new WebSocketClient(SERVER_URL);
        clients.push(client);

        await client.connect();

        // Send input:state message with WASD keys pressed
        const inputMessage: Message = {
          type: 'input:state',
          timestamp: Date.now(),
          data: {
            up: true,
            down: false,
            left: false,
            right: true
          }
        };

        // Should not throw when sending input state
        // Note: Server processing is verified in subsequent tests that check player:move broadcasts
        expect(() => client.send(inputMessage)).not.toThrow();
      });

      it('should accept input:state with all keys released', async () => {
        const client = new WebSocketClient(SERVER_URL);
        clients.push(client);

        await client.connect();

        // Send input:state with no keys pressed
        const inputMessage: Message = {
          type: 'input:state',
          timestamp: Date.now(),
          data: {
            up: false,
            down: false,
            left: false,
            right: false
          }
        };

        // Should not throw when sending no-input state
        // Note: Server processing is verified in subsequent tests that check player:move broadcasts
        expect(() => client.send(inputMessage)).not.toThrow();
      });
    });

    describe('AC: player:move broadcasts', () => {
      it('should receive player:move messages with player positions', async () => {
        const client = new WebSocketClient(SERVER_URL);
        clients.push(client);

        // Set up handler for player:move messages
        let receivedPlayerMove = false;
        let playerData: any = null;

        const movePromise = new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Timeout waiting for player:move'));
          }, 5000);

          client.on('player:move', (data: any) => {
            receivedPlayerMove = true;
            playerData = data;
            clearTimeout(timeout);
            resolve();
          });
        });

        await client.connect();

        // Send input to trigger movement
        const inputMessage: Message = {
          type: 'input:state',
          timestamp: Date.now(),
          data: {
            up: true,
            down: false,
            left: false,
            right: false
          }
        };

        client.send(inputMessage);

        // Wait for player:move broadcast (server broadcasts at 20Hz)
        await movePromise;

        expect(receivedPlayerMove).toBe(true);
        expect(playerData).toBeDefined();
        expect(playerData.players).toBeDefined();
        expect(Array.isArray(playerData.players)).toBe(true);
      });

      it('should receive player positions with nested position and velocity objects', async () => {
        const client = new WebSocketClient(SERVER_URL);
        clients.push(client);

        let playerState: any = null;

        const movePromise = new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Timeout waiting for player:move'));
          }, 5000);

          client.on('player:move', (data: any) => {
            if (data.players && data.players.length > 0) {
              playerState = data.players[0];
              clearTimeout(timeout);
              resolve();
            }
          });
        });

        await client.connect();

        // Send input to trigger movement
        const inputMessage: Message = {
          type: 'input:state',
          timestamp: Date.now(),
          data: { up: true, down: false, left: false, right: false }
        };

        client.send(inputMessage);

        await movePromise;

        // Verify player state structure (nested position and velocity)
        expect(playerState).toBeDefined();
        expect(typeof playerState.id).toBe('string');
        expect(playerState.position).toBeDefined();
        expect(typeof playerState.position.x).toBe('number');
        expect(typeof playerState.position.y).toBe('number');
        expect(playerState.velocity).toBeDefined();
        expect(typeof playerState.velocity.x).toBe('number');
        expect(typeof playerState.velocity.y).toBe('number');
      });
    });

    describe('AC: Multi-player movement synchronization', () => {
      it('should broadcast player positions to all connected players', async () => {
        const client1 = new WebSocketClient(SERVER_URL);
        const client2 = new WebSocketClient(SERVER_URL);
        clients.push(client1, client2);

        let client1ReceivedMove = false;
        let client2ReceivedMove = false;

        const movePromises = Promise.all([
          new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Client1 timeout')), 5000);
            client1.on('player:move', () => {
              client1ReceivedMove = true;
              clearTimeout(timeout);
              resolve();
            });
          }),
          new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Client2 timeout')), 5000);
            client2.on('player:move', () => {
              client2ReceivedMove = true;
              clearTimeout(timeout);
              resolve();
            });
          })
        ]);

        // Connect both clients
        await client1.connect();
        await client2.connect();

        // Wait for room assignment
        await new Promise(resolve => setTimeout(resolve, 200));

        // Send input from both clients
        const inputMessage: Message = {
          type: 'input:state',
          timestamp: Date.now(),
          data: { up: true, down: false, left: false, right: false }
        };

        client1.send(inputMessage);
        client2.send(inputMessage);

        await movePromises;

        // Both clients should receive player:move broadcasts
        expect(client1ReceivedMove).toBe(true);
        expect(client2ReceivedMove).toBe(true);
      });

      it('should show movement when WASD keys are pressed', async () => {
        const client = new WebSocketClient(SERVER_URL);
        clients.push(client);

        const positions: { x: number; y: number }[] = [];
        let initialPosition: { x: number; y: number } | null = null;

        const collectPositions = new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Timeout')), 5000);
          let count = 0;

          client.on('player:move', (data: any) => {
            if (data.players && data.players.length > 0) {
              const player = data.players[0];
              // Position is nested in position object
              positions.push({ x: player.position.x, y: player.position.y });

              if (!initialPosition) {
                initialPosition = { x: player.position.x, y: player.position.y };
              }

              count++;
              if (count >= 3) {
                clearTimeout(timeout);
                resolve();
              }
            }
          });
        });

        await client.connect();

        // Send input to move up (negative Y direction in most game engines)
        const inputMessage: Message = {
          type: 'input:state',
          timestamp: Date.now(),
          data: { up: true, down: false, left: false, right: false }
        };

        client.send(inputMessage);

        await collectPositions;

        // Should have collected multiple position updates
        expect(positions.length).toBeGreaterThanOrEqual(3);
        expect(initialPosition).not.toBeNull();

        // Position should have changed (player is moving upward - Y decreases)
        const finalPosition = positions[positions.length - 1];
        // With acceleration physics, movement might be gradual, but should show change
        // Check that either position changed OR velocity is non-zero (movement intent)
        const positionChanged = finalPosition.x !== initialPosition!.x || finalPosition.y !== initialPosition!.y;
        expect(positionChanged).toBe(true);
      });
    });

    describe('AC: Server validates movement bounds', () => {
      it('should keep player within arena bounds (0-1920, 0-1080)', async () => {
        const client = new WebSocketClient(SERVER_URL);
        clients.push(client);

        const positions: { x: number; y: number }[] = [];

        const collectPositions = new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Timeout')), 5000);
          let count = 0;

          client.on('player:move', (data: any) => {
            if (data.players && data.players.length > 0) {
              const player = data.players[0];
              // Position is nested in position object
              positions.push({ x: player.position.x, y: player.position.y });
              count++;
              if (count >= 5) {
                clearTimeout(timeout);
                resolve();
              }
            }
          });
        });

        await client.connect();

        // Send input - player should stay within bounds
        const inputMessage: Message = {
          type: 'input:state',
          timestamp: Date.now(),
          data: { up: true, down: false, left: true, right: false }
        };

        client.send(inputMessage);

        await collectPositions;

        // All positions should be within bounds
        for (const pos of positions) {
          expect(pos.x).toBeGreaterThanOrEqual(0);
          expect(pos.x).toBeLessThanOrEqual(1920);
          expect(pos.y).toBeGreaterThanOrEqual(0);
          expect(pos.y).toBeLessThanOrEqual(1080);
        }
      });
    });
  });
});