export interface Message {
  type: string;
  timestamp: number;
  data?: unknown;
}

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

  constructor(url: string, debugMode = false) {
    this.url = url;
    this.debugMode = debugMode;
    this.clientId = `client-${Math.random().toString(36).substring(7)}`;
  }

  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
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
            this.handleMessage(message);
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
      this.ws.send(JSON.stringify(message));
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
}
