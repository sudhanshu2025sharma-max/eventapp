## ETD 2026 — Backend Cheat Sheet

### 🔁 Gunicorn (App Server)
```bash
# Restart (after ANY .py change)
cd /home/baadalvm/eventapp/backend && pkill -9 -f gunicorn || true && sleep 1.5 && nohup ./start_server.sh > server.log 2>&1 &

# Check if running
ps aux | grep gunicorn | grep -v grep | wc -l    # should show 9 (1 master + 8 workers)

# Check port
ss -tlnp | grep 8000
```

### 📋 Logs
```bash
# Live tail
tail -f /home/baadalvm/eventapp/backend/server.log

# Last 50 lines
tail -50 /home/baadalvm/eventapp/backend/server.log

# Find errors
grep -i 'error\|500\|traceback\|critical' /home/baadalvm/eventapp/backend/server.log | tail -20

# Find specific endpoint
grep 'schedule/admin' /home/baadalvm/eventapp/backend/server.log | tail -10

# Count status codes
grep -oP 'HTTP/1.1" \K\d+' /home/baadalvm/eventapp/backend/server.log | sort | uniq -c | sort -rn
```

### 🗄️ Database
```bash
# Django shell
cd /home/baadalvm/eventapp/backend && python3 manage.py shell

# Run migrations
cd /home/baadalvm/eventapp/backend && python3 manage.py migrate

# Check pending migrations
cd /home/baadalvm/eventapp/backend && python3 manage.py showmigrations | grep '\[ \]'

# Backup database
pg_dump -U baadalvm etd2026_db > /home/baadalvm/backup_$(date +%Y%m%d_%H%M).sql

# Restore database
psql -U baadalvm etd2026_db < /home/baadalvm/backup_XXXXXXXX.sql
```

### 🎨 Static Files
```bash
# Only needed when CSS/JS/images change (NOT templates)
cd /home/baadalvm/eventapp/backend && python3 manage.py collectstatic --noinput
```

### ⚡ Redis Cache
```bash
# Check status
redis-cli ping

# Flush all cache (if stale data)
redis-cli FLUSHALL

# Memory usage
redis-cli info memory | grep used_memory_human
```

### 🔍 Quick Diagnostics
```bash
# Server health
free -h && echo "---" && uptime && echo "---" && df -h /

# Test endpoint speed
curl -s --noproxy '*' -o /dev/null -w "HTTP %{http_code} | %{time_total}s\n" http://127.0.0.1:8000/panel/login/

# Test API with auth
curl -s --noproxy '*' -H "Authorization: Bearer YOUR_TOKEN" http://127.0.0.1:8000/api/v1/schedule/sessions/ | python3 -m json.tool | head -5

# Django check
cd /home/baadalvm/eventapp/backend && python3 manage.py check
```

### 🚨 Emergency Recovery
```bash
# Full restart (if everything is broken)
sudo systemctl restart postgresql
redis-cli FLUSHALL
cd /home/baadalvm/eventapp/backend && pkill -9 -f gunicorn || true && sleep 2 && nohup ./start_server.sh > server.log 2>&1 &
sleep 3 && curl -s --noproxy '*' -o /dev/null -w "%{http_code}" http://127.0.0.1:8000/panel/login/

# If 502/503 from Apache side (on web VM)
ssh baadalvm@10.17.5.38 "sudo systemctl restart apache2"

# Revert DEBUG if something breaks with DEBUG=False
sed -i 's/^DEBUG=False/DEBUG=True/' /home/baadalvm/eventapp/backend/.env
cd /home/baadalvm/eventapp/backend && pkill -9 -f gunicorn || true && sleep 1.5 && nohup ./start_server.sh > server.log 2>&1 &
```

### 📌 Key Reminders
- **Every `.py` change** → restart gunicorn
- **Template `.html` change** → just refresh browser (no restart needed in production, but restart is safe)
- **CSS/JS/image change** → `collectstatic` + restart
- **`.env` change** → restart gunicorn
- **Never** `DEBUG=True` during event (slow + memory leak)
- **Cron watchdog** auto-restarts gunicorn if it dies — check with `crontab -l`