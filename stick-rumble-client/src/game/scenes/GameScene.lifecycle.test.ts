import { afterEach, describe, expect, it, vi } from 'vitest'
import { setupBootstrappedGameScene } from './GameScene.bootstrap-test-helpers'
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
    setViewportLayout({
      mode: 'desktop',
      width: 1280,
      height: 720,
      insets: { top: 0, right: 0, bottom: 0, left: 0 },
      hudFrame: { x: 0, y: 0, width: 1280, height: 720 },
    })
    vi.clearAllMocks()
  })

  it('destroys managers and marks gameplay not ready on cleanup', () => {
    const { scene, wsClient, mockSceneContext } = setupBootstrappedGameScene()
    const destroyEventHandlersSpy = vi.spyOn(scene['eventHandlers'], 'destroy')
    const destroyPlayersSpy = vi.spyOn(scene['playerManager'], 'destroy')
    const destroyUiSpy = vi.spyOn(scene['ui'], 'destroy')

    const shutdownHandler = mockSceneContext.events.once.mock.calls.find(
      (call: unknown[]) => call[0] === 'shutdown'
    )?.[1] as (() => void) | undefined
    shutdownHandler?.()

    expect(destroyEventHandlersSpy).toHaveBeenCalledTimes(1)
    expect(destroyPlayersSpy).toHaveBeenCalledTimes(1)
    expect(destroyUiSpy).toHaveBeenCalledTimes(1)
    expect(wsClient.setGameplayReady).toHaveBeenCalledWith(false)
  })

  it('stops reacting to viewport bridge updates after cleanup', () => {
    const { scene, mockSceneContext } = setupBootstrappedGameScene()
    const scorePositionSpy = vi.spyOn(scene['scoreDisplayUI'], 'setPosition')

    const shutdownHandler = mockSceneContext.events.once.mock.calls.find(
      (call: unknown[]) => call[0] === 'shutdown'
    )?.[1] as (() => void) | undefined
    shutdownHandler?.()
    scorePositionSpy.mockClear()

    setViewportLayout({
      mode: 'mobile-landscape',
      width: 1558,
      height: 720,
      insets: { top: 20, right: 24, bottom: 28, left: 16 },
      hudFrame: { x: 139, y: 0, width: 1280, height: 720 },
    })

    expect(scorePositionSpy).not.toHaveBeenCalled()
  })
})
