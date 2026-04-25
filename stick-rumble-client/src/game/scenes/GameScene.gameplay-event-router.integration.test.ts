import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setActiveMatchBootstrap, setViewportLayout } from '../sessionRuntime';

const routerSetupSpy = vi.fn();
const routerSetScoreDisplayUISpy = vi.fn();
const routerSetKillCounterUISpy = vi.fn();
const routerSetPickupNotificationUISpy = vi.fn();
const routerSetAimLineSpy = vi.fn();
const routerSetScreenShakeSpy = vi.fn();
const routerSetAudioManagerSpy = vi.fn();
const routerSetInputManagerSpy = vi.fn();
const routerSetShootingManagerSpy = vi.fn();
const routerSetDodgeRollManagerSpy = vi.fn();
const routerSetPredictionEngineSpy = vi.fn();

const gameplayEventRouterConstructorSpy = vi.fn();

vi.mock('./gameplayEventRouter/GameplayEventRouter', () => ({
  GameplayEventRouter: vi.fn(function MockGameplayEventRouter(this: Record<string, unknown>) {
    gameplayEventRouterConstructorSpy();
    this.setupEventHandlers = routerSetupSpy;
    this.destroy = vi.fn();
    this.setScoreDisplayUI = routerSetScoreDisplayUISpy;
    this.setKillCounterUI = routerSetKillCounterUISpy;
    this.setPickupNotificationUI = routerSetPickupNotificationUISpy;
    this.setAimLine = routerSetAimLineSpy;
    this.setScreenShake = routerSetScreenShakeSpy;
    this.setAudioManager = routerSetAudioManagerSpy;
    this.setInputManager = routerSetInputManagerSpy;
    this.setShootingManager = routerSetShootingManagerSpy;
    this.setDodgeRollManager = routerSetDodgeRollManagerSpy;
    this.setPredictionEngine = routerSetPredictionEngineSpy;
  }),
}));

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
          SPACE: 32,
          F8: 119,
        },
      },
    },
    Math: {
      DegToRad: (degrees: number) => degrees * (Math.PI / 180),
    },
  },
}));

describe('GameScene gameplay event router wiring', () => {
  beforeEach(() => {
    routerSetupSpy.mockClear();
    gameplayEventRouterConstructorSpy.mockClear();
    routerSetScoreDisplayUISpy.mockClear();
    routerSetKillCounterUISpy.mockClear();
    routerSetPickupNotificationUISpy.mockClear();
    routerSetAimLineSpy.mockClear();
    routerSetScreenShakeSpy.mockClear();
    routerSetAudioManagerSpy.mockClear();
    routerSetInputManagerSpy.mockClear();
    routerSetShootingManagerSpy.mockClear();
    routerSetDodgeRollManagerSpy.mockClear();
    routerSetPredictionEngineSpy.mockClear();
  });

  afterEach(() => {
    setActiveMatchBootstrap(null);
    setViewportLayout({
      mode: 'desktop',
      width: 1280,
      height: 720,
      insets: { top: 0, right: 0, bottom: 0, left: 0 },
      hudFrame: { x: 0, y: 0, width: 1280, height: 720 },
    });
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('creates and wires the gameplay event router once during scene bootstrap', async () => {
    const { setupBootstrappedGameScene } = await import('./GameScene.bootstrap-test-helpers');
    const routerModule = await import('./gameplayEventRouter/GameplayEventRouter');

    setupBootstrappedGameScene();

    expect(gameplayEventRouterConstructorSpy).toHaveBeenCalledTimes(1);
    expect(routerModule.GameplayEventRouter).toHaveBeenCalledTimes(1);
    expect(routerSetScoreDisplayUISpy).toHaveBeenCalledTimes(1);
    expect(routerSetKillCounterUISpy).toHaveBeenCalledTimes(1);
    expect(routerSetPickupNotificationUISpy).toHaveBeenCalledTimes(1);
    expect(routerSetAimLineSpy).toHaveBeenCalledTimes(1);
    expect(routerSetScreenShakeSpy).toHaveBeenCalledTimes(1);
    expect(routerSetAudioManagerSpy).toHaveBeenCalledTimes(1);
    expect(routerSetInputManagerSpy).toHaveBeenCalledTimes(1);
    expect(routerSetShootingManagerSpy).toHaveBeenCalledTimes(1);
    expect(routerSetDodgeRollManagerSpy).toHaveBeenCalledTimes(1);
    expect(routerSetPredictionEngineSpy).toHaveBeenCalledTimes(1);
    expect(routerSetupSpy).toHaveBeenCalledTimes(1);
  });
});
