# 🎯 ETD 2026 CONFERENCE APP — Complete Context Window (v22)

```
Product:   Conference Management Platform
Event:     ETD 2026 — "ETDs in the age of AI" — IIT Delhi
Website:   https://etd2026.iitd.ac.in/
Type:      Mobile App (React Native Expo SDK 54) + Web Admin Panel (Django MVT)
GitHub:    github.com/Sharma1907/eventapp
Dev Env:   IITD Baadal VMs — Ubuntu 24.04 LTS, 24/7

Status:    ALL v21 FEATURES + SCHEDULE-DRIVEN MEAL AUTOMATION 2.0 + NAMED
           MEAL CATEGORIES (LUNCH/DINNER/HIGH TEA/BREAKFAST/CUSTOM) +
           FEED ADMIN FULL CRUD FROM MOBILE + COMMENT MODERATION + VIDEO
           MEDIA VIEWER + FLEXIBLE FCM DISPATCHERS + 30s BACKGROUND MEAL
           SYNC + WEB ADMIN AUTO-POLLING SCANNER + ON-DEMAND MEAL PUSH
           BUTTON + SCHEDULE DATE MIGRATION HELPER + CRON WATCHDOG
           AUTO-RESTART + EXPO SDK 54 NOTIFICATION HANDLER MODERNIZATION

Phase:     PRODUCTION-READY & AUTO-HEALING — HTTPS live at
           https://etd2026.iitd.ac.in, cron watchdog restarts Gunicorn
           within 60s if it ever dies, real-time meal window automation
           runs every 30s across the entire app.
```

---

## 🖥️ TWO-VM INFRASTRUCTURE (IITD Baadal)

```
┌──────────────────────────────────────────────────────────────┐
│  WEBSITE VM — 10.17.5.38                                     │
│  Public: https://etd2026.iitd.ac.in                          │
│  • Apache2 + WordPress (Conference marketing site at /)      │
│  • Reverse Proxy → forwards /api/, /panel/, /media/,         │
│    /static/panel/, /ws/, /_expo/, /hot, /message, etc.       │
│  • MySQL (WordPress DB — localhost only)                     │
│  • SSL is terminated at IITD Central Gateway                 │
│    (no cert files on this VM — see SSL section below)        │
└──────────────────────────────────────────────────────────────┘
                          │
                          │  Internal IITD LAN (fast, private, no SSL)
                          ▼
┌──────────────────────────────────────────────────────────────┐
│  APP VM — 10.17.9.48                                         │
│  • Django 5 (Gunicorn + Uvicorn ASGI on :8000)               │
│  • PostgreSQL 16 (etdapp DB)                                 │
│  • Redis 7                                                   │
│  • coturn (STUN/TURN on :3478 — marked for removal)          │
│  • Expo Metro Bundler (:8081 during dev)                     │
│  • Cron Watchdog (@reboot + every 60s auto-heal Gunicorn)    │
│  • ALL application logic + data lives here                   │
└──────────────────────────────────────────────────────────────┘

Access:
  Public HTTPS:     https://etd2026.iitd.ac.in/         (WordPress)
                    https://etd2026.iitd.ac.in/panel/   (Django Admin)
                    https://etd2026.iitd.ac.in/api/v1/  (Django REST)
                    wss://etd2026.iitd.ac.in/ws/        (Django Channels)

  Internal (dev):   http://10.17.9.48:8000/panel/login/
                    http://10.17.9.48:8000/api/v1/
                    ws://10.17.9.48:8000/ws/?token=<jwt>

  Metro (dev):      http://10.17.9.48:8081
                    OR https://etd2026.iitd.ac.in (via reverse proxy)

  Home dir:         /home/baadalvm/eventapp/  (on both VMs — repo layout mirrors)
  User:             baadalvm
  Python:           3.12.3 (system-wide, --break-system-packages)
  Node:             v20 (snap, --classic)
```

### DB Credentials (App VM: `backend/.env`)
```
USE_POSTGRES=True
DB_NAME=etdapp
DB_USER=etdapp_admin
DB_PASSWORD=<ASK>
DB_HOST=localhost
DB_PORT=5432
REDIS_URL=redis://127.0.0.1:6379/0

EMAIL_HOST=smtp.iitd.ac.in
EMAIL_PORT=465
EMAIL_USE_TLS=False
EMAIL_USE_SSL=True
EMAIL_HOST_USER=yourname@iitd.ac.in
EMAIL_HOST_PASSWORD=<kerberos_password>
DEFAULT_FROM_EMAIL=yourname@iitd.ac.in
```

### IITD Proxy Constraints
```
Proxy: proxy21.iitd.ac.in:3128
  ✗ Blocks ngrok / cloudflared / all public tunnels
  ✗ SSL inspection breaks curl / npm cert verification
  ✓ pip:  works with --break-system-packages
  ✓ npm:  NODE_TLS_REJECT_UNAUTHORIZED=0 npm install <pkg> --strict-ssl=false
  ✓ curl to internal VM: MUST use --noproxy "*"
  ✓ curl to public HTTPS: use -k flag (bypasses IITD SSL inspection)
  ✓ Python to VM: build_opener(ProxyHandler({}))
  ✓ Expo Push API in fcm.py: routes via proxy + verify=False
```

### Expo SDK — LOCKED AT 54
```
⚠️ DO NOT upgrade to SDK 55/56/57 — will break react-native-webrtc, expo-av,
    reanimated, native dev client. Upgrade deferred until after WebRTC removal
    + expo-av → expo-audio migration.

⚠️ Always run Expo from mobile/ directory:
    cd /home/baadalvm/eventapp/mobile
    npx expo start --lan --port 8081

⚠️ Running from root triggers SDK 57 install prompt — DECLINE.

⚠️ Expo SDK 54 Notification Handler MUST include:
    shouldShowAlert: true      (legacy, still needed)
    shouldShowBanner: true     (SDK 54 new)
    shouldShowList: true       (SDK 54 new)
    shouldPlaySound: true
    shouldSetBadge: true

EAS Build (local):
    NODE_TLS_REJECT_UNAUTHORIZED=0 npx eas build --profile preview \
      --platform android --local

Project ID: afa28d7e-10d5-4e85-bed4-783b7371a56b
Owner:      coder2026s-team
```

---

## ⭐ URL ROUTING — THREE-LAYER SYSTEM

### LAYER 1: IITD Central Gateway (SSL Termination)

```
[ Internet user on Jio/Airtel/Home Wi-Fi ]
                │  🔒 HTTPS (Port 443, TLS 1.3, wildcard *.iitd.ac.in cert)
                ▼
[ IITD Central Firewall / Load Balancer ]  ← Decrypts SSL here
                │  ⚡ Plain HTTP (Port 80) over IITD private fiber
                ▼
[ Website VM (10.17.5.38) Apache on :80 ]
```

**Key insight**: Website VM has **NO SSL certificate files**. IITD Central
Gateway handles all HTTPS. Users see 🔒 padlock via IITD wildcard cert.

### LAYER 2: Apache Reverse Proxy on Website VM (`10.17.5.38`)

```
Request Path                      → Destination
─────────────────────────────────────────────────────────────────
/                                 → WordPress (DocumentRoot /var/www/html)
/wp-admin/, /wp-content/, etc.    → WordPress
/api/*                            → 10.17.9.48:8000 (Django REST)
/panel/*                          → 10.17.9.48:8000 (Django Admin)
/media/*                          → 10.17.9.48:8000 (Django uploads)
/static/panel/*                   → 10.17.9.48:8000 (Django static)
/ws/*                             → 10.17.9.48:8000 (WebSocket, ws://)
/_expo/*, /hot, /message          → 10.17.9.48:8081 (Metro dev)
/index.bundle, /status, /assets/* → 10.17.9.48:8081 (Metro dev)
```

Smart root routing detects Expo user-agent and forwards `/` to Metro:
```apache
RewriteEngine On
RewriteCond %{HTTP:expo-platform} !^$ [OR]
RewriteCond %{HTTP:expo-api-version} !^$ [OR]
RewriteCond %{HTTP_USER_AGENT} Expo [OR]
RewriteCond %{HTTP_USER_AGENT} okhttp
RewriteRule ^/$ http://10.17.9.48:8081/ [P,L]
```

### LAYER 3: Django on App VM (`10.17.9.48`)

Gunicorn on `0.0.0.0:8000` with 8 Uvicorn workers. Django settings:
```python
ALLOWED_HOSTS = ['*']
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
USE_X_FORWARDED_HOST = True
USE_X_FORWARDED_PORT = True
CSRF_TRUSTED_ORIGINS = [
    'https://etd2026.iitd.ac.in',
    'http://localhost:8000',
    'http://10.17.9.48:8000',
]
```

### LAYER 4: Mobile App Auto-Switch (`theme.js`)

```javascript
const DEV_API_URL  = 'http://10.17.9.48:8000/api/v1';           // Metro dev
const PROD_API_URL = 'https://etd2026.iitd.ac.in/api/v1';       // Prod APK
export const API_URL  = __DEV__ ? DEV_API_URL : PROD_API_URL;
export const API_ROOT = API_URL.replace(/\/api\/v1$/, '');
```

### Safe Apache Operations
```bash
sudo apache2ctl configtest      # ALWAYS test first
sudo systemctl reload apache2   # ONLY if "Syntax OK"
# Rollback:
sudo cp /etc/apache2/sites-available/wordpress.conf.bak \
        /etc/apache2/sites-available/wordpress.conf
sudo systemctl reload apache2
```

---

## ⚡ APP VM PRODUCTION SERVER + AUTO-HEALING WATCHDOG (⭐ NEW v22)

### `backend/start_server.sh` (chmod +x)
```bash
#!/usr/bin/env bash
set -e

# CRITICAL: Include user bin directory for cron access to gunicorn
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
```

### `backend/keep_alive.sh` (⭐ NEW v22 — Auto-Restart Watchdog)
```bash
#!/usr/bin/env bash

# CRITICAL: Cron has minimal PATH — must export explicitly
export PATH="/home/baadalvm/.local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:$PATH"

PROJECT_DIR="/home/baadalvm/eventapp/backend"
LOG_FILE="$PROJECT_DIR/server.log"

if ! pgrep -f "confhub.asgi:application" > /dev/null; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ⚠️ Gunicorn is down. Auto-restarting..." >> "$LOG_FILE"
    cd "$PROJECT_DIR"
    export PYTHONUNBUFFERED=1
    nohup ./start_server.sh >> "$LOG_FILE" 2>&1 &
fi
```

### Cron Setup (Verified Working)
```bash
crontab -l
# Should show:
@reboot /home/baadalvm/eventapp/backend/keep_alive.sh
* * * * * /home/baadalvm/eventapp/backend/keep_alive.sh
```

**How it works:**
1. **@reboot**: VM boots → cron triggers `keep_alive.sh` → starts Gunicorn.
2. **Every 60s**: cron re-runs `keep_alive.sh`:
   - If `pgrep -f "confhub.asgi:application"` finds the process → no-op.
   - If process is dead/missing → restarts Gunicorn within 60 seconds.
3. **Path Fix**: `export PATH` ensures cron can find `/home/baadalvm/.local/bin/gunicorn`.

### Backend Command Toolkit
```bash
# 🚀 START (background)
cd /home/baadalvm/eventapp/backend
pkill -f gunicorn || true
sleep 1
nohup ./start_server.sh > server.log 2>&1 &

# 🔄 RESTART (after ANY .py change — no hot reload!)
cd /home/baadalvm/eventapp/backend
pkill -9 -f gunicorn || true
sleep 1.5
nohup ./start_server.sh > server.log 2>&1 &

# 📡 LIVE LOGS
tail -f /home/baadalvm/eventapp/backend/server.log

# 📊 CHECK RUNNING
ps aux | grep gunicorn | grep -v grep

# 🗃️ Django management (ALWAYS cd into backend/ first)
cd /home/baadalvm/eventapp/backend
python3 manage.py makemigrations <app>
python3 manage.py migrate
python3 manage.py check
python3 manage.py collectstatic --noinput
```

⚠️ **CRITICAL:** Gunicorn does NOT hot-reload — restart after every `.py` change.

### Expo Dev Server (App VM)
```bash
cd /home/baadalvm/eventapp/mobile
npx kill-port 8081 2>/dev/null || true
npx expo start --lan --port 8081
```

---

## 📁 PROJECT STRUCTURE

```
/home/baadalvm/eventapp/               ← Repo root (both VMs mirror)
├── .easignore
├── backend/                           ← Django project
│   ├── start_server.sh                ← Gunicorn launcher (with PATH export)
│   ├── keep_alive.sh                  ← ⭐ NEW v22: Cron watchdog
│   ├── server.log                     ← nohup log target
│   ├── manage.py
│   ├── .env
│   ├── requirements.txt
│   ├── confhub/
│   │   ├── settings.py
│   │   ├── urls.py                    ← ALL routes wired
│   │   ├── asgi.py
│   │   ├── wsgi.py
│   │   └── middleware.py
│   ├── apps/
│   │   ├── accounts/                  ← User, StaffProfile, StaffPermission
│   │   ├── notifications/             ← DeviceToken, Notification,
│   │   │                                UserNotification, fcm.py, views.py
│   │   ├── leaderboard/
│   │   ├── photos/
│   │   ├── chat/
│   │   ├── schedule/                  ← ScheduleSession (⭐ +is_meal +meal_category),
│   │   │                                ScheduleSubSession, AcceptedPaper
│   │   ├── polls/                     ← Poll, Ideathon* models
│   │   ├── checkins/                  ← CheckIn, MealPass, MealWindow,
│   │   │                                meal_utils.py, push.py
│   │   ├── sponsors/  speakers/  conferences/  events/  posts/
│   ├── templates/                     ← ★ CENTRAL TEMPLATE FOLDER
│   │   └── panel/                     ← ALL web admin templates
│   │       ├── accepted_papers.html
│   │       ├── scanner.html           ← ⭐ v22: 5s auto-poll, meal type modal,
│   │       │                              Send Push button
│   │       ├── schedule_form.html     ← ⭐ v22: is_meal checkbox + category picker
│   │       └── chat/
│   ├── static/                        ← STATICFILES_DIRS source
│   ├── staticfiles/                   ← collectstatic target
│   └── media/
│       └── papers/
│
├── mobile/                            ← Expo React Native app (SDK 54)
│   ├── App.js  index.js  babel.config.js
│   ├── app.json  package.json  .npmrc  .easignore  eas.json
│   ├── google-services.json
│   └── src/
│       ├── theme.js                   ← Auto DEV/PROD API switch
│       ├── components.js
│       ├── cache.js
│       ├── api.js
│       ├── MainApp.js
│       ├── notifications.js           ← ⭐ v22: SDK 54 handler +
│       │                                registerForPushNotifications alias
│       ├── utils/geo.js
│       └── screens/
│           ├── HomeTab.js             ← ⭐ v22: Day calc from live sessions
│           │                              (not hardcoded conf.start_date)
│           ├── QRScreen.js            ← ⭐ v22: Dynamic meal name display
│           ├── ScheduleTab.js         ← ⭐ v22: Sep 18/19/20 tabs,
│           │                              setInterval 20s poll, pull-to-refresh
│           ├── NetworkScreen.js
│           ├── ProfileTab.js  NotificationsScreen.js
│           ├── EditProfileScreen.js  ChangePasswordScreen.js
│           ├── SponsorsScreen.js  SponsorDetailScreen.js
│           ├── SpeakersScreen.js  SpeakerDetailScreen.js
│           ├── ChatListScreen.js  ChatRoomScreen.js  ContactCardModal.js
│           ├── TopicPickerModal.js  SpeakerRequestModal.js
│           ├── ConnectionRequestsScreen.js  LeaderboardScreen.js
│           ├── PhotosScreen.js  PollsScreen.js
│           ├── IdeathonScreen.js
│           ├── AcceptedPapersScreen.js
│           ├── ShakeConnectScreen.js  RecapScreen.js
│           ├── CheckpointScreen.js
│           ├── VoiceCallScreen.js
│           ├── StaffScreen.js  StaffDetailScreen.js  StaffGroupChatScreen.js
│           ├── FeedScreen.js          ← ⭐ v22: Video support + full-screen viewer
│           └── admin/
│               ├── AdminTab.js
│               ├── CheckInScreen.js   ← ⭐ v22: Meal type selector modal +
│               │                        Send Push button + 10s auto-refresh
│               ├── IdeathonAdmin.js
│               ├── PapersAdminScreen.js
│               ├── NotificationsAdmin.js
│               ├── UsersAdmin.js
│               ├── AddParticipantScreen.js
│               ├── ScheduleAdmin.js   ← ⭐ v22: Is Meal Service toggle +
│               │                        meal_category picker + sub-sessions
│               ├── PhotosAdmin.js  PollsAdmin.js
│               ├── CheckpointAdminScreen.js
│               ├── CallLogsAdmin.js
│               ├── FeedAdmin.js       ← ⭐ NEW v22: Full CRUD + PDF/video +
│               │                        comment moderation
│               └── StaffAdminScreen.js
│
└── production_certification/          ← Load test suite
```

⚠️ Note: `eventapp/mobile/` duplicate directory does NOT exist. Mobile
changes go to `/home/baadalvm/eventapp/mobile/src/` ONLY.

---

## 🎨 CENTRAL TEMPLATE SYSTEM — HOW IT'S WIRED

This is a **hand-rolled Django MVT admin panel**, completely separate from
`django.contrib.admin`.

### Resolution Chain
```
settings.TEMPLATES[0]['DIRS'] = [BASE_DIR / 'templates']
   BASE_DIR = /home/baadalvm/eventapp/backend
   → /home/baadalvm/eventapp/backend/templates/

ALL panel templates live in:  backend/templates/panel/
Chat templates nest one level: backend/templates/panel/chat/
EVERY template starts with:   {% extends "panel/base.html" %}
```

### URL → View → Template Triangle
```
1. confhub/urls.py mounts each app's admin routes under panel/:
       path('panel/', include('apps.checkins.admin_urls'))

2. apps/<app>/admin_urls.py declares routes WITHOUT the panel/ prefix:
       path('checkins/scanner/', admin_views.scanner_view, name='checkin_scanner')
   ⚠ Writing 'panel/checkins/scanner/' yields /panel/panel/... — classic bug

3. apps/<app>/admin_views.py renders:
       return render(request, 'panel/scanner.html', context)
```

### base.html — Permission-Gated Sidebar
Context processor `apps.accounts.context_processors.staff_permissions_context`
(registered in `settings.TEMPLATES`) runs on **every** render and injects:
```python
{'user_permissions': [...], 'is_super_admin': bool}
```

Every sidebar item wrapped:
```django
{% if is_super_admin or "checkin_scanner" in user_permissions %}
  <a href="/panel/checkins/scanner/" class="menu-item">Check-In Scanner</a>
{% endif %}
```

### ⚠️ Template Scripts Block — CRITICAL Django Rule
Django does **NOT allow** `{% block scripts %}` to appear twice inside `{% if %}/{% else %}`. Always put the `{% if %}` **inside** a single `{% block scripts %}`:

```django
{% block scripts %}
<script>
{% if mode == 'edit' %}
  // edit-mode JS
{% else %}
  // create-mode JS
{% endif %}
</script>
{% endblock %}
```

### Full Template Inventory (`backend/templates/panel/`)
```
base.html                     ← master layout, dynamic sidebar
login.html                    dashboard.html (live data)
participants_list.html        participants_upload.html
participants_preview.html     participant_add.html   participant_edit.html
checkin_list.html             scanner.html (⭐ v22 auto-poll + meal picker + push btn)
notifications.html            notification_edit.html
speakers_list.html            speaker_form.html
sponsors_list.html            sponsor_form.html
users_manage.html             events_list.html       event_form.html
conference_settings.html
password_reset_request.html   password_reset_confirm.html
schedule_list.html            schedule_form.html (⭐ v22 is_meal + category)
schedule_feedback.html        schedule_analytics.html
accepted_papers.html
leaderboard.html              photos.html
polls_list.html               poll_form.html         poll_results.html
ideathon.html
selfie_points.html
staff_permissions.html
call_logs.html
meal_pass_manage.html
chat/list.html                chat/thread.html       chat/requests.html
chat/reports.html             chat/analytics.html    chat/shakes.html
```

---

## 🌐 URL ROUTING — confhub/urls.py

```python
# ── Web Admin Panel ──
path('panel/', include('apps.accounts.admin_urls'))
path('panel/', include('apps.notifications.admin_urls'))
path('panel/', include('apps.checkins.admin_urls'))
path('panel/', include('apps.sponsors.admin_urls'))
path('panel/', include('apps.speakers.admin_urls'))
path('panel/', include('apps.chat.admin_urls'))
path('panel/', include('apps.schedule.admin_urls'))
path('panel/', include('apps.leaderboard.admin_urls'))
path('panel/', include('apps.photos.admin_urls'))
path('panel/', include('apps.polls.admin_urls'))
path('panel/', include('apps.posts.admin_urls'))

# ── Mobile API ──
path('api/v1/auth/',          include('apps.accounts.urls'))
path('api/v1/conferences/',   include('apps.conferences.urls'))
path('api/v1/events/',        include('apps.events.urls'))
path('api/v1/photos/',        include('apps.photos.urls'))
path('api/v1/polls/',         include('apps.polls.urls'))
path('api/v1/posts/',         include('apps.posts.urls'))
path('api/v1/checkins/',      include('apps.checkins.urls'))
path('api/v1/notifications/', include('apps.notifications.urls'))
path('api/v1/leaderboard/',   include('apps.leaderboard.urls'))
path('api/v1/sponsors/',      include('apps.sponsors.urls'))
path('api/v1/speakers/',      include('apps.speakers.urls'))
path('api/v1/schedule/',      include('apps.schedule.urls'))
path('api/v1/chat/',          include('apps.chat.urls'))

# WebSocket: wss://etd2026.iitd.ac.in/ws/call/?token=<jwt>
```

---

## ⭐ MEAL PASS SYSTEM 2.0 (v22 — Named Categories + Full Automation)

### The Complete Picture
```
┌─────────────────────────────────────────────────────────────┐
│         SCHEDULE (Source of Truth: ScheduleSession)         │
│  is_meal=True + meal_category='Lunch/Dinner/High Tea/       │
│                                Breakfast'                    │
│  Or fallback: title contains lunch/dinner/breakfast/tea     │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  sync_meal_window()  (apps/checkins/meal_utils.py)          │
│  Uses zoneinfo.ZoneInfo("Asia/Kolkata") for IST             │
│                                                               │
│  Triggered by:                                              │
│  • ⭐ Every GET /api/v1/notifications/unread-count/         │
│    (30s poll — runs across ENTIRE app, not just QR screen)  │
│  • Every GET /api/v1/checkins/meal/status/                  │
│  • Every GET /panel/checkins/meal-window-status/            │
│  • ⭐ On session create/edit in ScheduleAdmin (web + mobile)│
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  MealWindow (date=today, meal_type=named category)          │
│                                                               │
│  Safe query pattern (prevents MultipleObjectsReturned):     │
│    MealWindow.objects.filter(date=today).order_by('-id')    │
│                       .first()                              │
│                                                               │
│  RULES:                                                      │
│  • Inside scheduled slot → is_open=True (opened_by=None)   │
│    + push "🍽️ [Lunch/Dinner/etc] is now open!" (once)      │
│  • Outside all slots + no manual hold → is_open=False      │
│    + push "🛑 [Category] service is now closed" (once)      │
│  • MANUAL admin toggle → sets opened_by=<user>              │
│    → sync respects and does NOT auto-close                   │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  PARTICIPANT CHECK-IN GATE                                   │
│  Only users with CheckIn(checkin_type='conference')          │
│  can call POST /api/v1/checkins/meal/generate/               │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  MealPass Generation (per named category)                    │
│  UUID-based, one active pass per user per meal_type per day  │
│  Users can hold Lunch + Dinner + High Tea passes same day    │
│  QR displays "Lunch Pass" / "Dinner Pass" / etc dynamically  │
└─────────────────────────────────────────────────────────────┘
```

### Data Models
```python
# apps/schedule/models.py (⭐ NEW v22 fields)
class ScheduleSession(models.Model):
    is_meal       = BooleanField(default=False, help_text='Is this a meal service?')
    meal_category = CharField(max_length=50, blank=True,
                              help_text='Lunch, Dinner, High Tea, Breakfast')
    # ordering = ['day', 'start_datetime', 'display_order']  ← Fixed sort order

# apps/checkins/models.py
class MealPass:
    id, user (nullable), meal_type (named), date, is_active, used, used_at
    guest_name, guest_email, guest_phone, guest_reg_no

class MealWindow:
    id, date, meal_type (named), start_time, end_time, is_open,
    opened_by (nullable FK), closed_at, notified_opening, notified_closing
```

### Meal Utility Logic
```python
# apps/checkins/meal_utils.py
def deduce_meal_name(title):
    """Fallback name deducer for legacy sessions without is_meal flag."""
    t = (title or "").lower().strip()
    if "lunch" in t: return "Lunch"
    if "gala" in t or "dinner" in t: return "Dinner"
    if "high tea" in t or "tea" in t: return "High Tea"
    if "breakfast" in t: return "Breakfast"
    return "Meal"

def sync_meal_window():
    # 1. Get today's meal sessions (is_meal=True OR title fallback)
    # 2. Find currently active session (s0 <= now_ist <= s1)
    # 3. Determine name: session.meal_category if is_meal else deduce_meal_name
    # 4. Safe fetch: MealWindow.objects.filter(date=today).order_by('-id').first()
    # 5. If active → open + push (respect manual close override)
    # 6. If not active + not manually held → close + push
```

### Meal API Endpoints
```
# Mobile
GET    /api/v1/checkins/meal/status/         → window + pass (with meal_type name)
POST   /api/v1/checkins/meal/generate/       → gated by check-in
POST   /api/v1/checkins/meal/scan/           → verify QR
POST   /api/v1/checkins/meal/window/         → toggle (action + meal_type)
POST   /api/v1/checkins/meal/push/           → ⭐ NEW v22: re-broadcast push
GET    /api/v1/checkins/meal/stats/
GET    /api/v1/checkins/meal/list/
POST   /api/v1/checkins/meal-pass/create/    → walk-in guest + email QR
GET    /api/v1/checkins/meal-pass/mine/

# Web Admin
GET    /panel/checkins/scanner/              → scanner page
GET    /panel/checkins/meal-window-status/   → AJAX {meal:{...}}
POST   /panel/checkins/meal/window/          → AJAX toggle (action + meal_type)
POST   /panel/checkins/meal/push/            → ⭐ NEW v22: re-broadcast push
POST   /panel/checkins/meal/scan/            → AJAX scan
POST   /panel/checkins/meal-pass/            → walk-in guest pass
GET    /panel/checkins/stats/
```

### Web Admin Scanner (⭐ v22 Enhancements)
`templates/panel/scanner.html` now includes:
1. **5-second auto-polling** — `setInterval(updateMealStatus, 5000)` keeps
   UI live-synced with schedule and mobile-triggered changes.
2. **Meal Category Selector Modal** — "Open Service..." button opens modal
   with Lunch / Dinner / High Tea / Breakfast / Custom text input.
3. **"📢 Send Push Notification" button** — appears when window is open;
   re-broadcasts current meal notification.
4. **"Active Service: [Category]"** display above open/closed status.

### Mobile Admin CheckIn Screen (⭐ v22 Enhancements)
`mobile/src/screens/admin/CheckInScreen.js`:
1. **SelectMealTypeModal** — same 4 named categories + custom input.
2. **"📢 Send Push Notification" button** — appears when window is open.
3. **10-second auto-refresh** — `setInterval(loadMealStatus, 10000)`.
4. **Guest Pass Modal** — includes meal_type picker (Lunch/Dinner/etc).

### Mobile QR Screen (⭐ v22 Dynamic Naming)
`mobile/src/screens/QRScreen.js`:
- Displays **"Lunch Pass"** / **"Dinner Pass"** / **"High Tea Pass"** based
  on active `meal_type` from status API (no more generic "Meal Pass").
- Meal card unlocks Generate button only when window is open AND meal_type
  matches active service.

---

## 📰 FEED SYSTEM 2.0 (⭐ NEW v22 — Full Mobile Admin CRUD)

### Backend API Endpoints (`/api/v1/posts/`)
```
# Public / Participant
GET  /posts/feed/                                → paginated feed
POST /posts/feed/<uuid>/react/                   → toggle reaction
GET  /posts/feed/<uuid>/comments/                → list comments
POST /posts/feed/<uuid>/comments/                → add comment/reply

# ⭐ NEW v22 Admin API (role: super_admin, mgmt_admin, team_head, staff)
GET    /posts/admin/feed/                        → list ALL posts
POST   /posts/admin/feed/                        → create (multipart/form-data)
PATCH  /posts/admin/feed/<uuid>/                 → edit (partial fields)
DELETE /posts/admin/feed/<uuid>/                 → hard delete
GET    /posts/admin/feed/<uuid>/comments/        → list flattened comments
DELETE /posts/admin/feed/<uuid>/comments/<uuid>/ → moderate/delete comment
```

### Create Post Payload (multipart/form-data)
```
title           str  (required)
body            str  (required)
post_type       str  (general | alert | announcement | update)
pinned          bool
allow_comments  bool
send_push       bool  ← if True, immediately dispatches Expo push
image           File  ← accepts JPEG, PNG, MP4, MOV, M4V
```

### Push Notification Flow
```python
def _dispatch_feed_push(post, sent_by=None, request=None):
    # 1. Create Notification row (status='pending')
    notif = Notification.objects.create(
        title=f"📢 {post.title}",
        body=post.body[:240],
        data={'type': 'feed_post', 'screen': 'feed', 'post_id': str(post.id)},
        target_type='all', status='pending', sent_by=sent_by,
    )
    # 2. Dispatch: fcm.send_to_all(title=..., body=..., data=..., notif=notif, request=request)
    fcm.send_to_all(title=notif.title, body=notif.body, data=notif.data,
                    notif=notif, request=request)
    # 3. Notification.status auto-updates to 'sent' with sent_count/failed_count
```

### Mobile Feed Admin (`admin/FeedAdmin.js`)
Full-screen modal-based CRUD:
- **List View**: All posts with edit ✏️ + delete 🗑️ + "Manage X Comments" button
- **Create Modal**: Title, body, post_type chips, media picker (image/video),
  Pin to Top toggle, Allow Comments toggle, Send Push toggle
- **Edit Modal**: Same fields (no Send Push option — that's create-only)
- **Comment Moderation Modal**: List all comments (with replies), delete button
- **Media Support**: `expo-image-picker` with `MediaTypeOptions.All` for
  images + videos
- **Primary Action Button**: Big "Post to Feed" / "Update Post" button at
  bottom of form with brand color, plus secondary "Back to Feed Admin" link
- **⚠️ NEVER set `Content-Type` manually with FormData** — auto-generated
  boundary is required. `apiFetch()` handles this correctly.

### Public Feed Screen (⭐ v22 Video Support)
`mobile/src/screens/FeedScreen.js`:
- **Video Detection**: `item.image_url.match(/\.(mp4|mov|m4v)$/i)`
- **Video Preview**: Uses `<Video>` from `expo-av` with `isMuted` + play overlay
- **Full-Screen Media Viewer**: Tap image/video → dark modal with close button
- **"Read More" Toggle**: For posts with body > 120 chars, truncates to 3 lines
- **Compact Card Sizing**: Reduced from `xxl` to `xl` radius, 180px media height

---

## 🔔 PUSH NOTIFICATION SYSTEM (⭐ v22 — Flexible Dispatchers)

### `apps/notifications/fcm.py` — Universal Push Helpers

**Critical**: `send_to_all` signature is `(title, body, data, notif, request=None)`.
Various parts of the codebase call it with different arg patterns. All 5 dispatchers
handle both `notif`-object and positional-args patterns.

```python
def send_to_tokens(tokens, title, body, data=None, img=None):
    """Direct token list dispatch (used by admin_views)"""
    if not tokens: return 0, 0, []
    return _send_hybrid(tokens, title, body, data or {}, img)

def send_to_all(*args, **kwargs):
    """
    Supports both patterns:
    1) send_to_all(notif, request=None)
    2) send_to_all(title, body, data, notif, request=None)
    """
    # Detects notif-object arg vs positional args, dispatches to _send_hybrid,
    # updates notif.status/sent_count/failed_count

def send_to_role(role, title, body, data, notif=None, request=None):
    """Send to users filtered by role"""

def send_to_user(user, title, body, data=None, notif=None, request=None):
    """⭐ NEW v22: Single user push (was missing, caused import errors)"""

def send_notification(notif, request=None):
    """Wrapper — dispatches to send_to_all/role/user based on notif.target_type"""
```

### Expo Push Delivery (via IITD Proxy)
```python
def _send_expo(tokens, title, body, data, img=None):
    proxies = {
        'http': 'http://proxy21.iitd.ac.in:3128',
        'https': 'http://proxy21.iitd.ac.in:3128',
    }
    session = requests.Session()
    session.verify = False  # IITD SSL bypass
    import urllib3; urllib3.disable_warnings()
    
    resp = session.post(EXPO_URL, json=msgs, proxies=proxies, timeout=30)
    # Parse tickets, extract DeviceNotRegistered errors → bad_tokens list
    # Return (success_count, failed_count, bad_tokens)
```

### `apps/notifications/views.py` — Complete View Inventory
```python
unread_count(request)          # GET  ← ⭐ triggers sync_meal_window() every 30s
my_notifications(request)      # GET
register_token(request)        # POST ← ⭐ v22 restored
register_device_token(request) # POST alias
unregister_token(request)      # POST
mark_read(request)             # POST
mark_all_read(request)         # POST
send_notification(request)     # POST (staff-only)
notification_history(request)  # GET  (staff-only)
notification_detail(request, pk) # GET
```

### Mobile `notifications.js` (⭐ v22 SDK 54 Compliance)
```javascript
// SDK 54 handler flags:
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,      // legacy
    shouldShowBanner: true,     // ⭐ SDK 54 new
    shouldShowList: true,       // ⭐ SDK 54 new
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Android channels
await Notifications.setNotificationChannelAsync('default', {
  name: 'General Notifications',
  importance: Notifications.AndroidImportance.MAX,
  vibrationPattern: [0, 250, 250, 250],
  lightColor: '#1856FF',
});
await Notifications.setNotificationChannelAsync('chat', {
  name: 'Chat & Messages',
  importance: Notifications.AndroidImportance.HIGH,
  vibrationPattern: [0, 100, 100, 100],
  lightColor: '#7C3AED',
});

// ⭐ v22 Exports (all 3 exported to prevent "not a function" errors):
export async function registerForPushNotificationsAsync() { ... }
export const registerForPushNotifications = registerForPushNotificationsAsync;
export function setupNotificationListeners(onReceived, onResponse) { ... }
export async function sendLocalNotification(title, body, data = {}) { ... }
```

### Deep-Link Data Payloads
```json
{"type": "meal_pass", "screen": "qr"}
{"type": "new_message", "conversation_id": "..."}
{"type": "connection_request"}
{"type": "feed_post"}              ← ⭐ v22 opens Feed tab
{"type": "session_reminder", "session_id": "..."}
{"type": "checkin_success"}
{"type": "voice_call", "caller_name": "..."}
{"type": "ideathon_invite", "team_id": "..."}
{"type": "ideathon_join_request", "team_id": "..."}
{"type": "join_request_approved", "team_id": "..."}
{"type": "join_request_declined"}
```

---

## 📅 SCHEDULE MANAGEMENT (⭐ v22 — is_meal + meal_category)

### Model Changes
```python
# apps/schedule/models.py
class ScheduleSession(models.Model):
    # ... existing fields ...
    is_meal         = BooleanField(default=False)     # ⭐ NEW v22
    meal_category   = CharField(max_length=50, blank=True)  # ⭐ NEW v22
    
    class Meta:
        # ⭐ Fixed sort order: start_datetime BEFORE display_order
        ordering = ['day', 'start_datetime', 'display_order']
```

### Web Admin (`schedule_form.html`)
New "Is Meal Service?" checkbox with slide-down category selector:
```html
<label>
  <input type="checkbox" name="is_meal" id="is_meal_check"
         onchange="toggleMealCategory()">
  🍽️ Is Meal Service?
</label>

<div id="meal_category_div" style="display:none;">
  <select name="meal_category">
    <option value="Lunch">Lunch</option>
    <option value="Dinner">Dinner</option>
    <option value="High Tea">High Tea</option>
    <option value="Breakfast">Breakfast</option>
  </select>
</div>

<!-- ⚠️ CRITICAL: block scripts must NOT appear twice in if/else -->
{% block scripts %}
<script>
  function toggleMealCategory() { ... }
  {% if mode == 'edit' %}
    // edit-mode JS
  {% endif %}
</script>
{% endblock %}
```

### Mobile Admin (`admin/ScheduleAdmin.js`)
New "🍽️ Is Meal Service" toggle with animated meal category chip picker:
```javascript
const MEAL_CATEGORIES = [
  { value: 'Lunch', label: 'Lunch' },
  { value: 'Dinner', label: 'Dinner' },
  { value: 'High Tea', label: 'High Tea' },
  { value: 'Breakfast', label: 'Breakfast' },
];

// In session save payload:
body = {
  // ... existing fields ...
  is_meal: isMeal,
  meal_category: mealCategory,
}
```

### `admin_views.py` — Session Create/Edit Sync
```python
def session_create(request):
    if request.method == 'POST':
        sess = ScheduleSession.objects.create(
            # ... all fields ...
            is_meal=request.POST.get('is_meal') == 'on',
            meal_category=request.POST.get('meal_category', 'Lunch').strip(),
        )
        try:
            sync_meal_window()  # ⭐ v22: Immediate meal window evaluation
        except Exception:
            pass
        return redirect('schedule_edit', pk=sess.pk)
```

---

## 🏠 HOME TAB LOGIC (⭐ v22 — Day Calc from Live Sessions)

### The Bug We Fixed
Old logic: `confDay(conf.start_date)` was hardcoded from `conf.start_date`,
causing "Day 19 of 3" glitch after schedule date migration.

### New Logic (`HomeTab.js`)
```javascript
// Derive current day + progress from LIVE schedule sessions, NOT conf.start_date
const firstSession = allSorted[0];
const lastSession = allSorted[allSorted.length - 1];

const confStartMs = firstSession ? getEventDate(firstSession, 'start')?.getTime() : ...;
const confEndMs = lastSession ? getEventDate(lastSession, 'end')?.getTime() : ...;

const total = Math.max(...allSorted.map(e => Number(e.day) || 1));

// Active day = day of live session, OR day of next upcoming session
const activeDayIndex = liveSession ? Number(liveSession.day)
                     : nextSession ? Number(nextSession.day)
                     : (nowMs >= confEndMs ? total : 1);

// Progress bar mode when live session is happening (not countdown)
if (liveSession) {
  mode = 'progress';
  progress = Math.round(((nowMs - confStartMs) / (confEndMs - confStartMs)) * 100);
}
```

### Progress/Countdown Logic (Math Formula)
```
Progress % = ((Now - Conference_Start) / (Conference_End - Conference_Start)) × 100

Phase 1: Now < Conf_Start          → mode='countdown', target=first_session_start
Phase 2: Conf_Start ≤ Now ≤ Conf_End
         ├─ liveSession exists     → mode='progress'
         ├─ nextSession same day   → mode='countdown', target=next_session_start
         └─ nextSession next day   → mode='countdown', target=next_day_first_session
Phase 3: Now > Conf_End            → mode='progress', progress=100%
```

---

## 📅 SCHEDULE TAB (⭐ v22 — Auto-Refresh + Dates)

`mobile/src/screens/ScheduleTab.js` improvements:
```javascript
const TABS = [
  { key: 1, label: 'Day 1', date: 'Sep 18' },  // ⭐ v22 dates
  { key: 2, label: 'Day 2', date: 'Sep 19' },
  { key: 3, label: 'Day 3', date: 'Sep 20' },
  { key: 'bookmarks', label: '❤️', date: 'Saved' },
];

// ⭐ v22: Auto-refresh every 20s + pull-to-refresh
useEffect(() => {
  seedFromCache().then(() => fetchAll(true));
  const timer = setInterval(() => fetchAll(true), 20000);
  return () => clearInterval(timer);
}, [seedFromCache, fetchAll]);

// ⚠️ DO NOT USE useFocusEffect from @react-navigation/native
//    This app does NOT use React Navigation. Import will fail bundle.
```

Pull-to-refresh:
```javascript
<ScrollView
  refreshControl={<RefreshControl
    refreshing={refreshing}
    onRefresh={() => { setRefreshing(true); fetchAll(true); }}
    tintColor={COLORS.brand}
  />}
>
```

---

## 🛠️ SCHEDULE DATE MIGRATION HELPER (v22 Testing Tool)

For quickly rebasing all sessions to test dates without wiping DB:

### `backend/update_schedule_dates.py`
```python
import os, sys, django
from datetime import date
sys.path.append('/home/baadalvm/eventapp/backend')
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "confhub.settings")
django.setup()

from apps.schedule.models import ScheduleSession
from apps.checkins.meal_utils import sync_meal_window

date_mapping = {
    1: date(2026, 9, 18),
    2: date(2026, 9, 19),
    3: date(2026, 9, 20),
}
# OR for "today" dynamic testing:
# from datetime import timedelta
# today = date.today()
# date_mapping = {1: today, 2: today + timedelta(days=1), 3: today + timedelta(days=2)}

for session in ScheduleSession.objects.all():
    day_num = int(session.day)
    if day_num in date_mapping:
        target = date_mapping[day_num]
        if session.start_datetime:
            session.start_datetime = session.start_datetime.replace(
                year=target.year, month=target.month, day=target.day)
        if session.end_datetime:
            session.end_datetime = session.end_datetime.replace(
                year=target.year, month=target.month, day=target.day)
        session.save()

sync_meal_window()
```

Run: `cd backend && python3 update_schedule_dates.py`

---

## 🔐 AUTH & RBAC

```
ROLES: participant, attendee, speaker,
       super_admin, mgmt_admin, team_head, staff
ADMIN_ROLES = ('super_admin', 'mgmt_admin', 'team_head', 'staff')

22 ASSIGNABLE MODULES (StaffPermission.MODULE_CHOICES):
  MANAGEMENT   participants, ideathon, meal_scanner, checkin_scanner
  CONTENT      schedule, papers, photos, checkpoint, feed
  ENGAGEMENT   polls, qa_manager, leaderboard, chat, reported_messages,
               shake_logs, chat_analytics
  SYSTEM       notifications, sponsors, speakers, users_manage,
               reports, settings

ENFORCEMENT
  Web view:     @module_required('key')
  DRF view:     @api_module_required('key')
  Web template: {% if is_super_admin or "key" in user_permissions %}
  Mobile:       AdminTab filters ALL_FEATURES by user.permissions[]
```

---

## 📊 DATABASE — KEY TABLES

```
users, staff_profiles, staff_permissions
checkins, meal_passes, meal_windows
notifications_devicetoken, notifications_notification,
  notifications_usernotification
point_entries, user_points
photos, photo_settings, selfie_points, selfie_submissions
sponsors_sponsor, speakers_speaker
schedule_schedulesession    ← ⭐ v22: +is_meal (bool), +meal_category (str),
                              ordering=['day','start_datetime','display_order']
schedule_schedulesubsession, schedule_acceptedpaper
polls_poll, polls_polloption, polls_vote
polls_ideathonconfig, polls_ideathoninterest, polls_ideathonteam,
  polls_ideathonmember, polls_ideathoninvite, polls_ideathonjoinrequest
chat_connectionrequest, chat_conversation, chat_message,
  chat_messagereaction, chat_messagereport, chat_blockeduser,
  chat_shakelog, chat_staffgroupmessage, chat_callsession
posts_feedpost (⭐ image FileField now accepts video), posts_feedcomment,
  posts_feedreaction
```

---

## 🔑 TEST CREDENTIALS

```
MOBILE + WEB
  participant@test.com / Test@1234
  speaker@test.com     / Test@1234
  test@test.com        / 12345678       (staff, has checkin_scanner)
  Dummy: firstname.lastname@test.com / Test@1234 (100 users)

STAFF (seed_staff.py — 18 records)
  hodlibrary@admin.iitd.ac.in  / Librarian@123  (team_head)
  neerajkc@library.iitd.ac.in  / Officer@123    (team_head)
  gunjan0605@library.iitd.ac.in/ Staff@123      (staff)

WEB ADMIN — https://etd2026.iitd.ac.in/panel/login/
  etd@admin.iitd.ac.in (super_admin)
```

---

## 🎨 theme.js — DESIGN TOKENS

```javascript
// FONT is FLAT (not nested)
FONT.micro  FONT.xs  FONT.sm  FONT.base  FONT.md
FONT.lg  FONT.xl  FONT.xxl  FONT.xxxl  FONT.hero
FONT.w4  FONT.w5  FONT.w6  FONT.w7  FONT.w8  FONT.w9

// COLORS
COLORS.brand  COLORS.brandDeep  COLORS.brandDark  COLORS.brandLight
COLORS.bg  COLORS.text  COLORS.textSec  COLORS.textTer  COLORS.textInverse
COLORS.border  COLORS.borderLight
COLORS.success  COLORS.error  COLORS.warning  COLORS.accent  COLORS.accentDark
COLORS.rose  COLORS.purple  COLORS.teal  (+ *Light variants)

// SPACE, RADIUS, SHADOW — standard tokens
// fixMediaUrl(url) — resolves relative media URLs via API_ROOT

// Auto-switching API URL
const DEV_API_URL  = 'http://10.17.9.48:8000/api/v1';
const PROD_API_URL = 'https://etd2026.iitd.ac.in/api/v1';
export const API_URL = __DEV__ ? DEV_API_URL : PROD_API_URL;
```

⚠️ NEVER write `FONT.size.lg` — FONT is flat.
⚠️ NEVER write `COLORS.warning-dark` — JS reads as subtraction.

---

## 🏠 HOME TAB QUICK ACTIONS

```javascript
const QUICK_ITEMS = [
  { label: 'Speakers',        action: 'speakers'    },
  { label: 'Leaderboard',     action: 'leaderboard' },
  { label: 'Papers/Posters',  action: 'papers'      },
  { label: 'Sponsors',        action: 'sponsors'    },
  { label: 'Checkpoint',      action: 'checkpoint'  },
  { label: 'Live Polls',      action: 'polls'       },
  { label: 'Ideathon',        action: 'ideathon'    },
  { label: 'Events Team',     action: 'staff_team'  },
  { label: 'Photo Gallery',   action: 'photos'      },  // Under "More"
];
```

---

## 🎛️ MOBILE ADMIN TAB — 10 Feature Cards

```javascript
const ALL_FEATURES = [
  { key: 'checkin',          perm: 'checkin_scanner' },
  { key: 'notifications',    perm: 'notifications'   },
  { key: 'feed_admin',       perm: 'feed'            },  // ⭐ v22
  { key: 'add_participant',  perm: 'users_manage'    },
  { key: 'users',            perm: 'users_manage'    },
  { key: 'staff_admin',      perm: 'users_manage'    },
  { key: 'schedule',         perm: 'schedule'        },
  { key: 'photos',           perm: 'photos'          },
  { key: 'polls_admin',      perm: 'polls'           },
  { key: 'papers',           perm: 'papers'          },
  { key: 'ideathon_admin',   perm: 'ideathon'        },
];
```

**⚠️ CRITICAL:** Every feature object MUST have `grad: ['#hex1', '#hex2']`.

---

## ⚠️ CRITICAL PATTERNS — DO NOT BREAK

### Apache / Reverse Proxy
```
✓ ALWAYS `apache2ctl configtest` before reload
✓ ALWAYS `systemctl reload apache2` (not restart)
✓ ALWAYS keep wordpress.conf.bak for rollback
✓ ALWAYS pass X-Forwarded-Proto "https"
✓ ALWAYS use ProxyPreserveHost On
✗ NEVER edit /etc/ssl/* — SSL at IITD Central Gateway
```

### Backend (Django)
```
✗ NEVER expect Gunicorn to hot-reload — restart always
✗ NEVER use `MealWindow.objects.get_or_create(date=today)` — throws
  MultipleObjectsReturned. Use .filter(date=today).order_by('-id').first()
✗ NEVER call fcm.send_to_all(notif) with only 1 positional arg unless
  the dispatcher supports it (v22 dispatcher handles both patterns)
✗ NEVER prefix admin_urls.py routes with 'panel/'
✗ NEVER use `python` — this VM has `python3`
✗ NEVER use `created_at` on CheckIn — it's `scanned_at`
✗ NEVER assume django.contrib.admin — this is hand-rolled MVT
✗ NEVER put `{% block scripts %}` twice in if/else — Django error
✗ NEVER call fcm.send_to_tokens without defining it — must exist in fcm.py

✓ ALWAYS use timezone.now().astimezone(IST) for meal logic
✓ ALWAYS trigger sync_meal_window() in schedule create/edit endpoints
✓ ALWAYS include sync_meal_window() in unread_count for 30s poll
✓ ALWAYS check is_checked_in before allowing meal pass generation
✓ ALWAYS restart gunicorn after .py changes
✓ ALWAYS cd into backend/ before Django commands
✓ ALWAYS use `python3 << 'EOF'` (single quotes) for JS/HTML heredocs
  to prevent bash from intercepting `!`, `$`, backticks
```

### Templates
```
✓ Everything extends "panel/base.html"
✓ DIRS = [BASE_DIR / 'templates'] → backend/templates/
✓ Chat templates live in templates/panel/chat/
✓ Every sidebar item is permission-wrapped
✗ Never add |safe to user-supplied values
✗ Never put content into {% block title %} beyond title text
✗ Never put {% block scripts %} inside a raw {% if %}/{% else %} —
  wrap the {% if %} INSIDE a single {% block scripts %}
```

### Mobile
```
✗ Never downgrade Expo SDK (locked at 54)
✗ Never run expo from root dir (always cd mobile/)
✗ Never add expo-router / React Navigation / TypeScript
✗ Never import from @react-navigation/native — NOT INSTALLED
  (this app uses custom high-perf tab router in MainApp.js)
✗ Never call hooks inside FlatList renderItem
✗ Never set Content-Type manually with FormData
✗ Never write FONT.size.lg — FONT is FLAT
✗ Never write COLORS.warning-dark
✗ Never nest FlatList in same-direction ScrollView
✗ Never require('react-native-webrtc') before NativeModules check
✗ Never show meal QR when window is closed
✗ Never omit `grad: ['#a', '#b']` from ALL_FEATURES entries
✗ Never use only `shouldShowAlert` in SDK 54 — must include
  shouldShowBanner + shouldShowList to avoid deprecation warnings
✗ Never assume `registerForPushNotifications` exists — export it as
  alias to `registerForPushNotificationsAsync` in notifications.js

✓ apiFetch() for authenticated calls (auto JWT refresh)
✓ For checkins/meal endpoints: raw fetch + authHeaders(tokens) pattern
✓ QRCodeSVG: guard with String(value || 'ETD-2026')
✓ FlatList keyExtractor: (item, idx) fallback
✓ Always import Platform from 'react-native' if using Platform.OS
✓ Use KeyboardAvoidingView wrapping modal forms
✓ Use __DEV__ ternary to switch API URLs automatically
✓ Use BackHandler subscription pattern:
   const sub = BackHandler.addEventListener('hardwareBackPress', fn);
   return () => sub.remove();
✓ For PDF/document upload: expo-document-picker
✓ For media (image+video) upload: expo-image-picker with MediaTypeOptions.All
✓ Always safe-fallback filter arrays: (ARR || []).filter(...)
✓ For auto-refresh: setInterval in useEffect with cleanup
✓ For pull-to-refresh: <RefreshControl refreshing={r} onRefresh={fn} />
```

### IITD Proxy
```
✗ No ngrok / cloudflared / tunnels
✓ npm: NODE_TLS_REJECT_UNAUTHORIZED=0 <cmd> --strict-ssl=false
✓ pip: --break-system-packages
✓ curl to VM: --noproxy "*"
✓ curl to public HTTPS domain: -k (bypasses IITD SSL inspection)
✓ Python to VM: build_opener(ProxyHandler({}))
✓ Expo Push: routes through proxy with verify=False
```

### Bash / Shell Scripting for File Edits
```
✗ NEVER use `python3 -c "..."` with double quotes for JS/HTML content
   — bash intercepts `!`, `$`, backticks. Use `python3 << 'EOF'`.
✓ Use single-quoted heredoc: python3 << 'EOF' ... EOF
✓ For simple sed replacements: sed -i 's|old|new|g' file
✓ Always verify with `grep -n` after mutation
✓ Never edit the same file twice with regex — check for duplicate insertions
```

### Cron / Server Auto-Healing (⭐ NEW v22)
```
✗ NEVER assume cron has full PATH — export PATH explicitly in scripts
✗ NEVER use plain `gunicorn` in cron — use full path or export PATH
✓ ALWAYS test with: pkill -9 -f gunicorn && sleep 60 && ps aux | grep gunicorn
  (should show gunicorn back up)
✓ ALWAYS include @reboot entry for reboot recovery
✓ ALWAYS log to server.log so you can trace auto-restarts
```

---

## ✅ WHAT IS WORKING (COMPLETE)

```
✅ JWT Auth (access + refresh, no rotation)
✅ Email login, password reset via IITD SMTP
✅ Role-based access (7 roles, 22 modules)
✅ Web admin panel (Django MVT, permission-gated sidebar)
✅ Participant management (CSV upload, add/edit/preview)
✅ Conference settings
✅ Schedule management (CRUD + is_meal + meal_category)
✅ Speaker + Sponsor management
✅ Photo gallery (upload + approval + selfie points)
✅ Polls (create/vote/results)
✅ Leaderboard (point system)
✅ Push notifications (Expo Push via IITD proxy)
✅ Deep-link routing from notifications
✅ Chat (1:1 + connection requests + reactions + reports)
✅ Staff group chat
✅ Voice calls (WebRTC — marked for removal)
✅ Shake-to-connect
✅ Feed/posts (⭐ v22: full CRUD, videos, comment moderation)
✅ Checkpoint/selfie submissions (Google Maps tiles)
✅ QR generation + scanning (check-in + meal passes)
✅ Meal Pass System 2.0 (⭐ v22 named categories, dynamic naming,
   Send Push button, 30s background sync, real-time web scanner)
✅ Home Tab countdown/progress derived from LIVE sessions
✅ QR Screen with dynamic meal name display
✅ Ideathon System (interest, team CRUD, invites, join requests,
   leadership transfer)
✅ Papers/Posters System (public + admin CRUD, PDF upload)
✅ Public HTTPS domain: https://etd2026.iitd.ac.in
✅ Apache reverse proxy: WordPress + Django coexist
✅ Auto DEV/PROD API switching in mobile app
✅ Metro bundler accessible via public domain
✅ Zero-downtime Apache reloads with configtest safety
✅ Emergency 10-second rollback via wordpress.conf.bak

⭐ NEW IN v22:
✅ Schedule Model: is_meal + meal_category fields
✅ Web Admin ScheduleForm: Is Meal Service checkbox + category picker
✅ Mobile ScheduleAdmin: Is Meal toggle + category chips
✅ Named Meal Categories: Lunch, Dinner, High Tea, Breakfast, Custom
✅ Multiple Meal Passes per Day: Users can hold Lunch + Dinner + Tea
✅ 30-Second Background Meal Sync: unread-count triggers sync_meal_window
✅ Auto-Sync on Schedule Save: session_create/edit call sync_meal_window
✅ Web Admin Scanner 5s Auto-Poll: Real-time meal status without refresh
✅ Web Admin Meal Category Selector Modal
✅ Web Admin "📢 Send Push Notification" button
✅ Mobile Admin Meal Type Selector Modal
✅ Mobile Admin "📢 Send Push Notification" button
✅ Mobile QR Screen: Dynamic "Lunch Pass"/"Dinner Pass"/etc labels
✅ Home Tab: Day calc from actual live sessions (not conf.start_date)
✅ Home Tab: Correctly shows "Day 2 of 3" (fixed "Day 19 of 3" glitch)
✅ Schedule Tab: Sep 18/19/20 dates, 20s auto-refresh, pull-to-refresh
✅ Schedule Sort Order: ['day', 'start_datetime', 'display_order']
✅ Feed Admin (Mobile): Full CRUD, image + video upload, comment moderation
✅ Feed Screen: Video detection + full-screen media viewer + Read More
✅ Feed Push Notifications: Send Push toggle on create, immediate delivery
✅ FCM Dispatchers: send_to_all, send_to_role, send_to_user, send_to_tokens,
   send_notification — all support both notif-object and positional patterns
✅ Notifications Views: register_token, unregister_token, mark_read,
   mark_all_read, send_notification, notification_history, notification_detail
✅ SDK 54 Notification Handler: shouldShowBanner + shouldShowList flags
✅ notifications.js: registerForPushNotifications alias exported
✅ MealWindow Safe Query: .filter(date).order_by('-id').first()
   (prevents MultipleObjectsReturned)
✅ Django Template scripts block fix: {% if %} INSIDE {% block scripts %}
✅ Cron Watchdog (@reboot + every 60s): Auto-restarts Gunicorn if dead
✅ PATH Export in start_server.sh and keep_alive.sh: Cron finds gunicorn
✅ Schedule Date Migration Script: update_schedule_dates.py
✅ ScheduleTab: Removed @react-navigation/native import (not installed)
```

## ❌ WHAT IS NEXT / PENDING

```
❌ Remove WebRTC / voice call code (marked for removal)
❌ Migrate expo-av → expo-audio (deprecated in SDK 54)
❌ SDK 54 → SDK 57 upgrade (after WebRTC + expo-av removed)
❌ iOS EAS Development Build
❌ systemd unit for start_server.sh (currently nohup + cron watchdog)
❌ Nginx caching layer (optional — Apache handles fine)
❌ Home Tab "Conference Pulse" live stats widget
❌ Speaker Connect post-session banner
❌ Sponsor stall live foot-traffic heatmap
❌ Post-approval celebration modal with confetti
❌ Per-user push on selfie point approval
❌ Per-module auto-groups for staff chat
❌ Force password change on first login for staff
❌ Single-flight refresh mutex in api.js (re-enable JWT rotation)
❌ Assign meal passes to registered users from mobile admin
❌ Time picker for meal schedule on mobile
❌ Production APK build + Play Store submission
❌ NEW FEATURES (to be discussed in next chat)
```

---

## 🤝 WORKING AGREEMENT

```
Cycle: diagnose → ASK FOR EXISTING CODE if unsure → assess →
       generate code → deliver → if error → get error → assess → repeat

Rules:
  • ALWAYS ask for existing code before changes to unknown files
  • ALWAYS run: cat/grep/head to inspect BEFORE modifying
  • YAGNI first. Reuse existing helpers. stdlib > installed dep > new code
  • Deletion over addition. Boring over clever. Shortest working diff
  • Bug fix = root cause, not symptom
  • No new dependency if avoidable
  • No abstractions not requested
  • Fewest files possible
  • Mark deliberate simplifications with ceiling comment
  • Non-trivial logic leaves ONE runnable check behind
  • Give code in `cat << 'EOF' > path` or `python3 << 'EOF'` heredoc blocks
  • Always include restart command for backend changes
  • For Apache changes: configtest → reload (never restart)
  • Assume Website VM = 10.17.5.38, App VM = 10.17.9.48
  • Mobile file changes: ONLY `/home/baadalvm/eventapp/mobile/src/`
  • For JS edits via Python: always use `python3 << 'EOF'` (single quotes)
  • For every feature array entry (mobile), ensure ALL required props
    (grad, perm, key, icon, label) are present to prevent runtime crashes
  • For Django ScheduleSession changes: run migrations AND restart Gunicorn
  • For MealWindow queries: always use .filter().order_by('-id').first()
  • For cron scripts: always export PATH explicitly
  • For SDK 54 notifications: include shouldShowBanner + shouldShowList
  • For fcm.py updates: verify send_to_tokens + send_to_user exist
```

---

## 📚 GIT

```
Remote: https://github.com/Sharma1907/eventapp
Branch: main
```

---

## 🔧 QUICK TROUBLESHOOTING REFERENCE

### "Delivered: 0, Status: failed" on push
- Check `apps/notifications/fcm.py` has `send_to_tokens`, `send_to_all`,
  `send_to_role`, `send_to_user`, `send_notification` — all 5 must exist.
- Verify `send_to_all` accepts both `(notif)` and `(title, body, data, notif)`.

### "cannot import name 'X' from 'apps.notifications.views'"
- `views.py` must export: `unread_count`, `my_notifications`, `register_token`,
  `register_device_token`, `unregister_token`, `mark_read`, `mark_all_read`,
  `send_notification`, `notification_history`, `notification_detail`.

### "MealWindow.MultipleObjectsReturned"
- Replace `.get_or_create(date=today)` with `.filter(date=today).order_by('-id').first()`
- Clean duplicates: `MealWindow.objects.filter(date=today).order_by('id')[:-1].delete()`

### Push notification arrives only when opening QR Screen
- Verify `apps/notifications/views.py::unread_count` calls `sync_meal_window()`.
- Verify mobile app polls `/notifications/unread-count/` every 30s globally.

### "Cannot resolve @react-navigation/native"
- Remove `import { useFocusEffect } from '@react-navigation/native';`
- Use `useEffect(() => { const t = setInterval(...); return () => clearInterval(t); }, [])`

### Cron watchdog logs "gunicorn: not found"
- Add `export PATH="/home/baadalvm/.local/bin:..."` at top of both
  `start_server.sh` and `keep_alive.sh`.

### `{% block 'scripts' %}` appears more than once
- Move `{% if mode == 'edit' %}` INSIDE the `{% block scripts %}` tag.

### "shouldShowAlert is deprecated" warning
- In `mobile/src/notifications.js` add both `shouldShowBanner: true` and
  `shouldShowList: true` to `setNotificationHandler`.

### "0, _srcNotifications.registerForPushNotifications is not a function"
- Export alias: `export const registerForPushNotifications = registerForPushNotificationsAsync;`



Task:
We need to fix the profile screen 
1. Mandatory to add the Research Intrest min 3 max 5, Prompt user whenever they open the My Profile page so that they will add research interest 
2. The profile filling score is so unlogical like every field in the profile have a number given after filling like adding research intreset adding bio adding linkding like wise; currently if i just add a bio (only few letters) it show the profile complete and give the points. Fix its logic and maths 
3. There are many links in the profile page which take user to no where remove all those links which are not linked to the anyone.
4. There is one screen in the my account page which is Conference Memeory This screen is not working perfectly like if i earn a point it wont show and other stats arent coming form the real soruce of truth and this screen is linked at the My Profile screen named My Recap.
5. Keep the certificate we make soemthing out of it 
6. The ui is very dull and boring make it interesting try to add some more interactive animated elemets we already have libraries like react native reanimated use it make it more intersting and engaging.

Important!!: We code in this cycle diagnose > get code from me if needed > assess > gen code accordingly > give to me > if any error > get code / error > assess .....and repeat

You are a lazy senior developer. Lazy means efficient, not careless. The best code is the code never written.

Before writing any code, stop at the first rung that holds:

Does this need to be built at all? (YAGNI)
Does it already exist in this codebase? Reuse the helper, util, or pattern that's already here, don't re-write it.
Does the standard library already do this? Use it.
Does a native platform feature cover it? Use it.
Does an already-installed dependency solve it? Use it.
Can this be one line? Make it one line.
Only then: write the minimum code that works.
The ladder runs after you understand the problem, not instead of it: read the task and the code it touches, trace the real flow end to end, then climb.

Bug fix = root cause, not symptom: a report names a symptom. Grep every caller of the function you touch and fix the shared function once — one guard there is a smaller diff than one per caller, and patching only the path the ticket names leaves a sibling caller still broken.

Rules:

No abstractions that weren't explicitly requested.
No new dependency if it can be avoided.
No boilerplate nobody asked for.
Deletion over addition. Boring over clever. Fewest files possible.
Shortest working diff wins, but only once you understand the problem. The smallest change in the wrong place isn't lazy, it's a second bug.
Question complex requests: "Do you actually need X, or does Y cover it?"
Pick the edge-case-correct option when two stdlib approaches are the same size, lazy means less code, not the flimsier algorithm.
Mark deliberate simplifications that cut a real corner with a known ceiling (global lock, O(n²) scan, naive heuristic) with a ponytail: comment naming the ceiling and upgrade path.
Not lazy about: understanding the problem (read it fully and trace the real flow before picking a rung, a small diff you don't understand is just laziness dressed up as efficiency), input validation at trust boundaries, error handling that prevents data loss, security, accessibility, the calibration real hardware needs (the platform is never the spec ideal, a clock drifts, a sensor reads off), anything explicitly requested. Lazy code without its check is unfinished: non-trivial logic leaves ONE runnable check behind, the smallest thing that fails if the logic breaks (an assert-based demo/self-check or one small test file; no frameworks, no fixtures). Trivial one-liners need no test.

Use these vars for UI:
import { Platform, Dimensions } from 'react-native';

export const W = Dimensions.get('window').width;
export const H = Dimensions.get('window').height;

export const COLORS = {
  brand:         '#0333b6',
  brandDark:     '#022a8f',
  brandDeep:     '#0F172A',
  brandDeeper:   '#070614',
  brandLight:    '#e8eeff',
  brandMid:      'rgba(3,51,182,0.10)',
  primary:       '#0333b6',
  primaryLight:  '#e8eeff',
  danger:        '#ef4444',
  accent:        '#f59e0b',
  accentDark:    '#d97706',
  accentLight:   '#fef3c7',
  accentMid:     'rgba(245,158,11,0.15)',
  bg:            '#f0f4f9',
  bgAlt:         '#eef2f6',
  bgCard:        '#e6ebf5',
  surface:       '#FFFFFF',
  glass:         'rgba(255,255,255,0.14)',
  glassBorder:   'rgba(255,255,255,0.22)',
  success:       '#10b981',
  successLight:  '#d1fae5',
  error:         '#ef4444',
  errorLight:    '#fee2e2',
  warning:       '#f59e0b',
  warningLight:  '#fef3c7',
  purple:        '#8b5cf6',
  purpleLight:   '#ede9fe',
  teal:          '#14b8a6',
  tealLight:     '#ccfbf1',
  rose:          '#f43f5e',
  roseLight:     '#ffe4e6',
  text:          '#0F172A',
  textSec:       '#475569',
  textTer:       '#94a3b8',
  textInverse:   '#FFFFFF',
  textMuted:     '#cbd5e1',
  border:        '#e2e8f0',
  borderLight:   '#f1f5f9',
  textblack:     '#000',
};

export const FONT = {
  micro: 9, xs: 11, sm: 13, base: 15, md: 16,
  lg: 18, xl: 22, xxl: 26, xxxl: 32, hero: 40,
  w4: '400', w5: '500', w6: '600', w7: '700', w8: '800', w9: '900',
};

export const SPACE = {
  xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, huge: 48,
};

export const RADIUS = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, xxxl: 36, full: 999,
};

export const SHADOW = {
  none: {},
  sm: Platform.select({
    ios: { shadowColor: '#0F172A', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4 },
    android: { elevation: 0 },
    default: {},
  }),
  md: Platform.select({
    ios: { shadowColor: '#0F172A', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.07, shadowRadius: 8 },
    android: { elevation: 0 },
    default: {},
  }),
  lg: Platform.select({
    ios: { shadowColor: '#0F172A', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.10, shadowRadius: 16 },
    android: { elevation: 0 },
    default: {},
  }),
  xl: Platform.select({
    ios: { shadowColor: '#0F172A', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.14, shadowRadius: 24 },
    android: { elevation: 0 },
    default: {},
  }),
  brand: Platform.select({
    ios: { shadowColor: '#0333b6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.30, shadowRadius: 12 },
    android: { elevation: 0 },
    default: {},
  }),
  accent: Platform.select({
    ios: { shadowColor: '#f59e0b', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.28, shadowRadius: 10 },
    android: { elevation: 0 },
    default: {},
  }),
};