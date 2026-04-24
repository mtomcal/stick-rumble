import type Phaser from 'phaser';
import { COLORS } from '../../shared/constants';
import { HudFlexLayout, createHudLayoutItem, type HudLayoutItem, type HudLayoutSize } from './HudFlexLayout';

/**
 * HealthBarUI displays the player's current health in the top-left corner
 * Features:
 * - Green bar for health >= 20% (COLORS.HEALTH_FULL)
 * - Red bar for health < 20% (COLORS.HEALTH_CRITICAL)
 * - "N%" format text display
 * - EKG heartbeat icon to the left of the bar
 * - Real-time health updates
 * - Fixed to screen (doesn't scroll with camera)
 */
export class HealthBarUI implements HudLayoutItem {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private healthBar: Phaser.GameObjects.Rectangle;
  private healthText: Phaser.GameObjects.Text;
  private ekgIcon: Phaser.GameObjects.Graphics;
  private readonly healthRowLayout = new HudFlexLayout('row', 4, 'center');
  private readonly BAR_WIDTH = 200;
  private readonly BAR_HEIGHT = 30;
  private readonly BAR_BORDER = 2;
  private readonly EKG_SLOT_WIDTH = 24;
  private readonly EKG_SLOT_HEIGHT = 30;
  private readonly HEALTH_ROW_HEIGHT = this.BAR_HEIGHT + this.BAR_BORDER * 2;
  private healthTextValue: string = '100%';
  private isRegenerating: boolean = false;
  private pulseTween: Phaser.Tweens.Tween | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;
    // Create container for health bar components
    this.container = scene.add.container(x, y);

    // Add background (black with opacity)
    const background = scene.add.rectangle(
      0,
      0,
      this.BAR_WIDTH + this.BAR_BORDER * 2,
      this.BAR_HEIGHT + this.BAR_BORDER * 2,
      0x000000,
      0.7
    );
    background.setOrigin(0, 0);

    // Add health bar (green by default)
    this.healthBar = scene.add.rectangle(
      this.BAR_BORDER,
      this.BAR_BORDER,
      this.BAR_WIDTH,
      this.BAR_HEIGHT,
      COLORS.HEALTH_FULL
    );
    this.healthBar.setOrigin(0, 0);

    // Add EKG heartbeat icon to the left of the bar
    this.ekgIcon = scene.add.graphics();
    this.drawEKGIcon();

    // Add health text (percentage format)
    this.healthText = scene.add.text(0, 0, this.healthTextValue, {
      fontSize: '18px',
      color: '#ffffff',
      fontStyle: 'bold',
    });
    this.healthText.setOrigin(0, 0.5);

    // Add components to container
    this.container.add([background, this.healthBar, this.ekgIcon, this.healthText]);
    this.healthRowLayout.add(
      createHudLayoutItem(
        { width: this.EKG_SLOT_WIDTH, height: this.EKG_SLOT_HEIGHT },
        (layoutX, layoutY) => this.ekgIcon.setPosition(layoutX, layoutY)
      )
    );
    this.healthRowLayout.add(
      createHudLayoutItem(
        { width: this.BAR_WIDTH + this.BAR_BORDER * 2, height: this.HEALTH_ROW_HEIGHT },
        (layoutX, layoutY) => {
          background.setPosition(layoutX, layoutY);
          this.healthBar.setPosition(layoutX + this.BAR_BORDER, layoutY + this.BAR_BORDER);
        }
      )
    );
    this.healthRowLayout.add(
      createHudLayoutItem(
        () => ({ width: this.measureHealthTextWidth(), height: this.HEALTH_ROW_HEIGHT }),
        (layoutX, layoutY) => this.healthText.setPosition(layoutX, layoutY + this.HEALTH_ROW_HEIGHT / 2)
      )
    );
    this.healthRowLayout.setPosition(0, 0);

    // Make health bar fixed to screen (doesn't scroll with camera)
    this.container.setScrollFactor(0);

    // Set high depth so it's always on top
    this.container.setDepth(1000);
  }

  /**
   * Draw EKG heartbeat icon graphic to the left of the bar
   */
  private drawEKGIcon(): void {
    this.ekgIcon.clear();
    this.ekgIcon.lineStyle(2, COLORS.HEALTH_FULL, 1);
    this.ekgIcon.beginPath();
    this.ekgIcon.moveTo(0, 15);
    this.ekgIcon.lineTo(6, 15);
    this.ekgIcon.lineTo(9, 6);
    this.ekgIcon.lineTo(12, 24);
    this.ekgIcon.lineTo(15, 3);
    this.ekgIcon.lineTo(18, 15);
    this.ekgIcon.lineTo(24, 15);
    this.ekgIcon.strokePath();
  }

  /**
   * Update the health bar display
   * @param currentHealth Current health value
   * @param maxHealth Maximum health value
   * @param isRegenerating Whether health is currently regenerating
   */
  updateHealth(currentHealth: number, maxHealth: number, isRegenerating: boolean = false): void {
    // Clamp health values
    const health = Math.max(0, Math.min(currentHealth, maxHealth));
    const ratio = maxHealth > 0 ? health / maxHealth : 0;

    // Update bar width
    const barWidth = this.BAR_WIDTH * ratio;
    this.healthBar.setDisplaySize(barWidth, this.BAR_HEIGHT);

    // 2-tier color logic: green >= 20%, red < 20%
    if (ratio >= 0.2) {
      this.healthBar.fillColor = COLORS.HEALTH_FULL; // Green
    } else {
      this.healthBar.fillColor = COLORS.HEALTH_CRITICAL; // Red
    }

    // Update text in percentage format
    this.healthTextValue = `${Math.round(ratio * 100)}%`;
    this.healthText.setText(this.healthTextValue);
    this.healthRowLayout.setPosition(0, 0);

    // Handle regeneration visual feedback
    if (isRegenerating && !this.isRegenerating) {
      // Start regeneration animation
      this.startRegenerationEffect();
    } else if (!isRegenerating && this.isRegenerating) {
      // Stop regeneration animation
      this.stopRegenerationEffect();
    }

    this.isRegenerating = isRegenerating;
  }

  /**
   * Start pulsing animation to indicate health regeneration
   * Note: This method is only called when transitioning from not regenerating to regenerating,
   * so pulseTween should always be null. The guard at updateHealth() prevents duplicate calls.
   */
  private startRegenerationEffect(): void {
    // Create pulsing alpha effect (0.6 to 1.0 and back)
    this.pulseTween = this.scene.tweens.add({
      targets: this.healthBar,
      alpha: 0.6,
      duration: 500,
      yoyo: true,
      repeat: -1, // Infinite repeat
      ease: 'Sine.easeInOut',
    });
  }

  /**
   * Stop the regeneration animation
   */
  private stopRegenerationEffect(): void {
    if (this.pulseTween) {
      this.pulseTween.stop();
      this.pulseTween = null;
    }
    // Reset alpha to full opacity
    this.healthBar.setAlpha(1.0);
  }

  /**
   * Cleanup all resources
   */
  destroy(): void {
    // Stop any active regeneration effect
    this.stopRegenerationEffect();

    // Destroy container (automatically destroys all children)
    this.container.destroy();
  }

  setPosition(x: number, y: number): void {
    this.container.setPosition(x, y);
  }

  setScale(scale: number): void {
    this.container.setScale(scale);
  }

  measure(): HudLayoutSize {
    return this.healthRowLayout.measure();
  }

  private measureHealthTextWidth(): number {
    const liveWidth = (this.healthText as { width?: number }).width;
    if (typeof liveWidth === 'number' && liveWidth > 0) {
      return liveWidth;
    }

    return this.healthTextValue.length * 12;
  }
}
