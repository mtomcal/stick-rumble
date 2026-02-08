import Ajv, { type ValidateFunction } from 'ajv';
import {
  InputStateDataSchema,
  PlayerShootDataSchema,
  WeaponPickupAttemptDataSchema,
  type InputStateData,
  type PlayerShootData,
  type WeaponPickupAttemptData,
} from '@stick-rumble/events-schema';
import { NetworkSimulator } from './NetworkSimulator';

export interface Message {
  type: string;
  timestamp: number;
  data?: unknown;
}

export interface PlayerScore {
  playerId: string;
  kills: number;
  deaths: number;
  xp: number;
}

export interface MatchEndedData {
  winners: string[];
  finalScores: PlayerScore[];
  reason: 'kill_target' | 'time_limit';
}

// Initialize AJV validators at module load (compiled once for performance)
const ajv = new Ajv();
const validateInputState: ValidateFunction<InputStateData> = ajv.compile(InputStateDataSchema);
const validatePlayerShoot: ValidateFunction<PlayerShootData> = ajv.compile(PlayerShootDataSchema);
const validateWeaponPickupAttempt: ValidateFunction<WeaponPickupAttemptData> = ajv.compile(
  WeaponPickupAttemptDataSchema
);

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private reconnectDelay = 1000; // ms
  private messageHandlers: Map<string, Set<(data: unknown) => void>> = new Map();
  private shouldReconnect = true;
  private debugMode = false;
  private clientId: string;
  private inputRecordingEnabled = false;
  private frameNumber = 0;
  private inputLogCallback?: (tick: number, input: InputStateData) => void;
  private networkSimulator: NetworkSimulator;

  constructor(url: string, debugMode = false, networkSimulator?: NetworkSimulator) {
    this.url = url;
    this.debugMode = debugMode;
    this.clientId = `client-${Math.random().toString(36).substring(7)}`;
    this.networkSimulator = networkSimulator || new NetworkSimulator();

    // Enable input recording if environment variable is set
    if (import.meta.env.VITE_LOG_INPUT_RECORDING === 'true') {
      this.inputRecordingEnabled = true;
      console.log('[InputRecording] Enabled via VITE_LOG_INPUT_RECORDING');
    }
  }

  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
  }

  /**
   * Get the network simulator instance
   */
  getNetworkSimulator(): NetworkSimulator {
    return this.networkSimulator;
  }

  /**
   * Enable or disable input recording
   * @param enabled Whether to enable input recording
   */
  setInputRecording(enabled: boolean): void {
    this.inputRecordingEnabled = enabled;
    if (enabled) {
      console.log('[InputRecording] Enabled');
    } else {
      console.log('[InputRecording] Disabled');
    }
  }

  /**
   * Set callback for input recording
   * This callback is called every time an input state is sent
   * @param callback Function to call with tick number and input data
   */
  onInputRecorded(callback: (tick: number, input: InputStateData) => void): void {
    this.inputLogCallback = callback;
  }

  /**
   * Get current frame number (useful for recording)
   */
  getFrameNumber(): number {
    return this.frameNumber;
  }

  /**
   * Reset frame number (useful for new recording sessions)
   */
  resetFrameNumber(): void {
    this.frameNumber = 0;
  }

  private debug(message: string, ...args: unknown[]): void {
    if (this.debugMode) {
      console.log(`[${this.clientId}] ${message}`, ...args);
    }
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log('WebSocket connected');
          this.reconnectAttempts = 0;
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message: Message = JSON.parse(event.data);
            // Wrap receive with network simulator
            this.networkSimulator.simulateReceive(message, (msg) => {
              this.handleMessage(msg);
            });
          } catch (err) {
            console.error('Failed to parse message:', err);
          }
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          reject(error);
        };

        this.ws.onclose = (event) => {
          console.log('WebSocket closed:', event.code, event.reason);
          this.attemptReconnect();
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  send(message: Message): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      // Wrap send with network simulator
      this.networkSimulator.simulateSend(message, (msg) => {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify(msg));
        }
      });
    } else {
      console.warn('WebSocket not connected, cannot send message');
    }
  }

  on(messageType: string, handler: (data: unknown) => void): void {
    const handlers = this.messageHandlers.get(messageType) || new Set();
    const sizeBefore = handlers.size;
    handlers.add(handler);
    this.messageHandlers.set(messageType, handlers);
    this.debug(`on('${messageType}') registered (handlers: ${sizeBefore} -> ${handlers.size})`);
  }

  off(messageType: string, handler: (data: unknown) => void): void {
    const handlers = this.messageHandlers.get(messageType);
    if (handlers) {
      const sizeBefore = handlers.size;
      handlers.delete(handler);
      this.debug(`off('${messageType}') removed (handlers: ${sizeBefore} -> ${handlers.size})`);
      // Clean up empty sets to prevent memory leaks
      if (handlers.size === 0) {
        this.messageHandlers.delete(messageType);
        this.debug(`off('${messageType}') cleaned up empty handler set`);
      }
    } else {
      this.debug(`off('${messageType}') called but no handlers exist`);
    }
  }

  private handleMessage(message: Message): void {
    const handlers = this.messageHandlers.get(message.type);
    this.debug(`handleMessage('${message.type}') - ${handlers ? handlers.size : 0} handlers`, message.data);
    if (handlers) {
      // Call all registered handlers for this message type
      handlers.forEach(handler => handler(message.data));
    }

    // Delta compression backward compatibility:
    // When receiving state:snapshot or state:delta, also emit player:move events
    // so that existing code listening for player:move continues to work.
    if (message.type === 'state:snapshot' || message.type === 'state:delta') {
      const data = message.data as {
        players?: unknown[];
        lastProcessedSequence?: Record<string, number>;
        correctedPlayers?: string[];
      };
      if (data) {
        const isFullSnapshot = message.type === 'state:snapshot';
        // Forward all fields including reconciliation data (Story 4.2)
        const playerMoveHandlers = this.messageHandlers.get('player:move');
        if (playerMoveHandlers) {
          this.debug(`  -> forwarding to player:move handlers (${playerMoveHandlers.size}), isFullSnapshot=${isFullSnapshot}`);
          playerMoveHandlers.forEach(handler => handler({
            players: data.players ?? [],
            lastProcessedSequence: data.lastProcessedSequence,
            correctedPlayers: data.correctedPlayers,
            isFullSnapshot,
          }));
        }
      }
    }

    // Silently ignore messages without handlers - this is expected behavior
    // as not all clients will handle all message types
  }

  private attemptReconnect(): void {
    // Don't reconnect if disconnect was intentional
    if (!this.shouldReconnect) {
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    console.log(`Reconnecting in ${delay}ms... (attempt ${this.reconnectAttempts})`);

    setTimeout(() => {
      this.connect().catch(err => {
        console.error('Reconnection failed:', err);
      });
    }, delay);
  }

  disconnect(): void {
    this.shouldReconnect = false; // Prevent reconnection attempts
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    // Clear all handlers on disconnect to prevent leaks
    this.debug(`disconnect() clearing ${this.messageHandlers.size} handler type(s)`);
    this.messageHandlers.clear();
  }

  /**
   * Check if client has any registered event handlers
   * Useful for test isolation verification
   * @returns true if there are no registered handlers
   */
  hasNoHandlers(): boolean {
    return this.messageHandlers.size === 0;
  }

  /**
   * Get count of handler types registered
   * Useful for debugging test isolation issues
   */
  getHandlerTypeCount(): number {
    return this.messageHandlers.size;
  }

  /**
   * Get total count of all handlers (across all event types)
   * Useful for debugging test isolation issues
   */
  getTotalHandlerCount(): number {
    let total = 0;
    this.messageHandlers.forEach(handlers => {
      total += handlers.size;
    });
    return total;
  }

  /**
   * Send validated input state message.
   * @param data - Input state data (WASD keys and aim angle)
   */
  sendInputState(data: InputStateData): void {
    if (!validateInputState(data)) {
      console.error('Validation failed for input:state:', validateInputState.errors);
      return;
    }

    // Log input if recording is enabled
    if (this.inputRecordingEnabled) {
      if (this.debugMode) {
        console.log(`[InputRecording] Frame ${this.frameNumber}:`, data);
      }
      if (this.inputLogCallback) {
        this.inputLogCallback(this.frameNumber, data);
      }
      this.frameNumber++;
    }

    this.send({
      type: 'input:state',
      timestamp: Date.now(),
      data,
    });
  }

  /**
   * Send validated player shoot message.
   * @param data - Shoot data (aim angle)
   */
  sendShoot(data: PlayerShootData): void {
    if (!validatePlayerShoot(data)) {
      console.error('Validation failed for player:shoot:', validatePlayerShoot.errors);
      return;
    }

    this.send({
      type: 'player:shoot',
      timestamp: Date.now(),
      data,
    });
  }

  /**
   * Send player reload message (no data payload).
   */
  sendReload(): void {
    this.send({
      type: 'player:reload',
      timestamp: Date.now(),
    });
  }

  /**
   * Send validated weapon pickup attempt message.
   * @param data - Weapon pickup data (crate ID)
   */
  sendWeaponPickupAttempt(data: WeaponPickupAttemptData): void {
    if (!validateWeaponPickupAttempt(data)) {
      console.error('Validation failed for weapon:pickup_attempt:', validateWeaponPickupAttempt.errors);
      return;
    }

    this.send({
      type: 'weapon:pickup_attempt',
      timestamp: Date.now(),
      data,
    });
  }
}
