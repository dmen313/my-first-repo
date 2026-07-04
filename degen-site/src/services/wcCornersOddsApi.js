const ODDS_API_BASE = 'https://api.the-odds-api.com/v4';
const ODDS_API_KEY = process.env.REACT_APP_ODDS_API_KEY || 'YOUR_API_KEY';
const SPORT_KEY = 'soccer_fifa_world_cup';

const CORNER_MARKETS = [
  'alternate_totals_corners',
  'alternate_team_totals_corners',
  'alternate_spreads_corners',
];

/** Map Odds API team names to dashboard / spreadsheet names. */
export const ODDS_TEAM_ALIASES = {
  'Cape Verde': 'Cabo Verde',
  'United States': 'USA',
  'South Korea': 'South Korea',
  'DR Congo': 'DR Congo',
};

export function normalizeOddsTeamName(name) {
  if (!name) return '';
  return ODDS_TEAM_ALIASES[name] || name;
}

export function teamsMatchOddsName(dashboardTeam, oddsName) {
  const normalized = normalizeOddsTeamName(oddsName);
  if (dashboardTeam === normalized || dashboardTeam === oddsName) return true;
  return dashboardTeam.toLowerCase() === normalized.toLowerCase();
}

function parseAmericanOdds(price) {
  if (price === null || price === undefined || Number.isNaN(Number(price))) return null;
  const n = Number(price);
  if (n === 0) return null;
  if (n > 0) return 100 / (n + 100);
  return Math.abs(n) / (Math.abs(n) + 100);
}

export function impliedProbFromAmerican(price) {
  return parseAmericanOdds(price);
}

async function oddsFetch(path) {
  if (!ODDS_API_KEY || ODDS_API_KEY === 'YOUR_API_KEY') {
    throw new Error('Odds API key not configured (REACT_APP_ODDS_API_KEY)');
  }
  const sep = path.includes('?') ? '&' : '?';
  const url = `${ODDS_API_BASE}${path}${sep}apiKey=${ODDS_API_KEY}`;
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok || data.error_code) {
    throw new Error(data.message || `Odds API error ${response.status}`);
  }
  return data;
}

export async function fetchWcEvents() {
  return oddsFetch(`/sports/${SPORT_KEY}/events`);
}

export async function fetchWcEventCornerOdds(eventId) {
  const markets = CORNER_MARKETS.join(',');
  const data = await oddsFetch(
    `/sports/${SPORT_KEY}/events/${eventId}/odds?regions=us&oddsFormat=american&markets=${markets}`
  );
  return data;
}

function flattenMarketOutcomes(bookmakers) {
  const byMarket = {};
  (bookmakers || []).forEach((bookmaker) => {
    (bookmaker.markets || []).forEach((market) => {
      if (!byMarket[market.key]) {
        byMarket[market.key] = { key: market.key, lines: [] };
      }
      (market.outcomes || []).forEach((outcome) => {
        byMarket[market.key].lines.push({
          bookmaker: bookmaker.title || bookmaker.key,
          name: outcome.name,
          description: outcome.description || null,
          point: outcome.point,
          price: outcome.price,
          impliedProb: impliedProbFromAmerican(outcome.price),
        });
      });
    });
  });
  return Object.values(byMarket);
}

/**
 * Fetch corner odds for all upcoming WC fixtures.
 */
export async function fetchAllWcCornerOdds() {
  const events = await fetchWcEvents();
  const fixtures = [];

  for (const event of events) {
    try {
      const oddsPayload = await fetchWcEventCornerOdds(event.id);
      fixtures.push({
        eventId: event.id,
        homeTeam: normalizeOddsTeamName(event.home_team),
        awayTeam: normalizeOddsTeamName(event.away_team),
        homeTeamRaw: event.home_team,
        awayTeamRaw: event.away_team,
        commenceTime: event.commence_time,
        markets: flattenMarketOutcomes(oddsPayload.bookmakers),
        fetchedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.warn(`Failed corner odds for ${event.home_team} vs ${event.away_team}:`, err.message);
    }
  }

  return {
    fixtures,
    fetchedAt: new Date().toISOString(),
    eventCount: events.length,
  };
}

export function findFixtureForTeams(fixtures, teamA, teamB) {
  return (fixtures || []).find((f) => {
    const home = f.homeTeam;
    const away = f.awayTeam;
    return (
      (teamsMatchOddsName(teamA, home) && teamsMatchOddsName(teamB, away))
      || (teamsMatchOddsName(teamA, away) && teamsMatchOddsName(teamB, home))
    );
  }) || null;
}

export function getMarketLines(fixture, marketKey, teamName = null) {
  if (!fixture?.markets) return [];
  const market = fixture.markets.find((m) => m.key === marketKey);
  if (!market) return [];
  let lines = market.lines || [];
  if (teamName) {
    lines = lines.filter(
      (l) => teamsMatchOddsName(teamName, l.description) || teamsMatchOddsName(teamName, l.name)
    );
  }
  return lines.sort((a, b) => (a.point || 0) - (b.point || 0));
}
