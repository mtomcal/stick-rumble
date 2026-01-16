import Phaser from 'phaser';
import { MeleeWeapon } from './MeleeWeapon';

/**
 * Position interface
 */
interface Position {
  x: number;
  y: number;
}

/**
 * MeleeWeaponManager manages melee weapon visuals for all players
 * Handles creating, updating, and removing MeleeWeapon instances per player
 */
export class MeleeWeaponManager {
  private scene: Phaser.Scene;
  private weapons: Map<string, MeleeWeapon> = new Map();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Create a melee weapon visual for a player
   * Only creates for Bat or Katana, removes existing weapon if switching to non-melee
   */
  createWeapon(playerId: string, weaponType: string, position: Position): void {
    // Remove existing weapon if player has one
    if (this.weapons.has(playerId)) {
      this.removeWeapon(playerId);
    }

    // Only create for melee weapons (case-insensitive check)
    const normalizedType = weaponType.toLowerCase();
    if (normalizedType !== 'bat' && normalizedType !== 'katana') {
      return;
    }

    const weapon = new MeleeWeapon(this.scene, position.x, position.y, weaponType);
    this.weapons.set(playerId, weapon);
  }

  /**
   * Check if player has a melee weapon visual
   */
  hasWeapon(playerId: string): boolean {
    return this.weapons.has(playerId);
  }

  /**
   * Get the weapon type for a player
   */
  getWeaponType(playerId: string): string | null {
    const weapon = this.weapons.get(playerId);
    return weapon ? weapon.weaponType : null;
  }

  /**
   * Start a swing animation for a player's weapon
   * Returns true if swing started, false if no weapon or already swinging
   */
  startSwing(playerId: string, aimAngle: number): boolean {
    const weapon = this.weapons.get(playerId);
    if (!weapon) {
      return false;
    }

    return weapon.startSwing(aimAngle);
  }

  /**
   * Update weapon position to follow player
   */
  updatePosition(playerId: string, position: Position): void {
    const weapon = this.weapons.get(playerId);
    if (weapon) {
      weapon.setPosition(position.x, position.y);
    }
  }

  /**
   * Update all weapon animations
   * Call this from GameScene.update()
   */
  update(): void {
    for (const weapon of this.weapons.values()) {
      weapon.update();
    }
  }

  /**
   * Remove a specific player's weapon
   */
  removeWeapon(playerId: string): void {
    const weapon = this.weapons.get(playerId);
    if (weapon) {
      weapon.destroy();
      this.weapons.delete(playerId);
    }
  }

  /**
   * Destroy all weapons and clear tracking
   */
  destroy(): void {
    for (const weapon of this.weapons.values()) {
      weapon.destroy();
    }
    this.weapons.clear();
  }
}
