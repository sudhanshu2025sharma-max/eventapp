# 🎯 ETD 2026 CONFERENCE APP — Complete Context Window (v21)

```
Product:   Conference Management Platform
Event:     ETD 2026 — "ETDs in the age of AI" — IIT Delhi
Website:   https://etd2026.iitd.ac.in/
Type:      Mobile App (React Native Expo SDK 54) + Web Admin Panel (Django MVT)
GitHub:    github.com/Sharma1907/eventapp
Dev Env:   IITD Baadal VMs — Ubuntu 24.04 LTS, 24/7

Status:    ALL v20 FEATURES + ACCEPTED PAPERS/POSTERS MODULE + CHECKPOINT UX
           POLISH + GOOGLE MAPS TILES (WEB + MOBILE) + DYNAMIC RADIUS PICKER
           + LIVE ADMIN DASHBOARD + STAFF MANAGEMENT WEB LINK RESTORED
           + PAPERS PERMISSION WIRED TO STAFF ROLE ASSIGNMENT
           + MOBILE PAPERS ADMIN CRUD + PAPERS PUBLIC SCREEN
           + HOME GRID SWAP (PAPERS PRIMARY, PHOTOS UNDER MORE)

Phase:     PRODUCTION-READY — HTTPS live at https://etd2026.iitd.ac.in,
           polishing phase before App Store / Play Store submission.
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
    reanimated, native dev client. Upgrade discussed but deferred until after
    domain stabilization + WebRTC removal + expo-av → expo-audio migration.

⚠️ Always run Expo from mobile/ directory:
    cd /home/baadalvm/eventapp/mobile
    npx expo start --lan --port 8081

⚠️ Running from root triggers SDK 57 install prompt — DECLINE.

EAS Build (local):
    NODE_TLS_REJECT_UNAUTHORIZED=0 npx eas build --profile preview \
      --platform android --local

Project ID: afa28d7e-10d5-4e85-bed4-783b7371a56b
Owner:      coder2026s-team
```

---

## ⭐ URL ROUTING — THE MOST IMPORTANT SECTION

This is a **three-layer routing system**. Understand this and everything else
falls into place.

### LAYER 1: IITD Central Gateway (SSL Termination)

```
[ Internet user on Jio/Airtel/Home Wi-Fi ]
                │
                │  🔒 HTTPS (Port 443, TLS 1.3, wildcard *.iitd.ac.in cert)
                ▼
[ IITD Central Firewall / Load Balancer ]
   • Decrypts SSL here (SSL Termination)
   • Forwards plain HTTP (Port 80) to internal Baadal network
                │
                │  ⚡ Plain HTTP over IITD private fiber
                ▼
[ Website VM (10.17.5.38) Apache on :80 ]
```

**Key insight**: Your Website VM has **NO SSL certificate files**. The IITD
Central Gateway handles all HTTPS. To your Apache, everything looks like
plain HTTP on port 80. You do NOT need to touch `/etc/ssl/` — it is only
Ubuntu's default trusted-CA store, unrelated to your setup.

Users still see 🔒 green padlock because the browser connects to IITD's
gateway on HTTPS, and IITD's certificate is a valid wildcard for `*.iitd.ac.in`.

### LAYER 2: Apache Reverse Proxy on Website VM (`10.17.5.38`)

Apache reads the URL **path prefix** and decides where to send the request:

```
Request Path                      → Destination
─────────────────────────────────────────────────────────────────
/                                 → WordPress (DocumentRoot /var/www/html)
/wp-admin/, /wp-content/, etc.    → WordPress (same DocumentRoot)
/api/*                            → 10.17.9.48:8000 (Django REST)
/panel/*                          → 10.17.9.48:8000 (Django Admin)
/media/*                          → 10.17.9.48:8000 (Django uploads)
/static/panel/*                   → 10.17.9.48:8000 (Django static)
/ws/*                             → 10.17.9.48:8000 (WebSocket, ws://)
/_expo/*                          → 10.17.9.48:8081 (Metro dev only)
/hot, /message                    → 10.17.9.48:8081 (Metro HMR, ws://)
/index.bundle, /status, /assets/* → 10.17.9.48:8081 (Metro dev only)
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

Gunicorn listens on `0.0.0.0:8000` with 8 Uvicorn workers. Django then
routes based on `confhub/urls.py` (see full inventory below).

Django is told the request originally came in via HTTPS through these
`settings.py` directives:

```python
ALLOWED_HOSTS = ['*']       # Wide-open; safe because Apache is the only entry
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
USE_X_FORWARDED_HOST = True
USE_X_FORWARDED_PORT = True

CSRF_TRUSTED_ORIGINS = [
    'https://etd2026.iitd.ac.in',
    'http://localhost:8000',
    'http://10.17.9.48:8000',
    'https://*.app.github.dev',
    'https://*.ngrok-free.app',
    'https://*.ngrok-free.dev',
]
```

### LAYER 4: Mobile App Auto-Switch (`theme.js`)

The mobile app decides which URL to hit based on `__DEV__`:

```javascript
// mobile/src/theme.js

const DEV_API_URL  = 'http://10.17.9.48:8000/api/v1';           // Metro dev — IITD LAN
const PROD_API_URL = 'https://etd2026.iitd.ac.in/api/v1';       // Production APK — anywhere

export const API_URL  = __DEV__ ? DEV_API_URL : PROD_API_URL;
export const API_ROOT = API_URL.replace(/\/api\/v1$/, '');
```

**Why this design?**
- **Dev** on IITD Wi-Fi → uses direct VM IP → no SSL cert issues on Android
- **Production APK** on 4G/5G → uses public HTTPS → works globally

### Complete `wordpress.conf` (Website VM)

Location: `/etc/apache2/sites-available/wordpress.conf`
Backup: `/etc/apache2/sites-available/wordpress.conf.bak`

Contains: `ProxyPreserveHost On`, `RequestHeader set X-Forwarded-Proto "https"`,
all path prefixes above, plus smart Expo root routing.

### Apache Modules Enabled
```bash
sudo a2enmod proxy proxy_http proxy_wstunnel headers rewrite
```

### Safe Apache Operations (Zero Downtime)
```bash
sudo apache2ctl configtest             # ALWAYS test syntax first
sudo systemctl reload apache2          # ONLY if "Syntax OK"
# ⚠ NEVER use `systemctl restart apache2` unless absolutely necessary
```

### Emergency Rollback (10-second recovery)
```bash
sudo cp /etc/apache2/sites-available/wordpress.conf.bak \
        /etc/apache2/sites-available/wordpress.conf
sudo systemctl reload apache2
```

---

## ⚡ APP VM PRODUCTION SERVER

**File: `backend/start_server.sh`** (chmod +x)
```bash
#!/usr/bin/env bash
set -e
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

### Backend Command Toolkit
```bash
# 🚀 START (background)
cd /home/baadalvm/eventapp/backend
pkill -f gunicorn || true
sleep 1
nohup ./start_server.sh > server.log 2>&1 &

# 🔄 RESTART (after ANY .py change — no hot reload!)
cd /home/baadalvm/eventapp/backend
pkill -f gunicorn || true
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

# OR: Advertise public domain for proxy routing
REACT_NATIVE_PACKAGER_HOSTNAME="etd2026.iitd.ac.in" npx expo start --lan --port 8081
```

### Preview APK Build (Standalone — no Metro needed)
```bash
cd /home/baadalvm/eventapp/mobile
NODE_TLS_REJECT_UNAUTHORIZED=0 npx eas build --profile preview --platform android --local
```

---

## 📁 PROJECT STRUCTURE

```
/home/baadalvm/eventapp/               ← Repo root (both VMs mirror this)
├── .easignore
├── backend/                           ← Django project
│   ├── start_server.sh                ← Gunicorn launcher
│   ├── server.log                     ← nohup log
│   ├── manage.py
│   ├── .env
│   ├── requirements.txt               ← gunicorn, uvicorn, uvloop, qrcode[pil], etc.
│   ├── confhub/
│   │   ├── settings.py                ← ALLOWED_HOSTS, CSRF, PROXY_SSL_HEADER
│   │   ├── urls.py                    ← ALL panel/ and api/ routes wired here
│   │   ├── asgi.py                    ← ProtocolTypeRouter + JWTAuthMiddleware
│   │   ├── wsgi.py
│   │   └── middleware.py              ← DisableCSRFForAPI
│   ├── apps/
│   │   ├── accounts/                  ← User, StaffProfile, StaffPermission
│   │   ├── notifications/             ← DeviceToken, Notification, UserNotification
│   │   ├── leaderboard/               ← PointEntry, UserPoints
│   │   ├── photos/                    ← Photo, SelfiePoint, SelfieSubmission
│   │   ├── chat/                      ← Conversation, Message, ConnectionRequest,
│   │   │                                 CallSession, BlockedUser, ShakeLog
│   │   ├── schedule/                  ← ScheduleSession, ScheduleSubSession,
│   │   │                                 AcceptedPaper (⭐ NEW v20)
│   │   ├── polls/                     ← Poll, PollOption, Vote, IdeathonConfig,
│   │   │                                 IdeathonTeam, IdeathonMember,
│   │   │                                 IdeathonInvite, IdeathonJoinRequest
│   │   ├── checkins/                  ← CheckIn, MealPass, MealWindow
│   │   ├── sponsors/
│   │   ├── speakers/
│   │   ├── conferences/
│   │   ├── events/
│   │   └── posts/
│   ├── templates/                     ← ★ CENTRAL TEMPLATE FOLDER (see below)
│   │   └── panel/                     ← ALL web admin templates
│   │       ├── accepted_papers.html   ← ⭐ NEW v20
│   │       └── chat/                  ← Chat-related admin templates
│   ├── static/                        ← STATICFILES_DIRS source
│   ├── staticfiles/                   ← STATIC_ROOT (collectstatic target)
│   └── media/
│       └── papers/                    ← ⭐ NEW: Paper PDFs uploaded via admin
│
├── mobile/                            ← Expo React Native app (SDK 54)
│   ├── App.js  index.js  babel.config.js
│   ├── app.json  package.json  .npmrc  .easignore  eas.json
│   ├── google-services.json
│   └── src/
│       ├── theme.js                   ← ★ Auto DEV/PROD API switch
│       ├── components.js
│       ├── cache.js                   ← 5-min TTL AsyncStorage helper
│       ├── api.js                     ← apiFetch (JWT auto-refresh)
│       ├── MainApp.js                 ← Tab router + call Modal
│       ├── notifications.js
│       ├── utils/geo.js
│       └── screens/
│           ├── HomeTab.js
│           ├── QRScreen.js
│           ├── ScheduleTab.js
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
│           ├── AcceptedPapersScreen.js  ← ⭐ NEW v20
│           ├── ShakeConnectScreen.js  RecapScreen.js
│           ├── CheckpointScreen.js    ← ⭐ POLISHED v20 (Google Maps, smooth drawer)
│           ├── VoiceCallScreen.js
│           ├── StaffScreen.js  StaffDetailScreen.js  StaffGroupChatScreen.js
│           ├── FeedScreen.js
│           └── admin/
│               ├── AdminTab.js
│               ├── CheckInScreen.js
│               ├── IdeathonAdmin.js
│               ├── PapersAdminScreen.js   ← ⭐ NEW v20 (CRUD + PDF upload)
│               ├── NotificationsAdmin.js
│               ├── UsersAdmin.js
│               ├── AddParticipantScreen.js
│               ├── ScheduleAdmin.js  PhotosAdmin.js  PollsAdmin.js
│               ├── CheckpointAdminScreen.js
│               ├── CallLogsAdmin.js
│               └── StaffAdminScreen.js
│
└── production_certification/          ← Load test suite
```

⚠️ Note: `eventapp/mobile/` duplicate directory does NOT exist. All mobile
changes go to `/home/baadalvm/eventapp/mobile/src/` only.

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

EVERY template starts with:  {% extends "panel/base.html" %}
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
The context processor `apps.accounts.context_processors.staff_permissions_context`
(registered in `settings.TEMPLATES`) runs on **every** render and injects:
```python
{'user_permissions': [...], 'is_super_admin': bool}
```

Every sidebar item is wrapped:
```django
{% if is_super_admin or "checkin_scanner" in user_permissions %}
  <a href="/panel/checkins/scanner/" class="menu-item">Check-In Scanner</a>
{% endif %}
```

### Live Admin Dashboard (v20) — `apps/accounts/admin_views.py::admin_dashboard`
Fetches real-time metrics:
- Total participants + profile complete %
- Checked-in count + attendance %
- Today's meals + open/closed window
- Ideathon teams count
- Photos + pending approval
- Active polls
- Today's schedule sessions (live/upcoming/completed)
- Recent 7 check-ins with names + time

Template: `templates/panel/dashboard.html` — 6-card stats grid + live schedule
list + recent check-ins stream + quick action shortcuts.

### Full Template Inventory (`backend/templates/panel/`)
```
base.html                     ← master layout, dynamic sidebar
login.html                    dashboard.html (⭐ v20 live data)
participants_list.html        participants_upload.html
participants_preview.html     participant_add.html   participant_edit.html
checkin_list.html             scanner.html
notifications.html            notification_edit.html
speakers_list.html            speaker_form.html
sponsors_list.html            sponsor_form.html
users_manage.html             events_list.html       event_form.html
conference_settings.html
password_reset_request.html   password_reset_confirm.html
schedule_list.html            schedule_form.html
schedule_feedback.html        schedule_analytics.html
accepted_papers.html          ← ⭐ NEW v20 (Papers CRUD + PDF upload + date picker)
leaderboard.html              photos.html
polls_list.html               poll_form.html         poll_results.html
ideathon.html
selfie_points.html            ← ⭐ POLISHED v20 (Google Maps, dynamic radius, pins)
staff_permissions.html        ← ⭐ RESTORED v20 (clean single modal, Papers perm)
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
path('panel/', include('apps.chat.admin_urls'))        ← FIXED v20 routing
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
path('api/v1/schedule/',      include('apps.schedule.urls'))  ← + papers routes
path('api/v1/chat/',          include('apps.chat.urls'))

# WebSocket: wss://etd2026.iitd.ac.in/ws/call/?token=<jwt>
```

---

## ⭐ ACCEPTED PAPERS & POSTERS SYSTEM (v20 — Fully Working)

### Architecture
```
AcceptedPaper (apps/schedule/models.py)
  UUID pk, paper_id, title, authors, abstract, track
  paper_type: 'paper' | 'poster'
  session: ForeignKey(ScheduleSession, nullable)
  presentation_date: DateField (nullable)
  presentation_time: CharField (e.g. "11:15 AM @ Hall A")
  pdf_url: URLField
  document: FileField(upload_to='papers/') ← PDF upload
  is_published, display_order, timestamps
        ↓
Web Admin at /panel/schedule/accepted-papers/
  Full CRUD + link to schedule session + PDF file upload
  Assign to any staff via Papers permission
        ↓
Mobile Public Screen: AcceptedPapersScreen.js
  Papers | Posters tabs
  Search across title/authors/track
  Expandable accordion cards with abstract
  Download document button (Linking.openURL)
  "Open Full Schedule" button → switches to Schedule tab
        ↓
Mobile Admin Screen: admin/PapersAdminScreen.js
  Full CRUD from mobile
  DocumentPicker for PDF/Word upload
  Filter by All / Papers / Posters
  Delete confirmation
```

### API Endpoints (`/api/v1/schedule/`)
```
# Public
GET  /schedule/accepted-papers/?type=paper|poster&search=q
     → Returns list with document URLs, presentation_date, session info

# Mobile Admin (requires role: super_admin, mgmt_admin, staff, team_head)
GET    /schedule/admin/papers/         → list all papers
POST   /schedule/admin/papers/         → create (multipart/form-data for PDF)
DELETE /schedule/admin/papers/?id=<uuid>
```

### Web Admin Route
```
GET  /panel/schedule/accepted-papers/  → accepted_papers_panel view
POST                                    → action=create | delete
```

### Staff Permission
```python
# apps/accounts/models.py StaffPermission.MODULE_CHOICES
('papers', 'Papers & Posters')

# apps/accounts/admin_views.py module_categories
{'name': 'Content', 'items': [
    ('schedule', 'Events & Schedule'),
    ('papers', 'Papers & Posters'),  ← ADDED v20
    ('photos', 'Photos'),
    ...
]}
```

---

## ⭐ CHECKPOINT SYSTEM (v20 — Polished UX)

### Google Maps Tiles (Web Admin + Mobile)
Uses direct Google Maps tile server (no API key required):
```javascript
L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
    maxZoom: 20,
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    attribution: '&copy; Google Maps'
}).addTo(map);
```

Provides full IIT Delhi campus details: Central Library, Bharti, SAC, LHC,
Hostels, Gates. No 403 blocks, no "API KEY REQUIRED" watermarks.

### Web Admin Improvements (`templates/panel/selfie_points.html`)
- **Draggable location picker** with real-time coord updates
- **Dynamic radius resizing** — typing in radius input live-expands the pink circle
- **Established checkpoints** rendered on map with popups
- **Sponsor corridor** rendered as blue polyline with A/B markers
- All wrapped in `DOMContentLoaded` with null-guards to prevent crashes

### Mobile UX Polish (`CheckpointScreen.js`)
- **Smooth drawer physics** — single-swipe snap between collapsed/half/full
- **Hardware back button** override — closes navigation → sponsor detail →
  spot detail → home in cascading order
- **Close button hitSlop** — 15px padding around close icon
- **Grid bottom padding** increased to `BOTTOM_INSET + 140` (no cutoff)
- **Injected CSS** hides Google Maps promo popup in in-app navigation:
  `.ml-promo-app-switcher { display: none !important; }`
- Only one "Open App" button in top bar
- **Fixed `BackHandler.removeEventListener` deprecation** — uses new
  subscription pattern: `const sub = ...addEventListener(...); return () => sub.remove();`

---

## ⭐ IDEATHON SYSTEM (v19 — Fully Working)

### Architecture
```
IdeathonConfig (singleton pk=1) → registration_open, date range, team size limits
IdeathonInterest → OneToOne(user) participant pool
IdeathonTeam → UUID pk, name, avatar (10 choices), project fields, leader FK
IdeathonMember → team + OneToOne(user)
IdeathonInvite → leader invites interested user
IdeathonJoinRequest → user requests to join team, leader approves
```

### API Endpoints (`/api/v1/polls/`)
Full CRUD, interest toggle, name check, invite/respond, join request/respond,
leadership transfer, admin controls.

### Join Request Flow
1. Participant taps "Ask to Join" → creates JoinRequest(pending) + push to leader
2. Leader sees orange banner → Approve/Decline
3. Accept → member created, other requests auto-declined, push to applicant
4. Decline → push to applicant

---

## ⭐ MEAL PASS SYSTEM (v18 — Fully Working)

### Data Flow
```
ScheduleSession (session_type='meal') 
        ↓
sync_meal_window() in apps/checkins/meal_utils.py (IST timezone-aware)
Triggered by: notifications poll, meal status API, panel status API, celery beat
        ↓
Unified MealWindow (meal_type='meal', date=today)
Rules: inside slot → open + push once; outside → close + push once;
       manual admin toggle → opened_by=<user>, sync respects it
        ↓
PARTICIPANT CHECK-IN GATE — only checked-in users can generate meal passes
        ↓
MealPass (UUID-based, one active per user per day)
```

### Meal API Endpoints
```
GET    /api/v1/checkins/meal/status/
POST   /api/v1/checkins/meal/generate/    ← gated by check-in
POST   /api/v1/checkins/meal/scan/
POST   /api/v1/checkins/meal/window/
GET    /api/v1/checkins/meal/stats/
GET    /api/v1/checkins/meal/list/
POST   /api/v1/checkins/meal-pass/create/  ← walk-in guest + email
GET    /api/v1/checkins/meal-pass/mine/
```

---

## 🔐 AUTH & RBAC

```
ROLES: participant, attendee, speaker,
       super_admin, mgmt_admin, team_head, staff
ADMIN_ROLES = ('super_admin', 'mgmt_admin', 'team_head', 'staff')

22 ASSIGNABLE MODULES (StaffPermission.MODULE_CHOICES) — ⭐ +papers v20:
  MANAGEMENT   participants, ideathon, meal_scanner, checkin_scanner
  CONTENT      schedule, papers (⭐ NEW), photos, checkpoint, feed
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
users                       User (UUID pk, email login)
staff_profiles              StaffProfile (OneToOne user)
staff_permissions           StaffPermission (user, module) unique
                            ⭐ Now includes 'papers' module
checkins                    CheckIn (user, checkin_type, goodies_status, scanned_at)
meal_passes                 MealPass (UUID pk, user nullable, guest_* fields)
meal_windows                MealWindow (date, meal_type, is_open, opened_by)
notifications_devicetoken   DeviceToken (user, token, platform)
notifications_notification  Notification (status, sent_count)
notifications_usernotification UserNotification (delivered, read)
point_entries  user_points
photos  photo_settings  selfie_points  selfie_submissions
sponsors_sponsor  speakers_speaker
schedule_schedulesession    ← source of truth for meal windows
schedule_schedulesubsession
schedule_acceptedpaper      ⭐ NEW v20 (paper_id, title, authors, abstract,
                              paper_type, session FK, presentation_date,
                              presentation_time, pdf_url, document FileField,
                              track, is_published, display_order)
polls_poll  polls_polloption  polls_vote
polls_ideathonconfig  polls_ideathoninterest
polls_ideathonteam  polls_ideathonmember
polls_ideathoninvite  polls_ideathonjoinrequest
chat_connectionrequest  chat_conversation  chat_message
chat_messagereaction  chat_messagereport  chat_blockeduser
chat_shakelog  chat_staffgroupmessage  chat_callsession
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

// COLORS (partial list)
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

## 🏠 HOME TAB QUICK ACTIONS (v20 — Updated Grid)

```javascript
const QUICK_ITEMS = [
  { label: 'Speakers',        action: 'speakers'    },
  { label: 'Leaderboard',     action: 'leaderboard' },
  { label: 'Papers/Posters',  action: 'papers'      },  ← ⭐ NEW v20 (replaced Photos)
  { label: 'Sponsors',        action: 'sponsors'    },
  { label: 'Checkpoint',      action: 'checkpoint'  },
  { label: 'Live Polls',      action: 'polls'       },
  { label: 'Ideathon',        action: 'ideathon'    },
  { label: 'Events Team',     action: 'staff_team'  },
  { label: 'Photo Gallery',   action: 'photos'      },  ← ⭐ Moved to "More" section
];
```

Wired in `MainApp.js`:
```javascript
if (subScreen === 'papers') return <AcceptedPapersScreen 
  onBack={() => setSubScreen(null)} 
  onOpenSchedule={() => { setSubScreen(null); setTab('schedule'); }} 
/>;
```

State: `const [tab, setTab] = useState('home')` — use `setTab('schedule')`
(NOT `setActiveTab`, which doesn't exist).

---

## 🎛️ MOBILE ADMIN TAB (`AdminTab.js`) — 9 Feature Cards

```javascript
const ALL_FEATURES = [
  { key: 'checkin',          perm: 'checkin_scanner' },
  { key: 'notifications',    perm: 'notifications'   },
  { key: 'add_participant',  perm: 'users_manage'    },
  { key: 'users',            perm: 'users_manage'    },
  { key: 'staff_admin',      perm: 'users_manage'    },
  { key: 'schedule',         perm: 'schedule'        },
  { key: 'photos',           perm: 'photos'          },
  { key: 'polls_admin',      perm: 'polls'           },
  { key: 'papers',           perm: 'papers'          },  ← ⭐ NEW v20
  { key: 'ideathon_admin',   perm: 'ideathon'        },
];
```

**⚠️ CRITICAL:** Every feature object MUST have `grad: ['#hex1', '#hex2']`
(2-color gradient array). Missing `grad` causes
`TypeError: Cannot read property 'map' of undefined` in `LinearGradient`.

State: `const [screen, setScreen] = useState(null)` — use `setScreen('papers')`.

Render pattern:
```javascript
if (screen === 'papers') return <PapersAdminScreen onBack={() => setScreen(null)} />;
```

`visibleFeatures = (ALL_FEATURES || []).filter(f => isSuperAdmin || userPerms.includes(f.perm))`
— always use `|| []` fallback to prevent map-of-undefined crash.

---

## ⚠️ CRITICAL PATTERNS — DO NOT BREAK

### Apache / Reverse Proxy
```
✓ ALWAYS run `apache2ctl configtest` before reload
✓ ALWAYS use `systemctl reload apache2` (not restart) — zero downtime
✓ ALWAYS keep wordpress.conf.bak for instant rollback
✓ ALWAYS pass X-Forwarded-Proto "https" so Django knows scheme
✓ ALWAYS use ProxyPreserveHost On (so Django sees etd2026.iitd.ac.in)
✗ NEVER edit /etc/ssl/* — SSL is at IITD Central Gateway, not this VM
✗ NEVER prefix admin_urls.py routes with 'panel/' (would double-nest)
✗ NEVER add routes that could shadow WordPress paths (/wp-admin, /wp-*)
```

### Backend (Django)
```
✗ NEVER expect Gunicorn to hot-reload — always restart
✗ NEVER set CONN_MAX_AGE > 0 under Uvicorn workers
✗ NEVER re-enable ROTATE_REFRESH_TOKENS without single-flight mutex
✗ NEVER add 'channels' twice to INSTALLED_APPS
✗ NEVER use Firebase Admin SDK — Expo Push API only
✗ NEVER pass delivered_at to Notification.objects.create()
✗ NEVER prefix admin_urls.py routes with 'panel/'
✗ NEVER use `python` — this VM has `python3`
✗ NEVER use `created_at` on CheckIn model — it's `scanned_at`
✗ NEVER use `--lifespan off` in Gunicorn CLI (only bare uvicorn)

✓ ALWAYS use timezone.now().astimezone(IST) for meal logic
✓ ALWAYS return {"success": true/false} for mobile API
✓ ALWAYS return nested {"meal": {...}} for scanner.html endpoints
✓ ALWAYS set opened_by=request.user on manual meal toggle
✓ ALWAYS trigger sync_meal_window() before returning meal state
✓ ALWAYS check is_checked_in before allowing meal pass generation
✓ ALWAYS use meal_type='meal' (unified) for active window
✓ ALWAYS restart gunicorn after .py changes
✓ ALWAYS cd into backend/ before Django commands
✓ ALWAYS make paper document FileField accept multipart/form-data
```

### Templates
```
✓ Everything extends "panel/base.html"
✓ DIRS = [BASE_DIR / 'templates'] → backend/templates/
✓ Chat templates live in templates/panel/chat/
✓ Every sidebar item is permission-wrapped
✗ Never add |safe to user-supplied values
✗ Never put content into {% block title %} beyond the title itself
   (this corrupts staff_permissions.html and similar pages)
✗ Never generate JavaScript from Python heredoc with double quotes
   — bash intercepts `!` operators. Use `python3 << 'EOF'` (single quotes)
```

### Mobile
```
✗ Never downgrade the Expo SDK (locked at 54)
✗ Never run expo from root dir (always cd mobile/)
✗ Never add expo-router / React Navigation / TypeScript
✗ Never call hooks inside FlatList renderItem
✗ Never set Content-Type manually with FormData
✗ Never write FONT.size.lg — FONT is FLAT
✗ Never write COLORS.warning-dark
✗ Never nest FlatList in same-direction ScrollView
✗ Never require('react-native-webrtc') before NativeModules check
✗ Never show meal QR when window is closed
✗ Never reference `setActiveTab` — the state variable is `tab`/`setTab`
✗ Never omit `grad: ['#a', '#b']` from ALL_FEATURES entries — LinearGradient crashes
✗ Never use unescaped apostrophes in JSX single-quoted strings
   ('You're' → use "You're" or 'You\\'re')

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
✓ Use LayoutAnimation.configureNext(...) for smooth accordion expand
✓ For PDF/document upload: use expo-document-picker
   (npx expo install expo-document-picker)
✓ Always safe-fallback filter arrays: (ARR || []).filter(...)
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
   — bash intercepts `!`, `$`, backticks. Use `python3 << 'EOF'` heredoc.
✓ Use single-quoted heredoc: python3 << 'EOF' ... EOF
✓ For simple sed replacements: sed -i 's|old|new|g' file
✓ Always verify with `grep -n` after mutation
✓ Never edit the same file twice with regex — check for duplicate insertions
```

---

## ✅ WHAT IS WORKING (COMPLETE)

```
✅ JWT Auth (access + refresh, no rotation)
✅ Email login, password reset via IITD SMTP
✅ Role-based access (7 roles, 22 modules incl. papers)
✅ Web admin panel (Django MVT, permission-gated sidebar, clean CSS)
✅ Participant management (CSV upload, add/edit/preview)
✅ Conference settings
✅ Schedule management (CRUD + session types + rooms)
✅ Speaker + Sponsor management
✅ Photo gallery (upload + approval + selfie points)
✅ Polls (create/vote/results)
✅ Leaderboard (point system)
✅ Push notifications (Expo Push via IITD proxy)
✅ Deep-link routing from notifications
✅ Chat (1:1 + connection requests + reactions + reports)
✅ Staff group chat
✅ Voice calls (WebRTC with coturn STUN/TURN — marked for removal)
✅ Shake-to-connect
✅ Feed/posts
✅ Checkpoint/selfie submissions
✅ QR generation + scanning (check-in + meal passes)
✅ Meal Pass System (schedule-driven, IST-aware, manual override,
   push on state changes, check-in gated, walk-in guest email)
✅ Home Tab countdown/progress + 3D tilt hero + dynamic venue
✅ QR Screen with participant photo + kit card + meal card
✅ Ideathon System: interest, team CRUD, invites, join requests,
   leadership transfer, admin CRUD from mobile
✅ Public HTTPS domain: https://etd2026.iitd.ac.in
✅ Apache reverse proxy: WordPress + Django coexist, zero conflicts
✅ Auto DEV/PROD API switching in mobile app
✅ Metro bundler accessible via public domain
✅ Zero-downtime Apache reloads with configtest safety
✅ Emergency 10-second rollback via wordpress.conf.bak

⭐ NEW IN v20:
✅ Live Admin Dashboard (real metrics from PostgreSQL)
✅ Chat sidebar links (fixed NoReverseMatch crashes)
✅ Google Maps tiles in web admin + mobile app (no API keys)
✅ Dynamic radius resizing for selfie spot picker
✅ Established checkpoints plotted on map with popups
✅ Web Admin Checkpoint page fully functional (drag/click/GPS pick)
✅ Mobile CheckpointScreen UX polish (smooth drawer, hardware back)
✅ Fixed BackHandler deprecation (subscription pattern)
✅ Accepted Papers & Posters model + FileField + presentation_date
✅ Web Admin: /panel/schedule/accepted-papers/ with PDF upload + date picker
✅ Papers module in Staff Permissions (Content category)
✅ Mobile Public Screen: AcceptedPapersScreen (tabs + search + expand + PDF download)
✅ Mobile Admin Screen: PapersAdminScreen (CRUD + expo-document-picker)
✅ Home Tab grid: Papers/Posters replaces Photos; Photos moved to "More"
✅ Staff Management web sidebar link restored with proper CSS class
✅ Clean staff_permissions.html template (single modal, no corruption)
```

## ❌ WHAT IS NEXT / PENDING

```
❌ Remove WebRTC / voice call code (marked for removal)
❌ Migrate expo-av → expo-audio (deprecated in SDK 54)
❌ SDK 54 → SDK 57 upgrade (after WebRTC + expo-av removed)
❌ iOS EAS Development Build
❌ systemd unit for start_server.sh (currently nohup)
❌ Nginx caching layer (optional — Apache handles fine now)
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
    (the `eventapp/mobile/` duplicate no longer exists)
  • For JS edits via Python: always use `python3 << 'EOF'` (single quotes)
    to avoid bash intercepting `!`, `$`, backticks
  • For every feature array entry (mobile), ensure ALL required props
    (grad, perm, key, icon, label) are present to prevent runtime crashes
```

---

## 📚 GIT

```
Remote: https://github.com/Sharma1907/eventapp
Branch: main
```