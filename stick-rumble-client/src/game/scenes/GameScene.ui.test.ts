import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GameScene } from './GameScene'
import { createMockScene } from './GameScene.test.setup'
import { setActiveMatchBootstrap } from '../sessionRuntime'

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
    vi.clearAllMocks()
  })

  it('creates gameplay HUD from the bootstrap and enables gameplay readiness', () => {
    const scene = new GameScene()
    const mockSceneContext = createMockScene()
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
    expect(mockSceneContext.add.text).toHaveBeenCalledWith(48, 40, 'PISTOL', expect.any(Object))
    expect(mockSceneContext.add.text).toHaveBeenCalledWith(48, 58, '15/15', expect.any(Object))
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
})
