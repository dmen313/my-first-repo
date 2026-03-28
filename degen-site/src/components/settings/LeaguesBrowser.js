import React, { useState } from 'react';
import { getTeams, getLeagueSettings, getPayoutRows } from '../../services/dynamoDBService';
import './LeaguesBrowser.css';

const LeaguesBrowser = ({ leagues, draftStatuses }) => {
  const [leagueData, setLeagueData] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [expandedLeague, setExpandedLeague] = useState(null);

  // Load data for a specific league when expanded
  const loadLeagueData = async (leagueConfig) => {
    const leagueId = leagueConfig.id;
    
    // Don't reload if we already have data
    if (leagueData[leagueId]) {
      return;
    }

    setIsLoading(true);
    try {
      const [teams, settings, payouts] = await Promise.all([
        getTeams(leagueConfig.league, leagueConfig.season),
        getLeagueSettings(leagueConfig.league, leagueConfig.season).catch(() => null),
        getPayoutRows(leagueConfig.league, leagueConfig.season).catch(() => [])
      ]);

      // Calculate owner distribution
      const ownerCounts = {};
      teams.forEach(team => {
        const owner = team.owner || 'Unassigned';
        ownerCounts[owner] = (ownerCounts[owner] || 0) + 1;
      });

      setLeagueData(prev => ({
        ...prev,
        [leagueId]: {
          teams,
          settings,
          payouts,
          ownerCounts,
          teamCount: teams.length
        }
      }));
    } catch (err) {
      console.error(`Error loading data for ${leagueId}:`, err);
      setLeagueData(prev => ({
        ...prev,
        [leagueId]: { error: err.message, teams: [], teamCount: 0 }
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const handleLeagueClick = async (league) => {
    if (expandedLeague === league.id) {
      setExpandedLeague(null);
    } else {
      setExpandedLeague(league.id);
      await loadLeagueData(league);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Draft Completed': return '#22c55e';
      case 'Draft In Progress': return '#f59e0b';
      case 'Payout Pending': return '#3b82f6';
      case 'Payout Completed': return '#6b7280';
      default: return '#9ca3af';
    }
  };

  return (
    <div className="leagues-browser">
      <div className="section-title">
        <h1>Leagues & Teams</h1>
        <p>Browse all leagues, view team assignments, and league settings</p>
      </div>

      <div className="leagues-list">
        {leagues.map(league => {
          const status = draftStatuses[league.id] || 'Draft In Progress';
          const isExpanded = expandedLeague === league.id;
          const data = leagueData[league.id];

          return (
            <div key={league.id} className={`league-card ${isExpanded ? 'expanded' : ''}`}>
              <button 
                className="league-header"
                onClick={() => handleLeagueClick(league)}
              >
                <div className="league-main">
                  <div 
                    className="league-color-bar" 
                    style={{ backgroundColor: league.color }}
                  />
                  <div className="league-info">
                    <div className="league-name-row">
                      <span className="league-abbr">{league.name}</span>
                      <span className="league-season">{league.season}</span>
                    </div>
                    <span className="league-full-name">{league.fullName}</span>
                  </div>
                </div>
                <div className="league-meta">
                  <span 
                    className="league-status-badge"
                    style={{ backgroundColor: `${getStatusColor(status)}20`, color: getStatusColor(status) }}
                  >
                    {status}
                  </span>
                  {data && (
                    <span className="team-count-badge">{data.teamCount} teams</span>
                  )}
                  <span className={`expand-icon ${isExpanded ? 'rotated' : ''}`}>▼</span>
                </div>
              </button>

              {isExpanded && (
                <div className="league-details">
                  {isLoading && !data ? (
                    <div className="loading-state">Loading league data...</div>
                  ) : data?.error ? (
                    <div className="error-state">Error: {data.error}</div>
                  ) : data ? (
                    <>
                      {/* League Stats */}
                      <div className="league-stats-row">
                        <div className="league-stat">
                          <span className="stat-value">{data.teamCount}</span>
                          <span className="stat-label">Teams</span>
                        </div>
                        <div className="league-stat">
                          <span className="stat-value">{Object.keys(data.ownerCounts).length}</span>
                          <span className="stat-label">Owners</span>
                        </div>
                        <div className="league-stat">
                          <span className="stat-value">{data.payouts?.length || 0}</span>
                          <span className="stat-label">Payout Levels</span>
                        </div>
                        {data.settings?.buyInPerUser && (
                          <div className="league-stat">
                            <span className="stat-value">${data.settings.buyInPerUser}</span>
                            <span className="stat-label">Buy-In</span>
                          </div>
                        )}
                      </div>

                      {/* Owner Distribution */}
                      <div className="league-section">
                        <h4>Owner Distribution</h4>
                        <div className="owner-distribution">
                          {Object.entries(data.ownerCounts)
                            .sort((a, b) => b[1] - a[1])
                            .map(([owner, count]) => (
                              <div key={owner} className="owner-item">
                                <span className="owner-name">{owner}</span>
                                <div className="owner-bar-wrapper">
                                  <div 
                                    className="owner-bar"
                                    style={{ 
                                      width: `${(count / data.teamCount) * 100}%`,
                                      backgroundColor: league.color 
                                    }}
                                  />
                                </div>
                                <span className="owner-count">{count}</span>
                              </div>
                            ))}
                        </div>
                      </div>

                      {/* Payout Structure */}
                      {data.payouts && data.payouts.length > 0 && (
                        <div className="league-section">
                          <h4>Payout Structure</h4>
                          <div className="payout-grid">
                            {data.payouts.map((payout, idx) => (
                              <div key={idx} className="payout-item">
                                <span className="payout-place">{payout.place || `${idx + 1}${getOrdinalSuffix(idx + 1)}`}</span>
                                <span className="payout-amount">${payout.amount}</span>
                                {payout.percentage && (
                                  <span className="payout-pct">{payout.percentage}%</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Teams Preview */}
                      <div className="league-section">
                        <h4>Teams ({data.teamCount})</h4>
                        <div className="teams-grid">
                          {data.teams.slice(0, 12).map(team => (
                            <div key={team.id || team.name} className="team-mini-card">
                              <span className="team-name">{team.name}</span>
                              {team.record && <span className="team-record">{team.record}</span>}
                              {team.owner && <span className="team-owner">{team.owner}</span>}
                            </div>
                          ))}
                          {data.teamCount > 12 && (
                            <div className="team-mini-card more">
                              +{data.teamCount - 12} more
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  ) : null}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Helper function for ordinal suffixes
const getOrdinalSuffix = (n) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
};

export default LeaguesBrowser;
