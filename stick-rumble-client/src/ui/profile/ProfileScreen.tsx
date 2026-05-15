import { useEffect, useState } from 'react';
import { getSessionToken } from '../../game/network/sessionToken';
import { getApiBaseUrl } from '../../game/config/runtimeConfig';
import type { PlayerInfo } from '../../shared/types';

interface ProfileScreenProps {
  onBack: () => void;
}

export function ProfileScreen({ onBack }: ProfileScreenProps) {
  const token = getSessionToken();
  const [player, setPlayer] = useState<PlayerInfo | null>(null);
  const [loading, setLoading] = useState(!!token);
  const [error, setError] = useState<string | null>(
    !token ? 'Not authenticated.' : null
  );

  useEffect(() => {
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
        setPlayer(data);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
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

  if (!player) {
    return (
      <div className="profile-screen" data-testid="profile-empty">
        <p>No player data available.</p>
        <button onClick={onBack}>Back to Lobby</button>
      </div>
    );
  }

  return (
    <div className="profile-screen" data-testid="profile-screen">
      <h1 className="profile-display-name">{player.displayName}</h1>
      <div className="profile-level">Level {player.level}</div>

      <div className="profile-stats">
        <div className="profile-stat">
          <span className="profile-stat-label">Kills</span>
          <span className="profile-stat-value">{player.lifetimeStats.kills}</span>
        </div>
        <div className="profile-stat">
          <span className="profile-stat-label">Deaths</span>
          <span className="profile-stat-value">{player.lifetimeStats.deaths}</span>
        </div>
        <div className="profile-stat">
          <span className="profile-stat-label">Wins</span>
          <span className="profile-stat-value">{player.lifetimeStats.wins}</span>
        </div>
        <div className="profile-stat">
          <span className="profile-stat-label">Games Played</span>
          <span className="profile-stat-value">{player.lifetimeStats.gamesPlayed}</span>
        </div>
        <div className="profile-stat">
          <span className="profile-stat-label">Total XP</span>
          <span className="profile-stat-value">{player.lifetimeStats.totalXp}</span>
        </div>
        <div className="profile-stat">
          <span className="profile-stat-label">Damage Dealt</span>
          <span className="profile-stat-value">{player.lifetimeStats.damageDealt}</span>
        </div>
      </div>

      <button className="profile-back-button" onClick={onBack}>
        Back to Lobby
      </button>
    </div>
  );
}
