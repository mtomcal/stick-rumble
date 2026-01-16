/**
 * UI Test Scene for visual regression testing
 * This scene renders UI components in isolation for screenshot comparison
 */

import Phaser from 'phaser';
import { HealthBarUI } from './game/ui/HealthBarUI';
import { KillFeedUI } from './game/ui/KillFeedUI';
import { MeleeWeapon } from './game/entities/MeleeWeapon';

export class UITestScene extends Phaser.Scene {
  private healthBar!: HealthBarUI;
  private killFeed!: KillFeedUI;
  private batWeapon!: MeleeWeapon;
  private katanaWeapon!: MeleeWeapon;

  constructor() {
    super({ key: 'UITestScene' });
  }

  create(): void {
    // Create a dark background for contrast
    this.add.rectangle(400, 300, 800, 600, 0x1a1a1a);

    // Initialize Health Bar at top-left
    this.healthBar = new HealthBarUI(this, 20, 20);
    // Initialize with 100% health to show the component
    this.healthBar.updateHealth(100, 100, false);

    // Initialize Kill Feed at top-right
    this.killFeed = new KillFeedUI(this, 780, 20);

    // Initialize Melee Weapons for visual testing (bottom section)
    // Bat on the left, Katana on the right
    this.batWeapon = new MeleeWeapon(this, 200, 450, 'bat');
    this.katanaWeapon = new MeleeWeapon(this, 600, 450, 'katana');

    // Add labels for weapon types
    this.add.text(200, 520, 'Bat', { color: '#ffffff', fontSize: '16px' }).setOrigin(0.5);
    this.add.text(600, 520, 'Katana', { color: '#ffffff', fontSize: '16px' }).setOrigin(0.5);

    // Define window interface for test controls
    interface WindowWithTestControls extends Window {
      setHealthBarState: (
        current: number,
        max: number,
        isRegenerating: boolean
      ) => void;
      addKillFeedEntry: (killer: string, victim: string) => void;
      triggerMeleeSwing: (weaponType: 'bat' | 'katana', aimAngle: number) => boolean;
      getMeleeWeaponState: (weaponType: 'bat' | 'katana') => { isSwinging: boolean; range: number; arcDegrees: number };
    }

    // Expose global functions for test control
    (window as unknown as WindowWithTestControls).setHealthBarState = (
      current: number,
      max: number,
      isRegenerating: boolean
    ) => {
      this.healthBar.updateHealth(current, max, isRegenerating);
    };

    (window as unknown as WindowWithTestControls).addKillFeedEntry = (
      killer: string,
      victim: string
    ) => {
      this.killFeed.addKill(killer, victim);
    };

    (window as unknown as WindowWithTestControls).triggerMeleeSwing = (
      weaponType: 'bat' | 'katana',
      aimAngle: number
    ) => {
      const weapon = weaponType === 'bat' ? this.batWeapon : this.katanaWeapon;
      return weapon.startSwing(aimAngle);
    };

    (window as unknown as WindowWithTestControls).getMeleeWeaponState = (
      weaponType: 'bat' | 'katana'
    ) => {
      const weapon = weaponType === 'bat' ? this.batWeapon : this.katanaWeapon;
      return {
        isSwinging: weapon.isSwinging(),
        range: weapon.getRange(),
        arcDegrees: weapon.getArcDegrees(),
      };
    };

    // Mark components as ready for testing
    this.markComponentReady('health-bar');
    this.markComponentReady('kill-feed');
    this.markComponentReady('melee-weapon');

    console.log('UI Test Scene initialized');
  }

  update(): void {
    // Update melee weapon animations
    this.batWeapon.update();
    this.katanaWeapon.update();
  }

  private markComponentReady(componentName: string): void {
    const readyMarker = document.querySelector(
      `[data-testid="${componentName}-ready"]`
    );
    const componentMarker = document.querySelector(
      `[data-testid="${componentName}"]`
    );

    if (readyMarker) {
      readyMarker.setAttribute('data-ready', 'true');
    }
    if (componentMarker) {
      componentMarker.setAttribute('data-ready', 'true');
    }
  }
}
