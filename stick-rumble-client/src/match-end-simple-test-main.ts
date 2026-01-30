/**
 * Match End Screen Simple Test Entry Point
 * Pure HTML/CSS approach without React to avoid Vite preamble issues
 */

import type { MatchEndData } from './shared/types';

// XP calculation (copied from xpCalculator.ts to avoid imports)
function calculateXP(kills: number, isWinner: boolean, isTopThree: boolean) {
  const BASE_XP = 50;
  const XP_PER_KILL = 100;
  const WIN_BONUS = 200;
  const TOP_THREE_BONUS = 100;

  const killXP = kills * XP_PER_KILL;
  const winXP = isWinner ? WIN_BONUS : 0;
  const topThreeXP = isTopThree ? TOP_THREE_BONUS : 0;

  return {
    total: BASE_XP + killXP + winXP + topThreeXP,
    breakdown: {
      base: BASE_XP,
      kills: killXP,
      win: winXP,
      topThree: topThreeXP,
    },
  };
}

// Define window interface
interface WindowWithTestControls extends Window {
  showMatchEndScreen: (data: MatchEndData, playerId: string) => void;
}

// Expose global function to show match end screen
(window as unknown as WindowWithTestControls).showMatchEndScreen = (
  matchData: MatchEndData,
  localPlayerId: string
) => {
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

  // Calculate XP
  const localPlayerKills = localPlayer?.kills ?? 0;
  const xpData = calculateXP(localPlayerKills, isWinner, isTopThree);

  // Update winner text
  const winnerText = document.getElementById('winner-text');
  if (winnerText) {
    if (matchData.winners.length === 0) {
      winnerText.innerHTML = 'No Winner';
    } else if (matchData.winners.length === 1) {
      winnerText.innerHTML = `Winner: <span class="winner-name">${matchData.winners[0]}</span>`;
    } else {
      winnerText.innerHTML = `Winners: <span class="winner-name">${matchData.winners.join(', ')}</span>`;
    }
  }

  // Update rankings table
  const rankingsTbody = document.getElementById('rankings-tbody');
  if (rankingsTbody) {
    rankingsTbody.innerHTML = '';
    rankedPlayers.forEach((player, index) => {
      const row = document.createElement('tr');
      if (player.playerId === localPlayerId) {
        row.className = 'local-player';
      }
      row.innerHTML = `
        <td>${index + 1}</td>
        <td>${player.playerId}</td>
        <td>${player.kills}</td>
        <td>${player.deaths}</td>
      `;
      rankingsTbody.appendChild(row);
    });
  }

  // Update XP breakdown
  const xpBase = document.getElementById('xp-base');
  const xpKillsLabel = document.getElementById('xp-kills-label');
  const xpKills = document.getElementById('xp-kills');
  const xpWin = document.getElementById('xp-win');
  const xpTopThree = document.getElementById('xp-top-three');
  const xpTotal = document.getElementById('xp-total');

  if (xpBase) xpBase.textContent = String(xpData.breakdown.base);
  if (xpKillsLabel) xpKillsLabel.textContent = `Kills (${localPlayerKills} × 100):`;
  if (xpKills) xpKills.textContent = String(xpData.breakdown.kills);
  if (xpWin) xpWin.textContent = String(xpData.breakdown.win);
  if (xpTopThree) xpTopThree.textContent = String(xpData.breakdown.topThree);
  if (xpTotal) xpTotal.textContent = String(xpData.total);

  // Show the match end screen
  const container = document.getElementById('match-end-container');
  if (container) {
    container.classList.add('visible');
  }

  console.log('Match End Screen displayed');
};

console.log('Match End Simple Test initialized');
