# 🎯 ETD 2026 CONFERENCE APP — Complete Context Window (v24 Production & Play Store Submitted)

```
Product:   Conference Management Platform
Event:     ETD 2026 — "ETDs in the age of AI" — IIT Delhi
Website:   https://etd2026.iitd.ac.in/
Type:      Mobile App (React Native Expo SDK 57) + Web Admin Panel (Django MVT)
GitHub:    github.com/Sharma1907/eventapp
Dev Env:   IITD Baadal VMs — Ubuntu 24.04 LTS, 24/7

Status:    🚀 PLAY STORE SUBMITTED FOR REVIEW (Version 1.0.2 / versionCode: 3)
           ✅ EXPO SDK 57 (React Native 0.86.3 New Architecture / Fabric)
           ✅ APK / AAB SIZE OPTIMIZED (~20.6MB via ProGuard/R8)
           ✅ ANDROID SSL CERT BUNDLED (GlobalSign R46 for IITD wildcard cert)
           ✅ READ_MEDIA_IMAGES & READ_MEDIA_VIDEO STRICTLY REMOVED
              (Custom Expo Plugin + Native System Photo Picker for Android 13+ Compliance)
           ✅ PUBLIC PRIVACY POLICY & ACCOUNT DELETION PORTALS LIVE
           ✅ GOOGLE REVIEWER ACCOUNTS ACTIVE ON BACKEND (Super Admin + Participant)
           ✅ PUSH NOTIFICATIONS DELIVERING (Expo Push API via IITD proxy)
           ✅ CRON WATCHDOG AUTO-RESTARTS GUNICORN WITHIN 60s
           ✅ MEAL PASS SYSTEM 2.0 (IST-Aware, Schedule-Driven, Background Sync)
           ✅ FEED ADMIN FULL CRUD + COMMENT MODERATION + VIDEO SUPPORT
           ✅ PROFILE OVERHAUL (Research Interests, Weighted Score, Recap)
           ✅ ERROR REPORTING SYSTEM + SYSTEM LOG CONSOLE (v24)
           ✅ SUPPORT & HELP MODAL (8 Central Library Leaders) (v24)

Phase:     PLAY STORE REVIEW IN PROGRESS — READY FOR PRODUCTION GO-LIVE & NEXT FEATURES
```

---

## 📱 PLAY STORE SUBMISSION & POLICY COMPLIANCE MATRIX

```
Package Name:     com.etd2026.app
Release Version:  1.0.2
Version Code:     3
Target SDK:       Android 15 (API 36)
Minimum SDK:      Android 7.0 (API 24)
Supported Devices:18,717 devices
AAB Bundle Size:  20.6 MB (14.8 MB DEX size, 92% obfuscation via R8)
Distribution:     100% Full Rollout (177 Countries & Regions)
Content Rating:   Everyone / PEGI 3 (IARC Generic)
Category:         Events / Productivity
Ads Declaration:  No Ads
Health Apps:      No Health Features
Financial:        No Financial Features
Government:       Not a Government Service App

Permissions Active (32 Total — Cleaned for Google Policy):
  • android.permission.CAMERA (QR Scanning / Profile Photo)
  • android.permission.ACCESS_FINE_LOCATION / ACCESS_COARSE_LOCATION (Checkpoint Validation)
  • android.permission.ACTIVITY_RECOGNITION (Shake-to-Connect Networking)
  • android.permission.POST_NOTIFICATIONS (Session & Meal Alerts)
  • android.permission.INTERNET / ACCESS_NETWORK_STATE / VIBRATE / WAKE_LOCK

Permissions Strictly Stripped (0 Storage / Media Permissions):
  ❌ android.permission.READ_MEDIA_IMAGES (Removed via plugins/withNoMediaPermissions.js)
  ❌ android.permission.READ_MEDIA_VIDEO  (Removed via plugins/withNoMediaPermissions.js)
  ❌ android.permission.READ_MEDIA_AUDIO  (Removed via plugins/withNoMediaPermissions.js)
  ❌ android.permission.READ_EXTERNAL_STORAGE (Removed)
  ❌ android.permission.WRITE_EXTERNAL_STORAGE (Removed)

Public Policy & Compliance Web Pages:
  • Privacy Policy:      https://etd2026.iitd.ac.in/privacy-policy/
  • Account Deletion:    https://etd2026.iitd.ac.in/app-account-deletion/
  • Conference Website:  https://etd2026.iitd.ac.in/

Reviewer Test Accounts (Active on App VM Backend):
  1. Super Admin Reviewer:
     Email:    google.reviewer@iitd.ac.in
     Password: Reviewer@2026!
     Access:   Full Mobile Access + Mobile Admin Tab + Web Admin Panel

  2. Standard Delegate Reviewer:
     Email:    sudhanshu2025sharma@gmail.com
     Password: Test@1234
     Access:   Standard Attendee Features (Schedule, QR Pass, Polls, Chat, Papers)
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
│    (no cert files on this VM)                                │
└──────────────────────────────────────────────────────────────┘
                          │
                          │  Internal IITD LAN (fast, private, no SSL)
                          ▼
┌──────────────────────────────────────────────────────────────┐
│  APP VM — 10.17.9.48                                         │
│  • Django 5 (Gunicorn + Uvicorn ASGI on :8000)               │
│  • PostgreSQL 16 (etdapp DB)                                 │
│  • Redis 7 (cache + Channels layer)                          │
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

  Home dir:         /home/baadalvm/eventapp/  (on both VMs)
  User:             baadalvm
  Python:           3.12.3 (--break-system-packages)
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

---

## ⚡ ANDROID MANIFEST PERMISSION STRIPPER (Native System Photo Picker)

### `mobile/plugins/withNoMediaPermissions.js`
This Expo Config Plugin runs during manifest merging to enforce Google Play's Android 13+ Photo Picker policy:

```javascript
const { withAndroidManifest } = require('expo/config-plugins');

module.exports = function withNoMediaPermissions(config) {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults.manifest;

    if (!androidManifest.$) {
      androidManifest.$ = {};
    }
    androidManifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';

    const permissionsToRemove = [
      'android.permission.READ_MEDIA_IMAGES',
      'android.permission.READ_MEDIA_VIDEO',
      'android.permission.READ_MEDIA_AUDIO',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
    ];

    if (!androidManifest['uses-permission']) {
      androidManifest['uses-permission'] = [];
    }

    // Filter out matching permissions
    androidManifest['uses-permission'] = androidManifest['uses-permission'].filter(
      (perm) => !permissionsToRemove.includes(perm.$?.['android:name'])
    );

    // Append explicit tools:node="remove" entries to force Manifest Merger deletion
    for (const permName of permissionsToRemove) {
      androidManifest['uses-permission'].push({
        $: {
          'android:name': permName,
          'tools:node': 'remove',
        },
      });
    }

    return config;
  });
};
```

### Registered in `mobile/app.json` (At the VERY END of plugins array)
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
  }],
  "./plugins/withNoMediaPermissions.js"
]
```

---

## 📁 PROJECT STRUCTURE

```
/home/baadalvm/eventapp/               ← Repo root (both VMs mirror this)
├── .easignore                         ← Excludes backend, backups, & docs from EAS (<5MB upload)
├── backend/                           ← Django project
│   ├── start_server.sh                ← Gunicorn launcher
│   ├── keep_alive.sh                  ← Cron watchdog
│   ├── server.log                     ← nohup log
│   ├── manage.py
│   ├── .env
│   ├── confhub/
│   │   ├── settings.py                ← ALLOWED_HOSTS, CSRF, PROXY_SSL, CORS
│   │   ├── urls.py                    ← ALL panel/ and api/ routes
│   │   ├── asgi.py                    ← ProtocolTypeRouter + JWTAuthMiddleware
│   │   └── middleware.py              ← DisableCSRFForAPI
│   ├── apps/
│   │   ├── accounts/                  ← User, StaffProfile, StaffPermission (23 modules)
│   │   ├── notifications/             ← DeviceToken, Notification, UserNotification, fcm.py
│   │   ├── leaderboard/               ← PointEntry, UserPoints
│   │   ├── photos/                    ← Photo, SelfiePoint, SelfieSubmission
│   │   ├── chat/                      ← Conversation, Message, ConnectionRequest, start_support_chat
│   │   ├── schedule/                  ← ScheduleSession, ScheduleSubSession, AcceptedPaper
│   │   ├── polls/                     ← Poll, Ideathon* models
│   │   ├── checkins/                  ← CheckIn, MealPass, MealWindow
│   │   ├── sponsors/ speakers/ conferences/ events/ posts/
│   │   └── error_reports/             ← ⭐ v24 Bug Tickets + System Log Console
│   └── templates/panel/               ← ALL web admin templates (extends base.html)
│
└── mobile/                            ← Expo React Native app (SDK 57)
    ├── app.json                       ← SDK 57 schema (version: 1.0.2, versionCode: 3)
    ├── eas.json                       ← production profile (app-bundle)
    ├── .easignore
    ├── plugins/
    │   ├── withNetworkSecurity.js     ← Bundles GlobalSign R46 root cert
    │   └── withNoMediaPermissions.js  ← Strips READ_MEDIA permissions for Play Store
    └── src/
        ├── theme.js                   ← Design tokens + Auto DEV/PROD API switch
        ├── api.js                     ← apiFetch (JWT auto-refresh + FormData/JSON detection)
        ├── MainApp.js                 ← Tab router + WebSocket
        ├── notifications.js           ← Lazy require for Expo Go safety
        └── screens/
            ├── HomeTab.js             ← Day calc from live sessions
            ├── QRScreen.js            ← Dynamic meal pass generator & QR renderer
            ├── ScheduleTab.js         ← Auto-refresh technical schedule
            ├── ProfileTab.js          ← Research interests, score, Recap, Support & Error links
            ├── StaffScreen.js         ← Central library committee + Chat buttons
            ├── ReportErrorScreen.js   ← ⭐ Bug report tab + My Tickets tracking tab
            ├── SupportModal.js        ← ⭐ 2-column grid for 8 Central Library Leaders
            └── admin/
                ├── AdminTab.js        ← 12 Feature Cards (gated by permissions)
                └── ErrorReportsAdmin.js ← ⭐ Mobile Ticket CRUD + Live server log tail
```

---

## 📊 DATABASE & RBAC ARCHITECTURE

```
23 ASSIGNABLE MODULES (StaffPermission.MODULE_CHOICES):
  MANAGEMENT   participants, ideathon, meal_scanner, checkin_scanner
  CONTENT      schedule, papers, photos, checkpoint, feed
  ENGAGEMENT   polls, qa_manager, leaderboard, chat, reported_messages,
               shake_logs, chat_analytics
  SYSTEM       notifications, sponsors, speakers, users_manage,
               reports, settings, error_reports  ← ⭐ v24

ROLES: participant, attendee, speaker, super_admin, mgmt_admin, team_head, staff
ADMIN_ROLES = ('super_admin', 'mgmt_admin', 'team_head', 'staff')
```

---

## ⭐ ERROR REPORTING & SUPPORT SYSTEM (v24 Highlights)

### 1. Report Error Screen (`ReportErrorScreen.js`)
* **JSON + Base64 Upload Pattern**: Bypasses React Native SDK 57 Fabric TurboModules `FormData` binary stream issues by transmitting up to 4 screenshots as Base64 JSON strings.
* **Auto Diagnostic Payload**: Automatically appends OS version, device model, and screen dimensions.
* **User Ticket Tracking Tab**: Live status badges (`NEW` 🔴, `IN PROGRESS` 🟡, `RESOLVED` 🟢, `CLOSED` ⚪) and highlighted admin remark boxes.

### 2. Support & Help Modal (`SupportModal.js`)
* **2-Column Grid**: strictly renders the **8 Central Library & Committee Leaders** (HOD, Deputy Librarians, Assistant Librarians).
* **Full Headshot Display**: `resizeMode="contain"` with `#f8fafc` background ensures full heads are visible without awkward crops.
* **5-Minute Server Cache**: Backend `support_team_list` uses Django cache framework to reduce DB hits to zero.
* **Direct Support Chat**: Tapping "Chat" opens `TopicPickerModal` and calls `POST /api/v1/chat/support/start/<user_id>/` to instantly open a 1:1 support conversation.

### 3. Web & Mobile System Log Consoles
* **Web Admin (`/panel/error-reports/`)**: 3-Tab dashboard (User Tickets, Captured 500 Exceptions, Live Terminal Server Log Stream with 5s polling).
* **Mobile Admin (`ErrorReportsAdmin.js`)**: Real-time server log tail, RAM/CPU/PostgreSQL metrics grid, and full ticket status updates.

---

## 🎨 DESIGN TOKENS & API SWITCH (`theme.js`)

```javascript
export const COLORS = {
  brand: '#0333b6', brandDark: '#022a8f', brandDeep: '#0F172A',
  brandLight: '#e8eeff', success: '#10b981', successLight: '#d1fae5',
  error: '#ef4444', errorLight: '#fee2e2', warning: '#f59e0b', warningLight: '#fef3c7',
  purple: '#8b5cf6', teal: '#14b8a6', rose: '#f43f5e',
  text: '#0F172A', textSec: '#475569', textTer: '#94a3b8',
  border: '#e2e8f0', borderLight: '#f1f5f9',
};

export const FONT = {
  micro: 9, xs: 11, sm: 13, base: 15, md: 16,
  lg: 18, xl: 22, xxl: 26, xxxl: 32, hero: 40,
  w4: '400', w5: '500', w6: '600', w7: '700', w8: '800', w9: '900',
};

const DEV_API_URL  = 'http://10.17.9.48:8000/api/v1';
const PROD_API_URL = 'https://etd2026.iitd.ac.in/api/v1';
export const API_URL  = __DEV__ ? DEV_API_URL : PROD_API_URL;
export const API_ROOT = API_URL.replace(/\/api\/v1$/, '');
```

---

## 🔧 ESSENTIAL DEVELOPER COMMAND TOOLKIT

### 1. Server Control & Auto-Heal Watchdog
```bash
# Restart Backend Gunicorn (Run after ANY .py file change)
cd /home/baadalvm/eventapp/backend
pkill -9 -f gunicorn || true
sleep 1.5
nohup ./start_server.sh > server.log 2>&1 &

# Live Log Stream
tail -f /home/baadalvm/eventapp/backend/server.log

# Check Watchdog Cron
crontab -l
```

### 2. Local Metro Dev Server (Mobile)
```bash
cd /home/baadalvm/eventapp/mobile
npx kill-port 8081 2>/dev/null || true
EXPO_NO_DEVTOOLS=1 npx expo start --lan --port 8081
```

### 3. Verify Clean Manifest & Local Metro Bundle (Zero Cloud Cost)
```bash
cd /home/baadalvm/eventapp/mobile

# Verify Zero Syntax Errors
npx expo export --platform android --dev false > /dev/null && echo "✅ Metro Bundle 100% Valid!"

# Verify Permission Removal in Generated Native Manifest
rm -rf android
npx expo prebuild --platform android --no-install > /dev/null
grep -E "READ_MEDIA|EXTERNAL_STORAGE" android/app/src/main/AndroidManifest.xml
rm -rf android
```

### 4. EAS Cloud Build Command (Production `.aab`)
```bash
cd /home/baadalvm/eventapp
git add -A && git commit -m "chore: production build" || true

cd /home/baadalvm/eventapp/mobile
rm -rf android ios .expo dist web-build

EAS_SKIP_AUTO_FINGERPRINT=1 \
EAS_BUILD_NO_EXPO_GO_WARNING=1 \
NODE_TLS_REJECT_UNAUTHORIZED=0 \
npx eas-cli build \
  --profile production \
  --platform android \
  --non-interactive
```

---

## 🤝 WORKING RULES FOR FUTURE CHATS

```
1. Play Store Submission Status: The app is currently UNDER REVIEW at Version 1.0.2 (versionCode 3). Do NOT modify versionCode down or re-introduce READ_MEDIA permissions.
2. System Photo Picker: Always use launchImageLibraryAsync directly. Do NOT re-add requestMediaLibraryPermissionsAsync calls.
3. Base64 Upload Pattern: For mobile file/image uploads in SDK 57, prefer JSON + Base64 over FormData to prevent TurboModule crashes.
4. Gunicorn Restart: Always issue `pkill -9 -f gunicorn && nohup ./start_server.sh > server.log 2>&1 &` after modifying any .py files.
5. Apache Reload: Always execute `sudo apache2ctl configtest` BEFORE running `sudo systemctl reload apache2`.
6. Feature Array Entries: Every mobile feature card MUST contain `grad: ['#hex1', '#hex2']` to prevent LinearGradient crashes.
7. Zero Lazy Code: Always provide complete, runnable heredoc blocks (`cat << 'EOF' > path` or `python3 << 'EOF'`).
```

---

**🎯 END OF CONTEXT WINDOW v24 (PRODUCTION & PLAY STORE SUBMITTED)**