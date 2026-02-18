import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChatLogUI } from './ChatLogUI';
import { COLORS } from '../../shared/constants';
import type Phaser from 'phaser';

describe('ChatLogUI', () => {
  let mockScene: Phaser.Scene;
  let mockContainer: Phaser.GameObjects.Container;
  let mockGraphics: Phaser.GameObjects.Graphics;
  let mockTexts: Phaser.GameObjects.Text[];

  beforeEach(() => {
    mockTexts = [];

    mockGraphics = {
      fillStyle: vi.fn().mockReturnThis(),
      fillRect: vi.fn().mockReturnThis(),
      destroy: vi.fn(),
    } as unknown as Phaser.GameObjects.Graphics;

    mockContainer = {
      add: vi.fn().mockReturnThis(),
      setScrollFactor: vi.fn().mockReturnThis(),
      setDepth: vi.fn().mockReturnThis(),
      remove: vi.fn().mockReturnThis(),
      destroy: vi.fn(),
    } as unknown as Phaser.GameObjects.Container;

    mockScene = {
      add: {
        container: vi.fn().mockReturnValue(mockContainer),
        graphics: vi.fn().mockReturnValue(mockGraphics),
        text: vi.fn().mockImplementation(() => {
          const t = {
            setOrigin: vi.fn().mockReturnThis(),
            setAlpha: vi.fn().mockReturnThis(),
            setY: vi.fn().mockReturnThis(),
            destroy: vi.fn(),
          } as unknown as Phaser.GameObjects.Text;
          mockTexts.push(t);
          return t;
        }),
      },
    } as unknown as Phaser.Scene;
  });

  it('should create container at specified position', () => {
    new ChatLogUI(mockScene, 10, 500);
    expect(mockScene.add.container).toHaveBeenCalledWith(10, 500);
  });

  it('should set scroll factor to 0 (screen-fixed)', () => {
    new ChatLogUI(mockScene, 10, 500);
    expect(mockContainer.setScrollFactor).toHaveBeenCalledWith(0);
  });

  it('should set depth to 1000', () => {
    new ChatLogUI(mockScene, 10, 500);
    expect(mockContainer.setDepth).toHaveBeenCalledWith(1000);
  });

  it('should draw background with #808080 at 70% opacity', () => {
    new ChatLogUI(mockScene, 10, 500);
    expect(mockGraphics.fillStyle).toHaveBeenCalledWith(0x808080, 0.7);
    expect(mockGraphics.fillRect).toHaveBeenCalledWith(0, 0, 300, 120);
  });

  it('should add background to container', () => {
    new ChatLogUI(mockScene, 10, 500);
    expect(mockContainer.add).toHaveBeenCalledWith(mockGraphics);
  });

  describe('addSystemMessage', () => {
    it('should prefix message with [SYSTEM]', () => {
      const chatLog = new ChatLogUI(mockScene, 10, 500);
      chatLog.addSystemMessage('Welcome to Stick Rumble');

      expect(mockScene.add.text).toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(Number),
        '[SYSTEM] Welcome to Stick Rumble',
        expect.any(Object)
      );
    });

    it('should use COLORS.CHAT_SYSTEM color', () => {
      const chatLog = new ChatLogUI(mockScene, 10, 500);
      chatLog.addSystemMessage('Test message');

      const expectedColor = `#${COLORS.CHAT_SYSTEM.toString(16).padStart(6, '0')}`;
      expect(mockScene.add.text).toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(Number),
        expect.any(String),
        expect.objectContaining({ color: expectedColor })
      );
    });

    it('should use 14px sans-serif font', () => {
      const chatLog = new ChatLogUI(mockScene, 10, 500);
      chatLog.addSystemMessage('Test');

      expect(mockScene.add.text).toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(Number),
        expect.any(String),
        expect.objectContaining({
          fontSize: '14px',
          fontFamily: 'sans-serif',
        })
      );
    });
  });

  describe('addPlayerMessage', () => {
    it('should format message as "name: text"', () => {
      const chatLog = new ChatLogUI(mockScene, 10, 500);
      chatLog.addPlayerMessage('Reaper', 'Bruh');

      expect(mockScene.add.text).toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(Number),
        'Reaper: Bruh',
        expect.any(Object)
      );
    });

    it('should use white color for player messages', () => {
      const chatLog = new ChatLogUI(mockScene, 10, 500);
      chatLog.addPlayerMessage('Player1', 'Hello');

      expect(mockScene.add.text).toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(Number),
        expect.any(String),
        expect.objectContaining({ color: '#FFFFFF' })
      );
    });
  });

  describe('max visible lines', () => {
    it('should allow up to 6 messages', () => {
      const chatLog = new ChatLogUI(mockScene, 10, 500);

      for (let i = 0; i < 6; i++) {
        chatLog.addSystemMessage(`Message ${i}`);
      }

      expect(chatLog.getMessageCount()).toBe(6);
    });

    it('should remove oldest message when over 6', () => {
      const chatLog = new ChatLogUI(mockScene, 10, 500);

      for (let i = 0; i < 7; i++) {
        chatLog.addSystemMessage(`Message ${i}`);
      }

      expect(chatLog.getMessageCount()).toBe(6);
      // First text should be destroyed when 7th added
      expect(mockTexts[0].destroy).toHaveBeenCalled();
    });

    it('should remove from container when trimming oldest', () => {
      const chatLog = new ChatLogUI(mockScene, 10, 500);

      for (let i = 0; i < 7; i++) {
        chatLog.addSystemMessage(`Message ${i}`);
      }

      expect(mockContainer.remove).toHaveBeenCalledWith(mockTexts[0]);
    });
  });

  describe('cleanup', () => {
    it('should destroy all messages on destroy()', () => {
      const chatLog = new ChatLogUI(mockScene, 10, 500);

      chatLog.addSystemMessage('Message 1');
      chatLog.addPlayerMessage('Player', 'Hello');

      chatLog.destroy();

      expect(mockTexts[0].destroy).toHaveBeenCalled();
      expect(mockTexts[1].destroy).toHaveBeenCalled();
    });

    it('should destroy container on destroy()', () => {
      const chatLog = new ChatLogUI(mockScene, 10, 500);
      chatLog.destroy();
      expect(mockContainer.destroy).toHaveBeenCalled();
    });

    it('should handle destroy with no messages', () => {
      const chatLog = new ChatLogUI(mockScene, 10, 500);
      expect(() => chatLog.destroy()).not.toThrow();
    });
  });
});
