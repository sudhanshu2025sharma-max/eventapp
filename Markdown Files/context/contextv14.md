---

```markdown
# Complete Project Context (v14 — Post-RBAC Feature Complete)

---

## PROJECT OVERVIEW
```
Product: Conference Management Platform
Event:   ETD 2026 — "ETDs in the age of AI" — IIT Delhi
Website: https://etd2026.iitd.ac.in/
Type:    Mobile App (React Native Expo) + Web Admin Panel (Django MVT)
GitHub:  Repository: eventapp (github.com/Sharma1907/eventapp)
Dev Env: IITD VM (baadalvm) — Ubuntu 24.04 LTS, 8 cores, 7.7GB RAM, 24/7
Status:  ALL CORE FEATURES + DISCOVERY + SHAKE CONNECT + HAPTICS +
         OFFLINE SCHEDULE + NETWORK CACHE + RECAP + REDESIGNED QR TICKET +
         BUBBLE POP FX + GEOLOCATION + UNIFIED CHECKPOINT SYSTEM +
         ROLE-BASED ACCESS CONTROL (RBAC) + STAFF DIRECTORY + STAFF GROUP
         CHAT + MOBILE ADMIN CRUD + DYNAMIC WEB SIDEBAR COMPLETE
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
    Media:       http://10.17.9.48:8000/media/
    ⚠️ Only accessible from IITD campus network

  Persistent Sessions:
    screen -S django   → Django server
    screen -S expo     → Expo dev server
    screen -r django   → reattach
    screen -r expo     → reattach

  Proxy:  proxy21.iitd.ac.in:3128
    Blocks:  ngrok, cloudflared, tunnels
    SSL:     inspection breaks cert verification
    pip:     works with --break-system-packages
    npm:     SSL verify FAILS on install
    Workaround for npm:
      NODE_TLS_REJECT_UNAUTHORIZED=0 npm install <pkg> --strict-ssl=false

  ⚠️ No Docker — PostgreSQL + Redis as system services
  ⚠️ No ngrok — IITD proxy blocks tunnels
  ⚠️ No virtualenv — packages installed system-wide
  ⚠️ No django_redis module — use Django cache API only (no raw Redis scan)
  ⚠️ For photo downloads from IITD internal sites:
     Use requests.Session() with trust_env=False and verify=False
     Do NOT use proxy for internal IITD domains (library.iitd.ac.in)

EAS BUILD:
  eas-cli installed locally in mobile/ via:
    NODE_TLS_REJECT_UNAUTHORIZED=0 npm install --save-dev eas-cli --strict-ssl=false
  Login: NODE_TLS_REJECT_UNAUTHORIZED=0 npx eas login
  Build: NODE_TLS_REJECT_UNAUTHORIZED=0 npx eas build --profile development --platform android
  Project ID: afa28d7e-10d5-4e85-bed4-783b7371a56b
  Owner:      coder2026s-team
  ⚠️ Since it's expo-dev-client, JS changes hot-reload — native rebuild only needed when
     new native modules added (like react-native-webview)
```

---

## COMPLETE PROJECT STRUCTURE
```
/home/baadalvm/eventapp/
├── backend/
│   ├── confhub/
│   │   ├── settings.py          ← AUTH_USER_MODEL, context_processors include
│   │   │                          staff_permissions_context
│   │   ├── urls.py              ← ALL routes wired here
│   │   ├── asgi.py
│   │   └── wsgi.py
│   ├── apps/
│   │   ├── accounts/
│   │   │   ├── models.py        ← Custom User (UUID pk, email login, role,
│   │   │   │                       research_interests) + StaffProfile (tier,
│   │   │   │                       designation, department, phone, photo,
│   │   │   │                       linkedin_url, profile_url, scholar_url, order,
│   │   │   │                       is_public) + StaffPermission (21 module keys,
│   │   │   │                       M2M user→module, granted_by, granted_at)
│   │   │   ├── views.py         ← API: login, me, update-profile, change-password,
│   │   │   │                       user_list, user_action, participant_create,
│   │   │   │                       discover_view, my_recap_view, staff_directory_view,
│   │   │   │                       staff_detail_view, admin_staff_permissions_view,
│   │   │   │                       admin_staff_create_view, admin_staff_edit_view,
│   │   │   │                       admin_staff_delete_view
│   │   │   │                       ADMIN_ROLES = ('super_admin', 'mgmt_admin',
│   │   │   │                                      'team_head', 'staff')
│   │   │   ├── serializers.py   ← UserSerializer (permissions[], staff_profile{}),
│   │   │   │                       StaffProfileDetailSerializer, StaffDirectorySerializer,
│   │   │   │                       StaffPermissionMatrixSerializer, LoginSerializer,
│   │   │   │                       ChangePasswordSerializer
│   │   │   ├── permissions_helper.py ← get_user_permissions(), user_has_module_access(),
│   │   │   │                           module_required() decorator (web),
│   │   │   │                           api_module_required() decorator (DRF),
│   │   │   │                           ALL_MODULE_KEYS (21 keys)
│   │   │   ├── context_processors.py ← staff_permissions_context() → provides
│   │   │   │                            user_permissions & is_super_admin to ALL templates
│   │   │   ├── admin_views.py   ← Web panel + admin_required decorator,
│   │   │   │                       admin_login (allows super_admin/mgmt_admin/
│   │   │   │                       team_head/staff), staff_permissions_panel (full
│   │   │   │                       CRUD: create/edit/delete staff + assign permissions)
│   │   │   ├── admin_urls.py    ← staff/permissions/ route
│   │   │   └── urls.py          ← includes staff/, staff/<uuid:pk>/,
│   │   │                          staff/admin/permissions/,
│   │   │                          staff/admin/create/, staff/admin/<pk>/edit/,
│   │   │                          staff/admin/<pk>/delete/
│   │   ├── notifications/
│   │   │   ├── models.py        ← DeviceToken (UUID pk), Notification (UUID pk),
│   │   │   │                       UserNotification, NotificationAttachment
│   │   │   ├── views.py
│   │   │   ├── admin_views.py
│   │   │   ├── admin_urls.py
│   │   │   └── fcm.py           ← Expo Push API: send_to_all, send_to_role,
│   │   │                           send_to_user, send_to_tokens (uses IITD proxy)
│   │   ├── sponsors/
│   │   │   ├── models.py        ← Sponsor with latitude, longitude, stall_number,
│   │   │   │                       stall_photo, contact_person_name, contact_person_role
│   │   │   ├── views.py         ← list_sponsors, sponsor_detail (both API)
│   │   │   ├── serializers.py   ← Exposes lat/lng/stall/contact_person + stall_photo_url
│   │   │   ├── admin_views.py
│   │   │   ├── admin_urls.py
│   │   │   └── urls.py
│   │   ├── speakers/
│   │   ├── conferences/
│   │   ├── events/
│   │   ├── photos/              ← ★ CENTRAL HUB for Photos + Checkpoints
│   │   │   ├── models.py        ← PhotoSettings, Photo, SelfiePoint (unified
│   │   │   │                       checkpoint), SelfieSubmission (approval workflow)
│   │   │   ├── views.py         ← Photos + Checkpoints + Corridor Geofencing +
│   │   │   │                       Mobile Admin CRUD endpoints
│   │   │   ├── admin_views.py   ← photos_panel + selfie_points_panel
│   │   │   ├── admin_urls.py
│   │   │   └── urls.py
│   │   ├── polls/
│   │   ├── posts/
│   │   ├── checkins/
│   │   │   ├── models.py        ← CheckIn, MealPass, MealWindow
│   │   │   ├── views.py         ← checkin_list, checked_in_participants,
│   │   │   │                       network_list, meal_stats
│   │   │   │                       Permission gates updated to include
│   │   │   │                       team_head + staff roles
│   │   │   ├── admin_views.py
│   │   │   ├── admin_urls.py
│   │   │   └── urls.py
│   │   ├── chat/
│   │   │   ├── models.py        ← ConnectionRequest, Conversation, Message,
│   │   │   │                       MessageReaction, MessageReport, BlockedUser,
│   │   │   │                       ShakeLog, StaffGroupMessage (NEW — group chat
│   │   │   │                       for organizers)
│   │   │   ├── views.py         ← + shake_connect, disconnect_user,
│   │   │   │                       staff_group_chat_view (GET list + POST send)
│   │   │   ├── admin_views.py
│   │   │   ├── admin_urls.py
│   │   │   └── urls.py          ← + staff-group/ endpoint
│   │   ├── leaderboard/
│   │   │   ├── models.py        ← PointEntry, UserPoints, PointAction, POINT_VALUES
│   │   │   ├── views.py
│   │   │   ├── utils.py         ← award_points() with points_override param
│   │   │   ├── admin_views.py
│   │   │   ├── admin_urls.py
│   │   │   └── urls.py
│   │   └── schedule/
│   │       ├── models.py        ← ScheduleSession, ScheduleSubSession,
│   │       │                       SessionBookmark, FeedbackForm/Question/Response/Answer
│   │       ├── views.py
│   │       ├── serializers.py
│   │       ├── admin_views.py
│   │       ├── admin_urls.py
│   │       └── urls.py
│   ├── templates/panel/         ← ALL web admin templates
│   │   ├── base.html            ← Master layout with DYNAMIC sidebar — each
│   │   │                          menu item wrapped in {% if is_super_admin or
│   │   │                          "module_key" in user_permissions %} blocks.
│   │   │                          Uses context_processors.staff_permissions_context.
│   │   │                          Categories (Management/Content/Engagement/System)
│   │   │                          hidden entirely when user has zero matching perms.
│   │   │                          Font Awesome 6.5.1, Inter font.
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
│   │   ├── photos.html
│   │   ├── polls_list.html
│   │   ├── poll_form.html
│   │   ├── poll_results.html
│   │   ├── ideathon.html
│   │   ├── selfie_points.html   ← Renders /panel/checkpoint/
│   │   ├── staff_permissions.html ← Staff CRUD + Permissions matrix editor
│   │   │                          with modal forms (Add/Edit/Delete staff +
│   │   │                          Permissions checkbox modal with categories)
│   │   └── chat/
│   │       ├── list.html
│   │       ├── thread.html
│   │       ├── requests.html
│   │       ├── reports.html
│   │       ├── analytics.html
│   │       └── shakes.html
│   ├── media/
│   │   ├── sponsors/
│   │   ├── sponsors/stalls/
│   │   ├── speakers/
│   │   ├── staff/               ← 18 staff photos (downloaded from
│   │   │                          library.iitd.ac.in, cleaned & renamed)
│   │   ├── selfie_points/samples/
│   │   ├── selfie_submissions/
│   │   └── audio/
│   │       └── bubble-pop-up-sfx.mp3
│   ├── seed_sponsors.py
│   ├── seed_speakers.py
│   ├── seed_staff.py            ← Creates 18 User + StaffProfile records
│   │                               (8 team_head, 10 staff), downloads photos
│   │                               from library.iitd.ac.in with SSL bypass
│   ├── requirements.txt
│   ├── .env
│   └── manage.py
├── mobile/
│   ├── App.js
│   ├── app.json
│   ├── babel.config.js
│   ├── package.json
│   ├── eas.json
│   ├── index.js
│   ├── google-services.json
│   └── src/
│       ├── theme.js             ← COLORS, FONT, SPACE, RADIUS, SHADOW,
│       │                           API_URL (10.17.9.48:8000/api/v1), API_ROOT,
│       │                           API_HEADERS, fixMediaUrl, W
│       ├── components.js        ← PulsingDot, GradientAvatar, FadeIn, Badge
│       ├── cache.js             ← 5-min TTL AsyncStorage helper
│       ├── api.js               ← apiFetch (auto-refresh JWT, FormData aware)
│       ├── MainApp.js           ← Tab router + subScreen router.
│       │                           SubScreens: notifications, edit_profile,
│       │                           change_password, sponsors, speakers,
│       │                           chat_list, chat_room, connection_requests,
│       │                           staff_team, staff_group_chat, staff_detail,
│       │                           leaderboard, photos, polls, shake_connect,
│       │                           ideathon, recap, checkpoint/selfie_spots.
│       │                           Back nav: staff_detail→staff_team→home,
│       │                           staff_group_chat→staff_team.
│       │                           getTabs() includes Admin tab for super_admin,
│       │                           mgmt_admin, team_head, staff roles.
│       ├── notifications.js
│       ├── utils/
│       │   └── geo.js           ← getHaversineDistanceMeters, formatDistance,
│       │                          openNativeWalkingDirections
│       └── screens/
│           ├── HomeTab.js       ← Quick Access 4x2 grid:
│           │                       1.Sponsors 2.Speakers 3.Photos 4.Checkpoint
│           │                       5.Live Polls 6.Ideathon 7.Leaderboard
│           │                       8.Events Team (was Schedule, replaced)
│           │                       handleQuickAction routes 'staff_team'
│           │                       → onOpenStaffTeam()
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
│           ├── SpokersScreen.js  ← intentional filename
│           ├── SpeakerDetailScreen.js
│           ├── ChatListScreen.js
│           ├── ChatRoomScreen.js
│           ├── ContactCardModal.js
│           ├── TopicPickerModal.js
│           ├── SpeakerRequestModal.js
│           ├── ConnectionRequestsScreen.js
│           ├── LeaderboardScreen.js
│           ├── PhotosScreen.js
│           ├── PollsScreen.js
│           ├── IdeathonScreen.js
│           ├── ShakeConnectScreen.js
│           ├── RecapScreen.js
│           ├── CheckpointScreen.js
│           ├── StaffScreen.js       ← ★ Events Team directory, 2-column grid,
│           │                          tier badges, 90px avatars, staff-only
│           │                          group chat banner, 10-min AsyncStorage
│           │                          cache, no search/filter bars
│           ├── StaffDetailScreen.js  ← ★ Team profile with large avatar,
│           │                          Call/Email/Chat buttons, Academic Profile
│           │                          link, Google Scholar link, LinkedIn link,
│           │                          1-on-1 chat initiation via connection request
│           ├── StaffGroupChatScreen.js ← ★ Staff-only coordination group chat,
│           │                          real-time polling (4s), sender name/photo/
│           │                          designation, KeyboardAvoidingView with
│           │                          header outside KAV to avoid bottom strip
│           └── admin/
│               ├── AdminTab.js  ← RESTORED original FeatureCube 2x2 grid with
│               │                   gradient hero header, role pill, FadeIn anims.
│               │                   FEATURES filtered by user.permissions[] —
│               │                   staff/team_head only see assigned tiles.
│               │                   Empty state: "No Tasks Assigned Yet".
│               │                   Includes "Manage Staff" cube (users_manage perm).
│               ├── NotificationsAdmin.js
│               ├── UsersAdmin.js
│               ├── AddParticipantScreen.js
│               ├── CheckInScreen.js  ← Stats use apiFetch, parses l.count + t.total
│               ├── ScheduleAdmin.js
│               ├── PhotosAdmin.js
│               ├── PollsAdmin.js
│               ├── IdeathonAdmin.js
│               ├── CheckpointAdminScreen.js
│               └── StaffAdminScreen.js ← ★ Full CRUD for staff from mobile:
│                                          List all, Create (with photo picker,
│                                          tier/role selectors, social links),
│                                          Edit, Delete. Modal form with
│                                          conditional rendering to avoid
│                                          ScrollView/FlatList nesting warning.
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
  API:           src/api.js (apiFetch wrapper)
  Icons:         @expo/vector-icons (Ionicons — NOTE: "award" is INVALID, use "medal")
  Cache:         AsyncStorage via src/cache.js + inline TTL cache in NetworkScreen/
                 ScheduleTab/StaffScreen (10-min TTL)
  Image Pick:    expo-image-picker ~17.0.11
  Camera:        expo-camera ~17.0.10
  Haptics:       expo-haptics ~15.0.8
  Sensors:       expo-sensors ~15.0.8 (Accelerometer)
  Audio:         expo-av ~16.0.8 (bubble pop sfx)
  Location:      expo-location ~19.0.8 (BestForNavigation accuracy)
  WebView:       react-native-webview ^14.0.1

BACKEND:
  Framework:   Django 4.2.9 + Django REST Framework
  Auth:        JWT via djangorestframework-simplejwt
  User model:  Custom (UUID pk, email as USERNAME_FIELD, role field, research_interests)
  Database:    PostgreSQL 16
  Cache:       Redis 7 (via Django cache framework, NOT django_redis module)
  Push:        Expo Push API (NOT Firebase Admin SDK)
  Admin panel: Custom Django MVT
  Media:       ImageField uploads via MEDIA_URL/MEDIA_ROOT
  Maps:        Leaflet 1.9.4 CDN (unpkg.com) with OpenStreetMap tiles
  Context:     staff_permissions_context processor in settings.py TEMPLATES
```

---

## TEMPLATE SYSTEM — HOW IT WORKS
```
LOCATION:   backend/templates/panel/
SETTINGS:   TEMPLATES[0]['DIRS'] = [BASE_DIR / 'templates']
            → resolves to /home/baadalvm/eventapp/backend/templates/
            TEMPLATES[0]['OPTIONS']['context_processors'] includes:
              'apps.accounts.context_processors.staff_permissions_context'
ALL EXTEND: {% extends "panel/base.html" %}

base.html provides:
  - CSS variables: --primary, --success, --danger, --warning, --bg, --surface,
    --border, --text, --text-sec, --bg-sec, --brand, --brand-light
  - DYNAMIC Sidebar with permission-gated menu items:
    Each item wrapped in {% if is_super_admin or "module_key" in user_permissions %}
    Category headings hidden when user has zero matching perms in that category
  - Font Awesome 6.5.1 icons
  - Flash messages
  - Topbar with conference name
  - {% block title %} {% block page_title %} {% block page_subtitle %} {% block content %}

Template wiring:
  admin_views.py → render(request, 'panel/<template>.html', context)
  admin_urls.py  → path('<route>/', admin_views.<function>, name='<name>')
    NOTE: admin_urls.py routes do NOT have 'panel/' prefix because confhub/urls.py
    already includes them under path('panel/', include('apps.X.admin_urls'))
  base.html sidebar → {% if is_super_admin or "perm" in user_permissions %}
    <a href="/panel/<route>/" class="menu-item {% if ... %}active{% endif %}">

SIDEBAR LINKS (base.html) — All permission-gated:
  Main:
    Dashboard           → /panel/                    (always visible)
  Management:
    Participants        → /panel/participants/        (participants)
    Ideathon Teams      → /panel/ideathon/            (ideathon)
    Meal Scanner        → # (placeholder)             (meal_scanner)
    Check-In Scanner    → /panel/checkins/scanner/    (checkin_scanner)
  Content:
    Events & Schedule   → /panel/schedule/            (schedule)
    Photos              → /panel/photos/              (photos)
    Checkpoint          → /panel/checkpoint/          (checkpoint)
    Posts & Feed        → /panel/feed/                (feed)
  Engagement:
    Polls               → /panel/polls/               (polls)
    Q&A Manager         → # (placeholder)             (qa_manager)
    Leaderboard         → /panel/leaderboard/         (leaderboard)
    Chat & Connections  → /panel/chat/                (chat)
    Reported Messages   → /panel/chat/reports/        (reported_messages)
    Shake Connect Logs  → /panel/chat/shakes/         (shake_logs)
    Chat Analytics      → /panel/chat/analytics/      (chat_analytics)
  System:
    Notifications       → /panel/notifications/       (notifications)
    Sponsors            → /panel/sponsors/            (sponsors)
    Speakers            → /panel/speakers/            (speakers)
    Staff Permissions   → /panel/staff/permissions/   (users_manage)
    User Management     → /panel/users/manage/        (users_manage)
    Reports             → # (placeholder)             (reports)
    Settings            → /panel/settings/conference/ (settings)

staff_permissions.html (renders at /panel/staff/permissions/):
  - Full CRUD: Add/Edit/Delete staff members with modal forms
  - Permission assignment: Checkbox matrix modal per staff member
  - Social link fields (LinkedIn, Academic Profile, Google Scholar)
  - Photo upload
  - Auto-trigger: ?edit_perms=UUID opens permissions modal automatically
```

---

## DATABASE — KEY TABLES
```
users                     ← custom User model (research_interests field)
staff_profiles            ← StaffProfile: user(OneToOne), tier, designation,
                            department, phone, photo, linkedin_url, profile_url,
                            scholar_url, order, is_public
staff_permissions         ← StaffPermission: user(FK), module(21 choices),
                            granted_by(FK), granted_at. unique_together=(user,module)
checkins                  ← CheckIn (conference + meal types)
meal_passes, meal_windows
participant_imports
user_fcm_tokens (notifications_devicetoken)
notifications_notification
notifications_usernotification
point_entries, user_points
photos, photo_settings
selfie_points             ← UNIFIED CHECKPOINT MODEL
selfie_submissions        ← APPROVAL WORKFLOW
sponsors_sponsor
speakers_speaker
schedule_schedulesession
polls_poll, polls_polloption, polls_vote, polls_pollauditlog
polls_ideathonconfig, polls_ideathonteam, polls_ideathonmember
chat_connectionrequest, chat_conversation, chat_message
chat_messagereaction, chat_messagereport, chat_blockeduser
chat_shakelog
chat_staffgroupmessage    ← NEW: Staff coordination group chat messages
                            Fields: id(UUID), sender(FK), content(Text), created_at

Migrations state:
  accounts: ..., 0007_staffprofile_staffpermission
  chat:     ..., 0004_staffgroupmessage (or next available number)
```

---

## AUTH SYSTEM & RBAC
```
LOGIN:   POST /api/v1/auth/login/     { email, password }
         Returns: { success, tokens: { access, refresh }, user }
         user object includes: permissions[] array, staff_profile{} object
REFRESH: POST /api/v1/auth/token/refresh/  { refresh }

ROLES:
  participant   — Regular conference attendee
  speaker       — Conference speaker
  super_admin   — Full access to everything (bypasses all permission checks)
  mgmt_admin    — Full access to everything (bypasses all permission checks)
  team_head     — Librarian & Head, Deputy Librarians, Assistant Librarians (8 people)
  staff         — Library information officers & assistants (10 people)

ADMIN_ROLES = ('super_admin', 'mgmt_admin', 'team_head', 'staff')
  Used in _is_admin() helper across accounts/views.py and checkins/views.py

PERMISSION SYSTEM:
  StaffPermission model — 21 assignable module keys:
    MANAGEMENT:   participants, ideathon, meal_scanner, checkin_scanner
    CONTENT:      schedule, photos, checkpoint, feed
    ENGAGEMENT:   polls, qa_manager, leaderboard, chat, reported_messages,
                  shake_logs, chat_analytics
    SYSTEM:       notifications, sponsors, speakers, users_manage, reports, settings

  super_admin & mgmt_admin → get ALL 21 permissions automatically (bypass check)
  team_head & staff → get ONLY specifically assigned permissions via StaffPermission table

  Permission checking:
    Backend (web): module_required('module_key') decorator
    Backend (API): api_module_required('module_key') decorator
    Frontend (mobile): user.permissions[] array filters AdminTab tiles
    Frontend (web): {% if is_super_admin or "key" in user_permissions %} in templates

  Context processor: apps.accounts.context_processors.staff_permissions_context
    Injects user_permissions (list) and is_super_admin (bool) into every template

WEB ADMIN LOGIN:
  admin_login() allows: super_admin, mgmt_admin, team_head, staff
  admin_required decorator: same roles
  Staff with no permissions → sees Dashboard but empty sidebar

MOBILE ADMIN TAB:
  getTabs(role) shows Admin tab for: super_admin, mgmt_admin, team_head, staff
  AdminTab.js filters FEATURES array by user.permissions[]
  Empty state shown when visibleFeatures.length === 0
```

---

## STAFF SYSTEM — SEEDED DATA
```
18 staff members seeded via seed_staff.py:

TIER 1 — LIBRARIAN & HEAD (role: team_head):
  1. Dr. Nabi Hasan — hodlibrary@admin.iitd.ac.in — Librarian@123

TIER 2 — DEPUTY LIBRARIANS (role: team_head):
  2. Dr. Neeraj Kumar Chaurasia — neerajkc@library.iitd.ac.in — Officer@123
  3. Dr. Shankar B. Chavan — shankar.chavan@library.iitd.ac.in — Officer@123

TIER 3 — ASSISTANT LIBRARIANS (role: team_head):
  4. Dr. Vijay Kumar Verma — vkverma@library.iitd.ac.in — Officer@123
  5. Dr. Vanita Khanchandani — vanita@library.iitd.ac.in — Officer@123
  6. Dr. Mohit Garg — gargmohit@library.iitd.ac.in — Officer@123
  7. Dr. Manu T R — manutr@library.iitd.ac.in — Officer@123
  8. Mr. Satbir Chauhan — satbir@library.iitd.ac.in — Officer@123

TIER 4 — STAFF (role: staff):
  9.  Ms. Gunjan Mishra — gunjan0605@library.iitd.ac.in — Staff@123
  10. Mr. Nizam Husain — nizam@library.iitd.ac.in — Staff@123
  11. Mr. Rahul Kumar Napit — napitrahul@iitd.ac.in — Staff@123
  12. Ms. Charu Verma — charu@library.iitd.ac.in — Staff@123
  13. Mrs. Ratna Das — ratnad@library.iitd.ac.in — Staff@123
  14. Mr. B. Kranthi Kumar — bingi92@library.iitd.ac.in — Staff@123
  15. Mr. Vijay Kumar — kvijay@library.iitd.ac.in — Staff@123
  16. Ms. Meemansha Nabiyal — meemansha@library.iitd.ac.in — Staff@123
  17. Mr. Hariom Kumar — a2686@admin.iitd.ac.in — Staff@123
  18. Mr. Govind Singh — a27197@library.iitd.ac.in — Staff@123

Photos: Downloaded from https://library.iitd.ac.in/media/team/photos/
        Stored in backend/media/staff/
        Downloaded using requests with trust_env=False, verify=False
```

---

## URL ROUTING — confhub/urls.py
```python
# Web Admin Panel
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

# Mobile API
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
```

---

## STAFF API ENDPOINTS — /api/v1/auth/staff/*
```
Public Directory:
  GET  /api/v1/auth/staff/                     ← All public staff, ordered by tier
  GET  /api/v1/auth/staff/<uuid:pk>/           ← Single staff detail

Admin CRUD:
  POST /api/v1/auth/staff/admin/create/        ← Create staff (multipart/form-data)
  POST /api/v1/auth/staff/admin/<pk>/edit/     ← Edit staff
  DELETE /api/v1/auth/staff/admin/<pk>/delete/ ← Delete staff (cascades User)

Permissions:
  GET/POST /api/v1/auth/staff/admin/permissions/ ← View matrix / update modules
```

---

## STAFF GROUP CHAT — /api/v1/chat/staff-group/
```
Endpoint: GET + POST /api/v1/chat/staff-group/
Restricted to: super_admin, mgmt_admin, team_head, staff roles

GET response:
  { success: true, messages: [
    { id, content, created_at: "HH:MM AM",
      is_me: bool,
      sender: { id, full_name, role, designation, photo_url }
    }, ...
  ]}

POST body: { content: "message text" }
POST response: { success: true, message: { ...same shape... } }

Model: StaffGroupMessage (in apps/chat/models.py)
  Fields: id(UUID), sender(FK to User), content(Text), created_at
  Ordering: ['created_at']

Mobile: StaffGroupChatScreen.js
  - 4-second polling interval
  - Sender photo + name + designation shown for other people's messages
  - KeyboardAvoidingView with header OUTSIDE to prevent bottom strip
  - Auto-scroll to bottom on new messages
  - Accessible only from StaffScreen banner (staff users only)
```

---

## MOBILE — EVENTS TEAM FLOW
```
HomeTab Quick Access position 8: "Events Team" (people-outline icon, purple gradient)
  → handleQuickAction('staff_team') → onOpenStaffTeam() → subScreen 'staff_team'

StaffScreen.js:
  - 2-column FlatList grid with 90px circular avatars
  - Tier color bar at top of each card (Chair/Deputy/Assistant/Staff)
  - Staff-only group chat banner (visible only for organizer roles)
  - 10-minute AsyncStorage cache with background refresh
  - No search bar, no filter chips (removed per requirement)
  - onOpenStaffDetail(item) → subScreen 'staff_detail'
  - onOpenGroupChat() → subScreen 'staff_group_chat'

StaffDetailScreen.js:
  - Large 110px avatar with tier-colored border
  - Call/Email/Chat action buttons
  - Contact info section
  - Academic & Social profiles (LinkedIn, Google Scholar, Profile URL)
  - Chat button sends connection request or opens existing conversation

StaffGroupChatScreen.js:
  - Staff-only coordination channel
  - Header outside KeyboardAvoidingView (fixes bottom strip)
  - 4-second polling, auto-scroll
  - Sender info (name, designation, photo) on other people's bubbles

Back navigation:
  staff_group_chat → staff_team (via setSubScreen)
  staff_detail → staff_team (via setSubScreen)
  staff_team → home (via closeSubScreen)
  Android hardware back: checks staff_detail/staff_group_chat first,
    routes to staff_team, then closeSubScreen for all others
```

---

## MOBILE — AdminTab.js (ORIGINAL GRID RESTORED)
```
Layout: FeatureCube 2x2 grid with LinearGradient backgrounds
Header: Gradient hero with shield icon, user name, role pill
Animation: FadeIn stagger

ALL_FEATURES (each has .perm key):
  checkin        → CheckInScreen        (checkin_scanner)
  notifications  → NotificationsAdmin   (notifications)
  add_participant→ AddParticipantScreen  (users_manage)
  users          → UsersAdmin           (users_manage)
  staff_admin    → StaffAdminScreen      (users_manage)
  schedule       → ScheduleAdmin        (schedule)
  photos         → PhotosAdmin          (photos)
  polls_admin    → PollsAdmin           (polls)
  ideathon_admin → IdeathonAdmin        (ideathon)

Filtering:
  isSuperAdmin = user.role in ['super_admin', 'mgmt_admin']
  visibleFeatures = ALL_FEATURES.filter(f => isSuperAdmin || userPerms.includes(f.perm))
  Empty state: "No Tasks Assigned. Contact Organising Chair."
```

---

## LEADERBOARD SYSTEM
```
PointAction values:
  SIGNUP:10  CHECKIN:20  MEAL:10  POLL_VOTE:20
  PHOTO_UPLOAD:15  PROFILE_COMPLETION:50
  FEEDBACK:25  NETWORKING:15  DAILY_LOGIN:10

award_points(user, action, note='', points_override=None)
  Uses points_override for custom amounts + negative for revocation
```

---

## PUSH NOTIFICATION SYSTEM
```
fcm.py — always Expo Push API, never Firebase Admin SDK
send_to_all(title, body, data, notif, request=None)
send_to_role(role, title, body, data, notif, request=None)
send_to_user(user, title, body, data, notif, request=None)
send_to_tokens(tokens, title, body, data, img=None)

IITD proxy workaround:
  proxies = {'http': 'http://proxy21.iitd.ac.in:3128', 'https': ...}
  session.verify = False
```

---

## CHECKPOINT SYSTEM
```
UNIFIED MODEL: SelfiePoint with checkpoint_type = 'selfie' | 'sponsor_zone'
GEOFENCE: Haversine (selfie) + 2D flat-earth corridor projection (sponsor_zone)
APPROVAL: Photos require admin approval. Sponsor zones auto-approve.
POINTS: award_points(..., points_override=N) from SelfiePoint.points field
```

---

## HOMETAB QUICK ACCESS GRID
```
8 tiles in a 4x2 grid, 23.5% width each:
  1. Sponsors        (ribbon-outline, brand blue gradient)
  2. Speakers        (mic-outline, purple gradient)
  3. Photos          (camera-outline, green gradient)
  4. Checkpoint      (flag-outline, pink gradient)
  5. Live Polls      (stats-chart-outline, accent orange)
  6. Ideathon        (bulb-outline, sky blue)
  7. Leaderboard     (trophy-outline, rose red)
  8. Events Team     (people-outline, indigo gradient) ← REPLACED Schedule
```

---

## WHAT IS WORKING ✅
```
✅ All core features from v13 context
✅ RBAC: 21 assignable modules, dynamic web sidebar, mobile AdminTab filtering
✅ Staff Directory: 18 seeded members with photos, tiered grid display
✅ Staff Group Chat: Real-time coordination channel for organizers
✅ Staff CRUD: Web panel + Mobile (StaffAdminScreen) — create/edit/delete
✅ Staff Permissions: Web matrix editor + mobile API
✅ Web Admin Login: Accepts super_admin, mgmt_admin, team_head, staff
✅ Dynamic Sidebar: Each item gated by permission, categories auto-hide
✅ Context Processor: user_permissions & is_super_admin in all templates
✅ Mobile Admin Tab: Visible for all organizer roles, filtered by permissions
✅ Empty State: Staff with no assigned tasks see friendly empty screen
✅ Check-In Stats: Fixed Total/Remaining calculation (uses apiFetch)
✅ Social Links: LinkedIn, Profile URL, Scholar URL on StaffProfile
✅ Events Team tile: Position 8 in HomeTab Quick Access grid
✅ Back Navigation: staff_detail→staff_team→home (step-by-step)
✅ Android Hardware Back: Multi-level awareness
```

---

## WHAT IS NEXT / KNOWN PENDING ❌
```
❌ Home Tab "Conference Pulse" live stats widget
❌ Speaker Connect post-session banner
❌ Mobile admin for polls + ideathon from AdminTab (partially done)
❌ Sponsor stall live foot-traffic heatmap
❌ Post-approval celebration modal with confetti
❌ Selfie point approval push notification to individual user
❌ Per-module auto-groups for staff chat (e.g., "Registration Team" chat)
❌ WebRTC calling (deferred — requires coturn + Django Channels)
❌ Force password change on first login for staff
```

---

## CRITICAL PATTERNS (DO NOT BREAK)
```
MOBILE:
  ✗ Never downgrade Expo SDK
  ✗ Never add expo-router / React Navigation / TypeScript
  ✗ Never call hooks inside FlatList renderItem
  ✗ Never set Content-Type header with FormData
  ✗ Never raw fetch() with Bearer in setInterval
  ✗ Never use "award" Ionicon (INVALID) — use "medal" or "trophy"
  ✗ Never place WebView map inside ScrollView — use full-screen Modal
  ✗ Never nest FlatList inside ScrollView same orientation — use conditional
    Modal rendering pattern (showForm && <Modal>...)
  ✓ apiFetch() for ALL authenticated calls (not raw fetch with authHeaders)
  ✓ tokensRef.current in intervals
  ✓ submitRef guard on submit buttons
  ✓ Speaker filename: SpokersScreen.js (intentional)
  ✓ PanResponder: use refs (not state) inside callbacks
  ✓ try/catch around Accelerometer (web fallback)
  ✓ All 3 NetworkScreen tabs always mounted (display:'none' for now)
  ✓ For hot code: useCallback on FlatList renderItem
  ✓ Do NOT trigger fetches on tab switch when data already loaded
  ✓ For scrollable checklists inside forms: nestedScrollEnabled={true}
  ✓ apiFetch returns raw Response object — always call await res.json()
  ✓ KeyboardAvoidingView: place header OUTSIDE to avoid bottom strip

BACKEND:
  ✗ Never Firebase Admin SDK for push
  ✗ Never django_redis module — Django cache API only
  ✗ Never pass delivered_at to Notification.objects.create()
  ✓ Push via Expo Push API only (fcm.py)
  ✓ Notification.objects.create() FIRST, then send_to_all(..., notif)
  ✓ Login: /api/v1/auth/login/ NOT /api/v1/auth/token/
  ✓ schedule app label = 'schedule'
  ✓ Singleton models: save() sets self.pk = 1
  ✓ Tab preserved on POST redirect
  ✓ Use python3 (not python) on VM
  ✓ ADMIN_ROLES includes team_head and staff
  ✓ admin_login allows team_head and staff roles
  ✓ _is_admin() checks all 4 organizer roles
  ✓ admin_urls.py routes do NOT include 'panel/' prefix (parent includes does)

TEMPLATES:
  ✓ All extend "panel/base.html"
  ✓ DIRS = [BASE_DIR / 'templates'] → backend/templates/
  ✓ Chat templates in subfolder: templates/panel/chat/
  ✓ Active sidebar: {% if '<url_name>' in request.resolver_match.url_name %}
  ✓ All sidebar items wrapped in {% if is_super_admin or "perm" in user_permissions %}
  ✓ Category labels wrapped — hide entire section when user has zero matching perms
  ✓ staff_permissions_context processor registered in settings.py

IITD PROXY:
  ✗ Never rely on ngrok / cloudflared / tunnels
  ✗ Never expect npm install to work without SSL bypass
  ✗ Never use proxy for internal IITD domains (library.iitd.ac.in)
  ✓ npm workaround: NODE_TLS_REJECT_UNAUTHORIZED=0 <cmd> --strict-ssl=false
  ✓ pip workaround: --break-system-packages
  ✓ For internal IITD photo downloads: trust_env=False, verify=False, no proxies
  ✓ Expo Push works via proxy with verify=False in requests

DEVELOPMENT CYCLE:
  diagnose → get code → assess → implement minimum correct change → verify
  1. Does this already exist? Reuse it.
  2. Shortest working diff wins.
  3. No abstractions not requested.
  4. No new dependencies if avoidable.
  5. Bug fix = root cause, not symptom.
  6. All code delivered via cat << 'EOF' > <path> commands.
  7. Never use python regex replace for large JSX — use cat > file.
  8. For IITD VM: prefer CDN + system packages over npm/pip when possible.
```

---

## TEST CREDENTIALS
```
MOBILE + WEB:
  participant@test.com / Test@1234
  speaker@test.com    / Test@1234
  test@test.com / 12345678 (staff role, assigned checkin_scanner)
  Dummy: firstname.lastname@test.com / Test@1234 (100 users, 101 checked-in)

STAFF (seeded):
  hodlibrary@admin.iitd.ac.in / Librarian@123  (team_head, tier=librarian)
  neerajkc@library.iitd.ac.in / Officer@123     (team_head, tier=deputy)
  gunjan0605@library.iitd.ac.in / Staff@123     (staff, tier=staff)
  (see full list in STAFF SYSTEM section)

ADMIN PANEL (http://10.17.9.48:8000/panel/login/):
  etd@admin.iitd.ac.in (super_admin)
  Any staff/team_head email with their password
```

---

## COORDINATES REFERENCE (IIT DELHI)
```
Campus centre approx:  28.5456, 77.1923
Dogra Hall:            28.5455, 77.1930
Central Library:       28.5449, 77.1926
Zoom level: 17-18 for stall pinning
GPS accuracy outdoors: 3-10 m
Default geofence radius: 20 m (selfies), 30 m corridor width (sponsor zones)
```

---

## GIT
```
Remote: https://github.com/Sharma1907/eventapp
Branch: main
```

---

## FILE DEPENDENCY WIRE MAP
```
mobile/src/MainApp.js
  ├─ imports StaffScreen, StaffDetailScreen, StaffGroupChatScreen
  ├─ subScreen routes: staff_team, staff_detail, staff_group_chat
  ├─ passes onOpenStaffTeam to HomeTab
  ├─ passes user prop to StaffScreen (for group chat visibility)
  ├─ selectedStaff state for staff_detail
  ├─ Back nav: staff_detail/staff_group_chat → staff_team → home
  └─ Android BackHandler: multi-level awareness

mobile/src/screens/HomeTab.js
  ├─ Quick Access item 8: Events Team → action 'staff_team'
  ├─ handleQuickAction routes 'staff_team' → onOpenStaffTeam()
  └─ receives onOpenStaffTeam prop from MainApp

mobile/src/screens/StaffScreen.js
  ├─ fetches /auth/staff/ with apiFetch, 10-min cache
  ├─ 2-column FlatList grid, tier bars, 90px avatars
  ├─ onOpenStaffDetail(item) → parent sets subScreen
  ├─ onOpenGroupChat() → parent sets subScreen
  └─ Staff-only group chat banner gated by user.role check

mobile/src/screens/StaffDetailScreen.js
  ├─ Large avatar, Call/Email/Chat buttons
  ├─ Social links (LinkedIn, Scholar, Profile)
  └─ Chat: sends connection request via /chat/requests/send/

mobile/src/screens/StaffGroupChatScreen.js
  ├─ fetches/posts to /chat/staff-group/
  ├─ 4-second polling interval
  ├─ Header outside KeyboardAvoidingView
  └─ Sender photo + name + designation

mobile/src/screens/admin/AdminTab.js
  ├─ Original FeatureCube grid layout restored
  ├─ ALL_FEATURES with .perm keys
  ├─ Filters by user.permissions[]
  ├─ Empty state for no permissions
  └─ Includes StaffAdminScreen (users_manage perm)

mobile/src/screens/admin/StaffAdminScreen.js
  ├─ Full CRUD: List, Create, Edit, Delete
  ├─ Modal form with conditional rendering ({showForm && <Modal>...})
  ├─ Photo picker, tier/role selectors, social link inputs
  └─ APIs: /auth/staff/admin/create/, edit/, delete/

backend/apps/accounts/models.py
  └─ User + StaffProfile + StaffPermission

backend/apps/accounts/permissions_helper.py
  └─ get_user_permissions(), user_has_module_access(),
     module_required(), api_module_required(), ALL_MODULE_KEYS

backend/apps/accounts/context_processors.py
  └─ staff_permissions_context() → user_permissions + is_super_admin

backend/apps/accounts/serializers.py
  └─ UserSerializer (permissions[], staff_profile{}),
     StaffDirectorySerializer, StaffProfileDetailSerializer

backend/apps/accounts/views.py
  └─ ADMIN_ROLES includes team_head+staff, _is_admin(),
     staff_directory_view, staff_detail_view,
     admin_staff_permissions_view, admin_staff_create/edit/delete

backend/apps/accounts/admin_views.py
  └─ admin_login (4 roles), staff_permissions_panel (CRUD + perms)

backend/apps/chat/models.py
  └─ StaffGroupMessage (sender, content, created_at)

backend/apps/chat/views.py
  └─ staff_group_chat_view (GET/POST, role-gated)

backend/apps/chat/urls.py
  └─ path('staff-group/', staff_group_chat_view)

backend/templates/panel/base.html
  └─ Dynamic sidebar with 21 permission gates per menu item

backend/templates/panel/staff_permissions.html
  └─ Staff CRUD + Permission matrix modal
```
```

---

