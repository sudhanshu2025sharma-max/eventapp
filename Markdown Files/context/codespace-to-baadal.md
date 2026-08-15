# VM Migration Context — Codespace → IITD Baadalvm

---

## WHY THE MIGRATION
```
- GitHub Codespace free tier billing exhausted on account sudhanshu1907
- Cloned repo to new GitHub account Sharma1907
- Shifted from Codespace to IITD VM (baadalvm) for 24/7 availability
- VM is dedicated for ETD 2026 conference app
- No more ephemeral environments — data persists permanently
```

---

## WHAT CHANGED — SIDE BY SIDE

| Component | OLD (Codespace) | NEW (IITD VM) |
|-----------|-----------------|----------------|
| Environment | GitHub Codespaces | IITD Baadalvm VM |
| OS | Ubuntu (codespace) | Ubuntu 24.04 LTS |
| IP | Ephemeral (changes) | 10.17.9.48 (static, IITD internal) |
| CPU/RAM | Shared | 8 cores / 7.7GB RAM |
| Uptime | Ephemeral (stops after idle) | 24/7 always on |
| GitHub Account | sudhanshu1907 | Sharma1907 |
| GitHub Repo | sudhanshu1907/eventapp | Sharma1907/eventapp |
| Database | Docker PostgreSQL 15 | System PostgreSQL 16 |
| DB Name | confhub_db | etdapp |
| DB User | confhub_user | etdapp_admin |
| Redis | Docker Redis 7 | System Redis 7 |
| MinIO | Docker MinIO | Not needed (local media) |
| Python | Virtual env (.venv) | System Python 3.12 (no venv) |
| Python command | `python` | `python3` |
| pip install | `pip install -r requirements.txt` | `pip install -r requirements.txt --break-system-packages` |
| Node.js | Pre-installed in codespace | snap install node --classic --channel=20 |
| npm | Pre-installed | Requires PATH fix + proxy config |
| Tunnel | ngrok (worked) | ngrok BLOCKED by IITD proxy |
| API Access | ngrok public URL | http://10.17.9.48:8000 (campus only) |
| Web App | Via Expo tunnel | http://10.17.9.48:8081 (campus only) |
| Docker | docker compose up -d | NOT USED — system services |
| Persistence | Lost on codespace restart | screen sessions survive SSH disconnect |
| .env file | Created each restart | Created once, persists |
| Media files | Lost on restart | Persists in /home/baadalvm/eventapp/backend/media/ |

---

## NETWORK CONSTRAINTS ON IITD VM
```
VM IP: 10.17.9.48
  - Accessible ONLY from IITD campus network
  - NOT accessible from outside internet
  - Phone must be on IITD WiFi to access

IITD Proxy: proxy21.iitd.ac.in:3128
  - All outbound HTTP/HTTPS goes through this proxy
  - SSL Inspection: proxy intercepts + re-encrypts HTTPS traffic
  
  BLOCKED by proxy:
    ✗ ngrok (failed to dial + CRL verification error)
    ✗ cloudflared (not tested, likely blocked)
    ✗ localtunnel (not tested)
    ✗ bore (not tested)
    ✗ apt install (most packages — Hash Sum mismatch)
    ✗ Docker install via curl script

  WORKS through proxy:
    ✓ git clone/push (HTTPS)
    ✓ pip install (with --break-system-packages)
    ✓ npm install (with proxy configured)
    ✓ wget/curl for direct file downloads
    ✓ Python urllib with ssl.CERT_NONE context
    ✓ snap install
    ✓ sudo apt install (some packages, not all)

  Proxy config needed:
    pip:  works without explicit proxy config
    npm:  npm config set proxy http://proxy21.iitd.ac.in:3128
          npm config set https-proxy http://proxy21.iitd.ac.in:3128
    Python scripts: use ssl.CERT_NONE + ProxyHandler
```

---

## DATABASE MIGRATION

### Old (Codespace — Docker PostgreSQL)
```yaml
# docker-compose.yml
db:
  image: postgres:15
  environment:
    POSTGRES_DB: confhub_db
    POSTGRES_USER: confhub_user
    POSTGRES_PASSWORD: <password>
  ports:
    - "5432:5432"
  volumes:
    - postgres_data:/var/lib/postgresql/data
```

### New (VM — System PostgreSQL 16)
```bash
# Installed via apt
sudo apt install -y postgresql postgresql-contrib

# Database created manually
sudo -u postgres psql << 'EOF'
CREATE USER etdapp_admin WITH PASSWORD '<password>';
CREATE DATABASE etdapp OWNER etdapp_admin;
GRANT ALL PRIVILEGES ON DATABASE etdapp TO etdapp_admin;
EOF

# Verify
sudo systemctl status postgresql | grep Active
PGPASSWORD=<pwd> psql -U etdapp_admin -d etdapp -h localhost -c "\dt"
```

### settings.py — Database Toggle
```python
# Same code, different .env values
if config('USE_POSTGRES', default=False, cast=bool):
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': config('DB_NAME'),       # etdapp
            'USER': config('DB_USER'),       # etdapp_admin
            'PASSWORD': config('DB_PASSWORD'),
            'HOST': config('DB_HOST'),       # localhost
            'PORT': config('DB_PORT'),       # 5432
        }
    }
```

### DB Table Names (Custom — NOT Django defaults)
```
users                    (not accounts_user)
checkins                 (not checkins_checkin)
meal_passes              (not checkins_mealpass)
meal_windows             (not checkins_mealwindow)
participant_imports      (not accounts_participantimport)
user_fcm_tokens          (not notifications_devicetoken)
point_entries            (not leaderboard_pointentry)
user_points              (not leaderboard_userpoints)
photos                   (not photos_photo)
photo_settings           (not photos_photosettings)
sponsors_sponsor         (default Django name)
speakers_speaker         (default Django name)
schedule_schedulesession (default Django name)
```

---

## .env FILE CHANGES

### Old (Codespace)
```
SECRET_KEY=django-insecure-...
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1,0.0.0.0,.ngrok-free.app,.ngrok.io,.github.dev
USE_POSTGRES=True
DB_NAME=confhub_db
DB_USER=confhub_user
DB_PASSWORD=<password>
DB_HOST=localhost
DB_PORT=5432
REDIS_URL=redis://localhost:6379/0
```

### New (VM)
```
SECRET_KEY=django-insecure-...
DEBUG=True
ALLOWED_HOSTS=10.17.9.48,127.0.0.1,localhost,.ngrok-free.app,.ngrok.io
USE_POSTGRES=True
DB_NAME=etdapp
DB_USER=etdapp_admin
DB_PASSWORD=<password>
DB_HOST=localhost
DB_PORT=5432
REDIS_URL=redis://127.0.0.1:6379/0
```

---

## theme.js API_URL CHANGE
```javascript
// OLD (Codespace + ngrok):
const NGROK = 'https://bauble-aftermost-buffalo.ngrok-free.dev/api/v1';
export const API_URL = NGROK;
export const API_HEADERS = {
  'Content-Type': 'application/json',
  'ngrok-skip-browser-warning': 'true',   // needed for ngrok
};

// NEW (VM direct IP):
const NGROK = 'http://10.17.9.48:8000/api/v1';
export const API_URL = NGROK;
export const API_HEADERS = {
  'Content-Type': 'application/json',
  'ngrok-skip-browser-warning': 'true',   // kept for compatibility
};
```

---

## NODE.JS INSTALLATION ON VM
```bash
# Ubuntu 24.04 apt has Node 18 (too old for Expo SDK 54)
# NodeSource script blocked by proxy
# Solution: snap

sudo snap install node --classic --channel=20

# Fix PATH (snap binaries not in default PATH)
echo 'export PATH=/snap/node/current/bin:$PATH' >> ~/.bashrc
source ~/.bashrc

# Configure npm proxy
npm config set proxy http://proxy21.iitd.ac.in:3128
npm config set https-proxy http://proxy21.iitd.ac.in:3128

# Verify
node --version   # v20.20.2
npm --version    # 10.8.2
```

---

## PYTHON ON VM
```bash
# No virtual environment — system Python
python3 --version   # 3.12.3

# "python" command doesn't work (python-is-python3 blocked by apt)
# Always use: python3

# Install packages system-wide
pip install -r requirements.txt --break-system-packages

# Django management commands
python3 manage.py migrate
python3 manage.py runserver 0.0.0.0:8000
python3 manage.py shell
```

---

## STARTUP SEQUENCE CHANGE

### Old (Codespace — 3 terminals)
```bash
# Terminal 1: Docker + Django
cd /workspaces/eventapp && docker compose up -d && sleep 3
cd backend && source .venv/bin/activate
python manage.py runserver 0.0.0.0:8000

# Terminal 2: ngrok
ngrok http 8000

# Terminal 3: Expo
cd /workspaces/eventapp/mobile && npx expo start --tunnel --port 8081 --clear
```

### New (VM — screen sessions)
```bash
# Terminal 1: Django (persistent)
screen -S django
cd /home/baadalvm/eventapp/backend
python3 manage.py runserver 0.0.0.0:8000
# Ctrl+A, D to detach

# Terminal 2: Expo (persistent)
screen -S expo
cd /home/baadalvm/eventapp/mobile
npx expo start --lan --port 8081
# Ctrl+A, D to detach

# Reconnect later:
screen -r django
screen -r expo
screen -ls     # list all sessions
```

---

## GIT REMOTE CHANGE
```bash
# Old remote (billing exhausted)
origin  https://github.com/sudhanshu1907/eventapp.git

# New remote
git remote remove origin
git remote add origin https://github.com/Sharma1907/eventapp.git
git push -u origin main --force

# Credential storage
git config --global credential.helper store
# First push asks for Sharma1907 username + GitHub Personal Access Token
```

---

## SEED SCRIPTS ON VM
```
Two standalone scripts created for VM (with IITD proxy + SSL bypass):
  backend/seed_sponsors.py  — 13 sponsors with downloaded logos
  backend/seed_speakers.py  — 19 speakers with downloaded photos

Both scripts use:
  ssl.create_default_context()
  ssl_ctx.check_hostname = False
  ssl_ctx.verify_mode = ssl.CERT_NONE
  ProxyHandler('http://proxy21.iitd.ac.in:3128')

Run:
  cd /home/baadalvm/eventapp/backend
  python3 seed_sponsors.py
  python3 seed_speakers.py
```

---

## MEDIA FILES
```
Old (Codespace): Lost on restart, re-seeded each time
New (VM): Persist permanently at:
  /home/baadalvm/eventapp/backend/media/
  ├── sponsors/    (13 logo files)
  └── speakers/    (19 photo files)

Django serves media via:
  urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

MEDIA_ROOT = /home/baadalvm/eventapp/backend/media
MEDIA_URL  = /media/
```

---

## CURRENT DATA IN VM DATABASE
```
Table              | Count | Notes
─────────────────  | ───── | ─────
users              | 103   | 3 test + 100 dummy participants
schedule_sessions  | 32    | 3 days of ETD 2026
sponsors           | 13    | All tiers with logos
speakers           | 19    | With photos downloaded
checkins           | 3     | Test check-ins
```

---

## WHAT STILL NEEDS EXTERNAL ACCESS
```
Current: App only works on IITD campus WiFi
Future options (in order of preference):
  1. Ask IITD IT for public IP / domain mapping (recommended)
  2. Reverse SSH tunnel to external VPS
  3. Cloudflare tunnel (if not blocked)
  4. ngrok on a machine outside IITD + reverse SSH

For conference day: All attendees will be on campus WiFi,
so direct IP access (10.17.9.48) works fine.
```

---

## PENDING: Speaker ↔ User Linking
```
Discussed but NOT implemented:
  - Speaker model currently has NO user FK
  - 19 Speaker profiles exist (bio, photo, talks)
  - Only 1 User with role='speaker' exists (speaker@test.com)
  - NetworkScreen "Speakers" tab shows User accounts, not Speaker model
  - Plan was to add OneToOneField(User) on Speaker + create user accounts

Status: Stopped before implementation. Can resume when needed.
```

---

## FULL REBUILD FROM SCRATCH (If VM is Reset)
```bash
# 1. System packages
sudo apt install -y postgresql postgresql-contrib redis-server git curl wget nano
sudo systemctl start postgresql redis-server
sudo systemctl enable postgresql redis-server

# 2. Create database
sudo -u postgres psql -c "CREATE USER etdapp_admin WITH PASSWORD '<password>';"
sudo -u postgres psql -c "CREATE DATABASE etdapp OWNER etdapp_admin;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE etdapp TO etdapp_admin;"

# 3. Node.js
sudo snap install node --classic --channel=20
echo 'export PATH=/snap/node/current/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
npm config set proxy http://proxy21.iitd.ac.in:3128
npm config set https-proxy http://proxy21.iitd.ac.in:3128

# 4. Clone repo
cd /home/baadalvm
git clone https://github.com/Sharma1907/eventapp.git

# 5. Backend setup
cd eventapp/backend
pip install -r requirements.txt --break-system-packages
# Create .env file (see .env section above)
python3 manage.py migrate

# 6. Seed data
python3 seed_sponsors.py
python3 seed_speakers.py
python3 manage.py seed_schedule
python3 manage.py seed_dummy_participants
python3 manage.py shell << 'EOF'
from apps.accounts.models import User
for email, pwd, fn, ln, role in [
    ('etd@admin.iitd.ac.in','Admin@1234','ETD','Admin','super_admin'),
    ('participant@test.com','Test@1234','Test','Participant','participant'),
    ('speaker@test.com','Test@1234','Test','Speaker','speaker'),
]:
    if not User.objects.filter(email=email).exists():
        u = User.objects.create_user(email=email,password=pwd,first_name=fn,last_name=ln)
        u.role = role; u.is_active = True
        if role=='super_admin': u.is_staff=True; u.is_superuser=True
        u.save(); print(f'✅ {email}')
EOF

# 7. Mobile deps
cd /home/baadalvm/eventapp/mobile
npm install

# 8. Start services
screen -S django -dm bash -c 'cd /home/baadalvm/eventapp/backend && python3 manage.py runserver 0.0.0.0:8000'
screen -S expo -dm bash -c 'cd /home/baadalvm/eventapp/mobile && npx expo start --lan --port 8081'
```