/**
 * Draft hook for direct DynamoDB access
 */

import { useState, useEffect, useCallback } from 'react';
import * as dynamoDBService from '../services/dynamoDBService';

export const useDraft = (league, season) => {
  const [draftPicks, setDraftPicks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch draft picks
  useEffect(() => {
    const fetchDraftPicks = async () => {
      if (!league || !season) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const data = await dynamoDBService.getDraftPicks(league, season);
        setDraftPicks(data);
      } catch (err) {
        console.error('Error fetching draft picks:', err);
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetchDraftPicks();
  }, [league, season]);

  // Refetch function
  const refetch = useCallback(async () => {
    if (!league || !season) return [];

    setLoading(true);
    setError(null);
    try {
      const data = await dynamoDBService.getDraftPicks(league, season);
      setDraftPicks(data);
      return data;
    } catch (err) {
      console.error('Error refetching draft picks:', err);
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [league, season]);

  // Update draft pick
  const updateDraftPick = useCallback(async (id, updateData) => {
    try {
      const updatedPick = await dynamoDBService.updateDraftPick(id, updateData);
      setDraftPicks(prev => prev.map(pick => pick.id === id ? updatedPick : pick));
      return updatedPick;
    } catch (err) {
      console.error('Error updating draft pick:', err);
      throw err;
    }
  }, []);

  // Delete draft pick
  const deleteDraftPick = useCallback(async (id) => {
    try {
      await dynamoDBService.deleteDraftPick(id);
      setDraftPicks(prev => prev.filter(pick => pick.id !== id));
      return true;
    } catch (err) {
      console.error('Error deleting draft pick:', err);
      throw err;
    }
  }, []);

  // Initialize draft
  const initializeDraft = useCallback(async (owners) => {
    if (!league || !season) return [];

    try {
      const picks = await dynamoDBService.initializeDraft(league, season, owners);
      setDraftPicks(picks);
      return picks;
    } catch (err) {
      console.error('Error initializing draft:', err);
      throw err;
    }
  }, [league, season]);

  // Helper functions
  const getDraftRounds = useCallback(() => {
    const rounds = {};
    draftPicks.forEach(pick => {
      if (!rounds[pick.round]) {
        rounds[pick.round] = [];
      }
      rounds[pick.round].push(pick);
    });
    return rounds;
  }, [draftPicks]);

  const getNextPick = useCallback(() => {
    return draftPicks.find(pick => !pick.teamId) || null;
  }, [draftPicks]);

  const isTeamDrafted = useCallback((teamId) => {
    return draftPicks.some(pick => pick.teamId === teamId);
  }, [draftPicks]);

  // Reorder draft picks
  const reorderDraftPicks = useCallback(async (league, season, owners) => {
    try {
      const picks = await dynamoDBService.reorderDraftPicks(league, season, owners);
      setDraftPicks(picks);
      return picks;
    } catch (err) {
      console.error('Error reordering draft picks:', err);
      throw err;
    }
  }, []);

  return {
    draftPicks,
    loading,
    error,
    initializeDraft,
    updateDraftPick,
    deleteDraftPick,
    reorderDraftPicks,
    getDraftRounds,
    getNextPick,
    isTeamDrafted,
    refetch
  };
};

