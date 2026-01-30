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

    it('should initialize with Pistol as default weapon', () => {
      const state = shootingManager.getWeaponState();
      expect(state.weaponType).toBe('Pistol');
      expect(state.isMelee).toBe(false);
    });

    it('should initialize with isMeleeWeapon returning false', () => {
      expect(shootingManager.isMeleeWeapon()).toBe(false);
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
        weaponType: 'Pistol',
        isMelee: false,
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
        weaponType: 'Pistol',
        isMelee: false,
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
        weaponType: 'Pistol',
        isMelee: false,
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
        weaponType: 'Pistol',
        isMelee: false,
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
        weaponType: 'Pistol',
        isMelee: false,
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
        weaponType: 'Pistol',
        isMelee: false,
      });
      expect(shootingManager.canShoot()).toBe(false);
    });

    it('should return false when reloading', () => {
      shootingManager.updateWeaponState({
        currentAmmo: 5,
        maxAmmo: 15,
        isReloading: true,
        canShoot: false,
        weaponType: 'Pistol',
        isMelee: false,
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
        weaponType: 'Pistol',
        isMelee: false,
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
        weaponType: 'Pistol',
        isMelee: false,
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
        weaponType: 'Pistol',
        isMelee: false,
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
        weaponType: 'Pistol',
        isMelee: false,
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
        weaponType: 'Pistol',
        isMelee: false,
      });

      expect(shootingManager.isReloading()).toBe(true);

      // Simulate reload completion from server
      shootingManager.updateWeaponState({
        currentAmmo: WEAPON.PISTOL_MAGAZINE_SIZE,
        maxAmmo: WEAPON.PISTOL_MAGAZINE_SIZE,
        isReloading: false,
        canShoot: true,
        weaponType: 'Pistol',
        isMelee: false,
      });

      expect(shootingManager.isReloading()).toBe(false);
    });
  });

  describe('melee attack', () => {
    it('should send player:melee_attack message when performing melee attack', () => {
      const aimAngle = Math.PI / 4;
      shootingManager.setAimAngle(aimAngle);
      shootingManager.meleeAttack();

      expect(mockWsClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'player:melee_attack',
          data: expect.objectContaining({
            aimAngle,
          }),
        })
      );
    });

    it('should not melee attack when on cooldown (Bat)', () => {
      shootingManager.setWeaponType('Bat');
      shootingManager.meleeAttack();
      vi.clearAllMocks();

      // Try to attack immediately (should fail due to cooldown)
      shootingManager.meleeAttack();
      expect(mockWsClient.send).not.toHaveBeenCalled();
    });

    it('should allow melee attack after Bat cooldown expires (0.5s)', () => {
      shootingManager.setWeaponType('Bat');
      shootingManager.meleeAttack();
      vi.clearAllMocks();

      // Advance time past Bat cooldown (0.5s = 500ms)
      clock.advance(600);

      shootingManager.meleeAttack();
      expect(mockWsClient.send).toHaveBeenCalled();
    });

    it('should allow melee attack after Katana cooldown expires (0.8s)', () => {
      shootingManager.setWeaponType('Katana');
      shootingManager.meleeAttack();
      vi.clearAllMocks();

      // Advance time past Katana cooldown (0.8s = 800ms)
      clock.advance(900);

      shootingManager.meleeAttack();
      expect(mockWsClient.send).toHaveBeenCalled();
    });

    it('should enforce faster cooldown for Bat vs Katana', () => {
      // Bat cooldown: 0.5s (500ms)
      shootingManager.setWeaponType('Bat');
      shootingManager.meleeAttack();
      vi.clearAllMocks();

      // Should be ready after 500ms
      clock.advance(500);
      shootingManager.meleeAttack();
      expect(mockWsClient.send).toHaveBeenCalled();

      // Reset for Katana
      vi.clearAllMocks();
      shootingManager.setWeaponType('Katana');
      shootingManager.meleeAttack();
      vi.clearAllMocks();

      // Should NOT be ready after 500ms
      clock.advance(500);
      shootingManager.meleeAttack();
      expect(mockWsClient.send).not.toHaveBeenCalled();

      // Should be ready after 800ms total
      clock.advance(300);
      shootingManager.meleeAttack();
      expect(mockWsClient.send).toHaveBeenCalled();
    });

    it('should not check ammo for melee weapons', () => {
      shootingManager.setWeaponType('Bat');

      // Even with 0 ammo, melee should work
      shootingManager.updateWeaponState({
        currentAmmo: 0,
        maxAmmo: 0,
        isReloading: false,
        canShoot: true,
        weaponType: 'Bat',
        isMelee: true,
      });

      shootingManager.meleeAttack();
      expect(mockWsClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'player:melee_attack',
        })
      );
    });

    it('should respect enabled/disabled state for melee', () => {
      shootingManager.setWeaponType('Bat');
      shootingManager.disable();

      shootingManager.meleeAttack();
      expect(mockWsClient.send).not.toHaveBeenCalled();

      shootingManager.enable();
      shootingManager.meleeAttack();
      expect(mockWsClient.send).toHaveBeenCalled();
    });
  });

  describe('isMeleeWeapon', () => {
    it('should return false for Pistol (ranged weapon)', () => {
      shootingManager.updateWeaponState({
        currentAmmo: 15,
        maxAmmo: 15,
        isReloading: false,
        canShoot: true,
        weaponType: 'Pistol',
        isMelee: false,
      });

      expect(shootingManager.isMeleeWeapon()).toBe(false);
    });

    it('should return true for Bat (melee weapon)', () => {
      shootingManager.updateWeaponState({
        currentAmmo: 0,
        maxAmmo: 0,
        isReloading: false,
        canShoot: true,
        weaponType: 'Bat',
        isMelee: true,
      });

      expect(shootingManager.isMeleeWeapon()).toBe(true);
    });

    it('should return true for Katana (melee weapon)', () => {
      shootingManager.updateWeaponState({
        currentAmmo: 0,
        maxAmmo: 0,
        isReloading: false,
        canShoot: true,
        weaponType: 'Katana',
        isMelee: true,
      });

      expect(shootingManager.isMeleeWeapon()).toBe(true);
    });

    it('should update isMelee state when weapon changes from ranged to melee', () => {
      // Start with ranged weapon
      expect(shootingManager.isMeleeWeapon()).toBe(false);

      // Switch to melee weapon
      shootingManager.updateWeaponState({
        currentAmmo: 0,
        maxAmmo: 0,
        isReloading: false,
        canShoot: true,
        weaponType: 'Bat',
        isMelee: true,
      });

      expect(shootingManager.isMeleeWeapon()).toBe(true);
    });

    it('should update isMelee state when weapon changes from melee to ranged', () => {
      // Start with melee weapon
      shootingManager.updateWeaponState({
        currentAmmo: 0,
        maxAmmo: 0,
        isReloading: false,
        canShoot: true,
        weaponType: 'Bat',
        isMelee: true,
      });

      expect(shootingManager.isMeleeWeapon()).toBe(true);

      // Switch to ranged weapon
      shootingManager.updateWeaponState({
        currentAmmo: 15,
        maxAmmo: 15,
        isReloading: false,
        canShoot: true,
        weaponType: 'Pistol',
        isMelee: false,
      });

      expect(shootingManager.isMeleeWeapon()).toBe(false);
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

  describe('isAutomatic', () => {
    it('should return true for Uzi (automatic weapon)', () => {
      shootingManager.updateWeaponState({
        currentAmmo: 30,
        maxAmmo: 30,
        isReloading: false,
        canShoot: true,
        weaponType: 'Uzi',
        isMelee: false,
      });

      expect(shootingManager.isAutomatic()).toBe(true);
    });

    it('should return true for AK47 (automatic weapon)', () => {
      shootingManager.updateWeaponState({
        currentAmmo: 30,
        maxAmmo: 30,
        isReloading: false,
        canShoot: true,
        weaponType: 'AK47',
        isMelee: false,
      });

      expect(shootingManager.isAutomatic()).toBe(true);
    });

    it('should return false for Pistol (semi-automatic weapon)', () => {
      shootingManager.updateWeaponState({
        currentAmmo: 15,
        maxAmmo: 15,
        isReloading: false,
        canShoot: true,
        weaponType: 'Pistol',
        isMelee: false,
      });

      expect(shootingManager.isAutomatic()).toBe(false);
    });

    it('should return false for Shotgun (pump action weapon)', () => {
      shootingManager.updateWeaponState({
        currentAmmo: 8,
        maxAmmo: 8,
        isReloading: false,
        canShoot: true,
        weaponType: 'Shotgun',
        isMelee: false,
      });

      expect(shootingManager.isAutomatic()).toBe(false);
    });

    it('should return false for melee weapons (Bat)', () => {
      shootingManager.updateWeaponState({
        currentAmmo: 0,
        maxAmmo: 0,
        isReloading: false,
        canShoot: true,
        weaponType: 'Bat',
        isMelee: true,
      });

      expect(shootingManager.isAutomatic()).toBe(false);
    });

    it('should return false for melee weapons (Katana)', () => {
      shootingManager.updateWeaponState({
        currentAmmo: 0,
        maxAmmo: 0,
        isReloading: false,
        canShoot: true,
        weaponType: 'Katana',
        isMelee: true,
      });

      expect(shootingManager.isAutomatic()).toBe(false);
    });

    it('should handle case-insensitive weapon type matching', () => {
      // Test lowercase
      shootingManager.updateWeaponState({
        currentAmmo: 30,
        maxAmmo: 30,
        isReloading: false,
        canShoot: true,
        weaponType: 'uzi',
        isMelee: false,
      });
      expect(shootingManager.isAutomatic()).toBe(true);

      // Test mixed case
      shootingManager.updateWeaponState({
        currentAmmo: 30,
        maxAmmo: 30,
        isReloading: false,
        canShoot: true,
        weaponType: 'ak47',
        isMelee: false,
      });
      expect(shootingManager.isAutomatic()).toBe(true);
    });
  });

  describe('getReloadProgress', () => {
    it('should return 0 when not reloading', () => {
      const progress = shootingManager.getReloadProgress();
      expect(progress).toBe(0);
    });

    it('should return 0 immediately after starting reload (no time elapsed)', () => {
      // Start reloading
      shootingManager.updateWeaponState({
        currentAmmo: 5,
        maxAmmo: WEAPON.PISTOL_MAGAZINE_SIZE,
        isReloading: true,
        canShoot: false,
        weaponType: 'Pistol',
        isMelee: false,
      });

      // No time advanced yet, so progress should be 0
      const progress = shootingManager.getReloadProgress();
      expect(progress).toBe(0);
    });

    it('should return progress between 0 and 1 during reload', () => {
      // Start reloading
      shootingManager.updateWeaponState({
        currentAmmo: 5,
        maxAmmo: WEAPON.PISTOL_MAGAZINE_SIZE,
        isReloading: true,
        canShoot: false,
        weaponType: 'Pistol',
        isMelee: false,
      });

      // Advance time to 50% of reload (default 2000ms)
      clock.advance(1000);

      const progress = shootingManager.getReloadProgress();
      expect(progress).toBeGreaterThan(0);
      expect(progress).toBeLessThanOrEqual(1);
      expect(progress).toBeCloseTo(0.5, 1);
    });

    it('should cap progress at 1.0 when reload time exceeded', () => {
      // Start reloading
      shootingManager.updateWeaponState({
        currentAmmo: 5,
        maxAmmo: WEAPON.PISTOL_MAGAZINE_SIZE,
        isReloading: true,
        canShoot: false,
        weaponType: 'Pistol',
        isMelee: false,
      });

      // Advance time past reload duration
      clock.advance(3000);

      const progress = shootingManager.getReloadProgress();
      expect(progress).toBe(1.0);
    });

    it('should reset to 0 when reload completes', () => {
      // Start reloading
      shootingManager.updateWeaponState({
        currentAmmo: 5,
        maxAmmo: WEAPON.PISTOL_MAGAZINE_SIZE,
        isReloading: true,
        canShoot: false,
        weaponType: 'Pistol',
        isMelee: false,
      });

      // Advance time to mid-reload
      clock.advance(1000);

      // Verify progress is > 0
      expect(shootingManager.getReloadProgress()).toBeGreaterThan(0);

      // Complete reload
      shootingManager.updateWeaponState({
        currentAmmo: WEAPON.PISTOL_MAGAZINE_SIZE,
        maxAmmo: WEAPON.PISTOL_MAGAZINE_SIZE,
        isReloading: false,
        canShoot: true,
        weaponType: 'Pistol',
        isMelee: false,
      });

      // Progress should be 0 now
      const progress = shootingManager.getReloadProgress();
      expect(progress).toBe(0);
    });
  });

  describe('dynamic fire rate cooldown', () => {
    it('should update fire rate cooldown when switching to Uzi (10 rounds/sec = 100ms)', () => {
      // Start with Pistol (3 rounds/sec = 333ms)
      shootingManager.shoot();
      vi.clearAllMocks();

      // Switch to Uzi (10 rounds/sec = 100ms)
      shootingManager.updateWeaponState({
        currentAmmo: 30,
        maxAmmo: 30,
        isReloading: false,
        canShoot: true,
        weaponType: 'Uzi',
        isMelee: false,
      });

      // Should be able to shoot after 100ms (Uzi fire rate)
      clock.advance(100);
      shootingManager.shoot();
      expect(mockWsClient.send).toHaveBeenCalled();
    });

    it('should update fire rate cooldown when switching to AK47 (6 rounds/sec = 166ms)', () => {
      // Start with Pistol (3 rounds/sec = 333ms)
      shootingManager.shoot();
      vi.clearAllMocks();

      // Switch to AK47 (6 rounds/sec = 166.67ms)
      // Weapon pickup resets cooldown, allowing immediate first shot
      shootingManager.updateWeaponState({
        currentAmmo: 30,
        maxAmmo: 30,
        isReloading: false,
        canShoot: true,
        weaponType: 'AK47',
        isMelee: false,
      });

      // Can shoot immediately after weapon pickup
      shootingManager.shoot();
      expect(mockWsClient.send).toHaveBeenCalledTimes(1);
      vi.clearAllMocks();

      // Should NOT be able to shoot again at 100ms (too soon for AK47 cooldown)
      clock.advance(100);
      shootingManager.shoot();
      expect(mockWsClient.send).not.toHaveBeenCalled();

      // Should be able to shoot after 167ms total (AK47 fire rate: 1000/6 = 166.67ms, need to exceed)
      clock.advance(67);
      shootingManager.shoot();
      expect(mockWsClient.send).toHaveBeenCalled();
    });

    it('should update fire rate cooldown when switching to Shotgun (1 round/sec = 1000ms)', () => {
      // Start with Pistol (3 rounds/sec = 333ms)
      shootingManager.shoot();
      vi.clearAllMocks();

      // Switch to Shotgun (1 round/sec = 1000ms)
      // Weapon pickup resets cooldown, allowing immediate first shot
      shootingManager.updateWeaponState({
        currentAmmo: 6,
        maxAmmo: 6,
        isReloading: false,
        canShoot: true,
        weaponType: 'Shotgun',
        isMelee: false,
      });

      // Can shoot immediately after weapon pickup
      shootingManager.shoot();
      expect(mockWsClient.send).toHaveBeenCalledTimes(1);
      vi.clearAllMocks();

      // Should NOT be able to shoot again at 333ms (too soon for Shotgun cooldown)
      clock.advance(333);
      shootingManager.shoot();
      expect(mockWsClient.send).not.toHaveBeenCalled();

      // Should be able to shoot after 1000ms total (Shotgun fire rate)
      clock.advance(667);
      shootingManager.shoot();
      expect(mockWsClient.send).toHaveBeenCalled();
    });

    it('should allow immediate shooting after weapon pickup (weapon switch resets cooldown)', () => {
      // Start with Shotgun (1 round/sec = 1000ms)
      shootingManager.updateWeaponState({
        currentAmmo: 6,
        maxAmmo: 6,
        isReloading: false,
        canShoot: true,
        weaponType: 'Shotgun',
        isMelee: false,
      });

      // Can shoot immediately with new weapon
      shootingManager.shoot();
      expect(mockWsClient.send).toHaveBeenCalledTimes(1);
      vi.clearAllMocks();

      // Immediately switch to Uzi (10 rounds/sec = 100ms)
      // Weapon pickup resets cooldown to allow immediate shooting
      shootingManager.updateWeaponState({
        currentAmmo: 30,
        maxAmmo: 30,
        isReloading: false,
        canShoot: true,
        weaponType: 'Uzi',
        isMelee: false,
      });

      // Should be able to shoot immediately after picking up Uzi
      shootingManager.shoot();
      expect(mockWsClient.send).toHaveBeenCalledTimes(1);
      vi.clearAllMocks();

      // Now subsequent shots should use Uzi's 100ms cooldown
      clock.advance(100);
      shootingManager.shoot();
      expect(mockWsClient.send).toHaveBeenCalledTimes(1);
    });

    it('should handle rapid fire with Uzi after cooldown update', () => {
      // Switch to Uzi
      shootingManager.updateWeaponState({
        currentAmmo: 30,
        maxAmmo: 30,
        isReloading: false,
        canShoot: true,
        weaponType: 'Uzi',
        isMelee: false,
      });

      // First shot
      shootingManager.shoot();
      expect(mockWsClient.send).toHaveBeenCalledTimes(1);
      vi.clearAllMocks();

      // Second shot after 100ms (Uzi fire rate)
      clock.advance(100);
      shootingManager.shoot();
      expect(mockWsClient.send).toHaveBeenCalledTimes(1);
      vi.clearAllMocks();

      // Third shot after another 100ms
      clock.advance(100);
      shootingManager.shoot();
      expect(mockWsClient.send).toHaveBeenCalledTimes(1);
    });

    it('should not update cooldown when weapon type stays the same', () => {
      // Start with Pistol
      const firstState = {
        currentAmmo: 15,
        maxAmmo: 15,
        isReloading: false,
        canShoot: true,
        weaponType: 'Pistol',
        isMelee: false,
      };
      shootingManager.updateWeaponState(firstState);

      shootingManager.shoot();
      vi.clearAllMocks();

      // Update state but keep same weapon type (ammo decrease)
      shootingManager.updateWeaponState({
        currentAmmo: 14,
        maxAmmo: 15,
        isReloading: false,
        canShoot: true,
        weaponType: 'Pistol',
        isMelee: false,
      });

      // Should still use Pistol fire rate (333.33ms, need to exceed)
      clock.advance(334);
      shootingManager.shoot();
      expect(mockWsClient.send).toHaveBeenCalled();
    });

    it('should fall back to default cooldown if weapon config not found', () => {
      // Update to unknown weapon type
      shootingManager.updateWeaponState({
        currentAmmo: 10,
        maxAmmo: 10,
        isReloading: false,
        canShoot: true,
        weaponType: 'UnknownWeapon',
        isMelee: false,
      });

      shootingManager.shoot();
      vi.clearAllMocks();

      // Should still have some cooldown (fall back to last known or default)
      shootingManager.shoot();
      expect(mockWsClient.send).not.toHaveBeenCalled();

      // After reasonable time, should be able to shoot
      clock.advance(1000);
      shootingManager.shoot();
      expect(mockWsClient.send).toHaveBeenCalled();
    });
  });
});
