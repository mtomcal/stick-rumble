import { describe, it, expect, beforeEach, vi } from 'vitest';
import { KillCounterUI } from './KillCounterUI';
import { COLORS } from '../../shared/constants';
import type Phaser from 'phaser';

describe('KillCounterUI', () => {
  let mockScene: Phaser.Scene;
  let mockText: Phaser.GameObjects.Text;

  beforeEach(() => {
    mockText = {
      setOrigin: vi.fn().mockReturnThis(),
      setScrollFactor: vi.fn().mockReturnThis(),
      setDepth: vi.fn().mockReturnThis(),
      setText: vi.fn().mockReturnThis(),
      destroy: vi.fn(),
    } as unknown as Phaser.GameObjects.Text;

    mockScene = {
      add: {
        text: vi.fn().mockReturnValue(mockText),
      },
    } as unknown as Phaser.Scene;
  });

  it('should create kill counter with correct initial text', () => {
    new KillCounterUI(mockScene, 1720, 50);

    expect(mockScene.add.text).toHaveBeenCalledWith(
      1720,
      50,
      'KILLS: 0',
      expect.any(Object)
    );
  });

  it('should use COLORS.KILL_COUNTER for text color', () => {
    new KillCounterUI(mockScene, 1720, 50);

    const expectedColor = `#${COLORS.KILL_COUNTER.toString(16).padStart(6, '0')}`;
    expect(mockScene.add.text).toHaveBeenCalledWith(
      expect.any(Number),
      expect.any(Number),
      expect.any(String),
      expect.objectContaining({
        color: expectedColor,
      })
    );
  });

  it('should use ~16px font size', () => {
    new KillCounterUI(mockScene, 1720, 50);

    expect(mockScene.add.text).toHaveBeenCalledWith(
      expect.any(Number),
      expect.any(Number),
      expect.any(String),
      expect.objectContaining({
        fontSize: '16px',
      })
    );
  });

  it('should set scroll factor to 0 (screen-fixed)', () => {
    new KillCounterUI(mockScene, 1720, 50);
    expect(mockText.setScrollFactor).toHaveBeenCalledWith(0);
  });

  it('should set depth to 1000', () => {
    new KillCounterUI(mockScene, 1720, 50);
    expect(mockText.setDepth).toHaveBeenCalledWith(1000);
  });

  it('should set origin to right-aligned', () => {
    new KillCounterUI(mockScene, 1720, 50);
    expect(mockText.setOrigin).toHaveBeenCalledWith(1, 0);
  });

  it('should increment kill count on incrementKills()', () => {
    const killCounter = new KillCounterUI(mockScene, 1720, 50);

    killCounter.incrementKills();

    expect(mockText.setText).toHaveBeenCalledWith('KILLS: 1');
  });

  it('should track multiple kill increments', () => {
    const killCounter = new KillCounterUI(mockScene, 1720, 50);

    killCounter.incrementKills();
    killCounter.incrementKills();
    killCounter.incrementKills();

    expect(mockText.setText).toHaveBeenLastCalledWith('KILLS: 3');
  });

  it('should return current kill count from getKills()', () => {
    const killCounter = new KillCounterUI(mockScene, 1720, 50);

    expect(killCounter.getKills()).toBe(0);

    killCounter.incrementKills();
    killCounter.incrementKills();

    expect(killCounter.getKills()).toBe(2);
  });

  it('should start at zero kills', () => {
    const killCounter = new KillCounterUI(mockScene, 1720, 50);
    expect(killCounter.getKills()).toBe(0);
  });

  it('should destroy text on destroy()', () => {
    const killCounter = new KillCounterUI(mockScene, 1720, 50);
    killCounter.destroy();
    expect(mockText.destroy).toHaveBeenCalled();
  });
});
