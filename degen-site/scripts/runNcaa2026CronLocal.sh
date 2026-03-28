#!/bin/bash
# Local cron helper: PATH + Pacific "today" for updateNcaa2026.sh (macOS/Linux).
# Example crontab (8:00 AM–11:30 PM Pacific, every 30 min):
#   */30 8-23 * * * /full/path/to/degen-site/scripts/runNcaa2026CronLocal.sh >> /tmp/ncaa2026-cron.log 2>&1
#
# Ensure your Mac timezone is Pacific, or keep TZ below.

set -euo pipefail
export TZ=America/Los_Angeles
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v node >/dev/null 2>&1; then
  echo "$(date): node not found in PATH; fix PATH or use nvm symlink" >&2
  exit 1
fi

exec bash scripts/updateNcaa2026.sh "$(date +%Y-%m-%d)"
