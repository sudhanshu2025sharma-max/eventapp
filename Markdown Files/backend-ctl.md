The reason nothing showed up in your logs when you refreshed is **Python output buffering**. 

When Gunicorn runs in the background (`nohup`), Python buffers stdout and stderr to optimize performance. This means logs are stored in memory and only written to `server.log` once every few kilobytes, making it look like nothing is happening live.

Here is how we fix it permanently, along with a complete set of commands to start, stop, and restart the backend.

### Step 1: Update the launcher to force unbuffered, real-time log flushing

Run this command to update `start_server.sh` with `export PYTHONUNBUFFERED=1`:

```bash
cat << 'EOF' > /home/baadalvm/eventapp/backend/start_server.sh
#!/usr/bin/env bash
set -e
cd /home/baadalvm/eventapp/backend

# Force Python to flush stdout/stderr instantly to prevent log buffering
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
EOF

chmod +x /home/baadalvm/eventapp/backend/start_server.sh
```

---

### Step 2: The Command Toolkit

#### 🚀 START BACKEND (Background)
Starts the backend, redirects unbuffered output to `server.log`, and detaches.
```bash
pkill -f gunicorn || true
sleep 1
nohup /home/baadalvm/eventapp/backend/start_server.sh > /home/baadalvm/eventapp/backend/server.log 2>&1 &
```

#### 🛑 STOP BACKEND
Force kills the running ASGI processes cleanly.
```bash
pkill -f gunicorn || true
```

#### 🔄 RESTART BACKEND (After any `.py` modification)
Clears stale threads, sleeps for clean port release, then boots up fresh.
```bash
pkill -f gunicorn || true
sleep 1.5
nohup /home/baadalvm/eventapp/backend/start_server.sh > /home/baadalvm/eventapp/backend/server.log 2>&1 &
```

#### 📡 VIEW REAL-TIME LOGS INSTANTLY
Now that `PYTHONUNBUFFERED=1` is active, this will stream live hits immediately as you interact with the app or refresh the page:
```bash
tail -f /home/baadalvm/eventapp/backend/server.log
```

*(Press `Ctrl + C` to stop watching the logs anytime; the server remains running in the background).*