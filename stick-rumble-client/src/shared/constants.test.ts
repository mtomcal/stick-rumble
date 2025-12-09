import { describe, expect, it } from 'vitest';
import { WEAPON } from './constants';

/**
 * Test suite for game constants
 * These tests ensure critical values match server-side implementations
 */
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
