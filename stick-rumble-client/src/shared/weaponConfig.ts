/**
 * Weapon configuration loader
 * Loads weapon stats from shared weapon-configs.json file
 */

export interface ProjectileVisuals {
  color: string;
  diameter: number;
  tracerColor: string;
  tracerWidth: number;
  shape: 'chevron' | 'circle';
  tracerLength: number;
}

export interface WeaponVisuals {
  muzzleFlashColor: string;
  muzzleFlashSize: number;
  muzzleFlashDuration: number;
  muzzleFlashShape: 'starburst' | 'circle';
  projectile: ProjectileVisuals;
}

export interface RecoilConfig {
  verticalPerShot: number;
  horizontalPerShot: number;
  recoveryTime: number;
  maxAccumulation: number;
}

export interface WeaponConfig {
  name: string;
  damage: number;
  fireRate: number;
  magazineSize: number;
  reloadTimeMs: number;
  projectileSpeed: number;
  range: number;
  arcDegrees: number;
  knockbackDistance: number;
  recoil: RecoilConfig | null;
  spreadDegrees: number;
  visuals: WeaponVisuals;
}

export interface WeaponConfigFile {
  version: string;
  weapons: Record<string, WeaponConfig>;
}

let weaponConfigs: Record<string, WeaponConfig> | null = null;

/**
 * Reset weapon configs cache (for testing)
 */
export function resetWeaponConfigs(): void {
  weaponConfigs = null;
}

/**
 * Load weapon configurations from JSON file
 * In production, this should fetch from the server or be bundled
 */
export async function loadWeaponConfigs(): Promise<Record<string, WeaponConfig>> {
  if (weaponConfigs) {
    return weaponConfigs;
  }

  try {
    // In Vite, we can import JSON directly
    const response = await fetch('/weapon-configs.json');
    if (!response.ok) {
      throw new Error(`Failed to fetch weapon configs: ${response.statusText}`);
    }

    const configFile: WeaponConfigFile = await response.json();
    weaponConfigs = configFile.weapons;
    return weaponConfigs;
  } catch (error) {
    console.error('Failed to load weapon configs, using hardcoded defaults:', error);
    weaponConfigs = getHardcodedWeaponConfigs();
    return weaponConfigs;
  }
}

/**
 * Get a specific weapon configuration
 */
export function getWeaponConfig(weaponName: string): WeaponConfig | null {
  if (!weaponConfigs) {
    console.warn('Weapon configs not loaded yet, call loadWeaponConfigs() first');
    return getHardcodedWeaponConfigs()[weaponName] || null;
  }
  return weaponConfigs[weaponName] || null;
}

/**
 * Synchronously get weapon config (for use after loadWeaponConfigs has been called)
 */
export function getWeaponConfigSync(weaponName: string): WeaponConfig | null {
  if (!weaponConfigs) {
    return getHardcodedWeaponConfigs()[weaponName] || null;
  }
  return weaponConfigs[weaponName] || null;
}

/**
 * Hardcoded weapon configs as fallback
 */
function getHardcodedWeaponConfigs(): Record<string, WeaponConfig> {
  return {
    Pistol: {
      name: 'Pistol',
      damage: 25,
      fireRate: 3.0,
      magazineSize: 15,
      reloadTimeMs: 1500,
      projectileSpeed: 800.0,
      range: 800.0,
      arcDegrees: 0,
      knockbackDistance: 0,
      recoil: null,
      spreadDegrees: 0,
      visuals: {
        muzzleFlashColor: '0xffdd00',
        muzzleFlashSize: 8,
        muzzleFlashDuration: 50,
        muzzleFlashShape: 'starburst',
        projectile: {
          color: '0xffff00', // Yellow
          diameter: 4,
          tracerColor: '0xffff00',
          tracerWidth: 2,
          shape: 'chevron',
          tracerLength: 20,
        },
      },
    },
    Bat: {
      name: 'Bat',
      damage: 25,
      fireRate: 2.0,
      magazineSize: 0,
      reloadTimeMs: 0,
      projectileSpeed: 0,
      range: 90.0,
      arcDegrees: 80,
      knockbackDistance: 40,
      recoil: null,
      spreadDegrees: 0,
      visuals: {
        muzzleFlashColor: '0x000000',
        muzzleFlashSize: 0,
        muzzleFlashDuration: 0,
        muzzleFlashShape: 'circle',
        projectile: {
          color: '0x000000', // Not used for melee
          diameter: 0,
          tracerColor: '0x000000',
          tracerWidth: 0,
          shape: 'circle',
          tracerLength: 0,
        },
      },
    },
    Katana: {
      name: 'Katana',
      damage: 45,
      fireRate: 1.25,
      magazineSize: 0,
      reloadTimeMs: 0,
      projectileSpeed: 0,
      range: 110.0,
      arcDegrees: 80,
      knockbackDistance: 0,
      recoil: null,
      spreadDegrees: 0,
      visuals: {
        muzzleFlashColor: '0x000000',
        muzzleFlashSize: 0,
        muzzleFlashDuration: 0,
        muzzleFlashShape: 'circle',
        projectile: {
          color: '0x000000', // Not used for melee
          diameter: 0,
          tracerColor: '0x000000',
          tracerWidth: 0,
          shape: 'circle',
          tracerLength: 0,
        },
      },
    },
    Uzi: {
      name: 'Uzi',
      damage: 8,
      fireRate: 10.0,
      magazineSize: 30,
      reloadTimeMs: 1500,
      projectileSpeed: 800.0,
      range: 600.0,
      arcDegrees: 0,
      knockbackDistance: 0,
      recoil: {
        verticalPerShot: 2.0,
        horizontalPerShot: 0.0,
        recoveryTime: 0.5,
        maxAccumulation: 20.0,
      },
      spreadDegrees: 5.0,
      visuals: {
        muzzleFlashColor: '0xffaa00',
        muzzleFlashSize: 8, // Matches weapon-configs.json
        muzzleFlashDuration: 50, // Matches weapon-configs.json
        muzzleFlashShape: 'starburst',
        projectile: {
          color: '0xffaa00', // Orange
          diameter: 3,
          tracerColor: '0xffaa00',
          tracerWidth: 1.5,
          shape: 'chevron',
          tracerLength: 20,
        },
      },
    },
    AK47: {
      name: 'AK47',
      damage: 20,
      fireRate: 6.0,
      magazineSize: 30,
      reloadTimeMs: 2000,
      projectileSpeed: 800.0,
      range: 800.0,
      arcDegrees: 0,
      knockbackDistance: 0,
      recoil: {
        verticalPerShot: 1.5,
        horizontalPerShot: 3.0,
        recoveryTime: 0.6,
        maxAccumulation: 15.0,
      },
      spreadDegrees: 3.0,
      visuals: {
        muzzleFlashColor: '0xffcc00',
        muzzleFlashSize: 12,
        muzzleFlashDuration: 80,
        muzzleFlashShape: 'starburst',
        projectile: {
          color: '0xffcc00', // Gold
          diameter: 5,
          tracerColor: '0xffcc00',
          tracerWidth: 2.5,
          shape: 'chevron',
          tracerLength: 20,
        },
      },
    },
    Shotgun: {
      name: 'Shotgun',
      damage: 60,
      fireRate: 1.0,
      magazineSize: 6,
      reloadTimeMs: 2500,
      projectileSpeed: 800.0,
      range: 300.0,
      arcDegrees: 15.0,
      knockbackDistance: 0,
      recoil: null,
      spreadDegrees: 0,
      visuals: {
        muzzleFlashColor: '0xff8800',
        muzzleFlashSize: 16,
        muzzleFlashDuration: 100,
        muzzleFlashShape: 'starburst',
        projectile: {
          color: '0xff8800', // Orange-red
          diameter: 6,
          tracerColor: '0xff8800',
          tracerWidth: 3,
          shape: 'chevron',
          tracerLength: 20,
        },
      },
    },
  };
}

/**
 * Parse hex color string to number
 */
export function parseHexColor(hexString: string): number {
  // Remove '0x' prefix if present and parse as hex
  const cleaned = hexString.replace('0x', '');
  return parseInt(cleaned, 16);
}

/**
 * Validate weapon configuration
 */
export function validateWeaponConfig(config: WeaponConfig): string[] {
  const errors: string[] = [];

  if (!config.name || config.name.trim() === '') {
    errors.push('Weapon name cannot be empty');
  }
  if (config.damage <= 0) {
    errors.push(`Weapon damage must be positive, got ${config.damage}`);
  }
  if (config.fireRate <= 0) {
    errors.push(`Weapon fire rate must be positive, got ${config.fireRate}`);
  }
  if (config.range <= 0) {
    errors.push(`Weapon range must be positive, got ${config.range}`);
  }

  // Validate ranged weapon constraints
  if (config.magazineSize > 0 && config.projectileSpeed <= 0) {
    errors.push('Ranged weapon must have positive projectile speed');
  }

  // Validate recoil if present
  if (config.recoil) {
    if (config.recoil.recoveryTime <= 0) {
      errors.push('Recoil recovery time must be positive');
    }
    if (config.recoil.maxAccumulation <= 0) {
      errors.push('Recoil max accumulation must be positive');
    }
  }

  return errors;
}
