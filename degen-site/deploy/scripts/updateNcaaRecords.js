require('dotenv').config();

// GraphQL client for Node.js
async function graphqlRequest(query, variables = {}) {
  const response = await fetch('http://localhost:4000/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      variables,
    }),
  });

  if (!response.ok) {
    throw new Error(`GraphQL request failed: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();
  
  if (result.errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
  }

  return result.data;
}

// Fetch existing NCAA teams from GraphQL
async function fetchExistingTeams() {
  const data = await graphqlRequest(`
    query GetTeams($league: String!, $season: String!) {
      getTeams(league: $league, season: $season) {
        id
        name
        record
        wins
        losses
        division
      }
    }
  `, { league: 'ncaa', season: '2025' });

  return data.getTeams || [];
}

// Fetch team records from CFBD API
async function fetchCfbdRecords(year = 2025) {
  const CFBD_API_KEY = process.env.CFBD_API_KEY;
  
  if (!CFBD_API_KEY) {
    throw new Error('CFBD_API_KEY environment variable is required');
  }

  console.log('📡 Fetching team records from CFBD API...');
  
  const url = `https://api.collegefootballdata.com/records?year=${year}`;
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${CFBD_API_KEY}`
    }
  });

  if (!response.ok) {
    throw new Error(`CFBD API request failed: ${response.status} ${response.statusText}`);
  }

  const records = await response.json();
  console.log(`✅ Fetched ${records.length} team records from CFBD API`);
  
  return records;
}

// Normalize team name for matching
function normalizeName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace('university', '')
    .replace('college', '')
    .replace('state', 'st')
    .trim();
}

// Team name mapping for better matching
const TEAM_NAME_MAPPING = {
  'Iowa State Cyclones': 'Iowa State',
  'Kansas State Wildcats': 'Kansas State',
  'Kansas Jayhawks': 'Kansas',
  'Fresno State Bulldogs': 'Fresno State',
  'Hawaii Rainbow Warriors': 'Hawai\'i',
  'Sam Houston Bearkats': 'Sam Houston',
  'Stanford Cardinal': 'Stanford',
  'UNLV Rebels': 'UNLV',
  'Western Kentucky Hilltoppers': 'Western Kentucky'
};

// Find matching team between GraphQL and CFBD data
function findMatchingTeam(graphqlTeam, cfbdRecords) {
  // First try direct mapping
  if (TEAM_NAME_MAPPING[graphqlTeam.name]) {
    const mappedName = TEAM_NAME_MAPPING[graphqlTeam.name];
    const cfbdRecord = cfbdRecords.find(record => record.team === mappedName);
    if (cfbdRecord) {
      return cfbdRecord;
    }
  }
  
  const graphqlName = normalizeName(graphqlTeam.name);
  
  for (const cfbdRecord of cfbdRecords) {
    const cfbdName = normalizeName(cfbdRecord.team);
    
    // Exact match
    if (graphqlName === cfbdName) {
      return cfbdRecord;
    }
    
    // Partial match for common variations
    if (graphqlName.includes(cfbdName) || cfbdName.includes(graphqlName)) {
      return cfbdRecord;
    }
  }
  
  return null;
}

// Update team record in GraphQL
async function updateTeamRecord(teamId, recordData) {
  const result = await graphqlRequest(`
    mutation UpdateTeam($input: UpdateTeamInput!) {
      updateTeam(input: $input) {
        id
        name
        record
        wins
        losses
        updatedAt
      }
    }
  `, { 
    input: { 
      id: teamId,
      record: recordData.record,
      wins: recordData.wins,
      losses: recordData.losses
    } 
  });

  return result.updateTeam;
}

// Main function
async function main() {
  try {
    console.log('🏈 Starting NCAA Football 2025 record update from CFBD API...');
    
    // Fetch existing teams from GraphQL
    console.log('📊 Fetching existing teams from GraphQL...');
    const existingTeams = await fetchExistingTeams();
    console.log(`✅ Found ${existingTeams.length} teams in GraphQL`);
    
    // Fetch team records from CFBD API
    const cfbdRecords = await fetchCfbdRecords(2025);
    
    // Update team records
    console.log('\n🔄 Updating team records...');
    let updatedCount = 0;
    let notFoundCount = 0;
    
    for (const team of existingTeams) {
      try {
        const cfbdRecord = findMatchingTeam(team, cfbdRecords);
        
        if (cfbdRecord) {
          const wins = cfbdRecord.total.wins || 0;
          const losses = cfbdRecord.total.losses || 0;
          const record = `${wins}-${losses}`;
          
          // Only update if record has changed
          if (team.record !== record) {
            console.log(`✅ Updating ${team.name}: ${team.record} → ${record}`);
            await updateTeamRecord(team.id, {
              record,
              wins,
              losses
            });
            updatedCount++;
          } else {
            console.log(`⏭️ ${team.name}: Record already up to date (${record})`);
          }
        } else {
          console.log(`❌ No CFBD record found for: ${team.name}`);
          notFoundCount++;
        }
        
      } catch (error) {
        console.error(`❌ Error updating ${team.name}:`, error.message);
      }
    }
    
    console.log('\n✅ NCAA Football 2025 record update complete!');
    console.log(`📈 Successfully updated: ${updatedCount} teams`);
    console.log(`❌ Not found in CFBD: ${notFoundCount} teams`);
    console.log(`🕒 Completed at: ${new Date().toLocaleString()}`);
    
    // Show some examples of updated records
    if (updatedCount > 0) {
      console.log('\n📊 Sample updated records:');
      const updatedTeams = await fetchExistingTeams();
      const sampleTeams = updatedTeams.slice(0, 5);
      sampleTeams.forEach(team => {
        console.log(`   ${team.name}: ${team.record} (${team.wins}W, ${team.losses}L)`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the script
main();
