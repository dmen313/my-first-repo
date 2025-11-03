import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import {
  GET_TEAMS,
  GET_PAYOUT_ROWS,
  GET_OWNERS,
  GET_ACHIEVEMENTS,
  UPDATE_TEAM_ACHIEVEMENTS,
  UPDATE_TEAM,
  CREATE_ACHIEVEMENT,
  UPDATE_ACHIEVEMENT,
  UPDATE_PAYOUT_ROW,
  CREATE_PAYOUT_ROW,
  DELETE_PAYOUT_ROW,
  fetchPayoutStructure
} from '../graphql/client';

// Hook for fetching teams
export const useTeams = (league, season) => {
  const { loading, error, data, refetch } = useQuery(GET_TEAMS, {
    variables: { league, season },
    fetchPolicy: 'network-only',
  });

  return {
    teams: data?.getTeams || [],
    loading,
    error,
    refetchTeams: refetch,
  };
};

// Hook for fetching payout structure
export const usePayoutStructure = (league, season) => {
  console.log('🔍 usePayoutStructure called with:', { league, season });
  
  // Skip the query if league or season is not provided
  const skip = !league || !season;
  console.log('⏭️ Skipping query:', skip);
  
  const { loading, error, data, refetch } = useQuery(GET_PAYOUT_ROWS, {
    variables: { league, season },
    fetchPolicy: 'no-cache',
    errorPolicy: 'all',
    skip,
  });

  console.log('💰 usePayoutStructure result:', { 
    loading, 
    error: error?.message, 
    errorDetails: error,
    skip,
    payoutRowsCount: data?.getPayoutRows?.length || 0,
    payoutRows: data?.getPayoutRows?.map(row => ({ level: row.level, teams: row.teams, percentage: row.percentage }))
  });

  return {
    payoutRows: data?.getPayoutRows || [],
    loading,
    error,
    refetchPayoutRows: refetch,
  };
};

// Hook for fetching achievements
export const useAchievements = (league, season) => {
  const { loading, error, data, refetch } = useQuery(GET_ACHIEVEMENTS, {
    variables: { league, season },
    fetchPolicy: 'network-only',
  });

  return {
    achievements: data?.getAchievements || [],
    loading,
    error,
    refetchAchievements: refetch,
  };
};

// Hook for fetching owners
export const useOwners = () => {
  const { loading, error, data, refetch } = useQuery(GET_OWNERS, {
    fetchPolicy: 'network-only',
  });

  return {
    owners: data?.getOwners || [],
    loading,
    error,
    refetchOwners: refetch,
  };
};

// Hook for team achievements management
export const useTeamAchievements = () => {
  const [updateTeamAchievementsMutation] = useMutation(UPDATE_TEAM_ACHIEVEMENTS);
  const [createAchievementMutation] = useMutation(CREATE_ACHIEVEMENT);
  const [updateAchievementMutation] = useMutation(UPDATE_ACHIEVEMENT);

  const updateAchievements = async (teamId, achievements) => {
    try {
      const { data } = await updateTeamAchievementsMutation({
        variables: { teamId, achievements },
      });
      return data.updateTeamAchievements;
    } catch (error) {
      console.error('Error updating team achievements:', error);
      throw error;
    }
  };

  const createAchievement = async (achievementData) => {
    try {
      const { data } = await createAchievementMutation({
        variables: { input: achievementData },
      });
      return data.createAchievement;
    } catch (error) {
      console.error('Error creating achievement:', error);
      throw error;
    }
  };

  const updateAchievement = async (id, achieved) => {
    try {
      const { data } = await updateAchievementMutation({
        variables: { input: { id, achieved } },
      });
      return data.updateAchievement;
    } catch (error) {
      console.error('Error updating achievement:', error);
      throw error;
    }
  };

  return {
    updateAchievements,
    createAchievement,
    updateAchievement,
  };
};

// Hook for team management
export const useTeamManagement = () => {
  const [updateTeamMutation] = useMutation(UPDATE_TEAM);

  const updateTeam = async (teamData) => {
    try {
      const { data } = await updateTeamMutation({
        variables: { input: teamData },
      });
      return data.updateTeam;
    } catch (error) {
      console.error('Error updating team:', error);
      throw error;
    }
  };

  return {
    updateTeam,
  };
};

// Hook for payout management
export const usePayoutManagement = () => {
  const [updatePayoutRowMutation] = useMutation(UPDATE_PAYOUT_ROW);
  const [createPayoutRowMutation] = useMutation(CREATE_PAYOUT_ROW);
  const [deletePayoutRowMutation] = useMutation(DELETE_PAYOUT_ROW);

  const updatePayoutRow = async (id, payoutData) => {
    try {
      console.log('🔍 Sending payout row mutation with:', { id, payoutData });
      const { data } = await updatePayoutRowMutation({
        variables: { id, input: payoutData },
      });
      console.log('✅ Payout row mutation response:', data);
      return data.updatePayoutRow;
    } catch (error) {
      console.error('❌ Error updating payout row:', error);
      console.error('❌ Variables sent:', { id, input: payoutData });
      if (error.graphQLErrors) {
        console.error('❌ GraphQL Errors:', error.graphQLErrors);
      }
      if (error.networkError) {
        console.error('❌ Network Error:', error.networkError);
      }
      throw error;
    }
  };

  const createPayoutRow = async (payoutData) => {
    try {
      const { data } = await createPayoutRowMutation({
        variables: { input: payoutData },
      });
      return data.createPayoutRow;
    } catch (error) {
      console.error('Error creating payout row:', error);
      throw error;
    }
  };

  const deletePayoutRow = async (id) => {
    try {
      const { data } = await deletePayoutRowMutation({
        variables: { id },
      });
      return data.deletePayoutRow;
    } catch (error) {
      console.error('Error deleting payout row:', error);
      throw error;
    }
  };

  return {
    updatePayoutRow,
    createPayoutRow,
    deletePayoutRow,
  };
};

// Custom hook for managing league data with local state and GraphQL sync
export const useLeagueData = (leagueId) => {
  const [localTeams, setLocalTeams] = useState([]);
  const [localPayoutRows, setLocalPayoutRows] = useState([]);
  const [achievements, setAchievements] = useState({});

  // Determine league and season from leagueId
  const getLeagueInfo = (leagueId) => {
    if (leagueId === 'mlb-2024') return { league: 'mlb', season: '2024' };
    if (leagueId === 'mlb-2025') return { league: 'mlb', season: '2025' };
    if (leagueId === 'nba-2024') return { league: 'nba', season: '2024' };
    if (leagueId === 'nba-2025') return { league: 'nba', season: '2025' };
    if (leagueId === 'nfl-2025') return { league: 'nfl', season: '2025' };
    if (leagueId === 'ncaa-2025') return { league: 'ncaa', season: '2025' };
    return { league: null, season: null };
  };

  const { league, season } = getLeagueInfo(leagueId);
  console.log(`🏈 useLeagueData called with leagueId: ${leagueId}, parsed as league: ${league}, season: ${season}`);
  
  // Fetch data from GraphQL
  const { teams: gqlTeams, loading: teamsLoading, refetchTeams } = useTeams(league, season);
  const { payoutRows: gqlPayoutRows, loading: payoutLoading, refetchPayoutRows } = usePayoutStructure(league, season);
  const { achievements: gqlAchievements, loading: achievementsLoading, refetchAchievements } = useAchievements(league, season);
  const { updateAchievements } = useTeamAchievements();
  const { updatePayoutRow, createPayoutRow, deletePayoutRow } = usePayoutManagement();

  // Sync GraphQL data with local state
  useEffect(() => {
    if (gqlTeams.length > 0) {
      setLocalTeams(gqlTeams);
    }
  }, [gqlTeams]);

  useEffect(() => {
    if (gqlPayoutRows.length > 0) {
      setLocalPayoutRows(gqlPayoutRows);
    }
  }, [gqlPayoutRows]);

  // Sync achievements from GraphQL
  useEffect(() => {
    if (gqlAchievements.length > 0) {
      // Convert achievement array to nested object: { teamId: { achievementType: true/false } }
      const achievementMap = {};
      gqlAchievements.forEach(achievement => {
        if (!achievementMap[achievement.teamId]) {
          achievementMap[achievement.teamId] = {};
        }
        achievementMap[achievement.teamId][achievement.achievementType] = achievement.achieved;
      });
      setAchievements(achievementMap);
      console.log('📊 Loaded achievements from GraphQL:', achievementMap);
    }
  }, [gqlAchievements]);

  // Achievement management functions
  const updateTeamAchievement = useCallback(async (teamId, achievementType, achieved) => {
    // Update local state immediately for optimistic UI
    setAchievements(prev => {
      const updated = {
        ...prev,
        [teamId]: {
          ...prev[teamId],
          [achievementType]: achieved
        }
      };
      
      // Use the bulk update mutation which replaces all achievements for a team
      const currentTeamAchievements = updated[teamId] || {};
      
      // Convert to array format expected by GraphQL
      const achievementArray = Object.entries(currentTeamAchievements)
        .filter(([_, value]) => value === true) // Only include achieved ones
        .map(([type, _]) => ({
          teamId,
          achievementType: type,
          achieved: true,
          season,
          league
        }));
      
      // Send to GraphQL asynchronously
      updateAchievements(teamId, achievementArray).catch(error => {
        console.error('Failed to save achievement to GraphQL:', error);
        // Revert local state on error
        setAchievements(prev => ({
          ...prev,
          [teamId]: {
            ...prev[teamId],
            [achievementType]: !achieved
          }
        }));
      });
      
      return updated;
    });
  }, [updateAchievements, season, league]);

  const getTeamAchievement = useCallback((teamId, achievementType) => {
    return achievements[teamId]?.[achievementType] || false;
  }, [achievements]);

  // Payout management functions
  const updatePayoutRowData = useCallback(async (id, payoutData) => {
    console.log('🔄 Updating payout row:', { id, payoutData });
    
    // Update local state immediately for optimistic UI
    setLocalPayoutRows(prev => 
      prev.map(row => row.id === id ? { ...row, ...payoutData, updatedAt: new Date().toISOString() } : row)
    );

    try {
      // Sync with GraphQL
      console.log('📡 Sending payout update to GraphQL...');
      await updatePayoutRow(id, payoutData);
      console.log('✅ Payout row updated successfully');
    } catch (error) {
      console.error('❌ Failed to update payout row:', error);
      
      // Check if it's an ID not found error
      if (error.message && error.message.includes('Payout row not found')) {
        console.log('🔄 ID not found - refreshing data and retrying...');
        // Refresh the data to get new IDs
        await refetchPayoutRows();
        
        // Try to find the corresponding row by level and retry
        const freshPayoutRows = await fetchPayoutStructure(league, season);
        const matchingRow = freshPayoutRows.find(row => row.level === payoutData.level);
        
        if (matchingRow) {
          console.log('🔄 Retrying with fresh ID:', matchingRow.id);
          try {
            await updatePayoutRow(matchingRow.id, payoutData);
            console.log('✅ Retry successful!');
            return;
          } catch (retryError) {
            console.error('❌ Retry also failed:', retryError);
          }
        }
      }
      
      // Revert local state on error
      refetchPayoutRows();
      throw error;
    }
  }, [updatePayoutRow, refetchPayoutRows, league, season, fetchPayoutStructure]);

  const createPayoutRowData = useCallback(async (payoutData) => {
    try {
      const newRow = await createPayoutRow({
        ...payoutData,
        league,
        season
      });
      
      // Update local state with new row
      setLocalPayoutRows(prev => [...prev, newRow]);
      return newRow;
    } catch (error) {
      console.error('Error creating payout row:', error);
      throw error;
    }
  }, [createPayoutRow, league, season]);

  const deletePayoutRowData = useCallback(async (id) => {
    // Update local state immediately for optimistic UI
    setLocalPayoutRows(prev => prev.filter(row => row.id !== id));

    try {
      await deletePayoutRow(id);
    } catch (error) {
      // Revert local state on error
      refetchPayoutRows();
      throw error;
    }
  }, [deletePayoutRow, refetchPayoutRows]);

  return {
    teams: localTeams,
    payoutRows: localPayoutRows,
    achievements,
    loading: teamsLoading || payoutLoading || achievementsLoading,
    updateTeamAchievement,
    getTeamAchievement,
    updatePayoutRowData,
    createPayoutRowData,
    deletePayoutRowData,
    refetchData: useCallback(() => {
      refetchTeams();
      refetchPayoutRows();
      refetchAchievements();
    }, [refetchTeams, refetchPayoutRows, refetchAchievements])
  };
};
