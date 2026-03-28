import React, { useState, useEffect, useCallback } from 'react';
import './AdminPage.css';

const NbaOddsTestPage = ({ onBackToHome }) => {
  const [loading, setLoading] = useState(false);
  const [teams, setTeams] = useState([]);
  const [oddsMap, setOddsMap] = useState({});
  const [oddsData, setOddsData] = useState(null);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    totalTeams: 0,
    teamsWithOdds: 0,
    teamsWithoutOdds: 0
  });
  
  // Define constants at component level so they're accessible in JSX
  const ODDS_API_KEY = process.env.REACT_APP_ODDS_API_KEY || '';
  const ODDS_API_BASE = 'https://api.the-odds-api.com/v4';

  const fetchOdds = useCallback(async (nbaTeams) => {
    try {
      if (!ODDS_API_KEY || ODDS_API_KEY === 'YOUR_API_KEY') {
        setError('Odds API key not configured');
        return;
      }
      
      const possibleEndpoints = [
        'basketball_nba_championship_winner',
        'basketball_nba_championship',
        'basketball_nba_futures',
        'basketball_nba'
      ];
      
      const oddsMap = {};
      let oddsData = null;
      let endpointUsed = null;
      const rawApiUrls = [];
      
      // First, try with markets=outrights parameter
      for (const endpoint of possibleEndpoints) {
        try {
          // Try with markets=outrights parameter
          let oddsUrl = `${ODDS_API_BASE}/sports/${endpoint}/odds?regions=us&markets=outrights&oddsFormat=american&apiKey=${ODDS_API_KEY}`;
          rawApiUrls.push({ endpoint, url: oddsUrl, markets: 'outrights' });
          
          let oddsResponse = await fetch(oddsUrl);
          
          // If that fails, try without markets parameter
          if (!oddsResponse.ok || oddsResponse.status === 404) {
            oddsUrl = `${ODDS_API_BASE}/sports/${endpoint}/odds?regions=us&oddsFormat=american&apiKey=${ODDS_API_KEY}`;
            rawApiUrls.push({ endpoint, url: oddsUrl, markets: 'none' });
            oddsResponse = await fetch(oddsUrl);
          }
          
          if (oddsResponse.ok) {
            const data = await oddsResponse.json();
            
            // Store raw data for this endpoint (always store the first successful response)
            if (!oddsData || !oddsData.data) {
              oddsData = { endpoint, markets: rawApiUrls[rawApiUrls.length - 1].markets, data, url: rawApiUrls[rawApiUrls.length - 1].url };
            }
            
            if (data && !data.error_code && Array.isArray(data)) {
              data.forEach(game => {
                if (game.bookmakers && game.bookmakers.length > 0) {
                  const bookmaker = game.bookmakers[0];
                  if (bookmaker.markets && bookmaker.markets.length > 0) {
                    const championshipMarket = bookmaker.markets.find(m => 
                      m.key === 'championship' || 
                      m.key === 'outrights' || 
                      m.key === 'futures' ||
                      m.key === 'winner'
                    ) || bookmaker.markets[0];
                    
                    if (championshipMarket.outcomes) {
                      championshipMarket.outcomes.forEach(outcome => {
                        const teamName = outcome.name.toLowerCase().replace(/[^a-z\s]/g, '').trim();
                        const odds = outcome.price > 0 ? `+${outcome.price}` : `${outcome.price}`;
                        
                        if (!oddsMap[teamName]) {
                          oddsMap[teamName] = {
                            odds,
                            fullName: outcome.name,
                            price: outcome.price
                          };
                          
                          const nameParts = teamName.split(/\s+/);
                          if (nameParts.length > 1) {
                            oddsMap[nameParts[nameParts.length - 1]] = {
                              odds,
                              fullName: outcome.name,
                              price: outcome.price
                            };
                            if (nameParts.length >= 2) {
                              oddsMap[nameParts.slice(-2).join(' ')] = {
                                odds,
                                fullName: outcome.name,
                                price: outcome.price
                              };
                            }
                          }
                        }
                      });
                    }
                  }
                }
              });
              
              if (Object.keys(oddsMap).length > 0) {
                endpointUsed = endpoint;
                break;
              }
            } else if (data && data.error_code) {
              console.log(`⚠️ Endpoint ${endpoint} returned error: ${data.message || 'Unknown error'}`);
              continue;
            }
          }
        } catch (error) {
          console.log(`⚠️ Error trying endpoint ${endpoint}: ${error.message}`);
          continue;
        }
      }
      
      setOddsMap(oddsMap);
      setOddsData({ 
        ...(oddsData || {}), 
        endpoint: endpointUsed,
        urls: rawApiUrls
      });
      
      // Calculate stats
      const teamsWithOdds = nbaTeams.filter(team => {
        const normalizedName = team.name.toLowerCase().replace(/[^a-z\s]/g, '').trim();
        let hasOdds = oddsMap[normalizedName] !== undefined;
        
        if (!hasOdds) {
          const nameParts = normalizedName.split(/\s+/);
          if (nameParts.length > 0) {
            hasOdds = oddsMap[nameParts[nameParts.length - 1]] !== undefined;
          }
          if (!hasOdds && nameParts.length >= 2) {
            hasOdds = oddsMap[nameParts.slice(-2).join(' ')] !== undefined;
          }
          if (!hasOdds && nameParts.length >= 2 && nameParts[0] === 'los' && nameParts[1] === 'angeles') {
            hasOdds = oddsMap[`la ${nameParts.slice(2).join(' ')}`] !== undefined;
          }
        }
        
        return hasOdds;
      }).length;
      
      setStats({
        totalTeams: nbaTeams.length,
        teamsWithOdds,
        teamsWithoutOdds: nbaTeams.length - teamsWithOdds
      });
      
    } catch (err) {
      console.error('Error fetching odds:', err);
      setError(`Error fetching odds: ${err.message}`);
    }
  }, [ODDS_API_BASE, ODDS_API_KEY]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Step 1: Fetch NBA 2025 teams from database
      const GRAPHQL_ENDPOINT = process.env.REACT_APP_GRAPHQL_ENDPOINT || 'http://localhost:4000/graphql';
      
      const teamsResponse = await fetch(GRAPHQL_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            query GetNbaTeams {
              getTeams(league: "nba", season: "2025") {
                id
                name
                league
                division
                record
                odds
              }
            }
          `
        })
      });
      
      const teamsData = await teamsResponse.json();
      
      if (teamsData.errors) {
        throw new Error(teamsData.errors[0].message);
      }
      
      let nbaTeams = teamsData.data?.getTeams || [];
      
      // If no teams found with league "nba", try Eastern and Western Conference
      if (nbaTeams.length === 0) {
        const easternResponse = await fetch(GRAPHQL_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: `
              query GetEasternTeams {
                getTeams(league: "Eastern Conference", season: "2025") {
                  id
                  name
                  league
                  division
                  record
                  odds
                }
              }
            `
          })
        });
        
        const easternData = await easternResponse.json();
        const easternTeams = easternData.data?.getTeams || [];
        
        const westernResponse = await fetch(GRAPHQL_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: `
              query GetWesternTeams {
                getTeams(league: "Western Conference", season: "2025") {
                  id
                  name
                  league
                  division
                  record
                  odds
                }
              }
            `
          })
        });
        
        const westernData = await westernResponse.json();
        const westernTeams = westernData.data?.getTeams || [];
        
        nbaTeams = [...easternTeams, ...westernTeams];
      }
      
      // Sort teams by name
      nbaTeams.sort((a, b) => a.name.localeCompare(b.name));
      
      setTeams(nbaTeams);
      
      // Step 2: Fetch odds from Odds API
      await fetchOdds(nbaTeams);
      
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [fetchOdds]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const findOddsForTeam = (teamName) => {
    const normalizedName = teamName.toLowerCase().replace(/[^a-z\s]/g, '').trim();
    
    // Try full name
    let oddsInfo = oddsMap[normalizedName];
    if (oddsInfo) {
      return { ...oddsInfo, matchKey: normalizedName };
    }
    
    // Try last word
    const nameParts = normalizedName.split(/\s+/);
    if (nameParts.length > 0) {
      oddsInfo = oddsMap[nameParts[nameParts.length - 1]];
      if (oddsInfo) {
        return { ...oddsInfo, matchKey: nameParts[nameParts.length - 1] };
      }
    }
    
    // Try last 2 words
    if (nameParts.length >= 2) {
      oddsInfo = oddsMap[nameParts.slice(-2).join(' ')];
      if (oddsInfo) {
        return { ...oddsInfo, matchKey: nameParts.slice(-2).join(' ') };
      }
    }
    
    // Try LA conversion
    if (nameParts.length >= 2 && nameParts[0] === 'los' && nameParts[1] === 'angeles') {
      oddsInfo = oddsMap[`la ${nameParts.slice(2).join(' ')}`];
      if (oddsInfo) {
        return { ...oddsInfo, matchKey: `la ${nameParts.slice(2).join(' ')}` };
      }
    }
    
    return null;
  };

  if (loading && teams.length === 0) {
    return (
      <div className="admin-page">
        <div className="loading">Loading NBA teams and odds data...</div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-header">
        <button className="back-button" onClick={onBackToHome}>
          ← Back to Admin
        </button>
        <h1>NBA Odds API Test - 2025-26 Season</h1>
        <button className="refresh-button" onClick={fetchData} disabled={loading}>
          {loading ? '🔄 Loading...' : '🔄 Refresh'}
        </button>
      </div>

      {error && (
        <div className="error-message" style={{ padding: '15px', margin: '15px', backgroundColor: '#ffebee', color: '#c62828', borderRadius: '4px' }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      <div className="admin-stats">
        <div className="stat-card">
          <div className="stat-label">Total NBA Teams</div>
          <div className="stat-value">{stats.totalTeams}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Teams With Odds</div>
          <div className="stat-value">{stats.teamsWithOdds}</div>
        </div>
        <div className="stat-card warning">
          <div className="stat-label">Teams Without Odds</div>
          <div className="stat-value">{stats.teamsWithoutOdds}</div>
        </div>
        {oddsData && oddsData.endpoint && (
          <div className="stat-card">
            <div className="stat-label">Odds API Endpoint</div>
            <div className="stat-value" style={{ fontSize: '0.9em' }}>{oddsData.endpoint}</div>
          </div>
        )}
        {oddsData && oddsData.data && (
          <div className="stat-card">
            <div className="stat-label">Odds API Results</div>
            <div className="stat-value">{Array.isArray(oddsData.data) ? oddsData.data.length : 0}</div>
          </div>
        )}
      </div>

      <div className="admin-info">
        <p>Testing Odds API for NBA Championship Futures (2025-26 Season)</p>
        <p>This page shows all 30 NBA teams and their championship odds from The Odds API.</p>
      </div>

      <div className="admin-table-container">
        <table className="admin-teams-table">
          <thead>
            <tr>
              <th>Team Name</th>
              <th>League</th>
              <th>Division</th>
              <th>Record</th>
              <th>Odds API Match</th>
              <th>Odds API Name</th>
              <th>Championship Odds</th>
              <th>Current DB Odds</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {teams.map((team) => {
              const oddsInfo = findOddsForTeam(team.name);
              const hasOdds = oddsInfo !== null;
              
              return (
                <tr 
                  key={team.id}
                  className={hasOdds ? '' : 'row-missing-data'}
                >
                  <td className="col-name">{team.name}</td>
                  <td>{team.league || 'N/A'}</td>
                  <td>{team.division || 'N/A'}</td>
                  <td>{team.record || 'N/A'}</td>
                  <td>{oddsInfo ? oddsInfo.matchKey : <span className="missing-value">No match</span>}</td>
                  <td>{oddsInfo ? oddsInfo.fullName : <span className="missing-value">N/A</span>}</td>
                  <td className={hasOdds ? '' : 'missing'}>
                    {oddsInfo ? oddsInfo.odds : <span className="missing-value">No odds</span>}
                  </td>
                  <td>{team.odds || <span className="missing-value">NULL</span>}</td>
                  <td>
                    {hasOdds ? (
                      <span style={{ color: '#2e7d32', fontWeight: 'bold' }}>✓ Found</span>
                    ) : (
                      <span style={{ color: '#c62828', fontWeight: 'bold' }}>✗ Missing</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {teams.length === 0 && !loading && (
        <div className="no-results">
          <p>No NBA teams found. Make sure NBA 2025 teams exist in the database.</p>
        </div>
      )}

      {oddsData && (
        <div style={{ marginTop: '30px', padding: '15px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
          <h3>Raw Odds API Data</h3>
          
          {oddsData.url && (
            <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#e3f2fd', borderRadius: '4px' }}>
              <strong>API URL Called:</strong>
              <div style={{ marginTop: '5px', fontFamily: 'monospace', fontSize: '0.9em', wordBreak: 'break-all' }}>
                {ODDS_API_KEY ? oddsData.url.replace(ODDS_API_KEY, 'YOUR_API_KEY') : oddsData.url.replace(/apiKey=[^&]+/, 'apiKey=YOUR_API_KEY')}
              </div>
              <div style={{ marginTop: '5px', fontSize: '0.9em' }}>
                <strong>Endpoint:</strong> {oddsData.endpoint || 'N/A'} | 
                <strong> Markets:</strong> {oddsData.markets || 'none'}
              </div>
            </div>
          )}
          
          {oddsData.urls && oddsData.urls.length > 0 && (
            <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#fff3e0', borderRadius: '4px' }}>
              <strong>All URLs Attempted:</strong>
              {oddsData.urls.map((urlInfo, idx) => (
                <div key={idx} style={{ marginTop: '10px', padding: '8px', backgroundColor: '#fff', borderRadius: '4px' }}>
                  <div style={{ fontSize: '0.9em', marginBottom: '5px' }}>
                    <strong>Endpoint:</strong> {urlInfo.endpoint} | 
                    <strong> Markets:</strong> {urlInfo.markets}
                  </div>
                  <div style={{ fontFamily: 'monospace', fontSize: '0.85em', wordBreak: 'break-all' }}>
                    {ODDS_API_KEY ? urlInfo.url.replace(ODDS_API_KEY, 'YOUR_API_KEY') : urlInfo.url.replace(/apiKey=[^&]+/, 'apiKey=YOUR_API_KEY')}
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {oddsData.error && (
            <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#ffebee', color: '#c62828', borderRadius: '4px' }}>
              <strong>Error:</strong> {oddsData.error}
            </div>
          )}
          
          {oddsData.data && Array.isArray(oddsData.data) && oddsData.data.length > 0 ? (
            <>
              <div style={{ marginBottom: '10px' }}>
                <strong>Total Results:</strong> {oddsData.data.length} | 
                <strong> Showing:</strong> First entry (full response available below)
              </div>
              <pre style={{ backgroundColor: '#fff', padding: '10px', borderRadius: '4px', overflow: 'auto', maxHeight: '400px' }}>
                {JSON.stringify(oddsData.data[0], null, 2)}
              </pre>
              
              <details style={{ marginTop: '15px' }}>
                <summary style={{ cursor: 'pointer', padding: '10px', backgroundColor: '#fff', borderRadius: '4px', fontWeight: 'bold' }}>
                  View Full API Response ({oddsData.data.length} entries)
                </summary>
                <pre style={{ backgroundColor: '#fff', padding: '10px', borderRadius: '4px', overflow: 'auto', maxHeight: '600px', marginTop: '10px' }}>
                  {JSON.stringify(oddsData.data, null, 2)}
                </pre>
              </details>
            </>
          ) : oddsData.data && !Array.isArray(oddsData.data) ? (
            <pre style={{ backgroundColor: '#fff', padding: '10px', borderRadius: '4px', overflow: 'auto', maxHeight: '400px' }}>
              {JSON.stringify(oddsData.data, null, 2)}
            </pre>
          ) : (
            <div style={{ padding: '10px', backgroundColor: '#fff', borderRadius: '4px', color: '#666' }}>
              No data returned from API
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NbaOddsTestPage;

