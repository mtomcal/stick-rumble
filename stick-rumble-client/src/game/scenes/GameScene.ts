import Phaser from 'phaser';
import { WebSocketClient } from '../network/WebSocketClient';
import { InputManager } from '../input/InputManager';
import { PlayerManager, type PlayerState } from '../entities/PlayerManager';
import { ARENA } from '../../shared/constants';

export class GameScene extends Phaser.Scene {
  private wsClient!: WebSocketClient;
  private inputManager!: InputManager;
  private playerManager!: PlayerManager;

  constructor() {
    super({ key: 'GameScene' });
  }

  preload(): void {
    // Assets will be loaded here in future stories
  }

  create(): void {
    // Set world bounds to match arena size
    this.cameras.main.setBounds(0, 0, ARENA.WIDTH, ARENA.HEIGHT);

    // Add arena background
    this.add.rectangle(0, 0, ARENA.WIDTH, ARENA.HEIGHT, 0x222222).setOrigin(0, 0);

    // Add arena border
    this.add.rectangle(0, 0, ARENA.WIDTH, ARENA.HEIGHT, 0xffffff, 0)
      .setOrigin(0, 0)
      .setStrokeStyle(2, 0xffffff);

    // Add title
    this.add.text(10, 10, 'Stick Rumble - WASD to move', {
      fontSize: '18px',
      color: '#ffffff'
    });

    // Initialize player manager
    this.playerManager = new PlayerManager(this);

    // Connect to WebSocket server
    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8080/ws';
    this.wsClient = new WebSocketClient(wsUrl);

    this.wsClient.connect()
      .then(() => {
        console.log('Connected to server!');

        // Initialize input manager after connection
        this.inputManager = new InputManager(this, this.wsClient);
        this.inputManager.init();

        // Add connection status
        this.add.text(10, 30, 'Connected! Use WASD to move', {
          fontSize: '14px',
          color: '#00ff00'
        });
      })
      .catch(err => {
        console.error('Failed to connect:', err);

        // Display connection error
        this.add.text(10, 30, 'Failed to connect to server', {
          fontSize: '14px',
          color: '#ff0000'
        });
      });

    // Setup message handlers
    this.wsClient.on('player:move', (data) => {
      const messageData = data as { players: PlayerState[] };
      if (messageData.players) {
        this.playerManager.updatePlayers(messageData.players);
      }
    });

    this.wsClient.on('room:joined', (data) => {
      const messageData = data as { playerId: string };
      console.log('Joined room as player:', messageData.playerId);
      // Set local player ID so we can highlight our player
      if (messageData.playerId) {
        this.playerManager.setLocalPlayerId(messageData.playerId);
      }
    });
  }

  update(): void {
    // Update input manager to send player input to server
    if (this.inputManager) {
      this.inputManager.update();
    }
  }
}
