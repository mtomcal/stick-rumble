import Phaser from 'phaser';
import { EventBus } from '../EventBus';
import { StickFigure } from '../objects/StickFigure';
import { EVENTS, WeaponType } from '../../types';
import { generateGameTextures } from '../utils/TextureGenerator';
import { LevelGenerator } from '../world/LevelGenerator';
import { Pathfinder } from '../systems/Pathfinder';

// Updated Stats: Clip Size & Reload Time
const WEAPON_STATS = {
  [WeaponType.BAT]: { damage: 60, cooldown: 425, range: 90, isMelee: true, color: 0xcccccc, speed: 0, clipSize: 0, reloadTime: 0 },
  [WeaponType.KATANA]: { damage: 100, cooldown: 800, range: 110, isMelee: true, color: 0xffffff, speed: 0, clipSize: 0, reloadTime: 0 },
  [WeaponType.UZI]: { damage: 12, cooldown: 100, range: 600, isMelee: false, color: 0xffff00, speed: 850, clipSize: 30, reloadTime: 1200 },
  [WeaponType.AK47]: { damage: 20, cooldown: 150, range: 1000, isMelee: false, color: 0xffaa00, speed: 1250, clipSize: 20, reloadTime: 2000 },
  [WeaponType.SHOTGUN]: { damage: 20, cooldown: 950, range: 350, isMelee: false, color: 0x5d4037, speed: 900, clipSize: 6, reloadTime: 2000, pellets: 6 },
};

interface Tracer {
    x1: number; y1: number; x2: number; y2: number; alpha: number; color: number;
}

export class MainScene extends Phaser.Scene {
  declare add: Phaser.GameObjects.GameObjectFactory;
  declare cameras: Phaser.Cameras.Scene2D.CameraManager;
  declare physics: Phaser.Physics.Arcade.ArcadePhysics;
  declare input: Phaser.Input.InputPlugin;
  declare make: Phaser.GameObjects.GameObjectCreator;
  declare time: Phaser.Time.Clock;
  declare scene: Phaser.Scenes.ScenePlugin;
  declare events: Phaser.Events.EventEmitter;
  declare tweens: Phaser.Tweens.TweenManager;

  private player!: StickFigure;
  private enemies!: Phaser.Physics.Arcade.Group;
  private bullets!: Phaser.Physics.Arcade.Group;
  private enemyBullets!: Phaser.Physics.Arcade.Group; 
  private walls!: Phaser.Physics.Arcade.StaticGroup; 
  private weaponDrops!: Phaser.Physics.Arcade.Group;
  private reticle!: Phaser.GameObjects.Sprite;
  private minimapGraphics!: Phaser.GameObjects.Graphics;
  private minimapStaticGraphics!: Phaser.GameObjects.Graphics;
  private tracerGraphics!: Phaser.GameObjects.Graphics;
  private activeTracers: Tracer[] = [];
  
  private wallBounds: Phaser.Geom.Rectangle[] = [];
  private debugText!: Phaser.GameObjects.Text;

  private cursorKeys!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasdKeys!: any;
  private reloadKey!: Phaser.Input.Keyboard.Key;
  
  // Systems
  private levelGenerator!: LevelGenerator;
  private pathfinder!: Pathfinder;

  private stats = {
    health: 100, ammo: 20, maxAmmo: 20, isReloading: false,
    score: 0, kills: 0, wave: 1, isGameOver: false
  };

  private moveStick = { x: 0, y: 0 };
  private aimStick = { x: 0, y: 0, active: false };

  // Health Regen
  private lastDamageTime: number = 0;
  private readonly REGEN_DELAY = 3000; 

  constructor() {
    super('MainScene');
  }

  preload() {
    generateGameTextures(this);
  }

  create() {
    // Use crosshair cursor for better desktop aiming visibility
    this.input.setDefaultCursor('crosshair'); 
    this.input.mouse.disableContextMenu(); // Prevent right click menu

    this.stats = {
      health: 100, ammo: 0, maxAmmo: 0, isReloading: false,
      score: 0, kills: 0, wave: 1, isGameOver: false
    };
    this.lastDamageTime = 0;

    this.cameras.main.setBackgroundColor('#cfd8dc'); 
    this.physics.world.setBounds(0, 0, 1600, 1600);
    
    // Initialize Systems
    this.levelGenerator = new LevelGenerator(this);
    this.pathfinder = new Pathfinder(50, 1600, 1600);

    this.walls = this.physics.add.staticGroup();
    this.levelGenerator.createOfficeLayout(this.walls);
    this.levelGenerator.drawFloorGrid();
    
    // Build Pathfinding Grid
    this.pathfinder.buildNavGrid(this.walls.getChildren());

    // Random Start Weapon
    const startWeapons = [WeaponType.BAT, WeaponType.UZI, WeaponType.AK47, WeaponType.KATANA, WeaponType.SHOTGUN];
    const myWeapon = Phaser.Utils.Array.GetRandom(startWeapons);

    this.player = new StickFigure(this, 800, 800, 0x222222, 'YOU', myWeapon);
    this.setPlayerWeapon(myWeapon);
    this.cameras.main.startFollow(this.player);

    this.reticle = this.add.sprite(800, 800, 'reticle').setDepth(100).setAlpha(0.8);
    this.enemies = this.physics.add.group({ runChildUpdate: true });
    this.weaponDrops = this.physics.add.group();
    this.bullets = this.physics.add.group({ defaultKey: 'bullet_pellet', maxSize: 50 });
    this.enemyBullets = this.physics.add.group({ defaultKey: 'bullet_pellet', maxSize: 50 });

    if (this.input.keyboard) {
        this.cursorKeys = this.input.keyboard.createCursorKeys();
        this.reloadKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);
        this.wasdKeys = this.input.keyboard.addKeys({
          up: Phaser.Input.Keyboard.KeyCodes.W, down: Phaser.Input.Keyboard.KeyCodes.S,
          left: Phaser.Input.Keyboard.KeyCodes.A, right: Phaser.Input.Keyboard.KeyCodes.D
        });
    }

    this.setupMinimap();
    this.setupCollisions();
    this.setupEvents();

    this.tracerGraphics = this.add.graphics().setDepth(999);

    this.time.addEvent({
      delay: 1500, callback: this.spawnEnemy, callbackScope: this, loop: true
    });

    this.debugText = this.add.text(10, 150, '', {
        fontFamily: 'monospace', fontSize: '10px', color: '#00ff00', backgroundColor: '#00000088'
    }).setScrollFactor(0).setDepth(9999);
  }

  private setupMinimap() {
    this.minimapStaticGraphics = this.add.graphics();
    this.minimapStaticGraphics.setScrollFactor(0);
    this.minimapStaticGraphics.setDepth(1999); 

    this.minimapGraphics = this.add.graphics();
    this.minimapGraphics.setScrollFactor(0); 
    this.minimapGraphics.setDepth(2000); 

    this.drawMinimapStatic();
  }

  private setupCollisions() {
    this.physics.add.collider(this.player, this.enemies);
    this.physics.add.overlap(this.player, this.weaponDrops, this.handleWeaponPickup, undefined, this);
    
    this.physics.add.collider(this.bullets, this.enemies, this.handleBulletEnemyCollision, undefined, this);
    this.physics.add.collider(this.player, this.enemyBullets, this.handlePlayerHitByBullet, undefined, this);
    this.physics.add.collider(this.enemies, this.enemies);
    this.physics.add.overlap(this.enemyBullets, this.enemies, this.handleEnemyBulletHitEnemy, undefined, this);

    this.physics.add.collider(this.player, this.walls);
    this.physics.add.collider(this.enemies, this.walls);
    this.physics.add.collider(this.bullets, this.walls, this.handleBulletWallCollision, undefined, this);
    this.physics.add.collider(this.enemyBullets, this.walls, this.handleBulletWallCollision, undefined, this);
  }

  private setupEvents() {
    const onInputMove = (data: {x: number, y: number}) => { this.moveStick = data; };
    const onInputAim = (data: {x: number, y: number, active: boolean}) => { this.aimStick = data; };
    const onRestart = () => { this.scene.restart(); };

    EventBus.on(EVENTS.INPUT_MOVE, onInputMove);
    EventBus.on(EVENTS.INPUT_AIM, onInputAim);
    EventBus.on(EVENTS.RESTART, onRestart);

    this.events.on('shutdown', () => {
        EventBus.off(EVENTS.INPUT_MOVE, onInputMove);
        EventBus.off(EVENTS.INPUT_AIM, onInputAim);
        EventBus.off(EVENTS.RESTART, onRestart);
        this.input.setDefaultCursor('default');
        this.activeTracers = [];
    });
  }

  update(time: number, delta: number) {
    const start = performance.now();
    if (!this.player || this.player.isDead) return;

    this.handleMovement();
    this.handleAiming();
    this.handleAttacks(time);
    this.handleReloadInput();
    
    const aiStart = performance.now();
    this.handleEnemies(time);
    const aiEnd = performance.now();

    this.handleHealthRegen(time, delta);
    this.updateMinimap();
    this.updateTracers(delta);
    
    this.cleanupBullets(this.bullets);
    this.cleanupBullets(this.enemyBullets);

    const end = performance.now();
    if (this.debugText) {
        this.debugText.setText([
            `FPS: ${Math.round(1000/delta)}`,
            `Update: ${(end - start).toFixed(2)}ms`,
            `AI: ${(aiEnd - aiStart).toFixed(2)}ms`,
            `E: ${this.enemies.countActive()} | B: ${this.bullets.countActive() + this.enemyBullets.countActive()}`
        ]);
    }
  }

  private cleanupBullets(group: Phaser.Physics.Arcade.Group) {
    group.getChildren().forEach((b: any) => {
        if (b.active && (b.x < 0 || b.x > 1600 || b.y < 0 || b.y > 1600)) {
          b.destroy();
        }
    });
  }

  private updateTracers(delta: number) {
      if (!this.tracerGraphics) return;
      this.tracerGraphics.clear();
      for (let i = this.activeTracers.length - 1; i >= 0; i--) {
          const t = this.activeTracers[i];
          t.alpha -= (delta / 150); 
          if (t.alpha <= 0) {
              this.activeTracers.splice(i, 1);
          } else {
              this.tracerGraphics.lineStyle(1, t.color, t.alpha);
              this.tracerGraphics.beginPath();
              this.tracerGraphics.moveTo(t.x1, t.y1);
              this.tracerGraphics.lineTo(t.x2, t.y2);
              this.tracerGraphics.strokePath();
          }
      }
  }

  private drawMinimapStatic() {
    if (!this.minimapStaticGraphics) return;
    this.minimapStaticGraphics.clear();

    const scale = 0.075; 
    const mapX = 20;
    const mapY = 20;
    const mapSize = 1600 * scale;

    this.minimapStaticGraphics.fillStyle(0x000000, 0.7);
    this.minimapStaticGraphics.fillRect(mapX, mapY, mapSize, mapSize);
    this.minimapStaticGraphics.lineStyle(2, 0xffffff, 0.5);
    this.minimapStaticGraphics.strokeRect(mapX, mapY, mapSize, mapSize);

    this.minimapStaticGraphics.fillStyle(0x555555, 1);
    const walls = this.walls.getChildren();
    this.wallBounds = [];
    for (const wall of walls) {
        const rect = (wall as Phaser.GameObjects.Rectangle);
        this.wallBounds.push(rect.getBounds()); 

        const w = rect.width;
        const h = rect.height;
        this.minimapStaticGraphics.fillRect(
            mapX + rect.x * scale - (w * scale) / 2, 
            mapY + rect.y * scale - (h * scale) / 2,
            w * scale,
            h * scale
        );
    }
  }

  private updateMinimap() {
    if (!this.minimapGraphics) return;
    this.minimapGraphics.clear();

    const scale = 0.075; 
    const mapX = 20;
    const mapY = 20;
    const radarRange = 600; // Enemies beyond this range are not shown

    this.minimapGraphics.fillStyle(0xff0000, 1);
    const enemies = this.enemies.getChildren();
    for (const e of enemies) {
        const enemy = e as StickFigure;
        if (enemy.active && !enemy.isDead) {
            // Radar Logic: Skip enemies outside radar range
            if (this.player && !this.player.isDead) {
                 const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y);
                 if (dist > radarRange) continue;
            }

            this.minimapGraphics.fillCircle(
                mapX + enemy.x * scale,
                mapY + enemy.y * scale,
                3 
            );
        }
    }

    if (this.player && !this.player.isDead) {
        this.minimapGraphics.fillStyle(0x00ff00, 1);
        this.minimapGraphics.fillCircle(
            mapX + this.player.x * scale,
            mapY + this.player.y * scale,
            4
        );
        
        // Draw Radar Range Ring
        this.minimapGraphics.lineStyle(1, 0x00ff00, 0.15);
        this.minimapGraphics.strokeCircle(
             mapX + this.player.x * scale,
             mapY + this.player.y * scale,
             radarRange * scale
        );

        const rot = this.player.rotation;
        this.minimapGraphics.lineStyle(1, 0x00ff00, 0.8);
        this.minimapGraphics.beginPath();
        this.minimapGraphics.moveTo(mapX + this.player.x * scale, mapY + this.player.y * scale);
        this.minimapGraphics.lineTo(
            mapX + this.player.x * scale + Math.cos(rot) * 10,
            mapY + this.player.y * scale + Math.sin(rot) * 10
        );
        this.minimapGraphics.strokePath();
    }
  }

  private setPlayerWeapon(type: WeaponType) {
      const stats = WEAPON_STATS[type];
      this.player.setWeapon(type, stats.clipSize);
      this.updateAmmoUI();
  }

  private updateAmmoUI() {
      this.stats.ammo = this.player.currentAmmo;
      this.stats.maxAmmo = this.player.maxAmmo;
      this.stats.isReloading = this.player.isReloading;
      EventBus.emit(EVENTS.PLAYER_UPDATE, this.stats);
  }

  private handleReloadInput() {
      if (this.reloadKey.isDown && !this.player.isReloading && this.player.currentAmmo < this.player.maxAmmo) {
          const stats = WEAPON_STATS[this.player.weaponType];
          if (!stats.isMelee) {
              this.reloadWeapon(this.player);
          }
      }
  }

  private reloadWeapon(unit: StickFigure) {
      if (unit.isReloading) return;
      const stats = WEAPON_STATS[unit.weaponType];
      if (stats.isMelee) return; 

      unit.isReloading = true;
      if (unit === this.player) this.updateAmmoUI();
      
      unit.playReloadAnimation(); // Visual reload

      const reloadTime = stats.reloadTime;
      this.tweens.addCounter({
          from: 0, to: 1, duration: reloadTime,
          onUpdate: (tween) => {
              if (!unit.active) {
                  tween.stop();
                  return;
              }
              unit.drawReloadBar(tween.getValue());
          },
          onComplete: () => {
              if (!unit.active) return;
              unit.isReloading = false;
              unit.currentAmmo = unit.maxAmmo;
              unit.drawReloadBar(0); 
              if (unit === this.player) this.updateAmmoUI();
          }
      });
  }

  private handleHealthRegen(time: number, delta: number) {
      if (time > this.lastDamageTime + this.REGEN_DELAY && this.player.hp < 100) {
          const regenRate = 0.04; 
          const amount = regenRate * delta;
          this.player.hp = Math.min(100, this.player.hp + amount);
          this.stats.health = this.player.hp;
          EventBus.emit(EVENTS.PLAYER_UPDATE, this.stats);

          if (Math.random() > 0.85) {
              const part = this.add.circle(
                  this.player.x + (Math.random() - 0.5) * 25,
                  this.player.y + (Math.random() - 0.5) * 25,
                  2, 0x00ff00
              );
              this.tweens.add({
                  targets: part, y: part.y - 20, alpha: 0, duration: 600,
                  onComplete: () => part.destroy()
              });
          }
      }
  }

  private hasLineOfSight(source: {x: number, y: number}, target: {x: number, y: number}): boolean {
      const line = new Phaser.Geom.Line(source.x, source.y, target.x, target.y);
      // wallBounds is populated during map creation
      for(const rect of this.wallBounds) {
          if (Phaser.Geom.Intersects.LineToRectangle(line, rect)) {
              return false;
          }
      }
      return true;
  }

  private handleMovement() {
    const speed = 350; 
    let velocityX = 0;
    let velocityY = 0;

    if (this.wasdKeys.left.isDown || this.cursorKeys.left.isDown) velocityX = -1;
    else if (this.wasdKeys.right.isDown || this.cursorKeys.right.isDown) velocityX = 1;

    if (this.wasdKeys.up.isDown || this.cursorKeys.up.isDown) velocityY = -1;
    else if (this.wasdKeys.down.isDown || this.cursorKeys.down.isDown) velocityY = 1;

    if (this.moveStick.x !== 0 || this.moveStick.y !== 0) {
      velocityX = this.moveStick.x;
      velocityY = this.moveStick.y;
    }

    const vec = new Phaser.Math.Vector2(velocityX, velocityY);
    if (vec.length() > 0) {
      vec.normalize().scale(speed);
      this.player.setVelocity(vec.x, vec.y);
    } else {
      this.player.setVelocity(0, 0);
    }
  }

  private handleAiming() {
    let aimAngle = this.player.rotation;
    
    // Priority to Virtual Joystick (Touch)
    if (this.aimStick.active && (this.aimStick.x !== 0 || this.aimStick.y !== 0)) {
        aimAngle = Math.atan2(this.aimStick.y, this.aimStick.x);
        this.player.setRotation(aimAngle);

        // Update reticle for joystick
        if (this.reticle) {
             const dist = 250;
             this.reticle.setPosition(
                 this.player.x + Math.cos(aimAngle) * dist,
                 this.player.y + Math.sin(aimAngle) * dist
             );
             this.reticle.setVisible(true);
        }
    } else {
        // Fallback to Mouse/Pointer Aim (Desktop)
        // CRITICAL FIX: Use mousePointer specifically for desktop to avoid ambiguity with activePointer
        // pointer.x/y returns SCREEN coordinates (e.g. 0-windowWidth).
        // Since the camera moves, we must convert this to World coordinates to aim correctly.
        const pointer = this.input.mousePointer;
        const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        
        aimAngle = Phaser.Math.Angle.Between(this.player.x, this.player.y, worldPoint.x, worldPoint.y);
        this.player.setRotation(aimAngle);

        if (this.reticle) {
             this.reticle.setPosition(worldPoint.x, worldPoint.y);
             this.reticle.setVisible(true);
        }
    }
  }

  private handleAttacks(time: number) {
    // 1. Mobile Joystick Fire (Threshold check)
    const isMobileFiring = this.aimStick.active && (Math.abs(this.aimStick.x) > 0.3 || Math.abs(this.aimStick.y) > 0.3);
    
    // 2. Mouse Fire
    // Allow firing if the mouse is clicked, provided we aren't currently using the touch joystick.
    // Explicitly check primaryDown for left click on the mousePointer specifically.
    const isMouseFiring = !this.aimStick.active && (this.input.mousePointer.primaryDown || this.input.mousePointer.isDown);
    
    if (isMobileFiring || isMouseFiring) {
       this.executeAttack(this.player, this.bullets, true);
    }
  }

  private executeAttack(unit: StickFigure, bulletGroup: Phaser.Physics.Arcade.Group, isPlayer: boolean) {
      if (unit.isReloading) return; 

      const now = this.time.now;
      const stats = WEAPON_STATS[unit.weaponType];

      if (now > unit.lastFired + stats.cooldown) {
          if (!stats.isMelee) {
              if (unit.currentAmmo <= 0) {
                  this.reloadWeapon(unit);
                  return;
              }
              unit.currentAmmo--;
              if (isPlayer) this.updateAmmoUI();
          }

          unit.lastFired = now;
          unit.playAttackAnimation();

          if (stats.isMelee) {
              this.performMeleeAttack(unit, stats, isPlayer);
          } else {
              this.fireBullet(unit, bulletGroup, stats.color, stats.speed, stats.damage, unit.weaponType);
          }
      }
  }

  private performMeleeAttack(attacker: StickFigure, stats: any, isPlayer: boolean) {
      const range = stats.range;
      const angle = attacker.rotation;
      
      const slash = this.add.graphics();
      slash.lineStyle(2, 0xffffff, 0.8);
      slash.beginPath();
      slash.arc(attacker.x, attacker.y, range, angle - 0.7, angle + 0.7, false);
      slash.strokePath();
      this.tweens.add({ targets: slash, alpha: 0, duration: 200, onComplete: () => slash.destroy() });

      const potentialVictims: StickFigure[] = [];
      if (!isPlayer && !this.player.isDead) potentialVictims.push(this.player);

      this.enemies.getChildren().forEach((e: any) => {
          if (e !== attacker && !e.isDead && e.active) {
              potentialVictims.push(e);
          }
      });

      potentialVictims.forEach(victim => {
          const dist = Phaser.Math.Distance.Between(attacker.x, attacker.y, victim.x, victim.y);
          if (dist < range) {
               // WALL FIX: Check for Line of Sight to ensure swords don't go through walls
               if (!this.hasLineOfSight({x: attacker.x, y: attacker.y}, {x: victim.x, y: victim.y})) {
                   return;
               }

               const angleToVictim = Phaser.Math.Angle.Between(attacker.x, attacker.y, victim.x, victim.y);
               const diff = Phaser.Math.Angle.Wrap(angleToVictim - attacker.rotation);
               if (Math.abs(diff) < 1.0) {
                   if (victim === this.player) {
                        this.damagePlayer(stats.damage, attacker.x, attacker.y);
                   } else {
                        this.damageEnemy(victim, stats.damage, attacker);
                   }
               }
          }
      });
  }

  private fireBullet(shooter: StickFigure, group: Phaser.Physics.Arcade.Group, color: number, speed: number, damage: number, weaponType: WeaponType) {
    const startPos = shooter.getBarrelPosition();
    
    // Check wall obstruction
    const lineOfFire = new Phaser.Geom.Line(shooter.x, shooter.y, startPos.x, startPos.y);
    let blocked = false;
    for(const rect of this.wallBounds) {
        if (Phaser.Geom.Intersects.LineToRectangle(lineOfFire, rect)) {
            blocked = true;
            break;
        }
    }
    if (blocked) {
        const spark = this.add.circle(startPos.x, startPos.y, 3, 0xffff00);
        this.tweens.add({ targets: spark, alpha: 0, scale: 2, duration: 100, onComplete: () => spark.destroy() });
        return;
    }

    const stats = WEAPON_STATS[weaponType];
    const pelletCount = (stats as any).pellets || 1;

    for(let i=0; i < pelletCount; i++) {
        const bullet = group.get(startPos.x, startPos.y) as any;
        if (bullet) {
            bullet.setActive(true).setVisible(true);
            bullet.damageAmount = damage;
            bullet.weaponType = weaponType;
            bullet.sourceX = shooter.x;
            bullet.sourceY = shooter.y;
            bullet.owner = shooter;

            // Visuals
            if (weaponType === WeaponType.AK47) {
                bullet.setTexture('bullet_tracer');
                bullet.setTint(0xffaa00);
                if (bullet.body) bullet.body.setCircle(2);
            } else if (weaponType === WeaponType.SHOTGUN) {
                 bullet.setTexture('bullet_pellet');
                 bullet.setTint(0xff0000); // Red pellets
                 bullet.setScale(1.2);
                 if (bullet.body) bullet.body.setCircle(3);
            } else {
                bullet.setTexture('bullet_pellet');
                bullet.setTint(0xffff00);
                bullet.setScale(1);
                if (bullet.body) bullet.body.setCircle(2);
            }

            let angle = shooter.rotation + (shooter.aimSway || 0);
            
            // --- BOT INACCURACY CHANGE ---
            if (shooter !== this.player) {
                // Add random error to bot aim (+/- ~11 degrees)
                angle += (Math.random() - 0.5) * 0.4;
            }

            let spread = 0;

            if (weaponType === WeaponType.UZI) {
                spread = (Math.random() - 0.5) * 0.3;
            } else if (weaponType === WeaponType.AK47) {
                spread = (Math.random() - 0.5) * 0.05;
            } else if (weaponType === WeaponType.SHOTGUN) {
                spread = (Math.random() - 0.5) * 0.6; // Wide spread
            }

            const finalAngle = angle + spread;
            
            // Variance in speed for shotgun to make it look less uniform
            let actualSpeed = speed;
            if (weaponType === WeaponType.SHOTGUN) {
                actualSpeed = speed * (0.8 + Math.random() * 0.4);
            }

            const vec = this.physics.velocityFromRotation(finalAngle, actualSpeed);
            bullet.setRotation(finalAngle);

            if (bullet.body) {
                bullet.body.reset(startPos.x, startPos.y);
                bullet.setVelocity(vec.x, vec.y);
            }
        }
    }
  }

  private spawnEnemy() {
    const maxEnemies = 3 + Math.floor(this.stats.wave / 2);
    if (this.enemies.countActive() >= maxEnemies) return;

    let x = 0, y = 0;
    let valid = false;
    let attempts = 0;

    while (!valid && attempts < 20) {
        x = Phaser.Math.Between(100, 1500);
        y = Phaser.Math.Between(100, 1500);
        const gx = Math.floor(x / 50);
        const gy = Math.floor(y / 50);
        
        // Check navgrid from Pathfinder system
        if (this.pathfinder.isValidTile(gx, gy)) {
             if (Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) > 400) {
                 valid = true;
             }
        }
        attempts++;
    }

    if (valid) {
        const names = ['Noob', 'Camper', 'Lag', 'Bot_01', 'X_x_X', 'Reaper', 'Guest123', 'Sniper'];
        const name = Phaser.Utils.Array.GetRandom(names);

        const weaponTypes = [WeaponType.BAT, WeaponType.KATANA, WeaponType.UZI, WeaponType.AK47, WeaponType.SHOTGUN];
        const randomWeapon = Phaser.Utils.Array.GetRandom(weaponTypes);
        const color = 0xff0000; 
        const stats = WEAPON_STATS[randomWeapon];

        const enemy = new StickFigure(this, x, y, color, name, randomWeapon);
        enemy.lastFired = this.time.now + Phaser.Math.Between(0, 2000);
        enemy.setWeapon(randomWeapon, stats.clipSize);
        
        this.enemies.add(enemy);
    }
  }

  private handleEnemies(time: number) {
    let pathUpdateBudget = 1; 

    this.enemies.getChildren().forEach((e: any) => {
      const enemy = e as StickFigure;
      if (enemy && !enemy.isDead) {
        
        let target: StickFigure | null = null;
        let minDist = Infinity;

        if (!this.player.isDead) {
            const d = Phaser.Math.Distance.Between(enemy.x, enemy.y, this.player.x, this.player.y);
            target = this.player;
            minDist = d;
        }

        this.enemies.getChildren().forEach((other: any) => {
            if (other !== enemy && !other.isDead && other.active) {
                const d = Phaser.Math.Distance.Between(enemy.x, enemy.y, other.x, other.y);
                if (d < minDist) {
                    minDist = d;
                    target = other;
                }
            }
        });

        if (!target) {
            enemy.setVelocity(0,0);
            return; 
        }

        const distToTarget = minDist;
        const stats = WEAPON_STATS[enemy.weaponType];
        
        if (!stats.isMelee && enemy.currentAmmo <= 0) {
            this.reloadWeapon(enemy);
        }
        
        let attackRange = stats.isMelee ? stats.range + 20 : (enemy.weaponType === WeaponType.SHOTGUN ? 300 : 600);
        let stopDist = stats.isMelee ? 40 : (enemy.weaponType === WeaponType.UZI || enemy.weaponType === WeaponType.SHOTGUN ? 150 : 250);

        // --- FIXED: Persist LOS state to prevent shooting through walls ---
        // Only check LOS every 200ms to save CPU
        if (time - enemy.lastLOSTime > 200) { 
            enemy.lastLOSTime = time;
            enemy.hasLOS = this.hasLineOfSight({x: enemy.x, y: enemy.y}, {x: target.x, y: target.y});
        } 
        
        // If we have LOS, we can move directly and attack.
        // If we do NOT have LOS, we must use pathfinding and cannot attack (unless melee).

        if (distToTarget < stopDist && enemy.hasLOS) {
             // Stop and shoot if close enough and we see them
             enemy.setVelocity(0, 0);
             enemy.setRotation(Phaser.Math.Angle.Between(enemy.x, enemy.y, target.x, target.y));
        } else {
             // Movement Logic
             if (enemy.hasLOS) {
                 // Direct movement (cheaper/smoother) if we see them
                 this.physics.moveToObject(enemy, target, 160);
                 enemy.setRotation(Phaser.Math.Angle.Between(enemy.x, enemy.y, target.x, target.y));
                 enemy.currentPath = [];
                 enemy.pathIndex = 0;
             } else {
                 // No LOS -> Use Pathfinding
                 if (pathUpdateBudget > 0 && (
                     enemy.currentPath.length === 0 || 
                     enemy.pathIndex >= enemy.currentPath.length || 
                     time - enemy.lastPathTime > 500)) { 
                     
                     pathUpdateBudget--;
                     enemy.currentPath = this.pathfinder.findPath(
                         new Phaser.Math.Vector2(enemy.x, enemy.y), 
                         new Phaser.Math.Vector2(target.x, target.y)
                     );
                     enemy.pathIndex = 0;
                     enemy.lastPathTime = time;
                 }

                 if (enemy.currentPath.length > 0 && enemy.pathIndex < enemy.currentPath.length) {
                     const nextNode = enemy.currentPath[enemy.pathIndex];
                     const distToNode = Phaser.Math.Distance.Between(enemy.x, enemy.y, nextNode.x, nextNode.y);
                     
                     if (distToNode < 10) {
                         enemy.pathIndex++;
                     }
                     
                     if (enemy.pathIndex < enemy.currentPath.length) {
                         const moveNode = enemy.currentPath[enemy.pathIndex];
                         this.physics.moveTo(enemy, moveNode.x, moveNode.y, 160);
                         enemy.setRotation(Phaser.Math.Angle.Between(enemy.x, enemy.y, moveNode.x, moveNode.y));
                     }
                 } else {
                     enemy.setVelocity(0, 0);
                 }
             }
        }

        // Attack Logic
        if (distToTarget < attackRange) {
             // STRICT LOS CHECK FOR ALL WEAPONS (Removed isMelee bypass)
             // Bots should not attack through walls
             if (enemy.hasLOS) {
                 this.executeAttack(enemy, this.enemyBullets, false);
             }
        }
      }
    });
  }

  private handleBulletEnemyCollision(bullet: any, enemy: any) {
    if (bullet.active && enemy.active) {
      bullet.destroy();
      const damage = bullet.damageAmount || 10;
      this.damageEnemy(enemy, damage, this.player); 
    }
  }

  private handleEnemyBulletHitEnemy(bullet: any, enemy: any) {
      if (bullet.active && enemy.active) {
          if (bullet.owner === enemy) return;
          bullet.destroy();
          const damage = bullet.damageAmount || 10;
          const attacker = bullet.owner;
          this.damageEnemy(enemy, damage, attacker);
      }
  }

  private showHitMarker(target: StickFigure, kill: boolean) {
      if (this.reticle) {
          const x = this.reticle.x;
          const y = this.reticle.y;
          const marker = this.add.sprite(x, y, 'hitmarker').setDepth(1000);
          if (kill) {
              marker.setTint(0xff0000).setScale(2.0);
          } else {
              marker.setTint(0xffffff).setScale(1.2);
          }
          this.tweens.add({
              targets: marker, alpha: 0, scale: marker.scale * 0.5, duration: 150,
              onComplete: () => marker.destroy()
          });
      }

      if (this.player && !this.player.isDead) {
          const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, target.x, target.y);
          const radius = 60;
          const ix = this.player.x + Math.cos(angle) * radius;
          const iy = this.player.y + Math.sin(angle) * radius;
          
          const indicator = this.add.sprite(ix, iy, 'hit_indicator').setDepth(1001);
          indicator.setRotation(angle);
          indicator.setTint(kill ? 0xff0000 : 0xffffff);
          
          this.tweens.add({
              targets: indicator, alpha: 0, scale: 1.5, duration: 200,
              onComplete: () => indicator.destroy()
          });
      }

      this.activeTracers.push({
          x1: this.player.x, y1: this.player.y, x2: target.x, y2: target.y,
          alpha: 1, color: kill ? 0xff0000 : 0xffffff
      });
      
      this.cameras.main.shake(50, 0.001); 
  }

  private showDamageNumber(x: number, y: number, amount: number, isCrit: boolean) {
      const text = this.add.text(x, y - 30, amount.toString(), {
          fontSize: isCrit ? '24px' : '16px', color: isCrit ? '#ff0000' : '#ffffff',
          stroke: '#000000', strokeThickness: 2, fontFamily: 'Arial'
      }).setOrigin(0.5).setDepth(1000);

      this.tweens.add({
          targets: text, y: y - 80, alpha: 0, duration: 800,
          onComplete: () => text.destroy()
      });
      return text;
  }

  private damageEnemy(enemy: StickFigure, amount: number, attacker?: StickFigure) {
      if (typeof enemy.takeDamage === 'function') {
          enemy.takeDamage(amount);
      } else { return; }

      const isKill = enemy.isDead;
      const isPlayerAttack = (attacker === this.player);
      
      if (isPlayerAttack) {
          this.showHitMarker(enemy, isKill);
          this.showDamageNumber(enemy.x, enemy.y, amount, isKill);
      } else {
          this.showDamageNumber(enemy.x, enemy.y, amount, isKill).setScale(0.7).setAlpha(0.8);
      }

      if (isKill) {
        this.spawnWeaponDrop(enemy.x, enemy.y, enemy.weaponType);
        if (isPlayerAttack) {
            this.stats.kills++;
            this.stats.score += 100;
            EventBus.emit(EVENTS.BOT_KILLED, { name: (enemy as any).nameText.text });
            EventBus.emit(EVENTS.PLAYER_UPDATE, this.stats);
        }
      }
  }

  private spawnWeaponDrop(x: number, y: number, type: WeaponType) {
      const dropKey = `drop_${type}`;
      const drop = this.weaponDrops.create(x, y, dropKey);
      drop.weaponType = type;
      drop.setDepth(5);
      
      this.tweens.add({
          targets: drop, y: y - 5, yoyo: true, duration: 1000,
          repeat: -1, ease: 'Sine.easeInOut'
      });
      
      const glow = this.add.circle(x, y, 20);
      glow.setStrokeStyle(2, 0xffff00, 0.5);
      this.tweens.add({
          targets: glow, scale: 1.5, alpha: 0, duration: 1000, repeat: -1
      });
      drop.glowEffect = glow;

      this.time.delayedCall(30000, () => {
          if(drop.active) {
              if(drop.glowEffect) drop.glowEffect.destroy();
              drop.destroy();
          }
      });
  }

  private handleWeaponPickup(player: any, drop: any) {
      if (!drop.active) return;
      const newWeapon = drop.weaponType as WeaponType;
      this.showDamageNumber(player.x, player.y - 20, 0, false).setText(`Picked up ${newWeapon}`);
      this.setPlayerWeapon(newWeapon);
      if (drop.glowEffect) drop.glowEffect.destroy();
      drop.destroy();
  }
  
  private handleBulletWallCollision(bullet: any, wall: any) {
      if (bullet.active) {
          bullet.destroy();
      }
  }

  private handlePlayerHitByBullet(player: any, bullet: any) {
      if (bullet.active && !this.player.isDead) {
          if (bullet.owner === player) return;
          const damage = bullet.damageAmount || 10;
          const sourceX = bullet.sourceX || bullet.x;
          const sourceY = bullet.sourceY || bullet.y;
          bullet.destroy();
          this.damagePlayer(damage, sourceX, sourceY);
      }
  }

  private showDamageReceived(sourceX: number, sourceY: number) {
      if (this.player && !this.player.isDead) {
          const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, sourceX, sourceY);
          const radius = 60;
          const ix = this.player.x + Math.cos(angle) * radius;
          const iy = this.player.y + Math.sin(angle) * radius;
          
          const indicator = this.add.sprite(ix, iy, 'hit_indicator').setDepth(1001);
          indicator.setRotation(angle);
          indicator.setTint(0xff0000);
          
          this.tweens.add({
              targets: indicator, alpha: 0, scale: 1.5, duration: 400,
              onComplete: () => indicator.destroy()
          });
      }

      this.cameras.main.flash(100, 128, 0, 0);

      for(let i=0; i<5; i++) {
          const blood = this.add.circle(this.player.x, this.player.y, Phaser.Math.Between(2, 5), 0xcc0000);
          const angle = Phaser.Math.Angle.Between(sourceX, sourceY, this.player.x, this.player.y) + (Math.random()-0.5);
          const speed = Phaser.Math.Between(50, 150);
          const vec = this.physics.velocityFromRotation(angle, speed);
          
          this.physics.add.existing(blood);
          (blood.body as Phaser.Physics.Arcade.Body).setVelocity(vec.x, vec.y);
          (blood.body as Phaser.Physics.Arcade.Body).setDrag(200);
          
          this.tweens.add({
              targets: blood, alpha: 0, scale: 0, duration: 500,
              onComplete: () => blood.destroy()
          });
      }
  }

  private damagePlayer(amount: number, sourceX: number = 0, sourceY: number = 0) {
      if (this.player.isDead) return;
      
      this.lastDamageTime = this.time.now;
      this.player.takeDamage(amount);
      this.stats.health = this.player.hp;
      EventBus.emit(EVENTS.PLAYER_UPDATE, this.stats);

      this.showDamageReceived(sourceX, sourceY);

      if (this.player.isDead) {
          EventBus.emit(EVENTS.GAME_OVER, { score: this.stats.score, kills: this.stats.kills });
      }
  }
}