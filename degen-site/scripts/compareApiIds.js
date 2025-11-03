require('dotenv').config();

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
  
  // Extract team data from the first bookmaker
  const teams = [];
  if (data && data.length > 0 && data[0].bookmakers && data[0].bookmakers.length > 0) {
    const bookmaker = data[0].bookmakers[0];
    if (bookmaker.markets && bookmaker.markets.length > 0) {
      const market = bookmaker.markets[0];
      if (market.outcomes) {
        market.outcomes.forEach(outcome => {
          teams.push({
            name: outcome.name,
            odds: outcome.price,
            // The Odds API doesn't provide unique IDs for teams
            id: null
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
    'delaware': ['delawarebluehens'],
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

  // Find unmatched Odds API teams
  for (const oddsTeam of oddsTeams) {
    let found = false;
    const oddsNormalized = normalizeTeamName(oddsTeam.name);
    
    for (const cfbdTeam of cfbdTeams) {
      const cfbdNormalized = normalizeTeamName(cfbdTeam.name);
      
      if (cfbdNormalized === oddsNormalized) {
        found = true;
        break;
      }
      
      // Check aliases
      if (aliases[cfbdNormalized]) {
        for (const alias of aliases[cfbdNormalized]) {
          if (oddsNormalized === alias) {
            found = true;
            break;
          }
        }
        if (found) break;
      }
    }
    
    if (!found) {
      unmatchedOdds.push(oddsTeam);
    }
  }

  return { matches, unmatchedCfbd, unmatchedOdds };
}



// Main function
async function main() {
  try {
    console.log('🏈 Comparing CFBD API vs The Odds API team data...');
    
    // Fetch data from both APIs
    console.log('📡 Fetching data from CFBD API...');
    const cfbdTeams = await fetchCfbdData();
    console.log(`✅ Fetched ${cfbdTeams.length} FBS teams from CFBD API`);
    
    console.log('📡 Fetching data from The Odds API...');
    const oddsTeams = await fetchOddsApiData();
    console.log(`✅ Fetched ${oddsTeams.length} teams from The Odds API`);
    
    // Find matches
    console.log('\n🔍 Finding matches between APIs...');
    const { matches, unmatchedCfbd, unmatchedOdds } = findMatches(cfbdTeams, oddsTeams);
    
    console.log('\n📊 Comparison Results:');
    console.log(`   CFBD API teams: ${cfbdTeams.length}`);
    console.log(`   The Odds API teams: ${oddsTeams.length}`);
    console.log(`   ✅ Matched teams: ${matches.length}`);
    console.log(`   ❌ Unmatched CFBD: ${unmatchedCfbd.length}`);
    console.log(`   ❌ Unmatched Odds: ${unmatchedOdds.length}`);
    console.log(`   📈 Match rate: ${((matches.length / cfbdTeams.length) * 100).toFixed(1)}%`);
    
    // Show some matched teams with their IDs
    if (matches.length > 0) {
      console.log('\n✅ Matched teams (showing CFBD ID):');
      matches.slice(0, 10).forEach(match => {
        console.log(`   ${match.cfbd.name} (CFBD ID: ${match.cfbd.id}) = ${match.odds.name} (Odds: +${match.odds.odds})`);
      });
      if (matches.length > 10) {
        console.log(`   ... and ${matches.length - 10} more matches`);
      }
    }
    
    // Show CFBD API structure
    if (cfbdTeams.length > 0) {
      console.log('\n📋 CFBD API team structure example:');
      const example = cfbdTeams[0];
      console.log(`   ID: ${example.id}`);
      console.log(`   Name: ${example.name}`);
      console.log(`   Mascot: ${example.mascot}`);
      console.log(`   Conference: ${example.conference}`);
      console.log(`   Division: ${example.division}`);
      console.log(`   Abbreviation: ${example.abbreviation}`);
    }
    
    // Show The Odds API structure
    if (oddsTeams.length > 0) {
      console.log('\n📋 The Odds API team structure example:');
      const example = oddsTeams[0];
      console.log(`   Name: ${example.name}`);
      console.log(`   Odds: +${example.odds}`);
      console.log(`   ID: ${example.id || 'Not provided'}`);
    }
    
    // Show some unmatched teams
    if (unmatchedCfbd.length > 0) {
      console.log('\n❌ Some unmatched CFBD teams:');
      unmatchedCfbd.slice(0, 10).forEach(team => {
        console.log(`   ${team.name} (ID: ${team.id}, ${team.conference})`);
      });
      if (unmatchedCfbd.length > 10) {
        console.log(`   ... and ${unmatchedCfbd.length - 10} more`);
      }
    }
    
    if (unmatchedOdds.length > 0) {
      console.log('\n❌ Some unmatched Odds API teams:');
      unmatchedOdds.slice(0, 10).forEach(team => {
        console.log(`   ${team.name} (Odds: +${team.odds})`);
      });
      if (unmatchedOdds.length > 10) {
        console.log(`   ... and ${unmatchedOdds.length - 10} more`);
      }
    }
    
    // Summary
    console.log('\n📈 Summary:');
    console.log(`   • CFBD API provides unique IDs for each team`);
    console.log(`   • The Odds API does NOT provide unique IDs`);
    console.log(`   • Team matching relies on name normalization`);
    console.log(`   • CFBD IDs could be used as a stable reference`);
    
    console.log(`\n🕒 Completed at: ${new Date().toLocaleString()}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the script
main();
