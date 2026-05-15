import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../App'
import type { PlayerInfo } from '../../shared/types'

// ── Mocks ──────────────────────────────────────────────────────────

const mockGetSessionToken = vi.fn()
const mockStoreSessionToken = vi.fn()
const mockClearSessionToken = vi.fn()
const mockFetchPlayerMe = vi.fn()
const mockWebSocketCtor = vi.fn()

vi.mock('../../game/network/sessionToken', () => ({
  getSessionToken: (...args: unknown[]) => mockGetSessionToken(...args),
  storeSessionToken: (...args: unknown[]) => mockStoreSessionToken(...args),
  clearSessionToken: (...args: unknown[]) => mockClearSessionToken(...args),
  hasSessionToken: () => mockGetSessionToken() !== null,
}))

vi.mock('../../game/network/playerApi', () => ({
  fetchPlayerMe: (...args: unknown[]) => mockFetchPlayerMe(...args),
}))

// Mock useMatchAppShell to a noop shell that does NOT create WebSocket connections
vi.mock('../../game/useMatchAppShell', () => ({
  useMatchAppShell: () => {
    const actions = {
      setDisplayName: vi.fn(),
      setRoomCode: vi.fn(),
      submitPublicJoin: vi.fn(),
      submitCodeJoin: vi.fn(),
      submitReconnectIntent: vi.fn(),
      cancelWaiting: vi.fn(),
      handleMatchEnd: vi.fn(),
      playAgain: vi.fn(),
      returnToJoinForm: vi.fn(),
      copyInviteLink: vi.fn(async () => undefined),
      confirmMobileEntry: vi.fn(),
    }
    return {
      inviteCode: null,
      joinForm: { displayName: '', code: '' },
      overlayMode: 'join' as const,
      isSocketReady: true,
      viewState: 'join_form' as const,
      sessionFlow: {
        viewState: 'join_form' as const,
        sessionStatus: null,
        matchSession: null,
        matchEndData: null,
        localPlayerId: '',
        joinError: null,
        reconnectIntent: null,
        activeSessionKey: null,
        shouldResetMobileEntry: false,
      },
      sessionStatus: null,
      matchEndData: null,
      localPlayerId: '',
      reconnectIntent: null,
      errorText: null,
      reconnectLabel: null,
      matchBootstrap: null,
      mobileGameplayEntered: false,
      actions,
    }
  },
}))

vi.mock('../../ui/common/mobileMode', () => ({
  useStageMode: () => ({
    stageMode: 'desktop' as const,
    width: 1280,
    height: 720,
    isSettling: false,
  }),
}))

vi.mock('../../ui/common/PhaserGame', () => ({
  PhaserGame: () => <div data-testid="phaser-game">Phaser</div>,
}))

vi.mock('../../ui/mobile/MobileControls', () => ({
  MobileControls: () => <div data-testid="mobile-controls" />,
}))

vi.mock('../../ui/mobile/RotateDeviceGate', () => ({
  RotateDeviceGate: () => <div data-testid="rotate-device-gate" />,
}))

vi.mock('../../ui/match/MatchEndScreen', () => ({
  MatchEndScreen: () => <div data-testid="match-end-screen" />,
}))

vi.mock('../../ui/debug/DebugNetworkPanel', () => ({
  DebugNetworkPanel: () => <div data-testid="debug-panel" />,
}))

// Mock screen components for controlled testing
vi.mock('../../ui/auth/SignInScreen', () => ({
  SignInScreen: (props: {
    onAuthenticated?: (result: { token: string; needsDisplayName: boolean }) => void
  }) => (
    <div data-testid="sign-in-screen">
      <button
        data-testid="mock-sign-in-btn"
        onClick={() => props.onAuthenticated?.({ token: 'mock-token', needsDisplayName: false })}
      >
        Sign In
      </button>
      <button
        data-testid="mock-sign-in-needs-name-btn"
        onClick={() => props.onAuthenticated?.({ token: 'mock-token', needsDisplayName: true })}
      >
        Sign In (needs name)
      </button>
    </div>
  ),
}))

vi.mock('../../ui/auth/DisplayNamePickerScreen', () => ({
  DisplayNamePickerScreen: (props: {
    token: string
    onConfirm: (displayName: string) => void
  }) => (
    <div data-testid="display-name-picker-screen">
      <span data-testid="display-name-token">{props.token}</span>
      <button
        data-testid="mock-confirm-name-btn"
        onClick={() => props.onConfirm('TestPlayer')}
      >
        Confirm Name
      </button>
    </div>
  ),
}))

vi.mock('../../ui/lobby/LobbyScreen', () => ({
  LobbyScreen: (props: {
    onPlayPublic: () => void
    onSignOut: () => void
    onNavigateProfile?: () => void
  }) => (
    <div data-testid="lobby-screen">
      <button data-testid="mock-play-public" onClick={props.onPlayPublic}>
        Play Public
      </button>
      <button data-testid="mock-sign-out" onClick={props.onSignOut}>
        Sign Out
      </button>
      {props.onNavigateProfile && (
        <button data-testid="mock-profile-nav" onClick={props.onNavigateProfile}>
          Profile
        </button>
      )}
    </div>
  ),
}))

vi.mock('../../ui/profile/ProfileScreen', () => ({
  ProfileScreen: (props: { onBack: () => void; player?: PlayerInfo | null }) => (
    <div data-testid="profile-screen">
      <span data-testid="profile-player-name">{props.player?.displayName ?? 'none'}</span>
      <button data-testid="mock-back" onClick={props.onBack}>
        Back to Lobby
      </button>
    </div>
  ),
}))

const BASE_PLAYER: PlayerInfo = {
  playerId: 'abc-123',
  displayName: 'TestPlayer',
  level: 4,
  currentLevelXp: 500,
  xpForNextLevel: 2500,
  lifetimeStats: {
    kills: 100,
    deaths: 50,
    wins: 20,
    gamesPlayed: 80,
    totalXp: 5000,
    damageDealt: 10000,
  },
}

const PLAYER_WITH_DEFAULT_NAME: PlayerInfo = {
  ...BASE_PLAYER,
  displayName: 'Player',
}

// ── Helpers ─────────────────────────────────────────────────────────

function renderApp(initialEntries: string[] = ['/']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <App />
    </MemoryRouter>,
  )
}

/** Wait for the auth hydration useEffect to settle */
async function waitForAuthSettled() {
  // The useEffect runs asynchronously; wait for the app to settle
  await waitFor(() => {
    // Either we get a screen or the loading state resolves
  }, { timeout: 2000 })
}

// ── Tests ───────────────────────────────────────────────────────────

describe('App Router', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('WebSocket', mockWebSocketCtor)
    mockGetSessionToken.mockReturnValue(null)
    mockFetchPlayerMe.mockResolvedValue({ status: 'ok' as const, player: BASE_PLAYER })
    mockWebSocketCtor.mockClear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  // ── 1. /sign-in renders SignInScreen ──────────────────────────────
  it('1. /sign-in renders SignInScreen when unauthenticated', async () => {
    mockGetSessionToken.mockReturnValue(null)
    renderApp(['/sign-in'])
    await waitForAuthSettled()

    expect(screen.getByTestId('sign-in-screen')).toBeInTheDocument()
  })

  // ── 2. /lobby with valid token + display name renders LobbyScreen ─
  it('2. /lobby with valid token + display name renders LobbyScreen', async () => {
    mockGetSessionToken.mockReturnValue('valid-token')
    mockFetchPlayerMe.mockResolvedValue({ status: 'ok', player: BASE_PLAYER })
    renderApp(['/lobby'])
    await waitForAuthSettled()

    expect(screen.getByTestId('lobby-screen')).toBeInTheDocument()
  })

  // ── 3. /lobby without token redirects to /sign-in ─────────────────
  it('3. /lobby without token redirects to /sign-in', async () => {
    mockGetSessionToken.mockReturnValue(null)
    renderApp(['/lobby'])
    await waitForAuthSettled()

    expect(screen.getByTestId('sign-in-screen')).toBeInTheDocument()
    expect(screen.queryByTestId('lobby-screen')).not.toBeInTheDocument()
  })

  // ── 4. /lobby with token + needsDisplayName redirects to /display-name ─
  it('4. /lobby with token + needsDisplayName redirects to /display-name', async () => {
    mockGetSessionToken.mockReturnValue('valid-token')
    // Player without display name → needsDisplayName = true
    mockFetchPlayerMe.mockResolvedValue({ status: 'ok', player: PLAYER_WITH_DEFAULT_NAME })
    renderApp(['/lobby'])
    await waitForAuthSettled()

    // Navigation via <Navigate> is async; wait for display-name to appear
    await waitFor(() => {
      expect(screen.getByTestId('display-name-picker-screen')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('lobby-screen')).not.toBeInTheDocument()
  })

  // ── 5. /profile without token redirects to /sign-in ───────────────
  it('5. /profile without token redirects to /sign-in', async () => {
    mockGetSessionToken.mockReturnValue(null)
    renderApp(['/profile'])
    await waitForAuthSettled()

    expect(screen.getByTestId('sign-in-screen')).toBeInTheDocument()
    expect(screen.queryByTestId('profile-screen')).not.toBeInTheDocument()
  })

  // ── 6. /profile with valid token renders ProfileScreen ────────────
  it('6. /profile with valid token renders ProfileScreen', async () => {
    mockGetSessionToken.mockReturnValue('valid-token')
    mockFetchPlayerMe.mockResolvedValue({ status: 'ok', player: BASE_PLAYER })
    renderApp(['/profile'])
    await waitForAuthSettled()

    expect(screen.getByTestId('profile-screen')).toBeInTheDocument()
    expect(screen.getByTestId('profile-player-name')).toHaveTextContent('TestPlayer')
  })

  // ── 7. /display-name without token redirects to /sign-in ──────────
  it('7. /display-name without token redirects to /sign-in', async () => {
    mockGetSessionToken.mockReturnValue(null)
    renderApp(['/display-name'])
    await waitForAuthSettled()

    expect(screen.getByTestId('sign-in-screen')).toBeInTheDocument()
    expect(screen.queryByTestId('display-name-picker-screen')).not.toBeInTheDocument()
  })

  // ── 8. /display-name with token + has display name redirects to /lobby ─
  it('8. /display-name with token + has display name redirects to /lobby', async () => {
    mockGetSessionToken.mockReturnValue('valid-token')
    mockFetchPlayerMe.mockResolvedValue({ status: 'ok', player: BASE_PLAYER })
    renderApp(['/display-name'])
    await waitForAuthSettled()

    // Navigation via <Navigate> is async; wait for lobby to appear
    await waitFor(() => {
      expect(screen.getByTestId('lobby-screen')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('display-name-picker-screen')).not.toBeInTheDocument()
  })

  // ── 9. Stored token + unauthorized → clear token, unauthenticated, /sign-in ─
  it('9. Stored token + fetchPlayerMe unauthorized → clearToken + /sign-in', async () => {
    mockGetSessionToken.mockReturnValue('stored-token')
    mockFetchPlayerMe.mockResolvedValue({ status: 'unauthorized' })
    renderApp(['/sign-in'])
    await waitForAuthSettled()

    expect(mockClearSessionToken).toHaveBeenCalledOnce()
    expect(screen.getByTestId('sign-in-screen')).toBeInTheDocument()
  })

  // ── 10. Stored token + server error → token kept, loading with error ─
  it('10. Stored token + fetchPlayerMe server error → token kept, loading/retry UI', async () => {
    mockGetSessionToken.mockReturnValue('stored-token')
    mockFetchPlayerMe.mockResolvedValue({ status: 'error', error: 'Server returned 500' })
    renderApp(['/'])
    await waitForAuthSettled()

    // Token should NOT be cleared on server error
    expect(mockClearSessionToken).not.toHaveBeenCalled()
    // Should show loading/retry UI (the app-loading div)
    expect(screen.getByTestId('app-loading')).toBeInTheDocument()
  })

  // ── 11. Stored token + network error → token kept, loading with error ─
  it('11. Stored token + fetchPlayerMe network error → token kept, loading/retry UI', async () => {
    mockGetSessionToken.mockReturnValue('stored-token')
    mockFetchPlayerMe.mockResolvedValue({ status: 'error', error: 'NetworkError: Failed to fetch' })
    renderApp(['/'])
    await waitForAuthSettled()

    expect(mockClearSessionToken).not.toHaveBeenCalled()
    expect(screen.getByTestId('app-loading')).toBeInTheDocument()
  })

  // ── 12. Auth routes do NOT instantiate gameplay WebSocket ──────────
  it('12. Auth routes do NOT instantiate gameplay WebSocket', async () => {
    mockGetSessionToken.mockReturnValue(null)
    renderApp(['/sign-in'])
    await waitForAuthSettled()

    // WebSocket should NOT have been called (no match shell active)
    expect(mockWebSocketCtor).not.toHaveBeenCalled()
  })

  // ── 13. /play + pending auth → loading/retry UI, no guest WebSocket ─
  it('13. /play + pending auth → loading/retry UI, no guest WebSocket', async () => {
    // Simulate pending auth: token exists but fetch never resolves
    mockGetSessionToken.mockReturnValue('stored-token')
    // Return a promise that never resolves
    mockFetchPlayerMe.mockReturnValue(new Promise(() => { /* never resolves */ }))
    renderApp(['/play'])

    // Should show loading UI
    expect(screen.getByTestId('app-loading')).toBeInTheDocument()

    // No WebSocket should be created
    expect(mockWebSocketCtor).not.toHaveBeenCalled()
  })

  // ── 14. SignInScreen onAuthenticated called with { token, needsDisplayName } ─
  it('14. SignInScreen onAuthenticated called with { token, needsDisplayName }', async () => {
    mockGetSessionToken.mockReturnValue(null)
    renderApp(['/sign-in'])
    await waitForAuthSettled()

    // Wait for rendering to complete
    const signInBtn = screen.getByTestId('mock-sign-in-btn')
    fireEvent.click(signInBtn)

    // After onAuthenticated, the app should store the token and fetch player
    await waitFor(() => {
      expect(mockStoreSessionToken).toHaveBeenCalledWith('mock-token')
    })
    expect(mockFetchPlayerMe).toHaveBeenCalledWith('mock-token')
  })

  // ── 15. App stores token and calls fetchPlayerMe after onAuthenticated ─
  it('15. App stores token and calls fetchPlayerMe after onAuthenticated, updates authState', async () => {
    mockGetSessionToken.mockReturnValue(null)
    mockFetchPlayerMe.mockResolvedValue({ status: 'ok', player: BASE_PLAYER })
    renderApp(['/sign-in'])
    await waitForAuthSettled()

    const signInBtn = screen.getByTestId('mock-sign-in-btn')
    fireEvent.click(signInBtn)

    // Should store token
    await waitFor(() => {
      expect(mockStoreSessionToken).toHaveBeenCalledWith('mock-token')
    })

    // Should fetch player me
    expect(mockFetchPlayerMe).toHaveBeenCalledWith('mock-token')

    // Should navigate to lobby after successful fetch
    await waitFor(() => {
      expect(screen.getByTestId('lobby-screen')).toBeInTheDocument()
    })
  })

  // ── 16. DisplayNamePickerScreen onConfirm → App refreshes authState, navigates to /lobby ─
  it('16. DisplayNamePickerScreen onConfirm → App refreshes authState, navigates to /lobby', async () => {
    mockGetSessionToken.mockReturnValue('valid-token')
    mockFetchPlayerMe
      .mockResolvedValueOnce({ status: 'ok', player: PLAYER_WITH_DEFAULT_NAME })
      .mockResolvedValueOnce({ status: 'ok', player: { ...BASE_PLAYER, displayName: 'NewName' } })
    renderApp(['/display-name'])
    await waitForAuthSettled()

    // Should see display-name picker (needs display name)
    expect(screen.getByTestId('display-name-picker-screen')).toBeInTheDocument()

    const confirmBtn = screen.getByTestId('mock-confirm-name-btn')
    fireEvent.click(confirmBtn)

    // Should refresh authState by calling fetchPlayerMe again
    await waitFor(() => {
      // fetchPlayerMe should have been called at least twice (initial + refresh)
      expect(mockFetchPlayerMe).toHaveBeenCalledTimes(2)
    })

    // Should navigate to lobby
    await waitFor(() => {
      expect(screen.getByTestId('lobby-screen')).toBeInTheDocument()
    })
  })

  // ── 17. Lobby profile button navigates to /profile ────────────────
  it('17. Lobby profile button navigates to /profile', async () => {
    mockGetSessionToken.mockReturnValue('valid-token')
    mockFetchPlayerMe.mockResolvedValue({ status: 'ok', player: BASE_PLAYER })
    renderApp(['/lobby'])
    await waitForAuthSettled()

    expect(screen.getByTestId('lobby-screen')).toBeInTheDocument()

    const profileBtn = screen.getByTestId('mock-profile-nav')
    fireEvent.click(profileBtn)

    // Should navigate to /profile
    await waitFor(() => {
      expect(screen.getByTestId('profile-screen')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('lobby-screen')).not.toBeInTheDocument()
  })

  // ── 18. Sign-out → clearSessionToken(), authState = unauthenticated, navigates to /sign-in ─
  it('18. Sign-out → clearSessionToken, authState unauthenticated, navigates to /sign-in', async () => {
    mockGetSessionToken.mockReturnValue('valid-token')
    mockFetchPlayerMe.mockResolvedValue({ status: 'ok', player: BASE_PLAYER })
    renderApp(['/lobby'])
    await waitForAuthSettled()

    expect(screen.getByTestId('lobby-screen')).toBeInTheDocument()

    const signOutBtn = screen.getByTestId('mock-sign-out')
    fireEvent.click(signOutBtn)

    // Should clear session token
    expect(mockClearSessionToken).toHaveBeenCalledOnce()

    // Should navigate to /sign-in
    await waitFor(() => {
      expect(screen.getByTestId('sign-in-screen')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('lobby-screen')).not.toBeInTheDocument()
  })

  // ── 19. Unknown route → redirect to /sign-in ──────────────────────
  it('19. Unknown route → redirect to /sign-in', async () => {
    mockGetSessionToken.mockReturnValue(null)
    renderApp(['/unknown-route'])
    await waitForAuthSettled()

    expect(screen.getByTestId('sign-in-screen')).toBeInTheDocument()
  })

  // ── 20. Authed user visiting /sign-in → redirected to /lobby ──────
  it('20. Authed user visiting /sign-in → redirected to /lobby', async () => {
    mockGetSessionToken.mockReturnValue('valid-token')
    mockFetchPlayerMe.mockResolvedValue({ status: 'ok', player: BASE_PLAYER })
    renderApp(['/sign-in'])
    await waitForAuthSettled()

    // Navigation via <Navigate> is async; wait for lobby to appear
    await waitFor(() => {
      expect(screen.getByTestId('lobby-screen')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('sign-in-screen')).not.toBeInTheDocument()
  })
})
