# Complete Project Context (v9 — Production VM Ready)

---

## PROJECT OVERVIEW
```
Product: Conference Management Platform
Event:   ETD 2026 — "ETDs in the age of AI" — IIT Delhi
Website: https://etd2026.iitd.ac.in/
Type:    Mobile App (React Native Expo) + Web Admin Panel (Django MVT)
GitHub:  Repository: eventapp (github.com/Sharma1907/eventapp)
Dev Env: IITD VM (baadalvm) — Ubuntu 24.04 LTS, 8 cores, 7.7GB RAM, 24/7
Status:  Core features COMPLETE + Schedule/Timeline/Feedback COMPLETE
         Leaderboard COMPLETE + Photos COMPLETE
         Speakers (19) + Sponsors (13) seeded with images
         Now in polishing/new features phase
```

---

## DEPLOYMENT ARCHITECTURE
```
IITD VM (baadalvm):
  OS:         Ubuntu 24.04 LTS
  IP:         10.17.9.48 (internal IITD network only)
  User:       baadalvm
  Home:       /home/baadalvm
  Project:    /home/baadalvm/eventapp/
  Python:     3.12.3 (system — NO virtual env, --break-system-packages)
  Node:       v20.20.2 (via snap)
  npm:        10.8.2

  Django:     python3 manage.py runserver 0.0.0.0:8000
  Expo:       npx expo start --lan --port 8081
  PostgreSQL: 16 (system service, NOT Docker)
  Redis:      7 (system service, NOT Docker)

  Access:
    Admin Panel: http://10.17.9.48:8000/panel/login/
    API:         http://10.17.9.48:8000/api/v1/
    Web App:     http://10.17.9.48:8081/
    ⚠️ Only accessible from IITD campus network

  Persistent Sessions:
    screen -S django   → Django server
    screen -S expo     → Expo dev server
    screen -r django   → reattach
    screen -r expo     → reattach
    screen -ls         → list sessions

  Proxy:
    IITD proxy: proxy21.iitd.ac.in:3128
    Blocks: ngrok, cloudflared, most tunnels
    SSL inspection: breaks certificate verification
    pip works with: --break-system-packages
    npm proxy: npm config set proxy/https-proxy
    Python downloads: need ssl.CERT_NONE context
    apt: mostly broken for new packages (Hash Sum mismatch)

  ⚠️ No Docker: PostgreSQL + Redis run as system services
  ⚠️ No ngrok: IITD proxy blocks all tunnel services
  ⚠️ No virtualenv: packages installed system-wide
```

---

## COMPLETE PROJECT STRUCTURE
```
/home/baadalvm/eventapp/
├── backend/
│   ├── confhub/
│   │   ├── settings.py          ← USE_POSTGRES toggle, INSTALLED_APPS
│   │   ├── urls.py              ← ALL routes wired here
│   │   ├── asgi.py
│   │   └── wsgi.py
│   ├── apps/
│   │   ├── accounts/
│   │   │   ├── models.py         ← Custom User (UUID pk, email login, role field)
│   │   │   ├── views.py          ← API: login, me, update-profile, change-password
│   │   │   ├── admin_views.py    ← Web panel: participants, users, bulk upload
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
│   │   │   └── fcm.py            ← Expo Push API sender
│   │   ├── sponsors/
│   │   ├── speakers/
│   │   ├── conferences/
│   │   ├── events/
│   │   ├── photos/
│   │   │   ├── models.py         ← PhotoSettings (singleton), Photo
│   │   │   ├── views.py          ← gallery, upload, mine, delete, admin CRUD
│   │   │   ├── admin_views.py    ← Web panel: moderation queue
│   │   │   ├── admin_urls.py
│   │   │   └── urls.py
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
│   │   │   ├── models.py         ← PointEntry, UserPoints, PointAction
│   │   │   ├── views.py          ← my_points, leaderboard top-50
│   │   │   ├── utils.py          ← award_points(), award_daily_login()
│   │   │   ├── admin_views.py    ← Web panel: leaderboard table
│   │   │   ├── admin_urls.py
│   │   │   └── urls.py
│   │   └── schedule/
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
│   ├── templates/panel/          ← ALL web admin templates
│   │   ├── base.html             ← master layout, sidebar, CSS variables
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
│   │   ├── schedule_list.html
│   │   ├── schedule_form.html
│   │   ├── schedule_feedback.html
│   │   ├── schedule_analytics.html
│   │   ├── leaderboard.html
│   │   └── photos.html
│   ├── media/
│   │   ├── sponsors/             ← 13 sponsor logos
│   │   └── speakers/             ← 19 speaker photos
│   ├── seed_sponsors.py          ← standalone seed script
│   ├── seed_speakers.py          ← standalone seed script
│   ├── requirements.txt
│   ├── .env                      ← NOT in git, created manually on VM
│   └── manage.py
├── mobile/
│   ├── App.js                    ← root, session + token refresh
│   ├── app.json
│   ├── babel.config.js
│   ├── package.json
│   ├── eas.json
│   ├── index.js
│   ├── google-services.json
│   └── src/
│       ├── theme.js              ← COLORS, FONT, SPACE, RADIUS, SHADOW, API_URL
│       ├── components.js         ← shared components
│       ├── cache.js
│       ├── api.js                ← auto-refresh fetch wrapper (FormData aware)
│       ├── MainApp.js            ← tab router + subScreen router
│       ├── notifications.js
│       └── screens/
│           ├── LoginScreen.js
│           ├── HomeTab.js
│           ├── ScheduleTab.js
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
│           ├── LeaderboardScreen.js
│           ├── PhotosScreen.js
│           └── admin/
│               ├── AdminTab.js
│               ├── NotificationsAdmin.js
│               ├── UsersAdmin.js
│               ├── AddParticipantScreen.js
│               ├── CheckInScreen.js
│               ├── ScheduleAdmin.js
│               └── PhotosAdmin.js
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
  Image Pick:    expo-image-picker ~17.0.11

BACKEND:
  Framework:   Django 4.2.9 + Django REST Framework
  Auth:        JWT via djangorestframework-simplejwt
  User model:  Custom (UUID pk, email as USERNAME_FIELD, role field)
  Database:    PostgreSQL 16 (system service on VM)
  Cache:       Redis 7 (system service on VM)
  Push:        Expo Push API (NOT Firebase Admin SDK for sending)
  Admin panel: Custom Django MVT (NO Bootstrap, custom CSS in base.html)
  Media:       ImageField uploads served via MEDIA_URL/MEDIA_ROOT
```

---

## DATABASE CONFIGURATION
```
PostgreSQL 16 (system service, NOT Docker):
  Database:  etdapp
  User:      etdapp_admin
  Host:      localhost
  Port:      5432

.env toggle:
  USE_POSTGRES=True  → uses PostgreSQL
  USE_POSTGRES=False → falls back to SQLite

settings.py logic:
  if config('USE_POSTGRES', default=False, cast=bool):
      DATABASES = {
          'default': {
              'ENGINE': 'django.db.backends.postgresql',
              'NAME': config('DB_NAME'),
              'USER': config('DB_USER'),
              'PASSWORD': config('DB_PASSWORD'),
              'HOST': config('DB_HOST'),
              'PORT': config('DB_PORT'),
          }
      }
  else:
      DATABASES = { 'default': { 'ENGINE': 'sqlite3', ... } }

.env file (backend/.env — NOT in git):
  SECRET_KEY=<generated>
  DEBUG=True
  ALLOWED_HOSTS=10.17.9.48,127.0.0.1,localhost,.ngrok-free.app,.ngrok.io
  USE_POSTGRES=True
  DB_NAME=etdapp
  DB_USER=etdapp_admin
  DB_PASSWORD=<password>
  DB_HOST=localhost
  DB_PORT=5432
  REDIS_URL=redis://127.0.0.1:6379/0

DB table names (custom — NOT default Django names):
  users (not accounts_user)
  checkins (not checkins_checkin)
  meal_passes, meal_windows
  participant_imports
  user_fcm_tokens
  point_entries, user_points
  photos, photo_settings
  sponsors_sponsor, speakers_speaker (default Django names)
  schedule_schedulesession (default)

Verify command:
  PGPASSWORD=<pwd> psql -U etdapp_admin -d etdapp -h localhost -c "\dt"

Current data:
  users: 103 (3 test + 100 dummy)
  schedule_sessions: 32
  sponsors: 13
  speakers: 19
  checkins: 3
```

---

## STARTUP SEQUENCE (IITD VM)
```bash
# SSH into VM
ssh baadalvm@10.17.9.48

# Terminal 1 — Django (use screen for persistence)
screen -S django
cd /home/baadalvm/eventapp/backend
python3 manage.py runserver 0.0.0.0:8000
# Ctrl+A then D to detach

# Terminal 2 — Expo (use screen for persistence)
screen -S expo
cd /home/baadalvm/eventapp/mobile
npx expo start --lan --port 8081
# Ctrl+A then D to detach

# Reattach later:
screen -r django
screen -r expo
screen -ls  # list all
```

---

## CRITICAL: API FETCH WRAPPER — src/api.js
```javascript
/*
 * Auto-refreshing fetch wrapper — ALWAYS use apiFetch() for
 * authenticated requests in mobile screens.
 *
 * KEY FEATURE: FormData aware — does NOT set Content-Type for
 * FormData bodies (lets browser set multipart boundary automatically).
 *
 * On 401 → refreshes JWT via /auth/token/refresh/ → retries once.
 * Token is stored in module-level _tokens (set via setTokens()).
 *
 * Usage:
 *   import { apiFetch } from '../api';
 *   const res = await apiFetch('/notifications/my/');
 *   const data = await res.json();
 *
 *   // FormData upload:
 *   const form = new FormData();
 *   form.append('image', { uri, type, name });
 *   const res = await apiFetch('/photos/upload/', { method: 'POST', body: form });
 */
export function setTokens(tokens, onUpdated)
export function getTokens()
export function authHeaders()
export async function apiFetch(path, options)  // FormData auto-detected
```

---

## TEMPLATE DIRECTORY WIRING
```
DIRECTORY:
  backend/templates/panel/

SETTINGS.PY LINK:
  TEMPLATES = [{
    'DIRS': [BASE_DIR / 'templates'],  ← points to backend/templates/
    ...
  }]

ALL TEMPLATES EXTEND:
  {% extends "panel/base.html" %}

BASE.HTML PROVIDES:
  - CSS variables: --brand, --text, --bg-sec, --border, --brand-light etc.
  - Sidebar navigation with active state:
    {% if request.resolver_match.url_name == 'xxx' %}active{% endif %}
  - Font Awesome icons (fas fa-*)
  - Flash messages display
  - Responsive layout

SIDEBAR ITEMS:
  Dashboard           → /panel/dashboard/
  Events & Schedule   → /panel/schedule/
  Photos              → /panel/photos/
  Leaderboard         → /panel/leaderboard/
  Chat & Connections  → /panel/chat/
  Reported Messages   → /panel/chat/reports/
  Notifications       → /panel/notifications/
  Sponsors            → /panel/sponsors/
  Speakers            → /panel/speakers/
  User Management     → /panel/users/manage/
  Check-in List       → /panel/checkins/
  Conference Settings → /panel/conference/
```

---

## URL ROUTING — confhub/urls.py
```python
# Web Admin Panel (Django session auth)
path('panel/', include('apps.accounts.admin_urls'))
path('panel/', include('apps.notifications.admin_urls'))
path('panel/', include('apps.checkins.admin_urls'))
path('panel/', include('apps.sponsors.admin_urls'))
path('panel/', include('apps.speakers.admin_urls'))
path('panel/', include('apps.chat.admin_urls'))
path('panel/', include('apps.schedule.admin_urls'))
path('panel/', include('apps.leaderboard.admin_urls'))
path('panel/', include('apps.photos.admin_urls'))

# Mobile API (JWT Bearer token)
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

# Media files
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
```

---

## SETTINGS.PY — INSTALLED_APPS
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
    'apps.schedule',
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
  const [subParams, setSubParams] = useState({})

  Tab bar: home | schedule | qr (center) | network | admin/profile

  SubScreens routed via if (subScreen === 'xxx') return <Screen />;
  Order:
    notifications, edit_profile, change_password, sponsors,
    speakers, chat_list, chat_room, connection_requests,
    leaderboard, photos

HomeTab props:
  onOpenNotifications, onOpenSponsors, onOpenSpeakers,
  onOpenChats, onOpenQR, onOpenSchedule, onOpenLeaderboard,
  onOpenPhotos, chatBadge
```

---

## MOBILE ADMIN TAB — AdminTab.js
```
FEATURES array:
  checkin       → CheckInScreen
  notifications → NotificationsAdmin
  add_participant → AddParticipantScreen
  users         → UsersAdmin
  schedule      → ScheduleAdmin
  leaderboard   → LeaderboardScreen (shared)
  photos        → PhotosAdmin
```

---

## AUTH SYSTEM
```
LOGIN:   POST /api/v1/auth/login/     { email, password }
         Returns: { success, tokens: { access, refresh }, user }
         NOTE: NOT /api/v1/auth/token/

REFRESH: POST /api/v1/auth/token/refresh/  { refresh }

ROLES: participant, speaker, super_admin, mgmt_admin, team_head, staff
SCANNER ROLES: super_admin, mgmt_admin, team_head, staff

SESSION AUTH (web panel): @login_required + @admin_required
JWT AUTH (mobile API): Bearer token via apiFetch()
```

---

## TOKEN REFRESH PATTERN
```
1. App.js: refresh on restore (401 → refresh → retry)
2. App.js: useEffect([tokens]) → setApiTokens()
3. MainApp.js + HomeTab.js: tokensRef.current for intervals
4. apiFetch() auto-refreshes on 401

Rules:
  ✓ apiFetch() for ALL authenticated API calls
  ✓ tokensRef.current inside setInterval
  ✗ Never raw fetch() with Bearer in setInterval
```

---

## LEADERBOARD SYSTEM
```
Point Actions:
  SIGNUP: 10 | CHECKIN: 20 | MEAL: 10 | POLL_VOTE: 20
  PHOTO_UPLOAD: 15 | PROFILE_COMPLETION: 50 | FEEDBACK: 25
  NETWORKING: 15 | DAILY_LOGIN: 10

API:
  GET /api/v1/leaderboard/my/   ← rank, points, history, daily login auto
  GET /api/v1/leaderboard/top/  ← top 50 checked-in, ties share rank

Web: /panel/leaderboard/
Mobile: LeaderboardScreen.js (Rankings tab + Activity tab)
```

---

## PHOTO SYSTEM
```
Models: PhotoSettings (singleton pk=1), Photo
Control: upload_open toggle, auto_approve toggle
Access: checked-in participants only

API:
  GET  /api/v1/photos/gallery/         ← approved photos
  POST /api/v1/photos/upload/          ← FormData (image, caption, session_id)
  GET  /api/v1/photos/mine/
  DELETE /api/v1/photos/mine/<pk>/delete/
  Admin: settings/, queue/, review/, delete/, stats/, sessions/

Web: /panel/photos/ (tabs: Pending/Approved/Rejected)
Mobile User: PhotosScreen.js (Wall/Sessions/Mine + upload)
Mobile Admin: PhotosAdmin.js (grid + multiselect + batch + lightbox)
```

---

## SCHEDULE SYSTEM
```
Models: ScheduleSession, ScheduleSubSession, SessionBookmark,
        FeedbackForm, FeedbackQuestion, FeedbackResponse, FeedbackAnswer

Session types: keynote, technical, workshop, break, meal, cultural,
               panel, ceremony, ideathon, special

API:
  GET /api/v1/schedule/sessions/          ← ?day=1|2|3 (public)
  POST /api/v1/schedule/sessions/<id>/bookmark/
  POST /api/v1/schedule/sessions/<id>/feedback/submit/
  Admin: create/, update/, delete/, feedback-toggle/, feedback-analytics/

Web: /panel/schedule/
Mobile: ScheduleTab.js + ScheduleAdmin.js
HomeTab: smartSlice timeline with hero/peek/past cards
```

---

## PUSH NOTIFICATION SYSTEM
```python
# fcm.py functions:
send_to_all(title, body, data, notif, request)
send_to_role(role, title, body, data, notif, request)
send_to_user(user, title, body, data, notif, request)
send_to_tokens(tokens, title, body, data, img)

# Always Expo Push API — never Firebase Admin SDK
```

---

## SPEAKER + SPONSOR DATA (Seeded)
```
Sponsors (13): seeded via seed_sponsors.py
  National Funding: ANRF
  Platinum: Clarivate
  Silver: Vir Softech, DrillBit
  Bronze: IEEE, iGroup, Packt, BSB Edge, World Scientific,
          Cambridge UP, Springer Nature, KGL Accucoms, TLS Group

Speakers (19): seeded via seed_speakers.py
  Images in: media/speakers/
  Keynotes: Jennifer Gibson, Edward Fox, Ponnurangam K, Uma Kanjilal
  All speakers visible in Speakers API and SpokersScreen

⚠️ Speaker model has NO user FK yet — Speaker profiles and
   User accounts are NOT linked. NetworkScreen "Speakers" tab
   shows User accounts (role=speaker), not Speaker model entries.
   Only 1 speaker user exists (speaker@test.com).
```

---

## SEED SCRIPTS (standalone, run from backend/)
```bash
# Sponsors (13)
python3 seed_sponsors.py

# Speakers (19)
python3 seed_speakers.py

# Schedule (32 sessions)
python3 manage.py seed_schedule

# Dummy participants (100)
python3 manage.py seed_dummy_participants

# Create test users
python3 manage.py shell << 'EOF'
from apps.accounts.models import User
accounts = [
    ('etd@admin.iitd.ac.in', 'Admin@1234', 'ETD', 'Admin', 'super_admin'),
    ('participant@test.com', 'Test@1234', 'Test', 'Participant', 'participant'),
    ('speaker@test.com', 'Test@1234', 'Test', 'Speaker', 'speaker'),
]
for email, pwd, fn, ln, role in accounts:
    if not User.objects.filter(email=email).exists():
        u = User.objects.create_user(email=email, password=pwd, first_name=fn, last_name=ln)
        u.role = role
        u.is_active = True
        if role == 'super_admin':
            u.is_staff = True
            u.is_superuser = True
        u.save()
        print(f'✅ {email}')
EOF
```

---

## CRITICAL PATTERNS
```
FormData Upload:
  ✗ Never set Content-Type header with FormData
  ✓ Let browser/RN set multipart/form-data boundary
  ✓ api.js auto-detects FormData and removes Content-Type

Double-Submit Guard:
  const submitRef = useRef(false);
  if (submitRef.current) return;
  submitRef.current = true;

React Hooks in FlatList:
  ✗ Never call hooks inside renderItem callback
  ✓ Extract as named component: function PhotoThumb({...}) {}

Singleton Models:
  ✓ pk=1 enforced in save() method (PhotoSettings, ConferenceSetting)

Tab Preserved on Redirect:
  ✓ redirect(f'/panel/photos/?tab={tab}')
```

---

## TEST CREDENTIALS
```
MOBILE + WEB APP:
  participant@test.com / Test@1234
  speaker@test.com / Test@1234
  Dummy: firstname.lastname@test.com / Test@1234

ADMIN PANEL (http://10.17.9.48:8000/panel/login/):
  etd@admin.iitd.ac.in / Admin@1234
```

---

## WHAT IS WORKING ✅
```
✅ Django API running on IITD VM (10.17.9.48:8000)
✅ Expo web app running on VM (10.17.9.48:8081)
✅ PostgreSQL 16 as database (etdapp)
✅ Redis 7 for caching
✅ All data persists in PostgreSQL (verified)
✅ JWT auth with auto-refresh
✅ Session persistence (localStorage/AsyncStorage)
✅ Admin panel fully accessible on campus network
✅ Push notifications (Expo Push API)
✅ SPONSORS: 13 seeded with logos, full CRUD + API + mobile
✅ SPEAKERS: 19 seeded with photos, full CRUD + API + mobile
✅ SCHEDULE: 32 sessions, 3 days, sub-sessions, bookmarks, feedback
✅ CHAT: requests, conversations, messages
✅ CHECK-IN: QR scan + meal scan + history
✅ LEADERBOARD: 8 actions, ranking, podium, activity feed
✅ PHOTOS: upload/moderation/gallery, admin multi-select
✅ HOME TAB: smart timeline, day chips, progress bar
✅ NETWORK: attendees + speakers tabs, search, connect
✅ PROFILE: edit, change password
✅ NOTIFICATIONS: push + in-app + admin send
✅ Media serving (sponsors/speakers images load correctly)
```

---

## WHAT IS PLACEHOLDER ❌
```
❌ Feed tab — hardcoded posts
❌ Polls screen — backend exists, no mobile screen
❌ Venue map — not built
❌ Speaker ↔ User linking (FK not added yet)
❌ Password reset via email (SMTP not configured)
❌ Live stream button
❌ External access (ngrok blocked by IITD proxy)
❌ Production deployment (Gunicorn + Nginx + HTTPS)
```

---

## IMPORTANT RULES
```
MOBILE:
  ✗ Never downgrade Expo SDK
  ✗ Never add expo-router / React Navigation / TypeScript
  ✗ Never add plugins to app.json without rebuilding APK
  ✗ Never use raw fetch() with Bearer in setInterval
  ✗ Never call hooks inside FlatList renderItem
  ✗ Never set Content-Type header with FormData
  ✓ All screens: .js in src/screens/
  ✓ Styles: COLORS/FONT/SPACE/RADIUS/SHADOW from theme.js
  ✓ Speaker filename: SpokersScreen.js (intentional)
  ✓ apiFetch() for ALL authenticated calls
  ✓ tokensRef.current in intervals
  ✓ submitRef guard on submit buttons

BACKEND:
  ✗ Never Firebase Admin SDK for push
  ✗ Never move CorsMiddleware below SecurityMiddleware
  ✓ Push via Expo Push API only
  ✓ Conference Kit (NOT Goodies)
  ✓ Meal type: 'meal' for all records
  ✓ Login: /api/v1/auth/login/ NOT /api/v1/auth/token/
  ✓ schedule app label = 'schedule' (not 'apps.schedule')
  ✓ Tab preserved on POST redirect
  ✓ Singleton pk=1 in save()
  ✓ Use python3 (not python) on VM

VM SPECIFIC:
  ✓ No Docker — system PostgreSQL + Redis
  ✓ No virtualenv — system-wide pip
  ✓ python3 command only
  ✓ screen sessions for persistence
  ✓ pip install --break-system-packages
  ✓ npm proxy configured for IITD
  ✓ SSL verification disabled for image downloads
  ✓ Media in /home/baadalvm/eventapp/backend/media/
```

---

## QUICK DIAGNOSTIC (VM)
```bash
# Check services
sudo systemctl status postgresql | grep Active
sudo systemctl status redis-server | grep Active

# Check Django DB
cd /home/baadalvm/eventapp/backend
python3 manage.py shell -c "
from django.db import connection
print('DB:', connection.vendor, connection.settings_dict['NAME'])
"

# Check data counts
PGPASSWORD=<pwd> psql -U etdapp_admin -d etdapp -h localhost -c "
SELECT 'users', COUNT(*) FROM users
UNION ALL SELECT 'sessions', COUNT(*) FROM schedule_schedulesession
UNION ALL SELECT 'sponsors', COUNT(*) FROM sponsors_sponsor
UNION ALL SELECT 'speakers', COUNT(*) FROM speakers_speaker;
"

# Check screen sessions
screen -ls

# Check Django is running
curl -s http://10.17.9.48:8000/api/v1/sponsors/ | python3 -m json.tool | head -5
```

---

## GIT
```
Remote: https://github.com/Sharma1907/eventapp
Branch: main
```

---

## WE CODE IN THIS CYCLE
```
diagnose → get code from me if needed → assess → gen code accordingly
→ give to me → if any error → get code / error → assess → repeat

You are a lazy senior developer:
- Best code is code never written
- Reuse what exists before writing new
- Bug fix = root cause, not symptom
- Shortest working diff wins
- No abstractions not explicitly requested
- No boilerplate nobody asked for
- Deletion over addition
```

---

Now here is the **VM Migration Context** file:

---

# VM Migration Context — Codespace → IITD Baadalvm

## WHY THE MIGRATION
```
- GitHub Codespace free tier billing exhausted on account sudhanshu1907
- Cloned repo to new account Sharma1907
- Shifted from Codespace to IITD VM (baadalvm) for 24/7 availability
- VM is dedicated for ETD 2026 conference app
```

## WHAT CHANGED
```
OLD (Codespace):                    NEW (IITD VM):
──────────────────                  ──────────────────
GitHub Codespaces                   IITD VM (baadalvm)
ubuntu (codespace)                  Ubuntu 24.04 LTS
Docker PostgreSQL                   System PostgreSQL 16
Docker Redis                        System Redis 7
Docker MinIO                        Not needed (local media)
Virtual environment (.venv)         System Python (--break-system-packages)
python command                      python3 command
ngrok tunnel                        Direct IP (10.17.9.48) — IITD only
sudhanshu1907/eventapp             Sharma1907/eventapp
db.sqlite3 (default)               PostgreSQL (USE_POSTGRES=True)
Ephemeral (restarts lose state)    Persistent (screen sessions, 24/7)
```

## NETWORK CONSTRAINTS
```
- VM IP: 10.17.9.48 (IITD internal only)
- IITD Proxy: proxy21.iitd.ac.in:3128
  - Blocks: ngrok, cloudflared, all tunnel services
  - SSL inspection: breaks certificate verification
  - apt downloads: mostly fail (Hash Sum mismatch)
  - pip/npm: work with proxy configured
- Phone access: only if phone is on IITD WiFi
- External access: NOT possible without public IP/domain from IITD IT
```

## .env FILE (created manually — NOT in git)
```
Location: /home/baadalvm/eventapp/backend/.env
Key variables:
  SECRET_KEY=<generated>
  DEBUG=True
  ALLOWED_HOSTS=10.17.9.48,127.0.0.1,localhost,...
  USE_POSTGRES=True
  DB_NAME=etdapp
  DB_USER=etdapp_admin
  DB_PASSWORD=<password>
  DB_HOST=localhost
  DB_PORT=5432
  REDIS_URL=redis://127.0.0.1:6379/0
```

## theme.js API_URL
```javascript
// Was (Codespace):
const NGROK = 'https://bauble-aftermost-buffalo.ngrok-free.dev/api/v1';

// Now (VM):
const NGROK = 'http://10.17.9.48:8000/api/v1';
export const API_URL = NGROK;
```

## NODE.JS ON VM
```
Installed via: sudo snap install node --classic --channel=20
PATH fix: export PATH=/snap/node/current/bin:$PATH (in ~/.bashrc)
npm proxy: npm config set proxy/https-proxy http://proxy21.iitd.ac.in:3128
```

## SEED SCRIPTS
```
Standalone scripts (NOT management commands) in backend/:
  seed_sponsors.py   — downloads 13 logos + creates DB records
  seed_speakers.py   — downloads 19 photos + creates DB records
  Both use: ssl.CERT_NONE + IITD proxy to bypass SSL inspection

Management commands:
  python3 manage.py seed_schedule
  python3 manage.py seed_dummy_participants
```

## FULL SETUP FROM SCRATCH (if VM needs to be rebuilt)
```bash
# 1. Install system packages
sudo apt install -y postgresql postgresql-contrib redis-server git curl wget nano

# 2. Start services
sudo systemctl start postgresql redis-server
sudo systemctl enable postgresql redis-server

# 3. Create database
sudo -u postgres psql << 'EOF'
CREATE USER etdapp_admin WITH PASSWORD '<password>';
CREATE DATABASE etdapp OWNER etdapp_admin;
GRANT ALL PRIVILEGES ON DATABASE etdapp TO etdapp_admin;
EOF

# 4. Install Node.js 20
sudo snap install node --classic --channel=20
echo 'export PATH=/snap/node/current/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
npm config set proxy http://proxy21.iitd.ac.in:3128
npm config set https-proxy http://proxy21.iitd.ac.in:3128

# 5. Clone repo
cd /home/baadalvm
git clone https://github.com/Sharma1907/eventapp.git
cd eventapp

# 6. Install Python deps
cd backend
pip install -r requirements.txt --break-system-packages

# 7. Create .env (see above)

# 8. Migrate + seed
python3 manage.py migrate
python3 seed_sponsors.py
python3 seed_speakers.py
python3 manage.py seed_schedule
python3 manage.py seed_dummy_participants
# Create test users (see seed scripts section)

# 9. Install mobile deps
cd /home/baadalvm/eventapp/mobile
npm install

# 10. Start services
screen -S django
python3 manage.py runserver 0.0.0.0:8000
# Ctrl+A, D

screen -S expo
npx expo start --lan --port 8081
# Ctrl+A, D
```
