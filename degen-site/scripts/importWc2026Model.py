#!/usr/bin/env python3
"""Export WC2026 Corner Model xlsx to src/data/wc2026CornerModel.json (stdlib only)."""

import json
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_XLSX = Path.home() / 'Downloads' / 'WC2026 Corner Model 6-28.xlsx'
OUT = ROOT / 'src' / 'data' / 'wc2026CornerModel.json'


def col_letter_to_num(col):
    n = 0
    for c in col:
        n = n * 26 + (ord(c.upper()) - 64)
    return n


def parse_ref(ref):
    m = re.match(r'([A-Z]+)(\d+)', ref)
    return col_letter_to_num(m.group(1)), int(m.group(2))


def load_workbook(path):
    with zipfile.ZipFile(path) as z:
        ss = []
        if 'xl/sharedStrings.xml' in z.namelist():
            root = ET.fromstring(z.read('xl/sharedStrings.xml'))
            ns = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
            for si in root.findall('.//m:si', ns):
                texts = [t.text or '' for t in si.findall('.//m:t', ns)]
                ss.append(''.join(texts))
        wb = ET.fromstring(z.read('xl/workbook.xml'))
        ns = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
        rels = ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
        rid_to_target = {rel.attrib['Id']: rel.attrib['Target'] for rel in rels}
        sheets = {}
        for sh in wb.findall('.//m:sheet', ns):
            name = sh.attrib['name']
            rid = sh.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id']
            target = 'xl/' + rid_to_target[rid].lstrip('/')
            root = ET.fromstring(z.read(target))
            grid = {}
            for row in root.findall('.//m:sheetData/m:row', ns):
                for c in row.findall('m:c', ns):
                    ref = c.attrib.get('r', '')
                    t = c.attrib.get('t')
                    v_el = c.find('m:v', ns)
                    if v_el is None:
                        val = None
                    elif t == 's':
                        val = ss[int(v_el.text)]
                    elif t == 'b':
                        val = v_el.text == '1'
                    else:
                        try:
                            val = float(v_el.text) if '.' in v_el.text else int(v_el.text)
                        except ValueError:
                            val = v_el.text
                    col, rownum = parse_ref(ref)
                    grid[(rownum, col)] = val
            sheets[name] = grid
    return sheets


def cell(grid, row, col, default=None):
    return grid.get((row, col), default)


def to_num(v, default=None):
    if v is None or v == '':
        return default
    if isinstance(v, (int, float)):
        return v
    try:
        return float(v)
    except (TypeError, ValueError):
        return default


def excel_date(n):
    if not n:
        return None
    try:
        n = int(float(n))
        return (datetime(1899, 12, 30) + timedelta(days=n)).strftime('%Y-%m-%d')
    except (TypeError, ValueError):
        return str(n)


def export(xlsx_path):
    sheets = load_workbook(xlsx_path)

    params = {}
    pg = sheets['Parameters']
    for r in range(5, 22):
        key = cell(pg, r, 1)
        val = cell(pg, r, 2)
        meaning = cell(pg, r, 3)
        if key:
            params[str(key)] = {'value': to_num(val, val), 'meaning': meaning}

    elo = []
    eg = sheets['Elo']
    for r in range(7, 300):
        team = cell(eg, r, 1)
        if not team or team == 'Team / Opponent':
            continue
        e = to_num(cell(eg, r, 2))
        if e is None:
            break
        elo.append({'team': str(team), 'elo': e, 'type': cell(eg, r, 3)})

    dashboard = []
    dg = sheets['Dashboard']
    for r in range(5, 60):
        team = cell(dg, r, 1)
        if not team:
            continue
        dashboard.append({
            'team': str(team),
            'elo': to_num(cell(dg, r, 2)),
            'games': to_num(cell(dg, r, 3)),
            'rawFor': to_num(cell(dg, r, 4)),
            'rawAg': to_num(cell(dg, r, 5)),
            'adjAttack': to_num(cell(dg, r, 6)),
            'adjDefense': to_num(cell(dg, r, 7)),
            'dispersion': cell(dg, r, 8),
            'source': cell(dg, r, 9),
            'phi': to_num(cell(dg, r, 10)),
        })

    tg = sheets['Tracker']
    tracker_summary = {
        'totalPlays': to_num(cell(tg, 4, 2)),
        'settled': to_num(cell(tg, 5, 2)),
        'record': cell(tg, 6, 2),
        'winRate': to_num(cell(tg, 7, 2)),
        'unitsStaked': to_num(cell(tg, 8, 2)),
        'unitsPL': to_num(cell(tg, 9, 2)),
        'roi': to_num(cell(tg, 10, 2)),
        'avgClv': to_num(cell(tg, 11, 2)),
        'pctBeatClose': to_num(cell(tg, 12, 2)),
        'actualRisked': to_num(cell(tg, 13, 2)),
        'actualPL': to_num(cell(tg, 14, 2)),
        'actualROI': to_num(cell(tg, 15, 2)),
    }
    bets = []
    for r in range(18, 400):
        date = cell(tg, r, 1)
        match = cell(tg, r, 2)
        if not match:
            continue
        bets.append({
            'date': str(date) if date else '',
            'match': str(match),
            'selection': cell(tg, r, 3),
            'modelPct': to_num(cell(tg, r, 4)),
            'oddsTaken': cell(tg, r, 5),
            'close': cell(tg, r, 6),
            'stake': to_num(cell(tg, r, 7)),
            'result': cell(tg, r, 8),
            'fairOdds': to_num(cell(tg, r, 9)),
            'evPct': to_num(cell(tg, r, 11)),
            'implPct': to_num(cell(tg, r, 10)),
            'profit': to_num(cell(tg, r, 12)),
            'clvPct': to_num(cell(tg, r, 13)),
            'beatClose': cell(tg, r, 14),
            'actRisk': to_num(cell(tg, r, 21)),
            'actPL': to_num(cell(tg, r, 22)),
        })

    ag = sheets['Accuracy']
    accuracy_summary = {
        'matchesLogged': to_num(cell(ag, 5, 2)),
        'mae': to_num(cell(ag, 6, 2)),
        'rmse': to_num(cell(ag, 7, 2)),
        'meanBias': to_num(cell(ag, 8, 2)),
        'meanBiasPct': to_num(cell(ag, 9, 2)),
    }
    accuracy_log = []
    for r in range(15, 200):
        date = cell(ag, r, 1)
        ta = cell(ag, r, 2)
        if not ta:
            continue
        accuracy_log.append({
            'date': str(date) if date else '',
            'teamA': str(ta),
            'teamB': str(cell(ag, r, 3) or ''),
            'projA': to_num(cell(ag, r, 4)),
            'projB': to_num(cell(ag, r, 5)),
            'projTotal': to_num(cell(ag, r, 6)),
            'actA': to_num(cell(ag, r, 7)),
            'actB': to_num(cell(ag, r, 8)),
            'actTotal': to_num(cell(ag, r, 9)),
            'error': to_num(cell(ag, r, 10)),
            'absError': to_num(cell(ag, r, 11)),
            'eloGap': to_num(cell(ag, r, 13)),
        })

    team_names = [t['team'] for t in dashboard]
    teams = {}
    for name in team_names:
        if name not in sheets:
            continue
        g = sheets[name]
        games = []
        for r in range(7, 22):
            inc = to_num(cell(g, r, 8), 0)
            opp = cell(g, r, 3)
            if not opp and not cell(g, r, 6):
                continue
            games.append({
                'num': to_num(cell(g, r, 1)),
                'date': excel_date(cell(g, r, 2)),
                'opponent': opp,
                'comp': cell(g, r, 4),
                'venue': cell(g, r, 5),
                'cf': to_num(cell(g, r, 6)),
                'ca': to_num(cell(g, r, 7)),
                'included': inc == 1,
                'oppElo': to_num(cell(g, r, 9)),
                'wt': to_num(cell(g, r, 10)),
                'nAtt': to_num(cell(g, r, 13)),
                'nDef': to_num(cell(g, r, 14)),
            })
        teams[name] = {
            'games': games,
            'summary': {
                'gamesFor': to_num(cell(g, 24, 4)),
                'gamesAgainst': to_num(cell(g, 25, 4)),
                'rawMeanFor': to_num(cell(g, 26, 4)),
                'rawMeanAgainst': to_num(cell(g, 27, 4)),
                'varianceFor': to_num(cell(g, 28, 4)),
                'varMeanRatio': to_num(cell(g, 29, 4)),
                'dispersionFlag': cell(g, 30, 4),
                'priorAttack': to_num(cell(g, 31, 4)),
                'priorDefense': to_num(cell(g, 32, 4)),
                'adjAttack': to_num(cell(g, 33, 4)),
                'adjDefense': to_num(cell(g, 34, 4)),
                'source': cell(g, 35, 4),
            },
        }

    return {
        'meta': {
            'title': 'WC 2026 — Corner Kick Model',
            'exportedFrom': Path(xlsx_path).name,
            'exportedAt': datetime.now().isoformat(),
        },
        'readme': [
            'Parameters — global knobs (Elo sensitivity, recency decay, dominance, prior cutoff).',
            'Elo — central rating table from eloratings.net.',
            'One tab per team — last corners from fotmob.',
            'Dashboard — Adj Attack / Adj Defense at a glance.',
            'Matchup Engine — pick two teams; get λ, over/unders, handicap.',
            'λ_A = √(AdjAttack_A × AdjDefense_B) × Dominance × Manual.',
        ],
        'parameters': params,
        'elo': elo,
        'dashboard': dashboard,
        'tracker': {'summary': tracker_summary, 'bets': bets},
        'accuracy': {'summary': accuracy_summary, 'log': accuracy_log},
        'teams': teams,
    }


def main():
    xlsx = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_XLSX
    if not xlsx.exists():
        print(f'File not found: {xlsx}', file=sys.stderr)
        sys.exit(1)
    data = export(xlsx)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)
    print(f'Wrote {OUT} ({OUT.stat().st_size} bytes)')


if __name__ == '__main__':
    main()
