"""
Custom error handlers for ETD 2026.
Returns JSON for API requests, branded HTML for web requests.
"""
from django.http import JsonResponse
from django.shortcuts import render


def _is_api_request(request):
    """Detect if the client expects JSON (API call vs browser)."""
    if request.path.startswith('/api/'):
        return True
    accept = request.headers.get('Accept', '')
    if 'application/json' in accept and 'text/html' not in accept:
        return True
    return False


def handler404(request, exception=None):
    if _is_api_request(request):
        return JsonResponse(
            {'success': False, 'error': 'Endpoint not found.'},
            status=404
        )
    return render(request, '404.html', status=404)


def handler500(request):
    if _is_api_request(request):
        return JsonResponse(
            {'success': False, 'error': 'Internal server error. The team has been notified.'},
            status=500
        )
    return render(request, '500.html', status=500)


def handler403(request, exception=None):
    if _is_api_request(request):
        return JsonResponse(
            {'success': False, 'error': 'You do not have permission to access this resource.'},
            status=403
        )
    return render(request, '403.html', status=403)
