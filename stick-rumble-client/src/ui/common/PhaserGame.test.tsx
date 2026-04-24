import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockDestroy = vi.fn()
const mockSetGameplayReady = vi.fn()
let mockGameInstances: MockGame[] = []

class MockGame {
  destroy = mockDestroy
  config: unknown
  scale = {
    resize: vi.fn(),
    refresh: vi.fn(),
  }

  constructor(config: unknown) {
    this.config = config
    mockGameInstances.push(this)
  }
}

vi.mock('phaser', () => ({
  default: {
    Game: MockGame,
    AUTO: 0,
    Scale: {
      RESIZE: 1,
    },
    Scene: class MockScene {},
  },
}))

const sessionRuntime = await import('../../game/sessionRuntime')
const { PhaserGame } = await import('./PhaserGame')

const bootstrap = {
  session: {
    roomId: 'room-1',
    playerId: 'player-1',
    mapId: 'default_office',
    displayName: 'Alice',
    joinMode: 'public' as const,
  },
  wsClient: {
    setGameplayReady: mockSetGameplayReady,
  } as any,
}

const layout = {
  mode: 'desktop' as const,
  width: 1280,
  height: 720,
  insets: {
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  hudFrame: {
    x: 0,
    y: 0,
    width: 1280,
    height: 720,
  },
}

describe('PhaserGame', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGameInstances = []
    sessionRuntime.setActiveMatchBootstrap(null)
  })

  afterEach(() => {
    cleanup()
    delete window.onMatchEnd
  })

  it('renders the game container and creates one Phaser instance', () => {
    const { container } = render(<PhaserGame bootstrap={bootstrap} layout={layout} />)

    expect(container.querySelector('#game-container')).not.toBeNull()
    expect(mockGameInstances).toHaveLength(1)
    expect(mockGameInstances[0]?.config).toEqual(expect.objectContaining({ width: 1280, height: 720 }))
  })

  it('stores and clears the active bootstrap around the component lifecycle', () => {
    const { unmount } = render(<PhaserGame bootstrap={bootstrap} layout={layout} />)

    expect(sessionRuntime.getActiveMatchBootstrap()).toEqual(bootstrap)

    unmount()

    expect(sessionRuntime.getActiveMatchBootstrap()).toBeNull()
  })

  it('does not recreate Phaser on rerender with a new callback identity', () => {
    const firstHandler = vi.fn()
    const secondHandler = vi.fn()

    const { rerender } = render(<PhaserGame bootstrap={bootstrap} layout={layout} onMatchEnd={firstHandler} />)
    rerender(<PhaserGame bootstrap={bootstrap} layout={layout} onMatchEnd={secondHandler} />)

    expect(mockGameInstances).toHaveLength(1)
    window.onMatchEnd?.({ winners: [], finalScores: [], reason: 'test' }, 'player-1')
    expect(firstHandler).not.toHaveBeenCalled()
    expect(secondHandler).toHaveBeenCalledTimes(1)
  })

  it('does not recreate Phaser or clear the active bootstrap when only layout changes', () => {
    const { rerender } = render(<PhaserGame bootstrap={bootstrap} layout={layout} />)

    rerender(
      <PhaserGame
        bootstrap={bootstrap}
        layout={{
          ...layout,
          mode: 'mobile-landscape',
          width: 844,
          height: 390,
          insets: { top: 12, right: 16, bottom: 20, left: 16 },
          hudFrame: { x: 0, y: 0, width: 844, height: 390 },
        }}
      />
    )
    rerender(
      <PhaserGame
        bootstrap={bootstrap}
        layout={{
          ...layout,
          mode: 'mobile-portrait-blocked',
          insets: { top: 18, right: 16, bottom: 20, left: 16 },
          hudFrame: { x: 0, y: 0, width: 1280, height: 720 },
        }}
      />
    )
    rerender(<PhaserGame bootstrap={bootstrap} layout={layout} />)

    expect(mockGameInstances).toHaveLength(1)
    expect(sessionRuntime.getActiveMatchBootstrap()).toEqual(bootstrap)
    expect(mockSetGameplayReady).not.toHaveBeenCalledWith(false)
    expect(mockGameInstances[0]?.scale.resize).toHaveBeenCalledWith(844, 390)
  })

  it('cleans up the match-end bridge and marks gameplay not ready on unmount', () => {
    const onMatchEnd = vi.fn()
    const { unmount } = render(<PhaserGame bootstrap={bootstrap} layout={layout} onMatchEnd={onMatchEnd} />)

    expect(window.onMatchEnd).toBeDefined()

    unmount()

    expect(window.onMatchEnd).toBeUndefined()
    expect(mockDestroy).toHaveBeenCalledWith(true)
    expect(mockSetGameplayReady).toHaveBeenCalledWith(false)
  })
})
