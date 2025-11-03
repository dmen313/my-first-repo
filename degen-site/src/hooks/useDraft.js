import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { 
  GET_DRAFT_PICKS, 
  CREATE_DRAFT_PICK, 
  UPDATE_DRAFT_PICK, 
  DELETE_DRAFT_PICK,
  INITIALIZE_DRAFT 
} from '../graphql/client';

export const useDraft = (league, season) => {
  const [draftPicks, setDraftPicks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Query for draft picks
  const { data: draftData, loading: queryLoading, error: queryError, refetch } = useQuery(GET_DRAFT_PICKS, {
    variables: { league, season },
    fetchPolicy: 'cache-and-network',
    nextFetchPolicy: 'cache-first', // Use cache-first for subsequent fetches
    notifyOnNetworkStatusChange: true, // Notify when network status changes
    skip: !league || !season,
  });

  // Mutations
  const [createDraftPickMutation] = useMutation(CREATE_DRAFT_PICK);
  const [updateDraftPickMutation] = useMutation(UPDATE_DRAFT_PICK);
  const [deleteDraftPickMutation] = useMutation(DELETE_DRAFT_PICK);
  const [initializeDraftMutation] = useMutation(INITIALIZE_DRAFT);

  // Update local state when query data changes
  useEffect(() => {
    if (draftData?.getDraftPicks) {
      setDraftPicks(draftData.getDraftPicks);
      setLoading(false);
    }
  }, [draftData]);

  // Update loading and error states
  useEffect(() => {
    setLoading(queryLoading);
    setError(queryError);
  }, [queryLoading, queryError]);

  // Create a new draft pick
  const createDraftPick = useCallback(async (pickData) => {
    try {
      const { data } = await createDraftPickMutation({
        variables: { input: pickData },
        update: (cache, { data: { createDraftPick } }) => {
          const existingPicks = cache.readQuery({
            query: GET_DRAFT_PICKS,
            variables: { league, season }
          });
          
          if (existingPicks) {
            cache.writeQuery({
              query: GET_DRAFT_PICKS,
              variables: { league, season },
              data: {
                getDraftPicks: [...existingPicks.getDraftPicks, createDraftPick]
              }
            });
          }
        }
      });
      return data.createDraftPick;
    } catch (err) {
      console.error('Error creating draft pick:', err);
      throw err;
    }
  }, [createDraftPickMutation, league, season]);

  // Update a draft pick
  const updateDraftPick = useCallback(async (id, updateData) => {
    try {
      const { data } = await updateDraftPickMutation({
        variables: { input: { id, ...updateData } },
        update: (cache, { data: { updateDraftPick } }) => {
          const existingPicks = cache.readQuery({
            query: GET_DRAFT_PICKS,
            variables: { league, season }
          });
          
          if (existingPicks) {
            const updatedPicks = existingPicks.getDraftPicks.map(pick => 
              pick.id === id ? updateDraftPick : pick
            );
            
            cache.writeQuery({
              query: GET_DRAFT_PICKS,
              variables: { league, season },
              data: {
                getDraftPicks: updatedPicks
              }
            });
          }
        }
      });
      return data.updateDraftPick;
    } catch (err) {
      console.error('Error updating draft pick:', err);
      throw err;
    }
  }, [updateDraftPickMutation, league, season]);

  // Delete a draft pick
  const deleteDraftPick = useCallback(async (id) => {
    try {
      const { data } = await deleteDraftPickMutation({
        variables: { id },
        update: (cache) => {
          const existingPicks = cache.readQuery({
            query: GET_DRAFT_PICKS,
            variables: { league, season }
          });
          
          if (existingPicks) {
            const filteredPicks = existingPicks.getDraftPicks.filter(pick => pick.id !== id);
            
            cache.writeQuery({
              query: GET_DRAFT_PICKS,
              variables: { league, season },
              data: {
                getDraftPicks: filteredPicks
              }
            });
          }
        }
      });
      return data.deleteDraftPick;
    } catch (err) {
      console.error('Error deleting draft pick:', err);
      throw err;
    }
  }, [deleteDraftPickMutation, league, season]);

  // Initialize draft with snake draft order
  const initializeDraft = useCallback(async (owners) => {
    try {
      const { data } = await initializeDraftMutation({
        variables: { league, season, owners },
        update: (cache, { data: { initializeDraft } }) => {
          cache.writeQuery({
            query: GET_DRAFT_PICKS,
            variables: { league, season },
            data: {
              getDraftPicks: initializeDraft
            }
          });
        }
      });
      return data.initializeDraft;
    } catch (err) {
      console.error('Error initializing draft:', err);
      throw err;
    }
  }, [initializeDraftMutation, league, season]);

  // Get draft picks organized by rounds
  const getDraftRounds = useCallback(() => {
    const rounds = {};
    draftPicks.forEach(pick => {
      if (!rounds[pick.round]) {
        rounds[pick.round] = [];
      }
      rounds[pick.round].push(pick);
    });
    
    // Sort picks within each round by pick number
    Object.keys(rounds).forEach(round => {
      rounds[round].sort((a, b) => a.pickNumber - b.pickNumber);
    });
    
    return rounds;
  }, [draftPicks]);

  // Get next available pick
  const getNextPick = useCallback(() => {
    return draftPicks.find(pick => !pick.teamId) || null;
  }, [draftPicks]);

  // Get picks for a specific owner
  const getOwnerPicks = useCallback((owner) => {
    return draftPicks.filter(pick => pick.owner === owner);
  }, [draftPicks]);

  // Check if a team has been drafted
  const isTeamDrafted = useCallback((teamId) => {
    return draftPicks.some(pick => pick.teamId === teamId);
  }, [draftPicks]);

  return {
    draftPicks,
    loading,
    error,
    createDraftPick,
    updateDraftPick,
    deleteDraftPick,
    initializeDraft,
    getDraftRounds,
    getNextPick,
    getOwnerPicks,
    isTeamDrafted,
    refetch
  };
};
