import React, { useMemo } from 'react';
import { getRequiredPicks, needsBuyBackPicks } from '../utils/survivorRules';

const STATUS_COLORS = {
  alive: '#22c55e',
  eliminated: '#ef4444',
  winner: '#f59e0b'
};

const SurvivorAdminBoard = ({ entries, picks, currentDay, currentScheduleDay, nextDayLockedAt, onAddEntry, onBuyBack, onSelectEntry, isSiteAdmin }) => {
  // Group picks by entry for the current day
  const picksByEntry = useMemo(() => {
    const map = {};
    for (const pick of picks) {
      if (!map[pick.entryId]) map[pick.entryId] = [];
      map[pick.entryId].push(pick);
    }
    return map;
  }, [picks]);

  // Get today's pick for an entry
  const getTodayPick = (entryId) => {
    const entryPicks = picksByEntry[entryId] || [];
    if (!currentDay) return null;
    return entryPicks.find(p => p.gameDay === currentDay) || null;
  };

  // Get all picks for an entry sorted by day
  const getAllPicks = (entryId) => {
    return (picksByEntry[entryId] || []).sort((a, b) => a.gameDay.localeCompare(b.gameDay));
  };

  // Calculate stats
  const stats = useMemo(() => {
    const alive = entries.filter(e => e.status === 'alive').length;
    const eliminated = entries.filter(e => e.status === 'eliminated').length;
    const totalPool = entries.reduce((sum, e) => sum + (e.totalCost || 10), 0);
    const uniquePlayers = new Set(entries.map(e => e.email || e.playerName)).size;
    return { alive, eliminated, total: entries.length, totalPool, uniquePlayers };
  }, [entries]);

  const getPickStatusDisplay = (entry) => {
    const todayPick = getTodayPick(entry.id);
    if (entry.status === 'eliminated') return { text: 'Eliminated', icon: '🔴', className: 'eliminated' };
    if (!currentDay) return { text: 'No games today', icon: '—', className: 'none' };
    if (!todayPick) {
      const dayIndex = currentScheduleDay?.dayIndex;
      const entryPicks = picksByEntry[entry.id] || [];
      const hasPenalty = dayIndex != null && needsBuyBackPicks(entry, dayIndex, entryPicks);
      const required = dayIndex != null ? getRequiredPicks(entry, dayIndex, hasPenalty) : '?';
      return { text: `Needs ${required} pick${required !== 1 ? 's' : ''}`, icon: '⏳', className: 'pending' };
    }
    if (todayPick.passed === true) return { text: `${todayPick.teamNames.length}/${todayPick.requiredPicks} correct`, icon: '✅', className: 'passed' };
    if (todayPick.passed === false) return { text: 'Eliminated', icon: '❌', className: 'failed' };
    return { text: `${todayPick.teamNames.length}/${todayPick.requiredPicks} submitted`, icon: '📝', className: 'submitted' };
  };

  const getResultBadge = (result) => {
    if (result === 'win') return <span className="result-badge win">W</span>;
    if (result === 'loss') return <span className="result-badge loss">L</span>;
    return <span className="result-badge pending">?</span>;
  };

  return (
    <div className="survivor-admin-board">
      {/* Pool Stats */}
      <div className="pool-stats">
        <div className="stat-card">
          <span className="stat-value">{stats.alive}</span>
          <span className="stat-label">Alive</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{stats.eliminated}</span>
          <span className="stat-label">Eliminated</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{stats.total}</span>
          <span className="stat-label">Entries</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{stats.uniquePlayers}</span>
          <span className="stat-label">Players</span>
        </div>
        <div className="stat-card pool-amount">
          <span className="stat-value">${stats.totalPool}</span>
          <span className="stat-label">Pool</span>
        </div>
      </div>

      {/* Entries Table */}
      <div className="entries-table-container">
        <table className="entries-table">
          <thead>
            <tr>
              <th>Entry</th>
              <th>Status</th>
              <th>Cost</th>
              <th>Today's Picks</th>
              <th>Result</th>
              <th>Used Teams</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(entry => {
              const pickStatus = getPickStatusDisplay(entry);
              const todayPick = getTodayPick(entry.id);
              const label = entry.entryNumber > 1
                ? `${entry.playerName} #${entry.entryNumber}`
                : entry.playerName;

              return (
                <tr key={entry.id} className={`entry-row ${entry.status}`}>
                  <td className="entry-name">
                    <span className="player-name">{label}</span>
                  </td>
                  <td>
                    <span
                      className="status-badge"
                      style={{ backgroundColor: `${STATUS_COLORS[entry.status]}20`, color: STATUS_COLORS[entry.status], borderColor: STATUS_COLORS[entry.status] }}
                    >
                      {entry.status === 'eliminated' && entry.buyBackCount > 0
                        ? `Eliminated ${entry.buyBackCount + 1}x`
                        : entry.status === 'alive' && entry.buyBackCount > 0
                        ? `Alive (${entry.buyBackCount}x BB)`
                        : entry.status}
                    </span>
                  </td>
                  <td className="cost-cell">${entry.totalCost}</td>
                  <td className="pick-status">
                    {todayPick && todayPick.teamNames && (
                      <div className="pick-teams-inline">
                        {todayPick.teamNames.map(team => (
                          <span key={team} className="team-chip-small">
                            {team}
                            {todayPick.results && todayPick.results[team] && getResultBadge(todayPick.results[team])}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className={`result-cell ${pickStatus.className}`}>
                    <span className="result-icon">{pickStatus.icon}</span>
                    <span className="result-text">{pickStatus.text}</span>
                  </td>
                  <td className="used-teams-cell">
                    <div className="used-teams-list">
                      {(entry.usedTeams || []).map(team => {
                        // Check if this team was a loss in any pick
                        const allEntryPicks = getAllPicks(entry.id);
                        let wasLoss = false;
                        for (const p of allEntryPicks) {
                          if (p.results && p.results[team] === 'loss') {
                            wasLoss = true;
                            break;
                          }
                        }
                        return (
                          <span key={team} className={`team-chip ${wasLoss ? 'team-loss' : ''}`}>
                            {team}
                          </span>
                        );
                      })}
                    </div>
                  </td>
                  <td className="actions-cell">
                    {entry.status === 'alive' && !todayPick && currentDay && onSelectEntry && (
                      <button
                        className="action-btn pick-btn"
                        onClick={() => onSelectEntry(entry)}
                      >
                        Make Picks
                      </button>
                    )}
                    {isSiteAdmin && entry.status === 'eliminated' &&
                      entry.eliminatedOnDay === currentDay &&
                      (!nextDayLockedAt || new Date() < new Date(nextDayLockedAt)) && (
                      <button
                        className="action-btn buyback-btn"
                        onClick={() => onBuyBack?.(entry)}
                      >
                        Buy Back ($10)
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Add Entry */}
      {onAddEntry && (
        <div className="add-entry-section">
          <button className="add-entry-btn" onClick={onAddEntry}>
            + Add Entry
          </button>
        </div>
      )}
    </div>
  );
};

export default SurvivorAdminBoard;
