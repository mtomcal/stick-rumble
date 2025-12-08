import { useEffect, useState } from 'react';
import { calculateXP } from '../../game/utils/xpCalculator';
import type { MatchEndData } from '../../shared/types';
import './MatchEndScreen.css';

export interface MatchEndScreenProps {
  matchData: MatchEndData;
  localPlayerId: string;
  onClose: () => void;
}

export function MatchEndScreen({ matchData, localPlayerId, onClose }: MatchEndScreenProps) {
  const [countdown, setCountdown] = useState(10);

  // Sort players by kills descending, then by deaths ascending
  const rankedPlayers = [...matchData.finalScores].sort((a, b) => {
    if (b.kills !== a.kills) {
      return b.kills - a.kills;
    }
    return a.deaths - b.deaths;
  });

  // Find local player data
  const localPlayer = matchData.finalScores.find(p => p.playerId === localPlayerId);
  const localPlayerRank = rankedPlayers.findIndex(p => p.playerId === localPlayerId) + 1;
  const isWinner = matchData.winners.includes(localPlayerId);
  const isTopThree = localPlayerRank > 0 && localPlayerRank <= 3;

  // Calculate XP breakdown
  const localPlayerKills = localPlayer?.kills ?? 0;
  const xpData = calculateXP(localPlayerKills, isWinner, isTopThree);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) return;

    const timer = setInterval(() => {
      setCountdown(prev => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [countdown]);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handlePlayAgain = () => {
    alert('Lobby system coming in Epic 5');
  };

  const renderWinners = () => {
    if (matchData.winners.length === 0) {
      return <h2 className="match-end-title">No Winner</h2>;
    }

    if (matchData.winners.length === 1) {
      return (
        <h2 className="match-end-title">
          Winner: <span className="winner-name">{matchData.winners[0]}</span>
        </h2>
      );
    }

    return (
      <h2 className="match-end-title">
        Winners: <span className="winner-name">{matchData.winners.join(', ')}</span>
      </h2>
    );
  };

  return (
    <div className="match-end-backdrop" onClick={handleBackdropClick}>
      <div
        className="match-end-modal"
        role="dialog"
        aria-label="Match End Results"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="close-button"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>

        {renderWinners()}

        <div className="match-end-content">
          {/* Rankings Table */}
          <section className="rankings-section">
            <h3>Final Rankings</h3>
            <table className="rankings-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Player</th>
                  <th>Kills</th>
                  <th>Deaths</th>
                </tr>
              </thead>
              <tbody>
                {rankedPlayers.map((player, index) => (
                  <tr
                    key={player.playerId}
                    className={player.playerId === localPlayerId ? 'local-player' : ''}
                  >
                    <td>{index + 1}</td>
                    <td>{player.playerId}</td>
                    <td>{player.kills}</td>
                    <td>{player.deaths}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* XP Breakdown */}
          <section className="xp-section">
            <h3>XP Earned</h3>
            <div className="xp-breakdown">
              <div className="xp-row">
                <span>Base XP:</span>
                <span>{xpData.breakdown.base}</span>
              </div>
              <div className="xp-row">
                <span>Kills ({localPlayerKills} × 100):</span>
                <span>{xpData.breakdown.kills}</span>
              </div>
              <div className="xp-row">
                <span>Win Bonus:</span>
                <span>{xpData.breakdown.win}</span>
              </div>
              <div className="xp-row">
                <span>Top 3 Bonus:</span>
                <span>{xpData.breakdown.topThree}</span>
              </div>
              <div className="xp-row xp-total">
                <span>Total XP:</span>
                <span>{xpData.total}</span>
              </div>
            </div>
          </section>

          {/* Countdown Timer */}
          <div className="countdown-section">
            <p>Returning to lobby in {countdown}s</p>
          </div>

          {/* Play Again Button */}
          <button className="play-again-button" onClick={handlePlayAgain}>
            Play Again
          </button>
        </div>
      </div>
    </div>
  );
}
