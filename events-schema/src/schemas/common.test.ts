import { describe, it, expect } from 'vitest';
import Ajv from 'ajv';
import {
  PositionSchema,
  VelocitySchema,
  MessageSchema,
  createTypedMessageSchema,
  createTypedMessageSchemaNoData,
  type Position,
  type Velocity,
  type Message,
} from './common.js';
import { Type } from '@sinclair/typebox';

describe('Common Schemas', () => {
  const ajv = new Ajv({ strict: true });

  describe('PositionSchema', () => {
    const validatePosition = ajv.compile(PositionSchema);

    it('should have correct $id', () => {
      expect(PositionSchema.$id).toBe('Position');
    });

    it('should validate valid position objects', () => {
      const validPosition: Position = { x: 100, y: 200 };
      expect(validatePosition(validPosition)).toBe(true);
    });

    it('should validate positions with decimal values', () => {
      const validPosition: Position = { x: 100.5, y: 200.25 };
      expect(validatePosition(validPosition)).toBe(true);
    });

    it('should validate positions with negative values', () => {
      const validPosition: Position = { x: -100, y: -200 };
      expect(validatePosition(validPosition)).toBe(true);
    });

    it('should validate positions with zero values', () => {
      const validPosition: Position = { x: 0, y: 0 };
      expect(validatePosition(validPosition)).toBe(true);
    });

    it('should reject objects missing x property', () => {
      expect(validatePosition({ y: 200 })).toBe(false);
    });

    it('should reject objects missing y property', () => {
      expect(validatePosition({ x: 100 })).toBe(false);
    });

    it('should reject objects with non-numeric x', () => {
      expect(validatePosition({ x: 'hello', y: 200 })).toBe(false);
    });

    it('should reject objects with non-numeric y', () => {
      expect(validatePosition({ x: 100, y: 'world' })).toBe(false);
    });

    it('should reject null values', () => {
      expect(validatePosition(null)).toBe(false);
    });

    it('should reject undefined values', () => {
      expect(validatePosition(undefined)).toBe(false);
    });

    it('should produce valid JSON Schema structure', () => {
      expect(PositionSchema.type).toBe('object');
      expect(PositionSchema.properties).toBeDefined();
      expect(PositionSchema.properties.x.type).toBe('number');
      expect(PositionSchema.properties.y.type).toBe('number');
      expect(PositionSchema.required).toContain('x');
      expect(PositionSchema.required).toContain('y');
    });
  });

  describe('VelocitySchema', () => {
    const validateVelocity = ajv.compile(VelocitySchema);

    it('should have correct $id', () => {
      expect(VelocitySchema.$id).toBe('Velocity');
    });

    it('should validate valid velocity objects', () => {
      const validVelocity: Velocity = { x: 5, y: -3 };
      expect(validateVelocity(validVelocity)).toBe(true);
    });

    it('should validate velocities with decimal values', () => {
      const validVelocity: Velocity = { x: 2.5, y: -1.75 };
      expect(validateVelocity(validVelocity)).toBe(true);
    });

    it('should validate velocities with zero values', () => {
      const validVelocity: Velocity = { x: 0, y: 0 };
      expect(validateVelocity(validVelocity)).toBe(true);
    });

    it('should reject objects missing x property', () => {
      expect(validateVelocity({ y: 5 })).toBe(false);
    });

    it('should reject objects missing y property', () => {
      expect(validateVelocity({ x: 5 })).toBe(false);
    });

    it('should reject objects with non-numeric values', () => {
      expect(validateVelocity({ x: 'fast', y: 5 })).toBe(false);
    });

    it('should produce valid JSON Schema structure', () => {
      expect(VelocitySchema.type).toBe('object');
      expect(VelocitySchema.properties).toBeDefined();
      expect(VelocitySchema.properties.x.type).toBe('number');
      expect(VelocitySchema.properties.y.type).toBe('number');
      expect(VelocitySchema.required).toContain('x');
      expect(VelocitySchema.required).toContain('y');
    });
  });

  describe('MessageSchema', () => {
    const validateMessage = ajv.compile(MessageSchema);

    it('should have correct $id', () => {
      expect(MessageSchema.$id).toBe('Message');
    });

    it('should validate valid message with data', () => {
      const validMessage: Message = {
        type: 'test',
        timestamp: 1234567890,
        data: { foo: 'bar' },
      };
      expect(validateMessage(validMessage)).toBe(true);
    });

    it('should validate valid message without data', () => {
      const validMessage = {
        type: 'player:reload',
        timestamp: 1234567890,
      };
      expect(validateMessage(validMessage)).toBe(true);
    });

    it('should validate message with any data type', () => {
      // String data
      expect(validateMessage({ type: 'test', timestamp: 123, data: 'string' })).toBe(true);
      // Number data
      expect(validateMessage({ type: 'test', timestamp: 123, data: 42 })).toBe(true);
      // Array data
      expect(validateMessage({ type: 'test', timestamp: 123, data: [1, 2, 3] })).toBe(true);
      // Null data
      expect(validateMessage({ type: 'test', timestamp: 123, data: null })).toBe(true);
    });

    it('should reject message missing type', () => {
      expect(validateMessage({ timestamp: 123 })).toBe(false);
    });

    it('should reject message missing timestamp', () => {
      expect(validateMessage({ type: 'test' })).toBe(false);
    });

    it('should reject message with non-string type', () => {
      expect(validateMessage({ type: 123, timestamp: 123 })).toBe(false);
    });

    it('should reject message with non-integer timestamp', () => {
      expect(validateMessage({ type: 'test', timestamp: 'now' })).toBe(false);
    });

    it('should reject message with negative timestamp', () => {
      expect(validateMessage({ type: 'test', timestamp: -1 })).toBe(false);
    });

    it('should reject message with decimal timestamp', () => {
      expect(validateMessage({ type: 'test', timestamp: 123.456 })).toBe(false);
    });

    it('should produce valid JSON Schema structure', () => {
      expect(MessageSchema.type).toBe('object');
      expect(MessageSchema.properties.type.type).toBe('string');
      expect(MessageSchema.properties.timestamp.type).toBe('integer');
      expect(MessageSchema.required).toContain('type');
      expect(MessageSchema.required).toContain('timestamp');
    });
  });

  describe('createTypedMessageSchema', () => {
    const TestDataSchema = Type.Object({
      value: Type.String(),
    });

    const TestMessageSchema = createTypedMessageSchema('test:event', TestDataSchema);
    const validateTestMessage = ajv.compile(TestMessageSchema);

    it('should create schema with correct $id', () => {
      expect(TestMessageSchema.$id).toBe('test_eventMessage');
    });

    it('should validate valid typed message', () => {
      const validMessage = {
        type: 'test:event',
        timestamp: 1234567890,
        data: { value: 'hello' },
      };
      expect(validateTestMessage(validMessage)).toBe(true);
    });

    it('should reject message with wrong type', () => {
      const invalidMessage = {
        type: 'wrong:type',
        timestamp: 1234567890,
        data: { value: 'hello' },
      };
      expect(validateTestMessage(invalidMessage)).toBe(false);
    });

    it('should reject message with invalid data structure', () => {
      const invalidMessage = {
        type: 'test:event',
        timestamp: 1234567890,
        data: { wrongField: 'hello' },
      };
      expect(validateTestMessage(invalidMessage)).toBe(false);
    });

    it('should reject message missing data', () => {
      const invalidMessage = {
        type: 'test:event',
        timestamp: 1234567890,
      };
      expect(validateTestMessage(invalidMessage)).toBe(false);
    });

    it('should require data field to match schema', () => {
      const invalidMessage = {
        type: 'test:event',
        timestamp: 1234567890,
        data: { value: 123 }, // should be string
      };
      expect(validateTestMessage(invalidMessage)).toBe(false);
    });
  });

  describe('createTypedMessageSchemaNoData', () => {
    const NoDataMessageSchema = createTypedMessageSchemaNoData('player:reload');
    const validateNoDataMessage = ajv.compile(NoDataMessageSchema);

    it('should create schema with correct $id', () => {
      expect(NoDataMessageSchema.$id).toBe('player_reloadMessage');
    });

    it('should validate valid message without data', () => {
      const validMessage = {
        type: 'player:reload',
        timestamp: 1234567890,
      };
      expect(validateNoDataMessage(validMessage)).toBe(true);
    });

    it('should reject message with wrong type', () => {
      const invalidMessage = {
        type: 'wrong:type',
        timestamp: 1234567890,
      };
      expect(validateNoDataMessage(invalidMessage)).toBe(false);
    });

    it('should allow extra properties (including data)', () => {
      // By default TypeBox doesn't disallow additional properties
      const messageWithData = {
        type: 'player:reload',
        timestamp: 1234567890,
        data: { extra: 'stuff' },
      };
      expect(validateNoDataMessage(messageWithData)).toBe(true);
    });
  });

  describe('Schema JSON output', () => {
    it('PositionSchema should be serializable to JSON', () => {
      const json = JSON.stringify(PositionSchema);
      const parsed = JSON.parse(json);
      expect(parsed.$id).toBe('Position');
      expect(parsed.type).toBe('object');
    });

    it('VelocitySchema should be serializable to JSON', () => {
      const json = JSON.stringify(VelocitySchema);
      const parsed = JSON.parse(json);
      expect(parsed.$id).toBe('Velocity');
      expect(parsed.type).toBe('object');
    });

    it('MessageSchema should be serializable to JSON', () => {
      const json = JSON.stringify(MessageSchema);
      const parsed = JSON.parse(json);
      expect(parsed.$id).toBe('Message');
      expect(parsed.type).toBe('object');
    });
  });
});
