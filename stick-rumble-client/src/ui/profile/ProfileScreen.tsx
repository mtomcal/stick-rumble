import { useEffect, useState } from 'react';
import './ProfileStyles.css';
import { getSessionToken } from '../../game/network/sessionToken';
import { getApiBaseUrl } from '../../game/config/runtimeConfig';
import type { PlayerInfo } from '../../shared/types';

interface ProfileScreenProps {
  onBack: () => void;
  player?: PlayerInfo | null;
}

export function ProfileScreen({ onBack, player: propPlayer }: ProfileScreenProps) {
  const token = getSessionToken();
  const [localPlayer, setLocalPlayer] = useState<PlayerInfo | null>(propPlayer ?? null);
  const [loading, setLoading] = useState(!propPlayer && !!token);
  const [error, setError] = useState<string | null>(
    !token ? 'Not authenticated.' : null
  );

  useEffect(() => {
    // If propPlayer is provided, we already have the data — no need to fetch
    if (propPlayer) {
      return;
    }

    if (!token) {
      return;
    }

    fetch(`${getApiBaseUrl()}/player/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to fetch player data: ${res.status}`);
        }
        return res.json();
      })
      .then((data: PlayerInfo) => {
        setLocalPlayer(data);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
    // We intentionally depend on token only; propPlayer changes force re-mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (loading) {
    return <div className="profile-screen" data-testid="profile-loading">Loading...</div>;
  }

  if (error) {
    return (
      <div className="profile-screen" data-testid="profile-error">
        <p>Error: {error}</p>
        <button onClick={onBack}>Back to Lobby</button>
      </div>
    );
  }

  if (!localPlayer) {
    return (
      <div className="profile-screen" data-testid="profile-empty">
        <p>No player data available.</p>
        <button onClick={onBack}>Back to Lobby</button>
      </div>
    );
  }

  return (
    <div className="profile-screen" data-testid="profile-screen">
      <h1 className="profile-display-name">{localPlayer.displayName}</h1>
      <div className="profile-level">Level {localPlayer.level}</div>

      <div className="profile-stats">
        <div className="profile-stat">
          <span className="profile-stat-label">Kills</span>
          <span className="profile-stat-value">{localPlayer.lifetimeStats.kills}</span>
        </div>
        <div className="profile-stat">
          <span className="profile-stat-label">Deaths</span>
          <span className="profile-stat-value">{localPlayer.lifetimeStats.deaths}</span>
        </div>
        <div className="profile-stat">
          <span className="profile-stat-label">Wins</span>
          <span className="profile-stat-value">{localPlayer.lifetimeStats.wins}</span>
        </div>
        <div className="profile-stat">
          <span className="profile-stat-label">Games Played</span>
          <span className="profile-stat-value">{localPlayer.lifetimeStats.gamesPlayed}</span>
        </div>
        <div className="profile-stat">
          <span className="profile-stat-label">Total XP</span>
          <span className="profile-stat-value">{localPlayer.lifetimeStats.totalXp}</span>
        </div>
        <div className="profile-stat">
          <span className="profile-stat-label">Damage Dealt</span>
          <span className="profile-stat-value">{localPlayer.lifetimeStats.damageDealt}</span>
        </div>
      </div>

      <button className="profile-back-button" onClick={onBack}>
        Back to Lobby
      </button>
    </div>
  );
}
