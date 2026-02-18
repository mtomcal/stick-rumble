import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ScoreDisplayUI } from './ScoreDisplayUI';
import { COLORS } from '../../shared/constants';
import type Phaser from 'phaser';

describe('ScoreDisplayUI', () => {
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

  it('should create score display with correct position and initial text', () => {
    new ScoreDisplayUI(mockScene, 1720, 10);

    expect(mockScene.add.text).toHaveBeenCalledWith(
      1720,
      10,
      '000000',
      expect.objectContaining({
        fontSize: '28px',
        fontFamily: 'monospace',
      })
    );
  });

  it('should use COLORS.SCORE for text color', () => {
    new ScoreDisplayUI(mockScene, 1720, 10);

    const expectedColor = `#${COLORS.SCORE.toString(16).padStart(6, '0')}`;
    expect(mockScene.add.text).toHaveBeenCalledWith(
      expect.any(Number),
      expect.any(Number),
      expect.any(String),
      expect.objectContaining({
        color: expectedColor,
      })
    );
  });

  it('should set scroll factor to 0 (screen-fixed)', () => {
    new ScoreDisplayUI(mockScene, 1720, 10);
    expect(mockText.setScrollFactor).toHaveBeenCalledWith(0);
  });

  it('should set depth to 1000', () => {
    new ScoreDisplayUI(mockScene, 1720, 10);
    expect(mockText.setDepth).toHaveBeenCalledWith(1000);
  });

  it('should set origin to right-aligned', () => {
    new ScoreDisplayUI(mockScene, 1720, 10);
    expect(mockText.setOrigin).toHaveBeenCalledWith(1, 0);
  });

  it('should update score with zero-padded 6-digit format', () => {
    const scoreDisplay = new ScoreDisplayUI(mockScene, 1720, 10);

    scoreDisplay.updateScore(1250);

    expect(mockText.setText).toHaveBeenCalledWith('001250');
  });

  it('should show 000000 for zero score', () => {
    const scoreDisplay = new ScoreDisplayUI(mockScene, 1720, 10);

    scoreDisplay.updateScore(0);

    expect(mockText.setText).toHaveBeenCalledWith('000000');
  });

  it('should show full 6 digits for large score', () => {
    const scoreDisplay = new ScoreDisplayUI(mockScene, 1720, 10);

    scoreDisplay.updateScore(999999);

    expect(mockText.setText).toHaveBeenCalledWith('999999');
  });

  it('should return current score from getScore()', () => {
    const scoreDisplay = new ScoreDisplayUI(mockScene, 1720, 10);

    expect(scoreDisplay.getScore()).toBe(0);

    scoreDisplay.updateScore(500);

    expect(scoreDisplay.getScore()).toBe(500);
  });

  it('should use killerXP as the score value on updateScore()', () => {
    const scoreDisplay = new ScoreDisplayUI(mockScene, 1720, 10);

    scoreDisplay.updateScore(350);

    expect(scoreDisplay.getScore()).toBe(350);
    expect(mockText.setText).toHaveBeenCalledWith('000350');
  });

  it('should destroy text on destroy()', () => {
    const scoreDisplay = new ScoreDisplayUI(mockScene, 1720, 10);
    scoreDisplay.destroy();
    expect(mockText.destroy).toHaveBeenCalled();
  });
});
