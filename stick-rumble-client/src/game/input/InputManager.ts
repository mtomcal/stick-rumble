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
  aimAngle: number; // Aim angle in radians
}

// Minimum angle change threshold to send update (about 5 degrees)
const AIM_ANGLE_THRESHOLD = 0.087;

/**
 * InputManager handles keyboard input and mouse aim, sending state to server
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
  private playerX: number = 0;
  private playerY: number = 0;
  private aimAngle: number = 0;
  private lastSentAimAngle: number = 0;

  constructor(scene: Phaser.Scene, wsClient: WebSocketClient) {
    this.scene = scene;
    this.wsClient = wsClient;
    this.currentState = { up: false, down: false, left: false, right: false, aimAngle: 0 };
    this.lastSentState = { up: false, down: false, left: false, right: false, aimAngle: 0 };
  }

  /**
   * Initialize keyboard input
   */
  init(): void {
    if (!this.scene.input || !this.scene.input.keyboard) {
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

    // Calculate aim angle from mouse position
    this.updateAimAngle();

    // Update current state from keyboard
    this.currentState = {
      up: this.keys.W.isDown,
      down: this.keys.S.isDown,
      left: this.keys.A.isDown,
      right: this.keys.D.isDown,
      aimAngle: this.aimAngle,
    };

    // Only send if state has changed
    if (this.hasStateChanged()) {
      this.sendInputState();
    }
  }

  /**
   * Update aim angle based on mouse position
   */
  private updateAimAngle(): void {
    if (!this.scene.input || !this.scene.input.activePointer) {
      return;
    }

    const pointer = this.scene.input.activePointer;
    const mouseX = pointer.worldX;
    const mouseY = pointer.worldY;

    // Calculate delta from player position
    const dx = mouseX - this.playerX;
    const dy = mouseY - this.playerY;

    // Avoid division by zero when mouse is exactly on player
    if (dx === 0 && dy === 0) {
      return; // Keep last valid angle
    }

    // Calculate angle using atan2
    this.aimAngle = Math.atan2(dy, dx);
  }

  /**
   * Set player position for aim angle calculation
   */
  setPlayerPosition(x: number, y: number): void {
    this.playerX = x;
    this.playerY = y;
  }

  /**
   * Get current aim angle in radians
   */
  getAimAngle(): number {
    return this.aimAngle;
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
    // Check WASD keys
    const keysChanged =
      this.currentState.up !== this.lastSentState.up ||
      this.currentState.down !== this.lastSentState.down ||
      this.currentState.left !== this.lastSentState.left ||
      this.currentState.right !== this.lastSentState.right;

    // Check if aim angle changed significantly
    const aimAngleChanged = Math.abs(this.currentState.aimAngle - this.lastSentAimAngle) > AIM_ANGLE_THRESHOLD;

    return keysChanged || aimAngleChanged;
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
    this.lastSentAimAngle = this.currentState.aimAngle;
  }

  /**
   * Cleanup
   */
  destroy(): void {
    // Keys are automatically cleaned up by Phaser
  }
}
