import { describe, it, expect, beforeEach } from 'vitest';
import { GameSimulation } from './GameSimulation';
import { ManualClock } from '../utils/Clock';
import type { InputState } from './types';

describe('GameSimulation', () => {
  let clock: ManualClock;
  let sim: GameSimulation;

  beforeEach(() => {
    clock = new ManualClock();
    sim = new GameSimulation(clock);
  });

  describe('Player Management', () => {
    it('should add a player at specified position', () => {
      sim.addPlayer('p1', { x: 500, y: 500 });

      const state = sim.getPlayerState('p1');
      expect(state).toBeDefined();
      expect(state?.position.x).toBe(500);
      expect(state?.position.y).toBe(500);
      expect(state?.velocity.x).toBe(0);
      expect(state?.velocity.y).toBe(0);
    });

    it('should return undefined for non-existent player', () => {
      const state = sim.getPlayerState('non-existent');
      expect(state).toBeUndefined();
    });

    it('should return all players', () => {
      sim.addPlayer('p1', { x: 100, y: 100 });
      sim.addPlayer('p2', { x: 200, y: 200 });
      sim.addPlayer('p3', { x: 300, y: 300 });

      const players = sim.getAllPlayers();
      expect(players).toHaveLength(3);
      expect(players.map(p => p.id)).toContain('p1');
      expect(players.map(p => p.id)).toContain('p2');
      expect(players.map(p => p.id)).toContain('p3');
    });

    it('should remove a player', () => {
      sim.addPlayer('p1', { x: 100, y: 100 });
      expect(sim.getPlayerState('p1')).toBeDefined();

      sim.removePlayer('p1');
      expect(sim.getPlayerState('p1')).toBeUndefined();
    });
  });

  describe('Player Movement - Right', () => {
    it('should move player right when right key is pressed', () => {
      sim.addPlayer('p1', { x: 500, y: 500 });
      const input: InputState = { up: false, down: false, left: false, right: true };
      sim.updateInput('p1', input);

      // Simulate 1 second at 60 FPS (60 ticks)
      for (let i = 0; i < 60; i++) {
        sim.tick(16.67);
        clock.advance(16.67);
      }

      const state = sim.getPlayerState('p1')!;
      expect(state.position.x).toBeGreaterThan(500);
      expect(state.velocity.x).toBeGreaterThan(0);
    });

    it('should accelerate smoothly to max speed', () => {
      sim.addPlayer('p1', { x: 500, y: 500 });
      const input: InputState = { up: false, down: false, left: false, right: true };
      sim.updateInput('p1', input);

      let previousVelocity = 0;
      const velocities: number[] = [];

      // Simulate 240 ticks (4 seconds at 60 FPS)
      // With 50 px/s² acceleration, reaching 200 px/s takes 4 seconds
      for (let i = 0; i < 240; i++) {
        sim.tick(16.67);
        const state = sim.getPlayerState('p1')!;
        velocities.push(state.velocity.x);

        // Velocity should increase or stay constant (when max reached)
        expect(state.velocity.x).toBeGreaterThanOrEqual(previousVelocity - 0.1); // Allow small floating point errors
        previousVelocity = state.velocity.x;
      }

      // Should eventually reach max speed (200 px/s)
      const finalVelocity = velocities[velocities.length - 1];
      expect(finalVelocity).toBeCloseTo(200, 1);
    });
  });

  describe('Player Movement - Left', () => {
    it('should move player left when left key is pressed', () => {
      sim.addPlayer('p1', { x: 500, y: 500 });
      const input: InputState = { up: false, down: false, left: true, right: false };
      sim.updateInput('p1', input);

      // Simulate 1 second
      for (let i = 0; i < 60; i++) {
        sim.tick(16.67);
        clock.advance(16.67);
      }

      const state = sim.getPlayerState('p1')!;
      expect(state.position.x).toBeLessThan(500);
      expect(state.velocity.x).toBeLessThan(0);
    });
  });

  describe('Player Movement - Up', () => {
    it('should move player up when up key is pressed', () => {
      sim.addPlayer('p1', { x: 500, y: 500 });
      const input: InputState = { up: true, down: false, left: false, right: false };
      sim.updateInput('p1', input);

      // Simulate 1 second
      for (let i = 0; i < 60; i++) {
        sim.tick(16.67);
        clock.advance(16.67);
      }

      const state = sim.getPlayerState('p1')!;
      expect(state.position.y).toBeLessThan(500);
      expect(state.velocity.y).toBeLessThan(0);
    });
  });

  describe('Player Movement - Down', () => {
    it('should move player down when down key is pressed', () => {
      sim.addPlayer('p1', { x: 500, y: 500 });
      const input: InputState = { up: false, down: true, left: false, right: false };
      sim.updateInput('p1', input);

      // Simulate 1 second
      for (let i = 0; i < 60; i++) {
        sim.tick(16.67);
        clock.advance(16.67);
      }

      const state = sim.getPlayerState('p1')!;
      expect(state.position.y).toBeGreaterThan(500);
      expect(state.velocity.y).toBeGreaterThan(0);
    });
  });

  describe('Player Movement - Diagonal', () => {
    it('should normalize diagonal movement speed', () => {
      sim.addPlayer('p1', { x: 500, y: 500 });
      const input: InputState = { up: true, down: false, left: false, right: true };
      sim.updateInput('p1', input);

      // Simulate until max speed reached (4 seconds at 60 FPS)
      for (let i = 0; i < 240; i++) {
        sim.tick(16.67);
      }

      const state = sim.getPlayerState('p1')!;
      const speed = Math.sqrt(state.velocity.x ** 2 + state.velocity.y ** 2);

      // Diagonal speed should be close to max speed (200 px/s), not sqrt(2) * 200
      expect(speed).toBeCloseTo(200, 1);
    });

    it('should move diagonally up-right', () => {
      const startX = 500;
      const startY = 500;
      sim.addPlayer('p1', { x: startX, y: startY });
      const input: InputState = { up: true, down: false, left: false, right: true };
      sim.updateInput('p1', input);

      for (let i = 0; i < 60; i++) {
        sim.tick(16.67);
      }

      const state = sim.getPlayerState('p1')!;
      expect(state.position.x).toBeGreaterThan(startX);
      expect(state.position.y).toBeLessThan(startY);
    });

    it('should move diagonally down-left', () => {
      const startX = 500;
      const startY = 500;
      sim.addPlayer('p1', { x: startX, y: startY });
      const input: InputState = { up: false, down: true, left: true, right: false };
      sim.updateInput('p1', input);

      for (let i = 0; i < 60; i++) {
        sim.tick(16.67);
      }

      const state = sim.getPlayerState('p1')!;
      expect(state.position.x).toBeLessThan(startX);
      expect(state.position.y).toBeGreaterThan(startY);
    });
  });

  describe('Player Deceleration', () => {
    it('should decelerate to zero when no input', () => {
      sim.addPlayer('p1', { x: 500, y: 500 });

      // Accelerate to full speed
      const input: InputState = { up: false, down: false, left: false, right: true };
      sim.updateInput('p1', input);
      for (let i = 0; i < 60; i++) {
        sim.tick(16.67);
      }

      // Check moving
      let state = sim.getPlayerState('p1')!;
      expect(state.velocity.x).toBeGreaterThan(0);

      // Release input
      const noInput: InputState = { up: false, down: false, left: false, right: false };
      sim.updateInput('p1', noInput);

      // Simulate deceleration
      for (let i = 0; i < 100; i++) {
        sim.tick(16.67);
      }

      state = sim.getPlayerState('p1')!;
      expect(state.velocity.x).toBeCloseTo(0, 1);
      expect(state.velocity.y).toBeCloseTo(0, 1);
    });
  });

  describe('Arena Boundaries', () => {
    it('should clamp player position to left boundary', () => {
      sim.addPlayer('p1', { x: 50, y: 500 });
      const input: InputState = { up: false, down: false, left: true, right: false };
      sim.updateInput('p1', input);

      // Try to move past left boundary
      for (let i = 0; i < 120; i++) {
        sim.tick(16.67);
      }

      const state = sim.getPlayerState('p1')!;
      expect(state.position.x).toBeGreaterThanOrEqual(16); // PLAYER.WIDTH / 2
      expect(state.position.x).toBeLessThanOrEqual(20); // Some tolerance for clamping
    });

    it('should clamp player position to right boundary', () => {
      sim.addPlayer('p1', { x: 1900, y: 500 });
      const input: InputState = { up: false, down: false, left: false, right: true };
      sim.updateInput('p1', input);

      // Try to move past right boundary
      for (let i = 0; i < 120; i++) {
        sim.tick(16.67);
      }

      const state = sim.getPlayerState('p1')!;
      expect(state.position.x).toBeLessThanOrEqual(1904); // ARENA.WIDTH - PLAYER.WIDTH / 2
      expect(state.position.x).toBeGreaterThanOrEqual(1900);
    });

    it('should clamp player position to top boundary', () => {
      sim.addPlayer('p1', { x: 500, y: 50 });
      const input: InputState = { up: true, down: false, left: false, right: false };
      sim.updateInput('p1', input);

      // Try to move past top boundary
      for (let i = 0; i < 120; i++) {
        sim.tick(16.67);
      }

      const state = sim.getPlayerState('p1')!;
      expect(state.position.y).toBeGreaterThanOrEqual(32); // PLAYER.HEIGHT / 2
      expect(state.position.y).toBeLessThanOrEqual(36);
    });

    it('should clamp player position to bottom boundary', () => {
      sim.addPlayer('p1', { x: 500, y: 1060 });
      const input: InputState = { up: false, down: true, left: false, right: false };
      sim.updateInput('p1', input);

      // Try to move past bottom boundary
      for (let i = 0; i < 120; i++) {
        sim.tick(16.67);
      }

      const state = sim.getPlayerState('p1')!;
      expect(state.position.y).toBeLessThanOrEqual(1048); // ARENA.HEIGHT - PLAYER.HEIGHT / 2
      expect(state.position.y).toBeGreaterThanOrEqual(1044);
    });
  });

  describe('Projectiles', () => {
    it('should spawn a projectile when player shoots', () => {
      sim.addPlayer('p1', { x: 500, y: 500 });

      const projectile = sim.spawnProjectile('p1', 0); // Shoot right (0 radians)

      expect(projectile).toBeDefined();
      expect(projectile.ownerId).toBe('p1');
      expect(projectile.active).toBe(true);
    });

    it('should move projectile based on velocity', () => {
      sim.addPlayer('p1', { x: 500, y: 500 });
      const projectile = sim.spawnProjectile('p1', 0);

      const startX = projectile.position.x;

      // Simulate a few ticks
      for (let i = 0; i < 10; i++) {
        sim.tick(16.67);
      }

      const projectiles = sim.getActiveProjectiles();
      expect(projectiles[0].position.x).toBeGreaterThan(startX);
    });

    it('should deactivate projectile after max lifetime', () => {
      sim.addPlayer('p1', { x: 500, y: 500 });
      sim.spawnProjectile('p1', 0);

      // PROJECTILE_MAX_LIFETIME is 1000ms
      // Simulate 1100ms worth of ticks
      const ticksNeeded = Math.ceil(1100 / 16.67);
      for (let i = 0; i < ticksNeeded; i++) {
        sim.tick(16.67);
        clock.advance(16.67);
      }

      const projectiles = sim.getActiveProjectiles();
      expect(projectiles).toHaveLength(0);
    });

    it('should return all active projectiles', () => {
      sim.addPlayer('p1', { x: 500, y: 500 });
      sim.spawnProjectile('p1', 0);
      sim.spawnProjectile('p1', Math.PI / 2);
      sim.spawnProjectile('p1', Math.PI);

      const projectiles = sim.getActiveProjectiles();
      expect(projectiles).toHaveLength(3);
    });
  });

  describe('Projectile-Player Collision', () => {
    it('should detect collision between projectile and player', () => {
      sim.addPlayer('attacker', { x: 100, y: 500 });
      sim.addPlayer('victim', { x: 200, y: 500 });

      const hitEvents: Array<{ projectileId: string; victimId: string; attackerId: string }> = [];
      sim.onHit((event) => hitEvents.push(event));

      // Attacker shoots right at victim
      sim.spawnProjectile('attacker', 0);

      // Simulate until projectile reaches victim (~100px at 800px/s = 125ms)
      const ticksNeeded = Math.ceil(150 / 16.67);
      for (let i = 0; i < ticksNeeded; i++) {
        sim.tick(16.67);
      }

      expect(hitEvents.length).toBeGreaterThanOrEqual(1);
      expect(hitEvents[0].victimId).toBe('victim');
      expect(hitEvents[0].attackerId).toBe('attacker');
    });

    it('should not detect collision with owner', () => {
      sim.addPlayer('p1', { x: 500, y: 500 });

      const hitEvents: Array<{ projectileId: string; victimId: string; attackerId: string }> = [];
      sim.onHit((event) => hitEvents.push(event));

      sim.spawnProjectile('p1', 0);

      // Simulate a few ticks
      for (let i = 0; i < 10; i++) {
        sim.tick(16.67);
      }

      // Should not hit self
      expect(hitEvents).toHaveLength(0);
    });

    it('should deactivate projectile after hit', () => {
      sim.addPlayer('attacker', { x: 100, y: 500 });
      sim.addPlayer('victim', { x: 200, y: 500 });

      sim.spawnProjectile('attacker', 0);

      // Simulate until hit
      for (let i = 0; i < 20; i++) {
        sim.tick(16.67);
      }

      const projectiles = sim.getActiveProjectiles();
      expect(projectiles).toHaveLength(0);
    });

    it('should not detect collision with dead players', () => {
      sim.addPlayer('attacker', { x: 100, y: 500 });
      sim.addPlayer('victim', { x: 200, y: 500 });

      // Kill the victim
      sim.killPlayer('victim');

      const hitEvents: Array<{ projectileId: string; victimId: string; attackerId: string }> = [];
      sim.onHit((event) => hitEvents.push(event));

      sim.spawnProjectile('attacker', 0);

      // Simulate until projectile passes through
      for (let i = 0; i < 30; i++) {
        sim.tick(16.67);
      }

      expect(hitEvents).toHaveLength(0);
    });
  });

  describe('Health and Death', () => {
    it('should damage player and reduce health', () => {
      sim.addPlayer('p1', { x: 500, y: 500 });

      sim.damagePlayer('p1', 25);

      const state = sim.getPlayerState('p1')!;
      expect(state.health).toBe(75);
    });

    it('should kill player when health reaches zero', () => {
      sim.addPlayer('p1', { x: 500, y: 500 });

      const deathEvents: Array<{ playerId: string }> = [];
      sim.onDeath((event) => deathEvents.push(event));

      sim.damagePlayer('p1', 100);

      const state = sim.getPlayerState('p1')!;
      expect(state.health).toBe(0);
      expect(state.isAlive).toBe(false);
      expect(deathEvents).toHaveLength(1);
      expect(deathEvents[0].playerId).toBe('p1');
    });

    it('should not reduce health below zero', () => {
      sim.addPlayer('p1', { x: 500, y: 500 });

      sim.damagePlayer('p1', 150);

      const state = sim.getPlayerState('p1')!;
      expect(state.health).toBe(0);
    });
  });

  describe('Event Callbacks', () => {
    it('should invoke onHit callback on collision', () => {
      sim.addPlayer('attacker', { x: 100, y: 500 });
      sim.addPlayer('victim', { x: 200, y: 500 });

      let hitCount = 0;
      sim.onHit(() => hitCount++);

      sim.spawnProjectile('attacker', 0);

      for (let i = 0; i < 20; i++) {
        sim.tick(16.67);
      }

      expect(hitCount).toBeGreaterThanOrEqual(1);
    });

    it('should invoke onDeath callback when player dies', () => {
      sim.addPlayer('p1', { x: 500, y: 500 });

      let deathCount = 0;
      sim.onDeath(() => deathCount++);

      sim.damagePlayer('p1', 100);

      expect(deathCount).toBe(1);
    });

    it('should support multiple event listeners', () => {
      sim.addPlayer('p1', { x: 500, y: 500 });

      let listener1Called = false;
      let listener2Called = false;

      sim.onDeath(() => listener1Called = true);
      sim.onDeath(() => listener2Called = true);

      sim.damagePlayer('p1', 100);

      expect(listener1Called).toBe(true);
      expect(listener2Called).toBe(true);
    });
  });

  describe('simulateTicks Helper', () => {
    it('should run multiple ticks instantly', () => {
      sim.addPlayer('p1', { x: 500, y: 500 });
      const input: InputState = { up: false, down: false, left: false, right: true };
      sim.updateInput('p1', input);

      const startTime = clock.now();

      // Helper function to simulate N ticks
      const simulateTicks = (count: number) => {
        for (let i = 0; i < count; i++) {
          sim.tick(16.67);
          clock.advance(16.67);
        }
      };

      // Simulate 300 ticks (5 seconds at 60 FPS)
      simulateTicks(300);

      const endTime = clock.now();
      const elapsed = endTime - startTime;

      // Clock should have advanced by 5 seconds (300 ticks * 16.67ms = 5001ms)
      expect(elapsed).toBeCloseTo(5001, 1);

      // Player should have moved significantly
      const state = sim.getPlayerState('p1')!;
      expect(state.position.x).toBeGreaterThan(500);
    });
  });
});
