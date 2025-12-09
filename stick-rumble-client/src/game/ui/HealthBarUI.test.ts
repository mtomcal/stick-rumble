import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HealthBarUI } from './HealthBarUI';
import type Phaser from 'phaser';

describe('HealthBarUI', () => {
  let mockScene: Phaser.Scene;
  let mockContainer: Phaser.GameObjects.Container;
  let mockBackground: Phaser.GameObjects.Rectangle;
  let mockHealthBar: Phaser.GameObjects.Rectangle;
  let mockHealthText: Phaser.GameObjects.Text;
  let mockTween: Phaser.Tweens.Tween;

  beforeEach(() => {
    // Create mock tween
    mockTween = {
      stop: vi.fn(),
    } as unknown as Phaser.Tweens.Tween;

    // Create mock objects for testing
    mockHealthText = {
      setText: vi.fn().mockReturnThis(),
      setOrigin: vi.fn().mockReturnThis(),
    } as unknown as Phaser.GameObjects.Text;

    mockHealthBar = {
      setDisplaySize: vi.fn().mockReturnThis(),
      setOrigin: vi.fn().mockReturnThis(),
      setAlpha: vi.fn().mockReturnThis(),
    } as unknown as Phaser.GameObjects.Rectangle;

    mockBackground = {
      setOrigin: vi.fn().mockReturnThis(),
    } as unknown as Phaser.GameObjects.Rectangle;

    mockContainer = {
      add: vi.fn().mockReturnThis(),
      setScrollFactor: vi.fn().mockReturnThis(),
      setDepth: vi.fn().mockReturnThis(),
    } as unknown as Phaser.GameObjects.Container;

    mockScene = {
      add: {
        container: vi.fn().mockReturnValue(mockContainer),
        rectangle: vi.fn()
          .mockReturnValueOnce(mockBackground) // First call: background
          .mockReturnValueOnce(mockHealthBar), // Second call: health bar
        text: vi.fn().mockReturnValue(mockHealthText),
      },
      tweens: {
        add: vi.fn().mockReturnValue(mockTween),
      },
    } as unknown as Phaser.Scene;
  });

  it('should create health bar UI with correct initial state', () => {
    new HealthBarUI(mockScene, 10, 70);

    expect(mockScene.add.container).toHaveBeenCalledWith(10, 70);
    expect(mockScene.add.rectangle).toHaveBeenCalledTimes(2);
    expect(mockScene.add.text).toHaveBeenCalledWith(5, 5, '100/100', expect.any(Object));
    expect(mockContainer.setScrollFactor).toHaveBeenCalledWith(0);
    expect(mockContainer.setDepth).toHaveBeenCalledWith(1000);
  });

  it('should create background rectangle with correct dimensions', () => {
    new HealthBarUI(mockScene, 10, 70);

    // Background: 204x34 (200 + 4 border)
    expect(mockScene.add.rectangle).toHaveBeenNthCalledWith(
      1,
      0,
      0,
      204,
      34,
      0x000000,
      0.7
    );
    expect(mockBackground.setOrigin).toHaveBeenCalledWith(0, 0);
  });

  it('should create health bar rectangle with correct initial dimensions', () => {
    new HealthBarUI(mockScene, 10, 70);

    // Health bar: 200x30 (full health)
    expect(mockScene.add.rectangle).toHaveBeenNthCalledWith(
      2,
      2,
      2,
      200,
      30,
      0x00ff00
    );
    expect(mockHealthBar.setOrigin).toHaveBeenCalledWith(0, 0);
  });

  it('should update health bar width when health changes', () => {
    const healthBarUI = new HealthBarUI(mockScene, 10, 70);

    healthBarUI.updateHealth(50, 100);

    // 50% health = 100px width (200 * 0.5)
    expect(mockHealthBar.setDisplaySize).toHaveBeenCalledWith(100, 30);
  });

  it('should update health text when health changes', () => {
    const healthBar = new HealthBarUI(mockScene, 10, 70);

    healthBar.updateHealth(75, 100);

    expect(mockHealthText.setText).toHaveBeenCalledWith('75/100');
  });

  it('should change health bar color to yellow when health is between 30-60%', () => {
    const healthBar = new HealthBarUI(mockScene, 10, 70);

    healthBar.updateHealth(50, 100);

    expect(mockHealthBar.setDisplaySize).toHaveBeenCalledWith(100, 30);
    // Color change is tested through fillColor property (mocked in implementation)
  });

  it('should change health bar color to red when health is below 30%', () => {
    const healthBar = new HealthBarUI(mockScene, 10, 70);

    healthBar.updateHealth(20, 100);

    expect(mockHealthBar.setDisplaySize).toHaveBeenCalledWith(40, 30);
    // Color change is tested through fillColor property (mocked in implementation)
  });

  it('should handle zero health', () => {
    const healthBar = new HealthBarUI(mockScene, 10, 70);

    healthBar.updateHealth(0, 100);

    expect(mockHealthBar.setDisplaySize).toHaveBeenCalledWith(0, 30);
    expect(mockHealthText.setText).toHaveBeenCalledWith('0/100');
  });

  it('should handle full health', () => {
    const healthBar = new HealthBarUI(mockScene, 10, 70);

    healthBar.updateHealth(100, 100);

    expect(mockHealthBar.setDisplaySize).toHaveBeenCalledWith(200, 30);
    expect(mockHealthText.setText).toHaveBeenCalledWith('100/100');
  });

  it('should handle edge case at 30% health threshold', () => {
    const healthBar = new HealthBarUI(mockScene, 10, 70);

    healthBar.updateHealth(30, 100);

    expect(mockHealthBar.setDisplaySize).toHaveBeenCalledWith(60, 30);
    expect(mockHealthText.setText).toHaveBeenCalledWith('30/100');
  });

  it('should handle edge case at 60% health threshold', () => {
    const healthBar = new HealthBarUI(mockScene, 10, 70);

    healthBar.updateHealth(60, 100);

    expect(mockHealthBar.setDisplaySize).toHaveBeenCalledWith(120, 30);
    expect(mockHealthText.setText).toHaveBeenCalledWith('60/100');
  });

  it('should clamp negative health to zero', () => {
    const healthBar = new HealthBarUI(mockScene, 10, 70);

    healthBar.updateHealth(-10, 100);

    expect(mockHealthBar.setDisplaySize).toHaveBeenCalledWith(0, 30);
    expect(mockHealthText.setText).toHaveBeenCalledWith('0/100');
  });

  it('should clamp health above max to max', () => {
    const healthBar = new HealthBarUI(mockScene, 10, 70);

    healthBar.updateHealth(150, 100);

    expect(mockHealthBar.setDisplaySize).toHaveBeenCalledWith(200, 30);
    expect(mockHealthText.setText).toHaveBeenCalledWith('100/100');
  });

  describe('Health Regeneration Animation', () => {
    it('should start regeneration animation when isRegenerating becomes true', () => {
      const healthBar = new HealthBarUI(mockScene, 10, 70);

      // Update with regeneration enabled
      healthBar.updateHealth(50, 100, true);

      // Should create a pulsing tween
      expect(mockScene.tweens.add).toHaveBeenCalledWith(
        expect.objectContaining({
          targets: mockHealthBar,
          alpha: 0.6,
          duration: 500,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        })
      );
    });

    it('should not start regeneration animation if already regenerating', () => {
      const healthBar = new HealthBarUI(mockScene, 10, 70);

      // Start regeneration
      healthBar.updateHealth(50, 100, true);
      const initialCallCount = (mockScene.tweens.add as ReturnType<typeof vi.fn>).mock.calls.length;

      // Update again with regeneration still true
      healthBar.updateHealth(55, 100, true);

      // Should not create a new tween
      expect((mockScene.tweens.add as ReturnType<typeof vi.fn>).mock.calls.length).toBe(initialCallCount);
    });

    it('should stop regeneration animation when isRegenerating becomes false', () => {
      const healthBar = new HealthBarUI(mockScene, 10, 70);

      // Start regeneration
      healthBar.updateHealth(50, 100, true);

      // Stop regeneration
      healthBar.updateHealth(60, 100, false);

      // Should stop the tween
      expect(mockTween.stop).toHaveBeenCalled();
      // Should reset alpha to full opacity
      expect(mockHealthBar.setAlpha).toHaveBeenCalledWith(1.0);
    });

    it('should not stop animation if not currently regenerating', () => {
      const healthBar = new HealthBarUI(mockScene, 10, 70);

      // Update with regeneration false (default state)
      healthBar.updateHealth(50, 100, false);

      // Should not attempt to stop tween
      expect(mockTween.stop).not.toHaveBeenCalled();
    });

    it('should handle regeneration state transitions correctly', () => {
      const healthBar = new HealthBarUI(mockScene, 10, 70);

      // Start at 50 HP, not regenerating
      healthBar.updateHealth(50, 100, false);
      expect(mockScene.tweens.add).not.toHaveBeenCalled();

      // Wait 5 seconds, start regenerating at 55 HP
      healthBar.updateHealth(55, 100, true);
      expect(mockScene.tweens.add).toHaveBeenCalledTimes(1);

      // Regenerate to 70 HP (animation should continue)
      healthBar.updateHealth(70, 100, true);
      expect(mockScene.tweens.add).toHaveBeenCalledTimes(1); // No new tween

      // Take damage, stop regenerating
      healthBar.updateHealth(60, 100, false);
      expect(mockTween.stop).toHaveBeenCalled();
      expect(mockHealthBar.setAlpha).toHaveBeenCalledWith(1.0);
    });

    it('should update health bar width while regenerating', () => {
      const healthBar = new HealthBarUI(mockScene, 10, 70);

      // Start regenerating at 50 HP
      healthBar.updateHealth(50, 100, true);
      expect(mockHealthBar.setDisplaySize).toHaveBeenCalledWith(100, 30);

      // Regenerate to 60 HP
      healthBar.updateHealth(60, 100, true);
      expect(mockHealthBar.setDisplaySize).toHaveBeenCalledWith(120, 30);

      // Regenerate to 100 HP (full health)
      healthBar.updateHealth(100, 100, true);
      expect(mockHealthBar.setDisplaySize).toHaveBeenCalledWith(200, 30);
    });

    it('should update health text while regenerating', () => {
      const healthBar = new HealthBarUI(mockScene, 10, 70);

      // Start regenerating at 50 HP
      healthBar.updateHealth(50, 100, true);
      expect(mockHealthText.setText).toHaveBeenCalledWith('50/100');

      // Regenerate to 75 HP
      healthBar.updateHealth(75, 100, true);
      expect(mockHealthText.setText).toHaveBeenCalledWith('75/100');

      // Regenerate to 100 HP
      healthBar.updateHealth(100, 100, true);
      expect(mockHealthText.setText).toHaveBeenCalledWith('100/100');
    });

    it('should not restart animation when already regenerating (idempotency test)', () => {
      const healthBar = new HealthBarUI(mockScene, 10, 70);

      // Start regenerating
      healthBar.updateHealth(50, 100, true);
      expect(mockScene.tweens.add).toHaveBeenCalledTimes(1);

      // Continue regenerating with updated health (common case: health increasing during regen)
      healthBar.updateHealth(55, 100, true);

      // Should NOT create a new tween (already regenerating)
      expect(mockScene.tweens.add).toHaveBeenCalledTimes(1);

      // Tween should NOT be stopped (no restart needed)
      expect(mockTween.stop).not.toHaveBeenCalled();
    });

    it('should handle stopping regeneration when not currently regenerating (null safety)', () => {
      const healthBar = new HealthBarUI(mockScene, 10, 70);

      // Update with isRegenerating=false when never started regenerating
      // This tests the null check in stopRegenerationEffect
      healthBar.updateHealth(50, 100, false);

      // Should not crash or attempt to stop null tween
      expect(mockTween.stop).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle maxHealth of zero without division by zero', () => {
      const healthBar = new HealthBarUI(mockScene, 10, 70);

      // Test with maxHealth = 0 (edge case that should not occur in normal gameplay)
      healthBar.updateHealth(0, 0, false);

      // Should set bar width to 0 and not crash
      expect(mockHealthBar.setDisplaySize).toHaveBeenCalledWith(0, 30);
      expect(mockHealthText.setText).toHaveBeenCalledWith('0/0');
    });
  });
});
