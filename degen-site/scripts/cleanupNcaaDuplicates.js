#!/usr/bin/env node

// Load environment variables from .env file
require('dotenv').config();

// GraphQL endpoint
const GRAPHQL_ENDPOINT = process.env.REACT_APP_GRAPHQL_ENDPOINT || 'http://localhost:4000/graphql';

// Simple GraphQL client using fetch
async function graphqlRequest(query, variables = {}) {
  try {
    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables
      })
    });

    const result = await response.json();
    
    if (result.errors) {
      throw new Error(`GraphQL Error: ${result.errors[0].message}`);
    }
    
    return result.data;
  } catch (error) {
    console.error('GraphQL request failed:', error);
    throw error;
  }
}

// Get all NCAA teams
async function getNcaaTeams() {
  const data = await graphqlRequest(`
    query GetNcaaTeams {
      getTeams(league: "ncaa", season: "2025") {
        id
        name
        league
        owner
        createdAt
      }
    }
  `);
  
  return data.getTeams;
}

// Delete a team
async function deleteTeam(teamId) {
  const data = await graphqlRequest(`
    mutation DeleteTeam($id: ID!) {
      deleteTeam(id: $id)
    }
  `, { id: teamId });
  
  return data.deleteTeam;
}

// Create a team using mapping data
async function createTeam(teamData) {
  const data = await graphqlRequest(`
    mutation CreateTeam($input: TeamInput!) {
      createTeam(input: $input) {
        id
        name
        league
        owner
      }
    }
  `, { input: teamData });
  
  return data.createTeam;
}

// Update a team
async function updateTeam(teamId, teamData) {
  const data = await graphqlRequest(`
    mutation UpdateTeam($input: UpdateTeamInput!) {
      updateTeam(input: $input) {
        id
        name
        league
        owner
      }
    }
  `, { input: { id: teamId, ...teamData } });
  
  return data.updateTeam;
}

// Get team mappings
async function getTeamMappings() {
  const data = await graphqlRequest(`
    query GetTeamMappings {
      getTeamMappings(league: "ncaa", season: "2025") {
        id
        cfbdId
        cfbdName
        cfbdMascot
        cfbdConference
        cfbdAbbreviation
        oddsApiName
        oddsApiOdds
        matchType
      }
    }
  `);
  
  return data.getTeamMappings;
}

// Fetch current odds from The Odds API
async function fetchOddsApiData() {
  const ODDS_API_KEY = process.env.REACT_APP_ODDS_API_KEY || process.env.ODDS_API_KEY;
  
  if (!ODDS_API_KEY) {
    throw new Error('ODDS_API_KEY not found in environment variables');
  }

  const url = `https://api.the-odds-api.com/v4/sports/americanfootball_ncaaf_championship_winner/odds?apiKey=${ODDS_API_KEY}&regions=us&oddsFormat=american&markets=outrights`;
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Odds API request failed: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  console.log(`✅ Fetched odds for ${data.length} teams from The Odds API`);
  
  // Create a map for easy lookup
  const oddsMap = new Map();
  data.forEach(team => {
    oddsMap.set(team.title, team);
  });
  
  return oddsMap;
}

// Main cleanup function
async function cleanupAndRepopulate() {
  try {
    console.log('🧹 Starting NCAA Football 2025 cleanup and repopulation...');
    
    // Step 1: Get all current NCAA teams
    console.log('📊 Fetching current NCAA teams...');
    const currentTeams = await getNcaaTeams();
    console.log(`✅ Found ${currentTeams.length} current NCAA teams`);
    
    // Step 2: Group teams by name to find duplicates
    const teamsByName = new Map();
    currentTeams.forEach(team => {
      if (!teamsByName.has(team.name)) {
        teamsByName.set(team.name, []);
      }
      teamsByName.get(team.name).push(team);
    });
    
    // Step 3: Find duplicates and keep the oldest one
    const duplicatesToDelete = [];
    const teamsToKeep = new Map();
    
    for (const [name, teams] of teamsByName) {
      if (teams.length > 1) {
        // Sort by creation date and keep the oldest
        teams.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        const keepTeam = teams[0];
        const deleteTeams = teams.slice(1);
        
        teamsToKeep.set(name, keepTeam);
        duplicatesToDelete.push(...deleteTeams);
        
        console.log(`🔍 Found ${teams.length} duplicates for "${name}" - keeping oldest, deleting ${deleteTeams.length}`);
      } else {
        teamsToKeep.set(name, teams[0]);
      }
    }
    
    // Step 4: Delete duplicates
    if (duplicatesToDelete.length > 0) {
      console.log(`🗑️ Deleting ${duplicatesToDelete.length} duplicate teams...`);
      let deletedCount = 0;
      
      for (const team of duplicatesToDelete) {
        try {
          await deleteTeam(team.id);
          deletedCount++;
          console.log(`✅ Deleted duplicate: ${team.name} (${team.id})`);
        } catch (error) {
          console.error(`❌ Failed to delete ${team.name}:`, error.message);
        }
        
        // Small delay to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      console.log(`✅ Successfully deleted ${deletedCount} duplicate teams`);
    } else {
      console.log('✅ No duplicates found');
    }
    
    // Step 5: Get team mappings and odds data
    console.log('📊 Fetching team mappings...');
    const mappings = await getTeamMappings();
    console.log(`✅ Found ${mappings.length} team mappings`);
    
    console.log('📡 Fetching current odds...');
    const oddsMap = await fetchOddsApiData();
    
    // Step 6: Create/update teams using mappings
    console.log('🔄 Creating/updating teams using mappings...');
    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    
    for (const mapping of mappings) {
      try {
        const existingTeam = teamsToKeep.get(mapping.cfbdName);
        const oddsData = oddsMap.get(mapping.oddsApiName);
        
        const teamData = {
          name: mapping.cfbdName,
          record: '0-0',
          league: 'NCAA',
          division: mapping.cfbdConference || 'FBS',
          wins: 0,
          losses: 0,
          gamesBack: '0',
          wildCardGamesBack: '0',
          owner: null,
          odds: oddsData ? `+${oddsData.bestPrice}` : '999999'
        };
        
        if (existingTeam) {
          // Update existing team
          console.log(`🔄 Updating existing team: ${mapping.cfbdName} (${oddsData ? `+${oddsData.bestPrice}` : 'no odds'})`);
          await updateTeam(existingTeam.id, teamData);
          updatedCount++;
        } else {
          // Create new team
          console.log(`➕ Creating new team: ${mapping.cfbdName} (${oddsData ? `+${oddsData.bestPrice}` : 'no odds'})`);
          await createTeam(teamData);
          createdCount++;
        }
        
        // Small delay to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`❌ Failed to process ${mapping.cfbdName}:`, error.message);
      }
    }
    
    // Step 7: Final summary
    console.log('\n📊 Cleanup and Repopulation Summary:');
    console.log(`   🗑️ Duplicates deleted: ${duplicatesToDelete.length}`);
    console.log(`   ➕ Teams created: ${createdCount}`);
    console.log(`   🔄 Teams updated: ${updatedCount}`);
    console.log(`   ⏭️ Teams skipped: ${skippedCount}`);
    console.log(`   📈 Total mappings processed: ${mappings.length}`);
    
    // Step 8: Verify final count
    const finalTeams = await getNcaaTeams();
    console.log(`   🎯 Final team count: ${finalTeams.length}`);
    
    console.log('\n✅ NCAA Football 2025 cleanup and repopulation complete!');
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  }
}

// Run the cleanup
cleanupAndRepopulate();
