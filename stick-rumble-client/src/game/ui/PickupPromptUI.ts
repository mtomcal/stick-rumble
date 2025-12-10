import Phaser from 'phaser';

const PROMPT_FONT_SIZE = '20px';
const PROMPT_COLOR = '#ffff00';
const PROMPT_BACKGROUND_COLOR = '#000000aa';
const PROMPT_PADDING = { x: 10, y: 5 };
const PROMPT_Y_OFFSET = 100;
const PROMPT_DEPTH = 1000;

export class PickupPromptUI {
  private scene: Phaser.Scene;
  private promptText: Phaser.GameObjects.Text | null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.promptText = null;

    this.createPromptText();
  }

  private createPromptText(): void {
    const camera = this.scene.cameras.main;
    const x = camera.centerX;
    const y = camera.height - PROMPT_Y_OFFSET;

    this.promptText = this.scene.add.text(x, y, '', {
      fontSize: PROMPT_FONT_SIZE,
      color: PROMPT_COLOR,
      backgroundColor: PROMPT_BACKGROUND_COLOR,
      padding: PROMPT_PADDING,
    });

    this.promptText.setOrigin(0.5, 0.5);
    this.promptText.setScrollFactor(0, 0); // Screen-fixed
    this.promptText.setDepth(PROMPT_DEPTH); // Always on top
    this.promptText.setVisible(false);
  }

  show(weaponType: string): void {
    if (!this.promptText) {
      return;
    }

    const weaponName = weaponType.toUpperCase();
    this.promptText.setText(`Press E to pick up ${weaponName}`);
    this.promptText.setVisible(true);
  }

  hide(): void {
    if (!this.promptText) {
      return;
    }

    this.promptText.setVisible(false);
  }

  isVisible(): boolean {
    return this.promptText?.visible ?? false;
  }

  destroy(): void {
    if (this.promptText) {
      this.promptText.destroy();
      this.promptText = null;
    }
  }
}
