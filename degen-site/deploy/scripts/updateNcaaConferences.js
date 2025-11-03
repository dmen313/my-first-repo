require('dotenv').config();

const CFBD_API_KEY = process.env.CFBD_API_KEY;

if (!CFBD_API_KEY) {
  console.error('❌ CFBD_API_KEY environment variable is required');
  process.exit(1);
}

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

// Fetch teams from GraphQL
async function fetchExistingTeams() {
  const data = await graphqlRequest(`
    query GetTeams($league: String!, $season: String!) {
      getTeams(league: $league, season: $season) {
        id
        name
        odds
        division
        owner
      }
    }
  `, { league: 'ncaa', season: '2025' });

  return data.getTeams || [];
}

// Update team in GraphQL
async function updateTeam(teamId, updateData) {
  const result = await graphqlRequest(`
    mutation UpdateTeam($input: UpdateTeamInput!) {
      updateTeam(input: $input) {
        id
        name
        division
      }
    }
  `, { input: { id: teamId, division: updateData.division } });

  return result.updateTeam;
}

// Fetch teams from CFBD API
async function fetchCfbdTeams() {
  const url = `https://api.collegefootballdata.com/teams?year=2025`;
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${CFBD_API_KEY}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`CFBD API request failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// Normalize team names for matching
function normalizeName(name) {
  if (!name) return '';
  return name
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .replace(/&AMP;/g, '&')
    .replace(/STATE/g, 'ST');
}

// Find matching CFBD team
function findMatchingTeam(teamName, cfbdTeams) {
  const normalizedTeamName = normalizeName(teamName);
  
  // Try exact match first
  let match = cfbdTeams.find(team => 
    normalizeName(team.school) === normalizedTeamName
  );
  
  if (match) return match;
  
  // Try partial match
  match = cfbdTeams.find(team => {
    const normalizedSchool = normalizeName(team.school);
    return normalizedTeamName.includes(normalizedSchool) || 
           normalizedSchool.includes(normalizedTeamName);
  });
  
  return match;
}

// Main function to update conferences
async function main() {
  try {
    console.log('🏈 Updating NCAA Football 2025 conference information...');
    
    // Fetch existing teams from GraphQL
    console.log('📊 Fetching existing NCAA teams...');
    const existingTeams = await fetchExistingTeams();
    console.log(`✅ Found ${existingTeams.length} existing teams`);
    
    // Fetch teams from CFBD API
    console.log('📡 Fetching conference data from CFBD API...');
    const cfbdTeams = await fetchCfbdTeams();
    console.log(`✅ Fetched ${cfbdTeams.length} teams from CFBD API`);
    
    let updatedCount = 0;
    let errorCount = 0;
    let noMatchCount = 0;
    
    console.log('\n🔄 Updating team conferences...');
    
    for (const team of existingTeams) {
      try {
        // Skip teams that already have proper conference assignments
        if (team.division !== 'FBS') {
          console.log(`⏭️ Skipping ${team.name} (already has conference: ${team.division})`);
          continue;
        }
        
        // Find matching team in CFBD data
        const cfbdTeam = findMatchingTeam(team.name, cfbdTeams);
        
        if (cfbdTeam && cfbdTeam.conference) {
          console.log(`✅ Updating ${team.name} → ${cfbdTeam.conference}`);
          
          await updateTeam(team.id, {
            division: cfbdTeam.conference
          });
          
          updatedCount++;
        } else {
          console.log(`❓ No match found for ${team.name}`);
          noMatchCount++;
        }
        
      } catch (error) {
        console.error(`❌ Error updating ${team.name}:`, error.message);
        errorCount++;
      }
    }
    
    console.log('\n✅ Conference update complete!');
    console.log(`📈 Successfully updated: ${updatedCount} teams`);
    console.log(`❓ No match found: ${noMatchCount} teams`);
    console.log(`❌ Errors: ${errorCount} teams`);
    console.log(`🕒 Completed at: ${new Date().toLocaleString()}`);
    
    // Show summary of teams that still need manual assignment
    if (noMatchCount > 0) {
      console.log('\n📋 Teams that may need manual conference assignment:');
      for (const team of existingTeams) {
        if (team.division === 'FBS') {
          const cfbdTeam = findMatchingTeam(team.name, cfbdTeams);
          if (!cfbdTeam || !cfbdTeam.conference) {
            console.log(`   - ${team.name}`);
          }
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the script
main();

