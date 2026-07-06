import { computeMatchup, findTeam } from './wc2026MatchupEngine.js';
import {
  americanToDecimal,
  cappedEvFromProbAndAmerican,
  fairAmerican,
  GAME_TOTAL_UNDER_MIN_EV,
  MIN_PLAY_EV,
  shadowTierUnits,
} from './wc2026Pricing.js';
import { getMarketLines } from '../services/wcCornersOddsApi.js';

const MIN_EV = MIN_PLAY_EV;

function sideProb(lineRow, side) {
  return String(side).toLowerCase() === 'under' ? lineRow.pUnder : lineRow.pOver;
}

function modelMarketGap(prob, marketLine) {
  const impl = marketLine?.impliedProb ?? null;
  if (impl == null || prob == null) return null;
  return prob - impl;
}

function bestMarketForSide(marketLines, point, side, prob, minEv = MIN_EV) {
  const sideLower = String(side).toLowerCase();
  const matches = (marketLines || []).filter(
    (m) => m.point === point && String(m.name).toLowerCase() === sideLower
  );
  let best = null;
  let bestEv = -Infinity;
  matches.forEach((m) => {
    const ev = cappedEvFromProbAndAmerican(prob, m);
    if (ev != null && ev > bestEv) {
      bestEv = ev;
      best = m;
    }
  });
  if (!best || bestEv < minEv) return null;
  return { market: best, ev: bestEv, modelMarketGap: modelMarketGap(prob, best) };
}

function pushPlay(plays, base) {
  plays.push({
    ...base,
    tier: shadowTierUnits(base.evPct, base.modelMarketGap),
    fairOdds: fairAmerican(base.modelPct),
  });
}

function collectTeamTotals(matchup, fixture, teamName, modelLines, plays, matchLabel) {
  const marketLines = getMarketLines(fixture, 'alternate_team_totals_corners', teamName);
  (modelLines || []).forEach((row) => {
    ['Over', 'Under'].forEach((side) => {
      const prob = sideProb(row, side);
      const hit = bestMarketForSide(marketLines, row.line, side, prob);
      if (!hit) return;
      const tag = side === 'Under' ? 'u' : 'o';
      pushPlay(plays, {
        match: matchLabel,
        fixtureId: fixture.eventId,
        kickoff: fixture.commenceTime,
        selection: `${teamName} ${tag}${row.line}`,
        side,
        marketType: 'team_total',
        team: teamName,
        line: row.line,
        modelPct: prob,
        odds: hit.market.price,
        book: hit.market.bookmaker,
        evPct: hit.ev,
        modelMarketGap: hit.modelMarketGap,
        fixtureCluster: fixture.eventId,
        thesisKey: `${teamName}-${side.toLowerCase()}`,
        thesis: side === 'Under' ? `${teamName} corners under` : `${teamName} corners over`,
      });
    });
  });
}

function collectGameTotals(matchup, fixture, plays, matchLabel) {
  const marketLines = getMarketLines(fixture, 'alternate_totals_corners');
  (matchup.totalOverUnder || []).forEach((row) => {
    ['Over', 'Under'].forEach((side) => {
      const prob = sideProb(row, side);
      const minEv = side === 'Under' ? GAME_TOTAL_UNDER_MIN_EV : MIN_EV;
      const hit = bestMarketForSide(marketLines, row.line, side, prob, minEv);
      if (!hit) return;
      const tag = side === 'Under' ? 'u' : 'o';
      pushPlay(plays, {
        match: matchLabel,
        fixtureId: fixture.eventId,
        kickoff: fixture.commenceTime,
        selection: `Total ${tag}${row.line}`,
        side,
        marketType: 'game_total',
        team: null,
        line: row.line,
        modelPct: prob,
        odds: hit.market.price,
        book: hit.market.bookmaker,
        evPct: hit.ev,
        modelMarketGap: hit.modelMarketGap,
        fixtureCluster: fixture.eventId,
        thesisKey: `total-${side.toLowerCase()}`,
        thesis: `Game total ${side.toLowerCase()}`,
      });
    });
  });
}

function collectHandicaps(matchup, fixture, plays, matchLabel) {
  const marketLines = getMarketLines(fixture, 'alternate_spreads_corners');
  (matchup.handicapTable || []).forEach((row) => {
    const probA = row.aCoversProb;
    const hitA = bestMarketForSide(
      marketLines.filter((m) => m.description === matchup.teamA || m.name === matchup.teamA),
      row.line,
      'Over',
      probA
    );
    if (hitA) {
      const lineStr = row.line > 0 ? `+${row.line}` : row.line;
      pushPlay(plays, {
        match: matchLabel,
        fixtureId: fixture.eventId,
        kickoff: fixture.commenceTime,
        selection: `${matchup.teamA} ${lineStr}`,
        side: 'Handicap',
        marketType: 'handicap',
        team: matchup.teamA,
        line: row.line,
        modelPct: probA,
        odds: hitA.market.price,
        book: hitA.market.bookmaker,
        evPct: hitA.ev,
        modelMarketGap: hitA.modelMarketGap,
        fixtureCluster: fixture.eventId,
        thesisKey: `handicap-${matchup.teamA}`,
        thesis: `${matchup.teamA} handicap`,
      });
    }

    const probB = row.bCoversProb;
    const hitB = bestMarketForSide(
      marketLines.filter((m) => m.description === matchup.teamB || m.name === matchup.teamB),
      -row.line,
      'Over',
      probB
    );
    if (hitB) {
      const bLine = -row.line;
      const lineStr = bLine > 0 ? `+${bLine}` : bLine;
      pushPlay(plays, {
        match: matchLabel,
        fixtureId: fixture.eventId,
        kickoff: fixture.commenceTime,
        selection: `${matchup.teamB} ${lineStr}`,
        side: 'Handicap',
        marketType: 'handicap',
        team: matchup.teamB,
        line: bLine,
        modelPct: probB,
        odds: hitB.market.price,
        book: hitB.market.bookmaker,
        evPct: hitB.ev,
        modelMarketGap: hitB.modelMarketGap,
        fixtureCluster: fixture.eventId,
        thesisKey: `handicap-${matchup.teamB}`,
        thesis: `${matchup.teamB} handicap`,
      });
    }
  });
}

/** Scan all fixtures with odds; return plays with EV ≥ minEv, ranked by EV. */
export function buildSlate(fixtures = [], dashboard = [], parameters = {}, minEv = MIN_EV) {
  const plays = [];

  (fixtures || []).forEach((fixture) => {
    const home = findTeam(dashboard, fixture.homeTeam);
    const away = findTeam(dashboard, fixture.awayTeam);
    if (!home || !away) return;

    const hasLines = (fixture.markets || []).some((m) => (m.lines || []).length > 0);
    if (!hasLines) return;

    const matchup = computeMatchup(home, away, parameters, 1, 1, { fixture });
    const matchLabel = `${fixture.homeTeam}/${fixture.awayTeam}`;

    collectTeamTotals(matchup, fixture, fixture.homeTeam, matchup.teamAOverUnder, plays, matchLabel);
    collectTeamTotals(matchup, fixture, fixture.awayTeam, matchup.teamBOverUnder, plays, matchLabel);
    collectGameTotals(matchup, fixture, plays, matchLabel);
    collectHandicaps(matchup, fixture, plays, matchLabel);
  });

  return plays
    .filter((p) => p.evPct >= minEv)
    .sort((a, b) => b.evPct - a.evPct);
}

/** Group plays by fixture for correlation read. */
export function groupPlaysByFixture(plays = []) {
  const groups = {};
  plays.forEach((p) => {
    if (!groups[p.fixtureCluster]) {
      groups[p.fixtureCluster] = { match: p.match, kickoff: p.kickoff, plays: [] };
    }
    groups[p.fixtureCluster].plays.push(p);
  });
  return Object.entries(groups)
    .map(([id, g]) => ({ fixtureId: id, ...g, plays: g.plays.sort((a, b) => b.evPct - a.evPct) }))
    .sort((a, b) => (b.plays[0]?.evPct || 0) - (a.plays[0]?.evPct || 0));
}

/** One highest-EV play per fixture (de-correlated menu). */
export function pickDecorrelatedPlays(plays = []) {
  const bestByFixture = {};
  plays.forEach((p) => {
    const cur = bestByFixture[p.fixtureCluster];
    if (!cur || p.evPct > cur.evPct) bestByFixture[p.fixtureCluster] = p;
  });
  return Object.values(bestByFixture).sort((a, b) => b.evPct - a.evPct);
}

function fmtPct(n) {
  if (n == null || Number.isNaN(n)) return '—';
  return `${(n * 100).toFixed(1)}%`;
}

function fmtOdds(n) {
  if (n == null || Number.isNaN(n)) return '—';
  return n > 0 ? `+${n}` : String(n);
}

/** Message 1: clean plays for posting. */
export function formatPlaysMessage(plays = []) {
  const pct = Math.round(MIN_EV * 100);
  if (!plays.length) return `No plays above ${pct}% EV in current slate.`;
  return plays
    .map((p, i) => {
      const tier = p.tier ? `${p.tier}u` : '—';
      return `${i + 1}. ${p.selection} · ${fmtOdds(p.odds)} · Model ${fmtPct(p.modelPct)} · EV ${fmtPct(p.evPct)} · ${tier}`;
    })
    .join('\n');
}

/** Message 2: correlation / caveats analysis. */
export function formatAnalysisMessage(plays = [], clusters = [], decorrelated = [], biasBanner = null) {
  const lines = [];

  if (biasBanner?.message) {
    lines.push(`Bias read: ${biasBanner.message}`);
    lines.push('');
  }

  if (clusters.length) {
    lines.push('Correlation clusters (same match = shared thesis):');
    clusters.forEach((c) => {
      const top = c.plays.slice(0, 3).map((p) => p.selection).join(', ');
      lines.push(`• ${c.match}: ${top}${c.plays.length > 3 ? ` (+${c.plays.length - 3} more)` : ''}`);
    });
    lines.push('');
  }

  if (decorrelated.length) {
    lines.push('De-correlated angle (one per fixture, highest EV):');
    decorrelated.forEach((p) => {
      lines.push(`• ${p.selection} — EV ${fmtPct(p.evPct)} (${p.thesis})`);
    });
    lines.push('');
  }

  const underPlays = plays.filter((p) => String(p.side).toLowerCase() === 'under');
  if (underPlays.length >= 2) {
    lines.push(`Note: ${underPlays.length} under plays in slate — correlated if model is running hot vs actuals.`);
  }

  lines.push('Confirm 90-min corner settlement per book before logging (knockout ET risk).');

  return lines.join('\n');
}

export { MIN_EV as SLATE_MIN_EV, americanToDecimal };
