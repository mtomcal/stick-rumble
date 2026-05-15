import { useEffect, useState } from 'react';
import './LobbyStyles.css';
import { fetchPlayerMe } from '../../game/network/playerApi';
import { getSessionToken } from '../../game/network/sessionToken';
import type { PlayerInfo } from '../../shared/types';

interface LobbyScreenProps {
  onPlayPublic: () => void;
  onSignOut: () => void;
}

export function LobbyScreen({ onPlayPublic, onSignOut }: LobbyScreenProps) {
  const token = getSessionToken();
  const [player, setPlayer] = useState<PlayerInfo | null>(null);
  const [loading, setLoading] = useState(!!token);
  const [error, setError] = useState('');

  const loadPlayerData = () => {
    if (!token) {
      return;
    }

    fetchPlayerMe(token).then((result) => {
      if (result) {
        setPlayer(result);
        setError('');
      } else {
        setError('Could not load player data.');
      }
      setLoading(false);
    });
  };

  const retry = () => {
    setError('');
    loadPlayerData();
  };

  useEffect(() => {
    loadPlayerData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (loading) {
    return <div className="lobby-screen" data-testid="lobby-loading">Loading...</div>;
  }

  if (!player || error) {
    return (
      <div className="lobby-screen" data-testid="lobby-error">
        <p>{error || 'Could not load player data.'}</p>
        <button onClick={retry}>Try Again</button>
        <button onClick={onSignOut}>Sign Out</button>
      </div>
    );
  }

  const xpPercent = player.xpForNextLevel > 0
    ? Math.min(100, Math.round((player.currentLevelXp / player.xpForNextLevel) * 100))
    : 0;

  return (
    <div className="lobby-screen" data-testid="lobby-screen">
      <div className="lobby-header">
        {player.avatarUrl && (
          <img
            src={player.avatarUrl}
            alt={`${player.displayName} avatar`}
            className="lobby-avatar"
          />
        )}
        <h1 className="lobby-display-name">{player.displayName}</h1>
        <div className="lobby-level-badge">Level {player.level}</div>
      </div>

      <div className="lobby-xp-section">
        <div className="lobby-xp-label">
          <span>XP</span>
          <span>{player.currentLevelXp} / {player.xpForNextLevel}</span>
        </div>
        <div className="lobby-xp-bar-bg">
          <div
            className="lobby-xp-bar-fill"
            style={{ width: `${xpPercent}%` }}
            data-testid="xp-progress-fill"
          />
        </div>
      </div>

      <div className="lobby-stats-cluster">
        <div className="lobby-stat">
          <span className="lobby-stat-label">Kills</span>
          <span className="lobby-stat-value">{player.lifetimeStats.kills}</span>
        </div>
        <div className="lobby-stat">
          <span className="lobby-stat-label">Deaths</span>
          <span className="lobby-stat-value">{player.lifetimeStats.deaths}</span>
        </div>
        <div className="lobby-stat">
          <span className="lobby-stat-label">K/D</span>
          <span className="lobby-stat-value">
            {player.lifetimeStats.deaths > 0
              ? (player.lifetimeStats.kills / player.lifetimeStats.deaths).toFixed(2)
              : player.lifetimeStats.kills.toFixed(2)}
          </span>
        </div>
        <div className="lobby-stat">
          <span className="lobby-stat-label">Total XP</span>
          <span className="lobby-stat-value">{player.lifetimeStats.totalXp}</span>
        </div>
      </div>

      <div className="lobby-actions">
        <button className="lobby-play-public" onClick={onPlayPublic}>
          Play Public
        </button>
        <button className="lobby-sign-out" onClick={onSignOut}>
          Sign Out
        </button>
      </div>
    </div>
  );
}
