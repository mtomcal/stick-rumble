import { afterEach, describe, expect, it, vi } from 'vitest'
import { setupBootstrappedGameScene } from './GameScene.bootstrap-test-helpers'
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
          F8: 119,
        },
      },
    },
    Math: {
      DegToRad: (degrees: number) => degrees * (Math.PI / 180),
    },
  },
}))

describe('GameScene camera follow', () => {
  afterEach(() => {
    setActiveMatchBootstrap(null)
    vi.clearAllMocks()
  })

  it('starts following the local player sprite when requested', () => {
    const { scene, mockSceneContext } = setupBootstrappedGameScene()
    const mockSprite = { x: 100, y: 100 }

    scene['playerManager'].getLocalPlayerSprite = vi.fn().mockReturnValue(mockSprite as any)
    scene['startCameraFollowIfNeeded']()

    expect(mockSceneContext.cameras.main.startFollow).toHaveBeenCalledWith(mockSprite, true, 0.1, 0.1)
  })

  it('re-attaches follow if the local sprite reference changes', () => {
    const { scene, mockSceneContext } = setupBootstrappedGameScene()
    const firstSprite = { id: 'a' }
    const secondSprite = { id: 'b' }

    scene['playerManager'].getLocalPlayerSprite = vi.fn()
      .mockReturnValueOnce(firstSprite as any)
      .mockReturnValueOnce(secondSprite as any)

    scene['startCameraFollowIfNeeded']()
    scene['startCameraFollowIfNeeded']()

    expect(mockSceneContext.cameras.main.startFollow).toHaveBeenCalledTimes(2)
    expect(mockSceneContext.cameras.main.startFollow).toHaveBeenLastCalledWith(secondSprite, true, 0.1, 0.1)
  })

  it('stops camera follow when spectator mode requests it', () => {
    const { scene, mockSceneContext } = setupBootstrappedGameScene()

    scene['stopCameraFollow']()

    expect(mockSceneContext.cameras.main.stopFollow).toHaveBeenCalledTimes(1)
  })
})
