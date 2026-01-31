import Phaser from 'phaser';
import { PLAYER } from '../../shared/constants';
import type { Clock } from '../utils/Clock';
import { RealClock } from '../utils/Clock';
import { ProceduralPlayerGraphics } from './ProceduralPlayerGraphics';
import { ProceduralWeaponGraphics } from './ProceduralWeaponGraphics';

/**
 * Player state from server
 */
export interface PlayerState {
  id: string;
  position: {
    x: number;
    y: number;
  };
  velocity: {
    x: number;
    y: number;
  };
  aimAngle?: number; // Aim angle in radians (optional for backward compatibility)
  deathTime?: number; // Timestamp when player died (ms since epoch), undefined if alive
  health?: number; // Current health (0-100)
  isRegenerating?: boolean; // Whether health is currently regenerating
  isRolling?: boolean; // Whether player is currently dodge rolling
}

// Length of the aim indicator line in pixels
const AIM_INDICATOR_LENGTH = 50;

/**
 * PlayerManager handles rendering and updating all players
 */
export class PlayerManager {
  private scene: Phaser.Scene;
  // Clock is injected for future use in client-side prediction (Phase 2: GameSimulation)
  // Currently, all timing is server-authoritative
  private _clock: Clock;
  private players: Map<string, ProceduralPlayerGraphics> = new Map();
  private playerLabels: Map<string, Phaser.GameObjects.Text> = new Map();
  private aimIndicators: Map<string, Phaser.GameObjects.Line> = new Map();
  private weaponGraphics: Map<string, ProceduralWeaponGraphics> = new Map();
  private weaponTypes: Map<string, string> = new Map();
  private localPlayerId: string | null = null;
  private playerStates: Map<string, PlayerState> = new Map();

  constructor(scene: Phaser.Scene, clock: Clock = new RealClock()) {
    this.scene = scene;
    this._clock = clock;
  }

  /**
   * Get the clock instance (for testing and future use in client-side prediction)
   */
  getClock(): Clock {
    return this._clock;
  }

  /**
   * Set the local player ID to differentiate from other players
   */
  setLocalPlayerId(playerId: string): void {
    this.localPlayerId = playerId;
  }

  /**
   * Get the local player ID
   */
  getLocalPlayerId(): string | null {
    return this.localPlayerId;
  }

  /**
   * Check if scene is valid and active for rendering
   */
  private isSceneValid(): boolean {
    return this.scene && this.scene.sys && this.scene.sys.isActive();
  }

  /**
   * Update all players from server state
   */
  updatePlayers(playerStates: PlayerState[]): void {
    // Skip if scene is not active (destroyed or transitioning)
    if (!this.isSceneValid()) {
      return;
    }

    const currentPlayerIds = new Set(playerStates.map(p => p.id));

    // Store player states for death tracking
    this.playerStates.clear();
    for (const state of playerStates) {
      this.playerStates.set(state.id, state);
    }

    // Remove players that no longer exist
    for (const [id, sprite] of this.players) {
      if (!currentPlayerIds.has(id)) {
        sprite.destroy();
        this.players.delete(id);

        const label = this.playerLabels.get(id);
        if (label) {
          label.destroy();
          this.playerLabels.delete(id);
        }

        const aimIndicator = this.aimIndicators.get(id);
        if (aimIndicator) {
          aimIndicator.destroy();
          this.aimIndicators.delete(id);
        }

        const weaponGraphics = this.weaponGraphics.get(id);
        if (weaponGraphics) {
          weaponGraphics.destroy();
          this.weaponGraphics.delete(id);
        }

        this.weaponTypes.delete(id);
      }
    }

    // Update or create players
    for (const state of playerStates) {
      let playerGraphics = this.players.get(state.id);

      if (!playerGraphics) {
        // Check if scene.add is available
        if (!this.scene.add) {
          console.error('Scene add system not available');
          continue;
        }

        // Create new player graphics (procedural stick figure)
        const isLocal = state.id === this.localPlayerId;
        const color = isLocal ? 0x00ff00 : 0xff0000; // Green for local, red for others

        playerGraphics = new ProceduralPlayerGraphics(
          this.scene,
          state.position.x,
          state.position.y,
          color
        );

        this.players.set(state.id, playerGraphics);

        // Add label
        const label = this.scene.add.text(
          state.position.x,
          state.position.y - PLAYER.HEIGHT / 2 - 10,
          isLocal ? 'You' : 'Player',
          {
            fontSize: '14px',
            color: '#ffffff',
          }
        );
        label.setOrigin(0.5);
        this.playerLabels.set(state.id, label);

        // Create aim indicator line
        const aimAngle = state.aimAngle ?? 0;
        const endX = state.position.x + Math.cos(aimAngle) * AIM_INDICATOR_LENGTH;
        const endY = state.position.y + Math.sin(aimAngle) * AIM_INDICATOR_LENGTH;
        const aimLine = this.scene.add.line(
          0, 0, // Origin point (line coordinates are absolute)
          state.position.x, state.position.y, // Start point
          endX, endY, // End point
          isLocal ? 0x00ff00 : 0xffff00 // Green for local, yellow for others
        );
        this.aimIndicators.set(state.id, aimLine);

        // Create weapon graphics (default to Pistol)
        const weaponType = this.weaponTypes.get(state.id) ?? 'Pistol';
        const weaponOffsetX = Math.cos(aimAngle) * 10;
        const weaponOffsetY = Math.sin(aimAngle) * 10;
        const weaponGraphics = new ProceduralWeaponGraphics(
          this.scene,
          state.position.x + weaponOffsetX,
          state.position.y + weaponOffsetY,
          weaponType
        );
        weaponGraphics.setRotation(aimAngle);
        this.weaponGraphics.set(state.id, weaponGraphics);
      }

      // Update position
      playerGraphics.setPosition(state.position.x, state.position.y);

      // Apply dodge roll visual effects (rotation during roll)
      if (state.isRolling) {
        // Apply 360° rotation animation (simulated with angle update)
        const rollAngle = ((this._clock.now() % 400) / 400) * Math.PI * 2; // 360° rotation over 0.4s
        playerGraphics.setRotation(rollAngle);

        // Apply transparency during invincibility frames (first 0.2s)
        // Note: Server tracks actual i-frame timing, this is visual only
        playerGraphics.setVisible(this._clock.now() % 200 < 100); // Flicker effect
      } else {
        // Clear rotation when not rolling
        playerGraphics.setRotation(0);
        playerGraphics.setVisible(true);
      }

      // Apply death visual effects
      if (state.deathTime !== undefined) {
        // Dead player: gray color
        playerGraphics.setColor(0x888888);
      } else if (!state.isRolling) {
        // Alive player (not rolling): restore original color
        const isLocal = state.id === this.localPlayerId;
        const color = isLocal ? 0x00ff00 : 0xff0000;
        playerGraphics.setColor(color);
      } else {
        // Alive player (rolling): keep original color
        const isLocal = state.id === this.localPlayerId;
        const color = isLocal ? 0x00ff00 : 0xff0000;
        playerGraphics.setColor(color);
      }

      // Update walk cycle animation based on movement
      const isMoving = Math.sqrt(state.velocity.x ** 2 + state.velocity.y ** 2) > 0.1;
      playerGraphics.update(16, isMoving); // Assume 60 FPS (16ms delta)

      // Update label position
      const label = this.playerLabels.get(state.id);
      if (label) {
        label.setPosition(
          state.position.x,
          state.position.y - PLAYER.HEIGHT / 2 - 10
        );
      }

      // Update aim indicator
      const aimIndicator = this.aimIndicators.get(state.id);
      if (aimIndicator) {
        const aimAngle = state.aimAngle ?? 0;
        const endX = state.position.x + Math.cos(aimAngle) * AIM_INDICATOR_LENGTH;
        const endY = state.position.y + Math.sin(aimAngle) * AIM_INDICATOR_LENGTH;
        aimIndicator.setTo(
          state.position.x, state.position.y,
          endX, endY
        );
      }

      // Update weapon graphics position and rotation
      const weaponGraphics = this.weaponGraphics.get(state.id);
      if (weaponGraphics) {
        const aimAngle = state.aimAngle ?? 0;
        const weaponOffsetX = Math.cos(aimAngle) * 10;
        const weaponOffsetY = Math.sin(aimAngle) * 10;
        weaponGraphics.setPosition(
          state.position.x + weaponOffsetX,
          state.position.y + weaponOffsetY
        );
        weaponGraphics.setRotation(aimAngle);

        // Flip weapon vertically when aiming left
        // Angle is in radians: left is between π/2 (90°) and 3π/2 (270°)
        const angleInDegrees = (aimAngle * 180) / Math.PI;
        const normalizedAngle = ((angleInDegrees % 360) + 360) % 360; // Normalize to 0-360
        const isAimingLeft = normalizedAngle > 90 && normalizedAngle < 270;
        weaponGraphics.setFlipY(isAimingLeft);
      }
    }
  }

  /**
   * Cleanup all players
   */
  destroy(): void {
    for (const playerGraphics of this.players.values()) {
      playerGraphics.destroy();
    }
    this.players.clear();

    for (const label of this.playerLabels.values()) {
      label.destroy();
    }
    this.playerLabels.clear();

    for (const aimIndicator of this.aimIndicators.values()) {
      aimIndicator.destroy();
    }
    this.aimIndicators.clear();

    for (const weaponGraphics of this.weaponGraphics.values()) {
      weaponGraphics.destroy();
    }
    this.weaponGraphics.clear();

    this.weaponTypes.clear();
    this.playerStates.clear();

    // Reset localPlayerId so new room:joined can set it fresh
    this.localPlayerId = null;
  }

  /**
   * Get list of living players (excludes dead players)
   */
  getLivingPlayers(): PlayerState[] {
    const livingPlayers: PlayerState[] = [];
    for (const state of this.playerStates.values()) {
      if (state.deathTime === undefined) {
        livingPlayers.push(state);
      }
    }
    return livingPlayers;
  }

  /**
   * Check if the local player is dead
   */
  isLocalPlayerDead(): boolean {
    if (!this.localPlayerId) {
      return false;
    }
    const localPlayerState = this.playerStates.get(this.localPlayerId);
    return localPlayerState?.deathTime !== undefined;
  }

  /**
   * Get a player's current position by ID
   * Returns null if player not found
   */
  getPlayerPosition(playerId: string): { x: number; y: number } | null {
    const playerState = this.playerStates.get(playerId);
    return playerState ? playerState.position : null;
  }

  /**
   * Get a player's aim angle
   * Returns null if player doesn't exist or aim angle is not set
   */
  getPlayerAimAngle(playerId: string): number | null {
    const playerState = this.playerStates.get(playerId);
    return playerState?.aimAngle ?? null;
  }

  /**
   * Get the local player's position for camera follow
   * Returns null if local player doesn't exist yet
   */
  getLocalPlayerSprite(): { x: number; y: number } | null {
    if (!this.localPlayerId) {
      return null;
    }
    const playerGraphics = this.players.get(this.localPlayerId);
    return playerGraphics ? playerGraphics.getPosition() : null;
  }

  /**
   * Get the local player's current position
   * Returns undefined if local player doesn't exist yet
   */
  getLocalPlayerPosition(): { x: number; y: number } | undefined {
    if (!this.localPlayerId) {
      return undefined;
    }
    return this.getPlayerPosition(this.localPlayerId) ?? undefined;
  }

  /**
   * Update local player's aim indicator from current aim angle
   * This provides immediate visual feedback without waiting for server echo
   */
  updateLocalPlayerAim(aimAngle: number): void {
    if (!this.localPlayerId) {
      return;
    }

    const aimIndicator = this.aimIndicators.get(this.localPlayerId);
    const playerState = this.playerStates.get(this.localPlayerId);

    if (aimIndicator && playerState) {
      const endX = playerState.position.x + Math.cos(aimAngle) * AIM_INDICATOR_LENGTH;
      const endY = playerState.position.y + Math.sin(aimAngle) * AIM_INDICATOR_LENGTH;
      aimIndicator.setTo(
        playerState.position.x, playerState.position.y,
        endX, endY
      );
    }
  }

  /**
   * Check if the local player is currently moving
   * A player is considered moving if their velocity is above a threshold
   */
  isLocalPlayerMoving(): boolean {
    if (!this.localPlayerId) {
      return false;
    }

    const playerState = this.playerStates.get(this.localPlayerId);
    if (!playerState) {
      return false;
    }

    const MOVEMENT_THRESHOLD = 0.1; // Velocity threshold to consider as moving
    const velocityMagnitude = Math.sqrt(
      playerState.velocity.x ** 2 + playerState.velocity.y ** 2
    );

    return velocityMagnitude > MOVEMENT_THRESHOLD;
  }

  /**
   * Update the weapon type for a specific player
   * This changes the weapon graphics displayed for the player
   */
  updatePlayerWeapon(playerId: string, weaponType: string): void {
    // Store weapon type
    this.weaponTypes.set(playerId, weaponType);

    // Update weapon graphics if player exists
    const weaponGraphics = this.weaponGraphics.get(playerId);
    if (weaponGraphics) {
      weaponGraphics.setWeapon(weaponType);
    }
  }
}
