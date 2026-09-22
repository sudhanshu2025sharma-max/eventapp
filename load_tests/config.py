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
