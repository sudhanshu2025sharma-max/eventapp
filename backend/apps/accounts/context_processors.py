from .permissions_helper import get_user_permissions

def staff_permissions_context(request):
    """
    Exposes assigned permissions to all web admin templates.
    """
    if request.user.is_authenticated:
        perms = get_user_permissions(request.user)
        return {
            'user_permissions': perms,
            'is_super_admin': request.user.role in ['super_admin', 'mgmt_admin'],
        }
    return {
        'user_permissions': [],
        'is_super_admin': False,
    }
