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

// Create team mapping
async function createTeamMapping(mappingData) {
  const result = await graphqlRequest(`
    mutation CreateTeamMapping($input: TeamMappingInput!) {
      createTeamMapping(input: $input) {
        id
        cfbdId
        cfbdName
        oddsApiName
        matchType
      }
    }
  `, { input: mappingData });

  return result.createTeamMapping;
}

// Fetch current odds from The Odds API
async function fetchOddsApiData() {
  const ODDS_API_KEY = process.env.REACT_APP_ODDS_API_KEY;
  
  if (!ODDS_API_KEY) {
    throw new Error('REACT_APP_ODDS_API_KEY environment variable is required');
  }

  const url = `https://api.the-odds-api.com/v4/sports/americanfootball_ncaaf_championship_winner/odds?apiKey=${ODDS_API_KEY}&regions=us&markets=outrights&oddsFormat=american&dateFormat=iso`;
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Odds API request failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  
  // Extract odds from the first bookmaker
  const teams = [];
  if (data && data.length > 0 && data[0].bookmakers && data[0].bookmakers.length > 0) {
    const bookmaker = data[0].bookmakers[0];
    if (bookmaker.markets && bookmaker.markets.length > 0) {
      const market = bookmaker.markets[0];
      if (market.outcomes) {
        market.outcomes.forEach(outcome => {
          teams.push({
            name: outcome.name,
            odds: outcome.price
          });
        });
      }
    }
  }

  return teams;
}

// Fetch teams from CFBD API
async function fetchCfbdData() {
  const CFBD_API_KEY = process.env.CFBD_API_KEY;
  
  if (!CFBD_API_KEY) {
    throw new Error('CFBD_API_KEY environment variable is required');
  }

  const url = 'https://api.collegefootballdata.com/teams';
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${CFBD_API_KEY}`
    }
  });

  if (!response.ok) {
    throw new Error(`CFBD API request failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  
  // Filter for FBS teams only (using classification field)
  const fbsTeams = data.filter(team => team.classification === 'fbs');
  
  return fbsTeams.map(team => ({
    id: team.id,
    name: team.school,
    mascot: team.mascot,
    conference: team.conference,
    division: team.division,
    abbreviation: team.abbreviation,
    color: team.color,
    alt_color: team.alt_color,
    logos: team.logos
  }));
}

// Normalize team name for comparison
function normalizeTeamName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace('university', '')
    .replace('college', '')
    .replace('state', 'st')
    .trim();
}

// Enhanced matching with aliases
function findMatches(cfbdTeams, oddsTeams) {
  const matches = [];
  const unmatchedCfbd = [];
  const unmatchedOdds = [];

  // Common name variations and aliases
  const aliases = {
    'alabama': ['alabamacrimsontide'],
    'georgia': ['georgiabulldogs'],
    'texas': ['texaslonghorns'],
    'ohiost': ['ohiostatebuckeyes'],
    'michigan': ['michiganwolverines'],
    'clemson': ['clemsontigers'],
    'notredame': ['notredamefightingirish'],
    'oregon': ['oregonducks'],
    'lsu': ['lsutigers'],
    'pennst': ['pennstatenittanylions'],
    'auburn': ['auburntigers'],
    'florida': ['floridagators'],
    'tennessee': ['tennesseevolunteers'],
    'olemiss': ['olemissrebels'],
    'oklahoma': ['oklahomasooners'],
    'usc': ['usctrojans'],
    'washington': ['washingtonhuskies'],
    'utah': ['utahutes'],
    'arizonast': ['arizonastatesundevils'],
    'arkansas': ['arkansasrazorbacks'],
    'missouri': ['missouritigers'],
    'kentucky': ['kentuckywildcats'],
    'southcarolina': ['southcarolinagamecocks'],
    'vanderbilt': ['vanderbiltcommodores'],
    'mississippist': ['mississippistatebulldogs'],
    'texasam': ['texasamaggies'],
    'texastech': ['texastechredraiders'],
    'baylor': ['baylorbears'],
    'kansasst': ['kansasstatewildcats'],
    'iowast': ['iowastatecyclones'],
    'kansas': ['kansasjayhawks'],
    'oklahomast': ['oklahomastatecowboys'],
    'westvirginia': ['westvirginiamountaineers'],
    'tcu': ['tcuhornedfrogs'],
    'ucla': ['uclabruins'],
    'stanford': ['stanfordcardinal'],
    'california': ['californiagoldenbears'],
    'colorado': ['coloradobuffaloes'],
    'arizona': ['arizonawildcats'],
    'utahst': ['utahstateaggies'],
    'boisest': ['boisestatebroncos'],
    'fresnost': ['fresnostatebulldogs'],
    'sandiegost': ['sandiegostateaztecs'],
    'hawaii': ['hawaiirainbowwarriors'],
    'nevada': ['nevadawolfpack'],
    'unlv': ['unlvrebels'],
    'wyoming': ['wyomingcowboys'],
    'coloradost': ['coloradostaterams'],
    'airforce': ['airforcefalcons'],
    'newmexico': ['newmexicolobos'],
    'newmexicost': ['newmexicostateaggies'],
    'sanjosest': ['sanjosestatespartans'],
    'nevadalasvegas': ['unlvrebels'],
    'miami': ['miamihurricanes'],
    'floridast': ['floridastateseminoles'],
    'louisville': ['louisvillecardinals'],
    'duke': ['dukebluedevils'],
    'northcarolina': ['northcarolinatarheels'],
    'northcarolinast': ['northcarolinastatewolfpack'],
    'virginia': ['virginiacavaliers'],
    'virginiatech': ['virginiatechhokies'],
    'pittsburgh': ['pittsburghpanthers'],
    'syracuse': ['syracuseorange'],
    'bostoncollege': ['bostoncollegeeagles'],
    'wakeforest': ['wakeforestdemondeacons'],
    'georgiatech': ['georgiatechyellowjackets'],
    'indiana': ['indianahoosiers'],
    'illinois': ['illinoisfightingillini'],
    'iowa': ['iowahawkeyes'],
    'minnesota': ['minnesotagoldengophers'],
    'nebraska': ['nebraskacornhuskers'],
    'northwestern': ['northwesternwildcats'],
    'purdue': ['purdueboilermakers'],
    'wisconsin': ['wisconsinbadgers'],
    'maryland': ['marylandterrapins'],
    'rutgers': ['rutgersscarletknights'],
    'michiganst': ['michiganstatespartans'],
    'appalachianst': ['appalachianstatemountaineers'],
    'coastalcarolina': ['coastalcarolinachanticleers'],
    'georgiasouthern': ['georgiasoutherneagles'],
    'georgiast': ['georgiastatepanthers'],
    'jamesmadison': ['jamesmadisondukes'],
    'louisiana': ['louisianaragin\'cajuns'],
    'louisianamonroe': ['louisianamonroewarhawks'],
    'marshall': ['marshallthunderingherd'],
    'olddominion': ['olddominionmonarchs'],
    'southalabama': ['southalabamajaguars'],
    'southernmiss': ['southernmississippigoldeneagles'],
    'texasst': ['texasstatebobcats'],
    'troy': ['troytrojans'],
    'ulmonroe': ['louisianamonroewarhawks'],
    'ulala': ['louisianaragin\'cajuns'],
    'samhouston': ['samhoustonbearkats'],
    'kennesawst': ['kennesawstateowls'],
    'delaware': ['delawarebluehens']
  };

  // Check each CFBD team against Odds API teams
  for (const cfbdTeam of cfbdTeams) {
    let found = false;
    const cfbdNormalized = normalizeTeamName(cfbdTeam.name);
    
    for (const oddsTeam of oddsTeams) {
      const oddsNormalized = normalizeTeamName(oddsTeam.name);
      
      // Direct match
      if (cfbdNormalized === oddsNormalized) {
        matches.push({
          cfbd: cfbdTeam,
          odds: oddsTeam,
          matchType: 'exact'
        });
        found = true;
        break;
      }
      
      // Check aliases
      if (aliases[cfbdNormalized]) {
        for (const alias of aliases[cfbdNormalized]) {
          if (oddsNormalized === alias) {
            matches.push({
              cfbd: cfbdTeam,
              odds: oddsTeam,
              matchType: 'alias'
            });
            found = true;
            break;
          }
        }
        if (found) break;
      }
    }
    
    if (!found) {
      unmatchedCfbd.push(cfbdTeam);
    }
  }

  return { matches, unmatchedCfbd, unmatchedOdds };
}

// Main function
async function main() {
  try {
    console.log('🏈 Populating TeamMapping table with CFBD and Odds API data...');
    
    // Fetch data from both APIs
    console.log('📡 Fetching data from CFBD API...');
    const cfbdTeams = await fetchCfbdData();
    console.log(`✅ Fetched ${cfbdTeams.length} FBS teams from CFBD API`);
    
    console.log('📡 Fetching data from The Odds API...');
    const oddsTeams = await fetchOddsApiData();
    console.log(`✅ Fetched ${oddsTeams.length} teams from The Odds API`);
    
    // Find matches
    console.log('\n🔍 Finding matches between APIs...');
    const { matches } = findMatches(cfbdTeams, oddsTeams);
    
    console.log(`📊 Found ${matches.length} matched teams`);
    
    if (matches.length === 0) {
      console.log('❌ No matches found. Cannot populate mappings.');
      return;
    }
    
    // Create team mappings
    console.log('\n🔄 Creating team mappings...');
    let createdCount = 0;
    let errorCount = 0;
    
    for (const match of matches) {
      try {
        const mappingData = {
          cfbdId: match.cfbd.id,
          cfbdName: match.cfbd.name,
          cfbdMascot: match.cfbd.mascot,
          cfbdConference: match.cfbd.conference,
          cfbdAbbreviation: match.cfbd.abbreviation,
          oddsApiName: match.odds.name,
          oddsApiOdds: `+${match.odds.odds}`,
          league: 'ncaa',
          season: '2025',
          matchType: match.matchType
        };
        
        console.log(`📝 Creating mapping: ${match.cfbd.name} (${match.cfbd.id}) = ${match.odds.name} (+${match.odds.odds})`);
        
        await createTeamMapping(mappingData);
        createdCount++;
        
        // Add small delay to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`❌ Failed to create mapping for ${match.cfbd.name}:`, error.message);
        errorCount++;
      }
    }
    
    // Verify the mappings
    console.log('\n🔍 Verifying mappings...');
    const verifyData = await graphqlRequest(`
      query GetTeamMappings {
        getTeamMappings(league: "ncaa", season: "2025") {
          id
          cfbdId
          cfbdName
          oddsApiName
          matchType
        }
      }
    `);

    const createdMappings = verifyData.getTeamMappings;
    
    console.log('\n📊 Final Results:');
    console.log(`   ✅ Successfully created: ${createdCount} mappings`);
    console.log(`   ❌ Creation errors: ${errorCount} mappings`);
    console.log(`   📈 Total mappings in database: ${createdMappings.length}`);
    
    // Show some examples
    if (createdMappings.length > 0) {
      console.log('\n📋 Sample mappings created:');
      createdMappings.slice(0, 10).forEach(mapping => {
        console.log(`   ${mapping.cfbdName} (CFBD ID: ${mapping.cfbdId}) = ${mapping.oddsApiName} (${mapping.matchType})`);
      });
      if (createdMappings.length > 10) {
        console.log(`   ... and ${createdMappings.length - 10} more`);
      }
    }
    
    console.log(`\n🕒 Completed at: ${new Date().toLocaleString()}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the script
main();
