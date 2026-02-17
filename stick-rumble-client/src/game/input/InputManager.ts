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
  isSprinting: boolean; // Shift key for sprint
  sequence: number; // Sequence number for client-side prediction
}

/**
 * Stored input history entry
 */
export interface InputHistoryEntry {
  sequence: number;
  input: InputState;
  timestamp: number;
}

// Minimum angle change threshold to send update (about 5 degrees)
const AIM_ANGLE_THRESHOLD = 0.087;

// Maximum input history size (prevent memory bloat)
const MAX_INPUT_HISTORY = 100;

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
    SHIFT: Phaser.Input.Keyboard.Key;
  };
  private currentState: InputState;
  private lastSentState: InputState;
  private playerX: number = 960; // Default to center of arena (1920/2)
  private playerY: number = 540; // Default to center of arena (1080/2)
  private aimAngle: number = 0;
  private lastSentAimAngle: number = 0;
  private aimSwayOffset: number = 0;
  private isEnabled: boolean = true;
  private sequence: number = 0; // Monotonically increasing sequence number
  private inputHistory: InputHistoryEntry[] = []; // Store pending inputs for reconciliation

  constructor(scene: Phaser.Scene, wsClient: WebSocketClient) {
    this.scene = scene;
    this.wsClient = wsClient;
    this.currentState = { up: false, down: false, left: false, right: false, aimAngle: 0, isSprinting: false, sequence: 0 };
    this.lastSentState = { up: false, down: false, left: false, right: false, aimAngle: 0, isSprinting: false, sequence: 0 };
  }

  /**
   * Initialize keyboard input
   */
  init(): void {
    if (!this.scene.input || !this.scene.input.keyboard) {
      console.error('Keyboard input not available');
      return;
    }

    // Setup WASD + Shift keys
    this.keys = this.scene.input.keyboard.addKeys({
      W: Phaser.Input.Keyboard.KeyCodes.W,
      A: Phaser.Input.Keyboard.KeyCodes.A,
      S: Phaser.Input.Keyboard.KeyCodes.S,
      D: Phaser.Input.Keyboard.KeyCodes.D,
      SHIFT: Phaser.Input.Keyboard.KeyCodes.SHIFT,
    }) as {
      W: Phaser.Input.Keyboard.Key;
      A: Phaser.Input.Keyboard.Key;
      S: Phaser.Input.Keyboard.Key;
      D: Phaser.Input.Keyboard.Key;
      SHIFT: Phaser.Input.Keyboard.Key;
    };
  }

  /**
   * Update input state (call every frame)
   */
  update(): void {
    if (!this.keys || !this.isEnabled) {
      return;
    }

    // Calculate aim angle from mouse position
    this.updateAimAngle();

    // Update current state from keyboard
    // aimAngle includes sway offset so server receives sway-affected angle
    this.currentState = {
      up: this.keys.W.isDown,
      down: this.keys.S.isDown,
      left: this.keys.A.isDown,
      right: this.keys.D.isDown,
      aimAngle: this.aimAngle + this.aimSwayOffset,
      isSprinting: this.keys.SHIFT.isDown,
      sequence: this.sequence,
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
    if (!this.scene.input || !this.scene.input.activePointer || !this.scene.cameras || !this.scene.cameras.main) {
      return;
    }

    const pointer = this.scene.input.activePointer;

    // Convert screen coordinates to world coordinates accounting for scale mode
    // This properly handles Phaser.Scale.FIT mode transformations
    const worldPoint = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);

    // Calculate delta from player position
    const dx = worldPoint.x - this.playerX;
    const dy = worldPoint.y - this.playerY;

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
   * Set aim sway offset (computed by PlayerManager)
   */
  setAimSwayOffset(sway: number): void {
    this.aimSwayOffset = sway;
  }

  /**
   * Get current aim angle in radians (includes sway offset)
   */
  getAimAngle(): number {
    return this.aimAngle + this.aimSwayOffset;
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
      this.currentState.right !== this.lastSentState.right ||
      this.currentState.isSprinting !== this.lastSentState.isSprinting;

    // Check if aim angle changed significantly
    const aimAngleChanged = Math.abs(this.currentState.aimAngle - this.lastSentAimAngle) > AIM_ANGLE_THRESHOLD;

    return keysChanged || aimAngleChanged;
  }

  /**
   * Send input state to server
   */
  private sendInputState(): void {
    const timestamp = Date.now();

    this.wsClient.send({
      type: 'input:state',
      timestamp,
      data: this.currentState,
    });

    // Store in input history for reconciliation
    this.inputHistory.push({
      sequence: this.sequence,
      input: { ...this.currentState },
      timestamp,
    });

    // Limit history size to prevent memory bloat
    if (this.inputHistory.length > MAX_INPUT_HISTORY) {
      this.inputHistory.shift();
    }

    // Update last sent state
    this.lastSentState = { ...this.currentState };
    this.lastSentAimAngle = this.currentState.aimAngle;

    // Increment sequence for next input
    this.sequence++;
  }

  /**
   * Disable input handling (e.g., when match ends)
   */
  disable(): void {
    this.isEnabled = false;
  }

  /**
   * Enable input handling
   */
  enable(): void {
    this.isEnabled = true;
  }

  /**
   * Get input history for reconciliation
   */
  getInputHistory(): InputHistoryEntry[] {
    return [...this.inputHistory];
  }

  /**
   * Clear input history up to and including a sequence number
   * Used after server confirms processing up to a certain sequence
   */
  clearInputHistoryUpTo(sequence: number): void {
    this.inputHistory = this.inputHistory.filter(entry => entry.sequence > sequence);
  }

  /**
   * Get current sequence number
   */
  getCurrentSequence(): number {
    return this.sequence;
  }

  /**
   * Cleanup
   */
  destroy(): void {
    // Keys are automatically cleaned up by Phaser
    this.inputHistory = [];
  }
}
