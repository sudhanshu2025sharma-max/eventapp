"""Inject admin permissions into every template context."""
from apps.accounts.permissions_helper import get_user_permissions


def admin_permissions(request):
    if request.user.is_authenticated and hasattr(request.user, "role"):
        perms = get_user_permissions(request.user)
        return {
            "user_permissions": perms,
            "is_super_admin": request.user.role in ("super_admin", "mgmt_admin"),
            "is_team_head": request.user.role == "team_head",
        }
    return {"user_permissions": [], "is_super_admin": False, "is_team_head": False}
