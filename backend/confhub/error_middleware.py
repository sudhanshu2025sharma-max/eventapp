"""
Error handling middleware that works even when DEBUG=True.
Catches 404/403/500 for API requests and returns JSON.
For web requests, lets Django's normal flow handle it (debug page or custom template).
"""
import json
from django.http import JsonResponse
from django.utils.deprecation import MiddlewareMixin


class APIErrorMiddleware(MiddlewareMixin):
    """
    Intercepts error responses for API paths and ensures JSON format.
    Only activates for /api/ paths to avoid interfering with web panel.
    """

    def process_response(self, request, response):
        if not request.path.startswith('/api/'):
            return response

        if response.status_code == 404:
            return JsonResponse(
                {'success': False, 'error': 'Endpoint not found.', 'path': request.path},
                status=404
            )

        if response.status_code == 403:
            return JsonResponse(
                {'success': False, 'error': 'You do not have permission to access this resource.'},
                status=403
            )

        if response.status_code == 500:
            return JsonResponse(
                {'success': False, 'error': 'Internal server error. The team has been notified.'},
                status=500
            )

        if response.status_code == 401:
            return JsonResponse(
                {'success': False, 'error': 'Authentication required.'},
                status=401
            )

        return response
