"""
Lightweight rate limiter using Redis.
No external dependencies — uses django.core.cache (already backed by Redis).
"""
import time
import json
from django.http import JsonResponse
from django.core.cache import cache

# Endpoints to rate-limit and their rules: {path_prefix: (max_requests, window_seconds)}
RATE_LIMIT_RULES = {
    '/api/v1/auth/login/':          (5, 60),    # 5 attempts per minute
    '/api/v1/auth/token/refresh/':  (10, 60),   # 10 refreshes per minute
    '/api/v1/auth/change-password/': (3, 300),  # 3 changes per 5 minutes
    '/api/v1/notifications/send/':  (10, 60),   # 10 sends per minute
}

def get_client_ip(request):
    """Extract real client IP from X-Forwarded-For (set by Apache/IITD Gateway)."""
    xff = request.META.get('HTTP_X_FORWARDED_FOR')
    if xff:
        return xff.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR', 'unknown')

class RateLimitMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Only rate-limit POST requests to sensitive endpoints
        if request.method == 'POST':
            path = request.path
            for prefix, (max_req, window) in RATE_LIMIT_RULES.items():
                if path.startswith(prefix):
                    ip = get_client_ip(request)
                    cache_key = f"ratelimit:{prefix}:{ip}"
                    
                    # Get current count from Redis cache
                    current = cache.get(cache_key, 0)
                    
                    if current >= max_req:
                        return JsonResponse(
                            {'success': False, 'detail': f'Too many requests. Try again in {window}s.'},
                            status=429
                        )
                    
                    # Increment counter
                    cache.set(cache_key, current + 1, timeout=window)
                    break

        return self.get_response(request)
