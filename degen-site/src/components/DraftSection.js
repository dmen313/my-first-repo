import React, { useState, useEffect, useCallback } from 'react';
import { useMutation } from '@apollo/client';
import { USE_DIRECT_DYNAMODB } from '../config/dataSource';
import { useDraft as useDraftGraphQL } from '../hooks/useDraft';
import { useDraft as useDraftDynamoDB } from '../hooks/useDraftDynamoDB';
import { useTeams } from '../hooks/useGraphQL';
import { UPDATE_TEAM } from '../graphql/client';
import DraftOrderEditor from './DraftOrderEditor';
import activityLogService from '../services/activityLogService';
import './DraftSection.css';

const useDraft = USE_DIRECT_DYNAMODB ? useDraftDynamoDB : useDraftGraphQL;

// League metadata for display
const LEAGUE_METADATA = {
  'nfl': { name: 'National Football League', abbreviation: 'NFL', logo: '/logos/nfl.png', color: '#059669' },
  'mlb': { name: 'Major League Baseball', abbreviation: 'MLB', logo: '/logos/mlb_png.png', color: '#1e3a8a' },
  'nba': { name: 'National Basketball Association', abbreviation: 'NBA', logo: '/logos/nba.svg', color: '#dc2626' },
  'ncaa': { name: 'NCAA Football', abbreviation: 'NCAA', logo: '/logos/NCAA_logo.svg.png', color: '#7c2d12' },
  'nhl': { name: 'National Hockey League', abbreviation: 'NHL', logo: '/logos/nhl.png', color: '#0ea5e9' },
  'nfl-mvp': { name: 'NFL Awards', abbreviation: 'MVP', logo: '/logos/nfl.png', color: '#1d4ed8' }
};

const DraftSection = ({ league, season }) => {
  console.log('🎯 DraftSection rendering with:', { league, season });
  
  // Get league metadata for display
  const leagueInfo = LEAGUE_METADATA[league] || { name: league.toUpperCase(), abbreviation: league.toUpperCase(), logo: '', color: '#6b7280' };
  const currentYear = new Date().getFullYear();
  const yearNum = parseInt(season);
  const yearClass = yearNum < currentYear ? 'year-past' : yearNum === currentYear ? 'year-current' : 'year-future';
  
  const [staticOwners] = useState(['DM', 'TG', 'KH', 'MC']); // Keep original for initialization
  const [isInitialized, setIsInitialized] = useState(false);
  const [showDraftOrderEditor, setShowDraftOrderEditor] = useState(false);
  const [lastPickCount, setLastPickCount] = useState(0);
  const [notification, setNotification] = useState(null);
  
  const { 
    draftPicks, 
    loading, 
    error, 
    initializeDraft, 
    updateDraftPick,
    getDraftRounds,
    getNextPick,
    isTeamDrafted,
    refetch 
  } = useDraft(league, season);
  
  console.log('📊 DraftSection hooks state:', { 
    draftPicksCount: draftPicks?.length || 0, 
    loading, 
    error: error?.message,
    hasDraftPicks: !!draftPicks
  });

  const { teams: allTeams, loading: teamsLoading, error: teamsError } = useTeams(league, season);
  
  console.log('📊 DraftSection teams state:', { 
    allTeamsCount: allTeams?.length || 0, 
    teamsLoading, 
    teamsError: teamsError?.message,
    hasAllTeams: !!allTeams
  });
  
  // Always call useMutation hook (React hooks must be called unconditionally)
  // But only use it when not using DynamoDB
  const [updateTeamMutation] = useMutation(UPDATE_TEAM, { skip: USE_DIRECT_DYNAMODB });
  
  const updateTeam = useCallback(async (id, updateData) => {
    if (USE_DIRECT_DYNAMODB) {
      const { updateTeam: updateTeamFn } = await import('../services/dynamoDBService');
      return updateTeamFn(id, updateData);
    }

    const { data } = await updateTeamMutation({ variables: { input: { id, ...updateData } } });
    return data.updateTeam;
  }, [updateTeamMutation]);

  // Initialize draft if not already done (only if no draft picks exist)
  useEffect(() => {
    const initializeDraftIfNeeded = async () => {
      if (!loading && !isInitialized && draftPicks.length === 0) {
        try {
          await initializeDraft(staticOwners);
          setIsInitialized(true);
        } catch (err) {
          console.error('Error initializing draft:', err);
        }
      } else if (!loading && draftPicks.length > 0) {
        setIsInitialized(true);
      }
    };

    initializeDraftIfNeeded();
  }, [loading, isInitialized, initializeDraft, staticOwners, draftPicks.length]);

  // Initialize lastPickCount when draft picks are first loaded or when picks change
  useEffect(() => {
    if (draftPicks && Array.isArray(draftPicks)) {
      const picksWithTeams = draftPicks.filter(pick => pick.teamId).length;
      // Only update if we haven't initialized yet, or if picks decreased (deletion case)
      if (lastPickCount === 0 || picksWithTeams < lastPickCount) {
        setLastPickCount(picksWithTeams);
      }
    }
  }, [draftPicks, lastPickCount]);

  // Poll for new picks every 30 seconds
  useEffect(() => {
    if (!league || !season || loading) {
      return;
    }

    const pollInterval = setInterval(async () => {
      try {
        console.log('🔄 Polling for new draft picks...');
        const updatedPicks = await refetch();
        
        if (updatedPicks && Array.isArray(updatedPicks)) {
          const currentPickCount = updatedPicks.filter(pick => pick.teamId).length;
          
          // Check if a new pick was made
          if (currentPickCount > lastPickCount) {
            const newPicks = updatedPicks
              .filter(pick => pick.teamId)
              .slice(lastPickCount); // Get only the new picks
            
            if (newPicks.length > 0) {
              const latestPick = newPicks[newPicks.length - 1];
              const pickMessage = `${latestPick.owner} selected ${latestPick.teamName || 'a team'} (Round ${latestPick.round}, Pick #${latestPick.pickNumber})`;
              
              console.log('🎉 New pick detected:', pickMessage);
              
              // Show browser notification if permission granted
              if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('Draft Pick Made! 🏀', {
                  body: pickMessage,
                  icon: '/favicon.ico',
                  tag: 'draft-pick'
                });
              } else if ('Notification' in window && Notification.permission !== 'denied') {
                // Request permission for notifications
                Notification.requestPermission().then(permission => {
                  if (permission === 'granted') {
                    new Notification('Draft Pick Made! 🏀', {
                      body: pickMessage,
                      icon: '/favicon.ico',
                      tag: 'draft-pick'
                    });
                  }
                });
              }
              
              // Show in-app notification
              setNotification({
                message: pickMessage,
                owner: latestPick.owner,
                timestamp: Date.now()
              });
              
              // Auto-hide notification after 5 seconds
              setTimeout(() => {
                setNotification(null);
              }, 5000);
              
              // Update lastPickCount
              setLastPickCount(currentPickCount);
            }
          }
        }
      } catch (err) {
        console.error('Error polling for new picks:', err);
      }
    }, 300000); // Poll every 5 minutes (reduced from 30s to prevent page reloads)

    // Cleanup interval on unmount
    return () => {
      clearInterval(pollInterval);
    };
  }, [league, season, loading, refetch, lastPickCount]);

  // Handle team selection for a draft pick
  const handleTeamSelection = useCallback(async (pickId, teamId, teamName) => {
    try {
      // Update the draft pick
      await updateDraftPick(pickId, { teamId, teamName });
      
      // Update the team's owner in the main team table
      const pick = draftPicks.find(p => p.id === pickId);
      if (pick && teamId) {
        await updateTeam(teamId, { owner: pick.owner });
        
      // Log the action (async, don't await - fire and forget)
      activityLogService.log('Make Draft Pick', {
        message: `${pick.owner} selected ${teamName} (Round ${pick.round}, Pick #${pick.pickNumber})`,
        data: {
          owner: pick.owner,
          teamName,
          round: pick.round,
          pickNumber: pick.pickNumber,
          league,
          season
        },
        status: 'success'
      }).catch(err => console.error('Failed to log activity:', err));
      }
      
      // Refetch to ensure UI is updated
      const updatedPicks = await refetch();
      
      // Update lastPickCount to prevent duplicate notifications
      if (updatedPicks && Array.isArray(updatedPicks)) {
        const currentPickCount = updatedPicks.filter(p => p.teamId).length;
        setLastPickCount(currentPickCount);
      }
    } catch (err) {
      console.error('Error updating draft pick:', err);
      activityLogService.log('Make Draft Pick', {
        message: `Failed to make draft pick: ${err.message}`,
        data: { error: err.message, league, season },
        status: 'error'
      }).catch(logErr => console.error('Failed to log activity:', logErr));
    }
  }, [updateDraftPick, updateTeam, draftPicks, refetch, league, season]);

  // Handle deleting the last pick
  const handleDeleteLastPick = useCallback(async () => {
    try {
      // Find the last pick (highest pickNumber with a teamId)
      const picksWithTeams = draftPicks
        .filter(pick => pick.teamId)
        .sort((a, b) => b.pickNumber - a.pickNumber);
      
      if (picksWithTeams.length === 0) {
        alert('No picks have been made yet.');
        activityLogService.log('Delete Last Pick', {
          message: 'Attempted to delete last pick but no picks were found',
          data: { league, season },
          status: 'info'
        }).catch(err => console.error('Failed to log activity:', err));
        return;
      }
      
      const lastPick = picksWithTeams[0];
      
      // Confirm deletion
      const confirmed = window.confirm(
        `Are you sure you want to delete the last pick?\n\n` +
        `Round ${lastPick.round}, Pick #${lastPick.pickNumber}\n` +
        `Owner: ${lastPick.owner}\n` +
        `Team: ${lastPick.teamName || 'N/A'}\n\n` +
        `This will allow ${lastPick.owner} to pick again.`
      );
      
      if (!confirmed) {
        return;
      }
      
      // Clear the team's owner if it was set
      if (lastPick.teamId) {
        await updateTeam(lastPick.teamId, { owner: null });
      }
      
      // Clear the pick's team selection (don't delete the pick record)
      // This makes the pick available again for the same user
      await updateDraftPick(lastPick.id, { 
        teamId: null, 
        teamName: null 
      });
      
      // Log the action (async, don't await - fire and forget)
      activityLogService.log('Delete Last Pick', {
        message: `Deleted last pick: ${lastPick.owner}'s selection of ${lastPick.teamName} (Round ${lastPick.round}, Pick #${lastPick.pickNumber})`,
        data: {
          owner: lastPick.owner,
          teamName: lastPick.teamName,
          round: lastPick.round,
          pickNumber: lastPick.pickNumber,
          league,
          season
        },
        status: 'success'
      }).catch(err => console.error('Failed to log activity:', err));
      
      // Refetch to ensure UI is updated
      refetch();
    } catch (err) {
      console.error('Error deleting last pick:', err);
      alert('Error deleting last pick: ' + (err.message || 'Unknown error'));
      activityLogService.log('Delete Last Pick', {
        message: `Failed to delete last pick: ${err.message}`,
        data: { error: err.message, league, season },
        status: 'error'
      }).catch(logErr => console.error('Failed to log activity:', logErr));
    }
  }, [updateDraftPick, draftPicks, updateTeam, refetch, league, season]);

  // Get available teams (not yet drafted and without owners), sorted by odds descending
  const getAvailableTeams = useCallback(() => {
    if (!allTeams || !Array.isArray(allTeams)) {
      console.warn('⚠️ No teams available or not an array:', allTeams);
      return [];
    }
    
    if (allTeams.length === 0) {
      console.warn(`⚠️ No teams found for league=${league}, season=${season}`);
      return [];
    }
    
    const availableTeams = allTeams.filter(team => {
      const isDrafted = isTeamDrafted(team.id);
      // Only filter out teams that have been drafted through the draft system
      // Don't filter by owner, since drafting will assign the owner anyway
      return !isDrafted;
    });
    
    // Sort by odds (descending - best odds first)
    const sortedTeams = availableTeams.sort((a, b) => {
      const oddsA = parseFloat(a.odds?.replace('+', '') || '999999');
      const oddsB = parseFloat(b.odds?.replace('+', '') || '999999');
      return oddsA - oddsB; // Lower odds number = better odds = higher in list
    });
    
    return sortedTeams;
  }, [allTeams, isTeamDrafted, league, season]);

  // Get draft rounds organized for display
  const draftRounds = getDraftRounds();
  const nextPick = getNextPick();
  
  // Check if draft is complete (all picks have teams assigned)
  const isDraftComplete = draftPicks.length > 0 && draftPicks.every(pick => pick.teamId);

  // Check if a pick can be made (all previous picks must be completed)
  const canMakePick = useCallback((pick) => {
    if (!pick || !draftPicks || draftPicks.length === 0) {
      return false;
    }

    // If this pick already has a team, it's already been made (can't change it)
    if (pick.teamId) {
      return true; // Already picked, so it's in a "valid" state
    }

    // Check if all previous picks have been completed
    // Get all picks that come before this one (lower pickNumber)
    const previousPicks = draftPicks.filter(p => p.pickNumber < pick.pickNumber);
    
    // If there are no previous picks, this is the first pick - allow it
    if (previousPicks.length === 0) {
      return true;
    }
    
    // Check if ALL previous picks have been completed (have a teamId)
    const allPreviousPicked = previousPicks.every(p => p.teamId);
    
    return allPreviousPicked;
  }, [draftPicks]);
  
  // Dynamically determine owner order based on draft picks (Round 1 order)
  const owners = React.useMemo(() => {
    if (draftPicks.length === 0) {
      return staticOwners; // Fallback to static order if no draft picks
    }
    
    // Get Round 1 picks and sort by pick number to determine draft order
    const round1Picks = draftPicks
      .filter(pick => pick.round === 1)
      .sort((a, b) => a.pickNumber - b.pickNumber);
    
    if (round1Picks.length === 0) {
      return staticOwners; // Fallback if no Round 1 picks found
    }
    
    // Extract owner order from Round 1 picks
    const dynamicOwners = round1Picks.map(pick => pick.owner);
    
    // Ensure all static owners are included (in case of partial draft)
    const allOwners = [...new Set([...dynamicOwners, ...staticOwners])];
    
    return allOwners;
  }, [draftPicks, staticOwners]);
  
  // Check if any teams have been drafted (to determine if edit button should be shown)
  const hasDraftedTeams = draftPicks.some(pick => pick.teamId);
  
  // Check if there are any picks with teams selected (for delete button)
  const hasPicksToDelete = draftPicks.some(pick => pick.teamId);
  
  // Debug logging
  console.log('🔍 DraftSection Debug:', {
    draftPicksCount: draftPicks.length,
    hasDraftedTeams,
    hasPicksToDelete,
    picksWithTeams: draftPicks.filter(pick => pick.teamId).length
  });
  
  // Handle draft order editor
  const handleEditDraftOrder = useCallback(() => {
    setShowDraftOrderEditor(true);
  }, []);
  
  const handleCloseDraftOrderEditor = useCallback(() => {
    setShowDraftOrderEditor(false);
  }, []);
  
  const handleSaveDraftOrder = useCallback(async (newDraftPicks) => {
    try {
      // Force a fresh refetch from the server (ignore cache)
      await refetch();
      
      setShowDraftOrderEditor(false);
    } catch (error) {
      console.error('❌ Error refreshing draft order UI:', error);
      setShowDraftOrderEditor(false);
    }
  }, [refetch]);

  if (loading || teamsLoading || !allTeams) {
    console.log('⏸️ DraftSection early return: loading state', { loading, teamsLoading, allTeams: !!allTeams });
    return (
      <div className="draft-section">
        <h2>Draft</h2>
        <div className="loading">Loading draft and teams...</div>
      </div>
    );
  }

  if (error) {
    console.log('❌ DraftSection early return: error', error);
    return (
      <div className="draft-section">
        <h2>Draft</h2>
        <div className="error">Error loading draft: {error.message}</div>
      </div>
    );
  }

  if (teamsError) {
    console.log('❌ DraftSection early return: teamsError', teamsError);
    return (
      <div className="draft-section">
        <h2>Draft</h2>
        <div className="error">Error loading teams: {teamsError.message}</div>
      </div>
    );
  }
  
  console.log('✅ DraftSection rendering main content');

  console.log('🎨 DraftSection rendering buttons:', { hasDraftedTeams, hasPicksToDelete });
  
  return (
    <div className="draft-section">
      {/* League Header Card - matches home page aesthetic */}
      <div className="draft-league-card" style={{ borderLeftColor: leagueInfo.color }}>
        <div className="draft-league-header-row">
          {leagueInfo.logo && (
            <img 
              className={`draft-league-logo ${league === 'mlb' ? 'draft-league-logo-mlb' : ''}`} 
              src={leagueInfo.logo} 
              alt={`${leagueInfo.abbreviation} logo`} 
            />
          )}
          <span className="draft-league-chip" style={{ backgroundColor: leagueInfo.color }}>
            {leagueInfo.abbreviation}
          </span>
          <span className={`draft-league-year ${yearClass}`}>{season}</span>
        </div>
      </div>

      {!hasDraftedTeams && (
        <div className="draft-header-section">
          <div className="draft-actions">
            <button 
              className="edit-draft-order-button"
              onClick={handleEditDraftOrder}
              title="Edit the draft order before any teams are selected"
            >
              Edit Draft Order
            </button>
          </div>
        </div>
      )}
      
      {/* Notification Banner */}
      {notification && (
        <div className={`draft-notification draft-notification-${notification.owner.toLowerCase()}`}>
          <div className="notification-content">
            <span className="notification-icon">🎉</span>
            <span className="notification-message">{notification.message}</span>
            <button 
              className="notification-close"
              onClick={() => setNotification(null)}
              aria-label="Close notification"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {nextPick && (
        <div className={`next-pick next-pick-${nextPick.owner.toLowerCase()}`}>
          <span className="next-pick-text">
            <strong>Next Pick:</strong> {nextPick.owner} (Round {nextPick.round}, Pick #{nextPick.pickNumber})
          </span>
          {!isDraftComplete && (
            <button 
              className="delete-last-pick-btn"
              onClick={handleDeleteLastPick}
              disabled={!hasPicksToDelete}
              title={hasPicksToDelete ? "Delete the last pick" : "No picks yet"}
            >
              Undo Last
            </button>
          )}
        </div>
      )}

      <div className="draft-table">
        <div className="draft-header">
          <div className="round-header">Round</div>
          {owners.map(owner => (
            <div key={owner} className={`owner-header owner-${owner.toLowerCase()}`}>{owner}</div>
          ))}
        </div>

        {Object.keys(draftRounds).map(roundNum => {
          const round = parseInt(roundNum);
          const roundPicks = draftRounds[round];
          
          return (
            <div key={round} className="draft-row">
              <div className="round-number">{round}</div>
              {owners.map(owner => {
                const pick = roundPicks.find(p => p.owner === owner);
                if (!pick) return <div key={owner} className="pick-cell empty"></div>;
                
                const isPickEnabled = canMakePick(pick);
                const isAlreadyPicked = !!pick.teamId;
                
                return (
                  <div key={owner} className={`pick-cell ${!isPickEnabled && !isAlreadyPicked ? 'pick-cell-disabled' : ''}`}>
                    <div className="pick-number">#{pick.pickNumber}</div>
                    <select
                      value={pick.teamId || ''}
                      onChange={(e) => {
                        const selectedTeam = allTeams?.find(t => t.id === e.target.value);
                        handleTeamSelection(pick.id, e.target.value, selectedTeam?.name);
                      }}
                      disabled={isAlreadyPicked || !isPickEnabled}
                      title={
                        isAlreadyPicked 
                          ? 'This pick has already been made'
                          : !isPickEnabled 
                          ? `Cannot make this pick until all previous picks (before #${pick.pickNumber}) are completed`
                          : 'Select a team for this pick'
                      }
                    >
                      <option value="">Select Team</option>
                      {getAvailableTeams().map(team => (
                        <option key={team.id} value={team.id}>
                          {team.name} ({team.division}) - {team.odds || 'No odds'}
                        </option>
                      ))}
                    </select>
                    {!isPickEnabled && !isAlreadyPicked && (
                      <div className="pick-disabled-message">
                        ⏳ Waiting for previous picks
                      </div>
                    )}
                    {pick.teamName && (
                      <div className={`selected-team selected-team-${pick.owner.toLowerCase()}`}>
                        {pick.teamName}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      <div className="draft-summary">
        <h3>Draft Summary</h3>
        {owners.map(owner => {
          const ownerPicks = draftPicks.filter(p => p.owner === owner && p.teamId);
          return (
            <div key={owner} className={`owner-summary owner-${owner.toLowerCase()}`}>
              <strong>{owner}:</strong> {ownerPicks.length} teams
              {ownerPicks.length > 0 && (
                <ul>
                  {ownerPicks.map(pick => (
                    <li key={pick.id}>
                      Round {pick.round}, Pick #{pick.pickNumber}: {pick.teamName}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
      
      {/* Draft Order Editor Modal */}
      {showDraftOrderEditor && (
        <DraftOrderEditor
          league={league}
          season={season}
          owners={owners}
          onClose={handleCloseDraftOrderEditor}
          onSave={handleSaveDraftOrder}
        />
      )}
    </div>
  );
};

export default DraftSection;
