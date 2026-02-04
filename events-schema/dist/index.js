/**
 * Events Schema Package
 *
 * Provides TypeBox schema definitions for WebSocket events used in Stick Rumble.
 * These schemas serve as the single source of truth for message validation across
 * the TypeScript client and Go server.
 *
 * Usage:
 * ```typescript
 * import { PositionSchema, VelocitySchema, MessageSchema } from '@stick-rumble/events-schema';
 * import type { Position, Velocity, Message } from '@stick-rumble/events-schema';
 * ```
 */
// Export common schemas and types
export { PositionSchema, VelocitySchema, MessageSchema, createTypedMessageSchema, createTypedMessageSchemaNoData, } from './schemas/common.js';
// Export client-to-server schemas and types
export { InputStateDataSchema, InputStateMessageSchema, PlayerShootDataSchema, PlayerShootMessageSchema, PlayerReloadMessageSchema, WeaponPickupAttemptDataSchema, WeaponPickupAttemptMessageSchema, PlayerMeleeAttackDataSchema, PlayerMeleeAttackMessageSchema, PlayerDodgeRollMessageSchema, } from './schemas/client-to-server.js';
// Export server-to-client schemas and types
export { RoomJoinedDataSchema, RoomJoinedMessageSchema, PlayerLeftDataSchema, PlayerLeftMessageSchema, PlayerStateSchema, PlayerMoveDataSchema, PlayerMoveMessageSchema, ProjectileSpawnDataSchema, ProjectileSpawnMessageSchema, ProjectileDestroyDataSchema, ProjectileDestroyMessageSchema, WeaponStateDataSchema, WeaponStateMessageSchema, ShootFailedDataSchema, ShootFailedMessageSchema, PlayerDamagedDataSchema, PlayerDamagedMessageSchema, HitConfirmedDataSchema, HitConfirmedMessageSchema, PlayerDeathDataSchema, PlayerDeathMessageSchema, PlayerKillCreditDataSchema, PlayerKillCreditMessageSchema, PlayerRespawnDataSchema, PlayerRespawnMessageSchema, MatchTimerDataSchema, MatchTimerMessageSchema, PlayerScoreSchema, MatchEndedDataSchema, MatchEndedMessageSchema, WeaponCrateSchema, WeaponSpawnedDataSchema, WeaponSpawnedMessageSchema, WeaponPickupConfirmedDataSchema, WeaponPickupConfirmedMessageSchema, WeaponRespawnedDataSchema, WeaponRespawnedMessageSchema, MeleeHitDataSchema, MeleeHitMessageSchema, RollStartDataSchema, RollStartMessageSchema, RollEndDataSchema, RollEndMessageSchema, } from './schemas/server-to-client.js';
//# sourceMappingURL=index.js.map