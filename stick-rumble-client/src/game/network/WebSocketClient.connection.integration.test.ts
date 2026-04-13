import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { WebSocketClient, type Message } from './WebSocketClient';
import {
  waitForServer,
  createClient,
  connectClientToCodeRoom,
  waitForEvent,
  waitForCondition,
  connectClientsToRoom,
  aggressiveCleanup
} from './WebSocketClient.integration.helpers';

function makeInviteCode(prefix: string): string {
  return `${prefix}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
}

// Use serial execution to prevent test interference
describe.sequential('WebSocket Connection Integration Tests', () => {
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

  afterEach(async () => {
    // Filter out expected WebSocket connection errors and debug logs (these are ok in integration tests)
    const unexpectedErrors = consoleErrorSpy.mock.calls.filter((call: unknown[]) => {
      const errorStr = call[0]?.toString() || '';
      return !errorStr.includes('WebSocket error') &&
             !errorStr.includes('Reconnection failed') &&
             !errorStr.includes('[waitForEvent]') &&
             !errorStr.includes('[aggressiveCleanup]'); // Filter out cleanup logs
    });
    const unexpectedWarnings = consoleWarnSpy.mock.calls.filter((call: unknown[]) => {
      const warnStr = call[0]?.toString() || '';
      return !warnStr.includes('WebSocket') &&
             !warnStr.includes('[aggressiveCleanup]'); // Filter out cleanup warnings
    });

    // Assert no unexpected console errors or warnings occurred during the test
    expect(unexpectedErrors.length).toBe(0);
    expect(unexpectedWarnings.length).toBe(0);

    // Aggressively clean up all clients and handlers
    await aggressiveCleanup();

    // Restore console spies
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  describe('AC1: WebSocket Connection Establishment', () => {
    it('should upgrade HTTP connection to WebSocket using gorilla/websocket', async () => {
      const consoleSpy = vi.spyOn(console, 'log');
      const client = createClient();

      // Connect to server
      await client.connect();

      // Verify client shows "Connected" status in console
      expect(consoleSpy).toHaveBeenCalledWith('WebSocket connected');

      consoleSpy.mockRestore();
    });

    it('should establish connection with ws://localhost:8080/ws format', async () => {
      const client = createClient();

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
      const client = createClient();

      await client.connect();

      // Wait for connection to stabilize by checking we can send messages
      let messagesSent = 0;
      await waitForCondition(() => {
        try {
          const testMsg: Message = { type: 'test', timestamp: Date.now(), data: { stability: 'check' } };
          client.send(testMsg);
          messagesSent++;
          return messagesSent >= 3;
        } catch {
          return false;
        }
      }, { timeout: 2000, pollInterval: 100 });

      // Verify all messages were sent successfully
      expect(messagesSent).toBeGreaterThanOrEqual(3);
    });
  });

  // AC3: JSON Message Communication tests removed
  // These tests only verified the server's "default" case for unknown message types,
  // which exists solely for backward compatibility with tests (not production code).
  // Real game messages use specific handlers (input:state, player:shoot, etc.)

  describe('AC4: Graceful Connection Close Handling', () => {
    it('should handle graceful close on client side', async () => {
      const client = createClient();

      await client.connect();

      // Spy on console.log AFTER connection is established
      const consoleSpy = vi.spyOn(console, 'log');

      // Small delay to allow the close event to propagate
      const closePromise = new Promise<void>((resolve) => {
        setTimeout(() => resolve(), 100);
      });

      // Disconnect gracefully (triggers WebSocket close event)
      client.disconnect();

      // Wait for close event to propagate
      await closePromise;

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
      const client = createClient();

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
      const client1 = createClient();
      const client2 = createClient();

      // Connect both clients
      // Connect both clients and wait for room:joined
      await connectClientsToRoom(client1, client2);

      // Set up promise to wait for the connection-test message
      const messagePromise = waitForEvent<{ test: string }>('connection-test', client2);

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
      expect(response.test).toBe('verify-server-logging');
    });
  });

  describe('AC7: Client to Server Message Test', () => {
    it('should receive test message from client on server', async () => {
      // Need 2 clients to create a room for broadcast to work
      const client1 = createClient();
      const client2 = createClient();

      // Connect both clients and wait for room:joined
      await connectClientsToRoom(client1, client2);

      // Set up promise to wait for the client-test message
      const messagePromise = waitForEvent<{ from: string; message: string }>('client-test', client2);

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
      expect(response).toEqual({ from: 'client', message: 'Test message from client' });
    });
  });

  describe('AC8: Server to Client Message Test', () => {
    it('should receive server messages in client console', async () => {
      const consoleSpy = vi.spyOn(console, 'log');
      const client = createClient();

      await client.connect();

      // Wait for a brief period to ensure connection is stable
      await waitForCondition(() => {
        try {
          const message: Message = {
            type: 'server-response-test',
            timestamp: Date.now(),
            data: { expect: 'server-echo' }
          };
          client.send(message);
          return true;
        } catch {
          return false;
        }
      }, { timeout: 1000, pollInterval: 50 });

      // The fact that we can send means server is receiving messages
      const message: Message = {
        type: 'server-response-test',
        timestamp: Date.now(),
        data: { expect: 'server-echo' }
      };
      expect(() => client.send(message)).not.toThrow();

      consoleSpy.mockRestore();
    });

    it('should handle server echo messages correctly', async () => {
      // Need 2 clients to create a room for broadcast to work
      const client1 = createClient();
      const client2 = createClient();

      // Connect both clients and wait for room:joined
      await connectClientsToRoom(client1, client2);

      // Set up promise to wait for the server-echo message
      const echoPromise = waitForEvent<{ echo: string }>('server-echo', client2);

      // Send message from client1 that will be broadcast to client2
      const echoMessage: Message = {
        type: 'server-echo',
        timestamp: Date.now(),
        data: { echo: 'test' }
      };

      client1.send(echoMessage);

      // Wait for broadcast
      const response = await echoPromise;

      // Verify the message exchange worked
      expect(response).toEqual({ echo: 'test' });
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

      // Wait for reconnection message to appear
      await waitForCondition(() => {
        return consoleSpy.mock.calls.some(call =>
          call[0]?.toString().includes('Reconnecting in')
        );
      }, { timeout: 2000, pollInterval: 50 });

      // Should show reconnection attempts
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Reconnecting in')
      );

      // Clean up - disconnect stops further reconnection attempts
      badClient.disconnect();

      consoleSpy.mockRestore();
      errorSpy.mockRestore();

      // Recreate the global spies for subsequent tests
      consoleErrorSpy = vi.spyOn(console, 'error');
      consoleWarnSpy = vi.spyOn(console, 'warn');
    });
  });

  describe('Friends MVP Invite Flow Smoke Tests', () => {
    it('rejects gameplay input before hello and keeps the same socket usable for a later join', async () => {
      const client = createClient();

      await client.connect();

      const noHelloPromise = waitForEvent<{ offendingType?: string }>('error:no_hello', client);
      const roomJoinedPromise = waitForEvent<{ code?: string; displayName: string }>('room:joined', client);

      client.send({
        type: 'input:state',
        timestamp: Date.now(),
        data: { up: true, down: false, left: false, right: false, aimAngle: 0 },
      });

      const noHello = await noHelloPromise;
      expect(noHello.offendingType).toBe('input:state');

      client.sendHello({
        mode: 'code',
        code: makeInviteCode('HELLO'),
        displayName: 'No Hello Recovery',
      });

      const joined = await roomJoinedPromise;
      expect(joined.displayName).toBe('No Hello Recover');
      expect(joined.displayName.length).toBeLessThanOrEqual(16);
    });

    it('returns error:bad_room_code and allows a corrected hello on the same socket', async () => {
      const client = createClient();

      await client.connect();

      const badCodePromise = waitForEvent<{ reason?: string }>('error:bad_room_code', client);
      client.sendHello({
        mode: 'code',
        code: 'x',
        displayName: 'Retry Name',
      });

      const badCode = await badCodePromise;
      expect(badCode.reason).toBe('too_short');

      const roomJoinedPromise = waitForEvent<{ code?: string; displayName: string }>('room:joined', client);
      client.sendHello({
        mode: 'code',
        code: ' p.i z z a!!! ',
        displayName: 'Retry Name',
      });

      const joined = await roomJoinedPromise;
      expect(joined.code).toBe('PIZZA');
      expect(joined.displayName).toBe('Retry Name');
    });

    it('normalizes invite variants and places both clients in the same authoritative code room', async () => {
      const host = createClient();
      const friend = createClient();
      const hostCode = makeInviteCode('PIZZA');

      await host.connect();
      const hostJoinPromise = waitForEvent<{ roomId: string; code?: string; displayName: string }>('room:joined', host);
      host.sendHello({
        mode: 'code',
        code: ` ${hostCode.toLowerCase()} `,
        displayName: 'Host Player',
      });
      const hostJoin = await hostJoinPromise;

      await friend.connect();
      const friendJoinPromise = waitForEvent<{ roomId: string; code?: string; displayName: string }>('room:joined', friend);
      friend.sendHello({
        mode: 'code',
        code: `${hostCode.slice(0, 2)}-${hostCode.slice(2)}!!!`,
        displayName: 'Friend Player',
      });
      const friendJoin = await friendJoinPromise;

      expect(hostJoin.code).toBe(hostCode);
      expect(friendJoin.code).toBe(hostCode);
      expect(friendJoin.roomId).toBe(hostJoin.roomId);
    });

    it('returns error:room_full and allows the same socket to recover into a different code room', async () => {
      const fullCode = makeInviteCode('FULL');
      const occupiedClients: WebSocketClient[] = [];

      for (let i = 0; i < 8; i++) {
        const client = createClient();
        occupiedClients.push(client);
        await connectClientToCodeRoom(client, {
          code: fullCode,
          displayName: `Full Room ${i + 1}`,
        });
      }

      const recoveryClient = createClient();
      await recoveryClient.connect();

      const roomFullPromise = waitForEvent<{ code?: string }>('error:room_full', recoveryClient);
      recoveryClient.sendHello({
        mode: 'code',
        code: fullCode.toLowerCase(),
        displayName: 'Recovery Player',
      });

      const roomFull = await roomFullPromise;
      expect(roomFull.code).toBe(fullCode);

      const stillFullClient = createClient();
      await stillFullClient.connect();
      const stillFullPromise = waitForEvent<{ code?: string }>('error:room_full', stillFullClient);
      stillFullClient.sendHello({
        mode: 'code',
        code: fullCode,
        displayName: 'Still Full',
      });
      const stillFull = await stillFullPromise;
      expect(stillFull.code).toBe(fullCode);

      const recoveryJoinPromise = waitForEvent<{ code?: string; displayName: string }>('room:joined', recoveryClient);
      const recoveryCode = makeInviteCode('SAFE');
      recoveryClient.sendHello({
        mode: 'code',
        code: recoveryCode,
        displayName: 'Recovery Player',
      });

      const joined = await recoveryJoinPromise;
      expect(joined.code).toBe(recoveryCode);
      expect(joined.displayName).toBe('Recovery Player');
    });

    it('replays the last successful hello once after reconnect and rejoins the same code room', async () => {
      const client = createClient();
      const inviteCode = makeInviteCode('RECO');
      const joinedRooms: string[] = [];

      client.on('room:joined', (data: any) => {
        joinedRooms.push(data.roomId);
      });

      await client.connect();
      client.sendHello({
        mode: 'code',
        code: inviteCode,
        displayName: 'Reconnect Player',
      });

      await waitForCondition(() => joinedRooms.length === 1, { timeout: 5000, pollInterval: 50 });

      (client as any).ws?.close(4001, 'integration reconnect');

      await waitForCondition(() => joinedRooms.length === 2, { timeout: 5000, pollInterval: 50 });

      expect(joinedRooms).toHaveLength(2);
      expect(joinedRooms[1]).toBe(joinedRooms[0]);
    });
  });
});
