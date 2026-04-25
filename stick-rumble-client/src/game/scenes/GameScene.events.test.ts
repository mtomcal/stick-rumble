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

describe('GameScene event routing', () => {
  afterEach(() => {
    setActiveMatchBootstrap(null)
    vi.clearAllMocks()
    delete window.onMatchEnd
  })

  it('updates the shooting manager from weapon:state', () => {
    const { scene, wsClient } = setupBootstrappedGameScene()
    const updateWeaponStateSpy = vi.spyOn(scene['shootingManager'], 'updateWeaponState')

    wsClient.emit('weapon:state', {
      currentAmmo: 10,
      maxAmmo: 15,
      isReloading: false,
      canShoot: true,
      weaponType: 'Pistol',
      isMelee: false,
    })

    expect(updateWeaponStateSpy).toHaveBeenCalledWith({
      currentAmmo: 10,
      maxAmmo: 15,
      isReloading: false,
      canShoot: true,
      weaponType: 'Pistol',
      isMelee: false,
    })
  })

  it('bridges match:ended to the React shell callback with display-ready payloads', () => {
    const { wsClient } = setupBootstrappedGameScene()
    const onMatchEnd = vi.fn()
    window.onMatchEnd = onMatchEnd

    wsClient.emit('match:ended', {
      winners: [{ playerId: 'player-1', displayName: 'Alice' }],
      finalScores: [{ playerId: 'player-1', displayName: 'Alice', kills: 5, deaths: 1, xp: 650 }],
      reason: 'kill_target',
    })

    expect(onMatchEnd).toHaveBeenCalledWith(
      {
        winners: [{ playerId: 'player-1', displayName: 'Alice' }],
        finalScores: [{ playerId: 'player-1', displayName: 'Alice', kills: 5, deaths: 1, xp: 650 }],
        reason: 'kill_target',
      },
      'player-1',
    )
  })

  it('suppresses late gameplay mutations after match:ended', () => {
    const { scene, wsClient } = setupBootstrappedGameScene()
    const spawnProjectileSpy = vi.spyOn(scene['projectileManager'], 'spawnProjectile')

    wsClient.emit('match:ended', {
      winners: [{ playerId: 'player-1', displayName: 'Alice' }],
      finalScores: [{ playerId: 'player-1', displayName: 'Alice', kills: 5, deaths: 1, xp: 650 }],
      reason: 'kill_target',
    })
    wsClient.emit('projectile:spawn', {
      id: 'proj-late',
      ownerId: 'player-1',
      weaponType: 'AK47',
      position: { x: 100, y: 200 },
      velocity: { x: 400, y: 0 },
    })

    expect(spawnProjectileSpy).not.toHaveBeenCalled()
  })
})
