import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { fetchAndSaveApiData, getLeagueConfig, getCurrentStandings } from '../services/sportsApi';
import { useLeagueData, useTeamManagement, useTeams, usePayoutStructure } from '../hooks/useGraphQL';
import { useLeagueSettings } from '../hooks/useLeagueSettings';
import DraftSection from './DraftSection';
import './TeamTableNew.css';

const TeamTable = ({ leagueId = 'mlb-2025' }) => {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [asOf, setAsOf] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [apiDataFetched, setApiDataFetched] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Payout plan state
  const [payoutRows, setPayoutRows] = useState([]);
  
  // League settings hook
  const { 
    settings: leagueSettings, 
    loading: settingsLoading, 
    updateBuyInPerTeam, 
    updateNumTeams 
  } = useLeagueSettings(leagueId);
  
  // Get league configuration
  const leagueConfig = getLeagueConfig(leagueId);

  // GraphQL hooks
  const {
    teams: gqlTeams,
    payoutRows: gqlPayoutRows,
    achievements,
    loading: gqlLoading,
    updateTeamAchievement,
    getTeamAchievement,
    updatePayoutRowData,
    refetchData
  } = useLeagueData(leagueId);

  // Get individual hook errors for better error reporting
  const { error: teamsError } = useTeams(leagueId.split('-')[0], leagueId.split('-')[1]);
  const { error: payoutError } = usePayoutStructure(leagueId.split('-')[0], leagueId.split('-')[1]);

  // Team management hook
  const { updateTeam } = useTeamManagement();

  // Available players for owner selection
  const availablePlayers = ['DM', 'MC', 'KH', 'TG'];

  // Use GraphQL data directly instead of copying to local state
  // Use GraphQL data directly
  const currentTeams = gqlTeams;
  const currentPayoutRows = gqlPayoutRows;
  const currentLoading = gqlLoading;
  
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

  // Reset API fetched flag when league changes
  useEffect(() => {
    setApiDataFetched(false);
  }, [leagueId]);

  // Manual refresh function that updates team data from APIs - league-aware
  const handleManualRefresh = useCallback(async () => {
    console.log('🔄 Manual refresh triggered for league:', leagueId);
    if (!isRefreshing) {
      try {
        setIsRefreshing(true);
        setError(null);
        
        // Use the existing sportsApi function which is already league-aware
        console.log('🔄 Using fetchAndSaveApiData for comprehensive update...');
        const result = await fetchAndSaveApiData(leagueId, gqlTeams);
        
        if (result.success) {
          console.log(`✅ Updated ${result.successCount}/${result.totalCount} teams with fresh API data`);
          setAsOf(new Date().toISOString());
          setMetadata(result.metadata);
          
          // Refresh GraphQL data after a short delay to let updates propagate
          setTimeout(() => {
            refetchData();
          }, 2000);
        } else {
          throw new Error(result.error || 'Failed to update team data');
        }
        
      } catch (err) {
        console.error('❌ Error during team data update:', err);
        setError(`Failed to update team data: ${err.message}`);
      } finally {
        setIsRefreshing(false);
      }
    }
  }, [isRefreshing, leagueId, gqlTeams, refetchData]);

  // Handle owner update
  const handleOwnerUpdate = async (teamId, newOwner) => {
    try {
      console.log(`🔄 Updating team ${teamId} owner to ${newOwner}`);
      await updateTeam({ id: teamId, owner: newOwner });
      console.log(`✅ Team owner updated successfully`);
      // Clear any previous errors
      setError(null);
    } catch (error) {
      console.error('❌ Error updating team owner:', error);
      const errorMessage = error.message || 'Failed to update team owner';
      setError(`Failed to update team owner: ${errorMessage}`);
    }
  };

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
    console.log('🏆 Achievement checkbox clicked:', { teamId, achievement, value });
    
    // Always use GraphQL to update achievements
    try {
      console.log('📡 Calling GraphQL updateTeamAchievement...');
      await updateTeamAchievement(teamId, achievement, value);
      console.log('✅ GraphQL achievement update successful');
    } catch (error) {
      console.error('❌ Failed to update achievement via GraphQL:', error);
      // In GraphQL-only mode, show user-friendly error
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
    console.log('🔢 Recalculated achievement counts:', counts, 'triggered by achievements change:', Object.keys(achievements).length);
    return counts;
  }, [currentTeams, currentPayoutRows, achievements, getTeamAchievement]);

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
  }, [currentTeams, currentPayoutRows, achievements, getTeamAchievement]);

  const totalPool = leagueSettings.totalPool;

  // Helper function to calculate player winnings
  const calculatePlayerWinnings = (playerName) => {
    return currentPayoutRows.reduce((total, row) => {
      const achievementKey = row.level.toLowerCase().replace(/\s+/g, '');
      const payoutPerTeam = row.teams > 0 ? (totalPool * getRowPercentage(row) / 100) / row.teams : 0;
      return total + (achievementKey ? playerAchievements[playerName][achievementKey] * payoutPerTeam : 0);
    }, 0);
  };

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
          <button onClick={handleManualRefresh} className="retry-button">
            Retry
          </button>
        </div>
      )}
      
      <div className="data-info-card compact">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <h3>Hybrid Data (GraphQL + Live APIs)</h3>
          <button 
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            style={{
              padding: '5px 10px',
              backgroundColor: isRefreshing ? '#ccc' : '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: isRefreshing ? 'not-allowed' : 'pointer',
              fontSize: '12px'
            }}
          >
            {isRefreshing ? 'Updating from APIs...' : 'Update Team Data'}
          </button>
        </div>
        
        <div className="data-info-simple">
          <strong>Teams:</strong> {currentTeams.length} | 
          <strong> Payout Levels:</strong> {currentPayoutRows.length} | 
          <strong> Last Updated:</strong> {asOf ? new Date(asOf).toLocaleString() : 'On page load'}
          {metadata?.standings && (
            <span> • Standings: {metadata.standings.totalTeams} teams from {metadata.standings.source}</span>
          )}
          {metadata?.odds && (
            <span> • Odds: {metadata.odds.teamsWithOdds || 0} teams from {metadata.odds.source || 'API'}</span>
          )}
          {/* Display API errors */}
          {metadata?.standings?.error && (
            <span className="api-error">⚠️ {metadata.standings.error}</span>
          )}
          {metadata?.odds?.error && (
            <span className="api-error">⚠️ {metadata.odds.error}</span>
          )}
          {/* Display GraphQL errors */}
          {teamsError && (
            <span className="api-error">⚠️ Teams: {teamsError.message}</span>
          )}
          {payoutError && (
            <span className="api-error">⚠️ Payout: {payoutError.message}</span>
          )}
          <span style={{ fontSize: '10px', marginLeft: '10px', color: '#666' }}>
            💡 Data persists in GraphQL, click "Update Team Data" to refresh from CFBD & Odds APIs
          </span>
        </div>
      </div>

      {/* Draft Section */}
      <DraftSection league={leagueId.split('-')[0]} season={leagueId.split('-')[1]} />

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
        <div className="table-wrapper">
          <table className="payout-table">
            <thead>
              <tr>
                <th>Level</th>
                <th>Teams</th>
                <th>%</th>
                <th>Payout</th>
                <th className="owner-col">DM</th>
                <th className="owner-col">TG</th>
                <th className="owner-col">KH</th>
                <th className="owner-col">MC</th>
              </tr>
            </thead>
            <tbody>
              {payoutRows.map((row, index) => {
                const payout = (totalPool * getRowPercentage(row)) / 100;
                const payoutPerTeam = row.teams > 0 ? payout / row.teams : 0;
                
                const achievementKey = row.level.toLowerCase().replace(/\s+/g, '');
                
                return (
                  <tr key={index}>
                    <td>{row.level}</td>
                    <td>
                      <input
                        type="number"
                        value={row.teams}
                        onChange={(e) => {
                          // Update local state immediately for responsive UI
                          const newRows = payoutRows.map((r, i) => {
                            if (i === index) {
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
                          updatePayoutField(index, 'teams', e.target.value);
                        }}
                        className="payout-input"
                        min="0"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        value={getRowPercentage(row)}
                        onChange={(e) => {
                          // Update local state immediately for responsive UI
                          const newRows = payoutRows.map((r, i) => {
                            if (i === index) {
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
                          updatePayoutField(index, 'pct', e.target.value);
                        }}
                        className="payout-input"
                        min="0"
                        max="100"
                        step="0.1"
                      /> %
                    </td>
                    <td>${payoutPerTeam.toFixed(0)}</td>
                    <td className="owner-col">
                      {achievementKey && playerAchievements['DM'][achievementKey] > 0 ? (
                        <span className="achievement-earned">
                          {playerAchievements['DM'][achievementKey]} × ${payoutPerTeam.toFixed(0)} = ${(playerAchievements['DM'][achievementKey] * payoutPerTeam).toFixed(0)}
                        </span>
                      ) : (
                        <span className="achievement-none">-</span>
                      )}
                    </td>
                    <td className="owner-col">
                      {achievementKey && playerAchievements['TG'][achievementKey] > 0 ? (
                        <span className="achievement-earned">
                          {playerAchievements['TG'][achievementKey]} × ${payoutPerTeam.toFixed(0)} = ${(playerAchievements['TG'][achievementKey] * payoutPerTeam).toFixed(0)}
                        </span>
                      ) : (
                        <span className="achievement-none">-</span>
                      )}
                    </td>
                    <td className="owner-col">
                      {achievementKey && playerAchievements['KH'][achievementKey] > 0 ? (
                        <span className="achievement-earned">
                          {playerAchievements['KH'][achievementKey]} × ${payoutPerTeam.toFixed(0)} = ${(playerAchievements['KH'][achievementKey] * payoutPerTeam).toFixed(0)}
                        </span>
                      ) : (
                        <span className="achievement-none">-</span>
                      )}
                    </td>
                    <td className="owner-col">
                      {achievementKey && playerAchievements['MC'][achievementKey] > 0 ? (
                        <span className="achievement-earned">
                          {playerAchievements['MC'][achievementKey]} × ${payoutPerTeam.toFixed(0)} = ${(playerAchievements['MC'][achievementKey] * payoutPerTeam).toFixed(0)}
                        </span>
                      ) : (
                        <span className="achievement-none">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              <tr className="total-row">
                <td><strong>Total</strong></td>
                <td></td>
                <td><strong>{payoutRows.reduce((sum, row) => sum + getRowPercentage(row), 0).toFixed(1)} %</strong></td>
                <td><strong>${totalPool.toFixed(0)}</strong></td>
                <td className="owner-col">
                  <strong>
                    ${calculatePlayerWinnings('DM').toFixed(0)}
                  </strong>
                </td>
                <td className="owner-col">
                  <strong>
                    ${calculatePlayerWinnings('TG').toFixed(0)}
                  </strong>
                </td>
                <td className="owner-col">
                  <strong>
                    ${calculatePlayerWinnings('KH').toFixed(0)}
                  </strong>
                </td>
                <td className="owner-col">
                  <strong>
                    ${calculatePlayerWinnings('MC').toFixed(0)}
                  </strong>
                </td>
              </tr>
              <tr className="buyin-row">
                <td><strong>Buy-in Cost</strong></td>
                <td></td>
                <td></td>
                <td></td>
                <td className="owner-col">
                  <strong>
                    -${leagueSettings.buyInPerTeam.toFixed(0)}
                  </strong>
                </td>
                <td className="owner-col">
                  <strong>
                    -${leagueSettings.buyInPerTeam.toFixed(0)}
                  </strong>
                </td>
                <td className="owner-col">
                  <strong>
                    -${leagueSettings.buyInPerTeam.toFixed(0)}
                  </strong>
                </td>
                <td className="owner-col">
                  <strong>
                    -${leagueSettings.buyInPerTeam.toFixed(0)}
                  </strong>
                </td>
              </tr>
              <tr className="net-total-row">
                <td><strong>Net Total</strong></td>
                <td></td>
                <td></td>
                <td></td>
                <td className="owner-col">
                  <strong className={(() => {
                      const netTotal = calculatePlayerWinnings('DM') - leagueSettings.buyInPerTeam;
                      return netTotal < 0 ? 'net-negative' : '';
                    })()}>
                    ${(calculatePlayerWinnings('DM') - leagueSettings.buyInPerTeam).toFixed(0)}
                  </strong>
                </td>
                <td className="owner-col">
                  <strong className={(() => {
                      const netTotal = calculatePlayerWinnings('TG') - leagueSettings.buyInPerTeam;
                      return netTotal < 0 ? 'net-negative' : '';
                    })()}>
                    ${(calculatePlayerWinnings('TG') - leagueSettings.buyInPerTeam).toFixed(0)}
                  </strong>
                </td>
                <td className="owner-col">
                  <strong className={(() => {
                      const netTotal = calculatePlayerWinnings('KH') - leagueSettings.buyInPerTeam;
                      return netTotal < 0 ? 'net-negative' : '';
                    })()}>
                    ${(calculatePlayerWinnings('KH') - leagueSettings.buyInPerTeam).toFixed(0)}
                  </strong>
                </td>
                <td className="owner-col">
                  <strong className={(() => {
                      const netTotal = calculatePlayerWinnings('MC') - leagueSettings.buyInPerTeam;
                      return netTotal < 0 ? 'net-negative' : '';
                    })()}>
                    ${(calculatePlayerWinnings('MC') - leagueSettings.buyInPerTeam).toFixed(0)}
                  </strong>
                </td>
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
              {payoutRows.map((row, index) => {
                const achievementKey = row.level.toLowerCase().replace(/\s+/g, '');
                return (
                  <th key={index} className="achievement-header">
                    {row.level}
                    <span className={`achievement-count ${getAchievementCount(achievementKey) >= getAchievementTarget(row.level) ? 'target-met' : ''}`}>
                      ({getAchievementCount(achievementKey)}/{getAchievementTarget(row.level)})
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sortedTeams.map((team) => (
              <tr key={team.id} className={getOwnerRowClass(team.owner)}>
                <td className="owner-cell">
                  <select
                    value={team.owner || 'NA'}
                    onChange={(e) => handleOwnerUpdate(team.id, e.target.value)}
                    className="owner-select"
                  >
                    <option value="NA">NA</option>
                    {availablePlayers.map(player => (
                      <option key={player} value={player}>{player}</option>
                    ))}
                  </select>
                </td>
                <td className="team-name-cell">{team.name}</td>
                <td className={`record-cell ${getRecordColor(team.record)}`}>
                  {team.record}
                </td>
                <td className="division-cell">{team.division}</td>
                {leagueConfig?.showColumns?.gamesBack && (
                  <td className={`gb-cell ${getGamesBackColor(team.gamesBack)}`}>
                    {team.gamesBack}
                  </td>
                )}
                {leagueConfig?.showColumns?.wildCardGamesBack && (
                  <td className={`wcgb-cell ${getGamesBackColor(team.wildCardGamesBack)}`}>
                    {team.wildCardGamesBack}
                  </td>
                )}
                {leagueConfig?.showColumns?.odds && (
                  <td className="odds-cell">
                    {team.odds}
                  </td>
                )}
                {payoutRows.map((row, index) => {
                  const achievementKey = row.level.toLowerCase().replace(/\s+/g, '');
                  return (
                    <td key={index} className="achievement-cell">
                      <input
                        type="checkbox"
                        className="achievement-checkbox"
                        checked={getPlayoffAchievement(team.id, achievementKey)}
                        onChange={(e) => updatePlayoffAchievement(team.id, achievementKey, e.target.checked)}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        </div>

        {sortedTeams.length === 0 && !currentLoading && (
          <div className="no-results">
            <p>No teams found.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TeamTable;
