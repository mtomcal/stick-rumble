/**
 * Tests for server-to-client message schemas.
 */
import { describe, it, expect } from 'vitest';
import { Value } from '@sinclair/typebox/value';
import {
  SessionStatusDataSchema,
  SessionStatusMessageSchema,
  RoomJoinedDataSchema,
  RoomJoinedMessageSchema,
  PlayerLeftDataSchema,
  PlayerLeftMessageSchema,
  ErrorNoHelloDataSchema,
  ErrorNoHelloMessageSchema,
  ErrorBadRoomCodeDataSchema,
  ErrorBadRoomCodeMessageSchema,
  ErrorRoomFullDataSchema,
  ErrorRoomFullMessageSchema,
  PlayerStateSchema,
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
  WinnerSummarySchema,
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
  ProjectileSnapshotSchema,
  WeaponCrateSnapshotSchema,
  StateSnapshotDataSchema,
  StateSnapshotMessageSchema,
  StateDeltaDataSchema,
  StateDeltaMessageSchema,
} from './server-to-client.js';

describe('Server-to-Client Schemas', () => {
  const basePlayerState = {
    id: 'player-1',
    displayName: 'Alice',
    position: { x: 100, y: 200 },
    velocity: { x: 5, y: -3 },
    aimAngle: 1.57,
    health: 100,
    isInvulnerable: false,
    invulnerabilityEnd: '2026-04-10T16:00:00Z',
    kills: 0,
    deaths: 0,
    xp: 0,
    isRegenerating: false,
    isRolling: false,
  };

  describe('RoomJoinedDataSchema', () => {
    it('should validate valid room joined data', () => {
      const data = {
        roomId: 'room-123',
        playerId: 'player-123',
        mapId: 'default_office',
        displayName: 'Alice',
      };
      expect(Value.Check(RoomJoinedDataSchema, data)).toBe(true);
    });

    it('should reject data without roomId', () => {
      const data = { playerId: 'player-123', mapId: 'default_office' };
      expect(Value.Check(RoomJoinedDataSchema, data)).toBe(false);
    });

    it('should reject empty playerId', () => {
      const data = { roomId: 'room-123', playerId: '', mapId: 'default_office' };
      expect(Value.Check(RoomJoinedDataSchema, data)).toBe(false);
    });

    it('should reject empty mapId', () => {
      const data = { roomId: 'room-123', playerId: 'player-123', mapId: '' };
      expect(Value.Check(RoomJoinedDataSchema, data)).toBe(false);
    });

    it('should reject data without displayName', () => {
      const data = { roomId: 'room-123', playerId: 'player-123', mapId: 'default_office' };
      expect(Value.Check(RoomJoinedDataSchema, data)).toBe(false);
    });

    it('should validate normalized code when present', () => {
      const data = {
        roomId: 'room-123',
        playerId: 'player-123',
        mapId: 'default_office',
        displayName: 'Alice',
        code: 'PIZZA',
      };
      expect(Value.Check(RoomJoinedDataSchema, data)).toBe(true);
    });

    it('should reject empty code when present', () => {
      const data = {
        roomId: 'room-123',
        playerId: 'player-123',
        mapId: 'default_office',
        displayName: 'Alice',
        code: '',
      };
      expect(Value.Check(RoomJoinedDataSchema, data)).toBe(false);
    });
  });

  describe('SessionStatusDataSchema', () => {
    it('should validate a searching_for_match snapshot without mapId', () => {
      expect(Value.Check(SessionStatusDataSchema, {
        state: 'searching_for_match',
        playerId: 'player-123',
        displayName: 'Alice',
        joinMode: 'public',
        minPlayers: 2,
      })).toBe(true);
    });

    it('should validate a waiting_for_players snapshot for named rooms', () => {
      expect(Value.Check(SessionStatusDataSchema, {
        state: 'waiting_for_players',
        playerId: 'player-123',
        displayName: 'Alice',
        joinMode: 'code',
        roomId: 'room-123',
        code: 'PIZZA',
        rosterSize: 1,
        minPlayers: 2,
      })).toBe(true);
    });

    it('should validate a match_ready snapshot with mapId', () => {
      expect(Value.Check(SessionStatusDataSchema, {
        state: 'match_ready',
        playerId: 'player-123',
        displayName: 'Alice',
        joinMode: 'code',
        roomId: 'room-123',
        code: 'PIZZA',
        rosterSize: 2,
        minPlayers: 2,
        mapId: 'default_office',
      })).toBe(true);
    });

    it('should allow public sessions to omit code', () => {
      expect(Value.Check(SessionStatusDataSchema, {
        state: 'match_ready',
        playerId: 'player-123',
        displayName: 'Alice',
        joinMode: 'public',
        roomId: 'room-123',
        rosterSize: 2,
        minPlayers: 2,
        mapId: 'default_office',
      })).toBe(true);
    });
  });

  describe('SessionStatusMessageSchema', () => {
    it('should validate a complete session:status message', () => {
      expect(Value.Check(SessionStatusMessageSchema, {
        type: 'session:status',
        timestamp: Date.now(),
        data: {
          state: 'match_ready',
          playerId: 'player-123',
          displayName: 'Alice',
          joinMode: 'public',
          roomId: 'room-123',
          rosterSize: 2,
          minPlayers: 2,
          mapId: 'default_office',
        },
      })).toBe(true);
    });
  });

  describe('RoomJoinedMessageSchema', () => {
    it('should validate complete room:joined message', () => {
      const message = {
        type: 'room:joined',
        timestamp: Date.now(),
        data: {
          roomId: 'room-123',
          playerId: 'player-123',
          mapId: 'default_office',
          displayName: 'Alice',
        },
      };
      expect(Value.Check(RoomJoinedMessageSchema, message)).toBe(true);
    });

    it('should reject wrong message type', () => {
      const message = {
        type: 'wrong:type',
        timestamp: Date.now(),
        data: {
          roomId: 'room-123',
          playerId: 'player-123',
          mapId: 'default_office',
          displayName: 'Alice',
        },
      };
      expect(Value.Check(RoomJoinedMessageSchema, message)).toBe(false);
    });
  });

  describe('PlayerMoveDataSchema', () => {
    it('should validate valid player move data with multiple players', () => {
      const data = {
        players: [
          basePlayerState,
          {
            id: 'player-2',
            displayName: 'Bob',
            position: { x: 300, y: 400 },
            velocity: { x: 0, y: 0 },
            aimAngle: 0,
            health: 75,
            isInvulnerable: false,
            invulnerabilityEnd: '2026-04-10T16:00:00Z',
            kills: 2,
            deaths: 1,
            xp: 200,
            isRegenerating: false,
            isRolling: false,
          },
        ],
      };
      expect(Value.Check(PlayerMoveDataSchema, data)).toBe(true);
    });

    it('should validate player move data with lastProcessedSequence', () => {
      const data = {
        players: [basePlayerState],
        lastProcessedSequence: {
          'player-1': 42,
          'player-2': 17,
        },
      };
      expect(Value.Check(PlayerMoveDataSchema, data)).toBe(true);
    });

    it('should reject negative sequence numbers in lastProcessedSequence', () => {
      const data = {
        players: [basePlayerState],
        lastProcessedSequence: {
          'player-1': -1,
        },
      };
      expect(Value.Check(PlayerMoveDataSchema, data)).toBe(false);
    });

    it('should validate player move data with correctedPlayers array', () => {
      const data = {
        players: [basePlayerState],
        correctedPlayers: ['player-1'],
      };
      expect(Value.Check(PlayerMoveDataSchema, data)).toBe(true);
    });

    it('should validate player move data with empty correctedPlayers array', () => {
      const data = {
        players: [basePlayerState],
        correctedPlayers: [],
      };
      expect(Value.Check(PlayerMoveDataSchema, data)).toBe(true);
    });

    it('should reject correctedPlayers with empty string', () => {
      const data = {
        players: [basePlayerState],
        correctedPlayers: [''],
      };
      expect(Value.Check(PlayerMoveDataSchema, data)).toBe(false);
    });

    it('should accept lastProcessedSequence with sequence 0', () => {
      const data = {
        players: [basePlayerState],
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
            ...basePlayerState,
            health: -10,
          },
        ],
      };
      expect(Value.Check(PlayerMoveDataSchema, data)).toBe(false);
    });

    it('should accept empty players array', () => {
      const data = { players: [] };
      expect(Value.Check(PlayerMoveDataSchema, data)).toBe(true);
    });

    it('should reject player state without displayName', () => {
      const invalidPlayerState = { ...basePlayerState } as Partial<typeof basePlayerState>;
      delete invalidPlayerState.displayName;

      expect(Value.Check(PlayerStateSchema, invalidPlayerState)).toBe(false);
    });
  });

  describe('Handshake Support Schemas', () => {
    it('should validate player:left payloads', () => {
      expect(Value.Check(PlayerLeftDataSchema, { playerId: 'player-123' })).toBe(true);
      expect(Value.Check(PlayerLeftMessageSchema, {
        type: 'player:left',
        timestamp: Date.now(),
        data: { playerId: 'player-123' },
      })).toBe(true);
    });

    it('should validate error:no_hello payloads', () => {
      expect(Value.Check(ErrorNoHelloDataSchema, { offendingType: 'input:state' })).toBe(true);
      expect(Value.Check(ErrorNoHelloMessageSchema, {
        type: 'error:no_hello',
        timestamp: Date.now(),
        data: { offendingType: 'input:state' },
      })).toBe(true);
    });

    it('should validate error:bad_room_code payloads', () => {
      expect(Value.Check(ErrorBadRoomCodeDataSchema, { reason: 'too_short' })).toBe(true);
      expect(Value.Check(ErrorBadRoomCodeMessageSchema, {
        type: 'error:bad_room_code',
        timestamp: Date.now(),
        data: { reason: 'too_short' },
      })).toBe(true);
    });

    it('should validate error:room_full payloads', () => {
      expect(Value.Check(ErrorRoomFullDataSchema, { code: 'PIZZA' })).toBe(true);
      expect(Value.Check(ErrorRoomFullMessageSchema, {
        type: 'error:room_full',
        timestamp: Date.now(),
        data: { code: 'PIZZA' },
      })).toBe(true);
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
        displayName: 'Alice',
        kills: 10,
        deaths: 2,
        xp: 500,
      };
      expect(Value.Check(PlayerScoreSchema, data)).toBe(true);
    });

    it('should accept zero kills and deaths', () => {
      const data = {
        playerId: 'player-1',
        displayName: 'Alice',
        kills: 0,
        deaths: 0,
        xp: 50,
      };
      expect(Value.Check(PlayerScoreSchema, data)).toBe(true);
    });

    it('should reject missing playerId', () => {
      const data = {
        displayName: 'Alice',
        kills: 5,
        deaths: 2,
        xp: 100,
      };
      expect(Value.Check(PlayerScoreSchema, data)).toBe(false);
    });

    it('should reject negative kills', () => {
      const data = {
        playerId: 'player-1',
        displayName: 'Alice',
        kills: -1,
        deaths: 0,
        xp: 100,
      };
      expect(Value.Check(PlayerScoreSchema, data)).toBe(false);
    });

    it('should reject negative deaths', () => {
      const data = {
        playerId: 'player-1',
        displayName: 'Alice',
        kills: 5,
        deaths: -1,
        xp: 100,
      };
      expect(Value.Check(PlayerScoreSchema, data)).toBe(false);
    });

    it('should reject negative xp', () => {
      const data = {
        playerId: 'player-1',
        displayName: 'Alice',
        kills: 5,
        deaths: 2,
        xp: -50,
      };
      expect(Value.Check(PlayerScoreSchema, data)).toBe(false);
    });

    it('should reject non-integer kills', () => {
      const data = {
        playerId: 'player-1',
        displayName: 'Alice',
        kills: 5.5,
        deaths: 2,
        xp: 100,
      };
      expect(Value.Check(PlayerScoreSchema, data)).toBe(false);
    });

    it('should reject empty playerId', () => {
      const data = {
        playerId: '',
        displayName: 'Alice',
        kills: 5,
        deaths: 2,
        xp: 100,
      };
      expect(Value.Check(PlayerScoreSchema, data)).toBe(false);
    });

    it('should reject missing displayName', () => {
      const data = {
        playerId: 'player-1',
        kills: 5,
        deaths: 2,
        xp: 100,
      };
      expect(Value.Check(PlayerScoreSchema, data)).toBe(false);
    });
  });

  describe('WinnerSummarySchema', () => {
    it('should require display-ready winner names', () => {
      expect(Value.Check(WinnerSummarySchema, {
        playerId: 'player-1',
        displayName: 'Alice',
      })).toBe(true);
      expect(Value.Check(WinnerSummarySchema, {
        playerId: 'player-1',
      })).toBe(false);
    });
  });

  describe('MatchEndedDataSchema', () => {
    it('should validate valid match ended data with winners', () => {
      const data = {
        winners: [
          { playerId: 'player-1', displayName: 'Alice' },
          { playerId: 'player-2', displayName: 'Bob' },
        ],
        finalScores: [
          { playerId: 'player-1', displayName: 'Alice', kills: 10, deaths: 2, xp: 100 },
          { playerId: 'player-2', displayName: 'Bob', kills: 8, deaths: 3, xp: 90 },
          { playerId: 'player-3', displayName: 'Carol', kills: 5, deaths: 5, xp: 50 },
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
        winners: [{ playerId: 'player-1', displayName: 'Alice' }],
        finalScores: [{ playerId: 'player-1', displayName: 'Alice', kills: 5, deaths: 0, xp: 100 }],
        reason: '',
      };
      expect(Value.Check(MatchEndedDataSchema, data)).toBe(false);
    });

    it('should reject negative kills', () => {
      const data = {
        winners: [{ playerId: 'player-1', displayName: 'Alice' }],
        finalScores: [{ playerId: 'player-1', displayName: 'Alice', kills: -1, deaths: 0, xp: 100 }],
        reason: 'elimination',
      };
      expect(Value.Check(MatchEndedDataSchema, data)).toBe(false);
    });

    it('should reject missing playerId in score', () => {
      const data = {
        winners: [{ playerId: 'player-1', displayName: 'Alice' }],
        finalScores: [{ displayName: 'Alice', kills: 5, deaths: 0, xp: 100 }],
        reason: 'elimination',
      };
      expect(Value.Check(MatchEndedDataSchema, data)).toBe(false);
    });

    it('should reject non-integer kills', () => {
      const data = {
        winners: [{ playerId: 'player-1', displayName: 'Alice' }],
        finalScores: [{ playerId: 'player-1', displayName: 'Alice', kills: 5.5, deaths: 0, xp: 100 }],
        reason: 'elimination',
      };
      expect(Value.Check(MatchEndedDataSchema, data)).toBe(false);
    });

    it('should reject final score rows without displayName', () => {
      const data = {
        winners: [{ playerId: 'player-1', displayName: 'Alice' }],
        finalScores: [{ playerId: 'player-1', kills: 5, deaths: 0, xp: 100 }],
        reason: 'kill_target',
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
            data: {
              roomId: 'room-1',
              playerId: 'p1',
              mapId: 'default_office',
              displayName: 'Alice',
            },
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
          schema: SessionStatusMessageSchema,
          message: {
            type: 'session:status',
            timestamp,
            data: {
              state: 'match_ready',
              roomId: 'room-1',
              playerId: 'p1',
              displayName: 'Alice',
              joinMode: 'public',
              rosterSize: 2,
              minPlayers: 2,
              mapId: 'default_office',
            },
          },
        },
        {
          schema: MatchEndedMessageSchema,
          message: {
            type: 'match:ended',
            timestamp,
            data: {
              winners: [{ playerId: 'p1', displayName: 'Alice' }],
              finalScores: [{ playerId: 'p1', displayName: 'Alice', kills: 5, deaths: 0, xp: 100 }],
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

  describe('StateSnapshotDataSchema', () => {
    it('should validate valid full state snapshot', () => {
      const data = {
        players: [
          {
            ...basePlayerState,
            id: 'player1',
            velocity: { x: 10, y: 5 },
            health: 80,
          },
        ],
        projectiles: [
          {
            id: 'proj1',
            ownerId: 'player1',
            position: { x: 150, y: 250 },
            velocity: { x: 50, y: 0 },
          },
        ],
        weaponCrates: [
          {
            id: 'crate1',
            position: { x: 300, y: 300 },
            weaponType: 'rifle',
            isAvailable: true,
          },
        ],
      };

      expect(Value.Check(StateSnapshotDataSchema, data)).toBe(true);
    });

    it('should validate empty snapshot', () => {
      const data = {
        players: [],
        projectiles: [],
        weaponCrates: [],
      };

      expect(Value.Check(StateSnapshotDataSchema, data)).toBe(true);
    });
  });

  describe('StateSnapshotMessageSchema', () => {
    it('should validate complete state:snapshot message', () => {
      const message = {
        type: 'state:snapshot',
        timestamp: 1234567890,
        data: {
          players: [
            {
              ...basePlayerState,
              id: 'player1',
              velocity: { x: 10, y: 5 },
              health: 80,
            },
          ],
          projectiles: [],
          weaponCrates: [],
        },
      };

      expect(Value.Check(StateSnapshotMessageSchema, message)).toBe(true);
    });
  });

  describe('StateDeltaDataSchema', () => {
    it('should validate delta with only player changes', () => {
      const data = {
        players: [
          {
            ...basePlayerState,
            id: 'player1',
            position: { x: 105, y: 205 },
            velocity: { x: 10, y: 5 },
            health: 80,
            aimAngle: 1.6,
          },
        ],
      };

      expect(Value.Check(StateDeltaDataSchema, data)).toBe(true);
    });

    it('should validate delta with projectile changes', () => {
      const data = {
        projectilesAdded: [
          {
            id: 'proj2',
            ownerId: 'player1',
            position: { x: 200, y: 300 },
            velocity: { x: 60, y: 10 },
          },
        ],
        projectilesRemoved: ['proj1'],
      };

      expect(Value.Check(StateDeltaDataSchema, data)).toBe(true);
    });

    it('should validate empty delta', () => {
      const data = {};

      expect(Value.Check(StateDeltaDataSchema, data)).toBe(true);
    });
  });

  describe('StateDeltaMessageSchema', () => {
    it('should validate complete state:delta message', () => {
      const message = {
        type: 'state:delta',
        timestamp: 1234567890,
        data: {
          players: [
            {
              ...basePlayerState,
              id: 'player1',
              position: { x: 105, y: 205 },
              velocity: { x: 10, y: 5 },
              health: 80,
              aimAngle: 1.6,
            },
          ],
          projectilesAdded: [],
          projectilesRemoved: [],
        },
      };

      expect(Value.Check(StateDeltaMessageSchema, message)).toBe(true);
    });
  });
});
