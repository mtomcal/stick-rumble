import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EntityTestScene } from './entity-test-scene';

// Mock game entities
vi.mock('./game/entities/PlayerManager', () => {
  return {
    PlayerManager: class MockPlayerManager {
      updatePlayers = vi.fn();
      destroy = vi.fn();
      setLocalPlayerId = vi.fn();
    },
  };
});

vi.mock('./game/entities/MeleeWeapon', () => {
  return {
    MeleeWeapon: class MockMeleeWeapon {
      startSwing = vi.fn();
      update = vi.fn();
      destroy = vi.fn();
    },
  };
});

vi.mock('./game/entities/ProjectileManager', () => {
  return {
    ProjectileManager: class MockProjectileManager {
      spawnProjectile = vi.fn();
      getProjectileCount = vi.fn(() => 0);
      destroy = vi.fn();
    },
  };
});

describe('EntityTestScene - Target Visibility Controls', () => {
  let scene: EntityTestScene;
  let mockGraphics: any;

  beforeEach(() => {
    // Clear window test controls
    delete (window as any).showProjectileTarget;
    delete (window as any).hideProjectileTarget;
    delete (window as any).restartScene;
    delete (window as any).clearAllSprites;
    delete (window as any).spawnProjectile;

    // Create fresh scene
    scene = new EntityTestScene();

    // Mock graphics object
    mockGraphics = {
      clear: vi.fn(),
      lineStyle: vi.fn().mockReturnThis(),
      strokeCircle: vi.fn().mockReturnThis(),
      fillStyle: vi.fn().mockReturnThis(),
      fillCircle: vi.fn().mockReturnThis(),
      lineBetween: vi.fn().mockReturnThis(),
    };

    // Mock scene methods and properties
    scene.add = {
      rectangle: vi.fn(),
      graphics: vi.fn(() => mockGraphics),
    } as any;

    scene.time = {
      delayedCall: vi.fn(),
    } as any;

    scene.children = {
      getAll: vi.fn(() => []),
    } as any;

    scene.game = {
      loop: {
        sleep: vi.fn(),
        wake: vi.fn(),
        tick: vi.fn(),
        frame: 0,
      },
    } as any;

    // Call create to initialize the scene
    scene.create();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Scene Initialization', () => {
    it('should not draw projectile target on scene initialization', () => {
      // Verify graphics.clear was NOT followed by drawing calls
      // The target should start hidden
      expect(mockGraphics.strokeCircle).not.toHaveBeenCalled();
      expect(mockGraphics.fillCircle).not.toHaveBeenCalled();
      expect(mockGraphics.lineBetween).not.toHaveBeenCalled();
    });

    it('should create graphics object for future target rendering', () => {
      // Verify graphics object was created
      expect(scene.add.graphics).toHaveBeenCalled();
    });
  });

  describe('Window API Exposure', () => {
    it('should expose showProjectileTarget function on window', () => {
      expect((window as any).showProjectileTarget).toBeDefined();
      expect(typeof (window as any).showProjectileTarget).toBe('function');
    });

    it('should expose hideProjectileTarget function on window', () => {
      expect((window as any).hideProjectileTarget).toBeDefined();
      expect(typeof (window as any).hideProjectileTarget).toBe('function');
    });

    it('should expose all expected test control functions', () => {
      const win = window as any;
      expect(win.spawnPlayer).toBeDefined();
      expect(win.removePlayer).toBeDefined();
      expect(win.clearAllSprites).toBeDefined();
      expect(win.restartScene).toBeDefined();
      expect(win.showProjectileTarget).toBeDefined();
      expect(win.hideProjectileTarget).toBeDefined();
    });
  });

  describe('showProjectileTarget()', () => {
    it('should draw target rings when called', () => {
      const win = window as any;

      // Clear mock call history
      mockGraphics.clear.mockClear();
      mockGraphics.strokeCircle.mockClear();
      mockGraphics.fillCircle.mockClear();
      mockGraphics.lineBetween.mockClear();

      // Call showProjectileTarget
      win.showProjectileTarget();

      // Verify target was drawn
      expect(mockGraphics.clear).toHaveBeenCalledTimes(1);
      expect(mockGraphics.strokeCircle).toHaveBeenCalledTimes(3); // 3 concentric circles
      expect(mockGraphics.fillCircle).toHaveBeenCalledTimes(1); // 1 filled inner circle
      expect(mockGraphics.lineBetween).toHaveBeenCalledTimes(2); // 2 crosshair lines
    });

    it('should draw circles at center (400, 300) with correct radii', () => {
      const win = window as any;
      win.showProjectileTarget();

      // Verify circles are drawn at center with correct radii
      expect(mockGraphics.strokeCircle).toHaveBeenCalledWith(400, 300, 150); // Outer
      expect(mockGraphics.strokeCircle).toHaveBeenCalledWith(400, 300, 100); // Middle
      expect(mockGraphics.strokeCircle).toHaveBeenCalledWith(400, 300, 50); // Inner
      expect(mockGraphics.fillCircle).toHaveBeenCalledWith(400, 300, 50); // Inner filled
    });

    it('should be idempotent when called multiple times', () => {
      const win = window as any;

      // Call multiple times
      win.showProjectileTarget();
      win.showProjectileTarget();
      win.showProjectileTarget();

      // Each call should clear and redraw (idempotent behavior)
      expect(mockGraphics.clear).toHaveBeenCalledTimes(3);
      expect(mockGraphics.strokeCircle).toHaveBeenCalledTimes(9); // 3 calls × 3 circles
    });
  });

  describe('hideProjectileTarget()', () => {
    it('should clear target rings when called', () => {
      const win = window as any;

      // First show the target
      win.showProjectileTarget();

      // Clear mock call history
      mockGraphics.clear.mockClear();

      // Call hideProjectileTarget
      win.hideProjectileTarget();

      // Verify graphics.clear was called
      expect(mockGraphics.clear).toHaveBeenCalledTimes(1);
    });

    it('should not draw anything after clearing', () => {
      const win = window as any;

      // Show then hide
      win.showProjectileTarget();
      mockGraphics.strokeCircle.mockClear();
      mockGraphics.fillCircle.mockClear();
      mockGraphics.lineBetween.mockClear();

      win.hideProjectileTarget();

      // Verify no drawing operations
      expect(mockGraphics.strokeCircle).not.toHaveBeenCalled();
      expect(mockGraphics.fillCircle).not.toHaveBeenCalled();
      expect(mockGraphics.lineBetween).not.toHaveBeenCalled();
    });

    it('should be safe to call when target is already hidden', () => {
      const win = window as any;

      // Call hideProjectileTarget without showing first
      expect(() => win.hideProjectileTarget()).not.toThrow();
      expect(mockGraphics.clear).toHaveBeenCalled();
    });
  });

  describe('Target Visibility Toggling', () => {
    it('should support show/hide/show toggle pattern', () => {
      const win = window as any;

      // Show
      win.showProjectileTarget();
      expect(mockGraphics.strokeCircle).toHaveBeenCalled();

      // Hide
      mockGraphics.clear.mockClear();
      mockGraphics.strokeCircle.mockClear();
      win.hideProjectileTarget();
      expect(mockGraphics.clear).toHaveBeenCalled();
      expect(mockGraphics.strokeCircle).not.toHaveBeenCalled();

      // Show again
      mockGraphics.clear.mockClear();
      win.showProjectileTarget();
      expect(mockGraphics.clear).toHaveBeenCalled();
      expect(mockGraphics.strokeCircle).toHaveBeenCalled();
    });
  });

  describe('Scene Lifecycle Integration', () => {
    it('should hide target when restartScene is called', () => {
      const win = window as any;

      // First show the target
      win.showProjectileTarget();
      mockGraphics.clear.mockClear();
      mockGraphics.strokeCircle.mockClear();

      // Restart scene
      win.restartScene();

      // Verify target was cleared (hidden)
      expect(mockGraphics.clear).toHaveBeenCalled();

      // Verify target was NOT redrawn
      expect(mockGraphics.strokeCircle).not.toHaveBeenCalled();
    });

    it('should hide target when clearAllSprites is called', () => {
      const win = window as any;

      // First show the target
      win.showProjectileTarget();
      mockGraphics.clear.mockClear();
      mockGraphics.strokeCircle.mockClear();

      // Clear all sprites
      win.clearAllSprites();

      // Verify target was cleared (hidden)
      expect(mockGraphics.clear).toHaveBeenCalled();

      // Verify target was NOT redrawn
      expect(mockGraphics.strokeCircle).not.toHaveBeenCalled();
    });

    it('should allow re-showing target after restartScene', () => {
      const win = window as any;

      // Show target
      win.showProjectileTarget();

      // Restart scene (hides target)
      win.restartScene();
      mockGraphics.clear.mockClear();
      mockGraphics.strokeCircle.mockClear();

      // Show target again
      win.showProjectileTarget();

      // Verify target was drawn again
      expect(mockGraphics.strokeCircle).toHaveBeenCalledTimes(3); // 3 circles
    });

    it('should allow re-showing target after clearAllSprites', () => {
      const win = window as any;

      // Show target
      win.showProjectileTarget();

      // Clear all sprites (hides target)
      win.clearAllSprites();
      mockGraphics.clear.mockClear();
      mockGraphics.strokeCircle.mockClear();

      // Show target again
      win.showProjectileTarget();

      // Verify target was drawn again
      expect(mockGraphics.strokeCircle).toHaveBeenCalledTimes(3); // 3 circles
    });
  });

  describe('Target Isolation from Projectile Operations', () => {
    it('should not show target when spawning projectiles without explicit show', () => {
      const win = window as any;

      // Clear mock history
      mockGraphics.strokeCircle.mockClear();

      // Spawn a projectile (target should remain hidden)
      win.spawnProjectile('Pistol', 400, 300);

      // Verify target was NOT drawn
      expect(mockGraphics.strokeCircle).not.toHaveBeenCalled();
    });

    it('should keep target visible after spawning projectiles if already shown', () => {
      const win = window as any;

      // Show target explicitly
      win.showProjectileTarget();
      const initialCallCount = mockGraphics.strokeCircle.mock.calls.length;

      // Spawn a projectile
      win.spawnProjectile('Pistol', 400, 300);

      // Verify target was NOT redrawn (call count unchanged)
      expect(mockGraphics.strokeCircle).toHaveBeenCalledTimes(initialCallCount);
    });
  });

  describe('Coverage for Private drawProjectileTarget Method', () => {
    it('should draw crosshair at center with 10px width and height', () => {
      const win = window as any;
      win.showProjectileTarget();

      // Verify crosshair lines (horizontal and vertical)
      expect(mockGraphics.lineBetween).toHaveBeenCalledWith(390, 300, 410, 300); // Horizontal
      expect(mockGraphics.lineBetween).toHaveBeenCalledWith(400, 290, 400, 310); // Vertical
    });

    it('should apply correct styles to target graphics', () => {
      const win = window as any;
      win.showProjectileTarget();

      // Verify lineStyle and fillStyle were called
      expect(mockGraphics.lineStyle).toHaveBeenCalled();
      expect(mockGraphics.fillStyle).toHaveBeenCalled();
    });
  });
});
