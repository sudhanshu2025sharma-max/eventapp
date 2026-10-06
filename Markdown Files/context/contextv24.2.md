# 🎯 ETD 2026 CONFERENCE APP — Complete Context Window (v24) — PART 2 of 2

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
5. POST to /api/v1/notifications/tokens/
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
```

### `src/notifications.js` — SDK 57 Lazy Require Pattern
```javascript
import Constants, { ExecutionEnvironment } from 'expo-constants';

const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment?.StoreClient ||
  Constants.executionEnvironment === 'storeClient' ||
  Constants.appOwnership === 'expo';

let Notifications = null;
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
```

### `apps/notifications/fcm.py` — Universal Push Helpers
```python
def send_to_tokens(tokens, title, body, data=None, img=None): ...
def send_to_all(*args, **kwargs): ...   # Supports (notif) and (title, body, data, notif)
def send_to_role(role, title, body, data, notif=None, request=None): ...
def send_to_user(user, title, body, data=None, notif=None, request=None): ...
def send_notification(notif, request=None): ...
```

Also captures push failures into `SystemLogEntry` (log_type='push_failure').

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
```

---

## ⭐ MEAL PASS SYSTEM 2.0 (Named Categories + Full Automation)

```
┌─────────────────────────────────────────────────────────────┐
│         SCHEDULE (Source of Truth: ScheduleSession)         │
│  is_meal=True + meal_category='Lunch/Dinner/High Tea/       │
│                                Breakfast'                    │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  sync_meal_window()  (apps/checkins/meal_utils.py)          │
│  Uses zoneinfo.ZoneInfo("Asia/Kolkata") for IST             │
│  Triggered by:                                              │
│  • Every GET /api/v1/notifications/unread-count/            │
│  • Every GET /api/v1/checkins/meal/status/                  │
│  • Every GET /panel/checkins/meal-window-status/            │
│  • On session create/edit in ScheduleAdmin                  │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  MealWindow (date=today, meal_type=named category)          │
│  Safe query pattern (prevents MultipleObjectsReturned):     │
│    MealWindow.objects.filter(date=today).order_by('-id')    │
│                       .first()                              │
│                                                               │
│  • Inside scheduled slot → is_open=True + push "now open!"  │
│  • Outside all slots + no manual hold → is_open=False       │
│    + push "service closed"                                   │
│  • MANUAL admin toggle → sets opened_by=<user>              │
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
GET    /api/v1/checkins/meal/status/         → window + pass
POST   /api/v1/checkins/meal/generate/       → gated by check-in
POST   /api/v1/checkins/meal/scan/           → verify QR
POST   /api/v1/checkins/meal/window/         → toggle
GET    /api/v1/checkins/meal/stats/
POST   /api/v1/checkins/meal-pass/create/    → walk-in guest + email QR
GET    /api/v1/checkins/meal-pass/mine/

# Web Admin
GET    /panel/checkins/scanner/
GET    /panel/checkins/meal-window-status/
POST   /panel/checkins/meal/window/
POST   /panel/checkins/meal/scan/
```

---

## 📰 FEED SYSTEM (Full Mobile Admin CRUD)

### Backend API Endpoints (`/api/v1/posts/`)
```
GET  /posts/feed/                                → paginated feed
POST /posts/feed/<uuid>/react/                   → toggle reaction
GET  /posts/feed/<uuid>/comments/                → list comments
POST /posts/feed/<uuid>/comments/                → add comment/reply

# Admin API (super_admin, mgmt_admin, team_head, staff)
GET    /posts/admin/feed/                        → list ALL posts
POST   /posts/admin/feed/                        → create (multipart)
PATCH  /posts/admin/feed/<uuid>/                 → edit
DELETE /posts/admin/feed/<uuid>/                 → hard delete
GET    /posts/admin/feed/<uuid>/comments/
DELETE /posts/admin/feed/<uuid>/comments/<uuid>/
```

### FeedScreen.js — Video Support (SDK 57)
Uses `useVideoPlayer` + `VideoView` from `expo-video` (NOT `expo-av` which was removed in SDK 57).

---

## 👤 PROFILE SYSTEM v23

### Weighted Profile Completion Score
```
Full Name (both)              = 15 pts
Profile Photo                 = 15 pts
Affiliation                   = 15 pts
Designation                   = 10 pts
Bio (≥ 20 chars)              = 15 pts
Research Interests (3-5 tags) = 20 pts
LinkedIn or Phone             = 10 pts
─────────────────────────────────
TOTAL                          = 100 pts
```

### Research Interests Mandatory (Min 3, Max 5)
- `User` model gained `research_interests` JSONField (default `[]`)
- `EditProfileScreen.js` enforces min 3, max 5 tags via chip-picker UI
- `ProfileTab.js` shows amber banner if user has < 3 interests

### My Recap (Conference Memory)
- `RecapScreen.js` pulls from real sources:
  ```
  Points Earned      → UserPoints.total
  Sessions Attended  → CheckIn.count where checkin_type='session'
  Meals Redeemed     → MealPass.count where used=True
  Selfies Uploaded   → SelfieSubmission.count where user=me
  Connections Made   → ConnectionRequest.count where status='accepted'
  Chats Sent         → Message.count where sender=me
  Polls Participated → Vote.count where user=me
  Ideathon Team      → IdeathonTeam where member=me
  ```
- API: `GET /api/v1/leaderboard/recap/`

### Certificate (Retained)
- Only visible when user has `CheckIn(checkin_type='conference')`
- Renders PDF-style card using `react-native-svg` with QR code proof
- Long-press to share via native `Share`

---

## ⭐ ERROR REPORTING SYSTEM v24 (NEW)

### Architecture Overview
```
┌─────────────────────────────────────────────────────────────┐
│  MOBILE APP (ReportErrorScreen.js)                          │
│  Under Profile Tab → "Report an Error"                      │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  TAB 1: Report New Error                              │  │
│  │  • Category picker (7 options)                        │  │
│  │  • Phone contact input                                │  │
│  │  • Title (optional) + Description (required)          │  │
│  │  • Screenshots (up to 4, Base64 encoded via JSON)     │  │
│  │  • Sends via apiFetch as JSON (bypasses FormData bug) │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  TAB 2: My Bug Tickets                                │  │
│  │  • Live status badges (NEW/IN PROGRESS/RESOLVED/CLOSED)│ │
│  │  • Admin remarks in highlighted blue box              │  │
│  │  • Attached screenshots viewer                        │  │
│  │  • Pull-to-refresh                                    │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                          ↕ apiFetch (JSON)
┌─────────────────────────────────────────────────────────────┐
│  DJANGO BACKEND (apps/error_reports/)                       │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Models                                                │  │
│  │  • ErrorReport (id, user, user_email, user_name,      │  │
│  │    user_phone, category, title, description,          │  │
│  │    device_info JSONField, status, severity,           │  │
│  │    admin_notes, resolved_by, resolved_at)             │  │
│  │  • ErrorReportScreenshot (report FK, image FileField) │  │
│  │  • SystemLogEntry (log_type, level, message,          │  │
│  │    traceback, path, method, ip_address, user_email)   │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  ErrorCaptureMiddleware (auto-log 5xx exceptions)     │  │
│  │  • Captures every unhandled Django exception          │  │
│  │  • Saves traceback, path, method, user, IP            │  │
│  │  • Also hooks: push_failure, auth_failure             │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  log_utils.py                                          │  │
│  │  • get_server_log_tail(N) → last N lines of server.log│  │
│  │  • get_system_health() → RAM, Uptime, Disk, Gunicorn, │  │
│  │    Postgres active conns                               │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                          ↕
┌─────────────────────────────────────────────────────────────┐
│  WEB ADMIN (backend/templates/panel/error_reports.html)     │
│  Tabbed dashboard at /panel/error-reports/                  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  TAB 1: User Reported Errors                          │  │
│  │  • Table with screenshots, phone, category, status    │  │
│  │  • Filter by status/category                          │  │
│  │  • "Log New Ticket" modal for admin-created tickets   │  │
│  │  • Row detail → error_report_detail.html              │  │
│  │    Full edit form (title, category, status, severity, │  │
│  │    phone, notes) + Delete button                       │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  TAB 2: Captured System Exceptions                    │  │
│  │  • Auto-captured 500s, push failures, auth failures   │  │
│  │  • Expandable stack traces                            │  │
│  │  • Clear all button                                    │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  TAB 3: Live server.log Stream Console                │  │
│  │  • Terminal-style dark viewer                         │  │
│  │  • Color-coded (red=error, yellow=warning, green=ok)  │  │
│  │  • Auto-polls every 5s                                │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  4 Live Health Metric Cards at Top:                          │
│  • User Reports total + New count                           │
│  • Gunicorn Workers + Uptime                                │
│  • RAM Used + %                                              │
│  • PostgreSQL Active Connections                             │
└─────────────────────────────────────────────────────────────┘
                          ↕
┌─────────────────────────────────────────────────────────────┐
│  MOBILE ADMIN (admin/ErrorReportsAdmin.js)                  │
│  Accessible via Admin Tab → "Error Reports" card            │
│  Same 3-tab structure: Tickets / System Errors / Live Server│
│  • Full CRUD on tickets (Create, Read, Update, Delete)      │
│  • Live server log auto-refresh (4s polling)                │
│  • Linux health metrics grid                                │
└─────────────────────────────────────────────────────────────┘
```

### Mobile API Endpoints
```
# User endpoints
POST   /api/v1/error-reports/submit/           → Submit new error (JSON+Base64)
GET    /api/v1/error-reports/my/               → List user's own tickets w/ admin_notes

# Admin endpoints
GET    /api/v1/error-reports/admin/list/                → List all tickets
POST   /api/v1/error-reports/admin/create/              → Admin create ticket
PATCH  /api/v1/error-reports/admin/<uuid>/status/       → Update status/notes/severity
DELETE /api/v1/error-reports/admin/<uuid>/delete/       → Delete ticket

# Logs & Health
GET    /api/v1/error-reports/admin/logs/server/         → Tail server.log
GET    /api/v1/error-reports/admin/logs/system/         → List SystemLogEntry
DELETE /api/v1/error-reports/admin/logs/system/clear/   → Clear system logs
GET    /api/v1/error-reports/admin/health/              → Linux + Postgres metrics
```

### Web Admin URLs
```
GET  /panel/error-reports/                    → Main dashboard
GET  /panel/error-reports/<uuid>/             → Detail + edit form
POST /panel/error-reports/<uuid>/             → Save/delete via action=update_status|delete
GET  /panel/error-reports/live-log-stream/    → AJAX log tail
POST /panel/error-reports/clear-sys-logs/     → Clear captured logs
```

### ⚠️ CRITICAL: Mobile Submission Pattern (JSON + Base64)
React Native SDK 57 (Fabric TurboModules) throws `Unsupported FormDataPart implementation` when file URIs from `expo-image-picker` are appended to `FormData`. **SOLUTION**: Send screenshots as Base64-encoded JSON:

```javascript
// In ReportErrorScreen.js
const result = await ImagePicker.launchImageLibraryAsync({
  mediaTypes: ['images'],  // ⚠️ SDK 57 array syntax (NOT MediaTypeOptions)
  quality: 0.6,
  base64: true,             // ⭐ CRITICAL: enables Base64 payload
});

const payload = {
  title, description, category, user_phone,
  device_info: { os, os_version, screen_width, screen_height, ... },
  screenshots_base64: screenshots.map(s => s.base64).filter(Boolean),
};

const res = await apiFetch('/error-reports/submit/', {
  method: 'POST',
  body: JSON.stringify(payload),  // ⭐ CRITICAL: JSON not FormData
});
```

### Backend Base64 Handler (submit_error_report)
```python
# apps/error_reports/views.py
screenshots_b64 = request.data.get('screenshots_base64') or []
for idx, b64_str in enumerate(screenshots_b64):
    if 'base64,' in b64_str:
        header, data_str = b64_str.split('base64,', 1)
        ext = 'png' if 'image/png' in header else 'jpg'
    else:
        data_str = b64_str; ext = 'jpg'

    # ASCII cleanup + padding fix
    data_str = data_str.encode('ascii', 'ignore').decode('ascii').strip()
    missing_padding = len(data_str) % 4
    if missing_padding:
        data_str += '=' * (4 - missing_padding)

    img_data = base64.b64decode(data_str)
    file_name = f"ss_{str(report.id)[:8]}_{idx+1}_{uuid.uuid4().hex[:4]}.{ext}"
    content_file = ContentFile(img_data, name=file_name)
    ErrorReportScreenshot.objects.create(report=report, image=content_file)
```

### Auto-Capture Middleware
```python
# apps/error_reports/middleware.py (registered in settings.MIDDLEWARE)
class ErrorCaptureMiddleware:
    def process_exception(self, request, exception):
        SystemLogEntry.objects.create(
            log_type='backend_5xx',
            level='CRITICAL',
            message=str(exception),
            traceback=traceback.format_exc(),
            path=request.path,
            method=request.method,
            ip_address=<extracted from X-Forwarded-For>,
            user_email=<if authenticated>,
        )
```

### Push Failure Hook (fcm.py)
```python
except Exception as e:
    try:
        from apps.error_reports.models import SystemLogEntry
        SystemLogEntry.objects.create(
            log_type='push_failure',
            level='ERROR',
            message=str(e),
            context_data={'token_count': len(tokens), 'title': title}
        )
    except Exception: pass
```

### Failed Login Hook (accounts/views.py)
```python
if not serializer.is_valid():
    from apps.error_reports.models import SystemLogEntry
    SystemLogEntry.objects.create(
        log_type='auth_failure',
        level='WARNING',
        message=f"Failed login attempt for: {request.data.get('email', 'unknown')}",
        ip_address=<X-Forwarded-For>,
    )
    return Response(serializer.errors, status=400)
```

### User Ticket Tracking (My Bug Tickets Tab)
User sees:
- **Status Badges**: `NEW` 🔴, `IN PROGRESS` 🟡, `RESOLVED` 🟢, `CLOSED` ⚪
- **Admin Remarks Box**: Blue-highlighted box with `admin_notes` (always visible when populated)
- **Attached Screenshots** with tap-to-zoom modal
- Auto-navigates from Submit tab → My Tickets tab after successful submission

---

## ⭐ SUPPORT & HELP MODAL v24 (NEW)

### Concept
When user taps **"Support & Help"** under Profile Tab, a modal opens showing ONLY the **8 Central Library & Committee Leaders** (NOT the full events staff directory).

### The 8 Fixed Leaders (from PostgreSQL)
```
1. Nabi Hasan              hodlibrary@admin.iitd.ac.in     Librarian & Head
2. Neeraj Kumar Chaurasia  neerajkc@library.iitd.ac.in     Deputy Librarian
3. Shankar B. Chavan       shankar.chavan@library.iitd.ac.in Deputy Librarian
4. Vijay Kumar Verma       vkverma@library.iitd.ac.in      Assistant Librarian (SG)
5. Vanita Khanchandani     vanita@library.iitd.ac.in       Assistant Librarian (SG)
6. Mohit Garg              gargmohit@library.iitd.ac.in    Assistant Librarian (SS)
7. Manu T R                manutr@library.iitd.ac.in       Assistant Librarian (SS)
8. Satbir Chauhan          satbir@library.iitd.ac.in       Assistant Librarian
```

Photos and phones stored in `StaffProfile.photo` (`staff/staff_<name>.jpg`) and `StaffProfile.phone`.

### Backend Endpoint (`apps/accounts/views.py`)
```python
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def support_team_list(request):
    """
    Returns strictly the 8 Central Library & Committee Leaders.
    CACHED FOR 5 MINUTES via Django cache (zero repeated DB queries).
    """
    from django.core.cache import cache
    cache_key = 'support_committee_team_v2'
    cached_data = cache.get(cache_key)
    if cached_data is not None:
        return Response({'success': True, 'support_team': cached_data, 'cached': True})

    emails = ['hodlibrary@admin.iitd.ac.in', 'neerajkc@library.iitd.ac.in', ...]
    users = User.objects.filter(email__in=emails).select_related('staff_profile')

    results = []
    for email in emails:  # Preserve order
        u = user_dict.get(email.lower())
        if u:
            sp = getattr(u, 'staff_profile', None)
            photo_url = request.build_absolute_uri(sp.photo.url) if sp and sp.photo else None
            phone = sp.phone or u.phone or ''
            designation = sp.designation or u.designation or 'Central Library Leader'
            department = sp.department or 'Central Library, IIT Delhi'
            results.append({...})

    cache.set(cache_key, results, timeout=300)
    return Response({'success': True, 'support_team': results, 'cached': False})
```

### Chat Endpoint (`apps/chat/views.py`)
```python
from django.shortcuts import get_object_or_404  # ⚠️ REQUIRED IMPORT

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def start_support_chat(request, user_id):
    """Directly opens/creates 1:1 conversation with support staff with selected topic."""
    target_user = get_object_or_404(User, id=user_id)
    if target_user == request.user:
        return Response({'error': 'Cannot chat with yourself'}, status=400)

    topic = request.data.get('topic', 'networking')
    custom_topic = request.data.get('custom_topic', '').strip()
    init_msg = request.data.get('message', '').strip()

    conv = Conversation.objects.filter(
        Q(participant_a=request.user, participant_b=target_user) |
        Q(participant_a=target_user, participant_b=request.user)
    ).first()

    if not conv:
        conn_req, _ = ConnectionRequest.objects.get_or_create(
            sender=request.user, receiver=target_user,
            defaults={'status': 'accepted', 'request_type': 'contact',
                      'topic': topic, 'custom_topic': custom_topic, 'message': init_msg}
        )
        conn_req.status = 'accepted'
        conn_req.save()
        conv = Conversation.objects.create(
            request=conn_req, participant_a=request.user, participant_b=target_user)
        if init_msg:
            Message.objects.create(conversation=conv, sender=request.user, content=init_msg)

    return Response({
        'success': True,
        'conversation_id': str(conv.id),
        'other_user': _user_brief(target_user, request)
    })
```

### Mobile Support Modal (`mobile/src/screens/SupportModal.js`)
Layout: **2-column grid** with each card containing:
1. **Big photo** (`82x94px`, `resizeMode="contain"`, `#f8fafc` background) — preserves full head
2. **Full Name** centered
3. **Designation badge** (full text, e.g. "Assistant Librarian (SG)")
4. **Footer bar**: Email icon | Chat icon (call icon REMOVED)

Chat flow:
1. Tap Chat → Opens `TopicPickerModal`
2. User selects topic (Research Collaboration, Session Discussion, Digital Libraries, etc.)
3. `POST /chat/support/start/<user_id>/` with `{topic, custom_topic, message}`
4. Auto-navigates to `ChatRoomScreen` with new conversation_id

Wired in `ProfileTab.js`:
```javascript
<SupportModal
  visible={showSupportModal}
  onDismiss={() => setShowSupportModal(false)}
  onOpenChatRoom={onOpenChatRoom}  // ⚠️ REQUIRED PROP
/>
```

`MainApp.js` passes:
```javascript
<ProfileTab
  ...
  onOpenChatRoom={(convId) => openSubScreen('chat_room', { conversationId: convId })}
/>
```

### StaffScreen.js Also Has Chat Button (v24)
Full Events Team screen now has:
- Chat button on each card
- Same TopicPickerModal flow
- Same `start_support_chat` endpoint (works for any user_id)
- Photos display with full headshot using `resizeMode="contain"` + `#f8fafc` bg
- Top badge shows FULL designation (fixed the "Assistant" single-word truncation)

Wired in `MainApp.js`:
```javascript
<StaffScreen
  ...
  onOpenChatRoom={(convId) => openSubScreen('chat_room', { conversationId: convId })}
/>
```

---

## 📅 HOME TAB LOGIC (Day Calc from Live Sessions)

```javascript
// mobile/src/screens/HomeTab.js
const firstSession = allSorted[0];
const lastSession = allSorted[allSorted.length - 1];
const confStartMs = firstSession ? getEventDate(firstSession, 'start')?.getTime() : ...;
const confEndMs = lastSession ? getEventDate(lastSession, 'end')?.getTime() : ...;
const total = Math.max(...allSorted.map(e => Number(e.day) || 1));

const activeDayIndex = liveSession ? Number(liveSession.day)
                     : nextSession ? Number(nextSession.day)
                     : (nowMs >= confEndMs ? total : 1);
```

Progress/Countdown Logic:
```
Phase 1: Now < Conf_Start          → mode='countdown'
Phase 2: Conf_Start ≤ Now ≤ Conf_End
         ├─ liveSession exists     → mode='progress'
         ├─ nextSession same day   → mode='countdown'
         └─ nextSession next day   → mode='countdown' (next day's first session)
Phase 3: Now > Conf_End            → mode='progress', progress=100%
```

Quick Actions:
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

State: `const [tab, setTab] = useState('home')` — use `setTab('schedule')` (NOT `setActiveTab`).

---

## 🎛️ MOBILE ADMIN TAB (11 Feature Cards)

```javascript
const ALL_FEATURES = [
  { key: 'checkin',          perm: 'checkin_scanner', grad: ['#059669', '#047857'] },
  { key: 'notifications',    perm: 'notifications',   grad: [COLORS.brand, COLORS.brandDark] },
  { key: 'feed_admin',       perm: 'feed',            grad: [COLORS.purple, '#6d28d9'] },
  { key: 'add_participant',  perm: 'users_manage',    grad: ['#0d9488', '#0f766e'] },
  { key: 'users',            perm: 'users_manage',    grad: [COLORS.purple, '#7c3aed'] },
  { key: 'staff_admin',      perm: 'users_manage',    grad: ['#7c3aed', '#5b21b6'] },
  { key: 'schedule',         perm: 'schedule',        grad: ['#0284c7', '#0369a1'] },
  { key: 'photos',           perm: 'photos',          grad: ['#059669', '#047857'] },
  { key: 'polls_admin',      perm: 'polls',           grad: [COLORS.accent, '#b45309'] },
  { key: 'papers',           perm: 'papers',          grad: ['#0d9488', '#0f766e'] },
  { key: 'ideathon_admin',   perm: 'ideathon',        grad: ['#667eea', '#764ba2'] },
  { key: 'error_reports',    perm: 'error_reports',   grad: ['#e11d48', '#be123c'] },  // ⭐ v24
];
```

**⚠️ CRITICAL:** Every feature MUST have `grad: ['#hex1', '#hex2']` — missing crashes `LinearGradient`.

---

## 🎨 theme.js — DESIGN TOKENS

```javascript
export const COLORS = {
  brand: '#0333b6', brandDark: '#022a8f', brandDeep: '#0F172A',
  brandLight: '#e8eeff', ...
  success: '#10b981', successLight: '#d1fae5',
  error: '#ef4444', errorLight: '#fee2e2',
  warning: '#f59e0b', warningLight: '#fef3c7',
  purple: '#8b5cf6', teal: '#14b8a6', rose: '#f43f5e',
  text: '#0F172A', textSec: '#475569', textTer: '#94a3b8',
  border: '#e2e8f0', borderLight: '#f1f5f9',
};

// FONT is FLAT (not nested)
export const FONT = {
  micro: 9, xs: 11, sm: 13, base: 15, md: 16,
  lg: 18, xl: 22, xxl: 26, xxxl: 32, hero: 40,
  w4: '400', w5: '500', w6: '600', w7: '700', w8: '800', w9: '900',
};

export const SPACE = { xxs:2, xs:4, sm:8, md:12, lg:16, xl:20, xxl:24, xxxl:32, huge:48 };
export const RADIUS = { xs:4, sm:8, md:12, lg:16, xl:20, xxl:28, xxxl:36, full:999 };
export const SHADOW = { none:{}, sm:..., md:..., lg:..., xl:..., brand:..., accent:... };

// Auto-switching API URL
const DEV_API_URL  = 'http://10.17.9.48:8000/api/v1';
const PROD_API_URL = 'https://etd2026.iitd.ac.in/api/v1';
export const API_URL  = __DEV__ ? DEV_API_URL : PROD_API_URL;
export const API_ROOT = API_URL.replace(/\/api\/v1$/, '');
```

⚠️ NEVER write `FONT.size.lg` — FONT is flat.
⚠️ NEVER write `COLORS.warning-dark` — JS reads as subtraction.

---

## 🔌 apiFetch — mobile/src/api.js (v24 Robust FormData Detection)

```javascript
export async function apiFetch(path, options = {}) {
  const url = path.startsWith('http') ? path : `${API_URL}${path}`;

  // Robust FormData detection for RN SDK 57 TurboModules
  const isFormData = !!(
    options.body &&
    (options.body instanceof FormData ||
     Object.prototype.toString.call(options.body) === '[object FormData]' ||
     typeof options.body.getParts === 'function' ||
     options.body._parts)
  );

  const baseHeaders = _tokens?.access ? { Authorization: `Bearer ${_tokens.access}` } : {};
  if (!isFormData && !options.headers?.['Content-Type']) {
    baseHeaders['Content-Type'] = 'application/json';
  }
  baseHeaders['ngrok-skip-browser-warning'] = 'true';
  const headers = { ...baseHeaders, ...(options.headers || {}) };
  if (isFormData) delete headers['Content-Type'];

  let res = await fetch(url, { ...options, headers });

  // JWT auto-refresh on 401
  if (res.status === 401 && _tokens?.refresh) {
    const refreshed = await _refreshTokens();
    if (refreshed) {
      const retryHeaders = { ...headers, Authorization: `Bearer ${_tokens.access}` };
      if (isFormData) delete retryHeaders['Content-Type'];
      res = await fetch(url, { ...options, headers: retryHeaders });
    }
  }
  return res;
}
```

---

## ⚠️ CRITICAL PATTERNS — DO NOT BREAK

### Apache / Reverse Proxy
```
✓ ALWAYS run `apache2ctl configtest` before reload
✓ ALWAYS use `systemctl reload apache2` (not restart)
✓ ALWAYS keep wordpress.conf.bak for instant rollback
✓ ALWAYS pass X-Forwarded-Proto "https"
✗ NEVER edit /etc/ssl/* — SSL is at IITD Central Gateway
✗ NEVER prefix admin_urls.py routes with 'panel/'
```

### Backend (Django)
```
✗ NEVER expect Gunicorn to hot-reload — always restart
✗ NEVER set CONN_MAX_AGE > 0 under Uvicorn workers
✗ NEVER use Firebase Admin SDK — Expo Push API only
✗ NEVER use `MealWindow.objects.get_or_create(date=today)`
   Use .filter(date=today).order_by('-id').first()
✗ NEVER prefix admin_urls.py routes with 'panel/'
✗ NEVER use `python` — this VM has `python3`
✗ NEVER use `created_at` on CheckIn model — it's `scanned_at`
✗ NEVER put `{% block scripts %}` twice in if/else
✗ NEVER forget `from django.shortcuts import get_object_or_404` in chat/views.py
✗ NEVER forget `from rest_framework.decorators import throttle_classes` when using @throttle_classes

✓ ALWAYS use timezone.now().astimezone(IST) for meal logic
✓ ALWAYS return {"success": true/false} for mobile API
✓ ALWAYS trigger sync_meal_window() in schedule create/edit endpoints
✓ ALWAYS check is_checked_in before allowing meal pass generation
✓ ALWAYS restart gunicorn after .py changes
✓ ALWAYS cd into backend/ before Django commands
✓ ALWAYS route outbound HTTP through proxy21.iitd.ac.in:3128
✓ ALWAYS use `python3 << 'EOF'` (single quotes) for JS/HTML heredocs
✓ ALWAYS use Django cache framework for read-heavy endpoints (5-min TTL)
```

### Templates
```
✓ Everything extends "panel/base.html"
✓ DIRS = [BASE_DIR / 'templates'] → backend/templates/
✓ Chat templates live in templates/panel/chat/
✓ Every sidebar item is permission-wrapped
✗ Never add |safe to user-supplied values
✗ Never put {% block scripts %} inside a raw {% if %}/{% else %} —
  wrap the {% if %} INSIDE a single {% block scripts %}
```

### Mobile — Expo SDK 57 Specifics
```
✗ Never downgrade Expo SDK (locked at 57)
✗ Never re-add expo-av (use expo-video)
✗ Never re-add expo-dev-client (adds 35MB, unused)
✗ Never re-add @types/react or typescript (JS project)
✗ Never import from @react-navigation/native — NOT INSTALLED
✗ Never use react-native Clipboard — use expo-clipboard
✗ Never use <Video> from expo-av — use useVideoPlayer + VideoView from expo-video
✗ Never top-level import expo-notifications in code that runs in Expo Go
✗ Never set shouldShowBanner/shouldShowList — removed in SDK 57
✗ Never omit projectId when calling getExpoPushTokenAsync()
✗ Never require @expo/config-plugins as dependency — use 'expo/config-plugins' sub-export
✗ Never run expo from root dir (always cd mobile/)
✗ Never set Content-Type manually with FormData
✗ Never write FONT.size.lg — FONT is FLAT
✗ Never write COLORS.warning-dark
✗ Never nest FlatList in same-direction ScrollView
✗ Never reference `setActiveTab` — the state variable is `tab`/`setTab`
✗ Never omit `grad: ['#a', '#b']` from ALL_FEATURES entries
✗ Never use `MediaTypeOptions.Images` — use `mediaTypes: ['images']` array syntax
✗ Never use FormData with file URIs in SDK 57 (Unsupported FormDataPart) —
  use JSON + Base64 pattern like ReportErrorScreen.js

✓ apiFetch() for authenticated calls (auto JWT refresh + FormData detection)
✓ For image/video upload: expo-image-picker with base64: true
✓ For file uploads that MUST use FormData: match FeedAdmin.js pattern exactly
✓ QRCodeSVG: guard with String(value || 'ETD-2026')
✓ FlatList keyExtractor: (item, idx) fallback
✓ Always import Platform from 'react-native' if using Platform.OS
✓ Use __DEV__ ternary to switch API URLs automatically
✓ For animation polish: react-native-reanimated v4 (already installed)
✓ For auto-refresh: setInterval in useEffect with cleanup
✓ For pull-to-refresh: <RefreshControl refreshing={r} onRefresh={fn} />
✓ For photos display: resizeMode="contain" + neutral background when headshots

⭐ v24 Photo Display Pattern (prevents head cropping):
   avatarContainer: { width: 90, height: 104, borderRadius: 18, ... }
   avatar: { width: '100%', height: '100%' }
   <Image source={{uri}} style={styles.avatar} resizeMode="contain" />
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
```

### APK Build (EAS Cloud)
```
✗ NEVER use --local flag (causes OOM on VM)
✗ NEVER skip git commit — eas-cli packages tracked files only
✓ ALWAYS clean android/ ios/ .expo/ dist/ before cloud build
✓ ALWAYS commit new logo assets (adaptive-icon.png MUST match icon.png)
✓ ALWAYS use eas-cli via npx (not global install)
✓ Preview profile outputs .apk (~25-35MB with ProGuard/R8)
✓ Production profile outputs .aab
✓ Uninstall old app before installing new APK
```

### Cron / Server Auto-Healing
```
✗ NEVER assume cron has full PATH — export PATH explicitly in scripts
✗ NEVER use plain `gunicorn` in cron — use full path or export PATH
✓ ALWAYS test with: pkill -9 -f gunicorn && sleep 60 && ps aux | grep gunicorn
✓ ALWAYS include @reboot entry for reboot recovery
✓ ALWAYS log to server.log so you can trace auto-restarts
```

### v24 Error Reporting Specifics
```
✗ NEVER send screenshots via FormData in SDK 57 — use JSON + Base64
✗ NEVER forget ASCII cleanup + padding fix when decoding Base64
✗ NEVER omit `from django.shortcuts import get_object_or_404` in chat/views.py

✓ Always use JSON payload with base64: true from expo-image-picker
✓ Always cache read-heavy endpoints (support_team_list uses 5-min cache)
✓ Always return admin_notes to user regardless of status (for live updates)
✓ Always show status badges + admin remarks box in user's My Tickets view
✓ Always auto-navigate to My Tickets tab after successful submission
```

---

## ✅ WHAT IS WORKING (COMPLETE)

```
✅ JWT Auth (access + refresh, no rotation)
✅ Email login, password reset via IITD SMTP
✅ Role-based access (7 roles, 23 modules incl. error_reports)
✅ Web admin panel (Django MVT, permission-gated sidebar)
✅ Participant management (CSV upload, add/edit/preview)
✅ Conference settings
✅ Schedule management (CRUD + is_meal + meal_category)
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
✅ Meal Pass System 2.0 (schedule-driven, IST-aware, named categories,
   30s background sync, real-time web scanner, Send Push button)
✅ Home Tab: Day calc from live sessions, countdown/progress
✅ QR Screen: Dynamic "Lunch Pass"/"Dinner Pass"/etc labels
✅ Ideathon System: interest, team CRUD, invites, join requests
✅ Papers/Posters System: full CRUD + PDF upload + search + download
✅ Schedule Tab: Sep 18/19/20 dates, 20s auto-refresh
✅ Public HTTPS: https://etd2026.iitd.ac.in (WordPress + Django coexist)
✅ Zero-downtime Apache reloads with configtest safety
✅ Live Admin Dashboard (real metrics from PostgreSQL)
✅ Google Maps tiles in web admin + mobile app
✅ Android SSL certificate bundling (GlobalSign R46 in APK)
✅ Push token registration (tokens/ alias + EAS projectId)
✅ Login <1 second (non-blocking push registration)
✅ APK builds via EAS Cloud (~25-35MB with ProGuard/R8)
✅ Cron Watchdog (@reboot + every 60s): Auto-restarts Gunicorn if dead
✅ Expo SDK 54 → 57 upgrade complete (React Native 0.86.3 Fabric)
✅ FeedScreen video playback via useVideoPlayer + VideoView
✅ ChatRoomScreen clipboard via expo-clipboard
✅ Profile System v23 Overhaul (research interests, weighted score, RecapScreen)

⭐ NEW IN v24:
✅ Error Reporting System End-to-End:
   • Mobile ReportErrorScreen (JSON+Base64 upload, bypasses FormData bug)
   • Screenshot attachments (up to 4, quality 0.6, base64 encoded)
   • Auto phone contact registration
   • Device diagnostics auto-attached (OS, version, screen dims)
   • Category picker (7 categories)
   • My Bug Tickets tab with live status + admin remarks
   • Auto-navigation to My Tickets after submission
   • Pull-to-refresh on ticket list
✅ ErrorReport / SystemLogEntry / Screenshot models with UUID keys
✅ ErrorCaptureMiddleware auto-logs every 500 exception
✅ Push failure hook in fcm.py → SystemLogEntry
✅ Failed login hook in accounts/views.py → SystemLogEntry
✅ Web Admin Dashboard (/panel/error-reports/):
   • 3 Tabs: User Reports / System Exceptions / Live server.log Stream
   • 4 Live Health Cards: Reports, Gunicorn, RAM, PostgreSQL
   • Full CRUD (create modal, edit form, delete)
   • Filter by status/category
   • Live log viewer with color-coded lines (auto-polls 5s)
✅ Mobile Admin Screen (ErrorReportsAdmin.js):
   • Same 3-tab structure
   • Ticket CRUD (Create modal, Edit modal, Delete)
   • Full-screen image viewer for screenshots
   • Auto-polling live server.log (4s)
   • Linux health metrics grid
✅ Support & Help Modal (SupportModal.js):
   • 2-column grid displaying 8 Central Library Leaders
   • Big 82x94 photos with resizeMode="contain" (no head cropping)
   • Full designation badges (not truncated)
   • Email + Chat icons (no call button)
   • 5-minute Django cache (zero repeat DB queries)
   • TopicPickerModal integration for chat initiation
   • start_support_chat endpoint auto-creates conversation
✅ StaffScreen.js enhanced:
   • Full designation badges (fixed "Assistant" truncation)
   • Full headshot photos (fixed head cropping)
   • Chat button on every card
   • TopicPickerModal + auto-open ChatRoomScreen
✅ apiFetch v24: Robust FormData detection for RN SDK 57 TurboModules
✅ Django cache framework used for 5-min TTL on read-heavy endpoints
✅ SystemLogEntry: log_type='backend_5xx'|'push_failure'|'auth_failure'|'system_health'|'cron_watchdog'
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
  • For file uploads in mobile SDK 57: PREFER JSON+Base64 over FormData
  • For read-heavy endpoints: use Django cache framework with 5-min TTL

Not lazy about: understanding the problem, input validation at trust
boundaries, error handling that prevents data loss, security,
accessibility, calibration real hardware needs, anything explicitly
requested. Lazy code without its check is unfinished.
```

---

## 🔧 QUICK TROUBLESHOOTING REFERENCE

### "Unsupported FormDataPart implementation" on Mobile
- **Root cause**: RN SDK 57 Fabric TurboModules reject `expo-image-picker` file URIs in FormData.
- **Solution**: Switch to JSON + Base64 payload pattern (see ReportErrorScreen.js).
- Use `base64: true` in ImagePicker call, send `screenshots_base64: [...]` in JSON.

### "NameError: get_object_or_404 is not defined"
- Add `from django.shortcuts import get_object_or_404` at top of file.

### "NameError: throttle_classes is not defined"
- Add `throttle_classes` to imports: `from rest_framework.decorators import api_view, permission_classes, throttle_classes`

### "Property 'API_ROOT' doesn't exist"
- Add API_ROOT to theme import: `import { ..., API_ROOT } from './theme'`

### "Property 'onOpenChatRoom' doesn't exist"
- Prop not destructured in component signature. Add to `function ComponentName({ ..., onOpenChatRoom })`.

### `ImagePicker.MediaTypeOptions` deprecated warning
- Use `mediaTypes: ['images']` array syntax (SDK 57).

### Photos have heads cropped in mobile cards
- Change `resizeMode="cover"` to `resizeMode="contain"`.
- Use portrait aspect ratio container (`width:90, height:104`) not square.
- Add neutral background: `backgroundColor: '#f8fafc'`.

### Badge shows only first word of designation
- Use `item.designation` directly (full text), not a `TIER_LABELS[item.tier]` lookup.

### "Delivered: 0, Status: failed" on push
- Check `apps/notifications/fcm.py` has all 5 helpers.
- Verify `send_to_all` accepts both `(notif)` and `(title, body, data, notif)`.

### "MealWindow.MultipleObjectsReturned"
- Replace `.get_or_create(date=today)` with `.filter(date=today).order_by('-id').first()`

### Push arrives only when opening QR Screen
- Verify `apps/notifications/views.py::unread_count` calls `sync_meal_window()`.
- Verify mobile polls `/notifications/unread-count/` every 30s globally.

### "Cannot resolve @react-navigation/native"
- Remove `import { useFocusEffect } from '@react-navigation/native';`
- Use `useEffect(() => { const t = setInterval(...); return () => clearInterval(t); }, [])`

### Cron watchdog logs "gunicorn: not found"
- Add `export PATH="/home/baadalvm/.local/bin:..."` at top of both scripts.

### `{% block 'scripts' %}` appears more than once
- Move `{% if mode == 'edit' %}` INSIDE the `{% block scripts %}` tag.

### Expo Go red screen: "PlatformConstants could not be found"
- react-native version mismatch. Run: `npx expo install --fix`
- Ensure `react-native@0.86.3` matches SDK 57.

### Expo Go red screen: "expo-notifications was removed from Expo Go"
- Ensure `src/notifications.js` uses lazy `require('expo-notifications')` inside `if (!isExpoGo)` block.

### Metro bundler: "Cannot find module '@expo/config-plugins'"
- In `plugins/withNetworkSecurity.js`, change:
  `require('@expo/config-plugins')` → `require('expo/config-plugins')`

### APK shows old logo after rebuild
- `adaptive-icon.png` was not updated. Run: `cp -f icon.png adaptive-icon.png`
- UNINSTALL old app from phone before installing new APK.

### "AttributeError: module 'apps.accounts.views' has no attribute 'X'"
- File was overwritten losing existing functions.
- **Recovery**: `git checkout /path/to/file.py` then re-apply the addition using `python3 << 'EOF'` append pattern (never overwrite entire file when adding).

### Base64 decode error "string argument should contain only ASCII characters"
- Strip non-ASCII before decoding: `data_str.encode('ascii', 'ignore').decode('ascii').strip()`
- Fix padding: `data_str += '=' * (4 - len(data_str) % 4)` if `len % 4 != 0`

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

# Test Error Reporting endpoints
python3 << 'EOF'
import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'confhub.settings')
django.setup()
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken
from apps.accounts.models import User
user = User.objects.first()
client = APIClient()
client.credentials(HTTP_AUTHORIZATION=f'Bearer {RefreshToken.for_user(user).access_token}')
print(client.get('/api/v1/error-reports/my/').status_code)
print(client.get('/api/v1/auth/support-team/').status_code)
EOF
```

---

## 🎯 KEY FILE PATHS QUICK REFERENCE

```
BACKEND ERROR REPORTING (v24):
  /home/baadalvm/eventapp/backend/apps/error_reports/models.py
  /home/baadalvm/eventapp/backend/apps/error_reports/views.py
  /home/baadalvm/eventapp/backend/apps/error_reports/admin_views.py
  /home/baadalvm/eventapp/backend/apps/error_reports/middleware.py
  /home/baadalvm/eventapp/backend/apps/error_reports/log_utils.py
  /home/baadalvm/eventapp/backend/apps/error_reports/urls.py
  /home/baadalvm/eventapp/backend/apps/error_reports/admin_urls.py
  /home/baadalvm/eventapp/backend/templates/panel/error_reports.html
  /home/baadalvm/eventapp/backend/templates/panel/error_report_detail.html

BACKEND SUPPORT MODAL (v24):
  /home/baadalvm/eventapp/backend/apps/accounts/views.py (support_team_list)
  /home/baadalvm/eventapp/backend/apps/accounts/urls.py (support-team/)
  /home/baadalvm/eventapp/backend/apps/chat/views.py (start_support_chat)
  /home/baadalvm/eventapp/backend/apps/chat/urls.py (support/start/<uuid:user_id>/)

MOBILE v24:
  /home/baadalvm/eventapp/mobile/src/screens/ReportErrorScreen.js
  /home/baadalvm/eventapp/mobile/src/screens/SupportModal.js
  /home/baadalvm/eventapp/mobile/src/screens/admin/ErrorReportsAdmin.js
  /home/baadalvm/eventapp/mobile/src/screens/StaffScreen.js (enhanced)
  /home/baadalvm/eventapp/mobile/src/screens/ProfileTab.js (Support+Report links)
  /home/baadalvm/eventapp/mobile/src/MainApp.js (routing wired)
  /home/baadalvm/eventapp/mobile/src/api.js (robust FormData detection)
  /home/baadalvm/eventapp/mobile/src/screens/TopicPickerModal.js (reused)
```

---

**🎯 END OF CONTEXT WINDOW v24**