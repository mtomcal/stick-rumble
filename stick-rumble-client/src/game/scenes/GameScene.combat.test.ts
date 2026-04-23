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

describe('GameScene combat input', () => {
  afterEach(() => {
    setActiveMatchBootstrap(null)
    vi.clearAllMocks()
  })

  it('suppresses the browser context menu over gameplay', () => {
    const { mockSceneContext } = setupBootstrappedGameScene()
    const inputWithMouse = mockSceneContext.input as unknown as {
      mouse: { disableContextMenu: ReturnType<typeof vi.fn> }
    }

    expect(inputWithMouse.mouse.disableContextMenu).toHaveBeenCalledTimes(1)
  })

  it('fires only on primary pointer input', () => {
    const { scene, mockSceneContext } = setupBootstrappedGameScene()
    const pointerDownHandler = (mockSceneContext.input.on as ReturnType<typeof vi.fn>).mock.calls
      .find(([event]) => event === 'pointerdown')?.[1]

    scene['shootingManager'].shoot = vi.fn().mockReturnValue(true)
    scene['shootingManager'].isMeleeWeapon = vi.fn().mockReturnValue(false)
    scene['inputManager'].getAimAngle = vi.fn().mockReturnValue(0)

    pointerDownHandler?.({ button: 2 })
    pointerDownHandler?.({ button: 0 })

    expect(scene['shootingManager'].shoot).toHaveBeenCalledTimes(1)
  })
})
