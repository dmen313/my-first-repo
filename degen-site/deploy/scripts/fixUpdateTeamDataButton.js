import { readFile, writeFile } from 'fs/promises';

async function fixUpdateTeamDataButton() {
  console.log('🔧 Fixing Update Team Data button to work with all leagues...\n');
  
  try {
    // Read the current TeamTable.js file
    const filePath = '/Users/devmenon/coding/project1/degen-site/src/components/TeamTable.js';
    const content = await readFile(filePath, 'utf8');
    
    // Find the handleManualRefresh function and replace it with a league-aware version
    const oldFunction = `  // Manual refresh function that updates team data from APIs using mapping table
  const handleManualRefresh = useCallback(async () => {
    console.log('🔄 Manual refresh triggered');
    if (!isRefreshing) {
      let oddsApiError = null;
      let cfbdApiError = null;
      try {
        setIsRefreshing(true);
        setError(null);
        console.log('🔄 Fetching team mappings and updating data from APIs...');
        
        // Step 1: Get team mappings
        const mappingsResponse = await fetch('http://localhost:4000/graphql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: \`
              query {
                getTeamMappings(league: "ncaa", season: "2025") {
                  id
                  cfbdName
                  cfbdId
                  oddsApiName
                }
              }
            \`
          })
        });

        if (!mappingsResponse.ok) {
          throw new Error('Failed to fetch team mappings');
        }

        const mappingsData = await mappingsResponse.json();
        const teamMappings = mappingsData.data?.getTeamMappings || [];
        console.log(\`📊 Fetched \${teamMappings.length} team mappings\`);

        if (teamMappings.length === 0) {
          throw new Error('No team mappings found');
        }

        // Step 2: Fetch records from CFBD API (via backend to keep API key secure)
        let cfbdRecords = {};
        try {
          const recordsResponse = await fetch('http://localhost:4000/graphql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              query: \`
                query {
                  getCfbdRecords(year: 2025) {
                    team
                    wins
                    losses
                    record
                  }
                }
              \`
            })
          });
          
          if (recordsResponse.ok) {
            const recordsData = await recordsResponse.json();
            const records = recordsData.data?.getCfbdRecords || [];
            records.forEach(record => {
              if (record.team) {
                cfbdRecords[record.team] = {
                  wins: record.wins || 0,
                  losses: record.losses || 0,
                  record: record.record || '0-0'
                };
              }
            });
            console.log(\`📊 Fetched records for \${Object.keys(cfbdRecords).length} teams from CFBD via GraphQL\`);
          }
        } catch (error) {
          console.warn('⚠️ Failed to fetch CFBD records via GraphQL:', error);
          cfbdApiError = 'CFBD API quota exceeded - records not updated';
        }

        // Step 3: Fetch odds from Odds API
        let oddsData = {};
        const ODDS_API_KEY = process.env.REACT_APP_ODDS_API_KEY;
        if (ODDS_API_KEY) {
          try {
            const oddsResponse = await fetch(\`https://api.the-odds-api.com/v4/sports/americanfootball_ncaaf_championship_winner/odds?apiKey=\${ODDS_API_KEY}&regions=us&oddsFormat=american\`);
            
            if (oddsResponse.ok) {
              const odds = await oddsResponse.json();
              if (odds && odds.length > 0) {
                odds.forEach(game => {
                  if (game.bookmakers && game.bookmakers.length > 0) {
                    const bookmaker = game.bookmakers[0];
                    if (bookmaker.markets && bookmaker.markets.length > 0) {
                      const market = bookmaker.markets[0];
                      if (market.outcomes) {
                        market.outcomes.forEach(outcome => {
                          const odds = outcome.price > 0 ? \`+\${outcome.price}\` : \`\${outcome.price}\`;
                          oddsData[outcome.name] = odds;
                        });
                      }
                    }
                  }
                });
                console.log(\`📊 Fetched odds for \${Object.keys(oddsData).length} teams from Odds API\`);
              }
            } else if (oddsResponse.status === 401) {
              // Handle API quota exceeded
              const errorData = await oddsResponse.json();
              if (errorData.error_code === 'OUT_OF_USAGE_CREDITS') {
                oddsApiError = 'Odds API quota exceeded - records updated but odds unchanged';
                console.warn('⚠️ Odds API quota exceeded');
              } else {
                oddsApiError = 'Odds API unauthorized - check API key';
                console.warn('⚠️ Odds API unauthorized');
              }
            } else {
              oddsApiError = \`Odds API error: \${oddsResponse.status}\`;
              console.warn(\`⚠️ Odds API error: \${oddsResponse.status}\`);
            }
          } catch (error) {
            console.warn('⚠️ Failed to fetch Odds API data:', error);
            oddsApiError = 'Failed to connect to Odds API';
          }
        }

        // Step 4: Update teams using mapping table
        let updateCount = 0;
        const updatePromises = [];

        for (const mapping of teamMappings) { // Process all team mappings
          const cfbdName = mapping.cfbdName;
          const oddsApiName = mapping.oddsApiName;
          
          // Get record from CFBD data
          const recordData = cfbdRecords[cfbdName];
          
          // Get odds from Odds API data
          let teamOdds = null;
          if (oddsApiName && oddsData[oddsApiName]) {
            teamOdds = oddsData[oddsApiName];
          }
          
          // Only update if we have new data
          if (recordData || teamOdds) {
            const updateData = {};
            
            if (recordData) {
              updateData.record = recordData.record;
              updateData.wins = recordData.wins;
              updateData.losses = recordData.losses;
            }
            
            if (teamOdds) {
              updateData.odds = teamOdds;
            }
            
            // Find the team in our current teams list
            const team = gqlTeams.find(t => t.name === cfbdName);
            if (team) {
              console.log(\`🔄 Updating \${cfbdName}:\`, updateData);
              
              const updatePromise = fetch('http://localhost:4000/graphql', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  query: \`
                    mutation UpdateTeamApiData($id: ID!, $input: TeamApiDataInput!) {
                      updateTeamApiData(id: $id, input: $input) {
                        id
                        name
                        record
                        odds
                      }
                    }
                  \`,
                  variables: {
                    id: team.id,
                    input: updateData
                  }
                })
              }).then(response => {
                if (response.ok) {
                  updateCount++;
                  return response.json();
                } else {
                  throw new Error(\`Failed to update \${cfbdName}\`);
                }
              }).catch(error => {
                console.warn(\`⚠️ Failed to update \${cfbdName}:\`, error);
              });
              
              updatePromises.push(updatePromise);
            }
          }
        }

        // Wait for all updates to complete
        await Promise.all(updatePromises);
        
        console.log(\`✅ Updated \${updateCount} teams with fresh API data\`);
        setAsOf(new Date().toISOString());
        setMetadata({
          standings: {
            source: 'CFBD API',
            totalTeams: Object.keys(cfbdRecords).length,
            timestamp: new Date().toISOString(),
            error: cfbdApiError
          },
          odds: {
            source: 'The Odds API',
            teamsWithOdds: Object.keys(oddsData).length,
            timestamp: new Date().toISOString(),
            error: oddsApiError
          }
        });
        
        // Refresh GraphQL data after a short delay to let updates propagate
        setTimeout(() => {
          refetchData();
        }, 2000);
        
      } catch (err) {
        console.error('❌ Error during team data update:', err);
        if (oddsApiError) {
          setError(\`Partial update completed: \${oddsApiError}\`);
        } else {
          setError(\`Failed to update team data: \${err.message}\`);
        }
      } finally {
        setIsRefreshing(false);
      }
    }
  }, [isRefreshing, gqlTeams, refetchData]);`;

    const newFunction = `  // Manual refresh function that updates team data from APIs - league-aware
  const handleManualRefresh = useCallback(async () => {
    console.log('🔄 Manual refresh triggered for league:', leagueId);
    if (!isRefreshing) {
      try {
        setIsRefreshing(true);
        setError(null);
        
        // Use the existing sportsApi function which is already league-aware
        console.log('🔄 Using fetchAndSaveApiData for comprehensive update...');
        const result = await fetchAndSaveApiData(leagueId, gqlTeams);
        
        if (result.success) {
          console.log(\`✅ Updated \${result.successCount}/\${result.totalCount} teams with fresh API data\`);
          setAsOf(new Date().toISOString());
          setMetadata(result.metadata);
          
          // Refresh GraphQL data after a short delay to let updates propagate
          setTimeout(() => {
            refetchData();
          }, 2000);
        } else {
          throw new Error(result.error || 'Failed to update team data');
        }
        
      } catch (err) {
        console.error('❌ Error during team data update:', err);
        setError(\`Failed to update team data: \${err.message}\`);
      } finally {
        setIsRefreshing(false);
      }
    }
  }, [isRefreshing, leagueId, gqlTeams, refetchData]);`;

    // Replace the function in the content
    const newContent = content.replace(oldFunction, newFunction);
    
    if (newContent === content) {
      console.log('⚠️ No changes made - function pattern not found or already updated');
      return;
    }
    
    // Write the updated content back to the file
    await writeFile(filePath, newContent, 'utf8');
    
    console.log('✅ Successfully updated TeamTable.js');
    console.log('📋 Changes made:');
    console.log('  - Replaced hardcoded NCAA-only logic with league-aware fetchAndSaveApiData');
    console.log('  - Now supports NFL, MLB, NCAA, and NBA leagues');
    console.log('  - Uses existing API configurations from sportsApi.js');
    console.log('  - Maintains proper error handling and metadata');
    
  } catch (error) {
    console.error('❌ Error fixing Update Team Data button:', error);
  }
}

// Run the fix
if (import.meta.url === \`file://\${process.argv[1]}\`) {
  fixUpdateTeamDataButton()
    .then(() => {
      console.log('\\n🎉 Update Team Data button fix completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Fix failed:', error);
      process.exit(1);
    });
}

export { fixUpdateTeamDataButton };
