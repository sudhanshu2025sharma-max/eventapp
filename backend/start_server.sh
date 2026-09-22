#!/usr/bin/env bash
set -e

# Include user bin directory where gunicorn is installed
export PATH="/home/baadalvm/.local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:$PATH"

cd /home/baadalvm/eventapp/backend
export PYTHONUNBUFFERED=1

exec gunicorn confhub.asgi:application \
  --workers 8 \
  --worker-class uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:8000 \
  --timeout 120 \
  --keep-alive 65 \
  --max-requests 5000 \
  --max-requests-jitter 500 \
  --log-level info \
  --access-logfile - \
  --error-logfile -
