# Features To Build — New Chat Briefing

---

## FEATURE 1: DISCOVERY GRAPH DONE 
```
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
```

---

## FEATURE 2: SPEAKER CONNECT
```
WHAT: After a session ends, show banner "Want to connect with [Speaker]?"
WHY: Structured post-session networking — no other conference app does this

DATA ALREADY EXISTS:
  ScheduleSession has speaker FK → speakers.Speaker
  Speaker model exists (need to check if Speaker has user FK)
  Chat/connection request system exists
  Session status property: 'upcoming' | 'live' | 'past'

CRITICAL UNKNOWN (must check):
  Does Speaker model have a FK to User (accounts.User)?
  If NO → speaker connect cannot send real connection request
           → workaround: show speaker contact info / email
  If YES → one-tap sends connection request via existing chat API

WHAT NEEDS BUILDING:

BACKEND:
  GET /api/v1/schedule/sessions/<uuid>/speaker-connect/
  Returns:
    - speaker profile (name, photo, bio, research_interests)
    - speaker user_id (if linked to User account)
    - whether user already connected with this speaker
    - whether session has ended (feedback_open is a proxy)
  
  If speaker has no User account:
    Return speaker email/bio for display only

MOBILE — addition to ScheduleTab.js:
  After session status = 'past' AND session has speaker:
    Show card below session: "Connect with [Speaker Name]"
    Tap → sends connection request (if speaker has user account)
          OR shows speaker profile modal
  
  Also: push notification trigger (optional)
    When session ends → notify bookmarked users
    "Session ended. Connect with [Speaker Name] now"
    (cron job already exists in send_session_reminders.py)

WHAT TO CHECK FIRST:
  cat backend/apps/speakers/models.py   ← does Speaker have user FK?
  cat backend/apps/speakers/views.py
  cat backend/apps/schedule/urls.py
  grep -n "connection\|request\|chat" backend/apps/chat/urls.py
```

---

## FEATURE 3: CONFERENCE MEMORY
```
WHAT: End-of-day personal recap — "Your ETD 2026 Day 1"
WHY: Retention, shareability, emotional connection to the event

DATA ALREADY EXISTS:
  CheckIn.objects.filter(user=user) → sessions attended
  SessionBookmark.objects.filter(user=user) → bookmarked sessions
  PointEntry.objects.filter(user=user) → all point actions with timestamps
  UserPoints.objects.get(user=user) → total + rank
  Photo.objects.filter(uploader=user) → photos uploaded
  Vote.objects.filter(user=user) → polls voted in
  IdeathonMember.objects.filter(user=user) → team membership

WHAT NEEDS BUILDING:

BACKEND — new endpoint:
  GET /api/v1/accounts/my-recap/?day=1
  OR  GET /api/v1/accounts/my-recap/  (auto-detects current conference day)
  
  Returns:
    day: 1|2|3
    sessions_attended: count (checkins on that day? or bookmarks)
    sessions_bookmarked: [{title, time, speaker}]
    points_earned_today: sum of PointEntry for that calendar date
    total_points: UserPoints.total_points
    rank: UserPoints.rank
    photos_uploaded: count
    polls_voted: count
    connections_made: count (PointEntry with action=NETWORKING)
    team: IdeathonTeam name if member
    highlight: string — auto-generated "You were in the top 10% today!"
    
  File: apps/accounts/views.py (add function)
  URL:  apps/accounts/urls.py (add path)

MOBILE — new RecapScreen.js:
  Location: mobile/src/screens/RecapScreen.js
  Navigation: subScreen 'recap' in MainApp.js
  Entry points:
    - Push notification at end of Day 1 and Day 2
    - HomeTab "My Recap" section (show if day has ended)
    - ProfileTab link
  
  UI: Vertical scroll of "achievement cards":
    🏆 Your rank card (animated number)
    ⚡ Points earned today
    📅 Sessions attended
    📸 Photos shared
    📊 Polls participated
    🤝 Connections made
    💡 Ideathon team (if applicable)
    
  Share button: text summary (no image generation needed)

WHAT TO CHECK FIRST:
  cat backend/apps/accounts/urls.py
  grep -n "created_at\|date" backend/apps/leaderboard/models.py
  grep -n "class Photo" backend/apps/photos/models.py
  cat mobile/src/screens/ProfileTab.js (to know where to add entry point)
```

---

## FEATURE 4: CONFERENCE PULSE
```
WHAT: Live stats widget on HomeTab — "Right now at ETD 2026"
WHY: Makes the app feel alive at all times

SCOPE (per user request — NO conversation count):
  ✅ Checked-in count
  ✅ Active live polls count
  ✅ Photos uploaded today
  ✅ Current leaderboard leader (name + points)
  ✅ Total registered participants

DATA ALREADY EXISTS — just needs aggregation:
  CheckIn.objects.filter(checkin_type='conference').count()
  Poll.objects.filter(status='live').count()
  Photo.objects.filter(created_at__date=today, status='approved').count()
  UserPoints.objects.order_by('-total_points').first()
  User.objects.filter(role='participant').count()

WHAT NEEDS BUILDING:

BACKEND — one new endpoint:
  GET /api/v1/conferences/pulse/   (public, no auth required)
  Returns:
    checked_in: int
    total_participants: int
    checkin_pct: int (percentage)
    live_polls: int
    photos_today: int
    top_scorer: { name: str, points: int }
    updated_at: ISO timestamp
  
  File: apps/conferences/views.py (add function)
  URL:  apps/conferences/urls.py (add path)
  
  Caching: use Redis to cache for 60s
    from django.core.cache import cache
    cache.get('conference_pulse') / cache.set('conference_pulse', data, 60)
    Redis already running on VM — just needs django-redis configured

MOBILE — new widget in HomeTab.js:
  Position: between Hero card and Quick Actions grid
  
  UI: Horizontal scroll of mini stat pills OR
      A single glass card with 2×2 mini stats grid
  
  Data fetch: added to existing fetchAll() in HomeTab
    fetch(`${API_URL}/conferences/pulse/`, { headers: API_HEADERS })
    No auth needed → raw fetch() is fine
  
  Refresh: already refreshes every 30s (fetchAll interval)
  
  Component: inline in HomeTab.js (no separate file needed)

WHAT TO CHECK FIRST:
  cat backend/apps/conferences/views.py
  cat backend/apps/conferences/urls.py
  grep -n "CACHES\|redis\|cache" backend/confhub/settings.py
  grep -n "fetchAll\|fetch.*pulse\|fetch.*conf" mobile/src/screens/HomeTab.js
```

---

## FEATURE 5: OFFLINE SCHEDULE
```
WHAT: Cache schedule in AsyncStorage so it works without network
WHY: 500 people on same WiFi = network drops during conference

DATA ALREADY EXISTS:
  ScheduleTab fetches all 3 days on mount
  AsyncStorage imported via cache.js

WHAT NEEDS BUILDING — MOBILE ONLY:

File: mobile/src/screens/ScheduleTab.js

Changes:
  1. On successful fetch → write to AsyncStorage:
       key: 'etd2026_schedule_day_{1|2|3}'
       value: JSON.stringify(sessions)
       also store: 'etd2026_schedule_cached_at': Date.now()

  2. On fetch failure OR on mount before fetch completes:
       read from AsyncStorage
       if cached data exists → use it
       show "Offline — showing cached schedule" banner

  3. Cache validity: 1 hour (3600000ms)
       if cached_at < now - 1hr → try fresh fetch anyway
       if fresh fetch fails → use stale cache

  4. Bookmark tab: bookmarks always fetched live (needs auth)
       if fetch fails + offline → show "Bookmarks need connection"

CODE PATTERN (reuse existing cache.js):
  import { getCache, setCache } from '../cache';
  // OR direct AsyncStorage if cache.js doesn't support TTL

WHAT TO CHECK FIRST:
  cat mobile/src/cache.js   ← see what helpers exist
  grep -n "AsyncStorage" mobile/src/screens/ScheduleTab.js
  grep -n "fetchDay\|fetchAll\|fetchBookmarks" mobile/src/screens/ScheduleTab.js


## Behaviour after this

| Situation | What happens |
|---|---|
| Good network | Fetch succeeds → write cache → no banner |
| Network drops mid-conference | Reads 1-hour cache → purple offline banner |
| Stale cache (>1hr) but network down | Still uses stale data (better than blank) |
| Bookmarks tab, no network | Yellow warning banner instead of empty list |
| Network comes back, pull-to-refresh | Fresh fetch → clears banner → updates cache |
```

---

## FEATURE 6: HAPTIC MOMENTS
```
WHAT: Vibration feedback at emotionally significant moments
WHY: expo-haptics already installed, costs 0 extra dependencies

expo-haptics IS ALREADY IN package.json (~15.0.8)
Just needs to be imported and called at the right places

HAPTIC EVENTS (in order of priority):
  1. Conference check-in success     → Haptics.notificationAsync(SUCCESS)
  2. Poll vote submitted             → Haptics.impactAsync(MEDIUM)
  3. Ideathon invite accepted        → Haptics.notificationAsync(SUCCESS)
  4. Leaderboard rank improved       → Haptics.notificationAsync(SUCCESS)
  5. Photo upload success            → Haptics.impactAsync(LIGHT)
  6. Meal pass generated             → Haptics.impactAsync(MEDIUM)
  7. Connection request accepted     → Haptics.notificationAsync(SUCCESS)
  8. Tab bar press (subtle)          → Haptics.selectionAsync()

import { ImpactFeedbackStyle, NotificationFeedbackType }
  from 'expo-haptics';

Haptics.impactAsync(ImpactFeedbackStyle.Medium)
Haptics.notificationAsync(NotificationFeedbackType.Success)
Haptics.selectionAsync()

FILES TO MODIFY:
  mobile/src/screens/PollsScreen.js    ← after vote success
  mobile/src/screens/CheckInScreen.js  ← after QR scan success (admin)
     OR QRScreen.js (user side check-in)
  mobile/src/screens/IdeathonScreen.js ← after invite accepted
  mobile/src/screens/PhotosScreen.js   ← after upload
  mobile/src/MainApp.js               ← tab bar press (selectionAsync)
  mobile/src/screens/admin/CheckInScreen.js ← scan success

NOTE: expo-haptics is no-op on web — safe to add everywhere

WHAT TO CHECK FIRST:
  cat mobile/src/screens/admin/CheckInScreen.js (find where success state is set)
  cat mobile/src/screens/QRScreen.js (user-facing QR)
  grep -n "success\|onVoted\|uploaded" mobile/src/screens/PollsScreen.js | head -10
  grep -n "success\|accept" mobile/src/screens/IdeathonScreen.js | head -10
```

---

## FEATURE 7: ADMIN MOBILE — POLLS + IDEATHON
```
WHAT: Admin can manage polls and ideathon from the mobile AdminTab
WHY: Admin shouldn't need a laptop to start a poll during a live session

CURRENT AdminTab.js FEATURES array (7 items):
  checkin, notifications, add_participant, users, schedule, leaderboard, photos

WHAT NEEDS BUILDING:

FILE 1: mobile/src/screens/admin/PollsAdmin.js
  Sections:
    A. Poll List
       - Shows all polls with status badges (LIVE/DRAFT/CLOSED)
       - Start button (draft → live)
       - Close button (live → closed)
       - View Results button
    
    B. Live Poll Monitor (when a poll is live)
       - Real-time result bars (poll every 10s)
       - Vote count
       - Participation %
       - Option ranking
    
    C. Create Poll (simplified — full create on web panel)
       - Title, question, type (single/yesno only on mobile)
       - Add 2-4 options
       - Start immediately toggle
       - Submit → creates draft → optionally starts
    
    API calls used:
       apiFetch('/polls/admin/list/')
       apiFetch('/polls/admin/<uuid>/action/', POST {action: 'start'|'close'})
       apiFetch('/polls/admin/<uuid>/results/')
       apiFetch('/polls/', POST to create)  ← check if create endpoint exists

FILE 2: mobile/src/screens/admin/IdeathonAdmin.js
  Sections:
    A. Registration Control
       - Toggle registration open/closed (with confirmation)
       - Show: N teams, N members
       - Show registration window times
    
    B. Team List
       - All registered teams with member count
       - Leader name highlighted
       - Project title if set
    
    C. Quick Actions
       - "Create Voting Poll" → calls backend → navigates to poll list
       - View live poll results if ideathon poll exists
    
    API calls used:
       apiFetch('/polls/ideathon/')
       apiFetch('/polls/ideathon/toggle/') ← need to check if this exists
                                             or needs to be created as API
       apiFetch('/polls/admin/list/') (filter is_ideathon=true)

CHANGES TO AdminTab.js:
  Add 2 new FEATURES entries:
    { key: 'polls_admin',    icon: 'stats-chart', label: 'Live Polls',
      sub: 'Manage polls & results', grad: [...] }
    { key: 'ideathon_admin', icon: 'bulb',         label: 'Ideathon',
      sub: 'Teams & voting',         grad: [...] }
  
  Add routes:
    if (screen === 'polls_admin')    return <PollsAdmin ... />
    if (screen === 'ideathon_admin') return <IdeathonAdmin ... />

NOTE: Ideathon registration toggle needs a new API endpoint:
  POST /api/v1/polls/ideathon/admin/toggle-registration/
  Because current toggle is only in the Django web panel view

WHAT TO CHECK FIRST:
  cat mobile/src/screens/admin/AdminTab.js  (full file)
  cat backend/apps/polls/urls.py            (what admin API routes exist)
  grep -n "toggle\|registration_open" backend/apps/polls/ideathon_views.py
  grep -n "def admin\|@api_view" backend/apps/polls/views.py
```

---

## BUILD ORDER FOR NEW CHAT
```
Recommended sequence (easiest to hardest, most impactful first):

1. HAPTICS          — 1 hour, zero risk, instant feel improvement
2. OFFLINE SCHEDULE — 2 hours, pure mobile, no backend
3. CONFERENCE PULSE — 3 hours, 1 API + 1 widget
4. ADMIN MOBILE     — 4 hours, 2 screens + 2 FEATURES entries
5. CONFERENCE MEMORY — 4 hours, 1 API + 1 screen
6. DISCOVERY GRAPH  — 4 hours, 1 API + NetworkScreen tab
7. SPEAKER CONNECT  — depends on Speaker↔User FK (check first)

DIAGNOSTIC COMMANDS FOR NEW CHAT:
  cat backend/apps/speakers/models.py
  cat backend/apps/conferences/views.py
  cat backend/apps/conferences/urls.py
  cat mobile/src/cache.js
  cat mobile/src/screens/admin/CheckInScreen.js
  grep -n "CACHES\|redis\|cache" backend/confhub/settings.py
  cat mobile/src/screens/admin/AdminTab.js
  cat backend/apps/polls/urls.py
```

---

## IMMUTABLE RULES FOR NEW CHAT
```
NEVER:
  - Downgrade Expo SDK
  - Add expo-router or React Navigation
  - Use TypeScript
  - Add new navigation abstraction
  - Use Firebase Admin SDK for push
  - Set Content-Type with FormData
  - Call hooks inside FlatList renderItem
  - Use raw fetch() with Bearer in setInterval
  - Add Docker
  - Use 'python' instead of 'python3'

ALWAYS:
  - apiFetch() for authenticated mobile calls
  - tokensRef.current inside setInterval callbacks
  - submitRef guard on all submit buttons
  - admin_required decorator on all /panel/ views
  - award_points via leaderboard/utils.py
  - push via fcm.py send_to_all/send_to_user
  - All templates extend "panel/base.html"
  - Speaker filename: SpokersScreen.js (intentional typo)
  - Login endpoint: /api/v1/auth/login/ (NOT /token/)
  - Diagnose before writing any code
  - Minimum correct diff — no boilerplate
```