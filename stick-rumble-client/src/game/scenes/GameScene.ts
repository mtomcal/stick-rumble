import Phaser from 'phaser';

export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  preload(): void {
    // Assets will be loaded here in future stories
  }

  create(): void {
    // Add welcome text
    const welcomeText = this.add.text(
      this.cameras.main.centerX,
      this.cameras.main.centerY,
      'Stick Rumble\nPhaser 3.90 + React + TypeScript',
      {
        fontSize: '32px',
        color: '#ffffff',
        align: 'center',
      }
    );
    welcomeText.setOrigin(0.5);

    // Add a simple animated circle to demonstrate Phaser is working
    const circle = this.add.circle(
      this.cameras.main.centerX,
      this.cameras.main.centerY + 100,
      30,
      0x00ff00
    );

    // Animate the circle
    this.tweens.add({
      targets: circle,
      scaleX: 1.2,
      scaleY: 1.2,
      duration: 1000,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    });
  }

  update(): void {
    // Game loop - will be used in future stories
  }
}
