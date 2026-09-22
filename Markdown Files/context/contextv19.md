

Here is your **complete v19 context window** — copy this entire block into a new chat to resume with full project awareness.

---

```markdown
# 🎯 ETD 2026 CONFERENCE APP — Complete Context Window (v19)

## 📌 PROJECT OVERVIEW

```
Product:   Conference Management Platform
Event:     ETD 2026 — "ETDs in the age of AI" — IIT Delhi
Website:   https://etd2026.iitd.ac.in/
Type:      Mobile App (React Native Expo SDK 54) + Web Admin Panel (Django MVT)
GitHub:    github.com/Sharma1907/eventapp
Dev Env:   IITD VM (baadalvm) — Ubuntu 24.04 LTS, 8 cores, 7.7GB RAM, 24/7

Status:    ALL v18 FEATURES + IDEATHON ADMIN CRUD + JOIN REQUEST SYSTEM
           + SCHEDULE-DRIVEN MEAL AUTOMATION + MANUAL OVERRIDE + TIMEZONE-AWARE
           (IST) + PARTICIPANT CHECK-IN GATED + REAL-TIME PUSH NOTIFICATIONS
           + POLISHED QR SCREEN + POLISHED HOME SCREEN COUNTDOWN/PROGRESS
           + FULL IDEATHON TEAM MANAGEMENT (CREATE/EDIT/DISBAND/ADD/REMOVE MEMBERS)
           + JOIN REQUEST APPROVAL WORKFLOW WITH PUSH NOTIFICATIONS
           + LEADER-ONLY LEADERSHIP TRANSFER

Phase:     POLISHING — all core features working, now refining UX/UI
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
  Expo:        cd mobile/ && npx expo start --lan --port 8081
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

### Expo SDK — LOCKED AT 54
```
⚠️ DO NOT UPGRADE TO SDK 55/56/57 — will break react-native-webrtc, expo-av,
    reanimated, and native dev client. SDK 54 is modern, stable, meets all
    App Store / Play Store requirements.

⚠️ Always run Expo from mobile/ directory:
    cd /home/baadalvm/eventapp/mobile
    npx expo start --lan --port 8081

⚠️ Running from root (eventapp/) triggers SDK 57 install prompt — DECLINE.

EAS Build:
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

# 🗃️ Django Management
cd /home/baadalvm/eventapp/backend
python3 manage.py makemigrations <app>
python3 manage.py migrate
python3 manage.py check
python3 manage.py collectstatic --noinput
```

⚠️ **CRITICAL RULES:**
- Gunicorn does **NOT** hot-reload — restart after every `.py` change
- `--lifespan off` does **NOT** work in Gunicorn CLI (only bare uvicorn)
- `screen` is **NOT** installed — use `nohup`
- Always `cd /home/baadalvm/eventapp/backend` before running any Django commands
- Always use `python3` (not `python`) — this is Ubuntu 24.04

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
│   │   ├── polls/                     ← ★ v19: Ideathon system lives here
│   │   ├── checkins/                  ← ★ v18: Meal pass system
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
├── mobile/                            ← Expo React Native app (SDK 54)
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
│           ├── HomeTab.js             ← countdown + progress + 3D tilt hero
│           ├── QRScreen.js            ← photo, kit card, meal QR gated
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
│           ├── IdeathonScreen.js      ← ★ v19: Join requests + leader approval
│           ├── ShakeConnectScreen.js  RecapScreen.js  CheckpointScreen.js
│           ├── VoiceCallScreen.js
│           ├── StaffScreen.js  StaffDetailScreen.js  StaffGroupChatScreen.js
│           ├── FeedScreen.js
│           └── admin/
│               ├── AdminTab.js
│               ├── CheckInScreen.js   ← 3-tab design (Check-In/Meal/History)
│               ├── IdeathonAdmin.js   ← ★ v19: Full CRUD + team management
│               ├── NotificationsAdmin.js
│               ├── UsersAdmin.js
│               ├── AddParticipantScreen.js
│               ├── ScheduleAdmin.js  PhotosAdmin.js  PollsAdmin.js
│               ├── CheckpointAdminScreen.js
│               ├── CallLogsAdmin.js
│               └── StaffAdminScreen.js
│
├── eventapp/                          ⚠️ DUPLICATE CLONE (nested)
│   └── mobile/src/screens/            ← Legacy copy — patches sometimes need both
│
└── production_certification/          ← Load test suite
    ├── run_certification.py
    └── ...
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
checkin_list.html             scanner.html           ← expects data.meal.is_open
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

## ⭐ IDEATHON SYSTEM — COMPLETE PICTURE (v19)

### Architecture
```
┌─────────────────────────────────────────────────────────────┐
│  IdeathonConfig (singleton pk=1)                              │
│  registration_open, reg_starts_at, reg_ends_at               │
│  min_team_size=3, max_team_size=5                            │
│  is_open property: checks open flag + date range             │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  IdeathonInterest — user expresses interest                  │
│  OneToOne user → serves as participant pool                  │
│  Only interested users can be invited / found in search      │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  IdeathonTeam — UUID pk, name, avatar, leader, project_*    │
│  IdeathonMember — team + user (OneToOne user)                │
│  IdeathonInvite — leader invites interested user (pending→   │
│                   accepted/declined)                         │
│  IdeathonJoinRequest — ★ v19: user requests to join team    │
│                   (pending→accepted/declined by leader)      │
└─────────────────────────────────────────────────────────────┘
```

### Models (`backend/apps/polls/ideathon_models.py`)
```python
IdeathonConfig          # Singleton: registration window + team size constraints
IdeathonInterest        # OneToOne(user): marks user as interested
IdeathonTeam            # UUID pk, name, avatar(10 choices), project_title/desc, leader FK
IdeathonMember          # FK(team) + OneToOne(user), joined_at
IdeathonInvite          # UUID pk, team, invited_by, invitee, status(pending/accepted/declined)
IdeathonJoinRequest     # ★ v19: UUID pk, team, user, status(pending/accepted/declined)
```

### Avatar Choices (must match frontend AVATAR_OPTIONS)
```python
AVATAR_CHOICES = [
    ('rocket', '🚀'), ('bulb', '💡'), ('fire', '🔥'), ('star', '⭐'),
    ('brain', '🧠'), ('lightning', '⚡'), ('diamond', '💎'), ('trophy', '🏆'),
    ('compass', '🧭'), ('atom', '⚛️'),
]
```

### API Endpoints (`/api/v1/polls/`)
```
# Participant-facing
GET    /polls/ideathon/                          → info + teams + my_team + invites + join_requests
POST   /polls/ideathon/interest/                 → toggle interest
GET    /polls/ideathon/interested/               → list interested users (?search=)
GET    /polls/ideathon/check-name/?name=         → name availability check
POST   /polls/ideathon/create-team/              → create team (requires interest)
POST   /polls/ideathon/leave-team/               → leave current team
POST   /polls/ideathon/teams/<uuid>/join/        → direct join (legacy, kept for compat)
POST   /polls/ideathon/teams/<uuid>/invite/      → leader invites user
POST   /polls/ideathon/teams/<uuid>/update/      → leader updates project info
POST   /polls/ideathon/teams/<uuid>/change-leader/ → leader transfers leadership
POST   /polls/ideathon/invites/<uuid>/respond/   → accept/decline invite
POST   /polls/ideathon/teams/<uuid>/request-join/ → ★ v19: user requests to join
POST   /polls/ideathon/join-requests/<uuid>/respond/ → ★ v19: leader accepts/declines

# Admin-only (staff/super_admin/mgmt_admin/team_head)
POST   /polls/admin/ideathon/toggle/             → toggle registration open/closed
POST   /polls/admin/ideathon/teams/              → admin create team
PATCH  /polls/admin/ideathon/teams/<uuid>/       → admin edit team
DELETE /polls/admin/ideathon/teams/<uuid>/       → admin disband team
POST   /polls/admin/ideathon/teams/<uuid>/add-member/    → admin add member
POST   /polls/admin/ideathon/teams/<uuid>/remove-member/ → admin remove member
POST   /polls/admin/ideathon/teams/<uuid>/change-leader/ → admin change leader
```

### ideathon_info API Response Shape
```json
{
  "registration_open": true,
  "reg_starts_at": "...",
  "reg_ends_at": "...",
  "min_team_size": 3,
  "max_team_size": 5,
  "description": "...",
  "teams": [{ "id": "...", "name": "...", "avatar": "rocket", "project_title": "...",
              "project_desc": "...", "leader_id": "...", "member_count": 3,
              "members": [{"user_id": "...", "name": "...", "is_leader": true}],
              "is_my_team": false }],
  "my_team": null,
  "pending_invites": [{"invite_id": "...", "team_name": "...", ...}],
  "pending_join_requests": [{"request_id": "...", "user_id": "...", "user_name": "...", ...}],
  "my_sent_join_requests": ["team-uuid-1", "team-uuid-2"],
  "is_interested": true,
  "interested_count": 42,
  "total_teams": 5,
  "avatar_choices": [{"value": "rocket", "label": "🚀 Rocket"}, ...]
}
```

### Join Request Flow
```
1. Participant taps "Ask to Join" on a team
   → POST /ideathon/teams/<uuid>/request-join/
   → Creates IdeathonJoinRequest(status=pending)
   → Push notification to team leader: "⚡ [Name] wants to join your team"
   → Button changes to "Pending ⏳"

2. Leader sees orange "PENDING JOIN REQUESTS" banner at top of Teams tab
   → Each request card shows applicant name, affiliation
   → Leader taps "Approve ✓" or "Decline"

3. On Accept:
   → IdeathonMember created, interest auto-registered
   → All other pending requests from this user auto-declined
   → Push to applicant: "🎉 Your request to join [team] was approved!"
   → Team payload refreshed

4. On Decline:
   → Status set to declined
   → Push to applicant: "❌ Your request to join [team] was declined"
```

### Frontend Files
```
mobile/src/screens/IdeathonScreen.js        ← Participant view (teams, pool, join requests)
mobile/src/screens/admin/IdeathonAdmin.js   ← Admin CRUD (create/edit/disband/manage members)
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
```

### Meal Data Models
```python
class MealPass(models.Model):
    id = UUIDField(primary_key=True)
    user = ForeignKey(User, null=True, blank=True)  # NULL for walk-ins
    meal_type = CharField(max_length=20, default='meal')
    date = DateField()
    is_active = BooleanField(default=True)
    used = BooleanField(default=False)
    used_at = DateTimeField(null=True)
    scanned_by = ForeignKey(User, null=True)
    # Walk-in fields
    guest_name, guest_email, guest_phone, guest_reg_no
    created_at = DateTimeField(auto_now_add=True)

class MealWindow(models.Model):
    meal_type = CharField(max_length=20, default='meal')
    date = DateField()
    start_time = TimeField(null=True)
    end_time = TimeField(null=True)
    is_open = BooleanField(default=False)
    opened_by = ForeignKey(User, null=True)  # Set = manual override
    notified_opening/notified_closing = BooleanField  # one-shot push guard
```

### Meal API Endpoints
```
GET    /api/v1/checkins/meal/status/        → mobile meal window + user's pass
POST   /api/v1/checkins/meal/generate/      → gated by check-in + window open
POST   /api/v1/checkins/meal/scan/          → verify QR (raw UUID/JSON/reg ID)
POST   /api/v1/checkins/meal/window/        → toggle (action: 'open'/'close')
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

### API Compatibility Contract
```python
# Mobile endpoints return:
{"success": True, "message": "...", "meal_window": {"is_open": True, ...}}

# Web scanner.html expects:
{"meal": {"is_open": True, "start_time": "13:00", "end_time": "13:45"}}

# Panel stats:
{"checked_in": 42, "remaining": 58, "total": 100}
```

---

## 🏠 HOME SCREEN — POLISHED FEATURES

### `mobile/src/screens/HomeTab.js`

**Countdown / Progress Bar Logic:**
```
Phase 1: Before Conference Start → Countdown to first session
Phase 2: During Active Day → Progress bar 0-100%
Phase 3: Between Days → Countdown to next day's first session
Phase 4: After Conference End → Progress bar at 100%
```
- Ticking engine: `setInterval(1000)` — 1Hz real-time
- Loading skeleton with shimmer animation
- 3D tilt hero card via PanResponder + perspective transform
- Dynamic venue display (live session room > next room > tagline)
- Live session card tappable → opens Schedule tab

---

## 🎫 QR SCREEN — POLISHED

### `mobile/src/screens/QRScreen.js`
- Holographic shimmer overlay, perforated edges, notch cutouts
- Participant photo displayed (GradientAvatar fallback)
- Email in BLACK, prominent kit status card
- Meal pass card syncs with backend state
- QR hidden when meal window is closed (both backend + client enforce)
- Uses `qrcode-generator` + `react-native-svg` for QR rendering

---

## 👨‍💼 ADMIN CHECK-IN SCREEN

### `mobile/src/screens/admin/CheckInScreen.js`
**3 Tabs:** Check In | Meal | History
- Walk-in guest meal pass with email QR attachment
- Real-time meal window status with Open/Close toggle
- Sub-tabs in History: Meal Passes | Check-Ins

---

## 🔔 PUSH NOTIFICATION SYSTEM

### Architecture
```
fcm.py (_send_expo) → Expo Push API through IITD proxy (verify=False)
fcm.py (send_to_all / send_to_role / send_to_user) → Creates UserNotification rows
apps/checkins/push.py (push_to_checked_in) → Meal state change notifications
```

### Deep-Link Data Payloads
```json
{"type": "meal_pass", "screen": "qr"}
{"type": "new_message", "conversation_id": "..."}
{"type": "connection_request"}
{"type": "feed_post"}
{"type": "session_reminder", "session_id": "..."}
{"type": "checkin_success"}
{"type": "voice_call", "caller_name": "..."}
{"type": "ideathon_invite", "team_id": "..."}
{"type": "ideathon_join_request", "team_id": "..."}
{"type": "join_request_approved", "team_id": "..."}
{"type": "join_request_declined"}
{"type": "ideathon_invite_accepted", "team_id": "..."}
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
checkins                   CheckIn — user, checkin_type, goodies_status, scanned_at
meal_passes                MealPass — UUID pk, user nullable, guest_* fields, used/used_at
meal_windows               MealWindow — date, meal_type, is_open, opened_by
notifications_devicetoken  DeviceToken — user, token, platform, is_active
notifications_notification Notification — status(pending/sent/failed), sent_count
notifications_usernotification UserNotification — delivered, read
point_entries  user_points
photos  photo_settings  selfie_points  selfie_submissions
sponsors_sponsor  speakers_speaker
schedule_schedulesession   ← Source of truth for meal windows + conference timeline
polls_poll  polls_polloption  polls_vote
polls_ideathonconfig       ← Singleton registration window
polls_ideathoninterest     ← OneToOne user interest marker
polls_ideathonteam         ← UUID pk, name, avatar, leader, project_*
polls_ideathonmember       ← FK team + OneToOne user
polls_ideathoninvite       ← Leader→user invite (pending/accepted/declined)
polls_ideathonjoinrequest  ← ★ v19: User→team join request
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

## 🎨 theme.js — DESIGN TOKENS

```javascript
// FONT is FLAT (not nested)
FONT.xs   FONT.sm   FONT.md   FONT.lg   FONT.xl   FONT.xxl
FONT.w6   FONT.w7   FONT.w8   FONT.w9

// COLORS has these keys (among others):
COLORS.brand  COLORS.brandDeep  COLORS.brandDark  COLORS.brandLight
COLORS.bg  COLORS.text  COLORS.textSec  COLORS.textTer  COLORS.textInverse
COLORS.border  COLORS.borderLight
COLORS.success  COLORS.error  COLORS.warning  COLORS.accent  COLORS.accentDark

// SPACE, RADIUS, SHADOW — standard sizing tokens
// fixMediaUrl(url) — resolves relative media URLs to absolute

// API_URL = 'http://10.17.9.48:8000/api/v1'
```

⚠️ **NEVER** write `FONT.size.lg` — FONT is flat: `FONT.lg`, `FONT.sm`, etc.
⚠️ **NEVER** write `COLORS.warning-dark` — JS interprets as subtraction. Use bracket notation `COLORS['warning-dark']` or just `COLORS.warning`.

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
✗ NEVER run Django shell scripts outside backend/

✓ ALWAYS use timezone.now().astimezone(IST) for meal logic
✓ ALWAYS return {"success": true/false} for mobile API endpoints
✓ ALWAYS return nested {"meal": {...}} for scanner.html endpoints
✓ ALWAYS set opened_by=request.user on manual toggle
✓ ALWAYS trigger sync_meal_window() before returning meal state
✓ ALWAYS check is_checked_in before allowing meal pass generation
✓ ALWAYS use meal_type='meal' (unified) for the active window
✓ ALWAYS restart gunicorn after .py changes
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
✗ Never downgrade the Expo SDK (locked at 54)
✗ Never run expo from root dir (always cd mobile/)
✗ Never add expo-router / React Navigation / TypeScript
✗ Never call hooks inside FlatList renderItem
✗ Never set Content-Type manually with FormData
✗ Never write FONT.size.lg — FONT is FLAT
✗ Never write COLORS.warning-dark — JS interprets as subtraction
✗ Never nest a FlatList in a same-direction ScrollView
✗ Never require('react-native-webrtc') before NativeModules check
✗ Never show meal QR when window is closed

✓ apiFetch() for authenticated calls (returns raw Response)
✓ For checkins/meal endpoints: use raw fetch + authHeaders(tokens) pattern
✓ QRCodeSVG: guard with String(value || 'ETD-2026')
✓ FlatList keyExtractor: use (item, idx) fallback
✓ Always copy patched files to eventapp/mobile/src/ duplicate location
✓ Always import Platform from 'react-native' if using Platform.OS
✓ Use KeyboardAvoidingView wrapping modal forms
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

## ✅ WHAT IS WORKING (COMPLETE)

```
✅ JWT Auth (access + refresh, no rotation)
✅ Email-based login, password reset via IITD SMTP
✅ Role-based access control (7 roles, 21 modules)
✅ Staff permissions with per-module granularity
✅ Web admin panel (Django MVT, hand-rolled, permission-gated sidebar)
✅ Participant management (upload CSV, add/edit/preview)
✅ Conference settings management
✅ Schedule management (CRUD + session types + rooms)
✅ Speaker management (CRUD + photos)
✅ Sponsor management (tiers + logos)
✅ Photo gallery (upload + approval workflow + selfie points)
✅ Polls (create/vote/results + ideathon poll type)
✅ Leaderboard (point system with categories)
✅ Push notifications (Expo Push API through IITD proxy)
✅ Deep-link routing from notifications
✅ Chat system (1:1 + connection requests + message reactions + reports)
✅ Staff group chat
✅ Voice calls (WebRTC with STUN/TURN via coturn)
✅ Shake-to-connect (accelerometer-based nearby discovery)
✅ Feed/posts system
✅ Checkpoint/selfie point submissions
✅ QR code generation and scanning (conference check-in + meal passes)
✅ Meal Pass System — fully working end-to-end:
   ✅ Schedule-driven auto open/close (IST timezone-aware)
   ✅ Manual admin override (sticks until manual close)
   ✅ Push notifications on every state transition
   ✅ Multi-trigger sync (Celery + all polling endpoints)
   ✅ Check-in gated pass generation
   ✅ QR hidden when window closed
   ✅ Walk-in guest pass with email QR (mobile + web)
   ✅ Real-time web scanner status
   ✅ Mobile admin 3-tab UI (Check-In/Meal/History)
✅ Home Tab countdown/progress bar with real-time ticking
✅ Home Tab 3D tilt hero card + dynamic venue display
✅ QR Screen participant photo + kit card + meal card
✅ Ideathon System — fully working end-to-end:
   ✅ Interest registration (toggle)
   ✅ Team creation with avatar + project info
   ✅ Leader invites interested participants
   ✅ Invite accept/decline with push notifications
   ✅ Join Request workflow (v19):
      ✅ "Ask to Join" button → pending state
      ✅ Push notification to team leader
      ✅ Leader sees orange action banner
      ✅ Accept: auto-adds member, declines other requests, push to user
      ✅ Decline: push to user
   ✅ Leadership transfer (leader-only)
   ✅ Leave team / disband (auto leader transfer)
   ✅ Team name availability check (debounced)
   ✅ Admin CRUD from mobile (create/edit/disband/add/remove members)
   ✅ Interested participants grid with search + invite
   ✅ Team size validation badges (VALID/INCOMPLETE)
   ✅ Audience Choice Voting banner (links to Polls)
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
❌ Assign meal passes to registered users from mobile admin
❌ Time picker for meal schedule on mobile
❌ POLISHING: consistent styling, loading states, error boundaries
❌ POLISHING: animation transitions, haptic feedback consistency
❌ POLISHING: empty states, edge cases, offline handling
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
```