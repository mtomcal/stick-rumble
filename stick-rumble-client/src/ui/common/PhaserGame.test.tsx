import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';

// Mock Phaser before any imports
const mockDestroy = vi.fn();
let mockGameInstances: any[] = [];

class MockGame {
  destroy = mockDestroy;
  config: any;

  constructor(config: any) {
    this.config = config;
    mockGameInstances.push(this);
  }
}

vi.mock('phaser', () => {
  return {
    default: {
      Game: MockGame,
      AUTO: 0,
      Scale: {
        FIT: 1,
        CENTER_BOTH: 2,
      },
      Scene: class MockScene {},
    },
  };
});

// Now import after mocking
const { PhaserGame } = await import('./PhaserGame');

describe('PhaserGame', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGameInstances = [];
  });

  afterEach(() => {
    cleanup();
  });

  it('should render game container div', () => {
    const { container } = render(<PhaserGame />);
    const gameContainer = container.querySelector('#game-container');

    expect(gameContainer).toBeDefined();
    expect(gameContainer).not.toBeNull();
  });

  it('should create Phaser game instance on mount', () => {
    render(<PhaserGame />);

    expect(mockGameInstances).toHaveLength(1);
    expect(mockGameInstances[0].config).toBeDefined();
  });

  it('should pass GameConfig to Phaser.Game constructor', () => {
    render(<PhaserGame />);

    const gameConfig = mockGameInstances[0].config;
    expect(gameConfig).toBeDefined();
    expect(gameConfig).toHaveProperty('type');
    expect(gameConfig).toHaveProperty('width');
    expect(gameConfig).toHaveProperty('height');
  });

  it('should only create one game instance even with multiple renders', () => {
    const { rerender } = render(<PhaserGame />);

    expect(mockGameInstances).toHaveLength(1);

    rerender(<PhaserGame />);
    expect(mockGameInstances).toHaveLength(1);
  });

  it('should destroy game instance on unmount', () => {
    const { unmount } = render(<PhaserGame />);

    expect(mockDestroy).not.toHaveBeenCalled();

    unmount();

    expect(mockDestroy).toHaveBeenCalledTimes(1);
    expect(mockDestroy).toHaveBeenCalledWith(true);
  });

  it('should handle multiple mount/unmount cycles correctly', () => {
    // First render
    const { unmount } = render(<PhaserGame />);
    expect(mockGameInstances).toHaveLength(1);

    unmount();
    expect(mockDestroy).toHaveBeenCalledTimes(1);

    // Second render
    const { unmount: unmount2 } = render(<PhaserGame />);
    expect(mockGameInstances).toHaveLength(2);

    unmount2();
    expect(mockDestroy).toHaveBeenCalledTimes(2);
  });

  it('should not create game if already exists on rerender', () => {
    const { rerender } = render(<PhaserGame />);

    expect(mockGameInstances).toHaveLength(1);

    // Rerender the same component instance should not create a new game
    rerender(<PhaserGame />);

    expect(mockGameInstances).toHaveLength(1);
  });

  describe('onMatchEnd callback', () => {
    it('should set window.onMatchEnd when callback is provided', () => {
      const mockOnMatchEnd = vi.fn();

      render(<PhaserGame onMatchEnd={mockOnMatchEnd} />);

      expect(window.onMatchEnd).toBe(mockOnMatchEnd);
    });

    it('should not set window.onMatchEnd when callback is not provided', () => {
      delete window.onMatchEnd;

      render(<PhaserGame />);

      expect(window.onMatchEnd).toBeUndefined();
    });

    it('should clean up window.onMatchEnd on unmount when callback was provided', () => {
      const mockOnMatchEnd = vi.fn();

      const { unmount } = render(<PhaserGame onMatchEnd={mockOnMatchEnd} />);

      expect(window.onMatchEnd).toBe(mockOnMatchEnd);

      unmount();

      expect(window.onMatchEnd).toBeUndefined();
    });

    it('should not throw when cleaning up without onMatchEnd', () => {
      const { unmount } = render(<PhaserGame />);

      expect(() => unmount()).not.toThrow();
      expect(window.onMatchEnd).toBeUndefined();
    });
  });

  describe('restartGame callback', () => {
    it('should set window.restartGame on mount', () => {
      render(<PhaserGame />);

      expect(window.restartGame).toBeDefined();
      expect(typeof window.restartGame).toBe('function');
    });

    it('should call scene.restart when window.restartGame is invoked', () => {
      render(<PhaserGame />);

      // Mock the scene.restart method
      const mockRestart = vi.fn();
      const mockScene = {
        scene: {
          restart: mockRestart,
        },
      };

      // Mock game.scene.getScene to return our mock scene
      if (mockGameInstances.length > 0) {
        mockGameInstances[0].scene = {
          getScene: vi.fn().mockReturnValue(mockScene),
        };
      }

      // Call window.restartGame
      window.restartGame?.();

      expect(mockRestart).toHaveBeenCalledTimes(1);
    });

    it('should handle case where scene is not found', () => {
      render(<PhaserGame />);

      // Mock game.scene.getScene to return null
      if (mockGameInstances.length > 0) {
        mockGameInstances[0].scene = {
          getScene: vi.fn().mockReturnValue(null),
        };
      }

      // Should not throw when scene is null
      expect(() => window.restartGame?.()).not.toThrow();
    });

    it('should clean up window.restartGame on unmount', () => {
      const { unmount } = render(<PhaserGame />);

      expect(window.restartGame).toBeDefined();

      unmount();

      expect(window.restartGame).toBeUndefined();
    });

    it('should always set window.restartGame even without onMatchEnd', () => {
      render(<PhaserGame />);

      expect(window.restartGame).toBeDefined();
      expect(typeof window.restartGame).toBe('function');
    });
  });
});
