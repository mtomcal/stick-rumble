import Phaser from 'phaser';
import { WebSocketClient } from '../network/WebSocketClient';

export class GameScene extends Phaser.Scene {
  private wsClient!: WebSocketClient;

  constructor() {
    super({ key: 'GameScene' });
  }

  preload(): void {
    // Assets will be loaded here in future stories
  }

  create(): void {
    // Add welcome text
    const welcomeText = this.add.text(
      this.cameras.main.centerX,
      this.cameras.main.centerY,
      'Stick Rumble\nPhaser 3.90 + React + TypeScript',
      {
        fontSize: '32px',
        color: '#ffffff',
        align: 'center',
      }
    );
    welcomeText.setOrigin(0.5);

    // Add a simple animated circle to demonstrate Phaser is working
    const circle = this.add.circle(
      this.cameras.main.centerX,
      this.cameras.main.centerY + 100,
      30,
      0x00ff00
    );

    // Animate the circle
    this.tweens.add({
      targets: circle,
      scaleX: 1.2,
      scaleY: 1.2,
      duration: 1000,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    });

    // Connect to WebSocket server
    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8080/ws';
    this.wsClient = new WebSocketClient(wsUrl);

    this.wsClient.connect()
      .then(() => {
        console.log('Connected to server!');

        // Display connection status on canvas
        this.add.text(10, 10, 'Connected to server!', {
          fontSize: '18px',
          color: '#00ff00'
        });

        // Send test message
        this.wsClient.send({
          type: 'test',
          timestamp: Date.now(),
          data: { message: 'Hello from client!' }
        });
      })
      .catch(err => {
        console.error('Failed to connect:', err);

        // Display connection error on canvas
        this.add.text(10, 10, 'Failed to connect to server', {
          fontSize: '18px',
          color: '#ff0000'
        });
      });

    // Setup message handlers
    this.wsClient.on('test', (data) => {
      console.log('Received echo from server:', data);
    });
  }

  update(): void {
    // Game loop - will be used in future stories
  }
}
