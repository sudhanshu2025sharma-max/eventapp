import logging
from apps.notifications.models import Notification, DeviceToken
from apps.notifications import fcm

logger = logging.getLogger(__name__)

def push_to_checked_in(title, body, data=None):
    """
    Dispatches push notification to all users using the exact proven FCM/Expo pipeline,
    creates UserNotification records (for delivery tracking), and marks status='sent'.
    """
    if data is None:
        data = {'type': 'meal_pass', 'screen': 'qr'}

    notif = Notification.objects.create(
        title=title,
        body=body,
        target_type='all',
        data=data,
        status='pending',
    )

    try:
        success, failed, bad = fcm.send_to_all(title, body, data, notif)
        if bad:
            DeviceToken.objects.filter(token__in=bad).update(is_active=False)

        notif.status = 'sent'
        notif.sent_count = success
        notif.failed_count = failed
        notif.save()
        logger.info(f"Meal notification sent: {title} (success={success}, failed={failed})")
        return {'success': success, 'failed': failed}
    except Exception as e:
        logger.error(f"Meal notification failed: {e}")
        notif.status = 'failed'
        notif.save()
        return {'success': 0, 'failed': 0, 'error': str(e)}
