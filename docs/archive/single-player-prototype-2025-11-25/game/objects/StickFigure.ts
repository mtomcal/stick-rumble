import Phaser from 'phaser';
import { WeaponType } from '../../types';

export class StickFigure extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;
  declare x: number;
  declare y: number;
  declare rotation: number;
  declare scene: Phaser.Scene;
  declare active: boolean;
  declare setVelocity: (x: number, y?: number) => this;
  declare setRotation: (rotation: number) => this;
  declare setVisible: (value: boolean) => this;

  private graphics: Phaser.GameObjects.Graphics;
  public isDead: boolean = false;
  public hp: number = 100;
  public maxHp: number = 100;
  public lastFired: number = 0; 
  public weaponType: WeaponType;
  
  // Ammo & Reloading
  public currentAmmo: number = 0;
  public maxAmmo: number = 0;
  public isReloading: boolean = false;
  private reloadBar: Phaser.GameObjects.Graphics;

  // AI Navigation
  public currentPath: { x: number, y: number }[] = [];
  public pathIndex: number = 0;
  public lastPathTime: number = 0;
  public lastLOSTime: number = 0; // Line of Sight throttle
  public hasLOS: boolean = false; // Persisted Line of Sight check
  
  // Aim Mechanics
  public aimSway: number = 0;
  private swayTime: number = 0;

  private color: number;
  private weaponContainer: Phaser.GameObjects.Container;
  private nameText: Phaser.GameObjects.Text;
  private walkCycle: number = 0;
  private isAttacking: boolean = false; 
  private recoilOffset: number = 0; // Used for gun kickback

  constructor(scene: Phaser.Scene, x: number, y: number, color: number, name: string, weaponType: WeaponType = WeaponType.AK47) {
    super(scene, x, y, 'placeholder');
    // Hide the base sprite texture so we only see the drawn stick figure logic
    this.setVisible(false);
    
    this.color = color;
    this.weaponType = weaponType;

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.graphics = scene.add.graphics();
    this.reloadBar = scene.add.graphics();
    this.weaponContainer = scene.add.container(x, y);
    
    this.drawWeapon();

    // Name tag
    this.nameText = scene.add.text(x, y - 45, name, {
      fontSize: '12px',
      color: '#ffffff',
      fontFamily: 'Arial',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);

    const body = this.body as Phaser.Physics.Arcade.Body;
    // Reduced radius from 18 to 15. 
    // Sprite is 30x30. Radius 15 means diameter 30.
    body.setCircle(15); 
    body.setCollideWorldBounds(true);
  }

  // Helper to switch weapon dynamically
  public setWeapon(type: WeaponType, clipSize: number) {
      this.weaponType = type;
      this.maxAmmo = clipSize;
      this.currentAmmo = clipSize; // Give full clip on pickup
      this.isReloading = false;
      this.reloadBar.clear();
      this.drawWeapon();
  }

  public getBarrelPosition(): Phaser.Math.Vector2 {
      let offset = 30; // Default barrel length
      if (this.weaponType === WeaponType.AK47) offset = 55; // Slightly longer for new visuals
      if (this.weaponType === WeaponType.UZI) offset = 35;
      if (this.weaponType === WeaponType.SHOTGUN) offset = 45; // Reduced from 60 to be more compact
      
      // Use rotation + aimSway so bullets follow the visual barrel
      const vec = new Phaser.Math.Vector2(offset, 0);
      vec.rotate(this.rotation + this.aimSway);
      vec.add(new Phaser.Math.Vector2(this.x, this.y));
      return vec;
  }

  public drawReloadBar(progress: number) {
      // progress 0 to 1
      this.reloadBar.clear();
      if (progress >= 1 || progress <= 0) return;

      const w = 40;
      const h = 6;
      const x = this.x - w / 2;
      const y = this.y - 60;

      this.reloadBar.fillStyle(0x000000, 0.8);
      this.reloadBar.fillRect(x, y, w, h);
      
      this.reloadBar.fillStyle(0xffffff, 1);
      this.reloadBar.fillRect(x + 1, y + 1, (w - 2) * progress, h - 2);
  }

  private drawWeapon() {
      if (!this.weaponContainer) return;
      this.weaponContainer.removeAll(true); // Clear old weapon visuals

      const scene = this.scene;

      switch (this.weaponType) {
          case WeaponType.BAT:
              // Aluminum Bat: Silver gradient
              const batHandle = scene.add.rectangle(10, 0, 15, 4, 0x000000); // Grip
              const batBody = scene.add.rectangle(30, 0, 35, 6, 0xcccccc); // Metal part
              const batTip = scene.add.rectangle(48, 0, 5, 7, 0xcccccc); // End cap
              this.weaponContainer.add([batHandle, batBody, batTip]);
              break;

          case WeaponType.KATANA:
              // Katana: Long thin blade, guard, handle
              const kHandle = scene.add.rectangle(5, 0, 15, 4, 0x212121);
              const kGuard = scene.add.rectangle(15, 0, 4, 12, 0xd4af37); // Gold guard
              const kBlade = scene.add.rectangle(40, 0, 50, 3, 0xffffff);
              this.weaponContainer.add([kHandle, kGuard, kBlade]);
              break;

          case WeaponType.UZI:
              // Uzi: Boxy, compact, black
              const uBody = scene.add.rectangle(20, 0, 20, 10, 0x333333);
              const uHandle = scene.add.rectangle(15, 5, 8, 8, 0x222222);
              const uBarrel = scene.add.rectangle(32, -2, 8, 4, 0x111111);
              const uMag = scene.add.rectangle(22, 8, 6, 10, 0x111111);
              this.weaponContainer.add([uBody, uHandle, uBarrel, uMag]);
              break;

          case WeaponType.SHOTGUN:
              // Compact Shotgun: Wood stock, Metal body
              const sStock = scene.add.rectangle(0, 0, 12, 6, 0x5d4037);
              const sBody = scene.add.rectangle(18, 0, 20, 6, 0x333333); 
              const sBarrel = scene.add.rectangle(38, -1, 18, 4, 0x111111);
              const sPump = scene.add.rectangle(32, 3, 8, 5, 0x5d4037); 
              this.weaponContainer.add([sStock, sBody, sBarrel, sPump]);
              break;

          case WeaponType.AK47:
          default:
              // AK-47: Wood stock, metal body, curved mag
              const akStock = scene.add.rectangle(0, 0, 15, 6, 0x8d6e63); // Wood
              const akBody = scene.add.rectangle(20, 0, 25, 6, 0x222222); // Metal receiver
              const akBarrel = scene.add.rectangle(40, 0, 20, 3, 0x111111); // Barrel
              const akHandguard = scene.add.rectangle(35, 0, 12, 5, 0x8d6e63); // Wood handguard
              const akMag = scene.add.rectangle(25, 5, 6, 12, 0x111111); // Mag
              akMag.setRotation(-0.3);
              this.weaponContainer.add([akStock, akBody, akBarrel, akHandguard, akMag]);
              break;
      }
  }

  // Visuals for reloading
  public playReloadAnimation() {
      if (!this.weaponContainer) return;

      this.scene.tweens.add({
          targets: this.weaponContainer,
          alpha: 0.5,
          scaleX: 0.8,
          scaleY: 0.8,
          duration: 200,
          yoyo: true,
          repeat: 2,
          onComplete: () => {
              if (this.weaponContainer && this.weaponContainer.active) {
                  this.weaponContainer.setAlpha(1);
                  this.weaponContainer.setScale(1);
              }
          }
      });
  }

  // Visuals for attacking (Swing or Recoil)
  public playAttackAnimation() {
      if (this.isAttacking) return;

      if (this.weaponType === WeaponType.BAT || this.weaponType === WeaponType.KATANA) {
          // Melee Swing
          this.isAttacking = true;
          this.scene.tweens.add({
              targets: this.weaponContainer,
              angle: { from: this.weaponContainer.angle - 45, to: this.weaponContainer.angle + 60 },
              duration: 100,
              yoyo: true,
              onComplete: () => {
                  this.isAttacking = false;
                  this.weaponContainer.setAngle(0); // Reset
              }
          });
      } else {
          // Gun Recoil
          this.recoilOffset = 0;
          let recoilDist = -6;
          if (this.weaponType === WeaponType.SHOTGUN) recoilDist = -10; // Kick harder

          this.scene.tweens.add({
              targets: this,
              recoilOffset: recoilDist,
              duration: 50,
              yoyo: true
          });

          // Muzzle Flash
          const flash = this.scene.add.circle(0, 0, 8, 0xffffaa);
          this.weaponContainer.add(flash);
          
          // Position at end of gun
          let barrelLen = 30;
          if (this.weaponType === WeaponType.AK47) barrelLen = 50;
          if (this.weaponType === WeaponType.UZI) barrelLen = 35;
          if (this.weaponType === WeaponType.SHOTGUN) barrelLen = 45; // Reduced to match sprite
          
          flash.setPosition(barrelLen, -1); 

          // Randomize flash size slightly
          flash.setScale(0.8 + Math.random() * 0.4);
          if (this.weaponType === WeaponType.SHOTGUN) flash.setScale(1.5); // Big boom

          this.scene.tweens.add({
              targets: flash,
              alpha: 0,
              scale: 0.5,
              duration: 40,
              onComplete: () => flash.destroy()
          });
      }
  }

  preUpdate(time: number, delta: number) {
    super.preUpdate(time, delta);
    
    // Update Walk Cycle based on speed
    const body = this.body as Phaser.Physics.Arcade.Body;
    const speed = body.speed;
    
    if (speed > 5) {
        this.walkCycle += delta * 0.02; 
    } else {
        this.walkCycle = 0;
    }

    // --- Aim Sway Logic ---
    this.swayTime += delta;
    const isMoving = speed > 10;
    // High speed = erratic sway. Idle = slight breathing sway.
    const swaySpeed = isMoving ? 0.008 : 0.002; 
    const swayMagnitude = isMoving ? 0.15 : 0.03; // Radians (0.15 is ~8 degrees)

    // Composite sine wave for less predictable motion
    this.aimSway = (Math.sin(this.swayTime * swaySpeed) + Math.sin(this.swayTime * swaySpeed * 0.7)) * swayMagnitude;

    this.draw();
    this.updateAttachments();
  }

  private updateAttachments() {
    if (this.nameText && this.nameText.active) {
      this.nameText.setPosition(this.x, this.y - 45);
    }
    if (this.weaponContainer && this.weaponContainer.active) {
        const recoilX = Math.cos(this.rotation) * this.recoilOffset;
        const recoilY = Math.sin(this.rotation) * this.recoilOffset;

        if (!this.isAttacking) {
             this.weaponContainer.setPosition(this.x + recoilX, this.y + recoilY);
             // Add Aim Sway to the visual weapon rotation
             this.weaponContainer.setRotation(this.rotation + this.aimSway);
        } else {
            this.weaponContainer.setPosition(this.x + recoilX, this.y + recoilY);
            // During attack animations (melee), let the tween control rotation
        }
    }
  }

  private draw() {
    if (!this.graphics) return;
    this.graphics.clear();
    
    const cx = this.x;
    const cy = this.y;
    const rot = this.rotation;

    const calcPoint = (localX: number, localY: number) => {
        return {
            x: cx + (localX * Math.cos(rot) - localY * Math.sin(rot)),
            y: cy + (localX * Math.sin(rot) + localY * Math.cos(rot))
        };
    };

    // --- LEGS ---
    this.graphics.lineStyle(3, this.color, 1);
    
    // Adjusted for better visibility without the base circle
    const stride = 16; 
    const footSideOffset = 8; 
    
    const leftLegProgress = Math.sin(this.walkCycle);
    const rightLegProgress = Math.sin(this.walkCycle + Math.PI);

    const leftFootPos = calcPoint(leftLegProgress * stride, -footSideOffset);
    const rightFootPos = calcPoint(rightLegProgress * stride, footSideOffset);

    this.graphics.beginPath();
    this.graphics.moveTo(cx, cy);
    this.graphics.lineTo(leftFootPos.x, leftFootPos.y);
    this.graphics.strokePath();

    this.graphics.beginPath();
    this.graphics.moveTo(cx, cy);
    this.graphics.lineTo(rightFootPos.x, rightFootPos.y);
    this.graphics.strokePath();
    
    this.graphics.fillStyle(this.color, 1);
    this.graphics.fillCircle(leftFootPos.x, leftFootPos.y, 3);
    this.graphics.fillCircle(rightFootPos.x, rightFootPos.y, 3);


    // --- ARMS ---
    let leftHandX = 20 + this.recoilOffset;
    let rightHandX = 20 + this.recoilOffset;
    let leftHandY = -3;
    let rightHandY = 3;

    if (this.weaponType === WeaponType.UZI) {
        leftHandX = 15 + this.recoilOffset; rightHandX = 15 + this.recoilOffset;
        leftHandY = -2; rightHandY = 4;
    } else if (this.weaponType === WeaponType.BAT || this.weaponType === WeaponType.KATANA) {
        leftHandX = 10; rightHandX = 10;
        leftHandY = -2; rightHandY = 2;
    } else if (this.weaponType === WeaponType.AK47) {
        leftHandX = 35 + this.recoilOffset;
        leftHandY = -2;
        rightHandX = 10 + this.recoilOffset;
        rightHandY = 4; 
    } else if (this.weaponType === WeaponType.SHOTGUN) {
        leftHandX = 32 + this.recoilOffset; // On pump (adjusted for compact size)
        leftHandY = 4;
        rightHandX = 5 + this.recoilOffset; // On stock/grip
        rightHandY = 2;
    }

    const leftHandPos = calcPoint(leftHandX, leftHandY);
    const rightHandPos = calcPoint(rightHandX, rightHandY);

    this.graphics.lineStyle(2, this.color, 1);
    
    this.graphics.beginPath();
    this.graphics.moveTo(cx, cy);
    this.graphics.lineTo(leftHandPos.x, leftHandPos.y);
    this.graphics.strokePath();

    this.graphics.beginPath();
    this.graphics.moveTo(cx, cy);
    this.graphics.lineTo(rightHandPos.x, rightHandPos.y);
    this.graphics.strokePath();

    this.graphics.fillCircle(leftHandPos.x, leftHandPos.y, 3);
    this.graphics.fillCircle(rightHandPos.x, rightHandPos.y, 3);

    // --- HEAD ---
    // Slightly larger head to serve as the "body" anchor
    this.graphics.fillStyle(this.color, 1);
    this.graphics.fillCircle(cx, cy, 13); 
    this.graphics.lineStyle(1, 0x000000, 0.3);
    this.graphics.strokeCircle(cx, cy, 13);
  }

  takeDamage(amount: number) {
    this.hp = Math.max(0, this.hp - amount);
    
    if (this.scene && this.graphics) {
      this.scene.tweens.addCounter({
        from: 255,
        to: 0,
        duration: 100,
        onUpdate: (tween) => {
          if (this.graphics && this.graphics.active) {
            const val = Math.floor(tween.getValue());
            this.graphics.alpha = val / 255;
          }
        },
        onComplete: () => {
          if (this.graphics && this.graphics.active) {
            this.graphics.alpha = 1;
          }
        }
      });
    }

    if (this.hp <= 0 && !this.isDead) {
      this.die();
    }
  }

  die() {
    this.isDead = true;
    const scene = this.scene; // Capture ref
    
    this.graphics.clear();
    this.reloadBar.clear(); // Clear UI
    if (this.weaponContainer) this.weaponContainer.destroy();
    if (this.nameText) this.nameText.destroy();
    
    this.destroy(); 
    
    if (scene) {
        const deadGfx = scene.add.graphics();
        deadGfx.lineStyle(3, 0x444444, 1);
        const x = this.x;
        const y = this.y;
        const rot = this.rotation;
        
        deadGfx.moveTo(x, y);
        deadGfx.lineTo(x + Math.cos(rot + 0.5)*20, y + Math.sin(rot + 0.5)*20);
        deadGfx.moveTo(x, y);
        deadGfx.lineTo(x + Math.cos(rot - 0.5)*20, y + Math.sin(rot - 0.5)*20);
        deadGfx.moveTo(x, y);
        deadGfx.lineTo(x + Math.cos(rot + 2.5)*20, y + Math.sin(rot + 2.5)*20);
        deadGfx.moveTo(x, y);
        deadGfx.lineTo(x + Math.cos(rot - 2.5)*20, y + Math.sin(rot - 2.5)*20);
        deadGfx.strokePath();
        
        deadGfx.fillStyle(0x444444);
        deadGfx.fillCircle(x + Math.cos(rot)*25, y + Math.sin(rot)*25, 10);

        scene.tweens.add({
          targets: deadGfx,
          alpha: 0,
          duration: 2000,
          delay: 5000,
          onComplete: () => deadGfx.destroy()
        });
    }
  }
  
  destroy(fromScene?: boolean) {
      if (this.graphics) this.graphics.destroy();
      if (this.reloadBar) this.reloadBar.destroy();
      if (this.weaponContainer && this.weaponContainer.active) this.weaponContainer.destroy();
      if (this.nameText && this.nameText.active) this.nameText.destroy();
      super.destroy(fromScene);
  }
}