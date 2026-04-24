import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GameScene } from './GameScene'
import { GameSceneUI } from './GameSceneUI'
import { createMockScene } from './GameScene.test.setup'
import { setActiveMatchBootstrap, setViewportLayout } from '../sessionRuntime'

vi.mock('phaser', () => ({
  default: {
    Scene: class {
      scene = { key: '' }
      constructor(config: { key: string }) {
        this.scene.key = config.key
      }
    },
    Input: {
      Keyboard: {
        KeyCodes: {
          SPACE: 32,
        },
      },
    },
    Math: {
      DegToRad: (degrees: number) => degrees * (Math.PI / 180),
    },
  },
}))

function createBootstrap() {
  return {
    session: {
      roomId: 'room-1',
      playerId: 'player-1',
      mapId: 'default_office',
      displayName: 'Alice',
      joinMode: 'public' as const,
    },
    wsClient: {
      on: vi.fn(),
      off: vi.fn(),
      send: vi.fn(),
      getTotalHandlerCount: vi.fn().mockReturnValue(0),
      setGameplayReady: vi.fn(),
    } as any,
  }
}

describe('GameScene UI flow', () => {
  beforeEach(() => {
    setActiveMatchBootstrap(null)
  })

  afterEach(() => {
    setActiveMatchBootstrap(null)
    setViewportLayout({
      mode: 'desktop',
      width: 1280,
      height: 720,
      insets: { top: 0, right: 0, bottom: 0, left: 0 },
      hudFrame: { x: 0, y: 0, width: 1280, height: 720 },
    })
    vi.clearAllMocks()
  })

  it('creates gameplay HUD from the bootstrap and enables gameplay readiness', () => {
    const scene = new GameScene()
    const mockSceneContext = createMockScene()
    const updateAmmoDisplaySpy = vi.spyOn(GameSceneUI.prototype, 'updateAmmoDisplay')
    const layoutTopLeftClusterSpy = vi.spyOn(GameSceneUI.prototype, 'layoutTopLeftCluster')
    const disableContextMenu = vi.fn()
    mockSceneContext.input = {
      ...mockSceneContext.input,
      mouse: {
        disableContextMenu,
      },
    } as any
    Object.assign(scene, mockSceneContext)

    const bootstrap = createBootstrap()
    setActiveMatchBootstrap(bootstrap)

    scene.create()

    expect(disableContextMenu).toHaveBeenCalledTimes(1)
    expect(bootstrap.wsClient.setGameplayReady).toHaveBeenCalledWith(true)
    expect(layoutTopLeftClusterSpy).toHaveBeenCalledWith(scene['healthBarUI'])
    expect(updateAmmoDisplaySpy).toHaveBeenCalledWith(scene['shootingManager'])
    expect(mockSceneContext.add.text).toHaveBeenCalledWith(0, 0, 'PISTOL 15/15', expect.any(Object))
    expect(mockSceneContext.add.text).not.toHaveBeenCalledWith(48, 40, 'PISTOL', expect.any(Object))
  })

  it('updates only the reload arc during reloads', () => {
    const scene = new GameScene()
    const mockSceneContext = createMockScene()
    mockSceneContext.input = {
      ...mockSceneContext.input,
      mouse: {
        disableContextMenu: vi.fn(),
      },
    } as any
    Object.assign(scene, mockSceneContext)

    const bootstrap = createBootstrap()
    setActiveMatchBootstrap(bootstrap)
    scene.create()

    const updateReloadProgressSpy = vi.spyOn(scene['ui'], 'updateReloadProgress')
    const updateReloadCircleSpy = vi.spyOn(scene['ui'], 'updateReloadCircle')

    scene['shootingManager'].isReloading = vi.fn().mockReturnValue(true)
    scene['shootingManager'].getReloadProgress = vi.fn().mockReturnValue(0.5)
    scene['playerManager'].getLocalPlayerPosition = vi.fn().mockReturnValue({ x: 320, y: 240 })

    scene.update(0, 16)

    expect(updateReloadProgressSpy).not.toHaveBeenCalled()
    expect(updateReloadCircleSpy).toHaveBeenCalledWith(0.5, 320, 240)
  })

  it('repositions HUD ownership zones when viewport insets change', () => {
    const scene = new GameScene()
    const mockSceneContext = createMockScene()
    mockSceneContext.input = {
      ...mockSceneContext.input,
      mouse: {
        disableContextMenu: vi.fn(),
      },
    } as any
    Object.assign(scene, mockSceneContext)

    const bootstrap = createBootstrap()
    setActiveMatchBootstrap(bootstrap)
    scene.create()

    const setViewportLayoutSpy = vi.spyOn(scene['ui'], 'setViewportLayout')
    const scorePositionSpy = vi.spyOn(scene['scoreDisplayUI'], 'setPosition')
    const killCounterPositionSpy = vi.spyOn(scene['killCounterUI'], 'setPosition')
    const dodgePositionSpy = vi.spyOn(scene['dodgeRollCooldownUI'], 'setPosition')
    const clusterBackgroundPositionSpy = vi.spyOn(scene['ui']['topLeftClusterBackground'] as any, 'setPosition')
    const minimapFillRectSpy = vi.spyOn(scene['ui']['minimapStaticGraphics'] as any, 'fillRect')

    setViewportLayout({
      mode: 'mobile-landscape',
      width: 1558,
      height: 720,
      insets: { top: 24, right: 30, bottom: 48, left: 18 },
      hudFrame: { x: 139, y: 0, width: 1280, height: 720 },
    })

    expect(setViewportLayoutSpy).toHaveBeenCalledWith({
      mode: 'mobile-landscape',
      width: 1558,
      height: 720,
      insets: { top: 24, right: 30, bottom: 48, left: 18 },
      hudFrame: { x: 139, y: 0, width: 1280, height: 720 },
    })
    expect(scorePositionSpy).toHaveBeenCalledWith(1379, 34)
    expect(killCounterPositionSpy).toHaveBeenCalledWith(1379, 66)
    expect(dodgePositionSpy).toHaveBeenCalledWith(1339, 442)
    expect(clusterBackgroundPositionSpy).toHaveBeenCalledWith(177, 44)
    expect(minimapFillRectSpy).toHaveBeenCalledWith(177, 302, 170, 170)
  })

  it('applies a modest zoom-in for mobile landscape without using the desktop zoom', () => {
    const scene = new GameScene()
    const mockSceneContext = createMockScene()
    mockSceneContext.input = {
      ...mockSceneContext.input,
      mouse: {
        disableContextMenu: vi.fn(),
      },
    } as any
    Object.assign(scene, mockSceneContext)

    const bootstrap = createBootstrap()
    setActiveMatchBootstrap(bootstrap)
    scene.create()

    setViewportLayout({
      mode: 'mobile-landscape',
      width: 1558,
      height: 720,
      insets: { top: 24, right: 30, bottom: 48, left: 18 },
      hudFrame: { x: 139, y: 0, width: 1280, height: 720 },
    })

    expect(mockSceneContext.cameras.main.setZoom).toHaveBeenCalledWith(1.15)
  })
})
