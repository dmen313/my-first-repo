import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { getUserPreferences, saveUserPreferences } from '../services/dynamoDBService';
import './NCAABracket.css';

// Generate or retrieve a unique device ID for anonymous users
const getDeviceUserId = () => {
  let deviceId = localStorage.getItem('deviceUserId');
  if (!deviceId) {
    deviceId = `device-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('deviceUserId', deviceId);
  }
  return deviceId;
};

// Owner colors - distinct colors for easy identification
const OWNER_COLORS = {
  // 8-owner NCAA 2026 draft
  'DM': '#22c55e',  // Green
  'DB': '#ef4444',  // Red
  'BM': '#3b82f6',  // Blue
  'MJ': '#f97316',  // Orange
  'JK': '#a855f7',  // Purple
  'TM': '#ec4899',  // Pink
  'KB': '#14b8a6',  // Teal
  'MS': '#eab308',  // Yellow
  // 4-owner NCAA 2026 draft
  'TG': '#ec4899',  // Pink
  'KH': '#3b82f6',  // Blue
  'MC': '#a855f7',  // Purple
  // Legacy/other drafts
  'JR': '#f97316',  // Orange
  'BW': '#14b8a6',  // Teal
  'AS': '#eab308',  // Yellow
  'RL': '#ef4444'   // Red
};

const NCAABracket = ({ teams = [], games = [], onTeamClick, onGameWinnerSelect, isDraftInProgress = false, isDraftComplete = false, nextPick = null, owners = [], leagueId = 'ncaa-tourney-2025' }) => {
  const [activeRegion, setActiveRegion] = useState('all');
  const [isCompactMode, setIsCompactMode] = useState(isDraftInProgress);
  const [selectedOwner, setSelectedOwner] = useState('all');
  
  // Ref to preserve scroll position during updates
  const scrollPositionRef = useRef({ x: 0, y: 0 });
  
  const userId = getDeviceUserId();
  
  // Load preferences from DynamoDB on mount
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const prefs = await getUserPreferences(userId, leagueId);
        if (prefs) {
          setActiveRegion(prefs.activeRegion || 'all');
          setIsCompactMode(prefs.isCompactMode !== undefined ? prefs.isCompactMode : isDraftInProgress);
          setSelectedOwner(prefs.selectedOwner || 'all');
        }
      } catch (error) {
        console.warn('Could not load preferences:', error);
      }
    };
    
    loadPreferences();
  }, [userId, leagueId, isDraftInProgress]);
  
  // Save preferences to DynamoDB
  const savePreferences = useCallback(async (prefs) => {
    try {
      await saveUserPreferences(userId, leagueId, prefs);
    } catch (error) {
      console.warn('Could not save preferences:', error);
    }
  }, [userId, leagueId]);
  
  const handleModeChange = (compact) => {
    setIsCompactMode(compact);
    savePreferences({ activeRegion, isCompactMode: compact, selectedOwner });
  };
  
  const handleOwnerChange = (owner) => {
    setSelectedOwner(owner);
    savePreferences({ activeRegion, isCompactMode, selectedOwner: owner });
  };
  
  const handleRegionChange = (region) => {
    setActiveRegion(region);
    savePreferences({ activeRegion: region, isCompactMode, selectedOwner });
  };
  
  // Parse odds to numeric values (lower is better for American odds)
  const parseOdds = (odds) => {
    if (!odds || odds === '-') return null;
    const numStr = odds.replace(/[+,]/g, '');
    const num = parseInt(numStr, 10);
    return isNaN(num) ? null : num;
  };

  // Calculate odds percentiles for color coding (among non-eliminated teams)
  const oddsRanking = useMemo(() => {
    // Get all non-eliminated teams with valid odds
    const activeTeams = teams.filter(t => !t.eliminated && t.odds);
    
    // Get sorted odds values
    const oddsValues = activeTeams
      .map(t => parseOdds(t.odds))
      .filter(v => v !== null)
      .sort((a, b) => a - b); // Sort ascending (best odds first)
    
    if (oddsValues.length === 0) return {};
    
    const minOdds = oddsValues[0];
    const maxOdds = oddsValues[oddsValues.length - 1];
    const range = maxOdds - minOdds;
    
    // Create a map of team ID to percentile (0 = best, 1 = worst)
    const ranking = {};
    activeTeams.forEach(team => {
      const odds = parseOdds(team.odds);
      if (odds !== null && range > 0) {
        ranking[team.id] = (odds - minOdds) / range;
      } else if (odds !== null) {
        ranking[team.id] = 0.5; // All same odds
      }
    });
    
    return ranking;
  }, [teams]);
  
  // Get top 5 available (undrafted, non-eliminated) teams by odds
  const top5AvailableTeamIds = useMemo(() => {
    const availableTeams = teams
      .filter(t => !t.eliminated && !t.owner && t.odds)
      .map(t => ({ id: t.id, odds: parseOdds(t.odds) }))
      .filter(t => t.odds !== null)
      .sort((a, b) => a.odds - b.odds) // Best odds first
      .slice(0, 5)
      .map(t => t.id);
    
    return new Set(availableTeams);
  }, [teams]);
  
  // Get color and font weight for odds based on percentile (7-point scale)
  const getOddsStyle = (teamId, isEliminated, isOwned) => {
    if (isEliminated) return { color: '#6b7280', fontWeight: 500 }; // Gray for eliminated
    
    // If team is in top 5 available (undrafted) and we're in draft mode, make it super bright
    const isTopAvailable = isDraftInProgress && top5AvailableTeamIds.has(teamId);
    if (isTopAvailable) {
      return { color: '#00ff88', fontWeight: 900, textShadow: '0 0 8px rgba(0, 255, 136, 0.6)' };
    }
    
    // If team is already owned, dim the odds
    if (isOwned && isDraftInProgress) {
      return { color: '#4b5563', fontWeight: 500 };
    }
    
    const percentile = oddsRanking[teamId];
    if (percentile === undefined) return { color: '#6b7280', fontWeight: 500 };
    
    // 7-point color scale: green -> yellow-green -> yellow -> gold -> orange -> red-orange -> red
    if (percentile <= 0.14) {
      // Tier 1: Best odds - bold bright green
      return { color: '#22c55e', fontWeight: 800 };
    } else if (percentile <= 0.28) {
      // Tier 2: Very good odds - yellow-green
      return { color: '#a3e635', fontWeight: 600 };
    } else if (percentile <= 0.42) {
      // Tier 3: Good odds - lime yellow
      return { color: '#d9f99d', fontWeight: 600 };
    } else if (percentile <= 0.57) {
      // Tier 4: Middle odds - yellow
      return { color: '#fbbf24', fontWeight: 500 };
    } else if (percentile <= 0.71) {
      // Tier 5: Below average - orange
      return { color: '#fb923c', fontWeight: 500 };
    } else if (percentile <= 0.85) {
      // Tier 6: Poor odds - red-orange
      return { color: '#f87171', fontWeight: 600 };
    } else {
      // Tier 7: Worst odds - bold red
      return { color: '#ef4444', fontWeight: 800 };
    }
  };

  // Organize games by round and region
  const gamesByRound = useMemo(() => {
    const rounds = {
      1: { East: [], West: [], South: [], Midwest: [] },
      2: { East: [], West: [], South: [], Midwest: [] },
      3: { East: [], West: [], South: [], Midwest: [] },
      4: { East: [], West: [], South: [], Midwest: [] },
      5: { FinalFour: [] },
      6: { Championship: [] }
    };
    
    games.forEach(game => {
      if (rounds[game.round]) {
        if (game.round <= 4) {
          if (rounds[game.round][game.region]) {
            rounds[game.round][game.region].push(game);
          }
        } else if (game.round === 5) {
          rounds[5].FinalFour.push(game);
        } else {
          rounds[6].Championship.push(game);
        }
      }
    });
    
    // Sort games within each group
    Object.values(rounds).forEach(regionGames => {
      Object.values(regionGames).forEach(gameList => {
        gameList.sort((a, b) => a.gameNum - b.gameNum);
      });
    });
    
    return rounds;
  }, [games]);
  
  // Get team by ID
  const getTeamById = (teamId) => {
    return teams.find(t => t.id === teamId);
  };
  
  // Render a single team slot in the bracket
  const TeamSlot = ({ team, seed, isWinner, gameStatus, feederGame, onSelectWinner }) => {
    // If no team but there's a feeder game we can pick from, show dropdown
    if (!team && feederGame && canSelectWinner(feederGame)) {
      const feederTeam1 = feederGame.team1Id ? getTeamById(feederGame.team1Id) : null;
      const feederTeam2 = feederGame.team2Id ? getTeamById(feederGame.team2Id) : null;
      
      return (
        <div className="team-slot team-slot-picker">
          <select 
            className="winner-select-inline"
            value=""
            onChange={(e) => onSelectWinner && onSelectWinner(feederGame, e.target.value)}
          >
            <option value="">Pick Winner</option>
            {feederTeam1 && <option value={feederTeam1.id}>#{feederTeam1.seed} {feederTeam1.name}</option>}
            {feederTeam2 && <option value={feederTeam2.id}>#{feederTeam2.seed} {feederTeam2.name}</option>}
          </select>
        </div>
      );
    }
    
    if (!team) {
      return (
        <div className={`team-slot team-slot-empty ${selectedOwner !== 'all' ? 'muted' : ''}`}>
          <span className="team-seed">#{seed || '?'}</span>
          <span className="team-name">TBD</span>
        </div>
      );
    }
    
    const ownerColor = team.owner ? OWNER_COLORS[team.owner] || '#6b7280' : null;
    const isEliminated = team.eliminated;
    const isDraftable = isDraftInProgress && !team.owner && nextPick;
    const isTopAvailable = isDraftInProgress && top5AvailableTeamIds.has(team.id);
    
    // Determine if this team should be highlighted or muted
    const isHighlighted = selectedOwner !== 'all' && team.owner === selectedOwner;
    // Mute if: owner filter active and not matching, OR draft in progress and already drafted
    const isMutedByOwnerFilter = selectedOwner !== 'all' && team.owner !== selectedOwner;
    const isMutedByDraft = isDraftInProgress && selectedOwner === 'all' && team.owner;
    const isMuted = isMutedByOwnerFilter || isMutedByDraft;
    
    const handleClick = () => {
      if (isDraftable && onTeamClick) {
        onTeamClick(team);
      }
    };
    
    // Create highlighted style with owner's color
    const highlightedStyle = isHighlighted && ownerColor ? {
      backgroundColor: `${ownerColor}40`,
      borderColor: ownerColor,
      boxShadow: `0 0 8px ${ownerColor}60`
    } : {};
    
    return (
      <div 
        className={`team-slot ${isWinner ? 'winner' : ''} ${isEliminated ? 'eliminated' : ''} ${isDraftable ? 'draftable' : ''} ${team.owner ? 'owned' : ''} ${isHighlighted ? 'highlighted' : ''} ${isMuted ? 'muted' : ''} ${isTopAvailable ? 'top-available' : ''}`}
        style={highlightedStyle}
        onClick={handleClick}
        title={isDraftable ? `Click to draft for ${nextPick.owner}` : team.owner ? `Owned by ${team.owner}` : ''}
      >
        <span className="team-seed">#{team.seed || seed}</span>
        <span className={`team-name ${isEliminated ? 'strikethrough' : ''}`}>
          {team.name}
        </span>
        <span 
          className="team-odds"
          style={getOddsStyle(team.id, isEliminated, !!team.owner)}
        >
          {team.odds || '-'}
        </span>
        {team.owner && (
          <span 
            className="team-owner"
            style={{ backgroundColor: ownerColor }}
          >
            {team.owner}
          </span>
        )}
        {isDraftable && (
          <span className="draft-indicator">+</span>
        )}
      </div>
    );
  };
  
  // Check if a game can have its winner selected (prior round games must have winners)
  const canSelectWinner = (game) => {
    if (!isDraftComplete) return false;
    if (game.winnerId) return false; // Already has winner
    if (!game.team1Id || !game.team2Id) return false; // Both teams must be set
    
    // For round 1, always can select if both teams are present
    if (game.round === 1) return true;
    
    // For later rounds, check that the feeder games have winners
    const previousRound = game.round - 1;
    const feederGameNums = [(game.gameNum * 2) - 1, game.gameNum * 2];
    
    const feederGames = games.filter(g => 
      g.round === previousRound && 
      g.region === game.region && 
      feederGameNums.includes(g.gameNum)
    );
    
    return feederGames.every(g => g.winnerId);
  };
  
  // Handle winner selection from dropdown
  const handleWinnerChange = (game, winnerId) => {
    if (winnerId && onGameWinnerSelect) {
      // Save current scroll position before update
      const savedX = window.scrollX;
      const savedY = window.scrollY;
      scrollPositionRef.current = { x: savedX, y: savedY };
      
      onGameWinnerSelect(game, winnerId);
      
      // Restore scroll position after React re-renders (multiple attempts for reliability)
      requestAnimationFrame(() => {
        window.scrollTo(savedX, savedY);
      });
      setTimeout(() => {
        window.scrollTo(scrollPositionRef.current.x, scrollPositionRef.current.y);
      }, 0);
      setTimeout(() => {
        window.scrollTo(scrollPositionRef.current.x, scrollPositionRef.current.y);
      }, 50);
    }
  };

  // Find the feeder game for a slot in a game
  const getFeederGame = (game, isTeam1Slot) => {
    if (!game || game.round <= 1) return null;
    
    const previousRound = game.round - 1;
    // Team 1 comes from the odd-numbered feeder game, Team 2 from the even-numbered
    const feederGameNum = isTeam1Slot ? (game.gameNum * 2) - 1 : game.gameNum * 2;
    
    // Handle special cases for Final Four and Championship
    if (game.round === 5) {
      // Final Four: team1 comes from East/South Elite 8, team2 from West/Midwest Elite 8
      const regionMapping = game.gameNum === 1 
        ? { team1: 'East', team2: 'West' } 
        : { team1: 'South', team2: 'Midwest' };
      const targetRegion = isTeam1Slot ? regionMapping.team1 : regionMapping.team2;
      return games.find(g => g.round === 4 && g.region === targetRegion);
    } else if (game.round === 6) {
      // Championship: team1 from Final Four game 1, team2 from Final Four game 2
      const targetGameNum = isTeam1Slot ? 1 : 2;
      return games.find(g => g.round === 5 && g.region === 'FinalFour' && g.gameNum === targetGameNum);
    }
    
    // Standard case: find feeder game in same region, previous round
    return games.find(g => 
      g.round === previousRound && 
      g.region === game.region && 
      g.gameNum === feederGameNum
    );
  };

  // Render a matchup (two teams)
  const Matchup = ({ game, roundNum }) => {
    const team1 = game.team1Id ? getTeamById(game.team1Id) : null;
    const team2 = game.team2Id ? getTeamById(game.team2Id) : null;
    const hasWinner = !!game.winnerId;
    
    // Get feeder games for empty slots
    const feederGame1 = !team1 ? getFeederGame(game, true) : null;
    const feederGame2 = !team2 ? getFeederGame(game, false) : null;
    
    return (
      <div className={`matchup round-${roundNum} ${hasWinner ? 'has-winner' : ''}`}>
        <TeamSlot 
          team={team1} 
          seed={game.team1Seed}
          isWinner={game.winnerId === game.team1Id}
          gameStatus={game.status}
          feederGame={feederGame1}
          onSelectWinner={handleWinnerChange}
        />
        <div className="matchup-connector"></div>
        <TeamSlot 
          team={team2} 
          seed={game.team2Seed}
          isWinner={game.winnerId === game.team2Id}
          gameStatus={game.status}
          feederGame={feederGame2}
          onSelectWinner={handleWinnerChange}
        />
        {game.status === 'completed' && game.score1 && game.score2 && (
          <div className="matchup-score">
            {game.score1} - {game.score2}
          </div>
        )}
      </div>
    );
  };
  
  // Render a region bracket (rounds 1-4)
  const RegionBracket = ({ region, position }) => {
    const regionGames = {
      1: gamesByRound[1][region] || [],
      2: gamesByRound[2][region] || [],
      3: gamesByRound[3][region] || [],
      4: gamesByRound[4][region] || []
    };
    
    // First round matchups based on NCAA bracket seeding: 1v16, 8v9, 5v12, 4v13, 6v11, 3v14, 7v10, 2v15
    const firstRoundOrder = [
      [1, 16], [8, 9], [5, 12], [4, 13], [6, 11], [3, 14], [7, 10], [2, 15]
    ];
    
    return (
      <div className={`region-bracket region-${position}`}>
        <div className="region-header">
          <h3>{region} Region</h3>
        </div>
        <div className="region-rounds">
          {/* Round 1 - 8 games */}
          <div className="bracket-round round-1">
            <div className="round-label">Round 1</div>
            {regionGames[1].map((game, idx) => (
              <Matchup key={game.id} game={game} roundNum={1} />
            ))}
            {/* Fill empty slots if games not created yet */}
            {regionGames[1].length === 0 && firstRoundOrder.map((seeds, idx) => (
              <Matchup 
                key={`empty-1-${idx}`} 
                game={{ 
                  team1Seed: seeds[0], 
                  team2Seed: seeds[1], 
                  status: 'scheduled' 
                }} 
                roundNum={1} 
              />
            ))}
          </div>
          
          {/* Round 2 - 4 games */}
          <div className="bracket-round round-2">
            <div className="round-label">Round 2</div>
            {regionGames[2].map((game, idx) => (
              <Matchup key={game.id} game={game} roundNum={2} />
            ))}
            {regionGames[2].length === 0 && Array(4).fill(null).map((_, idx) => (
              <Matchup 
                key={`empty-2-${idx}`} 
                game={{ status: 'scheduled' }} 
                roundNum={2} 
              />
            ))}
          </div>
          
          {/* Sweet 16 - 2 games */}
          <div className="bracket-round round-3">
            <div className="round-label">Sweet 16</div>
            {regionGames[3].map((game, idx) => (
              <Matchup key={game.id} game={game} roundNum={3} />
            ))}
            {regionGames[3].length === 0 && Array(2).fill(null).map((_, idx) => (
              <Matchup 
                key={`empty-3-${idx}`} 
                game={{ status: 'scheduled' }} 
                roundNum={3} 
              />
            ))}
          </div>
          
          {/* Elite 8 - 1 game */}
          <div className="bracket-round round-4">
            <div className="round-label">Elite 8</div>
            {regionGames[4].map((game, idx) => (
              <Matchup key={game.id} game={game} roundNum={4} />
            ))}
            {regionGames[4].length === 0 && (
              <Matchup 
                key="empty-4" 
                game={{ status: 'scheduled' }} 
                roundNum={4} 
              />
            )}
          </div>
        </div>
      </div>
    );
  };
  
  // Render Final Four and Championship
  const FinalFourBracket = () => {
    const finalFourGames = gamesByRound[5].FinalFour || [];
    const championshipGames = gamesByRound[6].Championship || [];
    
    return (
      <div className="final-four-bracket">
        <div className="final-four-header">
          <h3>Final Four</h3>
        </div>
        <div className="final-four-rounds">
          {/* Final Four - 2 games */}
          <div className="bracket-round round-5">
            <div className="round-label">Final Four</div>
            {finalFourGames.map((game, idx) => (
              <Matchup key={game.id} game={game} roundNum={5} />
            ))}
            {finalFourGames.length === 0 && Array(2).fill(null).map((_, idx) => (
              <Matchup 
                key={`empty-5-${idx}`} 
                game={{ status: 'scheduled' }} 
                roundNum={5} 
              />
            ))}
          </div>
          
          {/* Championship - 1 game */}
          <div className="bracket-round round-6 championship">
            <div className="round-label">Championship</div>
            {championshipGames.map((game, idx) => (
              <Matchup key={game.id} game={game} roundNum={6} />
            ))}
            {championshipGames.length === 0 && (
              <Matchup 
                key="empty-6" 
                game={{ status: 'scheduled' }} 
                roundNum={6} 
              />
            )}
          </div>
          
          {/* Champion Display */}
          <div className="bracket-round round-7 champion">
            <div className="round-label">🏆 Champion</div>
            {championshipGames.length > 0 && (() => {
              const champGame = championshipGames[0];
              const champion = champGame.winnerId ? getTeamById(champGame.winnerId) : null;
              const canPickChamp = isDraftComplete && champGame.team1Id && champGame.team2Id && !champGame.winnerId;
              const team1 = champGame.team1Id ? getTeamById(champGame.team1Id) : null;
              const team2 = champGame.team2Id ? getTeamById(champGame.team2Id) : null;
              
              if (champion) {
                const ownerColor = champion.owner ? OWNER_COLORS[champion.owner] : '#22c55e';
                return (
                  <div className="champion-display">
                    <div className="champion-team" style={{ borderColor: ownerColor }}>
                      <span className="champion-trophy">🏆</span>
                      <span className="champion-seed">#{champion.seed}</span>
                      <span className="champion-name">{champion.name}</span>
                      {champion.owner && (
                        <span className="champion-owner" style={{ backgroundColor: ownerColor }}>
                          {champion.owner}
                        </span>
                      )}
                    </div>
                  </div>
                );
              } else if (canPickChamp) {
                return (
                  <div className="champion-picker">
                    <select
                      className="champion-select"
                      value=""
                      onChange={(e) => handleWinnerChange(champGame, e.target.value)}
                    >
                      <option value="">Select Champion</option>
                      {team1 && <option value={team1.id}>#{team1.seed} {team1.name}</option>}
                      {team2 && <option value={team2.id}>#{team2.seed} {team2.name}</option>}
                    </select>
                  </div>
                );
              } else {
                return (
                  <div className="champion-placeholder">
                    <span>TBD</span>
                  </div>
                );
              }
            })()}
            {championshipGames.length === 0 && (
              <div className="champion-placeholder">
                <span>TBD</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };
  
  // Mobile region tabs
  const regionTabs = ['all', 'East', 'West', 'South', 'Midwest', 'Final Four'];
  
  return (
    <div className={`ncaa-bracket-container ${isCompactMode ? 'compact-mode' : 'expanded-mode'}`}>
      {/* Bracket Controls */}
      <div className="bracket-controls">
        {/* Mode Toggle */}
        <div className="bracket-mode-toggle">
          <button 
            className={`mode-btn ${isCompactMode ? 'active' : ''}`}
            onClick={() => handleModeChange(true)}
          >
            Draft Focus
          </button>
          <button 
            className={`mode-btn ${!isCompactMode ? 'active' : ''}`}
            onClick={() => handleModeChange(false)}
          >
            Full Bracket
          </button>
        </div>
        
        {/* Owner Filter Dropdown */}
        <div className="owner-filter">
          <label className="filter-label">View:</label>
          <select 
            className="owner-select"
            value={selectedOwner}
            onChange={(e) => handleOwnerChange(e.target.value)}
          >
            <option value="all">All Teams</option>
            {owners.map(owner => (
              <option key={owner} value={owner}>{owner}'s Teams</option>
            ))}
          </select>
        </div>
      </div>
      
      {/* Mobile Region Tabs */}
      <div className="region-tabs">
        {regionTabs.map(region => (
          <button
            key={region}
            className={`region-tab ${activeRegion === region ? 'active' : ''}`}
            onClick={() => handleRegionChange(region)}
          >
            {region === 'all' ? 'All' : region}
          </button>
        ))}
      </div>
      
      {/* Desktop Full Bracket View */}
      <div className={`bracket-grid ${activeRegion !== 'all' ? 'mobile-single-region' : ''}`}>
        {(activeRegion === 'all' || activeRegion === 'West') && (
          <RegionBracket region="West" position="top-left" />
        )}
        {(activeRegion === 'all' || activeRegion === 'East') && (
          <RegionBracket region="East" position="top-right" />
        )}
        {(activeRegion === 'all' || activeRegion === 'Final Four') && (
          <FinalFourBracket />
        )}
        {(activeRegion === 'all' || activeRegion === 'South') && (
          <RegionBracket region="South" position="bottom-left" />
        )}
        {(activeRegion === 'all' || activeRegion === 'Midwest') && (
          <RegionBracket region="Midwest" position="bottom-right" />
        )}
      </div>
      
      {/* Legend */}
      <div className="bracket-legend">
        <div className="legend-item">
          <span className="legend-color" style={{ backgroundColor: '#22c55e' }}></span>
          <span>Winner</span>
        </div>
        <div className="legend-item">
          <span className="legend-strikethrough">Team Name</span>
          <span>Eliminated</span>
        </div>
        <div className="legend-item">
          <span className="legend-owner">DM</span>
          <span>Owner</span>
        </div>
      </div>
    </div>
  );
};

export default NCAABracket;
