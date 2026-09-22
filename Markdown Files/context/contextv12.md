# Complete Project Context (v13 — Post-Checkpoint Feature Complete)

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
         BUBBLE POP FX + GEOLOCATION + UNIFIED CHECKPOINT SYSTEM COMPLETE
         (Selfie Spots + Sponsor Stall Corridors + Mobile Admin Management)
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
│   │   │   │                       discover_view, my_recap_view (day-based recap)
│   │   │   ├── serializers.py
│   │   │   ├── admin_views.py   ← Web panel + admin_required decorator
│   │   │   ├── admin_urls.py
│   │   │   └── urls.py          ← includes discover/, my-recap/
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
│   │   │   ├── admin_views.py   ← sponsors_panel, sponsor_create, sponsor_edit, sponsor_delete
│   │   │   ├── admin_urls.py
│   │   │   └── urls.py
│   │   ├── speakers/
│   │   ├── conferences/
│   │   ├── events/
│   │   ├── photos/              ← ★ CENTRAL HUB for Photos + Checkpoints
│   │   │   ├── models.py        ← PhotoSettings (singleton), Photo, SelfiePoint (unified
│   │   │   │                       Checkpoint model), SelfieSubmission (with status +
│   │   │   │                       points_awarded + reviewed_by workflow)
│   │   │   ├── views.py         ← Photos + Checkpoints + Corridor Geofencing +
│   │   │   │                       Mobile Admin CRUD endpoints
│   │   │   ├── admin_views.py   ← photos_panel + selfie_points_panel (renders
│   │   │   │                       /panel/checkpoint/) with sponsor M2M linking
│   │   │   ├── admin_urls.py    ← /panel/photos/ + /panel/checkpoint/ (+ old alias
│   │   │   │                       /panel/selfie-points/)
│   │   │   └── urls.py          ← API + Admin API + Aliases (/checkpoints/,
│   │   │                          /checkpoint-visit/, admin/checkpoints/,
│   │   │                          admin/sponsors-flat/)
│   │   ├── polls/
│   │   │   ├── models.py        ← Poll, PollOption, Vote, PollAuditLog + ideathon
│   │   │   ├── ideathon_models.py
│   │   │   ├── views.py
│   │   │   ├── ideathon_views.py
│   │   │   ├── admin_views.py
│   │   │   ├── ideathon_admin_views.py
│   │   │   ├── admin_urls.py
│   │   │   ├── urls.py
│   │   │   └── migrations/
│   │   ├── posts/
│   │   ├── checkins/
│   │   │   ├── models.py        ← CheckIn, MealPass, MealWindow
│   │   │   ├── views.py         ← + checked_in_participants, network_list
│   │   │   ├── admin_views.py
│   │   │   ├── admin_urls.py
│   │   │   └── urls.py
│   │   ├── chat/
│   │   │   ├── models.py        ← ConnectionRequest, Conversation, Message,
│   │   │   │                       MessageReaction, MessageReport, BlockedUser,
│   │   │   │                       ShakeLog
│   │   │   ├── views.py         ← + shake_connect, disconnect_user
│   │   │   ├── admin_views.py   ← + chat_shakes_panel
│   │   │   ├── admin_urls.py
│   │   │   └── urls.py
│   │   ├── leaderboard/
│   │   │   ├── models.py        ← PointEntry, UserPoints, PointAction, POINT_VALUES
│   │   │   ├── views.py
│   │   │   ├── utils.py         ← award_points() with points_override param,
│   │   │   │                       award_daily_login()
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
│   │   ├── base.html            ← master layout, sidebar (Checkpoint replaced Selfie
│   │   │                          Spots), CSS variables, Font Awesome 6.5.1
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
│   │   ├── sponsor_form.html    ← Side-by-side form + 480px Leaflet map picker
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
│   │   ├── photos.html          ← Approve/Reject with selfie sync + revoke points
│   │   ├── polls_list.html
│   │   ├── poll_form.html
│   │   ├── poll_results.html
│   │   ├── ideathon.html
│   │   ├── selfie_points.html   ← UNIFIED CHECKPOINT MANAGER — tabbed creator
│   │   │                          (Selfie/Sponsor Zone), Leaflet map with 2-click
│   │   │                          corridor drawing, sponsor M2M checkboxes,
│   │   │                          submissions review, global toggle broadcast
│   │   └── chat/
│   │       ├── list.html
│   │       ├── thread.html
│   │       ├── requests.html
│   │       ├── reports.html
│   │       ├── analytics.html
│   │       └── shakes.html
│   ├── media/
│   │   ├── sponsors/            ← 13 sponsor logos
│   │   ├── sponsors/stalls/     ← stall preview photos
│   │   ├── speakers/            ← 19 speaker photos
│   │   ├── selfie_points/samples/  ← sample reference photos
│   │   ├── selfie_submissions/  ← user-uploaded verified selfies
│   │   └── audio/
│   │       └── bubble-pop-up-sfx.mp3
│   ├── seed_sponsors.py
│   ├── seed_speakers.py
│   ├── requirements.txt
│   ├── .env
│   └── manage.py
├── mobile/
│   ├── App.js
│   ├── app.json                 ← Camera + Location + all permissions set
│   ├── babel.config.js
│   ├── package.json             ← react-native-webview ^14.0.1 INSTALLED,
│   │                               eas-cli in devDependencies
│   ├── eas.json                 ← development/preview/production profiles
│   ├── index.js
│   ├── google-services.json
│   └── src/
│       ├── theme.js             ← COLORS, FONT, SPACE, RADIUS, SHADOW,
│       │                           API_URL (10.17.9.48:8000/api/v1), API_ROOT,
│       │                           API_HEADERS, fixMediaUrl, W
│       ├── components.js        ← PulsingDot, GradientAvatar, FadeIn, Badge
│       ├── cache.js             ← 5-min TTL AsyncStorage helper
│       ├── api.js               ← apiFetch (auto-refresh JWT, FormData aware)
│       ├── MainApp.js           ← tab router + subScreen router
│       │                           SubScreens include: recap, checkpoint (renamed
│       │                           from selfie_spots, backward-compat alias kept)
│       ├── notifications.js
│       ├── utils/
│       │   └── geo.js           ← getHaversineDistanceMeters, formatDistance,
│       │                          openNativeWalkingDirections (Google Maps deep link)
│       └── screens/
│           ├── HomeTab.js       ← Quick Access grid has "Checkpoint" tile
│           │                       (flag-outline icon, pink gradient)
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
│           ├── PhotosScreen.js  ← + Selfie Challenge banner opens Checkpoint
│           ├── PollsScreen.js
│           ├── IdeathonScreen.js
│           ├── ShakeConnectScreen.js
│           ├── RecapScreen.js
│           ├── CheckpointScreen.js  ← ★ NEW: Unified selfie + sponsor zone
│           │                          screen with Leaflet WebView map, pin
│           │                          popup cards, auto sponsor zone check-in,
│           │                          in-app Google Maps directions WebView,
│           │                          admin approval pending states, lightbox
│           │                          with prev/next navigation
│           └── admin/
│               ├── AdminTab.js  ← + "Checkpoints" tile (flag icon, pink gradient)
│               ├── NotificationsAdmin.js
│               ├── UsersAdmin.js
│               ├── AddParticipantScreen.js
│               ├── CheckInScreen.js
│               ├── ScheduleAdmin.js
│               ├── PhotosAdmin.js
│               ├── PollsAdmin.js
│               ├── IdeathonAdmin.js
│               └── CheckpointAdminScreen.js  ← ★ NEW: Full CRUD for checkpoints
│                                                with tabbed List/Create views,
│                                                full-screen Modal map picker
│                                                (fixes scroll conflicts),
│                                                nestedScrollEnabled sponsor
│                                                checkbox list, manual coordinate
│                                                text inputs, global toggle switch
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
  Cache:         AsyncStorage via src/cache.js + inline TTL cache in NetworkScreen/ScheduleTab
  Image Pick:    expo-image-picker ~17.0.11
  Camera:        expo-camera ~17.0.10
  Haptics:       expo-haptics ~15.0.8
  Sensors:       expo-sensors ~15.0.8 (Accelerometer)
  Audio:         expo-av ~16.0.8 (bubble pop sfx)
  Location:      expo-location ~19.0.8 (BestForNavigation accuracy)
  WebView:       react-native-webview ^14.0.1 (INSTALLED, used for Leaflet map
                 rendering + in-app Google Maps walking directions)

BACKEND:
  Framework:   Django 4.2.9 + Django REST Framework
  Auth:        JWT via djangorestframework-simplejwt
  User model:  Custom (UUID pk, email as USERNAME_FIELD, role field, research_interests)
  Database:    PostgreSQL 16
  Cache:       Redis 7 (via Django cache framework, NOT django_redis module)
  Push:        Expo Push API (NOT Firebase Admin SDK) — send via IITD proxy with
               session.verify = False
  Admin panel: Custom Django MVT
  Media:       ImageField uploads via MEDIA_URL/MEDIA_ROOT
  Maps:        Leaflet 1.9.4 CDN (unpkg.com) with OpenStreetMap tiles
               https://tile.openstreetmap.org/{z}/{x}/{y}.png
```

---

## TEMPLATE SYSTEM — HOW IT WORKS
```
LOCATION:   backend/templates/panel/
SETTINGS:   TEMPLATES[0]['DIRS'] = [BASE_DIR / 'templates']
            → resolves to /home/baadalvm/eventapp/backend/templates/
ALL EXTEND: {% extends "panel/base.html" %}

base.html provides:
  - CSS variables: --primary, --success, --danger, --warning, --bg, --surface,
    --border, --text, --text-sec, --bg-sec, --brand, --brand-light
  - Sidebar navigation with active-state detection via request.resolver_match.url_name
  - Font Awesome 6.5.1 icons
  - Flash messages
  - Topbar with conference name
  - {% block title %} {% block page_title %} {% block page_subtitle %} {% block content %}

Template wiring:
  admin_views.py → render(request, 'panel/<template>.html', context)
  admin_urls.py  → path('panel/<route>/', admin_views.<function>, name='<name>')
  base.html sidebar → <a href="/panel/<route>/" class="nav-item {% if '<name>' in request.resolver_match.url_name %}active{% endif %}">

Chat templates use subfolder:
  render(request, 'panel/chat/shakes.html', ...)
  Located at: backend/templates/panel/chat/shakes.html

SIDEBAR LINKS (base.html):
  Dashboard           → /panel/
  Participants        → /panel/participants/
  Check-In Scanner    → /panel/checkins/scanner/
  Events & Schedule   → /panel/schedule/
  Photos              → /panel/photos/
  Checkpoint          → /panel/checkpoint/         ← RENAMED (was Selfie Spots)
                        (icon: fas fa-flag, matches 'checkpoint' OR 'selfie' url_name)
  Posts & Feed        → /panel/feed/
  Polls               → /panel/polls/
  Leaderboard         → /panel/leaderboard/
  Ideathon Teams      → /panel/ideathon/
  Chat & Connections  → /panel/chat/
  Reported Messages   → /panel/chat/reports/
  Shake Connect Logs  → /panel/chat/shakes/
  Notifications       → /panel/notifications/
  Sponsors            → /panel/sponsors/
  Speakers            → /panel/speakers/
  User Management     → /panel/users/manage/
  Settings            → /panel/settings/conference/

LEAFLET MAP PICKERS (use OSM tiles + navigator.geolocation):
  sponsor_form.html:
    - Side-by-side form (380px left) + big Leaflet map (480px right)
    - Click drops pin, marker draggable, syncs to lat/lng inputs both ways
    - "Use My GPS Location" button — browser navigator.geolocation
    - IDs: sp_lat, sp_lng, sponsor_map, updateSponsorMarker, syncSponsorInputs

  selfie_points.html (renders /panel/checkpoint/):
    - Global "Open/Close Challenge Window" toggle at top — broadcasts push
      notification when toggled
    - Stats grid: Active Spots, Total Submissions, Approved count
    - Split form panel (380px left) + big Leaflet map (480px right)
    - Type switcher at top: "📸 Selfie Spot" | "🏢 Sponsor Zone"
      - Selfie mode: click map drops pink circle with radius slider
      - Sponsor Zone mode: click map twice (Point A → Point B), draws blue
        corridor line between them, corridor width slider
    - Multi-select sponsor checkboxes (fetched live from Sponsor DB)
    - Sample photo uploader
    - Active Checkpoints table with type badges, coords, stalls linked,
      toggle active, delete
    - Attendee Submissions table with photo preview, distance, status,
      approve/reject/delete actions
    - IDs: sf_lat, sf_lng, pt_a_lat, pt_a_lng, pt_b_lat, pt_b_lng, corridor_w,
      admin_map, currentType, markerA, markerB, corridorLine, nextClickIsPointB
```

---

## DATABASE — KEY TABLES
```
users                     ← custom User model (research_interests field)
checkins                  ← CheckIn (conference + meal types)
meal_passes, meal_windows
participant_imports
user_fcm_tokens (notifications_devicetoken)
notifications_notification (UUID pk, target_type, status, sent_by)
notifications_usernotification (delivered, read, delivered_at)
point_entries, user_points
photos, photo_settings
selfie_points             ← UNIFIED CHECKPOINT MODEL:
                            checkpoint_type = 'selfie' | 'sponsor_zone'
                            Selfie fields: latitude, longitude, radius_meters
                            Sponsor fields: point_a_lat, point_a_lng, point_b_lat,
                                            point_b_lng, corridor_width_meters
                            Shared: name, description, points, sample_photo,
                                    is_active, sponsors (M2M to Sponsor)
selfie_submissions        ← APPROVAL WORKFLOW:
                            status = 'pending' | 'approved' | 'rejected'
                            points_awarded (0 until approved)
                            rejected_reason, reviewed_by, reviewed_at
                            unique_together = (user, selfie_point)
sponsors_sponsor          ← + latitude, longitude, stall_number, stall_photo,
                              contact_person_name, contact_person_role
speakers_speaker
schedule_schedulesession
polls_poll, polls_polloption, polls_vote, polls_pollauditlog
polls_ideathonconfig, polls_ideathonteam, polls_ideathonmember
chat_connectionrequest, chat_conversation, chat_message
chat_messagereaction, chat_messagereport, chat_blockeduser
chat_shakelog

Migrations state:
  polls:    0001_initial, 0002_ideathonteam_ideathonconfig_ideathonmember
  chat:     0001_initial, 0002_..., 0003_shakelog
  photos:   0001_initial, 0002_selfiepoint_selfiesubmission,
            0003_photosettings_selfie_upload_open,
            0004_selfiepoint_checkpoint_type_and_more (added corridor fields,
            M2M sponsors, submission approval workflow)
  sponsors: 0001_initial, 0002_sponsor_contact_person_name_and_more
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
path('panel/', include('apps.photos.admin_urls'))    ← photos/, checkpoint/,
                                                       selfie-points/ (alias)
path('panel/', include('apps.posts.admin_urls'))
path('panel/', include('apps.polls.admin_urls'))

# Mobile API
path('api/v1/auth/',          include('apps.accounts.urls'))       ← + my-recap/
path('api/v1/conferences/',   include('apps.conferences.urls'))
path('api/v1/events/',        include('apps.events.urls'))
path('api/v1/photos/',        include('apps.photos.urls'))          ← + checkpoints/,
                                                                       checkpoint-visit/,
                                                                       admin/checkpoints/*,
                                                                       admin/sponsors-flat/
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

## PHOTOS + CHECKPOINTS API — /api/v1/photos/
```
Participant Gallery:
  GET  /api/v1/photos/gallery/
  POST /api/v1/photos/upload/                     ← auto-approve OR pending
  GET  /api/v1/photos/mine/
  DELETE /api/v1/photos/mine/<pk>/delete/
  GET  /api/v1/photos/sessions/

Admin Photo API:
  GET/POST /api/v1/photos/admin/settings/
  GET  /api/v1/photos/admin/queue/
  POST /api/v1/photos/admin/<pk>/review/
  DELETE /api/v1/photos/admin/<pk>/delete/
  GET  /api/v1/photos/admin/stats/

Participant Checkpoints:
  GET  /api/v1/photos/checkpoints/                ← Active spots + user status
  POST /api/v1/photos/checkpoint-visit/           ← Verify + submit
  GET  /api/v1/photos/selfie-points/              ← Alias (backward compat)
  POST /api/v1/photos/selfie-upload/              ← Alias

Mobile Admin Checkpoints CRUD:
  GET  /api/v1/photos/admin/checkpoints/          ← List all (active + inactive)
  POST /api/v1/photos/admin/checkpoints/          ← Create new checkpoint
  POST /api/v1/photos/admin/checkpoints/<pk>/toggle/
  DELETE /api/v1/photos/admin/checkpoints/<pk>/delete/
  GET  /api/v1/photos/admin/sponsors-flat/        ← All sponsors for M2M linking
```

---

## CHECKPOINT SYSTEM — HOW IT WORKS
```
UNIFIED MODEL:
  SelfiePoint model has checkpoint_type field:
    'selfie'       → circular geofence with latitude/longitude/radius_meters
    'sponsor_zone' → rectangular corridor with point_a_lat/lng, point_b_lat/lng,
                     corridor_width_meters, and M2M sponsors

GEOFENCE VERIFICATION:
  Selfie (Haversine circular):
    R = 6371000m
    Formula: standard great-circle distance
    Inside if distance <= radius_meters

  Sponsor Zone (2D flat-earth corridor projection):
    Uses average latitude cos projection for accuracy over small distances:
      lat_avg = (lat_a + lat_b) / 2 * PI/180
      by = (lat_b - lat_a) * 111000
      bx = (lng_b - lng_a) * 111000 * cos(lat_avg)
      py = (lat_p - lat_a) * 111000
      px = (lng_p - lng_a) * 111000 * cos(lat_avg)
    Project point P onto line segment AB (clamped 0..1)
    Compute perpendicular distance
    Inside if distance <= corridor_width_meters / 2

APPROVAL WORKFLOW (Photos gate points award):
  1. User submits selfie via /api/v1/photos/checkpoint-visit/
     - Server validates GPS coords via geofence
     - Creates SelfieSubmission (status='pending', points_awarded=0)
     - Replicates image to Photo table as PENDING
     - Returns "Awaiting admin approval" message
  2. Admin reviews at /panel/photos/?tab=pending OR /panel/checkpoint/
     - APPROVE: SelfieSubmission.status='approved', points_awarded=spot.points,
       award_points(user, PHOTO_UPLOAD, points_override=spot.points)
     - REJECT: SelfieSubmission.status='rejected', if previously approved →
       award_points(user, PHOTO_UPLOAD, points_override=-points_awarded) to revoke
  3. Photo caption format: "📸 Selfie Spot: {spot.name}"
     - Used to match Photo record back to SelfieSubmission for sync

SPONSOR ZONE — AUTO CHECK-IN (No Photo Needed):
  - User enters corridor → CheckpointScreen useEffect detects entry via
    isInsideCorridor() function
  - Auto-fires POST /api/v1/photos/checkpoint-visit/ with no image
  - Server auto-approves immediately (status='approved')
  - Points credited instantly (default 10)
  - Once completed, autoCheckedInRef prevents re-firing

POINTS RULES:
  - One-time per user per checkpoint (unique_together = user + selfie_point)
  - award_points(..., points_override=N) supports custom amounts + revocation
    with negative values
  - Uses PointAction.PHOTO_UPLOAD action key
```

---

## MOBILE — CheckpointScreen.js FEATURES
```
- Live Leaflet WebView map with:
    Pink circle pins for selfie spots
    Blue corridor lines between Point A and B for sponsor zones
    Pulsing blue user location dot with 6px glow ring
- Pin tap → floating popup card with photo, distance, points, action buttons
- Filter chips: All | 📸 Selfie Spots | 🏢 Sponsor Zones | ✓ Done
- Card list below with:
    Proximity status: "IN ZONE" (green) vs "234m away"
    Status badges: "⏳ Pending Review" | "✓ Completed" | "✗ Declined"
    Reference photo + Your Selfie polaroid comparison
    "Take Selfie" (only when inside geofence) or "Get Closer" (disabled)
    "Explore Stalls" for sponsor zones → opens sponsor grid modal
- Sponsor zone modal: full sponsor tiles with logos → tap opens
  existing SponsorDetailScreen
- Lightbox with Prev/Next navigation and "Show Reference/Show My Selfie" toggle
- In-app WebView Google Maps walking directions modal
- Auto sponsor zone check-in on entering corridor (GPS smoothed with
  moving-average filter over last 4 samples, rejects accuracy > 30m)

STATE:
  spots, selfieOpen, gpsStatus ('locating'|'ready'|'denied'),
  filterTab, selectedSpotId, previewModal, directionsUrl,
  sponsorZoneModal, detailSponsorId
```

---

## MOBILE — CheckpointAdminScreen.js FEATURES
```
LOCATION: mobile/src/screens/admin/CheckpointAdminScreen.js

TABS:
  1. LIST TAB:
     - Global toggle switch for GPS Challenge Submissions (fires push broadcast)
     - Cards for each checkpoint with type badge (📸/🏢), points, stall count,
       toggle active button, delete button
  2. CREATE TAB:
     - Type switcher: Selfie Spot vs Sponsor Zone
     - "Pinpoint Location on Map" button → opens FULL-SCREEN MODAL map picker
       (fixes scroll conflicts by isolating map from parent ScrollView)
     - Manual coordinate text inputs (editable, users can type coords directly)
     - Radius / corridor width numeric input
     - Reference photo picker (expo-image-picker library)
     - Sponsor multi-select with nestedScrollEnabled ScrollView
       (fixed height 160px, scrolls smoothly inside form)
     - Save button submits multipart/form-data POST

MODAL MAP PICKER:
  - Full-screen modal with WebView + Leaflet map
  - Selfie mode: single tap drops pink pin with radius circle
  - Sponsor mode: first tap = Point A (blue), second tap = Point B (orange),
    auto-draws connecting blue polyline corridor
  - "Set Live GPS" button uses expo-location to grab admin's live position
  - Footer shows current selection with hint text
  - "Confirm Selection" button copies temp coords to form state and closes

STATE:
  activeTab, checkpoints, sponsors, globalSettings, formType, name,
  description, points, radiusMeters, corridorWidth, selectedSponsors,
  samplePhoto, selfieLat, selfieLng, ptALat/Lng, ptBLat/Lng,
  showMapModal, tempSelfieCoords, tempPtA, tempPtB
```

---

## LEADERBOARD SYSTEM
```
PointAction values:
  SIGNUP:10  CHECKIN:20  MEAL:10  POLL_VOTE:20
  PHOTO_UPLOAD:15  PROFILE_COMPLETION:50
  FEEDBACK:25  NETWORKING:15  DAILY_LOGIN:10

Award pattern:
  from apps.leaderboard.utils import award_points
  from apps.leaderboard.models import PointAction
  award_points(user, PointAction.PHOTO_UPLOAD, note='...',
               points_override=15)   ← optional custom amount

Revoke pattern:
  award_points(user, PointAction.PHOTO_UPLOAD, note='Revoked: ...',
               points_override=-15)  ← negative amount for revocation
```

---

## PUSH NOTIFICATION SYSTEM
```
fcm.py — always Expo Push API, never Firebase Admin SDK
send_to_all(title, body, data, notif, request=None)  ← notif param REQUIRED
send_to_role(role, title, body, data, notif, request=None)
send_to_user(user, title, body, data, notif, request=None)
send_to_tokens(tokens, title, body, data, img=None)  ← public alias

IITD proxy workaround:
  proxies = {'http': 'http://proxy21.iitd.ac.in:3128', 'https': ...}
  session.verify = False

⚠️ CRITICAL — Notification model does NOT have delivered_at field.
   To send: First create Notification.objects.create(title, body, target_type,
                                                     status, sent_by, data)
            Then call send_to_all(title, body, data, notif)
   The delivered_at field lives on UserNotification (per-user tracking).

Broadcast trigger example (Checkpoint Toggle):
  notif = Notification.objects.create(
      title="📸 Checkpoint Challenges",
      body="Organizers have OPENED Checkpoint Challenges!",
      target_type='all', status='sent', sent_by=request.user,
      data={"type": "selfie_spots"}
  )
  send_to_all(title, body, {"type": "selfie_spots"}, notif)
```

---

## AUTH SYSTEM
```
LOGIN:   POST /api/v1/auth/login/     { email, password }
         Returns: { success, tokens: { access, refresh }, user }
REFRESH: POST /api/v1/auth/token/refresh/  { refresh }
ROLES:   participant, speaker, super_admin, mgmt_admin, team_head, staff
ADMIN (web panel): super_admin, mgmt_admin
SCANNER  (QR):     super_admin, mgmt_admin, team_head, staff
CHECKPOINT ADMIN:  super_admin, mgmt_admin, team_head, staff
admin_required decorator in apps/accounts/admin_views.py
_is_admin() helper checks role in views
```

---

## MOBILE UTILS — geo.js
```
Path: mobile/src/utils/geo.js
Exports:
  getHaversineDistanceMeters(lat1, lon1, lat2, lon2) → meters | null
  formatDistance(meters) → "18m away" | "1.4 km away" | "Distance unknown"
  openNativeWalkingDirections(lat, lng, label)
    iOS  → maps://app?daddr=LAT,LNG&dirflg=w  (fallback Google Maps URL)
    Android → https://www.google.com/maps/dir/?api=1&destination=LAT,LNG&travelmode=walking
    Uses Linking.canOpenURL + fallback

⚠️ In CheckpointScreen.js, we DO NOT use openNativeWalkingDirections anymore.
   Instead, walking directions open in an IN-APP WebView modal via
   setDirectionsUrl(googleMapsUrl) for a smoother user experience.
```

---

## HOMETAB QUICK ACCESS GRID
```
8 tiles in a 4x2 grid, 23.5% width each:
  1. Sponsors        (ribbon-outline, brand blue gradient)
  2. Speakers        (mic-outline, purple gradient)
  3. Photos          (camera-outline, green gradient)
  4. Checkpoint      (flag-outline, pink gradient #ec4899 → #be185d) ← NEW
  5. Live Polls      (stats-chart-outline, accent orange)
  6. Ideathon        (bulb-outline, sky blue)
  7. Leaderboard     (trophy-outline, rose red)
  8. Schedule        (time-outline, indigo blue)

Handler routes 'checkpoint' → onOpenCheckpoint() → subScreen 'checkpoint'
```

---

## WHAT IS WORKING ✅
```
✅ Django API on IITD VM (10.17.9.48:8000)
✅ Expo web + Android dev build with react-native-webview installed
✅ PostgreSQL 16 + Redis 7
✅ JWT auth with auto-refresh
✅ Session persistence
✅ Admin panel at /panel/login/
✅ Push notifications (Expo Push API via IITD proxy)
✅ SPONSORS: 13 seeded with logos + fields (lat/lng/stall/contact person)
✅ SPEAKERS: 19 seeded with photos
✅ SCHEDULE: 32 sessions, 3 days, sub-sessions, bookmarks, feedback
✅ CHAT: full stack
✅ CHECK-IN: QR + meal
✅ LEADERBOARD: 9 actions, ranking, points_override support
✅ PHOTOS: upload/moderation/gallery/admin sync with selfie submissions
✅ HOME TAB: 4x2 quick grid, status strip, announcement deck, Checkpoint tile
✅ BOTTOM TAB: home|schedule|feed(accent)|network|profile (+admin for admins)
✅ NETWORK: 3-tab always-mounted, 30-min AsyncStorage cache
✅ PROFILE: edit, change password, + "My Recap"
✅ NOTIFICATIONS
✅ POLLS: full lifecycle
✅ IDEATHON: full lifecycle
✅ DISCOVERY (For You): research interest matching
✅ INTERACTIVE BUBBLE MAP: pop FX (particles + shrink + reflow + respawn) + sound
✅ SHAKE TO CONNECT: full stack + admin logs
✅ HAPTICS: 6+ locations wired, Android/iOS variants
✅ OFFLINE SCHEDULE: cache-first render + 1-hour TTL + banners
✅ RECAP: /api/v1/auth/my-recap/?day + RecapScreen with animated cards + Share
✅ QR TICKET REDESIGN: ticket aesthetic with perforated edges + shimmer + refresh btn

✅ UNIFIED CHECKPOINT SYSTEM (COMPLETE):
     BACKEND:
     - SelfiePoint model unified for selfie + sponsor_zone types
     - SelfieSubmission with approval workflow (pending/approved/rejected)
     - Points ONLY awarded on admin approval, revoked on rejection
     - Corridor geofencing math (2D flat-earth projection helper)
     - Sponsor zone auto-approval (no photo needed)
     - /panel/checkpoint/ admin with tabbed creator, sponsor M2M checkboxes,
       Leaflet map with corridor drawing
     - /panel/photos/ syncs approval status with SelfieSubmission
     - Mobile admin API endpoints (list, create, toggle, delete, sponsors-flat)
     - Push notification broadcast on toggle open/close
     
     MOBILE PARTICIPANT (CheckpointScreen.js):
     - Interactive Leaflet WebView map with pins + corridors
     - Live GPS tracking with moving-average smoothing filter
     - Auto sponsor zone check-in on corridor entry
     - Pin tap → floating popup card with all details
     - Filter chips (All/Selfie/Sponsor/Done)
     - Card list with proximity gauges and approval status badges
     - Sponsor stalls modal → tap opens SponsorDetailScreen
     - In-app Google Maps walking directions WebView modal
     - Lightbox with Prev/Next + Reference/Selfie toggle
     - "Pending Admin Review" badges after submission
     
     MOBILE ADMIN (CheckpointAdminScreen.js):
     - Full CRUD from phone (list, create, toggle, delete)
     - Global submissions toggle switch (fires push broadcast)
     - Tabbed List/Create views
     - Manual coordinate text inputs for direct entry
     - Full-screen Modal map picker (fixes scroll conflicts)
     - GPS locator button for admin's live position
     - Sponsor multi-select with nestedScrollEnabled ScrollView
     - Reference photo picker
     - Wired into AdminTab.js with pink "Checkpoints" tile
```

---

## WHAT IS NEXT / KNOWN PENDING ❌
```
❌ Home Tab "Conference Pulse" live stats widget
❌ Speaker Connect post-session banner
❌ Mobile admin for polls + ideathon from AdminTab
❌ Sponsor stall live foot-traffic heatmap
❌ Post-approval celebration modal with confetti + bubble pop sound
   (backend notification system triggers, mobile confetti UI pending)
❌ Selfie point approval push notification to individual user
   ("🎉 Your selfie was approved! +10 pts" — infrastructure ready via
   send_to_user, just needs trigger in admin_review)
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
  ✗ Never place WebView map inside ScrollView (touch gesture conflict) —
     use full-screen Modal picker pattern instead
  ✓ apiFetch() for ALL authenticated calls
  ✓ tokensRef.current in intervals
  ✓ submitRef guard on submit buttons
  ✓ Speaker filename: SpokersScreen.js (intentional)
  ✓ PanResponder: use refs (not state) inside callbacks
  ✓ try/catch around Accelerometer (web fallback)
  ✓ All 3 NetworkScreen tabs always mounted (display:'none' for now)
  ✓ For hot code: useCallback on FlatList renderItem
  ✓ Do NOT trigger fetches on tab switch when data already loaded
  ✓ For scrollable checklists inside forms: use nestedScrollEnabled={true} on inner ScrollView

BACKEND:
  ✗ Never Firebase Admin SDK for push
  ✗ Never django_redis module — Django cache API only
  ✗ Never pass delivered_at to Notification.objects.create() — it's a
     UserNotification field
  ✓ Push via Expo Push API only (fcm.py)
  ✓ Notification.objects.create() FIRST, then send_to_all(..., notif)
  ✓ Login: /api/v1/auth/login/ NOT /api/v1/auth/token/
  ✓ schedule app label = 'schedule'
  ✓ Singleton models: save() sets self.pk = 1
  ✓ Tab preserved on POST redirect
  ✓ Use python3 (not python) on VM
  ✓ Vote concurrency: unique_together + IntegrityError + F() for points
  ✓ Shake matching: shared cache dict ('shake:active'), NOT Redis key scan
  ✓ Selfie upload: SERVER geofence is authoritative; client check is UX only
  ✓ HARD REJECT (HTTP 403) if outside radius — no photo saved at all
  ✓ Selfie photos created as PENDING (never APPROVED directly) — admin must approve
  ✓ Approval sync: caption "📸 Selfie Spot: {name}" links Photo → SelfieSubmission
  ✓ Points revoked with points_override=-N in award_points()

TEMPLATES:
  ✓ All extend "panel/base.html"
  ✓ DIRS = [BASE_DIR / 'templates'] → backend/templates/
  ✓ Chat templates in subfolder: templates/panel/chat/
  ✓ Active sidebar: {% if '<url_name>' in request.resolver_match.url_name %}
  ✓ Leaflet 1.9.4 loaded from unpkg.com CDN — works over IITD proxy (public CDN)
  ✓ Tile server: OpenStreetMap direct (tile.openstreetmap.org)
  ✓ Map picker pattern: click drops pin, drag updates, GPS button, lat/lng inputs sync both ways
  ✓ Checkpoint template supports BOTH selfie (single click, circle radius) AND
    sponsor_zone (2-click corridor with polyline) type switching

IITD PROXY:
  ✗ Never rely on ngrok / cloudflared / tunnels
  ✗ Never expect npm install to work without SSL bypass
  ✓ npm workaround: NODE_TLS_REJECT_UNAUTHORIZED=0 <cmd> --strict-ssl=false
  ✓ pip workaround: --break-system-packages
  ✓ CDN assets (unpkg leaflet, tile.openstreetmap.org) work over proxy
  ✓ Expo Push works via proxy with verify=False in requests
  ✓ EAS build uses NODE_TLS_REJECT_UNAUTHORIZED=0 prefix

CHECKPOINT SYSTEM:
  ✓ SelfiePoint DB table name preserved (NOT renamed to checkpoints) for backward compat
  ✓ Old API aliases kept: /selfie-points/, /selfie-upload/ (mobile compat)
  ✓ Old admin panel alias kept: /panel/selfie-points/ redirects to /panel/checkpoint/
  ✓ subScreen names: 'checkpoint' (new) + 'selfie_spots' (legacy alias) both work in MainApp.js
  ✓ Photo caption "📸 Selfie Spot: {name}" is the sync key — DO NOT CHANGE FORMAT
  ✓ Sponsor zones auto-approve on submission (no admin review needed since no photo)
  ✓ Selfie spot photos MUST be admin-approved before points credited
  ✓ Points config comes from SelfiePoint.points field (per-checkpoint), not
    global PointAction.PHOTO_UPLOAD:15
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
  nidhi.bhatt@test.com / Test@1234
  Dummy: firstname.lastname@test.com / Test@1234 (100 users, 101 checked-in)

ADMIN PANEL (http://10.17.9.48:8000/panel/login/):
  etd@admin.iitd.ac.in
```

---

## COORDINATES REFERENCE (IIT DELHI)
```
Campus centre approx:
  Red Square area:  28.5456, 77.1923
  Dogra Hall:       28.5455, 77.1930
  Central Library:  28.5449, 77.1926
Zoom level: 17-18 for stall pinning
Realistic GPS accuracy outdoors on IITD open ground: 3-10 m
Chosen geofence radius default: 20 m for selfies (admin-editable)
Corridor width default: 30 m for sponsor zones (admin-editable)
```

---

## DEVELOPMENT CYCLE
```
diagnose → get code from user if needed → assess → implement minimum correct change
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
 10. For IITD VM: prefer CDN + system packages over npm/pip when possible.
 11. All code delivered via cat << 'EOF' > <path> commands.
 12. For scrollable UI inside forms with a WebView map: use full-screen Modal
     picker pattern to eliminate touch/scroll conflicts.
 13. Auto-approve safe operations (like sponsor zone entry, no user content).
     Manual admin approval for user-uploaded content (like selfie photos).
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
  ├─ imports CheckpointScreen from './screens/CheckpointScreen'
  ├─ subScreen routes: 'checkpoint' + 'selfie_spots' (legacy alias)
  ├─ passes onOpenCheckpoint to HomeTab
  └─ notification route type 'selfie_spots' → opens 'checkpoint' subScreen

mobile/src/screens/HomeTab.js
  ├─ receives onOpenCheckpoint prop
  ├─ Quick Access grid item: { icon: 'flag-outline', label: 'Checkpoint',
  │                            grad: ['#ec4899', '#be185d'], action: 'checkpoint' }
  └─ handleQuickAction('checkpoint') → onOpenCheckpoint()

mobile/src/screens/CheckpointScreen.js
  ├─ imports WebView, expo-location, expo-image-picker, expo-haptics
  ├─ imports fixMediaUrl from '../theme'
  ├─ imports apiFetch from '../api'
  ├─ imports getHaversineDistanceMeters, formatDistance from '../utils/geo'
  ├─ imports PulsingDot from '../components'
  ├─ imports SponsorDetailScreen from './SponsorDetailScreen'  ← reuses existing
  ├─ fetches /photos/checkpoints/
  ├─ posts to /photos/checkpoint-visit/
  └─ opens SponsorDetailScreen via setDetailSponsorId(id)

mobile/src/screens/admin/AdminTab.js
  ├─ imports CheckpointAdminScreen from './CheckpointAdminScreen'
  ├─ FEATURES grid item: { key: 'checkpoints_admin', icon: 'flag',
  │                        label: 'Checkpoints', grad: ['#ec4899', '#be185d'] }
  └─ if (screen === 'checkpoints_admin') return <CheckpointAdminScreen ... />

mobile/src/screens/admin/CheckpointAdminScreen.js
  ├─ imports WebView, expo-image-picker, expo-location, expo-haptics
  ├─ imports apiFetch from '../../api'
  ├─ fetches /photos/admin/checkpoints/, /photos/admin/sponsors-flat/,
  │  /photos/admin/settings/
  ├─ posts to /photos/admin/checkpoints/ (create)
  ├─ posts to /photos/admin/checkpoints/<pk>/toggle/
  └─ deletes /photos/admin/checkpoints/<pk>/delete/

backend/apps/photos/urls.py
  ├─ /checkpoints/ + /checkpoint-visit/ (participant API)
  ├─ /selfie-points/ + /selfie-upload/ (backward-compat aliases)
  └─ /admin/checkpoints/ + /admin/sponsors-flat/ (mobile admin)

backend/apps/photos/admin_urls.py
  ├─ /panel/photos/         → photos_panel (approve/reject syncs with SelfieSubmission)
  ├─ /panel/checkpoint/     → selfie_points_panel (unified admin)
  └─ /panel/selfie-points/  → selfie_points_panel (alias)

backend/apps/photos/views.py
  ├─ _haversine_m() for selfie geofence
  ├─ _is_in_corridor() for sponsor zone geofence (2D flat-earth projection)
  ├─ _selfie_point_data() serializer includes sponsors list for sponsor_zone type
  ├─ selfie_upload() branches on checkpoint_type:
  │    selfie → pending, photo saved, replicated to Photo table as PENDING
  │    sponsor_zone → auto-approved, points credited immediately
  ├─ admin_review() (photo approval) syncs approval with SelfieSubmission
  │   via caption "📸 Selfie Spot: {name}" pattern
  └─ admin_checkpoints_list_create() supports M2M sponsors linking

backend/apps/photos/admin_views.py
  ├─ photos_panel: approves photo + finds matching SelfieSubmission by
  │  uploader + spot name → awards points OR revokes on reject
  ├─ selfie_points_panel:
  │    toggle_window → creates Notification + send_to_all() push broadcast
  │    create → handles both selfie + sponsor_zone with sponsor M2M linking
  │    approve_submission / reject_submission → dedicated review actions
  │    delete_submission → revokes points if was approved
  └─ Passes all_sponsors context to template for M2M checklist

backend/templates/panel/selfie_points.html
  ├─ Renders /panel/checkpoint/ (also aliased at /panel/selfie-points/)
  ├─ Global toggle at top with push broadcast
  ├─ Tabbed creator: Selfie / Sponsor Zone
  ├─ Leaflet map: circular pin for selfie, 2-point corridor line for sponsor
  ├─ Multi-select sponsor checkboxes (all_sponsors context)
  └─ Submissions table with approve/reject/delete actions

backend/templates/panel/base.html
  └─ Sidebar link: /panel/checkpoint/ with flag icon
     Active detection: 'checkpoint' OR 'selfie' in request.resolver_match.url_name

backend/apps/leaderboard/utils.py
  └─ award_points(user, action, note='', points_override=None)
     ├─ Uses points_override if provided (allows custom amounts + revocation)
     ├─ Creates PointEntry + updates UserPoints total atomically
     └─ Called by:
          - photos/views.py::selfie_upload() (sponsor zone auto-approve)
          - photos/views.py::admin_review() (photo approval)
          - photos/admin_views.py::photos_panel() (web admin approve/reject)
          - photos/admin_views.py::selfie_points_panel() (submission review)
```