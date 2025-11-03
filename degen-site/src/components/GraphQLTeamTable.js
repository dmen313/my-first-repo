import React, { useState, useEffect } from 'react';
import { useLeagueData } from '../hooks/useGraphQL';
import './TeamTable.css';

const GraphQLTeamTable = ({ leagueId = 'mlb-2025' }) => {
  const {
    teams,
    payoutRows,
    achievements,
    loading,
    updateTeamAchievement,
    getTeamAchievement,
    refetchData
  } = useLeagueData(leagueId);

  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [buyInPerTeam, setBuyInPerTeam] = useState(500);
  const [numTeams, setNumTeams] = useState(4);

  // Calculate total pool
  const totalPool = buyInPerTeam * numTeams;

  // Handle achievement updates
  const handleAchievementChange = async (teamId, achievementType, achieved) => {
    try {
      await updateTeamAchievement(teamId, achievementType, achieved);
    } catch (error) {
      console.error('Failed to update achievement:', error);
      // Could show user notification here
    }
  };

  // Helper function to calculate player winnings
  const calculatePlayerWinnings = (playerName) => {
    return payoutRows.reduce((total, row) => {
      const achievementKey = row.level.toLowerCase().replace(/\s+/g, '');
      const payoutPerTeam = row.teams > 0 ? (totalPool * row.percentage / 100) / row.teams : 0;
      
      // Count achievements for this player
      const playerTeams = teams.filter(team => team.owner === playerName);
      const playerAchievements = playerTeams.reduce((count, team) => {
        return count + (getTeamAchievement(team.id, achievementKey) ? 1 : 0);
      }, 0);
      
      return total + (playerAchievements * payoutPerTeam);
    }, 0);
  };

  // Sort function
  const sortData = (data, config) => {
    if (!config.key) return data;
    
    return [...data].sort((a, b) => {
      let aVal = a[config.key];
      let bVal = b[config.key];
      
      if (config.key === 'record') {
        const [aWins] = aVal.split('-').map(Number);
        const [bWins] = bVal.split('-').map(Number);
        aVal = aWins;
        bVal = bWins;
      }
      
      if (aVal < bVal) return config.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return config.direction === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIndicator = (key) => {
    if (sortConfig.key !== key) return '';
    return sortConfig.direction === 'asc' ? ' ↑' : ' ↓';
  };

  const getOwnerRowClass = (owner) => {
    switch (owner) {
      case 'KH': return 'owner-kh';
      case 'DM': return 'owner-dm';
      case 'TG': return 'owner-tg';
      case 'MC': return 'owner-mc';
      case 'No Owner': return 'owner-none';
      default: return 'owner-other';
    }
  };

  const sortedTeams = sortData(teams, sortConfig);

  if (loading) {
    return (
      <div className="team-table-container">
        <div className="loading">Loading team data from GraphQL...</div>
      </div>
    );
  }

  return (
    <div className="team-table-container">
      {/* Data Info Section */}
      <div className="data-info-card compact">
        <h3>GraphQL Data Info</h3>
        <div className="data-info-simple">
          <strong>Source:</strong> GraphQL API | 
          <strong> Teams:</strong> {teams.length} | 
          <strong> Payout Levels:</strong> {payoutRows.length} | 
          <strong> Last Updated:</strong> {new Date().toLocaleString()}
        </div>
      </div>

      {/* Payout Plan Section */}
      <div className="payout-card compact">
        <h3>Payout Plan</h3>
        
        <div className="payout-summary">
          <div className="payout-inputs">
            <div className="input-group">
              <label>Teams:</label>
              <input
                type="number"
                value={numTeams}
                onChange={(e) => setNumTeams(parseInt(e.target.value) || 0)}
                className="payout-summary-input"
                min="1"
                max="10"
              />
            </div>
            <div className="input-group">
              <label>Buy-in per team:</label>
              <input
                type="number"
                value={buyInPerTeam}
                onChange={(e) => setBuyInPerTeam(parseInt(e.target.value) || 0)}
                className="payout-summary-input"
                min="0"
                step="50"
              />
            </div>
            <div className="input-group">
              <label>Total Pool:</label>
              <input
                type="number"
                value={totalPool}
                readOnly
                className="payout-summary-input"
              />
            </div>
          </div>
        </div>

        <div className="table-wrapper">
          <table className="payout-table">
            <thead>
              <tr>
                <th>Level</th>
                <th>Teams</th>
                <th>%</th>
                <th>Payout</th>
                <th className="owner-col">TG</th>
                <th className="owner-col">KH</th>
                <th className="owner-col">DM</th>
                <th className="owner-col">MC</th>
              </tr>
            </thead>
            <tbody>
              {payoutRows.map((row, index) => {
                const payout = (totalPool * row.percentage) / 100;
                const payoutPerTeam = row.teams > 0 ? payout / row.teams : 0;
                
                return (
                  <tr key={index}>
                    <td>{row.level}</td>
                    <td>{row.teams}</td>
                    <td>{row.percentage.toFixed(1)} %</td>
                    <td>${payoutPerTeam.toFixed(0)}</td>
                    <td className="owner-col">${(calculatePlayerWinnings('TG') * row.percentage / 100).toFixed(0)}</td>
                    <td className="owner-col">${(calculatePlayerWinnings('KH') * row.percentage / 100).toFixed(0)}</td>
                    <td className="owner-col">${(calculatePlayerWinnings('DM') * row.percentage / 100).toFixed(0)}</td>
                    <td className="owner-col">${(calculatePlayerWinnings('MC') * row.percentage / 100).toFixed(0)}</td>
                  </tr>
                );
              })}
              <tr className="total-row">
                <td><strong>Total</strong></td>
                <td></td>
                <td><strong>{payoutRows.reduce((sum, row) => sum + row.percentage, 0).toFixed(1)} %</strong></td>
                <td><strong>${totalPool.toFixed(0)}</strong></td>
                <td className="owner-col"><strong>${calculatePlayerWinnings('TG').toFixed(0)}</strong></td>
                <td className="owner-col"><strong>${calculatePlayerWinnings('KH').toFixed(0)}</strong></td>
                <td className="owner-col"><strong>${calculatePlayerWinnings('DM').toFixed(0)}</strong></td>
                <td className="owner-col"><strong>${calculatePlayerWinnings('MC').toFixed(0)}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Teams Section */}
      <div className="teams-card compact">
        <h3>Teams ({teams.length})</h3>
        <button onClick={refetchData} className="refresh-button">
          Refresh Data
        </button>
        
        <div className="table-wrapper">
          <table className="teams-table">
            <thead>
              <tr>
                <th className="owner-header sortable-header" onClick={() => handleSort('owner')}>
                  Owner{getSortIndicator('owner')}
                </th>
                <th className="team-header sortable-header" onClick={() => handleSort('name')}>
                  Team{getSortIndicator('name')}
                </th>
                <th className="record-header sortable-header" onClick={() => handleSort('record')}>
                  Record{getSortIndicator('record')}
                </th>
                <th className="division-header sortable-header" onClick={() => handleSort('division')}>
                  Division{getSortIndicator('division')}
                </th>
                {payoutRows.map((row, index) => (
                  <th key={index} className="achievement-header">
                    {row.level}
                    <span className="achievement-count">
                      (0/{row.teams})
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedTeams.map((team) => (
                <tr key={team.id} className={getOwnerRowClass(team.owner)}>
                  <td className="owner-cell">{team.owner}</td>
                  <td className="team-name-cell">{team.name}</td>
                  <td className="record-cell">{team.record}</td>
                  <td className="division-cell">{team.division}</td>
                  {payoutRows.map((row, index) => {
                    const achievementKey = row.level.toLowerCase().replace(/\s+/g, '');
                    return (
                      <td key={index} className="achievement-cell">
                        <input
                          type="checkbox"
                          className="achievement-checkbox"
                          checked={getTeamAchievement(team.id, achievementKey)}
                          onChange={(e) => handleAchievementChange(team.id, achievementKey, e.target.checked)}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default GraphQLTeamTable;

