/**
 * UI Test Scene for visual regression testing
 * This scene renders UI components in isolation for screenshot comparison
 */

import Phaser from 'phaser';
import { HealthBarUI } from './game/ui/HealthBarUI';
import { KillFeedUI } from './game/ui/KillFeedUI';

export class UITestScene extends Phaser.Scene {
  private healthBar!: HealthBarUI;
  private killFeed!: KillFeedUI;

  constructor() {
    super({ key: 'UITestScene' });
  }

  create(): void {
    // Create a dark background for contrast
    this.add.rectangle(400, 300, 800, 600, 0x1a1a1a);

    // Initialize Health Bar at top-left
    this.healthBar = new HealthBarUI(this, 20, 20);

    // Initialize Kill Feed at top-right
    this.killFeed = new KillFeedUI(this, 780, 20);

    // Define window interface for test controls
    interface WindowWithTestControls extends Window {
      setHealthBarState: (
        current: number,
        max: number,
        isRegenerating: boolean
      ) => void;
      addKillFeedEntry: (killer: string, victim: string) => void;
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

    // Mark components as ready for testing
    this.markComponentReady('health-bar');
    this.markComponentReady('kill-feed');

    console.log('UI Test Scene initialized');
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
