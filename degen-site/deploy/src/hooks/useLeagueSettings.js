import { useState, useEffect } from 'react';
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

  // GraphQL queries and mutations
  const { data: settingsData, loading: settingsLoading, refetch: refetchSettings } = useQuery(
    GET_LEAGUE_SETTINGS,
    {
      variables: { league, season },
      fetchPolicy: 'cache-first',
      skip: !league || !season
    }
  );

  const [createLeagueSettingsMutation] = useMutation(CREATE_LEAGUE_SETTINGS);
  const [updateLeagueSettingsMutation] = useMutation(UPDATE_LEAGUE_SETTINGS);

  // Sync GraphQL data with local state
  useEffect(() => {
    if (settingsData?.getLeagueSettings) {
      const settings = settingsData.getLeagueSettings;
      setLocalSettings({
        buyInPerTeam: settings.buyInPerTeam,
        numTeams: settings.numTeams,
        totalPool: settings.totalPool
      });
    }
  }, [settingsData]);

  // Update settings in GraphQL
  const updateSettings = async (newSettings) => {
    try {
      console.log('🔄 Updating league settings:', newSettings);
      
      // Update local state immediately for optimistic UI
      setLocalSettings(newSettings);

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
        const { data } = await createLeagueSettingsMutation({
          variables: {
            input: {
              league,
              season,
              ...newSettings
            }
          }
        });
        console.log('✅ League settings created:', data.createLeagueSettings);
      }
    } catch (error) {
      console.error('❌ Error updating league settings:', error);
      // Revert local state on error
      if (settingsData?.getLeagueSettings) {
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

  return {
    settings: localSettings,
    loading: settingsLoading,
    updateSettings,
    updateBuyInPerTeam,
    updateNumTeams,
    refetchSettings
  };
};

