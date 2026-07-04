#!/bin/bash
# Local cron helper for WC 2026 corner model data refresh.
#
# Usage:
#   ./scripts/runWc2026CronLocal.sh           # Elo + odds
#   ./scripts/runWc2026CronLocal.sh elo       # Elo only (good for daily cron)
#   ./scripts/runWc2026CronLocal.sh odds      # Odds only
#   ./scripts/runWc2026CronLocal.sh corners   # API-Football WC corner stats only
#
# Example crontab (edit paths; ensure .env has AWS + ODDS_API_KEY):
#
#   # Elo once per day at 6:15 AM Pacific
#   15 6 * * * /full/path/to/degen-site/scripts/runWc2026CronLocal.sh elo >> /tmp/wc2026-elo.log 2>&1
#
#   # WC corner stats after matches (hourly during tournament hours)
#   5 8-23 * * * /full/path/to/degen-site/scripts/runWc2026CronLocal.sh corners >> /tmp/wc2026-corners.log 2>&1
#
#   # Corner odds every 30 min, 8 AM–11 PM Pacific (during WC)
#   */30 8-23 * * * /full/path/to/degen-site/scripts/runWc2026CronLocal.sh odds >> /tmp/wc2026-odds.log 2>&1

set -euo pipefail
export TZ=America/Los_Angeles
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v node >/dev/null 2>&1; then
  echo "$(date): node not found in PATH" >&2
  exit 1
fi

MODE="${1:-all}"

echo "═══════════════════════════════════════════════════════════════"
echo "⚽ WC 2026 data refresh — $(date '+%Y-%m-%d %H:%M %Z') — mode: $MODE"
echo "═══════════════════════════════════════════════════════════════"

run_elo() {
  echo ""
  echo "▶ Updating Elo ratings from eloratings.net..."
  node scripts/updateWc2026Elo.js
}

run_corners() {
  echo ""
  echo "▶ Importing WC corner stats from API-Football..."
  node scripts/updateWc2026CornerStats.js
}

run_odds() {
  echo ""
  echo "▶ Updating corner odds from The Odds API..."
  node scripts/updateWc2026Odds.js
}

case "$MODE" in
  elo)
    run_elo
    ;;
  corners)
    run_corners
    ;;
  odds)
    run_odds
    ;;
  all)
    run_elo
    run_corners
    run_odds
    ;;
  *)
    echo "Unknown mode: $MODE (use elo, corners, odds, or all)" >&2
    exit 1
    ;;
esac

echo ""
echo "✅ WC 2026 cron job finished"
