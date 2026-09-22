from celery import shared_task
from apps.checkins.meal_utils import sync_meal_window

@shared_task
def check_meal_notifications():
    """
    Periodic task running every 60s to check schedule data and transition
    active meal pass windows accordingly with system-wide notifications.
    """
    sync_meal_window()
