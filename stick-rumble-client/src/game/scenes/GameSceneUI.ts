import Phaser from 'phaser';
import type { ShootingManager } from '../input/ShootingManager';
import type { PlayerManager } from '../entities/PlayerManager';
import { Crosshair } from '../entities/Crosshair';

/**
 * GameSceneUI - Manages all UI elements for the game scene
 * Responsibility: UI rendering, updates, and visual feedback
 */
export class GameSceneUI {
  private scene: Phaser.Scene;
  private ammoText!: Phaser.GameObjects.Text;
  private matchTimerText: Phaser.GameObjects.Text | null = null;

  /**
   * Check if scene is valid and active for rendering
   */
  private isSceneValid(): boolean {
    return this.scene && this.scene.sys && this.scene.sys.isActive();
  }
  private damageFlashOverlay: Phaser.GameObjects.Rectangle | null = null;
  private reloadProgressBar: Phaser.GameObjects.Graphics | null = null;
  private reloadProgressBarBg: Phaser.GameObjects.Graphics | null = null;
  private reloadIndicatorText: Phaser.GameObjects.Text | null = null;
  private reloadCircle: Phaser.GameObjects.Graphics | null = null;
  private crosshair: Crosshair | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Initialize UI elements (called during scene creation)
   */
  createMatchTimer(x: number, y: number): void {
    this.matchTimerText = this.scene.add.text(x, y, '7:00', {
      fontSize: '24px',
      color: '#ffffff',
      fontStyle: 'bold',
    });
    this.matchTimerText.setOrigin(0.5, 0);
    this.matchTimerText.setScrollFactor(0);
  }

  /**
   * Create damage flash overlay
   */
  createDamageFlashOverlay(width: number, height: number): void {
    this.damageFlashOverlay = this.scene.add.rectangle(
      width / 2,
      height / 2,
      width,
      height,
      0xff0000,
      0 // Fully transparent initially
    );
    this.damageFlashOverlay.setScrollFactor(0);
    this.damageFlashOverlay.setDepth(999);
  }

  /**
   * Create ammo text display
   */
  createAmmoDisplay(x: number, y: number): void {
    this.ammoText = this.scene.add.text(x, y, '15/15', {
      fontSize: '16px',
      color: '#ffffff'
    });
    this.ammoText.setScrollFactor(0);
  }

  /**
   * Update the ammo display text
   */
  updateAmmoDisplay(shootingManager: ShootingManager): void {
    if (this.ammoText && shootingManager) {
      const isMelee = shootingManager.isMeleeWeapon();

      // Hide ammo display for melee weapons, show for ranged
      if (isMelee) {
        this.ammoText.setVisible(false);
      } else {
        this.ammoText.setVisible(true);
        const [current, max] = shootingManager.getAmmoInfo();
        this.ammoText.setText(`${current}/${max}`);
      }

      // Show/hide reload UI elements based on state
      const isReloading = shootingManager.isReloading();
      const isEmpty = shootingManager.isEmpty();

      // Update reload progress bar visibility (hide for melee)
      if (this.reloadProgressBar && this.reloadProgressBarBg) {
        this.reloadProgressBar.setVisible(!isMelee && isReloading);
        this.reloadProgressBarBg.setVisible(!isMelee && isReloading);
      }

      // Update circular reload indicator visibility (hide for melee)
      if (this.reloadCircle) {
        this.reloadCircle.setVisible(!isMelee && isReloading);
      }

      // Show flashing "RELOAD!" indicator when empty (hide for melee)
      if (!isMelee && isEmpty && !isReloading) {
        this.showEmptyMagazineIndicator();
      } else {
        this.hideEmptyMagazineIndicator();
      }
    }
  }

  /**
   * Create reload progress bar HUD element
   */
  createReloadProgressBar(x: number, y: number, width: number, height: number): void {
    // Background bar
    this.reloadProgressBarBg = this.scene.add.graphics();
    this.reloadProgressBarBg.fillStyle(0x333333, 0.8);
    this.reloadProgressBarBg.fillRect(x, y, width, height);
    this.reloadProgressBarBg.setScrollFactor(0);
    this.reloadProgressBarBg.setDepth(1000);
    this.reloadProgressBarBg.setVisible(false);

    // Foreground progress bar
    this.reloadProgressBar = this.scene.add.graphics();
    this.reloadProgressBar.setScrollFactor(0);
    this.reloadProgressBar.setDepth(1001);
    this.reloadProgressBar.setVisible(false);
  }

  /**
   * Update reload progress bar fill amount (0 to 1)
   */
  updateReloadProgress(progress: number, barX: number, barY: number, barWidth: number, barHeight: number): void {
    if (!this.reloadProgressBar) {
      return;
    }

    this.reloadProgressBar.clear();
    this.reloadProgressBar.fillStyle(0x00ff00, 1.0);
    this.reloadProgressBar.fillRect(barX, barY, barWidth * progress, barHeight);
  }

  /**
   * Create circular reload indicator around crosshair
   */
  createReloadCircleIndicator(): void {
    this.reloadCircle = this.scene.add.graphics();
    this.reloadCircle.setScrollFactor(0);
    this.reloadCircle.setDepth(1002);
    this.reloadCircle.setVisible(false);
  }

  /**
   * Update circular reload indicator (0 to 1 progress)
   */
  updateReloadCircle(progress: number): void {
    if (!this.reloadCircle) {
      return;
    }

    const camera = this.scene.cameras.main;
    const centerX = camera.width / 2;
    const centerY = camera.height / 2;
    const radius = 20;

    this.reloadCircle.clear();
    this.reloadCircle.lineStyle(3, 0x00ff00, 1.0);

    // Draw arc from top (270 degrees) clockwise based on progress
    const startAngle = Phaser.Math.DegToRad(270);
    const endAngle = startAngle + Phaser.Math.DegToRad(360 * progress);

    this.reloadCircle.beginPath();
    this.reloadCircle.arc(centerX, centerY, radius, startAngle, endAngle, false);
    this.reloadCircle.strokePath();
  }

  /**
   * Create crosshair system
   */
  createCrosshair(): void {
    this.crosshair = new Crosshair(this.scene);
  }

  /**
   * Update crosshair position and spread
   * @param isMoving - Whether the player is currently moving
   * @param spreadDegrees - Current weapon spread in degrees
   * @param weaponType - Current weapon type (optional)
   */
  updateCrosshair(isMoving: boolean, spreadDegrees: number, weaponType?: string): void {
    if (!this.crosshair) {
      return;
    }

    if (weaponType) {
      this.crosshair.setWeaponType(weaponType);
    }

    this.crosshair.update(isMoving, spreadDegrees);
  }

  /**
   * Set crosshair spectating mode
   * Safe to call even if crosshair not created yet
   */
  setCrosshairSpectating(isSpectating: boolean): void {
    if (this.crosshair) {
      this.crosshair.setSpectating(isSpectating);
    }
  }

  /**
   * Show flashing "RELOAD!" indicator when magazine is empty
   */
  private showEmptyMagazineIndicator(): void {
    if (!this.reloadIndicatorText) {
      const camera = this.scene.cameras.main;
      this.reloadIndicatorText = this.scene.add.text(
        camera.width / 2,
        camera.height / 2 + 60,
        'RELOAD!',
        {
          fontSize: '32px',
          color: '#ff0000',
          fontStyle: 'bold',
          stroke: '#000000',
          strokeThickness: 4,
        }
      );
      this.reloadIndicatorText.setOrigin(0.5);
      this.reloadIndicatorText.setScrollFactor(0);
      this.reloadIndicatorText.setDepth(1003);

      // Flashing animation
      this.scene.tweens.add({
        targets: this.reloadIndicatorText,
        alpha: { from: 1, to: 0.3 },
        duration: 500,
        yoyo: true,
        repeat: -1,
      });
    }
    this.reloadIndicatorText.setVisible(true);
  }

  /**
   * Hide "RELOAD!" indicator
   */
  private hideEmptyMagazineIndicator(): void {
    if (this.reloadIndicatorText) {
      this.reloadIndicatorText.setVisible(false);
    }
  }

  /**
   * Update the match timer display with formatted time (MM:SS)
   */
  updateMatchTimer(remainingSeconds: number): void {
    // Skip if scene is not active (destroyed or transitioning)
    if (!this.isSceneValid() || !this.matchTimerText) {
      return;
    }

    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    const formattedTime = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    this.matchTimerText.setText(formattedTime);

    // Change color when time is running out (< 60 seconds)
    if (remainingSeconds < 60) {
      this.matchTimerText.setColor('#ff0000'); // Red
    } else if (remainingSeconds < 120) {
      this.matchTimerText.setColor('#ffff00'); // Yellow
    } else {
      this.matchTimerText.setColor('#ffffff'); // White
    }
  }

  /**
   * Show red screen flash when local player takes damage
   */
  showDamageFlash(): void {
    if (!this.damageFlashOverlay) {
      return;
    }

    // Reset alpha to 50% opacity
    this.damageFlashOverlay.setAlpha(0.5);

    // Fade out over 200ms
    this.scene.tweens.add({
      targets: this.damageFlashOverlay,
      alpha: 0,
      duration: 200,
      ease: 'Linear',
    });
  }

  /**
   * Show hit marker (crosshair confirmation) at screen center
   */
  showHitMarker(): void {
    const camera = this.scene.cameras.main;
    const centerX = camera.scrollX + camera.width / 2;
    const centerY = camera.scrollY + camera.height / 2;
    const lineLength = 15;
    const gap = 10; // Gap from center

    // Create 4 lines forming a crosshair (top, bottom, left, right)
    const lines = [
      // Top line
      this.scene.add.line(
        0, 0,
        centerX, centerY - gap,
        centerX, centerY - gap - lineLength,
        0xffffff
      ),
      // Bottom line
      this.scene.add.line(
        0, 0,
        centerX, centerY + gap,
        centerX, centerY + gap + lineLength,
        0xffffff
      ),
      // Left line
      this.scene.add.line(
        0, 0,
        centerX - gap, centerY,
        centerX - gap - lineLength, centerY,
        0xffffff
      ),
      // Right line
      this.scene.add.line(
        0, 0,
        centerX + gap, centerY,
        centerX + gap + lineLength, centerY,
        0xffffff
      ),
    ];

    // Set high depth so crosshair appears above everything
    lines.forEach(line => {
      line.setDepth(1001);
      line.setLineWidth(3);
    });

    // Animate: expand slightly and fade out, then clean up
    this.scene.tweens.add({
      targets: lines,
      alpha: 0,
      duration: 200,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        // Clean up lines after animation
        lines.forEach(line => line.destroy());
      },
    });
  }

  /**
   * Show floating damage number above damaged player
   */
  showDamageNumber(playerManager: PlayerManager, victimId: string, damage: number): void {
    const position = playerManager.getPlayerPosition(victimId);
    if (!position) {
      return; // Player not found or already removed
    }

    // Create damage number text
    const damageText = this.scene.add.text(
      position.x,
      position.y - 30, // Above player
      `-${damage}`,
      {
        fontSize: '24px',
        color: '#ff0000',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 3,
      }
    );
    damageText.setOrigin(0.5);

    // Animate: float up and fade out
    this.scene.tweens.add({
      targets: damageText,
      y: position.y - 80, // Move up 50 pixels
      alpha: 0, // Fade to transparent
      duration: 1000, // 1 second
      ease: 'Cubic.easeOut',
      onComplete: () => {
        damageText.destroy(); // Clean up after animation
      },
    });
  }

  /**
   * Cleanup all resources
   */
  destroy(): void {
    // Destroy UI elements if they exist
    if (this.ammoText) {
      this.ammoText.destroy();
    }
    if (this.matchTimerText) {
      this.matchTimerText.destroy();
    }
    if (this.damageFlashOverlay) {
      this.damageFlashOverlay.destroy();
    }
    if (this.reloadProgressBar) {
      this.reloadProgressBar.destroy();
    }
    if (this.reloadProgressBarBg) {
      this.reloadProgressBarBg.destroy();
    }
    if (this.reloadIndicatorText) {
      this.reloadIndicatorText.destroy();
    }
    if (this.reloadCircle) {
      this.reloadCircle.destroy();
    }
    if (this.crosshair) {
      this.crosshair.destroy();
    }
  }
}
