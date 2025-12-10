import Phaser from 'phaser';

export interface WeaponCrateData {
  id: string;
  position: { x: number; y: number };
  weaponType: string;
  isAvailable: boolean;
}

interface CrateVisual {
  sprite: Phaser.GameObjects.Rectangle;
  glow: Phaser.GameObjects.Arc;
  tween: Phaser.Tweens.Tween;
  isAvailable: boolean;
  position: { x: number; y: number };
  weaponType: string;
}

const CRATE_SIZE = 48;
const CRATE_COLOR = 0x996633;
const GLOW_RADIUS = 32;
const GLOW_COLOR = 0xffff00;
const GLOW_ALPHA = 0;
const GLOW_STROKE_WIDTH = 2;
const GLOW_STROKE_ALPHA = 0.5;
const BOB_DISTANCE = 5;
const BOB_DURATION = 1000;
const UNAVAILABLE_ALPHA = 0.3;
const AVAILABLE_ALPHA = 1.0;
const PICKUP_RADIUS = 32;

export class WeaponCrateManager {
  private scene: Phaser.Scene;
  private crates: Map<string, CrateVisual>;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.crates = new Map();
  }

  spawnCrate(data: WeaponCrateData): void {
    // Create weapon crate sprite (box)
    const sprite = this.scene.add.rectangle(
      data.position.x,
      data.position.y,
      CRATE_SIZE,
      CRATE_SIZE,
      CRATE_COLOR
    );
    sprite.setOrigin(0.5, 0.5);

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

    // Add bobbing animation
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

  markUnavailable(crateId: string): void {
    const crate = this.crates.get(crateId);
    if (!crate) {
      return;
    }

    crate.sprite.setAlpha(UNAVAILABLE_ALPHA);
    crate.glow.setVisible(false);
    crate.isAvailable = false;
  }

  markAvailable(crateId: string): void {
    const crate = this.crates.get(crateId);
    if (!crate) {
      return;
    }

    crate.sprite.setAlpha(AVAILABLE_ALPHA);
    crate.glow.setVisible(true);
    crate.isAvailable = true;
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
