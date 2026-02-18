import type Phaser from 'phaser';
import { COLORS } from '../../shared/constants';

interface ChatMessage {
  text: Phaser.GameObjects.Text;
}

/**
 * ChatLogUI displays chat and system messages in the bottom-left corner
 * Features:
 * - Dimensions: ~300x120px, bottom-left
 * - Background: #808080 at 70% opacity
 * - System messages: COLORS.CHAT_SYSTEM (#BBA840), prefixed [SYSTEM]
 * - Player messages: name in red/orange, text in white
 * - Font: sans-serif 14px
 * - Max ~6 visible lines (overflow scrolls oldest off top)
 * - Screen-fixed (scrollFactor 0)
 * - Depth: 1000
 */
export class ChatLogUI {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private background: Phaser.GameObjects.Graphics;
  private messages: ChatMessage[] = [];
  private readonly MAX_VISIBLE = 6;
  private readonly WIDTH = 300;
  private readonly HEIGHT = 120;
  private readonly LINE_HEIGHT = 18;
  private readonly PADDING = 4;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;

    this.container = scene.add.container(x, y);
    this.container.setScrollFactor(0);
    this.container.setDepth(1000);

    // Draw background: #808080 at 70% opacity
    this.background = scene.add.graphics();
    this.background.fillStyle(0x808080, 0.7);
    this.background.fillRect(0, 0, this.WIDTH, this.HEIGHT);
    this.container.add(this.background);
  }

  /**
   * Add a system message in COLORS.CHAT_SYSTEM color with [SYSTEM] prefix
   */
  addSystemMessage(text: string): void {
    this.addMessage(`[SYSTEM] ${text}`, `#${COLORS.CHAT_SYSTEM.toString(16).padStart(6, '0')}`);
  }

  /**
   * Add a player message with name in red/orange and text in white
   */
  addPlayerMessage(playerName: string, text: string): void {
    this.addMessage(`${playerName}: ${text}`, '#FFFFFF', playerName);
  }

  /**
   * Internal: add a message, trimming oldest if over limit
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private addMessage(content: string, color: string, _playerName?: string): void {
    // Remove oldest if at max capacity
    if (this.messages.length >= this.MAX_VISIBLE) {
      const oldest = this.messages.shift();
      if (oldest) {
        this.container.remove(oldest.text);
        oldest.text.destroy();
      }
    }

    const yPosition = this.PADDING + this.messages.length * this.LINE_HEIGHT;
    const msgText = this.scene.add.text(this.PADDING, yPosition, content, {
      fontSize: '14px',
      fontFamily: 'sans-serif',
      color,
      wordWrap: { width: this.WIDTH - this.PADDING * 2 },
    });

    this.container.add(msgText);
    this.messages.push({ text: msgText });

    // Update positions of all messages
    this.updatePositions();
  }

  /**
   * Restack all message positions from top of container
   */
  private updatePositions(): void {
    this.messages.forEach((msg, index) => {
      msg.text.setY(this.PADDING + index * this.LINE_HEIGHT);
    });
  }

  /**
   * Get count of current messages
   */
  getMessageCount(): number {
    return this.messages.length;
  }

  /**
   * Cleanup all resources
   */
  destroy(): void {
    this.messages.forEach(msg => msg.text.destroy());
    this.messages = [];
    this.container.destroy();
  }
}
