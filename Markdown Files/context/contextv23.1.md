# # 🎯 ETD 2026 CONFERENCE APP — Complete Context Window (v23) — PART 1 of 2

```
Product:   Conference Management Platform
Event:     ETD 2026 — "ETDs in the age of AI" — IIT Delhi
Website:   https://etd2026.iitd.ac.in/
Type:      Mobile App (React Native Expo SDK 57) + Web Admin Panel (Django MVT)
GitHub:    github.com/Sharma1907/eventapp
Dev Env:   IITD Baadal VMs — Ubuntu 24.04 LTS, 24/7

Status:    ✅ EXPO SDK 57 UPGRADE COMPLETE (from SDK 54)
           ✅ REACT NATIVE 0.86.3 + NEW ARCHITECTURE (Fabric + TurboModules)
           ✅ APK SIZE OPTIMIZED (~25-35MB via ProGuard/R8)
           ✅ ANDROID SSL CERT BUNDLED (GlobalSign R46 for IITD wildcard cert)
           ✅ PUSH NOTIFICATIONS DELIVERING (Expo Push API via IITD proxy)
           ✅ ALL v22 FEATURES INTACT + Profile Screen Overhaul
           ✅ CRON WATCHDOG AUTO-RESTARTS GUNICORN WITHIN 60s
           ✅ 30s BACKGROUND MEAL SYNC + WEB ADMIN AUTO-POLLING SCANNER
           ✅ FEED ADMIN FULL CRUD + COMMENT MODERATION + VIDEO SUPPORT

Phase:     PRODUCTION-READY & AUTO-HEALING — FEATURE COMPLETE
           Ready for new feature development / Play Store submission
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
│  • Expo Metro Bundler (:8081 during dev)                     │
│  • Cron Watchdog (@reboot + every 60s auto-heal Gunicorn)    │
│  • ALL application logic + data lives here                   │
│  • VM has GUI (accessed via VS Code SSH)                     │
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
  ✗ Blocks large file uploads (>50MB) to external cloud (EAS Cloud upload fails)
  ✓ pip:  works with --break-system-packages
  ✓ npm:  NODE_TLS_REJECT_UNAUTHORIZED=0 npm install <pkg> --strict-ssl=false
  ✓ curl to internal VM: MUST use --noproxy "*"
  ✓ curl to public HTTPS: use -k flag (bypasses IITD SSL inspection)
  ✓ Python to VM: build_opener(ProxyHandler({}))
  ✓ Expo Push API in fcm.py: routes via proxy + verify=False
  ✓ Git push: unset GIT_ASKPASS first if VS Code SSH session left broken socket
```

---

## 🚀 EXPO SDK 57 — CURRENT STATE (UPGRADED FROM SDK 54)

### Current Version Matrix
```
expo:                    ~57.0.25
react-native:            0.86.3 (New Architecture / Fabric enabled by default)
react:                   19.2.3
react-dom:               19.2.3
babel-preset-expo:       ~57.x
@expo/config-plugins:    bundled in expo (use 'expo/config-plugins' sub-export)
```

### Kept Packages (Actively Used)
```
@react-native-async-storage/async-storage
@expo/vector-icons              (explicit dependency in SDK 57)
buffer                          (needed by react-native-svg)
expo-build-properties           (ProGuard/R8 config)
expo-camera                     (uses new CameraView API)
expo-clipboard                  (replaces removed react-native Clipboard)
expo-constants                  (uses Constants.expoConfig)
expo-document-picker            (uses new type: [...] array)
expo-font                       (peer dep of @expo/vector-icons)
expo-haptics
expo-image-picker               (uses result.assets[0].uri pattern)
expo-linear-gradient
expo-location
expo-notifications
expo-sensors                    (Accelerometer for shake-to-connect)
expo-splash-screen              (SDK 57 replaces app.json splash root)
expo-status-bar
expo-video                      (REPLACES expo-av)
qrcode-generator
react-native-gesture-handler
react-native-reanimated         (v4)
react-native-svg
react-native-web
react-native-webview            (Leaflet maps + PDF viewer)
react-native-worklets           (dep of reanimated v4)
```

### Removed Packages (Purged during SDK 57 upgrade)
```
✗ expo-av              (replaced by expo-video)
✗ expo-file-system     (unused)
✗ expo-sharing         (unused)
✗ expo-web-browser     (unused)
✗ expo-calendar        (unused)
✗ expo-brightness      (unused)
✗ expo-media-library   (unused)
✗ expo-local-authentication (unused)
✗ expo-keep-awake      (unused)
✗ expo-image-manipulator (unused)
✗ expo-blur            (unused)
✗ expo-dev-client      (adds 35MB, unused)
✗ expo-device          (unused)
✗ react-native-webrtc  (voice call abandoned, saves 50MB)
✗ @types/react         (JS project)
✗ typescript           (JS project)
✗ @expo/ngrok          (blocked by IITD proxy)
✗ @expo/config-plugins standalone (use 'expo/config-plugins' sub-export)
✗ eas-cli in devDependencies (use npx instead)
```

### EAS Build
```
Project ID: afa28d7e-10d5-4e85-bed4-783b7371a56b
Owner:      coder2026s-team

EAS Cloud Build (preferred — outputs ~25-35MB APK):
    cd /home/baadalvm/eventapp/mobile
    rm -rf android ios .expo dist web-build
    NODE_TLS_REJECT_UNAUTHORIZED=0 npx eas-cli build \
      --profile preview --platform android --non-interactive

⚠️ ALWAYS clean android/ ios/ .expo/ before cloud build (keeps upload <5MB)
⚠️ ALWAYS commit to Git BEFORE build — eas-cli packages tracked files only
⚠️ NEVER use --local flag (causes OOM on VM)
⚠️ EAS Cloud free tier: 30 builds/month
```

### Metro Dev Server on VM
```bash
cd /home/baadalvm/eventapp/mobile
npx kill-port 8081 2>/dev/null || true

# EXPO_NO_DEVTOOLS=1 disables Electron GUI DevTools that crash on VM sandbox
EXPO_NO_DEVTOOLS=1 npx expo start --lan --port 8081
```

---

## 📱 ANDROID SSL CERTIFICATE BUNDLING (Critical Fix for IITD Wildcard Cert)

### The Problem
IITD's SSL certificate uses **GlobalSign Root R46** (a newer CA). Chrome has it
in its built-in root store, but Android's native OkHttp engine does NOT have
it pre-installed on many devices (Android 9–14). This caused `Network request failed`
in the APK while Chrome on the same phone worked fine.

### The Solution (3 files bundled into APK)

**1. `mobile/certs/globalsign_root_r46.crt`**
Full certificate chain extracted from the live server:
- Server cert: *.iitd.ac.in
- Intermediate: GlobalSign GCC R46 OV TLS CA 2025
- Root: GlobalSign Root R46

**2. `mobile/plugins/withNetworkSecurity.js`**
Custom Expo config plugin that runs during EAS prebuild:
```javascript
// ⚠️ USES 'expo/config-plugins' sub-export (NOT '@expo/config-plugins')
const { withAndroidManifest, withDangerousMod } = require('expo/config-plugins');

// Injects android:networkSecurityConfig="@xml/network_security_config"
// Sets android:usesCleartextTraffic="true"
// Creates res/xml/network_security_config.xml trusting system+user+bundled cert
// Copies certs/globalsign_root_r46.crt into res/raw/
```

**3. `mobile/app.json`**
```json
"plugins": [
  "./plugins/withNetworkSecurity.js",
  "expo-video",
  ["expo-splash-screen", {...}],
  ["expo-build-properties", {
    "android": {
      "enableProguardInReleaseBuilds": true,
      "enableShrinkResourcesInReleaseBuilds": true
    }
  }]
]
```

---

## ⭐ 4-LAYER ARCHITECTURE: HOW MOBILE APP CONNECTS TO BACKEND

### LAYER 1: IITD Central Gateway (SSL Termination)

```
[ Phone on Jio/Airtel/Home Wi-Fi anywhere in the world ]
                │
                │  🔒 HTTPS (Port 443, TLS 1.3, wildcard *.iitd.ac.in cert)
                ▼
[ IITD Central Firewall / Load Balancer ]
   • Public DNS: etd2026.iitd.ac.in → IITD Gateway Public IP
   • SSL Handshake using IITD's GlobalSign R46 wildcard cert
   • Decrypts HTTPS → plain HTTP → forwards on port 80
                │
                │  ⚡ Plain HTTP over IITD private 10Gbps fiber
                ▼
[ Website VM (10.17.5.38) Apache on :80 ]
```

**Key insight**: Website VM has **NO SSL cert files**. IITD Central Gateway
handles all HTTPS. Do NOT touch `/etc/ssl/`.

### LAYER 2: Apache Reverse Proxy on Website VM (`10.17.5.38`)

Apache reads URL path prefix and routes to backend:

```
Request Path                      → Destination
─────────────────────────────────────────────────────────────────
/                                 → WordPress (DocumentRoot /var/www/html)
/wp-admin/, /wp-content/, etc.    → WordPress
/api/*                            → 10.17.9.48:8000 (Django REST API)
/panel/*                          → 10.17.9.48:8000 (Django Admin Panel)
/media/*                          → 10.17.9.48:8000 (Django uploaded files)
/static/panel/*                   → 10.17.9.48:8000 (Django static CSS/JS)
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

Gunicorn on `0.0.0.0:8000` with 8 Uvicorn workers. Django settings:
```python
ALLOWED_HOSTS = ['*']
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
USE_X_FORWARDED_HOST = True
USE_X_FORWARDED_PORT = True
CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = True

CSRF_TRUSTED_ORIGINS = [
    'https://etd2026.iitd.ac.in',
    'http://localhost:8000',
    'http://10.17.9.48:8000',
]
```

### LAYER 4: Mobile App Auto-Switch (`theme.js`)
```javascript
const DEV_API_URL  = 'http://10.17.9.48:8000/api/v1';           // Metro dev — IITD LAN only
const PROD_API_URL = 'https://etd2026.iitd.ac.in/api/v1';       // Production APK — anywhere
export const API_URL  = __DEV__ ? DEV_API_URL : PROD_API_URL;
export const API_ROOT = API_URL.replace(/\/api\/v1$/, '');
```

**Why this design:**
- **Dev** on IITD Wi-Fi → uses direct VM IP → no SSL cert issues on emulator
- **Production APK** on 4G/5G → uses public HTTPS → works globally
- In EAS builds, `__DEV__` is ALWAYS `false`, so APK always uses PROD_API_URL

### Complete Request Flow Example (Login):
```
1. User taps "Sign In" on phone
2. App calls: POST https://etd2026.iitd.ac.in/api/v1/auth/login/
3. Phone → IITD Gateway (SSL handshake with bundled GlobalSign R46 cert)
4. IITD Gateway → Website VM (plain HTTP :80)
5. Apache sees /api/ prefix → forwards to 10.17.9.48:8000
6. Django authenticates against PostgreSQL
7. Django returns JSON: {"success": true, "tokens": {...}, "user": {...}}
8. Response travels back: Django → Apache → IITD Gateway → Phone
9. App stores JWT in AsyncStorage, transitions to Home screen
10. App registers push token via POST /api/v1/notifications/tokens/
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

## ⚡ APP VM PRODUCTION SERVER + AUTO-HEALING WATCHDOG

### `backend/start_server.sh`
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

### `backend/keep_alive.sh` (Cron Watchdog)
```bash
#!/usr/bin/env bash
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
   - If pgrep finds process → no-op.
   - If dead/missing → restarts Gunicorn within 60 seconds.
3. **Path Fix**: `export PATH` ensures cron finds gunicorn.

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

---

## 📁 PROJECT STRUCTURE

```
/home/baadalvm/eventapp/               ← Repo root (both VMs mirror this)
├── .gitignore
├── backend/                           ← Django project
│   ├── start_server.sh                ← Gunicorn launcher (with PATH export)
│   ├── keep_alive.sh                  ← Cron watchdog
│   ├── server.log                     ← nohup log
│   ├── manage.py
│   ├── .env
│   ├── requirements.txt               ← gunicorn, uvicorn, uvloop, qrcode[pil], etc.
│   ├── update_schedule_dates.py       ← Testing helper for schedule rebasing
│   ├── confhub/
│   │   ├── settings.py                ← ALLOWED_HOSTS, CSRF, PROXY_SSL, CORS
│   │   ├── urls.py                    ← ALL panel/ and api/ routes
│   │   ├── asgi.py                    ← ProtocolTypeRouter + JWTAuthMiddleware
│   │   ├── wsgi.py
│   │   └── middleware.py              ← DisableCSRFForAPI
│   ├── apps/
│   │   ├── accounts/                  ← User (UUID pk, email login), StaffProfile,
│   │   │                                StaffPermission (22 modules)
│   │   ├── notifications/             ← DeviceToken, Notification, UserNotification
│   │   │   └── fcm.py                 ← Expo Push API via IITD proxy
│   │   ├── leaderboard/               ← PointEntry, UserPoints
│   │   ├── photos/                    ← Photo, SelfiePoint, SelfieSubmission
│   │   ├── chat/                      ← Conversation, Message, ConnectionRequest,
│   │   │                                CallSession, BlockedUser, ShakeLog
│   │   ├── schedule/                  ← ScheduleSession (+is_meal +meal_category),
│   │   │                                ScheduleSubSession, AcceptedPaper
│   │   ├── polls/                     ← Poll, Ideathon* models
│   │   ├── checkins/                  ← CheckIn, MealPass, MealWindow
│   │   │   ├── meal_utils.py          ← sync_meal_window() IST-aware
│   │   │   └── push.py
│   │   ├── sponsors/  speakers/  conferences/  events/  posts/
│   ├── templates/                     ← ★ CENTRAL TEMPLATE FOLDER
│   │   └── panel/                     ← ALL web admin templates
│   ├── static/                        ← STATICFILES_DIRS source
│   ├── staticfiles/                   ← collectstatic target
│   └── media/
│       ├── profiles/                  ← User profile photos
│       ├── conference/                ← Conference logo
│       └── papers/                    ← Paper PDFs
│
├── mobile/                            ← Expo React Native app (SDK 57)
│   ├── App.js
│   ├── index.js
│   ├── app.json                       ← SDK 57 schema (splash in plugins, no edgeToEdgeEnabled)
│   ├── package.json
│   ├── eas.json                       ← preview=apk, production=aab
│   ├── babel.config.js
│   ├── .npmrc
│   ├── .easignore                     ← node_modules, android, ios, .expo, dist
│   ├── google-services.json
│   ├── certs/
│   │   └── globalsign_root_r46.crt    ← IITD SSL cert (bundled into APK)
│   ├── plugins/
│   │   └── withNetworkSecurity.js     ← Uses 'expo/config-plugins' sub-export
│   ├── assets/
│   │   ├── icon.png                   ← 1024x1024 app icon
│   │   ├── adaptive-icon.png          ← Android adaptive icon (MUST match icon.png)
│   │   ├── splash.png                 ← Splash screen image
│   │   └── etdLogo.jpg                ← Source logo
│   └── src/
│       ├── theme.js                   ← ★ Design tokens + Auto DEV/PROD API switch
│       ├── components.js              ← Reusable UI components
│       ├── cache.js                   ← 5-min TTL AsyncStorage helper
│       ├── api.js                     ← apiFetch (JWT auto-refresh wrapper)
│       ├── MainApp.js                 ← Tab router + call Modal + WebSocket
│       ├── notifications.js           ← ⭐ Lazy require for Expo Go safety
│       ├── utils/geo.js
│       └── screens/
│           ├── LoginScreen.js
│           ├── HomeTab.js             ← Day calc from live sessions
│           ├── QRScreen.js            ← Dynamic meal name display
│           ├── ScheduleTab.js         ← 20s auto-refresh, no @react-navigation
│           ├── NetworkScreen.js
│           ├── ProfileTab.js          ← ⭐ v23 overhauled (see Profile section)
│           ├── NotificationsScreen.js
│           ├── EditProfileScreen.js   ← ⭐ v23 research interests validation
│           ├── ChangePasswordScreen.js
│           ├── SponsorsScreen.js  SponsorDetailScreen.js
│           ├── SpeakersScreen.js  SpeakerDetailScreen.js
│           ├── ChatListScreen.js  ChatRoomScreen.js
│           │   ⭐ ChatRoomScreen.js: uses expo-clipboard (not RN Clipboard)
│           ├── ContactCardModal.js
│           ├── TopicPickerModal.js  SpeakerRequestModal.js
│           ├── ConnectionRequestsScreen.js
│           ├── LeaderboardScreen.js
│           ├── PhotosScreen.js
│           ├── PollsScreen.js
│           ├── IdeathonScreen.js
│           ├── AcceptedPapersScreen.js
│           ├── ShakeConnectScreen.js
│           ├── RecapScreen.js         ← ⭐ v23 real-source stats
│           ├── CheckpointScreen.js    ← Google Maps via Leaflet WebView
│           ├── VoiceCallScreen.js     ← PLACEHOLDER (webrtc removed)
│           ├── StaffScreen.js  StaffDetailScreen.js  StaffGroupChatScreen.js
│           ├── FeedScreen.js          ← ⭐ Uses expo-video (not expo-av)
│           └── admin/
│               ├── AdminTab.js
│               ├── CheckInScreen.js   ← Meal type selector + Send Push
│               ├── IdeathonAdmin.js
│               ├── PapersAdminScreen.js
│               ├── NotificationsAdmin.js
│               ├── UsersAdmin.js  AddParticipantScreen.js
│               ├── ScheduleAdmin.js   ← Is Meal toggle + category picker
│               ├── PhotosAdmin.js  PollsAdmin.js
│               ├── CheckpointAdminScreen.js
│               ├── CallLogsAdmin.js
│               ├── FeedAdmin.js       ← Full CRUD + video + comment moderation
│               └── StaffAdminScreen.js
│
└── production_certification/          ← Load test suite
```

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

### URL → View → Template Triangle (How a page renders)
```
1. confhub/urls.py mounts each app's admin routes under panel/:
       path('panel/', include('apps.checkins.admin_urls'))

2. apps/<app>/admin_urls.py declares routes WITHOUT the panel/ prefix:
       path('checkins/scanner/', admin_views.scanner_view, name='checkin_scanner')
   ⚠ Writing 'panel/checkins/scanner/' yields /panel/panel/... — classic bug

3. apps/<app>/admin_views.py renders:
       return render(request, 'panel/scanner.html', context)

4. Django template engine resolves 'panel/scanner.html':
   → Searches TEMPLATES[0]['DIRS'] = [BASE_DIR / 'templates']
   → Finds: /home/baadalvm/eventapp/backend/templates/panel/scanner.html
   → Template extends "panel/base.html"
   → base.html includes sidebar with permission-gated menu items
```

### base.html — Permission-Gated Sidebar
The context processor `apps.accounts.context_processors.staff_permissions_context`
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
checkin_list.html             scanner.html (auto-poll + meal picker + push btn)
notifications.html            notification_edit.html
speakers_list.html            speaker_form.html
sponsors_list.html            sponsor_form.html
users_manage.html             events_list.html       event_form.html
conference_settings.html
password_reset_request.html   password_reset_confirm.html
schedule_list.html            schedule_form.html (is_meal + category)
schedule_feedback.html        schedule_analytics.html
accepted_papers.html          leaderboard.html       photos.html
polls_list.html               poll_form.html         poll_results.html
ideathon.html                 selfie_points.html
staff_permissions.html        call_logs.html         meal_pass_manage.html
chat/list.html                chat/thread.html       chat/requests.html
chat/reports.html             chat/analytics.html    chat/shakes.html
```

---

## 🌐 URL ROUTING — confhub/urls.py (Complete)

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
users                       User (UUID pk, email login) + research_interests JSONField (v23)
staff_profiles              StaffProfile (OneToOne user)
staff_permissions           StaffPermission (user, module) unique
checkins                    CheckIn (user, checkin_type, goodies_status, scanned_at)
meal_passes                 MealPass (UUID pk, user nullable, guest_* fields)
meal_windows                MealWindow (date, meal_type, is_open, opened_by)
notifications_devicetoken   DeviceToken (user, token, platform, is_active)
notifications_notification  Notification (status, sent_count, target_type)
notifications_usernotification UserNotification (delivered, read)
point_entries  user_points
photos  photo_settings  selfie_points  selfie_submissions
sponsors_sponsor  speakers_speaker
schedule_schedulesession    ← +is_meal (bool), +meal_category (str)
                              ordering=['day','start_datetime','display_order']
schedule_schedulesubsession
schedule_acceptedpaper      (paper_id, title, authors, abstract, paper_type,
                              session FK, presentation_date, presentation_time,
                              pdf_url, document FileField, track, is_published)
polls_poll  polls_polloption  polls_vote
polls_ideathonconfig  polls_ideathoninterest
polls_ideathonteam  polls_ideathonmember
polls_ideathoninvite  polls_ideathonjoinrequest
chat_connectionrequest  chat_conversation  chat_message
chat_messagereaction  chat_messagereport  chat_blockeduser
chat_shakelog  chat_staffgroupmessage  chat_callsession
posts_feedpost (image FileField accepts video) posts_feedcomment
posts_feedreaction
```

---

## 🔑 TEST CREDENTIALS

```
MOBILE + WEB
  participant@test.com / Test@1234
  speaker@test.com     / Test@1234
  test@test.com        / 12345678       (staff, has checkin_scanner)
  akshita.singh@test.com / Test@1234    (participant, verified working)
  Dummy: firstname.lastname@test.com / Test@1234 (100 users)

STAFF (seed_staff.py — 18 records)
  hodlibrary@admin.iitd.ac.in  / Librarian@123  (team_head)
  neerajkc@library.iitd.ac.in  / Officer@123    (team_head)
  gunjan0605@library.iitd.ac.in/ Staff@123      (staff)

WEB ADMIN — https://etd2026.iitd.ac.in/panel/login/
  etd@admin.iitd.ac.in (super_admin)
```

---

**⬇️ CONTINUE READING PART 2 OF 2 ⬇️**
*(Push notifications, Meal system, Feed system, Profile v23 overhaul, Critical patterns, What's working, Working agreement, Git info)*

---