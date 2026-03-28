import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getLeagueConfig } from '../services/sportsApi';
import { useLeagueData } from '../hooks/useGraphQL';
import { useLeagueSettings } from '../hooks/useLeagueSettings';
import DraftSection from './DraftSection';
import './TeamTableNew.css';

const TeamTable = ({ leagueId = 'mlb-2025' }) => {
  const [error, setError] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  
  // Payout plan state
  const [payoutRows, setPayoutRows] = useState([]);
  
  // League settings hook
  const { 
    settings: leagueSettings, 
    updateBuyInPerTeam, 
    updateNumTeams 
  } = useLeagueSettings(leagueId);
  
  // Get league configuration
  const leagueConfig = getLeagueConfig(leagueId);

  // GraphQL hooks - get all data from useLeagueData to avoid duplicate fetches
  const {
    teams: gqlTeams,
    payoutRows: gqlPayoutRows,
    loading: gqlLoading,
    updateTeamAchievement,
    getTeamAchievement,
    updatePayoutRowData,
    teamsLoading
  } = useLeagueData(leagueId);

  // Note: Error handling is done within useLeagueData

  // Team management hook
  // const { updateTeam } = useTeamManagement(); // This line is removed

  // Available players for owner selection
  const availablePlayers = useMemo(() => ['DM', 'MC', 'KH', 'TG'], []);

  // Use GraphQL data directly instead of copying to local state
  // Use GraphQL data directly
  const currentTeams = gqlTeams;
  const currentPayoutRows = gqlPayoutRows;
  const currentLoading = gqlLoading || teamsLoading;
  console.log(`📊 TeamTable rendering ${currentTeams.length} teams for ${leagueId}`);
  
  // For backward compatibility, also update the local state
  useEffect(() => {
    if (gqlPayoutRows.length > 0) {
      setPayoutRows(gqlPayoutRows);
    }
  }, [gqlPayoutRows]);
  

  // Separate useEffect for API data fetching (only once per league change)
  // TEMPORARILY DISABLED to prevent infinite loops
  // useEffect(() => {
  //   if (gqlTeams.length > 0 && !apiDataFetched && !isRefreshing) {
  //     console.log('🚀 First time loading - fetching fresh API data...');
  //     
  //     const fetchApiData = async () => {
  //       try {
  //         setIsRefreshing(true);
  //         console.log('🚀 Fetching fresh API data on page load...');
  //         const result = await fetchAndSaveApiData(leagueId, gqlTeams);
  //         
  //         if (result.success) {
  //           console.log(`✅ API data refreshed: ${result.successCount}/${result.totalCount} teams updated`);
  //           setMetadata(result.metadata);
  //           setAsOf(new Date().toISOString());
  //           
  //           // Note: GraphQL data will update automatically through the normal flow
  //           // No need to refetchData() which would cause infinite loops
  //         } else {
  //           console.warn('⚠️ API data fetch failed:', result.error);
  //           setError('Failed to refresh API data - using cached data');
  //         }
  //       } catch (err) {
  //         console.error('❌ Error fetching API data:', err);
  //         setError('Failed to refresh API data - using cached data');
  //       } finally {
  //         setIsRefreshing(false);
  //       }
  //     };
  //     
  //     fetchApiData();
  //     setApiDataFetched(true);
  //   }
  // }, [gqlTeams.length, apiDataFetched, leagueId, isRefreshing]); // Include isRefreshing to prevent loops


  const updatePayoutField = async (index, field, value) => {
    console.log('💰 Payout field update:', { index, field, value, currentRow: payoutRows[index] });
    
    // Always use GraphQL to update payout rows
    const currentRow = payoutRows[index];
    const updatedData = { ...currentRow };
    
    if (field === 'teams') {
      const numValue = parseInt(value);
      updatedData.teams = isNaN(numValue) ? 0 : numValue;
    } else if (field === 'pct') {
      const numValue = parseFloat(value);
      updatedData.percentage = isNaN(numValue) ? 0 : numValue;
    }

    try {
      await updatePayoutRowData(currentRow.id, {
        level: updatedData.level,
        teams: updatedData.teams,
        percentage: updatedData.percentage || updatedData.pct
      });
    } catch (error) {
      console.error('Failed to update payout row via GraphQL:', error);
      // Fallback to local state update on error
      const newRows = payoutRows.map((row, i) => {
        if (i === index) {
          const updatedRow = { ...row };
          if (field === 'teams') {
            updatedRow.teams = parseInt(value) || 0;
          } else if (field === 'pct') {
            updatedRow.pct = parseFloat(value) || 0;
            updatedRow.percentage = parseFloat(value) || 0; // Keep both for compatibility
          }
          return updatedRow;
        }
        return { ...row }; // Deep copy all rows to avoid read-only issues
      });
      setPayoutRows(newRows);
    }
  };

  const updatePlayoffAchievement = async (teamId, achievement, value) => {
    console.log('🏆 Achievement checkbox clicked in TeamTable:', { teamId, achievement, value });
    console.log('🏆 updateTeamAchievement function exists?', typeof updateTeamAchievement);
    
    if (!updateTeamAchievement) {
      console.error('❌ updateTeamAchievement is not defined!');
      setError(`updateTeamAchievement function is not available`);
      return;
    }
    
    try {
      console.log('📡 Calling updateTeamAchievement with:', { teamId, achievement, value });
      await updateTeamAchievement(teamId, achievement, value);
      console.log('✅ Achievement update successful from TeamTable');
    } catch (error) {
      console.error('❌ Failed to update achievement:', error);
      setError(`Failed to update ${achievement} for team. Please try again.`);
    }
  };

  const getPlayoffAchievement = (teamId, achievement) => {
    // Always use GraphQL achievements
    return getTeamAchievement(teamId, achievement);
  };

  // Helper function to get percentage value (handles both GraphQL 'percentage' and local 'pct')
  const getRowPercentage = (row) => {
    return row.percentage !== undefined ? row.percentage : row.pct;
  };

  // Memoize achievement counts to prevent recalculation on every render
  const achievementCounts = useMemo(() => {
    const counts = {};
    payoutRows.forEach(row => {
      const achievementKey = row.level.toLowerCase().replace(/\s+/g, '');
      counts[achievementKey] = currentTeams.filter(team => getTeamAchievement(team.id, achievementKey)).length;
    });
    return counts;
  }, [currentTeams, payoutRows, getTeamAchievement]);

  const getAchievementCount = (achievement) => {
    return achievementCounts[achievement] || 0;
  };

  // Get target count from payout plan for each achievement
  const getAchievementTarget = (achievementLevel) => {
    const row = currentPayoutRows.find(row => row.level === achievementLevel);
    return row ? row.teams : 0;
  };

  // Calculate achievements per player based on their teams (memoized for performance)
  const playerAchievements = useMemo(() => {
    // console.log('🔄 Recalculating player achievements...', { teamsCount: teams.length, payoutRowsCount: payoutRows.length });
    
    // Create dynamic achievement structure based on payout rows
    const achievementKeys = currentPayoutRows.map(row => row.level.toLowerCase().replace(/\s+/g, ''));
    const emptyAchievements = {};
    achievementKeys.forEach(key => {
      emptyAchievements[key] = 0;
    });

    const playerAchievements = {
      'TG': { ...emptyAchievements },
      'KH': { ...emptyAchievements },
      'DM': { ...emptyAchievements },
      'MC': { ...emptyAchievements }
    };

    currentTeams.forEach(team => {
      if (team.owner && playerAchievements[team.owner]) {
        // Always use GraphQL achievements data
        Object.keys(playerAchievements[team.owner]).forEach(achievement => {
          if (getTeamAchievement(team.id, achievement)) {
            playerAchievements[team.owner][achievement]++;
            // console.log(`✅ Achievement: ${team.owner} - ${team.name} - ${achievement}`);
          }
        });
      }
    });

    // console.log('📊 Final player achievements:', playerAchievements);
    return playerAchievements;
  }, [currentTeams, currentPayoutRows, getTeamAchievement]);

  const totalPool = leagueSettings.totalPool;

  // Helper function to calculate player winnings
  const calculatePlayerWinnings = useCallback((playerName) => {
    return currentPayoutRows.reduce((total, row) => {
      const achievementKey = row.level.toLowerCase().replace(/\s+/g, '');
      const payoutPerTeam = row.teams > 0 ? (totalPool * getRowPercentage(row) / 100) / row.teams : 0;
      return total + (achievementKey ? playerAchievements[playerName][achievementKey] * payoutPerTeam : 0);
    }, 0);
  }, [currentPayoutRows, playerAchievements, totalPool]);

  // Calculate net total for each player and sort them by payout column (Total row)
  const sortedPlayers = useMemo(() => {
    const playersWithPayoutTotals = availablePlayers.map(player => ({
      name: player,
      payoutTotal: calculatePlayerWinnings(player) // Sort by payout column (Total row value)
    }));
    
    // Sort by payout total from the "Total" row (lowest to highest)
    return playersWithPayoutTotals.sort((a, b) => a.payoutTotal - b.payoutTotal).map(p => p.name);
  }, [availablePlayers, calculatePlayerWinnings]);

  const sortData = (data, config) => {
    if (!config.key) return data;
    
    return [...data].sort((a, b) => {
      let aVal = a[config.key];
      let bVal = b[config.key];
      
      // Special handling for record sorting
      if (config.key === 'record') {
        const [aWins, aLosses] = aVal.split('-').map(Number);
        const [bWins, bLosses] = bVal.split('-').map(Number);
        const aWinPct = aWins / (aWins + aLosses);
        const bWinPct = bWins / (bWins + bLosses);
        aVal = aWinPct;
        bVal = bWinPct;
      }
      
      // Special handling for American odds sorting
      if (config.key === 'odds') {
        // Convert American odds to implied probability for proper sorting
        // Negative odds: probability = |odds| / (|odds| + 100)
        // Positive odds: probability = 100 / (odds + 100)
        const convertOddsToProb = (odds) => {
          if (!odds || odds === null) return 0; // Handle null/undefined odds
          const numOdds = parseInt(odds.replace('+', ''));
          if (numOdds < 0) {
            return Math.abs(numOdds) / (Math.abs(numOdds) + 100);
          } else {
            return 100 / (numOdds + 100);
          }
        };
        
        aVal = convertOddsToProb(aVal);
        bVal = convertOddsToProb(bVal);
      }
      
      // Special handling for games back sorting
      if (config.key === 'gamesBack' || config.key === 'wildCardGamesBack') {
        // Convert to numbers, treating '-' as 0
        aVal = aVal === '-' ? 0 : parseFloat(aVal);
        bVal = bVal === '-' ? 0 : parseFloat(bVal);
        
        // For wildCardGamesBack, handle '+' values specially
        if (config.key === 'wildCardGamesBack') {
          const aStr = a[config.key].toString();
          const bStr = b[config.key].toString();
          
          const aHasPlus = aStr.includes('+');
          const bHasPlus = bStr.includes('+');
          
          // If one has + and other doesn't, + should come first (lower value)
          if (aHasPlus && !bHasPlus) return config.direction === 'asc' ? -1 : 1;
          if (!aHasPlus && bHasPlus) return config.direction === 'asc' ? 1 : -1;
          
          // If both have + or neither have +, compare normally
          aVal = parseFloat(aStr.replace('+', ''));
          bVal = parseFloat(bStr.replace('+', ''));
        }
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

  const getRecordColor = (record) => {
    const [wins, losses] = record.split('-').map(Number);
    if (wins > losses) return 'value-pos';
    if (wins < losses) return 'value-neg';
    return 'value-even';
  };

  const getGamesBackColor = (gb) => {
    if (gb === undefined || gb === null || gb === '-' || gb === '0' || gb === 0) return 'value-even';
    if (gb.toString().includes('+')) return 'value-pos';
    return 'value-neg';
  };

  const getOwnerRowClass = (owner) => {
    if (!owner || owner === '') return 'owner-other';
    
    switch (owner) {
      case 'KH': return 'owner-kh';
      case 'DM': return 'owner-dm';
      case 'TG': return 'owner-tg';
      case 'MC': return 'owner-mc';
      case 'No Owner': return 'owner-none';
      default: return 'owner-other';
    }
  };

  const sortedTeams = sortData(currentTeams, sortConfig);

  if (currentLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading team data...</p>
      </div>
    );
  }

  return (
    <div className="team-table-container">
      {error && (
        <div className="error-banner">
          <span>{error}</span>
        </div>
      )}
      
      {/* Draft Section */}
      {(() => {
        const draftLeague = leagueId.split('-')[0];
        const draftSeason = leagueId.split('-')[1];
        console.log('🎯 TeamTable rendering DraftSection with:', { draftLeague, draftSeason, leagueId });
        return <DraftSection league={draftLeague} season={draftSeason} />;
      })()}

      {/* Payout Plan */}
      <div className="payout-card compact">
        <h3>Payout Plan</h3>
        <div className="payout-summary">
          <div className="payout-summary-row">
            <span>Per team:</span>
            <input
              type="number"
              value={leagueSettings.numTeams}
              onChange={(e) => updateNumTeams(parseInt(e.target.value) || 0)}
              className="payout-summary-input"
              min="1"
              max="50"
            />
            <span>Teams ×</span>
            <span className="currency-symbol">$</span>
            <input
              type="number"
              value={leagueSettings.buyInPerTeam}
              onChange={(e) => updateBuyInPerTeam(parseFloat(e.target.value) || 0)}
              className="payout-summary-input"
              min="0"
              step="50"
            />
            <span>= Pool</span>
            <span className="currency-symbol">$</span>
            <input
              type="number"
              value={totalPool.toFixed(0)}
              className="payout-summary-input"
              readOnly
            />
          </div>
        </div>
      </div>
      
      {/* Payout Table */}
      <div className="payout-card compact">
        <h3>Payout Table</h3>
        <div className="payout-table-wrapper">
          <table className="payout-table">
            <thead>
              <tr>
                <th>Level</th>
                <th>Teams</th>
                <th>%</th>
                <th>Payout per Team</th>
                <th>Total Payout</th>
                {sortedPlayers.map(player => (
                  <th key={player} className="owner-col" data-player={player}>{player}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {payoutRows
                .map((row, originalIndex) => {
                  const payout = (totalPool * getRowPercentage(row)) / 100;
                  const payoutPerTeam = row.teams > 0 ? payout / row.teams : 0;
                  return { row, originalIndex, payoutPerTeam };
                })
                .sort((a, b) => a.payoutPerTeam - b.payoutPerTeam) // Sort by Payout column (lowest to highest)
                .map(({ row, originalIndex, payoutPerTeam }, displayIndex) => {
                  const achievementKey = row.level.toLowerCase().replace(/\s+/g, '');
                  
                  return (
                  <tr key={row.id || originalIndex}>
                    <td>{row.level}</td>
                    <td>
                      <input
                        type="number"
                        value={row.teams}
                        onChange={(e) => {
                          // Update local state immediately for responsive UI
                          const newRows = payoutRows.map((r, i) => {
                            if (i === originalIndex) {
                              const updatedRow = { ...r };
                              const numValue = parseInt(e.target.value);
                              updatedRow.teams = isNaN(numValue) ? 0 : numValue;
                              return updatedRow;
                            }
                            return r;
                          });
                          setPayoutRows(newRows);
                        }}
                        onBlur={(e) => {
                          // Send to GraphQL when user finishes editing
                          updatePayoutField(originalIndex, 'teams', e.target.value);
                        }}
                        className="payout-input payout-input-teams"
                        min="0"
                        max="99"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        value={getRowPercentage(row)}
                        onChange={(e) => {
                          // Update local state immediately for responsive UI
                          const newRows = payoutRows.map((r, i) => {
                            if (i === originalIndex) {
                              const updatedRow = { ...r };
                              const numValue = parseFloat(e.target.value);
                              updatedRow.pct = isNaN(numValue) ? 0 : numValue;
                              updatedRow.percentage = isNaN(numValue) ? 0 : numValue;
                              return updatedRow;
                            }
                            return r;
                          });
                          setPayoutRows(newRows);
                        }}
                        onBlur={(e) => {
                          // Send to GraphQL when user finishes editing
                          updatePayoutField(originalIndex, 'pct', e.target.value);
                        }}
                        className="payout-input payout-input-pct"
                        min="0"
                        max="100"
                        step="0.1"
                      /><span className="pct-symbol">%</span>
                    </td>
                    <td>${payoutPerTeam.toFixed(0)}</td>
                    <td><strong>${(row.teams * payoutPerTeam).toFixed(0)}</strong></td>
                    {sortedPlayers.map(player => (
                      <td key={player} className="owner-col">
                        {achievementKey && playerAchievements[player][achievementKey] > 0 ? (
                          <span className="achievement-earned">
                            {playerAchievements[player][achievementKey]} × ${payoutPerTeam.toFixed(0)} = ${(playerAchievements[player][achievementKey] * payoutPerTeam).toFixed(0)}
                          </span>
                        ) : (
                          <span className="achievement-none">-</span>
                        )}
                      </td>
                    ))}
                  </tr>
                  );
                })}
              <tr className="total-row">
                <td><strong>Total</strong></td>
                <td></td>
                <td><strong>{payoutRows.reduce((sum, row) => sum + getRowPercentage(row), 0).toFixed(1)} %</strong></td>
                <td></td>
                <td><strong>${totalPool.toFixed(0)}</strong></td>
                {sortedPlayers.map(player => (
                  <td key={player} className="owner-col">
                    <strong>
                      ${calculatePlayerWinnings(player).toFixed(0)}
                    </strong>
                  </td>
                ))}
              </tr>
              <tr className="buyin-row">
                <td><strong>Buy-in Cost</strong></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                {sortedPlayers.map(player => (
                  <td key={player} className="owner-col">
                    <strong>
                      -${leagueSettings.buyInPerTeam.toFixed(0)}
                    </strong>
                  </td>
                ))}
              </tr>
              <tr className="net-total-row">
                <td><strong>Net Total</strong></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                {sortedPlayers.map(player => {
                  const netTotal = calculatePlayerWinnings(player) - leagueSettings.buyInPerTeam;
                  return (
                    <td key={player} className="owner-col">
                      <strong className={netTotal < 0 ? 'net-negative' : ''}>
                        ${netTotal.toFixed(0)}
                      </strong>
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Teams Section */}
      <div className="teams-card compact">
        <div className="teams-header">
          <h3>Teams</h3>
        </div>
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
              {leagueConfig?.showColumns?.gamesBack && (
                <th className="gb-header sortable-header" onClick={() => handleSort('gamesBack')}>
                  GB{getSortIndicator('gamesBack')}
                </th>
              )}
              {leagueConfig?.showColumns?.wildCardGamesBack && (
                <th className="wcgb-header sortable-header" onClick={() => handleSort('wildCardGamesBack')}>
                  WCGB{getSortIndicator('wildCardGamesBack')}
                </th>
              )}
              {leagueConfig?.showColumns?.odds && (
                <th className="odds-header sortable-header" onClick={() => handleSort('odds')}>
                  {leagueId === 'mlb-2025' ? 'WS Odds' : 'Championship Odds'}{getSortIndicator('odds')}
                </th>
              )}
              {payoutRows
                .map((row, originalIndex) => {
                  const payout = (totalPool * getRowPercentage(row)) / 100;
                  const payoutPerTeam = row.teams > 0 ? payout / row.teams : 0;
                  return { row, originalIndex, payoutPerTeam };
                })
                .sort((a, b) => a.payoutPerTeam - b.payoutPerTeam)
                .map(({ row, originalIndex }, displayIndex) => {
                  const achievementKey = row.level.toLowerCase().replace(/\s+/g, '');
                  return (
                    <th key={displayIndex} className="achievement-header">
                      <div className="achievement-header-title">{row.level}</div>
                      <div className={`achievement-count ${getAchievementCount(achievementKey) >= getAchievementTarget(row.level) ? 'target-met' : ''}`}>
                        {getAchievementCount(achievementKey)} / {getAchievementTarget(row.level)}
                      </div>
                    </th>
                  );
                })
              }
            </tr>
          </thead>
          <tbody>
            {sortedTeams.map(team => (
              <tr key={team.id} className={getOwnerRowClass(team.owner)}>
                <td className="owner-cell">{team.owner || ''}</td>
                <td className="team-name-cell">{team.name}</td>
                <td className={getRecordColor(team.record)}>{team.record}</td>
                <td>{team.division}</td>
                {leagueConfig?.showColumns?.gamesBack && (
                  <td className={getGamesBackColor(team.gamesBack)}>{team.gamesBack}</td>
                )}
                {leagueConfig?.showColumns?.wildCardGamesBack && (
                  <td className={getGamesBackColor(team.wildCardGamesBack)}>{team.wildCardGamesBack}</td>
                )}
                {leagueConfig?.showColumns?.odds && (
                  <td>{team.odds}</td>
                )}
                {payoutRows
                  .map((row, originalIndex) => {
                    const payout = (totalPool * getRowPercentage(row)) / 100;
                    const payoutPerTeam = row.teams > 0 ? payout / row.teams : 0;
                    return { row, originalIndex, payoutPerTeam };
                  })
                  .sort((a, b) => a.payoutPerTeam - b.payoutPerTeam)
                  .map(({ row, originalIndex }, displayIndex) => {
                    const achievementKey = row.level.toLowerCase().replace(/\s+/g, '');
                    return (
                      <td key={`${team.id}-${displayIndex}`} className="achievement-cell">
                        <input
                          type="checkbox"
                          checked={getPlayoffAchievement(team.id, achievementKey) || false}
                          onChange={(e) => updatePlayoffAchievement(team.id, achievementKey, e.target.checked)}
                          className="achievement-checkbox"
                        />
                      </td>
                    );
                  })
                }
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
};

export default TeamTable;