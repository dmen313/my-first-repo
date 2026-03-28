import React, { useState, useEffect, useMemo, useCallback } from 'react';
import NCAABracket from './NCAABracket';
import NCAADraftTable from './NCAADraftTable';
import { 
  getTeams, 
  getDraftPicks, 
  updateDraftPick, 
  updateTeam,
  makeDraftPickAtomic,
  getDraftStatus,
  getNcaaTourneyGames,
  updateNcaaTourneyGame,
  updateAllTeamPoints,
  createActivityLog,
  getLeagueSettings,
  updateLeagueSettings
} from '../services/dynamoDBService';
import './NCAADraftSection.css';

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

const NCAADraftSection = ({ leagueId, onBack }) => {
  const [teams, setTeams] = useState([]);
  const [draftPicks, setDraftPicks] = useState([]);
  const [games, setGames] = useState([]);
  const [draftStatus, setDraftStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState(null); // { message, type } for temporary notifications
  const [currentView, setCurrentView] = useState('bracket'); // 'bracket', 'draftTable', 'payout'
  const [draftConfirmation, setDraftConfirmation] = useState(null); // { team, pick } for confirmation modal
  const [isDrafting, setIsDrafting] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [showDraftOrderModal, setShowDraftOrderModal] = useState(false);
  const [editingDraftOrder, setEditingDraftOrder] = useState([]);
  const [leagueSettings, setLeagueSettings] = useState(null);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  
  // Payout data - amount each owner owes, has paid, and winnings (editable)
  const [payoutData, setPayoutData] = useState({
    'DM': { owed: 100, paid: 100, winnings: 0 },
    'MC': { owed: 100, paid: 100, winnings: 0 },
    'KH': { owed: 100, paid: 100, winnings: 0 },
    'TG': { owed: 100, paid: 100, winnings: 0 },
    'JR': { owed: 100, paid: 100, winnings: 0 },
    'BW': { owed: 100, paid: 100, winnings: 0 },
    'AS': { owed: 100, paid: 100, winnings: 0 },
    'RL': { owed: 100, paid: 100, winnings: 0 }
  });
  
  // Payout structure (editable)
  const [payoutStructure, setPayoutStructure] = useState({
    first: 500,
    second: 200,
    third: 100,
    last: 'Shame'
  });
  
  // Parse league ID to get league name and season
  const { league, season } = useMemo(() => {
    // leagueId format: "ncaa-tourney-2025" or "ncaa-tourney-2025-4" (4 owners)
    const parts = leagueId.split('-');
    const seasonPart = parts.find(p => /^\d{4}$/.test(p));
    const leaguePart = parts.slice(0, parts.indexOf(seasonPart)).join('-');
    return {
      league: leaguePart || 'ncaa-tourney',
      season: seasonPart || '2025'
    };
  }, [leagueId]);
  
  // Load all data
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [teamsData, picksData, statusData, gamesData, settingsData] = await Promise.all([
        getTeams(league, season),
        getDraftPicks(league, season),
        getDraftStatus(league, season),
        getNcaaTourneyGames(league, season),
        getLeagueSettings(league, season)
      ]);
      
      setTeams(teamsData || []);
      setDraftPicks(picksData || []);
      setDraftStatus(statusData);
      setGames(gamesData || []);
      setLeagueSettings(settingsData);
    } catch (err) {
      console.error('Error loading NCAA Tourney data:', err);
      setError('Failed to load tournament data');
    } finally {
      setLoading(false);
    }
  }, [league, season]);
  
  useEffect(() => {
    loadData();
  }, [loadData]);
  
  // Show a temporary notification that auto-clears
  const showNotification = useCallback((message, type = 'error') => {
    setNotification({ message, type });
    // Auto-clear after 5 seconds
    setTimeout(() => {
      setNotification(null);
    }, 5000);
  }, []);
  
  // Get unique owners from draft picks (maintains draft order)
  const owners = useMemo(() => {
    const round1Picks = draftPicks
      .filter(pick => pick.round === 1)
      .sort((a, b) => a.pickNumber - b.pickNumber);
    return round1Picks.map(pick => pick.owner);
  }, [draftPicks]);
  
  // Get next pick
  const nextPick = useMemo(() => {
    const unpickedPicks = draftPicks
      .filter(pick => !pick.teamId)
      .sort((a, b) => a.pickNumber - b.pickNumber);
    return unpickedPicks[0] || null;
  }, [draftPicks]);
  
  // Check if a pick can be made
  const canMakePick = useCallback((pick) => {
    if (pick.teamId) return true; // Already picked
    const previousPicks = draftPicks.filter(p => p.pickNumber < pick.pickNumber);
    return previousPicks.every(p => p.teamId); // All previous must be complete
  }, [draftPicks]);
  
  // Handle team selection from draft table
  const handleSelectTeam = async (pick, teamId) => {
    if (!teamId || !pick) return;
    
    try {
      const team = teams.find(t => t.id === teamId);
      if (!team) return;
      
      // Use atomic draft pick to prevent race conditions
      const result = await makeDraftPickAtomic(pick.id, team.id, team.name, pick.owner);
      
      if (!result.success) {
        // Draft pick failed due to race condition - show notification instead of blocking error
        showNotification(result.error, 'error');
        // Reload data to show current state
        await loadData();
        return;
      }
      
      // Log the activity
      await createActivityLog({
        action: 'Draft Pick',
        message: `${pick.owner} drafted ${team.name} (#${team.seed}) with pick #${pick.pickNumber}`,
        status: 'success',
        data: { league, season, pickNumber: pick.pickNumber, teamName: team.name, owner: pick.owner }
      });
      
      // Reload data
      await loadData();
    } catch (err) {
      console.error('Error making draft pick:', err);
      showNotification('Failed to make draft pick. Please try again.', 'error');
    }
  };
  
  // Handle team click from bracket (show confirmation)
  const handleBracketTeamClick = (team) => {
    // Only allow if draft is in progress and team is not already owned
    if (!nextPick || team.owner) return;
    
    // Show confirmation modal
    setDraftConfirmation({ team, pick: nextPick });
  };
  
  // Confirm draft pick from bracket
  const handleConfirmDraft = async () => {
    if (!draftConfirmation) return;
    
    const { team, pick } = draftConfirmation;
    setIsDrafting(true);
    
    try {
      // Use atomic draft pick to prevent race conditions
      const result = await makeDraftPickAtomic(pick.id, team.id, team.name, pick.owner);
      
      if (!result.success) {
        // Draft pick failed due to race condition - show notification instead of blocking error
        showNotification(result.error, 'error');
        setDraftConfirmation(null);
        // Reload data to show current state
        await loadData();
        return;
      }
      
      // Log the activity
      await createActivityLog({
        action: 'Draft Pick',
        message: `${pick.owner} drafted ${team.name} (#${team.seed}) with pick #${pick.pickNumber}`,
        status: 'success',
        data: { league, season, pickNumber: pick.pickNumber, teamName: team.name, owner: pick.owner }
      });
      
      // Close modal and reload data
      setDraftConfirmation(null);
      await loadData();
    } catch (err) {
      console.error('Error making draft pick:', err);
      showNotification('Failed to make draft pick. Please try again.', 'error');
    } finally {
      setIsDrafting(false);
    }
  };
  
  // Cancel draft confirmation
  const handleCancelDraft = () => {
    setDraftConfirmation(null);
  };
  
  // Handle delete last pick
  const handleDeleteLastPick = async () => {
    const picksWithTeams = draftPicks
      .filter(pick => pick.teamId)
      .sort((a, b) => b.pickNumber - a.pickNumber);
    
    const lastPick = picksWithTeams[0];
    if (!lastPick) return;
    
    const confirmed = window.confirm(
      `Are you sure you want to undo pick #${lastPick.pickNumber}?\n\n${lastPick.owner} - ${lastPick.teamName}`
    );
    
    if (!confirmed) return;
    
    try {
      // Clear the team's owner
      if (lastPick.teamId) {
        await updateTeam(lastPick.teamId, {
          owner: null
        });
      }
      
      // Clear the pick
      await updateDraftPick(lastPick.id, {
        teamId: null,
        teamName: null
      });
      
      // Log the activity
      await createActivityLog({
        action: 'Undo Pick',
        message: `Undid pick #${lastPick.pickNumber}: ${lastPick.teamName} (${lastPick.owner})`,
        status: 'info',
        data: { league, season, pickNumber: lastPick.pickNumber, teamName: lastPick.teamName, owner: lastPick.owner }
      });
      
      // Reload data
      await loadData();
    } catch (err) {
      console.error('Error deleting last pick:', err);
      setError('Failed to undo last pick');
    }
  };
  
  // Open draft order modal
  const handleOpenDraftOrderModal = () => {
    setEditingDraftOrder([...owners]);
    setShowDraftOrderModal(true);
  };
  
  // Move owner up in draft order
  const handleMoveUp = (index) => {
    if (index === 0) return;
    const newOrder = [...editingDraftOrder];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    setEditingDraftOrder(newOrder);
  };
  
  // Move owner down in draft order
  const handleMoveDown = (index) => {
    if (index === editingDraftOrder.length - 1) return;
    const newOrder = [...editingDraftOrder];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    setEditingDraftOrder(newOrder);
  };
  
  // Save new draft order
  const handleSaveDraftOrder = async () => {
    setIsSavingOrder(true);
    try {
      // Update league settings with new draft order
      if (leagueSettings?.id) {
        await updateLeagueSettings(leagueSettings.id, {
          draftOrder: editingDraftOrder,
          numberOfOwners: editingDraftOrder.length
        });
      }
      
      // Update all draft picks with new owner assignments (snake draft)
      const numOwners = editingDraftOrder.length;
      for (const pick of draftPicks) {
        const round = Math.ceil(pick.pickNumber / numOwners);
        const posInRound = (pick.pickNumber - 1) % numOwners;
        const order = round % 2 === 0 ? [...editingDraftOrder].reverse() : editingDraftOrder;
        const newOwner = order[posInRound];
        
        if (pick.owner !== newOwner) {
          await updateDraftPick(pick.id, { owner: newOwner });
        }
      }
      
      // Log the activity
      await createActivityLog({
        action: 'Draft Order Changed',
        message: `Draft order updated to: ${editingDraftOrder.join(' → ')}`,
        status: 'info',
        data: { league, season, newOrder: editingDraftOrder }
      });
      
      setShowDraftOrderModal(false);
      await loadData();
    } catch (err) {
      console.error('Error saving draft order:', err);
      setError('Failed to save draft order');
    } finally {
      setIsSavingOrder(false);
    }
  };
  
  // Calculate draft progress
  const draftProgress = useMemo(() => {
    const totalPicks = draftPicks.length;
    const madePicks = draftPicks.filter(p => p.teamId).length;
    return {
      total: totalPicks,
      made: madePicks,
      remaining: totalPicks - madePicks,
      percentage: totalPicks > 0 ? Math.round((madePicks / totalPicks) * 100) : 0
    };
  }, [draftPicks]);
  
  // Check if draft is complete (either all picks made OR draft status set to completed)
  const isDraftComplete = (draftProgress.remaining === 0 && draftProgress.total > 0) || 
                          draftStatus?.status === 'Draft Completed';
  
  // Handle game winner selection (for updating tournament results)
  const handleGameWinnerSelect = async (game, winnerId) => {
    if (!game || !winnerId) return;
    
    try {
      const winningTeam = teams.find(t => t.id === winnerId);
      const losingTeamId = winnerId === game.team1Id ? game.team2Id : game.team1Id;
      const losingTeam = teams.find(t => t.id === losingTeamId);
      
      // Update the game with the winner in the backend
      await updateNcaaTourneyGame(game.id, {
        winnerId: winnerId,
        status: 'completed'
      });
      
      // Mark the losing team as eliminated in the backend
      if (losingTeam) {
        await updateTeam(losingTeamId, {
          eliminated: true
        });
      }
      
      // Prepare next game update data
      let nextGameUpdateData = null;
      let nextGameId = null;
      const nextRound = game.round + 1;
      
      if (nextRound <= 6) {
        let nextGame = null;
        let isTeam1 = false;
        
        if (game.round === 4) {
          // Elite 8 → Final Four: Special mapping by region
          // East & West winners go to Final Four Game 1
          // South & Midwest winners go to Final Four Game 2
          const finalFourGameNum = (game.region === 'East' || game.region === 'West') ? 1 : 2;
          nextGame = games.find(g => 
            g.round === 5 && 
            g.region === 'FinalFour' && 
            g.gameNum === finalFourGameNum
          );
          // East/South winners go to team1 slot, West/Midwest winners go to team2 slot
          isTeam1 = (game.region === 'East' || game.region === 'South');
        } else if (game.round === 5) {
          // Final Four → Championship
          nextGame = games.find(g => 
            g.round === 6 && 
            g.region === 'Championship'
          );
          // Game 1 winner goes to team1 slot, Game 2 winner goes to team2 slot
          isTeam1 = game.gameNum === 1;
        } else {
          // Rounds 1-3: Standard bracket logic within region
          const nextGameNum = Math.ceil(game.gameNum / 2);
          nextGame = games.find(g => 
            g.round === nextRound && 
            g.region === game.region && 
            g.gameNum === nextGameNum
          );
          isTeam1 = game.gameNum % 2 === 1;
        }
        
        if (nextGame) {
          nextGameUpdateData = isTeam1 
            ? { team1Id: winnerId, team1Seed: winningTeam?.seed }
            : { team2Id: winnerId, team2Seed: winningTeam?.seed };
          nextGameId = nextGame.id;
          
          await updateNcaaTourneyGame(nextGame.id, nextGameUpdateData);
        }
      }
      
      // Note: Points recalculation moved to manual "Recalc Points" button for performance
      
      // Log the activity (fire and forget - don't wait)
      createActivityLog({
        action: 'Tournament Result',
        message: `${winningTeam?.name || 'Unknown'} defeats ${losingTeam?.name || 'Unknown'} in Round ${game.round}`,
        status: 'success',
        data: { league, season, round: game.round, winnerId, gameId: game.id }
      });
      
      // Update local state directly instead of reloading (preserves scroll position)
      // Update games state
      setGames(prevGames => prevGames.map(g => {
        if (g.id === game.id) {
          return { ...g, winnerId, status: 'completed' };
        }
        if (nextGameId && g.id === nextGameId && nextGameUpdateData) {
          return { ...g, ...nextGameUpdateData };
        }
        return g;
      }));
      
      // Update teams state (mark loser as eliminated)
      if (losingTeamId) {
        setTeams(prevTeams => prevTeams.map(t => 
          t.id === losingTeamId ? { ...t, eliminated: true } : t
        ));
      }
      
    } catch (err) {
      console.error('Error updating game winner:', err);
      setError('Failed to update game result');
    }
  };
  
  // Manual recalculation of all team points
  const handleRecalcPoints = async () => {
    try {
      setIsRecalculating(true);
      console.log('Manually recalculating points for all teams...');
      
      const updatedTeams = await updateAllTeamPoints(league, season);
      console.log(`Updated points for ${updatedTeams.length} teams`);
      
      // Update local state directly instead of full reload
      if (updatedTeams.length > 0) {
        const updatedMap = new Map(updatedTeams.map(t => [t.id, t]));
        setTeams(prevTeams => prevTeams.map(t => updatedMap.get(t.id) || t));
      }
      
      // Fire-and-forget activity log
      createActivityLog({
        action: 'Points Recalculated',
        message: `Manually recalculated points for ${updatedTeams.length} teams`,
        status: 'success',
        data: { league, season, teamsUpdated: updatedTeams.length }
      });
    } catch (err) {
      console.error('Error recalculating points:', err);
      setError('Failed to recalculate points');
    } finally {
      setIsRecalculating(false);
    }
  };
  
  // Calculate leaderboard
  const leaderboard = useMemo(() => {
    const ownerScores = owners.map(owner => {
      const ownerPicks = draftPicks.filter(p => p.owner === owner && p.teamId);
      let totalPoints = 0;
      let activeTeams = 0;
      let eliminatedTeams = 0;
      
      ownerPicks.forEach(pick => {
        const team = teams.find(t => t.id === pick.teamId);
        if (team) {
          if (team.totalPoints) {
            totalPoints += team.totalPoints;
          }
          if (team.eliminated) {
            eliminatedTeams++;
          } else {
            activeTeams++;
          }
        }
      });
      
      return { 
        owner, 
        points: totalPoints, 
        picks: ownerPicks.length,
        activeTeams,
        eliminatedTeams
      };
    });
    
    return ownerScores.sort((a, b) => b.points - a.points);
  }, [owners, draftPicks, teams]);
  
  // Calculate payout table data with net amounts
  // Net = winnings - owed (paid doesn't affect net, it's just tracking payment status)
  const payoutTable = useMemo(() => {
    return owners.map(owner => {
      const data = payoutData[owner] || { owed: 0, paid: 0, winnings: 0 };
      return {
        owner,
        owed: data.owed,
        paid: data.paid,
        winnings: data.winnings,
        net: data.winnings - data.owed
      };
    });
  }, [owners, payoutData]);
  
  // Handler for updating individual payout data
  const handlePayoutChange = (owner, field, value) => {
    const numValue = value === '' ? 0 : parseInt(value, 10) || 0;
    setPayoutData(prev => ({
      ...prev,
      [owner]: {
        ...prev[owner],
        [field]: numValue
      }
    }));
  };
  
  // Handler for updating payout structure
  const handleStructureChange = (field, value) => {
    if (field === 'last') {
      setPayoutStructure(prev => ({ ...prev, [field]: value }));
    } else {
      const numValue = value === '' ? 0 : parseInt(value, 10) || 0;
      setPayoutStructure(prev => ({ ...prev, [field]: numValue }));
    }
  };
  
  // Calculate pool total
  const poolTotal = useMemo(() => {
    return Object.values(payoutData).reduce((sum, data) => sum + data.owed, 0);
  }, [payoutData]);
  
  if (loading) {
    return (
      <div className="ncaa-draft-section">
        <div className="loading-state">Loading NCAA Tournament data...</div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="ncaa-draft-section">
        <div className="error-state">
          <p>{error}</p>
          <button onClick={loadData} className="retry-btn">Retry</button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="ncaa-draft-section">
      {/* Notification Toast */}
      {notification && (
        <div className={`notification-toast notification-${notification.type}`}>
          <span className="notification-message">{notification.message}</span>
          <button 
            className="notification-dismiss" 
            onClick={() => setNotification(null)}
            aria-label="Dismiss notification"
          >
            ×
          </button>
        </div>
      )}
      
      {/* Header */}
      <div className="draft-header-card">
        <div className="header-left">
          {onBack && (
            <button onClick={onBack} className="back-btn">
              <span className="back-icon">←</span>
            </button>
          )}
          <div className="header-info">
            <img 
              className="league-logo" 
              src="/logos/NCAA_logo.svg.png" 
              alt="NCAA logo" 
            />
            <div className="league-details">
              <div className="league-title-row">
                <h1>NCAA Tournament</h1>
                <span className="year-chip">{season}</span>
                <span className="sport-chip" style={{ backgroundColor: '#7c3aed' }}>MARCH</span>
              </div>
              <span className="league-subtitle">March Madness Bracket Draft</span>
            </div>
          </div>
        </div>
        <div className="header-right">
          <div className="status-badge">{draftStatus?.status || 'Draft In Progress'}</div>
          <div className="progress-info">
            <span>{draftProgress.made}/{draftProgress.total} picks</span>
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${draftProgress.percentage}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Next Pick Banner */}
      {!isDraftComplete && nextPick && (
        <div className="next-pick-banner">
          <div className="next-pick-info">
            <span className="next-label">Next Pick:</span>
            <span 
              className="next-owner"
              style={{ color: OWNER_COLORS[nextPick.owner] || '#f3f4f6' }}
            >
              {nextPick.owner}
            </span>
            <span className="next-pick-number">Pick #{nextPick.pickNumber}</span>
            <span className="next-round">Round {nextPick.round}</span>
          </div>
          <button 
            className="undo-btn"
            onClick={handleDeleteLastPick}
            disabled={draftProgress.made === 0}
          >
            Undo Last
          </button>
        </div>
      )}
      
      {/* Leaderboard Ticker */}
      <div className="leaderboard-ticker-container">
        <div className="leaderboard-ticker">
          <div className="ticker-content">
            {/* Duplicate content for seamless loop */}
            {[...leaderboard, ...leaderboard].map((entry, idx) => {
              const rank = idx % leaderboard.length;
              const isLastPlace = rank === leaderboard.length - 1;
              const getPlacementEmoji = () => {
                if (rank === 0) return '👑';
                if (rank === 1) return '🥈';
                if (rank === 2) return '🥉';
                if (isLastPlace) return '🤮';
                return '';
              };
              return (
                <React.Fragment key={idx}>
                  <span 
                    className="ticker-item"
                    style={{ color: OWNER_COLORS[entry.owner] || '#f3f4f6' }}
                  >
                    <span className="ticker-emoji">{getPlacementEmoji()}</span>
                    <span className="ticker-rank">#{rank + 1}</span>
                    <span className="ticker-owner">{entry.owner}</span>
                    <span className="ticker-points">{entry.points} pts</span>
                    <span className="ticker-active">({entry.activeTeams} active)</span>
                    {!isLastPlace && <span className="ticker-divider">•</span>}
                  </span>
                  {isLastPlace && (
                    <span className="ticker-separator">
                      <span className="separator-line"></span>
                      <span className="separator-icon">🏀</span>
                      <span className="separator-line"></span>
                    </span>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>
      
      {/* Toggle Bracket/Table/Payout */}
      <div className="view-toggle">
        <button 
          className={`toggle-btn ${currentView === 'bracket' ? 'active' : ''}`}
          onClick={() => setCurrentView('bracket')}
        >
          Bracket View
        </button>
        <button 
          className={`toggle-btn ${currentView === 'draftTable' ? 'active' : ''}`}
          onClick={() => setCurrentView('draftTable')}
        >
          Draft Table
        </button>
        <button 
          className={`toggle-btn ${currentView === 'payout' ? 'active' : ''}`}
          onClick={() => setCurrentView('payout')}
        >
          💰 Payout
        </button>
        {isDraftComplete && (
          <button 
            className={`recalc-btn ${isRecalculating ? 'loading' : ''}`}
            onClick={handleRecalcPoints}
            disabled={isRecalculating}
            title="Recalculate all team points based on game results"
          >
            {isRecalculating ? 'Recalculating...' : 'Recalc Points'}
          </button>
        )}
        {draftProgress.made === 0 && owners.length > 0 && (
          <button 
            className="draft-order-btn"
            onClick={handleOpenDraftOrderModal}
            title="Adjust the draft order before picks are made"
          >
            ⚙️ Draft Order
          </button>
        )}
      </div>
      
      {/* Bracket, Draft Table, or Payout */}
      {currentView === 'bracket' && (
        <NCAABracket 
          teams={teams} 
          games={games}
          onTeamClick={handleBracketTeamClick}
          onGameWinnerSelect={handleGameWinnerSelect}
          isDraftInProgress={!isDraftComplete && nextPick !== null}
          isDraftComplete={isDraftComplete}
          nextPick={nextPick}
          owners={owners}
          leagueId={leagueId}
        />
      )}
      {currentView === 'draftTable' && (
        <NCAADraftTable 
          draftPicks={draftPicks}
          teams={teams}
          owners={owners}
          onSelectTeam={handleSelectTeam}
          canMakePick={canMakePick}
          disabled={isDraftComplete}
        />
      )}
      {currentView === 'payout' && (
        <div className="payout-section">
          <div className="payout-header">
            <h2>💰 Payout Summary</h2>
            <p className="payout-subtitle">
              Pool Total: ${poolTotal} | 
              First: ${payoutStructure.first} | 
              Second: ${payoutStructure.second} | 
              Third: ${payoutStructure.third} | 
              Last: {payoutStructure.last}
            </p>
          </div>
          <div className="payout-table-container">
            <table className="payout-table">
              <thead>
                <tr>
                  <th>Owner</th>
                  <th>Owed</th>
                  <th>Paid</th>
                  <th>Winnings</th>
                  <th>Net</th>
                </tr>
              </thead>
              <tbody>
                {payoutTable.map((row, idx) => (
                  <tr key={row.owner} className={idx === 0 ? 'first-place' : idx === payoutTable.length - 1 ? 'last-place' : ''}>
                    <td className="owner-cell">
                      <span 
                        className="owner-badge"
                        style={{ 
                          backgroundColor: `${OWNER_COLORS[row.owner]}20`,
                          color: OWNER_COLORS[row.owner],
                          borderColor: OWNER_COLORS[row.owner]
                        }}
                      >
                        {row.owner}
                      </span>
                    </td>
                    <td className="amount-cell editable">
                      <span className="currency-prefix">$</span>
                      <input
                        type="number"
                        value={row.owed}
                        onChange={(e) => handlePayoutChange(row.owner, 'owed', e.target.value)}
                        className="payout-input"
                      />
                    </td>
                    <td className={`amount-cell editable ${row.paid >= row.owed ? 'paid-full' : 'paid-partial'}`}>
                      <span className="currency-prefix">$</span>
                      <input
                        type="number"
                        value={row.paid}
                        onChange={(e) => handlePayoutChange(row.owner, 'paid', e.target.value)}
                        className="payout-input"
                      />
                      {row.paid >= row.owed && <span className="check-mark">✓</span>}
                    </td>
                    <td className={`amount-cell editable winnings ${row.winnings > 0 ? 'has-winnings' : ''}`}>
                      <span className="currency-prefix">$</span>
                      <input
                        type="number"
                        value={row.winnings}
                        onChange={(e) => handlePayoutChange(row.owner, 'winnings', e.target.value)}
                        className="payout-input"
                      />
                    </td>
                    <td className={`amount-cell net ${row.net > 0 ? 'positive' : row.net < 0 ? 'negative' : 'neutral'}`}>
                      {row.net >= 0 ? '+' : ''}{row.net > 0 ? `$${row.net}` : row.net < 0 ? `-$${Math.abs(row.net)}` : '$0'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total</td>
                  <td>${payoutTable.reduce((sum, r) => sum + r.owed, 0)}</td>
                  <td>${payoutTable.reduce((sum, r) => sum + r.paid, 0)}</td>
                  <td>${payoutTable.reduce((sum, r) => sum + r.winnings, 0)}</td>
                  <td>-</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="payout-notes">
            <h3>Payout Structure</h3>
            <div className="payout-structure">
              <div className="payout-item gold">
                <span className="place-emoji">🥇</span>
                <span className="place-label">1st Place</span>
                <div className="place-amount editable">
                  <span className="currency-prefix">$</span>
                  <input
                    type="number"
                    value={payoutStructure.first}
                    onChange={(e) => handleStructureChange('first', e.target.value)}
                    className="structure-input"
                  />
                </div>
              </div>
              <div className="payout-item silver">
                <span className="place-emoji">🥈</span>
                <span className="place-label">2nd Place</span>
                <div className="place-amount editable">
                  <span className="currency-prefix">$</span>
                  <input
                    type="number"
                    value={payoutStructure.second}
                    onChange={(e) => handleStructureChange('second', e.target.value)}
                    className="structure-input"
                  />
                </div>
              </div>
              <div className="payout-item bronze">
                <span className="place-emoji">🥉</span>
                <span className="place-label">3rd Place</span>
                <div className="place-amount editable">
                  <span className="currency-prefix">$</span>
                  <input
                    type="number"
                    value={payoutStructure.third}
                    onChange={(e) => handleStructureChange('third', e.target.value)}
                    className="structure-input"
                  />
                </div>
              </div>
              <div className="payout-item last">
                <span className="place-emoji">🤮</span>
                <span className="place-label">Last Place</span>
                <div className="place-amount editable last-input">
                  <input
                    type="text"
                    value={payoutStructure.last}
                    onChange={(e) => handleStructureChange('last', e.target.value)}
                    className="structure-input text"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Draft Complete Message */}
      {isDraftComplete && (
        <div className="draft-complete-banner">
          <span className="complete-icon">🏆</span>
          <span>Draft Complete! Good luck in the tournament!</span>
        </div>
      )}
      
      {/* Draft Confirmation Modal */}
      {draftConfirmation && (
        <div className="draft-modal-overlay" onClick={handleCancelDraft}>
          <div className="draft-modal" onClick={(e) => e.stopPropagation()}>
            <div className="draft-modal-header">
              <h3>Confirm Draft Pick</h3>
            </div>
            <div className="draft-modal-body">
              <p className="draft-modal-question">
                Draft this team for <strong style={{ color: OWNER_COLORS[draftConfirmation.pick.owner] || '#f3f4f6' }}>{draftConfirmation.pick.owner}</strong>?
              </p>
              <div className="draft-modal-team">
                <span className="modal-team-seed">#{draftConfirmation.team.seed}</span>
                <span className="modal-team-name">{draftConfirmation.team.name}</span>
                <span className="modal-team-odds">{draftConfirmation.team.odds}</span>
              </div>
              <div className="draft-modal-pick-info">
                <span>Pick #{draftConfirmation.pick.pickNumber}</span>
                <span>Round {draftConfirmation.pick.round}</span>
              </div>
            </div>
            <div className="draft-modal-footer">
              <button 
                className="modal-cancel-btn"
                onClick={handleCancelDraft}
                disabled={isDrafting}
              >
                Cancel
              </button>
              <button 
                className="modal-confirm-btn"
                onClick={handleConfirmDraft}
                disabled={isDrafting}
              >
                {isDrafting ? 'Drafting...' : 'Confirm Draft'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Draft Order Modal */}
      {showDraftOrderModal && (
        <div className="draft-modal-overlay" onClick={() => setShowDraftOrderModal(false)}>
          <div className="draft-modal draft-order-modal" onClick={(e) => e.stopPropagation()}>
            <div className="draft-modal-header">
              <h3>⚙️ Adjust Draft Order</h3>
            </div>
            <div className="draft-modal-body">
              <p className="draft-order-description">
                Drag or use arrows to reorder. Snake draft format: odd rounds go down, even rounds go up.
              </p>
              <div className="draft-order-list">
                {editingDraftOrder.map((owner, index) => (
                  <div 
                    key={owner} 
                    className="draft-order-item"
                    style={{ borderLeftColor: OWNER_COLORS[owner] || '#6b7280' }}
                  >
                    <span className="order-number">{index + 1}</span>
                    <span 
                      className="order-owner"
                      style={{ color: OWNER_COLORS[owner] || '#f3f4f6' }}
                    >
                      {owner}
                    </span>
                    <div className="order-actions">
                      <button 
                        className="order-btn"
                        onClick={() => handleMoveUp(index)}
                        disabled={index === 0 || isSavingOrder}
                      >
                        ▲
                      </button>
                      <button 
                        className="order-btn"
                        onClick={() => handleMoveDown(index)}
                        disabled={index === editingDraftOrder.length - 1 || isSavingOrder}
                      >
                        ▼
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="draft-order-preview">
                <span className="preview-label">Round 1:</span>
                <span className="preview-order">{editingDraftOrder.join(' → ')}</span>
              </div>
              <div className="draft-order-preview">
                <span className="preview-label">Round 2:</span>
                <span className="preview-order">{[...editingDraftOrder].reverse().join(' → ')}</span>
              </div>
            </div>
            <div className="draft-modal-footer">
              <button 
                className="modal-cancel-btn"
                onClick={() => setShowDraftOrderModal(false)}
                disabled={isSavingOrder}
              >
                Cancel
              </button>
              <button 
                className="modal-confirm-btn"
                onClick={handleSaveDraftOrder}
                disabled={isSavingOrder}
              >
                {isSavingOrder ? 'Saving...' : 'Save Order'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NCAADraftSection;
