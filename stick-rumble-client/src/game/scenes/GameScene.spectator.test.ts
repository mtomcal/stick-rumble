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

describe('GameScene spectator transitions', () => {
  afterEach(() => {
    setActiveMatchBootstrap(null)
    vi.clearAllMocks()
  })

  it('enters spectator mode when the local player dies', () => {
    const { scene, wsClient } = setupBootstrappedGameScene()
    const enterSpy = vi.spyOn(scene['spectator'], 'enterSpectatorMode')

    wsClient.emit('player:death', {
      victimId: 'player-1',
      killerId: 'player-2',
    })

    expect(enterSpy).toHaveBeenCalledTimes(1)
  })

  it('exits spectator mode when the local player respawns', () => {
    const { scene, wsClient } = setupBootstrappedGameScene()
    const exitSpy = vi.spyOn(scene['spectator'], 'exitSpectatorMode')

    wsClient.emit('player:respawn', {
      playerId: 'player-1',
      position: { x: 100, y: 200 },
    })

    expect(exitSpy).toHaveBeenCalledTimes(1)
  })
})
