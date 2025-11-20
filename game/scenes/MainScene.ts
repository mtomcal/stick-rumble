import Phaser from 'phaser';
import { EventBus } from '../EventBus';
import { StickFigure } from '../objects/StickFigure';
import { EVENTS, WeaponType } from '../../types';

// Updated Stats: Clip Size & Reload Time
// UZI: High Capacity (30), Fast Reload (1.2s), Low Dmg
// AK47: Medium Capacity (20), Slow Reload (2.0s), High Dmg
const WEAPON_STATS = {
  [WeaponType.BAT]: { damage: 60, cooldown: 425, range: 90, isMelee: true, color: 0xcccccc, speed: 0, clipSize: 0, reloadTime: 0 },
  [WeaponType.KATANA]: { damage: 100, cooldown: 800, range: 110, isMelee: true, color: 0xffffff, speed: 0, clipSize: 0, reloadTime: 0 },
  [WeaponType.UZI]: { damage: 8, cooldown: 100, range: 600, isMelee: false, color: 0xffff00, speed: 850, clipSize: 30, reloadTime: 1200 },
  [WeaponType.AK47]: { damage: 20, cooldown: 150, range: 1000, isMelee: false, color: 0xffaa00, speed: 1250, clipSize: 20, reloadTime: 2000 },
};

interface Tracer {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    alpha: number;
    color: number;
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
  
  // Optimization: Cache wall bounds to avoid getBounds() calls every frame (GC heavy)
  private wallBounds: Phaser.Geom.Rectangle[] = [];
  
  // Debug
  private debugText!: Phaser.GameObjects.Text;

  private cursorKeys!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasdKeys!: any;
  private reloadKey!: Phaser.Input.Keyboard.Key;
  
  private stats = {
    health: 100,
    ammo: 20,
    maxAmmo: 20,
    isReloading: false,
    score: 0,
    kills: 0,
    wave: 1,
    isGameOver: false
  };

  private moveStick = { x: 0, y: 0 };
  private aimStick = { x: 0, y: 0, active: false };

  // Navigation Grid for Pathfinding
  private navGrid: boolean[][] = [];
  private tileSize: number = 50; // Grid size
  private gridWidth: number = 0;
  private gridHeight: number = 0;

  // Health Regen
  private lastDamageTime: number = 0;
  private readonly REGEN_DELAY = 3000; // 3 seconds before regen starts

  constructor() {
    super('MainScene');
  }

  preload() {
    // Placeholder for characters
    const graphics = this.make.graphics({ x: 0, y: 0, add: false });
    graphics.fillStyle(0xffffff);
    graphics.fillCircle(15, 15, 15);
    graphics.generateTexture('placeholder', 30, 30);

    // Bullet Texture: Pellet (Small round dot)
    const pelletGfx = this.make.graphics({ x: 0, y: 0, add: false });
    pelletGfx.fillStyle(0xffffaa);
    pelletGfx.fillCircle(2, 2, 2);
    pelletGfx.generateTexture('bullet_pellet', 4, 4);

    // Bullet Texture: Tracer (Thin line)
    const tracerGfx = this.make.graphics({ x: 0, y: 0, add: false });
    tracerGfx.fillStyle(0xffffcc);
    tracerGfx.fillRect(0, 0, 20, 2);
    tracerGfx.generateTexture('bullet_tracer', 20, 2);

    // Reticle Texture
    const reticleGfx = this.make.graphics({ x: 0, y: 0, add: false });
    reticleGfx.lineStyle(2, 0xffffff, 1);
    reticleGfx.strokeCircle(16, 16, 10); // Outer ring
    
    reticleGfx.beginPath();
    reticleGfx.moveTo(16, 2); reticleGfx.lineTo(16, 8);   // Top
    reticleGfx.moveTo(16, 24); reticleGfx.lineTo(16, 30); // Bottom
    reticleGfx.moveTo(2, 16); reticleGfx.lineTo(8, 16);   // Left
    reticleGfx.moveTo(24, 16); reticleGfx.lineTo(30, 16); // Right
    reticleGfx.strokePath(); // IMPORTANT: Render the lines

    reticleGfx.fillStyle(0xff0000, 1);
    reticleGfx.fillCircle(16, 16, 2); // Center Dot
    reticleGfx.generateTexture('reticle', 32, 32);

    // Hit Marker Texture ('X')
    const hitGfx = this.make.graphics({ x: 0, y: 0, add: false });
    hitGfx.lineStyle(3, 0xffffff, 1);
    hitGfx.beginPath();
    hitGfx.moveTo(2, 2); hitGfx.lineTo(18, 18);
    hitGfx.moveTo(18, 2); hitGfx.lineTo(2, 18);
    hitGfx.strokePath();
    hitGfx.generateTexture('hitmarker', 20, 20);

    // Directional Hit Indicator (Chevron)
    const dirIndGfx = this.make.graphics({ x: 0, y: 0, add: false });
    dirIndGfx.fillStyle(0xffffff, 1);
    dirIndGfx.beginPath();
    // Draw a chevron pointing right
    dirIndGfx.moveTo(0, 0);
    dirIndGfx.lineTo(16, 8);
    dirIndGfx.lineTo(0, 16);
    dirIndGfx.lineTo(4, 8);
    dirIndGfx.closePath();
    dirIndGfx.fillPath();
    dirIndGfx.generateTexture('hit_indicator', 16, 16);

    // --- Weapon Drop Icons ---
    const createDropIcon = (key: string, color: number, w: number, h: number) => {
        const g = this.make.graphics({ x: 0, y: 0, add: false });
        g.fillStyle(0x000000, 0.5); // Shadow
        g.fillCircle(w/2 + 2, h/2 + 2, Math.max(w,h)/2);
        g.fillStyle(color, 1);
        g.fillRect(0, 0, w, h);
        g.lineStyle(1, 0xffffff, 0.8); // Outline
        g.strokeRect(0, 0, w, h);
        g.generateTexture(key, w, h);
    };
    
    createDropIcon('drop_BAT', 0xcccccc, 30, 6);
    createDropIcon('drop_KATANA', 0xffffff, 40, 4);
    createDropIcon('drop_UZI', 0x333333, 20, 12);
    createDropIcon('drop_AK47', 0x5d4037, 40, 8);
  }

  create() {
    this.input.setDefaultCursor('none'); // Hide system cursor

    this.stats = {
      health: 100,
      ammo: 0,
      maxAmmo: 0,
      isReloading: false,
      score: 0,
      kills: 0,
      wave: 1,
      isGameOver: false
    };
    this.lastDamageTime = 0;

    this.cameras.main.setBackgroundColor('#cfd8dc'); 
    this.physics.world.setBounds(0, 0, 1600, 1600);
    
    this.walls = this.physics.add.staticGroup();
    this.createOfficeLayout();
    this.buildNavGrid(); // Build pathfinding grid after walls

    this.drawFloorGrid(); 

    // Random Start Weapon
    const startWeapons = [WeaponType.BAT, WeaponType.UZI, WeaponType.AK47, WeaponType.KATANA];
    const myWeapon = Phaser.Utils.Array.GetRandom(startWeapons);

    this.player = new StickFigure(this, 800, 800, 0x222222, 'YOU', myWeapon);
    // Initialize ammo
    this.setPlayerWeapon(myWeapon);

    this.cameras.main.startFollow(this.player);

    // Create Reticle
    this.reticle = this.add.sprite(800, 800, 'reticle').setDepth(100).setAlpha(0.8);

    this.enemies = this.physics.add.group({ runChildUpdate: true });
    this.weaponDrops = this.physics.add.group();
    
    this.bullets = this.physics.add.group({ defaultKey: 'bullet_pellet', maxSize: 50 });
    this.enemyBullets = this.physics.add.group({ defaultKey: 'bullet_pellet', maxSize: 50 });

    if (this.input.keyboard) {
        this.cursorKeys = this.input.keyboard.createCursorKeys();
        this.reloadKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);
        this.wasdKeys = this.input.keyboard.addKeys({
          up: Phaser.Input.Keyboard.KeyCodes.W,
          down: Phaser.Input.Keyboard.KeyCodes.S,
          left: Phaser.Input.Keyboard.KeyCodes.A,
          right: Phaser.Input.Keyboard.KeyCodes.D
        });
    }

    // Minimap Graphics (Top Left) - Split into Static and Dynamic for Performance
    this.minimapStaticGraphics = this.add.graphics();
    this.minimapStaticGraphics.setScrollFactor(0);
    this.minimapStaticGraphics.setDepth(1999); 

    this.minimapGraphics = this.add.graphics();
    this.minimapGraphics.setScrollFactor(0); // Fixed to screen
    this.minimapGraphics.setDepth(2000); // Above everything

    this.drawMinimapStatic();

    // Persistent Tracer Graphics to avoid GC spam
    this.tracerGraphics = this.add.graphics().setDepth(999);

    // Collisions
    this.physics.add.collider(this.player, this.enemies, undefined, undefined, this);
    this.physics.add.overlap(this.player, this.weaponDrops, this.handleWeaponPickup, undefined, this);
    
    // Projectile Collisions
    this.physics.add.collider(this.bullets, this.enemies, this.handleBulletEnemyCollision, undefined, this);
    this.physics.add.collider(this.player, this.enemyBullets, this.handlePlayerHitByBullet, undefined, this);
    
    // Bot-on-Bot Collisions
    this.physics.add.collider(this.enemies, this.enemies);
    // Enemies can shoot each other now
    // IMPORTANT: overlap(obj1, obj2, cb) -> cb(obj1, obj2)
    // obj1 = enemyBullets, obj2 = enemies
    // cb = (bullet, enemy)
    this.physics.add.overlap(this.enemyBullets, this.enemies, this.handleEnemyBulletHitEnemy, undefined, this);

    this.physics.add.collider(this.player, this.walls);
    this.physics.add.collider(this.enemies, this.walls);
    this.physics.add.collider(this.bullets, this.walls, this.handleBulletWallCollision, undefined, this);
    this.physics.add.collider(this.enemyBullets, this.walls, this.handleBulletWallCollision, undefined, this);

    this.time.addEvent({
      delay: 1500,
      callback: this.spawnEnemy,
      callbackScope: this,
      loop: true
    });

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
        this.input.setDefaultCursor('default'); // Restore cursor on exit
        this.activeTracers = []; // Clear tracers
    });

    // Debug Text
    this.debugText = this.add.text(10, 150, '', {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#00ff00',
        backgroundColor: '#00000088'
    }).setScrollFactor(0).setDepth(9999);
  }

  update(time: number, delta: number) {
    const start = performance.now();

    if (!this.player || this.player.isDead) return;

    this.handleMovement();
    this.handleAiming();
    this.handleAttacks(time);
    this.handleReloadInput();
    
    // --- AI ---
    const aiStart = performance.now();
    this.handleEnemies(time);
    const aiEnd = performance.now();

    this.handleHealthRegen(time, delta);
    this.updateMinimap();
    this.updateTracers(delta);
    
    const cleanupBullets = (group: Phaser.Physics.Arcade.Group) => {
        group.getChildren().forEach((b: any) => {
            if (b.active && (b.x < 0 || b.x > 1600 || b.y < 0 || b.y > 1600)) {
              b.destroy();
            }
        });
    }
    cleanupBullets(this.bullets);
    cleanupBullets(this.enemyBullets);

    const end = performance.now();
    
    // Debug output
    if (this.debugText) {
        this.debugText.setText([
            `FPS: ${Math.round(1000/delta)}`,
            `Update: ${(end - start).toFixed(2)}ms`,
            `AI: ${(aiEnd - aiStart).toFixed(2)}ms`,
            `E: ${this.enemies.countActive()} | B: ${this.bullets.countActive() + this.enemyBullets.countActive()}`
        ]);
    }
  }

  private updateTracers(delta: number) {
      if (!this.tracerGraphics) return;
      
      this.tracerGraphics.clear();
      
      for (let i = this.activeTracers.length - 1; i >= 0; i--) {
          const t = this.activeTracers[i];
          t.alpha -= (delta / 150); // Fade out over 150ms
          
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

    const scale = 0.075; // Reduced scale (25% smaller than 0.1)
    const mapX = 20;
    const mapY = 20;
    const mapSize = 1600 * scale;

    // Background
    this.minimapStaticGraphics.fillStyle(0x000000, 0.7);
    this.minimapStaticGraphics.fillRect(mapX, mapY, mapSize, mapSize);
    this.minimapStaticGraphics.lineStyle(2, 0xffffff, 0.5);
    this.minimapStaticGraphics.strokeRect(mapX, mapY, mapSize, mapSize);

    // Walls - Draw once to static graphics
    this.minimapStaticGraphics.fillStyle(0x555555, 1);
    const walls = this.walls.getChildren();
    // Cache bounds here as well for later usage
    this.wallBounds = [];
    for (const wall of walls) {
        const rect = (wall as Phaser.GameObjects.Rectangle);
        // Store the bounds for physics optimization
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

    const scale = 0.075; // Must match static scale
    const mapX = 20;
    const mapY = 20;

    // Enemies (Dynamic)
    this.minimapGraphics.fillStyle(0xff0000, 1);
    const enemies = this.enemies.getChildren();
    for (const e of enemies) {
        const enemy = e as StickFigure;
        if (enemy.active && !enemy.isDead) {
            this.minimapGraphics.fillCircle(
                mapX + enemy.x * scale,
                mapY + enemy.y * scale,
                3 
            );
        }
    }

    // Player (Dynamic)
    if (this.player && !this.player.isDead) {
        this.minimapGraphics.fillStyle(0x00ff00, 1);
        this.minimapGraphics.fillCircle(
            mapX + this.player.x * scale,
            mapY + this.player.y * scale,
            4
        );
        
        // View direction indicator
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
      if (stats.isMelee) return; // Melee doesn't reload

      unit.isReloading = true;
      
      if (unit === this.player) this.updateAmmoUI();

      // Reload Coroutine
      const reloadTime = stats.reloadTime;
      let elapsed = 0;

      this.tweens.addCounter({
          from: 0,
          to: 1,
          duration: reloadTime,
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
              unit.drawReloadBar(0); // Hide bar
              
              if (unit === this.player) this.updateAmmoUI();
          }
      });
  }

  private handleHealthRegen(time: number, delta: number) {
      // Check delay and if healing is needed
      if (time > this.lastDamageTime + this.REGEN_DELAY && this.player.hp < 100) {
          const regenRate = 0.04; // Approx 40 HP per second
          const amount = regenRate * delta;
          
          this.player.hp = Math.min(100, this.player.hp + amount);
          this.stats.health = this.player.hp;
          EventBus.emit(EVENTS.PLAYER_UPDATE, this.stats);

          // Visual Effect: Green shimmer
          if (Math.random() > 0.85) {
              const part = this.add.circle(
                  this.player.x + (Math.random() - 0.5) * 25,
                  this.player.y + (Math.random() - 0.5) * 25,
                  2, 0x00ff00
              );
              this.tweens.add({
                  targets: part,
                  y: part.y - 20,
                  alpha: 0,
                  duration: 600,
                  onComplete: () => part.destroy()
              });
          }
      }
  }

  private createOfficeLayout() {
    const wallColor = 0x37474f; 
    const deskColor = 0x795548; 

    const createBlock = (x: number, y: number, w: number, h: number, color: number) => {
        const block = this.add.rectangle(x, y, w, h, color);
        this.physics.add.existing(block, true);
        if (block.body instanceof Phaser.Physics.Arcade.Body) {
            block.body.immovable = true;
            block.body.moves = false;
        }
        this.walls.add(block);
        return block;
    };
    
    const createWall = (x: number, y: number, w: number, h: number) => createBlock(x, y, w, h, wallColor);
    const createDesk = (x: number, y: number, w: number, h: number) => {
        const desk = createBlock(x, y, w, h, deskColor);
        desk.setStrokeStyle(2, 0x4e342e);
    };

    // Thicker Boundaries to prevent any escape
    createWall(800, 0, 1600, 120); 
    createWall(800, 1600, 1600, 120); 
    createWall(0, 800, 120, 1600); 
    createWall(1600, 800, 120, 1600); 

    createWall(500, 400, 64, 800); 
    createWall(1100, 1200, 64, 800); 
    createWall(800, 600, 600, 64); 
    createWall(800, 1000, 600, 64); 

    createDesk(250, 250, 160, 100); 
    createDesk(1300, 300, 300, 140); 

    for(let i = 0; i < 3; i++) {
        createDesk(200 + (i*150), 1200, 100, 60);
        createDesk(200 + (i*150), 1400, 100, 60);
    }

    createWall(600, 800, 64, 64);
    createWall(1000, 800, 64, 64);
    createDesk(1400, 1400, 120, 120);
  }

  // --- PATHFINDING HELPERS ---

  private buildNavGrid() {
    this.gridWidth = Math.ceil(1600 / this.tileSize);
    this.gridHeight = Math.ceil(1600 / this.tileSize);
    this.navGrid = [];

    const walls = this.walls.getChildren();

    for (let y = 0; y < this.gridHeight; y++) {
        this.navGrid[y] = [];
        for (let x = 0; x < this.gridWidth; x++) {
            this.navGrid[y][x] = true;
            const cellRect = new Phaser.Geom.Rectangle(
                x * this.tileSize, 
                y * this.tileSize, 
                this.tileSize, 
                this.tileSize
            );
            for (const wall of walls) {
                const wallRect = (wall as Phaser.GameObjects.Rectangle).getBounds();
                if (Phaser.Geom.Intersects.RectangleToRectangle(cellRect, wallRect)) {
                    this.navGrid[y][x] = false;
                    break;
                }
            }
        }
    }
  }

  private findPath(start: Phaser.Math.Vector2, target: Phaser.Math.Vector2): {x: number, y: number}[] {
    try {
      let startX = Math.floor(start.x / this.tileSize);
      let startY = Math.floor(start.y / this.tileSize);
      let endX = Math.floor(target.x / this.tileSize);
      let endY = Math.floor(target.y / this.tileSize);

      if (startX < 0 || startX >= this.gridWidth || startY < 0 || startY >= this.gridHeight) return [];
      
      endX = Phaser.Math.Clamp(endX, 0, this.gridWidth - 1);
      endY = Phaser.Math.Clamp(endY, 0, this.gridHeight - 1);

      // FIX: If target is in a wall (player hugging wall), find nearest open cell
      if (!this.navGrid[endY][endX]) {
          let bestDist = Infinity;
          let bestNode = null;

          // Search radius 2
          for (let y = -2; y <= 2; y++) {
              for (let x = -2; x <= 2; x++) {
                  const nx = endX + x;
                  const ny = endY + y;
                  if (nx >= 0 && nx < this.gridWidth && ny >= 0 && ny < this.gridHeight && this.navGrid[ny][nx]) {
                      const dist = Math.abs(x) + Math.abs(y);
                      if (dist < bestDist) {
                          bestDist = dist;
                          bestNode = {x: nx, y: ny};
                      }
                  }
              }
          }

          if (bestNode) {
              endX = bestNode.x;
              endY = bestNode.y;
          } else {
              return []; // No valid path found
          }
      }

      interface Node {
          x: number; y: number;
          f: number; g: number; h: number;
          parent: Node | null;
      }

      const openSet: Node[] = [];
      const closedSet: Set<string> = new Set();

      openSet.push({ x: startX, y: startY, f: 0, g: 0, h: 0, parent: null });

      let steps = 0;
      const MAX_PATH_STEPS = 500; // Reduced from 1000 to prevent freezing

      while (openSet.length > 0) {
          steps++;
          if (steps > MAX_PATH_STEPS) return []; // Abort if taking too long

          let lowInd = 0;
          for(let i=0; i<openSet.length; i++) {
              if(openSet[i].f < openSet[lowInd].f) lowInd = i;
          }
          const currentNode = openSet[lowInd];

          if (currentNode.x === endX && currentNode.y === endY) {
              const path = [];
              let curr: Node | null = currentNode;
              while (curr) {
                  path.push({ 
                      x: curr.x * this.tileSize + this.tileSize/2, 
                      y: curr.y * this.tileSize + this.tileSize/2 
                  });
                  curr = curr.parent;
              }
              return path.reverse();
          }

          openSet.splice(lowInd, 1);
          closedSet.add(`${currentNode.x},${currentNode.y}`);

          const neighbors = [
              {x: 0, y: -1}, {x: 0, y: 1}, {x: -1, y: 0}, {x: 1, y: 0}
          ];

          for (const offset of neighbors) {
              const nx = currentNode.x + offset.x;
              const ny = currentNode.y + offset.y;

              if (nx < 0 || nx >= this.gridWidth || ny < 0 || ny >= this.gridHeight) continue;
              if (!this.navGrid[ny][nx]) continue;
              if (closedSet.has(`${nx},${ny}`)) continue;

              const gScore = currentNode.g + 1;
              let gScoreIsBest = false;
              let neighborNode = openSet.find(n => n.x === nx && n.y === ny);

              if (!neighborNode) {
                  gScoreIsBest = true;
                  neighborNode = { 
                      x: nx, y: ny, 
                      f: 0, g: gScore, 
                      h: Math.abs(nx - endX) + Math.abs(ny - endY),
                      parent: currentNode 
                  };
                  openSet.push(neighborNode);
              } else if (gScore < neighborNode.g) {
                  gScoreIsBest = true;
              }

              if (gScoreIsBest && neighborNode) {
                  neighborNode.parent = currentNode;
                  neighborNode.g = gScore;
                  neighborNode.f = neighborNode.g + neighborNode.h;
              }
          }
      }
      return [];
    } catch (err) {
      console.error("Pathfinding error", err);
      return [];
    }
  }

  private hasLineOfSight(source: {x: number, y: number}, target: {x: number, y: number}): boolean {
      const line = new Phaser.Geom.Line(source.x, source.y, target.x, target.y);
      // Optimized: Use cached bounds instead of getBounds() which generates new objects
      for(const rect of this.wallBounds) {
          if (Phaser.Geom.Intersects.LineToRectangle(line, rect)) {
              return false;
          }
      }
      return true;
  }

  private drawFloorGrid() {
    const graphics = this.add.graphics();
    graphics.lineStyle(1, 0xb0bec5, 0.5);
    for (let x = 0; x <= 1600; x += 100) {
      graphics.moveTo(x, 0);
      graphics.lineTo(x, 1600);
    }
    for (let y = 0; y <= 1600; y += 100) {
      graphics.moveTo(0, y);
      graphics.lineTo(1600, y);
    }
    graphics.strokePath();
    graphics.setDepth(-1);
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
    let usingMouse = false;
    
    const pointer = this.input.activePointer;
    const isMouse = pointer.pointerType === 'mouse';

    if (this.aimStick.active && (this.aimStick.x !== 0 || this.aimStick.y !== 0)) {
        aimAngle = Math.atan2(this.aimStick.y, this.aimStick.x);
    } else if (isMouse) {
        usingMouse = true;
        const worldPoint = pointer.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
        aimAngle = Phaser.Math.Angle.Between(this.player.x, this.player.y, worldPoint.x, worldPoint.y);
    }
    
    this.player.setRotation(aimAngle);

    if (this.reticle) {
        if (usingMouse) {
             const worldPoint = pointer.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
             this.reticle.setPosition(worldPoint.x, worldPoint.y);
             this.reticle.setVisible(true);
        } else if (this.aimStick.active) {
             const dist = 250;
             this.reticle.setPosition(
                 this.player.x + Math.cos(aimAngle) * dist,
                 this.player.y + Math.sin(aimAngle) * dist
             );
             this.reticle.setVisible(true);
        } else {
            this.reticle.setVisible(false);
        }
    }
  }

  private handleAttacks(time: number) {
    const isMobileFiring = this.aimStick.active && (Math.abs(this.aimStick.x) > 0.3 || Math.abs(this.aimStick.y) > 0.3);
    const pointer = this.input.activePointer;
    const isMouseFiring = pointer.isDown && pointer.pointerType === 'mouse';
    
    if (isMobileFiring || isMouseFiring) {
       this.executeAttack(this.player, this.bullets, true);
    }
  }

  // Centralized attack logic for Player and Bots
  private executeAttack(unit: StickFigure, bulletGroup: Phaser.Physics.Arcade.Group, isPlayer: boolean) {
      if (unit.isReloading) return; // Cannot fire while reloading

      const now = this.time.now;
      const stats = WEAPON_STATS[unit.weaponType];

      if (now > unit.lastFired + stats.cooldown) {
          
          // Ammo Check for Guns
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

      // Check for hits against ALL characters (Player + Enemies)
      const potentialVictims: StickFigure[] = [];
      
      // Add Player if attacker is not player
      if (!isPlayer && !this.player.isDead) potentialVictims.push(this.player);

      // Add all enemies except attacker
      this.enemies.getChildren().forEach((e: any) => {
          if (e !== attacker && !e.isDead && e.active) {
              potentialVictims.push(e);
          }
      });

      potentialVictims.forEach(victim => {
          const dist = Phaser.Math.Distance.Between(attacker.x, attacker.y, victim.x, victim.y);
          if (dist < range) {
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

    const lineOfFire = new Phaser.Geom.Line(shooter.x, shooter.y, startPos.x, startPos.y);
    let blocked = false;
    
    // Optimized: Use cached bounds
    for(const rect of this.wallBounds) {
        if (Phaser.Geom.Intersects.LineToRectangle(lineOfFire, rect)) {
            blocked = true;
            break;
        }
    }

    if (blocked) {
        const spark = this.add.circle(startPos.x, startPos.y, 3, 0xffff00);
        this.tweens.add({
            targets: spark,
            alpha: 0,
            scale: 2,
            duration: 100,
            onComplete: () => spark.destroy()
        });
        return;
    }
    
    const bullet = group.get(startPos.x, startPos.y) as any;
    
    if (bullet) {
      bullet.setActive(true).setVisible(true);
      bullet.damageAmount = damage;
      bullet.weaponType = weaponType; 
      bullet.sourceX = shooter.x;
      bullet.sourceY = shooter.y;
      bullet.owner = shooter; // Mark ownership to prevent self-damage

      if (weaponType === WeaponType.AK47) {
          bullet.setTexture('bullet_tracer');
          bullet.setTint(0xffaa00);
          if (bullet.body) bullet.body.setCircle(2);
      } else {
          bullet.setTexture('bullet_pellet');
          bullet.setTint(0xffff00);
          if (bullet.body) bullet.body.setCircle(2);
      }

      let angle = shooter.rotation;
      let spread = 0;

      if (weaponType === WeaponType.UZI) {
          spread = (Math.random() - 0.5) * 0.3;
      } else if (weaponType === WeaponType.AK47) {
           spread = (Math.random() - 0.5) * 0.05;
      }

      const finalAngle = angle + spread;
      const vec = this.physics.velocityFromRotation(finalAngle, speed);
      
      bullet.setRotation(finalAngle);

      if (bullet.body) {
        bullet.body.reset(startPos.x, startPos.y);
        bullet.setVelocity(vec.x, vec.y);
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
        
        const gx = Math.floor(x / this.tileSize);
        const gy = Math.floor(y / this.tileSize);
        if (this.navGrid[gy] && this.navGrid[gy][gx]) {
             if (Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) > 400) {
                 valid = true;
             }
        }
        attempts++;
    }

    if (valid) {
        const names = ['Noob', 'Camper', 'Lag', 'Bot_01', 'X_x_X', 'Reaper', 'Guest123', 'Sniper'];
        const name = Phaser.Utils.Array.GetRandom(names);

        const weaponTypes = [WeaponType.BAT, WeaponType.KATANA, WeaponType.UZI, WeaponType.AK47];
        const randomWeapon = Phaser.Utils.Array.GetRandom(weaponTypes);
        const color = 0xff0000; 
        const stats = WEAPON_STATS[randomWeapon];

        const enemy = new StickFigure(this, x, y, color, name, randomWeapon);
        enemy.lastFired = this.time.now + Phaser.Math.Between(0, 2000);
        // Initialize bot ammo
        enemy.setWeapon(randomWeapon, stats.clipSize);
        
        this.enemies.add(enemy);
    }
  }

  private handleEnemies(time: number) {
    let pathUpdateBudget = 1; // Only allow 1 pathfinding calculation per frame to prevent freezing

    this.enemies.getChildren().forEach((e: any) => {
      const enemy = e as StickFigure;
      if (enemy && !enemy.isDead) {
        
        // --- FREE FOR ALL TARGETING LOGIC ---
        let target: StickFigure | null = null;
        let minDist = Infinity;

        // Check Player
        if (!this.player.isDead) {
            const d = Phaser.Math.Distance.Between(enemy.x, enemy.y, this.player.x, this.player.y);
            target = this.player;
            minDist = d;
        }

        // Check Other Enemies
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
            return; // No valid targets
        }

        const distToTarget = minDist;
        const stats = WEAPON_STATS[enemy.weaponType];
        
        if (!stats.isMelee && enemy.currentAmmo <= 0) {
            this.reloadWeapon(enemy);
        }
        
        let attackRange = stats.isMelee ? stats.range + 20 : 600;
        let stopDist = stats.isMelee ? 40 : (enemy.weaponType === WeaponType.UZI ? 150 : 250);

        // THROTTLE LINE OF SIGHT (expensive physics check)
        let hasLOS = false;
        if (time - enemy.lastLOSTime > 200) { // Check every 200ms
            enemy.lastLOSTime = time;
            hasLOS = this.hasLineOfSight(
                {x: enemy.x, y: enemy.y}, 
                {x: target.x, y: target.y}
            );
        } else {
            // Assume LOS status hasn't changed drastically in 200ms, or default to direct move if close
            hasLOS = distToTarget < 300; 
        }

        if (distToTarget < stopDist && hasLOS) {
             enemy.setVelocity(0, 0);
             enemy.setRotation(Phaser.Math.Angle.Between(enemy.x, enemy.y, target.x, target.y));
        } else {
             if (hasLOS) {
                 this.physics.moveToObject(enemy, target, 160);
                 enemy.setRotation(Phaser.Math.Angle.Between(enemy.x, enemy.y, target.x, target.y));
                 enemy.currentPath = [];
                 enemy.pathIndex = 0;
             } else {
                 // Pathfinding Logic
                 if (pathUpdateBudget > 0 && (
                     enemy.currentPath.length === 0 || 
                     enemy.pathIndex >= enemy.currentPath.length || 
                     time - enemy.lastPathTime > 500)) { 
                     
                     pathUpdateBudget--;
                     enemy.currentPath = this.findPath(
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
                     // Fallback if pathing fails or waiting for budget
                     enemy.setVelocity(0, 0);
                 }
             }
        }

        if (distToTarget < attackRange && hasLOS) {
             this.executeAttack(enemy, this.enemyBullets, false);
        }
      }
    });
  }

  private handleBulletEnemyCollision(bullet: any, enemy: any) {
    if (bullet.active && enemy.active) {
      bullet.destroy();
      const damage = bullet.damageAmount || 10;
      this.damageEnemy(enemy, damage, this.player); // Player is attacker
    }
  }

  private handleEnemyBulletHitEnemy(bullet: any, enemy: any) {
      // Note: Arguments are swapped from original implementation due to physics callback order
      // this.physics.add.overlap(this.enemyBullets, this.enemies, callback)
      // Argument 1 is Bullet, Argument 2 is Enemy
      
      if (bullet.active && enemy.active) {
          // Prevent self-damage
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
              targets: marker,
              alpha: 0,
              scale: marker.scale * 0.5,
              duration: 150,
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
              targets: indicator,
              alpha: 0,
              scale: 1.5,
              duration: 200,
              onComplete: () => indicator.destroy()
          });
      }

      // Lightweight Tracer System
      this.activeTracers.push({
          x1: this.player.x,
          y1: this.player.y,
          x2: target.x,
          y2: target.y,
          alpha: 1,
          color: kill ? 0xff0000 : 0xffffff
      });
      
      this.cameras.main.shake(50, 0.001); 
  }

  private showDamageNumber(x: number, y: number, amount: number, isCrit: boolean) {
      const text = this.add.text(x, y - 30, amount.toString(), {
          fontSize: isCrit ? '24px' : '16px',
          color: isCrit ? '#ff0000' : '#ffffff',
          stroke: '#000000',
          strokeThickness: 2,
          fontFamily: 'Arial'
      }).setOrigin(0.5).setDepth(1000);

      this.tweens.add({
          targets: text,
          y: y - 80,
          alpha: 0,
          duration: 800,
          onComplete: () => text.destroy()
      });

      return text;
  }

  private damageEnemy(enemy: StickFigure, amount: number, attacker?: StickFigure) {
      if (typeof enemy.takeDamage === 'function') {
          enemy.takeDamage(amount);
      } else {
          return; // Not a stick figure
      }

      const isKill = enemy.isDead;
      const isPlayerAttack = (attacker === this.player);
      
      if (isPlayerAttack) {
          this.showHitMarker(enemy, isKill);
          this.showDamageNumber(enemy.x, enemy.y, amount, isKill);
      } else {
          // Bot on Bot damage (smaller numbers)
          this.showDamageNumber(enemy.x, enemy.y, amount, isKill).setScale(0.7).setAlpha(0.8);
      }

      if (isKill) {
        // Drop weapon regardless of who killed them
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
          targets: drop,
          y: y - 5,
          yoyo: true,
          duration: 1000,
          repeat: -1,
          ease: 'Sine.easeInOut'
      });
      
      const glow = this.add.circle(x, y, 20);
      glow.setStrokeStyle(2, 0xffff00, 0.5);
      this.tweens.add({
          targets: glow,
          scale: 1.5,
          alpha: 0,
          duration: 1000,
          repeat: -1
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
          // If I shot myself somehow, ignore? (Unlikely with physics groups)
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
              targets: indicator,
              alpha: 0,
              scale: 1.5,
              duration: 400,
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
              targets: blood,
              alpha: 0,
              scale: 0,
              duration: 500,
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