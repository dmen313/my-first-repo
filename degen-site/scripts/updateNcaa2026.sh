#!/bin/bash

# Update all sports data: NCAA brackets + survivor, NBA standings, NHL standings
# Usage:
#   ./scripts/updateNcaa2026.sh            # Update today
#   ./scripts/updateNcaa2026.sh 2026-03-20  # Update a specific date

set -e
cd "$(dirname "$0")/.."

DATE=${1:-$(date +%Y-%m-%d)}

echo "═══════════════════════════════════════════════════════════════"
echo "📊 Full Sports Data Update — $DATE"
echo "═══════════════════════════════════════════════════════════════"

echo ""
echo "▶ [1/5] Updating bracket results + recalculating points (ncaa-tourney + ncaa-tourney-4)..."
node scripts/updateNcaaTourneyResults.js 2026

echo ""
echo "▶ [2/5] Fetching survivor schedule from ESPN (today + any past unresolved)..."
node scripts/fetchNcaaSurvivorSchedule.js "$DATE"

echo ""
echo "▶ [3/5] Updating survivor pick results (auto-catches up unresolved past days)..."
node scripts/updateSurvivorResults.js "$DATE"

echo ""
echo "▶ [4/5] Updating NBA 2025 standings + odds..."
node scripts/updateNba2025Data.js

echo ""
echo "▶ [5/5] Updating NHL 2025 standings + odds..."
node scripts/updateNhl2025Data.js

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "✅ All sports data updates complete!"
echo "═══════════════════════════════════════════════════════════════"
