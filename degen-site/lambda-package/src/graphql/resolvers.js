import { dataStore } from './dataStore.js';
import { CognitoIdentityProviderClient, ListUsersCommand } from '@aws-sdk/client-cognito-identity-provider';

// Background function to run standings update asynchronously
async function runStandingsUpdateInBackground(jobId, league, season) {
  try {
    const fetch = (await import('node-fetch')).default;
    const NBA_API_BASE = 'https://stats.nba.com/stats';
    
    // Determine NBA season format
    const seasonYear = parseInt(season);
    const seasonEnd = seasonYear + 1;
    const nbaSeason = `${seasonYear}-${String(seasonEnd).slice(-2)}`;
    
    // Fetch NBA standings with timeout
    console.log(`🏀 [Job ${jobId}] Fetching NBA standings...`);
    await dataStore.updateUpdateStatus(jobId, {
      message: 'Fetching NBA standings from API...',
      progress: 0
    });
    
    const standingsUrl = `${NBA_API_BASE}/leaguestandingsv3?LeagueID=00&Season=${nbaSeason}&SeasonType=Regular%20Season`;
    
    // Add 120-second timeout for NBA API call (can be very slow from Lambda)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);
    
    let standingsResponse;
    try {
      standingsResponse = await fetch(standingsUrl, {
        method: 'GET',
        headers: {
          'Referer': 'https://www.nba.com/',
          'Origin': 'https://www.nba.com',
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        },
        signal: controller.signal
      });
      clearTimeout(timeoutId);
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        throw new Error('NBA API is too slow from Lambda. Please use the local script: node scripts/updateNbaData.js');
      }
      throw new Error(`NBA API fetch failed: ${fetchError.message}`);
    }
    
    if (!standingsResponse.ok) {
      throw new Error(`NBA API error: ${standingsResponse.status}`);
    }
    
    console.log(`✅ [Job ${jobId}] NBA API responded successfully`);
    const standingsData = await standingsResponse.json();
    const standingsResult = standingsData.resultSets[0];
    const headers = standingsResult.headers || [];
    const rowSet = standingsResult.rowSet || [];
    
    // Build API teams map
    const teamNameIndex = headers.indexOf('TeamName');
    const teamCityIndex = headers.indexOf('TeamCity');
    const winsIndex = headers.indexOf('WINS');
    const lossesIndex = headers.indexOf('LOSSES');
    const gamesBackIndex = headers.indexOf('GB');
    
    const apiTeamsMap = new Map();
    rowSet.forEach((row) => {
      const teamCity = teamCityIndex >= 0 ? (row[teamCityIndex] || '') : '';
      const teamName = teamNameIndex >= 0 ? (row[teamNameIndex] || '') : '';
      const fullTeamName = teamCity && teamName ? `${teamCity} ${teamName}` : teamName;
      const wins = winsIndex >= 0 ? (row[winsIndex] || 0) : 0;
      const losses = lossesIndex >= 0 ? (row[lossesIndex] || 0) : 0;
      const gamesBack = gamesBackIndex >= 0 && row[gamesBackIndex] !== undefined ? row[gamesBackIndex] : '—';
      
      apiTeamsMap.set(fullTeamName.toLowerCase(), {
        record: `${wins}-${losses}`,
        wins,
        losses,
        gamesBack
      });
    });
    
    console.log(`✅ [Job ${jobId}] Fetched standings for ${apiTeamsMap.size} teams`);
    
    await dataStore.updateUpdateStatus(jobId, {
      message: 'NBA API data received, loading teams...',
      progress: 0
    });
    
    // Get all DB teams
    const [easternTeams, westernTeams] = await Promise.all([
      dataStore.getTeamsByLeague('Eastern Conference', season),
      dataStore.getTeamsByLeague('Western Conference', season)
    ]);
    const dbTeams = [...easternTeams, ...westernTeams];
    
    console.log(`📊 [Job ${jobId}] Found ${dbTeams.length} teams in database`);
    
    await dataStore.updateUpdateStatus(jobId, {
      message: 'Updating team records...',
      total: dbTeams.length,
      progress: 0
    });
    
    // Update teams sequentially to track progress accurately
    let recordsUpdated = 0;
    
    for (let index = 0; index < dbTeams.length; index++) {
      const dbTeam = dbTeams[index];
      
      try {
        const normalizedName = dbTeam.name.toLowerCase();
        let apiTeam = apiTeamsMap.get(normalizedName);
        
        // Try partial match if exact match fails
        if (!apiTeam) {
          const teamNameOnly = dbTeam.name.split(' ').slice(-1)[0].toLowerCase();
          for (const [apiName, apiData] of apiTeamsMap) {
            if (apiName.includes(teamNameOnly)) {
              apiTeam = apiData;
              break;
            }
          }
        }
        
        if (apiTeam) {
          await dataStore.updateTeam(dbTeam.id, apiTeam);
          recordsUpdated++;
        }
        
        // Update progress every 3 teams for smoother updates
        if ((index + 1) % 3 === 0 || index === dbTeams.length - 1) {
          await dataStore.updateUpdateStatus(jobId, {
            progress: index + 1,
            teamsUpdated: recordsUpdated,
            message: `Updating teams: ${index + 1}/${dbTeams.length}`
          });
          console.log(`📊 [Job ${jobId}] Progress: ${index + 1}/${dbTeams.length} teams`);
        }
      } catch (error) {
        console.error(`❌ [Job ${jobId}] Error updating ${dbTeam.name}:`, error);
      }
    }
    
    // Mark as complete
    const completedAt = new Date().toISOString();
    await dataStore.updateUpdateStatus(jobId, {
      status: 'completed',
      progress: dbTeams.length,
      teamsUpdated: recordsUpdated,
      message: `Successfully updated ${recordsUpdated}/${dbTeams.length} teams`,
      completedAt
    });
    
    console.log(`✅ [Job ${jobId}] Update complete: ${recordsUpdated}/${dbTeams.length} teams`);
    
  } catch (error) {
    console.error(`❌ [Job ${jobId}] Update failed:`, error);
    await dataStore.updateUpdateStatus(jobId, {
      status: 'failed',
      error: error.message,
      message: `Update failed: ${error.message}`,
      completedAt: new Date().toISOString()
    });
  }
}

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

    // Draft Status queries
    getDraftStatus: async (_, { league, season }) => {
      console.log('🔍 getDraftStatus called with:', { league, season });
      const startTime = Date.now();
      
      const result = await dataStore.getDraftStatus(league, season);
      
      const endTime = Date.now();
      console.log(`✅ getDraftStatus completed in ${endTime - startTime}ms`);
      return result;
    },

    getAllDraftStatuses: async () => {
      console.log('🔍 getAllDraftStatuses called');
      const startTime = Date.now();
      
      const result = await dataStore.getAllDraftStatuses();
      
      const endTime = Date.now();
      console.log(`✅ getAllDraftStatuses completed in ${endTime - startTime}ms, returned ${result.length} statuses`);
      return result;
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

    // Update Status (for async operations)
    getUpdateStatus: async (_, { id }) => {
      return await dataStore.getUpdateStatus(id);
    },

    getActiveUpdates: async (_, { league, season }) => {
      return await dataStore.getActiveUpdates(league, season);
    },

    // Cognito Users
    listCognitoUsers: async () => {
      console.log('🔍 listCognitoUsers called');
      const startTime = Date.now();
      
      try {
        const userPoolId = process.env.COGNITO_USER_POOL_ID || process.env.REACT_APP_COGNITO_USER_POOL_ID;
        
        if (!userPoolId) {
          console.error('❌ COGNITO_USER_POOL_ID not configured');
          throw new Error('Cognito User Pool ID not configured');
        }
        
        const client = new CognitoIdentityProviderClient({ 
          region: process.env.AWS_REGION || 'us-east-1' 
        });
        
        const allUsers = [];
        let paginationToken = null;
        
        // Paginate through all users
        do {
          const command = new ListUsersCommand({
            UserPoolId: userPoolId,
            Limit: 60,
            ...(paginationToken && { PaginationToken: paginationToken })
          });
          
          const response = await client.send(command);
          
          if (response.Users) {
            response.Users.forEach(user => {
              const attributes = {};
              (user.Attributes || []).forEach(attr => {
                attributes[attr.Name] = attr.Value;
              });
              
              allUsers.push({
                username: user.Username,
                email: attributes.email || null,
                name: attributes.name || attributes.preferred_username || attributes.email || user.Username,
                status: user.UserStatus || 'UNKNOWN',
                enabled: user.Enabled !== false,
                createdAt: user.UserCreateDate ? user.UserCreateDate.toISOString() : null,
                lastModified: user.UserLastModifiedDate ? user.UserLastModifiedDate.toISOString() : null
              });
            });
          }
          
          paginationToken = response.PaginationToken;
        } while (paginationToken);
        
        const endTime = Date.now();
        console.log(`✅ listCognitoUsers completed in ${endTime - startTime}ms, returned ${allUsers.length} users`);
        
        return allUsers;
      } catch (error) {
        console.error('❌ Error listing Cognito users:', error);
        throw new Error(`Failed to list users: ${error.message}`);
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

    updateTeamApiData: async (_, { id, input }) => {
      console.log('🔄 UpdateTeamApiData called with:', { id, input });
      const updatedTeam = await dataStore.updateTeam(id, input);
      if (!updatedTeam) {
        console.error('❌ Team not found. ID:', id);
        throw new Error(`Team not found. ID: ${id}`);
      }
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

    // Draft Status mutations
    updateDraftStatus: async (_, { league, season, status }) => {
      console.log('🔄 updateDraftStatus called with:', { league, season, status });
      const startTime = Date.now();
      
      const result = await dataStore.updateDraftStatus(league, season, status);
      
      const endTime = Date.now();
      console.log(`✅ updateDraftStatus completed in ${endTime - startTime}ms`);
      return result;
    },

    // Update NBA teams from API (server-side, bypasses CORS)
    updateNbaTeamsFromApi: async (_, { league, season }) => {
      try {
        // Minimal logging for performance
        
        // Import node-fetch for server-side API calls
        const fetch = (await import('node-fetch')).default;
        const NBA_API_BASE = 'https://stats.nba.com/stats';
        const ODDS_API_BASE = 'https://api.the-odds-api.com/v4';
        const ODDS_API_KEY = process.env.REACT_APP_ODDS_API_KEY || process.env.ODDS_API_KEY;
        
        // Determine NBA season format
        // Our "2025" season = NBA 2025-26 season (starts in 2025, ends in 2026)
        // Our "2024" season = NBA 2024-25 season (starts in 2024, ends in 2025)
        const seasonYear = parseInt(season);
        const seasonEnd = seasonYear + 1;
        const nbaSeason = `${seasonYear}-${String(seasonEnd).slice(-2)}`;
        
        // Step 1: Fetch NBA standings
        const standingsUrl = `${NBA_API_BASE}/leaguestandingsv3?LeagueID=00&Season=${nbaSeason}&SeasonType=Regular%20Season`;
        
        const standingsResponse = await fetch(standingsUrl, {
          method: 'GET',
          headers: {
            'Referer': 'https://www.nba.com/',
            'Origin': 'https://www.nba.com',
            'Accept': 'application/json',
            'Accept-Language': 'en-US,en;q=0.9',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
          }
        });
        
        if (!standingsResponse.ok) {
          throw new Error(`NBA API error: ${standingsResponse.status}`);
        }
        
        const standingsData = await standingsResponse.json();
        
        // Step 2: Skip odds fetching for performance
        let oddsMap = {};
        let oddsUpdated = 0;
        
        /*
        // Fetch odds with timeout (disabled for speed)
        if (ODDS_API_KEY && ODDS_API_KEY !== 'YOUR_API_KEY') {
          try {
            const endpoint = 'basketball_nba_championship_winner';
            const oddsUrl = `${ODDS_API_BASE}/sports/${endpoint}/odds?regions=us&markets=outrights&oddsFormat=american&apiKey=${ODDS_API_KEY}`;
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);
            
            const oddsResponse = await fetch(oddsUrl, { signal: controller.signal });
            clearTimeout(timeoutId);
              
            if (oddsResponse.ok) {
              const oddsData = await oddsResponse.json();
              // Process odds data...
            }
          } catch (error) {
            console.log(`⚠️  Odds fetch failed/timeout: ${error.message}`);
          }
        }
        */
        
        // Step 3: Get teams from database (parallel queries for NBA)
        let dbTeams = [];
        
        if (league.toLowerCase() === 'nba') {
          const [easternTeams, westernTeams] = await Promise.all([
            dataStore.getTeamsByLeague('Eastern Conference', season),
            dataStore.getTeamsByLeague('Western Conference', season)
          ]);
          dbTeams = [...easternTeams, ...westernTeams];
        } else {
          dbTeams = await dataStore.getTeamsByLeague(league, season);
        }
        
        // Step 4: Transform NBA API data
        if (!standingsData || !standingsData.resultSets || standingsData.resultSets.length === 0) {
          throw new Error('Invalid NBA API response');
        }
        
        const standingsResult = standingsData.resultSets[0];
        const headers = standingsResult.headers || [];
        const rowSet = standingsResult.rowSet || [];
        
        const teamNameIndex = headers.indexOf('TeamName');
        const teamCityIndex = headers.indexOf('TeamCity');
        const winsIndex = headers.indexOf('WINS');
        const lossesIndex = headers.indexOf('LOSSES');
        const gamesBackIndex = headers.indexOf('GB');
        
        const apiTeams = [];
        rowSet.forEach((row) => {
          const teamCity = teamCityIndex >= 0 ? (row[teamCityIndex] || '') : '';
          const teamName = teamNameIndex >= 0 ? (row[teamNameIndex] || '') : '';
          const fullTeamName = teamCity && teamName ? `${teamCity} ${teamName}` : teamName;
          const wins = winsIndex >= 0 ? (row[winsIndex] || 0) : 0;
          const losses = lossesIndex >= 0 ? (row[lossesIndex] || 0) : 0;
          const gamesBack = gamesBackIndex >= 0 && row[gamesBackIndex] !== undefined && row[gamesBackIndex] !== null ? row[gamesBackIndex] : '—';
          
          apiTeams.push({
            name: fullTeamName,
            record: `${wins}-${losses}`,
            wins,
            losses,
            gamesBack
          });
        });
        
        // Step 5: Update teams (use parallel updates for speed)
        // Only update teams that match the requested season
        let recordsUpdated = 0;
        
        // Build array of update promises
        const updatePromises = dbTeams.map(async (dbTeam) => {
          try {
            // Only update teams for the requested season
            if (dbTeam.season !== season) {
              return null; // Skip teams from different seasons
            }
            
            // Find matching API team
            let apiTeam = apiTeams.find(api => 
              api.name === dbTeam.name || 
              (api.name && dbTeam.name && api.name.toLowerCase() === dbTeam.name.toLowerCase())
            );
            
            // Try matching by team name only
            if (!apiTeam && dbTeam.name) {
              const dbTeamNameOnly = dbTeam.name.split(' ').slice(-2).join(' ');
              apiTeam = apiTeams.find(api => 
                api.name.toLowerCase().includes(dbTeamNameOnly.toLowerCase())
              );
            }
            
            // Special case: Los Angeles Clippers might be "LA Clippers" in API
            if (!apiTeam && dbTeam.name && dbTeam.name.includes('Clippers')) {
              apiTeam = apiTeams.find(api => 
                api.name && (api.name.includes('Clippers') || api.name.includes('LA Clippers'))
              );
            }
            
            if (apiTeam) {
              // Get odds for this team - try multiple name variations
              const normalizedName = dbTeam.name.toLowerCase().replace(/[^a-z\s]/g, '').trim();
              let odds = oddsMap[normalizedName] || null;
              
              // If not found, try matching by team name only (last 1-2 words)
              if (!odds) {
                const nameParts = normalizedName.split(/\s+/);
                // Try last word first (e.g., "Lakers")
                if (nameParts.length > 0) {
                  odds = oddsMap[nameParts[nameParts.length - 1]] || null;
                }
                // Try last 2 words (e.g., "LA Lakers")
                if (!odds && nameParts.length >= 2) {
                  odds = oddsMap[nameParts.slice(-2).join(' ')] || null;
                }
                // Try without city prefix
                if (!odds && nameParts.length >= 2) {
                  const cityPart = nameParts[0];
                  if (cityPart === 'los' && nameParts.length >= 2 && nameParts[1] === 'angeles') {
                    odds = oddsMap[`la ${nameParts.slice(2).join(' ')}`] || null;
                  }
                  if (!odds) {
                    odds = oddsMap[nameParts.slice(-1).join(' ')] || null;
                  }
                }
              }
              
              // Update team
              const updateData = {
                record: apiTeam.record,
                wins: apiTeam.wins,
                losses: apiTeam.losses,
                gamesBack: apiTeam.gamesBack
              };
              
              if (odds) {
                updateData.odds = odds;
                oddsUpdated++;
              }
              
              const updatedTeam = await dataStore.updateTeam(dbTeam.id, updateData);
              return { success: true, hasOdds: !!odds };
            }
            return null;
          } catch (error) {
            console.error(`Error updating ${dbTeam.name}:`, error);
            return null;
          }
        });
        
        // Execute all updates in parallel
        const results = await Promise.all(updatePromises);
        recordsUpdated = results.filter(r => r && r.success).length;
        
        return {
          success: true,
          teamsUpdated: recordsUpdated,
          oddsUpdated: oddsUpdated,
          recordsUpdated: recordsUpdated,
          totalTeams: dbTeams.length,
          error: null,
          message: `Successfully updated ${recordsUpdated} teams with records and ${oddsUpdated} teams with odds`
        };
        
      } catch (error) {
        console.error('Error in updateNbaTeamsFromApi:', error);
        return {
          success: false,
          teamsUpdated: 0,
          oddsUpdated: 0,
          recordsUpdated: 0,
          totalTeams: 0,
          error: error.message,
          message: `Failed to update NBA teams: ${error.message}`
        };
      }
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

    // Update standings for a batch of teams (avoids timeout by processing subset)
    updateTeamStandingsBatch: async (_, { league, season, teamIds }) => {
      try {
        const fetch = (await import('node-fetch')).default;
        const NBA_API_BASE = 'https://stats.nba.com/stats';
        
        // Determine NBA season format
        const seasonYear = parseInt(season);
        const seasonEnd = seasonYear + 1;
        const nbaSeason = `${seasonYear}-${String(seasonEnd).slice(-2)}`;
        
        // Fetch NBA standings once for all teams
        const standingsUrl = `${NBA_API_BASE}/leaguestandingsv3?LeagueID=00&Season=${nbaSeason}&SeasonType=Regular%20Season`;
        
        const standingsResponse = await fetch(standingsUrl, {
          method: 'GET',
          headers: {
            'Referer': 'https://www.nba.com/',
            'Origin': 'https://www.nba.com',
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
          }
        });
        
        if (!standingsResponse.ok) {
          throw new Error(`NBA API error: ${standingsResponse.status}`);
        }
        
        const standingsData = await standingsResponse.json();
        const standingsResult = standingsData.resultSets[0];
        const headers = standingsResult.headers || [];
        const rowSet = standingsResult.rowSet || [];
        
        const teamNameIndex = headers.indexOf('TeamName');
        const teamCityIndex = headers.indexOf('TeamCity');
        const winsIndex = headers.indexOf('WINS');
        const lossesIndex = headers.indexOf('LOSSES');
        const gamesBackIndex = headers.indexOf('GB');
        
        // Build API teams map
        const apiTeamsMap = new Map();
        rowSet.forEach((row) => {
          const teamCity = teamCityIndex >= 0 ? (row[teamCityIndex] || '') : '';
          const teamName = teamNameIndex >= 0 ? (row[teamNameIndex] || '') : '';
          const fullTeamName = teamCity && teamName ? `${teamCity} ${teamName}` : teamName;
          const wins = winsIndex >= 0 ? (row[winsIndex] || 0) : 0;
          const losses = lossesIndex >= 0 ? (row[lossesIndex] || 0) : 0;
          const gamesBack = gamesBackIndex >= 0 && row[gamesBackIndex] !== undefined ? row[gamesBackIndex] : '—';
          
          apiTeamsMap.set(fullTeamName.toLowerCase(), {
            record: `${wins}-${losses}`,
            wins,
            losses,
            gamesBack
          });
        });
        
        // Update only the specified teams in parallel
        let recordsUpdated = 0;
        const updatePromises = teamIds.map(async (teamId) => {
          try {
            const dbTeam = await dataStore.getTeam(teamId);
            if (!dbTeam) return false;
            
            // Find matching API team
            const normalizedName = dbTeam.name.toLowerCase();
            let apiTeam = apiTeamsMap.get(normalizedName);
            
            // Try partial match if exact match fails
            if (!apiTeam) {
              const teamNameOnly = dbTeam.name.split(' ').slice(-1)[0].toLowerCase();
              for (const [apiName, apiData] of apiTeamsMap) {
                if (apiName.includes(teamNameOnly)) {
                  apiTeam = apiData;
                  break;
                }
              }
            }
            
            if (apiTeam) {
              await dataStore.updateTeam(teamId, apiTeam);
              return true;
            }
            return false;
          } catch (error) {
            console.error(`Error updating ${teamId}:`, error);
            return false;
          }
        });
        
        const results = await Promise.all(updatePromises);
        recordsUpdated = results.filter(r => r).length;
        
        return {
          success: true,
          teamsUpdated: recordsUpdated,
          oddsUpdated: 0,
          recordsUpdated,
          totalTeams: teamIds.length,
          error: null,
          message: `Updated ${recordsUpdated}/${teamIds.length} teams in batch`
        };
      } catch (error) {
        return {
          success: false,
          teamsUpdated: 0,
          oddsUpdated: 0,
          recordsUpdated: 0,
          totalTeams: 0,
          error: error.message,
          message: `Failed: ${error.message}`
        };
      }
    },

    // Update team odds only (faster, skips standings fetch)
    updateTeamOdds: async (_, { league, season }) => {
      try {
        const fetch = (await import('node-fetch')).default;
        const ODDS_API_BASE = 'https://api.the-odds-api.com/v4';
        const ODDS_API_KEY = process.env.REACT_APP_ODDS_API_KEY || process.env.ODDS_API_KEY;
        
        let oddsMap = {};
        let oddsUpdated = 0;
        
        // Fetch odds for the appropriate sport
        if (league.toLowerCase() === 'nba') {
          if (ODDS_API_KEY && ODDS_API_KEY !== 'YOUR_API_KEY') {
            const endpoint = 'basketball_nba_championship_winner';
            const oddsUrl = `${ODDS_API_BASE}/sports/${endpoint}/odds?regions=us&markets=outrights&oddsFormat=american&apiKey=${ODDS_API_KEY}`;
            
            const oddsResponse = await fetch(oddsUrl);
            if (oddsResponse.ok) {
              const oddsData = await oddsResponse.json();
              if (oddsData && !oddsData.error_code && Array.isArray(oddsData)) {
                oddsData.forEach(game => {
                  if (game.bookmakers && game.bookmakers.length > 0) {
                    const bookmaker = game.bookmakers[0];
                    if (bookmaker.markets && bookmaker.markets.length > 0) {
                      const championshipMarket = bookmaker.markets.find(m => 
                        m.key === 'championship' || m.key === 'outrights'
                      ) || bookmaker.markets[0];
                      
                      if (championshipMarket.outcomes) {
                        championshipMarket.outcomes.forEach(outcome => {
                          const teamName = outcome.name.toLowerCase().replace(/[^a-z\s]/g, '').trim();
                          const odds = outcome.price > 0 ? `+${outcome.price}` : `${outcome.price}`;
                          oddsMap[teamName] = odds;
                          const nameParts = teamName.split(/\s+/);
                          if (nameParts.length > 0) {
                            oddsMap[nameParts[nameParts.length - 1]] = odds;
                          }
                        });
                      }
                    }
                  }
                });
              }
            }
          }
        }
        
        // Get teams from database
        let dbTeams = [];
        if (league.toLowerCase() === 'nba') {
          const [easternTeams, westernTeams] = await Promise.all([
            dataStore.getTeamsByLeague('Eastern Conference', season),
            dataStore.getTeamsByLeague('Western Conference', season)
          ]);
          dbTeams = [...easternTeams, ...westernTeams];
        } else {
          dbTeams = await dataStore.getTeamsByLeague(league, season);
        }
        
        // Update odds for each team in parallel
        const updatePromises = dbTeams.map(async (team) => {
          const normalizedName = team.name.toLowerCase().replace(/[^a-z\s]/g, '').trim();
          let odds = oddsMap[normalizedName];
          
          if (!odds) {
            const nameParts = normalizedName.split(/\s+/);
            if (nameParts.length > 0) {
              odds = oddsMap[nameParts[nameParts.length - 1]];
            }
          }
          
          if (odds) {
            await dataStore.updateTeam(team.id, { odds });
            return true;
          }
          return false;
        });
        
        const results = await Promise.all(updatePromises);
        oddsUpdated = results.filter(r => r).length;
        
        return {
          success: true,
          teamsUpdated: 0,
          oddsUpdated,
          recordsUpdated: 0,
          totalTeams: dbTeams.length,
          error: null,
          message: `Successfully updated odds for ${oddsUpdated} teams`
        };
      } catch (error) {
        return {
          success: false,
          teamsUpdated: 0,
          oddsUpdated: 0,
          recordsUpdated: 0,
          totalTeams: 0,
          error: error.message,
          message: `Failed to update odds: ${error.message}`
        };
      }
    },

    // Async standings update (runs in background, no timeout)
    startNbaStandingsUpdate: async (_, { league, season }) => {
      const { v4: uuidv4 } = await import('uuid');
      const jobId = uuidv4();
      const now = new Date().toISOString();

      try {
        // Create initial job status
        await dataStore.createUpdateStatus({
          id: jobId,
          league,
          season,
          updateType: 'standings',
          status: 'in_progress',
          progress: 0,
          total: 0,
          message: 'Starting standings update...',
          teamsUpdated: 0,
          error: null,
          startedAt: now,
          completedAt: null
        });

        // Start the async update (don't await it!)
        runStandingsUpdateInBackground(jobId, league, season).catch(err => {
          console.error(`❌ Background update failed for job ${jobId}:`, err);
        });

        // Return immediately
        return {
          id: jobId,
          league,
          season,
          updateType: 'standings',
          status: 'in_progress',
          progress: 0,
          total: 0,
          message: 'Update started',
          teamsUpdated: 0,
          error: null,
          startedAt: now,
          completedAt: null
        };
      } catch (error) {
        console.error('❌ Failed to start update:', error);
        return {
          id: jobId,
          league,
          season,
          updateType: 'standings',
          status: 'failed',
          progress: 0,
          total: 0,
          message: 'Failed to start update',
          teamsUpdated: 0,
          error: error.message,
          startedAt: now,
          completedAt: now
        };
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
