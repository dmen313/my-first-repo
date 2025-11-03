import React, { useState, useEffect, useCallback } from 'react';
import { useMutation } from '@apollo/client';
import { useDraft } from '../hooks/useDraft';
import { useTeams } from '../hooks/useGraphQL';
import { UPDATE_TEAM } from '../graphql/client';
import DraftOrderEditor from './DraftOrderEditor';
import './DraftSection.css';

const DraftSection = ({ league, season }) => {
  const [staticOwners] = useState(['DM', 'TG', 'KH', 'MC']); // Keep original for initialization
  const [isInitialized, setIsInitialized] = useState(false);
  const [showDraftOrderEditor, setShowDraftOrderEditor] = useState(false);
  
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

  const { teams: allTeams, loading: teamsLoading } = useTeams(league, season);
  const [updateTeamMutation] = useMutation(UPDATE_TEAM);

  // Initialize draft if not already done (only if no draft picks exist)
  useEffect(() => {
    const initializeDraftIfNeeded = async () => {
      if (!loading && !isInitialized && draftPicks.length === 0) {
        try {
          console.log('🏈 No existing draft picks found, initializing draft...');
          await initializeDraft(staticOwners);
          setIsInitialized(true);
        } catch (err) {
          console.error('Error initializing draft:', err);
        }
      } else if (!loading && draftPicks.length > 0) {
        console.log(`🏈 Found ${draftPicks.length} existing draft picks, skipping initialization`);
        setIsInitialized(true);
      }
    };

    initializeDraftIfNeeded();
  }, [loading, isInitialized, initializeDraft, staticOwners, draftPicks.length]);

  // Handle team selection for a draft pick
  const handleTeamSelection = useCallback(async (pickId, teamId, teamName) => {
    try {
      // Update the draft pick
      await updateDraftPick(pickId, { teamId, teamName });
      
      // Update the team's owner in the main team table
      const pick = draftPicks.find(p => p.id === pickId);
      if (pick && teamId) {
        await updateTeamMutation({
          variables: { 
            input: { 
              id: teamId, 
              owner: pick.owner 
            } 
          }
        });
      }
      
      // Refetch to ensure UI is updated
      refetch();
    } catch (err) {
      console.error('Error updating draft pick:', err);
    }
  }, [updateDraftPick, updateTeamMutation, draftPicks, refetch]);

  // Get available teams (not yet drafted and without owners), sorted by odds descending
  const getAvailableTeams = useCallback(() => {
    if (!allTeams || !Array.isArray(allTeams)) {
      return [];
    }
    
    const availableTeams = allTeams.filter(team => 
      !isTeamDrafted(team.id) && (!team.owner || team.owner === 'NA') // Exclude teams that already have a real owner
    );
    
    // Sort by odds (descending - best odds first)
    const sortedTeams = availableTeams.sort((a, b) => {
      const oddsA = parseFloat(a.odds?.replace('+', '') || '999999');
      const oddsB = parseFloat(b.odds?.replace('+', '') || '999999');
      return oddsA - oddsB; // Lower odds number = better odds = higher in list
    });
    
    console.log(`🏈 Available teams for draft: ${sortedTeams.length} out of ${allTeams?.length || 0} total teams`);
    return sortedTeams;
  }, [allTeams, isTeamDrafted]);

  // Get draft rounds organized for display
  const draftRounds = getDraftRounds();
  const nextPick = getNextPick();
  
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
    
    console.log('🏈 Dynamic owner order:', dynamicOwners);
    return allOwners;
  }, [draftPicks, staticOwners]);
  
  // Check if any teams have been drafted (to determine if edit button should be shown)
  const hasDraftedTeams = draftPicks.some(pick => pick.teamId);
  
  // Handle draft order editor
  const handleEditDraftOrder = useCallback(() => {
    setShowDraftOrderEditor(true);
  }, []);
  
  const handleCloseDraftOrderEditor = useCallback(() => {
    setShowDraftOrderEditor(false);
  }, []);
  
  const handleSaveDraftOrder = useCallback(async (newDraftPicks) => {
    try {
      console.log('🔄 Draft order saved, refreshing UI...');
      
      // Force a fresh refetch from the server (ignore cache)
      await refetch();
      
      // Add a small delay to ensure the UI updates
      setTimeout(() => {
        console.log('✅ Draft order UI refresh completed');
      }, 500);
      
      setShowDraftOrderEditor(false);
    } catch (error) {
      console.error('❌ Error refreshing draft order UI:', error);
      setShowDraftOrderEditor(false);
    }
  }, [refetch]);
  
  // Debug logging
  console.log('🏈 DraftSection render:', { 
    draftPicksLength: draftPicks.length, 
    loading, 
    teamsLoading, 
    isInitialized,
    draftRoundsKeys: Object.keys(draftRounds),
    nextPick: nextPick ? `${nextPick.owner} #${nextPick.pickNumber}` : 'none',
    firstFewPicks: draftPicks.slice(0, 4).map(p => `${p.pickNumber}:${p.owner}`).join(', '),
    dynamicOwnerOrder: owners.join(' → ')
  });

  if (loading || teamsLoading || !allTeams) {
    return (
      <div className="draft-section">
        <h2>Draft</h2>
        <div className="loading">Loading draft and teams...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="draft-section">
        <h2>Draft</h2>
        <div className="error">Error loading draft: {error.message}</div>
      </div>
    );
  }

  return (
    <div className="draft-section">
      <div className="draft-header-section">
        <h2>Draft</h2>
        {!hasDraftedTeams && (
          <button 
            className="edit-draft-order-button"
            onClick={handleEditDraftOrder}
            title="Edit the draft order before any teams are selected"
          >
            Edit Draft Order
          </button>
        )}
      </div>
      
      {nextPick && (
        <div className={`next-pick next-pick-${nextPick.owner.toLowerCase()}`}>
          <strong>Next Pick:</strong> {nextPick.owner} (Round {nextPick.round}, Pick #{nextPick.pickNumber})
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
                
                return (
                  <div key={owner} className="pick-cell">
                    <div className="pick-number">#{pick.pickNumber}</div>
                    <select
                      value={pick.teamId || ''}
                      onChange={(e) => {
                        const selectedTeam = allTeams?.find(t => t.id === e.target.value);
                        handleTeamSelection(pick.id, e.target.value, selectedTeam?.name);
                      }}
                      disabled={pick.teamId} // Disable if already picked
                    >
                      <option value="">Select Team</option>
                      {getAvailableTeams().map(team => (
                        <option key={team.id} value={team.id}>
                          {team.name} ({team.division}) - {team.odds || 'No odds'}
                        </option>
                      ))}
                    </select>
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
