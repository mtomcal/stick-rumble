import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DebugOverlayUI } from './DebugOverlayUI';
import { COLORS } from '../../shared/constants';
import type Phaser from 'phaser';

describe('DebugOverlayUI', () => {
  let mockScene: Phaser.Scene;
  let mockContainer: Phaser.GameObjects.Container;
  let mockTexts: Phaser.GameObjects.Text[];

  beforeEach(() => {
    mockTexts = [];

    mockContainer = {
      add: vi.fn().mockReturnThis(),
      setScrollFactor: vi.fn().mockReturnThis(),
      setDepth: vi.fn().mockReturnThis(),
      setVisible: vi.fn().mockReturnThis(),
      destroy: vi.fn(),
    } as unknown as Phaser.GameObjects.Container;

    mockScene = {
      add: {
        container: vi.fn().mockReturnValue(mockContainer),
        text: vi.fn().mockImplementation(() => {
          const t = {
            setOrigin: vi.fn().mockReturnThis(),
            setScrollFactor: vi.fn().mockReturnThis(),
            setDepth: vi.fn().mockReturnThis(),
            setVisible: vi.fn().mockReturnThis(),
            setText: vi.fn().mockReturnThis(),
            destroy: vi.fn(),
          } as unknown as Phaser.GameObjects.Text;
          mockTexts.push(t);
          return t;
        }),
      },
    } as unknown as Phaser.Scene;
  });

  it('should create container at specified position', () => {
    new DebugOverlayUI(mockScene, 20, 200);
    expect(mockScene.add.container).toHaveBeenCalledWith(20, 200);
  });

  it('should set scroll factor to 0 (screen-fixed)', () => {
    new DebugOverlayUI(mockScene, 20, 200);
    expect(mockContainer.setScrollFactor).toHaveBeenCalledWith(0);
  });

  it('should set depth to 1000', () => {
    new DebugOverlayUI(mockScene, 20, 200);
    expect(mockContainer.setDepth).toHaveBeenCalledWith(1000);
  });

  it('should create 4 text lines', () => {
    new DebugOverlayUI(mockScene, 20, 200);
    expect(mockScene.add.text).toHaveBeenCalledTimes(4);
  });

  it('should use COLORS.DEBUG_OVERLAY (green) for all lines', () => {
    new DebugOverlayUI(mockScene, 20, 200);
    const expectedColor = `#${COLORS.DEBUG_OVERLAY.toString(16).padStart(6, '0')}`;
    const calls = (mockScene.add.text as any).mock.calls;
    calls.forEach((call: any[]) => {
      expect(call[3]).toMatchObject({ color: expectedColor });
    });
  });

  it('should use monospaced 12px font', () => {
    new DebugOverlayUI(mockScene, 20, 200);
    const calls = (mockScene.add.text as any).mock.calls;
    calls.forEach((call: any[]) => {
      expect(call[3]).toMatchObject({ fontSize: '12px', fontFamily: 'monospace' });
    });
  });

  it('should be hidden by default (disabled)', () => {
    new DebugOverlayUI(mockScene, 20, 200);
    expect(mockContainer.setVisible).toHaveBeenCalledWith(false);
  });

  it('should be visible when enabled=true', () => {
    new DebugOverlayUI(mockScene, 20, 200, true);
    expect(mockContainer.setVisible).toHaveBeenCalledWith(true);
  });

  describe('update()', () => {
    it('should NOT update text when disabled', () => {
      const overlay = new DebugOverlayUI(mockScene, 20, 200, false);
      overlay.update(60, 16, 5, 10, 20);

      // setText should not be called on any line text
      mockTexts.forEach(t => {
        expect(t.setText).not.toHaveBeenCalled();
      });
    });

    it('should update all 4 lines when enabled', () => {
      const overlay = new DebugOverlayUI(mockScene, 20, 200, true);
      overlay.update(60, 16, 5, 10, 20);

      expect(mockTexts[0].setText).toHaveBeenCalledWith('FPS: 60');
      expect(mockTexts[1].setText).toHaveBeenCalledWith('Update: 16ms');
      expect(mockTexts[2].setText).toHaveBeenCalledWith('AI: 5ms');
      expect(mockTexts[3].setText).toHaveBeenCalledWith('E: 10 | B: 20');
    });
  });

  describe('setEnabled()', () => {
    it('should show container when enabled', () => {
      const overlay = new DebugOverlayUI(mockScene, 20, 200, false);
      overlay.setEnabled(true);

      expect(mockContainer.setVisible).toHaveBeenCalledWith(true);
      expect(overlay.isEnabled()).toBe(true);
    });

    it('should hide container when disabled', () => {
      const overlay = new DebugOverlayUI(mockScene, 20, 200, true);
      overlay.setEnabled(false);

      expect(mockContainer.setVisible).toHaveBeenCalledWith(false);
      expect(overlay.isEnabled()).toBe(false);
    });
  });

  describe('cleanup', () => {
    it('should destroy all lines and container', () => {
      const overlay = new DebugOverlayUI(mockScene, 20, 200);
      overlay.destroy();

      mockTexts.forEach(t => expect(t.destroy).toHaveBeenCalled());
      expect(mockContainer.destroy).toHaveBeenCalled();
    });
  });
});
