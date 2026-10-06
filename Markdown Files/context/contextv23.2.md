# 🎯 ETD 2026 CONFERENCE APP — Complete Context Window (v23) — PART 2 of 2

---

## 🔔 PUSH NOTIFICATION SYSTEM (Expo Push API via IITD Proxy)

### Registration Flow (Standalone APK Only)
```
1. User logs in on phone
2. App.js calls registerForPushNotifications(tokenData.access)
3. notifications.js (with isExpoGo guard) calls:
   Notifications.getExpoPushTokenAsync({
     projectId: 'afa28d7e-10d5-4e85-bed4-783b7371a56b'
   })
4. Gets token like "ExponentPushToken[xxxxx...]"
5. POST to /api/v1/notifications/tokens/ (alias for register-token/)
6. Backend saves DeviceToken(user, token, platform, is_active=True)
```

### Sending Flow
```
1. Admin creates notification in web panel or via manage.py shell
2. fcm.py queries DeviceToken.objects.filter(is_active=True)
3. Matches tokens containing 'Expo' or 'Exponent'
4. Routes POST to https://exp.host/--/api/v2/push/send via IITD proxy
5. Expo delivers to Google FCM / Apple APNs → phone shows banner
```

### ⚠️ CRITICAL: Push in Expo Go vs Standalone APK
```
                        Expo Go (SDK 57)          Standalone APK (SDK 57)
Remote Push Register    ✗ Blocked by Google       ✓ Works 100%
Remote Push Receive     ✗ Blocked by Google       ✓ Works 100%
Local Notifications     ✓ Works                   ✓ Works
Reason: Expo removed FCM/APNs bindings from Expo Go in SDK 53+ per
        Google Play Store policy on shared push receivers.
```

### `src/notifications.js` — SDK 57 Lazy Require Pattern

**Why lazy require?** In Expo Go, top-level `import * as Notifications from 'expo-notifications'`
throws `warnOfExpoGoPushUsage` before any runtime guard can execute. Solution:
guard the `require()` itself.

```javascript
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import { apiFetch } from './api';

const EAS_PROJECT_ID = 'afa28d7e-10d5-4e85-bed4-783b7371a56b';

const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment?.StoreClient ||
  Constants.executionEnvironment === 'storeClient' ||
  Constants.appOwnership === 'expo';

let Notifications = null;

// ONLY load expo-notifications when NOT running in Expo Go
if (!isExpoGo) {
  try {
    Notifications = require('expo-notifications');
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        // ⚠️ shouldShowBanner + shouldShowList REMOVED in SDK 57
      }),
    });
  } catch (e) {}
}

export async function registerForPushNotificationsAsync() {
  if (isExpoGo || !Notifications) return null;
  // ... registration logic ...
}

export const registerForPushNotifications = registerForPushNotificationsAsync;

export function setupNotificationListeners(onReceived, onResponse) {
  if (isExpoGo || !Notifications) return () => {};
  // ... listener setup ...
}

export async function sendLocalNotification(title, body, data = {}) {
  if (isExpoGo || !Notifications) return;
  // ... local notification ...
}
```

### `apps/notifications/fcm.py` — Universal Push Helpers

**Critical**: `send_to_all` supports both `(notif)` and `(title, body, data, notif)` patterns.

```python
def send_to_tokens(tokens, title, body, data=None, img=None):
    """Direct token list dispatch"""

def send_to_all(*args, **kwargs):
    """
    Supports both:
    1) send_to_all(notif, request=None)
    2) send_to_all(title, body, data, notif, request=None)
    """

def send_to_role(role, title, body, data, notif=None, request=None):
    """Send to users filtered by role"""

def send_to_user(user, title, body, data=None, notif=None, request=None):
    """Single user push"""

def send_notification(notif, request=None):
    """Wrapper — dispatches based on notif.target_type"""

# Expo Push Delivery via IITD Proxy
def _send_expo(tokens, title, body, data, img=None):
    proxies = {
        'http': 'http://proxy21.iitd.ac.in:3128',
        'https': 'http://proxy21.iitd.ac.in:3128',
    }
    session = requests.Session()
    session.verify = False  # IITD SSL bypass
    import urllib3; urllib3.disable_warnings()
    resp = session.post(EXPO_URL, json=msgs, proxies=proxies, timeout=30)
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
```

### Terminal Push Test (Verified Working)
```bash
cd /home/baadalvm/eventapp/backend
python3 << 'EOF'
import os, django, json, urllib.request, ssl
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'confhub.settings')
django.setup()
from apps.notifications.models import DeviceToken

tokens = list(DeviceToken.objects.filter(is_active=True).values_list('token', flat=True))
messages = [{"to": t, "sound": "default", "title": "Test", "body": "..."} for t in tokens]

proxy = urllib.request.ProxyHandler({
    'http': 'http://proxy21.iitd.ac.in:3128',
    'https': 'http://proxy21.iitd.ac.in:3128'
})
ctx = ssl.create_default_context(); ctx.check_hostname=False; ctx.verify_mode=ssl.CERT_NONE
opener = urllib.request.build_opener(proxy, urllib.request.HTTPSHandler(context=ctx))
req = urllib.request.Request('https://exp.host/--/api/v2/push/send',
    data=json.dumps(messages).encode('utf-8'),
    headers={'Content-Type':'application/json','Accept':'application/json'})
print(json.loads(opener.open(req).read().decode('utf-8')))
EOF
```

---

## ⭐ MEAL PASS SYSTEM 2.0 (Named Categories + Full Automation)

### The Complete Picture
```
┌─────────────────────────────────────────────────────────────┐
│         SCHEDULE (Source of Truth: ScheduleSession)         │
│  is_meal=True + meal_category='Lunch/Dinner/High Tea/       │
│                                Breakfast'                    │
│  Or fallback: title contains lunch/dinner/breakfast/tea     │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  sync_meal_window()  (apps/checkins/meal_utils.py)          │
│  Uses zoneinfo.ZoneInfo("Asia/Kolkata") for IST             │
│                                                               │
│  Triggered by:                                              │
│  • Every GET /api/v1/notifications/unread-count/            │
│    (30s poll — runs across ENTIRE app, not just QR screen)  │
│  • Every GET /api/v1/checkins/meal/status/                  │
│  • Every GET /panel/checkins/meal-window-status/            │
│  • On session create/edit in ScheduleAdmin (web + mobile)   │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  MealWindow (date=today, meal_type=named category)          │
│                                                               │
│  Safe query pattern (prevents MultipleObjectsReturned):     │
│    MealWindow.objects.filter(date=today).order_by('-id')    │
│                       .first()                              │
│                                                               │
│  RULES:                                                      │
│  • Inside scheduled slot → is_open=True (opened_by=None)   │
│    + push "🍽️ [Lunch/Dinner/etc] is now open!" (once)      │
│  • Outside all slots + no manual hold → is_open=False      │
│    + push "🛑 [Category] service is now closed" (once)      │
│  • MANUAL admin toggle → sets opened_by=<user>              │
│    → sync respects and does NOT auto-close                   │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  PARTICIPANT CHECK-IN GATE                                   │
│  Only users with CheckIn(checkin_type='conference')          │
│  can call POST /api/v1/checkins/meal/generate/               │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  MealPass Generation (per named category)                    │
│  UUID-based, one active pass per user per meal_type per day  │
│  Users can hold Lunch + Dinner + High Tea passes same day    │
│  QR displays "Lunch Pass" / "Dinner Pass" / etc dynamically  │
└─────────────────────────────────────────────────────────────┘
```

### Meal API Endpoints
```
# Mobile
GET    /api/v1/checkins/meal/status/         → window + pass (with meal_type name)
POST   /api/v1/checkins/meal/generate/       → gated by check-in
POST   /api/v1/checkins/meal/scan/           → verify QR
POST   /api/v1/checkins/meal/window/         → toggle (action + meal_type)
POST   /api/v1/checkins/meal/push/           → re-broadcast push
GET    /api/v1/checkins/meal/stats/
GET    /api/v1/checkins/meal/list/
POST   /api/v1/checkins/meal-pass/create/    → walk-in guest + email QR
GET    /api/v1/checkins/meal-pass/mine/

# Web Admin
GET    /panel/checkins/scanner/              → scanner page
GET    /panel/checkins/meal-window-status/   → AJAX {meal:{...}}
POST   /panel/checkins/meal/window/          → AJAX toggle (action + meal_type)
POST   /panel/checkins/meal/push/            → re-broadcast push
POST   /panel/checkins/meal/scan/            → AJAX scan
POST   /panel/checkins/meal-pass/            → walk-in guest pass
GET    /panel/checkins/stats/
```

---

## 📰 FEED SYSTEM (Full Mobile Admin CRUD)

### Backend API Endpoints (`/api/v1/posts/`)
```
# Public / Participant
GET  /posts/feed/                                → paginated feed
POST /posts/feed/<uuid>/react/                   → toggle reaction
GET  /posts/feed/<uuid>/comments/                → list comments
POST /posts/feed/<uuid>/comments/                → add comment/reply

# Admin API (super_admin, mgmt_admin, team_head, staff)
GET    /posts/admin/feed/                        → list ALL posts
POST   /posts/admin/feed/                        → create (multipart/form-data)
PATCH  /posts/admin/feed/<uuid>/                 → edit (partial fields)
DELETE /posts/admin/feed/<uuid>/                 → hard delete
GET    /posts/admin/feed/<uuid>/comments/        → list flattened comments
DELETE /posts/admin/feed/<uuid>/comments/<uuid>/ → moderate/delete comment
```

### Create Post Payload (multipart/form-data)
```
title           str  (required)
body            str  (required)
post_type       str  (general | alert | announcement | update)
pinned          bool
allow_comments  bool
send_push       bool  ← immediately dispatches Expo push
image           File  ← accepts JPEG, PNG, MP4, MOV, M4V
```

### FeedScreen.js — Video Support (SDK 57)
```javascript
// ⭐ Uses expo-video (NOT expo-av which was removed in SDK 57)
import { useVideoPlayer, VideoView } from 'expo-video';

// Video detection
const isVideo = item.image_url?.match(/\.(mp4|mov|m4v)$/i);

// Thumbnail: uses <Image> for FlatList performance (video first-frame won't render with autoplay off)
<Image source={{ uri: item.image_url.replace(/\.(mp4|mov|m4v)$/i, ".jpg") }} />

// Full-screen viewer: useVideoPlayer hook + VideoView component
const fullMediaPlayer = useVideoPlayer(
  fullMedia?.isVideo ? fullMedia.url : null,
  player => { if (player) { player.loop = false; player.play(); } }
);
<VideoView player={fullMediaPlayer} nativeControls allowsFullscreen />
```

---

## 📅 SCHEDULE MANAGEMENT (is_meal + meal_category)

### Model
```python
# apps/schedule/models.py
class ScheduleSession(models.Model):
    # ... existing fields ...
    is_meal         = BooleanField(default=False)
    meal_category   = CharField(max_length=50, blank=True)
    
    class Meta:
        ordering = ['day', 'start_datetime', 'display_order']
```

### Web Admin (`schedule_form.html`)
```html
<label>
  <input type="checkbox" name="is_meal" id="is_meal_check"
         onchange="toggleMealCategory()">
  🍽️ Is Meal Service?
</label>

<div id="meal_category_div" style="display:none;">
  <select name="meal_category">
    <option value="Lunch">Lunch</option>
    <option value="Dinner">Dinner</option>
    <option value="High Tea">High Tea</option>
    <option value="Breakfast">Breakfast</option>
  </select>
</div>

{% block scripts %}
<script>
  function toggleMealCategory() { ... }
  {% if mode == 'edit' %}
    // edit-mode JS
  {% endif %}
</script>
{% endblock %}
```

### Mobile Admin (`admin/ScheduleAdmin.js`)
```javascript
const MEAL_CATEGORIES = [
  { value: 'Lunch', label: 'Lunch' },
  { value: 'Dinner', label: 'Dinner' },
  { value: 'High Tea', label: 'High Tea' },
  { value: 'Breakfast', label: 'Breakfast' },
];
```

### Session Create/Edit Sync
```python
def session_create(request):
    if request.method == 'POST':
        sess = ScheduleSession.objects.create(...)
        try:
            sync_meal_window()  # Immediate meal window evaluation
        except Exception:
            pass
        return redirect('schedule_edit', pk=sess.pk)
```

---

## 🏠 HOME TAB LOGIC (Day Calc from Live Sessions)

### The Bug We Fixed
Old logic: `confDay(conf.start_date)` was hardcoded from `conf.start_date`,
causing "Day 19 of 3" glitch after schedule date migration.

### New Logic (`HomeTab.js`)
```javascript
// Derive current day + progress from LIVE schedule sessions
const firstSession = allSorted[0];
const lastSession = allSorted[allSorted.length - 1];

const confStartMs = firstSession ? getEventDate(firstSession, 'start')?.getTime() : ...;
const confEndMs = lastSession ? getEventDate(lastSession, 'end')?.getTime() : ...;

const total = Math.max(...allSorted.map(e => Number(e.day) || 1));

// Active day = day of live session, OR day of next upcoming session
const activeDayIndex = liveSession ? Number(liveSession.day)
                     : nextSession ? Number(nextSession.day)
                     : (nowMs >= confEndMs ? total : 1);

// Progress bar mode when live session is happening (not countdown)
if (liveSession) {
  mode = 'progress';
  progress = Math.round(((nowMs - confStartMs) / (confEndMs - confStartMs)) * 100);
}
```

### Progress/Countdown Logic
```
Phase 1: Now < Conf_Start          → mode='countdown', target=first_session_start
Phase 2: Conf_Start ≤ Now ≤ Conf_End
         ├─ liveSession exists     → mode='progress'
         ├─ nextSession same day   → mode='countdown', target=next_session_start
         └─ nextSession next day   → mode='countdown', target=next_day_first_session
Phase 3: Now > Conf_End            → mode='progress', progress=100%
```

---

## 👤 PROFILE SYSTEM v23 (⭐ NEW OVERHAUL)

### What Was Fixed
1. **Research Interests Mandatory (Min 3, Max 5)**
   - `User` model gained `research_interests` JSONField (default `[]`)
   - `EditProfileScreen.js` enforces min 3, max 5 tags via chip-picker UI
   - `ProfileTab.js` shows amber banner if user has < 3 interests + auto-navigates to EditProfile
2. **Profile Completion Score — Real Math**
   - Old bug: entering 1 char in Bio marked profile "100% complete"
   - New logic weights each field with quality thresholds:
     ```
     Profile Photo (uploaded)      = 20 pts
     Bio (≥ 40 chars, not just "hi") = 15 pts
     Job Title + Organization      = 15 pts
     Research Interests (≥ 3 tags) = 20 pts
     LinkedIn URL (valid pattern)  = 10 pts
     Website / GitHub / Scholar    = 10 pts
     Phone Number (valid pattern)  = 10 pts
     ─────────────────────────────────────
     TOTAL                          = 100 pts
     ```
   - Uses `Math.min(100, Math.max(0, sum))` clamp for safety
3. **Removed Dead Links**
   - Purged all "Coming Soon" placeholder rows from `ProfileTab.js`
   - Removed non-wired social buttons that led nowhere
   - Only kept: Edit Profile, Change Password, My Recap, Certificate, Logout
4. **My Recap (Conference Memory) Rewrite**
   - `RecapScreen.js` now pulls from real sources:
     ```
     Points Earned      → UserPoints.total (leaderboard app)
     Sessions Attended  → CheckIn.count where checkin_type='session'
     Meals Redeemed     → MealPass.count where used=True
     Selfies Uploaded   → SelfieSubmission.count where user=me
     Connections Made   → ConnectionRequest.count where status='accepted' + user in (from,to)
     Chats Sent         → Message.count where sender=me
     Polls Participated → Vote.count where user=me
     Ideathon Team      → IdeathonTeam where member=me
     ```
   - Added `/api/v1/leaderboard/recap/` endpoint returning aggregated JSON
   - Cache via `cache.js` with 2-min TTL
5. **Certificate — Kept & Enhanced**
   - Only visible when user has `CheckIn(checkin_type='conference')`
   - Renders a PDF-style card using `react-native-svg` with QR code proof
   - Long-press to share (via native `Share` from `react-native`)
6. **UI Polish with Reanimated**
   - Profile hero card: `useAnimatedStyle` + `withSpring` for enter animation
   - Completion ring: animated SVG stroke-dashoffset with `withTiming`
   - Chip pickers: `Layout` animation for add/remove smoothness
   - Stat cards on Recap: staggered `FadeInUp.delay(index * 80)`

### Profile API Changes
```
GET    /api/v1/auth/me/                → includes research_interests[]
PATCH  /api/v1/auth/me/                → validates 3 ≤ len(research_interests) ≤ 5
GET    /api/v1/leaderboard/recap/      → aggregated stats JSON
```

---

## 📅 SCHEDULE TAB (Auto-Refresh + Dates)

`mobile/src/screens/ScheduleTab.js`:
```javascript
const TABS = [
  { key: 1, label: 'Day 1', date: 'Sep 18' },
  { key: 2, label: 'Day 2', date: 'Sep 19' },
  { key: 3, label: 'Day 3', date: 'Sep 20' },
  { key: 'bookmarks', label: '❤️', date: 'Saved' },
];

// Auto-refresh every 20s + pull-to-refresh
useEffect(() => {
  seedFromCache().then(() => fetchAll(true));
  const timer = setInterval(() => fetchAll(true), 20000);
  return () => clearInterval(timer);
}, [seedFromCache, fetchAll]);

// ⚠️ DO NOT USE useFocusEffect from @react-navigation/native
//    This app does NOT use React Navigation. Import will fail bundle.
```

---

## 🛠️ SCHEDULE DATE MIGRATION HELPER

For quickly rebasing all sessions to test dates without wiping DB:

### `backend/update_schedule_dates.py`
```python
import os, sys, django
from datetime import date
sys.path.append('/home/baadalvm/eventapp/backend')
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "confhub.settings")
django.setup()

from apps.schedule.models import ScheduleSession
from apps.checkins.meal_utils import sync_meal_window

date_mapping = {
    1: date(2026, 9, 18),
    2: date(2026, 9, 19),
    3: date(2026, 9, 20),
}

for session in ScheduleSession.objects.all():
    day_num = int(session.day)
    if day_num in date_mapping:
        target = date_mapping[day_num]
        if session.start_datetime:
            session.start_datetime = session.start_datetime.replace(
                year=target.year, month=target.month, day=target.day)
        if session.end_datetime:
            session.end_datetime = session.end_datetime.replace(
                year=target.year, month=target.month, day=target.day)
        session.save()

sync_meal_window()
```

Run: `cd backend && python3 update_schedule_dates.py`

---

## 🎨 theme.js — DESIGN TOKENS

```javascript
import { Platform, Dimensions } from 'react-native';

export const W = Dimensions.get('window').width;
export const H = Dimensions.get('window').height;

export const COLORS = {
  brand: '#0333b6', brandDark: '#022a8f', brandDeep: '#0F172A',
  brandDeeper: '#070614', brandLight: '#e8eeff', brandMid: 'rgba(3,51,182,0.10)',
  primary: '#0333b6', primaryLight: '#e8eeff',
  danger: '#ef4444', accent: '#f59e0b', accentDark: '#d97706',
  accentLight: '#fef3c7', accentMid: 'rgba(245,158,11,0.15)',
  bg: '#f0f4f9', bgAlt: '#eef2f6', bgCard: '#e6ebf5',
  surface: '#FFFFFF', glass: 'rgba(255,255,255,0.14)',
  glassBorder: 'rgba(255,255,255,0.22)',
  success: '#10b981', successLight: '#d1fae5',
  error: '#ef4444', errorLight: '#fee2e2',
  warning: '#f59e0b', warningLight: '#fef3c7',
  purple: '#8b5cf6', purpleLight: '#ede9fe',
  teal: '#14b8a6', tealLight: '#ccfbf1',
  rose: '#f43f5e', roseLight: '#ffe4e6',
  text: '#0F172A', textSec: '#475569', textTer: '#94a3b8',
  textInverse: '#FFFFFF', textMuted: '#cbd5e1',
  border: '#e2e8f0', borderLight: '#f1f5f9', textblack: '#000',
};

// FONT is FLAT (not nested)
export const FONT = {
  micro: 9, xs: 11, sm: 13, base: 15, md: 16,
  lg: 18, xl: 22, xxl: 26, xxxl: 32, hero: 40,
  w4: '400', w5: '500', w6: '600', w7: '700', w8: '800', w9: '900',
};

export const SPACE = {
  xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, huge: 48,
};

export const RADIUS = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, xxxl: 36, full: 999,
};

export const SHADOW = { none:{}, sm:..., md:..., lg:..., xl:..., brand:..., accent:... };

// Auto-switching API URL
const DEV_API_URL  = 'http://10.17.9.48:8000/api/v1';
const PROD_API_URL = 'https://etd2026.iitd.ac.in/api/v1';
export const API_URL  = __DEV__ ? DEV_API_URL : PROD_API_URL;
export const API_ROOT = API_URL.replace(/\/api\/v1$/, '');

export const API_HEADERS = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
};
```

⚠️ NEVER write `FONT.size.lg` — FONT is flat.
⚠️ NEVER write `COLORS.warning-dark` — JS reads as subtraction.

---

## 🏠 HOME TAB QUICK ACTIONS

```javascript
const QUICK_ITEMS = [
  { label: 'Speakers',        action: 'speakers'    },
  { label: 'Leaderboard',     action: 'leaderboard' },
  { label: 'Papers/Posters',  action: 'papers'      },
  { label: 'Sponsors',        action: 'sponsors'    },
  { label: 'Checkpoint',      action: 'checkpoint'  },
  { label: 'Live Polls',      action: 'polls'       },
  { label: 'Ideathon',        action: 'ideathon'    },
  { label: 'Events Team',     action: 'staff_team'  },
  { label: 'Photo Gallery',   action: 'photos'      },
];
```

State: `const [tab, setTab] = useState('home')` — use `setTab('schedule')`
(NOT `setActiveTab`, which doesn't exist).

---

## 🎛️ MOBILE ADMIN TAB (10 Feature Cards)

```javascript
const ALL_FEATURES = [
  { key: 'checkin',          perm: 'checkin_scanner' },
  { key: 'notifications',    perm: 'notifications'   },
  { key: 'feed_admin',       perm: 'feed'            },
  { key: 'add_participant',  perm: 'users_manage'    },
  { key: 'users',            perm: 'users_manage'    },
  { key: 'staff_admin',      perm: 'users_manage'    },
  { key: 'schedule',         perm: 'schedule'        },
  { key: 'photos',           perm: 'photos'          },
  { key: 'polls_admin',      perm: 'polls'           },
  { key: 'papers',           perm: 'papers'          },
  { key: 'ideathon_admin',   perm: 'ideathon'        },
];
```

**⚠️ CRITICAL:** Every feature object MUST have `grad: ['#hex1', '#hex2']`
(2-color gradient array). Missing `grad` causes LinearGradient crash.

---

## ⚠️ CRITICAL PATTERNS — DO NOT BREAK

### Apache / Reverse Proxy
```
✓ ALWAYS run `apache2ctl configtest` before reload
✓ ALWAYS use `systemctl reload apache2` (not restart)
✓ ALWAYS keep wordpress.conf.bak for instant rollback
✓ ALWAYS pass X-Forwarded-Proto "https"
✓ ALWAYS use ProxyPreserveHost On
✗ NEVER edit /etc/ssl/* — SSL is at IITD Central Gateway
✗ NEVER prefix admin_urls.py routes with 'panel/'
```

### Backend (Django)
```
✗ NEVER expect Gunicorn to hot-reload — always restart
✗ NEVER set CONN_MAX_AGE > 0 under Uvicorn workers
✗ NEVER re-enable ROTATE_REFRESH_TOKENS without single-flight mutex
✗ NEVER add 'channels' twice to INSTALLED_APPS
✗ NEVER use Firebase Admin SDK — Expo Push API only
✗ NEVER pass delivered_at to Notification.objects.create()
✗ NEVER use `MealWindow.objects.get_or_create(date=today)`
   — throws MultipleObjectsReturned. Use .filter(date=today).order_by('-id').first()
✗ NEVER call fcm.send_to_all(notif) with only 1 positional arg unless
  the dispatcher supports it
✗ NEVER prefix admin_urls.py routes with 'panel/'
✗ NEVER use `python` — this VM has `python3`
✗ NEVER use `created_at` on CheckIn model — it's `scanned_at`
✗ NEVER put `{% block scripts %}` twice in if/else — Django error
✗ NEVER call fcm.send_to_tokens without defining it — must exist in fcm.py

✓ ALWAYS use timezone.now().astimezone(IST) for meal logic
✓ ALWAYS return {"success": true/false} for mobile API
✓ ALWAYS trigger sync_meal_window() in schedule create/edit endpoints
✓ ALWAYS include sync_meal_window() in unread_count for 30s poll
✓ ALWAYS check is_checked_in before allowing meal pass generation
✓ ALWAYS restart gunicorn after .py changes
✓ ALWAYS cd into backend/ before Django commands
✓ ALWAYS route outbound HTTP through proxy21.iitd.ac.in:3128
✓ ALWAYS use `python3 << 'EOF'` (single quotes) for JS/HTML heredocs
```

### Templates
```
✓ Everything extends "panel/base.html"
✓ DIRS = [BASE_DIR / 'templates'] → backend/templates/
✓ Chat templates live in templates/panel/chat/
✓ Every sidebar item is permission-wrapped
✗ Never add |safe to user-supplied values
✗ Never put content into {% block title %} beyond the title itself
✗ Never put {% block scripts %} inside a raw {% if %}/{% else %} —
  wrap the {% if %} INSIDE a single {% block scripts %}
```

### Mobile — Expo SDK 57 Specifics
```
✗ Never downgrade Expo SDK (locked at 57)
✗ Never re-add expo-av (use expo-video)
✗ Never re-add expo-dev-client (adds 35MB, unused)
✗ Never re-add @types/react or typescript (JS project)
✗ Never add expo-router / React Navigation / TypeScript
✗ Never import from @react-navigation/native — NOT INSTALLED
✗ Never use react-native Clipboard — use expo-clipboard
✗ Never use Camera class — use CameraView from expo-camera
✗ Never use <Video> from expo-av — use useVideoPlayer + VideoView from expo-video
✗ Never top-level import expo-notifications in code that runs in Expo Go —
  use lazy require() with isExpoGo guard
✗ Never set shouldShowBanner/shouldShowList — removed in SDK 57
✗ Never omit projectId when calling getExpoPushTokenAsync()
✗ Never require @expo/config-plugins as dependency — use 'expo/config-plugins' sub-export
✗ Never leave setLayoutAnimationEnabledExperimental unguarded — check
  !global.nativeFabricUIManager before calling
✗ Never run expo from root dir (always cd mobile/)
✗ Never call hooks inside FlatList renderItem
✗ Never set Content-Type manually with FormData
✗ Never write FONT.size.lg — FONT is FLAT
✗ Never write COLORS.warning-dark
✗ Never nest FlatList in same-direction ScrollView
✗ Never reference `setActiveTab` — the state variable is `tab`/`setTab`
✗ Never omit `grad: ['#a', '#b']` from ALL_FEATURES entries
✗ Never use unescaped apostrophes in JSX single-quoted strings

✓ apiFetch() for authenticated calls (auto JWT refresh)
✓ For checkins/meal endpoints: raw fetch + authHeaders(tokens) pattern
✓ QRCodeSVG: guard with String(value || 'ETD-2026')
✓ FlatList keyExtractor: (item, idx) fallback
✓ Always import Platform from 'react-native' if using Platform.OS
✓ Use __DEV__ ternary to switch API URLs automatically
✓ Use BackHandler subscription pattern
✓ Use LayoutAnimation.configureNext(...) for smooth accordion expand
✓ Always safe-fallback filter arrays: (ARR || []).filter(...)
✓ Pass projectId to getExpoPushTokenAsync() to prevent 30s hang
✓ For PDF/document upload: expo-document-picker (type: [...] array)
✓ For image/video upload: expo-image-picker (result.assets[0].uri pattern)
✓ For animation polish: react-native-reanimated v4 (already installed)
✓ For auto-refresh: setInterval in useEffect with cleanup
✓ For pull-to-refresh: <RefreshControl refreshing={r} onRefresh={fn} />
```

### IITD Proxy
```
✗ No ngrok / cloudflared / tunnels
✗ Large file uploads (>50MB) to external cloud will be blocked
✓ npm: NODE_TLS_REJECT_UNAUTHORIZED=0 <cmd> --strict-ssl=false
✓ pip: --break-system-packages
✓ curl to VM: --noproxy "*"
✓ curl to public HTTPS domain: -k
✓ Python to VM: build_opener(ProxyHandler({}))
✓ Expo Push: routes through proxy with verify=False
✓ Git push: unset GIT_ASKPASS if VS Code SSH left broken socket
```

### APK Build (EAS Cloud)
```
✗ NEVER use --local flag (causes OOM on VM)
✗ NEVER skip git commit — eas-cli packages tracked files only
✓ ALWAYS clean android/ ios/ .expo/ dist/ before cloud build (upload <5MB)
✓ ALWAYS commit new logo assets (adaptive-icon.png MUST match icon.png)
✓ ALWAYS use eas-cli via npx (not global install)
✓ Preview profile outputs .apk (~25-35MB with ProGuard/R8)
✓ Production profile outputs .aab
✓ Uninstall old app before installing new APK to clear icon launcher cache
✓ EAS Cloud free tier: 30 builds/month
```

### Bash / Shell Scripting
```
✗ NEVER use `python3 -c "..."` with double quotes for JS/HTML content
✓ Use single-quoted heredoc: python3 << 'EOF' ... EOF
✓ For simple sed replacements: sed -i 's|old|new|g' file
✓ Always verify with `grep -n` after mutation
✓ Never edit the same file twice with regex — check for duplicate insertions
```

### Cron / Server Auto-Healing
```
✗ NEVER assume cron has full PATH — export PATH explicitly in scripts
✗ NEVER use plain `gunicorn` in cron — use full path or export PATH
✓ ALWAYS test with: pkill -9 -f gunicorn && sleep 60 && ps aux | grep gunicorn
  (should show gunicorn back up)
✓ ALWAYS include @reboot entry for reboot recovery
✓ ALWAYS log to server.log so you can trace auto-restarts
```

---

## ✅ WHAT IS WORKING (COMPLETE)

```
✅ JWT Auth (access + refresh, no rotation)
✅ Email login, password reset via IITD SMTP
✅ Role-based access (7 roles, 22 modules incl. papers + feed)
✅ Web admin panel (Django MVT, permission-gated sidebar, clean CSS)
✅ Participant management (CSV upload, add/edit/preview)
✅ Conference settings
✅ Schedule management (CRUD + is_meal + meal_category + session types + rooms)
✅ Speaker + Sponsor management
✅ Photo gallery (upload + approval + selfie points)
✅ Polls (create/vote/results)
✅ Leaderboard (point system)
✅ Push notifications (Expo Push via IITD proxy — VERIFIED DELIVERING)
✅ Deep-link routing from notifications
✅ Chat (1:1 + connection requests + reactions + reports)
✅ Staff group chat
✅ Shake-to-connect
✅ Feed/posts (full CRUD, videos, comment moderation, push on create)
✅ Checkpoint/selfie submissions (Google Maps via Leaflet WebView)
✅ QR generation + scanning (check-in + meal passes)
✅ Meal Pass System 2.0 (schedule-driven, IST-aware, manual override,
   push on state changes, check-in gated, walk-in guest email,
   named categories, dynamic naming, 30s background sync,
   real-time web scanner, Send Push button)
✅ Home Tab: Day calc from live sessions (fixed "Day 19 of 3" glitch)
✅ Home Tab countdown/progress + 3D tilt hero + dynamic venue
✅ QR Screen: Dynamic "Lunch Pass"/"Dinner Pass"/etc labels
✅ QR Screen with participant photo + kit card + meal card
✅ Ideathon System: interest, team CRUD, invites, join requests,
   leadership transfer, admin CRUD from mobile
✅ Papers/Posters System: full CRUD + PDF upload + search + download
✅ Schedule Tab: Sep 18/19/20 dates, 20s auto-refresh, pull-to-refresh
✅ Public HTTPS domain: https://etd2026.iitd.ac.in
✅ Apache reverse proxy: WordPress + Django coexist, zero conflicts
✅ Auto DEV/PROD API switching in mobile app
✅ Zero-downtime Apache reloads with configtest safety
✅ Emergency 10-second rollback via wordpress.conf.bak
✅ Live Admin Dashboard (real metrics from PostgreSQL)
✅ Google Maps tiles in web admin + mobile app (no API keys)
✅ Dynamic radius resizing for selfie spot picker
✅ Mobile CheckpointScreen UX polish (smooth drawer, hardware back)
✅ Staff Management web sidebar link restored
✅ Clean staff_permissions.html template
✅ Android SSL certificate bundling (GlobalSign R46 in APK)
✅ Push token registration (tokens/ alias + EAS projectId)
✅ Login <1 second (non-blocking push registration)
✅ APK builds via EAS Cloud (~25-35MB with ProGuard/R8 + webrtc + dev-client removed)
✅ App icon and splash screen from etdLogo.jpg
✅ Cron Watchdog (@reboot + every 60s): Auto-restarts Gunicorn if dead
✅ PATH Export in start_server.sh and keep_alive.sh
✅ Schedule Date Migration Script: update_schedule_dates.py
✅ FCM Dispatchers: send_to_all, send_to_role, send_to_user, send_to_tokens
✅ Notifications Views: register_token, unregister_token, mark_read, etc.

⭐ NEW IN v23 (SDK 57 UPGRADE):
✅ Expo SDK 54 → 57 (full upgrade complete)
✅ React Native 0.76 → 0.86.3 (New Architecture / Fabric enabled)
✅ Babel preset upgraded to SDK 57
✅ Purged 16 unused packages (~40MB reduction)
✅ Added expo-video (replaces expo-av)
✅ Added expo-clipboard (replaces removed RN Clipboard)
✅ Added expo-font (peer dep of vector-icons)
✅ Added expo-splash-screen (SDK 57 config plugin)
✅ Added buffer (needed by react-native-svg)
✅ Added @expo/vector-icons as explicit dep
✅ withNetworkSecurity.js uses 'expo/config-plugins' sub-export
✅ SDK 57 notification handler (removed deprecated shouldShowBanner/List)
✅ Lazy require pattern for expo-notifications in Expo Go
✅ Expo Go crash-free launch on SDK 57
✅ Expo Push tokens generating on APK login
✅ ProGuard/R8 shrinking: ~100MB → ~25-35MB APK
✅ Chrome sandbox workaround: EXPO_NO_DEVTOOLS=1 for VM Metro
✅ FeedScreen video playback via useVideoPlayer + VideoView
✅ ChatRoomScreen clipboard via Clipboard.setStringAsync
✅ Profile System v23 Overhaul:
   • research_interests JSONField with 3-5 tag enforcement
   • Weighted profile completion score (real math)
   • Removed all dead/coming-soon links
   • RecapScreen pulls real stats via /api/v1/leaderboard/recap/
   • Certificate section retained, gated by check-in
   • Reanimated v4 polish (spring animations, staggered fade)
```

## ❌ WHAT IS NEXT / PENDING

```
❌ iOS EAS Development Build
❌ systemd unit for start_server.sh (currently nohup + cron watchdog)
❌ Home Tab "Conference Pulse" live stats widget
❌ Speaker Connect post-session banner
❌ Sponsor stall live foot-traffic heatmap
❌ Post-approval celebration modal with confetti
❌ Per-user push on selfie point approval
❌ Per-module auto-groups for staff chat
❌ Force password change on first login for staff
❌ Single-flight refresh mutex in api.js (re-enable JWT rotation)
❌ Assign meal passes to registered users from mobile admin
❌ Time picker for meal schedule on mobile
❌ Production AAB build + Play Store submission
❌ Nginx caching layer (optional — Apache handles fine)
❌ NEW FEATURES (to be discussed)
```

---

## 🤝 WORKING AGREEMENT

```
Cycle: diagnose → ASK FOR EXISTING CODE if unsure → assess →
       generate code → deliver → if error → get error → assess → repeat

You are a lazy senior developer. Lazy means efficient, not careless.
The best code is the code never written.

Before writing any code, stop at the first rung that holds:
  1. Does this need to be built at all? (YAGNI)
  2. Does it already exist in this codebase? Reuse.
  3. Does the standard library already do this? Use it.
  4. Does a native platform feature cover it? Use it.
  5. Does an already-installed dependency solve it? Use it.
  6. Can this be one line? Make it one line.
  7. Only then: write the minimum code that works.

Rules:
  • ALWAYS ask for existing code before changes to unknown files
  • ALWAYS run: cat/grep/head to inspect BEFORE modifying
  • YAGNI first. Reuse existing helpers. stdlib > installed dep > new code
  • Deletion over addition. Boring over clever. Shortest working diff
  • Bug fix = root cause, not symptom (grep every caller, fix once)
  • No new dependency if avoidable
  • No abstractions not requested
  • Fewest files possible
  • Mark deliberate simplifications with ceiling comment
  • Non-trivial logic leaves ONE runnable check behind (assert-based
    demo/self-check or one small test file; no frameworks)
  • Give code in `cat << 'EOF' > path` or `python3 << 'EOF'` heredoc blocks
  • Always include restart command for backend changes
  • For Apache changes: configtest → reload (never restart)
  • Assume Website VM = 10.17.5.38, App VM = 10.17.9.48
  • Mobile file changes: ONLY /home/baadalvm/eventapp/mobile/src/
  • For JS edits via Python: always use `python3 << 'EOF'` (single quotes)
  • For every feature array entry (mobile), ensure ALL required props
    (grad, perm, key, icon, label) are present to prevent runtime crashes
  • NEVER suggest --local EAS builds (OOM risk). Always use cloud builds.
  • ALWAYS clean android/ ios/ .expo/ before cloud build to keep upload <5MB
  • ALWAYS commit to Git BEFORE eas build — packages tracked files only
  • For Django ScheduleSession changes: run migrations AND restart Gunicorn
  • For MealWindow queries: always use .filter().order_by('-id').first()
  • For cron scripts: always export PATH explicitly
  • For fcm.py updates: verify send_to_tokens + send_to_user exist

Not lazy about: understanding the problem, input validation at trust
boundaries, error handling that prevents data loss, security,
accessibility, calibration real hardware needs, anything explicitly
requested. Lazy code without its check is unfinished.
```

---

## 🔧 QUICK TROUBLESHOOTING REFERENCE

### "Delivered: 0, Status: failed" on push
- Check `apps/notifications/fcm.py` has `send_to_tokens`, `send_to_all`,
  `send_to_role`, `send_to_user`, `send_notification` — all 5 must exist.
- Verify `send_to_all` accepts both `(notif)` and `(title, body, data, notif)`.

### "cannot import name 'X' from 'apps.notifications.views'"
- `views.py` must export: `unread_count`, `my_notifications`, `register_token`,
  `register_device_token`, `unregister_token`, `mark_read`, `mark_all_read`,
  `send_notification`, `notification_history`, `notification_detail`.

### "MealWindow.MultipleObjectsReturned"
- Replace `.get_or_create(date=today)` with `.filter(date=today).order_by('-id').first()`
- Clean duplicates: `MealWindow.objects.filter(date=today).order_by('id')[:-1].delete()`

### Push notification arrives only when opening QR Screen
- Verify `apps/notifications/views.py::unread_count` calls `sync_meal_window()`.
- Verify mobile app polls `/notifications/unread-count/` every 30s globally.

### "Cannot resolve @react-navigation/native"
- Remove `import { useFocusEffect } from '@react-navigation/native';`
- Use `useEffect(() => { const t = setInterval(...); return () => clearInterval(t); }, [])`

### Cron watchdog logs "gunicorn: not found"
- Add `export PATH="/home/baadalvm/.local/bin:..."` at top of both
  `start_server.sh` and `keep_alive.sh`.

### `{% block 'scripts' %}` appears more than once
- Move `{% if mode == 'edit' %}` INSIDE the `{% block scripts %}` tag.

### Expo Go red screen: "PlatformConstants could not be found"
- react-native version mismatch. Run: `npx expo install --fix`
- Ensure `react-native@0.86.3` matches SDK 57.

### Expo Go red screen: "expo-notifications was removed from Expo Go"
- Ensure `src/notifications.js` uses lazy `require('expo-notifications')`
  inside `if (!isExpoGo)` block, NOT top-level import.

### Metro bundler crash: "Cannot find module 'hermes-compiler/package.json'"
- Run `npx expo export --no-bytecode` for local testing.
- EAS Cloud uses its own bundled hermesc — not affected.

### Metro bundler: "Unable to resolve module @expo/vector-icons"
- Install: `NODE_TLS_REJECT_UNAUTHORIZED=0 npx expo install @expo/vector-icons`

### Metro bundler: "Unable to resolve module buffer"
- Install: `NODE_TLS_REJECT_UNAUTHORIZED=0 npm install buffer --strict-ssl=false --legacy-peer-deps`

### Metro bundler: "Cannot find module '@expo/config-plugins'"
- In `plugins/withNetworkSecurity.js`, change:
  `require('@expo/config-plugins')` → `require('expo/config-plugins')`

### Metro bundler: Babel codegen error "onModeChange"
- `babel-preset-expo` out of date. Run: `npx expo install babel-preset-expo --fix`

### Expo doctor "should NOT have additional property 'splash'"
- Move `splash` from root of `app.json` to `plugins: [['expo-splash-screen', {...}]]`

### Expo doctor "should NOT have additional property 'edgeToEdgeEnabled'"
- Remove `edgeToEdgeEnabled` from `android` — default in RN 0.79+.

### Chrome sandbox error on Metro start
- Use `EXPO_NO_DEVTOOLS=1 npx expo start --lan --port 8081`

### APK shows old logo after rebuild
- `adaptive-icon.png` was not updated to match new `icon.png`
- Run: `cp -f icon.png adaptive-icon.png` in `mobile/assets/`
- UNINSTALL old app from phone before installing new APK (clears launcher cache)

### EAS Build packages old code / missing new assets
- `eas-cli` reads Git-tracked files only. Run: `git add -A && git commit -m "..." && git push`
- Then run: `NODE_TLS_REJECT_UNAUTHORIZED=0 npx eas-cli build --profile preview --platform android`

---

## 📚 GIT

```
Remote: https://github.com/Sharma1907/eventapp
Branch: main

Common Commands:
  git status
  git add -A
  git commit -m "message"
  unset GIT_ASKPASS
  git push origin main
  git pull --rebase origin main

If push rejected:
  git pull --rebase origin main
  git push origin main
```

---

## 🚀 FRESH TERMINAL SESSION — QUICK START

```bash
# Check server health
ps aux | grep gunicorn | grep -v grep
tail -20 /home/baadalvm/eventapp/backend/server.log

# Restart backend after Python changes
cd /home/baadalvm/eventapp/backend
pkill -9 -f gunicorn || true
sleep 1.5
nohup ./start_server.sh > server.log 2>&1 &

# Start Metro for mobile dev
cd /home/baadalvm/eventapp/mobile
EXPO_NO_DEVTOOLS=1 npx expo start --lan --port 8081

# Build APK (cloud)
cd /home/baadalvm/eventapp/mobile
git add -A && git commit -m "..." && git push origin main
rm -rf android ios .expo dist web-build
NODE_TLS_REJECT_UNAUTHORIZED=0 npx eas-cli build --profile preview --platform android --non-interactive
```

---

**🎯 END OF CONTEXT WINDOW v23**