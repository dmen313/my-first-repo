import { useState, useEffect } from 'react';
import { USE_DIRECT_DYNAMODB } from '../config/dataSource';

// Conditionally import Apollo hooks - but always import them to ensure hooks can be called
// We'll use skip option to prevent execution when using direct DynamoDB
import { useQuery, useMutation } from '@apollo/client';
import { 
  GET_LEAGUE_SETTINGS, 
  CREATE_LEAGUE_SETTINGS, 
  UPDATE_LEAGUE_SETTINGS 
} from '../graphql/client';

export const useLeagueSettings = (leagueId) => {
  const [localSettings, setLocalSettings] = useState({
    buyInPerTeam: 500,
    numTeams: 4,
    totalPool: 2000
  });
  const [loading, setLoading] = useState(false);

  // Determine league and season from leagueId
  const getLeagueInfo = (leagueId) => {
    if (leagueId === 'mlb-2024') return { league: 'mlb', season: '2024' };
    if (leagueId === 'mlb-2025') return { league: 'mlb', season: '2025' };
    if (leagueId === 'nba-2024') return { league: 'nba', season: '2024' };
    if (leagueId === 'nba-2025') return { league: 'nba', season: '2025' };
    if (leagueId === 'nfl-2025') return { league: 'nfl', season: '2025' };
    if (leagueId === 'ncaa-2025') return { league: 'ncaa', season: '2025' };
    if (leagueId === 'nhl-2025') return { league: 'nhl', season: '2025' };
    if (leagueId === 'nfl-mvp-2025') return { league: 'nfl-mvp', season: '2025' };
    return { league: null, season: null };
  };

  const { league, season } = getLeagueInfo(leagueId);

  // GraphQL queries and mutations
  // Always call hooks (React rules), but skip query when using direct DynamoDB
  const graphqlQuery = useQuery(GET_LEAGUE_SETTINGS, {
    variables: { league, season },
    fetchPolicy: 'cache-first',
    skip: !league || !season || USE_DIRECT_DYNAMODB
  });

  // useMutation doesn't have skip option, but we'll conditionally call the function
  const [createLeagueSettingsMutation] = useMutation(CREATE_LEAGUE_SETTINGS);
  const [updateLeagueSettingsMutation] = useMutation(UPDATE_LEAGUE_SETTINGS);

  const settingsData = graphqlQuery.data;
  const settingsLoading = graphqlQuery.loading;

  // Fetch settings from DynamoDB if using direct access
  useEffect(() => {
    if (USE_DIRECT_DYNAMODB && league && season) {
      setLoading(true);
      (async () => {
        try {
          const { getLeagueSettings } = await import('../services/dynamoDBService');
          const settings = await getLeagueSettings(league, season);
          if (settings) {
            setLocalSettings({
              buyInPerTeam: settings.buyInPerTeam,
              numTeams: settings.numTeams,
              totalPool: settings.totalPool
            });
          }
        } catch (error) {
          console.error('❌ Error fetching league settings:', error);
        } finally {
          setLoading(false);
        }
      })();
    }
  }, [league, season]);

  // Sync GraphQL data with local state (only if using GraphQL)
  useEffect(() => {
    if (!USE_DIRECT_DYNAMODB && settingsData?.getLeagueSettings) {
      const settings = settingsData.getLeagueSettings;
      setLocalSettings({
        buyInPerTeam: settings.buyInPerTeam,
        numTeams: settings.numTeams,
        totalPool: settings.totalPool
      });
    }
  }, [settingsData]);

  // Update settings (works for both GraphQL and DynamoDB)
  const updateSettings = async (newSettings) => {
    try {
      console.log('🔄 Updating league settings:', newSettings);
      
      // Update local state immediately for optimistic UI
      setLocalSettings(newSettings);

      if (USE_DIRECT_DYNAMODB) {
        // Use DynamoDB service
        const { getLeagueSettings, createLeagueSettings, updateLeagueSettings } = await import('../services/dynamoDBService');
        const existing = await getLeagueSettings(league, season);
        
        if (existing) {
          await updateLeagueSettings(existing.id, newSettings);
          console.log('✅ League settings updated in DynamoDB');
        } else {
          await createLeagueSettings({
            league,
            season,
            ...newSettings
          });
          console.log('✅ League settings created in DynamoDB');
        }
      } else {
        // Use GraphQL
        if (settingsData?.getLeagueSettings) {
          // Update existing settings
          const { data } = await updateLeagueSettingsMutation({
            variables: {
              input: {
                id: settingsData.getLeagueSettings.id,
                ...newSettings
              }
            }
          });
          console.log('✅ League settings updated:', data.updateLeagueSettings);
        } else {
          // Create new settings
          await createLeagueSettingsMutation({
            variables: {
              input: {
                league,
                season,
                ...newSettings
              }
            }
          });
          console.log('✅ League settings created');
        }
      }
    } catch (error) {
      console.error('❌ Error updating league settings:', error);
      // Revert local state on error
      if (USE_DIRECT_DYNAMODB) {
        // Try to reload from DynamoDB
        try {
          const { getLeagueSettings } = await import('../services/dynamoDBService');
          const settings = await getLeagueSettings(league, season);
          if (settings) {
            setLocalSettings({
              buyInPerTeam: settings.buyInPerTeam,
              numTeams: settings.numTeams,
              totalPool: settings.totalPool
            });
          }
        } catch (e) {
          console.error('Failed to reload settings:', e);
        }
      } else if (settingsData?.getLeagueSettings) {
        setLocalSettings({
          buyInPerTeam: settingsData.getLeagueSettings.buyInPerTeam,
          numTeams: settingsData.getLeagueSettings.numTeams,
          totalPool: settingsData.getLeagueSettings.totalPool
        });
      }
      throw error;
    }
  };

  // Update individual fields
  const updateBuyInPerTeam = async (buyInPerTeam) => {
    const newTotalPool = buyInPerTeam * localSettings.numTeams;
    await updateSettings({
      ...localSettings,
      buyInPerTeam,
      totalPool: newTotalPool
    });
  };

  const updateNumTeams = async (numTeams) => {
    const newTotalPool = localSettings.buyInPerTeam * numTeams;
    await updateSettings({
      ...localSettings,
      numTeams,
      totalPool: newTotalPool
    });
  };

  const refetchSettings = async () => {
    if (USE_DIRECT_DYNAMODB) {
      setLoading(true);
      try {
        const { getLeagueSettings } = await import('../services/dynamoDBService');
        const settings = await getLeagueSettings(league, season);
        if (settings) {
          setLocalSettings({
            buyInPerTeam: settings.buyInPerTeam,
            numTeams: settings.numTeams,
            totalPool: settings.totalPool
          });
        }
      } catch (error) {
        console.error('❌ Error refetching league settings:', error);
      } finally {
        setLoading(false);
      }
    } else {
      return graphqlQuery.refetch();
    }
  };

  return {
    settings: localSettings,
    loading: USE_DIRECT_DYNAMODB ? loading : settingsLoading,
    updateSettings,
    updateBuyInPerTeam,
    updateNumTeams,
    refetchSettings
  };
};

