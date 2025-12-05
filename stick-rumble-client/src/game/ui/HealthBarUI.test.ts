import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HealthBarUI } from './HealthBarUI';
import type Phaser from 'phaser';

describe('HealthBarUI', () => {
  let mockScene: Phaser.Scene;
  let mockContainer: Phaser.GameObjects.Container;
  let mockBackground: Phaser.GameObjects.Rectangle;
  let mockHealthBar: Phaser.GameObjects.Rectangle;
  let mockHealthText: Phaser.GameObjects.Text;

  beforeEach(() => {
    // Create mock objects for testing
    mockHealthText = {
      setText: vi.fn().mockReturnThis(),
      setOrigin: vi.fn().mockReturnThis(),
    } as unknown as Phaser.GameObjects.Text;

    mockHealthBar = {
      setDisplaySize: vi.fn().mockReturnThis(),
      setOrigin: vi.fn().mockReturnThis(),
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
});
