import Phaser from 'phaser';
import type { WebSocketClient } from '../network/WebSocketClient';
import { WEAPON } from '../../shared/constants';
import type { Clock } from '../utils/Clock';
import { RealClock } from '../utils/Clock';

/**
 * Weapon state synchronized with server
 */
export interface WeaponState {
  currentAmmo: number;
  maxAmmo: number;
  isReloading: boolean;
  canShoot: boolean;
  weaponType: string;
  isMelee: boolean;
}

/**
 * Weapon type for tracking melee vs ranged behavior
 */
type WeaponType = 'Pistol' | 'Bat' | 'Katana';

/**
 * Weapon cooldown configuration (in milliseconds)
 */
const WEAPON_COOLDOWNS: Record<WeaponType, number> = {
  Pistol: 1000 / WEAPON.PISTOL_FIRE_RATE, // 333ms
  Bat: 500,    // 0.5s cooldown (2.0/s fire rate)
  Katana: 800, // 0.8s cooldown (1.25/s fire rate)
};

/**
 * ShootingManager handles player shooting input and weapon state
 */
export class ShootingManager {
  private wsClient: WebSocketClient;
  private clock: Clock;

  private weaponState: WeaponState;
  private lastShotTime: number;
  private lastMeleeTime: number;
  private fireCooldownMs: number;
  private aimAngle: number = 0;
  private isEnabled: boolean = true;
  private weaponType: WeaponType = 'Pistol';
  private reloadStartTime: number = 0;
  private reloadDuration: number = 2000; // Default 2 seconds

  constructor(_scene: Phaser.Scene, wsClient: WebSocketClient, clock: Clock = new RealClock()) {
    this.wsClient = wsClient;
    this.clock = clock;

    // Calculate fire rate cooldown in milliseconds
    this.fireCooldownMs = 1000 / WEAPON.PISTOL_FIRE_RATE;

    // Initialize lastShotTime to allow immediate first shot
    this.lastShotTime = this.clock.now() - this.fireCooldownMs;

    // Initialize lastMeleeTime to allow immediate first melee attack
    this.lastMeleeTime = this.clock.now() - WEAPON_COOLDOWNS.Bat;

    // Initialize weapon state with full ammo
    this.weaponState = {
      currentAmmo: WEAPON.PISTOL_MAGAZINE_SIZE,
      maxAmmo: WEAPON.PISTOL_MAGAZINE_SIZE,
      isReloading: false,
      canShoot: true,
      weaponType: 'Pistol',
      isMelee: false,
    };
  }

  /**
   * Set the current aim angle
   */
  setAimAngle(angle: number): void {
    this.aimAngle = angle;
  }

  /**
   * Attempt to shoot
   * Returns true if shot was sent to server
   */
  shoot(): boolean {
    if (!this.isEnabled || !this.canShoot()) {
      return false;
    }

    // Record shot time for cooldown
    this.lastShotTime = this.clock.now();

    // Send shoot message to server
    this.wsClient.send({
      type: 'player:shoot',
      timestamp: this.clock.now(),
      data: {
        aimAngle: this.aimAngle,
      },
    });

    return true;
  }

  /**
   * Attempt to reload
   * Returns true if reload request was sent to server
   */
  reload(): boolean {
    // Don't reload if already reloading
    if (this.weaponState.isReloading) {
      return false;
    }

    // Don't reload if magazine is full
    if (this.weaponState.currentAmmo >= this.weaponState.maxAmmo) {
      return false;
    }

    // Send reload message to server
    this.wsClient.send({
      type: 'player:reload',
      timestamp: this.clock.now(),
    });

    return true;
  }

  /**
   * Check if player can shoot
   */
  canShoot(): boolean {
    // Check reload state
    if (this.weaponState.isReloading) {
      return false;
    }

    // Check ammo
    if (this.weaponState.currentAmmo <= 0) {
      return false;
    }

    // Check fire rate cooldown
    const now = this.clock.now();
    if (now - this.lastShotTime < this.fireCooldownMs) {
      return false;
    }

    return true;
  }

  /**
   * Update weapon state from server
   */
  updateWeaponState(state: WeaponState): void {
    // Track reload start when isReloading transitions from false to true
    if (state.isReloading && !this.weaponState.isReloading) {
      this.reloadStartTime = this.clock.now();
    }

    this.weaponState = { ...state };
  }

  /**
   * Get reload progress (0 to 1)
   */
  getReloadProgress(): number {
    if (!this.weaponState.isReloading || this.reloadStartTime === 0) {
      return 0;
    }

    const elapsed = this.clock.now() - this.reloadStartTime;
    const progress = Math.min(elapsed / this.reloadDuration, 1.0);
    return progress;
  }

  /**
   * Get current weapon state
   */
  getWeaponState(): WeaponState {
    return { ...this.weaponState };
  }

  /**
   * Get current and max ammo as tuple
   */
  getAmmoInfo(): [number, number] {
    return [this.weaponState.currentAmmo, this.weaponState.maxAmmo];
  }

  /**
   * Check if magazine is empty
   */
  isEmpty(): boolean {
    return this.weaponState.currentAmmo <= 0;
  }

  /**
   * Check if currently reloading
   */
  isReloading(): boolean {
    return this.weaponState.isReloading;
  }

  /**
   * Set weapon type for cooldown tracking
   */
  setWeaponType(weaponType: WeaponType): void {
    this.weaponType = weaponType;
  }

  /**
   * Check if current weapon is melee
   */
  isMeleeWeapon(): boolean {
    return this.weaponState.isMelee;
  }

  /**
   * Check if current weapon is automatic (hold-to-fire)
   * Automatic weapons: Uzi, AK47
   * Semi-automatic/pump: Pistol, Shotgun, melee weapons
   */
  isAutomatic(): boolean {
    const weaponType = this.weaponState.weaponType.toLowerCase();
    return weaponType === 'uzi' || weaponType === 'ak47';
  }

  /**
   * Attempt a melee attack
   * Returns true if attack was sent to server
   */
  meleeAttack(): boolean {
    if (!this.isEnabled || !this.canMeleeAttack()) {
      return false;
    }

    // Record attack time for cooldown
    this.lastMeleeTime = this.clock.now();

    // Send melee attack message to server
    this.wsClient.send({
      type: 'player:melee_attack',
      timestamp: this.clock.now(),
      data: {
        aimAngle: this.aimAngle,
      },
    });

    return true;
  }

  /**
   * Check if player can perform melee attack
   */
  canMeleeAttack(): boolean {
    const cooldown = WEAPON_COOLDOWNS[this.weaponType] || WEAPON_COOLDOWNS.Bat;
    const now = this.clock.now();

    if (now - this.lastMeleeTime < cooldown) {
      return false;
    }

    return true;
  }

  /**
   * Disable shooting (e.g., when match ends)
   */
  disable(): void {
    this.isEnabled = false;
  }

  /**
   * Enable shooting
   */
  enable(): void {
    this.isEnabled = true;
  }

  /**
   * Cleanup
   */
  destroy(): void {
    // No cleanup needed for now
  }
}
