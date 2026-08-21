from django.db import transaction
from django.utils import timezone
from .models import PointEntry, UserPoints, POINT_VALUES, PointAction


def award_points(user, action, note='', points_override=None):
    """
    Award points to a user for an action.
    Creates PointEntry + updates UserPoints total.
    Supports points_override for custom amounts (e.g., custom selfie spot points).
    """
    pts = points_override if points_override is not None else POINT_VALUES.get(action)
    if pts is None:
        return None

    # Daily login: only once per calendar day
    if action == PointAction.DAILY_LOGIN:
        today = timezone.now().date()
        exists = PointEntry.objects.filter(
            user=user, action=action, created_at__date=today
        ).exists()
        if exists:
            return None

    with transaction.atomic():
        entry = PointEntry.objects.create(
            user=user, action=action, points=pts, note=note,
        )
        summary, _ = UserPoints.objects.get_or_create(user=user)
        summary.total_points = (summary.total_points or 0) + pts
        summary.save(update_fields=['total_points', 'updated_at'])

    return entry, summary


def award_daily_login(user):
    """Award daily login bonus if not already awarded today."""
    return award_points(user, PointAction.DAILY_LOGIN, 'Daily login bonus')
