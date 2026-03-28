/**
 * Lambda function to proxy NBA.com Stats API requests
 * This avoids CORS issues when calling NBA API from the browser
 */

const NBA_API_BASE = 'https://stats.nba.com/stats';

/**
 * Lambda handler for NBA API proxy
 */
export const handler = async (event) => {
  console.log('🏀 NBA Proxy Lambda invoked', {
    httpMethod: event.httpMethod,
    queryStringParameters: event.queryStringParameters
  });

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400'
      },
      body: ''
    };
  }

  try {
    // Get season parameter (defaults to current season)
    const season = event.queryStringParameters?.season || null;
    
    if (!season) {
      // Calculate current season
      const currentYear = new Date().getFullYear();
      const seasonStart = currentYear - 1;
      const seasonParam = `${seasonStart}-${String(currentYear).slice(-2)}`;
    }

    const seasonParam = season || (() => {
      const currentYear = new Date().getFullYear();
      const seasonStart = currentYear - 1;
      return `${seasonStart}-${String(currentYear).slice(-2)}`;
    })();

    // Fetch from NBA.com API
    const standingsUrl = `${NBA_API_BASE}/leaguestandingsv3?LeagueID=00&Season=${seasonParam}&SeasonType=Regular%20Season`;
    
    console.log(`📡 Fetching from NBA API: ${standingsUrl}`);

    // Use fetch (available in Lambda Node.js 18+)
    const fetch = (await import('node-fetch')).default;
    
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
      console.error(`❌ NBA API error: ${response.status} ${response.statusText}`);
      return {
        statusCode: response.status,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: `NBA API error: ${response.status} ${response.statusText}`
        })
      };
    }

    const data = await response.json();

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(data)
    };

  } catch (error) {
    console.error('❌ Error in NBA proxy:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: error.message || 'Internal server error'
      })
    };
  }
};

