/**
 * GameSimulation - Pure logic game simulation without Phaser dependencies
 * Enables fast, deterministic testing of game logic
 * Mirrors server-side GameServer pattern
 */

import type { Clock } from '../utils/Clock';
import { RealClock } from '../utils/Clock';
import type {
  Vector2,
  InputState,
  SimulatedPlayerState,
  Projectile,
  HitEvent,
  DeathEvent,
  WeaponPickupEvent,
} from './types';
import {
  normalize,
  accelerateToward,
  decelerateToZero,
  clampToArena,
  checkAABBCollision,
} from './physics';
import { ARENA, MOVEMENT, PLAYER, WEAPON } from '../../shared/constants';

// Generate unique IDs
let projectileIdCounter = 0;

/**
 * GameSimulation manages the pure logic game state without rendering
 */
export class GameSimulation {
  private clock: Clock;
  private players: Map<string, SimulatedPlayerState> = new Map();
  private projectiles: Projectile[] = [];

  // Event callbacks
  private hitCallbacks: Array<(event: HitEvent) => void> = [];
  private deathCallbacks: Array<(event: DeathEvent) => void> = [];
  private weaponPickupCallbacks: Array<(event: WeaponPickupEvent) => void> = [];

  constructor(clock: Clock = new RealClock()) {
    this.clock = clock;
  }

  /**
   * Get the clock instance (useful for tests)
   */
  getClock(): Clock {
    return this.clock;
  }

  /**
   * Add a player to the simulation at the specified position
   */
  addPlayer(id: string, position: Vector2): void {
    const player: SimulatedPlayerState = {
      id,
      position: { ...position },
      velocity: { x: 0, y: 0 },
      input: { up: false, down: false, left: false, right: false },
      health: 100,
      isAlive: true,
      isInvulnerable: false,
    };
    this.players.set(id, player);
  }

  /**
   * Remove a player from the simulation
   */
  removePlayer(id: string): void {
    this.players.delete(id);
  }

  /**
   * Update input state for a player
   */
  updateInput(playerId: string, input: InputState): void {
    const player = this.players.get(playerId);
    if (!player) return;

    player.input = { ...input };
  }

  /**
   * Get the state of a specific player
   */
  getPlayerState(id: string): SimulatedPlayerState | undefined {
    const player = this.players.get(id);
    if (!player) return undefined;

    // Return a copy to prevent external mutation
    return {
      ...player,
      position: { ...player.position },
      velocity: { ...player.velocity },
      input: { ...player.input },
    };
  }

  /**
   * Get all player states
   */
  getAllPlayers(): SimulatedPlayerState[] {
    return Array.from(this.players.values()).map((player) => ({
      ...player,
      position: { ...player.position },
      velocity: { ...player.velocity },
      input: { ...player.input },
    }));
  }

  /**
   * Spawn a projectile from a player in the specified direction
   * @param ownerId ID of the player shooting
   * @param aimAngle Angle in radians (0 = right, Math.PI/2 = down, etc.)
   */
  spawnProjectile(ownerId: string, aimAngle: number): Projectile {
    const player = this.players.get(ownerId);
    if (!player) {
      throw new Error(`Cannot spawn projectile: player ${ownerId} not found`);
    }

    const velocity = {
      x: Math.cos(aimAngle) * WEAPON.PROJECTILE_SPEED,
      y: Math.sin(aimAngle) * WEAPON.PROJECTILE_SPEED,
    };

    const projectile: Projectile = {
      id: `proj-${projectileIdCounter++}`,
      ownerId,
      position: { ...player.position },
      velocity,
      spawnPosition: { ...player.position },
      spawnTime: this.clock.now(),
      active: true,
    };

    this.projectiles.push(projectile);
    return projectile;
  }

  /**
   * Get all active projectiles
   */
  getActiveProjectiles(): Projectile[] {
    return this.projectiles
      .filter((p) => p.active)
      .map((p) => ({
        ...p,
        position: { ...p.position },
        velocity: { ...p.velocity },
        spawnPosition: { ...p.spawnPosition },
      }));
  }

  /**
   * Damage a player and trigger death if health reaches zero
   */
  damagePlayer(playerId: string, damage: number): void {
    const player = this.players.get(playerId);
    if (!player || !player.isAlive) return;

    player.health = Math.max(0, player.health - damage);

    if (player.health === 0) {
      this.killPlayer(playerId);
    }
  }

  /**
   * Kill a player
   */
  killPlayer(playerId: string, killerId?: string): void {
    const player = this.players.get(playerId);
    if (!player) return;

    player.isAlive = false;
    player.health = 0;
    player.deathTime = this.clock.now();

    // Emit death event
    this.deathCallbacks.forEach((callback) => {
      callback({ playerId, killerId });
    });
  }

  /**
   * Register a callback for hit events
   */
  onHit(callback: (event: HitEvent) => void): void {
    this.hitCallbacks.push(callback);
  }

  /**
   * Register a callback for death events
   */
  onDeath(callback: (event: DeathEvent) => void): void {
    this.deathCallbacks.push(callback);
  }

  /**
   * Register a callback for weapon pickup events
   */
  onWeaponPickup(callback: (event: WeaponPickupEvent) => void): void {
    this.weaponPickupCallbacks.push(callback);
  }

  /**
   * Advance the simulation by one tick
   * @param deltaMs Time step in milliseconds
   */
  tick(deltaMs: number): void {
    const dt = deltaMs / 1000; // Convert to seconds

    // Update all players
    for (const player of this.players.values()) {
      this.updatePlayerPhysics(player, dt);
    }

    // Update all projectiles
    this.updateProjectiles(dt);

    // Check for collisions
    this.checkCollisions();
  }

  /**
   * Update player physics based on input (pure math, no Phaser)
   */
  private updatePlayerPhysics(player: SimulatedPlayerState, dt: number): void {
    if (!player.isAlive) return;

    const input = player.input;

    // Calculate input direction vector
    const inputDir: Vector2 = { x: 0, y: 0 };

    if (input.left) inputDir.x -= 1;
    if (input.right) inputDir.x += 1;
    if (input.up) inputDir.y -= 1;
    if (input.down) inputDir.y += 1;

    // Normalize input direction for diagonal movement
    const normalizedInput = normalize(inputDir);

    // Apply acceleration or deceleration
    let newVel: Vector2;
    if (normalizedInput.x !== 0 || normalizedInput.y !== 0) {
      // Player is giving input - accelerate toward target velocity
      const targetVel: Vector2 = {
        x: normalizedInput.x * MOVEMENT.SPEED,
        y: normalizedInput.y * MOVEMENT.SPEED,
      };

      newVel = accelerateToward(
        player.velocity,
        targetVel,
        MOVEMENT.ACCELERATION,
        dt
      );
    } else {
      // No input - decelerate to zero
      newVel = decelerateToZero(player.velocity, MOVEMENT.DECELERATION, dt);
    }

    player.velocity = newVel;

    // Update position based on velocity
    const newPos: Vector2 = {
      x: player.position.x + player.velocity.x * dt,
      y: player.position.y + player.velocity.y * dt,
    };

    // Clamp position to arena bounds
    player.position = clampToArena(newPos);
  }

  /**
   * Update all projectiles
   */
  private updateProjectiles(dt: number): void {
    const currentTime = this.clock.now();

    for (const projectile of this.projectiles) {
      if (!projectile.active) continue;

      // Update position
      projectile.position.x += projectile.velocity.x * dt;
      projectile.position.y += projectile.velocity.y * dt;

      // Check lifetime
      const lifetime = currentTime - projectile.spawnTime;
      if (lifetime >= WEAPON.PROJECTILE_MAX_LIFETIME) {
        projectile.active = false;
      }

      // Check if out of bounds
      if (
        projectile.position.x < 0 ||
        projectile.position.x > ARENA.WIDTH ||
        projectile.position.y < 0 ||
        projectile.position.y > ARENA.HEIGHT
      ) {
        projectile.active = false;
      }
    }
  }

  /**
   * Check for projectile-player collisions
   */
  private checkCollisions(): void {
    const hitProjectiles = new Set<string>();

    for (const projectile of this.projectiles) {
      if (!projectile.active || hitProjectiles.has(projectile.id)) continue;

      for (const player of this.players.values()) {
        // Skip collision checks with dead or invulnerable players
        if (!player.isAlive || player.isInvulnerable) continue;

        // Skip collision with owner
        if (projectile.ownerId === player.id) continue;

        // AABB collision detection
        const halfWidth = PLAYER.WIDTH / 2;
        const halfHeight = PLAYER.HEIGHT / 2;

        if (
          checkAABBCollision(
            projectile.position,
            player.position,
            halfWidth,
            halfHeight
          )
        ) {
          // Hit detected
          hitProjectiles.add(projectile.id);
          projectile.active = false;

          // Emit hit event
          const hitEvent: HitEvent = {
            projectileId: projectile.id,
            victimId: player.id,
            attackerId: projectile.ownerId,
          };

          this.hitCallbacks.forEach((callback) => callback(hitEvent));

          // Apply damage
          this.damagePlayer(player.id, WEAPON.PISTOL_DAMAGE);

          break; // Each projectile can only hit one player
        }
      }
    }
  }
}
