#!/bin/bash
# WC 2026 corner model data refresh (GitHub Actions + local).
#
# Usage:
#   bash scripts/updateWc2026.sh           # corners + odds (scheduled default)
#   bash scripts/updateWc2026.sh elo       # Elo only (daily)
#   bash scripts/updateWc2026.sh corners   # API-Football corner stats
#   bash scripts/updateWc2026.sh odds      # The Odds API corner lines
#   bash scripts/updateWc2026.sh all       # elo + corners + odds
#
# Env (local .env or GitHub secrets):
#   AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION
#   API_FOOTBALL_KEY or APISPORTS_KEY — corner stats
#   ODDS_API_KEY or REACT_APP_ODDS_API_KEY — corner odds

set -euo pipefail
export TZ=America/Los_Angeles
export PATH="/usr/local/bin:/usr/bin:/bin:$PATH"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v node >/dev/null 2>&1; then
  echo "$(date): node not found in PATH" >&2
  exit 1
fi

MODE="${1:-data}"

echo "═══════════════════════════════════════════════════════════════"
echo "⚽ WC 2026 data refresh — $(date '+%Y-%m-%d %H:%M %Z') — mode: $MODE"
echo "═══════════════════════════════════════════════════════════════"

run_elo() {
  echo ""
  echo "▶ Elo ratings (eloratings.net)..."
  node scripts/updateWc2026Elo.js
}

run_corners() {
  echo ""
  echo "▶ WC corner stats (API-Football)..."
  node scripts/updateWc2026CornerStats.js
}

run_odds() {
  echo ""
  echo "▶ Corner odds (The Odds API)..."
  node scripts/updateWc2026Odds.js
}

case "$MODE" in
  elo) run_elo ;;
  corners) run_corners ;;
  odds) run_odds ;;
  data)
    run_corners
    run_odds
    ;;
  all)
    run_elo
    run_corners
    run_odds
    ;;
  *)
    echo "Unknown mode: $MODE (use elo, corners, odds, data, or all)" >&2
    exit 1
    ;;
esac

echo ""
echo "✅ WC 2026 update finished"
