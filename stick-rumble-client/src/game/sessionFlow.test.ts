import { describe, expect, it } from 'vitest'
import type { MatchEndData, SessionStatusData } from '../shared/types'
import {
  applyJoinError,
  applyMatchEnd,
  applyReconnectReplayFailed,
  applySessionStatus,
  beginJoin,
  beginReplay,
  createInitialSessionFlowState,
  returnToJoinForm,
} from './sessionFlow'

const matchReadyStatus: SessionStatusData = {
  state: 'match_ready',
  playerId: 'player-1',
  displayName: 'Alice',
  joinMode: 'code',
  code: 'PIZZA',
  roomId: 'room-1',
  mapId: 'arena-default',
  rosterSize: 2,
  minPlayers: 2,
}

describe('sessionFlow', () => {
  it('enters joining without clearing active match identity until the server replies', () => {
    const inMatch = applySessionStatus(createInitialSessionFlowState(), matchReadyStatus)
    const next = beginJoin(inMatch)

    expect(next.viewState).toBe('joining')
    expect(next.activeSessionKey).toBe('room-1:player-1:arena-default')
    expect(next.joinError).toBeNull()
    expect(next.reconnectIntent).toBeNull()
  })

  it('maps pre-match session status snapshots to non-Phaser app states', () => {
    const searching = applySessionStatus(createInitialSessionFlowState(), {
      state: 'searching_for_match',
      playerId: 'player-1',
      displayName: 'Alice',
      joinMode: 'public',
      rosterSize: 1,
      minPlayers: 2,
    })

    expect(searching.viewState).toBe('searching_for_match')
    expect(searching.matchSession).toBeNull()
    expect(searching.shouldResetMobileEntry).toBe(true)

    const waiting = applySessionStatus(searching, {
      state: 'waiting_for_players',
      playerId: 'player-1',
      displayName: 'Alice',
      joinMode: 'code',
      code: 'PIZZA',
      roomId: 'room-1',
      rosterSize: 1,
      minPlayers: 2,
    })

    expect(waiting.viewState).toBe('waiting_for_players')
    expect(waiting.matchSession).toBeNull()
    expect(waiting.sessionStatus?.code).toBe('PIZZA')
  })

  it('derives a match session only from complete match_ready status', () => {
    const next = applySessionStatus(createInitialSessionFlowState(), matchReadyStatus)

    expect(next.viewState).toBe('in_match')
    expect(next.matchSession).toEqual({
      roomId: 'room-1',
      playerId: 'player-1',
      mapId: 'arena-default',
      displayName: 'Alice',
      joinMode: 'code',
      code: 'PIZZA',
    })
    expect(next.localPlayerId).toBe('player-1')
    expect(next.activeSessionKey).toBe('room-1:player-1:arena-default')
    expect(next.shouldResetMobileEntry).toBe(true)
  })

  it('preserves mobile entry for repeated match_ready delivery of the same session', () => {
    const first = applySessionStatus(createInitialSessionFlowState(), matchReadyStatus)
    const repeated = applySessionStatus(first, matchReadyStatus)

    expect(first.shouldResetMobileEntry).toBe(true)
    expect(repeated.shouldResetMobileEntry).toBe(false)
  })

  it('resets mobile entry when match_ready identifies a different active session', () => {
    const first = applySessionStatus(createInitialSessionFlowState(), matchReadyStatus)
    const next = applySessionStatus(first, {
      ...matchReadyStatus,
      playerId: 'player-2',
    })

    expect(next.activeSessionKey).toBe('room-1:player-2:arena-default')
    expect(next.shouldResetMobileEntry).toBe(true)
  })

  it('routes incomplete match_ready status to a recoverable error state', () => {
    const next = applySessionStatus(createInitialSessionFlowState(), {
      ...matchReadyStatus,
      roomId: undefined,
    })

    expect(next.viewState).toBe('recoverable_error')
    expect(next.matchSession).toBeNull()
    expect(next.activeSessionKey).toBeNull()
  })

  it('captures join and reconnect errors without changing the active session key', () => {
    const inMatch = applySessionStatus(createInitialSessionFlowState(), matchReadyStatus)
    const badCode = applyJoinError(inMatch, { type: 'error:bad_room_code', reason: 'too_short' })

    expect(badCode.viewState).toBe('recoverable_error')
    expect(badCode.joinError).toEqual({ type: 'error:bad_room_code', reason: 'too_short' })
    expect(badCode.activeSessionKey).toBe('room-1:player-1:arena-default')

    const replayFailed = applyReconnectReplayFailed(badCode, {
      displayName: 'Alice',
      mode: 'code',
      code: 'PIZZA',
    })

    expect(replayFailed.joinError).toBeNull()
    expect(replayFailed.reconnectIntent).toEqual({
      displayName: 'Alice',
      mode: 'code',
      code: 'PIZZA',
    })
  })

  it('exits active match states through explicit app actions', () => {
    const inMatch = applySessionStatus(createInitialSessionFlowState(), matchReadyStatus)
    const ended = applyMatchEnd(inMatch, { reason: 'time_limit', winners: [], finalScores: [] } as MatchEndData, 'player-1')

    expect(ended.viewState).toBe('match_end')
    expect(ended.matchSession).toBeNull()
    expect(ended.localPlayerId).toBe('player-1')
    expect(ended.activeSessionKey).toBeNull()

    const replaying = beginReplay(ended)
    expect(replaying.viewState).toBe('joining')
    expect(replaying.matchEndData).toBeNull()
    expect(replaying.shouldResetMobileEntry).toBe(true)

    const joinForm = returnToJoinForm(replaying)
    expect(joinForm.viewState).toBe('join_form')
    expect(joinForm.sessionStatus).toBeNull()
    expect(joinForm.matchSession).toBeNull()
  })
})
