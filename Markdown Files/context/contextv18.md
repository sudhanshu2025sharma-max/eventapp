# 🎯 ETD 2026 CONFERENCE APP — Complete Context Window (v18)

# ETD 2026 Conference Platform — Full Session Context (v18 — Post-Meal-Sync-Hardening)

## 📌 PROJECT OVERVIEW

```
Product:   Conference Management Platform
Event:     ETD 2026 — "ETDs in the age of AI" — IIT Delhi
Website:   https://etd2026.iitd.ac.in/
Type:      Mobile App (React Native Expo) + Web Admin Panel (Django MVT)
GitHub:    github.com/Sharma1907/eventapp
Dev Env:   IITD VM (baadalvm) — Ubuntu 24.04 LTS, 8 cores, 7.7GB RAM, 24/7

Status:    ALL v17 FEATURES + FULLY WORKING MEAL SYSTEM WITH SCHEDULE-DRIVEN
           AUTOMATION + MANUAL OVERRIDE + TIMEZONE-AWARE (IST) + PARTICIPANT
           CHECK-IN GATED + REAL-TIME PUSH NOTIFICATIONS + POLISHED QR SCREEN
           + POLISHED HOME SCREEN COUNTDOWN/PROGRESS

Certification (from v17):
  Grade:          A
  Score:          94.8 / 100
  Verdict:        PRODUCTION READY
  Certificate ID: 108B8D7797E7D68F
```

---

## 🖥️ INFRASTRUCTURE (IITD VM)

```
OS:         Ubuntu 24.04 LTS
IP:         10.17.9.48 (PRIVATE — IITD campus network or VPN only)
User:       baadalvm
Home:       /home/baadalvm
Project:    /home/baadalvm/eventapp/
Python:     3.12.3 (system-wide, NO virtualenv, --break-system-packages)
Node:       v20.20.2 (snap)
npm:        10.8.2

ASGI:       Gunicorn 21.2.0 + Uvicorn 0.27.1 + uvloop 0.19.0
PostgreSQL: 16 (system service) — max_connections = 300
Redis:      7 (system service) — 83,406 ops/sec measured
coturn:     STUN/TURN on 10.17.9.48:3478 (system service)
            Username: etd | Password: etd2026turn

Access:
  Admin Panel: http://10.17.9.48:8000/panel/login/
  API:         http://10.17.9.48:8000/api/v1/
  WebSocket:   ws://10.17.9.48:8000/ws/call/?token=<jwt>
  Expo:        npx expo start --lan --port 8081
  Media:       http://10.17.9.48:8000/media/
  TURN/STUN:   turn:10.17.9.48:3478 / stun:10.17.9.48:3478
```

### DB Credentials (backend/.env)
```
USE_POSTGRES=True
DB_NAME=etdapp
DB_USER=etdapp_admin
DB_PASSWORD=<ASK>
DB_HOST=localhost
DB_PORT=5432
REDIS_URL=redis://127.0.0.1:6379/0

# Email (IITD SMTP)
EMAIL_HOST=smtp.iitd.ac.in
EMAIL_PORT=465
EMAIL_USE_TLS=False
EMAIL_USE_SSL=True
EMAIL_HOST_USER=yourname@iitd.ac.in
EMAIL_HOST_PASSWORD=your_kerberos_password
DEFAULT_FROM_EMAIL=yourname@iitd.ac.in
```

### IITD Proxy Constraints
```
Proxy: proxy21.iitd.ac.in:3128
  ✗ Blocks ngrok / cloudflared / all tunnels
  ✗ SSL inspection breaks cert verification
  ✓ pip:  works with --break-system-packages
  ✗ npm:  SSL verify FAILS
    Workaround: NODE_TLS_REJECT_UNAUTHORIZED=0 npm install <pkg> --strict-ssl=false
  ✓ curl to internal VM: MUST use --noproxy "*"
  ✓ Python scripts hitting the VM: build opener with empty ProxyHandler
  ✓ Expo Push API in fcm.py: uses proxy + verify=False
```

### EAS Build
```
eas-cli local in mobile/:
  NODE_TLS_REJECT_UNAUTHORIZED=0 npm install --save-dev eas-cli --strict-ssl=false
Login: NODE_TLS_REJECT_UNAUTHORIZED=0 npx eas login
Build: NODE_TLS_REJECT_UNAUTHORIZED=0 npx eas build --profile development --platform android
Project ID: afa28d7e-10d5-4e85-bed4-783b7371a56b
Owner:      coder2026s-team

⚠ .easignore at BOTH repo root AND mobile/; .npmrc legacy-peer-deps=true
⚠ expo-dev-client: JS hot-reloads; native rebuild only for new native modules
```

---

## ⭐ PRODUCTION SERVER — Gunicorn + Uvicorn

**File: `backend/start_server.sh`** (chmod +x)
```bash
#!/usr/bin/env bash
set -e
cd /home/baadalvm/eventapp/backend
export PYTHONUNBUFFERED=1     # ← REQUIRED for real-time logs
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

### ⚡ Backend Command Toolkit
```bash
# 🚀 START (background, always cd into backend/ first)
cd /home/baadalvm/eventapp/backend
pkill -f gunicorn || true
sleep 1
nohup ./start_server.sh > server.log 2>&1 &

# 🛑 STOP
pkill -f gunicorn || true

# 🔄 RESTART (after ANY .py change — no hot reload!)
cd /home/baadalvm/eventapp/backend
pkill -f gunicorn || true
sleep 1.5
nohup ./start_server.sh > server.log 2>&1 &

# 📡 LIVE LOGS
tail -f /home/baadalvm/eventapp/backend/server.log

# 📊 CHECK RUNNING
ps aux | grep gunicorn | grep -v grep

# 📱 FCM/Push logs filter
tail -f /home/baadalvm/eventapp/backend/server.log | grep --line-buffered -iE "expo|fcm|push|notification"
```

⚠️ **CRITICAL RULES:**
- Gunicorn does **NOT** hot-reload — restart after every `.py` change
- `--lifespan off` does **NOT** work in Gunicorn CLI (only bare uvicorn)
- `screen` is **NOT** installed — use `nohup`
- Always `cd /home/baadalvm/eventapp/backend` before running any Django shell scripts

---

## 📁 PROJECT STRUCTURE

```
/home/baadalvm/eventapp/
├── .easignore
├── backend/                           ← Django project root
│   ├── start_server.sh                ← Gunicorn launcher (PYTHONUNBUFFERED=1)
│   ├── server.log                     ← nohup log target
│   ├── manage.py
│   ├── .env
│   ├── requirements.txt               ← + gunicorn, uvicorn, uvloop, qrcode[pil]
│   ├── confhub/                       ← Django config
│   │   ├── settings.py
│   │   ├── urls.py                    ← ALL routes wired here
│   │   ├── asgi.py                    ← ProtocolTypeRouter + JWTAuthMiddleware
│   │   ├── wsgi.py
│   │   └── middleware.py              ← DisableCSRFForAPI
│   ├── apps/                          ← Django apps
│   │   ├── accounts/
│   │   ├── notifications/
│   │   ├── leaderboard/
│   │   ├── photos/
│   │   ├── chat/
│   │   ├── schedule/
│   │   ├── polls/
│   │   ├── checkins/                  ← ★ HEAVILY MODIFIED IN v18
│   │   ├── sponsors/
│   │   ├── speakers/
│   │   ├── conferences/
│   │   ├── events/
│   │   └── posts/
│   ├── templates/                     ← ★ CENTRAL TEMPLATE FOLDER
│   │   └── panel/                     ← ALL web admin templates extend base.html
│   ├── static/                        ← STATICFILES_DIRS source
│   ├── staticfiles/                   ← STATIC_ROOT (collectstatic target)
│   └── media/                         ← User uploads
│
├── mobile/                            ← Expo React Native app
│   ├── App.js  index.js  babel.config.js  eas.json
│   ├── app.json  package.json  .npmrc  .easignore
│   ├── google-services.json
│   └── src/
│       ├── theme.js                   ← COLORS, FONT (FLAT), SPACE, RADIUS, API_URL
│       ├── components.js              ← PulsingDot, GradientAvatar, FadeIn, Badge
│       ├── cache.js                   ← 5-min TTL AsyncStorage helper
│       ├── api.js                     ← apiFetch (auto-refresh JWT, FormData aware)
│       ├── MainApp.js                 ← Tab router + subScreen + call Modal
│       ├── notifications.js
│       ├── utils/geo.js
│       └── screens/
│           ├── HomeTab.js             ← ★ v18: countdown + progress + 3D tilt
│           ├── QRScreen.js            ← ★ v18: photo, kit card, meal QR gated
│           ├── ScheduleTab.js
│           ├── NetworkScreen.js
│           ├── ProfileTab.js  NotificationsScreen.js
│           ├── EditProfileScreen.js  ChangePasswordScreen.js
│           ├── SponsorsScreen.js  SponsorDetailScreen.js
│           ├── SpeakersScreen.js  SpeakerDetailScreen.js
│           ├── ChatListScreen.js  ChatRoomScreen.js  ContactCardModal.js
│           ├── TopicPickerModal.js  SpeakerRequestModal.js
│           ├── ConnectionRequestsScreen.js  LeaderboardScreen.js
│           ├── PhotosScreen.js  PollsScreen.js  IdeathonScreen.js
│           ├── ShakeConnectScreen.js  RecapScreen.js  CheckpointScreen.js
│           ├── VoiceCallScreen.js
│           ├── StaffScreen.js  StaffDetailScreen.js  StaffGroupChatScreen.js
│           ├── FeedScreen.js
│           └── admin/
│               ├── AdminTab.js
│               ├── CheckInScreen.js   ← ★ v18: original 3-tab design restored
│               ├── NotificationsAdmin.js
│               ├── UsersAdmin.js
│               ├── AddParticipantScreen.js
│               ├── ScheduleAdmin.js  PhotosAdmin.js  PollsAdmin.js
│               ├── IdeathonAdmin.js  CheckpointAdminScreen.js
│               ├── CallLogsAdmin.js
│               └── StaffAdminScreen.js
│
├── eventapp/                          ⚠️ DUPLICATE CLONE (nested)
│   └── mobile/src/screens/            ← Legacy copy — patches sometimes need both
│
└── production_certification/          ← Load test suite
    ├── run_certification.py
    ├── config/thresholds.py
    ├── monitors/
    ├── layers/
    └── results/certification_<ts>/
```

⚠️ **DUPLICATE FOLDER WARNING**  
There is a nested clone at `/home/baadalvm/eventapp/eventapp/`. Canonical files are at `mobile/src/` — but when patching, always copy to both:
```bash
cp /home/baadalvm/eventapp/mobile/src/screens/<file>.js /home/baadalvm/eventapp/eventapp/mobile/src/screens/<file>.js 2>/dev/null || true
```

---

## 🎨 CENTRAL TEMPLATE SYSTEM — HOW IT'S WIRED

This is a **hand-rolled Django MVT admin panel**, completely separate from `django.contrib.admin`.

### Resolution Chain
```
settings.TEMPLATES[0]['DIRS'] = [BASE_DIR / 'templates']
   BASE_DIR = /home/baadalvm/eventapp/backend
   →  /home/baadalvm/eventapp/backend/templates/

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

### base.html — Dynamic Permission-Gated Sidebar
`staff_permissions_context` (registered in `settings.TEMPLATES`) runs on **every** render and injects:
```python
{'user_permissions': [...], 'is_super_admin': bool}
```

Every sidebar item is wrapped:
```django
{% if is_super_admin or "checkin_scanner" in user_permissions %}
  <a href="/panel/checkins/scanner/" class="menu-item">Check-In Scanner</a>
{% endif %}
```

### Full Template Inventory (`backend/templates/panel/`)
```
base.html                     ← master layout, dynamic sidebar
login.html                    dashboard.html
participants_list.html        participants_upload.html
participants_preview.html     participant_add.html   participant_edit.html
checkin_list.html             scanner.html           ← ★ v18: expects data.meal.is_open
                                                        + data.checked_in/remaining/total
notifications.html            notification_edit.html
speakers_list.html            speaker_form.html
sponsors_list.html            sponsor_form.html
users_manage.html             events_list.html       event_form.html
conference_settings.html
password_reset_request.html   password_reset_confirm.html
schedule_list.html            schedule_form.html
schedule_feedback.html        schedule_analytics.html
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

# WebSocket: ws://10.17.9.48:8000/ws/call/?token=<jwt>
```

---

## ⭐ MEAL PASS SYSTEM — THE COMPLETE PICTURE (v18)

### Architecture Overview
```
┌─────────────────────────────────────────────────────────────┐
│         SCHEDULE (Source of Truth: DB ScheduleSession)      │
│  Session Type = 'meal' OR title contains: lunch/dinner/     │
│                 breakfast/tea                                │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  sync_meal_window()  (apps/checkins/meal_utils.py)          │
│  Uses zoneinfo.ZoneInfo("Asia/Kolkata") for IST             │
│                                                               │
│  Triggered by:                                              │
│  • Every GET /api/v1/notifications/unread-count/  (30s poll)│
│  • Every GET /api/v1/checkins/meal/status/       (15-20s)  │
│  • Every GET /panel/checkins/meal-window-status/           │
│  • Celery beat: check_meal_notifications (every 60s)       │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  Unified MealWindow (meal_type='meal', date=today)          │
│                                                               │
│  RULES:                                                      │
│  • Inside scheduled slot → is_open=True (opened_by=None)   │
│    + push "🍽️ [Title] is now open!" (once)                 │
│  • Outside all slots + no manual hold → is_open=False      │
│    + push "🛑 Meal service is now closed" (once)           │
│  • MANUAL admin toggle → sets opened_by=<user>              │
│    → sync respects and does NOT auto-close                   │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  PARTICIPANT CHECK-IN GATE                                   │
│  Only users with CheckIn(checkin_type='conference')          │
│  can call POST /api/v1/checkins/meal/generate/               │
│  Others get: "You must check in at the registration desk"   │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  MealPass Generation                                         │
│  UUID-based, one active pass per user per day                │
│  Only returned by API when window is_open                    │
│  QR displayed on mobile QRScreen when meal card is active    │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  Scanning at Food Counter                                    │
│  Mobile: CheckInScreen Meal tab → paste/scan QR             │
│  Web:    /panel/checkins/scanner/ Meal Pass mode            │
│  Accepts: raw UUID | JSON payload | Registration ID         │
│  Marks: used=True, used_at=now, scanned_by=<staff>          │
│  Awards points via leaderboard.utils.award_points()          │
└─────────────────────────────────────────────────────────────┘
```

### Timezone Handling
```
Database:    stores UTC datetimes
Local time:  Asia/Kolkata (IST, UTC+5:30)
Conversion:  from zoneinfo import ZoneInfo
             IST = ZoneInfo("Asia/Kolkata")
             now_ist = timezone.now().astimezone(IST)
```

### Meal Pass Data Model
```python
class MealPass(models.Model):
    id = UUIDField(primary_key=True)
    user = ForeignKey(User, null=True, blank=True)  # NULL for walk-ins
    meal_type = CharField(max_length=20, default='meal')  # UNIFIED as 'meal'
    date = DateField()
    is_active = BooleanField(default=True)
    used = BooleanField(default=False)
    used_at = DateTimeField(null=True)
    scanned_by = ForeignKey(User, null=True)
    # Walk-in fields (populated when user is NULL)
    guest_name = CharField(max_length=200, blank=True)
    guest_email = EmailField(blank=True)
    guest_phone = CharField(max_length=20, blank=True)
    guest_reg_no = CharField(max_length=50, blank=True)
    created_at = DateTimeField(auto_now_add=True)
    
    @property display_name  → user.get_full_name() or guest_name
    @property display_email → user.email or guest_email
    @property display_reg   → user.registration_id or guest_reg_no

class MealWindow(models.Model):
    meal_type = CharField(max_length=20, default='meal')  # UNIFIED as 'meal'
    date = DateField()
    start_time = TimeField(null=True)
    end_time = TimeField(null=True)
    notify_open_minutes_before = PositiveIntegerField(default=15)
    notify_close_minutes_before = PositiveIntegerField(default=10)
    is_open = BooleanField(default=False)
    opened_by = ForeignKey(User, null=True)  # Set = manual override active
    opened_at = DateTimeField(auto_now_add=True)
    closed_at = DateTimeField(null=True)
    notified_opening = BooleanField(default=False)  # one-shot push guard
    notified_closing = BooleanField(default=False)
```

### Meal Type Normalization (max 20 chars for DB varchar)
```python
if "lunch" in title:     meal_name = "lunch"
elif "dinner" in title:  meal_name = "dinner"
elif "breakfast" in title: meal_name = "breakfast"
elif "tea" in title:     meal_name = "tea"
else:                    meal_name = title[:20]
```

⚠️ **BUT unified system uses `meal_type='meal'` for the single active window**  
Legacy multi-type rows must be cleaned:
```python
MealWindow.objects.filter(date=today).exclude(meal_type='meal').delete()
```

### Key Files
```
apps/checkins/meal_utils.py      ← sync_meal_window() core logic
apps/checkins/views.py           ← API endpoints (mobile)
apps/checkins/admin_views.py     ← Web admin views + AJAX handlers
apps/checkins/tasks.py           ← Celery beat: check_meal_notifications
apps/checkins/push.py            ← push_to_checked_in() using fcm.send_to_all()
apps/checkins/urls.py            ← API routes
apps/checkins/admin_urls.py      ← Web admin routes
```

### API Compatibility Contract (CRITICAL)
```python
# ── MOBILE clients expect ──
{
  "success": True,           # NOT "status": "success"
  "message": "...",
  "meal_window": {           # Nested object for mobile
    "is_open": True,
    "start_time": "01:00 PM",
    "end_time": "01:45 PM"
  }
}

# ── WEB scanner.html expects ──
{
  "meal": {                  # Nested under "meal" key!
    "is_open": True,
    "start_time": "13:00",
    "end_time": "13:45"
  }
}

# ── stats endpoint (panel_stats) expects ──
{
  "checked_in": 42,          # exact key names!
  "remaining": 58,
  "total": 100
}
```

### Full Meal API Endpoints
```
GET    /api/v1/checkins/meal/status/        → mobile meal window + user's pass
POST   /api/v1/checkins/meal/generate/      → gated by check-in + window open
POST   /api/v1/checkins/meal/scan/          → verify QR (raw UUID/JSON/reg ID)
POST   /api/v1/checkins/meal/window/        → toggle (action: 'open'/'close')
POST   /api/v1/checkins/meal/window/schedule/  → set schedule (stub)
GET    /api/v1/checkins/meal/stats/         → issued/redeemed counts
GET    /api/v1/checkins/meal/list/          → today's passes
POST   /api/v1/checkins/meal-pass/create/   → walk-in guest pass + email QR
GET    /api/v1/checkins/meal-pass/mine/     → user's passes

GET    /panel/checkins/scanner/                → web scanner page
GET    /panel/checkins/meal-window-status/     → AJAX: nested {meal:{...}}
POST   /panel/checkins/meal/window/            → AJAX toggle
POST   /panel/checkins/meal/scan/              → AJAX QR scan
POST   /panel/checkins/meal-pass/              → AJAX walk-in guest pass
GET    /panel/checkins/stats/                  → AJAX {checked_in,remaining,total}
```

---

## 🏠 HOME SCREEN — POLISHED FEATURES (v18)

### `mobile/src/screens/HomeTab.js`

**Countdown / Progress Bar Logic:**
```
Phase 1: Before Conference Start
  → Countdown to first session
  → Label: "Countdown for [Session Title]"
  → Pill: "Starting Soon"

Phase 2: During Active Day
  → Progress bar 0-100%
  → Pill: "Day X of N"

Phase 3: Between Days (after last session of day, before next day's first)
  → Countdown to next day's first session
  → Pill: "Day X End"

Phase 4: After Conference End
  → Progress bar at 100%
  → Pill: "Completed"
```

**Ticking Engine:** `setInterval(setNow(new Date()), 1000)` — 1Hz real-time

**Loading Skeleton:** Reusable `<Skeleton>` component with shimmer animation.  
`loaded` state flips true only after first successful fetch → no flash of wrong content.

**3D Tilt Hero Card:** `HeroCard` wrapper uses `PanResponder`:
- Captures touch coordinates
- Maps to rotateX/rotateY (±5°) with `perspective: 1000`
- Springs back on release
- Feels like pressing a physical card

**Dynamic Venue Display:** Top-right corner shows:
- Live session's `room` (with "LIVE VENUE" label + pulsing dot) — if session is live
- Next upcoming session's `room` (with "VENUE" label) — fallback
- `conf.tagline` ("IIT Delhi") — final fallback

**Live Session Card:**
- Wrapped in `TouchableOpacity` → tap opens Schedule tab
- "Ends in Xm" pill when session has ≤15 min remaining
- "Tap to view schedule" hint

---

## 🎫 QR SCREEN — POLISHED (v18)

### `mobile/src/screens/QRScreen.js`

**Design (preserved from original):**
- Holographic shimmer overlay (rotating light bar)
- Perforated edges (top + bottom dots)
- Notch cutouts (left/right semicircles)
- Dashed tear line
- Verified seal at bottom
- Full attendee ticket card

**v18 Additions:**
1. **Participant photo displayed** — Uses `<Image>` with `fixMediaUrl(user.profile_photo_url)`, falls back to `GradientAvatar` if no photo
2. **Email in BLACK** — Changed from gray `textTer` to `text` color with `fontWeight: '600'`
3. **Prominent Kit Status Card** — Full-width card between attendee info and QR:
   - Green background if received, amber if pending
   - Gift icon in solid color box
   - Big "✓ Received" or "Not yet collected" status text
4. **Meal Pass Card** (below main ticket):
   - Reads `mealInfo.is_open`, `mealInfo.meal_pass`
   - Shows "LIVE NOW" with pulsing red dot when meal is open
   - Buttons:
     - `Show QR` — only if `isMealOpen && existingPass && !used`
     - `Generate` — only if `isMealOpen && !existingPass`
     - Clock icon — if closed
   - Refuses to show QR when window is closed (backend also enforces this)

**QR Renderer:** Uses `qrcode-generator` npm package with SVG rendering:
```js
import Svg, { Rect } from 'react-native-svg';
import qrGenerator from 'qrcode-generator';
```

**Meal Pass Modal:** Full-screen modal with QR + "Show this QR to staff at the meal venue"

---

## 👨‍💼 ADMIN CHECK-IN SCREEN (v18)

### `mobile/src/screens/admin/CheckInScreen.js` — ORIGINAL DESIGN PRESERVED

**3 Tabs:**
1. **Check In** — Registration ID entry + camera QR scan
2. **Meal** — Window status pill + Open/Close buttons + "Issue Custom Meal Pass (Guest)" button + scan interface
3. **History** — Sub-tabs: Meal Passes | Check-Ins (uses FlatList outside ScrollView to avoid VirtualizedList warning)

**Custom Meal Pass Modal (`CreateMealPassModal`):**
- Fields: Guest Name*, Email, Phone, Reg No
- POST `/checkins/meal-pass/create/` with all fields
- Emails QR PNG attachment if email provided (via IITD SMTP)
- Uses `authHeaders(tokens)` pattern with raw `fetch()`

**API Response Contract:**
- All endpoints return `{ "success": true/false, "message": "..." }`
- Client checks `data.success` for branch logic

---

## 🌐 WEB ADMIN SCANNER (v18)

### `backend/templates/panel/scanner.html`

**JavaScript Expectations (must match backend exactly):**

```javascript
// Meal Window Status Poll
const res = await fetch('/panel/checkins/meal-window-status/');
const data = await res.json();
const isOpen = data.meal && data.meal.is_open;  // NESTED under "meal" key!

// Stats Poll
const res = await fetch('/panel/checkins/stats/');
document.getElementById('statsBody').innerHTML = `
  <div>${data.checked_in}</div>   // exact keys!
  <div>${data.remaining}</div>
  <div>${data.total}</div>
`;

// Toggle Window
await fetch('/panel/checkins/meal/window/', {
  method: 'POST',
  headers: {'Content-Type': 'application/json', 'X-CSRFToken': ...},
  body: JSON.stringify({ action })  // action: 'open' | 'close'
});

// Custom Pass (form-urlencoded!)
await fetch('/panel/checkins/meal-pass/', {
  method: 'POST',
  headers: {'Content-Type': 'application/x-www-form-urlencoded', 'X-CSRFToken': ...},
  body: new URLSearchParams({
    guest_name, guest_email, guest_phone, guest_reg_no,
    action: 'create_pass'
  })
});
```

---

## 🔔 PUSH NOTIFICATION SYSTEM

### Architecture
```
fcm.py (_send_expo)
  → Expo Push API (https://exp.host/--/api/v2/push/send)
  → Routes through IITD proxy (proxy21.iitd.ac.in:3128)
  → verify=False (IITD SSL inspection)
  → Returns success/failure counts

fcm.py (send_to_all / send_to_role / send_to_user)
  → Creates UserNotification rows (delivered=True)
  → Calls _send_hybrid (Expo + FCM fallback)
  → Returns (success, failed, bad_tokens)

apps/checkins/push.py (push_to_checked_in)
  → Creates Notification(status='pending')
  → Calls fcm.send_to_all() (creates UserNotification rows)
  → Updates notif.status='sent', notif.sent_count=N
  → Deactivates bad tokens
```

### Deep-Link Data Payloads
```json
{"type": "meal_pass", "screen": "qr"}              → opens QR tab
{"type": "new_message", "conversation_id": "..."}  → opens chat room
{"type": "connection_request"}                     → opens connection requests
{"type": "feed_post"}                              → opens feed tab
{"type": "session_reminder", "session_id": "..."}  → opens schedule
{"type": "checkin_success"}                        → opens QR tab
{"type": "voice_call", "caller_name": "..."}       → incoming call handler
```

---

## 🔐 AUTH & RBAC

```
ROLES: participant, attendee, speaker, super_admin, mgmt_admin, team_head, staff
ADMIN_ROLES = ('super_admin', 'mgmt_admin', 'team_head', 'staff')

21 ASSIGNABLE MODULES (StaffPermission.MODULE_CHOICES)
  MANAGEMENT  participants, ideathon, meal_scanner, checkin_scanner
  CONTENT     schedule, photos, checkpoint, feed
  ENGAGEMENT  polls, qa_manager, leaderboard, chat, reported_messages,
              shake_logs, chat_analytics
  SYSTEM      notifications, sponsors, speakers, users_manage, reports, settings

ENFORCEMENT POINTS
  Web view:     @module_required('key')
  DRF view:     @api_module_required('key')
  Web template: {% if is_super_admin or "key" in user_permissions %}
  Mobile:       AdminTab filters ALL_FEATURES by user.permissions[]
```

---

## 📊 DATABASE — KEY TABLES

```
users                      custom User (UUID pk, email login)
staff_profiles             StaffProfile — OneToOne user
staff_permissions          StaffPermission — (user, module) unique
checkins                   CheckIn — user, checkin_type, scanned_by,
                                     goodies_status (pending/received/skipped),
                                     scanned_at ← NOT created_at!
meal_passes                MealPass — UUID pk, user nullable, guest_* fields,
                                     used/used_at, created_at
meal_windows               MealWindow — date, meal_type (unified 'meal'),
                                        start_time, end_time, is_open,
                                        opened_by (manual override marker),
                                        notify_open_minutes_before,
                                        notify_close_minutes_before,
                                        notified_opening/notified_closing
notifications_devicetoken  DeviceToken — user, token, platform, is_active
notifications_notification Notification — status(pending/sent/failed), sent_count
notifications_usernotification UserNotification — delivered, read, per-user
point_entries  user_points
photos  photo_settings  selfie_points  selfie_submissions
sponsors_sponsor  speakers_speaker
schedule_schedulesession   ← Source of truth for meal windows
polls_poll  polls_polloption  polls_vote
polls_ideathonconfig  polls_ideathonteam  polls_ideathonmember
chat_connectionrequest  chat_conversation  chat_message
chat_messagereaction  chat_messagereport  chat_blockeduser  chat_shakelog
chat_staffgroupmessage  chat_callsession
```

---

## 🔑 TEST CREDENTIALS

```
MOBILE + WEB
  participant@test.com / Test@1234
  speaker@test.com     / Test@1234
  test@test.com        / 12345678       (staff, has checkin_scanner)
  Dummy set: firstname.lastname@test.com / Test@1234 (100 users)

STAFF (seeded by seed_staff.py — 18 records)
  hodlibrary@admin.iitd.ac.in  / Librarian@123  (team_head)
  neerajkc@library.iitd.ac.in  / Officer@123    (team_head)
  gunjan0605@library.iitd.ac.in/ Staff@123      (staff)

WEB ADMIN — http://10.17.9.48:8000/panel/login/
  etd@admin.iitd.ac.in (super_admin)

VOICE CALL TEST
  Device A: hodlibrary@admin.iitd.ac.in / Librarian@123
  Device B: gunjan0605@library.iitd.ac.in / Staff@123
```

---

## 🎯 v18 SESSION CHRONOLOGY (What We Fixed)

### Initial Problems Reported
1. Home tab progress showing 33% before event started → wanted countdown
2. Meal window not opening/closing automatically per schedule
3. Web admin scanner showing `🔴 Closed` despite lunch being open
4. Undefined values in stats (Checked In / Remaining / Total)
5. History tab throwing 500 errors
6. Walk-in guest pass generator missing from mobile admin
7. QR screen showing meal pass QR even when window closed
8. Attendee not required to be checked in for meal pass generation

### Fixes Applied (Chronological)

**Fix 1: Home Tab Countdown/Progress Bar**
- Added `now` state ticking every 1s
- Computed phase from schedule sessions (pre/during/between/post)
- Reusable `<Skeleton>` component for loading states
- 3D tilt on hero card via PanResponder + perspective transform

**Fix 2: Dynamic Venue in Hero Top-Right**
- Live session room > next session room > conf.tagline
- Pulsing dot indicator when LIVE VENUE

**Fix 3: Live Session Card Tappable**
- Wrapped in TouchableOpacity → onOpenSchedule
- "Ends in Xm" chip when ≤15 min remaining

**Fix 4: PYTHONUNBUFFERED=1 for Real-Time Logs**
- Added to start_server.sh
- Without it, gunicorn buffers stdout and logs appear delayed

**Fix 5: Meal Utils Timezone (UTC → IST)**
- Added `from zoneinfo import ZoneInfo`
- `IST = ZoneInfo("Asia/Kolkata")`
- All time comparisons use `now_ist = timezone.now().astimezone(IST)`

**Fix 6: Meal Type VARCHAR Overflow**
- Session titles like "Lunch and Networking" exceeded `varchar(20)`
- Normalized to short types: `lunch`, `dinner`, `breakfast`, `tea`
- Or unified as `meal` for the single active window

**Fix 7: Push Notification on Meal Open/Close**
- `sync_meal_window()` triggers `push_to_checked_in()` on state change
- One-shot flags: `notified_opening`, `notified_closing`
- Reset when opposite transition happens

**Fix 8: Multi-Trigger Sync Fallback**
- Celery beat every 60s
- Every `/notifications/unread-count/` call (30s app poll)
- Every `/checkins/meal/status/` call (15-20s)
- Every `/panel/checkins/meal-window-status/` call

**Fix 9: Web Admin Scanner Data Shape**
- scanner.html expects `data.meal.is_open` (nested)
- stats expects `data.checked_in`, `data.remaining`, `data.total`
- Backend `panel_meal_window_status` returns both flat + nested keys

**Fix 10: History 500 Error**
- `CheckIn` model has `scanned_at`, NOT `created_at`
- Fixed `order_by('-scanned_at')` in `checkin_list` view

**Fix 11: Check-In Gate for Meal Pass Generation**
```python
is_checked_in = CheckIn.objects.filter(user=user, checkin_type='conference').exists()
if not is_checked_in:
    return Response({"success": False, "error": "You must check in..."}, status=400)
```

**Fix 12: Meal Pass QR Hidden When Window Closed**
Backend `meal_status`:
```python
if active_pass and is_open:
    pass_data = {...with qr_data...}
elif active_pass and active_pass.used:
    pass_data = {..."qr_data": None...}  # for status display only
```

Mobile QRScreen:
```js
const existingPass = isMealOpen ? rawPass : (rawPass?.used ? rawPass : null);
```

Buttons in meal card:
```jsx
{existingPass?.used ? <CheckIcon/>
  : isMealOpen && existingPass ? <ShowQRBtn/>
  : isMealOpen ? <GenerateBtn/>
  : <ClockIcon/>}
```

**Fix 13: Manual Admin Override Persistence**
- When admin toggles "Open" → sets `opened_by = request.user`
- `sync_meal_window()` respects this: skips auto-close if `opened_by_id is not None`
- Manual open sticks until admin manually closes OR schedule slot ends

**Fix 14: Restored Original Mobile Admin CheckInScreen Design**
- Preserved 3-tab layout, custom guest pass modal, history sub-tabs
- Kept all styling and haptic feedback
- Just fixed API compatibility (`data.success` checks)

**Fix 15: URL Naming Consistency**
- `panel_meal_window_schedule` (not `panel_meal_schedule`)
- Added backward-compat alias: `panel_meal_schedule = panel_meal_window_schedule`

---

## ⚠️ CRITICAL PATTERNS — DO NOT BREAK

### Backend
```
✗ NEVER expect Gunicorn to hot-reload — always restart
✗ NEVER set CONN_MAX_AGE > 0 under Uvicorn workers
✗ NEVER re-enable ROTATE_REFRESH_TOKENS without single-flight mutex
✗ NEVER add 'channels' twice to INSTALLED_APPS
✗ NEVER use Firebase Admin SDK — Expo Push API only
✗ NEVER use django_redis module — Django cache API only
✗ NEVER pass delivered_at to Notification.objects.create()
✗ NEVER prefix admin_urls.py routes with 'panel/'
✗ NEVER use `python` — this VM has `python3`
✗ NEVER use created_at on CheckIn model — it's scanned_at!
✗ NEVER use `--lifespan off` in Gunicorn CLI (only bare uvicorn)
✗ NEVER run Django shell scripts outside backend/ (ModuleNotFoundError)

✓ ALWAYS use timezone.now().astimezone(IST) for meal logic
✓ ALWAYS return {"success": true/false} for mobile API endpoints
✓ ALWAYS return nested {"meal": {...}} for scanner.html endpoints
✓ ALWAYS set opened_by=request.user on manual toggle
✓ ALWAYS trigger sync_meal_window() before returning meal state
✓ ALWAYS check is_checked_in before allowing meal pass generation
✓ ALWAYS use meal_type='meal' (unified) for the active window
```

### Templates
```
✓ Everything extends "panel/base.html"
✓ DIRS = [BASE_DIR / 'templates'] → backend/templates/
✓ Chat templates live in templates/panel/chat/
✓ Active link: {% if '<url_name>' in request.resolver_match.url_name %}
✓ Every sidebar item is permission-wrapped
✗ Never add |safe to user-supplied values
```

### Mobile
```
✗ Never downgrade the Expo SDK
✗ Never add expo-router / React Navigation / TypeScript
✗ Never call hooks inside FlatList renderItem
✗ Never set Content-Type manually with FormData
✗ Never write FONT.size.lg — FONT is FLAT (FONT.lg, FONT.sm, etc.)
✗ Never nest a FlatList in a same-orientation ScrollView
✗ Never require('react-native-webrtc') before NativeModules check
✗ Never show meal QR when window is closed

✓ apiFetch() for authenticated calls (returns raw Response)
✓ For checkins/meal endpoints: use raw fetch + authHeaders(tokens) pattern
✓ QRCodeSVG: guard with String(value || 'ETD-2026')
✓ FlatList keyExtractor: use (item, idx) fallback for safety
✓ History tab renders FlatList outside parent ScrollView
✓ Always copy patched files to eventapp/mobile/src/ duplicate location
```

### IITD Proxy
```
✗ No ngrok / cloudflared / tunnels
✓ npm: NODE_TLS_REJECT_UNAUTHORIZED=0 <cmd> --strict-ssl=false
✓ pip: --break-system-packages
✓ curl to VM: --noproxy "*"
✓ Python to VM: build_opener(ProxyHandler({}))
✓ Expo Push: routes through proxy with verify=False
```

---

## ✅ WHAT IS WORKING

```
✅ All v17 features preserved
✅ Meal Pass System — fully working end-to-end:
   ✅ Schedule-driven auto open/close (IST timezone-aware)
   ✅ Manual admin override (sticks until manual close)
   ✅ Push notifications on every state transition
   ✅ Multi-trigger sync (Celery + all polling endpoints)
   ✅ Check-in gated pass generation
   ✅ QR hidden when window closed (backend + client both enforce)
   ✅ Walk-in guest pass with email QR (mobile + web)
   ✅ Real-time web scanner status
   ✅ Mobile admin 3-tab UI restored (Check-In/Meal/History)
✅ Home Tab countdown/progress bar with real-time ticking
✅ Home Tab 3D tilt hero card
✅ Home Tab dynamic venue display
✅ QR Screen participant photo visible
✅ QR Screen email in black
✅ QR Screen prominent kit status card
✅ QR Screen meal pass card syncs with backend state
✅ Real-time backend logs (PYTHONUNBUFFERED=1)
✅ Push notifications routing (deep-links working)
```

## ❌ WHAT IS NEXT / PENDING

```
❌ HTTPS/TLS (needed for browser mic, real prod)
❌ Public DNS: etd2026.iitd.ac.in → 10.17.9.48
❌ systemd unit for start_server.sh
❌ Nginx in front of Gunicorn (static/media, TLS, gzip)
❌ iOS EAS Development Build
❌ expo-av → expo-audio migration (deprecated in SDK 54)
❌ Home Tab "Conference Pulse" live stats widget
❌ Speaker Connect post-session banner
❌ Sponsor stall live foot-traffic heatmap
❌ Post-approval celebration modal with confetti
❌ Per-user push on selfie point approval
❌ Per-module auto-groups for staff chat
❌ Force password change on first login for staff
❌ Single-flight refresh mutex in api.js (re-enable JWT rotation)
❌ De-duplicate DOMContentLoaded block in staff_permissions.html
❌ Assign meal passes to registered users from mobile admin (guest-only currently)
❌ Time picker for meal schedule on mobile (currently manual text input)
❌ Polishing: consistent styling, loading states, error boundaries
```

---

## 🤝 WORKING AGREEMENT

```
Cycle: diagnose → ASK FOR EXISTING CODE if unsure → assess → generate code →
       deliver → if error → get error → assess → repeat

Rules:
  • ALWAYS ask for existing code before making changes to unknown files
  • YAGNI first. Reuse existing helpers. stdlib > installed dep > new code
  • Deletion over addition. Boring over clever. Shortest working diff
  • Bug fix = root cause, not symptom
  • No new dependency if avoidable
  • No abstractions not requested
  • Fewest files possible
  • Mark deliberate simplifications with ceiling comment
  • Non-trivial logic leaves ONE runnable check behind
  • Give code in `cat << 'EOF' > path` command blocks
  • Always include the restart command for backend changes
  • Copy mobile files to both mobile/ and eventapp/mobile/ paths
```

---

## 📚 GIT

```
Remote: https://github.com/Sharma1907/eventapp
Branch: main
```

---

## 🎨 CURRENT MEAL SYSTEM STATE (as of end of v18 session)

### Data Flow Example (Lunch Scenario)
```
12:59 PM IST: Lunch scheduled 13:00-13:45
              → Any API poll triggers sync_meal_window()
              → sync sees now_ist (12:59) < 13:00
              → Window stays closed

13:00 PM IST: Sync detects now_ist inside slot
              → is_open = True (opened_by=None, system-opened)
              → notified_opening = True
              → Push: "🍽️ Lunch is now open!"
              → Mobile: QR Screen shows "Generate Lunch Pass" button
              → Web: /panel/checkins/scanner/ shows 🟢 OPEN NOW

13:20 PM IST: Attendee taps Generate
              → API checks: user is checked in? ✓
              → API checks: window is open? ✓
              → Creates MealPass, returns qr_data
              → Attendee shows QR to staff

13:45 PM IST: Sync detects now_ist > end_time
              → opened_by is None (system-opened)
              → is_open = False
              → notified_closing = True
              → Push: "🛑 Meal service is now closed"
              → Mobile: QR Screen hides Generate/Show QR
              → Web: /panel/checkins/scanner/ shows 🔴 Closed

13:50 PM IST (manual override scenario):
              Admin taps "Open" on web scanner
              → is_open = True, opened_by = request.user (SET)
              → Push: "🍽️ Dining service is now open!"
              → Next sync sees opened_by is not None
              → Skips auto-close, respects manual hold

14:00 PM IST: Admin taps "Close"
              → is_open = False, opened_by cleared
              → Push: "🛑 Dining service is now closed"
              → System is back to schedule-driven mode
```

### Key Invariants
```
1. Only ONE MealWindow row exists for meal_type='meal' per date
2. Only ONE active MealPass per user per date
3. Manual admin actions persist until admin reverses
4. Schedule always creates open transitions (unless manually closed)
5. Sync is idempotent — safe to call as often as needed
6. Timezone: ALL comparisons in IST (Asia/Kolkata)
7. Push notifications one-shot per transition (guard flags)
```
```
We code in this cycle diagnose > get code from me if needed > assess > gen code accordingly > give to me > if any error > get code / error > assess .....and repeat

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