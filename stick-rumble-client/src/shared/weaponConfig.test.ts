import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  loadWeaponConfigs,
  getWeaponConfig,
  getWeaponConfigSync,
  validateWeaponConfig,
  parseHexColor,
  resetWeaponConfigs,
  type WeaponConfig,
} from './weaponConfig';

describe('weaponConfig', () => {
  describe('parseHexColor', () => {
    it('should parse hex color string with 0x prefix', () => {
      expect(parseHexColor('0xffaa00')).toBe(0xffaa00);
      expect(parseHexColor('0xFF0000')).toBe(0xff0000);
      expect(parseHexColor('0x00FF00')).toBe(0x00ff00);
    });

    it('should parse hex color string without 0x prefix', () => {
      expect(parseHexColor('ffaa00')).toBe(0xffaa00);
      expect(parseHexColor('FF0000')).toBe(0xff0000);
    });
  });

  describe('validateWeaponConfig', () => {
    it('should validate a valid weapon config', () => {
      const config: WeaponConfig = {
        name: 'Pistol',
        damage: 25,
        fireRate: 3.0,
        magazineSize: 15,
        reloadTimeMs: 1500,
        projectileSpeed: 800,
        range: 800,
        arcDegrees: 0,
        knockbackDistance: 0,
        recoil: null,
        spreadDegrees: 0,
        visuals: {
          muzzleFlashColor: '0xffdd00',
          muzzleFlashSize: 8,
          muzzleFlashDuration: 50,
        },
      };

      const errors = validateWeaponConfig(config);
      expect(errors).toHaveLength(0);
    });

    it('should detect missing name', () => {
      const config: WeaponConfig = {
        name: '',
        damage: 25,
        fireRate: 3.0,
        magazineSize: 15,
        reloadTimeMs: 1500,
        projectileSpeed: 800,
        range: 800,
        arcDegrees: 0,
        knockbackDistance: 0,
        recoil: null,
        spreadDegrees: 0,
        visuals: {
          muzzleFlashColor: '0xffdd00',
          muzzleFlashSize: 8,
          muzzleFlashDuration: 50,
        },
      };

      const errors = validateWeaponConfig(config);
      expect(errors).toContain('Weapon name cannot be empty');
    });

    it('should detect invalid damage', () => {
      const config: WeaponConfig = {
        name: 'Test',
        damage: 0,
        fireRate: 3.0,
        magazineSize: 15,
        reloadTimeMs: 1500,
        projectileSpeed: 800,
        range: 800,
        arcDegrees: 0,
        knockbackDistance: 0,
        recoil: null,
        spreadDegrees: 0,
        visuals: {
          muzzleFlashColor: '0xffdd00',
          muzzleFlashSize: 8,
          muzzleFlashDuration: 50,
        },
      };

      const errors = validateWeaponConfig(config);
      expect(errors.some((e) => e.includes('damage must be positive'))).toBe(true);
    });

    it('should detect invalid fire rate', () => {
      const config: WeaponConfig = {
        name: 'Test',
        damage: 25,
        fireRate: 0,
        magazineSize: 15,
        reloadTimeMs: 1500,
        projectileSpeed: 800,
        range: 800,
        arcDegrees: 0,
        knockbackDistance: 0,
        recoil: null,
        spreadDegrees: 0,
        visuals: {
          muzzleFlashColor: '0xffdd00',
          muzzleFlashSize: 8,
          muzzleFlashDuration: 50,
        },
      };

      const errors = validateWeaponConfig(config);
      expect(errors.some((e) => e.includes('fire rate must be positive'))).toBe(true);
    });

    it('should detect invalid range', () => {
      const config: WeaponConfig = {
        name: 'Test',
        damage: 25,
        fireRate: 3.0,
        magazineSize: 15,
        reloadTimeMs: 1500,
        projectileSpeed: 800,
        range: 0,
        arcDegrees: 0,
        knockbackDistance: 0,
        recoil: null,
        spreadDegrees: 0,
        visuals: {
          muzzleFlashColor: '0xffdd00',
          muzzleFlashSize: 8,
          muzzleFlashDuration: 50,
        },
      };

      const errors = validateWeaponConfig(config);
      expect(errors.some((e) => e.includes('range must be positive'))).toBe(true);
    });

    it('should validate ranged weapon has projectile speed', () => {
      const config: WeaponConfig = {
        name: 'InvalidGun',
        damage: 25,
        fireRate: 3.0,
        magazineSize: 15, // Has ammo but no projectile speed
        reloadTimeMs: 1500,
        projectileSpeed: 0,
        range: 800,
        arcDegrees: 0,
        knockbackDistance: 0,
        recoil: null,
        spreadDegrees: 0,
        visuals: {
          muzzleFlashColor: '0xffdd00',
          muzzleFlashSize: 8,
          muzzleFlashDuration: 50,
        },
      };

      const errors = validateWeaponConfig(config);
      expect(errors.some((e) => e.includes('projectile speed'))).toBe(true);
    });

    it('should validate recoil parameters if present', () => {
      const config: WeaponConfig = {
        name: 'Test',
        damage: 25,
        fireRate: 3.0,
        magazineSize: 15,
        reloadTimeMs: 1500,
        projectileSpeed: 800,
        range: 800,
        arcDegrees: 0,
        knockbackDistance: 0,
        recoil: {
          verticalPerShot: 2.0,
          horizontalPerShot: 0,
          recoveryTime: 0, // Invalid
          maxAccumulation: -5, // Invalid
        },
        spreadDegrees: 0,
        visuals: {
          muzzleFlashColor: '0xffdd00',
          muzzleFlashSize: 8,
          muzzleFlashDuration: 50,
        },
      };

      const errors = validateWeaponConfig(config);
      expect(errors.some((e) => e.includes('recovery time'))).toBe(true);
      expect(errors.some((e) => e.includes('max accumulation'))).toBe(true);
    });
  });

  describe('getWeaponConfigSync', () => {
    it('should return hardcoded config when not loaded', () => {
      const pistol = getWeaponConfigSync('Pistol');
      expect(pistol).not.toBeNull();
      expect(pistol?.name).toBe('Pistol');
      expect(pistol?.damage).toBe(25);
    });

    it('should return null for invalid weapon', () => {
      const invalid = getWeaponConfigSync('InvalidWeapon');
      expect(invalid).toBeNull();
    });

    it('should return configs for all weapons', () => {
      const weapons = ['Pistol', 'Bat', 'Katana', 'Uzi', 'AK47', 'Shotgun'];

      for (const weaponName of weapons) {
        const config = getWeaponConfigSync(weaponName);
        expect(config).not.toBeNull();
        expect(config?.name).toBe(weaponName);
      }
    });
  });

  describe('getWeaponConfig', () => {
    it('should warn and return hardcoded config when configs not loaded', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      resetWeaponConfigs();

      const pistol = getWeaponConfig('Pistol');
      expect(pistol).not.toBeNull();
      expect(pistol?.name).toBe('Pistol');
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Weapon configs not loaded yet, call loadWeaponConfigs() first'
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe('loadWeaponConfigs', () => {
    beforeEach(() => {
      // Reset global state
      vi.clearAllMocks();
      // Reset the weapon configs cache
      resetWeaponConfigs();
    });

    it('should return cached configs on second call', async () => {
      const mockConfigs = {
        version: '1.0.0',
        weapons: {
          TestWeapon: {
            name: 'TestWeapon',
            damage: 50,
            fireRate: 5.0,
            magazineSize: 20,
            reloadTimeMs: 2000,
            projectileSpeed: 900,
            range: 700,
            arcDegrees: 0,
            knockbackDistance: 0,
            recoil: null,
            spreadDegrees: 0,
            visuals: {
              muzzleFlashColor: '0xff0000',
              muzzleFlashSize: 10,
              muzzleFlashDuration: 60,
            },
          },
        },
      };

      let fetchCallCount = 0;
      global.fetch = vi.fn().mockImplementation(() => {
        fetchCallCount++;
        return Promise.resolve({
          ok: true,
          json: async () => mockConfigs,
        } as Response);
      });

      // First call should fetch
      const configs1 = await loadWeaponConfigs();
      expect(fetchCallCount).toBe(1);
      expect(configs1.TestWeapon).toBeDefined();

      // Second call should return cached (no new fetch)
      const configs2 = await loadWeaponConfigs();
      expect(fetchCallCount).toBe(1); // Still 1, not 2
      expect(configs2.TestWeapon).toBeDefined();
      expect(configs2).toBe(configs1); // Same reference
    });

    it('should load configs from fetch', async () => {
      const mockConfigs = {
        version: '1.0.0',
        weapons: {
          TestWeapon: {
            name: 'TestWeapon',
            damage: 50,
            fireRate: 5.0,
            magazineSize: 20,
            reloadTimeMs: 2000,
            projectileSpeed: 900,
            range: 700,
            arcDegrees: 0,
            knockbackDistance: 0,
            recoil: null,
            spreadDegrees: 0,
            visuals: {
              muzzleFlashColor: '0xff0000',
              muzzleFlashSize: 10,
              muzzleFlashDuration: 60,
            },
          },
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockConfigs,
      } as Response);

      const configs = await loadWeaponConfigs();
      expect(configs).toBeDefined();
      expect(configs.TestWeapon).toBeDefined();
      expect(configs.TestWeapon.name).toBe('TestWeapon');
      expect(configs.TestWeapon.damage).toBe(50);
    });

    it('should fallback to hardcoded configs on fetch error', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const configs = await loadWeaponConfigs();
      expect(configs).toBeDefined();
      expect(configs.Pistol).toBeDefined();
      expect(configs.Pistol.name).toBe('Pistol');
    });

    it('should fallback to hardcoded configs on non-ok response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        statusText: 'Not Found',
      } as Response);

      const configs = await loadWeaponConfigs();
      expect(configs).toBeDefined();
      expect(configs.Pistol).toBeDefined();
    });
  });

  describe('Weapon configurations', () => {
    it('should have valid Pistol config', () => {
      const pistol = getWeaponConfigSync('Pistol');
      expect(pistol).not.toBeNull();
      expect(pistol?.damage).toBe(25);
      expect(pistol?.fireRate).toBe(3.0);
      expect(pistol?.magazineSize).toBe(15);
      expect(pistol?.reloadTimeMs).toBe(1500);
      expect(pistol?.range).toBe(800);
    });

    it('should have valid Bat config', () => {
      const bat = getWeaponConfigSync('Bat');
      expect(bat).not.toBeNull();
      expect(bat?.damage).toBe(25);
      expect(bat?.fireRate).toBe(2.0);
      expect(bat?.magazineSize).toBe(0); // Melee
      expect(bat?.range).toBe(64);
      expect(bat?.arcDegrees).toBe(90);
      expect(bat?.knockbackDistance).toBe(40);
    });

    it('should have valid Katana config', () => {
      const katana = getWeaponConfigSync('Katana');
      expect(katana).not.toBeNull();
      expect(katana?.damage).toBe(45);
      expect(katana?.fireRate).toBe(1.25);
      expect(katana?.magazineSize).toBe(0); // Melee
      expect(katana?.range).toBe(80);
      expect(katana?.arcDegrees).toBe(90);
    });

    it('should have valid Uzi config', () => {
      const uzi = getWeaponConfigSync('Uzi');
      expect(uzi).not.toBeNull();
      expect(uzi?.damage).toBe(8);
      expect(uzi?.fireRate).toBe(10.0);
      expect(uzi?.magazineSize).toBe(30);
      expect(uzi?.reloadTimeMs).toBe(1500);
      expect(uzi?.range).toBe(600);
      expect(uzi?.recoil).not.toBeNull();
      expect(uzi?.recoil?.verticalPerShot).toBe(2.0);
      expect(uzi?.spreadDegrees).toBe(5.0);
    });

    it('should have valid AK47 config', () => {
      const ak47 = getWeaponConfigSync('AK47');
      expect(ak47).not.toBeNull();
      expect(ak47?.damage).toBe(20);
      expect(ak47?.fireRate).toBe(6.0);
      expect(ak47?.magazineSize).toBe(30);
      expect(ak47?.reloadTimeMs).toBe(2000);
      expect(ak47?.range).toBe(800);
      expect(ak47?.recoil).not.toBeNull();
    });

    it('should have valid Shotgun config', () => {
      const shotgun = getWeaponConfigSync('Shotgun');
      expect(shotgun).not.toBeNull();
      expect(shotgun?.damage).toBe(60);
      expect(shotgun?.fireRate).toBe(1.0);
      expect(shotgun?.magazineSize).toBe(6);
      expect(shotgun?.reloadTimeMs).toBe(2500);
      expect(shotgun?.range).toBe(300);
      expect(shotgun?.arcDegrees).toBe(15.0);
    });
  });
});
