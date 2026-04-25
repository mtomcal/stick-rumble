import type {
  JoinErrorPayload,
  JoinIntent,
  MatchEndData,
  MatchSession,
  SessionStatusData,
} from '../shared/types'

export type AppViewState =
  | 'join_form'
  | 'joining'
  | 'searching_for_match'
  | 'waiting_for_players'
  | 'in_match'
  | 'match_end'
  | 'recoverable_error'

export interface MatchSessionFlowState {
  viewState: AppViewState
  sessionStatus: SessionStatusData | null
  matchSession: MatchSession | null
  matchEndData: MatchEndData | null
  localPlayerId: string
  joinError: JoinErrorPayload | null
  reconnectIntent: JoinIntent | null
  activeSessionKey: string | null
  shouldResetMobileEntry: boolean
}

export function createInitialSessionFlowState(): MatchSessionFlowState {
  return {
    viewState: 'join_form',
    sessionStatus: null,
    matchSession: null,
    matchEndData: null,
    localPlayerId: '',
    joinError: null,
    reconnectIntent: null,
    activeSessionKey: null,
    shouldResetMobileEntry: false,
  }
}

export function getSessionKey(session: MatchSession): string {
  return `${session.roomId}:${session.playerId}:${session.mapId}`
}

export function toMatchSession(status: SessionStatusData): MatchSession | null {
  if (status.state !== 'match_ready' || !status.roomId || !status.mapId) {
    return null
  }

  return {
    roomId: status.roomId,
    playerId: status.playerId,
    mapId: status.mapId,
    displayName: status.displayName,
    joinMode: status.joinMode,
    code: status.code,
  }
}

export function beginJoin(state: MatchSessionFlowState): MatchSessionFlowState {
  return {
    ...state,
    viewState: 'joining',
    sessionStatus: null,
    matchEndData: null,
    joinError: null,
    reconnectIntent: null,
    shouldResetMobileEntry: false,
  }
}

export function applyReconnectReplayFailed(
  state: MatchSessionFlowState,
  intent: JoinIntent
): MatchSessionFlowState {
  return {
    ...state,
    viewState: 'recoverable_error',
    sessionStatus: null,
    joinError: null,
    reconnectIntent: intent,
    shouldResetMobileEntry: false,
  }
}

export function applySessionStatus(
  state: MatchSessionFlowState,
  status: SessionStatusData
): MatchSessionFlowState {
  if (status.state === 'searching_for_match') {
    return {
      ...state,
      viewState: 'searching_for_match',
      sessionStatus: status,
      matchSession: null,
      joinError: null,
      reconnectIntent: null,
      activeSessionKey: null,
      shouldResetMobileEntry: true,
    }
  }

  if (status.state === 'waiting_for_players') {
    return {
      ...state,
      viewState: 'waiting_for_players',
      sessionStatus: status,
      matchSession: null,
      joinError: null,
      reconnectIntent: null,
      activeSessionKey: null,
      shouldResetMobileEntry: true,
    }
  }

  const matchSession = toMatchSession(status)
  if (!matchSession) {
    return {
      ...state,
      viewState: 'recoverable_error',
      sessionStatus: status,
      matchSession: null,
      matchEndData: null,
      localPlayerId: status.playerId,
      joinError: null,
      reconnectIntent: null,
      activeSessionKey: null,
      shouldResetMobileEntry: true,
    }
  }

  const nextSessionKey = getSessionKey(matchSession)
  return {
    ...state,
    viewState: 'in_match',
    sessionStatus: status,
    matchSession,
    matchEndData: null,
    localPlayerId: status.playerId,
    joinError: null,
    reconnectIntent: null,
    activeSessionKey: nextSessionKey,
    shouldResetMobileEntry: state.activeSessionKey !== nextSessionKey,
  }
}

export function applyJoinError(
  state: MatchSessionFlowState,
  error: JoinErrorPayload
): MatchSessionFlowState {
  return {
    ...state,
    viewState: 'recoverable_error',
    joinError: error,
    shouldResetMobileEntry: false,
  }
}

export function returnToJoinForm(state: MatchSessionFlowState): MatchSessionFlowState {
  return {
    ...state,
    viewState: 'join_form',
    sessionStatus: null,
    matchSession: null,
    joinError: null,
    activeSessionKey: null,
    shouldResetMobileEntry: true,
  }
}

export function applyMatchEnd(
  state: MatchSessionFlowState,
  data: MatchEndData,
  playerId: string
): MatchSessionFlowState {
  return {
    ...state,
    viewState: 'match_end',
    matchSession: null,
    matchEndData: data,
    localPlayerId: playerId,
    activeSessionKey: null,
    shouldResetMobileEntry: false,
  }
}

export function beginReplay(state: MatchSessionFlowState): MatchSessionFlowState {
  return {
    ...state,
    viewState: 'joining',
    matchEndData: null,
    joinError: null,
    activeSessionKey: null,
    shouldResetMobileEntry: true,
  }
}
