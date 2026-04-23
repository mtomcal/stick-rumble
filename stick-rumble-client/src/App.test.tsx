import { useEffect } from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import type { PhaserGameProps } from './ui/common/PhaserGame'
import type { JoinIntent, MatchEndData, SessionStatusData } from './shared/types'

const testState = vi.hoisted(() => ({
  phaserRenderSpy: vi.fn(),
  phaserMountSpy: vi.fn(),
  phaserUnmountSpy: vi.fn(),
  capturedOnMatchEnd: undefined as PhaserGameProps['onMatchEnd'],
  autoConnectReady: true,
  clientInstances: [] as Array<{
    emit: (event: string, payload: unknown) => void
    connect: ReturnType<typeof vi.fn>
    disconnect: ReturnType<typeof vi.fn>
    on: ReturnType<typeof vi.fn>
    off: ReturnType<typeof vi.fn>
    sendHello: ReturnType<typeof vi.fn>
    sendSessionLeave: ReturnType<typeof vi.fn>
    restartSession: ReturnType<typeof vi.fn>
    setReconnectReplayFailedHandler: ReturnType<typeof vi.fn>
    setConnectionStateHandler: ReturnType<typeof vi.fn>
    setGameplayReady: ReturnType<typeof vi.fn>
    connectionStateHandler?: (connected: boolean) => void
    onReconnectReplayFailed?: (intent: JoinIntent) => void
  }>,
}))

vi.mock('./ui/common/PhaserGame', () => ({
  PhaserGame: (props: PhaserGameProps) => {
    testState.phaserRenderSpy(props)
    testState.capturedOnMatchEnd = props.onMatchEnd

    useEffect(() => {
      testState.phaserMountSpy()
      return () => {
        testState.phaserUnmountSpy()
      }
    }, [])

    return <div data-testid="phaser-game">Phaser</div>
  },
}))

vi.mock('./ui/debug/DebugNetworkPanel', () => ({
  DebugNetworkPanel: () => <div data-testid="debug-panel" />,
}))

type Handler = (payload: unknown) => void

vi.mock('./game/network/WebSocketClient', () => ({
  WebSocketClient: class {
    readonly handlers = new Map<string, Set<Handler>>()
    readonly connect = vi.fn().mockResolvedValue(undefined)
    readonly disconnect = vi.fn()
    readonly on = vi.fn((event: string, handler: Handler) => {
      const handlers = this.handlers.get(event) ?? new Set<Handler>()
      handlers.add(handler)
      this.handlers.set(event, handlers)
    })
    readonly off = vi.fn((event: string, handler: Handler) => {
      this.handlers.get(event)?.delete(handler)
    })
    readonly sendHello = vi.fn()
    readonly sendSessionLeave = vi.fn()
    readonly restartSession = vi.fn()
    readonly setReconnectReplayFailedHandler = vi.fn((handler: (intent: JoinIntent) => void) => {
      this.onReconnectReplayFailed = handler
    })
    readonly setConnectionStateHandler = vi.fn((handler?: (connected: boolean) => void) => {
      this.connectionStateHandler = handler
      if (testState.autoConnectReady) {
        handler?.(true)
      }
    })
    readonly setGameplayReady = vi.fn()
    connectionStateHandler?: (connected: boolean) => void
    onReconnectReplayFailed?: (intent: JoinIntent) => void

    constructor() {
      testState.clientInstances.push(this as never)
    }

    emit(event: string, payload: unknown): void {
      this.handlers.get(event)?.forEach((handler) => handler(payload))
    }
  },
}))

function getClient() {
  const client = testState.clientInstances.at(-1)
  if (!client) {
    throw new Error('expected WebSocket client to be created')
  }
  return client
}

function emitSessionStatus(status: SessionStatusData): void {
  act(() => {
    getClient().emit('session:status', status)
  })
}

function setViewportSize(width: number, height: number): void {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height })
}

function dispatchResize(width: number, height: number): void {
  setViewportSize(width, height)
  act(() => {
    window.dispatchEvent(new Event('resize'))
  })
}

function setTouchPhoneLayout(enabled: boolean): void {
  Object.defineProperty(navigator, 'maxTouchPoints', {
    configurable: true,
    value: enabled ? 5 : 0,
  })
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: enabled && query === '(pointer: coarse)',
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as typeof window.matchMedia
}

describe('App', () => {
  beforeEach(() => {
    testState.clientInstances.length = 0
    testState.phaserRenderSpy.mockReset()
    testState.phaserMountSpy.mockReset()
    testState.phaserUnmountSpy.mockReset()
    testState.capturedOnMatchEnd = undefined
    testState.autoConnectReady = true
    window.localStorage.clear()
    window.history.replaceState({}, '', '/')
    setViewportSize(1280, 720)
    setTouchPhoneLayout(false)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders the join form after the socket connects and keeps Phaser unmounted before match_ready', async () => {
    render(<App />)

    await waitFor(() => expect(getClient().connect).toHaveBeenCalled())

    expect(screen.getByRole('heading', { name: 'Stick Rumble - Multiplayer Arena Shooter' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Play Public' })).toBeEnabled()
    expect(screen.queryByTestId('phaser-game')).not.toBeInTheDocument()
  })

  it('prefills the invite code but does not auto-submit without a saved display name', async () => {
    window.history.replaceState({}, '', '/?invite=PIZZA')

    render(<App />)

    await waitFor(() => expect(getClient().connect).toHaveBeenCalled())

    expect(screen.getByRole('textbox', { name: 'Room Code' })).toHaveValue('PIZZA')
    expect(getClient().sendHello).not.toHaveBeenCalled()
  })

  it('auto-submits an invite when a saved display name exists and the socket is ready', async () => {
    window.localStorage.setItem('stick-rumble.display-name', 'Alice')
    window.history.replaceState({}, '', '/?invite=PIZZA')

    render(<App />)

    await waitFor(() => expect(getClient().connect).toHaveBeenCalled())
    await waitFor(() =>
      expect(getClient().sendHello).toHaveBeenCalledWith({
        displayName: 'Alice',
        mode: 'code',
        code: 'PIZZA',
      }),
    )
  })

  it('does not auto-submit an invite after the player edits the prefilled display name before reconnect', async () => {
    testState.autoConnectReady = false
    window.localStorage.setItem('stick-rumble.display-name', 'Alice')
    window.history.replaceState({}, '', '/?invite=PIZZA')

    render(<App />)

    await waitFor(() => expect(getClient().connect).toHaveBeenCalled())

    fireEvent.change(screen.getByRole('textbox', { name: 'Display Name' }), {
      target: { value: 'Bob' },
    })

    act(() => {
      getClient().connectionStateHandler?.(true)
    })

    await waitFor(() => expect(screen.getByRole('button', { name: 'Join with Code' })).toBeEnabled())
    expect(getClient().sendHello).not.toHaveBeenCalled()
  })

  it('renders searching and waiting states from session:status without mounting Phaser', async () => {
    render(<App />)
    await waitFor(() => expect(getClient().connect).toHaveBeenCalled())

    emitSessionStatus({
      state: 'searching_for_match',
      playerId: 'player-1',
      displayName: 'Alice',
      joinMode: 'public',
      rosterSize: 1,
      minPlayers: 2,
    })

    expect(screen.getByText(/Searching for match/i)).toBeInTheDocument()
    expect(screen.queryByTestId('phaser-game')).not.toBeInTheDocument()

    emitSessionStatus({
      state: 'waiting_for_players',
      playerId: 'player-1',
      displayName: 'Alice',
      joinMode: 'code',
      code: 'PIZZA',
      roomId: 'room-1',
      rosterSize: 1,
      minPlayers: 2,
    })

    expect(screen.getByText(/Waiting for players/i)).toBeInTheDocument()
    expect(screen.queryByTestId('phaser-game')).not.toBeInTheDocument()
  })

  it('sends session:leave when backing out of a waiting state', async () => {
    render(<App />)
    await waitFor(() => expect(getClient().connect).toHaveBeenCalled())

    fireEvent.change(screen.getByRole('textbox', { name: 'Display Name' }), {
      target: { value: 'Alice' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: 'Room Code' }), {
      target: { value: 'PIZZA' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Join with Code' }))

    emitSessionStatus({
      state: 'waiting_for_players',
      playerId: 'player-1',
      displayName: 'Alice',
      joinMode: 'code',
      code: 'PIZZA',
      roomId: 'room-1',
      rosterSize: 1,
      minPlayers: 2,
    })

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))

    expect(getClient().sendSessionLeave).toHaveBeenCalledTimes(1)
    expect(window.localStorage.getItem('stick-rumble.active-invite.PIZZA.alice')).toBeNull()
    expect(screen.getByRole('button', { name: 'Play Public' })).toBeInTheDocument()
  })

  it('disables join actions when the socket readiness handler reports disconnect', async () => {
    render(<App />)
    await waitFor(() => expect(getClient().connect).toHaveBeenCalled())

    act(() => {
      getClient().connectionStateHandler?.(false)
    })

    expect(screen.getByRole('button', { name: 'Play Public' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Join with Code' })).toBeDisabled()
    expect(screen.getByText('Connecting to game...')).toBeInTheDocument()
  })

  it('mounts Phaser only when match_ready arrives and passes a bootstrap session', async () => {
    render(<App />)
    await waitFor(() => expect(getClient().connect).toHaveBeenCalled())

    emitSessionStatus({
      state: 'match_ready',
      playerId: 'player-1',
      displayName: 'Alice',
      joinMode: 'code',
      code: 'PIZZA',
      roomId: 'room-1',
      mapId: 'default_office',
      rosterSize: 2,
      minPlayers: 2,
    })

    expect(screen.getByTestId('phaser-game')).toBeInTheDocument()
    expect(testState.phaserRenderSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        bootstrap: {
          session: {
            roomId: 'room-1',
            playerId: 'player-1',
            mapId: 'default_office',
            displayName: 'Alice',
            joinMode: 'code',
            code: 'PIZZA',
          },
          wsClient: getClient(),
        },
      }),
    )
  })

  it('keeps the default desktop stage after match_ready on non-phone layouts', async () => {
    render(<App />)
    await waitFor(() => expect(getClient().connect).toHaveBeenCalled())

    emitSessionStatus({
      state: 'match_ready',
      playerId: 'player-1',
      displayName: 'Alice',
      joinMode: 'public',
      roomId: 'room-1',
      mapId: 'default_office',
    })

    expect(screen.getByTestId('stage-shell')).toHaveAttribute('data-stage-mode', 'desktop')
    expect(screen.queryByTestId('mobile-controls')).not.toBeInTheDocument()
    expect(screen.queryByTestId('rotate-device-gate')).not.toBeInTheDocument()
  })

  it('auto-detects mobile landscape mode on phone-sized touch layouts', async () => {
    setViewportSize(844, 390)
    setTouchPhoneLayout(true)

    render(<App />)
    await waitFor(() => expect(getClient().connect).toHaveBeenCalled())

    emitSessionStatus({
      state: 'match_ready',
      playerId: 'player-1',
      displayName: 'Alice',
      joinMode: 'public',
      roomId: 'room-1',
      mapId: 'default_office',
    })

    await waitFor(() =>
      expect(screen.getByTestId('stage-shell')).toHaveAttribute('data-stage-mode', 'mobile-landscape')
    )
    expect(screen.getByTestId('mobile-controls')).toBeInTheDocument()
    expect(screen.queryByTestId('rotate-device-gate')).not.toBeInTheDocument()
  })

  it('shows a rotate-device gate in portrait while keeping Phaser mounted', async () => {
    setViewportSize(390, 844)
    setTouchPhoneLayout(true)

    render(<App />)
    await waitFor(() => expect(getClient().connect).toHaveBeenCalled())

    emitSessionStatus({
      state: 'match_ready',
      playerId: 'player-1',
      displayName: 'Alice',
      joinMode: 'public',
      roomId: 'room-1',
      mapId: 'default_office',
    })

    await waitFor(() =>
      expect(screen.getByTestId('stage-shell')).toHaveAttribute('data-stage-mode', 'mobile-portrait-blocked')
    )
    expect(screen.getByTestId('rotate-device-gate')).toBeInTheDocument()
    expect(screen.getByTestId('phaser-game')).toBeInTheDocument()
  })

  it('preserves the mounted gameplay surface across landscape, portrait gate, and desktop transitions', async () => {
    setViewportSize(844, 390)
    setTouchPhoneLayout(true)

    render(<App />)
    await waitFor(() => expect(getClient().connect).toHaveBeenCalled())

    emitSessionStatus({
      state: 'match_ready',
      playerId: 'player-1',
      displayName: 'Alice',
      joinMode: 'public',
      roomId: 'room-1',
      mapId: 'default_office',
    })

    await waitFor(() =>
      expect(screen.getByTestId('stage-shell')).toHaveAttribute('data-stage-mode', 'mobile-landscape')
    )
    expect(testState.phaserMountSpy).toHaveBeenCalledTimes(1)

    dispatchResize(390, 844)
    await waitFor(() =>
      expect(screen.getByTestId('stage-shell')).toHaveAttribute('data-stage-mode', 'mobile-portrait-blocked')
    )
    expect(screen.getByTestId('phaser-game')).toBeInTheDocument()

    setTouchPhoneLayout(false)
    dispatchResize(1280, 720)
    await waitFor(() =>
      expect(screen.getByTestId('stage-shell')).toHaveAttribute('data-stage-mode', 'desktop')
    )

    expect(screen.getByTestId('phaser-game')).toBeInTheDocument()
    expect(testState.phaserMountSpy).toHaveBeenCalledTimes(1)
    expect(testState.phaserUnmountSpy).not.toHaveBeenCalled()
    expect(testState.clientInstances).toHaveLength(1)
    expect(getClient().sendSessionLeave).not.toHaveBeenCalled()
    expect(getClient().restartSession).not.toHaveBeenCalled()
  })

  it('replaces gameplay with the match-end screen when Phaser reports match end', async () => {
    render(<App />)
    await waitFor(() => expect(getClient().connect).toHaveBeenCalled())

    emitSessionStatus({
      state: 'match_ready',
      playerId: 'player-1',
      displayName: 'Alice',
      joinMode: 'public',
      roomId: 'room-1',
      mapId: 'default_office',
      rosterSize: 2,
      minPlayers: 2,
    })

    const matchEndData: MatchEndData = {
      winners: [{ playerId: 'player-1', displayName: 'Alice' }],
      finalScores: [
        { playerId: 'player-1', displayName: 'Alice', kills: 5, deaths: 1, xp: 650 },
        { playerId: 'player-2', displayName: 'Bob', kills: 3, deaths: 4, xp: 350 },
      ],
      reason: 'time_limit',
    }

    act(() => {
      testState.capturedOnMatchEnd?.(matchEndData, 'player-1')
    })

    expect(screen.queryByTestId('phaser-game')).not.toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Match End Results' })).toBeInTheDocument()
    expect(screen.getByText(/Winner:/i)).toHaveTextContent('Alice')
  })
})
