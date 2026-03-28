#!/usr/bin/env node

/**
 * Script to update NBA team records from NBA.com Stats API
 * This script runs server-side to avoid CORS issues
 */

require('dotenv').config();

const NBA_API_BASE = 'https://stats.nba.com/stats';
const GRAPHQL_ENDPOINT = process.env.REACT_APP_GRAPHQL_ENDPOINT || 'http://localhost:4000/graphql';

// Use DynamoDB service if available
const USE_DYNAMODB = process.env.USE_DYNAMODB === 'true' || process.env.REACT_APP_USE_DIRECT_DYNAMODB === 'true';

async function fetchNbaStandings(season = null) {
  // Ensure fetch is available
  if (!fetch) {
    const nodeFetch = await import('node-fetch');
    fetch = nodeFetch.default || nodeFetch;
  }

  // Determine NBA season format
  // Our "2025" season = NBA 2025-26 season (starts in 2025, ends in 2026)
  // Our "2024" season = NBA 2024-25 season (starts in 2024, ends in 2025)
  let seasonParam = season;
  if (!seasonParam) {
    // Default: use current year's NBA season (e.g., 2025 → "2025-26")
    const currentYear = new Date().getFullYear();
    const seasonEnd = currentYear + 1;
    seasonParam = `${currentYear}-${String(seasonEnd).slice(-2)}`;
  } else if (typeof seasonParam === 'number' || /^\d{4}$/.test(seasonParam)) {
    // If season is a year like "2025" or 2025, convert to NBA season format
    const seasonYear = parseInt(seasonParam);
    const seasonEnd = seasonYear + 1;
    seasonParam = `${seasonYear}-${String(seasonEnd).slice(-2)}`;
  }

  const standingsUrl = `${NBA_API_BASE}/leaguestandingsv3?LeagueID=00&Season=${seasonParam}&SeasonType=Regular%20Season`;
  
  console.log(`📡 Fetching NBA standings from: ${standingsUrl}`);
  
  const response = await fetch(standingsUrl, {
    method: 'GET',
    headers: {
      'Referer': 'https://www.nba.com/',
      'Origin': 'https://www.nba.com',
      'Accept': 'application/json',
      'Accept-Language': 'en-US,en;q=0.9',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    }
  });

  if (!response.ok) {
    throw new Error(`NBA API error: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

function transformNbaData(apiData) {
  if (!apiData || !apiData.resultSets || apiData.resultSets.length === 0) {
    return [];
  }

  const standingsData = apiData.resultSets[0];
  const headers = standingsData.headers || [];
  const rowSet = standingsData.rowSet || [];

  // NBA API uses mixed case headers
  const teamNameIndex = headers.indexOf('TeamName');
  const teamCityIndex = headers.indexOf('TeamCity');
  const winsIndex = headers.indexOf('WINS');
  const lossesIndex = headers.indexOf('LOSSES');
  const conferenceIndex = headers.indexOf('Conference');
  const divisionIndex = headers.indexOf('Division');
  const gamesBackIndex = headers.indexOf('GB');

  const teams = [];

  rowSet.forEach((row) => {
    const teamCity = row[teamCityIndex] || '';
    const teamName = row[teamNameIndex] || '';
    const fullTeamName = teamCity && teamName ? `${teamCity} ${teamName}` : teamName;
    const wins = winsIndex >= 0 ? (row[winsIndex] || 0) : 0;
    const losses = lossesIndex >= 0 ? (row[lossesIndex] || 0) : 0;
    const conference = conferenceIndex >= 0 ? (row[conferenceIndex] || '') : '';
    const division = divisionIndex >= 0 ? (row[divisionIndex] || '') : '';
    const gamesBack = gamesBackIndex >= 0 && row[gamesBackIndex] !== undefined && row[gamesBackIndex] !== null ? row[gamesBackIndex] : '—';

    teams.push({
      name: fullTeamName,
      city: teamCity,
      teamName: teamName,
      record: `${wins}-${losses}`,
      wins: wins,
      losses: losses,
      league: conference,
      division: division,
      gamesBack: gamesBack
    });
  });

  return teams;
}

async function getTeamsFromDatabase(league, season) {
  // Ensure fetch is available
  if (!fetch) {
    const nodeFetch = await import('node-fetch');
    fetch = nodeFetch.default || nodeFetch;
  }

  try {
    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query {
            getTeams(league: "${league}", season: "${season}") {
              id
              name
              record
              wins
              losses
              gamesBack
              league
              division
              season
            }
          }
        `
      })
    });

    const data = await response.json();
    return data.data?.getTeams || [];
  } catch (error) {
    console.error('Error fetching teams from database:', error);
    return [];
  }
}

async function updateTeam(teamId, updateData) {
  // Ensure fetch is available
  if (!fetch) {
    const nodeFetch = await import('node-fetch');
    fetch = nodeFetch.default || nodeFetch;
  }

  try {
    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation UpdateTeam($input: UpdateTeamInput!) {
            updateTeam(input: $input) {
              id
              name
              record
              wins
              losses
              gamesBack
            }
          }
        `,
        variables: {
          input: {
            id: teamId,
            ...updateData
          }
        }
      })
    });

    const result = await response.json();
    if (result.errors) {
      throw new Error(result.errors[0].message);
    }
    return result.data.updateTeam;
  } catch (error) {
    console.error(`Error updating team ${teamId}:`, error);
    throw error;
  }
}

async function updateNbaData() {
  console.log('🏀 Updating NBA team data from NBA.com Stats API...\n');

  try {
    // Step 1: Fetch NBA standings from API for both 2024 and 2025 seasons
    console.log('📡 Step 1: Fetching NBA standings from API...');
    
    // Fetch 2024-25 season data (for our "2024" teams)
    console.log('   Fetching NBA 2024-25 season data...');
    const apiData2024 = await fetchNbaStandings('2024');
    const apiTeams2024 = transformNbaData(apiData2024);
    console.log(`   ✅ Fetched ${apiTeams2024.length} teams for 2024-25 season\n`);
    
    // Fetch 2025-26 season data (for our "2025" teams)
    console.log('   Fetching NBA 2025-26 season data...');
    const apiData2025 = await fetchNbaStandings('2025');
    const apiTeams2025 = transformNbaData(apiData2025);
    console.log(`   ✅ Fetched ${apiTeams2025.length} teams for 2025-26 season\n`);

    // Step 2: Get teams from database (for both 2024 and 2025 seasons)
    console.log('📊 Step 2: Fetching teams from database...');
    const dbTeams2024 = await getTeamsFromDatabase('nba', '2024');
    const dbTeams2025 = await getTeamsFromDatabase('nba', '2025');
    console.log(`✅ Found ${dbTeams2024.length} teams in database for 2024 season`);
    console.log(`✅ Found ${dbTeams2025.length} teams in database for 2025 season`);
    console.log(`📋 Sample 2024 DB team names: ${dbTeams2024.slice(0, 3).map(t => t.name).join(', ')}...`);
    console.log(`📋 Sample 2025 DB team names: ${dbTeams2025.slice(0, 3).map(t => t.name).join(', ')}...\n`);

    // Step 3: Match and update teams
    console.log('🔄 Step 3: Matching and updating teams...');
    console.log('   - Updating 2024 teams with 2024-25 season data');
    console.log('   - Updating 2025 teams with 2025-26 season data\n');
    let updatedCount = 0;
    let updated2024Count = 0;
    let updated2025Count = 0;
    let failedCount = 0;
    let skipped2024Count = 0;

    // Update 2024 teams with 2024-25 season data
    for (const dbTeam of dbTeams2024) {
      try {
        // Find matching API team by exact name
        let apiTeam = apiTeams2024.find(api => 
          api.name === dbTeam.name || 
          (api.name && dbTeam.name && api.name.toLowerCase() === dbTeam.name.toLowerCase())
        );

        // If not found, try matching by team name only (without city)
        if (!apiTeam && dbTeam.name) {
          const dbTeamNameOnly = dbTeam.name.split(' ').slice(-2).join(' ');
          apiTeam = apiTeams2024.find(api => 
            api.teamName && api.teamName.toLowerCase() === dbTeamNameOnly.toLowerCase() ||
            (api.name && api.name.toLowerCase().includes(dbTeamNameOnly.toLowerCase()))
          );
        }

        // Special case: Los Angeles Clippers might be "LA Clippers" in API
        if (!apiTeam && dbTeam.name && dbTeam.name.includes('Clippers')) {
          apiTeam = apiTeams2024.find(api => 
            api.name && (api.name.includes('Clippers') || api.name.includes('LA Clippers'))
          );
        }

        if (!apiTeam) {
          console.warn(`⚠️  No API match found for: "${dbTeam.name}" (season: ${dbTeam.season})`);
          failedCount++;
          continue;
        }

        // Prepare update data
        const updateData = {
          record: apiTeam.record,
          wins: apiTeam.wins,
          losses: apiTeam.losses,
          gamesBack: apiTeam.gamesBack
        };

        console.log(`📡 Updating ${dbTeam.name} (season: ${dbTeam.season}): ${updateData.record} (${updateData.wins}-${updateData.losses}) - GB: ${updateData.gamesBack}`);

        // Update team
        await updateTeam(dbTeam.id, updateData);
        updatedCount++;
        updated2024Count++;
      } catch (error) {
        console.error(`❌ Error updating ${dbTeam.name}:`, error.message);
        failedCount++;
      }
    }
    
    // Update 2025 teams with 2025-26 season data
    for (const dbTeam of dbTeams2025) {
      try {
        // Find matching API team by exact name
        let apiTeam = apiTeams2025.find(api => 
          api.name === dbTeam.name || 
          (api.name && dbTeam.name && api.name.toLowerCase() === dbTeam.name.toLowerCase())
        );

        // If not found, try matching by team name only (without city)
        if (!apiTeam && dbTeam.name) {
          const dbTeamNameOnly = dbTeam.name.split(' ').slice(-2).join(' ');
          apiTeam = apiTeams2025.find(api => 
            api.teamName && api.teamName.toLowerCase() === dbTeamNameOnly.toLowerCase() ||
            (api.name && api.name.toLowerCase().includes(dbTeamNameOnly.toLowerCase()))
          );
        }

        // Special case: Los Angeles Clippers might be "LA Clippers" in API
        if (!apiTeam && dbTeam.name && dbTeam.name.includes('Clippers')) {
          apiTeam = apiTeams2025.find(api => 
            api.name && (api.name.includes('Clippers') || api.name.includes('LA Clippers'))
          );
        }

        if (!apiTeam) {
          console.warn(`⚠️  No API match found for: "${dbTeam.name}" (season: ${dbTeam.season})`);
          failedCount++;
          continue;
        }

        // Prepare update data
        const updateData = {
          record: apiTeam.record,
          wins: apiTeam.wins,
          losses: apiTeam.losses,
          gamesBack: apiTeam.gamesBack
        };

        console.log(`📡 Updating ${dbTeam.name} (season: ${dbTeam.season}): ${updateData.record} (${updateData.wins}-${updateData.losses}) - GB: ${updateData.gamesBack}`);

        // Update team
        await updateTeam(dbTeam.id, updateData);
        updatedCount++;
        updated2025Count++;
      } catch (error) {
        console.error(`❌ Error updating ${dbTeam.name}:`, error.message);
        failedCount++;
      }
    }

    console.log(`\n✅ Update complete!`);
    console.log(`   Updated: ${updatedCount} teams total`);
    console.log(`   - 2024 teams (2024-25 season): ${updated2024Count}`);
    console.log(`   - 2025 teams (2025-26 season): ${updated2025Count}`);
    console.log(`   - Failed: ${failedCount} teams`);

  } catch (error) {
    console.error('❌ Error updating NBA data:', error);
    process.exit(1);
  }
}

// Run the update
updateNbaData();

