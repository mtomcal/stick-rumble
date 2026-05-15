import { useState, useEffect, useCallback, useRef } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { MatchShell } from './ui/match/MatchShell'
import { SignInScreen } from './ui/auth/SignInScreen'
import { DisplayNamePickerScreen } from './ui/auth/DisplayNamePickerScreen'
import { LobbyScreen } from './ui/lobby/LobbyScreen'
import { ProfileScreen } from './ui/profile/ProfileScreen'
import { ROUTES } from './ui/auth/routes'
import { getSessionToken, storeSessionToken, clearSessionToken } from './game/network/sessionToken'
import { fetchPlayerMe } from './game/network/playerApi'
import type { PlayerInfo } from './shared/types'
import './App.css'

type AuthState =
  | { status: 'loading' }
  | { status: 'loading_with_error'; error: string }
  | { status: 'unauthenticated' }
  | { status: 'authenticated'; token: string; player: PlayerInfo; needsDisplayName?: boolean }

function getInitialAuthState(storedToken: string | null): AuthState {
  if (!storedToken) {
    return { status: 'unauthenticated' }
  }
  return { status: 'loading' }
}

function getInitialMatchFlow(): boolean {
  try {
    const inviteCode = new URLSearchParams(window.location.search).get('invite')
    return !!inviteCode
  } catch {
    return false
  }
}

function App() {
  const [storedToken] = useState(() => getSessionToken())
  const [authState, setAuthState] = useState<AuthState>(() => getInitialAuthState(storedToken))
  const [inMatchFlow, setInMatchFlow] = useState(() => getInitialMatchFlow())
  const navigate = useNavigate()
  const loadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Page-load hydration: check stored token → fetchPlayerMe → set authState
  useEffect(() => {
    if (!storedToken) {
      return
    }

    loadingTimeoutRef.current = setTimeout(() => {
      setAuthState({ status: 'loading_with_error', error: 'Connection timed out' })
    }, 15_000)

    fetchPlayerMe(storedToken).then((result) => {
      clearTimeout(loadingTimeoutRef.current)
      loadingTimeoutRef.current = undefined
      if (result.status === 'ok') {
        setAuthState({
          status: 'authenticated',
          token: storedToken,
          player: result.player,
          needsDisplayName: !result.player.displayName || result.player.displayName === 'Player',
        })
      } else if (result.status === 'unauthorized') {
        clearSessionToken()
        setAuthState({ status: 'unauthenticated' })
      } else {
        // Server/network error — keep token, show loading with error
        console.error('fetchPlayerMe error:', result.error)
        setAuthState({ status: 'loading_with_error', error: result.error })
      }
    })
  }, [storedToken])

  const handleAuthenticated = useCallback(async (authResult: { token: string; needsDisplayName: boolean }) => {
    storeSessionToken(authResult.token)

    const result = await fetchPlayerMe(authResult.token)
    if (result.status === 'ok') {
      setAuthState({
        status: 'authenticated',
        token: authResult.token,
        player: result.player,
        needsDisplayName: authResult.needsDisplayName,
      })

      if (authResult.needsDisplayName) {
        navigate(ROUTES.DISPLAY_NAME)
      } else {
        navigate(ROUTES.LOBBY)
      }
    } else if (result.status === 'unauthorized') {
      clearSessionToken()
      setAuthState({ status: 'unauthenticated' })
    } else {
      // Error fetching player after sign-in — keep token but show loading with error
      setAuthState({ status: 'loading_with_error', error: result.error })
    }
  }, [navigate])

  const refreshAuthState = useCallback(async () => {
    const storedToken = getSessionToken()
    if (!storedToken) {
      setAuthState({ status: 'unauthenticated' })
      return
    }

    const result = await fetchPlayerMe(storedToken)
    if (result.status === 'ok') {
      setAuthState({
        status: 'authenticated',
        token: storedToken,
        player: result.player,
        needsDisplayName: !result.player.displayName || result.player.displayName === 'Player',
      })
      navigate(ROUTES.LOBBY)
    } else if (result.status === 'unauthorized') {
      clearSessionToken()
      setAuthState({ status: 'unauthenticated' })
    } else {
      setAuthState({ status: 'loading_with_error', error: result.error })
    }
  }, [navigate])

  const handleSignOut = useCallback(() => {
    clearSessionToken()
    setAuthState({ status: 'unauthenticated' })
    setInMatchFlow(false)
    navigate(ROUTES.SIGN_IN)
  }, [navigate])

  const handlePlayPublic = useCallback(() => {
    setInMatchFlow(true)
  }, [])

  const handlePlayAsGuest = useCallback(() => {
    navigate(ROUTES.PLAY)
  }, [navigate])

  const handleExitToLobby = useCallback(() => {
    setInMatchFlow(false)
  }, [])

  // Loading state
  if (authState.status === 'loading' || authState.status === 'loading_with_error') {
    return (
      <div className="app-shell" data-testid="app-loading">
        <div className="app-container">
          <div className="overlay-card">
            <h2>Loading...</h2>
            {authState.status === 'loading_with_error' && (
              <>
                <p className="overlay-error">{authState.error}</p>
                <button
                  onClick={() => {
                    setAuthState({ status: 'loading' })
                    const storedToken = getSessionToken()
                    if (storedToken) {
                      fetchPlayerMe(storedToken).then((result) => {
                        if (result.status === 'ok') {
                          setAuthState({
                            status: 'authenticated',
                            token: storedToken,
                            player: result.player,
                            needsDisplayName: !result.player.displayName || result.player.displayName === 'Player',
                          })
                        } else if (result.status === 'unauthorized') {
                          clearSessionToken()
                          setAuthState({ status: 'unauthenticated' })
                        } else {
                          setAuthState({ status: 'loading_with_error', error: result.error })
                        }
                      })
                    }
                  }}
                >
                  Retry
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Match flow mode — render MatchShell
  if (inMatchFlow) {
    return (
      <MatchShell
        sessionToken={authState.status === 'authenticated' ? authState.token : undefined}
        isAuthed={authState.status === 'authenticated'}
        onExitToLobby={handleExitToLobby}
      />
    )
  }

  // Auth mode — render route-based screens
  if (authState.status === 'unauthenticated') {
    return (
      <div className="app-shell" data-testid="app-auth-shell">
        <div className="app-container">
          <Routes>
            <Route
              path={ROUTES.SIGN_IN}
              element={
                <SignInScreen
                  onAuthenticated={handleAuthenticated}
                  onGuestClick={handlePlayAsGuest}
                />
              }
            />
            <Route
              path={ROUTES.PLAY}
              element={
                <PlayRouteTrigger onPlay={() => setInMatchFlow(true)} />
              }
            />
            <Route path="*" element={<Navigate to={ROUTES.SIGN_IN} replace />} />
          </Routes>
        </div>
      </div>
    )
  }

  // Authenticated — lobby, profile, display-name routes
  return (
    <div className="app-shell" data-testid="app-auth-shell">
      <div className="app-container">
        <Routes>
          <Route
            path={ROUTES.LOBBY}
            element={
              authState.needsDisplayName ? (
                <Navigate to={ROUTES.DISPLAY_NAME} replace />
              ) : (
                <LobbyScreen
                  onPlayPublic={handlePlayPublic}
                  onSignOut={handleSignOut}
                  onNavigateProfile={() => navigate(ROUTES.PROFILE)}
                />
              )
            }
          />
          <Route
            path={ROUTES.PROFILE}
            element={
              <ProfileScreen
                onBack={() => navigate(ROUTES.LOBBY)}
                player={authState.player}
              />
            }
          />
          <Route
            path={ROUTES.DISPLAY_NAME}
            element={
              authState.needsDisplayName ? (
                <DisplayNamePickerScreen
                  token={authState.token}
                  onConfirm={async () => {
                    await refreshAuthState()
                  }}
                />
              ) : (
                <Navigate to={ROUTES.LOBBY} replace />
              )
            }
          />
          <Route
            path={ROUTES.PLAY}
            element={
              <PlayRouteTrigger onPlay={() => setInMatchFlow(true)} />
            }
          />
          <Route path={ROUTES.SIGN_IN} element={<Navigate to={ROUTES.LOBBY} replace />} />
          <Route path="*" element={<Navigate to={ROUTES.LOBBY} replace />} />
        </Routes>
      </div>
    </div>
  )
}

function PlayRouteTrigger({ onPlay }: { onPlay: () => void }) {
  useEffect(() => {
    onPlay()
  }, [onPlay])
  return null
}

export default App
