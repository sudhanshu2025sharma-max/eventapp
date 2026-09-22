#!/usr/bin/env bash

# Export PATH for cron environment
export PATH="/home/baadalvm/.local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:$PATH"

PROJECT_DIR="/home/baadalvm/eventapp/backend"
LOG_FILE="$PROJECT_DIR/server.log"

if ! pgrep -f "confhub.asgi:application" > /dev/null; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ⚠️ Gunicorn is down. Auto-restarting server..." >> "$LOG_FILE"
    cd "$PROJECT_DIR"
    export PYTHONUNBUFFERED=1
    nohup ./start_server.sh >> "$LOG_FILE" 2>&1 &
fi
