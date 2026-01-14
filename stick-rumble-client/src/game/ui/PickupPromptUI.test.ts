import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PickupPromptUI } from './PickupPromptUI';
import Phaser from 'phaser';

describe('PickupPromptUI', () => {
  let ui: PickupPromptUI;
  let mockScene: Phaser.Scene;
  let mockText: Phaser.GameObjects.Text;
  let mockCamera: Phaser.Cameras.Scene2D.Camera;

  beforeEach(() => {
    // Create a visible flag that will be updated by setVisible
    let isVisible = false;

    // Create mock text object
    mockText = {
      setText: vi.fn().mockReturnThis(),
      setOrigin: vi.fn().mockReturnThis(),
      setScrollFactor: vi.fn().mockReturnThis(),
      setDepth: vi.fn().mockReturnThis(),
      setVisible: vi.fn((value: boolean) => {
        isVisible = value;
        return mockText;
      }),
      destroy: vi.fn(),
      x: 0,
      y: 0,
      get visible() {
        return isVisible;
      },
    } as unknown as Phaser.GameObjects.Text;

    // Create mock camera
    mockCamera = {
      centerX: 960,
      centerY: 540,
      width: 1920,
      height: 1080,
    } as unknown as Phaser.Cameras.Scene2D.Camera;

    // Create mock scene
    mockScene = {
      add: {
        text: vi.fn().mockReturnValue(mockText),
      },
      cameras: {
        main: mockCamera,
      },
    } as unknown as Phaser.Scene;

    ui = new PickupPromptUI(mockScene);
  });

  describe('constructor', () => {
    it('should create text object with correct initial properties', () => {
      expect(mockScene.add.text).toHaveBeenCalledWith(
        960, // centerX
        980, // height - 100
        '',
        {
          fontSize: '20px',
          color: '#ffff00',
          backgroundColor: '#000000aa',
          padding: { x: 10, y: 5 },
        }
      );
    });

    it('should set text origin to center', () => {
      expect(mockText.setOrigin).toHaveBeenCalledWith(0.5, 0.5);
    });

    it('should set scroll factor to 0 (screen-fixed)', () => {
      expect(mockText.setScrollFactor).toHaveBeenCalledWith(0, 0);
    });

    it('should set depth to 1000 (always on top)', () => {
      expect(mockText.setDepth).toHaveBeenCalledWith(1000);
    });

    it('should start invisible', () => {
      expect(mockText.setVisible).toHaveBeenCalledWith(false);
    });
  });

  describe('show', () => {
    it('should do nothing if promptText is null', () => {
      // Destroy the UI to set promptText to null
      ui.destroy();

      // Calling show should not throw
      expect(() => ui.show('uzi')).not.toThrow();

      // mockText methods should not be called after destroy
      vi.clearAllMocks();
      ui.show('uzi');
      expect(mockText.setText).not.toHaveBeenCalled();
      expect(mockText.setVisible).not.toHaveBeenCalled();
    });

    it('should display prompt with uppercase weapon name', () => {
      ui.show('uzi');

      expect(mockText.setText).toHaveBeenCalledWith('Press E to pick up UZI');
      expect(mockText.setVisible).toHaveBeenCalledWith(true);
    });

    it('should display prompt for ak47', () => {
      ui.show('ak47');

      expect(mockText.setText).toHaveBeenCalledWith('Press E to pick up AK47');
      expect(mockText.setVisible).toHaveBeenCalledWith(true);
    });

    it('should display prompt for shotgun', () => {
      ui.show('shotgun');

      expect(mockText.setText).toHaveBeenCalledWith('Press E to pick up SHOTGUN');
      expect(mockText.setVisible).toHaveBeenCalledWith(true);
    });

    it('should display prompt for katana', () => {
      ui.show('katana');

      expect(mockText.setText).toHaveBeenCalledWith('Press E to pick up KATANA');
      expect(mockText.setVisible).toHaveBeenCalledWith(true);
    });

    it('should display prompt for bat', () => {
      ui.show('bat');

      expect(mockText.setText).toHaveBeenCalledWith('Press E to pick up BAT');
      expect(mockText.setVisible).toHaveBeenCalledWith(true);
    });

    it('should handle empty weapon name', () => {
      ui.show('');

      expect(mockText.setText).toHaveBeenCalledWith('Press E to pick up ');
      expect(mockText.setVisible).toHaveBeenCalledWith(true);
    });

    it('should update text if called multiple times with different weapons', () => {
      ui.show('uzi');
      ui.show('ak47');

      expect(mockText.setText).toHaveBeenCalledTimes(2);
      expect(mockText.setText).toHaveBeenLastCalledWith('Press E to pick up AK47');
    });
  });

  describe('hide', () => {
    beforeEach(() => {
      ui.show('uzi');
      vi.clearAllMocks();
    });

    it('should do nothing if promptText is null', () => {
      // Destroy the UI to set promptText to null
      ui.destroy();

      // Calling hide should not throw
      expect(() => ui.hide()).not.toThrow();

      // mockText methods should not be called after destroy
      vi.clearAllMocks();
      ui.hide();
      expect(mockText.setVisible).not.toHaveBeenCalled();
    });

    it('should hide the prompt text', () => {
      ui.hide();

      expect(mockText.setVisible).toHaveBeenCalledWith(false);
    });

    it('should be safe to call multiple times', () => {
      ui.hide();
      ui.hide();

      expect(mockText.setVisible).toHaveBeenCalledTimes(2);
      expect(mockText.setVisible).toHaveBeenCalledWith(false);
    });

    it('should allow showing again after hide', () => {
      ui.hide();
      ui.show('shotgun');

      expect(mockText.setVisible).toHaveBeenCalledWith(false);
      expect(mockText.setVisible).toHaveBeenCalledWith(true);
    });
  });

  describe('isVisible', () => {
    it('should return false when prompt is hidden', () => {
      expect(ui.isVisible()).toBe(false);
    });

    it('should return true when prompt is shown', () => {
      ui.show('uzi');

      expect(ui.isVisible()).toBe(true);
    });

    it('should return false after hide is called', () => {
      ui.show('uzi');
      ui.hide();

      expect(ui.isVisible()).toBe(false);
    });

    it('should return false when promptText is null (after destroy)', () => {
      ui.destroy();

      expect(ui.isVisible()).toBe(false);
    });
  });

  describe('destroy', () => {
    it('should destroy the text object', () => {
      ui.destroy();

      expect(mockText.destroy).toHaveBeenCalled();
    });

    it('should be safe to call multiple times', () => {
      ui.destroy();
      ui.destroy();

      // First call destroys, second call should be safe (no-op)
      expect(mockText.destroy).toHaveBeenCalledTimes(1);
    });
  });

  describe('position updates', () => {
    it('should position prompt 100px from bottom of screen', () => {
      const expectedY = mockCamera.height - 100;

      expect(mockScene.add.text).toHaveBeenCalledWith(
        expect.any(Number),
        expectedY,
        expect.any(String),
        expect.any(Object)
      );
    });

    it('should position prompt at center X of screen', () => {
      expect(mockScene.add.text).toHaveBeenCalledWith(
        mockCamera.centerX,
        expect.any(Number),
        expect.any(String),
        expect.any(Object)
      );
    });
  });

  describe('text styling', () => {
    it('should use yellow color for visibility', () => {
      expect(mockScene.add.text).toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(Number),
        expect.any(String),
        expect.objectContaining({
          color: '#ffff00',
        })
      );
    });

    it('should use semi-transparent black background', () => {
      expect(mockScene.add.text).toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(Number),
        expect.any(String),
        expect.objectContaining({
          backgroundColor: '#000000aa',
        })
      );
    });

    it('should have padding for readability', () => {
      expect(mockScene.add.text).toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(Number),
        expect.any(String),
        expect.objectContaining({
          padding: { x: 10, y: 5 },
        })
      );
    });
  });
});
