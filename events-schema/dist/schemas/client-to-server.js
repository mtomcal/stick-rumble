/**
 * Client-to-server message schemas.
 * These define the messages sent from the TypeScript client to the Go server.
 */
import { Type } from '@sinclair/typebox';
import { createTypedMessageSchema, createTypedMessageSchemaNoData } from './common.js';
/**
 * Input state data payload.
 * Represents keyboard input state for player movement and aim.
 */
export const InputStateDataSchema = Type.Object({
    up: Type.Boolean({ description: 'W key pressed' }),
    down: Type.Boolean({ description: 'S key pressed' }),
    left: Type.Boolean({ description: 'A key pressed' }),
    right: Type.Boolean({ description: 'D key pressed' }),
    aimAngle: Type.Number({ description: 'Aim angle in radians' }),
    isSprinting: Type.Boolean({ description: 'Shift key pressed for sprint' }),
}, { $id: 'InputStateData', description: 'Player input state payload' });
/**
 * Complete input:state message schema
 */
export const InputStateMessageSchema = createTypedMessageSchema('input:state', InputStateDataSchema);
/**
 * Player shoot data payload.
 * Sent when player attempts to shoot.
 */
export const PlayerShootDataSchema = Type.Object({
    aimAngle: Type.Number({ description: 'Aim angle in radians' }),
}, { $id: 'PlayerShootData', description: 'Player shoot action payload' });
/**
 * Complete player:shoot message schema
 */
export const PlayerShootMessageSchema = createTypedMessageSchema('player:shoot', PlayerShootDataSchema);
/**
 * Complete player:reload message schema (no data payload)
 */
export const PlayerReloadMessageSchema = createTypedMessageSchemaNoData('player:reload');
/**
 * Weapon pickup attempt data payload.
 * Sent when player attempts to pick up a weapon crate.
 */
export const WeaponPickupAttemptDataSchema = Type.Object({
    crateId: Type.String({ description: 'Unique identifier for the weapon crate', minLength: 1 }),
}, { $id: 'WeaponPickupAttemptData', description: 'Weapon pickup attempt payload' });
/**
 * Complete weapon:pickup_attempt message schema
 */
export const WeaponPickupAttemptMessageSchema = createTypedMessageSchema('weapon:pickup_attempt', WeaponPickupAttemptDataSchema);
/**
 * Player melee attack data payload.
 * Sent when player attempts a melee attack.
 */
export const PlayerMeleeAttackDataSchema = Type.Object({
    aimAngle: Type.Number({ description: 'Aim angle in radians for melee swing direction' }),
}, { $id: 'PlayerMeleeAttackData', description: 'Player melee attack action payload' });
/**
 * Complete player:melee_attack message schema
 */
export const PlayerMeleeAttackMessageSchema = createTypedMessageSchema('player:melee_attack', PlayerMeleeAttackDataSchema);
/**
 * Complete player:dodge_roll message schema (no data payload)
 * Client requests to initiate a dodge roll.
 */
export const PlayerDodgeRollMessageSchema = createTypedMessageSchemaNoData('player:dodge_roll');
//# sourceMappingURL=client-to-server.js.map