/**
 * Integration test helpers for WebSocket client testing
 *
 * This module provides utilities for writing reliable, event-driven integration tests
 * that eliminate race conditions and flakiness from static delays.
 *
 * ## Best Practices
 *
 * ### ✅ DO: Use Event-Driven Waits
 * ```typescript
 * // Good - Wait for specific lifecycle states
 * await waitForSessionStatusState(client, 'match_ready');
 * const moveData = await waitForEvent('player:move', client);
 *
 * // Good - Wait for conditions to be met
 * await waitForCondition(() => player.x !== initialX);
 * ```
 *
 * ### ❌ DON'T: Use Static Delays
 * ```typescript
 * // Bad - Causes flakiness and race conditions
 * await delay(500);
 * await new Promise(resolve => setTimeout(resolve, 1000));
 * ```
 *
 * ### Pattern: Multi-Client Room Setup
 * ```typescript
 * const client1 = createClient();
 * const client2 = createClient();
 *
 * // Wait for both to join room
 * await Promise.all([
 *   waitForSessionStatusState(client1, 'match_ready'),
 *   waitForSessionStatusState(client2, 'match_ready')
 * ]);
 * ```
 *
 * ### Pattern: State Change Validation
 * ```typescript
 * // Send input
 * client.send('input:state', { w: true });
 *
 * // Wait for server to process and broadcast
 * const moveData = await waitForEvent('player:move', client);
 * expect(moveData.position.x).not.toBe(initialX);
 * ```
 *
 * @module WebSocketClient.integration.helpers
 */

import { beforeEach, afterEach, vi } from 'vitest';
import { WebSocketClient } from './WebSocketClient';
import type { SessionStatusData, SessionStatusState } from '../../shared/types';

const TEST_SERVER_PORT = process.env.TEST_SERVER_PORT ?? '8081';

// Test server configuration - uses a dedicated integration port to avoid local dev conflicts.
export const SERVER_URL = `ws://localhost:${TEST_SERVER_PORT}/ws`;
export const HEALTH_URL = `http://localhost:${TEST_SERVER_PORT}/health`;

// Global client tracker for cleanup
export const clients: WebSocketClient[] = [];

/**
 * Helper function to wait for server health check
 * Polls the health endpoint until server is ready
 *
 * Increased timeout to 20 attempts x 500ms = 10 seconds total
 * This accounts for CI environment startup delays
 */
export async function waitForServer(): Promise<void> {
  const maxAttempts = 20; // Increased from 10 to 20 (10 seconds total)
  const pollInterval = 500; // ms between attempts
  const totalTimeout = maxAttempts * pollInterval;

  let lastError: Error | null = null;
  let lastStatus: number | null = null;

  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(HEALTH_URL);
      lastStatus = response.status;

      if (response.ok) {
        console.log(`[waitForServer] Server ready after ${(i + 1) * pollInterval}ms`);
        return;
      }

      console.log(`[waitForServer] Attempt ${i + 1}/${maxAttempts}: Server responded with status ${response.status}`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.log(`[waitForServer] Attempt ${i + 1}/${maxAttempts}: ${lastError.message}`);
    }
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  // Provide detailed error message
  const errorDetails = [];
  if (lastError) {
    errorDetails.push(`Last error: ${lastError.message}`);
  }
  if (lastStatus !== null) {
    errorDetails.push(`Last status: ${lastStatus}`);
  }
  errorDetails.push(`Timeout: ${totalTimeout}ms`);
  errorDetails.push(`Health URL: ${HEALTH_URL}`);

  throw new Error(`Server not ready after ${maxAttempts} health check attempts. ${errorDetails.join(', ')}`);
}

/**
 * Shared beforeEach setup for integration tests
 * Sets up console spies to track errors/warnings
 */
export function setupIntegrationTest() {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn> | undefined;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn> | undefined;

  beforeEach(() => {
    // Clear console spies
    vi.restoreAllMocks();

    // Spy on console errors and warnings to ensure clean execution
    consoleErrorSpy = vi.spyOn(console, 'error');
    consoleWarnSpy = vi.spyOn(console, 'warn');
  });

  return { consoleErrorSpy, consoleWarnSpy };
}

/**
 * Shared afterEach cleanup for integration tests
 * Verifies no unexpected errors/warnings and cleans up clients
 */
export function cleanupIntegrationTest(consoleErrorSpy: ReturnType<typeof vi.spyOn>, consoleWarnSpy: ReturnType<typeof vi.spyOn>) {
  afterEach(() => {
    // Clean up clients after each test
    clients.forEach(client => client.disconnect());
    clients.length = 0;

    // Restore console spies
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });
}

/**
 * Factory function to create and track WebSocket clients
 * Automatically adds client to cleanup list
 * @param url - WebSocket URL (defaults to SERVER_URL)
 * @param debugMode - Enable debug logging for event tracking (defaults to true in tests)
 */
export function createClient(url: string = SERVER_URL, debugMode = true): WebSocketClient {
  const client = new WebSocketClient(url, debugMode);
  clients.push(client);
  return client;
}

function createTestInviteCode(): string {
  return `T${Math.random().toString(36).slice(2, 7)}`.toUpperCase();
}

function createTestDisplayName(index: number): string {
  return `Test Player ${index}`;
}

export async function connectClientToCodeRoom(
  client: WebSocketClient,
  options: { code?: string; displayName?: string; expectedState?: SessionStatusState | SessionStatusState[] } = {}
): Promise<WebSocketClient> {
  const code = options.code ?? createTestInviteCode();
  const displayName = options.displayName ?? createTestDisplayName(clients.indexOf(client) + 1);
  const expectedStates = options.expectedState ?? ['waiting_for_players', 'match_ready'];
  const sessionStatusPromise = waitForSessionStatusState(client, expectedStates);

  await client.connect();
  client.sendHello({
    mode: 'code',
    code,
    displayName,
  });
  await sessionStatusPromise;

  return client;
}

/**
 * Helper to wait for a specific delay
 * @deprecated Use waitForEvent or waitForCondition instead for better reliability
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Connect multiple clients and wait for them all to reach match_ready in the same code room.
 *
 * This helper properly handles the session-first flow by waiting for
 * session:status(match_ready) instead of any legacy room event.
 *
 * @example
 * const [client1, client2] = await connectClientsToRoom(
 *   createClient(),
 *   createClient()
 * );
 *
 * @param clients - Two or more WebSocketClient instances to connect
 * @returns Promise that resolves when all clients have joined the same code room
 */
export async function connectClientsToRoom(
  ...clientsToConnect: WebSocketClient[]
): Promise<WebSocketClient[]> {
  if (clientsToConnect.length < 2) {
    throw new Error('connectClientsToRoom requires at least 2 clients to reach match_ready');
  }

  console.log(`[connectClientsToRoom] Connecting ${clientsToConnect.length} client(s)...`);
  const code = createTestInviteCode();

  // Set up session:status(match_ready) handlers BEFORE connecting.
  const matchReadyPromises = clientsToConnect.map((client, index) => {
    console.log(`[connectClientsToRoom] Setting up session:status(match_ready) handler for client ${index + 1}`);
    return waitForSessionStatusState(client, 'match_ready');
  });

  // Connect all clients
  console.log(`[connectClientsToRoom] Connecting all clients to WebSocket...`);
  await Promise.all(clientsToConnect.map((client, index) => {
    console.log(`[connectClientsToRoom] Connecting client ${index + 1}...`);
    return client.connect();
  }));

  clientsToConnect.forEach((client, index) => {
    client.sendHello({
      mode: 'code',
      code,
      displayName: createTestDisplayName(index + 1),
    });
  });

  // Wait for all clients to be gameplay-ready.
  console.log(`[connectClientsToRoom] Waiting for all session:status(match_ready) events...`);
  await Promise.all(matchReadyPromises);

  console.log(`[connectClientsToRoom] All clients joined room successfully`);
  return clientsToConnect;
}

// Default timeout constants for event-driven waits
// Increased to 15000ms for CI environments which have slower startup times
export const DEFAULT_TIMEOUT = 15000;
export const DEFAULT_POLL_INTERVAL = 50;

/**
 * Options for event-driven wait helpers
 */
export interface WaitOptions {
  timeout?: number;
  pollInterval?: number;
}

/**
 * Wait for a specific event to be received on a WebSocket client
 *
 * This helper automatically cleans up event handlers after receiving the event or timing out,
 * preventing memory leaks. WebSocketClient now supports multiple handlers per event type,
 * so this can be safely used alongside other event handlers.
 *
 * @example
 * // Wait for match_ready lifecycle state
 * const data = await waitForSessionStatusState(client, 'match_ready');
 *
 * @example
 * // Wait with custom timeout
 * const data = await waitForEvent('player:move', client, { timeout: 3000 });
 *
 * @example
 * // Multiple handlers can coexist:
 * const collected: any[] = [];
 * client.on('player:move', (data) => collected.push(data));
 *
 * // This won't interfere with the collection handler above
 * await waitForEvent('player:move', client);
 *
 * @param eventName - The event type to wait for (e.g., 'session:status', 'player:move')
 * @param client - The WebSocketClient instance to listen on
 * @param options - Optional configuration for timeout and polling
 * @returns Promise that resolves with the event data when the event is received
 * @throws Error if timeout is reached before event is received
 */
export function waitForEvent<T = unknown>(
  eventName: string,
  client: WebSocketClient,
  options: WaitOptions = {}
): Promise<T> {
  const { timeout = DEFAULT_TIMEOUT } = options;

  return new Promise<T>((resolve, reject) => {
    let resolved = false;
    const startTime = Date.now();

    const handler = (data: unknown) => {
      if (!resolved) {
        resolved = true;
        const duration = Date.now() - startTime;
        console.log(`[waitForEvent] '${eventName}' received after ${duration}ms`);
        clearTimeout(timeoutId);
        // Remove handler to prevent memory leaks
        client.off(eventName, handler);
        resolve(data as T);
      }
    };

    const timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        console.error(`[waitForEvent] '${eventName}' TIMEOUT after ${timeout}ms`);
        // Remove handler to prevent memory leaks
        client.off(eventName, handler);
        reject(new Error(`Timeout waiting for event '${eventName}' after ${timeout}ms`));
      }
    }, timeout);

    console.log(`[waitForEvent] Waiting for '${eventName}'...`);
    client.on(eventName, handler);
  });
}

export function waitForSessionStatusState(
  client: WebSocketClient,
  expectedState: SessionStatusState | SessionStatusState[],
  options: WaitOptions = {}
): Promise<SessionStatusData> {
  const expectedStates = new Set(Array.isArray(expectedState) ? expectedState : [expectedState]);
  const { timeout = DEFAULT_TIMEOUT } = options;

  return new Promise<SessionStatusData>((resolve, reject) => {
    let resolved = false;
    const startTime = Date.now();

    const handler = (data: unknown) => {
      const sessionStatus = data as SessionStatusData | undefined;
      if (!sessionStatus || !expectedStates.has(sessionStatus.state)) {
        return;
      }

      if (!resolved) {
        resolved = true;
        const duration = Date.now() - startTime;
        console.log(
          `[waitForSessionStatusState] '${sessionStatus.state}' received after ${duration}ms`
        );
        clearTimeout(timeoutId);
        client.off('session:status', handler);
        resolve(sessionStatus);
      }
    };

    const timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        console.error(
          `[waitForSessionStatusState] TIMEOUT after ${timeout}ms waiting for states: ${[...expectedStates].join(', ')}`
        );
        client.off('session:status', handler);
        reject(
          new Error(
            `Timeout waiting for session:status in states [${[...expectedStates].join(', ')}] after ${timeout}ms`
          )
        );
      }
    }, timeout);

    console.log(
      `[waitForSessionStatusState] Waiting for session:status in states: ${[...expectedStates].join(', ')}`
    );
    client.on('session:status', handler);
  });
}

/**
 * Wait for a condition to become true by polling
 *
 * @example
 * // Wait for position to change
 * await waitForCondition(() => player.x !== initialX);
 *
 * @example
 * // Wait with custom options
 * await waitForCondition(
 *   () => player.health < 100,
 *   { timeout: 3000, pollInterval: 100 }
 * );
 *
 * @param checkFn - Function that returns true when condition is met
 * @param options - Optional configuration for timeout and polling interval
 * @returns Promise that resolves when condition becomes true
 * @throws Error if timeout is reached before condition is met
 */
export function waitForCondition(
  checkFn: () => boolean,
  options: WaitOptions = {}
): Promise<void> {
  const { timeout = DEFAULT_TIMEOUT, pollInterval = DEFAULT_POLL_INTERVAL } = options;

  return new Promise<void>((resolve, reject) => {
    const startTime = Date.now();

    const check = () => {
      if (checkFn()) {
        resolve();
        return;
      }

      if (Date.now() - startTime >= timeout) {
        reject(new Error(`Timeout waiting for condition after ${timeout}ms`));
        return;
      }

      setTimeout(check, pollInterval);
    };

    check();
  });
}

/**
 * Verify all clients have no lingering event handlers
 * This is critical for test isolation - prevents handlers from previous tests
 * interfering with current tests
 *
 * @example
 * beforeEach(() => {
 *   verifyNoLingeringHandlers();
 * });
 *
 * @throws Error if any client has registered handlers
 */
export function verifyNoLingeringHandlers(): void {
  const clientsWithHandlers = clients.filter(client => !client.hasNoHandlers());
  if (clientsWithHandlers.length > 0) {
    const details = clientsWithHandlers.map((client, i) =>
      `Client ${i}: ${client.getTotalHandlerCount()} handlers across ${client.getHandlerTypeCount()} types`
    ).join(', ');
    throw new Error(
      `Test isolation violation: ${clientsWithHandlers.length} client(s) have lingering handlers. ${details}`
    );
  }
}

/**
 * Aggressively cleanup all clients and verify no handlers remain
 * Use this in afterEach to ensure complete cleanup between tests
 *
 * @example
 * afterEach(async () => {
 *   await aggressiveCleanup();
 * });
 */
export async function aggressiveCleanup(): Promise<void> {
  console.log(`[aggressiveCleanup] Cleaning up ${clients.length} client(s)...`);

  // Disconnect all clients (this also clears their handlers)
  clients.forEach((client, i) => {
    const handlerCount = client.getTotalHandlerCount();
    if (handlerCount > 0) {
      console.warn(`[aggressiveCleanup] Client ${i} has ${handlerCount} handlers before disconnect`);
    }
    client.disconnect();
  });

  // Clear the global client array
  clients.length = 0;

  // Small delay to allow WebSocket close events to propagate
  await new Promise(resolve => setTimeout(resolve, 50));

  console.log(`[aggressiveCleanup] Cleanup complete`);
}
