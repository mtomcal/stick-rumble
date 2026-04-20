/**
 * Client-to-server message schemas.
 * These define the messages sent from the TypeScript client to the Go server.
 */
import { Type } from '@sinclair/typebox';
import { createTypedMessageSchema, createTypedMessageSchemaNoData } from './common.js';
export const PlayerHelloPublicDataSchema = Type.Object({
    displayName: Type.Optional(Type.String({ description: 'Requested display name before server sanitization' })),
    mode: Type.Literal('public'),
}, { $id: 'PlayerHelloPublicData', description: 'Public matchmaking hello payload' });
export const PlayerHelloCodeDataSchema = Type.Object({
    displayName: Type.Optional(Type.String({ description: 'Requested display name before server sanitization' })),
    mode: Type.Literal('code'),
    code: Type.String({ description: 'Raw room code before server normalization', minLength: 1 }),
}, { $id: 'PlayerHelloCodeData', description: 'Named-room hello payload' });
export const PlayerHelloDataSchema = Type.Union([PlayerHelloPublicDataSchema, PlayerHelloCodeDataSchema], {
    $id: 'PlayerHelloData',
    description: 'Join intent payload',
});
export const PlayerHelloMessageSchema = Type.Object({
    type: Type.Literal('player:hello'),
    timestamp: Type.Number({ minimum: 0 }),
    data: PlayerHelloDataSchema,
}, { $id: 'PlayerHelloMessage', description: 'Join intent message' });
/**
 * Complete session:leave message schema (no data payload)
 */
export const SessionLeaveMessageSchema = createTypedMessageSchemaNoData('session:leave');
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
    sequence: Type.Number({ description: 'Monotonically increasing sequence number for client-side prediction', minimum: 0 }),
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
    clientTimestamp: Type.Number({ description: 'Client-side timestamp in milliseconds when shot was fired', minimum: 0 }),
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