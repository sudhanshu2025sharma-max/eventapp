

# Document 1: ETD 2026 Conference App — Complete System Architecture & Wiring Guide

## 1. INFRASTRUCTURE

### Two-VM Setup
```
┌─────────────────────────────────┐      ┌──────────────────────────────────┐
│  WEB VM: 10.17.5.38            │      │  APP VM: 10.17.9.48             │
│  ─────────────────────         │      │  ─────────────────────          │
│  Apache2 reverse proxy         │──────│  Django/Gunicorn (port 8000)    │
│  WordPress (main site)         │      │  PostgreSQL (port 5432)         │
│  SSL termination at IITD GW   │      │  Redis (port 6379)              │
│                                │      │  Expo Metro Bundler (port 8081) │
└─────────────────────────────────┘      └──────────────────────────────────┘
         │
         ▼
  Public: https://etd2026.iitd.ac.in
  SSL handled by IITD Central Gateway (not Apache)
  IITD Proxy: proxy21.iitd.ac.in:3128
```

### Apache Proxy Config (on 10.17.5.38)
```
/etc/apache2/sites-enabled/*.conf
├── ProxyPreserveHost On
├── ProxyTimeout 120
├── /ws/      → ws://10.17.9.48:8000/ws/      (WebSockets)
├── /api/     → http://10.17.9.48:8000/api/    (REST API)
├── /panel/   → http://10.17.9.48:8000/panel/  (Admin panel)
├── /media/   → http://10.17.9.48:8000/media/  (Uploaded files)
├── /static/panel/ → http://10.17.9.48:8000/static/panel/
├── /hot      → ws://10.17.9.48:8081/hot       (Metro HMR)
├── Expo app requests (detected by User-Agent) → 10.17.9.48:8081
└── Everything else → WordPress DocumentRoot
```

### App VM Process Architecture
```
Gunicorn (master, PID managed by nohup)
├── 8 × Uvicorn workers (ASGI, async)
├── Binds 0.0.0.0:8000
├── --timeout 120, --keep-alive 65
├── --max-requests 5000, --max-requests-jitter 500
└── Config: /home/baadalvm/eventapp/backend/start_server.sh

PostgreSQL
├── systemd service: postgresql
├── Database: etdapp
├── User: etdapp_admin
└── Port: 5432

Redis
├── systemd service: redis-server
├── Used for: Django cache (CACHES default backend)
├── Memory: ~2.25MB typical
└── Port: 6379

Cron Jobs:
├── * * * * * python3 manage.py send_session_reminders
├── @reboot keep_alive.sh
└── * * * * * keep_alive.sh (watchdog, restarts gunicorn if dead)
```

### Key Paths
```
/home/baadalvm/eventapp/
├── backend/                          ← Django project root
│   ├── confhub/                      ← Django settings package
│   │   ├── settings.py               ← Main settings
│   │   ├── urls.py                   ← Root URL conf (handler404/500/403 here)
│   │   ├── asgi.py                   ← ASGI app (used by gunicorn)
│   │   ├── middleware.py             ← DisableCSRFForAPI
│   │   ├── error_middleware.py       ← APIErrorMiddleware (JSON errors for /api/)
│   │   └── rate_limit.py            ← RateLimitMiddleware
│   ├── apps/
│   │   ├── accounts/                 ← Users, auth, RBAC, staff, participants
│   │   ├── schedule/                 ← Sessions, papers, feedback, bookmarks
│   │   ├── chat/                     ← Messaging, connections, shake, calls
│   │   ├── polls/                    ← Live polls
│   │   ├── posts/                    ← Feed/posts
│   │   ├── photos/                   ← Photo gallery + selfie checkpoint
│   │   ├── notifications/           ← FCM push + in-app notifications
│   │   ├── sponsors/                 ← Sponsor management
│   │   ├── speakers/                 ← Speaker profiles
│   │   ├── checkins/                 ← QR check-in + meal scanning
│   │   ├── certificates/            ← Certificate generation
│   │   ├── leaderboard/             ← Gamification points
│   │   ├── error_reports/           ← Error logging middleware
│   │   └── conferences/             ← Conference settings/config
│   ├── templates/
│   │   ├── panel/                    ← Admin panel HTML templates
│   │   │   ├── base.html             ← Master template (sidebar, messages, CSS)
│   │   │   ├── dashboard.html
│   │   │   ├── staff_permissions.html ← Staff management + permissions
│   │   │   ├── users_manage.html
│   │   │   ├── participants.html
│   │   │   ├── schedule.html
│   │   │   ├── notifications.html
│   │   │   ├── chat_panel.html
│   │   │   ├── polls.html
│   │   │   ├── photos.html
│   │   │   ├── selfie_points.html
│   │   │   └── ... (one per module)
│   │   ├── 403.html                  ← Custom forbidden page (module-aware)
│   │   ├── 404.html                  ← Custom not found page
│   │   └── 500.html                  ← Custom server error page
│   ├── static/panel/                 ← CSS, JS, images for admin panel
│   ├── staticfiles/                  ← collectstatic output (WhiteNoise serves)
│   ├── media/                        ← User uploads (photos, certificates, etc.)
│   ├── start_server.sh               ← Gunicorn launch script
│   ├── keep_alive.sh                 ← Cron watchdog
│   ├── server.log                    ← Gunicorn stdout/stderr
│   ├── .env                          ← Environment variables
│   ├── manage.py
│   └── scripts/
│       ├── start_all.sh              ← Start PostgreSQL + Redis + Gunicorn
│       ├── stop_all.sh               ← Stop all services
│       ├── restart_all.sh            ← Stop + Start
│       └── status.sh                 ← Full health dashboard
│
└── mobile/                           ← React Native / Expo app
    ├── src/
    │   ├── screens/
    │   │   ├── ScheduleAdmin.js      ← Admin schedule management
    │   │   ├── MainApp.js            ← Main tab navigator + admin tab
    │   │   └── ... (all screens)
    │   ├── contexts/
    │   │   └── AuthContext.js         ← JWT auth, role/permissions management
    │   └── utils/
    │       └── api.js                 ← API_URL, axios config
    └── app.json                      ← Expo config
```

---

## 2. DJANGO SETTINGS & WIRING

### Key Settings (confhub/settings.py)
```python
# Line 9:  DEBUG loaded from .env
DEBUG = config('DEBUG', default=True, cast=bool)  # Currently: False in .env

# Line 11: Permissive hosts
ALLOWED_HOSTS = ['*']

# Lines 54-67: MIDDLEWARE order matters!
MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',     # ← Serves static files
    'confhub.error_middleware.APIErrorMiddleware',     # ← JSON errors for /api/
    'confhub.rate_limit.RateLimitMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'confhub.middleware.DisableCSRFForAPI',            # ← Exempts /api/ from CSRF
    'apps.error_reports.middleware.ErrorCaptureMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

# TEMPLATES context_processors includes:
'apps.accounts.context_processors.admin_permissions'
# → Injects user_permissions, is_super_admin, is_team_head into ALL templates

# CACHES: Redis
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.redis.RedisCache',
        'LOCATION': REDIS_URL,
    }
}

# STATIC (WhiteNoise)
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

# AUTH
AUTH_USER_MODEL = 'accounts.User'  # Custom user model
```

### .env File
```
DEBUG=False
USE_POSTGRES=True
DB_NAME=etdapp
DB_USER=etdapp_admin
DB_PASSWORD=<redacted>
DB_HOST=localhost
DB_PORT=5432
# Also contains: SECRET_KEY, REDIS_URL, FCM keys, etc.
```

### URL Routing (confhub/urls.py)
```python
# Lines 45-47: Custom error handlers
handler404 = 'confhub.urls.custom_404'
handler500 = 'confhub.urls.custom_500'
handler403 = 'confhub.urls.custom_403'
# NOTE: These only work when DEBUG=False (currently is False)

# Key URL patterns:
/api/v1/accounts/    → apps.accounts.urls
/api/v1/schedule/    → apps.schedule.urls
/api/v1/chat/        → apps.chat.urls
/api/v1/polls/       → apps.polls.urls
/api/v1/posts/       → apps.posts.urls
/api/v1/photos/      → apps.photos.urls
/api/v1/notifications/ → apps.notifications.urls
/api/v1/sponsors/    → apps.sponsors.urls
/api/v1/speakers/    → apps.speakers.urls
/api/v1/checkins/    → apps.checkins.urls
/api/v1/certificates/ → apps.certificates.urls
/api/v1/leaderboard/ → apps.leaderboard.urls
/api/v1/conferences/ → apps.conferences.urls
/panel/              → admin panel views (various apps)
```

### Named URLs That Exist
```
admin_dashboard    → /panel/
admin_login        → /panel/login/
staff_permissions_panel → /panel/staff/permissions/
users_manage       → /panel/users/manage/
# NOTE: 'dashboard' does NOT exist as a URL name (only 'admin_dashboard')
```

---

## 3. DATABASE MODELS

### User Model (apps/accounts/models.py)
```python
class User(AbstractBaseUser, PermissionsMixin):
    # DB table: 'users' (NOT 'accounts_user')
    id                  = UUIDField(primary_key=True, default=uuid4)
    email               = EmailField(unique=True)
    registration_id     = CharField(max_length=50, blank=True, null=True, db_index=True)
    role                = CharField(max_length=20, choices=Role.choices)
    # Roles: super_admin, mgmt_admin, team_head, staff, speaker, participant, sponsor_del, guest, invited_guest
    category            = CharField(...)
    temp_password       = CharField(...)
    first_name, last_name, phone, affiliation, bio, designation, gender
    research_interests, profile_photo, linkedin_url
    show_phone, show_linkedin
    must_change_password, profile_complete, has_seen_guide
    warning_note, warning_acknowledged, warning_acknowledged_at, warning_response
    suspended_reason, is_deletion_pending, deletion_requested_at, deletion_reason, deletion_reason_detail
    is_active, is_staff
    created_at, updated_at

class StaffProfile(models.Model):
    # DB table: 'accounts_staffprofile'
    user       = OneToOneField(User, related_name='staff_profile')
    tier       = CharField(choices: librarian, deputy, assistant, staff, intern)
    designation, department, phone
    photo      = ImageField
    linkedin_url, profile_url, scholar_url
    is_public  = BooleanField  # Show on mobile app directory
    order      = IntegerField  # Display order (drag-and-drop)

class StaffPermission(models.Model):
    # DB table: 'accounts_staffpermission'
    user       = ForeignKey(User)
    module     = CharField(max_length=50, choices=MODULE_CHOICES)
    granted_by = ForeignKey(User, null=True)
    granted_at = DateTimeField(auto_now_add=True)
    # 23 module choices (see RBAC section below)
```

### Registration ID Format
```
Participants: ETD-2026-R-001, ETD-2026-R-002, ...
Speakers:     ETD-2026-SPK01, ETD-2026-SPK02, ...
Staff/OT:     ETD-2026-OT01, ETD-2026-OT02, ... (auto-sequential on create)
```

### Other Key Tables (DB table name → Django table name)
```
users                           ← accounts.User
accounts_staffprofile           ← accounts.StaffProfile
accounts_staffpermission        ← accounts.StaffPermission
user_fcm_tokens                 ← accounts.UserFCMToken
user_reports                    ← accounts.UserReport
participant_imports             ← accounts.ParticipantImport
schedule_schedulesession        ← schedule.ScheduleSession
schedule_schedulesubsession     ← schedule.ScheduleSubSession
schedule_acceptedpaper          ← schedule.AcceptedPaper
schedule_sessionbookmark        ← schedule.SessionBookmark
schedule_feedbackform           ← schedule.FeedbackForm
schedule_feedbackquestion       ← schedule.FeedbackQuestion
schedule_feedbackresponse       ← schedule.FeedbackResponse
schedule_feedbackanswer         ← schedule.FeedbackAnswer
schedule_paperbookmark          ← schedule.PaperBookmark
chat_message                    ← chat.Message
chat_conversation               ← chat.Conversation
chat_connectionrequest          ← chat.ConnectionRequest
chat_blockeduser                ← chat.BlockedUser
chat_messagereaction            ← chat.MessageReaction
chat_messagereport              ← chat.MessageReport
chat_shakelog                   ← chat.ShakeLog
chat_staffgroupmessage          ← chat.StaffGroupMessage
chat_callsession                ← chat.CallSession
```

---

## 4. RBAC SYSTEM (Role-Based Access Control)

### How It Works
```
┌──────────────┐    ┌─────────────────┐    ┌──────────────────┐
│  User.role   │───▶│ StaffPermission │───▶│ module_required() │
│              │    │ user + module   │    │ decorator         │
└──────────────┘    └─────────────────┘    └──────────────────┘

Role hierarchy:
  super_admin  → Bypasses ALL permission checks (has all modules)
  mgmt_admin   → Same as super_admin
  team_head    → Bypasses ALL permission checks (implicit access)
  staff        → Must have StaffPermission rows for each module
  Other roles  → No panel access (login_required blocks them)
```

### 23 Module Keys
```python
MODULE_CHOICES = [
    ('participants', 'Participants'),
    ('ideathon', 'Ideathon Teams'),
    ('meal_scanner', 'Meal Scanner'),
    ('checkin_scanner', 'Check-In Scanner'),
    ('schedule', 'Events & Schedule'),
    ('papers', 'Papers & Posters'),
    ('photos', 'Photos'),
    ('checkpoint', 'Checkpoint'),
    ('feed', 'Posts & Feed'),
    ('polls', 'Polls'),
    ('qa_manager', 'Q&A Manager'),
    ('leaderboard', 'Leaderboard'),
    ('chat', 'Chat'),
    ('reported_messages', 'Reported Messages'),
    ('shake_logs', 'Shake Logs'),
    ('chat_analytics', 'Chat Analytics'),
    ('notifications', 'Notifications'),
    ('sponsors', 'Sponsors'),
    ('speakers', 'Speakers'),
    ('users_manage', 'User Management'),
    ('reports', 'Reports'),
    ('settings', 'Settings'),
    ('error_reports', 'Error & System Logs'),
]
```

### Permissions Helper (apps/accounts/permissions_helper.py)
```python
# Web views — decorator for template-based views:
@module_required('schedule')
def my_view(request):
    # If user lacks 'schedule' permission:
    #   → Renders 403.html with module_name and message (status=403)
    # If user has permission or is super_admin/team_head:
    #   → Proceeds normally

# API views — decorator for DRF views:
@api_module_required('schedule')
def my_api_view(request):
    # If user lacks permission:
    #   → Returns JSON {"error": "...", "required_module": "schedule"}, status=403
    # Checks: super_admin/mgmt_admin/team_head bypass, staff needs StaffPermission row

# Helper function:
user_has_module_access(user, module_key) → bool
```

### Context Processor (apps/accounts/context_processors.py)
```python
def admin_permissions(request):
    # Injected into EVERY template context:
    return {
        'user_permissions': set(['schedule', 'chat', ...]),  # modules user can access
        'is_super_admin': True/False,
        'is_team_head': True/False,
    }
    # Used in base.html sidebar to show/hide navigation links
```

### Which Views Have Which Decorators (ALL 13 admin_views.py files)
```
accounts/admin_views.py:
  Lines 513-851:  @module_required('participants')   ← 10 views
  Lines 937-1513: @module_required('users_manage')   ← 10 views

schedule/admin_views.py:    @module_required('schedule')
chat/admin_views.py:        @login_required + @module_required('chat')
polls/admin_views.py:       @login_required + @module_required('polls')
posts/admin_views.py:       @module_required('feed')
photos/admin_views.py:      @module_required('photos') and @module_required('checkpoint')
notifications/admin_views.py: @module_required('notifications')
sponsors/admin_views.py:    @module_required('sponsors')
speakers/admin_views.py:    @module_required('speakers')
checkins/admin_views.py:    @module_required('checkin_scanner') and @module_required('meal_scanner')
certificates/admin_views.py: @module_required('certificates')
leaderboard/admin_views.py: @module_required('leaderboard')
error_reports/admin_views.py: @module_required('error_reports')
```

### 403.html Template
```html
<!-- Branded dark gradient page -->
<!-- Receives context: module_name, message -->
<!-- Shows: "You don't have access to {module_name}" -->
<!-- Button: "Go to Dashboard" → /panel/ -->
```

### Test Users & Their Permissions (current DB state)
```
prashant.k.prince@gmail.com     | role=staff      | perms=['checkin_scanner','schedule','ideathon','participants','meal_scanner']
pranayphadnis@gmail.com         | role=staff      | perms=['schedule','checkpoint']
ratnad@library.iitd.ac.in       | role=staff      | perms=['participants','meal_scanner','checkin_scanner']
sudhanshu.stu@gmail.com         | role=staff      | perms=[22 modules]
google.reviewer@iitd.ac.in      | role=super_admin| perms=ALL 23 (bypass)
8 team_head users               | role=team_head  | perms=[] (bypass)
Total users: 202
Total staff with reg_id: 39
```

---

## 5. TEMPLATE SYSTEM & WIRING

### Template Discovery
```python
# settings.py TEMPLATES config:
TEMPLATES = [{
    'DIRS': [BASE_DIR / 'templates'],    # ← /home/baadalvm/eventapp/backend/templates/
    'APP_DIRS': True,                     # ← Also searches apps/*/templates/
}]
```

### Base Template (templates/panel/base.html)
```
┌──────────────────────────────────────────────────────┐
│ base.html                                            │
│ ├── <head>: CSS, Font Awesome, Google Fonts          │
│ ├── Sidebar navigation                               │
│ │   └── Links filtered by user_permissions context   │
│ │       (from admin_permissions context processor)   │
│ ├── Messages block (lines 479-486)                   │
│ │   └── Renders Django messages framework            │
│ │       (success=green, error=red, info=blue)        │
│ ├── {% block title %}{% endblock %}                  │
│ ├── <div class="page-content">                       │
│ │   └── {% block content %}{% endblock %}            │
│ └── Footer                                           │
└──────────────────────────────────────────────────────┘
```

### How a Panel Page Works
```
1. User visits /panel/schedule/
2. URL routes to apps/schedule/admin_views.py → schedule_panel()
3. Decorators check: @login_required → @module_required('schedule')
4. If no permission → render 403.html (status=403)
5. If OK → render 'panel/schedule.html' with context data
6. Template extends 'panel/base.html'
7. base.html sidebar uses {{ user_permissions }} to show/hide links
8. Messages from messages.success/error show in messages block
```

### Staff Permissions Page (templates/panel/staff_permissions.html)
```
Features:
├── Grid of staff cards (name, email, tier badge, reg_id, perms tags)
├── Drag-and-drop reorder (SortableJS CDN)
├── Add Staff modal (create with auto ETD-2026-OT## reg_id)
├── Edit Staff modal (editable reg_id, role, tier, photo, URLs)
├── Permissions modal (checkboxes grouped by category)
├── Delete staff (with confirmation)
└── Sends POST to same URL with action=create/edit/delete/permissions/reorder
```

---

## 6. API ARCHITECTURE

### Authentication
```
Mobile app uses JWT (djangorestframework-simplejwt):
  POST /api/v1/accounts/login/     → returns {access, refresh} tokens
  POST /api/v1/accounts/token/refresh/ → refreshes access token
  
All authenticated endpoints expect:
  Header: Authorization: Bearer <access_token>

Token payload includes: user_id (UUID)
```

### Error Handling
```
APIErrorMiddleware (confhub/error_middleware.py):
  - Catches all exceptions on /api/ paths
  - Returns JSON: {"success": false, "error": "message"}
  - Works regardless of DEBUG setting
  - Does NOT interfere with /panel/ paths (those get HTML errors)
```

### Schedule Admin API (apps/schedule/views.py)
```python
# Public endpoint (cached, published only):
GET /api/v1/schedule/sessions/
  → session_list() → filters is_published=True, caches 120s
  → Returns: {sessions: [...], count: N}

# Admin endpoint (all sessions, no cache):
GET /api/v1/schedule/admin/sessions/
  → admin_session_list() → ScheduleSession.objects.all()
  → @api_module_required('schedule')
  → Returns: {sessions: [...], count: N}
  # NOTE: Previously crashed with DRF double-wrapping bug (was calling session_list()
  #   which is also @api_view decorated). Fixed by inlining the query.

# Session serialization: _serialize_session() at line 40
# Returns: id, day, title, session_type, date, start_time, end_time,
#          room, chair, description, display_order, is_featured, is_published,
#          status, is_meal, meal_category, is_parallel, is_bookmarked,
#          sub_sessions[], papers[], feedback_enabled, feedback_open, feedback_auto_open
```

---

## 7. MOBILE APP

### Stack
```
React Native + Expo (managed workflow)
EAS Cloud builds only (never --local, OOM on VM)
No ngrok (IITD blocks)
```

### Key Files
```
mobile/src/screens/MainApp.js
  → Tab navigator: Home, Schedule, Chat, Admin, Profile
  → Admin tab calls refreshUser(tokens) to re-fetch permissions
  → AppState listener refreshes user on foreground

mobile/src/screens/ScheduleAdmin.js
  → Calls GET ${API_URL}/schedule/admin/sessions/
  → Expects response.data.sessions array
  → Date/time pickers, session type chips, feedback analytics
  → Sub-sessions, meal categories, papers management
  → Creates/edits/deletes sessions via POST endpoints

mobile/src/contexts/AuthContext.js
  → JWT token management (access + refresh)
  → Stores user role, permissions
  → refreshUser() re-fetches from /api/v1/accounts/me/
```

---

## 8. PERFORMANCE & PRODUCTION CONFIG

### Current State (After Optimization)
```
DEBUG=False in .env
WhiteNoise serves static files (compressed + cached)
Redis caching for schedule sessions (120s TTL)
8 Gunicorn workers (Uvicorn ASGI)
Response times: 25-80ms (was 5-15s with DEBUG=True)
No 502/503 errors from gunicorn
```

### Operations Scripts
```bash
bash backend/scripts/start_all.sh     # Start PostgreSQL + Redis + Gunicorn + health checks
bash backend/scripts/stop_all.sh      # Graceful shutdown (warns about cron restart)
bash backend/scripts/restart_all.sh   # Stop + Start
bash backend/scripts/status.sh        # Full dashboard: services, HTTP, DB, RAM, errors, cron
```

### Critical Rules
```
✅ Every .py change → restart gunicorn:
   cd /home/baadalvm/eventapp/backend && pkill -9 -f gunicorn || true && sleep 1.5 && nohup ./start_server.sh > server.log 2>&1 &

✅ Template .html change → just refresh browser (no restart needed)

✅ CSS/JS/image change → collectstatic + restart:
   python3 manage.py collectstatic --noinput

✅ .env change → restart gunicorn

✅ NEVER set DEBUG=True during event (2-5x slower + memory leak)

✅ IITD proxy requires: --noproxy '*' on curl commands from this VM

✅ Mobile APK: EAS Cloud only, never --local (OOM)

✅ DB backup before any migration:
   pg_dump -U etdapp_admin etdapp > /home/baadalvm/backup_$(date +%Y%m%d_%H%M).sql
```

---

# Document 2: Complete Change Log — Everything Done Across All Sessions

## Session 1: Initial Setup & Core RBAC

### 1.1 StaffPermission Model
- **Created** `apps/accounts/models.py` → `StaffPermission` model with 23 MODULE_CHOICES
- **Created** `apps/accounts/permissions_helper.py` with:
  - `user_has_module_access(user, module_key)` — checks role bypass + StaffPermission rows
  - `@module_required(module_key)` — web view decorator
  - `@api_module_required(module_key)` — DRF API view decorator
  - `MODULE_TITLES` dict from StaffPermission.MODULE_CHOICES
  - `ALL_MODULE_KEYS` list

### 1.2 Context Processor
- **Created** `apps/accounts/context_processors.py` → `admin_permissions(request)`:
  - Returns `user_permissions`, `is_super_admin`, `is_team_head`
  - Registered in settings.py TEMPLATES context_processors
  - Used by base.html sidebar to show/hide navigation links

### 1.3 Custom Error Pages
- **Created** `templates/403.html` — branded dark gradient, shows `{{ module_name }}` and `{{ message }}`
- **Created** `templates/404.html` — branded "page not found"
- **Created** `templates/500.html` — branded "server error"
- **Added** handler404/500/403 in `confhub/urls.py` lines 45-47

### 1.4 API Error Middleware
- **Created** `confhub/error_middleware.py` → `APIErrorMiddleware`:
  - Intercepts exceptions on `/api/` paths
  - Returns JSON `{"success": false, "error": "message"}` regardless of DEBUG setting
  - Non-API paths pass through to Django's default error handling

---

## Session 2: Decorating All Admin Views (The Big RBAC Rollout)

### Files Modified (13 admin_views.py files):
Every admin view in every app now has `@login_required` + `@module_required('module_key')`:

1. **`apps/accounts/admin_views.py`**:
   - Added `@module_required('participants')` to 10 participant views (lines 513-851)
   - Added `@module_required('users_manage')` to 10 user management views (lines 937-1513)

2. **`apps/schedule/admin_views.py`**:
   - Restored from git (was corrupted by bulk script)
   - Replaced `@admin_required` import with `@login_required`
   - Added `@module_required('schedule')` to all views

3. **`apps/chat/admin_views.py`**:
   - Restored from git
   - Deleted local `admin_required` function (was blocking all staff with raw 403 text)
   - Added `login_required` + `module_required("chat")` imports
   - Replaced all `@admin_required` with `@login_required + @module_required("chat")`

4. **`apps/polls/admin_views.py`**:
   - Restored from git
   - Replaced all `@admin_required` with `@login_required + @module_required("polls")`

5. **`apps/posts/admin_views.py`**: `feed` module key
6. **`apps/photos/admin_views.py`**: `photos` (gallery) + `checkpoint` (selfie points)
7. **`apps/notifications/admin_views.py`**: `notifications` module key
8. **`apps/sponsors/admin_views.py`**: `sponsors` module key
9. **`apps/speakers/admin_views.py`**: `speakers` module key
10. **`apps/checkins/admin_views.py`**: `checkin_scanner` + `meal_scanner` for panel views
11. **`apps/certificates/admin_views.py`**: `certificates` — already had decorators
12. **`apps/leaderboard/admin_views.py`**: `leaderboard` module key
13. **`apps/error_reports/admin_views.py`**: `error_reports` — already had decorators

### Critical Lesson Learned:
- **NEVER use heuristic-based bulk Python scripts** (like `add_import()` that scans for last import line)
- Those scripts found lazy imports inside function bodies and inserted at column 0 → `IndentationError`
- Also inserted inside parenthesized `from .models import (...)` blocks
- Multiple files were corrupted and had to be `git checkout --` restored
- **Always use**: targeted `sed` on specific line numbers, verify with `py_compile` after each

---

## Session 3: Fixing Remaining Bugs

### 3.1 Web RBAC — 403 Redirect Bug
**Problem:** `permissions_helper.py` line 70 had `return redirect('/panel/')` when user lacks permission. This caused 302 redirect instead of 403 status code.

**Fix:** Replaced with:
```python
return render(request, '403.html', {
    'module_name': MODULE_TITLES.get(module_key, module_key),
    'message': 'You do not have access to this module. Please contact the Organising Chair.'
}, status=403)
```

**Verified:** All 6 test cases pass:
```
✅ prashant → /panel/users/manage/    : 403 (has participants, not users_manage)
✅ prashant → /panel/checkins/scanner/ : 200
✅ prashant → /panel/schedule/         : 200
✅ pranay   → /panel/schedule/         : 200
✅ pranay   → /panel/chat/             : 403
✅ pranay   → /panel/selfie-points/    : 200
```

### 3.2 Mobile Schedule Admin — 500 Crash
**Problem:** `admin_session_list()` called `session_list(request)` — both are `@api_view` decorated. DRF tried to double-wrap the request → `AssertionError: request must be HttpRequest, not rest_framework.request.Request`.

**Fix:** Replaced `return session_list(request)` (line 458) with inline query:
```python
def admin_session_list(request):
    qs = ScheduleSession.objects.all().prefetch_related(
        "sub_sessions",
        Prefetch("papers", queryset=AcceptedPaper.objects.all()),
        Prefetch("feedback_forms", queryset=FeedbackForm.objects.filter(is_active=True))
    )
    day = request.GET.get("day")
    if day not in (None, "", "all"):
        try:
            qs = qs.filter(day=int(day))
        except (TypeError, ValueError):
            pass
    sessions = [_serialize_session(s) for s in qs.order_by("date", "start_time", "display_order")]
    return Response({"sessions": sessions, "count": len(sessions)})
```

**Result:** API returns `{sessions: [...], count: 40}` — mobile now shows all sessions.

### 3.3 Staff Registration IDs
**Problem:** Admin wanted to assign/edit registration IDs for staff and auto-generate sequential `ETD-2026-OT##` on create.

**Changes:**
- **View (admin_views.py):** Added `registration_id` handling in both create and edit POST blocks
  - Create: auto-generates `ETD-2026-OT{max+1:02d}` if field left blank
  - Edit: accepts form value and sets `u.registration_id`
- **Template (staff_permissions.html):**
  - Added `fa-id-badge` display on staff cards
  - Added `registration_id` input in modal form
  - Added `regId` param to `openModal()` JS function
  - Wired both add/edit onclick calls

**No migration needed** — `User.registration_id` field already existed.

---

## Session 4: Performance & Production Readiness

### 4.1 DEBUG=False
- Changed `.env` from `DEBUG=True` to `DEBUG=False`
- Eliminates: SQL query memory leak, template re-parsing, extra validation overhead
- Response time dropped from 5-15s to 25-80ms

### 4.2 WhiteNoise Static File Serving
- Installed: `pip3 install --user --break-system-packages whitenoise`
- Added to MIDDLEWARE after SecurityMiddleware (line 57)
- Added `STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'`
- Ran `python3 manage.py collectstatic --noinput` → 764 files processed
- Static files now served with gzip compression + cache headers without tying up gunicorn workers

### 4.3 Operations Scripts
Created `backend/scripts/`:
- `start_all.sh` — starts PostgreSQL, Redis, Gunicorn with health checks
- `stop_all.sh` — graceful shutdown with port verification + cron warning
- `restart_all.sh` — stop + start
- `status.sh` — full dashboard: services, HTTP checks, DB stats, RAM/CPU/disk, errors, cron jobs

---

## ERRORS & DEAD ENDS (Reference — Do NOT Repeat)

1. **Regex-based sidebar gating** — only matched 8 of ~20 links. ABANDONED.
2. **`content.replace(old_block, new_block)` for template edits** — whitespace mismatch. Use line-number-based.
3. **`DEBUG=True` masks custom error handlers** — `handler404/500/403` ignored. Fixed by setting DEBUG=False.
4. **`redirect('dashboard')` → NoReverseMatch** — URL name `'dashboard'` doesn't exist. Use `/panel/`.
5. **`add_import()` heuristic in bulk scripts** — CORRUPTED files. PERMANENTLY ABANDONED.
6. **Bulk `sed '18,26d'` after import insertion** — deleted function bodies. Always verify with `head`/`sed -n` first.
7. **Context processor name mismatch** — settings.py referenced `staff_permissions_context`, actual function is `admin_permissions`. Fixed.
8. **`pip3 install` on externally-managed Python** — need `--user --break-system-packages` flag.

---

## WORKING AGREEMENT FOR FUTURE CHANGES

```
1. DIAGNOSE first → show current file state with head/sed/grep
2. ASK FOR EXISTING CODE → never assume file contents
3. ASSESS → identify exact lines to change
4. MINIMAL FIX → smallest possible edit
5. Use sed surgical commands ONE AT A TIME
6. Verify with py_compile after EACH edit
7. Hardcoded paths over URL names (/panel/ not redirect('dashboard'))
8. No new dependencies unless essential
9. Deletion over addition; boring over clever
10. NEVER use heuristic-based bulk Python scripts for file editing
```