import type Phaser from 'phaser';
import { COLORS } from '../../shared/constants';

/**
 * DebugOverlayUI displays performance metrics below the minimap (left side)
 * Features:
 * - Bright green (#00FF00 / COLORS.DEBUG_OVERLAY), monospaced ~12px
 * - Lines: FPS, Update time, AI time, Entity/Bullet counts
 * - Only shown when debug flag is enabled
 * - Screen-fixed (scrollFactor 0)
 * - Depth: 1000
 */
export class DebugOverlayUI {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private lines: Phaser.GameObjects.Text[];
  private enabled: boolean;

  private static readonly LINE_LABELS = [
    'FPS: 0',
    'Update: 0ms',
    'AI: 0ms',
    'E: 0 | B: 0',
  ];
  private readonly LINE_HEIGHT = 16;

  constructor(scene: Phaser.Scene, x: number, y: number, enabled = false) {
    this.scene = scene;
    this.enabled = enabled;

    this.container = scene.add.container(x, y);
    this.container.setScrollFactor(0);
    this.container.setDepth(1000);

    const color = `#${COLORS.DEBUG_OVERLAY.toString(16).padStart(6, '0')}`;

    this.lines = DebugOverlayUI.LINE_LABELS.map((label, index) => {
      const text = scene.add.text(0, index * this.LINE_HEIGHT, label, {
        fontSize: '12px',
        fontFamily: 'monospace',
        color,
      });
      return text;
    });

    this.container.add(this.lines);
    this.container.setVisible(this.enabled);
  }

  /**
   * Update all debug stats. Does nothing if not enabled.
   */
  update(fps: number, updateMs: number, aiMs: number, entityCount: number, bulletCount: number): void {
    if (!this.enabled) return;

    this.lines[0].setText(`FPS: ${fps}`);
    this.lines[1].setText(`Update: ${updateMs}ms`);
    this.lines[2].setText(`AI: ${aiMs}ms`);
    this.lines[3].setText(`E: ${entityCount} | B: ${bulletCount}`);
  }

  /**
   * Toggle debug overlay on or off
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.container.setVisible(enabled);
  }

  /**
   * Whether overlay is currently enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Cleanup all resources
   */
  destroy(): void {
    this.lines.forEach(line => line.destroy());
    this.container.destroy();
  }
}
