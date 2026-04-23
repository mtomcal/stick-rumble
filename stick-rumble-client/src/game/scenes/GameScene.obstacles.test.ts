import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GameScene, getObstacleReadableEdgeStrokeRect } from './GameScene';
import { createMockScene } from './GameScene.test.setup';

vi.mock('phaser', () => ({
  default: {
    Scene: class {
      scene = { key: '' };
      constructor(config: { key: string }) {
        this.scene.key = config.key;
      }
    },
    Input: {
      Keyboard: {
        KeyCodes: {
          W: 87,
          A: 65,
          S: 83,
          D: 68,
        },
      },
    },
  },
}));

describe('GameScene obstacle rendering', () => {
  let scene: GameScene;
  let mockSceneContext: ReturnType<typeof createMockScene>;

  beforeEach(() => {
    scene = new GameScene();
    mockSceneContext = createMockScene();
    Object.assign(scene, mockSceneContext);
    (scene as any).obstacleGraphics = mockSceneContext.add.graphics();
  });

  it('keeps decorative obstacle stroke inset from the authoritative blocker edge', () => {
    const strokeRect = getObstacleReadableEdgeStrokeRect({
      id: 'wall',
      type: 'wall',
      shape: 'rectangle',
      x: 100,
      y: 200,
      width: 72,
      height: 56,
      blocksMovement: true,
      blocksProjectiles: true,
      blocksLineOfSight: true,
    });

    expect(strokeRect).toEqual({
      x: 101,
      y: 201,
      width: 70,
      height: 54,
    });
  });

  it('draws obstacle fills on the authoritative rectangle and keeps the stroke inset', () => {
    const obstacleGraphics = (scene as any).obstacleGraphics;
    const obstacle = {
      id: 'desk',
      type: 'desk' as const,
      shape: 'rectangle' as const,
      x: 210,
      y: 130,
      width: 192,
      height: 72,
      blocksMovement: true,
      blocksProjectiles: true,
      blocksLineOfSight: true,
    };

    (scene as any).drawObstacles({
      width: 1920,
      height: 1080,
      mapId: 'default_office',
      obstacles: [obstacle],
      weaponSpawns: [],
      visualAcceptanceViewpoints: [],
    });

    expect(obstacleGraphics.fillRect).toHaveBeenCalledWith(210, 130, 192, 72);
    expect(obstacleGraphics.lineStyle).toHaveBeenCalledWith(1, 0x2f3330, 1);
    expect(obstacleGraphics.strokeRect).toHaveBeenCalledWith(211, 131, 190, 70);
  });

  it('renders wall obstacles with the same authoritative-edge contract', () => {
    const obstacleGraphics = (scene as any).obstacleGraphics;
    const obstacle = {
      id: 'wall',
      type: 'wall' as const,
      shape: 'rectangle' as const,
      x: 696,
      y: 336,
      width: 528,
      height: 56,
      blocksMovement: true,
      blocksProjectiles: true,
      blocksLineOfSight: true,
    };

    (scene as any).drawObstacles({
      width: 1920,
      height: 1080,
      mapId: 'default_office',
      obstacles: [obstacle],
      weaponSpawns: [],
      visualAcceptanceViewpoints: [],
    });

    expect(obstacleGraphics.fillStyle).toHaveBeenCalledWith(0x646864, 1);
    expect(obstacleGraphics.fillRect).toHaveBeenCalledWith(696, 336, 528, 56);
    expect(obstacleGraphics.strokeRect).toHaveBeenCalledWith(697, 337, 526, 54);
  });
});
