#!/usr/bin/env node
require('dotenv').config();

const GRAPHQL_ENDPOINT = process.env.REACT_APP_GRAPHQL_ENDPOINT || 'http://localhost:4000/graphql';
const CFBD_API_KEY = process.env.CFBD_API_KEY;
const ODDS_API_KEY = process.env.REACT_APP_ODDS_API_KEY;

// Hardcoded team mappings with essential data
const TEAM_MAPPINGS = [
  // SEC Teams
  { cfbdId: 333, cfbdName: "Alabama", oddsApiName: "Alabama Crimson Tide", cfbdConference: "SEC" },
  { cfbdId: 59, cfbdName: "Georgia", oddsApiName: "Georgia Bulldogs", cfbdConference: "SEC" },
  { cfbdId: 96, cfbdName: "LSU", oddsApiName: "LSU Tigers", cfbdConference: "SEC" },
  { cfbdId: 57, cfbdName: "Florida", oddsApiName: "Florida Gators", cfbdConference: "SEC" },
  { cfbdId: 8, cfbdName: "Auburn", oddsApiName: "Auburn Tigers", cfbdConference: "SEC" },
  { cfbdId: 263, cfbdName: "Texas A&M", oddsApiName: "Texas A&M Aggies", cfbdConference: "SEC" },
  { cfbdId: 191, cfbdName: "Ole Miss", oddsApiName: "Ole Miss Rebels", cfbdConference: "SEC" },
  { cfbdId: 257, cfbdName: "Tennessee", oddsApiName: "Tennessee Volunteers", cfbdConference: "SEC" },
  { cfbdId: 238, cfbdName: "South Carolina", oddsApiName: "South Carolina Gamecocks", cfbdConference: "SEC" },
  { cfbdId: 197, cfbdName: "Missouri", oddsApiName: "Missouri Tigers", cfbdConference: "SEC" },
  { cfbdId: 158, cfbdName: "Kentucky", oddsApiName: "Kentucky Wildcats", cfbdConference: "SEC" },
  { cfbdId: 344, cfbdName: "Arkansas", oddsApiName: "Arkansas Razorbacks", cfbdConference: "SEC" },
  { cfbdId: 142, cfbdName: "Mississippi State", oddsApiName: "Mississippi State Bulldogs", cfbdConference: "SEC" },
  { cfbdId: 145, cfbdName: "Vanderbilt", oddsApiName: "Vanderbilt Commodores", cfbdConference: "SEC" },
  { cfbdId: 201, cfbdName: "Oklahoma", oddsApiName: "Oklahoma Sooners", cfbdConference: "SEC" },
  { cfbdId: 251, cfbdName: "Texas", oddsApiName: "Texas Longhorns", cfbdConference: "SEC" },

  // Big Ten Teams
  { cfbdId: 130, cfbdName: "Michigan", oddsApiName: "Michigan Wolverines", cfbdConference: "Big Ten" },
  { cfbdId: 194, cfbdName: "Ohio State", oddsApiName: "Ohio State Buckeyes", cfbdConference: "Big Ten" },
  { cfbdId: 213, cfbdName: "Penn State", oddsApiName: "Penn State Nittany Lions", cfbdConference: "Big Ten" },
  { cfbdId: 356, cfbdName: "Wisconsin", oddsApiName: "Wisconsin Badgers", cfbdConference: "Big Ten" },
  { cfbdId: 164, cfbdName: "Iowa", oddsApiName: "Iowa Hawkeyes", cfbdConference: "Big Ten" },
  { cfbdId: 127, cfbdName: "Michigan State", oddsApiName: "Michigan State Spartans", cfbdConference: "Big Ten" },
  { cfbdId: 275, cfbdName: "Minnesota", oddsApiName: "Minnesota Golden Gophers", cfbdConference: "Big Ten" },
  { cfbdId: 120, cfbdName: "Maryland", oddsApiName: "Maryland Terrapins", cfbdConference: "Big Ten" },
  { cfbdId: 84, cfbdName: "Indiana", oddsApiName: "Indiana Hoosiers", cfbdConference: "Big Ten" },
  { cfbdId: 158, cfbdName: "Nebraska", oddsApiName: "Nebraska Cornhuskers", cfbdConference: "Big Ten" },
  { cfbdId: 77, cfbdName: "Illinois", oddsApiName: "Illinois Fighting Illini", cfbdConference: "Big Ten" },
  { cfbdId: 87, cfbdName: "Northwestern", oddsApiName: "Northwestern Wildcats", cfbdConference: "Big Ten" },
  { cfbdId: 250, cfbdName: "Purdue", oddsApiName: "Purdue Boilermakers", cfbdConference: "Big Ten" },
  { cfbdId: 164, cfbdName: "Rutgers", oddsApiName: "Rutgers Scarlet Knights", cfbdConference: "Big Ten" },
  { cfbdId: 248, cfbdName: "Oregon", oddsApiName: "Oregon Ducks", cfbdConference: "Big Ten" },
  { cfbdId: 264, cfbdName: "USC", oddsApiName: "USC Trojans", cfbdConference: "Big Ten" },
  { cfbdId: 12, cfbdName: "UCLA", oddsApiName: "UCLA Bruins", cfbdConference: "Big Ten" },
  { cfbdId: 328, cfbdName: "Washington", oddsApiName: "Washington Huskies", cfbdConference: "Big Ten" },

  // ACC Teams
  { cfbdId: 103, cfbdName: "Clemson", oddsApiName: "Clemson Tigers", cfbdConference: "ACC" },
  { cfbdId: 87, cfbdName: "Florida State", oddsApiName: "Florida State Seminoles", cfbdConference: "ACC" },
  { cfbdId: 239, cfbdName: "Miami", oddsApiName: "Miami Hurricanes", cfbdConference: "ACC" },
  { cfbdId: 153, cfbdName: "NC State", oddsApiName: "NC State Wolfpack", cfbdConference: "ACC" },
  { cfbdId: 228, cfbdName: "Syracuse", oddsApiName: "Syracuse Orange", cfbdConference: "ACC" },
  { cfbdId: 259, cfbdName: "Virginia Tech", oddsApiName: "Virginia Tech Hokies", cfbdConference: "ACC" },
  { cfbdId: 258, cfbdName: "Virginia", oddsApiName: "Virginia Cavaliers", cfbdConference: "ACC" },
  { cfbdId: 152, cfbdName: "North Carolina", oddsApiName: "North Carolina Tar Heels", cfbdConference: "ACC" },
  { cfbdId: 59, cfbdName: "Duke", oddsApiName: "Duke Blue Devils", cfbdConference: "ACC" },
  { cfbdId: 103, cfbdName: "Wake Forest", oddsApiName: "Wake Forest Demon Deacons", cfbdConference: "ACC" },
  { cfbdId: 87, cfbdName: "Boston College", oddsApiName: "Boston College Eagles", cfbdConference: "ACC" },
  { cfbdId: 239, cfbdName: "Georgia Tech", oddsApiName: "Georgia Tech Yellow Jackets", cfbdConference: "ACC" },
  { cfbdId: 153, cfbdName: "Pittsburgh", oddsApiName: "Pittsburgh Panthers", cfbdConference: "ACC" },
  { cfbdId: 228, cfbdName: "Louisville", oddsApiName: "Louisville Cardinals", cfbdConference: "ACC" },
  { cfbdId: 259, cfbdName: "SMU", oddsApiName: "SMU Mustangs", cfbdConference: "ACC" },
  { cfbdId: 258, cfbdName: "California", oddsApiName: "California Golden Bears", cfbdConference: "ACC" },
  { cfbdId: 152, cfbdName: "Stanford", oddsApiName: "Stanford Cardinal", cfbdConference: "ACC" },

  // Big 12 Teams
  { cfbdId: 2305, cfbdName: "Kansas State", oddsApiName: "Kansas State Wildcats", cfbdConference: "Big 12" },
  { cfbdId: 2306, cfbdName: "Kansas", oddsApiName: "Kansas Jayhawks", cfbdConference: "Big 12" },
  { cfbdId: 2307, cfbdName: "Iowa State", oddsApiName: "Iowa State Cyclones", cfbdConference: "Big 12" },
  { cfbdId: 2308, cfbdName: "Baylor", oddsApiName: "Baylor Bears", cfbdConference: "Big 12" },
  { cfbdId: 2309, cfbdName: "TCU", oddsApiName: "TCU Horned Frogs", cfbdConference: "Big 12" },
  { cfbdId: 2310, cfbdName: "Texas Tech", oddsApiName: "Texas Tech Red Raiders", cfbdConference: "Big 12" },
  { cfbdId: 2311, cfbdName: "West Virginia", oddsApiName: "West Virginia Mountaineers", cfbdConference: "Big 12" },
  { cfbdId: 2312, cfbdName: "Cincinnati", oddsApiName: "Cincinnati Bearcats", cfbdConference: "Big 12" },
  { cfbdId: 2313, cfbdName: "Houston", oddsApiName: "Houston Cougars", cfbdConference: "Big 12" },
  { cfbdId: 2314, cfbdName: "UCF", oddsApiName: "UCF Knights", cfbdConference: "Big 12" },
  { cfbdId: 2315, cfbdName: "BYU", oddsApiName: "BYU Cougars", cfbdConference: "Big 12" },
  { cfbdId: 2316, cfbdName: "Arizona", oddsApiName: "Arizona Wildcats", cfbdConference: "Big 12" },
  { cfbdId: 2317, cfbdName: "Arizona State", oddsApiName: "Arizona State Sun Devils", cfbdConference: "Big 12" },
  { cfbdId: 2318, cfbdName: "Colorado", oddsApiName: "Colorado Buffaloes", cfbdConference: "Big 12" },
  { cfbdId: 2319, cfbdName: "Utah", oddsApiName: "Utah Utes", cfbdConference: "Big 12" },

  // Independent Teams
  { cfbdId: 87, cfbdName: "Notre Dame", oddsApiName: "Notre Dame Fighting Irish", cfbdConference: "Independent" },

  // Mountain West Teams
  { cfbdId: 68, cfbdName: "Boise State", oddsApiName: "Boise State Broncos", cfbdConference: "Mountain West" },

  // Pac-12 Teams (remaining)
  { cfbdId: 2320, cfbdName: "Oregon State", oddsApiName: "Oregon State Beavers", cfbdConference: "Pac-12" },
  { cfbdId: 2321, cfbdName: "Washington State", oddsApiName: "Washington State Cougars", cfbdConference: "Pac-12" }
];

async function graphqlRequest(query, variables = {}) {
  try {
    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables,
      }),
    });

    const result = await response.json();
    
    if (result.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
    }
    
    return result.data;
  } catch (error) {
    console.error('GraphQL request failed:', error.message);
    throw error;
  }
}

async function fetchCFBDTeamData(cfbdId) {
  if (!CFBD_API_KEY) {
    console.warn('⚠️  CFBD_API_KEY not found, skipping CFBD data fetch');
    return null;
  }

  try {
    const response = await fetch(`https://api.collegefootballdata.com/teams?id=${cfbdId}`, {
      headers: {
        'Authorization': `Bearer ${CFBD_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`CFBD API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data[0] || null;
  } catch (error) {
    console.error(`❌ Error fetching CFBD data for team ${cfbdId}:`, error.message);
    return null;
  }
}

async function fetchOddsData(oddsApiName) {
  if (!ODDS_API_KEY) {
    console.warn('⚠️  ODDS_API_KEY not found, skipping odds data fetch');
    return null;
  }

  try {
    // Use the championship winner endpoint instead of regular odds
    const response = await fetch(`https://api.the-odds-api.com/v4/sports/americanfootball_ncaaf_championship_winner/odds?apiKey=${ODDS_API_KEY}&regions=us&oddsFormat=american`);
    
    if (!response.ok) {
      throw new Error(`Odds API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const teamOdds = data.find(team => team.title === oddsApiName);
    return teamOdds ? teamOdds.odds : null;
  } catch (error) {
    console.error(`❌ Error fetching odds data for ${oddsApiName}:`, error.message);
    return null;
  }
}

async function deleteAllTeamMappings() {
  const query = `
    query {
      getTeamMappings {
        id
      }
    }
  `;
  
  const result = await graphqlRequest(query);
  const mappings = result.getTeamMappings;
  
  if (mappings.length === 0) {
    console.log('📭 No existing mappings to delete');
    return 0;
  }
  
  console.log(`🗑️  Deleting ${mappings.length} existing mappings...`);
  
  let deletedCount = 0;
  for (const mapping of mappings) {
    try {
      await deleteTeamMapping(mapping.id);
      deletedCount++;
    } catch (error) {
      console.error(`❌ Error deleting mapping ${mapping.id}:`, error.message);
    }
  }
  
  console.log(`✅ Deleted ${deletedCount} mappings`);
  return deletedCount;
}

async function deleteTeamMapping(id) {
  const mutation = `
    mutation DeleteTeamMapping($id: ID!) {
      deleteTeamMapping(id: $id)
    }
  `;
  
  const result = await graphqlRequest(mutation, { id });
  return result.deleteTeamMapping;
}

async function createTeamMapping(mappingData) {
  const mutation = `
    mutation CreateTeamMapping($input: TeamMappingInput!) {
      createTeamMapping(input: $input) {
        id
        cfbdName
        oddsApiName
      }
    }
  `;
  
  const result = await graphqlRequest(mutation, { input: mappingData });
  return result.createTeamMapping;
}

async function main() {
  try {
    console.log('🔄 Starting mapping table repopulation...\n');
    
    // First, delete all existing mappings
    const deletedCount = await deleteAllTeamMappings();
    console.log('');
    
    let createdCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const mapping of TEAM_MAPPINGS) {
      try {
        console.log(`📝 Processing ${mapping.cfbdName}...`);
        
        // Fetch additional data from APIs
        const cfbdData = await fetchCFBDTeamData(mapping.cfbdId);
        const oddsData = await fetchOddsData(mapping.oddsApiName);
        
        // Prepare mapping data
        const mappingInput = {
          cfbdId: mapping.cfbdId,
          cfbdName: mapping.cfbdName,
          cfbdMascot: cfbdData?.mascot || null,
          cfbdConference: mapping.cfbdConference,
          cfbdAbbreviation: cfbdData?.abbreviation || null,
          oddsApiName: mapping.oddsApiName,
          oddsApiOdds: oddsData ? oddsData.toString() : null,
          league: 'ncaa',
          season: '2025',
          matchType: 'championship_winner'
        };

        // Create the mapping
        const result = await createTeamMapping(mappingInput);
        console.log(`   ✅ Created mapping for ${mapping.cfbdName} (ID: ${result.id})`);
        createdCount++;
        
        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log(`   ⏭️  Skipped ${mapping.cfbdName} (already exists)`);
          skippedCount++;
        } else {
          console.error(`   ❌ Error creating mapping for ${mapping.cfbdName}:`, error.message);
          errorCount++;
        }
      }
    }

    console.log('\n🎉 Mapping table repopulation completed!');
    console.log(`   🗑️  Deleted: ${deletedCount} existing mappings`);
    console.log(`   📊 Created: ${createdCount} mappings`);
    console.log(`   ⏭️  Skipped: ${skippedCount} mappings`);
    console.log(`   ❌ Errors: ${errorCount} mappings`);
    console.log(`   📈 Total processed: ${TEAM_MAPPINGS.length} teams`);

  } catch (error) {
    console.error('❌ Error during mapping table repopulation:', error.message);
    process.exit(1);
  }
}

main();
