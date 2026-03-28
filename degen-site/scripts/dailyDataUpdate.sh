#!/bin/bash

# Daily Data Update Script
# Runs NBA and NHL standings/odds updates
# Scheduled to run daily at 6 AM via cron

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_FILE="$PROJECT_DIR/logs/daily-update.log"

# Create logs directory if it doesn't exist
mkdir -p "$PROJECT_DIR/logs"

# Log function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "=========================================="
log "Starting daily data update..."
log "=========================================="

cd "$PROJECT_DIR"

# Run NBA update
log "Running NBA 2025 data update..."
node scripts/updateNba2025Data.js >> "$LOG_FILE" 2>&1
if [ $? -eq 0 ]; then
    log "✅ NBA update completed successfully"
else
    log "❌ NBA update failed"
fi

# Run NHL update
log "Running NHL 2025 data update..."
node scripts/updateNhl2025Data.js >> "$LOG_FILE" 2>&1
if [ $? -eq 0 ]; then
    log "✅ NHL update completed successfully"
else
    log "❌ NHL update failed"
fi

log "=========================================="
log "Daily data update completed!"
log "=========================================="
