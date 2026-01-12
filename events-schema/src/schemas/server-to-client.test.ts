/**
 * Tests for server-to-client message schemas.
 */
import { describe, it, expect } from 'vitest';
import { Value } from '@sinclair/typebox/value';
import {
  RoomJoinedDataSchema,
  RoomJoinedMessageSchema,
  PlayerMoveDataSchema,
  PlayerMoveMessageSchema,
  ProjectileSpawnDataSchema,
  ProjectileSpawnMessageSchema,
  ProjectileDestroyDataSchema,
  ProjectileDestroyMessageSchema,
  WeaponStateDataSchema,
  WeaponStateMessageSchema,
  ShootFailedDataSchema,
  ShootFailedMessageSchema,
  PlayerDamagedDataSchema,
  PlayerDamagedMessageSchema,
  HitConfirmedDataSchema,
  HitConfirmedMessageSchema,
  PlayerDeathDataSchema,
  PlayerDeathMessageSchema,
  PlayerKillCreditDataSchema,
  PlayerKillCreditMessageSchema,
  PlayerRespawnDataSchema,
  PlayerRespawnMessageSchema,
  MatchTimerDataSchema,
  MatchTimerMessageSchema,
  MatchEndedDataSchema,
  MatchEndedMessageSchema,
  WeaponSpawnedDataSchema,
  WeaponSpawnedMessageSchema,
  WeaponPickupConfirmedDataSchema,
  WeaponPickupConfirmedMessageSchema,
  WeaponRespawnedDataSchema,
  WeaponRespawnedMessageSchema,
} from './server-to-client.js';

describe('Server-to-Client Schemas', () => {
  describe('RoomJoinedDataSchema', () => {
    it('should validate valid room joined data', () => {
      const data = { playerId: 'player-123' };
      expect(Value.Check(RoomJoinedDataSchema, data)).toBe(true);
    });

    it('should reject data without playerId', () => {
      const data = {};
      expect(Value.Check(RoomJoinedDataSchema, data)).toBe(false);
    });

    it('should reject empty playerId', () => {
      const data = { playerId: '' };
      expect(Value.Check(RoomJoinedDataSchema, data)).toBe(false);
    });
  });

  describe('RoomJoinedMessageSchema', () => {
    it('should validate complete room:joined message', () => {
      const message = {
        type: 'room:joined',
        timestamp: Date.now(),
        data: { playerId: 'player-123' },
      };
      expect(Value.Check(RoomJoinedMessageSchema, message)).toBe(true);
    });

    it('should reject wrong message type', () => {
      const message = {
        type: 'wrong:type',
        timestamp: Date.now(),
        data: { playerId: 'player-123' },
      };
      expect(Value.Check(RoomJoinedMessageSchema, message)).toBe(false);
    });
  });

  describe('PlayerMoveDataSchema', () => {
    it('should validate valid player move data with multiple players', () => {
      const data = {
        players: [
          {
            id: 'player-1',
            position: { x: 100, y: 200 },
            velocity: { x: 5, y: -3 },
            health: 100,
            maxHealth: 100,
            rotation: 1.57,
            isDead: false,
          },
          {
            id: 'player-2',
            position: { x: 300, y: 400 },
            velocity: { x: 0, y: 0 },
            health: 75,
            maxHealth: 100,
            rotation: 0,
            isDead: false,
          },
        ],
      };
      expect(Value.Check(PlayerMoveDataSchema, data)).toBe(true);
    });

    it('should reject invalid health values', () => {
      const data = {
        players: [
          {
            id: 'player-1',
            position: { x: 100, y: 200 },
            velocity: { x: 5, y: -3 },
            health: -10,
            maxHealth: 100,
            rotation: 1.57,
            isDead: false,
          },
        ],
      };
      expect(Value.Check(PlayerMoveDataSchema, data)).toBe(false);
    });

    it('should accept empty players array', () => {
      const data = { players: [] };
      expect(Value.Check(PlayerMoveDataSchema, data)).toBe(true);
    });
  });

  describe('ProjectileSpawnDataSchema', () => {
    it('should validate valid projectile spawn data', () => {
      const data = {
        id: 'proj-123',
        ownerId: 'player-456',
        position: { x: 150, y: 250 },
        velocity: { x: 10, y: 0 },
      };
      expect(Value.Check(ProjectileSpawnDataSchema, data)).toBe(true);
    });

    it('should reject missing required fields', () => {
      const data = {
        id: 'proj-123',
        position: { x: 150, y: 250 },
      };
      expect(Value.Check(ProjectileSpawnDataSchema, data)).toBe(false);
    });
  });

  describe('ProjectileDestroyDataSchema', () => {
    it('should validate valid projectile destroy data', () => {
      const data = { id: 'proj-123' };
      expect(Value.Check(ProjectileDestroyDataSchema, data)).toBe(true);
    });

    it('should reject empty id', () => {
      const data = { id: '' };
      expect(Value.Check(ProjectileDestroyDataSchema, data)).toBe(false);
    });
  });

  describe('WeaponStateDataSchema', () => {
    it('should validate valid weapon state data', () => {
      const data = {
        currentAmmo: 15,
        maxAmmo: 30,
        isReloading: false,
        canShoot: true,
      };
      expect(Value.Check(WeaponStateDataSchema, data)).toBe(true);
    });

    it('should reject negative ammo', () => {
      const data = {
        currentAmmo: -5,
        maxAmmo: 30,
        isReloading: false,
        canShoot: true,
      };
      expect(Value.Check(WeaponStateDataSchema, data)).toBe(false);
    });

    it('should accept zero ammo', () => {
      const data = {
        currentAmmo: 0,
        maxAmmo: 30,
        isReloading: true,
        canShoot: false,
      };
      expect(Value.Check(WeaponStateDataSchema, data)).toBe(true);
    });
  });

  describe('ShootFailedDataSchema', () => {
    it('should validate valid shoot failed data', () => {
      const data = { reason: 'out_of_ammo' };
      expect(Value.Check(ShootFailedDataSchema, data)).toBe(true);
    });

    it('should reject empty reason', () => {
      const data = { reason: '' };
      expect(Value.Check(ShootFailedDataSchema, data)).toBe(false);
    });
  });

  describe('PlayerDamagedDataSchema', () => {
    it('should validate valid player damaged data', () => {
      const data = {
        victimId: 'player-1',
        attackerId: 'player-2',
        damage: 25,
        newHealth: 75,
        projectileId: 'proj-123',
      };
      expect(Value.Check(PlayerDamagedDataSchema, data)).toBe(true);
    });

    it('should reject negative damage', () => {
      const data = {
        victimId: 'player-1',
        attackerId: 'player-2',
        damage: -10,
        newHealth: 75,
        projectileId: 'proj-123',
      };
      expect(Value.Check(PlayerDamagedDataSchema, data)).toBe(false);
    });

    it('should accept zero damage', () => {
      const data = {
        victimId: 'player-1',
        attackerId: 'player-2',
        damage: 0,
        newHealth: 100,
        projectileId: 'proj-123',
      };
      expect(Value.Check(PlayerDamagedDataSchema, data)).toBe(true);
    });
  });

  describe('HitConfirmedDataSchema', () => {
    it('should validate valid hit confirmed data', () => {
      const data = {
        victimId: 'player-1',
        damage: 25,
        projectileId: 'proj-123',
      };
      expect(Value.Check(HitConfirmedDataSchema, data)).toBe(true);
    });
  });

  describe('PlayerDeathDataSchema', () => {
    it('should validate valid player death data', () => {
      const data = {
        victimId: 'player-1',
        attackerId: 'player-2',
      };
      expect(Value.Check(PlayerDeathDataSchema, data)).toBe(true);
    });

    it('should reject empty victimId', () => {
      const data = {
        victimId: '',
        attackerId: 'player-2',
      };
      expect(Value.Check(PlayerDeathDataSchema, data)).toBe(false);
    });
  });

  describe('PlayerKillCreditDataSchema', () => {
    it('should validate valid kill credit data', () => {
      const data = {
        killerId: 'player-2',
        victimId: 'player-1',
        killerKills: 5,
        killerXP: 150,
      };
      expect(Value.Check(PlayerKillCreditDataSchema, data)).toBe(true);
    });

    it('should reject negative kills', () => {
      const data = {
        killerId: 'player-2',
        victimId: 'player-1',
        killerKills: -1,
        killerXP: 150,
      };
      expect(Value.Check(PlayerKillCreditDataSchema, data)).toBe(false);
    });
  });

  describe('PlayerRespawnDataSchema', () => {
    it('should validate valid respawn data', () => {
      const data = {
        playerId: 'player-1',
        position: { x: 100, y: 200 },
        health: 100,
      };
      expect(Value.Check(PlayerRespawnDataSchema, data)).toBe(true);
    });

    it('should reject negative health', () => {
      const data = {
        playerId: 'player-1',
        position: { x: 100, y: 200 },
        health: -10,
      };
      expect(Value.Check(PlayerRespawnDataSchema, data)).toBe(false);
    });
  });

  describe('MatchTimerDataSchema', () => {
    it('should validate valid match timer data', () => {
      const data = { remainingSeconds: 300 };
      expect(Value.Check(MatchTimerDataSchema, data)).toBe(true);
    });

    it('should accept zero remaining seconds', () => {
      const data = { remainingSeconds: 0 };
      expect(Value.Check(MatchTimerDataSchema, data)).toBe(true);
    });

    it('should reject negative remaining seconds', () => {
      const data = { remainingSeconds: -5 };
      expect(Value.Check(MatchTimerDataSchema, data)).toBe(false);
    });
  });

  describe('MatchEndedDataSchema', () => {
    it('should validate valid match ended data with winners', () => {
      const data = {
        winners: ['player-1', 'player-2'],
        finalScores: {
          'player-1': 100,
          'player-2': 90,
          'player-3': 50,
        },
        reason: 'time_limit',
      };
      expect(Value.Check(MatchEndedDataSchema, data)).toBe(true);
    });

    it('should accept empty winners array', () => {
      const data = {
        winners: [],
        finalScores: {},
        reason: 'draw',
      };
      expect(Value.Check(MatchEndedDataSchema, data)).toBe(true);
    });

    it('should reject empty reason', () => {
      const data = {
        winners: ['player-1'],
        finalScores: { 'player-1': 100 },
        reason: '',
      };
      expect(Value.Check(MatchEndedDataSchema, data)).toBe(false);
    });
  });

  describe('WeaponSpawnedDataSchema', () => {
    it('should validate valid weapon spawned data', () => {
      const data = {
        crates: [
          {
            id: 'crate-1',
            position: { x: 100, y: 200 },
            weaponType: 'uzi',
            isAvailable: true,
          },
          {
            id: 'crate-2',
            position: { x: 300, y: 400 },
            weaponType: 'ak47',
            isAvailable: false,
          },
        ],
      };
      expect(Value.Check(WeaponSpawnedDataSchema, data)).toBe(true);
    });

    it('should accept empty crates array', () => {
      const data = { crates: [] };
      expect(Value.Check(WeaponSpawnedDataSchema, data)).toBe(true);
    });

    it('should reject empty weapon type', () => {
      const data = {
        crates: [
          {
            id: 'crate-1',
            position: { x: 100, y: 200 },
            weaponType: '',
            isAvailable: true,
          },
        ],
      };
      expect(Value.Check(WeaponSpawnedDataSchema, data)).toBe(false);
    });
  });

  describe('WeaponPickupConfirmedDataSchema', () => {
    it('should validate valid weapon pickup confirmed data', () => {
      const data = {
        playerId: 'player-1',
        crateId: 'crate-1',
        weaponType: 'uzi',
        nextRespawnTime: 30000,
      };
      expect(Value.Check(WeaponPickupConfirmedDataSchema, data)).toBe(true);
    });

    it('should reject negative respawn time', () => {
      const data = {
        playerId: 'player-1',
        crateId: 'crate-1',
        weaponType: 'uzi',
        nextRespawnTime: -1000,
      };
      expect(Value.Check(WeaponPickupConfirmedDataSchema, data)).toBe(false);
    });

    it('should accept zero respawn time', () => {
      const data = {
        playerId: 'player-1',
        crateId: 'crate-1',
        weaponType: 'uzi',
        nextRespawnTime: 0,
      };
      expect(Value.Check(WeaponPickupConfirmedDataSchema, data)).toBe(true);
    });
  });

  describe('WeaponRespawnedDataSchema', () => {
    it('should validate valid weapon respawned data', () => {
      const data = {
        crateId: 'crate-1',
        weaponType: 'ak47',
        position: { x: 500, y: 600 },
      };
      expect(Value.Check(WeaponRespawnedDataSchema, data)).toBe(true);
    });

    it('should reject empty crateId', () => {
      const data = {
        crateId: '',
        weaponType: 'ak47',
        position: { x: 500, y: 600 },
      };
      expect(Value.Check(WeaponRespawnedDataSchema, data)).toBe(false);
    });
  });

  describe('Complete Message Schemas', () => {
    it('should validate all message types with correct structure', () => {
      const timestamp = Date.now();

      const messages = [
        {
          schema: RoomJoinedMessageSchema,
          message: {
            type: 'room:joined',
            timestamp,
            data: { playerId: 'p1' },
          },
        },
        {
          schema: PlayerMoveMessageSchema,
          message: {
            type: 'player:move',
            timestamp,
            data: { players: [] },
          },
        },
        {
          schema: ProjectileSpawnMessageSchema,
          message: {
            type: 'projectile:spawn',
            timestamp,
            data: {
              id: 'proj-1',
              ownerId: 'p1',
              position: { x: 0, y: 0 },
              velocity: { x: 1, y: 0 },
            },
          },
        },
        {
          schema: ProjectileDestroyMessageSchema,
          message: {
            type: 'projectile:destroy',
            timestamp,
            data: { id: 'proj-1' },
          },
        },
        {
          schema: WeaponStateMessageSchema,
          message: {
            type: 'weapon:state',
            timestamp,
            data: {
              currentAmmo: 10,
              maxAmmo: 30,
              isReloading: false,
              canShoot: true,
            },
          },
        },
        {
          schema: ShootFailedMessageSchema,
          message: {
            type: 'shoot:failed',
            timestamp,
            data: { reason: 'cooldown' },
          },
        },
        {
          schema: MatchTimerMessageSchema,
          message: {
            type: 'match:timer',
            timestamp,
            data: { remainingSeconds: 60 },
          },
        },
        {
          schema: MatchEndedMessageSchema,
          message: {
            type: 'match:ended',
            timestamp,
            data: {
              winners: ['p1'],
              finalScores: { p1: 100 },
              reason: 'elimination',
            },
          },
        },
      ];

      messages.forEach(({ schema, message }) => {
        expect(Value.Check(schema, message)).toBe(true);
      });
    });
  });
});
