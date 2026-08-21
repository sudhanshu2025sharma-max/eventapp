

# Complete Project Context (v11 — Post-Discovery + Shake Connect)

---

## PROJECT OVERVIEW
```
Product: Conference Management Platform
Event:   ETD 2026 — "ETDs in the age of AI" — IIT Delhi
Website: https://etd2026.iitd.ac.in/
Type:    Mobile App (React Native Expo) + Web Admin Panel (Django MVT)
GitHub:  Repository: eventapp (github.com/Sharma1907/eventapp)
Dev Env: IITD VM (baadalvm) — Ubuntu 24.04 LTS, 8 cores, 7.7GB RAM, 24/7
Status:  ALL CORE FEATURES COMPLETE + DISCOVERY + SHAKE CONNECT
         Polishing/UX refinement = NEXT
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

  ⚠️ No Docker — PostgreSQL + Redis as system services
  ⚠️ No ngrok — IITD proxy blocks tunnels
  ⚠️ No virtualenv — packages installed system-wide
  ⚠️ No django_redis module — use Django cache API only (no raw Redis scan)
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
│   │   │   ├── models.py        ← Custom User (UUID pk, email login, role,
│   │   │   │                       research_interests TextField comma-separated)
│   │   │   ├── views.py         ← API: login, me, update-profile, change-password,
│   │   │   │                       user_list, user_action, participant_create,
│   │   │   │                       discover_view (NEW — research matching)
│   │   │   ├── serializers.py   ← UserSerializer (exposes research_interests)
│   │   │   ├── admin_views.py   ← Web panel + admin_required decorator
│   │   │   ├── admin_urls.py
│   │   │   └── urls.py          ← includes discover/ endpoint
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
│   │   ├── polls/
│   │   │   ├── models.py        ← Poll, PollOption, Vote, PollAuditLog
│   │   │   │                       + imports from ideathon_models
│   │   │   ├── ideathon_models.py ← IdeathonConfig, IdeathonTeam,
│   │   │   │                        IdeathonMember, IdeathonInvite, AVATAR_CHOICES
│   │   │   ├── views.py         ← poll_list, poll_detail, poll_vote, my_vote,
│   │   │   │                       admin_poll_list, admin_poll_action,
│   │   │   │                       admin_poll_results, _push_poll_live
│   │   │   ├── ideathon_views.py
│   │   │   ├── admin_views.py
│   │   │   ├── ideathon_admin_views.py
│   │   │   ├── admin_urls.py    ← /panel/polls/, /panel/ideathon/
│   │   │   ├── urls.py          ← /api/v1/polls/ + ideathon endpoints
│   │   │   └── migrations/
│   │   ├── posts/
│   │   ├── checkins/
│   │   │   ├── models.py        ← CheckIn, MealPass, MealWindow
│   │   │   ├── views.py         ← + checked_in_participants (search API)
│   │   │   │                       + network_list (attendees/speakers with interests)
│   │   │   ├── admin_views.py
│   │   │   ├── admin_urls.py
│   │   │   └── urls.py          ← includes checked-in/ and network/ endpoints
│   │   ├── chat/
│   │   │   ├── models.py        ← ConnectionRequest, Conversation, Message,
│   │   │   │                       MessageReaction, MessageReport, BlockedUser,
│   │   │   │                       ShakeLog (NEW — event_type: shake|connect)
│   │   │   ├── views.py         ← send_request, respond_request, conversations,
│   │   │   │                       messages, block/unblock, check_connection,
│   │   │   │                       bulk_connection_check, shake_connect (NEW),
│   │   │   │                       disconnect_user (NEW)
│   │   │   ├── admin_views.py   ← chat_panel, chat_thread, chat_requests_panel,
│   │   │   │                       chat_reports_panel, chat_report_action,
│   │   │   │                       chat_analytics, chat_export,
│   │   │   │                       chat_shakes_panel (NEW)
│   │   │   ├── admin_urls.py    ← /panel/chat/, /panel/chat/shakes/ (NEW)
│   │   │   └── urls.py          ← /api/v1/chat/ + shake/ + disconnect/ (NEW)
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
│   │   ├── polls_list.html
│   │   ├── poll_form.html
│   │   ├── poll_results.html
│   │   ├── ideathon.html
│   │   └── chat/               ← chat admin templates subfolder
│   │       ├── list.html
│   │       ├── thread.html
│   │       ├── requests.html
│   │       ├── reports.html
│   │       ├── analytics.html
│   │       └── shakes.html     ← NEW: shake connect log viewer
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
│   ├── package.json             ← expo-haptics, expo-sensors installed
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
│       │                           leaderboard, photos, polls, ideathon,
│       │                           shake_connect (NEW)
│       ├── notifications.js
│       └── screens/
│           ├── HomeTab.js       ← 6-item quick grid, status strip,
│           │                       announcement deck, timeline
│           ├── ScheduleTab.js
│           ├── QRScreen.js
│           ├── FeedScreen.js
│           ├── NetworkScreen.js ← 3 tabs: Attendees | For You | Speakers
│           │                       All 3 always-mounted (display:'none' pattern)
│           │                       Attendees: list cards, expandable, interest chips
│           │                       For You: discovery spotlight, insight card,
│           │                         interactive bubble map (ConferenceCloud),
│           │                         match cards with common interests
│           │                       Speakers: 2-column photo grid (SpeakerGridCard)
│           │                       Header: 🤝 Shake button (opens shake_connect)
│           ├── ProfileTab.js
│           ├── NotificationsScreen.js
│           ├── EditProfileScreen.js
│           ├── ChangePasswordScreen.js
│           ├── SponsorsScreen.js
│           ├── SponsorDetailScreen.js
│           ├── SpokersScreen.js  ← intentional filename
│           ├── SpeakerDetailScreen.js
│           ├── ChatListScreen.js
│           ├── ChatRoomScreen.js ← 3-dot menu with "Remove Connection"
│           │                       Back button → goes to chat_list (not home)
│           │                       disconnect_user API call + confirmation alert
│           ├── ContactCardModal.js
│           ├── TopicPickerModal.js
│           ├── SpeakerRequestModal.js
│           ├── ConnectionRequestsScreen.js
│           ├── LeaderboardScreen.js
│           ├── PhotosScreen.js
│           ├── PollsScreen.js
│           ├── IdeathonScreen.js
│           ├── ShakeConnectScreen.js  ← NEW: full shake-to-connect feature
│           │                           - Glassmorphism dark theme
│           │                           - Pulsing ripple rings
│           │                           - Floating glass orbs
│           │                           - Dual phone sync animation
│           │                           - Swipe-to-shake slider (iPhone unlock style)
│           │                           - Accelerometer shake detection (try/catch for web)
│           │                           - Polling via action:'status' (not re-shake)
│           │                           - Auto-connect if 1 shaker found
│           │                           - Picker if multiple shakers found
│           │                           - Confetti blast on success
│           │                           - Points burst animation (+15pts)
│           │                           - "Met in person" badge
│           │                           - haptics on shake + connect
│           │                           - Manual swipe fallback for web/broken accel
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
  Haptics:       expo-haptics ~15.0.8
  Sensors:       expo-sensors ~15.0.8 (Accelerometer for shake detection)

BACKEND:
  Framework:   Django 4.2.9 + Django REST Framework
  Auth:        JWT via djangorestframework-simplejwt
  User model:  Custom (UUID pk, email as USERNAME_FIELD, role field,
               research_interests TextField)
  Database:    PostgreSQL 16
  Cache:       Redis 7 (via Django cache framework, NOT django_redis module)
  Push:        Expo Push API (NOT Firebase Admin SDK)
  Admin panel: Custom Django MVT (NO Bootstrap, custom CSS in base.html)
  Media:       ImageField uploads via MEDIA_URL/MEDIA_ROOT
```

---

## TEMPLATE SYSTEM — HOW IT WORKS
```
LOCATION:   backend/templates/panel/
SETTINGS:   TEMPLATES[0]['DIRS'] = [BASE_DIR / 'templates']
            → resolves to /home/baadalvm/eventapp/backend/templates/
ALL EXTEND: {% extends "panel/base.html" %}

base.html provides:
  - CSS variables: --primary, --success, --danger, --warning, --bg, --surface
  - Sidebar navigation with active state detection via request.resolver_match.url_name
  - Font Awesome 6.5.1 icons
  - Flash messages
  - Topbar with conference name
  - {% block title %} and {% block content %} for child pages

Template wiring:
  admin_views.py → render(request, 'panel/<template>.html', context)
  admin_urls.py  → path('panel/<route>/', admin_views.<function>, name='<name>')
  base.html sidebar → <a href="/panel/<route>/" class="nav-link {% if '<name>' in ... %}active{% endif %}">

Chat templates use subfolder:
  render(request, 'panel/chat/shakes.html', ...)
  Located at: backend/templates/panel/chat/shakes.html

SIDEBAR LINKS (base.html):
  Dashboard           → /panel/
  Participants        → /panel/participants/
  Check-In Scanner    → /panel/checkins/scanner/
  Events & Schedule   → /panel/schedule/
  Photos              → /panel/photos/
  Posts & Feed        → /panel/feed/
  Polls               → /panel/polls/
  Leaderboard         → /panel/leaderboard/
  Ideathon Teams      → /panel/ideathon/
  Chat & Connections  → /panel/chat/
  Reported Messages   → /panel/chat/reports/
  Shake Connect Logs  → /panel/chat/shakes/   ← NEW
  Notifications       → /panel/notifications/
  Sponsors            → /panel/sponsors/
  Speakers            → /panel/speakers/
  User Management     → /panel/users/manage/
  Settings            → /panel/settings/conference/
```

---

## DATABASE — KEY TABLES
```
users                     ← custom User model (research_interests field)
checkins                  ← CheckIn (conference + meal types)
meal_passes, meal_windows
participant_imports
user_fcm_tokens (notifications_devicetoken)
point_entries, user_points
photos, photo_settings
sponsors_sponsor, speakers_speaker
schedule_schedulesession  ← + sub_sessions, bookmarks, feedback
polls_poll, polls_polloption, polls_vote, polls_pollauditlog
polls_ideathonconfig, polls_ideathonteam, polls_ideathonmember
chat_connectionrequest    ← sender, receiver, status, topic
chat_conversation         ← participant_a, participant_b, request FK
chat_message              ← conversation FK, sender, body, reactions
chat_messagereaction
chat_messagereport
chat_blockeduser
chat_shakelog             ← NEW: user, event_type(shake|connect), partner, created_at

Migrations state:
  polls:  0001_initial, 0002_ideathonteam_ideathonconfig_ideathonmember
  chat:   0001_initial, 0002_..., 0003_shakelog
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
path('panel/', include('apps.polls.admin_urls'))

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

## ACCOUNTS API — /api/v1/auth/
```
POST /api/v1/auth/login/              ← email + password → JWT tokens + user
GET  /api/v1/auth/me/                 ← current user profile
POST /api/v1/auth/update-profile/     ← partial update + profile photo
POST /api/v1/auth/change-password/
POST /api/v1/auth/logout/
POST /api/v1/auth/token/refresh/      ← refresh JWT
GET  /api/v1/auth/users/              ← admin: all users
POST /api/v1/auth/users/<uuid>/action/ ← admin: warn/suspend/unsuspend
POST /api/v1/auth/participants/create/ ← admin: create participant
GET  /api/v1/auth/discover/           ← NEW: research interest matching
```

---

## DISCOVERY API — GET /api/v1/auth/discover/
```
Returns checked-in attendees sorted by research interest overlap.

Response:
{
  has_interests: bool,        ← whether current user has research_interests
  my_interests: ["AI", ...],  ← current user's tags (sorted)
  matches: [                  ← other users with overlapping interests
    {
      id, name, email, role, affiliation, designation,
      profile_photo_url, common_interests: [...],
      all_interests: [...], research_interests: "...",
      match_score: int (number of common tags)
    }
  ],
  match_count: int,
  interest_cloud: [["AI", 25], ["NLP", 18], ...]  ← all interests at conference
}

Logic:
  1. Get current user's tags (comma-separated, case-insensitive)
  2. Query all checked-in non-admin participants
  3. For each: compute intersection of tags
  4. Sort by match_score descending
  5. Also compute interest_cloud (all tags + count across all attendees)
```

---

## CHAT API — /api/v1/chat/
```
POST /api/v1/chat/requests/send/             ← send connection request
GET  /api/v1/chat/requests/inbox/            ← pending received requests
GET  /api/v1/chat/requests/sent/
POST /api/v1/chat/requests/<uuid>/respond/   ← accept/decline/later
POST /api/v1/chat/requests/<uuid>/withdraw/
GET  /api/v1/chat/requests/count/

GET  /api/v1/chat/check/<uuid>/              ← check connection status with user
POST /api/v1/chat/check/bulk/                ← check status with multiple users
GET  /api/v1/chat/connections/count/

GET  /api/v1/chat/conversations/
GET  /api/v1/chat/conversations/<uuid>/
POST /api/v1/chat/conversations/<uuid>/mute/

GET  /api/v1/chat/conversations/<uuid>/messages/
POST /api/v1/chat/conversations/<uuid>/messages/send/
POST /api/v1/chat/conversations/<uuid>/messages/read/
POST /api/v1/chat/conversations/<uuid>/messages/<uuid>/delete/
POST /api/v1/chat/conversations/<uuid>/messages/<uuid>/react/
POST /api/v1/chat/conversations/<uuid>/messages/<uuid>/report/

POST /api/v1/chat/disconnect/      ← NEW: remove connection + delete conversation
POST /api/v1/chat/shake/           ← NEW: shake-to-connect
POST /api/v1/chat/block/
POST /api/v1/chat/unblock/
GET  /api/v1/chat/blocked/
```

---

## SHAKE-TO-CONNECT SYSTEM
```
Backend (apps/chat/views.py — shake_connect):

POST /api/v1/chat/shake/
  action: 'shake'
    - stores timestamp in shared cache dict 'shake:active' (timeout 30s)
    - also stores individual 'shake:<user_id>' key (timeout 6s)
    - logs ShakeLog(event_type='shake')
    - returns nearby simultaneous shakers (within ±4s window)
    - filters out: self, blocked users
    - includes already_connected flag per shaker

  action: 'status'
    - checks 'shake:active' dict for other users who shook near your timestamp
    - does NOT create new shake event or log
    - same filtering logic as 'shake'

  action: 'pick'
    - pick_user_id required
    - if already connected → returns success + conversation_id + connected_with
    - if not → creates ConnectionRequest(status='accepted') + Conversation
    - logs ShakeLog(event_type='connect') for BOTH users
    - sends push notification to partner
    - awards NETWORKING points to both users

Cache strategy (NO django_redis):
  - 'shake:active' = dict {user_id: timestamp} in Django cache
  - pruned on every shake (removes entries >6s old)
  - 'shake:<user_id>' = individual timestamp for status lookups

Disconnect endpoint:
  POST /api/v1/chat/disconnect/
  Body: { user_id: uuid }
  - Deletes Conversation (cascades messages)
  - Deletes accepted ConnectionRequest
  - Returns { success: true, disconnected: true }

Mobile (screens/ShakeConnectScreen.js):
  Phases: idle → waiting → picking → success → error
  
  Idle:
    - Accelerometer listener detects shake (threshold 1.8G)
    - Swipe-to-shake slider (PanResponder) as manual fallback
    - try/catch around Accelerometer for web compatibility
    - Pulsing ripple rings + glass orbs background
    - "How it works" 3-step guide

  Waiting:
    - POST {action:'shake'} sent once on shake detect
    - If initial response has 1 match → auto-connect immediately
    - If >1 matches → show picker immediately
    - If 0 matches → start polling with {action:'status'} every 1.8s
    - Polling deadline: 6.5s from shake
    - Dual phone sync animation

  Picking:
    - Shows list of all nearby shakers
    - Tap to select → calls connectTo(userId)

  Success:
    - Confetti blast (40 particles, physics animation)
    - Points burst animation (+15pts)
    - "Met in person" badge with partner name
    - "Say Hi!" button → opens ChatRoomScreen

  connectTo(pickId):
    - POST {action:'pick', pick_user_id}
    - handles both new connection and already_connected responses
    - haptics + vibration on success

Admin Panel:
  /panel/chat/shakes/ → chat_shakes_panel
  - ShakeLog table: event type, user, partner, timestamp
  - Filters: event type (shake|connect), search (user/partner name/email), date
  - Stats cards: total, shakes count, connections count
```

---

## DISCONNECT / REMOVE CONNECTION
```
Backend: POST /api/v1/chat/disconnect/
  Body: { user_id: uuid }
  - Deletes Conversation (cascades to messages)
  - Deletes accepted ConnectionRequest
  - Returns { success: true, disconnected: true }

Mobile: ChatRoomScreen.js
  - 3-dot menu button (ellipsis-vertical icon) in header
  - Opens bottom sheet modal with:
    - "Remove Connection" (destructive, red icon)
    - "Cancel"
  - Alert.alert confirmation with warning about chat deletion
  - On confirm → POST /api/v1/chat/disconnect/ → navigates to chat_list

ChatRoomScreen props:
  { tokens, user, conversationId, onBack, onDisconnected }
  - onBack → goes to chat_list (not home)
  - onDisconnected → goes to chat_list
```

---

## NETWORK SCREEN — 3-TAB ARCHITECTURE
```
NetworkScreen.js:
  Tabs: ['Attendees', 'For You', 'Speakers']
  Default: Attendees
  Tab switching: instant (all 3 always-mounted, hidden with display:'none')

  Data loading:
    - All 3 tabs preloaded in parallel on mount via Promise.all
    - _memCache = { attendees, speakers, interests, discover }
    - AsyncStorage fallback via getCached/setCache
    - Separate refresh functions for each tab

  Attendees tab:
    - FlatList of PersonCard (expandable with research interests)
    - Interest filter chips (horizontal scroll)
    - Search by name/affiliation/registration ID
    - Connection status badges (connected, requested, etc.)
    - Connect/Message/Accept actions

  For You tab:
    - DiscoverySpotlight: hero card with best match, "Surprise me" shuffle
    - Insight card: match count, "Why these people?" explainer
    - InteractiveBubbleMap (ConferenceCloud):
      - BubbleNode per research topic
      - Bubble size = researcher count
      - Your topics highlighted with star + glow animation
      - Tap bubble → fetches /api/v1/checkins/network/?interest=X
      - Expandable list shows researchers for that topic with connect action
      - Floating physics animation per bubble
    - DiscoveryCard list: match cards with common/other tags
    - NoInterestState: prompt to add research interests if user has none

  Speakers tab:
    - 2-column photo grid (SpeakerGridCard)
    - Large photo with gradient overlay
    - Name + affiliation prominent
    - Mic badge, connection status pill
    - SpeakerRequestModal for discussion requests

  Header:
    - 🤝 Shake button → opens shake_connect subscreen
    - Search icon (Attendees/Speakers only)
    - Chat/requests icon with badge count

  Props: { tokens, user, onOpenChat, pendingCount, onOpenRequests, onEditProfile, onShake }
```

---

## POLLS API — /api/v1/polls/
```
GET  /api/v1/polls/                          ← list (excludes drafts, auto-closes expired)
GET  /api/v1/polls/<uuid>/                   ← detail
POST /api/v1/polls/<uuid>/vote/              ← cast vote
GET  /api/v1/polls/<uuid>/my-vote/
GET  /api/v1/polls/admin/list/               ← admin only
POST /api/v1/polls/admin/<uuid>/action/      ← start|close|reopen
GET  /api/v1/polls/admin/<uuid>/results/

GET  /api/v1/polls/ideathon/
GET  /api/v1/polls/ideathon/check-name/
POST /api/v1/polls/ideathon/create-team/
POST /api/v1/polls/ideathon/leave-team/
POST /api/v1/polls/ideathon/teams/<uuid>/join/
POST /api/v1/polls/ideathon/teams/<uuid>/invite/
POST /api/v1/polls/ideathon/teams/<uuid>/update/
POST /api/v1/polls/ideathon/teams/<uuid>/change-leader/
POST /api/v1/polls/ideathon/invites/<uuid>/respond/
```

---

## NAVIGATION — MainApp.js
```javascript
BASE_TABS = [
  { key: 'home',     icon: 'home' },
  { key: 'schedule', icon: 'calendar' },
  { key: 'feed',     icon: 'newspaper', accent: true },
  { key: 'network',  icon: 'people' },
  { key: 'profile',  icon: 'person' },
]
ADMIN_TAB = { key: 'admin', icon: 'shield-checkmark' }

SubScreen router (via setSubScreen/setSubParams/openSubScreen):
  notifications      → NotificationsScreen
  edit_profile        → EditProfileScreen
  change_password     → ChangePasswordScreen
  sponsors            → SponsorsScreen
  speakers            → SpokersScreen
  chat_list           → ChatListScreen
  chat_room           → ChatRoomScreen (uses subParams.conversationId)
  connection_requests → ConnectionRequestsScreen
  leaderboard         → LeaderboardScreen
  photos              → PhotosScreen
  polls               → PollsScreen
  ideathon            → IdeathonScreen
  shake_connect       → ShakeConnectScreen (NEW)

Key routing patterns:
  openSubScreen(name, params) → sets both subScreen + subParams
  closeSubScreen()            → sets both to null
  openChat(conversationId)    → openSubScreen('chat_room', { conversationId })

ChatRoomScreen back button → setSubScreen('chat_list') (NOT closeSubScreen)
ShakeConnect onConnected   → openSubScreen('chat_room', { conversationId })
```

---

## NOTIFICATION ROUTING — App.js
```javascript
data.type === 'new_message'              → open chat_room
data.type === 'connection_request'       → open connection_requests
data.type === 'session_reminder'         → open schedule tab
data.type === 'feed_post'                → open feed tab
data.type === 'checkin_success'          → open qr tab
data.type === 'meal_verified'            → open qr tab
data.type === 'poll'                     → open polls subScreen
data.type === 'ideathon_invite'          → open ideathon subScreen
data.type === 'ideathon_invite_accepted' → open ideathon subScreen
default                                  → open notifications list
```

---

## HOMETAB LAYOUT
```
Sections top to bottom:
  1. Topbar (brand name + notif bell + avatar)
  2. Hero card (day counter, greeting, progress bar)
  3. Live session banner
  4. Quick Access — 6-item 3×2 gradient card grid:
       Sponsors | Speakers | Photos
       Live Polls | Ideathon | Leaderboard
  5. My Status — compact horizontal strip:
       Rank | Points | Day | Profile
  6. Timeline (smart 3-card window, day chips)
  7. Announcements — swipeable card deck (PanResponder)
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

Shake Connect awards NETWORKING (15 pts) to both users on successful connection.
```

---

## PUSH NOTIFICATION SYSTEM
```python
# fcm.py — always Expo Push API, never Firebase Admin SDK
send_to_all(title, body, data, notif, request)
send_to_role(role, title, body, data, notif, request)
send_to_user(user, title, body, data, notif, request)
send_to_tokens(tokens, title, body, data, img)

# IITD proxy workaround:
proxies = {'http': 'http://proxy21.iitd.ac.in:3128', 'https': ...}
session.verify = False

# Shake Connect push (views.py):
_send_push(other, title, body, data)  ← uses DeviceToken + _send_hybrid
```

---

## AUTH SYSTEM
```
LOGIN:   POST /api/v1/auth/login/     { email, password }
         Returns: { success, tokens: { access, refresh }, user }

REFRESH: POST /api/v1/auth/token/refresh/  { refresh }

ROLES: participant, speaker, super_admin, mgmt_admin, team_head, staff
ADMIN ROLES (web panel): super_admin, mgmt_admin
SCANNER ROLES (QR): super_admin, mgmt_admin, team_head, staff

admin_required decorator: in apps/accounts/admin_views.py
  Checks user.role in ('super_admin', 'mgmt_admin')
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
✅ CHAT: requests, conversations, messages, reactions, reports
✅ CHECK-IN: QR scan + meal scan + history
✅ LEADERBOARD: 8 actions, ranking, podium, activity feed
✅ PHOTOS: upload/moderation/gallery
✅ HOME TAB: redesigned with quick grid, status strip, announcement deck
✅ BOTTOM TAB: home|schedule|feed(accent)|network|profile
✅ NETWORK: 3-tab always-mounted (Attendees|For You|Speakers)
✅ PROFILE: edit, change password
✅ NOTIFICATIONS: push + in-app + admin send
✅ POLLS: full lifecycle, all types, countdown, results
✅ POLLS ADMIN: create/edit/start/close/results/export/voter list
✅ IDEATHON: team formation, invite/accept, leader selection, avatar
✅ IDEATHON ADMIN: /panel/ideathon/ — registration, teams, create voting poll
✅ DISCOVERY (For You): research interest matching, spotlight, bubble map
✅ INTERACTIVE BUBBLE MAP: tap topic → see researchers → connect
✅ SPEAKERS GRID: 2-column photo cards
✅ SHAKE TO CONNECT: accelerometer + swipe fallback + Redis matching
✅ SHAKE SUCCESS: confetti + points burst + "met in person" badge
✅ SHAKE ADMIN: /panel/chat/shakes/ — logs with filters
✅ DISCONNECT: remove connection via 3-dot menu in chat
✅ CHAT BACK NAV: back button → chat_list (not home)
```

---

## WHAT IS NEXT TO BUILD ❌
```
❌ 1. SPEAKER CONNECT — post-session "connect with speaker" banner
❌ 2. CONFERENCE MEMORY — end-of-day personal recap screen
❌ 3. CONFERENCE PULSE — live stats widget on HomeTab
❌ 4. OFFLINE SCHEDULE — cache sessions in AsyncStorage
❌ 5. HAPTIC MOMENTS — wire expo-haptics into more moments
❌ 6. ADMIN MOBILE — polls + ideathon from AdminTab
❌ 7. UX POLISH — animations, transitions, error states
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
  ✓ PanResponder: use refs (not state) inside callbacks
  ✓ try/catch around Accelerometer (web fallback)
  ✓ All 3 NetworkScreen tabs always mounted (display:'none' switching)

BACKEND:
  ✗ Never Firebase Admin SDK for push
  ✗ Never django_redis module (not installed) — use Django cache API only
  ✓ Push via Expo Push API only (fcm.py)
  ✓ Login: /api/v1/auth/login/ NOT /api/v1/auth/token/
  ✓ schedule app label = 'schedule'
  ✓ Singleton models: save() sets self.pk = 1
  ✓ Tab preserved on POST redirect
  ✓ Use python3 (not python) on VM
  ✓ Vote concurrency: unique_together + IntegrityError + F() for points
  ✓ Shake matching: shared cache dict ('shake:active'), NOT Redis key scan

TEMPLATES:
  ✓ All extend "panel/base.html"
  ✓ DIRS = [BASE_DIR / 'templates'] → backend/templates/
  ✓ Chat templates in subfolder: templates/panel/chat/
  ✓ Active sidebar: {% if '<url_name>' in request.resolver_match.url_name %}
```

---

## TEST CREDENTIALS
```
MOBILE + WEB:
  participant@test.com / Test@1234
  speaker@test.com    / Test@1234
  akshita.singh@test.com / Test@1234
  anjali.kumar@test.com / Test@1234
  bhavesh.joshi@test.com / Test@1234
  Dummy: firstname.lastname@test.com / Test@1234 (100 users, 101 checked-in)

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
  8. Give code one file at a time, verify each step.
  9. Never use python regex replace for large JSX — use cat > file.
```

---

## GIT
```
Remote: https://github.com/Sharma1907/eventapp
Branch: main
```




TASK:



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