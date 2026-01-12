/**
 * Common TypeBox schemas for shared types used across WebSocket events.
 * These schemas compile to valid JSON Schema and provide TypeScript type inference.
 */
import { Type, type Static } from '@sinclair/typebox';

/**
 * Position schema representing a 2D coordinate.
 * Used for player positions, projectile positions, spawn points, etc.
 */
export const PositionSchema = Type.Object(
  {
    x: Type.Number({ description: 'X coordinate' }),
    y: Type.Number({ description: 'Y coordinate' }),
  },
  { $id: 'Position', description: 'A 2D position coordinate' }
);

/**
 * TypeScript type inferred from PositionSchema
 */
export type Position = Static<typeof PositionSchema>;

/**
 * Velocity schema representing 2D velocity/direction.
 * Used for player movement, projectile direction, etc.
 */
export const VelocitySchema = Type.Object(
  {
    x: Type.Number({ description: 'X velocity component' }),
    y: Type.Number({ description: 'Y velocity component' }),
  },
  { $id: 'Velocity', description: 'A 2D velocity vector' }
);

/**
 * TypeScript type inferred from VelocitySchema
 */
export type Velocity = Static<typeof VelocitySchema>;

/**
 * Base message wrapper schema factory.
 * Creates a message schema with the standard type, timestamp, and optional data fields.
 *
 * @param messageType - The literal type string for this message
 * @param dataSchema - Optional schema for the data payload
 * @returns A TypeBox schema for the complete message
 */
export const MessageSchema = Type.Object(
  {
    type: Type.String({ description: 'Message type identifier' }),
    timestamp: Type.Integer({
      description: 'Unix timestamp in milliseconds',
      minimum: 0,
    }),
    data: Type.Optional(Type.Unknown({ description: 'Message payload data' })),
  },
  { $id: 'Message', description: 'Base WebSocket message wrapper' }
);

/**
 * TypeScript type inferred from MessageSchema
 */
export type Message = Static<typeof MessageSchema>;

/**
 * Factory function to create typed message schemas with specific data payloads.
 * This preserves type inference while ensuring all messages follow the standard format.
 *
 * @param messageType - The literal string type for this message
 * @param dataSchema - The TypeBox schema for the data payload
 * @returns A new TypeBox schema for the typed message
 */
export function createTypedMessageSchema<T extends ReturnType<typeof Type.Object>>(
  messageType: string,
  dataSchema: T
) {
  return Type.Object(
    {
      type: Type.Literal(messageType, { description: 'Message type identifier' }),
      timestamp: Type.Integer({
        description: 'Unix timestamp in milliseconds',
        minimum: 0,
      }),
      data: dataSchema,
    },
    { $id: `${messageType.replace(':', '_')}Message`, description: `${messageType} WebSocket message` }
  );
}

/**
 * Factory function to create typed message schemas without data payloads.
 *
 * @param messageType - The literal string type for this message
 * @returns A new TypeBox schema for the typed message without data
 */
export function createTypedMessageSchemaNoData(messageType: string) {
  return Type.Object(
    {
      type: Type.Literal(messageType, { description: 'Message type identifier' }),
      timestamp: Type.Integer({
        description: 'Unix timestamp in milliseconds',
        minimum: 0,
      }),
    },
    { $id: `${messageType.replace(':', '_')}Message`, description: `${messageType} WebSocket message` }
  );
}
