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

describe('GameScene cleanup', () => {
  afterEach(() => {
    setActiveMatchBootstrap(null)
    vi.clearAllMocks()
  })

  it('destroys managers and marks gameplay not ready on cleanup', () => {
    const { scene, wsClient } = setupBootstrappedGameScene()
    const destroyEventHandlersSpy = vi.spyOn(scene['eventHandlers'], 'destroy')
    const destroyPlayersSpy = vi.spyOn(scene['playerManager'], 'destroy')

    scene['cleanup']()

    expect(destroyEventHandlersSpy).toHaveBeenCalledTimes(1)
    expect(destroyPlayersSpy).toHaveBeenCalledTimes(1)
    expect(wsClient.setGameplayReady).toHaveBeenCalledWith(false)
  })
})
