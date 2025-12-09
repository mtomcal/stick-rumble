import type Phaser from 'phaser';

interface KillEntry {
  text: Phaser.GameObjects.Text;
  timestamp: number;
}

/**
 * KillFeedUI displays recent kill events in the top-right corner
 * Features:
 * - Shows "Killer killed Victim" messages
 * - Fades out after 5 seconds
 * - Limited to 5 most recent kills
 * - Fixed to screen (doesn't scroll with camera)
 */
export class KillFeedUI {
  private container: Phaser.GameObjects.Container;
  private kills: KillEntry[] = [];
  private readonly MAX_KILLS = 5;
  private readonly KILL_SPACING = 25;
  private readonly FADE_DELAY = 5000; // 5 seconds
  private readonly FADE_DURATION = 1000; // 1 second
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;

    // Create container for kill feed entries
    this.container = scene.add.container(x, y);

    // Make kill feed fixed to screen (doesn't scroll with camera)
    this.container.setScrollFactor(0);

    // Set high depth so it's always on top
    this.container.setDepth(1000);
  }

  /**
   * Add a kill event to the feed
   * @param killerName Name of the killer
   * @param victimName Name of the victim
   */
  addKill(killerName: string, victimName: string): void {
    // Remove oldest kill if at max capacity
    if (this.kills.length >= this.MAX_KILLS) {
      const oldestKill = this.kills.shift();
      if (oldestKill) {
        this.container.remove(oldestKill.text);
        oldestKill.text.destroy();
      }
    }

    // Create kill message text
    const yPosition = this.kills.length * this.KILL_SPACING;
    const killText = this.scene.add.text(
      0,
      yPosition,
      `${killerName} killed ${victimName}`,
      {
        fontSize: '16px',
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 2,
        backgroundColor: '#000000',
        padding: { x: 8, y: 4 },
      }
    );
    killText.setOrigin(1, 0); // Right-aligned

    // Add to container
    this.container.add(killText);

    // Track kill entry
    const killEntry: KillEntry = {
      text: killText,
      timestamp: Date.now(),
    };
    this.kills.push(killEntry);

    // Set up fade out after delay
    this.scene.time.delayedCall(this.FADE_DELAY, () => {
      this.fadeOutKill(killEntry);
    });
  }

  /**
   * Fade out and remove a kill entry
   */
  private fadeOutKill(killEntry: KillEntry): void {
    // Fade out animation
    this.scene.tweens.add({
      targets: killEntry.text,
      alpha: 0,
      duration: this.FADE_DURATION,
      ease: 'Linear',
      onComplete: () => {
        // Remove from tracking array
        const index = this.kills.indexOf(killEntry);
        if (index !== -1) {
          this.kills.splice(index, 1);
        }

        // Remove from container and destroy
        this.container.remove(killEntry.text);
        killEntry.text.destroy();

        // Update positions of remaining kills
        this.updatePositions();
      },
    });
  }

  /**
   * Update vertical positions of all kill entries
   */
  private updatePositions(): void {
    this.kills.forEach((kill, index) => {
      const targetY = index * this.KILL_SPACING;
      kill.text.setY(targetY);
    });
  }

  /**
   * Cleanup all resources
   */
  destroy(): void {
    // Destroy all kill entries
    this.kills.forEach(kill => {
      kill.text.destroy();
    });
    this.kills = [];

    // Destroy container
    this.container.destroy();
  }
}
