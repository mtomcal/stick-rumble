import Phaser from 'phaser';
import type { WebSocketClient } from '../network/WebSocketClient';

/**
 * Input state matching server-side InputState structure
 */
export interface InputState {
  up: boolean;    // W key
  down: boolean;  // S key
  left: boolean;  // A key
  right: boolean; // D key
}

/**
 * InputManager handles keyboard input and sends state to server
 */
export class InputManager {
  private scene: Phaser.Scene;
  private wsClient: WebSocketClient;
  private keys!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };
  private currentState: InputState;
  private lastSentState: InputState;

  constructor(scene: Phaser.Scene, wsClient: WebSocketClient) {
    this.scene = scene;
    this.wsClient = wsClient;
    this.currentState = { up: false, down: false, left: false, right: false };
    this.lastSentState = { up: false, down: false, left: false, right: false };
  }

  /**
   * Initialize keyboard input
   */
  init(): void {
    if (!this.scene.input.keyboard) {
      console.error('Keyboard input not available');
      return;
    }

    // Setup WASD keys
    this.keys = this.scene.input.keyboard.addKeys({
      W: Phaser.Input.Keyboard.KeyCodes.W,
      A: Phaser.Input.Keyboard.KeyCodes.A,
      S: Phaser.Input.Keyboard.KeyCodes.S,
      D: Phaser.Input.Keyboard.KeyCodes.D,
    }) as {
      W: Phaser.Input.Keyboard.Key;
      A: Phaser.Input.Keyboard.Key;
      S: Phaser.Input.Keyboard.Key;
      D: Phaser.Input.Keyboard.Key;
    };
  }

  /**
   * Update input state (call every frame)
   */
  update(): void {
    if (!this.keys) {
      return;
    }

    // Update current state from keyboard
    this.currentState = {
      up: this.keys.W.isDown,
      down: this.keys.S.isDown,
      left: this.keys.A.isDown,
      right: this.keys.D.isDown,
    };

    // Only send if state has changed
    if (this.hasStateChanged()) {
      this.sendInputState();
    }
  }

  /**
   * Get the current input state
   */
  getState(): InputState {
    return { ...this.currentState };
  }

  /**
   * Check if input state has changed since last send
   */
  private hasStateChanged(): boolean {
    return (
      this.currentState.up !== this.lastSentState.up ||
      this.currentState.down !== this.lastSentState.down ||
      this.currentState.left !== this.lastSentState.left ||
      this.currentState.right !== this.lastSentState.right
    );
  }

  /**
   * Send input state to server
   */
  private sendInputState(): void {
    this.wsClient.send({
      type: 'input:state',
      timestamp: Date.now(),
      data: this.currentState,
    });

    // Update last sent state
    this.lastSentState = { ...this.currentState };
  }

  /**
   * Cleanup
   */
  destroy(): void {
    // Keys are automatically cleaned up by Phaser
  }
}
