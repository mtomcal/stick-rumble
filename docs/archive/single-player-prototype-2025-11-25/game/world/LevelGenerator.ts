import Phaser from 'phaser';

export class LevelGenerator {
  private scene: Phaser.Scene;
  
  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  public drawFloorGrid() {
    const graphics = this.scene.add.graphics();
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

  public createOfficeLayout(wallsGroup: Phaser.Physics.Arcade.StaticGroup) {
    const wallColor = 0x37474f; 
    const deskColor = 0x795548; 

    const createBlock = (x: number, y: number, w: number, h: number, color: number) => {
        const block = this.scene.add.rectangle(x, y, w, h, color);
        this.scene.physics.add.existing(block, true);
        if (block.body instanceof Phaser.Physics.Arcade.Body) {
            block.body.immovable = true;
            block.body.moves = false;
        }
        wallsGroup.add(block);
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
}