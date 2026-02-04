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
  PlayerScoreSchema,
  MatchEndedDataSchema,
  MatchEndedMessageSchema,
  WeaponSpawnedDataSchema,
  WeaponSpawnedMessageSchema,
  WeaponPickupConfirmedDataSchema,
  WeaponPickupConfirmedMessageSchema,
  WeaponRespawnedDataSchema,
  WeaponRespawnedMessageSchema,
  MeleeHitDataSchema,
  MeleeHitMessageSchema,
  RollStartDataSchema,
  RollStartMessageSchema,
  RollEndDataSchema,
  RollEndMessageSchema,
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
            isSprinting: true,
            isRolling: false,
          },
          {
            id: 'player-2',
            position: { x: 300, y: 400 },
            velocity: { x: 0, y: 0 },
            health: 75,
            maxHealth: 100,
            rotation: 0,
            isDead: false,
            isSprinting: false,
            isRolling: false,
          },
        ],
      };
      expect(Value.Check(PlayerMoveDataSchema, data)).toBe(true);
    });

    it('should validate player move data with lastProcessedSequence', () => {
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
            isSprinting: true,
            isRolling: false,
          },
        ],
        lastProcessedSequence: {
          'player-1': 42,
          'player-2': 17,
        },
      };
      expect(Value.Check(PlayerMoveDataSchema, data)).toBe(true);
    });

    it('should reject negative sequence numbers in lastProcessedSequence', () => {
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
            isSprinting: true,
            isRolling: false,
          },
        ],
        lastProcessedSequence: {
          'player-1': -1,
        },
      };
      expect(Value.Check(PlayerMoveDataSchema, data)).toBe(false);
    });

    it('should accept lastProcessedSequence with sequence 0', () => {
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
            isSprinting: true,
            isRolling: false,
          },
        ],
        lastProcessedSequence: {
          'player-1': 0,
        },
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
            isSprinting: false,
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
        weaponType: 'Pistol',
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
    it('should validate valid ranged weapon state data', () => {
      const data = {
        currentAmmo: 15,
        maxAmmo: 30,
        isReloading: false,
        canShoot: true,
        weaponType: 'Pistol',
        isMelee: false,
      };
      expect(Value.Check(WeaponStateDataSchema, data)).toBe(true);
    });

    it('should validate valid melee weapon state data', () => {
      const data = {
        currentAmmo: 0,
        maxAmmo: 0,
        isReloading: false,
        canShoot: true,
        weaponType: 'Bat',
        isMelee: true,
      };
      expect(Value.Check(WeaponStateDataSchema, data)).toBe(true);
    });

    it('should reject negative ammo', () => {
      const data = {
        currentAmmo: -5,
        maxAmmo: 30,
        isReloading: false,
        canShoot: true,
        weaponType: 'Pistol',
        isMelee: false,
      };
      expect(Value.Check(WeaponStateDataSchema, data)).toBe(false);
    });

    it('should accept zero ammo for ranged weapons (reloading)', () => {
      const data = {
        currentAmmo: 0,
        maxAmmo: 30,
        isReloading: true,
        canShoot: false,
        weaponType: 'Pistol',
        isMelee: false,
      };
      expect(Value.Check(WeaponStateDataSchema, data)).toBe(true);
    });

    it('should reject data without weaponType', () => {
      const data = {
        currentAmmo: 15,
        maxAmmo: 30,
        isReloading: false,
        canShoot: true,
        isMelee: false,
      };
      expect(Value.Check(WeaponStateDataSchema, data)).toBe(false);
    });

    it('should reject data without isMelee', () => {
      const data = {
        currentAmmo: 15,
        maxAmmo: 30,
        isReloading: false,
        canShoot: true,
        weaponType: 'Pistol',
      };
      expect(Value.Check(WeaponStateDataSchema, data)).toBe(false);
    });

    it('should reject empty weaponType', () => {
      const data = {
        currentAmmo: 15,
        maxAmmo: 30,
        isReloading: false,
        canShoot: true,
        weaponType: '',
        isMelee: false,
      };
      expect(Value.Check(WeaponStateDataSchema, data)).toBe(false);
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

  describe('PlayerScoreSchema', () => {
    it('should validate valid player score', () => {
      const data = {
        playerId: 'player-1',
        kills: 10,
        deaths: 2,
        xp: 500,
      };
      expect(Value.Check(PlayerScoreSchema, data)).toBe(true);
    });

    it('should accept zero kills and deaths', () => {
      const data = {
        playerId: 'player-1',
        kills: 0,
        deaths: 0,
        xp: 50,
      };
      expect(Value.Check(PlayerScoreSchema, data)).toBe(true);
    });

    it('should reject missing playerId', () => {
      const data = {
        kills: 5,
        deaths: 2,
        xp: 100,
      };
      expect(Value.Check(PlayerScoreSchema, data)).toBe(false);
    });

    it('should reject negative kills', () => {
      const data = {
        playerId: 'player-1',
        kills: -1,
        deaths: 0,
        xp: 100,
      };
      expect(Value.Check(PlayerScoreSchema, data)).toBe(false);
    });

    it('should reject negative deaths', () => {
      const data = {
        playerId: 'player-1',
        kills: 5,
        deaths: -1,
        xp: 100,
      };
      expect(Value.Check(PlayerScoreSchema, data)).toBe(false);
    });

    it('should reject negative xp', () => {
      const data = {
        playerId: 'player-1',
        kills: 5,
        deaths: 2,
        xp: -50,
      };
      expect(Value.Check(PlayerScoreSchema, data)).toBe(false);
    });

    it('should reject non-integer kills', () => {
      const data = {
        playerId: 'player-1',
        kills: 5.5,
        deaths: 2,
        xp: 100,
      };
      expect(Value.Check(PlayerScoreSchema, data)).toBe(false);
    });

    it('should reject empty playerId', () => {
      const data = {
        playerId: '',
        kills: 5,
        deaths: 2,
        xp: 100,
      };
      expect(Value.Check(PlayerScoreSchema, data)).toBe(false);
    });
  });

  describe('MatchEndedDataSchema', () => {
    it('should validate valid match ended data with winners', () => {
      const data = {
        winners: ['player-1', 'player-2'],
        finalScores: [
          { playerId: 'player-1', kills: 10, deaths: 2, xp: 100 },
          { playerId: 'player-2', kills: 8, deaths: 3, xp: 90 },
          { playerId: 'player-3', kills: 5, deaths: 5, xp: 50 },
        ],
        reason: 'time_limit',
      };
      expect(Value.Check(MatchEndedDataSchema, data)).toBe(true);
    });

    it('should accept empty winners array', () => {
      const data = {
        winners: [],
        finalScores: [],
        reason: 'draw',
      };
      expect(Value.Check(MatchEndedDataSchema, data)).toBe(true);
    });

    it('should reject empty reason', () => {
      const data = {
        winners: ['player-1'],
        finalScores: [{ playerId: 'player-1', kills: 5, deaths: 0, xp: 100 }],
        reason: '',
      };
      expect(Value.Check(MatchEndedDataSchema, data)).toBe(false);
    });

    it('should reject negative kills', () => {
      const data = {
        winners: ['player-1'],
        finalScores: [{ playerId: 'player-1', kills: -1, deaths: 0, xp: 100 }],
        reason: 'elimination',
      };
      expect(Value.Check(MatchEndedDataSchema, data)).toBe(false);
    });

    it('should reject missing playerId in score', () => {
      const data = {
        winners: ['player-1'],
        finalScores: [{ kills: 5, deaths: 0, xp: 100 }],
        reason: 'elimination',
      };
      expect(Value.Check(MatchEndedDataSchema, data)).toBe(false);
    });

    it('should reject non-integer kills', () => {
      const data = {
        winners: ['player-1'],
        finalScores: [{ playerId: 'player-1', kills: 5.5, deaths: 0, xp: 100 }],
        reason: 'elimination',
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

  describe('MeleeHitDataSchema', () => {
    it('should validate valid melee hit data', () => {
      const data = {
        attackerId: 'player-1',
        victims: ['player-2', 'player-3'],
        knockbackApplied: true,
      };
      expect(Value.Check(MeleeHitDataSchema, data)).toBe(true);
    });

    it('should reject empty attackerId', () => {
      const data = {
        attackerId: '',
        victims: ['player-2'],
        knockbackApplied: true,
      };
      expect(Value.Check(MeleeHitDataSchema, data)).toBe(false);
    });

    it('should accept empty victims array', () => {
      const data = {
        attackerId: 'player-1',
        victims: [],
        knockbackApplied: false,
      };
      expect(Value.Check(MeleeHitDataSchema, data)).toBe(true);
    });

    it('should reject victims array with empty strings', () => {
      const data = {
        attackerId: 'player-1',
        victims: ['player-2', ''],
        knockbackApplied: true,
      };
      expect(Value.Check(MeleeHitDataSchema, data)).toBe(false);
    });

    it('should accept knockbackApplied false (Katana)', () => {
      const data = {
        attackerId: 'player-1',
        victims: ['player-2'],
        knockbackApplied: false,
      };
      expect(Value.Check(MeleeHitDataSchema, data)).toBe(true);
    });

    it('should accept knockbackApplied true (Bat)', () => {
      const data = {
        attackerId: 'player-1',
        victims: ['player-2'],
        knockbackApplied: true,
      };
      expect(Value.Check(MeleeHitDataSchema, data)).toBe(true);
    });

    it('should accept multiple victims (AoE)', () => {
      const data = {
        attackerId: 'player-1',
        victims: ['player-2', 'player-3', 'player-4'],
        knockbackApplied: true,
      };
      expect(Value.Check(MeleeHitDataSchema, data)).toBe(true);
    });
  });

  describe('MeleeHitMessageSchema', () => {
    it('should validate complete melee:hit message', () => {
      const message = {
        type: 'melee:hit',
        timestamp: Date.now(),
        data: {
          attackerId: 'player-1',
          victims: ['player-2'],
          knockbackApplied: true,
        },
      };
      expect(Value.Check(MeleeHitMessageSchema, message)).toBe(true);
    });

    it('should reject wrong message type', () => {
      const message = {
        type: 'player:hit',
        timestamp: Date.now(),
        data: {
          attackerId: 'player-1',
          victims: ['player-2'],
          knockbackApplied: true,
        },
      };
      expect(Value.Check(MeleeHitMessageSchema, message)).toBe(false);
    });

    it('should reject missing timestamp', () => {
      const message = {
        type: 'melee:hit',
        data: {
          attackerId: 'player-1',
          victims: ['player-2'],
          knockbackApplied: true,
        },
      };
      expect(Value.Check(MeleeHitMessageSchema, message)).toBe(false);
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
              weaponType: 'Pistol',
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
              weaponType: 'Pistol',
              isMelee: false,
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
              finalScores: [{ playerId: 'p1', kills: 5, deaths: 0, xp: 100 }],
              reason: 'elimination',
            },
          },
        },
        {
          schema: PlayerDamagedMessageSchema,
          message: {
            type: 'player:damaged',
            timestamp,
            data: {
              victimId: 'p2',
              attackerId: 'p1',
              damage: 25,
              newHealth: 75,
              projectileId: 'proj-1',
            },
          },
        },
        {
          schema: HitConfirmedMessageSchema,
          message: {
            type: 'hit:confirmed',
            timestamp,
            data: {
              victimId: 'p2',
              damage: 25,
              projectileId: 'proj-1',
            },
          },
        },
        {
          schema: PlayerDeathMessageSchema,
          message: {
            type: 'player:death',
            timestamp,
            data: {
              victimId: 'p2',
              attackerId: 'p1',
            },
          },
        },
        {
          schema: PlayerKillCreditMessageSchema,
          message: {
            type: 'player:kill_credit',
            timestamp,
            data: {
              killerId: 'p1',
              victimId: 'p2',
              killerKills: 1,
              killerXP: 100,
            },
          },
        },
        {
          schema: PlayerRespawnMessageSchema,
          message: {
            type: 'player:respawn',
            timestamp,
            data: {
              playerId: 'p2',
              position: { x: 100, y: 100 },
              health: 100,
            },
          },
        },
        {
          schema: WeaponSpawnedMessageSchema,
          message: {
            type: 'weapon:spawned',
            timestamp,
            data: {
              crates: [
                {
                  id: 'crate-1',
                  position: { x: 50, y: 50 },
                  weaponType: 'Shotgun',
                  isAvailable: true,
                },
              ],
            },
          },
        },
        {
          schema: WeaponPickupConfirmedMessageSchema,
          message: {
            type: 'weapon:pickup_confirmed',
            timestamp,
            data: {
              playerId: 'p1',
              crateId: 'crate-1',
              weaponType: 'Shotgun',
              nextRespawnTime: 30000,
            },
          },
        },
        {
          schema: WeaponRespawnedMessageSchema,
          message: {
            type: 'weapon:respawned',
            timestamp,
            data: {
              crateId: 'crate-1',
              weaponType: 'Shotgun',
              position: { x: 50, y: 50 },
            },
          },
        },
        {
          schema: MeleeHitMessageSchema,
          message: {
            type: 'melee:hit',
            timestamp,
            data: {
              attackerId: 'p1',
              victims: ['p2'],
              knockbackApplied: true,
            },
          },
        },
        {
          schema: RollStartMessageSchema,
          message: {
            type: 'roll:start',
            timestamp,
            data: {
              playerId: 'p1',
              direction: { x: 1, y: 0 },
              rollStartTime: timestamp,
            },
          },
        },
        {
          schema: RollEndMessageSchema,
          message: {
            type: 'roll:end',
            timestamp,
            data: {
              playerId: 'p1',
              reason: 'completed',
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
