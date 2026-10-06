import traceback
from .models import SystemLogEntry

class ErrorCaptureMiddleware:
    """
    Middleware that captures unhandled 5xx exceptions across Django
    and persists them to SystemLogEntry for instant web/mobile admin visibility.
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        return self.get_response(request)

    def process_exception(self, request, exception):
        try:
            tb = traceback.format_exc()
            user_email = ''
            if hasattr(request, 'user') and request.user.is_authenticated:
                user_email = request.user.email

            # Extract client IP
            x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
            if x_forwarded_for:
                ip = x_forwarded_for.split(',')[0].strip()
            else:
                ip = request.META.get('REMOTE_ADDR')

            SystemLogEntry.objects.create(
                log_type='backend_5xx',
                level='CRITICAL',
                message=str(exception),
                traceback=tb,
                path=request.path,
                method=request.method,
                ip_address=ip if ip else None,
                user_email=user_email,
                context_data={
                    'GET': dict(request.GET.items()),
                    'user_agent': request.META.get('HTTP_USER_AGENT', ''),
                }
            )
        except Exception:
            # Prevent logging failure from masking the original exception
            pass
        return None
