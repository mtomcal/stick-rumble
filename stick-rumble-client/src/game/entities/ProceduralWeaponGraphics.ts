import Phaser from 'phaser';

/**
 * ProceduralWeaponGraphics renders weapons using procedural graphics (rectangles in containers)
 * following the prototype pattern from StickFigure.ts
 *
 * All weapons are built from colored rectangles composed in a container.
 */
export class ProceduralWeaponGraphics {
  public weaponType: string;
  public recoilOffset: number = 0;
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene, x: number, y: number, weaponType: string) {
    this.scene = scene;
    this.weaponType = weaponType;
    this.container = scene.add.container(x, y);
    this.buildWeapon(weaponType);
  }

  /**
   * Build weapon geometry from rectangles based on weapon type
   */
  private buildWeapon(weaponType: string): void {
    // Clear existing parts
    this.container.removeAll(true);

    const normalizedType = weaponType.toLowerCase();

    switch (normalizedType) {
      case 'bat':
        this.buildBat();
        break;
      case 'katana':
        this.buildKatana();
        break;
      case 'uzi':
        this.buildUzi();
        break;
      case 'ak47':
        this.buildAK47();
        break;
      case 'shotgun':
        this.buildShotgun();
        break;
      case 'pistol':
      default:
        this.buildPistol();
        break;
    }
  }

  /**
   * Build Pistol weapon
   */
  private buildPistol(): void {
    const handle = this.scene.add.rectangle(5, 2, 8, 10, 0x222222);
    const body = this.scene.add.rectangle(12, 0, 12, 6, 0x333333);
    const barrel = this.scene.add.rectangle(20, 0, 10, 4, 0x111111);
    this.container.add([handle, body, barrel]);
  }

  /**
   * Build Bat weapon (Aluminum bat - silver)
   */
  private buildBat(): void {
    const batHandle = this.scene.add.rectangle(10, 0, 15, 4, 0x000000); // Grip
    const batBody = this.scene.add.rectangle(30, 0, 35, 6, 0xcccccc); // Metal part
    const batTip = this.scene.add.rectangle(48, 0, 5, 7, 0xcccccc); // End cap
    this.container.add([batHandle, batBody, batTip]);
  }

  /**
   * Build Katana weapon
   */
  private buildKatana(): void {
    const kHandle = this.scene.add.rectangle(5, 0, 15, 4, 0x212121);
    const kGuard = this.scene.add.rectangle(15, 0, 4, 12, 0xd4af37); // Gold guard
    const kBlade = this.scene.add.rectangle(40, 0, 50, 3, 0xffffff); // White blade
    this.container.add([kHandle, kGuard, kBlade]);
  }

  /**
   * Build Uzi weapon (Boxy, compact, black)
   */
  private buildUzi(): void {
    const uBody = this.scene.add.rectangle(20, 0, 20, 10, 0x333333);
    const uHandle = this.scene.add.rectangle(15, 5, 8, 8, 0x222222);
    const uBarrel = this.scene.add.rectangle(32, -2, 8, 4, 0x111111);
    const uMag = this.scene.add.rectangle(22, 8, 6, 10, 0x111111);
    this.container.add([uBody, uHandle, uBarrel, uMag]);
  }

  /**
   * Build AK47 weapon (Wood stock, metal body, curved mag)
   */
  private buildAK47(): void {
    const akStock = this.scene.add.rectangle(0, 0, 15, 6, 0x8d6e63); // Wood
    const akBody = this.scene.add.rectangle(20, 0, 25, 6, 0x222222); // Metal receiver
    const akBarrel = this.scene.add.rectangle(40, 0, 20, 3, 0x111111); // Barrel
    const akHandguard = this.scene.add.rectangle(35, 0, 12, 5, 0x8d6e63); // Wood handguard
    const akMag = this.scene.add.rectangle(25, 5, 6, 12, 0x111111); // Mag
    akMag.setRotation(-0.3); // Curved mag
    this.container.add([akStock, akBody, akBarrel, akHandguard, akMag]);
  }

  /**
   * Build Shotgun weapon (Wood stock, metal body)
   */
  private buildShotgun(): void {
    const sStock = this.scene.add.rectangle(0, 0, 12, 6, 0x5d4037);
    const sBody = this.scene.add.rectangle(18, 0, 20, 6, 0x333333);
    const sBarrel = this.scene.add.rectangle(38, -1, 18, 4, 0x111111);
    const sPump = this.scene.add.rectangle(32, 3, 8, 5, 0x5d4037);
    this.container.add([sStock, sBody, sBarrel, sPump]);
  }

  /**
   * Set weapon rotation (for aiming)
   */
  setRotation(angle: number): void {
    this.container.setRotation(angle);
  }

  /**
   * Get current rotation
   */
  getRotation(): number {
    return this.container.rotation;
  }

  /**
   * Set weapon position
   */
  setPosition(x: number, y: number): void {
    this.container.setPosition(x, y);
  }

  /**
   * Switch to a different weapon type
   */
  setWeapon(weaponType: string): void {
    this.weaponType = weaponType;
    this.buildWeapon(weaponType);
  }

  /**
   * Set visibility of the weapon
   */
  setVisible(visible: boolean): void {
    this.container.setVisible(visible);
  }

  /**
   * Flip weapon vertically (for left/right aiming)
   */
  setFlipY(flip: boolean): void {
    this.container.scaleY = flip ? -1 : 1;
  }

  /**
   * Trigger gun recoil animation (backward kick along aim axis)
   */
  triggerRecoil(): void {
    this.recoilOffset = 0;
    const recoilDist = this.weaponType.toLowerCase() === 'shotgun' ? -10 : -6;
    this.scene.tweens.add({
      targets: this,
      recoilOffset: recoilDist,
      duration: 50,
      yoyo: true,
    });
  }

  /**
   * Trigger reload animation pulse (alpha/scale pulse 3 times)
   */
  triggerReloadPulse(): void {
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0.5,
      scaleX: 0.8,
      scaleY: 0.8,
      duration: 200,
      yoyo: true,
      repeat: 2,
      onComplete: () => {
        this.container.setAlpha(1);
        this.container.setScale(1);
      },
    });
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.container.destroy();
  }
}
