import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockDestroy = vi.fn()
const mockSetGameplayReady = vi.fn()
let mockGameInstances: MockGame[] = []

class MockGame {
  destroy = mockDestroy
  config: unknown

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
      FIT: 1,
      CENTER_BOTH: 2,
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
    const { container } = render(<PhaserGame bootstrap={bootstrap} />)

    expect(container.querySelector('#game-container')).not.toBeNull()
    expect(mockGameInstances).toHaveLength(1)
  })

  it('stores and clears the active bootstrap around the component lifecycle', () => {
    const { unmount } = render(<PhaserGame bootstrap={bootstrap} />)

    expect(sessionRuntime.getActiveMatchBootstrap()).toEqual(bootstrap)

    unmount()

    expect(sessionRuntime.getActiveMatchBootstrap()).toBeNull()
  })

  it('does not recreate Phaser on rerender with a new callback identity', () => {
    const firstHandler = vi.fn()
    const secondHandler = vi.fn()

    const { rerender } = render(<PhaserGame bootstrap={bootstrap} onMatchEnd={firstHandler} />)
    rerender(<PhaserGame bootstrap={bootstrap} onMatchEnd={secondHandler} />)

    expect(mockGameInstances).toHaveLength(1)
    window.onMatchEnd?.({ winners: [], finalScores: [], reason: 'test' }, 'player-1')
    expect(firstHandler).not.toHaveBeenCalled()
    expect(secondHandler).toHaveBeenCalledTimes(1)
  })

  it('cleans up the match-end bridge and marks gameplay not ready on unmount', () => {
    const onMatchEnd = vi.fn()
    const { unmount } = render(<PhaserGame bootstrap={bootstrap} onMatchEnd={onMatchEnd} />)

    expect(window.onMatchEnd).toBeDefined()

    unmount()

    expect(window.onMatchEnd).toBeUndefined()
    expect(mockDestroy).toHaveBeenCalledWith(true)
    expect(mockSetGameplayReady).toHaveBeenCalledWith(false)
  })
})
