

Here is your complete, updated context window. Copy-paste this entire block into your new chat's system prompt or first message:

```markdown
# Complete Project Context (v17 — Post-Meal-System, All Features Working)

---

## PROJECT OVERVIEW
```
Product: Conference Management Platform
Event:   ETD 2026 — "ETDs in the age of AI" — IIT Delhi
Website: https://etd2026.iitd.ac.in/
Type:    Mobile App (React Native Expo) + Web Admin Panel (Django MVT)
GitHub:  github.com/Sharma1907/eventapp
Dev Env: IITD VM (baadalvm) — Ubuntu 24.04 LTS, 8 cores, 7.7GB RAM, 24/7

Status:  ALL CORE FEATURES + DISCOVERY + SHAKE CONNECT + HAPTICS +
         OFFLINE SCHEDULE + NETWORK CACHE + RECAP + REDESIGNED QR TICKET +
         BUBBLE POP FX + GEOLOCATION + UNIFIED CHECKPOINT SYSTEM +
         ROLE-BASED ACCESS CONTROL (RBAC) + STAFF DIRECTORY + STAFF GROUP
         CHAT + MOBILE ADMIN CRUD + DYNAMIC WEB SIDEBAR +
         WEBRTC VOICE CALLING (STAFF-TO-STAFF, ZERO THIRD-PARTY SERVICES) +
         PRODUCTION-HARDENED ASGI STACK (GRADE A CERTIFIED 94.8/100) +
         ★ MEAL PASS SYSTEM (Auto-schedule, Walk-in Guest QR, Push Notifications,
           Email QR Delivery, Mobile+Web Admin Open/Close, Unified Meal Windows,
           Raw UUID QR Scan, Guest/Walk-in Support)

Certification: ETD2026 PRODUCTION CERTIFICATION SUITE
  Grade:          A
  Overall Score:  94.8 / 100
  Verdict:        PRODUCTION READY
  Certificate ID: 108B8D7797E7D68F
  Date:           2026-08-30
```

---

## ⭐ PRODUCTION DEPLOYMENT ARCHITECTURE

### THE SERVER — Gunicorn + Uvicorn Workers

```
✅ /home/baadalvm/eventapp/backend/start_server.sh
   → Gunicorn master + 8 Uvicorn (uvloop) workers
   → 42.3 RPS, p95 = 300ms, 0.00% failure rate under 150 users
```

**File: `backend/start_server.sh`** (chmod +x)
```bash
#!/usr/bin/env bash
set -e
cd /home/baadalvm/eventapp/backend
exec gunicorn confhub.asgi:application \
  --workers 8 \
  --worker-class uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:8000 \
  --timeout 120 \
  --keep-alive 65 \
  --max-requests 5000 \
  --max-requests-jitter 500 \
  --access-logfile - \
  --error-logfile -
```

### HOW TO RUN / STOP / RESTART / VIEW LOGS

```bash
# ── FOREGROUND ───────────────────────────────────────────────────────
/home/baadalvm/eventapp/backend/start_server.sh

# ── BACKGROUND (nohup) ──────────────────────────────────────────────
pkill -f gunicorn || true
sleep 1
nohup /home/baadalvm/eventapp/backend/start_server.sh \
      > /home/baadalvm/eventapp/backend/server.log 2>&1 &

# ── VIEW REAL-TIME LOGS ─────────────────────────────────────────────
tail -f /home/baadalvm/eventapp/backend/server.log

# ── CHECK IF RUNNING ────────────────────────────────────────────────
ps aux | grep gunicorn | grep -v grep

# ── FULL RESTART (required after ANY .py change) ────────────────────
pkill -f gunicorn || true
sleep 1
nohup /home/baadalvm/eventapp/backend/start_server.sh \
      > /home/baadalvm/eventapp/backend/server.log 2>&1 &
```

⚠️ **CRITICAL:** Gunicorn does **NOT** hot-reload. After editing **any** backend `.py` file you **MUST** kill and restart Gunicorn or your change silently does nothing.

⚠️ `screen` is **NOT installed** on this VM. Use `nohup`.

---

## INFRASTRUCTURE (IITD VM)

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
DB_PASSWORD=
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

## COMPLETE PROJECT STRUCTURE

```
/home/baadalvm/eventapp/
├── .easignore
├── backend/
│   ├── start_server.sh          ← PRODUCTION LAUNCHER (Gunicorn+Uvicorn×8)
│   ├── server.log               ← nohup log target
│   ├── manage.py
│   ├── .env
│   ├── requirements.txt         ← + gunicorn, uvicorn, uvloop, qrcode[pil]
│   ├── confhub/
│   │   ├── settings.py          ← HEAVILY MODIFIED (see section below)
│   │   ├── urls.py              ← ALL routes wired here
│   │   ├── asgi.py              ← ProtocolTypeRouter + JWTAuthMiddleware
│   │   ├── wsgi.py
│   │   └── middleware.py        ← DisableCSRFForAPI
│   ├── apps/
│   │   ├── accounts/
│   │   │   ├── models.py            ← User (UUID pk, email login, role,
│   │   │   │                           research_interests, warning_note,
│   │   │   │                           warning_acknowledged, suspended_reason,
│   │   │   │                           must_change_password, profile_complete)
│   │   │   │                         + StaffProfile (tier, designation, department,
│   │   │   │                           phone, photo, linkedin_url, profile_url,
│   │   │   │                           scholar_url, order, is_public)
│   │   │   │                         + StaffPermission (21 module keys, FK user)
│   │   │   ├── views.py             ← sanitize_input(), LoginRateThrottle,
│   │   │   │                           staff_directory_view (IsAuthenticated)
│   │   │   ├── serializers.py       ← UserSerializer, StaffDirectorySerializer
│   │   │   │                           (has BOTH user_id AND id — see gotcha)
│   │   │   ├── permissions_helper.py← get_user_permissions(), user_has_module_access(),
│   │   │   │                           module_required(), api_module_required(),
│   │   │   │                           ALL_MODULE_KEYS (21 keys)
│   │   │   ├── context_processors.py← staff_permissions_context()
│   │   │   ├── backends.py          ← EmailBackend
│   │   │   ├── admin_views.py       ← Web panel views + admin_required
│   │   │   ├── admin_urls.py
│   │   │   └── urls.py
│   │   ├── notifications/
│   │   │   ├── models.py            ← DeviceToken, Notification (status field:
│   │   │   │                           pending/sent/failed, sent_count, failed_count),
│   │   │   │                           UserNotification (delivered, read, per-user tracking),
│   │   │   │                           NotificationAttachment
│   │   │   ├── views.py
│   │   │   ├── fcm.py               ← Expo Push API (NOT Firebase Admin SDK)
│   │   │   │                           Routes through IITD proxy + verify=False
│   │   │   │                           _send_expo() → _send_hybrid() → send_to_all()
│   │   │   │                           send_to_all creates UserNotification rows
│   │   │   │                           (delivered=True) for tracked delivery counts
│   │   │   ├── admin_views.py / admin_urls.py
│   │   │   └── urls.py
│   │   ├── leaderboard/
│   │   │   ├── models.py            ← PointEntry, UserPoints, PointAction, POINT_VALUES
│   │   │   ├── utils.py             ← award_points(user, action, note, points_override)
│   │   │   ├── views.py / admin_views.py / admin_urls.py
│   │   │   └── urls.py
│   │   ├── photos/                  ← CENTRAL HUB: Photos + Checkpoints
│   │   │   ├── models.py            ← PhotoSettings, Photo, SelfiePoint, SelfieSubmission
│   │   │   ├── views.py             ← gallery() now AllowAny
│   │   │   ├── admin_views.py / admin_urls.py
│   │   │   └── urls.py
│   │   ├── chat/                    ← CENTRAL HUB: Chat + Voice Calls
│   │   │   ├── models.py            ← ConnectionRequest, Conversation, Message,
│   │   │   │                           MessageReaction, MessageReport, BlockedUser,
│   │   │   │                           ShakeLog, StaffGroupMessage, CallSession
│   │   │   ├── views.py             ← + shake_connect, disconnect_user,
│   │   │   │                           staff_group_chat_view, call_logs_api
│   │   │   ├── consumers.py         ← CallConsumer + ping/pong + ack
│   │   │   ├── middleware.py        ← JWTAuthMiddleware (?token=<jwt> on WS)
│   │   │   ├── routing.py           ← ws/call/$ → CallConsumer
│   │   │   ├── admin_views.py / admin_urls.py
│   │   │   └── urls.py
│   │   ├── schedule/
│   │   │   ├── models.py            ← ScheduleSession, ScheduleSubSession,
│   │   │   │                           SessionBookmark, FeedbackForm/Question/Response/Answer
│   │   │   ├── views.py             ← session_list + session_detail (IsAuthenticated)
│   │   │   ├── serializers.py / admin_views.py / admin_urls.py / urls.py
│   │   ├── polls/
│   │   │   ├── models.py            ← Poll, PollOption, Vote, PollAuditLog
│   │   │   ├── ideathon_models.py   ← IdeathonConfig, IdeathonTeam, IdeathonMember
│   │   │   ├── views.py             ← poll_vote uses transaction.atomic() (race-safe)
│   │   │   └── admin_views.py / admin_urls.py / urls.py
│   │   ├── checkins/                ← ★ HEAVILY MODIFIED IN v17
│   │   │   ├── models.py            ← CheckIn, MealPass (user nullable for walk-ins,
│   │   │   │                           guest_name/email/phone/reg_no, display_name/
│   │   │   │                           display_email/display_reg properties),
│   │   │   │                           MealWindow (start_time, end_time,
│   │   │   │                           notify_open_minutes_before, notify_close_minutes_before,
│   │   │   │                           notified_opening, notified_closing)
│   │   │   ├── views.py             ← ★ REWRITTEN in v17:
│   │   │   │                           _user_detail() returns id, name, email, registration_id,
│   │   │   │                           affiliation, designation, role, research_interests,
│   │   │   │                           photo, profile_photo_url (handles user=None for walk-ins)
│   │   │   │                           scan_checkin, confirm_goodies, checkin_status,
│   │   │   │                           checkin_list, my_qr (returns qr_data field!),
│   │   │   │                           network_list (filters by checked-in users, supports
│   │   │   │                           search/interest/role params, returns 'attendees' key),
│   │   │   │                           meal_status (returns meal_window schedule data),
│   │   │   │                           generate_meal_pass, scan_meal (accepts raw UUID QR +
│   │   │   │                           JSON payload + registration_id),
│   │   │   │                           meal_window_toggle (push on OPEN + CLOSE via
│   │   │   │                           push.push_to_checked_in()),
│   │   │   │                           meal_window_schedule (sets start/end/notify offsets),
│   │   │   │                           meal_stats, meal_list (handles guest passes),
│   │   │   │                           checked_in_participants,
│   │   │   │                           create_meal_pass_api (walk-in + registered user,
│   │   │   │                           generates QR, emails via SMTP),
│   │   │   │                           my_meal_passes
│   │   │   ├── push.py              ← ★ NEW in v17: push_to_checked_in(title, body, data)
│   │   │   │                           Uses fcm.send_to_all() engine → creates Notification +
│   │   │   │                           UserNotification rows → sends Expo push → marks
│   │   │   │                           status='sent' + sent_count. Fixes "Pending/0 delivered"
│   │   │   │                           problem from earlier approach.
│   │   │   ├── admin_views.py        ← ★ REWRITTEN in v17:
│   │   │   │                           panel_meal_window_toggle pushes on OPEN + CLOSE
│   │   │   │                           panel_meal_window_schedule (web AJAX for schedule)
│   │   │   │                           panel_meal_window_status (returns schedule data)
│   │   │   │                           panel_meal_scan (accepts raw UUID QR)
│   │   │   │                           meal_pass_create_view (web form: walk-in guest pass
│   │   │   │                           with QR email)
│   │   │   ├── admin_urls.py
│   │   │   ├── urls.py               ← includes meal/window/schedule/ endpoint
│   │   │   ├── tasks.py              ← Celery: check_meal_notifications (60s beat)
│   │   │   └── meal_utils.py         ← sync_meal_window() auto open/close/push
│   │   ├── sponsors/
│   │   ├── speakers/
│   │   ├── conferences/
│   │   ├── events/
│   │   └── posts/                   ← + tasks.py (Celery publish_scheduled_posts)
│   ├── templates/panel/             ← ALL WEB ADMIN TEMPLATES (see section below)
│   ├── static/                      ← STATICFILES_DIRS source
│   ├── staticfiles/                 ← STATIC_ROOT (collectstatic target)
│   ├── media/
│   │   ├── sponsors/  sponsors/stalls/  speakers/
│   │   ├── staff/                   ← 18 staff photos
│   │   ├── selfie_points/samples/   selfie_submissions/
│   │   └── audio/bubble-pop-up-sfx.mp3
│   ├── seed_sponsors.py  seed_speakers.py
│   └── seed_staff.py
│
├── load_tests/
│   ├── locustfile.py
│   └── config.py
│
├── production_certification/
│   ├── run_certification.py
│   ├── config/thresholds.py
│   ├── monitors/
│   ├── layers/
│   └── results/certification_<ts>/
│
└── mobile/
    ├── App.js  index.js  babel.config.js  eas.json  google-services.json
    ├── app.json
    ├── package.json
    ├── .npmrc                       ← legacy-peer-deps=true
    ├── .easignore
    └── src/
        ├── theme.js                 ← COLORS, FONT (FLAT: FONT.lg NOT FONT.size.lg),
        │                               SPACE, RADIUS, SHADOW, API_URL, API_ROOT,
        │                               API_HEADERS, fixMediaUrl, W
        ├── components.js            ← PulsingDot, GradientAvatar, FadeIn, Badge
        ├── cache.js                 ← 5-min TTL AsyncStorage helper
        ├── api.js                   ← apiFetch (auto-refresh JWT, FormData aware)
        ├── MainApp.js               ← Tab router + subScreen router + call Modal
        ├── notifications.js
        ├── utils/geo.js
        └── screens/
            ├── HomeTab.js           ← ★ v17: uses apiFetch for schedule+conferences
            ├── ScheduleTab.js  QRScreen.js (★ v17: QRCodeSVG guards undefined)
            ├── FeedScreen.js
            ├── NetworkScreen.js     ← ★ v17: reads 'attendees' key from network_list,
            │                           FlatList keyExtractor with idx fallback
            ├── ProfileTab.js  NotificationsScreen.js
            ├── EditProfileScreen.js  ChangePasswordScreen.js
            ├── SponsorsScreen.js  SponsorDetailScreen.js
            ├── SpokersScreen.js  SpeakerDetailScreen.js
            ├── ChatListScreen.js  ChatRoomScreen.js  ContactCardModal.js
            ├── TopicPickerModal.js  SpeakerRequestModal.js
            ├── ConnectionRequestsScreen.js  LeaderboardScreen.js
            ├── PhotosScreen.js  PollsScreen.js  IdeathonScreen.js
            ├── ShakeConnectScreen.js  RecapScreen.js  CheckpointScreen.js
            ├── VoiceCallScreen.js       ← 3-engine WebRTC
            ├── StaffScreen.js  StaffDetailScreen.js  StaffGroupChatScreen.js
            └── admin/
                ├── AdminTab.js  NotificationsAdmin.js  UsersAdmin.js
                ├── AddParticipantScreen.js
                ├── CheckInScreen.js     ← ★ v17: REWRITTEN — Meal tab with
                │                           Open/Close window + push, Issue Custom Meal
                │                           Pass modal (guest walk-in), QR scanner,
                │                           History tab (FlatList outside ScrollView),
                │                           Success/failure Alert popups
                ├── ScheduleAdmin.js  PhotosAdmin.js  PollsAdmin.js
                ├── IdeathonAdmin.js  CheckpointAdminScreen.js
                ├── CallLogsAdmin.js
                └── StaffAdminScreen.js
```

---

## ⭐ settings.py — KEY PRODUCTION CONFIG

```python
DJANGO_APPS = [
    'daphne',          # MUST be first
    'channels',        # appears EXACTLY ONCE
    'django.contrib.admin', 'django.contrib.auth',
    'django.contrib.contenttypes', 'django.contrib.sessions',
    'django.contrib.messages', 'django.contrib.staticfiles',
]

ASGI_APPLICATION = 'confhub.asgi.application'

DATABASES = {
    'default': {
        'ENGINE':   'django.db.backends.postgresql',
        'NAME': 'etdapp', 'USER': 'etdapp_admin', 'PASSWORD': 'ASKFORIT',
        'HOST': 'localhost', 'PORT': '5432',
        'CONN_MAX_AGE': 0,   # ★ MUST BE 0 UNDER ASGI/UVICORN
    }
}

CHANNEL_LAYERS = {'default': {
    'BACKEND': 'channels_redis.core.RedisChannelLayer',
    'CONFIG':  {'hosts': [REDIS_URL]},
}}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME':   timedelta(hours=24),
    'REFRESH_TOKEN_LIFETIME':  timedelta(days=30),
    'ROTATE_REFRESH_TOKENS':   False,  # ★ was True — caused 80 failures
    'BLACKLIST_AFTER_ROTATION':False,
}

REST_FRAMEWORK = {
    'DEFAULT_THROTTLE_RATES': {
        'anon':  '10000/min',
        'user':  '20000/min',
        'login': '300/min',
    },
    'PAGE_SIZE': 20,
}

CELERY_BEAT_SCHEDULE = {
    "publish-scheduled-posts": {
        "task": "apps.posts.tasks.publish_scheduled_posts", "schedule": 60.0,
    },
    "check-meal-notifications": {
        "task": "apps.checkins.tasks.check_meal_notifications", "schedule": 60.0,
    },
}
```

---

## ⭐ TEMPLATE SYSTEM — HOW IT IS WIRED

This is a **hand-rolled Django MVT admin panel**, completely separate from `django.contrib.admin`.

### Resolution chain
```
settings.TEMPLATES[0]['DIRS'] = [BASE_DIR / 'templates']
   BASE_DIR = /home/baadalvm/eventapp/backend
   →  /home/baadalvm/eventapp/backend/templates/

ALL panel templates live in:  backend/templates/panel/
Chat templates nest one level: backend/templates/panel/chat/

EVERY template starts with:   {% extends "panel/base.html" %}
```

### The URL → view → template triangle
```
1. confhub/urls.py mounts each app's admin routes under panel/:
       path('panel/', include('apps.accounts.admin_urls'))
       path('panel/', include('apps.checkins.admin_urls'))
       ... one per app

2. apps/<app>/admin_urls.py declares routes WITHOUT the panel/ prefix:
       path('checkins/scanner/', admin_views.scanner_view, name='checkin_scanner')
   ⚠ Writing 'panel/checkins/scanner/' yields /panel/panel/... — classic bug.

3. apps/<app>/admin_views.py renders:
       return render(request, 'panel/scanner.html', context)
```

### base.html — dynamic permission-gated sidebar
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

### Full template inventory (backend/templates/panel/)
```
base.html                     ← master layout, dynamic sidebar
login.html                    dashboard.html
participants_list.html        participants_upload.html
participants_preview.html     participant_add.html   participant_edit.html
checkin_list.html             scanner.html           ← ★ v17: has meal window toggle
                                                        + "Issue Custom Pass" modal
                                                        + schedule UI
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
meal_pass_manage.html         ← ★ v17: walk-in guest pass + QR email
chat/list.html                chat/thread.html       chat/requests.html
chat/reports.html             chat/analytics.html    chat/shakes.html
```

---

## URL ROUTING — confhub/urls.py

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

## ⭐ CHECKINS APP — COMPLETE API REFERENCE (v17)

### apps/checkins/urls.py
```python
path('scan/',                views.scan_checkin,             name='checkin_scan')
path('goodies/',             views.confirm_goodies,          name='checkin_goodies')
path('status/',              views.checkin_status,           name='checkin_status')
path('list/',                views.checkin_list,             name='checkin_list')
path('my-qr/',               views.my_qr,                  name='checkin_my_qr')
path('network/',             views.network_list,             name='checkin_network')
path('meal/status/',         views.meal_status,              name='meal_status')
path('meal/generate/',       views.generate_meal_pass,       name='meal_generate')
path('meal/scan/',           views.scan_meal,                name='meal_scan')
path('meal/window/',         views.meal_window_toggle,       name='meal_window')
path('meal/window/schedule/',views.meal_window_schedule,     name='meal_window_schedule')
path('meal/stats/',          views.meal_stats,               name='meal_stats')
path('meal/list/',           views.meal_list,                name='meal_list')
path('checked-in/',          views.checked_in_participants,  name='checked_in_participants')
path('meal-pass/create/',    views.create_meal_pass_api,     name='meal_pass_create_api')
path('meal-pass/mine/',      views.my_meal_passes,           name='meal_pass_mine')
```

### apps/checkins/admin_urls.py
```python
path('checkins/scanner/',            admin_views.scanner_view)
path('checkins/list/',               admin_views.checkin_list_view)
path('checkins/scan/',               admin_views.panel_scan)
path('checkins/goodies/',            admin_views.panel_goodies)
path('checkins/stats/',              admin_views.panel_stats)
path('checkins/meal-window-status/', admin_views.panel_meal_window_status)
path('checkins/meal/window/',        admin_views.panel_meal_window_toggle)
path('checkins/meal/schedule/',      admin_views.panel_meal_window_schedule)
path('checkins/meal/scan/',          admin_views.panel_meal_scan)
path('checkins/meal-pass/',          admin_views.meal_pass_create_view)
```

### ⭐ KEY IMPLEMENTATION DETAILS

**`_user_detail(user, request)`** — shared helper for all checkins API responses:
- Returns `id`, `name`, `first_name`, `last_name`, `email`, `registration_id`, `affiliation`, `designation`, `role`, `research_interests`, `photo`, `profile_photo_url`
- Handles `user=None` (walk-in guest passes) gracefully — returns empty strings

**`my_qr`** — returns `{'registration_id': ..., 'email': ..., 'qr_data': ...}`
- `qr_data` is critical — `QRScreen.js` passes it to `QRCodeSVG` component
- If `qr_data` is missing/undefined, QR generator crashes with `TypeError: Cannot read property 'length' of undefined`

**`network_list`** — attendee networking list:
- Filters by users who are **actually checked into the conference** (joins CheckIn table)
- Supports `?search=`, `?interest=`, `?role=` query parameters
- Returns BOTH `'users'` AND `'attendees'` keys for mobile compatibility
- Returns `'interests'` list for filter chips

**`scan_meal`** — QR scan verification:
- Accepts THREE formats: raw UUID string, JSON `{pass_id:...}`, or `registration_id`
- Reads from `qr_data` OR `qr_code` request fields (both web and mobile send differently)
- Handles walk-in guest passes (user=None) without crashing

**`push_to_checked_in(title, body, data)`** in `apps/checkins/push.py`:
- Uses `fcm.send_to_all()` (the proven engine that routes through IITD proxy to Expo)
- Creates `Notification` + `UserNotification` rows for delivery tracking
- Marks `status='sent'` + `sent_count=N` (fixes "Pending/0 delivered" problem)
- Used by BOTH `meal_window_toggle` (API) AND `panel_meal_window_toggle` (web admin)

**`meal_window_toggle`** (both API and web panel versions):
- OPEN: creates/updates MealWindow, sends push "Meal service is now open!"
- CLOSE: updates MealWindow, sends push "Meal service is now closed"
- Both directions push immediately (within seconds)

**`create_meal_pass_api`**:
- Accepts `user_id` (registered user assignment) OR `guest_name/email/phone/reg_no` (walk-in)
- Generates QR code using `qrcode` library (PIL)
- Emails QR as PNG attachment via Django `EmailMessage` + IITD SMTP
- Returns `qr_data` (UUID string) for mobile display

---

## ⭐ PUSH NOTIFICATION SYSTEM

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

push.py (push_to_checked_in) — NEW in v17
  → Creates Notification(status='pending')
  → Calls fcm.send_to_all() (which creates UserNotification rows)
  → Updates notif.status='sent', notif.sent_count=N
  → Deactivates bad tokens
```

### Notification Data Payloads (Deep-Link Routing)
```json
{"type": "meal_pass", "screen": "qr"}     → opens QR tab
{"type": "new_message", "conversation_id": "..."} → opens chat room
{"type": "connection_request"}             → opens connection requests
{"type": "feed_post"}                      → opens feed tab
{"type": "session_reminder", "session_id": "..."} → opens schedule
{"type": "checkin_success"}                → opens QR tab
{"type": "meal_verified"}                  → opens QR tab
{"type": "voice_call", "caller_name": "..."} → incoming call handler
```

### Deep-Link Routing (mobile/App.js)
```javascript
// In notification tap handler:
if (data.type === 'checkin_success' || data.type === 'meal_verified' || data.type === 'meal_pass') {
  setNotificationRoute({ type: 'qr' });  // → opens QR tab
}
```

---

## ⭐ MEAL PASS SYSTEM (v17 — Complete)

### How It Works End-to-End

1. **Admin schedules meal window** (web or mobile):
   - Sets start_time, end_time, notify_open_minutes_before, notify_close_minutes_before
   - Celery task `check_meal_notifications` runs every 60s and fires timed pushes
   - Status polling on web scanner (every 20s) and mobile meal tab (every 20s) also triggers `sync_meal_window()` which auto-opens/closes + pushes

2. **Admin manually opens/closes window** (web scanner or mobile app):
   - Immediate push notification to all checked-in users
   - Notification shows as "Sent" with delivery count in web admin `/panel/notifications/`

3. **Admin issues custom meal pass** (walk-in guest or registered user):
   - Web: `/panel/checkins/meal-pass/` form OR scanner modal
   - Mobile: Meal tab → "Issue Custom Meal Pass (Guest)" button
   - Generates UUID-based MealPass
   - If email provided: generates QR PNG, emails as attachment via IITD SMTP
   - Returns `qr_data` (UUID) for mobile display

4. **Attendee generates own meal pass**:
   - QR Screen → "Generate" button → `POST /checkins/meal/generate/`
   - Creates MealPass with user FK

5. **Scanner verifies meal pass**:
   - Web: scanner.html meal mode → scan QR or enter manually
   - Mobile: CheckInScreen meal tab → scan QR or paste UUID
   - Backend `scan_meal` accepts raw UUID, JSON payload, or registration ID
   - Marks pass as used, awards points (if registered user), sends push to user

### MealPass Model
```python
class MealPass(models.Model):
    id = UUIDField(primary_key=True)
    user = ForeignKey(User, null=True, blank=True)  # NULL for walk-ins
    meal_type = CharField(default='meal')  # unified
    date = DateField()
    is_active = BooleanField(default=True)
    used = BooleanField(default=False)
    used_at = DateTimeField(null=True)
    scanned_by = ForeignKey(User, null=True)
    # Walk-in fields
    guest_name = CharField(blank=True)
    guest_email = EmailField(blank=True)
    guest_phone = CharField(blank=True)
    guest_reg_no = CharField(blank=True)
    
    @property display_name  → user.get_full_name() or guest_name
    @property display_email → user.email or guest_email
    @property display_reg   → user.registration_id or guest_reg_no
```

### MealWindow Model
```python
class MealWindow(models.Model):
    meal_type = CharField(default='meal')
    date = DateField()
    start_time = TimeField(null=True)
    end_time = TimeField(null=True)
    notify_open_minutes_before = PositiveIntegerField(default=15)
    notify_close_minutes_before = PositiveIntegerField(default=10)
    is_open = BooleanField(default=False)
    opened_by = ForeignKey(User, null=True)
    opened_at = DateTimeField(auto_now_add=True)
    closed_at = DateTimeField(null=True)
    notified_opening = BooleanField(default=False)  # one-shot flag
    notified_closing = BooleanField(default=False)
```

---

## OTHER API ENDPOINTS

### Auth — /api/v1/auth/
```
POST /login/              AllowAny + LoginRateThrottle(300/min)
POST /token/refresh/      { refresh } → { access }
GET  /me/                 IsAuthenticated
POST /update-profile/     IsAuthenticated, multipart — SANITISED
POST /change-password/    IsAuthenticated
POST /logout/             IsAuthenticated
POST /acknowledge-warning/
GET  /discover/           research-interest matching
GET  /my-recap/           per-day recap
GET  /users/              Admin — ?search= &role=
POST /users/<pk>/action/  Admin — warn | suspend | unsuspend
POST /participants/create/
```

### Staff — /api/v1/auth/staff/
```
GET    /staff/                 IsAuthenticated
GET    /staff/<uuid:pk>/       IsAuthenticated (pk = User.id)
POST   /staff/admin/create/    super_admin|mgmt_admin
POST   /staff/admin/<pk>/edit/
DELETE /staff/admin/<pk>/delete/
GET/POST /staff/admin/permissions/
```

### Chat — /api/v1/chat/
```
GET  /                              conversation_list
GET  /requests/                     inbox
POST /requests/send/                ⚠ str() on receiver_id before .strip()
POST /shake/  /shakes/
GET+POST /staff-group/
GET  /call-logs/
```

### Schedule — /api/v1/schedule/
```
GET   /sessions/                IsAuthenticated
GET   /sessions/<uuid>/         IsAuthenticated
POST  /sessions/<uuid>/bookmark/
```

### Others
```
/api/v1/notifications/  → register-token/ unregister-token/ send/ history/
/api/v1/leaderboard/    → my/ top/
/api/v1/polls/          → list, <uuid>/vote/, admin/*
/api/v1/sponsors/  /api/v1/speakers/  /api/v1/posts/  /api/v1/events/
```

---

## WEBRTC VOICE CALLING SYSTEM

### Topology
```
Staff A ── WS ws://10.17.9.48:8000/ws/call/?token=<jwt> ── Staff B
           SDP + ICE candidates forwarded via CallConsumer
           RTP Audio via coturn:3478 (P2P or relayed)
```

### Three engines in VoiceCallScreen.js
```
Engine A — native (react-native-webrtc, EAS dev builds only)
Engine B — WebView (hidden webview with inline HTML WebRTC)
Engine C — web (window.RTCPeerConnection)
```

### CallConsumer (consumers.py)
- Supports: call_initiate, call_accept, call_reject, offer, answer, ice_candidate, call_end, ping→pong, catch-all ack
- Attaches sender_id to every forwarded signal for echo prevention
- Resolves callee by User.id OR StaffProfile.id

---

## AUTH & RBAC

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

## MOBILE — NAVIGATION & WIRING

```
MainApp.js
  ├─ Tab router (manual useState)
  ├─ getTabs(role) → Admin tab for admin roles
  ├─ subScreen router via renderSubScreenContent() helper
  ├─ activeCall state + Modal (VoiceCallScreen)
  ├─ Incoming-call WS listener for ALL authenticated users
  └─ Push notification deep-link routing:
       meal_pass → QR tab
       chat/connection_request/feed/schedule/poll/ideathon → respective screens

HomeTab.js
  ├─ Uses apiFetch for /conferences/settings/ and /schedule/sessions/
  │   (both IsAuthenticated since v16)
  ├─ Timeline cards, Live session, Quick Access grid
  ├─ Announcements deck (swipeable)
  └─ Status strip (rank, points, day, profile)

CheckInScreen.js (admin/)
  ├─ Three tabs: Check In | Meal | History
  ├─ Check In: QR scanner + manual reg ID input + kit confirmation
  ├─ Meal: Window status + Open/Close buttons + Issue Custom Meal Pass modal
  │   - Issues walk-in guest passes with QR email
  │   - Polls meal/status/ every 20s for auto schedule activation
  ├─ History: FlatList outside ScrollView (fixes VirtualizedList warning)
  └─ All operations use raw fetch() + authHeaders(tokens) pattern

QRScreen.js
  ├─ QRCodeSVG component: guards against undefined value with fallback
  │   qr.addData(String(value || 'ETD-2026'))
  ├─ Displays attendee ticket card with holographic shimmer
  ├─ Meal pass generation + display
  └─ Check-in status popup
```

---

## DATABASE — KEY TABLES

```
users                      custom User (UUID pk, email login)
staff_profiles             StaffProfile — OneToOne user
staff_permissions          StaffPermission — (user, module) unique
checkins                   CheckIn — user, checkin_type, scanned_by, goodies_status
meal_passes                MealPass — UUID pk, user nullable, guest fields, used/used_at
meal_windows               MealWindow — date, start/end time, notify offsets, is_open
notifications_devicetoken  DeviceToken — user, token, platform, is_active
notifications_notification Notification — status(pending/sent/failed), sent_count
notifications_usernotification UserNotification — delivered, read, per-user tracking
point_entries  user_points
photos  photo_settings  selfie_points  selfie_submissions
sponsors_sponsor  speakers_speaker  schedule_schedulesession
polls_poll  polls_polloption  polls_vote
polls_ideathonconfig  polls_ideathonteam  polls_ideathonmember
chat_connectionrequest  chat_conversation  chat_message
chat_messagereaction  chat_messagereport  chat_blockeduser  chat_shakelog
chat_staffgroupmessage  chat_callsession
```

---

## TEST CREDENTIALS

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

## CRITICAL PATTERNS — DO NOT BREAK

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
✓ Push via push_to_checked_in() which uses fcm.send_to_all() engine
✓ Notification.objects.create() FIRST, then send_to_all(..., notif)
✓ _user_detail handles user=None (walk-in meal passes)
✓ scan_meal accepts raw UUID + JSON + registration_id
✓ my_qr returns qr_data field (QRCodeSVG depends on it)
✓ network_list returns 'attendees' key + includes research_interests
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
✓ apiFetch() for authenticated calls (returns raw Response)
✓ For checkins/meal endpoints: use raw fetch + authHeaders(tokens) pattern
   (same pattern as doCheckin, proven working)
✓ QRCodeSVG: guard with String(value || 'ETD-2026')
✓ FlatList keyExtractor: use (item, idx) fallback for safety
✓ History tab renders FlatList outside parent ScrollView
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

## ⚠️ KNOWN DUPLICATE PROJECT FOLDER

There is a nested clone at `/home/baadalvm/eventapp/eventapp/` which contains older copies of files. The canonical files are at:
```
Backend: /home/baadalvm/eventapp/backend/
Mobile:  /home/baadalvm/eventapp/mobile/src/
```
Metro may pick up files from either location. When patching, use `glob` to patch ALL copies, or ensure Metro is configured to use the correct root.

---

## WHAT IS WORKING ✅

```
✅ All v16 features (core, discovery, shake, haptics, offline schedule, network cache,
   recap, QR ticket, bubble FX, geolocation, checkpoints, RBAC, staff directory,
   staff group chat, WebRTC voice calling, production ASGI stack)
✅ ★ Meal Pass System — complete end-to-end:
   ✅ Admin open/close meal window with instant push notifications (web + mobile)
   ✅ Push notifications delivered + marked "Sent" with delivery counts
   ✅ Walk-in guest meal pass creation (web form + mobile modal)
   ✅ QR code generated and emailed via IITD SMTP
   ✅ QR scan verification (raw UUID, JSON, registration ID)
   ✅ Guest/walk-in meal passes work without user accounts
   ✅ History tab shows meal passes + check-ins
   ✅ Schedule meal windows with notify offsets (Celery + status polling)
✅ ★ HomeTab timeline fixed (uses apiFetch for authenticated endpoints)
✅ ★ QRScreen crash fixed (undefined value guard in QRCodeSVG)
✅ ★ NetworkScreen shows checked-in attendees with research interests
✅ ★ Conference dates shifted to Aug 31 – Sep 2, 2026 for testing
```

## WHAT IS NEXT / PENDING ❌

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
❌ Assign meal passes to registered users from mobile admin (currently guest-only on mobile)
❌ Time picker for meal schedule on mobile (currently manual text input)
❌ Polishing: consistent styling, loading states, error boundaries
```

---

## WORKING AGREEMENT

```
Cycle: diagnose > get code from me if needed > assess > gen code > give to me >
       if error > get code/error > assess > repeat

Lazy senior developer rules:
  YAGNI first. Reuse existing helpers. stdlib > installed dep > new code.
  Deletion over addition. Boring over clever. Shortest working diff.
  Bug fix = root cause, not symptom.
  No new dependency if avoidable.
  No abstractions not requested.
  Fewest files possible.
  Mark deliberate simplifications with ceiling comment.
  Non-trivial logic leaves ONE runnable check behind.
```

---

## GIT
```
Remote: https://github.com/Sharma1907/eventapp
Branch: main
```


## WORKING AGREEMENT

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