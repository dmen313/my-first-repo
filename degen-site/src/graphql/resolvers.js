import { dataStore } from './dataStore.js';

const resolvers = {
  Query: {
    // Team queries
    getTeams: async (_, { league, season }) => {
      console.log('🔍 getTeams called with:', { league, season });
      const startTime = Date.now();
      
      let result;
      if (league || season) {
        result = await dataStore.getTeamsByLeague(league, season);
      } else {
        result = await dataStore.getAllTeams();
      }
      
      const endTime = Date.now();
      console.log(`✅ getTeams completed in ${endTime - startTime}ms, returned ${result.length} teams`);
      return result;
    },

    getTeam: (_, { id }) => {
      return dataStore.getTeam(id);
    },

    getTeamsByOwner: (_, { owner }) => {
      return dataStore.getTeamsByOwner(owner);
    },

    // Achievement queries
    getAchievements: (_, { teamId, league, season }) => {
      if (teamId) {
        return dataStore.getAchievementsByTeam(teamId);
      }
      return dataStore.getAchievementsByLeague(league, season);
    },

    getAchievement: (_, { id }) => {
      return dataStore.getAchievement(id);
    },

    // Payout queries
    getPayoutRows: async (_, { league, season }) => {
      return await dataStore.getPayoutRows(league, season);
    },

    // League Settings queries
    getLeagueSettings: async (_, { league, season }) => {
      return await dataStore.getLeagueSettings(league, season);
    },

    // Team Mapping queries
    getTeamMappings: async (_, { league, season }) => {
      return await dataStore.getTeamMappings(league, season);
    },

    getTeamMapping: (_, { id }) => {
      return dataStore.getTeamMapping(id);
    },

    getTeamMappingByCfbdId: (_, { cfbdId }) => {
      return dataStore.getTeamMappingByCfbdId(cfbdId);
    },

    getTeamMappingByOddsApiName: (_, { oddsApiName }) => {
      return dataStore.getTeamMappingByOddsApiName(oddsApiName);
    },

    // Owner queries
    getOwners: () => {
      return dataStore.getAllOwners();
    },

    getOwner: (_, { id }) => {
      return dataStore.getOwner(id);
    },

    // Draft queries
    getDraftPicks: async (_, { league, season }) => {
      console.log('🔍 getDraftPicks called with:', { league, season });
      const startTime = Date.now();
      
      const result = await dataStore.getDraftPicks(league, season);
      
      const endTime = Date.now();
      console.log(`✅ getDraftPicks completed in ${endTime - startTime}ms, returned ${result.length} picks`);
      return result;
    },

    getDraftPick: async (_, { id }) => {
      return await dataStore.getDraftPick(id);
    },

    // External API queries
    getCfbdRecords: async (_, { year }) => {
      console.log('🔍 getCfbdRecords called with year:', year);
      const CFBD_API_KEY = process.env.CFBD_API_KEY;
      
      if (!CFBD_API_KEY) {
        console.error('❌ CFBD_API_KEY not found in environment');
        throw new Error('CFBD API key not configured');
      }

      try {
        const fetch = (await import('node-fetch')).default;
        const response = await fetch(`https://api.collegefootballdata.com/records?year=${year}`, {
          headers: {
            'Authorization': `Bearer ${CFBD_API_KEY}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error(`CFBD API error: ${response.status} ${response.statusText}`);
        }

        const records = await response.json();
        const formattedRecords = records.map(record => ({
          team: record.team,
          wins: record.total?.wins || 0,
          losses: record.total?.losses || 0,
          record: `${record.total?.wins || 0}-${record.total?.losses || 0}`
        }));

        console.log(`✅ Fetched ${formattedRecords.length} CFBD records for year ${year}`);
        return formattedRecords;
      } catch (error) {
        console.error('❌ Error fetching CFBD records:', error);
        throw new Error(`Failed to fetch CFBD records: ${error.message}`);
      }
    },
  },

  Mutation: {
    // Team mutations
    createTeam: (_, { input }) => {
      return dataStore.createTeam(input);
    },

    updateTeam: (_, { input }) => {
      const { id, ...updateData } = input;
      const updatedTeam = dataStore.updateTeam(id, updateData);
      if (!updatedTeam) {
        throw new Error(`Team not found. ID: ${id}`);
      }
      return updatedTeam;
    },

    updateTeamApiData: (_, { id, input }) => {
      console.log('🔄 UpdateTeamApiData called with:', { id, input });
      const team = dataStore.teams.get(id);
      if (!team) {
        console.error('❌ Team not found. ID:', id);
        throw new Error(`Team not found. ID: ${id}`);
      }
      
      // Update team with API data
      const updatedTeam = {
        ...team,
        ...input,
        updatedAt: new Date().toISOString()
      };
      
      dataStore.teams.set(id, updatedTeam);
      console.log('✅ Team API data updated successfully:', updatedTeam);
      return updatedTeam;
    },

    deleteTeam: (_, { id }) => {
      return dataStore.deleteTeam(id);
    },

    // Achievement mutations
    createAchievement: (_, { input }) => {
      return dataStore.createAchievement(input);
    },

    updateAchievement: (_, { input }) => {
      const { id, ...updateData } = input;
      return dataStore.updateAchievement(id, updateData);
    },

    deleteAchievement: (_, { id }) => {
      return dataStore.deleteAchievement(id);
    },

    updateTeamAchievements: (_, { teamId, achievements }) => {
      // Delete existing achievements for this team
      const existingAchievements = dataStore.getAchievementsByTeam(teamId);
      existingAchievements.forEach(achievement => {
        dataStore.deleteAchievement(achievement.id);
      });

      // Create new achievements
      const newAchievements = achievements.map(achievementData => {
        return dataStore.createAchievement({
          ...achievementData,
          teamId
        });
      });

      return newAchievements;
    },

    // Payout mutations
    createPayoutRow: (_, { input }) => {
      return dataStore.createPayoutRow(input);
    },

    updatePayoutRow: (_, { id, input }) => {
      console.log('🔍 UpdatePayoutRow called with:', { id, input });
      const payout = dataStore.payoutRows.get(id);
      if (!payout) {
        const availableIds = Array.from(dataStore.payoutRows.keys()).slice(0, 3);
        console.error('❌ Payout row not found. ID:', id, 'Available IDs:', availableIds);
        throw new Error(`Payout row not found. ID: ${id}. Available IDs: ${availableIds.join(', ')}`);
      }
      
      const updatedPayout = {
        ...payout,
        ...input,
        updatedAt: new Date().toISOString()
      };
      dataStore.payoutRows.set(id, updatedPayout);
      console.log('✅ Payout row updated successfully:', updatedPayout);
      return updatedPayout;
    },

    deletePayoutRow: (_, { id }) => {
      return dataStore.payoutRows.delete(id);
    },

    // League Settings mutations
    createLeagueSettings: (_, { input }) => {
      return dataStore.createLeagueSettings(input);
    },

    updateLeagueSettings: (_, { input }) => {
      const { id, ...updateData } = input;
      const updatedSettings = dataStore.updateLeagueSettings(id, updateData);
      if (!updatedSettings) {
        throw new Error(`League settings not found. ID: ${id}`);
      }
      return updatedSettings;
    },

    deleteLeagueSettings: (_, { id }) => {
      return dataStore.deleteLeagueSettings(id);
    },

    // Team Mapping mutations
    createTeamMapping: (_, { input }) => {
      return dataStore.createTeamMapping(input);
    },

    updateTeamMapping: (_, { input }) => {
      const { id, ...updateData } = input;
      const updatedMapping = dataStore.updateTeamMapping(id, updateData);
      if (!updatedMapping) {
        throw new Error(`Team mapping not found. ID: ${id}`);
      }
      return updatedMapping;
    },

    deleteTeamMapping: (_, { id }) => {
      return dataStore.deleteTeamMapping(id);
    },

    // Draft mutations
    createDraftPick: async (_, { input }) => {
      return await dataStore.createDraftPick(input);
    },

    updateDraftPick: async (_, { input }) => {
      const { id, ...updateData } = input;
      const updatedPick = await dataStore.updateDraftPick(id, updateData);
      if (!updatedPick) {
        throw new Error(`Draft pick not found. ID: ${id}`);
      }
      return updatedPick;
    },

    deleteDraftPick: async (_, { id }) => {
      return await dataStore.deleteDraftPick(id);
    },

    initializeDraft: async (_, { league, season, owners }) => {
      return await dataStore.initializeDraft(league, season, owners);
    },

    reorderDraftPicks: async (_, { league, season, owners }) => {
      return await dataStore.reorderDraftPicks(league, season, owners);
    },

    // Bulk operations
    initializeLeagueData: (_, { league, season }) => {
      // This could be used to reset/initialize data for a specific league/season
      console.log(`Initializing data for ${league} ${season}`);
      return true;
    },

    exportMappings: async () => {
      try {
        const { exec } = await import('child_process');
        const path = await import('path');
        
        return new Promise((resolve, reject) => {
          const scriptPath = path.default.join(process.cwd(), 'scripts', 'exportMappingTableToCSV.js');
          exec(`node "${scriptPath}"`, { cwd: process.cwd() }, (error, stdout, stderr) => {
            if (error) {
              console.error('Export error:', error);
              reject(new Error(`Export failed: ${error.message}`));
              return;
            }
            
            // Extract filename from stdout
            const match = stdout.match(/team_mappings_\d{4}-\d{2}-\d{2}\.csv/);
            if (match) {
              resolve(`Export completed successfully! File: ${match[0]}`);
            } else {
              resolve('Export completed successfully!');
            }
          });
        });
      } catch (error) {
        throw new Error(`Export failed: ${error.message}`);
      }
    },
  },

  // Field resolvers
  Team: {
    achievements: (parent) => {
      return dataStore.getAchievementsByTeam(parent.id);
    },
  },

  Owner: {
    teams: (parent) => {
      return dataStore.getTeamsByOwner(parent.abbreviation);
    },
    
    totalAchievements: (parent) => {
      const teams = dataStore.getTeamsByOwner(parent.abbreviation);
      let total = 0;
      teams.forEach(team => {
        const achievements = dataStore.getAchievementsByTeam(team.id);
        total += achievements.filter(a => a.achieved).length;
      });
      return total;
    },
  },
};

export { resolvers };
