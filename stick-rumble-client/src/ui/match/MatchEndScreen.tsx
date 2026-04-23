import { useEffect, useRef, useState } from 'react';
import { calculateXP } from '../../game/utils/xpCalculator';
import type { MatchEndData, PlayerScore, WinnerSummary } from '../../shared/types';
import './MatchEndScreen.css';

export interface MatchEndScreenProps {
  matchData: MatchEndData;
  localPlayerId: string;
  onClose: () => void;
  onPlayAgain: () => void;
}

const fallbackDisplayName = 'Guest';

function sanitizeDisplayName(displayName: string | undefined): string {
  const trimmed = displayName?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallbackDisplayName;
}

function resolveWinnerDisplayName(winner: WinnerSummary): string {
  return sanitizeDisplayName(winner.displayName);
}

function resolveScoreDisplayName(score: PlayerScore): string {
  return sanitizeDisplayName(score.displayName);
}

export function MatchEndScreen({ matchData, localPlayerId, onPlayAgain }: MatchEndScreenProps) {
  const [countdown, setCountdown] = useState(10);
  const hasCalledPlayAgainRef = useRef(false);

  const rankedPlayers = [...matchData.finalScores].sort((a, b) => {
    if (b.kills !== a.kills) {
      return b.kills - a.kills;
    }
    return resolveScoreDisplayName(a).localeCompare(resolveScoreDisplayName(b));
  });

  const rankedPlayersWithPlacement = rankedPlayers.reduce<Array<PlayerScore & { rank: number }>>(
    (acc, player, index) => {
      const previousPlayer = rankedPlayers[index - 1];
      const previousRank = acc[index - 1]?.rank ?? 1;
      const rank = previousPlayer && previousPlayer.kills === player.kills
        ? previousRank
        : index + 1;

      acc.push({ ...player, rank });
      return acc;
    },
    [],
  );

  const localPlayer = matchData.finalScores.find((player) => player.playerId === localPlayerId);
  const localPlayerRank = rankedPlayersWithPlacement.find((player) => player.playerId === localPlayerId)?.rank ?? 0;
  const isWinner = matchData.winners.some((winner) => winner.playerId === localPlayerId);
  const isTopThree = localPlayerRank > 0 && localPlayerRank <= 3;

  const localPlayerKills = localPlayer?.kills ?? 0;
  const xpData = calculateXP(localPlayerKills, isWinner, isTopThree);

  useEffect(() => {
    if (countdown <= 0) {
      return;
    }

    const timer = setInterval(() => {
      setCountdown((previous) => Math.max(0, previous - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [countdown]);

  useEffect(() => {
    if (countdown === 0 && !hasCalledPlayAgainRef.current) {
      hasCalledPlayAgainRef.current = true;
      onPlayAgain();
    }
  }, [countdown, onPlayAgain]);

  const handlePlayAgain = () => {
    if (hasCalledPlayAgainRef.current) {
      return;
    }

    hasCalledPlayAgainRef.current = true;
    setCountdown(0);
    onPlayAgain();
  };

  const renderWinners = () => {
    if (matchData.winners.length === 0) {
      return <h2 className="match-end-title">No Winner</h2>;
    }

    if (matchData.winners.length === 1) {
      return (
        <h2 className="match-end-title">
          Winner: <span className="winner-name">{resolveWinnerDisplayName(matchData.winners[0])}</span>
        </h2>
      );
    }

    return (
      <h2 className="match-end-title">
        Winners: <span className="winner-name">{matchData.winners.map(resolveWinnerDisplayName).join(', ')}</span>
      </h2>
    );
  };

  return (
    <div className="match-end-backdrop">
      <div
        className="match-end-modal"
        role="dialog"
        aria-label="Match End Results"
      >
        {renderWinners()}

        <div className="match-end-content">
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
                {rankedPlayersWithPlacement.map((player) => (
                  <tr
                    key={player.playerId}
                    className={player.playerId === localPlayerId ? 'local-player' : ''}
                  >
                    <td>{player.rank}</td>
                    <td>{resolveScoreDisplayName(player)}</td>
                    <td>{player.kills}</td>
                    <td>{player.deaths}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

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

          <div className="countdown-section">
            <p>Returning to lobby in {countdown}s</p>
          </div>

          <button className="play-again-button" onClick={handlePlayAgain}>
            Play Again
          </button>
        </div>
      </div>
    </div>
  );
}
