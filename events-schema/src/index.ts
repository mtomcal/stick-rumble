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
export {
  PositionSchema,
  VelocitySchema,
  MessageSchema,
  createTypedMessageSchema,
  createTypedMessageSchemaNoData,
  type Position,
  type Velocity,
  type Message,
} from './schemas/common.js';

// Export client-to-server schemas and types
export {
  InputStateDataSchema,
  InputStateMessageSchema,
  PlayerShootDataSchema,
  PlayerShootMessageSchema,
  PlayerReloadMessageSchema,
  WeaponPickupAttemptDataSchema,
  WeaponPickupAttemptMessageSchema,
  type InputStateData,
  type InputStateMessage,
  type PlayerShootData,
  type PlayerShootMessage,
  type PlayerReloadMessage,
  type WeaponPickupAttemptData,
  type WeaponPickupAttemptMessage,
} from './schemas/client-to-server.js';
