import { afterEach, describe, expect, it, vi } from 'vitest'
import { setupBootstrappedGameScene } from './GameScene.bootstrap-test-helpers'
import { setActiveMatchBootstrap, setMobileGameplayIntent, triggerRuntimeAction } from '../sessionRuntime'

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
    setMobileGameplayIntent(null)
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

  it('repeats ranged shots while mobile fire is held even for semi-automatic weapons', () => {
    const { scene } = setupBootstrappedGameScene()
    const wallSparkSpy = vi.spyOn(scene['ui'], 'showWallSpark')

    scene['shootingManager'].shoot = vi.fn()
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true)
    scene['shootingManager'].isMeleeWeapon = vi.fn().mockReturnValue(false)
    scene['shootingManager'].isAutomatic = vi.fn().mockReturnValue(false)
    scene['inputManager'].getAimAngle = vi.fn().mockReturnValue(Math.PI / 3)
    scene['getObstructedBarrelPosition'] = vi.fn().mockReturnValue({ x: 10, y: 20 })

    setMobileGameplayIntent({
      up: false,
      down: false,
      left: false,
      right: false,
      aimAngle: Math.PI / 3,
      isSprinting: false,
      fireActive: true,
    })

    scene.update(0, 16)
    scene.update(16, 16)

    expect(scene['shootingManager'].shoot).toHaveBeenCalledTimes(3)
    expect(wallSparkSpy).toHaveBeenCalledTimes(2)
  })

  it('repeats melee swings while mobile fire is held after each cooldown', () => {
    const { scene } = setupBootstrappedGameScene()

    scene['shootingManager'].isMeleeWeapon = vi.fn().mockReturnValue(true)
    scene['shootingManager'].meleeAttack = vi.fn()
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true)
    scene['inputManager'].getAimAngle = vi.fn().mockReturnValue(Math.PI / 4)
    scene['playerManager'].getLocalPlayerId = vi.fn().mockReturnValue('player-1')
    scene['playerManager'].getPlayerPosition = vi.fn().mockReturnValue({ x: 100, y: 200 })
    scene['meleeWeaponManager'].startSwing = vi.fn()
    scene['meleeWeaponManager'].updatePosition = vi.fn()

    setMobileGameplayIntent({
      up: false,
      down: false,
      left: false,
      right: false,
      aimAngle: Math.PI / 4,
      isSprinting: false,
      fireActive: true,
    })

    scene.update(0, 16)
    scene.update(16, 16)

    expect(scene['shootingManager'].meleeAttack).toHaveBeenCalledTimes(3)
    expect(scene['meleeWeaponManager'].startSwing).toHaveBeenCalledTimes(2)
  })

  it('sends pickup attempts when the mobile pickup action is triggered near a crate', () => {
    const { scene, wsClient } = setupBootstrappedGameScene()

    scene['nearbyWeaponCrate'] = {
      id: 'crate-1',
      weaponType: 'AK47',
    }

    triggerRuntimeAction('pickup')

    expect(wsClient.send).toHaveBeenCalledWith({
      type: 'weapon:pickup_attempt',
      timestamp: expect.any(Number),
      data: { crateId: 'crate-1' },
    })
  })
})
