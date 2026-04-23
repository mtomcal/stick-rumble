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

describe('GameScene movement loop', () => {
  afterEach(() => {
    setActiveMatchBootstrap(null)
    vi.clearAllMocks()
  })

  it('updates input every frame while not spectating', () => {
    const { scene } = setupBootstrappedGameScene()
    const inputUpdateSpy = vi.spyOn(scene['inputManager'], 'update')
    scene['spectator'].isActive = vi.fn().mockReturnValue(false)

    scene.update(0, 16)

    expect(inputUpdateSpy).toHaveBeenCalledTimes(1)
  })

  it('runs client prediction for the local player when state is available', () => {
    const { scene } = setupBootstrappedGameScene()
    const predictSpy = vi.spyOn(scene['predictionEngine'], 'predictPosition')

    scene['spectator'].isActive = vi.fn().mockReturnValue(false)
    scene['playerManager'].getLocalPlayerId = vi.fn().mockReturnValue('player-1')
    scene['playerManager'].getPlayerState = vi.fn().mockReturnValue({
      id: 'player-1',
      position: { x: 10, y: 20 },
      velocity: { x: 0, y: 0 },
    })
    scene['playerManager'].getLocalPlayerPredictedState = vi.fn().mockReturnValue(null)

    scene.update(0, 16)

    expect(predictSpy).toHaveBeenCalled()
  })
})
