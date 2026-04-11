import Phaser from 'phaser';
import type { MapWeaponSpawn } from '../../shared/maps';

export interface WeaponCrateData {
  id: string;
  position: { x: number; y: number };
  weaponType: string;
  isAvailable: boolean;
}

interface CrateVisual {
  sprite: Phaser.GameObjects.Graphics;
  glow: Phaser.GameObjects.Arc;
  tween: Phaser.Tweens.Tween;
  isAvailable: boolean;
  position: { x: number; y: number };
  weaponType: string;
}

const GLOW_RADIUS = 24;
const GLOW_COLOR = 0xffff00;
const GLOW_ALPHA = 0;
const GLOW_STROKE_WIDTH = 2;
const GLOW_STROKE_ALPHA = 0.5;
const BOB_DISTANCE = 5;
const BOB_DURATION = 1000;
const UNAVAILABLE_ALPHA = 0.3;
const AVAILABLE_ALPHA = 1.0;
const PICKUP_RADIUS = 24;

const PICKUP_COLORS = {
  UZI: 0x6f6f6f,
  AK47: 0x4b4b4b,
  SHOTGUN: 0x6a4b2d,
  KATANA_BLADE: 0xd9d9d9,
  KATANA_HANDLE: 0x2a2a2a,
  BAT: 0x8b5a2b,
} as const;

export class WeaponCrateManager {
  private scene: Phaser.Scene;
  private crates: Map<string, CrateVisual>;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.crates = new Map();
  }

  spawnCrate(data: WeaponCrateData): void {
    const existingCrate = this.crates.get(data.id);
    if (existingCrate) {
      existingCrate.sprite.setPosition(data.position.x, data.position.y);
      existingCrate.glow.setPosition(data.position.x, data.position.y);
      existingCrate.position = data.position;
      existingCrate.weaponType = data.weaponType;
      this.drawWeaponPickup(existingCrate.sprite, data.weaponType);

      if (data.isAvailable) {
        this.markAvailable(data.id);
      } else {
        this.markUnavailable(data.id);
      }
      return;
    }

    // Render the pickup as a literal floor weapon silhouette.
    const sprite = this.scene.add.graphics();
    sprite.setPosition(data.position.x, data.position.y);
    this.drawWeaponPickup(sprite, data.weaponType);

    // Add glow effect for visibility
    const glow = this.scene.add.arc(
      data.position.x,
      data.position.y,
      GLOW_RADIUS,
      0,
      360,
      false,
      GLOW_COLOR,
      GLOW_ALPHA
    );
    glow.setStrokeStyle(GLOW_STROKE_WIDTH, GLOW_COLOR, GLOW_STROKE_ALPHA);

    // Add bobbing animation to graphics object
    const tween = this.scene.tweens.add({
      targets: sprite,
      y: data.position.y - BOB_DISTANCE,
      yoyo: true,
      duration: BOB_DURATION,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Store crate data
    this.crates.set(data.id, {
      sprite,
      glow,
      tween,
      isAvailable: data.isAvailable,
      position: data.position,
      weaponType: data.weaponType,
    });

    // Apply initial availability state
    if (!data.isAvailable) {
      this.markUnavailable(data.id);
    }
  }

  initializeFromMapWeaponSpawns(weaponSpawns: readonly MapWeaponSpawn[]): void {
    for (const weaponSpawn of weaponSpawns) {
      if (this.crates.has(weaponSpawn.id)) {
        continue;
      }

      this.spawnCrate({
        id: weaponSpawn.id,
        position: { x: weaponSpawn.x, y: weaponSpawn.y },
        weaponType: weaponSpawn.weaponType,
        isAvailable: false,
      });
    }
  }

  markUnavailable(crateId: string): void {
    const crate = this.crates.get(crateId);
    if (!crate) {
      return;
    }

    crate.sprite.setAlpha(UNAVAILABLE_ALPHA);
    crate.glow.setAlpha(UNAVAILABLE_ALPHA);
    crate.isAvailable = false;
  }

  markAvailable(crateId: string): void {
    const crate = this.crates.get(crateId);
    if (!crate) {
      return;
    }

    crate.sprite.setAlpha(AVAILABLE_ALPHA);
    crate.glow.setAlpha(AVAILABLE_ALPHA);
    crate.glow.setVisible(true);
    crate.isAvailable = true;
  }

  private drawWeaponPickup(sprite: Phaser.GameObjects.Graphics, weaponType: string): void {
    sprite.clear();

    switch (weaponType) {
      case 'uzi':
        sprite.fillStyle(PICKUP_COLORS.UZI, 1);
        sprite.fillRect(-10, -4, 14, 8);
        sprite.fillRect(4, -2, 8, 4);
        sprite.fillRect(-2, 4, 4, 6);
        break;
      case 'ak47':
        sprite.fillStyle(PICKUP_COLORS.AK47, 1);
        sprite.fillRect(-14, -3, 20, 6);
        sprite.fillRect(6, -2, 10, 4);
        sprite.fillRect(-18, -2, 4, 8);
        sprite.fillRect(-2, 3, 4, 6);
        break;
      case 'shotgun':
        sprite.fillStyle(PICKUP_COLORS.SHOTGUN, 1);
        sprite.fillRect(-16, -2, 28, 4);
        sprite.fillRect(-4, 3, 8, 4);
        sprite.fillRect(-20, -3, 4, 8);
        break;
      case 'katana':
        sprite.lineStyle(2, PICKUP_COLORS.KATANA_BLADE, 1);
        sprite.beginPath();
        sprite.moveTo(-16, -1);
        sprite.lineTo(12, -1);
        sprite.strokePath();
        sprite.fillStyle(PICKUP_COLORS.KATANA_HANDLE, 1);
        sprite.fillRect(-19, -3, 5, 4);
        break;
      case 'bat':
        sprite.lineStyle(4, PICKUP_COLORS.BAT, 1);
        sprite.beginPath();
        sprite.moveTo(-14, 4);
        sprite.lineTo(10, -4);
        sprite.strokePath();
        break;
      default:
        sprite.fillStyle(PICKUP_COLORS.UZI, 1);
        sprite.fillRect(-8, -3, 16, 6);
        break;
    }
  }

  getCrate(crateId: string): { isAvailable: boolean } | undefined {
    const crate = this.crates.get(crateId);
    if (!crate) {
      return undefined;
    }

    return {
      isAvailable: crate.isAvailable,
    };
  }

  checkProximity(
    playerPos: { x: number; y: number } | undefined
  ): { id: string; weaponType: string } | null {
    if (!playerPos) {
      return null;
    }

    let closestCrate: { id: string; weaponType: string } | null = null;
    let closestDistance = Infinity;

    for (const [crateId, crate] of this.crates) {
      if (!crate.isAvailable) {
        continue;
      }

      const dx = crate.position.x - playerPos.x;
      const dy = crate.position.y - playerPos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance <= PICKUP_RADIUS && distance < closestDistance) {
        closestCrate = { id: crateId, weaponType: crate.weaponType };
        closestDistance = distance;
      }
    }

    return closestCrate;
  }

  getAllCrates(): Array<{
    id: string;
    position: { x: number; y: number };
    weaponType: string;
    isAvailable: boolean;
  }> {
    const crateArray = [];
    for (const [crateId, crate] of this.crates) {
      crateArray.push({
        id: crateId,
        position: crate.position,
        weaponType: crate.weaponType,
        isAvailable: crate.isAvailable,
      });
    }
    return crateArray;
  }

  destroy(): void {
    for (const crate of this.crates.values()) {
      crate.sprite.destroy();
      crate.glow.destroy();
      crate.tween.remove();
    }
    this.crates.clear();
  }
}
