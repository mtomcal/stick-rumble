import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { JoinIntent, SessionStatusData } from '../shared/types'
import { useMatchAppShell } from './useMatchAppShell'

type Handler = (payload: unknown) => void

class FakeWebSocketClient {
  readonly handlers = new Map<string, Set<Handler>>()
  readonly connect = vi.fn(() => Promise.resolve(undefined))
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
  readonly setReconnectReplayFailedHandler = vi.fn((handler?: (intent: JoinIntent) => void) => {
    this.onReconnectReplayFailed = handler
  })
  readonly setConnectionStateHandler = vi.fn((handler?: (connected: boolean) => void) => {
    this.connectionStateHandler = handler
  })
  readonly setGameplayReady = vi.fn()
  connectionStateHandler?: (connected: boolean) => void
  onReconnectReplayFailed?: (intent: JoinIntent) => void

  emit(event: string, payload: unknown): void {
    this.handlers.get(event)?.forEach((handler) => handler(payload))
  }
}

const matchReadyStatus: SessionStatusData = {
  state: 'match_ready',
  playerId: 'player-1',
  displayName: 'Alice',
  joinMode: 'code',
  code: 'PIZZA',
  roomId: 'room-1',
  mapId: 'default_office',
  rosterSize: 2,
  minPlayers: 2,
}

describe('useMatchAppShell', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.history.replaceState({}, '', '/')
  })

  it('submits join intent only after the socket is ready', async () => {
    const client = new FakeWebSocketClient()
    const { result } = renderHook(() => useMatchAppShell({ client: client as never, tabId: 'tab-1' }))

    await waitFor(() => expect(client.connect).toHaveBeenCalled())

    act(() => {
      result.current.actions.setDisplayName('Alice')
      result.current.actions.setRoomCode('PIZZA')
      result.current.actions.submitCodeJoin()
    })

    expect(client.sendHello).not.toHaveBeenCalled()
    expect(result.current.viewState).toBe('join_form')

    act(() => {
      client.connectionStateHandler?.(true)
    })

    act(() => {
      result.current.actions.submitCodeJoin()
    })

    expect(client.setGameplayReady).toHaveBeenCalledWith(false)
    expect(client.sendHello).toHaveBeenCalledWith({
      displayName: 'Alice',
      mode: 'code',
      code: 'PIZZA',
    })
    expect(result.current.viewState).toBe('joining')
  })

  it('accepts an unclaimed code join and rejects a live duplicate-tab claim', async () => {
    const firstClient = new FakeWebSocketClient()
    const secondClient = new FakeWebSocketClient()
    const first = renderHook(() => useMatchAppShell({ client: firstClient as never, tabId: 'tab-1' }))
    const second = renderHook(() => useMatchAppShell({ client: secondClient as never, tabId: 'tab-2' }))

    await waitFor(() => expect(firstClient.connect).toHaveBeenCalled())
    await waitFor(() => expect(secondClient.connect).toHaveBeenCalled())
    act(() => {
      firstClient.connectionStateHandler?.(true)
      secondClient.connectionStateHandler?.(true)
    })
    await waitFor(() => expect(first.result.current.isSocketReady).toBe(true))
    await waitFor(() => expect(second.result.current.isSocketReady).toBe(true))

    act(() => {
      first.result.current.actions.setDisplayName('Alice')
      first.result.current.actions.setRoomCode('PIZZA')
      second.result.current.actions.setDisplayName('Alice')
      second.result.current.actions.setRoomCode('PIZZA')
    })
    act(() => {
      first.result.current.actions.submitCodeJoin()
    })

    expect(firstClient.sendHello).toHaveBeenCalledTimes(1)
    expect(first.result.current.overlayMode).toBe('join')
    expect(window.localStorage.getItem('stick-rumble.active-invite.PIZZA.alice')).toContain('"owner":"tab-1"')

    act(() => {
      second.result.current.actions.submitCodeJoin()
    })

    expect(secondClient.sendHello).not.toHaveBeenCalled()
    expect(second.result.current.overlayMode).toBe('duplicate')
  })

  it('moves to recoverable_error when reconnect replay fails', async () => {
    const client = new FakeWebSocketClient()
    const { result } = renderHook(() => useMatchAppShell({ client: client as never, tabId: 'tab-1' }))

    await waitFor(() => expect(client.connect).toHaveBeenCalled())

    act(() => {
      client.onReconnectReplayFailed?.({
        displayName: 'Alice',
        mode: 'code',
        code: 'PIZZA',
      })
    })

    expect(result.current.viewState).toBe('recoverable_error')
    expect(result.current.reconnectIntent).toEqual({
      displayName: 'Alice',
      mode: 'code',
      code: 'PIZZA',
    })
  })

  it('preserves mobile entry when the same active session is replayed after reconnect', async () => {
    const client = new FakeWebSocketClient()
    const { result } = renderHook(() => useMatchAppShell({ client: client as never, tabId: 'tab-1' }))

    await waitFor(() => expect(client.connect).toHaveBeenCalled())

    act(() => {
      client.emit('session:status', matchReadyStatus)
    })
    act(() => {
      result.current.actions.confirmMobileEntry()
    })
    act(() => {
      client.emit('session:status', matchReadyStatus)
    })

    expect(result.current.viewState).toBe('in_match')
    expect(result.current.mobileGameplayEntered).toBe(true)
    expect(result.current.matchBootstrap?.session.roomId).toBe('room-1')
  })

  it('resets mobile entry when the app returns to join or a different session becomes active', async () => {
    const client = new FakeWebSocketClient()
    const { result } = renderHook(() => useMatchAppShell({ client: client as never, tabId: 'tab-1' }))

    await waitFor(() => expect(client.connect).toHaveBeenCalled())

    act(() => {
      client.emit('session:status', matchReadyStatus)
    })
    act(() => {
      result.current.actions.confirmMobileEntry()
    })
    expect(result.current.mobileGameplayEntered).toBe(true)

    act(() => {
      result.current.actions.handleMatchEnd({ reason: 'time_limit', winners: [], finalScores: [] }, 'player-1')
      result.current.actions.returnToJoinForm()
    })
    expect(result.current.mobileGameplayEntered).toBe(false)

    act(() => {
      client.emit('session:status', matchReadyStatus)
    })
    act(() => {
      result.current.actions.confirmMobileEntry()
    })
    expect(result.current.mobileGameplayEntered).toBe(true)

    act(() => {
      client.emit('session:status', {
        ...matchReadyStatus,
        playerId: 'player-2',
      })
    })

    expect(result.current.mobileGameplayEntered).toBe(false)
    expect(result.current.matchBootstrap?.session.playerId).toBe('player-2')
  })
})
