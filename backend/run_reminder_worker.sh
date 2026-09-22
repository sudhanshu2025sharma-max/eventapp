#!/usr/bin/env bash
cd /home/baadalvm/eventapp/backend

echo "Starting Session Reminder Background Worker..."
while true; do
  python3 manage.py send_session_reminders >> reminder_worker.log 2>&1 || true
  sleep 30
done
