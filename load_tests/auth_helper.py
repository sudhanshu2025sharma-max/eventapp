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
