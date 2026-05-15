import { useEffect, useRef, useState } from 'react';
import { getApiBaseUrl } from '../../game/config/runtimeConfig';
import './AuthStyles.css';

interface SignInScreenProps {
  onGuestClick: () => void;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
          }) => void;
          renderButton: (
            element: HTMLElement,
            options: { theme: string; size: string; shape: string }
          ) => void;
        };
      };
    };
    handleCredentialResponse?: (response: { credential: string }) => void;
  }
}

export function SignInScreen({ onGuestClick }: SignInScreenProps) {
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const [gisError, setGisError] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    // Load Google Identity Services script
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      setGisError(true);
    };
    script.onload = () => {
      if (window.google?.accounts?.id && googleButtonRef.current) {
        window.google.accounts.id.initialize({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
          callback: async (response) => {
            try {
              const apiResp = await fetch(`${getApiBaseUrl()}/auth/google`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idToken: response.credential }),
              });

              if (!apiResp.ok) {
                setAuthError('Authentication failed. Please try again.');
                return;
              }

              const data = await apiResp.json();
              const { storeSessionToken } = await import('../../game/network/sessionToken');
              storeSessionToken(data.token);

              // Navigate based on whether display name is set
              if (data.isNewPlayer || !data.displayName || data.displayName === 'Player') {
                window.location.hash = '#/display-name';
              } else {
                window.location.hash = '#/lobby';
              }
            } catch {
              setAuthError('Authentication error. Please try again.');
            }
          },
        });

        window.google.accounts.id.renderButton(googleButtonRef.current, {
          theme: 'outline',
          size: 'large',
          shape: 'pill',
        });
      }
    };
    document.body.appendChild(script);

    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, []);

  return (
    <div className="sign-in-screen">
      <h1>Sign In</h1>
      <p>Sign in with Google to track your stats and progress</p>
      <div ref={googleButtonRef} data-testid="google-signin-container" />
      {gisError && (
        <p className="error">Google Sign-In is temporarily unavailable. Please try again later or play as guest.</p>
      )}
      {authError && <p className="error">{authError}</p>}
      <button onClick={onGuestClick} className="guest-button">
        Play as Guest
      </button>
    </div>
  );
}
