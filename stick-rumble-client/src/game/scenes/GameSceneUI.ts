import Phaser from 'phaser';
import type { ShootingManager } from '../input/ShootingManager';
import type { PlayerManager } from '../entities/PlayerManager';
import { Crosshair } from '../entities/Crosshair';
import { COLORS, MINIMAP, RELOAD_ARC } from '../../shared/constants';
import { getDefaultMatchMapContext } from '../../shared/maps';
import { HudFlexLayout, createHudLayoutItem, type HudLayoutItem } from '../ui/HudFlexLayout';
import type { GameplayViewportLayout } from '../../shared/types';

/**
 * GameSceneUI - Manages all UI elements for the game scene
 * Responsibility: UI rendering, updates, and visual feedback
 */
export class GameSceneUI {
  static readonly HUD_LAYOUT = {
    TOP_LEFT_PADDING_X: 20,
    TOP_LEFT_PADDING_Y: 20,
    TOP_LEFT_CLUSTER_GAP: 6,
    TOP_LEFT_CLUSTER_BG_ALPHA: 0.22,
    TOP_LEFT_TEXT_COLUMN_X: 28,
    MINIMAP_X: 20,
    MINIMAP_MARGIN_BOTTOM: 20,
    MOBILE_BOTTOM_CONTROL_RESERVE: 180,
  } as const;

  private scene: Phaser.Scene;
  private ammoText!: Phaser.GameObjects.Text;
  private ammoIcon: Phaser.GameObjects.Graphics | null = null;
  private matchTimerText: Phaser.GameObjects.Text | null = null;
  private ammoTextValue: string = 'PISTOL 15/15';
  private ammoRowX: number = 0;
  private ammoRowY: number = 0;
  private topLeftClusterLayout: HudFlexLayout | null = null;
  private topLeftClusterBackground: Phaser.GameObjects.Rectangle | null = null;

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
  private minimapX: number = GameSceneUI.HUD_LAYOUT.MINIMAP_X;
  private minimapY: number = 0;
  private minimapWorldWidth: number = getDefaultMatchMapContext().width;
  private minimapWorldHeight: number = getDefaultMatchMapContext().height;
  private viewportLayout: GameplayViewportLayout = {
    mode: 'desktop',
    width: 1280,
    height: 720,
    insets: { top: 0, right: 0, bottom: 0, left: 0 },
  };

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.minimapY = GameSceneUI.getDefaultMinimapY(this.scene.cameras.main.height);
    this.generateHitMarkerTexture();
    this.generateHitIndicatorTexture();
  }

  static getDefaultMinimapY(viewportHeight: number = 1080): number {
    return viewportHeight - MINIMAP.SIZE - GameSceneUI.HUD_LAYOUT.MINIMAP_MARGIN_BOTTOM;
  }

  static getDefaultDebugOverlayY(viewportHeight: number = 1080): number {
    return GameSceneUI.getDefaultMinimapY(viewportHeight) + MINIMAP.SIZE + 10;
  }

  setMinimapWorldSize(width: number, height: number): void {
    this.minimapWorldWidth = width;
    this.minimapWorldHeight = height;
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
    this.matchTimerText.setDepth(1000);
  }

  private damageFlashOverlay: Phaser.GameObjects.Rectangle | null = null;

  /**
   * Create damage flash overlay — full-viewport red rectangle, tweened to transparent.
   * Called once during scene creation.
   */
  createDamageFlashOverlay(width: number, height: number): void {
    this.damageFlashOverlay = this.scene.add.rectangle(width / 2, height / 2, width, height, COLORS.DAMAGE_FLASH);
    this.damageFlashOverlay.setScrollFactor(0);
    this.damageFlashOverlay.setDepth(999);
    this.damageFlashOverlay.setAlpha(0);
  }

  /**
   * Create ammo text display with icon and inline weapon label.
   */
  createAmmoDisplay(x: number, y: number): void {
    this.ammoRowX = x;
    this.ammoRowY = y;

    // Ammo icon (small bullet/crosshair graphic)
    this.ammoIcon = this.scene.add.graphics();
    this.ammoIcon.setScrollFactor(0);
    this.ammoIcon.setDepth(1000);
    this.drawAmmoIcon(COLORS.AMMO_READY);

    // Ammo row reads: [icon] [weapon label] [ammo count]
    this.ammoText = this.scene.add.text(x, y, this.ammoTextValue, {
      fontSize: '16px',
      color: `#${COLORS.AMMO_READY.toString(16).padStart(6, '0')}`
    });
    this.ammoText.setOrigin(0, 0.5);
    this.ammoText.setScrollFactor(0);
    this.ammoText.setDepth(1000);
    this.placeAmmoRow(this.ammoRowX, this.ammoRowY);
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
      } else {
        this.ammoText.setVisible(true);
        if (this.ammoIcon) this.ammoIcon.setVisible(true);
        const [current, max] = shootingManager.getAmmoInfo();
        const weaponLabel = shootingManager.getWeaponState().weaponType.toUpperCase();
        const ammoValue = max === 0 || max === Infinity ? 'INF' : `${current}/${max}`;

        this.ammoTextValue = `${weaponLabel} ${ammoValue}`;
        this.ammoText.setText(this.ammoTextValue);
        this.placeAmmoRow(this.ammoRowX, this.ammoRowY);
        this.applyTopLeftClusterLayout();

        // Color ammo text based on reload state
        const isReloading = shootingManager.isReloading();
        if (isReloading) {
          this.ammoText.setColor(`#${COLORS.AMMO_RELOADING.toString(16).padStart(6, '0')}`);
          this.drawAmmoIcon(COLORS.AMMO_RELOADING);
        } else {
          this.ammoText.setColor(`#${COLORS.AMMO_READY.toString(16).padStart(6, '0')}`);
          this.drawAmmoIcon(COLORS.AMMO_READY);
        }
      }

      const isReloading = shootingManager.isReloading();
      const isEmpty = shootingManager.isEmpty();

      if (this.reloadProgressBar && this.reloadProgressBarBg) {
        this.reloadProgressBar.setVisible(false);
        this.reloadProgressBarBg.setVisible(false);
      }

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

  layoutTopLeftCluster(healthRow: HudLayoutItem): void {
    if (!this.topLeftClusterBackground) {
      this.topLeftClusterBackground = this.scene.add.rectangle(0, 0, 0, 0, 0x000000, GameSceneUI.HUD_LAYOUT.TOP_LEFT_CLUSTER_BG_ALPHA);
      this.topLeftClusterBackground.setOrigin(0, 0);
      this.topLeftClusterBackground.setScrollFactor(0);
      this.topLeftClusterBackground.setDepth(999);
    }

    this.topLeftClusterLayout = new HudFlexLayout('column', GameSceneUI.HUD_LAYOUT.TOP_LEFT_CLUSTER_GAP, 'start');
    this.topLeftClusterLayout.add(healthRow);
    this.topLeftClusterLayout.add(this.getAmmoDisplayLayoutItem());
    this.applyTopLeftClusterLayout();
  }

  /**
   * Compatibility-only helper retained for tests and old call sites.
   * Gameplay no longer mounts the world-space reload bar.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  createReloadProgressBar(_x: number, _y: number, _width: number, _height: number): void {
    this.reloadProgressBarBg = this.scene.add.graphics();
    this.reloadProgressBarBg.setDepth(1000);
    this.reloadProgressBarBg.setVisible(false);

    this.reloadProgressBar = this.scene.add.graphics();
    this.reloadProgressBar.setDepth(1001);
    this.reloadProgressBar.setVisible(false);
  }

  /**
   * Compatibility-only helper retained for tests and old call sites.
   * Gameplay no longer mounts the world-space reload bar.
   */
  updateReloadProgress(progress: number, playerX: number, playerY: number, barWidth: number, barHeight: number): void {
    if (!this.reloadProgressBar || !this.reloadProgressBarBg) {
      return;
    }

    const barX = playerX - barWidth / 2;
    const barY = playerY - 30;

    this.reloadProgressBarBg.clear();
    this.reloadProgressBarBg.fillStyle(0x333333, 0.8);
    this.reloadProgressBarBg.fillRect(barX, barY, barWidth, barHeight);
    this.reloadProgressBarBg.setVisible(false);

    this.reloadProgressBar.clear();
    this.reloadProgressBar.fillStyle(0xffffff, 1.0);
    this.reloadProgressBar.fillRect(barX, barY, barWidth * progress, barHeight);
    this.reloadProgressBar.setVisible(false);
  }

  /**
   * Create world-space reload arc graphics object.
   * World-space (no scroll factor) so it follows the player.
   */
  createReloadCircleIndicator(): void {
    this.reloadCircle = this.scene.add.graphics();
    this.reloadCircle.setDepth(RELOAD_ARC.DEPTH);
    this.reloadCircle.setVisible(false);
  }

  /**
   * Update world-space reload arc centered on player body position.
   * @param progress Reload progress 0.0 to 1.0
   * @param playerX Player world X position
   * @param playerY Player world Y position
   */
  updateReloadCircle(progress: number, playerX: number = 0, playerY: number = 0): void {
    if (!this.reloadCircle) {
      return;
    }

    this.reloadCircle.clear();
    this.reloadCircle.lineStyle(RELOAD_ARC.STROKE, RELOAD_ARC.COLOR, 1.0);

    // Draw arc from top (-90° / 270°) clockwise proportional to reload progress
    const startAngle = Phaser.Math.DegToRad(RELOAD_ARC.START_ANGLE);
    const endAngle = startAngle + (progress * Math.PI * 2);

    this.reloadCircle.beginPath();
    this.reloadCircle.arc(playerX, playerY, RELOAD_ARC.RADIUS, startAngle, endAngle, false);
    this.reloadCircle.strokePath();
  }

  /**
   * Create crosshair system
   */
  createCrosshair(): void {
    this.crosshair = new Crosshair(this.scene);
  }

  /**
   * Update crosshair position each frame.
   * weaponType is used for melee visibility control.
   * The reticle is fixed-size — no bloom, no spread visualization.
   *
   * @param _isMoving - Unused (no dynamic sizing)
   * @param _spreadDegrees - Unused (no spread visualization)
   * @param weaponType - Current weapon type (for melee visibility)
   */
  updateCrosshair(_isMoving: boolean, _spreadDegrees: number, weaponType?: string): void {
    if (!this.crosshair) {
      return;
    }

    this.crosshair.update(weaponType ?? this.crosshair.getWeaponType());
  }

  /**
   * No-op: Crosshair bloom has been removed per spec.
   * The crosshair is a fixed-size reticle with no dynamic expansion.
   */
  triggerCrosshairBloom(): void {
    // Bloom removed — crosshair is fixed-size per spec
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
   * Show damage flash overlay when local player takes damage.
   * Red rectangle, alpha 0.35, tweens to 0 over 300ms.
   */
  showDamageFlash(): void {
    if (!this.damageFlashOverlay) return;
    this.damageFlashOverlay.setAlpha(0.35);
    this.scene.tweens.add({
      targets: this.damageFlashOverlay,
      alpha: 0,
      duration: 300,
    });
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

    // Determine variant: kill uses red 24px, normal/remote uses COLORS.DAMAGE_NUMBER 16px
    const fontSize = isKill ? '24px' : '16px';
    const color = isKill ? '#ff0000' : '#FF4444';

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

    // Animate: float up 40px and fade out over 600ms
    this.scene.tweens.add({
      targets: damageText,
      y: position.y - 70, // Move up 40 pixels (from y-30 to y-70)
      alpha: 0,
      duration: 600,
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
      indicator.setTint(COLORS.HIT_CHEVRON);
      indicator.setAlpha(0);
      this.scene.tweens.add({
        targets: indicator,
        alpha: 1,
        duration: 100,
        onComplete: () => {
          this.scene.tweens.add({
            targets: indicator,
            alpha: 1,
            duration: 300,
            onComplete: () => {
              this.scene.tweens.add({
                targets: indicator,
                alpha: 0,
                scale: 1.5,
                duration: 200,
                onComplete: () => indicator.destroy(),
              });
            },
          });
        },
      });
    } else {
      indicator.setTint(kill ? 0xff0000 : 0xffffff);
      indicator.setAlpha(0);
      this.scene.tweens.add({
        targets: indicator,
        alpha: 1,
        duration: 100,
        onComplete: () => {
          this.scene.tweens.add({
            targets: indicator,
            alpha: 1,
            duration: 300,
            onComplete: () => {
              this.scene.tweens.add({
                targets: indicator,
                alpha: 0,
                scale: 1.5,
                duration: 200,
                onComplete: () => indicator.destroy(),
              });
            },
          });
        },
      });
    }
  }

  /**
   * Set up the minimap static layer (background and border).
   * Called once during scene creation.
   */
  setupMinimap(): void {
    this.redrawMinimapFrame();
  }

  private redrawMinimapFrame(): void {
    const mapSize = MINIMAP.SIZE; // 170px

    this.minimapStaticGraphics?.clear();
    this.minimapDynamicGraphics?.clear();

    // Static layer — drawn once
    if (!this.minimapStaticGraphics) {
      this.minimapStaticGraphics = this.scene.add.graphics();
      this.minimapStaticGraphics.setScrollFactor(0);
      this.minimapStaticGraphics.setDepth(1999);
    }

    // Background — square, dark gray at 50% alpha
    this.minimapStaticGraphics.fillStyle(MINIMAP.BG_COLOR, 0.5);
    this.minimapStaticGraphics.fillRect(this.minimapX, this.minimapY, mapSize, mapSize);

    // Border — square, teal, 2px stroke
    this.minimapStaticGraphics.lineStyle(MINIMAP.BORDER_STROKE, MINIMAP.BORDER_COLOR, 1);
    this.minimapStaticGraphics.strokeRect(this.minimapX, this.minimapY, mapSize, mapSize);

    // Dynamic layer — cleared and redrawn each frame
    if (!this.minimapDynamicGraphics) {
      this.minimapDynamicGraphics = this.scene.add.graphics();
      this.minimapDynamicGraphics.setScrollFactor(0);
      this.minimapDynamicGraphics.setDepth(2000);
    }
  }

  /**
   * Update the minimap dynamic layer with current player positions.
   * Called every frame from GameScene.update().
   */
  updateMinimap(playerManager: PlayerManager): void {
    if (!this.minimapDynamicGraphics) return;

    const scale = MINIMAP.SIZE / Math.max(this.minimapWorldWidth, this.minimapWorldHeight);
    const mapX = this.minimapX;
    const mapY = this.minimapY;
    const mapSize = MINIMAP.SIZE;

    this.minimapDynamicGraphics.clear();

    const localPos = playerManager.getLocalPlayerPosition();
    if (!localPos) return;

    const localId = playerManager.getLocalPlayerId();
    const livingPlayers = playerManager.getLivingPlayers();

    /**
     * Clamp a world-space dot to stay within minimap bounds.
     */
    const clampToMinimap = (worldX: number, worldY: number): { x: number; y: number } => {
      const dotX = Math.min(Math.max(mapX + worldX * scale, mapX), mapX + mapSize);
      const dotY = Math.min(Math.max(mapY + worldY * scale, mapY), mapY + mapSize);
      return { x: dotX, y: dotY };
    };

    // Enemy dots (within radar range only, clamped to minimap bounds)
    for (const player of livingPlayers) {
      if (player.id === localId) continue;
      const dx = localPos.x - player.position.x;
      const dy = localPos.y - player.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= MINIMAP.RADAR_RANGE) {
        const pos = clampToMinimap(player.position.x, player.position.y);
        this.minimapDynamicGraphics.fillStyle(0xff0000, 1);
        this.minimapDynamicGraphics.fillCircle(pos.x, pos.y, 3);
      }
    }

    // Player dot (clamped to minimap bounds)
    const playerPos = clampToMinimap(localPos.x, localPos.y);
    this.minimapDynamicGraphics.fillStyle(0x00ff00, 1);
    this.minimapDynamicGraphics.fillCircle(playerPos.x, playerPos.y, 4);

    // Radar range ring (circle, centered on clamped player dot position)
    this.minimapDynamicGraphics.lineStyle(1, 0x00ff00, 0.15);
    this.minimapDynamicGraphics.strokeCircle(playerPos.x, playerPos.y, MINIMAP.RADAR_RANGE * scale);

    // Aim direction line
    const localAimAngle = playerManager.getPlayerAimAngle(localId ?? '');
    if (localAimAngle !== null) {
      this.minimapDynamicGraphics.lineStyle(1, 0x00ff00, 0.8);
      this.minimapDynamicGraphics.beginPath();
      this.minimapDynamicGraphics.moveTo(playerPos.x, playerPos.y);
      this.minimapDynamicGraphics.lineTo(
        playerPos.x + Math.cos(localAimAngle) * 10,
        playerPos.y + Math.sin(localAimAngle) * 10
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
    if (this.matchTimerText) {
      this.matchTimerText.destroy();
    }
    if (this.damageFlashOverlay) {
      this.damageFlashOverlay.destroy();
    }
    if (this.topLeftClusterBackground) {
      this.topLeftClusterBackground.destroy();
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
    if (this.minimapStaticGraphics) {
      this.minimapStaticGraphics.destroy();
    }
    if (this.minimapDynamicGraphics) {
      this.minimapDynamicGraphics.destroy();
    }
  }

  private getAmmoDisplayLayoutItem(): HudLayoutItem {
    return createHudLayoutItem(
      () => ({
        width: GameSceneUI.HUD_LAYOUT.TOP_LEFT_TEXT_COLUMN_X + this.measureAmmoTextWidth(),
        height: 18,
      }),
      (layoutX, layoutY) => {
        this.ammoRowX = layoutX;
        this.ammoRowY = layoutY;
        this.placeAmmoRow(layoutX, layoutY);
      }
    )
  }

  private measureAmmoTextWidth(): number {
    const liveWidth = (this.ammoText as { width?: number }).width;
    if (typeof liveWidth === 'number' && liveWidth > 0) {
      return liveWidth;
    }

    return this.ammoTextValue.length * 10;
  }

  private placeAmmoRow(x: number, y: number): void {
    this.ammoIcon?.setPosition(x, y + 3)
    this.ammoText.setPosition(x + GameSceneUI.HUD_LAYOUT.TOP_LEFT_TEXT_COLUMN_X, y + 9)
  }

  private applyTopLeftClusterLayout(): void {
    if (!this.topLeftClusterLayout || !this.topLeftClusterBackground) {
      return;
    }

    const topInset = GameSceneUI.HUD_LAYOUT.TOP_LEFT_PADDING_Y + this.viewportLayout.insets.top;
    const leftInset = GameSceneUI.HUD_LAYOUT.TOP_LEFT_PADDING_X + this.viewportLayout.insets.left;
    const clusterSize = this.topLeftClusterLayout.measure();
    this.topLeftClusterBackground.setPosition(
      leftInset,
      topInset
    );
    this.topLeftClusterBackground.setDisplaySize(clusterSize.width, clusterSize.height);
    this.topLeftClusterLayout.setPosition(
      leftInset,
      topInset
    );
  }

  setViewportLayout(layout: GameplayViewportLayout): void {
    this.viewportLayout = {
      mode: layout.mode,
      width: layout.width,
      height: layout.height,
      insets: { ...layout.insets },
    };

    const cameraWidth = layout.width;
    const cameraHeight = layout.height;
    const topInset = layout.insets.top;
    const leftInset = layout.insets.left;
    const bottomInset = layout.insets.bottom;

    this.applyTopLeftClusterLayout();

    if (this.matchTimerText) {
      this.matchTimerText.setPosition(cameraWidth / 2, 10 + topInset);
    }

    if (this.damageFlashOverlay) {
      this.damageFlashOverlay.setPosition(cameraWidth / 2, cameraHeight / 2);
      this.damageFlashOverlay.setDisplaySize(cameraWidth, cameraHeight);
    }

    const mobileReserve =
      layout.mode === 'mobile-landscape' ? GameSceneUI.HUD_LAYOUT.MOBILE_BOTTOM_CONTROL_RESERVE : 0;
    this.minimapX = GameSceneUI.HUD_LAYOUT.MINIMAP_X + leftInset;
    this.minimapY = Math.max(
      topInset + 120,
      cameraHeight - bottomInset - MINIMAP.SIZE - GameSceneUI.HUD_LAYOUT.MINIMAP_MARGIN_BOTTOM - mobileReserve
    );

    if (this.minimapStaticGraphics || this.minimapDynamicGraphics) {
      this.redrawMinimapFrame();
    }
  }
}
