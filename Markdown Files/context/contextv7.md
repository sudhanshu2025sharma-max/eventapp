[Improvements]
# Complete Project Context (v7 — Chat Ready)

---

## PROJECT OVERVIEW
```
Product: Conference Management Platform
Event:   ETD 2026 — "ETDs in the age of AI" — IIT Delhi
Website: https://etd2026.iitd.ac.in/
Type:    Mobile App (React Native Expo) + Web Admin Panel (Django MVT)
GitHub:  Repository: eventapp | Path: /workspaces/eventapp
Dev Env: GitHub Codespaces (Ubuntu)
Status:  Core features COMPLETE + Schedule/Timeline/Feedback COMPLETE
         Now in polishing/new features phase
```

---

## COMPLETE PROJECT STRUCTURE
```
/workspaces/eventapp/
├── backend/
│   ├── confhub/
│   │   ├── settings.py
│   │   ├── urls.py
│   │   ├── asgi.py
│   │   └── wsgi.py
│   ├── apps/
│   │   ├── accounts/
│   │   │   ├── models.py
│   │   │   ├── views.py
│   │   │   ├── admin_views.py
│   │   │   ├── admin_urls.py
│   │   │   ├── urls.py
│   │   │   ├── serializers.py
│   │   │   └── management/commands/
│   │   │       ├── seed_dummy_participants.py
│   │   │       └── purge_dummy_participants.py
│   │   ├── notifications/
│   │   │   ├── models.py
│   │   │   ├── views.py
│   │   │   ├── admin_views.py
│   │   │   ├── admin_urls.py
│   │   │   ├── urls.py
│   │   │   └── fcm.py          ← Expo Push API sender
│   │   ├── sponsors/
│   │   ├── speakers/
│   │   ├── conferences/
│   │   ├── events/
│   │   ├── photos/
│   │   ├── polls/
│   │   ├── posts/
│   │   ├── checkins/
│   │   │   ├── models.py
│   │   │   ├── views.py
│   │   │   ├── admin_views.py
│   │   │   ├── admin_urls.py
│   │   │   └── urls.py
│   │   ├── chat/
│   │   │   ├── models.py
│   │   │   ├── views.py
│   │   │   └── urls.py
│   │   ├── leaderboard/
│   │   └── schedule/               ← NEW — full schedule/timeline system
│   │       ├── models.py
│   │       ├── views.py
│   │       ├── serializers.py
│   │       ├── admin_views.py
│   │       ├── admin_urls.py
│   │       ├── urls.py
│   │       ├── apps.py
│   │       └── management/commands/
│   │           ├── seed_schedule.py
│   │           └── send_session_reminders.py
│   ├── templates/panel/        ← ALL web admin templates live here
│   │   ├── base.html
│   │   ├── login.html
│   │   ├── dashboard.html
│   │   ├── participants_list.html
│   │   ├── participants_upload.html
│   │   ├── participants_preview.html
│   │   ├── participant_add.html
│   │   ├── participant_edit.html
│   │   ├── checkin_list.html
│   │   ├── scanner.html
│   │   ├── notifications.html
│   │   ├── notification_edit.html
│   │   ├── speakers_list.html
│   │   ├── speaker_form.html
│   │   ├── sponsors_list.html
│   │   ├── sponsor_form.html
│   │   ├── users_manage.html
│   │   ├── events_list.html
│   │   ├── event_form.html
│   │   ├── conference_settings.html
│   │   ├── password_reset_request.html
│   │   ├── password_reset_confirm.html
│   │   ├── schedule_list.html       ← NEW
│   │   ├── schedule_form.html       ← NEW
│   │   ├── schedule_feedback.html   ← NEW
│   │   └── schedule_analytics.html  ← NEW
│   ├── media/
│   ├── requirements.txt
│   ├── db.sqlite3
│   └── manage.py
├── mobile/
│   ├── App.js                  ← root, session + token refresh
│   ├── app.json
│   ├── babel.config.js
│   ├── package.json
│   ├── eas.json
│   ├── index.js
│   ├── google-services.json
│   └── src/
│       ├── theme.js
│       ├── components.js
│       ├── cache.js
│       ├── api.js                   ← NEW — auto-refresh fetch wrapper
│       ├── MainApp.js
│       ├── notifications.js
│       └── screens/
│           ├── LoginScreen.js
│           ├── HomeTab.js
│           ├── ScheduleTab.js       ← NEW — real API, animated timeline
│           ├── QRScreen.js
│           ├── FeedScreen.js
│           ├── NetworkScreen.js
│           ├── ProfileTab.js
│           ├── NotificationsScreen.js
│           ├── EditProfileScreen.js
│           ├── ChangePasswordScreen.js
│           ├── SponsorsScreen.js
│           ├── SponsorDetailScreen.js
│           ├── SpokersScreen.js
│           ├── SpeakerDetailScreen.js
│           ├── ChatListScreen.js
│           ├── ChatRoomScreen.js
│           ├── ContactCardModal.js
│           ├── TopicPickerModal.js
│           ├── SpeakerRequestModal.js
│           ├── ConnectionRequestsScreen.js
│           └── admin/
│               ├── AdminTab.js
│               ├── NotificationsAdmin.js
│               ├── UsersAdmin.js
│               ├── AddParticipantScreen.js
│               ├── CheckInScreen.js
│               └── ScheduleAdmin.js  ← NEW — full session CRUD
├── .devcontainer/
│   ├── devcontainer.json
│   └── autostart.sh
└── docker-compose.yml
```

---

## TECH STACK
```
MOBILE:
  Framework:     React Native Expo SDK 54.0.36
  React:         19.1.0
  React Native:  0.81.5
  Entry:         index.js → registerRootComponent(App)
  Navigation:    Manual useState (NO expo-router, NO React Navigation)
  Language:      JavaScript only (NO TypeScript)
  State:         useState + useRef (no Zustand, no Redux)
  API:           src/api.js (apiFetch wrapper) + raw fetch() for public
  Icons:         @expo/vector-icons (Ionicons)
  Cache:         AsyncStorage via src/cache.js

BACKEND:
  Framework:   Django 4.2.9 + Django REST Framework
  Auth:        JWT via djangorestframework-simplejwt
  User model:  Custom (UUID pk, email as USERNAME_FIELD, role field)
  Database:    SQLite (dev)
  Push:        Expo Push API (NOT Firebase Admin SDK for sending)
  Admin panel: Custom Django MVT (NO Bootstrap, custom CSS in base.html)
  Media:       ImageField uploads served via MEDIA_URL/MEDIA_ROOT

INFRASTRUCTURE:
  Dev:     GitHub Codespaces
  Docker:  PostgreSQL:5432, Redis:6379, MinIO:9000
  Ports:   Django:8000, Expo:8081
  Tunnel:  ngrok → Django (stable: bauble-aftermost-buffalo.ngrok-free.dev)
```

---

## STARTUP SEQUENCE (Every Codespace restart)
```bash
# Terminal 1 — Docker + Django
cd /workspaces/eventapp && docker compose up -d && sleep 3
cd backend && python manage.py runserver 0.0.0.0:8000

# Terminal 2 — ngrok
ngrok http 8000

# Terminal 3 — Expo
cd /workspaces/eventapp/mobile && npx expo start --tunnel --port 8081 --clear
```

---

## CRITICAL: API FETCH WRAPPER — src/api.js
```javascript
/*
 * Auto-refreshing fetch wrapper — ALWAYS use apiFetch() for
 * authenticated requests in mobile screens.
 *
 * On 401 → refreshes JWT via /auth/token/refresh/ → retries once.
 * Token is stored in module-level _tokens (set via setTokens()).
 *
 * How it is wired:
 *   App.js:      setApiTokens(tokens, onUpdated) on login/restore
 *   MainApp.js:  useEffect → setApiTokens(tokens) when prop changes
 *                tokensRef.current always has latest token for intervals
 *   HomeTab.js:  same pattern — tokensRef + useEffect sync
 *
 * Usage:
 *   import { apiFetch } from '../api';
 *   const res = await apiFetch('/notifications/my/');
 *   const data = await res.json();
 *
 * For public endpoints (no auth): use raw fetch() with API_HEADERS
 */

export function setTokens(tokens, onUpdated)  // set + optional persist cb
export function getTokens()                   // read current tokens
export function authHeaders()                 // build auth header object
export async function apiFetch(path, options) // auto-refresh fetch
```

---

## TOKEN REFRESH PATTERN (CRITICAL — do not revert)
```
Problem solved:
  - JWT access token expires after 24h
  - 30-second polling intervals capture stale token in closure
  - Module-level api.js state races with React render cycle

Solution:
  1. App.js: refresh token on restore (401 → refresh → retry)
  2. App.js: useEffect([tokens]) → setApiTokens() immediately
  3. MainApp.js + HomeTab.js:
       const tokensRef = useRef(tokens);
       useEffect(() => { tokensRef.current = tokens; }, [tokens]);
     Intervals use tokensRef.current (always latest)
  4. apiFetch() auto-refreshes on 401 and retries

Key rule:
  ✓ Use apiFetch() for ALL authenticated API calls in intervals/polling
  ✓ Use tokensRef.current inside setInterval callbacks
  ✓ Pass tokens directly for one-time calls (not in intervals)
  ✗ Never use raw fetch() with Bearer token inside setInterval
```

---

## SCHEDULE APP — Complete Architecture

### Models (apps/schedule/models.py)
```python
ScheduleSession:
  id (UUID), day (1/2/3), title, session_type, start_datetime,
  end_datetime, room, description, speaker (FK nullable),
  is_featured, is_parallel, is_published,
  feedback_enabled, feedback_auto_open, feedback_manual_open,
  notify_all_5_sent_at, notify_featured_60_sent_at,
  display_order, created_at, updated_at

  @property feedback_open:
    True if feedback_manual_open OR (feedback_auto_open AND now >= end)
  @property status: 'upcoming' | 'live' | 'past'

ScheduleSubSession:
  parent (FK → ScheduleSession), title, start_datetime,
  end_datetime, speaker (FK nullable), description, display_order

SessionBookmark:
  user, session, reminder_minutes (5/15/30/60),
  reminder_sent (bool), created_at
  unique: (user, session)

FeedbackForm:
  session (OneToOne), title, is_active

FeedbackQuestion:
  form, question_text, question_type (rating/boolean/text),
  is_required, display_order

FeedbackResponse:
  id (UUID), session, form, user, submitted_at
  unique: (user, session)

FeedbackAnswer:
  response, question, rating_value (1-5), boolean_value, text_value
```

### SESSION_TYPE choices
```
keynote, technical, workshop, break, meal, cultural,
panel, ceremony, ideathon, special
```

### Schedule API Endpoints
```
PUBLIC / USER:
  GET  /api/v1/schedule/sessions/                        ← ?day=1|2|3
  GET  /api/v1/schedule/sessions/<uuid>/
  POST /api/v1/schedule/sessions/<uuid>/bookmark/        ← toggle
  PATCH /api/v1/schedule/sessions/<uuid>/reminder/
  GET  /api/v1/schedule/sessions/<uuid>/feedback/
  POST /api/v1/schedule/sessions/<uuid>/feedback/submit/
  GET  /api/v1/schedule/bookmarks/                       ← my bookmarks

ADMIN API:
  GET    /api/v1/schedule/admin/sessions/                ← ?day=1|2|3
  POST   /api/v1/schedule/admin/sessions/create/
  PATCH  /api/v1/schedule/admin/sessions/<uuid>/update/
  DELETE /api/v1/schedule/admin/sessions/<uuid>/delete/
  POST   /api/v1/schedule/admin/sessions/<uuid>/feedback-toggle/
  GET    /api/v1/schedule/admin/sessions/<uuid>/feedback-analytics/
  POST   /api/v1/schedule/admin/sessions/<uuid>/subsessions/
  DELETE /api/v1/schedule/admin/subsessions/<id>/delete/
```

### Schedule Web Admin URLs
```
/panel/schedule/                              ← list (schedule_panel)
/panel/schedule/new/                          ← create (schedule_create)
/panel/schedule/<uuid>/edit/                  ← edit (schedule_edit)
/panel/schedule/<uuid>/delete/                ← delete
/panel/schedule/<uuid>/subsessions/add/       ← AJAX add sub
/panel/schedule/subsessions/<id>/delete/      ← AJAX delete sub
/panel/schedule/<uuid>/feedback/              ← manage form
/panel/schedule/<uuid>/feedback/question/add/ ← AJAX add question
/panel/schedule/feedback/question/<id>/delete/← AJAX delete question
/panel/schedule/<uuid>/feedback/toggle/       ← AJAX toggle
/panel/schedule/<uuid>/analytics/             ← responses analytics
```

### Reminder System (Cron)
```bash
# Add to crontab:
* * * * * cd /workspaces/eventapp/backend && python manage.py send_session_reminders >> /tmp/reminders.log 2>&1

Logic:
  1. Featured sessions → push ALL users 60 min before (once, tracked)
  2. All sessions      → push ALL users 5 min before (once, tracked)
  3. Bookmarked users  → push at their chosen reminder_minutes (once)

Dedup: notify_all_5_sent_at + notify_featured_60_sent_at fields
       SessionBookmark.reminder_sent bool
```

### Seed Command
```bash
python manage.py seed_schedule
# Seeds all 32 sessions + sub-sessions + default feedback forms
# Safe to re-run (clears first)
```

---

## MOBILE SCHEDULE TAB — ScheduleTab.js
```
Tabs: [Day 1] [Day 2] [Day 3] [★ Bookmarks]
  Animated sliding indicator between tabs

Session Cards:
  Featured (★): gradient card (brandDeep → brand), larger
  Regular: glass card with color-coded left bar per type
  LIVE: pulsing badge + highlighted border
  PAST: 50% opacity
  Parallel: PARALLEL badge

Interactive:
  Tap card → expand sub-sessions (animated chevron)
  Tap ♡ → bookmark (if not bookmarked: opens reminder picker)
  Tap ♡ again → unbookmark immediately
  Feedback button → appears on PAST sessions when feedback_open=true

NowLine: pulsing red dot + dashed line above current session

Modals:
  FeedbackModal: question by question (rating stars, yes/no, text)
  ReminderModal: pick 5/15/30/60 min before

Data: fetched from API, includes is_bookmarked + bookmark_reminder
      bookmarks tab fetches /schedule/bookmarks/
```

---

## MOBILE ADMIN — ScheduleAdmin.js
```
Screens (internal navigation via useState):
  List view:
    - Day filter chips (All/Day1/Day2/Day3)
    - Skeleton loading (animated pulse)
    - Pull to refresh
    - + button in header → create

  Session Detail:
    - Title, type badge, status badge, time, room
    - Sub-sessions list
    - Quick toggle: Published / Featured (tap to toggle via API)
    - Feedback open/close + analytics button
    - Edit button (pencil) in header

  Session Form (Create/Edit):
    - Title, Session Type (horizontal chip scroll)
    - DateTimeField → opens DateTimePickerModal
    - Room, Description, Display Order
    - Toggle switches: Published/Featured/Parallel/Feedback/Auto-open
    - Sub-sessions (edit mode only): add/delete inline
    - Save / Delete buttons

  Analytics view:
    - Per-question aggregates (avg rating, yes/no %)
    - Individual responses table

DateTimePicker (custom, no native dep):
  - Date: text input (YYYY-MM-DD) + quick buttons Oct 23/24/25
  - Hour: scrollable 12h picker
  - Minute: scrollable (0,5,10...55)
  - AM/PM: toggle buttons
  - Preview line showing selected datetime
  - Tap outside (overlay) → closes picker
  - Cancel / Confirm buttons
  - Integrated via DateTimeField component
```

---

## PUSH NOTIFICATION SYSTEM — fcm.py
```python
# All functions:
send_to_all(title, body, data, notif, request)
send_to_role(role, title, body, data, notif, request)
send_to_user(user, title, body, data, notif, request)
send_to_tokens(tokens, title, body, data, img)  ← PUBLIC alias for _send_hybrid

# send_to_tokens is used by:
#   checkins/views.py       — on conference check-in scan
#   checkins/admin_views.py — on web panel scan
#   schedule reminders      — on session start reminders

# Internal:
_send_hybrid(tokens, title, body, data, img)  ← Expo push for ExponentPushToken
_send_fcm(tokens, ...)                         ← FCM for raw FCM tokens
_send_expo(tokens, ...)                        ← Expo Push API

# CRITICAL: Always use send_to_tokens() — never call _send_hybrid directly
```

---

## ADMIN PANEL WIRING
```
TEMPLATE DIRECTORY:
  backend/templates/panel/
  Linked via settings.py:
    TEMPLATES = [{ 'DIRS': [BASE_DIR / 'templates'] }]
  All templates extend: {% extends "panel/base.html" %}

URL ROUTING (confhub/urls.py):
  path('panel/', include('apps.accounts.admin_urls'))
  path('panel/', include('apps.notifications.admin_urls'))
  path('panel/', include('apps.checkins.admin_urls'))
  path('panel/', include('apps.sponsors.admin_urls'))
  path('panel/', include('apps.speakers.admin_urls'))
  path('panel/', include('apps.chat.admin_urls'))
  path('panel/', include('apps.schedule.admin_urls'))   ← NEW

  path('api/v1/schedule/', include('apps.schedule.urls'))  ← NEW

SIDEBAR (base.html):
  Events & Schedule → /panel/schedule/
    └── Add Session → /panel/schedule/new/
  All other items: sponsors, speakers, checkins, notifications, users

AUTH:
  Panel uses Django session auth (@login_required + admin_required)
  API uses JWT Bearer tokens (apiFetch on mobile)
```

---

## SETTINGS.PY — INSTALLED_APPS (relevant)
```python
LOCAL_APPS = [
    'apps.accounts',
    'apps.notifications',
    'apps.sponsors',
    'apps.speakers',
    'apps.conferences',
    'apps.events',
    'apps.photos',
    'apps.polls',
    'apps.posts',
    'apps.checkins',
    'apps.leaderboard',
    'apps.chat',
    'apps.schedule',    ← NEW
]
```

---

## MOBILE NAVIGATION PATTERN
```
App.js:
  Web:    localStorage for session persistence
  Native: AsyncStorage for session persistence
  Restores session → refreshes token if 401 → shows MainApp or Login

MainApp.js:
  const [tab, setTab] = useState('home')
  const [subScreen, setSubScreen] = useState(null)
  tokensRef = useRef(tokens) — for interval callbacks

Tab bar: home | schedule | qr (center) | network | admin/profile

ScheduleTab now passes tokens prop:
  schedule: <ScheduleTab tokens={tokens} />
```

---

## MOBILE ADMIN TAB FEATURES
```
AdminTab FEATURES array:
  checkin      → CheckInScreen   (QR scan + meal)
  notifications→ NotificationsAdmin
  add_participant → AddParticipantScreen
  users        → UsersAdmin
  schedule     → ScheduleAdmin   ← NEW (Sessions, blue gradient)
```

---

## WHAT IS WORKING ✅
```
✅ Django API + ngrok + web browser access
✅ CORS correctly configured
✅ JWT auth with AUTO-REFRESH (access token refreshes on 401)
✅ Token refresh in: restore flow, 20-min timer, apiFetch auto-retry
✅ tokensRef pattern prevents stale closure in 30s polling intervals
✅ Session persistence (localStorage web, AsyncStorage native)
✅ Mobile Dev Build APK (SDK 54)
✅ All tabs + bottom tab bar + floating QR button
✅ Push notifications end-to-end (FCM V1 via Expo Push)
✅ send_to_tokens() public function in fcm.py
✅ Push on check-in scan + meal scan
✅ Edit Profile, Change Password
✅ SPONSORS: full CRUD + API + mobile screens
✅ SPEAKERS: full CRUD + talks + API + mobile screens
✅ CHAT: full system (requests, conversations, messages)
✅ Network screen: cache-first, bulk status, debounced search
✅ PARTICIPANT IMPORT: bulk CSV/Excel + single add
✅ Admin panel check-in list + scanner
✅ Admin mobile CheckInScreen: 3 tabs (checkin/meal/history)
✅ Conference Kit tracking everywhere
✅ Meal pass: unified single type
✅ Leaderboard points: check-in + meal scan
✅ Dashboard uses real data

✅ SCHEDULE SYSTEM (NEW — fully complete):
  ✅ 32 sessions seeded (3 days, all ETD 2026 program)
  ✅ Sub-sessions with expand/collapse animation
  ✅ Featured sessions (★) with gradient cards
  ✅ LIVE / PAST / UPCOMING states with visual indicators
  ✅ Parallel session badge
  ✅ Bookmarks (server-side) + My Bookmarks tab
  ✅ Reminder picker (5/15/30/60 min)
  ✅ Feedback system: dynamic forms, per-question types
  ✅ Feedback auto-open at session end OR manual admin toggle
  ✅ Feedback analytics: avg ratings, yes/no %, individual responses
  ✅ Cron-based reminder push (no Celery needed)
  ✅ Featured sessions → 1hr push to all users
  ✅ All sessions → 5min push to all users
  ✅ Bookmarked sessions → push at chosen reminder time
  ✅ Web admin: full CRUD, sub-session management, form builder
  ✅ Mobile admin: ScheduleAdmin with skeleton loading, DateTimePicker
  ✅ Custom DateTimePicker (no new deps): 12h + AM/PM + free date entry
  ✅ Skeleton loading on schedule list
  ✅ ScheduleTab: animated day tabs, NowLine indicator
```

---

## WHAT IS PLACEHOLDER ❌
```
❌ Schedule tab "Live" stream button (expo-av installed, not built)
❌ Feed tab — hardcoded posts
❌ Leaderboard screen — points awarded but no screen
❌ Photos screen — no screen
❌ Polls screen — no screen
❌ Venue map — expo-maps not installed
❌ Speaker/session linking (speaker FK exists on session, UI not built)
❌ Session-level speaker display in ScheduleTab
❌ Password reset via email (form exists, SMTP not configured)
```

---

## IMPORTANT RULES
```
MOBILE:
  ✗ Never downgrade Expo SDK
  ✗ Never add expo-router / React Navigation
  ✗ Never add TypeScript
  ✗ Never add plugins to app.json without rebuilding APK
  ✗ Never change API_URL back to Platform.OS conditional
  ✗ Never remove ngrok-skip-browser-warning from API_HEADERS
  ✗ Never use raw fetch() with Bearer token inside setInterval
  ✓ All screens are .js files in src/screens/
  ✓ All styles use COLORS/FONT/SPACE/RADIUS/SHADOW from theme.js
  ✓ Reuse components from components.js
  ✓ Use cache.js for any list screen data
  ✓ Speaker screen file: SpokersScreen.js (NOT SpeakersScreen.js)
  ✓ Use apiFetch() for ALL authenticated API calls
  ✓ Use tokensRef.current inside setInterval callbacks
  ✓ New native package = new EAS build required

BACKEND:
  ✗ Never use Firebase Admin SDK for sending push
  ✗ Never use Legacy FCM API
  ✗ Never move CorsMiddleware below SecurityMiddleware
  ✓ Push via Expo Push API only (fcm.py → send_to_tokens)
  ✓ Conversation: participant_a/participant_b (NOT M2M)
  ✓ Conference Kit (NOT Goodies) in all UI
  ✓ Admin panel uses base.html CSS variables only
  ✓ chat/urls.py: bulk endpoint BEFORE uuid endpoint
  ✓ Meal type: 'meal' for all new records
  ✓ schedule app: label = 'schedule' in apps.py (not 'apps.schedule')
  ✓ After ANY settings.py change: restart Django

SCHEDULE SPECIFIC:
  ✓ Datetime always stored as UTC-aware in Django
  ✓ Seed command clears first — safe to re-run
  ✓ feedback_open is a @property — not a DB field
  ✓ notify_*_sent_at fields prevent duplicate cron sends
  ✓ SessionBookmark.reminder_sent resets if reminder_minutes changes
  ✓ DateTimePicker in mobile uses local ISO string (YYYY-MM-DDTHH:MM:00)
  ✓ Backend _parse_dt() handles both aware and naive datetime strings
```

---

## NGROK
```
Stable URL: https://bauble-aftermost-buffalo.ngrok-free.dev
theme.js: const NGROK = 'https://bauble-aftermost-buffalo.ngrok-free.dev/api/v1';
export const API_URL = NGROK;
```

---

## TEST CREDENTIALS
```
MOBILE + WEB APP:
  participant@test.com / Test@1234
  speaker@test.com    / Test@1234
  Dummy: firstname.lastname@test.com / Test@1234

ADMIN PANEL (/panel/login/):
  etd@admin.iitd.ac.in / Admin@1234  (role: super_admin)
```

---

## QUICK DIAGNOSTIC
```bash
echo "=== Django ===" && \
curl -s http://localhost:8000/api/v1/auth/me/ && echo "" && \
echo "=== ngrok ===" && \
curl -s http://localhost:4040/api/tunnels | python3 -c \
"import sys,json; print(json.load(sys.stdin)['tunnels'][0]['public_url'])" && \
echo "=== Schedule API ===" && \
curl -s "http://localhost:8000/api/v1/schedule/sessions/?day=1" | python3 -c \
"import sys,json; d=json.load(sys.stdin); print(f'{len(d[\"sessions\"])} sessions on Day 1')" && \
echo "=== Docker ===" && \
docker compose ps --format "table {{.Name}}\t{{.Status}}"
```

---

## GIT
```
Remote: https://github.com/sudhanshu1907/eventapp
Branch: main
```
Taks:
The days time line is not visible in home page under timeline

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