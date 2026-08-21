# Complete Project Context (v10 — Production Ready, Post-Feature Build)

---

## PROJECT OVERVIEW
```
Product: Conference Management Platform
Event:   ETD 2026 — "ETDs in the age of AI" — IIT Delhi
Website: https://etd2026.iitd.ac.in/
Type:    Mobile App (React Native Expo) + Web Admin Panel (Django MVT)
GitHub:  Repository: eventapp (github.com/Sharma1907/eventapp)
Dev Env: IITD VM (baadalvm) — Ubuntu 24.04 LTS, 8 cores, 7.7GB RAM, 24/7
Status:  CORE COMPLETE + POLLS COMPLETE + IDEATHON COMPLETE
         Discovery/Pulse/Memory/Haptics/Offline = NEXT
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

  Proxy: proxy21.iitd.ac.in:3128
    Blocks: ngrok, cloudflared, tunnels
    SSL inspection breaks cert verification
    pip works with --break-system-packages
    Python downloads need ssl.CERT_NONE

  ⚠️ No Docker — PostgreSQL + Redis as system services
  ⚠️ No ngrok — IITD proxy blocks tunnels
  ⚠️ No virtualenv — packages installed system-wide
```

---

## COMPLETE PROJECT STRUCTURE
```
/home/baadalvm/eventapp/
├── backend/
│   ├── confhub/
│   │   ├── settings.py
│   │   ├── urls.py              ← ALL routes wired here
│   │   ├── asgi.py
│   │   └── wsgi.py
│   ├── apps/
│   │   ├── accounts/
│   │   │   ├── models.py        ← Custom User (UUID pk, email login, role)
│   │   │   ├── views.py         ← API: login, me, update-profile, change-password
│   │   │   ├── serializers.py   ← UserSerializer (exposes research_interests)
│   │   │   ├── admin_views.py   ← Web panel + admin_required decorator
│   │   │   └── admin_urls.py
│   │   ├── notifications/
│   │   │   ├── models.py        ← DeviceToken, Notification, UserNotification
│   │   │   ├── views.py
│   │   │   ├── admin_views.py
│   │   │   ├── admin_urls.py
│   │   │   └── fcm.py           ← Expo Push API: send_to_all, send_to_role,
│   │   │                           send_to_user, send_to_tokens
│   │   ├── sponsors/
│   │   ├── speakers/
│   │   │   ├── models.py        ← Speaker, SpeakerTalk models
│   │   │   └── views.py
│   │   ├── conferences/
│   │   ├── events/
│   │   ├── photos/
│   │   │   ├── models.py        ← PhotoSettings (singleton), Photo
│   │   │   ├── views.py
│   │   │   ├── admin_views.py
│   │   │   └── admin_urls.py
│   │   ├── polls/               ← FULLY BUILT
│   │   │   ├── models.py        ← Poll, PollOption, Vote, PollAuditLog
│   │   │   │                       + imports from ideathon_models
│   │   │   ├── ideathon_models.py ← IdeathonConfig, IdeathonTeam,
│   │   │   │                        IdeathonMember, IdeathonInvite, AVATAR_CHOICES
│   │   │   ├── views.py         ← poll_list, poll_detail, poll_vote, my_vote,
│   │   │   │                       admin_poll_list, admin_poll_action,
│   │   │   │                       admin_poll_results, _push_poll_live
│   │   │   ├── ideathon_views.py ← ideathon_info, check_team_name, create_team,
│   │   │   │                        join_team, invite_member, respond_invite,
│   │   │   │                        change_leader, leave_team, update_team
│   │   │   ├── admin_views.py   ← polls_panel, poll_create, poll_edit,
│   │   │   │                       poll_delete, poll_start, poll_close,
│   │   │   │                       poll_reopen, poll_results, poll_export
│   │   │   ├── ideathon_admin_views.py ← ideathon_panel (admin web)
│   │   │   ├── admin_urls.py    ← /panel/polls/, /panel/ideathon/
│   │   │   ├── urls.py          ← /api/v1/polls/ + ideathon endpoints
│   │   │   └── migrations/
│   │   │       ├── 0001_initial.py
│   │   │       └── 0002_ideathonteam_ideathonconfig_ideathonmember.py
│   │   ├── posts/
│   │   ├── checkins/
│   │   │   ├── models.py        ← CheckIn, MealPass, MealWindow
│   │   │   ├── views.py         ← + checked_in_participants (search API)
│   │   │   ├── admin_views.py
│   │   │   ├── admin_urls.py
│   │   │   └── urls.py          ← includes checked-in/ endpoint
│   │   ├── chat/
│   │   ├── leaderboard/
│   │   │   ├── models.py        ← PointEntry, UserPoints, PointAction, POINT_VALUES
│   │   │   ├── views.py
│   │   │   ├── utils.py         ← award_points(), award_daily_login()
│   │   │   ├── admin_views.py
│   │   │   ├── admin_urls.py
│   │   │   └── urls.py
│   │   └── schedule/
│   │       ├── models.py        ← ScheduleSession, ScheduleSubSession,
│   │       │                       SessionBookmark, FeedbackForm,
│   │       │                       FeedbackQuestion, FeedbackResponse,
│   │       │                       FeedbackAnswer
│   │       ├── views.py
│   │       ├── serializers.py
│   │       ├── admin_views.py
│   │       ├── admin_urls.py
│   │       └── urls.py
│   ├── templates/panel/         ← ALL web admin templates
│   │   ├── base.html            ← master layout, sidebar, CSS variables
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
│   │   ├── polls_list.html      ← NEW: poll management
│   │   ├── poll_form.html       ← NEW: create/edit poll
│   │   ├── poll_results.html    ← NEW: live results + voter list
│   │   └── ideathon.html        ← NEW: ideathon team management
│   ├── media/
│   │   ├── sponsors/            ← 13 sponsor logos
│   │   └── speakers/            ← 19 speaker photos
│   ├── seed_sponsors.py
│   ├── seed_speakers.py
│   ├── requirements.txt
│   ├── .env
│   └── manage.py
├── mobile/
│   ├── App.js                   ← root, session + token refresh
│   │                               notification routing (poll, ideathon,
│   │                               chat_room, connection_requests,
│   │                               schedule, feed, qr, notifications)
│   ├── app.json
│   ├── babel.config.js
│   ├── package.json             ← expo-haptics ~15.0.8 installed
│   ├── eas.json
│   ├── index.js
│   ├── google-services.json
│   └── src/
│       ├── theme.js             ← COLORS, FONT, SPACE, RADIUS, SHADOW,
│       │                           API_URL, API_ROOT, API_HEADERS, fixMediaUrl
│       ├── components.js        ← PulsingDot, GradientAvatar, FadeIn, Badge
│       ├── cache.js
│       ├── api.js               ← apiFetch (auto-refresh JWT, FormData aware)
│       ├── MainApp.js           ← tab router + subScreen router
│       │                           BASE_TABS: home, schedule, feed(accent),
│       │                           network, profile
│       │                           SubScreens: notifications, edit_profile,
│       │                           change_password, sponsors, speakers,
│       │                           chat_list, chat_room, connection_requests,
│       │                           leaderboard, photos, polls, ideathon
│       ├── notifications.js
│       └── screens/
│           ├── HomeTab.js       ← REDESIGNED:
│           │                       - 6-item 3×2 quick action grid (gradient cards)
│           │                       - Compact status strip (rank/points/day/profile)
│           │                       - Swipeable announcement deck (PanResponder)
│           │                       - Smart timeline with hero/peek/past cards
│           │                       - Live session indicator
│           │                       - Day chips
│           ├── ScheduleTab.js
│           ├── QRScreen.js
│           ├── FeedScreen.js    ← in bottom tab bar (accent pill style)
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
│           ├── PollsScreen.js    ← NEW: live polls, voting, results,
│           │                          countdown, ideathon voting,
│           │                          animated vote success modal (confetti)
│           ├── IdeathonScreen.js ← NEW: team formation, invite/accept,
│           │                          avatar picker, leader selection,
│           │                          inline participant search,
│           │                          "Audience Choice Voting" banner
│           └── admin/
│               ├── AdminTab.js
│               ├── NotificationsAdmin.js
│               ├── UsersAdmin.js
│               ├── AddParticipantScreen.js
│               ├── CheckInScreen.js
│               ├── ScheduleAdmin.js
│               └── PhotosAdmin.js
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
  Icons:         @expo/vector-icons (Ionicons)
  Cache:         AsyncStorage via src/cache.js
  Image Pick:    expo-image-picker ~17.0.11
  Haptics:       expo-haptics ~15.0.8 (installed, NOT YET WIRED)

BACKEND:
  Framework:   Django 4.2.9 + Django REST Framework
  Auth:        JWT via djangorestframework-simplejwt
  User model:  Custom (UUID pk, email as USERNAME_FIELD, role field)
  Database:    PostgreSQL 16
  Cache:       Redis 7
  Push:        Expo Push API (NOT Firebase Admin SDK)
  Admin panel: Custom Django MVT (NO Bootstrap, custom CSS in base.html)
  Media:       ImageField uploads via MEDIA_URL/MEDIA_ROOT
```

---

## DATABASE — KEY TABLES
```
users                     ← custom User model
checkins                  ← CheckIn (conference + meal types)
meal_passes, meal_windows
participant_imports
user_fcm_tokens (notifications_devicetoken)
point_entries, user_points
photos, photo_settings
sponsors_sponsor, speakers_speaker
schedule_schedulesession  ← + sub_sessions, bookmarks, feedback
polls_poll                ← NEW
polls_polloption          ← NEW
polls_vote                ← NEW, UNIQUE(poll_id, user_id) at DB level
polls_pollauditlog        ← NEW
polls_ideathonconfig      ← NEW, singleton pk=1
polls_ideathonteam        ← NEW, has avatar field
polls_ideathonmember      ← NEW
polls_ideathonpendingmember ← NEW (invite model = IdeathonInvite)

Migrations state:
  polls: 0001_initial, 0002_ideathonteam_ideathonconfig_ideathonmember
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
path('panel/', include('apps.posts.admin_urls'))
path('panel/', include('apps.polls.admin_urls'))   ← NEW

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

## POLLS API — /api/v1/polls/
```
GET  /api/v1/polls/                          ← list (excludes drafts, auto-closes expired)
GET  /api/v1/polls/<uuid>/                   ← detail
POST /api/v1/polls/<uuid>/vote/              ← cast vote
     Body: { option_ids: [uuid] }
     Ideathon: only team leaders, cannot vote own team
     Concurrency: DB unique_together + IntegrityError catch
     Points: get_or_create on note=f'poll:{pk}' prevents duplicates
             uses F() expression for total update
GET  /api/v1/polls/<uuid>/my-vote/           ← my vote
GET  /api/v1/polls/admin/list/               ← admin only
POST /api/v1/polls/admin/<uuid>/action/      ← start|close|reopen
GET  /api/v1/polls/admin/<uuid>/results/     ← voter list + non-voters

GET  /api/v1/polls/ideathon/                 ← config + teams + pending invites
GET  /api/v1/polls/ideathon/check-name/      ← ?name=xxx → {available: bool}
POST /api/v1/polls/ideathon/create-team/     ← create + become leader
POST /api/v1/polls/ideathon/leave-team/
POST /api/v1/polls/ideathon/teams/<uuid>/join/
POST /api/v1/polls/ideathon/teams/<uuid>/invite/
POST /api/v1/polls/ideathon/teams/<uuid>/update/
POST /api/v1/polls/ideathon/teams/<uuid>/change-leader/
POST /api/v1/polls/ideathon/invites/<uuid>/respond/
```

---

## POLLS ADMIN PANEL — /panel/polls/
```
/panel/polls/                    ← polls_panel (list + stats)
/panel/polls/create/             ← poll_create
/panel/polls/<uuid>/edit/        ← poll_edit
/panel/polls/<uuid>/delete/      ← poll_delete (not live)
/panel/polls/<uuid>/start/       ← poll_start (sends push to all)
/panel/polls/<uuid>/close/       ← poll_close
/panel/polls/<uuid>/reopen/      ← poll_reopen (sends push to all)
/panel/polls/<uuid>/results/     ← poll_results (voter list, non-voters,
                                    participation %, live auto-refresh 10s)
/panel/polls/<uuid>/export/      ← CSV with results + voter list
/panel/ideathon/                 ← ideathon_panel (team management,
                                    toggle registration, create voting poll)
```

---

## POLL MODEL
```python
class Poll:
    Types:   single | multiple | yesno | rating
    Status:  draft → scheduled → live → closed
    ResultVis: live | after | hidden
    Fields:  title, question, description, poll_type, status, result_vis,
             is_ideathon, starts_at, ends_at, max_choices, award_points,
             session (FK to ScheduleSession, optional), created_by

class PollOption:
    Fields: poll, text, order, team_name, team_members,
            project_title, project_desc
    Note: For ideathon polls, team fields auto-filled from IdeathonTeam
          Admin should NOT manually fill team fields — use Ideathon panel

class Vote:
    Fields: poll, option, user, created_at
    Constraint: UNIQUE(poll, user) at DB level
    Indexes: poll_id, user_id, option_id

class IdeathonTeam:
    Fields: id(UUID), name(unique), avatar(emoji choice), project_title,
            project_desc, leader(FK User), created_at
    Avatars: rocket|bulb|fire|star|brain|lightning|diamond|trophy|compass|atom

class IdeathonInvite:
    Status: pending | accepted | declined
    Fields: team, invited_by, invitee, status
    Constraint: UNIQUE(team, invitee)
```

---

## IDEATHON FLOW
```
Admin side:
  1. /panel/ideathon/ → set registration window (dates, team size)
  2. Toggle "Open Registration" → push notification sent to all users
  3. Teams form via app
  4. Close registration
  5. "Create Voting Poll" button → auto-creates draft poll
     with all registered teams as options (team_name, members, project)
  6. Go to /panel/polls/ → Start poll
  7. App users vote → Close poll → Results visible

Participant side (IdeathonScreen.js):
  - Create team: pick avatar, name (real-time uniqueness check),
    project, add members via inline search of checked-in participants,
    choose leader (creator or any invited member)
  - Invite: leader searches checked-in participants → sends invite
    → invitee gets push notification → accept/decline cards at top
  - Vote: only team leaders vote in Ideathon polls
  - Cannot vote for own team (validated server-side)
```

---

## NOTIFICATION ROUTING — App.js
```javascript
// All notification types handled:
data.type === 'new_message'          → open chat_room
data.type === 'connection_request'   → open connection_requests
data.type === 'session_reminder'     → open schedule tab
data.type === 'feed_post'            → open feed tab
data.type === 'checkin_success'      → open qr tab
data.type === 'meal_verified'        → open qr tab
data.type === 'poll'                 → open polls subScreen
data.type === 'ideathon_invite'      → open ideathon subScreen
data.type === 'ideathon_invite_accepted' → open ideathon subScreen
default                              → open notifications list
```

---

## NAVIGATION — MainApp.js
```javascript
BASE_TABS = [
  { key: 'home',     icon: 'home' },
  { key: 'schedule', icon: 'calendar' },
  { key: 'feed',     icon: 'newspaper', accent: true },  ← highlighted pill
  { key: 'network',  icon: 'people' },
  { key: 'profile',  icon: 'person' },
]
ADMIN_TAB = { key: 'admin', icon: 'shield-checkmark' }
// Admins get: home, schedule, feed, network, admin (no profile)

SubScreens (via setSubScreen):
  notifications, edit_profile, change_password, sponsors, speakers,
  chat_list, chat_room, connection_requests, leaderboard, photos,
  polls, ideathon

Feed tab: rendered as accent pill between Schedule and Network
```

---

## HOMETAB LAYOUT (post-redesign)
```
HomeTab.js sections top to bottom:
  1. Topbar (brand name + notif bell + avatar)
  2. Hero card (day counter, greeting, progress bar) — ALL WHITE TEXT
  3. Live session banner (if session currently live)
  4. Quick Access — 6-item 3×2 gradient card grid:
       Sponsors | Speakers | Photos
       Live Polls | Ideathon | Leaderboard
  5. My Status — compact horizontal strip:
       Rank | Points | Day | Profile (single row, no cards)
  6. Timeline (smart 3-card window, day chips, hero/peek/past cards)
  7. Announcements — swipeable card deck (PanResponder):
       Up to 5 notifications as gradient cards
       Swipe left → next, swipe right → prev
       After last card → opens NotificationsScreen
       Dot indicators + deck shadow effect

QUICK array: 6 items with grad:[color1, color2] property
  No Schedule (in tab bar), No Directory, No QR, No Chats, No Network
```

---

## TEMPLATE DIRECTORY WIRING
```
LOCATION:   backend/templates/panel/
SETTINGS:   TEMPLATES[0]['DIRS'] = [BASE_DIR / 'templates']
            → resolves to backend/templates/
ALL EXTEND: {% extends "panel/base.html" %}

base.html provides:
  - CSS variables: --primary, --success, --danger, --warning, --bg, --surface
  - Sidebar navigation with active state detection
  - Font Awesome 6.5.1 icons
  - Flash messages
  - Topbar with conference name

SIDEBAR LINKS (base.html):
  Dashboard           → /panel/
  Participants        → /panel/participants/
  Check-In Scanner    → /panel/checkins/scanner/
  Events & Schedule   → /panel/schedule/
  Photos              → /panel/photos/
  Posts & Feed        → /panel/feed/
  Polls               → /panel/polls/          ← NEW (was dead #)
  Leaderboard         → /panel/leaderboard/
  Ideathon Teams      → /panel/ideathon/        ← NEW (was dead #)
  Chat & Connections  → /panel/chat/
  Reported Messages   → /panel/chat/reports/
  Notifications       → /panel/notifications/
  Sponsors            → /panel/sponsors/
  Speakers            → /panel/speakers/
  User Management     → /panel/users/manage/
  Settings            → /panel/settings/conference/
```

---

## LEADERBOARD SYSTEM
```
PointAction values:
  SIGNUP: 10, CHECKIN: 20, MEAL: 10, POLL_VOTE: 20,
  PHOTO_UPLOAD: 15, PROFILE_COMPLETION: 50,
  FEEDBACK: 25, NETWORKING: 15, DAILY_LOGIN: 10

award_points(user, action, note) — in leaderboard/utils.py
  Creates PointEntry + updates UserPoints total atomically

POLL_VOTE concurrency fix:
  PointEntry.objects.get_or_create(user, action, note=f'poll:{poll_id}')
  UserPoints updated via F('total_points') + pts  ← no race condition

Leaderboard: top 50 checked-in participants, ties share rank
```

---

## PUSH NOTIFICATION SYSTEM
```python
# fcm.py — always Expo Push API, never Firebase Admin SDK
send_to_all(title, body, data, notif, request)    ← creates UserNotification rows
send_to_role(role, title, body, data, notif, request)
send_to_user(user, title, body, data, notif, request)
send_to_tokens(tokens, title, body, data, img)

# IITD proxy workaround in _send_expo():
proxies = {'http': 'http://proxy21.iitd.ac.in:3128', 'https': ...}
session.verify = False  # SSL inspection bypass

# Poll notifications:
_push_poll_live(poll, request) called on start + reopen
  → creates Notification record (for in-app)
  → sends push via send_to_all
  → data: {type: 'poll', poll_id: str(poll.id)}

# Ideathon notifications:
_notify_invite(invitee, team, invited_by)
  → data: {type: 'ideathon_invite', team_id: str(team.id)}
```

---

## AUTH SYSTEM
```
LOGIN:   POST /api/v1/auth/login/     { email, password }
         Returns: { success, tokens: { access, refresh }, user }
         NOTE: /api/v1/auth/login/ NOT /api/v1/auth/token/

REFRESH: POST /api/v1/auth/token/refresh/  { refresh }

ROLES: participant, speaker, super_admin, mgmt_admin, team_head, staff
ADMIN ROLES (web panel): super_admin, mgmt_admin
SCANNER ROLES (QR): super_admin, mgmt_admin, team_head, staff

admin_required decorator: in apps/accounts/admin_views.py
  Checks user.role in ('super_admin', 'mgmt_admin')
  Used on all /panel/ views
```

---

## CHECKINS API — KEY ENDPOINT ADDED
```
GET /api/v1/checkins/checked-in/?search=xxx
  → Returns checked-in participants matching name/email/affiliation
  → Used by IdeathonScreen inline search when forming teams
  → Returns: { users: [{id, name, email, affiliation}], count }
```

---

## WHAT IS WORKING ✅
```
✅ Django API on IITD VM (10.17.9.48:8000)
✅ Expo web app (10.17.9.48:8081)
✅ PostgreSQL 16 + Redis 7
✅ JWT auth with auto-refresh
✅ Session persistence (localStorage/AsyncStorage)
✅ Admin panel at /panel/login/
✅ Push notifications (Expo Push API via IITD proxy)
✅ SPONSORS: 13 seeded with logos
✅ SPEAKERS: 19 seeded with photos
✅ SCHEDULE: 32 sessions, 3 days, sub-sessions, bookmarks, feedback
✅ CHAT: requests, conversations, messages
✅ CHECK-IN: QR scan + meal scan + history
✅ LEADERBOARD: 8 actions, ranking, podium, activity feed
✅ PHOTOS: upload/moderation/gallery
✅ HOME TAB: redesigned with quick grid, status strip, announcement deck
✅ BOTTOM TAB: home|schedule|feed(accent)|network|profile
✅ NETWORK: attendees + speakers, search, connect
✅ PROFILE: edit, change password
✅ NOTIFICATIONS: push + in-app + admin send
✅ POLLS: full lifecycle, all types, countdown, results
✅ POLLS ADMIN: create/edit/start/close/results/export/voter list
✅ IDEATHON: team formation, invite/accept, leader selection, avatar
✅ IDEATHON ADMIN: /panel/ideathon/ — registration, teams, create voting poll
✅ AUDIENCE CHOICE: team leader votes, cannot vote own team
✅ ANIMATED VOTE SUCCESS: confetti, points pop, choice display
✅ SWIPEABLE ANNOUNCEMENTS: deck of cards on HomeTab
```

---

## WHAT IS NEXT TO BUILD ❌
```
❌ 1. DISCOVERY GRAPH — research interest matching between attendees
      research_interests already in User model (comma-separated)
      NetworkScreen already shows tags
      Need: match algorithm + "people like you" section

❌ 2. SPEAKER CONNECT — post-session "connect with speaker" banner
      Schedule sessions already have speaker FK
      Need: trigger after session ends, one-tap connection request

❌ 3. CONFERENCE MEMORY — end-of-day personal recap screen
      All data exists: checkins, bookmarks, points, photos, votes
      Need: one aggregation API + recap screen

❌ 4. CONFERENCE PULSE — live stats widget on HomeTab
      "Right now at ETD 2026: X checked in, Y polls active, Z photos"
      Need: one stats API endpoint + HomeTab widget

❌ 5. OFFLINE SCHEDULE — cache sessions in AsyncStorage
      ScheduleTab already fetches all 3 days
      Need: write to AsyncStorage on fetch, read on load failure

❌ 6. HAPTIC MOMENTS — vibration at key moments
      expo-haptics ~15.0.8 already installed
      Need: wire into check-in success, vote submit, invite accept

❌ 7. ADMIN MOBILE — polls + ideathon management from AdminTab
      AdminTab has 7 feature cubes
      Need: PollsAdmin screen + IdeathonAdmin screen added to FEATURES
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
  ✓ apiFetch() for ALL authenticated calls
  ✓ tokensRef.current in intervals
  ✓ submitRef guard on submit buttons
  ✓ Speaker filename: SpokersScreen.js (intentional)
  ✓ PanResponder: use idxRef.current (not state) inside callbacks
    to avoid stale closure bugs

BACKEND:
  ✗ Never Firebase Admin SDK for push
  ✓ Push via Expo Push API only (fcm.py)
  ✓ Login: /api/v1/auth/login/ NOT /api/v1/auth/token/
  ✓ schedule app label = 'schedule' (not 'apps.schedule')
  ✓ Singleton models: save() sets self.pk = 1
  ✓ Tab preserved on POST redirect
  ✓ Use python3 (not python) on VM
  ✓ poll admin_required via accounts.admin_views.admin_required
  ✓ Vote concurrency: unique_together + IntegrityError + F() for points

TEMPLATES:
  ✓ All extend "panel/base.html"
  ✓ DIRS = [BASE_DIR / 'templates'] → backend/templates/
  ✓ Active sidebar: {% if 'poll' in request.resolver_match.url_name %}
  ✓ Ideathon template at templates/panel/ideathon.html
```

---

## TEST CREDENTIALS
```
MOBILE + WEB:
  participant@test.com / Test@1234
  speaker@test.com    / Test@1234
  Dummy: firstname.lastname@test.com / Test@1234  (100 users)

ADMIN PANEL (http://10.17.9.48:8000/panel/login/):
  etd@admin.iitd.ac.in / Admin@1234
```

---

## STARTUP SEQUENCE
```bash
ssh baadalvm@10.17.9.48

# Django
screen -r django
# If not running:
screen -S django
cd /home/baadalvm/eventapp/backend
python3 manage.py runserver 0.0.0.0:8000

# Expo
screen -r expo
# If not running:
screen -S expo
cd /home/baadalvm/eventapp/mobile
npx expo start --lan --port 8081 --clear
```

---

## DEVELOPMENT CYCLE
```
diagnose → get code → assess → implement minimum correct change
→ give to user → error? → get error + code → assess → repeat

LAZY SENIOR DEV RULES:
  1. Does this already exist? Reuse it.
  2. Shortest working diff wins.
  3. No abstractions not requested.
  4. No new dependencies if avoidable.
  5. Bug fix = root cause, not symptom.
  6. Mark deliberate simplifications with comments.
  7. Non-trivial logic gets one self-check/assert.
```

---

## GIT
```
Remote: https://github.com/Sharma1907/eventapp
Branch: main
```

Task:
Feature - 1
WHAT: "Who else here researches what you research?"
WHY: ETD is a research conference — this is THE killer feature

DATA ALREADY EXISTS:
  User.research_interests = TextField (comma-separated tags)
  UserSerializer already exposes research_interests
  NetworkScreen already parses and displays tags
  /api/v1/checkins/network/ already returns interests array

WHAT NEEDS BUILDING:

BACKEND — new endpoint:
  GET /api/v1/accounts/discover/
  Logic:
    1. Get current user's research_interests tags
    2. Find all checked-in participants whose research_interests
       overlap with at least 1 tag
    3. Return matches sorted by overlap count (most overlap first)
    4. Include: user_id, name, affiliation, profile_photo_url,
       common_interests[], all_interests[], match_score
    5. Also return: interest_cloud (all interests at conference
       with count of people per interest)
  
  File to create: apps/accounts/views.py (add function)
  URL: apps/accounts/urls.py (add path)

MOBILE — new section in NetworkScreen.js OR new DiscoveryScreen.js:
  Option A (recommended): Add "For You" tab to existing NetworkScreen
    - Tab bar: For You | Attendees | Speakers
    - "For You" shows matched researchers
    - Each card shows: name, affiliation, common tags highlighted
    - One-tap "Connect" sends connection request
  
  Option B: Separate screen from HomeTab quick action
  
  No new navigation needed — fits in NetworkScreen tab pattern
  Uses existing apiFetch + existing connection request API

WHAT TO CHECK FIRST:
  cat backend/apps/accounts/urls.py
  cat backend/apps/accounts/views.py (existing user_list_view)
  cat mobile/src/screens/NetworkScreen.js
  Check: does /api/v1/chat/requests/ exist for connection requests?

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