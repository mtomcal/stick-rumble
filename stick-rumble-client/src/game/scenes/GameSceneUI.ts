import Phaser from 'phaser';
import type { ShootingManager } from '../input/ShootingManager';
import type { PlayerManager } from '../entities/PlayerManager';
import { Crosshair } from '../entities/Crosshair';
import { COLORS } from '../../shared/constants';

/**
 * GameSceneUI - Manages all UI elements for the game scene
 * Responsibility: UI rendering, updates, and visual feedback
 */
export class GameSceneUI {
  private scene: Phaser.Scene;
  private ammoText!: Phaser.GameObjects.Text;
  private ammoIcon: Phaser.GameObjects.Graphics | null = null;
  private reloadingText: Phaser.GameObjects.Text | null = null;
  private matchTimerText: Phaser.GameObjects.Text | null = null;

  /**
   * Check if scene is valid and active for rendering
   */
  private isSceneValid(): boolean {
    return this.scene && this.scene.sys && this.scene.sys.isActive();
  }
  private reloadProgressBar: Phaser.GameObjects.Graphics | null = null;
  private reloadProgressBarBg: Phaser.GameObjects.Graphics | null = null;
  private reloadIndicatorText: Phaser.GameObjects.Text | null = null;
  private reloadCircle: Phaser.GameObjects.Graphics | null = null;
  private crosshair: Crosshair | null = null;
  private minimapStaticGraphics: Phaser.GameObjects.Graphics | null = null;
  private minimapDynamicGraphics: Phaser.GameObjects.Graphics | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.generateHitMarkerTexture();
    this.generateHitIndicatorTexture();
  }

  /**
   * Generate the hitmarker X texture (20x20, white X, 3px stroke).
   * Called once during construction.
   */
  private generateHitMarkerTexture(): void {
    const gfx = this.scene.make.graphics({ x: 0, y: 0 }, false);
    gfx.lineStyle(3, 0xffffff, 1);
    gfx.beginPath();
    gfx.moveTo(2, 2); gfx.lineTo(18, 18);
    gfx.moveTo(18, 2); gfx.lineTo(2, 18);
    gfx.strokePath();
    gfx.generateTexture('hitmarker', 20, 20);
    gfx.destroy();
  }

  /**
   * Generate the hit indicator chevron texture (16x16, white filled chevron).
   * Called once during construction.
   */
  private generateHitIndicatorTexture(): void {
    const gfx = this.scene.make.graphics({ x: 0, y: 0 }, false);
    gfx.fillStyle(0xffffff, 1);
    gfx.beginPath();
    gfx.moveTo(0, 0);
    gfx.lineTo(16, 8);
    gfx.lineTo(0, 16);
    gfx.lineTo(4, 8);
    gfx.closePath();
    gfx.fillPath();
    gfx.generateTexture('hit_indicator', 16, 16);
    gfx.destroy();
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
   * Create damage flash overlay — no-op, kept for backward compatibility.
   * Damage flash now uses cameras.main.flash() directly.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  createDamageFlashOverlay(_width: number, _height: number): void {
    // No overlay needed — showDamageFlash() uses cameras.main.flash()
  }

  /**
   * Create ammo text display with icon and reloading text
   */
  createAmmoDisplay(x: number, y: number): void {
    // Ammo icon (small bullet/crosshair graphic)
    this.ammoIcon = this.scene.add.graphics();
    this.ammoIcon.setScrollFactor(0);
    this.ammoIcon.setDepth(1000);
    this.drawAmmoIcon(COLORS.AMMO_READY);

    // Ammo count text
    this.ammoText = this.scene.add.text(x, y, '15/15', {
      fontSize: '16px',
      color: `#${COLORS.AMMO_READY.toString(16).padStart(6, '0')}`
    });
    this.ammoText.setScrollFactor(0);
    this.ammoText.setDepth(1000);

    // "RELOADING..." text shown during reload
    this.reloadingText = this.scene.add.text(x + 60, y, 'RELOADING...', {
      fontSize: '16px',
      color: `#${COLORS.AMMO_RELOADING.toString(16).padStart(6, '0')}`
    });
    this.reloadingText.setScrollFactor(0);
    this.reloadingText.setDepth(1000);
    this.reloadingText.setVisible(false);
  }

  /**
   * Draw ammo icon using given color
   */
  private drawAmmoIcon(color: number): void {
    if (!this.ammoIcon) return;
    this.ammoIcon.clear();
    this.ammoIcon.fillStyle(color);
    this.ammoIcon.fillRect(0, 0, 8, 8);
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
        if (this.ammoIcon) this.ammoIcon.setVisible(false);
        if (this.reloadingText) this.reloadingText.setVisible(false);
      } else {
        this.ammoText.setVisible(true);
        if (this.ammoIcon) this.ammoIcon.setVisible(true);
        const [current, max] = shootingManager.getAmmoInfo();

        // Show "INF" for fist/infinite-ammo weapons (max === 0 or Infinity)
        if (max === 0 || max === Infinity) {
          this.ammoText.setText('INF');
        } else {
          this.ammoText.setText(`${current}/${max}`);
        }

        // Color ammo text based on reload state
        const isReloading = shootingManager.isReloading();
        if (isReloading) {
          this.ammoText.setColor(`#${COLORS.AMMO_RELOADING.toString(16).padStart(6, '0')}`);
          this.drawAmmoIcon(COLORS.AMMO_RELOADING);
          if (this.reloadingText) this.reloadingText.setVisible(true);
        } else {
          this.ammoText.setColor(`#${COLORS.AMMO_READY.toString(16).padStart(6, '0')}`);
          this.drawAmmoIcon(COLORS.AMMO_READY);
          if (this.reloadingText) this.reloadingText.setVisible(false);
        }
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
   * Trigger crosshair bloom animation when local player fires
   */
  triggerCrosshairBloom(): void {
    if (this.crosshair) {
      this.crosshair.triggerBloom();
    }
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
   * Show camera flash when local player takes damage.
   * Uses native Phaser camera flash — 100ms, RGB(128, 0, 0).
   */
  showDamageFlash(): void {
    this.scene.cameras.main.flash(100, 128, 0, 0);
  }

  /**
   * Trigger camera shake when local player deals damage.
   * Uses native Phaser camera shake — 50ms, intensity 0.001.
   */
  showCameraShake(): void {
    this.scene.cameras.main.shake(50, 0.001);
  }

  /**
   * Show hit marker at reticle/pointer position.
   * Uses pre-generated 20x20 X texture with normal and kill variants.
   * @param kill - Whether this is a kill confirmation (red, 2x scale)
   */
  showHitMarker(kill: boolean = false): void {
    const pointer = this.scene.input?.activePointer;
    if (!pointer) {
      return;
    }

    // World coordinates from pointer
    const worldX = pointer.worldX ?? (pointer.x + this.scene.cameras.main.scrollX);
    const worldY = pointer.worldY ?? (pointer.y + this.scene.cameras.main.scrollY);

    const marker = this.scene.add.sprite(worldX, worldY, 'hitmarker');
    marker.setDepth(1000);

    if (kill) {
      marker.setTint(0xff0000);
      marker.setScale(2.0);
    } else {
      marker.setTint(0xffffff);
      marker.setScale(1.2);
    }

    this.scene.tweens.add({
      targets: marker,
      alpha: 0,
      scale: marker.scale * 0.5,
      duration: 150,
      onComplete: () => marker.destroy(),
    });
  }

  /**
   * Show floating damage number above damaged player.
   * Variants: normal (white 16px), kill (red 24px), remote (white 16px, scale 0.7, alpha 0.8).
   * @param playerManager - Player manager to get victim position
   * @param victimId - ID of damaged player
   * @param damage - Amount of damage dealt
   * @param isKill - Whether this damage was a killing blow
   * @param isLocal - Whether the local player dealt this damage
   */
  showDamageNumber(playerManager: PlayerManager, victimId: string, damage: number, isKill: boolean = false, isLocal: boolean = true): void {
    const position = playerManager.getPlayerPosition(victimId);
    if (!position) {
      return; // Player not found or already removed
    }

    // Determine variant: kill uses red 24px, normal/remote uses white 16px
    const fontSize = isKill ? '24px' : '16px';
    const color = isKill ? '#ff0000' : '#ffffff';

    // Create damage number text
    const damageText = this.scene.add.text(
      position.x,
      position.y - 30, // Above player
      `-${damage}`,
      {
        fontSize,
        color,
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 2,
      }
    );
    damageText.setOrigin(0.5);
    damageText.setDepth(1000);

    // Remote variant: smaller and more transparent
    if (!isLocal) {
      damageText.setScale(0.7);
      damageText.setAlpha(0.8);
    }

    // Animate: float up 50px and fade out over 800ms
    this.scene.tweens.add({
      targets: damageText,
      y: position.y - 80, // Move up 50 pixels (from y-30 to y-80)
      alpha: 0,
      duration: 800,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        damageText.destroy();
      },
    });
  }

  /**
   * Show directional hit indicator (chevron) pointing from player toward target/source.
   * @param playerX - Local player X position
   * @param playerY - Local player Y position
   * @param targetX - Target/source X position
   * @param targetY - Target/source Y position
   * @param type - 'outgoing' (dealing damage) or 'incoming' (taking damage)
   * @param kill - Whether this was a killing blow (only affects outgoing color)
   */
  showHitIndicator(playerX: number, playerY: number, targetX: number, targetY: number, type: 'outgoing' | 'incoming', kill: boolean = false): void {
    const angle = Math.atan2(targetY - playerY, targetX - playerX);
    const ix = playerX + Math.cos(angle) * 60;
    const iy = playerY + Math.sin(angle) * 60;

    const indicator = this.scene.add.sprite(ix, iy, 'hit_indicator');
    indicator.setDepth(1001);
    indicator.setRotation(angle);

    if (type === 'incoming') {
      indicator.setTint(0xff0000);
      this.scene.tweens.add({
        targets: indicator,
        alpha: 0,
        scale: 1.5,
        duration: 400,
        onComplete: () => indicator.destroy(),
      });
    } else {
      indicator.setTint(kill ? 0xff0000 : 0xffffff);
      this.scene.tweens.add({
        targets: indicator,
        alpha: 0,
        scale: 1.5,
        duration: 200,
        onComplete: () => indicator.destroy(),
      });
    }
  }

  /**
   * Set up the minimap static layer (background and border).
   * Called once during scene creation.
   */
  setupMinimap(): void {
    const scale = 0.075;
    const mapX = 20;
    const mapY = 20;
    const mapSize = 1600 * scale; // 120px

    // Static layer — drawn once
    this.minimapStaticGraphics = this.scene.add.graphics();
    this.minimapStaticGraphics.setScrollFactor(0);
    this.minimapStaticGraphics.setDepth(1999);

    // Background
    this.minimapStaticGraphics.fillStyle(0x000000, 0.7);
    this.minimapStaticGraphics.fillRect(mapX, mapY, mapSize, mapSize);

    // Border
    this.minimapStaticGraphics.lineStyle(2, 0xffffff, 0.5);
    this.minimapStaticGraphics.strokeRect(mapX, mapY, mapSize, mapSize);

    // Dynamic layer — cleared and redrawn each frame
    this.minimapDynamicGraphics = this.scene.add.graphics();
    this.minimapDynamicGraphics.setScrollFactor(0);
    this.minimapDynamicGraphics.setDepth(2000);
  }

  /**
   * Update the minimap dynamic layer with current player positions.
   * Called every frame from GameScene.update().
   */
  updateMinimap(playerManager: PlayerManager): void {
    if (!this.minimapDynamicGraphics) return;

    const scale = 0.075;
    const mapX = 20;
    const mapY = 20;

    this.minimapDynamicGraphics.clear();

    const localPos = playerManager.getLocalPlayerPosition();
    if (!localPos) return;

    const localId = playerManager.getLocalPlayerId();
    const livingPlayers = playerManager.getLivingPlayers();

    // Enemy dots (within radar range only)
    for (const player of livingPlayers) {
      if (player.id === localId) continue;
      const dx = localPos.x - player.position.x;
      const dy = localPos.y - player.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= 600) {
        this.minimapDynamicGraphics.fillStyle(0xff0000, 1);
        this.minimapDynamicGraphics.fillCircle(
          mapX + player.position.x * scale,
          mapY + player.position.y * scale,
          3
        );
      }
    }

    // Player dot
    this.minimapDynamicGraphics.fillStyle(0x00ff00, 1);
    this.minimapDynamicGraphics.fillCircle(
      mapX + localPos.x * scale,
      mapY + localPos.y * scale,
      4
    );

    // Radar range ring
    this.minimapDynamicGraphics.lineStyle(1, 0x00ff00, 0.15);
    this.minimapDynamicGraphics.strokeCircle(
      mapX + localPos.x * scale,
      mapY + localPos.y * scale,
      600 * scale
    );

    // Aim direction line
    const localAimAngle = playerManager.getPlayerAimAngle(localId ?? '');
    if (localAimAngle !== null) {
      this.minimapDynamicGraphics.lineStyle(1, 0x00ff00, 0.8);
      this.minimapDynamicGraphics.beginPath();
      this.minimapDynamicGraphics.moveTo(
        mapX + localPos.x * scale,
        mapY + localPos.y * scale
      );
      this.minimapDynamicGraphics.lineTo(
        mapX + localPos.x * scale + Math.cos(localAimAngle) * 10,
        mapY + localPos.y * scale + Math.sin(localAimAngle) * 10
      );
      this.minimapDynamicGraphics.strokePath();
    }
  }

  /**
   * Show wall spark effect when barrel is obstructed by wall geometry.
   * Yellow circle that scales up and fades out.
   */
  showWallSpark(x: number, y: number): void {
    const spark = this.scene.add.circle(x, y, 3, 0xffff00);
    this.scene.tweens.add({
      targets: spark,
      alpha: 0,
      scale: 2,
      duration: 100,
      onComplete: () => spark.destroy(),
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
    if (this.ammoIcon) {
      this.ammoIcon.destroy();
    }
    if (this.reloadingText) {
      this.reloadingText.destroy();
    }
    if (this.matchTimerText) {
      this.matchTimerText.destroy();
    }
    // damageFlashOverlay removed — flash is now a camera effect (no game object to destroy)
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
    if (this.minimapStaticGraphics) {
      this.minimapStaticGraphics.destroy();
    }
    if (this.minimapDynamicGraphics) {
      this.minimapDynamicGraphics.destroy();
    }
  }
}
