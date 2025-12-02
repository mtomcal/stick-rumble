import Phaser from 'phaser';
import { PLAYER } from '../../shared/constants';

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
}

/**
 * PlayerManager handles rendering and updating all players
 */
export class PlayerManager {
  private scene: Phaser.Scene;
  private players: Map<string, Phaser.GameObjects.Rectangle> = new Map();
  private playerLabels: Map<string, Phaser.GameObjects.Text> = new Map();
  private localPlayerId: string | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
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
   * Update all players from server state
   */
  updatePlayers(playerStates: PlayerState[]): void {
    const currentPlayerIds = new Set(playerStates.map(p => p.id));

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
      }
    }

    // Update or create players
    for (const state of playerStates) {
      let sprite = this.players.get(state.id);

      if (!sprite) {
        // Check if scene.add is available
        if (!this.scene.add) {
          console.error('Scene add system not available');
          continue;
        }

        // Create new player sprite
        const isLocal = state.id === this.localPlayerId;
        const color = isLocal ? 0x00ff00 : 0xff0000;

        sprite = this.scene.add.rectangle(
          state.position.x,
          state.position.y,
          PLAYER.WIDTH,
          PLAYER.HEIGHT,
          color
        );

        this.players.set(state.id, sprite);

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
      }

      // Update position
      sprite.setPosition(state.position.x, state.position.y);

      // Update label position
      const label = this.playerLabels.get(state.id);
      if (label) {
        label.setPosition(
          state.position.x,
          state.position.y - PLAYER.HEIGHT / 2 - 10
        );
      }
    }
  }

  /**
   * Cleanup all players
   */
  destroy(): void {
    for (const sprite of this.players.values()) {
      sprite.destroy();
    }
    this.players.clear();

    for (const label of this.playerLabels.values()) {
      label.destroy();
    }
    this.playerLabels.clear();
  }
}
