/**
 * Entity Test Scene for visual regression testing
 * This scene renders game entities (players, melee animations) in isolation for screenshot comparison
 */

import Phaser from 'phaser';
import { PlayerManager, type PlayerState } from './game/entities/PlayerManager';
import { MeleeWeapon } from './game/entities/MeleeWeapon';
import { ProjectileManager, type ProjectileData } from './game/entities/ProjectileManager';
import type { MatchEndData } from './shared/types';

interface WindowWithTestControls extends Window {
  spawnPlayer: (id: string, x: number, y: number, color: string) => void;
  removePlayer: (id: string) => void;
  getPlayerCount: () => number;
  getActiveSprites: () => Array<{ id: string; x: number; y: number }>;
  triggerMeleeSwing: (weaponType: string, angle: number) => void;
  restartScene: () => void;
  clearAllSprites: () => void;
  spawnProjectile: (weaponType: string, x: number, y: number) => string;
  getProjectileCount: () => number;
  showMatchEndScreen: (matchData: MatchEndData, localPlayerId: string) => void;
  pauseGameLoop: () => void;
  resumeGameLoop: () => void;
  stepFrame: (n?: number) => void;
  getFrameCount: () => number;
}

export class EntityTestScene extends Phaser.Scene {
  private playerManager!: PlayerManager;
  private playerStates: Map<string, PlayerState> = new Map();
  private meleeWeapon: MeleeWeapon | null = null;
  private projectileManager!: ProjectileManager;
  private projectileIdCounter = 0;

  constructor() {
    super({ key: 'EntityTestScene' });
  }

  create(): void {
    // Create a dark background for contrast
    this.add.rectangle(400, 300, 800, 600, 0x1a1a1a);

    // Initialize PlayerManager
    this.playerManager = new PlayerManager(this);
    this.playerStates = new Map();

    // Initialize ProjectileManager
    this.projectileManager = new ProjectileManager(this);

    // Expose global functions for test control
    const win = window as unknown as WindowWithTestControls;

    win.spawnPlayer = (id: string, x: number, y: number, color: string) => {
      // Map color string to player state
      const playerState: PlayerState = {
        id,
        position: { x, y },
        velocity: { x: 0, y: 0 },
        aimAngle: 0,
      };

      this.playerStates.set(id, playerState);

      // Set local player for color differentiation
      if (color === 'green') {
        this.playerManager.setLocalPlayerId(id);
      }

      // Update PlayerManager
      this.playerManager.updatePlayers(Array.from(this.playerStates.values()));
    };

    win.removePlayer = (id: string) => {
      this.playerStates.delete(id);
      this.playerManager.updatePlayers(Array.from(this.playerStates.values()));
    };

    win.getPlayerCount = () => {
      return this.playerStates.size;
    };

    win.getActiveSprites = () => {
      const sprites: Array<{ id: string; x: number; y: number }> = [];
      for (const [id, state] of this.playerStates) {
        sprites.push({
          id,
          x: state.position.x,
          y: state.position.y,
        });
      }
      return sprites;
    };

    win.triggerMeleeSwing = (weaponType: string, angle: number) => {
      // Destroy previous weapon if exists
      if (this.meleeWeapon) {
        this.meleeWeapon.destroy();
      }

      // Create melee weapon at center of screen
      this.meleeWeapon = new MeleeWeapon(this, 400, 300, weaponType);

      // Start swing animation
      this.meleeWeapon.startSwing(angle);
    };

    win.restartScene = () => {
      // Clear player states
      this.playerStates.clear();

      // Destroy player manager
      this.playerManager.destroy();

      // Destroy melee weapon if exists
      if (this.meleeWeapon) {
        this.meleeWeapon.destroy();
        this.meleeWeapon = null;
      }

      // Destroy all projectiles
      this.projectileManager.destroy();

      // Recreate managers
      this.playerManager = new PlayerManager(this);
      this.projectileManager = new ProjectileManager(this);
    };

    win.clearAllSprites = () => {
      // Clear all player states
      this.playerStates.clear();
      this.playerManager.updatePlayers([]);

      // Destroy melee weapon if exists
      if (this.meleeWeapon) {
        this.meleeWeapon.destroy();
        this.meleeWeapon = null;
      }

      // Destroy all projectiles
      this.projectileManager.destroy();
    };

    win.spawnProjectile = (weaponType: string, x: number, y: number): string => {
      // Generate unique projectile ID
      const projectileId = `proj-${this.projectileIdCounter++}`;

      // Create projectile data
      const projectileData: ProjectileData = {
        id: projectileId,
        ownerId: 'test',
        weaponType,
        position: { x, y },
        velocity: { x: 0, y: 0 }, // Static for visual test
      };

      // Spawn projectile
      this.projectileManager.spawnProjectile(projectileData);

      return projectileId;
    };

    win.getProjectileCount = () => {
      return this.projectileManager.getProjectileCount();
    };

    win.showMatchEndScreen = (matchData: MatchEndData, localPlayerId: string) => {
      // Trigger the global onMatchEnd handler if it exists
      if (window.onMatchEnd) {
        window.onMatchEnd(matchData, localPlayerId);
      }
    };

    // Frame-stepping control for deterministic animation testing
    win.pauseGameLoop = () => {
      this.game.loop.sleep();
    };

    win.resumeGameLoop = () => {
      this.game.loop.wake();
    };

    win.stepFrame = (n: number = 1) => {
      // Manually advance N frames
      for (let i = 0; i < n; i++) {
        this.game.loop.tick();
      }
    };

    win.getFrameCount = () => {
      return this.game.loop.frame;
    };

    // Mark scene as ready for testing
    this.markComponentReady('entity-test');

    console.log('Entity Test Scene initialized');
  }

  update(): void {
    // Update melee weapon animation
    if (this.meleeWeapon) {
      this.meleeWeapon.update();
    }
  }

  private markComponentReady(componentName: string): void {
    const readyMarker = document.querySelector(
      `[data-testid="${componentName}-ready"]`
    );

    if (readyMarker) {
      readyMarker.setAttribute('data-ready', 'true');
    }
  }
}
