import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { type Message } from './WebSocketClient';
import {
  waitForServer,
  createClient,
  connectClientsToRoom,
  aggressiveCleanup
} from './WebSocketClient.integration.helpers';

// Use serial execution to prevent test interference
describe.sequential('WebSocket Health Regeneration Integration Tests', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

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
    // Filter out expected WebSocket connection errors (these are ok in integration tests)
    const unexpectedErrors = consoleErrorSpy.mock.calls.filter((call: unknown[]) => {
      const errorStr = call[0]?.toString() || '';
      return !errorStr.includes('WebSocket error') &&
             !errorStr.includes('Reconnection failed') &&
             !errorStr.includes('[waitForEvent]') &&
             !errorStr.includes('[aggressiveCleanup]');
    });
    const unexpectedWarnings = consoleWarnSpy.mock.calls.filter((call: unknown[]) => {
      const warnStr = call[0]?.toString() || '';
      return !warnStr.includes('WebSocket') &&
             !warnStr.includes('[aggressiveCleanup]');
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

  describe('Story 2.7.1: Server-Side Health Regeneration', () => {
    describe('AC: Server broadcasts isRegenerating field in player:move', () => {
      it('should include isRegenerating field in player:move messages', async () => {
        const client1 = createClient();
        const client2 = createClient();

        let playerWithRegenField: { isRegenerating: boolean; health: number } | null = null;

        const regenFieldPromise = new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Timeout waiting for isRegenerating field')), 15000);

          client2.on('player:move', (data: any) => {
            if (data.players && data.players.length > 0) {
              // Check if server sends isRegenerating field (the JSON field name)
              const player = data.players.find((p: any) => p.isRegenerating !== undefined);
              if (player) {
                playerWithRegenField = player;
                clearTimeout(timeout);
                resolve();
              }
            }
          });
        });

        await connectClientsToRoom(client1, client2);

        // Trigger player:move broadcasts with input
        const inputMessage: Message = {
          type: 'input:state',
          timestamp: Date.now(),
          data: { up: false, down: false, left: false, right: true, aimAngle: 0 }
        };
        client1.send(inputMessage);

        await regenFieldPromise;

        // Verify server provides the isRegenerating field
        expect(playerWithRegenField).toBeTruthy();
        expect(typeof playerWithRegenField!.isRegenerating).toBe('boolean');
      });

      it('should broadcast isRegenerating = false for players at full health', async () => {
        const client1 = createClient();
        const client2 = createClient();

        let fullHealthPlayer: { isRegenerating: boolean; health: number } | null = null;

        const fullHealthPromise = new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Timeout waiting for full health player')), 15000);

          client2.on('player:move', (data: any) => {
            if (data.players && data.players.length > 0) {
              // Find a player at full health
              const player = data.players.find((p: any) =>
                p.health === 100 && p.isRegenerating !== undefined
              );
              if (player) {
                fullHealthPlayer = player;
                clearTimeout(timeout);
                resolve();
              }
            }
          });
        });

        await connectClientsToRoom(client1, client2);

        // Trigger broadcasts
        client1.send({
          type: 'input:state',
          timestamp: Date.now(),
          data: { up: false, down: false, left: false, right: true, aimAngle: 0 }
        });

        await fullHealthPromise;

        // Players at 100 HP should NOT be regenerating
        expect(fullHealthPlayer).toBeTruthy();
        expect(fullHealthPlayer!.health).toBe(100);
        expect(fullHealthPlayer!.isRegenerating).toBe(false);
      });
    });

    describe('AC: isRegenerating broadcasts to all clients in room', () => {
      it('should broadcast isRegenerating to all clients simultaneously', async () => {
        const client1 = createClient();
        const client2 = createClient();
        const client3 = createClient();

        let client2SawField = false;
        let client3SawField = false;

        const multiClientPromise = new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Timeout waiting for multi-client broadcast')), 15000);

          const checkComplete = () => {
            if (client2SawField && client3SawField) {
              clearTimeout(timeout);
              resolve();
            }
          };

          client2.on('player:move', (data: any) => {
            if (data.players && data.players.some((p: any) => p.isRegenerating !== undefined)) {
              client2SawField = true;
              checkComplete();
            }
          });

          client3.on('player:move', (data: any) => {
            if (data.players && data.players.some((p: any) => p.isRegenerating !== undefined)) {
              client3SawField = true;
              checkComplete();
            }
          });
        });

        // Connect first two clients to create a room
        await connectClientsToRoom(client1, client2);

        // Connect third client
        await client3.connect();

        // Wait for client3 to join room
        await new Promise<void>((resolve) => {
          const handler = () => {
            client3.off('room:joined', handler);
            resolve();
          };
          client3.on('room:joined', handler);
        });

        // Trigger broadcasts
        client1.send({
          type: 'input:state',
          timestamp: Date.now(),
          data: { up: false, down: false, left: false, right: true, aimAngle: 0 }
        });

        await multiClientPromise;

        // Verify all clients received the isRegenerating field
        expect(client2SawField).toBe(true);
        expect(client3SawField).toBe(true);
      });
    });

    describe('AC: Regeneration state is server-authoritative', () => {
      it('should receive regeneration state from server broadcasts, not client-side calculation', async () => {
        const client1 = createClient();
        const client2 = createClient();

        let receivedServerState = false;
        const stateMessages: Array<{ isRegenerating: boolean; health: number }> = [];

        const serverStatePromise = new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Timeout waiting for server state')), 15000);

          client2.on('player:move', (data: any) => {
            if (data.players && data.players.length > 0) {
              const player = data.players[0];
              // Server authoritatively provides isRegenerating field
              if (player.isRegenerating !== undefined) {
                receivedServerState = true;
                stateMessages.push(player);

                // After receiving a few messages, verify server is consistently providing the field
                if (stateMessages.length >= 2) {
                  clearTimeout(timeout);
                  resolve();
                }
              }
            }
          });
        });

        await connectClientsToRoom(client1, client2);

        // Trigger multiple broadcasts
        for (let i = 0; i < 3; i++) {
          client1.send({
            type: 'input:state',
            timestamp: Date.now(),
            data: { up: false, down: false, left: false, right: true, aimAngle: 0 }
          });
          await new Promise(r => setTimeout(r, 100));
        }

        await serverStatePromise;

        // Verify server is consistently providing regeneration state
        expect(receivedServerState).toBe(true);
        expect(stateMessages.length).toBeGreaterThanOrEqual(2);
        // All messages should have the isRegenerating field as a boolean
        stateMessages.forEach(state => {
          expect(typeof state.isRegenerating).toBe('boolean');
        });
      });
    });
  });
});
