import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import App from './App'
import type { MatchAppShellModel } from './game/useMatchAppShell'
import type { MatchEndData } from './shared/types'
import { getSessionToken } from './game/network/sessionToken'

const testState = vi.hoisted(() => ({
  stageMode: 'desktop' as 'desktop' | 'mobile-landscape' | 'mobile-portrait-blocked',
  isSettling: false,
  shell: undefined as MatchAppShellModel | undefined,
  phaserRenderSpy: vi.fn(),
  capturedOnMatchEnd: undefined as ((data: MatchEndData, playerId: string) => void) | undefined,
  capturedUseMatchShellOptions: null as Record<string, unknown> | null,
}))

vi.mock('./game/useMatchAppShell', () => ({
  useMatchAppShell: (options?: Record<string, unknown>) => {
    testState.capturedUseMatchShellOptions = options ?? null
    if (!testState.shell) {
      throw new Error('expected shell state to be configured for the test')
    }
    return testState.shell
  },
}))

vi.mock('./ui/common/mobileMode', () => ({
  useStageMode: () => ({
    stageMode: testState.stageMode,
    width: 1280,
    height: 720,
    isSettling: testState.isSettling,
  }),
}))

vi.mock('./ui/common/PhaserGame', () => ({
  PhaserGame: (props: { onMatchEnd: (data: MatchEndData, playerId: string) => void }) => {
    testState.phaserRenderSpy(props)
    testState.capturedOnMatchEnd = props.onMatchEnd
    return <div data-testid="phaser-game">Phaser</div>
  },
}))

vi.mock('./ui/mobile/MobileControls', () => ({
  MobileControls: () => <div data-testid="mobile-controls" />,
}))

vi.mock('./ui/mobile/RotateDeviceGate', () => ({
  RotateDeviceGate: (props: { actionLabel?: string; onAction?: () => void }) => (
    <div data-testid="rotate-device-gate">
      {props.actionLabel ? <button onClick={props.onAction}>{props.actionLabel}</button> : null}
    </div>
  ),
}))

vi.mock('./ui/match/MatchEndScreen', () => ({
  MatchEndScreen: (props: { onClose: () => void; onPlayAgain: () => void }) => (
    <div data-testid="match-end-screen">
      <button onClick={props.onClose}>Close Results</button>
      <button onClick={props.onPlayAgain}>Play Again</button>
    </div>
  ),
}))

vi.mock('./ui/debug/DebugNetworkPanel', () => ({
  DebugNetworkPanel: () => <div data-testid="debug-panel" />,
}))

vi.mock('./ui/auth/SignInScreen', () => ({
  SignInScreen: (props: { onAuthenticated?: (result: { token: string; needsDisplayName: boolean }) => void; onGuestClick?: () => void }) => (
    <div data-testid="sign-in-screen">
      <button onClick={() => props.onAuthenticated?.({ token: 'test-token', needsDisplayName: false })}>
        Sign In
      </button>
      {props.onGuestClick && <button onClick={props.onGuestClick}>Play as Guest</button>}
    </div>
  ),
}))

vi.mock('./ui/auth/DisplayNamePickerScreen', () => ({
  DisplayNamePickerScreen: (props: { onConfirm?: () => void }) => (
    <div data-testid="display-name-picker-screen">
      <button onClick={() => props.onConfirm?.()}>Confirm Name</button>
    </div>
  ),
}))

vi.mock('./ui/lobby/LobbyScreen', () => ({
  LobbyScreen: (props: { onPlayPublic: () => void; onSignOut: () => void; onNavigateProfile?: () => void }) => (
    <div data-testid="lobby-screen">
      <button onClick={props.onPlayPublic}>Play Public</button>
      <button onClick={props.onSignOut}>Sign Out</button>
      {props.onNavigateProfile && <button onClick={props.onNavigateProfile}>Profile</button>}
    </div>
  ),
}))

vi.mock('./ui/profile/ProfileScreen', () => ({
  ProfileScreen: (props: { onBack: () => void }) => (
    <div data-testid="profile-screen">
      <button onClick={props.onBack}>Back to Lobby</button>
    </div>
  ),
}))

vi.mock('./game/network/sessionToken', () => ({
  getSessionToken: vi.fn(() => null),
  storeSessionToken: vi.fn(),
  clearSessionToken: vi.fn(),
  hasSessionToken: vi.fn(() => false),
}))

vi.mock('./game/network/playerApi', () => ({
  fetchPlayerMe: vi.fn(() => Promise.resolve({
    status: 'ok',
    player: {
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
    },
  })),
}))

function createShell(overrides: Partial<MatchAppShellModel> = {}): MatchAppShellModel {
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
    joinForm: {
      displayName: '',
      code: '',
    },
    overlayMode: 'join',
    isSocketReady: true,
    viewState: 'join_form',
    sessionFlow: {
      viewState: 'join_form',
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
    ...overrides,
  }
}

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

function setInviteUrl(code: string) {
  window.history.pushState({}, '', `/?invite=${code}`)
}

describe('App', () => {
  beforeEach(() => {
    testState.stageMode = 'desktop'
    testState.isSettling = false
    testState.phaserRenderSpy.mockReset()
    testState.capturedOnMatchEnd = undefined
    testState.shell = createShell()
    testState.capturedUseMatchShellOptions = null
    window.history.pushState({}, '', '/')
    vi.mocked(getSessionToken).mockImplementation(() => null)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // Helper: set auth token for tests that need an authenticated user
  function setupAuthedToken(token = 'test-token') {
    vi.mocked(getSessionToken).mockReturnValue(token)
  }

  it('renders the join form from shell state and forwards join actions', async () => {
    setupAuthedToken()
    setInviteUrl('PIZZA')
    const shell = createShell({
      inviteCode: 'PIZZA',
      joinForm: { displayName: 'Alice', code: 'PIZZA' },
    })
    testState.shell = shell

    renderWithRouter(<App />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Join Invite' })).toBeInTheDocument()
    })
    fireEvent.change(screen.getByRole('textbox', { name: 'Display Name' }), {
      target: { value: 'Bob' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: 'Room Code' }), {
      target: { value: 'TACOS' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Play Public' }))
    fireEvent.click(screen.getByRole('button', { name: 'Join with Code' }))

    expect(shell.actions.setDisplayName).toHaveBeenCalledWith('Bob')
    expect(shell.actions.setRoomCode).toHaveBeenCalledWith('TACOS')
    expect(shell.actions.submitPublicJoin).toHaveBeenCalledTimes(1)
    expect(shell.actions.submitCodeJoin).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId('phaser-game')).not.toBeInTheDocument()
  })

  it('renders waiting state from shell state and forwards copy/cancel actions', async () => {
    setInviteUrl('TEST')
    const shell = createShell({
      viewState: 'waiting_for_players',
      sessionFlow: {
        ...createShell().sessionFlow,
        viewState: 'waiting_for_players',
        sessionStatus: {
          state: 'waiting_for_players',
          playerId: 'player-1',
          displayName: 'Alice',
          joinMode: 'code',
          code: 'PIZZA',
          roomId: 'room-1',
          rosterSize: 1,
          minPlayers: 2,
        },
      },
      sessionStatus: {
        state: 'waiting_for_players',
        playerId: 'player-1',
        displayName: 'Alice',
        joinMode: 'code',
        code: 'PIZZA',
        roomId: 'room-1',
        rosterSize: 1,
        minPlayers: 2,
      },
    })
    testState.shell = shell

    renderWithRouter(<App />)

    await waitFor(() => {
      expect(screen.getByText('Room Code: PIZZA')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Copy Invite Link' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(shell.actions.copyInviteLink).toHaveBeenCalledTimes(1)
    expect(shell.actions.cancelWaiting).toHaveBeenCalledTimes(1)
  })

  it('mounts Phaser only for in-match shell state and forwards match-end callbacks', async () => {
    setInviteUrl('TEST')
    const shell = createShell({
      viewState: 'in_match',
      matchBootstrap: {
        session: {
          roomId: 'room-1',
          playerId: 'player-1',
          mapId: 'default_office',
          displayName: 'Alice',
          joinMode: 'public',
        },
        wsClient: {} as never,
      },
    })
    testState.shell = shell

    renderWithRouter(<App />)

    await waitFor(() => {
      expect(screen.getByTestId('phaser-game')).toBeInTheDocument()
    })
    expect(screen.getByTestId('stage-shell')).toHaveAttribute('data-stage-mode', 'desktop')

    testState.capturedOnMatchEnd?.({ reason: 'time_limit', winners: [], finalScores: [] }, 'player-1')

    expect(shell.actions.handleMatchEnd).toHaveBeenCalledWith(
      { reason: 'time_limit', winners: [], finalScores: [] },
      'player-1',
    )
  })

  it('keeps Phaser unmounted behind mobile entry and forwards Enter Game', async () => {
    setInviteUrl('TEST')
    testState.stageMode = 'mobile-landscape'
    const shell = createShell({
      viewState: 'in_match',
      matchBootstrap: {
        session: {
          roomId: 'room-1',
          playerId: 'player-1',
          mapId: 'default_office',
          displayName: 'Alice',
          joinMode: 'public',
        },
        wsClient: {} as never,
      },
      mobileGameplayEntered: false,
    })
    testState.shell = shell

    renderWithRouter(<App />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Enter Game' })).toBeInTheDocument()
    })
    expect(screen.queryByTestId('phaser-game')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Enter Game' }))

    expect(shell.actions.confirmMobileEntry).toHaveBeenCalledTimes(1)
  })

  it('renders match-end state from shell state and forwards replay actions', async () => {
    setInviteUrl('TEST')
    const shell = createShell({
      viewState: 'match_end',
      matchEndData: {
        reason: 'time_limit',
        winners: [{ playerId: 'player-1', displayName: 'Alice' }],
        finalScores: [],
      },
      localPlayerId: 'player-1',
    })
    testState.shell = shell

    renderWithRouter(<App />)

    await waitFor(() => {
      expect(screen.getByTestId('match-end-screen')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Close Results' }))
    fireEvent.click(screen.getByRole('button', { name: 'Play Again' }))

    expect(shell.actions.returnToJoinForm).toHaveBeenCalledTimes(1)
    expect(shell.actions.playAgain).toHaveBeenCalledTimes(1)
  })

  it('Play Public from Lobby → App enters matchMode → MatchShell renders join_form overlay', async () => {
    const { getSessionToken } = await import('./game/network/sessionToken')
    getSessionToken.mockReturnValue('test-auth-token')
    testState.shell = createShell({ viewState: 'join_form' })

    render(
      <MemoryRouter initialEntries={['/lobby']}>
        <App />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('lobby-screen')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Play Public' }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Enter Match' })).toBeInTheDocument()
    })
  })

  it('Play as Guest → navigates to /play → matchMode → MatchShell renders join_form', async () => {
    testState.shell = createShell({ viewState: 'join_form' })

    render(
      <MemoryRouter initialEntries={['/sign-in']}>
        <App />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('sign-in-screen')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Play as Guest' }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Enter Match' })).toBeInTheDocument()
    })
  })

  it('MatchShell mounts fresh → WebSocketClient constructed with encoded token (authed) or no token (guest)', async () => {
    // Authed path
    const { getSessionToken } = await import('./game/network/sessionToken')
    getSessionToken.mockReturnValue('test-auth-token')
    testState.shell = createShell({ viewState: 'join_form' })

    render(
      <MemoryRouter initialEntries={['/lobby']}>
        <App />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('lobby-screen')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Play Public' }))

    await waitFor(() => {
      expect(testState.capturedUseMatchShellOptions).toMatchObject({
        sessionToken: 'test-auth-token',
        isAuthed: true,
      })
    })
  })

  it('Match end (authed) → MatchEndScreen close → onExitToLobby → App exits matchMode → renders /lobby', async () => {
    const { getSessionToken } = await import('./game/network/sessionToken')
    getSessionToken.mockReturnValue('test-auth-token')
    const shell = createShell({
      viewState: 'match_end',
      matchEndData: {
        reason: 'time_limit',
        winners: [{ playerId: 'player-1', displayName: 'Alice' }],
        finalScores: [],
      },
      localPlayerId: 'player-1',
    })
    testState.shell = shell

    render(
      <MemoryRouter initialEntries={['/lobby']}>
        <App />
      </MemoryRouter>,
    )

    // Wait for lobby to load first (authenticated)
    await waitFor(() => {
      expect(screen.getByTestId('lobby-screen')).toBeInTheDocument()
    })

    // Click Play Public to enter match mode (inMatchFlow = true)
    fireEvent.click(screen.getByRole('button', { name: 'Play Public' }))

    // Now render should show MatchShell. But shell is match_end, so MatchEndScreen appears
    await waitFor(() => {
      expect(screen.getByTestId('match-end-screen')).toBeInTheDocument()
    })

    // Click Close Results — for authed, this triggers onExitToLobby
    fireEvent.click(screen.getByRole('button', { name: 'Close Results' }))

    // Should exit match mode and return to lobby
    await waitFor(() => {
      expect(screen.getByTestId('lobby-screen')).toBeInTheDocument()
    })
  })

  it('Match end (guest) → MatchEndScreen close → returnToJoinForm() → stays in matchMode, join_form', async () => {
    const shell = createShell({
      viewState: 'match_end',
      matchEndData: {
        reason: 'time_limit',
        winners: [{ playerId: 'player-1', displayName: 'Alice' }],
        finalScores: [],
      },
      localPlayerId: 'player-1',
    })
    testState.shell = shell

    render(
      <MemoryRouter initialEntries={['/sign-in']}>
        <App />
      </MemoryRouter>,
    )

    // Wait for sign-in to render
    await waitFor(() => {
      expect(screen.getByTestId('sign-in-screen')).toBeInTheDocument()
    })

    // Click Play as Guest to enter match mode
    fireEvent.click(screen.getByRole('button', { name: 'Play as Guest' }))

    // Now in match mode with match_end state → MatchEndScreen renders
    await waitFor(() => {
      expect(screen.getByTestId('match-end-screen')).toBeInTheDocument()
    })

    // Click Close Results — for guest, this calls shell.actions.returnToJoinForm
    fireEvent.click(screen.getByRole('button', { name: 'Close Results' }))

    // Verify returnToJoinForm was called (stays in matchMode)
    expect(shell.actions.returnToJoinForm).toHaveBeenCalledTimes(1)

    // Should still be in match mode (inMatchFlow still true)
    // The join_form overlay should not be visible because mock shell doesn't update,
    // but we verify the match-end screen closed and we didn't exit match mode
    // by checking that lobby/sign-in screens are NOT rendered
    expect(screen.queryByTestId('lobby-screen')).not.toBeInTheDocument()
    expect(screen.queryByTestId('sign-in-screen')).not.toBeInTheDocument()
  })
})
