# 🎯 ETD 2026 CONFERENCE APP — Complete Context Window (v25)

```
Product:   Conference Management Platform
Event:     ETD 2026 — "ETDs in the age of AI" — IIT Delhi
Website:   https://etd2026.iitd.ac.in/
Type:      Mobile App (React Native Expo SDK 57) + Web Admin Panel (Django MVT)
GitHub:    github.com/Sharma1907/eventapp
Dev Env:   IITD Baadal VMs — Ubuntu 24.04 LTS, 24/7

Status:    🚀 SUBMITTED TO APPLE APP STORE — WAITING FOR REVIEW
           • Version: 1.0 (Build 1.0.2 #2)
           • Bundle Identifier: com.etd2026.app
           • App Store Connect App ID: 6820529255
           • App Store Privacy Policy: https://etd2026.iitd.ac.in/app-privacy-policy/
           • App Store Account Deletion: https://etd2026.iitd.ac.in/app-account-deletion/
           • Age Rating: 13+ | Price: Free ($0.00 in 175 regions) | Content Rights: Declared
           • Digital Services Act (DSA): Active & Compliant (Non-trader)
           • iOS Screenshots: 5 high-res screenshots uploaded
           • Test Credentials: Verified live in Postgres DB for Apple Reviewer

           ✅ EXPO SDK 57 (React Native 0.86.3 New Architecture / Fabric)
           ✅ iOS UI AUDIT COMPLETE (Dynamic Island/Notch safe areas, 44pt touch targets,
              overFullScreen modals, cross-platform shadows, KeyboardAvoidingView)
           ✅ ANDROID APK SIZE OPTIMIZED (~25-35MB via ProGuard/R8)
           ✅ ANDROID SSL CERT BUNDLED (GlobalSign R46 for IITD wildcard cert)
           ✅ PUSH NOTIFICATIONS DELIVERING (Expo Push API via IITD proxy + APNs ready)
           ✅ CRON WATCHDOG AUTO-RESTARTS GUNICORN WITHIN 60s
           ✅ ERROR REPORTING SYSTEM (JSON+Base64 upload, SystemLogEntry, web/mobile log console)
           ✅ SUPPORT & HELP MODAL (8 Central Library Leaders, TopicPickerModal, 1:1 chat)

Phase:     PRODUCTION-READY — APP STORE REVIEW PENDING
```

---

## 📱 APPLE APP STORE SUBMISSION SNAPSHOT

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ APPLE APP STORE CONNECT — SUBMISSION DETAILS                                │
├─────────────────────────────────────────────────────────────────────────────┤
│ App Name:         ETD 2026                                                  │
│ Subtitle:         ETDs in the age of AI                                     │
│ Bundle Identifier: com.etd2026.app                                          │
│ ASC App ID:       6820529255                                                │
│ SKU:              EX1791463084291                                           │
│ Version:          1.0 (Build 1.0.2 #2)                                      │
│ Category:         Education                                                 │
│ Price:            Free ($0.00 in 175 Countries/Regions)                     │
│ Age Rating:       13+ (UGC & Chat features declared)                        │
│ Status:           WAITING FOR REVIEW                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│ DATA PRIVACY & COMPLIANCE DECLARATIONS                                      │
│ • Privacy Policy URL:  https://etd2026.iitd.ac.in/app-privacy-policy/       │
│ • Account Deletion:    https://etd2026.iitd.ac.in/app-account-deletion/      │
│ • Data Collected:      6 Types (Name, Email, Phone, Precise Location,       │
│                        Photos/Videos, User ID)                              │
│ • Data Usage:          App Functionality Only (Linked to Identity,          │
│                        NO 3rd-Party Tracking)                               │
│ • DSA Compliance:      Active & Confirmed (Non-Trader Status)               │
│ • Content Rights:      Confirmed (No unauthorized 3rd-party content)         │
│ • Encryption:          Non-exempt encryption false (Standard HTTPS only)    │
├─────────────────────────────────────────────────────────────────────────────┤
│ TEST CREDENTIALS CONFIGURED FOR APPLE REVIEW TEAM                           │
│ 1. PARTICIPANT TEST ACCOUNT (Primary Mobile Login):                         │
│    • Email:    applereviewer@test.com                                       │
│    • Password: Test@1234                                                    │
│    • Status:   Pre-checked-in with active conference access, meal passes,   │
│                certificate download, live polls, and 105 test delegates.   │
│                                                                             │
│ 2. ADMIN TEST ACCOUNT (Mobile Admin & Web Panel):                           │
│    • Email:    admin.reviewer@test.com                                      │
│    • Password: Admin-Test@1234                                              │
│    • Web Panel: https://etd2026.iitd.ac.in/panel/login                       │
│    • Status:   Full Super Admin access (QR Scanner, Error Logs, Schedule). │
└─────────────────────────────────────────────────────────────────────────────┘
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

  Home dir:         /home/baadalvm/eventapp/  (on both VMs)
  User:             baadalvm
  Python:           3.12.3 (--break-system-packages)
```

---

## ⚡ BACKEND SERVER & WATCHDOG COMMANDS

```bash
# RESTART BACKEND SERVER (Run on App VM after Python changes)
cd /home/baadalvm/eventapp/backend
pkill -9 -f gunicorn || true
sleep 1.5
nohup ./start_server.sh > server.log 2>&1 &

# VIEW LIVE LOGS
tail -f /home/baadalvm/eventapp/backend/server.log

# DJANGO MANAGEMENT
cd /home/baadalvm/eventapp/backend
python3 manage.py makemigrations <app>
python3 manage.py migrate
python3 manage.py check
python3 manage.py collectstatic --noinput
```

---

## 🎨 iOS & CROSS-PLATFORM UI RESPONSIVENESS ARCHITECTURE

All screens dynamically adapt to both iOS (iPhone SE to 16 Pro Max) and Android via tokens in `mobile/src/theme.js`:

```javascript
// mobile/src/theme.js
const { width: W, height: H } = Dimensions.get('window');
const isIos = Platform.OS === 'ios';
const isSmallIos = isIos && H <= 667; // iPhone SE, 8, 7, 6s

export const TOP = isIos ? (isSmallIos ? 28 : 54) : 44;
export const BOTTOM = isIos ? (isSmallIos ? 34 : 16) : 16;
export const IS_SMALL_DEVICE = W <= 375;

// Media URL normalization (forces HTTPS for iOS ATS compliance)
export function fixMediaUrl(url) {
  if (!url) return null;
  if (url.startsWith('http://')) return url.replace('http://', 'https://');
  if (url.startsWith('https://')) return url;
  return `${PROD_API_URL.replace('/api/v1', '')}${url.startsWith('/') ? '' : '/'}${url}`;
}
```

### Key UI Safeguards Active
1. **Dynamic Island & Notch:** Screen headers use `paddingTop: TOP + 8`.
2. **iPhone Home Indicator Bar:** Bottom tab bar, chat input, and floating modals use `BOTTOM` clearance (`34pt`). All scrollable lists include `paddingBottom: 140 + BOTTOM` in `contentContainerStyle`.
3. **Modal Presentation:** All 25+ `<Modal>` instances use `presentationStyle="overFullScreen"` (or `fullScreen` for QR scanner) to prevent the iOS 13+ pageSheet glitch and swipe-to-dismiss bugs.
4. **Touch Targets:** Navigation chevrons, close buttons, and small icons use `hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}` to guarantee Apple HIG 44×44pt tap target compliance.
5. **Keyboard Handling:** Input forms wrap content in `KeyboardAvoidingView` with `behavior={Platform.OS === 'ios' ? 'padding' : undefined}` and `TouchableWithoutFeedback` for tap-outside dismissal.
6. **Cross-Platform Shadows:** `theme.js` SHADOW tokens combine Android `elevation` with iOS `shadowColor`, `shadowOffset`, `shadowOpacity`, and `shadowRadius`.

---

## 📁 PROJECT STRUCTURE

```
/home/baadalvm/eventapp/
├── backend/                           ← Django 5 project
│   ├── start_server.sh                ← Gunicorn launcher
│   ├── keep_alive.sh                  ← Cron watchdog
│   ├── server.log                     ← Gunicorn log file
│   ├── confhub/
│   │   ├── settings.py                ← ALLOWED_HOSTS, CORS, CSRF
│   │   ├── urls.py                    ← Master URL routing
│   │   └── asgi.py                    ← WebSockets & JWT Auth
│   ├── apps/
│   │   ├── accounts/                  ← User model, RBAC (23 modules), support_team_list
│   │   ├── notifications/             ← Expo Push API (fcm.py)
│   │   ├── checkins/                  ← CheckIn, MealPass, MealWindow
│   │   ├── schedule/                  ← ScheduleSession, ScheduleSubSession, AcceptedPaper
│   │   ├── chat/                      ← Conversation, Message, start_support_chat
│   │   ├── error_reports/             ← ErrorReport, SystemLogEntry, ErrorCaptureMiddleware
│   │   └── leaderboard/ photos/ polls/ sponsors/ speakers/ posts/
│   └── templates/panel/               ← Hand-rolled Django MVT Web Admin Panel
│
└── mobile/                            ← Expo SDK 57 React Native app
    ├── App.js
    ├── app.json                       ← Bundle ID: com.etd2026.app, infoPlist permissions
    ├── eas.json                       ← Preview & Production profiles
    ├── package.json                   ← SDK 57 dependencies
    ├── plugins/                       ← withNetworkSecurity.js
    └── src/
        ├── theme.js                   ← TOP, BOTTOM, COLORS, SHADOW tokens, fixMediaUrl
        ├── api.js                     ← apiFetch (JWT auto-refresh + FormData detection)
        ├── MainApp.js                 ← Custom tab router + bottom tab bar
        └── screens/                   ← 35+ screen files fully audited for iOS & Android
```

---

## 🔐 TEST CREDENTIALS (LIVE ON PRODUCTION DB)

```
APPLE REVIEWER (PARTICIPANT)
  Email:    applereviewer@test.com
  Password: Test@1234
  Features: Checked-in, active meal passes, certificate, live polls, 105 delegates

ADMIN REVIEWER (SUPER ADMIN)
  Email:    admin.reviewer@test.com
  Password: Admin-Test@1234
  Features: Full Mobile Admin scanner/logs & Web Panel access

WEB ADMIN PANEL
  URL:      https://etd2026.iitd.ac.in/panel/login/
  Login:    etd@admin.iitd.ac.in / <ASK> or admin.reviewer@test.com / Admin-Test@1234
```

---

## 🤝 WORKING AGREEMENT FOR AI ASSISTANTS

```
1. DO NOT modify app.json bundleIdentifier ('com.etd2026.app') or version without explicit instruction.
2. ALWAYS restart Gunicorn server (pkill -9 -f gunicorn && nohup ./start_server.sh > server.log 2>&1 &) after backend .py edits.
3. ALWAYS preserve the adaptive TOP and BOTTOM safe area tokens in theme.js for mobile screens.
4. ALWAYS use fixMediaUrl() for image/media URIs to enforce HTTPS compliance.
5. ALWAYS check for existing helpers in theme.js, api.js, and components.js before writing new code.
6. When generating terminal edits, give code in runnable `python3 << 'EOF'` or `cat << 'EOF' > path` blocks.
```