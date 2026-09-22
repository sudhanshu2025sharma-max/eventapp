

# Production-Level Brutal Load Testing Suite for ETD 2026 Conference App

I'll create a comprehensive, production-grade load testing infrastructure using **Locust** (Python-based, no external services needed, runs on your IITD VM).

## Architecture Overview

```
Testing Suite Structure:
├── load_tests/
│   ├── locustfile.py              ← Master orchestrator (all user behaviors)
│   ├── config.py                  ← Test configuration & constants
│   ├── auth_helper.py             ← JWT token management
│   ├── websocket_load.py          ← WebSocket stress testing (voice calls)
│   ├── scenarios/
│   │   ├── __init__.py
│   │   ├── auth_scenarios.py      ← Login/refresh/profile load
│   │   ├── schedule_scenarios.py  ← Schedule browsing & bookmarks
│   │   ├── chat_scenarios.py      ← Chat, connections, group chat
│   │   ├── checkin_scenarios.py   ← Check-in & meal scanning
│   │   ├── photo_scenarios.py     ← Photo upload & checkpoint
│   │   ├── poll_scenarios.py      ← Poll voting & results
│   │   ├── staff_scenarios.py     ← Staff directory & admin CRUD
│   │   ├── notification_scenarios.py ← Push notification stress
│   │   ├── leaderboard_scenarios.py  ← Leaderboard queries
│   │   └── sponsor_scenarios.py   ← Sponsor & speaker browsing
│   ├── report_generator.py        ← PDF report with charts
│   ├── run_all_tests.sh           ← Master test runner
│   ├── requirements.txt           ← Test dependencies
│   └── results/                   ← Output directory for PDFs
```

---

## Step 1: Install Dependencies

```bash
cd /home/baadalvm/eventapp
mkdir -p load_tests/scenarios load_tests/results

pip3 install --break-system-packages locust==2.29.1 matplotlib==3.9.2 reportlab==4.2.5 websocket-client==1.8.0 numpy==1.26.4
```

## Step 2: Configuration

```bash
cat << 'EOF' > load_tests/config.py
"""
Load Test Configuration for ETD 2026 Conference App
Production-level stress test parameters
"""

# ─── Server ───────────────────────────────────────────────────────
BASE_URL = "http://10.17.9.48:8000"
API_BASE = f"{BASE_URL}/api/v1"
WS_BASE = "ws://10.17.9.48:8000"

# ─── Test Users ───────────────────────────────────────────────────
# We generate these dynamically + use known accounts
ADMIN_USERS = [
    {"email": "etd@admin.iitd.ac.in", "password": "Admin@1234"},
]

STAFF_USERS = [
    {"email": "hodlibrary@admin.iitd.ac.in", "password": "Librarian@123"},
    {"email": "neerajkc@library.iitd.ac.in", "password": "Officer@123"},
    {"email": "gunjan0605@library.iitd.ac.in", "password": "Staff@123"},
]

PARTICIPANT_USERS = [
    {"email": "participant@test.com", "password": "Test@1234"},
    {"email": "speaker@test.com", "password": "Test@1234"},
    {"email": "test@test.com", "password": "12345678"},
]

# Generate dummy users (firstname.lastname@test.com / Test@1234)
DUMMY_USER_TEMPLATE = {"password": "Test@1234"}

# ─── Load Profiles ───────────────────────────────────────────────
PROFILES = {
    "smoke": {
        "users": 5,
        "spawn_rate": 1,
        "duration_seconds": 60,
        "description": "Smoke test - basic sanity check"
    },
    "normal": {
        "users": 50,
        "spawn_rate": 5,
        "duration_seconds": 300,
        "description": "Normal load - typical conference day"
    },
    "peak": {
        "users": 150,
        "spawn_rate": 10,
        "duration_seconds": 600,
        "description": "Peak load - keynote session + lunch rush"
    },
    "stress": {
        "users": 300,
        "spawn_rate": 20,
        "duration_seconds": 900,
        "description": "Stress test - 2x expected peak capacity"
    },
    "brutal": {
        "users": 500,
        "spawn_rate": 30,
        "duration_seconds": 1200,
        "description": "Brutal endurance - find breaking point"
    },
    "spike": {
        "users": 200,
        "spawn_rate": 50,
        "duration_seconds": 300,
        "description": "Spike test - sudden traffic burst (e.g., QR scan rush)"
    },
    "soak": {
        "users": 100,
        "spawn_rate": 5,
        "duration_seconds": 3600,
        "description": "Soak test - 1 hour sustained load for memory leaks"
    },
}

# ─── Thresholds (SLA) ────────────────────────────────────────────
SLA = {
    "p50_ms": 200,       # 50th percentile response time
    "p95_ms": 1000,      # 95th percentile response time
    "p99_ms": 3000,      # 99th percentile response time
    "error_rate_pct": 1.0,  # Max acceptable error rate
    "min_rps": 10,       # Minimum requests per second
}

# ─── Request Weights (probability of each action) ────────────────
# Simulates real conference behavior
WEIGHTS = {
    "browse_schedule": 25,      # Most common action
    "view_notifications": 15,
    "browse_sponsors": 10,
    "browse_speakers": 10,
    "view_leaderboard": 8,
    "browse_photos": 8,
    "vote_poll": 5,
    "view_staff_directory": 5,
    "chat_send_message": 4,
    "staff_group_chat": 3,
    "checkin_scan": 3,
    "upload_photo": 2,
    "checkpoint_submit": 1,
    "admin_crud": 1,
}

# ─── Timeouts ─────────────────────────────────────────────────────
REQUEST_TIMEOUT = 30  # seconds
WS_CONNECT_TIMEOUT = 10
WS_MESSAGE_TIMEOUT = 15

# ─── IIT Delhi Coordinates for Geolocation Tests ─────────────────
TEST_LOCATIONS = [
    {"lat": 28.5455, "lng": 77.1930, "name": "Dogra Hall"},
    {"lat": 28.5449, "lng": 77.1926, "name": "Central Library"},
    {"lat": 28.5460, "lng": 77.1920, "name": "Main Building"},
    {"lat": 28.5445, "lng": 77.1935, "name": "SAC"},
]
EOF
```

## Step 3: Auth Helper

```bash
cat << 'EOF' > load_tests/auth_helper.py
"""
JWT Authentication Helper for Load Tests
Manages token acquisition, caching, and refresh
"""

import time
import threading
import requests
from config import API_BASE, REQUEST_TIMEOUT

_token_cache = {}
_cache_lock = threading.Lock()
TOKEN_TTL = 240  # 4 minutes (access token is 5 min)


def get_tokens(email, password):
    """Get JWT tokens, using cache if valid."""
    with _cache_lock:
        cached = _token_cache.get(email)
        if cached and time.time() - cached["obtained_at"] < TOKEN_TTL:
            return cached["access"], cached["refresh"]

    try:
        resp = requests.post(
            f"{API_BASE}/auth/login/",
            json={"email": email, "password": password},
            timeout=REQUEST_TIMEOUT,
        )
        if resp.status_code == 200:
            data = resp.json()
            tokens = data.get("tokens", {})
            access = tokens.get("access", "")
            refresh = tokens.get("refresh", "")
            if access:
                with _cache_lock:
                    _token_cache[email] = {
                        "access": access,
                        "refresh": refresh,
                        "obtained_at": time.time(),
                    }
                return access, refresh
    except Exception:
        pass
    return None, None


def refresh_token(refresh):
    """Refresh an access token."""
    try:
        resp = requests.post(
            f"{API_BASE}/auth/token/refresh/",
            json={"refresh": refresh},
            timeout=REQUEST_TIMEOUT,
        )
        if resp.status_code == 200:
            data = resp.json()
            return data.get("access", "")
    except Exception:
        pass
    return None


def auth_headers(access_token):
    """Return authorization headers."""
    return {"Authorization": f"Bearer {access_token}"}


def invalidate_cache(email):
    """Remove cached tokens for a user."""
    with _cache_lock:
        _token_cache.pop(email, None)
EOF
```

## Step 4: Scenario Modules

```bash
cat << 'EOF' > load_tests/scenarios/__init__.py
# Load test scenarios package
EOF
```

```bash
cat << 'EOF' > load_tests/scenarios/auth_scenarios.py
"""
Authentication & Profile Load Scenarios
Tests: Login, token refresh, profile fetch, profile update, password change
"""

import random
import string
from locust import task, between, tag
from locust import HttpUser


class AuthScenarioMixin:
    """Mixin providing auth-related tasks."""

    @tag("auth", "critical")
    def login_flow(self):
        """Full login flow - most critical path."""
        creds = self._get_credentials()
        with self.client.post(
            "/api/v1/auth/login/",
            json={"email": creds["email"], "password": creds["password"]},
            name="/api/v1/auth/login/",
            catch_response=True,
        ) as resp:
            if resp.status_code == 200:
                data = resp.json()
                if data.get("success") and data.get("tokens", {}).get("access"):
                    self._access = data["tokens"]["access"]
                    self._refresh = data["tokens"]["refresh"]
                    self._user = data.get("user", {})
                    resp.success()
                else:
                    resp.failure(f"Login success but missing tokens: {data}")
            elif resp.status_code == 401:
                resp.failure("Invalid credentials")
            else:
                resp.failure(f"Unexpected status: {resp.status_code}")

    @tag("auth")
    def token_refresh_flow(self):
        """Test token refresh mechanism."""
        if not hasattr(self, "_refresh") or not self._refresh:
            return
        with self.client.post(
            "/api/v1/auth/token/refresh/",
            json={"refresh": self._refresh},
            name="/api/v1/auth/token/refresh/",
            catch_response=True,
        ) as resp:
            if resp.status_code == 200:
                data = resp.json()
                new_access = data.get("access", "")
                if new_access:
                    self._access = new_access
                    resp.success()
                else:
                    resp.failure("Refresh returned no access token")
            else:
                resp.failure(f"Refresh failed: {resp.status_code}")

    @tag("auth", "profile")
    def fetch_profile(self):
        """Fetch current user profile."""
        if not self._access:
            return
        with self.client.get(
            "/api/v1/auth/me/",
            headers={"Authorization": f"Bearer {self._access}"},
            name="/api/v1/auth/me/",
            catch_response=True,
        ) as resp:
            if resp.status_code == 200:
                resp.success()
            elif resp.status_code == 401:
                self.login_flow()
                resp.failure("Token expired during profile fetch")
            else:
                resp.failure(f"Profile fetch failed: {resp.status_code}")

    @tag("auth", "profile")
    def update_profile(self):
        """Update user profile with random research interests."""
        if not self._access:
            return
        interests = random.sample(
            ["AI", "ML", "NLP", "Computer Vision", "Robotics",
             "Data Science", "Blockchain", "IoT", "Cybersecurity",
             "Cloud Computing", "Edge Computing", "Quantum Computing"],
            k=random.randint(1, 4),
        )
        with self.client.post(
            "/api/v1/auth/update-profile/",
            json={"research_interests": ", ".join(interests)},
            headers={"Authorization": f"Bearer {self._access}"},
            name="/api/v1/auth/update-profile/",
            catch_response=True,
        ) as resp:
            if resp.status_code in (200, 201):
                resp.success()
            else:
                resp.failure(f"Profile update failed: {resp.status_code}")

    @tag("auth", "critical")
    def invalid_login_attempt(self):
        """Test rate limiting and error handling on bad credentials."""
        with self.client.post(
            "/api/v1/auth/login/",
            json={
                "email": f"nonexistent_{random.randint(1,9999)}@test.com",
                "password": "WrongPassword123",
            },
            name="/api/v1/auth/login/ [INVALID]",
            catch_response=True,
        ) as resp:
            if resp.status_code in (400, 401):
                resp.success()  # Expected failure
            elif resp.status_code == 429:
                resp.success()  # Rate limited — good
            else:
                resp.failure(f"Unexpected response to invalid login: {resp.status_code}")
EOF
```

```bash
cat << 'EOF' > load_tests/scenarios/schedule_scenarios.py
"""
Schedule Browsing Scenarios
Tests: Session list, sub-sessions, bookmarks, feedback
"""

import random
from locust import tag


class ScheduleScenarioMixin:

    @tag("schedule", "critical", "read")
    def browse_schedule(self):
        """Fetch full schedule — heaviest read endpoint."""
        if not self._access:
            return
        with self.client.get(
            "/api/v1/schedule/sessions/",
            headers={"Authorization": f"Bearer {self._access}"},
            name="/api/v1/schedule/sessions/",
            catch_response=True,
        ) as resp:
            if resp.status_code == 200:
                data = resp.json()
                sessions = data if isinstance(data, list) else data.get("results", [])
                if isinstance(sessions, list):
                    self._schedule_sessions = sessions
                resp.success()
            else:
                resp.failure(f"Schedule fetch failed: {resp.status_code}")

    @tag("schedule", "read")
    def view_session_detail(self):
        """View a specific schedule session."""
        if not self._access:
            return
        sessions = getattr(self, "_schedule_sessions", [])
        if not sessions:
            self.browse_schedule()
            sessions = getattr(self, "_schedule_sessions", [])
        if not sessions:
            return
        session = random.choice(sessions)
        sid = session.get("id", "")
        if not sid:
            return
        with self.client.get(
            f"/api/v1/schedule/sessions/{sid}/",
            headers={"Authorization": f"Bearer {self._access}"},
            name="/api/v1/schedule/sessions/[id]/",
            catch_response=True,
        ) as resp:
            if resp.status_code == 200:
                resp.success()
            elif resp.status_code == 404:
                resp.success()  # Session may have been deleted
            else:
                resp.failure(f"Session detail failed: {resp.status_code}")

    @tag("schedule", "write")
    def toggle_bookmark(self):
        """Bookmark/unbookmark a session."""
        if not self._access:
            return
        sessions = getattr(self, "_schedule_sessions", [])
        if not sessions:
            return
        session = random.choice(sessions)
        sid = session.get("id", "")
        if not sid:
            return
        with self.client.post(
            f"/api/v1/schedule/sessions/{sid}/bookmark/",
            headers={"Authorization": f"Bearer {self._access}"},
            name="/api/v1/schedule/sessions/[id]/bookmark/",
            catch_response=True,
        ) as resp:
            if resp.status_code in (200, 201, 204):
                resp.success()
            else:
                resp.failure(f"Bookmark toggle failed: {resp.status_code}")
EOF
```

```bash
cat << 'EOF' > load_tests/scenarios/chat_scenarios.py
"""
Chat & Connection Scenarios
Tests: Connection requests, conversations, messages, staff group chat
"""

import random
import uuid
from locust import tag


class ChatScenarioMixin:

    @tag("chat", "read")
    def list_conversations(self):
        """Fetch conversation list."""
        if not self._access:
            return
        with self.client.get(
            "/api/v1/chat/conversations/",
            headers={"Authorization": f"Bearer {self._access}"},
            name="/api/v1/chat/conversations/",
            catch_response=True,
        ) as resp:
            if resp.status_code == 200:
                data = resp.json()
                convs = data if isinstance(data, list) else data.get("results", data.get("conversations", []))
                if isinstance(convs, list):
                    self._conversations = convs
                resp.success()
            else:
                resp.failure(f"Conversations list failed: {resp.status_code}")

    @tag("chat", "read")
    def list_connection_requests(self):
        """Fetch pending connection requests."""
        if not self._access:
            return
        with self.client.get(
            "/api/v1/chat/requests/",
            headers={"Authorization": f"Bearer {self._access}"},
            name="/api/v1/chat/requests/",
            catch_response=True,
        ) as resp:
            if resp.status_code == 200:
                resp.success()
            else:
                resp.failure(f"Connection requests failed: {resp.status_code}")

    @tag("chat", "write")
    def send_message_to_conversation(self):
        """Send a message to an existing conversation."""
        if not self._access:
            return
        convs = getattr(self, "_conversations", [])
        if not convs:
            self.list_conversations()
            convs = getattr(self, "_conversations", [])
        if not convs:
            return
        conv = random.choice(convs)
        conv_id = conv.get("id", "")
        if not conv_id:
            return
        with self.client.post(
            f"/api/v1/chat/conversations/{conv_id}/messages/",
            json={"content": f"Load test message {uuid.uuid4().hex[:8]}"},
            headers={"Authorization": f"Bearer {self._access}"},
            name="/api/v1/chat/conversations/[id]/messages/",
            catch_response=True,
        ) as resp:
            if resp.status_code in (200, 201):
                resp.success()
            else:
                resp.failure(f"Send message failed: {resp.status_code}")

    @tag("chat", "staff", "write")
    def staff_group_chat_read(self):
        """Read staff group chat messages."""
        if not self._access:
            return
        user = getattr(self, "_user", {})
        if user.get("role") not in ("super_admin", "mgmt_admin", "team_head", "staff"):
            return
        with self.client.get(
            "/api/v1/chat/staff-group/",
            headers={"Authorization": f"Bearer {self._access}"},
            name="/api/v1/chat/staff-group/ [GET]",
            catch_response=True,
        ) as resp:
            if resp.status_code == 200:
                resp.success()
            elif resp.status_code == 403:
                resp.success()  # Expected for non-staff
            else:
                resp.failure(f"Staff group chat read failed: {resp.status_code}")

    @tag("chat", "staff", "write")
    def staff_group_chat_send(self):
        """Send message to staff group chat."""
        if not self._access:
            return
        user = getattr(self, "_user", {})
        if user.get("role") not in ("super_admin", "mgmt_admin", "team_head", "staff"):
            return
        with self.client.post(
            "/api/v1/chat/staff-group/",
            json={"content": f"[LOAD TEST] Status check {random.randint(1, 999)}"},
            headers={"Authorization": f"Bearer {self._access}"},
            name="/api/v1/chat/staff-group/ [POST]",
            catch_response=True,
        ) as resp:
            if resp.status_code in (200, 201):
                resp.success()
            elif resp.status_code == 403:
                resp.success()
            else:
                resp.failure(f"Staff group chat send failed: {resp.status_code}")

    @tag("chat", "write")
    def send_connection_request(self):
        """Send a connection request to a random user."""
        if not self._access:
            return
        users = getattr(self, "_network_users", [])
        if not users:
            return
        target = random.choice(users)
        target_id = target.get("id", "")
        if not target_id:
            return
        with self.client.post(
            "/api/v1/chat/send-request/",
            json={"receiver_id": str(target_id)},
            headers={"Authorization": f"Bearer {self._access}"},
            name="/api/v1/chat/send-request/",
            catch_response=True,
        ) as resp:
            if resp.status_code in (200, 201, 400):
                resp.success()  # 400 = already connected, acceptable
            else:
                resp.failure(f"Connection request failed: {resp.status_code}")
EOF
```

```bash
cat << 'EOF' > load_tests/scenarios/checkin_scenarios.py
"""
Check-In & Meal Scanning Scenarios
Tests: Check-in list, participant lookup, meal stats
"""

from locust import tag


class CheckinScenarioMixin:

    @tag("checkin", "read")
    def checkin_list(self):
        """Fetch check-in statistics."""
        if not self._access:
            return
        with self.client.get(
            "/api/v1/checkins/list/",
            headers={"Authorization": f"Bearer {self._access}"},
            name="/api/v1/checkins/list/",
            catch_response=True,
        ) as resp:
            if resp.status_code == 200:
                resp.success()
            elif resp.status_code == 403:
                resp.success()  # Non-admin
            else:
                resp.failure(f"Checkin list failed: {resp.status_code}")

    @tag("checkin", "read")
    def checked_in_participants(self):
        """Fetch list of checked-in participants."""
        if not self._access:
            return
        with self.client.get(
            "/api/v1/checkins/checked-in/",
            headers={"Authorization": f"Bearer {self._access}"},
            name="/api/v1/checkins/checked-in/",
            catch_response=True,
        ) as resp:
            if resp.status_code == 200:
                resp.success()
            elif resp.status_code == 403:
                resp.success()
            else:
                resp.failure(f"Checked-in list failed: {resp.status_code}")

    @tag("checkin", "read")
    def meal_stats(self):
        """Fetch meal statistics."""
        if not self._access:
            return
        with self.client.get(
            "/api/v1/checkins/meal-stats/",
            headers={"Authorization": f"Bearer {self._access}"},
            name="/api/v1/checkins/meal-stats/",
            catch_response=True,
        ) as resp:
            if resp.status_code in (200, 403, 404):
                resp.success()
            else:
                resp.failure(f"Meal stats failed: {resp.status_code}")

    @tag("checkin", "read")
    def network_list(self):
        """Fetch network/discovery list — used for connection requests too."""
        if not self._access:
            return
        with self.client.get(
            "/api/v1/checkins/network/",
            headers={"Authorization": f"Bearer {self._access}"},
            name="/api/v1/checkins/network/",
            catch_response=True,
        ) as resp:
            if resp.status_code == 200:
                data = resp.json()
                users = data if isinstance(data, list) else data.get("results", data.get("users", []))
                if isinstance(users, list):
                    self._network_users = users
                resp.success()
            else:
                resp.failure(f"Network list failed: {resp.status_code}")
EOF
```

```bash
cat << 'EOF' > load_tests/scenarios/photo_scenarios.py
"""
Photo & Checkpoint Scenarios
Tests: Photo gallery, photo upload, checkpoint list, selfie submission
"""

import random
import io
from locust import tag


class PhotoScenarioMixin:

    @tag("photos", "read")
    def browse_photos(self):
        """Fetch photo gallery."""
        if not self._access:
            return
        with self.client.get(
            "/api/v1/photos/",
            headers={"Authorization": f"Bearer {self._access}"},
            name="/api/v1/photos/",
            catch_response=True,
        ) as resp:
            if resp.status_code == 200:
                resp.success()
            else:
                resp.failure(f"Photos fetch failed: {resp.status_code}")

    @tag("photos", "write", "heavy")
    def upload_photo(self):
        """Upload a test photo — generates a small JPEG in memory."""
        if not self._access:
            return
        # Generate a minimal valid JPEG (1x1 pixel, ~631 bytes)
        jpeg_bytes = (
            b'\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01'
            b'\x00\x00\xff\xdb\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07'
            b'\x07\t\t\x08\n\x0c\x14\r\x0c\x0b\x0b\x0c\x19\x12\x13\x0f\x14'
            b'\x1d\x1a\x1f\x1e\x1d\x1a\x1c\x1c $.\' ",#\x1c\x1c(7),01444\x1f'
            b"'9=82<.342\xff\xc0\x00\x0b\x08\x00\x01\x00\x01\x01\x01\x11\x00"
            b'\xff\xc4\x00\x1f\x00\x00\x01\x05\x01\x01\x01\x01\x01\x01\x00'
            b'\x00\x00\x00\x00\x00\x00\x00\x01\x02\x03\x04\x05\x06\x07\x08'
            b'\t\n\x0b\xff\xc4\x00\xb5\x10\x00\x02\x01\x03\x03\x02\x04\x03'
            b'\x05\x05\x04\x04\x00\x00\x01}\x01\x02\x03\x00\x04\x11\x05\x12'
            b'!1A\x06\x13Qa\x07"q\x142\x81\x91\xa1\x08#B\xb1\xc1\x15R\xd1'
            b'\xf0$3br\x82\t\n\x16\x17\x18\x19\x1a%&\'()*456789:CDEFGHIJSTU'
            b'VWXYZcdefghijstuvwxyz\x83\x84\x85\x86\x87\x88\x89\x8a\x92\x93'
            b'\x94\x95\x96\x97\x98\x99\x9a\xa2\xa3\xa4\xa5\xa6\xa7\xa8\xa9'
            b'\xaa\xb2\xb3\xb4\xb5\xb6\xb7\xb8\xb9\xba\xc2\xc3\xc4\xc5\xc6'
            b'\xc7\xc8\xc9\xca\xd2\xd3\xd4\xd5\xd6\xd7\xd8\xd9\xda\xe1\xe2'
            b'\xe3\xe4\xe5\xe6\xe7\xe8\xe9\xea\xf1\xf2\xf3\xf4\xf5\xf6\xf7'
            b'\xf8\xf9\xfa\xff\xda\x00\x08\x01\x01\x00\x00?\x00\xfb\xd2\x8a'
            b'+\xff\xd9'
        )
        with self.client.post(
            "/api/v1/photos/upload/",
            files={"photo": ("test_load.jpg", io.BytesIO(jpeg_bytes), "image/jpeg")},
            headers={"Authorization": f"Bearer {self._access}"},
            name="/api/v1/photos/upload/",
            catch_response=True,
        ) as resp:
            if resp.status_code in (200, 201):
                resp.success()
            elif resp.status_code in (400, 403):
                resp.success()  # Upload disabled or quota reached
            else:
                resp.failure(f"Photo upload failed: {resp.status_code}")

    @tag("checkpoint", "read")
    def list_checkpoints(self):
        """Fetch checkpoint/selfie points list."""
        if not self._access:
            return
        with self.client.get(
            "/api/v1/photos/selfie-points/",
            headers={"Authorization": f"Bearer {self._access}"},
            name="/api/v1/photos/selfie-points/",
            catch_response=True,
        ) as resp:
            if resp.status_code == 200:
                data = resp.json()
                points = data if isinstance(data, list) else data.get("results", data.get("points", []))
                if isinstance(points, list):
                    self._checkpoints = points
                resp.success()
            else:
                resp.failure(f"Checkpoint list failed: {resp.status_code}")

    @tag("checkpoint", "write", "heavy")
    def submit_checkpoint_selfie(self):
        """Submit a selfie to a checkpoint."""
        if not self._access:
            return
        checkpoints = getattr(self, "_checkpoints", [])
        if not checkpoints:
            return
        cp = random.choice(checkpoints)
        cp_id = cp.get("id", "")
        if not cp_id:
            return
        # Minimal JPEG
        jpeg_bytes = b'\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00\xff\xd9'
        from config import TEST_LOCATIONS
        loc = random.choice(TEST_LOCATIONS)
        with self.client.post(
            f"/api/v1/photos/selfie-points/{cp_id}/submit/",
            files={"photo": ("selfie.jpg", io.BytesIO(jpeg_bytes), "image/jpeg")},
            data={"latitude": str(loc["lat"]), "longitude": str(loc["lng"])},
            headers={"Authorization": f"Bearer {self._access}"},
            name="/api/v1/photos/selfie-points/[id]/submit/",
            catch_response=True,
        ) as resp:
            if resp.status_code in (200, 201, 400):
                resp.success()  # 400 = already submitted or out of range
            else:
                resp.failure(f"Checkpoint submit failed: {resp.status_code}")
EOF
```

```bash
cat << 'EOF' > load_tests/scenarios/poll_scenarios.py
"""
Poll Voting Scenarios
Tests: Poll list, vote, results
"""

import random
from locust import tag


class PollScenarioMixin:

    @tag("polls", "read")
    def list_polls(self):
        """Fetch active polls."""
        if not self._access:
            return
        with self.client.get(
            "/api/v1/polls/",
            headers={"Authorization": f"Bearer {self._access}"},
            name="/api/v1/polls/",
            catch_response=True,
        ) as resp:
            if resp.status_code == 200:
                data = resp.json()
                polls = data if isinstance(data, list) else data.get("results", data.get("polls", []))
                if isinstance(polls, list):
                    self._polls = polls
                resp.success()
            else:
                resp.failure(f"Polls fetch failed: {resp.status_code}")

    @tag("polls", "write")
    def vote_on_poll(self):
        """Vote on a random poll."""
        if not self._access:
            return
        polls = getattr(self, "_polls", [])
        if not polls:
            self.list_polls()
            polls = getattr(self, "_polls", [])
        if not polls:
            return
        poll = random.choice(polls)
        poll_id = poll.get("id", "")
        options = poll.get("options", [])
        if not poll_id or not options:
            return
        option = random.choice(options)
        option_id = option.get("id", "")
        if not option_id:
            return
        with self.client.post(
            f"/api/v1/polls/{poll_id}/vote/",
            json={"option_id": option_id},
            headers={"Authorization": f"Bearer {self._access}"},
            name="/api/v1/polls/[id]/vote/",
            catch_response=True,
        ) as resp:
            if resp.status_code in (200, 201, 400):
                resp.success()  # 400 = already voted
            else:
                resp.failure(f"Poll vote failed: {resp.status_code}")
EOF
```

```bash
cat << 'EOF' > load_tests/scenarios/staff_scenarios.py
"""
Staff Directory & Admin CRUD Scenarios
Tests: Directory listing, detail view, admin create/edit/delete
"""

import random
import uuid
from locust import tag


class StaffScenarioMixin:

    @tag("staff", "read")
    def browse_staff_directory(self):
        """Fetch staff directory."""
        if not self._access:
            return
        with self.client.get(
            "/api/v1/auth/staff/",
            headers={"Authorization": f"Bearer {self._access}"},
            name="/api/v1/auth/staff/",
            catch_response=True,
        ) as resp:
            if resp.status_code == 200:
                data = resp.json()
                staff = data if isinstance(data, list) else data.get("results", data.get("staff", []))
                if isinstance(staff, list):
                    self._staff_list = staff
                resp.success()
            else:
                resp.failure(f"Staff directory failed: {resp.status_code}")

    @tag("staff", "read")
    def view_staff_detail(self):
        """View a specific staff member's profile."""
        if not self._access:
            return
        staff = getattr(self, "_staff_list", [])
        if not staff:
            self.browse_staff_directory()
            staff = getattr(self, "_staff_list", [])
        if not staff:
            return
        member = random.choice(staff)
        # Use user_id (UUID) not id (StaffProfile int)
        uid = member.get("user_id", member.get("id", ""))
        if not uid:
            return
        with self.client.get(
            f"/api/v1/auth/staff/{uid}/",
            headers={"Authorization": f"Bearer {self._access}"},
            name="/api/v1/auth/staff/[uuid]/",
            catch_response=True,
        ) as resp:
            if resp.status_code == 200:
                resp.success()
            elif resp.status_code == 404:
                resp.success()  # May have been deleted
            else:
                resp.failure(f"Staff detail failed: {resp.status_code}")

    @tag("staff", "admin", "write")
    def admin_staff_permissions(self):
        """Fetch staff permissions matrix (admin only)."""
        if not self._access:
            return
        user = getattr(self, "_user", {})
        if user.get("role") not in ("super_admin", "mgmt_admin"):
            return
        with self.client.get(
            "/api/v1/auth/staff/admin/permissions/",
            headers={"Authorization": f"Bearer {self._access}"},
            name="/api/v1/auth/staff/admin/permissions/",
            catch_response=True,
        ) as resp:
            if resp.status_code in (200, 403):
                resp.success()
            else:
                resp.failure(f"Staff permissions failed: {resp.status_code}")
EOF
```

```bash
cat << 'EOF' > load_tests/scenarios/notification_scenarios.py
"""
Notification Scenarios
Tests: List notifications, mark read, device token registration
"""

import random
import uuid
from locust import tag


class NotificationScenarioMixin:

    @tag("notifications", "read")
    def list_notifications(self):
        """Fetch notification list."""
        if not self._access:
            return
        with self.client.get(
            "/api/v1/notifications/",
            headers={"Authorization": f"Bearer {self._access}"},
            name="/api/v1/notifications/",
            catch_response=True,
        ) as resp:
            if resp.status_code == 200:
                data = resp.json()
                notifs = data if isinstance(data, list) else data.get("results", data.get("notifications", []))
                if isinstance(notifs, list):
                    self._notifications = notifs
                resp.success()
            else:
                resp.failure(f"Notifications fetch failed: {resp.status_code}")

    @tag("notifications", "write")
    def register_device_token(self):
        """Register a fake Expo push token."""
        if not self._access:
            return
        fake_token = f"ExponentPushToken[loadtest_{uuid.uuid4().hex[:16]}]"
        with self.client.post(
            "/api/v1/notifications/register-token/",
            json={"token": fake_token, "platform": "android"},
            headers={"Authorization": f"Bearer {self._access}"},
            name="/api/v1/notifications/register-token/",
            catch_response=True,
        ) as resp:
            if resp.status_code in (200, 201):
                resp.success()
            else:
                resp.failure(f"Token registration failed: {resp.status_code}")

    @tag("notifications", "write")
    def mark_notification_read(self):
        """Mark a notification as read."""
        if not self._access:
            return
        notifs = getattr(self, "_notifications", [])
        if not notifs:
            return
        notif = random.choice(notifs)
        nid = notif.get("id", "")
        if not nid:
            return
        with self.client.post(
            f"/api/v1/notifications/{nid}/read/",
            headers={"Authorization": f"Bearer {self._access}"},
            name="/api/v1/notifications/[id]/read/",
            catch_response=True,
        ) as resp:
            if resp.status_code in (200, 204, 404):
                resp.success()
            else:
                resp.failure(f"Mark read failed: {resp.status_code}")
EOF
```

```bash
cat << 'EOF' > load_tests/scenarios/leaderboard_scenarios.py
"""
Leaderboard Scenarios
Tests: Leaderboard fetch, point history
"""

from locust import tag


class LeaderboardScenarioMixin:

    @tag("leaderboard", "read")
    def view_leaderboard(self):
        """Fetch leaderboard rankings."""
        if not self._access:
            return
        with self.client.get(
            "/api/v1/leaderboard/",
            headers={"Authorization": f"Bearer {self._access}"},
            name="/api/v1/leaderboard/",
            catch_response=True,
        ) as resp:
            if resp.status_code == 200:
                resp.success()
            else:
                resp.failure(f"Leaderboard failed: {resp.status_code}")

    @tag("leaderboard", "read")
    def view_my_points(self):
        """Fetch current user's point history."""
        if not self._access:
            return
        with self.client.get(
            "/api/v1/leaderboard/my-points/",
            headers={"Authorization": f"Bearer {self._access}"},
            name="/api/v1/leaderboard/my-points/",
            catch_response=True,
        ) as resp:
            if resp.status_code in (200, 404):
                resp.success()
            else:
                resp.failure(f"My points failed: {resp.status_code}")
EOF
```

```bash
cat << 'EOF' > load_tests/scenarios/sponsor_scenarios.py
"""
Sponsor & Speaker Browsing Scenarios
Tests: List, detail views with geolocation data
"""

import random
from locust import tag


class SponsorScenarioMixin:

    @tag("sponsors", "read")
    def list_sponsors(self):
        """Fetch sponsors list."""
        if not self._access:
            return
        with self.client.get(
            "/api/v1/sponsors/",
            headers={"Authorization": f"Bearer {self._access}"},
            name="/api/v1/sponsors/",
            catch_response=True,
        ) as resp:
            if resp.status_code == 200:
                data = resp.json()
                sponsors = data if isinstance(data, list) else data.get("results", data.get("sponsors", []))
                if isinstance(sponsors, list):
                    self._sponsors = sponsors
                resp.success()
            else:
                resp.failure(f"Sponsors list failed: {resp.status_code}")

    @tag("sponsors", "read")
    def view_sponsor_detail(self):
        """View sponsor detail."""
        if not self._access:
            return
        sponsors = getattr(self, "_sponsors", [])
        if not sponsors:
            self.list_sponsors()
            sponsors = getattr(self, "_sponsors", [])
        if not sponsors:
            return
        sponsor = random.choice(sponsors)
        sid = sponsor.get("id", "")
        if not sid:
            return
        with self.client.get(
            f"/api/v1/sponsors/{sid}/",
            headers={"Authorization": f"Bearer {self._access}"},
            name="/api/v1/sponsors/[id]/",
            catch_response=True,
        ) as resp:
            if resp.status_code in (200, 404):
                resp.success()
            else:
                resp.failure(f"Sponsor detail failed: {resp.status_code}")

    @tag("speakers", "read")
    def list_speakers(self):
        """Fetch speakers list."""
        if not self._access:
            return
        with self.client.get(
            "/api/v1/speakers/",
            headers={"Authorization": f"Bearer {self._access}"},
            name="/api/v1/speakers/",
            catch_response=True,
        ) as resp:
            if resp.status_code == 200:
                resp.success()
            else:
                resp.failure(f"Speakers list failed: {resp.status_code}")

    @tag("speakers", "read")
    def view_speaker_detail(self):
        """View a random speaker's detail."""
        if not self._access:
            return
        # Attempt to get a speaker ID from previous responses
        with self.client.get(
            "/api/v1/speakers/",
            headers={"Authorization": f"Bearer {self._access}"},
            name="/api/v1/speakers/ [for detail]",
            catch_response=True,
        ) as resp:
            if resp.status_code == 200:
                data = resp.json()
                speakers = data if isinstance(data, list) else data.get("results", data.get("speakers", []))
                if isinstance(speakers, list) and speakers:
                    speaker = random.choice(speakers)
                    sid = speaker.get("id", "")
                    if sid:
                        self.client.get(
                            f"/api/v1/speakers/{sid}/",
                            headers={"Authorization": f"Bearer {self._access}"},
                            name="/api/v1/speakers/[id]/",
                        )
                resp.success()

    @tag("discovery", "read")
    def discover_users(self):
        """Fetch discover/networking suggestions."""
        if not self._access:
            return
        with self.client.get(
            "/api/v1/auth/discover/",
            headers={"Authorization": f"Bearer {self._access}"},
            name="/api/v1/auth/discover/",
            catch_response=True,
        ) as resp:
            if resp.status_code in (200, 404):
                resp.success()
            else:
                resp.failure(f"Discover failed: {resp.status_code}")

    @tag("recap", "read")
    def view_recap(self):
        """Fetch personal recap."""
        if not self._access:
            return
        with self.client.get(
            "/api/v1/auth/my-recap/",
            headers={"Authorization": f"Bearer {self._access}"},
            name="/api/v1/auth/my-recap/",
            catch_response=True,
        ) as resp:
            if resp.status_code in (200, 404):
                resp.success()
            else:
                resp.failure(f"Recap failed: {resp.status_code}")
EOF
```

## Step 5: Master Locust File

```bash
cat << 'EOF' > load_tests/locustfile.py
"""
ETD 2026 Conference App — Production Load Test Suite
Master orchestrator combining all scenario behaviors

Usage:
  cd /home/baadalvm/eventapp/load_tests
  locust -f locustfile.py --headless -u 50 -r 5 -t 5m --host http://10.17.9.48:8000
  locust -f locustfile.py --web-host 0.0.0.0 --web-port 8089 --host http://10.17.9.48:8000
"""

import random
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from locust import HttpUser, task, between, events, tag
from config import (
    ADMIN_USERS, STAFF_USERS, PARTICIPANT_USERS,
    WEIGHTS, REQUEST_TIMEOUT,
)
from scenarios.auth_scenarios import AuthScenarioMixin
from scenarios.schedule_scenarios import ScheduleScenarioMixin
from scenarios.chat_scenarios import ChatScenarioMixin
from scenarios.checkin_scenarios import CheckinScenarioMixin
from scenarios.photo_scenarios import PhotoScenarioMixin
from scenarios.poll_scenarios import PollScenarioMixin
from scenarios.staff_scenarios import StaffScenarioMixin
from scenarios.notification_scenarios import NotificationScenarioMixin
from scenarios.leaderboard_scenarios import LeaderboardScenarioMixin
from scenarios.sponsor_scenarios import SponsorScenarioMixin


# ─── User Pool ────────────────────────────────────────────────────
ALL_USERS = ADMIN_USERS + STAFF_USERS + PARTICIPANT_USERS
# Add dummy users
for i in range(1, 51):
    ALL_USERS.append({
        "email": f"user{i:03d}.test@test.com",
        "password": "Test@1234",
    })


class ConferenceParticipant(
    HttpUser,
    AuthScenarioMixin,
    ScheduleScenarioMixin,
    ChatScenarioMixin,
    CheckinScenarioMixin,
    PhotoScenarioMixin,
    PollScenarioMixin,
    StaffScenarioMixin,
    NotificationScenarioMixin,
    LeaderboardScenarioMixin,
    SponsorScenarioMixin,
):
    """
    Simulates a real conference attendee with realistic browsing patterns.
    Weight distribution matches expected real-world usage.
    """
    wait_time = between(1, 5)  # 1-5 seconds between actions
    weight = 8  # 80% of virtual users are participants

    _access = None
    _refresh = None
    _user = {}
    _credentials = None

    def on_start(self):
        """Login on spawn."""
        self._credentials = random.choice(PARTICIPANT_USERS + [
            {"email": f"user{random.randint(1,50):03d}.test@test.com", "password": "Test@1234"}
        ])
        self.login_flow()

    def _get_credentials(self):
        return self._credentials or random.choice(PARTICIPANT_USERS)

    @task(WEIGHTS["browse_schedule"])
    def task_browse_schedule(self):
        self.browse_schedule()

    @task(WEIGHTS["view_notifications"])
    def task_view_notifications(self):
        self.list_notifications()

    @task(WEIGHTS["browse_sponsors"])
    def task_browse_sponsors(self):
        self.list_sponsors()

    @task(WEIGHTS["browse_speakers"])
    def task_browse_speakers(self):
        self.list_speakers()

    @task(WEIGHTS["view_leaderboard"])
    def task_view_leaderboard(self):
        self.view_leaderboard()

    @task(WEIGHTS["browse_photos"])
    def task_browse_photos(self):
        self.browse_photos()

    @task(WEIGHTS["vote_poll"])
    def task_vote_poll(self):
        self.vote_on_poll()

    @task(WEIGHTS["view_staff_directory"])
    def task_view_staff(self):
        self.browse_staff_directory()

    @task(WEIGHTS["chat_send_message"])
    def task_chat(self):
        action = random.choice([
            self.list_conversations,
            self.list_connection_requests,
            self.send_message_to_conversation,
        ])
        action()

    @task(3)
    def task_profile_actions(self):
        action = random.choice([
            self.fetch_profile,
            self.update_profile,
            self.token_refresh_flow,
        ])
        action()

    @task(2)
    def task_discover(self):
        self.discover_users()

    @task(1)
    def task_recap(self):
        self.view_recap()

    @task(2)
    def task_sponsor_detail(self):
        self.view_sponsor_detail()

    @task(2)
    def task_speaker_detail(self):
        self.view_speaker_detail()

    @task(2)
    def task_staff_detail(self):
        self.view_staff_detail()

    @task(1)
    def task_session_detail(self):
        self.view_session_detail()

    @task(1)
    def task_bookmark(self):
        self.toggle_bookmark()

    @task(1)
    def task_checkpoints(self):
        self.list_checkpoints()

    @task(1)
    def task_network(self):
        self.network_list()


class StaffUser(
    HttpUser,
    AuthScenarioMixin,
    ScheduleScenarioMixin,
    ChatScenarioMixin,
    CheckinScenarioMixin,
    StaffScenarioMixin,
    NotificationScenarioMixin,
    LeaderboardScenarioMixin,
    SponsorScenarioMixin,
    PhotoScenarioMixin,
    PollScenarioMixin,
):
    """
    Simulates staff/team_head users doing admin work + normal browsing.
    """
    wait_time = between(2, 8)
    weight = 2  # 20% of virtual users are staff

    _access = None
    _refresh = None
    _user = {}
    _credentials = None

    def on_start(self):
        self._credentials = random.choice(STAFF_USERS + ADMIN_USERS)
        self.login_flow()

    def _get_credentials(self):
        return self._credentials or random.choice(STAFF_USERS)

    @task(10)
    def task_staff_group_chat(self):
        action = random.choice([
            self.staff_group_chat_read,
            self.staff_group_chat_send,
        ])
        action()

    @task(8)
    def task_checkin_admin(self):
        action = random.choice([
            self.checkin_list,
            self.checked_in_participants,
            self.meal_stats,
        ])
        action()

    @task(5)
    def task_notifications(self):
        self.list_notifications()

    @task(5)
    def task_schedule(self):
        self.browse_schedule()

    @task(3)
    def task_staff_admin(self):
        action = random.choice([
            self.browse_staff_directory,
            self.admin_staff_permissions,
            self.view_staff_detail,
        ])
        action()

    @task(3)
    def task_photos_admin(self):
        self.browse_photos()

    @task(2)
    def task_polls(self):
        self.list_polls()

    @task(2)
    def task_leaderboard(self):
        self.view_leaderboard()

    @task(1)
    def task_sponsors(self):
        self.list_sponsors()

    @task(3)
    def task_chat(self):
        self.list_conversations()

    @task(2)
    def task_profile(self):
        self.fetch_profile()

    @task(1)
    def task_connection_request(self):
        self.send_connection_request()


# ─── Event Listeners for Stats ────────────────────────────────────
_stats_collector = {
    "total_requests": 0,
    "total_failures": 0,
    "response_times": [],
}


@events.request.add_listener
def on_request(request_type, name, response_time, response_length, response, exception, **kwargs):
    _stats_collector["total_requests"] += 1
    if exception or (response and response.status_code >= 400):
        _stats_collector["total_failures"] += 1
    _stats_collector["response_times"].append(response_time)


@events.quitting.add_listener
def on_quitting(environment, **kwargs):
    """Print summary on exit."""
    stats = environment.runner.stats
    print("\n" + "=" * 80)
    print("ETD 2026 LOAD TEST SUMMARY")
    print("=" * 80)
    total = stats.total
    print(f"Total Requests:    {total.num_requests}")
    print(f"Total Failures:    {total.num_failures}")
    print(f"Error Rate:        {(total.num_failures / max(total.num_requests, 1)) * 100:.2f}%")
    print(f"Avg Response Time: {total.avg_response_time:.0f}ms")
    print(f"Median:            {total.median_response_time}ms")
    print(f"95th Percentile:   {total.get_response_time_percentile(0.95):.0f}ms")
    print(f"99th Percentile:   {total.get_response_time_percentile(0.99):.0f}ms")
    print(f"Max Response Time: {total.max_response_time:.0f}ms")
    print(f"Requests/sec:      {total.total_rps:.1f}")
    print("=" * 80)
EOF
```

## Step 6: WebSocket Stress Test

```bash
cat << 'EOF' > load_tests/websocket_load.py
"""
WebSocket Voice Call Signaling Stress Test
Tests concurrent WebSocket connections and signaling throughput

Usage:
  cd /home/baadalvm/eventapp/load_tests
  python3 websocket_load.py --connections 50 --duration 120
"""

import argparse
import json
import time
import threading
import uuid
import sys
import os
from collections import defaultdict
from datetime import datetime

sys.path.insert(0, os.path.dirname(__file__))

try:
    import websocket
except ImportError:
    print("Install: pip3 install websocket-client --break-system-packages")
    sys.exit(1)

from config import WS_BASE, API_BASE, REQUEST_TIMEOUT
from auth_helper import get_tokens
from config import STAFF_USERS, ADMIN_USERS

# ─── Metrics ──────────────────────────────────────────────────────
metrics = {
    "connections_attempted": 0,
    "connections_succeeded": 0,
    "connections_failed": 0,
    "messages_sent": 0,
    "messages_received": 0,
    "errors": [],
    "connect_times_ms": [],
    "message_latencies_ms": [],
    "active_connections": 0,
    "max_concurrent": 0,
}
metrics_lock = threading.Lock()


def record_metric(key, value=1):
    with metrics_lock:
        if isinstance(metrics[key], list):
            metrics[key].append(value)
        else:
            metrics[key] += value


class WSLoadClient:
    """Single WebSocket connection simulating a call signaling client."""

    def __init__(self, user_creds, client_id, duration):
        self.creds = user_creds
        self.client_id = client_id
        self.duration = duration
        self.ws = None
        self.connected = False
        self.start_time = None

    def run(self):
        record_metric("connections_attempted")
        access, _ = get_tokens(self.creds["email"], self.creds["password"])
        if not access:
            record_metric("connections_failed")
            record_metric("errors", f"Client {self.client_id}: Auth failed for {self.creds['email']}")
            return

        ws_url = f"{WS_BASE}/ws/call/?token={access}"
        connect_start = time.time()

        try:
            self.ws = websocket.WebSocket()
            self.ws.settimeout(10)
            self.ws.connect(ws_url)
            connect_ms = (time.time() - connect_start) * 1000
            record_metric("connect_times_ms", connect_ms)
            record_metric("connections_succeeded")
            self.connected = True

            with metrics_lock:
                metrics["active_connections"] += 1
                metrics["max_concurrent"] = max(
                    metrics["max_concurrent"], metrics["active_connections"]
                )

            self.start_time = time.time()
            self._simulate_session()

        except Exception as e:
            record_metric("connections_failed")
            record_metric("errors", f"Client {self.client_id}: {str(e)[:100]}")
        finally:
            self._cleanup()

    def _simulate_session(self):
        """Simulate realistic call signaling patterns."""
        end_time = self.start_time + self.duration

        while time.time() < end_time and self.connected:
            try:
                # Send a ping/keepalive style message
                msg = {
                    "type": "ping",
                    "timestamp": time.time(),
                    "client_id": self.client_id,
                }
                send_time = time.time()
                self.ws.send(json.dumps(msg))
                record_metric("messages_sent")

                # Try to receive response
                self.ws.settimeout(2)
                try:
                    response = self.ws.recv()
                    if response:
                        latency_ms = (time.time() - send_time) * 1000
                        record_metric("messages_received")
                        record_metric("message_latencies_ms", latency_ms)
                except websocket.WebSocketTimeoutException:
                    pass  # No response within timeout — normal for ping

                # Simulate realistic inter-message delay
                time.sleep(random.uniform(1, 3))

            except websocket.WebSocketConnectionClosedException:
                self.connected = False
                break
            except Exception as e:
                record_metric("errors", f"Client {self.client_id} runtime: {str(e)[:80]}")
                break

    def _cleanup(self):
        if self.ws:
            try:
                self.ws.close()
            except Exception:
                pass
        if self.connected:
            with metrics_lock:
                metrics["active_connections"] -= 1
        self.connected = False


import random  # needed in _simulate_session


def run_ws_load_test(num_connections, duration, ramp_delay=0.1):
    """Execute WebSocket load test."""
    print(f"\n{'='*70}")
    print(f"  WebSocket Voice Call Signaling Stress Test")
    print(f"  Connections: {num_connections} | Duration: {duration}s")
    print(f"{'='*70}\n")

    all_creds = STAFF_USERS + ADMIN_USERS
    threads = []

    start = time.time()
    for i in range(num_connections):
        creds = all_creds[i % len(all_creds)]
        client = WSLoadClient(creds, i, duration)
        t = threading.Thread(target=client.run, daemon=True)
        threads.append(t)
        t.start()
        time.sleep(ramp_delay)  # Stagger connections

        if (i + 1) % 10 == 0:
            with metrics_lock:
                print(f"  [{i+1}/{num_connections}] spawned | "
                      f"Active: {metrics['active_connections']} | "
                      f"Failed: {metrics['connections_failed']}")

    print(f"\n  All {num_connections} clients spawned. Waiting for completion...\n")

    # Wait for all threads
    for t in threads:
        t.join(timeout=duration + 30)

    elapsed = time.time() - start

    # ─── Results ──────────────────────────────────────────────────
    print(f"\n{'='*70}")
    print(f"  RESULTS — WebSocket Stress Test")
    print(f"{'='*70}")
    print(f"  Duration:              {elapsed:.1f}s")
    print(f"  Connections Attempted: {metrics['connections_attempted']}")
    print(f"  Connections Succeeded: {metrics['connections_succeeded']}")
    print(f"  Connections Failed:    {metrics['connections_failed']}")
    print(f"  Max Concurrent:        {metrics['max_concurrent']}")
    print(f"  Messages Sent:         {metrics['messages_sent']}")
    print(f"  Messages Received:     {metrics['messages_received']}")

    if metrics['connect_times_ms']:
        ct = sorted(metrics['connect_times_ms'])
        print(f"  Connect Time (median): {ct[len(ct)//2]:.0f}ms")
        print(f"  Connect Time (p95):    {ct[int(len(ct)*0.95)]:.0f}ms")
        print(f"  Connect Time (max):    {ct[-1]:.0f}ms")

    if metrics['message_latencies_ms']:
        ml = sorted(metrics['message_latencies_ms'])
        print(f"  Msg Latency (median):  {ml[len(ml)//2]:.0f}ms")
        print(f"  Msg Latency (p95):     {ml[int(len(ml)*0.95)]:.0f}ms")

    if metrics['errors']:
        unique_errors = list(set(metrics['errors']))[:10]
        print(f"\n  Errors ({len(metrics['errors'])} total, showing top 10):")
        for err in unique_errors:
            print(f"    ⚠ {err}")

    success_rate = (metrics['connections_succeeded'] /
                    max(metrics['connections_attempted'], 1)) * 100
    print(f"\n  Connection Success Rate: {success_rate:.1f}%")

    if success_rate >= 95:
        print("  ✅ PASS — WebSocket infrastructure is solid")
    elif success_rate >= 80:
        print("  ⚠️  WARNING — Some connection failures under load")
    else:
        print("  ❌ FAIL — Significant WebSocket connection issues")

    print(f"{'='*70}\n")
    return metrics


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="WebSocket Load Test")
    parser.add_argument("--connections", type=int, default=50)
    parser.add_argument("--duration", type=int, default=120)
    parser.add_argument("--ramp-delay", type=float, default=0.1)
    args = parser.parse_args()

    run_ws_load_test(args.connections, args.duration, args.ramp_delay)
EOF
```

## Step 7: PDF Report Generator

```bash
cat << 'EOF' > load_tests/report_generator.py
"""
ETD 2026 Load Test — PDF Report Generator
Generates production-grade PDF reports with charts, metrics, and issue flags.
"""

import os
import sys
import json
import csv
import io
import math
from datetime import datetime

sys.path.insert(0, os.path.dirname(__file__))

try:
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    import matplotlib.ticker as mticker
    import numpy as np
except ImportError:
    print("Install: pip3 install matplotlib numpy --break-system-packages")
    sys.exit(1)

try:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import inch, mm
    from reportlab.lib.colors import HexColor, black, white, red, green, orange
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
        Image, PageBreak, KeepTogether, HRFlowable,
    )
    from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
except ImportError:
    print("Install: pip3 install reportlab --break-system-packages")
    sys.exit(1)

from config import SLA, PROFILES

# ─── Colors ───────────────────────────────────────────────────────
BRAND = HexColor("#1a73e8")
BRAND_LIGHT = HexColor("#e8f0fe")
SUCCESS = HexColor("#0f9d58")
DANGER = HexColor("#ea4335")
WARNING = HexColor("#f9ab00")
SURFACE = HexColor("#f8f9fa")
TEXT = HexColor("#202124")
TEXT_SEC = HexColor("#5f6368")
BORDER = HexColor("#dadce0")


def parse_locust_stats_csv(csv_path):
    """Parse Locust stats CSV output into structured data."""
    entries = []
    if not os.path.exists(csv_path):
        return entries
    with open(csv_path, 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            entries.append(row)
    return entries


def parse_locust_stats_history_csv(csv_path):
    """Parse Locust stats history CSV for time-series charts."""
    entries = []
    if not os.path.exists(csv_path):
        return entries
    with open(csv_path, 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            entries.append(row)
    return entries


def _generate_response_time_chart(stats, output_path):
    """Bar chart: Response times per endpoint (p50, p95, p99)."""
    endpoints = []
    p50s, p95s, p99s = [], [], []

    for s in stats:
        name = s.get("Name", "")
        if name == "Aggregated" or not name:
            continue
        endpoints.append(name[:40])  # Truncate long names
        p50s.append(float(s.get("50%", 0) or 0))
        p95s.append(float(s.get("95%", 0) or 0))
        p99s.append(float(s.get("99%", 0) or 0))

    if not endpoints:
        return None

    # Sort by p95 descending for readability
    combined = sorted(zip(endpoints, p50s, p95s, p99s), key=lambda x: x[2], reverse=True)
    # Take top 15
    combined = combined[:15]
    endpoints = [c[0] for c in combined]
    p50s = [c[1] for c in combined]
    p95s = [c[2] for c in combined]
    p99s = [c[3] for c in combined]

    fig, ax = plt.subplots(figsize=(12, max(6, len(endpoints) * 0.4)))
    y = np.arange(len(endpoints))
    height = 0.25

    bars1 = ax.barh(y - height, p50s, height, label='p50', color='#1a73e8', alpha=0.8)
    bars2 = ax.barh(y, p95s, height, label='p95', color='#f9ab00', alpha=0.8)
    bars3 = ax.barh(y + height, p99s, height, label='p99', color='#ea4335', alpha=0.8)

    # SLA lines
    ax.axvline(x=SLA["p50_ms"], color='#1a73e8', linestyle='--', alpha=0.4, label=f'p50 SLA ({SLA["p50_ms"]}ms)')
    ax.axvline(x=SLA["p95_ms"], color='#f9ab00', linestyle='--', alpha=0.4, label=f'p95 SLA ({SLA["p95_ms"]}ms)')
    ax.axvline(x=SLA["p99_ms"], color='#ea4335', linestyle='--', alpha=0.4, label=f'p99 SLA ({SLA["p99_ms"]}ms)')

    ax.set_yticks(y)
    ax.set_yticklabels(endpoints, fontsize=8)
    ax.set_xlabel('Response Time (ms)')
    ax.set_title('Response Time Distribution by Endpoint', fontweight='bold', fontsize=12)
    ax.legend(loc='lower right', fontsize=8)
    ax.grid(axis='x', alpha=0.3)

    plt.tight_layout()
    plt.savefig(output_path, dpi=150, bbox_inches='tight')
    plt.close()
    return output_path


def _generate_error_rate_chart(stats, output_path):
    """Bar chart: Error rate per endpoint."""
    endpoints = []
    error_rates = []
    colors = []

    for s in stats:
        name = s.get("Name", "")
        if name == "Aggregated" or not name:
            continue
        total = int(s.get("Request Count", 0) or 0)
        failures = int(s.get("Failure Count", 0) or 0)
        if total == 0:
            continue
        rate = (failures / total) * 100
        if rate > 0:  # Only show endpoints with errors
            endpoints.append(name[:40])
            error_rates.append(rate)
            colors.append('#ea4335' if rate > SLA["error_rate_pct"] else '#f9ab00')

    if not endpoints:
        return None

    # Sort by error rate descending
    combined = sorted(zip(endpoints, error_rates, colors), key=lambda x: x[1], reverse=True)
    endpoints = [c[0] for c in combined[:15]]
    error_rates = [c[1] for c in combined[:15]]
    colors = [c[2] for c in combined[:15]]

    fig, ax = plt.subplots(figsize=(10, max(4, len(endpoints) * 0.35)))
    y = np.arange(len(endpoints))
    ax.barh(y, error_rates, color=colors, alpha=0.85)
    ax.axvline(x=SLA["error_rate_pct"], color='#ea4335', linestyle='--',
               alpha=0.6, label=f'SLA ({SLA["error_rate_pct"]}%)')
    ax.set_yticks(y)
    ax.set_yticklabels(endpoints, fontsize=8)
    ax.set_xlabel('Error Rate (%)')
    ax.set_title('Error Rate by Endpoint', fontweight='bold', fontsize=12)
    ax.legend()
    ax.grid(axis='x', alpha=0.3)

    plt.tight_layout()
    plt.savefig(output_path, dpi=150, bbox_inches='tight')
    plt.close()
    return output_path


def _generate_throughput_chart(stats, output_path):
    """Bar chart: Requests/sec per endpoint."""
    endpoints = []
    rps_values = []

    for s in stats:
        name = s.get("Name", "")
        if name == "Aggregated" or not name:
            continue
        rps = float(s.get("Requests/s", 0) or 0)
        if rps > 0:
            endpoints.append(name[:40])
            rps_values.append(rps)

    if not endpoints:
        return None

    combined = sorted(zip(endpoints, rps_values), key=lambda x: x[1], reverse=True)[:15]
    endpoints = [c[0] for c in combined]
    rps_values = [c[1] for c in combined]

    fig, ax = plt.subplots(figsize=(10, max(4, len(endpoints) * 0.35)))
    y = np.arange(len(endpoints))
    bars = ax.barh(y, rps_values, color='#0f9d58', alpha=0.8)
    ax.set_yticks(y)
    ax.set_yticklabels(endpoints, fontsize=8)
    ax.set_xlabel('Requests/sec')
    ax.set_title('Throughput by Endpoint', fontweight='bold', fontsize=12)
    ax.grid(axis='x', alpha=0.3)

    plt.tight_layout()
    plt.savefig(output_path, dpi=150, bbox_inches='tight')
    plt.close()
    return output_path


def _generate_rps_timeline_chart(history, output_path):
    """Line chart: RPS over time."""
    if not history:
        return None

    timestamps = []
    rps = []
    users = []
    for entry in history:
        ts = float(entry.get("Timestamp", 0) or 0)
        if ts == 0:
            continue
        timestamps.append(ts)
        rps.append(float(entry.get("Requests/s", 0) or 0))
        users.append(int(entry.get("User count", 0) or 0))

    if not timestamps:
        return None

    # Normalize timestamps to elapsed seconds
    t0 = timestamps[0]
    elapsed = [(t - t0) for t in timestamps]

    fig, ax1 = plt.subplots(figsize=(12, 5))
    ax1.plot(elapsed, rps, color='#1a73e8', linewidth=1.5, label='Requests/s', alpha=0.8)
    ax1.fill_between(elapsed, rps, alpha=0.1, color='#1a73e8')
    ax1.set_xlabel('Elapsed Time (seconds)')
    ax1.set_ylabel('Requests/sec', color='#1a73e8')
    ax1.tick_params(axis='y', labelcolor='#1a73e8')
    ax1.grid(alpha=0.3)

    ax2 = ax1.twinx()
    ax2.plot(elapsed, users, color='#ea4335', linewidth=1, linestyle='--',
             label='Active Users', alpha=0.6)
    ax2.set_ylabel('Active Users', color='#ea4335')
    ax2.tick_params(axis='y', labelcolor='#ea4335')

    fig.suptitle('Throughput & User Count Over Time', fontweight='bold', fontsize=12)
    lines1, labels1 = ax1.get_legend_handles_labels()
    lines2, labels2 = ax2.get_legend_handles_labels()
    ax1.legend(lines1 + lines2, labels1 + labels2, loc='upper left')

    plt.tight_layout()
    plt.savefig(output_path, dpi=150, bbox_inches='tight')
    plt.close()
    return output_path


def _generate_response_time_timeline_chart(history, output_path):
    """Line chart: Response time percentiles over time."""
    if not history:
        return None

    timestamps = []
    p50, p95, p99 = [], [], []
    for entry in history:
        ts = float(entry.get("Timestamp", 0) or 0)
        if ts == 0:
            continue
        timestamps.append(ts)
        p50.append(float(entry.get("50%", 0) or 0))
        p95.append(float(entry.get("95%", 0) or 0))
        p99.append(float(entry.get("99%", 0) or 0))

    if not timestamps:
        return None

    t0 = timestamps[0]
    elapsed = [(t - t0) for t in timestamps]

    fig, ax = plt.subplots(figsize=(12, 5))
    ax.plot(elapsed, p50, color='#1a73e8', linewidth=1.5, label='p50', alpha=0.8)
    ax.plot(elapsed, p95, color='#f9ab00', linewidth=1.5, label='p95', alpha=0.8)
    ax.plot(elapsed, p99, color='#ea4335', linewidth=1.5, label='p99', alpha=0.8)

    # SLA lines
    ax.axhline(y=SLA["p50_ms"], color='#1a73e8', linestyle=':', alpha=0.3)
    ax.axhline(y=SLA["p95_ms"], color='#f9ab00', linestyle=':', alpha=0.3)
    ax.axhline(y=SLA["p99_ms"], color='#ea4335', linestyle=':', alpha=0.3)

    ax.set_xlabel('Elapsed Time (seconds)')
    ax.set_ylabel('Response Time (ms)')
    ax.set_title('Response Time Percentiles Over Time', fontweight='bold', fontsize=12)
    ax.legend()
    ax.grid(alpha=0.3)

    plt.tight_layout()
    plt.savefig(output_path, dpi=150, bbox_inches='tight')
    plt.close()
    return output_path


def identify_issues(stats, profile_name):
    """Analyze results and flag production issues."""
    issues = []
    warnings = []
    passed = []

    aggregated = None
    for s in stats:
        if s.get("Name") == "Aggregated":
            aggregated = s
            break

    if not aggregated:
        issues.append({
            "severity": "CRITICAL",
            "title": "No Aggregated Stats Found",
            "detail": "Locust did not produce summary stats. Test may have crashed.",
            "recommendation": "Check server logs and Locust output for errors."
        })
        return issues, warnings, passed

    # ─── Error Rate ───────────────────────────────────────────────
    total_req = int(aggregated.get("Request Count", 0) or 0)
    total_fail = int(aggregated.get("Failure Count", 0) or 0)
    error_rate = (total_fail / max(total_req, 1)) * 100

    if error_rate > 10:
        issues.append({
            "severity": "CRITICAL",
            "title": f"Error Rate {error_rate:.1f}% (SLA: <{SLA['error_rate_pct']}%)",
            "detail": f"{total_fail} out of {total_req} requests failed. "
                      f"This indicates server overload or application bugs.",
            "recommendation": "1) Check Django error logs (journalctl -u django)\n"
                              "2) Monitor PostgreSQL connections (pg_stat_activity)\n"
                              "3) Check Redis memory (redis-cli info memory)\n"
                              "4) Consider connection pooling (pgbouncer)"
        })
    elif error_rate > SLA["error_rate_pct"]:
        warnings.append({
            "severity": "WARNING",
            "title": f"Error Rate {error_rate:.1f}% exceeds SLA ({SLA['error_rate_pct']}%)",
            "detail": f"{total_fail} failures detected. Mostly recoverable errors.",
            "recommendation": "Review per-endpoint error distribution. "
                              "Add retry logic for transient failures."
        })
    else:
        passed.append(f"Error Rate: {error_rate:.2f}% ✅ (SLA: <{SLA['error_rate_pct']}%)")

    # ─── Response Times ───────────────────────────────────────────
    p50 = float(aggregated.get("50%", 0) or 0)
    p95 = float(aggregated.get("95%", 0) or 0)
    p99 = float(aggregated.get("99%", 0) or 0)
    max_rt = float(aggregated.get("Max Response Time", 0) or 0)
    avg_rt = float(aggregated.get("Average Response Time", 0) or 0)

    if p95 > SLA["p95_ms"] * 3:
        issues.append({
            "severity": "CRITICAL",
            "title": f"p95 Response Time {p95:.0f}ms (SLA: {SLA['p95_ms']}ms)",
            "detail": f"p95 is {p95/SLA['p95_ms']:.1f}x over SLA. Server is overloaded.",
            "recommendation": "1) Add database indexes on frequently queried fields\n"
                              "2) Enable Django QuerySet caching\n"
                              "3) Optimize N+1 queries with select_related/prefetch_related\n"
                              "4) Consider read replicas for PostgreSQL"
        })
    elif p95 > SLA["p95_ms"]:
        warnings.append({
            "severity": "WARNING",
            "title": f"p95 Response Time {p95:.0f}ms exceeds SLA ({SLA['p95_ms']}ms)",
            "detail": f"Some requests are slow. p50={p50:.0f}ms, p99={p99:.0f}ms",
            "recommendation": "Profile slow queries with Django Debug Toolbar or "
                              "EXPLAIN ANALYZE on PostgreSQL."
        })
    else:
        passed.append(f"p95 Response Time: {p95:.0f}ms ✅ (SLA: <{SLA['p95_ms']}ms)")

    if p50 > SLA["p50_ms"]:
        warnings.append({
            "severity": "WARNING",
            "title": f"Median Response Time {p50:.0f}ms exceeds SLA ({SLA['p50_ms']}ms)",
            "detail": "More than half of requests are slower than target.",
            "recommendation": "Investigate overall server load. "
                              "Consider response caching for read-heavy endpoints."
        })
    else:
        passed.append(f"Median Response Time: {p50:.0f}ms ✅ (SLA: <{SLA['p50_ms']}ms)")

    if max_rt > 30000:
        issues.append({
            "severity": "HIGH",
            "title": f"Max Response Time {max_rt:.0f}ms ({max_rt/1000:.1f}s)",
            "detail": "Some requests took >30 seconds. Likely timeout or deadlock.",
            "recommendation": "Set Django CONN_MAX_AGE and investigate "
                              "long-running database queries."
        })

    # ─── Throughput ───────────────────────────────────────────────
    rps = float(aggregated.get("Requests/s", 0) or 0)
    if rps < SLA["min_rps"]:
        warnings.append({
            "severity": "WARNING",
            "title": f"Throughput {rps:.1f} RPS below minimum ({SLA['min_rps']} RPS)",
            "detail": "Server cannot handle minimum expected load.",
            "recommendation": "1) Increase Daphne worker count\n"
                              "2) Enable Django cache middleware\n"
                              "3) Use Gunicorn + Uvicorn workers for ASGI"
        })
    else:
        passed.append(f"Throughput: {rps:.1f} RPS ✅ (min: {SLA['min_rps']} RPS)")

    # ─── Per-Endpoint Issues ──────────────────────────────────────
    slow_endpoints = []
    error_endpoints = []
    for s in stats:
        name = s.get("Name", "")
        if name == "Aggregated" or not name:
            continue
        ep_p95 = float(s.get("95%", 0) or 0)
        ep_total = int(s.get("Request Count", 0) or 0)
        ep_fail = int(s.get("Failure Count", 0) or 0)
        ep_err = (ep_fail / max(ep_total, 1)) * 100

        if ep_p95 > SLA["p95_ms"] * 2:
            slow_endpoints.append((name, ep_p95))
        if ep_err > 5 and ep_total >= 5:
            error_endpoints.append((name, ep_err, ep_fail, ep_total))

    if slow_endpoints:
        slow_endpoints.sort(key=lambda x: x[1], reverse=True)
        detail = "\n".join([f"  • {e[0]}: p95={e[1]:.0f}ms" for e in slow_endpoints[:5]])
        warnings.append({
            "severity": "WARNING",
            "title": f"{len(slow_endpoints)} Endpoints Exceeding 2x SLA",
            "detail": f"Slowest endpoints:\n{detail}",
            "recommendation": "Add per-view caching or optimize serializers for these endpoints."
        })

    if error_endpoints:
        error_endpoints.sort(key=lambda x: x[1], reverse=True)
        detail = "\n".join([
            f"  • {e[0]}: {e[1]:.1f}% error ({e[2]}/{e[3]})"
            for e in error_endpoints[:5]
        ])
        warnings.append({
            "severity": "WARNING",
            "title": f"{len(error_endpoints)} Endpoints With >5% Error Rate",
            "detail": f"Problematic endpoints:\n{detail}",
            "recommendation": "Check server error logs for these specific routes."
        })

    return issues, warnings, passed


def generate_pdf_report(
    stats_csv_path,
    history_csv_path,
    profile_name,
    output_path,
    ws_metrics=None,
    extra_notes="",
):
    """Generate comprehensive PDF load test report."""

    stats = parse_locust_stats_csv(stats_csv_path)
    history = parse_locust_stats_history_csv(history_csv_path)
    profile = PROFILES.get(profile_name, {})

    issues, warnings, passed = identify_issues(stats, profile_name)

    # ─── Generate Charts ──────────────────────────────────────────
    charts_dir = os.path.join(os.path.dirname(output_path), "charts")
    os.makedirs(charts_dir, exist_ok=True)

    rt_chart = _generate_response_time_chart(
        stats, os.path.join(charts_dir, "response_times.png"))
    err_chart = _generate_error_rate_chart(
        stats, os.path.join(charts_dir, "error_rates.png"))
    tp_chart = _generate_throughput_chart(
        stats, os.path.join(charts_dir, "throughput.png"))
    rps_tl_chart = _generate_rps_timeline_chart(
        history, os.path.join(charts_dir, "rps_timeline.png"))
    rt_tl_chart = _generate_response_time_timeline_chart(
        history, os.path.join(charts_dir, "rt_timeline.png"))

    # ─── Build PDF ────────────────────────────────────────────────
    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        topMargin=20*mm,
        bottomMargin=20*mm,
        leftMargin=15*mm,
        rightMargin=15*mm,
    )

    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle(
        'CustomTitle', parent=styles['Title'],
        fontSize=22, textColor=BRAND, spaceAfter=5*mm,
        fontName='Helvetica-Bold',
    )
    h1 = ParagraphStyle(
        'H1', parent=styles['Heading1'],
        fontSize=16, textColor=TEXT, spaceBefore=8*mm, spaceAfter=4*mm,
        fontName='Helvetica-Bold',
    )
    h2 = ParagraphStyle(
        'H2', parent=styles['Heading2'],
        fontSize=13, textColor=TEXT, spaceBefore=5*mm, spaceAfter=3*mm,
        fontName='Helvetica-Bold',
    )
    body = ParagraphStyle(
        'Body', parent=styles['Normal'],
        fontSize=10, textColor=TEXT, spaceBefore=1*mm, spaceAfter=2*mm,
        leading=14,
    )
    body_small = ParagraphStyle(
        'BodySmall', parent=body, fontSize=8, textColor=TEXT_SEC,
    )
    issue_title = ParagraphStyle(
        'IssueTitle', parent=body, fontSize=11, fontName='Helvetica-Bold',
    )
    code_style = ParagraphStyle(
        'Code', parent=body, fontSize=8, fontName='Courier',
        textColor=TEXT_SEC, leftIndent=10*mm,
    )

    elements = []

    # ─── Cover Page ───────────────────────────────────────────────
    elements.append(Spacer(1, 30*mm))
    elements.append(Paragraph("ETD 2026 Conference App", title_style))
    elements.append(Paragraph("Production Load Test Report", ParagraphStyle(
        'Subtitle', parent=styles['Heading2'],
        fontSize=18, textColor=TEXT_SEC, spaceAfter=10*mm,
    )))
    elements.append(HRFlowable(width="100%", thickness=2, color=BRAND))
    elements.append(Spacer(1, 10*mm))

    # Meta table
    meta_data = [
        ["Test Profile", profile_name.upper()],
        ["Description", profile.get("description", "Custom run")],
        ["Virtual Users", str(profile.get("users", "N/A"))],
        ["Spawn Rate", f"{profile.get('spawn_rate', 'N/A')} users/sec"],
        ["Duration", f"{profile.get('duration_seconds', 'N/A')} seconds"],
        ["Generated", datetime.now().strftime("%Y-%m-%d %H:%M:%S IST")],
        ["Server", "10.17.9.48:8000 (IITD VM — Daphne/ASGI)"],
        ["Database", "PostgreSQL 16 (system service)"],
        ["Cache", "Redis 7 (system service)"],
    ]
    meta_table = Table(meta_data, colWidths=[45*mm, 120*mm])
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), BRAND_LIGHT),
        ('TEXTCOLOR', (0, 0), (0, -1), TEXT),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('ALIGN', (0, 0), (0, -1), 'RIGHT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('PADDING', (0, 0), (-1, -1), 6),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER),
        ('ROWBACKGROUNDS', (0, 0), (-1, -1), [white, SURFACE]),
    ]))
    elements.append(meta_table)

    # ─── Executive Summary ────────────────────────────────────────
    elements.append(PageBreak())
    elements.append(Paragraph("1. Executive Summary", h1))

    # Overall verdict
    total_critical = len([i for i in issues if i["severity"] == "CRITICAL"])
    total_high = len([i for i in issues if i["severity"] == "HIGH"])
    total_warnings = len(warnings)
    total_passed = len(passed)

    if total_critical > 0:
        verdict = "❌ FAIL — Critical issues detected"
        verdict_color = DANGER
    elif total_high > 0 or total_warnings > 3:
        verdict = "⚠️ WARNING — Issues require attention before production"
        verdict_color = WARNING
    else:
        verdict = "✅ PASS — System meets SLA requirements"
        verdict_color = SUCCESS

    verdict_table = Table(
        [[Paragraph(verdict, ParagraphStyle(
            'Verdict', parent=body, fontSize=14, textColor=white,
            fontName='Helvetica-Bold', alignment=TA_CENTER,
        ))]],
        colWidths=[170*mm],
    )
    verdict_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), verdict_color),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('PADDING', (0, 0), (-1, -1), 12),
        ('ROUNDEDCORNERS', [4, 4, 4, 4]),
    ]))
    elements.append(verdict_table)
    elements.append(Spacer(1, 5*mm))

    # Summary stats
    aggregated = None
    for s in stats:
        if s.get("Name") == "Aggregated":
            aggregated = s
            break

    if aggregated:
        total_req = int(aggregated.get("Request Count", 0) or 0)
        total_fail = int(aggregated.get("Failure Count", 0) or 0)
        error_rate = (total_fail / max(total_req, 1)) * 100
        rps_val = float(aggregated.get("Requests/s", 0) or 0)
        avg_rt_val = float(aggregated.get("Average Response Time", 0) or 0)
        p50_val = float(aggregated.get("50%", 0) or 0)
        p95_val = float(aggregated.get("95%", 0) or 0)
        p99_val = float(aggregated.get("99%", 0) or 0)

        summary_data = [
            ["Metric", "Value", "SLA", "Status"],
            ["Total Requests", f"{total_req:,}", "—", "—"],
            ["Total Failures", f"{total_fail:,}", "—",
             "🔴" if total_fail > 0 else "🟢"],
            ["Error Rate", f"{error_rate:.2f}%", f"<{SLA['error_rate_pct']}%",
             "🔴" if error_rate > SLA['error_rate_pct'] else "🟢"],
            ["Throughput", f"{rps_val:.1f} RPS", f">{SLA['min_rps']} RPS",
             "🔴" if rps_val < SLA['min_rps'] else "🟢"],
            ["Avg Response", f"{avg_rt_val:.0f}ms", "—", "—"],
            ["p50", f"{p50_val:.0f}ms", f"<{SLA['p50_ms']}ms",
             "🔴" if p50_val > SLA['p50_ms'] else "🟢"],
            ["p95", f"{p95_val:.0f}ms", f"<{SLA['p95_ms']}ms",
             "🔴" if p95_val > SLA['p95_ms'] else "🟢"],
            ["p99", f"{p99_val:.0f}ms", f"<{SLA['p99_ms']}ms",
             "🔴" if p99_val > SLA['p99_ms'] else "🟢"],
        ]
        sum_table = Table(summary_data, colWidths=[50*mm, 40*mm, 40*mm, 25*mm])
        sum_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), BRAND),
            ('TEXTCOLOR', (0, 0), (-1, 0), white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
            ('PADDING', (0, 0), (-1, -1), 5),
            ('GRID', (0, 0), (-1, -1), 0.5, BORDER),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [white, SURFACE]),
        ]))
        elements.append(sum_table)

    # Score summary
    elements.append(Spacer(1, 5*mm))
    score_text = (
        f"<b>Issues:</b> {total_critical} Critical, {total_high} High, "
        f"{total_warnings} Warnings | <b>Passed:</b> {total_passed} checks"
    )
    elements.append(Paragraph(score_text, body))

    # ─── Issues & Flags ──────────────────────────────────────────
    elements.append(Paragraph("2. Issue Flags & Recommendations", h1))

    if issues:
        elements.append(Paragraph("2.1 Critical / High Issues", h2))
        for i, issue in enumerate(issues, 1):
            sev = issue["severity"]
            sev_color = DANGER if sev == "CRITICAL" else WARNING
            elements.append(KeepTogether([
                Paragraph(f"<font color='{sev_color}'>[{sev}]</font> {issue['title']}",
                          issue_title),
                Paragraph(issue['detail'].replace('\n', '<br/>'), body),
                Paragraph(f"<b>Recommendation:</b> {issue['recommendation'].replace(chr(10), '<br/>')}",
                          body_small),
                Spacer(1, 3*mm),
            ]))

    if warnings:
        elements.append(Paragraph("2.2 Warnings", h2))
        for w in warnings:
            elements.append(KeepTogether([
                Paragraph(f"<font color='{WARNING}'>[WARNING]</font> {w['title']}",
                          issue_title),
                Paragraph(w['detail'].replace('\n', '<br/>'), body),
                Paragraph(f"<b>Recommendation:</b> {w['recommendation'].replace(chr(10), '<br/>')}",
                          body_small),
                Spacer(1, 3*mm),
            ]))

    if passed:
        elements.append(Paragraph("2.3 Passed Checks", h2))
        for p in passed:
            elements.append(Paragraph(f"  {p}", body))

    if not issues and not warnings:
        elements.append(Paragraph(
            "✅ No issues detected. All metrics within SLA thresholds.", body))

    # ─── Charts ───────────────────────────────────────────────────
    elements.append(PageBreak())
    elements.append(Paragraph("3. Performance Charts", h1))

    chart_files = [
        (rt_chart, "3.1 Response Time Distribution (p50/p95/p99 per endpoint)"),
        (err_chart, "3.2 Error Rate by Endpoint"),
        (tp_chart, "3.3 Throughput by Endpoint (Requests/sec)"),
        (rps_tl_chart, "3.4 Throughput & User Count Over Time"),
        (rt_tl_chart, "3.5 Response Time Percentiles Over Time"),
    ]

    for chart_path, title in chart_files:
        if chart_path and os.path.exists(chart_path):
            elements.append(Paragraph(title, h2))
            img = Image(chart_path)
            # Scale to fit page width
            page_w = A4[0] - 30*mm
            aspect = img.imageWidth / img.imageHeight
            img_w = min(page_w, 170*mm)
            img_h = img_w / aspect
            if img_h > 120*mm:
                img_h = 120*mm
                img_w = img_h * aspect
            img.drawWidth = img_w
            img.drawHeight = img_h
            elements.append(img)
            elements.append(Spacer(1, 5*mm))

    # ─── Detailed Endpoint Table ──────────────────────────────────
    elements.append(PageBreak())
    elements.append(Paragraph("4. Detailed Endpoint Metrics", h1))

    if stats:
        table_data = [["Endpoint", "Requests", "Failures", "Avg(ms)", "p50", "p95", "p99", "Max", "RPS"]]
        for s in stats:
            name = s.get("Name", "")
            if not name:
                continue
            table_data.append([
                name[:45],
                s.get("Request Count", "0"),
                s.get("Failure Count", "0"),
                f"{float(s.get('Average Response Time', 0) or 0):.0f}",
                s.get("50%", "0"),
                s.get("95%", "0"),
                s.get("99%", "0"),
                f"{float(s.get('Max Response Time', 0) or 0):.0f}",
                f"{float(s.get('Requests/s', 0) or 0):.1f}",
            ])

        ep_table = Table(table_data, colWidths=[
            55*mm, 15*mm, 13*mm, 13*mm, 11*mm, 11*mm, 11*mm, 13*mm, 13*mm
        ])
        ep_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), BRAND),
            ('TEXTCOLOR', (0, 0), (-1, 0), white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 7),
            ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
            ('PADDING', (0, 0), (-1, -1), 3),
            ('GRID', (0, 0), (-1, -1), 0.5, BORDER),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [white, SURFACE]),
        ]))
        elements.append(ep_table)

    # ─── WebSocket Results ────────────────────────────────────────
    if ws_metrics:
        elements.append(PageBreak())
        elements.append(Paragraph("5. WebSocket Voice Call Signaling Results", h1))

        ws_data = [
            ["Metric", "Value"],
            ["Connections Attempted", str(ws_metrics.get("connections_attempted", 0))],
            ["Connections Succeeded", str(ws_metrics.get("connections_succeeded", 0))],
            ["Connections Failed", str(ws_metrics.get("connections_failed", 0))],
            ["Max Concurrent", str(ws_metrics.get("max_concurrent", 0))],
            ["Messages Sent", str(ws_metrics.get("messages_sent", 0))],
            ["Messages Received", str(ws_metrics.get("messages_received", 0))],
        ]

        ct = sorted(ws_metrics.get("connect_times_ms", [0]))
        if ct:
            ws_data.append(["Connect Time (median)", f"{ct[len(ct)//2]:.0f}ms"])
            ws_data.append(["Connect Time (p95)", f"{ct[int(len(ct)*0.95)]:.0f}ms"])
            ws_data.append(["Connect Time (max)", f"{ct[-1]:.0f}ms"])

        ml = sorted(ws_metrics.get("message_latencies_ms", [0]))
        if ml and ml != [0]:
            ws_data.append(["Msg Latency (median)", f"{ml[len(ml)//2]:.0f}ms"])
            ws_data.append(["Msg Latency (p95)", f"{ml[int(len(ml)*0.95)]:.0f}ms"])

        success_rate = (ws_metrics.get("connections_succeeded", 0) /
                        max(ws_metrics.get("connections_attempted", 1), 1)) * 100
        ws_data.append(["Connection Success Rate", f"{success_rate:.1f}%"])

        ws_table = Table(ws_data, colWidths=[60*mm, 80*mm])
        ws_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), BRAND),
            ('TEXTCOLOR', (0, 0), (-1, 0), white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('PADDING', (0, 0), (-1, -1), 6),
            ('GRID', (0, 0), (-1, -1), 0.5, BORDER),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [white, SURFACE]),
        ]))
        elements.append(ws_table)

        # WS Issues
        ws_errors = ws_metrics.get("errors", [])
        if ws_errors:
            elements.append(Spacer(1, 5*mm))
            elements.append(Paragraph("WebSocket Errors:", h2))
            unique = list(set(ws_errors))[:10]
            for err in unique:
                elements.append(Paragraph(f"⚠ {err}", body_small))

        if success_rate >= 95:
            elements.append(Paragraph("✅ WebSocket infrastructure is solid", body))
        elif success_rate >= 80:
            elements.append(Paragraph("⚠️ Some WebSocket connection failures under load", body))
        else:
            elements.append(Paragraph("❌ Significant WebSocket issues — needs investigation", body))

    # ─── Capacity Planning ────────────────────────────────────────
    elements.append(PageBreak())
    section_num = "6" if ws_metrics else "5"
    elements.append(Paragraph(f"{section_num}. Capacity Planning & Recommendations", h1))

    if aggregated:
        rps_val = float(aggregated.get("Requests/s", 0) or 0)
        avg_rt_val = float(aggregated.get("Average Response Time", 0) or 0)
        num_users = profile.get("users", 50)

        elements.append(Paragraph(f"""
        <b>Current Capacity (measured):</b><br/>
        • Sustained throughput: {rps_val:.1f} requests/second<br/>
        • Average latency: {avg_rt_val:.0f}ms under {num_users} concurrent users<br/>
        • VM specs: 8 cores, 7.7GB RAM (Ubuntu 24.04)<br/>
        <br/>
        <b>Conference Day Estimates (200-300 attendees):</b><br/>
        • Expected peak concurrent API users: ~50-80<br/>
        • Expected RPS at peak: ~30-50 req/s<br/>
        • Schedule/Leaderboard will be hottest endpoints<br/>
        <br/>
        <b>Scaling Recommendations:</b><br/>
        1. <b>Immediate:</b> Add Redis caching for schedule and leaderboard<br/>
        2. <b>Immediate:</b> Set CONN_MAX_AGE=60 in Django settings<br/>
        3. <b>Before event:</b> Run 'peak' profile test and fix any red flags<br/>
        4. <b>Day-of:</b> Monitor with htop + pg_stat_activity + redis-cli monitor<br/>
        5. <b>Contingency:</b> If Daphne struggles, switch to Gunicorn+Uvicorn with 4 workers<br/>
        """, body))

    # ─── Footer ───────────────────────────────────────────────────
    elements.append(Spacer(1, 10*mm))
    elements.append(HRFlowable(width="100%", thickness=1, color=BORDER))
    elements.append(Paragraph(
        f"Report generated on {datetime.now().strftime('%Y-%m-%d %H:%M:%S IST')} | "
        f"ETD 2026 Load Test Suite v1.0 | IIT Delhi",
        ParagraphStyle('Footer', parent=body_small, alignment=TA_CENTER),
    ))

    # ─── Build PDF ────────────────────────────────────────────────
    doc.build(elements)
    print(f"\n✅ PDF Report generated: {output_path}")
    print(f"   File size: {os.path.getsize(output_path) / 1024:.1f} KB")
    return output_path


if __name__ == "__main__":
    # Test with sample data
    print("Report generator loaded. Use run_all_tests.sh to generate reports.")
EOF
```

## Step 8: Master Test Runner

```bash
cat << 'EOF' > load_tests/run_all_tests.sh
#!/bin/bash
#
# ETD 2026 — Production Load Test Runner
# Runs all test profiles and generates PDF reports
#
# Usage:
#   cd /home/baadalvm/eventapp/load_tests
#   chmod +x run_all_tests.sh
#   ./run_all_tests.sh [profile]
#
# Profiles: smoke, normal, peak, stress, brutal, spike, soak, all
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

RESULTS_DIR="$SCRIPT_DIR/results"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
HOST="http://10.17.9.48:8000"

mkdir -p "$RESULTS_DIR"

# ─── Color output ─────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

print_header() {
    echo ""
    echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║${NC}  ${CYAN}ETD 2026 Conference App — Production Load Test Suite${NC}       ${BLUE}║${NC}"
    echo -e "${BLUE}║${NC}  ${YELLOW}Server: $HOST${NC}                             ${BLUE}║${NC}"
    echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

run_profile() {
    local PROFILE="$1"
    local USERS RATE DURATION DESC

    case "$PROFILE" in
        smoke)    USERS=5;   RATE=1;  DURATION=60;   DESC="Smoke test" ;;
        normal)   USERS=50;  RATE=5;  DURATION=300;  DESC="Normal conference load" ;;
        peak)     USERS=150; RATE=10; DURATION=600;  DESC="Peak keynote + lunch" ;;
        stress)   USERS=300; RATE=20; DURATION=900;  DESC="2x peak stress test" ;;
        brutal)   USERS=500; RATE=30; DURATION=1200; DESC="Breaking point finder" ;;
        spike)    USERS=200; RATE=50; DURATION=300;  DESC="Sudden traffic burst" ;;
        soak)     USERS=100; RATE=5;  DURATION=3600; DESC="1-hour endurance test" ;;
        *)
            echo -e "${RED}Unknown profile: $PROFILE${NC}"
            echo "Available: smoke, normal, peak, stress, brutal, spike, soak"
            exit 1
            ;;
    esac

    local RUN_DIR="$RESULTS_DIR/${PROFILE}_${TIMESTAMP}"
    mkdir -p "$RUN_DIR"

    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}▶ Running: ${PROFILE^^} — $DESC${NC}"
    echo -e "  Users: ${YELLOW}$USERS${NC} | Spawn Rate: ${YELLOW}$RATE/s${NC} | Duration: ${YELLOW}${DURATION}s${NC}"
    echo -e "  Output: ${BLUE}$RUN_DIR/${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

    # ─── Pre-flight check ─────────────────────────────────────────
    echo -e "  ${YELLOW}⏳ Checking server availability...${NC}"
    if ! curl -s --max-time 5 "$HOST/api/v1/auth/login/" > /dev/null 2>&1; then
        echo -e "  ${RED}✗ Server not responding at $HOST${NC}"
        echo -e "  ${YELLOW}  Make sure Django/Daphne is running:${NC}"
        echo -e "  ${YELLOW}    screen -r django${NC}"
        return 1
    fi
    echo -e "  ${GREEN}✓ Server is up${NC}"

    # ─── Run Locust (headless) ────────────────────────────────────
    echo -e "  ${YELLOW}⏳ Starting load test...${NC}"

    locust -f locustfile.py \
        --headless \
        --host "$HOST" \
        -u "$USERS" \
        -r "$RATE" \
        -t "${DURATION}s" \
        --csv "$RUN_DIR/stats" \
        --html "$RUN_DIR/report.html" \
        --logfile "$RUN_DIR/locust.log" \
        --loglevel WARNING \
        2>&1 | tee "$RUN_DIR/console.log"

    echo -e "  ${GREEN}✓ Load test complete${NC}"

    # ─── Run WebSocket test (shorter duration, fewer connections) ─
    local WS_CONNS=$((USERS / 5))
    if [ "$WS_CONNS" -lt 5 ]; then WS_CONNS=5; fi
    if [ "$WS_CONNS" -gt 50 ]; then WS_CONNS=50; fi
    local WS_DUR=$((DURATION / 5))
    if [ "$WS_DUR" -lt 30 ]; then WS_DUR=30; fi
    if [ "$WS_DUR" -gt 120 ]; then WS_DUR=120; fi

    echo -e "  ${YELLOW}⏳ Running WebSocket stress test ($WS_CONNS connections, ${WS_DUR}s)...${NC}"
    python3 websocket_load.py \
        --connections "$WS_CONNS" \
        --duration "$WS_DUR" \
        2>&1 | tee "$RUN_DIR/ws_test.log"
    echo -e "  ${GREEN}✓ WebSocket test complete${NC}"

    # ─── Generate PDF Report ──────────────────────────────────────
    echo -e "  ${YELLOW}⏳ Generating PDF report...${NC}"

    python3 -c "
import sys
sys.path.insert(0, '.')
from report_generator import generate_pdf_report
generate_pdf_report(
    '$RUN_DIR/stats_stats.csv',
    '$RUN_DIR/stats_stats_history.csv',
    '$PROFILE',
    '$RUN_DIR/ETD2026_LoadTest_${PROFILE}_${TIMESTAMP}.pdf',
)
"
    echo -e "  ${GREEN}✓ PDF report generated${NC}"

    # ─── Summary ──────────────────────────────────────────────────
    echo ""
    echo -e "  ${CYAN}📁 Results saved to:${NC}"
    echo -e "     ${BLUE}$RUN_DIR/${NC}"
    ls -lh "$RUN_DIR"/*.pdf "$RUN_DIR"/*.html 2>/dev/null | awk '{print "     " $NF " (" $5 ")"}'
    echo ""
}

# ─── Main ─────────────────────────────────────────────────────────
print_header

PROFILE="${1:-smoke}"

if [ "$PROFILE" = "all" ]; then
    echo -e "${YELLOW}Running ALL profiles in sequence...${NC}"
    echo -e "${RED}⚠️  This will take 90+ minutes for full suite${NC}"
    echo ""
    for p in smoke normal peak stress spike; do
        run_profile "$p"
        echo -e "${YELLOW}  Cooling down for 30 seconds...${NC}"
        sleep 30
    done
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  ALL TESTS COMPLETE — Check results/ for PDF reports       ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
elif [ "$PROFILE" = "quick" ]; then
    echo -e "${YELLOW}Running quick validation: smoke + normal${NC}"
    run_profile "smoke"
    sleep 10
    run_profile "normal"
else
    run_profile "$PROFILE"
fi

echo ""
echo -e "${GREEN}Done! Reports are in: $RESULTS_DIR/${NC}"
echo ""
EOF

chmod +x load_tests/run_all_tests.sh
```

## Step 9: Requirements File

```bash
cat << 'EOF' > load_tests/requirements.txt
# ETD 2026 Load Test Dependencies
# Install: pip3 install -r requirements.txt --break-system-packages
locust==2.29.1
matplotlib==3.9.2
reportlab==4.2.5
websocket-client==1.8.0
numpy==1.26.4
EOF
```

---

## How to Run

### Quick Smoke Test (1 minute, 5 users)
```bash
cd /home/baadalvm/eventapp/load_tests
./run_all_tests.sh smoke
```

### Normal Conference Day Simulation (5 min, 50 users)
```bash
./run_all_tests.sh normal
```

### Peak Load — Keynote + Lunch Rush (10 min, 150 users)
```bash
./run_all_tests.sh peak
```

### Brutal Stress Test — Find Breaking Point (20 min, 500 users)
```bash
./run_all_tests.sh brutal
```

### Spike Test — Sudden Traffic Burst (5 min, 200 users at 50/sec ramp)
```bash
./run_all_tests.sh spike
```

### Soak Test — 1 Hour Endurance (memory leak detection)
```bash
./run_all_tests.sh soak
```

### Run ALL Profiles Sequentially
```bash
./run_all_tests.sh all
```

### Interactive Web UI (for live monitoring)
```bash
cd /home/baadalvm/eventapp/load_tests
locust -f locustfile.py --web-host 0.0.0.0 --web-port 8089 --host http://10.17.9.48:8000
# Then open http://10.17.9.48:8089 in browser
```

### WebSocket-Only Test
```bash
cd /home/baadalvm/eventapp/load_tests
python3 websocket_load.py --connections 50 --duration 120
```

---

## What Each PDF Report Contains

| Section | Content |
|---------|---------|
| **Cover Page** | Test profile, duration, server specs, timestamp |
| **Executive Summary** | Pass/Fail verdict, aggregated metrics vs SLA thresholds |
| **Issue Flags** | CRITICAL/HIGH/WARNING issues with root cause analysis and specific fix recommendations |
| **Passed Checks** | Green-lit SLA metrics |
| **Response Time Chart** | Horizontal bar chart — p50/p95/p99 per endpoint with SLA lines |
| **Error Rate Chart** | Bar chart — error % per endpoint, red for SLA violations |
| **Throughput Chart** | Bar chart — RPS per endpoint |
| **RPS Timeline** | Line chart — throughput + active users over time (dual Y-axis) |
| **Response Time Timeline** | Line chart — p50/p95/p99 over time with SLA reference lines |
| **Detailed Endpoint Table** | Full table with every endpoint's metrics |
| **WebSocket Results** | Connection success rate, latency, max concurrent, errors |
| **Capacity Planning** | Conference day estimates, scaling recommendations |

---

## SLA Thresholds (Configurable in config.py)

| Metric | Threshold | Rationale |
|--------|-----------|-----------|
| p50 response time | < 200ms | Users perceive as "instant" |
| p95 response time | < 1000ms | Acceptable for 95% of requests |
| p99 response time | < 3000ms | Outliers shouldn't exceed 3 seconds |
| Error rate | < 1% | Production quality |
| Min throughput | > 10 RPS | Minimum viable for 200 attendees |