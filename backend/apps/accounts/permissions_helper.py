from functools import wraps
from django.shortcuts import redirect
from django.contrib import messages
from django.http import JsonResponse, HttpResponseForbidden
from rest_framework.response import Response
from rest_framework import status
from apps.accounts.models import StaffPermission

ALL_MODULE_KEYS = [choice[0] for choice in StaffPermission.MODULE_CHOICES]

# Web Admin sidebar permission mapping
MODULE_TITLES = dict(StaffPermission.MODULE_CHOICES)

def get_user_permissions(user):
    """
    Returns a list of module string keys assigned to the user.
    super_admin & mgmt_admin have full access to all 21 modules.
    """
    if not user or not user.is_authenticated:
        return []
    if user.role in ['super_admin', 'mgmt_admin']:
        return ALL_MODULE_KEYS
    if user.role in ['team_head', 'staff']:
        return list(
            StaffPermission.objects.filter(user=user)
            .values_list('module', flat=True)
        )
    return []


def user_has_module_access(user, module_key):
    """Checks if a user has access to a specific module."""
    if not user or not user.is_authenticated:
        return False
    if user.role in ['super_admin', 'mgmt_admin']:
        return True
    return StaffPermission.objects.filter(user=user, module=module_key).exists()


def module_required(module_key):
    """
    Decorator for Web Admin panel views.
    Bypassed by super_admin and mgmt_admin.
    Verifies staff/team_head has module permission.
    """
    def decorator(view_func):
        @wraps(view_func)
        def _wrapped_view(request, *args, **kwargs):
            if not request.user.is_authenticated:
                return redirect('admin_login')
            
            if request.user.role not in ['super_admin', 'mgmt_admin', 'team_head', 'staff']:
                messages.error(request, "Access restricted to event organizers.")
                return redirect('admin_login')

            if not user_has_module_access(request.user, module_key):
                messages.error(
                    request, 
                    f"You do not have access to '{MODULE_TITLES.get(module_key, module_key)}'. Please contact the Organising Chair."
                )
                return redirect('dashboard')

            return view_func(request, *args, **kwargs)
        return _wrapped_view
    return decorator


def api_module_required(module_key):
    """
    Decorator for DRF API endpoints.
    """
    def decorator(view_func):
        @wraps(view_func)
        def _wrapped_view(request, *args, **kwargs):
            if not request.user.is_authenticated:
                return Response({'detail': 'Authentication required.'}, status=status.HTTP_401_UNAUTHORIZED)

            if not user_has_module_access(request.user, module_key):
                return Response({
                    'success': False,
                    'detail': f"Permission denied for module '{module_key}'."
                }, status=status.HTTP_403_FORBIDDEN)

            return view_func(request, *args, **kwargs)
        return _wrapped_view
    return decorator
