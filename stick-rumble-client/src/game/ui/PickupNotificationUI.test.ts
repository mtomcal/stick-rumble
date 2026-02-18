import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PickupNotificationUI } from './PickupNotificationUI';
import type Phaser from 'phaser';

describe('PickupNotificationUI', () => {
  let mockScene: Phaser.Scene;
  let mockText: Phaser.GameObjects.Text;

  beforeEach(() => {
    mockText = {
      setOrigin: vi.fn().mockReturnThis(),
      setScrollFactor: vi.fn().mockReturnThis(),
      setDepth: vi.fn().mockReturnThis(),
      setVisible: vi.fn().mockReturnThis(),
      setAlpha: vi.fn().mockReturnThis(),
      setText: vi.fn().mockReturnThis(),
      destroy: vi.fn(),
    } as unknown as Phaser.GameObjects.Text;

    mockScene = {
      add: {
        text: vi.fn().mockReturnValue(mockText),
      },
      time: {
        delayedCall: vi.fn(),
      },
      tweens: {
        add: vi.fn(),
      },
    } as unknown as Phaser.Scene;
  });

  it('should create text at specified position', () => {
    new PickupNotificationUI(mockScene, 960, 540);
    expect(mockScene.add.text).toHaveBeenCalledWith(960, 540, '', expect.any(Object));
  });

  it('should use gray color (#AAAAAA)', () => {
    new PickupNotificationUI(mockScene, 960, 540);
    expect(mockScene.add.text).toHaveBeenCalledWith(
      expect.any(Number),
      expect.any(Number),
      expect.any(String),
      expect.objectContaining({ color: '#AAAAAA' })
    );
  });

  it('should use 18px font', () => {
    new PickupNotificationUI(mockScene, 960, 540);
    expect(mockScene.add.text).toHaveBeenCalledWith(
      expect.any(Number),
      expect.any(Number),
      expect.any(String),
      expect.objectContaining({ fontSize: '18px' })
    );
  });

  it('should center origin', () => {
    new PickupNotificationUI(mockScene, 960, 540);
    expect(mockText.setOrigin).toHaveBeenCalledWith(0.5, 0.5);
  });

  it('should set scroll factor to 0 (screen-fixed)', () => {
    new PickupNotificationUI(mockScene, 960, 540);
    expect(mockText.setScrollFactor).toHaveBeenCalledWith(0);
  });

  it('should set depth to 1000', () => {
    new PickupNotificationUI(mockScene, 960, 540);
    expect(mockText.setDepth).toHaveBeenCalledWith(1000);
  });

  it('should be hidden initially', () => {
    new PickupNotificationUI(mockScene, 960, 540);
    expect(mockText.setVisible).toHaveBeenCalledWith(false);
  });

  describe('show()', () => {
    it('should set text to "Picked up {WEAPON_NAME}"', () => {
      const notification = new PickupNotificationUI(mockScene, 960, 540);
      notification.show('AK47');

      expect(mockText.setText).toHaveBeenCalledWith('Picked up AK47');
    });

    it('should make text visible with full alpha', () => {
      const notification = new PickupNotificationUI(mockScene, 960, 540);
      notification.show('Pistol');

      expect(mockText.setAlpha).toHaveBeenCalledWith(1);
      expect(mockText.setVisible).toHaveBeenCalledWith(true);
    });

    it('should schedule fade out after 1500ms', () => {
      const notification = new PickupNotificationUI(mockScene, 960, 540);
      notification.show('Pistol');

      expect(mockScene.time.delayedCall).toHaveBeenCalledWith(
        1500,
        expect.any(Function)
      );
    });

    it('should fade out over 500ms when delay fires', () => {
      const notification = new PickupNotificationUI(mockScene, 960, 540);
      notification.show('Shotgun');

      // Get and invoke the delayed call
      const delayedCallArgs = (mockScene.time.delayedCall as any).mock.calls[0];
      const delayCallback = delayedCallArgs[1] as () => void;
      delayCallback();

      expect(mockScene.tweens.add).toHaveBeenCalledWith(
        expect.objectContaining({
          targets: mockText,
          alpha: 0,
          duration: 500,
        })
      );
    });

    it('should hide text after fade completes', () => {
      let tweenOnComplete: (() => void) | undefined;
      (mockScene.tweens.add as any).mockImplementation((config: any) => {
        tweenOnComplete = config.onComplete as () => void;
      });

      const notification = new PickupNotificationUI(mockScene, 960, 540);
      notification.show('Uzi');

      // Fire delay
      const delayCallback = (mockScene.time.delayedCall as any).mock.calls[0][1] as () => void;
      delayCallback();

      // Fire tween completion
      if (tweenOnComplete) tweenOnComplete();

      expect(mockText.setVisible).toHaveBeenCalledWith(false);
    });
  });

  describe('cleanup', () => {
    it('should destroy text on destroy()', () => {
      const notification = new PickupNotificationUI(mockScene, 960, 540);
      notification.destroy();
      expect(mockText.destroy).toHaveBeenCalled();
    });
  });
});
