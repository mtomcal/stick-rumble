import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { MatchBootstrap } from './sessionRuntime'
import {
  applyJoinError,
  applyMatchEnd,
  applyReconnectReplayFailed,
  applySessionStatus,
  beginJoin,
  beginReplay,
  createInitialSessionFlowState,
  returnToJoinForm as returnToJoinFormState,
  type AppViewState,
  type MatchSessionFlowState,
} from './sessionFlow'
import { WebSocketClient } from './network/WebSocketClient'
import type {
  JoinErrorPayload,
  JoinIntent,
  MatchEndData,
  SessionStatusData,
} from '../shared/types'
import {
  buildInviteLink,
  formatReconnectLabel,
  getInviteCodeFromLocation,
  getWebSocketUrl,
} from './config/runtimeConfig'

const DISPLAY_NAME_STORAGE_KEY = 'stick-rumble.display-name'
const DUPLICATE_TAB_TTL_MS = 5000
const DUPLICATE_TAB_HEARTBEAT_MS = 2000

export type OverlayMode = 'join' | 'duplicate'

export interface MatchAppShellClient {
  connect(): Promise<void>
  disconnect(): void
  on(event: string, handler: (payload: unknown) => void): void
  off(event: string, handler: (payload: unknown) => void): void
  sendHello(intent: JoinIntent): void
  sendSessionLeave(): void
  restartSession(intent: JoinIntent): void
  setReconnectReplayFailedHandler(handler?: (intent: JoinIntent) => void): void
  setConnectionStateHandler(handler?: (connected: boolean) => void): void
  setGameplayReady(ready: boolean): void
}

interface BroadcastChannelLike {
  onmessage: ((event: MessageEvent<{ type: string; key: string }>) => void) | null
  postMessage(message: { type: string; key: string }): void
  close(): void
}

export interface MatchAppShellOptions {
  client?: MatchAppShellClient
  inviteCode?: string | null
  initialSavedDisplayName?: string
  storage?: Storage | null
  tabId?: string
  createBroadcastChannel?: (name: string) => BroadcastChannelLike | null
}

export interface MatchAppShellModel {
  inviteCode: string | null
  joinForm: {
    displayName: string
    code: string
  }
  overlayMode: OverlayMode
  isSocketReady: boolean
  viewState: AppViewState
  sessionFlow: MatchSessionFlowState
  sessionStatus: SessionStatusData | null
  matchEndData: MatchEndData | null
  localPlayerId: string
  reconnectIntent: JoinIntent | null
  errorText: string | null
  reconnectLabel: string | null
  matchBootstrap: MatchBootstrap | null
  mobileGameplayEntered: boolean
  actions: {
    setDisplayName: (value: string) => void
    setRoomCode: (value: string) => void
    submitPublicJoin: () => void
    submitCodeJoin: () => void
    submitReconnectIntent: () => void
    cancelWaiting: () => void
    handleMatchEnd: (data: MatchEndData, playerId: string) => void
    playAgain: () => void
    returnToJoinForm: () => void
    copyInviteLink: () => Promise<void>
    confirmMobileEntry: () => void
  }
}

function getBrowserStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null
  }

  const storage = window.localStorage as Partial<Storage> | undefined
  if (
    storage &&
    typeof storage.getItem === 'function' &&
    typeof storage.setItem === 'function' &&
    typeof storage.removeItem === 'function' &&
    typeof storage.clear === 'function'
  ) {
    return window.localStorage
  }

  return null
}

function createDefaultClient(): MatchAppShellClient {
  return new WebSocketClient(getWebSocketUrl(), false)
}

function createDefaultBroadcastChannel(name: string): BroadcastChannelLike | null {
  if (typeof BroadcastChannel === 'undefined') {
    return null
  }
  return new BroadcastChannel(name) as BroadcastChannelLike
}

function formatJoinError(error: JoinErrorPayload | null, currentCode: string): string | null {
  if (!error) {
    return null
  }

  if (error.type === 'error:bad_room_code') {
    return `Bad room code: ${error.reason ?? 'invalid'}.`
  }
  if (error.type === 'error:room_full') {
    return `Room ${error.code ?? currentCode} is full.`
  }
  return `Server rejected ${error.offendingType ?? 'message'} before hello.`
}

export function useMatchAppShell(options: MatchAppShellOptions = {}): MatchAppShellModel {
  const inviteCode = useMemo(
    () => options.inviteCode ?? getInviteCodeFromLocation(),
    [options.inviteCode],
  )
  const storage = options.storage ?? getBrowserStorage()
  const initialSavedDisplayName = useMemo(
    () => options.initialSavedDisplayName ?? storage?.getItem(DISPLAY_NAME_STORAGE_KEY) ?? '',
    [options.initialSavedDisplayName, storage],
  )
  const [client] = useState<MatchAppShellClient>(() => options.client ?? createDefaultClient())
  const [tabId] = useState(
    () => options.tabId ?? `tab-${globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36)}`,
  )
  const createBroadcastChannel = options.createBroadcastChannel ?? createDefaultBroadcastChannel
  const claimIntervalRef = useRef<number | null>(null)
  const claimedInviteKeyRef = useRef<string | null>(null)
  const duplicateBlockedKeyRef = useRef<string | null>(null)
  const broadcastChannelRef = useRef<BroadcastChannelLike | null>(null)
  const autoJoinAttemptedRef = useRef(false)
  const displayNameDirtyRef = useRef(false)

  const [sessionFlow, setSessionFlow] = useState(() => createInitialSessionFlowState())
  const [joinForm, setJoinForm] = useState(() => ({
    displayName: initialSavedDisplayName,
    code: inviteCode ?? '',
  }))
  const [isSocketReady, setIsSocketReady] = useState(false)
  const [overlayMode, setOverlayMode] = useState<OverlayMode>('join')
  const [mobileGameplayEntered, setMobileGameplayEntered] = useState(false)

  const updateSessionFlow = useCallback((recipe: (state: MatchSessionFlowState) => MatchSessionFlowState) => {
    setSessionFlow((prev) => {
      const next = recipe(prev)
      if (next.shouldResetMobileEntry) {
        setMobileGameplayEntered(false)
      }
      return next
    })
  }, [])

  const releaseInviteClaim = useCallback(() => {
    if (claimIntervalRef.current !== null) {
      window.clearInterval(claimIntervalRef.current)
      claimIntervalRef.current = null
    }
    if (claimedInviteKeyRef.current) {
      storage?.removeItem(claimedInviteKeyRef.current)
      try {
        broadcastChannelRef.current?.postMessage({ type: 'release', key: claimedInviteKeyRef.current })
      } catch {
        // Ignore closed-channel races during teardown.
      }
      claimedInviteKeyRef.current = null
    }
  }, [storage])

  const claimInviteSlot = useCallback((intent: JoinIntent): boolean => {
    releaseInviteClaim()

    if (intent.mode !== 'code' || !intent.code || !intent.displayName?.trim()) {
      return true
    }

    const normalizedDisplayName = intent.displayName.trim().toLowerCase()
    const normalizedCode = intent.code.trim().toUpperCase()
    const key = `stick-rumble.active-invite.${normalizedCode}.${normalizedDisplayName}`
    duplicateBlockedKeyRef.current = key
    const now = Date.now()
    const current = storage?.getItem(key)
    if (current) {
      try {
        const parsed = JSON.parse(current) as { owner: string; updatedAt: number }
        if (parsed.owner !== tabId && now - parsed.updatedAt < DUPLICATE_TAB_TTL_MS) {
          setOverlayMode('duplicate')
          return false
        }
      } catch {
        // Ignore malformed stale claims and replace them.
      }
    }

    const writeClaim = () => {
      storage?.setItem(key, JSON.stringify({ owner: tabId, updatedAt: Date.now() }))
    }

    writeClaim()
    broadcastChannelRef.current?.postMessage({ type: 'claim', key })
    claimedInviteKeyRef.current = key
    duplicateBlockedKeyRef.current = null
    claimIntervalRef.current = window.setInterval(writeClaim, DUPLICATE_TAB_HEARTBEAT_MS)
    return true
  }, [releaseInviteClaim, storage, tabId])

  const submitJoinIntent = useCallback((intent: JoinIntent) => {
    if (!isSocketReady) {
      return
    }

    if (!claimInviteSlot(intent)) {
      return
    }

    setOverlayMode('join')
    updateSessionFlow((prev) => beginJoin(prev))
    client.setGameplayReady(false)
    client.sendHello(intent)
  }, [claimInviteSlot, client, isSocketReady, updateSessionFlow])

  useEffect(() => {
    client.setConnectionStateHandler((connected) => {
      setIsSocketReady(connected)
    })
    client.setReconnectReplayFailedHandler((intent) => {
      updateSessionFlow((prev) => applyReconnectReplayFailed(prev, intent))
    })

    const onSessionStatus = (payload: unknown) => {
      const status = payload as SessionStatusData
      setJoinForm((prev) => ({ ...prev, displayName: status.displayName, code: status.code ?? prev.code }))
      storage?.setItem(DISPLAY_NAME_STORAGE_KEY, status.displayName)
      updateSessionFlow((prev) => applySessionStatus(prev, status))
    }

    const onBadRoomCode = (payload: unknown) => {
      updateSessionFlow((prev) => applyJoinError(prev, {
        type: 'error:bad_room_code',
        reason: (payload as { reason?: string })?.reason,
      }))
    }

    const onRoomFull = (payload: unknown) => {
      updateSessionFlow((prev) => applyJoinError(prev, {
        type: 'error:room_full',
        code: (payload as { code?: string })?.code,
      }))
    }

    const onNoHello = (payload: unknown) => {
      updateSessionFlow((prev) => applyJoinError(prev, {
        type: 'error:no_hello',
        offendingType: (payload as { offendingType?: string })?.offendingType,
      }))
    }

    client.on('session:status', onSessionStatus)
    client.on('error:bad_room_code', onBadRoomCode)
    client.on('error:room_full', onRoomFull)
    client.on('error:no_hello', onNoHello)

    client.connect().catch(() => {
      // Initial socket failures are transport state, not a server-side join rejection.
    })

    return () => {
      client.off('session:status', onSessionStatus)
      client.off('error:bad_room_code', onBadRoomCode)
      client.off('error:room_full', onRoomFull)
      client.off('error:no_hello', onNoHello)
      client.setConnectionStateHandler(undefined)
      client.setReconnectReplayFailedHandler(undefined)
      client.disconnect()
    }
  }, [client, storage, updateSessionFlow])

  useEffect(() => {
    broadcastChannelRef.current = createBroadcastChannel('stick-rumble-invite-claims')
    if (broadcastChannelRef.current) {
      broadcastChannelRef.current.onmessage = (event) => {
        if (!event.data?.key) {
          return
        }

        if (event.data.type === 'release' && duplicateBlockedKeyRef.current === event.data.key) {
          setOverlayMode('join')
        }
      }
    }

    const onStorage = (event: StorageEvent) => {
      if (!event.key) {
        return
      }

      const trackedKey = claimedInviteKeyRef.current ?? duplicateBlockedKeyRef.current
      if (!trackedKey || event.key !== trackedKey) {
        return
      }

      if (!event.newValue) {
        if (duplicateBlockedKeyRef.current === trackedKey) {
          setOverlayMode('join')
        }
        return
      }

      try {
        const parsed = JSON.parse(event.newValue) as { owner: string }
        if (parsed.owner !== tabId) {
          setOverlayMode('duplicate')
        }
      } catch {
        // Ignore malformed storage noise.
      }
    }

    window.addEventListener('storage', onStorage)
    return () => {
      broadcastChannelRef.current?.close()
      window.removeEventListener('storage', onStorage)
      releaseInviteClaim()
    }
  }, [createBroadcastChannel, releaseInviteClaim, tabId])

  useEffect(() => {
    const hasPrefilledDisplayName = initialSavedDisplayName.trim().length > 0
    if (
      !inviteCode ||
      !hasPrefilledDisplayName ||
      displayNameDirtyRef.current ||
      autoJoinAttemptedRef.current ||
      !isSocketReady
    ) {
      return
    }

    autoJoinAttemptedRef.current = true
    const frameId = window.requestAnimationFrame(() => {
      submitJoinIntent({
        displayName: initialSavedDisplayName,
        mode: 'code',
        code: inviteCode,
      })
    })

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [initialSavedDisplayName, inviteCode, isSocketReady, submitJoinIntent])

  const handleMatchEnd = useCallback((data: MatchEndData, playerId: string) => {
    updateSessionFlow((prev) => applyMatchEnd(prev, data, playerId))
  }, [updateSessionFlow])

  const cancelWaiting = useCallback(() => {
    client.sendSessionLeave()
    releaseInviteClaim()
    updateSessionFlow((prev) => returnToJoinFormState(prev))
  }, [client, releaseInviteClaim, updateSessionFlow])

  const playAgain = useCallback(() => {
    const lastIntent = sessionFlow.reconnectIntent ?? {
      displayName: sessionFlow.sessionStatus?.displayName ?? joinForm.displayName,
      mode: sessionFlow.sessionStatus?.joinMode ?? (joinForm.code.trim() ? 'code' : 'public'),
      code: sessionFlow.sessionStatus?.code ?? (joinForm.code.trim() || undefined),
    }

    updateSessionFlow((prev) => beginReplay(prev))
    client.restartSession(lastIntent)
  }, [client, joinForm.code, joinForm.displayName, sessionFlow.reconnectIntent, sessionFlow.sessionStatus, updateSessionFlow])

  const returnToJoinForm = useCallback(() => {
    releaseInviteClaim()
    updateSessionFlow((prev) => returnToJoinFormState(prev))
  }, [releaseInviteClaim, updateSessionFlow])

  const matchBootstrap = sessionFlow.matchSession
    ? { session: sessionFlow.matchSession, wsClient: client as WebSocketClient }
    : null

  return {
    inviteCode,
    joinForm,
    overlayMode,
    isSocketReady,
    viewState: sessionFlow.viewState,
    sessionFlow,
    sessionStatus: sessionFlow.sessionStatus,
    matchEndData: sessionFlow.matchEndData,
    localPlayerId: sessionFlow.localPlayerId,
    reconnectIntent: sessionFlow.reconnectIntent,
    errorText: formatJoinError(sessionFlow.joinError, joinForm.code),
    reconnectLabel: sessionFlow.reconnectIntent ? formatReconnectLabel(sessionFlow.reconnectIntent) : null,
    matchBootstrap,
    mobileGameplayEntered,
    actions: {
      setDisplayName: (value: string) => {
        displayNameDirtyRef.current = true
        setJoinForm((prev) => ({ ...prev, displayName: value }))
      },
      setRoomCode: (value: string) => {
        setJoinForm((prev) => ({ ...prev, code: value }))
      },
      submitPublicJoin: () => {
        submitJoinIntent({ displayName: joinForm.displayName, mode: 'public' })
      },
      submitCodeJoin: () => {
        submitJoinIntent({ displayName: joinForm.displayName, mode: 'code', code: joinForm.code })
      },
      submitReconnectIntent: () => {
        if (sessionFlow.reconnectIntent) {
          submitJoinIntent(sessionFlow.reconnectIntent)
        }
      },
      cancelWaiting,
      handleMatchEnd,
      playAgain,
      returnToJoinForm,
      copyInviteLink: async () => {
        if (!sessionFlow.sessionStatus?.code) {
          return
        }

        const link = buildInviteLink(sessionFlow.sessionStatus.code)
        await navigator.clipboard?.writeText(link)
      },
      confirmMobileEntry: () => {
        setMobileGameplayEntered(true)
      },
    },
  }
}
