# Complete Testing Guide for ETD 2026 Conference App

This guide covers **both** testing systems on your IITD VM. Follow it top-to-bottom for first-time setup, or jump to the section you need.

---

## 0. Prerequisites (One-Time Setup)

### Verify your environment is clean

```bash
# Check Python packages are not conflicting
python3 -c 'import daphne.server; print("OK: Daphne")'
python3 -c 'import locust; print("OK: Locust", locust.__version__)'
python3 -c 'import reportlab; print("OK: ReportLab")'
python3 -c 'import matplotlib; print("OK: Matplotlib")'
python3 -c 'import psutil; print("OK: psutil")'
python3 -c 'import websocket; print("OK: websocket-client")'
```

**If any import fails**, install the missing package:

```bash
pip3 install --break-system-packages \
    locust==2.29.1 \
    matplotlib==3.9.2 \
    reportlab==4.2.5 \
    websocket-client==1.8.0 \
    numpy==1.26.4 \
    psutil==6.0.0 \
    psycopg2-binary==2.9.9 \
    redis==5.0.8 \
    "service-identity>=24.1.0" \
    "cryptography" \
    --trusted-host pypi.org \
    --trusted-host files.pythonhosted.org
```

**If you get the `asn1` import error** (Daphne crash):

```bash
rm -rf ~/.local/lib/python3.12/site-packages/service_identity* \
       ~/.local/lib/python3.12/site-packages/cryptography* \
       ~/.local/lib/python3.12/site-packages/pyOpenSSL* \
       ~/.local/lib/python3.12/site-packages/OpenSSL*

pip3 install --break-system-packages \
    "service-identity>=24.1.0" "cryptography" "pyOpenSSL>=24.0.0" \
    --trusted-host pypi.org --trusted-host files.pythonhosted.org
```

### Verify infrastructure services

```bash
# PostgreSQL
pg_isready && echo "OK: PostgreSQL" || echo "FAIL: PostgreSQL"

# Redis
redis-cli ping && echo "OK: Redis" || echo "FAIL: Redis"

# coturn (optional, for WebRTC tests)
systemctl is-active coturn && echo "OK: coturn" || echo "WARN: coturn not active"
```

---

## 1. Start Your Backend Server

Open **Terminal A** (this terminal stays open for the server):

```bash
cd /home/baadalvm/eventapp/backend
python3 manage.py runserver 0.0.0.0:8000
```

You should see:
```
Starting ASGI/Daphne version 4.0.0 development server at http://0.0.0.0:8000/
```

> **Important:** Keep this terminal open. All tests run against this server.
> If you prefer background mode: `nohup python3 manage.py runserver 0.0.0.0:8000 > /tmp/django.log 2>&1 &`

---

## 2. LOCUST TESTING (API Load + WebSocket)

### Option A: Interactive Web UI (Best for Exploration)

Open **Terminal B**:

```bash
cd /home/baadalvm/eventapp/load_tests

# Kill any old locust processes
pkill -f locust 2>/dev/null; sleep 1

# Start Locust web server
export no_proxy="10.17.9.48,localhost,127.0.0.1"
export NO_PROXY="10.17.9.48,localhost,127.0.0.1"

locust -f locustfile.py \
    --web-host 0.0.0.0 \
    --web-port 8089 \
    --host http://10.17.9.48:8000
```

Now open **your browser** (must be on IITD campus network or VPN):

```
http://10.17.9.48:8089/
```

#### Using the Web UI — Step by Step:

**Step 1:** You'll see the "Start New Load Test" dialog. Fill in:

| Field | Smoke | Normal | Peak | Stress |
|-------|-------|--------|------|--------|
| Number of users | `5` | `35` | `80` | `150` |
| Ramp up (users/s) | `2` | `5` | `10` | `15` |
| Host | `http://10.17.9.48:8000` | same | same | same |
| Run time (Advanced) | `1m` | `3m` | `5m` | `7m` |

**Step 2:** Click **"Start Swarming"**

**Step 3:** Watch the 5 tabs in real-time:

```
[Statistics]  → Live table: RPS, avg/p50/p95/p99 per endpoint, failures
[Charts]      → Real-time line graphs: RPS, response time, user count
[Failures]    → Exact error messages and stack traces
[Exceptions]  → Python exceptions from test code
[Workers]     → Connected worker nodes (headless mode)
```

**Step 4:** To stop the test, click **"Stop"** (top right)

**Step 5:** To download results:
- Go to **Statistics** tab
- Click **"Download Data"** → **"Download request statistics CSV"**
- Save the file for PDF report generation later

**Step 6:** To run a different profile:
- Click **"Stop"**
- Click **"New Test"**
- Enter new values
- Click **"Start Swarming"**

#### Quick Profile Launcher (auto-fills values via API):

```bash
cd /home/baadalvm/eventapp/load_tests

# Auto-start "normal" profile and watch in browser:
python3 web_runner.py normal

# Auto-start "peak":
python3 web_runner.py peak

# Just open UI, configure manually:
python3 web_runner.py
```

---

### Option B: Headless Mode (Automated with PDF Reports)

Open **Terminal B**:

```bash
cd /home/baadalvm/eventapp/load_tests
export no_proxy="10.17.9.48,localhost,127.0.0.1"
export NO_PROXY="10.17.9.48,localhost,127.0.0.1"
```

#### Run a single profile:

```bash
# Smoke test (1 min, 5 users) — quick sanity check
./run_all_tests.sh smoke

# Normal load (3 min, 35 users) — typical conference day
./run_all_tests.sh normal

# Peak load (5 min, 80 users) — keynote + lunch rush
./run_all_tests.sh peak

# Stress test (7 min, 150 users) — find breaking point
./run_all_tests.sh stress

# Spike test (3 min, 100 users at 50/sec ramp) — sudden burst
./run_all_tests.sh spike
```

#### Run all profiles sequentially:

```bash
./run_all_tests.sh all
```

#### What each run produces:

```
load_tests/results/normal_20260822_234500/
├── ETD2026_LoadTest_NORMAL_20260822_234500.pdf   ← Full PDF report
├── report.html                                     ← Locust HTML report
├── stats_stats.csv                                 ← Per-endpoint metrics
├── stats_stats_history.csv                         ← Time-series data
├── ws_metrics.json                                 ← WebSocket results
├── ws_test.log                                     ← WebSocket console output
├── console.log                                     ← Locust console output
├── locust.log                                      ← Locust debug log
└── charts/                                         ← PNG charts used in PDF
    ├── response_times.png
    ├── error_rates.png
    ├── throughput.png
    ├── rps_timeline.png
    └── rt_timeline.png
```

#### Read the PDF report:

```bash
# Open PDF (if you have a desktop environment):
xdg-open load_tests/results/normal_*/ETD2026_LoadTest_NORMAL_*.pdf

# Or copy to your local machine via scp:
# From your laptop:
scp baadalvm@10.17.9.48:/home/baadalvm/eventapp/load_tests/results/normal_*/ETD2026*.pdf ./
```

---

## 3. PRODUCTION CERTIFICATION SUITE (Full 10-Layer)

This is the **comprehensive enterprise-grade** test that goes beyond API load testing.

### What it tests (10 layers):

| Layer | What | Duration (Quick) | Duration (Standard) |
|-------|------|-------------------|---------------------|
| 1 | API Load (all endpoints) | 2 min | 5 min |
| 2 | PostgreSQL + Redis stress | 1 min | 2 min |
| 3 | WebSocket capacity | 30s | 1 min |
| 4 | WebRTC / coturn health | 15s | 15s |
| 5 | Security (SQL injection, XSS, JWT, auth bypass) | 30s | 30s |
| 6 | Endurance / memory leak soak | 3 min | 10 min |
| 7 | Chaos engineering (kill Redis, CPU spike) | — | 2 min |
| 8 | Data integrity (race conditions) | 15s | 15s |
| **Total** | | **~15 min** | **~45 min** |

### Run the certification:

Open **Terminal B** (keep Django running in Terminal A):

```bash
cd /home/baadalvm/eventapp/production_certification
export no_proxy="10.17.9.48,localhost,127.0.0.1"
export NO_PROXY="10.17.9.48,localhost,127.0.0.1"
```

#### Quick certification (~15 minutes):

```bash
./run_certification.sh quick
```

#### Standard certification (~45 minutes) — RECOMMENDED:

```bash
./run_certification.sh standard
```

#### Enterprise certification (~90 minutes):

```bash
./run_certification.sh enterprise
```

### What you get:

```
production_certification/results/certification_20260822_234500/
├── ETD2026_PRODUCTION_CERTIFICATE_20260822_234500.pdf  ← SIGNED CERTIFICATE
├── layer1_api_load.json
├── layer1_locust_stats.csv
├── layer2_infrastructure.json
├── layer3_websocket.json
├── layer4_webrtc.json
├── layer5_security.json
├── layer6_endurance.json
├── layer7_chaos.json
├── layer8_data_integrity.json
└── cert_charts/
    └── scores.png                                      ← Score breakdown chart
```

### The certificate PDF contains:

```
Page 1: CERTIFICATE
  ├── Grade (A+ / A / B+ / B / C / D / F)
  ├── Verdict ("PRODUCTION READY" / "REQUIRES OPTIMIZATION" / "FAIL")
  ├── Overall Score (0-100)
  ├── Certificate ID (SHA-256 hash)
  └── Digital signature + timestamp

Page 2: SCORE BREAKDOWN
  ├── Bar chart of all layer scores
  └── Layer-by-layer results table with pass/fail

Page 3: DETAILED FINDINGS
  ├── Per-layer metrics and issues
  └── Specific recommendations for failing layers

Page 4: DEPLOYMENT RECOMMENDATIONS
  ├── Production readiness assessment
  ├── Day-of-event monitoring checklist
  └── Rollback plan
```

---

## 4. READING & INTERPRETING RESULTS

### Locust Results (from web UI or headless):

| Metric | Good | Warning | Critical |
|--------|------|---------|----------|
| **p50 (Median)** | < 200ms | 200-500ms | > 500ms |
| **p95** | < 800ms | 800-2000ms | > 2000ms |
| **p99** | < 2000ms | 2000-5000ms | > 5000ms |
| **Error Rate** | < 1% | 1-5% | > 5% |
| **RPS** | > 50 | 20-50 | < 20 |

### Certification Grades:

| Grade | Score | Meaning |
|-------|-------|---------|
| **A+** | 95-100 | Enterprise-grade, deploy with full confidence |
| **A** | 90-94 | Production ready |
| **B+** | 85-89 | Production ready with minor improvements |
| **B** | 80-84 | Acceptable, recommended improvements |
| **C** | 70-79 | Conditional pass, optimize before event |
| **D** | 60-69 | Not production ready |
| **F** | < 60 | Critical issues, do not deploy |

### Common Issues & Fixes:

| Issue | Root Cause | Fix |
|-------|-----------|-----|
| High p95 on `/schedule/sessions/` | N+1 query on sub-sessions | Add `prefetch_related('subsessions')` in view |
| High error rate on `/chat/` | Redis channel layer saturated | Increase Redis `maxmemory` |
| WebSocket failures | Daphne single-worker bottleneck | Run `daphne -b 0.0.0.0 -p 8000 confhub.asgi:application` with 4 workers |
| Memory growth in soak | Django QuerySet caching | Set `CONN_MAX_AGE=60` in settings.py |
| SQL injection "pass" but no rate limit | No brute-force protection | `pip3 install django-axes` |
| Redis crash during chaos | No persistence | Enable `save 60 1000` in redis.conf |

---

## 5. TROUBLESHOOTING

### Problem: "Django server unreachable"

```bash
# Check if port 8000 is open (bypasses proxy):
python3 -c 'import socket; s=socket.socket(); s.settimeout(2); s.connect(("127.0.0.1",8000)); print("Port 8000 is OPEN")'

# If closed, start the server:
cd /home/baadalvm/eventapp/backend
python3 manage.py runserver 0.0.0.0:8000
```

### Problem: "curl fails but server is running"

The IITD proxy intercepts curl. The test scripts already bypass this, but if you need manual curl:

```bash
# WRONG (goes through proxy):
curl http://10.17.9.48:8000/api/v1/auth/login/

# CORRECT (bypasses proxy):
curl --noproxy '*' http://10.17.9.48:8000/api/v1/auth/login/

# Or set env:
export no_proxy="10.17.9.48,localhost,127.0.0.1"
curl http://10.17.9.48:8000/api/v1/auth/login/
```

### Problem: "Locust web UI not accessible from browser"

```bash
# Check if Locust is running:
pgrep -f locust

# Check if port 8089 is open:
ss -tlnp | grep 8089

# If not running, restart:
cd /home/baadalvm/eventapp/load_tests
pkill -f locust; sleep 1
locust -f locustfile.py --web-host 0.0.0.0 --web-port 8089 --host http://10.17.9.48:8000
```

### Problem: "Daphne/Twisted import error (asn1)"

```bash
rm -rf ~/.local/lib/python3.12/site-packages/service_identity* \
       ~/.local/lib/python3.12/site-packages/cryptography* \
       ~/.local/lib/python3.12/site-packages/pyOpenSSL*

pip3 install --break-system-packages \
    "service-identity>=24.1.0" "cryptography" "pyOpenSSL>=24.0.0" \
    --trusted-host pypi.org --trusted-host files.pythonhosted.org
```

### Problem: "pgbench not found"

```bash
sudo apt install -y postgresql-contrib
```

### Problem: "stress-ng not found" (Layer 7 chaos)

```bash
sudo apt install -y stress-ng
```

---

## 6. RECOMMENDED TESTING SCHEDULE

### Week Before Event:

```bash
# Day 1: Baseline
./run_certification.sh standard    # 45 min, get your grade

# Day 2: Fix issues from Day 1 report, then re-test
./run_certification.sh standard    # Verify improvements

# Day 3: Stress test
cd load_tests
./run_all_tests.sh stress          # Find breaking point
./run_all_tests.sh spike           # Simulate QR scan rush
```

### Day Before Event:

```bash
# Final certification
cd production_certification
./run_certification.sh standard    # Get final certificate

# Quick smoke test (5 min)
cd ../load_tests
./run_all_tests.sh smoke           # Last sanity check
```

### Day of Event (Monitoring):

```bash
# Open 3 terminal tabs:

# Tab 1: Watch server resources
htop

# Tab 2: Watch PostgreSQL
watch -n 5 'psql -U baadalvm -d etd2026 -c "SELECT count(*) as active_connections FROM pg_stat_activity;"'

# Tab 3: Watch Redis
watch -n 5 'redis-cli info memory | grep used_memory_human'
```

---

## 7. QUICK REFERENCE CHEAT SHEET

```
┌─────────────────────────────────────────────────────────────────┐
│                    ETD 2026 TESTING CHEAT SHEET                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  START SERVER (Terminal A):                                     │
│    cd ~/eventapp/backend                                        │
│    python3 manage.py runserver 0.0.0.0:8000                     │
│                                                                 │
│  LOCUST WEB UI (Terminal B):                                    │
│    cd ~/eventapp/load_tests                                     │
│    locust -f locustfile.py --web-host 0.0.0.0 --web-port 8089   │
│    → Open http://10.17.9.48:8089 in browser                    │
│                                                                 │
│  LOCUST HEADLESS (Terminal B):                                  │
│    cd ~/eventapp/load_tests                                     │
│    ./run_all_tests.sh normal                                    │
│    → PDF in results/normal_*/                                   │
│                                                                 │
│  PRODUCTION CERTIFICATION (Terminal B):                         │
│    cd ~/eventapp/production_certification                       │
│    ./run_certification.sh standard                              │
│    → Certificate in results/certification_*/                    │
│                                                                 │
│  ALWAYS SET (before any test):                                  │
│    export no_proxy="10.17.9.48,localhost,127.0.0.1"             │
│    export NO_PROXY="10.17.9.48,localhost,127.0.0.1"             │
│                                                                 │
│  TARGET SLA:                                                    │
│    p50 < 200ms | p95 < 800ms | p99 < 2000ms | Errors < 1%      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```