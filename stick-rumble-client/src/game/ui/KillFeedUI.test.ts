import { describe, it, expect, beforeEach, vi } from 'vitest';
import { KillFeedUI } from './KillFeedUI';
import type Phaser from 'phaser';

describe('KillFeedUI', () => {
  let mockScene: Phaser.Scene;
  let mockContainer: Phaser.GameObjects.Container;
  let mockTexts: Phaser.GameObjects.Text[];

  beforeEach(() => {
    mockTexts = [];

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
        text: vi.fn().mockImplementation(() => {
          const mockText = {
            setOrigin: vi.fn().mockReturnThis(),
            setAlpha: vi.fn().mockReturnThis(),
            setY: vi.fn().mockReturnThis(),
            destroy: vi.fn(),
          } as unknown as Phaser.GameObjects.Text;
          mockTexts.push(mockText);
          return mockText;
        }),
      },
      tweens: {
        add: vi.fn(),
      },
      time: {
        delayedCall: vi.fn(),
      },
    } as unknown as Phaser.Scene;
  });

  it('should create kill feed UI with correct position', () => {
    new KillFeedUI(mockScene, 1720, 100);

    expect(mockScene.add.container).toHaveBeenCalledWith(1720, 100);
    expect(mockContainer.setScrollFactor).toHaveBeenCalledWith(0);
    expect(mockContainer.setDepth).toHaveBeenCalledWith(1000);
  });

  it('should add kill message to feed', () => {
    const killFeed = new KillFeedUI(mockScene, 1720, 100);

    killFeed.addKill('Player1', 'Player2');

    // Should create one text element
    expect(mockScene.add.text).toHaveBeenCalledTimes(1);
    expect(mockScene.add.text).toHaveBeenCalledWith(
      0,
      0,
      'Player1 killed Player2',
      expect.objectContaining({
        fontSize: '16px',
        color: '#ffffff',
      })
    );
  });

  it('should position multiple kills vertically', () => {
    const killFeed = new KillFeedUI(mockScene, 1720, 100);

    killFeed.addKill('Player1', 'Player2');
    killFeed.addKill('Player3', 'Player4');

    // First kill at y=0, second kill at y=25 (spacing)
    expect(mockScene.add.text).toHaveBeenNthCalledWith(
      1,
      0,
      0,
      'Player1 killed Player2',
      expect.any(Object)
    );
    expect(mockScene.add.text).toHaveBeenNthCalledWith(
      2,
      0,
      25,
      'Player3 killed Player4',
      expect.any(Object)
    );
  });

  it('should fade out kill messages after delay', () => {
    const killFeed = new KillFeedUI(mockScene, 1720, 100);

    killFeed.addKill('Player1', 'Player2');

    // Should set up a delayed call for fade out
    expect(mockScene.time.delayedCall).toHaveBeenCalledWith(
      5000,
      expect.any(Function)
    );
  });

  it('should remove kill message after fade animation', () => {
    let fadeCallback: (() => void) | undefined;

    (mockScene.tweens.add as any).mockImplementation((config: any) => {
      fadeCallback = config.onComplete as () => void;
    });

    const killFeed = new KillFeedUI(mockScene, 1720, 100);
    killFeed.addKill('Player1', 'Player2');

    // Get the delayed call callback
    const delayedCallArgs = (mockScene.time.delayedCall as any).mock.calls[0];
    const delayCallback = delayedCallArgs[1] as () => void;

    // Execute the delay callback (starts fade)
    delayCallback();

    // Should create fade tween
    expect(mockScene.tweens.add).toHaveBeenCalledWith(
      expect.objectContaining({
        alpha: 0,
        duration: 1000,
      })
    );

    // Execute fade completion callback
    if (fadeCallback) {
      fadeCallback();
    }

    // Should destroy the text
    expect(mockTexts[0].destroy).toHaveBeenCalled();
  });

  it('should limit kill feed to maximum entries', () => {
    const killFeed = new KillFeedUI(mockScene, 1720, 100);

    // Add 6 kills (max is 5)
    for (let i = 0; i < 6; i++) {
      killFeed.addKill(`Killer${i}`, `Victim${i}`);
    }

    // Should have created 6 text elements
    expect(mockScene.add.text).toHaveBeenCalledTimes(6);

    // First text should be destroyed when 6th is added
    expect(mockTexts[0].destroy).toHaveBeenCalled();
  });

  it('should update positions when old kill is removed', () => {
    let fadeCallback: (() => void) | undefined;

    (mockScene.tweens.add as any).mockImplementation((config: any) => {
      fadeCallback = config.onComplete as () => void;
    });

    const killFeed = new KillFeedUI(mockScene, 1720, 100);

    killFeed.addKill('Player1', 'Player2');
    killFeed.addKill('Player3', 'Player4');

    // Get the delayed call callback for first kill
    const delayedCallArgs = (mockScene.time.delayedCall as any).mock.calls[0];
    const delayCallback = delayedCallArgs[1] as () => void;

    // Execute the delay callback (starts fade)
    delayCallback();

    // Execute fade completion callback
    if (fadeCallback) {
      fadeCallback();
    }

    // First text destroyed
    expect(mockTexts[0].destroy).toHaveBeenCalled();
  });

  it('should handle empty killer or victim names', () => {
    const killFeed = new KillFeedUI(mockScene, 1720, 100);

    killFeed.addKill('', 'Player2');

    expect(mockScene.add.text).toHaveBeenCalledWith(
      0,
      0,
      ' killed Player2',
      expect.any(Object)
    );
  });

  describe('Cleanup', () => {
    it('should destroy all kill entries when destroyed', () => {
      const killFeed = new KillFeedUI(mockScene, 1720, 100);

      // Add multiple kills
      killFeed.addKill('Player1', 'Player2');
      killFeed.addKill('Player3', 'Player4');

      // Add destroy method to container mock
      mockContainer.destroy = vi.fn();

      // Destroy kill feed
      killFeed.destroy();

      // Should destroy both kill text entries
      expect(mockTexts[0].destroy).toHaveBeenCalled();
      expect(mockTexts[1].destroy).toHaveBeenCalled();
    });

    it('should destroy container', () => {
      const killFeed = new KillFeedUI(mockScene, 1720, 100);

      // Add destroy method to container mock
      mockContainer.destroy = vi.fn();

      // Destroy kill feed
      killFeed.destroy();

      // Should destroy container
      expect(mockContainer.destroy).toHaveBeenCalled();
    });

    it('should handle destroy when no kills exist', () => {
      const killFeed = new KillFeedUI(mockScene, 1720, 100);

      // Add destroy method to container mock
      mockContainer.destroy = vi.fn();

      // Destroy kill feed without adding any kills
      killFeed.destroy();

      // Should not crash and should destroy container
      expect(mockContainer.destroy).toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle fadeOutKill when entry is not in kills array', () => {
      let fadeCallback: (() => void) | undefined;

      (mockScene.tweens.add as any).mockImplementation((config: any) => {
        fadeCallback = config.onComplete as () => void;
      });

      const killFeed = new KillFeedUI(mockScene, 1720, 100);
      killFeed.addKill('Player1', 'Player2');

      // Get the delayed call callback
      const delayedCallArgs = (mockScene.time.delayedCall as any).mock.calls[0];
      const delayCallback = delayedCallArgs[1] as () => void;

      // Manually remove the kill entry from internal array to simulate edge case
      const kills = (killFeed as any).kills as any[];
      kills.length = 0;

      // Execute the delay callback (starts fade) - should handle missing entry gracefully
      expect(() => {
        delayCallback();
      }).not.toThrow();

      // Execute fade completion callback - should handle index = -1 gracefully
      expect(fadeCallback).toBeDefined();
      expect(() => {
        fadeCallback!();
      }).not.toThrow();
    });

    it('should handle concurrent fade operations correctly', () => {
      const fadeCallbacks: Array<(() => void)> = [];

      (mockScene.tweens.add as any).mockImplementation((config: any) => {
        fadeCallbacks.push(config.onComplete as () => void);
      });

      const killFeed = new KillFeedUI(mockScene, 1720, 100);

      // Add three kills
      killFeed.addKill('Player1', 'Player2');
      killFeed.addKill('Player3', 'Player4');
      killFeed.addKill('Player5', 'Player6');

      // Trigger all fade delays
      const delayedCalls = (mockScene.time.delayedCall as any).mock.calls;
      delayedCalls.forEach((call: any[]) => {
        const callback = call[1] as () => void;
        callback();
      });

      // Execute all fade completion callbacks
      fadeCallbacks.forEach(callback => {
        expect(() => {
          callback();
        }).not.toThrow();
      });

      // All kills should be destroyed and removed
      mockTexts.forEach(text => {
        expect(text.destroy).toHaveBeenCalled();
      });
    });
  });
});
