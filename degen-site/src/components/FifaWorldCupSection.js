import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getWcCornersModel,
  refreshWcCornersOddsFromApi,
  recalcAndSaveWcCornersModel,
  saveWcCornersBet,
  updateWcCornersBet,
  addWcCornersMatchGames,
  saveWcCornersAccuracyEntry,
  gradeWcCornersAccuracyEntry,
  updateWcCornersGameIncluded,
  saveWcCornersParameters,
} from '../services/dynamoDBService';
import { findFixtureForTeams, getMarketLines, teamsMatchOddsName } from '../services/wcCornersOddsApi';
import { computeMatchup, findTeam } from '../utils/wc2026MatchupEngine';
import { evFromProbAndAmerican, shadowTierUnits } from '../utils/wc2026Pricing';
import { computeAccuracySummary, getOverProjectionBanner } from '../utils/wc2026Accuracy';
import { computeTrackerSummary, enrichBet } from '../utils/wc2026Tracker';
import {
  buildSlate,
  groupPlaysByFixture,
  pickDecorrelatedPlays,
  formatPlaysMessage,
  formatAnalysisMessage,
} from '../utils/wc2026SlateBuilder';
import { AUTO_PARAMETER_KEYS, runWcModelAudit } from '../utils/wc2026Audit';
import { fmtNum, fmtPct, fmtOdds, fmtSigned, resultClass } from '../utils/wc2026Formatters';
import './FifaWorldCupSection.css';

const SEASON = '2026';

const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'matchup', label: 'Matchup' },
  { id: 'markets', label: 'Markets' },
  { id: 'slate', label: 'Slate' },
  { id: 'tracker', label: 'Tracker' },
  { id: 'accuracy', label: 'Accuracy' },
  { id: 'parameters', label: 'Parameters' },
];

function SpreadsheetTable({ columns, rows, onRowClick, selectedKey }) {
  return (
    <div className="wc-table-wrap">
      <div className="wc-table-scroll">
        <table className="wc-table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`${col.sticky ? 'wc-sticky-left' : ''} ${col.hideMobile ? 'wc-hide-mobile' : ''}`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row._key}
                className={[
                  onRowClick ? 'wc-row-clickable' : '',
                  selectedKey && row._key === selectedKey ? 'wc-row-selected' : '',
                  row._rowClass || '',
                ].filter(Boolean).join(' ')}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`${col.sticky ? 'wc-sticky-left' : ''} ${col.hideMobile ? 'wc-hide-mobile' : ''} ${col.className || ''}`}
                  >
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OverUnderBlock({ title, lines, marketLines = null, side = 'over', probKey = 'pOver' }) {
  if (!lines?.length) return null;

  const marketByPoint = {};
  (marketLines || []).forEach((m) => {
    if (String(m.name).toLowerCase() === side) {
      marketByPoint[m.point] = m;
    }
  });

  const modelProb = (row) => (probKey === 'pUnder' ? row.pUnder : row.pOver);

  return (
    <div className="wc-section-block">
      <h3>{title}</h3>
      <SpreadsheetTable
        columns={[
          { key: 'line', label: 'Line', sticky: true, render: (r) => r.line },
          {
            key: 'modelProb',
            label: 'Model %',
            render: (r) => fmtPct(modelProb(r)),
          },
          {
            key: 'fairAm',
            label: 'Fair Am',
            render: (r) => fmtOdds(probKey === 'pUnder' ? r.fairAmUnder : r.fairAmOver),
          },
          {
            key: 'bookOdds',
            label: 'Book',
            render: (r) => {
              const m = marketByPoint[r.line];
              return m ? <span className="wc-pill">{fmtOdds(m.price)}</span> : '—';
            },
          },
          {
            key: 'ev',
            label: 'EV %',
            render: (r) => {
              const m = marketByPoint[r.line];
              if (!m?.price) return '—';
              const ev = evFromProbAndAmerican(modelProb(r), m.price);
              if (ev === null) return '—';
              return (
                <span className={ev >= 0.05 ? 'wc-positive' : ev < 0 ? 'wc-negative' : ''}>
                  {fmtPct(ev)}
                </span>
              );
            },
          },
          {
            key: 'tier',
            label: 'Tier',
            render: (r) => {
              const m = marketByPoint[r.line];
              if (!m?.price) return '—';
              const ev = evFromProbAndAmerican(modelProb(r), m.price);
              const tier = shadowTierUnits(ev);
              return tier > 0 ? `${tier}u` : '—';
            },
          },
        ]}
        rows={lines.map((line) => ({ ...line, _key: String(line.line) }))}
      />
    </div>
  );
}

function HandicapBlock({ title, handicapTable, marketLines, teamAName }) {
  if (!handicapTable?.length) return null;

  const spreadLines = (marketLines || []).filter((m) => m.description || m.name);

  return (
    <div className="wc-section-block">
      <h3>{title}</h3>
      <SpreadsheetTable
        columns={[
          {
            key: 'line',
            label: 'A Hcap',
            sticky: true,
            render: (r) => (r.line > 0 ? `+${r.line}` : r.line),
          },
          { key: 'aCoversProb', label: 'A %', render: (r) => fmtPct(r.aCoversProb) },
          { key: 'fairAmA', label: 'Fair A', render: (r) => fmtOdds(r.fairAmA) },
          { key: 'bCoversProb', label: 'B %', render: (r) => fmtPct(r.bCoversProb) },
          { key: 'fairAmB', label: 'Fair B', render: (r) => fmtOdds(r.fairAmB) },
        ]}
        rows={handicapTable.map((row) => ({ ...row, _key: String(row.line) }))}
      />
      {spreadLines.length > 0 && (
        <p className="wc-readme">
          Book spreads ({teamAName}): {spreadLines.slice(0, 2).map((l) => `${l.name} ${l.point > 0 ? '+' : ''}${l.point} (${fmtOdds(l.price)})`).join(' · ')}
        </p>
      )}
    </div>
  );
}

function MostCornersBlock({ mostCorners, teamA, teamB }) {
  if (!mostCorners) return null;
  return (
    <div className="wc-section-block">
      <h3>Most corners (Skellam)</h3>
      <SpreadsheetTable
        columns={[
          { key: 'outcome', label: 'Outcome', sticky: true },
          { key: 'prob', label: 'Prob' },
          { key: 'fair', label: 'Fair Am' },
        ]}
        rows={[
          { outcome: teamA, prob: mostCorners.teamA, fair: mostCorners.fairAmA, _key: 'a' },
          { outcome: 'Tie', prob: mostCorners.tie, fair: mostCorners.fairAmTie, _key: 'tie' },
          { outcome: teamB, prob: mostCorners.teamB, fair: mostCorners.fairAmB, _key: 'b' },
        ].map((r) => ({
          ...r,
          prob: fmtPct(r.prob),
          fair: fmtOdds(r.fair),
        }))}
      />
    </div>
  );
}

function formatFixtureKickoff(commenceTime) {
  return new Date(commenceTime).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

const MIN_PLAY_EV = 0.05;

function analyzeMarketSide(prob, marketLine) {
  if (!marketLine?.price || prob == null) return null;
  const ev = evFromProbAndAmerican(prob, marketLine.price);
  if (ev == null) return null;
  return { price: marketLine.price, ev, tier: shadowTierUnits(ev) };
}

function pickBestPlay(overAnalysis, underAnalysis) {
  const candidates = [];
  if (overAnalysis && overAnalysis.ev >= MIN_PLAY_EV) {
    candidates.push({ side: 'Over', ...overAnalysis });
  }
  if (underAnalysis && underAnalysis.ev >= MIN_PLAY_EV) {
    candidates.push({ side: 'Under', ...underAnalysis });
  }
  if (!candidates.length) return null;
  return candidates.sort((a, b) => b.ev - a.ev)[0];
}

function pivotOverUnderLines(lines) {
  const byKey = {};
  (lines || []).forEach((line) => {
    const side = String(line.name).toLowerCase();
    if (side !== 'over' && side !== 'under') return;
    const key = `${line.bookmaker}|${line.point}`;
    if (!byKey[key]) {
      byKey[key] = { bookmaker: line.bookmaker, point: line.point, over: null, under: null };
    }
    if (side === 'over') byKey[key].over = line;
    else byKey[key].under = line;
  });
  return Object.values(byKey).sort(
    (a, b) => a.bookmaker.localeCompare(b.bookmaker) || a.point - b.point
  );
}

function modelRowForPoint(modelLines, point) {
  return (modelLines || []).find((row) => row.line === point) || null;
}

function spreadModelProb(handicapTable, teamAName, teamBName, teamName, point) {
  if (teamsMatchOddsName(teamAName, teamName)) {
    const row = handicapTable?.find((r) => r.line === point);
    return row?.aCoversProb ?? null;
  }
  if (teamsMatchOddsName(teamBName, teamName)) {
    const row = handicapTable?.find((r) => -r.line === point);
    return row?.bCoversProb ?? null;
  }
  return null;
}

function MarketOddsCell({ analysis }) {
  if (!analysis) return '—';
  const evClass = analysis.ev >= MIN_PLAY_EV
    ? 'wc-positive'
    : analysis.ev < 0
      ? 'wc-negative'
      : '';
  return (
    <div className="wc-market-odds-cell">
      <span className="wc-pill">{fmtOdds(analysis.price)}</span>
      {analysis.ev != null && (
        <span className={`wc-market-ev ${evClass}`}>{fmtPct(analysis.ev)}</span>
      )}
    </div>
  );
}

function MarketPlayCell({ play }) {
  if (!play) {
    return <span className="wc-market-pass">Pass</span>;
  }
  return (
    <span className="wc-pill wc-pill-positive">
      {play.side} · {fmtPct(play.ev)} · {play.tier}u
    </span>
  );
}

function OverUnderMarketTable({ title, lines, modelLines }) {
  const rows = useMemo(() => {
    return pivotOverUnderLines(lines).map((row) => {
      const model = modelRowForPoint(modelLines, row.point);
      const overAnalysis = analyzeMarketSide(model?.pOver, row.over);
      const underAnalysis = analyzeMarketSide(model?.pUnder, row.under);
      return {
        ...row,
        model,
        overAnalysis,
        underAnalysis,
        play: pickBestPlay(overAnalysis, underAnalysis),
        _key: `${row.bookmaker}-${row.point}`,
      };
    });
  }, [lines, modelLines]);

  if (!lines?.length) {
    return (
      <div className="wc-section-block">
        <h3>{title}</h3>
        <p className="wc-readme">No lines available. Tap “Fetch Odds” to refresh from The Odds API.</p>
      </div>
    );
  }

  return (
    <div className="wc-section-block">
      <h3>{title}</h3>
      {!modelLines?.length && (
        <p className="wc-readme">Model lines unavailable for this market — odds only.</p>
      )}
      <SpreadsheetTable
        columns={[
          { key: 'bookmaker', label: 'Book', sticky: true },
          { key: 'point', label: 'Line', render: (r) => r.point },
          {
            key: 'modelOver',
            label: 'Model O',
            hideMobile: true,
            render: (r) => (r.model ? fmtPct(r.model.pOver) : '—'),
          },
          {
            key: 'modelUnder',
            label: 'Model U',
            hideMobile: true,
            render: (r) => (r.model ? fmtPct(r.model.pUnder) : '—'),
          },
          {
            key: 'over',
            label: 'Over',
            render: (r) => <MarketOddsCell analysis={r.overAnalysis} />,
          },
          {
            key: 'under',
            label: 'Under',
            render: (r) => <MarketOddsCell analysis={r.underAnalysis} />,
          },
          {
            key: 'play',
            label: 'Play',
            render: (r) => <MarketPlayCell play={r.play} />,
          },
        ]}
        rows={rows}
      />
    </div>
  );
}

function SpreadMarketTable({ title, lines, handicapTable, teamAName, teamBName }) {
  const rows = useMemo(() => {
    return (lines || [])
      .map((line, i) => {
        const teamName = line.description || line.name || '';
        const point = line.point;
        const prob = spreadModelProb(handicapTable, teamAName, teamBName, teamName, point);
        const analysis = analyzeMarketSide(prob, line);
        const lineLabel = point > 0 ? `+${point}` : point;
        return {
          bookmaker: line.bookmaker,
          teamName,
          point,
          lineLabel,
          modelPct: prob,
          analysis,
          play: analysis && analysis.ev >= MIN_PLAY_EV
            ? { side: teamName, ...analysis }
            : null,
          _key: `${line.bookmaker}-${teamName}-${point}-${i}`,
        };
      })
      .sort((a, b) => a.bookmaker.localeCompare(b.bookmaker) || a.teamName.localeCompare(b.teamName) || a.point - b.point);
  }, [lines, handicapTable, teamAName, teamBName]);

  if (!lines?.length) {
    return (
      <div className="wc-section-block">
        <h3>{title}</h3>
        <p className="wc-readme">No lines available. Tap “Fetch Odds” to refresh from The Odds API.</p>
      </div>
    );
  }

  return (
    <div className="wc-section-block">
      <h3>{title}</h3>
      {!handicapTable?.length && (
        <p className="wc-readme">Model handicap unavailable — odds only.</p>
      )}
      <SpreadsheetTable
        columns={[
          { key: 'bookmaker', label: 'Book', sticky: true },
          { key: 'teamName', label: 'Team' },
          { key: 'lineLabel', label: 'Line' },
          {
            key: 'odds',
            label: 'Odds',
            render: (r) => <MarketOddsCell analysis={r.analysis} />,
          },
          {
            key: 'model',
            label: 'Model',
            hideMobile: true,
            render: (r) => (r.modelPct != null ? fmtPct(r.modelPct) : '—'),
          },
          {
            key: 'play',
            label: 'Play',
            render: (r) => (
              r.play
                ? (
                  <span className="wc-pill wc-pill-positive">
                    {r.lineLabel} · {fmtPct(r.play.ev)} · {r.play.tier}u
                  </span>
                )
                : <span className="wc-market-pass">Pass</span>
            ),
          },
        ]}
        rows={rows}
      />
    </div>
  );
}

const EMPTY_BET = {
  date: '',
  match: '',
  selection: '',
  modelPct: '',
  oddsTaken: '',
  close: '',
  stake: '1',
  result: 'Pending',
};

const EMPTY_GAME = {
  teamA: 'England',
  teamB: 'Panama',
  date: '',
  cornersA: '',
  cornersB: '',
  comp: 'WC',
  venue: 'N',
  included: true,
  lockAccuracy: true,
};

const EMPTY_ACCURACY = {
  teamA: 'England',
  teamB: 'Panama',
  date: '',
  actA: '',
  actB: '',
  lockProjection: true,
};

function PendingAccuracyGrade({ row, saving, onGrade }) {
  const [actA, setActA] = useState('');
  const [actB, setActB] = useState('');

  return (
    <div className="wc-pending-grade">
      <span className="wc-pending-label">
        {row.date} · {row.teamA} vs {row.teamB} · locked proj {row.projTotal}
      </span>
      <input
        type="number"
        min="0"
        placeholder="Act A"
        value={actA}
        onChange={(e) => setActA(e.target.value)}
      />
      <input
        type="number"
        min="0"
        placeholder="Act B"
        value={actB}
        onChange={(e) => setActB(e.target.value)}
      />
      <button
        type="button"
        className="wc-grade-btn"
        disabled={saving || actA === '' || actB === ''}
        onClick={() => onGrade(row, actA, actB)}
      >
        Grade
      </button>
    </div>
  );
}

const FifaWorldCupSection = () => {
  const [modelData, setModelData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [oddsRefreshing, setOddsRefreshing] = useState(false);
  const [oddsMessage, setOddsMessage] = useState(null);
  const [recalcLoading, setRecalcLoading] = useState(false);
  const [betSaving, setBetSaving] = useState(false);
  const [betForm, setBetForm] = useState(EMPTY_BET);
  const [betMessage, setBetMessage] = useState(null);
  const [gameForm, setGameForm] = useState(EMPTY_GAME);
  const [gameSaving, setGameSaving] = useState(false);
  const [gameMessage, setGameMessage] = useState(null);
  const [accuracyForm, setAccuracyForm] = useState(EMPTY_ACCURACY);
  const [accuracySaving, setAccuracySaving] = useState(false);
  const [accuracyMessage, setAccuracyMessage] = useState(null);
  const [slateCopyMsg, setSlateCopyMsg] = useState(null);
  const [paramEdits, setParamEdits] = useState({});
  const [paramSaving, setParamSaving] = useState(false);
  const [paramMessage, setParamMessage] = useState(null);
  const [auditOpen, setAuditOpen] = useState(true);

  const [tab, setTab] = useState('dashboard');
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [teamA, setTeamA] = useState('England');
  const [teamB, setTeamB] = useState('Panama');
  const [manualA, setManualA] = useState(1);
  const [manualB, setManualB] = useState(1);
  const [selectedFixtureId, setSelectedFixtureId] = useState(null);

  const loadModel = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getWcCornersModel(SEASON);
      if (!data.dashboard?.length) {
        setError('No model data in DynamoDB. Run: npm run migrate-wc-corners');
      }
      setModelData(data);
    } catch (err) {
      console.error('WC model load error:', err);
      setError(err.message || 'Failed to load model from DynamoDB');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadModel();
  }, [loadModel]);

  useEffect(() => {
    const initial = {};
    Object.entries(modelData?.parameters || {}).forEach(([name, p]) => {
      initial[name] = p?.value ?? '';
    });
    setParamEdits(initial);
  }, [modelData?.parameters]);

  const dashboard = modelData?.dashboard || [];
  const parameters = modelData?.parameters || {};
  const tracker = modelData?.tracker || { summary: {}, bets: [] };
  const accuracy = modelData?.accuracy || { summary: {}, log: [] };
  const teams = modelData?.teams || {};
  const eloRatings = modelData?.eloRatings || [];
  const fixtures = modelData?.fixtures || [];
  const readme = modelData?.readme || [];
  const meta = modelData?.meta || { title: 'WC 2026 — Corner Kick Model' };
  const lastOddsSync = modelData?.lastOddsSync;

  const accuracyStats = useMemo(
    () => computeAccuracySummary(accuracy.log || []),
    [accuracy.log]
  );

  const biasBanner = useMemo(
    () => getOverProjectionBanner(accuracyStats),
    [accuracyStats]
  );

  const teamNames = useMemo(() => dashboard.map((t) => t.team).sort(), [dashboard]);

  const matchup = useMemo(() => {
    const a = findTeam(dashboard, teamA);
    const b = findTeam(dashboard, teamB);
    if (!a || !b) return null;
    return computeMatchup(a, b, parameters, manualA, manualB);
  }, [dashboard, parameters, teamA, teamB, manualA, manualB]);

  const activeFixture = useMemo(() => {
    const fromTeams = findFixtureForTeams(fixtures, teamA, teamB);
    if (fromTeams) return fromTeams;
    if (selectedFixtureId) {
      return fixtures.find((f) => f.eventId === selectedFixtureId) || null;
    }
    return null;
  }, [fixtures, teamA, teamB, selectedFixtureId]);

  const marketsFixture = useMemo(() => {
    if (!selectedFixtureId) return null;
    return fixtures.find((f) => f.eventId === selectedFixtureId) || null;
  }, [fixtures, selectedFixtureId]);

  const marketsMatchup = useMemo(() => {
    if (!marketsFixture) return null;
    const home = findTeam(dashboard, marketsFixture.homeTeam);
    const away = findTeam(dashboard, marketsFixture.awayTeam);
    if (!home || !away) return null;
    return computeMatchup(home, away, parameters);
  }, [marketsFixture, dashboard, parameters]);

  const handleRefreshOdds = async () => {
    try {
      setOddsRefreshing(true);
      setOddsMessage(null);
      const result = await refreshWcCornersOddsFromApi(SEASON);
      await loadModel();
      setOddsMessage(`Fetched ${result.fixtures.length} fixtures from The Odds API`);
    } catch (err) {
      setOddsMessage(`Odds refresh failed: ${err.message}`);
    } finally {
      setOddsRefreshing(false);
    }
  };

  const handleRecalcModel = async () => {
    try {
      setRecalcLoading(true);
      setOddsMessage(null);
      await recalcAndSaveWcCornersModel(SEASON);
      await loadModel();
      setOddsMessage('Model recalculated (adj attack/defense, winsor, φ)');
    } catch (err) {
      setOddsMessage(`Recalc failed: ${err.message}`);
    } finally {
      setRecalcLoading(false);
    }
  };

  const handleBetSubmit = async (e) => {
    e.preventDefault();
    setBetSaving(true);
    setBetMessage(null);
    try {
      await saveWcCornersBet(SEASON, {
        date: betForm.date,
        match: betForm.match,
        selection: betForm.selection,
        modelPct: Number(betForm.modelPct),
        oddsTaken: Number(betForm.oddsTaken),
        close: betForm.close !== '' ? Number(betForm.close) : null,
        stake: Number(betForm.stake) || 1,
        result: betForm.result || 'Pending',
      });
      setBetForm(EMPTY_BET);
      await loadModel();
      setBetMessage('Bet logged');
    } catch (err) {
      setBetMessage(err.message);
    } finally {
      setBetSaving(false);
    }
  };

  const handleGradeBet = async (betRow, result) => {
    if (!betRow._betId) return;
    setBetSaving(true);
    setBetMessage(null);
    try {
      await updateWcCornersBet(SEASON, betRow._betId, { result });
      await loadModel();
      setBetMessage(`Graded ${betRow.selection} → ${result}`);
    } catch (err) {
      setBetMessage(err.message);
    } finally {
      setBetSaving(false);
    }
  };

  const handleGameSubmit = async (e) => {
    e.preventDefault();
    setGameSaving(true);
    setGameMessage(null);
    try {
      await addWcCornersMatchGames(SEASON, {
        teamA: gameForm.teamA,
        teamB: gameForm.teamB,
        date: gameForm.date,
        cornersA: Number(gameForm.cornersA),
        cornersB: Number(gameForm.cornersB),
        comp: gameForm.comp,
        venue: gameForm.venue,
        included: gameForm.included,
        lockAccuracy: gameForm.lockAccuracy,
      });
      setGameForm({ ...EMPTY_GAME, teamA: gameForm.teamA, teamB: gameForm.teamB });
      await loadModel();
      setGameMessage('Match logged (mirrored both teams, model recalculated)');
    } catch (err) {
      setGameMessage(err.message);
    } finally {
      setGameSaving(false);
    }
  };

  const handleToggleGameIncluded = async (teamName, game) => {
    setGameSaving(true);
    setGameMessage(null);
    try {
      const key = `${game.date}|${game.opponent}`;
      await updateWcCornersGameIncluded(SEASON, teamName, key, !game.included);
      await loadModel();
      setGameMessage(`${game.opponent} game ${game.included ? 'excluded' : 'included'} (mirrored)`);
    } catch (err) {
      setGameMessage(err.message);
    } finally {
      setGameSaving(false);
    }
  };

  const handleAccuracySubmit = async (e) => {
    e.preventDefault();
    setAccuracySaving(true);
    setAccuracyMessage(null);
    try {
      const payload = {
        teamA: accuracyForm.teamA,
        teamB: accuracyForm.teamB,
        date: accuracyForm.date,
        lockProjection: accuracyForm.lockProjection,
      };
      if (accuracyForm.actA !== '' && accuracyForm.actB !== '') {
        payload.actA = Number(accuracyForm.actA);
        payload.actB = Number(accuracyForm.actB);
      }
      await saveWcCornersAccuracyEntry(SEASON, payload);
      setAccuracyForm({ ...EMPTY_ACCURACY, teamA: accuracyForm.teamA, teamB: accuracyForm.teamB });
      await loadModel();
      setAccuracyMessage(payload.actA != null ? 'Accuracy row graded with locked projection' : 'Projection locked (pending actuals)');
    } catch (err) {
      setAccuracyMessage(err.message);
    } finally {
      setAccuracySaving(false);
    }
  };

  const handleGradeAccuracy = async (entryRow, actA, actB) => {
    if (!entryRow._entryId) return;
    setAccuracySaving(true);
    setAccuracyMessage(null);
    try {
      await gradeWcCornersAccuracyEntry(SEASON, entryRow._entryId, {
        actA: Number(actA),
        actB: Number(actB),
      });
      await loadModel();
      setAccuracyMessage(`Graded ${entryRow.teamA} vs ${entryRow.teamB}`);
    } catch (err) {
      setAccuracyMessage(err.message);
    } finally {
      setAccuracySaving(false);
    }
  };

  const copySlateText = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      setSlateCopyMsg(`${label} copied`);
    } catch {
      setSlateCopyMsg('Copy failed — select text manually');
    }
  };

  const handleSaveParameters = async (e) => {
    e.preventDefault();
    setParamSaving(true);
    setParamMessage(null);
    try {
      const updates = {};
      Object.entries(paramEdits).forEach(([name, val]) => {
        if (AUTO_PARAMETER_KEYS.has(name)) return;
        updates[name] = val;
      });
      await saveWcCornersParameters(SEASON, updates, { recalc: true });
      await loadModel();
      setParamMessage('Parameters saved and model recalculated');
    } catch (err) {
      setParamMessage(err.message);
    } finally {
      setParamSaving(false);
    }
  };

  const trackerSummary = useMemo(
    () => computeTrackerSummary(tracker.bets || []),
    [tracker.bets]
  );

  const slatePlays = useMemo(
    () => buildSlate(fixtures, dashboard, parameters),
    [fixtures, dashboard, parameters]
  );

  const slateClusters = useMemo(
    () => groupPlaysByFixture(slatePlays),
    [slatePlays]
  );

  const decorrelatedPlays = useMemo(
    () => pickDecorrelatedPlays(slatePlays),
    [slatePlays]
  );

  const pendingAccuracy = useMemo(
    () => (accuracy.log || []).filter((r) => r.actTotal == null && r.projTotal != null),
    [accuracy.log]
  );

  const auditResult = useMemo(
    () => runWcModelAudit({ dashboard, teams, eloRatings }),
    [dashboard, teams, eloRatings]
  );

  if (loading) {
    return (
      <div className="wc-section">
        <p className="wc-readme">Loading corner model from DynamoDB…</p>
      </div>
    );
  }

  if (error && !modelData?.dashboard?.length) {
    return (
      <div className="wc-section">
        <p className="wc-negative">{error}</p>
        <button type="button" className="wc-refresh-btn" onClick={loadModel}>Retry</button>
      </div>
    );
  }

  return (
    <div className="wc-section">
      <div className="wc-header">
        <div>
          <h1 className="wc-title">{meta.title || 'WC 2026 — Corner Kick Model'}</h1>
          <p className="wc-subtitle">
            DynamoDB + Odds API
            {lastOddsSync && (
              <> · Odds synced {new Date(lastOddsSync).toLocaleString()}</>
            )}
          </p>
        </div>
        <div className="wc-header-actions">
          <button
            type="button"
            className="wc-refresh-btn"
            onClick={handleRecalcModel}
            disabled={recalcLoading}
          >
            {recalcLoading ? 'Recalc…' : '↻ Recalc Model'}
          </button>
          <button
            type="button"
            className="wc-refresh-btn"
            onClick={handleRefreshOdds}
            disabled={oddsRefreshing}
          >
            {oddsRefreshing ? 'Fetching…' : '⟳ Fetch Odds'}
          </button>
          <div className="wc-tabs">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`wc-tab ${tab === t.id ? 'active' : ''}`}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {oddsMessage && (
        <div className={`wc-banner ${oddsMessage.includes('failed') ? 'wc-banner-error' : 'wc-banner-ok'}`}>
          {oddsMessage}
          <button type="button" className="wc-close-btn" onClick={() => setOddsMessage(null)}>✕</button>
        </div>
      )}

      {biasBanner && (tab === 'dashboard' || tab === 'accuracy') && (
        <div className={`wc-banner wc-banner-bias wc-banner-bias-${biasBanner.level}`}>
          <strong>Over-projection read</strong>
          <span>{biasBanner.message}</span>
        </div>
      )}

      {betMessage && tab === 'tracker' && (
        <div className={`wc-banner ${betMessage.includes('fail') ? 'wc-banner-error' : 'wc-banner-ok'}`}>
          {betMessage}
          <button type="button" className="wc-close-btn" onClick={() => setBetMessage(null)}>✕</button>
        </div>
      )}

      {gameMessage && tab === 'dashboard' && (
        <div className={`wc-banner ${gameMessage.includes('fail') || gameMessage.includes('already') ? 'wc-banner-error' : 'wc-banner-ok'}`}>
          {gameMessage}
          <button type="button" className="wc-close-btn" onClick={() => setGameMessage(null)}>✕</button>
        </div>
      )}

      {paramMessage && tab === 'parameters' && (
        <div className={`wc-banner ${paramMessage.includes('fail') || paramMessage.includes('Could') ? 'wc-banner-error' : 'wc-banner-ok'}`}>
          {paramMessage}
          <button type="button" className="wc-close-btn" onClick={() => setParamMessage(null)}>✕</button>
        </div>
      )}

      {accuracyMessage && tab === 'accuracy' && (
        <div className={`wc-banner ${accuracyMessage.includes('fail') || accuracyMessage.includes('Could') ? 'wc-banner-error' : 'wc-banner-ok'}`}>
          {accuracyMessage}
          <button type="button" className="wc-close-btn" onClick={() => setAccuracyMessage(null)}>✕</button>
        </div>
      )}

      {slateCopyMsg && tab === 'slate' && (
        <div className="wc-banner wc-banner-ok">
          {slateCopyMsg}
          <button type="button" className="wc-close-btn" onClick={() => setSlateCopyMsg(null)}>✕</button>
        </div>
      )}

      {tab === 'dashboard' && (
        <div className="wc-panel">
          <form className="wc-bet-form wc-game-form" onSubmit={handleGameSubmit}>
            <h3>Add match result (mirrors both teams)</h3>
            <div className="wc-bet-form-grid">
              <label>
                Team A
                <select value={gameForm.teamA} onChange={(e) => setGameForm({ ...gameForm, teamA: e.target.value })} required>
                  {teamNames.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </label>
              <label>
                Team B
                <select value={gameForm.teamB} onChange={(e) => setGameForm({ ...gameForm, teamB: e.target.value })} required>
                  {teamNames.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </label>
              <label>
                Date
                <input value={gameForm.date} onChange={(e) => setGameForm({ ...gameForm, date: e.target.value })} placeholder="7/3 or 2026-07-03" required />
              </label>
              <label>
                CF (A)
                <input type="number" min="0" value={gameForm.cornersA} onChange={(e) => setGameForm({ ...gameForm, cornersA: e.target.value })} required />
              </label>
              <label>
                CF (B)
                <input type="number" min="0" value={gameForm.cornersB} onChange={(e) => setGameForm({ ...gameForm, cornersB: e.target.value })} required />
              </label>
              <label>
                Comp
                <select value={gameForm.comp} onChange={(e) => setGameForm({ ...gameForm, comp: e.target.value })}>
                  <option value="WC">WC</option>
                  <option value="F">F (friendly)</option>
                </select>
              </label>
              <label>
                Venue (A)
                <select value={gameForm.venue} onChange={(e) => setGameForm({ ...gameForm, venue: e.target.value })}>
                  <option value="N">Neutral</option>
                  <option value="H">Home</option>
                  <option value="A">Away</option>
                </select>
              </label>
            </div>
            <div className="wc-form-checks">
              <label className="wc-check-label">
                <input type="checkbox" checked={gameForm.included} onChange={(e) => setGameForm({ ...gameForm, included: e.target.checked })} />
                Include in model (Inc=1)
              </label>
              <label className="wc-check-label">
                <input type="checkbox" checked={gameForm.lockAccuracy} onChange={(e) => setGameForm({ ...gameForm, lockAccuracy: e.target.checked })} />
                Lock accuracy projection before save
              </label>
            </div>
            <button type="submit" className="wc-refresh-btn" disabled={gameSaving}>
              {gameSaving ? 'Saving…' : '+ Add game & recalc'}
            </button>
          </form>

          <div className="wc-audit-panel">
            <button
              type="button"
              className="wc-audit-toggle"
              onClick={() => setAuditOpen((v) => !v)}
            >
              {auditOpen ? '▼' : '▶'} Data audit
              {' '}
              <span className={auditResult.clean ? 'wc-positive' : auditResult.counts.errors ? 'wc-negative' : 'wc-warning'}>
                {auditResult.clean
                  ? 'clean'
                  : `${auditResult.counts.errors} err · ${auditResult.counts.warnings} warn`}
              </span>
            </button>
            {auditOpen && (
              <div className="wc-audit-body">
                {auditResult.clean ? (
                  <p className="wc-readme wc-positive">No mirror, duplicate, or Elo coverage issues found.</p>
                ) : (
                  <ul className="wc-audit-list">
                    {auditResult.issues.map((issue) => (
                      <li
                        key={`${issue.type}-${issue.team}-${issue.opponent}-${issue.date}-${issue.message}`}
                        className={issue.severity === 'error' ? 'wc-audit-error' : 'wc-audit-warn'}
                      >
                        {issue.message}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          <ul className="wc-readme">
            {readme.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <SpreadsheetTable
            columns={[
              {
                key: 'team',
                label: 'Team',
                sticky: true,
                render: (r) => <span className="wc-team-name">{r.team}</span>,
              },
              { key: 'elo', label: 'Elo', render: (r) => fmtNum(r.elo, 0) },
              { key: 'games', label: 'Games', render: (r) => r.games },
              { key: 'rawFor', label: 'Raw For', render: (r) => fmtNum(r.rawFor) },
              { key: 'rawAg', label: 'Raw Ag', render: (r) => fmtNum(r.rawAg) },
              {
                key: 'adjAttack',
                label: 'Adj Attack',
                render: (r) => <span className="wc-pill">{fmtNum(r.adjAttack)}</span>,
              },
              {
                key: 'adjDefense',
                label: 'Adj Defense',
                render: (r) => <span className="wc-pill">{fmtNum(r.adjDefense)}</span>,
              },
              {
                key: 'dispersion',
                label: 'Dispersion',
                hideMobile: true,
                render: (r) =>
                  r.dispersion ? (
                    <span className="wc-badge wc-badge-warn">{r.dispersion}</span>
                  ) : (
                    <span className="wc-badge wc-badge-muted">—</span>
                  ),
              },
              { key: 'source', label: 'Source', hideMobile: true, render: (r) => r.source || '—' },
            ]}
            rows={dashboard.map((row) => ({ ...row, _key: row.team }))}
            onRowClick={(row) => setSelectedTeam(row.team)}
            selectedKey={selectedTeam}
          />

          {selectedTeam && teams[selectedTeam] && (
            <div className="wc-team-detail">
              <div className="wc-team-detail-header">
                <h3>{selectedTeam} — Corner Log</h3>
                <button type="button" className="wc-close-btn" onClick={() => setSelectedTeam(null)}>
                  Close
                </button>
              </div>
              <SpreadsheetTable
                columns={[
                  { key: 'num', label: '#', sticky: true },
                  { key: 'date', label: 'Date', render: (r) => r.date || '—' },
                  { key: 'opponent', label: 'Opponent' },
                  { key: 'comp', label: 'Comp', hideMobile: true },
                  { key: 'cf', label: 'CF', render: (r) => (r.included ? r.cf : '—') },
                  { key: 'ca', label: 'CA', render: (r) => (r.included ? r.ca : '—') },
                  {
                    key: 'inc',
                    label: 'Inc',
                    render: (r) => (
                      <button
                        type="button"
                        className={`wc-inc-btn ${r.included ? 'wc-inc-on' : 'wc-inc-off'}`}
                        disabled={gameSaving}
                        onClick={() => handleToggleGameIncluded(selectedTeam, r)}
                      >
                        {r.included ? '1' : '0'}
                      </button>
                    ),
                  },
                ]}
                rows={(teams[selectedTeam].games || [])
                  .map((g) => ({ ...g, _key: `${g.num}-${g.opponent}-${g.date}` }))}
              />
            </div>
          )}
        </div>
      )}

      {tab === 'matchup' && (
        <div className="wc-panel">
          <div className="wc-matchup-controls">
            <div className="wc-field">
              <label htmlFor="wc-team-a">Team A</label>
              <select id="wc-team-a" value={teamA} onChange={(e) => setTeamA(e.target.value)}>
                {teamNames.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
            <div className="wc-field">
              <label htmlFor="wc-team-b">Team B</label>
              <select id="wc-team-b" value={teamB} onChange={(e) => setTeamB(e.target.value)}>
                {teamNames.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
            <div className="wc-field">
              <label htmlFor="wc-manual-a">Manual mult A</label>
              <input
                id="wc-manual-a"
                type="number"
                step="0.05"
                min="0.5"
                max="1.5"
                value={manualA}
                onChange={(e) => setManualA(Number(e.target.value) || 1)}
              />
            </div>
            <div className="wc-field">
              <label htmlFor="wc-manual-b">Manual mult B</label>
              <input
                id="wc-manual-b"
                type="number"
                step="0.05"
                min="0.5"
                max="1.5"
                value={manualB}
                onChange={(e) => setManualB(Number(e.target.value) || 1)}
              />
            </div>
          </div>

          {activeFixture && (
            <p className="wc-readme">
              Market data: {activeFixture.homeTeam} vs {activeFixture.awayTeam}
              {' · '}
              {new Date(activeFixture.commenceTime).toLocaleString()}
            </p>
          )}

          {matchup && (
            <>
              <div className="wc-projection-grid">
                <div className="wc-projection-card">
                  <h4>λ {matchup.teamA}</h4>
                  <div className="wc-lambda">{fmtNum(matchup.lambdaA)}</div>
                </div>
                <div className="wc-projection-card">
                  <h4>λ {matchup.teamB}</h4>
                  <div className="wc-lambda">{fmtNum(matchup.lambdaB)}</div>
                </div>
                <div className="wc-projection-card">
                  <h4>λ Match Total</h4>
                  <div className="wc-lambda">{fmtNum(matchup.lambdaTotal)}</div>
                </div>
              </div>

              <div className="wc-stats-row">
                <div className="wc-stat-card">
                  <div className="wc-stat-label">ρ (correlation)</div>
                  <div className="wc-stat-value">{fmtNum(matchup.rho, 3)}</div>
                </div>
                <div className="wc-stat-card">
                  <div className="wc-stat-label">var Total / Diff</div>
                  <div className="wc-stat-value">{fmtNum(matchup.varTotal)} / {fmtNum(matchup.varDiff)}</div>
                </div>
                <div className="wc-stat-card">
                  <div className="wc-stat-label">μ₁ / μ₂ (Skellam)</div>
                  <div className="wc-stat-value">{fmtNum(matchup.mu1Eff)} / {fmtNum(matchup.mu2Eff)}</div>
                </div>
                <div className="wc-stat-card">
                  <div className="wc-stat-label">Total dist</div>
                  <div className="wc-stat-value">{matchup.totalDist === 'poisson' ? 'Poisson' : `NB φ=${fmtNum(matchup.totalPhi, 2)}`}</div>
                </div>
              </div>

              <OverUnderBlock
                title={`${matchup.teamA} corners (NB, φ=${fmtNum(matchup.phiA, 2)})`}
                lines={matchup.teamAOverUnder}
                marketLines={activeFixture ? getMarketLines(activeFixture, 'alternate_team_totals_corners', matchup.teamA) : []}
              />
              <OverUnderBlock
                title={`${matchup.teamB} corners (NB, φ=${fmtNum(matchup.phiB, 2)})`}
                lines={matchup.teamBOverUnder}
                marketLines={activeFixture ? getMarketLines(activeFixture, 'alternate_team_totals_corners', matchup.teamB) : []}
              />
              <OverUnderBlock
                title={`Match total corners (${matchup.totalDist === 'poisson' ? 'Poisson' : 'NB'}, ρ-adjusted)`}
                lines={matchup.totalOverUnder}
                marketLines={activeFixture ? getMarketLines(activeFixture, 'alternate_totals_corners') : []}
              />
              <HandicapBlock
                title={`Corner handicap — ${matchup.teamA} (Skellam)`}
                handicapTable={matchup.handicapTable}
                marketLines={activeFixture ? getMarketLines(activeFixture, 'alternate_spreads_corners') : []}
                teamAName={matchup.teamA}
              />
              <MostCornersBlock mostCorners={matchup.mostCorners} teamA={matchup.teamA} teamB={matchup.teamB} />
            </>
          )}
        </div>
      )}

      {tab === 'markets' && (
        <div className="wc-panel">
          <p className="wc-readme">
            Live corner markets from The Odds API ({fixtures.length} fixtures in DynamoDB).
          </p>
          <SpreadsheetTable
            columns={[
              {
                key: 'match',
                label: 'Match',
                sticky: true,
                render: (r) => (
                  <span className="wc-team-name">{r.homeTeam} vs {r.awayTeam}</span>
                ),
              },
              {
                key: 'time',
                label: 'Kickoff',
                render: (r) => formatFixtureKickoff(r.commenceTime),
              },
              {
                key: 'totalLines',
                label: 'Total lines',
                render: (r) => getMarketLines(r, 'alternate_totals_corners').length,
              },
              {
                key: 'teamLines',
                label: 'Team lines',
                hideMobile: true,
                render: (r) => getMarketLines(r, 'alternate_team_totals_corners').length,
              },
            ]}
            rows={fixtures.map((f) => ({ ...f, _key: f.eventId }))}
            selectedKey={selectedFixtureId}
            onRowClick={(row) => {
              setSelectedFixtureId(row.eventId);
              setTeamA(row.homeTeam);
              setTeamB(row.awayTeam);
            }}
          />

          {!selectedFixtureId && (
            <p className="wc-readme wc-market-hint">Select a match above to view corner lines for that game.</p>
          )}

          {selectedFixtureId && marketsFixture && tab === 'markets' && (
            <div className="wc-market-detail">
              <div className="wc-market-detail-header">
                <div>
                  <h2 className="wc-market-detail-title">
                    {marketsFixture.homeTeam} vs {marketsFixture.awayTeam}
                  </h2>
                  <p className="wc-market-fixture-meta">
                    {formatFixtureKickoff(marketsFixture.commenceTime)}
                  </p>
                </div>
                <button
                  type="button"
                  className="wc-refresh-btn"
                  onClick={() => setTab('matchup')}
                >
                  Open Matchup
                </button>
              </div>
              <OverUnderMarketTable
                title={`Match total corners — ${marketsFixture.homeTeam} vs ${marketsFixture.awayTeam}`}
                lines={getMarketLines(marketsFixture, 'alternate_totals_corners')}
                modelLines={marketsMatchup?.totalOverUnder}
              />
              <OverUnderMarketTable
                title={`${marketsFixture.homeTeam} team total corners`}
                lines={getMarketLines(marketsFixture, 'alternate_team_totals_corners', marketsFixture.homeTeam)}
                modelLines={marketsMatchup?.teamAOverUnder}
              />
              <OverUnderMarketTable
                title={`${marketsFixture.awayTeam} team total corners`}
                lines={getMarketLines(marketsFixture, 'alternate_team_totals_corners', marketsFixture.awayTeam)}
                modelLines={marketsMatchup?.teamBOverUnder}
              />
              <SpreadMarketTable
                title={`Corner spreads — ${marketsFixture.homeTeam} vs ${marketsFixture.awayTeam}`}
                lines={getMarketLines(marketsFixture, 'alternate_spreads_corners')}
                handicapTable={marketsMatchup?.handicapTable}
                teamAName={marketsFixture.homeTeam}
                teamBName={marketsFixture.awayTeam}
              />
            </div>
          )}
        </div>
      )}

      {tab === 'slate' && (
        <div className="wc-panel">
          <div className="wc-slate-header">
            <p className="wc-readme">
              {slatePlays.length} plays with &gt;5% EV across {fixtures.length} fixtures.
              Ranked by EV; clusters show correlated same-match edges.
            </p>
            <div className="wc-slate-copy-btns">
              <button
                type="button"
                className="wc-refresh-btn"
                onClick={() => copySlateText(formatPlaysMessage(slatePlays), 'Plays')}
              >
                Copy plays
              </button>
              <button
                type="button"
                className="wc-refresh-btn"
                onClick={() => copySlateText(
                  formatAnalysisMessage(slatePlays, slateClusters, decorrelatedPlays, biasBanner),
                  'Analysis'
                )}
              >
                Copy analysis
              </button>
            </div>
          </div>

          <div className="wc-section-block">
            <h3>Full menu (&gt;5% EV, ranked)</h3>
            <SpreadsheetTable
              columns={[
                { key: 'match', label: 'Match', sticky: true, render: (r) => <span className="wc-team-name">{r.match}</span> },
                { key: 'selection', label: 'Selection' },
                { key: 'modelPct', label: 'Model %', render: (r) => fmtPct(r.modelPct) },
                { key: 'odds', label: 'Odds', render: (r) => fmtOdds(r.odds) },
                { key: 'evPct', label: 'EV %', render: (r) => <span className="wc-positive">{fmtPct(r.evPct)}</span> },
                { key: 'tier', label: 'Tier', render: (r) => (r.tier ? `${r.tier}u` : '—') },
                { key: 'book', label: 'Book', hideMobile: true, render: (r) => r.book || '—' },
              ]}
              rows={slatePlays.map((p, i) => ({ ...p, _key: `${p.fixtureId}-${p.selection}-${i}`, _rowClass: 'wc-edge-strong' }))}
            />
          </div>

          {slateClusters.length > 0 && (
            <div className="wc-section-block">
              <h3>Correlation clusters</h3>
              {slateClusters.map((cluster) => (
                <div key={cluster.fixtureId} className="wc-cluster-card">
                  <h4>{cluster.match}</h4>
                  <p className="wc-readme">
                    {cluster.plays.map((p) => `${p.selection} (${fmtPct(p.evPct)} EV)`).join(' · ')}
                  </p>
                </div>
              ))}
            </div>
          )}

          {decorrelatedPlays.length > 0 && (
            <div className="wc-section-block">
              <h3>De-correlated angle (one per fixture)</h3>
              <SpreadsheetTable
                columns={[
                  { key: 'match', label: 'Match', sticky: true },
                  { key: 'selection', label: 'Play' },
                  { key: 'thesis', label: 'Thesis', hideMobile: true },
                  { key: 'evPct', label: 'EV %', render: (r) => fmtPct(r.evPct) },
                  { key: 'tier', label: 'Tier', render: (r) => (r.tier ? `${r.tier}u` : '—') },
                ]}
                rows={decorrelatedPlays.map((p, i) => ({ ...p, _key: `dec-${i}` }))}
              />
            </div>
          )}
        </div>
      )}

      {tab === 'tracker' && (
        <div className="wc-panel">
          <div className="wc-stats-row">
            <div className="wc-stat-card">
              <div className="wc-stat-label">Record</div>
              <div className="wc-stat-value">{trackerSummary.record || '—'}</div>
            </div>
            <div className="wc-stat-card">
              <div className="wc-stat-label">Units P/L</div>
              <div className={`wc-stat-value ${trackerSummary.unitsPL >= 0 ? 'wc-positive' : 'wc-negative'}`}>
                {fmtSigned(trackerSummary.unitsPL)}
              </div>
            </div>
            <div className="wc-stat-card">
              <div className="wc-stat-label">ROI</div>
              <div className={`wc-stat-value ${trackerSummary.roi >= 0 ? 'wc-positive' : 'wc-negative'}`}>
                {fmtPct(trackerSummary.roi)}
              </div>
            </div>
            <div className="wc-stat-card">
              <div className="wc-stat-label">Shadow tier P/L</div>
              <div className={`wc-stat-value ${trackerSummary.tieredUnitsPL >= 0 ? 'wc-positive' : 'wc-negative'}`}>
                {fmtSigned(trackerSummary.tieredUnitsPL)}
              </div>
            </div>
            <div className="wc-stat-card">
              <div className="wc-stat-label">Avg CLV</div>
              <div className="wc-stat-value">{trackerSummary.avgClv != null ? fmtPct(trackerSummary.avgClv) : '—'}</div>
            </div>
          </div>

          <form className="wc-bet-form" onSubmit={handleBetSubmit}>
            <h3>Log bet</h3>
            <div className="wc-bet-form-grid">
              <label>
                Date
                <input value={betForm.date} onChange={(e) => setBetForm({ ...betForm, date: e.target.value })} placeholder="7/3" required />
              </label>
              <label>
                Match
                <input value={betForm.match} onChange={(e) => setBetForm({ ...betForm, match: e.target.value })} placeholder="Spain/Panama" required />
              </label>
              <label>
                Selection
                <input value={betForm.selection} onChange={(e) => setBetForm({ ...betForm, selection: e.target.value })} placeholder="Panama u2.5" required />
              </label>
              <label>
                Model %
                <input type="number" step="0.01" min="0" max="1" value={betForm.modelPct} onChange={(e) => setBetForm({ ...betForm, modelPct: e.target.value })} placeholder="0.63" required />
              </label>
              <label>
                Odds taken
                <input type="number" value={betForm.oddsTaken} onChange={(e) => setBetForm({ ...betForm, oddsTaken: e.target.value })} placeholder="-110" required />
              </label>
              <label>
                Close (opt)
                <input type="number" value={betForm.close} onChange={(e) => setBetForm({ ...betForm, close: e.target.value })} placeholder="-120" />
              </label>
              <label>
                Stake (u)
                <input type="number" step="0.5" min="0.5" value={betForm.stake} onChange={(e) => setBetForm({ ...betForm, stake: e.target.value })} />
              </label>
            </div>
            <button type="submit" className="wc-refresh-btn" disabled={betSaving}>
              {betSaving ? 'Saving…' : '+ Add bet'}
            </button>
          </form>

          <SpreadsheetTable
            columns={[
              { key: 'date', label: 'Date', sticky: true },
              { key: 'match', label: 'Match', render: (r) => <span className="wc-team-name">{r.match}</span> },
              { key: 'selection', label: 'Selection', hideMobile: true },
              { key: 'modelPct', label: 'Model %', render: (r) => fmtPct(r.modelPct) },
              { key: 'oddsTaken', label: 'Odds', render: (r) => fmtOdds(r.oddsTaken) },
              { key: 'close', label: 'Close', hideMobile: true, render: (r) => (r.close != null ? fmtOdds(r.close) : '—') },
              { key: 'evPct', label: 'EV %', render: (r) => fmtPct(r.evPct) },
              { key: 'tierUnits', label: 'Tier', render: (r) => (r.tierUnits ? `${r.tierUnits}u` : '—') },
              { key: 'result', label: 'Result', render: (r) => <span className={resultClass(r.result)}>{r.result}</span> },
              { key: 'profit', label: 'P/L', render: (r) => <span className={resultClass(r.result)}>{fmtSigned(r.profit)}</span> },
              { key: 'clvPct', label: 'CLV', hideMobile: true, render: (r) => (r.clvPct != null ? fmtPct(r.clvPct) : '—') },
              {
                key: 'grade',
                label: '',
                render: (r) => (
                  r.result === 'Pending' ? (
                    <span className="wc-grade-btns">
                      <button type="button" className="wc-grade-btn" disabled={betSaving} onClick={() => handleGradeBet(r, 'W')}>W</button>
                      <button type="button" className="wc-grade-btn" disabled={betSaving} onClick={() => handleGradeBet(r, 'L')}>L</button>
                    </span>
                  ) : '—'
                ),
              },
            ]}
            rows={(tracker.bets || []).map((bet, i) => {
              const row = enrichBet(bet);
              return {
                ...row,
                _betId: bet._betId,
                _key: bet._betId || `${bet.date}-${bet.match}-${i}`,
                _rowClass: (row.evPct ?? 0) > 0.05 ? 'wc-edge-strong' : '',
              };
            })}
          />
        </div>
      )}

      {tab === 'accuracy' && (
        <div className="wc-panel">
          <form className="wc-bet-form" onSubmit={handleAccuracySubmit}>
            <h3>Log accuracy (lock projection first)</h3>
            <p className="wc-readme wc-form-hint">
              Lock pre-game λ before adding the match to team logs. Leave actuals blank for pending; fill to grade in one step.
            </p>
            <div className="wc-bet-form-grid">
              <label>
                Team A
                <select value={accuracyForm.teamA} onChange={(e) => setAccuracyForm({ ...accuracyForm, teamA: e.target.value })} required>
                  {teamNames.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </label>
              <label>
                Team B
                <select value={accuracyForm.teamB} onChange={(e) => setAccuracyForm({ ...accuracyForm, teamB: e.target.value })} required>
                  {teamNames.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </label>
              <label>
                Date
                <input value={accuracyForm.date} onChange={(e) => setAccuracyForm({ ...accuracyForm, date: e.target.value })} placeholder="7/3" required />
              </label>
              <label>
                Act A (opt)
                <input type="number" min="0" value={accuracyForm.actA} onChange={(e) => setAccuracyForm({ ...accuracyForm, actA: e.target.value })} />
              </label>
              <label>
                Act B (opt)
                <input type="number" min="0" value={accuracyForm.actB} onChange={(e) => setAccuracyForm({ ...accuracyForm, actB: e.target.value })} />
              </label>
            </div>
            <button type="submit" className="wc-refresh-btn" disabled={accuracySaving}>
              {accuracySaving ? 'Saving…' : '+ Lock / grade'}
            </button>
          </form>

          {pendingAccuracy.length > 0 && (
            <div className="wc-section-block">
              <h3>Pending grade ({pendingAccuracy.length})</h3>
              {pendingAccuracy.map((row) => (
                <PendingAccuracyGrade
                  key={row._entryId || `${row.date}-${row.teamA}`}
                  row={row}
                  saving={accuracySaving}
                  onGrade={handleGradeAccuracy}
                />
              ))}
            </div>
          )}

          <div className="wc-stats-row">
            <div className="wc-stat-card">
              <div className="wc-stat-label">Graded games</div>
              <div className="wc-stat-value">{accuracyStats.count || 0}</div>
            </div>
            <div className="wc-stat-card">
              <div className="wc-stat-label">MAE</div>
              <div className="wc-stat-value">{fmtNum(accuracyStats.mae ?? accuracy.summary?.mae)}</div>
            </div>
            <div className="wc-stat-card">
              <div className="wc-stat-label">RMSE</div>
              <div className="wc-stat-value">{fmtNum(accuracyStats.rmse ?? accuracy.summary?.rmse)}</div>
            </div>
            <div className="wc-stat-card">
              <div className="wc-stat-label">Mean Bias</div>
              <div className="wc-stat-value">{fmtSigned(accuracyStats.meanBias ?? accuracy.summary?.meanBias)}</div>
            </div>
            <div className="wc-stat-card">
              <div className="wc-stat-label">Under rate</div>
              <div className="wc-stat-value">{accuracyStats.underRate != null ? fmtPct(accuracyStats.underRate) : '—'}</div>
            </div>
          </div>
          <SpreadsheetTable
            columns={[
              { key: 'date', label: 'Date', sticky: true },
              { key: 'matchup', label: 'Matchup', render: (r) => <span className="wc-team-name">{r.teamA} vs {r.teamB}</span> },
              { key: 'projTotal', label: 'Proj', render: (r) => fmtNum(r.projTotal) },
              { key: 'actTotal', label: 'Actual', render: (r) => (r.actTotal != null ? fmtNum(r.actTotal) : '—') },
              { key: 'error', label: 'Err', render: (r) => (r.error != null ? fmtSigned(r.error) : '—') },
              {
                key: 'locked',
                label: 'Lock',
                hideMobile: true,
                render: (r) => (r.projectionLocked ? '✓' : '—'),
              },
            ]}
            rows={(accuracy.log || []).map((row, i) => ({ ...row, _key: row._entryId || `${row.date}-${i}` }))}
          />
        </div>
      )}

      {tab === 'parameters' && (
        <div className="wc-panel">
          <form className="wc-bet-form" onSubmit={handleSaveParameters}>
            <h3>Model parameters</h3>
            <p className="wc-readme wc-form-hint">
              Winsor mean/SD/cap are auto-computed on recalc. Other knobs save to DynamoDB and trigger a full recalc.
            </p>
            <SpreadsheetTable
              columns={[
                { key: 'name', label: 'Parameter', sticky: true, render: (r) => <span className="wc-team-name">{r.name}</span> },
                {
                  key: 'value',
                  label: 'Value',
                  render: (r) => (
                    r.readOnly ? (
                      <span className="wc-pill">{fmtNum(r.value, r.value > 10 ? 2 : 3)}</span>
                    ) : (
                      <input
                        className="wc-param-input"
                        type="number"
                        step="any"
                        value={paramEdits[r.name] ?? ''}
                        onChange={(e) => setParamEdits({ ...paramEdits, [r.name]: e.target.value })}
                      />
                    )
                  ),
                },
                { key: 'meaning', label: 'Meaning', className: 'wc-param-meaning', render: (r) => r.meaning || '—' },
              ]}
              rows={Object.entries(parameters).map(([name, p]) => ({
                name,
                value: p.value,
                meaning: p.meaning,
                readOnly: AUTO_PARAMETER_KEYS.has(name),
                _key: name,
              }))}
            />
            <button type="submit" className="wc-refresh-btn" disabled={paramSaving}>
              {paramSaving ? 'Saving…' : 'Save & recalc model'}
            </button>
          </form>
        </div>
      )}

      <p className="wc-footer-note">Model in DynamoDB · corner odds via The Odds API. Not financial advice.</p>
    </div>
  );
};

export default FifaWorldCupSection;
