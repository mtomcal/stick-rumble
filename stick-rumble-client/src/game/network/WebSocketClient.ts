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
  private messageHandlers: Map<string, (data: unknown) => void> = new Map();
  private shouldReconnect = true;

  constructor(url: string) {
    this.url = url;
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
    this.messageHandlers.set(messageType, handler);
  }

  private handleMessage(message: Message): void {
    const handler = this.messageHandlers.get(message.type);
    if (handler) {
      handler(message.data);
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
  }
}
