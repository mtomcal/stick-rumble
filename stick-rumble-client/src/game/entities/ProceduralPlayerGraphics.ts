import Phaser from 'phaser';
import { COLORS, PLAYER } from '../../shared/constants';

export interface CanonicalPlayerBodyBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

export function getCanonicalPlayerBodyBounds(centerX: number, centerY: number): CanonicalPlayerBodyBounds {
  const halfWidth = PLAYER.WIDTH / 2;
  const halfHeight = PLAYER.HEIGHT / 2;
  return {
    left: centerX - halfWidth,
    right: centerX + halfWidth,
    top: centerY - halfHeight,
    bottom: centerY + halfHeight,
    width: PLAYER.WIDTH,
    height: PLAYER.HEIGHT,
    centerX,
    centerY,
  };
}

/**
 * ProceduralPlayerGraphics renders stick figure characters using procedural graphics
 * following the prototype pattern from StickFigure.ts (lines 297-388)
 *
 * Features:
 * - Stick figure with head, arms, legs
 * - Walk cycle animation using sine waves
 * - Color customization (separate head and body colors)
 * - Rotation support for direction
 * - "YOU" / name label above player head
 * - Spawn invulnerability ring rendering
 */
export class ProceduralPlayerGraphics {
  private static readonly BODY_OUTLINE_ALPHA = 0.3;
  private static readonly BODY_OUTLINE_WIDTH = 1;
  private scene: Phaser.Scene;
  private graphics: Phaser.GameObjects.Graphics;
  private x: number;
  private y: number;
  private rotation: number = 0;
  private aimAngle: number | null = null;
  private headColor: number;
  private bodyColor: number;
  private walkCycle: number = 0;
  private isInvulnerable: boolean = false;
  private nameLabel: Phaser.GameObjects.Text | null = null;

  // Head radius (used for label positioning)
  private static readonly HEAD_RADIUS = 13;

  private static readonly WEAPON_GRIP_OFFSET = 12;
  private static readonly HAND_SPREAD = 3;
  private static readonly BARREL_X = 20;

  // Animation constants (from prototype)
  private static readonly WALK_SPEED_FACTOR = 0.02;

  constructor(scene: Phaser.Scene, x: number, y: number, headColor: number, bodyColor: number = 0x000000) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.headColor = headColor;
    this.bodyColor = bodyColor;

    // Create graphics object
    this.graphics = scene.add.graphics();
    this.graphics.setDepth(50); // Render below UI but above background
    this.graphics.x = Math.round(x);
    this.graphics.y = Math.round(y);

    // Initial draw
    this.draw();
  }

  /**
   * Set name label displayed above this player's head.
   * Use 'YOU' for the local player, or player display name for enemies.
   * Pass null or empty string to hide label.
   */
  setNameLabel(label: string | null): void {
    if (!label) {
      if (this.nameLabel) {
        this.nameLabel.destroy();
        this.nameLabel = null;
      }
      return;
    }

    const isYou = label === 'YOU';
    if (!this.nameLabel) {
      this.nameLabel = this.scene.add.text(this.x, this.y - ProceduralPlayerGraphics.HEAD_RADIUS - 5, label, {
        fontSize: isYou ? '14px' : '12px',
        fontStyle: isYou ? 'bold' : 'normal',
        color: isYou ? '#FFFFFF' : '#AAAAAA',
        shadow: isYou ? { offsetX: 1, offsetY: 1, color: '#000000', blur: 2, fill: true } : undefined,
      });
      this.nameLabel.setOrigin(0.5, 1);
      this.nameLabel.setDepth(60);
    } else {
      this.nameLabel.setText(label);
    }
    this.updateLabelPosition();
  }

  /**
   * Set spawn invulnerability state.
   * When true, a yellow ring is drawn around the player.
   */
  setInvulnerable(invulnerable: boolean): void {
    this.isInvulnerable = invulnerable;
    this.draw();
  }

  /**
   * Draw the stick figure
   * Based on StickFigure.ts lines 297-388
   */
  private draw(): void {
    this.graphics.clear();

    const weaponAim = this.aimAngle ?? this.rotation;
    const bounds = getCanonicalPlayerBodyBounds(0, 0);
    const cx = 0;
    const cy = 0;
    const calcAimPoint = (distance: number, sideOffset: number) => {
      return {
        x: cx + (distance * Math.cos(weaponAim) - sideOffset * Math.sin(weaponAim)),
        y: cy + (distance * Math.sin(weaponAim) + sideOffset * Math.cos(weaponAim)),
      };
    };

    // --- SPAWN INVULNERABILITY RING ---
    if (this.isInvulnerable) {
      this.graphics.lineStyle(2, COLORS.SPAWN_RING, 1);
      this.graphics.strokeCircle(cx, cy, 25);
    }

    // Canonical live body: this is the collision-reading footprint on screen.
    this.graphics.fillStyle(this.bodyColor, 1);
    this.graphics.fillRect(bounds.left, bounds.top, bounds.width, bounds.height);
    this.graphics.lineStyle(
      ProceduralPlayerGraphics.BODY_OUTLINE_WIDTH,
      0x000000,
      ProceduralPlayerGraphics.BODY_OUTLINE_ALPHA
    );
    this.graphics.strokeRect(bounds.left, bounds.top, bounds.width, bounds.height);

    // --- LEGS ---
    this.graphics.lineStyle(3, this.bodyColor, 1);

    const stride = 5;
    const footSideOffset = 6;
    const hipY = bounds.bottom - 18;
    const footY = bounds.bottom - 4;

    const leftLegProgress = Math.sin(this.walkCycle);
    const rightLegProgress = Math.sin(this.walkCycle + Math.PI);

    const leftFootPos = {
      x: cx - footSideOffset + leftLegProgress * stride,
      y: footY,
    };
    const rightFootPos = {
      x: cx + footSideOffset + rightLegProgress * stride,
      y: footY,
    };

    // Draw left leg
    this.graphics.beginPath();
    this.graphics.moveTo(cx - 5, hipY);
    this.graphics.lineTo(leftFootPos.x, leftFootPos.y);
    this.graphics.strokePath();

    // Draw right leg
    this.graphics.beginPath();
    this.graphics.moveTo(cx + 5, hipY);
    this.graphics.lineTo(rightFootPos.x, rightFootPos.y);
    this.graphics.strokePath();

    // Draw feet
    this.graphics.fillStyle(this.bodyColor, 1);
    this.graphics.fillCircle(leftFootPos.x, leftFootPos.y, 3);
    this.graphics.fillCircle(rightFootPos.x, rightFootPos.y, 3);

    // --- ARMS ---
    // Default arm positions (can be adjusted based on weapon type in future)
    const leftHandPos = calcAimPoint(ProceduralPlayerGraphics.WEAPON_GRIP_OFFSET, -ProceduralPlayerGraphics.HAND_SPREAD);
    const rightHandPos = calcAimPoint(ProceduralPlayerGraphics.WEAPON_GRIP_OFFSET, ProceduralPlayerGraphics.HAND_SPREAD);

    this.graphics.lineStyle(2, this.bodyColor, 1);

    // Draw left arm
    this.graphics.beginPath();
    this.graphics.moveTo(cx, bounds.top + 18);
    this.graphics.lineTo(leftHandPos.x, leftHandPos.y);
    this.graphics.strokePath();

    // Draw right arm
    this.graphics.beginPath();
    this.graphics.moveTo(cx, bounds.top + 18);
    this.graphics.lineTo(rightHandPos.x, rightHandPos.y);
    this.graphics.strokePath();

    // Draw hands
    this.graphics.fillCircle(leftHandPos.x, leftHandPos.y, 3);
    this.graphics.fillCircle(rightHandPos.x, rightHandPos.y, 3);

    // --- HEAD ---
    this.graphics.fillStyle(this.headColor, 1);
    this.graphics.fillCircle(cx, cy, ProceduralPlayerGraphics.HEAD_RADIUS);
    this.graphics.lineStyle(1, 0x000000, 0.3);
    this.graphics.strokeCircle(cx, cy, ProceduralPlayerGraphics.HEAD_RADIUS);
  }

  private updateLabelPosition(): void {
    if (this.nameLabel) {
      this.nameLabel.x = this.x;
      this.nameLabel.y = this.y - ProceduralPlayerGraphics.HEAD_RADIUS - 5;
    }
  }

  /**
   * Get the world-space barrel tip position (where shots come from)
   */
  getBarrelPosition(): { x: number; y: number } {
    const weaponAim = this.aimAngle ?? this.rotation;
    return {
      x: this.x + ProceduralPlayerGraphics.BARREL_X * Math.cos(weaponAim),
      y: this.y + ProceduralPlayerGraphics.BARREL_X * Math.sin(weaponAim),
    };
  }

  /**
   * Update animation state
   * @param delta Delta time in milliseconds
   * @param isMoving Whether the player is moving
   */
  update(delta: number, isMoving: boolean): void {
    // Update walk cycle based on movement
    if (isMoving) {
      this.walkCycle += delta * ProceduralPlayerGraphics.WALK_SPEED_FACTOR;
    } else {
      this.walkCycle = 0; // Reset when idle
    }

    // Redraw with updated animation
    this.draw();
  }

  /**
   * Set position
   */
  setPosition(x: number, y: number): void {
    this.x = x;
    this.y = y;
    // Update Graphics transform for camera follow
    this.graphics.x = Math.round(x);
    this.graphics.y = Math.round(y);
    this.updateLabelPosition();
    this.draw();
  }

  /**
   * Get position
   */
  getPosition(): { x: number; y: number } {
    return { x: this.x, y: this.y };
  }

  /**
   * Set rotation
   */
  setRotation(rotation: number): void {
    this.rotation = rotation;
    this.draw();
  }

  setAimAngle(aimAngle: number): void {
    this.aimAngle = aimAngle;
    this.draw();
  }

  getCanonicalBodyBounds(): CanonicalPlayerBodyBounds {
    return getCanonicalPlayerBodyBounds(Math.round(this.x), Math.round(this.y));
  }

  /**
   * Get rotation
   */
  getRotation(): number {
    return this.rotation;
  }

  /**
   * Set head color (body is always black per art style)
   */
  setColor(headColor: number): void {
    this.headColor = headColor;
    this.draw();
  }

  /**
   * Set visibility
   */
  setVisible(visible: boolean): void {
    this.graphics.setVisible(visible);
    if (this.nameLabel) {
      this.nameLabel.setVisible(visible);
    }
  }

  /**
   * Get visibility
   */
  getVisible(): boolean {
    return this.graphics.visible;
  }

  /**
   * Get the underlying Graphics object (for camera follow, etc.)
   */
  getGraphics(): Phaser.GameObjects.Graphics {
    return this.graphics;
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.graphics) {
      this.graphics.destroy();
    }
    if (this.nameLabel) {
      this.nameLabel.destroy();
      this.nameLabel = null;
    }
  }
}
