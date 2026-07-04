import { fairAmerican } from '../utils/wc2026Pricing.js';
import { normalizeOddsTeamName, teamsMatchOddsName } from './wcCornersOddsApi.js';

const KALSHI_API_BASE = 'https://api.elections.kalshi.com/trade-api/v2';
const KALSHI_BOOK = 'Kalshi';

const CORNER_SERIES = [
  { series: 'KXWCCORNERS', marketKey: 'alternate_totals_corners' },
  { series: 'KXWCTCORNERS', marketKey: 'alternate_team_totals_corners' },
];

function parseKalshiProb(dollars) {
  const p = Number(dollars);
  if (!Number.isFinite(p) || p <= 0 || p >= 1) return null;
  return p;
}

function kalshiProbToLine(prob) {
  if (prob === null) return null;
  return {
    price: fairAmerican(prob),
    impliedProb: prob,
  };
}

/**
 * Kalshi UI YES probability: last trade, else mid of yes bid/ask.
 */
export function kalshiDisplayedYesProb(market) {
  const last = parseKalshiProb(market.last_price_dollars);
  if (last !== null) return last;

  const bid = parseKalshiProb(market.yes_bid_dollars);
  const ask = parseKalshiProb(market.yes_ask_dollars);
  if (bid !== null && ask !== null) return (bid + ask) / 2;
  return ask ?? bid ?? null;
}

/** Kalshi NO price — matches kalshi.com/app (no_bid on the NO side). */
export function kalshiDisplayedNoProb(market) {
  const noBid = parseKalshiProb(market.no_bid_dollars);
  if (noBid !== null) return noBid;

  const noAsk = parseKalshiProb(market.no_ask_dollars);
  if (noAsk !== null) return noAsk;

  const yes = kalshiDisplayedYesProb(market);
  return yes !== null ? 1 - yes : null;
}

/** Parse "Mexico vs England: Total Corners" → [home, away]. */
export function parseKalshiEventTeams(title) {
  if (!title) return [null, null];
  const m = title.match(/^(.+?)\s+vs\.?\s+(.+?)(?:\s*:|$)/i);
  if (!m) return [null, null];
  return [normalizeOddsTeamName(m[1].trim()), normalizeOddsTeamName(m[2].trim())];
}

/** Parse "Mexico: 8+ corners" → team name. */
export function parseKalshiTeamMarketTitle(title) {
  if (!title) return null;
  const m = title.match(/^(.+?):\s*\d+\+/);
  return m ? normalizeOddsTeamName(m[1].trim()) : null;
}

/** Kalshi "N+ corners" → sportsbook half-point line (Over N−0.5). */
export function kalshiThresholdToPoint(threshold) {
  const n = Number(threshold);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n - 0.5;
}

function thresholdFromMarket(market) {
  if (Number.isFinite(market.floor_strike)) return market.floor_strike;
  const src = market.yes_sub_title || market.title || '';
  const m = src.match(/(\d+)\+/);
  return m ? Number(m[1]) : null;
}

function buildOverUnderLines(threshold, market, teamName = null) {
  const point = kalshiThresholdToPoint(threshold);
  if (point === null) return [];

  const yesProb = kalshiDisplayedYesProb(market);
  const noProb = kalshiDisplayedNoProb(market);
  if (yesProb === null && noProb === null) return [];

  const lines = [];
  const over = yesProb !== null ? kalshiProbToLine(yesProb) : null;
  const under = noProb !== null ? kalshiProbToLine(noProb) : null;

  if (over?.price !== null) {
    lines.push({
      bookmaker: KALSHI_BOOK,
      name: 'Over',
      description: teamName,
      point,
      price: over.price,
      impliedProb: over.impliedProb,
      kalshiThreshold: threshold,
    });
  }

  if (under?.price !== null) {
    lines.push({
      bookmaker: KALSHI_BOOK,
      name: 'Under',
      description: teamName,
      point,
      price: under.price,
      impliedProb: under.impliedProb,
      kalshiThreshold: threshold,
    });
  }

  return lines;
}

async function kalshiFetch(path) {
  const url = `${KALSHI_API_BASE}${path}`;
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || data.error?.message || `Kalshi API error ${response.status}`);
  }
  return data;
}

async function fetchSeriesMarkets(seriesTicker) {
  const markets = [];
  let cursor = null;

  do {
    const params = new URLSearchParams({
      series_ticker: seriesTicker,
      status: 'open',
      limit: '200',
    });
    if (cursor) params.set('cursor', cursor);

    const data = await kalshiFetch(`/markets?${params.toString()}`);
    markets.push(...(data.markets || []));
    cursor = data.cursor || null;
  } while (cursor);

  return markets;
}

async function fetchKalshiEvent(eventTicker) {
  const data = await kalshiFetch(`/events/${eventTicker}`);
  return data.event || null;
}

/** Parse `26JUL05` from event ticker → ISO date. */
export function parseKalshiEventDate(eventTicker) {
  if (!eventTicker) return null;
  const m = eventTicker.match(/(\d{2})(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)(\d{2})/i);
  if (!m) return null;
  const months = {
    JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
    JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12',
  };
  const year = 2000 + Number(m[1]);
  const month = months[m[2].toUpperCase()];
  const day = m[3];
  return `${year}-${month}-${day}T00:00:00.000Z`;
}

function bestCommenceTime(event, market) {
  return market.occurrence_datetime
    || market.expected_expiration_time
    || parseKalshiEventDate(event.event_ticker)
    || null;
}

function appendLines(byMarketKey, marketKey, lines) {
  if (!lines.length) return;
  if (!byMarketKey[marketKey]) byMarketKey[marketKey] = { key: marketKey, lines: [] };
  byMarketKey[marketKey].lines.push(...lines);
}

/**
 * Convert raw Kalshi WC corner markets into fixture-shaped payloads
 * ({ homeTeam, awayTeam, commenceTime, markets }).
 */
export async function fetchKalshiWcCornerOdds() {
  const marketsBySeries = await Promise.all(
    CORNER_SERIES.map(async ({ series, marketKey }) => {
      const markets = await fetchSeriesMarkets(series);
      return { series, marketKey, markets };
    })
  );

  const eventTickers = new Set();
  marketsBySeries.forEach(({ markets }) => {
    markets.forEach((m) => {
      if (m.event_ticker) eventTickers.add(m.event_ticker);
    });
  });

  const eventMap = {};
  await Promise.all(
    [...eventTickers].map(async (ticker) => {
      try {
        const event = await fetchKalshiEvent(ticker);
        if (event) eventMap[ticker] = event;
      } catch (err) {
        console.warn(`Kalshi event ${ticker}:`, err.message);
      }
    })
  );

  const fixtureMap = {};

  for (const { marketKey, markets } of marketsBySeries) {
    for (const market of markets) {
      const event = eventMap[market.event_ticker];
      if (!event) continue;

      const [homeTeam, awayTeam] = parseKalshiEventTeams(event.title);
      if (!homeTeam || !awayTeam) continue;

      const fixtureKey = `${homeTeam}|${awayTeam}|${(bestCommenceTime(event, market) || '').slice(0, 10)}`;
      if (!fixtureMap[fixtureKey]) {
        fixtureMap[fixtureKey] = {
          homeTeam,
          awayTeam,
          commenceTime: bestCommenceTime(event, market),
          markets: {},
          fetchedAt: new Date().toISOString(),
          source: 'kalshi',
        };
      }

      const threshold = thresholdFromMarket(market);
      const teamName = marketKey === 'alternate_team_totals_corners'
        ? parseKalshiTeamMarketTitle(market.title)
        : null;

      const lines = buildOverUnderLines(threshold, market, teamName);
      appendLines(fixtureMap[fixtureKey].markets, marketKey, lines);
    }
  }

  return Object.values(fixtureMap).map((f) => ({
    ...f,
    markets: Object.values(f.markets),
  }));
}

function commenceWithinWindow(a, b, hours = 36) {
  if (!a || !b) return true;
  const diff = Math.abs(new Date(a).getTime() - new Date(b).getTime());
  return diff <= hours * 3600 * 1000;
}

function findMatchingFixture(kalshiFixture, fixtures) {
  return (fixtures || []).find((f) => {
    const direct = teamsMatchOddsName(f.homeTeam, kalshiFixture.homeTeam)
      && teamsMatchOddsName(f.awayTeam, kalshiFixture.awayTeam);
    const swapped = teamsMatchOddsName(f.homeTeam, kalshiFixture.awayTeam)
      && teamsMatchOddsName(f.awayTeam, kalshiFixture.homeTeam);
    if (!direct && !swapped) return false;
    return commenceWithinWindow(f.commenceTime, kalshiFixture.commenceTime);
  }) || null;
}

export function mergeKalshiMarkets(existingMarkets, kalshiMarkets) {
  const byKey = {};
  (existingMarkets || []).forEach((m) => {
    byKey[m.key] = { key: m.key, lines: [...(m.lines || [])] };
  });
  (kalshiMarkets || []).forEach((m) => {
    if (!byKey[m.key]) byKey[m.key] = { key: m.key, lines: [] };
    byKey[m.key].lines.push(...(m.lines || []));
  });
  return Object.values(byKey);
}

/**
 * Append Kalshi lines to matching Odds API fixtures (in place).
 * Returns count of Kalshi fixtures merged.
 */
export function mergeKalshiIntoFixtures(fixtures, kalshiFixtures) {
  let merged = 0;

  for (const kalshi of kalshiFixtures || []) {
    const match = findMatchingFixture(kalshi, fixtures);
    if (match) {
      match.markets = mergeKalshiMarkets(match.markets, kalshi.markets);
      merged += 1;
      continue;
    }

    fixtures.push({
      eventId: `kalshi-${kalshi.homeTeam}-${kalshi.awayTeam}-${(kalshi.commenceTime || '').slice(0, 10)}`,
      homeTeam: kalshi.homeTeam,
      awayTeam: kalshi.awayTeam,
      homeTeamRaw: kalshi.homeTeam,
      awayTeamRaw: kalshi.awayTeam,
      commenceTime: kalshi.commenceTime,
      markets: kalshi.markets,
      fetchedAt: kalshi.fetchedAt,
      kalshiOnly: true,
    });
    merged += 1;
  }

  return merged;
}
