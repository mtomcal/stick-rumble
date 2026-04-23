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

describe('GameScene bootstrap', () => {
  afterEach(() => {
    setActiveMatchBootstrap(null)
    vi.clearAllMocks()
  })

  it('initializes gameplay systems from the active match bootstrap', () => {
    const { scene, wsClient } = setupBootstrappedGameScene()

    expect(scene['inputManager']).toBeDefined()
    expect(scene['shootingManager']).toBeDefined()
    expect(scene['playerManager'].getLocalPlayerId()).toBe('player-1')
    expect(wsClient.setGameplayReady).toHaveBeenCalledWith(true)
  })

  it('applies the bootstrap map bounds during create()', () => {
    const { mockSceneContext } = setupBootstrappedGameScene()

    expect(mockSceneContext.physics.world.setBounds).toHaveBeenCalled()
    expect(mockSceneContext.cameras.main.setBounds).toHaveBeenCalled()
  })
})
