import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ShootingManager, type WeaponState } from './ShootingManager';
import type { WebSocketClient } from '../network/WebSocketClient';
import { WEAPON } from '../../shared/constants';
import { ManualClock } from '../utils/Clock';

// Create mock Phaser scene
const createMockScene = () => {
  return {
    input: {
      activePointer: { isDown: false },
    },
  } as unknown as Phaser.Scene;
};

// Create mock WebSocketClient
const createMockWsClient = () => ({
  send: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  on: vi.fn(),
});

describe('ShootingManager', () => {
  let scene: Phaser.Scene;
  let mockWsClient: ReturnType<typeof createMockWsClient>;
  let shootingManager: ShootingManager;
  let clock: ManualClock;

  beforeEach(() => {
    scene = createMockScene();
    mockWsClient = createMockWsClient();
    clock = new ManualClock();
    shootingManager = new ShootingManager(scene, mockWsClient as unknown as WebSocketClient, clock);
  });

  afterEach(() => {
    shootingManager.destroy();
  });

  describe('initialization', () => {
    it('should initialize with full ammo', () => {
      const state = shootingManager.getWeaponState();
      expect(state.currentAmmo).toBe(WEAPON.PISTOL_MAGAZINE_SIZE);
      expect(state.maxAmmo).toBe(WEAPON.PISTOL_MAGAZINE_SIZE);
    });

    it('should initialize not reloading', () => {
      const state = shootingManager.getWeaponState();
      expect(state.isReloading).toBe(false);
    });

    it('should initialize with canShoot true', () => {
      const state = shootingManager.getWeaponState();
      expect(state.canShoot).toBe(true);
    });
  });

  describe('shoot', () => {
    it('should send player:shoot message when shooting', () => {
      const aimAngle = Math.PI / 4;
      shootingManager.setAimAngle(aimAngle);
      shootingManager.shoot();

      expect(mockWsClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'player:shoot',
          data: expect.objectContaining({
            aimAngle,
          }),
        })
      );
    });

    it('should not shoot when on cooldown', () => {
      shootingManager.shoot();
      vi.clearAllMocks();

      // Try to shoot immediately (should fail due to cooldown)
      shootingManager.shoot();
      expect(mockWsClient.send).not.toHaveBeenCalled();
    });

    it('should allow shooting after cooldown expires', () => {
      shootingManager.shoot();
      vi.clearAllMocks();

      // Advance time past cooldown (1/3 second = ~334ms for 3 rounds/sec)
      clock.advance(400);

      shootingManager.shoot();
      expect(mockWsClient.send).toHaveBeenCalled();
    });

    it('should not shoot when magazine is empty', () => {
      // Manually set ammo to 0
      shootingManager.updateWeaponState({
        currentAmmo: 0,
        maxAmmo: WEAPON.PISTOL_MAGAZINE_SIZE,
        isReloading: false,
        canShoot: false,
      });

      shootingManager.shoot();
      expect(mockWsClient.send).not.toHaveBeenCalled();
    });

    it('should not shoot while reloading', () => {
      shootingManager.updateWeaponState({
        currentAmmo: 5,
        maxAmmo: WEAPON.PISTOL_MAGAZINE_SIZE,
        isReloading: true,
        canShoot: false,
      });

      shootingManager.shoot();
      expect(mockWsClient.send).not.toHaveBeenCalled();
    });
  });

  describe('reload', () => {
    it('should send player:reload message when reloading with partial magazine', () => {
      shootingManager.updateWeaponState({
        currentAmmo: 5,
        maxAmmo: WEAPON.PISTOL_MAGAZINE_SIZE,
        isReloading: false,
        canShoot: true,
      });

      shootingManager.reload();
      expect(mockWsClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'player:reload',
        })
      );
    });

    it('should not send reload message when magazine is full', () => {
      shootingManager.reload();
      expect(mockWsClient.send).not.toHaveBeenCalled();
    });

    it('should not reload while already reloading', () => {
      shootingManager.updateWeaponState({
        currentAmmo: 5,
        maxAmmo: WEAPON.PISTOL_MAGAZINE_SIZE,
        isReloading: true,
        canShoot: false,
      });

      shootingManager.reload();
      expect(mockWsClient.send).not.toHaveBeenCalled();
    });
  });

  describe('updateWeaponState', () => {
    it('should update weapon state from server', () => {
      const newState: WeaponState = {
        currentAmmo: 10,
        maxAmmo: 15,
        isReloading: false,
        canShoot: true,
      };

      shootingManager.updateWeaponState(newState);

      const state = shootingManager.getWeaponState();
      expect(state.currentAmmo).toBe(10);
      expect(state.isReloading).toBe(false);
    });
  });

  describe('setAimAngle', () => {
    it('should store aim angle for shooting', () => {
      const angle = Math.PI / 2;
      shootingManager.setAimAngle(angle);

      shootingManager.shoot();

      expect(mockWsClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            aimAngle: angle,
          }),
        })
      );
    });
  });

  describe('canShoot', () => {
    it('should return true when can shoot', () => {
      expect(shootingManager.canShoot()).toBe(true);
    });

    it('should return false when on cooldown', () => {
      shootingManager.shoot();
      expect(shootingManager.canShoot()).toBe(false);
    });

    it('should return false when magazine is empty', () => {
      shootingManager.updateWeaponState({
        currentAmmo: 0,
        maxAmmo: 15,
        isReloading: false,
        canShoot: false,
      });
      expect(shootingManager.canShoot()).toBe(false);
    });

    it('should return false when reloading', () => {
      shootingManager.updateWeaponState({
        currentAmmo: 5,
        maxAmmo: 15,
        isReloading: true,
        canShoot: false,
      });
      expect(shootingManager.canShoot()).toBe(false);
    });
  });

  describe('getAmmoInfo', () => {
    it('should return current and max ammo', () => {
      const [current, max] = shootingManager.getAmmoInfo();
      expect(current).toBe(WEAPON.PISTOL_MAGAZINE_SIZE);
      expect(max).toBe(WEAPON.PISTOL_MAGAZINE_SIZE);
    });

    it('should reflect weapon state updates', () => {
      shootingManager.updateWeaponState({
        currentAmmo: 7,
        maxAmmo: 15,
        isReloading: false,
        canShoot: true,
      });

      const [current, max] = shootingManager.getAmmoInfo();
      expect(current).toBe(7);
      expect(max).toBe(15);
    });
  });

  describe('fire rate cooldown', () => {
    it('should enforce fire rate of 3 rounds per second', () => {
      // Fire rate is 3/sec = 333ms cooldown
      const cooldownMs = 1000 / WEAPON.PISTOL_FIRE_RATE;

      shootingManager.shoot();
      vi.clearAllMocks();

      // Try at half cooldown - should fail
      clock.advance(cooldownMs / 2);
      shootingManager.shoot();
      expect(mockWsClient.send).not.toHaveBeenCalled();

      // Try at full cooldown - should succeed
      clock.advance(cooldownMs / 2 + 1);
      shootingManager.shoot();
      expect(mockWsClient.send).toHaveBeenCalled();
    });
  });

  describe('aim angle accuracy', () => {
    // Acceptance criteria: aim angle sent to server matches cursor position (±2 degrees tolerance)
    const TWO_DEGREES_IN_RADIANS = (2 * Math.PI) / 180;

    it('should send exact aim angle to server', () => {
      const exactAngle = Math.PI / 4; // 45 degrees
      shootingManager.setAimAngle(exactAngle);
      shootingManager.shoot();

      expect(mockWsClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'player:shoot',
          data: expect.objectContaining({
            aimAngle: exactAngle,
          }),
        })
      );

      // Verify angle is within ±2 degrees tolerance (exact match in this case)
      const sentMessage = mockWsClient.send.mock.calls[0][0];
      const sentAngle = sentMessage.data.aimAngle;
      expect(Math.abs(sentAngle - exactAngle)).toBeLessThanOrEqual(TWO_DEGREES_IN_RADIANS);
    });

    it('should preserve aim angle precision within ±2 degrees tolerance', () => {
      // Test various angles to ensure precision is maintained
      const testAngles = [
        0,                    // 0 degrees (right)
        Math.PI / 2,          // 90 degrees (down)
        Math.PI,              // 180 degrees (left)
        -Math.PI / 2,         // -90 degrees (up)
        Math.PI / 6,          // 30 degrees
        (5 * Math.PI) / 4,    // 225 degrees
      ];

      for (const expectedAngle of testAngles) {
        vi.clearAllMocks();

        // Reset cooldown
        clock.advance(1000);

        shootingManager.setAimAngle(expectedAngle);
        shootingManager.shoot();

        const sentMessage = mockWsClient.send.mock.calls[0][0];
        const sentAngle = sentMessage.data.aimAngle;

        // Verify sent angle matches within ±2 degrees tolerance
        const angleDiff = Math.abs(sentAngle - expectedAngle);
        expect(angleDiff).toBeLessThanOrEqual(TWO_DEGREES_IN_RADIANS);
      }
    });

    it('should handle edge case angles at 0 and 2π boundary', () => {
      // Test boundary condition where angle wraps around
      const nearZeroAngle = 0.01; // Just above 0
      shootingManager.setAimAngle(nearZeroAngle);
      shootingManager.shoot();

      const sentMessage = mockWsClient.send.mock.calls[0][0];
      expect(sentMessage.data.aimAngle).toBe(nearZeroAngle);
    });
  });

  describe('isEmpty', () => {
    it('should return true when magazine is empty', () => {
      shootingManager.updateWeaponState({
        currentAmmo: 0,
        maxAmmo: WEAPON.PISTOL_MAGAZINE_SIZE,
        isReloading: false,
        canShoot: false,
      });

      expect(shootingManager.isEmpty()).toBe(true);
    });

    it('should return false when magazine has ammo', () => {
      expect(shootingManager.isEmpty()).toBe(false);
    });

    it('should return false with partial magazine', () => {
      shootingManager.updateWeaponState({
        currentAmmo: 5,
        maxAmmo: WEAPON.PISTOL_MAGAZINE_SIZE,
        isReloading: false,
        canShoot: true,
      });

      expect(shootingManager.isEmpty()).toBe(false);
    });
  });

  describe('isReloading', () => {
    it('should return true when reloading', () => {
      shootingManager.updateWeaponState({
        currentAmmo: 5,
        maxAmmo: WEAPON.PISTOL_MAGAZINE_SIZE,
        isReloading: true,
        canShoot: false,
      });

      expect(shootingManager.isReloading()).toBe(true);
    });

    it('should return false when not reloading', () => {
      expect(shootingManager.isReloading()).toBe(false);
    });

    it('should return false after reload completes', () => {
      // Start reloading
      shootingManager.updateWeaponState({
        currentAmmo: 5,
        maxAmmo: WEAPON.PISTOL_MAGAZINE_SIZE,
        isReloading: true,
        canShoot: false,
      });

      expect(shootingManager.isReloading()).toBe(true);

      // Simulate reload completion from server
      shootingManager.updateWeaponState({
        currentAmmo: WEAPON.PISTOL_MAGAZINE_SIZE,
        maxAmmo: WEAPON.PISTOL_MAGAZINE_SIZE,
        isReloading: false,
        canShoot: true,
      });

      expect(shootingManager.isReloading()).toBe(false);
    });
  });

  describe('disable/enable', () => {
    it('should disable shooting when disable() is called', () => {
      // Shoot successfully first
      shootingManager.shoot();
      expect(mockWsClient.send).toHaveBeenCalledTimes(1);

      // Disable shooting
      shootingManager.disable();

      // Advance time past cooldown
      clock.advance(400);
      vi.clearAllMocks();

      // Try to shoot - should NOT send
      shootingManager.shoot();
      expect(mockWsClient.send).not.toHaveBeenCalled();
    });

    it('should enable shooting when enable() is called', () => {
      // Disable first
      shootingManager.disable();

      // Try to shoot while disabled
      shootingManager.shoot();
      expect(mockWsClient.send).not.toHaveBeenCalled();

      // Enable shooting
      shootingManager.enable();

      // Now shoot should work
      shootingManager.shoot();
      expect(mockWsClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'player:shoot',
        })
      );
    });

    it('should be enabled by default', () => {
      shootingManager.shoot();
      expect(mockWsClient.send).toHaveBeenCalledTimes(1);
    });

    it('should not shoot when disabled even after cooldown', () => {
      shootingManager.disable();

      // Try shooting multiple times with cooldown in between
      shootingManager.shoot();
      clock.advance(400);
      shootingManager.shoot();
      clock.advance(400);
      shootingManager.shoot();

      // Should never send
      expect(mockWsClient.send).not.toHaveBeenCalled();
    });

    it('should respect cooldown after re-enabling', () => {
      // Shoot once
      shootingManager.shoot();
      expect(mockWsClient.send).toHaveBeenCalledTimes(1);

      // Disable, then enable
      shootingManager.disable();
      shootingManager.enable();
      vi.clearAllMocks();

      // Try to shoot immediately - should still be on cooldown
      shootingManager.shoot();
      expect(mockWsClient.send).not.toHaveBeenCalled();

      // After cooldown expires, should work
      clock.advance(400);
      shootingManager.shoot();
      expect(mockWsClient.send).toHaveBeenCalledTimes(1);
    });
  });
});
