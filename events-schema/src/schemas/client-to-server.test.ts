/**
 * Tests for client-to-server message schemas
 */
import { describe, it, expect } from 'vitest';
import Ajv from 'ajv';
import {
  InputStateDataSchema,
  InputStateMessageSchema,
  PlayerShootDataSchema,
  PlayerShootMessageSchema,
  PlayerReloadMessageSchema,
  WeaponPickupAttemptDataSchema,
  WeaponPickupAttemptMessageSchema,
  PlayerMeleeAttackDataSchema,
  PlayerMeleeAttackMessageSchema,
  type InputStateData,
  type InputStateMessage,
  type PlayerShootData,
  type PlayerShootMessage,
  type PlayerReloadMessage,
  type WeaponPickupAttemptData,
  type WeaponPickupAttemptMessage,
  type PlayerMeleeAttackData,
  type PlayerMeleeAttackMessage,
} from './client-to-server.js';

const ajv = new Ajv();

describe('Client-to-Server Schemas', () => {
  describe('InputStateDataSchema', () => {
    const validate = ajv.compile(InputStateDataSchema);

    it('should validate valid input state data', () => {
      const validData: InputStateData = {
        up: true,
        down: false,
        left: false,
        right: true,
        aimAngle: 1.57,
        isSprinting: false,
      };

      expect(validate(validData)).toBe(true);
      expect(validate.errors).toBeNull();
    });

    it('should reject data with missing required fields', () => {
      const invalidData = {
        up: true,
        down: false,
        // missing left, right, aimAngle
      };

      expect(validate(invalidData)).toBe(false);
      expect(validate.errors).toBeDefined();
    });

    it('should reject data with wrong types', () => {
      const invalidData = {
        up: 'true', // should be boolean
        down: false,
        left: false,
        right: true,
        aimAngle: 1.57,
      };

      expect(validate(invalidData)).toBe(false);
      expect(validate.errors).toBeDefined();
    });

    it('should reject aimAngle with non-numeric value', () => {
      const invalidData = {
        up: true,
        down: false,
        left: false,
        right: true,
        aimAngle: 'not-a-number',
      };

      expect(validate(invalidData)).toBe(false);
      expect(validate.errors).toBeDefined();
    });

    it('should accept all boolean combinations', () => {
      const testCases = [
        { up: false, down: false, left: false, right: false, aimAngle: 0, isSprinting: false },
        { up: true, down: true, left: true, right: true, aimAngle: 3.14, isSprinting: true },
        { up: true, down: false, left: true, right: false, aimAngle: -1.57, isSprinting: false },
      ];

      testCases.forEach((testCase) => {
        expect(validate(testCase)).toBe(true);
      });
    });
  });

  describe('InputStateMessageSchema', () => {
    const validate = ajv.compile(InputStateMessageSchema);

    it('should validate complete input:state message', () => {
      const validMessage: InputStateMessage = {
        type: 'input:state',
        timestamp: Date.now(),
        data: {
          up: true,
          down: false,
          left: false,
          right: true,
          aimAngle: 1.57,
          isSprinting: true,
        },
      };

      expect(validate(validMessage)).toBe(true);
      expect(validate.errors).toBeNull();
    });

    it('should reject message with wrong type', () => {
      const invalidMessage = {
        type: 'wrong:type',
        timestamp: Date.now(),
        data: {
          up: true,
          down: false,
          left: false,
          right: true,
          aimAngle: 1.57,
          isSprinting: false,
        },
      };

      expect(validate(invalidMessage)).toBe(false);
      expect(validate.errors).toBeDefined();
    });

    it('should reject message with missing timestamp', () => {
      const invalidMessage = {
        type: 'input:state',
        data: {
          up: true,
          down: false,
          left: false,
          right: true,
          aimAngle: 1.57,
          isSprinting: false,
        },
      };

      expect(validate(invalidMessage)).toBe(false);
      expect(validate.errors).toBeDefined();
    });

    it('should reject message with negative timestamp', () => {
      const invalidMessage = {
        type: 'input:state',
        timestamp: -1,
        data: {
          up: true,
          down: false,
          left: false,
          right: true,
          aimAngle: 1.57,
          isSprinting: false,
        },
      };

      expect(validate(invalidMessage)).toBe(false);
      expect(validate.errors).toBeDefined();
    });
  });

  describe('PlayerShootDataSchema', () => {
    const validate = ajv.compile(PlayerShootDataSchema);

    it('should validate valid shoot data', () => {
      const validData: PlayerShootData = {
        aimAngle: 1.57,
      };

      expect(validate(validData)).toBe(true);
      expect(validate.errors).toBeNull();
    });

    it('should reject data with missing aimAngle', () => {
      const invalidData = {};

      expect(validate(invalidData)).toBe(false);
      expect(validate.errors).toBeDefined();
    });

    it('should reject data with non-numeric aimAngle', () => {
      const invalidData = {
        aimAngle: 'not-a-number',
      };

      expect(validate(invalidData)).toBe(false);
      expect(validate.errors).toBeDefined();
    });

    it('should accept various numeric aimAngle values', () => {
      const testCases = [0, 1.57, 3.14, -1.57, 6.28];

      testCases.forEach((aimAngle) => {
        expect(validate({ aimAngle })).toBe(true);
      });
    });
  });

  describe('PlayerShootMessageSchema', () => {
    const validate = ajv.compile(PlayerShootMessageSchema);

    it('should validate complete player:shoot message', () => {
      const validMessage: PlayerShootMessage = {
        type: 'player:shoot',
        timestamp: Date.now(),
        data: {
          aimAngle: 1.57,
        },
      };

      expect(validate(validMessage)).toBe(true);
      expect(validate.errors).toBeNull();
    });

    it('should reject message with wrong type', () => {
      const invalidMessage = {
        type: 'player:reload',
        timestamp: Date.now(),
        data: {
          aimAngle: 1.57,
        },
      };

      expect(validate(invalidMessage)).toBe(false);
      expect(validate.errors).toBeDefined();
    });
  });

  describe('PlayerReloadMessageSchema', () => {
    const validate = ajv.compile(PlayerReloadMessageSchema);

    it('should validate player:reload message without data', () => {
      const validMessage: PlayerReloadMessage = {
        type: 'player:reload',
        timestamp: Date.now(),
      };

      expect(validate(validMessage)).toBe(true);
      expect(validate.errors).toBeNull();
    });

    it('should reject message with wrong type', () => {
      const invalidMessage = {
        type: 'player:shoot',
        timestamp: Date.now(),
      };

      expect(validate(invalidMessage)).toBe(false);
      expect(validate.errors).toBeDefined();
    });

    it('should reject message with missing timestamp', () => {
      const invalidMessage = {
        type: 'player:reload',
      };

      expect(validate(invalidMessage)).toBe(false);
      expect(validate.errors).toBeDefined();
    });
  });

  describe('WeaponPickupAttemptDataSchema', () => {
    const validate = ajv.compile(WeaponPickupAttemptDataSchema);

    it('should validate valid weapon pickup attempt data', () => {
      const validData: WeaponPickupAttemptData = {
        crateId: 'crate-123',
      };

      expect(validate(validData)).toBe(true);
      expect(validate.errors).toBeNull();
    });

    it('should reject data with missing crateId', () => {
      const invalidData = {};

      expect(validate(invalidData)).toBe(false);
      expect(validate.errors).toBeDefined();
    });

    it('should reject data with non-string crateId', () => {
      const invalidData = {
        crateId: 123,
      };

      expect(validate(invalidData)).toBe(false);
      expect(validate.errors).toBeDefined();
    });

    it('should reject data with empty string crateId', () => {
      const invalidData = {
        crateId: '',
      };

      expect(validate(invalidData)).toBe(false);
      expect(validate.errors).toBeDefined();
    });

    it('should accept various valid crateId formats', () => {
      const testCases = ['crate-123', 'CRATE_456', 'abc', 'a1b2c3'];

      testCases.forEach((crateId) => {
        expect(validate({ crateId })).toBe(true);
      });
    });
  });

  describe('WeaponPickupAttemptMessageSchema', () => {
    const validate = ajv.compile(WeaponPickupAttemptMessageSchema);

    it('should validate complete weapon:pickup_attempt message', () => {
      const validMessage: WeaponPickupAttemptMessage = {
        type: 'weapon:pickup_attempt',
        timestamp: Date.now(),
        data: {
          crateId: 'crate-123',
        },
      };

      expect(validate(validMessage)).toBe(true);
      expect(validate.errors).toBeNull();
    });

    it('should reject message with wrong type', () => {
      const invalidMessage = {
        type: 'weapon:pickup',
        timestamp: Date.now(),
        data: {
          crateId: 'crate-123',
        },
      };

      expect(validate(invalidMessage)).toBe(false);
      expect(validate.errors).toBeDefined();
    });
  });

  describe('PlayerMeleeAttackDataSchema', () => {
    const validate = ajv.compile(PlayerMeleeAttackDataSchema);

    it('should validate valid melee attack data', () => {
      const validData: PlayerMeleeAttackData = {
        aimAngle: 1.57,
      };

      expect(validate(validData)).toBe(true);
      expect(validate.errors).toBeNull();
    });

    it('should reject data with missing aimAngle', () => {
      const invalidData = {};

      expect(validate(invalidData)).toBe(false);
      expect(validate.errors).toBeDefined();
    });

    it('should reject data with non-numeric aimAngle', () => {
      const invalidData = {
        aimAngle: 'not-a-number',
      };

      expect(validate(invalidData)).toBe(false);
      expect(validate.errors).toBeDefined();
    });

    it('should accept various numeric aimAngle values', () => {
      const testCases = [0, 1.57, 3.14, -1.57, 6.28];

      testCases.forEach((aimAngle) => {
        expect(validate({ aimAngle })).toBe(true);
      });
    });
  });

  describe('PlayerMeleeAttackMessageSchema', () => {
    const validate = ajv.compile(PlayerMeleeAttackMessageSchema);

    it('should validate complete player:melee_attack message', () => {
      const validMessage: PlayerMeleeAttackMessage = {
        type: 'player:melee_attack',
        timestamp: Date.now(),
        data: {
          aimAngle: 1.57,
        },
      };

      expect(validate(validMessage)).toBe(true);
      expect(validate.errors).toBeNull();
    });

    it('should reject message with wrong type', () => {
      const invalidMessage = {
        type: 'player:shoot',
        timestamp: Date.now(),
        data: {
          aimAngle: 1.57,
        },
      };

      expect(validate(invalidMessage)).toBe(false);
      expect(validate.errors).toBeDefined();
    });

    it('should reject message with missing timestamp', () => {
      const invalidMessage = {
        type: 'player:melee_attack',
        data: {
          aimAngle: 1.57,
        },
      };

      expect(validate(invalidMessage)).toBe(false);
      expect(validate.errors).toBeDefined();
    });
  });

  describe('Schema IDs', () => {
    it('should have correct $id for all schemas', () => {
      expect(InputStateDataSchema.$id).toBe('InputStateData');
      expect(InputStateMessageSchema.$id).toBe('input_stateMessage');
      expect(PlayerShootDataSchema.$id).toBe('PlayerShootData');
      expect(PlayerShootMessageSchema.$id).toBe('player_shootMessage');
      expect(PlayerReloadMessageSchema.$id).toBe('player_reloadMessage');
      expect(WeaponPickupAttemptDataSchema.$id).toBe('WeaponPickupAttemptData');
      expect(WeaponPickupAttemptMessageSchema.$id).toBe('weapon_pickup_attemptMessage');
      expect(PlayerMeleeAttackDataSchema.$id).toBe('PlayerMeleeAttackData');
      expect(PlayerMeleeAttackMessageSchema.$id).toBe('player_melee_attackMessage');
    });
  });
});
