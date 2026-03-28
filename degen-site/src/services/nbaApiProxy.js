/**
 * NBA API Proxy Service
 * Proxies requests to NBA.com Stats API through Lambda to avoid CORS issues
 */

const NBA_PROXY_ENDPOINT = process.env.REACT_APP_NBA_PROXY_ENDPOINT || null;

/**
 * Fetch NBA standings through Lambda proxy
 */
export async function fetchNBAStandingsViaProxy(season = null) {
  // If no proxy endpoint is configured, return null to use direct fetch (which may fail due to CORS)
  if (!NBA_PROXY_ENDPOINT) {
    console.warn('⚠️ NBA proxy endpoint not configured, attempting direct fetch (may fail due to CORS)');
    return null;
  }

  try {
    const currentYear = new Date().getFullYear();
    let seasonYear = currentYear;
    
    // Determine season format
    let seasonParam = season;
    if (!seasonParam) {
      const seasonStart = seasonYear - 1;
      seasonParam = `${seasonStart}-${String(seasonYear).slice(-2)}`;
    }

    const proxyUrl = `${NBA_PROXY_ENDPOINT}?season=${encodeURIComponent(seasonParam)}`;
    
    console.log(`📡 Fetching NBA standings via proxy: ${proxyUrl}`);
    
    const response = await fetch(proxyUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      }
    });

    if (!response.ok) {
      console.error(`❌ NBA proxy request failed: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    
    if (data.error) {
      console.error(`❌ NBA proxy error: ${data.error}`);
      return null;
    }

    return data;
    
  } catch (error) {
    console.error('❌ Error fetching NBA standings via proxy:', error);
    return null;
  }
}

