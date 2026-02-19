import { describe, expect, it } from 'vitest';
import { WEAPON, COLORS, MINIMAP, PLAYER } from './constants';

/**
 * Test suite for game constants
 * These tests ensure critical values match server-side implementations
 */
describe('COLORS constants', () => {
  it('should export a COLORS object with all 23 palette keys', () => {
    const expectedKeys = [
      'BACKGROUND', 'GRID_LINE', 'PLAYER_HEAD', 'ENEMY_HEAD', 'DEAD_HEAD',
      'BODY', 'HEALTH_FULL', 'HEALTH_CRITICAL', 'HEALTH_DEPLETED_BG',
      'AMMO_READY', 'AMMO_RELOADING', 'SCORE', 'KILL_COUNTER',
      'DEBUG_OVERLAY', 'CHAT_SYSTEM', 'MUZZLE_FLASH', 'BULLET_TRAIL',
      'DAMAGE_NUMBER', 'BLOOD', 'SPAWN_RING', 'DAMAGE_FLASH',
      'HIT_CHEVRON', 'WEAPON_CRATE',
    ];
    for (const key of expectedKeys) {
      expect(COLORS).toHaveProperty(key);
    }
  });

  it('should have correct background color value', () => {
    expect(COLORS.BACKGROUND).toBe(0xC8CCC8);
  });

  it('should have correct blood color value', () => {
    expect(COLORS.BLOOD).toBe(0xCC3333);
  });

  it('should have correct muzzle flash color value', () => {
    expect(COLORS.MUZZLE_FLASH).toBe(0xFFD700);
  });
});

describe('MINIMAP constants', () => {
  it('should export a MINIMAP object with required keys', () => {
    expect(MINIMAP.SIZE).toBe(170);
    expect(MINIMAP.SCALE).toBe(0.106);
    expect(MINIMAP.RADAR_RANGE).toBe(600);
    expect(MINIMAP.BG_COLOR).toBe(0x3A3A3A);
    expect(MINIMAP.BORDER_COLOR).toBe(0x00CCCC);
  });
});

describe('PLAYER constants', () => {
  it('should have PLAYER_HEALTH_BAR_WIDTH', () => {
    expect(PLAYER.PLAYER_HEALTH_BAR_WIDTH).toBe(60);
  });

  it('should have HUD_HEALTH_BAR_WIDTH', () => {
    expect(PLAYER.HUD_HEALTH_BAR_WIDTH).toBe(200);
  });
});

describe('WEAPON constants', () => {
  describe('PISTOL_DAMAGE', () => {
    it('should equal 25 to match server PistolDamage constant', () => {
      // Server value: stick-rumble-server/internal/game/weapon.go:10 (PistolDamage = 25)
      // This ensures client UI and damage feedback match actual server damage
      // 25 damage = 4 shots to kill at 100 health (100/25 = 4)
      expect(WEAPON.PISTOL_DAMAGE).toBe(25);
    });

    it('should result in 4 shots to kill at 100 health', () => {
      const playerHealth = 100;
      const shotsToKill = Math.ceil(playerHealth / WEAPON.PISTOL_DAMAGE);
      expect(shotsToKill).toBe(4);
    });
  });

  describe('PISTOL_MAGAZINE_SIZE', () => {
    it('should equal 15 rounds', () => {
      expect(WEAPON.PISTOL_MAGAZINE_SIZE).toBe(15);
    });
  });

  describe('PISTOL_FIRE_RATE', () => {
    it('should equal 3 rounds per second', () => {
      expect(WEAPON.PISTOL_FIRE_RATE).toBe(3);
    });
  });

  describe('PISTOL_RELOAD_TIME', () => {
    it('should equal 1500ms (1.5 seconds)', () => {
      expect(WEAPON.PISTOL_RELOAD_TIME).toBe(1500);
    });
  });
});
