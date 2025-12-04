import Phaser from 'phaser';
import type { WebSocketClient } from '../network/WebSocketClient';
import { WEAPON } from '../../shared/constants';

/**
 * Weapon state synchronized with server
 */
export interface WeaponState {
  currentAmmo: number;
  maxAmmo: number;
  isReloading: boolean;
  canShoot: boolean;
}

/**
 * ShootingManager handles player shooting input and weapon state
 */
export class ShootingManager {
  private wsClient: WebSocketClient;

  private weaponState: WeaponState;
  private lastShotTime: number = 0;
  private fireCooldownMs: number;
  private aimAngle: number = 0;

  constructor(_scene: Phaser.Scene, wsClient: WebSocketClient) {
    this.wsClient = wsClient;

    // Calculate fire rate cooldown in milliseconds
    this.fireCooldownMs = 1000 / WEAPON.PISTOL_FIRE_RATE;

    // Initialize weapon state with full ammo
    this.weaponState = {
      currentAmmo: WEAPON.PISTOL_MAGAZINE_SIZE,
      maxAmmo: WEAPON.PISTOL_MAGAZINE_SIZE,
      isReloading: false,
      canShoot: true,
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
    if (!this.canShoot()) {
      return false;
    }

    // Record shot time for cooldown
    this.lastShotTime = Date.now();

    // Send shoot message to server
    this.wsClient.send({
      type: 'player:shoot',
      timestamp: Date.now(),
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
      timestamp: Date.now(),
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
    const now = Date.now();
    if (now - this.lastShotTime < this.fireCooldownMs) {
      return false;
    }

    return true;
  }

  /**
   * Update weapon state from server
   */
  updateWeaponState(state: WeaponState): void {
    this.weaponState = { ...state };
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
   * Cleanup
   */
  destroy(): void {
    // No cleanup needed for now
  }
}
